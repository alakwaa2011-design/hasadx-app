import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
const state = vi.hoisted(() => ({
  scene: 0,
  fixturePath: "",
}));
vi.mock("../lib/ai-video-motion", () => ({
  generateAiVideoMotion: vi.fn(async ({ outputPath, durationSeconds }: { outputPath: string; durationSeconds: number }) => {
    const { copyFile } = await import("node:fs/promises");
    state.scene += 1;
    await copyFile(state.fixturePath, outputPath);
    return { requestId: "local-fixture", model: "local-test", generatedDurationSeconds: durationSeconds };
  }),
}));
import {
  AiVideoMediaValidationError,
  composeAiVideo,
  probeVideo,
  verifyMotionClip,
  verifyNativeDialogueClip,
} from "../lib/ai-video-composition";
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
  let overrunPath: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "ai-video-media-check-"));
    state.fixturePath = join(dir, "native-six-second-fixture.mp4");
    await exec("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=25",
      "-f", "lavfi", "-i", "anoisesrc=color=pink:amplitude=0.02:sample_rate=44100",
      "-t", "6", "-c:v", "libx264", "-threads", "1", "-preset", "ultrafast",
      "-c:a", "aac", "-b:a", "160k", "-ar", "44100", state.fixturePath,
    ]);
    overrunPath = join(dir, "native-audio-overrun.mp4");
    await exec("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=25",
      "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=44100",
      "-t", "6.08", "-c:v", "libx264", "-threads", "1", "-preset", "ultrafast",
      "-c:a", "aac", "-b:a", "160k", "-ar", "44100", overrunPath,
    ]);
  });
  beforeEach(() => {
    state.scene = 0;
    vi.mocked(generateAiVideoMotion).mockClear();
  });
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
  it("does not start any motion fixture for a legacy narration-only storyboard", async () => {
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
    await expect(composeAiVideo({
      brief, storyboard, dir, voice: "nova", deadline: Date.now() + 300_000,
      assertActive: async () => {}, persistStoryboard: vi.fn(),
      requestJournal: () => ({
        prepare: async () => ({ action: "submit" as const }),
        recordRequestId: async () => {},
        recordCompleted: async () => {},
        recordFailed: async () => {},
        recordSubmissionUnknown: async () => {},
      }),
    })).rejects.toThrow(/character|dialogue/i);
    expect(generateAiVideoMotion).not.toHaveBeenCalled();
    expect(state.scene).toBe(0);
  });
  it("rejects and journals a declared native-audio overrun instead of trimming speech", async () => {
    await expect(verifyNativeDialogueClip(overrunPath, {
      durationSeconds: 6,
      width: 1920,
      height: 1080,
    })).rejects.toBeInstanceOf(AiVideoMediaValidationError);

    const brief: AiVideoBrief = {
      title: "Overrun", topic: "Audio validation", prompt: "", language: "en",
      sourceImages: [], durationSeconds: 30, aspectRatio: "16:9", visualStyle: "educational",
      voice: "nova", music: false, captions: false, idempotencyKey: "local-overrun-check",
    };
    const storyboard: AiVideoStoryboard = {
      title: brief.title,
      version: 1,
      characters: [
        {
          id: "teacher", role: "teacher", displayName: "Teacher",
          appearance: "An adult teacher in a navy jacket standing in a bright classroom.",
          voice: "A warm and measured adult voice with a calm educational delivery.",
        },
        {
          id: "student", role: "student", displayName: "Student",
          appearance: "A curious student in a green sweater holding a school notebook.",
          voice: "A bright youthful voice with an inquisitive and energetic delivery.",
        },
      ],
      scenes: Array.from({ length: 5 }, (_, index) => {
        const speakerId = index % 2 ? "student" : "teacher";
        const text = speakerId === "teacher" ? "Listen closely." : "I understand.";
        return {
          id: `scene-${index + 1}`, objective: `Objective ${index + 1}`,
          narration: text, onScreenText: "", visualPrompt: "A moving classroom shot.",
          durationSeconds: 6, transition: "cut" as const, sourceImage: null,
          visibleCharacterIds: ["teacher", "student"],
          dialogue: [{ speakerId, text, delivery: "Clear natural speech." }],
        };
      }),
    };
    const unusable = vi.fn(async (_message: string) => {});
    state.fixturePath = overrunPath;
    await expect(composeAiVideo({
      brief, storyboard, dir, deadline: Date.now() + 60_000,
      assertActive: async () => {}, persistStoryboard: async () => {},
      requestJournal: () => ({
        prepare: async () => ({ action: "submit" as const }),
        recordRequestId: async () => {},
        recordCompleted: async () => {},
        recordFailed: async () => {},
        recordUnusableResult: unusable,
        recordSubmissionUnknown: async () => {},
      }),
    })).rejects.toBeInstanceOf(AiVideoMediaValidationError);
    expect(unusable).toHaveBeenCalledOnce();
    state.fixturePath = join(dir, "native-six-second-fixture.mp4");
  });
  it("keeps 30/60/90-second native audio exact after one final AAC encode", async () => {
    for (const durationSeconds of [30, 60, 90] as const) {
      state.scene = 0;
      const sceneCount = durationSeconds / 6;
      const brief: AiVideoBrief = {
        title: "اختبار تقني محلي", topic: "تركيب مشاهد اختبار", prompt: "", language: "ar",
        sourceImages: [], durationSeconds, aspectRatio: "16:9", visualStyle: "educational",
        voice: "nova", music: false, captions: true, idempotencyKey: `local-media-check-${durationSeconds}`,
      };
      const storyboard: AiVideoStoryboard = {
        title: brief.title, version: 1,
        characters: [
          {
            id: "teacher", role: "teacher", displayName: "المعلمة",
            appearance: "معلمة عربية في الأربعين، شعر أسود مربوط وسترة كحلية وقميص أبيض.",
            voice: "صوت نسائي عربي بالغ دافئ ومنخفض، فصيح وواضح وبإيقاع تعليمي هادئ.",
          },
          {
            id: "student", role: "student", displayName: "الطالب",
            appearance: "طالب عربي في الحادية عشرة، شعر بني مجعد وكنزة مدرسية خضراء.",
            voice: "صوت صبي عربي يافع مشرق ومتوسط الحدة، فصيح وفضولي وبإيقاع أسرع.",
          },
        ],
        scenes: Array.from({ length: sceneCount }, (_, i) => {
          const speakerId = i % 2 ? "student" : "teacher";
          const text = speakerId === "teacher" ? "ماذا يحدث للماء؟" : "يتحول إلى بخار.";
          return {
            id: `scene-${i + 1}`, objective: `مرحلة ${i + 1}`,
            narration: text,
            // Exercise both caption branches while keeping overlay text safe.
            onScreenText: i % 2 ? "" : `مرحلة ${i + 1}`,
            visualPrompt: "Local moving test pattern, not educational content.",
            durationSeconds: 6, transition: "cut" as const, sourceImage: null,
            visibleCharacterIds: ["teacher", "student"],
            dialogue: [{ speakerId, text, delivery: "يتحدث بوضوح." }],
          };
        }),
      };
      const persist = vi.fn(async (_storyboard: AiVideoStoryboard) => {});
      const requestJournal = vi.fn(() => ({
        prepare: async () => ({ action: "submit" as const }),
        recordRequestId: async () => {},
        recordCompleted: async () => {},
        recordFailed: async () => {},
        recordSubmissionUnknown: async () => {},
      }));
      const path = await composeAiVideo({
        brief, storyboard, dir, voice: "nova", deadline: Date.now() + 300_000,
        assertActive: async () => {}, persistStoryboard: persist,
        requestJournal,
      });
      const result = await probeVideo(path);
      const audioDuration = Number(result.audio?.duration ?? result.duration);
      expect(Math.abs(result.duration - durationSeconds)).toBeLessThanOrEqual(0.12);
      expect(Math.abs(audioDuration - durationSeconds)).toBeLessThanOrEqual(0.12);
      expect(result.audio?.codec_type).toBe("audio");
      expect(state.scene).toBe(sceneCount);
      expect(requestJournal).toHaveBeenCalledTimes(sceneCount);
      const saved = persist.mock.calls[0]![0];
      expect(saved.scenes.map(scene => scene.durationSeconds)).toEqual(Array(sceneCount).fill(6));
      expect(saved.scenes.every(scene => scene.audioDurationSeconds === undefined)).toBe(true);
    }
  }, 900_000);
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