import { useMemo, useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { isOverdue, isToday } from '../../utils'
import { TaskList } from '../tasks/TaskList'
import { KanbanBoard } from '../tasks/KanbanBoard'
import { CalendarView } from '../calendar/CalendarView'
import { LayoutList, Columns, Menu, ChevronDown } from 'lucide-react'
import { ProjectIcon } from '../shared/ProjectIcon'

function ViewHeader({ title, count }) {
  const { state, dispatch } = useApp()

  const project = state.view.startsWith('project:')
    ? state.projects.find(p => p.id === state.view.replace('project:', ''))
    : null

  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
      <button
        onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: true })}
        className="md:hidden text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg mr-3 transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 flex items-center gap-2.5 min-w-0">
        {project && (
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: project.color + '25' }}>
            <ProjectIcon icon={project.icon} size={14} />
          </span>
        )}
        <h1 className="text-td-fg dark:text-tn-fg font-semibold text-base truncate">
          {project ? project.name : title}
        </h1>
        {count != null && null}
      </div>

      {state.view !== 'calendar' && (
      <div className="flex items-center gap-1 bg-td-surface dark:bg-tn-surface rounded-lg p-0.5">
          <button
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'list' })}
            className={`p-1.5 rounded-md transition-colors
              ${state.viewMode === 'list'
                ? 'bg-td-bg2 dark:bg-tn-bg2 text-td-fg dark:text-tn-fg shadow-sm'
                : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg'}`}
          >
            <LayoutList size={15} />
          </button>
          <button
            onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'board' })}
            className={`p-1.5 rounded-md transition-colors
              ${state.viewMode === 'board'
                ? 'bg-td-bg2 dark:bg-tn-bg2 text-td-fg dark:text-tn-fg shadow-sm'
                : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg'}`}
          >
            <Columns size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

function OverdueView({ tasks }) {
  const groups = useMemo(() => {
    const byDate = {}
    tasks.forEach(t => {
      const d = t.due_date || 'unknown'
      if (!byDate[d]) byDate[d] = []
      byDate[d].push(t)
    })
    return Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b))
  }, [tasks])

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-td-muted dark:text-tn-muted">
        <span className="text-4xl mb-3">✓</span>
        <p className="text-sm">No overdue tasks</p>
      </div>
    )
  }

  return (
    <div>
      {groups.map(([date, items]) => (
        <section key={date}>
          <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-td-bg dark:bg-tn-bg z-10">
            <span className="text-[10px] font-semibold tracking-widest text-td-red dark:text-tn-red uppercase">
              {date === 'unknown' ? 'No date' : new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full">{items.length}</span>
          </div>
          <div>{items.map(t => <TaskCard key={t.id} task={t} />)}</div>
        </section>
      ))}
    </div>
  )
}

const SORT_OPTIONS = [
  { value: 'status',   label: 'Status' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'project',  label: 'Project' },
  { value: 'title',    label: 'Title' },
  { value: 'created',  label: 'Created' },
]

const GROUP_OPTIONS = [
  { value: 'status', label: 'Status' },
  { value: 'tags',   label: 'Tags' },
  { value: 'none',   label: 'None' },
]

