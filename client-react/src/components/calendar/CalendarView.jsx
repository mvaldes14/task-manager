import { useMemo, useRef, useCallback, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function TaskPill({ task, onDragStart, onTouchStart }) {
  const { dispatch } = useApp()
  const done = task.status === 'done'
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task)}
      onTouchStart={e => onTouchStart(e, task)}
      onClick={e => { e.stopPropagation(); dispatch({ type: 'SELECT_TASK', payload: task.id }) }}
      className="w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate font-medium
        cursor-grab active:cursor-grabbing touch-none select-none hover:opacity-80 transition-opacity"
      style={{
        background: done ? 'rgba(86,95,137,0.15)' : 'rgba(122,162,247,0.15)',
        color: done ? '#565f89' : '#7aa2f7',
        textDecoration: done ? 'line-through' : 'none',
      }}
    >
      {task.title}
    </div>
  )
}

export function CalendarView({ tasks }) {
  const { state, dispatch } = useApp()
  const { updateTask } = useTasks()
  const { calYear: year, calMonth: month } = state
  const today = new Date()

  const [overDate, setOverDate] = useState(null)
  const dragTask = useRef(null)
  const ghostEl = useRef(null)
  const cellRefs = useRef({})

  // ── Desktop drag ──────────────────────────────────────────────
  const handleDragStart = useCallback((e, task) => {
    dragTask.current = task
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e, dateStr) => {
    e.preventDefault()
    setOverDate(dateStr)
  }, [])

  const handleDrop = useCallback(async (e, dateStr) => {
    e.preventDefault()
    const task = dragTask.current
    setOverDate(null)
    dragTask.current = null
    if (!task || task.due_date === dateStr) return
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, due_date: dateStr } })
    await updateTask(task.id, { due_date: dateStr })
  }, [dispatch, updateTask])

  // ── Mobile touch drag ─────────────────────────────────────────
  const createGhost = useCallback((el, x, y) => {
    const rect = el.getBoundingClientRect()
    const ghost = el.cloneNode(true)
    ghost.style.cssText = `
      position: fixed;
      left: ${rect.left}px; top: ${rect.top}px;
      width: ${rect.width}px;
      pointer-events: none; opacity: 0.9; z-index: 9999;
      transform: scale(1.05);
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border-radius: 4px;
    `
    ghost._ox = x - rect.left
    ghost._oy = y - rect.top
    document.body.appendChild(ghost)
    ghostEl.current = ghost
  }, [])

  const moveGhost = useCallback((x, y) => {
    if (!ghostEl.current) return
    ghostEl.current.style.left = `${x - ghostEl.current._ox}px`
    ghostEl.current.style.top  = `${y - ghostEl.current._oy}px`
  }, [])

  const removeGhost = useCallback(() => {
    ghostEl.current?.remove()
    ghostEl.current = null
  }, [])

  const getDateAtPoint = useCallback((x, y) => {
    for (const [dateStr, el] of Object.entries(cellRefs.current)) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return dateStr
    }
    return null
  }, [])

  const handleTouchStart = useCallback((e, task) => {
    if (e.touches.length !== 1) return
    dragTask.current = task
    const touch = e.touches[0]
    createGhost(e.currentTarget, touch.clientX, touch.clientY)

    const onMove = (ev) => {
      ev.preventDefault()
      const t = ev.touches[0]
      moveGhost(t.clientX, t.clientY)
      setOverDate(getDateAtPoint(t.clientX, t.clientY))
    }
    const onEnd = async (ev) => {
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      const task = dragTask.current
      const t = ev.changedTouches[0]
      const targetDate = getDateAtPoint(t.clientX, t.clientY)
      removeGhost()
      setOverDate(null)
      dragTask.current = null
      if (task && targetDate && targetDate !== task.due_date) {
        dispatch({ type: 'UPDATE_TASK', payload: { ...task, due_date: targetDate } })
        await updateTask(task.id, { due_date: targetDate })
      }
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }, [createGhost, moveGhost, removeGhost, getDateAtPoint, dispatch, updateTask])

  const { weeks, tasksByDate } = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrev = new Date(year, month, 0).getDate()

    const tasksByDate = {}
    tasks.forEach(t => {
      if (t.due_date) {
        tasksByDate[t.due_date] = tasksByDate[t.due_date] || []
        tasksByDate[t.due_date].push(t)
      }
    })

    const cells = []
    for (let i = 0; i < firstDay; i++)
      cells.push({ day: daysInPrev - firstDay + i + 1, cur: false })
    for (let i = 1; i <= daysInMonth; i++)
      cells.push({ day: i, cur: true })
    while (cells.length % 7 !== 0)
      cells.push({ day: cells.length - daysInMonth - firstDay + 1, cur: false })

    const weeks = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return { weeks, tasksByDate }
  }, [year, month, tasks])

  const prev = () => {
    dispatch({ type: 'SET_CAL', payload: { year: month === 0 ? year - 1 : year, month: month === 0 ? 11 : month - 1 } })
  }
  const next = () => {
    dispatch({ type: 'SET_CAL', payload: { year: month === 11 ? year + 1 : year, month: month === 11 ? 0 : month + 1 } })
  }

  return (
    <div className="flex flex-col h-full p-3 pb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <button onClick={prev} className="p-1.5 text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg rounded-lg hover:bg-td-surface dark:hover:bg-tn-surface">
          <ChevronLeft size={18} />
        </button>
        <span className="text-td-fg dark:text-tn-fg font-semibold text-sm">
          {MONTHS[month]} {year}
        </span>
        <button onClick={next} className="p-1.5 text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg rounded-lg hover:bg-td-surface dark:hover:bg-tn-surface">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1 shrink-0">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-td-muted/60 dark:text-tn-muted/60 uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid - fills remaining height */}
      <div className="flex-1 flex flex-col gap-px min-h-0"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px flex-1 min-h-0">
            {week.map((cell, di) => {
              const isToday = cell.cur &&
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === cell.day

              const dateStr = cell.cur
                ? `${year}-${String(month+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`
                : null
              const dayTasks = (dateStr && tasksByDate[dateStr]) || []
              const isOver = dateStr && overDate === dateStr
              const MAX_SHOW = Math.max(2, Math.floor((dayTasks.length > 0 ? 4 : 2)))

              return (
                <div
                  key={di}
                  ref={el => { if (dateStr) cellRefs.current[dateStr] = el }}
                  onDragOver={dateStr ? e => handleDragOver(e, dateStr) : undefined}
                  onDragLeave={() => setOverDate(null)}
                  onDrop={dateStr ? e => handleDrop(e, dateStr) : undefined}
                  className={`p-1 rounded-lg transition-colors overflow-hidden flex flex-col
                    ${!cell.cur ? 'bg-transparent opacity-30' :
                      isOver ? 'bg-td-surface dark:bg-tn-surface ring-2 ring-td-blue/50 dark:ring-tn-blue/50' :
                      'bg-td-bg3/40 dark:bg-tn-bg3/40 hover:bg-td-bg3 dark:hover:bg-tn-bg3'}
                    ${isToday && !isOver ? 'ring-1 ring-td-blue/50 dark:ring-tn-blue/50' : ''}`}
                >
                  <div className={`text-[11px] font-medium mb-0.5 text-right shrink-0
                    ${isToday ? 'text-td-blue dark:text-tn-blue' : cell.cur ? 'text-td-muted dark:text-tn-muted' : 'text-td-muted/40 dark:text-tn-muted/40'}`}>
                    {cell.day}
                  </div>
                  <div className="space-y-0.5 overflow-hidden flex-1 min-h-0">
                    {dayTasks.slice(0, MAX_SHOW).map(t => (
                      <TaskPill key={t.id} task={t} onDragStart={handleDragStart} onTouchStart={handleTouchStart} />
                    ))}
                    {dayTasks.length > MAX_SHOW && (
                      <div className="text-[9px] text-td-muted/60 dark:text-tn-muted/60 pl-1">
                        +{dayTasks.length - MAX_SHOW} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
