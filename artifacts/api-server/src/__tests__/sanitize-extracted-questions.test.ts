/**
 * Regression tests for sanitizeGeneratedQuestions (extract-from-files path).
 *
 * Verifies:
 * 1. Default extraction counts produce 10 MCQ and 0 of every other type.
 * 2. MCQ questions with fewer than 4 options are rejected.
 * 3. MCQ questions without a numeric correctIndex are rejected (not assumed 0).
 * 4. Well-formed 10-MCQ batches pass through intact.
 * 5. Non-MCQ questions are dropped when counts request only MCQ.
 */

import { describe, it, expect } from "vitest";
import { sanitizeGeneratedQuestions } from "../routes/worksheets";

// ── Helpers ─────────────────────────────────────────────────────────────────

const FOUR_OPTS = ["Alpha", "Beta", "Gamma", "Delta"] as const;

function makeMcq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "mcq",
    prompt: "What is 2 + 2?",
    options: [...FOUR_OPTS],
    correctIndex: 0,
    ...overrides,
  };
}

/** Counts object that mirrors the new extraction default: 10 MCQ, all others 0. */
const DEFAULT_EXTRACT_COUNTS = {
  mcq: 10,
  true_false: 0,
  short_answer: 0,
  fill_blank: 0,
  matching: 0,
};

// ── Default-counts behaviour ─────────────────────────────────────────────────

describe("default extraction counts (10 MCQ, 0 others)", () => {
  it("passes up to 10 valid MCQ questions", () => {
    const raw = Array.from({ length: 10 }, (_, i) =>
      makeMcq({ prompt: `Question ${i + 1}?` }),
    );
    const result = sanitizeGeneratedQuestions(raw, DEFAULT_EXTRACT_COUNTS);
    expect(result).toHaveLength(10);
    result.forEach((q) => expect(q.type).toBe("mcq"));
  });

  it("caps at 10 even when more are provided", () => {
    const raw = Array.from({ length: 15 }, (_, i) =>
      makeMcq({ prompt: `Question ${i + 1}?` }),
    );
    const result = sanitizeGeneratedQuestions(raw, DEFAULT_EXTRACT_COUNTS);
    expect(result).toHaveLength(10);
  });

  it("drops true_false questions when true_false count is 0", () => {
    const raw = [
      makeMcq({ prompt: "MCQ question?" }),
      { type: "true_false", prompt: "Is water wet?", correct: true },
    ];
    const result = sanitizeGeneratedQuestions(raw, DEFAULT_EXTRACT_COUNTS);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("mcq");
  });

  it("drops fill_blank questions when fill_blank count is 0", () => {
    const raw = [
      makeMcq({ prompt: "MCQ question?" }),
      { type: "fill_blank", prompt: "The sky is ____.", answer: "blue" },
    ];
    const result = sanitizeGeneratedQuestions(raw, DEFAULT_EXTRACT_COUNTS);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("mcq");
  });
});

// ── MCQ option-count validation ──────────────────────────────────────────────

describe("MCQ option-count validation", () => {
  it("accepts MCQ with exactly 4 options", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ options: ["A", "B", "C", "D"] })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(1);
  });

  it("accepts MCQ with more than 4 options — keeps only first 4 (editor is A-D only)", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ options: ["A", "B", "C", "D", "E", "F"], correctIndex: 0 })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(1);
    expect((result[0] as any).options).toHaveLength(4);
    expect((result[0] as any).options).toEqual(["A", "B", "C", "D"]);
  });

  it("rejects MCQ when correctIndex points to a 5th or 6th option (out of 0-3 range)", () => {
    // Even if options has 6 entries, correctIndex 4 or 5 would be beyond the 4 options
    // the client maps, so the sanitizer must reject to avoid answer corruption.
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ options: ["A", "B", "C", "D", "E", "F"], correctIndex: 5 })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with only 3 options", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ options: ["A", "B", "C"] })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with 2 options", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ options: ["A", "B"] })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with 1 option", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ options: ["A"] })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with no options", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ options: [] })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });
});

// ── correctIndex validation ──────────────────────────────────────────────────

describe("MCQ correctIndex validation", () => {
  it("accepts correctIndex 0", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ correctIndex: 0 })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(1);
    expect((result[0] as any).correctIndex).toBe(0);
  });

  it("accepts correctIndex 3", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ correctIndex: 3 })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(1);
    expect((result[0] as any).correctIndex).toBe(3);
  });

  it("rejects MCQ with missing correctIndex (does NOT assume 0)", () => {
    const q = makeMcq();
    delete (q as any).correctIndex;
    const result = sanitizeGeneratedQuestions([q], DEFAULT_EXTRACT_COUNTS);
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with null correctIndex", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ correctIndex: null })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with string correctIndex (e.g. 'A')", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ correctIndex: "A" })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with undefined correctIndex", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ correctIndex: undefined })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with correctIndex > 3 (out of 0-3 range for 4-option editor)", () => {
    // correctIndex 4+ would point past option D; must be rejected to avoid answer corruption.
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ correctIndex: 99 })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });

  it("rejects MCQ with correctIndex exactly 4", () => {
    const result = sanitizeGeneratedQuestions(
      [makeMcq({ correctIndex: 4 })],
      DEFAULT_EXTRACT_COUNTS,
    );
    expect(result).toHaveLength(0);
  });
});

// ── Full valid batch ─────────────────────────────────────────────────────────

describe("10 well-formed MCQ questions pass through intact", () => {
  it("preserves prompt, options, and correctIndex for all 10", () => {
    const raw = Array.from({ length: 10 }, (_, i) =>
      makeMcq({
        prompt: `Question ${i + 1}?`,
        options: [`Opt A${i}`, `Opt B${i}`, `Opt C${i}`, `Opt D${i}`],
        correctIndex: i % 4,
      }),
    );
    const result = sanitizeGeneratedQuestions(raw, DEFAULT_EXTRACT_COUNTS);
    expect(result).toHaveLength(10);
    result.forEach((q, i) => {
      expect(q.type).toBe("mcq");
      expect((q as any).prompt).toBe(`Question ${i + 1}?`);
      expect((q as any).options).toHaveLength(4);
      expect(typeof (q as any).correctIndex).toBe("number");
    });
  });
});
