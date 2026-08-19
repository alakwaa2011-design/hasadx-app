import { afterEach, describe, expect, it } from "vitest";
import {
  createGame,
  deleteGame,
  setGiftRoundInterval,
  shouldStartGiftRound,
  type Game,
  type GameQuestion,
} from "../game/manager";

const createdPins: string[] = [];

function makeGame(): Game {
  const questions = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    text: `Question ${index + 1}`,
    questionType: "mcq",
    optionA: "A",
    optionB: "B",
    correctAnswer: "A",
  })) as GameQuestion[];

  const game = createGame(1, "اختبار الهدايا", "teacher-socket", 1, questions);
  createdPins.push(game.pin);
  return game;
}

afterEach(() => {
  while (createdPins.length) deleteGame(createdPins.pop()!);
});

describe("Gift round intervals", () => {
  it("keeps the existing three-question interval by default", () => {
    const game = makeGame();

    game.currentQuestionIndex = 0;
    expect(shouldStartGiftRound(game)).toBe(false);
    game.currentQuestionIndex = 1;
    expect(shouldStartGiftRound(game)).toBe(false);
    game.currentQuestionIndex = 2;
    expect(shouldStartGiftRound(game)).toBe(true);
  });

  it("starts a round after each question when the teacher selects one", () => {
    const game = makeGame();

    expect(setGiftRoundInterval(game.pin, 1)).toBe(true);
    game.currentQuestionIndex = 0;
    expect(shouldStartGiftRound(game)).toBe(true);
    game.currentQuestionIndex = 3;
    expect(shouldStartGiftRound(game)).toBe(true);
  });

  it("rejects unsupported intervals and keeps the game on the selected value", () => {
    const game = makeGame();

    expect(setGiftRoundInterval(game.pin, 2)).toBe(false);
    expect(game.giftRoundInterval).toBe(3);
  });
});