---
name: Lemon Squeezy paid invoice shape
description: Observed live invoice fields relevant to credit entitlement processing.
---

A live, paid, non-test subscription invoice returned by Lemon Squeezy lacked both `variant_id` and `order_id` even when fetched directly from the API. Its `billing_reason` was `initial`, not `subscription_created`. The associated subscription and paid order independently carried the subscription ID and order item's variant.

**Why:** Requiring invoice variant or the expected billing-reason labels rejects a genuine paid initial invoice; local subscription status can still look active while no credits are granted. An order-created webhook for a subscription can independently fail if treated as a one-time credit-package order.

**How to apply:** Validate the live provider response shape before adjusting payment handlers. Resolve any missing plan details via authoritative linked provider objects with strict identity/amount/period checks, then retain idempotent invoice-based grant rules. Do not infer a payment solely from the local active subscription or a checkout intent.

A live subscription can have an API-confirmed paid initial order and active status while its related subscription-invoices endpoint returns an empty list. In this state, no payment-success webhook may exist even though order-created and subscription-created were processed.

**Why:** A production support investigation confirmed this combination directly against the provider; asking to retry a nonexistent invoice event would not resolve it.

**How to apply:** Check both the paid order and the related invoice collection before recommending webhook replay. Any initial-order recovery must retain an audited provider payment identity and prevent a later invoice from granting the same paid period twice; do not bypass accounting with an unlinked manual balance grant.