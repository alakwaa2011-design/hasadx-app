import { describe, expect, it } from "vitest";
import {
  canRunCorrectiveOutlineRetry,
  outlineProviderRequestOptions,
  presentationBriefSchema,
  primaryOutlineTimeoutMs,
} from "../routes/ai-presentations";

describe("professional presentation outline request budget", () => {
  it("disables SDK retries and stays below the 120s proxy deadline", () => {
    expect(outlineProviderRequestOptions(100_000)).toEqual({
      timeout: 95_000,
      maxRetries: 0,
    });
  });

  it("preserves a shorter remaining request budget", () => {
    expect(outlineProviderRequestOptions(24_500)).toEqual({
      timeout: 24_500,
      maxRetries: 0,
    });
  });

  it("reserves fallback and correction time for quick creation", () => {
    expect(primaryOutlineTimeoutMs("quick", 100_000)).toBe(45_000);
    expect(primaryOutlineTimeoutMs("explain", 100_000)).toBe(60_000);
    expect(primaryOutlineTimeoutMs("quick", 24_500)).toBe(24_500);
  });

  it("allows one quality correction after a provider fallback when time remains", () => {
    expect(canRunCorrectiveOutlineRetry(22_000, false)).toBe(true);
    expect(canRunCorrectiveOutlineRetry(14_999, false)).toBe(false);
    expect(canRunCorrectiveOutlineRetry(40_000, true)).toBe(false);
  });

  it("accepts pasted source text without a topic and rejects an empty educational source", () => {
    const baseBrief = {
      language: "en" as const,
      subject: "Science",
      gradeLevel: "5",
      topic: "",
      presentationKind: "quick" as const,
      slideCount: 8,
      durationMinutes: 15 as const,
      languageLevel: "medium" as const,
      density: "balanced" as const,
      toggles: { activities: true, questions: true, poll: true, quiz: true },
    };

    expect(presentationBriefSchema.safeParse({
      ...baseBrief,
      sourceText: "Photosynthesis converts light into stored chemical energy.",
    }).success).toBe(true);
    expect(presentationBriefSchema.safeParse(baseBrief).success).toBe(false);
  });
});