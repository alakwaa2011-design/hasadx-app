/**
 * Direct Play — رابط لعب مباشر
 *
 * Provides stable, opaque share-links for assignments.
 * Teachers create links (auth required); anyone can play with the link (no auth).
 *
 * Routes:
 *   POST /api/assignments/:id/play-links   — teacher creates/fetches a link for a game type
 *   GET  /api/play/:token/info             — public info for the landing page
 *   POST /api/play/:token/start            — public: create solo game session, return PIN
 *   GET  /api/play/:token/wameeth-class    — public: load split-screen class setup
 *
 * Supported game types: "wameeth" | "wameeth_class" | "rocket_race"
 */
import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { db, assignmentsTable, questionsTable, directPlayLinksTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { createGame, deleteGame, getGame, type GameQuestion } from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";
import {
  createRocketGameDirectly,
  startRocketGameFromRest,
  type RocketQuestion,
} from "../game/rocket-handlers";

const router: IRouter = Router();

// ── Per-link rate limiter for public /start endpoint ─────────────────────────
const startBuckets = new Map<string, number[]>();
const RL_WINDOW_MS = 60 * 1000;
const RL_MAX = 120; // 120 isolated sessions per public link per minute
const DIRECT_JOIN_GRACE_MS = 90 * 1000;

function checkStartRateLimit(linkToken: string): boolean {
  const now = Date.now();
  const prev = (startBuckets.get(linkToken) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  if (prev.length >= RL_MAX) { startBuckets.set(linkToken, prev); return false; }
  prev.push(now);
  startBuckets.set(linkToken, prev);
  return true;
}

function getDbErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const direct = "code" in err ? (err as { code?: unknown }).code : undefined;
  if (typeof direct === "string") return direct;
  const cause = "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  if (cause && typeof cause === "object" && "code" in cause) {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === "string") return nested;
  }
  return undefined;
}

// Cleanup buckets every 5 minutes to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of startBuckets.entries()) {
    const fresh = times.filter((t) => now - t < RL_WINDOW_MS);
    if (fresh.length === 0) startBuckets.delete(ip);
    else startBuckets.set(ip, fresh);
  }
}, 5 * 60 * 1000);

const SUPPORTED_GAME_TYPES = new Set(["wameeth", "wameeth_class", "rocket_race"]);
const QUESTION_TYPES = ["mcq", "true_false", "fill_blank", "dictation"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get assignment and check it belongs to the authenticated teacher. */
async function getTeacherAssignment(assignmentId: number, teacherId: number) {
  const [row] = await db
    .select({ id: assignmentsTable.id, title: assignmentsTable.title, teacherId: assignmentsTable.teacherId })
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, assignmentId))
    .limit(1);
  if (!row) return null;
  if (row.teacherId !== teacherId) return null; // don't reveal it exists
  return row;
}

/** Count playable questions for an assignment. */
async function countPlayableQuestions(assignmentId: number): Promise<number> {
  const [cnt] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questionsTable)
    .where(
      and(
        eq(questionsTable.assignmentId, assignmentId),
        sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
      ),
    );
  return cnt?.count ?? 0;
}

/** Fetch and convert assignment questions to GameQuestion format (wameeth). */
async function loadGameQuestions(assignmentId: number, duration = 20): Promise<GameQuestion[]> {
  const rows = await db
    .select()
    .from(questionsTable)
    .where(
      and(
        eq(questionsTable.assignmentId, assignmentId),
        sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
      ),
    );
  return rows.map((q) => ({
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
    difficulty: q.difficulty ?? null,
  }));
}

type WameethClassQuestion = {
  text: string;
  options: string[];
  correct: number;
  imageUrl: string | null;
};

/** Fetch the option-based questions supported by the local split-screen engine. */
async function loadWameethClassQuestions(assignmentId: number): Promise<WameethClassQuestion[]> {
  const rows = await db
    .select()
    .from(questionsTable)
    .where(
      and(
        eq(questionsTable.assignmentId, assignmentId),
        sql`${questionsTable.questionType} IN ('mcq','true_false')`,
      ),
    );

  return rows.flatMap((q): WameethClassQuestion[] => {
    if (q.questionType === "true_false") {
      const options = ["صح", "خطأ"];
      const correct = q.correctAnswer === "true" || q.correctAnswer === "A" ? 0 : 1;
      return [{ text: q.text, options, correct, imageUrl: q.imageUrl ?? null }];
    }

    const options = [q.optionA, q.optionB, q.optionC, q.optionD]
      .filter((option): option is string => typeof option === "string" && option.trim().length > 0);
    if (options.length < 2) return [];
    return [{
      text: q.text,
      options,
      correct: letterToIndex(q.correctAnswer, options),
      imageUrl: q.imageUrl ?? null,
    }];
  });
}

/** Convert a letter answer to an option index for rocket format. */
function letterToIndex(letter: string | null, options: string[]): number {
  const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  if (letter && letter in map) return map[letter];
  const idx = options.findIndex((o) => o === letter);
  return idx >= 0 ? idx : 0;
}

