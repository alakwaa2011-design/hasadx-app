---
name: Public Quran delivery
description: Why the standalone Quran experience starts as an isolated public route rather than a separate deployable artifact.
---

The public Quran experience should remain an anonymous, distraction-free `/quran` surface inside the Hasaad web artifact for its first stage. Keep account state local to the device and exclude teacher, assignment, live-recitation, and administrative actions.

**Why:** The existing reader, audio behavior, Madani rendering, and large Mushaf asset set are still coupled to the Hasaad artifact. Copying them into a second artifact would split maintenance and duplicate large assets, while extracting every dependency before validating the public experience would delay delivery.

**How to apply:** Reuse the same reader implementation through explicit standalone adapters. If a separate domain or artifact is later required, first extract framework-neutral Quran logic and reusable UI into `lib/*` packages, then let both artifacts consume those packages and one canonical asset distribution.