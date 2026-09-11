import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, teacherScheduleTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const timePattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const scheduleFieldsBase = z.object({
  kind: z.enum(["weekly", "appointment"]),
  title: z.string().trim().min(1).max(160),
  subject: z.string().trim().max(100).nullish(),
  className: z.string().trim().max(100).nullish(),
  dayOfWeek: z.number().int().min(0).max(6).nullish(),
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
    dayOfWeek: value.kind === "weekly" ? value.dayOfWeek ?? null : null,
    appointmentDate: value.kind === "appointment" ? value.appointmentDate ?? null : null,
    endTime: value.endTime || null,
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

router.post("/teacher/schedule", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = createScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "بيانات الموعد غير صحيحة" });
    return;
  }

  const [entry] = await db
    .insert(teacherScheduleTable)
    .values({
      teacherId: req.session.teacherId,
      ...normalizeValues(parsed.data),
    })
    .returning();
  res.status(201).json(entry);
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

  const [entry] = await db
    .update(teacherScheduleTable)
    .set({
      ...normalizeValues(merged.data),
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