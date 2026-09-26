import { useCallback, useEffect, useState, type CSSProperties } from "react";

export type QuranReadingThemeId = "paper" | "sepia" | "night";

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
  },
  sepia: {
    id: "sepia",
    labelAr: "سيبيا دافئ",
    labelEn: "Sepia",
    pageBg: "#f1e3c6",
    chromeBg: "#f1e3c6",
    ink: "#3b2a13",
    endInk: "#5c3d1a",
    fallbackFilter: "sepia(0.55) saturate(1.35) brightness(0.97) contrast(1.02)",
    swatch: "#f1e3c6",
  },
  night: {
    id: "night",
    labelAr: "ليلي كهرماني",
    labelEn: "Amber night",
    pageBg: "#161310",
    chromeBg: "#161310",
    ink: "#e8c893",
    endInk: "#d9a655",
    fallbackFilter: "invert(1) hue-rotate(180deg) sepia(0.35) saturate(1.4) brightness(0.92) contrast(0.95)",
    swatch: "#161310",
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

  const cssVars = {
    "--quran-page-bg": theme.pageBg,
    "--quran-chrome-bg": theme.chromeBg,
    "--quran-ink": theme.ink,
    "--quran-end-ink": theme.endInk,
    "--quran-fallback-filter": theme.fallbackFilter,
  } as CSSProperties;

  return { themeId, theme, setThemeId, cssVars };
}
