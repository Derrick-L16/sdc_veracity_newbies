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

## Case document evidence

JPEG, PNG and PDF documents (10 MiB maximum each, optional description up to 1000 characters) are private App Storage objects. No file bytes are saved in SQLite, the frontend/public directory, Git, or a local upload folder. App Storage must be provisioned; missing configuration fails explicitly without a local fallback. The existing Python/SQLite store remains authoritative for case permissions, upload reservations, attachment metadata, immutable assessment snapshots and audit history. This is an intentional exception to the generic storage scaffold's new-auth/new-database setup: neither identity nor inventory persistence was replaced.

Only managers and the case's submitting staff member can upload to an open case; owners can only view. This is enforced through the existing HttpOnly cookie session forwarded to Python. Express has a per-process private capability for internal evidence calls; the generic backend proxy rejects those paths. There are no generic upload, public file, replacement or deletion routes. The demo switcher still lets anyone choose a role, so these controls do not make this MVP safe for real sensitive evidence or production use.

`/api/evidence/cases/:id/uploads` reserves an actor/case-scoped idempotent upload with a generated storage ID. The browser PUTs bytes directly to a short-lived private staging URL. Finalization checks actual stored size (not client MIME/size alone), decodes images with a pixel cap, parses PDFs, pins the stored generation, and preserves a create-only final object before linking it in a SQLite transaction. Upload URLs only address staging; reusing a URL cannot replace saved evidence. Failed verification never creates an attachment or upload audit entry. Transfer and finalize retries reuse the original ticket. Temporary staged bytes can exist for abandoned or invalid uploads; cleanup of abandoned objects is separate from user attachment deletion and must never remove linked final objects.

Every decision, rejection and review request checks the client-observed attachment revision. Decision dialogs freeze that revision at opening, even if background polling refreshes the page. New uploads do not change assessments or quantities. Assessment versions snapshot only document IDs already available at assessment creation; historical pages and historical file requests enforce that membership. Current cases and closed Decision Passports show saved documents, with uploads disabled after closure.

App Storage protects document bytes across service restarts; metadata retains the existing SQLite restart persistence and hosting limitations. No database or production deployment migration was performed.

## Weekly inventory reporting

Managers and read-only owners have a **Summary** navigation entry at `/reports`.
`GET /api/backend/reports/weekly?week=YYYY-MM-DD` requires their existing session;
staff cannot access the aggregate report. The optional week is a Monday from
2000 onwards, no later than this week. Calendar boundaries are Monday–Sunday in
`Asia/Kuala_Lumpur`, with an exclusive next-Monday cutoff. The current week
refreshes every 30 seconds while visible. The week selection is in the URL.

Counts submitted includes matching counts (which create no case), and products
counted deduplicates product IDs within the week. New cases use creation time;
closed cases use decision time even if opened earlier. Outstanding cases include
earlier weeks, reconstructed at the cutoff from assessments, review events and
decisions. Aged cases are open at least 7 days. Shortage/surplus figures sum initial
differences on new cases; repeated observations are not net stock movements,
confirmed losses or monetary valuations.

Closed-week summaries are reconstructed on first access and persisted as JSON
metadata in the existing SQLite `weekly_reports` table. They are not automatically
captured on Sunday. **Why:** the local MVP has no scheduler or real manager
identities; freezing on first read makes later viewing stable without pretending
historical stock values or scheduled delivery existed. Backdated changes after
that first read are intentionally not reflected. Current case links may show a
newer status than a saved summary. The current week's report is never frozen.
No email delivery, task assignment system, new database or mock data was added.
Development data includes earlier browser-test records; it is not business data.

## Tests

- `pnpm exec playwright test tests/weekly-report.spec.ts` — reads existing development records (no synthetic products/counts), verifies report totals, prior-week query forwarding and frozen reloads, case links, mobile layout, staff/owner permissions and failure/retry. Historical GETs save the requested weekly snapshot.
- `pnpm test` — Python backend tests (temporary SQLite databases) plus file-content verification tests; includes permissions, transactional rollback, stale evidence/documents, idempotency, historical snapshots and HTTP sessions.
- `pnpm run typecheck` — full workspace check.
- `pnpm test:e2e` — Playwright against running workflows through `localhost:80`: CSV import, staff count, manager approval, persisted Passport, owner restrictions, direct routes and mobile navigation. Creates uniquely named `Migration test migration-*` inventory records in development; no existing records are altered.
- The focused evidence browser test also creates uniquely named `Evidence test evidence-*` and `Manager evidence test evidence-*` development records and private fixture documents. It verifies real image/PDF upload, a lost-finalize-response retry, stale dialog rejection, spoofed/oversized files, roles, historical views and closed Passport access. Fixtures are generated in memory, not committed.
- Screenshots/traces go to ignored `generated-artifacts/`.
- Playwright uses the Replit-provided Chromium when present; elsewhere install its browser with `pnpm exec playwright install chromium`.
- Registered validation commands: `test`, `typecheck`, `app-test`.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate shared transport helpers after API contract changes. The original frontend state provider intentionally remains in use.
