import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { useTasks } from './hooks/useTasks'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { Sidebar } from './components/layout/Sidebar'
import { TabBar } from './components/layout/TabBar'
import { MainContent } from './components/layout/MainContent'
import { TaskDetail } from './components/tasks/TaskDetail'
import { FAB } from './components/fab/FAB'
import { Toast, ConfirmSheet } from './components/shared/Overlays'
import { KeyboardShortcutsModal } from './components/shared/KeyboardShortcutsModal'
import { LoginScreen } from './components/LoginScreen'
import { api } from './api'

function AppShell() {
  const { state, dispatch } = useApp()
  const { loadAll, loadSettings } = useTasks()
  useKeyboardShortcuts()
  const [authed, setAuthed] = useState(null)

  useEffect(() => {
    api.getProjects()
      .then(data => {
        if (data !== null) { setAuthed(true); loadAll(); loadSettings() }
        else setAuthed(false)
      })
      .catch(() => setAuthed(false))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark')
  }, [state.theme])

  const closeSidebar = () => dispatch({ type: 'SET_SIDEBAR', payload: false })

  // Keyboard shortcuts — skip when typing in an input/textarea
  useEffect(() => {
    if (!authed) return
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
        // Only allow Escape to close modal even when focused
        if (e.key === 'Escape') dispatch({ type: 'SET_FAB', payload: { open: false } })
        return
      }
      switch (e.key) {
        case 'q': dispatch({ type: 'SET_FAB', payload: { open: true } });  break
        case 'Escape': dispatch({ type: 'SET_FAB', payload: { open: false } }); break
        case 's': dispatch({ type: 'TOGGLE_SIDEBAR_COLLAPSED' }); break
        case 'l': dispatch({ type: 'SET_VIEW_MODE', payload: 'list' }); break
        case 'k': dispatch({ type: 'SET_VIEW_MODE', payload: 'board' }); break
        case 'c': dispatch({ type: 'SET_VIEW', payload: 'calendar' }); break
        case 'o': dispatch({ type: 'SET_VIEW', payload: 'overdue' }); break
        case 't': dispatch({ type: 'SET_VIEW', payload: 'today' }); break
        default: break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [authed, dispatch])

  if (authed === null) return (
    <div className="min-h-screen bg-td-bg dark:bg-tn-bg flex items-center justify-center">
      <div className="text-td-muted dark:text-tn-muted text-sm animate-pulse">Loading…</div>
    </div>
  )

  if (!authed) return <LoginScreen onLogin={() => { setAuthed(true); loadAll(); loadSettings() }} />

  return (
    <div className="flex h-screen bg-td-bg dark:bg-tn-bg text-td-fg dark:text-tn-fg overflow-hidden font-sans">
      {state.sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={closeSidebar} />
      )}
      <Sidebar />
      <div className="flex flex-1 min-w-0 h-full">
        <MainContent />
        {state.selectedTaskId && <TaskDetail />}
      </div>
      <TabBar />
      <FAB />
      <Toast />
      <ConfirmSheet />
      {state.showShortcuts && (
        <KeyboardShortcutsModal onClose={() => dispatch({ type: 'TOGGLE_SHORTCUTS' })} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
