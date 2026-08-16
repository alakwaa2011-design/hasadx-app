/**
 * Pure helpers for the unified activity-creation wizard (إنشاء نشاط جديد).
 * Kept free of React/DOM so validation rules are unit-testable.
 */

export interface WizardQuestionLike {
  text?: string | null;
}

export type PublishBlockReason = "no_title" | "no_question" | "empty_question" | null;

/**
 * An activity can only be published with a title and at least one question
 * with real text (paper mode has a single synthetic question, always valid).
 * Returns the FIRST blocking reason, or null when publishable.
 */
export function getPublishBlockReason(
  title: string,
  questions: WizardQuestionLike[],
  isPaper: boolean,
): PublishBlockReason {
  if (!title.trim()) return "no_title";
  if (isPaper) return null;
  const nonEmpty = questions.filter(q => (q.text || "").trim());
  if (nonEmpty.length === 0) return "no_question";
  if (nonEmpty.length !== questions.length) return "empty_question";
  return null;
}

/** True when at least one question has text — gates step 2 → step 3. */
export function hasAtLeastOneQuestion(questions: WizardQuestionLike[], isPaper: boolean): boolean {
  if (isPaper) return true;
  return questions.some(q => (q.text || "").trim());
}

export const PUBLISH_BLOCK_MESSAGES_AR: Record<Exclude<PublishBlockReason, null>, string> = {
  no_title: "أضف عنواناً للنشاط قبل النشر",
  no_question: "أضف سؤالاً واحداً على الأقل للمتابعة",
  empty_question: "يوجد سؤال بلا نص — أكمله أو احذفه",
};

export const PUBLISH_BLOCK_MESSAGES_EN: Record<Exclude<PublishBlockReason, null>, string> = {
  no_title: "Add a title before publishing",
  no_question: "Add at least one question to continue",
  empty_question: "A question has no text — complete or delete it",
};
