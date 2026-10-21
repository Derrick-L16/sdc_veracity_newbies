---
name: Stale preview services
description: Distinguishing an old listener from the current managed service after merged features.
---
Check both managed workflow status and a feature-specific endpoint when a merged API feature appears missing in preview.

**Why:** An older API and frontend continued serving while the managed workflows failed with occupied ports. Health checks passed, but the new upload route returned an HTML 404 instead of JSON. The published site did not have the same failure.

**How to apply:** Compare preview and published responses independently. Identify the actual listener and its process ownership before terminating only the obsolete service, then restart the exact managed workflows. A passing generic health check does not establish that the newest routes are loaded.
