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

export function recurrenceLabel(ruleStr) {
  if (!ruleStr) return null
  try {
    const r = typeof ruleStr === 'string' ? JSON.parse(ruleStr) : ruleStr
    if (r.type === 'daily') return '🔁 Daily'
    if (r.type === 'weekly') {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      if (r.days?.length === 5 && r.days.join(',') === '1,2,3,4,5') return '🔁 Weekdays'
      if (r.days?.length) return '🔁 ' + r.days.map(d => days[d]).join(', ')
      return '🔁 Weekly'
    }
    if (r.type === 'monthly_dom') return r.dom === -1 ? '🔁 End of month' : r.dom ? `🔁 Monthly (${r.dom}${ordinal(r.dom)})` : '🔁 Monthly'
    if (r.type === 'monthly_dow') {
      const weeks = ['1st','2nd','3rd','4th','5th']
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      return `🔁 ${weeks[r.week] || ''} ${days[r.dow] || ''} of month`
    }
    if (r.type === 'monthly') return '🔁 Monthly'
    if (r.type === 'yearly') return '🔁 Yearly'
    if (r.type === 'interval') return `🔁 Every ${r.days || r.interval} days`
  } catch { /* */ }
  return null
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100
  return s[(v-20)%10] || s[v] || s[0]
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
