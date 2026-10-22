---
name: Form contrast
description: Why shared input styles must be verified with the consuming screen's typography classes
---

Dark-theme form values must be white or near-white, with readable secondary
placeholder text. Preserve theme-aware colors rather than forcing white in light mode.

**Why:** A background color token named `base` collided with Tailwind's
`text-base` font-size utility, generating a text color equal to the dark canvas.
This affected dialog headings and inputs even when their parents had readable text.

**How to apply:** When changing form styles, verify rendered native inputs,
date segments, selects and textareas on real screens. Do not assume adding a
foreground utility to a shared component survives class merging or CSS layering.
Avoid theme color names that collide with typography utilities; use an
unambiguous canvas/background name rather than `base`.
