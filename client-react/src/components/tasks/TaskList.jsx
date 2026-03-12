import { TaskCard } from './TaskCard'

const STATUS_LABELS = { todo: 'TO DO', doing: 'IN PROGRESS', done: 'DONE' }
const STATUS_ORDER = ['todo', 'doing', 'done']

function GroupSection({ label, count, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-td-bg dark:bg-tn-bg z-10">
        <span className="text-[10px] font-semibold tracking-widest text-td-muted dark:text-tn-muted uppercase">
          {label}
        </span>
        <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full">
          {count}
        </span>
      </div>
      <div>{children}</div>
    </section>
  )
}

export function TaskList({ tasks, groupBy = 'status', emptyMessage = 'No tasks here' }) {
  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-td-muted dark:text-tn-muted">
        <span className="text-4xl mb-3">✓</span>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  if (groupBy === 'status') {
    const groups = STATUS_ORDER
      .map(status => ({ status, items: tasks.filter(t => t.status === status) }))
      .filter(g => g.items.length > 0)

    return (
      <div className="divide-y divide-td-border/30 dark:divide-tn-border/30">
        {groups.map(({ status, items }) => (
          <GroupSection key={status} label={STATUS_LABELS[status]} count={items.length}>
            {items.map(task => <TaskCard key={task.id} task={task} />)}
          </GroupSection>
        ))}
      </div>
    )
  }

  if (groupBy === 'tags') {
    // Build tag → tasks map; tasks with multiple tags appear in each group
    const tagMap = new Map()
    tasks.forEach(task => {
      const tags = task.tags?.length ? task.tags : ['(no tag)']
      tags.forEach(tag => {
        if (!tagMap.has(tag)) tagMap.set(tag, [])
        tagMap.get(tag).push(task)
      })
    })
    // Sort: named tags alphabetically, (no tag) always last
    const sorted = [...tagMap.entries()].sort(([a], [b]) => {
      if (a === '(no tag)') return 1
      if (b === '(no tag)') return -1
      return a.localeCompare(b)
    })

    return (
      <div className="divide-y divide-td-border/30 dark:divide-tn-border/30">
        {sorted.map(([tag, items]) => (
          <GroupSection key={tag} label={tag} count={items.length}>
            {items.map(task => <TaskCard key={task.id} task={task} />)}
          </GroupSection>
        ))}
      </div>
    )
  }

  // flat list
  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
    </div>
  )
}
