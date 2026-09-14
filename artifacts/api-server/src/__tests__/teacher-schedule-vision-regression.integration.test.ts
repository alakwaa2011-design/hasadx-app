import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  buildTeacherScheduleExtractionPrompt,
  parseExtractedTeacherSchedule,
} from "../lib/teacher-schedule-extraction";

describe("teacher schedule real-vision regression", () => {
  it("keeps weekday-specific times instead of unifying repeated lesson slots", async () => {
    const fixturePath = fileURLToPath(
      new URL("./fixtures/weekday-specific-times.svg", import.meta.url),
    );
    const png = await sharp(await readFile(fixturePath)).png().toBuffer();
    const { runVisionCompletionMulti } = await import("../lib/file-upload");
    const raw = await runVisionCompletionMulti({
      tier: "standard",
      prompt: buildTeacherScheduleExtractionPrompt("en"),
      images: [{ base64: png.toString("base64"), mimeType: "image/png" }],
      maxTokens: 3000,
    });
    const result = parseExtractedTeacherSchedule(raw);
    const byDay = new Map(result.daySchedules.map((day) => [day.dayOfWeek, day]));
    const sunday = byDay.get(0);
    const monday = byDay.get(1);

    expect(sunday, "Vision extraction omitted Sunday (dayOfWeek=0)").toBeDefined();
    expect(monday, "Vision extraction omitted Monday (dayOfWeek=1)").toBeDefined();

    for (const lessonNumber of [1, 2]) {
      const sundayLesson = sunday?.lessons.find(
        (lesson) => lesson.lessonNumber === lessonNumber,
      );
      const mondayLesson = monday?.lessons.find(
        (lesson) => lesson.lessonNumber === lessonNumber,
      );
      const sundayTime = `${sundayLesson?.startTime}-${sundayLesson?.endTime}`;
      const mondayTime = `${mondayLesson?.startTime}-${mondayLesson?.endTime}`;

      expect(
        sundayTime,
        `Vision model unified lesson ${lessonNumber} across weekdays: Sunday and Monday both returned ${sundayTime}`,
      ).not.toBe(mondayTime);
    }

    expect(sunday?.lessons).toEqual(expect.arrayContaining([
      expect.objectContaining({ lessonNumber: 1, startTime: "07:30", endTime: "08:10" }),
      expect.objectContaining({ lessonNumber: 2, startTime: "08:20", endTime: "09:00" }),
    ]));
    expect(monday?.lessons).toEqual(expect.arrayContaining([
      expect.objectContaining({ lessonNumber: 1, startTime: "09:15", endTime: "10:00" }),
      expect.objectContaining({ lessonNumber: 2, startTime: "10:10", endTime: "10:55" }),
    ]));
  }, 60_000);

  it("splits a visually merged double period and keeps its printed details", async () => {
    const fixturePath = fileURLToPath(
      new URL("./fixtures/double-period-details.svg", import.meta.url),
    );
    const png = await sharp(await readFile(fixturePath)).png().toBuffer();
    const { runVisionCompletionMulti } = await import("../lib/file-upload");
    const raw = await runVisionCompletionMulti({
      tier: "standard",
      prompt: buildTeacherScheduleExtractionPrompt("en"),
      images: [{ base64: png.toString("base64"), mimeType: "image/png" }],
      maxTokens: 4000,
    });
    const result = parseExtractedTeacherSchedule(raw);
    const sunday = result.daySchedules.find((day) => day.dayOfWeek === 0);
    const first = sunday?.lessons.find((lesson) => lesson.lessonNumber === 1);
    const second = sunday?.lessons.find((lesson) => lesson.lessonNumber === 2);

    expect(first, "Merged cell lost lesson 1").toBeDefined();
    expect(second, "Merged cell lost lesson 2").toBeDefined();
    expect(first).toMatchObject({ startTime: "07:30", endTime: "08:10" });
    expect(second).toMatchObject({ startTime: "08:10", endTime: "08:50" });
    for (const lesson of [first, second]) {
      expect(lesson?.title).toContain("MATHEMATICS LAB");
      expect(lesson?.className).toContain("GRADE 5A");
      expect(lesson?.className).toContain("GRADE 5B");
      expect(lesson?.location).toContain("204");
      expect(lesson?.notes).toContain("TEACHER AHMED");
      expect(lesson?.notes).toContain("BRING GEOMETRY KIT");
    }
  }, 60_000);
});