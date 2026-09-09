---
name: Reward class groups
description: Durable ownership and behavior rules for teacher-defined classroom reward groups.
---

Students may belong to multiple teacher-defined reward groups in the same class. Saving a group must atomically commit both its metadata and complete member set. Deleting a group removes only the organizational group and memberships; it must never alter student balances or reward history. Student-mode grants made after filtering by a group remain individual student transactions. Group-competition points are a separate, temporary team score and must never change any student's balance, ledger, or report.

**Why:** Groups support overlapping classroom roles and quick team competitions. Teachers need to reward a team during a live lesson without those competition points becoming personal rewards for its members.

**How to apply:** Keep groups scoped to one owned teacher class and validate every member against the student's canonical class assignment. Preserve the existing per-student flow in student mode, but route team-competition awards and resets only through the independent group score domain.