/** Convert wameeth-style DB questions to RocketQuestion format. */
async function loadRocketQuestions(assignmentId: number, duration = 20): Promise<RocketQuestion[]> {
  const rows = await db
    .select()
    .from(questionsTable)
    .where(
      and(
        eq(questionsTable.assignmentId, assignmentId),
        sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank')`,
      ),
    );

  return rows.map((q) => {
    if (q.questionType === "fill_blank") {
      return {
        text: q.text,
        type: "fill_blank" as const,
        options: [],
        correct: -1,
        correctText: q.correctAnswer ?? "",
        duration,
        imageUrl: q.imageUrl ?? null,
      };
    }
    // mcq / true_false
    const opts = [q.optionA, q.optionB, q.optionC, q.optionD]
      .filter((o): o is string => typeof o === "string" && o.trim().length > 0);
    return {
      text: q.text,
      type: "mcq" as const,
      options: opts,
      correct: letterToIndex(q.correctAnswer, opts),
      duration,
      imageUrl: q.imageUrl ?? null,
    };
  });
}

// ── POST /api/assignments/:id/play-links  (teacher auth required) ────────────
// Creates or retrieves a stable direct-play token for (assignmentId, gameType).
// Idempotent: same assignment + gameType always returns the same token.
router.post("/assignments/:id/play-links", async (req, res) => {
  try {
    const session = (req as any).session as Record<string, unknown> | undefined;
    const teacherId = session?.teacherId as number | undefined;
    if (!teacherId) return res.status(401).json({ message: "يجب تسجيل الدخول" });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) return res.status(400).json({ message: "معرّف غير صالح" });

    const gameType = String(req.body?.gameType || "");
    if (!SUPPORTED_GAME_TYPES.has(gameType)) {
      return res.status(400).json({
        message: `نوع اللعبة غير مدعوم. الأنواع المتاحة: ${[...SUPPORTED_GAME_TYPES].join(", ")}`,
      });
    }

    const assignment = await getTeacherAssignment(id, teacherId);
    if (!assignment) return res.status(404).json({ message: "النشاط غير موجود" });

    const qCount = await countPlayableQuestions(id);
    if (qCount < 1) return res.status(400).json({ message: "لا توجد أسئلة في هذا النشاط" });

    // Return existing token if already created
    const [existing] = await db
      .select({ token: directPlayLinksTable.token })
      .from(directPlayLinksTable)
      .where(
        and(
          eq(directPlayLinksTable.assignmentId, id),
          eq(directPlayLinksTable.gameType, gameType),
          eq(directPlayLinksTable.teacherId, teacherId),
        ),
      )
      .limit(1);

    if (existing) {
      return res.json({ token: existing.token });
    }

    // Create new token
    const token = randomBytes(16).toString("hex"); // 32-char hex
    try {
      await db.insert(directPlayLinksTable).values({
        token,
        assignmentId: id,
        gameType,
        teacherId,
      });
    } catch (err) {
      // A concurrent request may have inserted the same
      // (assignment, gameType, teacher) tuple after our read. Recover by
      // returning that stable token instead of surfacing a spurious 500.
      if (getDbErrorCode(err) !== "23505") throw err;
      const [racedExisting] = await db
        .select({ token: directPlayLinksTable.token })
        .from(directPlayLinksTable)
        .where(
          and(
            eq(directPlayLinksTable.assignmentId, id),
            eq(directPlayLinksTable.gameType, gameType),
            eq(directPlayLinksTable.teacherId, teacherId),
          ),
        )
        .limit(1);
      if (!racedExisting) throw err;
      return res.json({ token: racedExisting.token });
    }

    return res.json({ token });
  } catch (err) {
    req.log.error(err, "play-links create error");
    return res.status(500).json({ message: "خطأ في إنشاء الرابط" });
  }
});

// ── GET /api/play/:token/info  (public, no auth) ─────────────────────────────
// Returns just enough info to render the landing page. Returns 404 for any
// invalid/expired token — no info leakage about the assignment.
router.get("/play/:token/info", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 32 || !/^[0-9a-f]+$/.test(token)) {
      return res.status(404).json({ message: "الرابط غير صالح" });
    }

    const [link] = await db
      .select({
        assignmentId: directPlayLinksTable.assignmentId,
        gameType: directPlayLinksTable.gameType,
        title: assignmentsTable.title,
      })
      .from(directPlayLinksTable)
      .innerJoin(assignmentsTable, eq(directPlayLinksTable.assignmentId, assignmentsTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);

    if (!link) return res.status(404).json({ message: "الرابط غير موجود" });

    const questionCount = await countPlayableQuestions(link.assignmentId);
    if (questionCount < 1) return res.status(404).json({ message: "لا توجد أسئلة في هذا النشاط" });

    return res.json({
      title: link.title,
      questionCount,
      gameType: link.gameType,
    });
  } catch (err) {
    req.log.error(err, "play-info error");
    return res.status(500).json({ message: "خطأ" });
  }
});

