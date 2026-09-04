import { describe, expect, it } from "vitest";
import {
  selectHotSeatRoundQuestions,
  type HotSeatQuestion,
} from "../game/hotseat-handlers";

const preset: Record<string, HotSeatQuestion> = {
  assignment_1: {
    id: "assignment_1",
    text: "ما عاصمة الكويت؟",
    isPreset: true,
    authorUid: "teacher",
    likes: 4,
    likedBy: ["student-1"],
  },
};

describe("Hot Seat question modes", () => {
  it("keeps assignment questions for assignment and mixed rounds", () => {
    expect(Object.keys(selectHotSeatRoundQuestions("assignment", preset))).toEqual(["assignment_1"]);
    expect(Object.keys(selectHotSeatRoundQuestions("mixed", preset))).toEqual(["assignment_1"]);
  });

  it("starts student-only rounds without assignment questions", () => {
    expect(selectHotSeatRoundQuestions("students", preset)).toEqual({});
  });

  it("resets round reactions without mutating the saved assignment questions", () => {
    const roundQuestions = selectHotSeatRoundQuestions("mixed", preset);

    expect(roundQuestions.assignment_1.likes).toBe(0);
    expect(roundQuestions.assignment_1.likedBy).toEqual([]);
    expect(preset.assignment_1.likes).toBe(4);
    expect(preset.assignment_1.likedBy).toEqual(["student-1"]);
  });
});