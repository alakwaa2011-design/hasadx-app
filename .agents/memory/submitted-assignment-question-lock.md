---
name: Submitted assignment question lock
description: Why assignment questions become immutable after the first student submission.
---

Once an assignment has student submissions, its question payload must not be modified. Metadata and delivery settings may still be saved without sending questions; changing questions requires duplicating the assignment.

**Why:** Deleting a question cascades into historical answers, while changing its text, options, answer, or points reinterprets existing evidence without recalculating submissions safely. The server must enforce the lock atomically with question mutation because a client warning alone is raceable.

**How to apply:** Any question-editing route must lock the assignment row, check for submissions in the same transaction, and return a conflict if one exists. Editing clients should offer a settings-only save and direct teachers to duplicate the assignment for question changes.