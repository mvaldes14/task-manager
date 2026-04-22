import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { api } from '../../api'
import { isOverdue, fmtTime, priorityColor, rescheduleOptions } from '../../utils'
import { Clock, ChevronRight } from 'lucide-react'

function FocusCard({ task }) {
  const { state, dispatch } = useApp()
  const { toggleTask } = useTasks()
  const project = state.projects.find(p => p.id === task.project_id)
  const done = task.status === 'done'
  const subtasksDone = (task.subtasks || []).filter(s => s.completed).length
  const subtasksTotal = (task.subtasks || []).length
  const accentColor = project?.color || '#7aa2f7'

  const handleSubtaskToggle = async (e, sub) => {
    e.stopPropagation()
    try {
      await api.updateSubtask(task.id, sub.id, { completed: !sub.completed })
      const updated = await api.getTask(task.id)
      if (updated) dispatch({ type: 'UPDATE_TASK', payload: updated })
    } catch {
      // silent
    }
  }

  return (
    <div
      className="relative border-b border-td-border/30 dark:border-tn-border/30 cursor-pointer"
      style={{
        background: `linear-gradient(180deg, ${accentColor}0d, transparent 80%)`,
        borderLeft: `3px solid ${accentColor}`,
      }}
      onClick={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
    >
      <div className="px-5 py-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold tracking-widest" style={{ color: accentColor }}>
            ★ FOCUS
          </span>
          <span className="text-[10px] text-td-muted dark:text-tn-muted">Your top task today</span>
        </div>

        <div className="flex items-start gap-3.5">
          <button
            onClick={e => { e.stopPropagation(); toggleTask(task.id, task.status) }}
            className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
              ${done
                ? 'border-td-green dark:border-tn-green bg-td-green/20 dark:bg-tn-green/20'
                : 'border-td-muted/50 dark:border-tn-muted/50 hover:border-td-blue dark:hover:border-tn-blue'
              }`}
            aria-label="Toggle task"
          >
            {done && (
              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                <path d="M1 4.5L4 7.5L10 1" stroke="#9ece6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p className={`text-lg font-semibold leading-snug
              ${done ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
              {task.title}
            </p>

            {task.description && (
              <p className="text-sm text-td-muted dark:text-tn-muted mt-1.5 line-clamp-2">
                {task.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3 text-xs text-td-muted dark:text-tn-muted flex-wrap">
              {project && (
                <span className="flex items-center gap-1.5" style={{ color: accentColor }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
                  {project.name}
                </span>
              )}
              {task.due_time && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />{fmtTime(task.due_time)}
                </span>
              )}
              {(task.tags || []).map(tag => (
                <span key={tag} className="text-td-purple dark:text-tn-purple">@{tag}</span>
              ))}
            </div>

            {subtasksTotal > 0 && (
              <div
                className="mt-4 p-3 bg-td-surface/50 dark:bg-tn-surface/30 rounded-lg"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-td-muted dark:text-tn-muted font-medium">
                    {subtasksDone}/{subtasksTotal} subtasks
                  </span>
                  <div className="flex-1 h-1 bg-td-border dark:bg-tn-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{
                        width: `${(subtasksDone / subtasksTotal) * 100}%`,
                        background: accentColor,
                      }}
                    />
                  </div>
                </div>
                {(task.subtasks || []).map(sub => (
                  <div
                    key={sub.id}
                    onClick={e => handleSubtaskToggle(e, sub)}
                    className="flex items-center gap-2.5 py-1.5 cursor-pointer group/sub"
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all
                        ${sub.completed
                          ? 'border-td-green dark:border-tn-green bg-td-green/20 dark:bg-tn-green/20'
                          : 'border-td-muted/40 dark:border-tn-muted/40 group-hover/sub:border-td-blue dark:group-hover/sub:border-tn-blue'
                        }`}
                    >
                      {sub.completed && (
                        <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
                          <path d="M1 3L2.5 4.5L6 1" stroke="#9ece6a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-[12px] ${sub.completed ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-muted dark:text-tn-nav'}`}>
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SupportingRow({ task, isLast }) {
  const { state, dispatch } = useApp()
  const { toggleTask, updateTask } = useTasks()
  const project = state.projects.find(p => p.id === task.project_id)
  const done = task.status === 'done'
  const overdue = isOverdue(task)

  return (
    <>
      <div
        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
          hover:bg-td-surface/30 dark:hover:bg-tn-surface/20
          ${!isLast ? 'border-b border-td-border/20 dark:border-tn-border/20' : ''}`}
        onClick={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
      >
        <button
          onClick={e => { e.stopPropagation(); toggleTask(task.id, task.status) }}
          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all
            ${done
              ? 'border-td-green dark:border-tn-green bg-td-green/20 dark:bg-tn-green/20'
              : 'border-td-muted/40 dark:border-tn-muted/40 hover:border-td-blue dark:hover:border-tn-blue'
            }`}
          aria-label="Toggle task"
        >
          {done && (
            <svg width="7" height="6" viewBox="0 0 7 6" fill="none">
              <path d="M1 3L2.5 4.5L6 1" stroke="#9ece6a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${done ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {project && (
              <span className="text-[11px] flex items-center gap-1" style={{ color: project.color }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: project.color }} />
                {project.name}
              </span>
            )}
            {task.due_time && (
              <span className="text-[11px] text-td-muted dark:text-tn-muted flex items-center gap-1">
                <Clock size={9} />{fmtTime(task.due_time)}
              </span>
            )}
            {overdue && (
              <span className="text-[11px] text-td-red dark:text-tn-red font-medium">overdue</span>
            )}
          </div>
        </div>

        {task.priority && task.priority !== 'low' && (
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: priorityColor(task.priority) }}
          />
        )}
        <ChevronRight size={12} className="text-td-muted/30 dark:text-tn-muted/30 shrink-0" />
      </div>

      {overdue && !done && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2" onClick={e => e.stopPropagation()}>
          {rescheduleOptions().map(({ label, isoDate }) => (
            <button
              key={label}
              onClick={() => updateTask(task.id, { due_date: isoDate })}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border
                border-td-red/40 dark:border-tn-red/40 text-td-red dark:text-tn-red
                hover:bg-td-red/10 dark:hover:bg-tn-red/10 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

export function PriorityTodayView({ tasks }) {
  const { todayTasks, overdueTasks } = useMemo(() => ({
    todayTasks: tasks.filter(t => !isOverdue(t)),
    overdueTasks: tasks.filter(t => isOverdue(t)),
  }), [tasks])

  const sorted = useMemo(() => (
    [...todayTasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2
      const pb = PRIORITY_ORDER[b.priority] ?? 2
      if (pa !== pb) return pa - pb
      return new Date(a.created_at) - new Date(b.created_at)
    })
  ), [todayTasks])

  const focusTask = sorted[0] || null
  const supportingTasks = sorted.slice(1)

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-td-muted dark:text-tn-muted">
        <span className="text-4xl mb-3">✓</span>
        <p className="text-sm">Nothing due today</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-td-border/30 dark:divide-tn-border/30">
      {overdueTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-td-bg dark:bg-tn-bg z-10">
            <span className="text-[10px] font-semibold tracking-widest text-td-red dark:text-tn-red uppercase">OVERDUE</span>
            <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full">
              {overdueTasks.length}
            </span>
          </div>
          <div>
            {overdueTasks.map((task, i) => (
              <SupportingRow key={task.id} task={task} isLast={i === overdueTasks.length - 1} />
            ))}
          </div>
        </section>
      )}

      {focusTask && (
        <section>
          <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-td-bg dark:bg-tn-bg z-10">
            <span className="text-[10px] font-semibold tracking-widest text-td-muted dark:text-tn-muted uppercase">TODAY</span>
          </div>
          <FocusCard task={focusTask} />
        </section>
      )}

      {supportingTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-td-bg dark:bg-tn-bg z-10">
            <span className="text-[10px] font-semibold tracking-widest text-td-muted dark:text-tn-muted uppercase">SUPPORTING</span>
            <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full">
              {supportingTasks.length}
            </span>
          </div>
          <div>
            {supportingTasks.map((task, i) => (
              <SupportingRow key={task.id} task={task} isLast={i === supportingTasks.length - 1} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
