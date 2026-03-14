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

// Backend weekday encoding: Mon=0, Tue=1, …, Sun=6
const _WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export function recurrenceLabel(ruleStr) {
  if (!ruleStr) return null
  try {
    const r = typeof ruleStr === 'string' ? JSON.parse(ruleStr) : ruleStr
    if (r.type === 'daily')       return '🔁 Daily'
    if (r.type === 'yearly')      return '🔁 Yearly'
    if (r.type === 'weekly') {
      if (r.days?.length) return '🔁 ' + r.days.map(d => _WEEKDAYS[d]).join(', ')
      return '🔁 Weekly'
    }
    if (r.type === 'interval')    return `🔁 Every ${r.days} days`
    if (r.type === 'monthly_dom') return r.dom ? `🔁 Monthly (day ${r.dom})` : '🔁 Monthly'
    if (r.type === 'monthly_dow') return '🔁 Monthly (weekday)'
  } catch { /* */ }
  return null
}

export function obsidianNoteName(url) {
  if (!url) return null
  const m = url.match(/open\?vault=[^&]+&file=([^&]+)/)
  if (m) return decodeURIComponent(m[1].replace(/\.md$/, ''))
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
