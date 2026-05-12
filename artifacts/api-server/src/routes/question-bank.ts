import { Router, type IRouter } from "express";
import { db, questionBankTable, questionsTable, assignmentsTable, teachersTable, dismissedSharedTable } from "@workspace/db";
import { eq, and, sql, ne, or, notInArray } from "drizzle-orm";
import { z } from "zod";

const MCQ_ANSWER_RE = /^[A-D](,[A-D])*$/;
const QUESTION_TYPES = ["mcq", "true_false", "fill_blank", "whiteboard", "whiteboard_blank"] as const;
const validateCorrectAnswer = (
  val: string | null | undefined,
  allowMultiple: boolean | undefined,
  questionType: string | undefined,
) => {
  if (!val) return true;
  const qt = questionType || "mcq";
  if (qt === "true_false") return val === "true" || val === "false";
  if (qt === "fill_blank" || qt === "whiteboard" || qt === "whiteboard_blank") return true;
  // mcq
  if (allowMultiple) return MCQ_ANSWER_RE.test(val);
  return ["A", "B", "C", "D"].includes(val);
};

const CreateBankQuestionBody = z.object({
  subject: z.string(),
  questionType: z.enum(QUESTION_TYPES).optional(),
  text: z.string().min(1),
  optionA: z.string().nullish(),
  optionB: z.string().nullish(),
  optionC: z.string().nullish(),
  optionD: z.string().nullish(),
  correctAnswer: z.string().nullish(),
  points: z.number().min(0).default(1),
  tags: z.string().nullish(),
  imageUrl: z.string().nullish(),
  isShared: z.boolean().optional(),
  allowMultipleAnswers: z.boolean().optional(),
  repeatQuestion: z.boolean().optional(),
}).refine(
  (d) => validateCorrectAnswer(d.correctAnswer ?? null, d.allowMultipleAnswers, d.questionType),
  { message: "صيغة الإجابة الصحيحة غير صالحة", path: ["correctAnswer"] }
);

const UpdateBankQuestionBody = z.object({
  subject: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
  optionA: z.string().nullish(),
  optionB: z.string().nullish(),
  optionC: z.string().nullish(),
  optionD: z.string().nullish(),
  correctAnswer: z.string().nullish(),
  points: z.number().min(0).optional(),
  tags: z.string().nullish(),
  imageUrl: z.string().nullish(),
  isShared: z.boolean().optional(),
  allowMultipleAnswers: z.boolean().optional(),
  repeatQuestion: z.boolean().optional(),
});

const ImportFromAssignmentBody = z.object({
  assignmentId: z.number(),
});

const router: IRouter = Router();

router.get("/question-bank", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const subject = req.query.subject as string | undefined;

    let query = db
      .select()
      .from(questionBankTable)
      .where(eq(questionBankTable.teacherId, req.session.teacherId))
      .orderBy(sql`${questionBankTable.createdAt} DESC`);

    const results = await query;

    const filtered = subject
      ? results.filter((q) => q.subject === subject)
      : results;

    res.json(filtered.map((q) => ({
      id: q.id,
      subject: q.subject,
      questionType: q.questionType,
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
      points: q.points,
      tags: q.tags,
      imageUrl: q.imageUrl,
      isShared: q.isShared,
      allowMultipleAnswers: q.allowMultipleAnswers ?? false,
      repeatQuestion: q.repeatQuestion ?? false,
      createdAt: q.createdAt.toISOString(),
    })));
  } catch (error: any) {
    req.log.error({ err: error }, "List question bank error");
    res.status(500).json({ message: "خطأ في جلب بنك الأسئلة" });
  }
});

router.post("/question-bank", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const body = CreateBankQuestionBody.parse(req.body);

    const [question] = await db
      .insert(questionBankTable)
      .values({
        teacherId: req.session.teacherId,
        subject: body.subject,
        questionType: body.questionType || "mcq",
        text: body.text,
        optionA: body.optionA || null,
        optionB: body.optionB || null,
        optionC: body.optionC || null,
        optionD: body.optionD || null,
        correctAnswer: body.correctAnswer || null,
        points: body.points || 1,
        tags: body.tags || null,
        imageUrl: body.imageUrl || null,
        isShared: body.isShared === false ? false : true,
        allowMultipleAnswers: body.allowMultipleAnswers ?? false,
        repeatQuestion: body.repeatQuestion ?? false,
      })
      .returning();

    res.status(201).json({
      id: question.id,
      subject: question.subject,
      text: question.text,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      points: question.points,
      tags: question.tags,
      imageUrl: question.imageUrl,
      allowMultipleAnswers: question.allowMultipleAnswers ?? false,
      repeatQuestion: question.repeatQuestion ?? false,
      createdAt: question.createdAt.toISOString(),
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Create question bank error");
    res.status(400).json({ message: error.message || "خطأ في إضافة السؤال" });
  }
});

