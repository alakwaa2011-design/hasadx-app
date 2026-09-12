---
name: Listening-script generation pricing
description: Credit-policy boundary for AI-generated scripts inside listening activities.
---

AI listening-script generation and regeneration cost 2 credits per successful operation. They use the teacher's existing AI tier, record provider usage, and use a dedicated pricing key.

**Why:** The user explicitly approved a 2-credit price. A dedicated price prevents this operation from inheriting lesson-plan or whiteboard billing.

**How to apply:** Keep the endpoint connected to the standard hold, capture, refund, and idempotency flow. Every explicit regeneration is a new paid operation; failures must refund.