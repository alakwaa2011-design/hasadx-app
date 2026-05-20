import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { ObjectStorageService } from "../lib/objectStorage";
import { awardXpInTxAndNotifyAfterCommit } from "../lib/xp/socket";
import {
  parsePptx,
  parsePdf,
  parseDocx,
  buildSlidesFromParsed,
  buildSlidesFromPdfPages,
} from "../lib/import-file-parser";
import { db, presentationsTable, presentationAssetsTable, teachersTable, assignmentsTable, questionBankTable } from "@workspace/db";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import slugify from "slugify";
import { presentationExportLimiter } from "../lib/rate-limiter";
import { buildPptx, type PresentationForExport } from "../lib/presentation-pptx";
import { buildPdf } from "../lib/presentation-pdf";
import { mintExportToken, verifyExportToken } from "../lib/export-token";
import { resolvePresentationsTier, getPresentationUsage } from "../lib/presentations-tier";
import { extractFileContent } from "../lib/file-extractor";
import { fileToOutline, multiImagesToOutline } from "../lib/file-to-outline";
import { buildOneSlide } from "../lib/materialize-slide";
import { findWebImagesBatch, searchPresentationWebImages } from "../lib/web-image-search";

const router: IRouter = Router();

/* Curated tasteful default themes for new decks (May 2026 redesign).
   Mirror of TASTEFUL_DEFAULT_THEMES in the homework-app's slide-themes
   registry. Excludes the loud / saturated palettes (harvest, sunset,
   rose, royal, noor) so a freshly-created deck does not feel like a
   primary-school poster. */
const SERVER_DEFAULT_THEMES = [
  "mist", "obsidian", "linen", "ink", "sage", "ocean", "pine", "clay",
] as const;
function pickServerDefaultTheme(): string {
  return SERVER_DEFAULT_THEMES[
    Math.floor(Math.random() * SERVER_DEFAULT_THEMES.length)
  ];
}

/* ── Auth middleware (session-based). Mirrors the pattern used by
   worksheets.ts / lesson_plans.ts so behavior across teacher-content
   routes stays consistent. */
function requireTeacher(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

/* ── Hydrate Phase 2A bank-linked activity elements.
   Storage stays normalized (the slide JSONB only carries `questionId`
   for bank picks — see picker `submitFromBank`) but every read path
   that feeds a renderer (editor GET, public GET, export-data) needs
   the prompt/options/correctIndex resolved so the activity card isn't
   blank. We do one IN(...) over the union of referenced ids and
   overlay the fields per slide element without mutating the row that
   gets written back to the DB. */
/**
 * Resolves the origin puppeteer should navigate to when rendering the
 * print page for PDF export. We intentionally do NOT trust request
 * headers (`Host` / `X-Forwarded-*` are client-controllable in many
 * setups and would let an authenticated teacher redirect the headless
 * chromium to arbitrary internal hosts — a classic SSRF). Instead we
 * walk a closed allowlist of env-provided origins, in priority order:
 *   1) `APP_ORIGIN` — explicit operator override.
 *   2) First entry of `REPLIT_DOMAINS` (https) — the public domain
 *      assigned to the deployment by Replit. Required in production:
 *      each artifact deploys to its own image, so `localhost:80` does
 *      NOT proxy to the homework-app there (this caused
 *      `net::ERR_CONNECTION_REFUSED` and a 500 on every prod export
 *      until this fallback was added).
 *   3) `REPLIT_DEV_DOMAIN` (https) — the workspace dev URL.
 *   4) `http://localhost:80` — the shared-proxy loopback in dev.
 * Each candidate is parsed with `URL` and only http/https origins are
 * accepted; invalid entries are silently skipped.
 */
export function resolveExportOrigin(env: NodeJS.ProcessEnv): string {
  const firstReplDomain = env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const candidates: Array<string | undefined> = [
    env.APP_ORIGIN,
    firstReplDomain ? `https://${firstReplDomain}` : undefined,
    env.REPLIT_DEV_DOMAIN ? `https://${env.REPLIT_DEV_DOMAIN}` : undefined,
    "http://localhost:80",
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const u = new URL(candidate);
      if (u.protocol === "http:" || u.protocol === "https:") {
        return u.origin;
      }
    } catch { /* skip invalid candidate */ }
  }
  return "http://localhost:80";
}

export async function hydrateActivityQuestions(slides: unknown): Promise<unknown> {
  if (!Array.isArray(slides)) return slides;
  const ids = new Set<number>();
  for (const s of slides) {
    const els = (s as { elements?: unknown }).elements;
    if (!Array.isArray(els)) continue;
    for (const el of els) {
      const e = el as { kind?: string; questionId?: unknown };
      if (e.kind === "activity" && typeof e.questionId === "number") ids.add(e.questionId);
    }
  }
  if (ids.size === 0) return slides;
  const rows = await db
    .select({
      id: questionBankTable.id,
      text: questionBankTable.text,
      questionType: questionBankTable.questionType,
      optionA: questionBankTable.optionA,
      optionB: questionBankTable.optionB,
      optionC: questionBankTable.optionC,
      optionD: questionBankTable.optionD,
      correctAnswer: questionBankTable.correctAnswer,
    })
    .from(questionBankTable)
    .where(inArray(questionBankTable.id, Array.from(ids)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return slides.map((s) => {
    const slide = s as { elements?: unknown[] };
    if (!Array.isArray(slide.elements)) return s;
    return {
      ...slide,
      elements: slide.elements.map((el) => {
        const e = el as Record<string, unknown>;
        if (e.kind !== "activity" || typeof e.questionId !== "number") return el;
        const q = byId.get(e.questionId as number);
        if (!q) return el;
        const opts = [q.optionA, q.optionB, q.optionC, q.optionD].filter(
          (o): o is string => typeof o === "string" && o.trim().length > 0,
        );
        const letter = (q.correctAnswer ?? "").toUpperCase();
        const correctIndex = letter >= "A" && letter <= "D" ? letter.charCodeAt(0) - 65 : undefined;
        const activityKind =
          q.questionType === "true_false" ? "true_false"
          : q.questionType === "open" ? "open"
          : "mcq";
        return {
          ...e,
          activityKind: e.activityKind ?? activityKind,
          prompt: e.prompt ?? q.text,
          options: e.options ?? (activityKind === "true_false" ? ["صح", "خطأ"] : opts),
          correctIndex: e.correctIndex ?? correctIndex,
        };
      }),
    };
  });
}

/* ── Slide-element discriminated union. Every variant constrains its
   own fields with bounded sizes so neither manual edits nor future AI
   generators can sneak unbounded payloads into the JSONB column. */
const colorSchema = z.string().max(40); // hex / rgba / css color name
/* Slide-level background can be either a flat color OR a long CSS
   mesh gradient string (multi-radial + base linear, see
   lib/slide-templates/themes.ts). Bounded generously to prevent
   payload abuse but wide enough for the longest registered mesh
   (~480 chars today; cap at 2k to leave headroom for future themes
   and any custom CSS the editor may surface). */
const slideBackgroundSchema = z.string().max(2000);
const baseElement = z.object({
  id: z.string().min(1).max(64),
  x: z.number().min(-2000).max(4000),
  y: z.number().min(-2000).max(4000),
  w: z.number().min(1).max(4000),
  h: z.number().min(1).max(4000),
  rotation: z.number().min(-360).max(360).optional(),
  zIndex: z.number().int().min(0).max(999).optional(),
});

const textElement = baseElement.extend({
  kind: z.literal("text"),
  text: z.string().max(5000).default(""),
  fontFamily: z.string().max(80).optional(),
  fontSize: z.number().min(6).max(220).optional(),
  fontWeight: z.string().max(20).optional(),
  align: z.enum(["start", "center", "end", "justify"]).optional(),
  color: colorSchema.optional(),
  bgColor: colorSchema.optional(),
});

const imageElement = baseElement.extend({
  kind: z.literal("image"),
  url: z.string().min(1).max(2000),
  objectFit: z.enum(["cover", "contain", "fill", "none"]).optional(),
  objectPosition: z.string().max(40).optional(),
  imageOpacity: z.number().min(0).max(1).optional(),
  imageBorderRadius: z.number().min(0).max(500).optional(),
});

const iconElement = baseElement.extend({
  kind: z.literal("icon"),
  iconName: z.string().min(1).max(60),
  color: colorSchema.optional(),
});

const shapeElement = baseElement.extend({
  kind: z.literal("shape"),
  shape: z.enum(["rect", "circle", "line", "arrow", "divider"]),
  bgColor: colorSchema.optional(),
  borderColor: colorSchema.optional(),
  borderWidth: z.number().min(0).max(40).optional(),
});

/* Phase 2A — embedded activity element. Lives inside a slide's
   `elements` array as the 5th element kind. Either holds inline
   question content or references a `questionBank` row by id (in which
   case we still copy `prompt` for display). The actual interactive
   "answer" runtime ships in Phase 2B; for now this element is a
   styled read-only card in present mode + exports. */
const activityElement = baseElement.extend({
  kind: z.literal("activity"),
  activityKind: z.enum(["mcq", "true_false", "open", "poll", "word_cloud", "open_wall"]),
  /* Optional pointer into question_bank. When present, `prompt` may be
     omitted — the renderer/exporter resolves the question text from
     the bank by id (questionId-only reference path). When absent, the
     activity is fully inline and `prompt` is required. */
  questionId: z.number().int().positive().optional(),
  prompt: z.string().min(1).max(2000).optional(),
  options: z.array(z.string().max(500)).max(8).optional(),
  correctIndex: z.number().int().min(0).max(7).optional(),
  accentColor: colorSchema.optional(),
});
/* Note: we intentionally do not chain `.refine()` here because that
   would convert this schema into a ZodEffects and break
   `z.discriminatedUnion`. The "questionId XOR prompt" rule is enforced
   manually inside the PUT handler. */

/* Phase 3 — "AI Activity Bridge". A `hasad-game` element is a launcher
   for one of the platform's live games (Kahoot, Wheel, Millionaire,
   etc.). When the teacher opens it from the live control panel the
   server forwards a `game:launch` event to the room with the URL each
   student can tap to join the game on their own device. */
/* A complete question payload that can be played inside Hasad's
   in-platform Activity Runner. The AI Director generates this set
   when it suggests a game on a slide so the teacher's "Start
   activity" button has the full quiz ready, not a placeholder. */
const gameQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
});

