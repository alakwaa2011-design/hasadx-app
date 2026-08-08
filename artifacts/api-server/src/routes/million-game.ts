import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { db, assignmentsTable, questionsTable, millionScoresTable, platformSettingsTable, millionBankQuestionsTable } from "@workspace/db";
import { eq, desc, sql, and, notInArray } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { getClassSession } from "../game/million-class-handlers";

const router = Router();

const questionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "طلبات كثيرة جداً، يرجى الانتظار." },
});

const scoresPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "طلبات كثيرة جداً، يرجى الانتظار." },
});

const hintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "تم استنفاد طلبات التلميح لهذه الجلسة." },
});

async function getPublicVisibility(): Promise<string> {
  const [row] = await db
    .select({ publicVisibility: platformSettingsTable.publicVisibility })
    .from(platformSettingsTable)
    .limit(1);
  return row?.publicVisibility ?? "selective";
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

router.get("/million/questions", questionsLimiter, async (req, res) => {
  try {
    const { assignmentId, random } = req.query;
    const visibility = await getPublicVisibility();

    let dbQuestions;
    if (assignmentId && !isNaN(Number(assignmentId))) {
      const aId = Number(assignmentId);
      const [assignment] = await db
        .select({ id: assignmentsTable.id, isShared: assignmentsTable.isShared, teacherId: assignmentsTable.teacherId })
        .from(assignmentsTable).where(eq(assignmentsTable.id, aId)).limit(1);
      if (!assignment) return res.status(404).json({ message: "الواجب غير موجود" });
      const isOwner = req.session.teacherId && req.session.teacherId === assignment.teacherId;
      const isPubliclyVisible = assignment.isShared || visibility === "all";

      if (!isPubliclyVisible && !isOwner) {
        return res.status(403).json({ message: "هذا الواجب غير متاح للعموم" });
      }

      dbQuestions = await db
        .select()
        .from(questionsTable)
        .where(eq(questionsTable.assignmentId, aId));
    } else {
      if (visibility === "none") {
        return res.json({ questions: [], assignmentTitle: "عشوائي" });
      }
      const baseQ = db.select({ q: questionsTable }).from(questionsTable)
        .innerJoin(assignmentsTable, eq(questionsTable.assignmentId, assignmentsTable.id));

      const rows = visibility === "all"
        ? await baseQ.limit(300)
        : await baseQ.where(eq(assignmentsTable.isShared, true)).limit(300);

      dbQuestions = rows.map(r => r.q);
    }

    const VALID_SINGLE_ANSWERS = new Set(["A", "B", "C", "D"]);
    const mcqQuestions = dbQuestions.filter(
      q => q.questionType === "mcq" &&
           !q.allowMultipleAnswers &&
           q.optionA && q.optionB && q.optionC && q.optionD &&
           q.correctAnswer &&
           VALID_SINGLE_ANSWERS.has(q.correctAnswer.trim().toUpperCase())
    );

    if (mcqQuestions.length < 5) {
      return res.status(400).json({ message: "لا توجد أسئلة كافية في هذا الواجب (الحد الأدنى 5 أسئلة)" });
    }

    const shuffled = shuffleArray(pool).slice(0, 15);

    const questions = shuffled.map(mapQuestion);

    let assignmentTitle = "أسئلة عشوائية";
    if (assignmentId && !isNaN(Number(assignmentId))) {
      const [a] = await db
        .select({ title: assignmentsTable.title })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, Number(assignmentId)))
        .limit(1);
      if (a) assignmentTitle = a.title;
    }

    res.json({ questions, assignmentTitle });
  } catch (err) {
    req.log.error(err, "Million questions error");
    res.status(500).json({ message: "خطأ في تحميل الأسئلة" });
  }
});

router.get("/million/scores", async (req, res) => {
  try {
    const scores = await db
      .select()
      .from(millionScoresTable)
      .orderBy(desc(millionScoresTable.score))
      .limit(10);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ message: "خطأ في تحميل النتائج" });
  }
});

