import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { isOverdue, isToday } from '../../utils'
import { TaskList } from '../tasks/TaskList'
import { KanbanBoard } from '../tasks/KanbanBoard'
import { CalendarView } from '../calendar/CalendarView'
import { DashboardView } from '../dashboard/DashboardView'
import { LayoutList, Columns, Search, X, ChevronDown, Inbox, Sun, Layers, CalendarDays, AlertCircle, SlidersHorizontal } from 'lucide-react'
import { ProjectIcon } from '../shared/ProjectIcon'
import { PriorityTodayView } from '../tasks/PriorityTodayView'

function ViewHeader({ title, icon: Icon, count, onSearch, searchOpen, setSearchOpen, searchScope, setSearchScope }) {
  const { state, dispatch } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef(null)

  const project = state.view.startsWith('project:')
    ? state.projects.find(p => p.id === state.view.replace('project:', ''))
    : null

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [setSearchOpen])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
    onSearch('')
  }, [setSearchOpen, onSearch])

  // When searchOpen flips true externally (keyboard shortcut), focus input
  const prevOpen = useRef(false)
  if (searchOpen && !prevOpen.current) {
    setTimeout(() => inputRef.current?.focus(), 50)
  }
  prevOpen.current = searchOpen

  const handleChange = (e) => {
    setSearchQuery(e.target.value)
    onSearch(e.target.value)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') closeSearch()
  }

  // Only show scope toggle when not already in "all" view
  const showScopeToggle = searchOpen && state.view !== 'all'

  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-td-border/50 dark:border-tn-border/50 shrink-0 gap-2">
      {searchOpen ? (
        /* Expanded search bar */
        <div className="flex-1 flex items-center gap-2 bg-td-surface dark:bg-tn-surface rounded-lg px-3 py-1.5">
          <Search size={14} className="text-td-muted dark:text-tn-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks…"
            className="flex-1 bg-transparent text-td-fg dark:text-tn-fg text-sm outline-none placeholder-td-muted/40 dark:placeholder-tn-muted/40 min-w-0"
          />
          {showScopeToggle && (
            <button
              onClick={() => setSearchScope(s => s === 'view' ? 'all' : 'view')}
              title={searchScope === 'all' ? 'Searching all tasks — click for current view' : 'Searching current view — click for all tasks'}
              className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors whitespace-nowrap
                ${searchScope === 'all'
                  ? 'bg-td-blue/15 dark:bg-tn-blue/15 text-td-blue dark:text-tn-blue border-td-blue/30 dark:border-tn-blue/30'
                  : 'text-td-muted dark:text-tn-muted border-td-border dark:border-tn-border hover:text-td-fg dark:hover:text-tn-fg'}`}
            >
              {searchScope === 'all' ? 'All tasks' : 'This view'}
            </button>
          )}
          <button onClick={closeSearch} className="p-3 -my-3 -mr-1 text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg active:text-td-fg dark:active:text-tn-fg transition-colors shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        /* Normal title */
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          {project ? (
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: project.color + '25' }}>
              <ProjectIcon icon={project.icon} size={14} />
            </span>
          ) : Icon && (
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted">
              <Icon size={14} />
            </span>
          )}
          <h1 className="text-td-fg dark:text-tn-fg font-semibold text-base truncate">
            {project ? project.name : title}
          </h1>
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {!searchOpen && (
          <button
            onClick={openSearch}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg
              text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg
              hover:bg-td-surface dark:hover:bg-tn-surface active:bg-td-surface dark:active:bg-tn-surface
              transition-colors"
            title="Search tasks (/)"
          >
            <Search size={16} />
          </button>
        )}

        {state.view === 'calendar' && !searchOpen && (
          <div className="flex items-center gap-0.5 bg-td-surface dark:bg-tn-surface rounded-lg p-0.5">
            {['month', 'week', 'day'].map(v => (
              <button
                key={v}
                onClick={() => dispatch({ type: 'SET_CAL_VIEW', payload: v })}
                className={`min-h-[40px] px-2 flex items-center rounded-md text-[11px] font-medium transition-colors capitalize
                  ${state.calView === v
                    ? 'bg-td-bg2 dark:bg-tn-bg2 text-td-fg dark:text-tn-fg shadow-sm'
                    : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg active:text-td-fg dark:active:text-tn-fg'}`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        )}
        {state.view !== 'calendar' && !searchOpen && (
          <div className="flex items-center gap-0.5 bg-td-surface dark:bg-tn-surface rounded-lg p-0.5">
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'list' })}
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md transition-colors
                ${state.viewMode === 'list'
                  ? 'bg-td-bg2 dark:bg-tn-bg2 text-td-fg dark:text-tn-fg shadow-sm'
                  : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg active:text-td-fg dark:active:text-tn-fg'}`}
            >
              <LayoutList size={15} />
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'board' })}
              className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md transition-colors
                ${state.viewMode === 'board'
                  ? 'bg-td-bg2 dark:bg-tn-bg2 text-td-fg dark:text-tn-fg shadow-sm'
                  : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg active:text-td-fg dark:active:text-tn-fg'}`}
            >
              <Columns size={15} />
            </button>
          </div>
        )}
      </div>
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
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
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
  { value: 'status', label: 'Status' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'project', label: 'Project' },
  { value: 'title', label: 'Title' },
  { value: 'created', label: 'Created' },
]