const hasadGameElement = baseElement.extend({
  kind: z.literal("hasad-game"),
  gameKind: z.enum([
    "kahoot", "wheel", "millionaire", "flag-quiz", "capitals",
    "letrly", "rocket", "tug", "maraqui", "hack",
  ]),
  prompt: z.string().min(1).max(200).optional(),
  topic: z.string().max(200).optional(),
  accentColor: colorSchema.optional(),
  /* AI-generated complete question set. When present, the editor and
     live-control "Start activity" button open the in-Hasad Activity
     Runner pre-loaded with these questions instead of the legacy
     game-setup page. */
  questions: z.array(gameQuestionSchema).max(20).optional(),
});

/* Video embed element — YouTube or Hasad interactive video lesson.
   `url` is the original pasted link; `videoKind` and `videoId` are
   parsed on the client and stored so the renderer can build the embed
   URL without re-parsing. `title` is an optional display label. */
const videoEmbedElement = baseElement.extend({
  kind: z.literal("video-embed"),
  url: z.string().min(1).max(2000),
  videoKind: z.enum(["youtube", "hasad-video"]),
  videoId: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
});

const elementSchema = z.discriminatedUnion("kind", [
  textElement,
  imageElement,
  iconElement,
  shapeElement,
  activityElement,
  hasadGameElement,
  videoEmbedElement,
]);

const slideSchema = z.object({
  id: z.string().min(1).max(64),
  layout: z.string().max(40).optional(),
  background: slideBackgroundSchema.optional(),
  backgroundImage: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  elements: z.array(elementSchema).max(80).default([]),
});

const slidesSchema = z.array(slideSchema).max(200);

/* Re-exported so the AI presentation builder (Phase 1B) can validate
   freshly materialized slides against the same discriminated union the
   PUT route enforces. Keeping a single source of truth avoids drift. */
export { slideSchema, slidesSchema };

const languageSchema = z.enum(["ar", "en"]);

const createBody = z.object({
  title: z.string().min(1).max(200),
  language: languageSchema.default("ar"),
  subject: z.string().max(100).nullish(),
  gradeLevel: z.string().max(50).nullish(),
  theme: z.string().max(40).optional(),
  pattern: z.string().max(40).optional(),
  coverEmoji: z.string().max(8).nullish(),
});

const updateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  language: languageSchema.optional(),
  subject: z.string().max(100).nullish(),
  gradeLevel: z.string().max(50).nullish(),
  theme: z.string().max(40).optional(),
  pattern: z.string().max(40).optional(),
  coverEmoji: z.string().max(8).nullish(),
  description: z.string().max(2000).nullish(),
  slides: slidesSchema.optional(),
});

/* Phase 2A — body for PATCH /presentations/:id/link-activity. Pass
   `activityId: null` to detach. `activityKind` defaults to "assignment"
   so the UI doesn't need to send it. */
const linkActivityBody = z.object({
  activityId: z.union([z.number().int().positive(), z.null()]),
  activityKind: z.string().min(1).max(40).default("assignment"),
});

/* Detect language from a block of text: "ar" if >15% of chars are Arabic. */
function detectLangFromText(text: string): "ar" | "en" {
  if (!text.trim()) return "ar";
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arabicChars / text.length > 0.15 ? "ar" : "en";
}

/* ── Default slide payload used when a deck is freshly created so the
   editor has something to render immediately. */
function defaultSlides(language: "ar" | "en") {
  const ar = language === "ar";
  return [
    {
      id: "s1",
      layout: "cover",
      background: "#ffffff",
      elements: [
        {
          id: "t1",
          kind: "text" as const,
          x: 80,
          y: 240,
          w: 1120,
          h: 120,
          text: ar ? "عنوان العرض" : "Presentation title",
          fontSize: 56,
          fontWeight: "700",
          align: "center" as const,
          color: "#225739",
        },
      ],
    },
  ];
}

/* ── Tier resolver. Returns the effective tier (regular/pro) for the
   current teacher plus the active limit values pulled from
   `platform_settings.presentation_limits`. UI uses this to show lock
   badges, "X / Y slides" usage bars, and the upgrade CTA. Must come
   BEFORE the `/presentations/:id` matcher so "limits" isn't parsed
   as an id. */
router.get("/presentations/limits", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const tier = await resolvePresentationsTier(teacherId);
    res.json(tier);
  } catch (err) {
    req.log.error({ err }, "Resolve presentations tier failed");
    res.status(500).json({ message: "Failed to load tier" });
  }
});

router.get("/presentations/:id/usage", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ message: "Bad id" }); return; }
    if (!(await ownsPresentation(teacherId, id))) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const [tier, usage] = await Promise.all([
      resolvePresentationsTier(teacherId),
      getPresentationUsage(id),
    ]);
    res.json({ ...tier, usage });
  } catch (err) {
    req.log.error({ err }, "Get presentation usage failed");
    res.status(500).json({ message: "Failed to load usage" });
  }
});

/* ── List: own decks + admin-shared. Mirrors lesson_plans/worksheets
   list shape but returns a slim summary (slideCount instead of full
   slides JSONB) to keep the list endpoint lean. */
