import type {
  Element, MaterializeOptions, MaterializeResult, OutlineCard,
  TextElement, IconElement, ShapeElement, ActivityElement, HasadGameElement,
  ThemePalette, Density, Lang,
} from "./types";
import { resolveIcon, defaultIconForKind } from "./icons";

/* ── Canvas constants. Keep in sync with the renderer (CANVAS_W/H in
   homework-app/src/lib/slide-render.tsx). All template coordinates
   below assume this fixed coordinate space. */
const W = 1280;
const H = 720;
const PAD = 96;            // outer page padding (was 80 — more breathing room)
const HEADER_TOP = 64;     // y of the eyebrow line
const CONTENT_TOP = 248;   // y where each layout's content body begins
const CONTENT_BOTTOM = 60; // bottom padding from canvas edge

/* ── Density caps. Bullets/font-sizes shrink for "minimal" decks and
   grow for "detailed" decks so a deck reads consistently across all
   slides regardless of the card the AI emitted. The headline-style
   maxBulletChars caps below intentionally squeeze paragraph-y output
   into one-line slogans — a deliberate "presentation director" rule. */
interface DensityCfg {
  maxBullets: number;
  bulletFont: number;
  titleFont: number;
  subtitleFont: number;
  maxBulletChars: number;
  maxTitleChars: number;
}

const DENSITY: Record<Density, DensityCfg> = {
  minimal:  { maxBullets: 3, bulletFont: 28, titleFont: 56, subtitleFont: 26, maxBulletChars: 56, maxTitleChars: 56 },
  balanced: { maxBullets: 4, bulletFont: 24, titleFont: 48, subtitleFont: 24, maxBulletChars: 70, maxTitleChars: 64 },
  detailed: { maxBullets: 5, bulletFont: 22, titleFont: 44, subtitleFont: 22, maxBulletChars: 84, maxTitleChars: 72 },
};

/* ── Tiny string helpers. We never auto-flip with CSS — RTL slides
   pin to the right edge by computing positions explicitly. */

const LABEL_AR_TO_EN: Record<string, string> = {
  "العنوان": "Title",
  "العنوان الفرعي": "Subtitle",
  "نص النشاط": "Activity prompt",
  "المعادلة": "Formula",
  "الاقتباس": "Quote",
};
const LABEL_PATTERNS_AR_TO_EN: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^سطر (\d+)$/, (m) => `Line ${m[1]}`],
  [/^هدف (\d+)$/, (m) => `Objective ${m[1]}`],
  [/^خطوة (\d+)$/, (m) => `Step ${m[1]}`],
  [/^حدث (\d+)$/, (m) => `Event ${m[1]}`],
  [/^إحصائية (\d+)$/, (m) => `Stat ${m[1]}`],
];
function translateLabel(label: string): string {
  if (LABEL_AR_TO_EN[label]) return LABEL_AR_TO_EN[label];
  for (const [re, fn] of LABEL_PATTERNS_AR_TO_EN) {
    const m = label.match(re);
    if (m) return fn(m);
  }
  return label;
}

function clip(text: string, max: number, warnings: string[], label: string, lang: Lang): string {
  if (!text) return "";
  if (text.length <= max) return text;
  warnings.push(
    lang === "ar"
      ? `${label}: تم اختصار النص إلى ${max} حرفًا`
      : `${translateLabel(label)}: truncated to ${max} chars`,
  );
  return text.slice(0, max - 1).trimEnd() + "…";
}

/* Always returns "start" — the renderer wraps content in a `dir`
   container, so `text-align: start` resolves to the correct physical
   edge per language (right in RTL/Arabic, left in LTR/English). */
function alignFor(_lang: Lang): "start" {
  return "start";
}

function id(seed: string, suffix: string): string {
  return `${seed}-${suffix}`;
}

/* Stage label shown as the eyebrow above the title. Translates the
   slide kind into a short editorial mark — much warmer than "01". */
function kindEyebrow(kind: string, lang: Lang): string {
  const ar: Record<string, string> = {
    title: "بداية",
    objectives: "أهداف الدرس",
    "concept-card": "فكرة محورية",
    comparison: "مقارنة",
    "visual-hero": "تصور",
    steps: "خطوات",
    interactive: "نشاط",
    closure: "خلاصة",
    timeline: "خط زمني",
    formula: "قاعدة",
    stat: "بالأرقام",
    quote: "اقتباس",
    callout: "ملاحظة",
  };
  const en: Record<string, string> = {
    title: "OPENING",
    objectives: "OBJECTIVES",
    "concept-card": "KEY IDEA",
    comparison: "COMPARE",
    "visual-hero": "OVERVIEW",
    steps: "PROCESS",
    interactive: "ACTIVITY",
    closure: "RECAP",
    timeline: "TIMELINE",
    formula: "FORMULA",
    stat: "BY THE NUMBERS",
    quote: "QUOTE",
    callout: "NOTE",
  };
  return (lang === "ar" ? ar[kind] : en[kind]) ?? "";
}

/* ── Bullet list builder. Used by several layouts; honors RTL by
   placing the bullet glyph on the correct side via a leading marker
   in the text and explicit alignment (no per-char Unicode trickery). */
