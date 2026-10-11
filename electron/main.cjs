const { app, BrowserWindow, Menu, Tray, ipcMain, protocol, screen, session, nativeImage, dialog, powerMonitor } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const core = require('./core.cjs')
const { Reminders, validateContext, placeBubble } = require('./reminders.cjs')
const smoke = process.argv.includes('--smoke-test')
if (smoke && !process.env.LAU_SMOKE_USER_DATA) throw new Error('Smoke tests require an isolated profile. Use npm run desktop:test.')
const userDirectory = smoke && process.env.LAU_SMOKE_USER_DATA ? process.env.LAU_SMOKE_USER_DATA : path.join(app.getPath('appData'), 'LauLittleSpace')
fs.mkdirSync(path.join(userDirectory, 'browser'), { recursive: true })
app.setPath('userData', userDirectory)
app.setPath('sessionData', path.join(userDirectory, 'browser'))
app.setName('Lau’s Little Space')
app.setAppUserModelId('com.rej.laulittlespace')
protocol.registerSchemesAsPrivileged([{ scheme: 'lau', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
const locked = app.requestSingleInstanceLock()
if (!locked) { console.log('LAU_DUPLICATE_EXIT'); app.exit(0) }
let dashboard, dog, tray, interval, bubble, reminderInterval, reminders
let reminderSnapshot='', bubbleSnapshot='', lastDelivery=0
let preferences = { ...core.DEFAULTS }
let gesture = null
let menuOpen = false
let quitting = false
let direction = 1
let happyUntil = 0
let focus = { running: false, endsAt: null }
let petState = { mode: 'idle', direction: 1, startedAt: Date.now() }
let lastShape = ''
let lastMotion = Date.now()
const animations = JSON.parse(fs.readFileSync(path.join(__dirname, 'pet/assets/animations.json'), 'utf8').replace(/^\uFEFF/, ''))
const preferenceFile = path.join(userDirectory, 'desktop-preferences.json')
const roots = { app: path.join(__dirname, '../dist'), pet: path.join(__dirname, 'pet'), bubble: path.join(__dirname, 'bubble') }
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'"
const reminderFile=path.join(userDirectory,'reminders.json')
function loadReminders(){let saved={};try{if(fs.existsSync(reminderFile))saved=JSON.parse(fs.readFileSync(reminderFile,'utf8'))}catch(error){console.error(error.message);fs.copyFileSync(reminderFile,reminderFile+'.invalid-'+Date.now())}reminders=new Reminders(saved)}
function saveReminders(){const snapshot=JSON.stringify({...reminders.state,testUntil:0});if(snapshot===reminderSnapshot)return;fs.writeFileSync(reminderFile+'.tmp',snapshot);fs.renameSync(reminderFile+'.tmp',reminderFile);reminderSnapshot=snapshot}
function positionBubble(){if(!bubble||bubble.isDestroyed()||!dog)return;const b=placeBubble(dog.getBounds(),nearestArea(dog.getBounds()),{width:340,height:bubble.getBounds().height});bubble.setBounds(b,false);if(['win32','linux'].includes(process.platform))bubble.setShape([{x:12,y:8,width:Math.max(1,b.width-24),height:4},{x:8,y:12,width:Math.max(1,b.width-16),height:Math.max(1,b.height-24)},{x:12,y:b.height-12,width:Math.max(1,b.width-24),height:4}])}
function renderBubble(){const value=reminders.active;const snapshot=JSON.stringify(value);if(snapshot!==bubbleSnapshot){bubbleSnapshot=snapshot;safeSend(bubble,'bubble:changed',value);positionBubble()}if(value&&preferences.visible&&!menuOpen&&!gesture){if(!smoke&&!bubble.isVisible())bubble.showInactive()}else bubble.hide()}
function deliverCommands(){for(const command of reminders.state.commands)safeSend(dashboard,'reminders:task-request',command)}
function tickReminders(){try{const testing=Boolean(reminders.state.testUntil);reminders.tick(Date.now(),{visible:preferences.visible,blocked:menuOpen||Boolean(gesture)});saveReminders();renderBubble();if(Date.now()-lastDelivery>2000){lastDelivery=Date.now();deliverCommands()}if(testing!==Boolean(reminders.state.testUntil))safeSend(dashboard,'reminders:changed',reminders.publicSettings())}catch(error){console.error('Reminder scheduling/save failed:',error.message);reminders.active=null;bubble.hide()}}
// Windows nonfocusable transparent windows ignore real mouse input.
// Keep the bubble interactive; showInactive still prevents focus on arrival.
function createBubble(){bubble=new BrowserWindow({width:340,height:190,show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,movable:false,focusable:false,skipTaskbar:true,hasShadow:false,alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'bubble-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});secureWindow(bubble,'bubble');if(process.platform==='win32')bubble.setFocusable(true);bubble.setAlwaysOnTop(true,'floating');bubble.on('close',event=>{if(!quitting){event.preventDefault();reminders.active=null;renderBubble()}});bubble.once('ready-to-show',()=>{positionBubble();renderBubble()});void bubble.loadURL('lau://bubble/index.html').catch(error=>console.error(error.message))}
function savePreferences() {
  try {
    const temp = preferenceFile + '.tmp'
    fs.writeFileSync(temp, JSON.stringify(preferences, null, 2))
    fs.renameSync(temp, preferenceFile)
  } catch (error) { console.error('Desktop preferences could not be saved:', error.message); throw new Error('Desktop preferences could not be saved. Check available disk space.', { cause: error }) }
}
function loadPreferences() {
  if (!fs.existsSync(preferenceFile)) return
  try { preferences = core.readPreferences(JSON.parse(fs.readFileSync(preferenceFile, 'utf8'))) }
  catch (error) {
    console.warn('Desktop preferences were invalid; keeping an original copy.', error.message)
    fs.copyFileSync(preferenceFile, preferenceFile + `.invalid-${Date.now()}`)
  }
}
function publicPreferences() { return { ...preferences, startupAvailable: app.isPackaged && process.platform === 'win32' } }
function safeSend(window, channel, value) { if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(channel, value) }
function nearestArea(bounds) {
  return screen.getDisplayNearestPoint({ x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height / 2) }).workArea
}
function rememberPosition() { if (dog && !dog.isDestroyed()) { const [x,y] = dog.getPosition(); preferences.position = { x,y } } }
function repairBounds() {
  if (!dog || dog.isDestroyed()) return
  gesture = null
  const bounds = core.clampBounds({ ...dog.getBounds(), ...core.dimensions(preferences.size) }, nearestArea(dog.getBounds()))
  dog.setBounds(bounds, false)
  lastShape = ''
  positionBubble()
  rememberPosition()
  if (dashboard && !dashboard.isDestroyed()) {
    const previous = dashboard.getBounds()
    const area = nearestArea(previous)
    dashboard.setMinimumSize(Math.min(700, area.width), Math.min(500, area.height))
    dashboard.setBounds(core.clampBounds(previous, area), false)
  }
}
function showDashboard() {
  if (!dashboard || dashboard.isDestroyed()) createDashboard()
  if (dashboard.isMinimized()) dashboard.restore()
  dashboard.show()
  dashboard.moveTop()
  dashboard.focus()
}
function setStartup(enabled) {
  if (process.platform === 'win32' && app.isPackaged && !smoke) app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: ['--background'], name: 'LauLittleSpace' })
}
function applyPreference(key, value) {
  value = core.validatePreference(key, value)
  if (key === 'launchAtLogin' && !(app.isPackaged && process.platform === 'win32')) throw new Error('Windows startup is available after installing the packaged app.')
  if (key === 'launchAtLogin') setStartup(value)
  preferences = { ...preferences, [key]: value }
  if (key === 'visible') { gesture = null; if (value) { repairBounds(); if (!smoke) dog.showInactive() } else dog.hide() }
  if (key === 'size') repairBounds()
  rememberPosition()
  savePreferences()
  safeSend(dashboard, 'desktop:preferences-changed', publicPreferences())
  updateTray()
  tickReminders()
  return publicPreferences()
}
function menuTemplate() {
  return [
    { label: 'Open tasks', click: showDashboard },
    { label: preferences.paused ? 'Resume walking' : 'Pause walking', click: () => applyPreference('paused', !preferences.paused) },
    { label: preferences.visible ? 'Hide dog' : 'Show dog', click: () => applyPreference('visible', !preferences.visible) },
    { type: 'separator' },
    { label: 'Quit Lau’s Little Space', click: () => app.quit() },
  ]
}
function updateTray() {
  if (!tray || tray.isDestroyed()) return
  const menu = Menu.buildFromTemplate(menuTemplate())
  menu.on('menu-will-show', () => { menuOpen = true })
  menu.on('menu-will-close', () => { menuOpen = false; lastMotion = Date.now() })
  tray.setContextMenu(menu)
}
function secureWindow(window, expectedHost) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-attach-webview', event => event.preventDefault())
  window.webContents.on('will-navigate', (event, target) => {
    try { const url = new URL(target); if (url.protocol !== 'lau:' || url.hostname !== expectedHost || !['/', '/index.html'].includes(url.pathname)) event.preventDefault() }
    catch { event.preventDefault() }
  })
  window.webContents.on('render-process-gone', () => {
    if (!quitting) { console.error(`${expectedHost} renderer stopped. Recreating it.`); if (expectedHost === 'app') focus.running = false; window.reload() }
  })
}
function createDashboard() {
  const area = screen.getPrimaryDisplay().workArea
  dashboard = new BrowserWindow({ width: Math.min(1200, area.width), height: Math.min(850, area.height), minWidth: Math.min(700, area.width), minHeight: Math.min(500, area.height), show: false, title: 'Lau’s Little Space', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true, backgroundColor: '#c1d9f0',
    webPreferences: { preload: path.join(__dirname, 'dashboard-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false, spellcheck: false } })
  secureWindow(dashboard, 'app')
  dashboard.on('close', event => { if (!quitting) { event.preventDefault(); dashboard.hide() } })
  void dashboard.loadURL('lau://app/').catch(error => console.error('Dashboard load failed:', error.message))
}
function createDog() {
  const area = screen.getPrimaryDisplay().workArea
  const size = core.dimensions(preferences.size)
  const position = preferences.position || { x: area.x + area.width - size.width - 40, y: area.y + area.height - size.height - 20 }
  const bounds = core.clampBounds({ ...position, ...size }, screen.getDisplayNearestPoint(position).workArea)
  dog = new BrowserWindow({ ...bounds, show: false, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, movable: false, focusable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'dog-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, backgroundThrottling: false, spellcheck: false } })
  secureWindow(dog, 'pet')
  dog.setAlwaysOnTop(true, 'floating')
  dog.on('close', event => { if (!quitting) { event.preventDefault(); applyPreference('visible', false) } })
  dog.once('ready-to-show', () => { tick(); if (preferences.visible && !smoke) dog.showInactive() })
  void dog.loadURL('lau://pet/index.html').catch(error => console.error('Dog load failed:', error.message))
}
function assertSender(event, window, host) {
  if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('IPC sender is not allowed')
  const url = new URL(event.senderFrame.url)
  if (url.protocol !== 'lau:' || url.hostname !== host || !['/', '/index.html'].includes(url.pathname)) throw new Error('IPC origin is not allowed')
}
function endGesture(cancelled) {
  if (!gesture) return false
  const point = screen.getCursorScreenPoint()
  const result = core.updateGesture(gesture, point, screen.getDisplayNearestPoint(point).workArea)
  const click = !cancelled && !result.gesture.dragged
  if (result.gesture.dragged) dog.setBounds(result.bounds, false)
  gesture = null; lastMotion = Date.now(); lastShape = ''
  rememberPosition(); savePreferences()
  if (click) showDashboard()
  return click
}
function installIPC() {
  const dashboardHandle = (channel, handler) => ipcMain.handle(channel, (event, ...args) => { assertSender(event, dashboard, 'app'); return handler(...args) })
  const dogHandle = (channel, handler) => ipcMain.handle(channel, (event, ...args) => { assertSender(event, dog, 'pet'); return handler(...args) })
  dashboardHandle('reminders:settings',()=>reminders.publicSettings())
  dashboardHandle('reminders:update',patch=>{reminders.changeSettings(patch);saveReminders();renderBubble();safeSend(dashboard,'reminders:changed',reminders.publicSettings());return reminders.publicSettings()})
  dashboardHandle('reminders:test',enabled=>{reminders.testMode(enabled);saveReminders();renderBubble();safeSend(dashboard,'reminders:changed',reminders.publicSettings());return reminders.publicSettings()})
  dashboardHandle('reminders:context',value=>{reminders.updateContext(validateContext(value));saveReminders();renderBubble();return true})
  dashboardHandle('reminders:ack',value=>{if(!value||typeof value.nonce!=='string'||value.nonce.length>100)throw new Error('Invalid acknowledgement');const result=reminders.acknowledge(value.nonce,value.result);saveReminders();renderBubble();return result})
  const bubbleHandle=(channel,handler)=>ipcMain.handle(channel,(event,...args)=>{assertSender(event,bubble,'bubble');return handler(...args)})
  bubbleHandle('bubble:get',()=>reminders.active)
  bubbleHandle('bubble:height',height=>{if(!Number.isInteger(height)||height<100||height>420)throw new Error('Invalid bubble size');bubble.setSize(340,height,false);positionBubble();return true})
  bubbleHandle('bubble:action',(id,action)=>{if(typeof id!=='string'||id.length>100||!['done','working','later','open','dismiss'].includes(action))throw new Error('Invalid bubble action');if(action==='open'){reminders.action(id,action);reminders.active=null;renderBubble();showDashboard();saveReminders();return true}const result=reminders.action(id,action);saveReminders();renderBubble();if(result?.command)deliverCommands();if(result?.open)showDashboard();return Boolean(result)})
  dashboardHandle('desktop:preferences', publicPreferences)
  dashboardHandle('desktop:preference', applyPreference)
  dashboardHandle('desktop:focus', value => { focus = core.validateFocus(value); return true })
  dashboardHandle('desktop:completed', () => { happyUntil = Date.now() + 2400; return true })
  dogHandle('dog:state', () => petState)
  dogHandle('dog:gesture-start', () => { if (!menuOpen && preferences.visible) gesture = core.beginGesture(screen.getCursorScreenPoint(), dog.getBounds()); return true })
  dogHandle('dog:gesture-end', cancelled => endGesture(cancelled === true))
  dogHandle('dog:menu', () => {
    if (menuOpen) return false
    if (gesture) endGesture(true)
    menuOpen = true
    const menu = Menu.buildFromTemplate(menuTemplate())
    menu.popup({ window: dog, callback: () => { menuOpen = false; lastMotion = Date.now() } })
    return true
  })
}
function tick() {
  if (!dog || dog.isDestroyed()) return
  const now = Date.now()
  const sleeping = focus.running && focus.endsAt > now
  // A ten-second rest between short, slow strolls.
  const moving = preferences.visible && !preferences.paused && !gesture && !menuOpen && !reminders?.active && !sleeping && happyUntil <= now && now % 32000 > 10000
  if (gesture) {
    const point = screen.getCursorScreenPoint()
    const result = core.updateGesture(gesture, point, screen.getDisplayNearestPoint(point).workArea)
    gesture = result.gesture
    if (gesture.dragged) dog.setBounds(result.bounds, false)
  } else if (moving && now - lastMotion >= 250) {
    const bounds = dog.getBounds()
    const next = core.stepWalk(bounds, nearestArea(bounds), direction, Math.min(.4, (now - lastMotion) / 1000))
    direction = next.direction
    dog.setBounds(next.bounds, false)
    lastMotion = now
  } else if (!moving) lastMotion = now
  if(gesture)positionBubble()
  const mode = core.animationMode({ focus, happyUntil, moving, now })
  if (petState.mode !== mode || petState.direction !== direction) {
    petState = { mode, direction, startedAt: now }
    safeSend(dog, 'dog:state-changed', petState)
  }
  if (!gesture && ['win32', 'linux'].includes(process.platform)) {
    const frame = core.frameIndex(animations[mode], now, petState.startedAt)
    const signature = `${mode}:${frame}:${direction}:${preferences.size}`
    if (signature !== lastShape) {
      dog.setShape(core.shapeForFrame(animations[mode].frames[frame], dog.getBounds().width, direction))
      lastShape = signature
    }
  }
}
if (locked) {
  app.on('second-instance', () => { if (app.isReady()) showDashboard(); else app.once('ready', showDashboard) })
  app.on('window-all-closed', () => { /* Tray remains the owner of app lifetime. */ })
  app.on('before-quit', () => {
    quitting = true
    clearInterval(interval)
    clearInterval(reminderInterval)
    try{if(reminders)saveReminders()}catch(error){console.error(error.message)}
    rememberPosition()
    try { savePreferences() } catch { /* Reported above. */ }
    if (app.isReady()) session.defaultSession.flushStorageData()
  })
  app.on('will-quit', () => { if (tray && !tray.isDestroyed()) tray.destroy() })
  app.whenReady().then(async () => {
    if (!fs.existsSync(path.join(roots.app, 'index.html'))) throw new Error('Dashboard build is missing. Run npm run build first.')
    loadPreferences(); loadReminders()
    protocol.handle('lau', async request => {
      try {
        if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })
        const target = core.resolveAsset(request.url, roots, path)
        const content = await fs.promises.readFile(target)
        const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' }
        return new Response(content, { headers: { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff' } })
      } catch { return new Response('Not found', { status: 404 }) }
    })
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    session.defaultSession.on('will-download', (event, item, contents) => {
      if (contents !== dashboard?.webContents || !item.getFilename().endsWith('.json')) { event.preventDefault(); return }
      item.setSaveDialogOptions({ title: 'Save Lau backup', defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())), filters: [{ name: 'JSON backup', extensions: ['json'] }] })
    })
    createDashboard(); createDog(); createBubble(); installIPC()
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 20, height: 20 }))
    tray.setToolTip('Lau’s Little Space · Mochi')
    tray.on('double-click', showDashboard)
    tray.on('click', showDashboard)
    updateTray()
    if (app.isPackaged) setStartup(preferences.launchAtLogin)
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, () => { repairBounds(); try { savePreferences() } catch { /* Reported above. */ } })
    interval = setInterval(tick, 50)
    reminderInterval=setInterval(tickReminders,1000)
    powerMonitor.on('resume',()=>{reminders.wake();tickReminders()})
    if (process.argv.includes('--open') && !smoke) dashboard.once('ready-to-show', showDashboard)
    if (smoke) await require('./smoke.cjs').run({ app, dashboard, dog, tray, applyPreference, repairBounds, getPetState: () => petState, getPreferences: publicPreferences, showDashboard, tick, bubble, reminders, tickReminders })
  }).catch(error => {
    console.error(error)
    if (!smoke) dialog.showErrorBox('Lau couldn’t start', error.message)
    app.exit(1)
  })
}
