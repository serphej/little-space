import { useEffect, useState } from 'react'
import { emptyData, loadData, STORAGE_KEY } from './data'

export function useDashboard() {
  const [loaded] = useState(() => { try { return loadData(localStorage) } catch { return { data: emptyData(), error: 'This browser is blocking local storage. Your tasks can be used in this tab; export a backup before closing.' } } })
  const [data, setData] = useState(loaded.data)
  const [recovery, setRecovery] = useState(loaded.error)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    if (recovery) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        setSaveError('')
      } catch {
        setSaveError('Saving is unavailable or storage is full. Export a backup before closing this tab.')
      }
    })
    return () => { cancelled = true }
  }, [data, recovery])
  return { data, setData, recovery, setRecovery, saveError }
}

export function playCompletionSound(enabled) {
  if (!enabled) return
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    const context = new AudioContext()
    const gain = context.createGain()
    const oscillator = context.createOscillator()
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.frequency.setValueAtTime(660, context.currentTime)
    oscillator.frequency.setValueAtTime(880, context.currentTime + .09)
    gain.gain.setValueAtTime(.06, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .3)
    oscillator.start()
    oscillator.stop(context.currentTime + .3)
    oscillator.onended = () => { void context.close() }
    void context.resume()
  } catch { /* Sound is optional; tasks still work if audio is blocked. */ }
}
