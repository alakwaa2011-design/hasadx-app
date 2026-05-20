import type { CSSProperties } from "react";

export type SlideThemeKey =
  | "harvest" | "ocean" | "sunset" | "midnight" | "rose"
  | "royal" | "noor" | "sage" | "sand" | "obsidian"
  /* New calm/sophisticated palette (May 2026 redesign). */
  | "linen" | "mist" | "clay" | "pine" | "ink"
  /* وميض identity themes (Jun 2026). */
  | "wameedh_night" | "wameedh_dawn" | "wameedh_steel" | "wameedh_amber";

export type SlidePatternKey =
  | "solid" | "dots" | "grid" | "lines" | "waves" | "geometric" | "stars" | "glow" | "ai";

export type ThemeTier = "free" | "pro";

export type SlideTheme = {
  key: SlideThemeKey;
  labelAr: string;
  labelEn: string;
  grad: string;
  /** Rich mesh-gradient CSS background. When present this is the
   *  preferred visual — `grad` (Tailwind classes) stays as a fallback
   *  for old code paths and Tailwind-only previews. */
  cssGrad?: string;
  accent: string;
  /** Hex accent for editorial details (kickers, rules, numerals). */
  accentHex?: string;
  tier: ThemeTier;
  textOnLight?: boolean;
};

export type SlidePattern = {
  key: SlidePatternKey;
  labelAr: string;
  labelEn: string;
  tier: ThemeTier;
  style: CSSProperties;
};

/* ─────────────────────────────────────────────────────────────
   Theme palette — May 2026 redesign
   ─────────────────────────────────────────────────────────────
   Each theme now has a rich `cssGrad` (multi-radial mesh + base
   conic/linear) so the backdrop feels editorial like Pitch / Tome /
   Gamma. The legacy `grad` (Tailwind classes) is kept as a fallback
   for older code paths and small previews where inline CSS is awkward.
   ───────────────────────────────────────────────────────────── */

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

/* ── وميض identity meshes ─────────────────────────────────────── */
const meshWameedhNight =
  "radial-gradient(at 15% 20%, rgba(30,40,80,0.70) 0px, transparent 55%)," +
  "radial-gradient(at 82% 75%, rgba(180,145,55,0.14) 0px, transparent 50%)," +
  "radial-gradient(at 50% 95%, rgba(10,10,18,0.90) 0px, transparent 55%)," +
  "linear-gradient(160deg, #060608 0%, #0d0d14 50%, #141420 100%)";

const meshWameedhDawn =
  "radial-gradient(at 12% 88%, rgba(217,165,32,0.55) 0px, transparent 55%)," +
  "radial-gradient(at 80% 15%, rgba(30,58,100,0.75) 0px, transparent 50%)," +
  "radial-gradient(at 55% 52%, rgba(130,80,30,0.30) 0px, transparent 55%)," +
  "linear-gradient(155deg, #080d1e 0%, #0f1a35 45%, #2a1a08 100%)";

const meshWameedhSteel =
  "radial-gradient(at 18% 22%, rgba(100,130,165,0.45) 0px, transparent 55%)," +
  "radial-gradient(at 82% 78%, rgba(40,60,90,0.65) 0px, transparent 55%)," +
  "radial-gradient(at 50% 10%, rgba(160,185,210,0.18) 0px, transparent 50%)," +
  "linear-gradient(155deg, #111b28 0%, #1a2a3e 50%, #243348 100%)";

const meshWameedhAmber =
  "radial-gradient(at 18% 22%, rgba(200,140,40,0.50) 0px, transparent 55%)," +
  "radial-gradient(at 82% 78%, rgba(120,70,15,0.65) 0px, transparent 55%)," +
  "radial-gradient(at 50% 95%, rgba(60,30,5,0.80) 0px, transparent 55%)," +
  "linear-gradient(155deg, #1a0d02 0%, #2e1a05 50%, #3f2508 100%)";

