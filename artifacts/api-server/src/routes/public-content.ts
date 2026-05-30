import { Router, type IRouter } from "express";
import { db, assignmentsTable, teachersTable, platformSettingsTable, questionsTable, videoLessonsTable, soloChallengesTable, soloChallengeScoresTable } from "@workspace/db";
import { eq, and, sql, desc, ne, inArray, or } from "drizzle-orm";
import { createGame, addBotPlayers, type GameQuestion, getActiveGamesCount, getGame } from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateSoloChallengeOgImage } from "../lib/og-image";

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
   Respects platform-level publicVisibility setting. No auth required.

   Query:
   - ?contentKind=competition | ?kind=competition — only مكتبة المسابقات
     rows (content_kind competition or both). Same rule as /assignments/shared.
   - ?contentKind=homework — أنشطة / واجبات فقط (+ both).
   - Omit kind → unchanged legacy behaviour (all kinds still respecting visibility). */
router.get("/public/assignments", async (req, res) => {
  try {
    const visibility = await getPublicVisibility();
    if (visibility === "none") return res.json([]);

    const rawKind =
      typeof req.query.contentKind === "string"
        ? req.query.contentKind
        : typeof req.query.kind === "string"
          ? req.query.kind
          : "";
    const kindFilter =
      rawKind === "competition" || rawKind === "homework" ? rawKind : null;

    const clauses = [
      eq(assignmentsTable.hiddenByAdmin, false),
      ne(assignmentsTable.accessMode, "private"),
    ];
    if (visibility !== "all") {
      clauses.push(eq(assignmentsTable.isShared, true));
    }
    if (kindFilter) {
      clauses.push(inArray(assignmentsTable.contentKind, [kindFilter, "both"]));
    }

    const rows = await db
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
      .where(and(...clauses))
      .orderBy(desc(assignmentsTable.createdAt))
      .limit(30);

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
      .filter(q => q.questionType === "mcq" || q.questionType === "true_false" || q.questionType === "fill_blank" || q.questionType === "dictation")
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
        showQuranSection: platformSettingsTable.showQuranSection,
        showGeneralCertificates: platformSettingsTable.showGeneralCertificates,
        showMaraqui: platformSettingsTable.showMaraqui,
        classroomEnabled: platformSettingsTable.classroomEnabled,
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
      showQuranSection: row?.showQuranSection ?? false,
      showGeneralCertificates: row?.showGeneralCertificates ?? false,
      showMaraqui: row?.showMaraqui ?? false,
      classroomEnabled: row?.classroomEnabled ?? false,
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

// ─── Solo Challenge Public Routes ────────────────────────────────────────────

/* GET /api/solo-challenges/:slug
   Public: returns challenge metadata. */
router.get("/solo-challenges/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [challenge] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

    const questionCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questionsTable)
      .where(and(
        eq(questionsTable.assignmentId, challenge.assignmentId),
        sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
      ))
      .then(r => r[0]?.count ?? 0);

    const now = new Date();
    const isExpired = !!(challenge.expiresAt && challenge.expiresAt < now);

    res.json({
      slug: challenge.slug,
      assignmentTitle: challenge.assignmentTitle,
      notes: challenge.notes ?? null,
      expiresAt: challenge.expiresAt ?? null,
      isExpired,
      playCount: challenge.playCount,
      questionCount,
    });
  } catch (err) {
    console.error("Get solo challenge slug error:", err);
    res.status(500).json({ message: "خطأ" });
  }
});

/* POST /api/solo-challenges/:slug/start
   Public: create a solo Wameeth game session and return its PIN. */
router.post("/solo-challenges/:slug/start", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [challenge] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

    if (challenge.expiresAt && challenge.expiresAt < new Date()) {
      return res.status(410).json({ message: "انتهت مدة هذه المسابقة", isExpired: true });
    }

    const dbQuestions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, challenge.assignmentId));

    const gameQuestions: GameQuestion[] = dbQuestions
      .filter(q => ["mcq", "true_false", "fill_blank", "dictation"].includes(q.questionType))
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
      return res.status(400).json({ message: "لا توجد أسئلة في هذا الواجب" });
    }

    const game = createGame(
      challenge.assignmentId,
      challenge.assignmentTitle,
      "guest",
      0,
      gameQuestions,
      20,
      true,
      "solo" as any,
    );

    startGameFromRest(game.pin);

    await db
      .update(soloChallengesTable)
      .set({ playCount: sql`${soloChallengesTable.playCount} + 1` })
      .where(eq(soloChallengesTable.slug, slug));

    res.json({ pin: game.pin, title: challenge.assignmentTitle, questionCount: gameQuestions.length });
  } catch (err) {
    console.error("Solo challenge start error:", err);
    res.status(500).json({ message: "خطأ في بدء اللعبة" });
  }
});

