"""Task, subtask, and reorder routes."""

import json, logging, uuid
from datetime import datetime, date, timezone

import psycopg2.extras
from flask import Blueprint, request, jsonify, g

from lib.db import get_db, release_db, row_to_dict
from lib.nlp import parse_natural_language, next_due_date
from lib.gcal import gcal_upsert, gcal_delete, gcal_save, GCAL_CALENDAR_ID, is_enabled as gcal_is_enabled

logger = logging.getLogger(__name__)

bp = Blueprint('tasks', __name__)

# ── Helper ─────────────────────────────────────────────────────
def _visibility_clause(user_id):
    """Return (sql_fragment, params) restricting tasks to those visible to user_id."""
    if not user_id:
        return '', []
    return (
        " AND (t.owner_id=%s OR t.assigned_to=%s OR t.project_id IN "
        "(SELECT id FROM projects WHERE shared=TRUE))",
        [user_id, user_id]
    )


def _fetch_tasks(query, params=()):
    """Execute query, injecting user visibility filter before any ORDER BY."""
    user_id = getattr(g, 'user_id', None)
    vis_sql, vis_params = _visibility_clause(user_id)
    if vis_sql:
        # Insert visibility clause before ORDER BY (or at end if no ORDER BY)
        q = query.replace('FROM tasks', 'FROM tasks t').replace('SELECT *', 'SELECT t.*')
        order_idx = q.upper().rfind(' ORDER BY ')
        if order_idx != -1:
            q = q[:order_idx] + vis_sql + q[order_idx:]
        else:
            q += vis_sql
    else:
        q = query
    all_params = list(params) + vis_params
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(q, all_params)
        tasks = [row_to_dict(r) for r in cur.fetchall()]
        if not tasks:
            return tasks
        task_ids = [t['id'] for t in tasks]
        cur.execute("""
            SELECT s.*, lt.title AS linked_task_title, lt.status AS linked_task_status
            FROM subtasks s
            LEFT JOIN tasks lt ON lt.id = s.linked_task_id
            WHERE s.task_id = ANY(%s) ORDER BY s.task_id, s.position
        """, (task_ids,))
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
                               due_date, due_time, tags, position, recurrence, recurrence_end, parent_task_id,
                               owner_id)
            VALUES (%s,%s,%s,%s,'todo',%s,%s,%s,%s,%s,%s,%s,%s)
        """, (new_id, task['title'], task.get('description', ''), task['project_id'],
              next_date.isoformat(), task.get('due_time'),
              json.dumps(task.get('tags', [])), max_pos + 1,
              task.get('recurrence'), task.get('recurrence_end'),
              task.get('parent_task_id') or task['id'],
              task.get('owner_id')))
        cur.execute("SELECT * FROM tasks WHERE id=%s", (new_id,))
        new_task = row_to_dict(cur.fetchone())
        new_task['subtasks'] = []
        conn.commit()
    finally:
        release_db(conn)
    return new_task


# ── NLP parse endpoint ─────────────────────────────────────────
@bp.route('/api/nlp/parse', methods=['POST', 'OPTIONS'])
def nlp_parse():
    if request.method == 'OPTIONS': return '', 204
    data = request.get_json() or {}
    result = parse_natural_language(data.get('text', ''))
    return jsonify(result)


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
    tags           = data.get('tags', nlp.get('labels', []))
    due_date       = data.get('due_date', nlp.get('due_date'))
    due_time       = data.get('due_time', nlp.get('due_time'))
    status         = data.get('status', 'todo')
    project_id     = data.get('project_id', 'inbox')
    recurrence     = data.get('recurrence', nlp.get('recurrence'))
    recurrence_end = data.get('recurrence_end')
    assigned_to    = data.get('assigned_to')
    links          = data.get('links', [])
    description = data.get('description', '')

    # Single transaction: project lookup/creation + task insert
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        assign_username = nlp.get('assigned_to_username')
        if assign_username and not assigned_to:
            cur.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s)", (assign_username,))
            urow = cur.fetchone()
            if urow: assigned_to = urow['id']
        pname = nlp.get('project_name')
        if pname:
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
        cur.execute("SELECT COALESCE(MAX(position),0) FROM tasks WHERE project_id=%s AND status=%s",
                    (project_id, status))
        max_pos = cur.fetchone()['coalesce']
        owner_id = getattr(g, 'user_id', None)
        if not assigned_to: assigned_to = owner_id
        cur.execute("""INSERT INTO tasks (id,title,description,project_id,status,due_date,due_time,tags,position,recurrence,recurrence_end,links,owner_id,assigned_to)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (tid, title, description, project_id, status, due_date, due_time,
             json.dumps(tags), max_pos + 1, recurrence, recurrence_end, json.dumps(links), owner_id, assigned_to))
        cur.execute("SELECT * FROM tasks WHERE id=%s", (tid,))
        task = row_to_dict(cur.fetchone())
        task['subtasks'] = []
        conn.commit()
    finally:
        release_db(conn)

    if nlp.get('nlp_summary'): task['nlp_summary'] = nlp['nlp_summary']
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
        cur.execute("""
            SELECT s.*, lt.title AS linked_task_title, lt.status AS linked_task_status
            FROM subtasks s
            LEFT JOIN tasks lt ON lt.id = s.linked_task_id
            WHERE s.task_id=%s ORDER BY s.position
        """, (tid,))
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
        old_status = t.get('status')
        for f in ['title','description','project_id','status','due_date','due_time','position','recurrence','recurrence_end','assigned_to']:
            if f in data: t[f] = data[f]
        if 'tags'  in data: t['tags']  = json.dumps(data['tags'])
        if 'links' in data: t['links'] = json.dumps(data['links'])
        if data.get('status') == 'done' and old_status != 'done':
            t['completed_at'] = datetime.now(timezone.utc)
        elif data.get('status') and data['status'] != 'done':
            t['completed_at'] = None
        tags_val  = t['tags']  if isinstance(t['tags'],  str) else json.dumps(t['tags'])
        links_val = t.get('links', '[]')
        links_val = links_val if isinstance(links_val, str) else json.dumps(links_val)
        cur.execute("""UPDATE tasks SET title=%s,description=%s,project_id=%s,status=%s,
            due_date=%s,due_time=%s,tags=%s,position=%s,completed_at=%s,recurrence=%s,recurrence_end=%s,links=%s,assigned_to=%s,updated_at=NOW() WHERE id=%s""",
            (t['title'], t['description'], t['project_id'], t['status'],
             t['due_date'], t['due_time'], tags_val, t['position'], t.get('completed_at'),
             t.get('recurrence'), t.get('recurrence_end'), links_val, t.get('assigned_to'), tid))
        # Reset reminder if the due date or time changed so a fresh reminder fires
        if any(f in data for f in ('due_date', 'due_time')):
            cur.execute("UPDATE tasks SET reminder_sent_at = NULL WHERE id = %s", (tid,))
        cur.execute("SELECT * FROM tasks WHERE id=%s", (tid,))
        result = row_to_dict(cur.fetchone())
        cur.execute("""
            SELECT s.*, lt.title AS linked_task_title, lt.status AS linked_task_status
            FROM subtasks s
            LEFT JOIN tasks lt ON lt.id = s.linked_task_id
            WHERE s.task_id=%s ORDER BY s.position
        """, (tid,))
        result['subtasks'] = [row_to_dict(s) for s in cur.fetchall()]
        conn.commit()
    finally:
        release_db(conn)
    # Recurrence clone on complete
    if data.get('status') == 'done' and result.get('recurrence'):
        _dd = result.get('due_date');       from_date = (_dd if isinstance(_dd, date) else date.fromisoformat(str(_dd))) if _dd else date.today()
        _re = result.get('recurrence_end'); rec_end   = (_re if isinstance(_re, date) else date.fromisoformat(str(_re))) if _re else None
        next_d    = next_due_date(result['recurrence'], from_date)
        if next_d and (rec_end is None or next_d <= rec_end):
            new_task = _clone_recurring_task(result, next_d)
            try:
                if new_task.get('due_date'):
                    eid = gcal_upsert(new_task)
                    if eid: gcal_save(new_task['id'], eid)
            except Exception:
                pass  # gcal failure must not block recurrence
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
        cur.execute("SELECT gcal_event_id FROM tasks WHERE id=%s", (tid,))
        row = cur.fetchone()
        if not row: return jsonify({'error': 'Not found'}), 404
        if row['gcal_event_id']: gcal_delete(row['gcal_event_id'])
        cur.execute("DELETE FROM subtasks WHERE task_id=%s", (tid,))
        cur.execute("DELETE FROM tasks WHERE id=%s", (tid,)); conn.commit()
    finally:
        release_db(conn)
    return '', 204


