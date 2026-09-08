import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export const AI_VIDEO_PROVIDER_MODEL = "fal-ai/veo3.1";
export const AI_VIDEO_TRACKING_MODEL = AI_VIDEO_PROVIDER_MODEL.split("/").slice(0, 2).join("/");

export type AiVideoMotionRequestJournal = {
  /**
   * Atomically persists intent before allowing the caller to POST. A stored
   * request ID is always resumed. A prior ambiguous POST is never retried.
   */
  prepare(): Promise<{ action: "submit" } | { action: "resume"; requestId: string }>;
  recordRequestId(requestId: string): Promise<void>;
  recordCompleted(): Promise<void>;
  recordFailed(message: string): Promise<void>;
  recordUnusableResult?(message: string): Promise<void>;
  recordSubmissionUnknown(message: string): Promise<void>;
};

export type AiVideoMotionJournalFactory = (
  sceneIndex: number,
  storyboardHash: string,
) => AiVideoMotionRequestJournal;

export type AiVideoProviderRequestCostInspection = {
  totalScenes: number;
  requiredSubmissions: number;
  reusableRequestIds: number;
  blockedUnknownSubmissions: number;
  terminalFailedRequests: number;
  unusableResults: number;
};

export class AiVideoProviderReconciliationError extends Error {
  readonly code = "AI_VIDEO_PROVIDER_RECONCILIATION_REQUIRED";

  constructor(
    readonly journalState: "submission_unknown" | "submitting" | "failed" | "unusable",
    message: string,
  ) {
    super(message);
    this.name = "AiVideoProviderReconciliationError";
  }
}

