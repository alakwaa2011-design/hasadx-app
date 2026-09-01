---
name: Tug mystery boxes
description: Durable gameplay semantics shared by board and device modes for Tug of War gifts.
---

Mystery boxes belong to teams, not individual players. The supported effects are power pull, opponent freeze, five-second time boost, and a shield that absorbs the next freeze.

**Why:** Team ownership keeps gifts understandable on a shared classroom board and prevents device-mode clients from independently applying conflicting effects.

**How to apply:** Keep device mode authoritative on the Socket.IO server, including inventory, deadlines, and effect consumption. Board mode may use its pure local reducer, but should preserve the same names and outcomes.

On the shared classroom board, render each team's mystery picker inside that team's dugout rather than as a viewport-wide modal, so the opposing side remains visible and playable.

**Why:** A full-screen picker stops both classroom groups and hides the live match; a side-local picker matches the physical layout of the board.

**How to apply:** Keep the picker positioned relative to the owning TeamZone and preserve independent open/pick/dismiss state for blue and red.