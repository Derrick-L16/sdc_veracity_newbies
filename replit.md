# Veracity

Veracity explains differences between physical stock counts and recorded inventory, supports evidence-based manager decisions, and preserves a read-only Decision Passport for each resolved case.

## Run & operate

Use the managed Replit workflows:
- `artifacts/veracity: web` — Vite/React frontend at `/`.
- `artifacts/api-server: API Server` — Express at `/api`; automatically starts and stops the existing Python backend on a private loopback port.
- The scaffolded mockup sandbox is optional and not needed to run Veracity.

Do not run a root `pnpm dev`. Managed workflows provide `PORT` and `BASE_PATH`.

## Source and routes

- `artifacts/veracity/src/` — preserved imported screens, components, styles and state provider; wouter replaces Next routing.
- Routes: `/` redirects to `/inbox`; `/inbox/frames`, `/count`, `/account`, `/cases/:id` (including `?v=` assessment versions), `/history`, `/history/:id`.
- `artifacts/veracity/public/` — original public assets and example CSVs.
- `artifacts/api-server/backend/` — original Python business logic, SQLite database and backend tests.
- `artifacts/api-server/src/routes/backend.ts` — replacement for the Next API proxy, preserving `/api/backend/*`, browser-origin checks and HttpOnly session cookies.
- `lib/api-spec/openapi.yaml` — transport contract. Domain payloads and validation remain owned by the imported backend and frontend domain types.
- `.migration-backup/` — untouched imported reference, not used at runtime or deployed.
- `docs/` — imported product and backend documentation; references to Next describe the original architecture, superseded by the paths above.

## Persistence and scope decisions

The migration preserves Python and SQLite rather than replacing the existing database or rewriting inventory reconciliation rules. This minimizes behavioral regressions and retains the original transactional approval, evidence versioning, audit and permission logic. The scaffolded PostgreSQL library is unused by this app.

SQLite defaults to `artifacts/api-server/backend/veracity.sqlite3`; the original optional `VERACITY_DB` setting is preserved. Runtime databases, WAL files, test screenshots and traces are excluded from Git and deployment uploads. No database contents were included in the import.

This remains the original local MVP: demo sessions allow anyone to choose Staff, Manager or Owner. This is not real authentication. `VERACITY_DEMO_MODE=false` disables demo sessions but does not add authentication. Keep this limitation visible when discussing production use; production authentication and durable hosted database choices are separate work, not part of the preservation-only port.

## Tests

- `pnpm test` — 16 original backend tests, including permissions, transactional rollback, duplicate posting prevention, stale evidence and HTTP sessions; uses temporary databases.
- `pnpm run typecheck` — full workspace check.
- `pnpm test:e2e` — Playwright against running workflows through `localhost:80`: CSV import, staff count, manager approval, persisted Passport, owner restrictions, direct routes and mobile navigation. Creates uniquely named `Migration test migration-*` inventory records in development; no existing records are altered.
- Screenshots/traces go to ignored `generated-artifacts/`.
- Playwright uses the Replit-provided Chromium when present; elsewhere install its browser with `pnpm exec playwright install chromium`.
- Registered validation commands: `test`, `typecheck`, `app-test`.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate shared transport helpers after API contract changes. The original frontend state provider intentionally remains in use.
