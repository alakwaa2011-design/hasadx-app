---
name: Subscription Credits Design
description: Payment evidence and entitlement rules for Lemon Squeezy subscription credits.
---

Only verified payment evidence can fund subscription credits. An active subscription, checkout return, or metadata update alone is not payment proof.

**Why:** A subscription can be active while its payment entitlement was never recorded. Conversely, metadata can change without a new paid term.

**How to apply:** Prefer a real paid invoice. If the provider confirms a paid, unrefunded initial order but its invoice collection is empty, use that explicit order-payment identity through the same entitlement accounting. Never invent an invoice or grant an unrelated manual balance adjustment.

The initial order and any later initial invoice represent one purchase, not two.

**Why:** The provider can omit the first subscription invoice and deliver it later; invoice-only deduplication would grant the same monthly or annual purchase twice.

**How to apply:** Serialize initial order recovery, initial invoice processing, and refunds by provider subscription. Preserve the order link and original payment identity, including revoked or zero-credit entitlements. A late invoice must not revive or duplicate an existing purchase.

Paid terms and plan economics are immutable purchase snapshots. Annual purchases release credits monthly, and unused credit batches retain their original rollover expiry.

**Why:** The current subscription's variant or renewal date can reflect a later change; using it to reconstruct earlier purchases reassigns historical credits or extends their life.

**How to apply:** Calculate terms from immutable payment dates and the purchased billing interval; consult [annual entitlements](annual-subscription-entitlements.md) and [provider invoice shapes](lemon-paid-invoice-shape.md).
