"""Google Calendar integration."""

import json, os, logging
from datetime import datetime, timedelta, date as date_type
from lib.db import get_db, release_db

logger = logging.getLogger(__name__)

GCAL_ENABLED     = False
GCAL_CREDENTIALS = os.environ.get('GCAL_CREDENTIALS_JSON')
GCAL_CALENDAR_ID = os.environ.get('GCAL_CALENDAR_ID', 'primary')
_gcal_service    = None


def _get_gcal_service():
    global _gcal_service, GCAL_ENABLED
    if _gcal_service: return _gcal_service
    if not GCAL_CREDENTIALS: return None
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
        creds = Credentials.from_service_account_info(
            json.loads(GCAL_CREDENTIALS),
            scopes=['https://www.googleapis.com/auth/calendar'])
        _gcal_service = build('calendar', 'v3', credentials=creds)
        GCAL_ENABLED = True
        logger.info("Google Calendar connected.")
        return _gcal_service
    except Exception as e:
        logger.error("GCal init failed: %s", e)
        return None


def is_enabled():
    return GCAL_ENABLED


def gcal_upsert(task):
    svc = _get_gcal_service()
    tid = task.get('id', '?'); ttitle = task.get('title', '?')
    if not svc:
        logger.debug("skip — not enabled (task %s '%s')", tid, ttitle)
        return None
    if not task.get('due_date'):
        logger.debug("skip — no due_date (task %s '%s')", tid, ttitle)
        return None
    try:
        tz = task.get('timezone') or 'UTC'
        if task.get('due_time'):
            dt = f"{task['due_date']}T{task['due_time']}:00"
            end_dt = (datetime.fromisoformat(dt) + timedelta(hours=1)).isoformat()
            start = {'dateTime': dt, 'timeZone': tz}
            end   = {'dateTime': end_dt, 'timeZone': tz}
            time_str = f"{task['due_date']} {task['due_time']} ({tz})"
        else:
            # Google Calendar requires all-day event end = start + 1 day
            end_date = (date_type.fromisoformat(task['due_date']) + timedelta(days=1)).isoformat()
            start = {'date': task['due_date']}
            end   = {'date': end_date}
            time_str = f"{task['due_date']} (all-day)"
        done  = task.get('status') == 'done'
        title = f"\u2713 {task['title']}" if done else task['title']
        body  = {
            'summary': title,
            'description': task.get('description') or '',
            'start': start, 'end': end,
            'colorId': '8' if done else None,
            'extendedProperties': {'private': {'td_task_id': task['id']}},
        }
        if body['colorId'] is None: del body['colorId']
        eid = task.get('gcal_event_id')
        if eid:
            ev = svc.events().update(calendarId=GCAL_CALENDAR_ID, eventId=eid, body=body).execute()
            logger.info("updated  %s — '%s' @ %s status=%s", eid, ttitle, time_str, task.get('status'))
        else:
            ev = svc.events().insert(calendarId=GCAL_CALENDAR_ID, body=body).execute()
            logger.info("created  %s — '%s' @ %s status=%s", ev.get('id'), ttitle, time_str, task.get('status'))
        return ev.get('id')
    except Exception as e:
        logger.error("upsert error task %s '%s': %s", tid, ttitle, e)
        return None


def gcal_delete(event_id):
    svc = _get_gcal_service()
    if not svc or not event_id: return
    try:
        svc.events().delete(calendarId=GCAL_CALENDAR_ID, eventId=event_id).execute()
        logger.info("deleted  %s", event_id)
    except Exception as e:
        logger.error("delete error %s: %s", event_id, e)


def gcal_save(task_id, event_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE tasks SET gcal_event_id=%s WHERE id=%s", (event_id, task_id))
        conn.commit()
    finally:
        release_db(conn)


# Initialise on import
_get_gcal_service()
