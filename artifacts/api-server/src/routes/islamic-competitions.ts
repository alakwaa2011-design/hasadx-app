import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  db,
  teachersTable,
  islamicSectionsTable,
  islamicCategoriesTable,
  islamicQuestionsTable,
  islamicProgressTable,
  islamicChallengesTable,
  islamicPermissionsTable,
  islamicDailyVisitsTable,
  islamicCertificatesTable,
  islamicTournamentsTable,
  platformSettingsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray, gte } from "drizzle-orm";
import multer from "multer";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { ObjectStorageService } from "../lib/objectStorage";
import { randomUUID, randomInt } from "crypto";
import { logIslamicEvent } from "../lib/islamicEvents";
import { islamicEventsTable } from "@workspace/db";
import { Readable } from "stream";
import { z } from "zod";

const router: IRouter = Router();
const storage = new ObjectStorageService();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// "مسابقات عامة" is now open to every signed-in teacher and organizer.
// The legacy permissions table is preserved for backward compatibility but
// no longer gates viewing or playing — only admin status is meaningful here
// (used by the admin tools in the dashboard).
async function isAdminOrPermitted(teacherId: number): Promise<{ ok: boolean; isAdmin: boolean }> {
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
  if (!t) return { ok: false, isAdmin: false };
  return { ok: true, isAdmin: !!t.isAdmin };
}

// Editor-only gate (content/permissions management) still requires admin
// or an explicit grant in islamic_permissions.
async function isEditor(teacherId: number): Promise<{ ok: boolean; isAdmin: boolean }> {
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
  if (!t) return { ok: false, isAdmin: false };
  if (t.isAdmin) return { ok: true, isAdmin: true };
  const [p] = await db
    .select({ isActive: islamicPermissionsTable.isActive })
    .from(islamicPermissionsTable)
    .where(eq(islamicPermissionsTable.teacherId, teacherId))
    .limit(1);
  return { ok: !!p?.isActive, isAdmin: false };
}

async function getGeneralFlags(): Promise<{ showQuran: boolean; showCertificates: boolean }> {
  const [row] = await db
    .select({
      showQuranSection: platformSettingsTable.showQuranSection,
      showGeneralCertificates: platformSettingsTable.showGeneralCertificates,
    })
    .from(platformSettingsTable)
    .limit(1);
  return {
    showQuran: row?.showQuranSection ?? false,
    showCertificates: row?.showGeneralCertificates ?? false,
  };
}

function isQuranSection(name: string | null | undefined): boolean {
  if (!name) return false;
  return /قرآن|قارئ|قرءان/.test(name);
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return false;
  }
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, req.session.teacherId)).limit(1);
  if (!t?.isAdmin) {
    res.status(403).json({ message: "صلاحيات المسؤول مطلوبة" });
    return false;
  }
  return true;
}

async function requireEditor(req: Request, res: Response): Promise<boolean> {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return false;
  }
  const r = await isEditor(req.session.teacherId);
  if (!r.ok) {
    res.status(403).json({ message: "تحرير محتوى المسابقات العامة يتطلب صلاحية مسؤول" });
    return false;
  }
  return true;
}

async function requireAccess(req: Request, res: Response): Promise<boolean> {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return false;
  }
  return true;
}

router.get("/islamic/access", async (req, res) => {
  if (!req.session.teacherId) {
    res.json({ hasAccess: false, isAdmin: false, isEditor: false, showCertificates: false });
    return;
  }
  const r = await isAdminOrPermitted(req.session.teacherId);
  const ed = await isEditor(req.session.teacherId);
  const flags = await getGeneralFlags();
  res.json({ hasAccess: r.ok, isAdmin: r.isAdmin, isEditor: ed.ok, showCertificates: flags.showCertificates });
});

router.get("/islamic/sections", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const { isAdmin } = await isAdminOrPermitted(teacherId);
  const flags = await getGeneralFlags();
  const all = await db.select().from(islamicSectionsTable).orderBy(islamicSectionsTable.order, islamicSectionsTable.id);
  const cats = await db.select().from(islamicCategoriesTable).orderBy(islamicCategoriesTable.order, islamicCategoriesTable.id);
  const counts = await db
    .select({ categoryId: islamicQuestionsTable.categoryId, n: sql<number>`COUNT(*)::int` })
    .from(islamicQuestionsTable)
    .groupBy(islamicQuestionsTable.categoryId);
  const countMap = new Map(counts.map((c) => [c.categoryId, c.n]));
  const hardCounts = await db
    .select({ categoryId: islamicQuestionsTable.categoryId, n: sql<number>`COUNT(*)::int` })
    .from(islamicQuestionsTable)
    .where(eq(islamicQuestionsTable.difficulty, "hard"))
    .groupBy(islamicQuestionsTable.categoryId);
  const hardMap = new Map(hardCounts.map((c) => [c.categoryId, c.n]));

  // Level distribution per category
  const levelRows = await db
    .select({ categoryId: islamicQuestionsTable.categoryId, lvl: islamicQuestionsTable.questionLevel, n: sql<number>`COUNT(*)::int` })
    .from(islamicQuestionsTable)
    .groupBy(islamicQuestionsTable.categoryId, islamicQuestionsTable.questionLevel);
  const levelMap = new Map<number, number[]>();
  for (const row of levelRows) {
    const existing = levelMap.get(row.categoryId) ?? [];
    if (!existing.includes(row.lvl)) existing.push(row.lvl);
    levelMap.set(row.categoryId, existing.sort((a, b) => a - b));
  }

  // User's max unlocked level per category
  const userProgress = await db
    .select({ categoryId: islamicProgressTable.categoryId, maxUnlockedLevel: islamicProgressTable.maxUnlockedLevel })
    .from(islamicProgressTable)
    .where(eq(islamicProgressTable.userId, teacherId));
  const userLevelMap = new Map(userProgress.map((p) => [p.categoryId, p.maxUnlockedLevel]));

  const sections = all
    .filter((s) => {
      if (!flags.showQuran && !isAdmin && isQuranSection(s.name)) return false;
      if (s.ownerId !== null && s.ownerId !== undefined) return s.ownerId === teacherId;
      return isAdmin || s.isVisible;
    })
    .map((s) => ({
      ...s,
      categories: cats
        .filter((c) => {
          if (c.sectionId !== s.id) return false;
          if (!flags.showQuran && !isAdmin && isQuranSection(c.name)) return false;
          if (c.ownerId !== null && c.ownerId !== undefined) return c.ownerId === teacherId;
          return isAdmin || c.isVisible;
        })
        .map((c) => ({
          ...c,
          questionCount: countMap.get(c.id) || 0,
          hardCount: hardMap.get(c.id) || 0,
          availableLevels: levelMap.get(c.id) ?? [1],
          userMaxLevel: userLevelMap.get(c.id) ?? 1,
        })),
    }));
  res.json(sections);
});

router.post("/islamic/sections", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  const { name, description, isVisible, order } = req.body || {};
  if (!name) {
    res.status(400).json({ message: "الاسم مطلوب" });
    return;
  }
  const [row] = await db.insert(islamicSectionsTable).values({ name, description, isVisible: isVisible ?? true, order: order ?? 0 }).returning();
  res.status(201).json(row);
});

router.patch("/islamic/sections/:id", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  const id = parseInt(req.params.id);
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "description", "isVisible", "order"]) if (k in req.body) patch[k] = (req.body as Record<string, unknown>)[k];
  const [row] = await db.update(islamicSectionsTable).set(patch).where(eq(islamicSectionsTable.id, id)).returning();
  res.json(row);
});

