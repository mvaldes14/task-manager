import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { api } from '../../api'

function NlpChip({ label, color, bg }) {
  return (
    <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0"
      style={{ color, background: bg }}>
      {label}
    </span>
  )
}

export function FAB() {
  const { state, dispatch, toast } = useApp()
  const { createTask } = useTasks()
  const [text, setText] = useState('')
  const [chips, setChips] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const open = state.fabOpen

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setText('')
      setChips([])
    }
  }, [open])

  // NLP parse debounced
  const parseNlp = useCallback(async (val) => {
    if (!val.trim()) { setChips([]); return }
    try {
      const result = await api.parseNlp(val)
      if (!result) return
      const newChips = []
      if (result.due_date) {
        const d = new Date(result.due_date + 'T00:00:00')
        const today = new Date(); today.setHours(0,0,0,0)
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1)
        let label = '📅 ' + d.toLocaleDateString('en-US', { month:'short', day:'numeric' })
        if (d.toDateString() === today.toDateString()) label = '📅 Today'
        if (d.toDateString() === tomorrow.toDateString()) label = '📅 Tomorrow'
        if (result.due_time) label += ' ' + result.due_time.slice(0,5)
        newChips.push({ label, color: '#7aa2f7', bg: 'rgba(122,162,247,0.12)' })
      }
      if (result.priority && result.priority !== 'low') {
        const colors = { high: ['#f7768e','rgba(247,118,142,0.12)'], medium: ['#e0af68','rgba(224,175,104,0.12)'] }
        const [color, bg] = colors[result.priority] || ['#565f89','rgba(86,95,137,0.12)']
        newChips.push({ label: result.priority === 'high' ? '🔴 High' : '🟡 Medium', color, bg })
      }
      if (result.tags?.length) {
        result.tags.forEach(t => newChips.push({ label: '@'+t, color:'#bb9af7', bg:'rgba(187,154,247,0.12)' }))
      }
      if (result.project_id) {
        // find project name
      }
      if (result.obsidian_url) {
        newChips.push({ label: '📎 Note', color:'#e0af68', bg:'rgba(224,175,104,0.12)' })
      }
      setChips(newChips)
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
      {/* Desktop FAB button */}
      <button
        onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true } })}
        className="hidden md:flex fixed bottom-6 right-6 z-40 items-center justify-center
          w-14 h-14 rounded-full bg-tn-red shadow-lg hover:bg-tn-red/90
          transition-all hover:scale-105 active:scale-95"
        aria-label="Add task"
      >
        <Plus size={24} color="white" />
      </button>

      {/* Mobile FAB button — above tab bar */}
      <button
        onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true } })}
        className="md:hidden fixed z-40 right-4 flex items-center justify-center
          w-14 h-14 rounded-full bg-tn-red shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)' }}
        aria-label="Add task"
      >
        <Plus size={24} color="white" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[88] bg-black/40 animate-fade-in"
          onClick={close}
        />
      )}

      {/* Bottom Sheet — mobile */}
      <div
        className={`md:hidden fixed left-0 right-0 z-[89] bg-tn-bg2 rounded-t-2xl
          transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-tn-border" />
        </div>

        {/* Input */}
        <div className="px-4 pt-2 pb-1">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
            className="w-full bg-transparent text-tn-fg text-lg placeholder-tn-muted/50 outline-none"
          />
        </div>

        {/* Footer: chips + button always on same row */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-tn-border/50">
          {/* Chips — scrollable, takes available space */}
          <div className="flex-1 min-w-0 overflow-x-auto flex items-center gap-2 scrollbar-none">
            {chips.map((c, i) => <NlpChip key={i} {...c} />)}
          </div>
          {/* Button — always pinned right */}
          <button
            onClick={submit}
            disabled={!text.trim() || loading}
            className="shrink-0 bg-tn-blue text-tn-bg2 font-semibold text-sm px-5 py-2.5
              rounded-xl disabled:opacity-40 transition-opacity active:scale-95"
          >
            {loading ? '…' : 'Add Task'}
          </button>
        </div>
      </div>

      {/* Desktop dropdown */}
      <div
        className={`hidden md:block fixed right-6 z-[89] w-80 bg-tn-bg2 rounded-xl shadow-2xl
          border border-tn-border transition-all duration-200
          ${open ? 'opacity-100 scale-100 bottom-24' : 'opacity-0 scale-95 bottom-20 pointer-events-none'}`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-tn-muted font-medium uppercase tracking-wider">Quick Add</span>
            <button onClick={close} className="text-tn-muted hover:text-tn-fg">
              <X size={16} />
            </button>
          </div>
          <input
            ref={open ? inputRef : null}
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
            className="w-full bg-tn-surface text-tn-fg text-sm placeholder-tn-muted/50 outline-none
              rounded-lg px-3 py-2.5 mb-2"
          />
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {chips.map((c, i) => <NlpChip key={i} {...c} />)}
            </div>
          )}
          <p className="text-[10px] text-tn-muted/50 mb-3">
            Try: "call dentist tomorrow @health high priority"
          </p>
          <button
            onClick={submit}
            disabled={!text.trim() || loading}
            className="w-full bg-tn-blue text-tn-bg2 font-semibold text-sm py-2.5
              rounded-lg disabled:opacity-40 transition-opacity"
          >
            {loading ? 'Adding…' : 'Add Task'}
          </button>
        </div>
      </div>
    </>
  )
}
