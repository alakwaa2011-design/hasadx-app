import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService } from "./objectStorage";
import {
  buildAiVideoTransitionFilter,
  probeVideo,
  transitionSeconds,
  videoDimensions,
} from "./ai-video-composition";
import { prepareAiVideoNarration } from "./ai-video-narration-preflight";
import { renderAiVideoTerm } from "./ai-video-typography";
import {
  sanitizeStoryboard,
  type AiVideoBrief,
  type AiVideoStoryboard,
} from "./ai-video-schemas";
import type { VideoVoice } from "./ai-video-timing";

const execFileAsync = promisify(execFile);
const storage = new ObjectStorageService();

type Options = {
  brief: AiVideoBrief;
  storyboard: AiVideoStoryboard;
  dir: string;
  deadline: number;
  voice: VideoVoice;
  assertActive: () => Promise<void>;
  persistStoryboard: (storyboard: AiVideoStoryboard) => Promise<void>;
};

function imageSize(aspectRatio: AiVideoBrief["aspectRatio"]): "1536x1024" | "1024x1536" | "1024x1024" {
  if (aspectRatio === "9:16") return "1024x1536";
  if (aspectRatio === "1:1") return "1024x1024";
  return "1536x1024";
}

function visualCount(duration: AiVideoBrief["durationSeconds"]): number {
  return duration === 30 ? 4 : duration === 60 ? 6 : 8;
}

function economyImagePrompt(brief: AiVideoBrief, scene: AiVideoStoryboard["scenes"][number]): string {
  return [
    "Create one polished educational illustration used as a scene in a teacher's narrated lesson video.",
    `Lesson: ${brief.title}. Topic: ${brief.topic}.`,
    `Scene objective: ${scene.objective}. Visual content: ${scene.visualPrompt}.`,
    `Visual direction: ${brief.visualStyle}; warm, clear, age-appropriate, focused composition with useful depth for a subtle camera move.`,
    "No text, letters, numbers, labels, logos, watermarks, UI, borders, speech bubbles, or decorative title cards.",
    "Do not depict religious figures. Use objects, places, diagrams without labels, and respectful everyday educational scenes.",
    "Keep the main subject away from the bottom 24% because a short caption may be added there.",
  ].join("\n");
}

async function sourceImage(path: string, outputPath: string): Promise<void> {
  const file = await storage.getObjectEntityFile(path);
  const [bytes] = await file.download();
  if (!bytes.length) throw new Error("Source image was empty");
  await writeFile(outputPath, bytes, { flag: "wx", mode: 0o600 });
}

async function generatedImage(
  brief: AiVideoBrief,
  scene: AiVideoStoryboard["scenes"][number],
  outputPath: string,
): Promise<void> {
  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt: economyImagePrompt(brief, scene),
    n: 1,
    size: imageSize(brief.aspectRatio),
    quality: "low",
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("Educational image provider returned no image");
  const bytes = Buffer.from(b64, "base64");
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
    throw new Error("Educational image provider returned an invalid image");
  }
  await writeFile(outputPath, bytes, { flag: "wx", mode: 0o600 });
}

