import { z } from "zod";

/** Structured printable artwork only: no model-provided SVG, HTML or URLs. */
export const worksheetVisualSchema = z.object({
  caption: z.string().max(200).optional(),
  shapes: z.array(z.object({
    kind: z.enum(["circle", "rectangle", "triangle", "line"]),
    x: z.number().min(5).max(285),
    y: z.number().min(5).max(135),
    width: z.number().min(5).max(100),
    height: z.number().min(5).max(100),
    shaded: z.boolean().default(false),
    label: z.string().max(40).optional(),
  }).refine(s => s.x + s.width <= 295 && s.y + s.height <= 145, "Shape must fit the printed diagram")).min(1).max(24),
});

export function automaticWorksheetCounts(pages: number, board = 0) {
  const max = Math.min(40, pages * 30);
  return {
    mcq: max, true_false: max, short_answer: max, fill_blank: max,
    matching: Math.min(10, max), worked_problem: max, extended_response: max,
    error_correction: max, word_bank: Math.min(10, max), compare: Math.min(10, max),
    tic_tac_toe: board === 1 ? 1 : 0,
  };
}

export function automaticWorksheetGuidance(language: "ar" | "en", pages: number) {
  return language === "ar"
    ? `اختيار أنواع الأسئلة تلقائي: أنت المسؤول عن اختيار الأنواع وتوزيعها وفق المادة والصف والعمر والموضوع والمحتوى المرجعي والهدف التعليمي والصعوبة ومدة النشاط. لا تستخدم توزيعاً ثابتاً، ولا تفرض اختياراً من متعدد أو صح وخطأ على كل درس. اختر مزيجاً تربوياً مناسباً من الأنواع المدعومة، ويمكن الاكتفاء بنوع واحد إذا كان الأنسب. استهدف نحو ${pages * 8} إلى ${pages * 12} سؤالاً قصيراً أو عدداً أقل للمقالي والمهام الممتدة، وبحد أقصى ${pages * 30} سؤالاً إجمالاً، مع ترك مساحة الإجابة ضمن الصفحات. للصغار استخدم التمييز البصري والعد والتوصيل والرسم عندما يناسب المحتوى؛ وللكبار مسائل وتفسيراً ومقارنة ومقالياً بحسب المادة. لا تطلب من المعلم اختيار الأنواع. لا تنشئ لوحة tic_tac_toe إلا إذا كانت مطلوبة صراحة.`
    : `Automatic question selection: choose types and their distribution based on subject, grade, age, topic, source content, learning objective, difficulty and activity duration. Never use a fixed distribution or force MCQ/true-false on every lesson. Select a pedagogically appropriate mix of supported types; one type is allowed when best suited. Aim for roughly ${pages * 8}-${pages * 12} short questions, fewer for extended tasks, at most ${pages * 30} questions total, leaving writing space within the page target. Use visual discrimination, counting, matching and drawing for younger learners when relevant; problems, explanations, comparisons and essays for older learners as appropriate. Do not ask the teacher to select types. Only create tic_tac_toe if explicitly requested.`;
}

export const worksheetVisualGuidance = `Optional visual on any question: {"caption":"...","shapes":[{"kind":"circle|rectangle|triangle|line","x":20,"y":20,"width":30,"height":30,"shaded":false,"label":"A"}]}. This is a 300x150 diagram; every shape must fit inside it (x+width<=295,y+height<=145). Use accurate, simple printable diagrams for counting, geometry, shaded fractions or comparisons ONLY when they help answer the question. Never refer to an unseen figure: provide the visual with the question. Do not reveal answers through labels, invent an image URL, or emit SVG/HTML. For complex artwork beyond these supported shapes, choose an alternative complete question rather than referring to a missing illustration.`;