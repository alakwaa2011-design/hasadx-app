import { describe, expect, it } from "vitest";
import {
  chooseNextRocketQuestion,
  ROCKET_WRONG_RETRY_GAP,
  scheduleRocketQuestionRetry,
} from "../game/rocket-question-flow";

describe("rocket question flow", () => {
  it("moves away from a wrong question and delays its retry", () => {
    const retryQueue = scheduleRocketQuestionRetry([], 0, 0);
    expect(retryQueue).toEqual([
      { index: 0, eligibleAfter: ROCKET_WRONG_RETRY_GAP + 1 },
    ]);

    const next = chooseNextRocketQuestion({
      totalQuestions: 5,
      currentQuestionIndex: 0,
      totalAnswered: 1,
      clearedIndices: new Set(),
      retryQueue,
      recentQuestionIndices: [0],
      rng: () => 0,
    });

    expect(next.questionIndex).toBe(1);
    expect(next.retryQueue).toEqual(retryQueue);
  });

  it("reintroduces a wrong question after three intervening answers", () => {
    const retryQueue = scheduleRocketQuestionRetry([], 0, 0);
    const next = chooseNextRocketQuestion({
      totalQuestions: 5,
      currentQuestionIndex: 3,
      totalAnswered: 4,
      clearedIndices: new Set([1, 2, 3]),
      retryQueue,
      recentQuestionIndices: [2, 3],
      rng: () => 0,
    });

    expect(next.questionIndex).toBe(0);
    expect(next.retryQueue).toEqual([]);
  });

  it("randomizes fresh questions while avoiding the current and recent ones", () => {
    const next = chooseNextRocketQuestion({
      totalQuestions: 6,
      currentQuestionIndex: 2,
      totalAnswered: 3,
      clearedIndices: new Set([0]),
      retryQueue: [],
      recentQuestionIndices: [1, 2],
      rng: () => 0.99,
    });

    expect(next.questionIndex).toBe(5);
  });

  it("falls back safely when the game has only one question", () => {
    const next = chooseNextRocketQuestion({
      totalQuestions: 1,
      currentQuestionIndex: 0,
      totalAnswered: 1,
      clearedIndices: new Set(),
      retryQueue: scheduleRocketQuestionRetry([], 0, 0),
      recentQuestionIndices: [0],
    });

    expect(next.questionIndex).toBe(0);
  });

  it("preserves the retry gap with two questions by repeating the safe question", () => {
    const retryQueue = scheduleRocketQuestionRetry([], 0, 0);
    const next = chooseNextRocketQuestion({
      totalQuestions: 2,
      currentQuestionIndex: 1,
      totalAnswered: 2,
      clearedIndices: new Set([1]),
      retryQueue,
      recentQuestionIndices: [0, 1],
      rng: () => 0,
    });

    expect(next.questionIndex).toBe(1);
    expect(next.retryQueue).toEqual(retryQueue);
  });

  it("preserves the retry gap with three questions after the other questions are used", () => {
    const retryQueue = scheduleRocketQuestionRetry([], 0, 0);
    const next = chooseNextRocketQuestion({
      totalQuestions: 3,
      currentQuestionIndex: 2,
      totalAnswered: 3,
      clearedIndices: new Set([1, 2]),
      retryQueue,
      recentQuestionIndices: [1, 2],
      rng: () => 0,
    });

    expect(next.questionIndex).toBe(1);
    expect(next.retryQueue).toEqual(retryQueue);
  });
});