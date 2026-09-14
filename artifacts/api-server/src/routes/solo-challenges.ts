import { Router, type IRouter } from "express";
import { createHmac } from "node:crypto";
import {
  db,
  assignmentsTable,
  questionsTable,
  soloChallengesTable,
  soloChallengeScoresTable,
  soloChallengeAttemptsTable,
  studentsTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql, isNull, or } from "drizzle-orm";
import {
  createGame,
  deleteGame,
  getGame,
  type GameQuestion,
} from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";
import { ObjectStorageService } from "../lib/objectStorage";
import { persistSoloChallengeResult } from "../lib/solo-challenge-results";

const router: IRouter = Router();
const storage = new ObjectStorageService();

function createRosterSelectionToken(slug: string, className: string, studentId: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for roster selection");
  return createHmac("sha256", secret)
    .update(`${slug}\u0000${className}\u0000${studentId}`)
    .digest("base64url");
}

function rosterDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

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

/** Fisher–Yates shuffle — returns a new array, does not mutate the input. */
function shuffleArray<T>(arr: T[]): T[] {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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

const ALLOWED_QUESTION_TYPES = ["mcq", "true_false", "fill_blank"] as const;
type SoloQuestionType = typeof ALLOWED_QUESTION_TYPES[number];

type SoloQuestion = {
  text: string;
  questionType: SoloQuestionType;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** For mcq/true_false: "A"|"B"|"C"|"D". For fill_blank: answer text (alternatives separated by "|"). */
  correctAnswer: string;
  /** 1=easy, 2=medium, 3=hard — matches questions.difficulty column */
  difficulty?: number | null;
  /** Audio source: object-storage path or "yt:VIDEO_ID" */
  audioUrl?: string | null;
};

function validateQuestions(raw: unknown): SoloQuestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid: SoloQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== "object") continue;
    const obj = q as Record<string, unknown>;
    if (typeof obj.text !== "string" || !obj.text.trim()) continue;
    const rawDiff = Number(obj.difficulty);
    const rawType = obj.questionType as string;
    const questionType: SoloQuestionType = ALLOWED_QUESTION_TYPES.includes(rawType as SoloQuestionType)
      ? rawType as SoloQuestionType
      : "mcq";
    const rawAudio = obj.audioUrl;
    const audioUrl: string | null = (typeof rawAudio === "string" && rawAudio.trim()) ? rawAudio.trim() : null;

    if (questionType === "fill_blank") {
      // correctAnswer holds the full pipe-separated accepted-answers string
      const fillText = typeof obj.correctAnswer === "string" ? obj.correctAnswer.trim() : "";
      if (!fillText) continue; // must have at least one accepted answer
      valid.push({
        text: (obj.text as string).trim(),
        questionType: "fill_blank",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: fillText,
        difficulty: [1, 2, 3].includes(rawDiff) ? rawDiff : null,
        audioUrl,
      });
    } else {
      if (!["A","B","C","D"].includes(obj.correctAnswer as string)) continue;
      // For true_false questions auto-fill options so they're never blank
      const isTF = questionType === "true_false";
      valid.push({
        text: (obj.text as string).trim(),
        questionType,
        optionA: isTF ? "صح"  : (typeof obj.optionA === "string" ? obj.optionA.trim() : ""),
        optionB: isTF ? "خطأ" : (typeof obj.optionB === "string" ? obj.optionB.trim() : ""),
        optionC: isTF ? ""    : (typeof obj.optionC === "string" ? obj.optionC.trim() : ""),
        optionD: isTF ? ""    : (typeof obj.optionD === "string" ? obj.optionD.trim() : ""),
        correctAnswer: obj.correctAnswer as "A"|"B"|"C"|"D",
        difficulty: [1, 2, 3].includes(rawDiff) ? rawDiff : null,
        audioUrl,
      });
    }
  }
  return valid.length > 0 ? valid : null;
}

function questionsToGameQuestions(qs: SoloQuestion[], duration: number): GameQuestion[] {
  return qs.map((q, i) => ({
    id: -(i + 1),
    text: q.text,
    questionType: q.questionType,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    points: 100,
    duration,
    imageUrl: null,
    readAloud: false,
    difficulty: q.difficulty ?? null,
  }));
}

// ── Multi-level + distribution helpers ─────────────────────────────────────

interface ChallengeLevel {
  name: string;
  questionCount: number;
  timePerQuestion: number;
}

interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

function validateDifficultyDistribution(raw: unknown): DifficultyDistribution | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const easy   = Math.max(0, Math.floor(Number(obj.easy   ?? 0)));
  const medium = Math.max(0, Math.floor(Number(obj.medium ?? 0)));
  const hard   = Math.max(0, Math.floor(Number(obj.hard   ?? 0)));
  if (easy + medium + hard === 0) return null;
  return { easy, medium, hard };
}

function validateLevels(raw: unknown): ChallengeLevel[] | null {
  if (!Array.isArray(raw)) return null;
  const valid: ChallengeLevel[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim().slice(0, 50) : "";
    const qc = Number(obj.questionCount);
    const tpq = Number(obj.timePerQuestion);
    if (!name) continue;
    if (!Number.isInteger(qc) || qc < 1 || qc > 200) continue;
    if (!Number.isInteger(tpq) || tpq < 5 || tpq > 120) continue;
    valid.push({ name, questionCount: qc, timePerQuestion: tpq });
  }
  if (valid.length === 0 || valid.length > 10) return null;
  return valid;
}

