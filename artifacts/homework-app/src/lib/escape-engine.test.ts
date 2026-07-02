import { describe, it, expect } from "vitest";
import {
  buildLocks, createEscapeState, currentQuestion, escapeProgress,
  escapeReducer, escapeScore, revealedCode, ESCAPE_PENALTY,
  type EscapeQuestion, type EscapeState,
} from "./escape-engine";

const q = (i: number, correct = 0): EscapeQuestion => ({
  text: `Q${i}`,
  options: ["a", "b", "c", "d"],
  correct,
});

const makeQuestions = (n: number) => Array.from({ length: n }, (_, i) => q(i));

// Deterministic rng: always 0.5 → every lock digit is 5.
const rng = () => 0.5;

function fresh(n = 8, locks = 4, time = 300, hints = 2): EscapeState {
  const s = createEscapeState(
    { questions: makeQuestions(n), totalTime: time, lockCount: locks, hints },
    rng,
  );
  return escapeReducer(s, { type: "start" });
}

/** Answer the current question correctly and flush the feedback tick. */
function solveOne(s: EscapeState): EscapeState {
  const cq = currentQuestion(s);
  if (!cq) throw new Error("no current question");
  let next = escapeReducer(s, { type: "answer", index: cq.correct });
  // Correct feedback lasts 1s → one tick lands on the next phase.
  next = escapeReducer(next, { type: "tick" });
  return next;
}

describe("buildLocks", () => {
  it("distributes all questions across locks with the vault last", () => {
    const locks = buildLocks(10, 4, rng);
    expect(locks).toHaveLength(4);
    expect(locks[locks.length - 1].type).toBe("vault");
    const all = locks.flatMap((l) => l.questionIdxs);
    expect(all).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("never creates more locks than questions", () => {
    const locks = buildLocks(3, 5, rng);
    expect(locks).toHaveLength(3);
    expect(locks.every((l) => l.questionIdxs.length === 1)).toBe(true);
  });

  it("gives every lock a code digit from the rng", () => {
    const locks = buildLocks(6, 3, rng);
    expect(locks.every((l) => l.digit === 5)).toBe(true);
  });
});

describe("escapeReducer — happy path", () => {
  it("opens a lock after all its questions are solved and reveals its digit", () => {
    let s = fresh(8, 4); // 2 questions per lock
    expect(s.locks[0].questionIdxs).toHaveLength(2);
    s = solveOne(s);
    expect(s.phase).toBe("question");
    expect(s.locks[0].solved).toBe(1);
    s = solveOne(s);
    expect(s.phase).toBe("lock-open");
    expect(s.locks[0].open).toBe(true);
    expect(revealedCode(s)).toEqual([5]);
  });

  it("continue moves to the next lock", () => {
    let s = fresh(8, 4);
    s = solveOne(s);
    s = solveOne(s);
    s = escapeReducer(s, { type: "continue" });
    expect(s.lockIndex).toBe(1);
    expect(s.phase).toBe("question");
    expect(currentQuestion(s)?.text).toBe("Q2");
  });

  it("wins when the final vault opens", () => {
    let s = fresh(4, 2); // 2 locks × 2 questions
    s = solveOne(s); s = solveOne(s);            // lock 0 open
    s = escapeReducer(s, { type: "continue" });
    s = solveOne(s); s = solveOne(s);            // vault open
    expect(s.status).toBe("won");
    expect(escapeProgress(s)).toBe(1);
    expect(escapeScore(s)).toBeGreaterThan(400 + 500); // 4×100 + win bonus
  });
});

describe("escapeReducer — wrong answers & alarm", () => {
  it("burns the penalty, bumps the alarm and rotates back to the question later", () => {
    let s = fresh(4, 2, 300);
    const cq = currentQuestion(s)!;
    const wrongIdx = (cq.correct + 1) % cq.options.length;
    s = escapeReducer(s, { type: "answer", index: wrongIdx });
    expect(s.correct).toBe(false);
    expect(s.timeLeft).toBe(300 - ESCAPE_PENALTY);
    expect(s.alarmSeq).toBe(1);
    expect(s.wrongCount).toBe(1);
    // Wrong feedback lasts 2s → two ticks to advance.
    s = escapeReducer(s, { type: "tick" });
    s = escapeReducer(s, { type: "tick" });
    expect(s.phase).toBe("question");
    // Lock has 2 questions: after missing Q0 we rotate to Q1.
    expect(currentQuestion(s)?.text).toBe("Q1");
    // Solve Q1 → rotates back to the missed Q0 (lock not open yet).
    s = solveOne(s);
    expect(s.phase).toBe("question");
    expect(currentQuestion(s)?.text).toBe("Q0");
    expect(s.locks[0].open).toBe(false);
  });

  it("loses when the penalty drains the clock", () => {
    let s = fresh(4, 2, ESCAPE_PENALTY); // one alarm = death
    const cq = currentQuestion(s)!;
    s = escapeReducer(s, { type: "answer", index: (cq.correct + 1) % 4 });
    expect(s.status).toBe("lost");
    expect(s.timeLeft).toBe(0);
  });

  it("loses when the timer runs out", () => {
    let s = fresh(4, 2, 2);
    s = escapeReducer(s, { type: "tick" });
    expect(s.status).toBe("playing");
    s = escapeReducer(s, { type: "tick" });
    expect(s.status).toBe("lost");
  });
});

describe("escapeReducer — hints (50/50)", () => {
  it("removes two wrong options and spends a hint", () => {
    let s = fresh(8, 4, 300, 2);
    s = escapeReducer(s, { type: "fifty" });
    expect(s.hintsLeft).toBe(1);
    expect(s.removed).toHaveLength(2);
    expect(s.removed).not.toContain(currentQuestion(s)!.correct);
    // Tapping a removed option is ignored.
    const dead = s.removed[0];
    const after = escapeReducer(s, { type: "answer", index: dead });
    expect(after).toBe(s);
  });

  it("cannot be used twice on the same question or with no hints left", () => {
    let s = fresh(8, 4, 300, 1);
    s = escapeReducer(s, { type: "fifty" });
    const again = escapeReducer(s, { type: "fifty" });
    expect(again).toBe(s);
  });
});

describe("escapeReducer — guards", () => {
  it("ignores answers outside the question phase and double answers", () => {
    let s = fresh();
    const cq = currentQuestion(s)!;
    s = escapeReducer(s, { type: "answer", index: cq.correct });
    const doubled = escapeReducer(s, { type: "answer", index: 0 });
    expect(doubled).toBe(s);
  });

  it("ignores continue outside lock-open and start when already playing", () => {
    const s = fresh();
    expect(escapeReducer(s, { type: "continue" })).toBe(s);
    expect(escapeReducer(s, { type: "start" })).toBe(s);
  });
});
