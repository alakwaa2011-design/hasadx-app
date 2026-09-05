import { describe, expect, it } from "vitest";
import { checkBankReadiness, parseAdaptiveConfig } from "../routes/adaptive";

const question = (id: number, skill: string, difficulty: number, questionType = "mcq") => ({
  id, skill, difficulty, questionType,
});

describe("adaptive bank readiness", () => {
  it("requires every declared skill to contain two questions at each level", () => {
    const config = parseAdaptiveConfig(JSON.stringify({ skills: ["reading", "grammar"] }));
    const pool = [
      ...[1, 1, 2, 2, 3, 3].map((d, i) => question(i, "reading", d)),
      ...[1, 2, 3].map((d, i) => question(i + 10, "grammar", d)),
    ];
    const result = checkBankReadiness(pool, config);
    expect(result.valid).toBe(false);
    expect(result.missingSkills).toEqual(["grammar"]);
  });

  it("rejects unassigned, undeclared, and unsupported questions", () => {
    const result = checkBankReadiness([
      ...[1, 1, 2, 2, 3, 3].map((d, i) => question(i, "math", d)),
      question(10, "", 1),
      question(11, "science", 1),
      question(12, "math", 1, "open"),
    ], parseAdaptiveConfig(JSON.stringify({ skills: ["math"] })));
    expect(result.valid).toBe(false);
    expect(result.noSkill).toEqual([10]);
    expect(result.undeclaredSkill).toEqual([11]);
    expect(result.unsupportedTypes).toEqual(["open"]);
  });
});