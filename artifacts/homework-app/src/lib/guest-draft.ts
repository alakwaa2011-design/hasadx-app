export const GUEST_DRAFT_KEY = "guestDraft";

export type GuestQuestionType = "mcq" | "true_false" | "fill_blank";

export interface GuestOption {
  text: string;
}

export interface GuestQuestion {
  id: string;
  type: GuestQuestionType;
  text: string;
  options: [string, string, string, string]; // exactly 4 for MCQ
  correct: number; // index 0-3 for mcq, 0=true/1=false for tf
  fillAnswer: string; // for fill_blank
}

export interface GuestDraft {
  title: string;
  subject: string;
  questions: GuestQuestion[];
  savedAt?: string;
}

export function loadGuestDraft(): GuestDraft | null {
  try {
    const raw = localStorage.getItem(GUEST_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestDraft;
    if (!parsed?.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGuestDraft(draft: GuestDraft): void {
  localStorage.setItem(GUEST_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
}

export function clearGuestDraft(): void {
  localStorage.removeItem(GUEST_DRAFT_KEY);
}

export function hasSavedDraft(): boolean {
  return !!loadGuestDraft();
}

export function makeQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeDefaultQuestion(): GuestQuestion {
  return {
    id: makeQuestionId(),
    type: "mcq",
    text: "",
    options: ["", "", "", ""],
    correct: 0,
    fillAnswer: "",
  };
}

/** Convert a GuestDraft to the payload expected by POST /api/assignments */
export interface AssignmentCreatePayload {
  title: string;
  subject: string;
  submissionMode: "electronic";
  isShared: false;
  questions: AssignmentQuestionPayload[];
}

export interface AssignmentQuestionPayload {
  text: string;
  questionType: "mcq" | "true_false" | "fill_blank";
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
  points: number;
}

export function draftToApiPayload(draft: GuestDraft): AssignmentCreatePayload | null {
  const validQuestions: AssignmentQuestionPayload[] = [];

  for (const q of draft.questions) {
    if (!q.text.trim()) continue;

    if (q.type === "mcq") {
      const [a, b, c, d] = q.options.map(o => o.trim());
      if (!a || !b) continue; // need at least 2 options
      const correctLetter = (["A", "B", "C", "D"] as const)[q.correct] ?? "A";
      validQuestions.push({
        text: q.text.trim(),
        questionType: "mcq",
        optionA: a,
        optionB: b,
        optionC: c || undefined,
        optionD: d || undefined,
        correctAnswer: correctLetter,
        points: 1,
      });
    } else if (q.type === "true_false") {
      validQuestions.push({
        text: q.text.trim(),
        questionType: "true_false",
        correctAnswer: q.correct === 0 ? "true" : "false",
        points: 1,
      });
    } else {
      // fill_blank
      if (!q.fillAnswer.trim()) continue;
      validQuestions.push({
        text: q.text.trim(),
        questionType: "fill_blank",
        correctAnswer: q.fillAnswer.trim(),
        points: 1,
      });
    }
  }

  if (!draft.title.trim() || validQuestions.length === 0) return null;

  return {
    title: draft.title.trim(),
    subject: draft.subject.trim() || "General",
    submissionMode: "electronic",
    isShared: false,
    questions: validQuestions,
  };
}