router.get("/presentations", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const rows = await db
      .select({
        id: presentationsTable.id,
        teacherId: presentationsTable.teacherId,
        title: presentationsTable.title,
        language: presentationsTable.language,
        theme: presentationsTable.theme,
        pattern: presentationsTable.pattern,
        coverEmoji: presentationsTable.coverEmoji,
        slides: presentationsTable.slides,
        status: presentationsTable.status,
        publishedAt: presentationsTable.publishedAt,
        isShared: presentationsTable.isShared,
        createdAt: presentationsTable.createdAt,
        updatedAt: presentationsTable.updatedAt,
        ownerName: teachersTable.name,
        ownerIsAdmin: teachersTable.isAdmin,
      })
      .from(presentationsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, presentationsTable.teacherId))
      .where(or(
        eq(presentationsTable.teacherId, teacherId),
        and(eq(presentationsTable.isShared, true), eq(teachersTable.isAdmin, true)),
      ))
      .orderBy(desc(presentationsTable.updatedAt));

    res.json(rows.map((r) => ({
      id: r.id,
      teacherId: r.teacherId,
      title: r.title,
      language: r.language,
      theme: r.theme,
      pattern: r.pattern,
      coverEmoji: r.coverEmoji,
      slideCount: Array.isArray(r.slides) ? r.slides.length : 0,
      status: r.status,
      publishedAt: r.publishedAt,
      isShared: r.isShared,
      ownerName: r.ownerName,
      ownerIsAdmin: r.ownerIsAdmin,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })));
  } catch (err) {
    req.log.error({ err }, "List presentations failed");
    res.status(500).json({ message: "Failed to load presentations" });
  }
});

/* ── Public read — only published decks are exposed; drafts return
   404 so a leaked link can't reveal in-progress work. No auth required
   so anyone with the URL (typically students opening `/p/:id`) can
   view. Returns the slim shape the present-mode renderer needs. */
router.get("/presentations/public/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [row] = await db
      .select()
      .from(presentationsTable)
      .where(eq(presentationsTable.id, id))
      .limit(1);
    if (!row || row.status !== "published") {
      res.status(404).json({ message: "Not found" });
      return;
    }
    /* Strip teacher-only fields from each slide before exposing to
       the public — `notes` is presenter-only content that must never
       leak to students viewing `/p/:id`. */
    const hydrated = await hydrateActivityQuestions(row.slides);
    const publicSlides = Array.isArray(hydrated)
      ? (hydrated as Array<Record<string, unknown>>).map((s) => {
          const { notes: _notes, ...rest } = s;
          return rest;
        })
      : [];
    res.json({
      id: row.id,
      title: row.title,
      language: row.language,
      theme: row.theme,
      pattern: row.pattern,
      coverEmoji: row.coverEmoji,
      slides: publicSlides,
      status: row.status,
      publishedAt: row.publishedAt,
    });
  } catch (err) {
    req.log.error({ err }, "Read public presentation failed");
    res.status(500).json({ message: "Failed to load presentation" });
  }
});

/* ── Read one — own or admin-shared (read-only access). */
router.get("/presentations/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [row] = await db
      .select({ deck: presentationsTable, owner: teachersTable })
      .from(presentationsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, presentationsTable.teacherId))
      .where(eq(presentationsTable.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const isOwner = row.deck.teacherId === teacherId;
    const isAdminShared = row.deck.isShared && row.owner.isAdmin;
    if (!isOwner && !isAdminShared) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const hydratedSlides = await hydrateActivityQuestions(row.deck.slides);
    res.json({
      ...row.deck,
      slides: hydratedSlides,
      linkedActivityId: row.deck.linkedActivityId,
      linkedActivityKind: row.deck.linkedActivityKind,
      ownerName: row.owner.name,
      isOwner,
    });
  } catch (err) {
    req.log.error({ err }, "Read presentation failed");
    res.status(500).json({ message: "Failed to load presentation" });
  }
});

/* ── Import-file. Parses the uploaded file, extracts slide content, and
   creates a populated deck in the database.

   Supported formats:
     - PPTX  → 1 PPTX slide maps to 1 HasadX slide (title + body text)
     - DOCX  → headings/paragraphs distributed across slides
     - PDF   → per-page text extracted; first line = slide title
     - Images → single-slide deck with the image as a background

   Accepts PDF, PPTX, DOCX, and common image MIME types (server-enforced). */
const IMPORT_ALLOWED_MIMES = new Set([
  "application/pdf",
  /* PPTX — browsers send various MIME strings; we accept all common ones. */
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  /* Word */
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  /* Excel */
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  /* Images */
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  /* Fallback for browsers that send a generic octet-stream for Office files. */
  "application/octet-stream",
  "application/zip",
]);
const IMPORT_ALLOWED_EXTS = new Set([
  ".pptx", ".ppt",
  ".docx", ".doc",
  ".xlsx", ".xls",
  ".pdf",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
]);

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = file.originalname.includes(".")
      ? file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase()
      : "";
    /* Browsers sometimes send application/octet-stream for .docx/.xlsx/.pptx.
       Allow the upload if the extension is whitelisted regardless of MIME. */
    if (IMPORT_ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else if (IMPORT_ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(
        "نوع الملف غير مدعوم. المقبول: PDF، PPTX، Word، Excel، وصور / " +
        "Unsupported file type. Allowed: PDF, PPTX, Word, Excel, and images"
      ));
    }
  },
});
/* Local error handler: converts multer validation errors (oversized,
   wrong MIME type, …) into clean 400/413 JSON responses. */
const handleImportUploadError: import("express").ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: err.message });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({ message: err.message });
    return;
  }
  next(err);
};

/* Detect whether a multer file is a plain image (not a document). */
function isImageMulnerFile(f: Express.Multer.File): boolean {
  const imageMimes = new Set(["image/png","image/jpeg","image/gif","image/webp"]);
  const imageExts  = new Set([".png",".jpg",".jpeg",".gif",".webp"]);
  const ext = f.originalname.includes(".")
    ? f.originalname.slice(f.originalname.lastIndexOf(".")).toLowerCase()
    : "";
  return imageMimes.has(f.mimetype) || imageExts.has(ext);
}

/* Decode a multer originalname safely: browsers send the header value as
   UTF-8 but Node/multer stores it as latin1. Re-encode to recover the
   original string. Gracefully falls back when the round-trip doesn't help. */
function decodeMulterFilename(name: string): string {
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    /* Sanity-check: if the result contains the replacement char (U+FFFD)
       the input was already UTF-8, so return the original. */
    return decoded.includes("\uFFFD") ? name : decoded;
  } catch {
    return name;
  }
}

