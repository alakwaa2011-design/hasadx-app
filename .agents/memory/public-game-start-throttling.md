---
name: Public game start throttling
description: Durable distributed rate-limit rules for public links that create isolated game rooms.
---

Public direct-play room creation must use an atomic PostgreSQL-backed limit keyed by the durable public link token. Do not use process memory or caller IP headers.

**Why:** Multiple server instances and restarts make in-memory counters ineffective, while proxy headers can be rotated or misattributed. Existing rooms and temporary join links must remain unaffected.

**How to apply:** Apply the limit only when a verified public link requests creation of a new isolated room. Return a clear wait duration and `Retry-After` when blocked.