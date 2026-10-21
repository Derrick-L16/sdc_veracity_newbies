import http from 'node:http'
import path from 'node:path'
import { root, dependency, port, freePort, runNode, fail } from './common.mjs'
import { prepareNativeBinaries } from './native.mjs'

// A local-only gateway supplies the same /api routing as Replit. Existing Vite
// configuration and the frontend's relative API URLs need no proxy rewrite.
try {
  prepareNativeBinaries(root)
  const vite = path.join(path.dirname(dependency('vite/package.json', 'veracity')), 'bin/vite.js')
  const webPort = port(process.env.LOCAL_WEB_PORT, 3000, 'LOCAL_WEB_PORT')
  const apiPort = port(process.env.LOCAL_API_PORT, 8000, 'LOCAL_API_PORT')
  const vitePort = port(process.env.LOCAL_VITE_PORT, 5173, 'LOCAL_VITE_PORT')
  if (new Set([webPort, apiPort, vitePort]).size !== 3) throw new Error('Local frontend, API, and Vite ports must be different.')
  await freePort(webPort)
  await freePort(vitePort)
  runNode(vite, ['--config', 'artifacts/veracity/vite.config.ts'], {
    NODE_ENV: 'development', PORT: String(vitePort), BASE_PATH: '/', VERACITY_LOCAL_DEV: '1',
  })
  const upstream = req => req.url === '/api' || req.url?.startsWith('/api/') ? apiPort : vitePort
  const server = http.createServer((req, res) => {
    let pathname
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) }
    catch { res.writeHead(400); res.end(); return }
    if (pathname.includes('.veracity-local')) { res.writeHead(404); res.end(); return }
    const proxy = http.request({ hostname: '127.0.0.1', port: upstream(req), method: req.method, path: req.url, headers: req.headers }, response => {
      res.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(res)
    })
    proxy.on('error', () => {
      if (res.headersSent) { res.destroy(); return }
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'Local service is not ready. Start node local-dev/backend.mjs and wait for startup, then refresh.' }))
    })
    req.pipe(proxy)
  })
  server.on('upgrade', (req, socket, head) => {
    const proxy = http.request({ hostname: '127.0.0.1', port: vitePort, path: req.url, headers: req.headers })
    proxy.on('upgrade', (response, remote, remoteHead) => {
      socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n${Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`)
      if (head.length) remote.write(head)
      if (remoteHead.length) socket.write(remoteHead)
      remote.pipe(socket).pipe(remote)
      socket.on('error', () => remote.destroy())
      remote.on('error', () => socket.destroy())
    })
    proxy.on('error', () => socket.destroy())
    proxy.end()
  })
  server.on('error', fail)
  // IPv4 + IPv6 localhost are supported; reject non-loopback clients.
  server.on('connection', socket => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(socket.remoteAddress)) socket.destroy()
  })
  server.listen(webPort, () => console.log(`[local-dev] Open http://localhost:${webPort} (not the internal Vite port).`))
} catch (error) { fail(error) }
