const { contextBridge, ipcRenderer } = require('electron')
const allowed = { visible: value => typeof value === 'boolean', paused: value => typeof value === 'boolean', size: value => [72, 96, 128].includes(value), launchAtLogin: value => typeof value === 'boolean' }
contextBridge.exposeInMainWorld('lauDesktop', Object.freeze({
  getReminderSettings:()=>ipcRenderer.invoke('reminders:settings'),
  updateReminderSettings:patch=>ipcRenderer.invoke('reminders:update',patch),
  testReminders:enabled=>typeof enabled==='boolean'?ipcRenderer.invoke('reminders:test',enabled):Promise.reject(new Error('Invalid test mode')),
  syncReminderContext:value=>ipcRenderer.invoke('reminders:context',value),
  acknowledgeTask:value=>ipcRenderer.invoke('reminders:ack',value),
  onTaskRequest:callback=>subscribe('reminders:task-request',callback),
  onReminderSettings:callback=>subscribe('reminders:changed',callback),
  getPreferences: () => ipcRenderer.invoke('desktop:preferences'),
  setPreference: (key, value) => {
    if (!Object.hasOwn(allowed, key) || !allowed[key](value)) return Promise.reject(new Error('Invalid desktop preference'))
    return ipcRenderer.invoke('desktop:preference', key, value)
  },
  syncFocus: value => {
    if (!value || typeof value.running !== 'boolean' || (value.running && !Number.isFinite(value.endsAt))) return Promise.reject(new Error('Invalid focus state'))
    return ipcRenderer.invoke('desktop:focus', { running: value.running, endsAt: value.running ? value.endsAt : null })
  },
  taskCompleted: () => ipcRenderer.invoke('desktop:completed'),
  onPreferences: callback => {
    if (typeof callback !== 'function') throw new Error('A callback is required')
    const listener = (_event, preferences) => callback(preferences)
    ipcRenderer.on('desktop:preferences-changed', listener)
    return () => ipcRenderer.removeListener('desktop:preferences-changed', listener)
  },
}))

function subscribe(channel,callback){if(typeof callback!=='function')throw new Error('Callback required');const listener=(_event,value)=>callback(value);ipcRenderer.on(channel,listener);return()=>ipcRenderer.removeListener(channel,listener)}