router.delete("/islamic/sections/:id", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  await db.delete(islamicSectionsTable).where(eq(islamicSectionsTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

router.post("/islamic/categories", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  const { sectionId, name, description, level, isVisible, order } = req.body || {};
  if (!sectionId || !name) {
    res.status(400).json({ message: "القسم والاسم مطلوبان" });
    return;
  }
  const [row] = await db.insert(islamicCategoriesTable).values({ sectionId, name, description, level: level || "mixed", isVisible: isVisible ?? true, order: order ?? 0 }).returning();
  res.status(201).json(row);
});

router.patch("/islamic/categories/:id", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  const id = parseInt(req.params.id);
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "description", "level", "isVisible", "order"]) if (k in req.body) patch[k] = (req.body as Record<string, unknown>)[k];
  const [row] = await db.update(islamicCategoriesTable).set(patch).where(eq(islamicCategoriesTable.id, id)).returning();
  res.json(row);
});

router.delete("/islamic/categories/:id", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  await db.delete(islamicCategoriesTable).where(eq(islamicCategoriesTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

router.get("/islamic/categories/:id/questions", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const categoryId = parseInt(req.params.id);
  const rows = await db.select().from(islamicQuestionsTable).where(eq(islamicQuestionsTable.categoryId, categoryId)).orderBy(islamicQuestionsTable.id);
  res.json(rows);
});

router.post("/islamic/questions", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  const { categoryId, questionText, audioUrl, optionA, optionB, optionC, optionD, correctAnswer, difficulty } = req.body || {};
  if (!categoryId || !questionText || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
    res.status(400).json({ message: "بيانات السؤال غير مكتملة" });
    return;
  }
  const [row] = await db
    .insert(islamicQuestionsTable)
    .values({
      categoryId,
      questionText,
      audioUrl: audioUrl || null,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      difficulty: difficulty || "medium",
      createdBy: req.session.teacherId!,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/islamic/questions/:id", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  const id = parseInt(req.params.id);
  const patch: Record<string, unknown> = {};
  for (const k of ["questionText", "audioUrl", "optionA", "optionB", "optionC", "optionD", "correctAnswer", "difficulty", "categoryId"])
    if (k in req.body) patch[k] = (req.body as Record<string, unknown>)[k];
  const [row] = await db.update(islamicQuestionsTable).set(patch).where(eq(islamicQuestionsTable.id, id)).returning();
  res.json(row);
});

router.delete("/islamic/questions/:id", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  await db.delete(islamicQuestionsTable).where(eq(islamicQuestionsTable.id, parseInt(req.params.id)));
  res.json({ success: true });
});

router.get("/islamic/admin/permissions", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const rows = await db
    .select({
      id: islamicPermissionsTable.id,
      teacherId: islamicPermissionsTable.teacherId,
      teacherName: teachersTable.name,
      teacherEmail: teachersTable.email,
      grantedAt: islamicPermissionsTable.grantedAt,
      isActive: islamicPermissionsTable.isActive,
    })
    .from(islamicPermissionsTable)
    .leftJoin(teachersTable, eq(islamicPermissionsTable.teacherId, teachersTable.id))
    .orderBy(desc(islamicPermissionsTable.grantedAt));
  res.json(rows);
});

router.post("/islamic/admin/permissions", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { teacherId } = req.body || {};
  if (!teacherId) {
    res.status(400).json({ message: "teacherId مطلوب" });
    return;
  }
  const [row] = await db
    .insert(islamicPermissionsTable)
    .values({ teacherId, grantedBy: req.session.teacherId!, isActive: true })
    .onConflictDoUpdate({ target: islamicPermissionsTable.teacherId, set: { isActive: true, grantedBy: req.session.teacherId!, grantedAt: new Date() } })
    .returning();
  res.json(row);
});

router.delete("/islamic/admin/permissions/:teacherId", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  await db.update(islamicPermissionsTable).set({ isActive: false }).where(eq(islamicPermissionsTable.teacherId, parseInt(req.params.teacherId)));
  res.json({ success: true });
});

router.post("/islamic/uploads/audio-url", async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  const { name, size, contentType } = req.body || {};
  if (!name || !size || !contentType) {
    res.status(400).json({ message: "بيانات الملف ناقصة" });
    return;
  }
  if (!(contentType.startsWith("audio/") || contentType === "application/octet-stream")) {
    res.status(400).json({ message: "النوع غير مدعوم" });
    return;
  }
  if (size > 25 * 1024 * 1024) {
    res.status(400).json({ message: "الحجم يتجاوز 25MB" });
    return;
  }
  try {
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err) {
    req.log.error({ err }, "Failed to get audio upload URL");
    res.status(500).json({ message: "فشل توليد رابط الرفع" });
  }
});

router.post("/islamic/import", upload.single("file"), async (req, res) => {
  if (!(await requireEditor(req, res))) return;
  if (!req.file) {
    res.status(400).json({ message: "لم يتم رفع ملف" });
    return;
  }
  try {
    let rows: Array<Record<string, string>> = [];
    const lower = req.file.originalname.toLowerCase();
    if (lower.endsWith(".docx")) {
      const out = await mammoth.extractRawText({ buffer: req.file.buffer });
      const lines = out.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const header = lines[0]?.split("\t");
      if (!header) {
        res.status(400).json({ message: "ملف Word فارغ" });
        return;
      }
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split("\t");
        const obj: Record<string, string> = {};
        header.forEach((h, j) => (obj[h.trim()] = (cells[j] || "").trim()));
        rows.push(obj);
      }
    } else {
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
    }

    const sectionsMap = new Map<string, number>();
    const categoriesMap = new Map<string, number>();
    const existingSections = await db.select().from(islamicSectionsTable);
    existingSections.forEach((s) => sectionsMap.set(s.name, s.id));
    const existingCats = await db.select().from(islamicCategoriesTable);
    existingCats.forEach((c) => categoriesMap.set(`${c.sectionId}::${c.name}`, c.id));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const sectionName = (row["section_name"] || row["القسم"] || "").trim();
      const categoryName = (row["category_name"] || row["الفئة"] || "").trim();
      const text = (row["نص السؤال"] || row["question"] || row["question_text"] || "").trim();
      const a = (row["الخيار أ"] || row["option_a"] || row["A"] || "").trim();
      const b = (row["الخيار ب"] || row["option_b"] || row["B"] || "").trim();
      const c = (row["الخيار ج"] || row["option_c"] || row["C"] || "").trim();
      const d = (row["الخيار د"] || row["option_d"] || row["D"] || "").trim();
      const correct = (row["الإجابة الصحيحة"] || row["correct_answer"] || "").trim();
      const difficulty = ((row["الصعوبة"] || row["difficulty"] || "medium").trim() || "medium").toLowerCase();
      const audioUrl = (row["audio_url"] || "").trim() || null;
      if (!sectionName || !categoryName || !text || !a || !b || !c || !d || !correct) {
        skipped++;
        continue;
      }
      let sectionId = sectionsMap.get(sectionName);
      if (!sectionId) {
        const [s] = await db.insert(islamicSectionsTable).values({ name: sectionName }).returning();
        sectionId = s.id;
        sectionsMap.set(sectionName, sectionId);
      }
      const catKey = `${sectionId}::${categoryName}`;
      let categoryId = categoriesMap.get(catKey);
      if (!categoryId) {
        const [cat] = await db.insert(islamicCategoriesTable).values({ sectionId, name: categoryName }).returning();
        categoryId = cat.id;
        categoriesMap.set(catKey, categoryId);
      }
      let normalizedCorrect = correct;
      if (["أ", "a", "A"].includes(correct)) normalizedCorrect = a;
      else if (["ب", "b", "B"].includes(correct)) normalizedCorrect = b;
      else if (["ج", "c", "C"].includes(correct)) normalizedCorrect = c;
      else if (["د", "d", "D"].includes(correct)) normalizedCorrect = d;
      await db.insert(islamicQuestionsTable).values({
        categoryId,
        questionText: text,
        optionA: a,
        optionB: b,
        optionC: c,
        optionD: d,
        correctAnswer: normalizedCorrect,
        difficulty: ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium",
        audioUrl,
        createdBy: req.session.teacherId!,
      });
      imported++;
    }
    res.json({ imported, skipped, errors });
  } catch (err) {
    req.log.error({ err }, "General quizzes import failed");
    res.status(500).json({ message: "فشل الاستيراد" });
  }
});

