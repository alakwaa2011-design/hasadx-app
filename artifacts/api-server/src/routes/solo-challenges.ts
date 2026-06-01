import { Router, type IRouter } from "express";
import {
  db,
  assignmentsTable,
  questionsTable,
  soloChallengesTable,
  soloChallengeScoresTable,
} from "@workspace/db";
import { eq, and, desc, sql, isNull, or } from "drizzle-orm";
import {
  createGame,
  type GameQuestion,
} from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";

const router: IRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

function titleToSlug(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "challenge";
}

function arabicToLatinSlug(title: string): string {
  const map: Record<string, string> = {
    'ا':'a','أ':'a','إ':'i','آ':'a','ب':'b','ت':'t','ث':'th','ج':'j',
    'ح':'h','خ':'kh','د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh',
    'ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q',
    'ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w','ي':'y','ى':'a',
    'ة':'a','ء':'','ئ':'y','ؤ':'w','لا':'la',
  };
  let result = '';
  for (const ch of title.trim().toLowerCase()) {
    if (map[ch] !== undefined) result += map[ch];
    else if (/[a-z0-9]/.test(ch)) result += ch;
    else if (/[\s\-_]/.test(ch)) result += '-';
  }
  return result.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'quiz';
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let suffix = 2;
  while (true) {
    const [existing] = await db
      .select({ id: soloChallengesTable.id })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);
    if (!existing) return slug;
    slug = `${base}-${suffix++}`;
  }
}

function requireTeacher(req: any, res: any): number | null {
  const teacherId = req.session?.teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مصرح" }); return null; }
  return teacherId;
}

type SoloQuestion = {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
};

function validateQuestions(raw: unknown): SoloQuestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid: SoloQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const obj = q as Record<string, unknown>;
    if (typeof obj.text !== "string" || !obj.text.trim()) continue;
    if (!["A","B","C","D"].includes(obj.correctAnswer as string)) continue;
    valid.push({
      text: (obj.text as string).trim(),
      optionA: typeof obj.optionA === "string" ? obj.optionA.trim() : "",
      optionB: typeof obj.optionB === "string" ? obj.optionB.trim() : "",
      optionC: typeof obj.optionC === "string" ? obj.optionC.trim() : "",
      optionD: typeof obj.optionD === "string" ? obj.optionD.trim() : "",
      correctAnswer: obj.correctAnswer as "A"|"B"|"C"|"D",
    });
  }
  return valid.length > 0 ? valid : null;
}

function questionsToGameQuestions(qs: SoloQuestion[], duration: number): GameQuestion[] {
  return qs.map((q, i) => ({
    id: -(i + 1),
    text: q.text,
    questionType: "mcq",
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    points: 100,
    duration,
    imageUrl: null,
    readAloud: false,
  }));
}

// ── GET /api/solo-challenges  (teacher: list all their challenges) ──────────
router.get("/solo-challenges", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const rows = await db
      .select({
        id: soloChallengesTable.id,
        slug: soloChallengesTable.slug,
        shortSlug: soloChallengesTable.shortSlug,
        assignmentId: soloChallengesTable.assignmentId,
        assignmentTitle: soloChallengesTable.assignmentTitle,
        notes: soloChallengesTable.notes,
        expiresAt: soloChallengesTable.expiresAt,
        timePerQuestion: soloChallengesTable.timePerQuestion,
        leaderboardDisplay: soloChallengesTable.leaderboardDisplay,
        playCount: soloChallengesTable.playCount,
        createdAt: soloChallengesTable.createdAt,
      })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.teacherId, teacherId))
      .orderBy(desc(soloChallengesTable.createdAt));

    const now = new Date();
    const result = rows.map(r => ({
      ...r,
      isStandalone: r.assignmentId === null,
      isExpired: r.expiresAt ? new Date(r.expiresAt) < now : false,
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err, "List solo challenges error");
    res.status(500).json({ message: "خطأ في جلب المسابقات" });
  }
});

