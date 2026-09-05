import { Router, type IRouter } from "express";
import { db, assignmentsTable, questionsTable, adaptiveSessionsTable, submissionsTable, answersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { safeAccessCodeEqual, normalizeAccessCode } from "../lib/access-code";

const router: IRouter = Router();
const SUPPORTED_TYPES = new Set(["mcq", "true_false", "fill_blank"]);

interface SkillAbilities { [skill: string]: { ability: number; correct: number; total: number } }
interface QuestionSeqItem { questionId: number; selectedAnswer: string | null; isCorrect: boolean | null; difficulty: number; skill: string }
interface AdaptiveConfig {
  questionsPerSession?: number;
  showImmediateFeedback: boolean;
  showAnswersAfterResult: boolean;
  allowRetry: boolean;
  skills: string[];
}

export function parseAdaptiveConfig(value: string | null): AdaptiveConfig {
  try {
    const valueParsed = value ? JSON.parse(value) : {};
    const skills = Array.isArray(valueParsed.skills) ? valueParsed.skills :
      Array.isArray(valueParsed.targetSkills) ? valueParsed.targetSkills : [];
    return {
      questionsPerSession: Number.isFinite(valueParsed.questionsPerSession) ? valueParsed.questionsPerSession : undefined,
      showImmediateFeedback: valueParsed.showImmediateFeedback === true,
      showAnswersAfterResult: valueParsed.showAnswersAfterResult === true,
      allowRetry: valueParsed.allowRetry === true,
      skills: skills.map((s: unknown) => String(s).trim()).filter(Boolean),
    };
  } catch { return { showImmediateFeedback: false, showAnswersAfterResult: false, allowRetry: false, skills: [] }; }
}

function level(difficulty: number | null): "easy" | "medium" | "hard" {
  return difficulty === 1 ? "easy" : difficulty === 3 ? "hard" : "medium";
}

/** The sole readiness check used by both the teacher endpoint and start. */
export function checkBankReadiness(
  pool: { id?: number; difficulty: number | null; skill: string | null; questionType: string }[],
  config: AdaptiveConfig,
) {
  const skills = config.skills.length ? config.skills : [...new Set(pool.map(q => q.skill || "general"))];
  const details: Record<string, { easy: number; medium: number; hard: number }> = {};
  const unsupported = pool.filter(q => !SUPPORTED_TYPES.has(q.questionType || "mcq"));
  const noSkill = pool.filter(q => !(q.skill || "").trim()).map(q => q.id).filter((id): id is number => id !== undefined);
  const undeclaredSkill = config.skills.length
    ? pool.filter(q => !!(q.skill || "").trim() && !config.skills.includes((q.skill || "").trim())).map(q => q.id).filter((id): id is number => id !== undefined)
    : [];
  for (const skill of skills) details[skill] = { easy: 0, medium: 0, hard: 0 };
  for (const q of pool) {
    const skill = (q.skill || "").trim();
    if (details[skill]) details[skill][level(q.difficulty)]++;
  }
  const missingSkills = skills.filter(skill => !details[skill] || Object.values(details[skill]).some(n => n < 2));
  return {
    valid: unsupported.length === 0 && skills.length > 0 && missingSkills.length === 0 && noSkill.length === 0 && undeclaredSkill.length === 0,
    isReady: unsupported.length === 0 && skills.length > 0 && missingSkills.length === 0 && noSkill.length === 0 && undeclaredSkill.length === 0,
    details, skills: skills.map(skill => ({ skill, ...details[skill] })), missingSkills, noSkill, undeclaredSkill,
    unsupportedTypes: [...new Set(unsupported.map(q => q.questionType || "mcq"))],
    unsupportedType: unsupported.map(q => q.id).filter((id): id is number => id !== undefined),
  };
}

function getDelta(n: number) { return n <= 2 ? .5 : n <= 5 ? .35 : n <= 8 ? .25 : .15; }
function getLevel(ability: number) { return ability < 1.5 ? "beginner" : ability <= 2.5 ? "intermediate" : "advanced"; }
function parseSequence(value: string | null): QuestionSeqItem[] { try { return value ? JSON.parse(value) : []; } catch { return []; } }
function parseAbilities(value: string | null): SkillAbilities { try { return value ? JSON.parse(value) : {}; } catch { return {}; } }
function expiresAt(assignment: any, session: any) {
  const duration = assignment.examMode && assignment.examDurationMinutes
    ? new Date(session.startedAt.getTime() + assignment.examDurationMinutes * 60_000) : null;
  const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
  return duration && deadline ? new Date(Math.min(+duration, +deadline)) : duration || deadline;
}
function resultsAvailable(assignment: any) {
  if (!assignment.showResults) return false;
  if (assignment.resultsReleaseMode === "after_deadline") return !!assignment.deadline && new Date(assignment.deadline) <= new Date();
  return assignment.resultsReleaseMode !== "manual" || assignment.showResults;
}
function sanitizeQuestion(q: any) {
  return { id: q.id, text: q.text, questionType: q.questionType, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, imageUrl: q.imageUrl };
}
function pickNext(ability: number, pool: any[], answered: Set<number>, abilities: SkillAbilities) {
  const remaining = pool.filter(q => !answered.has(q.id));
  const target = Math.max(1, Math.min(3, Math.round(ability)));
  const candidates = remaining.filter(q => q.difficulty === target);
  const choices = candidates.length ? candidates : remaining;
  return choices.sort((a, b) => ((abilities[a.skill || "general"]?.total || 0) - (abilities[b.skill || "general"]?.total || 0)))[0] || null;
}

async function finishSession(tx: any, session: any, pool: any[], sequence: QuestionSeqItem[], ability: number, abilities: SkillAbilities, correctCount: number) {
  if (session.submissionId) return { submissionId: session.submissionId, score: null, earnedPoints: null, totalPoints: null };
  const byId = new Map(pool.map(q => [q.id, q]));
  const totalPoints = sequence.reduce((n, a) => n + (byId.get(a.questionId)?.points || 1), 0);
  const earnedPoints = sequence.reduce((n, a) => n + (a.isCorrect ? (byId.get(a.questionId)?.points || 1) : 0), 0);
  const [submission] = await tx.insert(submissionsTable).values({
    assignmentId: session.assignmentId, studentName: session.studentName, studentClass: session.studentClass,
    deviceFingerprint: session.deviceFingerprint, score: totalPoints ? earnedPoints / totalPoints * 100 : 0,
    earnedPoints, totalPoints, totalQuestions: sequence.length, correctAnswers: correctCount,
  }).returning();
  if (sequence.length) await tx.insert(answersTable).values(sequence.map(a => ({
    submissionId: submission.id, questionId: a.questionId, selectedAnswer: a.selectedAnswer || "",
    isCorrect: !!a.isCorrect, earnedPoints: a.isCorrect ? (byId.get(a.questionId)?.points || 1) : 0,
  })));
  await tx.update(adaptiveSessionsTable).set({
    currentAbility: ability, skillAbilities: JSON.stringify(abilities), questionSequence: JSON.stringify(sequence),
    currentQuestionId: null, answeredCount: sequence.length, correctCount, completed: 1,
    finalLevel: getLevel(ability), submissionId: submission.id, completedAt: new Date(),
  }).where(and(eq(adaptiveSessionsTable.id, session.id), eq(adaptiveSessionsTable.completed, 0)));
  return { submissionId: submission.id, score: Math.round(totalPoints ? earnedPoints / totalPoints * 100 : 0), earnedPoints, totalPoints };
}

function deniedResult(message = "النتائج غير متاحة حالياً") { return { resultAvailable: false, message }; }

router.get("/adaptive/readiness/:assignmentId", async (req, res) => {
  try {
    if (!req.session.teacherId) return void res.status(401).json({ message: "يجب تسجيل الدخول" });
    const id = Number(req.params.assignmentId);
    const [assignment] = await db.select().from(assignmentsTable).where(and(eq(assignmentsTable.id, id), eq(assignmentsTable.teacherId, req.session.teacherId))).limit(1);
    if (!assignment) return void res.status(404).json({ message: "الواجب غير موجود" });
    const pool = await db.select({ id: questionsTable.id, difficulty: questionsTable.difficulty, skill: questionsTable.skill, questionType: questionsTable.questionType }).from(questionsTable).where(eq(questionsTable.assignmentId, id));
    res.json(checkBankReadiness(pool, parseAdaptiveConfig(assignment.adaptiveConfig)));
  } catch (e: any) { res.status(500).json({ message: e.message || "خطأ" }); }
});
router.get("/pool-coverage/:assignmentId", async (req, res) => res.redirect(`/adaptive/readiness/${req.params.assignmentId}`));

router.post("/adaptive/start", async (req, res) => {
  try {
    const { assignmentId, studentName, studentClass, deviceFingerprint } = req.body;
    if (!assignmentId || !studentName || !deviceFingerprint) return void res.status(400).json({ message: "الاسم ورقم الواجب وبصمة الجهاز مطلوبة" });
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, assignmentId)).limit(1);
    if (!assignment || !assignment.isAdaptive) return void res.status(assignment ? 400 : 404).json({ message: assignment ? "هذا الواجب ليس تكيّفياً" : "الواجب غير موجود" });
    if (assignment.accessMode === "private" && (!assignment.accessCode || !safeAccessCodeEqual(normalizeAccessCode(req.body.accessCode), normalizeAccessCode(assignment.accessCode)))) return void res.status(403).json({ message: "كود الدخول غير صحيح" });
    const config = parseAdaptiveConfig(assignment.adaptiveConfig);
    const pool = await db.select().from(questionsTable).where(eq(questionsTable.assignmentId, assignmentId));
    const readiness = checkBankReadiness(pool, config);
    if (!readiness.valid) return void res.status(400).json({ message: "بنك الأسئلة غير جاهز للاختبار التكيّفي", readiness });
    // Prefer the active attempt explicitly: a retry may leave older completed
    // rows for the same fingerprint, and SQL does not promise an implicit order.
    const active = await db.select().from(adaptiveSessionsTable).where(and(
      eq(adaptiveSessionsTable.assignmentId, assignmentId),
      eq(adaptiveSessionsTable.deviceFingerprint, deviceFingerprint),
      eq(adaptiveSessionsTable.completed, 0),
    )).limit(1);
    const completed = active.length ? [] : await db.select().from(adaptiveSessionsTable).where(and(
      eq(adaptiveSessionsTable.assignmentId, assignmentId),
      eq(adaptiveSessionsTable.deviceFingerprint, deviceFingerprint),
      eq(adaptiveSessionsTable.completed, 1),
    )).limit(1);
    const old = active[0] || completed[0];
    if (old && old.completed && !config.allowRetry) return void res.status(409).json({ message: "لقد أكملت هذا الاختبار ولا يسمح بإعادة المحاولة" });
    if (!active.length && assignment.deadline && new Date(assignment.deadline) <= new Date()) {
      return void res.status(403).json({ message: "انتهى موعد الاختبار" });
    }
    const session = old && !old.completed ? old : (await db.insert(adaptiveSessionsTable).values({
      assignmentId, studentName, studentClass: studentClass || "", deviceFingerprint, currentAbility: 2, skillAbilities: "{}", questionSequence: "[]",
      currentQuestionId: pickNext(2, pool, new Set(), {})!.id, answeredCount: 0, totalToAnswer: Math.min(config.questionsPerSession || 10, pool.length), correctCount: 0, completed: 0,
    }).returning())[0];
    const exp = expiresAt(assignment, session);
    if (exp && exp <= new Date()) {
      const sequence = parseSequence(session.questionSequence);
      const abilities = parseAbilities(session.skillAbilities);
      const final = await db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT id FROM adaptive_sessions WHERE id = ${session.id} FOR UPDATE`);
        const [locked] = await tx.select().from(adaptiveSessionsTable).where(eq(adaptiveSessionsTable.id, session.id)).limit(1);
        if (!locked) throw new Error("الجلسة غير موجودة");
        return finishSession(tx, locked, pool, sequence, locked.currentAbility, abilities, locked.correctCount);
      });
      return void res.json({
        sessionId: session.id,
        done: true,
        timedOut: true,
        answeredCount: sequence.length,
        totalQuestions: session.totalToAnswer,
        ...final,
        ...(resultsAvailable(assignment) ? { resultAvailable: true, showAnswersAfterResult: config.showAnswersAfterResult } : deniedResult()),
      });
    }
    const current = pool.find(q => q.id === session.currentQuestionId);
    res.json({ sessionId: session.id, totalQuestions: session.totalToAnswer, answeredCount: session.answeredCount, question: current ? sanitizeQuestion(current) : null, showImmediateFeedback: config.showImmediateFeedback, showAnswersAfterResult: config.showAnswersAfterResult, allowRetry: config.allowRetry, examExpiresAt: exp?.toISOString() || null });
  } catch (e: any) { res.status(500).json({ message: e.message || "خطأ في بدء الجلسة" }); }
});

router.post("/adaptive/answer", async (req, res) => {
  try {
    const { sessionId, questionId, selectedAnswer, deviceFingerprint } = req.body;
    if (!sessionId || !questionId || !deviceFingerprint) return void res.status(400).json({ message: "البيانات وبصمة الجهاز ناقصة" });
    const outcome = await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT id FROM adaptive_sessions WHERE id = ${sessionId} FOR UPDATE`);
      const [session] = await tx.select().from(adaptiveSessionsTable).where(eq(adaptiveSessionsTable.id, sessionId)).limit(1);
      if (!session) return { status: 404, body: { message: "الجلسة غير موجودة" } };
      if (session.deviceFingerprint !== deviceFingerprint) return { status: 403, body: { message: "غير مصرح — جهاز مختلف" } };
      const [assignment] = await tx.select().from(assignmentsTable).where(eq(assignmentsTable.id, session.assignmentId)).limit(1);
      const pool = await tx.select().from(questionsTable).where(eq(questionsTable.assignmentId, session.assignmentId));
      const config = parseAdaptiveConfig(assignment.adaptiveConfig);
      const sequence = parseSequence(session.questionSequence), abilities = parseAbilities(session.skillAbilities);
      const expired = expiresAt(assignment, session);
      if (session.completed || (expired && expired <= new Date())) {
        const final = session.completed ? { submissionId: session.submissionId, score: null, earnedPoints: null, totalPoints: null } : await finishSession(tx, session, pool, sequence, session.currentAbility, abilities, session.correctCount);
        return { status: 200, body: { done: true, timedOut: !session.completed, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, ...final, ...(resultsAvailable(assignment) ? {} : deniedResult()) } };
      }
      if (session.currentQuestionId !== questionId || sequence.some(a => a.questionId === questionId)) return { status: 400, body: { message: "السؤال المرسل لا يتطابق مع السؤال الحالي" } };
      const question = pool.find((q: any) => q.id === questionId);
      if (!question) return { status: 404, body: { message: "السؤال غير موجود" } };
      const answer = String(selectedAnswer || "").trim().toLowerCase();
      const correct = (question.correctAnswer || "").split("|").map((a: string) => a.trim().toLowerCase()).filter(Boolean).includes(answer);
      const skill = question.skill || "general", difficulty = question.difficulty || 2;
      sequence.push({ questionId, selectedAnswer: selectedAnswer || null, isCorrect: correct, difficulty, skill });
      let ability = Math.max(.5, Math.min(3.5, session.currentAbility + (correct ? getDelta(session.answeredCount) : -getDelta(session.answeredCount))));
      const sa = abilities[skill] || (abilities[skill] = { ability: 2, correct: 0, total: 0 });
      sa.ability = Math.max(.5, Math.min(3.5, sa.ability + (correct ? getDelta(sa.total) : -getDelta(sa.total)))); sa.total++; if (correct) sa.correct++;
      const correctCount = session.correctCount + Number(correct);
      if (sequence.length >= session.totalToAnswer) {
        const final = await finishSession(tx, session, pool, sequence, ability, abilities, correctCount);
        return { status: 200, body: { done: true, timedOut: false, isCorrect: config.showImmediateFeedback ? correct : undefined, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, ...final, ...(resultsAvailable(assignment) ? { resultAvailable: true, showAnswersAfterResult: config.showAnswersAfterResult } : deniedResult()) } };
      }
      const next = pickNext(ability, pool, new Set(sequence.map(a => a.questionId)), abilities);
      await tx.update(adaptiveSessionsTable).set({ currentAbility: ability, skillAbilities: JSON.stringify(abilities), questionSequence: JSON.stringify(sequence), currentQuestionId: next?.id || null, answeredCount: sequence.length, correctCount }).where(eq(adaptiveSessionsTable.id, session.id));
      return { status: 200, body: { done: false, isCorrect: config.showImmediateFeedback ? correct : undefined, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, question: next ? sanitizeQuestion(next) : null } };
    });
    res.status(outcome.status).json(outcome.body);
  } catch (e: any) { res.status(500).json({ message: e.message || "خطأ في معالجة الإجابة" }); }
});

