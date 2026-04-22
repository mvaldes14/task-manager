"""Database connection pool and helpers."""

import json, os, threading, logging, uuid

import psycopg2, psycopg2.extras
from psycopg2 import pool as psycopg2_pool

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://td:td@localhost:5432/td')

_pool = None
_pool_lock = threading.Lock()

def get_pool():
    global _pool
    if _pool is not None:
        return _pool
    with _pool_lock:
        if _pool is None:
            _pool = psycopg2_pool.ThreadedConnectionPool(2, 10, DATABASE_URL)
    return _pool

def get_db():
    conn = get_pool().getconn()
    conn.autocommit = False
    return conn

def release_db(conn):
    get_pool().putconn(conn)

def row_to_dict(row):
    if row is None: return None
    d = dict(row)
    for field in ('created_at', 'updated_at', 'completed_at', 'reminder_sent_at'):
        if field in d and d[field] is not None: d[field] = str(d[field])
    if 'due_date'       in d and d['due_date']       is not None: d['due_date']       = str(d['due_date'])[:10]
    if 'recurrence_end' in d and d['recurrence_end'] is not None: d['recurrence_end'] = str(d['recurrence_end'])[:10]
    if 'due_time'       in d and d['due_time']       is not None: d['due_time']       = str(d['due_time'])[:5]
    for field in ('tags', 'labels', 'links'):
        if field in d:
            if isinstance(d[field], str):
                try: d[field] = json.loads(d[field])
                except Exception:
                    logger.warning("Failed to parse JSON for field %s", field)
                    d[field] = []
            elif d[field] is None: d[field] = []
    if 'completed' in d: d['completed'] = bool(d['completed'])
    return d

def init_db():
    logger.info("creating tables...")
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL, display_name TEXT,
                avatar BYTEA, is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )""")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY, name TEXT NOT NULL,
                color TEXT DEFAULT '#6366f1', icon TEXT DEFAULT '📁',
                owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                shared BOOLEAN DEFAULT FALSE,
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
                recurrence TEXT, recurrence_end DATE, parent_task_id TEXT,
                obsidian_url TEXT, links JSONB DEFAULT '[]',
                owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL
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
                expires TIMESTAMPTZ NOT NULL, remember BOOLEAN DEFAULT FALSE,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE
            )""")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ics_calendars (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT DEFAULT '#bb9af7',
                url TEXT, content TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
            )""")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                data JSONB NOT NULL DEFAULT '{}',
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT single_row CHECK (id = 1)
            )""")
        cur.execute("INSERT INTO settings (id, data) VALUES (1, '{}') ON CONFLICT (id) DO NOTHING")
        cur.execute("INSERT INTO projects (id,name,color,icon) VALUES ('inbox','Inbox','#6366f1','📥') ON CONFLICT (id) DO NOTHING")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)")
        cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)")
        cur.execute("ALTER TABLE subtasks ADD COLUMN IF NOT EXISTS linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL")
        # Multi-user columns (additive migrations)
        cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id) ON DELETE SET NULL")
        cur.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS shared BOOLEAN DEFAULT FALSE")
        cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id) ON DELETE SET NULL")
        cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL")
        cur.execute("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_owner_id    ON tasks(owner_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id  ON sessions(user_id)")
        # Reminders
        cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ")
        # Priority
        cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_reminder ON tasks(due_date, reminder_sent_at) WHERE status != 'done'")
        conn.commit()
        logger.info("tables ready.")
        _migrate_to_multiuser(conn)
    except Exception as e:
        conn.rollback()
        logger.exception("init_db failed: %s", e)
        raise
    finally:
        release_db(conn)


def _migrate_to_multiuser(conn):
    """One-time migration: seed first user from TD_USERNAME/TD_PASSWORD env vars."""
    import bcrypt as _bcrypt
    td_username = os.environ.get('TD_USERNAME', '').strip()
    td_password = os.environ.get('TD_PASSWORD', '').strip()
    if not td_password:
        return
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT COUNT(*) AS cnt FROM users")
        if cur.fetchone()['cnt'] > 0:
            return  # already migrated
        logger.info("[migration] seeding first user from TD_USERNAME/TD_PASSWORD")
        uid = str(uuid.uuid4())
        username = td_username or 'admin'
        pw_hash = _bcrypt.hashpw(td_password.encode(), _bcrypt.gensalt(12)).decode()
        cur.execute(
            "INSERT INTO users (id, username, password_hash, display_name, is_admin) VALUES (%s,%s,%s,%s,TRUE)",
            (uid, username, pw_hash, username.capitalize()))
        cur.execute("UPDATE tasks SET owner_id=%s WHERE owner_id IS NULL", (uid,))
        cur.execute("UPDATE sessions SET user_id=%s WHERE user_id IS NULL", (uid,))
        cur.execute("UPDATE projects SET owner_id=%s WHERE owner_id IS NULL AND id != 'inbox'", (uid,))
        conn.commit()
        logger.info("[migration] created user '%s' (id=%s), assigned all existing tasks/sessions", username, uid)
    except Exception:
        conn.rollback()
        logger.exception("[migration] failed")

def get_settings() -> dict:
    """Return the single settings row as a dict, creating it if missing."""
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT data FROM settings LIMIT 1")
        row = cur.fetchone()
        return dict(row['data']) if row else {}
    finally:
        release_db(conn)

def save_settings(data: dict) -> dict:
    """Upsert the settings row and return the saved data."""
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            INSERT INTO settings (data) VALUES (%s)
            ON CONFLICT (id) DO UPDATE SET data = settings.data || %s, updated_at = NOW()
            RETURNING data
        """, (json.dumps(data), json.dumps(data)))
        row = cur.fetchone()
        conn.commit()
        return dict(row['data'])
    finally:
        release_db(conn)
