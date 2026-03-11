import { createContext, useContext, useReducer, useCallback } from 'react'

const AppContext = createContext(null)

const initialState = {
  // Data
  tasks: [],
  projects: [],
  // Navigation
  view: 'inbox',            // inbox | today | overdue | all | calendar | project:<id>
  viewMode: 'list',         // list | board
  // Detail panel
  selectedTaskId: null,
  // UI
  sidebarOpen: false,
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
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TASKS':       return { ...state, tasks: action.payload }
    case 'SET_PROJECTS':    return { ...state, projects: action.payload }
    case 'ADD_TASK':        return { ...state, tasks: [action.payload, ...state.tasks] }
    case 'UPDATE_TASK':     return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t) }
    case 'DELETE_TASK':     return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload), selectedTaskId: state.selectedTaskId === action.payload ? null : state.selectedTaskId }
    case 'ADD_PROJECT':     return { ...state, projects: [...state.projects, action.payload] }
    case 'UPDATE_PROJECT':  return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) }
    case 'DELETE_PROJECT':  return { ...state, projects: state.projects.filter(p => p.id !== action.payload) }
    case 'SET_VIEW':        return { ...state, view: action.payload, sidebarOpen: false, selectedTaskId: null }
    case 'SET_VIEW_MODE':   return { ...state, viewMode: action.payload }
    case 'SELECT_TASK':     return { ...state, selectedTaskId: action.payload }
    case 'SET_SIDEBAR':     return { ...state, sidebarOpen: action.payload }
    case 'SET_FAB':         return { ...state, fabOpen: action.payload.open, fabTargetStatus: action.payload.status || state.fabTargetStatus }
    case 'SET_TOAST':       return { ...state, toast: action.payload }
    case 'SET_CONFIRM':     return { ...state, confirm: action.payload }
    case 'SET_THEME':       return { ...state, theme: action.payload }
    case 'SET_CAL':         return { ...state, calYear: action.payload.year, calMonth: action.payload.month }
    case 'SET_SETTINGS':    return { ...state, obsidianVault: action.payload.obsidian_vault || '', obsidianInbox: action.payload.obsidian_inbox || '' }
    default:                return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const toast = useCallback((msg) => {
    dispatch({ type: 'SET_TOAST', payload: msg })
    setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 3000)
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
