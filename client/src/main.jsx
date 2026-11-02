import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initOtel } from './otel.js'
import App from './App.jsx'
import { getStoredThemeMode, resolveThemeMode } from './theme.js'

// Apply saved or system theme before render to avoid flash.
const theme = resolveThemeMode(getStoredThemeMode())
document.documentElement.classList.toggle('dark', theme === 'dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Init OTel after render — fetches endpoint from /api/settings at runtime
initOtel()