export const SLIDE_THEMES: SlideTheme[] = [
  { key: "harvest",  labelAr: "الحصاد",      labelEn: "Harvest",  tier: "free", grad: "from-emerald-500 via-green-700 to-amber-600",        cssGrad: meshHarvest,  accent: "bg-amber-300", accentHex: "#d4af37" },
  { key: "ocean",    labelAr: "المحيط",      labelEn: "Ocean",    tier: "free", grad: "from-sky-500 via-blue-700 to-indigo-800",            cssGrad: meshOcean,    accent: "bg-cyan-300",  accentHex: "#38bdf8" },
  { key: "sunset",   labelAr: "الغروب",      labelEn: "Sunset",   tier: "free", grad: "from-amber-400 via-orange-500 to-rose-600",          cssGrad: meshSunset,   accent: "bg-yellow-300", accentHex: "#fbbf24" },
  { key: "midnight", labelAr: "منتصف الليل", labelEn: "Midnight", tier: "free", grad: "from-slate-800 via-indigo-900 to-purple-900",        cssGrad: meshMidnight, accent: "bg-violet-300", accentHex: "#a78bfa" },
  { key: "rose",     labelAr: "الوردي",      labelEn: "Rose",     tier: "free", grad: "from-rose-400 via-pink-500 to-fuchsia-600",          cssGrad: meshRose,     accent: "bg-pink-200", accentHex: "#f9a8d4" },
  { key: "royal",    labelAr: "ملكي",        labelEn: "Royal",    tier: "pro",  grad: "from-[#0b1d3a] via-[#1e3a8a] to-[#b08d3a]",          cssGrad: meshRoyal,    accent: "bg-amber-300", accentHex: "#d4af37" },
  { key: "noor",     labelAr: "نور",         labelEn: "Noor",     tier: "pro",  grad: "from-[#111111] via-[#2a1f0a] to-[#a47e2c]",          cssGrad: meshNoor,     accent: "bg-yellow-300", accentHex: "#d4af37" },
  { key: "sage",     labelAr: "بستان",       labelEn: "Sage",     tier: "pro",  grad: "from-[#3a5a40] via-[#588157] to-[#a3b18a]",          cssGrad: meshSage,     accent: "bg-lime-200",  accentHex: "#a3b18a" },
  { key: "sand",     labelAr: "الرمل",       labelEn: "Sand",     tier: "pro",  grad: "from-[#7c5e3c] via-[#b08968] to-[#e6ccb2]",          cssGrad: meshSand,     accent: "bg-amber-200", accentHex: "#e6ccb2" },
  { key: "obsidian", labelAr: "الأبنوس",     labelEn: "Obsidian", tier: "pro",  grad: "from-[#0f172a] via-[#1e293b] to-[#334155]",          cssGrad: meshObsidian, accent: "bg-slate-300", accentHex: "#94a3b8" },
  /* Calm / sophisticated palette — light backgrounds with dark text. */
  { key: "linen",    labelAr: "كتّاني",       labelEn: "Linen",    tier: "pro",  grad: "from-[#f5ecd9] via-[#e9d8a6] to-[#d4a373]",          cssGrad: meshLinen,    accent: "bg-[#7c5e3c]", accentHex: "#7c5e3c", textOnLight: true },
  { key: "mist",     labelAr: "ضباب",         labelEn: "Mist",     tier: "pro",  grad: "from-[#e8eef2] via-[#cfd9df] to-[#9aa9b3]",          cssGrad: meshMist,     accent: "bg-[#3a4a55]", accentHex: "#3a4a55", textOnLight: true },
  { key: "clay",     labelAr: "طينٍ",         labelEn: "Clay",     tier: "pro",  grad: "from-[#fbeee0] via-[#e7c8a0] to-[#b07d62]",          cssGrad: meshClay,     accent: "bg-[#7a4a3a]", accentHex: "#7a4a3a", textOnLight: true },
  /* Pine / Ink — calm dark palettes (sage-green / charcoal). */
  { key: "pine",     labelAr: "صنوبر",        labelEn: "Pine",     tier: "pro",  grad: "from-[#1f2d24] via-[#2c4034] to-[#476054]",          cssGrad: meshPine,     accent: "bg-[#d9c79a]", accentHex: "#d9c79a" },
  { key: "ink",      labelAr: "حبري",         labelEn: "Ink",      tier: "pro",  grad: "from-[#1a1a1d] via-[#2c2c33] to-[#4a4a55]",          cssGrad: meshInk,      accent: "bg-[#c9b87a]", accentHex: "#c9b87a" },
  /* وميض identity themes — signature editorial Arabic brand palette. */
  { key: "wameedh_night", labelAr: "ليل وميض", labelEn: "Wameedh Night",  tier: "pro", grad: "from-[#060608] via-[#0d0d14] to-[#141420]", cssGrad: meshWameedhNight, accent: "bg-[#d9a521]", accentHex: "#d9a521" },
  { key: "wameedh_dawn",  labelAr: "فجر وميض", labelEn: "Wameedh Dawn",   tier: "pro", grad: "from-[#080d1e] via-[#0f1a35] to-[#2a1a08]",  cssGrad: meshWameedhDawn,  accent: "bg-[#d9a521]", accentHex: "#d9a521" },
  { key: "wameedh_steel", labelAr: "فولاذي",   labelEn: "Wameedh Steel",  tier: "pro", grad: "from-[#111b28] via-[#1a2a3e] to-[#243348]",  cssGrad: meshWameedhSteel, accent: "bg-[#8ab4d4]", accentHex: "#8ab4d4" },
  { key: "wameedh_amber", labelAr: "عنبري",    labelEn: "Wameedh Amber",  tier: "pro", grad: "from-[#1a0d02] via-[#2e1a05] to-[#3f2508]",  cssGrad: meshWameedhAmber, accent: "bg-[#d9a521]", accentHex: "#d9a521" },
];

