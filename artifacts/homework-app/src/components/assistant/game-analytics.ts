import { trackProjectAnalyticsEvent } from "@/lib/analytics";

export type AssistantGameStage = "selected" | "prepared" | "confirmed" | "completed";
const claimed = new Set<string>();

/** Operation IDs are local dedupe keys only, never analytics properties. */
export function trackAssistantGameStage(
  gameType: unknown,
  stage: AssistantGameStage,
  operationId?: string,
): void {
  if (typeof gameType !== "string" || !["solo", "wameeth_class", "tug", "xo", "wheel", "rocket", "hack", "self"].includes(gameType)) return;
  if (typeof window === "undefined") return;
  if (operationId) {
    const key = `hasaad:assistant-game:${stage}:${operationId}`;
    if (claimed.has(key)) return;
    try {
      if (window.sessionStorage.getItem(key)) return;
      // Claim before dispatch: optional analytics must never trigger retries.
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage may be disabled; retain same-page deduplication.
    }
    claimed.add(key);
  }
  trackProjectAnalyticsEvent(`assistant_game_${stage}`, { game_type: gameType, stage });
}
