import { spawn } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative, extname } from 'node:path'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
const require = createRequire(import.meta.url)
const packaged = process.argv.includes('--packaged')
const executable = packaged ? resolve('release/win-unpacked/Laus Little Space.exe') : require('electron')
const launchArgs = packaged ? ['--smoke-test'] : ['.', '--smoke-test']
const userData = await mkdtemp(join(tmpdir(), 'lau-electron-test-'))
console.log(`Isolated test profile: ${userData}`)
const root = resolve('dist')
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost')
    const target = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)))
    if (relative(root,target).startsWith('..')) throw new Error('Outside fixture')
    const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webmanifest':'application/manifest+json' }
    response.writeHead(200, { 'Content-Type':types[extname(target)] || 'application/octet-stream' })
    response.end(await readFile(target))
  } catch { response.writeHead(404);response.end('Not found') }
})
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
const webURL = `http://127.0.0.1:${server.address().port}`
function runChild(args, environment, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env: environment, windowsHide: true, stdio: ['ignore','pipe','pipe'] })
    let output = ''
    child.stdout.on('data', data => { output += data.toString(); process.stdout.write(data); onOutput?.(output) })
    child.stderr.on('data', data => { output += data.toString(); process.stderr.write(data) })
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Electron smoke test timed out.')) }, 45000)
    child.on('error', error => { clearTimeout(timeout); reject(error) })
    child.on('exit', code => { clearTimeout(timeout); code === 0 ? resolve(output) : reject(new Error(`Electron test exited ${code}`)) })
  })
}
async function phase(name) {
  const environment = { ...process.env, LAU_SMOKE_USER_DATA:userData, LAU_SMOKE_PHASE:name, LAU_SMOKE_WEB_URL:webURL }
  delete environment.ELECTRON_RUN_AS_NODE
  let duplicateTask
  const output = await runChild(launchArgs,environment, current => {
    if (name === 'write' && !duplicateTask && current.includes('LAU_SMOKE_READY:write')) {
      duplicateTask = runChild(launchArgs,environment).then(result => {
        if (!result.includes('LAU_DUPLICATE_EXIT')) throw new Error('Duplicate app instance did not exit.')
      })
      // Keep rejection handled while the first process is still working.
      duplicateTask.catch(() => {})
    }
  })
  if (!output.includes(`LAU_SMOKE_PASS:${name}`)) throw new Error(`Missing ${name} test result`)
  if (duplicateTask) await duplicateTask
  if (name === 'write' && !output.includes('LAU_WEB_OFFLINE_PASS')) throw new Error('Web/PWA runtime check did not finish.')
}
try {
  await phase('write'); await phase('read')
  console.log('Electron checks passed: dashboard, isolated APIs, focus/happy states, hide/reopen, tray lifetime, bounds, duplicate-instance prevention, and restart persistence.')
  console.log('Web/PWA checks passed in Chromium without a preload: task add/complete, desktop controls absent, real service worker, and offline reload.')
  console.log('Temporary test profile retained; personal tasks were not accessed.')
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
