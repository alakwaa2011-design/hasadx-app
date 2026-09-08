import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const state = vi.hoisted(() => ({ scene: 0 }));
vi.mock("../lib/ai-video-motion", () => ({
  generateAiVideoMotion: vi.fn(async ({ outputPath, durationSeconds }: { outputPath: string; durationSeconds: number }) => {
    const { promisify } = await import("node:util");
    const { execFile } = await import("node:child_process");
    await promisify(execFile)("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
      "-i", `testsrc2=size=640x360:rate=25, hue=h=${state.scene++ * 60}`,
      "-t", String(durationSeconds), "-c:v", "libx264", "-threads", "1", "-preset", "ultrafast", outputPath,
    ]);
    return { requestId: "local-fixture", model: "local-test", generatedDurationSeconds: durationSeconds };
  }),
}));
vi.mock("../lib/ai-video-timing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ai-video-timing")>();
  return {
    ...actual,
    fitAiVideoNarration: vi.fn(async (options: { outputPath: string; narration: string; budgetSeconds: number }) => {
      const { promisify } = await import("node:util");
      const { execFile } = await import("node:child_process");
      const durationSeconds = options.budgetSeconds - 0.1;
      await promisify(execFile)("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
        "-i", `sine=frequency=440:sample_rate=44100:duration=${durationSeconds}`,
        options.outputPath,
      ]);
      return { narration: options.narration, durationSeconds, attempts: 1 };
    }),
  };
});
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: {} }));
vi.mock("@workspace/integrations-openai-ai-server/audio", () => ({ textToSpeech: vi.fn() }));
import { composeAiVideo, probeVideo, verifyMotionClip } from "../lib/ai-video-composition";
import type { AiVideoBrief, AiVideoStoryboard } from "../lib/ai-video-schemas";
import { buildAiVideoTransitionFilter } from "../lib/ai-video-composition";

describe("Scene transition contract", () => {
  it("crossfades only visuals, never complete speech or scene audio", () => {
    const result = buildAiVideoTransitionFilter([
      { durationSeconds: 6, transition: "dissolve" },
      { durationSeconds: 6, transition: "cut" },
    ]);
    expect(result.filter).toContain("duration=0.400:offset=6.000");
    expect(result.filter).toContain("concat=n=2:v=0:a=1");
    expect(result.filter).not.toContain("acrossfade");
  });
});

// Explicit opt-in: real local ffmpeg and Chromium, no database/AI/provider calls.
describe.runIf(process.env.RUN_AI_VIDEO_MEDIA_TESTS === "1")("Real educational video composition", () => {
  let dir: string;
  beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), "ai-video-media-check-")); });
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
  it("assembles 30 seconds, five moving scenes, shaped Arabic terms and a silent tail", async () => {
    const brief: AiVideoBrief = {
      title: "اختبار تقني محلي", topic: "تركيب مشاهد اختبار", prompt: "", language: "ar",
      sourceImages: [], durationSeconds: 30, aspectRatio: "16:9", visualStyle: "educational",
      voice: "nova", music: false, captions: true, idempotencyKey: "local-media-check",
    };
    const storyboard: AiVideoStoryboard = {
      title: brief.title, version: 1,
      scenes: ["التبخر", "صعود البخار", "التكاثف", "الهطول", "تجمع المياه"].map((term, i) => ({
        id: `scene-${i + 1}`, objective: term, narration: "نص اختبار صوتي", onScreenText: term,
        visualPrompt: "Local moving test pattern, not educational content.",
        durationSeconds: 6, transition: "dissolve", sourceImage: null,
      })),
    };
    const persist = vi.fn(async (_storyboard: AiVideoStoryboard) => {});
    const path = await composeAiVideo({
      brief, storyboard, dir, voice: "nova", deadline: Date.now() + 300_000,
      assertActive: async () => {}, persistStoryboard: persist,
    });
    const result = await probeVideo(path);
    expect(result.duration).toBeCloseTo(30, 1);
    expect(result.audio?.codec_type).toBe("audio");
    expect(state.scene).toBe(5);
    const saved = persist.mock.calls[0]![0];
    expect(saved.scenes[4]!.narrationEndTime).toBeLessThanOrEqual(29.1);
    expect(saved.scenes[1]!.narrationStartTime).toBe(6.5);
    const { stderr } = await exec("ffmpeg", [
      "-hide_banner", "-ss", "29.3", "-i", path, "-vn", "-af", "volumedetect", "-f", "null", "-",
    ]);
    const peak = Number(stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]);
    expect(peak).toBeLessThan(-60);
    // Keep only a technical frame for manual local inspection, not a claimed AI-generated sample.
    await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", "14", "-i", path, "-frames:v", "1", "/tmp/ai-video-composition-check.png"]);
  }, 300_000);
  it("rejects short clips and a frozen-video substitute", async () => {
    const path = join(dir, "frozen.mp4");
    await exec("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=blue:size=640x360:rate=25",
      "-t", "3", "-c:v", "libx264", "-threads", "1", "-preset", "ultrafast", path,
    ]);
    await expect(verifyMotionClip(path, 5)).rejects.toThrow("shorter");
    await expect(verifyMotionClip(path, 3)).rejects.toThrow("mostly frozen");
  }, 60_000);
});