import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiDir = fileURLToPath(new URL('../artifacts/api-server/', import.meta.url))

// Read-only, transaction-consistent logical snapshot (WAL-safe). No backup/reset,
// seed, HTTP session, or other write against the demo instance is needed.
export function demoSnapshot() {
  const result = spawnSync(process.env.PYTHON_EXECUTABLE || 'python3', [
    ...JSON.parse(process.env.VERACITY_PYTHON_ARGS || '[]'), '-c', `
import hashlib, json, pathlib, sqlite3, sys
p = pathlib.Path(sys.argv[1])
if not p.exists():
    print("absent")
    sys.exit(0)
db = sqlite3.connect(p.resolve().as_uri() + "?mode=ro", uri=True)
db.execute("BEGIN")
tables = db.execute("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
state = []
for name, schema in tables:
    # Browser sessions are not inventory/report/evidence data.
    if name == "sessions": continue
    quoted = '"' + name.replace('"', '""') + '"'
    rows = sorted(repr(tuple(row)) for row in db.execute("SELECT * FROM " + quoted))
    state.append((schema, rows))
print(hashlib.sha256(json.dumps(state, sort_keys=True).encode()).hexdigest())
db.close()
`, path.resolve(apiDir, process.env.VERACITY_DB || 'backend/veracity.sqlite3')],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) throw new Error(`Cannot verify demo database preservation: ${result.stderr}`)
  return result.stdout.trim()
}
