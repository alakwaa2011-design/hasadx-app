import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  delete window.umami;
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

it("retains completion dedupe after module restoration and never sends local IDs", async () => {
  const track = vi.fn(); window.umami = { track };
  const id = crypto.randomUUID();
  const first = await import("./game-analytics");
  first.trackAssistantGameStage("xo", "completed", id);
  vi.resetModules();
  const restored = await import("./game-analytics");
  restored.trackAssistantGameStage("xo", "completed", id);
  expect(track.mock.calls).toEqual([["assistant_game_completed", { game_type: "xo", stage: "completed" }]]);
});

it("rejects unknown game types and tolerates blocked storage", async () => {
  const track = vi.fn(); window.umami = { track };
  const { trackAssistantGameStage } = await import("./game-analytics");
  trackAssistantGameStage("private free text", "selected");
  expect(track).not.toHaveBeenCalled();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const id = crypto.randomUUID();
  trackAssistantGameStage("solo", "completed", id);
  trackAssistantGameStage("solo", "completed", id);
  expect(track.mock.calls).toEqual([["assistant_game_completed", { game_type: "solo", stage: "completed" }]]);
});
