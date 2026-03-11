import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { TaskCard } from './TaskCard'
import { Plus } from 'lucide-react'

const COLUMNS = [
  { status: 'todo',  label: 'To Do',      color: '#565f89' },
  { status: 'doing', label: 'In Progress', color: '#7aa2f7' },
  { status: 'done',  label: 'Done',        color: '#9ece6a' },
]

export function KanbanBoard({ tasks }) {
  const { dispatch } = useApp()
  const { updateTask } = useTasks()
  const [draggingId, setDraggingId] = useState(null)
  const [overColumn, setOverColumn] = useState(null)
  const dragTask = useRef(null)

  const handleDragStart = (e, task) => {
    dragTask.current = task
    setDraggingId(task.id)
    e.dataTransfer.effectAllowed = 'move'
    // Slight delay so the ghost image renders before we style the original
    setTimeout(() => {
      if (e.target) e.target.style.opacity = '0.4'
    }, 0)
  }

  const handleDragEnd = (e) => {
    if (e.target) e.target.style.opacity = ''
    setDraggingId(null)
    setOverColumn(null)
    dragTask.current = null
  }

  const handleDragOver = (e, status) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverColumn(status)
  }

  const handleDrop = async (e, status) => {
    e.preventDefault()
    const task = dragTask.current
    if (!task || task.status === status) {
      setOverColumn(null)
      return
    }
    // Optimistically update UI
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, status } })
    await updateTask(task.id, { status })
    setOverColumn(null)
  }

  return (
    <div className="flex gap-3 p-4 overflow-x-auto h-full pb-6">
      {COLUMNS.map(({ status, label, color }) => {
        const items = tasks.filter(t => t.status === status)
        const isOver = overColumn === status
        return (
          <div key={status} className="flex-1 min-w-[260px] max-w-[320px] flex flex-col">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-td-muted dark:text-tn-muted">
                {label}
              </span>
              <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 bg-td-surface dark:bg-tn-surface px-1.5 rounded-full ml-auto">
                {items.length}
              </span>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => handleDragOver(e, status)}
              onDragLeave={() => setOverColumn(null)}
              onDrop={e => handleDrop(e, status)}
              className={`flex-1 rounded-xl overflow-hidden transition-all duration-150
                ${isOver
                  ? 'bg-td-surface dark:bg-tn-surface ring-2 ring-td-blue/50 dark:ring-tn-blue/50'
                  : 'bg-td-bg3/50 dark:bg-tn-bg3/50'}`}
            >
              {items.length === 0 && !isOver && (
                <div className="py-8 text-center text-td-muted/40 dark:text-tn-muted/40 text-xs">
                  Empty
                </div>
              )}
              {isOver && items.length === 0 && (
                <div className="py-8 text-center text-td-blue/60 dark:text-tn-blue/60 text-xs">
                  Drop here
                </div>
              )}

              {items.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  className={`cursor-grab active:cursor-grabbing transition-opacity
                    ${draggingId === task.id ? 'opacity-40' : 'opacity-100'}`}
                >
                  <TaskCard task={task} />
                </div>
              ))}

              <button
                onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true, status } })}
                className="w-full flex items-center gap-2 px-4 py-3 text-td-muted/50 dark:text-tn-muted/50 hover:text-td-muted dark:hover:text-tn-muted text-xs transition-colors"
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
