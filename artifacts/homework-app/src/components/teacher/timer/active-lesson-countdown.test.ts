import { describe, expect, it } from "vitest";
import type { TeacherScheduleEntry } from "@workspace/api-client-react";
import { selectVisibleScheduleEntry } from "./active-lesson-countdown";

function appointment(
  id: number,
  appointmentDate: string,
  startTime: string,
  endTime: string | null,
): TeacherScheduleEntry {
  return {
    id,
    kind: "appointment",
    title: `Appointment ${id}`,
    subject: null,
    className: null,
    dayOfWeek: null,
    lessonNumber: null,
    breakAfterLesson: null,
    appointmentDate,
    startTime,
    endTime,
    location: null,
    notes: null,
  };
}

describe("schedule appointment countdown", () => {
  it("shows today's appointment during its configured pre-alert window", () => {
    const result = selectVisibleScheduleEntry(
      [appointment(1, "2026-09-11", "10:00", "11:00")],
      new Date(2026, 8, 11, 9, 55),
      5,
    );

    expect(result.visibleEntry?.id).toBe(1);
    expect(result.isBeforeStart).toBe(true);
  });

  it("counts down an active appointment until its end time", () => {
    const result = selectVisibleScheduleEntry(
      [appointment(2, "2026-09-11", "10:00", "11:00")],
      new Date(2026, 8, 11, 10, 20),
      5,
    );

    expect(result.visibleEntry?.id).toBe(2);
    expect(result.isBeforeStart).toBe(false);
  });

  it("does not show an appointment from another date", () => {
    const result = selectVisibleScheduleEntry(
      [appointment(3, "2026-09-12", "10:00", "11:00")],
      new Date(2026, 8, 11, 9, 55),
      10,
    );

    expect(result.visibleEntry).toBeNull();
  });

  it("can alert before an appointment that has no end time", () => {
    const result = selectVisibleScheduleEntry(
      [appointment(4, "2026-09-11", "10:00", null)],
      new Date(2026, 8, 11, 9, 58),
      5,
    );

    expect(result.visibleEntry?.id).toBe(4);
    expect(result.isBeforeStart).toBe(true);
  });
});