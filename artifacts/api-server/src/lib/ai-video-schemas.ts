import { z } from "zod";

const objectPathSchema = z.string().trim().max(500).regex(
  /^\/objects\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._~!$&'()+,;=:@%/-]+$/,
  "Source images must be normalized /objects paths",
);

export const idempotencyKeySchema = z.string().trim().min(8).max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid idempotency key");

export const aiVideoBriefSchema = z.object({
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
  onScreenText: z.string().trim().max(300),
  visualPrompt: z.string().trim().min(1).max(800),
  durationSeconds: z.number().int().min(2).max(30),
  transition: z.enum(["cut", "dissolve", "push", "zoom"]),
  sourceImage: objectPathSchema.nullable().optional(),
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
  scenes: z.array(aiVideoSceneSchema).min(5).max(10),
}).strict();

export type AiVideoBrief = z.infer<typeof aiVideoBriefSchema>;
export type AiVideoStoryboard = z.infer<typeof aiVideoStoryboardSchema>;

export function sanitizeStoryboard(
  raw: unknown,
  brief: AiVideoBrief,
): AiVideoStoryboard {
  const parsed = aiVideoStoryboardSchema.parse(raw);
  const allowedImages = new Set(brief.sourceImages);
  const seen = new Set<string>();
  const scenes = parsed.scenes.map((scene, index) => {
    let id = scene.id || `scene-${index + 1}`;
    if (seen.has(id)) id = `scene-${index + 1}`;
    seen.add(id);
    return {
      ...scene,
      id,
      sourceImage: scene.sourceImage && allowedImages.has(scene.sourceImage)
        ? scene.sourceImage
        : null,
    };
  });

  const originalTotal = scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  let allocated = 0;
  const timed = scenes.map((scene, index) => {
    const durationSeconds = index === scenes.length - 1
      ? brief.durationSeconds - allocated
      : Math.max(2, Math.round(scene.durationSeconds * brief.durationSeconds / originalTotal));
    allocated += durationSeconds;
    return { ...scene, durationSeconds };
  });
  const delta = brief.durationSeconds - timed.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  timed[timed.length - 1]!.durationSeconds += delta;
  return aiVideoStoryboardSchema.parse({ title: parsed.title, version: parsed.version, scenes: timed });
}

export const aiVideoPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  storyboard: aiVideoStoryboardSchema.optional(),
}).strict().refine((body) => body.title !== undefined || body.storyboard !== undefined, {
  message: "At least one editable field is required",
});