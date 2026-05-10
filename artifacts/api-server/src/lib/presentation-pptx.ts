/**
 * Server-side PPTX builder for presentation decks.
 *
 * Maps each slide-element kind to a `pptxgenjs` primitive. Coordinates
 * are converted from our canonical 1280×720 px canvas to PowerPoint's
 * 10 × 5.625 inch widescreen slide (PX_PER_INCH = 128). Text honors
 * RTL/LTR via the deck `language`; images are downloaded and embedded
 * inline so the resulting file is fully self-contained (no external
 * URLs to break later). Icons are rendered as a labeled placeholder
 * since lucide SVGs are not first-class pptx primitives — exporting
 * for "edit in PowerPoint" is best-effort, the canonical view is the
 * web present mode.
 */
import PptxGenJS from "pptxgenjs";
import { safeFetchAsDataUri } from "./url-safety";

type Kind = "text" | "image" | "icon" | "shape" | "activity";
interface Element {
  id: string;
  kind: Kind;
  x: number; y: number; w: number; h: number;
  rotation?: number;
  // text
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  align?: "start" | "center" | "end" | "justify";
  color?: string;
  bgColor?: string;
  // image
  url?: string;
  // icon
  iconName?: string;
  // shape
  shape?: "rect" | "circle" | "line" | "arrow" | "divider";
  borderColor?: string;
  borderWidth?: number;
  // activity (Phase 2A — read-only export render)
  activityKind?: "mcq" | "true_false" | "open" | "poll";
  prompt?: string;
  options?: string[];
  accentColor?: string;
}
interface Slide {
  id: string;
  background?: string;
  backgroundImage?: string;
  elements?: Element[];
}
export interface PresentationForExport {
  title: string;
  language: "ar" | "en";
  /* Deck-level theme key (e.g. "harvest", "sunset"). When a slide has
     no explicit `background`, we resolve the theme to a representative
     dark/light fill so the exported PPTX preserves the visual mood
     instead of falling back to white — which would make the deck's
     light-coloured text invisible. */
  theme?: string;
  pattern?: string;
  slides: Slide[];
}

/* ── Server-side theme palette ─────────────────────────────────────────
   pptxgenjs has no first-class CSS-style mesh / multi-stop gradient
   for slide backgrounds (the OOXML writer only exposes solid fills
   and embedded images). To keep the export visually faithful without
   shipping a headless browser, we resolve each editor theme key to a
   single representative dark (or light) hex that matches the dominant
   tone of the live mesh-gradient. This keeps light text readable and
   stops the whole deck from rendering on a stark white background.

   Keep this map in sync with `SLIDE_THEMES` in
   `artifacts/homework-app/src/lib/slide-themes.ts`. */
const THEME_BG: Record<string, { bg: string; light?: boolean }> = {
  harvest:  { bg: "173F29" },
  ocean:    { bg: "0C2A55" },
  sunset:   { bg: "7C2D3A" },
  midnight: { bg: "15152E" },
  rose:     { bg: "9D174D" },
  royal:    { bg: "1E3A8A" },
  noor:     { bg: "2A1F0A" },
  sage:     { bg: "3A5A40" },
  sand:     { bg: "B08968" },
  obsidian: { bg: "1E293B" },
  pine:     { bg: "2C4034" },
  ink:      { bg: "1A1A1D" },
  /* Light themes — stay light, dark text is already readable. */
  linen:    { bg: "F5ECD9", light: true },
  mist:     { bg: "E8EEF2", light: true },
  clay:     { bg: "FBEEE0", light: true },
};

function resolveSlideBg(
  slideBg: string | undefined,
  theme: string | undefined,
): { color: string } | undefined {
  /* Explicit per-slide background wins. Treat white-ish as "no
     override" so the theme can still kick in for default slides. */
  if (slideBg && slideBg.trim() && slideBg.toLowerCase() !== "#ffffff" && slideBg.toLowerCase() !== "#fff") {
    return { color: toHex(slideBg, "FFFFFF") };
  }
  const t = theme ? THEME_BG[theme.toLowerCase()] : undefined;
  if (t) return { color: t.bg };
  return undefined;
}

/* ── Lucide icon → Unicode glyph map ────────────────────────────────
   pptxgenjs has no native lucide / SVG icon primitive. We previously
   rendered icons as a dashed placeholder box with the literal English
   icon name ("Sparkles") inside, which looked broken in PowerPoint.
   We now render a centred Unicode glyph in the icon's colour — much
   closer to the editor's visual weight. Falls back to a generic dot
   so unknown icons still feel like an intentional element. */
