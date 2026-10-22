---
name: Demo data hygiene
description: Why browser test fixtures must be isolated from the user's walkthrough inventory
---

Keep user walkthrough data separate from mutating automated tests. Do not leave
test-named products in the database the user is expected to demonstrate.

**Why:** The user could not understand the product flow because every visible
product was a migration/evidence test fixture. They approved clearing business
data after backup and receiving readable CSVs to import themselves.

**How to apply:** Prefer an isolated test backend/database for write-heavy tests.
Do not assume random unique IDs prevent pollution: they avoid collisions but still
appear in inventory, case lists and reports. Do not automatically seed the user's
database when they are intending to learn the import flow. Obtain approval before
destructive cleanup, and back up SQLite with its backup API rather than copying
only the main database file while WAL is active.

Isolate evidence file bytes as well as database rows when running mutating tests.
**Why:** Throwing away SQLite metadata alone can leave private fixture files in
shared cloud storage; database isolation is not sufficient protection.
**How to apply:** Use disposable local evidence storage alongside the temporary
database for browser tests, rather than inheriting walkthrough storage settings.

Retained database backups must still be able to open historical attachments after
demo/test data is cleared.
**Why:** The user explicitly requires cleanup to account for backups that may
still reference old cloud files; a SQLite backup does not contain those bytes.
**How to apply:** Treat retained backup references as live preservation needs.
Do not infer that clearing the current database authorizes deleting its former
attachments, or that a file retention period alone makes deletion safe.