// ── GET /api/play/:token/wameeth-class  (public, no auth) ────────────────────
// Returns only the setup required by the split-screen engine. The opaque token
// is the sole public identifier; assignment and teacher IDs are never exposed.
router.get("/play/:token/wameeth-class", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 32 || !/^[0-9a-f]+$/.test(token)) {
      return res.status(404).json({ message: "الرابط غير صالح" });
    }

    const [link] = await db
      .select({
        assignmentId: directPlayLinksTable.assignmentId,
        gameType: directPlayLinksTable.gameType,
        title: assignmentsTable.title,
      })
      .from(directPlayLinksTable)
      .innerJoin(assignmentsTable, eq(directPlayLinksTable.assignmentId, assignmentsTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);

    if (!link || link.gameType !== "wameeth_class") {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }

    const questions = await loadWameethClassQuestions(link.assignmentId);
    if (questions.length < 2) {
      return res.status(404).json({ message: "لا توجد أسئلة كافية لوميض الصف" });
    }

    return res.json({
      title: link.title,
      duration: 20,
      questions,
    });
  } catch (err) {
    req.log.error(err, "wameeth-class setup error");
    return res.status(500).json({ message: "خطأ في تحميل وميض الصف" });
  }
});

// ── POST /api/play/:token/start  (public, rate limited) ─────────────────────
// Creates a fresh solo game session for this visitor and returns the PIN.
// Each call creates a NEW independent session (no shared state between visitors).
router.post("/play/:token/start", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 32 || !/^[0-9a-f]+$/.test(token)) {
      return res.status(404).json({ message: "الرابط غير صالح" });
    }

    const [link] = await db
      .select({
        assignmentId: directPlayLinksTable.assignmentId,
        gameType: directPlayLinksTable.gameType,
        title: assignmentsTable.title,
      })
      .from(directPlayLinksTable)
      .innerJoin(assignmentsTable, eq(directPlayLinksTable.assignmentId, assignmentsTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);

    if (!link) return res.status(404).json({ message: "الرابط غير موجود" });

    // Bound session creation by the verified high-entropy public link itself.
    // This deliberately avoids proxy trust and X-Forwarded-For assumptions.
    if (!checkStartRateLimit(token)) {
      return res.status(429).json({ message: "طلبات كثيرة جداً. الرجاء الانتظار دقيقة." });
    }

    const { assignmentId, gameType, title } = link;

    if (gameType === "wameeth") {
      // ── Wameeth solo game ────────────────────────────────────────────────
      const questions = await loadGameQuestions(assignmentId);
      if (questions.length === 0) {
        return res.status(400).json({ message: "لا توجد أسئلة" });
      }
      const game = createGame(
        assignmentId, title, "guest", 0,
        questions, 20, true, "solo", 2,
        undefined, null, false, null, false,
      );
      game.independentSession = true;
      game.independentControllerToken = randomBytes(32).toString("hex");
      // Each direct link session is a one-player independent game, so it has
      // no valid targets for gifts. This must not affect live individual
      // Wameeth games, which use the same `solo` gameMode.
      game.giftsEnabled = false;
      startGameFromRest(game.pin);
      const joinCleanup = setTimeout(() => {
        const pendingGame = getGame(game.pin);
        if (pendingGame && pendingGame.players.size === 0) {
          deleteGame(game.pin);
        }
      }, DIRECT_JOIN_GRACE_MS);
      joinCleanup.unref?.();
      return res.json({
        pin: game.pin,
        gameType: "wameeth",
        playRoute: `/game/play/${game.pin}`,
        questionCount: questions.length,
        controlToken: game.independentControllerToken,
      });

    } else if (gameType === "rocket_race") {
      // ── Rocket race solo game ─────────────────────────────────────────────
      const rqQuestions = await loadRocketQuestions(assignmentId);
      if (rqQuestions.length === 0) {
        return res.status(400).json({ message: "لا توجد أسئلة مناسبة لسباق الصواريخ" });
      }
      // Shuffle
      for (let i = rqQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rqQuestions[i], rqQuestions[j]] = [rqQuestions[j], rqQuestions[i]];
      }
      const { pin } = createRocketGameDirectly(rqQuestions, { title, totalDurationSecs: 600 });
      startRocketGameFromRest(pin); // game enters countdown → racing; player joins via late-join
      return res.json({
        pin,
        gameType: "rocket_race",
        playRoute: `/game/rocket/play/${pin}`,
        questionCount: rqQuestions.length,
      });

    } else {
      return res.status(400).json({ message: "نوع لعبة غير مدعوم" });
    }
  } catch (err) {
    req.log.error(err, "play-start error");
    return res.status(500).json({ message: "خطأ في بدء اللعبة" });
  }
});

export default router;
