"""Task, subtask, and reorder routes."""

import json, uuid
from datetime import datetime, date, timezone

import psycopg2.extras
from flask import Blueprint, request, jsonify

from lib.db import get_db, release_db, row_to_dict
from lib.nlp import parse_natural_language, next_due_date
from lib.gcal import gcal_upsert, gcal_delete, gcal_save, GCAL_CALENDAR_ID, is_enabled as gcal_is_enabled

bp = Blueprint('tasks', __name__)

# ── Helper ─────────────────────────────────────────────────────
def _fetch_tasks(query, params=()):
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(query, params)
        tasks = [row_to_dict(r) for r in cur.fetchall()]
        if not tasks:
            return tasks
        task_ids = [t['id'] for t in tasks]
        cur.execute(
            "SELECT * FROM subtasks WHERE task_id = ANY(%s) ORDER BY task_id, position",
            (task_ids,))
        subtasks_by_task = {}
        for s in cur.fetchall():
            s = row_to_dict(s)
            subtasks_by_task.setdefault(s['task_id'], []).append(s)
        for t in tasks:
            t['subtasks'] = subtasks_by_task.get(t['id'], [])
    finally:
        release_db(conn)
    return tasks


def _clone_recurring_task(task: dict, next_date) -> dict:
    new_id = str(uuid.uuid4())
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT COALESCE(MAX(position),0) FROM tasks WHERE project_id=%s AND status='todo'",
                    (task['project_id'],))
        max_pos = cur.fetchone()['coalesce']
        cur.execute("""
            INSERT INTO tasks (id, title, description, project_id, status,
                               due_date, due_time, tags, position, recurrence, recurrence_end, parent_task_id)
            VALUES (%s,%s,%s,%s,'todo',%s,%s,%s,%s,%s,%s,%s)
        """, (new_id, task['title'], task.get('description', ''), task['project_id'],
              next_date.isoformat(), task.get('due_time'),
              json.dumps(task.get('tags', [])), max_pos + 1,
              task.get('recurrence'), task.get('recurrence_end'),
              task.get('parent_task_id') or task['id']))
        cur.execute("SELECT * FROM tasks WHERE id=%s", (new_id,))
        new_task = row_to_dict(cur.fetchone())
        new_task['subtasks'] = []
        conn.commit()
    finally:
        release_db(conn)
    return new_task


# ── Task routes ────────────────────────────────────────────────
@bp.route('/api/tasks', methods=['GET'])
def get_tasks():
    pid = request.args.get('project_id')
    status = request.args.get('status')
    search = request.args.get('search')
    q = "SELECT * FROM tasks WHERE 1=1"; p = []
    if pid:    q += " AND project_id=%s"; p.append(pid)
    if status: q += " AND status=%s";     p.append(status)
    if search: q += " AND (title ILIKE %s OR description ILIKE %s)"; p += [f'%{search}%', f'%{search}%']
    q += " ORDER BY position,created_at"
    return jsonify(_fetch_tasks(q, p))


