---
name: Outline endpoint 120s proxy budget
description: Why sequential AI retries in one HTTP request abort at 120s and the time-budget pattern used
---

The rule: any synchronous endpoint that may make more than one sequential LLM call must track elapsed time, skip quality retries unless the first call was fast (~30s), and pass a per-call SDK timeout from a sub-120s deadline with provider `maxRetries: 0`. For Claude outlines, reserve part of that deadline for a fast cross-provider fallback when the primary call stalls.

**Why:** the platform proxy hard-aborts requests at exactly 120s (`request aborted`, responseTime 120000). SDK timeouts apply per attempt, so their default transient retries can also cross that boundary. A single sonnet/gpt-5 outline call takes 50-80s, so first call + corrective/JSON-repair retry breaches 120s. Also claude-tier truncated at max_tokens 4000 (full outline needs ~5.6k output tokens), making every first call invalid and forcing the fatal retry.

**How to apply:** in AI routes, look for both explicit retry loops and SDK defaults; use a deadline/remaining-time pattern, disable provider retries, and leave time for a fallback plus refund/serialization. A provider timeout near the route deadline must not consume the fallback budget. Diagnose truncation via stop_reason `max_tokens` / finish_reason `length`. User rejected background-job generation as a task — don't re-propose.
