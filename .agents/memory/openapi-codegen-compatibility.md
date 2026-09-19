---
name: OpenAPI codegen compatibility
description: Why generated API output must be reviewed before keeping a regeneration.
---

OpenAPI generation must run through the project codegen script, whose postprocessor adapts Orval’s Zod 4 shorthand to Zod 3, removes duplicate type-barrel exports, and normalizes generated-file endings. Avoid `format: uri` until the postprocessor also rewrites Orval's `zod.url()` output; document signed URLs as strings instead.

**Why:** Raw Orval output introduces `zod.int()`, `zod.email()`, `zod.uuid()`, `zod.url()`, runtime `File` references, and duplicate body-type exports against this project’s Zod 3/server setup. `zod.url()` fails at API startup even when TypeScript passes.

**How to apply:** Use the package’s codegen command rather than invoking Orval directly. After generation, inspect the diff and typecheck both generated libraries before relying on the output.