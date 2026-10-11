import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)

// Development stays uncached. Only the production build installs offline files.
if (!window.lauDesktop && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      if (registration.active) window.dispatchEvent(new Event('lau-offline-ready'))
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'activated') window.dispatchEvent(new Event('lau-offline-ready'))
        })
      })
    }).catch(error => console.warn('Offline setup could not finish. Reopen online to try again.', error))
  }, { once: true })
}
