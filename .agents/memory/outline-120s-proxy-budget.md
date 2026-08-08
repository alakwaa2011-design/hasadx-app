---
name: Outline endpoint 120s proxy budget
description: Why sequential AI retries in one HTTP request abort at 120s and the time-budget pattern used
---

The rule: any synchronous endpoint that may make more than one sequential LLM call must track elapsed time and (a) skip retries unless the first call was fast (~30s), (b) pass a per-call SDK `timeout` derived from a ~110s in-process deadline.

**Why:** the platform proxy hard-aborts requests at exactly 120s (`request aborted`, responseTime 120000). A single sonnet/gpt-5 outline call takes 50-80s, so first call + corrective/JSON-repair retry always breached 120s even when each call succeeded. Also claude-tier truncated at max_tokens 4000 (full outline needs ~5.6k output tokens) making every first call invalid and forcing the fatal retry.

**How to apply:** in AI routes, look for retry/corrective-call loops; use the startedAt/RETRY_BUDGET_MS/remainingMs pattern from the presentations outline route. Diagnose truncation via stop_reason `max_tokens` / finish_reason `length`. User rejected background-job generation as a task — don't re-propose.