function buildBullets(opts: {
  seed: string;
  items: string[];
  x: number; y: number; w: number;
  cfg: DensityCfg;
  lang: Lang;
  palette: ThemePalette;
  warnings: string[];
  /** Override the bullet glyph (defaults to a small accent diamond). */
  marker?: string;
}): TextElement[] {
  const { seed, items, x, y, w, cfg, lang, palette, warnings, marker = "◆" } = opts;
  const align = alignFor(lang);
  /* Each bullet reserves enough vertical space for up to 2 wrapped lines
     so the renderer never paints text over the bullet beneath it. */
  const stride = Math.round(cfg.bulletFont * 2.4);
  return items.slice(0, cfg.maxBullets).map((raw, i) => {
    const text = clip(raw.trim(), cfg.maxBulletChars, warnings, `سطر ${i + 1}`, lang);
    const bullet = `${marker}  ${text}`;
    return {
      id: id(seed, `b${i}`),
      kind: "text",
      x, y: y + i * stride, w, h: stride,
      text: bullet,
      fontSize: cfg.bulletFont,
      fontWeight: "500",
      align,
      color: palette.fg,
    } satisfies TextElement;
  });
}

/* ── Common title block. Returns the eyebrow + title + optional
   subtitle + accent rule. All content templates start by calling
   this so the visual rhythm of every deck stays consistent. */
function buildHeader(opts: {
  seed: string;
  card: OutlineCard;
  cfg: DensityCfg;
  lang: Lang;
  palette: ThemePalette;
  warnings: string[];
  /** Override the y of the eyebrow line (rare). */
  topY?: number;
}): Element[] {
  const { seed, card, cfg, lang, palette, warnings, topY = HEADER_TOP } = opts;
  const align = alignFor(lang);
  const isAr = lang === "ar";
  const titleX = PAD;
  const titleW = W - PAD * 2;
  const els: Element[] = [];

  /* Eyebrow — small uppercase mark naming the slide's role
     ("OBJECTIVES" / "أهداف الدرس"). Stronger than a bare slide number. */
  const eyebrow = kindEyebrow(card.kind, lang);
  if (eyebrow) {
    els.push({
      id: id(seed, "eyebrow"),
      kind: "text",
      x: titleX, y: topY, w: titleW, h: 28,
      text: isAr ? eyebrow : eyebrow.toUpperCase(),
      fontSize: 16,
      fontWeight: "700",
      align,
      color: palette.accent,
    });
  }

  /* Title — anchored relative to the eyebrow (or topY when there is
     no eyebrow). */
  const titleY = topY + 36;
  const titleH = cfg.titleFont * 1.45;
  els.push({
    id: id(seed, "title"),
    kind: "text",
    x: titleX, y: titleY, w: titleW, h: titleH,
    text: clip(card.title, cfg.maxTitleChars, warnings, "العنوان", lang),
    fontSize: cfg.titleFont,
    fontWeight: "800",
    align,
    color: palette.fg,
  });

  /* Subtitle (optional). */
  if (card.subtitle && card.subtitle.trim().length > 0) {
    els.push({
      id: id(seed, "subtitle"),
      kind: "text",
      x: titleX, y: titleY + titleH + 4,
      w: titleW, h: cfg.subtitleFont * 1.5,
      text: clip(card.subtitle, 100, warnings, "العنوان الفرعي", lang),
      fontSize: cfg.subtitleFont,
      fontWeight: "500",
      align,
      color: palette.muted,
    });
  }

  /* Accent rule under the header. RTL pins it to the right edge of
     the title block; LTR to the left. Slightly thicker (4px) than the
     old rule so it reads as a deliberate underline rather than a
     hairline. */
  const ruleW = 64;
  const subOffset = card.subtitle ? cfg.subtitleFont * 1.5 + 4 : 0;
  const ruleY = titleY + titleH + subOffset + 18;
  els.push({
    id: id(seed, "rule"),
    kind: "shape",
    shape: "rect",
    x: isAr ? titleX + titleW - ruleW : titleX,
    y: ruleY,
    w: ruleW, h: 4,
    bgColor: palette.accent,
  });

  return els;
}

/* ── Decorative icon in a tinted halo — used in many layouts as the
   "hero glyph". Returns 2 elements (halo circle + icon). */
function buildHaloIcon(seed: string, opts: {
  cx: number; cy: number; size: number;
  iconName: string; palette: ThemePalette;
  haloFactor?: number;
}): [ShapeElement, IconElement] {
  const { cx, cy, size, iconName, palette, haloFactor = 1.7 } = opts;
  const haloSize = Math.round(size * haloFactor);
  const halo: ShapeElement = {
    id: id(seed, "halo"),
    kind: "shape",
    shape: "circle",
    x: cx - haloSize / 2,
    y: cy - haloSize / 2,
    w: haloSize, h: haloSize,
    bgColor: palette.accentSoft,
  };
  const icon: IconElement = {
    id: id(seed, "icon"),
    kind: "icon",
    x: cx - size / 2,
    y: cy - size / 2,
    w: size, h: size,
    iconName,
    color: palette.accent,
  };
  return [halo, icon];
}

/* Decorative accent corner — small tinted square glyph opposite the
   title side. Replaces the old plain-icon corner mark. */