// ── POST /api/solo-challenges  (teacher: create from existing assignment) ───
router.post("/solo-challenges", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const assignmentId = Number(req.body?.assignmentId);
    if (!assignmentId) return res.status(400).json({ message: "معرّف الواجب مطلوب" });

    const [assignment] = await db
      .select({ id: assignmentsTable.id, title: assignmentsTable.title, teacherId: assignmentsTable.teacherId })
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, assignmentId), eq(assignmentsTable.teacherId, teacherId)))
      .limit(1);

    if (!assignment) return res.status(404).json({ message: "الواجب غير موجود أو لا تملكه" });

    // Return existing link if already created
    const [existing] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.assignmentId, assignmentId))
      .limit(1);

    if (existing) {
      if (!existing.shortSlug) {
        const short = `${arabicToLatinSlug(existing.assignmentTitle)}-${randomSuffix()}`;
        try {
          await db.update(soloChallengesTable)
            .set({ shortSlug: short })
            .where(eq(soloChallengesTable.id, existing.id));
          existing.shortSlug = short;
        } catch { /* collision — leave null */ }
      }
      return res.json({ slug: existing.slug, shortSlug: existing.shortSlug ?? null, playCount: existing.playCount, assignmentTitle: existing.assignmentTitle });
    }

    const base = titleToSlug(assignment.title);
    const slug = await uniqueSlug(base);
    const shortSlug = `${arabicToLatinSlug(assignment.title)}-${randomSuffix()}`;

    const [created] = await db
      .insert(soloChallengesTable)
      .values({ slug, shortSlug, assignmentId, teacherId, assignmentTitle: assignment.title })
      .returning();

    res.json({ slug: created.slug, shortSlug: created.shortSlug ?? null, playCount: 0, assignmentTitle: created.assignmentTitle });
  } catch (err) {
    req.log.error(err, "Create solo challenge error");
    res.status(500).json({ message: "خطأ في إنشاء الرابط" });
  }
});

// ── POST /api/solo-challenges/standalone  (teacher: create with inline questions) ──
router.post("/solo-challenges/standalone", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) return res.status(400).json({ message: "عنوان المسابقة مطلوب" });
    if (title.length > 200) return res.status(400).json({ message: "العنوان طويل جداً" });

    const questions = validateQuestions(req.body?.questions);
    if (!questions) return res.status(400).json({ message: "يجب إضافة سؤال واحد على الأقل بإجابة صحيحة" });
    if (questions.length > 100) return res.status(400).json({ message: "الحد الأقصى 100 سؤال" });

    const timePerQuestion = Math.max(5, Math.min(120, Number(req.body?.timePerQuestion) || 20));
    const ld = req.body?.leaderboardDisplay;
    const leaderboardDisplay = ["top3", "top20", "all"].includes(ld) ? ld : "top20";
    const notes = typeof req.body?.notes === "string" ? req.body.notes.slice(0, 1000) || null : null;
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) return res.status(400).json({ message: "تاريخ الانتهاء غير صالح" });

    const base = titleToSlug(title);
    const slug = await uniqueSlug(base);
    const shortSlug = `${arabicToLatinSlug(title)}-${randomSuffix()}`;

    const [created] = await db
      .insert(soloChallengesTable)
      .values({
        slug,
        shortSlug,
        assignmentId: null,
        teacherId,
        assignmentTitle: title,
        questions,
        timePerQuestion,
        leaderboardDisplay,
        notes,
        expiresAt,
      })
      .returning();

    res.json({ slug: created.slug, shortSlug: created.shortSlug ?? null });
  } catch (err) {
    req.log.error(err, "Create standalone solo challenge error");
    res.status(500).json({ message: "خطأ في إنشاء المسابقة" });
  }
});

// ── GET /api/solo-challenges/by-assignment/:assignmentId  (teacher) ─────────
router.get("/solo-challenges/by-assignment/:assignmentId", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const assignmentId = Number(req.params.assignmentId);
    const [row] = await db
      .select()
      .from(soloChallengesTable)
      .where(and(eq(soloChallengesTable.assignmentId, assignmentId), eq(soloChallengesTable.teacherId, teacherId)))
      .limit(1);

    res.json(row ?? null);
  } catch (err) {
    req.log.error(err, "Get solo challenge by assignment error");
    res.status(500).json({ message: "خطأ" });
  }
});

// ── GET /api/solo-challenges/:slug/teacher  (teacher: full challenge data) ──
router.get("/solo-challenges/:slug/teacher", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const [challenge] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "المسابقة غير موجودة" });
    if (challenge.teacherId !== teacherId) return res.status(403).json({ message: "غير مصرح" });

    const now = new Date();
    const isExpired = challenge.expiresAt ? new Date(challenge.expiresAt) < now : false;
    const isStandalone = challenge.assignmentId === null;

    let questionCount = 0;
    if (isStandalone) {
      questionCount = Array.isArray(challenge.questions) ? (challenge.questions as unknown[]).length : 0;
    } else {
      const [cnt] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(questionsTable)
        .where(and(
          eq(questionsTable.assignmentId, challenge.assignmentId!),
          sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
        ));
      questionCount = cnt?.count ?? 0;
    }

    res.json({
      ...challenge,
      isStandalone,
      isExpired,
      questionCount,
    });
  } catch (err) {
    req.log.error(err, "Get teacher solo challenge error");
    res.status(500).json({ message: "خطأ" });
  }
});

