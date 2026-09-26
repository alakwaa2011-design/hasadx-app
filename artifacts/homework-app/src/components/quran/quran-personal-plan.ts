import chapters from "@/data/quran/qcomplex/chapters.json";

export interface QuranVerseRef {
  surah: number;
  ayah: number;
}

export interface QuranPersonalPlan {
  start: QuranVerseRef;
  end: QuranVerseRef;
  dailyGoal: number;
}

export interface QuranReviewItem extends QuranVerseRef {
  dueDate: string;
  intervalDays: number;
}

export interface QuranPracticeSession {
  verse: QuranVerseRef;
  stage: 0 | 1 | 2 | 3 | 4 | 5;
  repeatCount: number | "continuous";
  recitationRevealed: boolean;
}

interface QuranAssessment {
  level: number;
  dueDate: string;
  lastAssessedDate: string;
  firstMasteredDate?: string;
  result: "mastered" | "review";
}

export interface QuranPersonalState {
  version: 1;
  plan: QuranPersonalPlan | null;
  assessments: Record<string, QuranAssessment>;
  session: QuranPracticeSession | null;
}

export const QURAN_PERSONAL_PLAN_KEY = "hasaad:public-quran-personal-plan:v1";
export function personalQuranStorageKey(role: "teacher" | "student", id: number): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Invalid personal Quran owner");
  return `hasaad:quran-personal-plan:v1:${role}:${id}`;
}
export const emptyQuranPersonalState = (): QuranPersonalState => ({
  version: 1,
  plan: null,
  assessments: {},
  session: null,
});

const chapterStarts = chapters.reduce<number[]>((starts, chapter, index) => {
  starts.push((starts[index - 1] ?? 0) + (index ? chapters[index - 1].verse_count : 0));
  return starts;
}, []);
const totalAyahs = chapters.reduce((total, chapter) => total + chapter.verse_count, 0);

export function verseOrdinal(verse: QuranVerseRef): number | null {
  if (!Number.isInteger(verse.surah) || !Number.isInteger(verse.ayah)) return null;
  const chapter = chapters[verse.surah - 1];
  if (!chapter || verse.ayah < 1 || verse.ayah > chapter.verse_count) return null;
  return chapterStarts[verse.surah - 1] + verse.ayah - 1;
}

export function verseAtOrdinal(ordinal: number): QuranVerseRef | null {
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= totalAyahs) return null;
  const surah = chapterStarts.findIndex((start, index) =>
    ordinal >= start && ordinal < start + chapters[index].verse_count,
  ) + 1;
  return { surah, ayah: ordinal - chapterStarts[surah - 1] + 1 };
}

export function validPersonalPlan(plan: QuranPersonalPlan): boolean {
  const start = verseOrdinal(plan.start);
  const end = verseOrdinal(plan.end);
  return start !== null && end !== null && start <= end
    && Number.isInteger(plan.dailyGoal) && plan.dailyGoal >= 1 && plan.dailyGoal <= 20;
}

export function localQuranDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addQuranDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(year, month - 1, date + days, 12);
  return localQuranDay(next);
}

export function assessPersonalVerse(
  state: QuranPersonalState,
  verse: QuranVerseRef,
  result: "mastered" | "review",
  day = localQuranDay(),
): QuranPersonalState {
  if (verseOrdinal(verse) === null) throw new Error("Invalid Quran verse");
  const key = `${verse.surah}:${verse.ayah}`;
  const previous = state.assessments[key];
  const level = result === "mastered" ? Math.min((previous?.level ?? 0) + 1, 6) : 0;
  const intervalDays = result === "review" ? 1 : [0, 2, 7, 14, 30, 60, 90][level];
  return {
    ...state,
    session: result === "mastered" ? null : {
      verse,
      stage: 0,
      repeatCount: state.session?.repeatCount ?? 3,
      recitationRevealed: false,
    },
    assessments: {
      ...state.assessments,
      [key]: {
        level,
        dueDate: addQuranDays(day, intervalDays),
        lastAssessedDate: day,
        firstMasteredDate: previous?.firstMasteredDate ?? (result === "mastered" ? day : undefined),
        result,
      },
    },
  };
}

export function personalDueReviews(state: QuranPersonalState, day = localQuranDay()): QuranReviewItem[] {
  return Object.entries(state.assessments)
    .flatMap(([key, assessment]) => {
      const [surah, ayah] = key.split(":").map(Number);
      const verse = { surah, ayah };
      if (verseOrdinal(verse) === null || assessment.dueDate > day) return [];
      const intervalDays = assessment.result === "review" ? 1 : [0, 2, 7, 14, 30, 60, 90][assessment.level] ?? 2;
      return [{ ...verse, dueDate: assessment.dueDate, intervalDays }];
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (verseOrdinal(a) ?? 0) - (verseOrdinal(b) ?? 0));
}

export function nextPersonalMemorization(state: QuranPersonalState): QuranVerseRef | null {
  if (!state.plan || !validPersonalPlan(state.plan)) return null;
  const start = verseOrdinal(state.plan.start)!;
  const end = verseOrdinal(state.plan.end)!;
  for (let ordinal = start; ordinal <= end; ordinal++) {
    const verse = verseAtOrdinal(ordinal)!;
    if (!state.assessments[`${verse.surah}:${verse.ayah}`]?.firstMasteredDate) return verse;
  }
  return null;
}

export function masteredTodayInPlan(state: QuranPersonalState, day = localQuranDay()): number {
  if (!state.plan || !validPersonalPlan(state.plan)) return 0;
  const start = verseOrdinal(state.plan.start)!;
  const end = verseOrdinal(state.plan.end)!;
  return Object.entries(state.assessments).filter(([key, item]) => {
    if (item.firstMasteredDate !== day) return false;
    const [surah, ayah] = key.split(":").map(Number);
    const ordinal = verseOrdinal({ surah, ayah });
    return ordinal !== null && ordinal >= start && ordinal <= end;
  }).length;
}

export function readQuranPersonalState(storageKey = QURAN_PERSONAL_PLAN_KEY): QuranPersonalState {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return emptyQuranPersonalState();
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || (parsed as QuranPersonalState).version !== 1) {
    throw new Error("Saved Quran plan format is invalid");
  }
  const state = parsed as QuranPersonalState;
  const validDay = (day: unknown): day is string =>
    typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);
  if ((state.plan !== null && !validPersonalPlan(state.plan))
    || !state.assessments || typeof state.assessments !== "object" || Array.isArray(state.assessments)
    || (state.session !== null && (!state.session || verseOrdinal(state.session.verse) === null
      || !Number.isInteger(state.session.stage) || state.session.stage < 0 || state.session.stage > 5
      || ![1, 3, 5, 10, "continuous"].includes(state.session.repeatCount)
      || typeof state.session.recitationRevealed !== "boolean"))
    || Object.entries(state.assessments).some(([key, item]) => {
      const [surah, ayah] = key.split(":").map(Number);
      return !/^\d+:\d+$/.test(key) || verseOrdinal({ surah, ayah }) === null
        || !item || !Number.isInteger(item.level) || item.level < 0 || item.level > 6
        || !validDay(item.dueDate) || !validDay(item.lastAssessedDate)
        || (item.firstMasteredDate !== undefined && !validDay(item.firstMasteredDate))
        || !["mastered", "review"].includes(item.result);
    })) {
    throw new Error("Saved Quran plan is invalid");
  }
  return state;
}