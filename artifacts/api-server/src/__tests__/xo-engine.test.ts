import { describe, expect, it } from "vitest";
import {
  answerXoQuestion, clientQuestion, createXoState, getWinner, placeXoMark,
  timeoutXoQuestion, validateXoQuestions, type XoState,
} from "../game/xo-engine";

const questions = [{ text: "2 + 2", options: ["3", "4"], correct: 1, duration: 20 }];

describe("XO engine", () => {
  it("does not disclose the correct answer in client questions", () => {
    expect(clientQuestion(questions[0])).toEqual({ text: "2 + 2", options: ["3", "4"], duration: 20, imageUrl: null });
  });

  it("only grants a placement to the correct active-team responder", () => {
    const start = createXoState();
    expect(answerXoQuestion(start, questions, "o-player", "o", 1)).toMatchObject({ ok: false });
    const answer = answerXoQuestion(start, questions, "x-player", "x", 1);
    expect(answer).toMatchObject({ ok: true, correct: true, state: { phase: "placement", placementPlayerId: "x-player" } });
    if (!answer.ok) return;
    expect(placeXoMark(answer.state, "other-x", "x", 0, 1)).toMatchObject({ ok: false });
  });

  it("switches teams after a wrong answer or timeout", () => {
    const wrong = answerXoQuestion(createXoState(), questions, "x-player", "x", 0);
    expect(wrong).toMatchObject({ ok: true, correct: false, state: { turn: "o", phase: "question" } });
    expect(timeoutXoQuestion(createXoState(), 1)).toMatchObject({ ok: true, state: { turn: "o" } });
  });

  it("rejects occupied cells and detects wins and draws", () => {
    const state: XoState = { ...createXoState(), board: ["x", "x", null, null, null, null, null, null, null], phase: "placement", placementPlayerId: "x", turn: "x" };
    expect(placeXoMark(state, "x", "x", 0, 1)).toMatchObject({ ok: false });
    expect(placeXoMark(state, "x", "x", 2, 1)).toMatchObject({ ok: true, winner: "x", state: { phase: "finished" } });
    expect(getWinner(["x", "o", "x", "x", "o", "o", "o", "x", "x"])).toBe("draw");
  });

  it("accepts only complete two-to-four option questions", () => {
    expect(validateXoQuestions([{ text: "True?", options: ["", "False"], correct: 0 }])).toBeNull();
    expect(validateXoQuestions([{ text: "True?", options: ["True", "False"], correct: 0 }])).toHaveLength(1);
  });
});