const GROUP_OPTIONS = [
  { value: 'status', label: 'Status' },
  { value: 'tags', label: 'Tags' },
  { value: 'none', label: 'None' },
]

function ListToolbar({ showDone, onToggleDone, sortBy, onSortBy, groupBy, onGroupBy }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-td-border/30 dark:border-tn-border/30 bg-td-bg dark:bg-tn-bg flex-wrap">
      {/* Hide/show done */}
      <button
        onClick={onToggleDone}
        className={`flex items-center gap-1.5 text-xs px-2.5 min-h-[40px] rounded-lg transition-colors
          ${showDone
            ? 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg'
            : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg active:text-td-fg dark:active:text-tn-fg'}`}
      >
        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors
          ${showDone ? 'bg-td-green dark:bg-tn-green border-td-green dark:border-tn-green' : 'border-td-muted/50 dark:border-tn-muted/50'}`}>
          {showDone && <span className="text-[8px] text-white font-bold">✓</span>}
        </span>
        Completed only
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
              text-xs pl-2.5 pr-6 min-h-[40px] rounded-lg outline-none cursor-pointer
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
              text-xs pl-2.5 pr-6 min-h-[40px] rounded-lg outline-none cursor-pointer
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

function FilterSheet({ showDone, onToggleDone, sortBy, onSortBy, groupBy, onGroupBy, onClose }) {
  const swipeStart = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[96] bg-black/40 animate-fade-in" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[97] animate-slide-up rounded-t-2xl shadow-e3 flex flex-col overflow-hidden
          bg-td-bg2 dark:bg-tn-bg2 border-t border-td-border dark:border-tn-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Grabber */}
        <div
          onTouchStart={e => { swipeStart.current = e.touches[0].clientY }}
          onTouchEnd={e => {
            const delta = e.changedTouches[0].clientY - (swipeStart.current ?? 0)
            swipeStart.current = null
            if (delta > 80) onClose()
          }}
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
        >
          <div className="w-10 h-1 rounded-full bg-td-border dark:bg-tn-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <span className="text-sm font-semibold text-td-fg dark:text-tn-fg">Filters &amp; Sort</span>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Controls */}
        <div className="px-4 pb-6 space-y-5">
          {/* Show done */}
          <button
            onClick={onToggleDone}
            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors border
              ${showDone
                ? 'bg-td-surface dark:bg-tn-surface border-td-border dark:border-tn-border text-td-fg dark:text-tn-fg'
                : 'border-td-border/40 dark:border-tn-border/40 bg-transparent text-td-muted dark:text-tn-muted'}`}
          >
            <span className="text-sm">Completed only</span>
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
              ${showDone ? 'bg-td-green dark:bg-tn-green border-td-green dark:border-tn-green' : 'border-td-muted/50 dark:border-tn-muted/50'}`}>
              {showDone && <span className="text-[8px] text-white font-bold">✓</span>}
            </span>
          </button>

          {/* Group by */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted block">Group by</label>
            <div className="flex gap-2">
              {GROUP_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => onGroupBy(o.value)}
                  className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg transition-colors border
                    ${groupBy === o.value
                      ? 'bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue border-td-blue/30 dark:border-tn-blue/30'
                      : 'bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted border-td-border/50 dark:border-tn-border/50'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort by */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted block">Sort by</label>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => onSortBy(o.value)}
                  className={`py-2 px-3 text-xs font-medium rounded-lg transition-colors border
                    ${sortBy === o.value
                      ? 'bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue border-td-blue/30 dark:border-tn-blue/30'
                      : 'bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted border-td-border/50 dark:border-tn-border/50'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
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
import { TaskListSkeleton } from '../tasks/TaskList'
import { KanbanSkeleton } from '../tasks/KanbanBoard'

export function MainContent() {
  const { state, dispatch } = useApp()
  const { loadAll } = useTasks()
  const { view, tasks, projects, viewMode, searchOpen: globalSearchOpen } = state
  const [showDone, setShowDone] = useState(() => {
    // 'td-show-done' was written under the old "show all completed" meaning (now inverted).
    // Use a new key so stale values don't flip the filter; clean up the old key on load.
    localStorage.removeItem('td-show-done')
    const saved = localStorage.getItem('td-filter-completed-only')
    return saved === null ? false : saved === 'true'
  })
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('td-sort-by') || 'status')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchScope, setSearchScope] = useState('view') // 'view' | 'all'

  // Sync global keyboard-triggered searchOpen into local state
  const prevGlobal = useRef(false)
  if (globalSearchOpen !== prevGlobal.current) {
    setSearchOpen(globalSearchOpen)
    if (!globalSearchOpen) setSearchQuery('')
    prevGlobal.current = globalSearchOpen
  }
  const [groupBy, setGroupBy] = useState(() => localStorage.getItem('td-group-by') || 'status')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const handleRefresh = useCallback(async () => { await loadAll() }, [loadAll])
  const { indicatorEl, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(handleRefresh)

  const toggleShowDone = () => setShowDone(v => {
    localStorage.setItem('td-filter-completed-only', String(!v))
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

  const { title, icon, baseTasks, emptyMessage } = useMemo(() => {
    if (view === 'inbox') return {
      title: 'Inbox', icon: Inbox,
      baseTasks: tasks.filter(t => t.project_id === 'inbox'),
      emptyMessage: 'Inbox is empty',
    }
    if (view === 'today') return {
      title: 'Today', icon: Sun,
      baseTasks: tasks.filter(t => isToday(t) || isOverdue(t)),
      emptyMessage: 'Nothing due today',
    }
    if (view === 'all') return {
      title: 'All Tasks', icon: Layers,
      baseTasks: tasks,
      emptyMessage: 'No tasks yet',
    }
    if (view === 'overdue') return {
      title: 'Overdue', icon: AlertCircle,
      baseTasks: tasks.filter(t => isOverdue(t)),
      emptyMessage: 'No overdue tasks',
    }
    if (view === 'calendar') return {
      title: 'Calendar', icon: CalendarDays,
      baseTasks: [],
      emptyMessage: '',
    }
    if (view.startsWith('project:')) {
      const pid = view.replace('project:', '')
      const project = projects.find(p => p.id === pid)
      return {
        title: project ? project.name : 'Project', icon: null,
        baseTasks: tasks.filter(t => t.project_id === pid),
        emptyMessage: 'No tasks in this project',
      }
    }
    return { title: 'Tasks', icon: null, baseTasks: tasks, emptyMessage: 'No tasks' }
  }, [view, tasks, projects])

  // Apply show/hide done + sort + search
  const visibleTasks = useMemo(() => {
    // Board view owns its own done toggle — always include done tasks so KanbanBoard can filter
    const skipDoneFilter = viewMode === 'board'
    // If searching across all tasks, start from full task list instead of view-filtered baseTasks
    const source = (searchQuery.trim() && searchScope === 'all') ? tasks : baseTasks
    let pool
    if (skipDoneFilter)      pool = source                                   // board filters itself
    else if (showDone)       pool = source.filter(t => t.status === 'done')  // only completed
    else                     pool = source.filter(t => t.status !== 'done')  // default: hide completed
    let result = sortBy !== 'status' ? sortTasks(pool, sortBy, projects) : pool
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      )
    }
    return result
  }, [baseTasks, tasks, showDone, sortBy, projects, searchQuery, searchScope, viewMode])

  const activeCount = useMemo(() =>
    baseTasks.filter(t => t.status !== 'done').length, [baseTasks])

  const showToolbar = viewMode === 'list' && view !== 'overdue' && view !== 'calendar' && view !== 'dashboard' && view !== 'today'
  const hasActiveFilters = !showDone || sortBy !== 'status' || groupBy !== 'status'
  const isCalendar = view === 'calendar'
  const isDashboard = view === 'dashboard'

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {!isDashboard && (
        <ViewHeader
          title={title}
          icon={icon}
          count={activeCount > 0 ? activeCount : null}
          onSearch={setSearchQuery}
          searchOpen={searchOpen}
          searchScope={searchScope}
          setSearchScope={setSearchScope}
          setSearchOpen={(v) => {
            setSearchOpen(v)
            dispatch({ type: 'SET_SEARCH_OPEN', payload: v })
            if (!v) { setSearchQuery(''); setSearchScope('view') }
          }}
        />
      )}

      {showToolbar && (
        <>
          {/* Desktop: inline toolbar */}
          <div className="hidden md:block">
            <ListToolbar
              showDone={showDone}
              onToggleDone={toggleShowDone}
              sortBy={sortBy}
              onSortBy={handleSortBy}
              groupBy={groupBy}
              onGroupBy={handleGroupBy}
            />
          </div>

          {/* Mobile: compact filter trigger */}
          <div className="md:hidden flex items-center gap-2 px-4 py-2 border-b border-td-border/30 dark:border-tn-border/30 bg-td-bg dark:bg-tn-bg">
            <button
              onClick={() => setFilterSheetOpen(true)}
              className={`flex items-center gap-1.5 text-xs px-2.5 min-h-[36px] rounded-lg transition-colors border
                ${hasActiveFilters
                  ? 'bg-td-blue/10 dark:bg-tn-blue/10 text-td-blue dark:text-tn-blue border-td-blue/30 dark:border-tn-blue/30'
                  : 'bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted border-td-border/50 dark:border-tn-border/50'}`}
            >
              <SlidersHorizontal size={13} />
              <span>Filter</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-td-blue dark:bg-tn-blue shrink-0" />
              )}
            </button>
          </div>
        </>
      )}

      {filterSheetOpen && (
        <FilterSheet
          showDone={showDone}
          onToggleDone={toggleShowDone}
          sortBy={sortBy}
          onSortBy={handleSortBy}
          groupBy={groupBy}
          onGroupBy={handleGroupBy}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}

      <div
        className={`flex-1 min-h-0 ${(isCalendar || isDashboard || viewMode === 'board') ? 'overflow-hidden flex flex-col' : 'overflow-y-auto overscroll-contain'}`}
        style={!(isCalendar || isDashboard || viewMode === 'board') ? { paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' } : undefined}
        onTouchStart={!(isCalendar || isDashboard || viewMode === 'board') ? onTouchStart : undefined}
        onTouchMove={!(isCalendar || isDashboard || viewMode === 'board') ? onTouchMove : undefined}
        onTouchEnd={!(isCalendar || isDashboard || viewMode === 'board') ? onTouchEnd : undefined}
      >
        {/* Pull to refresh indicator */}
        {!(isCalendar || isDashboard) && (
          <div ref={indicatorEl} className="flex items-center justify-center overflow-hidden transition-all duration-200" style={{ height: 0, opacity: 0 }}>
            <div className="flex flex-col items-center gap-1">
              <svg data-arrow width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-td-muted dark:text-tn-muted transition-transform duration-150">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
              <svg data-spinner width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-td-blue dark:text-tn-blue animate-spin" style={{ display: 'none' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          </div>
        )}
        {isDashboard ? (
          <DashboardView />
        ) : isCalendar ? (
          <CalendarView tasks={tasks} />
        ) : !state.tasksLoaded ? (
          viewMode === 'board' ? <KanbanSkeleton /> : <TaskListSkeleton />
        ) : view === 'overdue' ? (
          <OverdueView tasks={visibleTasks} />
        ) : view === 'today' && viewMode !== 'board' ? (
          <PriorityTodayView tasks={visibleTasks} />
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