export const SLIDE_PATTERNS: SlidePattern[] = [
  {
    key: "solid",
    labelAr: "ساده",
    labelEn: "Solid",
    tier: "free",
    style: {},
  },
  {
    key: "dots",
    labelAr: "نقاط",
    labelEn: "Dots",
    tier: "pro",
    style: {
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='1.4' fill='white' fill-opacity='0.22'/></svg>\")",
      backgroundSize: "24px 24px",
    },
  },
  {
    key: "grid",
    labelAr: "شبكة",
    labelEn: "Grid",
    tier: "pro",
    style: {
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.10) 1px, transparent 1px)",
      backgroundSize: "40px 40px",
    },
  },
  {
    key: "lines",
    labelAr: "خطوط",
    labelEn: "Lines",
    tier: "pro",
    style: {
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><path d='M0 20L20 0' stroke='white' stroke-opacity='0.18' stroke-width='1'/></svg>\")",
      backgroundSize: "20px 20px",
    },
  },
  {
    key: "waves",
    labelAr: "أمواج",
    labelEn: "Waves",
    tier: "pro",
    style: {
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='40' viewBox='0 0 80 40'><path d='M0 20 Q 20 0, 40 20 T 80 20' stroke='white' stroke-opacity='0.20' fill='none' stroke-width='1.5'/></svg>\")",
      backgroundSize: "80px 40px",
    },
  },
  {
    key: "geometric",
    labelAr: "هندسي",
    labelEn: "Geometric",
    tier: "pro",
    style: {
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><g fill='none' stroke='white' stroke-opacity='0.16' stroke-width='1'><path d='M30 0 L60 30 L30 60 L0 30 Z'/><path d='M30 15 L45 30 L30 45 L15 30 Z'/></g></svg>\")",
      backgroundSize: "60px 60px",
    },
  },
  {
    key: "stars",
    labelAr: "نجوم",
    labelEn: "Stars",
    tier: "pro",
    style: {
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><g fill='white'><circle cx='10' cy='15' r='0.9' opacity='0.55'/><circle cx='35' cy='40' r='1.3' opacity='0.7'/><circle cx='65' cy='25' r='0.9' opacity='0.5'/><circle cx='95' cy='55' r='1.1' opacity='0.6'/><circle cx='130' cy='30' r='0.8' opacity='0.5'/><circle cx='25' cy='90' r='1' opacity='0.6'/><circle cx='75' cy='110' r='1.2' opacity='0.65'/><circle cx='140' cy='100' r='0.9' opacity='0.55'/><circle cx='110' cy='140' r='1' opacity='0.6'/><circle cx='40' cy='150' r='0.8' opacity='0.5'/></g></svg>\")",
      backgroundSize: "160px 160px",
    },
  },
  {
    key: "glow",
    labelAr: "إشراق",
    labelEn: "Glow",
    tier: "pro",
    style: {
      backgroundImage:
        "radial-gradient(ellipse at top right, rgba(255,255,255,0.22), transparent 55%), radial-gradient(ellipse at bottom left, rgba(0,0,0,0.25), transparent 55%)",
    },
  },
  {
    /* Special pattern: the AI picks a unique gradient per slide from
       AI_GRADIENT_FROM / AI_GRADIENT_TO at fill time. The pattern itself has
       no overlay style — the background swap happens in the slide renderer. */
    key: "ai",
    labelAr: "الذكاء الاصطناعي",
    labelEn: "AI choose",
    tier: "pro",
    style: {},
  },
];