/* POST /api/solo-challenges/:slug/score
   Public: record a completed game score. */
router.post("/solo-challenges/:slug/score", async (req, res) => {
  try {
    const slug = req.params.slug;
    const playerName = String(req.body?.playerName || "").trim().slice(0, 60);
    // Frontend sends "points" (the Hasad scoring system name); fall back to "score"
    const score = Number(req.body?.points ?? req.body?.score ?? 0);
    const correctCount = Number(req.body?.correctCount ?? 0);
    const timeTaken = req.body?.timeTaken != null ? Number(req.body.timeTaken) : null;

    if (!playerName) return res.status(400).json({ message: "الاسم مطلوب" });

    const [challenge] = await db
      .select({ id: soloChallengesTable.id })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

    await db.insert(soloChallengeScoresTable).values({ slug, playerName, score, correctCount, timeTaken });

    res.json({ ok: true });
  } catch (err) {
    console.error("Solo challenge score error:", err);
    res.status(500).json({ message: "خطأ في تسجيل الدرجة" });
  }
});

/* GET /api/solo-challenges/:slug/leaderboard
   Public: all scores for this challenge, sorted by score DESC then correctCount DESC. */
router.get("/solo-challenges/:slug/leaderboard", async (req, res) => {
  try {
    const slug = req.params.slug;
    const rows = await db
      .select({
        playerName: soloChallengeScoresTable.playerName,
        score: soloChallengeScoresTable.score,
        correctCount: soloChallengeScoresTable.correctCount,
        timeTaken: soloChallengeScoresTable.timeTaken,
        playedAt: soloChallengeScoresTable.playedAt,
      })
      .from(soloChallengeScoresTable)
      .where(eq(soloChallengeScoresTable.slug, slug))
      .orderBy(desc(soloChallengeScoresTable.score), desc(soloChallengeScoresTable.correctCount));

    res.json(rows);
  } catch (err) {
    console.error("Solo challenge leaderboard error:", err);
    res.status(500).json({ message: "خطأ" });
  }
});

/* GET /s/:shortSlug
   Short-form social-share page (e.g. hasadx.com/s/eid-quiz-k4x2).
   Identical purpose to /api/share/solo/:slug — serves full OG HTML and
   bounces real browsers to the play page. Designed for ASCII-clean URLs
   that look good in WhatsApp/Facebook/X link previews. */
