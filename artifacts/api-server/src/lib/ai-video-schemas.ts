import { z } from "zod";

const objectPathSchema = z.string().trim().max(500).regex(
  /^\/objects\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._~!$&'()+,;=:@%/-]+$/,
  "Source images must be normalized /objects paths",
);

export const idempotencyKeySchema = z.string().trim().min(8).max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid idempotency key");

export const aiVideoBriefSchema = z.object({
  mode: z.enum(["narrated_images", "realistic_motion"]).optional(),
  title: z.string().trim().min(1).max(160),
  topic: z.string().trim().max(300).default(""),
  sourceText: z.string().trim().max(12_000).optional(),
  sourceImages: z.array(objectPathSchema).max(8).default([]),
  prompt: z.string().trim().max(1_500).default(""),
  language: z.enum(["ar", "en"]),
  durationSeconds: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  visualStyle: z.enum(["educational", "cinematic", "playful", "minimal"]),
  voice: z.string().trim().min(1).max(40),
  music: z.boolean(),
  captions: z.boolean(),
  idempotencyKey: idempotencyKeySchema,
}).strict().superRefine((brief, ctx) => {
  if (!brief.topic && !brief.sourceText) {
    ctx.addIssue({ code: "custom", path: ["topic"], message: "Topic or sourceText is required" });
  }
});

export const aiVideoSceneSchema = z.object({
  id: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  objective: z.string().trim().min(1).max(300),
  narration: z.string().trim().min(1).max(1_500),
  onScreenText: z.string().trim().max(60).refine(
    (text) => !text || text.split(/\s+/u).filter(Boolean).length <= 7,
    "On-screen text must contain no more than 7 words",
  ),
  visualPrompt: z.string().trim().min(1).max(800),
  durationSeconds: z.number().int().min(2).max(30),
  startTime: z.number().finite().nonnegative().optional(),
  endTime: z.number().finite().nonnegative().optional(),
  duration: z.number().finite().nonnegative().optional(),
  narrationStartTime: z.number().finite().nonnegative().optional(),
  narrationEndTime: z.number().finite().nonnegative().optional(),
  audioDurationSeconds: z.number().finite().nonnegative().optional(),
  transition: z.enum(["cut", "dissolve", "push", "zoom"]).default("dissolve"),
  sourceImage: objectPathSchema.nullable().optional(),
  visibleCharacterIds: z.array(z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/))
    .min(1).max(4).optional(),
  dialogue: z.array(z.object({
    speakerId: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
    text: z.string().trim().min(1).max(500),
    delivery: z.string().trim().min(1).max(160),
  }).strict()).min(1).max(4).optional(),
}).strict();

export const aiVideoCharacterSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  role: z.enum(["teacher", "student"]),
  displayName: z.string().trim().min(1).max(80),
  appearance: z.string().trim().min(30).max(800),
  voice: z.string().trim().min(20).max(500),
}).strict();
export const aiVideoSourceImageContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isOwnedAiVideoSourcePath(path: string, teacherId: number): boolean {
  return path.startsWith(`/objects/uploads/ai-video/${teacherId}/`);
}

export const aiVideoStoryboardSchema = z.object({
  title: z.string().trim().min(1).max(160),
  version: z.number().int().min(1).default(1),
  scenes: z.array(aiVideoSceneSchema).min(5).max(18),
  characters: z.array(aiVideoCharacterSchema).min(2).max(4).optional(),
}).strict();

export type AiVideoBrief = z.infer<typeof aiVideoBriefSchema>;
export type AiVideoStoryboard = z.infer<typeof aiVideoStoryboardSchema>;

export type AiVideoCharacter = z.infer<typeof aiVideoCharacterSchema>;
export const AI_VIDEO_TARGET_SCENE_COUNTS = {
  30: 5,
  60: 10,
  90: 15,
} as const;

export class InvalidStoryboardTimingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStoryboardTimingError";
  }
}

export class InvalidDialogueStoryboardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDialogueStoryboardError";
  }
}
export function sanitizeStoryboard(
  raw: unknown,
  brief: AiVideoBrief,
  options: { expectedSceneCount?: number } = {},
): AiVideoStoryboard {
  const parsed = aiVideoStoryboardSchema.parse(raw);
  if (options.expectedSceneCount !== undefined && parsed.scenes.length !== options.expectedSceneCount) {
    throw new InvalidStoryboardTimingError(
      `A ${brief.durationSeconds}-second storyboard requires exactly ${options.expectedSceneCount} scenes (about 6 seconds each); received ${parsed.scenes.length}. Please regenerate the storyboard.`,
    );
  }
  const minimumSceneCount = Math.ceil(brief.durationSeconds / 7);
  if (parsed.scenes.length < minimumSceneCount) {
    throw new InvalidStoryboardTimingError(
      `There are not enough scenes for a ${brief.durationSeconds}-second video. At least ${minimumSceneCount} scenes are required so no scene exceeds 7 seconds. Please add scenes or regenerate the storyboard.`,
    );
  }
  const maximumSceneCount = Math.floor(brief.durationSeconds / 2);
  if (parsed.scenes.length > maximumSceneCount) {
    throw new InvalidStoryboardTimingError(
      `A ${brief.durationSeconds}-second video can contain at most ${maximumSceneCount} scenes when every scene is at least 2 seconds. Remove scenes or choose a longer duration.`,
    );
  }
  const allowedImages = new Set(brief.sourceImages);
  const seen = new Set<string>();
  const scenes = parsed.scenes.map((scene, index) => {
    let id = scene.id || `scene-${index + 1}`;
    if (seen.has(id)) id = `scene-${index + 1}`;
    seen.add(id);
    const {
      narrationStartTime: _narrationStartTime,
      narrationEndTime: _narrationEndTime,
      audioDurationSeconds: _audioDurationSeconds,
      startTime: _startTime,
      endTime: _endTime,
      duration: _duration,
      ...editableScene
    } = scene;
    return {
      ...editableScene,
      id,
      sourceImage: scene.sourceImage && allowedImages.has(scene.sourceImage)
        ? scene.sourceImage
        : null,
    };
  });

  const originalTotal = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const exactDurations = scenes.map(
    (scene) => scene.durationSeconds * brief.durationSeconds / originalTotal,
  );
  const normalizedDurations = exactDurations.map((duration) => Math.max(2, Math.floor(duration)));
  let remaining = brief.durationSeconds - normalizedDurations.reduce((sum, duration) => sum + duration, 0);
  const adjustmentOrder = exactDurations
    .map((duration, index) => ({ index, remainder: duration - Math.floor(duration) }))
    .sort((a, b) => remaining >= 0
      ? b.remainder - a.remainder || a.index - b.index
      : a.remainder - b.remainder || b.index - a.index);
  let cursor = 0;
  while (remaining !== 0) {
    const target = adjustmentOrder[cursor % adjustmentOrder.length]!.index;
    if (remaining > 0) {
      normalizedDurations[target]! += 1;
      remaining -= 1;
    } else if (normalizedDurations[target]! > 2) {
      normalizedDurations[target]! -= 1;
      remaining += 1;
    }
    cursor += 1;
  }

  const tooLongIndex = normalizedDurations.findIndex((duration) => duration > 7);
  if (tooLongIndex >= 0) {
    throw new InvalidStoryboardTimingError(
      `Scene ${tooLongIndex + 1} would be ${normalizedDurations[tooLongIndex]} seconds after fitting the storyboard to ${brief.durationSeconds} seconds. Scenes may not exceed 7 seconds; rebalance the scene durations or regenerate with more scenes.`,
    );
  }

  let startTime = 0;
  const timed = scenes.map((scene, index) => {
    const durationSeconds = normalizedDurations[index]!;
    const endTime = startTime + durationSeconds;
    const timedScene = {
      ...scene,
      durationSeconds,
      startTime,
      endTime,
      duration: durationSeconds,
    };
    startTime = endTime;
    return timedScene;
  });
  return aiVideoStoryboardSchema.parse({
    title: parsed.title,
    version: parsed.version,
    scenes: timed,
    ...(parsed.characters ? { characters: parsed.characters } : {}),
  });
}

export const aiVideoPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  storyboard: aiVideoStoryboardSchema.optional(),
}).strict().refine((body) => body.title !== undefined || body.storyboard !== undefined, {
  message: "At least one editable field is required",
});

export type AiVideoDialogueStoryboard = AiVideoStoryboard & {
  characters: AiVideoCharacter[];
  scenes: Array<AiVideoStoryboard["scenes"][number] & {
    durationSeconds: 6;
    visibleCharacterIds: string[];
    dialogue: AiVideoDialogueTurn[];
  }>;
};

/**
 * Legacy narrated storyboards remain readable/editable, but they are not a
 * valid production input. Rendering requires the approved visible-speaker,
 * native-audio contract and never silently falls back to narration/TTS.
 */
