import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import {
  db,
  directMessagesTable,
  emailOutboxTable,
  feedbackTable,
  notificationsTable,
  teachersTable,
} from "@workspace/db";
import { SubmitFeedbackBody } from "@workspace/api-zod";
import { and, desc, eq } from "drizzle-orm";
import { getAppBaseUrl } from "../lib/email.js";
import { notifyEmailQueued } from "../lib/xp/email-worker";

const router: IRouter = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return false;
  }
  const [teacher] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, req.session.teacherId))
    .limit(1);
  if (!teacher?.isAdmin) {
    res.status(403).json({ message: "غير مصرح — صلاحيات المسؤول مطلوبة" });
    return false;
  }
  return true;
}

const typeLabels: Record<string, string> = {
  suggestion: "اقتراح",
  bug: "خلل",
  praise: "إشادة",
  other: "أخرى",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[c] ?? c);
}

async function firstAdminId(): Promise<number | null> {
  const [admin] = await db.select({ id: teachersTable.id })
    .from(teachersTable)
    .where(eq(teachersTable.isAdmin, true))
    .limit(1);
  return admin?.id ?? null;
}

router.post("/feedback", async (req, res) => {
  try {
    const body = SubmitFeedbackBody.parse(req.body);

    // A typed email is not proof of account ownership. Only an authenticated
    // teacher session may attach feedback to a teacher conversation.
    const teacherId = req.session?.teacherId ?? null;
    const adminId = await firstAdminId();
    const typeLabel = typeLabels[body.type] || body.type;

    await db.transaction(async (tx) => {
      const [feedback] = await tx.insert(feedbackTable).values({
        teacherId,
        type: body.type,
        name: body.name,
        email: body.email || null,
        message: body.message,
      }).returning();

      let platformMessageId: number | null = null;
      if (teacherId && adminId && teacherId !== adminId) {
        const [message] = await tx.insert(directMessagesTable).values({
          senderId: teacherId,
          recipientId: adminId,
          feedbackId: feedback.id,
          source: "feedback",
          content: `${typeLabel}: ${body.message}`,
        }).returning({ id: directMessagesTable.id });
        platformMessageId = message.id;
      }

      const admins = await tx.select({ id: teachersTable.id })
        .from(teachersTable)
        .where(eq(teachersTable.isAdmin, true));
      if (admins.length > 0) {
        await tx.insert(notificationsTable).values(
          admins.map(admin => ({
            teacherId: admin.id,
            type: "feedback",
            title: `ملاحظة جديدة (${typeLabel}) من ${body.name}`,
            body: body.message.length > 120 ? body.message.slice(0, 120) + "…" : body.message,
            messageId: platformMessageId,
            actionUrl: `/teacher/admin?tab=feedback&id=${feedback.id}`,
          })),
        );
      }
    });

    res.status(201).json({ message: "تم إرسال ملاحظتك بنجاح" });
  } catch (error: any) {
    req.log.error({ err: error }, "Feedback submission error");
    res.status(400).json({ message: error.message || "خطأ في إرسال الملاحظة" });
  }
});

