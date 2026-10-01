---
name: Worksheet Word fidelity
description: Arabic shaping, brand transparency, and the limits of native editable Word verification.
---

Rasterize Arabic worksheets using native browser rendering, not a per-glyph canvas recreation. Preserve the rendered page's resolved styles and pseudo-elements at unscaled A4 dimensions, and inline images before rendering.

**Why:** A successful download with nonblank images still contained corrupted connected Arabic letters and a distorted watermark. Image dimensions and nonblank-pixel checks alone did not establish visual fidelity. An unrelated preview font can also keep browser-wide font readiness pending and stall an export before its first render request.

**How to apply:** Inspect actual exported page images containing Arabic headings and subtitles, not just the source preview. Bound waits for preview-side font readiness; the native renderer must load its own worksheet fonts and fail explicitly if a required resource is unavailable. Keep any submitted-HTML renderer isolated from trusted PDF export sessions and prohibit scripts and arbitrary outbound resources.

Native editable Word conversion must resolve styles while the source or clone is connected to the document. Use logical leading alignment for RTL paragraphs, with separately directed math/English runs.

**Why:** Detached clones lose computed stylesheet formatting in Chromium. OOXML direction/alignment checks establish document structure, but do not establish identical rendering in Mac Word or prove that the requested fonts are installed there.

**How to apply:** Test the real download path, including stylesheet-only title centering, colors, fonts, and each theme's student-field row (not only the classic stylesheet's row). Do not describe editable Word as pixel-identical to the browser; native tables and paragraphs reflow differently across Word clients.

Use transparent official brand artwork on worksheet backgrounds, but do not replace or recolor a school's custom uploaded logo.

**Why:** The official dark-background lockup produced an opaque rectangle against themed paper. Transparency can preserve the approved artwork without changing the school's branding.