import { Router, type IRouter } from "express";
import { db, questionsTable, submissionsTable, answersTable, assignmentsTable, notificationsTable, examSessionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  SubmitAssignmentParams,
  SubmitAssignmentBody,
  SubmitAssignmentImageParams,
  SubmitAssignmentImageBody,
  ListSubmissionsParams,
  UpdateSubmissionBody,
  UpdateAnswerGradeBody,
  StartExamSessionBody,
  StartExamSessionParams,
} from "@workspace/api-zod";
import { imageUploadLimiter } from "../lib/rate-limiter";
import { safeAccessCodeEqual, normalizeAccessCode } from "../lib/access-code";

const router: IRouter = Router();

async function checkAccessAndDuplicate(
  assignmentId: number,
  assignment: any,
  accessCode: string | undefined,
  deviceFingerprint: string,
  res: any
): Promise<boolean> {
  if (assignment.accessMode === "private") {
    if (!assignment.accessCode) {
      res.status(403).json({ message: "هذا الواجب خاص ولا يمكن الوصول إليه حالياً" });
      return false;
    }
    const submittedCode = normalizeAccessCode(accessCode);
    const storedCode = normalizeAccessCode(assignment.accessCode);
    if (!submittedCode || !safeAccessCodeEqual(submittedCode, storedCode)) {
      res.status(403).json({ message: "كود الدخول غير صحيح" });
      return false;
    }
  }

  if (deviceFingerprint && deviceFingerprint.trim()) {
    const fp = deviceFingerprint.trim();
    const existing = await db
      .select({ id: submissionsTable.id })
      .from(submissionsTable)
      .where(
        and(
          eq(submissionsTable.assignmentId, assignmentId),
          eq(submissionsTable.deviceFingerprint, fp)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ message: "لقد قمت بالإجابة على هذا الواجب مسبقاً من هذا الجهاز" });
      return false;
    }
  }

  return true;
}

