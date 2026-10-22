---
name: Form contrast
description: Why shared input styles must be verified with the consuming screen's typography classes
---

Dark-theme form values must be white or near-white, with readable secondary
placeholder text. Preserve theme-aware colors rather than forcing white in light mode.

**Why:** The user reported black text across inputs and date fields. A shared
component foreground class alone did not fix the count-note field when combined
with screen-level typography utilities; actual computed colors exposed the issue.

**How to apply:** When changing form styles, verify rendered native inputs,
date segments, selects and textareas on real screens. Do not assume adding a
foreground utility to a shared component survives class merging or CSS layering.
