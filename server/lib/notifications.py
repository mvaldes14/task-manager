"""Background reminder scheduler — checks due tasks and sends push notifications."""

import json
import logging
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import psycopg2.extras

from lib.db import get_db, release_db, get_settings

logger = logging.getLogger(__name__)

_scheduler = None


# ── HTTP dispatch ──────────────────────────────────────────────────────────────

def _send_gotify(url: str, token: str, title: str, message: str) -> None:
    if not token:
        raise ValueError('Gotify requires a token — set one in Settings → Notifications')
    endpoint = url.rstrip('/') + '/message'
    payload = json.dumps({'title': title, 'message': message, 'priority': 5}).encode()
    # Pass token both as query param and header — the header works better behind
    # reverse proxies that may strip query strings.
    req = urllib.request.Request(
        endpoint + f'?token={token}',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'X-Gotify-Key': token,
            'User-Agent': 'Mozilla/5.0 (compatible; doit-reminders/1.0)',
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status >= 400:
            raise RuntimeError(f'Gotify returned HTTP {resp.status}')


def _send_ntfy(url: str, token: str, title: str, message: str) -> None:
    headers = {
        'Title': title,
        'Content-Type': 'text/plain',
        'User-Agent': 'Mozilla/5.0 (compatible; doit-reminders/1.0)',
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(
        url.rstrip('/'), data=message.encode(),
        headers=headers, method='POST',
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status >= 400:
            raise RuntimeError(f'ntfy returned HTTP {resp.status}')


def _dispatch(settings: dict, title: str, message: str) -> None:
    ntype = settings.get('notification_type', '')
    nurl  = (settings.get('notification_url') or '').strip()
    token = (settings.get('notification_token') or '').strip()
    if not ntype or not nurl:
        return
    if ntype == 'gotify':
        _send_gotify(nurl, token, title, message)
    elif ntype == 'ntfy':
        _send_ntfy(nurl, token, title, message)


# ── Core worker ────────────────────────────────────────────────────────────────

def check_and_send_reminders() -> None:
    settings = get_settings()
    if not settings.get('reminder_enabled'):
        return
    if not settings.get('notification_type') or not settings.get('notification_url'):
        return

    tz_name        = settings.get('reminder_timezone', 'America/Chicago')
    minutes_before = int(settings.get('reminder_minutes_before', 30))
    allday_time    = settings.get('reminder_allday_time', '08:00')

    # Validate timezone — fall back to UTC if unknown
    try:
        ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, Exception):
        logger.warning('[notifications] unknown timezone %r, falling back to UTC', tz_name)
        tz_name = 'UTC'

    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT id, title, due_date, due_time
            FROM tasks
            WHERE status != 'done'
              AND reminder_sent_at IS NULL
              AND due_date IS NOT NULL
              AND (
                -- Timed task: due within the reminder window (or overdue up to 2 h)
                (
                  due_time IS NOT NULL
                  AND (due_date + due_time) AT TIME ZONE %s
                      BETWEEN NOW() - INTERVAL '2 hours'
                          AND NOW() + (%s * INTERVAL '1 minute')
                )
                OR
                -- All-day task: fire when clock crosses the configured reminder time
                (
                  due_time IS NULL
                  AND (due_date + CAST(%s AS TIME)) AT TIME ZONE %s
                      BETWEEN NOW() - INTERVAL '1 minute'
                          AND NOW() + INTERVAL '1 minute'
                )
              )
        """, (tz_name, minutes_before, allday_time, tz_name))
        due_tasks = cur.fetchall()
    finally:
        release_db(conn)

    if not due_tasks:
        return

    logger.info('[notifications] %d task(s) queued for reminder', len(due_tasks))

    for task in due_tasks:
        try:
            if task['due_time']:
                time_str = str(task['due_time'])[:5]
                body = f"Due at {time_str} — {task['title']}"
            else:
                body = f"Due today — {task['title']}"

            _dispatch(settings, f"Reminder: {task['title']}", body)

            conn2 = get_db()
            try:
                cur2 = conn2.cursor()
                cur2.execute(
                    "UPDATE tasks SET reminder_sent_at = NOW() WHERE id = %s",
                    (task['id'],),
                )
                conn2.commit()
            finally:
                release_db(conn2)

            logger.info('[notifications] reminder sent for task %s (%s)', task['id'], task['title'])
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')[:300]
            logger.error(
                '[notifications] HTTP %s from %s for task %s — response: %s',
                e.code, settings.get('notification_type'), task['id'], body,
            )
        except Exception:
            logger.exception('[notifications] failed to send reminder for task %s', task['id'])


# ── Scheduler lifecycle ────────────────────────────────────────────────────────

def start_scheduler() -> None:
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        logger.warning('[notifications] APScheduler not installed — reminders disabled')
        return

    if _scheduler and _scheduler.running:
        return

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        check_and_send_reminders,
        'interval',
        minutes=1,
        id='reminders',
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info('[notifications] reminder scheduler started (interval: 1 min)')