@bp.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json(); tid = str(uuid.uuid4())
    title = data.get('title', '').strip()
    if not title: return jsonify({'error': 'Title required'}), 400
    nlp = {}
    if data.get('nlp'): nlp = parse_natural_language(title); title = nlp.get('title', title)
    tags = data.get('tags', nlp.get('labels', []))
    due_date = data.get('due_date', nlp.get('due_date'))
    due_time = data.get('due_time', nlp.get('due_time'))
    status = data.get('status', 'todo')
    project_id = data.get('project_id', 'inbox')
    recurrence = data.get('recurrence', nlp.get('recurrence'))
    recurrence_end = data.get('recurrence_end')
    pname = nlp.get('project_name')
    if pname:
        conn = get_db()
        try:
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT id FROM projects WHERE LOWER(name)=LOWER(%s)", (pname,))
            row = cur.fetchone()
            if row:
                project_id = row['id']
            else:
                new_pid = str(uuid.uuid4())
                PALETTE = ['#7c6af7','#f87171','#fbbf24','#4ade80','#60a5fa','#f472b6','#34d399','#fb923c']
                cur.execute("INSERT INTO projects (id,name,color,icon) VALUES (%s,%s,%s,'📁')",
                            (new_pid, pname.capitalize(), PALETTE[hash(pname) % len(PALETTE)]))
                project_id = new_pid
            conn.commit()
        finally:
            release_db(conn)
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT COALESCE(MAX(position),0) FROM tasks WHERE project_id=%s AND status=%s",
                    (project_id, status))
        max_pos = cur.fetchone()['coalesce']
        obsidian_url = nlp.get('obsidian_url') or data.get('obsidian_url')
        links = data.get('links', [])
        if not links and obsidian_url:
            note_name = nlp.get('obsidian_note') or 'Obsidian'
            links = [{'url': obsidian_url, 'label': note_name}]
        cur.execute("""INSERT INTO tasks (id,title,description,project_id,status,due_date,due_time,tags,position,recurrence,recurrence_end,links)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (tid, title, data.get('description', ''), project_id, status, due_date, due_time,
             json.dumps(tags), max_pos + 1, recurrence, recurrence_end, json.dumps(links)))
        cur.execute("SELECT * FROM tasks WHERE id=%s", (tid,))
        task = row_to_dict(cur.fetchone())
        task['subtasks'] = []; conn.commit()
    finally:
        release_db(conn)
    if nlp.get('nlp_summary'): task['nlp_summary'] = nlp['nlp_summary']
    if nlp.get('obsidian_new_url'): task['obsidian_new_url'] = nlp['obsidian_new_url']
    if obsidian_url and not data.get('description', '').strip():
        conn = get_db()
        try:
            cur = conn.cursor()
            cur.execute("UPDATE tasks SET description=%s WHERE id=%s", (obsidian_url, tid))
            conn.commit()
        finally:
            release_db(conn)
        task['description'] = obsidian_url
    if due_date:
        task['timezone'] = data.get('timezone') or 'UTC'
        eid = gcal_upsert(task)
        if eid: gcal_save(tid, eid); task['gcal_event_id'] = eid
    return jsonify(task), 201


@bp.route('/api/tasks/<tid>', methods=['GET'])
def get_task(tid):
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM tasks WHERE id=%s", (tid,)); row = cur.fetchone()
        if not row: return jsonify({'error': 'Not found'}), 404
        task = row_to_dict(row)
        cur.execute("SELECT * FROM subtasks WHERE task_id=%s ORDER BY position", (tid,))
        task['subtasks'] = [row_to_dict(s) for s in cur.fetchall()]
    finally:
        release_db(conn)
    return jsonify(task)


@bp.route('/api/tasks/<tid>', methods=['PUT', 'PATCH'])
def update_task(tid):
    data = request.get_json(); conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM tasks WHERE id=%s", (tid,)); row = cur.fetchone()
        if not row: return jsonify({'error': 'Not found'}), 404
        t = dict(row)
        for f in ['title','description','project_id','status','due_date','due_time','position','recurrence','recurrence_end']:
            if f in data: t[f] = data[f]
        if 'tags'  in data: t['tags']  = json.dumps(data['tags'])
        if 'links' in data: t['links'] = json.dumps(data['links'])
        if data.get('status') == 'done' and t.get('status') != 'done':
            t['completed_at'] = datetime.now(timezone.utc)
        elif data.get('status') and data['status'] != 'done':
            t['completed_at'] = None
        tags_val  = t['tags']  if isinstance(t['tags'],  str) else json.dumps(t['tags'])
        links_val = t.get('links', '[]')
        links_val = links_val if isinstance(links_val, str) else json.dumps(links_val)
        cur.execute("""UPDATE tasks SET title=%s,description=%s,project_id=%s,status=%s,
            due_date=%s,due_time=%s,tags=%s,position=%s,completed_at=%s,recurrence=%s,recurrence_end=%s,links=%s,updated_at=NOW() WHERE id=%s""",
            (t['title'], t['description'], t['project_id'], t['status'],
             t['due_date'], t['due_time'], tags_val, t['position'], t.get('completed_at'),
             t.get('recurrence'), t.get('recurrence_end'), links_val, tid))
        cur.execute("SELECT * FROM tasks WHERE id=%s", (tid,))
        result = row_to_dict(cur.fetchone())
        cur.execute("SELECT * FROM subtasks WHERE task_id=%s ORDER BY position", (tid,))
        result['subtasks'] = [row_to_dict(s) for s in cur.fetchall()]
        conn.commit()
    finally:
        release_db(conn)
    # Recurrence clone on complete
    if data.get('status') == 'done' and result.get('recurrence'):
        from_date = date.fromisoformat(result['due_date']) if result.get('due_date') else date.today()
        rec_end   = date.fromisoformat(result['recurrence_end']) if result.get('recurrence_end') else None
        next_d    = next_due_date(result['recurrence'], from_date)
        if next_d and (rec_end is None or next_d <= rec_end):
            new_task = _clone_recurring_task(result, next_d)
            if new_task.get('due_date'):
                eid = gcal_upsert(new_task)
                if eid: gcal_save(new_task['id'], eid)
            result['recurrence_next'] = new_task
    if any(f in data for f in ('due_date', 'due_time', 'title', 'status')):
        if result.get('due_date'):
            result['timezone'] = data.get('timezone') or 'UTC'
            eid = gcal_upsert(result)
            if eid and eid != result.get('gcal_event_id'):
                gcal_save(tid, eid); result['gcal_event_id'] = eid
        elif result.get('gcal_event_id'):
            gcal_delete(result['gcal_event_id']); gcal_save(tid, None); result['gcal_event_id'] = None
    return jsonify(result)


@bp.route('/api/tasks/<tid>', methods=['DELETE'])
def delete_task(tid):
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT gcal_event_id FROM tasks WHERE id=%s", (tid,)); row = cur.fetchone()
        if row and row['gcal_event_id']: gcal_delete(row['gcal_event_id'])
        cur.execute("DELETE FROM subtasks WHERE task_id=%s", (tid,))
        cur.execute("DELETE FROM tasks WHERE id=%s", (tid,)); conn.commit()
    finally:
        release_db(conn)
    return '', 204


# ── Subtask routes ─────────────────────────────────────────────
@bp.route('/api/tasks/<tid>/subtasks', methods=['POST'])
def add_subtask(tid):
    data = request.get_json(); sid = str(uuid.uuid4())
    nlp = parse_natural_language(data.get('title', '').strip()); conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT COALESCE(MAX(position),0) FROM subtasks WHERE task_id=%s", (tid,))
        max_pos = cur.fetchone()['coalesce']
        cur.execute("""INSERT INTO subtasks (id,task_id,title,position,due_date,due_time,labels)
            VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (sid, tid, nlp.get('title') or data.get('title', ''), max_pos + 1,
             nlp.get('due_date'), nlp.get('due_time'), json.dumps(nlp.get('labels', []))))
        cur.execute("SELECT * FROM subtasks WHERE id=%s", (sid,))
        row = row_to_dict(cur.fetchone()); conn.commit()
    finally:
        release_db(conn)
    if nlp.get('nlp_summary'): row['nlp_summary'] = nlp['nlp_summary']
    return jsonify(row), 201


