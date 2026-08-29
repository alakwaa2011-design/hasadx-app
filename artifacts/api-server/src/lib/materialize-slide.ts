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
/* These templates already materialize their teaching structure as a strong
   visual (cards, lanes, steps, game surface, timeline, formula, etc.).
   Adding a second side illustration would either duplicate the meaning or
   be hidden under an opaque content element. */
const NATIVE_VISUAL_KINDS = new Set([
  "objectives", "comparison", "steps", "interactive", "closure",
  "timeline", "formula", "stat", "quote",
]);

function defaultFallbackForCard(card: OutlineCard): NonNullable<OutlineCard["imagePlan"]>["fallback"] {
  if (card.kind === "steps" || card.kind === "timeline" || card.slideType === "process" || card.slideType === "timeline") {
    return "timeline";
  }
  if (
    card.kind === "comparison" || card.kind === "formula" || card.kind === "interactive" ||
    card.kind === "callout" || card.slideType === "workedExample" ||
    card.slideType === "comparison" || card.slideType === "quiz"
  ) {
    return "coloredExample";
  }
  if (card.kind === "objectives" || card.kind === "closure" || card.slideType === "summary") {
    return "relationshipMap";
  }
  if (card.kind === "title" || card.kind === "quote") return "icon";
  return "diagram";
}

function addVisualFallback(
  slide: MaterializedSlide,
  card: OutlineCard,
  palette: ReturnType<typeof paletteForTheme>,
  lang: Lang,
): void {
  const fallback = card.imagePlan?.fallback ?? defaultFallbackForCard(card);
  if (fallback === "none") return;
  if (NATIVE_VISUAL_KINDS.has(slide.layout)) {
    slide.visualFallback = fallback;
    return;
  }
  const isRtl = lang === "ar";
  const x = isRtl ? 48 : CANVAS_W - 308;
  const accent = palette.accent;
  const surface = palette.surface;
  const visualElements: Element[] = [
    {
      id: `${slide.id}-fallback-panel`,
      kind: "shape",
      shape: "rect",
      x, y: 122, w: 260, h: 420,
      bgColor: surface,
      borderColor: accent,
      borderWidth: 3,
    },
  ];

  if (fallback === "timeline") {
    visualElements.push({
      id: `${slide.id}-fallback-line`,
      kind: "shape", shape: "line",
      x: x + 62, y: 330, w: 136, h: 2,
      bgColor: accent,
    });
    [0, 1, 2].forEach((step) => {
      visualElements.push({
        id: `${slide.id}-fallback-step-${step}`,
        kind: "shape", shape: "circle",
        x: x + 42 + step * 66, y: 312, w: 38, h: 38,
        bgColor: step === 1 ? accent : palette.accentSoft,
        borderColor: accent, borderWidth: 2,
      });
    });
  } else if (fallback === "relationshipMap" || fallback === "diagram") {
    visualElements.push({
      id: `${slide.id}-fallback-center`,
      kind: "shape", shape: "circle",
      x: x + 96, y: 278, w: 68, h: 68,
      bgColor: accent,
    });
    [[48, 190], [164, 190], [48, 390], [164, 390]].forEach(([dx, dy], node) => {
      visualElements.push({
        id: `${slide.id}-fallback-node-${node}`,
        kind: "shape", shape: "circle",
        x: x + dx, y: dy, w: 48, h: 48,
        bgColor: palette.accentSoft,
        borderColor: accent, borderWidth: 2,
      });
    });
    visualElements.push({
      id: `${slide.id}-fallback-icon`,
      kind: "icon",
      iconName: fallback === "relationshipMap" ? "GitBranch" : "Workflow",
      x: x + 108, y: 290, w: 44, h: 44,
      color: surface,
    });
  } else if (fallback === "coloredExample") {
    [0, 1, 2].forEach((row) => {
      visualElements.push({
        id: `${slide.id}-fallback-example-${row}`,
        kind: "shape", shape: "rect",
        x: x + 34, y: 198 + row * 92, w: 192, h: 64,
        bgColor: row === 1 ? palette.accentSoft : surface,
        borderColor: accent, borderWidth: row === 1 ? 3 : 1,
      });
      visualElements.push({
        id: `${slide.id}-fallback-check-${row}`,
        kind: "icon", iconName: row === 1 ? "Check" : "Circle",
        x: x + 176, y: 214 + row * 92, w: 30, h: 30,
        color: accent,
      });
    });
  } else {
    visualElements.push(
      {
        id: `${slide.id}-fallback-orb`,
        kind: "shape", shape: "circle",
        x: x + 42, y: 204, w: 176, h: 176,
        bgColor: palette.accentSoft,
      },
      {
        id: `${slide.id}-fallback-icon`,
        kind: "icon",
        iconName: card.visualDirection?.icon || "Sparkles",
        x: x + 85, y: 247, w: 90, h: 90,
        color: accent,
      },
    );
  }
  /* Atmosphere shapes are deliberately painted first by the templates.
     Insert the educational visual after them so an editorial side panel
     cannot hide it, while keeping it below the actual text/content. */
  let insertAt = 0;
  while (insertAt < slide.elements.length && slide.elements[insertAt].id.includes("-atm-")) {
    insertAt += 1;
  }
  slide.elements.splice(insertAt, 0, ...visualElements);
  slide.visualFallback = fallback;
}