const ICON_GLYPH: Record<string, string> = {
  sparkles: "✦", sparkle: "✦", star: "★", stars: "✬",
  heart: "♥", check: "✓", "check-circle": "✓", x: "✕", "x-circle": "✕",
  circle: "●", square: "■", triangle: "▲", diamond: "◆",
  sun: "☀", moon: "☾", cloud: "☁", flag: "⚑", bookmark: "⚑",
  bell: "🔔", info: "ⓘ", "alert-circle": "⚠", "alert-triangle": "⚠",
  arrow: "→", "arrow-right": "→", "arrow-left": "←", "arrow-up": "↑", "arrow-down": "↓",
  plus: "+", minus: "−",
  book: "📖", "book-open": "📖", lightbulb: "💡", target: "◎",
  trophy: "🏆", award: "🏅", crown: "♛",
  music: "♪", play: "▶", pause: "⏸",
  message: "💬", "message-circle": "💬", "message-square": "💬",
  zap: "⚡", flame: "🔥", flower: "✿", leaf: "❀",
  pencil: "✎", edit: "✎", "edit-2": "✎", "edit-3": "✎",
  search: "🔍", eye: "👁", lock: "🔒", unlock: "🔓",
  user: "👤", users: "👥",
  calendar: "📅", clock: "⏰", map: "🗺", "map-pin": "📍",
};
function iconGlyph(name: string | undefined): string {
  if (!name) return "●";
  return ICON_GLYPH[name.toLowerCase()] ?? "●";
}

const PX_PER_INCH = 128;
const SLIDE_W_IN = 1280 / PX_PER_INCH;   // 10
const SLIDE_H_IN = 720 / PX_PER_INCH;    // 5.625

function px(p: number): number { return Math.max(0, p / PX_PER_INCH); }

/* ── Colour parsing ──────────────────────────────────────────────────
   pptxgenjs wants 6-char hex without `#`. Editor / theme palettes
   ship a much wider range — `#rgb`, `#rrggbb`, `rgb(…)`, `rgba(…)`,
   `hsl(…)`, and a small set of CSS names (white/black/transparent).
   The previous `toHex` only matched `#rrggbb` / `#rgb`, so any
   `rgba(255,255,255,0.10)` (the frosted-card colour used by every
   slide-template `surface`) was silently coerced to the *fallback*
   "FFFFFF" (solid white). The downstream effect was catastrophic for
   dark themes: cards painted as solid-white rectangles, then white
   text drawn on top of them — invisible. We now parse all of these
   formats and return both the opaque hex and an alpha so the caller
   can pass the correct PowerPoint transparency. */
