import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import multer from "multer";
import { z } from "zod";
import {
  aiVideoProjectsTable,
  creditHoldsTable,
  creditTransactionsTable,
  db,
  type AiVideoProject,
} from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { storyboardPrompt } from "../lib/ai-video-storyboard-prompt";
import {
  holdCreditsForToolRequest,
  InsufficientCreditsError,
} from "../lib/check-credits";
import { CreditService } from "../lib/credit-service";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  aiVideoBriefSchema,
  aiVideoPatchSchema,
  aiVideoStoryboardSchema,
  aiVideoSourceImageContentTypes,
  AI_VIDEO_TARGET_SCENE_COUNTS,
  InvalidStoryboardTimingError,
  isOwnedAiVideoSourcePath,
  idempotencyKeySchema,
  sanitizeStoryboard,
  type AiVideoBrief,
} from "../lib/ai-video-schemas";
import {
  AI_VIDEO_RENDER_LEASE_MS,
  AI_VIDEO_STORYBOARD_LEASE_MS,
  aiVideoRenderCreditRequestId,
  aiVideoStoryboardCreditRequestId,
  failStaleAiVideoStoryboards,
  startAiVideoRender,
} from "../lib/ai-video-renderer";
import { sensitiveActionLimiter } from "../lib/rate-limiter";
import { hasAiVideoAdminAccess } from "../lib/ai-video-access";
import {
  AI_VIDEO_SOURCE_IMAGE_MAX_BYTES,
  InvalidAiVideoSourceImageError,
  markAiVideoSourceImagesClaimed,
  normalizeAiVideoSourceImage,
} from "../lib/ai-video-source-images";

const router: IRouter = Router();
const storage = new ObjectStorageService();

function requireAiVideoTeacher(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

async function requireAdvancedAccess(teacherId: number, res: Response): Promise<boolean> {
  if (await hasAiVideoAdminAccess(teacherId)) return true;
  res.status(403).json({
    message: "إنتاج الفيديو الواقعي المتقدم متاح للمسؤول فقط",
    code: "ADMIN_ONLY",
  });
  return false;
}

function projectId(value: string | string[]): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function ownedProject(id: number, teacherId: number) {
  const [project] = await db.select().from(aiVideoProjectsTable)
    .where(and(eq(aiVideoProjectsTable.id, id), eq(aiVideoProjectsTable.teacherId, teacherId)))
    .limit(1);
  return project;
}

function publicProject(project: AiVideoProject) {
  const {
    storyboardLeaseId: _storyboardLeaseId,
    storyboardLeaseExpiresAt: _storyboardLeaseExpiresAt,
    renderLeaseId: _renderLeaseId,
    renderLeaseExpiresAt: _renderLeaseExpiresAt,
    ...visible
  } = project;
  return visible;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return JSON.parse(fenced);
    throw new Error("Storyboard provider returned invalid JSON");
  }
}

async function validateSourceImages(paths: string[], teacherId: number): Promise<void> {
  await Promise.all(paths.map(async (path) => {
    if (!isOwnedAiVideoSourcePath(path, teacherId)) {
      throw new Error("Source image does not belong to the authenticated teacher");
    }
    const file = await storage.getObjectEntityFile(path);
    const [metadata] = await file.getMetadata();
    if (!aiVideoSourceImageContentTypes.has(String(metadata.contentType ?? "").toLowerCase())) {
      throw new Error(`Source object must be a JPEG, PNG, or WebP image: ${path}`);
    }
    if (Number(metadata.size ?? 0) > 15 * 1024 * 1024) {
      throw new Error(`Source image exceeds 15MB: ${path}`);
    }
  }));
}

router.use("/ai-video", requireAiVideoTeacher);

const aiVideoImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: AI_VIDEO_SOURCE_IMAGE_MAX_BYTES,
    files: 1,
    fields: 0,
    parts: 2,
  },
});

const receiveAiVideoImage: import("express").RequestHandler = (req, res, next) => {
  aiVideoImageUpload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ message: "Invalid image upload" });
      return;
    }
    next();
  });
};

