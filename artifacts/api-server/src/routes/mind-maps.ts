import { Router, type IRouter } from "express";
import { db, mindMapsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

/* ── Auth middleware (session-based) ── */
function requireTeacher(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

/* ── Mind-map shape validation ── */
const branchSchema = z.object({
  label: z.string().trim().min(1, "Branch label must be non-empty"),
  icon: z.string(),
  color: z.string().trim().min(1, "Branch color must be non-empty"),
  children: z.array(z.string().trim().min(1, "Child label must be non-empty")),
});

const mapSchema = z.object({
  center: z.string().trim().min(1, "Center must be non-empty"),
  branches: z.array(branchSchema).min(1, "At least one branch is required"),
});

const createBody = z.object({
  clientRequestId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(400),
  language: z.enum(["ar", "en"]).default("ar"),
  depth: z.enum(["standard", "detailed"]).default("standard"),
  map: mapSchema,
});

const updateBody = createBody.partial().extend({
  map: mapSchema.optional(),
});

/* ── POST /mindmaps — create ── */
router.post("/mindmaps", requireTeacher, async (req, res): Promise<void> => {
  try {
    const teacherId = req.session.teacherId as number;
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues }, "Mind map create validation failed");
      res.status(400).json({ message: "Invalid mind map data", issues: parsed.error.issues });
      return;
    }
    const { clientRequestId, title, topic, language, depth, map } = parsed.data;
    const [inserted] = await db
      .insert(mindMapsTable)
      .values({
        teacherId,
        clientRequestId: clientRequestId ?? null,
        title,
        topic,
        language,
        depth,
        map,
      })
      .onConflictDoNothing({
        target: [mindMapsTable.teacherId, mindMapsTable.clientRequestId],
      })
      .returning();
    let row = inserted;
    if (!row) {
      if (!clientRequestId) {
        throw new Error("Mind-map insert conflict without a client request id");
      }
      [row] = await db
        .select()
        .from(mindMapsTable)
        .where(and(
          eq(mindMapsTable.teacherId, teacherId),
          eq(mindMapsTable.clientRequestId, clientRequestId),
        ))
        .limit(1);
      if (!row) {
        throw new Error("Idempotent mind-map replay could not find its original row");
      }
    }
    req.log.info({ id: row.id, teacherId }, "Mind map created");
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create mind map failed");
    res.status(500).json({ message: "Failed to create mind map" });
  }
});

/* ── GET /mindmaps — list own ── */
router.get("/mindmaps", requireTeacher, async (req, res): Promise<void> => {
  try {
    const teacherId = req.session.teacherId as number;
    const rows = await db
      .select()
      .from(mindMapsTable)
      .where(eq(mindMapsTable.teacherId, teacherId))
      .orderBy(desc(mindMapsTable.updatedAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List mind maps failed");
    res.status(500).json({ message: "Failed to load mind maps" });
  }
});

/* ── GET /mindmaps/:id — read one (own only, 404 for others) ── */
router.get("/mindmaps/:id", requireTeacher, async (req, res): Promise<void> => {
  try {
    const teacherId = req.session.teacherId as number;
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [row] = await db
      .select()
      .from(mindMapsTable)
      .where(and(eq(mindMapsTable.id, id), eq(mindMapsTable.teacherId, teacherId)))
      .limit(1);
    if (!row) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Read mind map failed");
    res.status(500).json({ message: "Failed to load mind map" });
  }
});

/* ── PUT /mindmaps/:id — update (own only, 404 for others) ── */
router.put("/mindmaps/:id", requireTeacher, async (req, res): Promise<void> => {
  try {
    const teacherId = req.session.teacherId as number;
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues }, "Mind map update validation failed");
      res.status(400).json({ message: "Invalid mind map data", issues: parsed.error.issues });
      return;
    }
    // Confirm ownership (return 404 without revealing existence to other teachers)
    const [existing] = await db
      .select({ id: mindMapsTable.id })
      .from(mindMapsTable)
      .where(and(eq(mindMapsTable.id, id), eq(mindMapsTable.teacherId, teacherId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) updateFields.title = parsed.data.title;
    if (parsed.data.topic !== undefined) updateFields.topic = parsed.data.topic;
    if (parsed.data.language !== undefined) updateFields.language = parsed.data.language;
    if (parsed.data.depth !== undefined) updateFields.depth = parsed.data.depth;
    if (parsed.data.map !== undefined) updateFields.map = parsed.data.map;

    const [row] = await db
      .update(mindMapsTable)
      .set(updateFields)
      .where(eq(mindMapsTable.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update mind map failed");
    res.status(500).json({ message: "Failed to update mind map" });
  }
});

/* ── DELETE /mindmaps/:id — delete (own only, 404 for others) ── */
router.delete("/mindmaps/:id", requireTeacher, async (req, res): Promise<void> => {
  try {
    const teacherId = req.session.teacherId as number;
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    // Confirm ownership — 404 hides existence from other teachers
    const [existing] = await db
      .select({ id: mindMapsTable.id })
      .from(mindMapsTable)
      .where(and(eq(mindMapsTable.id, id), eq(mindMapsTable.teacherId, teacherId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    await db.delete(mindMapsTable).where(eq(mindMapsTable.id, id));
    req.log.info({ id, teacherId }, "Mind map deleted");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Delete mind map failed");
    res.status(500).json({ message: "Failed to delete mind map" });
  }
});

export default router;
