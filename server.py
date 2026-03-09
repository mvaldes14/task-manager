#!/usr/bin/env python3
"""TD Server - Flask + PostgreSQL backend"""

import json, re, os, uuid, hashlib, secrets, time as _time
from datetime import datetime, date, timedelta, timezone
import psycopg2, psycopg2.extras
from flask import Flask, request, jsonify, send_from_directory, redirect, make_response

app = Flask(__name__, static_folder='client/public')

# ─────────────────────────────────────────────
# DATABASE — PostgreSQL
# ─────────────────────────────────────────────

DATABASE_URL    = os.environ.get('DATABASE_URL', 'postgresql://td:td@localhost:5432/td')
OBSIDIAN_VAULT  = os.environ.get('OBSIDIAN_VAULT', '').strip()
print(f"[startup] DATABASE_URL = {DATABASE_URL}", flush=True)
if OBSIDIAN_VAULT: print(f"[startup] Obsidian vault: {OBSIDIAN_VAULT}", flush=True)

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn

def init_db():
    print("[init_db] creating tables...", flush=True)
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY, name TEXT NOT NULL,
                color TEXT DEFAULT '#6366f1', icon TEXT DEFAULT '📁',
                created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
            )""")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
                project_id TEXT REFERENCES projects(id), status TEXT DEFAULT 'todo',
                priority TEXT DEFAULT 'medium', due_date DATE, due_time TIME,
                tags JSONB DEFAULT '[]', position INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
                completed_at TIMESTAMPTZ, gcal_event_id TEXT,
                recurrence TEXT,
                recurrence_end DATE,
                parent_task_id TEXT
            )""")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS subtasks (
                id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                title TEXT NOT NULL, completed BOOLEAN DEFAULT FALSE, position INTEGER DEFAULT 0,
                due_date DATE, due_time TIME, priority TEXT DEFAULT 'medium', labels JSONB DEFAULT '[]'
            )""")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY, created TIMESTAMPTZ DEFAULT NOW(),
                expires TIMESTAMPTZ NOT NULL, remember BOOLEAN DEFAULT FALSE
            )""")
        # Migrate existing tasks table to add recurrence columns
        for col, defn in [('recurrence','TEXT'), ('recurrence_end','DATE'), ('parent_task_id','TEXT')]:
            try: cur.execute(f"ALTER TABLE tasks ADD COLUMN {col} {defn}")
            except Exception: conn.rollback(); conn.autocommit = False
        cur.execute("INSERT INTO projects (id,name,color,icon) VALUES ('inbox','Inbox','#6366f1','📥') ON CONFLICT (id) DO NOTHING")
        conn.commit()
        print("[init_db] done.", flush=True)
    except Exception as e:
        conn.rollback(); print(f"[init_db] error: {e}", flush=True); raise
    finally:
        conn.close()

init_db()

def tables_exist():
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('projects','tasks','subtasks')")
        count = cur.fetchone()[0]; conn.close(); return count == 3
    except: return False

def row_to_dict(row):
    if row is None: return None
    d = dict(row)
    for field in ('created_at','updated_at','completed_at'):
        if field in d and d[field] is not None: d[field] = str(d[field])
    if 'due_date' in d and d['due_date'] is not None: d['due_date'] = str(d['due_date'])[:10]
    if 'due_time' in d and d['due_time'] is not None: d['due_time'] = str(d['due_time'])[:5]
    for field in ('tags','labels'):
        if field in d:
            if isinstance(d[field], str):
                try: d[field] = json.loads(d[field])
                except: d[field] = []
            elif d[field] is None: d[field] = []
    if 'completed' in d: d['completed'] = bool(d['completed'])
    return d

# ─────────────────────────────────────────────
# NLP
# ─────────────────────────────────────────────

DAYS   = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']


# ─────────────────────────────────────────────
# RECURRENCE ENGINE
# ─────────────────────────────────────────────

