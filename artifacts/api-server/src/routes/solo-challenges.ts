import { Router, type IRouter } from "express";
import {
  db,
  assignmentsTable,
  questionsTable,
  soloChallengesTable,
  soloChallengeScoresTable,
  teachersTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql, isNull, or } from "drizzle-orm";
import {
  createGame,
  type GameQuestion,
} from "../game/manager";
import { startGameFromRest } from "../game/socket-handlers";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

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

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const teacherId = req.session?.teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مصرح" }); return false; }
  const [teacher] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);
  if (!teacher?.isAdmin) { res.status(403).json({ message: "هذا الإجراء متاح للمسؤول فقط" }); return false; }
  return true;
}

const ALLOWED_QUESTION_TYPES = ["mcq", "true_false"] as const;
type SoloQuestionType = typeof ALLOWED_QUESTION_TYPES[number];

type SoloQuestion = {
  text: string;
  questionType: SoloQuestionType;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
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
    if (!["A","B","C","D"].includes(obj.correctAnswer as string)) continue;
    const rawDiff = Number(obj.difficulty);
    const rawType = obj.questionType as string;
    const questionType: SoloQuestionType = ALLOWED_QUESTION_TYPES.includes(rawType as SoloQuestionType)
      ? rawType as SoloQuestionType
      : "mcq";
    // For true_false questions auto-fill options so they're never blank
    const isTF = questionType === "true_false";
    const rawAudio = obj.audioUrl;
    const audioUrl: string | null = (typeof rawAudio === "string" && rawAudio.trim()) ? rawAudio.trim() : null;
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

    const assignmentId = Number(req.params.assignmentId);
    if (!assignmentId) return res.status(400).json({ message: "معرّف الواجب مطلوب" });

    const [assignment] = await db
      .select({ id: assignmentsTable.id, title: assignmentsTable.title, teacherId: assignmentsTable.teacherId })
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, assignmentId), eq(assignmentsTable.teacherId, teacherId)))
      .limit(1);

    if (!assignment) return res.status(404).json({ message: "الواجب غير موجود أو لا تملكه" });

    // Return existing link if already created
    const [existing] = await db
      .select({ id: soloChallengeScoresTable.id })
      .from(soloChallengeScoresTable)
      .where(and(
        eq(soloChallengeScoresTable.id, scoreId),
        eq(soloChallengeScoresTable.slug, req.params.slug),
      ))
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

    const base = titleToSlug(title);
    const slug = req.params.slug;
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
      if (!Number.isInteger(ma) || ma < 1 || ma > 10) {
        return res.status(400).json({ message: "عدد المحاولات يجب أن يكون بين 1 و10" });
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

    const base = titleToSlug(title);
    const slug = req.params.slug;
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
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
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
        playerName: soloChallengeScoresTable.playerName,
        score: soloChallengeScoresTable.score,
        correctCount: soloChallengeScoresTable.correctCount,
        timeTaken: soloChallengeScoresTable.timeTaken,
        playedAt: soloChallengeScoresTable.playedAt,
      })
      .from(soloChallengeScoresTable)
      .where(eq(soloChallengeScoresTable.slug, slug))
      .orderBy(
        desc(soloChallengeScoresTable.correctCount),
        asc(soloChallengeScoresTable.timeTaken),
        desc(soloChallengeScoresTable.score),
      )
      .limit(limit);

    res.json(rows);
  } catch (err) {
    req.log.error(err, "Get participants error");
    res.status(500).json({ message: "خطأ في جلب المشاركين" });
  }
});

// ── DELETE /api/solo-challenges/:slug/participants/:id  (admin only) ────────
router.delete("/solo-challenges/:slug/participants/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const scoreId = Number(req.params.id);
    if (!Number.isInteger(scoreId)) return res.status(400).json({ message: "معرّف غير صالح" });

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
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
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
      const t = String(req.body.title || "").trim();
      if (!isNaN(t)) update.timePerQuestion = Math.max(5, Math.min(120, t));
    }
    if ("leaderboardDisplay" in req.body) {
      if (["top3", "top20", "all"].includes(req.body.leaderboardDisplay)) {
        update.leaderboardDisplay = req.body.leaderboardDisplay;
      }
    }
    if ("maxAttempts" in req.body) {
      const ma = Number(req.body.maxAttempts);
      if (!Number.isInteger(ma) || ma < 1 || ma > 10) {
        return res.status(400).json({ message: "عدد المحاولات يجب أن يكون بين 1 و10" });
      }
      update.maxAttempts = ma;
    }
    if ("title" in req.body && challenge.assignmentId === null) {
      const t = String(req.body.title || "").trim();
      if (t.length > 0 && t.length <= 200) update.assignmentTitle = t;
    }
    if ("questions" in req.body && challenge.assignmentId === null) {
      const qs = validateQuestions(challenge.questions);
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
          const lv = levelDefs[li];
        if (lv !== null) update.levels = lv;
      }
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
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
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

    const effectiveQuestionCount =
      challenge.questionsPerParticipant != null && challenge.questionsPerParticipant < questionCount
        ? challenge.questionsPerParticipant
        : questionCount;

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
      difficulty: (challenge as any).difficulty ?? null,
      difficultyAffectsPoints: Boolean((challenge as any).difficultyAffectsPoints),
      isMultiLevel: Boolean((challenge as any).isMultiLevel),
      levels: (challenge as any).levels ?? null,
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
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
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
          difficulty: q.difficulty ?? null,
        }));
    }

    if (gameQuestions.length === 0) return res.status(400).json({ message: "لا توجد أسئلة في هذه المسابقة" });

    // ── Multi-level / difficulty-distribution processing ──────────────────────
    const isMultiLvl = Boolean((challenge as any).isMultiLevel);
    const diffDist = validateDifficultyDistribution((challenge as any).difficultyDistribution);
    let preserveOrder = false;

    if (isMultiLvl) {
      const levelDefs = ((challenge as any).levels as ChallengeLevel[] | null);
      if (levelDefs && levelDefs.length > 0) {
        const shuffledAll = shuffleArray(gameQuestions);
      const result = [
        ...takeBucket(easyPool,   diffDist.easy),
        ...takeBucket(mediumPool, diffDist.medium),
        ...takeBucket(hardPool,   diffDist.hard),
      ];
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
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
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
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, req.params.slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "المسابقة غير موجودة" });

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
      .where(eq(soloChallengeScoresTable.slug, slug))
      .orderBy(
        desc(soloChallengeScoresTable.correctCount),
        asc(soloChallengeScoresTable.timeTaken),
        desc(soloChallengeScoresTable.score),
      )
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
