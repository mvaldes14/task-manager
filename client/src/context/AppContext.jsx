import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import { isOverdue, isToday } from '../utils'

const AppContext = createContext(null)

const initialState = {
  // Data
  tasks: [],
  projects: [],
  currentUser: null,  // {id, username, display_name, is_admin, has_avatar}
  users: [],          // [{id, username, display_name, is_admin, has_avatar}]
  // Navigation
  view: localStorage.getItem('td-view') || 'inbox',  // inbox | today | overdue | all | calendar | dashboard | project:<id>
  viewMode: 'list',         // list | board | calendar
  // Detail panel
  selectedTaskId: null,
  // UI
  sidebarOpen: false,
  sidebarCollapsed: localStorage.getItem('td-sidebar-collapsed') === 'true',
  showShortcuts: false,
  searchOpen: false,
  fabOpen: false,
  fabTargetStatus: 'todo',
  toast: null,
  confirm: null,            // { message, onOk }
  // Calendar
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  // Settings
  theme: localStorage.getItem('td-theme') || 'dark',
  obsidianVault: '',
  obsidianInbox: '',
  otelEndpoint: '',
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TASKS':        return { ...state, tasks: action.payload }
    case 'SET_PROJECTS':     return { ...state, projects: action.payload }
    case 'SET_CURRENT_USER': return { ...state, currentUser: action.payload }
    case 'SET_USERS':        return { ...state, users: action.payload }
    case 'ADD_TASK':        return { ...state, tasks: [action.payload, ...state.tasks] }
    case 'UPDATE_TASK':     return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t) }
    case 'DELETE_TASK':     return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload), selectedTaskId: state.selectedTaskId === action.payload ? null : state.selectedTaskId }
    case 'ADD_PROJECT':     return { ...state, projects: [...state.projects, action.payload] }
    case 'UPDATE_PROJECT':  return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) }
    case 'DELETE_PROJECT':  return { ...state, projects: state.projects.filter(p => p.id !== action.payload) }
    case 'SET_VIEW': {
      localStorage.setItem('td-view', action.payload)
      return { ...state, view: action.payload, sidebarOpen: false, selectedTaskId: null }
    }
    case 'SET_VIEW_MODE':   return { ...state, viewMode: action.payload }
    case 'SELECT_TASK':     return { ...state, selectedTaskId: action.payload }
    case 'SET_SIDEBAR':     return { ...state, sidebarOpen: action.payload }
    case 'TOGGLE_SHORTCUTS': return { ...state, showShortcuts: !state.showShortcuts }
    case 'TOGGLE_SEARCH': return { ...state, searchOpen: !state.searchOpen }
    case 'SET_SEARCH_OPEN': return { ...state, searchOpen: action.payload }
    case 'TOGGLE_SIDEBAR_COLLAPSED': {
      const next = !state.sidebarCollapsed
      localStorage.setItem('td-sidebar-collapsed', String(next))
      return { ...state, sidebarCollapsed: next }
    }
    case 'SET_FAB':         return { ...state, fabOpen: action.payload.open, fabTargetStatus: action.payload.status || state.fabTargetStatus }
    case 'SET_TOAST':       return { ...state, toast: action.payload }
    case 'SET_CONFIRM':     return { ...state, confirm: action.payload }
    case 'SET_THEME':       return { ...state, theme: action.payload }
    case 'SET_CAL':         return { ...state, calYear: action.payload.year, calMonth: action.payload.month }
    case 'SET_SETTINGS':    return { ...state, obsidianVault: action.payload.obsidian_vault || '', obsidianInbox: action.payload.obsidian_inbox || '', gcalEnabled: action.payload.gcal_enabled || false, otelEndpoint: action.payload.otel_frontend_endpoint || '' }
    default:                return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const toastTimer = useRef(null)

  // PWA app icon badge — overdue + today incomplete
  useEffect(() => {
    const count = state.tasks
      .filter(t => isOverdue(t) || isToday(t))
      .filter(t => t.status !== 'done').length

    // Request notification permission if needed — required to show badges on macOS
    if ('setAppBadge' in navigator && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    if ('setAppBadge' in navigator) {
      if (count > 0) navigator.setAppBadge(count).catch(() => {})
      else navigator.clearAppBadge().catch(() => {})
    }
  }, [state.tasks])

  const toast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    dispatch({ type: 'SET_TOAST', payload: msg })
    toastTimer.current = setTimeout(() => {
      dispatch({ type: 'SET_TOAST', payload: null })
      toastTimer.current = null
    }, 3000)
  }, [])

  const confirm = useCallback((message, onOk) => {
    dispatch({ type: 'SET_CONFIRM', payload: { message, onOk } })
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch, toast, confirm }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
