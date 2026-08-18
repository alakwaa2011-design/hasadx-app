import { Router, type IRouter } from "express";
import { db, directMessagesTable, notificationsTable, teachersTable } from "@workspace/db";
import { eq, and, or, desc, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { sendEmail, getAppBaseUrl } from "../lib/email";

const router: IRouter = Router();

const sendSchema = z.object({
  content: z.string().min(1).max(2000),
  recipientId: z.number().int().optional(),
});

async function getAdminId(): Promise<number | null> {
  const admin = await db
    .select({ id: teachersTable.id })
    .from(teachersTable)
    .where(eq(teachersTable.isAdmin, true))
    .limit(1);
  return admin[0]?.id ?? null;
}

router.get("/direct-messages", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ message: "يجب تسجيل الدخول" }); return; }

  const me = await db.select().from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
  if (!me[0]) { res.status(401).json({ message: "غير موجود" }); return; }

  const isAdmin = me[0].isAdmin;

  if (isAdmin) {
    const rows = await db.execute(sql`
      SELECT
        t.id AS teacher_id,
        t.name AS teacher_name,
        t.email AS teacher_email,
        dm_latest.content AS last_message,
        dm_latest.created_at AS last_message_at,
        dm_latest.sender_id AS last_sender_id,
        COUNT(dm_unread.id)::int AS unread_count
      FROM ${teachersTable} t
      JOIN ${directMessagesTable} dm_latest ON (
        dm_latest.id = (
          SELECT id FROM ${directMessagesTable}
          WHERE (sender_id = t.id AND recipient_id = ${teacherId})
             OR (sender_id = ${teacherId} AND recipient_id = t.id)
          ORDER BY created_at DESC
          LIMIT 1
        )
      )
      LEFT JOIN ${directMessagesTable} dm_unread ON (
        dm_unread.sender_id = t.id
        AND dm_unread.recipient_id = ${teacherId}
        AND dm_unread.read_at IS NULL
      )
      WHERE t.id != ${teacherId}
        AND t.is_admin = false
      GROUP BY t.id, t.name, t.email, dm_latest.content, dm_latest.created_at, dm_latest.sender_id
      ORDER BY dm_latest.created_at DESC
    `);
    res.json(rows.rows);
    return;
  }

  const adminId = await getAdminId();
  if (!adminId) { res.json([]); return; }

  const messages = await db
    .select()
    .from(directMessagesTable)
    .where(
      or(
        and(eq(directMessagesTable.senderId, teacherId), eq(directMessagesTable.recipientId, adminId)),
        and(eq(directMessagesTable.senderId, adminId), eq(directMessagesTable.recipientId, teacherId)),
      )
    )
    .orderBy(desc(directMessagesTable.createdAt))
    .limit(100);

  const unreadCount = messages.filter(m => m.senderId === adminId && !m.readAt).length;

  res.json({
    messages: messages.reverse().map(m => ({
      id: m.id,
      senderId: m.senderId,
      content: m.content,
      readAt: m.readAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      mine: m.senderId === teacherId,
    })),
    unreadCount,
  });
});

router.get("/direct-messages/:teacherId", async (req, res) => {
  const myId = req.session.teacherId;
  if (!myId) { res.status(401).json({ message: "يجب تسجيل الدخول" }); return; }

  const me = await db.select().from(teachersTable).where(eq(teachersTable.id, myId)).limit(1);
  if (!me[0]?.isAdmin) { res.status(403).json({ message: "غير مصرح" }); return; }

  const otherId = parseInt(req.params.teacherId, 10);
  if (isNaN(otherId)) { res.status(400).json({ message: "معرف غير صالح" }); return; }

  const messages = await db
    .select()
    .from(directMessagesTable)
    .where(
      or(
        and(eq(directMessagesTable.senderId, myId), eq(directMessagesTable.recipientId, otherId)),
        and(eq(directMessagesTable.senderId, otherId), eq(directMessagesTable.recipientId, myId)),
      )
    )
    .orderBy(desc(directMessagesTable.createdAt))
    .limit(100);

  res.json(messages.reverse().map(m => ({
    id: m.id,
    senderId: m.senderId,
    content: m.content,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    mine: m.senderId === myId,
  })));
});