const CSS_COLOR_NAMES: Record<string, string> = {
  white: "FFFFFF", black: "000000", red: "FF0000", green: "008000",
  blue: "0000FF", yellow: "FFFF00", cyan: "00FFFF", magenta: "FF00FF",
  gray: "808080", grey: "808080", silver: "C0C0C0",
  transparent: "FFFFFF",
};
function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
function clamp255(n: number): number { return Math.max(0, Math.min(255, Math.round(n))); }
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  /* h in [0,360), s/l in [0,1]. Standard conversion. */
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [clamp255((r1 + m) * 255), clamp255((g1 + m) * 255), clamp255((b1 + m) * 255)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, "0");
  return (h(r) + h(g) + h(b)).toUpperCase();
}
/* Returns { hex: "RRGGBB", alpha: 0-1 } or null if it couldn't parse. */
function parseColor(c: string | undefined | null): { hex: string; alpha: number } | null {
  if (!c) return null;
  const s = String(c).trim().toLowerCase();
  if (!s) return null;
  if (s === "transparent" || s === "none") return { hex: "FFFFFF", alpha: 0 };
  /* Named colours — small allowlist, anything else falls through. */
  if (CSS_COLOR_NAMES[s]) return { hex: CSS_COLOR_NAMES[s], alpha: s === "transparent" ? 0 : 1 };
  /* #rgb / #rrggbb / #rrggbbaa. */
  const m6 = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m6) {
    return { hex: m6[1].toUpperCase(), alpha: m6[2] ? parseInt(m6[2], 16) / 255 : 1 };
  }
  const m3 = /^#?([0-9a-f]{3})([0-9a-f])?$/.exec(s);
  if (m3) {
    const [r, g, b] = m3[1].split("");
    const hex = (r + r + g + g + b + b).toUpperCase();
    const a = m3[2] ? parseInt(m3[2] + m3[2], 16) / 255 : 1;
    return { hex, alpha: a };
  }
  /* rgb(R G B) / rgb(R, G, B) / rgba(…). Accept either commas or
     spaces, integer or 0-100% components, alpha as 0-1 or %. */
  const mr = /^rgba?\(\s*([0-9.]+%?)[\s,]+([0-9.]+%?)[\s,]+([0-9.]+%?)(?:[\s,/]+([0-9.]+%?))?\s*\)$/.exec(s);
  if (mr) {
    const toByte = (t: string): number => t.endsWith("%") ? Math.round(parseFloat(t) * 2.55) : parseFloat(t);
    const toAlpha = (t: string | undefined): number => {
      if (!t) return 1;
      return clamp01(t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t));
    };
    return { hex: rgbToHex(toByte(mr[1]), toByte(mr[2]), toByte(mr[3])), alpha: toAlpha(mr[4]) };
  }
  /* hsl(H S% L%) / hsla(…). */
  const mh = /^hsla?\(\s*([0-9.]+)(?:deg)?[\s,]+([0-9.]+)%[\s,]+([0-9.]+)%(?:[\s,/]+([0-9.]+%?))?\s*\)$/.exec(s);
  if (mh) {
    const [r, g, b] = hslToRgb(parseFloat(mh[1]), parseFloat(mh[2]) / 100, parseFloat(mh[3]) / 100);
    const a = mh[4] ? clamp01(mh[4].endsWith("%") ? parseFloat(mh[4]) / 100 : parseFloat(mh[4])) : 1;
    return { hex: rgbToHex(r, g, b), alpha: a };
  }
  return null;
}

/* String hex helper kept for the many callers that just want a colour
   string. Drops alpha — use `toFill()` when you need transparency. */
function toHex(c: string | undefined, fallback: string): string {
  const parsed = parseColor(c);
  return parsed ? parsed.hex : fallback;
}

/* Fill helper used by shape / text-bg / activity-card primitives.
   Returns the pptxgenjs `{ color, transparency }` object so semi-
   transparent palette colours (e.g. the frosted-card "surface" of
   `rgba(255,255,255,0.10)`) actually render as a translucent overlay
   over the slide background instead of as a solid white block. */
function toFill(c: string | undefined, fallback: string): { color: string; transparency?: number } {
  const parsed = parseColor(c);
  if (!parsed) return { color: fallback };
  /* pptxgenjs `transparency` is 0 (opaque) – 100 (fully transparent). */
  if (parsed.alpha >= 0.99) return { color: parsed.hex };
  return { color: parsed.hex, transparency: Math.round((1 - parsed.alpha) * 100) };
}

/* Map our logical align values to pptxgenjs physical alignment.
   `start` and `end` are direction-aware (CSS-style): under RTL they
   swap so AR text aligned to `start` lands on the right edge. */
function mapAlign(a: string | undefined, isAr: boolean): "left" | "center" | "right" | "justify" {
  if (a === "center") return "center";
  if (a === "justify") return "justify";
  if (a === "end") return isAr ? "left" : "right";
  // "start" or default
  return isAr ? "right" : "left";
}

/* ── Font handling ────────────────────────────────────────────────────
   pptxgenjs writes `fontFace` as a single OOXML font name (NOT a CSS
   stack). If we hand it `"Cairo, Tajawal, Noto Naskh Arabic"`,
   PowerPoint searches for one literal family with that whole name,
   fails, and falls back to its default — which on many Windows
   installs without Arabic-aware Cairo / Tajawal renders Arabic as
   tofu / Chinese-looking glyphs. Fix: always hand pptxgenjs a single
   safe font that ships with PowerPoint and supports Arabic.

   `Arial` is the most reliable Arabic-capable font that ships with
   every PowerPoint install (Windows + Mac + LibreOffice). It's the
   safest universal default for AR. For LTR we use `Calibri` which is
   the modern PowerPoint default. Users can still pick a custom family
   via the editor — we just refuse to forward CSS stacks unsanitised. */
