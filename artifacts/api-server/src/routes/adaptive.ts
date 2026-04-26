import { Router, type IRouter } from "express";
import { db, assignmentsTable, questionsTable, adaptiveSessionsTable, submissionsTable, answersTable, teachersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { safeAccessCodeEqual, normalizeAccessCode } from "../lib/access-code";

const router: IRouter = Router();

interface SkillAbilities {
  [skill: string]: { ability: number; correct: number; total: number };
}

interface QuestionSeqItem {
  questionId: number;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  difficulty: number;
  skill: string;
}

function getLevel(ability: number): string {
  if (ability < 1.5) return "beginner";
  if (ability <= 2.5) return "intermediate";
  return "advanced";
}

function getAdaptiveDelta(answeredCount: number): number {
  if (answeredCount <= 2) return 0.5;
  if (answeredCount <= 5) return 0.35;
  if (answeredCount <= 8) return 0.25;
  return 0.15;
}

interface PoolCoverage {
  valid: boolean;
  details: Record<string, { easy: number; medium: number; hard: number }>;
}

function checkPoolCoverage(
  pool: { difficulty: number | null; skill: string | null }[]
): PoolCoverage {
  const details: Record<string, { easy: number; medium: number; hard: number }> = {};
  for (const q of pool) {
    const sk = q.skill || "general";
    if (!details[sk]) details[sk] = { easy: 0, medium: 0, hard: 0 };
    const d = q.difficulty || 2;
    if (d === 1) details[sk].easy++;
    else if (d === 3) details[sk].hard++;
    else details[sk].medium++;
  }
  let valid = true;
  for (const sk of Object.keys(details)) {
    const c = details[sk];
    if (c.easy < 2 || c.medium < 2 || c.hard < 2) valid = false;
  }
  return { valid, details };
}

function pickNextQuestion(
  ability: number,
  pool: { id: number; difficulty: number | null; skill: string | null }[],
  answeredIds: Set<number>,
  skillAbilities: SkillAbilities
): { id: number; difficulty: number | null; skill: string | null } | null {
  const remaining = pool.filter((q) => !answeredIds.has(q.id));
  if (remaining.length === 0) return null;

  const targetDiff = Math.round(ability);
  const clamped = Math.max(1, Math.min(3, targetDiff));

  const exact = remaining.filter((q) => q.difficulty === clamped);
  if (exact.length > 0) {
    const leastAnsweredSkill = findLeastAnsweredSkill(exact, skillAbilities);
    if (leastAnsweredSkill) return leastAnsweredSkill;
    return exact[Math.floor(Math.random() * exact.length)];
  }

  const close = remaining.filter((q) => q.difficulty !== null && Math.abs(q.difficulty - clamped) <= 1);
  if (close.length > 0) {
    return close[Math.floor(Math.random() * close.length)];
  }

  return remaining[Math.floor(Math.random() * remaining.length)];
}

function findLeastAnsweredSkill(
  questions: { id: number; difficulty: number | null; skill: string | null }[],
  skillAbilities: SkillAbilities
): { id: number; difficulty: number | null; skill: string | null } | null {
  const bySkill: Record<string, typeof questions> = {};
  for (const q of questions) {
    const s = q.skill || "general";
    if (!bySkill[s]) bySkill[s] = [];
    bySkill[s].push(q);
  }

  let minTotal = Infinity;
  let bestSkill = "";
  for (const [skill, qs] of Object.entries(bySkill)) {
    const total = skillAbilities[skill]?.total || 0;
    if (total < minTotal) {
      minTotal = total;
      bestSkill = skill;
    }
  }
  if (!bestSkill) return null;
  const candidates = bySkill[bestSkill];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function sanitizeQuestion(q: {
  id: number;
  text: string;
  questionType: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  imageUrl: string | null;
  difficulty: number | null;
  skill: string | null;
}) {
  return {
    id: q.id,
    text: q.text,
    questionType: q.questionType,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    imageUrl: q.imageUrl,
    difficulty: q.difficulty,
    skill: q.skill,
  };
}

router.post("/adaptive/start", async (req, res) => {
  try {
    const { assignmentId, studentName, studentClass, deviceFingerprint } = req.body;
    if (!assignmentId || !studentName) {
      res.status(400).json({ message: "الاسم ورقم الواجب مطلوبان" });
      return;
    }

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, assignmentId))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }
    if (!assignment.isAdaptive) {
      res.status(400).json({ message: "هذا الواجب ليس تكيّفياً" });
      return;
    }

    if (assignment.accessMode === "private") {
      if (!assignment.accessCode) {
        res.status(403).json({ message: "هذا الواجب خاص ولا يمكن الوصول إليه حالياً" });
        return;
      }
      const submittedCode = normalizeAccessCode(req.body.accessCode);
      const storedCode = normalizeAccessCode(assignment.accessCode);
      if (!submittedCode || !safeAccessCodeEqual(submittedCode, storedCode)) {
        res.status(403).json({ message: "كود الدخول غير صحيح" });
        return;
      }
    }

    const pool = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, assignmentId));

    if (pool.length === 0) {
      res.status(400).json({ message: "لا توجد أسئلة في هذا الواجب" });
      return;
    }

    const coverage = checkPoolCoverage(pool);
    if (!coverage.valid) {
      res.status(400).json({
        message: "مجموعة الأسئلة غير كافية للاختبار التكيّفي. يجب توفير سؤالين على الأقل لكل مستوى صعوبة لكل مهارة.",
        poolCoverage: coverage,
      });
      return;
    }

    const config = assignment.adaptiveConfig ? JSON.parse(assignment.adaptiveConfig) : {};
    const totalToAnswer = Math.min(config.questionsPerSession || 10, pool.length);

    const firstQ = pickNextQuestion(2.0, pool, new Set(), {});
    if (!firstQ) {
      res.status(400).json({ message: "لا توجد أسئلة متاحة" });
      return;
    }

    const questionSequence: QuestionSeqItem[] = [];

    const [session] = await db
      .insert(adaptiveSessionsTable)
      .values({
        assignmentId,
        studentName,
        studentClass: studentClass || "",
        deviceFingerprint: deviceFingerprint || null,
        currentAbility: 2.0,
        skillAbilities: JSON.stringify({}),
        questionSequence: JSON.stringify(questionSequence),
        currentQuestionId: firstQ.id,
        answeredCount: 0,
        totalToAnswer,
        correctCount: 0,
        completed: 0,
      })
      .returning();

    const fullQ = pool.find((q) => q.id === firstQ.id)!;

    res.json({
      sessionId: session.id,
      totalQuestions: totalToAnswer,
      answeredCount: 0,
      currentAbility: 2.0,
      currentLevel: "intermediate",
      question: sanitizeQuestion(fullQ),
      poolCoverage: coverage,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "خطأ في بدء الجلسة";
    res.status(500).json({ message: msg });
  }
});

