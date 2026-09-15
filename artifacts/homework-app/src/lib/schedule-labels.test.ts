import { describe, expect, it } from "vitest";
import {
  buildTeacherScheduleBulkInput,
  getApiErrorMessage,
  normalizeImportedDaySchedules,
  scheduleConflictMessage,
  type ExtractedScheduleDay,
} from "./schedule-labels";

describe("schedule image detail preservation", () => {
  it("keeps both halves of a double period and forwards all extracted details", () => {
    const extracted: ExtractedScheduleDay[] = [{
      dayOfWeek: 0,
      lessons: [
        {
          lessonNumber: 1,
          title: "MATHEMATICS LAB",
          subject: "MATHEMATICS",
          className: "GRADE 5A + GRADE 5B",
          location: "ROOM 204",
          notes: "TEACHER AHMED — BRING GEOMETRY KIT",
          startTime: "07:30",
          endTime: "08:10",
          confidence: "high",
        },
        {
          lessonNumber: 2,
          title: "MATHEMATICS LAB",
          subject: "MATHEMATICS",
          className: "GRADE 5A + GRADE 5B",
          location: "ROOM 204",
          notes: "TEACHER AHMED — BRING GEOMETRY KIT",
          startTime: "08:10",
          endTime: "08:50",
          confidence: "high",
        },
      ],
      breaks: [{
        title: "ASSEMBLY",
        breakAfterLesson: 2,
        location: "MAIN HALL",
        notes: "FULL SCHOOL",
        startTime: "08:50",
        endTime: "09:10",
        confidence: "high",
      }],
    }];

    const normalized = normalizeImportedDaySchedules(extracted);
    const payload = buildTeacherScheduleBulkInput(
      normalized.schedules,
      false,
      normalized.breaks,
    );

    expect(payload.daySchedules?.[0].lessons).toEqual([
      expect.objectContaining({
        lessonNumber: 1,
        location: "ROOM 204",
        notes: "TEACHER AHMED — BRING GEOMETRY KIT",
        startTime: "07:30",
        endTime: "08:10",
      }),
      expect.objectContaining({
        lessonNumber: 2,
        location: "ROOM 204",
        notes: "TEACHER AHMED — BRING GEOMETRY KIT",
        startTime: "08:10",
        endTime: "08:50",
      }),
    ]);
    expect(payload.daySchedules?.[0].breaks).toEqual([
      expect.objectContaining({
        title: "ASSEMBLY",
        location: "MAIN HALL",
        notes: "FULL SCHOOL",
      }),
    ]);
  });
});

describe("schedule save errors", () => {
  it("shows the conflicting entry and time in Arabic", () => {
    expect(scheduleConflictMessage({
      conflictingTitle: "علوم",
      conflictingStartTime: "08:00",
      conflictingEndTime: "08:45",
    }, true)).toBe("يتعارض مع «علوم» (08:00–08:45)");
  });

  it("recovers a useful server message from an API error message", () => {
    expect(getApiErrorMessage(
      new Error("HTTP 400 Bad Request: وقت النهاية يجب أن يكون بعد وقت البداية"),
    )).toBe("وقت النهاية يجب أن يكون بعد وقت البداية");
  });
});