router.post("/question-bank/bulk", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const body = z.array(CreateBankQuestionBody).parse(req.body);

    if (body.length === 0) {
      res.status(400).json({ message: "لا توجد أسئلة" });
      return;
    }

    const questions = await db
      .insert(questionBankTable)
      .values(
        body.map((q) => ({
          teacherId: req.session.teacherId!,
          subject: q.subject,
          questionType: q.questionType || "mcq",
          text: q.text,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
          points: q.points || 1,
          tags: q.tags || null,
          imageUrl: q.imageUrl || null,
          allowMultipleAnswers: q.allowMultipleAnswers ?? false,
          repeatQuestion: q.repeatQuestion ?? false,
        }))
      )
      .returning();

    res.status(201).json(questions.map((q) => ({
      id: q.id,
      subject: q.subject,
      questionType: q.questionType,
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
      points: q.points,
      tags: q.tags,
      imageUrl: q.imageUrl,
      allowMultipleAnswers: q.allowMultipleAnswers ?? false,
      repeatQuestion: q.repeatQuestion ?? false,
      createdAt: q.createdAt.toISOString(),
    })));
  } catch (error: any) {
    req.log.error({ err: error }, "Bulk create question bank error");
    res.status(400).json({ message: error.message || "خطأ في إضافة الأسئلة" });
  }
});

router.post("/question-bank/import-from-assignment", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const body = ImportFromAssignmentBody.parse(req.body);

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.id, body.assignmentId),
          eq(assignmentsTable.teacherId, req.session.teacherId)
        )
      )
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, body.assignmentId));

    if (questions.length === 0) {
      res.status(400).json({ message: "الواجب لا يحتوي على أسئلة" });
      return;
    }

    const bankQuestions = await db
      .insert(questionBankTable)
      .values(
        questions.map((q) => ({
          teacherId: req.session.teacherId!,
          subject: assignment.subject ?? "",
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          points: q.points || 1,
          tags: null,
          imageUrl: q.imageUrl || null,
          allowMultipleAnswers: q.allowMultipleAnswers ?? false,
          repeatQuestion: q.repeatQuestion ?? false,
        }))
      )
      .returning();

    res.status(201).json({
      count: bankQuestions.length,
      questions: bankQuestions.map((q) => ({
        id: q.id,
        subject: q.subject,
        text: q.text,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        points: q.points,
        tags: q.tags,
        allowMultipleAnswers: q.allowMultipleAnswers ?? false,
        repeatQuestion: q.repeatQuestion ?? false,
        createdAt: q.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Import from assignment error");
    res.status(400).json({ message: error.message || "خطأ في استيراد الأسئلة" });
  }
});

router.put("/question-bank/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const qId = parseInt(req.params.id, 10);
    if (isNaN(qId)) {
      res.status(400).json({ message: "معرف غير صالح" });
      return;
    }

    const [existing] = await db
      .select()
      .from(questionBankTable)
      .where(
        and(
          eq(questionBankTable.id, qId),
          eq(questionBankTable.teacherId, req.session.teacherId)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "السؤال غير موجود" });
      return;
    }

    const body = UpdateBankQuestionBody.parse(req.body);
    const updateData: Record<string, any> = {};
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.text !== undefined) updateData.text = body.text;
    if (body.optionA !== undefined) updateData.optionA = body.optionA || null;
    if (body.optionB !== undefined) updateData.optionB = body.optionB || null;
    if (body.optionC !== undefined) updateData.optionC = body.optionC || null;
    if (body.optionD !== undefined) updateData.optionD = body.optionD || null;
    if (body.correctAnswer !== undefined) updateData.correctAnswer = body.correctAnswer || null;
    if (body.points !== undefined) updateData.points = body.points;
    if (body.tags !== undefined) updateData.tags = body.tags || null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null;
    if (body.isShared !== undefined) updateData.isShared = body.isShared;
    if (body.allowMultipleAnswers !== undefined) updateData.allowMultipleAnswers = body.allowMultipleAnswers;
    if (body.repeatQuestion !== undefined) updateData.repeatQuestion = body.repeatQuestion;

    const [updated] = await db
      .update(questionBankTable)
      .set(updateData)
      .where(eq(questionBankTable.id, qId))
      .returning();

    res.json({
      id: updated.id,
      subject: updated.subject,
      text: updated.text,
      optionA: updated.optionA,
      optionB: updated.optionB,
      optionC: updated.optionC,
      optionD: updated.optionD,
      correctAnswer: updated.correctAnswer,
      points: updated.points,
      tags: updated.tags,
      imageUrl: updated.imageUrl,
      allowMultipleAnswers: updated.allowMultipleAnswers ?? false,
      repeatQuestion: updated.repeatQuestion ?? false,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Update question bank error");
    res.status(400).json({ message: error.message || "خطأ في تعديل السؤال" });
  }
});

router.delete("/question-bank/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const qId = parseInt(req.params.id, 10);
    if (isNaN(qId)) {
      res.status(400).json({ message: "معرف غير صالح" });
      return;
    }

    const [existing] = await db
      .select()
      .from(questionBankTable)
      .where(
        and(
          eq(questionBankTable.id, qId),
          eq(questionBankTable.teacherId, req.session.teacherId)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "السؤال غير موجود" });
      return;
    }

    await db.delete(questionBankTable).where(eq(questionBankTable.id, qId));
    res.json({ message: "تم حذف السؤال بنجاح" });
  } catch (error: any) {
    req.log.error({ err: error }, "Delete question bank error");
    res.status(500).json({ message: "خطأ في حذف السؤال" });
  }
});

