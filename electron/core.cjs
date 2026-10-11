const DEFAULTS = Object.freeze({ visible: true, paused: false, size: 96, launchAtLogin: false, position: null })
const SIZES = [72, 96, 128]
function validatePreference(key, value) {
  if (['visible', 'paused', 'launchAtLogin'].includes(key) && typeof value === 'boolean') return value
  if (key === 'size' && SIZES.includes(value)) return value
  throw new Error('Invalid desktop preference')
}
function readPreferences(value) {
  const result = { ...DEFAULTS }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result
  for (const key of ['visible', 'paused', 'size', 'launchAtLogin']) {
    try { if (value[key] !== undefined) result[key] = validatePreference(key, value[key]) } catch { /* Ignore corrupt fields. */ }
  }
  if (value.position && Number.isFinite(value.position.x) && Number.isFinite(value.position.y)) {
    result.position = { x: Math.round(value.position.x), y: Math.round(value.position.y) }
  }
  return result
}
function dimensions(size) { return { width: size, height: Math.round(size * 40 / 48) } }
function clampBounds(bounds, area) {
  const width = Math.min(bounds.width, area.width)
  const height = Math.min(bounds.height, area.height)
  return { x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))),
    y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))), width, height }
}
function stepWalk(bounds, area, direction, seconds) {
  const candidate = { ...bounds, x: bounds.x + direction * 14 * seconds }
  const right = area.x + area.width - bounds.width
  const bounced = candidate.x <= area.x || candidate.x >= right
  return { bounds: clampBounds(candidate, area), direction: bounced ? -direction : direction }
}
function beginGesture(point, bounds) { return { start: { ...point }, origin: { ...bounds }, dragged: false } }
function updateGesture(gesture, point, area) {
  const dx = point.x - gesture.start.x
  const dy = point.y - gesture.start.y
  const dragged = gesture.dragged || Math.hypot(dx, dy) >= 6
  return { gesture: { ...gesture, dragged }, bounds: dragged ? clampBounds({ ...gesture.origin, x: gesture.origin.x + dx, y: gesture.origin.y + dy }, area) : gesture.origin }
}
function animationMode({ focus, happyUntil, moving, now }) {
  if (happyUntil > now) return 'happy'
  if (focus?.running && focus.endsAt > now) return 'sleep'
  return moving ? 'walk' : 'idle'
}
function validateFocus(value) {
  if (!value || typeof value.running !== 'boolean' || (value.running && (!Number.isFinite(value.endsAt) || value.endsAt <= 0 || value.endsAt > Date.now() + 181 * 60 * 1000))) throw new Error('Invalid focus state')
  return { running: value.running, endsAt: value.running ? value.endsAt : null }
}
function frameIndex(animation, now, startedAt) { return Math.floor(Math.max(0, now - startedAt) / animation.interval) % animation.frames.length }
function shapeForFrame(rects, size, direction) {
  const scale = size / 48
  return rects.map(rect => ({ x: Math.floor((direction < 0 ? 48 - rect.x - rect.width : rect.x) * scale), y: Math.floor(rect.y * scale), width: Math.max(1, Math.ceil(rect.width * scale)), height: Math.max(1, Math.ceil(rect.height * scale)) }))
}
function resolveAsset(urlString, roots, path) {
  const url = new URL(urlString)
  if (url.protocol !== 'lau:' || !Object.hasOwn(roots, url.hostname) || url.username || url.password || url.port) throw new Error('Invalid app URL')
  const root = roots[url.hostname]
  const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  if (name.includes('\0') || name.includes('\\')) throw new Error('Invalid asset path')
  const target = path.resolve(root, '.' + name)
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative) || !['.html', '.js', '.css', '.json', '.svg', '.png', '.ico', '.webmanifest', '.woff2'].includes(path.extname(target))) throw new Error('Asset is outside the app')
  return target
}
module.exports = { DEFAULTS, SIZES, validatePreference, readPreferences, dimensions, clampBounds, stepWalk, beginGesture, updateGesture, animationMode, validateFocus, frameIndex, shapeForFrame, resolveAsset }