// ── GET /api/solo-challenges  (teacher: list all their challenges) ──────────
router.get("/solo-challenges", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const rows = await db
      .select()
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.teacherId, teacherId))
      .orderBy(desc(soloChallengesTable.createdAt));

    const now = new Date();
    const result = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      shortSlug: c.shortSlug ?? null,
      assignmentId: c.assignmentId,
      assignmentTitle: c.assignmentTitle,
      notes: c.notes ?? null,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      timePerQuestion: c.timePerQuestion ?? null,
      leaderboardDisplay: c.leaderboardDisplay ?? null,
      playCount: c.playCount,
      createdAt: c.createdAt.toISOString(),
      isStandalone: c.assignmentId === null,
      isExpired: c.expiresAt ? c.expiresAt.getTime() < now.getTime() : false,
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
      .select({ id: assignmentsTable.id, title: assignmentsTable.title, teacherId: assignmentsTable.teacherId, archivedAt: assignmentsTable.archivedAt })
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, assignmentId), eq(assignmentsTable.teacherId, teacherId)))
      .limit(1);

    if (!assignment || assignment.archivedAt) return res.status(404).json({ message: "الواجب غير موجود أو لا تملكه" });

    // Return existing link if already created for this assignment
    const [existing] = await db
      .select({
        id: soloChallengesTable.id,
        slug: soloChallengesTable.slug,
        shortSlug: soloChallengesTable.shortSlug,
        playCount: soloChallengesTable.playCount,
        assignmentTitle: soloChallengesTable.assignmentTitle,
      })
      .from(soloChallengesTable)
      .where(and(
        eq(soloChallengesTable.assignmentId, assignmentId),
        eq(soloChallengesTable.teacherId, teacherId),
      ))
      .limit(1);

    if (existing) {
      const update: Record<string, unknown> = {};
      if ("notes" in req.body) update.notes = req.body.notes ? String(req.body.notes).slice(0, 1000) : null;
      if ("expiresAt" in req.body) {
        if (req.body.expiresAt === null || req.body.expiresAt === "") {
          update.expiresAt = null;
        } else {
          const expiresAt = new Date(req.body.expiresAt);
          if (isNaN(expiresAt.getTime())) return res.status(400).json({ message: "تاريخ الانتهاء غير صالح" });
          update.expiresAt = expiresAt;
        }
      }
      if ("timePerQuestion" in req.body) {
        update.timePerQuestion = Math.max(5, Math.min(120, Number(req.body.timePerQuestion) || 20));
      }
      if ("leaderboardDisplay" in req.body && ["top3", "top20", "all"].includes(req.body.leaderboardDisplay)) {
        update.leaderboardDisplay = req.body.leaderboardDisplay;
      }
      if ("questionsPerParticipant" in req.body) {
        update.questionsPerParticipant = req.body.questionsPerParticipant === null || req.body.questionsPerParticipant === ""
          ? null
          : Math.max(1, Number(req.body.questionsPerParticipant) || 1);
      }
      if ("difficultyDistribution" in req.body) {
        const distribution = validateDifficultyDistribution(req.body.difficultyDistribution);
        update.difficultyDistribution = distribution;
        if (distribution) update.questionsPerParticipant = null;
      }
      if ("isMultiLevel" in req.body) update.isMultiLevel = Boolean(req.body.isMultiLevel);
      if ("levels" in req.body) update.levels = req.body.levels === null ? null : validateLevels(req.body.levels);
      if ("allowedClasses" in req.body) {
        const allowedClasses = Array.isArray(req.body.allowedClasses)
          ? req.body.allowedClasses.map((value: unknown) => String(value).trim()).filter(Boolean).slice(0, 50)
          : [];
        update.allowedClasses = allowedClasses.length ? allowedClasses : null;
      }
      if (Object.keys(update).length > 0) {
        await db.update(soloChallengesTable)
          .set(update)
          .where(and(
            eq(soloChallengesTable.id, existing.id),
            eq(soloChallengesTable.teacherId, teacherId),
          ));
      }
      if (!existing.shortSlug) {
        const short = `${arabicToLatinSlug(existing.assignmentTitle ?? "")}-${randomSuffix()}`;
        try {
          await db.update(soloChallengesTable)
            .set({ shortSlug: short })
            .where(eq(soloChallengesTable.id, existing.id));
          existing.shortSlug = short;
        } catch { /* collision — leave null */ }
      }
      return res.json({ slug: existing.slug, shortSlug: existing.shortSlug ?? null, playCount: existing.playCount, assignmentTitle: existing.assignmentTitle });
    }

    const title = assignment.title;
    const slug = `${titleToSlug(title)}-${randomSuffix()}`;
    const shortSlug = `${arabicToLatinSlug(title)}-${randomSuffix()}`;

    // Optional params from body (all have safe defaults)
    const questions = validateQuestions(req.body?.questions) ?? [];
    const timePerQuestion = Math.max(5, Math.min(120, Number(req.body?.timePerQuestion) || 20));
    const ld = req.body?.leaderboardDisplay;
    const leaderboardDisplay = ["top3", "top20", "all"].includes(ld) ? ld : "top20";
    const requestedMaxAttempts = Number(req.body?.maxAttempts);
    const maxAttempts = Number.isInteger(requestedMaxAttempts) && requestedMaxAttempts >= 0 && requestedMaxAttempts <= 10
      ? requestedMaxAttempts
      : 1;
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 1000) : null;
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) {
      return res.status(400).json({ message: "تاريخ الانتهاء غير صالح" });
    }
    const isMultiLevel = Boolean(req.body?.isMultiLevel);
    const levels = req.body?.levels != null ? (validateLevels(req.body.levels) ?? null) : null;
    const difficultyDistribution = validateDifficultyDistribution(req.body?.difficultyDistribution);
    const questionsPerParticipant = req.body?.questionsPerParticipant ? Number(req.body.questionsPerParticipant) || null : null;
    const allowedClasses = Array.isArray(req.body?.allowedClasses)
      ? req.body.allowedClasses.map((value: unknown) => String(value).trim()).filter(Boolean).slice(0, 50)
      : [];

    const [created] = await db
      .insert(soloChallengesTable)
      .values({
        slug,
        shortSlug,
        assignmentId,
        teacherId,
        assignmentTitle: title,
        questions,
        timePerQuestion,
        questionsPerParticipant: difficultyDistribution ? null : questionsPerParticipant,
        leaderboardDisplay,
        maxAttempts,
        notes,
        expiresAt,
        isMultiLevel,
        levels,
        difficultyDistribution,
        allowedClasses: allowedClasses.length ? allowedClasses : null,
      } as any)
      .returning();

    res.json({ slug: created.slug, shortSlug: created.shortSlug ?? null });
  } catch (err) {
    req.log.error(err, "Create standalone solo challenge error");
    res.status(500).json({ message: "خطأ في إنشاء المسابقة" });
  }
});

