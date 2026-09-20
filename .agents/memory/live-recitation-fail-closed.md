---
name: Live recitation fail-closed
description: Release rule for exposing the Hafiz-backed direct Quran recitation experience.
---

The direct recitation entry point must stay hidden unless the Hafiz-backed service has a positively confirmed availability signal. A configured key or a previously successful session is not enough to assume current availability.

**Why:** The owner explicitly asked that users not see the feature while the service is unavailable.

**How to apply:** Default every reader surface to unavailable and make the shared reader consume a real readiness value. Re-enable discovery only after the existing real-voice verification work confirms the service and a trustworthy readiness signal is wired through.