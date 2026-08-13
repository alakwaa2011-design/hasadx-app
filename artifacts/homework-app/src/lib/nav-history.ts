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

const HIST_KEY = "hasad_nav_hist";
const MAX_HISTORY = 40;

function loadHistory(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(HIST_KEY) ?? "[]");
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
  const h = loadHistory();
  if (h[h.length - 1] === path) return;
  h.push(path);
  if (h.length > MAX_HISTORY) h.shift();
  saveHistory(h);
}

/**
 * Remove the current page from the stack and return the previous one.
 * The previous page stays in the stack so navigating there re-pushes it naturally.
 */
function popNav(): string | undefined {
  const h = loadHistory();
  if (h.length < 2) return undefined;
  h.pop(); // discard current
  const prev = h[h.length - 1];
  saveHistory(h);
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
  const [, setLoc] = useLocation();
  return useCallback(() => {
    const prev = popNav();
    setLoc(prev ?? fallback);
  }, [fallback, setLoc]);
}
