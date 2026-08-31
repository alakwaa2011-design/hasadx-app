import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedGameActivity,
  normalizeSavedGameQuestions,
} from "./saved-game-activities";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeSavedGameQuestions", () => {
  it("normalizes both persisted MCQ shapes and ignores unsafe records", () => {
    expect(normalizeSavedGameQuestions([
      { text: " Capitals? ", options: ["Amman", "Cairo", "Riyadh", "Doha"], correct: 2 },
      { text: "Legacy", optionA: "A", optionB: "B", optionC: "C", optionD: "D", correctAnswer: "B" },
      { text: "Incomplete", options: ["only one"], correct: 0 },
      { text: "" },
    ])).toEqual([
      { text: "Capitals?", options: ["Amman", "Cairo", "Riyadh", "Doha"], correct: 2, imageUrl: null },
      { text: "Legacy", options: ["A", "B", "C", "D"], correct: 1, imageUrl: null },
    ]);
  });

  it("accepts JSON-backed true/false questions and bounds their answer", () => {
    expect(normalizeSavedGameQuestions(JSON.stringify([
      { text: "Water is wet", type: "tf", options: ["True", "False"], correctAnswer: "B" },
    ]))).toEqual([
      { text: "Water is wet", options: ["True", "False"], correct: 1, type: "true_false", imageUrl: null },
    ]);
  });

  it("does not parse a successful no-content delete response", async () => {
    const json = vi.fn(() => {
      throw new Error("A 204 response has no JSON body");
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json,
    }));

    await expect(deleteSavedGameActivity(42)).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });
});