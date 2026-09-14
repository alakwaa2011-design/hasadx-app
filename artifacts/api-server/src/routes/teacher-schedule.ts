import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, pool, teacherScheduleTable } from "@workspace/db";
import { z } from "zod";
import { checkCredits, captureCreditsOrThrow, refundCredits } from "../lib/check-credits";
import {
  createUploadFilesMiddleware,
  processUploadedFiles,
  runVisionCompletionMulti,
} from "../lib/file-upload";
import { resolveTier } from "../lib/ai-tier";
import {
  buildTeacherScheduleExtractionPrompt,
  parseExtractedTeacherSchedule,
  UnreadableTeacherScheduleImageError,
} from "../lib/teacher-schedule-extraction";

const router: IRouter = Router();
const uploadFiles = createUploadFilesMiddleware({
  maxFiles: 1,
  maxBytes: 10 * 1024 * 1024,
});

const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const colorPattern = /^#[0-9A-Fa-f]{6}$/;

const scheduleFieldsBase = z.object({
  kind: z.enum(["weekly", "appointment", "break"]),
  title: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(100).nullish(),
  className: z.string().trim().max(100).nullish(),
  color: z.string().regex(colorPattern).nullish(),
  dayOfWeek: z.number().int().min(0).max(6).nullish(),
  lessonNumber: z.number().int().min(1).max(30).nullish(),
  breakAfterLesson: z.number().int().min(0).max(30).nullish(),
  appointmentDate: z.string().regex(datePattern).nullish(),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern).nullish(),
  location: z.string().trim().max(160).nullish(),
  notes: z.string().trim().max(500).nullish(),
});

const scheduleFields = scheduleFieldsBase.superRefine((value, ctx) => {
  if (value.kind === "weekly" && value.dayOfWeek == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dayOfWeek"],
      message: "اليوم مطلوب للحصة الأسبوعية",
    });
  }
  if (value.kind === "weekly" && value.lessonNumber == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lessonNumber"],
      message: "رقم الحصة مطلوب للحصة الأسبوعية",
    });
  }
  if (value.kind === "break" && value.dayOfWeek == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dayOfWeek"],
      message: "اليوم مطلوب لفترة الاستراحة",
    });
  }
  if (value.kind === "break" && value.breakAfterLesson == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["breakAfterLesson"],
      message: "حدد الحصة التي تسبق فترة الاستراحة",
    });
  }
  if (value.kind === "appointment" && !value.appointmentDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["appointmentDate"],
      message: "التاريخ مطلوب للموعد المنفرد",
    });
  }
  if (value.endTime && value.endTime <= value.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "يجب أن يكون وقت الانتهاء بعد وقت البداية",
    });
  }
});

const createScheduleSchema = scheduleFields;
const updateScheduleSchema = scheduleFieldsBase.partial();
const notificationPreferencesSchema = z.object({
  enabled: z.boolean(),
  alertMinutes: z.number().int().min(1).max(120),
  endAlertMinutes: z.number().int().min(0).max(120),
  soundEnabled: z.boolean(),
  locale: z.enum(["ar", "en"]),
  timezone: z.string().min(1).max(100).refine((timezone) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }, "المنطقة الزمنية غير صحيحة"),
});

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "غير مصرح" });
    return;
  }
  next();
}

function normalizeValues(value: z.infer<typeof scheduleFields>) {
  return {
    ...value,
    subject: value.subject || null,
    className: value.className || null,
    color: value.kind === "weekly" ? value.color || null : null,
    location: value.location || null,
    notes: value.notes || null,
    dayOfWeek: value.kind === "appointment" ? null : value.dayOfWeek ?? null,
    lessonNumber: value.kind === "weekly" ? value.lessonNumber ?? null : null,
    breakAfterLesson: value.kind === "break" ? value.breakAfterLesson ?? null : null,
    appointmentDate: value.kind === "appointment" ? value.appointmentDate ?? null : null,
    endTime: value.endTime || null,
  };
}

type ComparableScheduleEntry = {
  kind: string;
  dayOfWeek: number | null;
  appointmentDate: string | null;
  startTime: string;
  endTime: string | null;
};

function entriesOverlap(left: ComparableScheduleEntry, right: ComparableScheduleEntry): boolean {
  if (!left.endTime || !right.endTime) return false;
  return left.startTime < right.endTime && right.startTime < left.endTime;
}

function sharesScheduleDay(left: ComparableScheduleEntry, right: ComparableScheduleEntry): boolean {
  if (left.kind === "appointment" || right.kind === "appointment") {
    return left.kind === "appointment"
      && right.kind === "appointment"
      && left.appointmentDate === right.appointmentDate;
  }
  return left.dayOfWeek === right.dayOfWeek;
}