router.get("/islamic/play/:categoryId", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const categoryId = parseInt(req.params.categoryId);
  const level = parseInt(req.query.level as string) || 1;

  // Verify this level is unlocked for the user
  const userId = req.session.teacherId!;
  const [prog] = await db.select({ maxUnlockedLevel: islamicProgressTable.maxUnlockedLevel })
    .from(islamicProgressTable)
    .where(and(eq(islamicProgressTable.userId, userId), eq(islamicProgressTable.categoryId, categoryId)))
    .limit(1);
  const maxUnlocked = prog?.maxUnlockedLevel ?? 1;
  if (level > maxUnlocked) {
    res.status(403).json({ message: "هذا المستوى مقفل. أكمل المستوى السابق بدون أخطاء لفتحه." });
    return;
  }

  const all = await db.select().from(islamicQuestionsTable).where(
    and(eq(islamicQuestionsTable.categoryId, categoryId), eq(islamicQuestionsTable.questionLevel, level))
  );
  if (all.length === 0) {
    res.status(404).json({ message: "لا أسئلة في هذا المستوى" });
    return;
  }
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  const questions = shuffled.map((q) => {
    const opts = [q.optionA, q.optionB, q.optionC, q.optionD].sort(() => Math.random() - 0.5);
    const letterMap: Record<string, string> = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD };
    const correctAnswer = letterMap[q.correctAnswer] ?? q.correctAnswer;
    return {
      id: q.id,
      questionText: q.questionText,
      audioUrl: q.audioUrl,
      options: opts,
      correctAnswer,
      difficulty: q.difficulty,
      level,
    };
  });
  const sessionId = randomUUID();
  void logIslamicEvent({
    userId,
    eventType: "start_quiz",
    categoryId,
    sessionId,
    metadata: { questionCount: questions.length, level },
  });
  res.json({ categoryId, sessionId, questions, level });
});

router.post("/islamic/answer", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const userId = req.session.teacherId!;
  const { questionId, categoryId, isCorrect, timeSeconds, currentStreak, isFirstQuestion, sessionId } = req.body || {};
  if (typeof questionId !== "number" || typeof categoryId !== "number") {
    res.status(400).json({ message: "بيانات ناقصة" });
    return;
  }
  let stars = 0;
  if (isCorrect) stars = timeSeconds < 5 ? 3 : timeSeconds < 15 ? 2 : 1;
  let pointsAwarded = 0;
  if (isCorrect) pointsAwarded = timeSeconds < 5 ? 10 : 5;
  if (isCorrect && (currentStreak ?? 0) > 0 && (currentStreak + 1) % 5 === 0) pointsAwarded += 20;

  let dailyBonus = 0;
  if (isFirstQuestion) {
    try {
      const [existing] = await db.select().from(islamicDailyVisitsTable).where(and(eq(islamicDailyVisitsTable.userId, userId), eq(islamicDailyVisitsTable.visitDate, todayDate()))).limit(1);
      if (!existing) {
        await db.insert(islamicDailyVisitsTable).values({ userId, visitDate: todayDate(), pointsAwarded: 10 });
        dailyBonus = 10;
      }
    } catch {}
  }

  await db
    .insert(islamicProgressTable)
    .values({
      userId,
      categoryId,
      questionsAnswered: 1,
      starsEarned: stars,
      totalPoints: pointsAwarded + dailyBonus,
      correctAnswers: isCorrect ? 1 : 0,
      bestStreak: isCorrect ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [islamicProgressTable.userId, islamicProgressTable.categoryId],
      set: {
        questionsAnswered: sql`${islamicProgressTable.questionsAnswered} + 1`,
        starsEarned: sql`${islamicProgressTable.starsEarned} + ${stars}`,
        totalPoints: sql`${islamicProgressTable.totalPoints} + ${pointsAwarded + dailyBonus}`,
        correctAnswers: sql`${islamicProgressTable.correctAnswers} + ${isCorrect ? 1 : 0}`,
        bestStreak: sql`GREATEST(${islamicProgressTable.bestStreak}, ${(currentStreak ?? 0) + (isCorrect ? 1 : 0)})`,
        lastUpdated: new Date(),
      },
    });

  void logIslamicEvent({
    userId,
    eventType: "answer_question",
    questionId: typeof questionId === "number" ? questionId : null,
    categoryId: typeof categoryId === "number" ? categoryId : null,
    sessionId: typeof sessionId === "string" ? sessionId : null,
    timeTaken: typeof timeSeconds === "number" ? timeSeconds : null,
    isCorrect: typeof isCorrect === "boolean" ? isCorrect : null,
    metadata: { stars, pointsAwarded, dailyBonus, currentStreak: currentStreak ?? 0 },
  });

  res.json({ stars, pointsAwarded, dailyBonus });
});

router.post("/islamic/complete", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const userId = req.session.teacherId!;
  const { categoryId, totalQuestions, allCorrect, certificateEligible, totalStars, sessionId, durationSeconds, level } = req.body || {};
  if (!categoryId) {
    res.status(400).json({ message: "categoryId مطلوب" });
    return;
  }
  const currentLevel = typeof level === "number" ? level : 1;
  const completionBonus = 50 * currentLevel;
  // allCorrect = user got every question right (used for level unlock)
  // certificateEligible = allCorrect AND user chose certificate mode (used for cert issuance)
  // Fall back to allCorrect for old clients that don't send certificateEligible
  const eligibleForCert = certificateEligible !== undefined ? !!certificateEligible : !!allCorrect;

  // Check if next level exists and should be unlocked
  let nextLevel: number | null = null;
  if (allCorrect) {
    const [nextLvlRow] = await db
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(islamicQuestionsTable)
      .where(and(eq(islamicQuestionsTable.categoryId, categoryId), eq(islamicQuestionsTable.questionLevel, currentLevel + 1)));
    if ((nextLvlRow?.n ?? 0) > 0) {
      nextLevel = currentLevel + 1;
    }
  }

  await db
    .insert(islamicProgressTable)
    .values({ userId, categoryId, totalPoints: completionBonus, completedAt: new Date(), maxUnlockedLevel: nextLevel ?? currentLevel })
    .onConflictDoUpdate({
      target: [islamicProgressTable.userId, islamicProgressTable.categoryId],
      set: {
        totalPoints: sql`${islamicProgressTable.totalPoints} + ${completionBonus}`,
        completedAt: new Date(),
        certificatesEarned: eligibleForCert ? sql`${islamicProgressTable.certificatesEarned} + 1` : islamicProgressTable.certificatesEarned,
        maxUnlockedLevel: nextLevel
          ? sql`GREATEST(${islamicProgressTable.maxUnlockedLevel}, ${nextLevel})`
          : islamicProgressTable.maxUnlockedLevel,
        lastUpdated: new Date(),
      },
    });

  let certificate: Record<string, unknown> | null = null;
  const certFlags = await getGeneralFlags();
  if (eligibleForCert && certFlags.showCertificates) {
    const [teacher] = await db.select({ name: teachersTable.name }).from(teachersTable).where(eq(teachersTable.id, userId)).limit(1);
    const [cat] = await db.select({ name: islamicCategoriesTable.name }).from(islamicCategoriesTable).where(eq(islamicCategoriesTable.id, categoryId)).limit(1);
    const serial = `HSD-${Date.now()}-${randomInt(1000, 9999)}`;
    const [row] = await db
      .insert(islamicCertificatesTable)
      .values({
        serial,
        userId,
        userName: teacher?.name || "—",
        categoryId,
        categoryName: cat?.name || "—",
        totalQuestions: totalQuestions || 0,
        totalStars: totalStars || 0,
      })
      .returning();
    certificate = row;
  }
  void logIslamicEvent({
    userId,
    eventType: "complete_quiz",
    categoryId: typeof categoryId === "number" ? categoryId : null,
    sessionId: typeof sessionId === "string" ? sessionId : null,
    timeTaken: typeof durationSeconds === "number" ? durationSeconds : null,
    metadata: {
      totalQuestions: totalQuestions ?? 0,
      totalStars: totalStars ?? 0,
      allCorrect: !!allCorrect,
      level: currentLevel,
      certificateSerial: certificate?.serial ?? null,
    },
  });
  res.json({ completionBonus, certificate, nextLevel, unlockedNextLevel: nextLevel !== null });
});

