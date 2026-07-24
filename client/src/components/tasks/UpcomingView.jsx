import { useMemo } from 'react'
import { TaskCard } from './TaskCard'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

// Day header label: Today / Tomorrow for those two dates, otherwise "Wed, Jul 29".
// Mirrors DashboardView's formatUpNextWhen so the dashboard stays untouched.
function formatDayHeader(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function UpcomingView({ tasks, range }) {
  const n = range === '14' ? 14 : 7

  const groups = useMemo(() => {
    const byDate = {}
    tasks.forEach(t => {
      const d = t.due_date
      if (!d) return
      if (!byDate[d]) byDate[d] = []
      byDate[d].push(t)
    })
    // Sort each day: timed first (chronological), nulls last, then priority.
    Object.values(byDate).forEach(items => items.sort((a, b) => {
      if (a.due_time && b.due_time) {
        if (a.due_time !== b.due_time) return a.due_time.localeCompare(b.due_time)
      } else if (a.due_time) return -1
      else if (b.due_time) return 1
      const pa = PRIORITY_ORDER[a.priority] ?? 2
      const pb = PRIORITY_ORDER[b.priority] ?? 2
      return pa - pb
    }))
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
  }, [tasks])

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-td-muted dark:text-tn-muted">
        <span className="text-4xl mb-3">🗓️</span>
        <p className="text-sm">Nothing coming up in the next {n} days</p>
      </div>
    )
  }

  return (
    <div>
      {groups.map(([date, items]) => (
        <section key={date}>
          <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-td-bg dark:bg-tn-bg z-10">
            <span className="text-[10px] font-semibold tracking-widest text-td-muted dark:text-tn-muted uppercase">
              {formatDayHeader(date)}
            </span>
            <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full">{items.length}</span>
          </div>
          <div>{items.map(t => <TaskCard key={t.id} task={t} />)}</div>
        </section>
      ))}
    </div>
  )
}
