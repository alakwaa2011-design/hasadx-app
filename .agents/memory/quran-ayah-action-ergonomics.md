---
name: Quran ayah action ergonomics
description: Confirmed interaction model for ayah actions and recitation controls across phone and desktop.
---

Ayah-number tap opens the primary action surface. A single tap on a Quran word opens a compact action card for pronunciation, meaning, and translation. Copy, range copy, bookmark, playback, and tafsir remain together in a viewport-contained surface opened from the ayah marker.

The current reciter name and repeat value stay directly visible and interactive in the audio controller on phone and desktop; they should not be buried at the end of a generic settings list.

**Why:** The user explicitly replaced the long-press interaction with a one-tap word menu so pronunciation, translation, and meaning are immediately discoverable. Meaning and translation choices should appear only once, not repeat inside the result panel.

**How to apply:** Open the word card on one tap, suppress it when the gesture becomes a page swipe, and keep pronunciation as an explicit card action. Render meaning/translation results without repeating selector tabs.