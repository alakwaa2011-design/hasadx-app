/**
 * createHasadActivityFromSlide — converts AI-generated slide activity metadata
 * into a real Hasad assignment + returns enough info for the editor to launch
 * the appropriate game session.
 *
 * Supported activity types (extensible):
 *  - tug_war   → /game/tug/create?assignmentId=…  (URL-based setup page)
 *  - quick_quiz → Wameeth live engine via socket teacher:create-game
 *
 * Question type mapping (no 4-option assumption):
 *  - 2 options that are صح/خطأ or yes/no variants → true_false
 *  - 2-4 options with correctIndex               → mcq
 *  - 0 options                                   → fill_blank (open text)
 */
import type { Slide, SlideElement } from "@workspace/api-client-react";

type HasadGameQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type CreatedHasadActivity = {
  assignmentId: number;
  activityType: "tug_war" | "quick_quiz";
  /** "tug_of_war" or "knowledge_race" — the internal Hasad game kind stored
   *  on the linked hasad-activity element so present.tsx picks the right launcher. */
  gameType: "tug_of_war" | "knowledge_race";
  title: string;
  /**
   * For tug_war: direct URL to the tug setup page (accepts ?assignmentId).
   * For quick_quiz: undefined — must be launched via socket teacher:create-game.
   */
  url: string | undefined;
};

// ── Activity type labels used in the inspector UI ────────────────────────────
export const ACTIVITY_TYPE_LABELS: Record<string, { ar: string; en: string; emoji: string }> = {
  tug_war:    { ar: "شد الحبل",  en: "Tug of War",  emoji: "🪢" },
  quick_quiz: { ar: "وميض",      en: "Wameeth",      emoji: "⚡" },
  word_cloud: { ar: "سحابة كلمات", en: "Word Cloud", emoji: "☁️" },
  discussion_wall: { ar: "جدار النقاش", en: "Discussion Wall", emoji: "💬" },
  live_poll:  { ar: "تصويت مباشر", en: "Live Poll",  emoji: "📊" },
};

// ── True/false option detection ───────────────────────────────────────────────
const TRUE_VARIANTS  = new Set(["true",  "صح",  "نعم", "yes",  "✓", "صحيح"]);
const FALSE_VARIANTS = new Set(["false", "خطأ", "خطا", "لا",  "no", "✗", "خاطئ"]);

function isTrueFalseOptions(opts: string[]): boolean {
  if (opts.length !== 2) return false;
  const a = opts[0].trim().toLowerCase();
  const b = opts[1].trim().toLowerCase();
  return (TRUE_VARIANTS.has(a) && FALSE_VARIANTS.has(b)) ||
         (FALSE_VARIANTS.has(a) && TRUE_VARIANTS.has(b));
}

function trueFalseCorrect(opts: string[], correctIndex: number): "true" | "false" {
  const chosen = opts[correctIndex]?.trim().toLowerCase() ?? "";
  return TRUE_VARIANTS.has(chosen) ? "true" : "false";
}

// ── Convert AI game questions → assignment question payloads ─────────────────
function toAssignmentQuestions(questions: HasadGameQuestion[]) {
  return questions.map((q) => {
    /* True/false: 2 options that are recognisably صح/خطأ variants */
    if (isTrueFalseOptions(q.options)) {
      return {
        text: q.prompt,
        questionType: "true_false" as const,
        correctAnswer: trueFalseCorrect(q.options, q.correctIndex),
        points: 1,
      };
    }

    /* No options → fill_blank (open text answer) */
    if (q.options.length === 0) {
      return {
        text: q.prompt,
        questionType: "fill_blank" as const,
        correctAnswer: "",
        points: 1,
      };
    }

    /* MCQ: 2, 3, or 4 options — only populate the slots that exist */
    const clampedCorrect = Math.max(0, Math.min(q.correctIndex, q.options.length - 1));
    return {
      text: q.prompt,
      questionType: "mcq" as const,
      optionA: q.options[0] ?? null,
      optionB: q.options[1] ?? null,
      optionC: q.options[2] ?? null,
      optionD: q.options[3] ?? null,
      correctAnswer: String.fromCharCode(65 + clampedCorrect), // A/B/C/D
      points: 1,
    };
  });
}

