---
name: Mobile chapter recitations
description: Why some verified Quran reciters require a timed chapter player in the mobile Mushaf.
---

Reader catalogs may omit the `available` field for valid provider voices; only `available: false` denotes a withheld recitation. A chapter-only voice cannot use the verse-audio redirect because that endpoint intentionally rejects its ID. Use the verified ayah timing response to seek within the official chapter recording and stop or advance at the ayah boundary. Keep the handful of known verse-file readers on their direct verse-audio path.

**Why:** Most official voices, including the Minshawi teacher/children-repeat recording, disappeared from the mobile picker under an `available === true` filter. Merely showing them would have exposed a playback action that returned an error, so visibility and timed playback must ship together.

**How to apply:** If adding or changing a mobile reciter, verify both its catalog status and the timing/audio contract on an early and a later ayah. Use a distinct chapter seek path for chapter-only IDs; never relabel a different recording as the teacher version. The public Abu Bakr chapter files are served from the app's storage origin, so their cross-origin media policy must stay limited to the reviewed audio paths, never private uploads.