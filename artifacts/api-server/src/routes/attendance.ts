import { Router, type IRouter } from "express";
import { db, attendanceTable, studentsTable } from "@workspace/db";
import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.teacherId) return res.status(401).json({ message: "غير مصرح" });
  next();
}

const SaveBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  records: z.array(z.object({
    studentId: z.number().int().positive(),
    status: z.enum(["present", "absent", "late", "excused"]),
    note: z.string().max(200).optional(),
  })),
});

/** GET /api/attendance?gradeLevel=X&date=YYYY-MM-DD */
router.get("/attendance", requireAuth, async (req: any, res) => {
  const teacherId = req.session.teacherId;
  const { gradeLevel, date, from, to } = req.query as Record<string, string>;
  try {
    // Get student ids for this class
    let studentIds: number[] | undefined;
    if (gradeLevel) {
      const students = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(and(eq(studentsTable.teacherId, teacherId), eq(studentsTable.gradeLevel, gradeLevel)));
      studentIds = students.map(s => s.id);
      if (studentIds.length === 0) return res.json([]);
    }

    const conditions = [eq(attendanceTable.teacherId, teacherId)];
    if (date) conditions.push(eq(attendanceTable.date, date));
    if (from) conditions.push(gte(attendanceTable.date, from));
    if (to) conditions.push(lte(attendanceTable.date, to));
    if (studentIds) conditions.push(inArray(attendanceTable.studentId, studentIds));

    const rows = await db
      .select()
      .from(attendanceTable)
      .where(and(...conditions));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "خطأ" });
  }
});

/** POST /api/attendance — save/update attendance for a date */
router.post("/attendance", requireAuth, async (req: any, res) => {
  const teacherId = req.session.teacherId;
  const parsed = SaveBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "بيانات غير صالحة" });
  const { date, records } = parsed.data;
  try {
    for (const rec of records) {
      // Upsert per student+date
      const existing = await db
        .select({ id: attendanceTable.id })
        .from(attendanceTable)
        .where(and(
          eq(attendanceTable.teacherId, teacherId),
          eq(attendanceTable.studentId, rec.studentId),
          eq(attendanceTable.date, date),
        ))
        .limit(1);
      if (existing[0]) {
        await db.update(attendanceTable)
          .set({ status: rec.status, note: rec.note ?? null })
          .where(eq(attendanceTable.id, existing[0].id));
      } else {
        await db.insert(attendanceTable).values({
          teacherId,
          studentId: rec.studentId,
          date,
          status: rec.status,
          note: rec.note ?? null,
        });
      }
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "خطأ" });
  }
});

export default router;
