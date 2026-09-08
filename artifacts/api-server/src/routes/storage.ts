import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { featureAccess } from "@workspace/billing";
import { hasAiVideoAdminAccess } from "../lib/ai-video-access";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number(),
  contentType: z.string(),
});

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!req.session.teacherId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Video upload is restricted to Basic and Pro subscribers (+ admins)
  const sub = await featureAccess.getSubscription(req.session.teacherId);
  if (sub.planCode === "free" && !sub.isAdmin) {
    res.status(403).json({
      error: "VIDEO_UPLOAD_RESTRICTED",
      message: "Video upload from device is available for Basic and Pro subscribers only",
    });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name, size, contentType } = parsed.data;
  if (!contentType.startsWith("video/")) {
    res.status(400).json({ error: "Only video files are allowed" });
    return;
  }
  const MAX_SIZE = 500 * 1024 * 1024;
  if (size > MAX_SIZE) {
    res.status(400).json({ error: "File size exceeds 500MB limit" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.post("/storage/uploads/request-image-url", async (req: Request, res: Response) => {
  if (!req.session.teacherId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name, size, contentType } = parsed.data;
  // قائمة صيغ نقطية صارمة — SVG مرفوض لأنه قد يحمل سكربتات (stored XSS)
  const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif",
  ]);
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    res.status(400).json({ error: "Only raster image files are allowed (JPEG/PNG/WebP/GIF/AVIF/HEIC)" });
    return;
  }
  const MAX_SIZE = 10 * 1024 * 1024;
  if (size > MAX_SIZE) {
    res.status(400).json({ error: "Image exceeds 10MB limit" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating image upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.post("/storage/uploads/request-attachment-url", async (req: Request, res: Response) => {
  if (!req.session.teacherId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name, size, contentType } = parsed.data;
  const ALLOWED = [
    "image/",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ];
  const allowed = ALLOWED.some(t => contentType.startsWith(t));
  if (!allowed) {
    res.status(400).json({ error: "نوع الملف غير مدعوم. المسموح به: صور، PDF، Word، Excel، PowerPoint" });
    return;
  }
  const MAX_SIZE = 20 * 1024 * 1024;
  if (size > MAX_SIZE) {
    res.status(400).json({ error: "حجم الملف يتجاوز 20MB" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating attachment upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.post("/storage/uploads/request-audio-url", async (req: Request, res: Response) => {
  if (!req.session.teacherId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { name, size, contentType } = parsed.data;
  if (!contentType.startsWith("audio/")) {
    res.status(400).json({ error: "Only audio files are allowed" });
    return;
  }
  const MAX_SIZE = 30 * 1024 * 1024;
  if (size > MAX_SIZE) {
    res.status(400).json({ error: "Audio file exceeds 30MB limit" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating audio upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

async function serveObject(req: Request, res: Response) {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const economyVideoOwner = wildcardPath.match(/^uploads\/ai-video-economy\/(\d+)\//)?.[1];
    const advancedVideoOwner = wildcardPath.match(/^uploads\/ai-video\/(\d+)\//)?.[1];
    const aiVideoOwner = economyVideoOwner ?? advancedVideoOwner;
    if (aiVideoOwner && Number(aiVideoOwner) !== req.session?.teacherId) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    if (advancedVideoOwner && !(await hasAiVideoAdminAccess(req.session.teacherId!))) {
      res.status(403).json({ error: "ADMIN_ONLY" });
      return;
    }
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const [metadata] = await objectFile.getMetadata();
    const contentType = (metadata.contentType as string) || "application/octet-stream";

    if (contentType.startsWith("video/")) {
      const signedUrl = await objectStorageService.signFileDownloadUrl(objectFile, 3600);
      res.setHeader("Cache-Control", "private, no-store");
      res.redirect(302, signedUrl);
      return;
    }

    const totalSize = parseInt(String(metadata.size || 0), 10);

    res.status(200);
    res.setHeader("Content-Type", contentType);
    if (totalSize > 0) res.setHeader("Content-Length", totalSize);
    res.setHeader("Cache-Control", "private, max-age=3600");
    // دفاع ضد stored XSS: المحتوى المرفوع من المستخدمين لا يُنفَّذ أبداً كسكربت —
    // CSP يمنع تنفيذ أي سكربت داخل SVG/HTML مخزن، وnosniff يمنع تخمين النوع
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    // الأنواع النشطة (SVG/HTML/XML) تُنزَّل كملف بدل عرضها في سياق نفس الموقع
    const ACTIVE_TYPES = /svg|html|xml|javascript/i;
    if (ACTIVE_TYPES.test(contentType)) {
      res.setHeader("Content-Disposition", "attachment");
    }

    const stream = objectFile.createReadStream();
    stream.on("error", (err) => {
      req.log.error({ err }, "Stream error serving object");
      if (!res.headersSent) res.status(500).end();
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
}

router.get("/objects/*path", serveObject);
router.get("/storage/objects/*path", serveObject);

export default router;
