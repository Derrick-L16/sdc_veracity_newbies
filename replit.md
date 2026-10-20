# Veracity

Explainable inventory corrections: import stock records, submit physical counts, review evidence, approve corrections, and retain a Decision Passport.

## Run and test

Use the managed workflows (they supply ports and routing):
- `artifacts/veracity: web` — React + Vite frontend at `/`.
- `artifacts/api-server: API Server` — Express API at `/api`; starts and supervises the private Python inventory backend automatically.
- `pnpm --filter @workspace/api-server test` — original Python workflow and HTTP tests with temporary SQLite databases.
- `pnpm --filter @workspace/veracity test` — browser migration test against the running workflows. Creates uniquely named Migration Test records, not production data. Uses Replit's Chromium when available, otherwise Playwright's installed browser.
- `pnpm --filter @workspace/veracity run typecheck` — frontend TypeScript check.
- `pnpm --filter @workspace/api-server run typecheck` — API TypeScript check.

## Imported app preservation

The imported source is retained in `.migration-backup/`. Frontend components, visual tokens, assets, and business flows were copied, not redesigned. Next.js routing is replaced with wouter; the original `/api/backend/...` contract is served by Express.

The existing Python standard-library backend and SQLite storage are intentionally retained. Do not replace this database as part of routine maintenance. Inventory imports, assessments, decision authorization, audit history, and atomic/idempotent posting remain owned by the imported backend.

## Storage and publishing limits

The local database is `artifacts/api-server/backend/veracity.sqlite3`; override with `VERACITY_DB` if using a durable mounted location. SQLite files are excluded from Git and deployment uploads. No imported database file was supplied.

This remains the original demo: role selection deliberately permits Staff, Manager, and Owner identities without real authentication. Do not present it as production-authenticated. Before production use, separately plan real authentication and durable storage appropriate to the deployment. An autoscaled filesystem must not be treated as a durable shared SQLite store.

No external API credentials or PostgreSQL connection are needed for the imported app. The scaffolded `lib/db` package is not used by its inventory backend.

## Source documentation

`artifacts/veracity/docs/` preserves the original workflow, validation, handoff, and AI-use documents. Their references to Next.js proxy setup are historical; Express now owns that proxy. CSV example files are served from `/examples/`.
