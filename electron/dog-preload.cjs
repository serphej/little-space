const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('lauDog', Object.freeze({
  getState: () => ipcRenderer.invoke('dog:state'),
  beginGesture: () => ipcRenderer.invoke('dog:gesture-start'),
  endGesture: cancelled => ipcRenderer.invoke('dog:gesture-end', cancelled === true),
  openMenu: () => ipcRenderer.invoke('dog:menu'),
  onState: callback => {
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('dog:state-changed', listener)
    return () => ipcRenderer.removeListener('dog:state-changed', listener)
  },
}))
