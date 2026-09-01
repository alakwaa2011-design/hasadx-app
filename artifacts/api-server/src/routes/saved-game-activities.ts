import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, directPlayLinksTable, savedGameActivitiesTable } from "@workspace/db";
import {
  activityContentFromBody,
  canonicalizeJson,
  gameContentFingerprint,
  questionCountForContent,
  savedGameActivityUpsertSchema,
} from "../lib/saved-game-activities";

const router: IRouter = Router();

function activityResponse(activity: typeof savedGameActivitiesTable.$inferSelect) {
  return {
    id: activity.id,
    gameType: activity.gameType,
    title: activity.title,
    content: activity.content,
    settings: activity.settings,
    source: activity.source,
    questionCount: activity.questionCount,
    playCount: activity.playCount,
    lastPlayedAt: activity.lastPlayedAt,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  };
}

function activityId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  return Number(raw);
}

router.get("/game-activities", async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const activities = await db.select().from(savedGameActivitiesTable)
      .where(eq(savedGameActivitiesTable.teacherId, teacherId))
      .orderBy(desc(savedGameActivitiesTable.updatedAt));
    res.json(activities.map(activityResponse));
  } catch (err) {
    req.log.error({ err }, "List saved game activities failed");
    res.status(500).json({ error: "Unable to list saved game activities" });
  }
});

router.post("/game-activities", async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const parsed = savedGameActivityUpsertSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }

  try {
    const rawContent = activityContentFromBody(parsed.data);
    // Store canonical JSON as well as hashing it, so equivalent submissions
    // produce an identical persisted representation.
    const content = JSON.parse(canonicalizeJson(rawContent));
    const settings = JSON.parse(canonicalizeJson(parsed.data.settings));
    const fingerprint = gameContentFingerprint(parsed.data.gameType, content);
    const [activity] = await db.insert(savedGameActivitiesTable).values({
      teacherId,
      gameType: parsed.data.gameType,
      title: parsed.data.title,
      content,
      settings,
      source: parsed.data.source,
      contentFingerprint: fingerprint,
      questionCount: questionCountForContent(content),
      playCount: 1,
      lastPlayedAt: new Date(),
    }).onConflictDoUpdate({
      target: [
        savedGameActivitiesTable.teacherId,
        savedGameActivitiesTable.gameType,
        savedGameActivitiesTable.contentFingerprint,
      ],
      set: {
        title: parsed.data.title,
        settings,
        source: parsed.data.source,
        questionCount: questionCountForContent(content),
        playCount: sql`${savedGameActivitiesTable.playCount} + 1`,
        lastPlayedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      },
    }).returning();
    res.status(201).json(activityResponse(activity));
  } catch (err) {
    req.log.error({ err }, "Upsert saved game activity failed");
    res.status(500).json({ error: "Unable to save game activity" });
  }
});

router.get("/game-activities/:id", async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = activityId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid activity id" }); return; }
  try {
    const [activity] = await db.select().from(savedGameActivitiesTable).where(and(
      eq(savedGameActivitiesTable.id, id), eq(savedGameActivitiesTable.teacherId, teacherId),
    )).limit(1);
    if (!activity) { res.status(404).json({ error: "Saved game activity not found" }); return; }
    res.json(activityResponse(activity));
  } catch (err) {
    req.log.error({ err }, "Get saved game activity failed");
    res.status(500).json({ error: "Unable to get saved game activity" });
  }
});

router.post("/game-activities/:id/play-links", async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = activityId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid activity id" }); return; }
  try {
    const [activity] = await db.select({
      id: savedGameActivitiesTable.id,
      gameType: savedGameActivitiesTable.gameType,
      questionCount: savedGameActivitiesTable.questionCount,
    }).from(savedGameActivitiesTable).where(and(
      eq(savedGameActivitiesTable.id, id),
      eq(savedGameActivitiesTable.teacherId, teacherId),
    )).limit(1);
    if (!activity || activity.gameType !== "tug") {
      res.status(404).json({ error: "Saved tug game not found" }); return;
    }
    if (activity.questionCount < 2) {
      res.status(400).json({ error: "At least two questions are required" }); return;
    }

    const [existing] = await db.select({ token: directPlayLinksTable.token })
      .from(directPlayLinksTable)
      .where(and(
        eq(directPlayLinksTable.savedGameActivityId, id),
        eq(directPlayLinksTable.gameType, "tug_class"),
      ))
      .limit(1);
    if (existing) { res.json(existing); return; }

    const token = randomBytes(16).toString("hex");
    const [created] = await db.insert(directPlayLinksTable).values({
      token,
      savedGameActivityId: id,
      gameType: "tug_class",
      teacherId,
    }).onConflictDoNothing().returning({ token: directPlayLinksTable.token });
    if (created) { res.status(201).json(created); return; }

    const [raced] = await db.select({ token: directPlayLinksTable.token })
      .from(directPlayLinksTable)
      .where(and(
        eq(directPlayLinksTable.savedGameActivityId, id),
        eq(directPlayLinksTable.gameType, "tug_class"),
      ))
      .limit(1);
    if (!raced) throw new Error("Direct-play link conflict could not be recovered");
    res.json(raced);
  } catch (err) {
    req.log.error({ err }, "Create saved-game play link failed");
    res.status(500).json({ error: "Unable to create game link" });
  }
});

router.delete("/game-activities/:id", async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = activityId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid activity id" }); return; }
  try {
    const [deleted] = await db.delete(savedGameActivitiesTable).where(and(
      eq(savedGameActivitiesTable.id, id), eq(savedGameActivitiesTable.teacherId, teacherId),
    )).returning({ id: savedGameActivitiesTable.id });
    if (!deleted) { res.status(404).json({ error: "Saved game activity not found" }); return; }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete saved game activity failed");
    res.status(500).json({ error: "Unable to delete saved game activity" });
  }
});

export default router;