// ── POST /api/solo-challenges/standalone  (teacher: create with custom questions) ──
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
    let maxAttempts = 1;
    if (req.body?.maxAttempts != null) {
      const ma = Number(req.body.maxAttempts);
      if (!Number.isInteger(ma) || ma < 0 || ma > 10) {
        return res.status(400).json({ message: "عدد المحاولات يجب أن يكون بين 0 و10، والصفر يعني مفتوح" });
      }
      maxAttempts = ma;
    }
    const notes = req.body?.notes != null ? String(req.body.notes).slice(0, 1000) || null : null;
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    if (expiresAt && isNaN(expiresAt.getTime())) return res.status(400).json({ message: "تاريخ الانتهاء غير صالح" });

    let questionsPerParticipant: number | null = null;
    if (req.body?.questionsPerParticipant != null && req.body?.questionsPerParticipant !== "") {
        const n = Number(req.body.questionsPerParticipant);
      if (isNaN(n) || !Number.isInteger(n)) return res.status(400).json({ message: "عدد الأسئلة لكل متسابق غير صالح" });
      if (n < 1 || n > questions.length) return res.status(400).json({ message: "عدد الأسئلة لكل متسابق يجب أن يكون بين 1 وعدد الأسئلة الكلي" });
      questionsPerParticipant = n;
    }

    const isMultiLevel = Boolean(req.body?.isMultiLevel);
    const levels = req.body?.levels != null ? (validateLevels(req.body.levels) ?? null) : null;
    const difficultyDistribution = validateDifficultyDistribution(req.body?.difficultyDistribution);

    const slug = `${titleToSlug(title)}-${randomSuffix()}`;
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
        questionsPerParticipant: difficultyDistribution ? null : questionsPerParticipant,
        leaderboardDisplay,
        maxAttempts,
        notes,
        expiresAt,
        isMultiLevel,
        levels,
        difficultyDistribution,
      } as any)
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
      .select({
        id: soloChallengesTable.id,
        teacherId: soloChallengesTable.teacherId,
        expiresAt: soloChallengesTable.expiresAt,
        assignmentId: soloChallengesTable.assignmentId,
        questions: soloChallengesTable.questions,
        allowedClasses: soloChallengesTable.allowedClasses,
        slug: soloChallengesTable.slug,
        shortSlug: soloChallengesTable.shortSlug,
        assignmentTitle: soloChallengesTable.assignmentTitle,
        notes: soloChallengesTable.notes,
        timePerQuestion: soloChallengesTable.timePerQuestion,
        questionsPerParticipant: soloChallengesTable.questionsPerParticipant,
        leaderboardDisplay: soloChallengesTable.leaderboardDisplay,
        maxAttempts: soloChallengesTable.maxAttempts,
        playCount: soloChallengesTable.playCount,
        createdAt: soloChallengesTable.createdAt,
        isMultiLevel: soloChallengesTable.isMultiLevel,
        levels: soloChallengesTable.levels,
        difficultyDistribution: soloChallengesTable.difficultyDistribution,
      })
      .from(soloChallengesTable)
      .where(and(
        eq(soloChallengesTable.slug, req.params.slug),
        eq(soloChallengesTable.teacherId, teacherId),
      ))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

    const now = new Date();
    const isExpired = challenge.expiresAt ? new Date(challenge.expiresAt) < now : false;
    const isStandalone = challenge.assignmentId === null;

    let questionCount = 0;
    let resolvedQuestions = challenge.questions;
    if (isStandalone) {
      questionCount = Array.isArray(challenge.questions) ? (challenge.questions as unknown[]).length : 0;
    } else {
      const assignmentQuestions = await db
        .select({
          id: questionsTable.id,
          text: questionsTable.text,
          questionType: questionsTable.questionType,
          optionA: questionsTable.optionA,
          optionB: questionsTable.optionB,
          optionC: questionsTable.optionC,
          optionD: questionsTable.optionD,
          correctAnswer: questionsTable.correctAnswer,
          difficulty: questionsTable.difficulty,
          imageUrl: questionsTable.imageUrl,
        })
        .from(questionsTable)
        .where(and(
          eq(questionsTable.assignmentId, challenge.assignmentId!),
          sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
        ));
      resolvedQuestions = assignmentQuestions;
      questionCount = assignmentQuestions.length;
    }

    const allowedClassesList = Array.isArray((challenge as any).allowedClasses)
      ? ((challenge as any).allowedClasses as string[]).filter(c => typeof c === "string" && c.trim())
      : [];

    res.json({
      ...challenge,
      questions: resolvedQuestions,
      isStandalone,
      isExpired,
      questionCount,
      allowedClasses: allowedClassesList,
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
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId, assignmentId: soloChallengesTable.assignmentId, assignmentArchivedAt: assignmentsTable.archivedAt })
      .from(soloChallengesTable)
      .leftJoin(assignmentsTable, eq(soloChallengesTable.assignmentId, assignmentsTable.id))
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
      .orderBy(
        desc(soloChallengeScoresTable.correctCount),
        asc(soloChallengeScoresTable.timeTaken),
        desc(soloChallengeScoresTable.score),
      )
      .limit(500);

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Get participants error");
    res.status(500).json({ message: "خطأ في جلب المشاركين" });
  }
});

