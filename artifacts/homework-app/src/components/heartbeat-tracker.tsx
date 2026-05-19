import { useEffect } from "react";
import { useLocation } from "wouter";
import { startHeartbeat, stopHeartbeat } from "@/lib/analytics";

/**
 * Skip heartbeat on routes where it would add noise without value:
 * - public auth/login flows (visitors that aren't really "using" the app)
 * - student-facing game-play screens (we already track join/play events)
 * - kiosk/embed/share screens
 */
const SKIP_PREFIXES = [
  "/auth",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/play",
  "/game/",
  "/student-play",
  "/student-game",
  "/share",
  "/embed",
  "/present/",
  // Live presentation player + join routes (task #616 acceptance: these
  // are presence-sensitive, so we keep heartbeat off entirely the way
  // /play and /student-play already do — student presence is tracked by
  // the live-session socket, not by the HTTP heartbeat).
  "/p/play",
  "/p/join",
  "/p/show",
];

function shouldTrack(pathname: string): boolean {
  if (!pathname) return true;
  return !SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

/**
 * Mounts once at the app root. Pings /api/analytics/heartbeat every 120s
 * (matched by a 180s offline cutoff in api-server/src/lib/analytics.ts)
 * so the admin "online now" dashboard can count this tab as active.
 * Stops the timer on unmount, pauses while the tab is hidden, and skips
 * entirely on auth / game-play / live-presentation / share routes.
 */
export function HeartbeatTracker() {
  const [location] = useLocation();
  useEffect(() => {
    if (!shouldTrack(location)) {
      stopHeartbeat();
      return;
    }
    startHeartbeat(120_000);
    return () => stopHeartbeat();
  }, [location]);
  return null;
}
