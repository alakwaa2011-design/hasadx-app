import { z } from "zod";

const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

const extractedLessonSchema = z.object({
  lessonNumber: z.number().int().min(1).max(30),
  title: z.string().trim().max(160).default(""),
  subject: z.string().trim().max(100).nullish(),
  className: z.string().trim().max(100).nullish(),
  location: z.string().trim().max(160).nullish(),
  notes: z.string().trim().max(500).nullish(),
  startTime: z.string().regex(timePattern).nullable().default(null),
  endTime: z.string().regex(timePattern).nullable().default(null),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
}).superRefine((lesson, ctx) => {
  if (lesson.startTime && lesson.endTime && lesson.endTime <= lesson.startTime) {
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
  location: z.string().trim().max(160).nullish(),
  notes: z.string().trim().max(500).nullish(),
  startTime: z.string().regex(timePattern).nullable().default(null),
  endTime: z.string().regex(timePattern).nullable().default(null),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
}).superRefine((entry, ctx) => {
  if (entry.startTime && entry.endTime && entry.endTime <= entry.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "وقت نهاية الفترة يجب أن يكون بعد وقت البداية",
    });
  }
});

const extractedScheduleSchema = z.object({
  readability: z.enum(["readable", "unreadable"]).default("readable"),
  daySchedules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    lessons: z.array(extractedLessonSchema).max(30).default([]),
    breaks: z.array(extractedBreakSchema).max(50).default([]),
  })).max(7),
  warnings: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
}).superRefine((value, ctx) => {
  if (value.readability === "unreadable") {
    if (value.daySchedules.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daySchedules"],
        message: "لا يجوز إرجاع جدول عند تعذر قراءة محاذاة الخلايا",
      });
    }
    if (value.warnings.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warnings"],
        message: "يجب توضيح سبب تعذر قراءة الصورة",
      });
    }
    return;
  }
  if (value.daySchedules.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["daySchedules"],
      message: "يجب أن يحتوي الجدول المقروء على يوم واحد على الأقل",
    });
    return;
  }
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

export class UnreadableTeacherScheduleImageError extends Error {
  readonly warnings: string[];

  constructor(warnings: string[]) {
    super("Teacher schedule image alignment is unreadable");
    this.name = "UnreadableTeacherScheduleImageError";
    this.warnings = warnings;
  }
}

