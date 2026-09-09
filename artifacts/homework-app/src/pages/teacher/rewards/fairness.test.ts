import { describe, expect, it } from "vitest";
import { selectFairnessStudent } from "./fairness";

describe("selectFairnessStudent", () => {
  it("prefers the lowest-point student who has not been recognised", () => {
    const students = [
      { id: 1, points: 1, recognizedThisWeek: true },
      { id: 2, points: 5, recognizedThisWeek: false },
      { id: 3, points: 2, recognizedThisWeek: false },
    ];

    expect(selectFairnessStudent(students, () => 0)?.id).toBe(3);
  });

  it("uses the supplied random source only to break a tie", () => {
    const students = [
      { id: 1, points: 2, recognizedThisWeek: false },
      { id: 2, points: 2, recognizedThisWeek: false },
    ];

    expect(selectFairnessStudent(students, () => 0.99)?.id).toBe(2);
  });

  it("returns undefined for an empty class", () => {
    expect(selectFairnessStudent([])).toBeUndefined();
  });
});