def parse_recurrence(text):
    """
    Extract a recurrence rule from natural language.
    Returns (rule_string, cleaned_text) where rule_string is None if no recurrence found.

    Rule format (stored as JSON string):
      {"type": "daily"}
      {"type": "weekly", "days": [0,2,4]}          # 0=Mon..6=Sun
      {"type": "monthly_dom", "dom": 15}            # 15th of each month
      {"type": "monthly_dow", "week": 2, "dow": 2}  # 3rd Wednesday (week=2, dow=2)
      {"type": "interval", "days": 14}              # every 14 days
      {"type": "yearly", "month": 3, "dom": 1}      # March 1st each year
    """
    tl = text.lower()
    rule = None

    # ── daily ──
    if re.search(r'\bevery\s+day\b|\bdaily\b', tl):
        rule = {"type": "daily"}
        text = re.sub(r'\bevery\s+day\b|\bdaily\b', '', text, flags=re.IGNORECASE)

    # ── every weekday / every weekend ──
    elif re.search(r'\bevery\s+weekday\b', tl):
        rule = {"type": "weekly", "days": [0,1,2,3,4]}
        text = re.sub(r'\bevery\s+weekday\b', '', text, flags=re.IGNORECASE)
    elif re.search(r'\bevery\s+weekend\b', tl):
        rule = {"type": "weekly", "days": [5,6]}
        text = re.sub(r'\bevery\s+weekend\b', '', text, flags=re.IGNORECASE)

    # ── every monday/tuesday/... (one or more days) ──
    elif re.search(r'\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)', tl):
        day_names = re.findall(r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', tl)
        days = sorted(set(DAYS.index(d) for d in day_names))
        rule = {"type": "weekly", "days": days}
        text = re.sub(r'\bevery\s+((monday|tuesday|wednesday|thursday|friday|saturday|sunday)(\s*,?\s*and?\s*|\s*,\s*)?)+', '', text, flags=re.IGNORECASE)

    # ── every N days/weeks ──
    elif m := re.search(r'\bevery\s+(\d+)\s+(day|days|week|weeks)\b', tl):
        n = int(m.group(1))
        unit = m.group(2)
        days = n * 7 if 'week' in unit else n
        rule = {"type": "interval", "days": days}
        text = text[:m.start()] + text[m.end():]

    # ── every other week ──
    elif re.search(r'\bevery\s+other\s+week\b', tl):
        rule = {"type": "interval", "days": 14}
        text = re.sub(r'\bevery\s+other\s+week\b', '', text, flags=re.IGNORECASE)

    # ── monthly / every month ──
    elif re.search(r'\bevery\s+month\b|\bmonthly\b', tl):
        # Try to detect day-of-month from surrounding text: "1st", "15th" etc.
        dom_m = re.search(r'\b(\d{1,2})(?:st|nd|rd|th)?\b', tl)
        dom = int(dom_m.group(1)) if dom_m else None
        if dom and 1 <= dom <= 31:
            rule = {"type": "monthly_dom", "dom": dom}
        else:
            rule = {"type": "monthly_dom", "dom": None}  # use original due_date day
        text = re.sub(r'\bevery\s+month\b|\bmonthly\b', '', text, flags=re.IGNORECASE)

    # ── Nth weekday of month: "every 3rd wednesday", "first monday of the month" ──
    elif m := re.search(r'\b(first|second|third|fourth|last|1st|2nd|3rd|4th)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+of\s+(?:the\s+)?month)?\b', tl):
        ord_map = {'first':0,'1st':0,'second':1,'2nd':1,'third':2,'3rd':2,'fourth':3,'4th':3,'last':-1}
        week = ord_map.get(m.group(1), 0)
        dow  = DAYS.index(m.group(2))
        rule = {"type": "monthly_dow", "week": week, "dow": dow}
        text = text[:m.start()] + text[m.end():]

    # ── yearly / every year / annually ──
    elif re.search(r'\byearly\b|\bannually\b|\bevery\s+year\b', tl):
        rule = {"type": "yearly"}
        text = re.sub(r'\byearly\b|\bannually\b|\bevery\s+year\b', '', text, flags=re.IGNORECASE)

    # ── weekly (no day specified) ──
    elif re.search(r'\bevery\s+week\b|\bweekly\b', tl):
        rule = {"type": "interval", "days": 7}
        text = re.sub(r'\bevery\s+week\b|\bweekly\b', '', text, flags=re.IGNORECASE)

    rule_str = json.dumps(rule) if rule else None
    return rule_str, text.strip()


def next_due_date(rule_str: str, from_date: date) -> date | None:
    """Calculate the next due date given a recurrence rule and a base date."""
    if not rule_str:
        return None
    try:
        rule = json.loads(rule_str)
    except Exception:
        return None

    rtype = rule.get("type")

    if rtype == "daily":
        return from_date + timedelta(days=1)

    if rtype == "weekly":
        days = rule.get("days", [0])
        current_dow = from_date.weekday()
        # Find next matching weekday
        for offset in range(1, 8):
            candidate_dow = (current_dow + offset) % 7
            if candidate_dow in days:
                return from_date + timedelta(days=offset)
        return from_date + timedelta(days=7)

    if rtype == "interval":
        return from_date + timedelta(days=rule.get("days", 7))

    if rtype == "monthly_dom":
        dom = rule.get("dom")
        # Advance one month
        month = from_date.month % 12 + 1
        year  = from_date.year + (1 if from_date.month == 12 else 0)
        if dom is None:
            dom = from_date.day
        # Clamp to valid day
        import calendar
        dom = min(dom, calendar.monthrange(year, month)[1])
        return date(year, month, dom)

    if rtype == "monthly_dow":
        week = rule.get("week", 0)
        dow  = rule.get("dow", 0)
        # Advance one month
        month = from_date.month % 12 + 1
        year  = from_date.year + (1 if from_date.month == 12 else 0)
        return _nth_weekday_of_month(year, month, dow, week)

    if rtype == "yearly":
        return date(from_date.year + 1, from_date.month, from_date.day)

    return None


def _nth_weekday_of_month(year: int, month: int, dow: int, n: int) -> date:
    """Return the nth (0-indexed) weekday of a month, or last if n==-1."""
    import calendar
    if n == -1:
        # Last occurrence
        last_day = calendar.monthrange(year, month)[1]
        d = date(year, month, last_day)
        while d.weekday() != dow:
            d -= timedelta(days=1)
        return d
    # Find first occurrence of dow in month
    first = date(year, month, 1)
    offset = (dow - first.weekday()) % 7
    first_occ = first + timedelta(days=offset)
    target = first_occ + timedelta(weeks=n)
    if target.month != month:
        # Overshot — fall back to last occurrence
        target -= timedelta(weeks=1)
    return target


def clone_recurring_task(task: dict, next_date: date) -> dict:
    """Insert a new task as the next recurrence of a completed task. Returns new task dict."""
    new_id = str(uuid.uuid4())
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT COALESCE(MAX(position),0) FROM tasks WHERE project_id=%s AND status='todo'", (task['project_id'],))
        max_pos = cur.fetchone()['coalesce']
        cur.execute("""
            INSERT INTO tasks (id, title, description, project_id, status, priority,
                               due_date, due_time, tags, position, recurrence, recurrence_end, parent_task_id)
            VALUES (%s,%s,%s,%s,'todo',%s,%s,%s,%s,%s,%s,%s,%s)
        """, (new_id, task['title'], task.get('description',''), task['project_id'],
              task.get('priority','medium'), next_date.isoformat(), task.get('due_time'),
              json.dumps(task.get('tags',[])), max_pos+1,
              task.get('recurrence'), task.get('recurrence_end'),
              task.get('parent_task_id') or task['id']))
        cur.execute("SELECT * FROM tasks WHERE id=%s", (new_id,))
        new_task = row_to_dict(cur.fetchone())
        new_task['subtasks'] = []
        conn.commit()
    finally:
        conn.close()
    return new_task


def parse_natural_language(text):
    original = text
    result = {'title': text, 'due_date': None, 'due_time': None, 'priority': 'medium',
              'project_name': None, 'labels': [], 'nlp_summary': None, 'obsidian_url': None,
              'recurrence': None}
    today = date.today()
    found_date = found_time = None

    # ── Recurrence detection (before other parsing so phrases get consumed) ──
    recurrence_rule, text = parse_recurrence(text)

    # ── Obsidian [[wikilink]] → obsidian:// URL ──
    wiki_match = re.search(r'!\[\[([^\]]+)\]\]', text)
    if wiki_match:
        note_name = wiki_match.group(1).strip()
        vault = OBSIDIAN_VAULT or 'vault'
        from urllib.parse import quote
        result['obsidian_url'] = f"obsidian://open?vault={quote(vault)}&file={quote(note_name)}"
        result['obsidian_note'] = note_name
        text = text[:wiki_match.start()] + text[wiki_match.end():].strip()

    # ── Raw obsidian:// URL anywhere in text ──
    if not result['obsidian_url']:
        obs_match = re.search(r'obsidian://\S+', text)
        if obs_match:
            result['obsidian_url'] = obs_match.group(0)
            # Try to extract note name from URL for display
            fn_match = re.search(r'[?&]file=([^&]+)', obs_match.group(0))
            if fn_match:
                from urllib.parse import unquote
                result['obsidian_note'] = unquote(fn_match.group(1))
            text = text[:obs_match.start()] + text[obs_match.end():].strip()

    m = re.search(r'#(\w+)', text)
    if m: result['project_name'] = m.group(1); text = re.sub(r'#\w+','',text).strip()
    labels = re.findall(r'@(\w+)', text)
    if labels: result['labels'] = labels; text = re.sub(r'@\w+','',text).strip()

    tl = text.lower().strip()
    if re.search(r'\b(urgent|asap|critical|!!)\b', tl):
        result['priority']='high'; text=re.sub(r'\b(urgent|asap|critical|!!)\b','',text,flags=re.IGNORECASE).strip()
    elif re.search(r'\b(low priority|whenever|no rush|someday)\b', tl):
        result['priority']='low'; text=re.sub(r'\b(low priority|whenever|no rush|someday)\b','',text,flags=re.IGNORECASE).strip()
    elif re.search(r'\b(important|high priority)\b', tl):
        result['priority']='high'; text=re.sub(r'\b(important|high priority)\b','',text,flags=re.IGNORECASE).strip()

    for pat, kind in [(r'\bat\s+(\d{1,2}):(\d{2})\s*(am|pm)?\b','hm'),(r'\bat\s+(\d{1,2})\s*(am|pm)\b','h'),
                      (r'\b(\d{1,2}):(\d{2})\s*(am|pm)\b','hm'),(r'\b(\d{1,2})\s*(am|pm)\b','h')]:
        m = re.search(pat, tl)
        if m:
            try:
                h,mi=(int(m.group(1)),int(m.group(2))) if kind=='hm' else (int(m.group(1)),0)
                mer=m.group(3 if kind=='hm' else 2) if m.lastindex>=(3 if kind=='hm' else 2) else None
                if mer=='pm' and h<12: h+=12
                elif mer=='am' and h==12: h=0
                found_time=f"{h:02d}:{mi:02d}"; text=text[:m.start()]+text[m.end():]; text=re.sub(r'\bat\s*$','',text).strip(); break
            except: pass

    text=re.sub(r'\bby\s+(?=(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|next|this|\d))','',text,flags=re.IGNORECASE).strip()
    tlc=text.lower()

    m=re.search(r'\b(next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',tlc)
    if m:
        mod,dn=m.group(1),m.group(2); tdow=DAYS.index(dn); cdow=today.weekday()
        delta=(tdow-cdow)%7 or 7; found_date=today+timedelta(days=delta if mod=='this' else max(delta,7)); text=text[:m.start()]+text[m.end():]
    if not found_date:
        m=re.search(r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',tlc)
        if m:
            delta=(DAYS.index(m.group(1))-today.weekday())%7 or 7; found_date=today+timedelta(days=delta); text=text[:m.start()]+text[m.end():]
    if not found_date:
        if re.search(r'\btonight\b',tlc): found_date=today; found_time=found_time or "20:00"; text=re.sub(r'\btonight\b','',text,flags=re.IGNORECASE)
        elif re.search(r'\btomorrow\b',tlc): found_date=today+timedelta(1); text=re.sub(r'\btomorrow\b','',text,flags=re.IGNORECASE)
        elif re.search(r'\btoday\b',tlc): found_date=today; text=re.sub(r'\btoday\b','',text,flags=re.IGNORECASE)
    if not found_date:
        m=re.search(r'\bin\s+(\d+)\s+(day|days|week|weeks)\b',tlc)
        if m:
            n=int(m.group(1)); found_date=today+timedelta(weeks=n if 'week' in m.group(2) else 0,days=0 if 'week' in m.group(2) else n); text=text[:m.start()]+text[m.end():]
    if not found_date:
        if re.search(r'\bnext\s+week\b',tlc): found_date=today+timedelta(weeks=1); text=re.sub(r'\bnext\s+week\b','',text,flags=re.IGNORECASE)
        elif re.search(r'\bnext\s+month\b',tlc):
            month=today.month%12+1; year=today.year+(1 if today.month==12 else 0)
            found_date=today.replace(year=year,month=month,day=1); text=re.sub(r'\bnext\s+month\b','',text,flags=re.IGNORECASE)
    if not found_date:
        m=re.search(r'\b('+('|'.join(MONTHS))+r')\s+(\d{1,2})(?:st|nd|rd|th)?\b',tlc)
        if m:
            try:
                mn=MONTHS.index(m.group(1))+1; dn=int(m.group(2))
                c=date(today.year,mn,dn); found_date=c if c>=today else date(today.year+1,mn,dn); text=text[:m.start()]+text[m.end():]
            except: pass
    if not found_date:
        m=re.search(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b',text)
        if m:
            try:
                mo,dy=int(m.group(1)),int(m.group(2)); yr=int(m.group(3)) if m.group(3) else today.year
                if yr<100: yr+=2000
                found_date=date(yr,mo,dy); text=text[:m.start()]+text[m.end():]
            except: pass
    if not found_date and re.search(r'\b(end of week|eow|weekend)\b',tlc):
        delta=(5-today.weekday())%7 or 7; found_date=today+timedelta(days=delta); text=re.sub(r'\b(end of week|eow|weekend)\b','',text,flags=re.IGNORECASE)

    if found_date: result['due_date']=found_date.isoformat()
    if found_time: result['due_time']=found_time
    if recurrence_rule: result['recurrence']=recurrence_rule
    title=re.sub(r'\s+',' ',text).strip(); title=re.sub(r'^[,.\-]\s*','',title); title=re.sub(r'\s*[,.]$','',title)
    result['title']=title or original
    parts=[]
    if result['project_name']: parts.append(f"#{result['project_name']}")
    if found_date: parts.append(f"due {found_date.strftime('%a %b %-d')}")
    if found_time: h,mi=map(int,found_time.split(':')); parts.append(f"at {h%12 or 12}:{mi:02d}{'am' if h<12 else 'pm'}")
    if result['priority']!='medium': parts.append(f"priority: {result['priority']}")
    if result['labels']: parts.append(' '.join(f"@{l}" for l in result['labels']))
    if result.get('recurrence'):
        r = json.loads(result['recurrence'])
        rtype = r.get('type','')
        rlabel = {'daily':'daily','interval':f"every {r.get('days',7)}d",'yearly':'yearly'}.get(rtype)
        if not rlabel:
            if rtype == 'weekly': rlabel = 'weekly ' + ','.join(['M','T','W','Th','F','Sa','Su'][d] for d in r.get('days',[]))
            elif rtype == 'monthly_dom': rlabel = f"monthly (day {r.get('dom','?')})"
            elif rtype == 'monthly_dow': rlabel = 'monthly (weekday)'
        parts.append(f"🔁 {rlabel}")
    if result.get('obsidian_url'): parts.append(f"📎 {result.get('obsidian_note','obsidian')}")
    if parts: result['nlp_summary']=' · '.join(parts)
    return result

# ─────────────────────────────────────────────
# GOOGLE CALENDAR
# ─────────────────────────────────────────────

GCAL_ENABLED     = False
GCAL_CREDENTIALS = os.environ.get('GCAL_CREDENTIALS_JSON')
GCAL_CALENDAR_ID = os.environ.get('GCAL_CALENDAR_ID', 'primary')
_gcal_service    = None

def _get_gcal_service():
    global _gcal_service, GCAL_ENABLED
    if _gcal_service: return _gcal_service
    if not GCAL_CREDENTIALS: return None
    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
        creds = Credentials.from_service_account_info(json.loads(GCAL_CREDENTIALS),
                scopes=['https://www.googleapis.com/auth/calendar'])
        _gcal_service = build('calendar','v3',credentials=creds)
        GCAL_ENABLED = True
        print("[gcal] Google Calendar connected.", flush=True)
        return _gcal_service
    except Exception as e:
        print(f"[gcal] init failed: {e}", flush=True); return None

_get_gcal_service()

def gcal_upsert(task):
    svc = _get_gcal_service()
    if not svc or not task.get('due_date'): return None
    try:
        if task.get('due_time'):
            dt = f"{task['due_date']}T{task['due_time']}:00"
            end_dt = (datetime.fromisoformat(dt)+timedelta(hours=1)).isoformat()
            start={'dateTime':dt,'timeZone':'UTC'}; end={'dateTime':end_dt,'timeZone':'UTC'}
        else:
            start={'date':task['due_date']}; end={'date':task['due_date']}
        body={'summary':task['title'],'description':task.get('description') or '',
              'start':start,'end':end,
              'extendedProperties':{'private':{'td_task_id':task['id']}}}
        eid = task.get('gcal_event_id')
        if eid:
            ev = svc.events().update(calendarId=GCAL_CALENDAR_ID,eventId=eid,body=body).execute()
        else:
            ev = svc.events().insert(calendarId=GCAL_CALENDAR_ID,body=body).execute()
        return ev.get('id')
    except Exception as e:
        print(f"[gcal] upsert error: {e}", flush=True); return None

def gcal_delete(event_id):
    svc = _get_gcal_service()
    if not svc or not event_id: return
    try: svc.events().delete(calendarId=GCAL_CALENDAR_ID,eventId=event_id).execute()
    except Exception as e: print(f"[gcal] delete error: {e}", flush=True)

def _gcal_save(task_id, event_id):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("UPDATE tasks SET gcal_event_id=%s WHERE id=%s",(event_id,task_id))
        conn.commit()
    finally: conn.close()

# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────

TD_USERNAME = os.environ.get('TD_USERNAME','').strip()
TD_PASSWORD = os.environ.get('TD_PASSWORD','').strip()
API_KEY     = os.environ.get('TD_API_KEY','').strip()

if not TD_PASSWORD: print("[auth] WARNING: TD_PASSWORD not set!", flush=True)
else: print(f"[auth] Login required. Username: {TD_USERNAME}", flush=True)

_failed: dict = {}
_LOCKOUT_ATTEMPTS = 5; _LOCKOUT_SECONDS = 15*60

def _check_rate_limit(ip):
    now=_time.time(); attempts=[t for t in _failed.get(ip,[]) if now-t<_LOCKOUT_SECONDS]
    _failed[ip]=attempts; return len(attempts)>=_LOCKOUT_ATTEMPTS
def _record_failure(ip): _failed.setdefault(ip,[]).append(_time.time())
def _clear_failures(ip): _failed.pop(ip,None)

_PUBLIC_PATHS={'/login','/auth/login','/auth/logout','/auth/status'}

def _hash_pw(pw): return hashlib.sha256(pw.encode()).hexdigest()

def _create_session(remember):
    sid=secrets.token_urlsafe(32)
    expires=datetime.now(timezone.utc)+(timedelta(days=30) if remember else timedelta(hours=8))
    conn=get_db()
    try:
        cur=conn.cursor(); cur.execute("INSERT INTO sessions (id,expires,remember) VALUES (%s,%s,%s)",(sid,expires,remember)); conn.commit()
    finally: conn.close()
    return sid,expires

def _valid_session(sid):
    if not sid: return False
    try:
        conn=get_db(); cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT expires FROM sessions WHERE id=%s",(sid,)); row=cur.fetchone(); conn.close()
        if not row: return False
        exp=row['expires']; exp=exp.replace(tzinfo=timezone.utc) if exp.tzinfo is None else exp
        return datetime.now(timezone.utc)<exp
    except: return False

def _delete_session(sid):
    try:
        conn=get_db(); cur=conn.cursor(); cur.execute("DELETE FROM sessions WHERE id=%s",(sid,)); conn.commit(); conn.close()
    except: pass

def _purge_expired_sessions():
    try:
        conn=get_db(); cur=conn.cursor(); cur.execute("DELETE FROM sessions WHERE expires<NOW()"); conn.commit(); conn.close()
    except: pass

def _is_authenticated():
    if API_KEY:
        auth=request.headers.get('Authorization','')
        if auth.startswith('Bearer ') and auth[7:]==API_KEY: return True
        if request.headers.get('X-API-Key','')==API_KEY: return True
    return _valid_session(request.cookies.get('td_session',''))

LOGIN_HTML="""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"><title>TD — Sign In</title><style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--bg:#000;--bg2:#1c1c1e;--accent:#0a84ff;--text:#fff;--text2:rgba(255,255,255,.7);--text3:rgba(255,255,255,.4);--red:#ff453a;--radius:12px;--font:-apple-system,'SF Pro Text','Inter',sans-serif}html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);-webkit-font-smoothing:antialiased}body{display:flex;align-items:center;justify-content:center;padding:24px}.card{width:100%;max-width:360px}.logo{text-align:center;margin-bottom:40px}.logo-mark{width:72px;height:72px;background:var(--accent);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:36px;box-shadow:0 8px 32px rgba(10,132,255,.35)}.logo h1{font-size:28px;font-weight:700}.logo p{font-size:14px;color:var(--text3);margin-top:4px}.fields{background:var(--bg2);border-radius:var(--radius);overflow:hidden;border:1px solid rgba(255,255,255,.07);margin-bottom:12px}.field+.field::before{content:'';display:block;height:1px;background:rgba(255,255,255,.07);margin:0 15px}.field label{display:block;font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;padding:10px 15px 0}.field input{display:block;width:100%;background:none;border:none;padding:4px 15px 11px;font-family:var(--font);font-size:16px;color:var(--text);outline:none}.row{display:flex;align-items:center;gap:8px;margin:14px 0}.row input[type=checkbox]{width:18px;height:18px;accent-color:var(--accent);cursor:pointer}.row label{font-size:14px;color:var(--text2);cursor:pointer}.btn{width:100%;padding:14px;background:var(--accent);border:none;border-radius:var(--radius);font-family:var(--font);font-size:17px;font-weight:600;color:#fff;cursor:pointer;transition:opacity .15s}.err{color:var(--red);font-size:14px;text-align:center;margin-top:12px;min-height:20px}</style></head><body><div class="card"><div class="logo"><div class="logo-mark">✓</div><h1>TD</h1><p>Sign in to continue</p></div><form id="form" onsubmit="login(event)" autocomplete="on"><div class="fields"><div class="field"><label for="un">Username</label><input type="text" id="un" name="username" autocomplete="username" autofocus placeholder="Enter username" spellcheck="false" autocapitalize="none"></div><div class="field"><label for="pw">Password</label><input type="password" id="pw" name="password" autocomplete="current-password" placeholder="Enter password"></div></div><div class="row"><input type="checkbox" id="rem"><label for="rem">Keep me signed in for 30 days</label></div><button class="btn" type="submit" id="btn">Sign In</button><div class="err" id="err"></div></form></div><script>async function login(e){e.preventDefault();const un=document.getElementById('un').value.trim(),pw=document.getElementById('pw').value,rem=document.getElementById('rem').checked,btn=document.getElementById('btn'),err=document.getElementById('err');err.textContent='';if(!un||!pw){err.textContent='Please fill in both fields.';return;}btn.disabled=true;btn.textContent='Signing in…';try{const r=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:un,password:pw,remember:rem})});if(r.ok){location.href=new URLSearchParams(location.search).get('next')||'/';}else{const d=await r.json();err.textContent=d.error||'Incorrect username or password';document.getElementById('pw').value='';document.getElementById('pw').focus();}}catch(e){err.textContent='Network error';}finally{btn.disabled=false;btn.textContent='Sign In';}}</script></body></html>"""

@app.route('/login')
def login_page():
    if not TD_PASSWORD: return redirect('/')
    if _is_authenticated(): return redirect(request.args.get('next','/'))
    return LOGIN_HTML,200,{'Content-Type':'text/html'}

@app.route('/auth/login',methods=['POST'])
def do_login():
    if not TD_PASSWORD: return jsonify({'ok':True})
    ip=request.remote_addr or '0.0.0.0'
    if _check_rate_limit(ip): return jsonify({'error':'Too many attempts — try again in 15 minutes'}),429
    data=request.get_json() or {}
    uok=(not TD_USERNAME) or secrets.compare_digest(data.get('username','').strip().lower(),TD_USERNAME.lower())
    pok=secrets.compare_digest(_hash_pw(data.get('password','').strip()),_hash_pw(TD_PASSWORD))
    if not (uok and pok): _record_failure(ip); return jsonify({'error':'Incorrect username or password'}),401
    _clear_failures(ip); _purge_expired_sessions()
    sid,expires=_create_session(bool(data.get('remember')))
    resp=make_response(jsonify({'ok':True}))
    resp.set_cookie('td_session',sid,httponly=True,samesite='Lax',
                    expires=expires if data.get('remember') else None,
                    max_age=30*86400 if data.get('remember') else None)
    return resp

@app.route('/auth/logout',methods=['POST'])
def do_logout():
    _delete_session(request.cookies.get('td_session',''))
    resp=make_response(redirect('/login')); resp.delete_cookie('td_session'); return resp

@app.route('/auth/status')
def auth_status():
    return jsonify({'password_set':bool(TD_PASSWORD),'authenticated':_is_authenticated(),
                    'username':TD_USERNAME or None,'gcal_enabled':GCAL_ENABLED,
                    'obsidian_vault':OBSIDIAN_VAULT or None})

@app.before_request
def auth_middleware():
    path=request.path
    if path in _PUBLIC_PATHS or request.method=='OPTIONS': return None
    if not TD_PASSWORD:
        if path.startswith('/api/') and API_KEY:
            auth=request.headers.get('Authorization',''); xkey=request.headers.get('X-API-Key','')
            if not ((auth.startswith('Bearer ') and auth[7:]==API_KEY) or xkey==API_KEY):
                return jsonify({'error':'Unauthorized'}),401
        return None
    if not _is_authenticated():
        if path.startswith('/api/'): return jsonify({'error':'Unauthorized'}),401
        from urllib.parse import quote
        return redirect(f'/login?next={quote(request.full_path.rstrip("?"))}')

@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']='*'
    response.headers['Access-Control-Allow-Headers']='Content-Type, Authorization, X-API-Key'
    response.headers['Access-Control-Allow-Methods']='GET,POST,PUT,PATCH,DELETE,OPTIONS'
    return response

# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.route('/share-target')
def share_target():
    from urllib.parse import urlencode
    params={f'share_{k}':v for k in ('title','text','url') if (v:=request.args.get(k,'').strip())}
    qs=urlencode(params); return redirect(f'/?{qs}' if qs else '/')

@app.route('/',defaults={'path':''})
@app.route('/<path:path>')
def serve_frontend(path):
    if path and os.path.exists(os.path.join(app.static_folder,path)):
        return send_from_directory(app.static_folder,path)
    return send_from_directory(app.static_folder,'index.html')

@app.route('/api/nlp/parse',methods=['POST','OPTIONS'])
def nlp_parse():
    if request.method=='OPTIONS': return '',204
    return jsonify(parse_natural_language(request.get_json().get('text','')))

# ── Projects ──

@app.route('/api/projects',methods=['GET','OPTIONS'])
def get_projects():
    if request.method=='OPTIONS': return '',204
    conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""SELECT p.*,COUNT(t.id) as task_count,
            SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as done_count
            FROM projects p LEFT JOIN tasks t ON t.project_id=p.id
            GROUP BY p.id ORDER BY p.created_at""")
        rows=cur.fetchall()
    finally: conn.close()
    return jsonify([row_to_dict(r) for r in rows])

@app.route('/api/projects',methods=['POST'])
def create_project():
    data=request.get_json(); pid=str(uuid.uuid4())
    conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("INSERT INTO projects (id,name,color,icon) VALUES (%s,%s,%s,%s)",
                    (pid,data['name'],data.get('color','#6366f1'),data.get('icon','📁')))
        cur.execute("SELECT * FROM projects WHERE id=%s",(pid,)); row=cur.fetchone(); conn.commit()
    finally: conn.close()
    return jsonify(row_to_dict(row)),201

@app.route('/api/projects/<pid>',methods=['PUT','PATCH'])
def update_project(pid):
    data=request.get_json(); conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        for f in ('name','color','icon'):
            if f in data: cur.execute(f"UPDATE projects SET {f}=%s,updated_at=NOW() WHERE id=%s",(data[f],pid))
        cur.execute("SELECT * FROM projects WHERE id=%s",(pid,)); row=cur.fetchone(); conn.commit()
    finally: conn.close()
    return jsonify(row_to_dict(row))

@app.route('/api/projects/<pid>',methods=['DELETE'])
def delete_project(pid):
    if pid=='inbox': return jsonify({'error':'Cannot delete inbox'}),400
    conn=get_db()
    try:
        cur=conn.cursor(); cur.execute("UPDATE tasks SET project_id='inbox' WHERE project_id=%s",(pid,))
        cur.execute("DELETE FROM projects WHERE id=%s",(pid,)); conn.commit()
    finally: conn.close()
    return '',204

# ── Tasks helpers ──

def _fetch_tasks(query,params=()):
    conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(query,params); tasks=[row_to_dict(r) for r in cur.fetchall()]
        for t in tasks:
            cur.execute("SELECT * FROM subtasks WHERE task_id=%s ORDER BY position",(t['id'],))
            t['subtasks']=[row_to_dict(s) for s in cur.fetchall()]
    finally: conn.close()
    return tasks

# ── Tasks ──

@app.route('/api/tasks',methods=['GET'])
def get_tasks():
    pid=request.args.get('project_id'); status=request.args.get('status'); search=request.args.get('search')
    q="SELECT * FROM tasks WHERE 1=1"; p=[]
    if pid: q+=" AND project_id=%s"; p.append(pid)
    if status: q+=" AND status=%s"; p.append(status)
    if search: q+=" AND (title ILIKE %s OR description ILIKE %s)"; p+=[f'%{search}%',f'%{search}%']
    q+=" ORDER BY position,created_at"
    return jsonify(_fetch_tasks(q,p))

@app.route('/api/tasks',methods=['POST'])
def create_task():
    data=request.get_json(); tid=str(uuid.uuid4())
    title=data.get('title','').strip()
    if not title: return jsonify({'error':'Title required'}),400
    nlp={}
    if data.get('nlp'): nlp=parse_natural_language(title); title=nlp.get('title',title)
    tags=data.get('tags',nlp.get('labels',[])); due_date=data.get('due_date',nlp.get('due_date'))
    due_time=data.get('due_time',nlp.get('due_time')); priority=data.get('priority',nlp.get('priority','medium'))
    status=data.get('status','todo'); project_id=data.get('project_id','inbox')
    recurrence=data.get('recurrence',nlp.get('recurrence'))
    recurrence_end=data.get('recurrence_end')
    pname=nlp.get('project_name')
    if pname:
        conn=get_db()
        try:
            cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT id FROM projects WHERE LOWER(name)=LOWER(%s)",(pname,)); row=cur.fetchone()
            if row: project_id=row['id']
            else:
                new_pid=str(uuid.uuid4()); PALETTE=['#7c6af7','#f87171','#fbbf24','#4ade80','#60a5fa','#f472b6','#34d399','#fb923c']
                cur.execute("INSERT INTO projects (id,name,color,icon) VALUES (%s,%s,%s,'📁')",
                            (new_pid,pname.capitalize(),PALETTE[hash(pname)%len(PALETTE)])); project_id=new_pid
            conn.commit()
        finally: conn.close()
    conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT COALESCE(MAX(position),0) FROM tasks WHERE project_id=%s AND status=%s",(project_id,status))
        max_pos=cur.fetchone()['coalesce']
        cur.execute("""INSERT INTO tasks (id,title,description,project_id,status,priority,due_date,due_time,tags,position,recurrence,recurrence_end)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (tid,title,data.get('description',''),project_id,status,priority,due_date,due_time,json.dumps(tags),max_pos+1,recurrence,recurrence_end))
        cur.execute("SELECT * FROM tasks WHERE id=%s",(tid,)); task=row_to_dict(cur.fetchone())
        task['subtasks']=[]; conn.commit()
    finally: conn.close()
    if nlp.get('nlp_summary'): task['nlp_summary']=nlp['nlp_summary']
    # Auto-set description to obsidian URL if parsed and no description given
    if nlp.get('obsidian_url') and not data.get('description','').strip():
        conn=get_db()
        try:
            cur=conn.cursor(); cur.execute("UPDATE tasks SET description=%s WHERE id=%s",(nlp['obsidian_url'],tid)); conn.commit()
        finally: conn.close()
        task['description']=nlp['obsidian_url']
    if due_date:
        eid=gcal_upsert(task)
        if eid: _gcal_save(tid,eid); task['gcal_event_id']=eid
    return jsonify(task),201

@app.route('/api/tasks/<tid>',methods=['GET'])
def get_task(tid):
    conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM tasks WHERE id=%s",(tid,)); row=cur.fetchone()
        if not row: return jsonify({'error':'Not found'}),404
        task=row_to_dict(row)
        cur.execute("SELECT * FROM subtasks WHERE task_id=%s ORDER BY position",(tid,))
        task['subtasks']=[row_to_dict(s) for s in cur.fetchall()]
    finally: conn.close()
    return jsonify(task)

@app.route('/api/tasks/<tid>',methods=['PUT','PATCH'])
def update_task(tid):
    data=request.get_json(); conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM tasks WHERE id=%s",(tid,)); row=cur.fetchone()
        if not row: return jsonify({'error':'Not found'}),404
        t=dict(row)
        for f in ['title','description','project_id','status','priority','due_date','due_time','position','recurrence','recurrence_end']:
            if f in data: t[f]=data[f]
        if 'tags' in data: t['tags']=json.dumps(data['tags'])
        if data.get('status')=='done' and t.get('status')!='done': t['completed_at']=datetime.now(timezone.utc)
        elif data.get('status') and data['status']!='done': t['completed_at']=None
        tags_val=t['tags'] if isinstance(t['tags'],str) else json.dumps(t['tags'])
        cur.execute("""UPDATE tasks SET title=%s,description=%s,project_id=%s,status=%s,priority=%s,
            due_date=%s,due_time=%s,tags=%s,position=%s,completed_at=%s,recurrence=%s,recurrence_end=%s,updated_at=NOW() WHERE id=%s""",
            (t['title'],t['description'],t['project_id'],t['status'],t['priority'],
             t['due_date'],t['due_time'],tags_val,t['position'],t.get('completed_at'),
             t.get('recurrence'),t.get('recurrence_end'),tid))
        cur.execute("SELECT * FROM tasks WHERE id=%s",(tid,)); result=row_to_dict(cur.fetchone())
        cur.execute("SELECT * FROM subtasks WHERE task_id=%s ORDER BY position",(tid,))
        result['subtasks']=[row_to_dict(s) for s in cur.fetchall()]
        conn.commit()
    finally: conn.close()
    # ── Recurrence: clone when completed ──
    if data.get('status') == 'done' and result.get('recurrence'):
        from_date = date.fromisoformat(result['due_date']) if result.get('due_date') else date.today()
        rec_end   = date.fromisoformat(result['recurrence_end']) if result.get('recurrence_end') else None
        next_d    = next_due_date(result['recurrence'], from_date)
        if next_d and (rec_end is None or next_d <= rec_end):
            new_task = clone_recurring_task(result, next_d)
            if new_task.get('due_date'):
                eid = gcal_upsert(new_task)
                if eid: _gcal_save(new_task['id'], eid)
            result['recurrence_next'] = new_task  # surface in response so UI can react

    if any(f in data for f in ('due_date','due_time','title')):
        if result.get('due_date'):
            eid=gcal_upsert(result)
            if eid and eid!=result.get('gcal_event_id'): _gcal_save(tid,eid); result['gcal_event_id']=eid
        elif result.get('gcal_event_id'):
            gcal_delete(result['gcal_event_id']); _gcal_save(tid,None); result['gcal_event_id']=None
    return jsonify(result)

@app.route('/api/tasks/<tid>',methods=['DELETE'])
def delete_task(tid):
    conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT gcal_event_id FROM tasks WHERE id=%s",(tid,)); row=cur.fetchone()
        if row and row['gcal_event_id']: gcal_delete(row['gcal_event_id'])
        cur.execute("DELETE FROM subtasks WHERE task_id=%s",(tid,))
        cur.execute("DELETE FROM tasks WHERE id=%s",(tid,)); conn.commit()
    finally: conn.close()
    return '',204

# ── Subtasks ──

@app.route('/api/tasks/<tid>/subtasks',methods=['POST'])
def add_subtask(tid):
    data=request.get_json(); sid=str(uuid.uuid4())
    nlp=parse_natural_language(data.get('title','').strip()); conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT COALESCE(MAX(position),0) FROM subtasks WHERE task_id=%s",(tid,)); max_pos=cur.fetchone()['coalesce']
        cur.execute("""INSERT INTO subtasks (id,task_id,title,position,due_date,due_time,priority,labels)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (sid,tid,nlp.get('title') or data.get('title',''),max_pos+1,
             nlp.get('due_date'),nlp.get('due_time'),nlp.get('priority','medium'),json.dumps(nlp.get('labels',[]))))
        cur.execute("SELECT * FROM subtasks WHERE id=%s",(sid,)); row=row_to_dict(cur.fetchone()); conn.commit()
    finally: conn.close()
    if nlp.get('nlp_summary'): row['nlp_summary']=nlp['nlp_summary']
    return jsonify(row),201

@app.route('/api/tasks/<tid>/subtasks/<sid>',methods=['PATCH'])
def update_subtask(tid,sid):
    data=request.get_json(); conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        for f in ('title','due_date','due_time','priority'):
            if f in data: cur.execute(f"UPDATE subtasks SET {f}=%s WHERE id=%s",(data[f],sid))
        if 'completed' in data: cur.execute("UPDATE subtasks SET completed=%s WHERE id=%s",(bool(data['completed']),sid))
        if 'labels' in data: cur.execute("UPDATE subtasks SET labels=%s WHERE id=%s",(json.dumps(data['labels']),sid))
        cur.execute("SELECT * FROM subtasks WHERE id=%s",(sid,)); row=cur.fetchone(); conn.commit()
    finally: conn.close()
    return jsonify(row_to_dict(row))

@app.route('/api/tasks/<tid>/subtasks/<sid>',methods=['DELETE'])
def delete_subtask(tid,sid):
    conn=get_db()
    try:
        cur=conn.cursor(); cur.execute("DELETE FROM subtasks WHERE id=%s",(sid,)); conn.commit()
    finally: conn.close()
    return '',204

# ── Misc ──

@app.route('/api/tasks/reorder',methods=['POST'])
def reorder_tasks():
    data=request.get_json(); conn=get_db()
    try:
        cur=conn.cursor()
        for item in data:
            cur.execute("UPDATE tasks SET position=%s,status=%s,updated_at=NOW() WHERE id=%s",
                        (item['position'],item['status'],item['id']))
        conn.commit()
    finally: conn.close()
    return jsonify({'ok':True})

@app.route('/api/export',methods=['GET'])
def export_data():
    conn=get_db()
    try:
        cur=conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM projects ORDER BY created_at"); projects=[row_to_dict(r) for r in cur.fetchall()]
        cur.execute("SELECT * FROM tasks ORDER BY project_id,position"); tasks=[row_to_dict(r) for r in cur.fetchall()]
        cur.execute("SELECT * FROM subtasks ORDER BY task_id,position"); subtasks=[row_to_dict(r) for r in cur.fetchall()]
    finally: conn.close()
    task_map={t['id']:t for t in tasks}
    for sub in subtasks: task_map.get(sub['task_id'],{}).setdefault('subtasks',[]).append(sub)
    proj_map={p['id']:{**p,'tasks':[]} for p in projects}
    for t in tasks: proj_map.get(t.get('project_id','inbox'),{}).get('tasks',[]).append(t)
    return jsonify({'exported_at':datetime.now().isoformat(),'version':'2.0','projects':list(proj_map.values()),
        'stats':{'total_tasks':len(tasks),'done':sum(1 for t in tasks if t['status']=='done'),
                 'todo':sum(1 for t in tasks if t['status']=='todo'),'in_progress':sum(1 for t in tasks if t['status']=='doing')}})

@app.route('/api/gcal/status',methods=['GET'])
def gcal_status():
    return jsonify({'enabled':GCAL_ENABLED,'calendar_id':GCAL_CALENDAR_ID if GCAL_ENABLED else None})

@app.route('/api/gcal/sync',methods=['POST'])
def gcal_sync_all():
    if not GCAL_ENABLED: return jsonify({'error':'Google Calendar not configured'}),400
    tasks=_fetch_tasks("SELECT * FROM tasks WHERE due_date IS NOT NULL AND status!='done'")
    synced=0
    for task in tasks:
        eid=gcal_upsert(task)
        if eid: _gcal_save(task['id'],eid); synced+=1
    return jsonify({'synced':synced,'total':len(tasks)})

@app.route('/api/tasks/today',methods=['GET'])
def get_today():
    return jsonify(_fetch_tasks("SELECT * FROM tasks WHERE due_date=CURRENT_DATE AND status!='done' ORDER BY due_time,position"))

@app.route('/api/tasks/upcoming',methods=['GET'])
def get_upcoming():
    return jsonify(_fetch_tasks("SELECT * FROM tasks WHERE due_date>=CURRENT_DATE AND due_date<=CURRENT_DATE+INTERVAL '7 days' AND status!='done' ORDER BY due_date,due_time"))

@app.route('/api/tasks/overdue',methods=['GET'])
def get_overdue():
    return jsonify(_fetch_tasks("SELECT * FROM tasks WHERE due_date<CURRENT_DATE AND status!='done' ORDER BY due_date,due_time"))

@app.route('/api/tasks/review',methods=['GET'])
def get_review():
    # Tasks that need triage: in inbox (or no project), no labels/tags, not done
    return jsonify(_fetch_tasks("""
        SELECT * FROM tasks
        WHERE status != 'done'
          AND (project_id = 'inbox' OR project_id IS NULL)
          AND (tags = '[]' OR tags IS NULL)
        ORDER BY created_at
    """))

# ─────────────────────────────────────────────

if __name__=='__main__':
    import socket
    try: ip=socket.gethostbyname(socket.gethostname())
    except: ip='127.0.0.1'
    print(f"\n{'='*50}\n  TD running!\n  Local:   http://localhost:5000\n  Network: http://{ip}:5000\n{'='*50}\n")
    app.run(host='0.0.0.0',port=5000,debug=False)
