import { useEffect, useState } from 'react'
import { changeStatus, finishTimer, isToday, moveTask, remainingSeconds, STATUSES, todayKey } from './data'
import { playCompletionSound, useDashboard } from './hooks'
import FocusPanel from './components/FocusPanel'
import History from './components/History'
import Modal from './components/Modal'
import Settings from './components/Settings'
import TaskCard from './components/TaskCard'
import TaskEditor from './components/TaskEditor'
import { notifyDogOfCompletion } from './desktop'
import useDesktopReminders from './useDesktopReminders'
import './App.css'

const statusNames = { todo: 'To do', doing: 'Doing', done: 'Done' }
const iconPaths = {
  home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" /></>,
  history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" /><path d="M12 7v5l3 2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  shuffle: <><path d="M3 6h3c5 0 7 12 12 12h3M3 18h3c2 0 4-3 6-6s4-6 6-6h3" /><path d="m18 3 3 3-3 3m0 6 3 3-3 3" /></>,
  list: <><path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1" /></>,
  board: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="14" rx="1" /></>,
  heart: <path d="M12 21 3 12a5 5 0 0 1 9-6 5 5 0 0 1 9 6Z" />,
}
function Icon({ name }) { return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg> }

export default function App() {
  const { data, setData, recovery, setRecovery, saveError } = useDashboard()
  const [page, setPage] = useState('home')
  const [view, setView] = useState('list')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [editTask, setEditTask] = useState(null)
  const [toast, setToast] = useState(null)
  const [undo, setUndo] = useState(null)
  const [suggestedId, setSuggestedId] = useState(null)
  const [selectedTask, setSelectedTask] = useState(data.timer?.taskId || '')
  const [now, setNow] = useState(() => Date.now())
  const [installPrompt, setInstallPrompt] = useState(null)
  const [offlineReady, setOfflineReady] = useState(false)
  const [celebration, setCelebration] = useState(false)
  const today = todayKey(new Date(now))
  const planned = data.tasks.filter(task => task.plannedDate === today)
  const plannedDone = planned.filter(task => task.completed).length
  const percent = planned.length ? Math.round(plannedDone / planned.length * 100) : 0
  const activeTasks = data.tasks.filter(task => !task.completed)
  const completedToday = data.tasks.filter(task => task.completed && isToday(task.completedAt, new Date(now)))
  const sessionsToday = data.sessions.filter(session => isToday(session.completedAt, new Date(now)))

  useEffect(() => {
    const interval = setInterval(() => {
      const timestamp = Date.now()
      setNow(timestamp)
      if (data.timer?.state === 'running' && remainingSeconds(data.timer, timestamp) === 0) {
        setData(current => finishTimer(current, timestamp))
        setToast({ message: data.timer.mode === 'focus' ? 'A little focus, a little win. Your break is ready.' : 'Break finished. Ready when you are, Lau.' })
        playCompletionSound(data.settings.sound)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [data, setData])

  useEffect(() => {
    function shortcut(event) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target.closest('input, textarea, select, [contenteditable]') || modal) return
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); setEditTask(null); setModal('task') }
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [modal])

  useEffect(() => {
    function install(event) { event.preventDefault(); setInstallPrompt(event) }
    function installed() { setInstallPrompt(null); setToast({ message: 'Lau is installed. See you on the home screen.' }) }
    function ready() { setOfflineReady(true) }
    window.addEventListener('beforeinstallprompt', install)
    window.addEventListener('appinstalled', installed)
    window.addEventListener('lau-offline-ready', ready)
    if (!window.lauDesktop && import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.getRegistration().then(registration => { if (registration?.active) setOfflineReady(true) })
    return () => { window.removeEventListener('beforeinstallprompt', install); window.removeEventListener('appinstalled', installed); window.removeEventListener('lau-offline-ready', ready) }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    if (!celebration) return
    const timeout = setTimeout(() => setCelebration(false), 2200)
    return () => clearTimeout(timeout)
  }, [celebration])

  // Keep native controls and the browser toolbar in sync with the saved theme.
  useEffect(() => {
    const theme = data.settings.theme
    document.documentElement.dataset.theme = theme
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) themeMeta.content = theme === 'dark' ? '#141e30' : '#dcebf8'
  }, [data.settings.theme])
  useEffect(() => {
    if (!window.lauDesktop) return
    const running = data.timer?.mode === 'focus' && data.timer?.state === 'running'
    void window.lauDesktop.syncFocus({ running, endsAt: running ? data.timer.endsAt : null })
      .catch(error => console.warn('Desktop focus state unavailable:', error.message))
  }, [data.timer?.mode, data.timer?.state, data.timer?.endsAt])
  function feedback(task, status) {
    if (status !== 'done' || task.completed) return
    notifyDogOfCompletion()
    playCompletionSound(data.settings.sound)
    const count = completedToday.length + 1
    if ([5, 10, 20].includes(count) || (task.plannedDate === today && planned.length > 0 && plannedDone + 1 === planned.length)) {
      setCelebration(true)
      setToast({ message: task.plannedDate === today && plannedDone + 1 === planned.length ? 'Today’s plan is complete. Proud of you, Lau! ✨' : `${count} little wins today. Look at you go! ✨` })
    } else if (data.settings.encouragement && data.settings.messages.length && count % 2 === 1) {
      setToast({ message: data.settings.messages[(count - 1) % data.settings.messages.length] })
    }
  }
  function updateStatus(id, status) {
    const task = data.tasks.find(item => item.id === id)
    if (!task) return
    feedback(task, status)
    setData(current => ({ ...current, tasks: current.tasks.map(item => item.id === id ? changeStatus(item, status) : item) }))
  }
  useDesktopReminders(data, selectedTask, setSelectedTask, updateStatus)
  function saveTask(draft) {
    const original = data.tasks.find(task => task.id === draft.id)
    if (!original && data.tasks.length >= 10000) { setToast({ message: 'Your list is full. Export and archive some tasks before adding more.' }); return }
    const base = original || { id: crypto.randomUUID(), createdAt: new Date().toISOString(), completedAt: null, completed: false }
    const task = changeStatus({ ...base, ...draft, completed: base.completed, completedAt: base.completedAt }, draft.status)
    feedback(base, draft.status)
    setData(current => ({ ...current, tasks: original ? current.tasks.map(item => item.id === task.id ? task : item) : [...current.tasks, task] }))
    setModal(null)
  }
  function deleteTask(id) {
    const index = data.tasks.findIndex(task => task.id === id)
    if (index < 0) return
    setUndo({ task: data.tasks[index], index })
    setData(current => ({ ...current, tasks: current.tasks.filter(task => task.id !== id) }))
    setToast({ message: 'Task deleted. You can bring it back.', undo: true })
  }
  function undoDelete() {
    if (!undo) return
    setData(current => {
      if (current.tasks.some(task => task.id === undo.task.id)) return current
      const tasks = [...current.tasks]
      tasks.splice(Math.min(undo.index, tasks.length), 0, { ...undo.task, category: current.categories.some(category => category.id === undo.task.category) ? undo.task.category : '' })
      return { ...current, tasks }
    })
    setUndo(null); setToast({ message: 'Task restored.' })
  }
  function plan(id) { setData(current => ({ ...current, tasks: current.tasks.map(task => task.id === id ? { ...task, plannedDate: task.plannedDate === today ? '' : today } : task) })) }
  function subtask(id, subId) { setData(current => ({ ...current, tasks: current.tasks.map(task => task.id === id ? { ...task, subtasks: task.subtasks.map(sub => sub.id === subId ? { ...sub, completed: !sub.completed } : sub) } : task) })) }
  function drop(id, status, beforeId) {
    const task = data.tasks.find(item => item.id === id)
    if (!task || id === beforeId || !STATUSES.includes(status)) return
    feedback(task, status)
    setData(current => ({ ...current, tasks: moveTask(current.tasks, id, status, beforeId) }))
  }
  function move(id, direction) {
    setData(current => {
      const tasks = [...current.tasks]
      const index = tasks.findIndex(task => task.id === id)
      if (index < 0) return current
      let target = index + direction
      while (view === 'board' && target >= 0 && target < tasks.length && tasks[target].status !== tasks[index].status) target += direction
      if (target < 0 || target >= tasks.length) return current
      ;[tasks[index], tasks[target]] = [tasks[target], tasks[index]]
      return { ...current, tasks }
    })
  }
  function timerAction(action, mode) {
    const timestamp = Date.now()
    setNow(timestamp)
    setData(current => {
      const existing = current.timer
      if (action === 'pause' && existing?.state === 'running') return { ...current, timer: { ...existing, state: 'paused', remaining: remainingSeconds(existing, timestamp), endsAt: null } }
      if (action === 'start' && existing?.state === 'paused') return { ...current, timer: { ...existing, state: 'running', endsAt: timestamp + existing.remaining * 1000 } }
      const nextMode = action === 'mode' ? mode : existing?.mode || 'focus'
      const duration = (nextMode === 'focus' ? current.settings.focusMinutes : current.settings.breakMinutes) * 60
      const task = current.tasks.find(item => item.id === selectedTask && !item.completed)
      if (action === 'start' && nextMode === 'focus' && !task) return current
      const running = action === 'start'
      return { ...current, timer: { id: crypto.randomUUID(), mode: nextMode, duration, remaining: duration, taskId: task?.id || '', taskTitle: task?.title || '', state: running ? 'running' : 'idle', endsAt: running ? timestamp + duration * 1000 : null } }
    })
  }
  function focusTask(task) {
    if (data.timer && ['running', 'paused'].includes(data.timer.state) && data.timer.taskId !== task.id) {
      setToast({ message: 'Reset your current session before switching tasks. Your focus is worth keeping.' }); return
    }
    if (data.timer?.taskId === task.id && data.timer.state === 'running') { setModal(null); return }
    setSelectedTask(task.id)
    setData(current => {
      const existing = current.timer
      if (existing?.state === 'paused' && existing.taskId === task.id) return { ...current, timer: { ...existing, state: 'running', endsAt: Date.now() + existing.remaining * 1000 } }
      const duration = current.settings.focusMinutes * 60
      return { ...current, timer: { id: crypto.randomUUID(), taskId: task.id, taskTitle: task.title, mode: 'focus', state: 'running', duration, remaining: duration, endsAt: Date.now() + duration * 1000 } }
    })
    setModal(null); setPage('home'); setToast({ message: `A little focus on “${task.title}”. You’ve got this.` })
  }
  function pick() {
    const choices = activeTasks.filter(task => task.id !== suggestedId)
    const pool = choices.length ? choices : activeTasks
    setSuggestedId(pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null)
    setModal('pick')
  }
  function navigate(next) { setPage(next); setQuery(''); setCategoryFilter('all'); setPriorityFilter('all'); setStatusFilter('all') }
  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }
  const visible = data.tasks.filter(task => (page !== 'today' || task.plannedDate === today) && (categoryFilter === 'all' || task.category === categoryFilter) && (priorityFilter === 'all' || task.priority === priorityFilter) && (statusFilter === 'all' || (statusFilter === 'active' ? !task.completed : task.status === statusFilter)) && `${task.title} ${task.notes} ${task.subtasks.map(sub => sub.title).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const suggested = data.tasks.find(task => task.id === suggestedId && !task.completed)
  const taskProps = { categories: data.categories, onStatus: updateStatus, onEdit: task => { setEditTask(task); setModal('task') }, onDelete: deleteTask, onPlan: plan, onSubtask: subtask, onFocus: focusTask, onMove: move, onDropTask: drop }

  return <div className="desktop" data-theme={data.settings.theme} style={{ '--accent': data.settings.accent }}>
    <div className="desktop-top"><span>✦ A space for Lau</span><span>{new Date(now).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<span className="desktop-time">{new Date(now).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></span></div>
    <div className="dashboard-window" style={{ '--accent': data.settings.accent }}>
      <header className="window-bar"><a className="app-brand" href="#content"><span className="logo-mark"><Icon name="check" /></span>Lau’s little space</a><span className="window-caption">a little less rush, a little more you</span><button className="icon-button" title="Settings" aria-label="Open settings" onClick={() => setModal('settings')}><Icon name="settings" /></button><span className="profile-badge" title="Made for Lau">L</span></header>
      <div className="window-body"><aside className="sidebar"><div className="sidebar-label">YOUR SPACE</div><nav aria-label="Main navigation">{[['home', 'Home', 'home'], ['today', 'Today’s plan', 'sun'], ['history', 'Little wins', 'history']].map(([key, label, icon]) => <button className={page === key ? 'nav-active' : ''} key={key} onClick={() => navigate(key)} aria-current={page === key ? 'page' : undefined}><Icon name={icon} />{label}{key === 'today' && <span className="nav-count">{planned.length}</span>}</button>)}</nav><div className="sidebar-divider" /><div className="sidebar-label">CATEGORIES</div><nav aria-label="Categories">{data.categories.map(category => <button key={category.id} className={categoryFilter === category.id && page !== 'history' ? 'nav-active' : ''} onClick={() => { navigate('home'); setCategoryFilter(category.id) }}><span className="category-emoji">{category.emoji}</span><span className="category-nav-name">{category.name}</span><span className="nav-count">{data.tasks.filter(task => task.category === category.id && !task.completed).length}</span></button>)}<button className="muted" onClick={() => setModal('settings')}><Icon name="plus" />Edit categories</button></nav><div className="sidebar-bottom"><div className="love-note"><Icon name="heart" /><p>You don’t have to do<br />it all at once, love.</p><span>— Rej</span></div><button onClick={() => setModal('settings')}><Icon name="settings" />Settings</button><button onClick={() => setModal('help')}><span className="help-icon">?</span>Little shortcuts</button></div></aside>
      <main id="content" className="content"><div className="breadcrumbs">⌂ <span>/</span> {page === 'home' ? 'Home' : page === 'today' ? 'Today’s plan' : 'Little wins'}<span className="save-status">{saveError || recovery ? '⚠ Saving needs attention' : '✓ Saved locally'}</span></div>
        {(saveError || recovery) && <div className="storage-warning" role="alert">{saveError || recovery}<button onClick={() => setModal('settings')}>Open backup settings</button></div>}
        <section className="greeting"><div><p className="eyebrow">A SOFTER KIND OF PRODUCTIVE</p><h1>{page === 'history' ? 'Look how far you’ve come.' : page === 'today' ? 'Just enough for today.' : 'Welcome home, Lau.'}<span>✦</span></h1><p>A little focus. A few small wins. Plenty of room to breathe.</p></div><button className="recap-button" onClick={() => setModal('recap')}><Icon name="sun" />Done for today</button></section>
        {page === 'history' ? <History data={data} now={now} onReopen={id => updateStatus(id, 'todo')} /> : <>
        <div className="overview-grid"><section className="glass-card daily-panel"><div className="card-heading"><h2>Today, at your pace</h2><Icon name="sun" /></div><div className="daily-content"><div className="progress-ring" role="progressbar" aria-label="Today’s planned tasks completed" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><svg viewBox="0 0 100 100" aria-hidden="true"><circle className="ring-track" cx="50" cy="50" r="40" /><circle className="ring-fill" cx="50" cy="50" r="40" strokeDasharray={`${percent * 2.51327} 251.327`} /></svg><strong>{percent}<small>%</small></strong></div><div><h3>{planned.length ? `${plannedDone} of ${planned.length} little steps` : 'A fresh page for today'}</h3><p>{planned.length ? percent === 100 ? 'All planned tasks complete. Breathe it in.' : 'Small steps still move you forward.' : 'Choose “Plan for today” on a task to begin.'}</p><span className="daily-session-count">◷ {sessionsToday.length} focus {sessionsToday.length === 1 ? 'session' : 'sessions'} today</span></div></div><button className="text-button" onClick={() => navigate(page === 'today' ? 'home' : 'today')}>{page === 'today' ? 'See all your tasks' : 'Open today’s plan'} →</button></section><section className="glass-card next-panel"><div className="card-heading"><h2>A little nudge</h2><Icon name="shuffle" /></div><div className="nudge-art" aria-hidden="true">✧<span>✦</span></div><p>Too many tabs in your head?<br />Let a little chance choose your next step.</p><button onClick={pick}><Icon name="shuffle" />Pick my next task</button></section></div>
        <div className={`work-grid ${view === 'board' ? 'board-layout' : ''}`}><section className="tasks-section glass-card"><div className="section-title"><h2>{page === 'today' ? 'Today’s plan' : 'Your tasks'}<span>{page === 'today' ? planned.length : data.tasks.length}</span></h2><button className="primary" onClick={() => { setEditTask(null); setModal('task') }}><Icon name="plus" />New task</button></div><div className="task-toolbar"><div className="search-field"><Icon name="search" /><input aria-label="Search tasks" placeholder="Find a little something…" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="view-toggle" role="group" aria-label="Task view"><button title="List view" aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><Icon name="list" /></button><button title="Board view" aria-label="Board view" aria-pressed={view === 'board'} onClick={() => setView('board')}><Icon name="board" /></button></div><details className="filter-menu"><summary>Filters{categoryFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' ? ' •' : ''}</summary><div className="filter-fields"><label>Status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All tasks</option><option value="active">Unfinished</option>{STATUSES.map(status => <option key={status} value={status}>{statusNames[status]}</option>)}</select></label><label>Category<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">All categories</option><option value="">Uncategorized</option>{data.categories.map(category => <option key={category.id} value={category.id}>{category.emoji} {category.name}</option>)}</select></label><label>Priority<select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}><option value="all">All priorities</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><button onClick={() => { setStatusFilter('all'); setPriorityFilter('all'); setCategoryFilter('all'); setQuery('') }}>Clear filters</button></div></details></div>
          {visible.length === 0 && <div className="empty-state"><span>☁</span><h3>{data.tasks.length ? 'A little quiet here.' : 'Your first small step starts here.'}</h3><p>{page === 'today' ? 'Use a task’s options to plan it for today.' : data.tasks.length ? 'Try another search or clear your filters.' : 'Add something you’d like to do. No rush, love.'}</p><button onClick={() => { setEditTask(null); setModal('task') }}>＋ Add a task</button></div>}
          {view === 'list' ? <div className="task-list" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/lau-task'); const task = data.tasks.find(item => item.id === id); if (task) drop(id, task.status) }}>{visible.map(task => <TaskCard key={task.id} task={task} {...taskProps} />)}</div> : <div className="board">{STATUSES.map(status => <section key={status} className={`board-column column-${status}`} aria-label={statusNames[status]} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); drop(event.dataTransfer.getData('text/lau-task'), status) }}><h3><i />{statusNames[status]}<span>{visible.filter(task => task.status === status).length}</span></h3>{visible.filter(task => task.status === status).map(task => <TaskCard key={task.id} task={task} board {...taskProps} />)}<div className="drop-hint">Drop a little step here</div></section>)}</div>}
          <div className="task-footer"><span>{visible.length} shown · {activeTasks.length} unfinished</span>{undo && <button className="text-button" onClick={undoDelete}>Undo last delete</button>}<span>Take it one thing at a time.</span></div>
        </section><FocusPanel data={data} now={now} selected={selectedTask} onSelect={setSelectedTask} onTimer={timerAction} onSettings={() => setModal('settings')} /></div>
        </>}
        <footer className="content-footer"><span><Icon name="heart" />Made with love, by Rej</span><span>Your pace is a good pace.</span></footer>
      </main></div><div className="window-bottom"><span>☁ A little space, just for you</span><span>Local & private · {data.tasks.length} tasks</span></div>
    </div>
    <div className="desktop-dock" aria-label="Quick navigation"><button aria-label="Home" onClick={() => navigate('home')}><Icon name="home" /></button><button aria-label="Today’s plan" onClick={() => navigate('today')}><Icon name="sun" /></button><button aria-label="New task" onClick={() => { setEditTask(null); setModal('task') }}><Icon name="plus" /></button><button aria-label="Completion history" onClick={() => navigate('history')}><Icon name="history" /></button><button aria-label="Settings" onClick={() => setModal('settings')}><Icon name="settings" /></button></div>
    {modal === 'task' && <TaskEditor task={editTask} categories={data.categories} onSave={saveTask} onClose={() => setModal(null)} />}
    {modal === 'settings' && <Settings data={data} onChange={setData} recovery={recovery} onRecover={() => setRecovery(null)} onReplace={incoming => { setData(incoming); setRecovery(null); setUndo(null); setSelectedTask(incoming.timer?.taskId || ''); setToast({ message: 'Backup restored. Welcome back, Lau.' }) }} onClose={() => setModal(null)} installPrompt={installPrompt} onInstall={install} offlineReady={offlineReady} />}
    {modal === 'pick' && <Modal title="A little nudge from the universe" onClose={() => setModal(null)}><div className="pick-content"><span className="pick-spark">✦</span>{suggested ? <><p className="muted">How about this little step?</p><h3>{suggested.title}</h3><p>{suggested.notes || 'No need to finish everything. Just make a little start.'}</p><div className="button-row"><button onClick={pick} disabled={activeTasks.length <= 1}>Pick another</button><button className="primary" onClick={() => focusTask(suggested)}>Start focusing</button></div></> : <><h3>You’re all caught up.</h3><p>No unfinished tasks to pick. Enjoy a little breathing room.</p></>}</div></Modal>}
    {modal === 'recap' && <Modal title="You did enough today, love." onClose={() => setModal(null)}><div className="recap-content"><div className="recap-symbol">☀</div><p className="muted">A little look at {new Date(now).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</p><div className="recap-counts"><div><strong>{completedToday.length}</strong><span>tasks completed</span></div><div><strong>{sessionsToday.length}</strong><span>focus sessions</span></div></div>{completedToday.length > 0 ? <ul>{completedToday.map(task => <li key={task.id}>✓ {task.title}</li>)}</ul> : <p>Even a quiet day counts. Rest is part of the plan.</p>}{data.settings.encouragement && data.settings.messages.length > 0 && <blockquote>{data.settings.messages[(completedToday.length + sessionsToday.length) % data.settings.messages.length]}<cite>— Rej</cite></blockquote>}<p className="muted">Your unfinished tasks will be here when you’re ready.</p><button className="primary" onClick={() => setModal(null)}>Back to my space</button></div></Modal>}
    {modal === 'help' && <Modal title="Little shortcuts" onClose={() => setModal(null)}><div className="shortcut-list"><p><kbd>N</kbd><span>Open a new task</span></p><p><kbd>Enter</kbd><span>Save from the task title</span></p><p><kbd>Esc</kbd><span>Close a dialog</span></p><p className="muted">They won’t interrupt you while typing. Drag by a task’s grip, or use its ⋯ menu to reorder or move between columns.</p></div></Modal>}
    {toast && <div className="toast" role="status"><Icon name="heart" /><span>{toast.message}</span>{toast.undo && <button onClick={undoDelete}>Undo</button>}<button className="icon-button" onClick={() => setToast(null)} aria-label="Dismiss message">×</button></div>}
    {celebration && <div className="celebration" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} style={{ '--i': index }}>✦</span>)}</div>}
  </div>
}
