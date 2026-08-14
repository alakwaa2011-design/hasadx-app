---
name: Webhook idempotency semantics
description: Rules for marking Lemon Squeezy webhook events processed/failed and avoiding permanently-locked idempotency keys.
---

Rule: a webhook handler must never `return` early (silent skip) when required work could not be done — the router would mark the event `processed` and the idempotency key locks forever, so a corrected retry is dropped as duplicate.

**Why:** a `subscription_created` with an unmapped variant was logged `processed`; after fixing the variant mapping, every LS re-send was rejected as duplicate, and `external_subscription_id` stayed NULL so `subscription_payment_success` could never grant credits.

**How to apply:**
- Repairable failures (unknown variant, subscription not yet linked locally) → throw a plain Error → status `failed` + HTTP 500 (LS retries; internal retry path reprocesses `failed` rows).
- Immutable payload defects (missing user_id / missing invoice+subscription ids) → throw `TerminalWebhookError` → status `failed` but HTTP 200 (ack, no LS retry storm).
- Legitimate business skips (locally-cancelled sub, already granted) stay `processed`.
- All subscription handlers key on `external_subscription_id`; if it is NULL nothing downstream works — linking in `subscription_created` is the critical step.
- Integration tests share the test DB and mutate the `basic` plan row → `fileParallelism: false` in vitest.integration.config.ts is required.
