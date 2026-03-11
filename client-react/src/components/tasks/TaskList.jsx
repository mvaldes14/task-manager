import { TaskCard } from './TaskCard'

const STATUS_LABELS = { todo: 'TO DO', doing: 'IN PROGRESS', done: 'DONE' }
const STATUS_ORDER = ['todo', 'doing', 'done']

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
          <section key={status}>
            <div>
              {items.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          </section>
        ))}
      </div>
    )
  }

  // flat list (e.g. for today/overdue)
  return (
    <div>
      {tasks.map(task => <TaskCard key={task.id} task={task} />)}
    </div>
  )
}