// ── GET /api/solo-challenges/:slug/participants  (teacher: all scores) ───────
router.get("/solo-challenges/:slug/participants", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const [challenge] = await db
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "المسابقة غير موجودة" });
    if (challenge.teacherId !== teacherId) return res.status(403).json({ message: "غير مصرح" });

    const rows = await db
      .select({
        id: soloChallengeScoresTable.id,
        playerName: soloChallengeScoresTable.playerName,
        score: soloChallengeScoresTable.score,
        correctCount: soloChallengeScoresTable.correctCount,
        timeTaken: soloChallengeScoresTable.timeTaken,
        playedAt: soloChallengeScoresTable.playedAt,
      })
      .from(soloChallengeScoresTable)
      .where(eq(soloChallengeScoresTable.slug, req.params.slug))
      .orderBy(desc(soloChallengeScoresTable.score), desc(soloChallengeScoresTable.correctCount));

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Get participants error");
    res.status(500).json({ message: "خطأ في جلب المشاركين" });
  }
});

// ── PATCH /api/solo-challenges/:slug/settings  (teacher: update all settings) ──
router.patch("/solo-challenges/:slug/settings", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const [challenge] = await db
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId, assignmentId: soloChallengesTable.assignmentId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "المسابقة غير موجودة" });
    if (challenge.teacherId !== teacherId) return res.status(403).json({ message: "غير مصرح" });

    const update: Record<string, unknown> = {};

    if ("notes" in req.body) {
      update.notes = req.body.notes != null ? String(req.body.notes).slice(0, 1000) || null : null;
    }
    if ("expiresAt" in req.body) {
      if (req.body.expiresAt === null || req.body.expiresAt === "") {
        update.expiresAt = null;
      } else {
        const d = new Date(req.body.expiresAt);
        if (isNaN(d.getTime())) return res.status(400).json({ message: "تاريخ الانتهاء غير صالح" });
        update.expiresAt = d;
      }
    }
    if ("timePerQuestion" in req.body) {
      const t = Number(req.body.timePerQuestion);
      if (!isNaN(t)) update.timePerQuestion = Math.max(5, Math.min(120, t));
    }
    if ("leaderboardDisplay" in req.body) {
      if (["top3", "top20", "all"].includes(req.body.leaderboardDisplay)) {
        update.leaderboardDisplay = req.body.leaderboardDisplay;
      }
    }
    if ("title" in req.body && challenge.assignmentId === null) {
      const t = String(req.body.title || "").trim();
      if (t.length > 0 && t.length <= 200) update.assignmentTitle = t;
    }
    if ("questions" in req.body && challenge.assignmentId === null) {
      const qs = validateQuestions(req.body.questions);
      if (!qs) return res.status(400).json({ message: "يجب وجود سؤال واحد صالح على الأقل" });
      if (qs.length > 100) return res.status(400).json({ message: "الحد الأقصى 100 سؤال" });
      update.questions = qs;
    }

    if (Object.keys(update).length === 0) return res.json({ ok: true });

    await db.update(soloChallengesTable).set(update as any).where(eq(soloChallengesTable.slug, req.params.slug));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Update solo challenge settings error");
    res.status(500).json({ message: "خطأ في حفظ الإعدادات" });
  }
});

// ── DELETE /api/solo-challenges/:slug  (teacher: delete challenge) ──────────
router.delete("/solo-challenges/:slug", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const [challenge] = await db
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "المسابقة غير موجودة" });
    if (challenge.teacherId !== teacherId) return res.status(403).json({ message: "غير مصرح" });

    await db.delete(soloChallengesTable).where(eq(soloChallengesTable.slug, req.params.slug));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Delete solo challenge error");
    res.status(500).json({ message: "خطأ في حذف المسابقة" });
  }
});

// ── GET /api/solo-challenges/:slug  (public: challenge metadata) ─────────────
router.get("/solo-challenges/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [challenge] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

    const now = new Date();
    const isExpired = challenge.expiresAt ? new Date(challenge.expiresAt) < now : false;
    const isStandalone = challenge.assignmentId === null;

    let questionCount = 0;
    if (isStandalone) {
      questionCount = Array.isArray(challenge.questions) ? (challenge.questions as unknown[]).length : 0;
    } else {
      const [cnt] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(questionsTable)
        .where(and(
          eq(questionsTable.assignmentId, challenge.assignmentId!),
          sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
        ));
      questionCount = cnt?.count ?? 0;
    }

    res.json({
      slug: challenge.slug,
      assignmentTitle: challenge.assignmentTitle,
      notes: challenge.notes ?? null,
      expiresAt: challenge.expiresAt ?? null,
      isExpired,
      playCount: challenge.playCount,
      questionCount,
      timePerQuestion: challenge.timePerQuestion ?? 20,
      leaderboardDisplay: challenge.leaderboardDisplay ?? "top20",
    });
  } catch (err) {
    req.log.error(err, "Get solo challenge slug error");
    res.status(500).json({ message: "خطأ" });
  }
});

