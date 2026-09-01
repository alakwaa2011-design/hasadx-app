/**
 * Lightweight in-app navigation history tracker (Wouter-compatible).
 *
 * Stores visited app paths in sessionStorage so back buttons can navigate
 * to the actual previous page even when they need an explicit fallback.
 *
 * Usage:
 *   1. Call <NavTracker /> once inside the Wouter Router (App.tsx).
 *   2. Use useSmartBack(fallback) in any component to get a goBack() fn.
 */
import { useLocation } from "wouter";
import { useEffect, useCallback } from "react";

const HIST_KEY = "hasad_nav_hist_v2";
const MAX_HISTORY = 40;

function normalizeAppPath(path: string): string | undefined {
  if (!path.startsWith("/") || path.startsWith("//")) return undefined;
  const hashIndex = path.indexOf("#");
  return hashIndex === -1 ? path : path.slice(0, hashIndex);
}

function loadHistory(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(HIST_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map(normalizeAppPath)
      .filter((entry): entry is string => Boolean(entry));
  } catch {
    return [];
  }
}

function saveHistory(h: string[]) {
  try {
    sessionStorage.setItem(HIST_KEY, JSON.stringify(h));
  } catch {
    /* quota or private browsing — silently ignore */
  }
}

/** Push a path onto the history stack (no consecutive duplicates). */
export function pushNav(path: string) {
  const normalizedPath = normalizeAppPath(path);
  if (!normalizedPath) return;
  const h = loadHistory();
  if (h[h.length - 1] === normalizedPath) return;
  h.push(normalizedPath);
  if (h.length > MAX_HISTORY) h.shift();
  saveHistory(h);
}

/**
 * Remove the current page from the stack and return the previous one.
 * The previous page stays in the stack so navigating there re-pushes it naturally.
 */
function popNav(currentPath: string): string | undefined {
  const normalizedCurrent = normalizeAppPath(currentPath);
  if (!normalizedCurrent) return undefined;

  const h = loadHistory();
  const currentIndex = h.lastIndexOf(normalizedCurrent);

  if (currentIndex === -1) {
    saveHistory([normalizedCurrent]);
    return undefined;
  }

  if (currentIndex < 1) {
    saveHistory([normalizedCurrent]);
    return undefined;
  }

  const prev = h[currentIndex - 1];
  saveHistory(h.slice(0, currentIndex));
  return prev;
}

/**
 * Add this as a sibling of <Router /> inside <WouterRouter> in App.tsx.
 * It records every route change into sessionStorage.
 */
export function NavTracker() {
  const [loc] = useLocation();
  useEffect(() => {
    pushNav(loc);
  }, [loc]);
  return null;
}

/**
 * Returns a goBack() function that navigates to the actual previous app page.
 * Falls back to `fallback` when there is no history entry.
 *
 * @param fallback  Path to navigate to when no history is available.
 */
export function useSmartBack(fallback: string): () => void {
  const [location, setLoc] = useLocation();
  return useCallback(() => {
    const prev = popNav(location);
    setLoc(prev ?? normalizeAppPath(fallback) ?? "/");
  }, [fallback, location, setLoc]);
}