router.get("/admin/feedback", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const items = await db
      .select()
      .from(feedbackTable)
      .orderBy(desc(feedbackTable.createdAt));
    res.json(items);
  } catch (err) {
    req.log.error(err, "List feedback error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.patch("/admin/feedback/:id/status", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!["new", "read", "resolved"].includes(status)) return res.status(400).json({ message: "حالة غير صالحة" });
    const [updated] = await db
      .update(feedbackTable)
      .set({ status })
      .where(eq(feedbackTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "غير موجود" });
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Update feedback status error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.post("/admin/feedback/:id/respond", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "معرّف غير صالح" });
    const message = String(req.body?.message ?? "").trim();
    const sendByEmail = req.body?.sendByEmail !== false;
    if (message.length < 2) return res.status(400).json({ message: "الرد قصير جداً" });
    if (message.length > 4000) return res.status(400).json({ message: "الرد طويل جداً" });

    const [item] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id)).limit(1);
    if (!item) return res.status(404).json({ message: "غير موجود" });

    const [admin] = await db
      .select({ id: teachersTable.id, name: teachersTable.name })
      .from(teachersTable)
      .where(eq(teachersTable.id, req.session.teacherId))
      .limit(1);

    const teacherId = item.teacherId;

    let emailStatus: string | null = sendByEmail
      ? (item.email ? "queued" : "no_email")
      : "skipped";
    let emailQueued = false;
    const updated = await db.transaction(async (tx) => {
      let replyMessageId: number | null = null;
      if (teacherId && teacherId !== req.session.teacherId) {
        const [replyMessage] = await tx.insert(directMessagesTable).values({
          senderId: req.session.teacherId,
          recipientId: teacherId,
          feedbackId: item.id,
          source: "feedback",
          content: message,
        }).returning({ id: directMessagesTable.id });
        replyMessageId = replyMessage.id;

        await tx.insert(notificationsTable).values({
          teacherId,
          type: "direct_message",
          title: "رد من منصة حصاد على اقتراحك",
          body: message.length > 120 ? message.slice(0, 120) + "…" : message,
          messageId: replyMessage.id,
          actionUrl: "/teacher/messages?tab=platform",
        });
      }

      const emailRefKey = sendByEmail && item.email
        ? `${item.id}:${createHash("sha256").update(message).digest("hex").slice(0, 24)}`
        : null;

      if (sendByEmail && item.email) {
        const safeMsg = escapeHtml(message);
        const safeOriginal = escapeHtml(item.message);
        const actionUrl = `${getAppBaseUrl()}/teacher/messages?tab=platform`;
        const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.7;color:#1f2937">
        <div style="background:#225739;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
          <h2 style="margin:0;font-size:18px">رد من فريق حصاد</h2>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:22px;border-radius:0 0 12px 12px">
          <p style="margin:0 0 8px">مرحباً ${item.name}،</p>
          <p style="margin:0 0 16px">شكراً لتواصلك معنا. هذا ردّنا على ملاحظتك:</p>
          <div style="background:#f8fafc;border-right:4px solid #D9A521;padding:14px 16px;border-radius:8px;white-space:pre-wrap">${safeMsg}</div>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:22px 0" />
          <p style="margin:0 0 6px;color:#6b7280;font-size:13px">ملاحظتك الأصلية:</p>
          <div style="color:#6b7280;font-size:13px;white-space:pre-wrap">${safeOriginal}</div>
          ${teacherId ? `<p style="margin:20px 0 0"><a href="${actionUrl}" style="background:#225739;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block">افتح المحادثة للرد</a></p>` : ""}
          <p style="margin:22px 0 0;color:#225739;font-weight:bold">— ${admin?.name || "فريق حصاد"}</p>
        </div>
      </div>`;
        const text = `مرحباً ${item.name}،\n\n${message}\n\n${teacherId ? `للمتابعة: ${actionUrl}\n\n` : ""}— ${admin?.name || "فريق حصاد"}`;
        const [insertedEmail] = await tx.insert(emailOutboxTable).values({
          toEmail: item.email,
          subject: "رد على ملاحظتك في منصة حصاد",
          htmlBody: html,
          textBody: text,
          kind: "feedback_reply",
          refKey: emailRefKey!,
          nextAttemptAt: new Date(),
        }).onConflictDoNothing({
          target: [emailOutboxTable.kind, emailOutboxTable.refKey],
        }).returning({ id: emailOutboxTable.id });
        emailQueued = Boolean(insertedEmail);
        if (!insertedEmail) {
          const [existingEmail] = await tx.select({ status: emailOutboxTable.status })
            .from(emailOutboxTable)
            .where(and(
              eq(emailOutboxTable.kind, "feedback_reply"),
              eq(emailOutboxTable.refKey, emailRefKey!),
            ))
            .limit(1);
          emailStatus = existingEmail?.status === "sent" || existingEmail?.status === "failed"
            ? existingEmail.status
            : "queued";
        }
      }

      const [saved] = await tx
        .update(feedbackTable)
        .set({
          teacherId,
          adminResponse: message,
          respondedAt: new Date(),
          respondedBy: req.session.teacherId,
          responseEmailStatus: emailStatus,
          responseEmailRefKey: emailRefKey,
          status: "resolved",
        })
        .where(eq(feedbackTable.id, id))
        .returning();
      return saved;
    });

    if (emailQueued) notifyEmailQueued();
    res.json(updated);
  } catch (err: any) {
    req.log.error({ err }, "Respond to feedback error");
    res.status(500).json({ message: err?.message || "خطأ" });
  }
});

router.delete("/admin/feedback/:id", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const id = parseInt(req.params.id);
    await db.delete(feedbackTable).where(eq(feedbackTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Delete feedback error");
    res.status(500).json({ message: "خطأ" });
  }
});

export default router;
