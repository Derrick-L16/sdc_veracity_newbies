---
name: Migration preservation
description: Scope decisions and migration-tool limitations for the imported Vercel application
---

Preserve the imported app rather than treating migration as permission to redesign, replace its database, or add features.

**Why:** The assigned migration requires visual and behavioral parity; rewriting the existing Python/SQLite inventory engine would unnecessarily risk its transaction and audit guarantees.

**How to apply:** Treat production authentication or changing storage technology as separate, explicitly authorized work.

Keep the existing code structure and maintain teammates' VS Code startup compatibility when adding features.

**Why:** The user explicitly said not to change the whole code structure and reported that earlier structural changes prevented a teammate from running the frontend and backend locally.

**How to apply:** Prefer additive local-development support and small changes within existing modules. Explain any necessary startup-command changes, and do not move frontend/backend folders or substitute a new architecture without explicit approval.

The generic frontend-copy helper does not automatically detect a root-level Next app without a source directory. Passing `--client-dir .` copies public assets but reports that root application directories must be copied manually.

**Why:** The helper expects a conventional client source folder, while some Vercel exports put application, component, library and hook directories directly at the repository root.

**How to apply:** Run the required helper, honor its warnings, and copy the original source directories without rewriting their UI.

The specialized browser-testing subagent is unavailable in this environment (its config kind is rejected). Direct Playwright works with the system-provided Chromium.

**Why:** Migration verification still needs a real browser when the specialized tester cannot be started.

**How to apply:** Use repeatable local Playwright tests against the shared proxy. Wait for initial session/state hydration before mutations, and dismiss the role radio menu before interacting with the page.