// ── DELETE /api/solo-challenges/:slug/participants/:id  (owner teacher) ─────
router.delete("/solo-challenges/:slug/participants/:id", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const scoreId = Number(req.params.id);
    if (!Number.isInteger(scoreId)) return res.status(400).json({ message: "معرّف غير صالح" });

    const [challenge] = await db
      .select({ id: soloChallengesTable.id })
      .from(soloChallengesTable)
      .where(and(
        eq(soloChallengesTable.slug, req.params.slug),
        eq(soloChallengesTable.teacherId, teacherId),
      ))
      .limit(1);
    if (!challenge) return res.status(404).json({ message: "المسابقة غير موجودة" });

    const [existing] = await db
      .select({ id: soloChallengeScoresTable.id })
      .from(soloChallengeScoresTable)
      .where(and(
        eq(soloChallengeScoresTable.id, scoreId),
        eq(soloChallengeScoresTable.slug, req.params.slug),
      ))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "المشارك غير موجود" });

    await db.delete(soloChallengeScoresTable).where(eq(soloChallengeScoresTable.id, scoreId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Delete participant error");
    res.status(500).json({ message: "خطأ في حذف المشارك" });
  }
});

// ── PATCH /api/solo-challenges/:slug/settings  (teacher: update all settings) ──
router.patch("/solo-challenges/:slug/settings", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const [challenge] = await db
      .select({
        id: soloChallengesTable.id,
        teacherId: soloChallengesTable.teacherId,
        assignmentId: soloChallengesTable.assignmentId,
        questions: soloChallengesTable.questions,
      })
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
    if ("maxAttempts" in req.body) {
      const ma = Number(req.body.maxAttempts);
      if (!Number.isInteger(ma) || ma < 0 || ma > 10) {
        return res.status(400).json({ message: "عدد المحاولات يجب أن يكون بين 0 و10، والصفر يعني مفتوح" });
      }
      update.maxAttempts = ma;
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
    if ("questionsPerParticipant" in req.body) {
      if (req.body.questionsPerParticipant === null || req.body.questionsPerParticipant === "") {
        update.questionsPerParticipant = null;
      } else {
        const n = Number(req.body.questionsPerParticipant);
        if (isNaN(n) || !Number.isInteger(n) || n < 1) {
          return res.status(400).json({ message: "عدد الأسئلة لكل متسابق غير صالح" });
        }
        let totalQuestions: number;
        if (challenge.assignmentId === null) {
          totalQuestions = Array.isArray(update.questions)
            ? (update.questions as unknown[]).length
            : (Array.isArray(challenge.questions) ? (challenge.questions as unknown[]).length : 0);
        } else {
      const [cnt] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(questionsTable)
        .where(and(
          eq(questionsTable.assignmentId, challenge.assignmentId!),
          sql`${questionsTable.questionType} IN ('mcq','true_false','fill_blank','dictation')`,
        ));
          totalQuestions = cnt?.count ?? 0;
        }
        if (n > totalQuestions) {
          return res.status(400).json({ message: "عدد الأسئلة لكل متسابق يجب ألا يتجاوز عدد الأسئلة الكلي" });
        }
        update.questionsPerParticipant = n;
      }
    }

    // Multi-level + difficulty distribution settings
    if ("difficultyDistribution" in req.body) {
      const dist = validateDifficultyDistribution(req.body.difficultyDistribution);
      update.difficultyDistribution = dist;
      // When distribution is active, clear questionsPerParticipant unless also being updated
      if (dist && !("questionsPerParticipant" in req.body)) {
        update.questionsPerParticipant = null;
      }
    }
    if ("isMultiLevel" in req.body) {
      update.isMultiLevel = Boolean(req.body.isMultiLevel);
    }
    if ("levels" in req.body) {
      if (req.body.levels === null || (Array.isArray(req.body.levels) && req.body.levels.length === 0)) {
        update.levels = null;
      } else {
        const lv = validateLevels(req.body.levels);
        if (lv !== null) update.levels = lv;
      }
    }
    if ("allowedClasses" in req.body) {
      const ac = req.body.allowedClasses;
      if (!Array.isArray(ac)) {
        return res.status(400).json({ message: "allowedClasses يجب أن يكون مصفوفة" });
      }
      const cleaned = ac.map((c: unknown) => String(c).trim()).filter(c => c.length > 0 && c.length <= 100).slice(0, 50);
      update.allowedClasses = cleaned.length > 0 ? cleaned : null;
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
      .where(and(
        eq(soloChallengesTable.slug, req.params.slug),
        eq(soloChallengesTable.teacherId, teacherId),
      ))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });

    await db.delete(soloChallengesTable).where(eq(soloChallengesTable.id, challenge.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Delete solo challenge error");
    res.status(500).json({ message: "خطأ في حذف المسابقة" });
  }
});

