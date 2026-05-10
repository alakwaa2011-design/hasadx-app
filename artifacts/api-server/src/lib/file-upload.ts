/* Shared multi-file upload + multi-image vision helpers used by the
   worksheet AND lesson-plan AI extraction endpoints. Centralised so both
   features stay in lockstep on tier limits and how images/text from the
   uploaded sources are handed to the model. */
import multer from "multer";
import mammoth from "mammoth";
import type { RequestHandler } from "express";
import { db, teachersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { isClaudeTier, type AiTier } from "./ai-tier";
import { anthropic, SONNET_MODEL } from "./anthropic-client";

/* Tier limits.
   - Teachers (default): up to 5 files, 50 MB each.
   - Admins:             up to 25 files, 200 MB each (effectively unlimited
                         for practical use; bounded so a single request
                         can't OOM the worker).
   The middleware looks up the teacher's tier BEFORE multer runs and
   builds a per-request multer instance with that tier's exact caps,
   so a teacher request can never buffer more than 5 × 50 MB = 250 MB
   in memory regardless of what was sent. `processUploadedFiles`
   re-checks the same limits as defence-in-depth. */
export const TEACHER_MAX_FILES = 5;
export const TEACHER_MAX_BYTES = 50 * 1024 * 1024;
export const ADMIN_MAX_FILES = 25;
export const ADMIN_MAX_BYTES = 200 * 1024 * 1024;

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
]);
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;

/* Anthropic's vision API only accepts these media_type strings.
   "image/jpg" is a common but invalid alias and must be normalised. */
function normalizeImageMime(mime: string, lower: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (mime === "image/png" || lower.endsWith(".png")) return "image/png";
  if (mime === "image/webp" || lower.endsWith(".webp")) return "image/webp";
  if (mime === "image/gif" || lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/* Resolves the response language for upload-time errors, BEFORE multer
   has parsed the body. Falls back to Accept-Language; defaults to ar
   since this is an Arabic-first product. */
function resolveErrorLang(req: import("express").Request): "ar" | "en" {
  const fromQuery = (req.query?.language as string | undefined)?.toLowerCase();
  if (fromQuery === "ar" || fromQuery === "en") return fromQuery;
  const accept = req.headers["accept-language"]?.toString().split(",")[0]?.trim().toLowerCase() ?? "";
  return accept.startsWith("en") ? "en" : "ar";
}

/* Pre-fetched per-tier limits attached to the request by the
   middleware so route handlers don't re-query. */
interface TierLimits {
  isAdmin: boolean;
  maxFiles: number;
  maxBytes: number;
}
declare global {
  namespace Express {
    interface Request {
      tierLimits?: TierLimits;
    }
  }
}

/* Express middleware: looks up the teacher's admin flag FIRST, then
   builds a per-request multer instance limited to that tier's per-file
   size. This means a teacher request can never buffer more than
   5 × 50MB = 250MB and an admin request never more than 25 × 200MB =
   5GB. The post-parse `processUploadedFiles` then re-checks the same
   limits as a defence-in-depth measure (and to provide nicer errors).

   Auth: requires session.teacherId — must be mounted AFTER
   `requireTeacher`. */
export function createUploadFilesMiddleware(): RequestHandler {
  return async (req, res, next) => {
    const lang = resolveErrorLang(req);
    const ar = lang === "ar";
    const teacherId = req.session?.teacherId as number | undefined;
    if (!teacherId) {
      res.status(401).json({ message: ar ? "غير مصرّح" : "Unauthorized" });
      return;
    }

    /* Resolve admin flag once. Fail closed: missing row → not admin. */
    let isAdmin = false;
    try {
      const [row] = await db
        .select({ isAdmin: teachersTable.isAdmin })
        .from(teachersTable)
        .where(eq(teachersTable.id, teacherId))
        .limit(1);
      isAdmin = !!row?.isAdmin;
    } catch (err) {
      req.log?.error({ err }, "tier lookup failed");
      res.status(500).json({ message: ar ? "تعذّر التحقّق من الصلاحية" : "Tier lookup failed" });
      return;
    }

    const maxFiles = isAdmin ? ADMIN_MAX_FILES : TEACHER_MAX_FILES;
    const maxBytes = isAdmin ? ADMIN_MAX_BYTES : TEACHER_MAX_BYTES;
    req.tierLimits = { isAdmin, maxFiles, maxBytes };

    /* Per-request multer. The hard cap on `fileSize` here is what
       prevents memory exhaustion — multer aborts the upload as soon
       as any single part exceeds it, before it lands in RAM. */
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxBytes, files: maxFiles },
    });

    upload.array("files", maxFiles)(req, res, (err) => {
      if (!err) return next();
      const code = (err as { code?: string }).code;
      const mb = Math.round(maxBytes / (1024 * 1024));
      if (code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ message: ar ? `حجم أحد الملفات يتجاوز ${mb} ميجا` : `One of the files exceeds ${mb} MB` });
        return;
      }
      if (code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE") {
        res.status(413).json({ message: ar ? `عدد الملفات يتجاوز ${maxFiles}` : `Too many files (max ${maxFiles})` });
        return;
      }
      res.status(400).json({ message: ar ? "تعذّر قراءة الملفات المرفوعة" : "Could not read the uploaded files" });
    });
  };
}

