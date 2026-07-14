import { Fragment, useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { api } from '../../api'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS_SHORT = ['S','M','T','W','T','F','S']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

// ── Shared time-grid helpers (used by both day and week views) ─────────────────
// Full 0–23 range so no timed task ever falls outside a slot. The grid is
// scrollable and auto-scrolls to a sensible hour on open.
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const ROW_HEIGHT = 56 // px per hour row; also used to compute auto-scroll offset
const formatHour = h => h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`
const slotKey = (dateStr, h) => `${dateStr}|${String(h).padStart(2, '0')}:00:00`
const hourOf = item => parseInt(item.due_time.slice(0, 2), 10)

// Split a day's tasks + ICS events into timed (have due_time) and all-day buckets.
function splitDayItems(dayTasks, dayIcs) {
  const all = [
    ...dayIcs.map(e => ({ ...e, _type: 'ics' })),
    ...dayTasks.map(t => ({ ...t, _type: 'task' })),
  ]
  return {
    timed: all.filter(i => !!i.due_time).sort((a, b) => a.due_time.localeCompare(b.due_time)),
    allDay: all.filter(i => !i.due_time),
  }
}

// Hour to scroll the grid to on open: the earliest timed item, else 7 AM.
function initialScrollHour(timed) {
  return timed.length ? hourOf(timed[0]) : 7
}

function TaskPill({ task, onDragStart, onTouchStart }) {
  const { state, dispatch } = useApp()
  const done = task.status === 'done'
  const isDark = state.theme === 'dark'
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task)}
      onTouchStart={e => onTouchStart(e, task)}
      onClick={e => { e.stopPropagation(); dispatch({ type: 'SELECT_TASK', payload: task.id }) }}
      className="w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate font-medium
        cursor-grab active:cursor-grabbing touch-none select-none hover:opacity-80 transition-opacity"
      style={{
        background: done
          ? (isDark ? 'rgba(138,143,152,0.15)' : 'rgba(107,114,128,0.15)')
          : (isDark ? 'rgba(137,180,250,0.15)' : 'rgba(46,125,233,0.15)'),
        color: done
          ? (isDark ? '#8a8f98' : '#6b7280')
          : (isDark ? '#89b4fa' : '#2e7de9'),
        textDecoration: done ? 'line-through' : 'none',
      }}
    >
      {task.title}
    </div>
  )
}

function IcsPill({ event, color }) {
  const bg = color + '30'
  const border = color + '80'
  const timeStr = event.due_time ? event.due_time.slice(0,5) + ' ' : ''
  return (
    <div
      title={event.title}
      className="w-full text-[10px] px-1.5 py-0.5 rounded truncate font-semibold select-none brightness-75 dark:brightness-110"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {timeStr}{event.title}
    </div>
  )
}

// A single timed task/ICS event rendered inside an hour cell (day + week grids).
function TimedItem({ item, onDragStart, onTouchStart }) {
  const { dispatch } = useApp()
  if (item._type === 'ics') {
    return (
      <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg min-h-[44px]"
        style={{ background: item._color + '15', borderLeft: `3px solid ${item._color}` }}>
        <span className="text-[11px] font-semibold shrink-0 pt-px" style={{ color: item._color }}>
          {item.due_time.slice(0, 5)}
        </span>
        <span className="text-sm font-medium text-td-fg dark:text-tn-fg break-words leading-snug">{item.title}</span>
      </div>
    )
  }
  const done = item.status === 'done'
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, item)}
      onTouchStart={e => onTouchStart(e, item)}
      onClick={e => { e.stopPropagation(); dispatch({ type: 'SELECT_TASK', payload: item.id }) }}
      className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg min-h-[44px]
        cursor-grab active:cursor-grabbing touch-none select-none hover:bg-td-surface dark:hover:bg-tn-surface transition-colors
        ${done ? 'opacity-50 bg-td-bg3/20 dark:bg-tn-bg3/20' : 'bg-td-blue/10 dark:bg-tn-blue/10 border-l-2 border-td-blue/40 dark:border-tn-blue/40'}`}
    >
      <span className="text-[11px] font-semibold text-td-blue dark:text-tn-blue shrink-0 pt-px">
        {item.due_time.slice(0, 5)}
      </span>
      <span className={`text-sm font-medium text-td-fg dark:text-tn-fg break-words leading-snug ${done ? 'line-through' : ''}`}>
        {item.title}
      </span>
    </div>
  )
}

