---
name: Shared library Wameeth access
description: Rules for playing another teacher's published Activities Library item through Wameeth without importing it.
---

An authenticated teacher may launch a different teacher's activity without a clone only when it is visibly published in the Activities Library: shared, not admin-hidden, and not private. This exception applies only to the Wameeth class and independent direct-play modes. Individual and team live games retain their existing behavior, and other direct-play game types remain owner-only. Independent results stay private to the player and show only total points, correct answers, and wrong answers—never a ranking.

**Why:** A public-library activity is intentionally reusable for those Wameeth flows, while extending the exception to private, hidden, unpublished, or unrelated game modes would bypass the library's visibility and ownership boundaries.

**How to apply:** Keep the client-side setup source filter and server-side direct-link authorization aligned with the Activities Library visibility rules. Do not make import/cloning part of the Start action.