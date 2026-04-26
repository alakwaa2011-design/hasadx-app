import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  teacherLibraryFilesTable,
  teacherLibraryGroupsTable,
  teacherLibraryPendingUploadsTable,
  teachersTable,
} from "@workspace/db";
import { and, eq, desc, sql, ilike, or, lt } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import mammoth from "mammoth";
import JSZip from "jszip";
import { openai } from "@workspace/integrations-openai-ai-server";
import { LIBRARY_PENDING_UPLOAD_TTL_MS } from "../lib/library-constants";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const TEACHER_QUOTA_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB
const PENDING_UPLOAD_TTL_MS = LIBRARY_PENDING_UPLOAD_TTL_MS;

const ALLOWED_TYPES: Record<string, true> = {
  "application/pdf": true,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
  "application/msword": true,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": true,
  "application/vnd.ms-powerpoint": true,
  "image/png": true,
  "image/jpeg": true,
  "image/jpg": true,
  "application/zip": true,
  "application/x-zip-compressed": true,
};

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "غير مصرح" });
    return;
  }
  next();
}

async function isAdmin(teacherId: number): Promise<boolean> {
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId));
  return !!t?.isAdmin;
}

async function getUsageBytes(teacherId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${teacherLibraryFilesTable.sizeBytes}), 0)::bigint` })
    .from(teacherLibraryFilesTable)
    .where(and(eq(teacherLibraryFilesTable.teacherId, teacherId), eq(teacherLibraryFilesTable.source, "upload")));
  return Number(row?.total || 0);
}

router.use("/library", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

/* ── Usage ─────────────────────────────────────────────────────────── */
router.get("/library/usage", requireAuth, async (req: any, res: Response) => {
  try {
    const teacherId = req.session.teacherId;
    const admin = await isAdmin(teacherId);
    const used = await getUsageBytes(teacherId);
    res.json({
      usedBytes: used,
      quotaBytes: admin ? null : TEACHER_QUOTA_BYTES,
      unlimited: admin,
    });
  } catch (err) {
    req.log.error(err, "library usage error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── Groups ────────────────────────────────────────────────────────── */
router.get("/library/groups", requireAuth, async (req: any, res: Response) => {
  try {
    const teacherId = req.session.teacherId;
    const groups = await db
      .select({
        id: teacherLibraryGroupsTable.id,
        name: teacherLibraryGroupsTable.name,
        createdAt: teacherLibraryGroupsTable.createdAt,
        fileCount: sql<number>`(SELECT COUNT(*) FROM teacher_library_files f WHERE f.group_id = ${teacherLibraryGroupsTable.id})::int`,
      })
      .from(teacherLibraryGroupsTable)
      .where(eq(teacherLibraryGroupsTable.teacherId, teacherId))
      .orderBy(teacherLibraryGroupsTable.createdAt);
    res.json(groups);
  } catch (err) {
    req.log.error(err, "list library groups error");
    res.status(500).json({ message: "خطأ" });
  }
});

const CreateGroupBody = z.object({ name: z.string().min(1).max(100) });
router.post("/library/groups", requireAuth, async (req: any, res: Response) => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "اسم المجموعة مطلوب" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const name = parsed.data.name.trim();
    if (!name) {
      res.status(400).json({ message: "اسم المجموعة مطلوب" });
      return;
    }
    const [existing] = await db
      .select({ id: teacherLibraryGroupsTable.id })
      .from(teacherLibraryGroupsTable)
      .where(and(eq(teacherLibraryGroupsTable.teacherId, teacherId), eq(teacherLibraryGroupsTable.name, name)));
    if (existing) {
      res.status(409).json({ message: "المجموعة موجودة بالفعل" });
      return;
    }
    const [group] = await db
      .insert(teacherLibraryGroupsTable)
      .values({ teacherId, name })
      .returning();
    res.json(group);
  } catch (err) {
    req.log.error(err, "create library group error");
    res.status(500).json({ message: "خطأ" });
  }
});

const RenameGroupBody = z.object({ name: z.string().min(1).max(100) });
router.patch("/library/groups/:id", requireAuth, async (req: any, res: Response) => {
  const id = parseInt(req.params.id);
  const parsed = RenameGroupBody.safeParse(req.body);
  if (!parsed.success || !Number.isFinite(id)) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const name = parsed.data.name.trim();
    const [updated] = await db
      .update(teacherLibraryGroupsTable)
      .set({ name })
      .where(and(eq(teacherLibraryGroupsTable.id, id), eq(teacherLibraryGroupsTable.teacherId, teacherId)))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "غير موجود" });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "اسم المجموعة مستخدم" });
      return;
    }
    req.log.error(err, "rename library group error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.delete("/library/groups/:id", requireAuth, async (req: any, res: Response) => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const result = await db
      .delete(teacherLibraryGroupsTable)
      .where(and(eq(teacherLibraryGroupsTable.id, id), eq(teacherLibraryGroupsTable.teacherId, teacherId)))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ message: "غير موجود" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "delete library group error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── Files: list ───────────────────────────────────────────────────── */
router.get("/library/files", requireAuth, async (req: any, res: Response) => {
  try {
    const teacherId = req.session.teacherId;
    const groupParam = req.query.groupId as string | undefined;
    const search = ((req.query.search as string) || "").trim();

    const conditions: any[] = [eq(teacherLibraryFilesTable.teacherId, teacherId)];
    if (groupParam === "none") {
      conditions.push(sql`${teacherLibraryFilesTable.groupId} IS NULL`);
    } else if (groupParam && groupParam !== "all") {
      const gid = parseInt(groupParam);
      if (Number.isFinite(gid)) conditions.push(eq(teacherLibraryFilesTable.groupId, gid));
    }
    if (search) {
      const like = `%${search}%`;
      conditions.push(or(ilike(teacherLibraryFilesTable.name, like), ilike(teacherLibraryFilesTable.description, like))!);
    }

    const files = await db
      .select()
      .from(teacherLibraryFilesTable)
      .where(and(...conditions))
      .orderBy(desc(teacherLibraryFilesTable.createdAt));
    res.json(files);
  } catch (err) {
    req.log.error(err, "list library files error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── Files: request upload URL (issues a server-side reservation) ── */
const RequestUploadBody = z.object({
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
  contentType: z.string().min(1),
});
router.post("/library/uploads/request-url", requireAuth, async (req: any, res: Response) => {
  const parsed = RequestUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  const { name, size, contentType } = parsed.data;
  if (!ALLOWED_TYPES[contentType]) {
    res.status(400).json({ message: "نوع الملف غير مسموح به" });
    return;
  }
  if (size > MAX_FILE_BYTES) {
    res.status(400).json({ message: "الحد الأقصى لحجم الملف 500 ميغابايت" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const admin = await isAdmin(teacherId);
    if (!admin) {
      const used = await getUsageBytes(teacherId);
      if (used + size > TEACHER_QUOTA_BYTES) {
        res.status(413).json({ message: "تم تجاوز الحصة المسموحة (50 جيجابايت)" });
        return;
      }
    }
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    // Clean up expired pending uploads opportunistically
    await db
      .delete(teacherLibraryPendingUploadsTable)
      .where(lt(teacherLibraryPendingUploadsTable.createdAt, new Date(Date.now() - PENDING_UPLOAD_TTL_MS)));

    // Reserve this object path for this teacher
    await db.insert(teacherLibraryPendingUploadsTable).values({
      teacherId,
      objectPath,
      expectedSize: size,
      expectedContentType: contentType,
    });

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (err) {
    req.log.error(err, "library request upload url error");
    res.status(500).json({ message: "خطأ في إعداد الرفع" });
  }
});

/* ── Files: finalize upload ────────────────────────────────────────── */
const FinalizeUploadBody = z.object({
  name: z.string().min(1).max(255),
  objectPath: z.string().min(1),
  groupId: z.number().int().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});
router.post("/library/files", requireAuth, async (req: any, res: Response) => {
  const parsed = FinalizeUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const { name, objectPath, groupId, description } = parsed.data;

    // 1) Verify the objectPath was issued to this teacher
    const [pending] = await db
      .select()
      .from(teacherLibraryPendingUploadsTable)
      .where(
        and(
          eq(teacherLibraryPendingUploadsTable.objectPath, objectPath),
          eq(teacherLibraryPendingUploadsTable.teacherId, teacherId),
        ),
      );
    if (!pending) {
      res.status(403).json({ message: "تعذر التحقق من الرفع" });
      return;
    }

    // 2) Fetch authoritative metadata from object storage
    let actualSize = 0;
    let actualType = pending.expectedContentType;
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const [metadata] = await objectFile.getMetadata();
      actualSize = parseInt(String(metadata.size || 0), 10) || 0;
      actualType = (metadata.contentType as string) || pending.expectedContentType;
    } catch {
      res.status(404).json({ message: "لم يتم العثور على الملف المرفوع" });
      return;
    }

    if (!ALLOWED_TYPES[actualType]) {
      res.status(400).json({ message: "نوع الملف غير مسموح به" });
      return;
    }
    if (actualSize <= 0 || actualSize > MAX_FILE_BYTES) {
      res.status(400).json({ message: "حجم الملف غير صالح" });
      return;
    }

    // 3) Validate group ownership if provided
    if (groupId) {
      const [g] = await db
        .select({ id: teacherLibraryGroupsTable.id })
        .from(teacherLibraryGroupsTable)
        .where(and(eq(teacherLibraryGroupsTable.id, groupId), eq(teacherLibraryGroupsTable.teacherId, teacherId)));
      if (!g) {
        res.status(400).json({ message: "المجموعة غير موجودة" });
        return;
      }
    }

    // 4) Atomic quota check + insert + reservation cleanup in a transaction
    const admin = await isAdmin(teacherId);
    try {
      const file = await db.transaction(async (tx) => {
        if (!admin) {
          const [usageRow] = await tx
            .select({ total: sql<string>`COALESCE(SUM(${teacherLibraryFilesTable.sizeBytes}), 0)::bigint` })
            .from(teacherLibraryFilesTable)
            .where(
              and(
                eq(teacherLibraryFilesTable.teacherId, teacherId),
                eq(teacherLibraryFilesTable.source, "upload"),
              ),
            );
          const used = Number(usageRow?.total || 0);
          if (used + actualSize > TEACHER_QUOTA_BYTES) {
            throw new Error("QUOTA_EXCEEDED");
          }
        }

        const [inserted] = await tx
          .insert(teacherLibraryFilesTable)
          .values({
            teacherId,
            groupId: groupId ?? null,
            name: name.trim(),
            fileType: actualType,
            sizeBytes: actualSize,
            source: "upload",
            objectPath,
            description: description?.trim() || null,
          })
          .returning();

        await tx
          .delete(teacherLibraryPendingUploadsTable)
          .where(eq(teacherLibraryPendingUploadsTable.id, pending.id));

        return inserted;
      });
      res.json(file);
    } catch (e: any) {
      if (e?.message === "QUOTA_EXCEEDED") {
        res.status(413).json({ message: "تم تجاوز الحصة المسموحة (50 جيجابايت)" });
        return;
      }
      if (e?.code === "23505") {
        res.status(409).json({ message: "الملف مسجّل بالفعل" });
        return;
      }
      throw e;
    }
  } catch (err) {
    req.log.error(err, "library finalize file error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── Files: add link ───────────────────────────────────────────────── */
const AddLinkBody = z.object({
  name: z.string().min(1).max(255),
  externalUrl: z.string().url().refine((u) => /^https?:\/\//i.test(u), { message: "يجب أن يكون الرابط http/https" }),
  fileType: z.string().min(1).max(64).default("link"),
  groupId: z.number().int().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
});
router.post("/library/links", requireAuth, async (req: any, res: Response) => {
  const parsed = AddLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة (الاسم والرابط مطلوبان)" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const { name, externalUrl, fileType, groupId, description } = parsed.data;
    if (groupId) {
      const [g] = await db
        .select({ id: teacherLibraryGroupsTable.id })
        .from(teacherLibraryGroupsTable)
        .where(and(eq(teacherLibraryGroupsTable.id, groupId), eq(teacherLibraryGroupsTable.teacherId, teacherId)));
      if (!g) {
        res.status(400).json({ message: "المجموعة غير موجودة" });
        return;
      }
    }
    const [file] = await db
      .insert(teacherLibraryFilesTable)
      .values({
        teacherId,
        groupId: groupId ?? null,
        name: name.trim(),
        fileType,
        sizeBytes: 0,
        source: "link",
        externalUrl,
        description: description?.trim() || null,
      })
      .returning();
    res.json(file);
  } catch (err) {
    req.log.error(err, "library add link error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── Files: move ───────────────────────────────────────────────────── */
const MoveFileBody = z.object({ groupId: z.number().int().nullable() });
router.patch("/library/files/:id/move", requireAuth, async (req: any, res: Response) => {
  const id = parseInt(req.params.id);
  const parsed = MoveFileBody.safeParse(req.body);
  if (!parsed.success || !Number.isFinite(id)) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const { groupId } = parsed.data;
    if (groupId) {
      const [g] = await db
        .select({ id: teacherLibraryGroupsTable.id })
        .from(teacherLibraryGroupsTable)
        .where(and(eq(teacherLibraryGroupsTable.id, groupId), eq(teacherLibraryGroupsTable.teacherId, teacherId)));
      if (!g) {
        res.status(400).json({ message: "المجموعة غير موجودة" });
        return;
      }
    }
    const [updated] = await db
      .update(teacherLibraryFilesTable)
      .set({ groupId: groupId ?? null })
      .where(and(eq(teacherLibraryFilesTable.id, id), eq(teacherLibraryFilesTable.teacherId, teacherId)))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "غير موجود" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err, "library move file error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── Files: delete ─────────────────────────────────────────────────── */
router.delete("/library/files/:id", requireAuth, async (req: any, res: Response) => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const result = await db
      .delete(teacherLibraryFilesTable)
      .where(and(eq(teacherLibraryFilesTable.id, id), eq(teacherLibraryFilesTable.teacherId, teacherId)))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ message: "غير موجود" });
      return;
    }
    const deletedFile = result[0];
    if (deletedFile.source === "upload" && deletedFile.objectPath) {
      try {
        await objectStorageService.tryDeleteObjectEntity(deletedFile.objectPath);
      } catch (blobErr) {
        req.log.error({ err: blobErr, objectPath: deletedFile.objectPath, fileId: deletedFile.id }, "library delete blob error");
      }
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "library delete file error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── Files: signed download URL ────────────────────────────────────── */
router.get("/library/files/:id/download-url", requireAuth, async (req: any, res: Response) => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const [file] = await db
      .select()
      .from(teacherLibraryFilesTable)
      .where(and(eq(teacherLibraryFilesTable.id, id), eq(teacherLibraryFilesTable.teacherId, teacherId)));
    if (!file) {
      res.status(404).json({ message: "غير موجود" });
      return;
    }
    if (file.source === "link" && file.externalUrl) {
      res.json({ url: file.externalUrl, source: "link" });
      return;
    }
    if (!file.objectPath) {
      res.status(404).json({ message: "الملف غير متوفر" });
      return;
    }
    const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
    const url = await objectStorageService.signFileDownloadUrl(objectFile, 3600);
    res.json({ url, source: "upload" });
  } catch (err) {
    req.log.error(err, "library download url error");
    res.status(500).json({ message: "خطأ في توليد الرابط" });
  }
});

/* ── Files: extract questions with AI ─────────────────────────────── */
const MAX_TEXT_CHARS = 30000;

async function downloadFileBuffer(objectPath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
  const [metadata] = await objectFile.getMetadata();
  const [buffer] = await objectFile.download();
  return { buffer, contentType: (metadata.contentType as string) || "application/octet-stream" };
}

async function extractTextFromBuffer(
  buffer: Buffer,
  contentType: string,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();
  // PDF
  if (contentType.includes("pdf") || lower.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return (result.text || "").trim();
    } finally {
      try {
        await parser.destroy();
      } catch {
        /* noop */
      }
    }
  }
  // DOCX
  if (
    contentType.includes("wordprocessingml") ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || "").trim();
  }
  // PPTX
  if (
    contentType.includes("presentationml") ||
    lower.endsWith(".pptx")
  ) {
    const zip = await JSZip.loadAsync(buffer);
    const slidePaths = Object.keys(zip.files)
      .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
      .sort((a, b) => {
        const an = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || "0");
        const bn = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || "0");
        return an - bn;
      });
    const parts: string[] = [];
    for (const p of slidePaths) {
      const xml = await zip.files[p].async("string");
      const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
      const slideText = matches
        .map((m) => m.replace(/<[^>]+>/g, ""))
        .map((s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (slideText) parts.push(slideText);
    }
    return parts.join("\n\n").trim();
  }
  throw new Error("UNSUPPORTED_TYPE");
}

const ExtractQuestionsBody = z.object({
  count: z.number().int().min(1).max(30).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  subject: z.string().max(200).optional(),
  questionType: z.enum(["mcq", "true_false", "fill_blank"]).default("mcq"),
});

router.post("/library/files/:id/extract-questions", requireAuth, async (req: any, res: Response) => {
  const id = parseInt(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "معرّف غير صالح" });
    return;
  }
  const parsed = ExtractQuestionsBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة" });
    return;
  }
  try {
    const teacherId = req.session.teacherId;
    const [file] = await db
      .select()
      .from(teacherLibraryFilesTable)
      .where(and(eq(teacherLibraryFilesTable.id, id), eq(teacherLibraryFilesTable.teacherId, teacherId)));
    if (!file) {
      res.status(404).json({ message: "غير موجود" });
      return;
    }
    if (file.source !== "upload" || !file.objectPath) {
      res.status(400).json({ message: "هذه الميزة متاحة للملفات المرفوعة فقط" });
      return;
    }
    const lower = file.name.toLowerCase();
    const isSupported =
      file.fileType.includes("pdf") ||
      file.fileType.includes("wordprocessingml") ||
      file.fileType.includes("presentationml") ||
      lower.endsWith(".pdf") ||
      lower.endsWith(".docx") ||
      lower.endsWith(".pptx");
    if (!isSupported) {
      res.status(400).json({ message: "نوع الملف غير مدعوم لاستخراج الأسئلة (PDF/DOCX/PPTX فقط)" });
      return;
    }

    const { buffer, contentType } = await downloadFileBuffer(file.objectPath);

    let text = "";
    try {
      text = await extractTextFromBuffer(buffer, contentType || file.fileType, file.name);
    } catch (e: any) {
      req.log.error({ err: e }, "library extract text error");
      res.status(500).json({ message: "تعذر قراءة محتوى الملف" });
      return;
    }
    if (!text || text.length < 30) {
      res.status(400).json({ message: "لم يتم العثور على نص كافٍ في الملف لاستخراج الأسئلة" });
      return;
    }
    const truncated = text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;

    const { count, difficulty, subject, questionType } = parsed.data;
    const difficultyText = difficulty === "easy" ? "سهلة" : difficulty === "hard" ? "صعبة" : "متوسطة";

    let typeRules = "";
    let jsonShape = "";
    let typeHeading = "";
    if (questionType === "mcq") {
      typeHeading = "أسئلة الاختيار من متعدد";
      typeRules = `- كل سؤال له 4 خيارات (A, B, C, D)
