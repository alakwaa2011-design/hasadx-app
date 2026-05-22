/* AI Presentation Builder — Phase 1B materializer.
   Thin orchestrator around `@workspace/slide-templates`. Owns:
     • Theme palette resolution from a deck row.
     • Per-card materialization with try/catch so one bad card cannot
       fail the whole build (we fall back to a "concept-card" rendering).
     • Aggregating warnings + draft-friendly progress payload shapes.
     • Inline web-image injection on a side column for content slides
       (so imports look editorial, not just text on gradient).
     • A small post-pass that bumps body font sizes for readability. */

import {
  materializeSlide,
  paletteForTheme,
  type Density,
  type Element,
  type Lang,
  type MaterializedSlide,
  type OutlineCard,
} from "@workspace/slide-templates";

export type ImagePlacement = "background" | "side" | "none";

export interface BuildOneInput {
  card: OutlineCard;
  themeKey: string | null;
  density: Density;
  lang: Lang;
  /** When provided, the URL is either painted full-bleed as the slide
      background (with a readability overlay) or dropped as an inline
      image element on a side column — controlled by `imagePlacement`. */
  backgroundImageUrl?: string;
  /** Where to put `backgroundImageUrl`. Defaults to "side" so most
      slides get a real photo on one column rather than a faded backdrop
      that washes out the text. "background" is reserved for hero/title-
      style cards and for uploaded source photos that should dominate
      the slide. "none" disables image rendering entirely. */
  imagePlacement?: ImagePlacement;
}

export interface BuildOneResult {
  slide: MaterializedSlide;
  warnings: string[];
}

/* Slide canvas dimensions used by every template. Mirrors the renderer
   so our coordinate math lines up. */
const CANVAS_W = 1280;
const CANVAS_H = 720;

/* Inline image column geometry. Wide enough to feel like a real photo
   panel, with breathing room on the outer edges and 32 px gutter
   between the photo and any text element. */
const IMG_W = 448;
const IMG_H = 528;
const IMG_Y = 96;
const IMG_MARGIN = 32;
const IMG_GUTTER = 32;

/* Slide kinds where the layout already centers around a hero visual or
   a single dominant statement. For these, a full-bleed background reads
   better than an inline column. */
const HERO_KINDS = new Set(["visual-hero", "title", "stat", "quote"]);

const SLIDE_THEME_ROTATION = [
  "mist", "linen", "ocean", "midnight", "clay", "pine", "sunset", "ink",
  "rose", "sand", "obsidian", "sage", "royal",
] as const;

const KIND_THEME_HINTS: Record<string, readonly string[]> = {
  title: ["midnight", "ocean", "sunset", "pine", "ink"],
  quote: ["noor", "ink", "royal", "linen", "pine"],
  stat: ["ocean", "sunset", "midnight", "obsidian"],
  "visual-hero": ["ocean", "sunset", "midnight", "rose", "pine"],
  timeline: ["sand", "linen", "royal", "pine"],
  formula: ["midnight", "ocean", "mist", "obsidian"],
  callout: ["clay", "sunset", "rose", "linen"],
  comparison: ["mist", "royal", "sand", "obsidian"],
  interactive: ["harvest", "ocean", "rose", "midnight"],
  closure: ["pine", "ink", "noor", "royal"],
};

function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function themeForCard(card: OutlineCard, deckThemeKey: string | null | undefined): string {
  if (card.slideTheme) return card.slideTheme;
  const themedByKind = KIND_THEME_HINTS[card.kind];
  const pool = themedByKind && themedByKind.length > 0 ? themedByKind : SLIDE_THEME_ROTATION;
  const seed = hashText(`${deckThemeKey ?? ""}|${card.index}|${card.kind}|${card.title}|${card.purpose}`);
  const picked = pool[(seed + card.index) % pool.length];
  /* Avoid every slide inheriting the same deck palette when the selected
     pool happens to pick it. Shift once through the global rotation. */
  if (picked === deckThemeKey && SLIDE_THEME_ROTATION.length > 1) {
    return SLIDE_THEME_ROTATION[(SLIDE_THEME_ROTATION.indexOf(picked as typeof SLIDE_THEME_ROTATION[number]) + 1) % SLIDE_THEME_ROTATION.length];
  }
  return picked;
}

/* Bump small body fonts so 30-something readers in a classroom can
   actually skim a slide from the back row. Anything ≤ 24 pt gets
   roughly +3, capped at +4, to avoid blowing up titles that are
   already 50–80 pt. */
function bumpFontSizes(elements: Element[]): void {
  for (const el of elements) {
    if (el.kind !== "text") continue;
    const cur = el.fontSize;
    if (typeof cur !== "number") continue;
    if (cur >= 30) continue;
    const bumped = Math.min(cur + 3, cur + 4);
    el.fontSize = bumped;
  }
}

