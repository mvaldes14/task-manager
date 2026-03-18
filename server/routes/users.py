"""User management routes."""

import io, uuid, logging
import bcrypt
import psycopg2.extras
from flask import Blueprint, request, jsonify, g, send_file

from lib.db import get_db, release_db
from routes.auth import enable_auth

logger = logging.getLogger(__name__)

bp = Blueprint('users', __name__)


def _user_row(row: dict) -> dict:
    return {
        'id':           row['id'],
        'username':     row['username'],
        'display_name': row['display_name'],
        'is_admin':     row['is_admin'],
        'has_avatar':   bool(row.get('has_avatar') or row.get('avatar')),
    }


@bp.route('/api/users', methods=['GET'])
def list_users():
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, username, display_name, is_admin, (avatar IS NOT NULL) AS has_avatar FROM users ORDER BY created_at")
        return jsonify([_user_row(r) for r in cur.fetchall()])
    finally:
        release_db(conn)


@bp.route('/api/users/me', methods=['GET'])
def get_me():
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, username, display_name, is_admin, (avatar IS NOT NULL) AS has_avatar FROM users WHERE id=%s", (g.user_id,))
        row = cur.fetchone()
        if not row: return jsonify({'error': 'Not found'}), 404
        return jsonify(_user_row(row))
    finally:
        release_db(conn)


@bp.route('/api/users/me', methods=['PATCH'])
def update_me():
    data = request.get_json() or {}
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if 'display_name' in data:
            cur.execute("UPDATE users SET display_name=%s WHERE id=%s", (data['display_name'] or None, g.user_id))
        if 'new_password' in data:
            cur.execute("SELECT password_hash FROM users WHERE id=%s", (g.user_id,))
            row = cur.fetchone()
            if not row: return jsonify({'error': 'Not found'}), 404
            if not bcrypt.checkpw(data.get('current_password', '').encode(), row['password_hash'].encode()):
                return jsonify({'error': 'Current password is incorrect'}), 400
            new_hash = bcrypt.hashpw(data['new_password'].encode(), bcrypt.gensalt(12)).decode()
            cur.execute("UPDATE users SET password_hash=%s WHERE id=%s", (new_hash, g.user_id))
        cur.execute("SELECT id, username, display_name, is_admin, (avatar IS NOT NULL) AS has_avatar FROM users WHERE id=%s", (g.user_id,))
        row = cur.fetchone()
        conn.commit()
        return jsonify(_user_row(row))
    finally:
        release_db(conn)


@bp.route('/api/users/me/avatar', methods=['POST'])
def upload_avatar():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    f = request.files['file']
    try:
        from PIL import Image
        img = Image.open(f.stream).convert('RGB')
        img.thumbnail((50, 50), Image.LANCZOS)
        # Pad to exact 50x50
        out = Image.new('RGB', (50, 50), (0, 0, 0))
        offset = ((50 - img.width) // 2, (50 - img.height) // 2)
        out.paste(img, offset)
        buf = io.BytesIO()
        out.save(buf, format='JPEG', quality=85)
        avatar_bytes = buf.getvalue()
    except Exception as e:
        return jsonify({'error': f'Image processing failed: {e}'}), 400

    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE users SET avatar=%s WHERE id=%s", (psycopg2.Binary(avatar_bytes), g.user_id))
        conn.commit()
        return jsonify({'ok': True})
    finally:
        release_db(conn)


@bp.route('/api/users/<uid>/avatar', methods=['GET'])
def get_avatar(uid):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT avatar FROM users WHERE id=%s", (uid,))
        row = cur.fetchone()
        if not row or not row[0]:
            return jsonify({'error': 'No avatar'}), 404
        return send_file(io.BytesIO(bytes(row[0])), mimetype='image/jpeg',
                         max_age=3600, conditional=True)
    finally:
        release_db(conn)


@bp.route('/api/users', methods=['POST'])
def create_user():
    # Only admins can create users
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT is_admin FROM users WHERE id=%s", (g.user_id,))
        row = cur.fetchone()
        if not row or not row['is_admin']:
            return jsonify({'error': 'Admin only'}), 403

        data = request.get_json() or {}
        username = (data.get('username') or '').strip().lower()
        password = (data.get('password') or '').strip()
        display_name = (data.get('display_name') or '').strip() or None
        if not username or not password:
            return jsonify({'error': 'username and password required'}), 400

        uid = str(uuid.uuid4())
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
        cur.execute(
            "INSERT INTO users (id, username, password_hash, display_name, is_admin) VALUES (%s,%s,%s,%s,FALSE) RETURNING id, username, display_name, is_admin",
            (uid, username, pw_hash, display_name))
        new_user = dict(cur.fetchone())
        new_user['has_avatar'] = False
        conn.commit()
        enable_auth()
        return jsonify(new_user), 201
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        return jsonify({'error': 'Username already taken'}), 409
    finally:
        release_db(conn)
