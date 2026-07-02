import { describe, it, expect } from "vitest";
import {
  buildQuestionOrders,
  classReducer,
  createClassState,
  currentQuestion,
  type ClassQuestion,
  type ClassState,
} from "./tug-class-engine";

const makeQuestions = (n: number): ClassQuestion[] =>
  Array.from({ length: n }, (_, i) => ({
    text: `Q${i + 1}`,
    options: ["a", "b", "c", "d"],
    correct: i % 4,
  }));

/** Deterministic rng so shuffle-dependent assertions are stable. */
const seededRng = (seed = 42) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const startPlaying = (state: ClassState): ClassState => {
  let s = classReducer(state, { type: "start" });
  for (let i = 0; i < 3; i++) s = classReducer(s, { type: "tick" });
  return s;
};

describe("buildQuestionOrders", () => {
  it("gives EVERY team ALL the questions — nothing is ever dropped", () => {
    for (const n of [2, 5, 10, 11]) {
      const { blue, red } = buildQuestionOrders(n, seededRng());
      expect(blue).toHaveLength(n);
      expect(red).toHaveLength(n);
      expect([...blue].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect([...red].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });

  it("blue's order differs from red's order", () => {
    const { blue, red } = buildQuestionOrders(10, seededRng());
    expect(blue).not.toEqual(red);
  });

  it("teams never look at the same question at the same position (n >= 2)", () => {
    for (const n of [2, 3, 7, 10]) {
      const { blue, red } = buildQuestionOrders(n, seededRng(n));
      for (let i = 0; i < n; i++) expect(blue[i]).not.toBe(red[i]);
    }
  });
});

describe("class mode — independent question routes", () => {
  it("teams open the game on different questions", () => {
    const s = startPlaying(createClassState(makeQuestions(10), 20, seededRng()));
    expect(currentQuestion(s, "blue")!.text).not.toBe(currentQuestion(s, "red")!.text);
  });

  it("blue advancing does NOT change red's current question (and vice versa)", () => {
    let s = startPlaying(createClassState(makeQuestions(10), 20, seededRng()));
    const redQBefore = currentQuestion(s, "red");
    const redStateBefore = s.teams.red;

    // Blue answers correctly and moves through its feedback window.
    s = classReducer(s, { type: "answer", team: "blue", index: currentQuestion(s, "blue")!.correct });
    expect(s.teams.red).toBe(redStateBefore); // same object — untouched
    s = classReducer(s, { type: "tick" });
    s = classReducer(s, { type: "tick" });
    expect(s.teams.blue.qIndex).toBe(1);
    expect(currentQuestion(s, "red")).toBe(redQBefore);

    // Symmetric: red answers, blue's question stays put.
    const blueQBefore = currentQuestion(s, "blue");
    s = classReducer(s, { type: "answer", team: "red", index: 0 });
    expect(currentQuestion(s, "blue")).toBe(blueQBefore);
  });

  it("each team can progress at its own pace through ALL questions", () => {
    const n = 6;
    let s = startPlaying(createClassState(makeQuestions(n), 20, seededRng()));
    const seenByBlue: string[] = [];
    // Blue races through its whole route while red never answers.
    let guard = 0;
    while (s.teams.blue.phase !== "exhausted" && guard++ < 50) {
      const q = currentQuestion(s, "blue")!;
      seenByBlue.push(q.text);
      s = classReducer(s, { type: "answer", team: "blue", index: q.correct });
      s = classReducer(s, { type: "tick" });
      s = classReducer(s, { type: "tick" });
    }
    // Blue saw every question exactly once; red is still on its first.
    expect([...seenByBlue].sort()).toEqual(makeQuestions(n).map((q) => q.text).sort());
    expect(s.teams.red.qIndex).toBeLessThanOrEqual(2); // only moved by its own timeouts
  });

  it("rope-wall win ends the game immediately", () => {
    let s = startPlaying(createClassState(makeQuestions(30), 20, seededRng()));
    let guard = 0;
    while (s.status === "playing" && guard++ < 80) {
      const q = currentQuestion(s, "blue");
      if (!q) break;
      s = classReducer(s, { type: "answer", team: "blue", index: q.correct });
      s = classReducer(s, { type: "tick" });
      s = classReducer(s, { type: "tick" });
    }
    expect(s.status).toBe("finished");
    expect(s.winner).toBe("blue");
    expect(s.winKind).toBe("rope");
    expect(s.rope).toBe(0);
  });

  it("when both routes are exhausted, the rope side decides the winner", () => {
    let s = startPlaying(createClassState(makeQuestions(4), 20, seededRng()));
    let guard = 0;
    while (s.status === "playing" && guard++ < 60) {
      const qb = currentQuestion(s, "blue");
      const qr = currentQuestion(s, "red");
      if (qb && s.teams.blue.phase === "question")
        s = classReducer(s, { type: "answer", team: "blue", index: qb.correct });
      if (qr && s.teams.red.phase === "question")
        s = classReducer(s, { type: "answer", team: "red", index: (qr.correct + 1) % 4 });
      s = classReducer(s, { type: "tick" });
      s = classReducer(s, { type: "tick" });
    }
    expect(s.status).toBe("finished");
    expect(s.winner).toBe("blue");
    expect(s.winKind).toBe("exhausted");
  });

  it("double answers and wrong answers never move the rope", () => {
    let s = startPlaying(createClassState(makeQuestions(10), 20, seededRng()));
    const q = currentQuestion(s, "blue")!;
    const wrong = (q.correct + 1) % 4;
    s = classReducer(s, { type: "answer", team: "blue", index: wrong });
    expect(s.rope).toBe(50);
    const after = classReducer(s, { type: "answer", team: "blue", index: q.correct });
    expect(after).toBe(s); // ignored during feedback
  });
});
