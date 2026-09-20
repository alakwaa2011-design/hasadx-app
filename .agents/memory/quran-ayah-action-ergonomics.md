---
name: Quran ayah action ergonomics
description: Confirmed interaction model for ayah actions and recitation controls across phone and desktop.
---

Ayah-number tap opens the primary action surface. A light tap on Quran text stays silent, while a stationary long-press on a word pronounces that word. Copy, range copy, bookmark, playback, and tafsir remain together in a viewport-contained surface opened from the ayah marker.

The current reciter name and repeat value stay directly visible and interactive in the audio controller on phone and desktop; they should not be buried at the end of a generic settings list.

**Why:** The user wanted common ayah actions to stay discoverable from the number marker, but explicitly corrected word interaction so pronunciation happens only on deliberate long-press rather than a light tap.

**How to apply:** Keep light word taps silent. Use native touch handling for phone long-press, cancel it on pointer movement so page swipes stay safe, and keep all ayah action surfaces within the viewport.