# Veracity

Inventory discrepancy review with evidence attachments, human approval, and saved
Decision Passports. This is a **synthetic-data prototype with demo role switching**,
not production authentication.

## Source layout

The product already separates its frontend and backend. Their paths stay stable
so Replit and VS Code can use the same source:

| Path | Responsibility |
| --- | --- |
| `artifacts/veracity/src/components/screens/` | Frontend pages |
| `artifacts/veracity/src/components/reports/` | Summary picker, charts, metrics and follow-ups |
| `artifacts/veracity/src/components/veracity/` | Shared inventory workflows and controls |
| `artifacts/veracity/src/components/ui/` | Shared UI primitives actually used by the app |
| `artifacts/veracity/src/hooks/`, `lib/` | Frontend requests, state, dates and formatting |
| `artifacts/api-server/src/` | Express gateway and authenticated evidence file service |
| `artifacts/api-server/backend/` | Python/SQLite inventory, imports, assessments and decisions |
| `artifacts/api-server/backend/reporting/` | Reporting calendar boundaries, aggregation and snapshots |
| `lib/api-spec/` | OpenAPI source contract and code-generation configuration |
| `lib/api-client-react/`, `lib/api-zod/` | Generated client/types and validation; do not edit by hand |
| `local-dev/` | Cross-platform VS Code launchers and local proxy |
| `scripts/post-merge.sh` | Dependency setup after merges; not an application server |
| `tests/` | Browser tests with a disposable database and uploads directory |
| `docs/test-data/` | Shareable CSVs and evidence walkthrough |
| `artifacts/mockup-sandbox/` | Separate Canvas preview tooling; not the product frontend |

## Inventory Summary

Managers and owners can select Daily, Weekly, Monthly or Yearly in Summary.
Daily activity is grouped by hour, weekly/monthly by day, yearly by month.
All calendar boundaries use **Asia/Kuala_Lumpur**; weeks run Monday–Sunday.
Counts include matching submissions, while products counted deduplicates products
within the selected period. Opened cases use creation time and closed cases use
decision time. Outstanding cases include older unresolved cases.

Current periods update while the page is visible. Historical periods are saved
on their **first view**, not automatically at midnight or week end. Existing saved
weekly reports are retained. These are in-app reports, not scheduled email delivery.
Case links always open the current case, even from a historical snapshot.

## Run locally in VS Code (Windows, macOS, or Linux)

No application folders have been moved. The frontend remains in
`artifacts/veracity`, and the existing Express/Python backend remains in
`artifacts/api-server`. `local-dev/` only supplies startup and local routing.

### Requirements

- Node.js **24 LTS** and npm.
- pnpm **10** (`npm install --global pnpm@10` if needed).
- Python **3.10+**, including its standard SQLite module.
- On Windows, use a **Git Bash terminal** for `pnpm install`; the repository's
  existing install script uses shell commands.

After installing runtimes, close and reopen VS Code so PATH changes take effect.

### Start both services

From the repository root:

```bash
pnpm install
pnpm local
```

Wait for the API's **Server listening** message, then open:

**http://localhost:3000**

The launcher starts the existing frontend and API. Express starts its own private
Python subprocess automatically. **Do not separately run `python server.py`** for
this full-app setup: that Python-only server does not provide the Express upload
routes and can occupy a port needed by the local API.

### Separate frontend and backend terminals

If your team prefers two terminals:

```bash
# Terminal 1 (repo root)
node local-dev/backend.mjs

# Terminal 2 (repo root)
node local-dev/frontend.mjs
```

Equivalent commands: `pnpm local:backend` and `pnpm local:frontend`.
Always browse **http://localhost:3000**, not the internal Vite address.
The local gateway routes `/api` to Express and other requests to Vite, including
development WebSocket traffic. Replit's existing routing is unchanged.

Stop with **Ctrl+C**. Restart the backend after backend source changes, since its
launcher builds the API once at startup; frontend edits use Vite hot reload.

## Local data and evidence uploads

The local launcher **explicitly enables development-only disk storage**:

```text
.veracity-local/
├── veracity.sqlite3          Inventory, cases, sessions, attachment metadata
└── evidence/
    ├── evidence-staging/    Pending file bytes
    └── case-evidence/       Verified immutable attachments
```

This starts a separate local test database; existing backend SQLite files are not
deleted, copied, or migrated. The initial local inventory is empty. Import the
synthetic CSVs in `docs/test-data/evidence-pack/csv-records/` to get started.
Follow `docs/test-data/evidence-pack/README.md` for the complete evidence test.

Local uploads use the same case permissions, validation, approval guards, and
metadata as Replit uploads. There is no public static upload folder. JPEG, PNG,
and PDF files must be nonempty and at most 10 MiB. Uploads do not automatically
extract quantities or change stock.

Restarting the app preserves the local database and files. **Git does not sync
these files or database records between teammates.** Everyone has their own data.
The local data directory is ignored by Git and excluded from Replit publishing.
Use synthetic data only; do not treat OneDrive synchronization as an application
backup or run multiple app instances against the same local SQLite file.

Replit continues using its existing private App Storage. Missing cloud settings
still produce an error, never a silent local fallback. Local file mode is rejected
unless `NODE_ENV=development`; it must not be used as production storage.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `pnpm: command not found` | Install pnpm 10 with npm; reopen VS Code |
| Dependencies missing | Run `pnpm install` from the repository root |
| Python not found | Install Python 3.10+, reopen VS Code; launcher tries Windows `python`, `py -3`, then `python3` |
| Port already used | Stop the old Python/Node process; do not run both startup styles simultaneously |
| API returned HTML | Use port **3000**, ensure both local launchers are running, and pull the latest code |
| Local API not ready / HTTP 502 | Wait for the API build/startup; inspect the backend terminal |
| Empty inventory | Import sample product and movement CSVs in Account → Connected records |
| Upload rejected on a closed case | Open the latest assessment of an open case as Manager or its Staff creator |

Optional **local launcher settings** can be set in the terminal, not in committed
secret files: `LOCAL_WEB_PORT` (3000), `LOCAL_API_PORT` (8000),
`LOCAL_VITE_PORT` (5173), `LOCAL_DATA_DIR` (default `.veracity-local`), and
`PYTHON_EXECUTABLE` (path to your Python executable). Use the same port settings in
both terminals. Open `http://localhost:<LOCAL_WEB_PORT>` when changing the web port.
If you choose another data directory, keep it private and outside Git/public files.
No Replit credentials are required for this local development mode.

## Tests

```bash
pnpm test
pnpm run typecheck
node --test artifacts/veracity/tests/evidence-upload.test.mjs
```

`pnpm test:e2e` starts its own loopback-only frontend/API gateway, Python backend,
temporary SQLite database and local evidence storage. No running demo/local app
or cloud storage credentials are needed:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

The temporary instance is removed after the run (including failures). Browser tests
refuse `PLAYWRIGHT_BASE_URL` and verify the run identity before any test executes.
Do not bypass this safety fixture or run write tests against a walkthrough instance.
The runner compares a read-only logical snapshot of the demo SQLite database before
and after testing, including inventory, cases, reporting sources and evidence metadata.
Keep demo business data idle during this check; it never restores, resets or cleans
user data. `VERACITY_DB`, if set, identifies the demo database to check, not the test
database. Test SQLite/evidence paths are always created afresh by the runner.
See `replit.md` for Replit workflow details and known
prototype limitations. Windows startup has cross-platform launchers, but actual
Windows execution must still be verified by a teammate; Linux results do not
constitute a Windows test.
