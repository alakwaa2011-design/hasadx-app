---
name: Quran ayah action ergonomics
description: Confirmed interaction model for ayah actions and recitation controls across phone and desktop.
---

Ayah-number tap opens the primary action surface. A light tap on Quran text stays silent, while a stationary moderate hold on a word opens a compact action card for pronunciation, meaning, and translation. Copy, range copy, bookmark, playback, and tafsir remain together in a viewport-contained surface opened from the ayah marker.

The current reciter name and repeat value stay directly visible and interactive in the audio controller on phone and desktop; they should not be buried at the end of a generic settings list.

**Why:** The user wanted common ayah actions to stay discoverable from the number marker, but corrected word interaction so a quick tap does not trigger actions and a prolonged hold is unnecessary. Meaning and translation choices should appear only once, not repeat inside the result panel.

**How to apply:** Keep light word taps silent. Open the word card after roughly 320 ms, cancel on pointer movement so page swipes stay safe, and keep pronunciation as an explicit card action. Render meaning/translation results without repeating selector tabs.