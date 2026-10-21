import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'node:net'

export const root = fileURLToPath(new URL('../', import.meta.url))
export const children = new Set()
let stopping = false

export function dependency(pkg, artifact) {
  try { return createRequire(path.join(root, 'artifacts', artifact, 'package.json')).resolve(pkg) }
  catch { throw new Error('Dependencies are missing. Run pnpm install in the repo root first (use Git Bash on Windows).') }
}

export function port(value, fallback, label) {
  const result = Number(value ?? fallback)
  if (!Number.isInteger(result) || result < 1 || result > 65535) throw new Error(`${label} must be a port between 1 and 65535.`)
  return result
}

export async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', () => reject(new Error(`Port ${port} is already in use. Stop the old local server or choose a different local port.`)))
    server.listen(port, '127.0.0.1', () => server.close(resolve))
  })
}

export function python() {
  const candidates = process.env.PYTHON_EXECUTABLE
    ? [[process.env.PYTHON_EXECUTABLE]]
    : process.platform === 'win32' ? [['python'], ['py', '-3'], ['python3']] : [['python3'], ['python']]
  for (const [command, ...args] of candidates) {
    const result = spawnSync(command, [...args, '-c', 'import sys,sqlite3; sys.exit(0 if sys.version_info >= (3,10) else 1)'], { timeout: 10000, windowsHide: true })
    if (result.status === 0) return { command, args }
  }
  throw new Error('Python 3.10+ with SQLite is required. Install Python, reopen VS Code, and check python --version. You can also set PYTHON_EXECUTABLE.')
}

export function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (process.platform === 'win32') {
      // Windows cannot deliver POSIX SIGTERM handlers to Node descendants.
      // Stop the tree, including the private Python process, not just the wrapper.
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    } else child.kill('SIGTERM')
  }
  const timer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL')
    process.exit(code)
  }, 2500)
  timer.unref()
  Promise.all([...children].map(child => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) resolve()
    else child.once('exit', resolve)
  }))).then(() => process.exit(code))
}

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdown())

export function runNode(script, args = [], env = {}) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root, env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true,
  })
  children.add(child)
  child.once('error', error => { console.error('[local-dev]', error.message); shutdown(1) })
  child.once('exit', code => {
    children.delete(child)
    if (!stopping) shutdown(code ?? 1)
  })
  return child
}

export async function buildApi() {
  dependency('esbuild', 'api-server')
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'artifacts/api-server/build.mjs')], {
      cwd: root, env: process.env, stdio: 'inherit', windowsHide: true,
    })
    children.add(child)
    child.once('error', reject)
    child.once('exit', code => { children.delete(child); code === 0 ? resolve() : reject(new Error('API build failed. See the output above.')) })
  })
}

export function fail(error) { console.error('\n[local-dev]', error.message); shutdown(1) }