router.post("/direct-messages", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ message: "يجب تسجيل الدخول" }); return; }

  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }

  const me = await db.select().from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
  if (!me[0]) { res.status(401).json({ message: "غير موجود" }); return; }

  const isAdmin = me[0].isAdmin;
  let recipientId: number;

  if (isAdmin) {
    if (!parsed.data.recipientId) { res.status(400).json({ message: "يجب تحديد المستلم" }); return; }
    recipientId = parsed.data.recipientId;
  } else {
    const adminId = await getAdminId();
    if (!adminId) { res.status(404).json({ message: "لا يوجد مسؤول" }); return; }
    recipientId = adminId;
  }

  const [msg] = await db.insert(directMessagesTable).values({
    senderId: teacherId,
    recipientId,
    content: parsed.data.content,
  }).returning();

  const recipient = await db.select({ name: teachersTable.name, email: teachersTable.email }).from(teachersTable).where(eq(teachersTable.id, recipientId)).limit(1);

  await db.insert(notificationsTable).values({
    teacherId: recipientId,
    type: "direct_message",
    title: isAdmin ? "رسالة من منصة حصاد" : `رسالة من ${me[0].name}`,
    body: parsed.data.content.length > 80 ? parsed.data.content.slice(0, 80) + "…" : parsed.data.content,
  });

  // بريد تنبيهي للمعلم عندما يراسله المسؤول — باسم «منصة حصاد» دون ذكر المرسل.
  // fire-and-forget: فشل البريد لا يمنع حفظ الرسالة داخل المنصة.
  if (isAdmin && recipient[0]?.email) {
    const platformUrl = getAppBaseUrl();
    const preview = parsed.data.content.length > 400
      ? parsed.data.content.slice(0, 400) + "…"
      : parsed.data.content;
    sendEmail({
      to: recipient[0].email,
      subject: "منصة حصاد | لديك رسالة جديدة",
      html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8faf9;border-radius:12px">
        <h2 style="color:#1E4D35;margin:0 0 4px">منصة حصاد</h2>
        <p style="color:#334155;font-size:14px">مرحباً ${recipient[0].name}،</p>
        <p style="color:#334155;font-size:14px">وصلتك رسالة جديدة داخل المنصة:</p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;color:#0f172a;font-size:14px;white-space:pre-wrap">${preview.replace(/</g, "&lt;")}</div>
        <p style="margin-top:16px"><a href="${platformUrl}" style="background:#1E4D35;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;display:inline-block">افتح المنصة للرد</a></p>
        <p style="color:#94a3b8;font-size:11px;margin-top:18px">هذه رسالة تلقائية من منصة حصاد — يمكنك الرد من داخل المنصة عبر أيقونة الرسائل.</p>
      </div>`,
      text: `وصلتك رسالة جديدة في منصة حصاد:\n\n${preview}\n\nللرد ادخل المنصة: ${platformUrl}`,
    }).catch(() => { /* لا يؤثر على الرسالة */ });
  }

  res.json({
    id: msg.id,
    senderId: msg.senderId,
    content: msg.content,
    readAt: null,
    createdAt: msg.createdAt.toISOString(),
    mine: true,
  });
});

router.patch("/direct-messages/read/:senderId", async (req, res) => {
  const myId = req.session.teacherId;
  if (!myId) { res.status(401).json({ message: "يجب تسجيل الدخول" }); return; }

  const senderId = parseInt(req.params.senderId, 10);
  if (isNaN(senderId)) { res.status(400).json({ message: "معرف غير صالح" }); return; }

  await db
    .update(directMessagesTable)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(directMessagesTable.senderId, senderId),
        eq(directMessagesTable.recipientId, myId),
        isNull(directMessagesTable.readAt),
      )
    );

  res.json({ success: true });
});

export default router;
