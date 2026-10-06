import { Router, type Request, type Response, type NextFunction } from "express";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { db, collaborationBoardsTable as boards } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateCollaborationBoardBody, UpdateCollaborationBoardBody, JoinCollaborationBoardBody } from "@workspace/api-zod";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import { ObjectStorageService } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { applyBoardAction, assertWriter, boardIsOpen, canSeePost, createBoardData, BoardError, type Actor, type BoardData } from "../lib/collaboration-domain";
import { boardSummary, boardView, verifyMediaGrant, type BoardRecord } from "../lib/collaboration-view";

const router = Router();
const uuid = z.string().uuid();
const storage = new ObjectStorageService();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) });
const joinLimiter = rateLimit({ windowMs: 300_000, limit: 300, standardHeaders: true, legacyHeaders: false,
  message: { message: "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا." } });
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false,
  message: { message: "طلبات كثيرة. انتظر قليلًا ثم حاول مجددًا." } });
const imageLimiter = rateLimit({ windowMs: 300_000, limit: 150, standardHeaders: true, legacyHeaders: false });
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
function requireTeacher(req: Request) {
  const id = req.session?.teacherId;
  if (!id) throw new BoardError("سجّل الدخول بحساب المعلم.", 401);
  return id;
}
function actorFor(req: Request, row: BoardRecord): Actor {
  if (req.session?.teacherId === row.teacherId) return { id: `t:${row.teacherId}`, name: "المعلم", owner: true };
  const token = req.get("X-Collaboration-Token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) throw new BoardError("انضم إلى اللوحة أولًا.", 401);
  const member = (row.data as BoardData).members.find(m => m.tokenHash === hash(token));
  if (!member || member.blocked) throw new BoardError("المشاركة غير مسموحة.", 403);
  return { id: member.id, name: member.name, owner: false };
}
function wrap(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, _next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(error => {
      if (error instanceof BoardError) return res.status(error.status).json({ message: error.message });
      if (error instanceof z.ZodError) return res.status(400).json({ message: "تحقق من البيانات المطلوبة." });
      logger.error({ err: error }, "Collaboration request failed");
      res.status(500).json({ message: "تعذر إكمال الطلب. حاول مجددًا دون فقدان مشاركتك." });
    });
  };
}
async function getBoard(id: string) {
  uuid.parse(id);
  const [row] = await db.select().from(boards).where(eq(boards.id, id));
  if (!row) throw new BoardError("اللوحة غير موجودة.", 404);
  return row;
}
router.get("/collaboration", wrap(async (req, res) => {
  const rows = await db.select().from(boards).where(eq(boards.teacherId, requireTeacher(req))).orderBy(desc(boards.updatedAt)).limit(250);
  res.setHeader("Cache-Control", "private, no-store");
  res.json(rows.map(boardSummary));
}));
router.post("/collaboration", writeLimiter, wrap(async (req, res) => {
  const teacherId = requireTeacher(req);
  const input = CreateCollaborationBoardBody.parse(req.body);
  const data = createBoardData(input);
  let row;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [created] = await db.insert(boards).values({
      id: randomUUID(), teacherId, clientId: input.clientId, pin: String(randomInt(100000, 1000000)), data,
    }).onConflictDoNothing().returning();
    if (created) { row = created; break; }
    const [existing] = await db.select().from(boards).where(and(eq(boards.teacherId, teacherId), eq(boards.clientId, input.clientId)));
    if (existing) { row = existing; break; }
  }
  if (!row) throw new BoardError("تعذر إنشاء كود اللوحة. حاول مجددًا.", 503);
  res.status(201).json(boardView(row, actorFor(req, row)));
}));
router.get("/collaboration/join/:pin", joinLimiter, wrap(async (req, res) => {
  const pin = z.string().regex(/^\d{6}$/).parse(req.params.pin);
  const [row] = await db.select().from(boards).where(eq(boards.pin, pin));
  if (!row) throw new BoardError("لم نجد لوحة بهذا الكود.", 404);
  const { id, title, prompt, status } = boardSummary(row);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ id, pin, title, prompt, status });
}));
router.post("/collaboration/join/:pin", joinLimiter, wrap(async (req, res) => {
  const pin = z.string().regex(/^\d{6}$/).parse(req.params.pin);
  const input = JoinCollaborationBoardBody.parse(req.body), name = input.name.trim();
  if (!name) throw new BoardError("اكتب اسمك.");
  const result = await db.transaction(async tx => {
    const [row] = await tx.select().from(boards).where(eq(boards.pin, pin)).for("update");
    if (!row) throw new BoardError("لم نجد لوحة بهذا الكود.", 404);
    const data = row.data as BoardData;
    const previousToken = req.get("X-Collaboration-Token") ?? "";
    const previous = /^[a-f0-9]{64}$/.test(previousToken) ? data.members.find(m => m.tokenHash === hash(previousToken)) : undefined;
    if (previous) {
      if (previous.blocked) throw new BoardError("المشاركة غير مسموحة.", 403);
      return { id: row.id, token: previousToken, participantId: previous.id, name: previous.name };
    }
    if (!boardIsOpen(data)) throw new BoardError("اللوحة ليست مفتوحة للانضمام الآن.", 409);
    if (data.members.length >= 200) throw new BoardError("اكتملت سعة اللوحة.");
    const token = randomBytes(32).toString("hex"), id = randomUUID();
    data.members.push({ id, name, tokenHash: hash(token), blocked: false });
    data.revision++;
    await tx.update(boards).set({ data, updatedAt: new Date() }).where(eq(boards.id, row.id));
    return { id: row.id, token, participantId: id, name };
  });
  res.json(result);
}));
router.get("/collaboration/:id", wrap(async (req, res) => {
  const row = await getBoard(String(req.params.id));
  res.setHeader("Cache-Control", "private, no-store");
  res.json(boardView(row, actorFor(req, row)));
}));
router.post("/collaboration/:id/actions", writeLimiter, wrap(async (req, res) => {
  const id = uuid.parse(req.params.id), action = UpdateCollaborationBoardBody.parse(req.body);
  const view = await db.transaction(async tx => {
    const [row] = await tx.select().from(boards).where(eq(boards.id, id)).for("update");
    if (!row) throw new BoardError("اللوحة غير موجودة.", 404);
    const actor = actorFor(req, row), data = row.data as BoardData;
    if (applyBoardAction(data, actor, action)) {
      const now = new Date();
      await tx.update(boards).set({ data, updatedAt: now }).where(eq(boards.id, id));
      row.updatedAt = now;
    }
    return boardView(row, actor);
  });
  res.json(view);
}));
router.post("/collaboration/:id/images", imageLimiter,
  wrap(async (req, res) => {
    // Authorization precedes accepting or decoding file bytes.
    const row = await getBoard(String(req.params.id)), actor = actorFor(req, row), data = row.data as BoardData;
    assertWriter(data, actor);
    if (!actor.owner && !data.settings.allowImages) throw new BoardError("المعلم أوقف إضافة الصور.");
    if (Object.values(data.images).filter(i => i.authorId === actor.id).length >= 30) throw new BoardError("وصلت إلى حد الصور لهذه اللوحة.");
    res.locals.collaborationUploadActor = actor;
    res.locals.collaborationUploadBoard = row;
    upload.single("file")(req, res, async error => {
      if (error || !req.file) return res.status(400).json({ message: "اختر صورة JPEG أو PNG أو WebP حتى 5 ميغابايت." });
      let uploadedPath: string | undefined;
      let registered = false;
      try {
        const image = sharp(req.file.buffer, { limitInputPixels: 16_000_000 });
        const metadata = await image.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new BoardError("صيغة الصورة غير مدعومة.");
        const buffer = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        const imageId = randomUUID();
        const path = await storage.uploadBufferAsPrivate({ buffer, contentType: "image/webp", extension: ".webp",
          ownerPrefix: `collaboration/${row.id}` });
        uploadedPath = path;
        await db.transaction(async tx => {
          const [fresh] = await tx.select().from(boards).where(eq(boards.id, row.id)).for("update");
          if (!fresh) throw new BoardError("اللوحة غير موجودة.", 404);
          const freshActor = actorFor(req, fresh), freshData = fresh.data as BoardData;
          assertWriter(freshData, freshActor);
          if (!freshActor.owner && !freshData.settings.allowImages) throw new BoardError("المعلم أوقف إضافة الصور.");
          if (Object.values(freshData.images).filter(i => i.authorId === freshActor.id).length >= 30) throw new BoardError("وصلت إلى حد الصور.");
          freshData.images[imageId] = { path, authorId: freshActor.id };
          freshData.revision++;
          await tx.update(boards).set({ data: freshData, updatedAt: new Date() }).where(eq(boards.id, row.id));
        });
        registered = true;
        res.status(201).json({ imageId });
      } catch (err) {
        if (uploadedPath && !registered) {
          try {
            const orphan = await storage.getObjectEntityFile(uploadedPath);
            await orphan.delete({ ignoreNotFound: true });
          } catch (cleanupError) {
            logger.warn({ err: cleanupError }, "Could not remove an unregistered collaboration upload");
          }
        }
        if (err instanceof BoardError) return res.status(err.status).json({ message: err.message });
        logger.error({ err }, "Collaboration image upload failed");
        res.status(400).json({ message: "تعذر معالجة الصورة. جرّب صورة أصغر." });
      }
    });
  }));
router.get("/collaboration/:id/media/:imageId", wrap(async (req, res) => {
  const row = await getBoard(String(req.params.id)), imageId = uuid.parse(req.params.imageId), data = row.data as BoardData;
  const actorId = verifyMediaGrant(String(req.query.grant ?? ""), row.id, imageId);
  let actor: Actor;
  if (actorId === `t:${row.teacherId}`) actor = { id: actorId, name: "المعلم", owner: true };
  else {
    const member = data.members.find(m => m.id === actorId && !m.blocked);
    if (!member) throw new BoardError("الصورة غير متاحة.", 403);
    actor = { id: member.id, name: member.name, owner: false };
  }
  const image = data.images[imageId];
  if (!image || !data.posts.some(p => p.imageId === imageId && canSeePost(data, actor, p))) throw new BoardError("الصورة غير متاحة.", 403);
  const file = await storage.getObjectEntityFile(image.path);
  res.set({ "Content-Type": "image/webp", "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" });
  file.createReadStream().on("error", error => {
    logger.warn({ err: error }, "Collaboration media stream failed");
    if (!res.headersSent) res.status(404).end(); else res.destroy();
  }).pipe(res);
}));
export default router;
