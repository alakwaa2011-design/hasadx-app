import { describe, expect, it } from "vitest";
import { allocateAiVideoSceneDurations } from "../lib/ai-video-duration-allocation";

describe("AI video duration allocation", () => {
  it("borrows one second for a measured 70.9-second total without rewriting all scenes", () => {
    // The first scene needs seven seconds; the other 14 remain at six except
    // for the deterministic one-second donor. This is a 90-second plan.
    const result = allocateAiVideoSceneDurations({
      totalSeconds: 90,
      currentDurations: Array(15).fill(6),
      speechSeconds: [6.1, ...Array(14).fill(1)],
      leads: [0.3, ...Array(14).fill(0.5)],
      tails: [...Array(14).fill(0.35), 0.9],
      safetySeconds: 0.15,
    });
    expect(result?.durations.reduce((sum, seconds) => sum + seconds, 0)).toBe(90);
    expect(result?.durations[0]).toBe(7);
    expect(result?.durations.filter((seconds) => seconds === 5)).toHaveLength(1);
  });

  it.each([[30, 5], [60, 10], [90, 15]] as const)(
    "keeps exact %i-second totals with %i provider scenes",
    (totalSeconds, count) => {
      const result = allocateAiVideoSceneDurations({
        totalSeconds,
        currentDurations: Array(count).fill(6),
        speechSeconds: Array(count).fill(1),
        leads: [0.3, ...Array(count - 1).fill(0.5)],
        tails: [...Array(count - 1).fill(0.35), 0.9],
        safetySeconds: 0.15,
      });
      expect(result?.durations).toEqual(Array(count).fill(6));
    },
  );

  it("requires summarization when one natural narration cannot fit seven seconds", () => {
    expect(allocateAiVideoSceneDurations({
      totalSeconds: 30,
      currentDurations: Array(5).fill(6),
      speechSeconds: [7, 1, 1, 1, 1],
      leads: [0.3, 0.5, 0.5, 0.5, 0.5],
      tails: [0.35, 0.35, 0.35, 0.35, 0.9],
      safetySeconds: 0.15,
    })).toBeUndefined();
  });
});