/* ─────────────────────────────────────────────────────────────
   AI-picked per-slide gradients
   ─────────────────────────────────────────────────────────────
   The "ai" pattern asks Claude to pick a gradient for each slide based on
   its title and content. To keep Tailwind's JIT happy, the allowed classes
   are listed literally below (so Tailwind scans and includes them in the
   final CSS bundle). The server validates AI output against the same list.
   ───────────────────────────────────────────────────────────── */
export const AI_GRADIENT_FROM = [
  "from-rose-400", "from-rose-500", "from-rose-600",
  "from-pink-400", "from-pink-500", "from-pink-600",
  "from-fuchsia-500", "from-fuchsia-600", "from-fuchsia-700",
  "from-purple-500", "from-purple-600", "from-purple-700",
  "from-violet-500", "from-violet-600", "from-violet-700",
  "from-indigo-500", "from-indigo-600", "from-indigo-700",
  "from-blue-400", "from-blue-500", "from-blue-600", "from-blue-700",
  "from-sky-400", "from-sky-500", "from-sky-600",
  "from-cyan-400", "from-cyan-500", "from-cyan-600",
  "from-teal-400", "from-teal-500", "from-teal-600",
  "from-emerald-400", "from-emerald-500", "from-emerald-600", "from-emerald-700",
  "from-green-400", "from-green-500", "from-green-600", "from-green-700",
  "from-lime-400", "from-lime-500",
  "from-yellow-400", "from-yellow-500",
  "from-amber-400", "from-amber-500", "from-amber-600",
  "from-orange-400", "from-orange-500", "from-orange-600",
  "from-red-500", "from-red-600", "from-red-700",
  "from-slate-700", "from-slate-800", "from-slate-900",
  "from-stone-700", "from-stone-800",
  "from-neutral-800", "from-neutral-900",
  "from-zinc-700", "from-zinc-800",
] as const;

export const AI_GRADIENT_TO = [
  "to-rose-500", "to-rose-600", "to-rose-700", "to-rose-800",
  "to-pink-500", "to-pink-600", "to-pink-700",
  "to-fuchsia-600", "to-fuchsia-700", "to-fuchsia-800",
  "to-purple-600", "to-purple-700", "to-purple-800", "to-purple-900",
  "to-violet-600", "to-violet-700", "to-violet-800", "to-violet-900",
  "to-indigo-700", "to-indigo-800", "to-indigo-900",
  "to-blue-600", "to-blue-700", "to-blue-800", "to-blue-900",
  "to-sky-600", "to-sky-700", "to-sky-800",
  "to-cyan-600", "to-cyan-700",
  "to-teal-600", "to-teal-700", "to-teal-800",
  "to-emerald-600", "to-emerald-700", "to-emerald-800",
  "to-green-600", "to-green-700", "to-green-800", "to-green-900",
  "to-lime-600", "to-lime-700",
  "to-yellow-600", "to-yellow-700",
  "to-amber-600", "to-amber-700", "to-amber-800",
  "to-orange-600", "to-orange-700", "to-orange-800",
  "to-red-600", "to-red-700", "to-red-800",
  "to-slate-800", "to-slate-900",
  "to-stone-800", "to-stone-900",
  "to-neutral-900",
  "to-zinc-800", "to-zinc-900",
  "to-indigo-950", "to-purple-950", "to-rose-950", "to-emerald-950",
] as const;

export type AiGradientFrom = (typeof AI_GRADIENT_FROM)[number];
export type AiGradientTo = (typeof AI_GRADIENT_TO)[number];

export type CustomBackground = {
  gradientFrom: AiGradientFrom;
  gradientTo: AiGradientTo;
  textOnLight?: boolean;
};

/* Pro/Claude tiers can also return a free-form per-slide design using inline
   CSS (raw `background` value plus optional accent colour). This bypasses the
   Tailwind gradient whitelist entirely so the AI is not forced into the
   loud, saturated 400-700 palette. Validated/sanitised on the server. */
export type CustomStyle = {
  background: string;          // any safe CSS background value
  textOnLight?: boolean;
  accentColor?: string;        // hex like "#7c5e3c"
};

