# Run Veracity locally (VS Code)

Replit runs the app through its own workflows (see `replit.md`). This folder lets you
run the same code on your own computer with two terminals. It does not change any
Replit file.

## Requirements

- Node.js 20+
- pnpm 10 (same as Replit): `npm install -g pnpm@10`
- Python 3.10+
- Windows: use **Git Bash** terminals (VS Code terminal dropdown → Git Bash).
  `pnpm install` runs a `sh` script that PowerShell cannot run.

## First time

```
pnpm install
```

## Terminal 1: backend

```
python artifacts/api-server/backend/server.py
```

(macOS/Linux: `python3`.) Wait for `Veracity API listening on http://127.0.0.1:8000`.

## Terminal 2: frontend

```
node local-dev/frontend.mjs
```

Open http://localhost:5173. Press `Ctrl+C` in each terminal to stop.

The first run also installs Windows/macOS build tool binaries into
`local-dev/.native/` (ignored by git), because `pnpm-workspace.yaml` only keeps the
Linux ones that Replit needs.

## Demo data

The database starts empty. As **Manager**, go to Account → Connected records and
import, once each and in this order:

1. Inventory products → `artifacts/veracity/public/examples/products.csv`
2. Unposted stock movements → `artifacts/veracity/public/examples/movements.csv`

Importing the same file twice fails with "Duplicate ID". To reset, stop the backend
and delete `artifacts/api-server/backend/veracity.sqlite3*`.

## Differences from Replit

Locally the frontend talks to the Python backend directly. On Replit an Express API
server sits in between and also handles case document uploads (PDF/PNG) through
Replit App Storage, so uploads do not work locally. Everything else does.
