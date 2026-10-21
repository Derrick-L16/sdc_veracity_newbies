// Local (non-Replit) Vite config. Reuses the Replit config unchanged and only adds
// a proxy: /api/backend/* goes straight to the Python backend, which on Replit
// is reached through the Express API server instead.
import base from '../artifacts/veracity/vite.config.ts'

const backend = process.env.BACKEND_URL || 'http://127.0.0.1:8000'

export default {
  ...base,
  server: {
    ...base.server,
    proxy: {
      '/api/backend': { target: backend, rewrite: (p) => p.replace(/^\/api\/backend/, '') },
    },
  },
}
