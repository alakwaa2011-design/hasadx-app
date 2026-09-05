---
name: OpenAPI codegen compatibility
description: Why generated API output must be reviewed before keeping a regeneration.
---

The current OpenAPI generator can emit Zod APIs that the installed API validation package does not support and can also recreate body-type export collisions.

**Why:** A routine regeneration rewrote a large generated surface, introduced `zod.int()` against Zod 3, and caused hundreds of library type errors unrelated to the contract change.

**How to apply:** After any OpenAPI generation, inspect the generated diff and run the library typecheck immediately. Do not retain broad generated churn when the generator and installed validation runtime are incompatible; fix the toolchain compatibility as a dedicated change first.