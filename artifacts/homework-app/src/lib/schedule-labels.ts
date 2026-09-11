import type {
  TeacherScheduleBulkInput,
  TeacherScheduleEntry,
} from "@workspace/api-client-react";

export const SCHEDULE_DAYS = [
  { value: 0, ar: "الأحد", shortAr: "أحد", en: "Sun" },
  { value: 1, ar: "الاثنين", shortAr: "إثنين", en: "Mon" },
  { value: 2, ar: "الثلاثاء", shortAr: "ثلاثاء", en: "Tue" },
  { value: 3, ar: "الأربعاء", shortAr: "أربعاء", en: "Wed" },
  { value: 4, ar: "الخميس", shortAr: "خميس", en: "Thu" },
  { value: 5, ar: "الجمعة", shortAr: "جمعة", en: "Fri" },
  { value: 6, ar: "السبت", shortAr: "سبت", en: "Sat" },
] as const;

export type ScheduleConflictDetails = {
  dayOfWeek?: number | null;
  lessonNumber?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  conflictingTitle?: string | null;
  conflictingStartTime?: string | null;
  conflictingEndTime?: string | null;
};

export function getApiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = error.data;
  if (!data || typeof data !== "object" || !("message" in data)) return null;
  return typeof data.message === "string" ? data.message : null;
}

export function getScheduleConflict(error: unknown): ScheduleConflictDetails | null {
  if (!error || typeof error !== "object" || !("data" in error)) return null;
  const data = error.data;
  if (!data || typeof data !== "object" || !("conflict" in data)) return null;
  const conflict = data.conflict;
  return conflict && typeof conflict === "object"
    ? conflict as ScheduleConflictDetails
    : null;
}

const ARABIC_LESSON_NUMBERS = [
  "الأولى",
  "الثانية",
  "الثالثة",
  "الرابعة",
  "الخامسة",
  "السادسة",
  "السابعة",
  "الثامنة",
  "التاسعة",
  "العاشرة",
];

export function lessonNumberLabel(number: number | null | undefined, isAr: boolean) {
  if (!number) return isAr ? "حصة" : "Lesson";
  return isAr
    ? `الحصة ${ARABIC_LESSON_NUMBERS[number - 1] || number}`
    : `Lesson ${number}`;
}

export function breakPositionLabel(number: number | null | undefined, isAr: boolean) {
  if (number === 0) return "";
  if (number == null) return isAr ? "الموقع في الجدول" : "Schedule position";
  return isAr
    ? `الفترة ${ARABIC_LESSON_NUMBERS[number - 1] || number}`
    : `Period ${number}`;
}

export function schedulePosition(entry: TeacherScheduleEntry) {
  return entry.kind === "break"
    ? (entry.breakAfterLesson ?? 0) + 0.5
    : (entry.lessonNumber ?? 99);
}

export function scheduleDateLabel(date: string, isAr: boolean) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(isAr ? "ar-KW" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parsed);
}

export type ScheduleFormValues = {
  kind: "weekly" | "appointment" | "break";
  title: string;
  subject: string;
  className: string;
  color: string;
  dayOfWeek: string;
  lessonNumber: string;
  breakAfterLesson: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
};

export type BulkScheduleFormValues = {
  lessons: Array<{
    lessonNumber: number;
    title: string;
    subject: string;
    className: string;
    color: string;
    startTime: string;
    endTime: string;
    confidence?: "high" | "medium" | "low";
  }>;
};

export type BulkBreakDraft = {
  title: string;
  breakAfterLesson: number;
  startTime: string;
  endTime: string | null;
  confidence: "high" | "medium" | "low";
};

export type ExtractedScheduleDay = {
  dayOfWeek: number;
  lessons: Array<{
    lessonNumber: number;
    title: string;
    subject: string | null;
    className: string | null;
    startTime: string;
    endTime: string | null;
    confidence: "high" | "medium" | "low";
  }>;
  breaks?: BulkBreakDraft[];
};

export function getLocalDateInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function emptyScheduleForm(): ScheduleFormValues {
  return {
    kind: "weekly",
    title: "",
    subject: "",
    className: "",
    color: "",
    dayOfWeek: String(new Date().getDay()),
    lessonNumber: "1",
    breakAfterLesson: "1",
    appointmentDate: getLocalDateInput(),
    startTime: "08:00",
    endTime: "09:00",
    location: "",
    notes: "",
  };
}

export function emptyBulkLessons(count = 5): BulkScheduleFormValues["lessons"] {
  return Array.from({ length: count }, (_, index) => ({
    lessonNumber: index + 1,
    title: "",
    subject: "",
    className: "",
    color: "",
    startTime: "00:00",
    endTime: "00:00",
  }));
}

export function normalizeImportedDaySchedules(daySchedules: ExtractedScheduleDay[]) {
  const schedules: Record<number, BulkScheduleFormValues["lessons"]> = {};
  const breaks: Record<number, BulkBreakDraft[]> = {};
  let hasNumberingGaps = false;

  daySchedules.forEach((daySchedule) => {
    const lessonsByNumber = [...daySchedule.lessons].sort((left, right) => left.lessonNumber - right.lessonNumber);
    if (lessonsByNumber.some((lesson, index) => lesson.lessonNumber !== index + 1)) {
      hasNumberingGaps = true;
    }
    schedules[daySchedule.dayOfWeek] = [...daySchedule.lessons]
      .sort((left, right) => left.startTime.localeCompare(right.startTime))
      .map((extracted) => ({
        lessonNumber: extracted.lessonNumber,
        title: extracted.title || extracted.subject || extracted.className || "",
        subject: extracted.subject || "",
        className: extracted.className || "",
        color: "",
        startTime: extracted.startTime,
        endTime: extracted.endTime || "",
        confidence: extracted.confidence,
      }));
    breaks[daySchedule.dayOfWeek] = [...(daySchedule.breaks || [])]
      .sort((left, right) => left.startTime.localeCompare(right.startTime));
  });

  return { schedules, breaks, hasNumberingGaps };
}

export function buildTeacherScheduleBulkInput(
  schedules: Record<number, BulkScheduleFormValues["lessons"]>,
  isAr: boolean,
  breaks: Record<number, BulkBreakDraft[]> = {},
): TeacherScheduleBulkInput {
  return {
    daySchedules: Object.entries(schedules)
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([day, lessons]) => ({
        dayOfWeek: Number(day),
        lessons: lessons.map((lesson) => ({
          lessonNumber: lesson.lessonNumber,
          title: lesson.title.trim()
            || lesson.subject.trim()
            || lesson.className.trim()
            || (lesson.confidence ? "" : lessonNumberLabel(lesson.lessonNumber, isAr)),
          subject: lesson.subject.trim() || null,
          className: lesson.className.trim() || null,
          color: lesson.color || null,
          startTime: lesson.startTime,
          endTime: lesson.endTime || null,
        })),
        breaks: (breaks[Number(day)] || []).map((entry) => ({
          title: entry.title.trim(),
          breakAfterLesson: entry.breakAfterLesson,
          startTime: entry.startTime,
          endTime: entry.endTime || null,
        })),
      })),
  };
}