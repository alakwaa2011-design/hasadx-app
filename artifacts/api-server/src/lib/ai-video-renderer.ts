import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { and, eq, sql } from "drizzle-orm";
import {
  aiVideoProjectsTable,
  creditHoldsTable,
  creditTransactionsTable,
  db,
  type AiVideoProject,
} from "@workspace/db";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";
import { CreditService } from "./credit-service";
import {
  aiVideoBriefSchema,
  aiVideoSourceImageContentTypes,
  aiVideoStoryboardSchema,
  isOwnedAiVideoSourcePath,
} from "./ai-video-schemas";

const execFileAsync = promisify(execFile);
const storage = new ObjectStorageService();
const VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
const TOTAL_RENDER_TIMEOUT_MS = 45 * 60_000;
const PROVIDER_TIMEOUT_MS = 120_000;
export const AI_VIDEO_RENDER_LEASE_MS = 3 * 60_000;
export const AI_VIDEO_STORYBOARD_LEASE_MS = 3 * 60_000;
const AI_VIDEO_RENDER_HEARTBEAT_MS = 60_000;
type Voice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
type SceneTransition = "cut" | "dissolve" | "push" | "zoom";

export function aiVideoRenderCreditRequestId(
  teacherId: number,
  projectId: number,
  renderIdempotencyKey: string,
): string {
  return `${teacherId}:ai-video-render:${projectId}:${renderIdempotencyKey}`;
}

export function aiVideoStoryboardCreditRequestId(
  teacherId: number,
  storyboardIdempotencyKey: string,
): string {
  return `${teacherId}:ai-video:${storyboardIdempotencyKey}`;
}

function srtTimestamp(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  const secs = Math.floor(milliseconds % 60_000 / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function dimensions(aspectRatio: string): { width: number; height: number } {
  if (aspectRatio === "9:16") return { width: 720, height: 1280 };
  if (aspectRatio === "1:1") return { width: 720, height: 720 };
  return { width: 1280, height: 720 };
}

function transitionSpec(transition: SceneTransition): { ffmpeg: string; duration: number } {
  if (transition === "dissolve") return { ffmpeg: "fade", duration: 0.5 };
  if (transition === "push") return { ffmpeg: "slideleft", duration: 0.5 };
  if (transition === "zoom") return { ffmpeg: "zoomin", duration: 0.5 };
  return { ffmpeg: "cut", duration: 0 };
}

export function buildAiVideoTransitionFilter(
  scenes: Array<{ durationSeconds: number; transition: SceneTransition }>,
): { filter: string; videoLabel: string; audioLabel: string } {
  if (scenes.length < 2) throw new Error("At least two scenes are required");
  const filters: string[] = [];
  for (let index = 0; index < scenes.length; index += 1) {
    filters.push(
      `[${index}:v]fps=25,settb=AVTB,setpts=PTS-STARTPTS[vbase${index}]`,
    );
    filters.push(
      `[${index}:a]aresample=44100,asetpts=PTS-STARTPTS[abase${index}]`,
    );
  }
  let videoLabel = "[vbase0]";
  let audioLabel = "[abase0]";
  let elapsed = 0;

  for (let index = 0; index < scenes.length - 1; index += 1) {
    const scene = scenes[index]!;
    elapsed += scene.durationSeconds;
    const spec = transitionSpec(scene.transition);
    const nextVideoLabel = `[v${index + 1}]`;
    const nextAudioLabel = `[a${index + 1}]`;
    const nextVideoInput = `[vbase${index + 1}]`;
    const nextAudioInput = `[abase${index + 1}]`;
    if (spec.duration === 0) {
      filters.push(`${videoLabel}${nextVideoInput}concat=n=2:v=1:a=0${nextVideoLabel}`);
      filters.push(`${audioLabel}${nextAudioInput}concat=n=2:v=0:a=1${nextAudioLabel}`);
    } else {
      const duration = spec.duration.toFixed(3);
      filters.push(
        `${videoLabel}${nextVideoInput}xfade=transition=${spec.ffmpeg}:duration=${duration}:offset=${elapsed.toFixed(3)}${nextVideoLabel}`,
      );
      filters.push(
        `${audioLabel}${nextAudioInput}acrossfade=d=${duration}:c1=tri:c2=tri${nextAudioLabel}`,
      );
    }
    videoLabel = nextVideoLabel;
    audioLabel = nextAudioLabel;
  }

  return { filter: filters.join(";"), videoLabel, audioLabel };
}

async function materializeImage(
  path: string | null | undefined,
  prompt: string,
  teacherId: number,
  timeoutMs: number,
): Promise<Buffer> {
  if (path) {
    if (!isOwnedAiVideoSourcePath(path, teacherId)) {
      throw new Error("Selected source image does not belong to this project owner");
    }
    const file = await storage.getObjectEntityFile(path);
    const [metadata] = await file.getMetadata();
    if (!aiVideoSourceImageContentTypes.has(String(metadata.contentType ?? "").toLowerCase())) {
      throw new Error("Selected source object must be a JPEG, PNG, or WebP image");
    }
    const [buffer] = await file.download();
    if (buffer.length > 15 * 1024 * 1024) throw new Error("Selected source image exceeds 15MB");
    return buffer;
  }
  const buffer = await generateImageBuffer(
    `${prompt}. Educational ${"illustration"}, no people or faces, no letters, no words, no typography, no logos, no watermark.`,
    "1024x1024",
    timeoutMs,
  );
  if (!buffer.length) throw new Error("Image provider returned an empty image");
  return buffer;
}

function remainingTimeout(deadline: number, capMs: number, stage: string): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error(`AI video render exceeded its total deadline during ${stage}`);
  }
  return Math.max(1_000, Math.min(capMs, remaining));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stage: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${stage} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function verifyImageFile(path: string): Promise<void> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height",
    "-of", "json",
    path,
  ], { timeout: 30_000, maxBuffer: 256 * 1024 });
  const stream = JSON.parse(stdout).streams?.[0] as
    | { codec_name?: string; width?: number; height?: number }
    | undefined;
  const allowedCodecs = new Set(["mjpeg", "png", "webp"]);
  const width = Number(stream?.width ?? 0);
  const height = Number(stream?.height ?? 0);
  if (
    !stream ||
    !allowedCodecs.has(String(stream.codec_name)) ||
    width < 1 ||
    height < 1 ||
    width > 12_000 ||
    height > 12_000 ||
    width * height > 40_000_000
  ) {
    throw new Error("Source image bytes or dimensions are not supported");
  }
}

