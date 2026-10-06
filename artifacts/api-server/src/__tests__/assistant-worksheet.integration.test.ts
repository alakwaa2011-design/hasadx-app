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
import { generateAssistantToolOutput, saveAssistantToolOutput } from "../lib/assistant-tools";

vi.mock("../lib/assistant-worksheet", async importOriginal => ({
  ...await importOriginal<any>(),
  prepareWorksheetRequest: vi.fn(async () => ({ supported: true, title: "دورة الماء", reply: "راجع الإعدادات", parameters: { topic: "دورة الماء", subject: "العلوم", gradeLevel: "الخامس", language: "ar", pages: 1, questionSelection: "manual", counts: { short_answer: 1 } } })),
}));
vi.mock("../routes/worksheets", async importOriginal => ({
  ...await importOriginal<any>(),
  generateWorksheetQuestions: vi.fn(async () => ({ language: "ar", questions: [{ id: "q1", type: "short_answer", prompt: "اشرح دورة الماء", lines: 3, answer: "تبخر وتكاثف وهطول" }] })),
  createWorksheetDraft: vi.fn(async (...args: any[]) => (await importOriginal<any>()).createWorksheetDraft(...args)),
}));
vi.mock("../lib/assistant-tools", async importOriginal => ({
  ...await importOriginal<any>(),
  generateAssistantToolOutput: vi.fn(async (_req: unknown, row: any) => row.tool === "lesson-plan"
    ? { language: "ar", sections: { objectives: ["فهم الدرس"], materials: [], vocabulary: [],
      warmUp: { description: "تمهيد" }, introduction: { description: "شرح" }, activities: [],
      assessment: { description: "تقويم" }, closure: { description: "ختام" } } }
    : { language: "ar", questions: Array.from({ length: row.parameters.questionCount ?? 5 }, (_, i) => ({
      text: `سؤال ${i + 1}`, questionType: "mcq", optionA: "أ", optionB: "ب", optionC: "ج", optionD: "د", correctAnswer: "A", points: 1,
    })) }),
  saveAssistantToolOutput: vi.fn(async (...args: any[]) => (await importOriginal<any>()).saveAssistantToolOutput(...args)),
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
let otherPrices: Array<any> = [];
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
  it("keeps the selected game for a followup but permits an explicit switch to a quiz", async () => {
    const game = await request(app).post("/api/assistant/prepare").set(header()).send({
      message: "لعبة عن الكسور للصف الرابع", language: "ar", tool: "game", gameType: "tug",
    }).expect(200);
    const updated = await request(app).post("/api/assistant/prepare").set(header()).send({
      operationId: game.body.id, message: "اجعلها أصعب", language: "ar", gameType: "tug",
    }).expect(200);
    expect(updated.body.id).toBe(game.body.id);
    expect(updated.body.tool).toBe("game");
    expect(updated.body.parameters.gameType).toBe("tug");
    const quiz = await request(app).post("/api/assistant/prepare").set(header()).send({
      operationId: game.body.id, message: "أريد اختبار عن الكسور", language: "ar", gameType: "tug",
    }).expect(200);
    expect(quiz.body.tool).toBe("quiz");
    expect(quiz.body.id).not.toBe(game.body.id);
  });
  it.each(["solo", "wameeth_class", "tug", "xo"])("persists the teacher-selected %s game instead of a model default", async gameType => {
    const result = await request(app).post("/api/assistant/prepare").set(header()).send({
      message: "لعبة عن الكسور للصف الرابع", language: "ar", tool: "game", gameType,
    }).expect(200);
    expect(result.body.tool).toBe("game");
    expect(result.body.parameters.gameType).toBe(gameType);
    expect(vi.mocked(prepareWorksheetRequest).mock.lastCall?.[5]).toBe(gameType);
    expect(result.body.status).toBe("draft");
    expect(result.body.credits).toBe(0);
  });
  it("routes an explicit game request to game even when the client defaults to worksheet", async () => {
    const game = await request(app).post("/api/assistant/prepare").set(header()).send({
      message: "اريد لعبة عن مكروهات الصيام للصف الرابع", language: "ar", tool: "worksheet",
    }).expect(200);
    expect(game.body.tool).toBe("game");
    expect(vi.mocked(prepareWorksheetRequest).mock.lastCall?.[4]).toBe("game");
    expect(game.body.status).toBe("draft");
  });
  it("switches a quoted worksheet to a separate game draft without its old settings or quote", async () => {
    const original = await quoted();
    const game = await request(app).post("/api/assistant/prepare").set(header()).send({
      operationId: original.id, settings, message: "اريد لعبة عن مكروهات الصيام للصف الرابع", language: "ar",
    }).expect(200);
    expect(game.body.tool).toBe("game");
    expect(game.body.id).not.toBe(original.id);
    expect(game.body.quote).toBeNull();
    expect(vi.mocked(prepareWorksheetRequest).mock.lastCall?.[3]).toBeUndefined();
    const unchanged = await getOperation(original.id);
    expect(unchanged.tool).toBe("worksheet");
    expect(unchanged.quote.id).toBe(original.quote.id);
  });
  it("keeps the latest shared teacher edits when converting to a game, but not worksheet settings", async () => {
    const original = await quoted();
    await request(app).post("/api/assistant/prepare").set(header()).send({
      operationId: original.id, message: "حولها إلى لعبة", language: "ar",
      settings: { ...settings, parameters: { ...settings.parameters, gradeLevel: "السادس" } },
    }).expect(200);
    const context = vi.mocked(prepareWorksheetRequest).mock.lastCall?.[3];
    expect(context?.parameters.gradeLevel).toBe("السادس");
    expect(context?.parameters.topic).toBe("دورة الماء");
    expect(context?.parameters.counts).toBeUndefined();
    expect(context?.parameters.pages).toBeUndefined();
  });
  beforeAll(async () => {
    await migrateAssistantSchema();
    await db.execute(sql`ALTER TABLE assistant_worksheet_operations ADD COLUMN IF NOT EXISTS tool TEXT NOT NULL DEFAULT 'worksheet', ADD COLUMN IF NOT EXISTS result_id INTEGER`);
    otherPrices = (await db.execute(sql`SELECT * FROM credit_tool_prices WHERE tool_key IN ('ai-questions','lesson-plan')`)).rows;
    for (const key of ["ai-questions", "lesson-plan"]) {
      await db.execute(sql`INSERT INTO credit_tool_prices(tool_key,tool_name_ar,tool_name_en,credits_cost,timeout_seconds) VALUES(${key},${key},${key},2,120) ON CONFLICT(tool_key) DO UPDATE SET credits_cost=2,timeout_seconds=120`);
    }
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
      await db.execute(sql`DELETE FROM lesson_plans WHERE teacher_id IN (${ids})`);
      await db.execute(sql`DELETE FROM notifications WHERE teacher_id IN (${ids})`);
      await db.execute(sql`DELETE FROM teachers WHERE id IN (${ids})`);
    }
    if (oldConfig) await db.update(config).set(oldConfig).where(eq(config.id, 1));
    if (oldSettings) await db.execute(sql`UPDATE platform_settings SET credits_enabled=${oldSettings.credits_enabled},admin_credit_test_mode=${oldSettings.admin_credit_test_mode} WHERE id=${oldSettings.id}`);
    if (oldPrice) await db.execute(sql`UPDATE credit_tool_prices SET credits_cost=${oldPrice.credits_cost},timeout_seconds=${oldPrice.timeout_seconds} WHERE tool_key='worksheet'`);
    for (const key of ["ai-questions", "lesson-plan"]) {
      const old = otherPrices.find(p => p.tool_key === key);
      if (old) await db.execute(sql`UPDATE credit_tool_prices SET credits_cost=${old.credits_cost},timeout_seconds=${old.timeout_seconds} WHERE tool_key=${key}`);
      else await db.execute(sql`DELETE FROM credit_tool_prices WHERE tool_key=${key}`);
    }
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

  async function toolQuote(tool: string, gameType = "solo") {
    const draft = (await request(app).post("/api/assistant/prepare").set(header()).send({
      message: "محتوى عن دورة الماء للصف الخامس", language: "ar", tool,
    }).expect(200)).body;
    return (await request(app).post(`/api/assistant/operations/${draft.id}/quote`).set(header()).send({
      title: draft.title, template: "geometric",
      parameters: { ...draft.parameters, questionCount: gameType === "xo" ? 9 : 5, gameType, durationMinutes: 45, pedagogy: "mixed" },
    }).expect(200)).body;
  }
  it.each(["game", "quiz", "lesson-plan"])("saves %s privately, bills once and consumes the shared successful trial", async tool => {
    const op = await toolQuote(tool);
    expect(op.tool).toBe(tool);
    expect(op.quote.credits).toBe(2);
    await confirm(op).expect(200);
    await confirm(op).expect(200);
    expect(await runAssistantJob()).toBe(true);
    const done = await getOperation(op.id);
    expect(done.status).toBe("completed");
    expect(done.resultId).toBeGreaterThan(0);
    expect(done.resultUrl).toContain(tool === "game" ? "savedGameId=" : tool === "quiz" ? "/teacher/assignment/" : "/lesson-plans/create?edit=");
    const table = tool === "game" ? "saved_game_activities" : tool === "quiz" ? "assignments" : "lesson_plans";
    const saved = (await db.execute(sql.raw(`SELECT * FROM ${table} WHERE id=${Number(done.resultId)}`))).rows[0] as any;
    expect(saved.teacher_id).toBe(teacher);
    expect(saved.is_shared).toBe(false);
    if (tool === "quiz") {
      expect(saved.access_mode).toBe("private");
      expect(saved.submission_mode).toBe("electronic");
      expect(Number((await db.execute(sql`SELECT COUNT(*) AS count FROM questions WHERE assignment_id=${done.resultId}`)).rows[0]?.count)).toBe(5);
    }
    if (tool === "game") {
      expect(saved.play_count).toBe(0);
      expect(saved.settings.timePerQuestion).toBe(20);
      expect(saved.settings.leaderboardDisplay).toBe("top3");
    }
    expect(await CreditService.getBalance(teacher)).toBe(48);
    expect(vi.mocked(generateAssistantToolOutput)).toHaveBeenCalledTimes(1);
    expect((await getAssistantExecutionAccess(teacher)).status).toBe("upgrade_required");
    await request(app).post("/api/assistant/prepare").set(header()).send({ message: "طلب آخر", language: "ar", tool: "worksheet" }).expect(403);
  });
  it("serializes game and quiz starts against the same one-trial entitlement", async () => {
    const game = await toolQuote("game"), quiz = await toolQuote("quiz");
    const results = await Promise.all([confirm(game), confirm(quiz)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 403]);
    expect(await db.select().from(creditHoldsTable).where(eq(creditHoldsTable.teacherId, teacher))).toHaveLength(1);
  });
  it("retries a lesson-plan save without regenerating or holding twice", async () => {
    const op = await toolQuote("lesson-plan");
    vi.mocked(saveAssistantToolOutput).mockRejectedValueOnce(new Error("Controlled save failure"));
    await confirm(op).expect(200); await runAssistantJob();
    let retry = await getOperation(op.id);
    expect(retry.errorCode).toBe("SAVE_RETRY");
    retry = (await request(app).post(`/api/assistant/operations/${op.id}/quote`).set(header()).send({
      title: retry.title, template: retry.template, parameters: retry.parameters,
    }).expect(200)).body;
    await confirm(retry).expect(200); await runAssistantJob();
    expect((await getOperation(op.id)).status).toBe("completed");
    expect(vi.mocked(generateAssistantToolOutput)).toHaveBeenCalledTimes(1);
    expect(await CreditService.getBalance(teacher)).toBe(48);
    expect(await db.select().from(creditHoldsTable).where(eq(creditHoldsTable.teacherId, teacher))).toHaveLength(1);
  });
  it("saves classroom Wameeth as a private two-team draft in the native editor format", async () => {
    const op = await toolQuote("game", "wameeth_class");
    await confirm(op).expect(200); await runAssistantJob();
    const done = await getOperation(op.id);
    expect(done.resultUrl).toContain("/game/wameeth/create?savedGameId=");
    const saved = (await db.execute(sql`SELECT game_type, content, settings, is_shared, play_count FROM saved_game_activities WHERE id=${done.resultId}`)).rows[0] as any;
    expect(saved.game_type).toBe("wameeth");
    expect(saved.settings).toMatchObject({ mode: "classroom", teamCount: 2 });
    expect(saved.content).toHaveLength(5);
    expect(saved.content[0]).toMatchObject({ type: "mcq", correctAnswer: "A" });
    expect(saved.is_shared).toBe(false);
    expect(saved.play_count).toBe(0);
  });
  it.each(["tug", "xo"])("persists compatible %s questions and its real editor link", async gameType => {
    const op = await toolQuote("game", gameType); await confirm(op).expect(200); await runAssistantJob();
    const done = await getOperation(op.id);
    expect(done.resultUrl).toContain(`/game/${gameType}/create?savedGameId=`);
    const saved = (await db.execute(sql`SELECT content FROM saved_game_activities WHERE id=${done.resultId}`)).rows[0] as any;
    expect(saved.content.questions[0].options).toHaveLength(4);
    expect(saved.content.questions[0].correct).toBe(0);
  });
  it.each(["wheel", "rocket", "hack", "self"])("persists a private %s draft with its working review link", async gameType => {
    const op = await toolQuote("game", gameType);
    await confirm(op).expect(200);
    await runAssistantJob();
    const done = await getOperation(op.id);
    expect(done.status).toBe("completed");
    expect(done.resultUrl).toContain(gameType === "self" ? "/teacher/solo-challenges/new?savedGameId="
      : gameType === "hack" ? "/game/hack?savedGameId=" : `/game/${gameType}/create?savedGameId=`);
    const saved = (await db.execute(sql`
      SELECT game_type, content, settings, is_shared FROM saved_game_activities WHERE id=${done.resultId}
    `)).rows[0] as any;
    expect(saved.game_type).toBe(gameType === "self" ? "solo" : gameType);
    expect(saved.is_shared).toBe(false);
    expect(gameType === "wheel" ? saved.content.segments : saved.content.questions).toHaveLength(5);
    if (gameType === "hack") {
      const backing = (await db.execute(sql`
        SELECT access_mode, is_shared FROM assignments WHERE id=${saved.content.assignmentId}
      `)).rows[0] as any;
      expect(backing).toMatchObject({ access_mode: "private", is_shared: false });
    }
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
