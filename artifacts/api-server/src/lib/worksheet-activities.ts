import { worksheetGenerationConstraintsSchema, type WorksheetGenerationConstraints, type WorksheetActivityStyle } from "@workspace/api-zod";
import { z } from "zod";
import { automaticWorksheetCounts } from "./worksheet-auto-selection";

export function constrainedWorksheetCounts(pages: number, board: number, constraints: WorksheetGenerationConstraints = {}) {
  const counts = automaticWorksheetCounts(pages, board);
  if (constraints.allowedTypes) {
    for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
      if (key !== "tic_tac_toe" && !constraints.allowedTypes.includes(key)) counts[key] = 0;
    }
  }
  return counts;
}

export function parseWorksheetConstraints(value: unknown) {
  let raw: unknown = value ?? {};
  if (typeof value === "string") {
    try { raw = JSON.parse(value); }
    catch { throw new z.ZodError([{ code: z.ZodIssueCode.custom, path: ["generationConstraints"], message: "Invalid constraints JSON" }]); }
  }
  return worksheetGenerationConstraintsSchema.parse(raw);
}

export function worksheetActivityGuidance(opts: {
  language: "ar" | "en"; pages: number; activityStyle?: WorksheetActivityStyle;
  executionMode?: "individual" | "group"; groupSize?: number;
  generationConstraints?: WorksheetGenerationConstraints;
}) {
  const ar = opts.language === "ar";
  const c = opts.generationConstraints ?? {};
  const selected = opts.activityStyle ?? "auto";
  return [
    ar
      ? "افهم مقصد المعلم أولاً، ثم صمّم أفضل نشاط تعلّم حقيقي مناسب للمادة والصف والعمر والمحتوى. اجتهد في الخيارات غير المحددة، لا تجتهد بمخالفة اختيار صريح. لا تستخدم توزيعاً ثابتاً ولا تجمع كل الأنواع. المتعة تأتي من التفكير والاكتشاف والعمل، لا من زخرفة اختبار."
      : "Understand the teacher's intent first; design the best genuine learning activity for the subject, grade, age and content. Exercise creativity only in unspecified choices, never by overriding explicit constraints. Avoid a fixed distribution or every possible format. Engagement means meaningful exploration and work, not decorating an exam.",
    ar
      ? `نمط النشاط المطلوب: ${selected}. ما لم يختر المعلم practice أو يقيد الأنواع بما يمنع النشاط، اجعل الورقة نشاطاً رئيسياً فعلياً وخطوة قصيرة اختيارية للتأكد من الفهم. صفحة واحدة: عادة 1–3 عناصر؛ صفحتان: تنوع خفيف 2–5 عناصر. لا تدّع مطابقة منهج محدد دون مرجع. للصغار تعليمات قصيرة ومساحات كبيرة، وللكبار تحديات مناسبة لا تلوين طفولي مفروض.`
      : `Requested activity style: ${selected}. Unless practice was chosen or allowedTypes excludes activity support, build one substantive activity with an optional short understanding check. One page: usually 1–3 items; two pages: light variety of 2–5 items. Do not claim alignment to a specific curriculum without a source. Younger children need brief instructions and larger response spaces; older learners need age-appropriate challenges, not forced childish coloring.`,
    ar
      ? `الحجم ${opts.pages} صفحة A4 يشمل الترويسة والتعليمات وكل مساحات العمل. ميزانية محتوى محافظة: نحو ${opts.pages * 550} بكسل ارتفاع للأعمال نفسها، لا تملأ الورقة بنصوص. استخدم 1–3 أنواع مترابطة فقط، وليس جميع الأنواع.`
      : `${opts.pages} A4 pages must include headers, instructions and response space. Conservative work-content budget: about ${opts.pages * 550}px in height, not dense text. Use only 1–3 coherent types, never the full inventory.`,
    Object.keys(c).length
      ? `${ar ? "اختيارات المعلم الملزمة، لها الأولوية على الاقتراحات والقيم الافتراضية" : "Binding teacher constraints; these take precedence over suggestions and defaults"}: ${JSON.stringify(c)}.`
      : (ar ? "لم يحدد المعلم إعدادات متقدمة: اختر الهدف والصعوبة والمدة والمهارة والتمايز المناسبين بنفسك، ولا تتعامل مع القيم الافتراضية كتوجيه ملزم." : "No advanced settings were chosen: infer suitable objective, difficulty, duration, skill and differentiation yourself; defaults are not binding instructions."),
    opts.executionMode === "group" || selected === "group_task"
      ? (ar
        ? `التنفيذ جماعي من ${opts.groupSize ?? 4} طلاب: أضف نشاط group_task بأدوار بعدد الأفراد وخطوات تعاون تحتاج نقاشاً وقراراً مشتركاً، ثم مساحة ناتج واحد. لا تجعلها أسئلة فردية بعنوان مجموعة.`
        : `Group execution with ${opts.groupSize ?? 4} students: include group_task with exactly that many roles, genuine discussion and shared decisions, and one common output space. Do not simply relabel an individual test.`)
      : "",
    "Activity data is a structured printable extension on type='short_answer'; answer is the TEACHER rubric/model response, never a student-visible prefilled answer. Use activity:{kind:'concept_map',center:'topic',branches:['branch prompt','branch prompt'],spaceHeight:120} for 2–6 blank branch boxes; drawing:{kind:'drawing',spaceHeight:140} for a large drawing frame; coloring:{kind:'coloring',spaceHeight:60} MUST accompany an accurate visual with unshaded outlines to color; sorting:{kind:'sorting',items:['unsorted item','unsorted item'],categories:['category','category'],spaceHeight:100}; sequencing:{kind:'sequencing',items:['shuffled event','shuffled event'],spaceHeight:100}; group_task:{kind:'group_task',roles:['reader','writer','speaker','coordinator'],steps:['discuss','agree on evidence'],spaceHeight:120}. Every example is the activity property, not a new question type. Supply all required fields, 2–8 items, 2–4 categories, 2–5 steps, 2–6 roles. Branches are prompts/hints, not filled answers. Shuffle source items, don't reveal their target order/categories. No HTML/SVG/URLs supplied by the model. Drawing instructions may ask the learner to create a picture; coloring instructions MUST have the actual visual. If supported geometry cannot depict the requested art, choose another COMPLETE suitable activity in auto; never pretend an absent picture exists.",
    "Complete valid coloring item example (adapt its educational content, preserve the structure): {\"type\":\"short_answer\",\"prompt\":\"Color the circle blue and the rectangle red.\",\"answer\":\"Circle blue; rectangle red.\",\"activity\":{\"kind\":\"coloring\",\"spaceHeight\":60},\"visual\":{\"shapes\":[{\"kind\":\"circle\",\"x\":20,\"y\":20,\"width\":60,\"height\":60,\"shaded\":false},{\"kind\":\"rectangle\",\"x\":110,\"y\":20,\"width\":80,\"height\":50,\"shaded\":false}]}}. Each shape must use numeric x,y,width,height: x>=5,y>=5,width and height between5 and100,x+width<=295,y+height<=145. Do NOT set type to coloring/drawing/activity. These names belong only to activity.kind.",
    selected !== "auto" && selected !== "practice"
      ? `Include at least one activity.kind="${selected}" exactly. Do not replace the selected activity with ordinary questions.`
      : "",
    c.itemCount ? `Return exactly ${c.itemCount} items in questions, with space within ${opts.pages} pages.` : "",
    c.allowedTypes ? `Use ONLY these question types: ${c.allowedTypes.join(", ")}${", plus tic_tac_toe only if separately explicitly requested"}.` : "",
  ].filter(Boolean).join("\n");
}

