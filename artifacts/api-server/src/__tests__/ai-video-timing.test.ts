import { describe, expect, it, vi } from "vitest";
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: {} }));
vi.mock("@workspace/integrations-openai-ai-server/audio", () => ({ textToSpeech: vi.fn() }));
import {
  fitAiVideoNarration,
  narrationWindow,
  narrationWordBudget,
  NarrationNeedsReflowError,
} from "../lib/ai-video-timing";

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
    const deps = dependencies([4.5, 3.5]);
    const result = await fitAiVideoNarration(options, deps);
    expect(result.durationSeconds).toBe(3.5);
    expect(result.narration).toBe("Cooling vapor forms clouds.");
    expect(deps.speak).toHaveBeenCalledTimes(2);
    expect(deps.rewrite).toHaveBeenCalledOnce();
    expect(deps.rewrite.mock.calls[0]?.[1]).toMatchObject({ expand: false, maxWords: 4 });
  });
  it("returns the last measured audio and its matching narration for storyboard reflow", async () => {
    const deps = dependencies([4.5, 4.4, 4.3]);
    deps.rewrite
      .mockResolvedValueOnce("Cooling forms clouds.")
      .mockResolvedValueOnce("Clouds form.");
    const error = await fitAiVideoNarration(options, deps).catch(value => value);
    expect(error).toBeInstanceOf(NarrationNeedsReflowError);
    expect(error).toMatchObject({
      narration: "Clouds form.",
      durationSeconds: 4.3,
      maxWords: 1,
      attempts: 3,
    });
    expect(error.message).toContain("coordinator needs reflow");
    expect(deps.speak).toHaveBeenCalledTimes(3);
  });
  it("keeps a short, complete recording unchanged for natural pauses", async () => {
    const deps = dependencies([2]);
    expect((await fitAiVideoNarration(options, deps)).durationSeconds).toBe(2);
    expect(deps.rewrite).not.toHaveBeenCalled();
  });
  it("never expands very short complete narration", async () => {
    const deps = dependencies([1]);
    const result = await fitAiVideoNarration({ ...options, narration: "Clouds form." }, deps);
    expect(result.narration).toBe("Clouds form.");
    expect(deps.rewrite).not.toHaveBeenCalled();
    expect(deps.speak).toHaveBeenCalledWith("Clouds form.", "nova", expect.any(Number));
  });
  it("shortens over-budget text before the first paid speech request", async () => {
    const deps = dependencies([3]);
    await fitAiVideoNarration({ ...options, narration: "This is a much longer explanation that cannot possibly fit the allocated four seconds in a natural teaching voice." }, deps);
    expect(deps.rewrite).toHaveBeenCalledOnce();
    expect(deps.speak.mock.calls[0]?.[0]).toBe("Cooling vapor forms clouds.");
  });
  it("measureFirst sends over-target narration to TTS before any rewrite", async () => {
    const narration = "This complete explanation is above the conservative word target but its actual recording fits.";
    const deps = dependencies([3]);
    const result = await fitAiVideoNarration({
      ...options,
      narration,
      initialMaxWords: 4,
      measureFirst: true,
    }, deps);
    expect(result.narration).toBe(narration);
    expect(deps.speak).toHaveBeenCalledWith(narration, "nova", expect.any(Number));
    expect(deps.rewrite).not.toHaveBeenCalled();
  });
  it("does not send oversized or no-progress rewrites to speech", async () => {
    const deps = dependencies([9]);
    deps.rewrite.mockResolvedValue("This rewrite remains much too long for target.");
    const error = await fitAiVideoNarration({
      ...options,
      narration: "Water vapor cools and forms clouds.",
      maxAttempts: 2,
    }, deps).catch(value => value);
    expect(error).toBeInstanceOf(NarrationNeedsReflowError);
    expect(deps.rewrite).toHaveBeenCalledTimes(3);
    expect(deps.speak).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({
      narration: "Water vapor cools and forms clouds.",
      durationSeconds: 9,
      attempts: 1,
    });
  });
  it("never continues after its worker loses ownership", async () => {
    const deps = dependencies([3]);
    await expect(fitAiVideoNarration({ ...options, assertActive: async () => { throw new Error("lease lost"); } }, deps)).rejects.toThrow("lease lost");
    expect(deps.speak).not.toHaveBeenCalled();
  });
  it("fences provider results when the worker loses its lease", async () => {
    const deps = dependencies([3]);
    let checks = 0;
    await expect(fitAiVideoNarration({
      ...options,
      assertActive: async () => {
        checks += 1;
        if (checks === 2) throw new Error("lease lost after provider");
      },
    }, deps)).rejects.toThrow("lease lost after provider");
    expect(deps.speak).toHaveBeenCalledOnce();
    expect(deps.write).not.toHaveBeenCalled();
  });
});