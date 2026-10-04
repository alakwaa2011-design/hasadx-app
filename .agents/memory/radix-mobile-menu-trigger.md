---
name: Mobile menu pointer-up actions
description: Collision-adjusted menus can accidentally select an action while opening on a pressed pointer.
---

Menus offering exports or other consequential actions must not open beneath a pointer that is still pressed. Opening the menu must never start an action.

**Why:** In the mobile worksheet Word flow, opening an upward/collision-adjusted Radix menu unintentionally started another visual export. The resulting disabled choices looked like a stuck busy flag, but a fresh capture was already running.

**How to apply:** For affected triggers, defer opening until click/pointer-up rather than Radix's default pointer-down, preserve keyboard activation, and close the menu explicitly when an action is selected. Verify repeated open/Escape cycles issue no action requests before an explicit selection.