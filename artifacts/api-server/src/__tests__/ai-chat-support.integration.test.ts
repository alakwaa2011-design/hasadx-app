import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import aiChatRouter from "../routes/ai-chat";

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

const RUN_ID = `ai-support-${Date.now()}`;
type Session = { teacherId?: number };

let app: express.Express;
let session: Session = {};
let teacherId = 0;
let otherTeacherId = 0;
let adminId = 0;
let conversationId = 0;

async function createTeacher(name: string, isAdmin = false): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
    VALUES (${name}, ${`${RUN_ID}-${name}@example.test`}, 'test-password-hash', ${isAdmin}, NOW())
    RETURNING id
  `);
  return Number((result.rows[0] as any).id);
}

describe.skipIf(!RUN_INTEGRATION)("Hasaad Guide human support handoff", () => {
  beforeAll(async () => {
    await db.execute(sql`
      ALTER TABLE conversations
        ADD COLUMN IF NOT EXISTS support_status TEXT NOT NULL DEFAULT 'ai',
        ADD COLUMN IF NOT EXISTS support_requested_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS support_admin_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL
    `);
    await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT`);

    teacherId = await createTeacher("teacher");
    otherTeacherId = await createTeacher("other");
    adminId = await createTeacher("admin", true);
    const created = await db.execute(sql`
      INSERT INTO conversations (teacher_id, title)
      VALUES (${teacherId}, 'مشكلة في ورقة العمل')
      RETURNING id
    `);
    conversationId = Number((created.rows[0] as any).id);
    await db.execute(sql`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (${conversationId}, 'user', 'لم أتمكن من إكمال العمل')
    `);

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).session = session;
      next();
    });
    app.use("/api/ai-chat", aiChatRouter);
  });

  afterAll(async () => {
    if (teacherId && adminId && otherTeacherId) {
      await db.execute(sql`
        DELETE FROM notifications
        WHERE teacher_id IN (${teacherId}, ${adminId}, ${otherTeacherId})
      `);
      await db.execute(sql`DELETE FROM conversations WHERE id = ${conversationId}`);
      await db.execute(sql`
        DELETE FROM teachers WHERE id IN (${teacherId}, ${adminId}, ${otherTeacherId})
      `);
    }
  });

  it("does not let another teacher transfer a conversation they do not own", async () => {
    session = { teacherId: otherTeacherId };
    await request(app)
      .post(`/api/ai-chat/conversations/${conversationId}/request-support`)
      .expect(404);
  });

  it("transfers the same conversation and alerts administrators", async () => {
    session = { teacherId };
    const response = await request(app)
      .post(`/api/ai-chat/conversations/${conversationId}/request-support`)
      .expect(200);
    expect(response.body.supportStatus).toBe("requested");

    const state = await db.execute(sql`
      SELECT support_status, support_requested_at
      FROM conversations WHERE id = ${conversationId}
    `);
    expect((state.rows[0] as any).support_status).toBe("requested");
    expect((state.rows[0] as any).support_requested_at).toBeTruthy();

    const systemMessage = await db.execute(sql`
      SELECT role FROM messages
      WHERE conversation_id = ${conversationId} AND role = 'support_system'
    `);
    expect(systemMessage.rows).toHaveLength(1);

    const adminNotification = await db.execute(sql`
      SELECT type, action_url FROM notifications
      WHERE teacher_id = ${adminId} AND type = 'ai_support_request'
    `);
    expect(adminNotification.rows).toHaveLength(1);
    expect((adminNotification.rows[0] as any).action_url).toContain(`conversation=${conversationId}`);

    await request(app)
      .post(`/api/ai-chat/conversations/${conversationId}/request-support`)
      .expect(200);
    const duplicates = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM messages
          WHERE conversation_id = ${conversationId} AND role = 'support_system') AS system_count,
        (SELECT count(*)::int FROM notifications
          WHERE teacher_id = ${adminId} AND type = 'ai_support_request') AS notification_count
    `);
    expect(duplicates.rows[0]).toMatchObject({
      system_count: 1,
      notification_count: 1,
    });
  });

  it("keeps later teacher messages in support without generating an AI reply", async () => {
    session = { teacherId };
    await request(app)
      .post(`/api/ai-chat/conversations/${conversationId}/support-messages`)
      .send({ message: "هذه تفاصيل إضافية للمشكلة" })
      .expect(201);

    const rows = await db.execute(sql`
      SELECT role, content FROM messages
      WHERE conversation_id = ${conversationId}
      ORDER BY id DESC LIMIT 1
    `);
    expect(rows.rows[0]).toMatchObject({
      role: "user",
      content: "هذه تفاصيل إضافية للمشكلة",
    });
  });

  it("allows only an administrator to reply in the transferred conversation", async () => {
    session = { teacherId: otherTeacherId };
    await request(app)
      .post(`/api/ai-chat/admin/conversations/${conversationId}/reply`)
      .send({ message: "رد غير مصرح" })
      .expect(403);

    session = { teacherId: adminId };
    await request(app)
      .post(`/api/ai-chat/admin/conversations/${conversationId}/reply`)
      .send({ message: "وصلتني المحادثة وسأساعدك هنا" })
      .expect(201);

    const state = await db.execute(sql`
      SELECT support_status, support_admin_id
      FROM conversations WHERE id = ${conversationId}
    `);
    expect(state.rows[0]).toMatchObject({
      support_status: "human",
      support_admin_id: adminId,
    });

    const teacherNotification = await db.execute(sql`
      SELECT type, action_url FROM notifications
      WHERE teacher_id = ${teacherId} AND type = 'ai_support_reply'
    `);
    expect(teacherNotification.rows).toHaveLength(1);
    expect((teacherNotification.rows[0] as any).action_url).toContain(`guideConversation=${conversationId}`);
  });

  it("shows the human reply to the teacher in the original conversation", async () => {
    session = { teacherId };
    const response = await request(app)
      .get(`/api/ai-chat/conversations/${conversationId}`)
      .expect(200);
    expect(response.body.conversation.supportStatus).toBe("human");
    expect(response.body.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: "admin",
        content: "وصلتني المحادثة وسأساعدك هنا",
      }),
    ]));
  });

  it("lets the administrator return the conversation to the AI guide", async () => {
    session = { teacherId: adminId };
    const response = await request(app)
      .post(`/api/ai-chat/admin/conversations/${conversationId}/close-support`)
      .expect(200);
    expect(response.body.supportStatus).toBe("ai");
  });
});