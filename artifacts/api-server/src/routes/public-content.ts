import { Router, type IRouter } from "express";
import { db, assignmentsTable, teachersTable, platformSettingsTable, questionsTable, videoLessonsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { createGame, addBotPlayers, type GameQuestion, getActiveGamesCount, getGame } from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

async function getPublicVisibility(): Promise<string> {
  const [row] = await db
    .select({ publicVisibility: platformSettingsTable.publicVisibility })
    .from(platformSettingsTable)
    .limit(1);
  return row?.publicVisibility ?? "selective";
}

/* ── GET /public/assignments ─────────────────────────────────
   Returns assignments visible publicly.
   Respects platform-level publicVisibility setting. No auth required. */
router.get("/public/assignments", async (req, res) => {
  try {
    const visibility = await getPublicVisibility();
    if (visibility === "none") return res.json([]);

    const query = db
      .select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        subject: assignmentsTable.subject,
        description: assignmentsTable.description,
        submissionMode: assignmentsTable.submissionMode,
        targetClass: assignmentsTable.targetClass,
        totalPoints: assignmentsTable.totalPoints,
        teacherId: assignmentsTable.teacherId,
        teacherName: teachersTable.name,
        isAdminContent: teachersTable.isAdmin,
        createdAt: assignmentsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.assignment_id = ${assignmentsTable.id})::int`,
      })
      .from(assignmentsTable)
      .leftJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
      .orderBy(sql`${assignmentsTable.createdAt} DESC`)
      .limit(30);

    const rows = visibility === "all"
      ? await query
      : await query.where(eq(assignmentsTable.isShared, true));

    res.json(rows.map(r => ({ ...r, isAdminContent: !!r.isAdminContent })));
  } catch (err) {
    req.log.error(err, "Public assignments error");
    res.status(500).json({ message: "خطأ" });
  }
});


router.get("/public/video-lessons", async (req, res) => {
  try {
    const visibility = await getPublicVisibility();
    if (visibility === "none") return res.json([]);

    const baseQuery = db
      .select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        description: videoLessonsTable.description,
        videoType: videoLessonsTable.videoType,
        targetClass: videoLessonsTable.targetClass,
        teacherId: videoLessonsTable.teacherId,
        teacherName: teachersTable.name,
        createdAt: videoLessonsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM video_questions WHERE video_questions.video_lesson_id = ${videoLessonsTable.id})::int`,
      })
      .from(videoLessonsTable)
      .leftJoin(teachersTable, eq(videoLessonsTable.teacherId, teachersTable.id))
      .orderBy(desc(videoLessonsTable.createdAt))
      .limit(30);

    const rows = visibility === "all"
      ? await baseQuery
      : await baseQuery.where(eq(videoLessonsTable.isShared, true));

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Public video-lessons error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── POST /public/start-wameeth/:assignmentId ────────────────
   Create a live وميض game from a public assignment. No auth required.
   Rate-limited: max 3 games per session.
   Auto-advances questions by timer (autoAdvance=true).
   Returns { pin, title, questionCount } */
router.post("/public/start-wameeth/:assignmentId", async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);
    if (isNaN(assignmentId)) return res.status(400).json({ message: "معرّف غير صالح" });

    const session = req.session as any;
    const isStudentLoggedIn = !!session.studentAccountId;
    if (!isStudentLoggedIn) {
      const guestGameCount = session.guestWameethCount ?? 0;
      if (guestGameCount >= 5) {
        return res.status(429).json({ message: "لقد وصلت للحد الأقصى من الجلسات المجانية. سجّل دخولك للاستمرار." });
      }
      session.guestWameethCount = guestGameCount + 1;
    }

    const visibility = await getPublicVisibility();
    if (visibility === "none") {
      return res.status(404).json({ message: "لا توجد محتوى عام متاح" });
    }

    const [assignment] = await db
      .select({ id: assignmentsTable.id, title: assignmentsTable.title, isShared: assignmentsTable.isShared })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, assignmentId))
      .limit(1);

    if (!assignment) return res.status(404).json({ message: "الواجب غير موجود" });
    if (visibility !== "all" && !assignment.isShared) {
      return res.status(403).json({ message: "هذا الواجب غير متاح للعموم" });
    }

    const dbQuestions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, assignmentId));

    const gameQuestions: GameQuestion[] = dbQuestions
      .filter(q => q.questionType === "mcq" || q.questionType === "true_false" || q.questionType === "fill_blank")
      .map(q => ({
        id: q.id,
        text: q.text,
        questionType: q.questionType as string,
        optionA: q.optionA ?? null,
        optionB: q.optionB ?? null,
        optionC: q.optionC ?? null,
        optionD: q.optionD ?? null,
        correctAnswer: q.correctAnswer ?? "",
        points: q.points ?? 1,
        duration: 20,
        imageUrl: q.imageUrl ?? null,
        readAloud: q.readAloud ?? false,
      }));

    if (gameQuestions.length === 0) {
      return res.status(400).json({ message: "لا توجد أسئلة قابلة للعب في هذا الواجب" });
    }

    const withBots = req.body?.withBots === true;
    const botCount = Math.max(2, Math.min(8, Number(req.body?.botCount) || 4));

    const game = createGame(
      assignmentId,
      assignment.title,
      "guest",
      0,
      gameQuestions,
      20,
      true,
      "solo",
    );

    if (withBots) {
      const liveGame = getGame(game.pin);
      if (liveGame) addBotPlayers(liveGame, botCount);
    }

    startGameFromRest(game.pin);

    res.json({ pin: game.pin, title: assignment.title, questionCount: gameQuestions.length, withBots, botCount: withBots ? botCount : 0 });
  } catch (err) {
    req.log.error(err, "Public start-wameeth error");
    res.status(500).json({ message: "خطأ في بدء اللعبة" });
  }
});