- إجابة صحيحة واحدة فقط لكل سؤال
- مهم: وزّع الإجابات الصحيحة بشكل عشوائي بين A و B و C و D
- الخيارات الخاطئة يجب أن تكون منطقية ومعقولة`;
      jsonShape = `[
  {
    "text": "نص السؤال",
    "optionA": "الخيار أ",
    "optionB": "الخيار ب",
    "optionC": "الخيار ج",
    "optionD": "الخيار د",
    "correctAnswer": "B",
    "points": 1
  }
]`;
    } else if (questionType === "true_false") {
      typeHeading = "أسئلة صح أو خطأ";
      typeRules = `- كل سؤال عبارة صريحة يمكن الحكم عليها بـ "صح" أو "خطأ"
- لا تستخدم خيارات A/B/C/D، الإجابة هي "true" للصح أو "false" للخطأ فقط
- مهم: وزّع الإجابات بين true و false (تجنّب أن تكون كلها true أو كلها false)
- اجعل بعض العبارات الخاطئة قابلة للتصديق ظاهرياً (لتمييز الفهم الحقيقي)`;
      jsonShape = `[
  {
    "text": "نص العبارة",
    "correctAnswer": "true",
    "points": 1
  }
]`;
    } else {
      typeHeading = "أسئلة إكمال الفراغ";
      typeRules = `- كل سؤال جملة فيها فراغ واحد فقط ممثل بثلاث نقاط متتالية مثل "..." أو "_____"
