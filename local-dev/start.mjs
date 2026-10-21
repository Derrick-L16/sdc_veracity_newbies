import path from 'node:path'
import { root, dependency, python, runNode, fail, port, freePort } from './common.mjs'

try {
  dependency('vite/package.json', 'veracity')
  dependency('esbuild', 'api-server')
  python()
  const ports = [port(process.env.LOCAL_WEB_PORT, 3000, 'LOCAL_WEB_PORT'),
    port(process.env.LOCAL_API_PORT, 8000, 'LOCAL_API_PORT'),
    port(process.env.LOCAL_VITE_PORT, 5173, 'LOCAL_VITE_PORT')]
  if (new Set(ports).size !== 3) throw new Error('Local frontend, API, and Vite ports must be different.')
  for (const p of ports) await freePort(p)
  runNode(path.join(root, 'local-dev/backend.mjs'))
  runNode(path.join(root, 'local-dev/frontend.mjs'))
} catch (error) { fail(error) }