export interface PreparedSource {
  /* Combined text extracted from PDFs / DOCX / plain text uploads. Each
     file's text is prefixed with a `--- filename ---` separator so the
     model can tell sources apart. Capped at MAX_TEXT_CHARS. */
  text: string;
  /* All image uploads, ready for the vision API. */
  images: Array<{ base64: string; mimeType: string }>;
  /* Sanitised originalname list for prompt context. */
  filenames: string[];
}

const MAX_TEXT_CHARS = 24000;

/* Validates per-tier limits, then walks each uploaded file and returns
   a normalised payload (combined text + image array). On validation
   failure it writes a JSON error response and returns null — the route
   should bail out without further processing. */
export async function processUploadedFiles(
  req: import("express").Request,
  res: import("express").Response,
  files: Express.Multer.File[],
  language: "ar" | "en",
): Promise<PreparedSource | null> {
  const ar = language === "ar";

  if (files.length === 0) {
    res.status(400).json({ message: ar ? "لم يتم رفع أي ملف" : "No file uploaded" });
    return null;
  }

  /* The upload middleware already resolved tier and capped per-file
     size; re-check here as defence-in-depth (and to friend-error if
     the middleware was somehow bypassed). */
  const limits = req.tierLimits ?? { isAdmin: false, maxFiles: TEACHER_MAX_FILES, maxBytes: TEACHER_MAX_BYTES };
  if (files.length > limits.maxFiles) {
    res.status(413).json({
      message: ar
        ? `الحد الأقصى ${limits.maxFiles} ملفات لكل عملية`
        : `Maximum ${limits.maxFiles} files per request`,
    });
    return null;
  }
  for (const f of files) {
    if (f.size > limits.maxBytes) {
      const mb = Math.round(limits.maxBytes / (1024 * 1024));
      res.status(413).json({
        message: ar
          ? `الملف "${f.originalname}" يتجاوز ${mb} ميجا`
          : `File "${f.originalname}" exceeds ${mb} MB`,
      });
      return null;
    }
  }

  const images: PreparedSource["images"] = [];
  const textParts: string[] = [];
  const filenames: string[] = [];

  for (const file of files) {
    const lower = (file.originalname || "").toLowerCase();
    const mime = file.mimetype || "";
    filenames.push(file.originalname || "file");

    const looksLikeImage =
      ALLOWED_IMAGE_MIMES.has(mime) ||
      (mime === "" && IMAGE_EXT_RE.test(lower)) ||
      (mime.startsWith("image/") && IMAGE_EXT_RE.test(lower));
    const looksLikePdf = mime === "application/pdf" || lower.endsWith(".pdf");
    const looksLikeDocx =
      mime.includes("wordprocessingml") ||
      mime === "application/msword" ||
      /\.(docx?|odt)$/i.test(lower);
    const looksLikeText = mime.startsWith("text/") || /\.(txt|md)$/i.test(lower);

    /* Reject SVG/HEIC/TIFF up-front so the user gets a clean error
       rather than a model failure two seconds later. */
    if (mime.startsWith("image/") && !looksLikeImage) {
      res.status(415).json({
        message: ar
          ? `نوع الصورة غير مدعوم: ${file.originalname} (المسموح: JPG, PNG, WEBP, GIF)`
          : `Image type not supported: ${file.originalname} (use JPG, PNG, WEBP, GIF)`,
      });
      return null;
    }
    if (!looksLikeImage && !looksLikePdf && !looksLikeDocx && !looksLikeText) {
      res.status(415).json({
        message: ar
          ? `نوع الملف غير مدعوم: ${file.originalname}`
          : `Unsupported file type: ${file.originalname}`,
      });
      return null;
    }

    if (looksLikeImage) {
      /* Normalise to one of Anthropic's accepted media_type values.
         Critical: "image/jpg" is rejected by Anthropic — must become
         "image/jpeg". Also covers blank-mime uploads via extension. */
      const imgMime = normalizeImageMime(mime, lower);
      images.push({ base64: file.buffer.toString("base64"), mimeType: imgMime });
      continue;
    }

    if (looksLikePdf) {
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        try {
          const result = await parser.getText();
          const t = (result.text || "").trim();
          if (t) textParts.push(`--- ${file.originalname} ---\n${t}`);
        } finally {
          try { await parser.destroy(); } catch { /* noop */ }
        }
      } catch (err) {
        req.log?.warn({ err, file: file.originalname }, "pdf-parse failed");
        res.status(422).json({
          message: ar
            ? `تعذّر قراءة ملف PDF: ${file.originalname}`
            : `Could not read PDF: ${file.originalname}`,
        });
        return null;
      }
      continue;
    }

    if (looksLikeDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        const t = (result.value || "").trim();
        if (t) textParts.push(`--- ${file.originalname} ---\n${t}`);
      } catch (err) {
        req.log?.warn({ err, file: file.originalname }, "mammoth failed");
        res.status(422).json({
          message: ar
            ? `تعذّر قراءة ملف Word: ${file.originalname}`
            : `Could not read Word file: ${file.originalname}`,
        });
        return null;
      }
      continue;
    }

    /* Plain text fallback. */
    const t = file.buffer.toString("utf8").trim();
    if (t) textParts.push(`--- ${file.originalname} ---\n${t}`);
  }

  let text = textParts.join("\n\n");
  if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);

  /* Need at least something to feed the model. */
  if (images.length === 0 && text.trim().length < 5) {
    res.status(422).json({
      message: ar
        ? "لم يتم العثور على نص أو صور قابلة للقراءة في الملفات"
        : "No readable text or images found in the uploaded files",
    });
    return null;
  }

  return { text, images, filenames };
}

/* Multi-image vision completion. Hands all images + the prompt to the
   model in a single request. Anthropic Claude Sonnet for the claude
   tier; gpt-4o-mini for everything else (vision-capable, cheap, and
   safer than the pro text model which isn't vision). */
export async function runVisionCompletionMulti(opts: {
  tier: AiTier;
  prompt: string;
  images: Array<{ base64: string; mimeType: string }>;
  maxTokens: number;
}): Promise<string> {
  if (opts.images.length === 0) {
    throw new Error("runVisionCompletionMulti called with no images");
  }
  if (isClaudeTier(opts.tier)) {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: opts.maxTokens,
      messages: [{
        role: "user",
        content: [
          ...opts.images.map((img) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              /* `mimeType` was already normalised by `normalizeImageMime`
                 in `processUploadedFiles`, so this cast is safe. */
              media_type: img.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: img.base64,
            },
          })),
          { type: "text" as const, text: opts.prompt },
        ],
      }],
    });
    const block = response.content.find((c) => c.type === "text");
    return block && "text" in block ? block.text : "";
  }
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: opts.maxTokens,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: opts.prompt },
        ...opts.images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ],
    }],
  });
  return completion.choices[0]?.message?.content || "";
}