function hasUnsafeGeometry(elements: Element[]): boolean {
  return elements.some((el) =>
    !el.id.includes("-atm-") && (
      el.x < 0 || el.y < 0 || el.w <= 0 || el.h <= 0 ||
      el.x + el.w > CANVAS_W || el.y + el.h > CANVAS_H
    )
  );
}

function estimatedWrappedLines(text: string, width: number, fontSize: number): number {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const arabicRatio = text.length > 0 ? arabicChars / text.length : 0;
  const averageGlyphWidth = fontSize * (arabicRatio > 0.25 ? 0.62 : 0.54);
  const charsPerLine = Math.max(4, Math.floor(width / averageGlyphWidth));
  return text.split("\n").reduce(
    (sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)),
    0,
  );
}

/* Fit every text element to its allocated box after images and layout
   adjustments. This deliberately prefers a smaller readable font over
   clipping or painting wrapped Arabic text into the next element. */
function fitTextElements(elements: Element[]): void {
  for (const el of elements) {
    if (el.kind !== "text") continue;
    let fontSize = typeof el.fontSize === "number" ? el.fontSize : 28;
    const minFont = fontSize >= 40 ? 26 : 16;
    while (fontSize > minFont) {
      const lines = estimatedWrappedLines(el.text, el.w, fontSize);
      if (lines * fontSize * 1.22 <= el.h) break;
      fontSize -= 1;
    }
    el.fontSize = fontSize;
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
): boolean {
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
        if (newW < MIN_REMAINING_W) return false;
      }
    } else {
      if (el.x < colRight + IMG_GUTTER && elRight > colLeft) {
        const newX = colRight + IMG_GUTTER;
        const delta = newX - el.x;
        const newW = el.w - delta;
        if (newW < MIN_REMAINING_W) return false;
      }
    }
  }
  for (const el of elements) {
    const elRight = el.x + el.w;
    const elBottom = el.y + el.h;
    const yOverlap = elBottom > colTop && el.y < colBottom;
    if (!yOverlap) continue;
    if (side === "right" && elRight > colLeft - IMG_GUTTER && el.x < colRight) {
      el.w = colLeft - IMG_GUTTER - el.x;
    } else if (side === "left" && el.x < colRight + IMG_GUTTER && elRight > colLeft) {
      const newX = colRight + IMG_GUTTER;
      el.w -= newX - el.x;
      el.x = newX;
    }
  }
  return true;
}

export function buildOneSlide(input: BuildOneInput): BuildOneResult {
  const deckPalette = paletteForTheme(input.themeKey);
  /* AI decks should feel coherent: one visual identity per deck.
     Layout variants inside slide-templates provide structural variety;
     we intentionally do NOT rotate color themes per slide. */
  const palette = deckPalette;
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
      const hasRoomForImage = avoidColumn(out.slide.elements, colX, IMG_W, side);
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
      if (hasRoomForImage) {
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
      } else {
        out.warnings.push(
          input.lang === "ar"
            ? "تم حذف الصورة الجانبية لأن مساحة النص لا تسمح بها."
            : "Side image removed because the text layout did not have enough room.",
        );
      }
    } else {
      /* A requested image must never degrade into a text-only slide. Keep
         the deck self-contained with a deterministic, topic-directed visual. */
      addVisualFallback(out.slide, input.card, palette, input.lang);
    }

    fitTextElements(out.slide.elements);
    if (hasUnsafeGeometry(out.slide.elements)) {
      out.warnings.push(
        input.lang === "ar"
          ? "تم اكتشاف عنصر خارج حدود الشريحة؛ يُنصح بمراجعة التخطيط."
          : "An element extends beyond the slide bounds; review the layout.",
      );
    }

    return { slide: out.slide, warnings: out.warnings };
  } catch (err) {
    /* Last-resort fallback: preserve a readable slide with a meaningful
       visual anchor, rather than silently replacing a failed layout with
       a title-only blank. */
    const msg = err instanceof Error ? err.message : "unknown";
    const fallback = input.card.imagePlan?.fallback ?? "icon";
    return {
      slide: {
        id: `s${input.card.index}`,
        layout: input.card.kind,
        notes: input.card.purpose,
        background: palette.cssGrad,
        designFamily: input.card.designFamily,
        slideType: input.card.slideType,
        layoutVariant: input.card.layoutVariant,
        imagePlan: input.card.imagePlan,
        visualFallback: fallback,
        elements: [
          {
            id: `s${input.card.index}-fallback-panel`,
            kind: "shape",
            shape: "rect",
            x: input.lang === "ar" ? 48 : 932, y: 120, w: 300, h: 480,
            bgColor: palette.surface,
            borderColor: palette.accent,
            borderWidth: 3,
          },
          {
            id: `s${input.card.index}-fallback-icon`,
            kind: "icon",
            iconName: fallback === "timeline" ? "Clock" : fallback === "relationshipMap" ? "GitBranch" : "Sparkles",
            x: input.lang === "ar" ? 150 : 1034, y: 260, w: 96, h: 96,
            color: palette.accent,
          },
          {
            id: `s${input.card.index}-fallback-title`,
            kind: "text",
            x: input.lang === "ar" ? 392 : 80, y: 240, w: 720, h: 120,
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
