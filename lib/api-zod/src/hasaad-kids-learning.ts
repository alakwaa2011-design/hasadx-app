import { z } from "zod";

/**
 * Stable identifiers used by the Kids player, authoring tools, and progress
 * services.  Content is intentionally declarative: renderers receive data,
 * never executable behaviour.
 */
export const kidsActivityTypeSchema = z.enum([
  "matching",
  "tracing",
  "media_choice",
  "counting",
  "ordering_puzzle",
]);
export type KidsActivityType = z.infer<typeof kidsActivityTypeSchema>;

const kidsIdSchema = z.string().trim().min(1).max(100);
const kidsTextSchema = z.string().trim().min(1).max(1_000);
/** Opaque first-party object key; clients must resolve it through their asset service. */
export const kidsAssetKeySchema = z.string()
  .trim()
  .min(6)
  .max(200)
  .regex(/^kids\/[a-z0-9][a-z0-9/_-]*$/, "Asset keys must be internal kids/ keys");

export const kidsMediaSchema = z.object({
  kind: z.enum(["image", "audio"]),
  assetKey: kidsAssetKeySchema,
  alt: z.string().trim().min(1).max(300).optional(),
}).strict();

const activityBaseSchema = z.object({
  id: kidsIdSchema,
  type: kidsActivityTypeSchema,
  skillId: kidsIdSchema,
  title: kidsTextSchema,
  instructions: kidsTextSchema,
  exampleId: kidsIdSchema,
  weight: z.number().positive().max(100).default(1),
}).strict();

export const matchingActivitySchema = activityBaseSchema.extend({
  type: z.literal("matching"),
  pairs: z.array(z.object({
    id: kidsIdSchema,
    left: kidsTextSchema,
    right: kidsTextSchema,
    leftMedia: kidsMediaSchema.optional(),
    rightMedia: kidsMediaSchema.optional(),
  }).strict()).min(2).max(12).superRefine((pairs, context) => {
    const left = new Set<string>();
    const right = new Set<string>();
    pairs.forEach((pair, index) => {
      if (left.has(pair.left)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, "left"], message: "Matching left values must be unique" });
      if (right.has(pair.right)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, "right"], message: "Matching right values must be unique" });
      left.add(pair.left);
      right.add(pair.right);
    });
  }),
}).strict();

export const tracingActivitySchema = activityBaseSchema.extend({
  type: z.literal("tracing"),
  strokes: z.array(z.object({
    id: kidsIdSchema,
    // Coordinates are normalized to make authored paths independent of canvas size.
    points: z.array(z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    }).strict()).min(2).max(500),
  }).strict()).min(1).max(50),
  completionThreshold: z.number().min(0.5).max(1).default(0.8),
}).strict();

export const mediaChoiceActivitySchema = activityBaseSchema.extend({
  type: z.literal("media_choice"),
  prompt: kidsTextSchema,
  promptMedia: kidsMediaSchema.optional(),
  choices: z.array(z.object({
    id: kidsIdSchema,
    label: kidsTextSchema,
    media: kidsMediaSchema,
    isCorrect: z.boolean(),
  }).strict()).min(2).max(6).superRefine((choices, context) => {
    if (choices.filter((choice) => choice.isCorrect).length !== 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Media choice activities require exactly one correct choice" });
    }
  }),
}).strict();

export const countingActivitySchema = activityBaseSchema.extend({
  type: z.literal("counting"),
  prompt: kidsTextSchema,
  items: z.array(z.object({
    id: kidsIdSchema,
    media: kidsMediaSchema.optional(),
    label: z.string().trim().min(1).max(100).optional(),
  }).strict()).min(1).max(30),
  correctCount: z.number().int().min(0).max(30),
  choices: z.array(z.number().int().min(0).max(30)).min(2).max(6),
}).strict().superRefine((activity, context) => {
  if (activity.correctCount !== activity.items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["correctCount"], message: "correctCount must equal the number of items" });
  }
  if (!activity.choices.includes(activity.correctCount)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["choices"], message: "choices must include correctCount" });
  }
  if (new Set(activity.choices).size !== activity.choices.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["choices"], message: "Counting choices must be unique" });
  }
});

export const orderingPuzzleActivitySchema = activityBaseSchema.extend({
  type: z.literal("ordering_puzzle"),
  prompt: kidsTextSchema,
  pieces: z.array(z.object({
    id: kidsIdSchema,
    label: kidsTextSchema,
    media: kidsMediaSchema.optional(),
    correctPosition: z.number().int().min(0).max(19),
  }).strict()).min(2).max(20),
}).strict().superRefine((activity, context) => {
  const positions = activity.pieces.map((piece) => piece.correctPosition).sort((a, b) => a - b);
  const validOrder = positions.every((position, index) => position === index);
  if (!validOrder) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["pieces"], message: "Puzzle positions must be a complete zero-based sequence" });
  }
});

export const kidsActivitySchema = z.union([
  matchingActivitySchema,
  tracingActivitySchema,
  mediaChoiceActivitySchema,
  countingActivitySchema,
  orderingPuzzleActivitySchema,
]);
export type KidsActivity = z.infer<typeof kidsActivitySchema>;

