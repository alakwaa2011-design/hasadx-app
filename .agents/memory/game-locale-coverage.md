---
name: Game locale coverage
description: Defines what must change when Arabic/English is switched inside educational games.
---

The selected interface language must update both the surrounding game interface and built-in gameplay data such as default color words, team names, instructions, results, and game branding.

**Why:** Translating menus alone leaves parts of the game itself in Arabic, especially word/color challenges, even while the application is in English.

**How to apply:** Derive built-in labels and default datasets from the live locale so they update in both directions without reloading. Preserve teacher-authored questions, categories, custom sets, and imported content exactly as written.