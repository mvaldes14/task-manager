"""Auth routes: login, logout, status, middleware."""

import os, secrets, threading, time as _time, logging, uuid as _uuid
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
API_KEY        = os.environ.get('TD_API_KEY',  '').strip()
OBSIDIAN_VAULT = os.environ.get('OBSIDIAN_VAULT', '').strip()
OBSIDIAN_INBOX = os.environ.get('OBSIDIAN_INBOX', '').strip().strip('/')

_hashed_pw: bytes | None = (
    bcrypt.hashpw(TD_PASSWORD.encode(), bcrypt.gensalt(12)) if TD_PASSWORD else None
)

def _check_env_password(provided: str) -> bool:
    if not _hashed_pw or not provided:
        return False
    return bcrypt.checkpw(provided.encode(), _hashed_pw)

bp = Blueprint('auth', __name__)

# ── Rate limiting ─────────────────────────────────────────────────────────────
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
    with _failed_lock: _failed.setdefault(ip, []).append(_time.time())

def _clear_failures(ip: str):
    with _failed_lock: _failed.pop(ip, None)

# ── Public paths ──────────────────────────────────────────────────────────────
_PUBLIC_PATHS = {
    '/login', '/auth/login', '/auth/logout', '/auth/status',
    '/manifest.json', '/manifest.webmanifest', '/sw.js', '/favicon.ico',
    '/favicon-16.png', '/favicon-32.png', '/apple-touch-icon.png',
    '/icon-192.png', '/icon-512.png',
}

# ── Session cache: sid -> (expires: datetime, user_id: str | None) ────────────
_session_cache: dict = {}

def _check_session(sid: str) -> tuple[bool, str | None]:
    """Single source of truth for session validation.
    Returns (is_valid, user_id). Never raises.
    """
    if not sid:
        return False, None
    now = datetime.now(timezone.utc)
    if sid in _session_cache:
        exp, uid = _session_cache[sid]
        if now < exp:
            return True, uid
        del _session_cache[sid]
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT expires, user_id FROM sessions WHERE id=%s", (sid,))
        row = cur.fetchone()
        if not row:
            return False, None
        exp = row['expires']
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if now < exp:
            uid = row['user_id']
            _session_cache[sid] = (exp, uid)
            return True, uid
        return False, None
    except Exception:
        logger.exception("Session check error for %s", sid[:8])
        return False, None
    finally:
        if conn: release_db(conn)


def _create_session(user_id: str | None, remember: bool) -> tuple[str, datetime]:
    sid     = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + (timedelta(days=30) if remember else timedelta(hours=8))
    conn    = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO sessions (id, expires, remember, user_id) VALUES (%s,%s,%s,%s)",
            (sid, expires, remember, user_id))
        conn.commit()
    finally:
        release_db(conn)
    return sid, expires


def _delete_session(sid: str):
    _session_cache.pop(sid, None)
    conn = None
    try:
        conn = get_db()
        conn.cursor().execute("DELETE FROM sessions WHERE id=%s", (sid,))
        conn.commit()
    except Exception:
        logger.exception("Error deleting session")
    finally:
        if conn: release_db(conn)


def _purge_expired_sessions():
    now = datetime.now(timezone.utc)
    for sid in [s for s, (e, _) in list(_session_cache.items()) if now >= e]:
        _session_cache.pop(sid, None)
    conn = None
    try:
        conn = get_db()
        conn.cursor().execute("DELETE FROM sessions WHERE expires < NOW()")
        conn.commit()
    except Exception:
        logger.exception("Error purging sessions")
    finally:
        if conn: release_db(conn)


# ── Auth requirement ──────────────────────────────────────────────────────────
# Computed ONCE at startup via init_auth(). Never re-evaluated per-request.
_AUTH_REQUIRED: bool = False


def init_auth():
    """Call once at startup — after init_db() — to lock in whether auth is needed."""
    global _AUTH_REQUIRED
    if TD_PASSWORD:
        _AUTH_REQUIRED = True
        logger.info("[auth] auth required (TD_PASSWORD set)")
        return
    conn = None
    try:
        conn = get_db()
        cur  = conn.cursor()
        # Auth required if users exist
        cur.execute("SELECT 1 FROM users LIMIT 1")
        if cur.fetchone() is not None:
            _AUTH_REQUIRED = True
            logger.info("[auth] auth required (users exist)")
            return
        # Also require auth if there are existing sessions or tasks — means
        # the app has been used before and we should fail closed
        cur.execute("SELECT 1 FROM sessions LIMIT 1")
        if cur.fetchone() is not None:
            _AUTH_REQUIRED = True
            logger.info("[auth] auth required (sessions exist, fail closed)")
            return
        cur.execute("SELECT 1 FROM tasks LIMIT 1")
        if cur.fetchone() is not None:
            _AUTH_REQUIRED = True
            logger.info("[auth] auth required (tasks exist, fail closed)")
            return
        _AUTH_REQUIRED = False
        logger.info("[auth] auth not required (fresh install, no users/data)")
    except Exception:
        _AUTH_REQUIRED = True   # fail closed: unknown state → require auth
        logger.warning("[auth] could not read tables — defaulting to auth required")
    finally:
        if conn: release_db(conn)


def enable_auth():
    """Call after the first user is created to activate auth without restart."""
    global _AUTH_REQUIRED
    _AUTH_REQUIRED = True


def is_auth_required() -> bool:
    """Read the current auth-required flag. Use this instead of importing _AUTH_REQUIRED directly."""
    return _AUTH_REQUIRED


