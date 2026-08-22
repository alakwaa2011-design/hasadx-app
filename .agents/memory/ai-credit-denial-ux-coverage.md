---
name: AI credit denial UX coverage
description: How to ensure a unified insufficient-credit UI covers every paid AI surface.
---

When adding or auditing a frontend credit-denial experience, derive its call-site inventory from every server route protected by `checkCredits`, then trace each route to its client caller. Do not rely on a feature-based endpoint list.

**Why:** paid AI actions can be embedded in adjacent product areas such as smart boards or file libraries, where their names do not resemble the obvious generator pages. Missing one leaves users with inconsistent generic errors for the same server `402` contract.

**How to apply:** after any new server-side credit guard or shared credit UI, search the server guard registrations first, map them to frontend calls, and verify every applicable request uses the common response-aware wrapper. Exclude only routes with no client caller or deliberately uncharged/guest behavior.