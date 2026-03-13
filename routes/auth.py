"""Auth routes: login, logout, status, middleware."""

import hashlib, secrets, time as _time
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import psycopg2.extras
from flask import Blueprint, request, jsonify, redirect, make_response

from lib.db import get_db, release_db
from lib.gcal import is_enabled as gcal_is_enabled

import os

TD_USERNAME = os.environ.get('TD_USERNAME', '').strip().lower()
TD_PASSWORD = os.environ.get('TD_PASSWORD', '').strip()
API_KEY     = os.environ.get('TD_API_KEY', '').strip()
OBSIDIAN_VAULT = os.environ.get('OBSIDIAN_VAULT', '').strip()
OBSIDIAN_INBOX = os.environ.get('OBSIDIAN_INBOX', '').strip().strip('/')

bp = Blueprint('auth', __name__)

# ── Rate limiting ──────────────────────────────────────────────
_LOCKOUT_ATTEMPTS = 5
_LOCKOUT_SECONDS  = 900
_failed: dict = {}

def _check_rate_limit(ip):
    now = _time.time()
    attempts = [t for t in _failed.get(ip, []) if now - t < _LOCKOUT_SECONDS]
    _failed[ip] = attempts
    return len(attempts) >= _LOCKOUT_ATTEMPTS

def _record_failure(ip): _failed.setdefault(ip, []).append(_time.time())
def _clear_failures(ip): _failed.pop(ip, None)

# ── Session helpers ────────────────────────────────────────────
_PUBLIC_PATHS = {'/login', '/auth/login', '/auth/logout', '/auth/status',
                 '/manifest.json', '/sw.js', '/favicon.ico'}

def _hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()

def _create_session(remember):
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

def _valid_session(sid):
    if not sid: return False
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT expires FROM sessions WHERE id=%s", (sid,))
        row = cur.fetchone()
        if not row: return False
        exp = row['expires']
        exp = exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp
        return datetime.now(timezone.utc) < exp
    except:
        return False
    finally:
        if conn: release_db(conn)

def _delete_session(sid):
    conn = None
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE id=%s", (sid,))
        conn.commit()
    except:
        pass
    finally:
        if conn: release_db(conn)

def _purge_expired_sessions():
    conn = None
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE expires<NOW()")
        conn.commit()
    except:
        pass
    finally:
        if conn: release_db(conn)

def is_authenticated():
    if API_KEY:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer ') and auth[7:] == API_KEY: return True
        if request.headers.get('X-API-Key', '') == API_KEY: return True
    return _valid_session(request.cookies.get('td_session', ''))

# ── Login page HTML ────────────────────────────────────────────
LOGIN_HTML = """<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"><title>TD — Sign In</title><style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--bg:#000;--bg2:#1c1c1e;--accent:#0a84ff;--text:#fff;--text2:rgba(255,255,255,.7);--text3:rgba(255,255,255,.4);--red:#ff453a;--radius:12px;--font:-apple-system,'SF Pro Text','Inter',sans-serif}html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);-webkit-font-smoothing:antialiased}body{display:flex;align-items:center;justify-content:center;padding:24px}.card{width:100%;max-width:360px}.logo{text-align:center;margin-bottom:40px}.logo-mark{width:72px;height:72px;background:var(--accent);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:36px;box-shadow:0 8px 32px rgba(10,132,255,.35)}.logo h1{font-size:28px;font-weight:700}.logo p{font-size:14px;color:var(--text3);margin-top:4px}.fields{background:var(--bg2);border-radius:var(--radius);overflow:hidden;border:1px solid rgba(255,255,255,.07);margin-bottom:12px}.field+.field::before{content:'';display:block;height:1px;background:rgba(255,255,255,.07);margin:0 15px}.field label{display:block;font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;padding:10px 15px 0}.field input{display:block;width:100%;background:none;border:none;padding:4px 15px 11px;font-family:var(--font);font-size:16px;color:var(--text);outline:none}.row{display:flex;align-items:center;gap:8px;margin:14px 0}.row input[type=checkbox]{width:18px;height:18px;accent-color:var(--accent);cursor:pointer}.row label{font-size:14px;color:var(--text2);cursor:pointer}.btn{width:100%;padding:14px;background:var(--accent);border:none;border-radius:var(--radius);font-family:var(--font);font-size:17px;font-weight:600;color:#fff;cursor:pointer;transition:opacity .15s}.err{color:var(--red);font-size:14px;text-align:center;margin-top:12px;min-height:20px}</style></head><body><div class="card"><div class="logo"><div class="logo-mark">✓</div><h1>TD</h1><p>Sign in to continue</p></div><form id="form" onsubmit="login(event)" autocomplete="on"><div class="fields"><div class="field"><label for="un">Username</label><input type="text" id="un" name="username" autocomplete="username" autofocus placeholder="Enter username" spellcheck="false" autocapitalize="none"></div><div class="field"><label for="pw">Password</label><input type="password" id="pw" name="password" autocomplete="current-password" placeholder="Enter password"></div></div><div class="row"><input type="checkbox" id="rem"><label for="rem">Keep me signed in for 30 days</label></div><button class="btn" type="submit" id="btn">Sign In</button><div class="err" id="err"></div></form></div><script>async function login(e){e.preventDefault();const un=document.getElementById('un').value.trim(),pw=document.getElementById('pw').value,rem=document.getElementById('rem').checked,btn=document.getElementById('btn'),err=document.getElementById('err');err.textContent='';if(!un||!pw){err.textContent='Please fill in both fields.';return;}btn.disabled=true;btn.textContent='Signing in…';try{const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:un,password:pw,remember:rem})});if(r.ok){location.href=new URLSearchParams(location.search).get('next')||'/';}else{const d=await r.json();err.textContent=d.error||'Incorrect username or password';document.getElementById('pw').value='';document.getElementById('pw').focus();}}catch(e){err.textContent='Network error';}finally{btn.disabled=false;btn.textContent='Sign In';}}</script></body></html>"""

# ── Routes ─────────────────────────────────────────────────────
@bp.route('/login')
def login_page():
    if not TD_PASSWORD: return redirect('/')
    if is_authenticated(): return redirect(request.args.get('next', '/'))
    return LOGIN_HTML, 200, {'Content-Type': 'text/html'}

@bp.route('/auth/login', methods=['POST'])
def do_login():
    if not TD_PASSWORD: return jsonify({'ok': True})
    ip = request.remote_addr or '0.0.0.0'
    if _check_rate_limit(ip): return jsonify({'error': 'Too many attempts — try again in 15 minutes'}), 429
    data = request.get_json() or {}
    uok = (not TD_USERNAME) or secrets.compare_digest(data.get('username', '').strip().lower(), TD_USERNAME)
    pok = secrets.compare_digest(_hash_pw(data.get('password', '').strip()), _hash_pw(TD_PASSWORD))
    if not (uok and pok):
        _record_failure(ip); return jsonify({'error': 'Incorrect username or password'}), 401
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
    resp = make_response(redirect('/login'))
    resp.delete_cookie('td_session')
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
