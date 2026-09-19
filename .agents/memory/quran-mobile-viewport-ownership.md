---
name: Quran mobile viewport ownership
description: Layout rules that prevent clipped pages and exposed teacher navigation on rotated phones.
---

In portrait, the focused Quran route must be a fixed viewport flex column: the site header, a scrollable `min-height: 0` reader main, and an optional bottom dock. Never reserve permanent bottom padding for a dock that is closed. In paged mode, expand the 15 canonical rows to the available phone height instead of preserving a width-derived image aspect ratio; continuous mode keeps the original ratio. Use one seamless warm paper surface so a short page does not end in a false-looking blank block. In short landscape viewports, the Mushaf owns the full viewport: hide the site header, Quran Center sidebar, reader controls, docks, and navigation, then reflow the complete 15-row Madani page across the landscape viewport.

The portrait phone toolbar floats inside the page's reserved top margin rather than consuming a separate row. Offset it by the top safe area, and increase the Madani content's top padding by the same safe area plus the toolbar height so controls stay visible without covering the first Quran row.

When a fixed guided-memorization card or bottom reader dock covers the lower page, add a measured flex spacer after the page so the reader becomes vertically scrollable. Bottom padding on the reader is insufficient because border-box sizing subtracts it from the content area instead of increasing scroll range.

**Why:** Giving the embedded Quran Center `100dvh` below an existing site header clipped its bottom lines. Width-based QCF font sizing in a landscape page made glyphs huge, merged adjacent rows, and pushed the page bottom off-screen. Rotation also crossed responsive width breakpoints and exposed desktop chrome.

**How to apply:** Give the non-continuous portrait page the available content height and full width, with the compact toolbar floating over its reserved top margin. Render mobile bottom docks as overlays and append a measured spacer so users can scroll the page bottom above them. Base phone-landscape behavior on landscape orientation plus a short viewport, not pointer type. In landscape, disable the portrait aspect ratio, fill `100vw × 100dvh`, and cap QCF row and basmala font sizes by `dvh` rather than width so all 15 rows remain distinct and visible. Keep installed-app orientation unrestricted and never navigate to a rotation-specific URL.