import { useCallback, useEffect, useMemo } from 'react'
import { Check, X, FolderInput, ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { api } from '../../api'
import { Select } from '../ui'

/**
 * Floating bar shown while tasks are selected. Two actions only — move to a
 * project (with Undo) and mark complete. Backed by PATCH /api/tasks/bulk.
 *
 * Complete deliberately has no Undo: unticking is one tap, and bulk-complete
 * does not spawn recurrences the way the single-task path does, so a reversal
 * would be ambiguous.
 */
export function BulkActionBar({ selectedIds, onClear }) {
  const { state, dispatch, toast } = useApp()
  const { tasks, projects } = state

  const ids = useMemo(() => [...selectedIds], [selectedIds])
  const count = ids.length

  // Clear on Escape — the bar only mounts while a selection is active.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClear() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClear])

  const applyRows = useCallback((rows) => {
    (rows || []).forEach(row => dispatch({ type: 'UPDATE_TASK', payload: row }))
  }, [dispatch])

  const handleMove = useCallback(async (projectId) => {
    if (!projectId) return
    // Capture prior project per task so Undo can put each one back.
    const prev = new Map()
    ids.forEach(id => {
      const t = tasks.find(x => x.id === id)
      if (t) prev.set(id, t.project_id ?? null)
    })
    try {
      const rows = await api.bulkUpdateTasks(ids, { project_id: projectId })
      applyRows(rows)
      onClear()
      toast(`Moved ${count} ${count === 1 ? 'task' : 'tasks'}`, {
        label: 'Undo',
        onAction: async () => {
          // Revert with one bulk call per distinct prior project. Tasks that had
          // no project can't be reverted (the endpoint rejects a null project_id).
          const byProject = new Map()
          prev.forEach((pid, id) => {
            if (pid == null) return
            if (!byProject.has(pid)) byProject.set(pid, [])
            byProject.get(pid).push(id)
          })
          try {
            for (const [pid, gids] of byProject) {
              applyRows(await api.bulkUpdateTasks(gids, { project_id: pid }))
            }
          } catch {
            toast('Could not undo move')
          }
        },
      })
    } catch {
      toast('Failed to move tasks')
    }
  }, [ids, tasks, count, applyRows, onClear, toast])

  const handleComplete = useCallback(async () => {
    try {
      const rows = await api.bulkUpdateTasks(ids, { status: 'done' })
      applyRows(rows)
      onClear()
      toast(`Completed ${count} ${count === 1 ? 'task' : 'tasks'}`)
    } catch {
      toast('Failed to complete tasks')
    }
  }, [ids, count, applyRows, onClear, toast])

  // Match TaskDetail's project picker: root/child hierarchy, inbox excluded.
  // Archived projects are excluded here — you don't move work into the archive.
  const projectOptions = (() => {
    const list = projects.filter(p => p.id !== 'inbox' && !p.archived_at)
    const idSet = new Set(list.map(p => p.id))
    const roots = list.filter(p => !p.parent_id || !idSet.has(p.parent_id))
    return roots.flatMap(r => [
      { value: r.id, label: r.name, depth: 0 },
      ...list.filter(c => c.parent_id === r.id).map(c => ({ value: c.id, label: c.name, depth: 1 })),
    ])
  })()

  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[95]
      flex items-center gap-2 px-3 py-2 rounded-xl shadow-e2
      bg-td-surface dark:bg-tn-surface border border-td-border dark:border-tn-border">
      <span className="text-sm font-medium text-td-fg dark:text-tn-fg tabular-nums whitespace-nowrap px-1">
        {count} selected
      </span>

      {/* Move to… — overlay Select matching TaskDetail's picker */}
      <div className="relative">
        <button
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg
            text-td-fg dark:text-tn-fg bg-td-bg2 dark:bg-tn-bg2
            border border-td-border dark:border-tn-border
            hover:bg-td-border/40 dark:hover:bg-tn-border/40 transition-colors"
        >
          <FolderInput size={14} />
          Move to…
          <ChevronDown size={12} className="text-td-muted dark:text-tn-muted" />
        </button>
        <Select
          ariaLabel="Move selected tasks to a project"
          title="Move to…"
          value=""
          onChange={handleMove}
          options={projectOptions}
          variant="overlay"
        />
      </div>

      {/* Complete */}
      <button
        onClick={handleComplete}
        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg
          text-white bg-td-green dark:bg-tn-green
          hover:opacity-90 active:opacity-80 transition-opacity"
      >
        <Check size={14} />
        Complete
      </button>

      {/* Clear */}
      <button
        onClick={onClear}
        aria-label="Clear selection"
        className="p-1.5 rounded-lg text-td-muted dark:text-tn-muted
          hover:text-td-fg dark:hover:text-tn-fg
          hover:bg-td-border/40 dark:hover:bg-tn-border/40 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  )
}
