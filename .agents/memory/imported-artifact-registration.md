---
name: Imported artifact registration
description: Preserving imported application sources when the runtime artifact registry is empty
---
An empty artifact registry after GitHub import does not mean the application needs to be scaffolded again.

**Why:** Imported manifests remained intact while the runtime reported no artifacts or managed application workflows. Validating an unchanged manifest through the supported replacement callback registered the existing artifacts and their workflows without altering application source.

**How to apply:** Check existing manifests before creating artifacts. Preserve imported source and use the supported manifest validation flow to restore registration rather than deleting or moving an existing application.
