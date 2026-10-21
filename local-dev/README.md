# Run Veracity locally (VS Code)

See the root [README](../README.md) for complete setup and troubleshooting.
Existing frontend/backend directories are unchanged.

Requires Node.js **24 LTS**, pnpm **10**, and Python **3.10+**.
Use Git Bash on Windows for installation.

From the repository root:

```bash
pnpm install
pnpm local
```

Or use two terminals:

```bash
# Terminal 1
node local-dev/backend.mjs

# Terminal 2
node local-dev/frontend.mjs
```

Wait for the API to report **Server listening**, then open **http://localhost:3000**.
Stop with Ctrl+C. Do not start Python separately: Express starts it automatically.
The old Python-only proxy cannot handle evidence uploads.

Windows/macOS support is preserved: missing matching build-tool binaries are
installed into ignored `local-dev/.native/` using npm, without replacing workspace
dependencies or the pnpm lockfile. Initial setup may need network access.

Local inventory and evidence persist in ignored `.veracity-local/`, separate from
Replit and any old Python-only database. Import samples through Account →
Connected records. Do not delete teammates' databases.
Replit continues using App Storage; local disk storage is development-only.
