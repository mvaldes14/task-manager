"""ICS calendar import and event routes."""

import uuid
from datetime import datetime as dt, date as date_type, timezone
from zoneinfo import ZoneInfo

import psycopg2.extras
from flask import Blueprint, request, jsonify
from lib.db import get_db, release_db

_CST = ZoneInfo('America/Chicago')

bp = Blueprint('ics', __name__)


def _parse_ics(content: str, year: int, month: int) -> list:
    from icalendar import Calendar as ICal
    try:
        cal = ICal.from_ical(content)
    except Exception as e:
        raise ValueError(f"Invalid ICS data: {e}")
    events = []
    for component in cal.walk():
        if component.name != 'VEVENT': continue
        try:
            dtstart = component.get('DTSTART')
            if not dtstart: continue
            val = dtstart.dt
            if isinstance(val, dt):
                # Convert timezone-aware datetimes (typically UTC) to CST/CDT
                if val.tzinfo is not None:
                    val = val.astimezone(_CST)
                event_date = val.date()
            else:
                event_date = val
            if event_date.year != year or event_date.month != month: continue
            summary  = str(component.get('SUMMARY', 'Untitled'))
            due_time = val.strftime('%H:%M') if isinstance(val, dt) else None
            events.append({
                'id':       str(component.get('UID', '')),
                'title':    summary,
                'due_date': event_date.isoformat(),
                'due_time': due_time,
                'all_day':  not isinstance(val, dt),
            })
        except Exception:
            continue
    return events


@bp.route('/api/ics', methods=['GET'])
def list_ics():
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, name, color, url FROM ics_calendars ORDER BY created_at")
        return jsonify([dict(r) for r in cur.fetchall()])
    finally:
        release_db(conn)


@bp.route('/api/ics', methods=['POST'])
def add_ics():
    cid   = str(uuid.uuid4())
    color = '#bb9af7'; name = 'Calendar'; url = None; content = None

    if request.content_type and 'multipart' in request.content_type:
        f = request.files.get('file')
        if not f: return jsonify({'error': 'No file'}), 400
        content = f.read().decode('utf-8', errors='replace')
        name    = request.form.get('name', f.filename or 'Calendar')
        color   = request.form.get('color', color)
    else:
        data  = request.get_json() or {}
        name  = data.get('name', name)
        color = data.get('color', color)
        url   = data.get('url')
        if url:
            import urllib.request
            try:
                with urllib.request.urlopen(url, timeout=10) as r:
                    content = r.read().decode('utf-8', errors='replace')
            except Exception as e:
                return jsonify({'error': f'Could not fetch URL: {e}'}), 400
        else:
            return jsonify({'error': 'Provide url or file'}), 400

    if not content or 'VCALENDAR' not in content:
        return jsonify({'error': 'Not a valid ICS file'}), 400

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO ics_calendars (id,name,color,url,content) VALUES (%s,%s,%s,%s,%s)",
                    (cid, name, color, url, content))
        conn.commit()
    finally:
        release_db(conn)
    return jsonify({'id': cid, 'name': name, 'color': color, 'url': url}), 201


@bp.route('/api/ics/<cid>', methods=['DELETE'])
def delete_ics(cid):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM ics_calendars WHERE id=%s", (cid,)); conn.commit()
    finally:
        release_db(conn)
    return '', 204


@bp.route('/api/ics/<cid>/events', methods=['GET'])
def get_ics_events(cid):
    from datetime import date
    try:
        year  = int(request.args.get('year',  date.today().year))
        month = int(request.args.get('month', date.today().month))
    except ValueError:
        return jsonify({'error': 'year and month must be integers'}), 400

    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT content, url FROM ics_calendars WHERE id=%s", (cid,))
        row = cur.fetchone()
    finally:
        release_db(conn)
    if not row: return jsonify({'error': 'Not found'}), 404
    content = row['content']
    if row['url']:
        try:
            import urllib.request
            with urllib.request.urlopen(row['url'], timeout=10) as r:
                content = r.read().decode('utf-8', errors='replace')
        except Exception:
            pass  # fall back to stored content if fetch fails
    try:
        events = _parse_ics(content, year, month)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify(events)