router.post("/million/scores", scoresPostLimiter, async (req, res) => {
  try {
    const { playerName, score, level, assignmentTitle, category } = req.body as {
      playerName: string;
      score: number;
      level: number;
      assignmentTitle?: string;
      category?: string;
    };

    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
      return res.status(400).json({ message: "اسم اللاعب مطلوب" });
    }
    if (typeof score !== "number" || score < 0 || score > 1_000_000) {
      return res.status(400).json({ message: "نتيجة غير صحيحة" });
    }
    if (typeof level !== "number" || level < 1 || level > 15) {
      return res.status(400).json({ message: "مستوى غير صحيح" });
    }

    const [row] = await db
      .insert(millionScoresTable)
      .values({
        playerName: playerName.trim().slice(0, 40),
        score: Math.floor(score),
        level: Math.floor(level),
        assignmentTitle: assignmentTitle ? assignmentTitle.slice(0, 100) : null,
        category: category ? category.slice(0, 80) : null,
      })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    req.log.error(err, "Save million score error");
    res.status(500).json({ message: "خطأ في حفظ النتيجة" });
  }
});

router.post("/million/swap-question", questionsLimiter, async (req, res) => {
  try {
    const { usedIds, assignmentId, bankLevel, bankCategory, classPin } = req.body as {
      usedIds?: number[];
      assignmentId?: number;
      bankLevel?: string;
      bankCategory?: string;
      classPin?: string;
    };
    const usedSet = new Set(Array.isArray(usedIds) ? usedIds : []);

    const isBankMode = typeof bankLevel === "string" || typeof bankCategory === "string";

    if (isBankMode) {
      if (typeof bankLevel === "string" && bankLevel !== "" && bankLevel !== "all" && !VALID_BANK_LEVELS.includes(bankLevel as typeof VALID_BANK_LEVELS[number])) {
        return res.status(400).json({ message: `قيمة المستوى غير صالحة: ${bankLevel}` });
      }
      if (typeof bankCategory === "string" && bankCategory !== "" && bankCategory !== "all" && !VALID_BANK_CATEGORIES.includes(bankCategory as typeof VALID_BANK_CATEGORIES[number])) {
        return res.status(400).json({ message: `قيمة التخصص غير صالحة: ${bankCategory}` });
      }
    const levelFilter = typeof level === "string" && VALID_BANK_LEVELS.includes(level as typeof VALID_BANK_LEVELS[number]) ? level : null;
    const categoryFilter = typeof category === "string" && VALID_BANK_CATEGORIES.includes(category as typeof VALID_BANK_CATEGORIES[number]) ? category : null;
    const excludeIds: number[] = typeof excludeIdsParam === "string" && excludeIdsParam !== ""
      ? excludeIdsParam.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)).slice(0, MAX_EXCLUDE)
      : [];
      const allBankQ = await fetchBankQuestions(levelFilter, categoryFilter, excludeIds.length > 0 ? excludeIds : []);
    let pool = await fetchBankQuestions(levelFilter, categoryFilter, excludeIds);

    if (pool.length === 0) {
      return res.status(400).json({ message: "لا توجد أسئلة بديلة متاحة" });
    }

    const q = shuffleArray(pool)[0]!;
      return res.json({
        id: q.id,
        text: q.text,
        questionText: q.text,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        imageUrl: null,
      });
    }

    const visibility = await getPublicVisibility();

    let dbQuestions;
    if (assignmentId && !isNaN(Number(assignmentId))) {
      const aId = Number(assignmentId);
      const [assignment] = await db
        .select({ id: assignmentsTable.id, isShared: assignmentsTable.isShared, teacherId: assignmentsTable.teacherId })
        .from(assignmentsTable).where(eq(assignmentsTable.id, aId)).limit(1);
      if (!assignment) return res.status(404).json({ message: "الواجب غير موجود" });
      const isOwner = req.session.teacherId && req.session.teacherId === assignment.teacherId;
      const isPubliclyVisible = assignment.isShared || visibility === "all";
      // A valid classPin for an active session using this assignment also grants access
      // (students playing via a teacher-hosted class session need to swap from the same pool)
      const classSession = classPin ? getClassSession(classPin) : null;
      const isClassSessionMember = classSession?.questionSource === "assignment" && classSession?.assignmentId === aId;
      if (!isPubliclyVisible && !isOwner && !isClassSessionMember) return res.status(403).json({ message: "غير مصرح" });
      dbQuestions = await db.select().from(questionsTable).where(eq(questionsTable.assignmentId, aId));
    } else {
      if (visibility === "none") return res.status(400).json({ message: "لا توجد أسئلة بديلة" });
      const baseQ = db.select({ q: questionsTable }).from(questionsTable)
        .innerJoin(assignmentsTable, eq(questionsTable.assignmentId, assignmentsTable.id));
      const rows = visibility === "all"
        ? await baseQ.limit(300)
        : await baseQ.where(eq(assignmentsTable.isShared, true)).limit(300);
      dbQuestions = rows.map(r => r.q);
    }

    const VALID = new Set(["A", "B", "C", "D"]);
    let pool = await fetchBankQuestions(levelFilter, categoryFilter, excludeIds);

    if (pool.length === 0) {
      return res.status(400).json({ message: "لا توجد أسئلة بديلة متاحة" });
    }

    const q = shuffleArray(pool)[0]!;
    res.json({
      id: q.id,
      text: q.text,
      optionA: q.optionA!,
      optionB: q.optionB!,
      optionC: q.optionC!,
      optionD: q.optionD!,
      correctAnswer: q.correctAnswer!,
      imageUrl: q.imageUrl ?? null,
    });
  } catch (err) {
    req.log.error(err, "Swap question error");
    res.status(500).json({ message: "خطأ في تبديل السؤال" });
  }
});