- الإجابة الصحيحة هي الكلمة أو العبارة القصيرة التي تملأ الفراغ
- لا تستخدم خيارات A/B/C/D، الإجابة نص قصير مباشر
- اجعل الإجابة كلمة أو رقماً أو عبارة قصيرة لا تتجاوز عدة كلمات
- لا تكرر الإجابة داخل نص السؤال`;
      jsonShape = `[
  {
    "text": "نص السؤال يحتوي على ___ مكان الإجابة",
    "correctAnswer": "الإجابة الصحيحة",
    "points": 1
  }
]`;
    }

    const prompt = `أنت خبير تعليمي متخصص في إعداد ${typeHeading}.

المطلوب: استخرج ${count} سؤال من المحتوى التالي المأخوذ من ملف "${file.name}":
${subject ? `المادة: ${subject.trim()}` : ""}
الصعوبة: ${difficultyText}

المحتوى:
"""
${truncated}
"""

القواعد:
- استخرج الأسئلة من المحتوى أعلاه فقط
- الأسئلة بنفس لغة المحتوى (عربية في الغالب)
- الأسئلة متنوعة وتغطي جوانب مختلفة من المحتوى
- إذا كان المحتوى لا يكفي لعدد الأسئلة المطلوب، أنشئ بقدر ما يسمح المحتوى
${typeRules}

