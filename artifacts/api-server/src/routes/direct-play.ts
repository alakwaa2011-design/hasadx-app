/**
 * Direct Play — رابط لعب مباشر
 *
 * Provides stable, opaque share-links for assignments and wheel templates.
 * Teachers create links (auth required); anyone can open a display link (no auth).
 *
 * Routes:
 *   POST /api/assignments/:id/play-links   — teacher creates/fetches a link for a game type
 *   POST /api/wheel-templates/:id/play-links — teacher creates/fetches a display link
 *   DELETE /api/wheel-templates/:id/play-links — teacher cancels a display link
 *   GET  /api/play/:token/info             — public info for the landing page
 *   GET  /api/play/:token/wheel            — public display setup for Wheel of Challenge
 *   POST /api/play/:token/start            — public: create solo game session, return PIN
 *   GET  /api/play/:token/wameeth-class    — public: load split-screen class setup
 *
 * Supported game types: "wameeth" | "wameeth_class" | "rocket_race" | "wheel"
 */
import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import {
  db,
  assignmentsTable,
  questionsTable,
  directPlayLinksTable,
  wheelTemplatesTable,
  savedGameActivitiesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { createGame, deleteGame, getGame, type GameQuestion } from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";
import {
  createRocketGameDirectly,
  startRocketGameFromRest,
  type RocketQuestion,
} from "../game/rocket-handlers";
import { createXoGameFromRest, sanitizeXoSetup } from "../game/xo-handlers";

const router: IRouter = Router();

// ── Distributed per-link rate limiter for public /start endpoint ─────────────
const RL_WINDOW_SECONDS = 60;
const RL_MAX = 120; // 120 isolated sessions per public link per minute
const DIRECT_JOIN_GRACE_MS = 90 * 1000;

type StartLimitResult = { allowed: boolean; retryAfterSeconds: number };

export async function consumeDirectPlayStart(token: string): Promise<StartLimitResult> {
  const result = await db.execute(sql`
    WITH current AS (
      SELECT id, start_window_started_at, start_count, NOW() AS checked_at
      FROM direct_play_links
      WHERE token = ${token}
      FOR UPDATE
    ),
    updated AS (
      UPDATE direct_play_links AS link
      SET
        start_window_started_at = CASE
          WHEN current.start_window_started_at IS NULL
            OR current.start_window_started_at <= current.checked_at - (${RL_WINDOW_SECONDS} * INTERVAL '1 second')
          THEN current.checked_at
          ELSE current.start_window_started_at
        END,
        start_count = CASE
          WHEN current.start_window_started_at IS NULL
            OR current.start_window_started_at <= current.checked_at - (${RL_WINDOW_SECONDS} * INTERVAL '1 second')
          THEN 1
          WHEN current.start_count < ${RL_MAX} THEN current.start_count + 1
          ELSE current.start_count
        END
      FROM current
      WHERE link.id = current.id
      RETURNING
        current.start_window_started_at IS NULL
          OR current.start_window_started_at <= current.checked_at - (${RL_WINDOW_SECONDS} * INTERVAL '1 second')
          OR current.start_count < ${RL_MAX} AS allowed,
        CASE
          WHEN current.start_window_started_at IS NULL
            OR current.start_window_started_at <= current.checked_at - (${RL_WINDOW_SECONDS} * INTERVAL '1 second')
            OR current.start_count < ${RL_MAX}
          THEN 0
          ELSE GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (
              current.start_window_started_at + (${RL_WINDOW_SECONDS} * INTERVAL '1 second') - current.checked_at
            )))::integer
          )
        END AS retry_after_seconds
    )
    SELECT allowed, retry_after_seconds FROM updated
  `);
  const row = result.rows[0] as { allowed?: unknown; retry_after_seconds?: unknown } | undefined;
  if (!row) throw new Error("Direct-play link disappeared while applying start limit");
  return {
    allowed: row.allowed === true,
    retryAfterSeconds: typeof row.retry_after_seconds === "number"
      ? row.retry_after_seconds
      : Number(row.retry_after_seconds) || 0,
  };
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

function isValidDirectToken(token: string | undefined): token is string {
  return !!token && token.length === 32 && /^[0-9a-f]+$/.test(token);
}

const SUPPORTED_GAME_TYPES = new Set(["wameeth", "wameeth_class", "rocket_race"]);
const WHEEL_GAME_TYPE = "wheel";
const QUESTION_TYPES = ["mcq", "true_false", "fill_blank", "dictation"] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

type DirectPlayAssignment = {
  id: number;
  title: string;
  teacherId: number;
  isShared: boolean;
  hiddenByAdmin: boolean;
  accessMode: string | null;
  archivedAt?: Date | null;
};

/**
 * Shared library activities may be used by a different teacher only for the
 * two Wameeth direct-play flows. Other game types retain owner-only behavior.
 * This mirrors the activity-library visibility rules rather than trusting an
 * activity ID supplied in a URL.
 */
export function canCreateDirectPlayLink(
  assignment: DirectPlayAssignment,
  requestingTeacherId: number,
  gameType: string,
): boolean {
  if (assignment.teacherId === requestingTeacherId) return true;

  return (
    (gameType === "wameeth" || gameType === "wameeth_class")
    && assignment.isShared === true
    && assignment.hiddenByAdmin === false
    && assignment.accessMode !== null
    && assignment.accessMode !== "private"
  );
}

/** Get an activity that the authenticated teacher may use for this game type. */
async function getPlayableAssignment(
  assignmentId: number,
  teacherId: number,
  gameType: string,
) {
  const [row] = await db
    .select({
      id: assignmentsTable.id,
      title: assignmentsTable.title,
      teacherId: assignmentsTable.teacherId,
      isShared: assignmentsTable.isShared,
      hiddenByAdmin: assignmentsTable.hiddenByAdmin,
      accessMode: assignmentsTable.accessMode,
      archivedAt: assignmentsTable.archivedAt,
    })
    .from(assignmentsTable)
    .where(eq(assignmentsTable.id, assignmentId))
    .limit(1);
  if (!row || row.archivedAt || !canCreateDirectPlayLink(row, teacherId, gameType)) return null;
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
    if (q.questionType === "true_false") {
      return {
        text: q.text,
        type: "true_false" as const,
        options: ["صح", "خطأ"],
        correct: q.correctAnswer === "false" || q.correctAnswer === "B" ? 1 : 0,
        duration,
        imageUrl: q.imageUrl ?? null,
      };
    }
    // mcq
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

    const assignment = await getPlayableAssignment(id, teacherId, gameType);
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

// ── Wheel of Challenge display links ─────────────────────────────────────────
// A display link is deliberately owner-only and has no student join path. It
// opens the local teacher-controlled wheel directly; the token is the only
// public identifier and no teacher/template IDs leave this route.
router.post("/wheel-templates/:id/play-links", async (req, res) => {
  try {
    const session = (req as any).session as Record<string, unknown> | undefined;
    const teacherId = session?.teacherId as number | undefined;
    if (!teacherId) return res.status(401).json({ message: "يجب تسجيل الدخول" });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) return res.status(400).json({ message: "معرّف غير صالح" });

    const [template] = await db
      .select({
        id: wheelTemplatesTable.id,
        teacherId: wheelTemplatesTable.teacherId,
        segments: wheelTemplatesTable.segments,
      })
      .from(wheelTemplatesTable)
      .where(eq(wheelTemplatesTable.id, id))
      .limit(1);
    if (!template || template.teacherId !== teacherId) {
      return res.status(404).json({ message: "قالب العجلة غير موجود" });
    }
    if (!Array.isArray(template.segments) || template.segments.length < 2) {
      return res.status(400).json({ message: "يجب أن تحتوي العجلة على قطاعين على الأقل" });
    }

    const [existing] = await db
      .select({ token: directPlayLinksTable.token })
      .from(directPlayLinksTable)
      .where(and(
        eq(directPlayLinksTable.wheelTemplateId, id),
        eq(directPlayLinksTable.gameType, WHEEL_GAME_TYPE),
        eq(directPlayLinksTable.teacherId, teacherId),
      ))
      .limit(1);
    if (existing) return res.json({ token: existing.token });

    const token = randomBytes(16).toString("hex");
    try {
      await db.insert(directPlayLinksTable).values({
        token,
        wheelTemplateId: id,
        gameType: WHEEL_GAME_TYPE,
        teacherId,
      });
    } catch (err) {
      if (getDbErrorCode(err) !== "23505") throw err;
      const [racedExisting] = await db
        .select({ token: directPlayLinksTable.token })
        .from(directPlayLinksTable)
        .where(and(
          eq(directPlayLinksTable.wheelTemplateId, id),
          eq(directPlayLinksTable.gameType, WHEEL_GAME_TYPE),
          eq(directPlayLinksTable.teacherId, teacherId),
        ))
        .limit(1);
      if (!racedExisting) throw err;
      return res.json({ token: racedExisting.token });
    }
    return res.json({ token });
  } catch (err) {
    req.log.error(err, "wheel play-link create error");
    return res.status(500).json({ message: "تعذّر إنشاء رابط العرض" });
  }
});

router.delete("/wheel-templates/:id/play-links", async (req, res) => {
  try {
    const session = (req as any).session as Record<string, unknown> | undefined;
    const teacherId = session?.teacherId as number | undefined;
    if (!teacherId) return res.status(401).json({ message: "يجب تسجيل الدخول" });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) return res.status(400).json({ message: "معرّف غير صالح" });

    const [template] = await db
      .select({ teacherId: wheelTemplatesTable.teacherId })
      .from(wheelTemplatesTable)
      .where(eq(wheelTemplatesTable.id, id))
      .limit(1);
    if (!template || template.teacherId !== teacherId) {
      return res.status(404).json({ message: "قالب العجلة غير موجود" });
    }

    await db.delete(directPlayLinksTable).where(and(
      eq(directPlayLinksTable.wheelTemplateId, id),
      eq(directPlayLinksTable.gameType, WHEEL_GAME_TYPE),
      eq(directPlayLinksTable.teacherId, teacherId),
    ));
    return res.json({ success: true });
  } catch (err) {
    req.log.error(err, "wheel play-link cancel error");
    return res.status(500).json({ message: "تعذّر إلغاء رابط العرض" });
  }
});

// ── GET /api/play/:token/info  (public, no auth) ─────────────────────────────
// Returns just enough info to render the landing page. Returns 404 for any
// invalid/expired token — no info leakage about the assignment.
router.get("/play/:token/info", async (req, res) => {
  try {
    const { token } = req.params;
    if (!isValidDirectToken(token)) {
      return res.status(404).json({ message: "الرابط غير صالح" });
    }

    const [link] = await db
      .select({
        assignmentId: directPlayLinksTable.assignmentId,
        wheelTemplateId: directPlayLinksTable.wheelTemplateId,
        savedGameActivityId: directPlayLinksTable.savedGameActivityId,
        gameType: directPlayLinksTable.gameType,
        assignmentTitle: assignmentsTable.title,
        wheelTitle: wheelTemplatesTable.title,
        wheelSegments: wheelTemplatesTable.segments,
        savedTitle: savedGameActivitiesTable.title,
        savedContent: savedGameActivitiesTable.content,
        savedSettings: savedGameActivitiesTable.settings,
        assignmentArchivedAt: assignmentsTable.archivedAt,
      })
      .from(directPlayLinksTable)
      .leftJoin(assignmentsTable, eq(directPlayLinksTable.assignmentId, assignmentsTable.id))
      .leftJoin(wheelTemplatesTable, eq(directPlayLinksTable.wheelTemplateId, wheelTemplatesTable.id))
      .leftJoin(savedGameActivitiesTable, eq(directPlayLinksTable.savedGameActivityId, savedGameActivitiesTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);

    if (!link) return res.status(404).json({ message: "الرابط غير موجود" });
    if (link.gameType === WHEEL_GAME_TYPE) {
      const questionCount = Array.isArray(link.wheelSegments)
        ? link.wheelSegments.filter((segment) =>
          !!segment && typeof segment === "object" && (segment as { kind?: unknown }).kind === "question",
        ).length
        : 0;
      if (!link.wheelTemplateId || !link.wheelTitle || questionCount < 1) {
        return res.status(404).json({ message: "رابط العجلة لم يعد متاحاً" });
      }
      return res.json({ title: link.wheelTitle, questionCount, gameType: WHEEL_GAME_TYPE });
    }
    if (link.gameType === "xo_class" || link.gameType === "xo_online") {
      if (!link.savedGameActivityId || !link.savedTitle) {
        return res.status(404).json({ message: "الرابط غير موجود" });
      }
      const setup = sanitizeXoSetup(link.savedContent, link.savedSettings);
      if (!setup) return res.status(404).json({ message: "لا توجد أسئلة كافية لإكس أو" });
      return res.json({
        title: link.savedTitle,
        questionCount: setup.questions.length,
        gameType: link.gameType,
      });
    }
    if (!link.assignmentId || !link.assignmentTitle) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }
    if (link.assignmentArchivedAt) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }

    const questionCount = await countPlayableQuestions(link.assignmentId);
    if (questionCount < 1) return res.status(404).json({ message: "لا توجد أسئلة في هذا النشاط" });

    return res.json({
      title: link.assignmentTitle,
      questionCount,
      gameType: link.gameType,
    });
  } catch (err) {
    req.log.error(err, "play-info error");
    return res.status(500).json({ message: "خطأ" });
  }
});

