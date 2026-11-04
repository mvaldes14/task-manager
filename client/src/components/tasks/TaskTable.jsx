import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { ProjectIcon } from '../shared/ProjectIcon'
import { LinkIcon, Skeleton, TaskKey } from '../ui'
import { formatDate, fmtTime, getLinkLabel, isOverdue, priorityColor, recurrenceLabel } from '../../utils'
import { STATUS_DISPLAY_LABELS, STATUS_ORDER } from './grouping'
import { ArrowUp, ArrowDown, Check, Columns3, Eye, EyeOff, ListChecks, X } from 'lucide-react'
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
  { key: 'key',      label: 'ID',       sortable: true,  width: 84,  minWidth: 64 },
  { key: 'title',    label: 'Task',     sortable: true,  width: 360, minWidth: 180 },
  { key: 'status',   label: 'Status',   sortable: true,  width: 112, minWidth: 88 },
  { key: 'priority', label: 'Priority', sortable: true,  width: 90,  minWidth: 76 },
  { key: 'due',      label: 'Due',      sortable: true,  width: 124, minWidth: 96 },
  { key: 'project',    label: 'Project',  sortable: true,  width: 130, minWidth: 96 },
  { key: 'tags',       label: 'Tags',     sortable: true,  width: 160, minWidth: 100 },
  { key: 'links',      label: 'Links',    sortable: false, width: 110, minWidth: 80 },
  { key: 'assignee',   label: 'Assignee', sortable: true,  width: 110, minWidth: 90 },
  { key: 'recurrence', label: 'Repeat',   sortable: true,  width: 140, minWidth: 100, defaultVisible: false },
  { key: 'created',    label: 'Created',  sortable: true,  width: 110, minWidth: 90, defaultVisible: false },
  { key: 'updated',    label: 'Updated',  sortable: true,  width: 110, minWidth: 90, defaultVisible: false },
]

const COLUMN_WIDTHS_STORAGE_KEY = 'td-table-column-widths'
const VISIBLE_COLUMNS_STORAGE_KEY = 'td-table-visible-columns'
const DEFAULT_COLUMN_WIDTHS = Object.fromEntries(COLUMNS.map(col => [col.key, col.width]))
const DEFAULT_VISIBLE_COLUMNS = COLUMNS.filter(col => col.defaultVisible !== false).map(col => col.key)
const VISIBLE_COLUMNS_VERSION = 2

function loadVisibleColumns() {
  try {
    const stored = JSON.parse(localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY) || 'null')
    if (!stored) return DEFAULT_VISIBLE_COLUMNS

    // v1 stored a bare array before Tags existed. Add Tags once while preserving
    // every existing visibility choice; v2 stores an explicit schema version.
    const saved = Array.isArray(stored) ? [...stored, 'tags'] : stored.columns
    if (!Array.isArray(saved)) return DEFAULT_VISIBLE_COLUMNS

    const selected = new Set(saved)
    selected.add('title')
    return COLUMNS.filter(col => selected.has(col.key)).map(col => col.key)
  } catch {
    return DEFAULT_VISIBLE_COLUMNS
  }
}

function loadColumnWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY) || '{}')
    return Object.fromEntries(COLUMNS.map(col => [
      col.key,
      Math.max(col.minWidth, Number(saved[col.key]) || col.width),
    ]))
  } catch {
    return DEFAULT_COLUMN_WIDTHS
  }
}

// '\uffff' sorts last for every missing value, so blanks always sink to the bottom
// on an ascending sort regardless of column.
function sortValue(task, key, projects, users) {
  switch (key) {
    case 'key':
      return task.seq != null ? String(task.seq).padStart(10, '0') : '\uffff'
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
    case 'tags':
      return (task.tags || []).join('\u0000').toLowerCase() || '\uffff'
    case 'recurrence':
      return (recurrenceLabel(task.recurrence) || '\uffff').toLowerCase()
    case 'created':
      return task.created_at || '\uffff'
    case 'updated':
      return task.updated_at || '\uffff'
    case 'assignee': {
      const u = users.find(x => x.id === task.assigned_to)
      return (u?.display_name || u?.username || '\uffff').toLowerCase()
    }
    default:
      return ''
  }
}

