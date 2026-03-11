import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { TaskCard } from './TaskCard'
import { Plus } from 'lucide-react'

const COLUMNS = [
  { status: 'todo',  label: 'To Do',       color: '#565f89' },
  { status: 'doing', label: 'In Progress',  color: '#7aa2f7' },
  { status: 'done',  label: 'Done',         color: '#9ece6a' },
]

export function KanbanBoard({ tasks }) {
  const { dispatch } = useApp()

  return (
    <div className="flex gap-3 p-4 overflow-x-auto h-full pb-6">
      {COLUMNS.map(({ status, label, color }) => {
        const items = tasks.filter(t => t.status === status)
        return (
          <div key={status} className="flex-1 min-w-[260px] max-w-[320px]">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-td-muted dark:text-tn-muted">
                {label}
              </span>
              <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full ml-auto">
                {items.length}
              </span>
            </div>
            <div className="bg-td-bg3/50 dark:bg-tn-bg3/50 rounded-xl overflow-hidden">
              {items.length === 0 && (
                <div className="py-8 text-center text-td-muted/40 dark:text-tn-muted/40 text-xs">Empty</div>
              )}
              {items.map(task => <TaskCard key={task.id} task={task} />)}
              <button
                onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true, status } })}
                className="w-full flex items-center gap-2 px-4 py-3 text-td-muted/50 dark:text-tn-muted/50 hover:text-td-muted dark:text-tn-muted text-xs transition-colors"
              >
                <Plus size={14} /> Add task
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
