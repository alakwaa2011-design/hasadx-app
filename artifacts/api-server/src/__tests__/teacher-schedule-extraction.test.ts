import { describe, expect, it } from "vitest";
import {
  buildTeacherScheduleExtractionPrompt,
  parseExtractedTeacherSchedule,
} from "../lib/teacher-schedule-extraction";

describe("teacher schedule image extraction", () => {
  it("normalizes a valid extracted schedule without changing visible labels", () => {
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
          breaks: [{
            title: "ملاحظة إدارية",
            breakAfterLesson: 1,
            startTime: "08:45",
            endTime: "09:00",
            confidence: "high",
          }],
        },
      ],
      warnings: ["راجع اسم الصف"],
    }));

    expect(result.daySchedules[0].lessons.map((lesson) => lesson.lessonNumber)).toEqual([2, 1]);
    expect(result.daySchedules[0].lessons[0].subject).toBe("علوم");
    expect(result.daySchedules[0].lessons[0].className).toBeNull();
    expect(result.daySchedules[0].breaks[0]).toMatchObject({
      title: "ملاحظة إدارية",
      breakAfterLesson: 1,
      startTime: "08:45",
      endTime: "09:00",
    });
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

  it("normalizes Arabic digits while preserving explicit 24-hour times", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 0,
        lessons: [
          { lessonNumber: 6, title: "", subject: "رياضيات", startTime: "١١:٤٠", endTime: "12:25", confidence: "high" },
          { lessonNumber: 7, title: "", subject: "علوم", startTime: "12:25", endTime: "13:10", confidence: "high" },
          { lessonNumber: 8, title: "", subject: "لغة عربية", startTime: "13:10", endTime: "13:55", confidence: "high" },
        ],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].lessons).toEqual([
      expect.objectContaining({ lessonNumber: 6, startTime: "11:40", endTime: "12:25", confidence: "high" }),
      expect.objectContaining({ lessonNumber: 7, startTime: "12:25", endTime: "13:10", confidence: "high" }),
      expect.objectContaining({ lessonNumber: 8, startTime: "13:10", endTime: "13:55", confidence: "high" }),
    ]);
  });

  it("preserves the source order instead of inferring chronology from times", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 1,
        lessons: [
          { lessonNumber: 1, title: "فترة مسائية", startTime: "14:00", endTime: "15:00", confidence: "high" },
          { lessonNumber: 12, title: "فترة صباحية", startTime: "08:00", endTime: "09:00", confidence: "high" },
        ],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].lessons).toEqual([
      expect.objectContaining({ lessonNumber: 1, startTime: "14:00", endTime: "15:00", confidence: "high" }),
      expect.objectContaining({ lessonNumber: 12, startTime: "08:00", endTime: "09:00", confidence: "high" }),
    ]);
  });

  it("preserves more than three visible breaks", () => {
    const breaks = Array.from({ length: 4 }, (_, index) => ({
      title: `استراحة ${index + 1}`,
      breakAfterLesson: index + 1,
      startTime: `${String(9 + index).padStart(2, "0")}:00`,
      endTime: `${String(9 + index).padStart(2, "0")}:10`,
      confidence: "high",
    }));
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 2,
        lessons: [{ lessonNumber: 1, title: "", subject: "رياضيات", startTime: "08:00", endTime: "08:45", confidence: "high" }],
        breaks,
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].breaks).toHaveLength(4);
  });

  it("preserves arbitrary period names and positions beyond lesson nine", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 1,
        lessons: [
          { lessonNumber: 1, title: "صف خامس", startTime: "07:30", endTime: "08:10", confidence: "high" },
          { lessonNumber: 12, title: "مختبر العلوم", startTime: "15:00", endTime: "15:40", confidence: "high" },
        ],
        breaks: [
          { title: "اجتماع القسم", breakAfterLesson: 1, startTime: "08:10", endTime: "08:40", confidence: "high" },
          { title: "فرصة صلاة", breakAfterLesson: 1, startTime: "08:40", endTime: "09:00", confidence: "high" },
          { title: "مناوبة البوابة", breakAfterLesson: 12, startTime: "15:40", endTime: "16:00", confidence: "high" },
        ],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].lessons[1].lessonNumber).toBe(12);
    expect(result.daySchedules[0].breaks.map((entry) => entry.title)).toEqual([
      "اجتماع القسم",
      "فرصة صلاة",
      "مناوبة البوابة",
    ]);
  });

  it("accepts a day made entirely of non-lesson periods", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 4,
        lessons: [],
        breaks: [
          { title: "اجتماع الهيئة التعليمية", breakAfterLesson: 0, startTime: "08:00", endTime: "09:00", confidence: "high" },
          { title: "تطوير مهني", breakAfterLesson: 0, startTime: "09:00", endTime: "11:00", confidence: "high" },
        ],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].lessons).toEqual([]);
    expect(result.daySchedules[0].breaks.map((entry) => entry.title)).toEqual([
      "اجتماع الهيئة التعليمية",
      "تطوير مهني",
    ]);
  });

  it("pins the weekday mapping and forbids invented values in the prompt", () => {
    const prompt = buildTeacherScheduleExtractionPrompt("ar");
    expect(prompt).toContain("Sunday=0");
    expect(prompt).toContain("Never invent");
    expect(prompt).toContain("Extract every visible non-lesson label or phrase");
    expect(prompt).toContain("Preserve each period title EXACTLY as written");
    expect(prompt).toContain("A numbered row or column header is only a timetable position");
    expect(prompt).toContain("RECESS in slot 7 remains a non-lesson entry titled RECESS");
    expect(prompt).toContain('"Assembly Language", "Software Development", and "Prayer Studies" remain lessons');
  });

  it("corrects ADVISE from a numbered lesson into its visible non-lesson period", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 0,
        lessons: [{
          lessonNumber: 1,
          title: "",
          subject: "ADVISE",
          startTime: "07:30",
          endTime: "08:00",
          confidence: "high",
        }],
        breaks: [],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].lessons).toEqual([]);
    expect(result.daySchedules[0].breaks[0]).toMatchObject({
      title: "ADVISE",
      breakAfterLesson: 1,
      startTime: "07:30",
      endTime: "08:00",
    });
  });

  it("keeps the visible slot number when RECESS or PD was misclassified as a lesson", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 0,
        lessons: [
          { lessonNumber: 7, title: "RECESS", startTime: "11:00", endTime: "11:20", confidence: "high" },
          { lessonNumber: 8, title: "PD", startTime: "11:20", endTime: "12:00", confidence: "high" },
        ],
        breaks: [],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].breaks).toEqual([
      expect.objectContaining({ title: "RECESS", breakAfterLesson: 7 }),
      expect.objectContaining({ title: "PD", breakAfterLesson: 8 }),
    ]);
  });

  it("does not reclassify taught courses containing non-lesson keywords", () => {
    const result = parseExtractedTeacherSchedule(JSON.stringify({
      daySchedules: [{
        dayOfWeek: 0,
        lessons: [
          { lessonNumber: 1, title: "Assembly Language", startTime: "08:00", endTime: "09:00", confidence: "high" },
          { lessonNumber: 2, title: "Software Development", startTime: "09:00", endTime: "10:00", confidence: "high" },
          { lessonNumber: 3, title: "Prayer Studies", startTime: "10:00", endTime: "11:00", confidence: "high" },
        ],
        breaks: [],
      }],
      warnings: [],
    }));

    expect(result.daySchedules[0].lessons.map((entry) => entry.title)).toEqual([
      "Assembly Language",
      "Software Development",
      "Prayer Studies",
    ]);
    expect(result.daySchedules[0].breaks).toEqual([]);
  });
});