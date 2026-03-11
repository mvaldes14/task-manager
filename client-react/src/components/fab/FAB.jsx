import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
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

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
    else { setText(''); setChips([]) }
  }, [open])

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
      <button
        onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true } })}
        className="md:hidden fixed z-40 right-4 flex items-center justify-center
          w-14 h-14 rounded-full shadow-lg transition-all active:scale-95 bg-tn-red dark:bg-tn-red"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)' }}
        aria-label="Add task"
      >
        <Plus size={24} color="white" strokeWidth={2.5} />
      </button>

      {/* Desktop FAB */}
      <button
        onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true } })}
        className="hidden md:flex fixed bottom-6 right-6 z-40 items-center justify-center
          w-14 h-14 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95
          bg-tn-red dark:bg-tn-red"
        aria-label="Add task"
      >
        <Plus size={24} color="white" strokeWidth={2.5} />
      </button>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-[88] bg-black/60 animate-fade-in" onClick={close} />}

      {/* Mobile bottom sheet */}
      <div
        className={`md:hidden fixed left-0 right-0 z-[89]
          bg-td-bg2 dark:bg-tn-bg2 rounded-t-2xl
          transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-td-border dark:bg-tn-border" />
        </div>
        <div className="px-4 pt-2 pb-1">
          <input
            ref={inputRef}
            type="text" value={text}
            onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
            className="w-full bg-transparent text-td-fg dark:text-tn-fg text-lg
              placeholder-td-muted/50 dark:placeholder-tn-muted/50 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-td-border dark:border-tn-border">
          <div className="flex-1 min-w-0 overflow-x-auto flex items-center gap-2 scrollbar-none">
            {chips.map((c, i) => <NlpChip key={i} {...c} />)}
          </div>
          <button onClick={submit} disabled={!text.trim() || loading}
            className="shrink-0 bg-td-blue dark:bg-tn-blue text-white font-semibold text-sm
              px-5 py-2.5 rounded-xl disabled:opacity-40 transition-opacity active:scale-95">
            {loading ? '…' : 'Add Task'}
          </button>
        </div>
      </div>

      {/* Desktop centered modal */}
      {open && (
        <div className="hidden md:flex fixed inset-0 z-[89] items-center justify-center">
          <div className="w-full max-w-lg mx-4 bg-td-bg2 dark:bg-tn-bg2 rounded-2xl shadow-2xl
            border border-td-border dark:border-tn-border animate-fade-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <span className="text-xs text-td-muted dark:text-tn-muted font-semibold uppercase tracking-wider">
                Quick Add
              </span>
              <button onClick={close} className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 pb-2">
              <input
                ref={inputRef}
                type="text" value={text}
                onChange={handleChange} onKeyDown={handleKeyDown}
                placeholder="What needs to be done?"
                className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg
                  text-base placeholder-td-muted/40 dark:placeholder-tn-muted/40
                  outline-none rounded-xl px-4 py-3
                  border border-td-border dark:border-tn-border
                  focus:border-td-blue dark:focus:border-tn-blue transition-colors"
              />
            </div>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-5 py-2">
                {chips.map((c, i) => <NlpChip key={i} {...c} />)}
              </div>
            )}
            <div className="flex items-center justify-between px-5 pt-2 pb-5
              border-t border-td-border dark:border-tn-border mt-2">
              <p className="text-[11px] text-td-muted/40 dark:text-tn-muted/40">
                Try: "dentist tomorrow @health"
              </p>
              <button onClick={submit} disabled={!text.trim() || loading}
                className="bg-td-blue dark:bg-tn-blue text-white font-semibold text-sm
                  px-6 py-2.5 rounded-xl disabled:opacity-40 transition-opacity ml-4 shrink-0">
                {loading ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
