import { mkdtemp, readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import {
  aiVideoProjectsTable,
  creditHoldsTable,
  creditTransactionsTable,
  db,
  type AiVideoProject,
} from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";
import { CreditService } from "./credit-service";
import { aiVideoBriefSchema, aiVideoStoryboardSchema } from "./ai-video-schemas";
import { composeAiVideo } from "./ai-video-composition";
import { composeEconomyAiVideo } from "./ai-video-economy-composition";
import { createAiVideoMotionJournalFactory } from "./ai-video-request-journal";
import { hashAiVideoGenerationIdentity } from "./ai-video-request-journal";
export { buildAiVideoTransitionFilter } from "./ai-video-composition";

const storage = new ObjectStorageService();
const VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
const TOTAL_RENDER_TIMEOUT_MS = 45 * 60_000;
export const AI_VIDEO_RENDER_LEASE_MS = 3 * 60_000;
export const AI_VIDEO_STORYBOARD_LEASE_MS = 3 * 60_000;
const AI_VIDEO_RENDER_HEARTBEAT_MS = 60_000;
type Voice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export function aiVideoRenderCreditRequestId(
  teacherId: number,
  projectId: number,
  renderIdempotencyKey: string,
): string {
  return `${teacherId}:ai-video-render:${projectId}:${renderIdempotencyKey}`;
}

export function aiVideoStoryboardCreditRequestId(
  teacherId: number,
  storyboardIdempotencyKey: string,
): string {
  return `${teacherId}:ai-video:${storyboardIdempotencyKey}`;
}

function remainingTimeout(deadline: number, capMs: number, stage: string): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error(`AI video render exceeded its total deadline during ${stage}`);
  }
  return Math.max(1_000, Math.min(capMs, remaining));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stage: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${stage} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function renderClaimedProject(project: AiVideoProject): Promise<void> {
  let dir: string | null = null;
  let heartbeat: NodeJS.Timeout | null = null;
  let leaseLost = false;
  const deadline = Date.now() + TOTAL_RENDER_TIMEOUT_MS;
  const creditRequestId = project.renderIdempotencyKey
    ? aiVideoRenderCreditRequestId(project.teacherId, project.id, project.renderIdempotencyKey)
    : null;

  const renewLease = async (): Promise<void> => {
    if (!project.renderLeaseId) throw new Error("AI video render has no worker lease");
    const renewed = await db.update(aiVideoProjectsTable).set({
      renderLeaseExpiresAt: new Date(Date.now() + AI_VIDEO_RENDER_LEASE_MS),
      updatedAt: new Date(),
    }).where(and(
      eq(aiVideoProjectsTable.id, project.id),
      eq(aiVideoProjectsTable.status, "rendering"),
      eq(aiVideoProjectsTable.renderLeaseId, project.renderLeaseId),
    )).returning({ id: aiVideoProjectsTable.id });
    if (!renewed[0]) throw new Error("AI video render worker lease was lost");
    if (creditRequestId) await CreditService.heartbeatHold(creditRequestId);
  };
  const assertActive = async (): Promise<void> => {
    if (leaseLost) throw new Error("AI video render worker lease was lost");
    try {
      await renewLease();
    } catch (err) {
      leaseLost = true;
      throw err;
    }
  };

  try {
    dir = await mkdtemp(join(tmpdir(), `hasaad-ai-video-${project.id}-`));
    await renewLease();
    heartbeat = setInterval(() => {
      renewLease().catch((err) => {
        leaseLost = true;
        logger.error({ err, projectId: project.id }, "AI video render heartbeat failed");
      });
    }, AI_VIDEO_RENDER_HEARTBEAT_MS);

    const brief = aiVideoBriefSchema.parse(project.brief);
    const storyboard = aiVideoStoryboardSchema.parse(project.storyboard);
    const voice: Voice = VOICES.has(brief.voice) ? brief.voice as Voice : "nova";
    const persistStoryboard = async (updatedStoryboard: typeof storyboard) => {
        const persisted = await db.update(aiVideoProjectsTable).set({
          storyboard: updatedStoryboard,
          updatedAt: new Date(),
        }).where(and(
          eq(aiVideoProjectsTable.id, project.id),
          eq(aiVideoProjectsTable.status, "rendering"),
          eq(aiVideoProjectsTable.renderLeaseId, project.renderLeaseId!),
        )).returning({ id: aiVideoProjectsTable.id });
        if (!persisted[0]) {
          leaseLost = true;
          throw new Error("AI video render worker lease was lost");
        }
    };
    let finalPath: string;
    if (brief.mode === "narrated_images") {
      finalPath = await composeEconomyAiVideo({
        brief,
        storyboard,
        dir,
        deadline,
        voice,
        assertActive,
        persistStoryboard,
      });
    } else {
      if (!project.renderLeaseId) throw new Error("AI video render has no worker lease");
      const motionJournalForScene = createAiVideoMotionJournalFactory({
        projectId: project.id,
        renderLeaseId: project.renderLeaseId,
      });
      const generationJournalForScene = (
        sceneIndex: number,
        canonicalStoryboardHash: string,
      ) => motionJournalForScene(sceneIndex, hashAiVideoGenerationIdentity({
        canonicalStoryboardHash,
        aspectRatio: brief.aspectRatio,
        language: brief.language,
      }));
      finalPath = await composeAiVideo({
        brief,
        storyboard,
        dir,
        deadline,
        voice,
        assertActive,
        requestJournal: generationJournalForScene,
        persistStoryboard,
      });
    }

    const uploadTimeout = remainingTimeout(deadline, 180_000, "video upload");
    const output = await readFile(finalPath);
    if (!output.length) throw new Error("Renderer produced an empty video");
    await assertActive();
    const outputUrl = await withTimeout(
      storage.uploadBufferAsPrivate({
        buffer: output,
        contentType: "video/mp4",
        ownerPrefix: brief.mode === "narrated_images"
          ? `ai-video-economy/${project.teacherId}/projects/${project.id}`
          : `ai-video/${project.teacherId}/projects/${project.id}`,
        extension: "mp4",
      }),
      uploadTimeout,
      "Video upload",
    );
    if (!outputUrl.startsWith("/objects/")) throw new Error("Video upload did not return a durable object path");
    await assertActive();
    await db.transaction(async (tx) => {
      if (creditRequestId) {
        const [hold] = await tx.select({ status: creditHoldsTable.status })
          .from(creditHoldsTable)
          .where(eq(creditHoldsTable.requestId, creditRequestId))
          .limit(1);
        if (hold?.status === "pending") {
          const captured = await tx.update(creditHoldsTable).set({
            status: "completed",
            completedAt: new Date(),
          }).where(and(
            eq(creditHoldsTable.requestId, creditRequestId),
            eq(creditHoldsTable.status, "pending"),
          )).returning({ id: creditHoldsTable.id });
          if (!captured[0]) throw new Error("Render credit capture was not confirmed");
          await tx.update(creditTransactionsTable).set({ status: "completed" })
            .where(eq(creditTransactionsTable.requestId, creditRequestId));
        } else if (hold && hold.status !== "completed") {
          throw new Error("Render credit capture was not confirmed");
        }
      }

      const ready = await tx.update(aiVideoProjectsTable).set({
        status: "ready",
        outputUrl,
        errorMessage: null,
        renderLeaseId: null,
        renderLeaseExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(aiVideoProjectsTable.id, project.id),
        eq(aiVideoProjectsTable.status, "rendering"),
        eq(aiVideoProjectsTable.renderLeaseId, project.renderLeaseId!),
      )).returning({ id: aiVideoProjectsTable.id });
      if (!ready[0]) throw new Error("Rendered project state changed before completion");
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 2_000) : "Unknown render failure";
    logger.error({ err, projectId: project.id }, "AI video render failed");
    let creditReconciled = true;
    if (project.renderIdempotencyKey) {
      try {
        const requestId = aiVideoRenderCreditRequestId(project.teacherId, project.id, project.renderIdempotencyKey);
        const holdStatus = await CreditService.getHoldStatus(requestId);
        if (holdStatus === "completed") {
          await CreditService.compensateCapturedHold(requestId, "AI video render failed after capture");
        } else {
          await CreditService.refund(requestId, "AI video render failed");
        }
      } catch (refundErr) {
        creditReconciled = false;
        logger.error({ err: refundErr, projectId: project.id }, "AI video render credit refund failed");
      }
    }
    if (creditReconciled) {
      await db.update(aiVideoProjectsTable).set({
        status: "failed",
        errorMessage: message,
        outputUrl: null,
        renderLeaseId: null,
        renderLeaseExpiresAt: null,
        updatedAt: new Date(),
      }).where(and(
        eq(aiVideoProjectsTable.id, project.id),
        eq(aiVideoProjectsTable.status, "rendering"),
        eq(aiVideoProjectsTable.renderLeaseId, project.renderLeaseId!),
      ));
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (dir) {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (err) {
        logger.warn({ err, projectId: project.id }, "AI video render temp cleanup failed");
      }
    }
  }
}

export async function runAiVideoRender(project: AiVideoProject): Promise<void> {
  await renderClaimedProject(project);
}

export function startAiVideoRender(project: AiVideoProject): void {
  void runAiVideoRender(project).catch((err) => {
    logger.error({ err, projectId: project.id }, "AI video render worker escaped its failure boundary");
  });
}

export async function failStaleAiVideoStoryboards(projectId?: number): Promise<number> {
  const legacyStaleBefore = new Date(Date.now() - AI_VIDEO_STORYBOARD_LEASE_MS);
  const selectedProjectId = projectId ?? null;
  const rows = await db.execute(sql`
    SELECT id, teacher_id, storyboard_idempotency_key, storyboard_lease_id
      FROM ai_video_projects
     WHERE status = 'draft'
       AND (${selectedProjectId}::int IS NULL OR id = ${selectedProjectId})
       AND (
         storyboard_lease_expires_at <= NOW()
         OR (storyboard_lease_expires_at IS NULL AND updated_at <= ${legacyStaleBefore})
       )
  `);
  let recovered = 0;
  for (const row of rows.rows as Array<{
    id: number;
    teacher_id: number;
    storyboard_idempotency_key: string;
    storyboard_lease_id: string | null;
  }>) {
    const recoveryLeaseId = randomUUID();
    const claimed = await db.execute(sql`
      UPDATE ai_video_projects
         SET storyboard_lease_id = ${recoveryLeaseId},
             storyboard_lease_expires_at = NOW() + (${AI_VIDEO_STORYBOARD_LEASE_MS} * INTERVAL '1 millisecond'),
             updated_at = NOW()
       WHERE id = ${Number(row.id)}
         AND status = 'draft'
         AND (
           (
             storyboard_lease_id = ${row.storyboard_lease_id}
             AND storyboard_lease_expires_at <= NOW()
           )
           OR (
             storyboard_lease_id IS NULL
             AND ${row.storyboard_lease_id}::text IS NULL
             AND updated_at <= ${legacyStaleBefore}
           )
         )
       RETURNING id
    `);
    if (claimed.rows.length === 0) continue;

    let creditReconciled = true;
    try {
      const requestId = aiVideoStoryboardCreditRequestId(
        Number(row.teacher_id),
        row.storyboard_idempotency_key,
      );
      const holdStatus = await CreditService.getHoldStatus(requestId);
      if (holdStatus === "completed") {
        await CreditService.compensateCapturedHold(
          requestId,
          "AI video storyboard result was not committed before its worker lease expired",
        );
      } else if (holdStatus === "pending") {
        await CreditService.refund(
          requestId,
          "AI video storyboard generation stopped before completion",
        );
      }
    } catch (err) {
      creditReconciled = false;
      logger.error({ err, projectId: row.id }, "Interrupted AI video storyboard credit refund failed");
    }
    if (!creditReconciled) continue;

    const updated = await db.update(aiVideoProjectsTable).set({
      status: "failed",
      errorMessage: "Storyboard generation stopped before completion. Create a new attempt.",
      storyboardLeaseId: null,
      storyboardLeaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(aiVideoProjectsTable.id, Number(row.id)),
      eq(aiVideoProjectsTable.status, "draft"),
      eq(aiVideoProjectsTable.storyboardLeaseId, recoveryLeaseId),
    )).returning({ id: aiVideoProjectsTable.id });
    recovered += updated.length;
  }
  return recovered;
}

export async function failStaleAiVideoRenders(): Promise<number> {
  const legacyStaleBefore = new Date(Date.now() - AI_VIDEO_RENDER_LEASE_MS);
  const rows = await db.execute(sql`
    SELECT id, teacher_id, render_idempotency_key, render_lease_id
      FROM ai_video_projects
     WHERE status = 'rendering'
       AND (
         render_lease_expires_at <= NOW()
         OR (render_lease_expires_at IS NULL AND updated_at <= ${legacyStaleBefore})
       )
  `);
  let recovered = 0;
  for (const row of rows.rows as Array<{
    id: number;
    teacher_id: number;
    render_idempotency_key: string | null;
    render_lease_id: string | null;
  }>) {
    const recoveryLeaseId = randomUUID();
    const claimed = await db.execute(sql`
      UPDATE ai_video_projects
         SET render_lease_id = ${recoveryLeaseId},
             render_lease_expires_at = NOW() + (${AI_VIDEO_RENDER_LEASE_MS} * INTERVAL '1 millisecond'),
             updated_at = NOW()
       WHERE id = ${Number(row.id)}
         AND status = 'rendering'
         AND (
           (render_lease_id = ${row.render_lease_id} AND render_lease_expires_at <= NOW())
           OR (
             render_lease_id IS NULL
             AND ${row.render_lease_id}::text IS NULL
             AND updated_at <= ${legacyStaleBefore}
           )
         )
       RETURNING id
    `);
    if (claimed.rows.length === 0) continue;

    let creditReconciled = true;
    if (row.render_idempotency_key) {
      try {
        const requestId = aiVideoRenderCreditRequestId(
          Number(row.teacher_id),
          Number(row.id),
          row.render_idempotency_key,
        );
        const holdStatus = await CreditService.getHoldStatus(requestId);
        if (holdStatus === "completed") {
          await CreditService.compensateCapturedHold(
            requestId,
            "AI video render result was not committed before server restart",
          );
        } else {
          await CreditService.refund(requestId, "AI video render interrupted by server restart");
        }
      } catch (err) {
        creditReconciled = false;
        logger.error({ err, projectId: row.id }, "Interrupted AI video render credit refund failed");
      }
    }
    if (!creditReconciled) continue;
    const updated = await db.update(aiVideoProjectsTable).set({
      status: "failed",
      errorMessage: "Rendering stopped after its worker lease expired. Retry the render.",
      renderLeaseId: null,
      renderLeaseExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(aiVideoProjectsTable.id, Number(row.id)),
      eq(aiVideoProjectsTable.status, "rendering"),
      eq(aiVideoProjectsTable.renderLeaseId, recoveryLeaseId),
    )).returning({ id: aiVideoProjectsTable.id });
    recovered += updated.length;
  }
  return recovered;
}