router.post("/ai-video/uploads/image", sensitiveActionLimiter, receiveAiVideoImage, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "An image file is required" });
    return;
  }
  try {
    const teacherId = req.session.teacherId as number;
    const image = await normalizeAiVideoSourceImage(req.file.buffer);
    const objectPath = await storage.uploadBufferAsPrivate({
      buffer: image.buffer,
      contentType: image.contentType,
      extension: image.extension,
      ownerPrefix: `ai-video/${teacherId}/sources`,
      customMetadata: {
        aiVideoUploadState: "pending",
        aiVideoUploadedAt: new Date().toISOString(),
      },
    });
    res.status(201).json({
      objectPath,
      metadata: {
        name: req.file.originalname.slice(0, 255),
        size: image.buffer.length,
        contentType: image.contentType,
        width: image.width,
        height: image.height,
      },
    });
  } catch (err) {
    if (err instanceof InvalidAiVideoSourceImageError) {
      res.status(400).json({ message: err.message });
      return;
    }
    req.log.error({ err }, "Store AI video source image failed");
    res.status(500).json({ message: "Failed to store source image" });
  }
});

router.get("/ai-video/projects", async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const canSeeAdvanced = await hasAiVideoAdminAccess(teacherId);
    const projects = await db.select().from(aiVideoProjectsTable)
      .where(eq(aiVideoProjectsTable.teacherId, teacherId))
      .orderBy(desc(aiVideoProjectsTable.updatedAt))
      .limit(100);
    res.json({
      projects: projects
        .filter((project) => {
          const brief = aiVideoBriefSchema.safeParse(project.brief);
          return brief.success && (brief.data.mode === "narrated_images" || canSeeAdvanced);
        })
        .map(publicProject),
    });
  } catch (err) {
    req.log.error({ err }, "List AI video projects failed");
    res.status(500).json({ message: "Failed to list AI video projects" });
  }
});