router.post(
  "/presentations/import-file",
  requireTeacher,
  importUpload.array("file", 100),
  handleImportUploadError,
  async (req: Request, res: Response) => {
    try {
      const teacherId = req.session.teacherId as number;
      const allFiles = (req.files as Express.Multer.File[] | undefined) ?? [];

      if (allFiles.length === 0) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      const tier = await resolvePresentationsTier(teacherId);
      const svc = new ObjectStorageService();

      /* ── Multi-image fast path ─────────────────────────────────────
         When every uploaded file is an image we skip AI entirely and
         create one slide per image (same visual path as PDF pages).
         Limits: 5 for regular, 10 for pro, unlimited for admin.      */
      const imageFiles = allFiles.filter(isImageMulnerFile);
      const docFiles   = allFiles.filter(f => !isImageMulnerFile(f));

      if (imageFiles.length > 0 && docFiles.length === 0) {
        const maxImages = tier.isAdmin ? Infinity : tier.isPro ? 10 : 5;
        if (imageFiles.length > maxImages) {
          res.status(400).json({
            message: `يمكنك رفع ${maxImages} صور كحد أقصى في هذه الباقة / Your plan allows up to ${maxImages} images per import`,
          });
          return;
        }

        /* Step 1: Upload all images to Object Storage in parallel so we
           have permanent public URLs to attach as `backgroundImage` on
           each AI-materialized slide. */
        const pageUrls = await Promise.all(
          imageFiles.map((f) => {
            const imgExt = f.originalname.includes(".")
              ? f.originalname.slice(f.originalname.lastIndexOf(".")).toLowerCase()
              : ".jpg";
            return svc.uploadBufferAsPublic({
              buffer: f.buffer,
              contentType: f.mimetype || "image/jpeg",
              extension: imgExt,
            }).catch(() => "");
          }),
        );

        /* Step 2: Run GPT-4o Vision to extract content from every image.
           Each image becomes one slide with AI-generated title + bullets.
           The uploaded URL is then stamped onto the slide as backgroundImage
           so the original photo is still visible beneath the text layout.
           Falls back to the image-as-background approach if AI fails so the
           teacher always gets a usable deck. */
        let finalSlides: unknown[];
        let deckLanguage: "ar" | "en" = "ar";
        let aiGenerated = false;

        const validImages = imageFiles
          .map((f, i) => ({ f, url: pageUrls[i] ?? "" }))
          .filter(({ url }) => Boolean(url));

        try {
          const outline = await multiImagesToOutline(
            validImages.map(({ f }) => ({
              buffer: f.buffer,
              filename: decodeMulterFilename(f.originalname || "image"),
              mime: f.mimetype || "image/jpeg",
            })),
          );
          deckLanguage = outline.language;
          const themeKey = pickServerDefaultTheme();

          /* Fetch web images in parallel for slides without an uploaded
             source image. Each lookup has a 4 s timeout and concurrency
             is bounded so a deck of 15 slides finishes in 1-2 round-trips
             rather than 15 sequential calls. Failed lookups are silently
             treated as null (slide renders without background). */
          const webQueries = outline.cards.map((_, i) =>
            outline.sourceImageIndices[i] == null ? outline.imageQueries[i] : "",
          );
          const webHits = await findWebImagesBatch(webQueries, {
            concurrency: 6,
            timeoutMs: 4000,
          });
          req.log.info(
            {
              slides: outline.cards.length,
              webRequested: webQueries.filter(Boolean).length,
              webResolved: webHits.filter(Boolean).length,
            },
            "Import: web images fetched",
          );

          const validSlides: unknown[] = [];
          for (let i = 0; i < outline.cards.length; i++) {
            /* Image priority:
               1. AI-picked uploaded photo (sourceImageIndex) → forced
                  to full-bleed "background" so the teacher's photo
                  dominates the slide.
               2. AI-suggested web image (imageQuery → Brave/Wikimedia)
                  with placement honouring the AI's `imagePlacement`
                  hint (defaults to "side" for content slides, picked
                  by the materializer per slide kind).
               3. None — slide renders with the deck gradient only. */
            const srcIdx = outline.sourceImageIndices[i];
            const uploadedUrl =
              srcIdx != null && validImages[srcIdx - 1]
                ? validImages[srcIdx - 1].url || undefined
                : undefined;
            const bgUrl = uploadedUrl ?? webHits[i]?.url ?? undefined;
            const placement = outline.imagePlacements[i];
            const out = buildOneSlide({
              card: outline.cards[i],
              themeKey,
              density: outline.density,
              lang: outline.language,
              backgroundImageUrl: bgUrl,
              imagePlacement: placement,
            });
            const parsedOne = slideSchema.safeParse(out.slide);
            if (parsedOne.success) validSlides.push(parsedOne.data);
          }
          /* Only flag as AI-generated when we actually got valid slides;
             if every slide fails schema validation we fall back below. */
          if (validSlides.length > 0) {
            finalSlides = validSlides;
            aiGenerated = true;
            req.log.info({ imageCount: validImages.length, slideCount: finalSlides.length }, "Import: multi-image AI generation succeeded");
          } else {
            finalSlides = defaultSlides(deckLanguage);
          }
        } catch (err) {
          /* AI failed — use blank default slides (same behaviour as every
             other failed import path). The teacher can paste or type
             content manually in the editor. */
          req.log.warn({ err }, "Import: multi-image AI failed — using default slides");
          finalSlides = defaultSlides(deckLanguage);
        }

        /* Title from first filename (decoded properly). */
        const firstName = decodeMulterFilename(imageFiles[0].originalname || "صور");
        const deckTitle = firstName.replace(/\.[^.]+$/, "").trim().slice(0, 200) || "صور مستوردة";

        const [deck] = await db
          .insert(presentationsTable)
          .values({
            teacherId,
            title: deckTitle,
            language: deckLanguage,
            theme: pickServerDefaultTheme(),
            pattern: "solid",
            coverEmoji: "🖼️",
            slides: finalSlides,
            status: "draft",
          })
          .returning();

        /* Register each image as an asset (best-effort). */
        await Promise.allSettled(
          imageFiles.map((f, i) =>
            db.insert(presentationAssetsTable).values({
              presentationId: deck.id,
              kind: "file",
              url: pageUrls[i] ?? "",
              byteSize: f.size,
            }),
          ),
        );

        res.status(201).json({
          presentationId: deck.id,
          title: deck.title,
          slideCount: (finalSlides as unknown[]).length,
          aiGenerated,
        });
        return;
      }

      /* ── Single-document path (PDF / PPTX / DOCX / XLSX / other) ── */
      const file = docFiles[0] ?? allFiles[0];

      /* Tier-aware size check. */
      const maxBytes = (tier.limits.maxSizeMbRegular ?? 50) * 1024 * 1024;
      if (file.size > maxBytes) {
        res.status(413).json({
          message: `الملف أكبر من الحد المسموح به (${tier.limits.maxSizeMbRegular} م.ب) / File exceeds the ${tier.limits.maxSizeMbRegular} MB limit`,
        });
        return;
      }

      /* Derive deck title and extension from filename.
         Multer stores originalname as latin1; re-encode to UTF-8 so
         Arabic/non-ASCII filenames arrive intact. */
      const rawName = decodeMulterFilename(file.originalname || "presentation");
      const ext = rawName.includes(".") ? rawName.slice(rawName.lastIndexOf(".")).toLowerCase() : "";
      const titleFromFile = rawName.replace(/\.[^.]+$/, "").trim().slice(0, 200) || "Imported presentation";
      const mime = file.mimetype;

      req.log.info({ mime, size: file.size, ext }, "Import: parsing file");

      /* ── Step 1: Extract content & build slides based on file type ── */
      let finalSlides: unknown[];
      let deckLanguage: "ar" | "en" = "ar";
      let contentExtractionFailed = false;
      let aiGenerated = false;

      if (mime === "application/pdf" || ext === ".pdf") {
        /* PDF → render each page as a PNG image via pdftoppm, upload to
           object storage, and use as slide backgroundImage. This preserves
           the original visual layout of the document. */
        try {
          const pages = await parsePdf(file.buffer);
          const pageUrls = await Promise.all(
            pages.map((p) =>
              svc.uploadBufferAsPublic({
                buffer: p.imageBuffer,
                contentType: "image/png",
                extension: ".png",
              }),
            ),
          );
          const built = buildSlidesFromPdfPages(pageUrls);
          const validated = slidesSchema.safeParse(built);
          finalSlides =
            validated.success && validated.data.length > 0
              ? validated.data
              : defaultSlides(deckLanguage);
        } catch (err) {
          req.log.warn({ err }, "Import: PDF page rendering failed — using blank deck");
          contentExtractionFailed = true;
          finalSlides = defaultSlides(deckLanguage);
        }
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        mime === "application/vnd.ms-powerpoint" ||
        ext === ".pptx" ||
        ext === ".ppt"
      ) {
        /* PPTX → extract slide text then lay out as styled slides. */
        try {
          const parsed = await parsePptx(file.buffer);
          deckLanguage = detectLangFromText(
            parsed.map((s) => [s.title ?? "", ...s.bullets].join(" ")).join(" "),
          );
          const built = buildSlidesFromParsed(parsed, deckLanguage);
          const validated = slidesSchema.safeParse(built);
          finalSlides =
            validated.success && validated.data.length > 0
              ? validated.data
              : defaultSlides(deckLanguage);
        } catch (err) {
          req.log.warn({ err }, "Import: PPTX parsing failed — using blank deck");
          contentExtractionFailed = true;
          finalSlides = defaultSlides(deckLanguage);
        }
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mime === "application/msword" ||
        ext === ".docx" ||
        ext === ".doc"
      ) {
        /* DOCX → extract headings and paragraphs then distribute across slides. */
        try {
          const parsed = await parseDocx(file.buffer);
          deckLanguage = detectLangFromText(
            parsed.map((s) => [s.title ?? "", ...s.bullets].join(" ")).join(" "),
          );
          const built = buildSlidesFromParsed(parsed, deckLanguage);
          const validated = slidesSchema.safeParse(built);
          finalSlides =
            validated.success && validated.data.length > 0
              ? validated.data
              : defaultSlides(deckLanguage);
        } catch (err) {
          req.log.warn({ err }, "Import: DOCX parsing failed — using blank deck");
          contentExtractionFailed = true;
          finalSlides = defaultSlides(deckLanguage);
        }
      } else {
        /* Images, spreadsheets, and other types — use the AI outline path
           for best-effort content extraction. */
        try {
          const extracted = await extractFileContent(file.buffer, mime, rawName);
          deckLanguage = extracted.detectedLanguage ?? "ar";
          const outline = await fileToOutline(extracted, titleFromFile);
          const themeForOutline = pickServerDefaultTheme();

          /* Fetch a real web photo for every slide that supplied an
             imageQuery so single-doc imports look just as polished as
             the multi-image flow. Bounded concurrency keeps latency low. */
          const docQueries = outline.slides.map(
            (c) => (c as { imageQuery?: string }).imageQuery || "",
          );
          const docHits = await findWebImagesBatch(docQueries, {
            concurrency: 6,
            timeoutMs: 4000,
          });
          req.log.info(
            {
              slides: outline.slides.length,
              webRequested: docQueries.filter(Boolean).length,
              webResolved: docHits.filter(Boolean).length,
            },
            "Import (doc): web images fetched",
          );

          const validSlides: unknown[] = [];
          for (let i = 0; i < outline.slides.length; i++) {
            const placement = (outline.slides[i] as {
              imagePlacement?: "side" | "background" | "none";
            }).imagePlacement;
            const out = buildOneSlide({
              card: outline.slides[i],
              themeKey: themeForOutline,
              density: outline.density,
              lang: outline.language,
              backgroundImageUrl: docHits[i]?.url ?? undefined,
              imagePlacement: placement,
            });
            const parsedOne = slideSchema.safeParse(out.slide);
            if (parsedOne.success) validSlides.push(parsedOne.data);
          }
          finalSlides = validSlides.length > 0 ? validSlides : defaultSlides(deckLanguage);
          deckLanguage = outline.language ?? deckLanguage;
          aiGenerated = true;
        } catch (err) {
          req.log.warn({ err }, "Import: AI extraction failed — using blank deck");
          contentExtractionFailed = true;
          finalSlides = defaultSlides(deckLanguage);
        }
      }

      /* ── Step 2: Create deck row with slides included ─────────────── */
      const themeKey = pickServerDefaultTheme();
      const [deck] = await db
        .insert(presentationsTable)
        .values({
          teacherId,
          title: titleFromFile,
          language: deckLanguage,
          theme: themeKey,
          pattern: "solid",
          coverEmoji: "📄",
          slides: finalSlides,
          status: "draft",
        })
        .returning();

      /* ── Step 3: Persist raw file to object storage (best-effort) ── */
      let assetUrl = "";
      try {
        assetUrl = await svc.uploadBufferAsPublic({
          buffer: file.buffer,
          contentType: mime || "application/octet-stream",
          extension: ext,
        });
      } catch (uploadErr) {
        req.log.warn({ uploadErr }, "Import: object-storage upload skipped — bucket not configured");
      }

      await db.insert(presentationAssetsTable).values({
        presentationId: deck.id,
        kind: "file",
        url: assetUrl,
        byteSize: file.size,
      });

      res.status(201).json({
        presentationId: deck.id,
        title: deck.title,
        slideCount: (finalSlides as unknown[]).length,
        aiGenerated,
        ...(contentExtractionFailed ? { warning: "content_extraction_failed" } : {}),
      });
    } catch (err) {
      req.log.error({ err }, "Import presentation file failed");
      res.status(500).json({ message: "Failed to import file" });
    }
  },
);

