import { describe, expect, it } from "vitest";
import {
  buildTeacherScheduleBulkInput,
  emptyBulkLessons,
  isEmptyBulkLessonDraft,
} from "./schedule-labels";

describe("teacher weekly schedule slots", () => {
  it("starts with nine genuinely empty slots rather than midnight lessons", () => {
    const slots = emptyBulkLessons();
    expect(slots).toHaveLength(9);
    expect(slots.map((slot) => slot.lessonNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(slots.every((slot) => isEmptyBulkLessonDraft(slot) && !slot.startTime && !slot.endTime)).toBe(true);
  });

  it("saves entered lessons at their original numbers without filling free slots or days", () => {
    const sunday = emptyBulkLessons(10);
    sunday[0] = { ...sunday[0], title: "رياضيات", className: "الخامس", startTime: "08:10", endTime: "08:55" };
    sunday[2] = { ...sunday[2], title: "لغة عربية", className: "الخامس", startTime: "10:05", endTime: "10:50" };
    const payload = buildTeacherScheduleBulkInput({ 0: sunday, 1: emptyBulkLessons() }, true);
    expect(payload.daySchedules).toHaveLength(1);
    expect(payload.daySchedules?.[0].lessons.map((lesson) => lesson.lessonNumber)).toEqual([1, 3]);
    expect(payload.daySchedules?.[0].lessons.map((lesson) => [lesson.startTime, lesson.endTime]))
      .toEqual([["08:10", "08:55"], ["10:05", "10:50"]]);
  });

  it("keeps uncertain image rows for mandatory review rather than treating them as free", () => {
    const [imported] = emptyBulkLessons(1);
    const uncertain = { ...imported, lessonNumber: 7, confidence: "low" as const };
    expect(isEmptyBulkLessonDraft(uncertain)).toBe(false);
    const payload = buildTeacherScheduleBulkInput({ 3: [uncertain] }, true);
    expect(payload.daySchedules?.[0].lessons[0].lessonNumber).toBe(7);
  });

  it("preserves a named break even on a day without lessons", () => {
    const payload = buildTeacherScheduleBulkInput(
      { 0: emptyBulkLessons() },
      true,
      { 0: [{ title: "استراحة", breakAfterLesson: 4, startTime: "10:50", endTime: "11:05", confidence: "high" }] },
    );
    expect(payload.daySchedules).toHaveLength(1);
    expect(payload.daySchedules?.[0].lessons).toHaveLength(0);
    expect(payload.daySchedules?.[0].breaks?.[0]).toMatchObject({ title: "استراحة", breakAfterLesson: 4 });
  });
});