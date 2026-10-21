---
name: Merge state rechecks
description: Recheck the actual Git state after a turn boundary before acting on a merge approval.
---

Treat earlier reports of conflicts, staged changes, or a pending merge as observations, not durable state.

**Why:** In this workspace, a staged resolution and pending merge were observed again as conflicted in a later turn. After a subsequent approval prompt, the index was clean, no merge was pending, and the previously proposed deletions were absent. The agent had not completed a merge commit. The cause was not established.

**How to apply:** Immediately before acting on approval, inspect Git status, unmerged entries, current commit, and whether a merge is pending. If the state differs, explain the difference and reassess instead of committing an obsolete selection. A clean workspace does not establish the state of a teammate's local clone or GitHub.
