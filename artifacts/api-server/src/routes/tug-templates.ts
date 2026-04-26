import { Router, type IRouter } from "express";
import { db, tugTemplatesTable, teachersTable } from "@workspace/db";
import { eq, desc, and, or, ne } from "drizzle-orm";

const router: IRouter = Router();

router.get("/tug-templates", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rows = await db
      .select({
        id: tugTemplatesTable.id,
        teacherId: tugTemplatesTable.teacherId,
        title: tugTemplatesTable.title,
        questions: tugTemplatesTable.questions,
        duration: tugTemplatesTable.duration,
        isShared: tugTemplatesTable.isShared,
        createdAt: tugTemplatesTable.createdAt,
        updatedAt: tugTemplatesTable.updatedAt,
        ownerName: teachersTable.name,
        ownerIsAdmin: teachersTable.isAdmin,
      })
      .from(tugTemplatesTable)
      .leftJoin(teachersTable, eq(tugTemplatesTable.teacherId, teachersTable.id))
      .where(
        or(
          eq(tugTemplatesTable.teacherId, teacherId),
          and(
            eq(tugTemplatesTable.isShared, true),
            eq(teachersTable.isAdmin, true),
            ne(tugTemplatesTable.teacherId, teacherId),
          ),
        ),
      )
      .orderBy(desc(tugTemplatesTable.updatedAt))
      .limit(100);

    const templates = rows.map((r) => ({
      id: r.id,
      title: r.title,
      questions: r.questions,
      duration: r.duration,
      isShared: r.isShared,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      isOwn: r.teacherId === teacherId,
      ownerName: r.ownerName,
      fromAdmin: !!r.ownerIsAdmin && r.teacherId !== teacherId,
    }));

    res.json(templates);
  } catch {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/tug-templates", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { title, questions, duration } = req.body;
  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: "Missing title or questions" });
    return;
  }

  try {
    const [template] = await db
      .insert(tugTemplatesTable)
      .values({ teacherId, title, questions, duration: duration || 20 })
      .returning();

    res.json(template);
  } catch {
    res.status(500).json({ error: "Failed to save template" });
  }
});

router.delete("/tug-templates/:id", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(tugTemplatesTable)
      .where(eq(tugTemplatesTable.id, id))
      .limit(1);

    if (!existing || existing.teacherId !== teacherId) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    await db.delete(tugTemplatesTable).where(eq(tugTemplatesTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
