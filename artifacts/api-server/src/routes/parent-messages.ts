import { Router, type IRouter } from "express";
import { db, parentMessagesTable, parentMessageRepliesTable, studentsTable, teachersTable } from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { randomUUID } from "crypto";
import { sendEmail, getAppBaseUrl } from "../lib/email";
import { buildParentMessageEmail, buildTeacherReplyNotificationEmail, buildParentThreadReplyEmail } from "../lib/parent-message-email";

const router: IRouter = Router();

// ── Teacher: send a message ─────────────────────────────────
const SendMessageBody = z.object({
  studentId: z.number().int().positive(),
  subject: z.string().max(200).default("رسالة من المعلم"),
  body: z.string().min(1).max(3000),
  parentEmail: z.string().email(),
  parentName: z.string().max(100).nullish(),
});

router.post("/parent-messages", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const parsed = SendMessageBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة", errors: parsed.error.issues }); return; }

    const { studentId, subject, body, parentEmail, parentName } = parsed.data;

    const [student] = await db.select().from(studentsTable)
      .where(and(eq(studentsTable.id, studentId), eq(studentsTable.teacherId, teacherId))).limit(1);
    if (!student) { res.status(404).json({ message: "الطالب غير موجود" }); return; }

    const [teacher] = await db.select({ id: teachersTable.id, name: teachersTable.name, email: teachersTable.email })
      .from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
    if (!teacher) { res.status(404).json({ message: "المعلم غير موجود" }); return; }

    const replyToken = randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const [msg] = await db.insert(parentMessagesTable).values({
      teacherId, studentId, subject, body, parentEmail,
      parentName: parentName || null, replyToken, tokenExpiresAt,
    }).returning();

    const baseUrl = getAppBaseUrl();
    const portalUrl = `${baseUrl}/parent/${replyToken}`;
    const emailHtml = buildParentMessageEmail({
      teacherName: teacher.name, studentName: student.name,
      studentClass: student.studentClass || "", gradeLevel: student.gradeLevel || "",
      subject, body, portalUrl, parentName: parentName || undefined,
    });

    const emailResult = await sendEmail({
      to: parentEmail,
      subject: `منصة حصاد | رسالة بخصوص ${student.name}`,
      html: emailHtml,
      text: `رسالة من المعلم ${teacher.name} بخصوص ${student.name}:\n\n${body}\n\nللرد: ${portalUrl}`,
    });

    if (!emailResult.delivered) {
      // Roll back — remove the record so the teacher isn't shown false success
      await db.delete(parentMessagesTable).where(eq(parentMessagesTable.id, msg.id));
      const reason = emailResult.reason || "send_failed";
      console.error("parent-messages email delivery failed:", reason);
      res.status(502).json({
        message: `تعذّر إرسال البريد الإلكتروني إلى ولي الأمر — ${reason === "resend_not_configured" ? "خدمة البريد غير مُهيأة على هذا الخادم" : reason}. لم تُحفظ الرسالة.`,
        reason,
      });
      return;
    }

    if (!student.parentEmail && parentEmail) {
      await db.update(studentsTable)
        .set({ parentEmail, parentName: parentName || student.parentName })
        .where(eq(studentsTable.id, studentId));
    }

    res.status(201).json(msg);
  } catch (err) {
    console.error("parent-messages POST error:", err);
    res.status(500).json({ message: "حدث خطأ أثناء إرسال الرسالة" });
  }
});

// ── Teacher: list messages (inbox or archived) ──────────────
router.get("/parent-messages", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const archived = req.query.archived === "true";

    const messages = await db
      .select({
        id: parentMessagesTable.id,
        studentId: parentMessagesTable.studentId,
        studentName: studentsTable.name,
        studentClass: studentsTable.studentClass,
        gradeLevel: studentsTable.gradeLevel,
        subject: parentMessagesTable.subject,
        body: parentMessagesTable.body,
        parentEmail: parentMessagesTable.parentEmail,
        parentName: parentMessagesTable.parentName,
        sentAt: parentMessagesTable.sentAt,
        readAt: parentMessagesTable.readAt,
        replyText: parentMessagesTable.replyText,
        repliedAt: parentMessagesTable.repliedAt,
        tokenExpiresAt: parentMessagesTable.tokenExpiresAt,
        isArchived: parentMessagesTable.isArchived,
      })
      .from(parentMessagesTable)
      .innerJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .where(and(eq(parentMessagesTable.teacherId, teacherId), eq(parentMessagesTable.isArchived, archived)))
      .orderBy(desc(parentMessagesTable.sentAt));

    res.json(messages);
  } catch (err) {
    console.error("parent-messages GET error:", err);
    res.status(500).json({ message: "حدث خطأ" });
  }
});

