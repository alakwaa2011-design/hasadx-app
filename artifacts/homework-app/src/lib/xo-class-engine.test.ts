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
  it("lets both teams answer and grants placement to the first correct team", () => {
    const state = playing();
    const correct = xoClassReducer(state, { type: "answer", team: "o", index: 0 });
    expect(correct.phase).toBe("placement");
    expect(correct.activeTeam).toBe("o");
  });

  it("keeps the question open for the other team after one wrong answer", () => {
    const wrong = xoClassReducer(playing(), { type: "answer", team: "x", index: 1 });
    expect(wrong.phase).toBe("question");
    expect(wrong.answeredTeams).toEqual(["x"]);
    const bothWrong = xoClassReducer(wrong, { type: "answer", team: "o", index: 1 });
    expect(bothWrong.questionIndex).toBe(1);
    expect(bothWrong.answeredTeams).toEqual([]);
  });

  it("advances to a new question after timeout", () => {
    const timedOut = xoClassReducer({ ...playing(), timeLeft: 1 }, { type: "tick" });
    expect(timedOut.questionIndex).toBe(1);
    expect(timedOut.answeredTeams).toEqual([]);
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