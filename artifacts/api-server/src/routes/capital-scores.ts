import { Router } from "express";
import { db, capitalScoresTable, studentAccountsTable } from "@workspace/db";
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

router.get("/api/capital-scores", async (_req, res) => {
  try {
    const scores = await db
      .select()
      .from(capitalScoresTable)
      .orderBy(desc(capitalScoresTable.score))
      .limit(50);
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

router.post("/api/capital-scores", async (req, res) => {
  try {
    const { name, score, correct, total, tier, timeMs } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Valid name required" });
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 999999) {
      return res.status(400).json({ error: "Invalid score" });
    }
    const safeCorrect = typeof correct === "number" && Number.isFinite(correct) ? Math.max(0, Math.min(correct, 500)) : 0;
    const safeTotal = typeof total === "number" && Number.isFinite(total) ? Math.max(0, Math.min(total, 500)) : 0;
    const safeTier = typeof tier === "number" && Number.isFinite(tier) ? Math.max(1, Math.min(tier, 4)) : 1;
    const safeTimeMs = typeof timeMs === "number" && Number.isFinite(timeMs) ? Math.max(0, Math.min(timeMs, 7200000)) : 0;
    const studentAccountId = req.session.studentAccountId || null;
    const [row] = await db
      .insert(capitalScoresTable)
      .values({
        name: name.trim().slice(0, 30),
        score: Math.floor(score),
        correct: Math.floor(safeCorrect),
        total: Math.floor(safeTotal),
        tier: Math.floor(safeTier),
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