async function findTimeConflict(
  teacherId: number,
  candidate: ComparableScheduleEntry,
  excludedId?: number,
): Promise<typeof teacherScheduleTable.$inferSelect | undefined> {
  const entries = await db
    .select()
    .from(teacherScheduleTable)
    .where(eq(teacherScheduleTable.teacherId, teacherId));

  return entries.find((entry) =>
    entry.id !== excludedId
    && sharesScheduleDay(candidate, entry)
    && entriesOverlap(candidate, entry),
  );
}

const conflictMessage = "يتعارض هذا الوقت مع حصة أو استراحة أخرى في اليوم نفسه";

function conflictResponse(
  candidate: ComparableScheduleEntry & { lessonNumber?: number | null },
  conflicting: ComparableScheduleEntry & { title?: string; lessonNumber?: number | null },
) {
  return {
    message: conflictMessage,
    conflict: {
      dayOfWeek: candidate.dayOfWeek,
      appointmentDate: candidate.appointmentDate,
      lessonNumber: candidate.lessonNumber ?? null,
      startTime: candidate.startTime,
      endTime: candidate.endTime,
      conflictingTitle: conflicting.title || null,
      conflictingLessonNumber: conflicting.lessonNumber ?? null,
      conflictingStartTime: conflicting.startTime,
      conflictingEndTime: conflicting.endTime,
    },
  };
}

router.get("/teacher/schedule", requireAuth, async (req: any, res): Promise<void> => {
  const rows = await db
    .select()
    .from(teacherScheduleTable)
    .where(eq(teacherScheduleTable.teacherId, req.session.teacherId))
    .orderBy(
      asc(teacherScheduleTable.appointmentDate),
      asc(teacherScheduleTable.dayOfWeek),
      asc(teacherScheduleTable.startTime),
    );
  res.set("Cache-Control", "no-store");
  res.json(rows);
});

router.get("/teacher/schedule/notification-preferences", requireAuth, async (req: any, res): Promise<void> => {
  const result = await pool.query<{
    enabled: boolean;
    alert_minutes: number;
    end_alert_minutes: number;
    sound_enabled: boolean;
    locale: "ar" | "en";
    timezone: string;
  }>(`SELECT enabled, alert_minutes, end_alert_minutes, sound_enabled, locale, timezone
      FROM teacher_schedule_notification_preferences WHERE teacher_id = $1`, [req.session.teacherId]);
  const row = result.rows[0];
  res.set("Cache-Control", "no-store");
  res.json(row ? {
    exists: true,
    enabled: row.enabled,
    alertMinutes: row.alert_minutes,
    endAlertMinutes: row.end_alert_minutes,
    soundEnabled: row.sound_enabled,
    locale: row.locale,
    timezone: row.timezone,
  } : { exists: false });
});

router.patch("/teacher/schedule/notification-preferences", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = notificationPreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "إعدادات التنبيه غير صحيحة" });
    return;
  }
  const value = parsed.data;
  const result = await pool.query<{
    enabled: boolean;
    alert_minutes: number;
    end_alert_minutes: number;
    sound_enabled: boolean;
    locale: "ar" | "en";
    timezone: string;
  }>(`INSERT INTO teacher_schedule_notification_preferences
        (teacher_id, enabled, alert_minutes, end_alert_minutes, sound_enabled, locale, timezone, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (teacher_id) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        alert_minutes = EXCLUDED.alert_minutes,
        end_alert_minutes = EXCLUDED.end_alert_minutes,
        sound_enabled = EXCLUDED.sound_enabled,
        locale = EXCLUDED.locale,
        timezone = EXCLUDED.timezone,
        updated_at = NOW()
      RETURNING enabled, alert_minutes, end_alert_minutes, sound_enabled, locale, timezone`,
      [req.session.teacherId, value.enabled, value.alertMinutes, value.endAlertMinutes, value.soundEnabled, value.locale, value.timezone]);
  const row = result.rows[0];
  res.json({
    enabled: row.enabled,
    alertMinutes: row.alert_minutes,
    endAlertMinutes: row.end_alert_minutes,
    soundEnabled: row.sound_enabled,
    locale: row.locale,
    timezone: row.timezone,
  });
});

router.delete("/teacher/schedule", requireAuth, async (req: any, res): Promise<void> => {
  const deleted = await db
    .delete(teacherScheduleTable)
    .where(eq(teacherScheduleTable.teacherId, req.session.teacherId))
    .returning({ id: teacherScheduleTable.id });

  res.json({ deletedCount: deleted.length });
});

