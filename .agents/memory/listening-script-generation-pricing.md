---
name: Listening-script generation pricing
description: Credit-policy boundary for AI-generated scripts inside listening activities.
---

AI listening-script generation must use the teacher's existing AI tier and record provider usage, but it must not borrow another tool's credit price or deduct credits until a dedicated price is approved.

**Why:** No operation-specific cost was defined, and silently charging the lesson-plan or whiteboard price would create an unapproved billing policy.

**How to apply:** When pricing is approved, add a dedicated tool key and connect the existing endpoint to the standard hold, capture, refund, and idempotency flow. Until then, keep provider usage tracking and rate limiting active without credit holds.