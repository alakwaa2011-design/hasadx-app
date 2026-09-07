import { describe, expect, it } from "vitest";
import {
  aiVideoBriefSchema,
  aiVideoPatchSchema,
  isOwnedAiVideoSourcePath,
  sanitizeStoryboard,
} from "../lib/ai-video-schemas";
import { buildAiVideoTransitionFilter } from "../lib/ai-video-renderer";

const brief = {
  title: "Water cycle",
  topic: "Evaporation and rain",
  sourceImages: ["/objects/uploads/source.png"],
  prompt: "",
  language: "en" as const,
  durationSeconds: 30 as const,
  aspectRatio: "16:9" as const,
  visualStyle: "educational" as const,
  voice: "nova",
  music: false,
  captions: true,
  idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
};

function scene(index: number, durationSeconds = 5) {
  return {
    id: `scene-${index}`,
    objective: `Objective ${index}`,
    narration: `Narration ${index}`,
    onScreenText: `Caption ${index}`,
    visualPrompt: `Diagram ${index}`,
    durationSeconds,
    transition: "dissolve" as const,
    sourceImage: index === 1 ? brief.sourceImages[0] : "/objects/uploads/not-allowed.png",
  };
}

describe("AI video schemas", () => {
  it("renders declared scene transitions instead of flattening them to cuts", () => {
    const result = buildAiVideoTransitionFilter([
      { durationSeconds: 5, transition: "cut" },
      { durationSeconds: 5, transition: "dissolve" },
      { durationSeconds: 5, transition: "push" },
      { durationSeconds: 5, transition: "zoom" },
      { durationSeconds: 5, transition: "cut" },
    ]);
    expect(result.filter).toContain("concat=n=2:v=1:a=0");
    expect(result.filter).toContain("xfade=transition=fade");
    expect(result.filter).toContain("xfade=transition=slideleft");
    expect(result.filter).toContain("xfade=transition=zoomin");
    expect(result.filter).toContain("offset=15.000");
    expect(result.videoLabel).toBe("[v4]");
    expect(result.audioLabel).toBe("[a4]");
  });

  it("keeps teacher-owned source paths isolated", () => {
    expect(isOwnedAiVideoSourcePath("/objects/uploads/ai-video/42/source", 42)).toBe(true);
    expect(isOwnedAiVideoSourcePath("/objects/uploads/ai-video/7/source", 42)).toBe(false);
    expect(isOwnedAiVideoSourcePath("/objects/uploads/source", 42)).toBe(false);
  });

  it("requires topic or source text and rejects non-normalized object paths", () => {
    expect(aiVideoBriefSchema.safeParse({ ...brief, topic: "", sourceText: "" }).success).toBe(false);
    expect(aiVideoBriefSchema.safeParse({
      ...brief,
      sourceImages: ["https://example.com/image.png"],
    }).success).toBe(false);
    expect(aiVideoBriefSchema.safeParse({
      ...brief,
      sourceImages: ["/objects/uploads/../secret"],
    }).success).toBe(false);
  });

  it("bounds source and prompt payloads", () => {
    expect(aiVideoBriefSchema.safeParse({ ...brief, sourceText: "x".repeat(12_001) }).success).toBe(false);
    expect(aiVideoBriefSchema.safeParse({ ...brief, prompt: "x".repeat(1_501) }).success).toBe(false);
    expect(aiVideoBriefSchema.safeParse({
      ...brief,
      sourceImages: Array.from({ length: 9 }, (_, index) => `/objects/uploads/${index}.png`),
    }).success).toBe(false);
  });

  it("normalizes total timing and strips unapproved source images", () => {
    const storyboard = sanitizeStoryboard({
      title: brief.title,
      scenes: Array.from({ length: 6 }, (_, index) => scene(index + 1)),
    }, brief);
    expect(storyboard.scenes.reduce((sum, item) => sum + item.durationSeconds, 0)).toBe(30);
    expect(storyboard.version).toBe(1);
    expect(storyboard.scenes[0]?.sourceImage).toBe(brief.sourceImages[0]);
    expect(storyboard.scenes[1]?.sourceImage).toBeNull();
  });

  it("preserves a teacher-incremented storyboard version and only accepts contracted transitions", () => {
    const result = sanitizeStoryboard({
      title: brief.title,
      version: 2,
      scenes: Array.from({ length: 6 }, (_, index) => ({
        ...scene(index + 1),
        transition: index === 0 ? "push" : "zoom",
      })),
    }, brief);
    expect(result.version).toBe(2);
    expect(result.scenes[0]?.transition).toBe("push");
    expect(aiVideoPatchSchema.safeParse({
      storyboard: {
        title: brief.title,
        scenes: Array.from({ length: 5 }, (_, index) => ({ ...scene(index + 1), transition: "fade" })),
      },
    }).success).toBe(false);
  });

  it("allows only title and a bounded editable storyboard", () => {
    expect(aiVideoPatchSchema.safeParse({}).success).toBe(false);
    expect(aiVideoPatchSchema.safeParse({ status: "ready" }).success).toBe(false);
    expect(aiVideoPatchSchema.safeParse({ title: "Updated" }).success).toBe(true);
  });
});