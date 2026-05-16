import { Router, type IRouter } from "express";
import {
  db,
  videoLessonsTable,
  videoQuestionsTable,
  videoSubmissionsTable,
  videoAnswersTable,
  teachersTable,
  studentsTable,
} from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";
import { z } from "zod";
import { awardXpInTxAndNotifyAfterCommit } from "../lib/xp/socket";
import { reverseXpIfWithinWindow } from "../lib/xp/engine";

const router: IRouter = Router();

const SkipSegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
}).refine((s) => s.end > s.start, { message: "end must be greater than start" });

const CreateVideoLessonBody = z.object({
  title: z.string().min(1),
  subject: z.string().optional(),
  description: z.string().optional(),
  videoUrl: z.string().min(1),
  videoType: z.enum(["youtube", "upload", "external"]).default("youtube"),
  targetClass: z.string().nullish(),
  accessMode: z.enum(["public", "private"]).default("public"),
  accessCode: z.string().nullish(),
  isShared: z.boolean().optional(),
  skipSegments: z.array(SkipSegmentSchema).optional(),
  questions: z.array(
    z.object({
      timestampSeconds: z.number().min(0),
      questionType: z.enum(["mcq", "true_false", "fill_blank"]).default("mcq"),
      text: z.string().min(1),
      optionA: z.string().nullish(),
      optionB: z.string().nullish(),
      optionC: z.string().nullish(),
      optionD: z.string().nullish(),
      correctAnswer: z.string().nullish(),
      points: z.number().min(0).default(1),
    })
  ).min(1),
});

const UpdateVideoLessonBody = z.object({
  title: z.string().min(1).optional(),
  subject: z.string().optional(),
  description: z.string().optional(),
  videoUrl: z.string().min(1).optional(),
  videoType: z.enum(["youtube", "upload", "external"]).optional(),
  targetClass: z.string().nullish(),
  accessMode: z.enum(["public", "private"]).optional(),
  accessCode: z.string().nullish(),
  isShared: z.boolean().optional(),
  skipSegments: z.array(SkipSegmentSchema).optional(),
  questions: z.array(
    z.object({
      id: z.number().optional(),
      timestampSeconds: z.number().min(0),
      questionType: z.enum(["mcq", "true_false", "fill_blank"]).default("mcq"),
      text: z.string().min(1),
      optionA: z.string().nullish(),
      optionB: z.string().nullish(),
      optionC: z.string().nullish(),
      optionD: z.string().nullish(),
      correctAnswer: z.string().nullish(),
      points: z.number().min(0).default(1),
    })
  ).min(1).optional(),
});

const SubmitVideoLessonBody = z.object({
  studentName: z.string().min(1),
  studentClass: z.string().default(""),
  studentId: z.number().optional(),
  accessCode: z.string().optional(),
  answers: z.array(
    z.object({
      questionId: z.number(),
      selectedAnswer: z.string(),
    })
  ),
});

/** تحقق فوري أثناء التشغيل — نفس منطق المقارنة في submit */
const CheckVideoAnswerBody = z.object({
  questionId: z.number(),
  selectedAnswer: z.string(),
  accessCode: z.string().optional(),
});