// ── GET /api/solo-challenges/:slug  (public: challenge details) ──────────────
router.get("/solo-challenges/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const [challenge] = await db
      .select({
        id: soloChallengesTable.id,
        teacherId: soloChallengesTable.teacherId,
        expiresAt: soloChallengesTable.expiresAt,
        assignmentId: soloChallengesTable.assignmentId,
        questions: soloChallengesTable.questions,
        questionsPerParticipant: soloChallengesTable.questionsPerParticipant,
        slug: soloChallengesTable.slug,
        assignmentTitle: soloChallengesTable.assignmentTitle,
        notes: soloChallengesTable.notes,
        playCount: soloChallengesTable.playCount,
        timePerQuestion: soloChallengesTable.timePerQuestion,
        leaderboardDisplay: soloChallengesTable.leaderboardDisplay,
        maxAttempts: soloChallengesTable.maxAttempts,
        isMultiLevel: soloChallengesTable.isMultiLevel,
        levels: soloChallengesTable.levels,
        difficultyDistribution: soloChallengesTable.difficultyDistribution,
        allowedClasses: soloChallengesTable.allowedClasses,
        assignmentArchivedAt: assignmentsTable.archivedAt,
      })
      .from(soloChallengesTable)
      .leftJoin(assignmentsTable, eq(soloChallengesTable.assignmentId, assignmentsTable.id))
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });
    if (challenge.assignmentId !== null && challenge.assignmentArchivedAt) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }

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

    const effectiveQuestionCount =
      challenge.questionsPerParticipant != null && challenge.questionsPerParticipant < questionCount
        ? challenge.questionsPerParticipant
        : questionCount;

    const allowedClassesList = Array.isArray((challenge as any).allowedClasses)
      ? ((challenge as any).allowedClasses as string[]).filter(c => typeof c === "string" && c.trim())
      : [];

    res.json({
      slug: challenge.slug,
      assignmentTitle: challenge.assignmentTitle,
      notes: challenge.notes ?? null,
      expiresAt: challenge.expiresAt ?? null,
      isExpired,
      playCount: challenge.playCount,
      questionCount: effectiveQuestionCount,
      totalQuestionCount: questionCount,
      questionsPerParticipant: challenge.questionsPerParticipant ?? null,
      timePerQuestion: challenge.timePerQuestion ?? 20,
      leaderboardDisplay: challenge.leaderboardDisplay ?? "top20",
      maxAttempts: challenge.maxAttempts ?? 1,
      difficulty: null,
      difficultyAffectsPoints: false,
      isMultiLevel: Boolean(challenge.isMultiLevel),
      levels: challenge.levels ?? null,
      allowedClasses: allowedClassesList,
    });
  } catch (err) {
    req.log.error(err, "Get solo challenge slug error");
    res.status(500).json({ message: "خطأ" });
  }
});

// ── GET /api/solo-challenges/:slug/roster  (public: minimal class roster) ───
router.get("/solo-challenges/:slug/roster", async (req, res) => {
  try {
    const className = String(req.query.className || "").trim();
    if (!className) return res.status(400).json({ message: "يجب اختيار الصف" });

    const [challenge] = await db
      .select({
        teacherId: soloChallengesTable.teacherId,
        allowedClasses: soloChallengesTable.allowedClasses,
        expiresAt: soloChallengesTable.expiresAt,
        assignmentId: soloChallengesTable.assignmentId,
        assignmentArchivedAt: assignmentsTable.archivedAt,
      })
      .from(soloChallengesTable)
      .leftJoin(assignmentsTable, eq(soloChallengesTable.assignmentId, assignmentsTable.id))
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge || (challenge.assignmentId !== null && challenge.assignmentArchivedAt)) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }
    if (challenge.expiresAt && new Date(challenge.expiresAt) < new Date()) {
      return res.status(403).json({ message: "انتهت مدة هذه المسابقة" });
    }
    const allowedClasses = Array.isArray(challenge.allowedClasses)
      ? challenge.allowedClasses.filter((value): value is string => typeof value === "string")
      : [];
    if (!allowedClasses.includes(className)) {
      return res.status(403).json({ message: "الصف المحدد غير مسموح به" });
    }

    const students = await db
      .select({ id: studentsTable.id, name: studentsTable.name })
      .from(studentsTable)
      .where(and(
        eq(studentsTable.teacherId, challenge.teacherId),
        or(eq(studentsTable.studentClass, className), eq(studentsTable.gradeLevel, className)),
      ))
      .orderBy(asc(studentsTable.name))
      .limit(200);

    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      students: students.map((student) => ({
        token: createRosterSelectionToken(req.params.slug, className, student.id),
        name: rosterDisplayName(student.name),
      })),
    });
  } catch (err) {
    req.log.error(err, "Get solo challenge roster error");
    res.status(500).json({ message: "تعذّر تحميل أسماء الطلاب" });
  }
});

