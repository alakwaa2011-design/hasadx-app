import { describe, expect, it } from "vitest";
import { storyboardPrompt } from "../lib/ai-video-storyboard-prompt";
import { type AiVideoBrief } from "../lib/ai-video-schemas";

function brief(durationSeconds: 30 | 60 | 90, language: "ar" | "en" = "ar"): AiVideoBrief {
  return {
    title: "Water cycle", topic: "Water cycle", language, durationSeconds,
    aspectRatio: "16:9", visualStyle: "educational", voice: "nova",
    music: false, captions: true, prompt: "", sourceImages: [],
    idempotencyKey: "storyboard-test",
  };
}

describe("duration-first storyboard direction", () => {
  it.each([[30, 5], [60, 10], [90, 15]] as const)("automatically scopes a %ss script", (seconds, count) => {
    const prompt = storyboardPrompt(brief(seconds));
    expect(prompt).toContain(`${seconds} seconds, is the non-negotiable whole-video limit`);
    expect(prompt).toContain(`exactly ${count} scenes`);
    expect(prompt).toContain("exactly 6 seconds each");
    expect(prompt).toContain("Automatically summarize dense sources");
    expect(prompt).toContain("Never cut, abbreviate after recording, time-stretch, speed up speech");
    expect(prompt).toContain("never present a paraphrase as a literal quotation");
    expect(prompt).toContain("sourceImage: null");
  });

  it("requires visible speakers, native audio and a stable identity bible", () => {
    const prompt = storyboardPrompt(brief(60));
    expect(prompt).toContain("stable character/voice bible");
    expect(prompt).toContain("appearance must be a detailed fixed physical description");
    expect(prompt).toContain("visibly move their lips");
    expect(prompt).toContain("native synchronized character audio");
    expect(prompt).toContain("no voice-over");
    expect(prompt).toContain("pending manual quality review");
  });
});