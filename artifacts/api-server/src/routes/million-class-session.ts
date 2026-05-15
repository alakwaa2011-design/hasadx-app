import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { db, assignmentsTable, questionsTable, millionBankQuestionsTable } from "@workspace/db";
import { eq, and, notInArray } from "drizzle-orm";
import { createClassSession, getClassSession, setCachedQuestions } from "../game/million-class-handlers";
import { logActivity } from "../lib/activity-logger";
import { trackEvent } from "../lib/analytics";

const router = Router();

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "طلبات كثيرة جداً" },
});

const questionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "طلبات كثيرة جداً" },
});

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const VALID_BANK_LEVELS = ["easy", "medium", "hard"] as const;
const VALID_BANK_CATEGORIES = [
  "culture", "religion", "language", "inventions", "countries", "technology",
  "science", "geography", "history", "sports", "mathematics", "art", "space",
  "economics", "animals", "food", "cinema", "medicine", "plants", "nature",
  "politics", "energy", "literature",
] as const;

async function fetchBankQs(
  levelFilter: string | null,
  categoryFilter: string | null,
  excludeIds: number[] = [],
): Promise<typeof millionBankQuestionsTable.$inferSelect[]> {
  const conditions = [];
  if (levelFilter) conditions.push(eq(millionBankQuestionsTable.level, levelFilter));
  if (categoryFilter) conditions.push(eq(millionBankQuestionsTable.category, categoryFilter));
  if (excludeIds.length > 0) conditions.push(notInArray(millionBankQuestionsTable.id, excludeIds));
  if (conditions.length === 0) return db.select().from(millionBankQuestionsTable);
  return db.select().from(millionBankQuestionsTable).where(and(...conditions));
}

function mapBankQ(q: typeof millionBankQuestionsTable.$inferSelect) {
  return {
    id: q.id,
    text: q.text,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    imageUrl: null as null,
  };
}

router.post("/million/class-session", createLimiter, async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "يجب تسجيل الدخول كمعلم" });
    }

    logActivity({
      req,
      userId: req.session.teacherId,
      userRole: "teacher",
      action: "start_game",
      details: { gameType: "million" },
    });
    trackEvent({
      req,
      userId: req.session.teacherId,
      userRole: "teacher",
      eventName: "live_game_started",
      eventCategory: "game",
      metadata: { gameType: "million" },
    });

    const { questionSource, assignmentId, bankLevel, bankCategory, autoAdvance, mode, teamAName, teamBName, teamAMembers, teamBMembers, questionCount, pointsScheme, basePoints, targetClass } = req.body as {
      questionSource?: string;
      assignmentId?: number;
      bankLevel?: string;
      bankCategory?: string;
      autoAdvance?: boolean;
      mode?: "individual" | "broadcast" | "team-control";
      teamAName?: string;
      teamBName?: string;
      teamAMembers?: string[];
      teamBMembers?: string[];
      questionCount?: number;
      pointsScheme?: "even" | "progressive" | "stages" | "millionaire-ladder";
      basePoints?: number;
      targetClass?: string;
    };

    const safeMode: "individual" | "broadcast" | "team-control" =
      mode === "broadcast" || mode === "team-control" ? mode : "individual";

    // Game settings — only honored for team-control mode. Other modes keep the
    // legacy 15-question millionaire ladder.
    let safeQuestionCount: number | undefined;
    let safePointsScheme: "even" | "progressive" | "stages" | "millionaire-ladder" | undefined;
    let safeBasePoints: number | undefined;
    if (safeMode === "team-control") {
      const n = Number(questionCount);
      if (!Number.isFinite(n) || n < 5 || n > 50) {
        return res.status(400).json({ message: "عدد الأسئلة يجب أن يكون بين 5 و 50" });
      }
      safeQuestionCount = Math.floor(n);
      const allowed = ["even", "progressive", "stages"] as const;
      if (!allowed.includes(pointsScheme as (typeof allowed)[number])) {
        return res.status(400).json({ message: "نظام النقاط غير صحيح" });
      }
      safePointsScheme = pointsScheme as typeof safePointsScheme;
      const bp = Number(basePoints);
      if (!Number.isFinite(bp) || bp < 1 || bp > 10_000) {
        return res.status(400).json({ message: "النقاط الأساسية يجب أن تكون بين 1 و 10000" });
      }
      safeBasePoints = Math.floor(bp);
    }

    if (safeMode === "team-control") {
      if (!teamAName?.trim() || !teamBName?.trim()) {
        return res.status(400).json({ message: "أسماء الفريقين مطلوبة" });
      }
    }

    const source = questionSource || "bank";

    if (source === "assignment" && assignmentId != null) {
      const [assignment] = await db
        .select({
          id: assignmentsTable.id,
          teacherId: assignmentsTable.teacherId,
          isShared: assignmentsTable.isShared,
          isShareApproved: assignmentsTable.isShareApproved,
        })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, Number(assignmentId)))
        .limit(1);

      if (!assignment) {
        return res.status(404).json({ message: "الواجب غير موجود" });
      }
      const isOwner = assignment.teacherId === req.session.teacherId;
      const isApprovedShared = assignment.isShared && assignment.isShareApproved;
      if (!isOwner && !isApprovedShared) {
        return res.status(403).json({ message: "ليس لديك صلاحية استخدام هذا الواجب" });
      }
    }

    // Trim/dedupe/strip empties WITHOUT capping length, so we can validate the
    // raw count against the spec (1..20) and reject oversized payloads.
    const cleanMembers = (arr?: string[]): string[] => {
      if (!Array.isArray(arr)) return [];
      return arr.map(s => String(s || "").trim().slice(0, 40)).filter(Boolean);
    };
    const sanitizeMembers = (arr?: string[]): string[] | undefined => {
      const cleaned = cleanMembers(arr);
      return cleaned.length > 0 ? cleaned.slice(0, 20) : undefined;
    };

    if (safeMode === "team-control") {
      const a = cleanMembers(teamAMembers);
      const b = cleanMembers(teamBMembers);
      // Spec: each team must have between 1 and 20 members. Validate raw
      // counts (no .slice) so > 20 returns 400 instead of being silently
      // truncated.
      if (a.length < 1 || b.length < 1) {
        return res.status(400).json({ message: "كل فريق يجب أن يحتوي على لاعب واحد على الأقل" });
      }
      if (a.length > 20 || b.length > 20) {
        return res.status(400).json({ message: "الحد الأقصى 20 لاعبًا لكل فريق" });
      }
    }

    const result = await createClassSession({
      hostId: req.session.teacherId,
      questionSource: source,
      assignmentId: source === "assignment" ? Number(assignmentId) : undefined,
      bankLevel,
      bankCategory,
      autoAdvance: autoAdvance !== false, // default true
      mode: safeMode,
      teamAName: teamAName?.trim().slice(0, 30),
      teamBName: teamBName?.trim().slice(0, 30),
      teamAMembers: sanitizeMembers(teamAMembers),
      teamBMembers: sanitizeMembers(teamBMembers),
      questionCount: safeQuestionCount,
      pointsScheme: safePointsScheme,
      basePoints: safeBasePoints,
      targetClass: typeof targetClass === "string" ? targetClass.trim() : undefined,
    });

    res.status(201).json(result);
  } catch (err) {
    req.log.error(err, "Create class session error");
    res.status(500).json({ message: "خطأ في إنشاء الجلسة" });
  }
});

