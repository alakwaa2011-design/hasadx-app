import type { ThemePalette } from "./types";

/* Theme palette resolver. Mirrors the renderer's SLIDE_THEMES table
   without importing it (the renderer lives in the homework-app
   workspace and this lib is consumed server-side too). Keep keys —
   AND the cssGrad mesh strings — in sync with
   artifacts/homework-app/src/lib/slide-themes.ts. The mesh strings
   are duplicated intentionally: this lib is the server-side source of
   truth for the materializer (`buildOneSlide`) which stamps a slide's
   `background` field per-slide so the AI Director can vary the
   backdrop across the deck. */

interface ThemeRow {
  accent: string;
  textOnLight: boolean;
  cssGrad: string;
}

const meshHarvest =
  "radial-gradient(at 18% 22%, rgba(46,134,86,0.72) 0px, transparent 52%)," +
  "radial-gradient(at 82% 16%, rgba(212,175,55,0.55) 0px, transparent 50%)," +
  "radial-gradient(at 30% 90%, rgba(20,69,45,0.85) 0px, transparent 55%)," +
  "linear-gradient(135deg, #0e2d1c 0%, #173f29 45%, #1f5a3e 100%)";
const meshOcean =
  "radial-gradient(at 14% 18%, rgba(56,189,248,0.55) 0px, transparent 50%)," +
  "radial-gradient(at 88% 28%, rgba(99,102,241,0.55) 0px, transparent 50%)," +
  "radial-gradient(at 50% 95%, rgba(14,116,144,0.75) 0px, transparent 55%)," +
  "linear-gradient(160deg, #061a3a 0%, #0c2a55 50%, #0e3360 100%)";
const meshSunset =
  "radial-gradient(at 12% 88%, rgba(251,146,60,0.70) 0px, transparent 55%)," +
  "radial-gradient(at 88% 16%, rgba(244,63,94,0.55) 0px, transparent 50%)," +
  "radial-gradient(at 60% 50%, rgba(251,191,36,0.30) 0px, transparent 55%)," +
  "linear-gradient(155deg, #4a1d2a 0%, #7c2d3a 45%, #b04a26 100%)";
const meshMidnight =
  "radial-gradient(at 22% 18%, rgba(139,92,246,0.45) 0px, transparent 50%)," +
  "radial-gradient(at 80% 80%, rgba(99,102,241,0.40) 0px, transparent 50%)," +
  "radial-gradient(at 50% 50%, rgba(56,189,248,0.18) 0px, transparent 60%)," +
  "linear-gradient(160deg, #0a0a1f 0%, #15152e 50%, #1e1b3a 100%)";
const meshRose =
  "radial-gradient(at 18% 24%, rgba(251,113,133,0.60) 0px, transparent 50%)," +
  "radial-gradient(at 82% 78%, rgba(232,121,249,0.50) 0px, transparent 55%)," +
  "radial-gradient(at 60% 12%, rgba(255,228,230,0.28) 0px, transparent 50%)," +
  "linear-gradient(150deg, #4a1d3a 0%, #6e2348 50%, #9c2f6a 100%)";
const meshRoyal =
  "radial-gradient(at 18% 22%, rgba(180,143,58,0.45) 0px, transparent 50%)," +
  "radial-gradient(at 80% 80%, rgba(30,58,138,0.65) 0px, transparent 55%)," +
  "linear-gradient(150deg, #050d22 0%, #0b1d3a 55%, #1a2e6a 100%)";
const meshNoor =
  "radial-gradient(at 22% 22%, rgba(180,143,58,0.50) 0px, transparent 55%)," +
  "radial-gradient(at 80% 78%, rgba(120,86,30,0.45) 0px, transparent 55%)," +
  "linear-gradient(155deg, #0c0a05 0%, #1a1408 50%, #2a1f0a 100%)";
const meshSage =
  "radial-gradient(at 20% 18%, rgba(163,177,138,0.45) 0px, transparent 55%)," +
  "radial-gradient(at 82% 80%, rgba(88,129,87,0.55) 0px, transparent 55%)," +
  "linear-gradient(150deg, #2c4030 0%, #3a5a40 50%, #588157 100%)";
const meshSand =
  "radial-gradient(at 18% 24%, rgba(230,204,178,0.60) 0px, transparent 55%)," +
  "radial-gradient(at 80% 80%, rgba(176,137,104,0.55) 0px, transparent 55%)," +
  "linear-gradient(150deg, #5a4528 0%, #7c5e3c 50%, #b08968 100%)";
const meshObsidian =
  "radial-gradient(at 18% 22%, rgba(71,85,105,0.55) 0px, transparent 55%)," +
  "radial-gradient(at 82% 80%, rgba(30,41,59,0.85) 0px, transparent 55%)," +
  "linear-gradient(155deg, #0a0f1c 0%, #15192a 50%, #1e293b 100%)";
const meshLinen =
  "radial-gradient(at 18% 18%, rgba(212,163,115,0.42) 0px, transparent 55%)," +
  "radial-gradient(at 82% 80%, rgba(233,216,166,0.50) 0px, transparent 55%)," +
  "linear-gradient(150deg, #fbf6e8 0%, #f5ecd9 50%, #e9d8a6 100%)";