router.get("/api/s/:shortSlug", async (req, res) => {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  try {
    const shortSlug = req.params.shortSlug;
    const [challenge] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.shortSlug, shortSlug))
      .limit(1);

    if (!challenge) return res.status(404).type("html").send(`<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<title>الرابط غير موجود — حصاد</title>
<meta http-equiv="refresh" content="3; url=https://hasadx.com/" />
</head><body style="background:#0d2818;color:#e8b84b;font-family:system-ui,sans-serif;text-align:center;padding:60px">
<p>لم يُعثر على هذا التحدي.</p></body></html>`);

    const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "";
    const origin = `${proto}://${host}`;

    const playUrl   = `${origin}/solo/${encodeURIComponent(challenge.slug)}`;
    const ogImageUrl = `${origin}/api/share/solo/${encodeURIComponent(challenge.slug)}/og.png`;
    const shortUrl  = `${origin}/s/${encodeURIComponent(shortSlug)}`;

    const rawTitle   = challenge.assignmentTitle?.trim() || "تحدي حصاد";
    const title      = escapeHtml(rawTitle);
    const description = escapeHtml("🎯 هل تقدر تتغلب عليه؟ جرّب التحدي الآن على حصاد");
    const safePlayUrl  = escapeHtml(playUrl);
    const safeImageUrl = escapeHtml(ogImageUrl);
    const safeShortUrl = escapeHtml(shortUrl);

    res.set("Cache-Control", "public, max-age=300");
    res.type("html").send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="ar_AR" />
<meta property="og:site_name" content="حصاد X" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${safeShortUrl}" />
<meta property="og:image" content="${safeImageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${safeImageUrl}" />
<meta http-equiv="refresh" content="0; url=${safePlayUrl}" />
<link rel="canonical" href="${safeShortUrl}" />
<script>window.location.replace(${JSON.stringify(playUrl)});</script>
</head>
<body style="background:#0d2818;color:#e8b84b;font-family:system-ui,sans-serif;text-align:center;padding:40px">
<p>جارٍ فتح التحدي… <a href="${safePlayUrl}" style="color:#e8b84b">اضغط هنا إذا لم يحدث تلقائياً</a></p>
</body>
</html>`);
  } catch (err) {
    req.log.error({ err }, "Short slug share OG page error");
    res.status(500).type("html").send("<!DOCTYPE html><html><body>Error</body></html>");
  }
});

/* GET /api/share/solo/:slug/og.png
   Generates a 1200×630 branded PNG card for the challenge (used as og:image).
   WhatsApp/Telegram/FB/X crawlers fetch this; cached for 10 minutes. */
router.get("/share/solo/:slug/og.png", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [challenge] = await db
      .select({ title: soloChallengesTable.assignmentTitle, assignmentId: soloChallengesTable.assignmentId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    const title = challenge?.title?.trim() || "تحدي حصاد";
    const questionCount = challenge?.assignmentId
      ? await db
          .select({ count: sql<number>`count(*)::int` })
          .from(questionsTable)
          .where(and(
            eq(questionsTable.assignmentId, challenge.assignmentId),
            sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
          ))
          .then(r => r[0]?.count ?? 0)
      : 0;

    const png = generateSoloChallengeOgImage(title, questionCount);
    res.set("Cache-Control", "public, max-age=600");
    res.type("image/png").send(png);
  } catch (err) {
    req.log.error({ err }, "Solo OG image generation error");
    res.status(500).end();
  }
});

/* GET /api/share/solo/:slug
   Public share page: returns an HTML document with dynamic Open Graph tags
   so that WhatsApp/Telegram/X/Facebook show the challenge title and a branded
   image when the link is unfurled. Browsers visiting this URL are bounced to
   the real play page via meta-refresh + JS. */
router.get("/share/solo/:slug", async (req, res) => {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  try {
    const slug = req.params.slug;
    const [challenge] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
    const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "";
    const origin = `${proto}://${host}`;
    const playUrl = `${origin}/solo/${encodeURIComponent(slug)}`;
    const ogImageUrl = `${origin}/api/share/solo/${encodeURIComponent(slug)}/og.png`;

    const rawTitle = challenge?.assignmentTitle?.trim() || "تحدي حصاد";
    const title = escapeHtml(rawTitle);
    const description = escapeHtml("🎯 هل تقدر تتغلب عليه؟ جرّب التحدي الآن على حصاد");
    const safePlayUrl = escapeHtml(playUrl);
    const safeImageUrl = escapeHtml(ogImageUrl);

    res.set("Cache-Control", "public, max-age=300");
    res.type("html").send(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:locale" content="ar_AR" />
<meta property="og:site_name" content="حصاد X" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${safePlayUrl}" />
<meta property="og:image" content="${safeImageUrl}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${safeImageUrl}" />
<meta http-equiv="refresh" content="0; url=${safePlayUrl}" />
<link rel="canonical" href="${safePlayUrl}" />
<script>window.location.replace(${JSON.stringify(playUrl)});</script>
</head>
<body style="background:#0d2818;color:#e8b84b;font-family:system-ui,sans-serif;text-align:center;padding:40px">
<p>جارٍ فتح التحدي… <a href="${safePlayUrl}" style="color:#e8b84b">اضغط هنا إذا لم يحدث تلقائياً</a></p>
</body>
</html>`);
  } catch (err) {
    req.log.error({ err }, "Solo share OG page error");
    res.status(500).type("html").send("<!DOCTYPE html><html><body>Error</body></html>");
  }
});

export default router;
