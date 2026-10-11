import { useState } from 'react'
import { todayKey } from '../data'
import Modal from './Modal'

export default function TaskEditor({ task, categories, onSave, onClose }) {
  const [draft, setDraft] = useState(() => task || { title: '', status: 'todo', priority: 'normal', category: '', dueDate: '', plannedDate: '', notes: '', subtasks: [] })
  const [subTitle, setSubTitle] = useState('')
  const update = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  function addSubtask() {
    if (!subTitle.trim() || draft.subtasks.length >= 100) return
    update('subtasks', [...draft.subtasks, { id: crypto.randomUUID(), title: subTitle.trim(), completed: false }])
    setSubTitle('')
  }
  return <Modal title={task ? 'A little update' : 'Make room for a new task'} onClose={onClose}>
    <form className="editor" onSubmit={event => { event.preventDefault(); if (!draft.title.trim()) return; onSave({ ...draft, title: draft.title.trim(), subtasks: draft.subtasks.filter(sub => sub.title.trim()).map(sub => ({ ...sub, title: sub.title.trim() })) }) }}>
      <label>Task title<input data-autofocus value={draft.title} onChange={event => update('title', event.target.value)} placeholder="What would you like to do, Lau?" maxLength={300} required /></label>
      <div className="form-grid"><label>Status<select value={draft.status} onChange={event => update('status', event.target.value)}><option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option></select></label><label>Priority<select value={draft.priority} onChange={event => update('priority', event.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label>Category<select value={draft.category} onChange={event => update('category', event.target.value)}><option value="">Uncategorized</option>{categories.map(category => <option key={category.id} value={category.id}>{category.emoji} {category.name}</option>)}</select></label><label>Due date<input type="date" value={draft.dueDate} onChange={event => update('dueDate', event.target.value)} /></label></div>
      <label className="check-label"><input type="checkbox" checked={draft.plannedDate === todayKey()} onChange={event => update('plannedDate', event.target.checked ? todayKey() : '')} />Plan for today</label>
      <label>Notes <span className="muted">(optional)</span><textarea value={draft.notes} onChange={event => update('notes', event.target.value)} maxLength={5000} rows={3} placeholder="A thought, a link, a little reminder…" /></label>
      <fieldset><legend>Small steps · {draft.subtasks.filter(sub => sub.completed).length}/{draft.subtasks.length}</legend>{draft.subtasks.map(sub => <div key={sub.id} className="subtask-editor"><input type="checkbox" aria-label={`Complete ${sub.title}`} checked={sub.completed} onChange={() => update('subtasks', draft.subtasks.map(item => item.id === sub.id ? { ...item, completed: !item.completed } : item))} /><input aria-label="Subtask title" value={sub.title} maxLength={300} required onChange={event => update('subtasks', draft.subtasks.map(item => item.id === sub.id ? { ...item, title: event.target.value } : item))} /><button type="button" className="icon-button" aria-label={`Remove ${sub.title}`} onClick={() => update('subtasks', draft.subtasks.filter(item => item.id !== sub.id))}>×</button></div>)}<div className="inline-form"><input value={subTitle} maxLength={300} onChange={event => setSubTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSubtask() } }} placeholder="Add a small step" aria-label="New subtask" /><button type="button" onClick={addSubtask} disabled={!subTitle.trim() || draft.subtasks.length >= 100}>Add step</button></div></fieldset>
      <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">{task ? 'Save changes' : 'Add task'}</button></div>
    </form>
  </Modal>
}
