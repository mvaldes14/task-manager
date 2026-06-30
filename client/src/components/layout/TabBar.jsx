import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { isToday, isOverdue } from '../../utils'
import { Inbox, Sun, CalendarDays, Layers, Menu } from 'lucide-react'

const TABS = [
  { key: 'inbox',    icon: Inbox,        label: 'Inbox' },
  { key: 'today',    icon: Sun,          label: 'Today' },
  { key: 'calendar', icon: CalendarDays, label: 'Calendar' },
  { key: 'all',      icon: Layers,       label: 'All'   },
  { key: 'browse',   icon: Menu,         label: 'Browse' },
]

export function TabBar() {
  const { state, dispatch } = useApp()

  const todayCount = useMemo(() =>
    state.tasks.filter(t => isToday(t) && t.status !== 'done').length, [state.tasks])
  const inboxCount = useMemo(() =>
    state.tasks.filter(t => t.project_id === 'inbox' && t.status !== 'done').length, [state.tasks])

  const badges = { inbox: inboxCount, today: todayCount }

  const handleTab = (key) => {
    if (key === 'browse') {
      dispatch({ type: 'SET_SIDEBAR', payload: !state.sidebarOpen })
    } else if (key === 'calendar') {
      const now = new Date()
      dispatch({ type: 'SET_CAL', payload: { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() } })
      dispatch({ type: 'SET_CAL_VIEW', payload: 'day' })
      dispatch({ type: 'SET_VIEW', payload: 'calendar' })
    } else {
      dispatch({ type: 'SET_VIEW', payload: key })
    }
  }

  const isActive = (key) => {
    if (key === 'browse') return state.sidebarOpen
    return state.view === key
  }

  if (state.fabOpen) return null

  return (
    <nav
      className="md:hidden fixed left-1/2 -translate-x-1/2 z-[95]
        inline-flex items-center gap-1 p-1.5
        rounded-full
        bg-td-surface/95 dark:bg-tn-surface/95 backdrop-blur-md
        border border-td-border dark:border-tn-border
        shadow-e2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      {TABS.map(({ key, icon: Icon, label }) => {
        const active = isActive(key)
        const badge = badges[key]
        return (
          <button
            key={key}
            onClick={() => handleTab(key)}
            aria-label={label}
            className={`relative flex items-center justify-center
              min-w-[44px] min-h-[44px] rounded-full
              transition-all duration-fast ease-spring
              motion-safe:active:scale-[0.88]
              ${active
                ? 'bg-td-blue/15 dark:bg-tn-blue/15 text-td-blue dark:text-tn-blue'
                : 'text-td-muted/60 dark:text-tn-nav hover:bg-td-border/30 dark:hover:bg-tn-border/30 hover:text-td-muted dark:hover:text-tn-fg'}`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            {badge > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[14px] h-3.5 rounded-full bg-td-red dark:bg-tn-red
                text-[8px] font-bold text-white flex items-center justify-center px-0.5">
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
