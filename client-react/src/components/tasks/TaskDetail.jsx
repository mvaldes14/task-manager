import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { api } from '../../api'
import { formatDate, fmtTime, recurrenceLabel } from '../../utils'
import { X, Trash2, Plus, Check, ChevronRight, Paperclip, GitBranch, Link2 } from 'lucide-react'

const STATUSES = ['todo', 'doing', 'done']

function SubtaskRow({ sub, taskId }) {
  const { dispatch } = useApp()
  const { toast } = useApp()

  const toggle = async () => {
    try {
      const updated = await api.updateSubtask(taskId, sub.id, { completed: !sub.completed })
      // refresh task
      const task = await api.getTasks().then(ts => ts?.find(t => t.id === taskId))
      if (task) dispatch({ type: 'UPDATE_TASK', payload: task })
    } catch { toast('Failed to update subtask') }
  }

  const del = async () => {
    try {
      await api.deleteSubtask(taskId, sub.id)
      const task = await api.getTasks().then(ts => ts?.find(t => t.id === taskId))
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
      <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-td-muted dark:text-tn-muted' : 'text-td-fg dark:text-tn-fg'}`}>
        {sub.title}
      </span>
      <button onClick={del} className="opacity-0 group-hover:opacity-100 text-td-muted/50 dark:text-tn-muted/50 hover:text-td-red dark:text-tn-red p-0.5">
        <X size={12} />
      </button>
    </div>
  )
}

function getLinkLabel(url = '') {
  if (url.startsWith('obsidian://')) return 'Obsidian Note'
  if (url.includes('github.com'))   return 'GitHub'
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return 'Link' }
}