export const kidsAttemptSchema = z.object({
  activityId: kidsIdSchema,
  activityType: kidsActivityTypeSchema,
  skillId: kidsIdSchema,
  exampleId: kidsIdSchema,
  sessionId: kidsIdSchema,
  completedAt: z.coerce.date(),
  correctWeight: z.number().min(0).max(100),
  possibleWeight: z.number().positive().max(100),
  errors: z.array(kidsIdSchema).max(30).default([]),
}).strict().superRefine((attempt, context) => {
  if (attempt.correctWeight > attempt.possibleWeight) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["correctWeight"], message: "correctWeight cannot exceed possibleWeight" });
  }
});
export type KidsAttempt = z.infer<typeof kidsAttemptSchema>;

export const KIDS_MASTERY_REQUIREMENTS = {
  minAttempts: 5,
  minimumWeightedAccuracy: 0.8,
  minActivityTypes: 2,
  minSessions: 2,
  minExamples: 3,
} as const;

export type KidsMasteryState = "not_started" | "practising" | "mastered";

export interface KidsMastery {
  state: KidsMasteryState;
  weightedAccuracy: number;
  attempts: number;
  activityTypes: number;
  sessions: number;
  examples: number;
  unmetRequirements: (keyof typeof KIDS_MASTERY_REQUIREMENTS)[];
}

/** Evaluates only the supplied skill's work, so callers may pass a full history. */
export function evaluateKidsMastery(skillId: string, attempts: readonly KidsAttempt[]): KidsMastery {
  const skillAttempts = attempts.filter((attempt) => attempt.skillId === skillId);
  const possibleWeight = skillAttempts.reduce((total, attempt) => total + attempt.possibleWeight, 0);
  const weightedAccuracy = possibleWeight === 0
    ? 0
    : skillAttempts.reduce((total, attempt) => total + attempt.correctWeight, 0) / possibleWeight;
  const activityTypes = new Set(skillAttempts.map((attempt) => attempt.activityType)).size;
  const sessions = new Set(skillAttempts.map((attempt) => attempt.sessionId)).size;
  const examples = new Set(skillAttempts.map((attempt) => attempt.exampleId)).size;
  const metrics = { minAttempts: skillAttempts.length, minimumWeightedAccuracy: weightedAccuracy, minActivityTypes: activityTypes, minSessions: sessions, minExamples: examples };
  const unmetRequirements = (Object.keys(KIDS_MASTERY_REQUIREMENTS) as (keyof typeof KIDS_MASTERY_REQUIREMENTS)[])
    .filter((requirement) => metrics[requirement] < KIDS_MASTERY_REQUIREMENTS[requirement]);

  return {
    state: skillAttempts.length === 0 ? "not_started" : unmetRequirements.length === 0 ? "mastered" : "practising",
    weightedAccuracy,
    attempts: skillAttempts.length,
    activityTypes,
    sessions,
    examples,
    unmetRequirements,
  };
}

export interface KidsAdventureCandidate {
  activity: KidsActivity;
  /** Higher values indicate that the learner needs more practice with this skill. */
  need?: number;
}

export interface KidsAdventureSelection {
  activities: KidsActivity[];
  reasons: Record<string, "errors" | "need" | "last_practice">;
}

/**
 * Selects a short, varied adventure. Recent errors outrank unmet need; among
 * otherwise equal activities, the least recently practised one comes first.
 */
export function selectKidsAdventure(
  candidates: readonly KidsAdventureCandidate[],
  attempts: readonly KidsAttempt[],
  now: Date = new Date(),
): KidsAdventureSelection {
  const validCandidates = candidates
    .map((candidate) => ({ ...candidate, activity: kidsActivitySchema.parse(candidate.activity) }));
  const latestByActivity = new Map<string, KidsAttempt>();
  const errorsByActivity = new Map<string, number>();
  for (const attempt of attempts) {
    const previous = latestByActivity.get(attempt.activityId);
    if (!previous || previous.completedAt < attempt.completedAt) latestByActivity.set(attempt.activityId, attempt);
    errorsByActivity.set(attempt.activityId, (errorsByActivity.get(attempt.activityId) ?? 0) + attempt.errors.length);
  }
  const ranked = validCandidates.map((candidate) => {
    const lastPractice = latestByActivity.get(candidate.activity.id)?.completedAt;
    const daysSincePractice = lastPractice ? Math.max(0, (now.getTime() - lastPractice.getTime()) / 86_400_000) : 365;
    const errors = errorsByActivity.get(candidate.activity.id) ?? 0;
    const need = Math.max(0, candidate.need ?? 0);
    const reason: KidsAdventureSelection["reasons"][string] = errors > 0 ? "errors" : need > 0 ? "need" : "last_practice";
    return { candidate, errors, need, daysSincePractice, reason };
  }).sort((a, b) => b.errors - a.errors || b.need - a.need || b.daysSincePractice - a.daysSincePractice || a.candidate.activity.id.localeCompare(b.candidate.activity.id));

  const selected: typeof ranked = [];
  for (const rankedCandidate of ranked) {
    if (selected.length === 3) break;
    // Prefer a different engine before repeating one, when alternatives exist.
    const repeatsType = selected.some(({ candidate }) => candidate.activity.type === rankedCandidate.candidate.activity.type);
    const hasUnusedType = ranked.some(({ candidate }) => !selected.some((chosen) => chosen.candidate.activity.type === candidate.activity.type));
    if (repeatsType && hasUnusedType) continue;
    selected.push(rankedCandidate);
  }
  for (const rankedCandidate of ranked) {
    if (selected.length === 3) break;
    if (!selected.includes(rankedCandidate)) selected.push(rankedCandidate);
  }
  return {
    activities: selected.map(({ candidate }) => candidate.activity),
    reasons: Object.fromEntries(selected.map(({ candidate, reason }) => [candidate.activity.id, reason])),
  };
}