/* Reposition existing elements so they don't sit on top of the inline
   image column. Strategy: only clamp elements whose bounding box
   intersects the image column in BOTH X and Y (so a footer below the
   image is left untouched). LTR ⇒ trim the right edge, RTL ⇒ shift x
   and trim. If clamping would leave the element narrower than
   `MIN_REMAINING_W`, we don't shrink it further — the image is still
   inserted before text in the element list, so any residual overlap
   shows the text painted on top of the photo (readable, not hidden). */
const MIN_REMAINING_W = 240;
function avoidColumn(
  elements: Element[],
  colX: number,
  colW: number,
  side: "left" | "right",
): void {
  const colLeft = colX;
  const colRight = colX + colW;
  const colTop = IMG_Y;
  const colBottom = IMG_Y + IMG_H;
  for (const el of elements) {
    /* Don't reflow shape overlays we intentionally placed full-bleed
       (z-order 0 background washes etc.). */
    if (el.kind === "shape" && el.x === 0 && el.w >= CANVAS_W - 1) continue;
    const elRight = el.x + el.w;
    const elBottom = el.y + el.h;
    /* 2D overlap test — skip elements that sit fully above or below the
       image, even if their X range covers the column. */
    const yOverlap = elBottom > colTop && el.y < colBottom;
    if (!yOverlap) continue;
    if (side === "right") {
      if (elRight > colLeft - IMG_GUTTER && el.x < colRight) {
        const newRight = colLeft - IMG_GUTTER;
        const newW = newRight - el.x;
        if (newW >= MIN_REMAINING_W) el.w = newW;
      }
    } else {
      if (el.x < colRight + IMG_GUTTER && elRight > colLeft) {
        const newX = colRight + IMG_GUTTER;
        const delta = newX - el.x;
        const newW = el.w - delta;
        if (newW >= MIN_REMAINING_W) {
          el.x = newX;
          el.w = newW;
        }
      }
    }
  }
}

export function buildOneSlide(input: BuildOneInput): BuildOneResult {
  const deckPalette = paletteForTheme(input.themeKey);
  const slideThemeKey = themeForCard(input.card, input.themeKey);
  const palette = paletteForTheme(slideThemeKey) ?? deckPalette;
  /* Effective placement. If the AI didn't pick one we default to "side"
     for everyday content and "background" for hero/stat/quote/title
     where a single dominant visual reads better. */
  const declared = input.imagePlacement;
  const placement: ImagePlacement = !input.backgroundImageUrl
    ? "none"
    : declared
      ? declared
      : HERO_KINDS.has(input.card.kind)
        ? "background"
        : "side";

  try {
    const out = materializeSlide({
      card: input.card,
      theme: palette,
      density: input.density,
      lang: input.lang,
    });
    if (palette.cssGrad) {
      out.slide.background = palette.cssGrad;
    }

    if (placement === "background" && input.backgroundImageUrl) {
      /* Full-bleed photo + readability overlay. Dark themes get a dark
         wash, light themes a light wash so AI text remains readable. */
      out.slide.backgroundImage = input.backgroundImageUrl;
      const overlayColor = palette.textOnLight
        ? "rgba(255,255,255,0.55)"
        : "rgba(0,0,0,0.40)";
      out.slide.elements.unshift({
        id: `${out.slide.id}-bg-overlay`,
        kind: "shape",
        shape: "rect",
        x: 0, y: 0, w: CANVAS_W, h: CANVAS_H,
        bgColor: overlayColor,
      });
    } else if (placement === "side" && input.backgroundImageUrl) {
      /* Inline image column. Place opposite the natural reading column
         so it doesn't fight the title block:
           Arabic (RTL) → image on the LEFT edge
           English (LTR) → image on the RIGHT edge
         Then clamp any text/icon/shape that would overlap it. */
      const side: "left" | "right" = input.lang === "ar" ? "left" : "right";
      const colX = side === "right" ? CANVAS_W - IMG_W - IMG_MARGIN : IMG_MARGIN;
      avoidColumn(out.slide.elements, colX, IMG_W, side);
      /* Insert the image BEFORE text/icon/shape elements so the renderer
         (which paints in array order) draws text on top of the photo
         when residual overlap remains. We still place it after any
         leading background-overlay shape (z=0 wash) so that wash sits
         under the photo. */
      const insertAt =
        out.slide.elements.length > 0 &&
        out.slide.elements[0].kind === "shape" &&
        out.slide.elements[0].x === 0 &&
        out.slide.elements[0].w >= CANVAS_W - 1
          ? 1
          : 0;
      out.slide.elements.splice(insertAt, 0, {
        id: `${out.slide.id}-img`,
        kind: "image",
        x: colX,
        y: IMG_Y,
        w: IMG_W,
        h: IMG_H,
        url: input.backgroundImageUrl,
        objectFit: "cover",
        imageBorderRadius: 24,
      });
    }

    /* Slightly larger body type for classroom readability. Runs after
       any layout reflow so we don't bump fonts on elements we then
       resize. */
    bumpFontSizes(out.slide.elements);

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
            fontSize: 52,
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