export function validateWorksheetActivityRequest(opts: {
  activityStyle?: WorksheetActivityStyle; executionMode?: "individual" | "group";
  generationConstraints?: WorksheetGenerationConstraints; counts: Record<string, number>;
}) {
  const needsActivity = opts.executionMode === "group" || (opts.activityStyle && !["auto", "practice"].includes(opts.activityStyle));
  if (needsActivity && opts.counts.short_answer === 0) {
    throw new Error("The selected activity needs short_answer support. Include it in allowed types or choose another activity.");
  }
}

export function validateWorksheetActivityOutput(
  questions: Array<{ type: string; activity?: { kind: string; roles?: string[] } }>,
  opts: { activityStyle?: WorksheetActivityStyle; executionMode?: "individual" | "group"; groupSize?: number; generationConstraints?: WorksheetGenerationConstraints; counts: Record<string, number> },
): string | null {
  const c = opts.generationConstraints;
  if (c?.itemCount && questions.length !== c.itemCount) return "Teacher item count was not respected";
  if (c?.allowedTypes && questions.some(q => q.type !== "tic_tac_toe" && !c.allowedTypes!.includes(q.type as NonNullable<typeof c.allowedTypes>[number]))) return "Teacher allowed types were not respected";
  if (opts.activityStyle && !["auto", "practice"].includes(opts.activityStyle) && !questions.some(q => q.activity?.kind === opts.activityStyle)) return "Selected activity format is missing";
  if (opts.activityStyle === "auto" && opts.counts.short_answer > 0 && !questions.some(q => q.activity) && c?.assessmentMode !== "summative") return "Automatic generation did not provide a printable learning activity";
  if ((opts.executionMode === "group" || opts.activityStyle === "group_task") && !questions.some(q => q.activity?.kind === "group_task" && q.activity.roles?.length === (opts.groupSize ?? 4))) return "Shared group task or exact role count is missing";
  return null;
}