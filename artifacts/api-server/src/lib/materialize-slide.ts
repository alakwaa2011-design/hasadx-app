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
       style cards with very little text. Uploaded source assets use the
       provenance flag below and are always preserved in a side frame.
       "none" disables image rendering entirely. */
  imagePlacement?: ImagePlacement;
  /** Preserve the full source frame (screenshots, diagrams, uploaded pages)
      instead of cropping it like a decorative stock photo. */
  preserveImageContent?: boolean;
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
const IMG_H = 432;
const IMG_Y = 208;
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

function effectiveRenderedKind(card: OutlineCard): OutlineCard["kind"] {
  switch (card.slideType) {
    case "title": return "title";
    case "concept": return "concept-card";
    case "visualHero": return "visual-hero";
    case "process": return "steps";
    case "comparison": return "comparison";
    case "timeline": return "timeline";
    case "workedExample": return "formula";
    case "quote": return "quote";
    case "misconception": return "callout";
    case "activity":
    case "quiz": return "interactive";
    case "summary": return "closure";
    default: return card.kind;
  }
}

function textLoad(card: OutlineCard): { pointCount: number; wordCount: number } {
  return {
    pointCount: card.talkingPoints.length,
    wordCount: card.talkingPoints.reduce(
      (sum, point) => sum + point.trim().split(/\s+/).filter(Boolean).length,
      0,
    ),
  };
}

/** A full-bleed image is intentionally rare: it only works when the text is
 * a short headline or statement. Content-heavy and native-visual slides keep
 * the image away from the reading surface even if the model requested a
 * background. */
export function resolveImagePlacement(
  card: OutlineCard,
  requested: ImagePlacement | undefined,
  hasImage: boolean,
  preserveImageContent = false,
): ImagePlacement {
  if (!hasImage || requested === "none") return "none";
  const effectiveKind = effectiveRenderedKind(card);
  if (preserveImageContent) {
    return effectiveKind === "interactive" ? "none" : "side";
  }
  if (NATIVE_VISUAL_KINDS.has(effectiveKind)) return "none";

  const load = textLoad(card);
  const conciseHero =
    ["title", "visual-hero", "stat", "quote"].includes(effectiveKind) &&
    load.pointCount <= 2 &&
    load.wordCount <= 24;
  if (requested === "background") return conciseHero ? "background" : "side";
  if (requested === "side") return "side";
  return conciseHero ? "background" : "side";
}

