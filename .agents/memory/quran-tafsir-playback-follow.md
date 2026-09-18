---
name: Quran tafsir playback follow
description: How the education panel follows Quran audio and how users pause that behavior.
---

When Quran audio advances to a new ayah, the education panel should open or update to that ayah's sourced tafsir. A visible lock control freezes the current tafsir while playback continues; unlocking immediately resumes following the currently playing ayah.

**Why:** The user wants tafsir to move with recitation but also needs a deliberate way to keep reading one explanation without audio navigation replacing it.

**How to apply:** Drive the automatic education selection from playing verse identity and playback state. Do not auto-follow during guided memorization. Closing the panel leaves it closed until playback advances; closing the audio player clears the lock.