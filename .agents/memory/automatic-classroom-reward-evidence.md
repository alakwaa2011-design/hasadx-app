---
name: Automatic classroom reward evidence
description: Trust and isolation rules for granting classroom rewards from assignments, games, and kids activities.
---

Automatic classroom rewards may consume only final, server-persisted evidence tied to a verified `students.id`. Client IDs, display names, and OCR/name matching are not identity proof. Keep reward receipts and reversals independent from the source result and from every other score or currency.

**Why:** Automatic retries and concurrent source saves can otherwise duplicate grants, while name-derived identity can reward the wrong learner. Coupling the reward ledger to grades, game rankings, XP, credits, or kids stars would also make reversal unsafe.

**How to apply:** Persist source evidence and its evaluation atomically, enforce a database-backed source identity, use per-rule/source/student idempotency, and evaluate replay from the canonical persisted record. Require authenticated account linkage or explicit teacher confirmation before assignment evidence is eligible. For live games, use an immutable run ID rather than a reusable join code, coordinate the full save (including legacy score side effects) by that run ID, and never transfer accumulated evidence between guest and authenticated identities.