/* ── Import from a shared Google Slides URL ─────────────────────────────
   Accepts a public Google Slides share/edit/pub link, converts it to the
   PPTX export URL, downloads the file, then runs it through the same PPTX
   pipeline as the file-upload path.  Returns the same JSON shape as
   /import-file so the frontend can reuse the same result handler. */

/** Extract the presentation ID from a Google Slides URL.
 *  Handles /edit, /pub, /present, bare /d/{id}, and /d/{id}/... variants. */
function parseGoogleSlidesId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.trim());
    if (u.hostname !== "docs.google.com") return null;
    const m = u.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

router.post(
  "/presentations/import-url",
  requireTeacher,
  async (req: Request, res: Response) => {
    try {
      const teacherId = req.session.teacherId as number;

      const bodySchema = z.object({ url: z.string().url("Invalid URL") });
      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "يرجى إدخال رابط صحيح / Please enter a valid URL" });
        return;
      }
      const { url } = parsed.data;

      /* ── Detect Canva links early and give a helpful message ── */
      try {
        const u = new URL(url);
        if (u.hostname === "www.canva.com" || u.hostname === "canva.com") {
          res.status(422).json({
            message:
              "روابط Canva لا تدعم التنزيل المباشر — يرجى تصدير العرض من Canva كملف PPTX ثم رفعه هنا / " +
              "Canva links don't support direct download — please export your design from Canva as PPTX and upload it here.",
          });
          return;
        }
      } catch { /* ignore parse errors — caught below */ }

      /* ── Validate Google Slides URL and extract ID ── */
      const slideId = parseGoogleSlidesId(url);
      if (!slideId) {
        res.status(422).json({
          message:
            "الرابط غير مدعوم. الروابط المدعومة: Google Slides العامة فقط / " +
            "Unsupported link. Only public Google Slides links are supported.",
        });
        return;
      }

      /* Build the direct PPTX export URL (works for "anyone with link" public decks). */
      const exportUrl = `https://docs.google.com/presentation/d/${slideId}/export?format=pptx`;

      req.log.info({ slideId, exportUrl }, "Import URL: fetching Google Slides PPTX");

      /* Fetch with a 30-second timeout so we don't hold the connection open. */
      let pptxBuffer: Buffer;
      let contentType: string;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        let fetchRes: globalThis.Response;
        try {
          fetchRes = await fetch(exportUrl, {
            signal: controller.signal,
            headers: { "User-Agent": "HasadX/1.0 (+https://hasadx.com)" },
          });
        } finally {
          clearTimeout(timer);
        }

        /* Google redirects to the sign-in page or shows an HTML error when
           the presentation is private or the ID is wrong.  Detect this by
           checking content-type: a successful export always returns a PPTX
           binary (application/...) NOT text/html. */
        contentType = fetchRes.headers.get("content-type") ?? "";
        if (!fetchRes.ok || contentType.includes("text/html")) {
          res.status(422).json({
            message:
              "تعذّر تنزيل العرض — تأكد من أن الرابط عام (مشارك مع الجميع) / " +
              "Could not download the presentation — make sure the link is set to 'Anyone with the link'.",
          });
          return;
        }

        const arrayBuf = await fetchRes.arrayBuffer();
        pptxBuffer = Buffer.from(arrayBuf);
      } catch (fetchErr: unknown) {
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          res.status(504).json({ message: "انتهت مهلة تنزيل العرض / Download timed out — please try again." });
          return;
        }
        req.log.warn({ fetchErr }, "Import URL: fetch failed");
        res.status(502).json({ message: "تعذّر الوصول إلى الرابط / Could not reach the URL." });
        return;
      }

      const tier = await resolvePresentationsTier(teacherId);
      const svc = new ObjectStorageService();

      /* Size guard — same limit as the file-upload path. */
      const maxBytes = (tier.limits.maxSizeMbRegular ?? 50) * 1024 * 1024;
      if (pptxBuffer.length > maxBytes) {
        res.status(413).json({
          message: `الملف أكبر من الحد المسموح به (${tier.limits.maxSizeMbRegular} م.ب) / File exceeds the ${tier.limits.maxSizeMbRegular} MB limit`,
        });
        return;
      }

      req.log.info({ bytes: pptxBuffer.length }, "Import URL: PPTX downloaded — parsing");

      /* ── Parse PPTX through the shared pipeline ── */
      let finalSlides: unknown[];
      let deckLanguage: "ar" | "en" = "ar";
      let contentExtractionFailed = false;
      let titleFromUrl: string | undefined;

      try {
        const parsedSlides = await parsePptx(pptxBuffer);
        deckLanguage = detectLangFromText(
          parsedSlides.map((s) => [s.title ?? "", ...s.bullets].join(" ")).join(" "),
        );
        /* Use the first non-empty slide title as the deck name. */
        titleFromUrl =
          parsedSlides.find((s) => s.title?.trim())?.title?.trim() ?? undefined;
        const built = buildSlidesFromParsed(parsedSlides, deckLanguage);
        const validated = slidesSchema.safeParse(built);
        finalSlides =
          validated.success && validated.data.length > 0
            ? validated.data
            : defaultSlides(deckLanguage);
      } catch (err) {
        req.log.warn({ err }, "Import URL: PPTX parsing failed — using blank deck");
        contentExtractionFailed = true;
        finalSlides = defaultSlides(deckLanguage);
      }

      /* Fall back to a translated generic name when no slide title was found. */
      const deckTitle =
        titleFromUrl ||
        (deckLanguage === "ar" ? "عرض مستورد" : "Imported Presentation");

      /* ── Create deck row ── */
      const themeKey = pickServerDefaultTheme();
      const [deck] = await db
        .insert(presentationsTable)
        .values({
          teacherId,
          title: deckTitle,
          language: deckLanguage,
          theme: themeKey,
          pattern: "solid",
          coverEmoji: "📊",
          slides: finalSlides,
          status: "draft",
        })
        .returning();

      /* ── Persist a reference asset (best-effort) ── */
      let assetUrl = "";
      try {
        assetUrl = await svc.uploadBufferAsPublic({
          buffer: pptxBuffer,
          contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          extension: ".pptx",
        });
      } catch (uploadErr) {
        req.log.warn({ uploadErr }, "Import URL: object-storage upload skipped");
      }

      await db.insert(presentationAssetsTable).values({
        presentationId: deck.id,
        kind: "file",
        url: assetUrl,
        byteSize: pptxBuffer.length,
      });

      res.status(201).json({
        presentationId: deck.id,
        title: deck.title,
        slideCount: (finalSlides as unknown[]).length,
        aiGenerated: false,
        ...(contentExtractionFailed ? { warning: "content_extraction_failed" } : {}),
      });
    } catch (err) {
      req.log.error({ err }, "Import presentation URL failed");
      res.status(500).json({ message: "Failed to import from URL" });
    }
  },
);

