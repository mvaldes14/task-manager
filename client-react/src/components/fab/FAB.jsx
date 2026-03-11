import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { api } from '../../api'

function NlpChip({ label, color, bg }) {
  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0"
      style={{ color, background: bg }}
    >
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
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
    } else {
      setText('')
      setChips([])
    }
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
        next.push({ label, color: 'var(--blue)', bg: 'color-mix(in srgb, var(--blue) 15%, transparent)' })
      }

      if (result.tags?.length) {
        result.tags.forEach(t => next.push({
          label: '@' + t,
          color: 'var(--purple)',
          bg: 'color-mix(in srgb, var(--purple) 15%, transparent)',
        }))
      }
      if (result.obsidian_url) {
        next.push({ label: '📎 Note', color: 'var(--amber)', bg: 'color-mix(in srgb, var(--amber) 15%, transparent)' })
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
      {/* FAB trigger button — above tab bar on mobile, bottom-right on desktop */}
      <button
        onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true } })}
        className="md:hidden fixed z-40 right-4 flex items-center justify-center
          w-14 h-14 rounded-full shadow-lg transition-all active:scale-95"
        style={{
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)',
          background: 'var(--red)',
        }}
        aria-label="Add task"
      >
        <Plus size={24} color="white" strokeWidth={2.5} />
      </button>

      <button
        onClick={() => dispatch({ type: 'SET_FAB', payload: { open: true } })}
        className="hidden md:flex fixed bottom-6 right-6 z-40 items-center justify-center
          w-14 h-14 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ background: 'var(--red)' }}
        aria-label="Add task"
      >
        <Plus size={24} color="white" strokeWidth={2.5} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-[88] bg-black/60 animate-fade-in"
          onClick={close}
        />
      )}

      {/* Modal — centered on screen, large */}
      {open && (
        <div
          className="fixed z-[89] animate-fade-in"
          style={{
            // Center horizontally, sit in upper-middle of screen
            left: '50%',
            top: '30%',
            transform: 'translate(-50%, -50%)',
            width: 'min(520px, calc(100vw - 32px))',
          }}
        >
          <div
            className="rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Input area */}
            <div className="px-5 pt-5 pb-3">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="What needs to be done?"
                className="w-full bg-transparent text-xl font-medium outline-none placeholder-[var(--muted)] leading-snug"
                style={{ color: 'var(--fg)' }}
              />

              {/* NLP hint */}
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                Try: "call dentist tomorrow at 3pm @health high priority"
              </p>
            </div>

            {/* Chips row — only shown when there are chips */}
            {chips.length > 0 && (
              <div className="px-5 py-2 flex flex-wrap gap-2">
                {chips.map((c, i) => <NlpChip key={i} {...c} />)}
              </div>
            )}

            {/* Footer: divider + actions */}
            <div
              className="flex items-center justify-between px-5 py-4 mt-1"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <button
                onClick={close}
                className="text-sm transition-colors"
                style={{ color: 'var(--muted)' }}
              >
                Cancel
              </button>

              <button
                onClick={submit}
                disabled={!text.trim() || loading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all
                  disabled:opacity-40 active:scale-95"
                style={{
                  background: 'var(--blue)',
                  color: 'var(--bg)',
                }}
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
