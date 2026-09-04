import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/islamic/play.tsx", "utf8");

describe("Islamic short-answer reveal mode contract", () => {
  it("allows self-assessment only after the model answer is revealed", () => {
    expect(source).toContain(
      'q.questionType !== "short_answer" || !revealed || selected !== null',
    );
    expect(source).toContain('assessShortAnswer("full")');
    expect(source).toContain('assessShortAnswer("partial")');
    expect(source).toContain('assessShortAnswer("unknown")');
  });

  it("does not submit an answer merely by revealing it", () => {
    expect(source).toContain(
      '<GoldButton onClick={() => setRevealed(true)}>كشف الإجابة</GoldButton>',
    );
  });
});