import { describe, expect, it } from "vitest";
import { createXoClassState, xoClassReducer, xoWinner } from "./xo-class-engine";

const questions = [
  { text: "Q1", options: ["A", "B"], correct: 0 },
  { text: "Q2", options: ["A", "B"], correct: 1 },
];

function playing() {
  return { ...createXoClassState(questions, 10), status: "playing" as const };
}

describe("XO classroom engine", () => {
  it("allows only the active team to answer and grants placement after a correct answer", () => {
    const state = playing();
    expect(xoClassReducer(state, { type: "answer", team: "o", index: 0 })).toBe(state);
    const correct = xoClassReducer(state, { type: "answer", team: "x", index: 0 });
    expect(correct.phase).toBe("placement");
    expect(correct.activeTeam).toBe("x");
  });

  it("switches turns after a wrong answer or timeout", () => {
    const wrong = xoClassReducer(playing(), { type: "answer", team: "x", index: 1 });
    expect(wrong.activeTeam).toBe("o");
    expect(wrong.questionIndex).toBe(1);
    const timedOut = xoClassReducer({ ...playing(), timeLeft: 1 }, { type: "tick" });
    expect(timedOut.activeTeam).toBe("o");
  });

  it("rejects occupied cells and detects wins and draws", () => {
    const placement = { ...playing(), phase: "placement" as const };
    const placed = xoClassReducer(placement, { type: "place", team: "x", cell: 0 });
    expect(placed.board[0]).toBe("x");
    expect(xoClassReducer({ ...placement, board: placed.board }, { type: "place", team: "x", cell: 0 }).board).toEqual(placed.board);
    expect(xoWinner(["x", "x", "x", null, null, null, null, null, null])).toBe("x");
    expect(xoWinner(["x", "o", "x", "x", "o", "o", "o", "x", "x"])).toBe("draw");
  });

  it("ends the match after the winning placement", () => {
    const state = { ...playing(), phase: "placement" as const, board: ["x", "x", null, "o", null, null, "o", null, null] as const };
    const won = xoClassReducer({ ...state, board: [...state.board] }, { type: "place", team: "x", cell: 2 });
    expect(won.status).toBe("finished");
    expect(won.winner).toBe("x");
  });
});