import { Router } from "express";
import { db, memoryScoresTable, memoryCardSetsTable, studentAccountsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";

async function updateStudentStats(studentAccountId: number, score: number) {
  await db.update(studentAccountsTable)
    .set({
      totalScore: sql`${studentAccountsTable.totalScore} + ${score}`,
      gamesPlayed: sql`${studentAccountsTable.gamesPlayed} + 1`,
    })
    .where(eq(studentAccountsTable.id, studentAccountId));
}

const router = Router();

router.get("/memory-scores", async (_req, res) => {
  try {
    const scores = await db
      .select()
      .from(memoryScoresTable)
      .orderBy(desc(memoryScoresTable.score))
      .limit(10);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

router.post("/memory-scores", async (req, res) => {
  try {
    const { name, score, level, timeMs } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Valid name required" });
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 999999) {
      return res.status(400).json({ error: "Invalid score" });
    }
    const safeLevel = typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.min(level, 100)) : 0;
    const safeTimeMs = typeof timeMs === "number" && Number.isFinite(timeMs) ? Math.max(0, Math.min(timeMs, 3600000)) : 0;
    const studentAccountId = req.session.studentAccountId || null;
    const [row] = await db
      .insert(memoryScoresTable)
      .values({
        name: name.trim().slice(0, 30),
        score: Math.floor(score),
        level: Math.floor(safeLevel),
        timeMs: Math.floor(safeTimeMs),
        studentAccountId,
      })
      .returning();
    if (studentAccountId) {
      await updateStudentStats(studentAccountId, Math.floor(score));
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to save score" });
  }
});

router.get("/memory-card-sets/:pin", async (req, res) => {
  try {
    const { pin } = req.params;
    const [set] = await db
      .select()
      .from(memoryCardSetsTable)
      .where(eq(memoryCardSetsTable.pin, pin))
      .limit(1);
    if (!set) return res.status(404).json({ error: "Card set not found" });
    res.json(set);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch card set" });
  }
});

router.post("/memory-card-sets", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { title, gradeLevel, pairs } = req.body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "Title required" });
    }
    if (!Array.isArray(pairs) || pairs.length < 2) {
      return res.status(400).json({ error: "At least 2 pairs required" });
    }
    if (pairs.length > 18) {
      return res.status(400).json({ error: "Maximum 18 pairs allowed" });
    }
    let pin = "";
    let row;
    for (let attempt = 0; attempt < 5; attempt++) {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      try {
        [row] = await db
          .insert(memoryCardSetsTable)
          .values({
            title: title.trim().slice(0, 100),
            gradeLevel: gradeLevel || null,
            pairs,
            pin,
            creatorId: req.session.teacherId,
          })
          .returning();
        break;
      } catch (e: unknown) {
        if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505" && attempt < 4) continue;
        throw e;
      }
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to create card set" });
  }
});

router.put("/memory-card-sets/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(memoryCardSetsTable).where(eq(memoryCardSetsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Card set not found" });
    if (existing.creatorId !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized to edit this card set" });
    }
    const { title, gradeLevel, pairs } = req.body;
    const updates: Record<string, unknown> = {};
    if (title && typeof title === "string") updates.title = title.trim().slice(0, 100);
    if (gradeLevel !== undefined) updates.gradeLevel = gradeLevel || null;
    if (Array.isArray(pairs)) {
      if (pairs.length < 2) return res.status(400).json({ error: "At least 2 pairs required" });
      if (pairs.length > 18) return res.status(400).json({ error: "Maximum 18 pairs allowed" });
      updates.pairs = pairs;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
    const [row] = await db
      .update(memoryCardSetsTable)
      .set(updates)
      .where(eq(memoryCardSetsTable.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update card set" });
  }
});

router.delete("/memory-card-sets/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(memoryCardSetsTable).where(eq(memoryCardSetsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Card set not found" });
    if (existing.creatorId !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized to delete this card set" });
    }
    await db.delete(memoryCardSetsTable).where(eq(memoryCardSetsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete card set" });
  }
});

router.get("/memory-card-sets", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const sets = await db
      .select()
      .from(memoryCardSetsTable)
      .where(eq(memoryCardSetsTable.creatorId, req.session.teacherId))
      .orderBy(desc(memoryCardSetsTable.createdAt))
      .limit(50);
    res.json(sets);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch card sets" });
  }
});

export default router;
