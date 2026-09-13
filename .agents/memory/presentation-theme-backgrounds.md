---
name: Presentation theme background precedence
description: Deck themes can appear ineffective when generated slides retain legacy solid background overrides.
---

Deck-wide presentation themes must clear legacy per-slide solid background overrides when the teacher applies a new theme; otherwise slideBgStyle correctly honors the override and the picker appears broken. Background images remain independent.

**Why:** Older and AI-generated decks stored a solid background on each slide, so changing the presentation theme updated the deck row but not the visible canvas.

**How to apply:** Keep explicit slide-background editing available, but make the “apply theme” action remove those solid overrides in the same undoable/autosaved slide mutation.