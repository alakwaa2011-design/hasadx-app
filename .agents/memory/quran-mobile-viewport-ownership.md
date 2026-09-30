---
name: Quran mobile viewport ownership
description: Layout rules that prevent clipped pages and exposed teacher navigation on rotated phones.
---

In portrait, the focused Quran route must be a fixed viewport flex column: the site header, a scrollable `min-height: 0` reader main, and an optional bottom dock. Never reserve permanent bottom padding for a dock that is closed. In paged mode, expand the 15 canonical rows to the available phone height instead of preserving a width-derived image aspect ratio; continuous mode keeps the original ratio. Use one seamless warm paper surface so a short page does not end in a false-looking blank block. In touch landscape on phones and tablets, the Mushaf owns the full viewport: hide reader chrome and show two complete interactive QCF pages side by side.

The portrait phone toolbar floats over the reader. Measure it after Quran loading completes and add a separate top spacer before the paper using the safe area plus toolbar height; never add that reserve to the Madani page's internal padding.

When a fixed guided-memorization card or bottom reader dock covers the lower page, add a measured flex spacer after the page so the reader becomes vertically scrollable. After the guided card is measured, opening it, resizing it, changing its stage, or changing its target ayah must scroll the target ayah into the readable region above the card. Never add dock height to the Madani page padding: that compresses all 15 rows into the upper part of the paper. Bottom padding on the reader is also insufficient because border-box sizing subtracts it from the content area instead of increasing scroll range.

**Why:** Giving the embedded Quran Center `100dvh` below an existing site header clipped its bottom lines. Sizing interactive QCF text from the full landscape width made words form vertical columns or merged rows. Constraining a single page to its portrait aspect ratio later left huge side gutters, while a 600px height cutoff excluded iPad landscape. The user subsequently clarified that two columns of the same page are unacceptable and expressly chose either uniform enlargement of a single page or two facing pages; two facing pages retain the original line order and fit better.

**How to apply:** Give the non-continuous portrait page the available content height and full width. Re-measure the compact toolbar when conditional loading finishes or its contents change, then place its reserve before the page. Render mobile bottom docks as overlays and append a measured spacer so users can scroll the page bottom above them. In touch landscape, force spread mode for phones and tablets, keep both pages interactive, fit their combined width between device safe edges, and cap the glyph size by viewport height to prevent clipped diacritics on short phones. Keep sufficient vertical paper padding for the first and last rows. Restore the prior layout after rotation and never navigate to a rotation-specific URL. Test both a short phone and a taller iPad, since height-only phone media rules miss the latter.

For the separate Expo reader, size the page from `useWindowDimensions`, not solely from the root view's `onLayout`.

**Why:** In the Expo web preview, resizing from portrait to landscape did not always fire the root layout callback; the Quran page retained portrait dimensions and was clipped outside the viewport.

**How to apply:** Use a window-dimensions subscription for orientation-responsive page geometry in React Native. Check a browser resize as well as a fresh landscape load; the latter alone will not expose stale dimensions.

In the separate Expo reader, reserve the landscape header's height before sizing the interactive page. Make the transparent header container pointer-transparent while keeping its actual buttons active.

**Why:** A short landscape preview placed the first line behind the visually transparent header; the word remained visible but taps were intercepted by its title/layout container.

**How to apply:** Test tapping a word in the first line of a full (15-line) page after rotation, not just a short opening page.