const CELL = 'px-3 py-2.5 align-middle overflow-hidden'
const HEAD = 'px-3 py-2 text-left text-[10px] font-semibold tracking-widest uppercase text-td-muted dark:text-tn-muted overflow-hidden'

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

function ResizeHandle({ col, width, onResizeStart, onResizeKey, onReset }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${col.label} column`}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · Double-click to reset"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => { e.stopPropagation(); onReset(col.key) }}
      onPointerDown={e => onResizeStart(e, col.key)}
      onKeyDown={e => onResizeKey(e, col.key)}
      className="group/resize absolute right-0 top-0 z-20 h-full w-2 translate-x-1/2 cursor-col-resize touch-none outline-none"
    >
      <span className="absolute left-1/2 top-1 bottom-1 w-px -translate-x-1/2 bg-td-border dark:bg-tn-border group-hover/resize:bg-td-blue dark:group-hover/resize:bg-tn-blue group-focus/resize:bg-td-blue dark:group-focus/resize:bg-tn-blue group-hover/resize:w-0.5 group-focus/resize:w-0.5" />
    </div>
  )
}

function SortHeader({ col, sort, width, onSort, onResizeStart, onResizeKey, onReset }) {
  const active = sort.key === col.key
  const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown

  return (
    <th scope="col" className={`${HEAD} relative p-0`}>
      {col.sortable ? (
        <button
          type="button"
          onClick={() => onSort(col.key)}
          aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
          className={`w-full flex items-center gap-1 px-3 py-2 pr-4 text-left transition-colors duration-fast
            ${active
              ? 'text-td-fg dark:text-tn-fg'
              : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg'}`}
        >
          <span className="text-[10px] font-semibold tracking-widest uppercase truncate">{col.label}</span>
          {active && <Arrow size={11} className="shrink-0" />}
        </button>
      ) : (
        <div className="px-3 py-2 pr-4 truncate">{col.label}</div>
      )}
      <ResizeHandle
        col={col}
        width={width}
        onResizeStart={onResizeStart}
        onResizeKey={onResizeKey}
        onReset={onReset}
      />
    </th>
  )
}

function tableDate(d) {
  return (formatDate(d) || '').replace(/^📅\s*/, '')
}

function timestampDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PriorityBars({ priority }) {
  const count = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1
  const color = priorityColor(priority)
  return (
    <span className="inline-flex items-end gap-0.5 h-3 shrink-0" aria-hidden="true">
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className="w-1 rounded-sm"
          style={{
            height: `${i * 3 + 3}px`,
            background: i <= count ? color : 'currentColor',
            opacity: i <= count ? 1 : 0.18,
          }}
        />
      ))}
    </span>
  )
}

