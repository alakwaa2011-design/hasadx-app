import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, assistantOperationsTable as operations, assistantConfigurationTable as config, creditHoldsTable, worksheetsTable } from "@workspace/db";
import assistantRouter from "../routes/assistant";
import { prepareWorksheetRequest, runAssistantJob, recoverAssistantJobs, validateWorksheetRequest } from "../lib/assistant-worksheet";
import { createWorksheetDraft, generateWorksheetQuestions } from "../routes/worksheets";
import { CreditService } from "../lib/credit-service";
import { invalidateCreditsSettingsCache } from "../lib/check-credits";
import { migrateAssistantSchema } from "../lib/assistant-schema";
import { getAssistantExecutionAccess, recordAssistantPaidUpgrade, recordAssistantEvent, getAssistantExecutionMetrics } from "../lib/assistant-execution-access";

vi.mock("../lib/assistant-worksheet", async importOriginal => ({
  ...await importOriginal<any>(),
  prepareWorksheetRequest: vi.fn(async () => ({ supported: true, title: "دورة الماء", reply: "راجع الإعدادات", parameters: { topic: "دورة الماء", subject: "العلوم", gradeLevel: "الخامس", language: "ar", pages: 1, questionSelection: "manual", counts: { short_answer: 1 } } })),
}));
vi.mock("../routes/worksheets", async importOriginal => ({
  ...await importOriginal<any>(),
  generateWorksheetQuestions: vi.fn(async () => ({ language: "ar", questions: [{ id: "q1", type: "short_answer", prompt: "اشرح دورة الماء", lines: 3, answer: "تبخر وتكاثف وهطول" }] })),
  createWorksheetDraft: vi.fn(async (...args: any[]) => (await importOriginal<any>()).createWorksheetDraft(...args)),
}));

const RUN = `assistant-${randomUUID()}`;
const enabledIntegration = !!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const teachers: number[] = [];
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).session = req.headers["x-teacher"] ? { teacherId: Number(req.headers["x-teacher"]) } : {};
  (req as any).log = { warn() {}, error() {}, info() {} };
  next();
});
app.use("/api/assistant", assistantRouter);
let teacher = 0, other = 0, admin = 0;
let oldConfig: typeof config.$inferSelect | undefined;
let oldSettings: any, oldPrice: any;
const header = (id = teacher) => ({ "x-teacher": String(id) });
const settings = { title: "دورة الماء", template: "geometric", parameters: { topic: "دورة الماء", subject: "العلوم", gradeLevel: "الخامس", language: "ar", pages: 1, questionSelection: "manual", counts: { short_answer: 1 } } };

async function createTeacher(isAdmin = false) {
  const result = await db.execute(sql`INSERT INTO teachers(name,email,password_hash,is_admin) VALUES ('Fixture',${`${RUN}-${teachers.length}@example.test`},'x',${isAdmin}) RETURNING id`);
  const id = Number((result.rows[0] as any).id); teachers.push(id);
  await db.execute(sql`INSERT INTO credit_batches(teacher_id,source,amount,amount_remaining) VALUES(${id},'paid',50,50)`);
  await db.execute(sql`INSERT INTO credit_accounts(teacher_id,balance,paid_balance,total_earned) VALUES(${id},50,50,50)`);
  return id;
}
async function draft() {
  const r = await request(app).post("/api/assistant/prepare").set(header()).send({ message: "ورقة دورة الماء للخامس", language: "ar" }).expect(200);
  return r.body;
}
async function quoted() {
  const op = await draft();
  return (await request(app).post(`/api/assistant/operations/${op.id}/quote`).set(header()).send(settings).expect(200)).body;
}
function confirm(op: any) {
  return request(app).post(`/api/assistant/operations/${op.id}/confirm`).set(header()).send({ quoteId: op.quote.id });
}
async function getOperation(id: string) {
  return (await request(app).get(`/api/assistant/operations/${id}`).set(header()).expect(200)).body;
}

