import { describe, expect, it } from "vitest";
import { checkBankReadiness, nextStageTransition, parseAdaptiveConfig, stagePassed, type StageRuntime } from "../routes/adaptive";

const runtime = (overrides: Partial<StageRuntime> = {}): StageRuntime => ({
  stageIndex: 0, stageStartedAt: "2025-01-01T00:00:00.000Z", stageAnswered: 3,
  stageCorrect: 1, repeats: 0, phase: "main", supportAnswered: 0, ...overrides,
});

describe("staged adaptive configuration", () => {
  it("normalizes staged rules and keeps stage details hidden by default", () => {
    const config = parseAdaptiveConfig(JSON.stringify({
      mode: "staged", stages: [{
        id: "foundation", name: "Foundation", questionCount: 3,
        passRule: { type: "percent", threshold: 67 }, difficulties: ["easy", "hard"],
        skills: [" algebra "], failureAction: "repeat", maxRepeats: 2, durationMinutes: 5,
      }],
    }));
    expect(config.mode).toBe("staged");
    expect(config.showStageNames).toBe(false);
    expect(config.stages[0]).toMatchObject({ id: "foundation", questionCount: 3, difficulties: [1, 3], skills: ["algebra"], failureAction: "repeat", maxRepeats: 2 });
  });

  it("uses percent and correct-count pass rules", () => {
    const [percent] = parseAdaptiveConfig(JSON.stringify({ mode: "staged", stages: [{ questionCount: 3, passRule: { type: "percent", threshold: 67 } }] })).stages;
    const [count] = parseAdaptiveConfig(JSON.stringify({ mode: "staged", stages: [{ questionCount: 3, passRule: { type: "correctCount", threshold: 2 } }] })).stages;
    expect(stagePassed(percent, 2, 3)).toBe(false);
    expect(stagePassed(count, 2, 3)).toBe(true);
  });

  it("clamps thresholds to valid stage bounds", () => {
    const config = parseAdaptiveConfig(JSON.stringify({ mode: "staged", stages: [
      { questionCount: 3, passRule: { type: "percent", threshold: 500 } },
      { questionCount: 3, passRule: { type: "correctCount", threshold: 8 } },
    ] }));
    expect(config.stages.map(stage => stage.passRule.threshold)).toEqual([100, 3]);
  });

  it("checks stage-specific support and repeat question capacity without continuous coverage rules", () => {
    const questions = (count: number) => Array.from({ length: count }, (_, id) => ({
      id: id + 1, skill: "math", difficulty: 1, questionType: "mcq",
    }));
    const support = parseAdaptiveConfig(JSON.stringify({ mode: "staged", stages: [{
      questionCount: 3, skills: ["math"], difficulties: ["easy"],
      passRule: { type: "percent", threshold: 50 }, failureAction: "support", supportQuestionCount: 2,
    }] }));
    expect(checkBankReadiness(questions(5), support).valid).toBe(true);
    expect(checkBankReadiness(questions(4), support).insufficientStages).toEqual(["stage-1"]);

    const repeat = parseAdaptiveConfig(JSON.stringify({ mode: "staged", stages: [{
      questionCount: 2, skills: ["math"], passRule: { type: "percent", threshold: 50 },
      failureAction: "repeat", maxRepeats: 2,
    }] }));
    expect(checkBankReadiness(questions(5), repeat).stageRequirements[0]).toMatchObject({ required: 6, available: 5, valid: false });
    expect(checkBankReadiness(questions(6), repeat).valid).toBe(true);
  });

  it("chooses support, bounded repeat, advance, or finish after failure", () => {
    const config = parseAdaptiveConfig(JSON.stringify({ mode: "staged", stages: [
      { questionCount: 3, passRule: { type: "correctCount", threshold: 3 }, failureAction: "support", supportQuestionCount: 2 },
      { questionCount: 3, passRule: { type: "correctCount", threshold: 3 }, failureAction: "repeat", maxRepeats: 1 },
      { questionCount: 3, passRule: { type: "correctCount", threshold: 3 }, failureAction: "finish" },
    ] }));
    expect(nextStageTransition(config.stages[0], runtime())).toBe("support");
    expect(nextStageTransition(config.stages[0], runtime({ phase: "support", supportAnswered: 2 }))).toBe("advance");
    expect(nextStageTransition(config.stages[1], runtime())).toBe("repeat");
    expect(nextStageTransition(config.stages[1], runtime({ repeats: 1 }))).toBe("advance");
    expect(nextStageTransition(config.stages[2], runtime())).toBe("finish");
  });
});