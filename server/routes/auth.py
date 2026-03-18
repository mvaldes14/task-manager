"""Auth routes: login, logout, status, middleware."""

import os, secrets, threading, time as _time, logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import psycopg2.extras
from flask import Blueprint, request, jsonify, redirect, make_response

from lib.db import get_db, release_db
from lib.gcal import is_enabled as gcal_is_enabled

logger = logging.getLogger(__name__)

TD_USERNAME    = os.environ.get('TD_USERNAME', '').strip().lower()
TD_PASSWORD    = os.environ.get('TD_PASSWORD', '').strip()
API_KEY        = os.environ.get('TD_API_KEY', '').strip()
OBSIDIAN_VAULT = os.environ.get('OBSIDIAN_VAULT', '').strip()
OBSIDIAN_INBOX = os.environ.get('OBSIDIAN_INBOX', '').strip().strip('/')

# Fallback env-var password check (used during transition until users table is populated)
_hashed_pw: bytes | None = bcrypt.hashpw(TD_PASSWORD.encode(), bcrypt.gensalt(12)) if TD_PASSWORD else None

def _check_env_password(provided: str) -> bool:
    if not _hashed_pw or not provided:
        return False
    return bcrypt.checkpw(provided.encode(), _hashed_pw)

bp = Blueprint('auth', __name__)

# ── Rate limiting ──────────────────────────────────────────────
_LOCKOUT_ATTEMPTS = 5
_LOCKOUT_SECONDS  = 900
_failed: dict     = {}
_failed_lock      = threading.Lock()

def _check_rate_limit(ip: str) -> bool:
    now = _time.time()
    with _failed_lock:
        attempts = [t for t in _failed.get(ip, []) if now - t < _LOCKOUT_SECONDS]
        _failed[ip] = attempts
        return len(attempts) >= _LOCKOUT_ATTEMPTS

def _record_failure(ip: str):
    with _failed_lock:
        _failed.setdefault(ip, []).append(_time.time())

def _clear_failures(ip: str):
    with _failed_lock:
        _failed.pop(ip, None)

# ── Session helpers ────────────────────────────────────────────
_PUBLIC_PATHS = {'/login', '/auth/login', '/auth/logout', '/auth/status',
                 '/manifest.json', '/manifest.webmanifest', '/sw.js', '/favicon.ico',
                 '/favicon-16.png', '/favicon-32.png', '/apple-touch-icon.png',
                 '/icon-192.png', '/icon-512.png'}

def _create_session(user_id: str | None, remember: bool):
    sid = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + (timedelta(days=30) if remember else timedelta(hours=8))
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO sessions (id,expires,remember,user_id) VALUES (%s,%s,%s,%s)",
                    (sid, expires, remember, user_id))
        conn.commit()
    finally:
        release_db(conn)
    return sid, expires

# cache: sid -> {'expires': datetime, 'user_id': str | None}
_session_cache: dict = {}

_INVALID_SESSION = object()  # sentinel: session does not exist or is expired

def _valid_session(sid: str):
    """Return user_id (str or None) for a valid session, or _INVALID_SESSION sentinel."""
    if not sid: return _INVALID_SESSION
    now = datetime.now(timezone.utc)
    if sid in _session_cache:
        entry = _session_cache[sid]
        if now < entry['expires']:
            return entry['user_id']   # may be None for pre-migration sessions
        del _session_cache[sid]
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT expires, user_id FROM sessions WHERE id=%s", (sid,))
        row = cur.fetchone()
        if not row: return _INVALID_SESSION
        exp = row['expires']
        exp = exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp
        if now < exp:
            _session_cache[sid] = {'expires': exp, 'user_id': row['user_id']}
            return row['user_id']   # may be None
        return _INVALID_SESSION
    except Exception:
        logger.exception("Error validating session %s", sid[:8])
        return _INVALID_SESSION
    finally:
        if conn: release_db(conn)

def _delete_session(sid: str):
    _session_cache.pop(sid, None)
    conn = None
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE id=%s", (sid,))
        conn.commit()
    except Exception:
        logger.exception("Error deleting session")
    finally:
        if conn: release_db(conn)

def _purge_expired_sessions():
    now = datetime.now(timezone.utc)
    expired = [sid for sid, e in list(_session_cache.items()) if now >= e['expires']]
    for sid in expired:
        _session_cache.pop(sid, None)
    # Purge DB
    conn = None
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE expires<NOW()")
        conn.commit()
    except Exception:
        logger.exception("Error purging expired sessions")
    finally:
        if conn: release_db(conn)

def get_authenticated_user_id() -> str | None:
    """Return the current user's ID, or None if not authenticated.
    Raises no exception — returns None on any failure.
    """
    if API_KEY:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer ') and auth[7:] == API_KEY:
            return _get_api_key_user_id()
        if request.headers.get('X-API-Key', '') == API_KEY:
            return _get_api_key_user_id()
    result = _valid_session(request.cookies.get('td_session', ''))
    if result is _INVALID_SESSION:
        return None
    return result  # str user_id, or None for pre-migration session (still authenticated)


def _get_api_key_user_id() -> str | None:
    """Return the first admin user's ID for API key auth."""
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id FROM users WHERE is_admin=TRUE ORDER BY created_at LIMIT 1")
        row = cur.fetchone()
        return row['id'] if row else None
    except Exception:
        return None
    finally:
        if conn: release_db(conn)


