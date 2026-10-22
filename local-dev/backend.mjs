import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { root, python, port, freePort, buildApi, runNode, fail } from './common.mjs'
import { prepareNativeBinaries } from './native.mjs'

try {
  const apiPort = port(process.env.LOCAL_API_PORT, 8000, 'LOCAL_API_PORT')
  const webPort = port(process.env.LOCAL_WEB_PORT, 3000, 'LOCAL_WEB_PORT')
  await freePort(apiPort)
  const py = python()
  prepareNativeBinaries(root)
  const dataDir = path.resolve(process.env.LOCAL_DATA_DIR ?? path.join(root, '.veracity-local'))
  await mkdir(dataDir, { recursive: true })
  await buildApi()
  console.log(`[local-dev] API: http://127.0.0.1:${apiPort}; private Python starts automatically.`)
  console.log(`[local-dev] Local-only test data: ${dataDir}`)
  runNode(path.join(root, 'artifacts/api-server/dist/index.mjs'), [], {
    NODE_ENV: 'development',
    PORT: String(apiPort),
    VERACITY_LOCAL_DEV: '1',
    VERACITY_STORAGE: 'local',
    VERACITY_LOCAL_UPLOAD_DIR: path.join(dataDir, 'evidence'),
    VERACITY_DB: path.join(dataDir, 'veracity.sqlite3'),
    PYTHON_EXECUTABLE: py.command,
    VERACITY_PYTHON_ARGS: JSON.stringify(py.args),
    APP_ORIGIN: `http://localhost:${webPort},http://127.0.0.1:${webPort}`,
  })
} catch (error) { fail(error) }
