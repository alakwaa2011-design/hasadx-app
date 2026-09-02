/**
 * createHasadActivityFromSlide — converts AI-generated slide activity metadata
 * into a real Hasaad assignment + returns enough info for the editor to launch
 * the appropriate game session.
 *
 * Supported activity types (extensible):
 *  - tug_war     → /game/tug/create?assignmentId=…     (URL-based setup page)
 *  - quick_quiz  → Wameeth live engine via socket teacher:create-game
 *  - rocket_race → /game/rocket/create?assignmentId=…  (URL-based setup page;
 *                  its importer only loads 4-option MCQs, so rocket is offered
 *                  only when the slide has at least one such question)
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

export type HasadSlideActivityType = "tug_war" | "quick_quiz" | "rocket_race";

export type CreatedHasadActivity = {
  assignmentId: number;
  activityType: HasadSlideActivityType;
  /** The internal Hasaad game kind stored on the linked hasad-activity
   *  element so present.tsx picks the right launcher. */
  gameType: "tug_of_war" | "knowledge_race" | "rocket_race";
  title: string;
  /**
   * For tug_war / rocket_race: direct URL to the setup page (accepts ?assignmentId).
   * For quick_quiz: undefined — must be launched via socket teacher:create-game.
   */
  url: string | undefined;
};

/** Normalize a stored/suggested assignment activity type to the presentation
 * metadata that drives both editor controls and present-mode launching.
 * Unknown library activity types intentionally fall back to Wameeth, which is
 * the broadest compatible launcher for presentation questions. */
export function getHasadActivityLaunchDetails(
  activityType: string | null | undefined,
  assignmentId: number,
): Pick<CreatedHasadActivity, "activityType" | "gameType" | "url"> {
  const normalizedType: HasadSlideActivityType =
    activityType === "tug_war" || activityType === "rocket_race" || activityType === "quick_quiz"
      ? activityType
      : "quick_quiz";

  return {
    activityType: normalizedType,
    gameType: normalizedType === "tug_war"
      ? "tug_of_war"
      : normalizedType === "rocket_race"
        ? "rocket_race"
        : "knowledge_race",
    url: normalizedType === "tug_war"
      ? `/game/tug/create?assignmentId=${assignmentId}`
      : normalizedType === "rocket_race"
        ? `/game/rocket/create?assignmentId=${assignmentId}`
        : undefined,
  };
}

// ── Activity type labels used in the inspector UI ────────────────────────────
export const ACTIVITY_TYPE_LABELS: Record<string, { ar: string; en: string; emoji: string }> = {
  tug_war:    { ar: "شد الحبل",  en: "Tug of War",  emoji: "🪢" },
  quick_quiz: { ar: "وميض",      en: "Wameeth",      emoji: "⚡" },
  rocket_race: { ar: "سباق الصواريخ", en: "Rocket Race", emoji: "🚀" },
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

function getRecommendedActivityType(slide: any): string | null {
  let type: string | null = null;
  if (slide.activityType && slide.activityType !== "null") type = slide.activityType;
  else if (slide.gameSuggestion === "tug")    type = "tug_war";
  else if (slide.gameSuggestion === "kahoot") type = "quick_quiz";
  else if (slide.gameSuggestion === "rocket") type = "rocket_race";
  /* Treat the remaining Wameeth-compatible game suggestions as quick_quiz */
  else if (slide.gameSuggestion === "hack" || slide.gameSuggestion === "wheel") type = "quick_quiz";

  /* Rocket race is recommended only when the slide has at least one question
     its answer UI can render. */
  if (type === "rocket_race" && !slideSupportsRocketRace(slide as Slide)) type = "quick_quiz";
  return type;
}

/** The supported activity type the create button should default to. */
export function getRecommendedHasadActivityType(
  slide: Slide | undefined,
): HasadSlideActivityType | null {
  if (!slide) return null;
  const type = getRecommendedActivityType(slide);
  return type === "tug_war" || type === "quick_quiz" || type === "rocket_race"
    ? type
    : null;
}

/** Rocket race accepts multiple-choice questions with two to four options. */
export function slideSupportsRocketRace(slide: Slide | undefined): boolean {
  if (!slide) return false;
  return questionsFromSlide(slide).some(
    (q) => q.options.length >= 2 && q.options.length <= 4
      && q.options.every((o) => typeof o === "string" && o.trim().length > 0),
  );
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
  return getRecommendedHasadActivityType(slide) !== null;
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

// ── Library suggestions (task #980) ──────────────────────────────────────────
export type ActivitySuggestion = {
  id: number;
  title: string;
  subject: string | null;
  questionCount: number;
  isOwn: boolean;
  ownerName: string | null;
  contentKind: string | null;
  activityType: string | null;
  createdAt: string;
};

/** Read-only relevance search over the teacher's library + shared library. */
export async function fetchActivitySuggestions(
  q: string,
  limit = 5,
): Promise<ActivitySuggestion[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const res = await fetch(`/api/presentation-activities/suggestions?${params}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("SUGGESTIONS_FAILED");
  const data = (await res.json().catch(() => ({}))) as { suggestions?: ActivitySuggestion[] };
  return Array.isArray(data.suggestions) ? data.suggestions : [];
}

// ── Main entry point ──────────────────────────────────────────────────────────
export async function createHasadActivityFromSlide(
  slide: Slide,
  presentationId: number | string,
  overrideType?: HasadSlideActivityType,
): Promise<CreatedHasadActivity> {
  const type = overrideType ?? getRecommendedHasadActivityType(slide);
  if (type !== "tug_war" && type !== "quick_quiz" && type !== "rocket_race") {
    throw new Error("UNSUPPORTED_ACTIVITY_TYPE");
  }
  if (type === "rocket_race" && !slideSupportsRocketRace(slide)) {
    throw new Error("NO_ROCKET_QUESTIONS");
  }

  const questions = questionsFromSlide(slide);
  if (questions.length === 0) {
    throw new Error("NO_ACTIVITY_QUESTIONS");
  }

  const title = titleFromSlide(slide);

  /* Idempotent server endpoint: the stable client key is presentation-scoped
     ("presId:slideId") because AI-generated decks reuse deterministic slide
     ids (s1, s2, …) across different presentations. Replays (double-click,
     retry after network error, re-open editor) return the existing
     assignment instead of creating a duplicate. */
  const res = await fetch("/api/presentation-activities", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slideKey: `${presentationId}:${slide.id}`,
      title,
      subject: "عروض تفاعلية",
      description: "تم إنشاؤه تلقائيًا من شريحة عرض تفاعلي في حصاد.",
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

  /* Idempotent replays return the EXISTING assignment, whose activityType
     may differ from the one requested this time (e.g. Wameeth was created
     first, rocket requested later). Trust the server's answer so the linked
     element launches the game that actually exists. */
  const serverType = (data as { activityType?: string }).activityType;
  const finalType: HasadSlideActivityType =
    serverType === "tug_war" || serverType === "quick_quiz" || serverType === "rocket_race"
      ? serverType
      : type;

  const launchDetails = getHasadActivityLaunchDetails(finalType, assignmentId);

  return {
    assignmentId,
    ...launchDetails,
    title,
  };
}
