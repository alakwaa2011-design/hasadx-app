import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, assistantOperationsTable, assignmentsTable, questionsTable, savedGameActivitiesTable, lessonPlansTable, type AssistantOperationRow } from "@workspace/db";
import { QuoteAssistantWorksheetBody } from "@workspace/api-zod";
import { generateAssistantQuestionSet } from "../routes/ai-questions";
import { generateLessonPlanContent } from "../routes/lesson_plans";
import { gameContentFingerprint } from "./saved-game-activities";
import { resolveAiContentLanguage } from "./ai-content-language";
import { assistantGameDraft, type AssistantGameType } from "./assistant-game-content";

export type AssistantTool = "worksheet" | "game" | "quiz" | "lesson-plan";
export const toolSchema = z.enum(["worksheet", "game", "quiz", "lesson-plan"]);
/** Only an explicit creation request chooses a tool; mentions inside worksheet content do not. */
export function resolveAssistantToolIntent(message: string, fallback: AssistantTool): AssistantTool {
  const text = message.replace(/[\u064B-\u065F\u0670]/g, "").trim();
  const match = text.match(/^(?:(?:أريد|اريد|أحتاج|احتاج|أنشئ|انشئ|اصنع|اعمل|أعد|اعد|جهز|حضر|بدلها|غيرها|حولها|create|make|prepare|I want|I need)\s+)?(?:(?:أن|ان)\s+)?(?:(?:تنشئ|تصنع|تجهز|تعد)\s+)?(?:(?:لي|me)\s+)?(?:(?:إلى|الى|to|a|an)\s+)?(ورقة(?:\s+عمل)?|worksheet|لعبة|game|اختبار|quiz|تحضير(?:\s+درس)?|خطة(?:\s+درس)?|lesson\s+plan)(?=\s|$|[،,.!؟?:])/i);
  if (!match) return fallback;
  const noun = match[1].toLowerCase();
  return /^(?:ورقة|worksheet)/.test(noun) ? "worksheet" : /^(?:لعبة|game)/.test(noun) ? "game"
    : /^(?:اختبار|quiz)/.test(noun) ? "quiz" : "lesson-plan";
}
export function assistantCreditTool(tool: string) {
  return tool === "worksheet" ? "worksheet" : tool === "lesson-plan" ? "lesson-plan" : "ai-questions";
}
export function assistantResultUrl(row: Pick<AssistantOperationRow, "tool" | "worksheetId" | "resultId" | "parameters">) {
  if (row.tool === "worksheet") return row.worksheetId ? `/teacher/worksheets/create?edit=${row.worksheetId}` : null;
  if (!row.resultId) return null;
  if (row.tool === "lesson-plan") return `/teacher/lesson-plans/create?edit=${row.resultId}`;
  if (row.tool === "quiz") return `/teacher/assignment/${row.resultId}`;
  if (row.parameters.gameType === "solo") return `/teacher/solo-challenges/new?savedGameId=${row.resultId}`;
  if (row.parameters.gameType === "wameeth_class") return `/game/wameeth/create?savedGameId=${row.resultId}`;
  if (row.parameters.gameType === "self") return `/teacher/solo-challenges/new?savedGameId=${row.resultId}`;
  if (row.parameters.gameType === "hack") return `/game/hack?savedGameId=${row.resultId}`;
  return `/game/${row.parameters.gameType}/create?savedGameId=${row.resultId}`;
}
const toolParameters = z.object({
  topic: z.string().max(500).default(""), sourceText: z.string().max(12000).optional(),
  subject: z.string().trim().min(1).max(100), gradeLevel: z.string().trim().min(1).max(50),
  language: z.enum(["ar", "en"]).default("ar"),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("medium"),
  questionCount: z.number().int().min(1).max(30).default(5),
  questionTypes: z.array(z.enum(["mcq", "true_false"])).min(1).max(30).optional(),
  gameType: z.enum(["solo", "wameeth_class", "tug", "xo", "wheel", "rocket", "hack", "self"]).default("solo"),
  durationMinutes: z.number().int().min(15).max(180).default(45),
  pedagogy: z.enum(["direct", "inquiry", "project", "flipped", "mixed"]).default("mixed"),
  notes: z.string().max(800).optional(),
}).refine(p => !!(p.topic.trim() || p.sourceText?.trim()), { message: "Topic is required" });
export function validateAssistantToolRequest(input: unknown, tool: string) {
  const parsed = QuoteAssistantWorksheetBody.parse(input);
  const parameters = toolParameters.parse(parsed.parameters);
  if (tool === "game" && parameters.gameType === "xo" && parameters.questionCount < 9) {
    throw Object.assign(new Error("XO needs at least nine questions"), { status: 400, code: "INVALID_COUNTS" });
  }
  if (tool === "game" && parameters.gameType === "wameeth_class" && parameters.questionCount < 2) {
    throw Object.assign(new Error("Classroom Wameeth needs at least two questions"), { status: 400, code: "INVALID_COUNTS" });
  }
  if (tool === "game" && parameters.gameType === "wheel" && (parameters.questionCount < 2 || parameters.questionCount > 16)) {
    throw Object.assign(new Error("Challenge wheel needs 2–16 questions"), { status: 400, code: "INVALID_COUNTS" });
  }
  return { title: parsed.title.trim(), template: "geometric", parameters };
}

