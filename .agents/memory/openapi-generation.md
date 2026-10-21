---
name: OpenAPI generator naming
description: Avoiding a path-schema and query-type naming collision in Orval
---

When one operation has both path and query parameters, Orval can give its path Zod schema and query TypeScript type the same exported name, breaking the shared barrel.

**Why:** The workspace generates both schemas and types into one package, and the generator does not always reserve names across both outputs.

**How to apply:** If this collision appears, disable unused path-schema generation for that operation and retain explicit router path validation. Regenerate rather than editing generated files.
