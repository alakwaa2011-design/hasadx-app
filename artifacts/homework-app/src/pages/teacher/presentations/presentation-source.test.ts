import { describe, expect, it } from "vitest";
import { hasPresentationEducationalContent } from "./presentation-source";

describe("presentation educational source validation", () => {
  it("accepts pasted source text without a topic for quick and professional builders", () => {
    expect(hasPresentationEducationalContent("", "Photosynthesis converts light into chemical energy.")).toBe(true);
  });

  it("rejects whitespace-only topic and source text", () => {
    expect(hasPresentationEducationalContent("  ", "\n\t")).toBe(false);
  });
});