const subjectHints: Array<[RegExp, string, string]> = [
  [/كسور|رياضيات|جمع|طرح|ضرب|قسمة|مثلث|fraction|math|addition|triangle/i, "الرياضيات", "Mathematics"],
  [/علوم|الماء|النبات|الكائنات|الطاقة|الكهرباء|science|water|plants|energy/i, "العلوم", "Science"],
  [/قرآن|إسلام|وضوء|صلاة|حديث|ذكر الله|quran|islam|prayer/i, "التربية الإسلامية", "Islamic education"],
  [/نحو|حروف|لغتي|عربية|grammar|arabic/i, "اللغة العربية", "Arabic"],
];
/** Only unambiguous first requests bypass AI. Complex teacher choices use the normal parser. */
export function fastAssistantPreparation(message: string, language: "ar" | "en", tool: AssistantTool, previous?: AssistantOperationRow, selectedGameType?: AssistantGameType) {
  if (previous || message.length > 600) return null;
  const normalized = message.replace(/[٠-٩]/g, n => String("٠١٢٣٤٥٦٧٨٩".indexOf(n)));
  const contentLanguage = resolveAiContentLanguage({ preferredLanguage: language, primaryText: message });
  if (!/^\s*(?:(?:أنشئ|اصنع|اعمل|أعد|جهز|أريد|اريد|حضّر|حضر|create|make|prepare)\s+)?(?:ورقة(?:\s+عمل)?|اختبار|لعبة|تحضير(?:\s+درس)?|خطة(?:\s+درس)?|محتوى|worksheet|quiz|game|lesson plan)\s+(?:عن|حول|about|on)\s+/i.test(normalized)) return null;
  const intent = /ورقة|worksheet/i.test(normalized) ? "worksheet" : /اختبار|quiz/i.test(normalized) ? "quiz"
    : /لعبة|game/i.test(normalized) ? "game" : /تحضير|خطة.*درس|lesson plan/i.test(normalized) ? "lesson-plan" : null;
  if (intent && intent !== tool) return null;
  if (/https?:|مرفق|صورة|ملف|حذف|نشر|تكليف|تعديل.*(?:سابقة|موجودة)|تفريد|مخطط|خريطة|تلوين|رسم|فقط|حصري|تعاوني|إجابة قصيرة|أكمل|اختر|اختيار|صح.*خطأ|true.false/i.test(normalized)) return null;
  if (tool === "worksheet" && /سؤال|أسئلة|اسئلة|questions?|تمارين|صعب|سهل|متنوع|صفحت|صفحات|pages?|تصميم|قالب/i.test(normalized)) return null;
  const grade = normalized.match(/(?:لل?صف|الصف|grade)\s+([^\s،,.]+(?:\s+عشر)?)/i)?.[1];
  const topic = normalized.match(/(?:عن|حول|about|on)\s+(.+?)(?=\s+(?:لل?صف|الصف|for\s+grade|grade|من\s+\d|بـ?\s*\d)|$)/i)?.[1]?.trim();
  const subject = subjectHints.find(([pattern]) => pattern.test(normalized));
  if (!grade || !topic || !subject) return null;
  const countText = normalized.match(/(?:من|بـ?)?\s*(\d+)\s*(?:أسئلة|اسئلة|سؤال|questions?)/i);
  const gameType = selectedGameType ?? (/عجلة|wheel/i.test(normalized) ? "wheel" : /صواريخ|rocket/i.test(normalized) ? "rocket" : /اختراق|hack/i.test(normalized) ? "hack" : /ذاتية|self/i.test(normalized) ? "self" : /وميض الصف|wameeth classroom/i.test(normalized) ? "wameeth_class" : /شد الحبل|tug/i.test(normalized) ? "tug" : /(?:إكس|اكس|X\s*O)/i.test(normalized) ? "xo" : "solo");
  const questionCount = countText ? Number(countText[1]) : tool === "game" && gameType === "xo" ? 9 : 5;
  if (questionCount < 1 || questionCount > 30) return null;
  if (/دقيقة|minutes?|استقصاء|مشروع|مقلوب|صفحة|صعب|سهل|متوسط|سؤالين|سؤالان|إنجليزي|إنجليزية|English|عربي[ة]?|ابتدائي|متوسّ?ط|ثانوي/i.test(normalized)) return null;
  return {
    supported: true, title: topic,
    reply: language === "ar" ? "جهّزت طلبك. راجع الملخص، ويمكنك تعديل التفاصيل قبل الإنشاء." : "Your request is ready. Review the summary or edit its details before creating.",
    parameters: {
      topic, subject: contentLanguage === "ar" ? subject[1] : subject[2], gradeLevel: grade, language: contentLanguage,
      pages: 1, questionSelection: "auto", difficulty: "medium", questionCount,
      gameType,
      durationMinutes: 45, pedagogy: "mixed",
    },
  };
}

