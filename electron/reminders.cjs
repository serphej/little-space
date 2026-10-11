const { randomUUID } = require('node:crypto')
const DEFAULTS = Object.freeze({ enabled: true, intervalMinutes: 30, quietEnabled: false, quietStart: '22:00', quietEnd: '08:00', pauseDuringFocus: true, sound: false, dueTime: '09:00', phrases: { checkIn: 'Hey Lau, how’s {task} going?', general: 'Want to pick a task together?', focus: 'Nice focus session! Time for a little break.', due: 'A little reminder: {count} unfinished task(s) due today or earlier.' } })
const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const minuteOfDay = time => Number(time.slice(0,2)) * 60 + Number(time.slice(3))
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
function quietAt(settings, now) {
  if (!settings.quietEnabled) return false
  const date = new Date(now); const minutes = date.getHours()*60 + date.getMinutes()
  const start = minuteOfDay(settings.quietStart), end = minuteOfDay(settings.quietEnd)
  return start === end || (start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end)
}
function validatePatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Invalid reminder settings')
  const result = {}
  for (const [key,value] of Object.entries(patch)) {
    if (['enabled','quietEnabled','pauseDuringFocus','sound'].includes(key) && typeof value === 'boolean') result[key] = value
    else if (key === 'intervalMinutes' && [15,30,60].includes(value)) result[key] = value
    else if (['quietStart','quietEnd','dueTime'].includes(key) && validTime(value)) result[key] = value
    else if (key === 'phrases' && value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(name => Object.hasOwn(DEFAULTS.phrases,name) && typeof value[name] === 'string' && value[name].trim().length > 0 && value[name].length <= 300)) result.phrases = { ...value }
    else throw new Error('Invalid reminder setting: ' + key)
  }
  return result
}
function validateContext(value) {
  if (!value || !Array.isArray(value.tasks) || value.tasks.length > 10000 || typeof value.selectedTaskId !== 'string' || value.selectedTaskId.length > 100) throw new Error('Invalid reminder task context')
  const ids = new Set()
  const tasks = value.tasks.map(task => {
    if (!task || typeof task.id !== 'string' || !task.id || task.id.length > 100 || ids.has(task.id) || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 300 || typeof task.completed !== 'boolean' || typeof task.dueDate !== 'string' || (task.dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) || dateKey(new Date(task.dueDate+'T12:00:00')) !== task.dueDate))) throw new Error('Invalid reminder task')
    ids.add(task.id)
    return { id:task.id,title:task.title,completed:task.completed,dueDate:task.dueDate }
  })
  let timer = null
  if (value.timer !== null) {
    const t = value.timer
    if (!t || typeof t.id !== 'string' || t.id.length > 100 || !['focus','break'].includes(t.mode) || !['running','paused','idle'].includes(t.state) || (t.state === 'running' && (!Number.isFinite(t.endsAt) || t.endsAt <= 0 || t.endsAt > Date.now()+181*60000))) throw new Error('Invalid reminder timer')
    timer = { id:t.id,mode:t.mode,state:t.state,endsAt:t.state === 'running' ? t.endsAt : null }
  }
  return { tasks,selectedTaskId:value.selectedTaskId,timer }
}
function placeBubble(dog, area, desired = { width:340,height:190 }) {
  const width = Math.min(desired.width,area.width), height = Math.min(desired.height,area.height)
  const right = dog.x+dog.width+8, left = dog.x-width-8
  const x = right+width <= area.x+area.width ? right : left >= area.x ? left : dog.x
  return { x:Math.round(Math.max(area.x,Math.min(x,area.x+area.width-width))), y:Math.round(Math.max(area.y,Math.min(dog.y+dog.height/2-height/2,area.y+area.height-height))),width,height }
}
const stamp = value => Number.isFinite(value) && value > 0
function format(phrase, values) { return phrase.replace(/\{(task|count)\}/g, (_match,key) => String(values[key] ?? '')) }
class Reminders {
  constructor(saved, now = Date.now()) {
    saved = saved && typeof saved === 'object' ? saved : {}
    let settings = structuredClone(DEFAULTS)
    for (const key of Object.keys(DEFAULTS)) { try { if (saved.settings?.[key] !== undefined) { const patch=validatePatch({[key]:saved.settings[key]}); settings={...settings,...patch,phrases:{...settings.phrases,...patch.phrases}} } } catch { /* Keep a valid default for corrupt fields. */ } }
    this.state = { settings, selectedId:typeof saved.selectedId === 'string' && saved.selectedId.length <= 100 ? saved.selectedId : '', nextCheckAt:Math.max(now+settings.intervalMinutes*60000,stamp(saved.nextCheckAt)?saved.nextCheckAt:0), snoozes:{}, dueDay:dateKey(new Date(now)), dueKeys:[], lastShownAt:stamp(saved.lastShownAt)?saved.lastShownAt:0, lastFocusId:typeof saved.lastFocusId === 'string'?saved.lastFocusId:'', focusSession:null, commands:[], testUntil:0 }
    if (saved.dueDay === this.state.dueDay && Array.isArray(saved.dueKeys)) this.state.dueKeys=saved.dueKeys.filter(key=>typeof key==='string' && key.length<=140).slice(0,10000)
    if (saved.snoozes && typeof saved.snoozes==='object') for(const [key,until] of Object.entries(saved.snoozes).slice(0,10000)) if(key.length<=100 && stamp(until) && until>now && until<=now+15*60000) this.state.snoozes[key]=until
    if (Array.isArray(saved.commands)) this.state.commands=saved.commands.filter(command=>command && typeof command.nonce==='string' && command.nonce.length<=100 && typeof command.taskId==='string' && command.taskId.length<=100).slice(0,16).map(command=>({nonce:command.nonce,taskId:command.taskId}))
    this.context=null; this.active=null; this.pendingFocus=null; this.blockUntil=now+1000; this.lastTick=now
  }
  interval(now) { return this.state.testUntil>now ? 60000 : this.state.settings.intervalMinutes*60000 }
  publicSettings(now=Date.now()) { return { ...this.state.settings, phrases:{...this.state.settings.phrases}, testUntil:this.state.testUntil, selectedTaskId:this.state.selectedId, testActive:this.state.testUntil>now } }
  changeSettings(patch, now=Date.now()) {
    patch=validatePatch(patch)
    this.state.settings={...this.state.settings,...patch,phrases:{...this.state.settings.phrases,...patch.phrases}}
    this.state.nextCheckAt=now+this.interval(now)
    this.active=null
    if (!this.state.settings.enabled) this.pendingFocus=null
  }
  testMode(enabled,now=Date.now()) {
    if(typeof enabled!=='boolean') throw new Error('Invalid test mode')
    this.state.testUntil=enabled?now+10*60000:0
    this.state.nextCheckAt=now+this.interval(now)
    this.active=null
  }
  wake(now=Date.now()) {
    this.state.nextCheckAt=now+this.interval(now)
    for(const [key,until] of Object.entries(this.state.snoozes)) if(until<=now) delete this.state.snoozes[key]
    this.pendingFocus=null;this.active=null;this.blockUntil=now+60000;this.lastTick=now
    const timer=this.context?.timer
    if(timer?.mode==='focus' && timer.state==='running' && timer.endsAt<=now) this.state.lastFocusId=timer.id
  }
  updateContext(context,now=Date.now()) {
    if(!this.context && context.timer?.mode==='focus' && context.timer.state==='running' && context.timer.endsAt<=now) this.state.lastFocusId=context.timer.id
    const previous=this.context?.timer
    if(previous?.mode==='focus' && previous.state==='running' && previous.endsAt<=now && previous.id!==this.state.lastFocusId) this.pendingFocus={id:previous.id,endsAt:previous.endsAt}
    this.context=context
    if(this.state.selectedId!==context.selectedTaskId) { this.state.selectedId=context.selectedTaskId;this.state.nextCheckAt=now+this.interval(now); if(this.active?.kind==='checkin') this.active=null }
    this.state.commands=this.state.commands.filter(command=>context.tasks.some(task=>task.id===command.taskId))
    for(const key of Object.keys(this.state.snoozes)) if(key!=='general' && !context.tasks.some(task=>task.id===key&&!task.completed)) delete this.state.snoozes[key]
    const timer=context.timer
    this.state.focusSession=timer?.mode==='focus' && timer.state==='running' ? {id:timer.id,endsAt:timer.endsAt} : null
    if (this.active?.kind==='checkin') {
      const task=context.tasks.find(item=>item.id===this.active.taskId && !item.completed)
      if(!task || task.id!==context.selectedTaskId || task.title!==this.active.taskTitle) this.active=null
    }
    if (this.active?.kind==='general' && context.tasks.some(task=>task.id===context.selectedTaskId && !task.completed)) this.active=null
    if (this.active?.kind==='due') {
      const pending=context.tasks.filter(task=>this.active.taskIds.includes(task.id) && !task.completed && task.dueDate && task.dueDate<=dateKey(new Date(now)))
      if(!pending.length) this.active=null
      else { this.active.count=pending.length;this.active.taskIds=pending.map(task=>task.id);this.active.text=format(this.state.settings.phrases.due,{count:pending.length});this.active.titles=pending.slice(0,3).map(task=>task.title) }
    }
  }
  show(kind, text, now, extra={}) {
    this.active={ id:randomUUID(),kind,text,expiresAt:now+15000,sound:this.state.settings.sound,...extra }
    this.state.lastShownAt=now
    return this.active
  }
  tick(now=Date.now(),environment={visible:true,blocked:false}) {
    if(now-this.lastTick>120000 || now<this.lastTick) this.wake(now)
    this.lastTick=now
    if(this.state.testUntil && this.state.testUntil<=now) { this.state.testUntil=0;this.state.nextCheckAt=now+this.interval(now) }
    if(this.active && this.active.expiresAt<=now) this.active=null
    if(!this.context) return this.active
    const settings=this.state.settings
    const timer=this.context.timer
    if(timer?.mode==='focus' && timer.state==='running' && timer.endsAt<=now && timer.id!==this.state.lastFocusId) this.pendingFocus={id:timer.id,endsAt:timer.endsAt}
    const focusing=timer?.mode==='focus' && timer.state==='running' && timer.endsAt>now
    const suppressed=!settings.enabled || !environment.visible || quietAt(settings,now) || (settings.pauseDuringFocus && focusing)
    if(suppressed) {
      this.active=null
      if(this.pendingFocus) { this.state.lastFocusId=this.pendingFocus.id;this.pendingFocus=null }
      if(this.state.nextCheckAt<=now) this.state.nextCheckAt=now+this.interval(now)
      for(const [key,until] of Object.entries(this.state.snoozes)) if(until<=now) delete this.state.snoozes[key]
      return null
    }
    if(environment.blocked || now<this.blockUntil) return this.active
    if(this.pendingFocus) {
      const session=this.pendingFocus;this.pendingFocus=null;this.state.lastFocusId=session.id
      if(now-session.endsAt<=120000) { this.state.nextCheckAt=now+this.interval(now);return this.show('focus',settings.phrases.focus,now) }
    }
    if(this.active || now-this.state.lastShownAt<30000) return this.active
    const day=dateKey(new Date(now))
    if(this.state.dueDay!==day) { this.state.dueDay=day;this.state.dueKeys=[] }
    const date=new Date(now)
    const due=this.context.tasks.filter(task=>!task.completed && task.dueDate && task.dueDate<=day && !this.state.dueKeys.includes(task.id+':'+task.dueDate))
    if(due.length && date.getHours()*60+date.getMinutes()>=minuteOfDay(settings.dueTime)) {
      this.state.dueKeys.push(...due.map(task=>task.id+':'+task.dueDate))
      this.state.nextCheckAt=Math.max(this.state.nextCheckAt,now+this.interval(now))
      return this.show('due',format(settings.phrases.due,{count:due.length}),now,{taskIds:due.map(task=>task.id),titles:due.slice(0,3).map(task=>task.title),count:due.length})
    }
    const selected=this.context.tasks.find(task=>task.id===this.context.selectedTaskId && !task.completed)
    const target=selected?.id || 'general'
    const snooze=this.state.snoozes[target]
    if(snooze && snooze>now) return null
    if(!snooze && this.state.nextCheckAt>now) return null
    delete this.state.snoozes[target]
    this.state.nextCheckAt=now+this.interval(now)
    return selected ? this.show('checkin',format(settings.phrases.checkIn,{task:selected.title}),now,{taskId:selected.id,taskTitle:selected.title}) : this.show('general',settings.phrases.general,now)
  }
  action(id, action, now=Date.now()) {
    const bubble=this.active
    if(!bubble || bubble.id!==id || bubble.expiresAt<=now || !['done','working','later','open','dismiss'].includes(action)) return null
    if(action==='done') {
      if(bubble.kind!=='checkin' || !this.context?.tasks.some(task=>task.id===bubble.taskId && !task.completed && task.id===this.context.selectedTaskId)) {this.active=null;return null}
      if(this.state.commands.length>=16) throw new Error('Please open tasks to finish pending changes.')
      const command={nonce:bubble.id,taskId:bubble.taskId};this.state.commands.push(command)
      this.active=null;this.state.nextCheckAt=now+this.interval(now);return {command}
    }
    if(action==='later') {
      if(!['checkin','general'].includes(bubble.kind)) return null
      this.state.snoozes[bubble.taskId || 'general']=now+15*60000
    }
    if(action==='working' && bubble.kind!=='checkin') return null
    this.active=null;this.state.nextCheckAt=now+this.interval(now)
    return {open:action==='open'}
  }
  acknowledge(nonce,result,now=Date.now()) {
    if(typeof nonce!=='string' || !['completed','unavailable','failed'].includes(result)) throw new Error('Invalid task acknowledgement')
    const command=this.state.commands.find(item=>item.nonce===nonce)
    if(!command) return false
    if(result==='completed' && !this.context?.tasks.some(task=>task.id===command.taskId && task.completed)) return false
    this.state.commands=this.state.commands.filter(item=>item.nonce!==nonce)
    if(result==='failed') this.show('error','I couldn’t save that change. Please open tasks and check your backup settings.',now)
    return true
  }
}
module.exports={ DEFAULTS,validatePatch,validateContext,quietAt,dateKey,placeBubble,Reminders }
