import { useState, useRef, useCallback } from 'react'
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

  // Touch drag state
  const touchDragTask = useRef(null)
  const ghostEl = useRef(null)
  const colRefs = useRef({})

  // ── Desktop (HTML5) ───────────────────────────────────────────
  const handleDragStart = (e, task) => {
    setDraggingId(task.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('taskId', task.id)
  }
  const handleDragEnd = () => { setDraggingId(null); setOverColumn(null) }
  const handleDragOver = (e, status) => { e.preventDefault(); setOverColumn(status) }
  const handleDrop = async (e, status) => {
    e.preventDefault()
    const task = tasks.find(t => t.id === e.dataTransfer.getData('taskId'))
    if (!task || task.status === status) { setOverColumn(null); return }
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, status } })
    await updateTask(task.id, { status })
    setOverColumn(null)
  }

  // ── Mobile (Touch) ────────────────────────────────────────────
  const createGhost = useCallback((el, x, y) => {
    const rect = el.getBoundingClientRect()
    const ghost = el.cloneNode(true)
    ghost.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      pointer-events: none;
      opacity: 0.85;
      z-index: 9999;
      transform: scale(1.03);
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      border-radius: 12px;
      transition: transform 0.1s;
    `
    document.body.appendChild(ghost)
    ghostEl.current = ghost
    ghostEl.current._offsetX = x - rect.left
    ghostEl.current._offsetY = y - rect.top
  }, [])

  const moveGhost = useCallback((x, y) => {
    if (!ghostEl.current) return
    ghostEl.current.style.left = `${x - ghostEl.current._offsetX}px`
    ghostEl.current.style.top  = `${y - ghostEl.current._offsetY}px`
  }, [])

  const removeGhost = useCallback(() => {
    if (ghostEl.current) { ghostEl.current.remove(); ghostEl.current = null }
  }, [])

  const getColumnAtPoint = useCallback((x, y) => {
    for (const [status, el] of Object.entries(colRefs.current)) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return status
    }
    return null
  }, [])

  const handleTouchStart = useCallback((e, task) => {
    // Only handle single finger
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    touchDragTask.current = task
    setDraggingId(task.id)
    createGhost(e.currentTarget, touch.clientX, touch.clientY)
  }, [createGhost])

  const handleTouchMove = useCallback((e) => {
    if (!touchDragTask.current) return
    e.preventDefault() // prevent scroll while dragging
    const touch = e.touches[0]
    moveGhost(touch.clientX, touch.clientY)
    setOverColumn(getColumnAtPoint(touch.clientX, touch.clientY))
  }, [moveGhost, getColumnAtPoint])

  const handleTouchEnd = useCallback(async (e) => {
    const task = touchDragTask.current
    if (!task) return
    const touch = e.changedTouches[0]
    const targetStatus = getColumnAtPoint(touch.clientX, touch.clientY)

    removeGhost()
    setDraggingId(null)
    setOverColumn(null)
    touchDragTask.current = null

    if (targetStatus && targetStatus !== task.status) {
      dispatch({ type: 'UPDATE_TASK', payload: { ...task, status: targetStatus } })
      await updateTask(task.id, { status: targetStatus })
    }
  }, [getColumnAtPoint, removeGhost, dispatch, updateTask])

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
              ref={el => colRefs.current[status] = el}
              onDragOver={e => handleDragOver(e, status)}
              onDragLeave={() => setOverColumn(null)}
              onDrop={e => handleDrop(e, status)}
              className={`flex-1 rounded-xl overflow-hidden transition-all duration-150
                ${isOver
                  ? 'bg-td-surface dark:bg-tn-surface ring-2 ring-td-blue/50 dark:ring-tn-blue/50'
                  : 'bg-td-bg3/50 dark:bg-tn-bg3/50'}`}
            >
              {items.length === 0 && (
                <div className={`py-8 text-center text-xs transition-colors
                  ${isOver ? 'text-td-blue/60 dark:text-tn-blue/60' : 'text-td-muted/40 dark:text-tn-muted/40'}`}>
                  {isOver ? 'Drop here' : 'Empty'}
                </div>
              )}

              {items.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={e => handleTouchStart(e, task)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="cursor-grab active:cursor-grabbing touch-none"
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