function buildCornerAccent(seed: string, palette: ThemePalette, lang: Lang): Element[] {
  const isAr = lang === "ar";
  const size = 64;
  const x = isAr ? PAD : W - PAD - size;
  const y = HEADER_TOP - 4;
  return [
    {
      id: id(seed, "corner-bg"),
      kind: "shape",
      shape: "rect",
      x, y, w: size, h: size,
      bgColor: palette.accentSoft,
    },
    {
      id: id(seed, "corner-bar"),
      kind: "shape",
      shape: "rect",
      x: isAr ? x + size - 6 : x,
      y, w: 6, h: size,
      bgColor: palette.accent,
    },
  ];
}

/* ── Per-kind layouts ───────────────────────────────────────────── */

function tplTitle(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, lang } = o;
  const seed = o.idSeed ?? `s${card.index}`;
  const isAr = lang === "ar";
  const els: Element[] = [];

  /* Side accent panel: a tall tinted column on the leading edge with
     a thin solid bar at its inner edge. Anchors the eye and reads as
     a designer's chapter-marker. */
  const panelW = 12;
  const panelX = isAr ? W - panelW : 0;
  els.push({
    id: id(seed, "side-bar"),
    kind: "shape",
    shape: "rect",
    x: panelX, y: 0, w: panelW, h: H,
    bgColor: theme.accent,
  });
  els.push({
    id: id(seed, "side-tint"),
    kind: "shape",
    shape: "rect",
    x: isAr ? W - 96 : 0, y: 0, w: 84, h: H,
    bgColor: theme.accentSoft,
  });

  /* Eyebrow — "PRESENTATION" / "عرض تعليمي". */
  const padX = PAD + 20;
  const contentW = W - padX * 2;
  els.push({
    id: id(seed, "kicker"),
    kind: "text",
    x: padX, y: 220, w: contentW, h: 28,
    text: isAr ? "عرض تعليمي" : "PRESENTATION",
    fontSize: 18,
    fontWeight: "700",
    align: alignFor(lang),
    color: theme.accent,
  });

  /* Big title. */
  const titleFont = 72;
  els.push({
    id: id(seed, "title"),
    kind: "text",
    x: padX, y: 264, w: contentW, h: titleFont * 1.6,
    text: clip(card.title, 80, warnings, "العنوان", lang),
    fontSize: titleFont,
    fontWeight: "800",
    align: alignFor(lang),
    color: theme.fg,
  });

  /* Accent rule under title. */
  const ruleY = 264 + titleFont * 1.6 + 8;
  const ruleW = 96;
  els.push({
    id: id(seed, "rule"),
    kind: "shape",
    shape: "rect",
    x: isAr ? padX + contentW - ruleW : padX,
    y: ruleY, w: ruleW, h: 5,
    bgColor: theme.accent,
  });

  /* Subtitle. */
  if (card.subtitle) {
    els.push({
      id: id(seed, "subtitle"),
      kind: "text",
      x: padX, y: ruleY + 24, w: contentW, h: 64,
      text: clip(card.subtitle, 100, warnings, "العنوان الفرعي", lang),
      fontSize: 28,
      fontWeight: "500",
      align: alignFor(lang),
      color: theme.muted,
    });
  }

  return els;
}

function tplObjectives(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });
  els.push(...buildCornerAccent(seed, theme, lang));

  /* Each talking point is rendered as a tinted card with a number
     badge on the leading edge. Spacing is a true 8pt grid. */
  const isAr = lang === "ar";
  const cardW = W - PAD * 2;
  const startY = CONTENT_TOP;
  const items = card.talkingPoints.slice(0, cfg.maxBullets);
  const gap = 16;
  const available = H - startY - CONTENT_BOTTOM;
  const cardH = Math.min(96, Math.floor((available - gap * (items.length - 1)) / Math.max(items.length, 1)));
  const badge = 56;

  items.forEach((raw, i) => {
    const y = startY + i * (cardH + gap);
    /* Tinted card */
    els.push({
      id: id(seed, `card${i}`),
      kind: "shape", shape: "rect",
      x: PAD, y, w: cardW, h: cardH,
      bgColor: theme.accentSoft,
    });
    /* Number badge */
    const badgeX = isAr ? PAD + cardW - 24 - badge : PAD + 24;
    const badgeY = y + (cardH - badge) / 2;
    els.push({
      id: id(seed, `n${i}`),
      kind: "shape", shape: "circle",
      x: badgeX, y: badgeY, w: badge, h: badge,
      bgColor: theme.accent,
    });
    els.push({
      id: id(seed, `nl${i}`),
      kind: "text",
      x: badgeX, y: badgeY + 10, w: badge, h: badge - 12,
      text: String(i + 1),
      fontSize: 26, fontWeight: "800", align: "center",
      color: theme.textOnLight ? "#ffffff" : "#0a0a0a",
    });
    /* Objective text */
    const textPad = 24 + badge + 20;
    els.push({
      id: id(seed, `t${i}`),
      kind: "text",
      x: isAr ? PAD + 24 : PAD + textPad,
      y: y + 14,
      w: cardW - textPad - 24,
      h: cardH - 28,
      text: clip(raw, cfg.maxBulletChars, warnings, `هدف ${i + 1}`, lang),
      fontSize: cfg.bulletFont,
      fontWeight: "600",
      align: alignFor(lang),
      color: theme.fg,
    });
  });

  return els;
}