router.post("/islamic/events/exit", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(204).end();
    return;
  }
  const { categoryId, sessionId, questionsAnswered, durationSeconds } = req.body || {};
  void logIslamicEvent({
    userId: req.session.teacherId,
    eventType: "exit_quiz",
    categoryId: typeof categoryId === "number" ? categoryId : null,
    sessionId: typeof sessionId === "string" ? sessionId : null,
    timeTaken: typeof durationSeconds === "number" ? durationSeconds : null,
    metadata: { questionsAnswered: questionsAnswered ?? 0 },
  });
  res.status(204).end();
});

router.get("/islamic/events/user/:id", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const targetId = parseInt(req.params.id);
  if (!Number.isFinite(targetId)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const requesterId = req.session.teacherId!;
  if (targetId !== requesterId) {
    const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, requesterId)).limit(1);
    if (!t?.isAdmin) {
      res.status(403).json({ message: "لا تملك صلاحية الاطلاع على أحداث هذا المستخدم" });
      return;
    }
  }
  const limit = Math.min(500, Math.max(1, parseInt((req.query.limit as string) || "100")));
  const eventType = (req.query.eventType as string) || null;
  const rows = await db
    .select()
    .from(islamicEventsTable)
    .where(
      eventType
        ? and(eq(islamicEventsTable.userId, targetId), eq(islamicEventsTable.eventType, eventType))
        : eq(islamicEventsTable.userId, targetId),
    )
    .orderBy(desc(islamicEventsTable.createdAt))
    .limit(limit);
  res.json(rows);
});

router.get("/islamic/my-progress", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const userId = req.session.teacherId!;
  const today = todayDate();
  const [vis] = await db.select().from(islamicDailyVisitsTable).where(and(eq(islamicDailyVisitsTable.userId, userId), eq(islamicDailyVisitsTable.visitDate, today))).limit(1);
  const dailyBonusAwarded = !!vis;
  const visits = await db.select().from(islamicDailyVisitsTable).where(eq(islamicDailyVisitsTable.userId, userId)).orderBy(desc(islamicDailyVisitsTable.visitDate));
  let streak = 0;
  const set = new Set(visits.map((v) => v.visitDate));
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (set.has(ds)) streak++;
    else if (i === 0 && !set.has(ds)) {
      const dy = new Date();
      dy.setDate(dy.getDate() - 1);
      if (set.has(dy.toISOString().slice(0, 10))) continue;
      else break;
    } else break;
  }

  const progresses = await db.select().from(islamicProgressTable).where(eq(islamicProgressTable.userId, userId));
  const totalPoints = progresses.reduce((a, p) => a + p.totalPoints, 0);
  const certs = await db.select().from(islamicCertificatesTable).where(eq(islamicCertificatesTable.userId, userId)).orderBy(desc(islamicCertificatesTable.issuedAt));

  res.json({ totalPoints, streak, dailyBonusAwarded, progresses, certificates: certs, todayBonus: dailyBonusAwarded ? 0 : 10 });
});

router.get("/islamic/certificates/verify/:serial", async (req, res) => {
  const [cert] = await db.select().from(islamicCertificatesTable).where(eq(islamicCertificatesTable.serial, req.params.serial)).limit(1);
  if (!cert) {
    res.status(404).json({ message: "الشهادة غير موجودة" });
    return;
  }
  res.json({
    serial: cert.serial,
    userName: cert.userName,
    categoryName: cert.categoryName,
    totalQuestions: cert.totalQuestions,
    totalStars: cert.totalStars,
    issuedAt: cert.issuedAt,
  });
});

router.get("/islamic/leaderboard", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const period = (req.query.period as string) || "all";
  const board = (req.query.board as string) || "points";
  const userId = req.session.teacherId!;

  let sinceDate: Date | null = null;
  const now = new Date();
  if (period === "daily") sinceDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === "weekly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    sinceDate = d;
  } else if (period === "monthly") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    sinceDate = d;
  }

  if (board === "active") {
    const sinceCond = sinceDate ? sql` AND p.last_updated >= ${sinceDate}` : sql``;
    const rows = await db.execute(sql`
      SELECT t.id, t.name,
        SUM(p.questions_answered)::int AS questions,
        COUNT(DISTINCT p.category_id)::int AS sessions,
        MAX(p.last_updated) AS last_active
      FROM islamic_progress p
      JOIN teachers t ON t.id = p.user_id
      WHERE 1=1 ${sinceCond}
      GROUP BY t.id, t.name
      ORDER BY questions DESC
      LIMIT 10
    `);
    const me = await db.execute(sql`
      SELECT t.id, t.name,
        SUM(p.questions_answered)::int AS questions
      FROM islamic_progress p
      JOIN teachers t ON t.id = p.user_id
      WHERE p.user_id = ${userId} ${sinceCond}
      GROUP BY t.id, t.name
    `);
    res.json({ top: rows.rows, me: me.rows[0] || null });
    return;
  }

  const sinceCond = sinceDate ? sql` AND p.last_updated >= ${sinceDate}` : sql``;
  const rows = await db.execute(sql`
    SELECT t.id, t.name,
      SUM(p.total_points)::int AS points,
      (SELECT COUNT(*) FROM islamic_certificates ic WHERE ic.user_id = t.id)::int AS certs
    FROM islamic_progress p
    JOIN teachers t ON t.id = p.user_id
    WHERE 1=1 ${sinceCond}
    GROUP BY t.id, t.name
    ORDER BY points DESC
    LIMIT 10
  `);
  const me = await db.execute(sql`
    SELECT t.id, t.name,
      SUM(p.total_points)::int AS points
    FROM islamic_progress p
    JOIN teachers t ON t.id = p.user_id
    WHERE p.user_id = ${userId} ${sinceCond}
    GROUP BY t.id, t.name
  `);
  res.json({ top: rows.rows, me: me.rows[0] || null });
});

const EXPERTS_MIN_HARD = 5;