# ── Subtask routes ─────────────────────────────────────────────
@bp.route('/api/tasks/<tid>/subtasks', methods=['POST'])
def add_subtask(tid):
    data = request.get_json(); sid = str(uuid.uuid4())
    linked_task_id = data.get('linked_task_id')
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if linked_task_id:
            cur.execute("SELECT title FROM tasks WHERE id=%s", (linked_task_id,))
            linked = cur.fetchone()
            if not linked: return jsonify({'error': 'Linked task not found'}), 404
            title = linked['title']
            nlp = {}
        else:
            nlp = parse_natural_language(data.get('title', '').strip())
            title = nlp.get('title') or data.get('title', '')
        cur.execute("SELECT COALESCE(MAX(position),0) FROM subtasks WHERE task_id=%s", (tid,))
        max_pos = cur.fetchone()['coalesce']
        cur.execute("""INSERT INTO subtasks (id, task_id, title, position, due_date, due_time, labels, linked_task_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (sid, tid, title, max_pos + 1,
             nlp.get('due_date'), nlp.get('due_time'), json.dumps(nlp.get('labels', [])),
             linked_task_id))
        # Return the full parent task so frontend can update in one dispatch
        cur.execute("SELECT * FROM tasks WHERE id=%s", (tid,))
        task = row_to_dict(cur.fetchone())
        cur.execute("""
            SELECT s.*, lt.title AS linked_task_title, lt.status AS linked_task_status
            FROM subtasks s
            LEFT JOIN tasks lt ON lt.id = s.linked_task_id
            WHERE s.task_id=%s ORDER BY s.position
        """, (tid,))
        task['subtasks'] = [row_to_dict(s) for s in cur.fetchall()]
        conn.commit()
    finally:
        release_db(conn)
    return jsonify(task), 201


@bp.route('/api/tasks/<tid>/subtasks/<sid>', methods=['PATCH'])
def update_subtask(tid, sid):
    data = request.get_json(); conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        _ALLOWED_SUBTASK_FIELDS = ('title', 'due_date', 'due_time')
        for f in _ALLOWED_SUBTASK_FIELDS:
            if f in data: cur.execute(f"UPDATE subtasks SET {f}=%s WHERE id=%s", (data[f], sid))
        if 'completed' in data:
            cur.execute("UPDATE subtasks SET completed=%s WHERE id=%s", (bool(data['completed']), sid))
            if bool(data['completed']):
                cur.execute("SELECT linked_task_id FROM subtasks WHERE id=%s", (sid,))
                sub_row = cur.fetchone()
                if sub_row and sub_row['linked_task_id']:
                    cur.execute("UPDATE tasks SET status='done', completed_at=NOW(), updated_at=NOW() WHERE id=%s",
                                (sub_row['linked_task_id'],))
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
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT id FROM subtasks WHERE id=%s", (sid,))
        if not cur.fetchone(): return jsonify({'error': 'Not found'}), 404
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
            cur.execute("SELECT status FROM tasks WHERE id=%s", (item['id'],))
            row = cur.fetchone()
            old_status = row['status'] if row else None
            new_status = item['status']
            if new_status == 'done' and old_status != 'done':
                cur.execute("UPDATE tasks SET position=%s,status=%s,completed_at=NOW(),updated_at=NOW() WHERE id=%s",
                            (item['position'], new_status, item['id']))
            elif new_status != 'done' and old_status == 'done':
                cur.execute("UPDATE tasks SET position=%s,status=%s,completed_at=NULL,updated_at=NOW() WHERE id=%s",
                            (item['position'], new_status, item['id']))
            else:
                cur.execute("UPDATE tasks SET position=%s,status=%s,updated_at=NOW() WHERE id=%s",
                            (item['position'], new_status, item['id']))
        conn.commit()
    finally:
        release_db(conn)
    return jsonify({'ok': True})


@bp.route('/api/tasks/search', methods=['GET'])
def search_tasks():
    q = request.args.get('q', '').strip()
    exclude = request.args.get('exclude', '')
    if len(q) < 2:
        return jsonify([])
    user_id = getattr(g, 'user_id', None)
    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        params = [f'%{q}%']
        sql = "SELECT id, title, status, project_id FROM tasks WHERE title ILIKE %s AND status != 'done'"
        if exclude:
            sql += " AND id != %s"
            params.append(exclude)
        if user_id:
            sql += (" AND (owner_id=%s OR assigned_to=%s OR project_id IN "
                    "(SELECT id FROM projects WHERE shared=TRUE))")
            params += [user_id, user_id]
        sql += " ORDER BY updated_at DESC LIMIT 8"
        cur.execute(sql, params)
        return jsonify([dict(r) for r in cur.fetchall()])
    finally:
        release_db(conn)


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


@bp.route('/api/tags', methods=['GET'])
def get_all_tags():
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT jsonb_array_elements_text(tags::jsonb) AS tag FROM tasks WHERE tags IS NOT NULL AND tags != '[]' ORDER BY tag")
        return jsonify([row[0] for row in cur.fetchall()])
    finally:
        release_db(conn)