export async function generateAssistantToolOutput(req: Request, row: AssistantOperationRow): Promise<Record<string, unknown>> {
  const p = toolParameters.parse(row.parameters);
  if (row.tool === "lesson-plan") return generateLessonPlanContent(req, p);
  const generated = await generateAssistantQuestionSet(req, {
    topic: p.topic, sourceText: p.sourceText, subject: p.subject, gradeLevel: p.gradeLevel,
    notes: row.tool === "game" ? [
      `Game format: ${p.gameType}. Write clear, independently answerable questions suitable for quick gameplay, not printable worksheet activities. Output all questions and choices in ${p.language === "ar" ? "Arabic" : "English"}.`,
      p.notes,
    ].filter(Boolean).join("\n") : p.notes,
    count: p.questionCount, language: p.language, difficulty: p.difficulty === "mixed" ? "medium" : p.difficulty,
    questionTypes: p.questionTypes ?? ["mcq"],
  });
  if (generated.questions.length !== p.questionCount) throw new Error("Generated question count did not match the confirmed request");
  return { questions: generated.questions, language: p.language };
}

/** Saving the result and its receipt is atomic, so retries cannot create copies. */
export async function saveAssistantToolOutput(row: AssistantOperationRow, output: Record<string, any>) {
  return db.transaction(async tx => {
    const [locked] = await tx.select().from(assistantOperationsTable).where(eq(assistantOperationsTable.id, row.id)).for("update");
    if (locked.resultId) return locked.resultId;
    let resultId: number;
    if (row.tool === "lesson-plan") {
      const [plan] = await tx.insert(lessonPlansTable).values({
        teacherId: row.teacherId, clientRequestId: row.id, title: row.title,
        language: output.language, subject: String(row.parameters.subject), gradeLevel: String(row.parameters.gradeLevel),
        durationMinutes: Number(row.parameters.durationMinutes ?? 45), sections: output.sections,
        settings: { includeObjectives: true, includeMaterials: true, includeVocabulary: true, includeWarmUp: true,
          includeIntroduction: true, includeActivities: true, includeAssessment: true, includeClosure: true,
          includeHomework: true, includeDifferentiation: true, includeNotes: true },
        isShared: false,
      }).returning();
      resultId = plan.id;
    } else if (row.tool === "quiz") {
      const [assignment] = await tx.insert(assignmentsTable).values({
        teacherId: row.teacherId, title: row.title, subject: String(row.parameters.subject),
        description: `${row.parameters.gradeLevel}`, accessMode: "private", accessCode: randomUUID(),
        isShared: false, isShareApproved: false, source: "assistant", submissionMode: "electronic",
        totalPoints: output.questions.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0),
      }).returning();
      await tx.insert(questionsTable).values(output.questions.map((q: any) => ({
        assignmentId: assignment.id, questionType: q.questionType, text: q.text,
        optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
        correctAnswer: q.correctAnswer, points: q.points ?? 1,
      })));
      resultId = assignment.id;
    } else {
      const gameType = String(row.parameters.gameType ?? "solo") as AssistantGameType;
      const draft = assistantGameDraft(gameType, output.questions, output.language);
      let assignmentId: number | undefined;
      // Hack rooms use the existing owned-assignment launch path. Its backing
      // questions are private and saved atomically with the game, never assigned.
      if (gameType === "hack") {
        const [assignment] = await tx.insert(assignmentsTable).values({
          teacherId: row.teacherId, title: row.title, subject: String(row.parameters.subject),
          description: String(row.parameters.gradeLevel), accessMode: "private", accessCode: randomUUID(),
          isShared: false, isShareApproved: false, source: "assistant_game", submissionMode: "electronic",
          totalPoints: output.questions.reduce((sum: number, q: any) => sum + (Number(q.points) || 1), 0),
        }).returning();
        assignmentId = assignment.id;
        await tx.insert(questionsTable).values(output.questions.map((q: any) => ({
          assignmentId: assignment.id, questionType: q.questionType, text: q.text,
          optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
          correctAnswer: q.correctAnswer, points: q.points ?? 1,
        })));
      }
      const content = Array.isArray(draft.content) ? draft.content : {
        ...draft.content, ...(assignmentId ? { assignmentId } : {}),
        topic: row.parameters.topic, subject: row.parameters.subject, source: "ai", assistantOperationId: row.id,
      };
      const [game] = await tx.insert(savedGameActivitiesTable).values({
        teacherId: row.teacherId, gameType: draft.gameType, title: row.title, content,
        settings: draft.settings,
        source: "assistant", isShared: false, publishedAt: null, playCount: 0,
        contentFingerprint: gameContentFingerprint(draft.gameType, content), questionCount: output.questions.length,
      }).returning();
      resultId = game.id;
    }
    await tx.update(assistantOperationsTable).set({ resultId, updatedAt: new Date() })
      .where(and(eq(assistantOperationsTable.id, row.id), eq(assistantOperationsTable.teacherId, row.teacherId)));
    return resultId;
  });
}
