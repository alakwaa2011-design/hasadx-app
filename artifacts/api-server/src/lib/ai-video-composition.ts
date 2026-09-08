import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { generateAiVideoMotion } from "./ai-video-motion";
import { renderAiVideoTerm } from "./ai-video-typography";
import { fitAiVideoNarration, narrationWindow, VIDEO_TRANSITION_SECONDS, type VideoVoice } from "./ai-video-timing";
import { sanitizeStoryboard, type AiVideoBrief, type AiVideoStoryboard } from "./ai-video-schemas";

const execFileAsync = promisify(execFile);
type Transition = "cut" | "dissolve" | "push" | "zoom";
export function transitionSeconds(transition: Transition) {
  return transition === "cut" ? 0 : VIDEO_TRANSITION_SECONDS;
}
export function videoDimensions(ratio: string) {
  return ratio === "9:16" ? { width: 720, height: 1280 }
    : ratio === "1:1" ? { width: 720, height: 720 } : { width: 1280, height: 720 };
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
    "-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,duration,nb_frames:format=duration",
    "-of", "json", path,
  ], { timeout: 30_000, maxBuffer: 256 * 1024 });
  const data = JSON.parse(stdout);
  const streams = data.streams as Array<Record<string, string | number>> | undefined;
  const video = streams?.find((s) => s.codec_type === "video");
  const audio = streams?.find((s) => s.codec_type === "audio");
  const duration = Number(video?.duration ?? data.format?.duration);
  if (!video?.codec_name || Number(video.width) < 320 || Number(video.height) < 320 || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("Generated scene has no valid video stream");
  }
  return { duration, video, audio };
}

/** Catch a provider returning a long frozen frame, never mask it by looping. */
export async function verifyMotionClip(path: string, requiredSeconds: number) {
  const media = await probeVideo(path);
  if (media.duration + 0.04 < requiredSeconds) throw new Error("Generated scene is shorter than its required duration");
  const { stderr } = await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "info", "-i", path, "-t", String(requiredSeconds),
    "-vf", "scale=160:90,freezedetect=n=-50dB:d=1", "-an", "-f", "null", "-",
  ], { timeout: 45_000, maxBuffer: 1024 * 1024 });
  const starts = Array.from(stderr.matchAll(/freeze_start:\s*([\d.]+)/g), (m) => Number(m[1]));
  const ends = Array.from(stderr.matchAll(/freeze_end:\s*([\d.]+)/g), (m) => Number(m[1]));
  const frozen = starts.reduce((sum, start, index) => sum + Math.max(0, (ends[index] ?? requiredSeconds) - start), 0);
  if (frozen >= requiredSeconds * 0.7) throw new Error("Generated scene is mostly frozen; regenerate the scene rather than using a still-image fallback");
}

type CompositionOptions = {
  brief: AiVideoBrief;
  storyboard: AiVideoStoryboard;
  dir: string;
  deadline: number;
  voice: VideoVoice;
  assertActive: () => Promise<void>;
  persistStoryboard: (storyboard: AiVideoStoryboard) => Promise<void>;
};