function UnscheduledCard({ task, project, onDragStart }) {
  const { dispatch } = useApp()
  const done = task.status === 'done'
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task)}
      onClick={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
      className="flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing select-none
        bg-td-bg3/60 dark:bg-tn-bg3/60 hover:bg-td-surface dark:hover:bg-tn-surface
        border border-transparent hover:border-td-border dark:hover:border-tn-border
        transition-all group"
    >
      {project && (
        <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project.color }} />
      )}
      <span className={`text-[11px] leading-snug font-medium break-words
        ${done ? 'line-through text-td-muted/50 dark:text-tn-muted/50' : 'text-td-fg dark:text-tn-fg'}`}>
        {task.title}
      </span>
    </div>
  )
}

// ── Week view ─────────────────────────────────────────────────────────────────

// Grid template: a fixed time gutter + 7 equal day columns.
const WEEK_GRID_COLS = '3rem repeat(7, minmax(0, 1fr))'

function WeekView({ weekDays, tasksByDate, icsEventsByDate, onDragStart, onTouchStart, handleDragOver, handleDrop, setOverDate, overDate, cellRefs }) {
  const todayStr = toDateStr(new Date())
  const scrollRef = useRef(null)

  const perDay = useMemo(() => weekDays.map(date => {
    const dateStr = toDateStr(date)
    const { timed, allDay } = splitDayItems(tasksByDate[dateStr] || [], icsEventsByDate[dateStr] || [])
    return { date, dateStr, timed, allDay }
  }), [weekDays, tasksByDate, icsEventsByDate])

  const weekStartStr = perDay[0]?.dateStr
  // Auto-scroll to the earliest timed item (or 7 AM) when the week changes.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = initialScrollHour(perDay.flatMap(d => d.timed)) * ROW_HEIGHT
    }
    // Only re-scroll on week navigation, not on every task/ICS update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartStr])

  const anyAllDay = perDay.some(d => d.allDay.length > 0)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-x-auto"
      style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex flex-col flex-1 min-h-0 min-w-[640px]">
        {/* Sticky day-header row */}
        <div className="grid shrink-0" style={{ gridTemplateColumns: WEEK_GRID_COLS }}>
          <div className="border-b border-td-border/20 dark:border-tn-border/20" />
          {perDay.map(({ date, dateStr }) => {
            const isToday = dateStr === todayStr
            return (
              <div key={dateStr}
                className={`flex flex-col items-center py-2 border-b border-l border-td-border/20 dark:border-tn-border/20
                  ${isToday ? 'text-td-blue dark:text-tn-blue' : 'text-td-muted dark:text-tn-muted'}`}>
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  {DAYS[date.getDay()].slice(0, 3)}
                </span>
                <span className={`text-base font-bold leading-none mt-1 w-7 h-7 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-td-blue/20 dark:bg-tn-blue/20 text-td-blue dark:text-tn-blue' : ''}`}>
                  {date.getDate()}
                </span>
              </div>
            )
          })}
        </div>

        {/* All-day row (tasks/events with a date but no time) */}
        {anyAllDay && (
          <div className="grid shrink-0 border-b border-td-border/30 dark:border-tn-border/30"
            style={{ gridTemplateColumns: WEEK_GRID_COLS }}>
            <div className="flex items-start justify-end pr-1.5 pt-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-td-muted/50 dark:text-tn-muted/50">All day</span>
            </div>
            {perDay.map(({ dateStr, allDay }) => {
              const isOver = overDate === dateStr
              return (
                <div key={dateStr}
                  ref={el => { cellRefs.current[dateStr] = el }}
                  onDragOver={e => handleDragOver(e, dateStr)}
                  onDragLeave={() => setOverDate(null)}
                  onDrop={e => handleDrop(e, dateStr)}
                  className={`p-1 space-y-0.5 border-l border-td-border/20 dark:border-tn-border/20 transition-colors
                    ${isOver ? 'bg-td-blue/5 dark:bg-tn-blue/5' : ''}`}
                >
                  {allDay.map((item, i) => item._type === 'ics'
                    ? <IcsPill key={i} event={item} color={item._color} />
                    : <TaskPill key={item.id} task={item} onDragStart={onDragStart} onTouchStart={onTouchStart} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Scrollable hours × 7-days grid */}
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto min-h-0">
          <div className="grid" style={{ gridTemplateColumns: WEEK_GRID_COLS }}>
            {HOURS.map(hour => (
              <Fragment key={hour}>
                <div className="flex justify-end pr-1.5 pt-1 border-b border-td-border/10 dark:border-tn-border/10"
                  style={{ minHeight: `${ROW_HEIGHT}px` }}>
                  <span className="text-[10px] font-medium text-td-muted/50 dark:text-tn-muted/50">
                    {formatHour(hour)}
                  </span>
                </div>
                {perDay.map(({ dateStr, timed }) => {
                  const key = slotKey(dateStr, hour)
                  const isOver = overDate === key
                  const isToday = dateStr === todayStr
                  const items = timed.filter(i => hourOf(i) === hour)
                  return (
                    <div key={dateStr}
                      ref={el => { cellRefs.current[key] = el }}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setOverDate(key) }}
                      onDragLeave={e => e.stopPropagation()}
                      onDrop={e => { e.stopPropagation(); handleDrop(e, key) }}
                      className={`p-0.5 space-y-0.5 border-b border-l border-td-border/10 dark:border-tn-border/10 transition-colors
                        ${isOver ? 'bg-td-blue/10 dark:bg-tn-blue/10 ring-1 ring-inset ring-td-blue/40 dark:ring-tn-blue/40'
                          : isToday ? 'bg-td-blue/[0.04] dark:bg-tn-blue/[0.06]' : ''}`}
                      style={{ minHeight: `${ROW_HEIGHT}px` }}
                    >
                      {isOver && items.length === 0 && (
                        <div className="h-10 rounded border border-dashed border-td-blue/30 dark:border-tn-blue/30" />
                      )}
                      {items.map((item, i) => (
                        <TimedItem key={item._type === 'ics' ? `ics-${i}` : item.id}
                          item={item} onDragStart={onDragStart} onTouchStart={onTouchStart} />
                      ))}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Day view ──────────────────────────────────────────────────────────────────

function DayView({ dateStr, dayTasks, dayIcs, onDragStart, onTouchStart, handleDragOver, handleDrop, setOverDate, overDate, cellRefs }) {
  const { dispatch } = useApp()
  const scrollRef = useRef(null)

  const { timed, allDay } = useMemo(
    () => splitDayItems(dayTasks, dayIcs),
    [dayTasks, dayIcs]
  )

  // Auto-scroll to the earliest timed item (or 7 AM) when the day changes.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = initialScrollHour(timed) * ROW_HEIGHT
    }
    // Only re-scroll on day navigation, not on every task/ICS update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr])

  return (
    <div className="flex-1 flex flex-col min-h-0"
      style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      {/* All-day row: tasks with this date but no time (drop target = date only) */}
      {allDay.length > 0 && (
        <div
          ref={el => { cellRefs.current[dateStr] = el }}
          onDragOver={e => handleDragOver(e, dateStr)}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverDate(null) }}
          onDrop={e => handleDrop(e, dateStr)}
          className={`px-4 pt-2 pb-2 border-b shrink-0 transition-colors
            border-td-border/30 dark:border-tn-border/30
            ${overDate === dateStr ? 'bg-td-blue/5 dark:bg-tn-blue/5' : ''}`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-td-muted/60 dark:text-tn-muted/60 mb-1.5">All day</p>
          <div className="space-y-1">
            {allDay.map((item, i) => {
              if (item._type === 'ics') {
                return (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                    style={{ background: item._color + '15', borderLeft: `3px solid ${item._color}` }}>
                    <span className="text-sm font-medium text-td-fg dark:text-tn-fg">{item.title}</span>
                  </div>
                )
              }
              return (
                <div key={item.id}
                  draggable
                  onDragStart={e => onDragStart(e, item)}
                  onTouchStart={e => onTouchStart(e, item)}
                  onClick={() => dispatch({ type: 'SELECT_TASK', payload: item.id })}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors
                    hover:bg-td-surface dark:hover:bg-tn-surface
                    ${item.status === 'done' ? 'opacity-50 bg-td-bg3/20 dark:bg-tn-bg3/20' : 'bg-td-bg3/40 dark:bg-tn-bg3/40'}`}
                >
                  <span className={`text-sm font-medium text-td-fg dark:text-tn-fg ${item.status === 'done' ? 'line-through' : ''}`}>
                    {item.title}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Scrollable timed slots (full 0–23 range) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        {HOURS.map(hour => {
          const key = slotKey(dateStr, hour)
          const isSlotOver = overDate === key
          const items = timed.filter(item => hourOf(item) === hour)
          return (
            <div key={hour}
              ref={el => { cellRefs.current[key] = el }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setOverDate(key) }}
              onDragLeave={e => e.stopPropagation()}
              onDrop={e => { e.stopPropagation(); handleDrop(e, key) }}
              className={`flex items-start gap-3 px-4 border-b border-td-border/20 dark:border-tn-border/20 transition-colors
                ${isSlotOver ? 'bg-td-blue/5 dark:bg-tn-blue/5' : ''}`}
              style={{ minHeight: `${ROW_HEIGHT}px` }}
            >
              <span className={`text-[10px] font-medium w-10 shrink-0 pt-1.5 text-right transition-colors
                ${isSlotOver ? 'text-td-blue dark:text-tn-blue' : 'text-td-muted/50 dark:text-tn-muted/50'}`}>
                {formatHour(hour)}
              </span>
              <div className="flex-1 py-1 space-y-1">
                {isSlotOver && items.length === 0 && (
                  <div className="h-6 rounded border border-dashed border-td-blue/30 dark:border-tn-blue/30" />
                )}
                {items.map((item, i) => (
                  <TimedItem key={item._type === 'ics' ? `ics-${i}` : item.id}
                    item={item} onDragStart={onDragStart} onTouchStart={onTouchStart} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Main CalendarView ─────────────────────────────────────────────────────────

export function CalendarView({ tasks }) {
  const { state, dispatch } = useApp()
  const { updateTask } = useTasks()
  const { calYear: year, calMonth: month, calDay: day, calView } = state
  const today = new Date()

  const [overDate, setOverDate] = useState(null)
  const dragTask = useRef(null)
  const ghostEl = useRef(null)
  const cellRefs = useRef({})
  const touchListeners = useRef({ onMove: null, onEnd: null })

  // ── ICS events ────────────────────────────────────────────────
  const [icsCalendars, setIcsCalendars] = useState([])
  const [icsEventsByDate, setIcsEventsByDate] = useState({})

  useEffect(() => {
    api.listIcs().then(cals => setIcsCalendars(cals || [])).catch(() => {})
  }, [])

  // Determine which months to fetch based on view type (week may span 2 months)
  const monthsToFetch = useMemo(() => {
    if (calView !== 'week') return [{ year, month }]
    const anchor = new Date(year, month, day)
    const weekStart = new Date(anchor)
    weekStart.setDate(anchor.getDate() - anchor.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const months = [{ year: weekStart.getFullYear(), month: weekStart.getMonth() }]
    if (weekEnd.getMonth() !== weekStart.getMonth() || weekEnd.getFullYear() !== weekStart.getFullYear()) {
      months.push({ year: weekEnd.getFullYear(), month: weekEnd.getMonth() })
    }
    return months
  }, [calView, year, month, day])

  useEffect(() => {
    if (!icsCalendars.length) { setIcsEventsByDate({}); return }
    Promise.all(
      icsCalendars.flatMap(cal =>
        monthsToFetch.map(({ year: y, month: m }) =>
          api.getIcsEvents(cal.id, y, m + 1).then(evs => ({ cal, evs: evs || [] })).catch(() => ({ cal, evs: [] }))
        )
      )
    ).then(results => {
      const byDate = {}
      results.forEach(({ cal, evs }) => {
        evs.forEach(ev => {
          if (!byDate[ev.due_date]) byDate[ev.due_date] = []
          byDate[ev.due_date].push({ ...ev, _color: cal.color, _calName: cal.name })
        })
      })
      setIcsEventsByDate(byDate)
    })
  }, [icsCalendars, monthsToFetch])

  // ── Desktop drag ──────────────────────────────────────────────
  const handleDragStart = useCallback((e, task) => {
    dragTask.current = task
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e, dateStr) => {
    e.preventDefault()
    setOverDate(dateStr)
  }, [])

  // Schedule a task from a drop key. Keys are either `YYYY-MM-DD` (date only,
  // e.g. all-day rows / month cells) or `YYYY-MM-DD|HH:00:00` (date + time,
  // from an hour cell). Shared by desktop drop and mobile touch drop.
  const applyDrop = useCallback(async (task, key) => {
    if (!task || !key) return

    const pipe = key.indexOf('|')
    const dateStr = pipe >= 0 ? key.slice(0, pipe) : key
    const timeStr = pipe >= 0 ? key.slice(pipe + 1) : null

    const updates = { due_date: dateStr }
    if (timeStr !== null) updates.due_time = timeStr

    const unchanged = task.due_date === dateStr && (timeStr === null || task.due_time === timeStr)
    if (unchanged) return

    dispatch({ type: 'UPDATE_TASK', payload: { ...task, ...updates } })
    await updateTask(task.id, updates)
  }, [dispatch, updateTask])

  const handleDrop = useCallback((e, key) => {
    e.preventDefault()
    const task = dragTask.current
    setOverDate(null)
    dragTask.current = null
    applyDrop(task, key)
  }, [applyDrop])

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
    let best = null
    let bestArea = Infinity
    for (const [key, el] of Object.entries(cellRefs.current)) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const area = r.width * r.height
        if (area < bestArea) { bestArea = area; best = key }
      }
    }
    return best
  }, [])

  useEffect(() => () => {
    const { onMove, onEnd } = touchListeners.current
    if (onMove) window.removeEventListener('touchmove', onMove)
    if (onEnd)  window.removeEventListener('touchend',  onEnd)
    ghostEl.current?.remove()
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
      touchListeners.current = { onMove: null, onEnd: null }
      const task = dragTask.current
      const t = ev.changedTouches[0]
      const targetKey = getDateAtPoint(t.clientX, t.clientY)
      removeGhost()
      setOverDate(null)
      dragTask.current = null
      // targetKey may carry a time (hour cell) or be date-only — applyDrop handles both.
      await applyDrop(task, targetKey)
    }
    touchListeners.current = { onMove, onEnd }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }, [createGhost, moveGhost, removeGhost, getDateAtPoint, applyDrop])

  // ── Navigation ────────────────────────────────────────────────
  const navigate = useCallback((dir) => {
    if (calView === 'month') {
      const newMonth = month + dir
      dispatch({ type: 'SET_CAL', payload: {
        year: newMonth < 0 ? year - 1 : newMonth > 11 ? year + 1 : year,
        month: (newMonth + 12) % 12,
      }})
    } else if (calView === 'week') {
      const d = new Date(year, month, day)
      d.setDate(d.getDate() + dir * 7)
      dispatch({ type: 'SET_CAL', payload: { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() } })
    } else {
      const d = new Date(year, month, day)
      d.setDate(d.getDate() + dir)
      dispatch({ type: 'SET_CAL', payload: { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() } })
    }
  }, [calView, year, month, day, dispatch])

  // ── Header label ──────────────────────────────────────────────
  const headerLabel = useMemo(() => {
    if (calView === 'month') return `${MONTHS[month]} ${year}`
    if (calView === 'day') {
      const d = new Date(year, month, day)
      return `${DAYS[d.getDay()]}, ${MONTHS_SHORT[month]} ${day}`
    }
    // week
    const anchor = new Date(year, month, day)
    const weekStart = new Date(anchor)
    weekStart.setDate(anchor.getDate() - anchor.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const startLabel = `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}`
    const endLabel = weekEnd.getMonth() !== weekStart.getMonth()
      ? `${MONTHS_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}`
      : String(weekEnd.getDate())
    return `${startLabel} – ${endLabel}, ${weekEnd.getFullYear()}`
  }, [calView, year, month, day])

  // ── Computed data ─────────────────────────────────────────────
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

  const weekDays = useMemo(() => {
    const anchor = new Date(year, month, day)
    const weekStart = new Date(anchor)
    weekStart.setDate(anchor.getDate() - anchor.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  }, [year, month, day])

  const currentDateStr = useMemo(() =>
    `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    [year, month, day]
  )

  const { projects } = state
  const unscheduled = useMemo(
    () => tasks.filter(t => !t.due_date && t.status !== 'done'),
    [tasks]
  )

  const dragProps = { onDragStart: handleDragStart, onTouchStart: handleTouchStart, handleDragOver, handleDrop, setOverDate, overDate, cellRefs }

  return (
    <div className="flex h-full gap-3 p-3 pb-0 min-w-0">
      {/* ── Calendar ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <button onClick={() => navigate(-1)} className="p-1.5 text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg rounded-lg hover:bg-td-surface dark:hover:bg-tn-surface">
            <ChevronLeft size={18} />
          </button>
          <span className="text-td-fg dark:text-tn-fg font-semibold text-sm">
            {headerLabel}
          </span>
          <button onClick={() => navigate(1)} className="p-1.5 text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg rounded-lg hover:bg-td-surface dark:hover:bg-tn-surface">
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day-of-week header row (month + week only) */}
        {calView !== 'day' && (
          <div className="grid grid-cols-7 mb-1 shrink-0">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-td-muted/60 dark:text-tn-muted/60 uppercase py-1">
                {d}
              </div>
            ))}
          </div>
        )}

        {/* View body */}
        {calView === 'month' && (
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
                  const dayIcs   = (dateStr && icsEventsByDate[dateStr]) || []
                  const isOver = dateStr && overDate === dateStr
                  const totalItems = dayTasks.length + dayIcs.length
                  const MAX_SHOW = totalItems > 0 ? 4 : 2

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
                        {dayIcs.slice(0, MAX_SHOW).map(ev => (
                          <IcsPill key={ev.id + ev.due_date} event={ev} color={ev._color} />
                        ))}
                        {dayTasks.slice(0, Math.max(0, MAX_SHOW - dayIcs.length)).map(t => (
                          <TaskPill key={t.id} task={t} onDragStart={handleDragStart} onTouchStart={handleTouchStart} />
                        ))}
                        {totalItems > MAX_SHOW && (
                          <div className="text-[9px] text-td-muted/60 dark:text-tn-muted/60 pl-1">
                            +{totalItems - MAX_SHOW} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {calView === 'week' && (
          <WeekView
            weekDays={weekDays}
            tasksByDate={tasksByDate}
            icsEventsByDate={icsEventsByDate}
            {...dragProps}
          />
        )}

        {calView === 'day' && (
          <DayView
            dateStr={currentDateStr}
            dayTasks={tasksByDate[currentDateStr] || []}
            dayIcs={icsEventsByDate[currentDateStr] || []}
            onDragStart={handleDragStart}
            onTouchStart={handleTouchStart}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            setOverDate={setOverDate}
            overDate={overDate}
            cellRefs={cellRefs}
          />
        )}
      </div>

      {/* ── Unscheduled sidebar (desktop only) ───────────────────── */}
      <div className="hidden lg:flex flex-col w-52 shrink-0 pb-4">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <CalendarDays size={13} className="text-td-muted dark:text-tn-muted" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-td-muted dark:text-tn-muted">
            Unscheduled
          </span>
          <span className="ml-auto text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full">
            {unscheduled.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
          {unscheduled.length === 0 ? (
            <p className="text-[11px] text-td-muted/40 dark:text-tn-muted/40 text-center pt-6">
              All tasks scheduled
            </p>
          ) : (
            unscheduled.map(task => (
              <UnscheduledCard
                key={task.id}
                task={task}
                project={projects.find(p => p.id === task.project_id)}
                onDragStart={handleDragStart}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