أعد النتيجة بتنسيق JSON فقط بدون أي نص إضافي:
${jsonShape}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من استخراج الأسئلة. حاول مرة أخرى." });
      return;
    }
    let raw: any[];
    try {
      raw = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ message: "خطأ في تنسيق الإجابة من الذكاء الاصطناعي. حاول مرة أخرى." });
      return;
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(500).json({ message: "لم يتم استخراج أسئلة صالحة. حاول مرة أخرى." });
      return;
    }

    const baseValid = raw.filter((q: any) => q && typeof q.text === "string" && q.text.trim());

    let validQuestions: any[] = [];
    if (questionType === "mcq") {
      validQuestions = baseValid
        .map((q: any) => ({
          questionType: "mcq" as const,
          text: String(q.text).trim(),
          optionA: typeof q.optionA === "string" ? q.optionA.trim() : "",
          optionB: typeof q.optionB === "string" ? q.optionB.trim() : "",
          optionC: typeof q.optionC === "string" ? q.optionC.trim() : "",
          optionD: typeof q.optionD === "string" ? q.optionD.trim() : "",
          correctAnswer: ["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A",
          points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
          sourceFileName: file.name,
        }))
        .filter((q) => q.optionA && q.optionB && q.optionC && q.optionD);
    } else if (questionType === "true_false") {
      validQuestions = baseValid
        .map((q: any) => {
          const ans = String(q.correctAnswer ?? "").toLowerCase().trim();
          const normalized =
            ans === "true" || ans === "صح" || ans === "صحيح" || ans === "نعم"
              ? "true"
              : ans === "false" || ans === "خطأ" || ans === "خطا" || ans === "غلط" || ans === "لا"
              ? "false"
              : null;
          return normalized
            ? {
                questionType: "true_false" as const,
                text: String(q.text).trim(),
                optionA: "",
                optionB: "",
                optionC: "",
                optionD: "",
                correctAnswer: normalized,
                points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
                sourceFileName: file.name,
              }
            : null;
        })
        .filter(Boolean) as any[];
    } else {
      // fill_blank
      validQuestions = baseValid
        .map((q: any) => {
          const answer = typeof q.correctAnswer === "string" ? q.correctAnswer.trim() : "";
          if (!answer) return null;
          return {
            questionType: "fill_blank" as const,
            text: String(q.text).trim(),
            optionA: "",
            optionB: "",
            optionC: "",
            optionD: "",
            correctAnswer: answer,
            points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
            sourceFileName: file.name,
          };
        })
        .filter(Boolean) as any[];
    }

    if (validQuestions.length === 0) {
      res.status(500).json({ message: "لم يتم استخراج أسئلة صالحة. حاول مرة أخرى." });
      return;
    }
    res.json({ questions: validQuestions, sourceFileName: file.name, questionType });
  } catch (err) {
    req.log.error(err, "library extract questions error");
    res.status(500).json({ message: "خطأ في استخراج الأسئلة" });
  }
});

