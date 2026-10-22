#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Inventory and evidence metadata use the preserved Python/SQLite backend.
# Do not run scaffolded PostgreSQL migrations against an unrelated database.
