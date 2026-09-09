---
name: Reward class groups
description: Durable ownership and behavior rules for teacher-defined classroom reward groups.
---

Students may belong to multiple teacher-defined reward groups in the same class. Saving a group must atomically commit both its metadata and complete member set. Deleting a group removes only the organizational group and memberships; it must never alter student balances or reward history. Group rewards remain individual student transactions through the existing grant system.

**Why:** Groups support overlapping classroom roles such as reading teams and class leaders. They organize selection rather than becoming a separate balance or reward ledger.

**How to apply:** Keep groups scoped to one owned teacher class, validate every member against the student's canonical class assignment, and translate group selection into the existing per-student grant flow.