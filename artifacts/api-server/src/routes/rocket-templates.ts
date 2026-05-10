import { Router, type IRouter } from "express";
import { db, rocketTemplatesTable, teachersTable, studentsTable } from "@workspace/db";
import { eq, desc, and, or, ne } from "drizzle-orm";

const router: IRouter = Router();

router.get("/rocket-templates", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rows = await db
      .select({
        id: rocketTemplatesTable.id,
        teacherId: rocketTemplatesTable.teacherId,
        title: rocketTemplatesTable.title,
        questions: rocketTemplatesTable.questions,
        duration: rocketTemplatesTable.duration,
        isShared: rocketTemplatesTable.isShared,
        createdAt: rocketTemplatesTable.createdAt,
        updatedAt: rocketTemplatesTable.updatedAt,
        ownerName: teachersTable.name,
        ownerIsAdmin: teachersTable.isAdmin,
      })
      .from(rocketTemplatesTable)
      .leftJoin(teachersTable, eq(rocketTemplatesTable.teacherId, teachersTable.id))
      .where(
        or(
          eq(rocketTemplatesTable.teacherId, teacherId),
          and(
            eq(rocketTemplatesTable.isShared, true),
            eq(teachersTable.isAdmin, true),
            ne(rocketTemplatesTable.teacherId, teacherId),
          ),
        ),
      )
      .orderBy(desc(rocketTemplatesTable.updatedAt))
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

router.post("/rocket-templates", async (req, res) => {
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
      .insert(rocketTemplatesTable)
      .values({ teacherId, title, questions, duration: duration || 20 })
      .returning();
    res.json(template);
  } catch {
    res.status(500).json({ error: "Failed to save template" });
  }
});

router.delete("/rocket-templates/:id", async (req, res) => {
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
      .from(rocketTemplatesTable)
      .where(eq(rocketTemplatesTable.id, id))
      .limit(1);

    if (!existing || existing.teacherId !== teacherId) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    await db.delete(rocketTemplatesTable).where(eq(rocketTemplatesTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete template" });
  }
});

router.get("/rocket-game-info/:pin", async (req, res) => {
  const { getRocketGame } = await import("../game/rocket-handlers");
  const game = getRocketGame(req.params.pin);
  if (!game) {
    res.json({ exists: false });
    return;
  }
  const info: {
    exists: true;
    targetClass: string | null;
    state: string;
    students?: { name: string }[];
  } = {
    exists: true,
    targetClass: game.targetClass || null,
    state: game.state,
  };
  if (game.targetClass && game.teacherId) {
    try {
      const students = await db
        .select({ name: studentsTable.name })
        .from(studentsTable)
        .where(
          and(
            eq(studentsTable.teacherId, game.teacherId),
            eq(studentsTable.gradeLevel, game.targetClass),
          ),
        );
      info.students = students.map((s) => ({ name: s.name }));
    } catch {
      info.students = [];
    }
  }
  res.json(info);
});

export default router;
