import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function TaskPill({ task }) {
  const { dispatch } = useApp()
  const done = task.status === 'done'
  return (
    <button
      onClick={e => { e.stopPropagation(); dispatch({ type: 'SELECT_TASK', payload: task.id }) }}
      className="w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate font-medium transition-opacity hover:opacity-80"
      style={{
        background: done ? 'rgba(86,95,137,0.15)' : 'rgba(122,162,247,0.15)',
        color: done ? '#565f89' : '#7aa2f7',
        textDecoration: done ? 'line-through' : 'none',
      }}
    >
      {task.title}
    </button>
  )
}

export function CalendarView({ tasks }) {
  const { state, dispatch } = useApp()
  const { calYear: year, calMonth: month } = state

  const today = new Date()

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
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: daysInPrev - firstDay + i + 1, cur: false })
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ day: i, cur: true })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: cells.length - daysInMonth - firstDay + 1, cur: false })
    }

    const weeks = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    return { weeks, tasksByDate }
  }, [year, month, tasks])

  const prev = () => {
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    dispatch({ type: 'SET_CAL', payload: { year: y, month: m } })
  }
  const next = () => {
    const m = month === 11 ? 0 : month + 1
    const y = month === 11 ? year + 1 : year
    dispatch({ type: 'SET_CAL', payload: { year: y, month: m } })
  }

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1.5 text-td-muted dark:text-tn-muted hover:text-td-fg dark:text-tn-fg rounded-lg hover:bg-td-surface dark:bg-tn-surface">
          <ChevronLeft size={18} />
        </button>
        <span className="text-td-fg dark:text-tn-fg font-semibold text-sm">
          {MONTHS[month]} {year}
        </span>
        <button onClick={next} className="p-1.5 text-td-muted dark:text-tn-muted hover:text-td-fg dark:text-tn-fg rounded-lg hover:bg-td-surface dark:bg-tn-surface">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-td-muted/60 dark:text-tn-muted/60 uppercase py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-px">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((cell, di) => {
              const isToday = cell.cur &&
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === cell.day

              const dateStr = cell.cur
                ? `${year}-${String(month+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`
                : null
              const dayTasks = (dateStr && tasksByDate[dateStr]) || []
              const MAX_SHOW = 2

              return (
                <div
                  key={di}
                  className={`min-h-[72px] p-1 rounded-lg transition-colors
                    ${cell.cur ? 'bg-td-bg3/40 dark:bg-tn-bg3/40 hover:bg-td-bg3 dark:bg-tn-bg3' : 'bg-transparent opacity-30'}
                    ${isToday ? 'ring-1 ring-td-blue/50 dark:ring-tn-blue/50' : ''}`}
                >
                  <div className={`text-[11px] font-medium mb-1 text-right
                    ${isToday ? 'text-td-blue dark:text-tn-blue' : cell.cur ? 'text-td-muted dark:text-tn-muted' : 'text-td-muted/40 dark:text-tn-muted/40'}`}>
                    {cell.day}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayTasks.slice(0, MAX_SHOW).map(t => <TaskPill key={t.id} task={t} />)}
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
