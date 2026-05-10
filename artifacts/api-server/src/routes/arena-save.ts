import { Router, type IRouter } from "express";
import { db, arenaSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/arena/save", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [row] = await db
      .select()
      .from(arenaSavesTable)
      .where(eq(arenaSavesTable.teacherId, teacherId))
      .limit(1);
    if (!row) return res.status(404).json({ error: "No saved game" });
    res.json({ state: row.state, savedAt: row.savedAt });
  } catch (err) {
    req.log.error({ err }, "arena save get");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/arena/save", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
  const { state } = req.body as { state?: unknown };
  if (!state || typeof state !== "object") return res.status(400).json({ error: "Missing state" });
  try {
    await db
      .insert(arenaSavesTable)
      .values({ teacherId, state, savedAt: new Date() })
      .onConflictDoUpdate({
        target: arenaSavesTable.teacherId,
        set: { state, savedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "arena save put");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/arena/save", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) return res.status(401).json({ error: "Unauthorized" });
  try {
    await db.delete(arenaSavesTable).where(eq(arenaSavesTable.teacherId, teacherId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "arena save delete");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
