import { describe, expect, it } from "vitest";
import {
  AI_VIDEO_TARGET_SCENE_COUNTS,
  aiVideoBriefSchema,
  aiVideoPatchSchema,
  InvalidStoryboardTimingError,
  isOwnedAiVideoSourcePath,
  requireRenderableDialogueStoryboard,
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
    expect(storyboard.scenes.map(({ startTime, endTime, duration }) => ({ startTime, endTime, duration }))).toEqual([
      { startTime: 0, endTime: 5, duration: 5 },
      { startTime: 5, endTime: 10, duration: 5 },
      { startTime: 10, endTime: 15, duration: 5 },
      { startTime: 15, endTime: 20, duration: 5 },
      { startTime: 20, endTime: 25, duration: 5 },
      { startTime: 25, endTime: 30, duration: 5 },
    ]);
  });

  it("enforces generated scene plans and rejects legacy long-scene storyboards", () => {
    expect(AI_VIDEO_TARGET_SCENE_COUNTS).toEqual({ 30: 5, 60: 10, 90: 15 });
    expect(() => sanitizeStoryboard({
      title: brief.title,
      scenes: Array.from({ length: 6 }, (_, index) => scene(index + 1)),
    }, brief, { expectedSceneCount: 5 })).toThrow(/exactly 5 scenes/);

    const longBrief = { ...brief, durationSeconds: 90 as const };
    expect(() => sanitizeStoryboard({
      title: brief.title,
      scenes: Array.from({ length: 10 }, (_, index) => scene(index + 1, 9)),
    }, longBrief)).toThrow(InvalidStoryboardTimingError);
    expect(() => sanitizeStoryboard({
      title: brief.title,
      scenes: Array.from({ length: 10 }, (_, index) => scene(index + 1, 9)),
    }, longBrief)).toThrow(/At least 13 scenes/);
  });

  it.each([
    { durationSeconds: 30 as const, sceneCount: 5 },
    { durationSeconds: 60 as const, sceneCount: 10 },
    { durationSeconds: 90 as const, sceneCount: 15 },
  ])("builds the $durationSeconds-second default plan with contiguous six-second scenes", ({ durationSeconds, sceneCount }) => {
    const result = sanitizeStoryboard({
      title: brief.title,
      scenes: Array.from({ length: sceneCount }, (_, index) => scene(index + 1, 6)),
    }, { ...brief, durationSeconds }, { expectedSceneCount: sceneCount });

    expect(result.scenes).toHaveLength(sceneCount);
    expect(result.scenes.every((item) => item.durationSeconds === 6)).toBe(true);
    expect(result.scenes.at(-1)?.endTime).toBe(durationSeconds);
    expect(result.scenes.every((item, index) => (
      item.startTime === index * 6 && item.endTime === (index + 1) * 6
    ))).toBe(true);
  });

  it("accepts compatibility timing metadata but derives scene timing and drops stale audio timing", () => {
    const result = sanitizeStoryboard({
      title: brief.title,
      scenes: Array.from({ length: 5 }, (_, index) => ({
        ...scene(index + 1, 6),
        startTime: 99,
        endTime: 100,
        duration: 1,
        narrationStartTime: 99.1,
        narrationEndTime: 99.8,
        audioDurationSeconds: 0.7,
      })),
    }, brief);

    expect(result.scenes[0]).toMatchObject({
      startTime: 0,
      endTime: 6,
      duration: 6,
      durationSeconds: 6,
    });
    expect(result.scenes[0]).not.toHaveProperty("narrationStartTime");
    expect(result.scenes[0]).not.toHaveProperty("narrationEndTime");
    expect(result.scenes[0]).not.toHaveProperty("audioDurationSeconds");
    expect(result.scenes.at(-1)?.endTime).toBe(30);
  });

  it("rejects normalized scenes over seven seconds with an actionable error", () => {
    expect(() => sanitizeStoryboard({
      title: brief.title,
      scenes: [
        scene(1, 20),
        scene(2, 2),
        scene(3, 2),
        scene(4, 2),
        scene(5, 2),
      ],
    }, brief)).toThrow(/Scenes may not exceed 7 seconds/);
  });

  it("keeps overlong narration available for the compose-time fitter", () => {
    const narration = "one two three four five six seven eight nine ten eleven twelve thirteen";
    const result = sanitizeStoryboard({
      title: brief.title,
      scenes: Array.from({ length: 5 }, (_, index) => ({
        ...scene(index + 1, 6),
        narration: index === 0 ? narration : "short narration",
      })),
    }, brief);
    expect(result.scenes[0]?.narration).toBe(narration);
  });

  it("rejects scene counts that cannot fit the two-second minimum", () => {
    expect(() => sanitizeStoryboard({
      title: brief.title,
      scenes: Array.from({ length: 16 }, (_, index) => scene(index + 1, 2)),
    }, brief)).toThrow(/at most 15 scenes/);
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

  it("requires exact six-second visible teacher/student dialogue for rendering", () => {
    const characters = [
      {
        id: "teacher", role: "teacher" as const, displayName: "Teacher",
        appearance: "A teacher in their forties with short dark hair and a navy jacket.",
        voice: "Warm low adult voice, measured pace, clear formal English accent.",
      },
      {
        id: "student", role: "student" as const, displayName: "Student",
        appearance: "A student aged eleven with curly brown hair and a green school sweater.",
        voice: "Bright youthful voice, medium pitch, curious tone and brisk English pace.",
      },
    ];
    const dialogueStoryboard = {
      title: brief.title,
      version: 1,
      characters,
      scenes: Array.from({ length: 5 }, (_, index) => {
        const text = index % 2 ? "Water cools into droplets." : "What happens after evaporation?";
        return {
          ...scene(index + 1, 6),
          narration: text,
          transition: "cut" as const,
          visibleCharacterIds: ["teacher", "student"],
          dialogue: [{
            speakerId: index % 2 ? "student" : "teacher",
            text,
            delivery: index % 2 ? "Answers clearly." : "Asks warmly.",
          }],
        };
      }),
    };
    const sanitized = sanitizeStoryboard(dialogueStoryboard, brief, { expectedSceneCount: 5 });
    expect(requireRenderableDialogueStoryboard(sanitized, brief).scenes).toHaveLength(5);
    expect(() => requireRenderableDialogueStoryboard(
      sanitized,
      { ...brief, music: true },
    )).toThrow(/room tone only/);

    expect(() => requireRenderableDialogueStoryboard({
      ...sanitized,
      scenes: sanitized.scenes.map((item, index) => index === 0
        ? { ...item, dialogue: undefined }
        : item),
    }, brief)).toThrow(/explicit dialogue turns/);
    expect(() => requireRenderableDialogueStoryboard({
      ...sanitized,
      scenes: sanitized.scenes.map((item, index) => index === 0
        ? { ...item, durationSeconds: 5 }
        : item),
    }, brief)).toThrow(/exactly 6 seconds/);
    expect(() => requireRenderableDialogueStoryboard({
      ...sanitized,
      scenes: sanitized.scenes.map((item, index) => index === 0
        ? {
            ...item,
            narration: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen",
            dialogue: [{
              speakerId: "teacher",
              text: "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen",
              delivery: "Speaks much too quickly.",
            }],
          }
        : item),
    }, brief)).toThrow(/structurally too long/);
  });
});