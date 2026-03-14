"""Google Calendar integration."""

import json, os
from datetime import datetime, timedelta
from lib.db import get_db, release_db

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
        print("[gcal] Google Calendar connected.", flush=True)
        return _gcal_service
    except Exception as e:
        print(f"[gcal] init failed: {e}", flush=True); return None


def is_enabled():
    return GCAL_ENABLED


def gcal_upsert(task):
    svc = _get_gcal_service()
    tid = task.get('id', '?'); ttitle = task.get('title', '?')
    if not svc:
        print(f"[gcal] skip — not enabled (task {tid} '{ttitle}')", flush=True); return None
    if not task.get('due_date'):
        print(f"[gcal] skip — no due_date (task {tid} '{ttitle}')", flush=True); return None
    try:
        tz = task.get('timezone') or 'UTC'
        if task.get('due_time'):
            dt = f"{task['due_date']}T{task['due_time']}:00"
            end_dt = (datetime.fromisoformat(dt) + timedelta(hours=1)).isoformat()
            start = {'dateTime': dt, 'timeZone': tz}
            end   = {'dateTime': end_dt, 'timeZone': tz}
            time_str = f"{task['due_date']} {task['due_time']} ({tz})"
        else:
            start = {'date': task['due_date']}
            end   = {'date': task['due_date']}
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
            print(f"[gcal] updated  {eid} — '{ttitle}' @ {time_str} status={task.get('status')}", flush=True)
        else:
            ev = svc.events().insert(calendarId=GCAL_CALENDAR_ID, body=body).execute()
            print(f"[gcal] created  {ev.get('id')} — '{ttitle}' @ {time_str} status={task.get('status')}", flush=True)
        return ev.get('id')
    except Exception as e:
        print(f"[gcal] upsert error task {tid} '{ttitle}': {e}", flush=True); return None


def gcal_delete(event_id):
    svc = _get_gcal_service()
    if not svc or not event_id: return
    try:
        svc.events().delete(calendarId=GCAL_CALENDAR_ID, eventId=event_id).execute()
        print(f"[gcal] deleted  {event_id}", flush=True)
    except Exception as e:
        print(f"[gcal] delete error {event_id}: {e}", flush=True)


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
