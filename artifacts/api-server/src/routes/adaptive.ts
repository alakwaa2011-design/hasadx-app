import { Router, type IRouter } from "express";
import { db, assignmentsTable, questionsTable, adaptiveSessionsTable, submissionsTable, answersTable } from "@workspace/db";
import { eq, and, sql, asc } from "drizzle-orm";
import { safeAccessCodeEqual, normalizeAccessCode } from "../lib/access-code";

const router: IRouter = Router();
const SUPPORTED_TYPES = new Set(["mcq", "true_false", "fill_blank"]);

interface SkillAbilities { [skill: string]: { ability: number; correct: number; total: number } }
interface QuestionSeqItem {
  questionId: number;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  difficulty: number;
  skill: string;
  answeredAt?: string;
  responseTimeSeconds?: number | null;
  stageId?: string | null;
  stageName?: string | null;
  stagePhase?: "main" | "support" | null;
  stageAttempt?: number | null;
}
export interface AdaptiveStage {
  id: string; name?: string; questionCount: number;
  passRule: { type: "percent" | "correctCount"; threshold: number };
  difficulties: number[]; skills: string[]; failureAction: "support" | "repeat" | "continue" | "finish";
  supportQuestionCount: number; maxRepeats: number; durationMinutes?: number;
}
export interface AdaptiveConfig {
  questionsPerSession?: number;
  showImmediateFeedback: boolean;
  showAnswersAfterResult: boolean;
  allowRetry: boolean;
  skills: string[];
  mode: "continuous" | "staged";
  stages: AdaptiveStage[];
  showStageNames: boolean;
}

export function parseAdaptiveConfig(value: string | null): AdaptiveConfig {
  try {
    const valueParsed = value ? JSON.parse(value) : {};
    const skills = Array.isArray(valueParsed.skills) ? valueParsed.skills :
      Array.isArray(valueParsed.targetSkills) ? valueParsed.targetSkills : [];
    const stages: AdaptiveStage[] = Array.isArray(valueParsed.stages) ? valueParsed.stages.map((raw: any, index: number) => {
      const rule = raw?.passRule || {};
      const type = rule.type === "correctCount" ? "correctCount" : "percent";
      const difficultyValues = Array.isArray(raw?.difficulties) ? raw.difficulties : [];
      const difficulties = difficultyValues.map((d: unknown) => typeof d === "string" ? ({ easy: 1, medium: 2, hard: 3 } as Record<string, number>)[d.toLowerCase()] : Number(d)).filter((d: number) => d >= 1 && d <= 3);
      const action = ["support", "repeat", "continue", "finish"].includes(raw?.failureAction) ? raw.failureAction : "continue";
      const questionCount = Math.max(1, Math.floor(Number(raw?.questionCount) || 1));
      const rawThreshold = Math.max(0, Number(rule.threshold) || 0);
      return {
        id: String(raw?.id || `stage-${index + 1}`).trim() || `stage-${index + 1}`,
        name: typeof raw?.name === "string" ? raw.name : undefined,
        questionCount,
        passRule: { type, threshold: Math.min(type === "percent" ? 100 : questionCount, rawThreshold) },
        difficulties: [...new Set(difficulties)],
        skills: (Array.isArray(raw?.skills) ? raw.skills : []).map((s: unknown) => String(s).trim()).filter(Boolean),
        failureAction: action,
        supportQuestionCount: Math.max(0, Math.floor(Number(raw?.supportQuestionCount) || 0)),
        maxRepeats: Math.max(0, Math.floor(Number(raw?.maxRepeats) || 0)),
        durationMinutes: Number(raw?.durationMinutes) > 0 ? Number(raw.durationMinutes) : undefined,
      };
    }) : [];
    return {
      questionsPerSession: Number.isFinite(valueParsed.questionsPerSession) ? valueParsed.questionsPerSession : undefined,
      showImmediateFeedback: valueParsed.showImmediateFeedback === true,
      showAnswersAfterResult: valueParsed.showAnswersAfterResult === true,
      allowRetry: valueParsed.allowRetry === true,
      skills: skills.map((s: unknown) => String(s).trim()).filter(Boolean),
      mode: valueParsed.mode === "staged" && stages.length ? "staged" : "continuous",
      stages,
      showStageNames: valueParsed.showStageNames === true,
    };
  } catch { return { showImmediateFeedback: false, showAnswersAfterResult: false, allowRetry: false, skills: [], mode: "continuous", stages: [], showStageNames: false }; }
}

