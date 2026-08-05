import { Router, type IRouter } from "express";
import {
  db, parentMessagesTable, parentMessageRepliesTable,
  studentsTable, teachersTable, notificationsTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { randomUUID } from "crypto";

const attachmentSchema = z.array(z.object({
  name: z.string().max(255),
  objectPath: z.string().max(500),
  contentType: z.string().max(200),
  size: z.number().int().positive(),
})).max(5).optional();
import { sendEmail, getAppBaseUrl } from "../lib/email";
import {
  buildParentMessageEmail,
  buildTeacherReplyNotificationEmail,
  buildParentThreadReplyEmail,
} from "../lib/parent-message-email";
import { eq, and, desc, asc, sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Teacher: send a single message ─────────────────────────
router.post("/parent-messages", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const parsed = z.object({
      studentId: z.number().int().positive(),
      subject: z.string().max(200).default("رسالة من المعلم"),
      body: z.string().min(1).max(3000),
      parentEmail: z.string().email(),
      parentName: z.string().max(100).nullish(),
      attachments: attachmentSchema,
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }

    const { studentId, subject, body, parentEmail, parentName, attachments } = parsed.data;

    const [student] = await db.select()
      .from(studentsTable)
      .where(and(eq(studentsTable.id, studentId), eq(studentsTable.teacherId, teacherId)))
      .limit(1);
    if (!student) { res.status(404).json({ message: "الطالب غير موجود" }); return; }

    const [teacher] = await db.select({
      id: teachersTable.id, name: teachersTable.name,
      email: teachersTable.email, displaySchool: teachersTable.displaySchool,
      schoolLogo: teachersTable.schoolLogo,
    }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
    if (!teacher) { res.status(404).json({ message: "المعلم غير موجود" }); return; }

    const replyToken = randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [msg] = await db.insert(parentMessagesTable).values({
      teacherId, studentId, subject, body, parentEmail,
      parentName: parentName || null, replyToken, tokenExpiresAt,
      attachments: attachments ? JSON.stringify(attachments) : null,
    }).returning();

    const baseUrl = getAppBaseUrl();
    const portalUrl = `${baseUrl}/parent/${replyToken}`;
    const schoolLogoUrl = teacher.schoolLogo
      ? `${baseUrl}/api/storage${teacher.schoolLogo}` : undefined;

    const attachmentLinks = attachments?.map(a => ({
      name: a.name, contentType: a.contentType, size: a.size,
      url: `${baseUrl}/api/storage${a.objectPath}`,
    }));

    const emailHtml = buildParentMessageEmail({
      teacherName: teacher.name, studentName: student.name,
      studentClass: student.studentClass || "", gradeLevel: student.gradeLevel || "",
      subject, body, portalUrl, parentName: parentName || undefined,
      schoolName: teacher.displaySchool ?? undefined, schoolLogoUrl,
      attachments: attachmentLinks,
    });

    const emailResult = await sendEmail({
      to: parentEmail,
      subject: `منصة حصاد | رسالة بخصوص ${student.name}`,
      html: emailHtml,
      text: `رسالة من المعلم ${teacher.name} بخصوص ${student.name}:\n\n${body}\n\nللرد: ${portalUrl}`,
    });

    if (!emailResult.delivered) {
      await db.delete(parentMessagesTable).where(eq(parentMessagesTable.id, msg.id));
      const reason = emailResult.reason || "send_failed";
      res.status(502).json({
        message: `تعذّر إرسال البريد — ${reason === "resend_not_configured" ? "خدمة البريد غير مُهيأة" : reason}. لم تُحفظ الرسالة.`,
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

// ── Teacher: send bulk message to a class or all classes ────
router.post("/parent-messages/bulk", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const parsed = z.object({
      classFilter: z.string().max(120).nullable().default(null),
      subject: z.string().max(200).default("رسالة جماعية من المعلم"),
      body: z.string().min(1).max(3000),
      attachments: attachmentSchema,
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }

    const { classFilter, subject, body, attachments: bulkAttachments } = parsed.data;

    const [teacher] = await db.select({
      id: teachersTable.id, name: teachersTable.name,
      email: teachersTable.email, displaySchool: teachersTable.displaySchool,
      schoolLogo: teachersTable.schoolLogo,
    }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
    if (!teacher) { res.status(404).json({ message: "المعلم غير موجود" }); return; }

    // Fetch students with a parent email
    const allStudents = await db.select()
      .from(studentsTable)
      .where(eq(studentsTable.teacherId, teacherId));

    const targets = allStudents.filter(s =>
      s.parentEmail &&
      (!classFilter || s.studentClass === classFilter)
    );

    if (targets.length === 0) {
      res.status(400).json({ message: "لا يوجد طلاب بإيميل ولي أمر في هذا الصف" });
      return;
    }

    const baseUrl = getAppBaseUrl();
    const schoolLogoUrl = teacher.schoolLogo
      ? `${baseUrl}/api/storage${teacher.schoolLogo}` : undefined;

    let sent = 0, failed = 0;

    for (const student of targets) {
      try {
        const replyToken = randomUUID();
        const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const portalUrl = `${baseUrl}/parent/${replyToken}`;

        const [msg] = await db.insert(parentMessagesTable).values({
          teacherId, studentId: student.id, subject, body,
          parentEmail: student.parentEmail!, parentName: student.parentName || null,
          replyToken, tokenExpiresAt,
          attachments: bulkAttachments ? JSON.stringify(bulkAttachments) : null,
        }).returning();

        const bulkAttachmentLinks = bulkAttachments?.map(a => ({
          name: a.name, contentType: a.contentType, size: a.size,
          url: `${baseUrl}/api/storage${a.objectPath}`,
        }));

        const emailHtml = buildParentMessageEmail({
          teacherName: teacher.name, studentName: student.name,
          studentClass: student.studentClass || "", gradeLevel: student.gradeLevel || "",
          subject, body, portalUrl, parentName: student.parentName || undefined,
          schoolName: teacher.displaySchool ?? undefined, schoolLogoUrl,
          attachments: bulkAttachmentLinks,
        });

        const result = await sendEmail({
          to: student.parentEmail!,
          subject: `منصة حصاد | رسالة بخصوص ${student.name}`,
          html: emailHtml,
          text: `رسالة من المعلم ${teacher.name} بخصوص ${student.name}:\n\n${body}\n\nللرد: ${portalUrl}`,
        });

        if (result.delivered) {
          sent++;
        } else {
          await db.delete(parentMessagesTable).where(eq(parentMessagesTable.id, msg.id));
          failed++;
        }
      } catch {
        failed++;
      }
    }

    res.json({ sent, skipped: allStudents.length - targets.length, failed });
  } catch (err) {
    console.error("parent-messages bulk error:", err);
    res.status(500).json({ message: "حدث خطأ أثناء الإرسال الجماعي" });
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
        attachments: parentMessagesTable.attachments,
        hasUnreadReply: sql<boolean>`EXISTS (
          SELECT 1 FROM parent_message_replies pmr
          WHERE pmr.message_id = ${parentMessagesTable.id}
            AND pmr.sender = 'parent'
            AND pmr.created_at = (
              SELECT MAX(pmr2.created_at) FROM parent_message_replies pmr2
              WHERE pmr2.message_id = ${parentMessagesTable.id}
            )
        )`,
      })
      .from(parentMessagesTable)
      .innerJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .where(and(
        eq(parentMessagesTable.teacherId, teacherId),
        eq(parentMessagesTable.isArchived, archived),
      ))
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

    const [msg] = await db
      .select({
        id: parentMessagesTable.id,
        teacherId: parentMessagesTable.teacherId,
        body: parentMessagesTable.body,
        subject: parentMessagesTable.subject,
        parentEmail: parentMessagesTable.parentEmail,
        parentName: parentMessagesTable.parentName,
        replyText: parentMessagesTable.replyText,
        repliedAt: parentMessagesTable.repliedAt,
        tokenExpiresAt: parentMessagesTable.tokenExpiresAt,
        attachments: parentMessagesTable.attachments,
        studentName: studentsTable.name,
      })
      .from(parentMessagesTable)
      .innerJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .where(and(eq(parentMessagesTable.id, id), eq(parentMessagesTable.teacherId, teacherId)))
      .limit(1);
    if (!msg) { res.status(404).json({ message: "الرسالة غير موجودة" }); return; }

    const replies = await db.select().from(parentMessageRepliesTable)
      .where(eq(parentMessageRepliesTable.messageId, id))
      .orderBy(asc(parentMessageRepliesTable.createdAt));

    if (msg.replyText && replies.length === 0) {
      replies.push({
        id: -1, messageId: id, sender: "parent",
        body: msg.replyText, createdAt: msg.repliedAt || new Date(),
      } as any);
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
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const { body } = req.body;
    if (!body?.trim()) { res.status(400).json({ message: "الرد فارغ" }); return; }

    const [msg] = await db
      .select({
        id: parentMessagesTable.id,
        teacherId: parentMessagesTable.teacherId,
        parentEmail: parentMessagesTable.parentEmail,
        parentName: parentMessagesTable.parentName,
        replyToken: parentMessagesTable.replyToken,
        studentName: studentsTable.name,
      })
      .from(parentMessagesTable)
      .innerJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .where(and(eq(parentMessagesTable.id, id), eq(parentMessagesTable.teacherId, teacherId)))
      .limit(1);
    if (!msg) { res.status(404).json({ message: "الرسالة غير موجودة" }); return; }

    const [reply] = await db.insert(parentMessageRepliesTable)
      .values({ messageId: id, sender: "teacher", body: body.trim() })
      .returning();

    const [teacher] = await db.select({ name: teachersTable.name })
      .from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);

    if (msg.parentEmail && teacher) {
      const baseUrl = getAppBaseUrl();
      const emailHtml = buildParentThreadReplyEmail({
        teacherName: teacher.name,
        studentName: msg.studentName,
        parentName: msg.parentName || "ولي الأمر",
        replyText: body.trim(),
        portalUrl: `${baseUrl}/parent/${msg.replyToken}`,
      });
      await sendEmail({
        to: msg.parentEmail,
        subject: `منصة حصاد | رد المعلم بخصوص ${msg.studentName}`,
        html: emailHtml,
      });
    }

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
        id: parentMessagesTable.id,
        teacherId: parentMessagesTable.teacherId,
        subject: parentMessagesTable.subject,
        body: parentMessagesTable.body,
        parentName: parentMessagesTable.parentName,
        sentAt: parentMessagesTable.sentAt,
        readAt: parentMessagesTable.readAt,
        replyText: parentMessagesTable.replyText,
        repliedAt: parentMessagesTable.repliedAt,
        tokenExpiresAt: parentMessagesTable.tokenExpiresAt,
        studentName: studentsTable.name,
        studentClass: studentsTable.studentClass,
        gradeLevel: studentsTable.gradeLevel,
        teacherName: teachersTable.name,
      })
      .from(parentMessagesTable)
      .innerJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .innerJoin(teachersTable, eq(parentMessagesTable.teacherId, teachersTable.id))
      .where(eq(parentMessagesTable.replyToken, token))
      .limit(1);

    if (!msg) { res.status(404).json({ message: "الرابط غير صالح أو منتهي الصلاحية" }); return; }

    const expired = msg.tokenExpiresAt < new Date();

    if (!msg.readAt && !expired) {
      const readNow = new Date();
      await db.update(parentMessagesTable).set({ readAt: readNow })
        .where(eq(parentMessagesTable.replyToken, token));

      const dateStr = readNow.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
      const timeStr = readNow.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
      await db.insert(notificationsTable).values({
        teacherId: msg.teacherId,
        type: "parent_message_read",
        title: "📩 قرأ ولي الأمر رسالتك",
        body: `اطّلع ولي أمر ${msg.studentName} على رسالتك بتاريخ ${dateStr} الساعة ${timeStr}`,
      }).catch(() => {});
    }

    const replies = await db.select().from(parentMessageRepliesTable)
      .where(eq(parentMessageRepliesTable.messageId, msg.id))
      .orderBy(asc(parentMessageRepliesTable.createdAt));

    if (msg.replyText && replies.length === 0) {
      replies.push({
        id: -1, messageId: msg.id, sender: "parent",
        body: msg.replyText, createdAt: msg.repliedAt || new Date(),
      } as any);
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
        id: parentMessagesTable.id,
        teacherId: parentMessagesTable.teacherId,
        repliedAt: parentMessagesTable.repliedAt,
        tokenExpiresAt: parentMessagesTable.tokenExpiresAt,
        parentName: parentMessagesTable.parentName,
        subject: parentMessagesTable.subject,
        studentName: studentsTable.name,
      })
      .from(parentMessagesTable)
      .innerJoin(studentsTable, eq(parentMessagesTable.studentId, studentsTable.id))
      .where(eq(parentMessagesTable.replyToken, token))
      .limit(1);

    if (!msg) { res.status(404).json({ message: "الرابط غير صالح" }); return; }
    if (msg.tokenExpiresAt < new Date()) { res.status(410).json({ message: "انتهت صلاحية هذا الرابط" }); return; }

    await db.insert(parentMessageRepliesTable)
      .values({ messageId: msg.id, sender: "parent", body: replyText.trim() });

    if (!msg.repliedAt) {
      await db.update(parentMessagesTable)
        .set({ replyText: replyText.trim(), repliedAt: new Date() })
        .where(eq(parentMessagesTable.replyToken, token));
    }

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

    await db.insert(notificationsTable).values({
      teacherId: msg.teacherId,
      type: "parent_message_reply",
      title: "💬 ردّ ولي الأمر على رسالتك",
      body: `أرسل ولي أمر ${msg.studentName} رداً على رسالتك — افتح رسائل أولياء الأمور لعرض الرد`,
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    console.error("parent-portal reply error:", err);
    res.status(500).json({ message: "حدث خطأ" });
  }
});

export default router;
