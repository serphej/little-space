/* This renderer paints only pixels. Native movement and permissions stay in main. */
const canvas = document.querySelector('#dog')
const context = canvas.getContext('2d')
context.imageSmoothingEnabled = false
let state = { mode: 'idle', direction: 1, startedAt: Date.now() }
let metadata
const images = {}
let heldPointer = null
async function initialize() {
  metadata = await fetch('./assets/animations.json').then(response => response.json())
  await Promise.all(Object.keys(metadata).map(async mode => {
    const image = new Image()
    image.src = `./assets/${mode}.svg`
    await image.decode()
    images[mode] = image
  }))
  window.lauDog.onState(next => { state = next })
  state = await window.lauDog.getState()
  paint()
  setInterval(paint, 50)
}
function paint() {
  const animation = metadata[state.mode]
  const frame = Math.floor(Math.max(0, Date.now() - state.startedAt) / animation.interval) % animation.frames.length
  context.clearRect(0, 0, 48, 40)
  context.save()
  if (state.direction < 0) { context.translate(48, 0); context.scale(-1, 1) }
  context.drawImage(images[state.mode], frame * 48, 0, 48, 40, 0, 0, 48, 40)
  context.restore()
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || heldPointer !== null) return
  event.preventDefault()
  heldPointer = event.pointerId
  canvas.setPointerCapture(event.pointerId)
  void window.lauDog.beginGesture()
})
canvas.addEventListener('pointerup', event => {
  if (event.pointerId !== heldPointer) return
  heldPointer = null
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  void window.lauDog.endGesture(false)
})
canvas.addEventListener('pointercancel', () => {
  if (heldPointer !== null) { heldPointer = null; void window.lauDog.endGesture(true) }
})
canvas.addEventListener('lostpointercapture', () => {
  if (heldPointer !== null) { heldPointer = null; void window.lauDog.endGesture(true) }
})
canvas.addEventListener('contextmenu', event => { event.preventDefault(); void window.lauDog.openMenu() })
void initialize()
