import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { api } from '../../api'

// Hardcoded chip colors for dark — light mode uses same values (readable on both)
const CHIP_COLORS = {
  date:     { color: '#7aa2f7', bg: 'rgba(122,162,247,0.15)' },
  tag:      { color: '#bb9af7', bg: 'rgba(187,154,247,0.15)' },
  obsidian: { color: '#e0af68', bg: 'rgba(224,175,104,0.15)' },
}

function NlpChip({ label, color, bg }) {
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0"
      style={{ color, background: bg }}>
      {label}
    </span>
  )
}

export function FAB() {
  const { state, dispatch } = useApp()
  const { createTask } = useTasks()
  const [text, setText] = useState('')
  const [chips, setChips] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const open = state.fabOpen
  const taskOpen = !!state.selectedTaskId

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
    else { setText(''); setChips([]) }
  }, [open])

  // Global keyboard shortcut: Q or Cmd+K opens FAB (desktop only)
  useEffect(() => {
    const handler = (e) => {
      if (open) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if ((e.key === 'q' || e.key === 'Q') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        dispatch({ type: 'SET_FAB', payload: { open: true } })
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        dispatch({ type: 'SET_FAB', payload: { open: true } })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, dispatch])

  const parseNlp = useCallback(async (val) => {
    if (!val.trim()) { setChips([]); return }
    try {
      const result = await api.parseNlp(val)
      if (!result) return
      const next = []
      if (result.due_date) {
        const d = new Date(result.due_date + 'T00:00:00')
        const today = new Date(); today.setHours(0,0,0,0)
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1)
        let label = '📅 ' + d.toLocaleDateString('en-US', { month:'short', day:'numeric' })
        if (d.toDateString() === today.toDateString()) label = '📅 Today'
        if (d.toDateString() === tomorrow.toDateString()) label = '📅 Tomorrow'
        if (result.due_time) label += ' · ' + result.due_time.slice(0,5)
        next.push({ label, ...CHIP_COLORS.date })
      }
      if (result.tags?.length) {
        result.tags.forEach(t => next.push({ label: '@'+t, ...CHIP_COLORS.tag }))
      }
      if (result.obsidian_url) {
        next.push({ label: '📎 Note', ...CHIP_COLORS.obsidian })
      }
      setChips(next)
    } catch { /* silent */ }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setText(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => parseNlp(val), 400)
  }

  const submit = async () => {
    if (!text.trim() || loading) return
    setLoading(true)
    await createTask({ title: text.trim(), nlp: true, status: state.fabTargetStatus })
    setLoading(false)
    dispatch({ type: 'SET_FAB', payload: { open: false } })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === 'Escape') dispatch({ type: 'SET_FAB', payload: { open: false } })
  }

  const close = () => dispatch({ type: 'SET_FAB', payload: { open: false } })

  return (
    <>
      {/* Mobile FAB */}
      {!taskOpen && (
        <button
          onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true } })}
          className="md:hidden fixed z-40 right-4 flex items-center justify-center
            w-14 h-14 rounded-full shadow-lg transition-all active:scale-95 bg-tn-red dark:bg-tn-red"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)' }}
          aria-label="Add task"
        >
          <Plus size={24} color="white" strokeWidth={2.5} />
        </button>
      )}

      {/* Desktop FAB */}
      {!taskOpen && (
        <button
          onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true } })}
          className="hidden md:flex fixed bottom-6 right-6 z-40 items-center justify-center
            w-14 h-14 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95
            bg-tn-red dark:bg-tn-red"
          aria-label="Add task"
        >
          <Plus size={24} color="white" strokeWidth={2.5} />
        </button>
      )}

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-[88] bg-black/60 animate-fade-in" onClick={close} />}

      {/* Centered modal */}
      {open && (
        <div className="fixed inset-0 z-[89] flex items-center justify-center px-4 pointer-events-none">
          <div
            className="w-full max-w-lg rounded-2xl shadow-2xl animate-fade-in pointer-events-auto
              bg-white dark:bg-tn-bg2 border border-td-border dark:border-tn-border"
            onClick={e => e.stopPropagation()}
          >
            {/* Input */}
            <div className="px-5 pt-6 pb-3">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="What needs to be done?"
                className="w-full bg-transparent text-td-fg dark:text-tn-fg text-xl font-medium
                  outline-none leading-snug placeholder-td-muted/40 dark:placeholder-tn-muted/40"
              />
            </div>

            {/* NLP chips */}
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 py-2">
                {chips.map((c, i) => <NlpChip key={i} {...c} />)}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 mt-1
              border-t border-td-border dark:border-tn-border">
              <button
                onClick={close}
                className="text-sm font-medium text-td-muted dark:text-tn-muted
                  hover:text-td-fg dark:hover:text-tn-fg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!text.trim() || loading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all
                  disabled:opacity-40 active:scale-95
                  bg-td-blue dark:bg-tn-blue text-white"
              >
                {loading ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
