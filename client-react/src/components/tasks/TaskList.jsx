import { TaskCard } from './TaskCard'

const STATUS_LABELS = { todo: 'TO DO', doing: 'IN PROGRESS', done: 'DONE' }
const STATUS_ORDER = ['todo', 'doing', 'done']

export function TaskList({ tasks, groupBy = 'status', emptyMessage = 'No tasks here' }) {
  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-tn-muted">
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
      <div className="divide-y divide-tn-border/30">
        {groups.map(({ status, items }) => (
          <section key={status}>
            <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-tn-bg z-10">
              <span className="text-[10px] font-semibold tracking-widest text-tn-muted uppercase">
                {STATUS_LABELS[status]}
              </span>
              <span className="text-[10px] text-tn-muted/60 bg-tn-surface px-1.5 rounded-full">
                {items.length}
              </span>
            </div>
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
