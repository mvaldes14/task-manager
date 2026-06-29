import { useMemo, useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { isOverdue, isToday } from '../../utils'
import { Plus, LogOut, Sun, Moon, Settings, Trash2, CheckCircle2, RefreshCw, Calendar, Inbox, Layers, AlertCircle, PanelLeftClose, PanelLeftOpen, LayoutDashboard, Users } from 'lucide-react'
import { api } from '../../api'
import { ProjectIcon, PROJECT_ICON_OPTIONS } from '../shared/ProjectIcon'
import { SettingsModal } from '../settings/SettingsModal'

const PROJECT_COLORS = ['#f7768e','#ff9e64','#e0af68','#9ece6a','#73daca','#7dcfff','#7aa2f7','#bb9af7','#c0caf5']

function NavItem({ icon: Icon, label, viewKey, badge, badgeColor = 'bg-td-blue dark:bg-tn-blue', collapsed }) {
  const { state, dispatch } = useApp()
  const active = state.view === viewKey
  return (
    <button
      onClick={() => dispatch({ type: 'SET_VIEW', payload: viewKey })}
      title={collapsed ? label : undefined}
      className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${collapsed ? 'justify-center' : ''}
        ${active
          ? 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg font-semibold'
          : 'text-td-muted dark:text-tn-nav font-medium hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50'
        }`}
    >
      <div className="relative shrink-0">
        <Icon size={16} />
        {collapsed && badge > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 py-px rounded-full text-white leading-none ${badgeColor}`}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && badge > 0 && (
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
  const [shared, setShared] = useState(project?.shared || false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (isEdit) {
        const p = await api.updateProject(project.id, { name: name.trim(), color, icon, shared })
        dispatch({ type: 'UPDATE_PROJECT', payload: p })
        toast('Project updated')
      } else {
        const p = await api.createProject({ name: name.trim(), color, icon, shared })
        dispatch({ type: 'ADD_PROJECT', payload: p })
        toast('Project created')
      }
      onClose()
    } catch { toast(`Failed to ${isEdit ? 'update' : 'create'} project`) }
    setSaving(false)
  }

  const handleDelete = () => {
    confirm('Delete this project? Tasks will be unassigned.', async () => {
      try {
        await api.deleteProject(project.id)
        dispatch({ type: 'DELETE_PROJECT', payload: project.id })
        if (state.view === `project:${project.id}`) dispatch({ type: 'SET_VIEW', payload: 'inbox' })
        toast('Project deleted')
        onClose()
      } catch {
        toast('Failed to delete project')
      }
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
          {PROJECT_ICON_OPTIONS.map(({ name, Icon }) => (
            <button key={name} onClick={() => setIcon(name)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                ${icon === name
                  ? 'bg-td-surface dark:bg-tn-surface ring-2 ring-td-blue dark:ring-tn-blue text-td-fg dark:text-tn-fg'
                  : 'text-td-muted dark:text-tn-muted hover:bg-td-surface/70 dark:hover:bg-tn-surface/70 hover:text-td-fg dark:hover:text-tn-fg'}`}>
              <Icon size={15} />
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 mb-4">
          {PROJECT_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/50' : ''}`}
              style={{ background: c }} />
          ))}
        </div>
        <button
          onClick={() => setShared(s => !s)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm mb-5 transition-colors border
            ${shared
              ? 'bg-td-blue/10 dark:bg-tn-blue/10 border-td-blue/30 dark:border-tn-blue/30 text-td-blue dark:text-tn-blue'
              : 'bg-td-surface dark:bg-tn-surface border-td-border/50 dark:border-tn-border/50 text-td-muted dark:text-tn-muted'}`}
        >
          <Users size={14} />
          <span className="flex-1 text-left font-medium">Shared project</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${shared ? 'bg-td-blue/20 dark:bg-tn-blue/20 text-td-blue dark:text-tn-blue' : 'bg-td-surface dark:bg-tn-surface text-td-muted/50 dark:text-tn-muted/50'}`}>
            {shared ? 'ON' : 'OFF'}
          </span>
        </button>
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

function UserAvatar({ user, size = 28 }) {
  if (!user) return null
  if (user.has_avatar) {
    return (
      <img
        src={api.getUserAvatarUrl(user.id)}
        alt={user.display_name || user.username}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  const initials = (user.display_name || user.username || '?')[0].toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold select-none"
      style={{ width: size, height: size, fontSize: size * 0.4, background: '#7aa2f7' }}
    >
      {initials}
    </div>
  )
}

export function Sidebar() {
  const { state, dispatch, toast } = useApp()
  const [showNewProject, setShowNewProject] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [dragProjectId, setDragProjectId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)

  const handleProjectDrop = async (targetId) => {
    const sourceId = dragProjectId
    setDragProjectId(null)
    setDropTargetId(null)
    if (!sourceId || sourceId === targetId) return
    const list = state.projects.filter(p => p.id !== 'inbox')
    const fromIdx = list.findIndex(p => p.id === sourceId)
    const toIdx = list.findIndex(p => p.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const reordered = [...list]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const withPositions = reordered.map((p, i) => ({ ...p, position: i + 1 }))
    const inbox = state.projects.find(p => p.id === 'inbox')
    dispatch({ type: 'SET_PROJECTS', payload: inbox ? [inbox, ...withPositions] : withPositions })
    try {
      await api.reorderProjects(reordered.map(p => p.id))
    } catch {
      toast('Failed to reorder projects')
    }
  }

  const asideRef = useRef(null)

  // Prevent background scroll while drawer is open on mobile
  useEffect(() => {
    if (state.sidebarOpen) {
      document.body.classList.add('overflow-hidden')
    }
    return () => document.body.classList.remove('overflow-hidden')
  }, [state.sidebarOpen])

  // Swipe-left to dismiss (mobile only, direct DOM manipulation to avoid re-render jank)
  useEffect(() => {
    const el = asideRef.current
    if (!el || !state.sidebarOpen) return

    let touch = null

    const onStart = (e) => {
      if (window.innerWidth >= 768) return
      const t = e.touches[0]
      touch = { x: t.clientX, y: t.clientY, time: Date.now(), locked: null }
    }

    const onMove = (e) => {
      if (!touch || window.innerWidth >= 768) return
      const t = e.touches[0]
      const dx = t.clientX - touch.x
      const dy = t.clientY - touch.y
      if (touch.locked === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        touch.locked = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v'
      }
      if (touch.locked !== 'h') return
      if (dx > 0) return
      e.preventDefault()
      el.style.transform = `translateX(${dx}px)`
      el.style.transition = 'none'
    }

    const onEnd = (e) => {
      if (!touch) return
      const locked = touch.locked
      const dx = e.changedTouches[0].clientX - touch.x
      const elapsed = Math.max(1, Date.now() - touch.time)
      const velocity = Math.abs(dx) / elapsed * 1000
      touch = null
      el.style.transform = ''
      el.style.transition = ''
      if (locked !== 'h') return
      if (dx < -48 || (dx < 0 && velocity > 400)) {
        dispatch({ type: 'SET_SIDEBAR', payload: false })
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      el.style.transform = ''
      el.style.transition = ''
    }
  }, [state.sidebarOpen, dispatch])

  const collapsed = state.sidebarCollapsed
  const toggle = () => dispatch({ type: 'TOGGLE_SIDEBAR_COLLAPSED' })

  const overdueCount = useMemo(() => state.tasks.filter(t => isOverdue(t)).length, [state.tasks])
  const inboxCount   = useMemo(() => state.tasks.filter(t => t.project_id === 'inbox' && t.status !== 'done').length, [state.tasks])
  const todayCount   = useMemo(() => state.tasks.filter(t => isToday(t) && t.status !== 'done').length, [state.tasks])

  const toggleTheme = () => {
    const next = state.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('td-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    dispatch({ type: 'SET_THEME', payload: next })
  }

  return (
    <>
      {/* Backdrop scrim — mobile only, fades in/out with the drawer */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-base ease-standard
          ${state.sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => dispatch({ type: 'SET_SIDEBAR', payload: false })}
        aria-hidden="true"
      />
      <aside
        ref={asideRef}
        className={`
          fixed left-0 top-0 bottom-0 z-50 bg-td-bg2 dark:bg-tn-bg2 border-r border-td-border dark:border-tn-border
          flex flex-col transition-transform duration-base ease-standard
          md:relative md:inset-y-0 md:translate-x-0 md:flex md:bottom-0
          ${collapsed ? 'w-[56px]' : 'w-64'}
          ${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className={`flex items-center py-4 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 text-white font-bold text-lg select-none"
              style={{ background: '#7aa2f7', boxShadow: '0 2px 8px rgba(122,162,247,0.45)' }}>
              ✓
            </div>
            <span className="text-td-fg dark:text-tn-fg font-bold text-base tracking-tight">Doit</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white font-bold text-lg select-none"
            style={{ background: '#7aa2f7', boxShadow: '0 2px 8px rgba(122,162,247,0.45)' }}>
            ✓
          </div>
        )}
        {!collapsed && (
          <button onClick={toggleTheme}
            className="text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg transition-colors p-1">
            {state.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3 space-y-0.5">
        <NavItem icon={LayoutDashboard} label="Dashboard" viewKey="dashboard" collapsed={collapsed} />
        <NavItem icon={Inbox}       label="Inbox"     viewKey="inbox"    badge={inboxCount} collapsed={collapsed} />
        <NavItem icon={Sun}         label="Today"     viewKey="today"    badge={todayCount} collapsed={collapsed} />
        <NavItem icon={Layers}      label="All"       viewKey="all"      collapsed={collapsed} />
        <NavItem icon={Calendar}    label="Calendar"  viewKey="calendar" collapsed={collapsed} />
        {overdueCount > 0 && (
          <NavItem icon={AlertCircle} label="Overdue"   viewKey="overdue"
            badge={overdueCount} badgeColor="bg-td-red dark:bg-tn-red" collapsed={collapsed} />
        )}

        {!collapsed && (
          <div className="pt-3 pb-1 px-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-widest text-td-muted/60 dark:text-tn-muted/60 uppercase">Projects</span>
              <button onClick={() => setShowNewProject(true)}
                className="text-td-muted/60 dark:text-tn-muted/60 hover:text-td-blue dark:hover:text-tn-blue transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="pt-2 pb-1 flex justify-center">
            <button onClick={() => setShowNewProject(true)} title="New project"
              className="text-td-muted/60 dark:text-tn-muted/60 hover:text-td-blue dark:hover:text-tn-blue transition-colors p-1">
              <Plus size={14} />
            </button>
          </div>
        )}

        {state.projects.filter(p => p.id !== 'inbox').map(p => {
          const count = state.tasks.filter(t => t.project_id === p.id && t.status !== 'done').length
          const active = state.view === `project:${p.id}`
          return collapsed ? (
            <button key={p.id}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: `project:${p.id}` })}
              title={p.name}
              className={`relative w-full flex items-center justify-center py-2 rounded-lg transition-colors
                ${active
                  ? 'bg-td-surface dark:bg-tn-surface'
                  : 'hover:bg-td-surface/50 dark:hover:bg-tn-surface/50'}`}
            >
              <span className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: p.color + '25' }}>
                <ProjectIcon icon={p.icon} size={13} />
              </span>
              {count > 0 && (
                <span className="absolute top-0.5 right-1 text-[9px] font-bold text-td-muted/60 dark:text-tn-muted/60">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          ) : (
            <button key={p.id}
              draggable
              onDragStart={e => { setDragProjectId(p.id); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragProjectId && dragProjectId !== p.id) setDropTargetId(p.id) }}
              onDragLeave={() => { if (dropTargetId === p.id) setDropTargetId(null) }}
              onDrop={e => { e.preventDefault(); handleProjectDrop(p.id) }}
              onDragEnd={() => { setDragProjectId(null); setDropTargetId(null) }}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: `project:${p.id}` })}
              className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${dragProjectId === p.id ? 'opacity-40' : ''}
                ${dropTargetId === p.id ? 'ring-1 ring-td-blue/60 dark:ring-tn-blue/60' : ''}
                ${active
                  ? 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg font-semibold'
                  : 'text-td-muted dark:text-tn-nav font-medium hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50'}`}
            >
              <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                style={{ background: p.color + '25' }}>
                <ProjectIcon icon={p.icon} size={13} />
              </span>
              <span className="flex-1 text-left truncate">{p.name}</span>
              <span className="flex items-center gap-1.5 shrink-0 group-hover:hidden">
                {p.shared && <Users size={10} className="text-td-blue/60 dark:text-tn-blue/60" title="Shared project" />}
                {count > 0 && <span className="text-[10px] text-td-muted/60 dark:text-tn-muted/60">{count}</span>}
              </span>
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
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            {state.currentUser && <UserAvatar user={state.currentUser} size={28} />}
            <button onClick={toggleTheme} title={state.theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="p-2 rounded-lg text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50 transition-colors">
              {state.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <div title={state.gcalEnabled ? 'Synced to Google Calendar' : 'Google Calendar not connected'}
              className="relative flex items-center justify-center p-2">
              <RefreshCw size={15} className={state.gcalEnabled ? 'text-td-green dark:text-tn-green' : 'text-td-muted/30 dark:text-tn-muted/30'} />
              {state.gcalEnabled && <CheckCircle2 size={9} className="absolute bottom-1 right-1 text-td-green dark:text-tn-green" />}
            </div>
            <button onClick={toggle} title="Expand sidebar"
              className="hidden md:flex p-2 rounded-lg text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50 transition-colors">
              <PanelLeftOpen size={15} />
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {state.currentUser && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                <UserAvatar user={state.currentUser} size={28} />
                <span className="flex-1 text-sm font-medium text-td-fg dark:text-tn-fg truncate">
                  {state.currentUser.display_name || state.currentUser.username}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={async () => { await api.logout(); window.location.href = '/login' }}
                className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg
                  hover:bg-td-surface/50 dark:hover:bg-tn-surface/50 transition-colors"
              >
                <LogOut size={16} /> Sign out
              </button>
              <button onClick={() => setShowSettings(true)} title="Settings"
                className="flex items-center justify-center p-2 rounded-lg text-td-muted dark:text-tn-nav
                  hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50 transition-colors">
                <Settings size={15} />
              </button>
              <div title={state.gcalEnabled ? 'Synced to Google Calendar' : 'Google Calendar not connected'}
                className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs">
                <RefreshCw size={14} className={state.gcalEnabled ? 'text-td-green dark:text-tn-green' : 'text-td-muted/30 dark:text-tn-muted/30'} />
                {state.gcalEnabled && <CheckCircle2 size={10} className="text-td-green dark:text-tn-green -ml-0.5" />}
              </div>
              <button onClick={toggle} title="Collapse sidebar"
                className="hidden md:flex items-center justify-center p-2 rounded-lg text-td-muted dark:text-tn-muted
                  hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50 transition-colors">
                <PanelLeftClose size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewProject && <ProjectFormModal onClose={() => setShowNewProject(false)} />}
      {editingProject && <ProjectFormModal project={editingProject} onClose={() => setEditingProject(null)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </aside>
    </>
  )
}

