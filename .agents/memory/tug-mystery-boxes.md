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

After a gift is selected, show the activation result briefly and dismiss the local picker automatically; do not require a separate Continue action.

**Why:** The gift should feel like an uninterrupted game event, not a second confirmation step that pauses the classroom round.

**How to apply:** Apply the effect immediately on selection, then close the owning team's picker automatically after its short reveal animation.

Tug of War uses the same continuous speed scoring as Wameeth: a correct answer earns 300–1000 base points from remaining time, plus the established streak bonus. Wrong answers always earn zero and exert no pull.

**Why:** Binary fast/slow bonuses made equally correct teams look tied and did not reliably reward the faster team.

**How to apply:** Keep board and device modes aligned. Derive rope pull from the speed-weighted correct-answer score, while preserving server authority in device mode and existing power-pull multipliers.