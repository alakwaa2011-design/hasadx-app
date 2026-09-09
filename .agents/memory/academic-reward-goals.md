---
name: Academic reward goals
description: Scope, precedence, and isolation rules for academic motivation goals.
---

An active individual goal overrides the active class goal for that student. Goal progress is computed from unreversed personal reward grants since the goal began, optionally filtered to one reward type. Progress and fairness must use the stable teacher-class identity, with the class-name snapshot only as a compatibility fallback for old transactions that lack the stable ID. Group competition scores never contribute.

**Why:** Students may move between classes, and classes may be renamed or recreated with the same name. Name-only matching leaks progress or fairness history across class boundaries. Group scores are intentionally temporary team competition data rather than personal academic evidence.

**How to apply:** Persist the stable class ID on every new manual or automatic reward transaction. For legacy rows without an ID, match the name only when the transaction is not older than the current class identity, and rename legacy snapshots atomically with the class. When adding goal summaries or student-facing progress, exclude reversed grants, preserve individual-over-class precedence, and keep group score tables outside all goal calculations.