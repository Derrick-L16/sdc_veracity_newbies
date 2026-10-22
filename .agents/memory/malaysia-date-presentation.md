---
name: Malaysia date presentation
description: User-requested date and time conventions across the application
---

Display all event timestamps as DD/MM/YYYY HH:MM:SS in Asia/Kuala_Lumpur
(UTC+8), regardless of the viewer's browser timezone. Calendar-only dates and
week boundaries use DD/MM/YYYY, without inventing a time.

**Why:** The user requested one consistent Malaysia format after raw ISO times
and mixed human-readable formats appeared across the app.

**How to apply:** Keep API/storage timestamps timezone-aware and calendar keys
in ISO form for sorting and filtering. Convert only at presentation. A native date
control's visible ordering can vary with browser locale; preserve the native picker
but give it a consistent formatted display. Do not guess a timezone for malformed
legacy timestamps.
