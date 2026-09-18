---
name: Quran continuous audio handoff
description: Requirements for gap-free Quran playback across ayah boundaries
---

When pause is zero, chapter-scoped recitations must keep the same audio element and source playing while the active ayah timing advances. Prefetch the next timing and allow an in-flight timing request to finish without pausing or unmounting audio. Ayah-scoped recordings should preload the next file.

The app-root Quran audio host owns the persistent media element and enough session state to continue ayah-scoped and chapter-scoped playback across SPA route changes and surah boundaries. Media Session provides supported mobile browsers with lock-screen controls, but the operating system may still suspend a browser in the background.

Cross-surah handoff needs an explicit transition identity shared by the route, visible player, persistent host, and audio source. The host must seek the new source to its ayah start after `play()` succeeds and before publishing the new location; browsers can retain the previous source's `currentTime` across `src` replacement. A correct URL is insufficient: verify the player label, highlighted ayah, education panel, source, and media time. Same-page boundaries such as 112→113→114 are the strongest regression case.

**Why:** Treating every ayah boundary like a source change caused gaps. Separately, shared host/player ownership and a retained old media offset caused the new surah to appear at ayah 1 while playback started several seconds into its file and immediately skipped forward.

**How to apply:** Distinguish chapter-audio timing handoffs from real source changes and explicit pauses. Keep one provider-owned `ended` path, lock source transitions until real progress, and make route/player views adopt the provider's source instead of reloading it. Test 112:4→113:1 naturally in a real browser and sample the first 500ms in-page.