/* ── Files: extract questions from multiple files (bulk) ──────────── */
const ExtractQuestionsBulkBody = z.object({
  fileIds: z.array(z.number().int()).min(2).max(10),
  count: z.number().int().min(1).max(30).default(10),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  subject: z.string().max(200).optional(),
});

router.post("/library/files/extract-questions-bulk", requireAuth, async (req: any, res: Response) => {
  const parsed = ExtractQuestionsBulkBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ message: "بيانات غير صالحة (يجب اختيار ملفين على الأقل)" });
    return;
  }
  const { fileIds, count, difficulty, subject } = parsed.data;
  const uniqueIds = Array.from(new Set(fileIds));
  try {
    const teacherId = req.session.teacherId;
    const filesRows = await db
      .select()
      .from(teacherLibraryFilesTable)
      .where(and(eq(teacherLibraryFilesTable.teacherId, teacherId), sql`${teacherLibraryFilesTable.id} = ANY(${uniqueIds})`));

    if (filesRows.length !== uniqueIds.length) {
      res.status(404).json({ message: "بعض الملفات غير موجودة" });
      return;
    }
    for (const f of filesRows) {
      if (f.source !== "upload" || !f.objectPath) {
        res.status(400).json({ message: `الملف "${f.name}" غير قابل للاستخراج` });
        return;
      }
      const lower = f.name.toLowerCase();
      const isSupported =
        f.fileType.includes("pdf") ||
        f.fileType.includes("wordprocessingml") ||
        f.fileType.includes("presentationml") ||
        lower.endsWith(".pdf") ||
        lower.endsWith(".docx") ||
        lower.endsWith(".pptx");
      if (!isSupported) {
        res.status(400).json({ message: `الملف "${f.name}" بصيغة غير مدعومة (PDF/DOCX/PPTX فقط)` });
        return;
      }
    }

    // Extract text from each file in parallel
    const perFileBudget = Math.floor(MAX_TEXT_CHARS / filesRows.length);
    const sections: { name: string; text: string }[] = [];
    const failed: string[] = [];
    await Promise.all(
      filesRows.map(async (f) => {
        try {
          const { buffer, contentType } = await downloadFileBuffer(f.objectPath!);
          const text = await extractTextFromBuffer(buffer, contentType || f.fileType, f.name);
          const trimmed = (text || "").trim();
          if (trimmed.length < 30) {
            failed.push(f.name);
            return;
          }
          sections.push({
            name: f.name,
            text: trimmed.length > perFileBudget ? trimmed.slice(0, perFileBudget) : trimmed,
          });
        } catch (e) {
          req.log.error({ err: e, fileId: f.id }, "library bulk extract text error");
          failed.push(f.name);
        }
      }),
    );

    if (sections.length === 0) {
      res.status(400).json({ message: "لم يتم العثور على نص كافٍ في أي من الملفات المختارة" });
      return;
    }

    const combined = sections
      .map((s, i) => `--- الملف ${i + 1}: ${s.name} ---\n${s.text}`)
      .join("\n\n");

    const difficultyText = difficulty === "easy" ? "سهلة" : difficulty === "hard" ? "صعبة" : "متوسطة";
    const fileNamesList = sections.map((s, i) => `${i + 1}) ${s.name}`).join("\n");

    const prompt = `أنت خبير تعليمي متخصص في إعداد أسئلة الاختيار من متعدد.

المطلوب: استخرج ${count} سؤال اختيار من متعدد بناءً على محتوى ${sections.length} ملف مدمج معاً (تغطي نفس الوحدة):
${fileNamesList}
${subject ? `المادة: ${subject.trim()}` : ""}
الصعوبة: ${difficultyText}

المحتوى المدمج:
"""
${combined}
"""

القواعد:
- استخرج الأسئلة من المحتوى أعلاه فقط
- وزّع الأسئلة بشكل متوازن بين الملفات قدر الإمكان
- كل سؤال له 4 خيارات (A, B, C, D)
- إجابة صحيحة واحدة فقط لكل سؤال
- مهم: وزّع الإجابات الصحيحة بشكل عشوائي بين A و B و C و D
- الأسئلة والخيارات بنفس لغة المحتوى (عربية في الغالب)
- الخيارات الخاطئة يجب أن تكون منطقية ومعقولة
- إذا كان المحتوى لا يكفي لعدد الأسئلة المطلوب، أنشئ بقدر ما يسمح المحتوى
- مهم جداً: لكل سؤال، حدّد رقم الملف المصدر (1 إلى ${sections.length}) في الحقل "sourceFile" بناءً على أي ملف استُمد منه السؤال

أعد النتيجة بتنسيق JSON فقط بدون أي نص إضافي:
[
  {
    "text": "نص السؤال",
    "optionA": "الخيار أ",
    "optionB": "الخيار ب",
    "optionC": "الخيار ج",
    "optionD": "الخيار د",
    "correctAnswer": "B",
    "points": 1,
    "sourceFile": 1
  }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = completion.choices[0]?.message?.content || "";
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
      res.status(500).json({ message: "لم يتمكن الذكاء الاصطناعي من استخراج الأسئلة. حاول مرة أخرى." });
      return;
    }
    let raw: any[];
    try {
      raw = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ message: "خطأ في تنسيق الإجابة من الذكاء الاصطناعي. حاول مرة أخرى." });
      return;
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(500).json({ message: "لم يتم استخراج أسئلة صالحة. حاول مرة أخرى." });
      return;
    }

    const validQuestions = raw
      .filter((q: any) => q && typeof q.text === "string" && q.text.trim())
      .map((q: any) => {
        let sourceFileName: string | undefined;
        const idx = typeof q.sourceFile === "number" ? q.sourceFile : parseInt(q.sourceFile);
        if (Number.isFinite(idx) && idx >= 1 && idx <= sections.length) {
          sourceFileName = sections[idx - 1].name;
        }
        return {
          text: String(q.text).trim(),
          optionA: typeof q.optionA === "string" ? q.optionA.trim() : "",
          optionB: typeof q.optionB === "string" ? q.optionB.trim() : "",
          optionC: typeof q.optionC === "string" ? q.optionC.trim() : "",
          optionD: typeof q.optionD === "string" ? q.optionD.trim() : "",
          correctAnswer: ["A", "B", "C", "D"].includes(q.correctAnswer) ? q.correctAnswer : "A",
          points: typeof q.points === "number" && q.points > 0 ? q.points : 1,
          sourceFileName,
        };
      });

    if (validQuestions.length === 0) {
      res.status(500).json({ message: "لم يتم استخراج أسئلة صالحة. حاول مرة أخرى." });
      return;
    }
    res.json({
      questions: validQuestions,
      sourceFileNames: sections.map((s) => s.name),
      skippedFileNames: failed,
    });
  } catch (err) {
    req.log.error(err, "library bulk extract questions error");
    res.status(500).json({ message: "خطأ في استخراج الأسئلة" });
  }
});

export default router;
