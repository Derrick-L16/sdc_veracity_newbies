---
name: Role responsibilities
description: Why Staff, Manager and Owner have different duties rather than cumulative permissions
---

Treat the business hierarchy as restaurant staff → supervisor/manager → business
owner. Staff execute inventory work, managers handle operational decisions, and
owners supervise decisions and reasons without routinely performing that work.

**Why:** The user described restaurant, warehouse and SME operations this way and
approved an Owner decision overview plus role-specific homes, not an Owner
super-admin or a second approval requirement. The user also clarified that Staff
cannot access Summary, but should still see limited stock updates in the Count
page's right-hand panel.

**How to apply:** Preserve the distinction between broad read visibility and
operational write authority. Do not infer that Owner should inherit Staff/Manager
mutation privileges merely because Owner is the highest business role. Keep
Staff's Count-panel visibility separate from Summary-page access.
