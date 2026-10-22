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
