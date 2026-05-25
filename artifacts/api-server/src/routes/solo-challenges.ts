import { Router, type IRouter } from "express";
import {
  db,
  assignmentsTable,
  questionsTable,
  soloChallengesTable,
  soloChallengeScoresTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  createGame,
  type GameQuestion,
} from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";

const router: IRouter = Router();

// Ensure tables exist on first load (idempotent)
(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS solo_challenges (
        id            SERIAL PRIMARY KEY,
        slug          TEXT NOT NULL UNIQUE,
        assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        teacher_id    INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        assignment_title TEXT NOT NULL,
        play_count    INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenges_slug_idx ON solo_challenges(slug)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenges_assignment_idx ON solo_challenges(assignment_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenges_teacher_idx ON solo_challenges(teacher_id)`);
    // Short ASCII slug for clean social-share URLs (added later — idempotent)
    await db.execute(sql`ALTER TABLE solo_challenges ADD COLUMN IF NOT EXISTS short_slug TEXT UNIQUE`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenges_short_slug_idx ON solo_challenges(short_slug)`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS solo_challenge_scores (
        id          SERIAL PRIMARY KEY,
        slug        TEXT NOT NULL,
        player_name TEXT NOT NULL,
        score       INTEGER NOT NULL DEFAULT 0,
        played_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenge_scores_slug_idx ON solo_challenge_scores(slug)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS solo_challenge_scores_score_idx ON solo_challenge_scores(slug, score DESC)`);
  } catch {
    // Tables may already exist — safe to ignore
  }
})();

/** Convert assignment title to a URL-friendly slug (keeps Arabic chars). */
function titleToSlug(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "challenge";
}

/** Transliterate Arabic characters to ASCII-safe equivalents for short slugs. */
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
  return result
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20) || 'quiz';
}

/** 4-character random alphanumeric suffix for short slug uniqueness. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

/** Generate a unique slug (append -2, -3 ... if needed). */
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

/* ── POST /api/solo-challenges ───────────────────────────────
   Teacher creates a permanent solo challenge link for an assignment.
   Returns { slug, url } */
router.post("/api/solo-challenges", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ message: "غير مصرح" });

    const assignmentId = Number(req.body?.assignmentId);
    if (!assignmentId) return res.status(400).json({ message: "معرّف الواجب مطلوب" });

    // Check ownership
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
      // Back-fill shortSlug for challenges created before this feature landed
      if (!existing.shortSlug) {
        const short = `${arabicToLatinSlug(existing.assignmentTitle)}-${randomSuffix()}`;
        try {
          await db.update(soloChallengesTable)
            .set({ shortSlug: short })
            .where(eq(soloChallengesTable.id, existing.id));
          existing.shortSlug = short;
        } catch { /* collision — leave null */ }
      }
      return res.json({
        slug: existing.slug,
        shortSlug: existing.shortSlug ?? null,
        playCount: existing.playCount,
        assignmentTitle: existing.assignmentTitle,
      });
    }

    // Create new slug + short slug
    const base = titleToSlug(assignment.title);
    const slug = await uniqueSlug(base);
    const shortSlug = `${arabicToLatinSlug(assignment.title)}-${randomSuffix()}`;

    const [created] = await db
      .insert(soloChallengesTable)
      .values({ slug, shortSlug, assignmentId, teacherId, assignmentTitle: assignment.title })
      .returning();

    res.json({
      slug: created.slug,
      shortSlug: created.shortSlug ?? null,
      playCount: 0,
      assignmentTitle: created.assignmentTitle,
    });
  } catch (err) {
    req.log.error(err, "Create solo challenge error");
    res.status(500).json({ message: "خطأ في إنشاء الرابط" });
  }
});

/* ── GET /api/solo-challenges/by-assignment/:assignmentId ──
   Returns challenge info for a teacher's assignment (or null if not created yet). */
router.get("/api/solo-challenges/by-assignment/:assignmentId", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ message: "غير مصرح" });

    const assignmentId = Number(req.params.assignmentId);
    const [row] = await db
      .select()
      .from(soloChallengesTable)
      .where(and(eq(soloChallengesTable.assignmentId, assignmentId), eq(soloChallengesTable.teacherId, teacherId)))
      .limit(1);

    res.json(row ?? null);
  } catch (err) {
    req.log.error(err, "Get solo challenge error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── GET /api/solo-challenges/:slug ─────────────────────────
   Public: returns challenge metadata (title, questionCount). */
router.get("/api/solo-challenges/:slug", async (req, res) => {
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

    res.json({
      slug: challenge.slug,
      assignmentTitle: challenge.assignmentTitle,
      playCount: challenge.playCount,
      questionCount,
    });
  } catch (err) {
    req.log.error(err, "Get solo challenge slug error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── POST /api/solo-challenges/:slug/start ───────────────────
   Public: start a solo Wameeth game for this challenge.
   Returns { pin, title, questionCount } */
router.post("/api/solo-challenges/:slug/start", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [challenge] = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

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
        duration: 15,
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
      "solo",
    );

    // Solo challenge: disable ALL point calculations (time bonus, streak
    // multiplier, double-points rounds). Ranking is based purely on the
    // number of correct answers, tracked client-side and POSTed to the
    // leaderboard as the "score" on the results page.
    game.pointsEnabled = false;

    startGameFromRest(game.pin);

    // Increment play count
    await db
      .update(soloChallengesTable)
      .set({ playCount: sql`${soloChallengesTable.playCount} + 1` })
      .where(eq(soloChallengesTable.slug, slug));

    res.json({
      pin: game.pin,
      title: challenge.assignmentTitle,
      questionCount: gameQuestions.length,
      shortSlug: challenge.shortSlug ?? null,
    });
  } catch (err) {
    req.log.error(err, "Solo challenge start error");
    res.status(500).json({ message: "خطأ في بدء اللعبة" });
  }
});

/* ── POST /api/solo-challenges/:slug/score ───────────────────
   Public: record a completed game score. No auth required.
   Body: { playerName, score } */
router.post("/api/solo-challenges/:slug/score", async (req, res) => {
  try {
    const slug = req.params.slug;
    const playerName = String(req.body?.playerName || "").trim().slice(0, 60);
    const score = Number(req.body?.score ?? 0);

    if (!playerName) return res.status(400).json({ message: "الاسم مطلوب" });

    const [challenge] = await db
      .select({ id: soloChallengesTable.id })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

    await db.insert(soloChallengeScoresTable).values({ slug, playerName, score });

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Solo challenge score error");
    res.status(500).json({ message: "خطأ في تسجيل الدرجة" });
  }
});

/* ── GET /api/solo-challenges/:slug/leaderboard ─────────────
   Public: returns top 20 scores for this challenge. */
router.get("/api/solo-challenges/:slug/leaderboard", async (req, res) => {
  try {
    const slug = req.params.slug;
    const rows = await db
      .select({
        playerName: soloChallengeScoresTable.playerName,
        score: soloChallengeScoresTable.score,
        playedAt: soloChallengeScoresTable.playedAt,
      })
      .from(soloChallengeScoresTable)
      .where(eq(soloChallengeScoresTable.slug, slug))
      .orderBy(desc(soloChallengeScoresTable.score))
      .limit(20);

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Solo challenge leaderboard error");
    res.status(500).json({ message: "خطأ" });
  }
});

export default router;