async function renderClaimedProject(project: AiVideoProject): Promise<void> {
  let dir: string | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  let leaseLost = false;
  const deadline = Date.now() + TOTAL_RENDER_TIMEOUT_MS;
  const creditRequestId = project.renderIdempotencyKey
    ? aiVideoRenderCreditRequestId(project.teacherId, project.id, project.renderIdempotencyKey)
    : null;

  const renewLease = async (): Promise<void> => {
    if (!project.renderLeaseId) throw new Error("AI video render has no worker lease");
    const renewed = await db.update(aiVideoProjectsTable).set({
      renderLeaseExpiresAt: new Date(Date.now() + AI_VIDEO_RENDER_LEASE_MS),
      updatedAt: new Date(),
    }).where(and(
      eq(aiVideoProjectsTable.id, project.id),
      eq(aiVideoProjectsTable.status, "rendering"),
      eq(aiVideoProjectsTable.renderLeaseId, project.renderLeaseId),
    )).returning({ id: aiVideoProjectsTable.id });
    if (!renewed[0]) throw new Error("AI video render worker lease was lost");
    if (creditRequestId) await CreditService.heartbeatHold(creditRequestId);
  };

  try {
    dir = await mkdtemp(join(tmpdir(), `hasaad-ai-video-${project.id}-`));
    await renewLease();
    heartbeat = setInterval(() => {
      renewLease().catch((err) => {
        leaseLost = true;
        logger.error({ err, projectId: project.id }, "AI video render heartbeat failed");
      });
    }, AI_VIDEO_RENDER_HEARTBEAT_MS);

    const brief = aiVideoBriefSchema.parse(project.brief);
    const storyboard = aiVideoStoryboardSchema.parse(project.storyboard);
    const { width, height } = dimensions(brief.aspectRatio);
    const voice: Voice = VOICES.has(brief.voice) ? brief.voice as Voice : "nova";
    const segments: string[] = [];
    let elapsed = 0;
    const captions: string[] = [];

    for (const [index, scene] of storyboard.scenes.entries()) {
      if (leaseLost) throw new Error("AI video render worker lease was lost");
      const imagePath = join(dir, `image-${index}.png`);
      const audioPath = join(dir, `audio-${index}.wav`);
      const segmentPath = join(dir, `segment-${index}.mp4`);
      const imageTimeout = remainingTimeout(deadline, PROVIDER_TIMEOUT_MS, `scene ${index + 1} image`);
      const image = await withTimeout(
        materializeImage(
          scene.sourceImage,
          `${scene.visualPrompt}. Style: ${brief.visualStyle}`,
          project.teacherId,
          imageTimeout,
        ),
        imageTimeout,
        `Scene ${index + 1} image`,
      );
      const speechTimeout = remainingTimeout(deadline, PROVIDER_TIMEOUT_MS, `scene ${index + 1} narration`);
      const audio = await withTimeout(
        textToSpeech(scene.narration, voice, "wav", speechTimeout),
        speechTimeout,
        `Scene ${index + 1} narration`,
      );
      if (!audio.length) throw new Error("Speech provider returned empty audio");
      await Promise.all([writeFile(imagePath, image), writeFile(audioPath, audio)]);
      await verifyImageFile(imagePath);

      const transitionDuration = index < storyboard.scenes.length - 1
        ? transitionSpec(scene.transition).duration
        : 0;
      const renderedDuration = scene.durationSeconds + transitionDuration;
      const frames = Math.ceil(renderedDuration * 25);
      const filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='min(zoom+0.0008,1.08)':d=${frames}:s=${width}x${height}:fps=25,format=yuv420p`;
      const segmentTimeout = remainingTimeout(deadline, 180_000, `scene ${index + 1} encoding`);
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-loop", "1", "-i", imagePath, "-i", audioPath,
        "-vf", filter, "-af", "apad",
        "-t", String(renderedDuration),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
        "-movflags", "+faststart", segmentPath,
      ], { timeout: segmentTimeout, maxBuffer: 1024 * 1024 });
      segments.push(segmentPath);
      if (brief.captions) {
        captions.push(`${index + 1}\n${srtTimestamp(elapsed)} --> ${srtTimestamp(elapsed + scene.durationSeconds)}\n${scene.onScreenText || scene.narration}\n`);
      }
      elapsed += scene.durationSeconds;
    }

    if (leaseLost) throw new Error("AI video render worker lease was lost");
    const joinedPath = join(dir, "joined.mp4");
    const transitionTimeout = remainingTimeout(deadline, 180_000, "scene transitions");
    const transitionFilter = buildAiVideoTransitionFilter(storyboard.scenes);
    const transitionArgs = segments.flatMap((path) => ["-i", path]);
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      ...transitionArgs,
      "-filter_complex", transitionFilter.filter,
      "-map", transitionFilter.videoLabel,
      "-map", transitionFilter.audioLabel,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
      "-movflags", "+faststart", joinedPath,
    ], { timeout: transitionTimeout, maxBuffer: 1024 * 1024 });

    let finalPath = joinedPath;
    if (brief.music) {
      const musicTimeout = remainingTimeout(deadline, 120_000, "background music");
      const musicPath = join(dir, "with-music.mp4");
      // A quiet, deterministic ambient chord avoids licensing external music
      // while keeping narration dominant. No user-supplied audio/voice cloning.
      const ambient = `aevalsrc=0.02*(sin(2*PI*220*t)+sin(2*PI*277.18*t)+sin(2*PI*329.63*t)):s=44100:d=${brief.durationSeconds}`;
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y", "-i", joinedPath,
        "-f", "lavfi", "-i", ambient,
        "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:weights='1 0.16':normalize=0[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
        "-b:a", "128k", "-movflags", "+faststart", musicPath,
      ], { timeout: musicTimeout, maxBuffer: 1024 * 1024 });
      finalPath = musicPath;
    }
    if (brief.captions) {
      const captionsTimeout = remainingTimeout(deadline, 180_000, "captions");
      const srtPath = join(dir, "captions.srt");
      const captionInputPath = finalPath;
      finalPath = join(dir, "final.mp4");
      await writeFile(srtPath, captions.join("\n"), "utf8");
      await execFileAsync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y", "-i", captionInputPath,
        "-vf", "subtitles=captions.srt:force_style='FontSize=22,Outline=2,Alignment=2,MarginV=28'",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-c:a", "copy",
        "-movflags", "+faststart", finalPath,
      ], { cwd: dir, timeout: captionsTimeout, maxBuffer: 1024 * 1024 });
    }

    const uploadTimeout = remainingTimeout(deadline, 180_000, "video upload");
    const output = await readFile(finalPath);
    if (!output.length) throw new Error("Renderer produced an empty video");
    const outputUrl = await withTimeout(
      storage.uploadBufferAsPrivate({
        buffer: output,
        contentType: "video/mp4",
        ownerPrefix: `ai-video/${project.teacherId}/projects/${project.id}`,
        extension: "mp4",
      }),
      uploadTimeout,
      "Video upload",
    );
    if (!outputUrl.startsWith("/objects/")) throw new Error("Video upload did not return a durable object path");
    await db.transaction(async (tx) => {
      if (creditRequestId) {
        const [hold] = await tx.select({ status: creditHoldsTable.status })
          .from(creditHoldsTable)
          .where(eq(creditHoldsTable.requestId, creditRequestId))
          .limit(1);
        if (hold?.status === "pending") {
          const captured = await tx.update(creditHoldsTable).set({
            status: "completed",
            completedAt: new Date(),
          }).where(and(
            eq(creditHoldsTable.requestId, creditRequestId),
            eq(creditHoldsTable.status, "pending"),
          )).returning({ id: creditHoldsTable.id });
          if (!captured[0]) throw new Error("Render credit capture was not confirmed");
          await tx.update(creditTransactionsTable).set({ status: "completed" })
            .where(eq(creditTransactionsTable.requestId, creditRequestId));
        } else if (hold && hold.status !== "completed") {
          throw new Error("Render credit capture was not confirmed");
        }
      }

      const ready = await tx.update(aiVideoProjectsTable).set({
        status: "ready",
        outputUrl,
        errorMessage: null,
        renderLeaseId: null,
        renderLeaseExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(aiVideoProjectsTable.id, project.id),
        eq(aiVideoProjectsTable.status, "rendering"),
        eq(aiVideoProjectsTable.renderLeaseId, project.renderLeaseId!),
      )).returning({ id: aiVideoProjectsTable.id });
      if (!ready[0]) throw new Error("Rendered project state changed before completion");
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 2_000) : "Unknown render failure";
    logger.error({ err, projectId: project.id }, "AI video render failed");
    let creditReconciled = true;
    if (project.renderIdempotencyKey) {
      try {
        const requestId = aiVideoRenderCreditRequestId(project.teacherId, project.id, project.renderIdempotencyKey);
        const holdStatus = await CreditService.getHoldStatus(requestId);
        if (holdStatus === "completed") {
          await CreditService.compensateCapturedHold(requestId, "AI video render failed after capture");
        } else {
          await CreditService.refund(requestId, "AI video render failed");
        }
      } catch (refundErr) {
        creditReconciled = false;
        logger.error({ err: refundErr, projectId: project.id }, "AI video render credit refund failed");
      }
    }
    if (creditReconciled) {
      await db.update(aiVideoProjectsTable).set({
        status: "failed",
        errorMessage: message,
        outputUrl: null,
        renderLeaseId: null,
        renderLeaseExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(aiVideoProjectsTable.id, project.id),
        eq(aiVideoProjectsTable.status, "rendering"),
        eq(aiVideoProjectsTable.renderLeaseId, project.renderLeaseId!),
      ));
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (dir) {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (err) {
        logger.warn({ err, projectId: project.id }, "AI video render temp cleanup failed");
      }
    }
  }
}

export async function runAiVideoRender(project: AiVideoProject): Promise<void> {
  await renderClaimedProject(project);
}

export function startAiVideoRender(project: AiVideoProject): void {
  void runAiVideoRender(project).catch((err) => {
    logger.error({ err, projectId: project.id }, "AI video render worker escaped its failure boundary");
  });
}

export async function failStaleAiVideoStoryboards(projectId?: number): Promise<number> {
  const legacyStaleBefore = new Date(Date.now() - AI_VIDEO_STORYBOARD_LEASE_MS);
  const selectedProjectId = projectId ?? null;
  const rows = await db.execute(sql`
    SELECT id, teacher_id, storyboard_idempotency_key, storyboard_lease_id
      FROM ai_video_projects
     WHERE status = 'draft'
       AND (${selectedProjectId}::int IS NULL OR id = ${selectedProjectId})
       AND (
         storyboard_lease_expires_at <= NOW()
         OR (storyboard_lease_expires_at IS NULL AND updated_at <= ${legacyStaleBefore})
       )
  `);
  let recovered = 0;
  for (const row of rows.rows as Array<{
    id: number;
    teacher_id: number;
    storyboard_idempotency_key: string;
    storyboard_lease_id: string | null;
  }>) {
    const recoveryLeaseId = randomUUID();
    const claimed = await db.execute(sql`
      UPDATE ai_video_projects
         SET storyboard_lease_id = ${recoveryLeaseId},
             storyboard_lease_expires_at = NOW() + (${AI_VIDEO_STORYBOARD_LEASE_MS} * INTERVAL '1 millisecond'),
             updated_at = NOW()
       WHERE id = ${Number(row.id)}
         AND status = 'draft'
         AND (
           (
             storyboard_lease_id = ${row.storyboard_lease_id}
             AND storyboard_lease_expires_at <= NOW()
           )
           OR (
             storyboard_lease_id IS NULL
             AND ${row.storyboard_lease_id} IS NULL
             AND updated_at <= ${legacyStaleBefore}
           )
         )
       RETURNING id
    `);
    if (claimed.rows.length === 0) continue;

    let creditReconciled = true;
    try {
      const requestId = aiVideoStoryboardCreditRequestId(
        Number(row.teacher_id),
        row.storyboard_idempotency_key,
      );
      const holdStatus = await CreditService.getHoldStatus(requestId);
      if (holdStatus === "completed") {
        await CreditService.compensateCapturedHold(
          requestId,
          "AI video storyboard result was not committed before its worker lease expired",
        );
      } else if (holdStatus === "pending") {
        await CreditService.refund(
          requestId,
          "AI video storyboard generation stopped before completion",
        );
      }
    } catch (err) {
      creditReconciled = false;
      logger.error({ err, projectId: row.id }, "Interrupted AI video storyboard credit refund failed");
    }
    if (!creditReconciled) continue;

    const updated = await db.update(aiVideoProjectsTable).set({
      status: "failed",
      errorMessage: "Storyboard generation stopped before completion. Create a new attempt.",
      storyboardLeaseId: null,
      storyboardLeaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(aiVideoProjectsTable.id, Number(row.id)),
      eq(aiVideoProjectsTable.status, "draft"),
      eq(aiVideoProjectsTable.storyboardLeaseId, recoveryLeaseId),
    )).returning({ id: aiVideoProjectsTable.id });
    recovered += updated.length;
  }
  return recovered;
}

export async function failStaleAiVideoRenders(): Promise<number> {
  const legacyStaleBefore = new Date(Date.now() - AI_VIDEO_RENDER_LEASE_MS);
  const rows = await db.execute(sql`
    SELECT id, teacher_id, render_idempotency_key, render_lease_id
      FROM ai_video_projects
     WHERE status = 'rendering'
       AND (
         render_lease_expires_at <= NOW()
         OR (render_lease_expires_at IS NULL AND updated_at <= ${legacyStaleBefore})
       )
  `);
  let recovered = 0;
  for (const row of rows.rows as Array<{
    id: number;
    teacher_id: number;
    render_idempotency_key: string | null;
    render_lease_id: string | null;
  }>) {
    const recoveryLeaseId = randomUUID();
    const claimed = await db.execute(sql`
      UPDATE ai_video_projects
         SET render_lease_id = ${recoveryLeaseId},
             render_lease_expires_at = NOW() + (${AI_VIDEO_RENDER_LEASE_MS} * INTERVAL '1 millisecond'),
             updated_at = NOW()
       WHERE id = ${Number(row.id)}
         AND status = 'rendering'
         AND (
           (render_lease_id = ${row.render_lease_id} AND render_lease_expires_at <= NOW())
           OR (
             render_lease_id IS NULL
             AND ${row.render_lease_id} IS NULL
             AND updated_at <= ${legacyStaleBefore}
           )
         )
       RETURNING id
    `);
    if (claimed.rows.length === 0) continue;

    let creditReconciled = true;
    if (row.render_idempotency_key) {
      try {
        const requestId = aiVideoRenderCreditRequestId(
          Number(row.teacher_id),
          Number(row.id),
          row.render_idempotency_key,
        );
        const holdStatus = await CreditService.getHoldStatus(requestId);
        if (holdStatus === "completed") {
          await CreditService.compensateCapturedHold(
            requestId,
            "AI video render result was not committed before server restart",
          );
        } else {
          await CreditService.refund(requestId, "AI video render interrupted by server restart");
        }
      } catch (err) {
        creditReconciled = false;
        logger.error({ err, projectId: row.id }, "Interrupted AI video render credit refund failed");
      }
    }
    if (!creditReconciled) continue;
    const updated = await db.update(aiVideoProjectsTable).set({
      status: "failed",
      errorMessage: "Rendering stopped after its worker lease expired. Retry the render.",
      renderLeaseId: null,
      renderLeaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(aiVideoProjectsTable.id, Number(row.id)),
      eq(aiVideoProjectsTable.status, "rendering"),
      eq(aiVideoProjectsTable.renderLeaseId, recoveryLeaseId),
    )).returning({ id: aiVideoProjectsTable.id });
    recovered += updated.length;
  }
  return recovered;
}