router.post("/adaptive/answer", async (req, res) => {
  try {
    const { sessionId, questionId, selectedAnswer } = req.body;
    if (!sessionId || !questionId) {
      res.status(400).json({ message: "البيانات ناقصة" });
      return;
    }

    const [session] = await db
      .select()
      .from(adaptiveSessionsTable)
      .where(eq(adaptiveSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }
    if (session.completed === 1) {
      res.status(400).json({ message: "الجلسة مكتملة بالفعل" });
      return;
    }

    const [question] = await db
      .select()
      .from(questionsTable)
      .where(and(eq(questionsTable.id, questionId), eq(questionsTable.assignmentId, session.assignmentId)))
      .limit(1);

    if (!question) {
      res.status(404).json({ message: "السؤال غير موجود" });
      return;
    }

    const previousSequence: QuestionSeqItem[] = session.questionSequence
      ? JSON.parse(session.questionSequence)
      : [];
    if (previousSequence.some((qi) => qi.questionId === questionId)) {
      res.status(400).json({ message: "تمت الإجابة على هذا السؤال مسبقاً" });
      return;
    }

    const clientFp = req.body.deviceFingerprint as string | undefined;
    if (session.deviceFingerprint && (!clientFp || clientFp !== session.deviceFingerprint)) {
      res.status(403).json({ message: "غير مصرح — جهاز مختلف" });
      return;
    }

    if (session.currentQuestionId !== questionId) {
      res.status(400).json({ message: "السؤال المرسل لا يتطابق مع السؤال الحالي" });
      return;
    }

    const studentAns = selectedAnswer?.toString().trim().toLowerCase() ?? "";
    const acceptedAnswers = (question.correctAnswer || "").split("|").map(s => s.trim().toLowerCase()).filter(Boolean);
    const isCorrect = question.correctAnswer
      ? (acceptedAnswers.length > 0 ? acceptedAnswers.some(a => a === studentAns) : studentAns === question.correctAnswer.trim().toLowerCase())
      : false;

    const questionSequence: QuestionSeqItem[] = previousSequence;
    const skillAbilities: SkillAbilities = session.skillAbilities
      ? JSON.parse(session.skillAbilities)
      : {};

    const qSkill = question.skill || "general";
    const qDiff = question.difficulty || 2;

    questionSequence.push({
      questionId,
      selectedAnswer: selectedAnswer || null,
      isCorrect,
      difficulty: qDiff,
      skill: qSkill,
    });

    let ability = session.currentAbility;
    const delta = getAdaptiveDelta(session.answeredCount);
    if (isCorrect) {
      ability = Math.min(3.5, ability + delta);
    } else {
      ability = Math.max(0.5, ability - delta);
    }

    if (!skillAbilities[qSkill]) {
      skillAbilities[qSkill] = { ability: 2.0, correct: 0, total: 0 };
    }
    const skillDelta = getAdaptiveDelta(skillAbilities[qSkill].total);
    skillAbilities[qSkill].total += 1;
    if (isCorrect) {
      skillAbilities[qSkill].correct += 1;
      skillAbilities[qSkill].ability = Math.min(3.5, skillAbilities[qSkill].ability + skillDelta);
    } else {
      skillAbilities[qSkill].ability = Math.max(0.5, skillAbilities[qSkill].ability - skillDelta);
    }

    const newAnswered = session.answeredCount + 1;
    const newCorrect = session.correctCount + (isCorrect ? 1 : 0);
    const isDone = newAnswered >= session.totalToAnswer;

    if (isDone) {
      const finalLevel = getLevel(ability);

      const pool = await db
        .select()
        .from(questionsTable)
        .where(eq(questionsTable.assignmentId, session.assignmentId));

      const totalPoints = questionSequence.reduce((s, qi) => {
        const pq = pool.find((p) => p.id === qi.questionId);
        return s + (pq?.points || 1);
      }, 0);
      const earnedPoints = questionSequence.reduce((s, qi) => {
        if (!qi.isCorrect) return s;
        const pq = pool.find((p) => p.id === qi.questionId);
        return s + (pq?.points || 1);
      }, 0);

      const [submission] = await db
        .insert(submissionsTable)
        .values({
          assignmentId: session.assignmentId,
          studentName: session.studentName,
          studentClass: session.studentClass,
          score: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0,
          earnedPoints,
          totalPoints,
          totalQuestions: questionSequence.length,
          correctAnswers: newCorrect,
        })
        .returning();

      const answerValues = questionSequence.map((qi) => {
        const pq = pool.find((p) => p.id === qi.questionId);
        return {
          submissionId: submission.id,
          questionId: qi.questionId,
          selectedAnswer: qi.selectedAnswer || "",
          isCorrect: qi.isCorrect || false,
          earnedPoints: qi.isCorrect ? (pq?.points || 1) : 0,
        };
      });
      if (answerValues.length > 0) {
        await db.insert(answersTable).values(answerValues);
      }

      await db
        .update(adaptiveSessionsTable)
        .set({
          currentAbility: ability,
          skillAbilities: JSON.stringify(skillAbilities),
          questionSequence: JSON.stringify(questionSequence),
          currentQuestionId: null,
          answeredCount: newAnswered,
          correctCount: newCorrect,
          completed: 1,
          finalLevel,
          submissionId: submission.id,
          completedAt: new Date(),
        })
        .where(eq(adaptiveSessionsTable.id, sessionId));

      res.json({
        done: true,
        isCorrect,
        answeredCount: newAnswered,
        totalQuestions: session.totalToAnswer,
        currentAbility: ability,
        currentLevel: finalLevel,
        submissionId: submission.id,
        score: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
        earnedPoints,
        totalPoints,
        correctAnswers: newCorrect,
        skillAbilities,
      });
      return;
    }

    const pool = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, session.assignmentId));

    const answeredIds = new Set(questionSequence.map((qi) => qi.questionId));
    const nextQ = pickNextQuestion(ability, pool, answeredIds, skillAbilities);

    await db
      .update(adaptiveSessionsTable)
      .set({
        currentAbility: ability,
        skillAbilities: JSON.stringify(skillAbilities),
        questionSequence: JSON.stringify(questionSequence),
        currentQuestionId: nextQ ? nextQ.id : null,
        answeredCount: newAnswered,
        correctCount: newCorrect,
      })
      .where(eq(adaptiveSessionsTable.id, sessionId));

    res.json({
      done: false,
      isCorrect,
      answeredCount: newAnswered,
      totalQuestions: session.totalToAnswer,
      currentAbility: ability,
      currentLevel: getLevel(ability),
      question: nextQ ? sanitizeQuestion(pool.find((q) => q.id === nextQ.id)!) : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "خطأ في معالجة الإجابة";
    res.status(500).json({ message: msg });
  }
});

router.get("/adaptive/results/:sessionId", async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    if (isNaN(sessionId)) {
      res.status(400).json({ message: "معرّف غير صالح" });
      return;
    }

    const [session] = await db
      .select()
      .from(adaptiveSessionsTable)
      .where(eq(adaptiveSessionsTable.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ message: "الجلسة غير موجودة" });
      return;
    }

    if (req.session.teacherId) {
      const [ownerAssignment] = await db
        .select({ teacherId: assignmentsTable.teacherId })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, session.assignmentId))
        .limit(1);
      if (!ownerAssignment || ownerAssignment.teacherId !== req.session.teacherId) {
        res.status(403).json({ message: "غير مصرح" });
        return;
      }
    } else {
      const clientFp = req.query.fp as string | undefined;
      if (!clientFp || clientFp !== session.deviceFingerprint) {
        res.status(403).json({ message: "غير مصرح" });
        return;
      }
    }

    const questionSequence: QuestionSeqItem[] = session.questionSequence
      ? JSON.parse(session.questionSequence)
      : [];
    const skillAbilities: SkillAbilities = session.skillAbilities
      ? JSON.parse(session.skillAbilities)
      : {};

    const pool = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, session.assignmentId));

    const answers = questionSequence.map((qi) => {
      const q = pool.find((p) => p.id === qi.questionId);
      return {
        questionId: qi.questionId,
        questionText: q?.text || "",
        selectedAnswer: qi.selectedAnswer,
        correctAnswer: q?.correctAnswer || "",
        isCorrect: qi.isCorrect,
        difficulty: qi.difficulty,
        skill: qi.skill,
        points: q?.points || 1,
      };
    });

    res.json({
      sessionId: session.id,
      studentName: session.studentName,
      studentClass: session.studentClass,
      finalLevel: session.finalLevel,
      currentAbility: session.currentAbility,
      answeredCount: session.answeredCount,
      correctCount: session.correctCount,
      totalToAnswer: session.totalToAnswer,
      skillAbilities,
      answers,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "خطأ";
    res.status(500).json({ message: msg });
  }
});

