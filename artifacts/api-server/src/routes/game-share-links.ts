import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db, gameShareLinksTable } from "@workspace/db";
import { GAME_SHARE_CODE, generateGameShareCode, normalizeGameSharePath } from "../lib/game-share-path";

const router: IRouter = Router();
const createLimiter = rateLimit({
  windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many sharing requests. Please try again shortly." },
});
const readLimiter = rateLimit({
  windowMs: 60_000, limit: 1200, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many link requests. Please try again shortly." },
});

// Public by design: existing guest-host games can share without a teacher
// account. This only aliases a validated internal URL; target authorization,
// expiry, visibility and room-start throttling are unchanged.
router.post("/game-share-links", createLimiter, async (req, res) => {
  const path = normalizeGameSharePath(req.body?.path);
  if (!path) return res.status(400).json({ error: "Invalid game destination" });
  const destinationHash = createHash("sha256").update(path).digest("hex");
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const [existing] = await db.select().from(gameShareLinksTable)
        .where(eq(gameShareLinksTable.destinationHash, destinationHash)).limit(1);
      if (existing) {
        if (existing.destination !== path) throw new Error("Game-share destination hash collision");
        return res.json({ code: existing.code, path, shortPath: `/s/${existing.code}` });
      }
      const [inserted] = await db.insert(gameShareLinksTable)
        .values({ code: generateGameShareCode(), destinationHash, destination: path })
        .onConflictDoNothing().returning();
      if (inserted) return res.status(201).json({
        code: inserted.code, path, shortPath: `/s/${inserted.code}`,
      });
      // A destination race fetches its winner on the next iteration; a code
      // collision retries with fresh cryptographic randomness.
    }
    throw new Error("Could not allocate game-share code");
  } catch (error) {
    req.log.error({ err: error }, "Game share link creation failed");
    return res.status(503).json({ error: "Could not prepare the sharing link. Please retry." });
  }
});

router.get("/game-share-links/:code/redirect", readLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!GAME_SHARE_CODE.test(String(req.params.code))) {
    return res.status(404).send("رابط اللعبة غير موجود");
  }
  try {
    const [link] = await db.select().from(gameShareLinksTable)
      .where(eq(gameShareLinksTable.code, String(req.params.code))).limit(1);
    const destination = link && normalizeGameSharePath(link.destination);
    if (!destination) return res.status(404).send("رابط اللعبة غير موجود");
    return res.redirect(302, destination);
  } catch (error) {
    req.log.error({ err: error }, "Game share link resolution failed");
    return res.status(503).send("تعذّر فتح رابط اللعبة. يرجى المحاولة مرة أخرى.");
  }
});

export default router;