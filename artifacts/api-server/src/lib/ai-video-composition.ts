import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { generateAiVideoMotion } from "./ai-video-motion";
import {
  hashAiVideoStoryboard,
  type AiVideoMotionJournalFactory,
} from "./ai-video-request-journal";
import { renderAiVideoTerm } from "./ai-video-typography";
import { VIDEO_TRANSITION_SECONDS, type VideoVoice } from "./ai-video-timing";
import {
  requireRenderableDialogueStoryboard,
  sanitizeStoryboard,
  type AiVideoBrief,
  type AiVideoDialogueStoryboard,
  type AiVideoStoryboard,
} from "./ai-video-schemas";

const execFileAsync = promisify(execFile);
type Transition = "cut" | "dissolve" | "push" | "zoom";
export function transitionSeconds(transition: Transition) {
  return transition === "cut" ? 0 : VIDEO_TRANSITION_SECONDS;
}
export function videoDimensions(ratio: string) {
  return ratio === "9:16" ? { width: 1080, height: 1920 }
    : ratio === "1:1" ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 };
}

/** A paid provider result is structurally unusable, rather than locally unprobeable. */
export class AiVideoMediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiVideoMediaValidationError";
  }
}

/**
 * Video has an outgoing overlap handle. Audio has EXACTLY each scene's base
 * duration and is concatenated, not cross-faded. New speech starts after the
 * visual dissolve, so voices never overlap and no word is faded away.
 */
export function buildAiVideoTransitionFilter(
  scenes: Array<{ durationSeconds: number; transition: Transition }>,
): { filter: string; videoLabel: string; audioLabel: string } {
  if (scenes.length < 2) throw new Error("At least two scenes are required");
  const filters: string[] = [];
  for (const [i, scene] of scenes.entries()) {
    filters.push(`[${i}:v]fps=25,settb=AVTB,setpts=PTS-STARTPTS[vbase${i}]`);
    filters.push(`[${i}:a]aresample=44100,atrim=duration=${scene.durationSeconds},asetpts=PTS-STARTPTS[abase${i}]`);
  }
  let videoLabel = "[vbase0]";
  let audioLabel = "[abase0]";
  let elapsed = 0;
  for (let i = 0; i < scenes.length - 1; i += 1) {
    const scene = scenes[i]!;
    elapsed += scene.durationSeconds;
    const nextVideo = `[v${i + 1}]`;
    const nextAudio = `[a${i + 1}]`;
    const transition = { dissolve: "fade", push: "slideleft", zoom: "zoomin", cut: "" }[scene.transition];
    filters.push(scene.transition === "cut"
      ? `${videoLabel}[vbase${i + 1}]concat=n=2:v=1:a=0${nextVideo}`
      : `${videoLabel}[vbase${i + 1}]xfade=transition=${transition}:duration=${VIDEO_TRANSITION_SECONDS.toFixed(3)}:offset=${elapsed.toFixed(3)}${nextVideo}`);
    filters.push(`${audioLabel}[abase${i + 1}]concat=n=2:v=0:a=1${nextAudio}`);
    videoLabel = nextVideo;
    audioLabel = nextAudio;
  }
  return { filter: filters.join(";"), videoLabel, audioLabel };
}

export async function probeVideo(path: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,duration,nb_frames,sample_rate,time_base:format=duration",
    "-of", "json", path,
  ], { timeout: 30_000, maxBuffer: 256 * 1024 });
  const data = JSON.parse(stdout);
  const streams = data.streams as Array<Record<string, string | number>> | undefined;
  const video = streams?.find((s) => s.codec_type === "video");
  const audio = streams?.find((s) => s.codec_type === "audio");
  const duration = Number(video?.duration ?? data.format?.duration);
  if (!video?.codec_name || Number(video.width) < 320 || Number(video.height) < 320 || !Number.isFinite(duration) || duration <= 0) {
    throw new AiVideoMediaValidationError("Generated scene has no valid video stream");
  }
  return { duration, video, audio };
}

/** Catch a provider returning a long frozen frame, never mask it by looping. */
export async function verifyMotionClip(path: string, requiredSeconds: number) {
  const media = await probeVideo(path);
  if (media.duration + 0.04 < requiredSeconds) {
    throw new AiVideoMediaValidationError("Generated scene is shorter than its required duration");
  }
  const { stderr } = await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "info", "-i", path, "-t", String(requiredSeconds),
    "-vf", "scale=160:90,freezedetect=n=-50dB:d=1", "-an", "-f", "null", "-",
  ], { timeout: 45_000, maxBuffer: 1024 * 1024 });
  const starts = Array.from(stderr.matchAll(/freeze_start:\s*([\d.]+)/g), (m) => Number(m[1]));
  const ends = Array.from(stderr.matchAll(/freeze_end:\s*([\d.]+)/g), (m) => Number(m[1]));
  const frozen = starts.reduce((sum, start, index) => sum + Math.max(0, (ends[index] ?? requiredSeconds) - start), 0);
  if (frozen >= requiredSeconds * 0.7) {
    throw new AiVideoMediaValidationError("Generated scene is mostly frozen; regenerate the scene rather than using a still-image fallback");
  }
}