function tplConceptCard(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const isAr = lang === "ar";
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });

  /* Big concept callout: tinted rectangle with a thick accent bar on
     the leading edge, bullets stacked inside with check-style markers. */
  const cardX = PAD;
  const cardY = CONTENT_TOP;
  const cardW = W - PAD * 2;
  const cardH = H - cardY - CONTENT_BOTTOM;
  els.push({
    id: id(seed, "card"),
    kind: "shape", shape: "rect",
    x: cardX, y: cardY, w: cardW, h: cardH,
    bgColor: theme.accentSoft,
  });
  /* Leading accent bar. */
  const barW = 8;
  els.push({
    id: id(seed, "card-bar"),
    kind: "shape", shape: "rect",
    x: isAr ? cardX + cardW - barW : cardX,
    y: cardY, w: barW, h: cardH,
    bgColor: theme.accent,
  });

  /* Hero glyph in the trailing corner inside the card. */
  const iconName = card.visualDirection.icon
    ? resolveIcon(card.visualDirection.icon)
    : defaultIconForKind("concept-card");
  const iconSize = 96;
  const iconCx = isAr ? cardX + 80 : cardX + cardW - 80;
  const iconCy = cardY + cardH - 80;
  buildHaloIcon(seed, { cx: iconCx, cy: iconCy, size: iconSize, iconName, palette: theme }).forEach((e) => els.push(e));

  /* Bullets (with ✓ markers — concept cards usually enumerate facts). */
  const bullets = buildBullets({
    seed,
    items: card.talkingPoints,
    x: cardX + 40 + (isAr ? 0 : barW),
    y: cardY + 40,
    w: cardW - 80 - barW - iconSize - 32,
    cfg, lang, palette: theme, warnings,
    marker: "✓",
  });
  return [...els, ...bullets];
}

function tplComparison(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });

  /* Two side-by-side panels with a VS divider in the middle. RTL
     ordering: the first item lives on the right (reading order). */
  const isAr = lang === "ar";
  const top = CONTENT_TOP;
  const colH = H - top - CONTENT_BOTTOM;
  const vsBadge = 56;
  const gap = 32 + vsBadge;
  const colW = (W - PAD * 2 - gap) / 2;
  const left = PAD;
  const right = PAD + colW + gap;
  const points = card.talkingPoints;
  const half = Math.ceil(points.length / 2);
  const aPoints = points.slice(0, half);
  const bPoints = points.slice(half);
  const aX = isAr ? right : left;
  const bX = isAr ? left : right;

  /* Panel A — primary: filled with accentSoft for emphasis. */
  els.push({
    id: id(seed, "pa-bg"), kind: "shape", shape: "rect",
    x: aX, y: top, w: colW, h: colH,
    bgColor: theme.accentSoft,
  });
  els.push({
    id: id(seed, "pa-bar"), kind: "shape", shape: "rect",
    x: aX, y: top, w: colW, h: 6,
    bgColor: theme.accent,
  });
  els.push({
    id: id(seed, "ah"), kind: "text",
    x: aX + 24, y: top + 28, w: colW - 48, h: 32,
    text: lang === "ar" ? "الجانب الأول" : "Side A",
    fontSize: 18, fontWeight: "700", align: alignFor(lang),
    color: theme.accent,
  });
  buildBullets({
    seed: id(seed, "a"), items: aPoints,
    x: aX + 24, y: top + 76, w: colW - 48,
    cfg, lang, palette: theme, warnings,
    marker: "▸",
  }).forEach((el) => els.push(el));

  /* Panel B — secondary: outlined only, no fill. */
  els.push({
    id: id(seed, "pb-bg"), kind: "shape", shape: "rect",
    x: bX, y: top, w: colW, h: colH,
    bgColor: theme.surface, borderColor: theme.divider, borderWidth: 1,
  });
  els.push({
    id: id(seed, "pb-bar"), kind: "shape", shape: "rect",
    x: bX, y: top, w: colW, h: 6,
    bgColor: theme.divider,
  });
  els.push({
    id: id(seed, "bh"), kind: "text",
    x: bX + 24, y: top + 28, w: colW - 48, h: 32,
    text: lang === "ar" ? "الجانب الثاني" : "Side B",
    fontSize: 18, fontWeight: "700", align: alignFor(lang),
    color: theme.muted,
  });
  buildBullets({
    seed: id(seed, "b"), items: bPoints,
    x: bX + 24, y: top + 76, w: colW - 48,
    cfg, lang, palette: theme, warnings,
    marker: "▸",
  }).forEach((el) => els.push(el));

  /* VS divider in the gap between panels. */
  const vsCx = (left + right + colW) / 2;
  const vsCy = top + colH / 2;
  els.push({
    id: id(seed, "vs-bg"), kind: "shape", shape: "circle",
    x: vsCx - vsBadge / 2, y: vsCy - vsBadge / 2,
    w: vsBadge, h: vsBadge,
    bgColor: theme.accent,
  });
  els.push({
    id: id(seed, "vs-l"), kind: "text",
    x: vsCx - vsBadge / 2, y: vsCy - 14, w: vsBadge, h: 32,
    text: lang === "ar" ? "مقابل" : "VS",
    fontSize: 16, fontWeight: "800", align: "center",
    color: theme.textOnLight ? "#ffffff" : "#0a0a0a",
  });

  return els;
}

