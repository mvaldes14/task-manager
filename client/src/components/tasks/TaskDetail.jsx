import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { api } from '../../api'
import { formatDate, fmtTime, recurrenceLabel, getLinkLabel, getLinkStyle } from '../../utils'
import { X, Trash2, Plus, Check, ChevronRight, Paperclip, GitBranch, Link2, Repeat2, ExternalLink } from 'lucide-react'

const STATUSES = ['todo', 'doing', 'blocked', 'done']

const STATUS_DOT = {
  todo:    'bg-td-muted/40 dark:bg-tn-muted/40',
  doing:   'bg-td-blue dark:bg-tn-blue',
  done:    'bg-td-green dark:bg-tn-green',
  blocked: 'bg-td-red dark:bg-tn-red',
}

const RECUR_PRESETS = [
  { label: 'None',               value: null },
  { label: 'Daily',              value: 'RRULE:FREQ=DAILY' },
  { label: 'Weekdays (Mon–Fri)', value: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { label: 'Weekly (same day)',  value: 'RRULE:FREQ=WEEKLY' },
  { label: 'Monthly (pick day)', value: '__monthly_dom__' },
  { label: 'Yearly',             value: 'RRULE:FREQ=YEARLY' },
]

function _rruleProps(str) {
  if (!str || !str.includes('FREQ=')) return {}
  const src = str.startsWith('RRULE:') ? str.slice(6) : str
  return Object.fromEntries(src.split(';').map(p => p.split('=')))
}

function RecurrenceEditor({ recurrence, recurrenceEnd, onChange }) {
  const [open, setOpen] = useState(false)
  const [domInput, setDomInput] = useState('')

  const label        = recurrenceLabel(recurrence)
  const props        = _rruleProps(recurrence)
  const isMonthlyDom = props.FREQ === 'MONTHLY' && props.BYMONTHDAY && !props.BYDAY
  const currentDom   = isMonthlyDom ? parseInt(props.BYMONTHDAY, 10) : null

  const selectPreset = (value) => {
    if (!value) {
      onChange({ recurrence: null, recurrence_end: null })
      setOpen(false)
    } else if (value === '__monthly_dom__') {
      // stay open so user can pick the day
    } else {
      onChange({ recurrence: value })
      setOpen(false)
    }
  }

  const applyDom = () => {
    const dom = Math.max(1, Math.min(31, parseInt(domInput) || currentDom || 1))
    onChange({ recurrence: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dom}` })
    setOpen(false)
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Recurrence</label>
      <div className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 w-full text-xs px-3 py-2 rounded-lg transition-colors text-left
            bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg
            hover:bg-td-border/30 dark:hover:bg-tn-border/30 border border-td-border/50 dark:border-tn-border/50"
        >
          <Repeat2 size={13} />
          <span>{label || 'None'}</span>
          {recurrenceEnd && <span className="ml-auto opacity-60 text-[10px]">until {recurrenceEnd}</span>}
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-td-border dark:border-tn-border bg-white dark:bg-tn-bg2 shadow-xl overflow-hidden">
            {RECUR_PRESETS.map(opt => (
              <button
                key={opt.label}
                onClick={() => selectPreset(opt.value)}
                className={`w-full text-left text-xs px-3 py-2.5 transition-colors
                  hover:bg-td-surface dark:hover:bg-tn-surface
                  ${(!recurrence && !opt.value) || (opt.value && opt.value !== '__monthly_dom__' && recurrence === opt.value)
                    ? 'text-td-teal dark:text-tn-teal font-semibold bg-td-teal/5 dark:bg-tn-teal/5'
                    : 'text-td-fg dark:text-tn-fg'}`}
              >
                {opt.label}
              </button>
            ))}
            <div className="border-t border-td-border dark:border-tn-border px-3 py-2.5 space-y-1.5">
              <label className="block text-[10px] text-td-muted dark:text-tn-muted">Monthly on day</label>
              <div className="flex gap-2">
                <input
                  type="number" min="1" max="31"
                  value={domInput || (currentDom && currentDom > 0 ? currentDom : '')}
                  onChange={e => setDomInput(e.target.value)}
                  placeholder={currentDom && currentDom > 0 ? String(currentDom) : '1–31'}
                  className="flex-1 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2 py-1.5 outline-none border border-td-border/50 dark:border-tn-border/50"
                />
                <button
                  onClick={applyDom}
                  className="px-3 py-1.5 bg-td-teal/10 dark:bg-tn-teal/10 text-td-teal dark:text-tn-teal text-xs rounded-lg hover:bg-td-teal/20 dark:hover:bg-tn-teal/20 font-medium"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {recurrence && (
        <div className="space-y-1">
          <label className="text-[10px] font-semibold tracking-wider text-td-muted/60 dark:text-tn-muted/60 uppercase">Stop repeating on</label>
          <input
            type="date"
            value={recurrenceEnd || ''}
            onChange={e => onChange({ recurrence_end: e.target.value || null })}
            className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50"
          />
        </div>
      )}
    </div>
  )
}


function SubtaskRow({ sub, taskId }) {
  const { dispatch, toast } = useApp()

  const toggle = async () => {
    try {
      await api.updateSubtask(taskId, sub.id, { completed: !sub.completed })
      const task = await api.getTask(taskId)
      if (task) dispatch({ type: 'UPDATE_TASK', payload: task })
    } catch { toast('Failed to update subtask') }
  }

  const del = async () => {
    try {
      await api.deleteSubtask(taskId, sub.id)
      const task = await api.getTask(taskId)
      if (task) dispatch({ type: 'UPDATE_TASK', payload: task })
    } catch { toast('Failed to delete subtask') }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <button onClick={toggle}
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
          ${sub.completed ? 'bg-td-green/20 dark:bg-tn-green/20 border-td-green dark:border-tn-green' : 'border-td-muted/40 dark:border-tn-muted/40 hover:border-td-blue dark:border-tn-blue'}`}>
        {sub.completed && <Check size={8} color="#9ece6a" strokeWidth={3} />}
      </button>

      {sub.linked_task_id ? (
        <button
          onClick={() => dispatch({ type: 'SELECT_TASK', payload: sub.linked_task_id })}
          className="flex-1 flex items-center gap-1.5 text-left hover:text-td-blue dark:hover:text-tn-blue transition-colors min-w-0"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[sub.linked_task_status || 'todo']}`} />
          <span className={`text-sm truncate ${sub.completed ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
            {sub.linked_task_title || sub.title}
          </span>
          <ExternalLink size={10} className="shrink-0 opacity-40" />
        </button>
      ) : (
        <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
          {sub.title}
        </span>
      )}

      <button onClick={del} className="opacity-0 group-hover:opacity-100 text-td-muted/50 dark:text-tn-muted/50 hover:text-td-red dark:text-tn-red p-0.5">
        <X size={12} />
      </button>
    </div>
  )
}

function LinkIcon({ url }) {
  if (url.startsWith('obsidian://')) return <Paperclip size={12} />
  if (url.includes('github.com'))   return <GitBranch size={12} />
  return <Link2 size={12} />
}

function LinksSection({ task, onUpdate }) {
  const { state } = useApp()
  const isDark = state.theme === 'dark'
  const [adding, setAdding] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const links = task.links || []

  const addLink = async () => {
    if (!urlInput.trim()) return
    const url = urlInput.trim()
    const newLink = { url, label: getLinkLabel(url) }
    const updated = await api.updateTask(task.id, { links: [...links, newLink] })
    if (updated) onUpdate(updated)
    setAdding(false)
    setUrlInput('')
  }

  const removeLink = async (i) => {
    const next = links.filter((_, idx) => idx !== i)
    const updated = await api.updateTask(task.id, { links: next })
    if (updated) onUpdate(updated)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Links</label>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="text-[10px] text-td-muted/50 dark:text-tn-muted/50 hover:text-td-amber dark:hover:text-tn-amber transition-colors">
            + Add link
          </button>
        )}
      </div>

      {links.map((link, i) => {
        const s = getLinkStyle(link.url, isDark)
        return (
          <div key={i} className="flex items-center gap-2">
            <a href={link.url} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:opacity-80 transition-opacity"
              style={{ color: s.color, background: s.bg }}>
              <LinkIcon url={link.url} />
              <span>{getLinkLabel(link.url)}</span>
              <ChevronRight size={12} className="ml-auto shrink-0 opacity-50" />
            </a>
            <button onClick={() => removeLink(i)}
              className="p-1.5 text-td-muted/40 dark:text-tn-muted/40 hover:text-td-red dark:hover:text-tn-red transition-colors">
              <X size={13} />
            </button>
          </div>
        )
      })}

      {adding && (
        <div className="space-y-2">
          <input autoFocus
            type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addLink(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="https:// or obsidian://"
            className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs
              rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50
              placeholder-td-muted/30 dark:placeholder-tn-muted/30 font-mono"
          />
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)}
              className="flex-1 py-1.5 text-xs text-td-muted dark:text-tn-muted bg-td-surface dark:bg-tn-surface rounded-lg border border-td-border/50 dark:border-tn-border/50">
              Cancel
            </button>
            <button onClick={addLink} disabled={!urlInput.trim()}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40
                bg-td-amber dark:bg-tn-amber text-white">
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TagCombobox({ tags, onChange }) {
  const [input, setInput] = useState('')
  const [allTags, setAllTags] = useState([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    api.getTags().then(t => { if (t) setAllTags(t) }).catch(() => {})
  }, [])

  const suggestions = allTags.filter(t =>
    !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  )

  const addTag = (raw) => {
    const t = (raw || input).trim().replace(/^@/, '')
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
    setOpen(false)
  }

  const removeTag = (t) => onChange(tags.filter(x => x !== t))

  return (
    <div className="space-y-1.5">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <span key={t} className="flex items-center gap-1 text-[11px] bg-td-purple/10 dark:bg-tn-purple/10 text-td-purple dark:text-tn-purple px-2 py-0.5 rounded-lg">
              @{t}
              <button onClick={() => removeTag(t)} className="hover:text-td-red dark:text-tn-red"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text" value={input}
            onChange={e => { setInput(e.target.value); setOpen(true) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addTag() }
              if (e.key === 'Escape') { setOpen(false); setInput('') }
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Add tag…"
            className="flex-1 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50 placeholder-td-muted/40 dark:placeholder-tn-muted/40"
          />
          <button onClick={() => addTag()} className="px-3 py-2 bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted hover:text-td-blue dark:text-tn-blue rounded-lg text-xs border border-td-border/50 dark:border-tn-border/50">
            <Plus size={12} />
          </button>
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute left-0 right-10 top-full mt-1 z-20 rounded-xl border border-td-border dark:border-tn-border bg-white dark:bg-tn-bg2 shadow-xl overflow-hidden max-h-40 overflow-y-auto">
            {suggestions.map(t => (
              <button key={t} onMouseDown={() => addTag(t)}
                className="w-full text-left text-xs px-3 py-2 hover:bg-td-surface dark:hover:bg-tn-surface text-td-purple dark:text-tn-purple transition-colors">
                @{t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function TaskDetail() {
  const { state, dispatch, confirm, toast } = useApp()
  const { updateTask, deleteTask } = useTasks()
  const task = state.tasks.find(t => t.id === state.selectedTaskId)

  const [title, setTitle]               = useState('')
  const [description, setDescription]   = useState('')
  const [status, setStatus]             = useState('todo')
  const [dueDate, setDueDate]           = useState('')
  const [dueTime, setDueTime]           = useState('')
  const [projectId, setProjectId]       = useState('')
  const [tags, setTags]                 = useState([])
  const [recurrence, setRecurrence]     = useState(null)
  const [recurrenceEnd, setRecurrenceEnd] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const [subtaskResults, setSubtaskResults] = useState([])
  const [saveIndicator, setSaveIndicator] = useState('idle') // 'idle' | 'saving' | 'saved'
  const subtaskDebounce = useRef(null)
  const inFlight = useRef(0)
  const saveTimer = useRef(null)

  const autoSave = useCallback(async (id, data) => {
    inFlight.current++
    setSaveIndicator('saving')
    clearTimeout(saveTimer.current)
    try {
      await updateTask(id, data)
    } finally {
      inFlight.current--
      if (inFlight.current === 0) {
        setSaveIndicator('saved')
        saveTimer.current = setTimeout(() => setSaveIndicator('idle'), 2000)
      }
    }
  }, [updateTask])

  // Load task into local state when selected task changes
  useEffect(() => {
    if (!task) return
    setTitle(task.title || '')
    setDescription(task.description || '')
    setStatus(task.status || 'todo')
    setDueDate(task.due_date || '')
    setDueTime(task.due_time || '')
    setProjectId(task.project_id || '')
    setTags(task.tags || [])
    setRecurrence(task.recurrence || null)
    setRecurrenceEnd(task.recurrence_end || '')
  }, [task?.id])

  if (!task) return null

  const close = () => dispatch({ type: 'SELECT_TASK', payload: null })

  const handleDelete = () => {
    confirm('Delete this task?', () => {
      deleteTask(task.id)
      dispatch({ type: 'SELECT_TASK', payload: null })
    })
  }

  // ── Subtasks ────────────────────────────────────────────────
  const handleSubtaskInput = (e) => {
    const val = e.target.value
    setSubtaskInput(val)
    clearTimeout(subtaskDebounce.current)
    if (val.length >= 3) {
      subtaskDebounce.current = setTimeout(async () => {
        const results = await api.searchTasks(val, task.id).catch(() => [])
        setSubtaskResults(results || [])
      }, 300)
    } else {
      setSubtaskResults([])
    }
  }

  const addSubtask = async () => {
    if (!subtaskInput.trim()) return
    try {
      const updated = await api.createSubtask(task.id, { title: subtaskInput.trim(), nlp: true })
      if (updated) dispatch({ type: 'UPDATE_TASK', payload: updated })
      setSubtaskInput('')
      setSubtaskResults([])
    } catch { toast('Failed to add subtask') }
  }

  const linkSubtask = async (linkedTaskId) => {
    try {
      const updated = await api.createSubtask(task.id, { linked_task_id: linkedTaskId })
      if (updated) dispatch({ type: 'UPDATE_TASK', payload: updated })
      setSubtaskInput('')
      setSubtaskResults([])
    } catch { toast('Failed to link task') }
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div className="md:hidden fixed inset-0 z-[60] bg-black/40 animate-fade-in" onClick={close} />

      <aside className={`
        fixed inset-x-0 bottom-0 z-[61] w-full max-w-md ml-auto
        md:relative md:inset-auto md:w-80 md:z-auto md:border-l md:border-td-border dark:border-tn-border
        bg-td-bg2 dark:bg-tn-bg2 flex flex-col overflow-hidden
        `} style={{ top: 'env(safe-area-inset-top, 0px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
          <button onClick={close} className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:text-tn-fg transition-colors">
            <X size={18} />
          </button>
          <span className="text-[11px] transition-opacity duration-300"
            style={{ opacity: saveIndicator === 'idle' ? 0 : 1 }}>
            {saveIndicator === 'saving'
              ? <span className="text-td-muted dark:text-tn-muted">Saving…</span>
              : <span className="text-td-green dark:text-tn-green">Saved ✓</span>}
          </span>
          <button onClick={handleDelete} className="text-td-muted/50 dark:text-tn-muted/50 hover:text-td-red dark:text-tn-red transition-colors p-1">
            <Trash2 size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
          style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Task Name</label>
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => { if (title !== task.title) autoSave(task.id, { title }) }}
            rows={2}
            className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-base font-medium resize-none outline-none leading-snug rounded-lg px-3 py-2.5 border border-td-border/50 dark:border-tn-border/50 placeholder-td-muted/40 dark:placeholder-tn-muted/40"
            placeholder="Task title"
          />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => { if (description !== (task.description || '')) autoSave(task.id, { description }) }}
              rows={2}
              placeholder="Add description…"
              className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-sm rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50 resize-none placeholder-td-muted/40 dark:placeholder-tn-muted/40 font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Status</label>
            <select
              value={status}
              onChange={e => { const v = e.target.value; setStatus(v); autoSave(task.id, { status: v }) }}
              className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50 appearance-none cursor-pointer"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          {/* Due date + time */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Due Date</label>
            <div className="flex gap-2">
              <input type="date" value={dueDate}
                onChange={e => { const v = e.target.value; setDueDate(v); autoSave(task.id, { due_date: v || null }) }}
                className="flex-1 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50"
              />
              <input type="time" value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                onBlur={e => { const v = e.target.value; if (v !== (task.due_time || '')) autoSave(task.id, { due_time: v || null }) }}
                className="w-28 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50"
              />
            </div>
          </div>

          {/* Recurrence */}
          <RecurrenceEditor
            recurrence={recurrence}
            recurrenceEnd={recurrenceEnd}
            onChange={({ recurrence: r, recurrence_end: re }) => {
              const overrides = {}
              if (r !== undefined) { setRecurrence(r); overrides.recurrence = r || null }
              if (re !== undefined) { setRecurrenceEnd(re || ''); overrides.recurrence_end = re || null }
              if (Object.keys(overrides).length) autoSave(task.id, overrides)
            }}
          />

          {/* Project */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Project</label>
            <select
              value={projectId}
              onChange={e => { const v = e.target.value; setProjectId(v); autoSave(task.id, { project_id: v || null }) }}
              className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50"
            >
              <option value="">No project</option>
              {state.projects.filter(p => p.id !== 'inbox').map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Tags</label>
            <TagCombobox
              tags={tags}
              onChange={next => { setTags(next); autoSave(task.id, { tags: next }) }}
            />
          </div>

          {/* Links */}
          <LinksSection task={task} onUpdate={updated => dispatch({ type: 'UPDATE_TASK', payload: updated })} />

          {/* Subtasks */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">
              Subtasks {task.subtasks?.length > 0 && `(${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length})`}
            </label>
            <div className="divide-y divide-td-border/30 dark:divide-tn-border/30">
              {(task.subtasks || []).map(s => (
                <SubtaskRow key={s.id} sub={s} taskId={task.id} />
              ))}
            </div>
            <div className="relative">
              {subtaskResults.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 z-20 rounded-xl border border-td-border dark:border-tn-border bg-white dark:bg-tn-bg2 shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                  {subtaskResults.map(t => (
                    <button key={t.id} onMouseDown={() => linkSubtask(t.id)}
                      className="w-full text-left text-xs px-3 py-2 hover:bg-td-surface dark:hover:bg-tn-surface flex items-center gap-2 transition-colors">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[t.status] || STATUS_DOT.todo}`} />
                      <span className="text-td-fg dark:text-tn-fg truncate">{t.title}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text" value={subtaskInput}
                  onChange={handleSubtaskInput}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addSubtask()
                    if (e.key === 'Escape') setSubtaskResults([])
                  }}
                  onBlur={() => setTimeout(() => setSubtaskResults([]), 150)}
                  placeholder="Add subtask or search tasks…"
                  className="flex-1 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50 placeholder-td-muted/40 dark:placeholder-tn-muted/40"
                />
                <button onClick={addSubtask} className="px-3 py-2 bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted hover:text-td-blue dark:text-tn-blue rounded-lg text-xs border border-td-border/50 dark:border-tn-border/50">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="text-[10px] text-td-muted/40 dark:text-tn-muted/40 pt-2">
            Created {new Date(task.created_at).toLocaleDateString()}
          </div>
        </div>
      </aside>
    </>
  )
}