router.get("/million/class-session/:pin", (req, res) => {
  try {
    const { pin: _pin } = req.params; const pin = _pin as string;
    if (!pin || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: "رمز غير صالح" });
    }
    const session = getClassSession(pin);
    if (!session) {
      return res.status(404).json({ message: "الغرفة غير موجودة أو منتهية الصلاحية" });
    }
    // Public probe — never expose cached question payloads (which contain the
    // correct answers) on this unauthenticated route. The full question list
    // is only served from /questions to authenticated/host-validated callers.
    const { cachedQuestions: _omit, ...safe } = session;
    void _omit;
    res.json(safe);
  } catch (err) {
    req.log.error(err, "Get class session error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.get("/million/class-session/:pin/questions", questionsLimiter, async (req, res) => {
  try {
    const { pin: _pin } = req.params; const pin = _pin as string;
    if (!pin || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: "رمز غير صالح" });
    }

    const session = getClassSession(pin);
    if (!session) {
      return res.status(404).json({ message: "الغرفة غير موجودة أو منتهية الصلاحية" });
    }

    // If questions were already chosen for this session, return the same set
    // for every subsequent caller. This is critical in broadcast/team-control
    // modes — host, players, and spectators must see the identical question
    // sequence, and server-side scoring must validate against it.
    if (session.cachedQuestions && session.cachedQuestions.length > 0) {
      const cached = session.cachedQuestions;
      if (session.questionSource === "assignment" && session.assignmentId) {
        const [a] = await db
          .select({ id: assignmentsTable.id, title: assignmentsTable.title })
          .from(assignmentsTable)
          .where(eq(assignmentsTable.id, session.assignmentId))
          .limit(1);
        return res.json({
          questions: cached,
          assignmentTitle: a?.title ?? "الواجب",
          questionSource: "assignment",
          assignmentId: session.assignmentId,
        });
      }
      return res.json({
        questions: cached,
        assignmentTitle: "بنك الأسئلة",
        questionSource: "bank",
        bankLevel: session.bankLevel,
        bankCategory: session.bankCategory,
      });
    }

    const VALID_SINGLE = new Set(["A", "B", "C", "D"]);

    if (session.questionSource === "assignment" && session.assignmentId) {
      const aId = session.assignmentId;

      const [assignment] = await db
        .select({ id: assignmentsTable.id, title: assignmentsTable.title })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, aId))
        .limit(1);

      if (!assignment) {
        return res.status(404).json({ message: "الواجب غير موجود" });
      }

      const dbQuestions = await db
        .select()
        .from(questionsTable)
        .where(eq(questionsTable.assignmentId, aId));

      const mcqQuestions = dbQuestions.filter(
        q => q.questionType === "mcq" &&
             !q.allowMultipleAnswers &&
             q.optionA && q.optionB && q.optionC && q.optionD &&
             q.correctAnswer && VALID_SINGLE.has(q.correctAnswer.trim().toUpperCase()),
      );

      if (mcqQuestions.length < 5) {
        return res.status(400).json({ message: "لا توجد أسئلة كافية في هذا الواجب (الحد الأدنى 5 أسئلة)" });
      }

      const targetCount = session.questionCount ?? 15;
      const selected = shuffleArray(mcqQuestions).slice(0, targetCount);
      const payload = selected.map(q => ({
        id: q.id,
        text: q.text,
        optionA: q.optionA!,
        optionB: q.optionB!,
        optionC: q.optionC!,
        optionD: q.optionD!,
        correctAnswer: q.correctAnswer!,
        imageUrl: q.imageUrl ?? null,
      }));
      setCachedQuestions(pin, payload);
      return res.json({
        questions: payload,
        assignmentTitle: assignment.title,
        questionSource: "assignment",
        assignmentId: aId,
      });
    }

    const levelFilter = session.bankLevel && VALID_BANK_LEVELS.includes(session.bankLevel as typeof VALID_BANK_LEVELS[number])
      ? session.bankLevel
      : null;
    const categoryFilter = session.bankCategory && VALID_BANK_CATEGORIES.includes(session.bankCategory as typeof VALID_BANK_CATEGORIES[number])
      ? session.bankCategory
      : null;

    const targetCount = session.questionCount ?? 15;

    if (!levelFilter) {
      // Distribute target across easy/medium/hard, splitting any remainder
      // evenly so each tier still gets at least one question when possible.
      const perTier = Math.floor(targetCount / 3);
      const remainder = targetCount - perTier * 3;
      const easyCount = perTier + (remainder > 0 ? 1 : 0);
      const medCount = perTier + (remainder > 1 ? 1 : 0);
      const hardCount = perTier;
      async function fetchLvl(lvl: string, count: number) {
        if (count <= 0) return [] as Awaited<ReturnType<typeof fetchBankQs>>;
        let pool = await fetchBankQs(lvl, categoryFilter);
        if (pool.length < count && categoryFilter) pool = await fetchBankQs(lvl, null);
        if (pool.length === 0) pool = await fetchBankQs(null, null);
        return shuffleArray(pool).slice(0, count);
      }
      const [easyPool, medPool, hardPool] = await Promise.all([
        fetchLvl("easy", easyCount), fetchLvl("medium", medCount), fetchLvl("hard", hardCount),
      ]);
      const ordered = [...easyPool, ...medPool, ...hardPool];
      if (ordered.length < 5) {
        return res.status(400).json({ message: "لا توجد أسئلة كافية في البنك" });
      }
      const payload = ordered.map(mapBankQ);
      setCachedQuestions(pin, payload);
      return res.json({ questions: payload, assignmentTitle: "بنك الأسئلة", questionSource: "bank", bankLevel: session.bankLevel, bankCategory: session.bankCategory });
    }

    let pool = await fetchBankQs(levelFilter, categoryFilter);
    if (pool.length < targetCount && categoryFilter) pool = await fetchBankQs(levelFilter, null);
    if (pool.length < targetCount) pool = await fetchBankQs(null, null);
    if (pool.length < 5) {
      return res.status(400).json({ message: "لا توجد أسئلة كافية في البنك" });
    }
    const selected = shuffleArray(pool).slice(0, targetCount);
    const payload = selected.map(mapBankQ);
    setCachedQuestions(pin, payload);
    return res.json({ questions: payload, assignmentTitle: "بنك الأسئلة", questionSource: "bank", bankLevel: session.bankLevel, bankCategory: session.bankCategory });

  } catch (err) {
    req.log.error(err, "Class session questions error");
    res.status(500).json({ message: "خطأ في تحميل الأسئلة" });
  }
});

export default router;