function tplVisualHero(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });

  /* Big halo'd icon on one side, bullets on the other. Side flips
     for RTL so the icon reads as the visual subject. */
  const isAr = lang === "ar";
  const iconName = card.visualDirection.icon
    ? resolveIcon(card.visualDirection.icon)
    : defaultIconForKind("visual-hero");
  const top = CONTENT_TOP + 8;
  const iconSize = 200;
  const heroBoxSize = 360;
  const heroCx = isAr ? PAD + heroBoxSize / 2 : W - PAD - heroBoxSize / 2;
  const heroCy = top + heroBoxSize / 2;
  buildHaloIcon(seed, {
    cx: heroCx, cy: heroCy, size: iconSize, iconName, palette: theme,
    haloFactor: 1.7,
  }).forEach((e) => els.push(e));

  /* Bullet column on the opposite side. */
  const bulletX = isAr ? PAD + heroBoxSize + 48 : PAD;
  const bulletW = W - PAD * 2 - heroBoxSize - 48;
  buildBullets({
    seed, items: card.talkingPoints,
    x: bulletX, y: top + 24, w: bulletW,
    cfg, lang, palette: theme, warnings,
    marker: "◆",
  }).forEach((el) => els.push(el));
  return els;
}

function tplSteps(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });

  /* Numbered cards arranged horizontally with a connecting line
     behind them so the eye reads them as a single flow. */
  const isAr = lang === "ar";
  const top = CONTENT_TOP + 16;
  const items = card.talkingPoints.slice(0, Math.min(4, cfg.maxBullets));
  const gap = 24;
  const totalW = W - PAD * 2;
  const cardW = (totalW - gap * (items.length - 1)) / Math.max(items.length, 1);
  const cardH = 300;
  const badge = 60;

  /* Connecting line behind cards (under the badges row). */
  if (items.length > 1) {
    els.push({
      id: id(seed, "flow"),
      kind: "shape", shape: "line",
      x: PAD + cardW / 2,
      y: top + badge / 2 + 28,
      w: totalW - cardW,
      h: 3,
      bgColor: theme.accentSoft,
      borderColor: theme.accentSoft,
    });
  }

  items.forEach((raw, i) => {
    const orderIndex = isAr ? items.length - 1 - i : i;
    const x = PAD + orderIndex * (cardW + gap);
    /* Card body (tinted, no border — softer than the old white card). */
    els.push({
      id: id(seed, `c${i}`), kind: "shape", shape: "rect",
      x, y: top + 44, w: cardW, h: cardH,
      bgColor: theme.accentSoft,
    });
    /* Number badge straddles the top edge. */
    els.push({
      id: id(seed, `cn${i}`), kind: "shape", shape: "circle",
      x: x + cardW / 2 - badge / 2, y: top + 16, w: badge, h: badge,
      bgColor: theme.accent,
    });
    els.push({
      id: id(seed, `cnl${i}`), kind: "text",
      x: x + cardW / 2 - badge / 2, y: top + 28, w: badge, h: 36,
      text: String(i + 1),
      fontSize: 28, fontWeight: "800", align: "center",
      color: theme.textOnLight ? "#ffffff" : "#0a0a0a",
    });
    /* Step body text. */
    els.push({
      id: id(seed, `ct${i}`), kind: "text",
      x: x + 20, y: top + 44 + badge + 12, w: cardW - 40, h: cardH - badge - 24,
      text: clip(raw, 84, warnings, `خطوة ${i + 1}`, lang),
      fontSize: 20, fontWeight: "600", align: "center",
      color: theme.fg,
    });
  });
  return els;
}

function tplInteractive(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });
  els.push(...buildCornerAccent(seed, theme, lang));

  const top = CONTENT_TOP;
  const promptText = card.talkingPoints[0]
    ?? card.purpose
    ?? (lang === "ar" ? "أضف سؤالك هنا" : "Add your question here");

  /* Phase 7 — activity slides emit a hasad-game element whenever the
     AI suggested a platform game OR (more commonly now) produced a
     gameQuestions set without picking a named game. The slide
     renderer shows the questions+answers directly; the live control
     panel runs them inline. `gameKind` is kept for backward compat
     with legacy decks but defaults to a neutral kahoot-shaped MCQ
     when the AI did not pick one. */
  const hasGameQuestions = !!(card.gameQuestions && card.gameQuestions.length > 0);
  if (card.gameSuggestion || hasGameQuestions) {
    const launcher: HasadGameElement = {
      id: id(seed, "game"), kind: "hasad-game",
      x: PAD, y: top, w: W - PAD * 2, h: H - top - CONTENT_BOTTOM,
      gameKind: card.gameSuggestion ?? "kahoot",
      prompt: clip(promptText, 200, warnings, "نص النشاط", lang),
      topic: card.title,
      accentColor: theme.accent,
    };
    if (hasGameQuestions) {
      launcher.questions = card.gameQuestions;
    }
    els.push(launcher);
    return els;
  }

  /* Activity placeholder — the editor swaps this for the real
     question. We just render a labelled prompt + 4-option scaffold. */
  const activity: ActivityElement = {
    id: id(seed, "act"), kind: "activity",
    x: PAD, y: top, w: W - PAD * 2, h: H - top - CONTENT_BOTTOM,
    activityKind: card.interactionHint === "poll" ? "poll"
      : card.interactionHint === "discussion" ? "open"
      : "mcq",
    prompt: clip(promptText, 200, warnings, "نص النشاط", lang),
    options: card.interactionHint === "poll"
      ? [lang === "ar" ? "موافق" : "Agree", lang === "ar" ? "محايد" : "Neutral", lang === "ar" ? "معارض" : "Disagree"]
      : card.interactionHint === "discussion"
        ? undefined
        : [lang === "ar" ? "خيار 1" : "Option 1", lang === "ar" ? "خيار 2" : "Option 2", lang === "ar" ? "خيار 3" : "Option 3", lang === "ar" ? "خيار 4" : "Option 4"],
    accentColor: theme.accent,
  };
  els.push(activity);
  return els;
}

