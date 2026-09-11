import { describe, expect, it } from "vitest";
import {
  buildTeacherScheduleExtractionPrompt,
  parseExtractedTeacherSchedule,
} from "../lib/teacher-schedule-extraction";

describe("teacher schedule image extraction", () => {
  it("normalizes and sorts a valid extracted schedule", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [
        {
          dayOfWeek: 2,
          lessons: [
            {
              lessonNumber: 2,
              title: "",
              subject: " علوم ",
              className: "",
              startTime: "09:00",
              endTime: "09:45",
              confidence: "medium",
            },
            {
              lessonNumber: 1,
              title: "تمهيد",
              subject: "رياضيات",
              className: "5/أ",
              startTime: "08:00",
              endTime: "08:45",
              confidence: "high",
            },
          ],
        },
      ],
      warnings: ["راجع اسم الصف"],
    }));

    expect(result.daySchedules[0].lessons.map((lesson) => lesson.lessonNumber)).toEqual([1, 2]);
    expect(result.daySchedules[0].lessons[1].subject).toBe("علوم");
    expect(result.daySchedules[0].lessons[1].className).toBeNull();
    expect(result.warnings).toEqual(["راجع اسم الصف"]);
  });

  it("accepts JSON inside a markdown fence", () => {
    const result = parseExtractedTeacherSchedule(`\`\`\`json
      {"daySchedules":[{"dayOfWeek":0,"lessons":[{"lessonNumber":1,"title":"","subject":"عربي","className":null,"startTime":"08:00","endTime":"08:45","confidence":"low"}]}],"warnings":[]}
    \`\`\``);
    expect(result.daySchedules[0].dayOfWeek).toBe(0);
  });

  it("rejects duplicate lessons and invalid time ranges", () => {
    expect(() => parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 1,
        lessons: [
          { lessonNumber: 1, title: "", subject: "أ", startTime: "09:00", endTime: "08:00", confidence: "high" },
          { lessonNumber: 1, title: "", subject: "ب", startTime: "10:00", endTime: "11:00", confidence: "high" },
        ],
      }],
      warnings: [],
    }))).toThrow();
  });

  it("pins the weekday mapping and forbids invented values in the prompt", () => {
    const prompt = buildTeacherScheduleExtractionPrompt("ar");
    expect(prompt).toContain("Sunday=0");
    expect(prompt).toContain("Never invent");
    expect(prompt).toContain("Do not include breaks as lessons");
  });
});