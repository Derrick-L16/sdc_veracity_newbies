---
name: Merge state rechecks
description: Recheck the actual Git state after a turn boundary before acting on a merge approval.
---

Treat earlier reports of conflicts, staged changes, or a pending merge as observations, not durable state.

**Why:** In this workspace, a staged resolution and pending merge were observed again as conflicted in a later turn. After a subsequent approval prompt, the index was clean, no merge was pending, and the previously proposed deletions were absent. The agent had not completed a merge commit. The cause was not established.

**How to apply:** Immediately before acting on approval, inspect Git status, unmerged entries, current commit, and whether a merge is pending. If the state differs, explain the difference and reassess instead of committing an obsolete selection. A clean workspace does not establish the state of a teammate's local clone or GitHub.

**Completion rule:** When authorized to finish a merge, do not stop after staging the resolved file. Complete the merge commit after reviewing its other staged changes, and verify that no merge is pending and that the expected incoming branch is an ancestor of the resulting commit.

Stage and commit the reviewed resolution together before running long verification commands; test the committed merge afterwards.

**Why:** A resolved, staged merge was again replaced by a clean pre-merge tree during verification. Completing the merge commit before verification preserved the combined history.

**Why:** Resolving and staging only the launcher repeatedly left the user's Replit Pull workflow unfinished. Avoid describing a staged file resolution as a completed merge.
