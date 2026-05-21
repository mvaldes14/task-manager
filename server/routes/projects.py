"""Project CRUD routes."""

import uuid
import psycopg2.extras
from flask import Blueprint, request, jsonify, g
from lib.db import get_db, release_db, row_to_dict

bp = Blueprint('projects', __name__)

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
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM projects WHERE id != 'inbox' AND owner_id IS NOT DISTINCT FROM %s",
            (owner_id,))
        next_pos = cur.fetchone()['next_pos']
        cur.execute(
            "INSERT INTO projects (id,name,color,icon,owner_id,shared,position) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (pid, data['name'], data.get('color', '#6366f1'), data.get('icon', '📁'), owner_id, False, next_pos))
        row = row_to_dict(cur.fetchone())
        conn.commit()
    finally:
        release_db(conn)
    return jsonify(row), 201

_ALLOWED_PROJECT_FIELDS = {'name', 'color', 'icon', 'shared'}

@bp.route('/api/projects/<pid>', methods=['PUT', 'PATCH'])
def update_project(pid):
    data = request.get_json() or {}
    fields = {k: v for k, v in data.items() if k in _ALLOWED_PROJECT_FIELDS}
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
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
        for idx, pid in enumerate(order, start=1):
            if pid == 'inbox':
                continue
            cur.execute("UPDATE projects SET position=%s, updated_at=NOW() WHERE id=%s", (idx, pid))
        conn.commit()
    finally:
        release_db(conn)
    return '', 204

@bp.route('/api/projects/<pid>', methods=['DELETE'])
def delete_project(pid):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE tasks SET project_id='inbox' WHERE project_id=%s", (pid,))
        cur.execute("DELETE FROM projects WHERE id=%s AND id!='inbox'", (pid,))
        conn.commit()
    finally:
        release_db(conn)
    return '', 204
