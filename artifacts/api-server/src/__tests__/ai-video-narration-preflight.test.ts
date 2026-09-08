import { afterEach, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: provider.create } } },
}));
vi.mock("@workspace/integrations-openai-ai-server/audio", () => ({
  textToSpeech: vi.fn(async () => {
    const sampleRate = 8_000;
    const samples = Math.round(0.4 * sampleRate);
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
    return wav;
  }),
}));
import {
  prepareAiVideoNarration,
  reflowNarration,
  type NarrationPreflightDependencies,
  type NarrationReflowRequest,
} from "../lib/ai-video-narration-preflight";
import { NarrationNeedsReflowError, probeAudioSeconds } from "../lib/ai-video-timing";
import type { AiVideoBrief, AiVideoStoryboard } from "../lib/ai-video-schemas";

const exec = promisify(execFile);
const temporaryDirectories: string[] = [];

function fixture(language: "ar" | "en" = "en"): {
  brief: AiVideoBrief;
  storyboard: AiVideoStoryboard;
} {
  const brief: AiVideoBrief = {
    title: "Water cycle",
    topic: "How water moves",
    prompt: "",
    language,
    sourceImages: [],
    durationSeconds: 30,
    aspectRatio: "16:9",
    visualStyle: "educational",
    voice: "nova",
    music: false,
    captions: true,
    idempotencyKey: "narration-preflight-test",
  };
  const storyboard: AiVideoStoryboard = {
    title: brief.title,
    version: 4,
    scenes: Array.from({ length: 5 }, (_, index) => ({
      id: `scene-${index + 1}`,
      objective: `Objective ${index + 1}`,
      narration: `Fact ${index + 1} is clear.`,
      onScreenText: `Fact ${index + 1}`,
      visualPrompt: `Show visual ${index + 1}.`,
      durationSeconds: 6,
      transition: "dissolve" as const,
      sourceImage: null,
    })),
  };
  return { brief, storyboard };
}

function options(override: Partial<ReturnType<typeof fixture>> = {}) {
  const base = fixture();
  const value = { ...base, ...override };
  return {
    ...value,
    dir: "/tmp/narration-preflight-unit",
    deadline: Date.now() + 300_000,
    voice: "nova" as const,
    assertActive: vi.fn(async () => {}),
  };
}

function reflowError(narration: string, durationSeconds = 8, maxWords = 3) {
  // Keep this usable while the implementation of the public constructor is
  // being completed: its public data fields are the contract under test.
  return Object.assign(Object.create(NarrationNeedsReflowError.prototype), {
    name: "NarrationNeedsReflowError",
    message: "needs whole-lesson reflow",
    narration,
    durationSeconds,
    maxWords,
    attempts: 2,
  }) as NarrationNeedsReflowError;
}

function validReflow(storyboard: AiVideoStoryboard) {
  return {
    scenes: storyboard.scenes.map((scene) => ({
      id: scene.id,
      narration: scene.narration,
      objective: scene.objective,
      onScreenText: scene.onScreenText,
      visualPrompt: scene.visualPrompt,
      sourceSceneIds: [scene.id],
    })),
  };
}

