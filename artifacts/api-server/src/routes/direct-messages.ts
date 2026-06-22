import { Router, type IRouter } from "express";
import { db, directMessagesTable, notificationsTable, teachersTable } from "@workspace/db";
import { eq, and, or, desc, isNull, sql } from "drizzle-orm";
import { z } from "zod/v4";

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

  const recipient = await db.select({ name: teachersTable.name }).from(teachersTable).where(eq(teachersTable.id, recipientId)).limit(1);

  await db.insert(notificationsTable).values({
    teacherId: recipientId,
    type: "direct_message",
    title: isAdmin ? "رسالة من المسؤول" : `رسالة من ${me[0].name}`,
    body: parsed.data.content.length > 80 ? parsed.data.content.slice(0, 80) + "…" : parsed.data.content,
  });

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
