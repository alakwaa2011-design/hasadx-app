---
name: Subscription Credits Design
description: Rules for granting monthly subscription credits via Lemon Squeezy webhooks — idempotency, expires_at, rollover cap.
---

## Core Rules

**Only one event grants credits: `subscription_payment_success`**
- `subscription_created` → upsert subscription record only, no credit grant
- `subscription_payment_recovered` → update payment_status='active' only, no credit grant
- `subscription_updated` / `subscription_resumed` → metadata sync only

## Idempotency Guard (Primary)

`subscription_credit_grants` table with `subscription_invoice_id TEXT UNIQUE`:
- `invoiceId = payload.data.id` (LS invoice object ID — NOT subscription_id, NOT order_id)
- INSERT first with `ON CONFLICT DO NOTHING RETURNING id`
- If no row returned → already processed → return `alreadyGranted: true` immediately
- `credits_granted` always recorded even when 0 (rollover cap reached) — prevents later reprocessing

## Secondary Guard

`subscriptions.last_credited_period_end` — updated after grant but NOT the sole decision-maker.

## expires_at for New Subscription Batches

`expires_at = nextPeriodEnd` where:
1. Fetch Subscription from LS API: `GET /v1/subscriptions/{subscriptionId}` → read `renews_at`
2. `subscriptionId = payload.data.attributes.subscription_id`
3. `nextPeriodEnd = renews_at + 1 calendar month` (use `Date.setMonth(m+1)`, NOT +30 days)
4. Fallback if LS API fails: `periodEnd + 1 calendar month`

**Why:** Each batch lives for 2 billing cycles (current + next), implementing the 2-month rollover window without extending old batches.

## Rollover Cap Calculation

```
remaining = SUM(amount_remaining) FROM credit_batches
            WHERE source='subscription' AND amount_remaining>0 AND expires_at > NOW()
toAdd = MAX(0, MIN(monthly_credits, rollover_cap - remaining))
```
Basic rollover_cap = 500, Pro rollover_cap = 1200.

## Navigation Pattern in homework-app

- Uses `wouter`: `const [, setLocation] = useLocation()` then `setLocation("/path")`
- NOT react-router, NOT preact-iso
- Pages use `from "react"` (not preact/hooks), `lucide-react` (not lucide-preact)
- `Card` and `Button` from `@/components/ui-elements` (not shadcn ui/card, ui/button directly)
- toast from `@/components/ui/sonner`
- Local `apiFetch` defined inline in each page (no shared @/lib/api file)
