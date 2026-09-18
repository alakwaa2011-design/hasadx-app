import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { featureAccess } from "@workspace/billing";
import { hasAiVideoAdminAccess } from "../lib/ai-video-access";
import {
  hasLegacySchoolLogoReference,
  teacherHasLegacyObjectReference,
  teacherHasParentAttachmentReference,
} from "../lib/legacy-object-access";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
const LEGACY_SCHOOL_LOGO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
]);

function legacyTypeLimit(contentType: string): number | null {
  if (contentType.startsWith("video/")) return MAX_VIDEO_BYTES;
  if (contentType.startsWith("audio/")) return MAX_AUDIO_BYTES;
  if (contentType.startsWith("image/")) return MAX_IMAGE_BYTES;
  if ([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
  ].includes(contentType)) return MAX_ATTACHMENT_BYTES;
  return null;
}

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number().finite().int().positive(),
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
   const MAX_SIZE = MAX_VIDEO_BYTES;
  if (size > MAX_SIZE) {
    res.status(400).json({ error: "File size exceeds 500MB limit" });
    return;
  }

  try {
     const uploadURL = await objectStorageService.getObjectEntityUploadURL(`uploads/${req.session.teacherId}`);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

     res.json({ uploadURL, objectPath, uploadTicket: objectStorageService.issueUploadTicket({ objectPath, teacherId: req.session.teacherId, purpose: "video", contentType, maxBytes: MAX_VIDEO_BYTES, videoEntitled: sub.planCode !== "free" || sub.isAdmin }), finalizeURL: "/storage/uploads/finalize", metadata: { name, size, contentType } });
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
   const MAX_SIZE = MAX_IMAGE_BYTES;
  if (size > MAX_SIZE) {
    res.status(400).json({ error: "Image exceeds 10MB limit" });
    return;
  }

  try {
     const uploadURL = await objectStorageService.getObjectEntityUploadURL(`uploads/${req.session.teacherId}`);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

     res.json({ uploadURL, objectPath, uploadTicket: objectStorageService.issueUploadTicket({ objectPath, teacherId: req.session.teacherId, purpose: "image", contentType, maxBytes: MAX_IMAGE_BYTES }), finalizeURL: "/storage/uploads/finalize", metadata: { name, size, contentType } });
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
     "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif",
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
   const MAX_SIZE = MAX_ATTACHMENT_BYTES;
  if (size > MAX_SIZE) {
    res.status(400).json({ error: "حجم الملف يتجاوز 20MB" });
    return;
  }

  try {
     const uploadURL = await objectStorageService.getObjectEntityUploadURL(`uploads/${req.session.teacherId}`);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, uploadTicket: objectStorageService.issueUploadTicket({ objectPath, teacherId: req.session.teacherId, purpose: "attachment", contentType, maxBytes: MAX_ATTACHMENT_BYTES }), finalizeURL: "/storage/uploads/finalize", metadata: { name, size, contentType } });
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
   const MAX_SIZE = MAX_AUDIO_BYTES;
  if (size > MAX_SIZE) {
    res.status(400).json({ error: "Audio file exceeds 30MB limit" });
    return;
  }

  try {
     const uploadURL = await objectStorageService.getObjectEntityUploadURL(`uploads/${req.session.teacherId}`);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath, uploadTicket: objectStorageService.issueUploadTicket({ objectPath, teacherId: req.session.teacherId, purpose: "audio", contentType, maxBytes: MAX_AUDIO_BYTES }), finalizeURL: "/storage/uploads/finalize", metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating audio upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/* Direct PUT uploads are untrusted until this authenticated finalization call.
 * The owner prefix is part of the object path issued above, so a teacher
 * cannot finalize another teacher's reservation. */
const FinalizeDirectUploadBody = z.object({
  objectPath: z.string().min(1),
  uploadTicket: z.string().min(1),
});
router.post("/storage/uploads/finalize", async (req: Request, res: Response) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = FinalizeDirectUploadBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.objectPath.startsWith(`/objects/uploads/${teacherId}/`)) {
    res.status(403).json({ error: "Upload ownership could not be verified" });
    return;
  }
  const { objectPath, uploadTicket } = parsed.data;
  try {
    const ticket = objectStorageService.verifyUploadTicket(uploadTicket, { objectPath, teacherId });
    if (!["video", "image", "attachment", "audio"].includes(ticket.purpose) ||
        (ticket.purpose === "video" && ticket.videoEntitled !== true)) throw new Error("INVALID_UPLOAD_TICKET");
    const verified = await objectStorageService.verifyUploadedObject(objectPath, ticket.contentType, ticket.maxBytes);
    res.json({ objectPath, size: verified.size, contentType: verified.contentType, finalized: true });
  } catch (error: any) {
    try { await objectStorageService.tryDeleteObjectEntity(objectPath); } catch { /* best effort quarantine */ }
    const code = error?.message === "INVALID_UPLOAD_SIZE" ? 413 :
      error?.message === "UPLOAD_TYPE_MISMATCH" ? 400 : 404;
    res.status(code).json({ error: code === 413 ? "Uploaded object exceeds the size limit" :
      code === 400 ? "Uploaded bytes do not match the permitted type" : "Uploaded object not found" });
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
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src data:");
    const publicType = response.headers.get("content-type") || "";
    if (/(?:svg|html|xml|javascript|xhtml)/i.test(publicType)) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", "attachment");
    }

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
    const directUploadOwner = wildcardPath.match(/^uploads\/(\d+)\//)?.[1];
    const parentUploadOwner = wildcardPath.match(/^uploads\/parent\/([a-f0-9]{32})\//)?.[1];
    const isLegacyUpload = /^uploads\/[^/]+$/.test(wildcardPath);
    if (directUploadOwner && Number(directUploadOwner) !== req.session?.teacherId) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    if (directUploadOwner && !req.session?.teacherId) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    if (parentUploadOwner && !req.session?.teacherId) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
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
    const rawContentType = (metadata.contentType as string) || "application/octet-stream";
    const validMarker = metadata.metadata?.verifiedUpload === "true" &&
      metadata.metadata?.verifiedGeneration === String(metadata.generation || "");

    if (isLegacyUpload) {
      const publiclyReadable = await objectStorageService.canAccessObjectEntity({
        objectFile,
      });
      const publicSchoolLogo = await hasLegacySchoolLogoReference(objectPath);
      const teacherReferenced = Boolean(req.session?.teacherId) &&
        await teacherHasLegacyObjectReference(req.session.teacherId!, objectPath);
      const validPublicSchoolLogo = publicSchoolLogo &&
        LEGACY_SCHOOL_LOGO_TYPES.has(rawContentType);
      if (!publiclyReadable && !validPublicSchoolLogo && !teacherReferenced) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      const maxBytes = legacyTypeLimit(rawContentType);
      if (!maxBytes) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      await objectStorageService.inspectUploadedObject(objectPath, rawContentType, maxBytes);
    } else if (parentUploadOwner) {
      const teacherReferenced = Boolean(req.session?.teacherId) &&
        await teacherHasParentAttachmentReference(req.session.teacherId!, objectPath);
      if (!validMarker || metadata.metadata?.parentOwner !== parentUploadOwner ||
          !teacherReferenced) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
    } else if (directUploadOwner && !validMarker) {
      res.status(404).json({ error: "Object not found" });
      return;
    } else if (directUploadOwner && metadata.metadata?.verifiedGeneration !== String(metadata.generation || "")) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    if (isLegacyUpload && validMarker) {
      // A flat path remains legacy by inventory shape even if it was
      // individually finalized later; its DB/ACL authorization above remains
      // mandatory and the marker never replaces ownership proof.
      if (metadata.metadata?.verifiedGeneration !== String(metadata.generation || "")) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
    }
    const contentType = /(?:svg|html|xml|javascript|xhtml)/i.test(rawContentType)
      ? "application/octet-stream" : rawContentType;

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
     const ACTIVE_TYPES = /svg|html|xml|javascript|xhtml/i;
     if (ACTIVE_TYPES.test(rawContentType) || contentType === "application/octet-stream") {
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
