import { useEffect, useRef } from 'react'
import { STORAGE_KEY } from './data'
export default function useDesktopReminders(data, selected, setSelected, complete) {
  const latest=useRef(null)
  useEffect(()=>{latest.current={data,selected,complete}})
  useEffect(()=>{
    const desktop=window.lauDesktop
    if(!desktop)return
    let active=true
    const pending=new Set()
    const snapshot=()=>{const c=latest.current;return {tasks:c.data.tasks.map(({id,title,completed,dueDate})=>({id,title,completed,dueDate:dueDate||''})),selectedTaskId:c.selected,timer:c.data.timer||null}}
    void desktop.getReminderSettings().then(settings=>{if(active&&settings.selectedTaskId&&latest.current.data.tasks.some(task=>task.id===settings.selectedTaskId&&!task.completed))setSelected(settings.selectedTaskId)}).catch(console.error)
    const unsubscribe=desktop.onTaskRequest(async({nonce,taskId})=>{
      if(!active||pending.has(nonce))return
      pending.add(nonce)
      try{
        const task=latest.current.data.tasks.find(item=>item.id===taskId)
        if(!task){await desktop.acknowledgeTask({nonce,result:'unavailable'});return}
        if(!task.completed)latest.current.complete(taskId,'done')
        let saved=false
        for(let attempt=0;attempt<10&&active;attempt++){await new Promise(resolve=>setTimeout(resolve,100));saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}').tasks?.some(item=>item.id===taskId&&item.completed);if(saved)break}
        if(active){await desktop.syncReminderContext(snapshot());await desktop.acknowledgeTask({nonce,result:saved?'completed':'failed'})}
      }catch(error){console.error('Reminder completion failed:',error);if(active)void desktop.acknowledgeTask({nonce,result:'failed'}).catch(console.error)}finally{pending.delete(nonce)}
    })
    return()=>{active=false;unsubscribe()}
  },[setSelected])
  useEffect(()=>{if(!window.lauDesktop)return;void window.lauDesktop.syncReminderContext({tasks:data.tasks.map(({id,title,completed,dueDate})=>({id,title,completed,dueDate:dueDate||''})),selectedTaskId:selected,timer:data.timer||null}).catch(console.error)},[data.tasks,data.timer,selected])
}