describe.skipIf(!enabledIntegration)("durable worksheet assistant", () => {
  beforeAll(async () => {
    await migrateAssistantSchema();
    [oldConfig] = await db.select().from(config);
    oldSettings = (await db.execute(sql`SELECT id,credits_enabled,admin_credit_test_mode FROM platform_settings LIMIT 1`)).rows[0];
    oldPrice = (await db.execute(sql`SELECT credits_cost,timeout_seconds FROM credit_tool_prices WHERE tool_key='worksheet'`)).rows[0];
    await db.execute(sql`INSERT INTO credit_tool_prices(tool_key,tool_name_ar,tool_name_en,credits_cost,timeout_seconds) VALUES('worksheet','ورقة عمل','Worksheet',2,120) ON CONFLICT(tool_key) DO UPDATE SET credits_cost=2,timeout_seconds=120`);
    if (oldSettings) await db.execute(sql`UPDATE platform_settings SET credits_enabled=TRUE,admin_credit_test_mode=FALSE WHERE id=${oldSettings.id}`);
    else await db.execute(sql`INSERT INTO platform_settings(credits_enabled,admin_credit_test_mode) VALUES(TRUE,FALSE)`);
    invalidateCreditsSettingsCache();
    await db.update(config).set({ enabled: true, pilotOnly: false, teacherIds: [] }).where(eq(config.id, 1));
  });
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.update(config).set({ enabled: true, pilotOnly: false, teacherIds: [] }).where(eq(config.id, 1));
    if (teachers.length) {
      const ids = sql.join(teachers.map(id => sql`${id}`), sql`,`);
      await db.execute(sql`DELETE FROM assistant_execution_trials WHERE teacher_id IN (${ids})`);
      await db.execute(sql`DELETE FROM assistant_execution_events WHERE teacher_id IN (${ids})`);
      await db.execute(sql`UPDATE assistant_worksheet_operations SET status='cancelled' WHERE teacher_id IN (${ids}) AND status IN ('queued','running','saving')`);
    }
    teacher = await createTeacher(); other = await createTeacher(); admin = await createTeacher(true);
  });
  afterAll(async () => {
    if (teachers.length) {
      const ids = sql.join(teachers.map(id => sql`${id}`), sql`,`);
      await db.execute(sql`DELETE FROM worksheets WHERE teacher_id IN (${ids})`);
      await db.execute(sql`DELETE FROM notifications WHERE teacher_id IN (${ids})`);
      await db.execute(sql`DELETE FROM teachers WHERE id IN (${ids})`);
    }
    if (oldConfig) await db.update(config).set(oldConfig).where(eq(config.id, 1));
    if (oldSettings) await db.execute(sql`UPDATE platform_settings SET credits_enabled=${oldSettings.credits_enabled},admin_credit_test_mode=${oldSettings.admin_credit_test_mode} WHERE id=${oldSettings.id}`);
    if (oldPrice) await db.execute(sql`UPDATE credit_tool_prices SET credits_cost=${oldPrice.credits_cost},timeout_seconds=${oldPrice.timeout_seconds} WHERE tool_key='worksheet'`);
    invalidateCreditsSettingsCache();
  });

  it("prepares freely, preserves zero counts, and isolates owned history", async () => {
    await request(app).get("/api/assistant/operations").expect(401);
    const op = await draft();
    expect(op.status).toBe("draft");
    expect(await db.select().from(creditHoldsTable).where(eq(creditHoldsTable.teacherId, teacher))).toHaveLength(0);
    await request(app).get(`/api/assistant/operations/${op.id}`).set(header(other)).expect(404);
    await request(app).post(`/api/assistant/operations/${op.id}/quote`).set(header(other)).send(settings).expect(404);
    const parsed = validateWorksheetRequest(settings);
    expect(parsed.parameters.counts.mcq).toBe(0);
    expect(parsed.parameters.counts.short_answer).toBe(1);
    expect(generateWorksheetQuestions).not.toHaveBeenCalled();
  });

  it("charges the one Free execution once, then blocks even a purchased-credit balance", async () => {
    const before = await CreditService.getBalance(teacher);
    const op = await quoted();
    await confirm(op).expect(200);
    await confirm(op).expect(200);
    await runAssistantJob();
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("upgrade_required");
    const after = await CreditService.getBalance(teacher);
    expect(before - after).toBe(2);
    await request(app).post("/api/assistant/prepare").set(header()).send({ message: "ورقة أخرى", language: "ar" }).expect(403);
    expect(await CreditService.getBalance(teacher)).toBe(after);
    expect(vi.mocked(generateWorksheetQuestions)).toHaveBeenCalledTimes(1);
    await request(app).delete(`/api/assistant/operations/${op.id}`).set(header()).expect(204);
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("upgrade_required");
  });

  it("reserves one trial across different operations and releases it on cancellation", async () => {
    const first = await quoted(), second = await quoted();
    const responses = await Promise.all([confirm(first), confirm(second)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 403]);
    const winner = responses[0].status === 200 ? first : second;
    const loser = winner.id === first.id ? second : first;
    await request(app).post(`/api/assistant/operations/${winner.id}/cancel`).set(header()).expect(200);
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("trial_available");
    await confirm(loser).expect(200);
  });

  it("keeps the trial reserved while saving, and consumes it only after a saved draft", async () => {
    const op = await quoted(); await confirm(op).expect(200);
    vi.mocked(createWorksheetDraft).mockRejectedValueOnce(new Error("Save delayed"));
    await runAssistantJob();
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("trial_reserved");
    const refreshed = await request(app).post(`/api/assistant/operations/${op.id}/quote`).set(header()).send(settings).expect(200);
    await confirm(refreshed.body).expect(200);
    await runAssistantJob();
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("upgrade_required");
    expect(vi.mocked(generateWorksheetQuestions)).toHaveBeenCalledTimes(1);
  });

  it("refunds failed generation and leaves the paid trial unused", async () => {
    const op = await quoted(); await confirm(op).expect(200);
    const before = await CreditService.getBalance(teacher);
    vi.mocked(generateWorksheetQuestions).mockRejectedValueOnce(new Error("Provider failure"));
    await runAssistantJob();
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("trial_available");
    expect(await CreditService.getBalance(teacher)).toBe(before + 2);
  });

  it("records only provider-confirmed paid upgrades, idempotently, within the attribution window", async () => {
    const op = await quoted();
    await recordAssistantEvent(teacher, "upgrade_checkout_started", op.id, { planCode: "basic" });
    expect((await db.execute(sql`SELECT id FROM assistant_execution_events WHERE teacher_id=${teacher} AND event_name='upgrade_paid'`)).rows).toHaveLength(0);
    await recordAssistantPaidUpgrade(db, teacher, `${RUN}-invoice`, "basic", new Date(Date.now() + 1000));
    await recordAssistantPaidUpgrade(db, teacher, `${RUN}-invoice`, "basic", new Date(Date.now() + 1000));
    const events = await db.execute(sql`SELECT * FROM assistant_execution_events WHERE teacher_id=${teacher} AND event_name='upgrade_paid'`);
    expect(events.rows).toHaveLength(1);
    await request(app).get("/api/assistant/admin/execution-metrics").set(header()).expect(403);
    await request(app).get("/api/assistant/admin/execution-metrics").set(header(admin)).expect(200);
    await request(app).post("/api/assistant/execution-events").set(header(other)).send({ operationId: op.id, event: "upgrade_paid" }).expect(400);
    await request(app).post("/api/assistant/execution-events").set(header(other)).send({ operationId: op.id, event: "upgrade_viewed" }).expect(404);
  });
  it("allows Basic and Pro at normal tool cost, keeps cancelled paid terms, and never resets a used trial", async () => {
    const first = await quoted(); await confirm(first).expect(200); await runAssistantJob();
    const balance = await CreditService.getBalance(teacher);
    for (const code of ["basic", "pro"]) {
      await db.execute(sql`
        INSERT INTO subscriptions(teacher_id,plan_id,status,payment_status,started_at,paid_through,current_period_end)
        SELECT ${teacher},id,${code === "basic" ? "canceled" : "active"},'active',NOW(),NOW()+INTERVAL '1 day',NOW()+INTERVAL '1 day'
        FROM plans WHERE code=${code}
        ON CONFLICT(teacher_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status=EXCLUDED.status,
          payment_status='active',paid_through=EXCLUDED.paid_through,current_period_end=EXCLUDED.current_period_end
      `);
      expect((await getAssistantExecutionAccess(teacher)).status).toBe("subscription");
      const op = await quoted(); await confirm(op).expect(200); await runAssistantJob();
    }
    expect(balance - await CreditService.getBalance(teacher)).toBe(4);
    await db.execute(sql`UPDATE subscriptions SET paid_through=NOW()-INTERVAL '1 day', current_period_end=NOW()-INTERVAL '1 day' WHERE teacher_id=${teacher}`);
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("upgrade_required");
    await db.execute(sql`UPDATE subscriptions SET plan_id=(SELECT id FROM plans WHERE code='free'),status='active',paid_through=NULL,current_period_end=NULL WHERE teacher_id=${teacher}`);
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("upgrade_required");
  });
  it("does not grant subscription execution to an unpaid provider subscription or unlimited points", async () => {
    const op = await quoted(); await confirm(op).expect(200); await runAssistantJob();
    await db.execute(sql`
      INSERT INTO subscriptions(teacher_id,plan_id,status,payment_status,started_at,current_period_end,external_subscription_id)
      SELECT ${teacher},id,'active','active',NOW(),NOW()+INTERVAL '1 day',${RUN + "-unpaid"} FROM plans WHERE code='basic'
      ON CONFLICT(teacher_id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status='active',payment_status='active',
        current_period_end=EXCLUDED.current_period_end,paid_through=NULL,external_subscription_id=EXCLUDED.external_subscription_id
    `);
    await db.execute(sql`UPDATE teachers SET unlimited_credits=TRUE WHERE id=${teacher}`);
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("upgrade_required");
    const response = await request(app).post("/api/assistant/prepare").set(header()).send({ message: "ورقة أخرى", language: "ar" }).expect(403);
    expect(response.body.code).toBe("EXECUTION_SUBSCRIPTION_REQUIRED");
  });
  it("requires a current quote and rejects changed prices before any hold", async () => {
    const op = await quoted();
    await db.execute(sql`UPDATE credit_tool_prices SET credits_cost=3 WHERE tool_key='worksheet'`);
    const r = await confirm(op);
    expect(r.status).toBe(409); expect(r.body.code).toBe("PRICE_CHANGED");
    expect(await db.select().from(creditHoldsTable).where(eq(creditHoldsTable.teacherId, teacher))).toHaveLength(0);
    await db.execute(sql`UPDATE credit_tool_prices SET credits_cost=2 WHERE tool_key='worksheet'`);
    await db.update(operations).set({ quote: { ...op.quote, expiresAt: new Date(0).toISOString() } }).where(eq(operations.id, op.id));
    expect((await confirm(op)).body.code).toBe("QUOTE_EXPIRED");
  });
  it("confirms across two tabs once, generates once and saves one private draft", async () => {
    const op = await quoted();
    const results = await Promise.all([confirm(op), confirm(op)]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    expect(await db.select().from(creditHoldsTable).where(eq(creditHoldsTable.teacherId, teacher))).toHaveLength(1);
    await runAssistantJob();
    const done = await getOperation(op.id);
    expect(done.status).toBe("completed"); expect(done.worksheetId).toBeGreaterThan(0);
    expect(generateWorksheetQuestions).toHaveBeenCalledTimes(1);
    const papers = await db.select().from(worksheetsTable).where(eq(worksheetsTable.clientRequestId, op.id));
    expect(papers).toHaveLength(1);
    expect(papers[0].linkedAssignmentId).toBeNull(); expect(papers[0].isShared).toBe(false);
    expect(papers[0].settings).toMatchObject({ template: "geometric", targetPages: 1, design: { themeSelection: "manual" } });
    await confirm(op).expect(200); await runAssistantJob();
    expect(generateWorksheetQuestions).toHaveBeenCalledTimes(1);
    await request(app).delete(`/api/assistant/operations/${op.id}`).set(header()).expect(204);
    expect(await db.select().from(worksheetsTable).where(eq(worksheetsTable.id, done.worksheetId))).toHaveLength(1);
  });
  it("cancels queued work before generation and refunds the reservation", async () => {
    const op = await quoted(); await confirm(op).expect(200);
    const [row] = await db.select().from(operations).where(eq(operations.id, op.id));
    await request(app).post(`/api/assistant/operations/${op.id}/cancel`).set(header()).expect(200);
    await runAssistantJob();
    expect(generateWorksheetQuestions).not.toHaveBeenCalled();
    const [hold] = await db.select().from(creditHoldsTable).where(eq(creditHoldsTable.requestId, row.creditRequestId));
    expect(hold.status).toBe("refunded");
  });
  it("retries saving stored output without another model call or credit hold", async () => {
    const op = await quoted(); await confirm(op).expect(200);
    vi.mocked(createWorksheetDraft).mockRejectedValueOnce(new Error("Temporary save failure"));
    await runAssistantJob();
    const retry = await getOperation(op.id);
    expect(retry.status).toBe("saving"); expect(retry.errorCode).toBe("SAVE_RETRY");
    await db.execute(sql`UPDATE credit_tool_prices SET credits_cost=3 WHERE tool_key='worksheet'`);
    const quote = await request(app).post(`/api/assistant/operations/${op.id}/quote`).set(header()).send({ title: retry.title, template: retry.template, parameters: retry.parameters }).expect(200);
    expect(quote.body.quote.credits).toBe(2);
    await confirm(quote.body).expect(200); await runAssistantJob();
    await db.execute(sql`UPDATE credit_tool_prices SET credits_cost=2 WHERE tool_key='worksheet'`);
    expect((await getOperation(op.id)).status).toBe("completed");
    expect(generateWorksheetQuestions).toHaveBeenCalledTimes(1);
    expect(await db.select().from(creditHoldsTable).where(eq(creditHoldsTable.requestId, (await db.select().from(operations).where(eq(operations.id, op.id)))[0].creditRequestId))).toHaveLength(1);
  });
  it("preserves the teacher's unsaved settings as the base of a free followup", async () => {
    const op = await draft();
    const manual = { ...settings, template: "arabic_ink", parameters: { ...settings.parameters, pages: 2, counts: { short_answer: 2 } } };
    const response = await request(app).post("/api/assistant/prepare").set(header()).send({ operationId: op.id, message: "اجعل الصعوبة متوسطة", language: "ar", settings: manual }).expect(200);
    expect(response.body.template).toBe("arabic_ink");
    expect(vi.mocked(prepareWorksheetRequest).mock.calls[1][3]).toMatchObject({ template: "arabic_ink", parameters: { pages: 2, counts: { short_answer: 2 } } });
  });
  it("recovers a crash after capture and avoids double charging or duplicate drafts", async () => {
    const op = await quoted(); await confirm(op).expect(200); await runAssistantJob();
    const done = await getOperation(op.id);
    await db.update(operations).set({ status: "saving", leaseUntil: null, errorCode: null }).where(eq(operations.id, op.id));
    await runAssistantJob();
    expect((await getOperation(op.id)).worksheetId).toBe(done.worksheetId);
    expect((await getOperation(op.id)).status).toBe("completed");
    expect(await db.select().from(worksheetsTable).where(eq(worksheetsTable.clientRequestId, op.id))).toHaveLength(1);
    expect(generateWorksheetQuestions).toHaveBeenCalledTimes(1);
  });
  it("does not blindly regenerate an interrupted unknown model result", async () => {
    const op = await quoted(); await confirm(op).expect(200);
    await db.update(operations).set({ status: "running", updatedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(operations.id, op.id));
    await recoverAssistantJobs(); await runAssistantJob();
    const done = await getOperation(op.id);
    expect(done.status).toBe("failed"); expect(done.errorCode).toBe("INTERRUPTED");
    expect(generateWorksheetQuestions).not.toHaveBeenCalled();
  });
  it("refunds generation failures and refuses to generate with a refunded orphan hold", async () => {
    const op = await quoted(); await confirm(op).expect(200);
    vi.mocked(generateWorksheetQuestions).mockRejectedValueOnce(new Error("Provider unavailable"));
    await runAssistantJob();
    expect((await getOperation(op.id)).status).toBe("failed");
    const [failed] = await db.select().from(operations).where(eq(operations.id, op.id));
    const [refunded] = await db.select().from(creditHoldsTable).where(eq(creditHoldsTable.requestId, failed.creditRequestId));
    expect(refunded.status).toBe("refunded");
    vi.clearAllMocks();
    const orphan = await quoted(); await confirm(orphan).expect(200);
    const [row] = await db.select().from(operations).where(eq(operations.id, orphan.id));
    await CreditService.refund(row.creditRequestId);
    await runAssistantJob();
    expect((await getOperation(orphan.id)).errorCode).toBe("INTERRUPTED");
    expect(generateWorksheetQuestions).not.toHaveBeenCalled();
  });
  it("explicitly resumes a saved result after its old hold was refunded, without regenerating", async () => {
    const op = await quoted(); await confirm(op).expect(200);
    vi.mocked(createWorksheetDraft).mockRejectedValueOnce(new Error("Save unavailable"));
    await runAssistantJob();
    const [row] = await db.select().from(operations).where(eq(operations.id, op.id));
    await CreditService.refund(row.creditRequestId);
    const retry = await getOperation(op.id);
    const refreshed = await request(app).post(`/api/assistant/operations/${op.id}/quote`).set(header()).send({ title: retry.title, template: retry.template, parameters: retry.parameters }).expect(200);
    await confirm(refreshed.body).expect(200); await runAssistantJob();
    expect((await getOperation(op.id)).status).toBe("completed");
    expect(generateWorksheetQuestions).toHaveBeenCalledTimes(1);
    const [saved] = await db.select().from(operations).where(eq(operations.id, op.id));
    expect(saved.creditRequestId).not.toBe(row.creditRequestId);
  });
  it("fails closed on insufficient credits without queuing or generating", async () => {
    const id = await createTeacher();
    await db.execute(sql`UPDATE credit_accounts SET balance=0,paid_balance=0 WHERE teacher_id=${id}`);
    await db.execute(sql`UPDATE credit_batches SET amount_remaining=0 WHERE teacher_id=${id}`);
    const op = (await request(app).post("/api/assistant/prepare").set(header(id)).send({ message: "ورقة", language: "ar" }).expect(200)).body;
    const quoted = (await request(app).post(`/api/assistant/operations/${op.id}/quote`).set(header(id)).send(settings).expect(200)).body;
    const result = await request(app).post(`/api/assistant/operations/${op.id}/confirm`).set(header(id)).send({ quoteId: quoted.quote.id }).expect(402);
    expect(result.body).toMatchObject({ code: "INSUFFICIENT_CREDITS", required: 2, balance: 0 });
    expect(generateWorksheetQuestions).not.toHaveBeenCalled();
  });
  it("keeps accepted jobs and history available when paused and limits the pilot", async () => {
    const op = await quoted(); await confirm(op).expect(200);
    await request(app).patch("/api/assistant/admin/settings").set(header()).send({ enabled: false }).expect(403);
    await request(app).patch("/api/assistant/admin/settings").set(header(admin)).send({ enabled: false }).expect(200);
    expect((await request(app).post("/api/assistant/prepare").set(header()).send({ message: "ورقة", language: "ar" })).body.code).toBe("DISABLED");
    await runAssistantJob(); expect((await getOperation(op.id)).status).toBe("completed");
    const audit = await request(app).get("/api/assistant/admin/operations").set(header(admin)).expect(200);
    expect(audit.body.operations[0].messages).toEqual([]); expect(audit.body.operations[0].requestText).toBe("");
    await request(app).patch("/api/assistant/admin/settings").set(header(admin)).send({ enabled: true, pilotOnly: true, teacherIds: [other] }).expect(200);
    expect((await request(app).get("/api/assistant/operations").set(header()).expect(200)).body.enabled).toBe(false);
    expect((await request(app).get("/api/assistant/operations").set(header(other)).expect(200)).body.enabled).toBe(true);
    expect((await request(app).get("/api/assistant/operations").set(header(admin)).expect(200)).body.enabled).toBe(true);
  });
});
