import { describe, expect, it } from "vitest";
import {
  AI_VIDEO_PRICE_PER_SECOND_USD,
  AI_VIDEO_PRICE_SOURCE,
  AI_VIDEO_PRICE_VERSION,
  aiVideoRenderContentHash,
  createAiVideoRenderQuote,
  validateAiVideoRenderApproval,
} from "../lib/ai-video-render-approval";

function project() {
  return {
    id: 9,
    brief: {
      title: "Water cycle",
      topic: "Water",
      sourceImages: [],
      prompt: "",
      language: "en" as const,
      durationSeconds: 30 as const,
      aspectRatio: "16:9" as const,
      visualStyle: "educational" as const,
      voice: "nova",
      music: false,
      captions: true,
      idempotencyKey: "storyboard-key",
    },
    storyboard: {
      title: "Water cycle",
      version: 1,
      characters: [
        {
          id: "teacher",
          role: "teacher" as const,
          displayName: "Ms River",
          appearance: "An adult science teacher wearing a blue jacket and round glasses.",
          voice: "Warm, measured adult female voice with a clear educational tone.",
        },
        {
          id: "student",
          role: "student" as const,
          displayName: "Sam",
          appearance: "A curious school student wearing a green sweater and carrying a notebook.",
          voice: "Bright, youthful male voice with an inquisitive and energetic tone.",
        },
      ],
      scenes: Array.from({ length: 5 }, (_, index) => ({
        id: `scene-${index + 1}`,
        objective: `Objective ${index + 1}`,
        narration: `Question ${index + 1} Answer ${index + 1}`,
        onScreenText: `Text ${index + 1}`,
        visualPrompt: `Visual ${index + 1}`,
        durationSeconds: 6,
        transition: "cut" as const,
        sourceImage: null,
        visibleCharacterIds: ["teacher", "student"],
        dialogue: [
          { speakerId: "student", text: `Question ${index + 1}`, delivery: "Curious and clear" },
          { speakerId: "teacher", text: `Answer ${index + 1}`, delivery: "Warm and concise" },
        ],
      })),
    },
  };
}

describe("AI video render approval", () => {
  it("creates a server-calculated, expiring quote bound to all saved content", () => {
    const now = Date.parse("2026-09-08T12:00:00.000Z");
    const saved = project();
    const quote = createAiVideoRenderQuote(saved, 5, now);

    expect(quote).toMatchObject({
      projectId: 9,
      contentHash: aiVideoRenderContentHash(saved),
      model: "fal-ai/veo3.1",
      currency: "USD",
      generatedSeconds: 30,
      sceneCount: 5,
      providerCostUsd: 30 * AI_VIDEO_PRICE_PER_SECOND_USD,
      totalEstimatedUsd: 12,
      additionalProviderCostUsd: 0,
      platformCredits: 5,
      pricingVersion: AI_VIDEO_PRICE_VERSION,
      priceSource: AI_VIDEO_PRICE_SOURCE,
      requiresManualReview: true,
    });
    expect(quote.expiresAt).toBe("2026-09-08T12:15:00.000Z");
    expect(quote.id).toMatch(/^[0-9a-f-]{36}$/);

    saved.storyboard.scenes[0].visualPrompt = "A materially edited visual";
    expect(aiVideoRenderContentHash(saved)).not.toBe(quote.contentHash);
  });

  it("accepts only the exact live quote, content, credit price, and provider budget", () => {
    const now = Date.parse("2026-09-08T12:00:00.000Z");
    const saved = { ...project(), renderQuote: undefined as unknown };
    const quote = createAiVideoRenderQuote(saved, 5, now);
    saved.renderQuote = quote;

    expect(validateAiVideoRenderApproval(saved, {
      quoteId: quote.id,
      accepted: true,
      maxProviderCostUsd: quote.totalEstimatedUsd,
    }, 5, now + 1)).toEqual(quote);

    for (const invalid of [
      { quoteId: "550e8400-e29b-41d4-a716-446655440000", accepted: true as const, maxProviderCostUsd: 12 },
      { quoteId: quote.id, accepted: false as unknown as true, maxProviderCostUsd: 12 },
      { quoteId: quote.id, accepted: true as const, maxProviderCostUsd: 13 },
    ]) {
      expect(() => validateAiVideoRenderApproval(saved, invalid, 5, now + 1)).toThrow();
    }
    expect(() => validateAiVideoRenderApproval(saved, {
      quoteId: quote.id, accepted: true, maxProviderCostUsd: 12,
    }, 6, now + 1)).toThrow();
    expect(() => validateAiVideoRenderApproval(saved, {
      quoteId: quote.id, accepted: true, maxProviderCostUsd: 12,
    }, 5, Date.parse(quote.expiresAt))).toThrow();
  });
});