import { describe, expect, it } from "vitest";
import {
  createWameethClassState,
  wameethClassReducer,
  type WameethClassState,
} from "./wameeth-class-engine";

const questions = Array.from({ length: 4 }, (_, index) => ({
  text: `Question ${index + 1}`,
  options: ["Correct", "Wrong"],
  correct: 0,
}));

function startWithCadence(giftEveryCorrect: 1 | 2 | 3): WameethClassState {
  let state = createWameethClassState(questions, 20, {
    giftsEnabled: true,
    giftEveryCorrect,
    rng: () => 0.5,
  });
  state = wameethClassReducer(state, { type: "start" });
  state = wameethClassReducer(state, { type: "tick" });
  state = wameethClassReducer(state, { type: "tick" });
  return wameethClassReducer(state, { type: "tick" });
}

function answerCorrectAndAdvance(state: WameethClassState): WameethClassState {
  const team = "blue" as const;
  const question = state.questions[state.teams[team].questionOrder[state.teams[team].qIndex]];
  let next = wameethClassReducer(state, { type: "answer", team, index: question.correct });
  next = wameethClassReducer(next, { type: "tick" });
  return wameethClassReducer(next, { type: "tick" });
}

describe("Wameeth Class gift cadence", () => {
  it.each([1, 2, 3] as const)(
    "awards a box after %i correct answer(s)",
    (giftEveryCorrect) => {
      let state = startWithCadence(giftEveryCorrect);

      for (let i = 1; i <= giftEveryCorrect; i += 1) {
        state = answerCorrectAndAdvance(state);
        expect(state.teams.blue.gifts).toHaveLength(i === giftEveryCorrect ? 1 : 0);
      }

      expect(state.teams.blue.correctSinceGift).toBe(0);
    },
  );

  it("does not count correct answers while gifts are disabled", () => {
    let state = createWameethClassState(questions, 20, {
      giftsEnabled: false,
      giftEveryCorrect: 1,
      rng: () => 0.5,
    });
    state = wameethClassReducer(state, { type: "start" });
    state = wameethClassReducer(state, { type: "tick" });
    state = wameethClassReducer(state, { type: "tick" });
    state = wameethClassReducer(state, { type: "tick" });

    state = answerCorrectAndAdvance(state);

    expect(state.teams.blue.gifts).toHaveLength(0);
    expect(state.teams.blue.correctSinceGift).toBe(0);
  });
});