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
import { Resvg } from "@resvg/resvg-js";
import { designAssetSvg, isDesignAsset } from "@workspace/slide-templates";

type Kind = "text" | "image" | "icon" | "shape" | "activity" | "hasad-game" | "hasad-activity" | "video-embed";
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
  /** Address of this deck's present page (no slide number); used to link game cards back to Hasad. */
  presentUrl?: string;
  /** slide index → public (no-account) link of that slide's classroom game */
  slideLinks?: Record<number, string>;
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
/* Only fonts that ship with PowerPoint/Keynote and carry Arabic glyphs. Web families such as Cairo, Tajawal or
   Readex are NOT installed on a teacher's computer: PowerPoint then substitutes a face without Arabic and the
   text shows as Chinese-looking glyphs, so those names are never forwarded (see ARABIC_WEB_TO_SAFE below). */
const SAFE_AR_FONTS = new Set([
  "arial", "tahoma", "calibri", "times new roman",
  "geeza pro",
]);
/* Serif web families keep a serif look via Times New Roman; every other Arabic web family becomes Arial. */
const ARABIC_SERIF_WEB = new Set(["amiri", "noto naskh arabic", "scheherazade"]);
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
  if (isAr && ARABIC_SERIF_WEB.has(first.toLowerCase())) return "Times New Roman";
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
  /* design art (hd://…) is drawn locally: SVG → PNG so PowerPoint shows it as an ordinary movable picture */
  if (isDesignAsset(url)) return designAssetToPngDataUri(url);
  return safeFetchAsDataUri(url);
}

const designPngCache = new Map<string, string>();
function designAssetToPngDataUri(url: string): string | null {
  const hit = designPngCache.get(url);
  if (hit) return hit;
  const svg = designAssetSvg(url);
  if (!svg) return null;
  try {
    const png = new Resvg(svg, { fitTo: { mode: "zoom", value: 2 }, font: { loadSystemFonts: true } }).render().asPng();
    const out = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    if (designPngCache.size > 400) designPngCache.clear();
    designPngCache.set(url, out);
    return out;
  } catch {
    return null;
  }
}

