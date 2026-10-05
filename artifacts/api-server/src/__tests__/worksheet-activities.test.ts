import { describe, it, expect } from "vitest";
import { worksheetActivitySchema, worksheetGenerationConstraintsSchema, worksheetSettingsSchema } from "@workspace/api-zod";
import {
  constrainedWorksheetCounts, parseWorksheetConstraints, worksheetActivityGuidance,
  validateWorksheetActivityOutput, validateWorksheetActivityRequest,
} from "../lib/worksheet-activities";
import { sanitizeGeneratedQuestions, worksheetQuestionsSchema, buildWorksheetPrompt } from "../routes/worksheets";

const counts = constrainedWorksheetCounts(1, 0);
const drawing = { kind: "drawing" as const, spaceHeight: 120 };
const question = { type: "short_answer", prompt: "ارسم مثالاً", answer: "نموذج للمعلم فقط", activity: drawing };
describe("activity-led worksheet generation", () => {
  it.each([
    drawing,
    { kind: "concept_map", center: "الماء", branches: ["مصادره", "استخداماته"], spaceHeight: 120 },
    { kind: "sorting", items: ["دائرة", "مربع"], categories: ["منحني", "مستقيم"], spaceHeight: 100 },
    { kind: "sequencing", items: ["نبات", "بذرة"], spaceHeight: 100 },
    { kind: "group_task", steps: ["ناقش", "اتفق"], roles: ["قارئ", "كاتب", "متحدث", "منسق"], spaceHeight: 100 },
  ])("preserves a complete $kind activity in generation and saved validation", activity => {
    const output = sanitizeGeneratedQuestions([{ ...question, activity }], counts);
    expect(output).toHaveLength(1);
    const saved = worksheetQuestionsSchema.parse(output)[0];
    expect(saved.type === "short_answer" && saved.activity).toEqual(activity);
  });

  it("rejects incomplete maps and sorting instead of printing missing content", () => {
    expect(worksheetActivitySchema.safeParse({ kind: "concept_map", center: "الماء" }).success).toBe(false);
    expect(sanitizeGeneratedQuestions([{ ...question, activity: { kind: "sorting" } }], counts)).toEqual([]);
  });

  it("requires an actual unshaded coloring visual", () => {
    const coloring = { ...question, activity: { kind: "coloring", spaceHeight: 60 } };
    expect(sanitizeGeneratedQuestions([coloring], counts)).toEqual([]);
    const visual = { shapes: [{ kind: "circle", x: 10, y: 10, width: 40, height: 40, shaded: false }] };
    expect(sanitizeGeneratedQuestions([{ ...coloring, visual }], counts)).toHaveLength(1);
    expect(sanitizeGeneratedQuestions([{ ...coloring, visual: { shapes: [{ ...visual.shapes[0], shaded: true }] } }], counts)).toEqual([]);
    expect(worksheetQuestionsSchema.safeParse([{ ...coloring, id: "saved" }]).success).toBe(false);
  });

  it("only allows selected types and never implicitly enables the choice board", () => {
    const restricted = constrainedWorksheetCounts(1, 0, { allowedTypes: ["matching"] });
    expect(restricted.mcq).toBe(0);
    expect(restricted.short_answer).toBe(0);
    expect(restricted.matching).toBeGreaterThan(0);
    expect(restricted.tic_tac_toe).toBe(0);
    expect(constrainedWorksheetCounts(1, 1).tic_tac_toe).toBe(1);
    expect(() => validateWorksheetActivityRequest({ activityStyle: "drawing", counts: restricted })).toThrow();
  });

  it("distinguishes omitted advanced settings from explicit teacher choices", () => {
    expect(worksheetGenerationConstraintsSchema.parse({})).toEqual({});
    const constraints = { difficulty: "easy" as const, activityDuration: 5, itemCount: 1, allowedTypes: ["short_answer" as const] };
    expect(parseWorksheetConstraints(JSON.stringify(constraints))).toEqual(constraints);
    expect(worksheetActivityGuidance({ language: "ar", pages: 1, generationConstraints: constraints })).toContain(JSON.stringify(constraints));
    expect(worksheetActivityGuidance({ language: "ar", pages: 1 })).toContain("لم يحدد المعلم");
    expect(() => parseWorksheetConstraints("{broken")).toThrow();
    expect(() => parseWorksheetConstraints({ itemCount: 0 })).toThrow();
  });

  it("fails explicitly if output ignores selected style, exact count or group size", () => {
    const output = [{ type: "short_answer", activity: drawing }];
    expect(validateWorksheetActivityOutput(output, { counts, activityStyle: "concept_map" })).toContain("missing");
    expect(validateWorksheetActivityOutput(output, { counts, generationConstraints: { itemCount: 2 } })).toContain("count");
    expect(validateWorksheetActivityOutput(output, { counts, activityStyle: "drawing" })).toBeNull();
    expect(validateWorksheetActivityOutput([{ type: "short_answer", activity: { kind: "group_task", roles: ["one", "two"] } }], {
      counts, executionMode: "group", groupSize: 4,
    })).toContain("role");
  });

  it("persists the quick path and explicit constraints in worksheet settings", () => {
    const settings = worksheetSettingsSchema.parse({ activityStyle: "drawing", executionMode: "group", groupSize: 3, targetPages: 1, generationConstraints: { difficulty: "easy" } });
    expect(settings.generationConstraints).toEqual({ difficulty: "easy" });
    expect(settings.activityStyle).toBe("drawing");
    expect(settings.targetPages).toBe(1);
  });

  it("does not force legacy default pedagogy into automatic generation", () => {
    const prompt = buildWorksheetPrompt({
      language: "ar", topic: "الماء", subject: "علوم", gradeLevel: "الثاني", pages: 1,
      questionSelection: "auto", activityStyle: "drawing", executionMode: "individual",
      difficulty: "medium", cognitiveSkill: "mixed", activityDuration: 15,
      differentiation: "none", assessmentMode: "formative", counts,
      generationConstraints: { difficulty: "easy", activityDuration: 5 },
    });
    expect(prompt).not.toContain("الصعوبة: متوسط");
    expect(prompt).not.toContain("مدة النشاط المتاحة: 15");
    expect(prompt).toContain('"difficulty":"easy"');
    expect(prompt).toContain('"kind":"drawing"');
    expect(prompt).toContain("لا تجمع كل الأنواع");
  });

  it.each(["concept_map", "drawing", "coloring", "sorting", "sequencing", "group_task"] as const)(
    "ends unconstrained auto prompts with the explicit %s activity and student safety contract",
    activityStyle => {
      const prompt = buildWorksheetPrompt({
        language: "ar", topic: "الأشكال", subject: "الرياضيات", gradeLevel: "الأول", pages: 1,
        questionSelection: "auto", activityStyle, executionMode: "individual",
        difficulty: "medium", cognitiveSkill: "mixed", activityDuration: 15,
        differentiation: "none", assessmentMode: "formative", counts, generationConstraints: {},
      });
      expect(prompt.lastIndexOf("FINAL REQUIRED OUTPUT CONTRACT")).toBeGreaterThan(prompt.indexOf("كل سؤال"));
      expect(prompt).toContain(`"kind":"${activityStyle}"`);
      expect(prompt).toContain('{"type":"short_answer"');
      expect(prompt).toContain("Even when advanced constraints are empty");
      expect(prompt).toContain("Keep the full solution/evaluation rubric ONLY in answer");
    },
  );

  it.each([2, 3, 5, 6])("makes the chosen %i-person group override the generic four-role example", groupSize => {
    const guidance = worksheetActivityGuidance({
      language: "ar", pages: 1, activityStyle: "group_task",
      executionMode: "group", groupSize, generationConstraints: {},
    });
    expect(guidance).toContain(`exactly ${groupSize} roles`);
    expect(guidance).toContain("The generic four-role example above is NOT binding");
    const example = guidance.split("Complete structure example (adapt instructions and rubric to the lesson): ")[1].split(". Preserve")[0];
    expect(JSON.parse(example).activity.roles).toHaveLength(groupSize);
  });
});