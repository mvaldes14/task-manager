import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, ArrowRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { useInlineAutocomplete } from '../../hooks/useInlineAutocomplete'
import { api } from '../../api'

const SUGGESTION_COLORS = {
  tag:     { color: '#bb9af7' },
  project: { color: '#7aa2f7' },
  user:    { color: '#4ade80' },
}

function SuggestionDropdown({ suggestions, onSelect }) {
  if (!suggestions.length) return null
  return (
    <div className="absolute left-0 right-0 bottom-full mb-1 z-[99] rounded-xl border border-td-border dark:border-tn-border bg-white dark:bg-tn-bg2 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
      {suggestions.map((s, i) => (
        <button key={i} onMouseDown={e => { e.preventDefault(); onSelect(s) }}
          className="w-full text-left text-xs px-3 py-2.5 hover:bg-td-surface dark:hover:bg-tn-surface transition-colors flex items-center gap-2"
          style={{ color: SUGGESTION_COLORS[s.type]?.color }}>
          {s.label}
        </button>
      ))}
    </div>
  )
}

// Hardcoded chip colors for dark — light mode uses same values (readable on both)
const CHIP_COLORS = {
  date:     { color: '#7aa2f7', bg: 'rgba(122,162,247,0.15)' },
  tag:      { color: '#bb9af7', bg: 'rgba(187,154,247,0.15)' },
  user:     { color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
}

function NlpChip({ label, color, bg }) {
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0"
      style={{ color, background: bg }}>
      {label}
    </span>
  )
}

// Quick-insert shelf helpers
function toIso(date) {
  return date.toISOString().slice(0, 10)
}
function shelfDates() {
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const nextMon = new Date(today)
  nextMon.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7))
  return [
    { label: 'Today',     text: 'today' },
    { label: 'Tomorrow',  text: 'tomorrow' },
    { label: 'Next week', text: 'next monday' },
  ]
}

