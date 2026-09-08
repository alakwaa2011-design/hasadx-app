import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { aiVideoStoryboardSchema } from "../lib/ai-video-schemas";

vi.mock("../lib/objectStorage", () => ({
  ObjectStorageService: class {
    async getObjectEntityUploadURL(): Promise<never> {
      throw new Error("storage must not be called by stale-lease recovery");
    }
  },
}));
vi.mock("../lib/ai-video-composition", () => ({
  composeAiVideo: async (): Promise<never> => {
    throw new Error("composition must not be called by stale-lease recovery");
  },
  buildAiVideoTransitionFilter: (): never => {
    throw new Error("composition must not be called by stale-lease recovery");
  },
}));

const schema = `ai_video_recovery_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
const originalTestUrl = process.env.TEST_DATABASE_URL;
if (!originalTestUrl) {
  throw new Error("TEST_DATABASE_URL is required for AI-video recovery integration tests");
}
if (process.env.DATABASE_URL !== originalTestUrl) {
  throw new Error("Run this suite with vitest.integration.config.ts and its test-database safety guard");
}

const isolatedUrl = new URL(originalTestUrl);
isolatedUrl.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = isolatedUrl.toString();

let schemaCreated = false;
let db: typeof import("@workspace/db").db;
let pool: typeof import("@workspace/db").pool;
let CreditService: typeof import("../lib/credit-service").CreditService;
let recovery: typeof import("../lib/ai-video-renderer");

async function createIsolatedSchema(): Promise<void> {
  await pool.query(`CREATE SCHEMA "${schema}"`);
  schemaCreated = true;
  await pool.query(`
    CREATE TABLE "${schema}".teachers (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE "${schema}".plans (
      id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL, price_minor INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD', billing_period_days INTEGER NOT NULL DEFAULT 30,
      max_students INTEGER, max_classes INTEGER, max_users INTEGER, monthly_credits INTEGER,
      rollover_cap INTEGER, lemon_variant_id TEXT, lemon_product_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE "${schema}".subscriptions (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL, plan_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP, current_period_end TIMESTAMP, cancelled_at TIMESTAMP,
      payment_status TEXT DEFAULT 'active', last_credited_period_end TIMESTAMP,
      payment_provider TEXT, external_subscription_id TEXT, external_customer_id TEXT,
      billing_interval TEXT NOT NULL DEFAULT 'month', lemon_variant_id TEXT,
      paid_through TIMESTAMP, release_through TIMESTAMP, provider_updated_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE "${schema}".credit_tool_prices (
      tool_key TEXT PRIMARY KEY, tool_name_ar TEXT NOT NULL, tool_name_en TEXT,
      category TEXT NOT NULL DEFAULT 'ai', credits_cost INTEGER NOT NULL DEFAULT 0,
      default_credits_cost INTEGER NOT NULL DEFAULT 0, is_credit_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      timeout_seconds INTEGER NOT NULL DEFAULT 60, estimated_api_cost_usd NUMERIC(10,6),
      updated_by INTEGER, updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE "${schema}".credit_accounts (
      teacher_id INTEGER PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0,
      paid_balance INTEGER NOT NULL DEFAULT 0, promo_balance INTEGER NOT NULL DEFAULT 0,
      earned_balance INTEGER NOT NULL DEFAULT 0, subscription_balance INTEGER NOT NULL DEFAULT 0,
      free_balance INTEGER NOT NULL DEFAULT 0, total_earned INTEGER NOT NULL DEFAULT 0,
      total_spent INTEGER NOT NULL DEFAULT 0, updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE "${schema}".credit_batches (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL, source TEXT NOT NULL,
      amount INTEGER NOT NULL, amount_remaining INTEGER NOT NULL, expires_at TIMESTAMP,
      reference_id TEXT, plan_code TEXT, created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE "${schema}".credit_holds (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL, tool_key TEXT NOT NULL,
      credits_held INTEGER NOT NULL, request_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending', timeout_seconds INTEGER NOT NULL DEFAULT 60,
      held_promo INTEGER NOT NULL DEFAULT 0, held_earned INTEGER NOT NULL DEFAULT 0,
      held_paid INTEGER NOT NULL DEFAULT 0, result_json TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(), completed_at TIMESTAMP, refunded_at TIMESTAMP
    );
    CREATE TABLE "${schema}".credit_hold_items (
      id SERIAL PRIMARY KEY, hold_id INTEGER NOT NULL, batch_id INTEGER NOT NULL,
      amount INTEGER NOT NULL, UNIQUE (hold_id, batch_id)
    );
    CREATE TABLE "${schema}".credit_transactions (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL, amount INTEGER NOT NULL,
      type TEXT NOT NULL, reason TEXT, tool_key TEXT, request_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'completed', admin_id INTEGER,
      credit_type TEXT NOT NULL DEFAULT 'promo', source TEXT, expires_at TIMESTAMP,
      purchase_id INTEGER, created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE "${schema}".ai_video_projects (
      id SERIAL PRIMARY KEY, teacher_id INTEGER NOT NULL, title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft', brief JSONB NOT NULL, storyboard JSONB,
      output_url TEXT, error_message TEXT, storyboard_idempotency_key TEXT NOT NULL UNIQUE,
      storyboard_lease_id TEXT, storyboard_lease_expires_at TIMESTAMPTZ,
      render_idempotency_key TEXT, render_lease_id TEXT, render_lease_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO "${schema}".credit_tool_prices
      (tool_key, tool_name_ar, category, credits_cost, default_credits_cost, timeout_seconds)
    VALUES ('ai-video', 'storyboard', 'ai', 10, 10, 180),
           ('ai-video-render', 'render', 'ai', 10, 10, 180);
  `);
}

async function teacher(label: string): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash)
    VALUES (${label}, ${`${schema}-${label}@test.local`}, 'x') RETURNING id
  `);
  const id = Number((result.rows[0] as any).id);
  await db.execute(sql`
    INSERT INTO credit_accounts (teacher_id, balance, paid_balance, total_earned)
    VALUES (${id}, 100, 100, 100)
  `);
  await db.execute(sql`
    INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining)
    VALUES (${id}, 'purchased', 100, 100)
  `);
  return id;
}

type Stage = "render" | "storyboard";
async function project(
  teacherId: number,
  stage: Stage,
  kind: "expired" | "legacy" | "fresh" | "fresh-null",
): Promise<{ id: number; key: string; requestId: string }> {
  const key = `${schema}-${stage}-${kind}-${randomUUID()}`;
  const isRender = stage === "render";
  const storyboard = aiVideoStoryboardSchema.parse({
    title: `${stage}-${kind}`,
    version: 1,
    scenes: Array.from({ length: 5 }, (_, index) => ({
      id: `scene-${index + 1}`,
      objective: "Explain evaporation",
      narration: "Warm water evaporates into the air.",
      onScreenText: "Evaporation",
      visualPrompt: "Water evaporating in sunlight",
      durationSeconds: 6,
      transition: "cut",
    })),
  });
  const result = await db.execute(sql`
    INSERT INTO ai_video_projects (
      teacher_id, title, status, brief, storyboard, storyboard_idempotency_key,
      storyboard_lease_id, storyboard_lease_expires_at,
      render_idempotency_key, render_lease_id, render_lease_expires_at, updated_at
    ) VALUES (
      ${teacherId}, ${`${stage}-${kind}`}, ${isRender ? "rendering" : "draft"},
      ${JSON.stringify({ owner: teacherId, marker: key })}::jsonb,
      ${JSON.stringify(storyboard)}::jsonb,
      ${isRender ? `${key}-storyboard` : key},
      ${isRender ? null : kind === "expired" || kind === "fresh" ? `${kind}-story-worker` : null},
      ${isRender ? null : kind === "expired" ? new Date(Date.now() - 60_000) :
        kind === "fresh" ? new Date(Date.now() + 600_000) : null},
      ${isRender ? key : null},
      ${isRender && (kind === "expired" || kind === "fresh") ? `${kind}-render-worker` : null},
      ${isRender ? kind === "expired" ? new Date(Date.now() - 60_000) :
        kind === "fresh" ? new Date(Date.now() + 600_000) : null : null},
      ${kind === "legacy" || kind === "fresh" ? new Date(Date.now() - 600_000) : new Date()}
    ) RETURNING id
  `);
  const id = Number((result.rows[0] as any).id);
  const requestId = isRender
    ? recovery.aiVideoRenderCreditRequestId(teacherId, id, key)
    : recovery.aiVideoStoryboardCreditRequestId(teacherId, key);
  await CreditService.hold(teacherId, isRender ? "ai-video-render" : "ai-video", requestId);
  if (kind === "legacy") await CreditService.capture(requestId);
  return { id, key, requestId };
}

async function snapshot(id: number): Promise<any> {
  const result = await db.execute(sql`
    SELECT * FROM ai_video_projects WHERE id = ${id}
  `);
  return result.rows[0];
}

async function finances(teacherId: number): Promise<any> {
  const result = await db.execute(sql`
    SELECT a.balance, a.paid_balance,
           (SELECT amount_remaining FROM credit_batches WHERE teacher_id = ${teacherId}) AS amount_remaining,
           (SELECT COUNT(*)::int FROM credit_transactions WHERE teacher_id = ${teacherId} AND type = 'refund') AS refunds,
           (SELECT COUNT(*)::int FROM credit_transactions WHERE teacher_id = ${teacherId} AND type = 'compensation') AS compensations
      FROM credit_accounts a WHERE a.teacher_id = ${teacherId}
  `);
  return result.rows[0];
}

beforeAll(async () => {
  const dbModule = await import("@workspace/db");
  db = dbModule.db;
  pool = dbModule.pool;
  await createIsolatedSchema();
  CreditService = (await import("../lib/credit-service")).CreditService;
  recovery = await import("../lib/ai-video-renderer");

  const path = await db.execute(sql`SHOW search_path`);
  expect(String((path.rows[0] as any).search_path)).toBe(schema);
  const parallelPaths = await Promise.all(
    Array.from({ length: 4 }, () =>
      pool.query("SELECT current_schema() AS schema, pg_sleep(0.03)"),
    ),
  );
  expect(parallelPaths.map((result) => result.rows[0].schema)).toEqual(Array(4).fill(schema));

  for (const value of [null, "legacy-lease"]) {
    await expect(pool.query("SELECT $1 IS NULL", [value])).rejects.toMatchObject({ code: "42P18" });
    const typed = await pool.query("SELECT $1::text IS NULL AS is_null", [value]);
    expect(typed.rows[0].is_null).toBe(value === null);
  }
});

afterAll(async () => {
  try {
    if (schemaCreated) await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
  } finally {
    if (pool) await pool.end();
    process.env.DATABASE_URL = originalTestUrl;
  }
});

describe("AI-video recovery against isolated real PostgreSQL", () => {
  it("recovers render leases once under a concurrent global sweep", async () => {
    const owner = await teacher("render-owner");
    const expired = await project(owner, "render", "expired");
    const legacy = await project(owner, "render", "legacy");
    const fresh = await project(owner, "render", "fresh");
    const freshNull = await project(owner, "render", "fresh-null");
    const before = new Map(await Promise.all(
      [expired, legacy, fresh, freshNull].map(async (row) => [row.id, await snapshot(row.id)] as const),
    ));
    expect(await CreditService.getHoldStatus(expired.requestId)).toBe("pending");
    expect(await CreditService.getHoldStatus(legacy.requestId)).toBe("completed");
    expect(await CreditService.getHoldStatus(fresh.requestId)).toBe("pending");
    expect(await CreditService.getHoldStatus(freshNull.requestId)).toBe("pending");
    expect(await finances(owner)).toMatchObject({
      balance: 60, paid_balance: 60, amount_remaining: 60, refunds: 0, compensations: 0,
    });

    const counts = await Promise.all([recovery.failStaleAiVideoRenders(), recovery.failStaleAiVideoRenders()]);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(2);
    await expect(recovery.failStaleAiVideoRenders()).resolves.toBe(0);

    for (const row of [expired, legacy]) {
      const after = await snapshot(row.id);
      expect(after).toMatchObject({
        teacher_id: owner, title: before.get(row.id).title, brief: before.get(row.id).brief,
        storyboard: before.get(row.id).storyboard, status: "failed",
        render_lease_id: null, render_lease_expires_at: null,
      });
      // The retry route requires both failed status and a valid preserved storyboard.
      expect(aiVideoStoryboardSchema.safeParse(after.storyboard).success).toBe(true);
      expect(await CreditService.getHoldStatus(row.requestId)).toBe("refunded");
    }
    for (const row of [fresh, freshNull]) {
      expect(await snapshot(row.id)).toEqual(before.get(row.id));
      expect(await CreditService.getHoldStatus(row.requestId)).toBe("pending");
    }
    expect(await finances(owner)).toMatchObject({
      balance: 80, paid_balance: 80, amount_remaining: 80, refunds: 1, compensations: 1,
    });
  });

  it("targets one storyboard, then globally claims the legacy row without touching fresh rows", async () => {
    const owner = await teacher("storyboard-owner");
    const expired = await project(owner, "storyboard", "expired");
    const legacy = await project(owner, "storyboard", "legacy");
    const fresh = await project(owner, "storyboard", "fresh");
    const freshNull = await project(owner, "storyboard", "fresh-null");
    const before = new Map(await Promise.all(
      [expired, legacy, fresh, freshNull].map(async (row) => [row.id, await snapshot(row.id)] as const),
    ));
    expect(await CreditService.getHoldStatus(expired.requestId)).toBe("pending");
    expect(await CreditService.getHoldStatus(legacy.requestId)).toBe("completed");
    expect(await CreditService.getHoldStatus(fresh.requestId)).toBe("pending");
    expect(await CreditService.getHoldStatus(freshNull.requestId)).toBe("pending");
    expect(await finances(owner)).toMatchObject({
      balance: 60, paid_balance: 60, amount_remaining: 60, refunds: 0, compensations: 0,
    });

    await expect(recovery.failStaleAiVideoStoryboards(expired.id)).resolves.toBe(1);
    expect(await snapshot(legacy.id)).toEqual(before.get(legacy.id));
    const counts = await Promise.all([
      recovery.failStaleAiVideoStoryboards(),
      recovery.failStaleAiVideoStoryboards(),
    ]);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(1);
    await expect(recovery.failStaleAiVideoStoryboards()).resolves.toBe(0);

    for (const row of [expired, legacy]) {
      const after = await snapshot(row.id);
      expect(after).toMatchObject({
        teacher_id: owner, title: before.get(row.id).title, brief: before.get(row.id).brief,
        storyboard: before.get(row.id).storyboard, status: "failed",
        storyboard_lease_id: null, storyboard_lease_expires_at: null,
      });
      expect(await CreditService.getHoldStatus(row.requestId)).toBe("refunded");
    }
    for (const row of [fresh, freshNull]) {
      expect(await snapshot(row.id)).toEqual(before.get(row.id));
      expect(await CreditService.getHoldStatus(row.requestId)).toBe("pending");
    }
    expect(await finances(owner)).toMatchObject({
      balance: 80, paid_balance: 80, amount_remaining: 80, refunds: 1, compensations: 1,
    });
  });
});