// ── Teacher: get full thread ────────────────────────────────
router.get("/parent-messages/:id/thread", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }

    const [msg] = await db.select().from(parentMessagesTable)
      .where(and(eq(parentMessagesTable.id, id), eq(parentMessagesTable.teacherId, teacherId))).limit(1);
    if (!msg) { res.status(404).json({ message: "الرسالة غير موجودة" }); return; }

    const replies = await db.select().from(parentMessageRepliesTable)
      .where(eq(parentMessageRepliesTable.messageId, id))
      .orderBy(asc(parentMessageRepliesTable.createdAt));

    // Migrate old single-reply into thread (backward compat)
    if (msg.replyText && replies.length === 0) {
      await db.insert(parentMessageRepliesTable).values({
        messageId: id, sender: "parent", body: msg.replyText,
        createdAt: msg.repliedAt || new Date(),
      });
      replies.push({ id: -1, messageId: id, sender: "parent", body: msg.replyText, createdAt: msg.repliedAt || new Date() } as any);
    }

    res.json({ message: msg, replies });
  } catch (err) {
    console.error("parent-messages thread GET error:", err);
    res.status(500).json({ message: "حدث خطأ" });
  }
});

// ── Teacher: add a reply ────────────────────────────────────
router.post("/parent-messages/:id/teacher-reply", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const id = parseInt(req.params.id, 10);
    const { body } = req.body;
    if (!body?.trim()) { res.status(400).json({ message: "الرد فارغ" }); return; }

    const [msg] = await db.select({
      id: parentMessagesTable.id, teacherId: parentMessagesTable.teacherId,
      parentEmail: parentMessagesTable.parentEmail, parentName: parentMessagesTable.parentName,
      subject: parentMessagesTable.subject, replyToken: parentMessagesTable.replyToken,
      tokenExpiresAt: parentMessagesTable.tokenExpiresAt,
      studentName: studentsTable.name,
    })
      .from(parentMessagesTable)
      .leftJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .where(and(eq(parentMessagesTable.id, id), eq(parentMessagesTable.teacherId, teacherId))).limit(1);
    if (!msg) { res.status(404).json({ message: "الرسالة غير موجودة" }); return; }

    const [teacher] = await db.select({ name: teachersTable.name })
      .from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);

    const [reply] = await db.insert(parentMessageRepliesTable)
      .values({ messageId: id, sender: "teacher", body: body.trim() }).returning();

    // Send notification email to parent
    const baseUrl = getAppBaseUrl();
    const portalUrl = `${baseUrl}/parent/${msg.replyToken}`;
    const emailHtml = buildParentThreadReplyEmail({
      teacherName: teacher?.name || "المعلم", parentName: msg.parentName || undefined,
      studentName: msg.studentName ?? undefined, replyText: body.trim(), portalUrl,
    });
    await sendEmail({
      to: msg.parentEmail,
      subject: `منصة حصاد | رد المعلم بخصوص ${msg.studentName ?? ""}`,
      html: emailHtml,
    });

    res.status(201).json(reply);
  } catch (err) {
    console.error("teacher-reply POST error:", err);
    res.status(500).json({ message: "حدث خطأ" });
  }
});

// ── Teacher: archive a message ──────────────────────────────
router.delete("/parent-messages/:id", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    await db.update(parentMessagesTable).set({ isArchived: true })
      .where(and(eq(parentMessagesTable.id, id), eq(parentMessagesTable.teacherId, teacherId)));
    res.json({ ok: true });
  } catch { res.status(500).json({ message: "حدث خطأ" }); }
});

// ── Teacher: restore from archive ──────────────────────────
router.patch("/parent-messages/:id/restore", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    await db.update(parentMessagesTable).set({ isArchived: false })
      .where(and(eq(parentMessagesTable.id, id), eq(parentMessagesTable.teacherId, teacherId)));
    res.json({ ok: true });
  } catch { res.status(500).json({ message: "حدث خطأ" }); }
});

