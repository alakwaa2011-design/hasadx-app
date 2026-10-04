import { z } from "zod";
export declare const worksheetActivityKindSchema: z.ZodEnum<["concept_map", "drawing", "coloring", "sorting", "sequencing", "group_task"]>;
export declare const worksheetActivityStyleSchema: z.ZodEnum<["auto", "concept_map", "drawing", "coloring", "sorting", "sequencing", "group_task", "practice"]>;
export declare const worksheetActivitySchema: z.ZodEffects<z.ZodObject<{
    kind: z.ZodEnum<["concept_map", "drawing", "coloring", "sorting", "sequencing", "group_task"]>;
    center: z.ZodOptional<z.ZodString>;
    branches: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    items: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    steps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    roles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    spaceHeight: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    kind: "concept_map" | "drawing" | "coloring" | "sorting" | "sequencing" | "group_task";
    spaceHeight: number;
    center?: string | undefined;
    branches?: string[] | undefined;
    items?: string[] | undefined;
    categories?: string[] | undefined;
    steps?: string[] | undefined;
    roles?: string[] | undefined;
}, {
    kind: "concept_map" | "drawing" | "coloring" | "sorting" | "sequencing" | "group_task";
    center?: string | undefined;
    branches?: string[] | undefined;
    items?: string[] | undefined;
    categories?: string[] | undefined;
    steps?: string[] | undefined;
    roles?: string[] | undefined;
    spaceHeight?: number | undefined;
}>, {
    kind: "concept_map" | "drawing" | "coloring" | "sorting" | "sequencing" | "group_task";
    spaceHeight: number;
    center?: string | undefined;
    branches?: string[] | undefined;
    items?: string[] | undefined;
    categories?: string[] | undefined;
    steps?: string[] | undefined;
    roles?: string[] | undefined;
}, {
    kind: "concept_map" | "drawing" | "coloring" | "sorting" | "sequencing" | "group_task";
    center?: string | undefined;
    branches?: string[] | undefined;
    items?: string[] | undefined;
    categories?: string[] | undefined;
    steps?: string[] | undefined;
    roles?: string[] | undefined;
    spaceHeight?: number | undefined;
}>;
export declare const worksheetGenerationConstraintsSchema: z.ZodObject<{
    difficulty: z.ZodOptional<z.ZodEnum<["easy", "medium", "hard", "mixed"]>>;
    learningObjective: z.ZodOptional<z.ZodString>;
    cognitiveSkill: z.ZodOptional<z.ZodEnum<["remember", "understand", "apply", "analyze", "evaluate", "create", "mixed"]>>;
    activityDuration: z.ZodOptional<z.ZodNumber>;
    differentiation: z.ZodOptional<z.ZodEnum<["none", "support", "enrichment", "scaffolded"]>>;
    assessmentMode: z.ZodOptional<z.ZodEnum<["diagnostic", "formative", "summative"]>>;
    allowedTypes: z.ZodOptional<z.ZodArray<z.ZodEnum<["mcq", "true_false", "short_answer", "fill_blank", "matching", "worked_problem", "extended_response", "error_correction", "word_bank", "compare"]>, "many">>;
    itemCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    difficulty?: "easy" | "medium" | "hard" | "mixed" | undefined;
    learningObjective?: string | undefined;
    cognitiveSkill?: "mixed" | "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create" | undefined;
    activityDuration?: number | undefined;
    differentiation?: "none" | "support" | "enrichment" | "scaffolded" | undefined;
    assessmentMode?: "diagnostic" | "formative" | "summative" | undefined;
    itemCount?: number | undefined;
    allowedTypes?: ("mcq" | "true_false" | "short_answer" | "fill_blank" | "matching" | "worked_problem" | "extended_response" | "error_correction" | "word_bank" | "compare")[] | undefined;
}, {
    difficulty?: "easy" | "medium" | "hard" | "mixed" | undefined;
    learningObjective?: string | undefined;
    cognitiveSkill?: "mixed" | "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create" | undefined;
    activityDuration?: number | undefined;
    differentiation?: "none" | "support" | "enrichment" | "scaffolded" | undefined;
    assessmentMode?: "diagnostic" | "formative" | "summative" | undefined;
    itemCount?: number | undefined;
    allowedTypes?: ("mcq" | "true_false" | "short_answer" | "fill_blank" | "matching" | "worked_problem" | "extended_response" | "error_correction" | "word_bank" | "compare")[] | undefined;
}>;
export type WorksheetActivity = z.infer<typeof worksheetActivitySchema>;
export type WorksheetActivityStyle = z.infer<typeof worksheetActivityStyleSchema>;
export type WorksheetGenerationConstraints = z.infer<typeof worksheetGenerationConstraintsSchema>;
//# sourceMappingURL=worksheet-activity.d.ts.map