router.post(
  "/teacher/schedule/ai/extract",
  requireAuth,
  uploadFiles,
  checkCredits("teacher-schedule-extract"),
  async (req: any, res): Promise<void> => {
    const language = req.body?.language === "en" ? "en" : "ar";
    try {
      const files = ((req.files as Express.Multer.File[]) || []);
      if (files.length !== 1) {
        await refundCredits(req, "يجب إرفاق صورة جدول واحدة");
        res.status(400).json({
          message: language === "ar" ? "أرفق صورة واحدة للجدول" : "Attach one schedule image",
        });
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(files[0].mimetype)) {
        await refundCredits(req, "نوع صورة غير مدعوم");
        res.status(415).json({
          message: language === "ar" ? "استخدم صورة JPG أو PNG أو WebP" : "Use a JPG, PNG, or WebP image",
        });
        return;
      }

      const prepared = await processUploadedFiles(req, res, files, language);
      if (!prepared) {
        await refundCredits(req, "فشل تجهيز صورة الجدول");
        return;
      }
      if (prepared.images.length !== 1) {
        await refundCredits(req, "لم يتم العثور على صورة قابلة للقراءة");
        res.status(400).json({
          message: language === "ar" ? "لم نتمكن من قراءة الصورة المرفوعة" : "The attached image could not be read",
        });
        return;
      }

      const tier = await resolveTier(req.session.teacherId, req.body?.tier);
      const raw = await runVisionCompletionMulti({
        tier,
        prompt: buildTeacherScheduleExtractionPrompt(language),
        images: prepared.images,
        maxTokens: 8000,
        usage: {
          req,
          toolKey: "teacher-schedule-extract",
          callKey: "schedule:vision",
        },
      });
      const result = parseExtractedTeacherSchedule(raw);
      await captureCreditsOrThrow(req, result);
      res.json(result);
    } catch (err: any) {
      await refundCredits(req, "فشل استخراج جدول المعلم");
      if (err?.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          message: language === "ar" ? "حجم الصورة يتجاوز الحد المسموح" : "The image exceeds the size limit",
        });
        return;
      }
      if (err instanceof UnreadableTeacherScheduleImageError) {
        req.log.info({ warnings: err.warnings }, "Teacher schedule image alignment was unreadable");
        res.status(422).json({
          message: language === "ar"
            ? "تعذّرت قراءة محاذاة الأيام والحصص بأمان. صوّر الصفحة كاملة من الأعلى مباشرة، بإضاءة متساوية ومن دون ظلال أو وهج."
            : "The weekday and lesson alignment could not be read safely. Retake the full page straight from above with even lighting and no shadows or glare.",
          warnings: err.warnings,
        });
        return;
      }
      if (err instanceof z.ZodError || err instanceof SyntaxError) {
        req.log.warn({ err }, "Teacher schedule extraction returned invalid structured data");
        res.status(422).json({
          message: language === "ar"
            ? "تعذّر فهم بنية الجدول بوضوح. جرّب صورة أوضح ومباشرة."
            : "The schedule structure was not clear enough. Try a clearer, straight image.",
        });
        return;
      }
      req.log.error({ err }, "Teacher schedule image extraction failed");
      res.status(500).json({
        message: language === "ar"
          ? "تعذّر استخراج الجدول. لم يتم خصم النقاط، ويمكنك المحاولة مرة أخرى."
          : "Could not extract the schedule. No credits were charged; please try again.",
      });
    }
  },
);

const bulkLessonSchema = z.object({
  lessonNumber: z.number().int().min(1).max(30),
  title: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(100).nullish(),
  className: z.string().trim().max(100).nullish(),
  color: z.string().regex(colorPattern).nullish(),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern).nullish(),
}).superRefine((value, ctx) => {
  if (value.endTime && value.endTime <= value.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "يجب أن يكون وقت الانتهاء بعد وقت البداية",
    });
  }
});

const bulkBreakSchema = z.object({
  title: z.string().trim().min(1).max(160),
  breakAfterLesson: z.number().int().min(0).max(30),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern).nullish(),
}).superRefine((value, ctx) => {
  if (value.endTime && value.endTime <= value.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endTime"],
      message: "يجب أن يكون وقت انتهاء الفترة بعد بدايتها",
    });
  }
});

const bulkScheduleSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  lessons: z.array(bulkLessonSchema).min(1).max(30).optional(),
  daySchedules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    lessons: z.array(bulkLessonSchema).max(30).default([]),
    breaks: z.array(bulkBreakSchema).max(50).default([]),
  })).min(1).max(7).optional(),
}).superRefine((value, ctx) => {
  const usesSharedLessons = Boolean(value.days && value.lessons);
  const usesDaySchedules = Boolean(value.daySchedules);
  if (usesSharedLessons === usesDaySchedules) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "أرسل الأيام والحصص المشتركة أو جدولًا مستقلًا لكل يوم",
    });
    return;
  }
  if (value.days && new Set(value.days).size !== value.days.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["days"],
      message: "لا يمكن تكرار اليوم",
    });
  }
  if (value.lessons && new Set(value.lessons.map((lesson) => lesson.lessonNumber)).size !== value.lessons.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lessons"],
      message: "لا يمكن تكرار رقم الحصة",
    });
  }
  if (value.daySchedules) {
    if (new Set(value.daySchedules.map((schedule) => schedule.dayOfWeek)).size !== value.daySchedules.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["daySchedules"],
        message: "لا يمكن تكرار اليوم",
      });
    }
    value.daySchedules.forEach((schedule, index) => {
      if (schedule.lessons.length === 0 && schedule.breaks.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["daySchedules", index],
          message: "يجب أن يحتوي اليوم على فترة واحدة على الأقل",
        });
      }
      if (new Set(schedule.lessons.map((lesson) => lesson.lessonNumber)).size !== schedule.lessons.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["daySchedules", index, "lessons"],
          message: "لا يمكن تكرار رقم الحصة في اليوم نفسه",
        });
      }
    });
  }
});

router.post("/teacher/schedule", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = createScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "بيانات الموعد غير صحيحة" });
    return;
  }

  const values = normalizeValues(parsed.data);
  const conflictingEntry = await findTimeConflict(req.session.teacherId, values);
  if (conflictingEntry) {
    res.status(409).json(conflictResponse(values, conflictingEntry));
    return;
  }

  const [entry] = await db
    .insert(teacherScheduleTable)
    .values({
      teacherId: req.session.teacherId,
      ...values,
    })
    .returning();
  res.status(201).json(entry);
});

router.post("/teacher/schedule/bulk", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = bulkScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "بيانات الجدول غير صحيحة" });
    return;
  }

  const daySchedules = parsed.data.daySchedules
    ?? parsed.data.days!.map((dayOfWeek) => ({
      dayOfWeek,
      lessons: parsed.data.lessons!,
      breaks: [],
    }));
  const values = daySchedules.flatMap(({ dayOfWeek, lessons, breaks = [] }) => [
      ...lessons.map((lesson) => ({
        teacherId: req.session.teacherId,
        kind: "weekly" as const,
        title: lesson.title,
        subject: lesson.subject || null,
        className: lesson.className || null,
        color: lesson.color || null,
        dayOfWeek,
        lessonNumber: lesson.lessonNumber,
        breakAfterLesson: null,
        appointmentDate: null,
        startTime: lesson.startTime,
        endTime: lesson.endTime || null,
        location: null,
        notes: null,
      })),
      ...breaks.map((entry) => ({
        teacherId: req.session.teacherId,
        kind: "break" as const,
        title: entry.title,
        subject: null,
        className: null,
        color: null,
        dayOfWeek,
        lessonNumber: null,
        breakAfterLesson: entry.breakAfterLesson,
        appointmentDate: null,
        startTime: entry.startTime,
        endTime: entry.endTime || null,
        location: null,
        notes: null,
      })),
    ]);
  const existing = await db
    .select()
    .from(teacherScheduleTable)
    .where(eq(teacherScheduleTable.teacherId, req.session.teacherId));
  const existingConflict = values
    .map((candidate) => ({
      candidate,
      conflicting: existing.find((entry) =>
        sharesScheduleDay(candidate, entry) && entriesOverlap(candidate, entry),
      ),
    }))
    .find(({ conflicting }) => Boolean(conflicting));
  let internalConflict: { candidate: typeof values[number]; conflicting: typeof values[number] } | undefined;
  for (let index = 0; index < values.length && !internalConflict; index += 1) {
    const conflicting = values.slice(index + 1).find((other) =>
      sharesScheduleDay(values[index], other) && entriesOverlap(values[index], other),
    );
    if (conflicting) internalConflict = { candidate: values[index], conflicting };
  }
  const conflict = existingConflict?.conflicting
    ? { candidate: existingConflict.candidate, conflicting: existingConflict.conflicting }
    : internalConflict;
  if (conflict) {
    res.status(409).json(conflictResponse(conflict.candidate, conflict.conflicting));
    return;
  }

  const created = await db.transaction(async (tx) => {
    return tx.insert(teacherScheduleTable).values(values).returning();
  });
  res.status(201).json(created);
});

