"""GCal status and sync routes."""

from flask import Blueprint, jsonify
from lib.gcal import gcal_upsert, gcal_save, is_enabled, GCAL_CALENDAR_ID
from routes.tasks import _fetch_tasks

bp = Blueprint('gcal', __name__)

@bp.route('/api/gcal/status', methods=['GET'])
def gcal_status():
    return jsonify({'enabled': is_enabled(), 'calendar_id': GCAL_CALENDAR_ID if is_enabled() else None})

@bp.route('/api/gcal/sync', methods=['POST'])
def gcal_sync_all():
    if not is_enabled(): return jsonify({'error': 'Google Calendar not configured'}), 400
    tasks = _fetch_tasks("SELECT * FROM tasks WHERE due_date IS NOT NULL AND status!='done'")
    synced = 0
    for task in tasks:
        eid = gcal_upsert(task)
        if eid: gcal_save(task['id'], eid); synced += 1
    return jsonify({'synced': synced, 'total': len(tasks)})
