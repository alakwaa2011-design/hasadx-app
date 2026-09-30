---
name: Manual Quran reader appearance
description: Ensure the reader's explicit day, warm, or night setting governs nested reader controls and Quran contrast.
---

The reader's saved appearance choice is authoritative for its entire UI subtree. A night choice must switch both the page and all nested sheets/controls to the dark palette, while day and warm must remain light even if the device follows dark system appearance. The Quran paper and glyph ink must switch together to preserve contrast; image pages can retain their original raster colors.

**Why:** An earlier night setting darkened only the root surface while nested components continued to use the OS color scheme. On a light-system device, the setting appeared selected but the reader and sheets remained cream/olive.

**How to apply:** When adding reader UI, consume the shared appearance-aware palette rather than looking at the device color scheme independently. Check the reading page, an action sheet, and the verse glyphs together in both night and day modes.