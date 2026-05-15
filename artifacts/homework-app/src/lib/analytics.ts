/**
 * Unified frontend event tracker for HasadX.
 *
 * Usage:
 *   import { trackEvent, EVENTS } from "@/lib/analytics";
 *   trackEvent(EVENTS.assignmentCreatedClicked, "assignment");
 *   trackEvent(EVENTS.assignmentCreatedSuccess, "assignment", { id: 123 });
 *   trackEvent(EVENTS.assignmentCreatedFailed,  "assignment", { reason: "validation" });
 *
 * Notes:
 * - Fire-and-forget; never throws, never blocks the UI.
 * - Generates a per-tab session_id stored in sessionStorage (so the same
 *   user across multiple tabs is counted once per tab — and we still dedupe
 *   in the backend by user_id).
 * - Backwards-compatible with the legacy /api/activity/page-view endpoint;
 *   the page-view tracker keeps using that route.
 */

const API_BASE = import.meta.env.VITE_API_URL || "";
const SESSION_STORAGE_KEY = "hsdx_session_id";

function genId(): string {
  // Browsers without crypto.randomUUID? Fall back to Math.random.
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  );
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let id = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = genId();
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return genId();
  }
}

export type EventCategory =
  | "navigation"
  | "auth"
  | "assignment"
  | "game"
  | "arena"
  | "ai"
  | "presentation"
  | "library"
  | "settings"
  | "feedback"
  | "system";

/** Send a single event to the backend. Fire-and-forget. */
export function trackEvent(
  eventName: string,
  eventCategory?: EventCategory | string,
  metadata?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    const body = {
      eventName,
      eventCategory: eventCategory ?? null,
      page: window.location.pathname + window.location.search,
      sessionId: getSessionId(),
      metadata: metadata ?? null,
    };
    fetch(`${API_BASE}/api/analytics/track`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Convenience: emits both the attempt and the result event. */
export function trackAttempt(
  baseName: string,
  category: EventCategory,
  promise: Promise<unknown> | (() => Promise<unknown>),
  buildMetadata?: (ok: boolean, value: unknown) => Record<string, unknown>,
): Promise<unknown> {
  trackEvent(`${baseName}_clicked`, category);
  const p = typeof promise === "function" ? promise() : promise;
  return p.then(
    (v) => {
      trackEvent(
        `${baseName}_success`,
        category,
        buildMetadata?.(true, v) ?? undefined,
      );
      return v;
    },
    (err: unknown) => {
      trackEvent(`${baseName}_failed`, category, {
        ...(buildMetadata?.(false, err) ?? {}),
        reason: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      });
      throw err;
    },
  );
}

/** Canonical event-name catalogue. Backend dashboards rely on these strings;
 *  add new keys here so they show up in "top features" lists. */
export const EVENTS = {
  // Navigation (legacy /api/activity/page-view also fires "view")
  pageView: "page_view",

  // Auth
  loginAttempted: "login_clicked",
  loginSuccess: "login_success",
  loginFailed: "login_failed",
  logoutClicked: "logout_clicked",

  // Assignments
  createAssignmentClicked: "create_assignment_clicked",
  assignmentCreatedSuccess: "assignment_created_success",
  assignmentCreatedFailed: "assignment_created_failed",
  shareAssignmentClicked: "share_assignment_clicked",
  shareAssignmentSuccess: "share_assignment_success",
  shareAssignmentFailed: "share_assignment_failed",

  // Live games
  startLiveGameClicked: "start_live_game_clicked",
  liveGameStarted: "live_game_started",
  liveGameStartFailed: "live_game_start_failed",
  studentJoinGameAttempted: "student_join_game_attempted",
  studentJoinedGame: "student_joined_game",
  studentJoinGameFailed: "student_join_game_failed",
  gameCompleted: "game_completed",

  // Arena
  arenaOpened: "arena_opened",
  arenaSessionStarted: "arena_session_started",
  arenaSessionCompleted: "arena_session_completed",

  // AI
  aiGeneratorOpened: "ai_generator_opened",
  aiGenerationRequested: "ai_generation_requested",
  aiGenerationCompleted: "ai_generation_completed",
  aiGenerationFailed: "ai_generation_failed",

  // Presentations
  presentationBuildStarted: "presentation_build_started",
  presentationBuildCompleted: "presentation_build_completed",
  presentationBuildFailed: "presentation_build_failed",
} as const;

/* ────────────────────────────────────────────────────────────────────── */
/* Heartbeat                                                              */
/* ────────────────────────────────────────────────────────────────────── */

let heartbeatTimer: number | null = null;
let visibilityBound = false;

function sendHeartbeat() {
  if (typeof window === "undefined") return;
  if (document.visibilityState === "hidden") return;
  try {
    const body = JSON.stringify({
      sessionId: getSessionId(),
      page: window.location.pathname + window.location.search,
    });
    fetch(`${API_BASE}/api/analytics/heartbeat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Start the 30s heartbeat. Idempotent. */
export function startHeartbeat(intervalMs = 30_000): void {
  if (typeof window === "undefined") return;
  if (heartbeatTimer !== null) return;
  // First ping immediately so the user shows up online without a 30s wait.
  sendHeartbeat();
  heartbeatTimer = window.setInterval(sendHeartbeat, intervalMs);
  if (!visibilityBound) {
    visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") sendHeartbeat();
    });
  }
}

export function stopHeartbeat(): void {
  if (heartbeatTimer !== null && typeof window !== "undefined") {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
