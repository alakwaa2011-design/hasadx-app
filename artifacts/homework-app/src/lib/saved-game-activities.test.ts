import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedGameActivity,
  getSavedGameActivity,
  normalizeSavedGameQuestions,
  saveGameActivity,
} from "./saved-game-activities";

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.umami;
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

  it("keeps two and three-option questions in saved games", () => {
    expect(normalizeSavedGameQuestions([
      { text: "Two", options: ["A", "B"], correct: 1 },
      { text: "Three", options: ["A", "B", "C"], correct: 2 },
    ])).toEqual([
      { text: "Two", options: ["A", "B"], correct: 1, imageUrl: null },
      { text: "Three", options: ["A", "B", "C"], correct: 2, imageUrl: null },
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

  it("tracks only non-content dimensions after successful save and replay requests", async () => {
    const track = vi.fn();
    window.umami = { track };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 71,
          title: "Private classroom title",
          gameType: "rocket_race",
          questions: [{ text: "Private question" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 71,
          title: "Private classroom title",
          gameType: "rocket_race",
          questions: [{ text: "Private question" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await saveGameActivity({
      title: "Private classroom title",
      gameType: "rocket_race",
      questions: [{ text: "Private question", options: ["A", "B", "C", "D"], correct: 0 }],
    });
    await getSavedGameActivity(71);

    expect(track).toHaveBeenNthCalledWith(1, "saved_game_saved", {
      game_type: "rocket",
      location: "game_creator",
    });
    expect(track).toHaveBeenNthCalledWith(2, "saved_game_replayed", {
      game_type: "rocket",
      location: "saved_games_library",
    });
    expect(track.mock.calls.flatMap(([, data]) => Object.keys(data))).toEqual([
      "game_type",
      "location",
      "game_type",
      "location",
    ]);
  });

  it("does not track a save event when the saved-game request fails", async () => {
    const track = vi.fn();
    window.umami = { track };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "save failed" }),
    }));

    await expect(saveGameActivity({
      title: "Never saved",
      gameType: "arena",
      questions: [],
    })).rejects.toThrow("save failed");
    expect(track).not.toHaveBeenCalled();
  });
});