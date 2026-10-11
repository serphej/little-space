import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'))
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.start_url, '/')
assert.equal(manifest.scope, '/')
for (const icon of manifest.icons) {
  const bytes = await readFile(`dist${icon.src}`)
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG')
  const [width, height] = icon.sizes.split('x').map(Number)
  assert.equal(bytes.readUInt32BE(16), width)
  assert.equal(bytes.readUInt32BE(20), height)
}
assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'))
const html = await readFile('dist/index.html', 'utf8')
assert.match(html, /manifest.webmanifest/)
assert.match(html, /apple-touch-icon/)
const worker = await readFile('dist/sw.js', 'utf8')
const handlers = {}
const store = new Map()
const added = []
const deleted = []
let cacheName
let claimed = false
const cache = {
  async addAll(urls) {
    for (const url of urls) {
      const pathname = new URL(url).pathname
      const bytes = await readFile(pathname === '/' ? 'dist/index.html' : `dist${pathname}`)
      store.set(url, { bytes, cached: true })
      added.push(url)
    }
  },
  async match(request) { return store.get(typeof request === 'string' ? request : request.url) },
}
const context = {
  URL,
  self: { registration: { scope: 'https://lau.test/' }, location: { origin: 'https://lau.test' }, clients: { async claim() { claimed = true } }, addEventListener(name, handler) { handlers[name] = handler } },
  caches: { async open(name) { cacheName = name; return cache }, async keys() { return [cacheName, 'lau-offline-old', 'unrelated-cache'] }, async delete(name) { deleted.push(name) } },
  fetch() { throw new Error('Network is offline') },
}
vm.runInNewContext(worker, context)
let pending
handlers.install({ waitUntil(promise) { pending = promise } }); await pending
assert.ok(added.some(url => /assets\/.*\.js$/.test(url)))
assert.ok(added.some(url => /assets\/.*\.css$/.test(url)))
assert.ok(added.includes('https://lau.test/wallpaper.svg'))
handlers.activate({ waitUntil(promise) { pending = promise } }); await pending
assert.deepEqual(deleted, ['lau-offline-old'])
assert.equal(claimed, true)
async function request(url, mode = 'cors') {
  let response
  handlers.fetch({ request: { url, mode, method: 'GET' }, respondWith(promise) { response = promise } })
  return response ? await response : null
}
assert.equal((await request('https://lau.test/', 'navigate')).cached, true)
assert.equal((await request(added.find(url => /assets\/.*\.js$/.test(url)))).cached, true)
assert.equal((await request(added.find(url => /assets\/.*\.css$/.test(url)))).cached, true)
assert.equal((await request('https://lau.test/wallpaper.svg')).cached, true)
assert.equal(await request('https://external.test/picture.png'), null)
assert.equal(await request('https://lau.test/not-a-precached-file'), null)
console.log(`PWA checks passed: manifest, PNG sizes, ${added.length} offline files, offline navigation/assets, and safe cache cleanup.`)