export async function composeAiVideo(options: CompositionOptions): Promise<string> {
  const { brief, dir, assertActive } = options;
  // Recompute the timeline for old drafts and never trust timestamps from clients.
  const storyboard = sanitizeStoryboard(options.storyboard, brief);
  if (storyboard.scenes.some((scene) => scene.sourceImage)) {
    throw new Error("هذه المرحلة تنتج الحركة من النص فقط. أنشئ مخططاً نصياً دون صور مرجعية. / Create a text-only storyboard for generated motion.");
  }
  const timeout = (cap: number) => {
    const remaining = options.deadline - Date.now();
    if (remaining < 1000) throw new Error("AI video render exceeded its deadline");
    return Math.min(cap, remaining);
  };
  const { width, height } = videoDimensions(brief.aspectRatio);
  const timing: Array<{ lead: number; speech: number }> = [];
  let elapsed = 0;
  // Fit ALL speech before incurring the more expensive video generation calls.
  for (const [index, scene] of storyboard.scenes.entries()) {
    const window = narrationWindow(scene.durationSeconds, index, storyboard.scenes.length);
    const fitted = await fitAiVideoNarration({
      narration: scene.narration, objective: scene.objective, language: brief.language,
      budgetSeconds: window.budget, voice: options.voice,
      outputPath: join(dir, `audio-${index}.wav`), timeoutMs: timeout(330_000), assertActive,
    });
    scene.narration = fitted.narration;
    scene.narrationStartTime = Number((elapsed + window.lead).toFixed(3));
    scene.narrationEndTime = Number((elapsed + window.lead + fitted.durationSeconds).toFixed(3));
    scene.audioDurationSeconds = fitted.durationSeconds;
    timing.push({ lead: window.lead, speech: fitted.durationSeconds });
    // Verify font availability and render all labels before paid motion requests.
    if (brief.captions && scene.onScreenText.trim()) {
      await renderAiVideoTerm({
        text: scene.onScreenText, language: brief.language, width, height,
        outputPath: join(dir, `term-${index}.png`),
      });
    }
    elapsed += scene.durationSeconds;
  }
  await assertActive();
  await options.persistStoryboard(storyboard);
  const segments: string[] = [];
  for (const [index, scene] of storyboard.scenes.entries()) {
    await assertActive();
    const movementPath = join(dir, `motion-${index}.mp4`);
    const termPath = join(dir, `term-${index}.png`);
    const audioPath = join(dir, `audio-${index}.wav`);
    const segmentPath = join(dir, `segment-${index}.mp4`);
    const renderDuration = scene.durationSeconds
      + (index < storyboard.scenes.length - 1 ? transitionSeconds(scene.transition) : 0);
    if (renderDuration > 8) throw new Error("Scene is too long; regenerate a time-aware storyboard");
    await generateAiVideoMotion({
      prompt: [
        "One continuous educational shot with genuine subject motion, not a still image or a camera zoom over a picture.",
        `Subject of the whole lesson: ${brief.title}. Topic: ${brief.topic}. Visual style: ${brief.visualStyle}.`,
        `This scene's single teaching objective: ${scene.objective}.`,
        `Exact spoken explanation (do not add any voice or speech): ${scene.narration}`,
        `Visual action: ${scene.visualPrompt}`,
        "Show exactly this concept throughout the shot. Start the relevant action immediately; do not introduce unrelated stages or facts.",
        "No text, letters, captions, logos, watermark, music or audio. All typography is added separately. Keep essential action away from the bottom 22% title-safe area.",
        "Do not invent written mathematical notation or depict religious figures. Explain abstract ideas through clear objects and motion where appropriate.",
      ].join("\n"),
      aspectRatio: brief.aspectRatio, durationSeconds: renderDuration,
      outputPath: movementPath, timeoutMs: timeout(12 * 60_000), assertActive,
    });
    await verifyMotionClip(movementPath, renderDuration);
    const { lead, speech } = timing[index]!;
    // This is a hard precondition for bounded audio padding below, not a truncation policy.
    if (lead + speech > scene.durationSeconds - (index === storyboard.scenes.length - 1 ? 0.9 : 0.35) + 0.001) {
      throw new Error("Complete narration exceeds its reserved window");
    }
    const showTerm = brief.captions && Boolean(scene.onScreenText.trim());
    const filters = [
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=25,setsar=1,setpts=PTS-STARTPTS,format=yuv420p[visual]`,
      `[1:a]aresample=44100,asetpts=PTS-STARTPTS,adelay=${Math.round(lead * 1000)}:all=1,apad,atrim=duration=${scene.durationSeconds}[speech]`,
    ];
    if (showTerm) {
      filters.push(`[2:v]format=rgba,fade=t=in:st=${lead}:d=0.15:alpha=1,fade=t=out:st=${(lead + speech - 0.15).toFixed(3)}:d=0.15:alpha=1[term]`);
      filters.push("[visual][term]overlay=0:0:format=auto,format=yuv420p[v]");
    }
    await assertActive();
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
      "-i", movementPath, "-i", audioPath,
      ...(showTerm ? ["-loop", "1", "-framerate", "25", "-i", termPath] : []),
      "-filter_complex", filters.join(";"), "-map", showTerm ? "[v]" : "[visual]", "-map", "[speech]",
      "-t", renderDuration.toFixed(3), "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "21",
      "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", segmentPath,
    ], { timeout: timeout(180_000), maxBuffer: 1024 * 1024 });
    segments.push(segmentPath);
  }
  if (segments.length !== storyboard.scenes.length) throw new Error("One or more scenes are missing");
  const transition = buildAiVideoTransitionFilter(storyboard.scenes);
  const joinedPath = join(dir, "joined.mp4");
  await assertActive();
  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-filter_complex_threads", "1",
    ...segments.flatMap((path) => ["-i", path]),
    "-filter_complex", transition.filter, "-map", transition.videoLabel, "-map", transition.audioLabel,
    "-c:v", "libx264", "-threads", "2", "-preset", "veryfast", "-crf", "21",
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", joinedPath,
  ], { timeout: timeout(300_000), maxBuffer: 1024 * 1024 });
  let finalPath = joinedPath;
  if (brief.music) {
    finalPath = join(dir, "final.mp4");
    const ambient = `aevalsrc=0.02*(sin(2*PI*220*t)+sin(2*PI*277.18*t)+sin(2*PI*329.63*t)):s=44100:d=${brief.durationSeconds}`;
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-i", joinedPath, "-f", "lavfi", "-i", ambient,
      "-filter_complex", `[1:a]afade=t=in:d=1.2,afade=t=out:st=${brief.durationSeconds - 1.2}:d=1.2[music];[0:a][music]amix=inputs=2:duration=first:weights='1 0.16':normalize=0[a]`,
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", finalPath,
    ], { timeout: timeout(120_000), maxBuffer: 1024 * 1024 });
  }
  const final = await probeVideo(finalPath);
  const audioDuration = Number(final.audio?.duration);
  if (Math.abs(final.duration - brief.durationSeconds) > 0.12 || !final.audio || !Number.isFinite(audioDuration)
    || Math.abs(audioDuration - brief.durationSeconds) > 0.12
    || Number(final.video.width) !== width || Number(final.video.height) !== height) {
    throw new Error("Final video failed duration, audio, or dimensions validation");
  }
  await assertActive();
  return finalPath;
}