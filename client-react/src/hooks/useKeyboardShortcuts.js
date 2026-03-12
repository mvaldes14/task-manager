import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

export function useKeyboardShortcuts() {
  const { state, dispatch } = useApp()

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case '?':
          e.preventDefault()
          dispatch({ type: 'TOGGLE_SHORTCUTS' })
          break
        case 'Escape':
          if (state.showShortcuts) dispatch({ type: 'TOGGLE_SHORTCUTS' })
          else if (state.fabOpen) dispatch({ type: 'SET_FAB', payload: { open: false } })
          break
        case 'q':
          e.preventDefault()
          dispatch({ type: 'SET_FAB', payload: { open: true } })
          break
        case 'i':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW', payload: 'inbox' })
          break
        case 't':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW', payload: 'today' })
          break
        case 'o':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW', payload: 'overdue' })
          break
        case 'c':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW', payload: 'calendar' })
          break
        case 'l':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW_MODE', payload: 'list' })
          break
        case 'k':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW_MODE', payload: 'board' })
          break
        case 's':
          e.preventDefault()
          if (window.innerWidth < 768) {
            dispatch({ type: 'SET_SIDEBAR', payload: !state.sidebarOpen })
          } else {
            dispatch({ type: 'TOGGLE_SIDEBAR_COLLAPSED' })
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.fabOpen, state.sidebarOpen, state.showShortcuts, dispatch])
}