/* ── Create. Seeds with a single empty cover slide so the editor
   immediately renders. */
router.post("/presentations", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const body = createBody.parse(req.body);
    const { row, runAfterCommit } = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(presentationsTable)
        .values({
          teacherId,
          title: body.title,
          language: body.language,
          subject: body.subject ?? null,
          gradeLevel: body.gradeLevel ?? null,
          theme: body.theme ?? pickServerDefaultTheme(),
          pattern: body.pattern ?? "solid",
          coverEmoji: body.coverEmoji ?? "📚",
          slides: defaultSlides(body.language),
          status: "draft",
        })
        .returning();
      const xp = await awardXpInTxAndNotifyAfterCommit(tx, {
        teacherId,
        actionKey: "presentation.session_created",
        refId: `presentation:${inserted.id}`,
        reason: inserted.title,
      });
      return { row: inserted, runAfterCommit: xp.runAfterCommit };
    });
    void runAfterCommit();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ message: "Invalid presentation", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Create presentation failed");
    res.status(500).json({ message: "Failed to create presentation" });
  }
});

/* ── Update. Owner only. Slides are re-validated through the strict
   discriminated union so the JSONB column never receives malformed
   element shapes. */
router.put("/presentations/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const body = updateBody.parse(req.body);
    const [existing] = await db
      .select()
      .from(presentationsTable)
      .where(eq(presentationsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    if (existing.teacherId !== teacherId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    /* Tier enforcement on slide-shape updates. Pro tier bypasses
       caps; regular tier is bounded by `maxSlidesRegular` and
       `maxImagesRegular` (image-element count summed across all
       slides). Returning a structured `LIMIT_EXCEEDED` payload lets
       the editor render a localized upgrade toast without parsing
       free-text messages. */
    if (body.slides !== undefined) {
      /* Phase 2A — validate that any embedded activity element
         pointing at a question_bank row actually belongs to the
         current teacher. Prevents a teacher from referencing another
         teacher's question via the editor by hand-crafting an id.
         We collect all referenced ids in one pass then run a single
         IN(...) query rather than N round-trips. */
      const referencedQuestionIds = new Set<number>();
      for (const s of body.slides) {
        for (const el of s.elements ?? []) {
          if (el.kind === "activity") {
            /* Phase 2A — manual XOR check: an activity must either
               reference a bank question OR provide an inline prompt
               (we couldn't express this via `.refine` without
               breaking discriminatedUnion). */
            const hasPrompt = typeof el.prompt === "string" && el.prompt.trim().length > 0;
            const hasQid = typeof el.questionId === "number";
            if (!hasPrompt && !hasQid) {
              res.status(400).json({
                message: "Activity element requires either questionId or prompt",
                slideId: s.id,
              });
              return;
            }
            if (hasQid) referencedQuestionIds.add(el.questionId as number);
          }
        }
      }
      if (referencedQuestionIds.size > 0) {
        const ids = Array.from(referencedQuestionIds);
        const found = await db
          .select({ id: questionBankTable.id, teacherId: questionBankTable.teacherId })
          .from(questionBankTable)
          .where(inArray(questionBankTable.id, ids));
        const ownedIds = new Set(found.filter((q) => q.teacherId === teacherId).map((q) => q.id));
        const bad = ids.filter((qid) => !ownedIds.has(qid));
        if (bad.length > 0) {
          res.status(403).json({
            message: "Cannot reference questions you do not own",
            badQuestionIds: bad,
          });
          return;
        }
      }
      const tier = await resolvePresentationsTier(teacherId);
      if (!tier.isPro) {
        if (body.slides.length > tier.limits.maxSlidesRegular) {
          res.status(403).json({
            code: "LIMIT_EXCEEDED",
            kind: "slides",
            limit: tier.limits.maxSlidesRegular,
            current: body.slides.length,
            message: "Slide limit exceeded for the regular tier",
          });
          return;
        }
        let imageCount = 0;
        for (const s of body.slides) {
          for (const el of s.elements ?? []) {
            if (el.kind === "image") imageCount += 1;
          }
        }
        if (imageCount > tier.limits.maxImagesRegular) {
          res.status(403).json({
            code: "LIMIT_EXCEEDED",
            kind: "images",
            limit: tier.limits.maxImagesRegular,
            current: imageCount,
            message: "Image limit exceeded for the regular tier",
          });
          return;
        }
      }
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) patch.title = body.title;
    if (body.language !== undefined) patch.language = body.language;
    if (body.subject !== undefined) patch.subject = body.subject ?? null;
    if (body.gradeLevel !== undefined) patch.gradeLevel = body.gradeLevel ?? null;
    if (body.theme !== undefined) patch.theme = body.theme;
    if (body.pattern !== undefined) patch.pattern = body.pattern;
    if (body.coverEmoji !== undefined) patch.coverEmoji = body.coverEmoji ?? null;
    if (body.description !== undefined) patch.description = body.description ?? null;
    if (body.slides !== undefined) patch.slides = body.slides;

    const [row] = await db
      .update(presentationsTable)
      .set(patch)
      .where(eq(presentationsTable.id, id))
      .returning();
    res.json(row);
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ message: "Invalid presentation", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Update presentation failed");
    res.status(500).json({ message: "Failed to update presentation" });
  }
});

/* ── Phase 2A — Link / unlink an activity (assignment) to a deck.
   Owner only. The pointer is informational: it gives the deck a
   "presented for {assignment}" badge and lets the launcher land on
   the right grading view. Pass `activityId: null` to detach. We
   verify the assignment exists and belongs to the teacher to prevent
   cross-tenant pointers. */
router.patch("/presentations/:id/link-activity", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ message: "Bad id" }); return; }
    if (!(await ownsPresentation(teacherId, id))) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const body = linkActivityBody.parse(req.body);
    if (body.activityId !== null) {
      const [a] = await db
        .select({ id: assignmentsTable.id, teacherId: assignmentsTable.teacherId })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, body.activityId))
        .limit(1);
      if (!a || a.teacherId !== teacherId) {
        res.status(404).json({ message: "Activity not found or not yours" });
        return;
      }
    }
    const [row] = await db
      .update(presentationsTable)
      .set({
        linkedActivityId: body.activityId === null ? null : String(body.activityId),
        linkedActivityKind: body.activityId === null ? null : body.activityKind,
        updatedAt: new Date(),
      })
      .where(eq(presentationsTable.id, id))
      .returning();
    res.json({
      id: row.id,
      linkedActivityId: row.linkedActivityId,
      linkedActivityKind: row.linkedActivityKind,
    });
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ message: "Invalid body", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Link presentation activity failed");
    res.status(500).json({ message: "Failed to link activity" });
  }
});

