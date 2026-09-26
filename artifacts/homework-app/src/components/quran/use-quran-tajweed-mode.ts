import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "hasaad:quran-tajweed-mode:v1";

function readStoredValue(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Persisted on/off toggle for Tajweed rule coloring on the Madani mushaf page.
 * Swaps the per-page QCF glyph font for the King Fahd Complex "QCF v4" color
 * variant, which uses the exact same glyph codes as the plain "v2" font — so
 * no layout or word-mapping data changes are needed, only the font family.
 */
export function useQuranTajweedMode() {
  const [tajweedEnabled, setTajweedEnabledState] = useState<boolean>(() => readStoredValue());

  const setTajweedEnabled = useCallback((next: boolean) => {
    setTajweedEnabledState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
    } catch {}
  }, []);

  useEffect(() => {
    setTajweedEnabledState(readStoredValue());
  }, []);

  return { tajweedEnabled, setTajweedEnabled };
}
