import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, directPlayLinksTable, savedGameActivitiesTable, teachersTable } from "@workspace/db";
import {
  activityContentFromBody,
  canonicalizeJson,
  gameContentFingerprint,
  questionCountForContent,
  savedGameActivityUpsertSchema,
} from "../lib/saved-game-activities";
import { sanitizeXoSetup } from "../game/xo-handlers";
import { normalizeXoTitle } from "../lib/xo-display";

const router: IRouter = Router();

type ActivityResponseInput = Pick<typeof savedGameActivitiesTable.$inferSelect,
  "id" | "teacherId" | "gameType" | "title" | "content" | "settings" | "source" |
  "isShared" | "publishedAt" | "hiddenByAdmin" | "questionCount" | "playCount" |
  "lastPlayedAt" | "createdAt" | "updatedAt"
> & { teacherName?: string };

function activityResponse(activity: ActivityResponseInput) {
  return {
    id: activity.id,
    teacherId: activity.teacherId,
    gameType: activity.gameType,
    title: activity.gameType === "xo" ? normalizeXoTitle(activity.title) : activity.title,
    content: activity.content,
    settings: activity.settings,
    source: activity.source,
    isShared: activity.isShared,
    publishedAt: activity.publishedAt,
    hiddenByAdmin: activity.hiddenByAdmin,
    ...(activity.teacherName === undefined ? {} : { teacherName: activity.teacherName }),
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
      isShared: parsed.data.isShared,
      publishedAt: parsed.data.isShared ? new Date() : null,
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
        isShared: parsed.data.isShared,
        publishedAt: parsed.data.isShared ? sql`NOW()` : null,
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

router.get("/game-activities/shared", async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const activities = await db.select({
      id: savedGameActivitiesTable.id,
      teacherId: savedGameActivitiesTable.teacherId,
      gameType: savedGameActivitiesTable.gameType,
      title: savedGameActivitiesTable.title,
      content: savedGameActivitiesTable.content,
      settings: savedGameActivitiesTable.settings,
      source: savedGameActivitiesTable.source,
      isShared: savedGameActivitiesTable.isShared,
      publishedAt: savedGameActivitiesTable.publishedAt,
      hiddenByAdmin: savedGameActivitiesTable.hiddenByAdmin,
      questionCount: savedGameActivitiesTable.questionCount,
      playCount: savedGameActivitiesTable.playCount,
      lastPlayedAt: savedGameActivitiesTable.lastPlayedAt,
      createdAt: savedGameActivitiesTable.createdAt,
      updatedAt: savedGameActivitiesTable.updatedAt,
      teacherName: teachersTable.name,
    }).from(savedGameActivitiesTable)
      .innerJoin(teachersTable, eq(savedGameActivitiesTable.teacherId, teachersTable.id))
      .where(and(
        eq(savedGameActivitiesTable.isShared, true),
        eq(savedGameActivitiesTable.hiddenByAdmin, false),
      ))
      .orderBy(desc(savedGameActivitiesTable.publishedAt), desc(savedGameActivitiesTable.updatedAt));
    res.json(activities.map(activityResponse));
  } catch (err) {
    req.log.error({ err }, "List shared game activities failed");
    res.status(500).json({ error: "Unable to list shared game activities" });
  }
});

router.get("/game-activities/:id", async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = activityId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid activity id" }); return; }
  try {
    const [activity] = await db.select().from(savedGameActivitiesTable).where(and(
      eq(savedGameActivitiesTable.id, id),
      sql`(${savedGameActivitiesTable.teacherId} = ${teacherId} OR (
        ${savedGameActivitiesTable.isShared} = true
        AND ${savedGameActivitiesTable.hiddenByAdmin} = false
      ))`,
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
      title: savedGameActivitiesTable.title,
      content: savedGameActivitiesTable.content,
      settings: savedGameActivitiesTable.settings,
      questionCount: savedGameActivitiesTable.questionCount,
    }).from(savedGameActivitiesTable).where(and(
      eq(savedGameActivitiesTable.id, id),
      eq(savedGameActivitiesTable.teacherId, teacherId),
    )).limit(1);
    if (!activity) {
      res.status(404).json({ error: "Saved game activity not found" }); return;
    }

    let linkGameType = "tug_class";
    if (activity.gameType === "xo") {
      // XO links are owner-only and derive their public mode from the
      // sanitized persisted settings, never from a caller-supplied type.
      const setup = sanitizeXoSetup(activity.content, activity.settings);
      if (!setup) {
        res.status(400).json({ error: "At least two supported XO questions are required" }); return;
      }
      const settings = activity.settings && typeof activity.settings === "object" && !Array.isArray(activity.settings)
        ? activity.settings as Record<string, unknown>
        : {};
      linkGameType = settings.playMode === "online" || settings.playMode === "xo_online"
        ? "xo_online"
        : "xo_class";
    } else if (activity.gameType !== "tug") {
      res.status(404).json({ error: "Saved game activity not found" }); return;
    } else if (activity.questionCount < 2) {
      res.status(400).json({ error: "At least two questions are required" }); return;
    }

    const [existing] = await db.select({ token: directPlayLinksTable.token })
      .from(directPlayLinksTable)
      .where(and(
        eq(directPlayLinksTable.savedGameActivityId, id),
        eq(directPlayLinksTable.gameType, linkGameType),
      ))
      .limit(1);
    if (existing) { res.json(existing); return; }

    const token = randomBytes(16).toString("hex");
    const [created] = await db.insert(directPlayLinksTable).values({
      token,
      savedGameActivityId: id,
      gameType: linkGameType,
      teacherId,
    }).onConflictDoNothing().returning({ token: directPlayLinksTable.token });
    if (created) { res.status(201).json(created); return; }

    const [raced] = await db.select({ token: directPlayLinksTable.token })
      .from(directPlayLinksTable)
      .where(and(
        eq(directPlayLinksTable.savedGameActivityId, id),
        eq(directPlayLinksTable.gameType, linkGameType),
      ))
      .limit(1);
    if (!raced) throw new Error("Direct-play link conflict could not be recovered");
    res.json(raced);
  } catch (err) {
    req.log.error({ err }, "Create saved-game play link failed");
    res.status(500).json({ error: "Unable to create game link" });
  }
});

router.delete("/game-activities/:id/play-links", async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = activityId(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid activity id" }); return; }
  try {
    const [activity] = await db.select({ id: savedGameActivitiesTable.id })
      .from(savedGameActivitiesTable)
      .where(and(
        eq(savedGameActivitiesTable.id, id),
        eq(savedGameActivitiesTable.teacherId, teacherId),
        eq(savedGameActivitiesTable.gameType, "xo"),
      ))
      .limit(1);
    if (!activity) {
      res.status(404).json({ error: "Saved game activity not found" }); return;
    }

    await db.delete(directPlayLinksTable).where(and(
      eq(directPlayLinksTable.savedGameActivityId, id),
      eq(directPlayLinksTable.teacherId, teacherId),
      sql`${directPlayLinksTable.gameType} IN ('xo_class', 'xo_online')`,
    ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Revoke saved-game play link failed");
    res.status(500).json({ error: "Unable to revoke game link" });
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