router.get("/adaptive/report/:assignmentId", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      res.status(401).json({ message: "يجب تسجيل الدخول" });
      return;
    }

    const assignmentId = parseInt(req.params.assignmentId);
    if (isNaN(assignmentId)) {
      res.status(400).json({ message: "معرّف غير صالح" });
      return;
    }

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, assignmentId), eq(assignmentsTable.teacherId, req.session.teacherId)))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    const sessions = await db
      .select()
      .from(adaptiveSessionsTable)
      .where(and(eq(adaptiveSessionsTable.assignmentId, assignmentId), eq(adaptiveSessionsTable.completed, 1)));

    const allSkills = new Set<string>();
    const studentReports = sessions.map((s) => {
      const sa: SkillAbilities = s.skillAbilities ? JSON.parse(s.skillAbilities) : {};
      Object.keys(sa).forEach((sk) => allSkills.add(sk));
      return {
        sessionId: s.id,
        studentName: s.studentName,
        studentClass: s.studentClass,
        finalLevel: s.finalLevel,
        currentAbility: s.currentAbility,
        correctCount: s.correctCount,
        answeredCount: s.answeredCount,
        totalToAnswer: s.totalToAnswer,
        skillAbilities: sa,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt ? s.completedAt.toISOString() : null,
      };
    });

    const skillAverages: Record<string, { avgAbility: number; avgCorrectRate: number }> = {};
    for (const skill of allSkills) {
      let totalAbility = 0;
      let totalCorrectRate = 0;
      let count = 0;
      for (const sr of studentReports) {
        const sa = sr.skillAbilities[skill];
        if (sa) {
          totalAbility += sa.ability;
          totalCorrectRate += sa.total > 0 ? sa.correct / sa.total : 0;
          count++;
        }
      }
      if (count > 0) {
        skillAverages[skill] = {
          avgAbility: totalAbility / count,
          avgCorrectRate: totalCorrectRate / count,
        };
      }
    }

    const levelDistribution = {
      beginner: studentReports.filter((s) => s.finalLevel === "beginner").length,
      intermediate: studentReports.filter((s) => s.finalLevel === "intermediate").length,
      advanced: studentReports.filter((s) => s.finalLevel === "advanced").length,
    };

    res.json({
      assignmentId,
      totalSessions: sessions.length,
      skills: Array.from(allSkills),
      skillAverages,
      levelDistribution,
      students: studentReports,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "خطأ";
    res.status(500).json({ message: msg });
  }
});

router.get("/pool-coverage/:assignmentId", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      res.status(401).json({ message: "يجب تسجيل الدخول" });
      return;
    }

    const assignmentId = parseInt(req.params.assignmentId);
    if (isNaN(assignmentId)) {
      res.status(400).json({ message: "معرّف غير صالح" });
      return;
    }

    const [assignment] = await db
      .select({ teacherId: assignmentsTable.teacherId })
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, assignmentId), eq(assignmentsTable.teacherId, req.session.teacherId)))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    const pool = await db
      .select({ difficulty: questionsTable.difficulty, skill: questionsTable.skill })
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, assignmentId));

    const coverage = checkPoolCoverage(pool);
    res.json(coverage);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "خطأ";
    res.status(500).json({ message: msg });
  }
});

export default router;