const SAFE_AR_FONTS = new Set([
  "arial", "tahoma", "calibri", "times new roman",
  "cairo", "tajawal", "amiri", "noto naskh arabic", "noto sans arabic",
  "geeza pro", "scheherazade",
]);
const SAFE_LATIN_FONTS = new Set([
  "calibri", "arial", "helvetica", "tahoma", "times new roman",
  "georgia", "verdana", "trebuchet ms", "inter",
]);
function safeFontFor(family: string | undefined, isAr: boolean): string {
  const fallback = isAr ? "Arial" : "Calibri";
  if (!family) return fallback;
  /* Take the first family in a CSS stack ("Tajawal, sans-serif" → "Tajawal")
     and strip quotes/whitespace. */
  const first = family.split(",")[0]?.replace(/['"]/g, "").trim();
  if (!first) return fallback;
  /* Skip generic CSS keywords. */
  if (/^(serif|sans-serif|monospace|cursive|system-ui|inherit|initial)$/i.test(first)) return fallback;
  const allowed = isAr ? SAFE_AR_FONTS : SAFE_LATIN_FONTS;
  return allowed.has(first.toLowerCase()) ? first : fallback;
}

/* Robust bold detection across `400` / `"700"` / `"bold"` representations. */
function isBoldWeight(w: string | number | undefined): boolean {
  if (w === undefined || w === null) return false;
  if (typeof w === "number") return w >= 600;
  const s = String(w).trim().toLowerCase();
  if (s === "bold" || s === "bolder" || s === "black" || s === "heavy" || s === "semibold" || s === "extrabold") return true;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 600;
}

/* SSRF-safe URL → data URI. Delegates to the shared `safeFetchAsDataUri`
   helper which rejects private IPs, caps payload size, and times out
   so a malicious image URL on a slide can't probe internal services. */
async function urlToDataUri(url: string): Promise<string | null> {
  return safeFetchAsDataUri(url);
}

export async function buildPptx(deck: PresentationForExport): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.defineLayout({ name: "HASAD_16_9", width: SLIDE_W_IN, height: SLIDE_H_IN });
  pptx.layout = "HASAD_16_9";
  pptx.title = deck.title;
  const isAr = deck.language === "ar";

  for (const slide of deck.slides ?? []) {
    const s = pptx.addSlide();
    /* Background priority: per-slide image → per-slide solid hex →
       deck theme palette → PowerPoint default white. The theme
       fallback is the critical fix for "Arabic title disappeared on
       export": light-on-light text becomes invisible when the theme
       gradient is dropped, so we stamp a representative dark fill
       instead. */
    const themeBg = resolveSlideBg(slide.background, deck.theme);
    if (themeBg) s.background = themeBg;
    if (slide.backgroundImage) {
      const data = await urlToDataUri(slide.backgroundImage);
      if (data) s.background = { data };
    }

    for (const el of slide.elements ?? []) {
      const pos = { x: px(el.x), y: px(el.y), w: px(el.w), h: px(el.h) };
      const rot = typeof el.rotation === "number" ? el.rotation : 0;

      if (el.kind === "text") {
        s.addText(el.text ?? "", {
          ...pos,
          rotate: rot,
          fontFace: safeFontFor(el.fontFamily, isAr),
          fontSize: Math.round((el.fontSize ?? 28) * 0.75), // px → pt
          bold: isBoldWeight(el.fontWeight),
          color: toHex(el.color, "1F2937"),
          fill: el.bgColor ? toFill(el.bgColor, "FFFFFF") : undefined,
          align: mapAlign(el.align, isAr),
          rtlMode: isAr,
          lang: isAr ? "ar-SA" : "en-US",
          valign: "top",
          margin: 0,
          wrap: true,
        });
        continue;
      }

      if (el.kind === "image" && el.url) {
        const data = await urlToDataUri(el.url);
        if (data) {
          s.addImage({ ...pos, rotate: rot, data });
        }
        continue;
      }

      if (el.kind === "shape") {
        /* Use the alpha-aware `toFill` so the AI-templated frosted
           cards (`rgba(255,255,255,0.10)` surface) render as a real
           translucent overlay over the dark theme background instead
           of a solid white block that hides the white text on top. */
        const fill = el.bgColor ? toFill(el.bgColor, "FFFFFF") : { type: "none" as const };
        const line = el.borderWidth
          ? { color: toHex(el.borderColor, "1F2937"), width: el.borderWidth }
          : undefined;
        if (el.shape === "circle") {
          s.addShape(pptx.ShapeType.ellipse, { ...pos, rotate: rot, fill, line });
        } else if (el.shape === "line" || el.shape === "divider") {
          s.addShape(pptx.ShapeType.line, {
            ...pos, rotate: rot,
            line: { color: toHex(el.borderColor, "1F2937"), width: Math.max(1, el.borderWidth ?? 4) },
          });
        } else if (el.shape === "arrow") {
          s.addShape(pptx.ShapeType.line, {
            ...pos, rotate: rot,
            line: {
              color: toHex(el.borderColor, "1F2937"),
              width: Math.max(1, el.borderWidth ?? 4),
              endArrowType: "triangle",
            },
          });
        } else {
          s.addShape(pptx.ShapeType.rect, { ...pos, rotate: rot, fill, line, rectRadius: 0.05 });
        }
        continue;
      }

      if (el.kind === "activity") {
        // Phase 2A — read-only export render. Brand-bordered card
        // with the prompt + numbered options so the slide is
        // presentable in PowerPoint without the interactive runtime.
        const accent = toHex(el.accentColor, "225739");
        s.addShape(pptx.ShapeType.roundRect, {
          ...pos, rotate: rot,
          fill: { color: "FFFFFF" },
          line: { color: accent, width: 2 },
          rectRadius: 0.08,
        });
        const labelMap: Record<string, string> = {
          mcq: isAr ? "اختيار من متعدد" : "Multiple choice",
          true_false: isAr ? "صح / خطأ" : "True / False",
          open: isAr ? "إجابة مفتوحة" : "Open answer",
          poll: isAr ? "تصويت" : "Poll",
        };
        const label = labelMap[el.activityKind ?? "open"] ?? (isAr ? "نشاط" : "Activity");
        const promptText = el.prompt ?? "";
        const lines: Array<{ text: string; options: any }> = [
          { text: `[${label}]  `, options: { color: accent, bold: true, fontSize: 11 } },
          { text: promptText, options: { color: "0F172A", bold: true, fontSize: 16, breakLine: true } },
        ];
        const opts = el.options ?? [];
        const tfOpts = el.activityKind === "true_false" && opts.length === 0
          ? (isAr ? ["صح", "خطأ"] : ["True", "False"])
          : opts;
        if ((el.activityKind === "mcq" || el.activityKind === "poll" || el.activityKind === "true_false") && tfOpts.length) {
          for (let i = 0; i < tfOpts.length; i++) {
            lines.push({
              text: `${String.fromCharCode(65 + i)}. ${tfOpts[i]}`,
              options: { color: "1F2937", fontSize: 13, breakLine: true },
            });
          }
        } else if (el.activityKind === "open") {
          lines.push({ text: isAr ? "مساحة للإجابة…" : "Answer space…", options: { color: "94A3B8", italic: true, fontSize: 12 } });
        }
        s.addText(lines, {
          x: pos.x + 0.18, y: pos.y + 0.18,
          w: pos.w - 0.36, h: pos.h - 0.36,
          fontFace: safeFontFor(undefined, isAr),
          align: isAr ? "right" : "left",
          rtlMode: isAr,
          lang: isAr ? "ar-SA" : "en-US",
          valign: "top",
          margin: 0,
          wrap: true,
        });
        continue;
      }

      if (el.kind === "icon") {
        /* Lucide SVG → pptx is not a first-class primitive. Render a
           single Unicode glyph (centred, in the icon's colour) sized
           to ~70% of the box's shorter edge. Much cleaner in
           PowerPoint than the previous dashed placeholder + English
           icon name, and reads as an intentional visual element. */
        const glyph = iconGlyph(el.iconName);
        const shortIn = Math.min(pos.w, pos.h);
        const fontPt = Math.max(12, Math.round(shortIn * 72 * 0.7));
        s.addText(glyph, {
          ...pos, rotate: rot,
          fontFace: safeFontFor(undefined, false),
          fontSize: fontPt,
          color: toHex(el.color, "D9A521"),
          align: "center",
          valign: "middle",
          margin: 0,
        });
        continue;
      }
    }
  }

  // pptxgenjs returns a Promise<ArrayBuffer> when output is "nodebuffer"
  // in some versions; normalise to Buffer.
  const out = await pptx.write({ outputType: "nodebuffer" });
  if (Buffer.isBuffer(out)) return out;
  if (out instanceof ArrayBuffer) return Buffer.from(out);
  if (typeof out === "string") return Buffer.from(out, "binary");
  return Buffer.from(out as Uint8Array);
}
