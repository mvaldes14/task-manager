"""Project CRUD routes."""

import uuid
from datetime import date, datetime, timezone

import psycopg2.extras
from flask import Blueprint, request, jsonify, g
from lib.db import get_db, release_db, row_to_dict

bp = Blueprint('projects', __name__)


def _normalize_due_date(value):
    """Return (iso_date_or_None, error_or_None). Empty string clears the deadline."""
    if value is None or str(value).strip() == '':
        return None, None
    try:
        return date.fromisoformat(str(value).strip()).isoformat(), None
    except ValueError:
        return None, 'Invalid due_date: expected YYYY-MM-DD'


def _validate_parent(cur, parent_id, child_id=None):
    """Return an error string if parent_id is not a legal parent, else None.

    One level only: the parent must exist, must not be `inbox`, must not be the
    child itself, and must be a root (parent_id IS NULL). A project that already
    has children of its own cannot be given a parent.
    """
    if parent_id is None:
        return None
    if parent_id == 'inbox':
        return 'inbox cannot be a parent project'
    if child_id is not None and parent_id == child_id:
        return 'a project cannot be its own parent'
    cur.execute("SELECT parent_id FROM projects WHERE id=%s", (parent_id,))
    row = cur.fetchone()
    if row is None:
        return 'parent project not found'
    if row['parent_id'] is not None:
        return 'subprojects cannot be nested more than one level deep'
    if child_id is not None:
        cur.execute("SELECT 1 FROM projects WHERE parent_id=%s LIMIT 1", (child_id,))
        if cur.fetchone() is not None:
            return 'a project with subprojects cannot itself become a subproject'
    return None

@bp.route('/api/projects', methods=['GET', 'OPTIONS'])
def get_projects():
    user_id = getattr(g, 'user_id', None)
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Inbox always first; rest by position then created_at
        order_clause = "ORDER BY (id='inbox') DESC, position, created_at"
        if user_id:
            cur.execute(
                f"SELECT * FROM projects WHERE id='inbox' OR owner_id=%s OR shared=TRUE {order_clause}",
                (user_id,))
        else:
            cur.execute(f"SELECT * FROM projects {order_clause}")
        return jsonify([row_to_dict(r) for r in cur.fetchall()])
    finally:
        release_db(conn)

@bp.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    pid = str(uuid.uuid4())
    owner_id = getattr(g, 'user_id', None)
    parent_id = data.get('parent_id') or None
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        err = _validate_parent(cur, parent_id)
        if err:
            return jsonify({'error': err}), 400
        # position is scoped to the sibling group (roots together, each parent's
        # children together), so a new subproject starts at the end of its parent.
        cur.execute(
            "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM projects "
            "WHERE id != 'inbox' AND owner_id IS NOT DISTINCT FROM %s AND parent_id IS NOT DISTINCT FROM %s",
            (owner_id, parent_id))
        next_pos = cur.fetchone()['next_pos']
        due_date, due_err = _normalize_due_date(data.get('due_date'))
        if due_err:
            return jsonify({'error': due_err}), 400
        cur.execute(
            "INSERT INTO projects (id,name,color,icon,owner_id,shared,position,parent_id,description,due_date) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (pid, data['name'], data.get('color', '#6366f1'), data.get('icon', '📁'), owner_id, False,
             next_pos, parent_id, (data.get('description') or '').strip(), due_date))
        row = row_to_dict(cur.fetchone())
        conn.commit()
    finally:
        release_db(conn)
    return jsonify(row), 201

_ALLOWED_PROJECT_FIELDS = {'name', 'color', 'icon', 'shared', 'parent_id', 'description', 'due_date'}

@bp.route('/api/projects/<pid>', methods=['PUT', 'PATCH'])
def update_project(pid):
    data = request.get_json() or {}
    fields = {k: v for k, v in data.items() if k in _ALLOWED_PROJECT_FIELDS}
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if 'parent_id' in fields:
            if pid == 'inbox':
                return jsonify({'error': 'inbox cannot be a subproject'}), 400
            fields['parent_id'] = fields['parent_id'] or None
            err = _validate_parent(cur, fields['parent_id'], child_id=pid)
            if err:
                return jsonify({'error': err}), 400
            # Moving between sibling groups: land at the end of the new group.
            cur.execute("SELECT owner_id, parent_id FROM projects WHERE id=%s", (pid,))
            current = cur.fetchone()
            if current is not None and current['parent_id'] is not fields['parent_id'] \
                    and current['parent_id'] != fields['parent_id']:
                cur.execute(
                    "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM projects "
                    "WHERE id != 'inbox' AND owner_id IS NOT DISTINCT FROM %s AND parent_id IS NOT DISTINCT FROM %s",
                    (current['owner_id'], fields['parent_id']))
                fields['position'] = cur.fetchone()['next_pos']
        if 'due_date' in fields:
            fields['due_date'], due_err = _normalize_due_date(fields['due_date'])
            if due_err:
                return jsonify({'error': due_err}), 400
            # Moving the deadline re-arms the reminder, matching how tasks reset
            # reminder_sent_at when due_date or due_time changes.
            fields['deadline_notified_at'] = None
        if 'description' in fields:
            fields['description'] = (fields['description'] or '').strip()
        # Callers send a boolean `archived`; the timestamp is ours to manage.
        if 'archived' in data:
            if pid == 'inbox':
                return jsonify({'error': 'inbox cannot be archived'}), 400
            fields['archived_at'] = datetime.now(timezone.utc) if data['archived'] else None
        if fields:
            set_clause = ', '.join(f"{f}=%s" for f in fields) + ', updated_at=NOW()'
            values = list(fields.values()) + [pid]
            cur.execute(f"UPDATE projects SET {set_clause} WHERE id=%s", values)
        cur.execute("SELECT * FROM projects WHERE id=%s", (pid,))
        row = row_to_dict(cur.fetchone())
        conn.commit()
    finally:
        release_db(conn)
    return jsonify(row)

@bp.route('/api/projects/reorder', methods=['POST'])
def reorder_projects():
    data = request.get_json() or {}
    order = data.get('order') or []
    if not isinstance(order, list):
        return jsonify({'error': 'order must be a list of project ids'}), 400
    conn = get_db()
    try:
        cur = conn.cursor()
        # The client sends one flat depth-first list. Positions are per sibling
        # group, so number roots and each parent's children independently.
        ids = [p for p in order if p != 'inbox']
        parents = {}
        if ids:
            cur.execute("SELECT id, parent_id FROM projects WHERE id = ANY(%s)", (ids,))
            parents = {r[0]: r[1] for r in cur.fetchall()}
        counters = {}
        for pid in ids:
            if pid not in parents:
                continue
            key = parents[pid]
            counters[key] = counters.get(key, 0) + 1
            cur.execute("UPDATE projects SET position=%s, updated_at=NOW() WHERE id=%s", (counters[key], pid))
        conn.commit()
    finally:
        release_db(conn)
    return '', 204

@bp.route('/api/projects/<pid>', methods=['DELETE'])
def delete_project(pid):
    conn = get_db()
    try:
        cur = conn.cursor()
        # Children are promoted to top level, not deleted. Their tasks are untouched.
        cur.execute("UPDATE projects SET parent_id=NULL, updated_at=NOW() WHERE parent_id=%s", (pid,))
        cur.execute("UPDATE tasks SET project_id='inbox' WHERE project_id=%s", (pid,))
        cur.execute("DELETE FROM projects WHERE id=%s AND id!='inbox'", (pid,))
        conn.commit()
    finally:
        release_db(conn)
    return '', 204
