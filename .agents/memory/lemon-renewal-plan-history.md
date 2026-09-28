---
name: Lemon renewal plan history
description: Why variant-less renewal invoices require historical evidence rather than the current subscription projection.
---

Variant-less paid renewal invoices need a signed, provider-dated subscription plan snapshot effective at invoice creation. A later plan switch cannot price an older invoice; a current provider snapshot can reveal a missing earlier change, but it cannot substitute for the historical snapshot. If the invoice predates all recorded plan snapshots, an administrator may explicitly read the provider-issued historical invoice PDF and attest the plan and interval for that invoice; the provider must still confirm payment, identity, date, and the exact document before retry. Never silently infer a plan from today's subscription. If the history conflicts, retain the failed invoice for review rather than overriding it.

**Why:** Lemon's invoice can lack both variant and order IDs; the subscription's present variant changes on upgrades. A delayed paid invoice would otherwise silently lose credits or receive credits from the wrong plan.

**How to apply:** Keep dated plan-change evidence when modifying subscription webhook processing or event retention. Preserve monotonic paid-through and credited-period projections when processing delayed paid invoices. Store a review audit without persisting provider-signed invoice download URLs.