import { Router, type IRouter } from "express";
import { db, arenaCategoriesTable, arenaActivitiesTable, arenaQuestionReportsTable, teachersTable } from "@workspace/db";
import { eq, or, and, isNull, asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

async function isAdmin(teacherId: number): Promise<boolean> {
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId));
  return !!t?.isAdmin;
}

const CategoryBody = z.object({
  name: z.string().min(1).max(120),
  emoji: z.string().max(8).default("🎯"),
  coverImageUrl: z.string().nullable().optional(),
  coverColor: z.string().default("#1E4D35"),
  coverGradient: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  parentId: z.number().int().nullable().optional(),
  isPublic: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const ActivityBody = z.object({
  categoryId: z.number().int().positive(),
  type: z.enum(["text", "image", "video", "memory", "sin-jeem", "categorize", "logo"]).default("text"),
  difficulty: z.number().int().refine(v => [200, 400, 600, 800].includes(v)).default(200),
  question: z.string().min(1),
  answer: z.string().min(1),
  hint: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  isPublic: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

// GET /arena-content/categories — public + own (unauthenticated: public only)
router.get("/arena-content/categories", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    const where = teacherId
      ? or(eq(arenaCategoriesTable.isPublic, true), eq(arenaCategoriesTable.teacherId, teacherId))
      : eq(arenaCategoriesTable.isPublic, true);
    const rows = await db
      .select()
      .from(arenaCategoriesTable)
      .where(where)
      .orderBy(asc(arenaCategoriesTable.sortOrder), asc(arenaCategoriesTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list arena categories");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/arena-content/categories", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const body = CategoryBody.parse(req.body);
    const admin = await isAdmin(teacherId);
    const isPublic = admin ? body.isPublic : false;
    const [row] = await db.insert(arenaCategoriesTable).values({
      ...body,
      isPublic,
      teacherId: isPublic ? null : teacherId,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create arena category");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.put("/arena-content/categories/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(arenaCategoriesTable).where(eq(arenaCategoriesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const admin = await isAdmin(teacherId);
    const ownsOrAdmin = existing.teacherId === teacherId || admin;
    if (!ownsOrAdmin) return res.status(403).json({ error: "Forbidden" });
    const body = CategoryBody.partial().parse(req.body);
    const isPublic = admin ? (body.isPublic ?? existing.isPublic) : existing.isPublic;
    const [row] = await db.update(arenaCategoriesTable).set({
      ...body,
      isPublic,
      teacherId: isPublic ? null : (existing.teacherId ?? teacherId),
      updatedAt: new Date(),
    }).where(eq(arenaCategoriesTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update arena category");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/arena-content/categories/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(arenaCategoriesTable).where(eq(arenaCategoriesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const admin = await isAdmin(teacherId);
    const ownsOrAdmin = existing.teacherId === teacherId || admin;
    if (!ownsOrAdmin) return res.status(403).json({ error: "Forbidden" });
    await db.delete(arenaCategoriesTable).where(eq(arenaCategoriesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete arena category");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /arena-content/activities?categoryIds=1,2,3 (unauthenticated: public only)
router.get("/arena-content/activities", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    const idsRaw = String(req.query.categoryIds ?? "").trim();
    let cond = teacherId
      ? or(eq(arenaActivitiesTable.isPublic, true), eq(arenaActivitiesTable.teacherId, teacherId))
      : eq(arenaActivitiesTable.isPublic, true);
    if (idsRaw) {
      const ids = idsRaw.split(",").map(Number).filter(n => Number.isFinite(n));
      if (ids.length > 0) {
        cond = and(cond, inArray(arenaActivitiesTable.categoryId, ids))!;
      }
    }
    const rows = await db.select().from(arenaActivitiesTable)
      .where(cond)
      .orderBy(asc(arenaActivitiesTable.sortOrder), asc(arenaActivitiesTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list arena activities");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/arena-content/activities", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const body = ActivityBody.parse(req.body);
    const [cat] = await db.select().from(arenaCategoriesTable).where(eq(arenaCategoriesTable.id, body.categoryId));
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const admin = await isAdmin(teacherId);
    const ownsCat = cat.teacherId === teacherId || admin;
    if (!ownsCat) return res.status(403).json({ error: "Forbidden" });
    const isPublic = admin && cat.isPublic;
    const [row] = await db.insert(arenaActivitiesTable).values({
      ...body,
      payload: (body.payload as any) ?? null,
      isPublic,
      teacherId: isPublic ? null : teacherId,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create arena activity");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.put("/arena-content/activities/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(arenaActivitiesTable).where(eq(arenaActivitiesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const admin = await isAdmin(teacherId);
    const owns = existing.teacherId === teacherId || admin;
    if (!owns) return res.status(403).json({ error: "Forbidden" });
    const body = ActivityBody.partial().parse(req.body);
    const [row] = await db.update(arenaActivitiesTable).set({
      ...body,
      payload: body.payload === undefined ? existing.payload : (body.payload as any),
    }).where(eq(arenaActivitiesTable.id, id)).returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update arena activity");
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/arena-content/activities/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const id = Number(req.params.id);
    const [existing] = await db.select().from(arenaActivitiesTable).where(eq(arenaActivitiesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    const admin = await isAdmin(teacherId);
    const owns = existing.teacherId === teacherId || admin;
    if (!owns) return res.status(403).json({ error: "Forbidden" });
    await db.delete(arenaActivitiesTable).where(eq(arenaActivitiesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete arena activity");
    res.status(500).json({ error: "Server error" });
  }
});

/* ───────────────────── Question reports ───────────────────── */

const ReportBody = z.object({
  categoryId: z.number().int().nullable().optional(),
  activityId: z.number().int().nullable().optional(),
  subCategoryId: z.string().max(120).nullable().optional(),
  difficulty: z.number().int().nullable().optional(),
  questionType: z.string().max(40).nullable().optional(),
  questionText: z.string().min(1).max(2000),
  currentAnswer: z.string().min(1).max(2000),
  suggestedAnswer: z.string().max(2000).nullable().optional(),
  note: z.string().min(1).max(2000),
});

// POST /arena-content/reports — anyone (auth optional) can report
router.post("/arena-content/reports", async (req, res) => {
  try {
    const body = ReportBody.parse(req.body);
    const teacherId = (req.session as any)?.teacherId ?? null;
    let reporterName: string | null = null;
    if (teacherId) {
      const [t] = await db.select({ name: teachersTable.name }).from(teachersTable).where(eq(teachersTable.id, teacherId));
      reporterName = t?.name ?? null;
    }
    const [row] = await db.insert(arenaQuestionReportsTable).values({
      categoryId: body.categoryId ?? null,
      activityId: body.activityId ?? null,
      subCategoryId: body.subCategoryId ?? null,
      difficulty: body.difficulty ?? null,
      questionType: body.questionType ?? null,
      questionText: body.questionText,
      currentAnswer: body.currentAnswer,
      suggestedAnswer: body.suggestedAnswer ?? null,
      note: body.note,
      reporterTeacherId: teacherId,
      reporterName,
      status: "open",
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "create arena report");
    res.status(400).json({ error: "Invalid data" });
  }
});

// GET /arena-content/reports — admin only
router.get("/arena-content/reports", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "Forbidden" });
    const status = String(req.query.status ?? "").trim();
    const where = status && ["open", "resolved", "dismissed"].includes(status)
      ? eq(arenaQuestionReportsTable.status, status)
      : undefined;
    const q = db.select().from(arenaQuestionReportsTable);
    const rows = await (where ? q.where(where) : q).orderBy(desc(arenaQuestionReportsTable.createdAt)).limit(500);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list arena reports");
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /arena-content/reports/:id — admin only — update status / admin note
router.patch("/arena-content/reports/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "Forbidden" });
    const id = Number(req.params.id);
    const patch = z.object({
      status: z.enum(["open", "resolved", "dismissed"]).optional(),
      adminNote: z.string().max(2000).nullable().optional(),
    }).parse(req.body);
    const setData: any = {};
    if (patch.status !== undefined) {
      setData.status = patch.status;
      if (patch.status === "resolved" || patch.status === "dismissed") {
        setData.resolvedByTeacherId = teacherId;
        setData.resolvedAt = new Date();
      } else {
        setData.resolvedByTeacherId = null;
        setData.resolvedAt = null;
      }
    }
    if (patch.adminNote !== undefined) setData.adminNote = patch.adminNote;
    const [row] = await db.update(arenaQuestionReportsTable).set(setData).where(eq(arenaQuestionReportsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "update arena report");
    res.status(400).json({ error: "Invalid data" });
  }
});

// DELETE /arena-content/reports/:id — admin only
router.delete("/arena-content/reports/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isAdmin(teacherId))) return res.status(403).json({ error: "Forbidden" });
    const id = Number(req.params.id);
    await db.delete(arenaQuestionReportsTable).where(eq(arenaQuestionReportsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete arena report");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