/* ── GET /public/settings ────────────────────────────────────
   Returns non-sensitive platform settings for unauthenticated clients.
   No auth required. */
router.get("/public/settings", async (req, res) => {
  try {
    const [row] = await db
      .select({
        guestLimit: platformSettingsTable.guestLimit,
        primaryColor: platformSettingsTable.primaryColor,
        accentColor: platformSettingsTable.accentColor,
        fontFamily: platformSettingsTable.fontFamily,
        platformName: platformSettingsTable.platformName,
        logoUrl: platformSettingsTable.logoUrl,
        showAdventureGamesHome: platformSettingsTable.showAdventureGamesHome,
        showSpaceRaceGamesHome: platformSettingsTable.showSpaceRaceGamesHome,
        showFlagsGame: platformSettingsTable.showFlagsGame,
        showColorGame: platformSettingsTable.showColorGame,
        showMemoryGame: platformSettingsTable.showMemoryGame,
        showMultiplyGame: platformSettingsTable.showMultiplyGame,
        showScrambleGame: platformSettingsTable.showScrambleGame,
        showTugGame: platformSettingsTable.showTugGame,
        showCapitalsGame: platformSettingsTable.showCapitalsGame,
      })
      .from(platformSettingsTable)
      .limit(1);
    res.json({
      guestLimit: row?.guestLimit ?? 1,
      primaryColor: row?.primaryColor ?? null,
      accentColor: row?.accentColor ?? null,
      fontFamily: row?.fontFamily ?? null,
      platformName: row?.platformName ?? null,
      logoUrl: row?.logoUrl ?? null,
      showAdventureGamesHome: row?.showAdventureGamesHome ?? false,
      showSpaceRaceGamesHome: row?.showSpaceRaceGamesHome ?? false,
      showFlagsGame: row?.showFlagsGame ?? true,
      showColorGame: row?.showColorGame ?? true,
      showMemoryGame: row?.showMemoryGame ?? true,
      showMultiplyGame: row?.showMultiplyGame ?? true,
      showScrambleGame: row?.showScrambleGame ?? true,
      showTugGame: row?.showTugGame ?? false,
      showCapitalsGame: row?.showCapitalsGame ?? true,
    });
  } catch (err) {
    req.log.error(err, "Public settings error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.get("/public/active-games-count", (_req, res) => {
  res.json({ count: getActiveGamesCount() });
});

/* ── POST /public/ai-generate ────────────────────────────────
   Guest AI question generation — no auth required, max 3 per session */
const GUEST_AI_SESSION_KEY = "guestAiGenerations";
const GUEST_AI_MAX_PER_SESSION = 3;

router.post("/public/ai-generate", async (req, res) => {
  const session = req.session as any;
  const used: number = session[GUEST_AI_SESSION_KEY] ?? 0;

  if (used >= GUEST_AI_MAX_PER_SESSION) {
    res.status(429).json({ message: "وصلت للحد الأقصى من توليد الأسئلة المجاني. سجّل دخولك للاستمرار.", limitReached: true });
    return;
  }

  const { topic, count = 5, difficulty = "medium", subject } = req.body;

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    res.status(400).json({ message: "يجب تحديد موضوع الأسئلة" });
    return;
  }
  if (topic.length > 300) {
    res.status(400).json({ message: "الموضوع طويل جداً (300 حرف كحد أقصى)" });
    return;
  }

  const parsedCount = Math.max(1, Math.min(10, parseInt(count, 10) || 5));
  const diff = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";
  const difficultyText = diff === "easy" ? "سهلة" : diff === "hard" ? "صعبة" : "متوسطة";

  const prompt = `أنت خبير تعليمي. أنشئ ${parsedCount} سؤال اختيار من متعدد باللغة العربية عن:
الموضوع: ${topic.trim()}${subject ? `\nالمادة: ${subject.trim()}` : ""}
الصعوبة: ${difficultyText}

القواعد:
- 4 خيارات (A, B, C, D) لكل سؤال
- إجابة صحيحة واحدة فقط
- وزّع الإجابات الصحيحة عشوائياً بين A وB وC وD
- الخيارات الخاطئة منطقية

أعد JSON فقط بدون أي نص إضافي:
[{"text":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"B"}]`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من توليد الأسئلة. حاول مرة أخرى." });
      return;
    }

    let parsed: any[];
    try { parsed = JSON.parse(jsonMatch[0]); } catch {
      res.status(500).json({ message: "خطأ في تنسيق الإجابة. حاول مرة أخرى." });
      return;
    }

    const questions = parsed
      .filter((q: any) => q && typeof q.text === "string" && q.text.trim())
      .map((q: any) => ({
        text: q.text.trim(),
        optionA: String(q.optionA ?? "").trim(),
        optionB: String(q.optionB ?? "").trim(),
        optionC: String(q.optionC ?? "").trim(),
        optionD: String(q.optionD ?? "").trim(),
        correctAnswer: ["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A",
      }));

    if (questions.length === 0) {
      res.status(500).json({ message: "لم يتم توليد أسئلة. حاول مرة أخرى." });
      return;
    }

    session[GUEST_AI_SESSION_KEY] = used + 1;
    res.json({ questions, remaining: GUEST_AI_MAX_PER_SESSION - (used + 1) });
  } catch (err: any) {
    req.log.error({ err }, "Public AI generation error");
    res.status(500).json({ message: "خطأ في توليد الأسئلة. حاول مرة أخرى." });
  }
});

export default router;
