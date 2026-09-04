---
name: Annual subscription entitlements
description: Durable rules for annual Lemon Squeezy billing with monthly credit releases.
---

Annual payments create immutable invoice-level entitlements; the current subscription row is only a projection and must not define historical paid periods.

**Why:** Delayed or out-of-order payment, renewal, plan-change, cancellation, and refund events can otherwise assign credits to the wrong term, lose prepaid monthly releases, or revoke a newer paid term.

**How to apply:** Derive each paid period from immutable invoice data, snapshot its plan economics, release annual credits monthly with entitlement-bound idempotency, use one provider-subscription lock order, and target refunds only to the exact paid entitlement.