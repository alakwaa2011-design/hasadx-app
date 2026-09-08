import { describe, expect, it } from "vitest";
import { narrationWindow } from "../lib/ai-video-timing";

describe("AI video narration windows", () => {
  it("supports a legitimate two-second final scene", () => {
    const window = narrationWindow(2, 4, 5);
    expect(window).toEqual({ lead: 0.5, tail: 0.9, budget: 0.6 });
    expect(window.budget - 0.15).toBeCloseTo(0.45);
  });
});