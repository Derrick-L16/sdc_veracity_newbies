# Backend implementation and workflow

## Frontend retained

Keep the supplied `app/`, `components/ui/`, `components/veracity/`, CSS, icons, colours, responsive layout and typography. No extraction into a new design is needed. Existing count, inbox, case, history and Passport screens remain the presentation layer.

Changed data boundaries:

| Original | Implemented |
|---|---|
| `SEED_CASES` in React memory | Cases loaded from SQLite via `/state` |
| Hard-coded product quantities | Imported products; refreshed server balances |
| Fixed overview totals | Summary computed from actual products/counts/cases |
| Simulated delays and local decisions | Awaited API mutations and error feedback |
| Client-only role restrictions | Session role checked in each backend mutation |
| Prewritten recommendation/evidence | Deterministic assessment from unposted movements |
| Static historical case | Saved assessment versions, decision, audit and ledger |

Only small functional additions use the existing visual components: a Connected records card on Account and a Refresh evidence & reassess button. The old static `/inbox/frames` gallery now shows the live inbox instead of mock overview states. Loading/error UI remains available for feedback.

## Five-stage execution

1. Trigger: a staff/manager count reads the database quantity, validates the count, and checks that no open investigation exists for that product.
2. Connected data: query movements by product, unposted status and event time at/before count. Snapshot all eligible records and their revisions. No subset selection to force a numerical match.
3. Decision: sum signed quantities. Require exact net agreement with `counted − recorded`, eligible records and no flagged conflict. Otherwise report incomplete/conflicting evidence. Store rule results, rule version, evidence hash, source rows and explanation.
4. Approval: a manager supplies action, reason and assessment version. The server checks case state, latest version, inventory revision and current evidence hash. Staff/Owner cannot decide. Rejection keeps the current database balance. Request review appends an event without changing stock.
5. Outcome: within `BEGIN IMMEDIATE`, normal approval posts each eligible movement exactly once and updates the stock once. It creates one ledger entry keyed uniquely by case ID, closes the case, and saves the Passport and audit entry. Any failure rolls back all writes. Repeated or concurrent approvals cannot produce a second adjustment.

A manager override records one explicit adjustment to the counted balance. It never posts uncertain movements. Existing evidence is flagged unresolved after that override, preventing later normal approval from silently applying it a second time. A manager must investigate those records outside this MVP; record editing/resolution is deliberately not provided.

## Decision revision

Import additional evidence with the **original event time before the count**. Select Refresh evidence & reassess. Old version objects remain unchanged; a new assessment is appended. A client holding an older assessment number cannot approve it. Closed cases cannot be reassessed or edited through these routes.

Changed stock baseline cannot be fixed by reusing the old physical count. Reject the old case and take a fresh count. In a real connector, use verified source revisions and stock synchronization boundaries rather than trusting CSV assertions.

## Storage

| Table | Purpose |
|---|---|
| products | Current recorded balance, valuation cost, revision |
| movements | Signed unposted/posted source transactions |
| counts | Physical counts, including matching counts |
| cases | Investigation snapshot, append-only versions, timeline, final decision |
| sessions | Opaque expiring demo identities |
| ledger | One consequential inventory operation per case |
| audit | Imported data and business action events |

Cases are stored as JSON snapshots in SQLite to keep the MVP and original TypeScript screen contracts small. This is suitable for the local prototype; normalize/version schema for a larger service. Backup the SQLite database using SQLite backup tooling rather than copying a live WAL database incorrectly.

## API

Browser calls `/api/backend/...`; the Next handler proxies to private `BACKEND_URL`. POST checks exact browser Origin; cookies are forwarded server-side. The Python API is bound to `127.0.0.1` and has no public CORS configuration.

| Method/path (Python API) | Role | Body/result |
|---|---|---|
| GET /health | Public | Service status |
| POST /session | Demo only | `{role}` → HttpOnly session cookie |
| GET /state | All | Authorized cases, products, summary, progress, user |
| POST /imports | Manager | `{kind:"products" or "movements", rows:[...]}` |
| POST /counts | Staff, Manager | `{productId or product, counted, recorded?, note?}` |
| GET /cases/:id | Authorized viewer | Full case/Passport JSON |
| POST /cases/:id/reassess | Staff who created case, Manager | `{}` |
| POST /cases/:id/decisions | Manager | `{action,reason,version}` |
| GET /cases/:id/audit | Authorized viewer | Audit rows for case |

The backend ignores caller-supplied user identity or role headers. Staff case visibility is restricted by saved creator. Owner is read-only. The demo session endpoint intentionally permits selecting any of these identities and is the principal deployment limitation.

## Team implementation sequence

1. Run both processes, load inventory and movements, submit count, approve, verify History.
2. Read `backend/server.py` in order: schema → input validators → assessment → count → decision → import → state → HTTP routing.
3. Read `components/app/app-provider.tsx` to see the asynchronous UI contract.
4. Test incomplete evidence and additional evidence revision.
5. Test stale data, unauthorized actions, repeat decision and restart persistence.
6. Ask mentor to assess problem fit, evidence explanation, learnability and a future Orbyte adapter. Do not describe CSV integration as access to an Orbyte API.