/* Returns the resolved linked activity (id, title) or null if no
   pointer / pointer dangling (assignment deleted). Owner or admin-
   shared reader. */
router.get("/presentations/:id/linked-activity", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ message: "Bad id" }); return; }
    /* Mirror the GET /presentations/:id authorization: owner OR a deck
       that is admin-shared (i.e. owned by an admin AND `isShared`).
       Plain `isShared` from a non-admin must NOT grant read access. */
    const [deck] = await db
      .select({
        teacherId: presentationsTable.teacherId,
        isShared: presentationsTable.isShared,
        ownerIsAdmin: teachersTable.isAdmin,
        linkedActivityId: presentationsTable.linkedActivityId,
        linkedActivityKind: presentationsTable.linkedActivityKind,
      })
      .from(presentationsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, presentationsTable.teacherId))
      .where(eq(presentationsTable.id, id))
      .limit(1);
    if (!deck) { res.status(404).json({ message: "Not found" }); return; }
    const isOwner = deck.teacherId === teacherId;
    const isAdminShared = deck.isShared && deck.ownerIsAdmin;
    if (!isOwner && !isAdminShared) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    /* Always emit `link` (nullable) so the client can rely on the
       field shape regardless of resolution outcome. */
    if (!deck.linkedActivityId) {
      res.json({ activity: null, kind: null, link: null });
      return;
    }
    const aid = parseInt(deck.linkedActivityId, 10);
    if (!Number.isFinite(aid)) {
      res.json({ activity: null, kind: deck.linkedActivityKind, link: null });
      return;
    }
    const [a] = await db
      .select({ id: assignmentsTable.id, title: assignmentsTable.title, teacherId: assignmentsTable.teacherId })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, aid))
      .limit(1);
    if (!a || a.teacherId !== deck.teacherId) {
      res.json({ activity: null, kind: deck.linkedActivityKind, link: null });
      return;
    }
    res.json({
      kind: deck.linkedActivityKind,
      activity: { id: a.id, title: a.title },
      link: `/teacher/assignment/${a.id}`,
    });
  } catch (err) {
    req.log.error({ err }, "Get linked activity failed");
    res.status(500).json({ message: "Failed to load linked activity" });
  }
});

/* ── Delete. Owner only. Cascades to presentation_assets via FK. */
router.delete("/presentations/:id", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(presentationsTable)
      .where(eq(presentationsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    if (existing.teacherId !== teacherId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    await db.delete(presentationsTable).where(eq(presentationsTable.id, id));
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Delete presentation failed");
    res.status(500).json({ message: "Failed to delete presentation" });
  }
});

/* ── Publish / unpublish. Owner only. `publishedAt` is stamped on the
   first publish and refreshed on every re-publish so list sorting can
   surface freshly-published decks. */
async function setStatus(req: any, res: any, status: "draft" | "published") {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [existing] = await db
      .select()
      .from(presentationsTable)
      .where(eq(presentationsTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    if (existing.teacherId !== teacherId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const [row] = await db
      .update(presentationsTable)
      .set({
        status,
        publishedAt: status === "published" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(presentationsTable.id, id))
      .returning();
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Set presentation status failed");
    res.status(500).json({ message: "Failed to update status" });
  }
}
router.post("/presentations/:id/publish", requireTeacher, (req, res) => setStatus(req, res, "published"));
router.post("/presentations/:id/unpublish", requireTeacher, (req, res) => setStatus(req, res, "draft"));

/* ── Duplicate. Anyone who can read the source (own or admin-shared)
   can duplicate it; the copy is owned by the caller and reset to draft. */
router.post("/presentations/:id/duplicate", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [src] = await db
      .select({ deck: presentationsTable, owner: teachersTable })
      .from(presentationsTable)
      .innerJoin(teachersTable, eq(teachersTable.id, presentationsTable.teacherId))
      .where(eq(presentationsTable.id, id))
      .limit(1);
    if (!src) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    const canRead = src.deck.teacherId === teacherId || (src.deck.isShared && src.owner.isAdmin);
    if (!canRead) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    /* Phase 2A — When duplicating a deck owned by someone else, strip
       any embedded `activity.questionId` pointers because they
       reference question_bank rows owned by the source teacher. The
       inline prompt/options are preserved so the activity remains
       fully usable; only the bank link is severed. Without this, a
       subsequent PUT save would be blocked by the cross-tenant
       ownership check and the duplicate would be effectively
       uneditable. */
    const sourceSlides = (src.deck.slides as any) ?? [];
    const sanitizedSlides = src.deck.teacherId === teacherId
      ? sourceSlides
      : (Array.isArray(sourceSlides) ? sourceSlides : []).map((s: any) => ({
          ...s,
          elements: Array.isArray(s?.elements)
            ? s.elements.map((el: any) =>
                el?.kind === "activity" && typeof el?.questionId === "number"
                  ? { ...el, questionId: undefined }
                  : el)
            : s?.elements,
        }));
    const [row] = await db
      .insert(presentationsTable)
      .values({
        teacherId,
        title: `${src.deck.title} (نسخة)`,
        language: src.deck.language,
        subject: src.deck.subject,
        gradeLevel: src.deck.gradeLevel,
        theme: src.deck.theme,
        pattern: src.deck.pattern,
        coverEmoji: src.deck.coverEmoji,
        description: src.deck.description,
        slides: sanitizedSlides as object,
        status: "draft",
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Duplicate presentation failed");
    res.status(500).json({ message: "Failed to duplicate presentation" });
  }
});

/* ── Assets. Lightweight tracking table the editor (T3) and tier
   enforcement (T7) will consume. The actual upload pipeline lives in
   the existing object-storage helpers; here we just record the
   resulting URL plus byte size against a presentation. */
const registerAssetBody = z.object({
  kind: z.enum(["image", "file"]),
  url: z.string().min(1).max(2000),
  byteSize: z.number().int().min(0).max(500 * 1024 * 1024).default(0),
});

/* ── POST /api/presentations/image-search
   Proxy image search so the frontend doesn't need a direct API key.
   Uses Brave Search Images API if BRAVE_SEARCH_API_KEY is set;
   falls back to Wikimedia Commons (free, no key, educational content).
   Returns { results: [{ url, thumbUrl, title, source }] }. */
const imageSearchBody = z.object({
  q: z.string().min(1).max(200),
  count: z.number().int().min(1).max(20).default(12),
});

router.post("/presentations/image-search", requireTeacher, async (req, res) => {
  try {
    const { q, count } = imageSearchBody.parse(req.body);
    const { results, diagnostics } = await searchPresentationWebImages(q, count);

    if (diagnostics.primary === "wikimedia" && diagnostics.braveError) {
      req.log.info(
        { braveError: diagnostics.braveError.slice(0, 500) },
        "Presentation image search: Brave failed, using Wikimedia fallback",
      );
    }
    if (diagnostics.primary === "none") {
      req.log.warn(
        {
          querySample: q.slice(0, 80),
          braveError: diagnostics.braveError?.slice(0, 500),
          wikimediaError: diagnostics.wikimediaError?.slice(0, 500),
        },
        "Presentation image search: no hits from Brave or Wikimedia",
      );
    }

    res.json({ results });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.errors[0]?.message ?? "Invalid request";
      res.status(400).json({ message: first, code: "BAD_REQUEST" });
      return;
    }
    req.log.error({ err }, "Presentation image search unexpected error");
    res.status(500).json({ message: "Image search failed", code: "IMAGE_SEARCH_FAILED" });
  }
});

async function ownsPresentation(teacherId: number, id: number): Promise<boolean> {
  const [row] = await db
    .select({ teacherId: presentationsTable.teacherId })
    .from(presentationsTable)
    .where(eq(presentationsTable.id, id))
    .limit(1);
  return !!row && row.teacherId === teacherId;
}

router.get("/presentations/:id/assets", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    if (!(await ownsPresentation(teacherId, id))) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const rows = await db
      .select()
      .from(presentationAssetsTable)
      .where(eq(presentationAssetsTable.presentationId, id))
      .orderBy(desc(presentationAssetsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List presentation assets failed");
    res.status(500).json({ message: "Failed to load assets" });
  }
});

router.post("/presentations/:id/assets", requireTeacher, async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    if (!(await ownsPresentation(teacherId, id))) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const body = registerAssetBody.parse(req.body);
    /* Tier enforcement on asset uploads. Regular tier is capped on
       per-deck file count (kind="file") and total deck size in MB.
       Image-count enforcement happens on the slides PUT (see above)
       since images become slide elements rather than persistent
       assets in the editor flow. */
    const tier = await resolvePresentationsTier(teacherId);
    if (!tier.isPro) {
      const usage = await getPresentationUsage(id);
      const incomingMb = body.byteSize / (1024 * 1024);
      if (body.kind === "file" && usage.files + 1 > tier.limits.maxFilesRegular) {
        res.status(403).json({
          code: "LIMIT_EXCEEDED",
          kind: "files",
          limit: tier.limits.maxFilesRegular,
          current: usage.files,
          message: "File limit exceeded for the regular tier",
        });
        return;
      }
      if (usage.sizeMb + incomingMb > tier.limits.maxSizeMbRegular) {
        res.status(403).json({
          code: "LIMIT_EXCEEDED",
          kind: "sizeMb",
          limit: tier.limits.maxSizeMbRegular,
          current: usage.sizeMb,
          message: "Size limit exceeded for the regular tier",
        });
        return;
      }
    }
    const [row] = await db
      .insert(presentationAssetsTable)
      .values({ presentationId: id, kind: body.kind, url: body.url, byteSize: body.byteSize })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.issues) {
      res.status(400).json({ message: "Invalid asset", issues: err.issues });
      return;
    }
    req.log.error({ err }, "Register presentation asset failed");
    res.status(500).json({ message: "Failed to register asset" });
  }
});

