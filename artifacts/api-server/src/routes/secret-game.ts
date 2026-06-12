import { Router, type IRouter } from "express";
import { db, secretGameCategoriesTable, secretGameItemsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { secretGameRooms, verifyRevealToken, generateRevealToken } from "../game/secret-game-handlers";

const router: IRouter = Router();

router.get("/secret-game/categories", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(secretGameCategoriesTable)
      .where(eq(secretGameCategoriesTable.isActive, true))
      .orderBy(secretGameCategoriesTable.sortOrder);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list secret-game categories");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/items/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    if (!Number.isFinite(categoryId)) return res.status(400).json({ error: "Invalid category" });
    const rows = await db
      .select()
      .from(secretGameItemsTable)
      .where(eq(secretGameItemsTable.categoryId, categoryId));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list secret-game items");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/items/random/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const count = Math.min(Number(req.query.count ?? 2), 20);
    if (!Number.isFinite(categoryId)) return res.status(400).json({ error: "Invalid category" });
    const rows = await db
      .select()
      .from(secretGameItemsTable)
      .where(eq(secretGameItemsTable.categoryId, categoryId))
      .orderBy(sql`RANDOM()`)
      .limit(count);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "random secret-game items");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/secret-game/reveal-token", (req, res) => {
  try {
    const pin = (req.body?.pin as string | undefined)?.toUpperCase();
    const team = req.body?.team as string | undefined;
    if (!pin || !team) return res.status(400).json({ error: "pin and team required" });
    if (team !== "A" && team !== "B") return res.status(400).json({ error: "team must be A or B" });
    const room = secretGameRooms.get(pin);
    if (!room) return res.status(404).json({ error: "الجلسة غير موجودة أو انتهت" });
    if (room.phase === "ended") return res.status(410).json({ error: "اللعبة انتهت" });
    const token = generateRevealToken(pin, team, room.teams[team].secretId);
    res.json({ token });
  } catch (err) {
    req.log.error({ err }, "secret-game reveal-token");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/join", (req, res) => {
  try {
    const pin = (req.query.pin as string | undefined)?.toUpperCase();
    const team = req.query.team as string | undefined;
    if (!pin || !team) return res.status(400).json({ error: "pin and team required" });
    if (team !== "A" && team !== "B") return res.status(400).json({ error: "team must be A or B" });
    const room = secretGameRooms.get(pin);
    if (!room) return res.status(404).json({ error: "الجلسة غير موجودة أو انتهت" });
    if (room.phase === "ended") return res.status(410).json({ error: "اللعبة انتهت" });
    const token = generateRevealToken(pin, team, room.teams[team].secretId);
    res.json({
      token,
      teamName: room.teams[team].name,
      teamColor: room.teams[team].color,
      opponentName: room.teams[team === "A" ? "B" : "A"].name,
      phase: room.phase,
    });
  } catch (err) {
    req.log.error({ err }, "secret-game join");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/reveal/:token", (req, res) => {
  try {
    const { token } = req.params;
    const decoded = verifyRevealToken(token);
    if (!decoded) return res.status(401).json({ error: "رمز غير صالح أو منتهي الصلاحية" });

    const room = secretGameRooms.get(decoded.pin.toUpperCase());
    if (!room) return res.status(404).json({ error: "الجلسة غير موجودة" });

    const teamState = room.teams[decoded.team];
    if (teamState.secretId !== decoded.itemId) return res.status(401).json({ error: "رمز غير مطابق" });

    res.json({
      team: decoded.team,
      teamName: teamState.name,
      teamColor: teamState.color,
      secret: {
        id: teamState.secretId,
        name: teamState.secretName,
        image: teamState.secretImage,
      },
      pin: decoded.pin,
    });
  } catch (err) {
    req.log.error({ err }, "secret-game reveal");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