// ── POST /api/solo-challenges/:slug/start  (public: start game) ─────────────
router.post("/solo-challenges/:slug/start", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [challenge] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

    const now = new Date();
    if (challenge.expiresAt && new Date(challenge.expiresAt) < now) {
      return res.status(403).json({ message: "انتهت مدة هذه المسابقة" });
    }

    const duration = Math.max(5, Math.min(120, challenge.timePerQuestion ?? 20));
    const isStandalone = challenge.assignmentId === null;
    let gameQuestions: GameQuestion[];

    if (isStandalone) {
      const qs = validateQuestions(challenge.questions);
      if (!qs || qs.length === 0) return res.status(400).json({ message: "لا توجد أسئلة في هذه المسابقة" });
      gameQuestions = questionsToGameQuestions(qs, duration);
    } else {
      const dbQuestions = await db
        .select()
        .from(questionsTable)
        .where(eq(questionsTable.assignmentId, challenge.assignmentId!));

      gameQuestions = dbQuestions
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
          points: 100,
          duration,
          imageUrl: q.imageUrl ?? null,
          readAloud: q.readAloud ?? false,
        }));
    }

    if (gameQuestions.length === 0) return res.status(400).json({ message: "لا توجد أسئلة في هذه المسابقة" });

    const game = createGame(
      challenge.assignmentId ?? 0,
      challenge.assignmentTitle,
      "guest",
      0,
      gameQuestions,
      duration,
      true,
      "solo",
    );

    startGameFromRest(game.pin);

    await db
      .update(soloChallengesTable)
      .set({ playCount: sql`${soloChallengesTable.playCount} + 1` })
      .where(eq(soloChallengesTable.slug, slug));

    res.json({
      pin: game.pin,
      title: challenge.assignmentTitle,
      questionCount: gameQuestions.length,
      shortSlug: challenge.shortSlug ?? null,
      leaderboardDisplay: challenge.leaderboardDisplay ?? "top20",
    });
  } catch (err) {
    req.log.error(err, "Solo challenge start error");
    res.status(500).json({ message: "خطأ في بدء اللعبة" });
  }
});

// ── POST /api/solo-challenges/:slug/score  (public: record score) ───────────
router.post("/solo-challenges/:slug/score", async (req, res) => {
  try {
    const slug = req.params.slug;
    const playerName = String(req.body?.playerName || "").trim().slice(0, 60);
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

    await db.insert(soloChallengeScoresTable).values({ slug, playerName, score, correctCount, timeTaken: timeTaken ?? undefined });
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Solo challenge score error");
    res.status(500).json({ message: "خطأ في تسجيل الدرجة" });
  }
});

// ── GET /api/solo-challenges/:slug/leaderboard  (public: top scores) ─────────
router.get("/solo-challenges/:slug/leaderboard", async (req, res) => {
  try {
    const slug = req.params.slug;

    const [challenge] = await db
      .select({ leaderboardDisplay: soloChallengesTable.leaderboardDisplay })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "المسابقة غير موجودة" });

    const display = challenge.leaderboardDisplay ?? "top20";
    const limit = display === "top3" ? 3 : display === "all" ? 1000 : 20;

    const rows = await db
      .select({
        playerName: soloChallengeScoresTable.playerName,
        score: soloChallengeScoresTable.score,
        correctCount: soloChallengeScoresTable.correctCount,
        playedAt: soloChallengeScoresTable.playedAt,
      })
      .from(soloChallengeScoresTable)
      .where(eq(soloChallengeScoresTable.slug, slug))
      .orderBy(desc(soloChallengeScoresTable.score), desc(soloChallengeScoresTable.correctCount))
      .limit(limit);

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Solo challenge leaderboard error");
    res.status(500).json({ message: "خطأ" });
  }
});

// ── PATCH /api/solo-challenges/:slug/notes  (backward compat alias) ──────────
router.patch("/solo-challenges/:slug/notes", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const [challenge] = await db
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });
    if (challenge.teacherId !== teacherId) return res.status(403).json({ message: "غير مصرح" });

    const notes = req.body?.notes != null ? String(req.body.notes).slice(0, 1000) || null : null;
    await db.update(soloChallengesTable).set({ notes }).where(eq(soloChallengesTable.slug, req.params.slug));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Update notes error");
    res.status(500).json({ message: "خطأ" });
  }
});

export default router;