const FROM_SET: Set<string> = new Set(AI_GRADIENT_FROM);
const TO_SET: Set<string> = new Set(AI_GRADIENT_TO);

export function isValidCustomBackground(
  v: unknown,
): v is CustomBackground {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.gradientFrom === "string" && FROM_SET.has(o.gradientFrom) &&
    typeof o.gradientTo === "string" && TO_SET.has(o.gradientTo)
  );
}

/* Light-weight client-side sanity check on a CustomStyle. The server already
   validates; this is just defence-in-depth so a malformed shape never crashes
   the renderer. */
export function isValidCustomStyle(v: unknown): v is CustomStyle {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.background === "string" && o.background.length > 0;
}

export type ResolvedSlideBackground = {
  /* Tailwind gradient classes (e.g. "from-emerald-500 to-amber-600"). Empty
     string when an inline style is being used instead. */
  grad: string;
  /* Inline CSS background string. When set, the renderer should apply this
     via `style={{ background }}` and skip the gradient classes. */
  cssBackground?: string;
  textOnLight: boolean;
  /* Optional accent colour (hex). Only present for inline styles. */
  accentColor?: string;
  /* True when a per-slide AI custom design is in effect (legacy whitelist
     OR new inline CSS). */
  isCustom: boolean;
};

/* Resolve the background for a slide. Priority order:
     1. Slide has a valid inline customStyle → use it (set by Pro/Claude AI
        bulk generation; not gated on pattern because the AI sets it
        intentionally per slide).
     2. AI pattern + legacy customBackground (Tailwind classes) → use them
        (single-slide AI Fill flow).
     3. Otherwise → fall back to the deck-level theme gradient. */
export function resolveSlideGradient(opts: {
  themeGrad: string;
  /** Rich mesh-gradient CSS for the deck theme. Used when no per-slide
   *  custom design is set so every deck gets the upgraded look. */
  themeCssGrad?: string;
  themeAccentHex?: string;
  themeTextOnLight?: boolean;
  pattern: string | null | undefined;
  customBackground?: CustomBackground | null;
  customStyle?: CustomStyle | null;
}): ResolvedSlideBackground {
  if (opts.customStyle && isValidCustomStyle(opts.customStyle)) {
    return {
      grad: "",
      cssBackground: opts.customStyle.background,
      textOnLight: !!opts.customStyle.textOnLight,
      accentColor: typeof opts.customStyle.accentColor === "string" ? opts.customStyle.accentColor : undefined,
      isCustom: true,
    };
  }
  if (opts.pattern === "ai" && opts.customBackground && isValidCustomBackground(opts.customBackground)) {
    return {
      grad: `${opts.customBackground.gradientFrom} ${opts.customBackground.gradientTo}`,
      textOnLight: !!opts.customBackground.textOnLight,
      isCustom: true,
    };
  }
  /* Use the upgraded mesh CSS for the theme when available — this is
     what makes the backdrop feel premium instead of a flat 3-stop
     Tailwind gradient. */
  if (opts.themeCssGrad) {
    return {
      grad: opts.themeGrad,
      cssBackground: opts.themeCssGrad,
      textOnLight: !!opts.themeTextOnLight,
      accentColor: opts.themeAccentHex,
      isCustom: false,
    };
  }
  return {
    grad: opts.themeGrad,
    textOnLight: !!opts.themeTextOnLight,
    isCustom: false,
  };
}

export function getTheme(key: string | undefined | null): SlideTheme {
  return SLIDE_THEMES.find((t) => t.key === key) || SLIDE_THEMES[0];
}

/* Curated tasteful defaults for new decks (May 2026 redesign).
   Excludes the loud / saturated palettes (harvest, sunset, rose, royal,
   noor) so a freshly-created deck does not feel like a primary-school
   poster. The picker rotates across these so two decks created in a
   row look different — much more like Pitch / Tome / Gamma. */
export const TASTEFUL_DEFAULT_THEMES: SlideThemeKey[] = [
  "wameedh_night", "wameedh_dawn", "wameedh_steel", "wameedh_amber",
  "mist", "obsidian", "linen", "ink", "sage", "ocean", "pine", "clay",
];