router.post("/ai-video/projects/storyboard", sensitiveActionLimiter, async (req, res) => {
  const parsed = aiVideoBriefSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid video brief", issues: parsed.error.issues });
    return;
  }
  const teacherId = req.session.teacherId as number;
  const brief = parsed.data;

  try {
    if (brief.mode !== "narrated_images" && !(await requireAdvancedAccess(teacherId, res))) return;
    const [existing] = await db.select().from(aiVideoProjectsTable)
      .where(eq(aiVideoProjectsTable.storyboardIdempotencyKey, brief.idempotencyKey)).limit(1);
    if (existing) {
      if (existing.teacherId !== teacherId) {
        res.status(409).json({ message: "Idempotency key is unavailable" });
        return;
      }
      if (existing.status === "draft") {
        const leaseIsActive = (existing.storyboardLeaseExpiresAt?.getTime() ?? 0) > Date.now();
        if (leaseIsActive) {
          res.status(202).json(publicProject(existing));
          return;
        }
        await failStaleAiVideoStoryboards(existing.id);
        const recovered = await ownedProject(existing.id, teacherId);
        if (!recovered || recovered.status === "draft") {
          res.status(503).json({ message: "The interrupted storyboard is still being reconciled. Try again shortly." });
          return;
        }
        res.json(publicProject(recovered));
        return;
      }
      res.json(publicProject(existing));
      return;
    }

    await validateSourceImages(brief.sourceImages, teacherId);
    const storyboardLeaseId = randomUUID();
    const inserted = await db.insert(aiVideoProjectsTable).values({
      teacherId,
      title: brief.title,
      status: "draft",
      brief,
      storyboard: null,
      storyboardIdempotencyKey: brief.idempotencyKey,
      storyboardLeaseId,
      storyboardLeaseExpiresAt: new Date(Date.now() + AI_VIDEO_STORYBOARD_LEASE_MS),
    }).onConflictDoNothing().returning();
    if (!inserted[0]) {
      const [winner] = await db.select().from(aiVideoProjectsTable)
        .where(and(
          eq(aiVideoProjectsTable.storyboardIdempotencyKey, brief.idempotencyKey),
          eq(aiVideoProjectsTable.teacherId, teacherId),
        )).limit(1);
      if (!winner) {
        res.status(409).json({ message: "Idempotency key is unavailable" });
        return;
      }
      res.status(winner.status === "draft" ? 202 : 200).json(publicProject(winner));
      return;
    }
    const pending = inserted[0];
    void markAiVideoSourceImagesClaimed(brief.sourceImages).catch((err) => {
      req.log.warn({ err, projectId: pending.id }, "Mark AI video source images claimed failed");
    });
    const creditRequestId = aiVideoStoryboardCreditRequestId(teacherId, brief.idempotencyKey);
    let holdMode: "none" | "held" = "none";
    let heartbeat: NodeJS.Timeout | null = null;
    let leaseLost = false;
    const renewStoryboardLease = async (): Promise<void> => {
      const renewed = await db.update(aiVideoProjectsTable).set({
        storyboardLeaseExpiresAt: new Date(Date.now() + AI_VIDEO_STORYBOARD_LEASE_MS),
        updatedAt: new Date(),
      }).where(and(
        eq(aiVideoProjectsTable.id, pending.id),
        eq(aiVideoProjectsTable.status, "draft"),
        eq(aiVideoProjectsTable.storyboardLeaseId, storyboardLeaseId),
      )).returning({ id: aiVideoProjectsTable.id });
      if (!renewed[0]) throw new Error("AI video storyboard worker lease was lost");
      if (holdMode === "held") await CreditService.heartbeatHold(creditRequestId);
    };
    try {
      const hold = await holdCreditsForToolRequest(
        teacherId,
        brief.mode === "narrated_images" ? "ai-video-economy" : "ai-video",
        creditRequestId,
      );
      holdMode = hold.mode;
      await renewStoryboardLease();
      heartbeat = setInterval(() => {
        renewStoryboardLease().catch((err) => {
          leaseLost = true;
          req.log.error({ err, projectId: pending.id }, "AI video storyboard heartbeat failed");
        });
      }, 60_000);
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        max_completion_tokens: 8192,
        reasoning_effort: "minimal",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are an expert educational video director. Obey the requested JSON contract exactly." },
          { role: "user", content: storyboardPrompt(brief) },
        ],
      }, { timeout: 100_000 });
      const raw = parseJson(completion.choices[0]?.message?.content ?? "");
      const sanitizedStoryboard = sanitizeStoryboard(raw, brief, {
        expectedSceneCount: AI_VIDEO_TARGET_SCENE_COUNTS[brief.durationSeconds],
      });
      const storyboard = {
        ...sanitizedStoryboard,
        scenes: sanitizedStoryboard.scenes.map((scene, index) => ({
          ...scene,
          sourceImage: brief.mode === "narrated_images" && brief.sourceImages.length
            ? brief.sourceImages[index % brief.sourceImages.length]!
            : null,
        })),
      };
      if (leaseLost) throw new Error("AI video storyboard worker lease was lost");
      const project = await db.transaction(async (tx) => {
        const [updated] = await tx.update(aiVideoProjectsTable).set({
          storyboard,
          status: "storyboard_ready",
          title: storyboard.title,
          errorMessage: null,
          storyboardLeaseId: null,
          storyboardLeaseExpiresAt: null,
          updatedAt: new Date(),
        }).where(and(
          eq(aiVideoProjectsTable.id, pending.id),
          eq(aiVideoProjectsTable.status, "draft"),
          eq(aiVideoProjectsTable.storyboardLeaseId, storyboardLeaseId),
        )).returning();
        if (!updated) throw new Error("Storyboard project was modified during generation");

        if (holdMode === "held") {
          const captured = await tx.update(creditHoldsTable).set({
            status: "completed",
            completedAt: new Date(),
            resultJson: JSON.stringify(publicProject(updated)),
          }).where(and(
            eq(creditHoldsTable.requestId, creditRequestId),
            eq(creditHoldsTable.status, "pending"),
          )).returning({ id: creditHoldsTable.id });
          if (!captured[0]) throw new Error("Storyboard credit capture was not confirmed");
          await tx.update(creditTransactionsTable).set({ status: "completed" })
            .where(eq(creditTransactionsTable.requestId, creditRequestId));
        }
        return updated;
      });
      res.status(201).json(publicProject(project));
    } catch (err) {
      let creditReconciled = true;
      if (holdMode === "held") {
        try {
          const holdStatus = await CreditService.getHoldStatus(creditRequestId);
          if (holdStatus === "pending") {
            await CreditService.refund(creditRequestId, "AI video storyboard failed");
          } else if (holdStatus === "completed") {
            const committed = await ownedProject(pending.id, teacherId);
            if (committed?.status === "storyboard_ready") {
              if (!res.headersSent) res.status(201).json(publicProject(committed));
              return;
            }
            creditReconciled = false;
          }
        } catch (refundErr) {
          creditReconciled = false;
          req.log.error({ err: refundErr, projectId: pending.id }, "AI video storyboard refund failed");
        }
      }
      const message = err instanceof Error ? err.message.slice(0, 2_000) : "Storyboard generation failed";
      if (creditReconciled) {
        await db.update(aiVideoProjectsTable).set({
          status: "failed",
          errorMessage: message,
          storyboardLeaseId: null,
          storyboardLeaseExpiresAt: null,
          updatedAt: new Date(),
        }).where(and(
          eq(aiVideoProjectsTable.id, pending.id),
          eq(aiVideoProjectsTable.status, "draft"),
          eq(aiVideoProjectsTable.storyboardLeaseId, storyboardLeaseId),
        ));
      }
      if (err instanceof InsufficientCreditsError) {
        res.status(402).json({ code: "INSUFFICIENT_CREDITS", message: err.message, required: err.required, balance: err.balance });
        return;
      }
      req.log.error({ err, projectId: pending.id }, "AI video storyboard generation failed");
      res.status(502).json({
        message: err instanceof InvalidStoryboardTimingError
          ? err.message
          : "Could not generate a valid storyboard",
      });
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  } catch (err) {
    req.log.error({ err }, "Create AI video storyboard failed");
    res.status(500).json({ message: "Failed to create AI video project" });
  }
});

