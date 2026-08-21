import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ─── Register the Service Worker for PWA + offline support ───────────────
// Only register in production — dev mode uses Vite's HMR which conflicts
// with the SW's caching. The SW file is served from /public/sw.js and
// handles: app shell caching, API responses, image CDN, offline fallback.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Silent fail — SW is a progressive enhancement, not a requirement.
      console.warn('[SW] registration failed:', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