@bp.route('/api/tasks/<tid>/subtasks/<sid>', methods=['PATCH'])
def update_subtask(tid, sid):
    data = request.get_json(); conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        for f in ('title', 'due_date', 'due_time'):
            if f in data: cur.execute(f"UPDATE subtasks SET {f}=%s WHERE id=%s", (data[f], sid))
        if 'completed' in data:
            cur.execute("UPDATE subtasks SET completed=%s WHERE id=%s", (bool(data['completed']), sid))
        if 'labels' in data:
            cur.execute("UPDATE subtasks SET labels=%s WHERE id=%s", (json.dumps(data['labels']), sid))
        cur.execute("SELECT * FROM subtasks WHERE id=%s", (sid,)); row = cur.fetchone(); conn.commit()
    finally:
        release_db(conn)
    return jsonify(row_to_dict(row))


@bp.route('/api/tasks/<tid>/subtasks/<sid>', methods=['DELETE'])
def delete_subtask(tid, sid):
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM subtasks WHERE id=%s", (sid,)); conn.commit()
    finally:
        release_db(conn)
    return '', 204


# ── Reorder + convenience routes ───────────────────────────────
@bp.route('/api/tasks/reorder', methods=['POST'])
def reorder_tasks():
    data = request.get_json(); conn = get_db()
    try:
        cur = conn.cursor()
        for item in data:
            cur.execute("UPDATE tasks SET position=%s,status=%s,updated_at=NOW() WHERE id=%s",
                        (item['position'], item['status'], item['id']))
        conn.commit()
    finally:
        release_db(conn)
    return jsonify({'ok': True})


@bp.route('/api/tasks/today', methods=['GET'])
def get_today():
    return jsonify(_fetch_tasks(
        "SELECT * FROM tasks WHERE due_date=CURRENT_DATE AND status!='done' ORDER BY due_time,position"))

@bp.route('/api/tasks/upcoming', methods=['GET'])
def get_upcoming():
    return jsonify(_fetch_tasks(
        "SELECT * FROM tasks WHERE due_date>=CURRENT_DATE AND due_date<=CURRENT_DATE+INTERVAL '7 days' AND status!='done' ORDER BY due_date,due_time"))

@bp.route('/api/tasks/overdue', methods=['GET'])
def get_overdue():
    return jsonify(_fetch_tasks(
        "SELECT * FROM tasks WHERE due_date<CURRENT_DATE AND status!='done' ORDER BY due_date,due_time"))
