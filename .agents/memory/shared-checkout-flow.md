---
name: Shared checkout flow
description: Keeps payment entry points behaviorally aligned without duplicating sensitive client-side checkout steps.
---

Credit-package and subscription checkout entry points must use the shared client checkout flow rather than reimplementing request and redirect steps independently.

**Why:** Each checkout has side effects beyond the POST itself: credit purchases persist the pending purchase intent; both flows emit checkout analytics and redirect in the same tab; eligible subscription contexts record the pre-checkout balance for the existing return verification. Copying pieces of that behavior makes new entry points silently diverge.

**How to apply:** A new buying surface may fetch and select its own server-backed options, but it should delegate final confirmation to the shared helper. Each selector step owns its current selection: clear it on step changes and verify the step's live payment and visibility flags inside the confirmation handler, not only in disabled UI. Do not introduce a client-side credit grant or alter the server checkout, webhook, product, or return-url contracts.