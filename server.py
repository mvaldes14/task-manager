#!/usr/bin/env python3
"""
TaskFlow Server - Flask + SQLite backend
Run: python3 server.py
Access: http://localhost:5000 (or your local IP for phone access)
"""

import sqlite3
import json
import re
import os
import uuid
from datetime import datetime, date, timedelta
from flask import Flask, request, jsonify, send_from_directory, send_file, redirect
from functools import wraps

app = Flask(__name__, static_folder='client/public')

# DB_PATH: use environment variable if set, otherwise next to this file
DB_PATH = os.environ.get('DB_PATH', '/app/data/taskflow.db')
print(f"[startup] DB_PATH = {DB_PATH}", flush=True)

# ─────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    print(f"[init_db] creating tables in {DB_PATH}", flush=True)
    # Make sure the directory exists
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#6366f1',
                icon TEXT DEFAULT '📁',
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                project_id TEXT,
                status TEXT DEFAULT 'todo',
                priority TEXT DEFAULT 'medium',
                due_date TEXT,
                due_time TEXT,
                tags TEXT DEFAULT '[]',
                position INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                completed_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS subtasks (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL,
                title TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                position INTEGER DEFAULT 0,
                due_date TEXT,
                due_time TEXT,
                priority TEXT DEFAULT 'medium',
                labels TEXT DEFAULT '[]',
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            )
        """)
        # Migrate existing subtasks tables that predate NLP fields
        for col, default in [('due_date', 'NULL'), ('due_time', 'NULL'),
                              ('priority', "'medium'"), ('labels', "'[]'")]:
            try:
                cur.execute(f"ALTER TABLE subtasks ADD COLUMN {col} TEXT DEFAULT {default}")
            except Exception:
                pass  # column already exists

        cur.execute("""
            INSERT OR IGNORE INTO projects (id, name, color, icon)
            VALUES ('inbox', 'Inbox', '#6366f1', '📥')
        """)
        conn.commit()

        # Verify
        tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        print(f"[init_db] done. tables: {[t[0] for t in tables]}", flush=True)
    finally:
        conn.close()

# Run immediately on import — before any request is handled
init_db()

def tables_exist():
    """Quick check that all tables are present — used as a safety net in before_request."""
    try:
        conn = sqlite3.connect(DB_PATH)
        count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('projects','tasks','subtasks')"
        ).fetchone()[0]
        conn.close()
        return count == 3
    except Exception:
        return False

def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    for field in ('tags', 'labels'):
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except Exception:
                d[field] = []
    return d

# ─────────────────────────────────────────────
# NLP DATE PARSER
# ─────────────────────────────────────────────

DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
MONTHS = ['january','february','march','april','may','june',
          'july','august','september','october','november','december']

def parse_natural_language(text):
    """
    Extract task title, due_date, due_time, priority, project_name, labels from natural language.
    #word  → project name (find or create)
    @word  → label / tag
    Returns dict with parsed fields and cleaned title.
    """
    original = text
    text_lower = text.lower().strip()
    result = {
        'title': text,
        'due_date': None,
        'due_time': None,
        'priority': 'medium',
        'project_name': None,   # parsed from #word
        'labels': [],           # parsed from @word
        'nlp_summary': None
    }

    today = date.today()
    found_date = None
    found_time = None

    # ── #project — first match wins ──
    project_match = re.search(r'#(\w+)', text)
    if project_match:
        result['project_name'] = project_match.group(1)
        text = re.sub(r'#\w+', '', text).strip()

    # ── @labels — extract all before anything else touches the text ──
    labels = re.findall(r'@(\w+)', text)
    if labels:
        result['labels'] = labels
        text = re.sub(r'@\w+', '', text).strip()

    # ── Priority detection (after @ removal so @urgent doesn't collide) ──
    text_lower = text.lower().strip()
    if re.search(r'\b(urgent|asap|critical|!!)\b', text_lower):
        result['priority'] = 'high'
        text = re.sub(r'\b(urgent|asap|critical|!!)\b', '', text, flags=re.IGNORECASE).strip()
    elif re.search(r'\b(low priority|whenever|no rush|someday)\b', text_lower):
        result['priority'] = 'low'
        text = re.sub(r'\b(low priority|whenever|no rush|someday)\b', '', text, flags=re.IGNORECASE).strip()
    elif re.search(r'\b(important|high priority|!)\b', text_lower):
        result['priority'] = 'high'
        text = re.sub(r'\b(important|high priority|!)\b', '', text, flags=re.IGNORECASE).strip()

    # ── Time parsing ──
    time_patterns = [
        (r'\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)?\b', 'hm_ampm'),
        (r'\bat\s+(\d{1,2})\s*(am|pm)\b', 'h_ampm'),
        (r'\b(\d{1,2}):(\d{2})\s*(am|pm)\b', 'hm_ampm'),
        (r'\b(\d{1,2})\s*(am|pm)\b', 'h_ampm'),
    ]
    for pattern, kind in time_patterns:
        m = re.search(pattern, text_lower)
        if m:
            try:
                if kind == 'hm_ampm':
                    h, mi = int(m.group(1)), int(m.group(2))
                    meridiem = m.group(3) if m.lastindex >= 3 else None
                elif kind == 'h_ampm':
                    h, mi = int(m.group(1)), 0
                    meridiem = m.group(2)
                else:
                    h, mi = int(m.group(1)), int(m.group(2))
                    meridiem = None
                if meridiem == 'pm' and h < 12:
                    h += 12
                elif meridiem == 'am' and h == 12:
                    h = 0
                found_time = f"{h:02d}:{mi:02d}"
                text = text[:m.start()] + text[m.end():]
                text = re.sub(r'\bat\s*$', '', text).strip()
                break
            except:
                pass

    # ── Date parsing ──
    # Strip "by" prefix so "by friday" == "friday"
    text = re.sub(r'\bby\s+(?=(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|next|this|\d))', '', text, flags=re.IGNORECASE).strip()
    text_lower_clean = text.lower()

    # "next monday", "this friday", etc.
    m = re.search(r'\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', text_lower_clean)
    if m:
        modifier, day_name = m.group(1), m.group(2)
        target_dow = DAYS.index(day_name)
        current_dow = today.weekday()
        delta = (target_dow - current_dow) % 7
        if delta == 0:
            delta = 7
        if modifier == 'next':
            delta = delta if delta > 0 else delta + 7
        found_date = today + timedelta(days=delta)
        text = text[:m.start()] + text[m.end():]

    # "monday", "tuesday" alone
    if not found_date:
        m = re.search(r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', text_lower_clean)
        if m:
            day_name = m.group(1)
            target_dow = DAYS.index(day_name)
            current_dow = today.weekday()
            delta = (target_dow - current_dow) % 7
            if delta == 0:
                delta = 7
            found_date = today + timedelta(days=delta)
            text = text[:m.start()] + text[m.end():]

    # "tomorrow", "today", "tonight"
    if not found_date:
        if re.search(r'\btonight\b', text_lower_clean):
            found_date = today
            if not found_time:
                found_time = "20:00"
            text = re.sub(r'\btonight\b', '', text, flags=re.IGNORECASE)
        elif re.search(r'\btomorrow\b', text_lower_clean):
            found_date = today + timedelta(days=1)
            text = re.sub(r'\btomorrow\b', '', text, flags=re.IGNORECASE)
        elif re.search(r'\btoday\b', text_lower_clean):
            found_date = today
            text = re.sub(r'\btoday\b', '', text, flags=re.IGNORECASE)

    # "in X days/weeks"
    if not found_date:
        m = re.search(r'\bin\s+(\d+)\s+(day|days|week|weeks)\b', text_lower_clean)
        if m:
            n = int(m.group(1))
            unit = m.group(2)
            if 'week' in unit:
                found_date = today + timedelta(weeks=n)
            else:
                found_date = today + timedelta(days=n)
            text = text[:m.start()] + text[m.end():]

    # "next week", "next month"
    if not found_date:
        if re.search(r'\bnext\s+week\b', text_lower_clean):
            found_date = today + timedelta(weeks=1)
            text = re.sub(r'\bnext\s+week\b', '', text, flags=re.IGNORECASE)
        elif re.search(r'\bnext\s+month\b', text_lower_clean):
            month = today.month % 12 + 1
            year = today.year + (1 if today.month == 12 else 0)
            found_date = today.replace(year=year, month=month, day=1)
            text = re.sub(r'\bnext\s+month\b', '', text, flags=re.IGNORECASE)

    # "Jan 15", "March 3rd", "15th of April"
    if not found_date:
        m = re.search(r'\b(' + '|'.join(MONTHS) + r')\s+(\d{1,2})(?:st|nd|rd|th)?\b', text_lower_clean)
        if not m:
            m = re.search(r'\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(' + '|'.join(MONTHS) + r')\b', text_lower_clean)
            if m:
                day_n, month_name = int(m.group(1)), m.group(2)
            elif m:
                month_name, day_n = m.group(1), int(m.group(2))
        if m:
            try:
                groups = m.groups()
                if MONTHS.index(groups[0]) >= 0 if groups[0] in MONTHS else False:
                    month_name, day_n = groups[0], int(groups[1])
                else:
                    day_n, month_name = int(groups[0]), groups[1]
                month_n = MONTHS.index(month_name) + 1
                year = today.year
                candidate = date(year, month_n, day_n)
                if candidate < today:
                    candidate = date(year + 1, month_n, day_n)
                found_date = candidate
                text = text[:m.start()] + text[m.end():]
            except:
                pass

    # "MM/DD" or "MM/DD/YY"
    if not found_date:
        m = re.search(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b', text)
        if m:
            try:
                mo, dy = int(m.group(1)), int(m.group(2))
                yr = int(m.group(3)) if m.group(3) else today.year
                if yr < 100:
                    yr += 2000
                found_date = date(yr, mo, dy)
                text = text[:m.start()] + text[m.end():]
            except:
                pass

    # ── End of week / weekend ──
    if not found_date:
        if re.search(r'\b(end of week|eow|this weekend|weekend)\b', text_lower_clean):
            delta = (5 - today.weekday()) % 7
            if delta == 0:
                delta = 7
            found_date = today + timedelta(days=delta)
            text = re.sub(r'\b(end of week|eow|this weekend|weekend)\b', '', text, flags=re.IGNORECASE)

    # ── Finalize ──
    if found_date:
        result['due_date'] = found_date.isoformat()
    if found_time:
        result['due_time'] = found_time

    # Clean up title
    title = re.sub(r'\s+', ' ', text).strip()
    title = re.sub(r'^(,|\.|-)\s*', '', title)
    title = re.sub(r'\s*(,|\.)$', '', title)
    result['title'] = title if title else original

    # Build summary
    parts = []
    if result['project_name']:
        parts.append(f"#{result['project_name']}")
    if found_date:
        parts.append(f"due {found_date.strftime('%a %b %-d')}")
    if found_time:
        h, mi = map(int, found_time.split(':'))
        ampm = 'am' if h < 12 else 'pm'
        parts.append(f"at {h % 12 or 12}:{mi:02d}{ampm}")
    if result['priority'] != 'medium':
        parts.append(f"priority: {result['priority']}")
    if result['labels']:
        parts.append(' '.join(f"@{l}" for l in result['labels']))
    if parts:
        result['nlp_summary'] = ' · '.join(parts)

    return result

# ─────────────────────────────────────────────
# AUTH — Session + Password
# ─────────────────────────────────────────────

import hashlib
import secrets
from datetime import timezone

TD_USERNAME = os.environ.get('TD_USERNAME', '').strip()
TD_PASSWORD = os.environ.get('TD_PASSWORD', '').strip()
API_KEY     = os.environ.get('TD_API_KEY', '').strip()

# Warn loudly at startup if exposed without credentials
if not TD_PASSWORD:
    print("[auth] WARNING: TD_PASSWORD is not set — app is open to anyone!", flush=True)
elif not TD_USERNAME:
    print("[auth] WARNING: TD_USERNAME is not set — any username will be accepted!", flush=True)
else:
    print(f"[auth] Login required. Username: {TD_USERNAME}", flush=True)

# ── Brute-force protection ─────────────────────────────────────────────────────
# Tracks failed login attempts per IP. Lockout after 5 failures for 15 minutes.
import time as _time
_failed: dict = {}   # ip → [timestamp, ...]
_LOCKOUT_ATTEMPTS = 5
_LOCKOUT_SECONDS  = 15 * 60  # 15 minutes

def _check_rate_limit(ip: str) -> bool:
    """Returns True if the IP is currently locked out."""
    now = _time.time()
    attempts = [t for t in _failed.get(ip, []) if now - t < _LOCKOUT_SECONDS]
    _failed[ip] = attempts
    return len(attempts) >= _LOCKOUT_ATTEMPTS

def _record_failure(ip: str):
    now = _time.time()
    _failed.setdefault(ip, []).append(now)

def _clear_failures(ip: str):
    _failed.pop(ip, None)

# Routes that are always public (no session required)
_PUBLIC_PATHS = {'/login', '/auth/login', '/auth/logout', '/auth/status'}

def _sessions_table():
    """Ensure the sessions table exists."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id       TEXT PRIMARY KEY,
                created  TEXT DEFAULT (datetime('now')),
                expires  TEXT NOT NULL,
                remember INTEGER DEFAULT 0
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[sessions] table init error: {e}", flush=True)

