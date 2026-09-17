---
name: Hasaad Guide verified knowledge
description: Grounding and cache rules for administrator-managed Hasaad Guide knowledge.
---

Administrator-saved content is approved platform knowledge, not merely tone guidance. Platform procedures may use only explicitly documented routes, prerequisites, labels, and ordered steps; missing steps must never be inferred.

**Why:** The former editor claimed to accept facts but the prompt classified them as style-only, and first-turn caches ignored later admin updates. This made saved information ineffective and allowed stale or improvised answers.

**How to apply:** Include saved admin knowledge in the authoritative grounding set and in the cache-version hash. If approved sources describe a feature without a complete procedure, return the support fallback instead of completing it generatively.