// ── Slide helpers ─────────────────────────────────────────────────────────────
function titleFromSlide(slide: Slide): string {
  const titleEl = slide.elements.find(
    (el) => el.kind === "text" && typeof el.text === "string" && el.text.trim(),
  );
  return titleEl?.text?.trim().slice(0, 120) || "نشاط عرض تفاعلي";
}

function getRecommendedActivityType(slide: Slide): string | null {
  if (slide.activityType && slide.activityType !== "null") return slide.activityType;
  if (slide.gameSuggestion === "tug")    return "tug_war";
  if (slide.gameSuggestion === "kahoot") return "quick_quiz";
  /* Treat any Wameeth-compatible game suggestion as quick_quiz */
  if (slide.gameSuggestion === "hack" || slide.gameSuggestion === "wheel" ||
      slide.gameSuggestion === "rocket") return "quick_quiz";
  return null;
}

function questionsFromSlide(slide: Slide): HasadGameQuestion[] {
  const gameEl = slide.elements.find(
    (el) => el.kind === "hasad-game" && Array.isArray((el as { questions?: unknown }).questions),
  ) as (SlideElement & { questions?: HasadGameQuestion[] }) | undefined;

  return (gameEl?.questions ?? [])
    .filter(
      (q) =>
        typeof q.prompt === "string" &&
        q.prompt.trim().length > 0 &&
        Array.isArray(q.options) &&
        Number.isInteger(q.correctIndex),
      // Note: options.length === 0 is now allowed (fill_blank path)
    )
    .slice(0, 12);
}

// ── Public helpers ────────────────────────────────────────────────────────────
export function canCreateHasadActivityFromSlide(slide: Slide | undefined): boolean {
  if (!slide) return false;
  const type = getRecommendedActivityType(slide);
  return type === "tug_war" || type === "quick_quiz";
}

export function unsupportedHasadActivityLabel(
  slide: Slide | undefined,
  isAr: boolean,
): string | null {
  if (!slide) return null;
  const type = getRecommendedActivityType(slide);
  if (!type || canCreateHasadActivityFromSlide(slide)) return null;
  return isAr
    ? "هذا النشاط مقترح وسيتم دعمه قريباً"
    : "This suggested activity will be supported soon";
}

// ── Main entry point ──────────────────────────────────────────────────────────
export async function createHasadActivityFromSlide(
  slide: Slide,
): Promise<CreatedHasadActivity> {
  const type = getRecommendedActivityType(slide);
  if (type !== "tug_war" && type !== "quick_quiz") {
    throw new Error("UNSUPPORTED_ACTIVITY_TYPE");
  }

  const questions = questionsFromSlide(slide);
  if (questions.length === 0) {
    throw new Error("NO_ACTIVITY_QUESTIONS");
  }

  const title = titleFromSlide(slide);
  const gameType: CreatedHasadActivity["gameType"] =
    type === "tug_war" ? "tug_of_war" : "knowledge_race";

  const res = await fetch("/api/assignments", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      subject: "عروض تفاعلية",
      description: "تم إنشاؤه تلقائيًا من شريحة عرض تفاعلي في حصاد.",
      submissionMode: "electronic",
      accessMode: "public",
      showResults: true,
      isShared: false,
      contentKind: "competition",
      fromPresentationSlide: slide.id,
      activityType: type,
      questions: toAssignmentQuestions(questions),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { message?: string }).message || "CREATE_ACTIVITY_FAILED");
  }

  const assignmentId = Number((data as { id?: number }).id);
  if (!Number.isFinite(assignmentId)) throw new Error("CREATE_ACTIVITY_FAILED");

  return {
    assignmentId,
    activityType: type,
    gameType,
    title,
    /* tug_war: direct URL (tug-create.tsx reads ?assignmentId).
       quick_quiz: undefined — must be launched via socket in the editor. */
    url: type === "tug_war"
      ? `/game/tug/create?assignmentId=${assignmentId}`
      : undefined,
  };
}
