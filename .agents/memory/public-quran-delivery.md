---
name: Public Quran delivery
description: Why the standalone Quran experience starts as an isolated public route rather than a separate deployable artifact.
---

The public Quran experience should remain an anonymous, distraction-free `/quran` surface inside the Hasaad web artifact for its first stage. Keep account state local to the device and exclude teacher, assignment, live-recitation, and administrative actions.

**Why:** The existing reader, audio behavior, Madani rendering, and large Mushaf asset set are still coupled to the Hasaad artifact. Copying them into a second artifact would split maintenance and duplicate large assets, while extracting every dependency before validating the public experience would delay delivery.

**How to apply:** Reuse the same reader implementation through explicit standalone adapters. If a separate domain or artifact is later required, first extract framework-neutral Quran logic and reusable UI into `lib/*` packages, then let both artifacts consume those packages and one canonical asset distribution.

For future product scoping, prioritize a personal memorization-and-review plan in the anonymous Mushaf: a chosen ayah range and daily goal, resuming the exact guided step, and a saved daily review list based on self-assessment. Self-recording and playback for comparison come next; automated recitation correction should wait until accuracy and privacy are verified.

**Why:** The owner confirmed this as the key gap to retain while evaluating upcoming feedback. Guided practice already exists, but the public Mushaf does not turn its assessment into a durable daily review journey; claiming automated accuracy before validation risks misleading readers.

**How to apply:** Compare future Quran feature proposals and reports with this priority order. Keep anonymous progress local unless the user opts into account sync, and distinguish personal self-assessment from teacher-approved mastery.