router.post("/assignments/:id/start-exam", async (req, res) => {
  try {
    const { id } = StartExamSessionParams.parse(req.params);
    const body = StartExamSessionBody.parse(req.body);

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    if (!assignment.examMode || !assignment.examDurationMinutes) {
      res.status(400).json({ message: "هذا الواجب ليس في وضع الاختبار" });
      return;
    }

    if (assignment.accessMode === "private") {
      if (!assignment.accessCode) {
        res.status(403).json({ message: "هذا الواجب خاص ولا يمكن الوصول إليه حالياً" });
        return;
      }
      const submittedCode = normalizeAccessCode((req.body as any)?.accessCode);
      const storedCode = normalizeAccessCode(assignment.accessCode);
      if (!submittedCode || !safeAccessCodeEqual(submittedCode, storedCode)) {
        res.status(403).json({ message: "كود الدخول غير صحيح" });
        return;
      }
    }

    const existing = await db
      .select()
      .from(examSessionsTable)
      .where(
        and(
          eq(examSessionsTable.assignmentId, id),
          eq(examSessionsTable.deviceFingerprint, body.deviceFingerprint),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const session = existing[0];
      const expiresAt = new Date(session.startedAt.getTime() + assignment.examDurationMinutes * 60 * 1000);
      res.json({
        sessionId: session.id,
        startedAt: session.startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      return;
    }

    const [session] = await db
      .insert(examSessionsTable)
      .values({
        assignmentId: id,
        studentName: body.studentName,
        studentClass: body.studentClass,
        deviceFingerprint: body.deviceFingerprint,
      })
      .returning();

    const expiresAt = new Date(session.startedAt.getTime() + assignment.examDurationMinutes * 60 * 1000);
    res.json({
      sessionId: session.id,
      startedAt: session.startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Start exam session error");
    res.status(400).json({ message: error.message || "خطأ في بدء جلسة الاختبار" });
  }
});

router.post("/assignments/:id/submit", async (req, res) => {
  try {
    const { id } = SubmitAssignmentParams.parse(req.params);
    const rawStudentId = req.body?.studentId ? parseInt(req.body.studentId) : null;
    const body: any = { ...SubmitAssignmentBody.parse(req.body), studentId: isNaN(rawStudentId as any) ? null : rawStudentId };

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    if (assignment.submissionMode === "paper") {
      res.status(400).json({ message: "هذا الواجب يقبل فقط الإجابات الورقية (رفع صورة)" });
      return;
    }

    if (assignment.deadline && new Date() > new Date(assignment.deadline)) {
      res.status(403).json({ message: "انتهى موعد تسليم هذا الواجب" });
      return;
    }

    if (assignment.examMode && assignment.examDurationMinutes) {
      if (!body.examSessionId) {
        res.status(400).json({ message: "يجب بدء جلسة اختبار أولاً" });
        return;
      }

      const [session] = await db
        .select()
        .from(examSessionsTable)
        .where(
          and(
            eq(examSessionsTable.id, body.examSessionId),
            eq(examSessionsTable.assignmentId, id),
            eq(examSessionsTable.deviceFingerprint, body.deviceFingerprint),
          ),
        )
        .limit(1);

      if (!session) {
        res.status(403).json({ message: "جلسة الاختبار غير صالحة" });
        return;
      }

      const allowedMs = (assignment.examDurationMinutes + 1) * 60 * 1000;
      if (Date.now() - session.startedAt.getTime() > allowedMs) {
        res.status(403).json({ message: "انتهى وقت الاختبار" });
        return;
      }
    }

    const allowed = await checkAccessAndDuplicate(id, assignment, body.accessCode, body.deviceFingerprint, res);
    if (!allowed) return;

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, id));

    if (questions.length === 0) {
      res.status(404).json({ message: "الواجب لا يحتوي على أسئلة" });
      return;
    }

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    let correctCount = 0;
    let earnedPoints = 0;
    let totalPointsVal = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const answerResults: Array<{
      questionId: number;
      questionText: string;
      selectedAnswer: string;
      correctAnswer: string | null;
      isCorrect: boolean;
      points: number;
      earnedPoints: number;
      repeatQuestion?: boolean;
      allowMultipleAnswers?: boolean;
    }> = [];

    const aiGradingQuestions: Array<{
      index: number;
      questionText: string;
      correctAnswer: string | null;
      studentAnswer: string;
      points: number;
      questionType: string;
    }> = [];

    for (const answer of body.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) continue;

      const qType = question.questionType || "mcq";
      let isCorrect = false;
      let needsAiGrading = false;
      // For listening assignments, dictation + open answers are reviewed
      // manually by the teacher (no auto-compare, no AI grading). They count
      // as pending review. Other assignment types keep their previous grading.
      const needsManualReview =
        assignment.activityType === "listening" &&
        (qType === "dictation" || qType === "open");

      if (needsManualReview) {
        // skip — leave isCorrect=false, earnedPoints=0
      } else if (qType === "whiteboard" || qType === "fill_blank") {
        needsAiGrading = true;
      } else if (qType === "true_false") {
        isCorrect = answer.selectedAnswer === question.correctAnswer;
      } else if (qType === "mcq" && question.allowMultipleAnswers && question.correctAnswer) {
        const correctSet = new Set(question.correctAnswer.split(",").map((s: string) => s.trim()));
        const studentSet = new Set(answer.selectedAnswer.split(",").map((s: string) => s.trim()).filter(Boolean));
        isCorrect = correctSet.size === studentSet.size && [...correctSet].every(c => studentSet.has(c));
      } else {
        isCorrect = answer.selectedAnswer === question.correctAnswer;
      }

      const qPoints = question.points || 1;
      const qEarned = (needsAiGrading || needsManualReview) ? 0 : (isCorrect ? qPoints : 0);
      if (isCorrect && !needsAiGrading && !needsManualReview) correctCount++;
      earnedPoints += qEarned;

      const resultIndex = answerResults.length;
      answerResults.push({
        questionId: question.id,
        questionText: question.text,
        selectedAnswer: answer.selectedAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        points: qPoints,
        earnedPoints: qEarned,
        repeatQuestion: question.repeatQuestion ?? false,
        allowMultipleAnswers: question.allowMultipleAnswers ?? false,
      });

      if (needsAiGrading && answer.selectedAnswer && answer.selectedAnswer.trim()) {
        aiGradingQuestions.push({
          index: resultIndex,
          questionText: question.text,
          correctAnswer: question.correctAnswer,
          studentAnswer: answer.selectedAnswer,
          points: qPoints,
          questionType: qType,
        });
      }
    }

    const textQuestions = aiGradingQuestions.filter(q => q.questionType === "fill_blank");
    const whiteboardQuestions = aiGradingQuestions.filter(q => q.questionType === "whiteboard");

    const parseAiGradingResponse = (responseText: string, questionsToGrade: typeof aiGradingQuestions) => {
      const lines = responseText.split("\n").filter((l) => l.trim());
      for (let i = 0; i < questionsToGrade.length; i++) {
        const agq = questionsToGrade[i];
        const line = lines[i] || "";
        const parts = line.split("|").map(p => p.trim());
        let qEarned = 0;
        let isCorrect = false;
        if (parts.length >= 2) {
          const earnedStr = parts[0]?.match(/[\d.]+/);
          qEarned = earnedStr ? Math.min(parseFloat(earnedStr[0]), agq.points) : 0;
          const status = parts[1]?.trim();
          isCorrect = status === "صحيح" || qEarned >= agq.points;
        }
        answerResults[agq.index].isCorrect = isCorrect;
        answerResults[agq.index].earnedPoints = qEarned;
        earnedPoints += qEarned;
        if (isCorrect) correctCount++;
      }
    };

    if (textQuestions.length > 0) {
      try {
        const aiPrompt = `أنت مصحح واجبات ذكي ودقيق. صحح إجابات الطالب التالية.
${assignment.aiGradingInstructions ? `\nتعليمات التصحيح من المعلم:\n${assignment.aiGradingInstructions}\n` : ""}
لكل سؤال، قيّم إجابة الطالب وحدد الدرجة المستحقة. اقبل الإجابات الصحيحة حتى لو كانت بصياغة مختلفة أو بها أخطاء إملائية بسيطة.

${textQuestions.map((q, i) => `${i + 1}. السؤال: ${q.questionText} (${q.points} درجة)
   ${q.correctAnswer ? `الإجابة الصحيحة: ${q.correctAnswer}` : "لا توجد إجابة نموذجية - قيّم حسب صحة المحتوى"}
   إجابة الطالب: ${q.studentAnswer}`).join("\n")}

أعد النتائج بالتنسيق التالي فقط (سطر لكل سؤال):
${textQuestions.map((q, i) => `${i + 1}: [الدرجة المستحقة من ${q.points}] | [صحيح/خطأ/جزئي]`).join("\n")}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 500,
          messages: [{ role: "user", content: aiPrompt }],
        });
        parseAiGradingResponse(completion.choices[0]?.message?.content || "", textQuestions);
      } catch (e: any) {
        req.log.error({ err: e }, "AI grading error for fill_blank");
      }
    }

    if (whiteboardQuestions.length > 0) {
      try {
        for (const wq of whiteboardQuestions) {
          const isBase64Image = wq.studentAnswer.startsWith("data:image");
          const messageContent: any[] = [
            {
              type: "text",
              text: `أنت مصحح واجبات ذكي. صحح إجابة الطالب على السؤال التالي.
${assignment.aiGradingInstructions ? `تعليمات التصحيح من المعلم: ${assignment.aiGradingInstructions}` : ""}
السؤال: ${wq.questionText} (${wq.points} درجة)
${wq.correctAnswer ? `الإجابة الصحيحة: ${wq.correctAnswer}` : "لا توجد إجابة نموذجية - قيّم حسب صحة المحتوى"}
${isBase64Image ? "إجابة الطالب مرفقة كصورة من السبورة التفاعلية. حلل الكتابة/الرسم في الصورة." : `إجابة الطالب: ${wq.studentAnswer}`}

أعد النتيجة بالتنسيق التالي فقط:
1: [الدرجة المستحقة من ${wq.points}] | [صحيح/خطأ/جزئي]`,
            },
          ];
          if (isBase64Image) {
            messageContent.push({
              type: "image_url",
              image_url: { url: wq.studentAnswer },
            });
          }
          const completion = await openai.chat.completions.create({
            model: "gpt-5.2",
            max_completion_tokens: 200,
            messages: [{ role: "user", content: messageContent }],
          });
          parseAiGradingResponse(completion.choices[0]?.message?.content || "", [wq]);
        }
      } catch (e: any) {
        req.log.error({ err: e }, "AI grading error for whiteboard");
      }
    }

    const totalQuestions = questions.length;
    const score = totalPointsVal > 0 ? (earnedPoints / totalPointsVal) * 100 : 0;

    const notifBody = `${body.studentName}${body.studentClass ? ` (${body.studentClass})` : ""} أجاب على الواجب — ${earnedPoints}/${totalPointsVal} (${Math.round(score)}%)`;
    try {
      await db.insert(notificationsTable).values({
        teacherId: assignment.teacherId,
        assignmentId: id,
        type: "submission",
        title: `إجابة جديدة على "${assignment.title}"`,
        body: notifBody,
      });
    } catch (e) {
      req.log.error({ err: e }, "Failed to create notification");
    }

    let aiFeedback: string | null = null;
    try {
      const feedbackPrompt = `أنت معلم عربي. طالب اسمه "${body.studentName}" أجاب على واجب يحتوي على ${totalQuestions} سؤال.
حصل على ${earnedPoints} درجة من أصل ${totalPointsVal} (${Math.round(score)}%).

الأسئلة والإجابات:
${answerResults.map((a, i) => `${i + 1}. ${a.questionText} (${a.points} درجة)
   إجابة الطالب: ${a.selectedAnswer} ${a.isCorrect ? "✓" : "✗"}
   الإجابة الصحيحة: ${a.correctAnswer}`).join("\n")}
${assignment.aiGradingInstructions ? `\nتعليمات التصحيح من المعلم:\n${assignment.aiGradingInstructions}\n` : ""}
قدم تعليقاً مختصراً وتشجيعياً بالعربية عن أداء الطالب (3-4 جمل).`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 500,
        messages: [{ role: "user", content: feedbackPrompt }],
      });
      aiFeedback = completion.choices[0]?.message?.content || null;
    } catch (e: any) {
      req.log.error({ err: e }, "AI feedback error");
    }

    const durationSec = typeof body.durationSeconds === "number" && body.durationSeconds > 0
      ? Math.min(Math.floor(body.durationSeconds), 60 * 60 * 24)
      : null;
    const startedAtVal = durationSec !== null ? new Date(Date.now() - durationSec * 1000) : null;

    const [submission] = await db
      .insert(submissionsTable)
      .values({
        assignmentId: id,
        studentName: body.studentName,
        studentClass: body.studentClass,
        studentId: body.studentId || null,
        deviceFingerprint: body.deviceFingerprint || null,
        score,
        totalQuestions,
        correctAnswers: correctCount,
        earnedPoints,
        totalPoints: totalPointsVal,
        aiFeedback,
        startedAt: startedAtVal,
        durationSeconds: durationSec,
      })
      .returning();

    await db.insert(answersTable).values(
      answerResults.map((a) => ({
        submissionId: submission.id,
        questionId: a.questionId,
        selectedAnswer: a.selectedAnswer,
        isCorrect: a.isCorrect,
      })),
    );

    const releaseMode = assignment.resultsReleaseMode || "immediate";
    let canSeeResults = assignment.showResults;
    if (releaseMode === "after_deadline") {
      canSeeResults = assignment.deadline ? new Date(assignment.deadline) < new Date() : false;
    } else if (releaseMode === "manual") {
      canSeeResults = !!assignment.showResults;
    }

    if (canSeeResults) {
      res.json({
        id: submission.id,
        studentName: body.studentName,
        studentClass: body.studentClass,
        totalQuestions,
        correctAnswers: correctCount,
        score,
        earnedPoints,
        totalPoints: totalPointsVal,
        showResults: true,
        answers: answerResults.map(a => ({
          questionId: a.questionId,
          questionText: a.questionText,
          selectedAnswer: a.selectedAnswer,
          isCorrect: a.isCorrect,
          points: a.points,
          earnedPoints: a.earnedPoints,
          repeatQuestion: a.repeatQuestion,
          allowMultipleAnswers: a.allowMultipleAnswers,
        })),
        aiFeedback,
      });
    } else {
      const repeatEligibleIds = answerResults
        .filter(a => !a.isCorrect && a.repeatQuestion)
        .map(a => a.questionId);
      res.json({
        id: submission.id,
        studentName: body.studentName,
        studentClass: body.studentClass,
        totalQuestions: 0,
        correctAnswers: 0,
        score: 0,
        earnedPoints: 0,
        totalPoints: totalPointsVal,
        showResults: false,
        answers: [],
        repeatEligibleIds,
        aiFeedback: null,
      });
    }
  } catch (error: any) {
    req.log.error({ err: error }, "Submit assignment error");
    res.status(400).json({ message: error.message || "خطأ في إرسال الإجابات" });
  }
});

router.post("/assignments/:id/submissions/:submissionId/repeat", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.id);
    const submissionId = parseInt(req.params.submissionId);
    if (isNaN(assignmentId) || isNaN(submissionId)) {
      res.status(400).json({ message: "معرّف غير صالح" });
      return;
    }

    const RepeatBody = z.object({
      answers: z.array(z.object({
        questionId: z.number(),
        selectedAnswer: z.string(),
      })).min(1),
      deviceFingerprint: z.string().optional(),
    });
    const body = RepeatBody.parse(req.body);

    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId));
    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    const [submission] = await db.select().from(submissionsTable).where(
      and(eq(submissionsTable.id, submissionId), eq(submissionsTable.assignmentId, assignmentId))
    );
    if (!submission) {
      res.status(404).json({ message: "الإجابة غير موجودة" });
      return;
    }

    const isOwningTeacher = !!req.session.teacherId && assignment.teacherId === req.session.teacherId;
    const isOwnerStudent = req.session.studentAccountId && (submission as any).studentAccountId
      ? req.session.studentAccountId === (submission as any).studentAccountId
      : false;
    const isFingerprintMatch = body.deviceFingerprint && submission.deviceFingerprint
      ? body.deviceFingerprint.trim() === submission.deviceFingerprint.trim()
      : false;

    if (!isOwningTeacher && !isOwnerStudent && !isFingerprintMatch) {
      res.status(403).json({ message: "غير مصرح لك بتعديل هذه الإجابة" });
      return;
    }

    if (submission.repeatAttempted) {
      res.status(409).json({ message: "لقد استخدمت فرصة التكرار مسبقاً لهذا الواجب" });
      return;
    }

    const questions = await db.select().from(questionsTable).where(eq(questionsTable.assignmentId, assignmentId));
    const questionMap = new Map(questions.map(q => [q.id, q]));

    const existingAnswers = await db.select().from(answersTable).where(eq(answersTable.submissionId, submissionId));
    const existingAnswerMap = new Map(existingAnswers.map(a => [a.questionId, a]));

    let earnedPointsDelta = 0;

    for (const answer of body.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question || !question.repeatQuestion) continue;

      const existing = existingAnswerMap.get(answer.questionId);
      if (!existing || existing.isCorrect) continue;

      const qType = question.questionType || "mcq";
      let isCorrect = false;
      if (qType === "true_false") {
        isCorrect = answer.selectedAnswer === question.correctAnswer;
      } else if (qType === "mcq" && question.allowMultipleAnswers && question.correctAnswer) {
        const correctSet = new Set(question.correctAnswer.split(",").map((s: string) => s.trim()));
        const studentSet = new Set(answer.selectedAnswer.split(",").map((s: string) => s.trim()).filter(Boolean));
        isCorrect = correctSet.size === studentSet.size && [...correctSet].every(c => studentSet.has(c));
      } else if (qType === "fill_blank") {
        isCorrect = answer.selectedAnswer.trim().toLowerCase() === (question.correctAnswer || "").trim().toLowerCase();
      } else {
        isCorrect = answer.selectedAnswer === question.correctAnswer;
      }

      const qPoints = question.points || 1;
      const prevEarned = existing.isCorrect ? qPoints : 0;
      const newEarned = isCorrect ? qPoints : 0;
      earnedPointsDelta += newEarned - prevEarned;

      await db.update(answersTable).set({
        selectedAnswer: answer.selectedAnswer,
        isCorrect,
      }).where(eq(answersTable.id, existing.id));
    }

    const newEarnedPoints = (submission.earnedPoints || 0) + earnedPointsDelta;
    const totalPoints = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const newScore = totalPoints > 0 ? (newEarnedPoints / totalPoints) * 100 : 0;

    await db.update(submissionsTable).set({
      earnedPoints: newEarnedPoints,
      score: newScore,
      correctAnswers: 0,
      repeatAttempted: true,
    }).where(eq(submissionsTable.id, submissionId));

    const allAnswers = await db.select().from(answersTable).where(eq(answersTable.submissionId, submissionId));
    const correctCount = allAnswers.filter(a => a.isCorrect).length;

    await db.update(submissionsTable).set({ correctAnswers: correctCount }).where(eq(submissionsTable.id, submissionId));

    const releaseMode = assignment.resultsReleaseMode || "immediate";
    let canSeeResults = assignment.showResults;
    if (releaseMode === "after_deadline") {
      canSeeResults = assignment.deadline ? new Date(assignment.deadline) < new Date() : false;
    } else if (releaseMode === "manual") {
      canSeeResults = !!assignment.showResults;
    }

    if (canSeeResults) {
      res.json({
        id: submissionId,
        studentName: submission.studentName,
        studentClass: submission.studentClass || "",
        totalQuestions: questions.length,
        correctAnswers: correctCount,
        score: newScore,
        earnedPoints: newEarnedPoints,
        totalPoints,
        showResults: true,
        answers: allAnswers.map(a => {
          const q = questionMap.get(a.questionId);
          const qPoints = q?.points || 1;
          return {
            questionId: a.questionId,
            questionText: q?.text || "",
            selectedAnswer: a.selectedAnswer || "",
            isCorrect: a.isCorrect || false,
            points: qPoints,
            earnedPoints: a.isCorrect ? qPoints : 0,
            repeatQuestion: q?.repeatQuestion ?? false,
            allowMultipleAnswers: q?.allowMultipleAnswers ?? false,
          };
        }),
      });
    } else {
      res.json({
        id: submissionId,
        studentName: submission.studentName,
        studentClass: submission.studentClass || "",
        totalQuestions: 0,
        correctAnswers: 0,
        score: 0,
        earnedPoints: 0,
        totalPoints,
        showResults: false,
        answers: [],
        repeatEligibleIds: [],
      });
    }
  } catch (error: any) {
    req.log.error({ err: error }, "Repeat submission error");
    res.status(400).json({ message: error.message || "خطأ في إرسال إجابات التكرار" });
  }
});

router.post("/assignments/:id/submit-image", imageUploadLimiter, async (req, res) => {
  try {
    const { id } = SubmitAssignmentImageParams.parse(req.params);
    const rawStudentId2 = req.body?.studentId ? parseInt(req.body.studentId) : null;
    const body: any = { ...SubmitAssignmentImageBody.parse(req.body), studentId: isNaN(rawStudentId2 as any) ? null : rawStudentId2 };

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    if (assignment.submissionMode === "electronic") {
      res.status(400).json({ message: "هذا الواجب يقبل فقط الإجابات الإلكترونية" });
      return;
    }

    if (assignment.examMode) {
      res.status(400).json({ message: "الاختبارات الرسمية لا تقبل إرسال الصور، يجب الإجابة إلكترونياً" });
      return;
    }

    if (assignment.deadline && new Date() > new Date(assignment.deadline)) {
      res.status(403).json({ message: "انتهى موعد تسليم هذا الواجب" });
      return;
    }

    const allowed = await checkAccessAndDuplicate(id, assignment, body.accessCode, body.deviceFingerprint, res);
    if (!allowed) return;

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, id));

    if (questions.length === 0) {
      res.status(404).json({ message: "الواجب لا يحتوي على أسئلة" });
      return;
    }

    const isPaperOnly = questions.every(q => !q.correctAnswer);

    let answerResults: Array<{
      questionId: number;
      questionText: string;
      selectedAnswer: string;
      correctAnswer: string | null;
      isCorrect: boolean;
      points: number;
      earnedPoints: number;
      repeatQuestion?: boolean;
      allowMultipleAnswers?: boolean;
    }> = [];

    const imageData = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");

    if (isPaperOnly) {
      const questionsText = questions
        .map((q, i) => `السؤال ${i + 1} (${q.points || 1} درجة): ${q.text}`)
        .join("\n");

      const imagePrompt = `أنت مصحح واجبات ذكي وخبير. هذه صورة لورقة إجابات طالب.
${assignment.modelImageBase64 ? "تم إرفاق نموذج الإجابة الصحيح من المعلم. قارن إجابات الطالب مع النموذج بدقة." : ""}
${assignment.aiGradingInstructions ? `\nتعليمات التصحيح من المعلم:\n${assignment.aiGradingInstructions}\n` : ""}
الأسئلة هي:
${questionsText}

المطلوب:
1. اقرأ إجابات الطالب من الصورة بعناية
2. صحح كل إجابة وحدد الدرجة التي يستحقها الطالب من أصل الدرجة الكاملة للسؤال
3. يمكن إعطاء درجات جزئية إذا كانت الإجابة صحيحة جزئياً

أعد النتائج بالتنسيق التالي فقط (بدون أي نص إضافي):
${questions.map((q, i) => `${i + 1}: [إجابة الطالب المختصرة] | [الدرجة المستحقة من ${q.points || 1}] | [صحيح/خطأ/جزئي]`).join("\n")}`;

      const messageContent: any[] = [
        { type: "text", text: imagePrompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageData}` } },
      ];

      if (assignment.modelImageBase64) {
        const modelData = assignment.modelImageBase64.replace(/^data:image\/\w+;base64,/, "");
        messageContent.push(
          { type: "text", text: "هذا نموذج الإجابة الصحيح من المعلم:" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${modelData}` } },
        );
      }

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 1500,
          messages: [{ role: "user", content: messageContent }],
        });

        const responseText = completion.choices[0]?.message?.content || "";
        const lines = responseText.split("\n").filter((l) => l.trim());

        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          const qPoints = question.points || 1;
          const line = lines[i] || "";
          const parts = line.split("|").map(p => p.trim());

          let studentAnswer = parts[0]?.replace(/^\d+:\s*/, "") || "غير واضح";
          let qEarned = 0;
          let isCorrect = false;

          if (parts.length >= 3) {
            const earnedStr = parts[1]?.match(/[\d.]+/);
            qEarned = earnedStr ? Math.min(parseFloat(earnedStr[0]), qPoints) : 0;
            const status = parts[2]?.trim();
            isCorrect = status === "صحيح" || qEarned >= qPoints;
          }

          answerResults.push({
            questionId: question.id,
            questionText: question.text,
            selectedAnswer: studentAnswer,
            correctAnswer: null,
            isCorrect,
            points: qPoints,
            earnedPoints: qEarned,
          });
        }
      } catch (e: any) {
        req.log.error({ err: e }, "AI paper grading error");
        res.status(500).json({ message: "خطأ في تصحيح الورقة. يرجى المحاولة مرة أخرى." });
        return;
      }
    } else {
      const questionsText = questions
        .map(
          (q, i) =>
            `السؤال ${i + 1} (${q.points || 1} درجة): ${q.text}\nأ) ${q.optionA}\nب) ${q.optionB}\nج) ${q.optionC}\nد) ${q.optionD}`,
        )
        .join("\n\n");

      const imagePrompt = `أنت مساعد ذكي لتصحيح الواجبات. هذه صورة لورقة إجابات طالب.
${assignment.modelImageBase64 ? "تم إرفاق نموذج الإجابة من المعلم أيضاً. قارن إجابات الطالب مع النموذج." : ""}

الأسئلة هي:
${questionsText}

انظر إلى صورة الطالب واستخرج إجاباته. أعد الإجابات بالتنسيق التالي فقط (بدون أي نص إضافي):
${questions.map((_, i) => `${i + 1}: A أو B أو C أو D`).join("\n")}

مهم: أعد فقط الأرقام والإجابات بالتنسيق المطلوب. إذا لم تستطع قراءة إجابة، اكتب "?" بدلاً منها.`;

      const messageContent: any[] = [
        { type: "text", text: imagePrompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageData}` } },
      ];

      if (assignment.modelImageBase64) {
        const modelData = assignment.modelImageBase64.replace(/^data:image\/\w+;base64,/, "");
        messageContent.push(
          { type: "text", text: "هذا نموذج الإجابة الصحيح من المعلم:" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${modelData}` } },
        );
      }

      let extractedAnswers: string[] = [];
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 1000,
          messages: [{ role: "user", content: messageContent }],
        });

        const responseText = completion.choices[0]?.message?.content || "";
        const lines = responseText.split("\n").filter((l) => l.trim());
        extractedAnswers = lines.map((line) => {
          const match = line.match(/:\s*([ABCD])/i);
          return match ? match[1].toUpperCase() : "?";
        });
      } catch (e: any) {
        req.log.error({ err: e }, "AI image extraction error");
        res.status(500).json({ message: "خطأ في قراءة الصورة. يرجى المحاولة مرة أخرى." });
        return;
      }

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const selectedAnswer = extractedAnswers[i] || "?";
        const isCorrect = selectedAnswer === question.correctAnswer;
        const qPoints = question.points || 1;
        const qEarned = isCorrect ? qPoints : 0;

        answerResults.push({
          questionId: question.id,
          questionText: question.text,
          selectedAnswer,
          correctAnswer: question.correctAnswer,
          isCorrect,
          points: qPoints,
          earnedPoints: qEarned,
        });
      }
    }

    let correctCount = answerResults.filter(a => a.isCorrect).length;
    let earnedPoints = answerResults.reduce((sum, a) => sum + a.earnedPoints, 0);
    const totalPointsVal = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const totalQuestions = questions.length;
    const score = totalPointsVal > 0 ? (earnedPoints / totalPointsVal) * 100 : 0;

    const notifBody2 = `${body.studentName}${body.studentClass ? ` (${body.studentClass})` : ""} أرسل إجابة ورقية — ${earnedPoints}/${totalPointsVal} (${Math.round(score)}%)`;
    try {
      await db.insert(notificationsTable).values({
        teacherId: assignment.teacherId,
        assignmentId: id,
        type: "submission",
        title: `إجابة ورقية جديدة على "${assignment.title}"`,
        body: notifBody2,
      });
    } catch (e) {
      req.log.error({ err: e }, "Failed to create notification");
    }

    let aiFeedback: string | null = null;
    try {
      const feedbackPrompt = `أنت معلم عربي. طالب اسمه "${body.studentName}" أرسل واجبه ورقياً عبر صورة.
حصل على ${earnedPoints} درجة من أصل ${totalPointsVal} (${Math.round(score)}%).

تفاصيل الإجابات:
${answerResults.map((a, i) => `${i + 1}. ${a.questionText} (${a.points} درجة) - حصل على ${a.earnedPoints} درجة`).join("\n")}
${assignment.aiGradingInstructions ? `\nتعليمات التصحيح من المعلم:\n${assignment.aiGradingInstructions}\n` : ""}
قدم تعليقاً مختصراً وتشجيعياً بالعربية عن أداء الطالب (3-4 جمل).`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 500,
        messages: [{ role: "user", content: feedbackPrompt }],
      });
      aiFeedback = completion.choices[0]?.message?.content || null;
    } catch (e: any) {
      req.log.error({ err: e }, "AI feedback error (image)");
    }

    const [submission] = await db
      .insert(submissionsTable)
      .values({
        assignmentId: id,
        studentName: body.studentName,
        studentClass: body.studentClass,
        studentId: body.studentId || null,
        deviceFingerprint: body.deviceFingerprint || null,
        score,
        totalQuestions,
        correctAnswers: correctCount,
        earnedPoints,
        totalPoints: totalPointsVal,
        aiFeedback,
      })
      .returning();

    await db.insert(answersTable).values(
      answerResults.map((a) => ({
        submissionId: submission.id,
        questionId: a.questionId,
        selectedAnswer: a.selectedAnswer,
        isCorrect: a.isCorrect,
      })),
    );

    const releaseMode = assignment.resultsReleaseMode || "immediate";
    let canSeeResults = assignment.showResults;
    if (releaseMode === "after_deadline") {
      canSeeResults = assignment.deadline ? new Date(assignment.deadline) < new Date() : false;
    } else if (releaseMode === "manual") {
      canSeeResults = !!assignment.showResults;
    }

    if (canSeeResults) {
      res.json({
        id: submission.id,
        studentName: body.studentName,
        studentClass: body.studentClass,
        totalQuestions,
        correctAnswers: correctCount,
        score,
        earnedPoints,
        totalPoints: totalPointsVal,
        showResults: true,
        answers: answerResults.map(a => ({
          questionId: a.questionId,
          questionText: a.questionText,
          selectedAnswer: a.selectedAnswer,
          isCorrect: a.isCorrect,
          points: a.points,
          earnedPoints: a.earnedPoints,
          repeatQuestion: a.repeatQuestion,
          allowMultipleAnswers: a.allowMultipleAnswers,
        })),
        aiFeedback,
      });
    } else {
      res.json({
        id: submission.id,
        studentName: body.studentName,
        studentClass: body.studentClass,
        totalQuestions: 0,
        correctAnswers: 0,
        score: 0,
        earnedPoints: 0,
        totalPoints: totalPointsVal,
        showResults: false,
        answers: [],
        repeatEligibleIds: [],
        aiFeedback: null,
      });
    }
  } catch (error: any) {
    req.log.error({ err: error }, "Submit image error");
    res.status(400).json({ message: error.message || "خطأ في إرسال الصورة" });
  }
});

router.get("/assignments/:id/submissions", async (req, res) => {
  try {
    const { id } = ListSubmissionsParams.parse(req.params);

    if (!req.session.teacherId) {
      res.status(401).json({ message: "يجب تسجيل الدخول كمعلم" });
      return;
    }

    const [assignment] = await db
      .select({ teacherId: assignmentsTable.teacherId })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment || assignment.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بعرض هذه النتائج" });
      return;
    }

    const submissions = await db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.assignmentId, id))
      .orderBy(submissionsTable.submittedAt);

    res.json(
      submissions.map((s) => ({
        id: s.id,
        studentName: s.studentName,
        studentClass: s.studentClass,
        score: s.score,
        totalQuestions: s.totalQuestions,
        correctAnswers: s.correctAnswers,
        earnedPoints: s.earnedPoints,
        totalPoints: s.totalPoints,
        teacherAdjustedPoints: s.teacherAdjustedPoints,
        teacherNote: s.teacherNote,
        aiFeedback: s.aiFeedback,
        durationSeconds: s.durationSeconds,
        submittedAt: s.submittedAt.toISOString(),
      })),
    );
  } catch (error: any) {
    req.log.error({ err: error }, "List submissions error");
    res.status(500).json({ message: "خطأ في جلب النتائج" });
  }
});

router.patch("/submissions/:submissionId", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول كمعلم" });
    return;
  }

  try {
    const submissionId = parseInt(req.params.submissionId, 10);
    if (isNaN(submissionId)) {
      res.status(400).json({ message: "معرف غير صالح" });
      return;
    }
    const body = UpdateSubmissionBody.parse(req.body);

    const [submission] = await db
      .select({
        id: submissionsTable.id,
        assignmentId: submissionsTable.assignmentId,
      })
      .from(submissionsTable)
      .where(eq(submissionsTable.id, submissionId))
      .limit(1);

    if (!submission) {
      res.status(404).json({ message: "الإجابة غير موجودة" });
      return;
    }

    const [assignment] = await db
      .select({ teacherId: assignmentsTable.teacherId })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, submission.assignmentId))
      .limit(1);

    if (!assignment || assignment.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بتعديل هذه الإجابة" });
      return;
    }

    const updateData: Record<string, any> = {};
    if (body.teacherAdjustedPoints !== undefined) {
      updateData.teacherAdjustedPoints = body.teacherAdjustedPoints;
    }
    if (body.teacherNote !== undefined) {
      updateData.teacherNote = body.teacherNote;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: "لا توجد بيانات للتعديل" });
      return;
    }

    if (updateData.teacherAdjustedPoints !== null && updateData.teacherAdjustedPoints !== undefined) {
      const [sub] = await db.select({ totalPoints: submissionsTable.totalPoints }).from(submissionsTable).where(eq(submissionsTable.id, submissionId)).limit(1);
      if (sub && (updateData.teacherAdjustedPoints < 0 || updateData.teacherAdjustedPoints > sub.totalPoints)) {
        res.status(400).json({ message: `الدرجة يجب أن تكون بين 0 و ${sub.totalPoints}` });
        return;
      }
    }

    const [updated] = await db
      .update(submissionsTable)
      .set(updateData)
      .where(eq(submissionsTable.id, submissionId))
      .returning();

    res.json({
      id: updated.id,
      studentName: updated.studentName,
      studentClass: updated.studentClass,
      score: updated.score,
      totalQuestions: updated.totalQuestions,
      correctAnswers: updated.correctAnswers,
      earnedPoints: updated.earnedPoints,
      totalPoints: updated.totalPoints,
      teacherAdjustedPoints: updated.teacherAdjustedPoints,
      teacherNote: updated.teacherNote,
      aiFeedback: updated.aiFeedback,
      submittedAt: updated.submittedAt.toISOString(),
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Update submission error");
    res.status(500).json({ message: "خطأ في تعديل الدرجة" });
  }
});

router.get("/assignments/:id/export-csv", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول كمعلم" });
    return;
  }

  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "معرف غير صالح" });
      return;
    }

    const [assignment] = await db
      .select({ teacherId: assignmentsTable.teacherId, title: assignmentsTable.title })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment || assignment.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بتصدير هذه النتائج" });
      return;
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, id));

    const submissions = await db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.assignmentId, id))
      .orderBy(submissionsTable.submittedAt);

    const allAnswers = submissions.length > 0
      ? await db
          .select()
          .from(answersTable)
          .where(
            sql`${answersTable.submissionId} IN (${sql.join(
              submissions.map((s) => sql`${s.id}`),
              sql`, `
            )})`
          )
      : [];

    const answersBySubmission = new Map<number, typeof allAnswers>();
    for (const a of allAnswers) {
      const arr = answersBySubmission.get(a.submissionId) || [];
      arr.push(a);
      answersBySubmission.set(a.submissionId, arr);
    }

    const BOM = "\uFEFF";
    const baseHeaders = ["اسم الطالب", "الصف", "الدرجة المكتسبة", "الدرجة الكلية", "النسبة %", "درجة المعلم", "ملاحظة المعلم", "تاريخ التسليم"];
    const questionHeaders = questions.map((q, i) => `س${i + 1}: ${q.text.substring(0, 30)}`);
    const headers = [...baseHeaders, ...questionHeaders];

    const sanitizeCsvField = (val: string): string => {
      let s = val.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(s)) {
        s = "'" + s;
      }
      return s;
    };

    const rows = submissions.map((s) => {
      const finalPoints = s.teacherAdjustedPoints !== null ? s.teacherAdjustedPoints : s.earnedPoints;
      const pct = s.totalPoints > 0 ? Math.round((finalPoints / s.totalPoints) * 100) : 0;
      const subAnswers = answersBySubmission.get(s.id) || [];
      const answerMap = new Map(subAnswers.map((a) => [a.questionId, a]));

      const baseRow = [
        sanitizeCsvField(s.studentName),
        sanitizeCsvField(s.studentClass || ""),
        s.earnedPoints.toString(),
        s.totalPoints.toString(),
        pct.toString(),
        s.teacherAdjustedPoints !== null ? s.teacherAdjustedPoints.toString() : "",
        sanitizeCsvField(s.teacherNote || ""),
        new Date(s.submittedAt).toLocaleString("ar-EG"),
      ];

      const questionCols = questions.map((q) => {
        const ans = answerMap.get(q.id);
        if (!ans) return "";
        const mark = ans.isCorrect ? "✓" : "✗";
        return sanitizeCsvField(`${ans.selectedAnswer} ${mark}`);
      });

      return [...baseRow, ...questionCols];
    });

    const csvContent = BOM + [headers.map((h) => `"${sanitizeCsvField(h)}"`).join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="submissions_${id}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    req.log.error({ err: error }, "Export CSV error");
    res.status(500).json({ message: "خطأ في تصدير البيانات" });
  }
});

router.get("/teacher/stats", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const teacherId = req.session.teacherId;

    const teacherAssignments = await db
      .select({ id: assignmentsTable.id })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.teacherId, teacherId));

    if (teacherAssignments.length === 0) {
      res.json({
        gradeDistribution: [],
        studentRanking: [],
        submissionTimeline: [],
        topStudents: [],
      });
      return;
    }

    const assignmentIds = teacherAssignments.map((a) => a.id);

    const allSubmissions = await db
      .select({
        id: submissionsTable.id,
        assignmentId: submissionsTable.assignmentId,
        studentId: submissionsTable.studentId,
        studentName: submissionsTable.studentName,
        studentClass: submissionsTable.studentClass,
        score: submissionsTable.score,
        earnedPoints: submissionsTable.earnedPoints,
        totalPoints: submissionsTable.totalPoints,
        teacherAdjustedPoints: submissionsTable.teacherAdjustedPoints,
        submittedAt: submissionsTable.submittedAt,
      })
      .from(submissionsTable)
      .where(
        sql`${submissionsTable.assignmentId} IN (${sql.join(
          assignmentIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    const gradeRanges = [
      { label: "90-100%", min: 90, max: 100, count: 0 },
      { label: "80-89%", min: 80, max: 89, count: 0 },
      { label: "70-79%", min: 70, max: 79, count: 0 },
      { label: "60-69%", min: 60, max: 69, count: 0 },
      { label: "50-59%", min: 50, max: 59, count: 0 },
      { label: "0-49%", min: 0, max: 49, count: 0 },
    ];

    const getPct = (sub: typeof allSubmissions[0]) => {
      const points = sub.teacherAdjustedPoints !== null ? sub.teacherAdjustedPoints : sub.earnedPoints;
      return sub.totalPoints > 0 ? (points / sub.totalPoints) * 100 : sub.score;
    };

    for (const sub of allSubmissions) {
      const pct = getPct(sub);
      for (const range of gradeRanges) {
        if (pct >= range.min && pct <= range.max) {
          range.count++;
          break;
        }
      }
    }

    const studentScores = new Map<string, { total: number; count: number }>();
    for (const sub of allSubmissions) {
      const pct = getPct(sub);
      const existing = studentScores.get(sub.studentName) || { total: 0, count: 0 };
      existing.total += pct;
      existing.count++;
      studentScores.set(sub.studentName, existing);
    }

    const studentRanking = Array.from(studentScores.entries())
      .map(([name, data]) => ({
        name,
        avgScore: Math.round(data.total / data.count),
        submissions: data.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const timelineMap = new Map<string, { count: number; totalScore: number }>();
    for (const sub of allSubmissions) {
      const date = new Date(sub.submittedAt).toISOString().split("T")[0];
      const pct = getPct(sub);
      const existing = timelineMap.get(date) || { count: 0, totalScore: 0 };
      existing.count++;
      existing.totalScore += pct;
      timelineMap.set(date, existing);
    }

    const submissionTimeline = Array.from(timelineMap.entries())
      .map(([date, data]) => ({
        date,
        count: data.count,
        avgScore: Math.round(data.totalScore / data.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyAggregate = new Map<
      string,
      { id: number; name: string; className: string | null; score: number; latestAt: number }
    >();
    for (const sub of allSubmissions) {
      const submittedAtMs = new Date(sub.submittedAt).getTime();
      if (submittedAtMs < sevenDaysAgo) continue;
      const points = sub.teacherAdjustedPoints !== null ? sub.teacherAdjustedPoints : sub.earnedPoints;
      const key = sub.studentId !== null ? `id:${sub.studentId}` : `name:${sub.studentName}|class:${sub.studentClass || ""}`;
      const existing = weeklyAggregate.get(key);
      if (existing) {
        existing.score += points;
        if (submittedAtMs > existing.latestAt) {
          existing.latestAt = submittedAtMs;
          if (sub.studentClass) existing.className = sub.studentClass;
        }
      } else {
        weeklyAggregate.set(key, {
          id: sub.studentId ?? sub.id,
          name: sub.studentName,
          className: sub.studentClass || null,
          score: points,
          latestAt: submittedAtMs,
        });
      }
    }

    const topStudents = Array.from(weeklyAggregate.values())
      .map(({ latestAt: _latestAt, ...rest }) => ({
        ...rest,
        score: Math.round(rest.score),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({
      gradeDistribution: gradeRanges,
      studentRanking: studentRanking.slice(0, 20),
      submissionTimeline,
      topStudents,
    });
  } catch (error: any) {
    console.error("Error fetching teacher stats:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/assignments/:id/question-stats", async (req, res) => {
  try {
    const { id } = ListSubmissionsParams.parse(req.params);

    if (!req.session.teacherId) {
      res.status(401).json({ message: "يجب تسجيل الدخول كمعلم" });
      return;
    }

    const [assignment] = await db
      .select({ teacherId: assignmentsTable.teacherId })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment || assignment.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بعرض هذه النتائج" });
      return;
    }

    const questions = await db
      .select({ id: questionsTable.id, text: questionsTable.text, questionType: questionsTable.questionType })
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, id));

    const submissionIds = await db
      .select({ id: submissionsTable.id })
      .from(submissionsTable)
      .where(eq(submissionsTable.assignmentId, id));

    if (submissionIds.length === 0) {
      res.json({ totalSubmissions: 0, questions: questions.map(q => ({ id: q.id, text: q.text, questionType: q.questionType, totalAnswers: 0, correctCount: 0, correctRate: 0 })) });
      return;
    }

    const stats = await db
      .select({
        questionId: answersTable.questionId,
        totalAnswers: sql<number>`count(*)::int`,
        correctCount: sql<number>`sum(case when ${answersTable.isCorrect} then 1 else 0 end)::int`,
      })
      .from(answersTable)
      .where(sql`${answersTable.submissionId} in (${sql.join(submissionIds.map(s => sql`${s.id}`), sql`, `)})`)
      .groupBy(answersTable.questionId);

    const statMap = new Map(stats.map(s => [s.questionId, s]));

    res.json({
      totalSubmissions: submissionIds.length,
      questions: questions.map(q => {
        const s = statMap.get(q.id);
        const totalAnswers = s?.totalAnswers || 0;
        const correctCount = s?.correctCount || 0;
        return {
          id: q.id,
          text: q.text,
          questionType: q.questionType,
          totalAnswers,
          correctCount,
          correctRate: totalAnswers > 0 ? correctCount / totalAnswers : 0,
        };
      }),
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Question stats error");
    res.status(500).json({ message: "خطأ في جلب إحصائيات الأسئلة" });
  }
});

router.get("/submissions/:submissionId/details", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول كمعلم" });
    return;
  }
  try {
    const submissionId = parseInt(req.params.submissionId, 10);
    if (isNaN(submissionId)) {
      res.status(400).json({ message: "معرف غير صالح" });
      return;
    }

    const [submission] = await db
      .select()
      .from(submissionsTable)
      .where(eq(submissionsTable.id, submissionId))
      .limit(1);
    if (!submission) {
      res.status(404).json({ message: "الإجابة غير موجودة" });
      return;
    }

    const [assignment] = await db
      .select({ teacherId: assignmentsTable.teacherId })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, submission.assignmentId))
      .limit(1);
    if (!assignment || assignment.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح" });
      return;
    }

    const rows = await db
      .select({
        id: answersTable.id,
        questionId: answersTable.questionId,
        selectedAnswer: answersTable.selectedAnswer,
        isCorrect: answersTable.isCorrect,
        teacherPoints: answersTable.teacherPoints,
        teacherNote: answersTable.teacherNote,
        questionText: questionsTable.text,
        questionType: questionsTable.questionType,
        points: questionsTable.points,
        correctAnswer: questionsTable.correctAnswer,
        optionA: questionsTable.optionA,
        optionB: questionsTable.optionB,
        optionC: questionsTable.optionC,
        optionD: questionsTable.optionD,
      })
      .from(answersTable)
      .innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
      .where(eq(answersTable.submissionId, submissionId))
      .orderBy(answersTable.id);

    res.json({
      submission: {
        id: submission.id,
        studentName: submission.studentName,
        studentClass: submission.studentClass,
        score: submission.score,
        totalQuestions: submission.totalQuestions,
        correctAnswers: submission.correctAnswers,
        earnedPoints: submission.earnedPoints,
        totalPoints: submission.totalPoints,
        teacherAdjustedPoints: submission.teacherAdjustedPoints,
        teacherNote: submission.teacherNote,
        aiFeedback: submission.aiFeedback,
        durationSeconds: submission.durationSeconds,
        submittedAt: submission.submittedAt.toISOString(),
      },
      answers: rows.map(r => ({
        id: r.id,
        questionId: r.questionId,
        questionText: r.questionText,
        questionType: r.questionType,
        points: r.points || 1,
        selectedAnswer: r.selectedAnswer,
        correctAnswer: r.correctAnswer,
        optionA: r.optionA,
        optionB: r.optionB,
        optionC: r.optionC,
        optionD: r.optionD,
        isCorrect: r.isCorrect,
        teacherPoints: r.teacherPoints,
        teacherNote: r.teacherNote,
      })),
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Get submission details error");
    res.status(500).json({ message: "خطأ في جلب التفاصيل" });
  }
});

router.patch("/submission-answers/:answerId", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول كمعلم" });
    return;
  }
  try {
    const answerId = parseInt(req.params.answerId, 10);
    if (isNaN(answerId)) {
      res.status(400).json({ message: "معرف غير صالح" });
      return;
    }
    const body = UpdateAnswerGradeBody.parse(req.body);

    const [row] = await db
      .select({
        answerId: answersTable.id,
        submissionId: answersTable.submissionId,
        assignmentId: submissionsTable.assignmentId,
        teacherId: assignmentsTable.teacherId,
        questionPoints: questionsTable.points,
      })
      .from(answersTable)
      .innerJoin(submissionsTable, eq(answersTable.submissionId, submissionsTable.id))
      .innerJoin(assignmentsTable, eq(submissionsTable.assignmentId, assignmentsTable.id))
      .innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
      .where(eq(answersTable.id, answerId))
      .limit(1);

    if (!row) {
      res.status(404).json({ message: "الإجابة غير موجودة" });
      return;
    }
    if (row.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح" });
      return;
    }

    const maxPts = row.questionPoints || 1;
    if (body.teacherPoints !== undefined && body.teacherPoints !== null) {
      if (body.teacherPoints < 0 || body.teacherPoints > maxPts) {
        res.status(400).json({ message: `الدرجة يجب أن تكون بين 0 و ${maxPts}` });
        return;
      }
    }

    const updateData: Record<string, any> = {};
    if (body.teacherPoints !== undefined) updateData.teacherPoints = body.teacherPoints;
    if (body.teacherNote !== undefined) updateData.teacherNote = body.teacherNote;
    if (body.teacherPoints !== undefined && body.teacherPoints !== null) {
      updateData.isCorrect = body.teacherPoints >= maxPts;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(answersTable).set(updateData).where(eq(answersTable.id, answerId));
    }

    const subAnswers = await db
      .select({
        isCorrect: answersTable.isCorrect,
        teacherPoints: answersTable.teacherPoints,
        questionPoints: questionsTable.points,
      })
      .from(answersTable)
      .innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
      .where(eq(answersTable.submissionId, row.submissionId));

    let earned = 0;
    let total = 0;
    let correctCnt = 0;
    for (const a of subAnswers) {
      const qp = a.questionPoints || 1;
      total += qp;
      if (a.teacherPoints !== null) {
        earned += a.teacherPoints;
        if (a.teacherPoints >= qp) correctCnt += 1;
      } else if (a.isCorrect) {
        earned += qp;
        correctCnt += 1;
      }
    }
    const score = total > 0 ? (earned / total) * 100 : 0;

    const [updatedSub] = await db
      .update(submissionsTable)
      .set({ earnedPoints: earned, correctAnswers: correctCnt, score })
      .where(eq(submissionsTable.id, row.submissionId))
      .returning();

    const detailRows = await db
      .select({
        id: answersTable.id,
        questionId: answersTable.questionId,
        selectedAnswer: answersTable.selectedAnswer,
        isCorrect: answersTable.isCorrect,
        teacherPoints: answersTable.teacherPoints,
        teacherNote: answersTable.teacherNote,
        questionText: questionsTable.text,
        questionType: questionsTable.questionType,
        points: questionsTable.points,
        correctAnswer: questionsTable.correctAnswer,
        optionA: questionsTable.optionA,
        optionB: questionsTable.optionB,
        optionC: questionsTable.optionC,
        optionD: questionsTable.optionD,
      })
      .from(answersTable)
      .innerJoin(questionsTable, eq(answersTable.questionId, questionsTable.id))
      .where(eq(answersTable.submissionId, row.submissionId))
      .orderBy(answersTable.id);

    res.json({
      submission: {
        id: updatedSub.id,
        studentName: updatedSub.studentName,
        studentClass: updatedSub.studentClass,
        score: updatedSub.score,
        totalQuestions: updatedSub.totalQuestions,
        correctAnswers: updatedSub.correctAnswers,
        earnedPoints: updatedSub.earnedPoints,
        totalPoints: updatedSub.totalPoints,
        teacherAdjustedPoints: updatedSub.teacherAdjustedPoints,
        teacherNote: updatedSub.teacherNote,
        aiFeedback: updatedSub.aiFeedback,
        durationSeconds: updatedSub.durationSeconds,
        submittedAt: updatedSub.submittedAt.toISOString(),
      },
      answers: detailRows.map(r => ({
        id: r.id,
        questionId: r.questionId,
        questionText: r.questionText,
        questionType: r.questionType,
        points: r.points || 1,
        selectedAnswer: r.selectedAnswer,
        correctAnswer: r.correctAnswer,
        optionA: r.optionA,
        optionB: r.optionB,
        optionC: r.optionC,
        optionD: r.optionD,
        isCorrect: r.isCorrect,
        teacherPoints: r.teacherPoints,
        teacherNote: r.teacherNote,
      })),
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    req.log.error({ err: error }, "Update answer grade error");
    res.status(500).json({ message: "خطأ في تعديل الدرجة" });
  }
});

export default router;
