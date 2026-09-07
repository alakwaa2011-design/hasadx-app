---
name: Kids adult controls
description: Security boundary for adult-only controls and child progress in Hasaad Kids.
---

Adult-only Kids controls and detailed progress must live on the authenticated, roster-scoped teacher surface. Never use a fixed or solvable trivia question as an authorization boundary.

**Why:** A child can answer or discover a static challenge, so it cannot protect settings or progress. Inactive controls and hard-coded metrics also create misleading safety and progress claims.

**How to apply:** Keep the child UI limited to child-safe actions. Route any adult entry point to teacher authentication, enforce ownership on the server, and show only persisted data.