export function hashAiVideoStoryboard(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function hashAiVideoGenerationIdentity(input: {
  canonicalStoryboardHash: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  language: string;
}): string {
  validHash(input.canonicalStoryboardHash);
  if (!input.language.trim()) throw new Error("AI video generation identity requires a language");
  return hashAiVideoStoryboard({
    canonicalStoryboardHash: input.canonicalStoryboardHash,
    aspectRatio: input.aspectRatio,
    language: input.language.trim().toLowerCase(),
  });
}

/**
 * Read-only quote input. Provider price multiplication remains with the route
 * that owns quote/approval policy; this reports how many paid submissions may
 * still be needed and which scenes must be reconciled instead.
 */
export async function inspectAiVideoProviderRequestCosts(input: {
  projectId: number;
  storyboardHash: string;
  totalScenes: number;
}): Promise<AiVideoProviderRequestCostInspection> {
  validHash(input.storyboardHash);
  if (!Number.isInteger(input.totalScenes) || input.totalScenes < 0) {
    throw new Error("AI video request cost inspection requires a valid scene count");
  }
  const result = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE request_id IS NOT NULL)::int AS reusable,
      COUNT(*) FILTER (
        WHERE request_id IS NULL
          AND state IN ('submitting', 'submission_unknown', 'failed')
      )::int AS blocked,
      COUNT(*) FILTER (WHERE state = 'failed')::int AS terminal_failed,
      COUNT(*) FILTER (WHERE state = 'unusable')::int AS unusable
      FROM ai_video_provider_requests
     WHERE project_id = ${input.projectId}
       AND storyboard_hash = ${input.storyboardHash}
       AND scene_index >= 0
       AND scene_index < ${input.totalScenes}
  `);
  const row = result.rows[0] as {
    reusable?: number | string;
    blocked?: number | string;
    terminal_failed?: number | string;
    unusable?: number | string;
  } | undefined;
  const terminalFailedRequests = Number(row?.terminal_failed ?? 0);
  const unusableResults = Number(row?.unusable ?? 0);
  const reusableRequestIds = Math.max(
    0,
    Number(row?.reusable ?? 0) - terminalFailedRequests - unusableResults,
  );
  const blockedUnknownSubmissions = Number(row?.blocked ?? 0);
  return {
    totalScenes: input.totalScenes,
    reusableRequestIds,
    blockedUnknownSubmissions,
    terminalFailedRequests,
    unusableResults,
    requiredSubmissions: Math.max(
      0,
      input.totalScenes
        - reusableRequestIds
        - blockedUnknownSubmissions
        - terminalFailedRequests
        - unusableResults,
    ),
  };
}

export async function assertAiVideoRequestsResumable(input: {
  projectId: number;
  storyboardHash: string;
}): Promise<void> {
  validHash(input.storyboardHash);
  const result = await db.execute(sql`
    SELECT state
      FROM ai_video_provider_requests
     WHERE project_id = ${input.projectId}
       AND storyboard_hash = ${input.storyboardHash}
       AND (
         state IN ('failed', 'unusable', 'submission_unknown')
         OR (state = 'submitting' AND request_id IS NULL)
       )
     ORDER BY scene_index
     LIMIT 1
  `);
  const state = (result.rows[0] as { state?: string } | undefined)?.state as
    | "submission_unknown" | "submitting" | "failed" | "unusable" | undefined;
  if (!state) return;
  throw reconciliationError(state);
}

type JournalRow = {
  id: number;
  request_id: string | null;
  state: string;
  provider_model: string;
  tracking_model: string;
};

function validSceneIndex(sceneIndex: number): void {
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0) {
    throw new Error("AI video provider journal requires a valid scene index");
  }
}

function validHash(storyboardHash: string): void {
  if (!/^[a-f0-9]{64}$/.test(storyboardHash)) {
    throw new Error("AI video provider journal requires a SHA-256 storyboard hash");
  }
}

function reconciliationError(
  state: "submission_unknown" | "submitting" | "failed" | "unusable",
): AiVideoProviderReconciliationError {
  const detail = state === "failed"
    ? "The provider request ended in a terminal failure."
    : state === "unusable"
      ? "The provider result failed media validation."
      : "The paid submission response was lost before its request ID could be confirmed.";
  return new AiVideoProviderReconciliationError(
    state,
    `${detail} Automatic replacement is blocked; use a new storyboard identity or administrator reconciliation.`,
  );
}

export function createAiVideoMotionJournalFactory(input: {
  projectId: number;
  renderLeaseId: string;
}): AiVideoMotionJournalFactory {
  if (!Number.isInteger(input.projectId) || input.projectId <= 0 || !input.renderLeaseId) {
    throw new Error("AI video provider journal requires a project and render lease");
  }

  return (sceneIndex, storyboardHash) => {
    validSceneIndex(sceneIndex);
    validHash(storyboardHash);

    const activeLease = sql`
      EXISTS (
        SELECT 1 FROM ai_video_projects p
         WHERE p.id = ${input.projectId}
           AND p.status = 'rendering'
           AND p.render_lease_id = ${input.renderLeaseId}
      )
    `;

    const assertActiveLease = async (): Promise<void> => {
      const result = await db.execute(sql`
        SELECT 1
          FROM ai_video_projects
         WHERE id = ${input.projectId}
           AND status = 'rendering'
           AND render_lease_id = ${input.renderLeaseId}
         LIMIT 1
      `);
      if (!result.rows[0]) throw new Error("AI video render worker lease was lost");
    };

    const load = async (): Promise<JournalRow> => {
      const result = await db.execute(sql`
        SELECT id, request_id, state, provider_model, tracking_model
          FROM ai_video_provider_requests
         WHERE project_id = ${input.projectId}
           AND scene_index = ${sceneIndex}
           AND storyboard_hash = ${storyboardHash}
         LIMIT 1
      `);
      const row = result.rows[0] as JournalRow | undefined;
      if (!row) throw new Error("AI video provider request intent could not be persisted");
      if (
        row.provider_model !== AI_VIDEO_PROVIDER_MODEL
        || row.tracking_model !== AI_VIDEO_TRACKING_MODEL
      ) {
        throw new Error("Stored AI video provider request belongs to a different model");
      }
      return row;
    };

    const fencedUpdate = async (
      fragment: ReturnType<typeof sql>,
      expectedState: ReturnType<typeof sql>,
    ): Promise<void> => {
      const result = await db.execute(sql`
        UPDATE ai_video_provider_requests
           SET ${fragment}, updated_at = NOW()
         WHERE project_id = ${input.projectId}
           AND scene_index = ${sceneIndex}
           AND storyboard_hash = ${storyboardHash}
           AND render_lease_id = ${input.renderLeaseId}
           AND ${expectedState}
           AND ${activeLease}
         RETURNING id
      `);
      if (!result.rows[0]) throw new Error("AI video render worker lease was lost");
    };

    return {
      async prepare() {
        await assertActiveLease();
        await db.execute(sql`
          INSERT INTO ai_video_provider_requests (
            project_id, scene_index, storyboard_hash, provider_model,
            tracking_model, state, render_lease_id
          )
          SELECT ${input.projectId}, ${sceneIndex}, ${storyboardHash},
                 ${AI_VIDEO_PROVIDER_MODEL}, ${AI_VIDEO_TRACKING_MODEL},
                 'intent', ${input.renderLeaseId}
           WHERE ${activeLease}
          ON CONFLICT (project_id, scene_index, storyboard_hash) DO NOTHING
        `);

        let row = await load();
        if (row.state === "failed" || row.state === "unusable") {
          throw reconciliationError(row.state);
        }
        if (row.request_id) {
          const claimed = await db.execute(sql`
            UPDATE ai_video_provider_requests
               SET render_lease_id = ${input.renderLeaseId}, updated_at = NOW()
             WHERE id = ${row.id} AND ${activeLease}
             RETURNING id
          `);
          if (!claimed.rows[0]) throw new Error("AI video render worker lease was lost");
          return { action: "resume" as const, requestId: row.request_id };
        }
        if (row.state === "submitting" || row.state === "submission_unknown") {
          throw reconciliationError(row.state);
        }
        if (row.state !== "intent") {
          throw new Error(`Stored AI video provider request cannot be submitted from state ${row.state}`);
        }

        const claimed = await db.execute(sql`
          UPDATE ai_video_provider_requests
             SET state = 'submitting',
                 render_lease_id = ${input.renderLeaseId},
                 updated_at = NOW()
           WHERE id = ${row.id}
             AND state = 'intent'
             AND request_id IS NULL
             AND ${activeLease}
           RETURNING id
        `);
        if (claimed.rows[0]) return { action: "submit" as const };
        row = await load();
        if (row.request_id) return { action: "resume" as const, requestId: row.request_id };
        throw reconciliationError(row.state === "submission_unknown" ? row.state : "submitting");
      },

      async recordRequestId(requestId) {
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(requestId)) {
          throw new Error("Cannot journal an invalid fal request ID");
        }
        // This is the sole append-only fencing exception: a paid POST response
        // may arrive after its worker lease expires. Preserve that identity
        // against the lease that submitted it so the current worker can adopt
        // and poll it; the stale worker still cannot mark status/completion.
        const result = await db.execute(sql`
          UPDATE ai_video_provider_requests
             SET request_id = ${requestId},
                 state = 'submitted',
                 error_message = NULL,
                 updated_at = NOW()
           WHERE project_id = ${input.projectId}
             AND scene_index = ${sceneIndex}
             AND storyboard_hash = ${storyboardHash}
             AND render_lease_id = ${input.renderLeaseId}
             AND state IN ('submitting', 'submission_unknown')
             AND (request_id IS NULL OR request_id = ${requestId})
           RETURNING id
        `);
        if (!result.rows[0]) {
          throw new Error("AI video request ID did not match its submitting lease");
        }
      },

      async recordCompleted() {
        await fencedUpdate(
          sql`state = 'completed', error_message = NULL`,
          sql`state IN ('submitted', 'completed') AND request_id IS NOT NULL`,
        );
      },

      async recordFailed(message) {
        await fencedUpdate(
          sql`state = 'failed', error_message = ${message.slice(0, 2_000)}`,
          sql`state IN ('submitted', 'failed') AND request_id IS NOT NULL`,
        );
      },

      async recordUnusableResult(message) {
        await fencedUpdate(
          sql`state = 'unusable', error_message = ${message.slice(0, 2_000)}`,
          sql`state IN ('submitted', 'completed', 'unusable') AND request_id IS NOT NULL`,
        );
      },

      async recordSubmissionUnknown(message) {
        await fencedUpdate(
          sql`state = 'submission_unknown', error_message = ${message.slice(0, 2_000)}`,
          sql`state IN ('submitting', 'submission_unknown') AND request_id IS NULL`,
        );
      },
    };
  };
}