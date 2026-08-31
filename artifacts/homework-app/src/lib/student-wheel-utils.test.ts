import { describe, expect, it } from "vitest";
import {
  ALL_CLASSES_VALUE,
  EXCLUDED_CLASS_PREFIX,
  getWheelVisualSliceIndex,
  isStudentInSelectedClasses,
} from "./student-wheel-utils";

describe("getWheelVisualSliceIndex", () => {
  it.each([
    [48, 49, 48, 47],
    [49, 50, 48, 47],
    [250, 500, 48, 24],
    [499, 500, 48, 47],
  ])(
    "maps participant %i of %i to proportional visual slice %i",
    (participantIndex, participantCount, visualSliceCount, expected) => {
      expect(
        getWheelVisualSliceIndex(participantIndex, participantCount, visualSliceCount),
      ).toBe(expected);
    },
  );
});

describe("isStudentInSelectedClasses", () => {
  it("matches either the student's class or grade in explicit selections", () => {
    expect(isStudentInSelectedClasses("الأول أ", "الصف الأول", ["الصف الأول"])).toBe(true);
    expect(isStudentInSelectedClasses("الأول أ", "الصف الأول", ["الأول أ"])).toBe(true);
  });

  it("excludes either a class or grade while all classes remain selected", () => {
    const allExceptGrade = [ALL_CLASSES_VALUE, `${EXCLUDED_CLASS_PREFIX}الصف الأول`];
    const allExceptClass = [ALL_CLASSES_VALUE, `${EXCLUDED_CLASS_PREFIX}الأول أ`];

    expect(isStudentInSelectedClasses("الأول أ", "الصف الأول", allExceptGrade)).toBe(false);
    expect(isStudentInSelectedClasses("الأول أ", "الصف الأول", allExceptClass)).toBe(false);
    expect(isStudentInSelectedClasses("الثاني أ", "الصف الثاني", allExceptGrade)).toBe(true);
  });
});