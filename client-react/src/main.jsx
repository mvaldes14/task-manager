import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply saved theme before render to avoid flash
const theme = localStorage.getItem('td-theme') || 'dark'
document.documentElement.classList.toggle('light', theme === 'light')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
