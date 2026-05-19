import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Mounts once at app root. Sends a single page-view event to /api/activity/page-view
 * on every wouter location change. Fire-and-forget; failures are swallowed so this
 * never affects the user experience.
 */
export function PageViewTracker() {
  const [location] = useLocation();
  const lastSent = useRef<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastSent.current === location) return;
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    // Debounce 600ms so rapid sequential navigations (redirects, guards
    // bouncing through intermediate routes) collapse into one tracked
    // page-view instead of N. Cuts page-view request volume sharply on
    // routes that redirect or render skeletons before settling.
    debounceRef.current = window.setTimeout(() => {
      lastSent.current = location;
      const url = window.location.pathname + window.location.search;
      try {
        fetch(`${API_BASE}/api/activity/page-view`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageUrl: url }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // ignore
      }
    }, 600);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [location]);

  return null;
}