router.patch("/question-bank/:id/share", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const qId = parseInt(req.params.id, 10);
    const { isShared } = req.body;
    const [updated] = await db
      .update(questionBankTable)
      .set({ isShared: !!isShared })
      .where(and(eq(questionBankTable.id, qId), eq(questionBankTable.teacherId, req.session.teacherId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "السؤال غير موجود" });
      return;
    }
    res.json({ id: updated.id, isShared: updated.isShared });
  } catch (error: any) {
    req.log.error({ err: error }, "Toggle share error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.get("/question-bank/shared", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const teacherId = req.session.teacherId!;
    const dismissed = await db
      .select({ itemId: dismissedSharedTable.itemId })
      .from(dismissedSharedTable)
      .where(and(
        eq(dismissedSharedTable.teacherId, teacherId),
        eq(dismissedSharedTable.itemType, "question")
      ));
    const dismissedIds = dismissed.map(d => d.itemId);

    // Admin-only opt-in to surface admin-hidden rows for moderation. We
    // verify admin by DB lookup so a non-admin cannot bypass the filter
    // simply by appending ?showHidden=1.
    const wantHidden = req.query.showHidden === "1" || req.query.showHidden === "true";
    let isAdminRequester = false;
    if (wantHidden) {
      const [me] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
      isAdminRequester = !!me?.isAdmin;
    }

    const results = await db
      .select({
        id: questionBankTable.id,
        subject: questionBankTable.subject,
        text: questionBankTable.text,
        optionA: questionBankTable.optionA,
        optionB: questionBankTable.optionB,
        optionC: questionBankTable.optionC,
        optionD: questionBankTable.optionD,
        correctAnswer: questionBankTable.correctAnswer,
        points: questionBankTable.points,
        tags: questionBankTable.tags,
        imageUrl: questionBankTable.imageUrl,
        isShared: questionBankTable.isShared,
        hiddenByAdmin: questionBankTable.hiddenByAdmin,
        allowMultipleAnswers: questionBankTable.allowMultipleAnswers,
        repeatQuestion: questionBankTable.repeatQuestion,
        teacherId: questionBankTable.teacherId,
        teacherName: teachersTable.name,
        isAdminContent: teachersTable.isAdmin,
        createdAt: questionBankTable.createdAt,
      })
      .from(questionBankTable)
      .leftJoin(teachersTable, eq(questionBankTable.teacherId, teachersTable.id))
      .where(and(
        eq(questionBankTable.isShared, true),
        (wantHidden && isAdminRequester) ? undefined : eq(questionBankTable.hiddenByAdmin, false),
        ne(questionBankTable.teacherId, teacherId),
        dismissedIds.length > 0 ? notInArray(questionBankTable.id, dismissedIds) : undefined
      ))
      .orderBy(sql`${questionBankTable.createdAt} DESC`);

    res.json(results.map(q => ({
      ...q,
      isAdminContent: !!q.isAdminContent,
      createdAt: q.createdAt.toISOString(),
    })));
  } catch (error: any) {
    req.log.error({ err: error }, "Shared questions error");
    res.status(500).json({ message: "خطأ في جلب الأسئلة المشتركة" });
  }
});

/* ── POST /question-bank/:id/import ──────────────────────────
   Import a shared question from another teacher into your bank */
router.post("/question-bank/:id/import", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ message: "معرّف غير صالح" }); return; }

    const [original] = await db
      .select()
      .from(questionBankTable)
      .where(and(
        eq(questionBankTable.id, id),
        eq(questionBankTable.isShared, true),
        // Admin-hidden items must not be importable even if the ID is known.
        eq(questionBankTable.hiddenByAdmin, false),
      ))
      .limit(1);

    if (!original) {
      res.status(404).json({ message: "السؤال غير موجود أو غير متاح للاستيراد" });
      return;
    }
    if (original.teacherId === req.session.teacherId) {
      res.status(400).json({ message: "هذا سؤالك الخاص" });
      return;
    }

    const [newQ] = await db
      .insert(questionBankTable)
      .values({
        teacherId: req.session.teacherId,
        subject: original.subject,
        text: original.text,
        optionA: original.optionA,
        optionB: original.optionB,
        optionC: original.optionC,
        optionD: original.optionD,
        correctAnswer: original.correctAnswer,
        points: original.points,
        imageUrl: original.imageUrl,
        tags: original.tags,
        isShared: false,
        allowMultipleAnswers: original.allowMultipleAnswers ?? false,
        repeatQuestion: original.repeatQuestion ?? false,
      })
      .returning();

    res.status(201).json({ id: newQ.id });
  } catch (err) {
    req.log.error(err, "Import question error");
    res.status(500).json({ message: "خطأ في الاستيراد" });
  }
});

export default router;
