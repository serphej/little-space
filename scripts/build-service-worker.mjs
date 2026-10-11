import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
const directory = resolve('dist')
async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true })
  const groups = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(resolve(path, entry.name)) : resolve(path, entry.name)))
  return groups.flat()
}
const files = (await walk(directory)).filter(path => !path.endsWith('sw.js')).sort()
const hash = createHash('sha256')
for (const path of files) hash.update(await readFile(path))
const version = hash.digest('hex').slice(0, 16)
const assets = files.map(path => relative(directory, path).replaceAll('\\', '/'))
const worker = `/* Generated from the production build. Do not edit dist files. */
const CACHE_PREFIX = 'lau-offline-';
const CACHE_NAME = CACHE_PREFIX + '${version}';
const FILES = ${JSON.stringify(['./', ...assets])};
const URLS = FILES.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => (await cache.match(new URL('./', self.registration.scope).href)) || fetch(event.request)));
  } else if (URLS.includes(url.href)) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
  }
});
`
await writeFile(resolve(directory, 'sw.js'), worker)
console.log(`Offline cache ready: ${assets.length} files (${version}).`)
