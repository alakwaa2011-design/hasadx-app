---
name: Guided Quran overlay stacking
description: Why guided memorization and the reciter menu need coordinated positioning and stacking
---

The guided memorization panel should stay above the ordinary audio dock, but the dock must rise above it while the player's settings or repeat menu is open. Keep the panel clear of the dock so the settings trigger remains touchable even before the menu opens.

**Why:** A popover's own z-index cannot escape its dock parent's stacking context. Permanently raising the dock would instead block the guided panel; lowering the guided panel alone would leave its controls obscured.

**How to apply:** When adding a floating control to the Quran audio player during guided practice, coordinate the dock's temporary stacking priority with the control's open state and account for the dock height in the guided panel placement.