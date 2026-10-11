export const STORAGE_KEY = 'lau-dashboard-v2'
export const LEGACY_KEY = 'lau-tasks-v1'
export const STATUSES = ['todo', 'doing', 'done']
export const DEFAULT_SETTINGS = {
  theme: 'light', accent: '#4277d8', sound: false, encouragement: true, focusMinutes: 25, breakMinutes: 5,
  messages: ['Nice one, love!', 'One step closer. Proud of you!', 'Small wins count too.'],
}
export const DEFAULT_CATEGORIES = [
  { id: 'personal', name: 'Personal', emoji: '🌱' },
  { id: 'work', name: 'Work', emoji: '💼' },
  { id: 'life', name: 'Little things', emoji: '☀️' },
]
export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const dateKey = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && todayKey(new Date(`${value}T12:00:00`)) === value
const timestamp = value => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const text = (value, limit) => typeof value === 'string' && value.length <= limit
export function emptyData() {
  return { version: 2, tasks: [], categories: structuredClone(DEFAULT_CATEGORIES), settings: structuredClone(DEFAULT_SETTINGS), sessions: [], timer: null }
}
export function normalizeLegacy(tasks) {
  if (!Array.isArray(tasks)) throw new Error('Saved tasks must be a list.')
  const ids = new Set()
  return tasks.map(task => {
    if (!isObject(task) || !text(task.id, 100) || !task.id || ids.has(task.id) || !text(task.title, 300) || !task.title.trim() || typeof task.completed !== 'boolean') throw new Error('The older task list contains invalid tasks.')
    ids.add(task.id)
    return { id: task.id, title: task.title, status: task.completed ? 'done' : 'todo', completed: task.completed,
      completedAt: null, createdAt: null, dueDate: '', priority: 'normal', category: '', notes: '', plannedDate: '', subtasks: [] }
  })
}
export function validateData(value) {
  if (!isObject(value) || value.version !== 2 || !Array.isArray(value.tasks) || !Array.isArray(value.categories) || !Array.isArray(value.sessions) || !isObject(value.settings)) throw new Error('Choose a valid Lau dashboard backup (version 2).')
  if (value.tasks.length > 10000 || value.categories.length > 100 || value.sessions.length > 50000) throw new Error('This backup is too large.')
  const categoryIds = new Set()
  const categories = value.categories.map(category => {
    if (!isObject(category) || !text(category.id, 100) || !category.id || categoryIds.has(category.id) || !text(category.name, 40) || !category.name.trim() || !text(category.emoji, 16) || !category.emoji.trim()) throw new Error('A category is invalid.')
    categoryIds.add(category.id)
    return { id: category.id, name: category.name, emoji: category.emoji }
  })
  const ids = new Set()
  const tasks = value.tasks.map(task => {
    if (!isObject(task) || !text(task.id, 100) || !task.id || ids.has(task.id) || !text(task.title, 300) || !task.title.trim() || !STATUSES.includes(task.status) || typeof task.completed !== 'boolean' || task.completed !== (task.status === 'done') || !['low', 'normal', 'high'].includes(task.priority) || !text(task.notes, 5000) || typeof task.category !== 'string' || (task.category && !categoryIds.has(task.category)) || (task.dueDate !== '' && !dateKey(task.dueDate)) || (task.plannedDate !== '' && !dateKey(task.plannedDate)) || (task.completedAt !== null && !timestamp(task.completedAt)) || (task.createdAt !== null && !timestamp(task.createdAt)) || !Array.isArray(task.subtasks) || task.subtasks.length > 100) throw new Error('A task is invalid. No data was replaced.')
    ids.add(task.id)
    const subIds = new Set()
    const subtasks = task.subtasks.map(sub => {
      if (!isObject(sub) || !text(sub.id, 100) || !sub.id || subIds.has(sub.id) || !text(sub.title, 300) || !sub.title.trim() || typeof sub.completed !== 'boolean') throw new Error('A subtask is invalid.')
      subIds.add(sub.id)
      return { id: sub.id, title: sub.title, completed: sub.completed }
    })
    return { id: task.id, title: task.title.trim(), status: task.status, completed: task.completed, completedAt: task.completed ? task.completedAt : null,
      createdAt: task.createdAt, dueDate: task.dueDate, priority: task.priority, category: task.category, notes: task.notes, plannedDate: task.plannedDate, subtasks }
  })
  const settings = value.settings
  if (settings.theme !== undefined && !['light', 'dark'].includes(settings.theme)) throw new Error('Backup theme is invalid.')
  if (!/^#[0-9a-f]{6}$/i.test(settings.accent) || typeof settings.sound !== 'boolean' || typeof settings.encouragement !== 'boolean' || !Number.isInteger(settings.focusMinutes) || settings.focusMinutes < 1 || settings.focusMinutes > 180 || !Number.isInteger(settings.breakMinutes) || settings.breakMinutes < 1 || settings.breakMinutes > 60 || !Array.isArray(settings.messages) || settings.messages.length > 30 || settings.messages.some(message => !text(message, 200) || !message.trim())) throw new Error('Backup settings are invalid.')
  const sessionIds = new Set()
  const sessions = value.sessions.map(session => {
    if (!isObject(session) || !text(session.id, 100) || !session.id || sessionIds.has(session.id) || !timestamp(session.completedAt) || !text(session.taskId, 100) || !text(session.taskTitle, 300) || !Number.isInteger(session.minutes) || session.minutes < 1 || session.minutes > 180) throw new Error('A focus session is invalid.')
    sessionIds.add(session.id)
    return { id: session.id, taskId: session.taskId, taskTitle: session.taskTitle, completedAt: session.completedAt, minutes: session.minutes }
  })
  let timer = null
  if (value.timer != null) {
    const t = value.timer
    if (!isObject(t) || !text(t.id, 100) || !t.id || !['focus', 'break'].includes(t.mode) || !['running', 'paused', 'idle'].includes(t.state) || !text(t.taskId, 100) || !text(t.taskTitle, 300) || !Number.isInteger(t.duration) || t.duration < 60 || t.duration > 10800 || !Number.isFinite(t.remaining) || t.remaining < 0 || t.remaining > t.duration || (t.state === 'running' && (!Number.isFinite(t.endsAt) || t.endsAt <= 0))) throw new Error('The saved timer is invalid.')
    timer = { id: t.id, taskId: t.taskId, taskTitle: t.taskTitle, mode: t.mode, state: t.state, duration: t.duration, remaining: t.remaining, endsAt: t.state === 'running' ? t.endsAt : null }
  }
  return { version: 2, tasks, categories, settings: { ...DEFAULT_SETTINGS, ...settings }, sessions, timer }
}
export function loadData(storage) {
  try {
    const current = storage.getItem(STORAGE_KEY)
    if (current !== null) return { data: validateData(JSON.parse(current)), error: null }
    const legacy = storage.getItem(LEGACY_KEY)
    const data = emptyData()
    if (legacy !== null) data.tasks = normalizeLegacy(JSON.parse(legacy))
    return { data, error: null }
  } catch (error) {
    return { data: emptyData(), error: `Saved data could not be read: ${error.message} The original storage is untouched. Export it in Settings before replacing it.` }
  }
}
export function changeStatus(task, status, now = new Date().toISOString()) {
  return { ...task, status, completed: status === 'done', completedAt: status === 'done' ? (task.completed ? task.completedAt : now) : null }
}
export function moveTask(tasks, id, status, beforeId = null, now) {
  const moving = tasks.find(task => task.id === id)
  if (!moving || id === beforeId) return tasks
  const rest = tasks.filter(task => task.id !== id)
  let index = beforeId ? rest.findIndex(task => task.id === beforeId) : -1
  if (index < 0) index = rest.length
  rest.splice(index, 0, changeStatus(moving, status, now))
  return rest
}
export function remainingSeconds(timer, now = Date.now()) {
  if (!timer) return 0
  return timer.state === 'running' ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : timer.remaining
}
export function finishTimer(data, now = Date.now()) {
  const timer = data.timer
  if (!timer || timer.state !== 'running' || remainingSeconds(timer, now) > 0) return data
  const sessions = timer.mode === 'focus' && !data.sessions.some(session => session.id === timer.id)
    ? [...data.sessions, { id: timer.id, taskId: timer.taskId, taskTitle: timer.taskTitle, minutes: timer.duration / 60, completedAt: new Date(timer.endsAt).toISOString() }] : data.sessions
  const mode = timer.mode === 'focus' ? 'break' : 'focus'
  const duration = (mode === 'focus' ? data.settings.focusMinutes : data.settings.breakMinutes) * 60
  return { ...data, sessions, timer: { id: crypto.randomUUID(), taskId: timer.taskId, taskTitle: timer.taskTitle, mode, state: 'idle', duration, remaining: duration, endsAt: null } }
}
export function isToday(timestampValue, date = new Date()) {
  return timestampValue && todayKey(new Date(timestampValue)) === todayKey(date)
}
export function weekStart(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (start.getDay() + 6) % 7)
  return start.getTime()
}
