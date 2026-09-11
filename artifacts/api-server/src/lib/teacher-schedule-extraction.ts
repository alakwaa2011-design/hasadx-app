import { z } from "zod";

const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const extractedLessonSchema = z.object({
  lessonNumber: z.number().int().min(1).max(30),
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

const extractedBreakSchema = z.object({
  title: z.string().trim().min(1).max(160),
  breakAfterLesson: z.number().int().min(0).max(30),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern).nullish(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
}).superRefine((entry, ctx) => {
  if (entry.endTime && entry.endTime <= entry.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "وقت نهاية الفترة يجب أن يكون بعد وقت البداية",
    });
  }
});

const extractedScheduleSchema = z.object({
  daySchedules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    lessons: z.array(extractedLessonSchema).max(30).default([]),
    breaks: z.array(extractedBreakSchema).max(50).default([]),
  })).min(1).max(7),
  warnings: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
}).superRefine((value, ctx) => {
  if (new Set(value.daySchedules.map((day) => day.dayOfWeek)).size !== value.daySchedules.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["daySchedules"], message: "تكرر اليوم في نتيجة الاستخراج" });
  }
  value.daySchedules.forEach((day, dayIndex) => {
    if (day.lessons.length === 0 && day.breaks.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daySchedules", dayIndex],
        message: "يجب أن يحتوي اليوم على فترة واحدة على الأقل",
      });
    }
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

    day.lessons.forEach((lessonValue) => {
      if (!lessonValue || typeof lessonValue !== "object") return;
      const lesson = lessonValue as {
        startTime?: unknown;
        endTime?: unknown;
        confidence?: unknown;
      };
      let start = parseLooseTime(lesson.startTime);
      let end = parseLooseTime(lesson.endTime);
      let adjusted = false;

      if (start !== null) {
        lesson.startTime = formatTime(start);
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

    const breaks = (dayValue as { breaks?: unknown[] }).breaks;
    if (Array.isArray(breaks)) {
      breaks.forEach((breakValue) => {
        if (!breakValue || typeof breakValue !== "object") return;
        const entry = breakValue as { startTime?: unknown; endTime?: unknown; confidence?: unknown };
        const start = parseLooseTime(entry.startTime);
        let end = parseLooseTime(entry.endTime);
        let adjusted = false;
        if (start !== null) entry.startTime = formatTime(start);
        if (end !== null && start !== null && end <= start) {
          const afternoonEnd = end + 12 * 60;
          end = afternoonEnd <= 23 * 60 + 59 && afternoonEnd > start ? afternoonEnd : null;
          adjusted = true;
        }
        entry.endTime = end === null ? null : formatTime(end);
        if (adjusted) entry.confidence = "low";
      });
    }
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
          "title": "Grade 5 A - Mathematics",
          "subject": "Mathematics",
          "className": "Grade 5 A",
          "startTime": "08:00",
          "endTime": "08:45",
          "confidence": "high"
        }
      ],
      "breaks": [
        {
          "title": "Morning assembly",
          "breakAfterLesson": 4,
          "startTime": "10:45",
          "endTime": "11:05",
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
- lessonNumber is the lesson number written in the image, from 1 through 30, and must remain unique within each day.
- Times must use 24-hour HH:mm. Infer a time only when the table clearly establishes a shared period time; otherwise omit that lesson and add a warning.
- For every numbered lesson, copy the primary cell text into title EXACTLY as written in the image; do not replace it with a generic lesson label.
- Put subject and grade/section in subject and className only when they are separately visible, without changing or translating the original title.
- If one cell contains multiple classes, preserve its visible text in className rather than inventing separate lessons.
- confidence must be high, medium, or low for each lesson. Use low when text is blurry, partially hidden, or inferred.
- Extract every visible non-lesson period into breaks, including prayer, duty, assembly, meeting, professional development, recess, or snack.
- Preserve each period title EXACTLY as written in the image. Never replace it with a generic label such as Break or Snack.
- breakAfterLesson identifies the closest numbered lesson before the period; use 0 when it appears before the first numbered lesson.
- Multiple non-lesson periods may share the same breakAfterLesson. Keep all of them and preserve their chronological order through startTime.
- Do not force lesson numbers or non-lesson periods into a standard school order. Follow the source image exactly.
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
          .sort((left, right) => left.startTime.localeCompare(right.startTime)),
        breaks: day.breaks
          .map((entry) => ({
            ...entry,
            title: entry.title.trim(),
            endTime: entry.endTime || null,
          }))
          .sort((left, right) => left.startTime.localeCompare(right.startTime)),
      }))
      .sort((left, right) => left.dayOfWeek - right.dayOfWeek),
    warnings: validated.warnings,
  };
}