router.patch("/teacher/schedule/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "معرّف الموعد غير صحيح" });
    return;
  }

  const [existing] = await db
    .select()
    .from(teacherScheduleTable)
    .where(and(
      eq(teacherScheduleTable.id, id),
      eq(teacherScheduleTable.teacherId, req.session.teacherId),
    ))
    .limit(1);
  if (!existing) {
    res.status(404).json({ message: "الموعد غير موجود" });
    return;
  }

  const patch = updateScheduleSchema.safeParse(req.body);
  if (!patch.success) {
    res.status(400).json({ message: patch.error.issues[0]?.message || "بيانات الموعد غير صحيحة" });
    return;
  }

  const merged = createScheduleSchema.safeParse({
    kind: existing.kind,
    title: existing.title,
    subject: existing.subject,
    className: existing.className,
    color: existing.color,
    dayOfWeek: existing.dayOfWeek,
    lessonNumber: existing.lessonNumber,
    breakAfterLesson: existing.breakAfterLesson,
    appointmentDate: existing.appointmentDate,
    startTime: existing.startTime,
    endTime: existing.endTime,
    location: existing.location,
    notes: existing.notes,
    ...patch.data,
  });
  if (!merged.success) {
    res.status(400).json({ message: merged.error.issues[0]?.message || "بيانات الموعد غير مكتملة" });
    return;
  }

  const values = normalizeValues(merged.data);
  const conflictingEntry = await findTimeConflict(req.session.teacherId, values, id);
  if (conflictingEntry) {
    res.status(409).json(conflictResponse(values, conflictingEntry));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id FROM teacher_schedule WHERE id = $2 AND teacher_id = $1 FOR UPDATE`,
      [req.session.teacherId, id],
    );
    if (!locked.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "الموعد غير موجود" });
      return;
    }
    await client.query(
      `DELETE FROM notifications WHERE id IN (
         SELECT notification_id FROM teacher_schedule_notification_runs
         WHERE teacher_id = $1 AND schedule_entry_id = $2
       );
       DELETE FROM teacher_schedule_notification_runs WHERE teacher_id = $1 AND schedule_entry_id = $2`,
      [req.session.teacherId, id],
    );
    const updated = await client.query(
      `UPDATE teacher_schedule SET
         kind = $3, title = $4, subject = $5, class_name = $6, color = $7,
         day_of_week = $8, lesson_number = $9, break_after_lesson = $10,
         appointment_date = $11, start_time = $12, end_time = $13,
         location = $14, notes = $15, updated_at = NOW()
       WHERE id = $2 AND teacher_id = $1
       RETURNING *`,
      [
        req.session.teacherId, id, values.kind, values.title, values.subject, values.className,
        values.color, values.dayOfWeek, values.lessonNumber, values.breakAfterLesson,
        values.appointmentDate, values.startTime, values.endTime, values.location, values.notes,
      ],
    );
    await client.query("COMMIT");
    res.json(toApiScheduleRow(updated.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.delete("/teacher/schedule/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "معرّف الموعد غير صحيح" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id FROM teacher_schedule WHERE id = $2 AND teacher_id = $1 FOR UPDATE`,
      [req.session.teacherId, id],
    );
    if (!locked.rows.length) {
      await client.query("ROLLBACK");
      res.status(404).json({ message: "الموعد غير موجود" });
      return;
    }
    await client.query(
      `DELETE FROM notifications WHERE id IN (
         SELECT notification_id FROM teacher_schedule_notification_runs
         WHERE teacher_id = $1 AND schedule_entry_id = $2
       );
       DELETE FROM teacher_schedule_notification_runs WHERE teacher_id = $1 AND schedule_entry_id = $2;
       DELETE FROM teacher_schedule WHERE teacher_id = $1 AND id = $2`,
      [req.session.teacherId, id],
    );
    await client.query("COMMIT");
    res.sendStatus(204);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

function toApiScheduleRow(row: any) {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    kind: row.kind,
    title: row.title,
    subject: row.subject,
    className: row.class_name,
    color: row.color,
    dayOfWeek: row.day_of_week,
    lessonNumber: row.lesson_number,
    breakAfterLesson: row.break_after_lesson,
    appointmentDate: row.appointment_date instanceof Date
      ? row.appointment_date.toISOString().slice(0, 10)
      : row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default router;