function level(difficulty: number | null): "easy" | "medium" | "hard" {
  return difficulty === 1 ? "easy" : difficulty === 3 ? "hard" : "medium";
}

/** The sole readiness check used by both the teacher endpoint and start. */
export function checkBankReadiness(
  pool: { id?: number; difficulty: number | null; skill: string | null; questionType: string }[],
  config: AdaptiveConfig,
) {
  const stagedSkills = [...new Set(config.stages.flatMap(stage => stage.skills))];
  const declaredSkills = config.skills.length ? config.skills : stagedSkills;
  const skills = declaredSkills.length ? declaredSkills : [...new Set(pool.map(q => q.skill || "general"))];
  const details: Record<string, { easy: number; medium: number; hard: number }> = {};
  const unsupported = pool.filter(q => !SUPPORTED_TYPES.has(q.questionType || "mcq"));
  const noSkill = pool.filter(q => !(q.skill || "").trim()).map(q => q.id).filter((id): id is number => id !== undefined);
  const undeclaredSkill = declaredSkills.length
    ? pool.filter(q => !!(q.skill || "").trim() && !declaredSkills.includes((q.skill || "").trim())).map(q => q.id).filter((id): id is number => id !== undefined)
    : [];
  for (const skill of skills) details[skill] = { easy: 0, medium: 0, hard: 0 };
  for (const q of pool) {
    const skill = (q.skill || "").trim();
    if (details[skill]) details[skill][level(q.difficulty)]++;
  }
  const missingSkills = config.mode === "staged" ? [] : skills.filter(skill => !details[skill] || Object.values(details[skill]).some(n => n < 2));
  const stageRequirements = config.mode === "staged" ? config.stages.map(stage => {
    const required = stage.questionCount * (stage.failureAction === "repeat" ? stage.maxRepeats + 1 : 1) +
      (stage.failureAction === "support" ? stage.supportQuestionCount : 0);
    const available = stagePool(pool.filter(q => SUPPORTED_TYPES.has(q.questionType || "mcq")), stage).length;
    return { stageId: stage.id, required, available, valid: available >= required };
  }) : [];
  const insufficientStages = stageRequirements.filter(stage => !stage.valid).map(stage => stage.stageId);
  return {
    valid: unsupported.length === 0 && skills.length > 0 && missingSkills.length === 0 && noSkill.length === 0 && undeclaredSkill.length === 0 && insufficientStages.length === 0,
    isReady: unsupported.length === 0 && skills.length > 0 && missingSkills.length === 0 && noSkill.length === 0 && undeclaredSkill.length === 0 && insufficientStages.length === 0,
    details, skills: skills.map(skill => ({ skill, ...details[skill] })), missingSkills, noSkill, undeclaredSkill,
    unsupportedTypes: [...new Set(unsupported.map(q => q.questionType || "mcq"))],
    unsupportedType: unsupported.map(q => q.id).filter((id): id is number => id !== undefined),
    stageRequirements, insufficientStages,
  };
}

