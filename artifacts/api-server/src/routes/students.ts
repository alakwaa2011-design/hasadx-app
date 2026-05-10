import { Router, type IRouter } from "express";
import { db, studentsTable, studentAccountsTable } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";
import { z } from "zod/v4";
import { featureAccess } from "@workspace/billing";

const router: IRouter = Router();

async function resolveAccountUsername(username: string | null | undefined): Promise<
  { studentAccountId: number; accountUsername: string } | { error: string } | null
> {
  if (!username || username.trim() === "") return null;
  const trimmed = username.trim();
  const [account] = await db
    .select({ id: studentAccountsTable.id, username: studentAccountsTable.username })
    .from(studentAccountsTable)
    .where(eq(studentAccountsTable.username, trimmed))
    .limit(1);
  if (!account) return { error: `لا يوجد حساب طالب بالاسم "${trimmed}"` };
  return { studentAccountId: account.id, accountUsername: account.username };
}

const CreateStudentBody = z.object({
  name: z.string().min(1),
  gradeLevel: z.string().nullish(),
  studentClass: z.string().nullish(),
  parentPhone: z.string().nullish(),
  notes: z.string().nullish(),
  accountUsername: z.string().nullish(),
});

const UpdateStudentBody = z.object({
  name: z.string().min(1).optional(),
  gradeLevel: z.string().nullish(),
  studentClass: z.string().nullish(),
  parentPhone: z.string().nullish(),
  notes: z.string().nullish(),
  accountUsername: z.string().nullish(),
});

const BulkCreateBody = z.object({
  students: z.array(CreateStudentBody).min(1).max(200),
});

router.get("/students", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const students = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.teacherId, teacherId))
      .orderBy(studentsTable.name);

    res.json(students);
  } catch {
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/students", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const parsed = CreateStudentBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }

    // Subscription gate: enforce maxStudents cap (NULL = unlimited).
    const gate = await featureAccess.check(teacherId, "add_student");
    if (!gate.allowed) {
      res.status(403).json({
        message: "وصلت إلى الحد الأقصى لعدد الطلاب في باقتك الحالية. يرجى ترقية الاشتراك.",
        reason: gate.reason, limit: gate.limit, used: gate.used, remaining: gate.remaining,
      });
      return;
    }

    const { accountUsername, ...rest } = parsed.data;
    const accountLink = await resolveAccountUsername(accountUsername);
    if (accountLink && "error" in accountLink) {
      res.status(400).json({ message: accountLink.error }); return;
    }

    const [student] = await db.insert(studentsTable).values({
      ...rest,
      teacherId,
      ...(accountLink ? { accountUsername: accountLink.accountUsername, studentAccountId: accountLink.studentAccountId } : {}),
    }).returning();

    // Increment the (informational) monthly counter — limit enforcement is on totals.
    await featureAccess.increment(teacherId, "add_student").catch(() => {});

    res.status(201).json(student);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      res.status(409).json({ message: "هذا الحساب مرتبط بطالب آخر بالفعل" }); return;
    }
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/students/bulk", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const parsed = BulkCreateBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }

    // Subscription gate: ensure the bulk insert won't exceed the maxStudents limit.
    const gate = await featureAccess.check(teacherId, "add_student");
    if (gate.limit !== null && gate.used + parsed.data.students.length > gate.limit) {
      res.status(403).json({
        message: `لا يمكنك إضافة ${parsed.data.students.length} طلاب — يتبقى لك ${gate.remaining ?? 0} فقط في باقتك الحالية.`,
        reason: "limit_reached", limit: gate.limit, used: gate.used, remaining: gate.remaining,
      });
      return;
    }

    const values = parsed.data.students.map((s) => ({ ...s, teacherId }));
    const inserted = await db.insert(studentsTable).values(values).returning();

    res.status(201).json(inserted);
  } catch {
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.put("/students/:id", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ message: "معرف غير صالح" }); return; }

    const parsed = UpdateStudentBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }

    const [existing] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, id), eq(studentsTable.teacherId, teacherId)));
    if (!existing) { res.status(404).json({ message: "الطالب غير موجود" }); return; }

    const { accountUsername, ...rest } = parsed.data;

    let accountFields: { accountUsername?: string | null; studentAccountId?: number | null } = {};
    if (accountUsername !== undefined) {
      if (!accountUsername || accountUsername.trim() === "") {
        accountFields = { accountUsername: null, studentAccountId: null };
      } else {
        const accountLink = await resolveAccountUsername(accountUsername);
        if (accountLink && "error" in accountLink) {
          res.status(400).json({ message: accountLink.error }); return;
        }
        if (accountLink) {
          accountFields = { accountUsername: accountLink.accountUsername, studentAccountId: accountLink.studentAccountId };
        }
      }
    }

    const [updated] = await db.update(studentsTable).set({ ...rest, ...accountFields }).where(eq(studentsTable.id, id)).returning();
    res.json(updated);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      res.status(409).json({ message: "هذا الحساب مرتبط بطالب آخر بالفعل" }); return;
    }
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.delete("/students/all", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    await db.delete(studentsTable).where(eq(studentsTable.teacherId, teacherId));
    res.json({ message: "تم حذف جميع الطلاب" });
  } catch {
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.delete("/students/:id", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ message: "معرف غير صالح" }); return; }

    const [existing] = await db.select().from(studentsTable).where(and(eq(studentsTable.id, id), eq(studentsTable.teacherId, teacherId)));
    if (!existing) { res.status(404).json({ message: "الطالب غير موجود" }); return; }

    await db.delete(studentsTable).where(eq(studentsTable.id, id));
    res.json({ message: "تم حذف الطالب" });
  } catch {
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/students/rename-group", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const { oldGradeLevel, newGradeLevel } = req.body;
    if (!oldGradeLevel || !newGradeLevel) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }

    await db.update(studentsTable)
      .set({ gradeLevel: newGradeLevel, studentClass: newGradeLevel })
      .where(and(eq(studentsTable.teacherId, teacherId), eq(studentsTable.gradeLevel, oldGradeLevel)));

    res.json({ message: "تم إعادة التسمية" });
  } catch {
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/students/move-group", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const { fromGradeLevel, toGradeLevel } = req.body;
    if (!fromGradeLevel || !toGradeLevel) { res.status(400).json({ message: "بيانات غير صالحة" }); return; }

    await db.update(studentsTable)
      .set({ gradeLevel: toGradeLevel, studentClass: toGradeLevel })
      .where(and(eq(studentsTable.teacherId, teacherId), eq(studentsTable.gradeLevel, fromGradeLevel)));

    res.json({ message: "تم النقل" });
  } catch {
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.delete("/students/group/:gradeLevel", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

    const gradeLevel = decodeURIComponent(req.params.gradeLevel);

    await db.delete(studentsTable).where(and(
      eq(studentsTable.teacherId, teacherId),
      eq(studentsTable.gradeLevel, gradeLevel)
    ));

    res.json({ message: "تم حذف المجموعة" });
  } catch {
    res.status(500).json({ message: "حدث خطأ" });
  }
});

export default router;
