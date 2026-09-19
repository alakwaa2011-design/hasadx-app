---
name: Pending recitation release gates
description: Release controls for custom Quran recitations awaiting rights and timing verification
---

An unverified custom recitation must be marked unavailable in the catalog, omitted from anonymous catalogs, rejected by anonymous timing and audio endpoints, and excluded from saved preferences. Authenticated Quran reader sessions may inspect it while verification is pending.

**Why:** Hiding an item in the picker is not sufficient; a caller who knows an internal recitation ID could otherwise stream the sample or request its timing contract directly.

**How to apply:** Keep the availability state in the reciter response contract and enforce the same gate in catalog, preference, timing, and audio route logic. Remove the gate only after rights and timing QA are recorded.