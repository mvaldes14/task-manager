import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { isOverdue, isToday } from '../../utils'
import { TaskList } from '../tasks/TaskList'
import { KanbanBoard } from '../tasks/KanbanBoard'
import { TaskCard } from '../tasks/TaskCard'
import { CalendarView } from '../calendar/CalendarView'
import { LayoutList, Columns, Menu } from 'lucide-react'

function ViewHeader({ title, count }) {
  const { state, dispatch } = useApp()
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-tn-border/50 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: true })}
        className="md:hidden text-tn-muted hover:text-tn-fg mr-3 transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <h1 className="text-tn-fg font-semibold text-base truncate">{title}</h1>
        {count != null && (
          <span className="text-xs text-tn-muted/60">{count}</span>
        )}
      </div>

      {/* View mode toggle (list/board) — hide on calendar */}
      {state.view !== 'calendar' && (
        <div className="flex items-center gap-1 bg-tn-surface rounded-lg p-0.5">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'list' })}
            className={`p-1.5 rounded-md transition-colors
              ${state.viewMode === 'list' ? 'bg-tn-bg2 text-tn-fg shadow-sm' : 'text-tn-muted hover:text-tn-fg'}`}
          >
            <LayoutList size={15} />
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'board' })}
            className={`p-1.5 rounded-md transition-colors
              ${state.viewMode === 'board' ? 'bg-tn-bg2 text-tn-fg shadow-sm' : 'text-tn-muted hover:text-tn-fg'}`}
          >
            <Columns size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

function OverdueView({ tasks }) {
  // Group by date
  const groups = useMemo(() => {
    const byDate = {}
    tasks.forEach(t => {
      const d = t.due_date || 'unknown'
      if (!byDate[d]) byDate[d] = []
      byDate[d].push(t)
    })
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
  }, [tasks])

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-tn-muted">
        <span className="text-4xl mb-3">🎉</span>
        <p className="text-sm">No overdue tasks!</p>
      </div>
    )
  }

  return (
    <div>
      {groups.map(([date, items]) => {
        const d = new Date(date + 'T00:00:00')
        const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        return (
          <section key={date}>
            <div className="flex items-center gap-2 px-4 py-2 bg-tn-red/5 border-y border-tn-red/10">
              <span className="text-[10px] font-semibold tracking-wider text-tn-red uppercase">{label}</span>
              <span className="text-[10px] text-tn-red/60 bg-tn-red/10 px-1.5 rounded-full">{items.length}</span>
            </div>
            {items.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </section>
        )
      })}
    </div>
  )
}

export function MainContent() {
  const { state } = useApp()
  const { view, tasks, projects, viewMode } = state

  const { title, visibleTasks, groupBy, emptyMessage } = useMemo(() => {
    if (view === 'inbox') {
      return {
        title: 'Inbox',
        visibleTasks: tasks.filter(t => !t.project_id),
        groupBy: 'status',
        emptyMessage: 'Inbox is empty',
      }
    }
    if (view === 'today') {
      return {
        title: 'Today',
        visibleTasks: tasks.filter(t => isToday(t)),
        groupBy: 'status',
        emptyMessage: 'Nothing due today',
      }
    }
    if (view === 'upcoming') {
      const now = new Date(); now.setHours(0,0,0,0)
      const in7 = new Date(now); in7.setDate(now.getDate() + 7)
      return {
        title: 'Upcoming',
        visibleTasks: tasks.filter(t => {
          if (!t.due_date || t.status === 'done') return false
          const d = new Date(t.due_date + 'T00:00:00')
          return d > now && d <= in7
        }),
        groupBy: 'status',
        emptyMessage: 'Nothing upcoming in the next 7 days',
      }
    }
    if (view === 'all') {
      return {
        title: 'All Tasks',
        visibleTasks: tasks,
        groupBy: 'status',
        emptyMessage: 'No tasks yet',
      }
    }
    if (view === 'overdue') {
      return {
        title: '🔴 Overdue',
        visibleTasks: tasks.filter(t => isOverdue(t)),
        groupBy: 'date',
        emptyMessage: 'No overdue tasks',
      }
    }
    if (view.startsWith('project:')) {
      const pid = view.replace('project:', '')
      const project = projects.find(p => p.id === pid)
      return {
        title: project ? `${project.icon} ${project.name}` : 'Project',
        visibleTasks: tasks.filter(t => t.project_id === pid),
        groupBy: 'status',
        emptyMessage: 'No tasks in this project',
      }
    }
    return { title: 'Tasks', visibleTasks: tasks, groupBy: 'status', emptyMessage: 'No tasks' }
  }, [view, tasks, projects])

  const activeCount = useMemo(() =>
    visibleTasks.filter(t => t.status !== 'done').length, [visibleTasks])

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <ViewHeader
        title={title}
        count={activeCount > 0 ? activeCount : null}
      />

      <div className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        {view === 'calendar' ? (
          <CalendarView tasks={tasks} />
        ) : view === 'overdue' ? (
          <OverdueView tasks={visibleTasks} />
        ) : viewMode === 'board' ? (
          <KanbanBoard tasks={visibleTasks} />
        ) : (
          <TaskList tasks={visibleTasks} groupBy={groupBy} emptyMessage={emptyMessage} />
        )}
      </div>
    </div>
  )
}
