// Run the Veracity frontend locally (e.g. in VS Code) without Replit.
// Start the backend first in another terminal:  python artifacts/api-server/backend/server.py
// Then, from the repo root after `pnpm install`:  node local-dev/frontend.mjs
//
// Nothing here changes the Replit setup. pnpm-workspace.yaml strips the
// Windows/macOS binaries of esbuild, rollup, lightningcss and tailwind oxide
// (Replit is linux-x64 only), so this script installs the missing ones into
// local-dev/.native and exposes them through NODE_PATH.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const webPort = process.env.WEB_PORT || '5173'
const nativeDir = path.join(here, '.native')
const nativeModules = path.join(nativeDir, 'node_modules')
const NATIVE_PACKAGES = ['esbuild', 'rollup', 'lightningcss', '@tailwindcss/oxide']

if (!existsSync(path.join(root, 'node_modules', '.pnpm'))) {
  console.error('\n[local-dev] Dependencies are missing. Run `pnpm install` in the repo root first (use a Git Bash terminal on Windows).\n')
  process.exit(1)
}

// Pick the platform binary each package expects, e.g. @rollup/rollup-win32-x64-msvc.
function missingNativeBinaries() {
  const store = path.join(root, 'node_modules', '.pnpm')
  const wanted = new Map()
  for (const name of NATIVE_PACKAGES) {
    const prefix = name.replace('/', '+') + '@'
    for (const dir of readdirSync(store).filter(d => d.startsWith(prefix))) {
      const pkgDir = path.join(store, dir, 'node_modules', name)
      if (!existsSync(path.join(pkgDir, 'package.json'))) continue
      const optional = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).optionalDependencies || {}
      const candidates = Object.keys(optional).filter(n => n.includes(`${process.platform}-${process.arch}`))
      const binary = candidates.find(n => n.endsWith('-msvc')) || candidates.find(n => !n.includes('musl')) || candidates[0]
      if (!binary) continue
      try {
        createRequire(path.join(pkgDir, 'package.json')).resolve(`${binary}/package.json`, { paths: [pkgDir, nativeModules] })
      } catch {
        wanted.set(binary, optional[binary])
      }
    }
  }
  return wanted
}

const missing = missingNativeBinaries()
if (missing.size) {
  console.log(`[local-dev] Installing platform binaries: ${[...missing.keys()].join(', ')}`)
  // Record them in .native/package.json, otherwise each npm install prunes the previous ones.
  mkdirSync(nativeDir, { recursive: true })
  const manifestPath = path.join(nativeDir, 'package.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { private: true }
  manifest.dependencies = { ...manifest.dependencies, ...Object.fromEntries(missing) }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  const result = spawnSync(`npm install --no-package-lock --prefix "${nativeDir}"`, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    console.error('\n[local-dev] Could not install platform binaries with npm.\n')
    process.exit(1)
  }
}

const vite = spawn(process.execPath, [path.join(root, 'artifacts', 'veracity', 'node_modules', 'vite', 'bin', 'vite.js'), '--config', path.join(here, 'vite.config.mjs')], {
  cwd: path.join(root, 'artifacts', 'veracity'),
  env: { ...process.env, NODE_PATH: [nativeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter), PORT: webPort, BASE_PATH: '/' },
  stdio: 'inherit',
})
vite.on('exit', code => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => vite.kill())
