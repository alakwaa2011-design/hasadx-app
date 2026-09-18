---
name: Quran continuous audio handoff
description: Requirements for gap-free Quran playback across ayah boundaries
---

When pause is zero, chapter-scoped recitations must keep the same audio element and source playing while the active ayah timing advances. Prefetch the next timing and allow an in-flight timing request to finish without pausing or unmounting audio. Ayah-scoped recordings should preload the next file.

The app-root Quran audio host owns the persistent media element and enough session state to continue ayah-scoped and chapter-scoped playback across SPA route changes and surah boundaries. Media Session provides supported mobile browsers with lock-screen controls, but the operating system may still suspend a browser in the background.

Cross-surah handoff needs an explicit transition identity shared by the route, visible player, persistent host, and audio source. A correct URL is insufficient: verify the player label, highlighted ayah, and education panel remain on ayah 1. Same-page boundaries such as 112→113→114 are the strongest regression case.

**Why:** Treating every ayah boundary like a source change caused gaps. Separately, browser `ended` activity during a real source change can reach shared host/player logic after SPA state updates and incorrectly advance the new surah beyond ayah 1.

**How to apply:** Distinguish chapter-audio timing handoffs from real source changes and explicit pauses. Never move the persistent media element back into a route-owned component. For cross-surah changes, use one owner and one transition identity rather than independent route/player/host guards, then test 112:4→113:1 in a real browser.