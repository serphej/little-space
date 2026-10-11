import ReminderSettings from './ReminderSettings'
import { useEffect, useState } from 'react'
export default function DesktopSettings() {
  const [preferences, setPreferences] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const desktop = window.lauDesktop
    if (!desktop) return
    let active = true
    const unsubscribe = desktop.onPreferences(next => { if (active) setPreferences(next) })
    desktop.getPreferences().then(next => { if (active) setPreferences(next) }).catch(failure => { if (active) setError(failure.message) })
    return () => { active = false; unsubscribe() }
  }, [])
  if (!window.lauDesktop) return null
  async function update(key, value) {
    setBusy(true); setError('')
    try { setPreferences(await window.lauDesktop.setPreference(key, value)) }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <><section><h3>Mochi, your desktop dog</h3><p className="muted">Click Mochi to open tasks, drag to reposition, or right-click for his menu. He sleeps while you focus and gives a happy hop when you complete a task.</p>{preferences ? <>
    <label className="check-label"><input type="checkbox" checked={preferences.visible} disabled={busy} onChange={event => update('visible', event.target.checked)} />Show the dog</label>
    <label className="check-label"><input type="checkbox" checked={preferences.paused} disabled={busy} onChange={event => update('paused', event.target.checked)} />Pause automatic walking</label>
    <label>Dog size<select value={preferences.size} disabled={busy} onChange={event => update('size', Number(event.target.value))}><option value={72}>Small · 72 pixels wide</option><option value={96}>Medium · 96 pixels wide</option><option value={128}>Large · 128 pixels wide</option></select></label>
    <label className="check-label"><input type="checkbox" checked={preferences.launchAtLogin} disabled={busy || !preferences.startupAvailable} onChange={event => update('launchAtLogin', event.target.checked)} />Launch when Windows starts</label>
    {!preferences.startupAvailable && <p className="muted">Startup is opt-in and becomes available after installing the Windows app.</p>}
  </> : <p className="muted">Reading desktop preferences…</p>}{error && <p className="error-text" role="alert">{error}</p>}<p className="muted">Closing the dashboard leaves Mochi and the tray running. Use the dog or tray menu → Quit to exit fully. The tray can show him again if he’s hidden.</p><p className="muted">Desktop data is separate from browser/PWA data. Export JSON in the browser, then import it here to transfer your tasks. Installed updates keep your desktop data.</p></section><ReminderSettings /></>
}
