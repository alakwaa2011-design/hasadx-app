---
name: Outline endpoint 120s proxy budget
description: Why sequential AI retries in one HTTP request abort at 120s and the time-budget pattern used
---

The rule: any synchronous endpoint that may make sequential LLM calls must track elapsed time and pass per-call SDK timeouts from a sub-120s deadline with provider `maxRetries: 0`. A cross-provider fallback is not a quality retry: if enough time remains, it may still need one corrective pass.

**Why:** the platform proxy hard-aborts requests at exactly 120s (`request aborted`, responseTime 120000). SDK timeouts apply per attempt, so their default transient retries can also cross that boundary. A single sonnet/gpt-5 outline call takes 50-80s, so first call + corrective/JSON-repair retry breaches 120s. Also claude-tier truncated at max_tokens 4000 (full outline needs ~5.6k output tokens), making every first call invalid and forcing the fatal retry.

**How to apply:** in AI routes, look for explicit retry loops and SDK defaults; use deadline/remaining-time checks, disable provider retries, and leave time for fallback, correction, refund, and serialization. If valid completion can require several provider attempts beyond the proxy budget, move it to a durable background job with owned polling, idempotent recovery, fenced claims, and credit-hold renewal instead of extending the HTTP request. Keep provider-fallback state separate from JSON/quality-retry state. Once a provider times out and the fallback returns a usable outline, send JSON/quality repairs to that successful fallback provider rather than retrying the timed-out provider. Quick creation should try to correct quality-only failures, then preserve a structurally complete editable outline rather than return nothing; true missing content stays blocking. Diagnose truncation via stop_reason `max_tokens` / finish_reason `length`.
