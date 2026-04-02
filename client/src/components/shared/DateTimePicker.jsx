import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function buildCalendar(year, month) {
  const first = new Date(year, month, 1).getDay()       // 0=Sun
  const total = new Date(year, month + 1, 0).getDate()  // days in month
  const cells = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  return cells
}

function toIso(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseIso(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m - 1, day: d }
}

// ── DateTimePicker ─────────────────────────────────────────────────────────────
// Props:
//   date     — ISO date string "YYYY-MM-DD" or ''
//   time     — "HH:MM" or ''  (omit prop entirely to hide time row)
//   onChange — ({ date, time }) => void  (only changed key is passed)
//   onClear  — () => void  (renders an × button when provided)
//   placeholder — string  (button label when no date set)
export function DateTimePicker({ date, time, onChange, onClear, placeholder = 'Set date' }) {
  const parsed = parseIso(date)
  const today  = new Date()

  const [open, setOpen]       = useState(false)
  const [viewYear, setYear]   = useState(parsed?.year  ?? today.getFullYear())
  const [viewMonth, setMonth] = useState(parsed?.month ?? today.getMonth())
  const [timeVal, setTimeVal] = useState(time ?? '')
  const ref = useRef(null)

  // sync external value changes
  useEffect(() => { setTimeVal(time ?? '') }, [time])
  useEffect(() => {
    if (parsed) { setYear(parsed.year); setMonth(parsed.month) }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  // close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const prevMonth = () => {
    if (viewMonth === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const selectDay = (day) => {
    if (!day) return
    onChange({ date: toIso(viewYear, viewMonth, day) })
    // keep open if time row is visible so user can set time
    if (time === undefined) setOpen(false)
  }

  const commitTime = (val) => {
    setTimeVal(val)
    onChange({ time: val || null })
  }

  const cells   = buildCalendar(viewYear, viewMonth)
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate())

  // Display label on trigger button
  let triggerLabel = placeholder
  if (date) {
    const d = parseIso(date)
    const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    triggerLabel = label
    if (time) triggerLabel += ' · ' + fmtTime(time)
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`flex-1 text-left text-xs rounded-lg px-2.5 py-2 border transition-colors
            bg-td-surface dark:bg-tn-surface border-td-border/50 dark:border-tn-border/50
            hover:border-td-blue/60 dark:hover:border-tn-blue/60
            ${date ? 'text-td-fg dark:text-tn-fg' : 'text-td-muted dark:text-tn-muted'}`}
        >
          {triggerLabel}
        </button>
        {onClear && date && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear() }}
            className="p-1.5 rounded-lg text-td-muted dark:text-tn-muted hover:text-td-red dark:hover:text-tn-red hover:bg-td-red/10 dark:hover:bg-tn-red/10 transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 w-64
          bg-td-surface dark:bg-tn-surface border border-td-border dark:border-tn-border
          rounded-xl shadow-xl animate-fade-in select-none">

          {/* Month navigation */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <button type="button" onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-td-border/40 dark:hover:bg-tn-border/40 transition-colors text-td-muted dark:text-tn-muted">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-td-fg dark:text-tn-fg">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-td-border/40 dark:hover:bg-tn-border/40 transition-colors text-td-muted dark:text-tn-muted">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-td-muted/70 dark:text-tn-muted/70 py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 px-2 pb-2 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} />
              const iso     = toIso(viewYear, viewMonth, day)
              const isToday = iso === todayIso
              const isSel   = iso === date
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`w-full aspect-square rounded-lg text-xs font-medium transition-colors
                    ${isSel
                      ? 'bg-td-blue dark:bg-tn-blue text-white'
                      : isToday
                        ? 'border border-td-blue/50 dark:border-tn-blue/50 text-td-blue dark:text-tn-blue hover:bg-td-blue/10 dark:hover:bg-tn-blue/10'
                        : 'text-td-fg dark:text-tn-fg hover:bg-td-border/40 dark:hover:bg-tn-border/40'
                    }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Time row — only if caller passes a time prop */}
          {time !== undefined && (
            <div className="px-3 pb-3 pt-1 border-t border-td-border/40 dark:border-tn-border/40">
              <div className="flex items-center gap-2 mt-2">
                <Clock size={12} className="text-td-muted dark:text-tn-muted shrink-0" />
                <input
                  type="time"
                  value={timeVal}
                  onChange={e => setTimeVal(e.target.value)}
                  onBlur={e => commitTime(e.target.value)}
                  className="flex-1 bg-td-bg dark:bg-tn-bg text-td-fg dark:text-tn-fg text-xs
                    rounded-lg px-2 py-1.5 outline-none border border-td-border/50 dark:border-tn-border/50
                    focus:border-td-blue/60 dark:focus:border-tn-blue/60 transition-colors"
                />
                {timeVal && (
                  <button type="button" onClick={() => commitTime('')}
                    className="text-td-muted dark:text-tn-muted hover:text-td-red dark:hover:text-tn-red transition-colors">
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${ampm}`
}
