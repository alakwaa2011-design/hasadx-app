---
name: Quran guided pause preference
description: The guided memorization audio flow must respect the teacher's selected pause between ayahs
---

The pause between ayahs is a user preference. Guided memorization may set its range and repeat behavior, but it must not overwrite `pauseSeconds`; `0` means advance immediately.

**Why:** A guided-session initializer previously forced a one-second pause at startup and again when the first stage rerendered, so choosing zero had no effect.

**How to apply:** When adding or changing guided-recitation entry points, preserve the existing session pause value unless the user explicitly chooses a new one.