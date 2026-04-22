import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { api } from '../../api'
import { isOverdue, isToday, fmtTime } from '../../utils'
import { CompletionTrendChart } from './CompletionTrendChart'
import { StatusDonutChart } from './StatusDonutChart'
import {
  Sun, Flame, ChevronDown, ChevronUp, ArrowRight, Plus, Clock,
  CheckCircle2, ListTodo, Target,
} from 'lucide-react'

function getGreeting(name) {
  const h = new Date().getHours()
  const base = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${base}, ${name}` : base
}

function getDateStr() {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase()
}

function formatUpNextWhen(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function DashTaskRow({ task, onToggle, overdue, isLast }) {
  const { state, dispatch } = useApp()
  const project = state.projects.find(p => p.id === task.project_id)
  const done = task.status === 'done'

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors
        hover:bg-td-surface/30 dark:hover:bg-tn-surface/20
        ${!isLast ? 'border-b border-td-border/30 dark:border-tn-border/30' : ''}`}
    >
      <button
        onClick={() => onToggle(task.id, task.status)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
          ${done
            ? 'border-td-green dark:border-tn-green bg-td-green/20 dark:bg-tn-green/20'
            : 'border-td-muted/40 dark:border-tn-muted/40 hover:border-td-blue dark:hover:border-tn-blue'
          }`}
        aria-label="Toggle task"
      >
        {done && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3 5.5L8 1" stroke="#9ece6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
      >
        <p className={`text-sm truncate ${done ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {project && (
            <span className="text-[11px] flex items-center gap-1" style={{ color: project.color }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {task.due_time && (
            <span className="text-[11px] text-td-muted dark:text-tn-muted flex items-center gap-1">
              <Clock size={9} />{fmtTime(task.due_time)}
            </span>
          )}
          {(task.tags || []).map(tag => (
            <span key={tag} className="text-[11px] text-td-purple dark:text-tn-purple">@{tag}</span>
          ))}
          {overdue && (
            <span className="text-[11px] text-td-red dark:text-tn-red font-medium">overdue</span>
          )}
        </div>
      </div>
    </div>
  )
}

function MomentumPace({ activityData, streak }) {
  const { thisWeek, lastWeek } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dayCount = (offsetDays) => {
      const d = new Date(today); d.setDate(today.getDate() - offsetDays)
      const iso = d.toISOString().slice(0, 10)
      return (activityData || []).find(e => e.date === iso)?.count || 0
    }
    return {
      thisWeek: [6, 5, 4, 3, 2, 1, 0].map(dayCount),
      lastWeek: [13, 12, 11, 10, 9, 8, 7].map(dayCount),
    }
  }, [activityData])

  const thisTotal = thisWeek.reduce((a, b) => a + b, 0)
  const lastTotal = lastWeek.reduce((a, b) => a + b, 0)
  const delta = thisTotal - lastTotal
  const up = delta >= 0
  const max = Math.max(...thisWeek, ...lastWeek, 1)

  return (
    <div className="p-4">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-semibold text-td-fg dark:text-tn-fg tracking-tight">{thisTotal}</span>
        <span className="text-sm text-td-muted dark:text-tn-muted">done this week</span>
      </div>
      <div className="flex items-center gap-3 mb-4 text-xs">
        <span className={`font-semibold ${up ? 'text-td-green dark:text-tn-green' : 'text-td-red dark:text-tn-red'}`}>
          {up ? '▲' : '▼'} {Math.abs(delta)} vs last week
        </span>
        {streak > 0 && (
          <span className="text-td-muted dark:text-tn-muted">· {streak}-day streak</span>
        )}
      </div>
      <div className="space-y-2">
        <PaceRow label="This wk" values={thisWeek} max={max} highlight total={thisTotal} />
        <PaceRow label="Last wk" values={lastWeek} max={max} total={lastTotal} />
      </div>
    </div>
  )
}

function PaceRow({ label, values, max, highlight, total }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-td-muted dark:text-tn-muted w-12 shrink-0">{label}</span>
      <div className="flex-1 flex items-end gap-0.5 h-5">
        {values.map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${highlight ? 'bg-td-green dark:bg-tn-green' : 'bg-td-muted/20 dark:bg-tn-muted/20'}`}
            style={{ height: `${Math.max(2, (v / max) * 20)}px` }}
          />
        ))}
      </div>
      <span className={`text-xs w-5 text-right tabular-nums ${highlight ? 'font-semibold text-td-fg dark:text-tn-fg' : 'text-td-muted dark:text-tn-muted'}`}>
        {total}
      </span>
    </div>
  )
}

function StatPill({ label, value, color }) {
  const colorClass = {
    blue: 'text-td-blue dark:text-tn-blue',
    green: 'text-td-green dark:text-tn-green',
    amber: 'text-td-amber dark:text-tn-amber',
    purple: 'text-td-purple dark:text-tn-purple',
    red: 'text-td-red dark:text-tn-red',
  }[color] || 'text-td-blue dark:text-tn-blue'

  return (
    <div className="flex flex-col gap-0.5">
      <div className={`text-xl font-semibold ${colorClass}`}>{value}</div>
      <div className="text-[11px] text-td-muted dark:text-tn-muted">{label}</div>
    </div>
  )
}

export function DashboardView() {
  const { state, dispatch } = useApp()
  const { toggleTask } = useTasks()
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  useEffect(() => {
    api.getDashboardStats(30)
      .then(data => { setStats(data); setStatsLoading(false) })
      .catch(() => setStatsLoading(false))
  }, [])

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const { todayTasks, overdueTasks, upNextTasks } = useMemo(() => {
    const in3days = new Date(today); in3days.setDate(today.getDate() + 3)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    return {
      todayTasks: state.tasks.filter(t => isToday(t) && t.status !== 'done'),
      overdueTasks: state.tasks.filter(t => isOverdue(t)),
      upNextTasks: state.tasks
        .filter(t => {
          if (!t.due_date || t.status === 'done') return false
          const d = new Date(t.due_date + 'T00:00:00')
          return d >= tomorrow && d <= in3days
        })
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 5),
    }
  }, [state.tasks, today])

  const pendingOverdue = overdueTasks.filter(t => t.status !== 'done')
  const remaining = todayTasks.length + pendingOverdue.length
  const displayName = state.currentUser?.display_name || state.currentUser?.username || ''

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-4">

        <div className="mb-6">
          <div className="text-xs text-td-muted dark:text-tn-muted font-medium tracking-wide mb-1">
            {getDateStr()}
          </div>
          <h1 className="text-2xl font-semibold text-td-fg dark:text-tn-fg tracking-tight">
            {getGreeting(displayName)}
          </h1>
          <p className="text-sm text-td-muted dark:text-tn-muted mt-1.5">
            {remaining > 0 ? (
              <>
                <span className="text-td-fg dark:text-tn-fg font-medium">
                  {remaining} task{remaining !== 1 ? 's' : ''}
                </span>
                {' '}left today
                {pendingOverdue.length > 0 && (
                  <>, including{' '}
                    <span className="text-td-red dark:text-tn-red">{pendingOverdue.length} overdue</span>
                  </>
                )}
                .
              </>
            ) : (
              'All clear for today.'
            )}
          </p>
        </div>

        <section className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl border border-td-border/50 dark:border-tn-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-td-border/30 dark:border-tn-border/30">
            <div className="flex items-center gap-2">
              <Sun size={15} className="text-td-amber dark:text-tn-amber shrink-0" />
              <span className="text-sm font-semibold text-td-fg dark:text-tn-fg">Today</span>
              <span className="text-xs text-td-muted dark:text-tn-muted">
                {todayTasks.length + pendingOverdue.length} tasks
              </span>
            </div>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW', payload: 'today' })}
              className="flex items-center gap-1 text-xs text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors"
            >
              Open in Today <ArrowRight size={10} />
            </button>
          </div>

          {pendingOverdue.length > 0 && (
            <div className="border-b border-td-border/30 dark:border-tn-border/30">
              <div className="px-4 py-2 text-[10px] font-semibold text-td-red dark:text-tn-red tracking-widest bg-td-red/5 dark:bg-tn-red/5">
                OVERDUE · {pendingOverdue.length}
              </div>
              {pendingOverdue.map((task, i) => (
                <DashTaskRow
                  key={task.id}
                  task={task}
                  overdue
                  onToggle={toggleTask}
                  isLast={i === pendingOverdue.length - 1 && todayTasks.length === 0}
                />
              ))}
            </div>
          )}

          {todayTasks.length > 0 ? (
            todayTasks.map((task, i) => (
              <DashTaskRow
                key={task.id}
                task={task}
                onToggle={toggleTask}
                isLast={i === todayTasks.length - 1}
              />
            ))
          ) : pendingOverdue.length === 0 ? (
            <div className="px-4 py-8 text-center text-td-muted dark:text-tn-muted text-sm">
              Nothing due today
            </div>
          ) : null}

          <button
            onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true, status: 'todo' } })}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-td-muted dark:text-tn-muted
              hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/30 dark:hover:bg-tn-surface/20 transition-colors
              border-t border-td-border/30 dark:border-tn-border/30"
          >
            <Plus size={12} />
            Add task for today
          </button>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4">
          <section className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl border border-td-border/50 dark:border-tn-border/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-td-border/30 dark:border-tn-border/30">
              <div className="flex items-center gap-2">
                <ArrowRight size={13} className="text-td-muted dark:text-tn-muted shrink-0" />
                <span className="text-sm font-semibold text-td-fg dark:text-tn-fg">Up next</span>
              </div>
              <span className="text-xs text-td-muted dark:text-tn-muted">Next 3 days</span>
            </div>
            {upNextTasks.length > 0 ? (
              upNextTasks.map((task, i) => {
                const project = state.projects.find(p => p.id === task.project_id)
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                      hover:bg-td-surface/30 dark:hover:bg-tn-surface/20
                      ${i < upNextTasks.length - 1 ? 'border-b border-td-border/20 dark:border-tn-border/20' : ''}`}
                    onClick={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
                  >
                    <span className="text-xs text-td-muted dark:text-tn-muted w-16 shrink-0 tabular-nums">
                      {formatUpNextWhen(task.due_date)}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: project?.color || '#565f89' }} />
                    <span className="text-sm text-td-fg dark:text-tn-fg flex-1 truncate">{task.title}</span>
                    {project && (
                      <span className="text-[11px] text-td-muted dark:text-tn-muted shrink-0">{project.name}</span>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="px-4 py-6 text-center text-td-muted dark:text-tn-muted text-sm">
                Nothing coming up
              </div>
            )}
          </section>

          <section className="bg-td-bg2 dark:bg-tn-bg2 rounded-xl border border-td-border/50 dark:border-tn-border/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-td-border/30 dark:border-tn-border/30">
              <Flame size={14} className="text-td-amber dark:text-tn-amber shrink-0" />
              <span className="text-sm font-semibold text-td-fg dark:text-tn-fg">Momentum</span>
              <span className="flex-1" />
              <span className="text-xs text-td-muted dark:text-tn-muted">Last 2 weeks</span>
            </div>
            {statsLoading ? (
              <div className="p-4 text-center text-td-muted dark:text-tn-muted text-sm animate-pulse">
                Loading…
              </div>
            ) : (
              <MomentumPace
                activityData={stats?.activity_heatmap}
                streak={stats?.insights?.current_streak}
              />
            )}
          </section>
        </div>

        <div className="rounded-xl border border-td-border/40 dark:border-tn-border/40 overflow-hidden">
          <button
            onClick={() => setAnalyticsOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs text-td-muted dark:text-tn-muted
              hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/20 dark:hover:bg-tn-surface/10 transition-colors"
          >
            {analyticsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span className="font-medium">Analytics</span>
            {stats && (
              <>
                <span className="text-td-border/60 dark:text-tn-border/60">·</span>
                <span>{stats.counts.completed_period} completed</span>
                <span className="text-td-border/60 dark:text-tn-border/60">·</span>
                <span>{Math.round(stats.insights.completion_rate * 100)}% rate</span>
                <span className="text-td-border/60 dark:text-tn-border/60">·</span>
                <span>{stats.counts.overdue} overdue</span>
              </>
            )}
            <span className="flex-1" />
            <span>Last 30d</span>
          </button>

          {analyticsOpen && stats && (
            <div className="border-t border-td-border/30 dark:border-tn-border/30 animate-fade-in">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-td-border/20 dark:border-tn-border/20">
                <StatPill label="Completed (30d)" value={stats.counts.completed_period} color="green" />
                <StatPill label="Active Tasks" value={stats.counts.total_active} color="blue" />
                <StatPill label="Streak" value={`${stats.insights.current_streak}d`} color="amber" />
                <StatPill label="Completion Rate" value={`${Math.round(stats.insights.completion_rate * 100)}%`} color="purple" />
              </div>
              <div className="p-4 border-b border-td-border/20 dark:border-tn-border/20">
                <p className="text-[10px] font-semibold text-td-muted dark:text-tn-muted mb-3 uppercase tracking-widest">
                  Completion Trend
                </p>
                <div className="h-48">
                  <CompletionTrendChart data={stats.completion_trend} />
                </div>
              </div>
              <div className="p-4 border-b border-td-border/20 dark:border-tn-border/20">
                <p className="text-[10px] font-semibold text-td-muted dark:text-tn-muted mb-3 uppercase tracking-widest">
                  Status Distribution
                </p>
                <StatusDonutChart data={stats.counts.by_status} />
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-td-border/20 dark:divide-tn-border/20">
                <div className="p-4">
                  <p className="text-[10px] font-semibold text-td-muted dark:text-tn-muted mb-3 uppercase tracking-widest">
                    By Project
                  </p>
                  <div className="space-y-2.5">
                    {stats.projects.slice(0, 6).map(proj => (
                      <div key={proj.id} className="flex items-center gap-2">
                        <span className="text-xs text-td-fg dark:text-tn-fg w-24 truncate">{proj.name}</span>
                        <div className="flex-1 h-1.5 bg-td-surface dark:bg-tn-surface rounded-full overflow-hidden">
                          <div
                            className="h-full bg-td-blue dark:bg-tn-blue rounded-full"
                            style={{ width: `${proj.total > 0 ? (proj.completed / proj.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-td-muted dark:text-tn-muted tabular-nums w-10 text-right">
                          {proj.completed}/{proj.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[10px] font-semibold text-td-muted dark:text-tn-muted mb-3 uppercase tracking-widest">
                    Top Tags
                  </p>
                  <div className="space-y-1.5">
                    {stats.tags.slice(0, 8).map(tag => (
                      <div key={tag.tag} className="flex items-center justify-between">
                        <span className="text-xs text-td-purple dark:text-tn-purple">@{tag.tag}</span>
                        <span className="text-[11px] text-td-muted dark:text-tn-muted">{tag.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

