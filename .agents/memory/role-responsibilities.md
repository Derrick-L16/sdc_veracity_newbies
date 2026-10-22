---
name: Role responsibilities
description: Why Staff, Manager and Owner have different duties rather than cumulative permissions
---

Treat the business hierarchy as restaurant staff → supervisor/manager → business
owner. Staff execute inventory work, managers handle operational decisions, and
owners supervise decisions and reasons without routinely performing that work.

**Why:** The user described restaurant, warehouse and SME operations this way and
approved an Owner decision overview plus role-specific homes, not an Owner
super-admin or a second approval requirement.

**How to apply:** Preserve the distinction between broad read visibility and
operational write authority. Do not infer that Owner should inherit Staff/Manager
mutation privileges merely because Owner is the highest business role.

Role selection is deliberately a demo entry experience, not real authentication.
Email, passwords and account registration are outside the current MVP.

**Why:** The user explicitly chose a simple role dropdown before entry and
Change role inside the app, rather than a production login system.

**How to apply:** Keep the demo limitation visible. Do not expand this flow into
Clerk, Replit Auth, registration or real account provisioning without a new request.

The entry should feel like a simple login, not a role-permissions tutorial.

**Why:** The user explicitly wanted just a role dropdown and Log in, and asked
to remove role-responsibility explanations and the Account tab.

**How to apply:** Keep entry concise and move operational tools to the relevant
role's working page rather than rebuilding an Account/settings area.
