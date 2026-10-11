import {useEffect,useState} from 'react'
export default function ReminderSettings(){
 const [settings,setSettings]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{const desktop=window.lauDesktop;if(!desktop)return;let active=true;const off=desktop.onReminderSettings(next=>{if(active)setSettings(next)});void desktop.getReminderSettings().then(next=>{if(active)setSettings(next)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false;off()}},[])
 if(!window.lauDesktop)return null
 const change=(key,value)=>setSettings(current=>({...current,[key]:value}))
 async function save(event){event.preventDefault();setBusy(true);setError('');const {enabled,intervalMinutes,quietEnabled,quietStart,quietEnd,pauseDuringFocus,sound,dueTime,phrases}=settings;try{setSettings(await window.lauDesktop.updateReminderSettings({enabled,intervalMinutes,quietEnabled,quietStart,quietEnd,pauseDuringFocus,sound,dueTime,phrases}))}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function test(){setBusy(true);setError('');try{setSettings(await window.lauDesktop.testReminders(!settings.testActive))}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section><h3>Mochi's reminders</h3>{settings&&<form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
 {[[ 'enabled','Enable reminders' ],[ 'quietEnabled','Use quiet hours' ],[ 'pauseDuringFocus','Pause reminders while the focus timer is running' ],[ 'sound','Play a soft reminder sound' ]].map(([key,label])=><label className="check-label" key={key}><input type="checkbox" checked={settings[key]} onChange={e=>change(key,e.target.checked)}/>{label}</label>)}
 <label>Check-in interval<select value={settings.intervalMinutes} onChange={e=>change('intervalMinutes',Number(e.target.value))}>{[15,30,60].map(v=><option key={v} value={v}>{v} minutes</option>)}</select></label>
 <div className="settings-row">{[['quietStart','Quiet hours start'],['quietEnd','Quiet hours end'],['dueTime','Daily due-task reminder time']].map(([key,label])=><label key={key}>{label}<input type="time" required value={settings[key]} onChange={e=>change(key,e.target.value)}/></label>)}</div>
 <p className="muted">Times use your computer?s local time. Quiet hours can cross midnight; equal start and end means all day. Unfinished tasks due today or earlier are grouped into one daily reminder.</p>
 {[['checkIn','Selected-task check-in'],['general','No selected task'],['focus','Focus finished'],['due','Due-task summary']].map(([key,label])=><label key={key}>{label}<input required maxLength={300} value={settings.phrases[key]} onChange={e=>change('phrases',{...settings.phrases,[key]:e.target.value})}/></label>)}
 <p className="muted">Use {'{task}'} for the selected title and {'{count}'} for the number of due tasks. Hidden dog and quiet hours silence reminders. Bubbles disappear after 15 seconds.</p>
 <button className="primary" type="submit">Save reminder settings</button><button type="button" onClick={test}>{settings.testActive?'Stop one-minute test':'Try one-minute reminders'}</button>
 <p className="muted">Save settings first. Testing uses one-minute check-ins for ten minutes, then returns to your saved interval. To test during focus, turn off pause reminders and save. Snoozes still last 15 minutes.</p>
 </fieldset></form>}{error&&<p role="alert" className="error-text">{error}</p>}</section>
}