router.get("/adaptive/results/:sessionId", async (req, res) => {
  try {
    const id = Number(req.params.sessionId); if (!Number.isInteger(id)) return void res.status(400).json({ message: "معرّف غير صالح" });
    const [session] = await db.select().from(adaptiveSessionsTable).where(eq(adaptiveSessionsTable.id, id)).limit(1);
    if (!session) return void res.status(404).json({ message: "الجلسة غير موجودة" });
    const [assignment] = await db.select().from(assignmentsTable).where(eq(assignmentsTable.id, session.assignmentId)).limit(1);
    const teacher = !!req.session.teacherId && assignment.teacherId === req.session.teacherId;
    if (!teacher && req.query.fp !== session.deviceFingerprint) return void res.status(403).json({ message: "غير مصرح" });
    if (!teacher && !resultsAvailable(assignment)) return void res.json({ sessionId: id, completed: !!session.completed, ...deniedResult() });
    const sequence = parseSequence(session.questionSequence), abilities = parseAbilities(session.skillAbilities);
    const pool = await db.select().from(questionsTable).where(eq(questionsTable.assignmentId, session.assignmentId));
    const answers = (teacher || parseAdaptiveConfig(assignment.adaptiveConfig).showAnswersAfterResult) ? sequence.map(a => {
      const q = pool.find(p => p.id === a.questionId);
      return { questionId: a.questionId, questionText: q?.text || "", selectedAnswer: a.selectedAnswer, correctAnswer: q?.correctAnswer || "", isCorrect: a.isCorrect, points: q?.points || 1, ...(teacher ? { difficulty: a.difficulty, skill: a.skill } : {}) };
    }) : [];
    res.json({ sessionId: id, studentName: session.studentName, studentClass: session.studentClass, completed: !!session.completed, resultAvailable: true, finalLevel: session.finalLevel, currentAbility: session.currentAbility, answeredCount: session.answeredCount, correctCount: session.correctCount, totalToAnswer: session.totalToAnswer, skillAbilities: teacher ? abilities : undefined, answers, startedAt: session.startedAt.toISOString(), completedAt: session.completedAt?.toISOString() || null });
  } catch (e: any) { res.status(500).json({ message: e.message || "خطأ" }); }
});

