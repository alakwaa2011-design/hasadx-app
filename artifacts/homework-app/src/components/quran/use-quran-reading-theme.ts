import { useCallback, useEffect, useState, type CSSProperties } from "react";

export type QuranReadingThemeId = "paper" | "sepia" | "night";

interface QuranReadingThemeHighlights {
  /** Background/text/ring for a single word the reader tapped to select. */
  wordSelectBg: string;
  wordSelectText: string;
  wordSelectRing: string;
  /** Background/text/ring for the exact word being spoken during audio playback. */
  wordPlayBg: string;
  wordPlayText: string;
  wordPlayRing: string;
  /** Whole ayah playing, before word-level timing kicks in. */
  ayahPlayBg: string;
  ayahPlayText: string;
  /** A tapped/selected ayah (not a specific word). */
  ayahSelectBg: string;
  ayahSelectText: string;
  /** Ayah inside a multi-ayah selection range. */
  rangeBg: string;
  rangeText: string;
  /** Pulsing glow color used behind the actively spoken word. */
  glow: string;
}

export interface QuranReadingTheme {
  id: QuranReadingThemeId;
  labelAr: string;
  labelEn: string;
  /** Page surface color (behind the mushaf glyphs). */
  pageBg: string;
  /** Card/chrome color around the page on wider screens. */
  chromeBg: string;
  /** Default glyph ink color. */
  ink: string;
  /** Ink color used for the small ayah-end marker glyph. */
  endInk: string;
  /** CSS filter chain applied to the pre-rendered page image fallback. */
  fallbackFilter: string;
  /** Swatch color shown in the theme picker. */
  swatch: string;
  /** Ayah/word highlight colors, tuned per theme so they stay legible against the page background. */
  highlights: QuranReadingThemeHighlights;
}

export const QURAN_READING_THEMES: Readonly<Record<QuranReadingThemeId, QuranReadingTheme>> = {
  paper: {
    id: "paper",
    labelAr: "ورقي",
    labelEn: "Paper",
    pageBg: "#fdfaf6",
    chromeBg: "#fdfaf6",
    ink: "#000000",
    endInk: "#1d4432",
    fallbackFilter: "none",
    swatch: "#fdfaf6",
    highlights: {
      wordSelectBg: "rgba(253,230,138,0.7)",
      wordSelectText: "#92400e",
      wordSelectRing: "rgba(245,158,11,0.5)",
      wordPlayBg: "rgba(167,243,208,0.9)",
      wordPlayText: "#065f46",
      wordPlayRing: "rgba(16,185,129,0.5)",
      ayahPlayBg: "rgba(209,250,229,0.5)",
      ayahPlayText: "#047857",
      ayahSelectBg: "rgba(254,243,199,0.4)",
      ayahSelectText: "#b45309",
      rangeBg: "rgba(254,243,199,0.6)",
      rangeText: "#92400e",
      glow: "rgba(16,185,129,0.45)",
    },
  },
  sepia: {
    id: "sepia",
    labelAr: "دافئ",
    labelEn: "Sepia",
    pageBg: "#f1e3c6",
    chromeBg: "#f1e3c6",
    ink: "#3b2a13",
    endInk: "#5c3d1a",
    fallbackFilter: "sepia(0.55) saturate(1.35) brightness(0.97) contrast(1.02)",
    swatch: "#f1e3c6",
    highlights: {
      wordSelectBg: "rgba(245,158,11,0.55)",
      wordSelectText: "#451a03",
      wordSelectRing: "rgba(180,83,9,0.6)",
      wordPlayBg: "rgba(16,185,129,0.5)",
      wordPlayText: "#052e1f",
      wordPlayRing: "rgba(5,150,105,0.6)",
      ayahPlayBg: "rgba(16,185,129,0.3)",
      ayahPlayText: "#065f46",
      ayahSelectBg: "rgba(245,158,11,0.3)",
      ayahSelectText: "#78350f",
      rangeBg: "rgba(245,158,11,0.4)",
      rangeText: "#78350f",
      glow: "rgba(5,150,105,0.5)",
    },
  },
  night: {
    id: "night",
    labelAr: "ليلي",
    labelEn: "Amber night",
    pageBg: "#161310",
    chromeBg: "#161310",
    ink: "#e8c893",
    endInk: "#d9a655",
    fallbackFilter: "invert(1) hue-rotate(180deg) sepia(0.35) saturate(1.4) brightness(0.92) contrast(0.95)",
    swatch: "#161310",
    highlights: {
      wordSelectBg: "rgba(245,158,11,0.38)",
      wordSelectText: "#fde68a",
      wordSelectRing: "rgba(251,191,36,0.65)",
      wordPlayBg: "rgba(16,185,129,0.35)",
      wordPlayText: "#6ee7b7",
      wordPlayRing: "rgba(52,211,153,0.7)",
      ayahPlayBg: "rgba(16,185,129,0.2)",
      ayahPlayText: "#6ee7b7",
      ayahSelectBg: "rgba(245,158,11,0.2)",
      ayahSelectText: "#fde68a",
      rangeBg: "rgba(245,158,11,0.24)",
      rangeText: "#fde68a",
      glow: "rgba(52,211,153,0.55)",
    },
  },
};

const STORAGE_KEY = "hasaad:quran-reading-theme:v1";

function readStoredTheme(): QuranReadingThemeId {
  if (typeof window === "undefined") return "paper";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "paper" || stored === "sepia" || stored === "night") return stored;
  } catch {}
  return "paper";
}

export function useQuranReadingTheme() {
  const [themeId, setThemeIdState] = useState<QuranReadingThemeId>(() => readStoredTheme());

  const setThemeId = useCallback((next: QuranReadingThemeId) => {
    setThemeIdState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  useEffect(() => {
    setThemeIdState(readStoredTheme());
  }, []);

  const theme = QURAN_READING_THEMES[themeId];
  const h = theme.highlights;

  const cssVars = {
    "--quran-page-bg": theme.pageBg,
    "--quran-chrome-bg": theme.chromeBg,
    "--quran-ink": theme.ink,
    "--quran-end-ink": theme.endInk,
    "--quran-fallback-filter": theme.fallbackFilter,
    "--quran-hl-word-select-bg": h.wordSelectBg,
    "--quran-hl-word-select-text": h.wordSelectText,
    "--quran-hl-word-select-ring": h.wordSelectRing,
    "--quran-hl-word-play-bg": h.wordPlayBg,
    "--quran-hl-word-play-text": h.wordPlayText,
    "--quran-hl-word-play-ring": h.wordPlayRing,
    "--quran-hl-ayah-play-bg": h.ayahPlayBg,
    "--quran-hl-ayah-play-text": h.ayahPlayText,
    "--quran-hl-ayah-select-bg": h.ayahSelectBg,
    "--quran-hl-ayah-select-text": h.ayahSelectText,
    "--quran-hl-range-bg": h.rangeBg,
    "--quran-hl-range-text": h.rangeText,
    "--quran-word-glow-color": h.glow,
  } as CSSProperties;

  return { themeId, theme, setThemeId, cssVars };
}