router.get("/video-lessons", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const lessons = await db
      .select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        description: videoLessonsTable.description,
        videoUrl: videoLessonsTable.videoUrl,
        videoType: videoLessonsTable.videoType,
        targetClass: videoLessonsTable.targetClass,
        accessMode: videoLessonsTable.accessMode,
        teacherId: videoLessonsTable.teacherId,
        isPublished: videoLessonsTable.isPublished,
        isShared: videoLessonsTable.isShared,
        createdAt: videoLessonsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM video_questions WHERE video_questions.video_lesson_id = ${videoLessonsTable.id})`.as("question_count"),
        submissionCount: sql<number>`(SELECT COUNT(*) FROM video_submissions WHERE video_submissions.video_lesson_id = ${videoLessonsTable.id})`.as("submission_count"),
      })
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.teacherId, teacherId))
      .orderBy(desc(videoLessonsTable.createdAt));

    res.json(lessons);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/shared/all", async (req, res) => {
  try {
    // Admin-only opt-in to include hidden rows for moderation.
    const wantHidden = req.query.showHidden === "1" || req.query.showHidden === "true";
    let isAdminRequester = false;
    const requesterId = req.session.teacherId;
    if (wantHidden && requesterId) {
      const [me] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, requesterId)).limit(1);
      isAdminRequester = !!me?.isAdmin;
    }

    const lessons = await db
      .select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        description: videoLessonsTable.description,
        videoType: videoLessonsTable.videoType,
        targetClass: videoLessonsTable.targetClass,
        teacherId: videoLessonsTable.teacherId,
        teacherName: teachersTable.name,
        isAdminContent: teachersTable.isAdmin,
        isShared: videoLessonsTable.isShared,
        hiddenByAdmin: videoLessonsTable.hiddenByAdmin,
        createdAt: videoLessonsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM video_questions WHERE video_questions.video_lesson_id = ${videoLessonsTable.id})`.as("question_count"),
      })
      .from(videoLessonsTable)
      .leftJoin(teachersTable, eq(videoLessonsTable.teacherId, teachersTable.id))
      .where(and(
        eq(videoLessonsTable.isShared, true),
        (wantHidden && isAdminRequester) ? undefined : eq(videoLessonsTable.hiddenByAdmin, false),
      ))
      .orderBy(desc(videoLessonsTable.createdAt));

    res.json(lessons.map(l => ({ ...l, isAdminContent: !!l.isAdminContent })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/shared", async (req, res) => {
  try {
    const lessons = await db
      .select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        description: videoLessonsTable.description,
        videoType: videoLessonsTable.videoType,
        targetClass: videoLessonsTable.targetClass,
        teacherId: videoLessonsTable.teacherId,
        teacherName: teachersTable.name,
        isShared: videoLessonsTable.isShared,
        createdAt: videoLessonsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM video_questions WHERE video_questions.video_lesson_id = ${videoLessonsTable.id})`.as("question_count"),
      })
      .from(videoLessonsTable)
      .leftJoin(teachersTable, eq(videoLessonsTable.teacherId, teachersTable.id))
      .where(and(eq(videoLessonsTable.isShared, true), eq(videoLessonsTable.hiddenByAdmin, false)))
      .orderBy(desc(videoLessonsTable.createdAt));

    res.json(lessons);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.post("/video-lessons/:id/import", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) return res.status(401).json({ message: "غير مسجل" });

    const sourceId = parseInt(req.params.id);
    if (isNaN(sourceId)) return res.status(400).json({ message: "معرف غير صالح" });

    const [source] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, sourceId))
      .limit(1);

    if (!source) return res.status(404).json({ message: "درس غير موجود" });
    if (!source.isShared && source.teacherId !== teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }
    // Admin-hidden lessons cannot be imported even if the ID is known.
    // Owners are still allowed to clone their own (hidden) content.
    if (source.hiddenByAdmin && source.teacherId !== teacherId) {
      return res.status(404).json({ message: "درس غير متاح" });
    }

    const [newLesson] = await db
      .insert(videoLessonsTable)
      .values({
        teacherId,
        title: source.title,
        subject: source.subject,
        description: source.description,
        videoUrl: source.videoUrl,
        videoType: source.videoType,
        targetClass: null,
        accessMode: "public",
        accessCode: null,
        isShared: false,
      })
      .returning();

    const sourceQuestions = await db
      .select()
      .from(videoQuestionsTable)
      .where(eq(videoQuestionsTable.videoLessonId, sourceId));

    if (sourceQuestions.length > 0) {
      await db.insert(videoQuestionsTable).values(
        sourceQuestions.map((q) => ({
          videoLessonId: newLesson.id,
          timestampSeconds: q.timestampSeconds,
          questionType: q.questionType,
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          points: q.points,
          questionOrder: q.questionOrder,
        }))
      );
    }

    res.json({ id: newLesson.id, message: "تم استيراد الدرس بنجاح" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });

    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });

    if (lesson.accessMode === "private") {
      const isTeacher = req.session.teacherId === lesson.teacherId;
      if (!isTeacher) {
        const code = (req.query.code as string || "").trim().toUpperCase();
        const storedCode = (lesson.accessCode || "").trim().toUpperCase();
        if (!code || code !== storedCode) {
          return res.json({
            id: lesson.id,
            title: lesson.title,
            subject: lesson.subject,
            description: lesson.description,
            accessMode: lesson.accessMode,
            requiresCode: true,
          });
        }
      }
    }

    const questions = await db
      .select()
      .from(videoQuestionsTable)
      .where(eq(videoQuestionsTable.videoLessonId, id))
      .orderBy(videoQuestionsTable.timestampSeconds);

    const isTeacher = req.session.teacherId === lesson.teacherId;

    const questionsForClient = questions.map((q) => ({
      id: q.id,
      timestampSeconds: q.timestampSeconds,
      questionType: q.questionType,
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: isTeacher ? q.correctAnswer : undefined,
      points: q.points,
      questionOrder: q.questionOrder,
    }));

    let parsedSkipSegments: { start: number; end: number }[] = [];
    if (lesson.skipSegments) {
      try {
        const raw = JSON.parse(lesson.skipSegments);
        if (Array.isArray(raw)) parsedSkipSegments = raw;
      } catch {}
    }

    res.json({
      ...lesson,
      skipSegments: parsedSkipSegments,
      questions: questionsForClient,
      totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.post("/video-lessons", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const body = CreateVideoLessonBody.parse(req.body);

    const teacherId = req.session.teacherId;
    // Wrap insert + XP in a single transaction: if either fails, both roll back.
    const { lesson, runAfterCommit } = await db.transaction(async (tx) => {
      const [l] = await tx
        .insert(videoLessonsTable)
        .values({
          title: body.title,
          subject: body.subject || null,
          description: body.description || null,
          videoUrl: body.videoUrl,
          videoType: body.videoType,
          targetClass: body.targetClass || null,
          accessMode: body.accessMode,
          accessCode: body.accessCode || null,
          teacherId,
          isShared: body.isShared === false ? false : true,
          skipSegments: body.skipSegments && body.skipSegments.length > 0
            ? JSON.stringify(body.skipSegments)
            : null,
        })
        .returning();

      if (body.questions && body.questions.length > 0) {
        await tx.insert(videoQuestionsTable).values(
          body.questions.map((q, idx) => ({
            videoLessonId: l.id,
            timestampSeconds: q.timestampSeconds,
            questionType: q.questionType,
            text: q.text,
            optionA: q.optionA || null,
            optionB: q.optionB || null,
            optionC: q.optionC || null,
            optionD: q.optionD || null,
            correctAnswer: q.correctAnswer || null,
            points: q.points,
            questionOrder: idx,
          }))
        );
      }

      const { runAfterCommit: rac } = await awardXpInTxAndNotifyAfterCommit(tx, {
        teacherId,
        actionKey: "video_lesson.create",
        refId: `video_lesson:${l.id}`,
      });
      return { lesson: l, runAfterCommit: rac };
    });

    // Run badge/quest/threshold checks AFTER the tx commits (never inside).
    void runAfterCommit().catch(() => {});

    res.status(201).json(lesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
    }
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.put("/video-lessons/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "درس غير موجود" });
    if (existing.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const body = UpdateVideoLessonBody.parse(req.body);

    const updateData: Partial<typeof videoLessonsTable.$inferInsert> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.subject !== undefined) updateData.subject = body.subject || null;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl;
    if (body.videoType !== undefined) updateData.videoType = body.videoType;
    if (body.targetClass !== undefined) updateData.targetClass = body.targetClass || null;
    if (body.accessMode !== undefined) updateData.accessMode = body.accessMode;
    if (body.accessCode !== undefined) updateData.accessCode = body.accessCode || null;
    if (body.isShared !== undefined) updateData.isShared = body.isShared;
    if (body.skipSegments !== undefined) {
      updateData.skipSegments = body.skipSegments.length > 0
        ? JSON.stringify(body.skipSegments)
        : null;
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(videoLessonsTable)
        .set(updateData)
        .where(eq(videoLessonsTable.id, id));
    }

    if (body.questions) {
      await db.delete(videoQuestionsTable).where(eq(videoQuestionsTable.videoLessonId, id));
      await db.insert(videoQuestionsTable).values(
        body.questions.map((q, idx) => ({
          videoLessonId: id,
          timestampSeconds: q.timestampSeconds,
          questionType: q.questionType,
          text: q.text,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
          points: q.points,
          questionOrder: idx,
        }))
      );
    }

    const [updated] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
    }
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.delete("/video-lessons/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "درس غير موجود" });
    if (existing.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    await db.delete(videoLessonsTable).where(eq(videoLessonsTable.id, id));
    // Reverse XP if deleted within 5-minute anti-abuse window (fire-and-forget)
    void reverseXpIfWithinWindow(
      existing.teacherId,
      "video_lesson.create",
      `video_lesson:${id}`,
    ).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.post("/video-lessons/:id/check-answer", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });

    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });

    const body = CheckVideoAnswerBody.parse(req.body);

    if (lesson.accessMode === "private") {
      const submittedCode = (body.accessCode || "").trim().toUpperCase();
      const storedCode = (lesson.accessCode || "").trim().toUpperCase();
      if (!submittedCode || submittedCode !== storedCode) {
        return res.status(403).json({ message: "كود الدخول غير صحيح" });
      }
    }

    const [question] = await db
      .select()
      .from(videoQuestionsTable)
      .where(and(eq(videoQuestionsTable.videoLessonId, id), eq(videoQuestionsTable.id, body.questionId)))
      .limit(1);

    if (!question) return res.status(404).json({ message: "سؤال غير موجود" });

    let isCorrect = false;
    if (question.correctAnswer) {
      const studentAns = body.selectedAnswer.trim().toLowerCase();
      const correctAns = question.correctAnswer.trim().toLowerCase();
      isCorrect = studentAns === correctAns;
    }

    res.json({
      isCorrect,
      points: question.points,
      earnedPoints: isCorrect ? question.points : 0,
      correctAnswer: isCorrect ? null : question.correctAnswer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
    }
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.post("/video-lessons/:id/submit", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });

    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });

    const body = SubmitVideoLessonBody.parse(req.body);

    if (lesson.accessMode === "private") {
      const submittedCode = (body.accessCode || "").trim().toUpperCase();
      const storedCode = (lesson.accessCode || "").trim().toUpperCase();
      if (!submittedCode || submittedCode !== storedCode) {
        return res.status(403).json({ message: "كود الدخول غير صحيح" });
      }
    }

    const questions = await db
      .select()
      .from(videoQuestionsTable)
      .where(eq(videoQuestionsTable.videoLessonId, id));

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    let earnedPoints = 0;
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const answerResults: { questionId: number; selectedAnswer: string; isCorrect: boolean; questionText: string; correctAnswer: string | null; points: number; earnedPoints: number }[] = [];

    for (const ans of body.answers) {
      const question = questionMap.get(ans.questionId);
      if (!question) continue;

      let isCorrect = false;
      if (question.correctAnswer) {
        const studentAns = ans.selectedAnswer.trim().toLowerCase();
        const correctAns = question.correctAnswer.trim().toLowerCase();
        isCorrect = studentAns === correctAns;
      }

      if (isCorrect) {
        correctCount++;
        earnedPoints += question.points;
      }

      answerResults.push({
        questionId: question.id,
        selectedAnswer: ans.selectedAnswer,
        isCorrect,
        questionText: question.text,
        correctAnswer: question.correctAnswer,
        points: question.points,
        earnedPoints: isCorrect ? question.points : 0,
      });
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    const [submission] = await db
      .insert(videoSubmissionsTable)
      .values({
        videoLessonId: id,
        studentName: body.studentName,
        studentClass: body.studentClass || "",
        studentId: body.studentId || null,
        score,
        earnedPoints,
        totalPoints,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
      })
      .returning();

    if (answerResults.length > 0) {
      await db.insert(videoAnswersTable).values(
        answerResults.map((a) => ({
          videoSubmissionId: submission.id,
          videoQuestionId: a.questionId,
          selectedAnswer: a.selectedAnswer,
          isCorrect: a.isCorrect,
        }))
      );
    }

    res.json({
      submissionId: submission.id,
      studentName: body.studentName,
      studentClass: body.studentClass,
      score: Math.round(score),
      earnedPoints,
      totalPoints,
      totalQuestions: questions.length,
      correctAnswers: correctCount,
      answers: answerResults,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "بيانات غير صالحة", errors: error.errors });
    }
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/:id/submissions", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const id = parseInt(req.params.id);
    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });
    if (lesson.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const submissions = await db
      .select()
      .from(videoSubmissionsTable)
      .where(eq(videoSubmissionsTable.videoLessonId, id))
      .orderBy(desc(videoSubmissionsTable.submittedAt));

    res.json(submissions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/:id/submissions/:subId", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const id = parseInt(req.params.id);
    const subId = parseInt(req.params.subId);

    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });
    if (lesson.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const [submission] = await db
      .select()
      .from(videoSubmissionsTable)
      .where(and(
        eq(videoSubmissionsTable.id, subId),
        eq(videoSubmissionsTable.videoLessonId, id)
      ))
      .limit(1);

    if (!submission) return res.status(404).json({ message: "تسليم غير موجود" });

    const answers = await db
      .select({
        id: videoAnswersTable.id,
        videoQuestionId: videoAnswersTable.videoQuestionId,
        selectedAnswer: videoAnswersTable.selectedAnswer,
        isCorrect: videoAnswersTable.isCorrect,
        questionText: videoQuestionsTable.text,
        questionType: videoQuestionsTable.questionType,
        correctAnswer: videoQuestionsTable.correctAnswer,
        points: videoQuestionsTable.points,
        timestampSeconds: videoQuestionsTable.timestampSeconds,
      })
      .from(videoAnswersTable)
      .innerJoin(videoQuestionsTable, eq(videoAnswersTable.videoQuestionId, videoQuestionsTable.id))
      .where(eq(videoAnswersTable.videoSubmissionId, subId))
      .orderBy(videoQuestionsTable.timestampSeconds);

    res.json({ ...submission, answers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.patch("/video-lessons/:id/share", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "درس غير موجود" });
    if (existing.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const newShared = !existing.isShared;
    await db
      .update(videoLessonsTable)
      .set({ isShared: newShared })
      .where(eq(videoLessonsTable.id, id));

    res.json({ isShared: newShared });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/:id/class-students", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson || !lesson.targetClass) return res.json([]);

    const isTeacher = req.session.teacherId === lesson.teacherId;
    if (!isTeacher) {
      if (lesson.accessMode === "private") {
        const code = (req.query.code as string || "").trim().toUpperCase();
        const storedCode = (lesson.accessCode || "").trim().toUpperCase();
        if (!code || code !== storedCode) {
          return res.status(403).json({ message: "غير مصرح" });
        }
      }
    }

    const students = await db
      .select({ id: studentsTable.id, name: studentsTable.name, gradeLevel: studentsTable.gradeLevel })
      .from(studentsTable)
      .where(and(
        eq(studentsTable.gradeLevel, lesson.targetClass),
        eq(studentsTable.teacherId, lesson.teacherId)
      ));

    if (isTeacher) {
      return res.json(students);
    } else {
      return res.json(students.map((s) => ({ id: s.id, name: s.name })));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

export default router;
