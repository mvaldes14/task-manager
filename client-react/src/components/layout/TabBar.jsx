import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { isToday, isOverdue } from '../../utils'
import { Inbox, Sun, LayoutList, CalendarDays, Menu } from 'lucide-react'

const TABS = [
  { key: 'inbox',    icon: Inbox,        label: 'Inbox' },
  { key: 'today',    icon: Sun,          label: 'Today' },
  { key: 'all',      icon: LayoutList,   label: 'All'   },
  { key: 'calendar', icon: CalendarDays, label: 'Calendar' },
  { key: 'browse',   icon: Menu,         label: 'Browse' },
]

export function TabBar() {
  const { state, dispatch } = useApp()

  const todayCount = useMemo(() =>
    state.tasks.filter(t => isToday(t) && t.status !== 'done').length, [state.tasks])
  const inboxCount = useMemo(() =>
    state.tasks.filter(t => t.status !== 'done').length, [state.tasks])

  const badges = { inbox: inboxCount, today: todayCount }

  const handleTab = (key) => {
    if (key === 'browse') {
      dispatch({ type: 'SET_SIDEBAR', payload: true })
    } else {
      dispatch({ type: 'SET_VIEW', payload: key })
    }
  }

  const isActive = (key) => {
    if (key === 'browse') return state.sidebarOpen
    return state.view === key
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[95] bg-td-bg2/95 dark:bg-tn-bg2/95 backdrop-blur-md border-t border-td-border dark:border-tn-border flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', height: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
    >
      {TABS.map(({ key, icon: Icon, label }) => {
        const active = isActive(key)
        const badge = badges[key]
        return (
          <button
            key={key}
            onClick={() => handleTab(key)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative
              ${active ? 'text-td-blue dark:text-tn-blue' : 'text-td-muted/60 dark:text-tn-fg/50'}`}
          >
            <div className="relative">
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 rounded-full bg-td-red dark:bg-tn-red
                  text-[9px] font-bold text-white flex items-center justify-center px-0.5">
                  {badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
