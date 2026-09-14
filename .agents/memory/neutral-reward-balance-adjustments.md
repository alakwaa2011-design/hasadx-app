---
name: Neutral reward balance adjustments
description: Product and safety rules for reducing a student's classroom reward balance.
---

Treat reductions as neutral “balance adjustments,” not punishment or loss. Show the teacher an optional reason field, the projected new balance, and a calm success message with the updated total. Never block a student or class deduction because the reason is blank. Do not use sadness, crying, loss celebrations, or negative sound effects.

**Why:** The reward experience should stay encouraging and professional even when a teacher needs to correct an accidental grant or record a classroom adjustment.

**How to apply:** Keep every adjustment owner-scoped, idempotent, audited, and serialized with grant reversals. Never allow an adjustment or later reversal to take the student's total below zero.