function tplClosure(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;

  /* Calm centred summary with a haloed checkmark glyph on top, big
     centred title, and recap items rendered as pill chips. */
  const els: Element[] = [];
  const iconName = card.visualDirection.icon
    ? resolveIcon(card.visualDirection.icon)
    : "Trophy";
  buildHaloIcon(seed, {
    cx: W / 2, cy: 152, size: 88, iconName, palette: theme,
    haloFactor: 1.85,
  }).forEach((e) => els.push(e));

  els.push({
    id: id(seed, "title"), kind: "text",
    x: PAD, y: 248, w: W - PAD * 2, h: 80,
    text: clip(card.title, cfg.maxTitleChars, warnings, "العنوان", lang),
    fontSize: 52, fontWeight: "800", align: "center",
    color: theme.fg,
  });
  /* Underline rule. */
  const ruleW = 96;
  els.push({
    id: id(seed, "rule"), kind: "shape", shape: "rect",
    x: W / 2 - ruleW / 2, y: 332, w: ruleW, h: 4,
    bgColor: theme.accent,
  });

  if (card.subtitle) {
    els.push({
      id: id(seed, "subtitle"), kind: "text",
      x: PAD, y: 350, w: W - PAD * 2, h: 40,
      text: clip(card.subtitle, 120, warnings, "العنوان الفرعي", lang),
      fontSize: 22, fontWeight: "500", align: "center",
      color: theme.muted,
    });
  }

  /* Recap chips — each recap point rendered as a pill. Up to 4 fit
     in a single row; otherwise we wrap to 2 rows. */
  const items = card.talkingPoints.slice(0, Math.min(4, cfg.maxBullets));
  const chipH = 56;
  const chipGap = 16;
  const chipsTop = card.subtitle ? 420 : 392;
  const rowW = W - PAD * 2;
  const chipMaxW = (rowW - chipGap * (items.length - 1)) / Math.max(items.length, 1);
  items.forEach((raw, i) => {
    const x = PAD + i * (chipMaxW + chipGap);
    const text = clip(raw, 36, warnings, `سطر ${i + 1}`, lang);
    els.push({
      id: id(seed, `chip${i}`), kind: "shape", shape: "rect",
      x, y: chipsTop, w: chipMaxW, h: chipH,
      bgColor: theme.accentSoft,
    });
    els.push({
      id: id(seed, `chiptxt${i}`), kind: "text",
      x: x + 12, y: chipsTop + 14, w: chipMaxW - 24, h: chipH - 20,
      text,
      fontSize: 19, fontWeight: "600", align: "center",
      color: theme.fg,
    });
  });
  return els;
}

function tplTimeline(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });

  /* Horizontal axis with evenly distributed event nodes. Each node
     gets a tinted halo so it reads as a deliberate point on a track. */
  const isAr = lang === "ar";
  const axisY = 460;
  const axisX = PAD;
  const axisW = W - PAD * 2;
  /* Soft track behind axis. */
  els.push({
    id: id(seed, "track"), kind: "shape", shape: "rect",
    x: axisX, y: axisY - 2, w: axisW, h: 4,
    bgColor: theme.accentSoft,
  });
  els.push({
    id: id(seed, "axis"), kind: "shape", shape: "line",
    x: axisX, y: axisY, w: axisW, h: 2,
    bgColor: theme.accent, borderColor: theme.accent,
  });

  const items = card.talkingPoints.slice(0, Math.min(5, cfg.maxBullets));
  const stepX = axisW / Math.max(items.length, 1);
  items.forEach((raw, i) => {
    const orderIndex = isAr ? items.length - 1 - i : i;
    const cx = axisX + stepX * (orderIndex + 0.5);
    /* Halo */
    els.push({
      id: id(seed, `halo${i}`), kind: "shape", shape: "circle",
      x: cx - 28, y: axisY - 28, w: 56, h: 56,
      bgColor: theme.accentSoft,
    });
    /* Node */
    els.push({
      id: id(seed, `nd${i}`), kind: "shape", shape: "circle",
      x: cx - 14, y: axisY - 14, w: 28, h: 28,
      bgColor: theme.accent,
    });
    /* Number above */
    els.push({
      id: id(seed, `nl${i}`), kind: "text",
      x: cx - 60, y: axisY - 76, w: 120, h: 28,
      text: String(i + 1),
      fontSize: 22, fontWeight: "800", align: "center",
      color: theme.accent,
    });
    /* Label below */
    els.push({
      id: id(seed, `nt${i}`), kind: "text",
      x: cx - 110, y: axisY + 36, w: 220, h: 140,
      text: clip(raw, 80, warnings, `حدث ${i + 1}`, lang),
      fontSize: 18, fontWeight: "500", align: "center",
      color: theme.fg,
    });
  });
  return els;
}

