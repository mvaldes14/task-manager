// Grouping helpers shared between TaskList (renders the groups) and MainContent
// (owns the collapsed-groups state + the toolbar "Collapse all" toggle).

export const STATUS_LABELS = { todo: 'TO DO', doing: 'IN PROGRESS', blocked: 'BLOCKED', done: 'DONE' }
export const STATUS_ORDER = ['todo', 'doing', 'blocked', 'done']

export function groupKey(groupBy, label) {
  return `${groupBy}:${label}`
}

// Ordered list of collapsible group keys for a given grouping.
// Kept in sync with the rendering logic in TaskList.
export function getGroupKeys(groupBy, tasks) {
  if (!tasks?.length) return []
  if (groupBy === 'status') {
    return STATUS_ORDER
      .filter(status => tasks.some(t => t.status === status))
      .map(status => groupKey('status', STATUS_LABELS[status]))
  }
  if (groupBy === 'tags') {
    const tagSet = new Set()
    tasks.forEach(task => {
      const tags = task.tags?.length ? task.tags : ['(no tag)']
      tags.forEach(tag => tagSet.add(tag))
    })
    const sorted = [...tagSet].sort((a, b) => {
      if (a === '(no tag)') return 1
      if (b === '(no tag)') return -1
      return a.localeCompare(b)
    })
    return sorted.map(tag => groupKey('tags', tag))
  }
  return []
}
