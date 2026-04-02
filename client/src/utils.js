export function formatDate(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return '📅 Today'
  if (date.toDateString() === tomorrow.toDateString()) return '📅 Tomorrow'
  if (date.toDateString() === yesterday.toDateString()) return '📅 Yesterday'
  return '📅 ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false
  const due = new Date(task.due_date + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  return due < today
}

export function isToday(task) {
  if (!task.due_date) return false
  const due = new Date(task.due_date + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  return due.toDateString() === today.toDateString()
}

export function priorityColor(p) {
  if (p === 'high')   return '#f7768e'
  if (p === 'medium') return '#e0af68'
  return '#565f89'
}

function ordinal(n) {
  const abs = Math.abs(n)
  const s = ['th','st','nd','rd'], v = abs % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

export function recurrenceLabel(ruleStr) {
  if (!ruleStr) return null
  try {
    // RRULE string format: "RRULE:FREQ=WEEKLY;BYDAY=MO,FR"
    const src = ruleStr.startsWith('RRULE:') ? ruleStr.slice(6) : ruleStr
    const props = Object.fromEntries(src.split(';').map(p => p.split('=')))
    const freq     = props.FREQ     || ''
    const interval = parseInt(props.INTERVAL || '1', 10)
    const byday    = props.BYDAY    || ''
    const bymd     = props.BYMONTHDAY || ''

    const DAY = { MO:'Mon', TU:'Tue', WE:'Wed', TH:'Thu', FR:'Fri', SA:'Sat', SU:'Sun' }

    if (freq === 'DAILY')
      return interval === 1 ? '🔁 Daily' : `🔁 Every ${interval} days`

    if (freq === 'WEEKLY') {
      const days = byday.split(',').filter(Boolean)
      const daySet = new Set(days)
      let label
      if (daySet.size === 5 && ['MO','TU','WE','TH','FR'].every(d => daySet.has(d)))
        label = 'Weekdays'
      else if (daySet.size === 2 && daySet.has('SA') && daySet.has('SU'))
        label = 'Weekends'
      else if (days.length)
        label = days.map(d => DAY[d] || d).join(', ')
      else
        label = 'Weekly'
      return interval === 1 ? `🔁 ${label}` : `🔁 Every ${interval} weeks · ${label}`
    }

    if (freq === 'MONTHLY') {
      if (byday) {
        const m = byday.match(/^(-?\d+)(MO|TU|WE|TH|FR|SA|SU)$/)
        if (m) {
          const n = parseInt(m[1], 10)
          const ordMap = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th', [-1]:'Last' }
          const ordLabel = ordMap[n] || `${n}th`
          return `🔁 ${ordLabel} ${DAY[m[2]] || m[2]} of month`
        }
      }
      if (bymd) {
        const dom = parseInt(bymd, 10)
        if (dom === -1) return '🔁 End of month'
        return `🔁 ${dom}${ordinal(dom)} of month`
      }
      return '🔁 Monthly'
    }

    if (freq === 'YEARLY') return '🔁 Yearly'


  } catch { /* */ }
  return null
}

export function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2,'0')}${ampm}`
}

// ── Shared link utilities (used by TaskCard and TaskDetail) ────────────────

// Returns [{label, isoDate}] quick-reschedule options for overdue tasks
export function rescheduleOptions() {
  const today = new Date(); today.setHours(0,0,0,0)
  const fmt = d => d.toISOString().slice(0, 10)

  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

  const weekend = new Date(today)
  const dayOfWeek = today.getDay() // 0=Sun … 6=Sat
  const daysUntilSat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek
  weekend.setDate(today.getDate() + daysUntilSat)

  const nextMonday = new Date(today)
  const daysUntilMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  nextMonday.setDate(today.getDate() + daysUntilMon)

  const twoWeeks = new Date(today); twoWeeks.setDate(today.getDate() + 14)

  return [
    { label: 'Tomorrow',   isoDate: fmt(tomorrow) },
    { label: 'Weekend',    isoDate: fmt(weekend) },
    { label: 'Next week',  isoDate: fmt(nextMonday) },
    { label: 'In 2 weeks', isoDate: fmt(twoWeeks) },
  ]
}

export function getLinkLabel(url = '') {
  if (url.startsWith('obsidian://')) return 'Obsidian Note'
  if (url.includes('github.com'))   return 'GitHub'
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'Link' }
}

export function getLinkStyle(url = '', dark = false) {
  if (url.startsWith('obsidian://')) return dark
    ? { color: '#bb9af7', bg: 'rgba(187,154,247,0.15)' }
    : { color: '#7c4fb5', bg: 'rgba(187,154,247,0.18)' }
  if (url.includes('github.com'))   return dark
    ? { color: '#57606a', bg: 'rgba(87,96,106,0.12)' }
    : { color: '#24292f', bg: 'rgba(87,96,106,0.14)' }
  return dark
    ? { color: '#e0af68', bg: 'rgba(224,175,104,0.15)' }
    : { color: '#8f6120', bg: 'rgba(224,175,104,0.20)' }
}