# ── Per-request helpers (used by main.py) ─────────────────────────────────────

def is_authenticated() -> bool:
    if _check_api_key(): return True
    valid, _ = _check_session(request.cookies.get('td_session', ''))
    return valid


def get_current_user_id() -> str | None:
    if _check_api_key():
        return _api_key_user_id()
    _, uid = _check_session(request.cookies.get('td_session', ''))
    return uid


def _check_api_key() -> bool:
    if not API_KEY: return False
    ah = request.headers.get('Authorization', '')
    if ah.startswith('Bearer ') and ah[7:] == API_KEY: return True
    return request.headers.get('X-API-Key', '') == API_KEY


def _api_key_user_id() -> str | None:
    conn = None
    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id FROM users WHERE is_admin=TRUE ORDER BY created_at LIMIT 1")
        row = cur.fetchone()
        return row['id'] if row else None
    except Exception:
        return None
    finally:
        if conn: release_db(conn)


# ── Login helpers ─────────────────────────────────────────────────────────────

def _lookup_user(username: str, password: str) -> str | None:
    """Verify credentials. Returns user_id on success, None on failure. Never raises."""
    conn = None
    try:
        conn = get_db()
        cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Check users table
        cur.execute("SELECT id, password_hash FROM users WHERE LOWER(username)=%s", (username,))
        row = cur.fetchone()
        if row and bcrypt.checkpw(password.encode(), row['password_hash'].encode()):
            return row['id']

        # 2. Env-var fallback (transition / first-run)
        if not TD_PASSWORD:
            return None
        uok = (not TD_USERNAME) or secrets.compare_digest(username, TD_USERNAME)
        if not (uok and _check_env_password(password)):
            return None

        # Env var matched — find or create the corresponding DB user
        target = TD_USERNAME or 'admin'
        cur.execute("SELECT id FROM users WHERE LOWER(username)=%s", (target,))
        row = cur.fetchone()
        if row:
            return row['id']

        # First ever login: create admin user + migrate existing data
        uid     = str(_uuid.uuid4())
        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()
        cur.execute(
            "INSERT INTO users (id, username, password_hash, display_name, is_admin) "
            "VALUES (%s,%s,%s,%s,TRUE)",
            (uid, target, pw_hash, target.capitalize()))
        cur.execute("UPDATE tasks    SET owner_id=%s WHERE owner_id IS NULL",  (uid,))
        cur.execute("UPDATE sessions SET user_id=%s  WHERE user_id IS NULL",   (uid,))
        cur.execute(
            "UPDATE projects SET owner_id=%s WHERE owner_id IS NULL AND id != 'inbox'", (uid,))
        conn.commit()
        enable_auth()
        logger.info("[auth] created admin user '%s' on first login", target)
        return uid

    except Exception:
        logger.exception("Error in _lookup_user")
        try:
            if conn: conn.rollback()
        except Exception:
            pass
        return None
    finally:
        if conn: release_db(conn)


# ── Routes ────────────────────────────────────────────────────────────────────

_LOGIN_HTML = (Path(__file__).parent / 'login.html').read_text()


@bp.route('/login')
def login_page():
    if not _AUTH_REQUIRED:
        return redirect('/')
    if is_authenticated():
        return redirect(request.args.get('next', '/'))
    return _LOGIN_HTML, 200, {'Content-Type': 'text/html'}


@bp.route('/auth/login', methods=['POST'])
def do_login():
    if not _AUTH_REQUIRED:
        return jsonify({'ok': True})
    ip = request.remote_addr or '0.0.0.0'
    if _check_rate_limit(ip):
        return jsonify({'error': 'Too many attempts — try again in 15 minutes'}), 429
    data     = request.get_json() or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '').strip()
    user_id  = _lookup_user(username, password)
    if user_id is None:
        _record_failure(ip)
        return jsonify({'error': 'Incorrect username or password'}), 401
    _clear_failures(ip)
    _purge_expired_sessions()
    sid, expires = _create_session(user_id, bool(data.get('remember')))
    resp = make_response(jsonify({'ok': True}))
    resp.set_cookie(
        'td_session', sid, httponly=True, samesite='Lax',
        expires=expires  if data.get('remember') else None,
        max_age=30*86400 if data.get('remember') else None)
    return resp


@bp.route('/auth/logout', methods=['POST'])
def do_logout():
    _delete_session(request.cookies.get('td_session', ''))
    resp = make_response(jsonify({'ok': True}))
    resp.delete_cookie('td_session', httponly=True, samesite='Lax')
    return resp


@bp.route('/auth/status')
def auth_status():
    valid, uid = _check_session(request.cookies.get('td_session', ''))
    if not valid and _check_api_key():
        valid, uid = True, _api_key_user_id()
    current_user = None
    if valid and uid:
        conn = None
        try:
            conn = get_db()
            cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute(
                "SELECT id, username, display_name, is_admin, "
                "(avatar IS NOT NULL) AS has_avatar FROM users WHERE id=%s", (uid,))
            row = cur.fetchone()
            if row: current_user = dict(row)
        except Exception:
            pass
        finally:
            if conn: release_db(conn)
    return jsonify({
        'password_set':  _AUTH_REQUIRED,
        'authenticated': valid,
        'current_user':  current_user,
        'gcal_enabled':  gcal_is_enabled(),
        'obsidian_vault': OBSIDIAN_VAULT or None,
        'obsidian_inbox': OBSIDIAN_INBOX or None,
    })