router.get("/ai-video/projects/:id", async (req, res) => {
  try {
    const id = projectId(req.params.id);
    if (!id) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    const project = await ownedProject(id, req.session.teacherId as number);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    const brief = aiVideoBriefSchema.parse(project.brief);
    if (brief.mode !== "narrated_images"
      && !(await requireAdvancedAccess(req.session.teacherId as number, res))) return;
    res.json(publicProject(project));
  } catch (err) {
    req.log.error({ err }, "Get AI video project failed");
    res.status(500).json({ message: "Failed to get AI video project" });
  }
});

router.patch("/ai-video/projects/:id", async (req, res) => {
  try {
    const id = projectId(req.params.id);
    const body = aiVideoPatchSchema.safeParse(req.body);
    if (!id || !body.success) {
      res.status(id ? 400 : 404).json({ message: id ? "Invalid project update" : "Project not found", issues: body.success ? undefined : body.error.issues });
      return;
    }
    const teacherId = req.session.teacherId as number;
    const existing = await ownedProject(id, teacherId);
    if (!existing) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    const existingBrief = aiVideoBriefSchema.parse(existing.brief);
    if (existingBrief.mode !== "narrated_images"
      && !(await requireAdvancedAccess(teacherId, res))) return;
    if (existing.status === "rendering") {
      res.status(409).json({ message: "A rendering project cannot be edited" });
      return;
    }
    const brief = aiVideoBriefSchema.parse(existing.brief);
    const storyboard = body.data.storyboard
      ? sanitizeStoryboard(body.data.storyboard, brief)
      : undefined;
    const [updated] = await db.update(aiVideoProjectsTable).set({
      ...(body.data.title !== undefined ? { title: body.data.title } : {}),
      ...(storyboard !== undefined ? { storyboard, status: "storyboard_ready", outputUrl: null } : {}),
      errorMessage: null,
      updatedAt: new Date(),
    }).where(and(eq(aiVideoProjectsTable.id, id), eq(aiVideoProjectsTable.teacherId, teacherId))).returning();
    res.json(publicProject(updated));
  } catch (err) {
    req.log.error({ err }, "Update AI video project failed");
    res.status(500).json({ message: "Failed to update AI video project" });
  }
});

const renderBodySchema = z.object({ idempotencyKey: idempotencyKeySchema }).strict();