router.post("/islamic/challenges", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const { categoryId, expertsOnly } = req.body || {};
  if (!categoryId) {
    res.status(400).json({ message: "categoryId مطلوب" });
    return;
  }
  const baseWhere = expertsOnly
    ? and(eq(islamicQuestionsTable.categoryId, categoryId), eq(islamicQuestionsTable.difficulty, "hard"))
    : eq(islamicQuestionsTable.categoryId, categoryId);
  const all = await db.select({ id: islamicQuestionsTable.id }).from(islamicQuestionsTable).where(baseWhere);
  if (all.length === 0) {
    res.status(400).json({
      message: expertsOnly
        ? `لا توجد أسئلة صعبة في هذه الفئة. وضع تحدّي الخبراء يتطلب ${EXPERTS_MIN_HARD} أسئلة صعبة على الأقل.`
        : "لا أسئلة في هذه الفئة",
    });
    return;
  }
  if (expertsOnly && all.length < EXPERTS_MIN_HARD) {
    res.status(400).json({
      message: `يحتاج وضع تحدّي الخبراء إلى ${EXPERTS_MIN_HARD} أسئلة صعبة على الأقل في الفئة (المتوفر: ${all.length}).`,
    });
    return;
  }
  const picked = [...all].sort(() => Math.random() - 0.5).slice(0, Math.min(10, all.length)).map((q) => q.id);
  const pin = String(randomInt(100000, 999999));
  const [row] = await db
    .insert(islamicChallengesTable)
    .values({ pin, creatorId: req.session.teacherId!, categoryId, questionIds: JSON.stringify(picked), status: "waiting" })
    .returning();
  res.status(201).json(row);
});

router.get("/islamic/challenges/by-pin/:pin", async (req, res) => {
  const [c] = await db.select().from(islamicChallengesTable).where(eq(islamicChallengesTable.pin, req.params.pin)).limit(1);
  if (!c) {
    res.status(404).json({ message: "التحدي غير موجود" });
    return;
  }
  const ids = JSON.parse(c.questionIds) as number[];
  const qs = await db.select().from(islamicQuestionsTable).where(inArray(islamicQuestionsTable.id, ids));
  const ordered = ids.map((id) => qs.find((q) => q.id === id)).filter(Boolean) as typeof qs;
  res.json({ challenge: c, questions: ordered.map((q) => ({ id: q.id, questionText: q.questionText, audioUrl: q.audioUrl, options: [q.optionA, q.optionB, q.optionC, q.optionD].sort(() => Math.random() - 0.5), correctAnswer: q.correctAnswer })) });
});

router.post("/islamic/challenges/:id/submit", async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.session?.teacherId ?? null;
  const { score, timeMs, correct, role } = req.body || {};
  const [c] = await db.select().from(islamicChallengesTable).where(eq(islamicChallengesTable.id, id)).limit(1);
  if (!c) {
    res.status(404).json({ message: "التحدي غير موجود" });
    return;
  }
  const numScore = Math.max(0, Math.min(1000, Number(score) || 0));
  const numTime = Math.max(0, Math.min(60 * 60 * 1000, Number(timeMs) || 0));
  const numCorrect = Math.max(0, Math.min(50, Number(correct) || 0));
  if (role === "creator") {
    if (!userId || c.creatorId !== userId) {
      res.status(403).json({ message: "لست منشئ هذا التحدي" });
      return;
    }
  }
  if (role === "opponent" && c.opponentId && userId && c.opponentId !== userId) {
    res.status(403).json({ message: "هذا التحدي تم تسجيل خصم آخر فيه" });
    return;
  }
  if (c.status === "completed") {
    res.status(400).json({ message: "التحدي مكتمل" });
    return;
  }
  const patch: Record<string, unknown> = {};
  if (role === "creator") {
    patch.creatorScore = numScore;
    patch.creatorTimeMs = numTime;
    patch.creatorCorrect = numCorrect;
  } else {
    if (userId && userId === c.creatorId) {
      res.status(400).json({ message: "لا يمكنك لعب تحدي من إنشائك كخصم" });
      return;
    }
    if (userId) patch.opponentId = userId;
    patch.opponentName = (req.body?.opponentName as string) || null;
    patch.opponentScore = numScore;
    patch.opponentTimeMs = numTime;
    patch.opponentCorrect = numCorrect;
    patch.status = "completed";
    patch.completedAt = new Date();
    if ((c.creatorScore || 0) > numScore) patch.winnerId = c.creatorId;
    else if (numScore > (c.creatorScore || 0)) patch.winnerId = userId ?? null;
    else patch.winnerId = (c.creatorTimeMs || 0) <= numTime ? c.creatorId : (userId ?? null);
  }
  const [updated] = await db.update(islamicChallengesTable).set(patch).where(eq(islamicChallengesTable.id, id)).returning();
  res.json(updated);
});

router.get("/islamic/challenges/my", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const userId = req.session.teacherId!;
  const rows = await db
    .select()
    .from(islamicChallengesTable)
    .where(sql`${islamicChallengesTable.creatorId} = ${userId} OR ${islamicChallengesTable.opponentId} = ${userId}`)
    .orderBy(desc(islamicChallengesTable.createdAt));
  res.json(rows);
});

router.get("/islamic/admin/teachers-search", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const q = (req.query.q as string) || "";
  const rows = await db
    .select({ id: teachersTable.id, name: teachersTable.name, email: teachersTable.email })
    .from(teachersTable)
    .where(sql`(${teachersTable.name} ILIKE ${"%" + q + "%"} OR ${teachersTable.email} ILIKE ${"%" + q + "%"})`)
    .limit(10);
  res.json(rows);
});

/* ── Teacher-scoped CRUD (organizer/teacher own content) ────────
   Teachers/organizers can create, edit, and delete their own
   sections, categories, and questions. All writes are scoped by
   ownerId so a teacher can only touch their own rows.            */

const sectionInputSchema = z.object({
  name: z.string().trim().min(1, "اسم القسم مطلوب").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  isVisible: z.boolean().optional(),
  order: z.number().int().min(0).max(9999).optional(),
});

const categoryInputSchema = z.object({
  sectionId: z.number().int().positive(),
  name: z.string().trim().min(1, "اسم الفئة مطلوب").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  level: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
  isVisible: z.boolean().optional(),
  order: z.number().int().min(0).max(9999).optional(),
});

const questionInputSchema = z
  .object({
    categoryId: z.number().int().positive(),
    questionText: z.string().trim().min(3, "نص السؤال قصير جداً").max(2000),
    audioUrl: z.string().trim().max(1000).optional().nullable(),
    options: z.array(z.string().trim().min(1, "الخيار لا يمكن أن يكون فارغاً").max(500)).length(4, "يجب توفير 4 خيارات"),
    correctIndex: z.number().int().min(0).max(3),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  })
  .refine((v) => new Set(v.options.map((o) => o.trim())).size === 4, {
    message: "يجب أن تكون الخيارات الأربعة فريدة",
    path: ["options"],
  });

function sendZodError(res: Response, err: z.ZodError): void {
  const first = err.issues[0];
  res.status(400).json({ message: first?.message || "بيانات غير صالحة", issues: err.issues });
}

async function ensureTeacherOwnsSection(sectionId: number, teacherId: number): Promise<boolean> {
  const [s] = await db.select({ ownerId: islamicSectionsTable.ownerId }).from(islamicSectionsTable).where(eq(islamicSectionsTable.id, sectionId)).limit(1);
  return !!s && s.ownerId === teacherId;
}

async function ensureTeacherOwnsCategory(categoryId: number, teacherId: number): Promise<boolean> {
  const [c] = await db.select({ ownerId: islamicCategoriesTable.ownerId }).from(islamicCategoriesTable).where(eq(islamicCategoriesTable.id, categoryId)).limit(1);
  return !!c && c.ownerId === teacherId;
}