function tplFormula(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });

  /* Big centred formula card — tinted bg with a subtle accent corner.
     talkingPoints[0] is the formula text; the rest are explanation
     bullets below. No KaTeX render yet — we emit a heavy mono text
     element so the editor can swap in the real widget without churn. */
  const top = CONTENT_TOP;
  const formulaH = 180;
  els.push({
    id: id(seed, "fcard"), kind: "shape", shape: "rect",
    x: PAD, y: top, w: W - PAD * 2, h: formulaH,
    bgColor: theme.accentSoft,
  });
  /* Top accent bar */
  els.push({
    id: id(seed, "fcard-bar"), kind: "shape", shape: "rect",
    x: PAD, y: top, w: W - PAD * 2, h: 6,
    bgColor: theme.accent,
  });
  const formulaText = card.talkingPoints[0]?.trim()
    ?? (lang === "ar" ? "أدخل المعادلة" : "Insert formula");
  els.push({
    id: id(seed, "ftext"), kind: "text",
    x: PAD + 24, y: top + 56, w: W - PAD * 2 - 48, h: formulaH - 80,
    text: clip(formulaText, 140, warnings, "المعادلة", lang),
    fontFamily: "monospace",
    fontSize: 40, fontWeight: "700", align: "center",
    color: theme.accent,
  });
  /* Explanation bullets */
  const expBullets = card.talkingPoints.slice(1);
  buildBullets({
    seed: id(seed, "exp"), items: expBullets,
    x: PAD, y: top + formulaH + 28, w: W - PAD * 2,
    cfg, lang, palette: theme, warnings,
    marker: "▸",
  }).forEach((el) => els.push(el));
  return els;
}

/* ── NEW: stat / quote / callout layouts. */

function tplStat(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });

  /* Up to 3 stat columns. Each talkingPoint may be:
       "92% — رضا المعلمين"   (number — label)
       "3 ساعات أسبوعياً"      (just a number; label inferred from purpose)
     We split on the em-dash / dash / colon / Arabic dash. */
  const isAr = lang === "ar";
  const items = card.talkingPoints.slice(0, 3);
  const top = CONTENT_TOP + 24;
  const colH = H - top - CONTENT_BOTTOM;
  const gap = 24;
  const colW = (W - PAD * 2 - gap * (items.length - 1)) / Math.max(items.length, 1);

  items.forEach((raw, i) => {
    const orderIndex = isAr ? items.length - 1 - i : i;
    const x = PAD + orderIndex * (colW + gap);
    /* Tinted bg */
    els.push({
      id: id(seed, `sb${i}`), kind: "shape", shape: "rect",
      x, y: top, w: colW, h: colH,
      bgColor: theme.accentSoft,
    });
    /* Side accent bar */
    els.push({
      id: id(seed, `sbar${i}`), kind: "shape", shape: "rect",
      x: isAr ? x + colW - 6 : x, y: top, w: 6, h: colH,
      bgColor: theme.accent,
    });
    /* Split into number + label. */
    const trimmed = clip(raw.trim(), 60, warnings, `إحصائية ${i + 1}`, lang);
    const splitMatch = trimmed.match(/^(.+?)\s*(?:[—\-:–]|—)\s*(.+)$/);
    const number = (splitMatch?.[1] ?? trimmed).trim();
    const label = (splitMatch?.[2] ?? "").trim();
    /* Big number */
    els.push({
      id: id(seed, `snum${i}`), kind: "text",
      x: x + 16, y: top + colH / 2 - 80, w: colW - 32, h: 110,
      text: number,
      fontSize: 84, fontWeight: "800", align: "center",
      color: theme.accent,
    });
    /* Label */
    if (label) {
      els.push({
        id: id(seed, `slbl${i}`), kind: "text",
        x: x + 16, y: top + colH / 2 + 36, w: colW - 32, h: 64,
        text: label,
        fontSize: 20, fontWeight: "600", align: "center",
        color: theme.fg,
      });
    }
  });
  return els;
}

function tplQuote(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, lang } = o;
  const seed = o.idSeed ?? `s${card.index}`;
  const isAr = lang === "ar";
  const els: Element[] = [];

  /* Tinted full-width panel. */
  const panelTop = 96;
  const panelH = H - panelTop * 2;
  els.push({
    id: id(seed, "panel"), kind: "shape", shape: "rect",
    x: PAD, y: panelTop, w: W - PAD * 2, h: panelH,
    bgColor: theme.accentSoft,
  });

  /* Big quotation glyph in the leading top corner. */
  els.push({
    id: id(seed, "qmark"), kind: "icon",
    x: isAr ? W - PAD - 120 - 32 : PAD + 32,
    y: panelTop + 24, w: 120, h: 120,
    iconName: "Quote",
    color: theme.accent,
  });

  /* Quote text — prefer talkingPoints[0]; if empty, fall back to the
     title (the AI sometimes puts the quote in the title field). */
  const quote = (card.talkingPoints[0] ?? card.title ?? "").trim();
  const quoteText = clip(quote, 240, [], "الاقتباس", lang);
  els.push({
    id: id(seed, "qtext"), kind: "text",
    x: PAD + 32, y: panelTop + 168,
    w: W - PAD * 2 - 64, h: panelH - 260,
    text: quoteText,
    fontSize: 36, fontWeight: "600", align: "center",
    color: theme.fg,
  });

  /* Attribution: "— talkingPoints[1]" or the subtitle, if present. */
  const attribution = (card.talkingPoints[1] ?? card.subtitle ?? "").trim();
  if (attribution) {
    els.push({
      id: id(seed, "qatt"), kind: "text",
      x: PAD, y: panelTop + panelH - 72, w: W - PAD * 2, h: 48,
      text: `— ${clip(attribution, 80, warnings, "العنوان الفرعي", lang)}`,
      fontSize: 22, fontWeight: "600", align: "center",
      color: theme.accent,
    });
  }

  return els;
}