export async function buildPptx(deck: PresentationForExport): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.defineLayout({ name: "HASAD_16_9", width: SLIDE_W_IN, height: SLIDE_H_IN });
  pptx.layout = "HASAD_16_9";
  pptx.title = deck.title;
  const isAr = deck.language === "ar";

  for (const [slideIdx, slide] of (deck.slides ?? []).entries()) {
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

      /* Live-only elements have no PowerPoint equivalent, but dropping them left the slide blank. Print a
         clear read-only card: the game's questions (without marking the answers) or the linked activity /
         video, plus a pointer to open the deck in Hasad to run it. */
      /* A Hasad game with questions is drawn the way the platform shows it: tag + question counter, the topic,
         the first question, and its options as colour tiles with letter badges, then a link button. */
      if (el.kind === "hasad-game" && Array.isArray((el as unknown as { questions?: unknown[] }).questions)
        && ((el as unknown as { questions: unknown[] }).questions.length > 0)) {
        const g = el as unknown as {
          accentColor?: string; topic?: string; prompt?: string; gameKind?: string;
          questions: Array<{ prompt: string; options: string[] }>;
        };
        const accent = toHex(g.accentColor, "225739");
        const publicLink = deck.slideLinks?.[slideIdx];
        const slideLink = publicLink ?? (deck.presentUrl ? `${deck.presentUrl}?slide=${slideIdx + 1}` : undefined);
        const q = g.questions[0];
        const opts = (q.options ?? []).slice(0, 4);
        const total = g.questions.length;
        const TILE = [
          { bg: "EF4444", soft: "FEE2E2", fg: "FFFFFF" },
          { bg: "2563EB", soft: "DBEAFE", fg: "FFFFFF" },
          { bg: "F59E0B", soft: "FEF3C7", fg: "1F2937" },
          { bg: "16A34A", soft: "DCFCE7", fg: "FFFFFF" },
        ];
        const letters = isAr ? ["أ", "ب", "ج", "د"] : ["A", "B", "C", "D"];
        const GAME_AR: Record<string, string> = {
          kahoot: "وميض الصف", tug: "شد الحبل (وضع الصف)", xo: "إكس أو الصف", solo: "مسابقة ذاتية", wheel: "العجلة الدوارة",
          rocket: "سباق الصواريخ", millionaire: "من سيربح المليون", hack: "تحدي الاختراق",
        };
        const tag = isAr ? `نشاط تفاعلي · ${GAME_AR[g.gameKind ?? ""] ?? "حصاد"}` : "Interactive activity";
        const f = Math.min(1, pos.h / 5);                       // shrink everything when the card is short
        const pad = 0.22 * f;
        const rtl = isAr;
        const innerW = pos.w - pad * 2;
        const rightAligned = (w: number, off = 0) => (rtl ? pos.x + pos.w - pad - off - w : pos.x + pad + off);

        // card
        s.addShape(pptx.ShapeType.roundRect, {
          ...pos, rotate: rot, fill: { color: "FFFFFF" }, line: { color: accent, width: 3 }, rectRadius: 0.12,
        });
        let y = pos.y + pad;
        // tag chip + counter
        const chipW = Math.min(innerW * 0.62, 3.6);
        s.addShape(pptx.ShapeType.roundRect, {
          x: rightAligned(chipW), y, w: chipW, h: 0.36 * f, fill: { color: accent }, line: { color: accent, width: 0 }, rectRadius: 0.18,
        });
        s.addText(tag, {
          x: rightAligned(chipW), y, w: chipW, h: 0.36 * f, align: "center", valign: "middle",
          color: "FFFFFF", bold: true, fontSize: Math.round(12 * f + 1), fontFace: safeFontFor(undefined, isAr), rtlMode: rtl, margin: 0,
        });
        const cntW = 1.2;
        s.addShape(pptx.ShapeType.roundRect, {
          x: rtl ? pos.x + pad : pos.x + pos.w - pad - cntW, y: y + 0.02, w: cntW, h: 0.32 * f,
          fill: { color: "D9A521" }, line: { color: "D9A521", width: 0 }, rectRadius: 0.1,
        });
        s.addText(isAr ? `${total} سؤال` : `${total} question${total === 1 ? "" : "s"}`, {
          x: rtl ? pos.x + pad : pos.x + pos.w - pad - cntW, y: y + 0.02, w: cntW, h: 0.32 * f,
          align: "center", valign: "middle", color: "1F2937", bold: true, fontSize: Math.round(11 * f + 1),
          fontFace: safeFontFor(undefined, isAr), rtlMode: rtl, margin: 0,
        });
        y += 0.46 * f;
        // topic
        const topic = (g.topic || g.prompt || "").slice(0, 90);
        if (topic) {
          s.addText(topic, {
            x: pos.x + pad, y, w: innerW, h: 0.4 * f, align: rtl ? "right" : "left", valign: "middle",
            color: accent, bold: true, fontSize: Math.round(15 * f + 2), fontFace: safeFontFor(undefined, isAr), rtlMode: rtl, margin: 0,
          });
          y += 0.46 * f;
        }
        // question
        const qH = 1.0 * f;
        s.addText(`${total > 1 ? (isAr ? "س1. " : "Q1. ") : ""}${q.prompt}`.slice(0, 220), {
          x: pos.x + pad, y, w: innerW, h: qH, align: rtl ? "right" : "left", valign: "top",
          color: "0F172A", bold: true, fontSize: Math.round(20 * f + 2), fontFace: safeFontFor(undefined, isAr),
          rtlMode: rtl, lang: isAr ? "ar-SA" : "en-US", margin: 0, wrap: true, fit: "shrink",
        });
        y += qH + 0.08 * f;
        // option tiles
        const cols = opts.length > 2 ? 2 : 1;
        const gap = 0.16 * f;
        const tileW = (innerW - gap * (cols - 1)) / cols;
        const tileH = 0.66 * f;
        opts.forEach((opt, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const tx = rightAligned(tileW, col * (tileW + gap));
          const ty = y + row * (tileH + gap);
          const c = TILE[i % TILE.length];
          s.addShape(pptx.ShapeType.roundRect, {
            x: tx, y: ty, w: tileW, h: tileH, fill: { color: c.soft }, line: { color: c.bg, width: 2 }, rectRadius: 0.12,
          });
          const badge = 0.42 * f;
          const bx = rtl ? tx + tileW - badge - 0.12 : tx + 0.12;
          s.addShape(pptx.ShapeType.roundRect, {
            x: bx, y: ty + (tileH - badge) / 2, w: badge, h: badge, fill: { color: c.bg }, line: { color: c.bg, width: 0 }, rectRadius: 0.08,
          });
          s.addText(letters[i] ?? String(i + 1), {
            x: bx, y: ty + (tileH - badge) / 2, w: badge, h: badge, align: "center", valign: "middle",
            color: c.fg, bold: true, fontSize: Math.round(14 * f + 1), fontFace: safeFontFor(undefined, isAr), margin: 0,
          });
          s.addText(opt.slice(0, 90), {
            x: rtl ? tx + 0.14 : tx + badge + 0.26, y: ty, w: tileW - badge - 0.4, h: tileH,
            align: rtl ? "right" : "left", valign: "middle", color: "0F172A", bold: true,
            fontSize: Math.round(14 * f + 2), fontFace: safeFontFor(undefined, isAr), rtlMode: rtl, lang: isAr ? "ar-SA" : "en-US",
            margin: 0, wrap: true, fit: "shrink",
          });
        });
        const rows = Math.ceil(opts.length / cols);
        y += rows * (tileH + gap) + 0.04 * f;
        // link button + remaining count
        const btnW = Math.min(innerW * 0.55, 3.8), btnH = 0.46 * f;
        const btnY = Math.min(y, pos.y + pos.h - pad - btnH);
        s.addShape(pptx.ShapeType.roundRect, {
          x: rightAligned(btnW), y: btnY, w: btnW, h: btnH, fill: { color: "D9A521" }, line: { color: "B88A12", width: 1.5 }, rectRadius: 0.2,
          ...(slideLink ? { hyperlink: { url: slideLink, tooltip: isAr ? "تشغيل اللعبة في حصاد" : "Run the game in Hasad" } } : {}),
        });
        s.addText(slideLink ? (isAr ? "▶ العب الآن" : "▶ Play now") : (isAr ? "افتح العرض في حصاد للتشغيل" : "Open in Hasad to run"), {
          x: rightAligned(btnW), y: btnY, w: btnW, h: btnH, align: "center", valign: "middle",
          color: "1C1003", bold: true, fontSize: Math.round(13 * f + 1), fontFace: safeFontFor(undefined, isAr), rtlMode: rtl, margin: 0,
          ...(slideLink ? { hyperlink: { url: slideLink } } : {}),
        });
        if (total > 1) {
          const moreW = Math.max(1.2, innerW - btnW - 0.2);
          s.addText(isAr ? `+ ${total - 1} أسئلة أخرى` : `+ ${total - 1} more`, {
            x: rtl ? pos.x + pad : pos.x + pos.w - pad - moreW, y: btnY, w: moreW, h: btnH,
            align: rtl ? "left" : "right", valign: "middle", color: "64748B", fontSize: Math.round(12 * f + 1),
            fontFace: safeFontFor(undefined, isAr), rtlMode: rtl, margin: 0,
          });
        }
        continue;
      }

      if (el.kind === "hasad-game" || el.kind === "hasad-activity" || el.kind === "video-embed") {
        const any = el as unknown as {
          accentColor?: string; topic?: string; prompt?: string; gameKind?: string; gameType?: string;
          questions?: Array<{ prompt: string; options: string[] }>; assignmentTitle?: string;
          title?: string; url?: string;
        };
        const accent = toHex(any.accentColor, "225739");
        const publicLink = deck.slideLinks?.[slideIdx];
        const slideLink = publicLink ?? (deck.presentUrl ? `${deck.presentUrl}?slide=${slideIdx + 1}` : undefined);
        s.addShape(pptx.ShapeType.roundRect, {
          ...pos, rotate: rot,
          fill: { color: "FFFFFF" },
          line: { color: accent, width: 2.5 },
          rectRadius: 0.08,
          ...(slideLink ? { hyperlink: { url: slideLink, tooltip: isAr ? "افتح العرض في حصاد" : "Open in Hasad" } } : {}),
        });
        const GAME_AR: Record<string, string> = {
          kahoot: "وميض الصف", tug: "شد الحبل (وضع الصف)", xo: "إكس أو الصف", solo: "مسابقة ذاتية", wheel: "العجلة الدوارة",
          rocket: "سباق الصواريخ", millionaire: "من سيربح المليون", hack: "تحدي الاختراق",
          knowledge_race: "وميض", tug_of_war: "شد الحبل", rocket_race: "سباق الصواريخ", million: "من سيربح المليون",
        };
        const kindKey = any.gameKind ?? any.gameType ?? "";
        const gameLabel = isAr ? (GAME_AR[kindKey] ?? "نشاط حصاد") : "Hasad activity";
        const heading = el.kind === "video-embed" ? (isAr ? "فيديو" : "Video") : `${isAr ? "🎮 " : ""}${gameLabel}`;
        const title = any.topic || any.assignmentTitle || any.title || any.prompt || "";
        const letters = isAr ? ["أ", "ب", "ج", "د"] : ["A", "B", "C", "D"];
        const allQs = any.questions ?? [];
        /* Budget the card by height so nothing spills out: header + title + link take ~4 lines, and each question
           takes two (the question, then its options on one line). */
        const lineIn = 0.26;
        const roomLines = Math.max(2, Math.floor((pos.h - 0.4) / lineIn) - 4);
        const nQ = Math.max(allQs.length ? 1 : 0, Math.min(allQs.length, Math.floor(roomLines / 2), 4));
        const lines: Array<{ text: string; options: any }> = [
          { text: heading, options: { color: accent, bold: true, fontSize: 14, breakLine: true } },
        ];
        if (title) lines.push({ text: title.slice(0, 120), options: { color: "0F172A", bold: true, fontSize: 18, breakLine: true } });
        if (el.kind === "video-embed" && any.url) {
          lines.push({ text: any.url, options: { color: "2563EB", fontSize: 12, breakLine: true, hyperlink: { url: any.url } } });
        }
        allQs.slice(0, nQ).forEach((q, qi) => {
          lines.push({ text: `${qi + 1}) ${q.prompt}`.slice(0, 140), options: { color: "1F2937", bold: true, fontSize: 13, breakLine: true } });
          const opts = (q.options ?? []).slice(0, 4).map((o, oi) => `${letters[oi]}) ${o}`).join("      ");
          lines.push({ text: opts.slice(0, 200), options: { color: "475569", fontSize: 11, breakLine: true } });
        });
        if (allQs.length > nQ) {
          lines.push({
            text: isAr ? `… و${allQs.length - nQ} أسئلة أخرى داخل المنصة` : `… and ${allQs.length - nQ} more in Hasad`,
            options: { color: "94A3B8", italic: true, fontSize: 11, breakLine: true },
          });
        }
        if (el.kind !== "video-embed") {
          lines.push({
            text: slideLink
              ? (isAr ? "▶ اضغط هنا لتشغيل اللعبة في حصاد" : "▶ Click to run the game in Hasad")
              : (isAr ? "لتشغيل اللعبة مع الطلاب افتح هذا العرض في منصة حصاد." : "Open this deck in Hasad to run the game."),
            options: slideLink
              ? { color: "225739", bold: true, underline: { style: "sng" }, fontSize: 13, hyperlink: { url: slideLink } }
              : { color: "94A3B8", italic: true, fontSize: 11 },
          });
        }
        s.addText(lines, {
          x: pos.x + 0.2, y: pos.y + 0.14,
          w: pos.w - 0.4, h: pos.h - 0.28,
          fontFace: safeFontFor(undefined, isAr),
          align: isAr ? "right" : "left",
          rtlMode: isAr,
          lang: isAr ? "ar-SA" : "en-US",
          valign: "top",
          margin: 0,
          wrap: true,
          fit: "shrink",
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
