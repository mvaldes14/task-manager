import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

export function useShareIntake() {
  const { dispatch } = useApp()

  useEffect(() => {
    const url = new URL(window.location.href)

    if (url.pathname === '/share') {
      const title = url.searchParams.get('title') || ''
      const text = url.searchParams.get('text') || ''
      const sharedUrl = url.searchParams.get('url') || ''

      // Prefer text over title; append URL as !<url> so the NLP parser extracts it
      const base = text || title
      const draft = sharedUrl ? `${base} !${sharedUrl}`.trim() : base.trim()

      history.replaceState({}, '', '/')
      dispatch({ type: 'SET_FAB', payload: { open: true, draft: draft || undefined } })
    } else if (url.searchParams.get('action') === 'new-task') {
      history.replaceState({}, '', '/')
      dispatch({ type: 'SET_FAB', payload: { open: true } })
    } else if (url.searchParams.get('view') === 'today') {
      history.replaceState({}, '', '/')
      dispatch({ type: 'SET_VIEW', payload: 'today' })
    }
  }, [dispatch])
}
