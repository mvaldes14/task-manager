import { useApp } from '../../context/AppContext'
import { ProjectIcon } from '../shared/ProjectIcon'
import { useTasks } from '../../hooks/useTasks'
import { formatDate, isOverdue, priorityColor, recurrenceLabel, obsidianNoteName, fmtTime, getLinkLabel, getLinkStyle } from '../../utils'
import { Paperclip, GitBranch, Link2 } from 'lucide-react'

function LinkIcon({ url }) {
  if (url.startsWith('obsidian://')) return <Paperclip size={10} />
  if (url.includes('github.com'))   return <GitBranch size={10} />
  return <Link2 size={10} />
}

export function TaskCard({ task }) {
  const { state, dispatch } = useApp()
  const { toggleTask } = useTasks()
  const project = state.projects.find(p => p.id === task.project_id)
  const isDark = state.theme === 'dark'
  const overdue = isOverdue(task)
  const done = task.status === 'done'

  const subtasksDone = (task.subtasks || []).filter(s => s.completed).length
  const subtasksTotal = (task.subtasks || []).length

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors
        hover:bg-td-surface/50 dark:bg-tn-surface/50 border-b border-td-border/50 dark:border-tn-border/50 last:border-0
        ${done ? 'opacity-50' : ''}`}
      onClick={() => dispatch({ type: 'SELECT_TASK', payload: task.id })}
    >
      {/* Checkbox */}
      <button
        className="mt-0.5 shrink-0"
        onClick={e => { e.stopPropagation(); toggleTask(task.id, task.status) }}
        aria-label="Toggle task"
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
          ${done
            ? 'border-td-green dark:border-tn-green bg-td-green/20 dark:bg-tn-green/20'
            : 'border-td-muted/50 dark:border-tn-muted/50 hover:border-td-blue dark:border-tn-blue'
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
        <p className={`text-xl md:text-sm leading-snug ${done ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
          {task.title}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
          {/* Priority dot */}
          {task.priority && task.priority !== 'low' && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: priorityColor(task.priority) }} />
          )}

          {/* Due date */}
          {task.due_date && (
            <span className={`text-xs md:text-[11px] font-medium ${overdue ? 'text-td-red dark:text-tn-red' : 'text-td-muted dark:text-tn-muted'}`}>
              {formatDate(task.due_date)}{task.due_time ? ' · ' + fmtTime(task.due_time) : ''}
            </span>
          )}

          {/* Project */}
          {project && (
            <span className="text-xs md:text-[11px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1"
              style={{ color: project.color, background: project.color + '20' }}>
              <ProjectIcon icon={project.icon} size={10} />
              {project.name}
            </span>
          )}

          {/* Tags */}
          {(task.tags || []).map(tag => (
            <span key={tag} className="text-xs md:text-[11px] text-td-purple dark:text-tn-purple bg-td-purple/10 dark:bg-tn-purple/10 px-1.5 py-0.5 rounded-md">
              @{tag}
            </span>
          ))}

          {/* Recurrence */}
          {recurrenceLabel(task.recurrence) && (
            <span className="text-xs md:text-[11px] text-td-teal dark:text-tn-teal">{recurrenceLabel(task.recurrence)}</span>
          )}

          {/* Links */}
          {(task.links || []).map((link, i) => {
            const s = getLinkStyle(link.url, isDark)
            return (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs md:text-[11px] font-medium px-1.5 py-0.5 rounded-md transition-opacity hover:opacity-80"
                style={{ color: s.color, background: s.bg }}>
                <LinkIcon url={link.url} />
                {getLinkLabel(link.url)}
              </a>
            )
          })}

          {/* Subtasks */}
          {subtasksTotal > 0 && (
            <span className="text-xs md:text-[11px] text-td-muted dark:text-tn-muted">
              ◦ {subtasksDone}/{subtasksTotal}
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg className="w-4 h-4 text-td-muted/40 dark:text-tn-muted/40 shrink-0 mt-0.5 group-hover:text-td-muted dark:text-tn-muted transition-colors"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )
}