function ListToolbar({ showDone, onToggleDone, sortBy, onSortBy, groupBy, onGroupBy }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-td-border/30 dark:border-tn-border/30 bg-td-bg dark:bg-tn-bg flex-wrap">
      {/* Hide/show done */}
      <button
        onClick={onToggleDone}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors
          ${showDone
            ? 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg'
            : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg'}`}
      >
        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors
          ${showDone ? 'bg-td-green dark:bg-tn-green border-td-green dark:border-tn-green' : 'border-td-muted/50 dark:border-tn-muted/50'}`}>
          {showDone && <span className="text-[8px] text-white font-bold">✓</span>}
        </span>
        Show done
      </button>

      <div className="h-3.5 w-px bg-td-border dark:bg-tn-border" />

      {/* Group */}
      <div className="flex items-center gap-1.5 text-xs text-td-muted dark:text-tn-muted">
        <span>Group:</span>
        <div className="relative">
          <select
            value={groupBy}
            onChange={e => onGroupBy(e.target.value)}
            className="appearance-none bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg
              text-xs pl-2.5 pr-6 py-1 rounded-lg outline-none cursor-pointer
              border border-td-border/50 dark:border-tn-border/50"
          >
            {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-td-muted dark:text-tn-muted pointer-events-none" />
        </div>
      </div>

      <div className="h-3.5 w-px bg-td-border dark:bg-tn-border" />

      {/* Sort */}
      <div className="flex items-center gap-1.5 text-xs text-td-muted dark:text-tn-muted">
        <span>Sort:</span>
        <div className="relative">
          <select
            value={sortBy}
            onChange={e => onSortBy(e.target.value)}
            className="appearance-none bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg
              text-xs pl-2.5 pr-6 py-1 rounded-lg outline-none cursor-pointer
              border border-td-border/50 dark:border-tn-border/50"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-td-muted dark:text-tn-muted pointer-events-none" />
        </div>
      </div>
    </div>
  )
}

function sortTasks(tasks, sortBy, projects) {
  const sorted = [...tasks]
  switch (sortBy) {
    case 'due_date':
      return sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    case 'project': {
      const name = id => projects.find(p => p.id === id)?.name || 'zzz'
      return sorted.sort((a, b) => name(a.project_id).localeCompare(name(b.project_id)))
    }
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'created':
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    default: // status — preserve natural grouping
      return sorted
  }
}

import { TaskCard } from '../tasks/TaskCard'

export function MainContent() {
  const { state } = useApp()
  const { loadAll } = useTasks()
  const { view, tasks, projects, viewMode } = state
  const [showDone, setShowDone] = useState(() => {
    const saved = localStorage.getItem('td-show-done')
    return saved === null ? true : saved === 'true'
  })
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('td-sort-by') || 'status')
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem('td-group-by') || 'status')

  const handleRefresh = useCallback(async () => { await loadAll() }, [loadAll])
  const { indicatorEl, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(handleRefresh)

  const toggleShowDone = () => setShowDone(v => {
    localStorage.setItem('td-show-done', String(!v))
    return !v
  })
  const handleSortBy = (v) => {
    localStorage.setItem('td-sort-by', v)
    setSortBy(v)
  }
  const handleGroupBy = (v) => {
    localStorage.setItem('td-group-by', v)
    setGroupBy(v)
  }

  const { title, baseTasks, groupBy, emptyMessage } = useMemo(() => {
    if (view === 'inbox') return {
      title: 'Inbox',
      baseTasks: tasks.filter(t => t.project_id === 'inbox'),
      groupBy: 'status',
      emptyMessage: 'Inbox is empty',
    }
    if (view === 'today') return {
      title: 'Today',
      baseTasks: tasks.filter(t => isToday(t)),
      groupBy: 'status',
      emptyMessage: 'Nothing due today',
    }
    if (view === 'all') return {
      title: 'All Tasks',
      baseTasks: tasks,
      groupBy: 'status',
      emptyMessage: 'No tasks yet',
    }
    if (view === 'overdue') return {
      title: 'Overdue',
      baseTasks: tasks.filter(t => isOverdue(t)),
      groupBy: 'date',
      emptyMessage: 'No overdue tasks',
    }
    if (view.startsWith('project:')) {
      const pid = view.replace('project:', '')
      const project = projects.find(p => p.id === pid)
      return {
        title: project ? project.name : 'Project',
        baseTasks: tasks.filter(t => t.project_id === pid),
        groupBy: 'status',
        emptyMessage: 'No tasks in this project',
      }
    }
    return { title: 'Tasks', baseTasks: tasks, groupBy: 'status', emptyMessage: 'No tasks' }
  }, [view, tasks, projects])

  // Apply show/hide done + sort
  const visibleTasks = useMemo(() => {
    let result = showDone ? baseTasks : baseTasks.filter(t => t.status !== 'done')
    if (sortBy !== 'status') result = sortTasks(result, sortBy, projects)
    return result
  }, [baseTasks, showDone, sortBy, projects])

  const activeCount = useMemo(() =>
    baseTasks.filter(t => t.status !== 'done').length, [baseTasks])

  const showToolbar = viewMode === 'list' && view !== 'overdue' && view !== 'calendar'
  const isCalendar = view === 'calendar'

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      <ViewHeader title={title} count={activeCount > 0 ? activeCount : null} />

      {showToolbar && (
        <ListToolbar
          showDone={showDone}
          onToggleDone={toggleShowDone}
          sortBy={sortBy}
          onSortBy={handleSortBy}
          groupBy={groupBy}
          onGroupBy={handleGroupBy}
        />
      )}

      <div
        className={`flex-1 min-h-0 ${isCalendar ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
        style={!isCalendar ? { paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' } : undefined}
        onTouchStart={!isCalendar ? onTouchStart : undefined}
        onTouchMove={!isCalendar ? onTouchMove : undefined}
        onTouchEnd={!isCalendar ? onTouchEnd : undefined}
      >
        {/* Pull to refresh indicator */}
        {!isCalendar && (
          <div ref={indicatorEl} className="flex items-center justify-center overflow-hidden transition-all duration-200" style={{ height: 0, opacity: 0 }}>
            <div className="flex flex-col items-center gap-1">
              <svg data-arrow width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-td-muted dark:text-tn-muted transition-transform duration-150">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
              <svg data-spinner width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-td-blue dark:text-tn-blue animate-spin" style={{ display: 'none' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            </div>
          </div>
        )}
        {isCalendar ? (
          <CalendarView tasks={tasks} />
        ) : view === 'overdue' ? (
          <OverdueView tasks={visibleTasks} />
        ) : viewMode === 'board' ? (
          <KanbanBoard tasks={visibleTasks} />
        ) : (
          <TaskList
            tasks={visibleTasks}
            groupBy={groupBy === 'none' ? 'flat' : groupBy}
            emptyMessage={emptyMessage}
          />
        )}
      </div>
    </div>
  )
}
