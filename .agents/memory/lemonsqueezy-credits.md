---
name: Lemon Squeezy credit purchases
description: Design decisions and gotchas for the paid-credit purchase flow layered on the credits system.
---

## Rule
Paid credits are only ever granted inside the HMAC-verified webhook handler (`order_created`), never from the browser return page. The return page (`/teacher/credits?intent=...`) only polls purchase status.

**Why:** Browser-side confirmation can be forged; the webhook is the single source of truth.
**How to apply:** Any new payment event handling goes through `routes/webhooks-lemonsqueezy.ts` with idempotency via `webhook_events.idempotency_key`.

## Gotchas
- The webhook path must be exempted BOTH from `express.json` (needs raw body for HMAC) and from the production Origin/Referer CSRF guard in `app.ts` — webhooks send neither header.
- `runSchemaMigrations()` has TWO try blocks; ALTERs on credit tables must live in the SECOND block *after* the base `CREATE TABLE IF NOT EXISTS` statements, or fresh databases fail the first ALTER and silently skip everything after it.
- Balance buckets: `credit_accounts` has paid/promo/earned columns that must always sum to `balance`. Deduction order promo→earned→paid (`splitDeduction` in credit-service). Holds store their bucket breakdown (`held_*` columns) so refunds restore the same buckets; legacy holds (all-zero breakdown) restore to promo.
- `CreditService.refund` claims the hold atomically (`UPDATE ... WHERE status='pending' RETURNING`) — never read-then-update, the stale-hold worker races app failures.
- Webhook events stuck in `processing` >5 min are reclaimed on redelivery; `failed` events retry on redelivery with the same idempotency key.
- Refund credit clawback never goes negative — shortfall recorded as `refund_review_status='needs_review'` (refund_adjustment_required) on `credit_purchases`.
- Env vars (no VITE_ prefix): LEMON_SQUEEZY_API_KEY / STORE_ID / WEBHOOK_SECRET / CHECKOUT_SUCCESS_URL.
