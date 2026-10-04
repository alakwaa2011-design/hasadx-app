import { z } from "zod";

export const worksheetActivityKindSchema = z.enum([
  "concept_map", "drawing", "coloring", "sorting", "sequencing", "group_task",
]);
export const worksheetActivityStyleSchema = z.enum([
  "auto", "concept_map", "drawing", "coloring", "sorting", "sequencing", "group_task", "practice",
]);
const text = z.string().trim().min(1).max(180);
export const worksheetActivitySchema = z.object({
  kind: worksheetActivityKindSchema,
  center: text.optional(),
  branches: z.array(text).min(2).max(6).optional(),
  items: z.array(text).min(2).max(8).optional(),
  categories: z.array(text).min(2).max(4).optional(),
  steps: z.array(text).min(2).max(5).optional(),
  roles: z.array(text).min(2).max(6).optional(),
  spaceHeight: z.number().int().min(60).max(180).default(100),
}).superRefine((activity, ctx) => {
  const missing =
    activity.kind === "concept_map" && (!activity.center || !activity.branches)
    || activity.kind === "sorting" && (!activity.items || !activity.categories)
    || activity.kind === "sequencing" && !activity.items
    || activity.kind === "group_task" && (!activity.steps || !activity.roles);
  if (missing) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Activity requires its complete printable structure" });
});

export const worksheetGenerationConstraintsSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
  learningObjective: z.string().trim().min(1).max(500).optional(),
  cognitiveSkill: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create", "mixed"]).optional(),
  activityDuration: z.number().int().min(5).max(90).optional(),
  differentiation: z.enum(["none", "support", "enrichment", "scaffolded"]).optional(),
  assessmentMode: z.enum(["diagnostic", "formative", "summative"]).optional(),
  allowedTypes: z.array(z.enum([
    "mcq", "true_false", "short_answer", "fill_blank", "matching", "worked_problem",
    "extended_response", "error_correction", "word_bank", "compare",
  ])).min(1).max(10).optional(),
  itemCount: z.number().int().min(1).max(12).optional(),
});
export type WorksheetActivity = z.infer<typeof worksheetActivitySchema>;
export type WorksheetActivityStyle = z.infer<typeof worksheetActivityStyleSchema>;
export type WorksheetGenerationConstraints = z.infer<typeof worksheetGenerationConstraintsSchema>;