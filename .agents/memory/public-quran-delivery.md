---
name: Public Quran delivery
description: Why the standalone Quran experience starts as an isolated public route rather than a separate deployable artifact.
---

The public Quran experience should remain an anonymous, distraction-free `/quran` surface inside the Hasaad web artifact for its first stage. Keep account state local to the device and exclude teacher, assignment, live-recitation, and administrative actions.

**Why:** The existing reader, audio behavior, Madani rendering, and large Mushaf asset set are still coupled to the Hasaad artifact. Copying them into a second artifact would split maintenance and duplicate large assets, while extracting every dependency before validating the public experience would delay delivery.

**How to apply:** Reuse the same reader implementation through explicit standalone adapters. Teacher-facing installation links must open the public Quran route, not an authenticated teacher reader; installation is initiated by the browser on desktop or phone rather than by downloading an APK. If a separate domain or artifact is later required, first extract framework-neutral Quran logic and reusable UI into `lib/*` packages, then let both artifacts consume those packages and one canonical asset distribution.

The public Mushaf must be a separately installable PWA even when Hasaad is installed: keep its manifest ID distinct, provide genuine 192- and 512-pixel derivatives of the approved icon without changing the source, and serve the Quran manifest in the **initial HTML** response. Detecting standalone display mode alone cannot prove which of the two apps owns the window; an install link opened from the teacher app needs browser-opening guidance.

**Why:** Desktop Chromium requires both declared icon sizes; the original large square icon alone did not qualify. Vite's SPA fallback may transform the entry as `/index.html` even for a deep URL, so a path check only inside `transformIndexHtml` left the main app manifest in the first response. Runtime React metadata changes cannot guarantee the browser has not already evaluated that manifest.

**How to apply:** Verify the unhydrated response for a direct Quran URL in both development and production, including manifest ID and icons, before judging installability. Avoid broadening or moving the main platform's `/` PWA scope merely to fix this; it would affect other existing routes.

For future product scoping, prioritize a personal memorization-and-review plan in the anonymous Mushaf: a chosen ayah range and daily goal, resuming the exact guided step, and a saved daily review list based on self-assessment. Self-recording and playback for comparison come next; automated recitation correction should wait until accuracy and privacy are verified.

**Why:** The owner confirmed this as the key gap to retain while evaluating upcoming feedback. Guided practice already exists, but the public Mushaf does not turn its assessment into a durable daily review journey; claiming automated accuracy before validation risks misleading readers.

**How to apply:** Compare future Quran feature proposals and reports with this priority order. Keep anonymous progress local unless the user opts into account sync, and distinguish personal self-assessment from teacher-approved mastery.