/* ── Export to PPTX. Owner only, rate-limited (5/min/IP). PDF export
   is handled client-side via the `/teacher/presentations/:id/print`
   page which stacks all slides + auto-fires `window.print()`, so the
   browser's print-to-PDF reproduces the on-screen `SlideRender`
   pixel-for-pixel without shipping headless chromium. */
router.post(
  "/presentations/:id/export/pptx",
  presentationExportLimiter,
  requireTeacher,
  async (req, res) => {
    try {
      const teacherId = req.session.teacherId as number;
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Bad id" });
        return;
      }
      const [row] = await db
        .select()
        .from(presentationsTable)
        .where(eq(presentationsTable.id, id))
        .limit(1);
      if (!row) {
        res.status(404).json({ message: "Not found" });
        return;
      }
      if (row.teacherId !== teacherId) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }

      /* Hydrate bank-linked activity elements (questionId-only) so
         the PPTX renderer sees the same prompt/options/correctIndex
         the editor and present mode see. */
      const hydratedSlides = await hydrateActivityQuestions(row.slides);
      const deck: PresentationForExport = {
        title: row.title,
        language: (row.language === "en" ? "en" : "ar"),
        /* Pass deck-level theme + pattern so the PPTX builder can
           resolve them to a representative slide background. Without
           this, every exported slide falls back to white and any
           light-coloured text becomes invisible on the page — the
           bug that made titles "disappear" in the previous export. */
        theme: row.theme ?? undefined,
        pattern: row.pattern ?? undefined,
        slides: Array.isArray(hydratedSlides) ? (hydratedSlides as PresentationForExport["slides"]) : [],
      };
      const buf = await buildPptx(deck);

      // Slugged filename: "<title>-<lang>.pptx". `slugify` handles
      // both Arabic and Latin; we coerce the result to ASCII for the
      // Content-Disposition `filename=` field and provide the original
      // (URL-encoded) UTF-8 in `filename*` for modern clients.
      const baseRaw = `${row.title}-${deck.language}`;
      const baseAscii = slugify(baseRaw, { lower: false, strict: true }) || `presentation-${id}`;
      const baseUtf8 = encodeURIComponent(`${baseRaw}.pptx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${baseAscii}.pptx"; filename*=UTF-8''${baseUtf8}`,
      );
      res.setHeader("Content-Length", String(buf.length));
      res.end(buf);
    } catch (err) {
      req.log.error({ err }, "Export presentation to PPTX failed");
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to export presentation" });
      }
    }
  },
);

/* ── Tokenized read for the puppeteer-driven PDF export. Returns the
   same shape as `GET /api/presentations/:id` but authenticates with a
   short-lived HMAC token (60 s) instead of a session cookie, since the
   chromium worker that renders the print page has no teacher session.
   The token is bound to (presentationId, teacherId) so it can't be
   reused against another deck. */
router.get("/presentations/:id/export-data", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) { res.status(400).json({ message: "Bad id" }); return; }
    const token = String(req.query.token ?? "");
    const claim = verifyExportToken(token, id);
    if (!claim) { res.status(401).json({ message: "Invalid or expired token" }); return; }
    const [row] = await db
      .select()
      .from(presentationsTable)
      .where(eq(presentationsTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ message: "Not found" }); return; }
    if (row.teacherId !== claim.teacherId) { res.status(403).json({ message: "Forbidden" }); return; }
    const hydratedSlides = await hydrateActivityQuestions(row.slides);
    res.json({ ...row, slides: hydratedSlides });
  } catch (err) {
    req.log.error({ err }, "export-data failed");
    res.status(500).json({ message: "Server error" });
  }
});

/* ── Export to PDF. Owner only, rate-limited via the same export
   bucket as PPTX. Mints a 60-second export token, then drives a
   cached headless chromium (puppeteer-core + the system Chromium
   from replit.nix) to the live print page
   (`/teacher/presentations/:id/print?exportToken=…&ssr=1`). The
   print page reuses the same `SlideRender` React component as
   present mode, so PDF output is pixel-for-pixel identical to what
   the teacher sees on screen — no manual HTML re-implementation.
   Page signals readiness via `window.__SLIDES_READY__`. */
router.post(
  "/presentations/:id/export/pdf",
  presentationExportLimiter,
  requireTeacher,
  async (req, res) => {
    try {
      const teacherId = req.session.teacherId as number;
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Bad id" });
        return;
      }
      const [row] = await db
        .select({ teacherId: presentationsTable.teacherId, title: presentationsTable.title, language: presentationsTable.language })
        .from(presentationsTable)
        .where(eq(presentationsTable.id, id))
        .limit(1);
      if (!row) { res.status(404).json({ message: "Not found" }); return; }
      if (row.teacherId !== teacherId) { res.status(403).json({ message: "Forbidden" }); return; }

      const token = mintExportToken(id, teacherId);
      const origin = resolveExportOrigin(process.env);
      const printUrl = `${origin}/teacher/presentations/${id}/print?exportToken=${encodeURIComponent(token)}&ssr=1`;
      req.log.info({ origin }, "PDF export navigating");
      const buf = await buildPdf(printUrl);

      const lang = row.language === "en" ? "en" : "ar";
      const baseRaw = `${row.title}-${lang}`;
      const baseAscii = slugify(baseRaw, { lower: false, strict: true }) || `presentation-${id}`;
      const baseUtf8 = encodeURIComponent(`${baseRaw}.pdf`);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${baseAscii}.pdf"; filename*=UTF-8''${baseUtf8}`,
      );
      res.setHeader("Content-Length", String(buf.length));
      res.end(buf);
    } catch (err) {
      req.log.error({ err }, "Export presentation to PDF failed");
      if (!res.headersSent) {
        /* In non-production, surface the underlying error message so
           the editor's toast can show diagnostic detail. The frontend
           reads `description` from the JSON body (see editor.tsx). */
        const message =
          process.env.NODE_ENV === "production"
            ? "Failed to export presentation"
            : `Failed to export presentation: ${(err as Error).message}`;
        res.status(500).json({ message });
      }
    }
  },
);

export default router;
