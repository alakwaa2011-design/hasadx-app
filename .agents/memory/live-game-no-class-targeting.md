---
name: Live-game no-class targeting
description: Distinguishes unrestricted game links from assignment and all-class targeting.
---

At game launch, “بدون صف” is an explicit unrestricted override and must be distinct from “كل الصفوف”; it clears any class targeting inherited from the source assignment.

**Why:** Teachers may reuse a class-targeted assignment with another audience or share a public game link. Treating an empty selector as “no choice supplied” silently restores the assignment’s class.

**How to apply:** Preserve the distinction in every launch UI and payload. An explicit empty class array means unrestricted; omitting class selection may preserve inherited targeting. Games with no targeting support are already unrestricted.