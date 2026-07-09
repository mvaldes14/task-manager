import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { Search, X } from 'lucide-react'
import { ProjectIcon } from '../shared/ProjectIcon'
import { Input, Chip, Kbd, Skeleton } from '../ui'
import { formatDate, isOverdue, tasksForView } from '../../utils'

function highlightMatch(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-td-blue/25 dark:bg-tn-blue/25 text-td-fg dark:text-tn-fg rounded-sm">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function statusLabel(status) {
  if (status === 'done') return 'Done'
  if (status === 'doing') return 'In progress'
  return null
}

const activeChip = 'bg-td-blue/15 dark:bg-tn-blue/15 text-td-blue dark:text-tn-blue border border-td-blue/30 dark:border-tn-blue/30'
const idleChip = 'bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted border border-td-border/60 dark:border-tn-border/60 hover:text-td-fg dark:hover:text-tn-fg'

export function SearchOverlay() {
  const { state, dispatch } = useApp()
  const { searchOpen, view, tasks, projects } = state
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [scope, setScope] = useState('all') // 'all' | 'view'
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const prevFocusRef = useRef(null)
  const resultRefs = useRef([])

  // Reset search state when the overlay transitions from closed -> open.
  // Adjusted during render (React's "storing info from previous render"
  // pattern) rather than in an effect, so setState isn't called from inside one.
  const [prevSearchOpen, setPrevSearchOpen] = useState(searchOpen)
  if (searchOpen !== prevSearchOpen) {
    setPrevSearchOpen(searchOpen)
    if (searchOpen) {
      setQuery('')
      setDebouncedQuery('')
      setScope('all')
      setSelectedIndex(0)
    }
  }

  // Focus management is an imperative DOM sync (no setState), so it stays an effect.
  useEffect(() => {
    if (searchOpen) {
      prevFocusRef.current = document.activeElement
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    if (prevFocusRef.current) {
      prevFocusRef.current.focus?.()
      prevFocusRef.current = null
    }
  }, [searchOpen])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(t)
  }, [query])

  const close = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_OPEN', payload: false })
  }, [dispatch])

  const pool = useMemo(
    () => (scope === 'view' ? tasksForView(view, tasks) : tasks),
    [scope, view, tasks]
  )

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return []
    return pool
      .filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const aTitle = a.title?.toLowerCase().includes(q) ? 0 : 1
        const bTitle = b.title?.toLowerCase().includes(q) ? 0 : 1
        return aTitle - bTitle
      })
      .slice(0, 50)
  }, [pool, debouncedQuery])

  // Reset the highlighted result whenever the query or scope changes.
  const resultsKey = `${debouncedQuery}|${scope}`
  const [prevResultsKey, setPrevResultsKey] = useState(resultsKey)
  if (resultsKey !== prevResultsKey) {
    setPrevResultsKey(resultsKey)
    if (selectedIndex !== 0) setSelectedIndex(0)
  }

  useEffect(() => {
    resultRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const openTask = useCallback((taskId) => {
    dispatch({ type: 'SELECT_TASK', payload: taskId })
    close()
  }, [dispatch, close])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const t = results[selectedIndex]
      if (t) openTask(t.id)
      return
    }
    if (e.key === 'Tab') {
      const focusables = containerRef.current?.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])')
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
  }

  if (!searchOpen) return null

  const isPending = query !== debouncedQuery
  const trimmed = debouncedQuery.trim()
  const showEmpty = trimmed && !isPending && results.length === 0

  return (
    <>
      <div className="fixed inset-0 z-[190] bg-black/50 motion-safe:animate-fade-in" onClick={close} />
      <div className="fixed inset-x-0 top-0 z-[191] flex justify-center md:pt-[10vh] pointer-events-none">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Search tasks"
          onKeyDown={handleKeyDown}
          className="pointer-events-auto w-full md:max-w-lg
            bg-td-bg2 dark:bg-tn-bg2 md:border border-td-border dark:border-tn-border
            md:rounded-2xl shadow-e3 flex flex-col overflow-hidden
            h-full md:h-auto md:max-h-[70vh]"
          style={{
            animation: 'search-overlay-in 0.2s ease-out',
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          {/* Search field */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
            <Search size={16} className="text-td-muted dark:text-tn-muted shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search all tasks…"
              className="text-base"
            />
            <button
              onClick={close}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 shrink-0
                text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors"
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scope chip */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-td-border/30 dark:border-tn-border/30 shrink-0">
            <Chip label="All tasks" onClick={() => setScope('all')} className={scope === 'all' ? activeChip : idleChip} />
            <Chip label="This view" onClick={() => setScope('view')} className={scope === 'view' ? activeChip : idleChip} />
            <span className="ml-auto hidden md:inline-flex items-center gap-1.5 text-[10px] text-td-muted/60 dark:text-tn-muted/60">
              <Kbd>↑↓</Kbd> navigate <Kbd>↵</Kbd> open <Kbd>esc</Kbd> close
            </span>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {!trimmed && !isPending ? (
              <div className="flex flex-col items-center justify-center py-16 text-td-muted dark:text-tn-muted">
                <Search size={22} className="mb-2 opacity-40" />
                <p className="text-sm">Type to search tasks</p>
              </div>
            ) : isPending ? (
              <div className="px-4 py-2 space-y-2">
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-[52px]" />)}
              </div>
            ) : showEmpty ? (
              <div className="flex flex-col items-center justify-center py-16 text-td-muted dark:text-tn-muted">
                <p className="text-sm">No matches for &ldquo;{trimmed}&rdquo;</p>
              </div>
            ) : (
              <ul>
                {results.map((t, i) => {
                  const project = projects.find(p => p.id === t.project_id)
                  const overdue = isOverdue(t)
                  return (
                    <li key={t.id}>
                      <button
                        ref={el => { resultRefs.current[i] = el }}
                        onClick={() => openTask(t.id)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className={`w-full flex flex-col items-start gap-1 px-4 py-3 min-h-[44px] text-left transition-colors
                          ${i === selectedIndex ? 'bg-td-surface dark:bg-tn-surface' : 'hover:bg-td-surface/60 dark:hover:bg-tn-surface/60'}`}
                      >
                        <span className={`text-sm ${t.status === 'done' ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
                          {highlightMatch(t.title || '', trimmed)}
                        </span>
                        <span className="flex items-center gap-2 flex-wrap text-xs text-td-muted dark:text-tn-muted">
                          {project && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: project.color }} />
                              <ProjectIcon icon={project.icon} size={10} />
                              {project.name}
                            </span>
                          )}
                          {t.due_date && (
                            <span className={overdue ? 'text-td-red dark:text-tn-red' : ''}>
                              {formatDate(t.due_date)}
                            </span>
                          )}
                          {statusLabel(t.status) && <span>{statusLabel(t.status)}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes search-overlay-in {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
