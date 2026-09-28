---
name: Lemon renewal plan history
description: Why variant-less renewal invoices require historical evidence rather than the current subscription projection.
---

Variant-less paid renewal invoices need a signed, provider-dated subscription plan snapshot effective at invoice creation. A later plan switch cannot price an older invoice; a current provider snapshot can reveal a missing earlier change, but it cannot substitute for the historical snapshot. If the history is incomplete or conflicting, retain the failed invoice for review and retry after evidence arrives.

**Why:** Lemon's invoice can lack both variant and order IDs; the subscription's present variant changes on upgrades. A delayed paid invoice would otherwise silently lose credits or receive credits from the wrong plan.

**How to apply:** Keep dated plan-change evidence when modifying subscription webhook processing or event retention. Preserve monotonic paid-through and credited-period projections when processing delayed paid invoices.