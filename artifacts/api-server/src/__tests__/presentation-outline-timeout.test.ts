import { describe, expect, it } from "vitest";
import {
  canRunCorrectiveOutlineRetry,
  outlineSchema,
  outlineSlideCardSchema,
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

  it("accepts content-complete title and quiz slides without duplicate talking points", () => {
    const baseSlide = {
      index: 1,
      title: "Quick check",
      purpose: "Check understanding",
      talkingPoints: [],
      interactionHint: null,
      visualDirection: {},
    };

    expect(outlineSlideCardSchema.safeParse({
      ...baseSlide,
      kind: "title",
    }).success).toBe(true);

    expect(outlineSlideCardSchema.safeParse({
      ...baseSlide,
      kind: "interactive",
      interactionHint: "quiz",
      gameQuestions: [{
        prompt: "Which answer is correct?",
        options: ["Alpha", "Beta"],
        correctIndex: 0,
      }],
    }).success).toBe(true);

    expect(outlineSlideCardSchema.safeParse({
      ...baseSlide,
      kind: "concept-card",
    }).success).toBe(false);

    expect(outlineSlideCardSchema.safeParse({
      ...baseSlide,
      kind: "interactive",
      interactionHint: "quiz",
      gameQuestions: [{
        prompt: "Which answer is correct?",
        options: ["Option 1", "Option 2"],
        correctIndex: 0,
      }],
    }).success).toBe(false);

    expect(outlineSlideCardSchema.safeParse({
      ...baseSlide,
      kind: "interactive",
      interactionHint: "quiz",
      gameQuestions: [{
        prompt: "Which answer is correct?",
        options: ["Alpha", "Beta"],
        correctIndex: 2,
      }],
    }).success).toBe(false);
  });

  it("requires deterministic fallbacks when an outline requests image search", () => {
    const baseSlide = {
      index: 1,
      kind: "concept-card",
      title: "Water cycle",
      purpose: "Explain evaporation",
      talkingPoints: ["Water changes into vapor"],
      interactionHint: null,
      visualDirection: {},
    };
    const outline = {
      language: "en",
      density: "balanced",
      totalEstimatedMinutes: 15,
      objectives: ["Explain evaporation", "Identify condensation"],
      teachingFlow: [
        { stage: "opener", slideIndices: [1], estimatedMinutes: 2 },
        { stage: "concept", slideIndices: [2], estimatedMinutes: 6 },
        { stage: "practice", slideIndices: [2], estimatedMinutes: 4 },
        { stage: "closure", slideIndices: [3], estimatedMinutes: 3 },
      ],
      slides: [
        { ...baseSlide, index: 1, kind: "title", talkingPoints: [] },
        {
          ...baseSlide,
          index: 2,
          imagePlan: {
            imageQuery: "water cycle illustration",
            mediaType: "illustration",
            placement: "side",
            fallback: "none",
          },
        },
        { ...baseSlide, index: 3, kind: "closure" },
      ],
    };

    expect(outlineSchema.safeParse(outline).success).toBe(false);
    expect(outlineSchema.safeParse({
      ...outline,
      slides: outline.slides.map((slide, index) => index === 1
        ? {
            ...slide,
            imagePlan: {
              imageQuery: "water cycle illustration",
              mediaType: "illustration",
              placement: "side",
              fallback: "icon",
            },
          }
        : slide),
    }).success).toBe(true);
  });
});