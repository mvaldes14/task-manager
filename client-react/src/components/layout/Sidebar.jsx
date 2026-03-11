import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { isOverdue, isToday } from '../../utils'
import { Plus, Settings, LogOut, Sun, Moon, Inbox, Calendar, List, AlertCircle, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../api'

const PROJECT_COLORS = ['#f7768e','#ff9e64','#e0af68','#9ece6a','#73daca','#7dcfff','#7aa2f7','#bb9af7','#c0caf5']
const PROJECT_ICONS  = ['📁','📂','🏠','💼','🎯','🔬','📚','🎨','💡','🛒','🏋️','🎵','✈️','💻','🌱']

function NavItem({ icon, label, viewKey, badge, badgeColor = 'bg-tn-blue' }) {
  const { state, dispatch } = useApp()
  const active = state.view === viewKey
  return (
    <button
      onClick={() => dispatch({ type: 'SET_VIEW', payload: viewKey })}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${active
          ? 'bg-tn-surface text-tn-fg font-medium'
          : 'text-tn-muted hover:text-tn-fg hover:bg-tn-surface/50'
        }`}
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-tn-bg2 min-w-[18px] text-center ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function ProjectModal({ onClose }) {
  const { dispatch, toast } = useApp()
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[6])
  const [icon, setIcon] = useState('📁')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const p = await api.createProject({ name: name.trim(), color, icon })
      dispatch({ type: 'ADD_PROJECT', payload: p })
      toast('Project created')
      onClose()
    } catch { toast('Failed to create project') }
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[111] bg-tn-bg2 rounded-2xl p-5 max-w-sm mx-auto">
        <h3 className="text-tn-fg font-semibold mb-4">New Project</h3>
        <input
          autoFocus
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Project name"
          onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-tn-surface text-tn-fg placeholder-tn-muted/50 text-sm rounded-lg px-3 py-2.5 outline-none mb-3"
        />
        {/* Icon picker */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PROJECT_ICONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)}
              className={`text-base w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                ${icon === ic ? 'bg-tn-surface ring-2 ring-tn-blue' : 'hover:bg-tn-surface/50'}`}>
              {ic}
            </button>
          ))}
        </div>
        {/* Color picker */}
        <div className="flex gap-1.5 mb-4">
          {PROJECT_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/50' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-tn-muted text-sm bg-tn-surface">Cancel</button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-tn-bg2 text-sm font-semibold bg-tn-blue disabled:opacity-40">
            Create
          </button>
        </div>
      </div>
    </>
  )
}

export function Sidebar() {
  const { state, dispatch, confirm, toast } = useApp()
  const [showNewProject, setShowNewProject] = useState(false)

  const overdueCount = useMemo(() =>
    state.tasks.filter(t => isOverdue(t)).length, [state.tasks])
  const inboxCount = useMemo(() =>
    state.tasks.filter(t => !t.project_id && t.status !== 'done').length, [state.tasks])
  const todayCount = useMemo(() =>
    state.tasks.filter(t => isToday(t) && t.status !== 'done').length, [state.tasks])

  const toggleTheme = () => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('td-theme', next)
    document.documentElement.classList.toggle('light', next === 'light')
    dispatch({ type: 'SET_THEME', payload: next })
  }

  const handleDeleteProject = (e, pid) => {
    e.stopPropagation()
    confirm('Delete this project? Tasks will be unassigned.', async () => {
      await api.deleteProject(pid)
      dispatch({ type: 'DELETE_PROJECT', payload: pid })
      if (state.view === `project:${pid}`) dispatch({ type: 'SET_VIEW', payload: 'inbox' })
      toast('Project deleted')
    })
  }

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-tn-bg2 border-r border-tn-border flex flex-col
      transition-transform duration-300
      md:relative md:translate-x-0 md:flex
      ${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-tn-border/50">
        <span className="text-tn-fg font-bold text-base tracking-tight">TD</span>
        <button onClick={toggleTheme} className="text-tn-muted hover:text-tn-fg transition-colors p-1">
          {state.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <NavItem icon="📥" label="Inbox" viewKey="inbox" badge={inboxCount} />
        <NavItem icon="☀️" label="Today" viewKey="today" badge={todayCount} />
        <NavItem icon="📋" label="All Tasks" viewKey="all" />
        <NavItem icon="🗓" label="Calendar" viewKey="calendar" />
        <NavItem icon="🔴" label="Overdue" viewKey="overdue"
          badge={overdueCount} badgeColor="bg-tn-red" />

        {/* Projects */}
        <div className="pt-3 pb-1 px-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-widest text-tn-muted/60 uppercase">Projects</span>
            <button onClick={() => setShowNewProject(true)}
              className="text-tn-muted/60 hover:text-tn-blue transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>
        {state.projects.map(p => {
          const count = state.tasks.filter(t => t.project_id === p.id && t.status !== 'done').length
          const active = state.view === `project:${p.id}`
          return (
            <button key={p.id}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: `project:${p.id}` })}
              className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${active ? 'bg-tn-surface text-tn-fg font-medium' : 'text-tn-muted hover:text-tn-fg hover:bg-tn-surface/50'}`}
            >
              <span className="text-base w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: p.color + '25' }}>
                {p.icon}
              </span>
              <span className="flex-1 text-left truncate">{p.name}</span>
              {count > 0 && <span className="text-[10px] text-tn-muted/60">{count}</span>}
              <button
                onClick={e => handleDeleteProject(e, p.id)}
                className="opacity-0 group-hover:opacity-100 text-tn-muted/50 hover:text-tn-red transition-all p-0.5"
              >
                <Trash2 size={12} />
              </button>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-tn-border/50 px-2 py-3 space-y-0.5">
        <button
          onClick={async () => { await api.logout(); window.location.reload() }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-tn-muted hover:text-tn-fg hover:bg-tn-surface/50 transition-colors"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>

      {showNewProject && <ProjectModal onClose={() => setShowNewProject(false)} />}
    </aside>
  )
}
