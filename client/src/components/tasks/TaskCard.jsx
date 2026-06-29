import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ProjectIcon } from '../shared/ProjectIcon'
import { useTasks } from '../../hooks/useTasks'
import { formatDate, isOverdue, priorityColor, recurrenceLabel, fmtTime, getLinkLabel, rescheduleOptions } from '../../utils'
import { Paperclip, GitBranch, Link2, Sparkles } from 'lucide-react'
import { AiResultModal } from './AiResultModal'
import { Chip } from '../ui'

function LinkIcon({ url }) {
  if (url.startsWith('obsidian://')) return <Paperclip size={10} />
  if (url.includes('github.com'))   return <GitBranch size={10} />
  return <Link2 size={10} />
}

export function TaskCard({ task }) {
  const { state, dispatch } = useApp()
  const { toggleTask, updateTask } = useTasks()
  const [aiOpen, setAiOpen] = useState(false)
  const project = state.projects.find(p => p.id === task.project_id)
  const overdue = isOverdue(task)
  const done = task.status === 'done'

  const subtasksDone = (task.subtasks || []).filter(s => s.completed).length
  const subtasksTotal = (task.subtasks || []).length

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-fast
        hover:bg-td-surface/50 dark:hover:bg-tn-surface/50 border-b border-td-border/50 dark:border-tn-border/50 last:border-0
        ${done ? 'opacity-50' : ''}`}
      onClick={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
    >
      {/* Checkbox */}
      <button
        className="mt-0.5 shrink-0"
        onClick={e => { e.stopPropagation(); toggleTask(task.id, task.status) }}
        aria-label="Toggle task"
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-fast
          ${done
            ? 'border-td-green dark:border-tn-green bg-td-green/20 dark:bg-tn-green/20'
            : 'border-td-muted/50 dark:border-tn-muted/50 hover:border-td-blue dark:hover:border-tn-blue'
          }`}
        >
          {done && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#9ece6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${done ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
          {task.title}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
          {/* Priority dot — keeps saturated color as a signal */}
          {task.priority && task.priority !== 'low' && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: priorityColor(task.priority) }} />
          )}

          {/* Due date — red only when overdue (signal), muted otherwise */}
          {task.due_date && (
            <span className={`text-xs font-medium ${overdue ? 'text-td-red dark:text-tn-red' : 'text-td-muted dark:text-tn-muted'}`}>
              {formatDate(task.due_date)}{task.due_time ? ' · ' + fmtTime(task.due_time) : ''}
            </span>
          )}

          {/* Project — color dot for identity, muted name so it doesn't shout */}
          {project && (
            <span className="flex items-center gap-1 text-xs text-td-muted dark:text-tn-muted">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project.color }} />
              <ProjectIcon icon={project.icon} size={10} />
              {project.name}
            </span>
          )}

          {/* Tags — neutral chips */}
          {(task.tags || []).map(tag => (
            <Chip key={tag} variant="neutral" label={`@${tag}`} className="px-1.5 py-0.5 rounded-md" />
          ))}

          {/* AI result chip — neutral at rest, slightly interactive */}
          {task.has_ai_result && (
            <Chip
              variant="neutral"
              icon={<Sparkles size={9} />}
              label="AI"
              onClick={e => { e.stopPropagation(); setAiOpen(true) }}
              className="px-1.5 py-0.5 rounded-md hover:bg-td-border/50 dark:hover:bg-tn-border/50"
            />
          )}

          {/* Recurrence — neutral chip */}
          {recurrenceLabel(task.recurrence) && (
            <Chip variant="neutral" label={recurrenceLabel(task.recurrence)} className="px-1.5 py-0.5 rounded-md" />
          )}

          {/* Links — neutral chips; stop propagation so row click doesn't fire */}
          {(task.links || []).map((link, i) => (
            <Chip
              key={i}
              variant="neutral"
              icon={<LinkIcon url={link.url} />}
              label={getLinkLabel(link.url)}
              href={link.url}
              onClick={e => e.stopPropagation()}
              className="px-1.5 py-0.5 rounded-md"
            />
          ))}

          {/* Assignee — neutral chip, only shown when assigned to someone else */}
          {task.assigned_to && task.assigned_to !== state.currentUser?.id && (() => {
            const u = state.users.find(u => u.id === task.assigned_to)
            if (!u) return null
            return (
              <Chip key="assignee" variant="neutral" label={`+${u.display_name || u.username}`} className="px-1.5 py-0.5 rounded-md" />
            )
          })()}

          {/* Subtask progress */}
          {subtasksTotal > 0 && (
            <span className="text-xs text-td-muted dark:text-tn-muted">
              ◦ {subtasksDone}/{subtasksTotal}
            </span>
          )}
        </div>

        {/* Reschedule pills — always visible on touch, revealed on hover for pointer devices */}
        {overdue && !done && (
          <div
            className="flex flex-wrap gap-1.5 mt-2 transition-opacity duration-fast [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
            onClick={e => e.stopPropagation()}
          >
            {rescheduleOptions().map(({ label, isoDate }) => (
              <button
                key={label}
                onClick={() => updateTask(task.id, { due_date: isoDate })}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full border
                  border-td-red/40 dark:border-tn-red/40 text-td-red dark:text-tn-red
                  hover:bg-td-red/10 dark:hover:bg-tn-red/10 transition-colors duration-fast"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chevron — hidden at rest, revealed on row hover */}
      <svg
        className="w-4 h-4 text-td-muted dark:text-tn-muted shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-fast"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
      </svg>

      {aiOpen && <AiResultModal taskId={task.id} onClose={() => setAiOpen(false)} />}
    </div>
  )
}
