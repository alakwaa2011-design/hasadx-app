import { describe, expect, it } from "vitest";
import { createXoClassState, currentXoClassQuestionForTeam, xoClassReducer, xoWinner } from "./xo-class-engine";

const questions = [
  { text: "Q1", options: ["A", "B", "C", "D"], correct: 0 },
  { text: "Q2", options: ["A", "B", "C", "D"], correct: 1 },
  { text: "Q3", options: ["A", "B", "C", "D"], correct: 2 },
  { text: "Q4", options: ["A", "B", "C", "D"], correct: 3 },
];

function playing() {
  return { ...createXoClassState(questions, 10), status: "playing" as const };
}

describe("XO classroom engine", () => {
  it("gives each team a different question order and answer order", () => {
    const state = playing();
    const xQuestion = currentXoClassQuestionForTeam(state, "x")!;
    const oQuestion = currentXoClassQuestionForTeam(state, "o")!;
    expect(oQuestion.text).not.toBe(xQuestion.text);
    expect(oQuestion.options).not.toEqual(xQuestion.options);
    expect(oQuestion.options[oQuestion.correct]).toBe(
      state.questions.find((question) => question.text === oQuestion.text)!.options[
        state.questions.find((question) => question.text === oQuestion.text)!.correct
      ],
    );
  });

  it("lets both teams answer and grants placement to the first correct team", () => {
    const state = playing();
    const oQuestion = currentXoClassQuestionForTeam(state, "o")!;
    const correct = xoClassReducer(state, { type: "answer", team: "o", index: oQuestion.correct });
    expect(correct.phase).toBe("placement");
    expect(correct.activeTeam).toBe("o");
  });

  it("keeps the question open for the other team after one wrong answer", () => {
    const state = playing();
    const xQuestion = currentXoClassQuestionForTeam(state, "x")!;
    const xWrongIndex = xQuestion.correct === 0 ? 1 : 0;
    const wrong = xoClassReducer(state, { type: "answer", team: "x", index: xWrongIndex });
    expect(wrong.phase).toBe("question");
    expect(wrong.answeredTeams).toEqual(["x"]);
    const oQuestion = currentXoClassQuestionForTeam(wrong, "o")!;
    const oWrongIndex = oQuestion.correct === 0 ? 1 : 0;
    const bothWrong = xoClassReducer(wrong, { type: "answer", team: "o", index: oWrongIndex });
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