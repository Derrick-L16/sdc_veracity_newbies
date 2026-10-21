// Shared Windows/macOS support for the existing local launchers.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

export function prepareNativeBinaries(root) {
  const store = path.join(root, 'node_modules', '.pnpm')
  if (!existsSync(store)) throw new Error('Dependencies are missing. Run pnpm install in the repo root first (use Git Bash on Windows).')
  const nativeDir = path.join(root, 'local-dev', '.native')
  const nativeModules = path.join(nativeDir, 'node_modules')
  const missing = new Map()
  for (const name of ['esbuild', 'rollup', 'lightningcss', '@tailwindcss/oxide']) {
    const prefix = name.replace('/', '+') + '@'
    for (const dir of readdirSync(store).filter(d => d.startsWith(prefix))) {
      const pkgDir = path.join(store, dir, 'node_modules', name)
      const manifestPath = path.join(pkgDir, 'package.json')
      if (!existsSync(manifestPath)) continue
      const optional = JSON.parse(readFileSync(manifestPath, 'utf8')).optionalDependencies || {}
      const candidates = Object.keys(optional).filter(n => n.includes(`${process.platform}-${process.arch}`))
      const binary = candidates.find(n => n.endsWith('-msvc')) || candidates.find(n => !n.includes('musl')) || candidates[0]
      if (!binary) continue
      try {
        createRequire(manifestPath).resolve(`${binary}/package.json`, { paths: [pkgDir, nativeModules] })
      } catch {
        if (missing.has(binary) && missing.get(binary) !== optional[binary]) {
          throw new Error(`Multiple versions of ${binary} are needed. Ask the team to align build-tool versions before starting locally.`)
        }
        missing.set(binary, optional[binary])
      }
    }
  }
  if (missing.size) {
    console.log(`[local-dev] Installing matching platform binaries: ${[...missing.keys()].join(', ')}`)
    mkdirSync(nativeDir, { recursive: true })
    const manifestPath = path.join(nativeDir, 'package.json')
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { private: true }
    manifest.dependencies = { ...manifest.dependencies, ...Object.fromEntries(missing) }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    // Isolated helper only: never replace the pnpm workspace lockfile.
    const result = spawnSync('npm install --no-package-lock', { cwd: nativeDir, stdio: 'inherit', shell: true })
    if (result.status !== 0) throw new Error('Could not install local platform binaries. Check npm/network access and retry.')
  }
  process.env.NODE_PATH = [...new Set([nativeModules, ...(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)])].join(path.delimiter)
}
