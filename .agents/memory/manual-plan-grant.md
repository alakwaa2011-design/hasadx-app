---
name: Manual plan grant race safety
description: Why manual admin plan grants can't reuse grantSubscriptionCredits directly
---

`CreditService.grantSubscriptionCredits` reads `monthly_credits` from the teacher's **currently stored** subscription (join via subscriptions), not from its `planCode` argument. A manual admin grant that upserts the subscription outside the credit transaction creates a race: concurrent grants can fund a Basic batch with Pro credits, and duplicate retries can mutate subscription dates after "alreadyGranted".

**Rule:** manual grants go through `CreditService.grantManualPlan` — one transaction: claim unique `subscription_invoice_id` (`manual_plan_grant_<clientUuid>`) → lockAccount → subscription upsert → credits computed from the **requested plan row** → batch/tx/aggregate writes. Replay returns the persisted grant row, never request-derived data.

**How to apply:** any new admin path that changes a teacher's plan AND grants subscription credits must reuse grantManualPlan or the same single-transaction pattern. Client supplies the idempotency UUID (generated once per dialog open) so double-clicks are no-ops.