router.get("/adaptive/report/:assignmentId", async (req, res) => {
  try {
    if (!req.session.teacherId) return void res.status(401).json({ message: "يجب تسجيل الدخول" });
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isInteger(assignmentId)) return void res.status(400).json({ message: "معرّف غير صالح" });
    const [assignment] = await db.select().from(assignmentsTable).where(and(
      eq(assignmentsTable.id, assignmentId),
      eq(assignmentsTable.teacherId, req.session.teacherId),
    )).limit(1);
    if (!assignment) return void res.status(404).json({ message: "الواجب غير موجود" });

    const sessions = await db.select().from(adaptiveSessionsTable).where(and(
      eq(adaptiveSessionsTable.assignmentId, assignmentId),
      eq(adaptiveSessionsTable.completed, 1),
    ));
    const allSkills = new Set<string>();
    const students = sessions.map(session => {
      const skillAbilities = parseAbilities(session.skillAbilities);
      Object.keys(skillAbilities).forEach(skill => allSkills.add(skill));
      return {
        sessionId: session.id,
        studentName: session.studentName,
        studentClass: session.studentClass,
        finalLevel: session.finalLevel,
        currentAbility: session.currentAbility,
        correctCount: session.correctCount,
        answeredCount: session.answeredCount,
        totalToAnswer: session.totalToAnswer,
        skillAbilities,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString() || null,
      };
    });
    const skillAverages: Record<string, { avgAbility: number; avgCorrectRate: number }> = {};
    for (const skill of allSkills) {
      const measured = students.map(student => student.skillAbilities[skill]).filter(Boolean);
      if (!measured.length) continue;
      skillAverages[skill] = {
        avgAbility: measured.reduce((sum, item) => sum + item.ability, 0) / measured.length,
        avgCorrectRate: measured.reduce((sum, item) => sum + (item.total ? item.correct / item.total : 0), 0) / measured.length,
      };
    }
    res.json({
      assignmentId,
      totalSessions: sessions.length,
      skills: [...allSkills],
      skillAverages,
      levelDistribution: {
        beginner: students.filter(student => student.finalLevel === "beginner").length,
        intermediate: students.filter(student => student.finalLevel === "intermediate").length,
        advanced: students.filter(student => student.finalLevel === "advanced").length,
      },
      students,
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message || "خطأ" });
  }
});

export default router;