const meshMist =
  "radial-gradient(at 18% 22%, rgba(148,163,184,0.40) 0px, transparent 55%)," +
  "radial-gradient(at 82% 78%, rgba(207,217,223,0.55) 0px, transparent 55%)," +
  "linear-gradient(150deg, #f1f5f9 0%, #e8eef2 50%, #cfd9df 100%)";
const meshClay =
  "radial-gradient(at 18% 22%, rgba(176,125,98,0.45) 0px, transparent 55%)," +
  "radial-gradient(at 82% 78%, rgba(218,180,140,0.50) 0px, transparent 55%)," +
  "linear-gradient(150deg, #fbf4ea 0%, #fbeee0 50%, #e7c8a0 100%)";
const meshPine =
  "radial-gradient(at 18% 18%, rgba(217,199,154,0.18) 0px, transparent 55%)," +
  "radial-gradient(at 82% 80%, rgba(60,100,75,0.65) 0px, transparent 55%)," +
  "linear-gradient(155deg, #131c17 0%, #1f2d24 50%, #2c4034 100%)";
const meshInk =
  "radial-gradient(at 18% 22%, rgba(201,184,122,0.18) 0px, transparent 55%)," +
  "radial-gradient(at 82% 78%, rgba(74,74,85,0.55) 0px, transparent 55%)," +
  "linear-gradient(155deg, #0c0c0e 0%, #1a1a1d 50%, #2c2c33 100%)";

const THEMES: Record<string, ThemeRow> = {
  harvest:  { accent: "#d4af37", textOnLight: false, cssGrad: meshHarvest },
  ocean:    { accent: "#38bdf8", textOnLight: false, cssGrad: meshOcean },
  sunset:   { accent: "#fbbf24", textOnLight: false, cssGrad: meshSunset },
  midnight: { accent: "#a78bfa", textOnLight: false, cssGrad: meshMidnight },
  rose:     { accent: "#f9a8d4", textOnLight: false, cssGrad: meshRose },
  royal:    { accent: "#d4af37", textOnLight: false, cssGrad: meshRoyal },
  noor:     { accent: "#d4af37", textOnLight: false, cssGrad: meshNoor },
  sage:     { accent: "#a3b18a", textOnLight: false, cssGrad: meshSage },
  sand:     { accent: "#e6ccb2", textOnLight: false, cssGrad: meshSand },
  obsidian: { accent: "#94a3b8", textOnLight: false, cssGrad: meshObsidian },
  /* Light themes use dark text. */
  linen:    { accent: "#7c5e3c", textOnLight: true,  cssGrad: meshLinen },
  mist:     { accent: "#3a4a55", textOnLight: true,  cssGrad: meshMist },
  clay:     { accent: "#7a4a3a", textOnLight: true,  cssGrad: meshClay },
  pine:     { accent: "#d9c79a", textOnLight: false, cssGrad: meshPine },
  ink:      { accent: "#c9b87a", textOnLight: false, cssGrad: meshInk },
};

/** Allowed theme keys mirrored for runtime validation in guardrails &
    routes. Source of truth for both server and (via an identical list
    in the routes layer) the persisted deck schema. */
export const SLIDE_TEMPLATE_THEME_KEYS = Object.keys(THEMES);

/** True when the supplied string is a known theme key. */
export function isKnownThemeKey(s: string | null | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  return Object.prototype.hasOwnProperty.call(THEMES, s);
}

/* Convert any "#rrggbb" / "#rgb" hex to an rgba() string. Falls back
   to the original string when the input is not a hex literal so that
   themes can supply rgba() accents directly. */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.trim();
  if (!m.startsWith("#")) return m;
  let body = m.slice(1);
  if (body.length === 3) {
    body = body.split("").map((c) => c + c).join("");
  }
  if (body.length !== 6) return m;
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return m;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function paletteForTheme(themeKey: string | null | undefined): ThemePalette {
  const t = THEMES[themeKey ?? "harvest"] ?? THEMES.harvest;
  /* Tint factor — softer on light themes (the surface is already
     bright, so a 14% wash reads as a clear panel) and a touch heavier
     on dark themes (so the tinted card pops off the gradient). */
  const accentSoft = hexToRgba(t.accent, t.textOnLight ? 0.12 : 0.18);
  if (t.textOnLight) {
    return {
      accent: t.accent,
      accentSoft,
      fg: "#1a1a1a",
      muted: "#5a5a5a",
      surface: "rgba(0,0,0,0.06)",
      divider: "rgba(0,0,0,0.10)",
      textOnLight: true,
      cssGrad: t.cssGrad,
    };
  }
  return {
    accent: t.accent,
    accentSoft,
    fg: "#ffffff",
    muted: "rgba(255,255,255,0.78)",
    surface: "rgba(255,255,255,0.10)",
    divider: "rgba(255,255,255,0.16)",
    textOnLight: false,
    cssGrad: t.cssGrad,
  };
}
