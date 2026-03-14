"""Project CRUD routes."""

import uuid
import psycopg2.extras
from flask import Blueprint, request, jsonify
from lib.db import get_db, release_db, row_to_dict

bp = Blueprint('projects', __name__)

@bp.route('/api/projects', methods=['GET', 'OPTIONS'])
def get_projects():
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM projects ORDER BY created_at")
        return jsonify([row_to_dict(r) for r in cur.fetchall()])
    finally:
        release_db(conn)

@bp.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    pid = str(uuid.uuid4())
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "INSERT INTO projects (id,name,color,icon) VALUES (%s,%s,%s,%s) RETURNING *",
            (pid, data['name'], data.get('color', '#6366f1'), data.get('icon', '📁')))
        row = row_to_dict(cur.fetchone())
        conn.commit()
    finally:
        release_db(conn)
    return jsonify(row), 201

@bp.route('/api/projects/<pid>', methods=['PUT', 'PATCH'])
def update_project(pid):
    data = request.get_json()
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        for field in ('name', 'color', 'icon'):
            if field in data:
                cur.execute(f"UPDATE projects SET {field}=%s,updated_at=NOW() WHERE id=%s", (data[field], pid))
        cur.execute("SELECT * FROM projects WHERE id=%s", (pid,))
        row = row_to_dict(cur.fetchone())
        conn.commit()
    finally:
        release_db(conn)
    return jsonify(row)

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