router.post("/million/hint", hintLimiter, async (req, res) => {
  try {
    const { questionText, optionA, optionB, optionC, optionD } = req.body as {
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
    };

    if (!questionText || typeof questionText !== "string") {
      return res.status(400).json({ message: "نص السؤال مطلوب" });
    }

    if (!openai) {
      return res.status(503).json({ hint: "خدمة التلميح غير متاحة حالياً." });
    }

    const prompt = `أنت مساعد تعليمي. لديك هذا السؤال وخياراته:

السؤال: ${questionText.slice(0, 300)}
أ) ${(optionA || "").slice(0, 100)}
ب) ${(optionB || "").slice(0, 100)}
ج) ${(optionC || "").slice(0, 100)}
د) ${(optionD || "").slice(0, 100)}

قدّم تلميحاً مفيداً يساعد الطالب على التفكير في الاتجاه الصحيح، دون الكشف عن الإجابة مباشرة. التلميح يجب أن يكون جملة أو جملتين بالعربية.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [{ role: "user", content: prompt }],
      /* reasoning tokens count against this budget — 500 was fully
         consumed by hidden reasoning, returning an empty hint. */
      max_completion_tokens: 2000,
      reasoning_effort: "minimal",
    });

    const hint = completion.choices[0]?.message?.content?.trim() ?? "لا يتوفر تلميح الآن.";
    res.json({ hint });
  } catch (err) {
    req.log.error(err, "Million hint error");
    res.json({ hint: "لا يتوفر تلميح الآن." });
  }
});

const VALID_BANK_LEVELS = ["easy", "medium", "hard"] as const;
const VALID_BANK_CATEGORIES = [
  "culture", "religion", "language", "inventions", "countries", "technology", "science", "geography",
  "history", "sports", "mathematics", "art", "space", "economics", "animals", "food",
  "cinema", "medicine", "plants", "nature", "politics", "energy", "literature",
] as const;

async function fetchBankQuestions(
  levelFilter: string | null,
  categoryFilter: string | null,
  excludeIds: number[],
): Promise<typeof millionBankQuestionsTable.$inferSelect[]> {
  const conditions = [];
  if (levelFilter) conditions.push(eq(millionBankQuestionsTable.level, levelFilter));
  if (categoryFilter) conditions.push(eq(millionBankQuestionsTable.category, categoryFilter));
  if (excludeIds.length > 0) conditions.push(notInArray(millionBankQuestionsTable.id, excludeIds));

  if (conditions.length === 0) {
    return db.select().from(millionBankQuestionsTable);
  }
  return db.select().from(millionBankQuestionsTable).where(and(...conditions));
}

router.get("/million/bank-questions", questionsLimiter, async (req, res) => {
  try {
    const { level, category, excludeIds: excludeIdsParam } = req.query;

    if (typeof level === "string" && level !== "" && level !== "all" && !VALID_BANK_LEVELS.includes(level as typeof VALID_BANK_LEVELS[number])) {
      return res.status(400).json({ message: `قيمة المستوى غير صالحة: ${level}` });
    }
    if (typeof category === "string" && category !== "" && category !== "all" && !VALID_BANK_CATEGORIES.includes(category as typeof VALID_BANK_CATEGORIES[number])) {
      return res.status(400).json({ message: `قيمة التخصص غير صالحة: ${category}` });
    }

    const levelFilter = typeof level === "string" && VALID_BANK_LEVELS.includes(level as typeof VALID_BANK_LEVELS[number]) ? level : null;
    const categoryFilter = typeof category === "string" && VALID_BANK_CATEGORIES.includes(category as typeof VALID_BANK_CATEGORIES[number]) ? category : null;

    // Parse excludeIds — comma-separated list of integer IDs (capped at 800 to avoid huge queries)
    const MAX_EXCLUDE = 800;
    const excludeIds: number[] = typeof excludeIdsParam === "string" && excludeIdsParam !== ""
      ? excludeIdsParam.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)).slice(0, MAX_EXCLUDE)
      : [];

    let historyReset = false;

    function mapQuestion(q: typeof millionBankQuestionsTable.$inferSelect) {
      return {
        id: q.id,
        text: q.text,
        questionText: q.text,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        imageUrl: null as null,
      };
    }

    if (!levelFilter) {
      // Difficulty-ordered mode: 5 easy → 5 medium → 5 hard
      async function fetchLevel(level: string, excl: number[]) {
        let pool = await fetchBankQuestions(level, categoryFilter, excl);
        if (pool.length < 5 && excl.length > 0) { pool = await fetchBankQuestions(level, categoryFilter, []); historyReset = true; }
        if (pool.length < 5 && categoryFilter) { pool = await fetchBankQuestions(level, null, []); historyReset = true; }
        if (pool.length === 0) { pool = await fetchBankQuestions(null, null, []); historyReset = true; }
        return shuffleArray(pool).slice(0, 5);
      }

      const [easy5, med5, hard5] = await Promise.all([
        fetchLevel("easy", excludeIds),
        fetchLevel("medium", excludeIds),
        fetchLevel("hard", excludeIds),
      ]);

      const ordered = [...easy5, ...med5, ...hard5];
      if (ordered.length < 5) {
        return res.status(400).json({ message: "لا توجد أسئلة كافية في البنك، يرجى المحاولة لاحقاً" });
      }
      return res.json({ questions: ordered.map(mapQuestion), assignmentTitle: "بنك الأسئلة", historyReset });
    }

    // Specific level filter requested
    let pool = await fetchBankQuestions(levelFilter, categoryFilter, excludeIds);

    if (pool.length < 15 && excludeIds.length > 0) {
      pool = await fetchBankQuestions(levelFilter, categoryFilter, []);
      historyReset = true;
    }
    if (pool.length < 15 && levelFilter && categoryFilter) {
      pool = await fetchBankQuestions(null, categoryFilter, []);
      historyReset = true;
    }
    if (pool.length < 15 && levelFilter) {
      pool = await fetchBankQuestions(levelFilter, null, []);
      historyReset = true;
    }
    if (pool.length < 15) {
      pool = await fetchBankQuestions(null, null, []);
      historyReset = true;
    }

    if (pool.length < 5) {
      return res.status(400).json({ message: "لا توجد أسئلة كافية في البنك، يرجى المحاولة لاحقاً" });
    }

    const shuffled = shuffleArray(pool).slice(0, 15);
    const questions = shuffled.map(mapQuestion);

    res.json({ questions, assignmentTitle: "بنك الأسئلة", historyReset });
  } catch (err) {
    req.log.error(err, "Million bank questions error");
    res.status(500).json({ message: "خطأ في تحميل أسئلة البنك" });
  }
});

export default router;