export async function composeEconomyAiVideo(options: Options): Promise<string> {
  const { brief, dir, assertActive } = options;
  if (brief.mode !== "narrated_images") throw new Error("Economy renderer requires narrated-images mode");
  const storyboard = sanitizeStoryboard(options.storyboard, brief);
  const timeout = (cap: number) => {
    const remaining = options.deadline - Date.now();
    if (remaining < 1_000) throw new Error("AI video render exceeded its deadline");
    return Math.min(cap, remaining);
  };
  const { width, height } = videoDimensions(brief.aspectRatio);
  const narration = await prepareAiVideoNarration({ ...options, storyboard });
  await options.persistStoryboard(narration.storyboard);

  const maxVisuals = visualCount(brief.durationSeconds);
  const visualPaths = new Map<number, string>();
  for (const [index, scene] of narration.storyboard.scenes.entries()) {
    const visualIndex = Math.min(
      maxVisuals - 1,
      Math.floor(index * maxVisuals / narration.storyboard.scenes.length),
    );
    if (visualPaths.has(visualIndex)) continue;
    await assertActive();
    const path = join(dir, `economy-visual-${visualIndex}.png`);
    if (scene.sourceImage) await sourceImage(scene.sourceImage, path);
    else await generatedImage(brief, scene, path);
    visualPaths.set(visualIndex, path);
  }

  const segments: string[] = [];
  for (const [index, scene] of narration.storyboard.scenes.entries()) {
    await assertActive();
    const visualIndex = Math.min(
      maxVisuals - 1,
      Math.floor(index * maxVisuals / narration.storyboard.scenes.length),
    );
    const imagePath = visualPaths.get(visualIndex);
    if (!imagePath) throw new Error("Economy scene image is missing");
    const audioPath = join(dir, `audio-${index}.wav`);
    const termPath = join(dir, `term-${index}.png`);
    const segmentPath = join(dir, `segment-${index}.mp4`);
    const renderDuration = scene.durationSeconds
      + (index < narration.storyboard.scenes.length - 1 ? transitionSeconds(scene.transition) : 0);
    const showTerm = brief.captions && Boolean(scene.onScreenText.trim());
    if (showTerm) {
      await renderAiVideoTerm({
        text: scene.onScreenText,
        language: brief.language,
        width,
        height,
        outputPath: termPath,
      });
    }
    const { lead, speech } = narration.timing[index]!;
    const filters = [
      `[0:v]scale=${Math.ceil(width * 1.12)}:${Math.ceil(height * 1.12)}:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='min(max(zoom,pzoom)+0.0007,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=25,trim=duration=${renderDuration},setpts=PTS-STARTPTS,format=yuv420p[visual]`,
      `[1:a]aresample=44100,asetpts=PTS-STARTPTS,adelay=${Math.round(lead * 1000)}:all=1,apad,atrim=duration=${scene.durationSeconds}[speech]`,
    ];
    if (showTerm) {
      filters.push(`[2:v]format=rgba,fade=t=in:st=${lead}:d=0.18:alpha=1,fade=t=out:st=${Math.max(lead, lead + speech - 0.2).toFixed(3)}:d=0.18:alpha=1[term]`);
      filters.push("[visual][term]overlay=0:0:format=auto,format=yuv420p[v]");
    }
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-loop", "1", "-framerate", "25", "-i", imagePath,
      "-i", audioPath,
      ...(showTerm ? ["-loop", "1", "-framerate", "25", "-i", termPath] : []),
      "-filter_complex", filters.join(";"),
      "-map", showTerm ? "[v]" : "[visual]",
      "-map", "[speech]",
      "-t", renderDuration.toFixed(3),
      "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "21",
      "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart",
      segmentPath,
    ], { timeout: timeout(180_000), maxBuffer: 1024 * 1024 });
    segments.push(segmentPath);
  }

  const transition = buildAiVideoTransitionFilter(narration.storyboard.scenes);
  const joinedPath = join(dir, "economy-joined.mp4");
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
    ...segments.flatMap((path) => ["-i", path]),
    "-filter_complex", transition.filter,
    "-map", transition.videoLabel,
    "-map", transition.audioLabel,
    "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "21",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart",
    joinedPath,
  ], { timeout: timeout(300_000), maxBuffer: 1024 * 1024 });

  let finalPath = joinedPath;
  if (brief.music) {
    finalPath = join(dir, "economy-final.mp4");
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", joinedPath,
      "-f", "lavfi", "-i", `aevalsrc=0.018*(sin(2*PI*220*t)+sin(2*PI*277.18*t)+sin(2*PI*329.63*t)):s=44100:d=${brief.durationSeconds}`,
      "-filter_complex", `[1:a]afade=t=in:d=1.2,afade=t=out:st=${brief.durationSeconds - 1.2}:d=1.2[music];[0:a][music]amix=inputs=2:duration=first:weights='1 0.13':normalize=0[a]`,
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
      "-movflags", "+faststart", finalPath,
    ], { timeout: timeout(120_000), maxBuffer: 1024 * 1024 });
  }
  const final = await probeVideo(finalPath);
  if (!final.audio || Math.abs(final.duration - brief.durationSeconds) > 0.12
    || Number(final.video.width) !== width || Number(final.video.height) !== height) {
    throw new Error("Economy video failed duration, audio, or dimensions validation");
  }
  await assertActive();
  return finalPath;
}