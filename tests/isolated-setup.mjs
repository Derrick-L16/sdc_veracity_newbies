import { fork } from 'node:child_process'
import { demoSnapshot } from './demo-snapshot.mjs'

export default async function setup() {
  if (process.env.PLAYWRIGHT_BASE_URL) throw new Error('External test targets are forbidden.')
  const before = demoSnapshot()
  const server = fork(new URL('./isolated-server.mjs', import.meta.url), [], {
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  })
  const stop = async () => {
    if (server.exitCode !== null || server.signalCode !== null) return
    const exited = new Promise(resolve => server.once('exit', resolve))
    server.kill('SIGTERM')
    await exited
  }
  try {
    const { url, token } = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Isolated test server startup timed out')), 90000)
      server.once('message', data => { clearTimeout(timer); resolve(data) })
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Isolated test server exited (${code})`)) })
      server.once('error', error => { clearTimeout(timer); reject(error) })
    })
    process.env.VERACITY_E2E_URL = url
    process.env.VERACITY_E2E_TOKEN = token
    return async () => {
      await stop()
      if (demoSnapshot() !== before) throw new Error('Demo business data changed during browser tests. No reset or cleanup was attempted.')
      console.log('Demo database unchanged: inventory, cases, reports and evidence metadata verified.')
    }
  } catch (error) {
    await stop()
    throw error
  }
}
