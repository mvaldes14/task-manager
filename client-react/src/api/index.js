const base = '/api'
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

async function req(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(base + path, opts)
  if (res.status === 401) {
    window.location.reload()
    return null
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json().catch(() => null)
}

export const api = {
  // Auth
  login: (username, password, remember) =>
    req('/login', 'POST', { username, password, remember }),
  logout: () => req('/logout', 'POST'),

  // Projects
  getProjects: () => req('/projects'),
  createProject: (data) => req('/projects', 'POST', data),
  updateProject: (id, data) => req(`/projects/${id}`, 'PATCH', data),
  deleteProject: (id) => req(`/projects/${id}`, 'DELETE'),

  // Tasks — always include browser timezone so GCal events land at the right time
  getTasks: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return req('/tasks' + (q ? '?' + q : ''))
  },
  getToday: () => req('/tasks/today'),
  getOverdue: () => req('/tasks/overdue'),
  createTask: (data) => req('/tasks', 'POST', { ...data, timezone: TZ }),
  updateTask: (id, data) => req(`/tasks/${id}`, 'PATCH', { ...data, timezone: TZ }),
  deleteTask: (id) => req(`/tasks/${id}`, 'DELETE'),
  reorderTasks: (data) => req('/tasks/reorder', 'POST', data),

  // Subtasks
  createSubtask: (taskId, data) => req(`/tasks/${taskId}/subtasks`, 'POST', data),
  updateSubtask: (taskId, subId, data) => req(`/tasks/${taskId}/subtasks/${subId}`, 'PATCH', data),
  deleteSubtask: (taskId, subId) => req(`/tasks/${taskId}/subtasks/${subId}`, 'DELETE'),

  // NLP
  parseNlp: (text) => req('/nlp/parse', 'POST', { text }),

  // GCal
  gcalStatus: () => req('/gcal/status'),
  gcalSync: () => req('/gcal/sync', 'POST'),

  // ICS Calendars
  listIcs: () => req('/ics'),
  addIcsUrl: (name, url, color) => req('/ics', 'POST', { name, url, color }),
  addIcsFile: (name, color, file) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name)
    fd.append('color', color)
    return fetch(base + '/ics', { method: 'POST', body: fd, credentials: 'include' })
      .then(r => r.json())
  },
  deleteIcs: (id) => req(`/ics/${id}`, 'DELETE'),
  getIcsEvents: (id, year, month) => req(`/ics/${id}/events?year=${year}&month=${month}`),
  getSettings: () => fetch('/auth/status', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
  updateSettings: (data) => req('/settings', 'PATCH', data),
}
