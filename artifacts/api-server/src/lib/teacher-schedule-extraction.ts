import { z } from "zod";

const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const extractedLessonSchema = z.object({
  lessonNumber: z.number().int().min(1).max(10),
  title: z.string().trim().max(160).default(""),
  subject: z.string().trim().max(100).nullish(),
  className: z.string().trim().max(100).nullish(),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern).nullish(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
}).superRefine((lesson, ctx) => {
  if (lesson.endTime && lesson.endTime <= lesson.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "وقت نهاية الحصة يجب أن يكون بعد وقت البداية",
    });
  }
});

const extractedScheduleSchema = z.object({
  daySchedules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    lessons: z.array(extractedLessonSchema).min(1).max(10),
  })).min(1).max(7),
  warnings: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
}).superRefine((value, ctx) => {
  if (new Set(value.daySchedules.map((day) => day.dayOfWeek)).size !== value.daySchedules.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["daySchedules"], message: "تكرر اليوم في نتيجة الاستخراج" });
  }
  value.daySchedules.forEach((day, dayIndex) => {
    if (new Set(day.lessons.map((lesson) => lesson.lessonNumber)).size !== day.lessons.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daySchedules", dayIndex, "lessons"],
        message: "تكرر رقم الحصة في اليوم نفسه",
      });
    }
  });
});

export type ExtractedTeacherSchedule = z.infer<typeof extractedScheduleSchema>;

const arabicDigitMap: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

function parseLooseTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => arabicDigitMap[digit])
    .trim()
    .toLowerCase();
  const match = normalized.match(/^(\d{1,2}):([0-5]\d)\s*(am|pm|ص|م)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const marker = match[3];
  if (hour > 23 || (marker && hour > 12)) return null;
  if ((marker === "pm" || marker === "م") && hour < 12) hour += 12;
  if ((marker === "am" || marker === "ص") && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function normalizeSchoolDayTimes(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const root = parsed as { daySchedules?: unknown[] };
  if (!Array.isArray(root.daySchedules)) return parsed;

  root.daySchedules.forEach((dayValue) => {
    if (!dayValue || typeof dayValue !== "object") return;
    const day = dayValue as { lessons?: unknown[] };
    if (!Array.isArray(day.lessons)) return;

    const ordered = [...day.lessons].sort((left, right) => {
      const leftNumber = Number((left as { lessonNumber?: unknown })?.lessonNumber);
      const rightNumber = Number((right as { lessonNumber?: unknown })?.lessonNumber);
      return leftNumber - rightNumber;
    });
    let previousStart: number | null = null;

    ordered.forEach((lessonValue) => {
      if (!lessonValue || typeof lessonValue !== "object") return;
      const lesson = lessonValue as {
        startTime?: unknown;
        endTime?: unknown;
        confidence?: unknown;
      };
      let start = parseLooseTime(lesson.startTime);
      let end = parseLooseTime(lesson.endTime);
      let adjusted = false;

      if (start !== null && previousStart !== null && start < previousStart) {
        const afternoonStart = start + 12 * 60;
        if (afternoonStart <= 23 * 60 + 59 && afternoonStart > previousStart) {
          start = afternoonStart;
          adjusted = true;
        }
      }
      if (start !== null) {
        lesson.startTime = formatTime(start);
        previousStart = start;
      }
      if (end !== null && start !== null && end <= start) {
        const afternoonEnd = end + 12 * 60;
        if (afternoonEnd <= 23 * 60 + 59 && afternoonEnd > start) {
          end = afternoonEnd;
        } else {
          end = null;
          lesson.endTime = null;
        }
        adjusted = true;
      }
      if (end !== null) lesson.endTime = formatTime(end);
      if (adjusted) lesson.confidence = "low";
    });
  });

  return parsed;
}

export function buildTeacherScheduleExtractionPrompt(language: "ar" | "en"): string {
  const outputLanguage = language === "ar" ? "Arabic" : "English";
  return `Analyze the attached image as a teacher's weekly school timetable.

Return ONLY valid JSON with this exact shape:
{
  "daySchedules": [
    {
      "dayOfWeek": 0,
      "lessons": [
        {
          "lessonNumber": 1,
          "title": "",
          "subject": "Mathematics",
          "className": "Grade 5 A",
          "startTime": "08:00",
          "endTime": "08:45",
          "confidence": "high"
        }
      ]
    }
  ],
  "warnings": []
}

Rules:
- dayOfWeek MUST use: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6.
- Include only days and lessons visibly present in the image.
- lessonNumber must be 1 through 10 and unique within each day.
- Times must use 24-hour HH:mm. Infer a time only when the table clearly establishes a shared period time; otherwise omit that lesson and add a warning.
- Put the subject name in subject. Put grade/section in className. Use title only for a distinct lesson label not already represented by subject.
- If one cell contains multiple classes, preserve its visible text in className rather than inventing separate lessons.
- confidence must be high, medium, or low for each lesson. Use low when text is blurry, partially hidden, or inferred.
- Do not include breaks as lessons. Mention any visible breaks in warnings so the teacher can add them during review.
- Never invent missing days, lessons, subjects, classes, or times.
- Write extracted text and warnings in ${outputLanguage}.
- No markdown fences and no prose outside the JSON.`;
}

export function parseExtractedTeacherSchedule(text: string): ExtractedTeacherSchedule {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
  const parsed = normalizeSchoolDayTimes(JSON.parse(candidate));
  const validated = extractedScheduleSchema.parse(parsed);

  return {
    daySchedules: validated.daySchedules
      .map((day) => ({
        dayOfWeek: day.dayOfWeek,
        lessons: day.lessons
          .map((lesson) => ({
            ...lesson,
            title: lesson.title.trim(),
            subject: lesson.subject?.trim() || null,
            className: lesson.className?.trim() || null,
            endTime: lesson.endTime || null,
          }))
          .sort((left, right) => left.lessonNumber - right.lessonNumber),
      }))
      .sort((left, right) => left.dayOfWeek - right.dayOfWeek),
    warnings: validated.warnings,
  };
}