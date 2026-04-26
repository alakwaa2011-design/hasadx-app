import { Router, type IRouter } from "express";
import { db, categoriesTable, assignmentsTable, questionBankTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { z } from "zod";

const CreateCategoryBody = z.object({
  name: z.string().min(1).max(100),
  color: z.string().default("teal"),
  isPublic: z.boolean().default(false),
});

const UpdateCategoryBody = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const rows = await db
      .select()
      .from(categoriesTable)
      .where(or(eq(categoriesTable.teacherId, teacherId), eq(categoriesTable.isPublic, true)))
      .orderBy(categoriesTable.createdAt);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const body = CreateCategoryBody.parse(req.body);
    const [cat] = await db.insert(categoriesTable).values({ ...body, teacherId }).returning();
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ error: "Invalid data" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    const body = UpdateCategoryBody.parse(req.body);

    const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.teacherId !== teacherId) return res.status(403).json({ error: "Forbidden" });

    const [updated] = await db.update(categoriesTable).set(body).where(eq(categoriesTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Invalid data" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ error: "Unauthorized" });

    const id = Number(req.params.id);
    const [existing] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.teacherId !== teacherId) return res.status(403).json({ error: "Forbidden" });

    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
