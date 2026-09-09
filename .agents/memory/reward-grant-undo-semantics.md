---
name: Reward grant undo semantics
description: Safety and reporting rules for undoing classroom reward grants.
---

Undo for a multi-student reward grant must reverse the entire grant batch in one transaction or reverse nothing. Retries must reuse one idempotency key.

**Why:** Per-student reversal requests can partially succeed and leave student balances inconsistent with the teacher's intent.

**How to apply:** Build instant undo on a server-side batch operation. Weekly recognition and fairness metrics must count only active grant rows whose original transaction has no reversal; do not derive recognition from net balance changes.