export function buildNativeDialogueScenePrompt(
  brief: AiVideoBrief,
  storyboard: AiVideoDialogueStoryboard,
  sceneIndex: number,
): string {
  const scene = storyboard.scenes[sceneIndex];
  if (!scene) throw new Error(`Dialogue scene ${sceneIndex + 1} does not exist`);
  const characters = storyboard.characters.map((character) => [
    `${character.id} (${character.role}, called ${character.displayName})`,
    `FIXED APPEARANCE: ${character.appearance}`,
    `FIXED VOICE: ${character.voice}`,
  ].join("\n")).join("\n\n");
  const turns = scene.dialogue.map(
    (turn, index) => `${index + 1}. ${turn.speakerId}: "${turn.text}" Delivery: ${turn.delivery}`,
  ).join("\n");
  return [
    "Generate one continuous photorealistic live-action classroom shot with native synchronized character audio.",
    "Exact duration: 6 seconds. Native output: 1080p. Perform all dialogue naturally within the shot; never cut, omit, rewrite, or speed up speech.",
    `Lesson: ${brief.title}. Topic: ${brief.topic}. Scene objective: ${scene.objective}.`,
    "CHARACTER AND VOICE BIBLE — reproduce these exact identities unchanged:",
    characters,
    `Visible throughout the required speaking action: ${scene.visibleCharacterIds.join(", ")}.`,
    "EXACT ORDERED DIALOGUE:",
    turns,
    `Shot and physical action: ${scene.visualPrompt}`,
    "The current speaker is visibly speaking with accurate lip synchronization. Every listener stays visibly attentive with a closed mouth; switch visible lip movement exactly when the turn changes.",
    "Use the fixed distinct voice assigned to each speaker. Natural classroom room tone only. No unseen narrator, voice-over, dubbing, extra speech, music, subtitles, text, logos, or watermark.",
    "Keep faces unobstructed and identities, clothing, room layout, lighting, camera direction, voice timbre and accent continuous with every other scene.",
  ].join("\n");
}

export async function verifyNativeDialogueClip(
  path: string,
  expected: { durationSeconds: number; width: number; height: number },
) {
  const media = await probeVideo(path);
  const audioDuration = Number(media.audio?.duration);
  const sampleRate = Number(media.audio?.sample_rate);
  if (!media.audio?.codec_name || !Number.isFinite(audioDuration) || audioDuration <= 0
    || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new AiVideoMediaValidationError("Native dialogue scene has no valid audio stream; silent motion plus TTS is not allowed");
  }
  // Audio must declare the exact six-second presentation endpoint. The wider
  // video tolerance cannot be applied to speech: otherwise a real 6.08-second
  // utterance could pass here and be cut later as though it were codec padding.
  if (Math.abs(media.duration - expected.durationSeconds) > 0.12
    || Math.abs(audioDuration - expected.durationSeconds) > (1 / sampleRate)) {
    throw new AiVideoMediaValidationError("Native dialogue scene failed exact audio/video duration validation; speech will not be cut or sped up");
  }
  if (Number(media.video.width) < expected.width || Number(media.video.height) < expected.height) {
    throw new AiVideoMediaValidationError("Native dialogue scene is below the required 1080p dimensions");
  }
  await verifyMotionClip(path, expected.durationSeconds);
  return media;
}

export type CompositionOptions = {
  brief: AiVideoBrief;
  storyboard: AiVideoStoryboard;
  dir: string;
  deadline: number;
  /** Kept temporarily so legacy workers can compile; native dialogue ignores TTS voices. */
  voice?: VideoVoice;
  assertActive: () => Promise<void>;
  persistStoryboard: (storyboard: AiVideoStoryboard) => Promise<void>;
  requestJournal?: AiVideoMotionJournalFactory;
};

