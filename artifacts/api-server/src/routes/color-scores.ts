import { Router } from "express";
import { db, colorScoresTable, studentAccountsTable } from "@workspace/db";
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

router.get("/color-scores", async (_req, res) => {
  try {
    const scores = await db
      .select()
      .from(colorScoresTable)
      .orderBy(desc(colorScoresTable.score))
      .limit(50);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

router.post("/color-scores", async (req, res) => {
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
      .insert(colorScoresTable)
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

export default router;