// ── GET /api/play/:token/wheel  (public, no auth) ────────────────────────────
// This returns only the data needed for the classroom display. It intentionally
// omits template and teacher identifiers, ownership and library metadata.
router.get("/play/:token/wheel", async (req, res) => {
  try {
    const { token } = req.params;
    if (!isValidDirectToken(token)) {
      return res.status(404).json({ message: "الرابط غير صالح" });
    }

    const [link] = await db
      .select({
        gameType: directPlayLinksTable.gameType,
        title: wheelTemplatesTable.title,
        language: wheelTemplatesTable.language,
        segments: wheelTemplatesTable.segments,
        config: wheelTemplatesTable.config,
      })
      .from(directPlayLinksTable)
      .innerJoin(wheelTemplatesTable, eq(directPlayLinksTable.wheelTemplateId, wheelTemplatesTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);
    if (
      !link
      || link.gameType !== WHEEL_GAME_TYPE
      || !Array.isArray(link.segments)
      || link.segments.length < 2
    ) {
      return res.status(404).json({ message: "رابط العجلة لم يعد متاحاً" });
    }

    return res.json({
      title: link.title,
      language: link.language,
      segments: link.segments,
      config: link.config,
    });
  } catch (err) {
    req.log.error(err, "wheel direct-play load error");
    return res.status(500).json({ message: "تعذّر تحميل عجلة التحدي" });
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
        savedGameActivityId: directPlayLinksTable.savedGameActivityId,
        gameType: directPlayLinksTable.gameType,
        title: assignmentsTable.title,
        savedTitle: savedGameActivitiesTable.title,
        savedContent: savedGameActivitiesTable.content,
        savedSettings: savedGameActivitiesTable.settings,
        assignmentArchivedAt: assignmentsTable.archivedAt,
      })
      .from(directPlayLinksTable)
      .leftJoin(assignmentsTable, eq(directPlayLinksTable.assignmentId, assignmentsTable.id))
      .leftJoin(savedGameActivitiesTable, eq(directPlayLinksTable.savedGameActivityId, savedGameActivitiesTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);

    if (!link || link.gameType !== "wameeth_class" || link.assignmentId === null) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }
    if (link.assignmentArchivedAt) {
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

// ── GET /api/play/:token/xo-class (public, no auth) ──────────────────────────
// XO classroom links return only the sanitized setup consumed by the local
// classroom engine. The token is the sole public identifier.
router.get("/play/:token/xo-class", async (req, res) => {
  try {
    const { token } = req.params;
    if (!isValidDirectToken(token)) {
      return res.status(404).json({ message: "الرابط غير صالح" });
    }
    const [link] = await db.select({
      gameType: directPlayLinksTable.gameType,
      savedGameActivityId: directPlayLinksTable.savedGameActivityId,
      title: savedGameActivitiesTable.title,
      content: savedGameActivitiesTable.content,
      settings: savedGameActivitiesTable.settings,
    }).from(directPlayLinksTable)
      .innerJoin(savedGameActivitiesTable, eq(directPlayLinksTable.savedGameActivityId, savedGameActivitiesTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);
    if (!link || link.gameType !== "xo_class" || !link.savedGameActivityId) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }
    const setup = sanitizeXoSetup(link.content, link.settings);
    if (!setup) return res.status(404).json({ message: "لا توجد أسئلة كافية لإكس أو" });
    return res.json({
      title: link.title,
      duration: setup.duration,
      teamX: setup.teamX,
      teamO: setup.teamO,
      questions: setup.questions.map((question) => ({
        text: question.text,
        options: [...question.options],
        correct: question.correct,
        ...(question.type ? { type: question.type } : {}),
        imageUrl: question.imageUrl ?? null,
      })),
    });
  } catch (err) {
    req.log.error(err, "xo-class setup error");
    return res.status(500).json({ message: "خطأ في تحميل إعداد إكس أو" });
  }
});

function validTugClassSetup(content: unknown, settings: unknown) {
  const questions = Array.isArray(content)
    ? content
    : content && typeof content === "object" && Array.isArray((content as { questions?: unknown }).questions)
      ? (content as { questions: unknown[] }).questions
      : [];
  const safeQuestions = questions.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const q = value as Record<string, unknown>;
    const text = typeof q.text === "string" ? q.text.trim() : "";
    const options = Array.isArray(q.options)
      ? q.options.filter((option): option is string => typeof option === "string").map((option) => option.trim())
      : [];
    const correct = typeof q.correct === "number" ? q.correct : -1;
    if (!text || options.length < 2 || options.some((option) => !option) || correct < 0 || correct >= options.length) return [];
    return [{ text, options, correct, imageUrl: typeof q.imageUrl === "string" ? q.imageUrl : null }];
  }).slice(0, 20);
  const config = settings && typeof settings === "object" ? settings as Record<string, unknown> : {};
  const duration = typeof config.duration === "number" && [10, 15, 20, 30].includes(config.duration)
    ? config.duration
    : 20;
  const giftEveryCorrect = typeof config.giftEveryCorrect === "number" && [1, 2, 3].includes(config.giftEveryCorrect)
    ? config.giftEveryCorrect
    : 3;
  const freezeDuration = typeof config.freezeDuration === "number" && config.freezeDuration >= 3 && config.freezeDuration <= 10
    ? Math.floor(config.freezeDuration)
    : 5;
  return {
    questions: safeQuestions,
    duration,
    giftsEnabled: config.giftsEnabled !== false,
    giftEveryCorrect,
    freezeDuration,
  };
}

router.get("/play/:token/tug-class", async (req, res) => {
  try {
    const { token } = req.params;
    if (!isValidDirectToken(token)) {
      return res.status(404).json({ message: "الرابط غير صالح" });
    }
    const [link] = await db.select({
      gameType: directPlayLinksTable.gameType,
      title: savedGameActivitiesTable.title,
      content: savedGameActivitiesTable.content,
      settings: savedGameActivitiesTable.settings,
    }).from(directPlayLinksTable)
      .innerJoin(savedGameActivitiesTable, eq(directPlayLinksTable.savedGameActivityId, savedGameActivitiesTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);
    if (!link || link.gameType !== "tug_class") {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }
    const setup = validTugClassSetup(link.content, link.settings);
    if (setup.questions.length < 2) {
      return res.status(404).json({ message: "لا توجد أسئلة كافية لشد الحبل" });
    }
    return res.json({ title: link.title, ...setup });
  } catch (err) {
    req.log.error(err, "tug-class setup error");
    return res.status(500).json({ message: "خطأ في تحميل شد الحبل" });
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
        savedGameActivityId: directPlayLinksTable.savedGameActivityId,
        gameType: directPlayLinksTable.gameType,
        title: assignmentsTable.title,
        savedTitle: savedGameActivitiesTable.title,
        savedContent: savedGameActivitiesTable.content,
        savedSettings: savedGameActivitiesTable.settings,
        assignmentArchivedAt: assignmentsTable.archivedAt,
      })
      .from(directPlayLinksTable)
      .leftJoin(assignmentsTable, eq(directPlayLinksTable.assignmentId, assignmentsTable.id))
      .leftJoin(savedGameActivitiesTable, eq(directPlayLinksTable.savedGameActivityId, savedGameActivitiesTable.id))
      .where(eq(directPlayLinksTable.token, token))
      .limit(1);

    if (!link) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }
    if (link.assignmentId !== null && link.assignmentArchivedAt) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }

    // Bound session creation by the verified high-entropy public link itself.
    // This deliberately avoids proxy trust and X-Forwarded-For assumptions.
    const startLimit = await consumeDirectPlayStart(token);
    if (!startLimit.allowed) {
      res.setHeader("Retry-After", String(startLimit.retryAfterSeconds));
      return res.status(429).json({
        message: `تم إنشاء غرف كثيرة من هذا الرابط. حاول مجدداً بعد ${startLimit.retryAfterSeconds} ثانية.`,
        retryAfterSeconds: startLimit.retryAfterSeconds,
      });
    }

    const { assignmentId, gameType, title } = link;

    if (gameType === "xo_online") {
      if (!link.savedGameActivityId || !link.savedTitle) {
        return res.status(404).json({ message: "الرابط غير موجود" });
      }
      const setup = sanitizeXoSetup(link.savedContent, link.savedSettings);
      if (!setup) return res.status(400).json({ message: "لا توجد أسئلة كافية لإكس أو" });
      const room = createXoGameFromRest({
        questions: setup.questions,
        duration: setup.duration,
        teamX: setup.teamX,
        teamO: setup.teamO,
        title: link.savedTitle,
      });
      return res.json({
        pin: room.pin,
        gameType: "xo_online",
        playRoute: `/game/xo/play/${room.pin}`,
        questionCount: setup.questions.length,
        controlToken: room.controlToken,
      });
    }

    if (assignmentId === null) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }
    if (!title) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }
    const assignmentTitle = title;

    if (gameType === "wameeth") {
      // ── Wameeth solo game ────────────────────────────────────────────────
      const questions = await loadGameQuestions(assignmentId);
      if (questions.length === 0) {
        return res.status(400).json({ message: "لا توجد أسئلة" });
      }
      const game = createGame(
        assignmentId, assignmentTitle, "guest", 0,
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
      const { pin } = createRocketGameDirectly(rqQuestions, { title: assignmentTitle, totalDurationSecs: 600 });
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