function tplCallout(o: MaterializeOptions, warnings: string[]): Element[] {
  const { card, theme, density, lang } = o;
  const cfg = DENSITY[density];
  const seed = o.idSeed ?? `s${card.index}`;
  const els = buildHeader({ seed, card, cfg, lang, palette: theme, warnings });

  /* High-emphasis info box: tinted card with a wide accent strip at
     the top, a haloed icon on the leading edge, and a big headline +
     supporting bullets. */
  const isAr = lang === "ar";
  const cardX = PAD;
  const cardY = CONTENT_TOP;
  const cardW = W - PAD * 2;
  const cardH = H - cardY - CONTENT_BOTTOM;

  els.push({
    id: id(seed, "cbox"), kind: "shape", shape: "rect",
    x: cardX, y: cardY, w: cardW, h: cardH,
    bgColor: theme.accentSoft,
  });
  /* Top accent strip */
  els.push({
    id: id(seed, "cbar"), kind: "shape", shape: "rect",
    x: cardX, y: cardY, w: cardW, h: 8,
    bgColor: theme.accent,
  });

  /* Halo'd icon on the leading edge. */
  const iconName = card.visualDirection.icon
    ? resolveIcon(card.visualDirection.icon)
    : defaultIconForKind("callout");
  const iconCx = isAr ? cardX + cardW - 96 : cardX + 96;
  const iconCy = cardY + cardH / 2;
  buildHaloIcon(seed, { cx: iconCx, cy: iconCy, size: 88, iconName, palette: theme }).forEach((e) => els.push(e));

  /* Headline + bullets opposite the icon. */
  const textPad = 96 + 80;
  const textX = isAr ? cardX + 32 : cardX + textPad;
  const textW = cardW - textPad - 32;

  /* Big headline — first talking point treated as the lede. */
  const lede = (card.talkingPoints[0] ?? card.title ?? "").trim();
  els.push({
    id: id(seed, "lede"), kind: "text",
    x: textX, y: cardY + 56, w: textW, h: 60,
    text: clip(lede, 70, warnings, "سطر 1", lang),
    fontSize: 30, fontWeight: "800", align: alignFor(lang),
    color: theme.fg,
  });

  /* Remaining points as bullets. */
  buildBullets({
    seed, items: card.talkingPoints.slice(1),
    x: textX, y: cardY + 132, w: textW,
    cfg, lang, palette: theme, warnings,
    marker: "•",
  }).forEach((el) => els.push(el));

  return els;
}

/* ── Public entry. Materializes one outline card → one slide. */
export function materializeSlide(opts: MaterializeOptions): MaterializeResult {
  const warnings: string[] = [];
  const seed = opts.idSeed ?? `s${opts.card.index}`;

  let elements: Element[];
  switch (opts.card.kind) {
    case "title":         elements = tplTitle(opts, warnings); break;
    case "objectives":    elements = tplObjectives(opts, warnings); break;
    case "concept-card":  elements = tplConceptCard(opts, warnings); break;
    case "comparison":    elements = tplComparison(opts, warnings); break;
    case "visual-hero":   elements = tplVisualHero(opts, warnings); break;
    case "steps":         elements = tplSteps(opts, warnings); break;
    case "interactive":   elements = tplInteractive(opts, warnings); break;
    case "closure":       elements = tplClosure(opts, warnings); break;
    case "timeline":      elements = tplTimeline(opts, warnings); break;
    case "formula":       elements = tplFormula(opts, warnings); break;
    case "stat":          elements = tplStat(opts, warnings); break;
    case "quote":         elements = tplQuote(opts, warnings); break;
    case "callout":       elements = tplCallout(opts, warnings); break;
    default: {
      /* Defensive — outline schema enforces the kind enum, this is
         forward-compat only. */
      warnings.push(
        opts.lang === "ar"
          ? `نوع شريحة غير معروف، استخدمنا تخطيط القالب البسيط`
          : `Unknown slide kind — fell back to the basic concept-card layout`,
      );
      elements = tplConceptCard(opts, warnings);
    }
  }

  /* Speaker notes — concatenate purpose + interaction hint so the
     teacher sees the AI rationale without us inserting it into the
     visual canvas. */
  const noteLines = [opts.card.purpose];
  if (opts.card.interactionHint) {
    noteLines.push(
      opts.lang === "ar"
        ? `اقتراح تفاعل: ${opts.card.interactionHint}`
        : `Suggested interaction: ${opts.card.interactionHint}`,
    );
  }
  if (opts.card.source) noteLines.push(opts.card.source);

  return {
    slide: {
      id: seed,
      layout: opts.card.kind,
      notes: noteLines.join("\n").slice(0, 4000),
      activityType: opts.card.activityType ?? null,
      gameSuggestion: opts.card.gameSuggestion ?? null,
      strategyStage: opts.card.strategyStage ?? null,
      activityCreationStatus: opts.card.activityType || opts.card.gameSuggestion ? "idle" : null,
      elements,
    },
    warnings,
  };
}
