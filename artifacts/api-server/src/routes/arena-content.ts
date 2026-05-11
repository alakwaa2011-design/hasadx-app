import { Router, type IRouter } from "express";
import { db, arenaCategoriesTable, arenaActivitiesTable, teachersTable } from "@workspace/db";
import { eq, or, and, isNull, asc, inArray } from "drizzle-orm";
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
  difficulty: z.number().int().refine(v => [200, 400, 600].includes(v)).default(200),
  question: z.string().min(1),
  answer: z.string().min(1),
  hint: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  payload: z.unknown().nullable().optional(),
  isPublic: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

// GET /arena-content/categories — admin sees all; others see public + own
router.get("/arena-content/categories", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const admin = await isAdmin(teacherId);
    const rows = admin
      ? await db.select().from(arenaCategoriesTable).orderBy(asc(arenaCategoriesTable.sortOrder), asc(arenaCategoriesTable.id))
      : await db.select().from(arenaCategoriesTable)
          .where(or(eq(arenaCategoriesTable.isPublic, true), eq(arenaCategoriesTable.teacherId, teacherId)))
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

// GET /arena-content/activities?categoryIds=1,2,3 — admin sees all
router.get("/arena-content/activities", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
    const admin = await isAdmin(teacherId);
    const idsRaw = String(req.query.categoryIds ?? "").trim();
    const ids = idsRaw ? idsRaw.split(",").map(Number).filter(n => Number.isFinite(n)) : [];
    let cond: ReturnType<typeof and> | ReturnType<typeof or> | undefined;
    if (!admin) {
      cond = or(eq(arenaActivitiesTable.isPublic, true), eq(arenaActivitiesTable.teacherId, teacherId));
    }
    if (ids.length > 0) {
      const idFilter = inArray(arenaActivitiesTable.categoryId, ids);
      cond = cond ? and(cond, idFilter)! : idFilter;
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

export default router;