async function ensureTeacherOwnsQuestion(questionId: number, teacherId: number): Promise<boolean> {
  const [row] = await db
    .select({ ownerId: islamicCategoriesTable.ownerId })
    .from(islamicQuestionsTable)
    .leftJoin(islamicCategoriesTable, eq(islamicQuestionsTable.categoryId, islamicCategoriesTable.id))
    .where(eq(islamicQuestionsTable.id, questionId))
    .limit(1);
  return !!row && row.ownerId === teacherId;
}

router.get("/islamic/teacher/my-content", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const sections = await db
    .select()
    .from(islamicSectionsTable)
    .where(eq(islamicSectionsTable.ownerId, teacherId))
    .orderBy(islamicSectionsTable.order, islamicSectionsTable.id);
  const cats = sections.length
    ? await db
        .select()
        .from(islamicCategoriesTable)
        .where(eq(islamicCategoriesTable.ownerId, teacherId))
        .orderBy(islamicCategoriesTable.order, islamicCategoriesTable.id)
    : [];
  const counts = cats.length
    ? await db
        .select({ categoryId: islamicQuestionsTable.categoryId, n: sql<number>`COUNT(*)::int` })
        .from(islamicQuestionsTable)
        .where(inArray(islamicQuestionsTable.categoryId, cats.map((c) => c.id)))
        .groupBy(islamicQuestionsTable.categoryId)
    : [];
  const countMap = new Map(counts.map((c) => [c.categoryId, c.n]));
  res.json(
    sections.map((s) => ({
      ...s,
      categories: cats
        .filter((c) => c.sectionId === s.id)
        .map((c) => ({ ...c, questionCount: countMap.get(c.id) || 0 })),
    })),
  );
});

router.post("/islamic/teacher/sections", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const parsed = sectionInputSchema.safeParse(req.body);
  if (!parsed.success) { sendZodError(res, parsed.error); return; }
  const teacherId = req.session.teacherId!;
  const v = parsed.data;
  const [row] = await db
    .insert(islamicSectionsTable)
    .values({
      name: v.name,
      description: v.description || null,
      isVisible: v.isVisible ?? true,
      order: v.order ?? 999,
      ownerId: teacherId,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/islamic/teacher/sections/:id", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ message: "id غير صالح" }); return; }
  if (!(await ensureTeacherOwnsSection(id, teacherId))) {
    res.status(403).json({ message: "ليس لديك صلاحية تعديل هذا القسم" });
    return;
  }
  const parsed = sectionInputSchema.partial().safeParse(req.body);
  if (!parsed.success) { sendZodError(res, parsed.error); return; }
  const [row] = await db.update(islamicSectionsTable).set(parsed.data).where(eq(islamicSectionsTable.id, id)).returning();
  res.json(row);
});

router.delete("/islamic/teacher/sections/:id", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const id = parseInt(req.params.id);
  if (!(await ensureTeacherOwnsSection(id, teacherId))) {
    res.status(403).json({ message: "ليس لديك صلاحية حذف هذا القسم" });
    return;
  }
  await db.delete(islamicSectionsTable).where(eq(islamicSectionsTable.id, id));
  res.json({ ok: true });
});

router.post("/islamic/teacher/categories", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const parsed = categoryInputSchema.safeParse(req.body);
  if (!parsed.success) { sendZodError(res, parsed.error); return; }
  const teacherId = req.session.teacherId!;
  if (!(await ensureTeacherOwnsSection(parsed.data.sectionId, teacherId))) {
    res.status(403).json({ message: "لا يمكن إضافة فئة في قسم لا تملكه" });
    return;
  }
  const v = parsed.data;
  const [row] = await db
    .insert(islamicCategoriesTable)
    .values({
      sectionId: v.sectionId,
      name: v.name,
      description: v.description || null,
      level: v.level || "mixed",
      isVisible: v.isVisible ?? true,
      order: v.order ?? 0,
      ownerId: teacherId,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/islamic/teacher/categories/:id", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const id = parseInt(req.params.id);
  if (!(await ensureTeacherOwnsCategory(id, teacherId))) {
    res.status(403).json({ message: "ليس لديك صلاحية تعديل هذه الفئة" });
    return;
  }
  const parsed = categoryInputSchema.partial().safeParse(req.body);
  if (!parsed.success) { sendZodError(res, parsed.error); return; }
  const patch = { ...parsed.data };
  // Prevent moving a category into a section the teacher doesn't own.
  if (patch.sectionId && !(await ensureTeacherOwnsSection(patch.sectionId, teacherId))) {
    res.status(403).json({ message: "لا يمكن نقل الفئة إلى قسم لا تملكه" });
    return;
  }
  const [row] = await db.update(islamicCategoriesTable).set(patch).where(eq(islamicCategoriesTable.id, id)).returning();
  res.json(row);
});

router.delete("/islamic/teacher/categories/:id", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const id = parseInt(req.params.id);
  if (!(await ensureTeacherOwnsCategory(id, teacherId))) {
    res.status(403).json({ message: "ليس لديك صلاحية حذف هذه الفئة" });
    return;
  }
  await db.delete(islamicCategoriesTable).where(eq(islamicCategoriesTable.id, id));
  res.json({ ok: true });
});

router.post("/islamic/teacher/questions", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const parsed = questionInputSchema.safeParse(req.body);
  if (!parsed.success) { sendZodError(res, parsed.error); return; }
  const teacherId = req.session.teacherId!;
  if (!(await ensureTeacherOwnsCategory(parsed.data.categoryId, teacherId))) {
    res.status(403).json({ message: "لا يمكن إضافة سؤال في فئة لا تملكها" });
    return;
  }
  const v = parsed.data;
  const [row] = await db
    .insert(islamicQuestionsTable)
    .values({
      categoryId: v.categoryId,
      questionText: v.questionText,
      audioUrl: v.audioUrl || null,
      optionA: v.options[0],
      optionB: v.options[1],
      optionC: v.options[2],
      optionD: v.options[3],
      correctAnswer: v.options[v.correctIndex],
      difficulty: v.difficulty || "medium",
      createdBy: teacherId,
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/islamic/teacher/questions/:id", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const id = parseInt(req.params.id);
  if (!(await ensureTeacherOwnsQuestion(id, teacherId))) {
    res.status(403).json({ message: "ليس لديك صلاحية تعديل هذا السؤال" });
    return;
  }
  const parsed = questionInputSchema.safeParse(req.body);
  if (!parsed.success) { sendZodError(res, parsed.error); return; }
  const v = parsed.data;
  if (!(await ensureTeacherOwnsCategory(v.categoryId, teacherId))) {
    res.status(403).json({ message: "لا يمكن نقل السؤال إلى فئة لا تملكها" });
    return;
  }
  const [row] = await db
    .update(islamicQuestionsTable)
    .set({
      categoryId: v.categoryId,
      questionText: v.questionText,
      audioUrl: v.audioUrl || null,
      optionA: v.options[0],
      optionB: v.options[1],
      optionC: v.options[2],
      optionD: v.options[3],
      correctAnswer: v.options[v.correctIndex],
      difficulty: v.difficulty || "medium",
    })
    .where(eq(islamicQuestionsTable.id, id))
    .returning();
  res.json(row);
});

router.delete("/islamic/teacher/questions/:id", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const id = parseInt(req.params.id);
  if (!(await ensureTeacherOwnsQuestion(id, teacherId))) {
    res.status(403).json({ message: "ليس لديك صلاحية حذف هذا السؤال" });
    return;
  }
  await db.delete(islamicQuestionsTable).where(eq(islamicQuestionsTable.id, id));
  res.json({ ok: true });
});

