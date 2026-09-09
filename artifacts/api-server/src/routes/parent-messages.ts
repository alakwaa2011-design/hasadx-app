import { Router, type IRouter } from "express";
import {
  db, parentMessagesTable, parentMessageRepliesTable,
  studentsTable, teachersTable, notificationsTable, classroomRewardTransactionsTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { ObjectStorageService } from "../lib/objectStorage";

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
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";

const router: IRouter = Router();

const summaryRequestSchema = z.object({
  studentId: z.number().int().positive(),
  period: z.enum(["week", "month"]),
  selectedAchievementIds: z.array(z.number().int().positive()).max(8).default([]),
  teacherMessage: z.string().max(1000).default(""),
});

const motivationSnapshotSchema = z.object({
  version: z.literal(1),
  kind: z.literal("motivation_summary"),
  period: z.enum(["week", "month"]),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalPoints: z.number().int(),
  categories: z.array(z.object({ name: z.string().max(120), points: z.number().int().positive() })).max(8),
  achievements: z.array(z.object({
    id: z.number().int().positive(), title: z.string().max(200),
    points: z.number().int().positive(), date: z.string().datetime(),
  })).max(8),
  teacherMessage: z.string().max(1000),
  createdAt: z.string().datetime(),
});

function previewSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for motivation summary previews");
  return secret;
}

function signPreview(teacherId: number, studentId: number, snapshot: z.infer<typeof motivationSnapshotSchema>, expiresAt: string) {
  const payload = JSON.stringify({ teacherId, studentId, snapshot, expiresAt });
  return createHmac("sha256", previewSecret()).update(payload).digest("base64url");
}

function validPreviewSignature(signature: string, expected: string) {
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function summaryRange(period: "week" | "month") {
  const to = new Date();
  const from = new Date(to);
  if (period === "week") from.setDate(from.getDate() - 7);
  else from.setMonth(from.getMonth() - 1);
  return { from, to };
}

async function buildMotivationSummary(teacherId: number, input: z.infer<typeof summaryRequestSchema>) {
  const [student] = await db.select({
    id: studentsTable.id, name: studentsTable.name, parentName: studentsTable.parentName,
    parentEmail: studentsTable.parentEmail, studentClass: studentsTable.studentClass,
  }).from(studentsTable).where(and(
    eq(studentsTable.id, input.studentId), eq(studentsTable.teacherId, teacherId),
  )).limit(1);
  if (!student) return null;

  const { from, to } = summaryRange(input.period);
  const txs = await db.select({
    id: classroomRewardTransactionsTable.id,
    amount: classroomRewardTransactionsTable.amount,
    rewardTypeName: classroomRewardTransactionsTable.rewardTypeNameSnapshot,
    category: classroomRewardTransactionsTable.categorySnapshot,
    reversalOfId: classroomRewardTransactionsTable.reversalOfId,
    createdAt: classroomRewardTransactionsTable.createdAt,
  }).from(classroomRewardTransactionsTable).where(and(
    eq(classroomRewardTransactionsTable.teacherId, teacherId),
    eq(classroomRewardTransactionsTable.studentId, input.studentId),
    gte(classroomRewardTransactionsTable.createdAt, from),
    lte(classroomRewardTransactionsTable.createdAt, to),
  )).orderBy(desc(classroomRewardTransactionsTable.createdAt));

  const total = txs.reduce((sum, tx) => sum + tx.amount, 0);
  const grouped = new Map<string, number>();
  for (const tx of txs) grouped.set(tx.category, (grouped.get(tx.category) || 0) + tx.amount);
  const categories = [...grouped.entries()]
    .filter(([, points]) => points > 0)
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);
  const reversedIds = new Set(txs.map(tx => tx.reversalOfId).filter((id): id is number => id != null));
  const selectable = txs.filter(tx => tx.amount > 0 && !reversedIds.has(tx.id)).slice(0, 20);
  const allowedIds = new Set(selectable.map(tx => tx.id));
  const achievements = selectable
    .filter(tx => input.selectedAchievementIds.includes(tx.id) && allowedIds.has(tx.id))
    .map(tx => ({
      id: tx.id, title: tx.rewardTypeName, points: tx.amount,
      date: tx.createdAt.toISOString(),
    }));

  return {
    student,
    snapshot: {
      version: 1 as const,
      kind: "motivation_summary" as const,
      period: input.period,
      periodStart: from.toISOString(),
      periodEnd: to.toISOString(),
      totalPoints: total,
      categories,
      achievements,
      teacherMessage: input.teacherMessage.trim(),
      createdAt: new Date().toISOString(),
    },
    selectableAchievements: selectable.map(tx => ({
      id: tx.id, title: tx.rewardTypeName, points: tx.amount, date: tx.createdAt.toISOString(),
    })),
  };
}

