import test from 'node:test'
import assert from 'node:assert/strict'
import { changeStatus, emptyData, finishTimer, isToday, LEGACY_KEY, loadData, moveTask, normalizeLegacy, remainingSeconds, STORAGE_KEY, todayKey, validateData, weekStart } from '../src/data.js'
const task = (id = 'a') => ({ ...normalizeLegacy([{ id, title: `Task ${id}`, completed: false }])[0] })
const storage = entries => ({ getItem: key => entries[key] ?? null })

test('migrates existing tasks without discarding completion or inventing timestamps', () => {
  const original = [{ id: 'a', title: 'Get flowers', completed: false }, { id: 'b', title: 'Walk together', completed: true }]
  const raw = JSON.stringify(original)
  const loaded = loadData(storage({ [LEGACY_KEY]: raw }))
  assert.equal(loaded.error, null)
  assert.equal(loaded.data.tasks.length, 2)
  assert.equal(loaded.data.tasks[1].status, 'done')
  assert.equal(loaded.data.tasks[1].completedAt, null)
  assert.equal(validateData(loaded.data).tasks[0].title, 'Get flowers')
  assert.equal(raw, JSON.stringify(original))
})

test('corrupt current storage is recoverable and does not silently fall back to old tasks', () => {
  const entries = { [STORAGE_KEY]: '{broken', [LEGACY_KEY]: JSON.stringify([{ id: 'old', title: 'Old', completed: false }]) }
  const before = structuredClone(entries)
  const result = loadData(storage(entries))
  assert.match(result.error, /original storage is untouched/i)
  assert.equal(result.data.tasks.length, 0)
  assert.deepEqual(entries, before)
  assert.ok(loadData({ getItem() { throw new Error('Blocked') } }).error)
})

test('full task details, subtasks, preferences, and sessions survive JSON round trips', () => {
  const data = emptyData()
  data.tasks = [{ ...task(), notes: 'Be kind to yourself', priority: 'high', category: 'personal', dueDate: '2026-10-11', plannedDate: '2026-10-10', subtasks: [{ id: 'step', title: 'Start small', completed: true }] }]
  data.settings.sound = true
  data.settings.messages = ['Love you!', 'Keep going.']
  data.sessions = [{ id: 's', taskId: 'a', taskTitle: 'Task a', minutes: 25, completedAt: '2026-10-10T01:00:00Z' }]
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(data))), data)
})

test('backup validation rejects malformed details, duplicate IDs and inconsistent completion', () => {
  const data = emptyData(); data.tasks = [task()]
  for (const change of [draft => draft.tasks.push(task()), draft => { draft.tasks[0].completed = true }, draft => { draft.tasks[0].priority = 'urgent' }, draft => { draft.tasks[0].category = 'missing' }, draft => { draft.tasks[0].dueDate = '2026-02-30' }, draft => { draft.settings.focusMinutes = -5 }, draft => { draft.settings.accent = 'red' }, draft => { draft.tasks[0].subtasks = [{ id: 's', title: '  ', completed: false }] }]) {
    const invalid = structuredClone(data); change(invalid)
    assert.throws(() => validateData(invalid))
  }
  assert.throws(() => validateData({ version: 1 }))
})

test('moving between board columns keeps timestamps and completion consistent', () => {
  const time = '2026-10-10T04:00:00Z'
  const tasks = [task('a'), task('b'), task('c')]
  const done = moveTask(tasks, 'c', 'done', 'a', time)
  assert.deepEqual(done.map(item => item.id), ['c', 'a', 'b'])
  assert.equal(done[0].completed, true)
  assert.equal(done[0].completedAt, time)
  assert.equal(changeStatus(done[0], 'done', '2026-10-11T00:00:00Z').completedAt, time)
  const reopened = moveTask(done, 'c', 'doing')
  assert.equal(reopened[2].completed, false)
  assert.equal(reopened[2].completedAt, null)
  assert.equal(tasks[2].completed, false)
  assert.deepEqual(moveTask(tasks, 'missing', 'done'), tasks)
})

test('daily plan includes planned completed tasks and excludes unplanned completions', () => {
  const day = '2026-10-10'
  const tasks = [{ ...task('a'), plannedDate: day }, { ...changeStatus(task('b'), 'done'), plannedDate: day }, changeStatus(task('c'), 'done')]
  const planned = tasks.filter(item => item.plannedDate === day)
  assert.equal(planned.length, 2)
  assert.equal(planned.filter(item => item.completed).length, 1)
})

test('running timer uses timestamps across tab switches; paused time stays fixed', () => {
  const timer = { state: 'running', endsAt: 100000, remaining: 60 }
  assert.equal(remainingSeconds(timer, 45000), 55)
  assert.equal(remainingSeconds(timer, 98701), 2)
  assert.equal(remainingSeconds(timer, 250000), 0)
  assert.equal(remainingSeconds({ ...timer, state: 'paused', remaining: 22 }, 900000), 22)
})

test('finishing focus records one session at its actual end time and does not complete the task', () => {
  const data = emptyData(); data.tasks = [task()]
  data.timer = { id: 'focus-1', mode: 'focus', taskId: 'a', taskTitle: 'Task a', duration: 1500, remaining: 1500, endsAt: 100000, state: 'running' }
  assert.equal(finishTimer(data, 99000), data)
  const finished = finishTimer(data, 500000)
  assert.equal(finished.sessions.length, 1)
  assert.equal(finished.sessions[0].completedAt, new Date(100000).toISOString())
  assert.equal(finished.timer.mode, 'break')
  assert.equal(finished.timer.state, 'idle')
  assert.equal(finished.timer.remaining, 300)
  assert.equal(finished.tasks[0].completed, false)
  assert.equal(finishTimer(finished, 600000), finished)
  assert.equal(finishTimer({ ...data, sessions: finished.sessions }, 500000).sessions.length, 1)
})

test('break completion adds no focus session and prepares the selected focus duration', () => {
  const data = emptyData(); data.settings.focusMinutes = 40
  data.timer = { id: 'break-1', mode: 'break', taskId: 'a', taskTitle: 'Task a', duration: 300, remaining: 300, endsAt: 100000, state: 'running' }
  const finished = finishTimer(data, 200000)
  assert.equal(finished.sessions.length, 0)
  assert.equal(finished.timer.mode, 'focus')
  assert.equal(finished.timer.remaining, 2400)
  assert.equal(validateData(finished).timer.state, 'idle')
})

test('completion dates and week boundaries use local calendar days', () => {
  const date = new Date(2026, 9, 10, 12)
  assert.equal(todayKey(date), '2026-10-10')
  assert.equal(isToday(new Date(2026, 9, 10, 1).toISOString(), date), true)
  assert.equal(isToday(new Date(2026, 9, 9, 23).toISOString(), date), false)
  assert.equal(todayKey(new Date(weekStart(date))), '2026-10-05')
})

test('theme survives saving and older backups default to light without changing tasks', () => {
  const data = emptyData()
  data.tasks = [task()]
  data.settings.theme = 'dark'
  assert.equal(validateData(JSON.parse(JSON.stringify(data))).settings.theme, 'dark')
  delete data.settings.theme
  const upgraded = validateData(data)
  assert.equal(upgraded.settings.theme, 'light')
  assert.deepEqual(upgraded.tasks, data.tasks)
  data.settings.theme = 'unknown'
  assert.throws(() => validateData(data), /theme/i)
})
