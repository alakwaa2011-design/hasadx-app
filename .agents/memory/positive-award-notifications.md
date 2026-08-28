---
name: Positive-only award notifications
description: Product rule for teacher email and in-app notifications after admin credit and plan changes.
---

Teacher-facing email and in-app award notifications must be celebratory and sent only when an admin gives something: a positive credit increase, a plan grant/upgrade, or enabling unlimited access. Do not send them for deductions, setting a lower balance, disabling unlimited access, removing a plan, or downgrading Pro to Basic.

**Why:** The user wants these messages to feel like good news and explicitly does not want negative administrative changes presented through the award-notification channel.

**How to apply:** Gate every current and future admin credit/plan notification on the actual positive outcome after the transaction commits. Preserve idempotency so retries that grant nothing do not create duplicate notifications.