function linkStyle(url = '', dark = false) {
  if (url.startsWith('obsidian://')) return dark
    ? { color: '#bb9af7', bg: 'rgba(187,154,247,0.15)' }
    : { color: '#7c4fb5', bg: 'rgba(187,154,247,0.18)' }
  if (url.includes('github.com'))   return dark
    ? { color: '#57606a', bg: 'rgba(87,96,106,0.12)' }
    : { color: '#24292f', bg: 'rgba(87,96,106,0.14)' }
  return dark
    ? { color: '#e0af68', bg: 'rgba(224,175,104,0.15)' }
    : { color: '#8f6120', bg: 'rgba(224,175,104,0.20)' }
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
        const s = linkStyle(link.url, isDark)
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

export function TaskDetail() {
  const { state, dispatch, confirm, toast } = useApp()
  const { updateTask, deleteTask } = useTasks()
  const task = state.tasks.find(t => t.id === state.selectedTaskId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('todo')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [projectId, setProjectId] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const titleRef = useRef(null)

  // Load task into local state
  useEffect(() => {
    if (!task) return
    setTitle(task.title || '')
    setDescription(task.description || '')
    setStatus(task.status || 'todo')
    setDueDate(task.due_date || '')
    setDueTime(task.due_time || '')
    setProjectId(task.project_id || '')
    setTags(task.tags || [])
    setDirty(false)
  }, [task?.id])

  if (!task) return null

  const close = () => {
    if (dirty) save()
    dispatch({ type: 'SELECT_TASK', payload: null })
  }

  const save = async () => {
    if (!dirty) return
    setSaving(true)
    await updateTask(task.id, {
      title, description, status,
      due_date: dueDate || null,
      due_time: dueTime || null,
      project_id: projectId || null,
      tags,
    })
    setSaving(false)
    setDirty(false)
  }

  const markDirty = () => setDirty(true)

  const handleDelete = () => {
    confirm('Delete this task?', () => {
      deleteTask(task.id)
      dispatch({ type: 'SELECT_TASK', payload: null })
    })
  }

  const addSubtask = async () => {
    if (!subtaskInput.trim()) return
    try {
      const updated = await api.createSubtask(task.id, { title: subtaskInput.trim(), nlp: true })
      if (updated) dispatch({ type: 'UPDATE_TASK', payload: updated })
      setSubtaskInput('')
    } catch { toast('Failed to add subtask') }
  }

  const addTag = () => {
    const t = tagInput.trim().replace(/^@/, '')
    if (t && !tags.includes(t)) {
      const next = [...tags, t]
      setTags(next); setTagInput(''); markDirty()
    }
  }

  const removeTag = (t) => { setTags(tags.filter(x => x !== t)); markDirty() }

  return (
    <>
      {/* Mobile backdrop */}
      <div className="md:hidden fixed inset-0 z-[60] bg-black/40 animate-fade-in" onClick={close} />

      <aside className={`
        fixed inset-y-0 right-0 z-[61] w-full max-w-md
        md:relative md:inset-auto md:w-80 md:z-auto md:border-l md:border-td-border dark:border-tn-border
        bg-td-bg2 dark:bg-tn-bg2 flex flex-col overflow-hidden
        animate-fade-in
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
          <button onClick={close} className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:text-tn-fg transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            {dirty && (
              <button onClick={async () => { await save(); dispatch({ type: 'SELECT_TASK', payload: null }) }} disabled={saving}
                className="text-xs text-td-blue dark:text-tn-blue font-medium px-2.5 py-1 rounded-lg bg-td-blue/10 dark:bg-tn-blue/10 hover:bg-td-blue/20 dark:bg-tn-blue/20 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            <button onClick={handleDelete} className="text-td-muted/50 dark:text-tn-muted/50 hover:text-td-red dark:text-tn-red transition-colors p-1">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
          style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>

          {/* Title */}
          <textarea
            ref={titleRef}
            value={title}
            onChange={e => { setTitle(e.target.value); markDirty() }}
            onBlur={save}
            rows={2}
            className="w-full bg-transparent text-td-fg dark:text-tn-fg text-base font-medium resize-none outline-none leading-snug"
            placeholder="Task title"
          />

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Status</label>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); markDirty(); save() }}
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
                onChange={e => { setDueDate(e.target.value); markDirty() }}
                onBlur={save}
                className="flex-1 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50"
              />
              <input type="time" value={dueTime}
                onChange={e => { setDueTime(e.target.value); markDirty() }}
                onBlur={save}
                className="w-28 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50"
              />
            </div>
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Project</label>
            <select
              value={projectId}
              onChange={e => { setProjectId(e.target.value); markDirty(); save() }}
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
            <div className="flex gap-2">
              <input
                type="text" value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTag() }}
                placeholder="Add tag…"
                className="flex-1 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50 placeholder-td-muted/40 dark:placeholder-tn-muted/40"
              />
              <button onClick={addTag} className="px-3 py-2 bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted hover:text-td-blue dark:text-tn-blue rounded-lg text-xs border border-td-border/50 dark:border-tn-border/50">
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">Notes</label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); markDirty() }}
              onBlur={save}
              rows={4}
              placeholder="Add notes…"
              className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-sm rounded-lg px-3 py-2.5 outline-none border border-td-border/50 dark:border-tn-border/50 resize-none placeholder-td-muted/40 dark:placeholder-tn-muted/40 font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Links */}
          <LinksSection task={task} onUpdate={updated => dispatch({ type: 'UPDATE_TASK', payload: updated })} />

          {/* Subtasks */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-td-muted dark:text-tn-muted">
              Subtasks {task.subtasks?.length > 0 && `(${task.subtasks.filter(s=>s.completed).length}/${task.subtasks.length})`}
            </label>
            <div className="divide-y divide-td-border/30 dark:divide-tn-border/30">
              {(task.subtasks || []).map(s => (
                <SubtaskRow key={s.id} sub={s} taskId={task.id} />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text" value={subtaskInput}
                onChange={e => setSubtaskInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSubtask() }}
                placeholder="Add subtask…"
                className="flex-1 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-xs rounded-lg px-2.5 py-2 outline-none border border-td-border/50 dark:border-tn-border/50 placeholder-td-muted/40 dark:placeholder-tn-muted/40"
              />
              <button onClick={addSubtask} className="px-3 py-2 bg-td-surface dark:bg-tn-surface text-td-muted dark:text-tn-muted hover:text-td-blue dark:text-tn-blue rounded-lg text-xs border border-td-border/50 dark:border-tn-border/50">
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Recurrence */}
          {recurrenceLabel(task.recurrence) && (
            <div className="text-xs text-td-teal dark:text-tn-teal bg-td-teal/10 dark:bg-tn-teal/10 px-3 py-2 rounded-lg">
              {recurrenceLabel(task.recurrence)}
              {task.recurrence_end && ` · until ${task.recurrence_end}`}
            </div>
          )}

          {/* Meta */}
          <div className="text-[10px] text-td-muted/40 dark:text-tn-muted/40 pt-2">
            Created {new Date(task.created_at).toLocaleDateString()}
          </div>
        </div>
      </aside>
    </>
  )
}
