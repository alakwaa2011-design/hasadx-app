import { Router } from "express";
import { db, stroopScoresTable, stroopSetsTable, studentAccountsTable } from "@workspace/db";
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

router.get("/stroop-scores", async (_req, res) => {
  try {
    const scores = await db
      .select()
      .from(stroopScoresTable)
      .orderBy(desc(stroopScoresTable.score))
      .limit(50);
    res.json(scores);
  } catch {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

router.post("/stroop-scores", async (req, res) => {
  try {
    const { name, score, level, correctCount, wrongCount, timeMs } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Valid name required" });
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 999999) {
      return res.status(400).json({ error: "Invalid score" });
    }
    const safeLevel = typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.min(level, 100)) : 0;
    const safeCorrect = typeof correctCount === "number" && Number.isFinite(correctCount) ? Math.max(0, Math.min(correctCount, 9999)) : 0;
    const safeWrong = typeof wrongCount === "number" && Number.isFinite(wrongCount) ? Math.max(0, Math.min(wrongCount, 9999)) : 0;
    const safeTimeMs = typeof timeMs === "number" && Number.isFinite(timeMs) ? Math.max(0, Math.min(timeMs, 3600000)) : 0;
    const studentAccountId = req.session.studentAccountId || null;
    const [row] = await db
      .insert(stroopScoresTable)
      .values({
        name: name.trim().slice(0, 30),
        score: Math.floor(score),
        level: Math.floor(safeLevel),
        correctCount: Math.floor(safeCorrect),
        wrongCount: Math.floor(safeWrong),
        timeMs: Math.floor(safeTimeMs),
        studentAccountId,
      })
      .returning();
    if (studentAccountId) {
      await updateStudentStats(studentAccountId, Math.floor(score));
    }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to save score" });
  }
});

router.get("/stroop-sets/:pin", async (req, res) => {
  try {
    const { pin } = req.params;
    const [set] = await db
      .select()
      .from(stroopSetsTable)
      .where(eq(stroopSetsTable.pin, pin))
      .limit(1);
    if (!set) return res.status(404).json({ error: "Stroop set not found" });
    res.json(set);
  } catch {
    res.status(500).json({ error: "Failed to fetch stroop set" });
  }
});

router.get("/stroop-sets", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const sets = await db
      .select()
      .from(stroopSetsTable)
      .where(eq(stroopSetsTable.creatorId, req.session.teacherId))
      .orderBy(desc(stroopSetsTable.createdAt))
      .limit(50);
    res.json(sets);
  } catch {
    res.status(500).json({ error: "Failed to fetch stroop sets" });
  }
});

router.post("/stroop-sets", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { title, gradeLevel, items } = req.body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "Title required" });
    }
    if (!Array.isArray(items) || items.length < 4) {
      return res.status(400).json({ error: "At least 4 items required" });
    }
    if (items.length > 30) {
      return res.status(400).json({ error: "Maximum 30 items allowed" });
    }
    for (const item of items) {
      if (typeof item !== "object" || item === null) {
        return res.status(400).json({ error: "Each item must be an object" });
      }
      const entry = item as Record<string, unknown>;
      if (typeof entry.word !== "string" || entry.word.trim().length === 0 || entry.word.length > 30) {
        return res.status(400).json({ error: "Each item word must be a non-empty string (max 30 chars)" });
      }
      if (typeof entry.color !== "string" || entry.color.trim().length === 0 || entry.color.length > 20) {
        return res.status(400).json({ error: "Each item color must be a non-empty string (max 20 chars)" });
      }
      if (entry.options !== undefined) {
        if (!Array.isArray(entry.options)) {
          return res.status(400).json({ error: "Item options must be an array" });
        }
        if (entry.options.length < 2 || entry.options.length > 8) {
          return res.status(400).json({ error: "Item options must contain 2-8 colors" });
        }
        for (const opt of entry.options) {
          if (typeof opt !== "string" || opt.length > 20) {
            return res.status(400).json({ error: "Each option must be a color string (max 20 chars)" });
          }
        }
        if (!(entry.options as string[]).includes(entry.color as string)) {
          return res.status(400).json({ error: "Correct color must be included in options" });
        }
      }
    }
    let pin = "";
    let row: typeof stroopSetsTable.$inferSelect | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      try {
        [row] = await db
          .insert(stroopSetsTable)
          .values({
            title: title.trim().slice(0, 100),
            gradeLevel: gradeLevel || null,
            items,
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
  } catch {
    res.status(500).json({ error: "Failed to create stroop set" });
  }
});

router.put("/stroop-sets/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(stroopSetsTable).where(eq(stroopSetsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Stroop set not found" });
    if (existing.creatorId !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const { title, gradeLevel, items } = req.body;
    const updates: Record<string, unknown> = {};
    if (title && typeof title === "string") updates.title = title.trim().slice(0, 100);
    if (gradeLevel !== undefined) updates.gradeLevel = gradeLevel || null;
    if (Array.isArray(items)) {
      if (items.length < 4) return res.status(400).json({ error: "At least 4 items required" });
      if (items.length > 30) return res.status(400).json({ error: "Maximum 30 items allowed" });
      for (const item of items) {
        if (typeof item !== "object" || item === null) {
          return res.status(400).json({ error: "Each item must be an object" });
        }
        const entry = item as Record<string, unknown>;
        if (typeof entry.word !== "string" || entry.word.trim().length === 0 || entry.word.length > 30) {
          return res.status(400).json({ error: "Each item word must be a non-empty string (max 30 chars)" });
        }
        if (typeof entry.color !== "string" || entry.color.trim().length === 0 || entry.color.length > 20) {
          return res.status(400).json({ error: "Each item color must be a non-empty string (max 20 chars)" });
        }
        if (entry.options !== undefined) {
          if (!Array.isArray(entry.options)) {
            return res.status(400).json({ error: "Item options must be an array" });
          }
          if (entry.options.length < 2 || entry.options.length > 8) {
            return res.status(400).json({ error: "Item options must contain 2-8 colors" });
          }
          for (const opt of entry.options) {
            if (typeof opt !== "string" || opt.length > 20) {
              return res.status(400).json({ error: "Each option must be a color string (max 20 chars)" });
            }
          }
          if (!(entry.options as string[]).includes(entry.color as string)) {
            return res.status(400).json({ error: "Correct color must be included in options" });
          }
        }
      }
      updates.items = items;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
    const [row] = await db
      .update(stroopSetsTable)
      .set(updates)
      .where(eq(stroopSetsTable.id, id))
      .returning();
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update stroop set" });
  }
});

router.delete("/stroop-sets/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(stroopSetsTable).where(eq(stroopSetsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Stroop set not found" });
    if (existing.creatorId !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    await db.delete(stroopSetsTable).where(eq(stroopSetsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete stroop set" });
  }
});

export default router;
