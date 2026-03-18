"""Dashboard statistics endpoint."""

import logging
from datetime import datetime, timedelta, date
from collections import defaultdict

import psycopg2.extras
from flask import Blueprint, request, jsonify, g

from lib.db import get_db, release_db, row_to_dict

logger = logging.getLogger(__name__)

bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


def _vis():
    """Return (sql, params) to filter tasks visible to the current user."""
    uid = getattr(g, 'user_id', None)
    if not uid:
        return '', []
    return (
        " AND (owner_id=%s OR assigned_to=%s OR project_id IN (SELECT id FROM projects WHERE shared=TRUE))",
        [uid, uid]
    )


@bp.route('/stats', methods=['GET'])
def get_dashboard_stats():
    """
    Compute dashboard statistics.
    Query params:
      - days: 7, 30, or 90 (default: 30)
      - today: YYYY-MM-DD (optional, defaults to server's today in UTC)
    """
    days = int(request.args.get('days', 30))
    if days not in [7, 30, 90]:
        days = 30

    # Accept client's "today" to avoid timezone issues
    today_str = request.args.get('today')
    if today_str:
        try:
            today = datetime.strptime(today_str, '%Y-%m-%d').date()
        except ValueError:
            today = date.today()
    else:
        today = date.today()

    conn = get_db()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Calculate date range
        start_date = today - timedelta(days=days - 1)

        # ── Counts ─────────────────────────────────────────────────
        v, vp = _vis()

        # Total active tasks (not done)
        cur.execute("SELECT COUNT(*) FROM tasks WHERE status != 'done'" + v, vp)
        total_active = cur.fetchone()['count']

        # Completed in last N days
        cur.execute(
            "SELECT COUNT(*) FROM tasks WHERE status = 'done' AND updated_at >= %s" + v,
            [start_date] + vp)
        completed_period = cur.fetchone()['count']

        # Due today
        cur.execute(
            "SELECT COUNT(*) FROM tasks WHERE due_date = %s AND status != 'done'" + v,
            [today] + vp)
        due_today = cur.fetchone()['count']

        # Overdue
        cur.execute(
            "SELECT COUNT(*) FROM tasks WHERE due_date < %s AND status != 'done'" + v,
            [today] + vp)
        overdue = cur.fetchone()['count']

        # By status
        cur.execute("SELECT status, COUNT(*) as count FROM tasks WHERE TRUE" + v + " GROUP BY status", vp)
        by_status = {row['status']: row['count'] for row in cur.fetchall()}

        # ── Completion Trend ───────────────────────────────────────
        # Tasks completed per day + created per day
        cur.execute(
            "SELECT DATE(updated_at) as date, COUNT(*) as count FROM tasks"
            " WHERE status = 'done' AND updated_at >= %s" + v +
            " GROUP BY DATE(updated_at) ORDER BY date",
            [start_date] + vp)
        completed_by_date = {row['date'].isoformat(): row['count'] for row in cur.fetchall()}

        cur.execute(
            "SELECT DATE(created_at) as date, COUNT(*) as count FROM tasks"
            " WHERE created_at >= %s" + v +
            " GROUP BY DATE(created_at) ORDER BY date",
            [start_date] + vp)
        created_by_date = {row['date'].isoformat(): row['count'] for row in cur.fetchall()}

        # Build full time series with all dates
        completion_trend = []
        current = start_date
        while current <= today:
            date_str = current.isoformat()
            completion_trend.append({
                'date': date_str,
                'completed': completed_by_date.get(date_str, 0),
                'created': created_by_date.get(date_str, 0)
            })
            current += timedelta(days=1)

        # ── Activity Heatmap ───────────────────────────────────────
        # For heatmap, get all completion dates in the period
        cur.execute(
            "SELECT DATE(updated_at) as date, COUNT(*) as count FROM tasks"
            " WHERE status = 'done' AND updated_at >= %s" + v +
            " GROUP BY DATE(updated_at)",
            [start_date] + vp)
        activity_heatmap = [
            {'date': row['date'].isoformat(), 'count': row['count']}
            for row in cur.fetchall()
        ]

        # ── Projects ───────────────────────────────────────────────
        # For the JOIN query, qualify visibility columns with t.
        vj, vjp = '', []
        uid = getattr(g, 'user_id', None)
        if uid:
            vj = (" AND (t.owner_id=%s OR t.assigned_to=%s OR t.project_id IN "
                   "(SELECT id FROM projects WHERE shared=TRUE))")
            vjp = [uid, uid]
        cur.execute(
            "SELECT COALESCE(p.id, t.project_id) as id,"
            " COALESCE(p.name, 'No Project') as name,"
            " COUNT(*) as total,"
            " SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed"
            " FROM tasks t LEFT JOIN projects p ON p.id = t.project_id"
            " WHERE TRUE" + vj +
            " GROUP BY COALESCE(p.id, t.project_id), COALESCE(p.name, 'No Project')"
            " ORDER BY total DESC",
            vjp)
        projects = [
            {
                'id': row['id'] or 'none',
                'name': row['name'],
                'total': row['total'],
                'completed': row['completed']
            }
            for row in cur.fetchall()
        ]

        # ── Tags ───────────────────────────────────────────────────
        cur.execute("SELECT tags FROM tasks WHERE tags IS NOT NULL AND tags != '[]'" + v, vp)
        tag_counts = defaultdict(int)
        for row in cur.fetchall():
            tags = row['tags']
            if isinstance(tags, str):
                import json
                tags = json.loads(tags)
            for tag in tags:
                tag_counts[tag] += 1

        tags = [
            {'tag': tag, 'count': count}
            for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)
        ][:15]  # Top 15 tags

        # ── Insights ───────────────────────────────────────────────
        # Current streak (consecutive days with completions)
        cur.execute(
            "SELECT DISTINCT DATE(updated_at) as date FROM tasks"
            " WHERE status = 'done' AND updated_at >= %s" + v +
            " ORDER BY date DESC",
            [today - timedelta(days=365)] + vp)
        completion_dates = [row['date'] for row in cur.fetchall()]

        current_streak = 0
        if completion_dates:
            check_date = today
            for comp_date in completion_dates:
                if comp_date == check_date:
                    current_streak += 1
                    check_date -= timedelta(days=1)
                elif comp_date < check_date:
                    break

        # Longest streak
        longest_streak = 0
        streak = 0
        prev_date = None
        for comp_date in sorted(completion_dates):
            if prev_date is None or comp_date == prev_date + timedelta(days=1):
                streak += 1
                longest_streak = max(longest_streak, streak)
            else:
                streak = 1
            prev_date = comp_date

        # Average per day
        avg_per_day = round(completed_period / days, 1) if days > 0 else 0

        # Best day of week (0=Mon, 6=Sun)
        cur.execute(
            "SELECT EXTRACT(DOW FROM updated_at) as dow, COUNT(*) as count FROM tasks"
            " WHERE status = 'done' AND updated_at >= %s" + v +
            " GROUP BY dow ORDER BY count DESC LIMIT 1",
            [start_date] + vp)
        best_day_row = cur.fetchone()
        if best_day_row:
            dow_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            # PostgreSQL DOW: 0=Sunday, 1=Monday, ..., 6=Saturday
            dow = int(best_day_row['dow'])
            best_day = dow_names[(dow - 1) % 7]
        else:
            best_day = None

        # Completion rate (this period)
        total_tasks_period = len([t for t in completion_trend])
        completed_in_period = sum(t['completed'] for t in completion_trend)
        created_in_period = sum(t['created'] for t in completion_trend)
        completion_rate = round(completed_in_period / created_in_period, 2) if created_in_period > 0 else 0

        insights = {
            'current_streak': current_streak,
            'longest_streak': longest_streak,
            'avg_per_day': avg_per_day,
            'best_day': best_day,
            'completion_rate': completion_rate
        }

        # ── Response ───────────────────────────────────────────────
        return jsonify({
            'counts': {
                'total_active': total_active,
                'completed_period': completed_period,
                'due_today': due_today,
                'overdue': overdue,
                'by_status': by_status
            },
            'completion_trend': completion_trend,
            'activity_heatmap': activity_heatmap,
            'projects': projects,
            'tags': tags,
            'insights': insights
        })

    finally:
        release_db(conn)
