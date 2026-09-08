import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const schema = `ai_video_journal_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
const originalTestUrl = process.env.TEST_DATABASE_URL;
if (!originalTestUrl) {
  throw new Error("TEST_DATABASE_URL is required for AI-video journal integration tests");
}
if (process.env.DATABASE_URL !== originalTestUrl) {
  throw new Error("Run this suite with vitest.integration.config.ts and its test-database safety guard");
}

const isolatedUrl = new URL(originalTestUrl);
isolatedUrl.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = isolatedUrl.toString();

let schemaCreated = false;
let pool: typeof import("@workspace/db").pool;
let createFactory: typeof import("../lib/ai-video-request-journal").createAiVideoMotionJournalFactory;
let hashStoryboard: typeof import("../lib/ai-video-request-journal").hashAiVideoStoryboard;
let inspectCosts: typeof import("../lib/ai-video-request-journal").inspectAiVideoProviderRequestCosts;
let assertResumable: typeof import("../lib/ai-video-request-journal").assertAiVideoRequestsResumable;

async function createProject(leaseId: string): Promise<number> {
  const result = await pool.query(`
    INSERT INTO ai_video_projects (
      teacher_id, title, status, brief, storyboard_idempotency_key,
      render_lease_id, render_lease_expires_at
    ) VALUES (1, 'journal test', 'rendering', '{}'::jsonb, $1, $2, NOW() + INTERVAL '10 minutes')
    RETURNING id
  `, [randomUUID(), leaseId]);
  return Number(result.rows[0].id);
}

async function row(projectId: number): Promise<Record<string, unknown>> {
  const result = await pool.query(
    "SELECT * FROM ai_video_provider_requests WHERE project_id = $1",
    [projectId],
  );
  return result.rows[0] as Record<string, unknown>;
}

beforeAll(async () => {
  const dbModule = await import("@workspace/db");
  pool = dbModule.pool;
  await pool.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  await pool.query(`
    CREATE TABLE teachers (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, password_hash TEXT NOT NULL
    );
    INSERT INTO teachers (name, email, password_hash) VALUES ('owner', 'journal@test.local', 'x');
    CREATE TABLE ai_video_projects (
      id SERIAL PRIMARY KEY,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id),
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      brief JSONB NOT NULL,
      storyboard_idempotency_key TEXT NOT NULL UNIQUE,
      render_lease_id TEXT,
      render_lease_expires_at TIMESTAMPTZ
    );
    CREATE TABLE ai_video_provider_requests (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES ai_video_projects(id) ON DELETE CASCADE,
      scene_index INTEGER NOT NULL CHECK (scene_index >= 0),
      storyboard_hash TEXT NOT NULL,
      provider_model TEXT NOT NULL,
      tracking_model TEXT NOT NULL,
      request_id TEXT,
      state TEXT NOT NULL DEFAULT 'intent',
      render_lease_id TEXT NOT NULL,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX ai_video_provider_requests_identity_uq
      ON ai_video_provider_requests(project_id, scene_index, storyboard_hash);
  `);
  const journal = await import("../lib/ai-video-request-journal");
  createFactory = journal.createAiVideoMotionJournalFactory;
  hashStoryboard = journal.hashAiVideoStoryboard;
  inspectCosts = journal.inspectAiVideoProviderRequestCosts;
  assertResumable = journal.assertAiVideoRequestsResumable;
});

afterAll(async () => {
  try {
    if (schemaCreated) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
  } finally {
    if (pool) await pool.end();
    process.env.DATABASE_URL = originalTestUrl;
  }
});

describe("AI-video provider journal against isolated real PostgreSQL", () => {
  it("allows exactly one concurrent prepare to authorize a paid POST", async () => {
    const lease = randomUUID();
    const projectId = await createProject(lease);
    const storyboardHash = hashStoryboard({ scenes: ["same"], aspectRatio: "9:16", language: "ar" });
    const factory = createFactory({ projectId, renderLeaseId: lease });

    const attempts = await Promise.allSettled([
      factory(0, storyboardHash).prepare(),
      factory(0, storyboardHash).prepare(),
      factory(0, storyboardHash).prepare(),
    ]);
    const authorizedPosts = attempts.filter(
      (attempt) => attempt.status === "fulfilled" && attempt.value.action === "submit",
    );
    expect(authorizedPosts).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(2);
    expect(await row(projectId)).toMatchObject({
      scene_index: 0,
      storyboard_hash: storyboardHash,
      state: "submitting",
      render_lease_id: lease,
      request_id: null,
    });
  });

  it("persists a late response ID, then only the current lease may advance it", async () => {
    const oldLease = randomUUID();
    const newLease = randomUUID();
    const projectId = await createProject(oldLease);
    const storyboardHash = hashStoryboard({
      scenes: ["dialogue"],
      aspectRatio: "16:9",
      language: "ar",
    });
    const oldJournal = createFactory({ projectId, renderLeaseId: oldLease })(0, storyboardHash);
    await expect(oldJournal.prepare()).resolves.toEqual({ action: "submit" });
    await expect(
      oldJournal.recordSubmissionUnknown("local deadline elapsed before response"),
    ).resolves.toBeUndefined();

    await pool.query(
      "UPDATE ai_video_projects SET render_lease_id = $1 WHERE id = $2",
      [newLease, projectId],
    );
    await expect(
      createFactory({ projectId, renderLeaseId: oldLease })(1, storyboardHash).prepare(),
    ).rejects.toThrow("lease was lost");
    const currentJournal = createFactory({ projectId, renderLeaseId: newLease })(0, storyboardHash);
    await expect(currentJournal.prepare()).rejects.toThrow("Automatic resubmission is blocked");

    // The response belongs to the already-paid POST. Identity persistence is
    // append-only even though all status mutations remain lease-fenced.
    await expect(oldJournal.recordRequestId("late_request_123")).resolves.toBeUndefined();
    await expect(oldJournal.recordCompleted()).rejects.toThrow("lease was lost");
    expect(await row(projectId)).toMatchObject({
      state: "submitted",
      request_id: "late_request_123",
      render_lease_id: oldLease,
    });

    await expect(currentJournal.prepare()).resolves.toEqual({
      action: "resume",
      requestId: "late_request_123",
    });
    await expect(oldJournal.recordFailed("stale worker")).rejects.toThrow("lease was lost");
    await expect(currentJournal.recordCompleted()).resolves.toBeUndefined();
    expect(await row(projectId)).toMatchObject({
      state: "completed",
      request_id: "late_request_123",
      render_lease_id: newLease,
    });
  });

  it("blocks terminal failed and unusable identities before another hold or POST", async () => {
    const lease = randomUUID();
    const projectId = await createProject(lease);
    const storyboardHash = hashStoryboard({ scenes: ["one", "two"], aspectRatio: "9:16", language: "ar" });
    const factory = createFactory({ projectId, renderLeaseId: lease });

    const failed = factory(0, storyboardHash);
    await failed.prepare();
    await failed.recordRequestId("terminal_failed_id");
    await failed.recordFailed("provider terminal failure");
    await expect(failed.prepare()).rejects.toMatchObject({
      code: "AI_VIDEO_PROVIDER_RECONCILIATION_REQUIRED",
      journalState: "failed",
    });

    const unusable = factory(1, storyboardHash);
    await unusable.prepare();
    await unusable.recordRequestId("unusable_media_id");
    await unusable.recordCompleted();
    await unusable.recordUnusableResult!("invalid MP4");
    await expect(unusable.prepare()).rejects.toMatchObject({
      code: "AI_VIDEO_PROVIDER_RECONCILIATION_REQUIRED",
      journalState: "unusable",
    });
    await expect(assertResumable({ projectId, storyboardHash })).rejects.toMatchObject({
      code: "AI_VIDEO_PROVIDER_RECONCILIATION_REQUIRED",
    });
    await expect(inspectCosts({
      projectId,
      storyboardHash,
      totalScenes: 2,
    })).resolves.toEqual({
      totalScenes: 2,
      requiredSubmissions: 0,
      reusableRequestIds: 0,
      blockedUnknownSubmissions: 0,
      terminalFailedRequests: 1,
      unusableResults: 1,
    });
  });
});