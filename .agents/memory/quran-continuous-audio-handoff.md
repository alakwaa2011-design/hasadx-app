---
name: Quran continuous audio handoff
description: Requirements for gap-free Quran playback across ayah boundaries
---

When pause is zero, chapter-scoped recitations must keep the same audio element and source playing while the active ayah timing advances. Prefetch the next timing and allow an in-flight timing request to finish without pausing or unmounting audio. Ayah-scoped recordings should preload the next file.

The app-root Quran audio host owns the persistent media element and enough session state to continue ayah-scoped and chapter-scoped playback across SPA route changes and surah boundaries. Media Session provides supported mobile browsers with lock-screen controls, but the operating system may still suspend a browser in the background.

Cross-surah handoff needs an explicit transition identity shared by the route, visible player, persistent host, and audio source. The host must seek the new source to its ayah start after `play()` succeeds and before publishing the new location; browsers can retain the previous source's `currentTime` across `src` replacement. A correct URL is insufficient: verify the player label, highlighted ayah, education panel, source, and media time. Same-page boundaries such as 112→113→114 are the strongest regression case.

An explicit “restart current ayah” action must use the active timing segment's `verseStartMs` when chapter audio is playing. Seeking the shared audio element to zero restarts the whole surah, not the selected ayah; standalone ayah files may still seek to zero.

The shared audio element's `loadedmetadata` listener must be registered before any effect can replace its `src` and call `load()`. Cached or fast media can emit metadata before a later effect attaches, leaving a selected ayah at time zero. Guard the seek by the expected source URL so stale timing cannot move a newer source.

For chapter recordings, a normal cross-surah handoff starts the next source at time zero so its recorded basmalah is heard. At-Tawbah is the exception and starts at the first ayah timing. Keep autoplay enabled on the reused media element for iOS Safari continuity.

**Why:** Treating every ayah boundary like a source change caused gaps. Separately, shared host/player ownership and media-event races caused chapter recordings to retain an old offset or start at zero instead of the selected ayah.

**How to apply:** Distinguish chapter-audio timing handoffs from real source changes and explicit pauses. Keep one provider-owned `ended` path, lock source transitions until real progress, and make route/player views adopt the provider's source instead of reloading it. Test 112:4→113:1 naturally in a real browser and sample the first 500ms in-page; also verify 8→9 does not insert a basmalah.