export async function composeAiVideo(options: CompositionOptions): Promise<string> {
  const { brief, dir, assertActive } = options;
  // Recompute the timeline for old drafts and never trust timestamps from clients.
  const sanitized = sanitizeStoryboard(options.storyboard, brief);
  const storyboard = requireRenderableDialogueStoryboard(sanitized, brief);
  if (!options.requestJournal) {
    throw new Error("Native dialogue rendering requires durable provider request journaling before paid generation");
  }
  if (sanitized.scenes.some((scene) => scene.sourceImage)) {
    throw new Error("هذه المرحلة تنتج الحركة من النص فقط. أنشئ مخططاً نصياً دون صور مرجعية. / Create a text-only storyboard for generated motion.");
  }
  const timeout = (cap: number) => {
    const remaining = options.deadline - Date.now();
    if (remaining < 1000) throw new Error("AI video render exceeded its deadline");
    return Math.min(cap, remaining);
  };
  const { width, height } = videoDimensions(brief.aspectRatio);
  for (const [index, scene] of storyboard.scenes.entries()) {
    // Verify font availability and render all labels before any paid request.
    if (brief.captions && scene.onScreenText.trim()) {
      await renderAiVideoTerm({
        text: scene.onScreenText, language: brief.language, width, height,
        outputPath: join(dir, `term-${index}.png`),
      });
    }
  }
  await assertActive();
  await options.persistStoryboard(storyboard);
  const storyboardHash = hashAiVideoStoryboard(storyboard);
  const segments: string[] = [];
  for (const [index, scene] of storyboard.scenes.entries()) {
    await assertActive();
    const movementPath = join(dir, `motion-${index}.mp4`);
    const termPath = join(dir, `term-${index}.png`);
    // Keep decoded native speech lossless between scene processing and the
    // final join. Encoding AAC per scene adds encoder delay to every segment;
    // concatenating those delayed streams can push a 60/90 second production
    // outside its duration contract. AAC is encoded exactly once below.
    const segmentPath = join(dir, `segment-${index}.mkv`);
    const renderDuration = 6;
    const sceneJournal = options.requestJournal(index, storyboardHash);
    await generateAiVideoMotion({
      prompt: buildNativeDialogueScenePrompt(brief, storyboard, index),
      aspectRatio: brief.aspectRatio,
      durationSeconds: renderDuration,
      requestJournal: sceneJournal,
      outputPath: movementPath, timeoutMs: timeout(12 * 60_000), assertActive,
    });
    try {
      await verifyNativeDialogueClip(movementPath, { durationSeconds: 6, width, height });
    } catch (err) {
      // ffprobe/ffmpeg execution failures remain retryable infrastructure
      // errors. Only deterministic media-content rejection poisons a paid
      // provider result so it cannot authorize another hold on retry.
      if (err instanceof AiVideoMediaValidationError) {
        await sceneJournal.recordUnusableResult?.(err.message);
      }
      throw err;
    }
    const showTerm = brief.captions && Boolean(scene.onScreenText.trim());
    const filters = [
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=25,setsar=1,setpts=PTS-STARTPTS,format=yuv420p[visual]`,
      // The provider stream is contractually six seconds. AAC decoders may
      // expose encoder tail padding after that declared endpoint; discard only
      // that codec padding before storing lossless PCM, never speech samples.
      `[0:a]aresample=44100,atrim=duration=${renderDuration},asetpts=PTS-STARTPTS[speech]`,
    ];
    if (showTerm) {
      filters.push("[1:v]format=rgba,fade=t=in:st=0.25:d=0.15:alpha=1,fade=t=out:st=5.60:d=0.15:alpha=1[term]");
      filters.push("[visual][term]overlay=0:0:format=auto:shortest=1,format=yuv420p[v]");
    }
    await assertActive();
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
      "-i", movementPath,
      ...(showTerm ? ["-loop", "1", "-framerate", "25", "-i", termPath] : []),
      "-filter_complex", filters.join(";"), "-map", showTerm ? "[v]" : "[visual]", "-map", "[speech]",
      "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "21",
      "-c:a", "pcm_s16le", "-ar", "44100", segmentPath,
    ], { timeout: timeout(180_000), maxBuffer: 1024 * 1024 });
    segments.push(segmentPath);
  }
  if (segments.length !== storyboard.scenes.length) throw new Error("One or more scenes are missing");
  const joinedPath = join(dir, "joined.mp4");
  const concatInputs = segments.map((_, index) => `[${index}:v][${index}:a]`).join("");
  await assertActive();
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
    ...segments.flatMap((path) => ["-i", path]),
    "-filter_complex", `${concatInputs}concat=n=${segments.length}:v=1:a=1[v][a]`, "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "21",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", joinedPath,
  ], { timeout: timeout(300_000), maxBuffer: 1024 * 1024 });
  const finalPath = joinedPath;
  const final = await probeVideo(finalPath);
  const audioDuration = Number(final.audio?.duration ?? final.duration);
  if (Math.abs(final.duration - brief.durationSeconds) > 0.12 || !final.audio || !Number.isFinite(audioDuration)
    || Math.abs(audioDuration - brief.durationSeconds) > 0.12
    || Number(final.video.width) !== width || Number(final.video.height) !== height) {
    throw new Error("Final video failed duration, audio, or dimensions validation");
  }
  await assertActive();
  return finalPath;
}