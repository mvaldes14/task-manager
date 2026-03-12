"""Database connection pool and helpers."""

import json, os
import psycopg2, psycopg2.extras
from psycopg2 import pool as psycopg2_pool

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://td:td@localhost:5432/td')

_pool = None

def get_pool():
    global _pool
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
    for field in ('created_at', 'updated_at', 'completed_at'):
        if field in d and d[field] is not None: d[field] = str(d[field])
    if 'due_date'       in d and d['due_date']       is not None: d['due_date']       = str(d['due_date'])[:10]
    if 'recurrence_end' in d and d['recurrence_end'] is not None: d['recurrence_end'] = str(d['recurrence_end'])[:10]
    if 'due_time'       in d and d['due_time']       is not None: d['due_time']       = str(d['due_time'])[:5]
    for field in ('tags', 'labels', 'links'):
        if field in d:
            if isinstance(d[field], str):
                try: d[field] = json.loads(d[field])
                except: d[field] = []
            elif d[field] is None: d[field] = []
    if 'completed' in d: d['completed'] = bool(d['completed'])
    return d

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
                recurrence TEXT, recurrence_end DATE, parent_task_id TEXT,
                obsidian_url TEXT, links JSONB DEFAULT '[]'
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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ics_calendars (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT DEFAULT '#bb9af7',
                url TEXT, content TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
            )""")
        cur.execute("INSERT INTO projects (id,name,color,icon) VALUES ('inbox','Inbox','#6366f1','📥') ON CONFLICT (id) DO NOTHING")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)")
        cur.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)")
        conn.commit()
        print("[init_db] done.", flush=True)
    except Exception as e:
        conn.rollback(); print(f"[init_db] error: {e}", flush=True); raise
    finally:
        release_db(conn)