function addVisualFallback(
  slide: MaterializedSlide,
  card: OutlineCard,
  _palette: ReturnType<typeof paletteForTheme>,
  _lang: Lang,
): void {
  const fallback = card.imagePlan?.fallback ?? "none";
  if (fallback === "none") return;
  if (NATIVE_VISUAL_KINDS.has(slide.layout)) {
    slide.visualFallback = fallback;
  }
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

function removeDecorativeImageCompetitors(elements: Element[], slideId: string): Element[] {
  return elements.filter(
    (el) =>
      el.id !== `${slideId}-halo` &&
      el.id !== `${slideId}-icon` &&
      !el.id.startsWith(`${slideId}-corner-`),
  );
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
  colY = IMG_Y,
  colH = IMG_H,
): boolean {
  const colLeft = colX;
  const colRight = colX + colW;
  const colTop = colY;
  const colBottom = colY + colH;
  for (const el of elements) {
    /* Don't reflow shape overlays we intentionally placed full-bleed
       (z-order 0 background washes etc.). */
    if (el.id.includes("-atm-")) continue;
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
    if (el.id.includes("-atm-")) continue;
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
  const placement = resolveImagePlacement(
    input.card,
    input.imagePlacement,
    Boolean(input.backgroundImageUrl),
    input.preserveImageContent,
  );

  try {
    const effectiveKind = effectiveRenderedKind(input.card);
    const useSourceImageLayout =
      input.preserveImageContent &&
      placement === "side" &&
      NATIVE_VISUAL_KINDS.has(effectiveKind);
    const renderCard: OutlineCard = useSourceImageLayout
      ? {
          ...input.card,
          kind: "concept-card",
          slideType: "concept",
          layoutVariant: "classic",
        }
      : input.card;
    /* v2 design identities place a photo themselves (in the spot of the illustration), so the
       legacy overlay / side-column logic below is skipped for them. */
    const isDesign = Boolean(palette.design);
    const out = materializeSlide({
      card: renderCard,
      theme: palette,
      density: input.density,
      lang: input.lang,
      ...(isDesign && input.backgroundImageUrl ? { imageUrl: input.backgroundImageUrl } : {}),
    });
    if (palette.cssGrad) {
      out.slide.background = palette.cssGrad;
    }

    if (isDesign) {
      if (out.warnings.length === 0 && input.card.imagePlan?.fallback && input.card.imagePlan.fallback !== "none" && !input.backgroundImageUrl) {
        addVisualFallback(out.slide, input.card, palette, input.lang);
      }
      /* Identity layouts already size every text box to its text (fitSize in templates-v2); the legacy fitter
         measures differently and shrank those boxes' text, so it is not applied here. */
      /* Quality gate: a content slide whose copy is nearly empty is reported so the builder can
         surface it instead of silently shipping a hollow slide. */
      const kindNow = input.card.kind as string;
      if (kindNow !== "title" && kindNow !== "closure" && kindNow !== "interactive") {
        const bodyChars = out.slide.elements.reduce(
          (n, el) => n + (el.kind === "text" ? String((el as { text?: string }).text ?? "").length : 0), 0);
        const titleChars = (input.card.title ?? "").length;
        if (bodyChars - titleChars < 60) out.warnings.push(`thin-content: slide ${input.card.index} has very little explanatory text`);
      }
      return { slide: out.slide, warnings: out.warnings };
    }

    if (placement === "background" && input.backgroundImageUrl) {
      /* Full-bleed photo + readability overlay. Dark themes get a dark
         wash, light themes a light wash so AI text remains readable. */
      out.slide.backgroundImage = input.backgroundImageUrl;
      const overlayColor = palette.textOnLight
        ? "rgba(255,255,255,0.72)"
        : "rgba(0,0,0,0.58)";
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
      const dense = textLoad(input.card).pointCount >= 4;
      const imageW = dense ? 392 : IMG_W;
      const imageH = dense ? 420 : IMG_H;
      const imageY = dense ? 220 : IMG_Y;
      const colX = side === "right" ? CANVAS_W - imageW - IMG_MARGIN : IMG_MARGIN;
      out.slide.elements = removeDecorativeImageCompetitors(out.slide.elements, out.slide.id);
      const hasRoomForImage = avoidColumn(out.slide.elements, colX, imageW, side, imageY, imageH);
      /* Insert the image BEFORE text/icon/shape elements so the renderer
         (which paints in array order) draws text on top of the photo
         when residual overlap remains. We still place it after any
         leading background-overlay shape (z=0 wash) so that wash sits
         under the photo. */
      let insertAt = 0;
      while (
        insertAt < out.slide.elements.length &&
        (
          out.slide.elements[insertAt].id.includes("-atm-") ||
          (
            out.slide.elements[insertAt].kind === "shape" &&
            out.slide.elements[insertAt].x === 0 &&
            out.slide.elements[insertAt].w >= CANVAS_W - 1
          )
        )
      ) {
        insertAt += 1;
      }
      if (hasRoomForImage) {
        const preserveFrame =
          input.preserveImageContent ||
          input.card.imagePlan?.mediaType === "diagram" ||
          input.card.imagePlan?.mediaType === "chart" ||
          input.card.imagePlan?.mediaType === "illustration";
        out.slide.elements.splice(
          insertAt,
          0,
          {
            id: `${out.slide.id}-img-frame`,
            kind: "shape",
            shape: "rect",
            x: colX,
            y: imageY,
            w: imageW,
            h: imageH,
            bgColor: palette.surface,
            borderColor: palette.divider,
            borderWidth: 2,
          },
          {
            id: `${out.slide.id}-img`,
            kind: "image",
            x: colX + (preserveFrame ? 12 : 0),
            y: imageY + (preserveFrame ? 12 : 0),
            w: imageW - (preserveFrame ? 24 : 0),
            h: imageH - (preserveFrame ? 24 : 0),
            url: input.backgroundImageUrl,
            objectFit: preserveFrame ? "contain" : "cover",
            imageBorderRadius: preserveFrame ? 16 : 24,
          },
        );
      } else {
        out.warnings.push(
          input.lang === "ar"
            ? "تم حذف الصورة الجانبية لأن مساحة النص لا تسمح بها."
            : "Side image removed because the text layout did not have enough room.",
        );
        addVisualFallback(out.slide, input.card, palette, input.lang);
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
        elements: [
          {
            id: `s${input.card.index}-fallback-title`,
            kind: "text",
            x: 96, y: 120, w: 1088, h: 120,
            text: input.card.title,
            fontSize: 52,
            fontWeight: "700",
            align: "start",
            color: palette.fg,
          },
          {
            id: `s${input.card.index}-fallback-content`,
            kind: "text",
            x: 96, y: 270, w: 1088, h: 330,
            text: input.card.talkingPoints.map((point) => `◆  ${point}`).join("\n"),
            fontSize: 24,
            fontWeight: "500",
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
