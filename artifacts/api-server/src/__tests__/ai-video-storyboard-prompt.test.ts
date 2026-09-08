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
    expect(prompt).toContain("Automatically summarize dense sources");
    expect(prompt).toContain("measure actual narration");
    expect(prompt).toContain("Never ask the user to shorten");
    expect(prompt).toContain("between 2 and 7 seconds");
    expect(prompt).toContain("never present a paraphrase as a literal quotation");
    expect(prompt).toContain("Set sourceImage to null");
  });

  it("uses a more conservative Arabic starting script without making words the timing authority", () => {
    expect(storyboardPrompt(brief(60))).toContain("approximately 59 spoken words");
    expect(storyboardPrompt(brief(60, "en"))).toContain("approximately 79 spoken words");
    expect(storyboardPrompt(brief(60))).toContain("actual recorded speech determines final timing");
  });
});