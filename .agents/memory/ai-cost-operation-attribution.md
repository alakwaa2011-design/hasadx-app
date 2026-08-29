---
name: AI cost operation attribution
description: Rules for correlating multi-call AI provider usage with one credit operation across reporting periods.
---

An AI request can create several provider-call ledger rows but only one credit spend. Assign operation-level points and refund counts to the request's first ledger call across the full ledger, then apply the report date range.

**Why:** Ranking only the calls already inside a monthly range lets a request spanning midnight or month-end acquire a different “first” call in each report, duplicating the same spend across periods.

**How to apply:** Compute the per-teacher, per-request call rank before filtering by completion time. Sum provider-call tokens and cost per row, but count credit points and refunded operations only on rank one. Never invent a teacher owner for guest or system AI calls.