router.get("/islamic/teacher/categories/:id/questions", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const teacherId = req.session.teacherId!;
  const id = parseInt(req.params.id);
  if (!(await ensureTeacherOwnsCategory(id, teacherId))) {
    res.status(403).json({ message: "ليست فئتك" });
    return;
  }
  const rows = await db.select().from(islamicQuestionsTable).where(eq(islamicQuestionsTable.categoryId, id)).orderBy(islamicQuestionsTable.id);
  res.json(rows);
});

router.post("/islamic/teacher/uploads/audio-url", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const { name, size, contentType } = req.body || {};
  if (!name || !size || !contentType) {
    res.status(400).json({ message: "بيانات الملف ناقصة" });
    return;
  }
  if (!(contentType.startsWith("audio/") || contentType === "application/octet-stream")) {
    res.status(400).json({ message: "النوع غير مدعوم" });
    return;
  }
  if (size > 25 * 1024 * 1024) {
    res.status(400).json({ message: "الحجم يتجاوز 25MB" });
    return;
  }
  try {
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err) {
    req.log.error({ err }, "Failed to get teacher audio upload URL");
    res.status(500).json({ message: "فشل توليد رابط الرفع" });
  }
});


/* ── Teacher bulk import (xlsx/csv/docx) ────────────────────────
   Accepts a file with rows of (section, category, question, 4 options,
   correct answer, optional difficulty/audio). Creates new sections/
   categories under the teacher's ownership. Reuses any matching
   teacher-owned section/category (by name). Validates each row using
   the same rules as the manual editor; reports per-row errors.    */
router.post("/islamic/teacher/import", upload.single("file"), async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  if (!req.file) {
    res.status(400).json({ message: "لم يتم رفع ملف" });
    return;
  }
  const teacherId = req.session.teacherId!;
  try {
    let rows: Array<Record<string, string>> = [];
    const lower = req.file.originalname.toLowerCase();
    if (lower.endsWith(".docx")) {
      const out = await mammoth.extractRawText({ buffer: req.file.buffer });
      const lines = out.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const header = lines[0]?.split("\t");
      if (!header || header.length < 2) {
        res.status(400).json({ message: "ملف Word فارغ أو لا يحتوي جدولاً مفصولاً بـ Tab" });
        return;
      }
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split("\t");
        const obj: Record<string, string> = {};
        header.forEach((h, j) => (obj[h.trim()] = (cells[j] || "").trim()));
        rows.push(obj);
      }
    } else {
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        res.status(400).json({ message: "الملف فارغ" });
        return;
      }
      rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
    }

    if (rows.length === 0) {
      res.status(400).json({ message: "لا توجد صفوف في الملف" });
      return;
    }

    // Pre-load this teacher's sections/categories for name matching.
    const ownedSections = await db
      .select()
      .from(islamicSectionsTable)
      .where(eq(islamicSectionsTable.ownerId, teacherId));
    const ownedCats = await db
      .select()
      .from(islamicCategoriesTable)
      .where(eq(islamicCategoriesTable.ownerId, teacherId));
    const sectionsMap = new Map<string, number>();
    ownedSections.forEach((s) => sectionsMap.set(s.name.trim(), s.id));
    const categoriesMap = new Map<string, number>();
    ownedCats.forEach((c) => categoriesMap.set(`${c.sectionId}::${c.name.trim()}`, c.id));

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    function pick(row: Record<string, string>, keys: string[]): string {
      for (const k of keys) {
        const v = row[k];
        if (typeof v === "string" && v.trim()) return v.trim();
        if (typeof v === "number") return String(v);
      }
      return "";
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-based with header row
      const sectionName = pick(row, ["section_name", "القسم", "section"]);
      const categoryName = pick(row, ["category_name", "الفئة", "category"]);
      const text = pick(row, ["نص السؤال", "question", "question_text", "السؤال"]);
      const a = pick(row, ["الخيار أ", "option_a", "A", "أ"]);
      const b = pick(row, ["الخيار ب", "option_b", "B", "ب"]);
      const c = pick(row, ["الخيار ج", "option_c", "C", "ج"]);
      const d = pick(row, ["الخيار د", "option_d", "D", "د"]);
      const correctRaw = pick(row, ["الإجابة الصحيحة", "correct_answer", "correct"]);
      const difficultyRaw = (pick(row, ["الصعوبة", "difficulty"]) || "medium").toLowerCase();
      const audioUrl = pick(row, ["audio_url", "صوت"]) || null;

      if (!sectionName || !categoryName || !text || !a || !b || !c || !d || !correctRaw) {
        skipped++;
        errors.push({ row: rowNum, message: "حقول إلزامية ناقصة" });
        continue;
      }

      // Resolve correct answer label (A/B/C/D / أ-د) or full text match.
      let normalizedCorrect = correctRaw;
      if (["أ", "a", "A", "1"].includes(correctRaw)) normalizedCorrect = a;
      else if (["ب", "b", "B", "2"].includes(correctRaw)) normalizedCorrect = b;
      else if (["ج", "c", "C", "3"].includes(correctRaw)) normalizedCorrect = c;
      else if (["د", "d", "D", "4"].includes(correctRaw)) normalizedCorrect = d;

      const options = [a, b, c, d];
      const correctIndex = options.indexOf(normalizedCorrect);
      const difficulty = ["easy", "medium", "hard"].includes(difficultyRaw) ? difficultyRaw : "medium";

      const parsed = questionInputSchema.safeParse({
        categoryId: 1, // placeholder; we resolve below before insert
        questionText: text,
        audioUrl,
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : 0,
        difficulty,
      });
      if (!parsed.success) {
        skipped++;
        errors.push({ row: rowNum, message: parsed.error.issues[0]?.message || "بيانات غير صالحة" });
        continue;
      }
      if (correctIndex < 0) {
        skipped++;
        errors.push({ row: rowNum, message: "الإجابة الصحيحة لا تطابق أياً من الخيارات" });
        continue;
      }

      // Resolve / create section under this teacher.
      let sectionId = sectionsMap.get(sectionName);
      if (!sectionId) {
        const [s] = await db
          .insert(islamicSectionsTable)
          .values({ name: sectionName, ownerId: teacherId, isVisible: true, order: 999 })
          .returning();
        sectionId = s.id;
        sectionsMap.set(sectionName, sectionId);
      }
      const catKey = `${sectionId}::${categoryName}`;
      let categoryId = categoriesMap.get(catKey);
      if (!categoryId) {
        const [cat] = await db
          .insert(islamicCategoriesTable)
          .values({ sectionId, name: categoryName, ownerId: teacherId, isVisible: true, order: 0, level: "mixed" })
          .returning();
        categoryId = cat.id;
        categoriesMap.set(catKey, categoryId);
      }

      await db.insert(islamicQuestionsTable).values({
        categoryId,
        questionText: parsed.data.questionText,
        audioUrl: parsed.data.audioUrl || null,
        optionA: parsed.data.options[0],
        optionB: parsed.data.options[1],
        optionC: parsed.data.options[2],
        optionD: parsed.data.options[3],
        correctAnswer: parsed.data.options[parsed.data.correctIndex],
        difficulty: parsed.data.difficulty || "medium",
        createdBy: teacherId,
      });
      imported++;
    }

    res.json({ imported, skipped, errors, total: rows.length });
  } catch (err) {
    req.log.error({ err }, "Teacher islamic import failed");
    res.status(500).json({ message: "فشل الاستيراد" });
  }
});

/* ── Teacher private categories ─────────────────────────────────
   Teachers can create their own categories (ownerId = teacherId).
   Admin-created (ownerId = null) categories appear to everyone.
   Teacher-created ones appear only to that teacher.           */

