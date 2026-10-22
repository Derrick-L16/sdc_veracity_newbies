---
name: Git provider authorization
description: Recover source-control authorization when GitHub rejects pushes despite a healthy connection record.
---

Do not treat a healthy integration record as proof that GitHub push authorization works.

**Why:** The source-control connection reported active and healthy, but HTTPS pushes were rejected as invalid credentials. Inline authorization recovery could not open the Git-provider connection flow.

**How to apply:** Consult current Replit documentation before giving recovery instructions. The documented recovery is Replit account settings → Git Providers → disconnect and reconnect GitHub. Do not request a password or token in chat. After reconnection, recheck local Git state and remote ancestry, then retry a normal, non-force push.