async function beginRender(req: Request, res: Response, retryOnly: boolean): Promise<void> {
  const id = projectId(req.params.id);
  const body = renderBodySchema.safeParse(req.body ?? {});
  if (!id || !body.success) {
    res.status(id ? 400 : 404).json({ message: id ? "Invalid render request" : "Project not found" });
    return;
  }
  const teacherId = req.session.teacherId as number;
  const existing = await ownedProject(id, teacherId);
  if (!existing) {
    res.status(404).json({ message: "Project not found" });
    return;
  }
  const brief = aiVideoBriefSchema.parse(existing.brief);
  if (brief.mode !== "narrated_images"
    && !(await requireAdvancedAccess(teacherId, res))) return;
  if (existing.status === "ready") {
    res.json(publicProject(existing));
    return;
  }
  if (existing.status === "rendering") {
    if (existing.renderIdempotencyKey === body.data.idempotencyKey) {
      res.status(202).json(publicProject(existing));
    } else {
      res.status(409).json({ message: "A render is already in progress" });
    }
    return;
  }
  if (retryOnly ? existing.status !== "failed" : existing.status !== "storyboard_ready") {
    res.status(409).json({ message: retryOnly ? "Only failed renders can be retried" : "Project is not ready to render" });
    return;
  }
  const storyboard = aiVideoStoryboardSchema.safeParse(existing.storyboard);
  if (!storyboard.success) {
    res.status(409).json({ message: "Project does not have a valid storyboard to render" });
    return;
  }
  const renderIdempotencyKey = body.data.idempotencyKey;
  const creditRequestId = aiVideoRenderCreditRequestId(teacherId, id, renderIdempotencyKey);
  const renderLeaseId = randomUUID();
  const [claimed] = await db.update(aiVideoProjectsTable).set({
    status: "rendering",
    renderIdempotencyKey,
    renderLeaseId,
    renderLeaseExpiresAt: new Date(Date.now() + AI_VIDEO_RENDER_LEASE_MS),
    errorMessage: null,
    outputUrl: null,
    updatedAt: new Date(),
  }).where(and(
    eq(aiVideoProjectsTable.id, id),
    eq(aiVideoProjectsTable.teacherId, teacherId),
    eq(aiVideoProjectsTable.status, existing.status),
  )).returning();
  if (!claimed) {
    const current = await ownedProject(id, teacherId);
    if (current?.renderIdempotencyKey === renderIdempotencyKey && current.status === "rendering") {
      res.status(202).json(publicProject(current));
    } else if (current?.renderIdempotencyKey === renderIdempotencyKey && current.status === "ready") {
      res.json(publicProject(current));
    } else {
      res.status(409).json(current ? publicProject(current) : { message: "Project state changed" });
    }
    return;
  }

  const rollbackClaim = async (): Promise<void> => {
    await db.update(aiVideoProjectsTable).set({
      status: existing.status,
      renderIdempotencyKey: existing.renderIdempotencyKey,
      renderLeaseId: existing.renderLeaseId,
      renderLeaseExpiresAt: existing.renderLeaseExpiresAt,
      errorMessage: existing.errorMessage,
      outputUrl: existing.outputUrl,
      updatedAt: new Date(),
    }).where(and(
      eq(aiVideoProjectsTable.id, id),
      eq(aiVideoProjectsTable.teacherId, teacherId),
      eq(aiVideoProjectsTable.status, "rendering"),
      eq(aiVideoProjectsTable.renderIdempotencyKey, renderIdempotencyKey),
      eq(aiVideoProjectsTable.renderLeaseId, renderLeaseId),
    ));
  };

  let holdMode: "none" | "held" = "none";
  let holdWasCreated = false;
  try {
    const hold = await holdCreditsForToolRequest(
      teacherId,
      brief.mode === "narrated_images"
        ? `ai-video-economy-render-${brief.durationSeconds}`
        : "ai-video-render",
      creditRequestId,
    );
    holdMode = hold.mode;
    holdWasCreated = hold.mode === "held" && !hold.existingStatus;
    if (hold.existingStatus && hold.existingStatus !== "pending") {
      await rollbackClaim();
      res.status(409).json({ message: "This render idempotency key was already used; use a new key" });
      return;
    }
    startAiVideoRender(claimed);
    res.status(202).json(publicProject(claimed));
  } catch (err) {
    let creditReconciled = true;
    if (holdMode === "held" && holdWasCreated) {
      try {
        await CreditService.refund(creditRequestId, "AI video render could not start");
      } catch (refundErr) {
        creditReconciled = false;
        req.log.error({ err: refundErr, projectId: id }, "AI video render start refund failed");
      }
    }
    if (creditReconciled) {
      await rollbackClaim();
    }
    if (err instanceof InsufficientCreditsError) {
      res.status(402).json({ code: "INSUFFICIENT_CREDITS", message: err.message, required: err.required, balance: err.balance });
      return;
    }
    throw err;
  }
}

router.post("/ai-video/projects/:id/render", sensitiveActionLimiter, (req, res) => {
  void beginRender(req, res, false).catch((err) => {
    req.log.error({ err }, "Start AI video render failed");
    if (!res.headersSent) res.status(500).json({ message: "Failed to start render" });
  });
});

router.post("/ai-video/projects/:id/retry-render", sensitiveActionLimiter, (req, res) => {
  void beginRender(req, res, true).catch((err) => {
    req.log.error({ err }, "Retry AI video render failed");
    if (!res.headersSent) res.status(500).json({ message: "Failed to retry render" });
  });
});

export default router;