_sessions_table()

def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _create_session(remember: bool) -> str:
    sid = secrets.token_urlsafe(32)
    days = 30 if remember else 0
    hours = 0 if remember else 8
    expires = datetime.now(timezone.utc) + timedelta(days=days, hours=hours)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO sessions (id, expires, remember) VALUES (?, ?, ?)",
        (sid, expires.strftime('%Y-%m-%d %H:%M:%S'), 1 if remember else 0)
    )
    conn.commit(); conn.close()
    return sid, expires

def _valid_session(sid: str) -> bool:
    if not sid:
        return False
    try:
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute(
            "SELECT expires FROM sessions WHERE id=?", (sid,)
        ).fetchone()
        conn.close()
        if not row:
            return False
        exp = datetime.fromisoformat(row[0]).replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) < exp
    except Exception:
        return False

def _delete_session(sid: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DELETE FROM sessions WHERE id=?", (sid,))
        conn.commit(); conn.close()
    except Exception:
        pass

def _purge_expired_sessions():
    """Clean up old sessions (called lazily on login)."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DELETE FROM sessions WHERE expires < datetime('now')")
        conn.commit(); conn.close()
    except Exception:
        pass

def _is_authenticated() -> bool:
    """Check API key first, then session cookie."""
    # API key always works if configured (for Claude Code / CLI)
    if API_KEY:
        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer ') and auth[7:] == API_KEY:
            return True
        if request.headers.get('X-API-Key', '') == API_KEY:
            return True
    # Session cookie
    sid = request.cookies.get('td_session', '')
    return _valid_session(sid)

# ── Login page (inline, no external file needed) ──────────────────────────────
LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>TD — Sign In</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#000;--bg2:#1c1c1e;--bg3:#2c2c2e;--accent:#0a84ff;--text:#fff;--text2:rgba(255,255,255,.7);--text3:rgba(255,255,255,.4);--red:#ff453a;--radius:12px;--font:-apple-system,'SF Pro Text','Inter',sans-serif}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);-webkit-font-smoothing:antialiased}
body{display:flex;align-items:center;justify-content:center;padding:24px;padding-top:max(24px,env(safe-area-inset-top))}
.card{width:100%;max-width:360px}
.logo{text-align:center;margin-bottom:40px}
.logo-mark{width:72px;height:72px;background:var(--accent);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:36px;box-shadow:0 8px 32px rgba(10,132,255,.35)}
.logo h1{font-size:28px;font-weight:700;letter-spacing:-.5px}
.logo p{font-size:14px;color:var(--text3);margin-top:4px}
.fields{background:var(--bg2);border-radius:var(--radius);overflow:hidden;border:1px solid rgba(255,255,255,.07);margin-bottom:12px}
.field{position:relative}
.field+.field::before{content:'';display:block;height:1px;background:rgba(255,255,255,.07);margin:0 15px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;padding:10px 15px 0}
.field input{display:block;width:100%;background:none;border:none;padding:4px 15px 11px;font-family:var(--font);font-size:16px;color:var(--text);outline:none}
.field input::placeholder{color:var(--text3)}
.row{display:flex;align-items:center;gap:8px;margin:14px 0}
.row input[type=checkbox]{width:18px;height:18px;accent-color:var(--accent);flex-shrink:0;cursor:pointer}
.row label{font-size:14px;color:var(--text2);cursor:pointer}
.btn{width:100%;padding:14px;background:var(--accent);border:none;border-radius:var(--radius);font-family:var(--font);font-size:17px;font-weight:600;color:#fff;cursor:pointer;margin-top:4px;transition:opacity .15s}
.btn:active{opacity:.8}
.btn:disabled{opacity:.5;cursor:not-allowed}
.err{color:var(--red);font-size:14px;text-align:center;margin-top:12px;min-height:20px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="logo-mark">✓</div>
    <h1>TD</h1>
    <p>Sign in to continue</p>
  </div>
  <form id="form" onsubmit="login(event)" autocomplete="on">
    <div class="fields">
      <div class="field">
        <label for="un">Username</label>
        <input type="text" id="un" name="username" autocomplete="username" autofocus
               placeholder="Enter username" spellcheck="false" autocapitalize="none">
      </div>
      <div class="field">
        <label for="pw">Password</label>
        <input type="password" id="pw" name="password" autocomplete="current-password"
               placeholder="Enter password">
      </div>
    </div>
    <div class="row">
      <input type="checkbox" id="rem" name="remember">
      <label for="rem">Keep me signed in for 30 days</label>
    </div>
    <button class="btn" type="submit" id="submitBtn">Sign In</button>
    <div class="err" id="err"></div>
  </form>
</div>
<script>
async function login(e) {
  e.preventDefault();
  const un  = document.getElementById('un').value.trim();
  const pw  = document.getElementById('pw').value;
  const rem = document.getElementById('rem').checked;
  const btn = document.getElementById('submitBtn');
  const err = document.getElementById('err');
  err.textContent = '';
  if (!un || !pw) { err.textContent = 'Please enter your username and password.'; return; }
  btn.disabled = true; btn.textContent = 'Signing in\u2026';
  try {
    const r = await fetch('/auth/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username: un, password: pw, remember: rem})
    });
    if (r.ok) {
      const next = new URLSearchParams(location.search).get('next') || '/';
      location.href = next;
    } else {
      const d = await r.json();
      err.textContent = d.error || 'Incorrect username or password';
      document.getElementById('pw').value = '';
      document.getElementById('pw').focus();
    }
  } catch(e) {
    err.textContent = 'Network error — please try again';
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}
</script>
</body>
</html>"""

from flask import make_response

@app.route('/login')
def login_page():
    if not TD_PASSWORD:
        return redirect('/')
    if _is_authenticated():
        return redirect(request.args.get('next', '/'))
    return LOGIN_HTML, 200, {'Content-Type': 'text/html'}

@app.route('/auth/login', methods=['POST'])
def do_login():
    if not TD_PASSWORD:
        return jsonify({'ok': True})
    ip = request.remote_addr or '0.0.0.0'
    if _check_rate_limit(ip):
        return jsonify({'error': 'Too many failed attempts — try again in 15 minutes'}), 429
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    pw       = data.get('password', '').strip()
    # Validate username if TD_USERNAME is configured
    username_ok = (not TD_USERNAME) or secrets.compare_digest(username.lower(), TD_USERNAME.lower())
    password_ok = secrets.compare_digest(_hash_pw(pw), _hash_pw(TD_PASSWORD))
    if not (username_ok and password_ok):
        _record_failure(ip)
        # Generic message — don't reveal which field was wrong
        return jsonify({'error': 'Incorrect username or password'}), 401
    _clear_failures(ip)
    _purge_expired_sessions()
    remember = bool(data.get('remember', False))
    sid, expires = _create_session(remember)
    resp = make_response(jsonify({'ok': True}))
    max_age = (30 * 86400) if remember else None
    resp.set_cookie(
        'td_session', sid,
        httponly=True, samesite='Lax',
        expires=expires if remember else None,
        max_age=max_age,
        secure=False  # set True if terminating TLS at Flask (usually False with reverse proxy)
    )
    return resp

@app.route('/auth/logout', methods=['POST'])
def do_logout():
    sid = request.cookies.get('td_session', '')
    _delete_session(sid)
    resp = make_response(redirect('/login'))
    resp.delete_cookie('td_session')
    return resp

@app.route('/auth/status')
def auth_status():
    """Let the frontend know if password auth is active (so it can show the logout button)."""
    return jsonify({
        'password_set':  bool(TD_PASSWORD),
        'authenticated': _is_authenticated(),
        'username':      TD_USERNAME or None,
    })

@app.before_request
def auth_middleware():
    path = request.path

    # Always allow public paths and OPTIONS preflight
    if path in _PUBLIC_PATHS or request.method == 'OPTIONS':
        return None

    # If no password is configured, everything is open
    if not TD_PASSWORD:
        # Still enforce API key if set
        if path.startswith('/api/'):
            if API_KEY:
                auth = request.headers.get('Authorization', '')
                xkey = request.headers.get('X-API-Key', '')
                ok = (auth.startswith('Bearer ') and auth[7:] == API_KEY) or xkey == API_KEY
                if not ok:
                    return jsonify({'error': 'Unauthorized — provide a valid API key'}), 401
        if path.startswith('/api/') and not tables_exist():
            init_db()
        return None

    # Password is configured — require auth on everything
    if not _is_authenticated():
        if path.startswith('/api/'):
            return jsonify({'error': 'Unauthorized'}), 401
        # Redirect browsers to login, preserving the requested URL
        from urllib.parse import quote
        return redirect(f'/login?next={quote(request.full_path.rstrip("?"))}')

    # Authenticated — still reinit DB if needed
    if path.startswith('/api/') and not tables_exist():
        init_db()



@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    return response


@app.route('/share-target')
def share_target():
    """
    iOS/Android Web Share Target landing page.
    The browser POSTs or GETs here; we redirect to / with params so the JS can handle them.
    """
    from urllib.parse import urlencode
    params = {}
    for key in ('title', 'text', 'url'):
        val = request.args.get(key, '').strip()
        if val:
            params[f'share_{key}'] = val
    qs = urlencode(params)
    return redirect(f'/?{qs}' if qs else '/')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# ─────────────────────────────────────────────
# API: NLP PARSE
# ─────────────────────────────────────────────

@app.route('/api/nlp/parse', methods=['POST', 'OPTIONS'])
def nlp_parse():
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    text = data.get('text', '')
    result = parse_natural_language(text)
    return jsonify(result)

# ─────────────────────────────────────────────
# API: PROJECTS
# ─────────────────────────────────────────────

@app.route('/api/projects', methods=['GET', 'OPTIONS'])
def get_projects():
    if request.method == 'OPTIONS':
        return '', 204
    with get_db() as conn:
        rows = conn.execute("""
            SELECT p.*, COUNT(t.id) as task_count,
                   SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as done_count
            FROM projects p
            LEFT JOIN tasks t ON t.project_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at
        """).fetchall()
    return jsonify([row_to_dict(r) for r in rows])

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    pid = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute(
            "INSERT INTO projects (id, name, color, icon) VALUES (?,?,?,?)",
            (pid, data['name'], data.get('color','#6366f1'), data.get('icon','📁'))
        )
        row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    return jsonify(row_to_dict(row)), 201

@app.route('/api/projects/<pid>', methods=['PUT', 'PATCH'])
def update_project(pid):
    data = request.get_json()
    with get_db() as conn:
        if 'name' in data:
            conn.execute("UPDATE projects SET name=?, updated_at=datetime('now') WHERE id=?", (data['name'], pid))
        if 'color' in data:
            conn.execute("UPDATE projects SET color=?, updated_at=datetime('now') WHERE id=?", (data['color'], pid))
        if 'icon' in data:
            conn.execute("UPDATE projects SET icon=?, updated_at=datetime('now') WHERE id=?", (data['icon'], pid))
        row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
    return jsonify(row_to_dict(row))

@app.route('/api/projects/<pid>', methods=['DELETE'])
def delete_project(pid):
    if pid == 'inbox':
        return jsonify({'error': 'Cannot delete inbox'}), 400
    with get_db() as conn:
        conn.execute("UPDATE tasks SET project_id='inbox' WHERE project_id=?", (pid,))
        conn.execute("DELETE FROM projects WHERE id=?", (pid,))
    return '', 204

# ─────────────────────────────────────────────
# API: TASKS
# ─────────────────────────────────────────────

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    project_id = request.args.get('project_id')
    status = request.args.get('status')
    search = request.args.get('search')

    query = "SELECT * FROM tasks WHERE 1=1"
    params = []

    if project_id:
        query += " AND project_id=?"
        params.append(project_id)
    if status:
        query += " AND status=?"
        params.append(status)
    if search:
        query += " AND (title LIKE ? OR description LIKE ?)"
        params += [f'%{search}%', f'%{search}%']

    query += " ORDER BY position, created_at"

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()
        tasks = [row_to_dict(r) for r in rows]
        for task in tasks:
            subs = conn.execute(
                "SELECT * FROM subtasks WHERE task_id=? ORDER BY position",
                (task['id'],)
            ).fetchall()
            task['subtasks'] = [row_to_dict(s) for s in subs]
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    tid = str(uuid.uuid4())
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Title required'}), 400

    # Auto-parse if nlp flag set
    nlp_data = {}
    if data.get('nlp', False):
        nlp_data = parse_natural_language(title)
        title = nlp_data.get('title', title)

    tags = data.get('tags', nlp_data.get('labels', []))
    due_date = data.get('due_date', nlp_data.get('due_date'))
    due_time = data.get('due_time', nlp_data.get('due_time'))
    priority = data.get('priority', nlp_data.get('priority', 'medium'))
    status = data.get('status', 'todo')

    # Resolve project: #word from NLP takes priority, then explicit project_id
    project_id = data.get('project_id', 'inbox')
    project_name = nlp_data.get('project_name')
    if project_name:
        with get_db() as conn:
            # Case-insensitive name match
            row = conn.execute(
                "SELECT id FROM projects WHERE LOWER(name)=LOWER(?)", (project_name,)
            ).fetchone()
            if row:
                project_id = row['id']
            else:
                # Auto-create the project
                new_pid = str(uuid.uuid4())
                PALETTE = ['#7c6af7','#f87171','#fbbf24','#4ade80','#60a5fa','#f472b6','#34d399','#fb923c']
                color = PALETTE[hash(project_name) % len(PALETTE)]
                conn.execute(
                    "INSERT INTO projects (id, name, color, icon) VALUES (?,?,?,?)",
                    (new_pid, project_name.capitalize(), color, '📁')
                )
                project_id = new_pid

    with get_db() as conn:
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position),0) FROM tasks WHERE project_id=? AND status=?",
            (project_id, status)
        ).fetchone()[0]
        conn.execute("""
            INSERT INTO tasks (id, title, description, project_id, status, priority,
                               due_date, due_time, tags, position)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (tid, title, data.get('description',''), project_id, status, priority,
              due_date, due_time, json.dumps(tags), max_pos + 1))
        row = conn.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        task = row_to_dict(row)
        task['subtasks'] = []
        if nlp_data.get('nlp_summary'):
            task['nlp_summary'] = nlp_data['nlp_summary']

    return jsonify(task), 201

@app.route('/api/tasks/<tid>', methods=['GET'])
def get_task(tid):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        if not row:
            return jsonify({'error': 'Not found'}), 404
        task = row_to_dict(row)
        subs = conn.execute("SELECT * FROM subtasks WHERE task_id=? ORDER BY position", (tid,)).fetchall()
        task['subtasks'] = [row_to_dict(s) for s in subs]
    return jsonify(task)

@app.route('/api/tasks/<tid>', methods=['PUT', 'PATCH'])
def update_task(tid):
    data = request.get_json()
    with get_db() as conn:
        task = conn.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        if not task:
            return jsonify({'error': 'Not found'}), 404
        task = dict(task)

        fields = ['title','description','project_id','status','priority',
                  'due_date','due_time','position']
        for field in fields:
            if field in data:
                task[field] = data[field]

        if 'tags' in data:
            task['tags'] = json.dumps(data['tags'])

        if data.get('status') == 'done' and task.get('status') != 'done':
            task['completed_at'] = datetime.now().isoformat()
        elif data.get('status') and data['status'] != 'done':
            task['completed_at'] = None

        conn.execute("""
            UPDATE tasks SET title=?, description=?, project_id=?, status=?, priority=?,
                due_date=?, due_time=?, tags=?, position=?, completed_at=?,
                updated_at=datetime('now')
            WHERE id=?
        """, (task['title'], task['description'], task['project_id'], task['status'],
              task['priority'], task['due_date'], task['due_time'],
              task['tags'] if isinstance(task['tags'], str) else json.dumps(task['tags']),
              task['position'], task.get('completed_at'), tid))

        row = conn.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        result = row_to_dict(row)
        subs = conn.execute("SELECT * FROM subtasks WHERE task_id=? ORDER BY position", (tid,)).fetchall()
        result['subtasks'] = [row_to_dict(s) for s in subs]
    return jsonify(result)

@app.route('/api/tasks/<tid>', methods=['DELETE'])
def delete_task(tid):
    with get_db() as conn:
        conn.execute("DELETE FROM subtasks WHERE task_id=?", (tid,))
        conn.execute("DELETE FROM tasks WHERE id=?", (tid,))
    return '', 204

@app.route('/api/tasks/<tid>/subtasks', methods=['POST'])
def add_subtask(tid):
    data = request.get_json()
    sid = str(uuid.uuid4())
    raw_title = data.get('title', '').strip()

    # Run NLP on subtask title just like tasks
    nlp = parse_natural_language(raw_title)
    title     = nlp.get('title', raw_title) or raw_title
    due_date  = nlp.get('due_date')
    due_time  = nlp.get('due_time')
    priority  = nlp.get('priority', 'medium')
    labels    = nlp.get('labels', [])

    with get_db() as conn:
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position),0) FROM subtasks WHERE task_id=?", (tid,)
        ).fetchone()[0]
        conn.execute(
            """INSERT INTO subtasks (id, task_id, title, position, due_date, due_time, priority, labels)
               VALUES (?,?,?,?,?,?,?,?)""",
            (sid, tid, title, max_pos + 1, due_date, due_time, priority, json.dumps(labels))
        )
        row = conn.execute("SELECT * FROM subtasks WHERE id=?", (sid,)).fetchone()
    result = row_to_dict(row)
    if nlp.get('nlp_summary'):
        result['nlp_summary'] = nlp['nlp_summary']
    return jsonify(result), 201

@app.route('/api/tasks/<tid>/subtasks/<sid>', methods=['PATCH'])
def update_subtask(tid, sid):
    data = request.get_json()
    with get_db() as conn:
        if 'completed' in data:
            conn.execute("UPDATE subtasks SET completed=? WHERE id=?",
                         (1 if data['completed'] else 0, sid))
        if 'title' in data:
            conn.execute("UPDATE subtasks SET title=? WHERE id=?", (data['title'], sid))
        if 'due_date' in data:
            conn.execute("UPDATE subtasks SET due_date=? WHERE id=?", (data['due_date'], sid))
        if 'due_time' in data:
            conn.execute("UPDATE subtasks SET due_time=? WHERE id=?", (data['due_time'], sid))
        if 'priority' in data:
            conn.execute("UPDATE subtasks SET priority=? WHERE id=?", (data['priority'], sid))
        if 'labels' in data:
            conn.execute("UPDATE subtasks SET labels=? WHERE id=?",
                         (json.dumps(data['labels']), sid))
        row = conn.execute("SELECT * FROM subtasks WHERE id=?", (sid,)).fetchone()
    return jsonify(row_to_dict(row))

@app.route('/api/tasks/<tid>/subtasks/<sid>', methods=['DELETE'])
def delete_subtask(tid, sid):
    with get_db() as conn:
        conn.execute("DELETE FROM subtasks WHERE id=?", (sid,))
    return '', 204

# ─────────────────────────────────────────────
# API: BULK REORDER
# ─────────────────────────────────────────────

@app.route('/api/tasks/reorder', methods=['POST'])
def reorder_tasks():
    data = request.get_json()  # [{id, position, status}]
    with get_db() as conn:
        for item in data:
            conn.execute(
                "UPDATE tasks SET position=?, status=?, updated_at=datetime('now') WHERE id=?",
                (item['position'], item['status'], item['id'])
            )
    return jsonify({'ok': True})

# ─────────────────────────────────────────────
# API: EXPORT (LLM-friendly JSON)
# ─────────────────────────────────────────────

@app.route('/api/export', methods=['GET'])
def export_data():
    with get_db() as conn:
        projects = [row_to_dict(r) for r in conn.execute("SELECT * FROM projects ORDER BY created_at").fetchall()]
        tasks = [row_to_dict(r) for r in conn.execute("SELECT * FROM tasks ORDER BY project_id, position").fetchall()]
        subtasks = [row_to_dict(r) for r in conn.execute("SELECT * FROM subtasks ORDER BY task_id, position").fetchall()]

    # Build human-readable structure
    task_map = {t['id']: t for t in tasks}
    for sub in subtasks:
        task_map[sub['task_id']].setdefault('subtasks', []).append(sub)

    proj_map = {p['id']: {**p, 'tasks': []} for p in projects}
    for task in tasks:
        pid = task.get('project_id', 'inbox')
        if pid in proj_map:
            proj_map[pid]['tasks'].append(task)

    export = {
        'exported_at': datetime.now().isoformat(),
        'version': '1.0',
        'projects': list(proj_map.values()),
        'stats': {
            'total_tasks': len(tasks),
            'done': sum(1 for t in tasks if t['status'] == 'done'),
            'todo': sum(1 for t in tasks if t['status'] == 'todo'),
            'in_progress': sum(1 for t in tasks if t['status'] == 'doing'),
        }
    }
    return jsonify(export)

# ─────────────────────────────────────────────
# API: TODAY / UPCOMING
# ─────────────────────────────────────────────

@app.route('/api/tasks/today', methods=['GET'])
def get_today():
    today = date.today().isoformat()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM tasks WHERE due_date=? AND status!='done' ORDER BY due_time, position",
            (today,)
        ).fetchall()
        tasks = [row_to_dict(r) for r in rows]
        for t in tasks:
            subs = conn.execute("SELECT * FROM subtasks WHERE task_id=? ORDER BY position", (t['id'],)).fetchall()
            t['subtasks'] = [row_to_dict(s) for s in subs]
    return jsonify(tasks)

@app.route('/api/tasks/upcoming', methods=['GET'])
def get_upcoming():
    today = date.today().isoformat()
    week = (date.today() + timedelta(days=7)).isoformat()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM tasks WHERE due_date >= ? AND due_date <= ? AND status!='done' ORDER BY due_date, due_time",
            (today, week)
        ).fetchall()
        tasks = [row_to_dict(r) for r in rows]
        for t in tasks:
            subs = conn.execute("SELECT * FROM subtasks WHERE task_id=? ORDER BY position", (t['id'],)).fetchall()
            t['subtasks'] = [row_to_dict(s) for s in subs]
    return jsonify(tasks)

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

# Always initialise DB on startup — works for both gunicorn (--preload) and direct python
init_db()

@app.before_request
def ensure_db():
    """Fallback: re-run init if tables vanished (e.g. volume race on first boot)."""
    if not tables_exist():
        init_db()

if __name__ == '__main__':
    import socket
    hostname = socket.gethostname()
    try:
        local_ip = socket.gethostbyname(hostname)
    except:
        local_ip = '127.0.0.1'

    print("\n" + "="*50)
    print("  TaskFlow is running!")
    print("="*50)
    print(f"  Local:   http://localhost:5000")
    print(f"  Network: http://{local_ip}:5000")
    print("  (use Network URL on your phone)")
    print("="*50 + "\n")

    app.run(host='0.0.0.0', port=5000, debug=False)
