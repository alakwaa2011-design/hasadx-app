---
name: Quran mobile viewport ownership
description: Layout rules that prevent clipped pages and exposed teacher navigation on rotated phones.
---

In portrait, the focused Quran route must be a fixed viewport flex column: the site header, a scrollable `min-height: 0` reader main, and an optional non-overlay dock. Never reserve permanent bottom padding for a dock that is closed. Use one seamless warm paper surface on phones so a short full page does not end in a false-looking blank block. In short landscape viewports, the Mushaf owns the full viewport: hide the site header, Quran Center sidebar, reader controls, docks, and navigation, then fit one complete Madani page within the viewport height.

**Why:** Giving the embedded Quran Center `100dvh` below an existing site header clipped its bottom lines. Letting the normal route use visible overflow plus fixed dock padding also hid final ayahs and left an erroneous-looking lower block. Rotation crossed responsive width breakpoints and exposed the desktop “Circles & Students” sidebar. Some browsers did not report a coarse pointer reliably after rotation.

**How to apply:** Keep portrait content and the optional audio/education dock as flex siblings; only the content scrolls. Base phone-landscape Mushaf behavior on landscape orientation plus a short viewport, not pointer type. Size the page to `100dvh` with automatic width capped at `100vw`, center it, and prevent page clipping or scrolling. Keep installed-app orientation unrestricted, and never navigate to a separate rotation-specific URL.