router.post("/parent-messages/motivation-summary/preview", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }
  const parsed = summaryRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }
  const result = await buildMotivationSummary(teacherId, parsed.data);
  if (!result) { res.status(404).json({ message: "الطالب غير موجود" }); return; }
  const previewExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  res.json({
    ...result,
    previewExpiresAt,
    previewToken: signPreview(teacherId, parsed.data.studentId, result.snapshot, previewExpiresAt),
  });
});

router.post("/parent-messages/motivation-summary", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }
    const parsed = z.object({
      studentId: z.number().int().positive(),
      snapshot: motivationSnapshotSchema,
      previewExpiresAt: z.string().datetime(),
      previewToken: z.string().min(20).max(200),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }
    const { studentId, snapshot, previewExpiresAt, previewToken } = parsed.data;
    if (new Date(previewExpiresAt) < new Date()) {
      res.status(410).json({ message: "انتهت صلاحية المعاينة. حدّث الملخص ثم أرسله." }); return;
    }
    const expected = signPreview(teacherId, studentId, snapshot, previewExpiresAt);
    if (!validPreviewSignature(previewToken, expected)) {
      res.status(403).json({ message: "تم تغيير الملخص بعد المعاينة. حدّث المعاينة قبل الإرسال." }); return;
    }
    const [student] = await db.select({
      id: studentsTable.id, name: studentsTable.name, parentName: studentsTable.parentName,
      parentEmail: studentsTable.parentEmail, studentClass: studentsTable.studentClass,
    }).from(studentsTable).where(and(
      eq(studentsTable.id, studentId), eq(studentsTable.teacherId, teacherId),
    )).limit(1);
    if (!student) { res.status(404).json({ message: "الطالب غير موجود" }); return; }
    const emailCheck = z.string().email().safeParse(student.parentEmail);
    if (!emailCheck.success) {
      res.status(400).json({ message: "لا يوجد بريد ولي أمر صالح لهذا الطالب" }); return;
    }
    const [teacher] = await db.select({
      name: teachersTable.name, displaySchool: teachersTable.displaySchool, schoolLogo: teachersTable.schoolLogo,
    }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
    if (!teacher) { res.status(404).json({ message: "المعلم غير موجود" }); return; }

    const replyToken = randomUUID();
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const periodLabel = snapshot.period === "week" ? "الأسبوعي" : "الشهري";
    const subject = `ملخص التحفيز ${periodLabel} — ${student.name}`;
    const body = snapshot.teacherMessage || `يسعدني مشاركتكم ملخص التحفيز الإيجابي للطالب/ة ${student.name}.`;
    const [msg] = await db.insert(parentMessagesTable).values({
      teacherId, studentId: student.id, subject, body,
      parentEmail: emailCheck.data, parentName: student.parentName,
      replyToken, tokenExpiresAt, motivationSummary: snapshot,
    }).returning();

    const baseUrl = getAppBaseUrl();
    const portalUrl = `${baseUrl}/parent/${replyToken}`;
    const emailHtml = buildParentMessageEmail({
      teacherName: teacher.name, studentName: student.name,
      studentClass: student.studentClass || "", gradeLevel: "",
      subject, body, portalUrl, parentName: student.parentName || undefined,
      schoolName: teacher.displaySchool ?? undefined,
      schoolLogoUrl: teacher.schoolLogo ? `${baseUrl}/api/storage${teacher.schoolLogo}` : undefined,
      motivationSummary: snapshot,
    });
    const delivery = await sendEmail({
      to: emailCheck.data,
      subject: `منصة حصاد | ${subject}`,
      html: emailHtml,
      text: [
        body,
        `مجموع التحفيز: ${snapshot.totalPoints}`,
        snapshot.categories.length ? `الفئات الإيجابية: ${snapshot.categories.map(c => `${c.name} (${c.points})`).join("، ")}` : "",
        snapshot.achievements.length ? `الإنجازات المختارة:\n${snapshot.achievements.map(a => `- ${a.title} (+${a.points})`).join("\n")}` : "",
        `لعرض الملخص والرد: ${portalUrl}`,
      ].filter(Boolean).join("\n\n"),
    });
    if (!delivery.delivered) {
      await db.delete(parentMessagesTable).where(eq(parentMessagesTable.id, msg.id));
      res.status(502).json({ message: "تعذّر إرسال البريد. لم تُحفظ الرسالة." }); return;
    }
    res.status(201).json(msg);
  } catch (err) {
    console.error("motivation summary send error:", err);
    res.status(500).json({ message: "حدث خطأ أثناء إرسال الملخص" });
  }
});

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
        motivationSummary: parentMessagesTable.motivationSummary,
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
        motivationSummary: parentMessagesTable.motivationSummary,
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

    const parsed = z.object({
      body: z.string().min(1).max(3000),
      attachments: attachmentSchema,
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }
    const { body, attachments } = parsed.data;

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
      .values({
        messageId: id, sender: "teacher", body: body.trim(),
        attachments: attachments ? JSON.stringify(attachments) : null,
      })
      .returning();

    const [teacher] = await db.select({ name: teachersTable.name })
      .from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);

    if (msg.parentEmail && teacher) {
      const baseUrl = getAppBaseUrl();
      const attachmentLinks = attachments?.map(a => ({
        name: a.name, contentType: a.contentType, size: a.size,
        url: `${baseUrl}/api/storage${a.objectPath}`,
      }));
      const emailHtml = buildParentThreadReplyEmail({
        teacherName: teacher.name,
        studentName: msg.studentName,
        parentName: msg.parentName || "ولي الأمر",
        replyText: body.trim(),
        portalUrl: `${baseUrl}/parent/${msg.replyToken}`,
        attachments: attachmentLinks,
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
        motivationSummary: parentMessagesTable.motivationSummary,
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
    if (expired && msg.motivationSummary) {
      res.status(410).json({ message: "انتهت صلاحية هذا الرابط", expired: true });
      return;
    }

    if (!msg.readAt) {
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
        messageId: msg.id,
        actionUrl: `/teacher/messages?tab=parents&message=${msg.id}`,
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

// ── Parent portal: request attachment upload URL (token-auth) ──
router.post("/parent-portal/:token/upload-attachment-url", async (req, res) => {
  try {
    const { token } = req.params;

    // Validate the token is active
    const [msg] = await db
      .select({ id: parentMessagesTable.id, tokenExpiresAt: parentMessagesTable.tokenExpiresAt })
      .from(parentMessagesTable)
      .where(eq(parentMessagesTable.replyToken, token))
      .limit(1);
    if (!msg) { res.status(404).json({ error: "الرابط غير صالح" }); return; }
    if (msg.tokenExpiresAt < new Date()) { res.status(410).json({ error: "انتهت صلاحية هذا الرابط" }); return; }

    const parsed = z.object({
      name: z.string().min(1).max(255),
      size: z.number().int().positive(),
      contentType: z.string().min(1).max(200),
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "بيانات غير صالحة" }); return; }

    const { name, size, contentType } = parsed.data;
    const ALLOWED = [
      "image/",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ];
    if (!ALLOWED.some(t => contentType.startsWith(t))) {
      res.status(400).json({ error: "نوع الملف غير مدعوم" }); return;
    }
    if (size > 20 * 1024 * 1024) {
      res.status(400).json({ error: "حجم الملف يتجاوز 20MB" }); return;
    }

    const storage = new ObjectStorageService();
    const uploadURL = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (err) {
    console.error("parent-portal upload-attachment-url error:", err);
    res.status(500).json({ error: "حدث خطأ أثناء إنشاء رابط الرفع" });
  }
});

// ── Parent portal: submit reply ─────────────────────────────
router.post("/parent-portal/:token/reply", async (req, res) => {
  try {
    const { token } = req.params;

    const parsed = z.object({
      replyText: z.string().min(1).max(3000),
      attachments: attachmentSchema,
    }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }
    const { replyText, attachments } = parsed.data;

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
      .values({
        messageId: msg.id, sender: "parent", body: replyText.trim(),
        attachments: attachments ? JSON.stringify(attachments) : null,
      });

    if (!msg.repliedAt) {
      await db.update(parentMessagesTable)
        .set({ replyText: replyText.trim(), repliedAt: new Date() })
        .where(eq(parentMessagesTable.replyToken, token));
    }

    const [teacher] = await db.select({ email: teachersTable.email, name: teachersTable.name })
      .from(teachersTable).where(eq(teachersTable.id, msg.teacherId)).limit(1);

    if (teacher?.email) {
      const baseUrl = getAppBaseUrl();
      const attachmentLinks = attachments?.map(a => ({
        name: a.name, contentType: a.contentType, size: a.size,
        url: `${baseUrl}/api/storage${a.objectPath}`,
      }));
      const emailHtml = buildTeacherReplyNotificationEmail({
        teacherName: teacher.name, studentName: msg.studentName,
        parentName: msg.parentName || "ولي الأمر", replyText: replyText.trim(),
        inboxUrl: `${baseUrl}/teacher/parent-messages`,
        attachments: attachmentLinks,
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
      messageId: msg.id,
      actionUrl: `/teacher/messages?tab=parents&message=${msg.id}`,
    }).catch(() => {});

    res.json({ ok: true });
  } catch (err) {
    console.error("parent-portal reply error:", err);
    res.status(500).json({ message: "حدث خطأ" });
  }
});

export default router;
