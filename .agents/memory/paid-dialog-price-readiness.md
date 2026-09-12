---
name: Paid dialog price readiness
description: Prevent stale or unknown server-owned prices from enabling paid AI actions.
---

Whenever a paid-action dialog opens, synchronously clear any cached tool price and disable its paid actions until the fresh server response is validated. A failed price request must keep the actions disabled.

**Why:** Clearing price state only in an effect leaves one render where a reopened dialog can expose the previous price and briefly enable generation or regeneration.

**How to apply:** Use this rule for dialogs whose labels or availability depend on server-owned credit settings, especially when the same dialog can be closed and reopened without unmounting its page.