// ── POST /api/solo-challenges/:slug/start  (public: start game) ─────────────
router.post("/solo-challenges/:slug/start", async (req, res) => {
  try {
    const slug = req.params.slug;
    const participantKey = String(req.body?.participantKey || "").trim();
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(participantKey)) {
      return res.status(400).json({ message: "معرّف المشارك غير صالح" });
    }
    const [challenge] = await db
      .select({
        id: soloChallengesTable.id,
        teacherId: soloChallengesTable.teacherId,
        expiresAt: soloChallengesTable.expiresAt,
        assignmentId: soloChallengesTable.assignmentId,
        questions: soloChallengesTable.questions,
        questionsPerParticipant: soloChallengesTable.questionsPerParticipant,
        maxAttempts: soloChallengesTable.maxAttempts,
        timePerQuestion: soloChallengesTable.timePerQuestion,
        isMultiLevel: soloChallengesTable.isMultiLevel,
        levels: soloChallengesTable.levels,
        difficultyDistribution: soloChallengesTable.difficultyDistribution,
        assignmentTitle: soloChallengesTable.assignmentTitle,
        shortSlug: soloChallengesTable.shortSlug,
        leaderboardDisplay: soloChallengesTable.leaderboardDisplay,
        allowedClasses: soloChallengesTable.allowedClasses,
        assignmentArchivedAt: assignmentsTable.archivedAt,
      })
      .from(soloChallengesTable)
      .leftJoin(assignmentsTable, eq(soloChallengesTable.assignmentId, assignmentsTable.id))
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });
    if (challenge.assignmentId !== null && challenge.assignmentArchivedAt) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }

    const now = new Date();
    if (challenge.expiresAt && new Date(challenge.expiresAt) < now) {
      return res.status(403).json({ message: "انتهت مدة هذه المسابقة" });
    }

    // ── Class restriction check ───────────────────────────────────────────────
    const allowedClasses = Array.isArray((challenge as any).allowedClasses)
      ? ((challenge as any).allowedClasses as string[]).filter(c => typeof c === "string" && c.trim())
      : [];
    let verifiedPlayerName: string | null = null;
    if (allowedClasses.length > 0) {
      const playerClass = String(req.body?.playerClass || "").trim();
      if (!playerClass || !allowedClasses.includes(playerClass)) {
        return res.status(403).json({
          message: playerClass
            ? "الصف المحدد غير مسموح به في هذه المسابقة"
            : "يجب اختيار صفك أولاً للمشاركة في هذه المسابقة",
        });
      }
      const requestedName = String(req.body?.playerName || "").trim().slice(0, 60);
      const studentToken = String(req.body?.studentToken || "").trim();
      if (studentToken) {
        const students = await db
          .select({ id: studentsTable.id, name: studentsTable.name })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.teacherId, challenge.teacherId),
            or(eq(studentsTable.studentClass, playerClass), eq(studentsTable.gradeLevel, playerClass)),
          ))
          .limit(200);
        const student = students.find((candidate) =>
          createRosterSelectionToken(slug, playerClass, candidate.id) === studentToken);
        if (!student) return res.status(403).json({ message: "الطالب غير موجود في الصف المحدد" });
        verifiedPlayerName = student.name;
      } else if (req.body?.manualName === true && requestedName) {
        verifiedPlayerName = requestedName;
      } else {
        return res.status(400).json({ message: "اختر اسمك من القائمة أو اكتب اسمك يدويًا" });
      }
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
          difficulty: q.difficulty ?? null,
        }));
    }

    if (gameQuestions.length === 0) return res.status(400).json({ message: "لا توجد أسئلة في هذه المسابقة" });

    // ── Multi-level / difficulty-distribution processing ──────────────────────
    const isMultiLvl = Boolean(challenge.isMultiLevel);
    const diffDist = validateDifficultyDistribution(challenge.difficultyDistribution);
    let preserveOrder = false;

    if (isMultiLvl) {
      const levelDefs = ((challenge as any).levels as ChallengeLevel[] | null);
      if (levelDefs && levelDefs.length > 0) {
        const shuffledAll = shuffleArray(gameQuestions);
        const result: GameQuestion[] = [];
        let offset = 0;
        for (let li = 0; li < levelDefs.length; li++) {
          const lv = levelDefs[li];
          const lvTime = Math.max(5, Math.min(120, lv.timePerQuestion));
          const count = Math.min(lv.questionCount, shuffledAll.length - offset);
          if (count <= 0) break;
          for (let qi = offset; qi < offset + count; qi++) {
            result.push({ ...shuffledAll[qi], duration: lvTime, levelIndex: li, levelName: lv.name });
          }
          offset += count;
        }
        if (result.length > 0) {
          gameQuestions = result;
          preserveOrder = true;
        }
      }
    } else if (diffDist) {
      // Pick questions by difficulty bucket; fall back to untagged questions to fill gaps
      const easyPool    = shuffleArray(gameQuestions.filter(q => q.difficulty === 1));
      const mediumPool  = shuffleArray(gameQuestions.filter(q => q.difficulty === 2));
      const hardPool    = shuffleArray(gameQuestions.filter(q => q.difficulty === 3));
      const untaggedPool = shuffleArray(gameQuestions.filter(q => !q.difficulty));

      let untaggedIdx = 0;
      const takeBucket = (pool: GameQuestion[], count: number): GameQuestion[] => {
        const picked = pool.slice(0, count);
        const deficit = count - picked.length;
        if (deficit > 0) {
          const filler = untaggedPool.slice(untaggedIdx, untaggedIdx + deficit);
          untaggedIdx += filler.length;
          picked.push(...filler);
        }
        return picked;
      };

      const result = [
        ...takeBucket(easyPool,   diffDist.easy),
        ...takeBucket(mediumPool, diffDist.medium),
        ...takeBucket(hardPool,   diffDist.hard),
      ];
      if (result.length > 0) gameQuestions = shuffleArray(result);
    } else {
      const perParticipant = challenge.questionsPerParticipant;
      if (perParticipant != null && perParticipant > 0 && perParticipant < gameQuestions.length) {
        gameQuestions = shuffleArray(gameQuestions).slice(0, perParticipant);
      }
    }

    const game = createGame(
      challenge.assignmentId ?? 0,
      challenge.assignmentTitle,
      "guest",
      0,
      gameQuestions,
      duration,
      true,
      "solo",
      2,
      undefined,
      null,
      false,
      null,
      preserveOrder,
    );

    // A self challenge has one player and no gift targets. Keep the quick,
    // uninterrupted flow without accidentally disabling gifts in live
    // individual Wameeth games, which share the same `solo` gameMode.
    game.giftsEnabled = false;
    game.soloChallengeSlug = slug;
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${slug}:${participantKey}`}))`);
        const [attempts] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(soloChallengeAttemptsTable)
          .where(and(
            eq(soloChallengeAttemptsTable.slug, slug),
            eq(soloChallengeAttemptsTable.participantKey, participantKey),
          ));
        const maxAttempts = challenge.maxAttempts ?? 1;
        if (maxAttempts > 0 && (attempts?.count ?? 0) >= maxAttempts) {
          throw new Error("MAX_ATTEMPTS_REACHED");
        }
        await tx.insert(soloChallengeAttemptsTable).values({
          slug,
          participantKey,
          gameRunId: game.gameRunId,
        });
      });
    } catch (error) {
      deleteGame(game.pin);
      if (error instanceof Error && error.message === "MAX_ATTEMPTS_REACHED") {
        return res.status(409).json({ message: "تم استخدام جميع المحاولات المتاحة" });
      }
      throw error;
    }
    try {
      startGameFromRest(game.pin);
      await db
        .update(soloChallengesTable)
        .set({ playCount: sql`${soloChallengesTable.playCount} + 1` })
        .where(eq(soloChallengesTable.slug, slug));
    } catch (error) {
      deleteGame(game.pin);
      await db.delete(soloChallengeAttemptsTable)
        .where(eq(soloChallengeAttemptsTable.gameRunId, game.gameRunId))
        .catch(() => undefined);
      throw error;
    }

    res.json({
      pin: game.pin,
      title: challenge.assignmentTitle,
      questionCount: gameQuestions.length,
      shortSlug: challenge.shortSlug ?? null,
      leaderboardDisplay: challenge.leaderboardDisplay ?? "top20",
      scoreProof: game.gameRunId,
      verifiedPlayerName,
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
    const pin = String(req.body?.pin || "").trim();
    const scoreProof = String(req.body?.scoreProof || "").trim();
    const participantKey = String(req.body?.participantKey || "").trim();

    if (!playerName) return res.status(400).json({ message: "الاسم مطلوب" });
    if (!pin || !scoreProof || !/^[a-zA-Z0-9-]{16,80}$/.test(participantKey)) {
      return res.status(400).json({ message: "بيانات إثبات النتيجة مطلوبة" });
    }

    const [challenge] = await db
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId, assignmentId: soloChallengesTable.assignmentId, assignmentArchivedAt: assignmentsTable.archivedAt })
      .from(soloChallengesTable)
      .leftJoin(assignmentsTable, eq(soloChallengesTable.assignmentId, assignmentsTable.id))
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });
    if (challenge.assignmentId !== null && challenge.assignmentArchivedAt) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }

    const game = getGame(pin);
    if (
      game &&
      game.gameRunId === scoreProof &&
      game.soloChallengeSlug === slug &&
      game.state === "finished"
    ) {
      const player = Array.from(game.players.values()).find((candidate) => candidate.name === playerName);
      if (!player) return res.status(409).json({ message: "تعذر التحقق من اللاعب" });
      const result = await persistSoloChallengeResult(game);
      if (result === "missing_attempt") {
        return res.status(409).json({ message: "تعذر التحقق من المحاولة" });
      }
      return res.json({ ok: true, result });
    }

    // The Socket.IO game is intentionally short-lived. Once it is deleted,
    // only the server-saved result can answer a retry; never trust score
    // values sent by the browser as a fallback.
    const [storedScore] = await db
      .select({
        playerName: soloChallengeScoresTable.playerName,
        score: soloChallengeScoresTable.score,
        correctCount: soloChallengeScoresTable.correctCount,
        timeTaken: soloChallengeScoresTable.timeTaken,
        totalQuestions: soloChallengeScoresTable.totalQuestions,
        gameRunId: soloChallengeScoresTable.gameRunId,
      })
      .from(soloChallengeScoresTable)
      .innerJoin(
        soloChallengeAttemptsTable,
        and(
          eq(soloChallengeAttemptsTable.slug, soloChallengeScoresTable.slug),
          eq(soloChallengeAttemptsTable.participantKey, soloChallengeScoresTable.participantKey),
          eq(soloChallengeAttemptsTable.gameRunId, scoreProof),
        ),
      )
      .where(and(
        eq(soloChallengeScoresTable.slug, slug),
        eq(soloChallengeScoresTable.participantKey, participantKey),
      ))
      .limit(1);
    if (!storedScore) {
      return res.status(409).json({ message: "تعذر التحقق من نتيجة هذه المحاولة" });
    }
    res.json({ ok: true, result: storedScore.gameRunId === scoreProof ? "duplicate" : "kept" });
  } catch (err) {
    req.log.error(err, "Solo challenge score error");
    res.status(500).json({ message: "خطأ في تسجيل الدرجة" });
  }
});

