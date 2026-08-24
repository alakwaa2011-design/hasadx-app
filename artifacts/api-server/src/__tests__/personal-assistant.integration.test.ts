import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import router from "../routes/personal-assistant";

const RUN_INTEGRATION =
  Boolean(process.env.TEST_DATABASE_URL) &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
const TEST_SECRET = "personal-assistant-integration-secret";
const TEST_PHONE = "966500000000";
const RUN_ID = `pa_${Date.now()}`;

function sign(body: string): string {
  return `sha256=${crypto.createHmac("sha256", TEST_SECRET).update(body).digest("hex")}`;
}

function webhookApp() {
  const app = express();
  app.use("/api/webhooks/whatsapp", express.raw({ type: "*/*" }));
  app.use("/api", router);
  return app;
}

function adminApp(teacherId?: number) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = teacherId ? { teacherId } : {};
    next();
  });
  app.use("/api", router);
  return app;
}

function messagePayload(externalMessageId: string) {
  return JSON.stringify({
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: externalMessageId,
            from: TEST_PHONE,
            type: "text",
            text: { body: "رسالة اختبار للمراجعة" },
            timestamp: "1760000000",
          }],
        },
      }],
    }],
  });
}

describe.skipIf(!RUN_INTEGRATION)("personal assistant isolation — integration", () => {
  let ownerId = 0;
  let otherAdminId = 0;

  beforeAll(async () => {
    process.env.PERSONAL_ASSISTANT_OWNER_PHONE = TEST_PHONE;
    process.env.PERSONAL_ASSISTANT_WHATSAPP_APP_SECRET = TEST_SECRET;
    process.env.PERSONAL_ASSISTANT_WHATSAPP_VERIFY_TOKEN = "integration-verify-token";

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS personal_assistant_threads (
        id SERIAL PRIMARY KEY,
        channel TEXT NOT NULL DEFAULT 'whatsapp',
        external_contact_phone TEXT NOT NULL UNIQUE,
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS personal_assistant_messages (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL REFERENCES personal_assistant_threads(id) ON DELETE CASCADE,
        external_message_id TEXT NOT NULL UNIQUE,
        direction TEXT NOT NULL DEFAULT 'inbound',
        message_text TEXT NOT NULL,
        received_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS personal_assistant_actions (
        id SERIAL PRIMARY KEY,
        thread_id INTEGER NOT NULL REFERENCES personal_assistant_threads(id) ON DELETE CASCADE,
        message_id INTEGER NOT NULL UNIQUE REFERENCES personal_assistant_messages(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL DEFAULT 'review',
        status TEXT NOT NULL DEFAULT 'pending_review'
          CHECK (status IN ('pending_review', 'confirmed', 'cancelled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ
      )
    `);

    const owner = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('Personal owner', ${`${RUN_ID}_owner@test.local`}, 'x', true, NOW())
      RETURNING id
    `);
    ownerId = Number((owner.rows[0] as any).id);
    const other = await db.execute(sql`
      INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
      VALUES ('Other admin', ${`${RUN_ID}_other@test.local`}, 'x', true, NOW())
      RETURNING id
    `);
    otherAdminId = Number((other.rows[0] as any).id);
    process.env.PERSONAL_ASSISTANT_OWNER_ACCOUNT_IDS = String(ownerId);
  });

  beforeEach(async () => {
    await db.execute(sql`
      DELETE FROM personal_assistant_threads
      WHERE external_contact_phone = ${TEST_PHONE}
    `);
  });

  afterAll(async () => {
    await db.execute(sql`
      DELETE FROM personal_assistant_threads
      WHERE external_contact_phone = ${TEST_PHONE}
    `);
    await db.execute(sql`DELETE FROM teachers WHERE id IN (${ownerId}, ${otherAdminId})`);
  });

  it("inserts one message and one review action under concurrent duplicate delivery", async () => {
    const body = messagePayload(`${RUN_ID}_duplicate`);
    const app = webhookApp();
    const [first, second] = await Promise.all([
      request(app).post("/api/webhooks/whatsapp").set("Content-Type", "application/json").set("X-Hub-Signature-256", sign(body)).send(body),
      request(app).post("/api/webhooks/whatsapp").set("Content-Type", "application/json").set("X-Hub-Signature-256", sign(body)).send(body),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);

    const messages = await db.execute(sql`
      SELECT id FROM personal_assistant_messages
      WHERE external_message_id = ${`${RUN_ID}_duplicate`}
    `);
    const actions = await db.execute(sql`
      SELECT a.id
      FROM personal_assistant_actions a
      JOIN personal_assistant_messages m ON m.id = a.message_id
      WHERE m.external_message_id = ${`${RUN_ID}_duplicate`}
    `);
    expect(messages.rows).toHaveLength(1);
    expect(actions.rows).toHaveLength(1);
  });

  it("keeps administration closed to visitors and non-owner admins", async () => {
    expect((await request(adminApp()).get("/api/admin/personal-assistant")).status).toBe(401);
    expect((await request(adminApp(otherAdminId)).get("/api/admin/personal-assistant")).status).toBe(403);
    expect((await request(adminApp(ownerId)).get("/api/admin/personal-assistant")).status).toBe(200);
  });

  it("confirms only once, cannot revive a cancelled action, and deletes one confirmed thread", async () => {
    const externalId = `${RUN_ID}_transition`;
    const body = messagePayload(externalId);
    await request(webhookApp())
      .post("/api/webhooks/whatsapp")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", sign(body))
      .send(body)
      .expect(200);

    const action = await db.execute(sql`
      SELECT a.id, a.thread_id
      FROM personal_assistant_actions a
      JOIN personal_assistant_messages m ON m.id = a.message_id
      WHERE m.external_message_id = ${externalId}
    `);
    const actionId = Number((action.rows[0] as any).id);
    const threadId = Number((action.rows[0] as any).thread_id);
    const app = adminApp(ownerId);

    await request(app).patch(`/api/admin/personal-assistant/actions/${actionId}/cancel`).expect(200);
    await request(app).patch(`/api/admin/personal-assistant/actions/${actionId}/confirm`).expect(409);
    await request(app).delete(`/api/admin/personal-assistant/threads/${threadId}`).send({ confirm: false }).expect(400);
    await request(app).delete(`/api/admin/personal-assistant/threads/${threadId}`).send({ confirm: true }).expect(200);

    const threads = await db.execute(sql`
      SELECT id FROM personal_assistant_threads WHERE id = ${threadId}
    `);
    expect(threads.rows).toHaveLength(0);
  });
});