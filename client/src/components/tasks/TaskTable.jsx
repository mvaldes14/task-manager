import { useState, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { ProjectIcon } from '../shared/ProjectIcon'
import { Skeleton } from '../ui'
import { formatDate, fmtTime, isOverdue, priorityColor } from '../../utils'
import { STATUS_LABELS, STATUS_ORDER } from './grouping'
import { ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react'
import { TASK_DRAG_TYPE } from '../../constants/dnd'

// Mirrors KanbanBoard's column colours so a task reads the same in both modes.
const STATUS_COLORS = {
  todo:    '#565f89',
  doing:   '#89b4fa',
  blocked: '#f7768e',
  done:    '#9ece6a',
}

const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' }
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }
const STATUS_RANK = STATUS_ORDER.reduce((acc, s, i) => { acc[s] = i; return acc }, {})

const COLUMNS = [
  { key: 'title',    label: 'Task',     sortable: true,  width: 'w-[34%] min-w-[280px]' },
  { key: 'status',   label: 'Status',   sortable: true,  width: 'w-[130px]' },
  { key: 'priority', label: 'Priority', sortable: true,  width: 'w-[115px]' },
  { key: 'due',      label: 'Due',      sortable: true,  width: 'w-[155px]' },
  { key: 'project',  label: 'Project',  sortable: true,  width: 'w-[165px]' },
  { key: 'tags',     label: 'Tags',     sortable: false, width: 'w-[175px]' },
  { key: 'assignee', label: 'Assignee', sortable: true,  width: 'w-[140px]' },
]

// '\uffff' sorts last for every missing value, so blanks always sink to the bottom
// on an ascending sort regardless of column.
function sortValue(task, key, projects, users) {
  switch (key) {
    case 'title':
      return (task.title || '').toLowerCase()
    case 'status':
      return String(STATUS_RANK[task.status] ?? 99).padStart(2, '0')
    case 'priority':
      return String(PRIORITY_RANK[task.priority] ?? 9)
    case 'due':
      return task.due_date ? `${task.due_date}T${task.due_time || '99:99'}` : '\uffff'
    case 'project':
      return (projects.find(p => p.id === task.project_id)?.name || '\uffff').toLowerCase()
    case 'assignee': {
      const u = users.find(x => x.id === task.assigned_to)
      return (u?.display_name || u?.username || '\uffff').toLowerCase()
    }
    default:
      return ''
  }
}

const CELL = 'px-3 py-2.5 align-middle'
const HEAD = 'px-3 py-2 text-left text-[10px] font-semibold tracking-widest uppercase text-td-muted dark:text-tn-muted'

export function TaskTableSkeleton({ rows = 8 }) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden px-4 pt-3">
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="w-5 h-5 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-[380px]" />
            <Skeleton className="h-4 w-[100px] shrink-0" />
            <Skeleton className="h-4 w-[80px] shrink-0" />
            <Skeleton className="h-4 w-[110px] shrink-0" />
            <Skeleton className="h-4 w-[120px] shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SortHeader({ col, sort, onSort }) {
  const active = sort.key === col.key
  const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown

  if (!col.sortable) {
    return <th scope="col" className={`${HEAD} ${col.width}`}>{col.label}</th>
  }

  return (
    <th scope="col" className={`${HEAD} ${col.width} p-0`}>
      <button
        type="button"
        onClick={() => onSort(col.key)}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`w-full flex items-center gap-1 px-3 py-2 text-left transition-colors duration-fast
          ${active
            ? 'text-td-fg dark:text-tn-fg'
            : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg'}`}
      >
        <span className="text-[10px] font-semibold tracking-widest uppercase">{col.label}</span>
        {active && <Arrow size={11} className="shrink-0" />}
      </button>
    </th>
  )
}

