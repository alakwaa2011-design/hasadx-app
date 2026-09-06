/**
 * اختبار تكاملي لنقاط إعادة توليد مربع تيك تاك توك.
 *
 * يستخدم قاعدة بيانات الاختبار الحقيقية للحجز والتحصيل والاسترداد وسجل استخدام
 * الذكاء، ويستبدل مزود الذكاء فقط حتى تكون حالات النجاح والفشل حتمية.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const providerState = vi.hoisted(() => ({
  mode: "success" as "success" | "invalid" | "failure",
  calls: 0,
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(async () => {
          providerState.calls++;
          if (providerState.mode === "failure") throw new Error("provider unavailable");
          return {
            choices: [{
              message: {
                content: providerState.mode === "invalid"
                  ? JSON.stringify({ cell: { text: "", category: "" } })
                  : JSON.stringify({ cell: { text: "مهمة بديلة", category: "بديل", imageSuggested: false } }),
              },
            }],
            usage: { prompt_tokens: 20, completion_tokens: 10 },
          };
        }),
      },
    },
  },
}));

vi.mock("../lib/anthropic-client", () => ({
  anthropic: { messages: { create: vi.fn() } },
  SONNET_MODEL: "claude-sonnet-4-6",
}));

vi.mock("../lib/ai-tier", () => ({
  resolveTier: async () => "standard" as const,
  modelForTier: () => "gpt-4o-mini",
  isClaudeTier: () => false,
}));

import worksheetsRouter from "../routes/worksheets";
import { invalidateCreditsSettingsCache } from "../lib/check-credits";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const d = RUN_INTEGRATION ? describe : describe.skip;
const TOOL = "worksheet-tic-tac-toe-cell";
const COST = 3;
const RUN_ID = `wcell${Date.now()}`;
const teacherIds: number[] = [];
let previousCreditsEnabled: boolean | null = null;
let platformSettingsId: number | null = null;
let createdPlatformSettings = false;

const cells = Array.from({ length: 9 }, (_, index) => ({
  text: `المهمة ${index + 1}`,
  category: `فئة ${index + 1}`,
  imageSuggested: false,
}));

function makeApp(teacherId: number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { teacherId };
    (req as any).log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/api", worksheetsRouter);
  return app;
}

function body() {
  return {
    language: "ar",
    topic: "دورة الماء",
    subject: "العلوم",
    gradeLevel: "الصف الخامس",
    difficulty: "medium",
    prompt: "اختر ثلاث مهام متصلة",
    cells,
    cellIndex: 0,
  };
}

async function createTeacher(suffix: string): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, created_at)
    VALUES ('Test', ${`${RUN_ID}_${suffix}@test.local`}, 'x', NOW())
    RETURNING id
  `);
  const teacherId = Number((result.rows[0] as any).id);
  teacherIds.push(teacherId);
  await db.execute(sql`
    INSERT INTO credit_batches (teacher_id, source, amount, amount_remaining, created_at)
    VALUES (${teacherId}, 'purchased', 20, 20, NOW())
  `);
  await db.execute(sql`
    INSERT INTO credit_accounts (teacher_id, balance, paid_balance, total_earned)
    VALUES (${teacherId}, 20, 20, 20)
  `);
  return teacherId;
}

async function accounting(teacherId: number) {
  const balance = await db.execute(sql`
    SELECT balance FROM credit_accounts WHERE teacher_id = ${teacherId}
  `);
  const holds = await db.execute(sql`
    SELECT request_id, tool_key, credits_held, status
    FROM credit_holds WHERE teacher_id = ${teacherId}
  `);
  const transactions = await db.execute(sql`
    SELECT tool_key, amount, status
    FROM credit_transactions WHERE teacher_id = ${teacherId}
  `);
  const ledger = await db.execute(sql`
    SELECT request_id, tool_key, call_key, status
    FROM ai_usage_ledger WHERE teacher_id = ${teacherId}
  `);
  return {
    balance: Number((balance.rows[0] as any).balance),
    holds: holds.rows as any[],
    transactions: transactions.rows as any[],
    ledger: ledger.rows as any[],
  };
}

d("إعادة مربع تيك تاك توك — النقاط وسجل استخدام الذكاء", () => {
  beforeAll(async () => {
    await db.execute(sql`
      INSERT INTO credit_tool_prices
        (tool_key, tool_name_ar, category, credits_cost, default_credits_cost, timeout_seconds)
      VALUES (${TOOL}, 'إعادة توليد مربع تيك تاك توك', 'ai', ${COST}, ${COST}, 60)
      ON CONFLICT (tool_key) DO UPDATE SET credits_cost = ${COST}
    `);
    const settings = await db.execute(sql`
      SELECT id, credits_enabled FROM platform_settings LIMIT 1
    `);
    if (settings.rows[0]) {
      platformSettingsId = Number((settings.rows[0] as any).id);
      previousCreditsEnabled = !!(settings.rows[0] as any).credits_enabled;
      await db.execute(sql`
        UPDATE platform_settings SET credits_enabled = TRUE WHERE id = ${platformSettingsId}
      `);
    } else {
      const inserted = await db.execute(sql`
        INSERT INTO platform_settings (credits_enabled) VALUES (TRUE) RETURNING id
      `);
      platformSettingsId = Number((inserted.rows[0] as any).id);
      createdPlatformSettings = true;
    }
    invalidateCreditsSettingsCache();
  });

  beforeEach(() => {
    providerState.mode = "success";
    providerState.calls = 0;
  });

  afterAll(async () => {
    for (const teacherId of teacherIds) {
      await db.execute(sql`DELETE FROM ai_usage_ledger WHERE teacher_id = ${teacherId}`);
      await db.execute(sql`DELETE FROM credit_hold_items WHERE hold_id IN (SELECT id FROM credit_holds WHERE teacher_id = ${teacherId})`);
      await db.execute(sql`DELETE FROM credit_holds WHERE teacher_id = ${teacherId}`);
      await db.execute(sql`DELETE FROM credit_transactions WHERE teacher_id = ${teacherId}`);
      await db.execute(sql`DELETE FROM credit_batches WHERE teacher_id = ${teacherId}`);
      await db.execute(sql`DELETE FROM credit_accounts WHERE teacher_id = ${teacherId}`);
      await db.execute(sql`DELETE FROM teachers WHERE id = ${teacherId}`);
    }
    if (createdPlatformSettings && platformSettingsId) {
      await db.execute(sql`DELETE FROM platform_settings WHERE id = ${platformSettingsId}`);
    } else if (platformSettingsId) {
      await db.execute(sql`
        UPDATE platform_settings SET credits_enabled = ${previousCreditsEnabled} WHERE id = ${platformSettingsId}
      `);
    }
    invalidateCreditsSettingsCache();
  });

  it("يحجز التكلفة المخصصة ويحصّلها مرة واحدة عند النجاح بالمفتاح الجديد", async () => {
    const teacherId = await createTeacher("success");
    const response = await request(makeApp(teacherId))
      .post("/api/worksheets/ai/regenerate-tic-tac-toe-cell")
      .set("x-idempotency-key", randomUUID())
      .send(body());

    expect(response.status).toBe(200);
    expect(response.body.cell.text).toBe("مهمة بديلة");
    expect(providerState.calls).toBe(1);

    const state = await accounting(teacherId);
    expect(state.balance).toBe(20 - COST);
    expect(state.holds).toHaveLength(1);
    expect(state.holds[0]).toMatchObject({ tool_key: TOOL, credits_held: COST, status: "completed" });
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0]).toMatchObject({ tool_key: TOOL, amount: -COST, status: "completed" });
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({
      request_id: state.holds[0].request_id,
      tool_key: TOOL,
      call_key: "regenerate-tic-tac-toe-cell",
      status: "succeeded",
    });
  });

  it("يسترد الحجز عند رد غير صالح مع إبقاء مفتاح العملية في السجلات", async () => {
    providerState.mode = "invalid";
    const teacherId = await createTeacher("invalid");
    const response = await request(makeApp(teacherId))
      .post("/api/worksheets/ai/regenerate-tic-tac-toe-cell")
      .set("x-idempotency-key", randomUUID())
      .send(body());

    expect(response.status).toBe(500);
    const state = await accounting(teacherId);
    expect(state.balance).toBe(20);
    expect(state.holds).toHaveLength(1);
    expect(state.holds[0]).toMatchObject({ tool_key: TOOL, credits_held: COST, status: "refunded" });
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions.every(transaction => transaction.tool_key === TOOL)).toBe(true);
    expect(state.transactions.filter(transaction => Number(transaction.amount) === -COST)).toHaveLength(1);
    expect(state.transactions.filter(transaction => Number(transaction.amount) === COST)).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({ tool_key: TOOL, status: "succeeded" });
  });

  it("يسترد الحجز ويسجل فشل الاستخدام عندما يفشل المزود", async () => {
    providerState.mode = "failure";
    const teacherId = await createTeacher("provider");
    const response = await request(makeApp(teacherId))
      .post("/api/worksheets/ai/regenerate-tic-tac-toe-cell")
      .set("x-idempotency-key", randomUUID())
      .send(body());

    expect(response.status).toBe(500);
    const state = await accounting(teacherId);
    expect(state.balance).toBe(20);
    expect(state.holds).toHaveLength(1);
    expect(state.holds[0]).toMatchObject({ tool_key: TOOL, credits_held: COST, status: "refunded" });
    expect(state.transactions).toHaveLength(2);
    expect(state.transactions.every(transaction => transaction.tool_key === TOOL)).toBe(true);
    expect(state.transactions.filter(transaction => Number(transaction.amount) === -COST)).toHaveLength(1);
    expect(state.transactions.filter(transaction => Number(transaction.amount) === COST)).toHaveLength(1);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({
      request_id: state.holds[0].request_id,
      tool_key: TOOL,
      call_key: "regenerate-tic-tac-toe-cell",
      status: "failed",
    });
  });
});