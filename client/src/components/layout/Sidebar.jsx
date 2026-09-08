import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { useTasks } from '../../hooks/useTasks'
import { isOverdue, isToday } from '../../utils'
import { Plus, LogOut, Sun, Moon, Settings, Trash2, CheckCircle2, RefreshCw, CalendarDays, CalendarClock, Inbox, Layers, AlertCircle, PanelLeftClose, PanelLeftOpen, LayoutDashboard, Users, Search, ChevronRight, Archive, ArchiveRestore } from 'lucide-react'
import { api } from '../../api'
import { ProjectIcon, PROJECT_ICON_OPTIONS } from '../shared/ProjectIcon'
import { SettingsModal } from '../settings/SettingsModal'
import { Logo } from '../ui'
import { TASK_DRAG_TYPE } from '../../constants/dnd'

const PROJECT_COLORS = ['#f7768e','#ff9e64','#e0af68','#9ece6a','#73daca','#7dcfff','#7aa2f7','#bb9af7','#c0caf5']

function NavItem({ icon: Icon, label, viewKey, badge, badgeColor = 'bg-td-blue dark:bg-tn-blue', collapsed }) {
  const { state, dispatch } = useApp()
  const active = state.view === viewKey
  return (
    <button
      onClick={() => dispatch({ type: 'SET_VIEW', payload: viewKey })}
      title={collapsed ? label : undefined}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 md:py-2 min-h-[44px] md:min-h-0 rounded-lg text-sm transition-colors
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

function SearchNavItem({ collapsed }) {
  const { dispatch } = useApp()
  return (
    <button
      onClick={() => {
        dispatch({ type: 'SET_SEARCH_OPEN', payload: true })
        dispatch({ type: 'SET_SIDEBAR', payload: false })
      }}
      title={collapsed ? 'Search' : undefined}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 md:py-2 min-h-[44px] md:min-h-0 rounded-lg text-sm transition-colors
        ${collapsed ? 'justify-center' : ''}
        text-td-muted dark:text-tn-nav font-medium hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50`}
    >
      <Search size={16} className="shrink-0" />
      {!collapsed && <span className="flex-1 text-left">Search</span>}
    </button>
  )
}

function ProjectFormModal({ project, onClose }) {
  const { state, dispatch, confirm, toast } = useApp()
  const { loadAll } = useTasks()
  const isEdit = !!project
  const [name, setName] = useState(project?.name || '')
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[6])
  const [icon, setIcon] = useState(project?.icon || '📁')
  const iconGridRef = useRef(null)

  // Scroll the current icon into view once when the modal opens — otherwise editing a
  // project whose icon sits in a lower row shows an apparently empty selection.
  useEffect(() => {
    const el = iconGridRef.current?.querySelector('[aria-pressed="true"]')
    el?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [shared, setShared] = useState(project?.shared || false)
  const [parentId, setParentId] = useState(project?.parent_id || '')
  const [description, setDescription] = useState(project?.description || '')
  const [dueDate, setDueDate] = useState(project?.due_date || '')
  const [saving, setSaving] = useState(false)
  const isArchived = !!project?.archived_at

  // One level only: eligible parents are root projects other than this one, and
  // a project that already has children cannot be moved under another.
  const hasChildren = isEdit && state.projects.some(p => p.parent_id === project.id)
  const parentOptions = state.projects.filter(p =>
    p.id !== 'inbox' && !p.parent_id && (!isEdit || p.id !== project.id))

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(), color, icon, shared, parent_id: parentId || null,
        description: description.trim(), due_date: dueDate || null,
      }
      if (isEdit) {
        const p = await api.updateProject(project.id, payload)
        dispatch({ type: 'UPDATE_PROJECT', payload: p })
        toast('Project updated')
      } else {
        const p = await api.createProject(payload)
        dispatch({ type: 'ADD_PROJECT', payload: p })
        toast('Project created')
      }
      onClose()
    } catch { toast(`Failed to ${isEdit ? 'update' : 'create'} project`) }
    setSaving(false)
  }

  const handleArchive = async () => {
    const next = !isArchived
    try {
      const p = await api.updateProject(project.id, { archived: next })
      dispatch({ type: 'UPDATE_PROJECT', payload: p })
      if (next && state.view === `project:${project.id}`) {
        dispatch({ type: 'SET_VIEW', payload: 'inbox' })
      }
      await loadAll()
      toast(next ? 'Project archived' : 'Project restored')
      onClose()
    } catch {
      toast(next ? 'Failed to archive project' : 'Failed to restore project')
    }
  }

  const handleDelete = () => {
    confirm('Delete this project? Its tasks move to Inbox and any subprojects move to the top level.', async () => {
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

  return createPortal(
    <>
      <div className="fixed inset-0 z-[110] bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-[111] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm bg-td-bg2 dark:bg-tn-bg2 rounded-2xl
            border border-td-border dark:border-tn-border shadow-e3 flex flex-col max-h-[88vh] overflow-hidden"
          style={{ animation: 'slideUp 0.18s ease-out' }}
        >
        <div className="flex items-center justify-between px-5 py-4 border-b border-td-border/50 dark:border-tn-border/50 shrink-0">
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
        <input
          autoFocus
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Project name"
          onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg placeholder-td-muted/50 dark:placeholder-tn-muted/50 text-sm rounded-lg px-3 py-2.5 outline-none mb-3 border border-td-border/50 dark:border-tn-border/50"
        />
        <div
          ref={iconGridRef}
          className="grid grid-cols-8 gap-1.5 mb-3 max-h-[132px] overflow-y-auto overscroll-contain rounded-lg border border-td-border/50 dark:border-tn-border/50 p-2"
        >
          {PROJECT_ICON_OPTIONS.map(({ name, Icon }) => (
            <button key={name} onClick={() => setIcon(name)}
              data-icon={name}
              title={name}
              aria-label={name}
              aria-pressed={icon === name}
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
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg placeholder-td-muted/50 dark:placeholder-tn-muted/50 text-sm rounded-lg px-3 py-2.5 outline-none mb-3 border border-td-border/50 dark:border-tn-border/50 resize-none"
        />
        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs text-td-muted dark:text-tn-muted shrink-0">Deadline</label>
          <input
            type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="flex-1 bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-sm rounded-lg px-3 py-2 outline-none border border-td-border/50 dark:border-tn-border/50"
          />
          {dueDate && (
            <button onClick={() => setDueDate('')}
              className="text-xs text-td-muted/60 dark:text-tn-muted/60 px-2 py-1 rounded-lg hover:text-td-red dark:hover:text-tn-red">
              Clear
            </button>
          )}
        </div>
        {!hasChildren && parentOptions.length > 0 && (
          <select
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            className="w-full bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg text-sm rounded-lg px-3 py-2.5 outline-none mb-4 border border-td-border/50 dark:border-tn-border/50"
          >
            <option value="">No parent (top level)</option>
            {parentOptions.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {hasChildren && (
          <p className="text-[11px] text-td-muted/60 dark:text-tn-muted/60 mb-4 px-1">
            This project has subprojects, so it can&apos;t be nested under another.
          </p>
        )}
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
        {isEdit && project.id !== 'inbox' && (
          <button onClick={handleArchive}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm mb-3 transition-colors border bg-td-surface dark:bg-tn-surface border-td-border/50 dark:border-tn-border/50 text-td-muted dark:text-tn-muted hover:text-td-fg dark:hover:text-tn-fg">
            {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            <span className="flex-1 text-left font-medium">
              {isArchived ? 'Restore project' : 'Archive project'}
            </span>
          </button>
        )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-td-border/50 dark:border-tn-border/50 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-td-muted dark:text-tn-muted text-sm bg-td-surface dark:bg-tn-surface">Cancel</button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-td-blue dark:bg-tn-blue disabled:opacity-40">
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>

    <style>{`
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
    `}</style>
  </>,
  document.body
  )
}

function ProjectRow({
  project: p, depth, count, hasChildren, expanded, onToggleExpand, active, isTouch,
  dragProjectId, dropTargetId, setDragProjectId, setDropTargetId, onDropProject, onDropTask, onOpen, onEdit,
}) {
  return (
    <div
      draggable={!isTouch}
      onDragStart={!isTouch ? (e => { setDragProjectId(p.id); e.dataTransfer.effectAllowed = 'move' }) : undefined}
      onDragOver={!isTouch ? (e => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        // Two drag kinds land here. Project reorder tracks its source in React
        // state; task drags carry a payload type. getData() is unreadable during
        // dragover, so detection goes through types.
        const isTaskDrag = e.dataTransfer.types.includes(TASK_DRAG_TYPE)
        if (isTaskDrag || (dragProjectId && dragProjectId !== p.id)) setDropTargetId(p.id)
      }) : undefined}
      onDragLeave={!isTouch ? (() => { if (dropTargetId === p.id) setDropTargetId(null) }) : undefined}
      onDrop={!isTouch ? (e => {
        e.preventDefault()
        const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE)
        setDropTargetId(null)
        if (taskId) { onDropTask(p.id, taskId); return }
        onDropProject(p.id)
      }) : undefined}
      onDragEnd={!isTouch ? (() => { setDragProjectId(null); setDropTargetId(null) }) : undefined}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
      className={`group w-full flex items-center gap-2.5 pr-3 py-2.5 md:py-2 min-h-[44px] md:min-h-0 rounded-lg text-sm transition-colors cursor-pointer
        ${dragProjectId === p.id ? 'opacity-40' : ''}
        ${dropTargetId === p.id ? 'ring-1 ring-td-blue/60 dark:ring-tn-blue/60' : ''}
        ${active
          ? 'bg-td-surface dark:bg-tn-surface text-td-fg dark:text-tn-fg font-semibold'
          : 'text-td-muted dark:text-tn-nav font-medium hover:text-td-fg dark:hover:text-tn-fg hover:bg-td-surface/50 dark:hover:bg-tn-surface/50'}`}
      style={{ paddingLeft: depth === 0 ? '0.75rem' : '2rem' }}
    >
      {hasChildren ? (
        <button
          onClick={e => { e.stopPropagation(); onToggleExpand() }}
          className="shrink-0 -ml-1 flex items-center justify-center w-4 h-4 rounded text-td-muted/50 dark:text-tn-muted/50 hover:text-td-fg dark:hover:text-tn-fg"
          title={expanded ? 'Collapse subprojects' : 'Expand subprojects'}
          aria-expanded={expanded}
        >
          <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      ) : depth === 0 ? (
        <span className="shrink-0 -ml-1 w-4 h-4" aria-hidden="true" />
      ) : (
        <span className="shrink-0 -ml-1 w-4 h-4 flex items-center justify-center" aria-hidden="true">
          <span className="w-px h-3.5 rounded-full bg-td-border dark:bg-tn-border" />
        </span>
      )}
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
        onClick={e => { e.stopPropagation(); onEdit() }}
        className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded
          text-td-muted/50 dark:text-tn-muted/50 hover:text-td-fg dark:hover:text-tn-fg
          hover:bg-td-surface dark:hover:bg-tn-surface transition-all"
        title="Edit project"
      >
        <Settings size={12} />
      </button>
    </div>
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
  const [archivedOpen, setArchivedOpen] = useState(false)
  const archivedProjects = state.projects.filter(p => p.archived_at)
  const [collapsedProjects, setCollapsedProjects] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('td-collapsed-projects') || '[]')) }
    catch { return new Set() }
  })

  const toggleProjectCollapse = (id) => setCollapsedProjects(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    localStorage.setItem('td-collapsed-projects', JSON.stringify([...next]))
    return next
  })

  const handleProjectDrop = async (targetId) => {
    const sourceId = dragProjectId
    setDragProjectId(null)
    setDropTargetId(null)
    if (!sourceId || sourceId === targetId) return
    // Phase 1: reorder only, and only within a sibling group. Cross-group drops
    // (reparenting via drag) are a separate follow-up.
    const all = state.projects.filter(p => p.id !== 'inbox')
    const source = all.find(p => p.id === sourceId)
    const target = all.find(p => p.id === targetId)
    if (!source || !target) return
    if ((source.parent_id || null) !== (target.parent_id || null)) return
    const list = all.filter(p => (p.parent_id || null) === (source.parent_id || null))
    const fromIdx = list.findIndex(p => p.id === sourceId)
    const toIdx = list.findIndex(p => p.id === targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const reordered = [...list]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const withPositions = reordered.map((p, i) => ({ ...p, position: i + 1 }))
    const movedById = new Map(withPositions.map(p => [p.id, p]))
    const inbox = state.projects.find(p => p.id === 'inbox')
    // Splice the reordered sibling group back into the full list in place.
    let cursor = 0
    const merged = all.map(p => (movedById.has(p.id) ? withPositions[cursor++] : p))
    dispatch({ type: 'SET_PROJECTS', payload: inbox ? [inbox, ...merged] : merged })
    try {
      await api.reorderProjects(reordered.map(p => p.id))
    } catch {
      toast('Failed to reorder projects')
    }
  }

  const handleTaskDrop = async (projectId, taskId) => {
    const task = state.tasks.find(t => t.id === taskId)
    if (!task || task.project_id === projectId) return
    const previousProjectId = task.project_id
    const target = state.projects.find(p => p.id === projectId)
    try {
      const updated = await api.updateTask(taskId, { project_id: projectId })
      dispatch({ type: 'UPDATE_TASK', payload: updated })
      toast(`Moved to ${target?.name || 'project'}`, {
        label: 'Undo',
        onAction: async () => {
          try {
            const reverted = await api.updateTask(taskId, { project_id: previousProjectId })
            dispatch({ type: 'UPDATE_TASK', payload: reverted })
          } catch {
            toast('Could not undo move')
          }
        },
      })
    } catch {
      toast('Could not move task')
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
  const isTouch = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches,
    []
  )
  const toggle = () => dispatch({ type: 'TOGGLE_SIDEBAR_COLLAPSED' })

  // Roots first, each with its children. A project whose parent isn't visible to
  // this user (shared-project edge case) is rendered as a root so it never vanishes.
  const projectTree = useMemo(() => {
    const list = state.projects.filter(p => p.id !== 'inbox' && !p.archived_at)
    const ids = new Set(list.map(p => p.id))
    const roots = list.filter(p => !p.parent_id || !ids.has(p.parent_id))
    return roots.map(p => ({ ...p, children: list.filter(c => c.parent_id === p.id) }))
  }, [state.projects])

  // Open-task counts, rolled up from children into their parent.
  const projectCounts = useMemo(() => {
    const direct = {}
    for (const t of state.tasks) {
      if (t.status === 'done' || !t.project_id) continue
      direct[t.project_id] = (direct[t.project_id] || 0) + 1
    }
    const rolled = { ...direct }
    for (const p of state.projects) {
      if (p.parent_id) rolled[p.parent_id] = (rolled[p.parent_id] || 0) + (direct[p.id] || 0)
    }
    return rolled
  }, [state.tasks, state.projects])

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
          ${collapsed ? 'w-[56px]' : 'w-[85vw] max-w-[330px] md:w-64'}
          ${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>

      {/* Header */}
      <div className={`flex items-center py-4 ${collapsed ? 'justify-center px-0' : 'justify-between px-4'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-td-fg dark:text-tn-fg font-bold text-base tracking-tight">Doit</span>
          </div>
        )}
        {collapsed && <Logo size={32} />}
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
        <SearchNavItem collapsed={collapsed} />
        <NavItem icon={Inbox}       label="Inbox"     viewKey="inbox"    badge={inboxCount} collapsed={collapsed} />
        <NavItem icon={Sun}         label="Today"     viewKey="today"    badge={todayCount} collapsed={collapsed} />
        <NavItem icon={CalendarClock} label="Upcoming" viewKey="upcoming" collapsed={collapsed} />
        <NavItem icon={Layers}      label="All"       viewKey="all"      collapsed={collapsed} />
        <NavItem icon={CalendarDays} label="Calendar" viewKey="calendar" collapsed={collapsed} />
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

        {collapsed
          ? state.projects.filter(p => p.id !== 'inbox' && !p.archived_at).map(p => {
              const count = projectCounts[p.id] || 0
              const active = state.view === `project:${p.id}`
              return (
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
              )
            })
          : projectTree.flatMap(root => {
              const isCollapsedRoot = collapsedProjects.has(root.id)
              const rows = [
                <ProjectRow
                  key={root.id}
                  project={root}
                  depth={0}
                  count={projectCounts[root.id] || 0}
                  hasChildren={root.children.length > 0}
                  expanded={!isCollapsedRoot}
                  onToggleExpand={() => toggleProjectCollapse(root.id)}
                  active={state.view === `project:${root.id}`}
                  isTouch={isTouch}
                  dragProjectId={dragProjectId}
                  dropTargetId={dropTargetId}
                  setDragProjectId={setDragProjectId}
                  setDropTargetId={setDropTargetId}
                  onDropProject={handleProjectDrop}
                  onDropTask={handleTaskDrop}
                  onOpen={() => dispatch({ type: 'SET_VIEW', payload: `project:${root.id}` })}
                  onEdit={() => setEditingProject(root)}
                />,
              ]
              if (!isCollapsedRoot) {
                for (const child of root.children) {
                  rows.push(
                    <ProjectRow
                      key={child.id}
                      project={child}
                      depth={1}
                      count={projectCounts[child.id] || 0}
                      hasChildren={false}
                      expanded={false}
                      onToggleExpand={null}
                      active={state.view === `project:${child.id}`}
                      isTouch={isTouch}
                      dragProjectId={dragProjectId}
                      dropTargetId={dropTargetId}
                      setDragProjectId={setDragProjectId}
                      setDropTargetId={setDropTargetId}
                      onDropProject={handleProjectDrop}
                      onDropTask={handleTaskDrop}
                      onOpen={() => dispatch({ type: 'SET_VIEW', payload: `project:${child.id}` })}
                      onEdit={() => setEditingProject(child)}
                    />
                  )
                }
              }
              return rows
            })}

        {!collapsed && archivedProjects.length > 0 && (
          <div className="mt-2 px-2">
            <button
              onClick={() => setArchivedOpen(o => !o)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium
                text-td-muted/60 dark:text-tn-muted/60 hover:text-td-fg dark:hover:text-tn-fg
                hover:bg-td-surface/70 dark:hover:bg-tn-surface/70 transition-colors"
            >
              <ChevronRight size={12} className={`transition-transform ${archivedOpen ? 'rotate-90' : ''}`} />
              <Archive size={12} />
              <span className="flex-1 text-left">Archived</span>
              <span className="tabular-nums">{archivedProjects.length}</span>
            </button>
            {archivedOpen && archivedProjects.map(p => (
              <button
                key={p.id}
                onClick={() => setEditingProject(p)}
                className="w-full flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-lg text-xs
                  text-td-muted/60 dark:text-tn-muted/60 hover:text-td-fg dark:hover:text-tn-fg
                  hover:bg-td-surface/70 dark:hover:bg-tn-surface/70 transition-colors"
              >
                <ProjectIcon icon={p.icon} size={12} />
                <span className="flex-1 text-left truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
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

