---
name: Pending recitation release gates
description: Release controls for custom Quran recitations awaiting rights and timing verification
---

An unverified custom recitation must be marked unavailable in the catalog, omitted from anonymous catalogs, rejected by anonymous timing and audio endpoints, and excluded from saved preferences. Authenticated Quran reader sessions may inspect it while verification is pending.

**Why:** Hiding an item in the picker is not sufficient; a caller who knows an internal recitation ID could otherwise stream the sample or request its timing contract directly.

**How to apply:** Keep the availability state in the reciter response contract and enforce the same gate in catalog, preference, timing, and audio route logic. Remove the gate only after rights and timing QA are recorded.

The approval method must also be explicit. Automated acoustic and semantic audio review may replace a planned human review only when the owner expressly accepts that substitution; record reviewed chapter/boundary counts and preserve any corrected overrides.

**Why:** Silence-based alignment can select internal pauses while still passing structural checks, so release evidence must distinguish automatic alignment from semantic audio review and owner approval.

**How to apply:** For custom recitations, retain reproducible review tooling and reviewed boundary overrides, and verify the published manifest through the anonymous API before removing the release gate.