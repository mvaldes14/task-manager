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

# Hash TD_PASSWORD once at startup using bcrypt (cost factor 12)
_hashed_pw: bytes | None = bcrypt.hashpw(TD_PASSWORD.encode(), bcrypt.gensalt(12)) if TD_PASSWORD else None

def _check_password(provided: str) -> bool:
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
                 '/manifest.json', '/sw.js', '/favicon.ico'}

def _create_session(remember: bool):
    sid = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + (timedelta(days=30) if remember else timedelta(hours=8))
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO sessions (id,expires,remember) VALUES (%s,%s,%s)", (sid, expires, remember))
        conn.commit()
    finally:
        release_db(conn)
    return sid, expires

_session_cache: dict = {}

def _valid_session(sid: str) -> bool:
    if not sid: return False
    now = datetime.now(timezone.utc)
    if sid in _session_cache:
        if now < _session_cache[sid]: return True
        else: del _session_cache[sid]
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT expires FROM sessions WHERE id=%s", (sid,))
        row = cur.fetchone()
        if not row: return False
        exp = row['expires']
        exp = exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp
        if now < exp:
            _session_cache[sid] = exp
            return True
        return False
    except Exception:
        logger.exception("Error validating session %s", sid[:8])
        return False
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
    # Evict expired entries from the in-memory cache
    expired = [sid for sid, exp in list(_session_cache.items()) if now >= exp]
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

def is_authenticated() -> bool:
    if API_KEY:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer ') and auth[7:] == API_KEY: return True
        if request.headers.get('X-API-Key', '') == API_KEY: return True
    return _valid_session(request.cookies.get('td_session', ''))

# ── Login page HTML (loaded from adjacent file) ────────────────
_LOGIN_HTML = (Path(__file__).parent / 'login.html').read_text()

# ── Routes ─────────────────────────────────────────────────────
@bp.route('/login')
def login_page():
    if not TD_PASSWORD: return redirect('/')
    if is_authenticated(): return redirect(request.args.get('next', '/'))
    return _LOGIN_HTML, 200, {'Content-Type': 'text/html'}

@bp.route('/auth/login', methods=['POST'])
def do_login():
    if not TD_PASSWORD: return jsonify({'ok': True})
    ip = request.remote_addr or '0.0.0.0'
    if _check_rate_limit(ip): return jsonify({'error': 'Too many attempts — try again in 15 minutes'}), 429
    data = request.get_json() or {}
    uok = (not TD_USERNAME) or secrets.compare_digest(data.get('username', '').strip().lower(), TD_USERNAME)
    pok = _check_password(data.get('password', '').strip())
    if not (uok and pok):
        _record_failure(ip)
        return jsonify({'error': 'Incorrect username or password'}), 401
    _clear_failures(ip); _purge_expired_sessions()
    sid, expires = _create_session(bool(data.get('remember')))
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
    return jsonify({
        'password_set': bool(TD_PASSWORD),
        'authenticated': is_authenticated(),
        'username': TD_USERNAME or None,
        'gcal_enabled': gcal_is_enabled(),
        'obsidian_vault': OBSIDIAN_VAULT or None,
        'obsidian_inbox': OBSIDIAN_INBOX or None,
    })
