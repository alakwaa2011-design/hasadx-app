import { Router } from "express";
import { db, scrambleScoresTable, wordSetsTable, studentAccountsTable } from "@workspace/db";
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

router.get("/scramble-scores", async (req, res) => {
  try {
    const difficulty = typeof req.query.difficulty === "string" ? req.query.difficulty : undefined;
    const scores = await (difficulty
      ? db.select().from(scrambleScoresTable).where(eq(scrambleScoresTable.difficulty, difficulty)).orderBy(desc(scrambleScoresTable.score)).limit(20)
      : db.select().from(scrambleScoresTable).orderBy(desc(scrambleScoresTable.score)).limit(20));
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

router.post("/scramble-scores", async (req, res) => {
  try {
    const { name, score, level, streak, timeMs, difficulty } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Valid name required" });
    }
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 999999) {
      return res.status(400).json({ error: "Invalid score" });
    }
    const validDiffs = ["easy", "medium", "hard", "challenge"];
    const safeDiff = validDiffs.includes(difficulty) ? difficulty : "medium";
    const safeLevel = typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.min(level, 100)) : 0;
    const safeStreak = typeof streak === "number" && Number.isFinite(streak) ? Math.max(0, Math.min(streak, 500)) : 0;
    const safeTimeMs = typeof timeMs === "number" && Number.isFinite(timeMs) ? Math.max(0, Math.min(timeMs, 3600000)) : 0;
    const studentAccountId = req.session.studentAccountId || null;
    const [row] = await db
      .insert(scrambleScoresTable)
      .values({
        name: name.trim().slice(0, 30),
        score: Math.floor(score),
        level: Math.floor(safeLevel),
        streak: Math.floor(safeStreak),
        timeMs: Math.floor(safeTimeMs),
        difficulty: safeDiff,
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

router.get("/word-sets/:pin", async (req, res) => {
  try {
    const { pin } = req.params;
    const [set] = await db
      .select()
      .from(wordSetsTable)
      .where(eq(wordSetsTable.pin, pin))
      .limit(1);
    if (!set) return res.status(404).json({ error: "Word set not found" });
    res.json(set);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch word set" });
  }
});

router.post("/word-sets", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const { title, gradeLevel, words } = req.body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "Title required" });
    }
    if (!Array.isArray(words) || words.length < 3) {
      return res.status(400).json({ error: "At least 3 words required" });
    }
    if (words.length > 30) {
      return res.status(400).json({ error: "Maximum 30 words allowed" });
    }
    for (const w of words) {
      if (typeof w !== "object" || w === null) {
        return res.status(400).json({ error: "Each word must be an object" });
      }
      const entry = w as Record<string, unknown>;
      if (typeof entry.word !== "string" || entry.word.trim().length === 0 || entry.word.length > 50) {
        return res.status(400).json({ error: "Each word must be a non-empty string (max 50 chars)" });
      }
      if (entry.hint !== undefined && (typeof entry.hint !== "string" || entry.hint.length > 200)) {
        return res.status(400).json({ error: "Hint must be a string (max 200 chars)" });
      }
      if (entry.question !== undefined && (typeof entry.question !== "string" || entry.question.length > 200)) {
        return res.status(400).json({ error: "Question must be a string (max 200 chars)" });
      }
    }
    let pin = "";
    let row: typeof wordSetsTable.$inferSelect | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      pin = String(Math.floor(100000 + Math.random() * 900000));
      try {
        [row] = await db
          .insert(wordSetsTable)
          .values({
            title: title.trim().slice(0, 100),
            gradeLevel: gradeLevel || null,
            words,
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
    res.status(500).json({ error: "Failed to create word set" });
  }
});

router.put("/word-sets/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(wordSetsTable).where(eq(wordSetsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Word set not found" });
    if (existing.creatorId !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const { title, gradeLevel, words } = req.body;
    const updates: Record<string, unknown> = {};
    if (title && typeof title === "string") updates.title = title.trim().slice(0, 100);
    if (gradeLevel !== undefined) updates.gradeLevel = gradeLevel || null;
    if (Array.isArray(words)) {
      if (words.length < 3) return res.status(400).json({ error: "At least 3 words required" });
      if (words.length > 30) return res.status(400).json({ error: "Maximum 30 words allowed" });
      updates.words = words;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
    const [row] = await db
      .update(wordSetsTable)
      .set(updates)
      .where(eq(wordSetsTable.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update word set" });
  }
});

router.delete("/word-sets/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const [existing] = await db.select().from(wordSetsTable).where(eq(wordSetsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Word set not found" });
    if (existing.creatorId !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    await db.delete(wordSetsTable).where(eq(wordSetsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete word set" });
  }
});

router.get("/word-sets", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const sets = await db
      .select()
      .from(wordSetsTable)
      .where(eq(wordSetsTable.creatorId, req.session.teacherId))
      .orderBy(desc(wordSetsTable.createdAt))
      .limit(50);
    res.json(sets);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch word sets" });
  }
});

export default router;