// ── GET /api/solo-challenges/:slug/result  (private recovery by attempt proof)
router.get("/solo-challenges/:slug/result", async (req, res) => {
  try {
    const slug = req.params.slug;
    const participantKey = String(req.query.participantKey || "").trim();
    const scoreProof = String(req.query.scoreProof || "").trim();
    if (!scoreProof || !/^[a-zA-Z0-9-]{16,80}$/.test(participantKey)) {
      return res.status(400).json({ message: "بيانات استعادة النتيجة مطلوبة" });
    }

    const [challenge] = await db
      .select({
        assignmentId: soloChallengesTable.assignmentId,
        assignmentArchivedAt: assignmentsTable.archivedAt,
      })
      .from(soloChallengesTable)
      .leftJoin(assignmentsTable, eq(soloChallengesTable.assignmentId, assignmentsTable.id))
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);
    if (!challenge || (challenge.assignmentId !== null && challenge.assignmentArchivedAt)) {
      return res.status(404).json({ message: "الرابط غير موجود" });
    }

    const [score] = await db
      .select({
        playerName: soloChallengeScoresTable.playerName,
        score: soloChallengeScoresTable.score,
        correctCount: soloChallengeScoresTable.correctCount,
        timeTaken: soloChallengeScoresTable.timeTaken,
        totalQuestions: soloChallengeScoresTable.totalQuestions,
      })
      .from(soloChallengeScoresTable)
      .innerJoin(
        soloChallengeAttemptsTable,
        and(
          eq(soloChallengeAttemptsTable.slug, soloChallengeScoresTable.slug),
          eq(soloChallengeAttemptsTable.participantKey, soloChallengeScoresTable.participantKey),
          eq(soloChallengeAttemptsTable.gameRunId, scoreProof),
        ),
      )
      .where(and(
        eq(soloChallengeScoresTable.slug, slug),
        eq(soloChallengeScoresTable.participantKey, participantKey),
      ))
      .limit(1);

    if (!score) return res.status(404).json({ message: "لا توجد نتيجة محفوظة لهذه المحاولة" });
    res.json({ ok: true, ...score });
  } catch (err) {
    req.log.error(err, "Solo challenge result recovery error");
    res.status(500).json({ message: "تعذر استعادة النتيجة" });
  }
});