afterEach(async () => {
  provider.create.mockReset();
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("AI video whole-lesson narration preflight", () => {
  it("accepts a partial rewrite and reallocates cached unchanged overruns", async () => {
    const input = options();
    const originalDurations = [5.8, 5.8, 5.8, 5.8, 4.4];
    const finalDurations = [5.8, 3.8, 3.8, 5.8, 4.4];
    const fitCounts = new Map<string, number>();
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      fitCounts.set(request.narration, (fitCounts.get(request.narration) ?? 0) + 1);
      const sceneIndex = Number(request.objective.match(/\d+/)?.[0] ?? "1") - 1;
      const shortened = request.narration.startsWith("Core");
      return {
        narration: request.narration,
        durationSeconds: shortened ? 3.8 : originalDurations[sceneIndex]!,
        attempts: 1,
      };
    });
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      const result = validReflow(request.current);
      for (const index of [1, 2]) {
        result.scenes[index]!.narration = `Core ${index + 1}.`;
        result.scenes[index]!.objective = `Objective ${index + 1}`;
        result.scenes[index]!.onScreenText = `Core ${index + 1}`;
        result.scenes[index]!.visualPrompt = `Show core ${index + 1}.`;
      }
      return result;
    });
    let probeIndex = 0;

    const result = await prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(async () => finalDurations[probeIndex++]!),
    });

    expect(reflow).toHaveBeenCalledOnce();
    expect(result.storyboard.scenes.map((scene) => scene.durationSeconds)).toEqual([7, 5, 5, 7, 6]);
    expect(fit).toHaveBeenCalledTimes(7);
    expect(fitCounts.get("Fact 1 is clear.")).toBe(1);
    expect(fitCounts.get("Fact 4 is clear.")).toBe(1);
  });

  it("automatically summarizes a measured 70.9-second lesson into 60 seconds", async () => {
    const input = options();
    input.brief.durationSeconds = 60;
    input.storyboard.scenes = Array.from({ length: 10 }, (_, index) => ({
      id: `scene-${index + 1}`,
      objective: `Objective ${index + 1}`,
      narration: `Original fact ${index + 1}.`,
      onScreenText: `Fact ${index + 1}`,
      visualPrompt: `Show visual ${index + 1}.`,
      durationSeconds: 6,
      transition: "dissolve" as const,
      sourceImage: null,
    }));
    const measuredOriginals = new Set<string>();
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.narration.startsWith("Original")) {
        expect(measuredOriginals.has(request.narration)).toBe(false);
        measuredOriginals.add(request.narration);
        return { narration: request.narration, durationSeconds: 7.09, attempts: 1 };
      }
      return { narration: request.narration, durationSeconds: 4, attempts: 1 };
    });
    const reflow = vi.fn(async (request: NarrationReflowRequest) => ({
      scenes: request.current.scenes.map((scene, index) => ({
        id: scene.id,
        narration: `Core ${index + 1}.`,
        objective: `Core objective ${index + 1}`,
        onScreenText: `Core ${index + 1}`,
        visualPrompt: `Show only core idea ${index + 1}.`,
        sourceSceneIds: [scene.id],
      })),
    }));

    const result = await prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(async () => 4),
    });

    expect(measuredOriginals.size).toBe(10);
    expect(reflow).toHaveBeenCalledOnce();
    expect(result.storyboard.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0)).toBe(60);
    expect(result.storyboard.scenes.every((scene) => scene.narration.startsWith("Core"))).toBe(true);
  });

  it("rejects an unchanged failing plan without repeating TTS", async () => {
    const input = options();
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.objective === "Objective 1") throw reflowError(request.narration, 8, 3);
      return { narration: request.narration, durationSeconds: 1, attempts: 1 };
    });
    const reflow = vi.fn(async (request: NarrationReflowRequest) => validReflow(request.current));

    await expect(prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(),
    })).rejects.toThrow("complete scene plan");
    expect(fit).toHaveBeenCalledTimes(5);
    expect(reflow).toHaveBeenCalledTimes(3);
  });

  it("rejects changed but over-limit reflow narration before another TTS call", async () => {
    const input = options();
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.objective === "Objective 1") throw reflowError(request.narration, 8, 3);
      return { narration: request.narration, durationSeconds: 1, attempts: 1 };
    });
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      const result = validReflow(request.current);
      result.scenes[0]!.narration = "This replacement is deliberately even longer than the measured original.";
      return result;
    });

    await expect(prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(),
    })).rejects.toThrow("complete scene plan");
    expect(fit).toHaveBeenCalledTimes(5);
    expect(reflow).toHaveBeenCalledTimes(3);
  });

  it("rejects joined-word attempts to evade measured limits before TTS", async () => {
    const input = options();
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.objective === "Objective 1") throw reflowError(request.narration, 8, 2);
      return { narration: request.narration, durationSeconds: 1, attempts: 1 };
    });
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      const result = validReflow(request.current);
      result.scenes[0]!.narration = "الماء يسخن علىسطحالبحاروالأنهار،فتتبخرجزيئاته.";
      return result;
    });

    await expect(prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(),
    })).rejects.toThrow("complete scene plan");
    expect(fit).toHaveBeenCalledTimes(5);
  });

  it("freezes fitting short scenes when only one scene exceeds the seven-second maximum", async () => {
    const input = options();
    const originals = [7.25, 3.3, 4.1, 4.4, 3.75];
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.narration === "It moves.") {
        return { narration: request.narration, durationSeconds: 2.5, attempts: 1 };
      }
      const index = Number(request.objective.match(/\d+/)?.[0] ?? "1") - 1;
      return { narration: request.narration, durationSeconds: originals[index]!, attempts: 1 };
    });
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      expect(request.maximumWords.slice(1)).toEqual([4, 4, 4, 4]);
      expect(request.frozenNarration.slice(1))
        .toEqual(request.current.scenes.slice(1).map((scene) => scene.narration));
      const result = validReflow(request.current);
      result.scenes[0]!.narration = "It moves.";
      return result;
    });
    let probeIndex = 0;
    const finalDurations = [2.5, ...originals.slice(1)];

    const result = await prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(async () => finalDurations[probeIndex++]!),
    });

    expect(result.storyboard.scenes.slice(1).map((scene) => scene.narration))
      .toEqual(input.storyboard.scenes.slice(1).map((scene) => scene.narration));
    expect(fit).toHaveBeenCalledTimes(6);
    expect(reflow).toHaveBeenCalledOnce();
  });

  it("redistributes a locally exhausted scene, updates its matching visuals, and reuses unchanged audio", async () => {
    const input = options();
    const fitCalls = new Map<string, number>();
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      fitCalls.set(request.narration, (fitCalls.get(request.narration) ?? 0) + 1);
      // The whole-lesson coordinator, rather than isolated lossy retries, owns
      // every rewrite after an actual recording does not fit.
      expect(request.maxAttempts).toBe(1);
      if (request.narration === "Fact 1 is clear.") {
        throw reflowError(request.narration, 7.4, 3);
      }
      return { narration: request.narration, durationSeconds: 1.25, attempts: 1 };
    });
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      expect(request.original.scenes.map((scene) => scene.id)).toEqual([
        "scene-1", "scene-2", "scene-3", "scene-4", "scene-5",
      ]);
      expect(request.measuredSeconds[0]).toBe(7.4);
      const result = validReflow(request.current);
      result.scenes[0] = {
        ...result.scenes[0]!,
        narration: "It rises.",
        objective: "Introduce rising water",
        onScreenText: "Water rises",
        visualPrompt: "Show water rising as vapour.",
        sourceSceneIds: ["scene-1"],
      };
      return result;
    });
    const result = await prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(async () => 1.25),
    });

    expect(reflow).toHaveBeenCalledOnce();
    expect(result.storyboard.scenes[0]).toMatchObject({
      narration: "It rises.",
      objective: "Introduce rising water",
      onScreenText: "Water rises",
      visualPrompt: "Show water rising as vapour.",
    });
    expect(result.storyboard.scenes[1]!.narration).toBe("Fact 2 is clear.");
    expect(fitCalls.get("Fact 3 is clear.")).toBe(1);
    expect(fitCalls.get("Fact 4 is clear.")).toBe(1);
    expect(fitCalls.get("Fact 5 is clear.")).toBe(1);
    expect(fit).toHaveBeenCalledTimes(6);
  });

  it("does not expand short narration and validates real bounded WAV files with ffprobe", async () => {
    const { brief, storyboard } = fixture();
    storyboard.scenes.forEach((scene, index) => { scene.narration = `Fact ${index + 1}.`; });
    const dir = await mkdtemp(join(tmpdir(), "narration-preflight-wav-"));
    temporaryDirectories.push(dir);
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      await exec("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
        "-i", "sine=frequency=440:sample_rate=8000:duration=0.4",
        request.outputPath,
      ]);
      return { narration: request.narration, durationSeconds: 0.4, attempts: 1 };
    });
    const reflow = vi.fn();
    const result = await prepareAiVideoNarration({
      brief,
      storyboard,
      dir,
      deadline: Date.now() + 300_000,
      voice: "nova",
      assertActive: async () => {},
    }, { fit, reflow, probe: probeAudioSeconds });

    expect(reflow).not.toHaveBeenCalled();
    expect(result.storyboard.scenes.map((scene) => scene.narration))
      .toEqual(storyboard.scenes.map((scene) => scene.narration));
    expect(result.timing.map(({ speech }) => speech)).toEqual(
      expect.arrayContaining(Array(5).fill(expect.closeTo(0.4, 2))),
    );
  }, 30_000);

  it("accepts an eight-word Arabic final scene when its measured WAV fits", async () => {
    const input = options(fixture("ar"));
    input.storyboard.scenes[4]!.narration = "تتجمع قطرات الماء أخيراً لتبدأ دورة جديدة متكاملة";
    const reflow = vi.fn();
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      expect(request.measureFirst).toBe(true);
      return { narration: request.narration, durationSeconds: 2.2, attempts: 1 };
    });

    const result = await prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(async () => 2.2),
    });

    expect(reflow).not.toHaveBeenCalled();
    expect(result.storyboard.scenes[4]!.narration)
      .toBe("تتجمع قطرات الماء أخيراً لتبدأ دورة جديدة متكاملة");
    expect(result.storyboard.scenes[4]!.audioDurationSeconds).toBe(2.2);
  });

  it("accepts reflow narration above advisory targets when real measurements fit", async () => {
    const input = options();
    input.storyboard.scenes[0]!.narration = Array(20).fill("overloaded").join(" ");
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      expect(request.maximumWords[0]).toBe(12);
      const result = validReflow(request.current);
      result.scenes[0]!.narration = "These ten spoken words remain complete and naturally fit here.";
      return result;
    });
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.narration.startsWith("overloaded")) throw reflowError(request.narration, 8, 5);
      return { narration: request.narration, durationSeconds: 2, attempts: 1 };
    });
    const probe = vi.fn(async () => 2);

    const result = await prepareAiVideoNarration(input, { fit, reflow, probe });

    expect(reflow).toHaveBeenCalledOnce();
    expect(fit).toHaveBeenCalledTimes(6);
    expect(probe).toHaveBeenCalledTimes(5);
    expect(result.storyboard.scenes[0]!.narration)
      .toBe("These ten spoken words remain complete and naturally fit here.");
  });

  it("preserves the exact 30-second timeline, leads, tails, and safety margins", async () => {
    const input = options();
    // Stay one hundredth inside each safety boundary so floating-point
    // representation cannot accidentally turn this into an overrun case.
    const actual = [5.19, 4.99, 4.99, 4.99, 4.44];
    let fitIndex = 0;
    let probeIndex = 0;
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      const expectedWindow = [5.35, 5.15, 5.15, 5.15, 4.6][fitIndex]!;
      expect(request.budgetSeconds).toBeCloseTo(expectedWindow);
      expect(request.safetySeconds).toBe(0.15);
      return { narration: request.narration, durationSeconds: actual[fitIndex++]!, attempts: 1 };
    });
    const result = await prepareAiVideoNarration(input, {
      fit,
      reflow: vi.fn(),
      probe: vi.fn(async () => actual[probeIndex++]!),
    });

    expect(result.storyboard.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0)).toBe(30);
    expect(result.timing.map(({ lead }) => lead)).toEqual([0.3, 0.5, 0.5, 0.5, 0.5]);
    expect(result.storyboard.scenes[0]!.narrationStartTime).toBe(0.3);
    expect(result.storyboard.scenes[0]!.narrationEndTime).toBe(5.49);
    expect(result.storyboard.scenes[4]!.narrationEndTime).toBe(28.94);
    expect(30 - result.storyboard.scenes[4]!.narrationEndTime!).toBeGreaterThanOrEqual(0.9 + 0.15);
  });

  it("blocks motion consumers when final file probing finds a duration breach", async () => {
    const input = options();
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => ({
      narration: request.narration,
      durationSeconds: 1,
      attempts: 1,
    }));
    let probeIndex = 0;
    await expect(prepareAiVideoNarration(input, {
      fit,
      reflow: vi.fn(),
      probe: vi.fn(async () => probeIndex++ === 0 ? 5.21 : 1),
    })).rejects.toThrow("preflight timing check");
  });

  it("rejects reflow plans that omit any original source coverage before fitting audio", async () => {
    const input = options(fixture("ar"));
    input.storyboard.scenes[0]!.narration = Array(20).fill("معلومة").join(" ");
    const invalid = validReflow(input.storyboard);
    invalid.scenes.forEach((scene) => { scene.sourceSceneIds = ["scene-1"]; });
    invalid.scenes[0]!.narration = "Short.";
    const reflow = vi.fn(async () => invalid);
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.objective === "Objective 1") throw reflowError(request.narration, 8, 3);
      return { narration: request.narration, durationSeconds: 1, attempts: 1 };
    });

    await expect(prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(),
    })).rejects.toThrow("لم تُرجع خدمة كتابة التعليق خطة مكتملة للمشاهد");
    expect(reflow).toHaveBeenCalledTimes(3);
    expect(fit).toHaveBeenCalledTimes(5);
  });

  it("uses conservative initial language budgets in the reflow request", async () => {
    for (const [language, expected] of [["ar", [8, 8, 8, 8, 7]], ["en", [9, 9, 9, 9, 8]]] as const) {
      const data = fixture(language);
      data.storyboard.scenes[0]!.narration = Array(20).fill("word").join(" ");
      const reflow = vi.fn(async (request: NarrationReflowRequest) => {
        expect(request.maximumWords).toEqual(expected);
        expect(request.budgets).toEqual([5.2, 5, 5, 5, 4.45]);
        const result = validReflow(request.current);
        result.scenes.forEach((scene) => { scene.narration = "Brief."; });
        return result;
      });
      await prepareAiVideoNarration(options(data), {
        fit: vi.fn(async (request) => ({ narration: request.narration, durationSeconds: 1, attempts: 1 })),
        reflow,
        probe: vi.fn(async () => 1),
      });
    }
  });

  it("recovers after more than three measured whole-lesson reflows", async () => {
    const input = options();
    let sceneOneAttempts = 0;
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.objective === "Objective 1" && ++sceneOneAttempts <= 4) {
        throw reflowError(request.narration, 7, 1);
      }
      return { narration: request.narration, durationSeconds: 1, attempts: 1 };
    });
    let revision = 0;
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      const result = validReflow(request.current);
      result.scenes[0]!.narration = `R${++revision}.`;
      return result;
    });

    const result = await prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(async () => 1),
    });

    expect(reflow).toHaveBeenCalledTimes(4);
    expect(sceneOneAttempts).toBe(5);
    expect(result.storyboard.scenes[0]!.narration).toBe("R4.");
    // Four already-valid recordings survive every global correction.
    expect(fit).toHaveBeenCalledTimes(9);
  });

  it("bounds provider calls when all eight global reflow rounds are exhausted", async () => {
    const input = options();
    let sceneOneAttempts = 0;
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.objective === "Objective 1") {
        sceneOneAttempts += 1;
        throw reflowError(request.narration, 7, 1);
      }
      return { narration: request.narration, durationSeconds: 1, attempts: 1 };
    });
    let revision = 0;
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      const result = validReflow(request.current);
      result.scenes[0]!.narration = `Retry${++revision}.`;
      return result;
    });
    const probe = vi.fn();

    await expect(prepareAiVideoNarration(input, { fit, reflow, probe }))
      .rejects.toThrow("after automatic whole-lesson redistribution");
    expect(reflow).toHaveBeenCalledTimes(6);
    expect(sceneOneAttempts).toBe(7);
    expect(fit).toHaveBeenCalledTimes(11);
    expect(probe).not.toHaveBeenCalled();
  });

  it("retries malformed reflow JSON only within the bounded correction loop", async () => {
    const input = options();
    input.storyboard.scenes[0]!.narration = Array(20).fill("overloaded").join(" ");
    const feedback: string[] = [];
    let call = 0;
    const reflow = vi.fn(async (request: NarrationReflowRequest) => {
      feedback.push(request.feedback);
      if (++call < 3) throw new SyntaxError("bad provider JSON");
      const result = validReflow(request.current);
      result.scenes[0]!.narration = "Brief.";
      return result;
    });
    const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
      if (request.narration.startsWith("overloaded")) throw reflowError(request.narration, 8, 3);
      return { narration: request.narration, durationSeconds: 1, attempts: 1 };
    });

    await prepareAiVideoNarration(input, {
      fit,
      reflow,
      probe: vi.fn(async () => 1),
    });
    expect(reflow).toHaveBeenCalledTimes(3);
    expect(feedback[1]).toContain("malformed");
    expect(feedback[2]).toContain("malformed");
    expect(fit).toHaveBeenCalledTimes(6);
  });

  it("uses strict structured output for the default narration provider", async () => {
    const { brief, storyboard } = fixture();
    storyboard.scenes[0]!.narration = Array(20).fill("overloaded").join(" ");
    const plan = validReflow(storyboard);
    plan.scenes.forEach((scene) => { scene.narration = "Brief."; });
    provider.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(plan) } }],
    });
    const dir = await mkdtemp(join(tmpdir(), "narration-provider-contract-"));
    temporaryDirectories.push(dir);

    await reflowNarration({
      original: storyboard,
      current: storyboard,
      language: brief.language,
      maximumWords: [9, 9, 9, 9, 8],
      budgets: [5.2, 5, 5, 5, 4.45],
      measuredSeconds: [8, 1, 1, 1, 1],
      slotDurations: [6, 6, 6, 6, 6],
      targetTotalSeconds: 30,
      wordLimits: [3, 9, 9, 9, 8],
      characterLimits: [20, 20, 20, 20, 20],
      allowedUnchangedNarration: [null, storyboard.scenes[1]!.narration,
        storyboard.scenes[2]!.narration, storyboard.scenes[3]!.narration,
        storyboard.scenes[4]!.narration],
      frozenNarration: [null, null, null, null, null],
      feedback: "Summarize the core idea.",
      timeoutMs: 100_000,
    });

    expect(provider.create).toHaveBeenCalledOnce();
    const request = provider.create.mock.calls[0]![0];
    expect(request.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "educational_narration_plan", strict: true },
    });
    expect(request.response_format.json_schema.schema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(JSON.parse(request.messages[1].content).scenes[0]).toMatchObject({
      targetWords: 9,
      availableSpeechSeconds: 5.2,
    });
  }, 30_000);

  it("does not start TTS after lease or deadline loss during a reflow", async () => {
    for (const loss of ["lease", "deadline"] as const) {
      const input = options();
      input.storyboard.scenes[0]!.narration = Array(20).fill("overloaded").join(" ");
      let reflowStarted = false;
      if (loss === "lease") {
        input.assertActive = vi.fn(async () => {
          if (reflowStarted) throw new Error("lease lost during reflow");
        });
      }
      const reflow = vi.fn(async (request: NarrationReflowRequest) => {
        reflowStarted = true;
        if (loss === "deadline") input.deadline = Date.now() - 1;
        const result = validReflow(request.current);
        result.scenes.forEach((scene) => { scene.narration = "Brief."; });
        return result;
      });
      const fit = vi.fn(async (request: Parameters<NarrationPreflightDependencies["fit"]>[0]) => {
        if (request.objective === "Objective 1") throw reflowError(request.narration, 8, 3);
        return { narration: request.narration, durationSeconds: 1, attempts: 1 };
      });
      const probe = vi.fn();

      await expect(prepareAiVideoNarration(input, { fit, reflow, probe }))
        .rejects.toThrow(loss === "lease" ? "lease lost during reflow" : "provider deadline");
      expect(reflow).toHaveBeenCalledOnce();
      expect(fit).toHaveBeenCalledTimes(5);
      expect(probe).not.toHaveBeenCalled();
    }
  });

  it("stops immediately on lease loss without provider, file, or probe calls", async () => {
    const input = options();
    input.assertActive = vi.fn(async () => { throw new Error("lease lost"); });
    const fit = vi.fn();
    const reflow = vi.fn();
    const probe = vi.fn();
    await expect(prepareAiVideoNarration(input, { fit, reflow, probe })).rejects.toThrow("lease lost");
    expect(fit).not.toHaveBeenCalled();
    expect(reflow).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
  });
});