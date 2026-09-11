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

  it("normalizes a school day crossing noon from 12-hour model output", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 0,
        lessons: [
          { lessonNumber: 6, title: "", subject: "رياضيات", startTime: "١١:٤٠", endTime: "12:25", confidence: "high" },
          { lessonNumber: 7, title: "", subject: "علوم", startTime: "12:25", endTime: "1:10", confidence: "high" },
          { lessonNumber: 8, title: "", subject: "لغة عربية", startTime: "1:10", endTime: "1:55", confidence: "high" },
        ],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].lessons).toEqual([
      expect.objectContaining({ lessonNumber: 6, startTime: "11:40", endTime: "12:25", confidence: "high" }),
      expect.objectContaining({ lessonNumber: 7, startTime: "12:25", endTime: "13:10", confidence: "low" }),
      expect.objectContaining({ lessonNumber: 8, startTime: "13:10", endTime: "13:55", confidence: "low" }),
    ]);
  });

  it("keeps a readable draft when a late lesson end time is ambiguous", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 1,
        lessons: [
          { lessonNumber: 7, title: "", subject: "علوم", startTime: "18:25", endTime: "07:10", confidence: "high" },
          { lessonNumber: 8, title: "", subject: "لغة عربية", startTime: "7:10", endTime: "8:00", confidence: "high" },
        ],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].lessons).toEqual([
      expect.objectContaining({ lessonNumber: 7, startTime: "18:25", endTime: "19:10", confidence: "low" }),
      expect.objectContaining({ lessonNumber: 8, startTime: "19:10", endTime: "20:00", confidence: "low" }),
    ]);
  });

  it("pins the weekday mapping and forbids invented values in the prompt", () => {
    const prompt = buildTeacherScheduleExtractionPrompt("ar");
    expect(prompt).toContain("Sunday=0");
    expect(prompt).toContain("Never invent");
    expect(prompt).toContain("Do not include breaks as lessons");
  });
});