import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { envError } from './lib/env'

const root = createRoot(document.getElementById('root')!)

if (envError) {
  root.render(
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 480, margin: '64px auto' }}>
      <h1>HabitNest setup needed</h1>
      <p>{envError}</p>
    </div>,
  )
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
