---
name: Quran mobile viewport ownership
description: Layout rules that prevent clipped pages and exposed teacher navigation on rotated phones.
---

In portrait, an embedded Quran surface inside the site layout must use only the viewport remaining after the site header. In short landscape viewports, the Mushaf owns the full viewport: hide the site header, Quran Center sidebar, reader controls, docks, and navigation, then fit one complete Madani page within the viewport height.

**Why:** Giving the embedded Quran Center `100dvh` below an existing site header clipped its bottom lines. Rotation also crossed responsive width breakpoints and exposed the desktop “Circles & Students” sidebar. Some browsers did not report a coarse pointer reliably after rotation.

**How to apply:** Base phone-landscape Mushaf behavior on landscape orientation plus a short viewport, not pointer type. Size the page to `100dvh` with automatic width capped at `100vw`, center it, and prevent page clipping or scrolling. Keep installed-app orientation unrestricted, and never navigate to a separate rotation-specific URL.