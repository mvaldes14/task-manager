import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { Skeleton } from '../ui'
import { STATUS_LABELS, STATUS_ORDER, groupKey } from './grouping'

function TaskRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-td-border/30 dark:border-tn-border/30 last:border-0">
      <Skeleton className="w-5 h-5 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2 pt-0.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  )
}

export function TaskListSkeleton({ count = 7 }) {
  return (
    <div>
      {Array.from({ length: count }, (_, i) => <TaskRowSkeleton key={i} />)}
    </div>
  )
}

function GroupSection({ label, count, children, isCollapsed, onToggle }) {
  const itemsId = useId()

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-controls={itemsId}
        className="w-full min-h-11 flex items-center gap-2 px-4 py-2 sticky top-0 bg-td-bg dark:bg-tn-bg z-10 text-left transition-all duration-fast ease-standard active:opacity-70"
      >
        <ChevronRight
          size={14}
          className={`shrink-0 text-td-muted dark:text-tn-muted transition-transform duration-fast ease-standard ${isCollapsed ? '' : 'rotate-90'}`}
        />
        <span className="text-xs md:text-[10px] font-semibold tracking-widest text-td-muted dark:text-tn-muted uppercase">
          {label}
        </span>
        <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full">
          {count}
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-base ease-standard"
        style={{ gridTemplateRows: isCollapsed ? '0fr' : '1fr' }}
      >
        <div id={itemsId} className="overflow-hidden min-h-0">
          {children}
        </div>
      </div>
    </section>
  )
}

export function TaskList({ tasks, groupBy = 'status', projects = [], emptyMessage = 'No tasks here', isCollapsed = () => false, toggle = () => {} }) {
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
      <div>
        <div className="divide-y divide-td-border/30 dark:divide-tn-border/30">
          {groups.map(({ status, items }) => {
            const key = groupKey('status', STATUS_LABELS[status])
            return (
              <GroupSection
                key={status}
                label={STATUS_LABELS[status]}
                count={items.length}
                isCollapsed={isCollapsed(key)}
                onToggle={() => toggle(key)}
              >
                {items.map(task => <TaskCard key={task.id} task={task} />)}
              </GroupSection>
            )
          })}
        </div>
      </div>
    )
  }

  if (groupBy === 'project') {
    // Preserve the app's project ordering; append "(no project)" last
    const groups = projects
      .map(p => ({ key: groupKey('project', p.id), label: p.name, items: tasks.filter(t => t.project_id === p.id) }))
      .filter(g => g.items.length > 0)
    const orphans = tasks.filter(t => !t.project_id)
    if (orphans.length) groups.push({ key: groupKey('project', 'none'), label: '(no project)', items: orphans })

    return (
      <div>
        <div className="divide-y divide-td-border/30 dark:divide-tn-border/30">
          {groups.map(({ key, label, items }) => (
            <GroupSection
              key={key}
              label={label}
              count={items.length}
              isCollapsed={isCollapsed(key)}
              onToggle={() => toggle(key)}
            >
              {items.map(task => <TaskCard key={task.id} task={task} />)}
            </GroupSection>
          ))}
        </div>
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
      <div>
        <div className="divide-y divide-td-border/30 dark:divide-tn-border/30">
          {sorted.map(([tag, items]) => {
            const key = groupKey('tags', tag)
            return (
              <GroupSection
                key={tag}
                label={tag}
                count={items.length}
                isCollapsed={isCollapsed(key)}
                onToggle={() => toggle(key)}
              >
                {items.map(task => <TaskCard key={task.id} task={task} />)}
              </GroupSection>
            )
          })}
        </div>
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
