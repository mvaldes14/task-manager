"""AI result routes — store and retrieve AI-generated content for tasks."""

import logging
from flask import Blueprint, jsonify, request
from lib.db import get_db, release_db

logger = logging.getLogger(__name__)
bp = Blueprint('ai', __name__)


@bp.route('/api/tasks/<tid>/ai', methods=['GET'])
def get_ai_result(tid):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT content, model, created_at, updated_at FROM task_ai_results WHERE task_id=%s",
            (tid,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({
            'content':    row[0],
            'model':      row[1],
            'created_at': str(row[2]) if row[2] else None,
            'updated_at': str(row[3]) if row[3] else None,
        })
    finally:
        release_db(conn)


@bp.route('/api/tasks/<tid>/ai', methods=['PUT'])
def put_ai_result(tid):
    data = request.get_json() or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'content required'}), 400
    model = data.get('model')
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM tasks WHERE id=%s", (tid,))
        if not cur.fetchone():
            return jsonify({'error': 'Task not found'}), 404
        cur.execute("""
            INSERT INTO task_ai_results (task_id, content, model)
            VALUES (%s, %s, %s)
            ON CONFLICT (task_id) DO UPDATE
                SET content = EXCLUDED.content,
                    model   = EXCLUDED.model,
                    updated_at = NOW()
        """, (tid, content, model))
        cur.execute(
            "UPDATE tasks SET has_ai_result = TRUE, updated_at = NOW() WHERE id = %s",
            (tid,)
        )
        conn.commit()
        logger.info('AI result stored for task %s (model=%s)', tid, model)
    finally:
        release_db(conn)
    return jsonify({'ok': True, 'task_id': tid})