// ── Parent portal: view message by token ───────────────────
router.get("/parent-portal/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [msg] = await db
      .select({
        id: parentMessagesTable.id, subject: parentMessagesTable.subject,
        body: parentMessagesTable.body, parentName: parentMessagesTable.parentName,
        sentAt: parentMessagesTable.sentAt, readAt: parentMessagesTable.readAt,
        replyText: parentMessagesTable.replyText, repliedAt: parentMessagesTable.repliedAt,
        tokenExpiresAt: parentMessagesTable.tokenExpiresAt,
        studentName: studentsTable.name, studentClass: studentsTable.studentClass,
        gradeLevel: studentsTable.gradeLevel, teacherName: teachersTable.name,
      })
      .from(parentMessagesTable)
      .innerJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .innerJoin(teachersTable, eq(parentMessagesTable.teacherId, teachersTable.id))
      .where(eq(parentMessagesTable.replyToken, token)).limit(1);

    if (!msg) { res.status(404).json({ message: "الرابط غير صالح أو منتهي الصلاحية" }); return; }

    const expired = msg.tokenExpiresAt < new Date();

    if (!msg.readAt && !expired) {
      await db.update(parentMessagesTable).set({ readAt: new Date() })
        .where(eq(parentMessagesTable.replyToken, token));
    }

    // Fetch thread replies
    const replies = await db.select().from(parentMessageRepliesTable)
      .where(eq(parentMessageRepliesTable.messageId, msg.id))
      .orderBy(asc(parentMessageRepliesTable.createdAt));

    // Migrate old single-reply
    if (msg.replyText && replies.length === 0) {
      replies.push({ id: -1, messageId: msg.id, sender: "parent", body: msg.replyText, createdAt: msg.repliedAt || new Date() } as any);
    }

    res.json({ ...msg, expired, replies });
  } catch (err) {
    console.error("parent-portal GET error:", err);
    res.status(500).json({ message: "حدث خطأ" });
  }
});

// ── Parent portal: submit reply ─────────────────────────────
router.post("/parent-portal/:token/reply", async (req, res) => {
  try {
    const { token } = req.params;
    const { replyText } = req.body;
    if (!replyText?.trim()) { res.status(400).json({ message: "الرد فارغ" }); return; }

    const [msg] = await db
      .select({
        id: parentMessagesTable.id, teacherId: parentMessagesTable.teacherId,
        repliedAt: parentMessagesTable.repliedAt, tokenExpiresAt: parentMessagesTable.tokenExpiresAt,
        studentName: studentsTable.name, parentName: parentMessagesTable.parentName,
        subject: parentMessagesTable.subject,
      })
      .from(parentMessagesTable)
      .innerJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .where(eq(parentMessagesTable.replyToken, token)).limit(1);

    if (!msg) { res.status(404).json({ message: "الرابط غير صالح" }); return; }
    if (msg.tokenExpiresAt < new Date()) { res.status(410).json({ message: "انتهت صلاحية هذا الرابط" }); return; }

    // Insert reply into thread table
    await db.insert(parentMessageRepliesTable)
      .values({ messageId: msg.id, sender: "parent", body: replyText.trim() });

    // Also update legacy fields for backward compat (only if not set yet)
    if (!msg.repliedAt) {
      await db.update(parentMessagesTable)
        .set({ replyText: replyText.trim(), repliedAt: new Date() })
        .where(eq(parentMessagesTable.replyToken, token));
    }

    // Notify teacher
    const [teacher] = await db.select({ email: teachersTable.email, name: teachersTable.name })
      .from(teachersTable).where(eq(teachersTable.id, msg.teacherId)).limit(1);

    if (teacher?.email) {
      const baseUrl = getAppBaseUrl();
      const emailHtml = buildTeacherReplyNotificationEmail({
        teacherName: teacher.name, studentName: msg.studentName,
        parentName: msg.parentName || "ولي الأمر", replyText: replyText.trim(),
        inboxUrl: `${baseUrl}/teacher/parent-messages`,
      });
      await sendEmail({
        to: teacher.email,
        subject: `ردّ ولي أمر ${msg.studentName} على رسالتك`,
        html: emailHtml,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("parent-portal reply error:", err);
    res.status(500).json({ message: "حدث خطأ" });
  }
});

export default router;
