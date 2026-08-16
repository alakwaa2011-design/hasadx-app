---
name: Credit hold idempotency races
description: Lessons from making CreditService.hold safe under concurrent/replayed idempotency keys
---
Rule: idempotency for credit holds needs THREE layers — (1) fast-path SELECT by requestId, (2) re-check under the account row lock inside the transaction (loser of a race at exactly-one-price balance otherwise sees "insufficient" after the winner deducts), (3) catch 23505 on the UNIQUE(request_id) insert (pg error code may be nested at err.cause.code with drizzle).

Terminal replays: hold() returns `existingStatus`; checkCredits handles replays by status — `completed` with a stored `credit_holds.result_json` snapshot (written atomically by capture(requestId, resultJson)) replays 200 with the exact stored body (no re-generation, no charge); `completed` without snapshot and `refunded` → 409 DUPLICATE_REQUEST; `pending` → 409 REQUEST_IN_PROGRESS (letting it through re-runs the generator unbilled since the hold is shared).

**Why:** architect review caught both races after a naive select-then-insert implementation passed happy-path tests; the concurrency test only exposes the lock-order race when the seeded balance covers exactly one operation.

**How to apply:** any new idempotent charge path should reuse CreditService.hold + checkCredits middleware; integration tests must include a concurrent-duplicate case at exactly-one-price balance and a replay-after-refund case.