function getDelta(n: number) { return n <= 2 ? .5 : n <= 5 ? .35 : n <= 8 ? .25 : .15; }
function getLevel(ability: number) { return ability < 1.5 ? "beginner" : ability <= 2.5 ? "intermediate" : "advanced"; }
function parseSequence(value: string | null): QuestionSeqItem[] { try { return value ? JSON.parse(value) : []; } catch { return []; } }
export interface StageRuntime { stageIndex: number; stageStartedAt: string; stageAnswered: number; stageCorrect: number; repeats: number; phase: "main" | "support"; supportAnswered: number }
function parseStored(value: string | null): { abilities: SkillAbilities; stageRuntime?: StageRuntime } {
  try {
    const parsed = value ? JSON.parse(value) : {};
    const stageRuntime = parsed.__stageRuntime;
    delete parsed.__stageRuntime;
    return { abilities: parsed, stageRuntime };
  } catch { return { abilities: {} }; }
}
function parseAbilities(value: string | null): SkillAbilities { return parseStored(value).abilities; }
function storeAbilities(abilities: SkillAbilities, stageRuntime?: StageRuntime) { return JSON.stringify(stageRuntime ? { ...abilities, __stageRuntime: stageRuntime } : abilities); }
function initialStageRuntime(): StageRuntime { return { stageIndex: 0, stageStartedAt: new Date().toISOString(), stageAnswered: 0, stageCorrect: 0, repeats: 0, phase: "main", supportAnswered: 0 }; }
function stagePool(pool: any[], stage: AdaptiveStage | undefined) {
  if (!stage) return pool;
  return pool.filter(q => (!stage.difficulties.length || stage.difficulties.includes(q.difficulty || 2)) && (!stage.skills.length || stage.skills.includes((q.skill || "").trim())));
}
export function stagePassed(stage: AdaptiveStage, correct: number, answered: number) {
  return stage.passRule.type === "correctCount" ? correct >= stage.passRule.threshold : (answered ? correct / answered * 100 : 0) >= stage.passRule.threshold;
}
export function nextStageTransition(stage: AdaptiveStage, runtime: StageRuntime) {
  if (runtime.phase === "support") return "advance" as const;
  if (stagePassed(stage, runtime.stageCorrect, runtime.stageAnswered)) return "advance" as const;
  if (stage.failureAction === "repeat" && runtime.repeats < stage.maxRepeats) return "repeat" as const;
  if (stage.failureAction === "support" && stage.supportQuestionCount > 0) return "support" as const;
  return stage.failureAction === "finish" ? "finish" as const : "advance" as const;
}
function expiresAt(assignment: any, session: any) {
  const duration = assignment.examMode && assignment.examDurationMinutes
    ? new Date(session.startedAt.getTime() + assignment.examDurationMinutes * 60_000) : null;
  const deadline = assignment.deadline ? new Date(assignment.deadline) : null;
  return duration && deadline ? new Date(Math.min(+duration, +deadline)) : duration || deadline;
}
function stageExpiresAt(config: AdaptiveConfig, runtime: StageRuntime | undefined) {
  const stage = runtime && config.mode === "staged" ? config.stages[runtime.stageIndex] : undefined;
  return stage?.durationMinutes && runtime ? new Date(new Date(runtime.stageStartedAt).getTime() + stage.durationMinutes * 60_000) : null;
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

async function finishSession(
  tx: any,
  session: any,
  pool: any[],
  sequence: QuestionSeqItem[],
  ability: number,
  abilities: SkillAbilities,
  correctCount: number,
  latestRuntime?: StageRuntime,
  completionReason: "completed" | "timeout" = "completed",
) {
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
    currentAbility: ability, skillAbilities: storeAbilities(abilities, latestRuntime || parseStored(session.skillAbilities).stageRuntime), questionSequence: JSON.stringify(sequence),
    currentQuestionId: null, answeredCount: sequence.length, correctCount, completed: 1,
    finalLevel: getLevel(ability), submissionId: submission.id, completedAt: new Date(),
    completionReason, lastQuestionId: session.currentQuestionId,
    lastQuestionStartedAt: session.currentQuestionStartedAt,
    currentQuestionStartedAt: null,
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
    const runtime = config.mode === "staged" ? initialStageRuntime() : undefined;
    const initialPool = stagePool(pool, config.mode === "staged" ? config.stages[0] : undefined);
    if (!initialPool.length) return void res.status(400).json({ message: "لا توجد أسئلة مطابقة للمرحلة الحالية" });
    const session = old && !old.completed ? old : (await db.insert(adaptiveSessionsTable).values({
      assignmentId, studentName, studentClass: studentClass || "", deviceFingerprint, currentAbility: 2, questionSequence: "[]",
      currentQuestionId: pickNext(2, initialPool, new Set(), {})!.id,
      currentQuestionStartedAt: new Date(),
      answeredCount: 0,
      totalToAnswer: config.mode === "staged" ? config.stages.reduce((total, stage) => total + stage.questionCount * (stage.failureAction === "repeat" ? stage.maxRepeats + 1 : 1) + (stage.failureAction === "support" ? stage.supportQuestionCount : 0), 0) : Math.min(config.questionsPerSession || 10, pool.length),
      correctCount: 0, completed: 0, skillAbilities: storeAbilities({}, runtime),
    }).returning())[0];
    const resumeRuntime = parseStored(session.skillAbilities).stageRuntime;
    const overallExpiry = expiresAt(assignment, session);
    const perStageExpiry = stageExpiresAt(config, resumeRuntime);
    const exp = overallExpiry && perStageExpiry ? new Date(Math.min(+overallExpiry, +perStageExpiry)) : overallExpiry || perStageExpiry;
    if (exp && exp <= new Date()) {
      const sequence = parseSequence(session.questionSequence);
      const abilities = parseAbilities(session.skillAbilities);
      const final = await db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT id FROM adaptive_sessions WHERE id = ${session.id} FOR UPDATE`);
        const [locked] = await tx.select().from(adaptiveSessionsTable).where(eq(adaptiveSessionsTable.id, session.id)).limit(1);
        if (!locked) throw new Error("الجلسة غير موجودة");
        return finishSession(tx, locked, pool, sequence, locked.currentAbility, abilities, locked.correctCount, resumeRuntime, "timeout");
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
    if (session.currentQuestionId && !session.currentQuestionStartedAt) {
      await db.update(adaptiveSessionsTable)
        .set({ currentQuestionStartedAt: new Date() })
        .where(eq(adaptiveSessionsTable.id, session.id));
    }
    const current = pool.find(q => q.id === session.currentQuestionId);
    const neutralProgress = config.mode === "staged" ? { progress: { completedQuestions: session.answeredCount } } : {};
    res.json({ sessionId: session.id, totalQuestions: session.totalToAnswer, answeredCount: session.answeredCount, question: current ? sanitizeQuestion(current) : null, showImmediateFeedback: config.showImmediateFeedback, showAnswersAfterResult: config.showAnswersAfterResult, allowRetry: config.allowRetry, examExpiresAt: exp?.toISOString() || null, ...(stageExpiresAt(config, resumeRuntime) ? { stageExpiresAt: stageExpiresAt(config, resumeRuntime)!.toISOString() } : {}), ...neutralProgress, ...(config.showStageNames && resumeRuntime ? { stageName: config.stages[resumeRuntime.stageIndex]?.name || null } : {}) });
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
      const sequence = parseSequence(session.questionSequence);
      const stored = parseStored(session.skillAbilities), abilities = stored.abilities;
      let runtime = stored.stageRuntime;
      const expired = expiresAt(assignment, session);
      const stageExpired = stageExpiresAt(config, runtime);
      if (session.completed || (expired && expired <= new Date()) || (stageExpired && stageExpired <= new Date())) {
        const final = session.completed ? { submissionId: session.submissionId, score: null, earnedPoints: null, totalPoints: null } : await finishSession(tx, session, pool, sequence, session.currentAbility, abilities, session.correctCount, runtime, "timeout");
        return { status: 200, body: { done: true, timedOut: !session.completed, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, ...final, ...(resultsAvailable(assignment) ? { resultAvailable: true, showAnswersAfterResult: config.showAnswersAfterResult } : deniedResult()) } };
      }
      if (session.currentQuestionId !== questionId || sequence.some(a => a.questionId === questionId)) return { status: 400, body: { message: "السؤال المرسل لا يتطابق مع السؤال الحالي" } };
      const question = pool.find((q: any) => q.id === questionId);
      if (!question) return { status: 404, body: { message: "السؤال غير موجود" } };
      const answer = String(selectedAnswer || "").trim().toLowerCase();
      const correct = (question.correctAnswer || "").split("|").map((a: string) => a.trim().toLowerCase()).filter(Boolean).includes(answer);
      const skill = question.skill || "general", difficulty = question.difficulty || 2;
      const answeredAt = new Date();
      const activeStage = config.mode === "staged" && runtime ? config.stages[runtime.stageIndex] : undefined;
      const responseTimeSeconds = session.currentQuestionStartedAt
        ? Math.max(0, Math.round((answeredAt.getTime() - session.currentQuestionStartedAt.getTime()) / 1000))
        : null;
      sequence.push({
        questionId,
        selectedAnswer: selectedAnswer || null,
        isCorrect: correct,
        difficulty,
        skill,
        answeredAt: answeredAt.toISOString(),
        responseTimeSeconds,
        stageId: activeStage?.id || null,
        stageName: activeStage?.name || null,
        stagePhase: runtime?.phase || null,
        stageAttempt: runtime ? runtime.repeats + 1 : null,
      });
      let ability = Math.max(.5, Math.min(3.5, session.currentAbility + (correct ? getDelta(session.answeredCount) : -getDelta(session.answeredCount))));
      const sa = abilities[skill] || (abilities[skill] = { ability: 2, correct: 0, total: 0 });
      sa.ability = Math.max(.5, Math.min(3.5, sa.ability + (correct ? getDelta(sa.total) : -getDelta(sa.total)))); sa.total++; if (correct) sa.correct++;
      const correctCount = session.correctCount + Number(correct);
      if (config.mode !== "staged" && sequence.length >= session.totalToAnswer) {
        const final = await finishSession(tx, session, pool, sequence, ability, abilities, correctCount);
        return { status: 200, body: { done: true, timedOut: false, isCorrect: config.showImmediateFeedback ? correct : undefined, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, ...final, ...(resultsAvailable(assignment) ? { resultAvailable: true, showAnswersAfterResult: config.showAnswersAfterResult } : deniedResult()) } };
      }
      if (config.mode === "staged") {
        runtime ||= initialStageRuntime();
        const stage = config.stages[runtime.stageIndex];
        if (!stage) {
          const final = await finishSession(tx, session, pool, sequence, ability, abilities, correctCount, runtime);
          return { status: 200, body: { done: true, timedOut: false, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, ...final, ...(resultsAvailable(assignment) ? { resultAvailable: true, showAnswersAfterResult: config.showAnswersAfterResult } : deniedResult()) } };
        }
        runtime.stageAnswered++;
        runtime.stageCorrect += Number(correct);
        if (runtime.phase === "support") runtime.supportAnswered++;
        const stageComplete = runtime.phase === "support" ? runtime.supportAnswered >= stage.supportQuestionCount : runtime.stageAnswered >= stage.questionCount;
        if (stageComplete) {
          const transition = nextStageTransition(stage, runtime);
          if (transition === "finish") {
            const final = await finishSession(tx, session, pool, sequence, ability, abilities, correctCount, runtime);
            return { status: 200, body: { done: true, timedOut: false, isCorrect: config.showImmediateFeedback ? correct : undefined, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, ...final, ...(resultsAvailable(assignment) ? { resultAvailable: true, showAnswersAfterResult: config.showAnswersAfterResult } : deniedResult()) } };
          }
          if (transition === "repeat") {
            runtime = { ...runtime, stageStartedAt: new Date().toISOString(), stageAnswered: 0, stageCorrect: 0, repeats: runtime.repeats + 1, phase: "main", supportAnswered: 0 };
          } else if (transition === "support") {
            runtime = { ...runtime, phase: "support", supportAnswered: 0 };
          } else {
            runtime = { ...runtime, stageIndex: runtime.stageIndex + 1, stageStartedAt: new Date().toISOString(), stageAnswered: 0, stageCorrect: 0, repeats: 0, phase: "main", supportAnswered: 0 };
          }
          if (!config.stages[runtime.stageIndex]) {
            const final = await finishSession(tx, session, pool, sequence, ability, abilities, correctCount, runtime);
            return { status: 200, body: { done: true, timedOut: false, isCorrect: config.showImmediateFeedback ? correct : undefined, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, ...final, ...(resultsAvailable(assignment) ? { resultAvailable: true, showAnswersAfterResult: config.showAnswersAfterResult } : deniedResult()) } };
          }
        }
        const next = pickNext(ability, stagePool(pool, config.stages[runtime.stageIndex]), new Set(sequence.map(a => a.questionId)), abilities);
        if (!next) {
          const final = await finishSession(tx, session, pool, sequence, ability, abilities, correctCount, runtime);
          return { status: 200, body: { done: true, timedOut: false, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, ...final, ...(resultsAvailable(assignment) ? { resultAvailable: true, showAnswersAfterResult: config.showAnswersAfterResult } : deniedResult()) } };
        }
        await tx.update(adaptiveSessionsTable).set({ currentAbility: ability, skillAbilities: storeAbilities(abilities, runtime), questionSequence: JSON.stringify(sequence), currentQuestionId: next.id, currentQuestionStartedAt: new Date(), answeredCount: sequence.length, correctCount }).where(eq(adaptiveSessionsTable.id, session.id));
        return { status: 200, body: { done: false, isCorrect: config.showImmediateFeedback ? correct : undefined, answeredCount: sequence.length, totalQuestions: session.totalToAnswer, question: sanitizeQuestion(next), progress: { completedQuestions: sequence.length }, ...(config.showStageNames ? { stageName: config.stages[runtime.stageIndex]?.name || null } : {}) } };
      }
      const next = pickNext(ability, pool, new Set(sequence.map(a => a.questionId)), abilities);
      await tx.update(adaptiveSessionsTable).set({ currentAbility: ability, skillAbilities: storeAbilities(abilities), questionSequence: JSON.stringify(sequence), currentQuestionId: next?.id || null, currentQuestionStartedAt: next ? new Date() : null, answeredCount: sequence.length, correctCount }).where(eq(adaptiveSessionsTable.id, session.id));
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
    res.json({ sessionId: id, studentName: session.studentName, studentClass: session.studentClass, completed: !!session.completed, completionReason: session.completionReason || null, timedOut: session.completionReason === "timeout", lastQuestionId: session.lastQuestionId || null, resultAvailable: true, finalLevel: session.finalLevel, currentAbility: session.currentAbility, answeredCount: session.answeredCount, correctCount: session.correctCount, totalToAnswer: session.totalToAnswer, skillAbilities: teacher ? abilities : undefined, answers, startedAt: session.startedAt.toISOString(), completedAt: session.completedAt?.toISOString() || null });
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
    const assignmentQuestions = await db.select({
      id: questionsTable.id,
      text: questionsTable.text,
      correctAnswer: questionsTable.correctAnswer,
      difficulty: questionsTable.difficulty,
      skill: questionsTable.skill,
    }).from(questionsTable)
      .where(eq(questionsTable.assignmentId, assignmentId))
      .orderBy(asc(questionsTable.id));
    const questionById = new Map(assignmentQuestions.map((question, index) => [
      question.id,
      { ...question, questionNumber: index + 1 },
    ]));
    const config = parseAdaptiveConfig(assignment.adaptiveConfig);
    const allSkills = new Set<string>();
    const students = sessions.map(session => {
      const skillAbilities = parseAbilities(session.skillAbilities);
      const sequence = parseSequence(session.questionSequence);
      Object.keys(skillAbilities).forEach(skill => allSkills.add(skill));
      const path = sequence.map(answer => {
        const question = questionById.get(answer.questionId);
        return {
          questionId: answer.questionId,
          questionNumber: question?.questionNumber || null,
          questionText: question?.text || "",
          selectedAnswer: answer.selectedAnswer,
          correctAnswer: question?.correctAnswer || "",
          isCorrect: answer.isCorrect,
          difficulty: answer.difficulty || question?.difficulty || null,
          skill: answer.skill || question?.skill || "",
          answeredAt: answer.answeredAt || null,
          responseTimeSeconds: answer.responseTimeSeconds ?? null,
          stageId: answer.stageId || null,
          stageName: answer.stageName || null,
          stagePhase: answer.stagePhase || null,
          stageAttempt: answer.stageAttempt || null,
          status: "answered",
        };
      });
      if (
        session.completionReason === "timeout"
        && session.lastQuestionId
        && !sequence.some(answer => answer.questionId === session.lastQuestionId)
      ) {
        const question = questionById.get(session.lastQuestionId);
        const timedOutAt = session.completedAt || new Date();
        const responseTimeSeconds = session.lastQuestionStartedAt
          ? Math.max(0, Math.round((timedOutAt.getTime() - session.lastQuestionStartedAt.getTime()) / 1000))
          : null;
        const stageRuntime = parseStored(session.skillAbilities).stageRuntime;
        const stage = stageRuntime ? config.stages[stageRuntime.stageIndex] : undefined;
        path.push({
          questionId: session.lastQuestionId,
          questionNumber: question?.questionNumber || null,
          questionText: question?.text || "",
          selectedAnswer: null,
          correctAnswer: question?.correctAnswer || "",
          isCorrect: null,
          difficulty: question?.difficulty || null,
          skill: question?.skill || "",
          answeredAt: null,
          responseTimeSeconds,
          stageId: stage?.id || null,
          stageName: stage?.name || null,
          stagePhase: stageRuntime?.phase || null,
          stageAttempt: stageRuntime ? stageRuntime.repeats + 1 : null,
          status: "timed_out",
        });
      }
      const lastQuestion = session.lastQuestionId ? questionById.get(session.lastQuestionId) : null;
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
        stageRuntime: parseStored(session.skillAbilities).stageRuntime,
        completionReason: session.completionReason || "completed",
        timedOut: session.completionReason === "timeout",
        lastQuestionId: session.lastQuestionId,
        lastQuestionNumber: lastQuestion?.questionNumber || null,
        lastQuestionText: lastQuestion?.text || null,
        path,
        durationSeconds: session.completedAt
          ? Math.max(0, Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 1000))
          : null,
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