export function pickDefaultTheme(): SlideThemeKey {
  return TASTEFUL_DEFAULT_THEMES[
    Math.floor(Math.random() * TASTEFUL_DEFAULT_THEMES.length)
  ];
}

export function getPattern(key: string | undefined | null): SlidePattern {
  return SLIDE_PATTERNS.find((p) => p.key === key) || SLIDE_PATTERNS[0];
}

export function isFreeTheme(key: string | undefined | null): boolean {
  const t = SLIDE_THEMES.find((x) => x.key === key);
  return !t || t.tier === "free";
}

export function isFreePattern(key: string | undefined | null): boolean {
  const p = SLIDE_PATTERNS.find((x) => x.key === key);
  return !p || p.tier === "free";
}

/* ─────────────────────────────────────────────────────────────
   Default text color for a theme
   ─────────────────────────────────────────────────────────────
   Used by the slide renderer + editor as the fallback color for
   text/icon elements that don't have an explicit `color` set.
   Dark themes get a near-white default so titles/placeholders
   remain readable on the dark gradient; light themes (those flagged
   `textOnLight`) keep a dark slate default.
   ───────────────────────────────────────────────────────────── */
export const DEFAULT_TEXT_DARK = "#1f2937";
export const DEFAULT_TEXT_LIGHT = "#f8fafc";

export function defaultTextColorForTheme(
  themeKey: string | undefined | null,
): string {
  const t = getTheme(themeKey);
  return t.textOnLight ? DEFAULT_TEXT_DARK : DEFAULT_TEXT_LIGHT;
}

/* Returns true when the given hex color is "light enough" that white
   text would be unreadable on top of it. Uses the standard sRGB
   relative luminance approximation; the 0.6 threshold was tuned so
   pale tints (#f8fafc, #fff8e6, etc.) flip to dark text while mid-tone
   accents (#d4af37, #38bdf8) stay on the dark-text side only when
   genuinely bright. Non-hex inputs return false (we cannot judge them
   safely, so we keep the theme default). */
export function isLightHexColor(hex: string | null | undefined): boolean {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return false;
  let body = hex.slice(1);
  if (body.length === 3) body = body.split("").map((c) => c + c).join("");
  if (body.length !== 6) return false;
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

/* Phase 4 — per-slide design intelligence. The materializer can stamp
   a slide.background with a long CSS mesh gradient (e.g. linen / mist
   / clay) that has a clearly LIGHT base. The hex check above returns
   false for these strings, so we'd fall back to deck-theme colours and
   still pick white text on a light backdrop. This helper peeks for
   any hex literals inside the gradient string and returns true when
   the AVERAGE of those stops is "light enough". Conservative — when
   we cannot find any usable hex stop we return false and let the
   theme default win. */
export function isLightCssGradient(css: string | null | undefined): boolean {
  if (!css || typeof css !== "string") return false;
  /* Cheap fast-path: gradient strings only. */
  if (!css.includes("gradient(")) return false;
  const matches = css.match(/#[0-9a-fA-F]{6}\b/g);
  if (!matches || matches.length === 0) return false;
  let sum = 0;
  let count = 0;
  for (const hex of matches) {
    const body = hex.slice(1);
    const r = parseInt(body.slice(0, 2), 16);
    const g = parseInt(body.slice(2, 4), 16);
    const b = parseInt(body.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) continue;
    sum += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    count += 1;
  }
  if (count === 0) return false;
  return sum / count > 0.6;
}

/* Per-slide default text color, contrast-aware.
   - If the slide has a background IMAGE, assume a dark photo and use
     the light default (legacy behaviour).
   - Else, if the slide overrides `background` with a clearly light
     hex value, force the dark default so text stays readable even
     when the deck theme is a "dark" one (e.g. harvest with a custom
     light slide bg used to render WHITE text on WHITE).
   - Otherwise fall back to the deck-theme default. */
export function defaultTextColorForSlide(
  slide: { background?: string | null; backgroundImage?: string | null },
  themeKey: string | undefined | null,
): string {
  if (slide.backgroundImage) return DEFAULT_TEXT_LIGHT;
  if (slide.background && isLightHexColor(slide.background)) return DEFAULT_TEXT_DARK;
  /* Phase 4 — CSS mesh gradients (per-slide AI-picked themes). */
  if (slide.background && isLightCssGradient(slide.background)) return DEFAULT_TEXT_DARK;
  return defaultTextColorForTheme(themeKey);
}