router.post("/islamic/my-categories", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const teacherId = req.session.teacherId!;
  const { name, description, sectionName } = req.body || {};
  if (!name?.trim()) {
    res.status(400).json({ message: "اسم الفئة مطلوب" });
    return;
  }
  try {
    const sName = (sectionName || "فئاتي الخاصة").trim().slice(0, 100);
    let section = (
      await db.select().from(islamicSectionsTable)
        .where(and(eq(islamicSectionsTable.name, sName), eq(islamicSectionsTable.ownerId as any, teacherId)))
        .limit(1)
    )[0];
    if (!section) {
      [section] = await db.insert(islamicSectionsTable)
        .values({ name: sName, description: "فئاتي الخاصة", isVisible: true, order: 999, ownerId: teacherId })
        .returning();
    }
    const [cat] = await db.insert(islamicCategoriesTable)
      .values({ sectionId: section.id, name: name.trim().slice(0, 100), description: description?.trim() || null, level: "mixed", isVisible: true, order: 0, ownerId: teacherId })
      .returning();
    res.status(201).json({ ...cat, sectionName: section.name });
  } catch (err) {
    req.log.error({ err }, "my-categories create error");
    res.status(500).json({ message: "خطأ في الإنشاء" });
  }
});

router.delete("/islamic/my-categories/:id", async (req, res) => {
  if (!req.session.teacherId) { res.status(401).json({ message: "يجب تسجيل الدخول" }); return; }
  const id = parseInt(req.params.id);
  const [cat] = await db.select().from(islamicCategoriesTable).where(eq(islamicCategoriesTable.id, id)).limit(1);
  if (!cat) { res.status(404).json({ message: "الفئة غير موجودة" }); return; }
  if (cat.ownerId !== req.session.teacherId) { res.status(403).json({ message: "ليست فئتك" }); return; }
  await db.delete(islamicCategoriesTable).where(eq(islamicCategoriesTable.id, id));
  res.json({ ok: true });
});

/* ── TOURNAMENTS ─────────────────────────────────────────────── */

function genTournamentPin(): string {
  return "T" + String(randomInt(10000, 99999));
}

function genTeamToken(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

router.post("/islamic/tournaments", async (req, res) => {
  if (!(await requireAccess(req, res))) return;
  const { name, categoryId, teamNames, expertsOnly } = req.body || {};
  if (!name?.trim()) { res.status(400).json({ message: "اسم البطولة مطلوب" }); return; }
  if (!categoryId) { res.status(400).json({ message: "الفئة مطلوبة" }); return; }
  if (!Array.isArray(teamNames) || teamNames.length < 2) { res.status(400).json({ message: "يجب إضافة فريقين على الأقل" }); return; }
  if (teamNames.length > 16) { res.status(400).json({ message: "الحد الأقصى 16 فريقاً" }); return; }

  const cleanTeams: string[] = teamNames.map((t: unknown) => String(t || "").trim().slice(0, 60)).filter(Boolean);
  if (cleanTeams.length < 2) { res.status(400).json({ message: "أسماء الفرق غير صالحة" }); return; }

  const baseWhere = expertsOnly
    ? and(eq(islamicQuestionsTable.categoryId, categoryId), eq(islamicQuestionsTable.difficulty, "hard"))
    : eq(islamicQuestionsTable.categoryId, categoryId);
  const all = await db.select({ id: islamicQuestionsTable.id }).from(islamicQuestionsTable).where(baseWhere);
  if (all.length === 0) {
    res.status(400).json({
      message: expertsOnly
        ? `لا توجد أسئلة صعبة في هذه الفئة. وضع تحدّي الخبراء يتطلب ${EXPERTS_MIN_HARD} أسئلة صعبة على الأقل.`
        : "لا أسئلة في هذه الفئة",
    });
    return;
  }
  if (expertsOnly && all.length < EXPERTS_MIN_HARD) {
    res.status(400).json({
      message: `يحتاج وضع تحدّي الخبراء إلى ${EXPERTS_MIN_HARD} أسئلة صعبة على الأقل في الفئة (المتوفر: ${all.length}).`,
    });
    return;
  }

  const picked = [...all].sort(() => Math.random() - 0.5).slice(0, Math.min(10, all.length)).map((q) => q.id);
  const pin = genTournamentPin();

  const tokens: Record<string, string> = {};
  const scores: Record<string, { score: number; correct: number; timeMs: number; status: "waiting" | "playing" | "done" }> = {};
  for (const team of cleanTeams) {
    tokens[team] = genTeamToken();
    scores[team] = { score: 0, correct: 0, timeMs: 0, status: "waiting" };
  }

  const [row] = await db.insert(islamicTournamentsTable).values({
    pin,
    name: name.trim().slice(0, 120),
    categoryId,
    creatorId: req.session.teacherId!,
    teamNames: cleanTeams,
    teamTokens: tokens,
    teamScores: scores,
    questionIds: JSON.stringify(picked),
    status: "active",
  }).returning();

  res.status(201).json({ ...row, teamLinks: Object.fromEntries(cleanTeams.map((t) => [t, tokens[t]])) });
});

router.get("/islamic/tournaments/:pin", async (req, res) => {
  const [row] = await db.select().from(islamicTournamentsTable).where(eq(islamicTournamentsTable.pin, req.params.pin)).limit(1);
  if (!row) { res.status(404).json({ message: "البطولة غير موجودة" }); return; }

  const ids = JSON.parse(row.questionIds) as number[];
  const qs = await db.select().from(islamicQuestionsTable).where(inArray(islamicQuestionsTable.id, ids));
  const ordered = ids.map((id) => qs.find((q) => q.id === id)).filter(Boolean) as typeof qs;

  res.json({
    id: row.id,
    pin: row.pin,
    name: row.name,
    categoryId: row.categoryId,
    teamNames: row.teamNames,
    teamScores: row.teamScores,
    status: row.status,
    questions: ordered.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      audioUrl: q.audioUrl,
      options: [q.optionA, q.optionB, q.optionC, q.optionD].sort(() => Math.random() - 0.5),
      correctAnswer: q.correctAnswer,
    })),
  });
});

router.post("/islamic/tournaments/:pin/submit", async (req, res) => {
  const { teamToken, score, timeMs, correct } = req.body || {};
  if (!teamToken) { res.status(400).json({ message: "teamToken مطلوب" }); return; }

  const [row] = await db.select().from(islamicTournamentsTable).where(eq(islamicTournamentsTable.pin, req.params.pin)).limit(1);
  if (!row) { res.status(404).json({ message: "البطولة غير موجودة" }); return; }

  const teamName = Object.entries(row.teamTokens as Record<string, string>).find(([, tok]) => tok === teamToken)?.[0];
  if (!teamName) { res.status(403).json({ message: "رمز الفريق غير صحيح" }); return; }

  type TeamScore = { score: number; correct: number; timeMs: number; status: "waiting" | "playing" | "done" };
  const existingScores = (row.teamScores || {}) as Record<string, TeamScore>;
  const updated: Record<string, TeamScore> = {
    ...existingScores,
    [teamName]: { score: Number(score) || 0, correct: Number(correct) || 0, timeMs: Number(timeMs) || 0, status: "done" },
  };

  const allDone = row.teamNames.every((t: string) => updated[t]?.status === "done");
  await db.update(islamicTournamentsTable).set({ teamScores: updated, status: allDone ? "completed" : "active" }).where(eq(islamicTournamentsTable.id, row.id));

  const [final] = await db.select().from(islamicTournamentsTable).where(eq(islamicTournamentsTable.id, row.id)).limit(1);
  res.json({ teamName, teamScores: final.teamScores, status: final.status });
});

export default router;
