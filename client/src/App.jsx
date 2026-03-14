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
    api.getSettings()
      .then(data => {
        if (data?.authenticated) { setAuthed(true); loadAll() }
        else setAuthed(false)
      })
      .catch(() => setAuthed(false))
  }, [loadAll])

  useEffect(() => {
    const dark = state.theme === 'dark'
    document.documentElement.classList.toggle('dark', dark)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#1a1b26' : '#e1e2e7')
  }, [state.theme])

  const closeSidebar = () => dispatch({ type: 'SET_SIDEBAR', payload: false })

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