function TaskRow({ task }) {
  const { state, dispatch } = useApp()
  const { toggleTask } = useTasks()

  const project = state.projects.find(p => p.id === task.project_id)
  const assignee = state.users.find(u => u.id === task.assigned_to)
  const overdue = isOverdue(task)
  const done = task.status === 'done'
  const isDark = state.theme === 'dark'

  const subDone = (task.subtasks || []).filter(s => s.completed).length
  const subTotal = (task.subtasks || []).length

  // 'doing' needs a light-mode variant — the Kanban blue is illegible on white.
  const statusColor = task.status === 'doing'
    ? (isDark ? '#89b4fa' : '#2e7de9')
    : STATUS_COLORS[task.status] || STATUS_COLORS.todo

  // Desktop only: touch devices use the swipe tray instead, and a draggable
  // ancestor would fight useSwipeRow's non-passive touchmove.
  const isTouch = typeof window !== 'undefined'
    && window.matchMedia('(hover: none) and (pointer: coarse)').matches

  return (
    <tr
      draggable={!isTouch}
      onDragStart={!isTouch ? (e => {
        e.dataTransfer.setData(TASK_DRAG_TYPE, task.id)
        e.dataTransfer.effectAllowed = 'move'
      }) : undefined}
      onClick={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
      className={`group cursor-pointer border-b border-td-border/40 dark:border-tn-border/40
        transition-colors duration-fast
        hover:bg-td-surface/60 dark:hover:bg-tn-surface/60
        ${done ? 'opacity-50' : ''}`}
    >
      {/* Checkbox */}
      <td className={`${CELL} w-[44px]`}>
        <button
          onClick={e => { e.stopPropagation(); toggleTask(task.id, task.status) }}
          aria-label="Toggle task"
          className="motion-safe:active:scale-90 transition-transform duration-fast"
        >
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-fast
            ${done
              ? 'border-td-green dark:border-tn-green bg-td-green/20 dark:bg-tn-green/20'
              : 'border-td-muted/50 dark:border-tn-muted/50 hover:border-td-blue dark:hover:border-tn-blue'}`}
          >
            {done && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="#9ece6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>
      </td>

      {/* Title (+ subtask progress) */}
      <td className={CELL}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm leading-snug truncate
            ${done ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
            {task.title}
          </span>
          {subTotal > 0 && (
            <span className="text-[11px] text-td-muted dark:text-tn-muted shrink-0">
              {subDone}/{subTotal}
            </span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className={CELL}>
        <span className="flex items-center gap-1.5 text-xs text-td-muted dark:text-tn-muted">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
          {STATUS_LABELS[task.status] || task.status}
        </span>
      </td>

      {/* Priority */}
      <td className={CELL}>
        {task.priority ? (
          <span className="flex items-center gap-1.5 text-xs text-td-muted dark:text-tn-muted">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: priorityColor(task.priority) }} />
            {PRIORITY_LABELS[task.priority] || task.priority}
          </span>
        ) : (
          <span className="text-xs text-td-muted/40 dark:text-tn-muted/40">—</span>
        )}
      </td>

      {/* Due */}
      <td className={CELL}>
        {task.due_date ? (
          <span className={`text-xs font-medium whitespace-nowrap
            ${overdue ? 'text-td-red dark:text-tn-red' : 'text-td-muted dark:text-tn-muted'}`}>
            {formatDate(task.due_date)}{task.due_time ? ' · ' + fmtTime(task.due_time) : ''}
          </span>
        ) : (
          <span className="text-xs text-td-muted/40 dark:text-tn-muted/40">—</span>
        )}
      </td>

      {/* Project */}
      <td className={CELL}>
        {project ? (
          <span className="flex items-center gap-1.5 text-xs text-td-muted dark:text-tn-muted min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project.color }} />
            <ProjectIcon icon={project.icon} size={11} />
            <span className="truncate">{project.name}</span>
          </span>
        ) : (
          <span className="text-xs text-td-muted/40 dark:text-tn-muted/40">—</span>
        )}
      </td>

      {/* Tags */}
      <td className={CELL}>
        <div className="flex items-center gap-1 min-w-0">
          {(task.tags || []).length === 0 && (
            <span className="text-xs text-td-muted/40 dark:text-tn-muted/40">—</span>
          )}
          {(task.tags || []).slice(0, 2).map(tag => (
            <span
              key={tag}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap
                text-td-muted dark:text-tn-muted
                bg-td-surface dark:bg-tn-surface
                border border-td-border/60 dark:border-tn-border/60"
            >
              @{tag}
            </span>
          ))}
          {(task.tags || []).length > 2 && (
            <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 shrink-0">
              +{task.tags.length - 2}
            </span>
          )}
        </div>
      </td>

      {/* Assignee */}
      <td className={CELL}>
        {assignee ? (
          <span className="text-xs text-td-muted dark:text-tn-muted truncate block">
            {assignee.display_name || assignee.username}
          </span>
        ) : (
          <span className="text-xs text-td-muted/40 dark:text-tn-muted/40">—</span>
        )}
      </td>
    </tr>
  )
}

export function TaskTable({ tasks, emptyMessage = 'No tasks here' }) {
  const { state } = useApp()
  const { projects, users } = state
  const [sort, setSort] = useState({ key: 'due', dir: 'asc' })
  const [showDone, setShowDone] = useState(false)

  const doneCount = useMemo(() => tasks.filter(t => t.status === 'done').length, [tasks])

  const rows = useMemo(() => {
    const pool = showDone ? tasks : tasks.filter(t => t.status !== 'done')
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...pool].sort((a, b) => {
      const va = sortValue(a, sort.key, projects, users)
      const vb = sortValue(b, sort.key, projects, users)
      if (va < vb) return -1 * dir
      if (va > vb) return  1 * dir
      return 0
    })
  }, [tasks, showDone, sort, projects, users])

  const handleSort = useCallback((key) => {
    setSort(s => s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' })
  }, [])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table toolbar — mirrors KanbanBoard's completed toggle */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <span className="text-[11px] text-td-muted/60 dark:text-tn-muted/60">
          {rows.length} {rows.length === 1 ? 'task' : 'tasks'}
        </span>
        <button
          onClick={() => setShowDone(v => !v)}
          className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border transition-colors
            ${showDone
              ? 'bg-td-surface dark:bg-tn-surface border-td-border dark:border-tn-border text-td-fg dark:text-tn-fg'
              : 'border-transparent text-td-muted/60 dark:text-tn-muted/60 hover:text-td-muted dark:hover:text-tn-muted hover:bg-td-surface dark:hover:bg-tn-surface'}`}
        >
          {showDone ? <Eye size={12} /> : <EyeOff size={12} />}
          Completed{doneCount > 0 ? ` (${doneCount})` : ''}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-td-muted dark:text-tn-muted">
          <span className="text-4xl mb-3">✓</span>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain px-4 pb-6">
          <table className="w-full min-w-[1120px] border-collapse">
            <thead className="sticky top-0 z-10 bg-td-bg dark:bg-tn-bg">
              <tr className="border-b border-td-border dark:border-tn-border">
                <th scope="col" className={`${HEAD} w-[44px]`}>
                  <span className="sr-only">Done</span>
                </th>
                {COLUMNS.map(col => (
                  <SortHeader key={col.key} col={col} sort={sort} onSort={handleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(task => <TaskRow key={task.id} task={task} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