// ── GET /api/solo-challenges/:slug/leaderboard  (public: top scores) ─────────
router.get("/solo-challenges/:slug/leaderboard", async (req, res) => {
  try {
    const slug = req.params.slug;

    const [challenge] = await db
      .select({
        id: soloChallengesTable.id,
        teacherId: soloChallengesTable.teacherId,
        leaderboardDisplay: soloChallengesTable.leaderboardDisplay,
        assignmentId: soloChallengesTable.assignmentId,
        assignmentArchivedAt: assignmentsTable.archivedAt,
      })
      .from(soloChallengesTable)
      .leftJoin(assignmentsTable, eq(soloChallengesTable.assignmentId, assignmentsTable.id))
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "المسابقة غير موجودة" });
    if (challenge.assignmentId !== null && challenge.assignmentArchivedAt) {
      return res.status(404).json({ message: "المسابقة غير موجودة" });
    }

    const display = challenge.leaderboardDisplay ?? "top20";
    const limit = display === "top3" ? 3 : display === "all" ? 1000 : 20;

    const rows = await db
      .select({
        playerName: soloChallengeScoresTable.playerName,
        score: soloChallengeScoresTable.score,
        correctCount: soloChallengeScoresTable.correctCount,
        timeTaken: soloChallengeScoresTable.timeTaken,
        playedAt: soloChallengeScoresTable.playedAt,
      })
      .from(soloChallengeScoresTable)
      .where(eq(soloChallengeScoresTable.slug, req.params.slug))
      .orderBy(
        desc(soloChallengeScoresTable.correctCount),
        asc(soloChallengeScoresTable.timeTaken),
        desc(soloChallengeScoresTable.score),
      )
      .limit(500);

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

/* ── Audio upload URL for standalone question audio ──────────────────────── */
router.post("/solo-challenges/uploads/audio-url", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const { name, size, contentType } = req.body || {};
  if (!name || !size || !contentType) {
    res.status(400).json({ message: "بيانات الملف ناقصة" });
    return;
  }
  const isAudio = (contentType as string).startsWith("audio/") ||
    contentType === "application/octet-stream";
  if (!isAudio) {
    res.status(400).json({ message: "يُسمح برفع ملفات الصوت فقط" });
    return;
  }
  if (size > 25 * 1024 * 1024) {
    res.status(400).json({ message: "الحجم يتجاوز 25 MB" });
    return;
  }
  try {
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err) {
    req.log.error({ err }, "Failed to get solo-challenge audio upload URL");
    res.status(500).json({ message: "فشل توليد رابط الرفع" });
  }
});

export default router;