export function requireRenderableDialogueStoryboard(
  storyboard: AiVideoStoryboard,
  brief: AiVideoBrief,
): AiVideoDialogueStoryboard {
  if (brief.music) {
    throw new InvalidDialogueStoryboardError(
      "Native dialogue rendering supports native classroom room tone only; synthetic background music must be disabled.",
    );
  }
  const expectedCount = AI_VIDEO_TARGET_SCENE_COUNTS[brief.durationSeconds];
  if (storyboard.scenes.length !== expectedCount) {
    throw new InvalidDialogueStoryboardError(
      `Native dialogue rendering requires exactly ${expectedCount} six-second scenes for ${brief.durationSeconds} seconds.`,
    );
  }
  if (storyboard.scenes.some((scene) => scene.durationSeconds !== 6)) {
    throw new InvalidDialogueStoryboardError(
      "Native dialogue rendering requires every scene to be exactly 6 seconds; speech is never cut or sped up.",
    );
  }
  if (storyboard.scenes.some((scene) => scene.transition !== "cut")) {
    throw new InvalidDialogueStoryboardError(
      "Native dialogue scenes require cut transitions so six-second speech clips are never overlapped or shortened.",
    );
  }
  if (!storyboard.characters || storyboard.characters.length !== 2) {
    throw new InvalidDialogueStoryboardError(
      "Native dialogue rendering requires a stable bible with exactly one teacher and one student.",
    );
  }
  const ids = new Set<string>();
  const roles = new Set<AiVideoCharacter["role"]>();
  const voices = new Set<string>();
  for (const character of storyboard.characters) {
    if (ids.has(character.id)) {
      throw new InvalidDialogueStoryboardError(`Duplicate character id: ${character.id}`);
    }
    ids.add(character.id);
    roles.add(character.role);
    const normalizedVoice = character.voice.toLocaleLowerCase("en").replace(/\s+/gu, " ").trim();
    if (voices.has(normalizedVoice)) {
      throw new InvalidDialogueStoryboardError("Teacher and student voice descriptions must be distinct.");
    }
    voices.add(normalizedVoice);
  }
  if (!roles.has("teacher") || !roles.has("student")) {
    throw new InvalidDialogueStoryboardError("The character bible must include both teacher and student roles.");
  }
  const speakingIds = new Set<string>();
  for (const [index, scene] of storyboard.scenes.entries()) {
    if (!scene.dialogue?.length || !scene.visibleCharacterIds || scene.visibleCharacterIds.length < 2) {
      throw new InvalidDialogueStoryboardError(
        `Scene ${index + 1} requires explicit dialogue turns and at least two visible characters.`,
      );
    }
    const visible = new Set(scene.visibleCharacterIds);
    if (scene.dialogue.length > 2) {
      throw new InvalidDialogueStoryboardError(
        `Scene ${index + 1} has too many dialogue turns for a natural six-second exchange.`,
      );
    }
    const dialogueText = scene.dialogue.map((turn) => turn.text).join(" ");
    const spokenWords = dialogueText.split(/\s+/u).filter(Boolean).length;
    const grossWordLimit = brief.language === "ar" ? 14 : 18;
    if (spokenWords > grossWordLimit || dialogueText.length > 180) {
      throw new InvalidDialogueStoryboardError(
        `Scene ${index + 1} dialogue is structurally too long for six seconds (${spokenWords} words); regenerate a more concise storyboard before any provider request.`,
      );
    }
    for (const characterId of visible) {
      if (!ids.has(characterId)) {
        throw new InvalidDialogueStoryboardError(`Scene ${index + 1} references an unknown visible character.`);
      }
    }
    for (const turn of scene.dialogue) {
      speakingIds.add(turn.speakerId);
      if (!ids.has(turn.speakerId) || !visible.has(turn.speakerId)) {
        throw new InvalidDialogueStoryboardError(
          `Scene ${index + 1} dialogue speaker must exist and be visibly present.`,
        );
      }
    }
    const transcript = scene.dialogue.map((turn) => turn.text).join(" ").replace(/\s+/gu, " ").trim();
    if (scene.narration.replace(/\s+/gu, " ").trim() !== transcript) {
      throw new InvalidDialogueStoryboardError(
        `Scene ${index + 1} narration must be only the exact dialogue transcript; external narration is not renderable.`,
      );
    }
  }
  const speakingRoles = new Set(storyboard.characters
    .filter((character) => speakingIds.has(character.id))
    .map((character) => character.role));
  if (!speakingRoles.has("teacher") || !speakingRoles.has("student")) {
    throw new InvalidDialogueStoryboardError("Both the teacher and student must have dialogue turns in the lesson.");
  }
  return storyboard as AiVideoDialogueStoryboard;
}

export type AiVideoDialogueTurn = NonNullable<AiVideoStoryboard["scenes"][number]["dialogue"]>[number];