function isClearlyNonLessonLabel(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const exactEnglishLabels = new Set([
    "advise",
    "advisory",
    "snack",
    "recess",
    "break",
    "prayer",
    "prayer break",
    "duty",
    "meeting",
    "assembly",
    "morning assembly",
    "professional development",
    "pd",
  ]);
  if (exactEnglishLabels.has(normalized)) return true;
  if (/^(?:meeting|duty|recess|snack|advisory)\s*[-–—:]\s*.+$/i.test(normalized)) return true;
  return /^(?:اجتماع(?:\s+.+)?|فرصة(?:\s+.+)?|فسحة(?:\s+.+)?|صلاة(?:\s+(?:الظهر|العصر|المغرب|العشاء|الفجر))?|مناوبة(?:\s+.+)?|تطوير مهني(?:\s+.+)?|استراحة(?:\s+.+)?|سناك(?:\s+.+)?|طابور(?:\s+.+)?)$/u.test(normalized);
}

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
  // An unmarked one-digit hour has no reliable half-day. Only accept it when
  // an AM/PM marker makes the conversion explicit; otherwise retain no guess.
  if (marker ? hour < 1 || hour > 12 : match[1].length !== 2 || hour > 23) return null;
  if ((marker === "pm" || marker === "م") && hour < 12) hour += 12;
  if ((marker === "am" || marker === "ص") && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function normalizeSchoolDayTimes(parsed: unknown, language: "ar" | "en"): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const root = parsed as { daySchedules?: unknown[]; warnings?: unknown[] };
  if (!Array.isArray(root.daySchedules)) return parsed;

  root.daySchedules.forEach((dayValue) => {
    if (!dayValue || typeof dayValue !== "object") return;
    const day = dayValue as { dayOfWeek?: unknown; lessons?: unknown[]; breaks?: unknown[] };
    const dayName = language === "ar"
      ? (["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][Number(day.dayOfWeek)] ?? "هذا اليوم")
      : (["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(day.dayOfWeek)] ?? "this day");
    const uncertainPositions = new Set<string>();
    const normalizeEntry = (
      entryValue: unknown,
      position: string,
    ) => {
      if (!entryValue || typeof entryValue !== "object") return;
      const entry = entryValue as { startTime?: unknown; endTime?: unknown };
      const originalStart = entry.startTime;
      const originalEnd = entry.endTime;
      const start = parseLooseTime(originalStart);
      let end = parseLooseTime(originalEnd);
      entry.startTime = start === null ? null : formatTime(start);

      if (end !== null && start !== null && end <= start) {
        // Never choose a different half-day to make the range appear valid.
        end = null;
      }
      entry.endTime = end === null ? null : formatTime(end);
      if (start === null || originalEnd == null || end === null) {
        uncertainPositions.add(language === "ar" ? `الخانة ${position.split(" ").at(-1)}` : position);
      }
    };

    if (Array.isArray(day.lessons)) day.lessons.forEach((lessonValue) => {
      if (!lessonValue || typeof lessonValue !== "object") return;
      const lesson = lessonValue as { lessonNumber?: unknown };
      normalizeEntry(lessonValue, `period ${String(lesson.lessonNumber ?? "?")}`);
    });

    if (Array.isArray(day.breaks)) day.breaks.forEach((breakValue) => {
      if (!breakValue || typeof breakValue !== "object") return;
      const entry = breakValue as { breakAfterLesson?: unknown };
      normalizeEntry(breakValue, `period ${String(entry.breakAfterLesson ?? "?")}`);
    });
    if (uncertainPositions.size > 0) {
      const positions = [...uncertainPositions];
      const displayed = positions.slice(0, 8).join(language === "ar" ? "، " : ", ");
      const remaining = positions.length > 8
        ? (language === "ar" ? ` و${positions.length - 8} خانات أخرى` : ` and ${positions.length - 8} more`)
        : "";
      const warning = language === "ar"
        ? `راجع الأوقات المطبوعة ليوم ${dayName} في ${displayed}${remaining}؛ تُركت الأوقات غير الواضحة فارغة. قارنها بالصورة أو التقط صورة مستقيمة بإضاءة متساوية.`
        : `Review the printed times for ${dayName} ${displayed}${remaining}; unclear times were left blank. Check the source image or retake it straight-on with even lighting.`;
      if (!Array.isArray(root.warnings)) root.warnings = [];
      if (!root.warnings.includes(warning)) root.warnings.push(warning);
    }
  });

  return parsed;
}

export function buildTeacherScheduleExtractionPrompt(language: "ar" | "en"): string {
  const outputLanguage = language === "ar" ? "Arabic" : "English";
  return `Analyze the attached image as a teacher's weekly school timetable.

Return ONLY valid JSON with this exact shape:
{
  "readability": "readable",
  "daySchedules": [
    {
      "dayOfWeek": 0,
      "lessons": [
        {
          "lessonNumber": 1,
          "title": "Grade 5 A - Mathematics",
          "subject": "Mathematics",
          "className": "Grade 5 A",
          "location": "Room 204",
          "notes": "Bring geometry kit",
          "startTime": "08:00",
          "endTime": "08:45",
          "confidence": "high"
        }
      ],
      "breaks": [
        {
          "title": "Morning assembly",
          "breakAfterLesson": 4,
          "location": "Main hall",
          "notes": null,
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
- Set readability to "readable" only when you can reliably align every returned time with BOTH its weekday and lesson/period position.
- If camera angle, perspective distortion, blur, glare, shadow, cropping, or overlapping text makes either coordinate ambiguous, return exactly: {"readability":"unreadable","daySchedules":[],"warnings":["an actionable instruction to retake the photo"]}.
- For an unreadable image, do not reconstruct, standardize, or guess a timetable. The warning must tell the teacher what to fix, such as photographing straight above the full page with even lighting and no shadows.
- dayOfWeek MUST use: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6.
- Include every visible schedule cell, including classes and every other local label or phrase printed in the grid.
- Preserve ALL visible text and details from every cell. Do not omit room/location, teacher name, group, section, activity code, assistant, equipment, instructions, annotations, or any other visible line.
- A numbered row or column header is only a timetable position. It does NOT make the cell a lesson and must never replace the cell text.
- Put a cell in lessons only when the cell itself clearly represents a taught class/course. Put every other cell in breaks, even when it appears under a numbered period header.
- lessonNumber is allowed only for a clearly taught class/course. Any standalone label or phrase that is not clearly a taught class—whether it says ADVISE, RECESS, PD, prayer, duty, meeting, an activity name, a note, or an unfamiliar local term—is a non-lesson period.
- Use the full cell meaning, not keyword matching. Real course names such as "Assembly Language", "Software Development", and "Prayer Studies" remain lessons.
- Treat the image as a fixed grid of cells. Determine each cell's column from its horizontal alignment with the visible header, not from its time, the nearest lesson, or a guessed school-day sequence.
- Read EACH weekday independently from the image. A lesson number or slot number does not imply that its time matches the same slot on another weekday.
- Every startTime and endTime belongs to the specific day cell being extracted. Copy the time aligned with that exact weekday and exact entry.
- Keep each cell's printed period/lesson number exactly, including gaps. If a blank source cell separates periods 2 and 4, the later lesson remains number 4; never compress, renumber, or fill the gap.
- Copy explicit clock values exactly into 24-hour HH:mm. Convert a 12-hour clock only when AM/PM or صباح/مساء is explicitly printed. Never infer morning or afternoon from neighboring periods, another weekday, or chronology.
- If a cell's printed time is missing, unclear, or could refer to either half-day, keep the cell and its exact position but set that time to null. Add an actionable warning asking the teacher to check that cell or provide a clearer image. Do not omit the cell, shift another entry into its position, or guess a replacement time.
- One numbered timetable slot must produce one entry. If one drawn or merged cell spans two or more numbered lesson columns/rows, return a separate lesson entry for EACH covered lesson number, even when the title, subject, class, location, and notes repeat.
- For a merged double period spanning lessons 2 and 3, return lessonNumber 2 and lessonNumber 3 as two lessons. Never combine them into one long lesson and never skip the second number.
- Each entry created from a merged cell uses the startTime and endTime printed for its own numbered slot. Do not use the combined outer time range for both entries.
- NEVER copy, propagate, standardize, or reuse Monday's times for Tuesday, one weekday's times for another weekday, or the first visible day's times for all days.
- When the same lessonNumber has different times on different days, preserve every day's distinct times exactly. Example: Sunday lesson 1 at 08:00 and Monday lesson 1 at 09:15 must remain different.
- A time header may be shared only when the image visibly shows that the header spans those exact weekday cells. If each weekday has its own times, the per-day times always take precedence.
- Before returning JSON, cross-check every entry against both coordinates in the source grid: (1) its weekday row/column and (2) its lesson or period row/column.
- Times must use 24-hour HH:mm when explicit. For unclear times, use null and add a warning; do not infer a time from adjacent entries.
- For every entry, copy the primary cell heading into title EXACTLY as written in the image; title must not be empty when visible text exists.
- Put subject and grade/section in subject and className only when they are separately visible, without changing or translating the original title.
- Copy a separately visible room or place into location. Copy every other visible detail or line into notes without summarizing, translating, or dropping text.
- If a field does not fit subject, className, or location, it belongs in notes. Do not discard it.
- If one cell lists multiple classes or groups, preserve the complete visible list in className and return one entry per numbered slot covered by that cell.
- confidence must be high, medium, or low for each lesson. Use low when text is blurry, partially hidden, or inferred.
- Extract every visible non-lesson label or phrase into breaks, including familiar and unfamiliar school-specific wording.
- Preserve each period title EXACTLY as written in the image. Never replace it with a generic label such as Break or Snack.
- For any non-lesson entry, breakAfterLesson stores the visible timetable column/slot number itself. Any label under slot 3 must use 3 even if it is not a lesson. Use 0 ONLY when the cell is visibly under a separate unnumbered column such as "Other periods"; never use 0 merely because the model is unsure.
- A visible period number never changes the entry type: RECESS in slot 7 remains a non-lesson entry titled RECESS, not lesson 7.
- Multiple non-lesson periods may have the same visible period number. Keep all of them and preserve their chronological order through startTime.
- If the weekday column or lesson/period position is ambiguous, the grid alignment is unreadable: return no entries and use the unreadable response described above.
- Preserve the source order of days and entries. Do not sort cells by time or renumber them.
- Do not force lesson numbers or non-lesson periods into a standard school order. Follow the source image exactly.
- Do not normalize different weekdays into one common bell schedule. The output must retain the timetable printed for each individual day.
- Never invent missing days, lessons, subjects, classes, or times.
- Preserve every visible schedule title, subject, class, and label in its original source language without translation.
- Write only generated warnings in ${outputLanguage}.
- No markdown fences and no prose outside the JSON.`;
}

export function parseExtractedTeacherSchedule(text: string, language: "ar" | "en" = "en"): ExtractedTeacherSchedule {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
  const parsed = normalizeSchoolDayTimes(JSON.parse(candidate), language);
  const validated = extractedScheduleSchema.parse(parsed);
  if (validated.readability === "unreadable") {
    throw new UnreadableTeacherScheduleImageError(validated.warnings);
  }

  return {
    readability: validated.readability,
    daySchedules: validated.daySchedules
      .map((day) => {
        const normalizedLessons = day.lessons
          .map((lesson) => ({
            ...lesson,
            title: lesson.title.trim() || lesson.subject?.trim() || lesson.className?.trim() || "",
            subject: lesson.subject?.trim() || null,
            className: lesson.className?.trim() || null,
            location: lesson.location?.trim() || null,
            notes: lesson.notes?.trim() || null,
            endTime: lesson.endTime || null,
          }));
        const correctedPeriods = normalizedLessons
          .filter((lesson) => isClearlyNonLessonLabel(lesson.title))
          .map((lesson) => ({
            title: lesson.title,
            breakAfterLesson: lesson.lessonNumber,
            startTime: lesson.startTime,
            endTime: lesson.endTime,
            location: lesson.location,
            notes: lesson.notes,
            confidence: lesson.confidence,
          }));

        return {
          dayOfWeek: day.dayOfWeek,
          lessons: normalizedLessons
            .filter((lesson) => !isClearlyNonLessonLabel(lesson.title)),
          breaks: [
            ...day.breaks.map((entry) => ({
              ...entry,
              title: entry.title.trim(),
              location: entry.location?.trim() || null,
              notes: entry.notes?.trim() || null,
              endTime: entry.endTime || null,
            })),
            ...correctedPeriods,
          ],
        };
      }),
    warnings: validated.warnings,
  };
}