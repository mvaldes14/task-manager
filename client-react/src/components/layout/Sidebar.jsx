import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { isOverdue, isToday } from '../../utils'
import { Plus, LogOut, Sun, Moon, Settings, Trash2 } from 'lucide-react'
import { api } from '../../api'

const PROJECT_COLORS = ['#f7768e','#ff9e64','#e0af68','#9ece6a','#73daca','#7dcfff','#7aa2f7','#bb9af7','#c0caf5']
const PROJECT_ICONS  = ['📁','📂','🏠','💼','🎯','🔬','📚','🎨','💡','🛒','🏋️','🎵','✈️','💻','🌱']

function NavItem({ icon, label, viewKey, badge, badgeColor = 'bg-td-blue dark:bg-tn-blue' }) {
  const { state, dispatch } = useApp()
  const active = state.view === viewKey
  return (
    <button
      onClick={() => dispatch({ type: 'SET_VIEW', payload: viewKey })}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${active
          ? 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg font-medium'
          : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50'
        }`}
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white min-w-[18px] text-center ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function ProjectFormModal({ project, onClose }) {
  const { state, dispatch, confirm, toast } = useApp()
  const isEdit = !!project
  const [name, setName] = useState(project?.name || '')
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[6])
  const [icon, setIcon] = useState(project?.icon || '📁')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (isEdit) {
        const p = await api.updateProject(project.id, { name: name.trim(), color, icon })
        dispatch({ type: 'UPDATE_PROJECT', payload: p })
        toast('Project updated')
      } else {
        const p = await api.createProject({ name: name.trim(), color, icon })
        dispatch({ type: 'ADD_PROJECT', payload: p })
        toast('Project created')
      }
      onClose()
    } catch { toast(`Failed to ${isEdit ? 'update' : 'create'} project`) }
    setSaving(false)
  }

  const handleDelete = () => {
    confirm('Delete this project? Tasks will be unassigned.', async () => {
      await api.deleteProject(project.id)
      dispatch({ type: 'DELETE_PROJECT', payload: project.id })
      if (state.view === `project:${project.id}`) dispatch({ type: 'SET_VIEW', payload: 'inbox' })
      toast('Project deleted')
      onClose()
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/50" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[111] bg-td-bg2 dark:bg-tn-bg2 rounded-2xl p-5 max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-td-fg dark:text-tn-fg font-semibold">
            {isEdit ? 'Edit Project' : 'New Project'}
          </h3>
          {isEdit && (
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 text-xs text-td-muted/50 dark:text-tn-muted/50 hover:text-td-red dark:hover:text-tn-red transition-colors px-2 py-1 rounded-lg hover:bg-td-red/10 dark:hover:bg-tn-red/10">
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
        <input
          autoFocus
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Project name"
          onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg placeholder-td-muted/50 dark:placeholder-tn-muted/50 text-sm rounded-lg px-3 py-2.5 outline-none mb-3 border border-td-border/50 dark:border-tn-border/50"
        />
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PROJECT_ICONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)}
              className={`text-base w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                ${icon === ic ? 'bg-td-surface dark:bg-tn-surface ring-2 ring-td-blue dark:ring-tn-blue' : 'hover:bg-td-surface/70 dark:hover:bg-tn-surface/70'}`}>
              {ic}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-5">
          {PROJECT_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/50' : ''}`}
              style={{ background: c }} />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-td-muted dark:text-tn-muted text-sm bg-td-surface dark:bg-tn-surface">Cancel</button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-td-blue dark:bg-tn-blue disabled:opacity-40">
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </>
  )
}

export function Sidebar() {
  const { state, dispatch } = useApp()
  const [showNewProject, setShowNewProject] = useState(false)
  const [editingProject, setEditingProject] = useState(null)

  const overdueCount = useMemo(() => state.tasks.filter(t => isOverdue(t)).length, [state.tasks])
  const inboxCount   = useMemo(() => state.tasks.filter(t => t.status !== 'done').length, [state.tasks])
  const todayCount   = useMemo(() => state.tasks.filter(t => isToday(t) && t.status !== 'done').length, [state.tasks])

  const toggleTheme = () => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('td-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    dispatch({ type: 'SET_THEME', payload: next })
  }

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-64 bg-td-bg2 dark:bg-tn-bg2 border-r border-td-border dark:border-tn-border flex flex-col
      transition-transform duration-300
      md:relative md:translate-x-0 md:flex
      ${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-td-border/50 dark:border-tn-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 text-white font-bold text-lg select-none"
            style={{ background: '#7aa2f7', boxShadow: '0 2px 8px rgba(122,162,247,0.45)' }}>
            ✓
          </div>
          <span className="text-td-fg dark:text-tn-fg font-bold text-base tracking-tight">TD</span>
        </div>
        <button onClick={toggleTheme}
          className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors p-1">
          {state.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <NavItem icon="📥" label="Inbox"     viewKey="inbox"    badge={inboxCount} />
        <NavItem icon="☀️" label="Today"     viewKey="today"    badge={todayCount} />
        <NavItem icon="📋" label="All Tasks" viewKey="all" />
        <NavItem icon="🗓" label="Calendar"  viewKey="calendar" />
        <NavItem icon="🔴" label="Overdue"   viewKey="overdue"
          badge={overdueCount} badgeColor="bg-td-red dark:bg-tn-red" />

        <div className="pt-3 pb-1 px-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold tracking-widest text-td-muted/60 dark:text-tn-muted/60 uppercase">Projects</span>
            <button onClick={() => setShowNewProject(true)}
              className="text-td-muted/60 dark:text-tn-muted/60 hover:text-td-blue dark:hover:text-tn-blue transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {state.projects.filter(p => p.id !== 'inbox').map(p => {
          const count = state.tasks.filter(t => t.project_id === p.id && t.status !== 'done').length
          const active = state.view === `project:${p.id}`
          return (
            <button key={p.id}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: `project:${p.id}` })}
              className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${active
                  ? 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg font-medium'
                  : 'text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50'}`}
            >
              <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-sm"
                style={{ background: p.color + '25' }}>
                {p.icon}
              </span>
              <span className="flex-1 text-left truncate">{p.name}</span>
              {count > 0 && (
                <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60 group-hover:hidden">
                  {count}
                </span>
              )}
              {/* Gear — shown on hover, replaces count */}
              <button
                onClick={e => { e.stopPropagation(); setEditingProject(p) }}
                className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded
                  text-td-muted/50 dark:text-tn-muted/50 hover:text-td-fg dark:hover:text-tn-fg
                  hover:bg-td-surface dark:hover:bg-tn-surface transition-all"
                title="Edit project"
              >
                <Settings size={12} />
              </button>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-td-border/50 dark:border-tn-border/50 px-2 py-3">
        <button
          onClick={async () => { await api.logout(); window.location.reload() }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm
            text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg
            hover:bg-td-surface/50 dark:hover:bg-tn-surface/50 transition-colors"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>

      {showNewProject && <ProjectFormModal onClose={() => setShowNewProject(false)} />}
      {editingProject && <ProjectFormModal project={editingProject} onClose={() => setEditingProject(null)} />}
    </aside>
  )
}
