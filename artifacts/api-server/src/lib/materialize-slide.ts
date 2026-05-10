/* AI Presentation Builder — Phase 1B materializer.
   Thin orchestrator around `@workspace/slide-templates`. Owns:
     • Theme palette resolution from a deck row.
     • Per-card materialization with try/catch so one bad card cannot
       fail the whole build (we fall back to a "concept-card" rendering).
     • Aggregating warnings + draft-friendly progress payload shapes. */

import {
  materializeSlide,
  paletteForTheme,
  type Density,
  type Lang,
  type MaterializedSlide,
  type OutlineCard,
} from "@workspace/slide-templates";

export interface BuildOneInput {
  card: OutlineCard;
  themeKey: string | null;
  density: Density;
  lang: Lang;
  /** When provided (image-import path), stamps the slide with this URL
      as `backgroundImage` and prepends a semi-transparent rect overlay
      so the AI-generated text layout remains readable over the photo.
      The overlay opacity (40 %) and colour (dark or light depending on
      the theme's `textOnLight` flag) are chosen automatically. */
  backgroundImageUrl?: string;
}

export interface BuildOneResult {
  slide: MaterializedSlide;
  warnings: string[];
}

export function buildOneSlide(input: BuildOneInput): BuildOneResult {
  const deckPalette = paletteForTheme(input.themeKey);
  /* Phase 4 — per-slide design intelligence.
     If the AI Director picked a `slideTheme` that differs from the
     deck-level theme, resolve a per-slide palette and stamp the slide
     with that theme's mesh gradient. The deck still has a single
     "primary" theme (used as the fallback and remembered in the editor
     so the teacher can re-skin), but each slide can wear its own
     editorial backdrop — exactly the variety the user complained was
     missing. When `slideTheme` is omitted/unknown the materializer
     uses the deck palette and leaves `slide.background` empty so the
     renderer paints the deck gradient as before. */
  const slideThemeKey = input.card.slideTheme ?? null;
  const usePerSlide = !!slideThemeKey && slideThemeKey !== input.themeKey;
  const palette = usePerSlide ? paletteForTheme(slideThemeKey) : deckPalette;
  try {
    const out = materializeSlide({
      card: input.card,
      theme: palette,
      density: input.density,
      lang: input.lang,
    });
    /* Stamp the per-slide background only when actually overriding so
       we don't bloat every slide row with a duplicate of the deck
       gradient. Renderer (`slideBgStyle`) already falls back to the
       deck cssGrad when `slide.background` is empty. */
    if (usePerSlide && palette.cssGrad) {
      out.slide.background = palette.cssGrad;
    }
    /* Image-import path: attach the source photo as a full-bleed
       background and insert a semi-transparent rect overlay at z-order 0
       so the AI-generated text layout stays readable over the photo.
       Overlay colour adapts to the theme's text-on-light flag:
         dark themes (light text) → black-tinted overlay
         light themes (dark text) → white-tinted overlay            */
    if (input.backgroundImageUrl) {
      out.slide.backgroundImage = input.backgroundImageUrl;
      const overlayColor = palette.textOnLight
        ? "rgba(255,255,255,0.55)"
        : "rgba(0,0,0,0.40)";
      out.slide.elements.unshift({
        id: `${out.slide.id}-bg-overlay`,
        kind: "shape",
        shape: "rect",
        x: 0, y: 0, w: 1280, h: 720,
        bgColor: overlayColor,
      });
    }
    return { slide: out.slide, warnings: out.warnings };
  } catch (err) {
    /* Fallback: emit a minimal title-only slide so the deck can still
       open in the editor. The teacher sees a warning explaining the
       slot is empty and can re-author by hand. */
    const msg = err instanceof Error ? err.message : "unknown";
    return {
      slide: {
        id: `s${input.card.index}`,
        layout: input.card.kind,
        notes: input.card.purpose,
        elements: [
          {
            id: `s${input.card.index}-fallback-title`,
            kind: "text",
            x: 80, y: 240, w: 1120, h: 120,
            text: input.card.title,
            fontSize: 48,
            fontWeight: "700",
            align: "start",
            color: palette.fg,
          },
        ],
      },
      warnings: [
        input.lang === "ar"
          ? `تعذّر بناء الشريحة ${input.card.index}: ${msg}`
          : `Slide ${input.card.index} could not be built: ${msg}`,
      ],
    };
  }
}
