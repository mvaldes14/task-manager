import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initOtel } from './otel.js'
import App from './App.jsx'

// Apply saved theme before render to avoid flash
const theme = localStorage.getItem('td-theme') || 'dark'
document.documentElement.classList.toggle('dark', theme === 'dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Init OTel after render — fetches endpoint from /api/settings at runtime
initOtel()
