import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const state = vi.hoisted(() => ({ scene: 0, preflightVerified: false, failSpeech: false }));
vi.mock("../lib/ai-video-motion", () => ({
  generateAiVideoMotion: vi.fn(async ({ outputPath, durationSeconds }: { outputPath: string; durationSeconds: number }) => {
    const { promisify } = await import("node:util");
    const { execFile } = await import("node:child_process");
    const { dirname, join } = await import("node:path");
    const { stat } = await import("node:fs/promises");
    if (state.scene === 0) {
      const expected = [5.15, 4.95, 4.95, 4.95, 4.4];
      for (let index = 0; index < 5; index += 1) {
        const audioPath = join(dirname(outputPath), `audio-${index}.wav`);
        if ((await stat(audioPath)).size <= 44) throw new Error(`Missing bounded narration WAV ${index}`);
        const { stdout } = await promisify(execFile)("ffprobe", [
          "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", audioPath,
        ]);
        if (Math.abs(Number(stdout.trim()) - expected[index]!) > 0.03) {
          throw new Error(`Narration WAV ${index} was not fitted before motion generation`);
        }
      }
      state.preflightVerified = true;
    }
    await promisify(execFile)("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
      "-i", `testsrc2=size=640x360:rate=25, hue=h=${state.scene++ * 60}`,
      "-t", String(durationSeconds), "-c:v", "libx264", "-threads", "1", "-preset", "ultrafast", outputPath,
    ]);
    return { requestId: "local-fixture", model: "local-test", generatedDurationSeconds: durationSeconds };
  }),
}));
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: {} }));
vi.mock("@workspace/integrations-openai-ai-server/audio", () => ({
  textToSpeech: vi.fn(async (text: string) => {
    if (state.failSpeech) throw new Error("fatal local speech fixture failure");
    const index = Number(text.match(/(\d+)$/)?.[1] ?? 1) - 1;
    const duration = [5.15, 4.95, 4.95, 4.95, 4.4][index]!;
    const sampleRate = 8_000;
    const samples = Math.round(duration * sampleRate);
    const wav = Buffer.alloc(44 + samples * 2);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(samples * 2, 40);
    for (let sample = 0; sample < samples; sample += 1) {
      wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * sample / sampleRate) * 5_000), 44 + sample * 2);
    }
    return wav;
  }),
}));
import { composeAiVideo, probeVideo, verifyMotionClip } from "../lib/ai-video-composition";
import type { AiVideoBrief, AiVideoStoryboard } from "../lib/ai-video-schemas";
import { buildAiVideoTransitionFilter } from "../lib/ai-video-composition";
import { generateAiVideoMotion } from "../lib/ai-video-motion";

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
  beforeEach(() => {
    state.scene = 0;
    state.preflightVerified = false;
    state.failSpeech = false;
    vi.mocked(generateAiVideoMotion).mockClear();
  });
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
  it("does not start any motion fixture when narration preflight fails", async () => {
    const brief: AiVideoBrief = {
      title: "اختبار فشل محلي", topic: "حاجز الصوت", prompt: "", language: "ar",
      sourceImages: [], durationSeconds: 30, aspectRatio: "16:9", visualStyle: "educational",
      voice: "nova", music: false, captions: false, idempotencyKey: "local-preflight-failure",
    };
    const storyboard: AiVideoStoryboard = {
      title: brief.title,
      version: 1,
      scenes: Array.from({ length: 5 }, (_, index) => ({
        id: `scene-${index + 1}`,
        objective: `هدف ${index + 1}`,
        narration: `نص قصير ${index + 1}`,
        onScreenText: "",
        visualPrompt: `مشهد محلي ${index + 1}`,
        durationSeconds: 6,
        transition: "dissolve" as const,
        sourceImage: null,
      })),
    };
    state.failSpeech = true;
    await expect(composeAiVideo({
      brief, storyboard, dir, voice: "nova", deadline: Date.now() + 300_000,
      assertActive: async () => {}, persistStoryboard: vi.fn(),
    })).rejects.toThrow("fatal local speech fixture failure");
    expect(generateAiVideoMotion).not.toHaveBeenCalled();
    expect(state.scene).toBe(0);
  });
  it("assembles 30 seconds, five moving scenes, shaped Arabic terms and a silent tail", async () => {
    const brief: AiVideoBrief = {
      title: "اختبار تقني محلي", topic: "تركيب مشاهد اختبار", prompt: "", language: "ar",
      sourceImages: [], durationSeconds: 30, aspectRatio: "16:9", visualStyle: "educational",
      voice: "nova", music: false, captions: true, idempotencyKey: "local-media-check",
    };
    const storyboard: AiVideoStoryboard = {
      title: brief.title, version: 1,
      scenes: ["التبخر", "صعود البخار", "التكاثف", "الهطول", "تجمع المياه"].map((term, i) => ({
        id: `scene-${i + 1}`, objective: term, narration: `نص اختبار صوتي ${i + 1}`, onScreenText: term,
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
    expect(state.preflightVerified).toBe(true);
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