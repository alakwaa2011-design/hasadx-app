/**
 * اختبارات تكاملية لمسار الملاحظات والردود:
 *
 * 1. البريد المكتوب في نموذج عام لا يثبت ملكية حساب معلم.
 * 2. جلسة المعلم الموثقة تنشئ رسالة منصة وإشعاراً للمعلم الإداري.
 * 3. إعادة الرد نفسه idempotent، بينما الرد المعدل يحصل على تسليم بريد جديد.
 * 4. تسليم بريد قديم، سواء نجح أو فشل نهائياً، لا يغيّر حالة أحدث رد.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { flushEmailOutboxOnce } from "../lib/xp/email-worker";
import { sendEmail } from "../lib/email";

vi.mock("../lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ delivered: true }),
  getAppBaseUrl: () => "https://hasaadx.com",
}));

const RUN_INTEGRATION =
  !!process.env.TEST_DATABASE_URL &&
  process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;

const RUN_ID = `feedback${Date.now()}`;

type Session = { teacherId?: number };

const createdFeedbackIds: number[] = [];
let createdTeacherId = 0;
let createdAdminId: number | null = null;
let adminId = 0;
let teacherEmail = "";
let app: express.Express;
let session: Session = {};

const sendEmailMock = vi.mocked(sendEmail);

async function insertTeacher(name: string, email: string, isAdmin = false): Promise<number> {
  const result = await db.execute(sql`
    INSERT INTO teachers (name, email, password_hash, is_admin, created_at)
    VALUES (${name}, ${email}, 'test-password-hash', ${isAdmin}, NOW())
    RETURNING id
  `);
  return Number((result.rows[0] as any).id);
}

async function findFeedbackId(email: string, message: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT id
    FROM feedback
    WHERE email = ${email} AND message = ${message}
    ORDER BY id DESC
    LIMIT 1
  `);
  const id = Number((result.rows[0] as any)?.id);
  expect(id).toBeGreaterThan(0);
  createdFeedbackIds.push(id);
  return id;
}

async function submitFeedback(
  message: string,
  email: string,
  currentSession: Session = {},
): Promise<number> {
  session = currentSession;
  const response = await request(app)
    .post("/api/feedback")
    .send({
      type: "suggestion",
      name: `${RUN_ID} tester`,
      email,
      message,
    })
    .expect(201);
  expect(response.body.message).toBeTruthy();
  return findFeedbackId(email, message);
}

async function respondToFeedback(feedbackId: number, message: string) {
  session = { teacherId: adminId };
  return request(app)
    .post(`/api/admin/feedback/${feedbackId}/respond`)
    .send({ message, sendByEmail: true })
    .expect(200);
}

async function outboxRowsFor(feedbackId: number) {
  const result = await db.execute(sql`
    SELECT id, ref_key, status, attempts
    FROM email_outbox
    WHERE kind = 'feedback_reply'
      AND ref_key LIKE ${`${feedbackId}:%`}
    ORDER BY id
  `);
  return result.rows as Array<{
    id: number;
    ref_key: string;
    status: string;
    attempts: number;
  }>;
}

async function feedbackRow(feedbackId: number) {
  const result = await db.execute(sql`
    SELECT id, teacher_id, admin_response, response_email_status, response_email_ref_key
    FROM feedback
    WHERE id = ${feedbackId}
  `);
  return result.rows[0] as {
    id: number;
    teacher_id: number | null;
    admin_response: string | null;
    response_email_status: string | null;
    response_email_ref_key: string | null;
  };
}

async function cleanupFeedback(feedbackId: number): Promise<void> {
  await db.execute(sql`
    DELETE FROM notifications
    WHERE action_url = ${`/teacher/admin?tab=feedback&id=${feedbackId}`}
       OR message_id IN (
         SELECT id FROM direct_messages WHERE feedback_id = ${feedbackId}
       )
  `);
  await db.execute(sql`DELETE FROM direct_messages WHERE feedback_id = ${feedbackId}`);
  await db.execute(sql`
    DELETE FROM email_outbox
    WHERE kind = 'feedback_reply' AND ref_key LIKE ${`${feedbackId}:%`}
  `);
  await db.execute(sql`DELETE FROM feedback WHERE id = ${feedbackId}`);
}

async function ensureFeedbackSchema(): Promise<void> {
  // Integration databases can be provisioned from an older snapshot than the
  // running API. Mirror only the additive runtime migrations needed by these
  // tests; setup-integration.ts guarantees this is the dedicated test DB.
  await db.execute(sql`
    ALTER TABLE feedback
      ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS response_email_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS response_email_ref_key VARCHAR(100)
  `);
  await db.execute(sql`
    ALTER TABLE direct_messages
      ADD COLUMN IF NOT EXISTS feedback_id INTEGER REFERENCES feedback(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'general'
  `);
  await db.execute(sql`
    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS action_url TEXT
  `);
  await db.execute(sql`
    ALTER TABLE email_outbox
      ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP
  `);
  await db.execute(sql`
    UPDATE email_outbox
    SET next_attempt_at = created_at
    WHERE next_attempt_at IS NULL AND status = 'pending'
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_uniq_kind_ref
      ON email_outbox(kind, ref_key)
  `);
}

async function assertOldDeliveryDoesNotOverwriteLatest(delivered: boolean): Promise<void> {
  const oldFeedbackId = await submitFeedback(
    `${RUN_ID} old ${delivered ? "success" : "failure"}`,
    `${RUN_ID}-${delivered ? "success" : "failure"}@example.test`,
  );
  await respondToFeedback(oldFeedbackId, `${RUN_ID} old response`);

  const oldRows = await outboxRowsFor(oldFeedbackId);
  expect(oldRows).toHaveLength(1);
  const oldRefKey = oldRows[0]!.ref_key;

  await respondToFeedback(oldFeedbackId, `${RUN_ID} newest response`);
  const rowsAfterEdit = await outboxRowsFor(oldFeedbackId);
  expect(rowsAfterEdit).toHaveLength(2);
  const newestRefKey = rowsAfterEdit[1]!.ref_key;
  expect(newestRefKey).not.toBe(oldRefKey);

  // Keep the newest row out of this cycle so only the stale delivery is
  // processed. Its current feedback status must remain "queued".
  await db.execute(sql`
    UPDATE email_outbox
    SET next_attempt_at = NOW() + INTERVAL '1 hour'
    WHERE kind = 'feedback_reply' AND ref_key = ${newestRefKey}
  `);

  if (!delivered) {
    // A permanent failure is represented by the fifth attempt. The worker
    // should fence its feedback update by the current response ref key.
    await db.execute(sql`
      UPDATE email_outbox
      SET attempts = 4
      WHERE kind = 'feedback_reply' AND ref_key = ${oldRefKey}
    `);
    sendEmailMock.mockImplementation(async ({ to }: { to: string }) => ({
      delivered: to !== `${RUN_ID}-failure@example.test`,
      reason: to === `${RUN_ID}-failure@example.test` ? "permanent_test_failure" : undefined,
    }));
  } else {
    sendEmailMock.mockResolvedValue({ delivered: true });
  }

  await flushEmailOutboxOnce();

  const latestFeedback = await feedbackRow(oldFeedbackId);
  expect(latestFeedback.response_email_ref_key).toBe(newestRefKey);
  expect(latestFeedback.response_email_status).toBe("queued");
}

describe.skipIf(!RUN_INTEGRATION)("feedback messaging and email delivery", () => {
  beforeAll(async () => {
    await ensureFeedbackSchema();

    const existingAdmin = await db.execute(sql`
      SELECT id
      FROM teachers
      WHERE is_admin = true
      ORDER BY id
      LIMIT 1
    `);

    if (existingAdmin.rows.length > 0) {
      adminId = Number((existingAdmin.rows[0] as any).id);
    } else {
      createdAdminId = await insertTeacher(`${RUN_ID} admin`, `${RUN_ID}-admin@example.test`, true);
      adminId = createdAdminId;
    }

    teacherEmail = `${RUN_ID}-teacher@example.test`;
    createdTeacherId = await insertTeacher(`${RUN_ID} teacher`, teacherEmail);

    const { default: feedbackRouter } = await import("../routes/feedback");
    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.session = session;
      req.log = { error: console.error };
      next();
    });
    app.use("/api", feedbackRouter);
  });

  afterAll(async () => {
    for (const feedbackId of createdFeedbackIds) {
      await cleanupFeedback(feedbackId);
    }
    if (createdTeacherId) {
      await db.execute(sql`DELETE FROM teachers WHERE id = ${createdTeacherId}`);
    }
    if (createdAdminId) {
      await db.execute(sql`DELETE FROM notifications WHERE teacher_id = ${createdAdminId}`);
      await db.execute(sql`DELETE FROM teachers WHERE id = ${createdAdminId}`);
    }
  });

  it("keeps anonymous feedback unlinked even when its email matches a teacher", async () => {
    const feedbackId = await submitFeedback(
      `${RUN_ID} anonymous matching email`,
      teacherEmail,
    );

    const feedback = await feedbackRow(feedbackId);
    expect(feedback.teacher_id).toBeNull();

    const messages = await db.execute(sql`
      SELECT id FROM direct_messages WHERE feedback_id = ${feedbackId}
    `);
    expect(messages.rows).toHaveLength(0);
  });

  it("links an authenticated teacher's message and notification to the correct accounts", async () => {
    const feedbackId = await submitFeedback(
      `${RUN_ID} authenticated teacher`,
      teacherEmail,
      { teacherId: createdTeacherId },
    );

    const feedback = await feedbackRow(feedbackId);
    expect(Number(feedback.teacher_id)).toBe(createdTeacherId);

    const messages = await db.execute(sql`
      SELECT id, sender_id, recipient_id, feedback_id, source
      FROM direct_messages
      WHERE feedback_id = ${feedbackId}
    `);
    expect(messages.rows).toHaveLength(1);
    const message = messages.rows[0] as any;
    expect(Number(message.sender_id)).toBe(createdTeacherId);
    expect(Number(message.feedback_id)).toBe(feedbackId);
    expect(message.source).toBe("feedback");

    const recipientId = Number(message.recipient_id);
    const recipient = await db.execute(sql`
      SELECT is_admin
      FROM teachers
      WHERE id = ${recipientId}
    `);
    expect(recipient.rows).toContainEqual({ is_admin: true });

    const notifications = await db.execute(sql`
      SELECT teacher_id, message_id, type
      FROM notifications
      WHERE action_url = ${`/teacher/admin?tab=feedback&id=${feedbackId}`}
        AND message_id = ${Number(message.id)}
    `);
    expect(notifications.rows).toContainEqual({
      teacher_id: recipientId,
      message_id: Number(message.id),
      type: "feedback",
    });
  });

  it("does not duplicate an identical reply email and creates a new delivery for edits", async () => {
    const email = `${RUN_ID}-idempotent@example.test`;
    const feedbackId = await submitFeedback(`${RUN_ID} idempotent feedback`, email);
    const original = `${RUN_ID} original response`;
    const edited = `${RUN_ID} edited response`;

    await respondToFeedback(feedbackId, original);
    await respondToFeedback(feedbackId, original);

    expect(await outboxRowsFor(feedbackId)).toHaveLength(1);

    await respondToFeedback(feedbackId, edited);
    const rows = await outboxRowsFor(feedbackId);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.ref_key).not.toBe(rows[1]!.ref_key);

    const feedback = await feedbackRow(feedbackId);
    expect(feedback.admin_response).toBe(edited);
    expect(feedback.response_email_ref_key).toBe(rows[1]!.ref_key);
    expect(feedback.response_email_status).toBe("queued");
  });

  it.each([
    { label: "نجاح", delivered: true },
    { label: "فشل نهائي", delivered: false },
  ])("does not let an old email $label overwrite the newest reply", async ({ delivered }) => {
    sendEmailMock.mockReset();
    await assertOldDeliveryDoesNotOverwriteLatest(delivered);
  });
});