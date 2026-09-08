import { describe, expect, it, vi } from "vitest";
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: {} }));
vi.mock("@workspace/integrations-openai-ai-server/audio", () => ({ textToSpeech: vi.fn() }));
import { fitAiVideoNarration, narrationWindow, narrationWordBudget } from "../lib/ai-video-timing";

const options = {
  narration: "Water vapor cools and forms clouds.", objective: "Condensation",
  language: "en" as const, budgetSeconds: 4, voice: "nova" as const,
  outputPath: "/tmp/unused.wav", timeoutMs: 60_000, assertActive: vi.fn(async () => {}),
};
function dependencies(durations: number[]) {
  return {
    speak: vi.fn(async (_text: string) => Buffer.from("test")),
    write: vi.fn(async () => {}),
    probe: vi.fn(async () => durations.shift()!),
    rewrite: vi.fn(async (_text: string, _options: { expand: boolean }) => "Cooling vapor forms clouds."),
  };
}
describe("AI video speech timing", () => {
  it("reserves intro, transition silence and a safe final tail", () => {
    expect(narrationWindow(6, 0, 5).budget).toBeCloseTo(5.35);
    expect(narrationWindow(6, 4, 5).tail).toBe(0.9);
    expect(narrationWindow(6, 1, 5).lead).toBeGreaterThan(0.4);
    expect(narrationWordBudget(5, "ar")).toBe(10);
    expect(narrationWordBudget(5, "en")).toBe(11);
  });
  it("measures an overrun and regenerates instead of trimming or speeding speech", async () => {
    const deps = dependencies([7, 3.5]);
    const result = await fitAiVideoNarration(options, deps);
    expect(result.durationSeconds).toBe(3.5);
    expect(result.narration).toBe("Cooling vapor forms clouds.");
    expect(deps.speak).toHaveBeenCalledTimes(2);
    expect(deps.rewrite).toHaveBeenCalledOnce();
    expect(deps.rewrite.mock.calls[0]?.[1]).toMatchObject({ expand: false });
  });
  it("fails explicitly after bounded failed fitting attempts", async () => {
    const deps = dependencies([8, 7, 6]);
    await expect(fitAiVideoNarration(options, deps)).rejects.toThrow("Complete narration");
    expect(deps.speak).toHaveBeenCalledTimes(3);
  });
  it("keeps a short, complete recording unchanged for natural pauses", async () => {
    const deps = dependencies([2]);
    expect((await fitAiVideoNarration(options, deps)).durationSeconds).toBe(2);
    expect(deps.rewrite).not.toHaveBeenCalled();
  });
  it("shortens over-budget text before the first paid speech request", async () => {
    const deps = dependencies([3]);
    await fitAiVideoNarration({ ...options, narration: "This is a much longer explanation that cannot possibly fit the allocated four seconds in a natural teaching voice." }, deps);
    expect(deps.rewrite).toHaveBeenCalledOnce();
    expect(deps.speak.mock.calls[0]?.[0]).toBe("Cooling vapor forms clouds.");
  });
  it("never continues after its worker loses ownership", async () => {
    const deps = dependencies([3]);
    await expect(fitAiVideoNarration({ ...options, assertActive: async () => { throw new Error("lease lost"); } }, deps)).rejects.toThrow("lease lost");
    expect(deps.speak).not.toHaveBeenCalled();
  });
});