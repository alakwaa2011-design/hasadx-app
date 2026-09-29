---
name: Deployment and generated database declarations
description: API artifact publishing typechecks against tracked library declarations rather than rebuilding every library first.
---

When a shared database schema gains exports or columns, regenerate and retain the library's declaration output before publishing the API artifact.

**Why:** The API artifact's standalone production build can fail with “no exported member” or “unknown property” despite the source schema being correct, because it reads stale tracked declarations. The development preview can fail the same way.

**How to apply:** Run the shared library typecheck/build before the API artifact build after schema edits, and verify both steps locally before suggesting Publish.