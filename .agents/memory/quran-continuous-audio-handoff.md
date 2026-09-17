---
name: Quran continuous audio handoff
description: Requirements for gap-free Quran playback across ayah boundaries
---

When pause is zero, chapter-scoped recitations must keep the same audio element and source playing while the active ayah timing advances. Prefetch the next timing and allow an in-flight timing request to finish without pausing or unmounting audio. Ayah-scoped recordings should preload the next file.

The app-root Quran audio host owns the persistent media element and enough session state to continue ayah-scoped and chapter-scoped playback across SPA route changes and surah boundaries. Media Session provides supported mobile browsers with lock-screen controls, but the operating system may still suspend a browser in the background.

**Why:** Treating every ayah boundary like a source change caused all reciters to stop briefly, even though most chapter recordings are already continuous. Clearing the source while timing data loaded made the gap worse.

**How to apply:** Any Quran player change must distinguish chapter-audio timing handoffs from real source changes and explicit user pauses. Never move the media element or off-route continuation state back into a route-owned reader component.