def is_authenticated() -> bool:
    """True if the current request has a valid session OR valid API key."""
    if API_KEY:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer ') and auth[7:] == API_KEY: return True
        if request.headers.get('X-API-Key', '') == API_KEY: return True
    return _valid_session(request.cookies.get('td_session', '')) is not _INVALID_SESSION


# Cached at first call — auth requirement only changes when users are added/removed,
# which requires a restart in this architecture anyway.
_needs_auth_cache: bool | None = None

def needs_auth() -> bool:
    """True if the app requires authentication. Cached after first call."""
    global _needs_auth_cache
    if _needs_auth_cache is not None:
        return _needs_auth_cache
    if TD_PASSWORD:
        _needs_auth_cache = True
        return True
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM users LIMIT 1")
        result = cur.fetchone() is not None
        _needs_auth_cache = result
        return result
    except Exception:
        # Fail closed: if we can't check, assume auth IS required
        logger.warning("needs_auth() DB check failed — defaulting to auth required")
        return True
    finally:
        if conn: release_db(conn)


def invalidate_needs_auth_cache():
    """Call after creating/deleting users to refresh the cache."""
    global _needs_auth_cache
    _needs_auth_cache = None

# ── Login page HTML (loaded from adjacent file) ────────────────
_LOGIN_HTML = (Path(__file__).parent / 'login.html').read_text()

# ── Routes ─────────────────────────────────────────────────────
@bp.route('/login')
def login_page():
    if not needs_auth(): return redirect('/')
    if is_authenticated(): return redirect(request.args.get('next', '/'))
    return _LOGIN_HTML, 200, {'Content-Type': 'text/html'}

@bp.route('/auth/login', methods=['POST'])
def do_login():
    if not needs_auth(): return jsonify({'ok': True})
    ip = request.remote_addr or '0.0.0.0'
    if _check_rate_limit(ip): return jsonify({'error': 'Too many attempts — try again in 15 minutes'}), 429
    data = request.get_json() or {}
    provided_username = data.get('username', '').strip().lower()
    provided_password = data.get('password', '').strip()

    user_id = None
    # Check users table first
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id, password_hash FROM users WHERE LOWER(username)=%s", (provided_username,))
        row = cur.fetchone()
        if row and bcrypt.checkpw(provided_password.encode(), row['password_hash'].encode()):
            user_id = row['id']
    except Exception:
        logger.exception("Error checking users table during login")
    finally:
        if conn: release_db(conn)

    # Fallback to env var credentials (transition period)
    if user_id is None and TD_PASSWORD:
        uok = (not TD_USERNAME) or secrets.compare_digest(provided_username, TD_USERNAME)
        if uok and _check_env_password(provided_password):
            target_username = TD_USERNAME or 'admin'
            conn = None
            try:
                conn = get_db()
                cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                cur.execute("SELECT id FROM users WHERE LOWER(username)=%s", (target_username,))
                row = cur.fetchone()
                if row:
                    user_id = row['id']
                else:
                    # Migration hasn't run yet — create user on-the-fly
                    import uuid as _uuid
                    uid = str(_uuid.uuid4())
                    pw_hash = bcrypt.hashpw(provided_password.encode(), bcrypt.gensalt(12)).decode()
                    cur.execute(
                        "INSERT INTO users (id, username, password_hash, display_name, is_admin) VALUES (%s,%s,%s,%s,TRUE)",
                        (uid, target_username, pw_hash, target_username.capitalize()))
                    cur.execute("UPDATE tasks SET owner_id=%s WHERE owner_id IS NULL", (uid,))
                    cur.execute("UPDATE sessions SET user_id=%s WHERE user_id IS NULL", (uid,))
                    cur.execute("UPDATE projects SET owner_id=%s WHERE owner_id IS NULL AND id != 'inbox'", (uid,))
                    conn.commit()
                    user_id = uid
                    invalidate_needs_auth_cache()
                    logger.info("[auth] created user '%s' on first login", target_username)
            except Exception:
                logger.exception("Error in env-var login fallback")
                if conn:
                    try: conn.rollback()
                    except Exception: pass
            finally:
                if conn: release_db(conn)

    if user_id is None:
        _record_failure(ip)
        return jsonify({'error': 'Incorrect username or password'}), 401

    _clear_failures(ip); _purge_expired_sessions()
    sid, expires = _create_session(user_id, bool(data.get('remember')))
    resp = make_response(jsonify({'ok': True}))
    resp.set_cookie('td_session', sid, httponly=True, samesite='Lax',
                    expires=expires if data.get('remember') else None,
                    max_age=30 * 86400 if data.get('remember') else None)
    return resp

@bp.route('/auth/logout', methods=['POST'])
def do_logout():
    _delete_session(request.cookies.get('td_session', ''))
    resp = make_response(jsonify({'ok': True}))
    resp.delete_cookie('td_session', httponly=True, samesite='Lax')
    return resp

@bp.route('/auth/status')
def auth_status():
    uid = get_authenticated_user_id()
    current_user = None
    if uid:
        conn = None
        try:
            conn = get_db()
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT id, username, display_name, is_admin, (avatar IS NOT NULL) AS has_avatar FROM users WHERE id=%s", (uid,))
            row = cur.fetchone()
            if row:
                current_user = dict(row)
        except Exception:
            pass
        finally:
            if conn: release_db(conn)
    return jsonify({
        'password_set': needs_auth(),
        'authenticated': uid is not None,
        'current_user': current_user,
        'gcal_enabled': gcal_is_enabled(),
        'obsidian_vault': OBSIDIAN_VAULT or None,
        'obsidian_inbox': OBSIDIAN_INBOX or None,
    })
