import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, teacherScheduleTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const scheduleFieldsBase = z.object({
  kind: z.enum(["weekly", "appointment", "break"]),
  title: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(100).nullish(),
  className: z.string().trim().max(100).nullish(),
  dayOfWeek: z.number().int().min(0).max(6).nullish(),
  lessonNumber: z.number().int().min(1).max(10).nullish(),
  breakAfterLesson: z.number().int().min(1).max(9).nullish(),
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

async function hasTimeConflict(
  teacherId: number,
  candidate: ComparableScheduleEntry,
  excludedId?: number,
): Promise<boolean> {
  const entries = await db
    .select()
    .from(teacherScheduleTable)
    .where(eq(teacherScheduleTable.teacherId, teacherId));

  return entries.some((entry) =>
    entry.id !== excludedId
    && sharesScheduleDay(candidate, entry)
    && entriesOverlap(candidate, entry),
  );
}

const conflictMessage = "يتعارض هذا الوقت مع حصة أو استراحة أخرى في اليوم نفسه";

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

const bulkLessonSchema = z.object({
  lessonNumber: z.number().int().min(1).max(10),
  title: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(100).nullish(),
  className: z.string().trim().max(100).nullish(),
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

const bulkScheduleSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  lessons: z.array(bulkLessonSchema).min(1).max(10),
}).superRefine((value, ctx) => {
  if (new Set(value.days).size !== value.days.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["days"],
      message: "لا يمكن تكرار اليوم",
    });
  }
  if (new Set(value.lessons.map((lesson) => lesson.lessonNumber)).size !== value.lessons.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lessons"],
      message: "لا يمكن تكرار رقم الحصة",
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
  if (await hasTimeConflict(req.session.teacherId, values)) {
    res.status(409).json({ message: conflictMessage });
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

  const values = parsed.data.days.flatMap((dayOfWeek) =>
      parsed.data.lessons.map((lesson) => ({
        teacherId: req.session.teacherId,
        kind: "weekly" as const,
        title: lesson.title,
        subject: lesson.subject || null,
        className: lesson.className || null,
        dayOfWeek,
        lessonNumber: lesson.lessonNumber,
         breakAfterLesson: null,
        appointmentDate: null,
        startTime: lesson.startTime,
        endTime: lesson.endTime || null,
        location: null,
        notes: null,
      })),
    );
  const existing = await db
    .select()
    .from(teacherScheduleTable)
    .where(eq(teacherScheduleTable.teacherId, req.session.teacherId));
  const hasExistingConflict = values.some((candidate) =>
    existing.some((entry) => sharesScheduleDay(candidate, entry) && entriesOverlap(candidate, entry)),
  );
  const hasInternalConflict = values.some((candidate, index) =>
    values.slice(index + 1).some((other) =>
      sharesScheduleDay(candidate, other) && entriesOverlap(candidate, other),
    ),
  );
  if (hasExistingConflict || hasInternalConflict) {
    res.status(409).json({ message: conflictMessage });
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
  if (await hasTimeConflict(req.session.teacherId, values, id)) {
    res.status(409).json({ message: conflictMessage });
    return;
  }

  const [entry] = await db
    .update(teacherScheduleTable)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(and(
      eq(teacherScheduleTable.id, id),
      eq(teacherScheduleTable.teacherId, req.session.teacherId),
    ))
    .returning();
  res.json(entry);
});

router.delete("/teacher/schedule/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "معرّف الموعد غير صحيح" });
    return;
  }

  const deleted = await db
    .delete(teacherScheduleTable)
    .where(and(
      eq(teacherScheduleTable.id, id),
      eq(teacherScheduleTable.teacherId, req.session.teacherId),
    ))
    .returning({ id: teacherScheduleTable.id });
  if (!deleted.length) {
    res.status(404).json({ message: "الموعد غير موجود" });
    return;
  }
  res.sendStatus(204);
});

export default router;