function NeutralLinks({ links, max = 1 }) {
  const validLinks = (links || []).filter(link => link?.url)
  if (validLinks.length === 0) return null

  const visibleLinks = validLinks.slice(0, max)
  const hiddenCount = Math.max(0, validLinks.length - max)

  return (
    <span className="inline-flex items-center gap-1 min-w-0 text-td-muted dark:text-tn-muted">
      {visibleLinks.map((link, i) => {
        const label = getLinkLabel(link.url)
        return (
          <a
            key={`${link.url}-${i}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onClick={e => e.stopPropagation()}
            title={link.url}
            aria-label={`Open ${label}`}
            className="inline-flex items-center gap-1 min-w-0 text-xs hover:text-td-fg dark:hover:text-tn-fg transition-colors"
          >
            <LinkIcon url={link.url} size={11} />
            <span className="truncate">{label}</span>
          </a>
        )
      })}
      {hiddenCount > 0 && <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 shrink-0">+{hiddenCount}</span>}
    </span>
  )
}

// Selection reuses the completion-control slot while table is in explicit
// select mode. This keeps row geometry stable without reserving another column.
function SelectCheckbox({ selected, onToggle, label }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle() }}
      aria-label={label}
      className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors duration-fast
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-td-blue/50 dark:focus-visible:ring-tn-blue/50
        ${selected
          ? 'bg-td-blue dark:bg-tn-blue border-td-blue dark:border-tn-blue text-white'
          : 'bg-td-bg dark:bg-tn-bg border-td-muted/70 dark:border-tn-muted hover:border-td-blue dark:hover:border-tn-blue hover:bg-td-blue/5 dark:hover:bg-tn-blue/10'}`}
    >
      {selected && <Check size={13} strokeWidth={3} />}
    </button>
  )
}

function TaskRow({ task, selection, visibleColumnKeys }) {
  const { state, dispatch } = useApp()
  const { toggleTask } = useTasks()
  const selectMode = !!selection?.selectionMode
  const selected = !!selection?.selectedIds?.has(task.id)
  const columnVisible = key => visibleColumnKeys.has(key)

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
      draggable={!isTouch && !selectMode}
      onDragStart={!isTouch && !selectMode ? (e => {
        e.dataTransfer.setData(TASK_DRAG_TYPE, task.id)
        e.dataTransfer.effectAllowed = 'move'
      }) : undefined}
      onClick={() => {
        if (selectMode) { selection.onToggleSelect(task.id); return }
        dispatch({ type: 'SELECT_TASK', payload: task.id })
      }}
      className={`group cursor-pointer border-b border-td-border/40 dark:border-tn-border/40
        transition-colors duration-fast
        hover:bg-td-surface/60 dark:hover:bg-tn-surface/60
        ${done && !selectMode ? 'opacity-50' : ''}`}
    >
      {/* Select mode replaces completion control; no extra column needed. */}
      <td className={CELL}>
        {selectMode ? (
          <SelectCheckbox
            selected={selected}
            onToggle={() => selection.onToggleSelect(task.id)}
            label={selected ? 'Deselect task' : 'Select task'}
          />
        ) : (
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
        )}
      </td>

      {columnVisible('key') && (
        <td className={CELL}>
          <TaskKey task={task} copyable />
        </td>
      )}

      {/* Title (+ subtask progress) */}
      <td className={`${CELL} max-w-0`}>
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
      {columnVisible('status') && (
        <td className={CELL}>
          <span className="flex items-center gap-1.5 text-xs text-td-muted dark:text-tn-muted whitespace-nowrap">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: statusColor }} />
            {STATUS_DISPLAY_LABELS[task.status] || task.status}
          </span>
        </td>
      )}

      {/* Priority */}
      {columnVisible('priority') && (
        <td className={CELL}>
          {task.priority ? (
            <span className="flex items-center gap-1.5 text-xs text-td-muted dark:text-tn-muted whitespace-nowrap">
              <PriorityBars priority={task.priority} />
              {PRIORITY_LABELS[task.priority] || task.priority}
            </span>
          ) : null}
        </td>
      )}

      {/* Due */}
      {columnVisible('due') && (
        <td className={CELL}>
          {task.due_date ? (
            <span className={`text-xs font-medium whitespace-nowrap
              ${overdue ? 'text-td-red dark:text-tn-red' : 'text-td-muted dark:text-tn-muted'}`}>
              {tableDate(task.due_date)}{task.due_time ? ' · ' + fmtTime(task.due_time) : ''}
            </span>
          ) : null}
        </td>
      )}

      {/* Project */}
      {columnVisible('project') && (
        <td className={CELL}>
          {project ? (
            <span className="flex items-center gap-1.5 text-xs text-td-muted dark:text-tn-muted min-w-0">
              <span className="shrink-0" style={{ color: project.color }}>
                <ProjectIcon icon={project.icon} size={11} />
              </span>
              <span className="truncate">{project.name}</span>
            </span>
          ) : null}
        </td>
      )}

      {/* Tags */}
      {columnVisible('tags') && (
        <td className={CELL}>
          {(task.tags || []).length > 0 && (
            <div className="flex items-center gap-1 min-w-0 overflow-hidden">
              {(task.tags || []).slice(0, 2).map(tag => (
                <span
                  key={tag}
                  title={tag}
                  className="min-w-0 truncate rounded-md bg-td-surface dark:bg-tn-surface px-1.5 py-0.5 text-[10px] text-td-muted dark:text-tn-muted"
                >
                  @{tag}
                </span>
              ))}
              {(task.tags || []).length > 2 && (
                <span className="shrink-0 text-[10px] text-td-muted/60 dark:text-tn-muted/60">
                  +{task.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </td>
      )}

      {/* Links */}
      {columnVisible('links') && (
        <td className={CELL}>
          <div className="flex items-center gap-1 min-w-0">
            <NeutralLinks links={task.links} max={1} />
          </div>
        </td>
      )}

      {/* Assignee */}
      {columnVisible('assignee') && (
        <td className={CELL}>
          {assignee ? (
            <span className="text-xs text-td-muted dark:text-tn-muted truncate block">
              {assignee.display_name || assignee.username}
            </span>
          ) : null}
        </td>
      )}

      {/* Recurrence */}
      {columnVisible('recurrence') && (
        <td className={CELL}>
          <span className="text-xs text-td-muted dark:text-tn-muted truncate block">
            {recurrenceLabel(task.recurrence)}
          </span>
        </td>
      )}

      {/* Audit dates */}
      {columnVisible('created') && (
        <td className={CELL}>
          <span className="text-xs text-td-muted dark:text-tn-muted whitespace-nowrap">
            {timestampDate(task.created_at)}
          </span>
        </td>
      )}
      {columnVisible('updated') && (
        <td className={CELL}>
          <span className="text-xs text-td-muted dark:text-tn-muted whitespace-nowrap">
            {timestampDate(task.updated_at)}
          </span>
        </td>
      )}
    </tr>
  )
}

export function TaskTable({ tasks, emptyMessage = 'No tasks here', selection = null }) {
  const { state } = useApp()
  const { projects, users } = state
  const [sort, setSort] = useState({ key: 'due', dir: 'asc' })
  const [showDone, setShowDone] = useState(false)
  const [columnWidths, setColumnWidths] = useState(loadColumnWidths)
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns)
  const [columnMenuOpen, setColumnMenuOpen] = useState(false)
  const resizeCleanupRef = useRef(null)
  const columnMenuRef = useRef(null)
  const selectionEnabled = !!selection?.selectionEnabled
  const selectMode = !!selection?.selectionMode
  const selectedCount = selection?.selectedIds?.size || 0

  useEffect(() => {
    localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths))
  }, [columnWidths])

  useEffect(() => {
    localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify({
      version: VISIBLE_COLUMNS_VERSION,
      columns: visibleColumns,
    }))
  }, [visibleColumns])

  useEffect(() => {
    if (!columnMenuOpen) return undefined
    const closeOnOutsideClick = event => {
      if (!columnMenuRef.current?.contains(event.target)) setColumnMenuOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setColumnMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [columnMenuOpen])

  useEffect(() => () => resizeCleanupRef.current?.(), [])

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

  const resizeColumn = useCallback((key, width) => {
    const col = COLUMNS.find(candidate => candidate.key === key)
    if (!col) return
    setColumnWidths(current => ({ ...current, [key]: Math.max(col.minWidth, Math.round(width)) }))
  }, [])

  const startColumnResize = useCallback((event, key) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    resizeCleanupRef.current?.()

    const startX = event.clientX
    const startWidth = columnWidths[key]
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = moveEvent => resizeColumn(key, startWidth + moveEvent.clientX - startX)
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      resizeCleanupRef.current = null
    }

    resizeCleanupRef.current = cleanup
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
  }, [columnWidths, resizeColumn])

  const resizeColumnByKey = useCallback((event, key) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    resizeColumn(key, columnWidths[key] + (event.key === 'ArrowRight' ? 8 : -8))
  }, [columnWidths, resizeColumn])

  const resetColumnWidth = useCallback((key) => {
    resizeColumn(key, DEFAULT_COLUMN_WIDTHS[key])
  }, [resizeColumn])

  const visibleColumnSet = useMemo(() => new Set(visibleColumns), [visibleColumns])
  const displayedColumns = useMemo(
    () => COLUMNS.filter(col => visibleColumnSet.has(col.key)),
    [visibleColumnSet],
  )
  const toggleColumn = useCallback((key) => {
    if (key === 'title') return
    setVisibleColumns(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      next.add('title')
      return COLUMNS.filter(col => next.has(col.key)).map(col => col.key)
    })
  }, [])

  const tableWidth = useMemo(() => (
    40 + displayedColumns.reduce((sum, col) => sum + columnWidths[col.key], 0)
  ), [columnWidths, displayedColumns])

  // Select-all reflects the currently rendered (filtered) rows only, not the DB.
  const selectedInRows = selectionEnabled
    ? rows.reduce((n, t) => n + (selection.selectedIds.has(t.id) ? 1 : 0), 0)
    : 0
  const allSelected = rows.length > 0 && selectedInRows === rows.length

  const toggleSelectAll = useCallback(() => {
    if (allSelected) selection.onDeselectMany(rows.map(t => t.id))
    else selection.onSelectMany(rows.map(t => t.id))
  }, [allSelected, rows, selection])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Table toolbar — mirrors KanbanBoard's completed toggle */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
        <span className="text-[11px] text-td-muted/60 dark:text-tn-muted/60">
          {selectMode
            ? `${selectedCount} selected`
            : `${rows.length} ${rows.length === 1 ? 'task' : 'tasks'}`}
        </span>

        <div className="flex items-center gap-1.5">
          {selectMode ? (
            <>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg
                  text-td-blue dark:text-tn-blue hover:bg-td-blue/10 dark:hover:bg-tn-blue/10 transition-colors"
              >
                <ListChecks size={13} />
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              <button
                type="button"
                onClick={selection.onClearSelection}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg
                  text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg
                  hover:bg-td-surface dark:hover:bg-tn-surface transition-colors"
              >
                <X size={12} />
                Cancel
              </button>
            </>
          ) : (
            <>
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
              <div ref={columnMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setColumnMenuOpen(open => !open)}
                  aria-expanded={columnMenuOpen}
                  aria-haspopup="menu"
                  className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border transition-colors
                    ${columnMenuOpen
                      ? 'bg-td-surface dark:bg-tn-surface border-td-border dark:border-tn-border text-td-fg dark:text-tn-fg'
                      : 'border-transparent text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface dark:hover:bg-tn-surface'}`}
                >
                  <Columns3 size={13} />
                  Columns
                </button>
                {columnMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-td-border dark:border-tn-border
                      bg-td-bg2 dark:bg-tn-bg2 p-1.5 shadow-e3"
                  >
                    {COLUMNS.map(col => {
                      const fixed = col.key === 'title'
                      const visible = visibleColumnSet.has(col.key)
                      return (
                        <button
                          key={col.key}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={visible}
                          disabled={fixed}
                          onClick={() => toggleColumn(col.key)}
                          className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors
                            ${fixed
                              ? 'cursor-default text-td-muted/60 dark:text-tn-muted/60'
                              : 'text-td-fg dark:text-tn-fg hover:bg-td-surface dark:hover:bg-tn-surface'}`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                            ${visible
                              ? 'border-td-blue dark:border-tn-blue bg-td-blue dark:bg-tn-blue text-white'
                              : 'border-td-muted/50 dark:border-tn-muted/50'}`}
                          >
                            {visible && <Check size={11} strokeWidth={3} />}
                          </span>
                          <span>{col.label}</span>
                          {fixed && <span className="ml-auto text-[10px]">Fixed</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {selectionEnabled && (
                <button
                  type="button"
                  onClick={selection.onStartSelection}
                  className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-transparent
                    text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg
                    hover:bg-td-surface dark:hover:bg-tn-surface transition-colors"
                >
                  <ListChecks size={13} />
                  Select
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-td-muted dark:text-tn-muted">
          <span className="text-4xl mb-3">✓</span>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto overscroll-contain px-4 pb-6">
          <table className="min-w-full table-fixed border-collapse" style={{ width: `${tableWidth}px` }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              {displayedColumns.map(col => (
                <col key={col.key} style={{ width: `${columnWidths[col.key]}px` }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-td-bg dark:bg-tn-bg">
              <tr className="border-b border-td-border dark:border-tn-border">
                <th scope="col" className={HEAD}>
                  <span className="sr-only">{selectMode ? 'Selected' : 'Done'}</span>
                </th>
                {displayedColumns.map(col => (
                  <SortHeader
                    key={col.key}
                    col={col}
                    sort={sort}
                    width={columnWidths[col.key]}
                    onSort={handleSort}
                    onResizeStart={startColumnResize}
                    onResizeKey={resizeColumnByKey}
                    onReset={resetColumnWidth}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selection={selection}
                  visibleColumnKeys={visibleColumnSet}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
