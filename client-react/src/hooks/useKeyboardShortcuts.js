import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

export function useKeyboardShortcuts() {
  const { state, dispatch } = useApp()

  useEffect(() => {
    const handler = (e) => {
      // Never fire when typing in an input, textarea, or contenteditable
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
      // Never fire with modifier keys (cmd/ctrl shortcuts belong to the browser)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'i':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW', payload: 'inbox' })
          break
        case 'q':
          e.preventDefault()
          dispatch({ type: 'SET_FAB', payload: { open: true } })
          break
        case 'Escape':
          if (state.fabOpen) dispatch({ type: 'SET_FAB', payload: { open: false } })
          break
        case 's':
          e.preventDefault()
          dispatch({ type: 'TOGGLE_SIDEBAR_COLLAPSED' })
          break
        case 'l':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW_MODE', payload: 'list' })
          break
        case 'k':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW_MODE', payload: 'board' })
          break
        case 'c':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW', payload: 'calendar' })
          break
        case 'o':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW', payload: 'overdue' })
          break
        case 't':
          e.preventDefault()
          dispatch({ type: 'SET_VIEW', payload: 'today' })
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.fabOpen, dispatch])
}
