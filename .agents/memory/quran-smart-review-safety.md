---
name: Quran smart review safety
description: Durable correctness rules for guided Quran assessment and spaced-review sessions.
---

Every student assessment must carry a stable request ID until its outcome is confirmed. Store an account-scoped receipt and serialize transitions for the same verse so retries or concurrent devices cannot advance the interval twice.

**Why:** A successful response can be lost in transit. Generating a new ID for the retry would turn one assessment into two progress transitions and schedule the verse too far in the future.

**How to apply:** Keep the request ID stable across client retries, calculate status and interval only on the server, and return the original result for receipt replays.

A “today’s reviews” session advances through the server-provided due items, not adjacent Quran verses. Date-only review schedules use the named Quran calendar policy consistently in assessment, due queries, summaries, and tests.

**Why:** Moving to the next numeric verse can silently schedule an item that was not due, while skipping a due verse in another surah. UTC date slicing also changes the user’s review day around local midnight.

**How to apply:** Preserve due-queue identity across navigation, remove each confirmed item from the queue, and keep calendar-day calculations behind one explicit helper.

When assessment history is introduced after current progress already exists, create one idempotent baseline event for each item with no history.

**Why:** Otherwise teachers see a current status and last-assessed timestamp but an empty history, which makes old progress appear incomplete.

**How to apply:** Backfill only items with no history, use a deterministic per-item request ID, and preserve the current status, interval, next-review date, and last-assessed time.