function SmartShelf({ projects, tags, onInsert }) {
  const dates = shelfDates()
  const priorities = ['high', 'medium']
  const shownProjects = projects.slice(0, 4)
  const shownTags = tags.slice(0, 4)

  const Row = ({ label, items, color }) => (
    <div className="flex items-center gap-2 px-4 py-1.5 overflow-x-auto no-scrollbar">
      <span className="text-[10px] font-semibold tracking-wider text-tn-muted/60 shrink-0 w-8 uppercase">{label}</span>
      {items.map(item => (
        <button
          key={item.text}
          onMouseDown={e => { e.preventDefault(); onInsert(item.text) }}
          onTouchStart={e => { e.preventDefault(); onInsert(item.text) }}
          className="text-xs px-3 py-1.5 rounded-full shrink-0 border border-tn-border bg-tn-surface text-tn-fg active:scale-95 transition-transform"
          style={item.color ? { color: item.color, borderColor: item.color + '40', background: item.color + '15' } : {}}
        >
          {item.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="border-t border-tn-border/50 py-1">
      <Row label="Date" items={dates} />
      {shownProjects.length > 0 && (
        <Row label="Proj" items={shownProjects.map(p => ({ label: p.name, text: '#' + p.name, color: p.color }))} />
      )}
      {shownTags.length > 0 && (
        <Row label="Tag" items={shownTags.map(t => ({ label: '@' + t, text: '@' + t, color: '#bb9af7' }))} />
      )}
      <Row label="Pri" items={priorities.map(p => ({
        label: p.charAt(0).toUpperCase() + p.slice(1),
        text: '!' + p,
        color: p === 'high' ? '#f7768e' : '#e0af68',
      }))} />
    </div>
  )
}

export function FAB() {
  const { state, dispatch } = useApp()
  const { createTask } = useTasks()
  const [text, setText] = useState('')
  const [chips, setChips] = useState([])
  const [loading, setLoading] = useState(false)
  const [allTags, setAllTags] = useState([])
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const open = state.fabOpen
  const taskOpen = !!state.selectedTaskId

  const { suggestions, onInput: acOnInput, onSelect: acOnSelect, closeSuggestions } = useInlineAutocomplete({
    text, setText, inputRef, allTags, projects: state.projects, users: state.users,
  })

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
      api.getTags().then(t => { if (t) setAllTags(t) }).catch(() => {})
    } else { setText(''); setChips([]); setKeyboardHeight(0) }
  }, [open])

  // Track keyboard height via visualViewport (mobile)
  useEffect(() => {
    if (!open) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardHeight(kh)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
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
      if (result.labels?.length) {
        result.labels.forEach(t => next.push({ label: '@'+t, ...CHIP_COLORS.tag }))
      }
      if (result.project_name) {
        next.push({ label: '📁 ' + result.project_name, ...CHIP_COLORS.tag })
      }
      if (result.assigned_to_username) {
        next.push({ label: '+' + result.assigned_to_username, ...CHIP_COLORS.user })
      }
      setChips(next)
    } catch { /* silent */ }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setText(val)
    acOnInput(val)
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
    if (suggestions.length > 0 && e.key === 'Escape') { e.stopPropagation(); closeSuggestions(); return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (suggestions.length > 0) { acOnSelect(suggestions[0]); return } submit() }
    if (e.key === 'Escape') dispatch({ type: 'SET_FAB', payload: { open: false } })
  }

  const close = () => dispatch({ type: 'SET_FAB', payload: { open: false } })

  const insertShelfText = useCallback((word) => {
    const val = text ? text + ' ' + word : word
    setText(val)
    inputRef.current?.focus()
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => parseNlp(val), 400)
  }, [text, parseNlp])

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

      {/* ── Mobile: bottom sheet — pinned above keyboard ── */}
      {open && (
        <div
          className="md:hidden fixed inset-x-0 z-[96] rounded-t-2xl shadow-2xl
            bg-white dark:bg-tn-bg2 border-t border-td-border dark:border-tn-border
            animate-slide-up"
          style={{ bottom: keyboardHeight }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-9 h-1 rounded-full bg-td-border dark:bg-tn-border" />
          </div>

          {/* Task input */}
          <div className="relative px-4 pt-2 pb-2">
            <SuggestionDropdown suggestions={suggestions} onSelect={acOnSelect} />
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="What needs to be done?"
              className="w-full bg-transparent text-td-fg dark:text-tn-fg text-xl font-semibold
                outline-none leading-snug placeholder-td-muted/30 dark:placeholder-tn-muted/30"
            />
          </div>

          {/* NLP chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {chips.map((c, i) => <NlpChip key={i} {...c} />)}
            </div>
          )}

          {/* Smart shelf */}
          <SmartShelf
            projects={state.projects}
            tags={allTags}
            onInsert={insertShelfText}
          />

          {/* Action row */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-td-border/40 dark:border-tn-border/40">
            <button
              onClick={close}
              className="text-sm font-medium text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors px-1"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!text.trim() || loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                bg-td-blue dark:bg-tn-blue text-white disabled:opacity-30 active:scale-95 transition-all"
            >
              {loading
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <>Add task <ArrowRight size={14} strokeWidth={2.5} /></>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop: centered modal ── */}
      {open && (
        <div className="hidden md:flex fixed inset-0 z-[89] items-center justify-center px-4 pointer-events-none">
          <div
            className="w-full max-w-lg rounded-2xl shadow-2xl animate-fade-in pointer-events-auto
              bg-white dark:bg-tn-bg2 border border-td-border dark:border-tn-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative px-5 pt-6 pb-3">
              <SuggestionDropdown suggestions={suggestions} onSelect={acOnSelect} />
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
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2 px-5 py-2">
                {chips.map((c, i) => <NlpChip key={i} {...c} />)}
              </div>
            )}
            <div className="flex items-center justify-between px-5 py-4 mt-1">
              <button onClick={close} className="text-sm font-medium text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!text.trim() || loading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 active:scale-95 bg-td-blue dark:bg-tn-blue text-white"
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
