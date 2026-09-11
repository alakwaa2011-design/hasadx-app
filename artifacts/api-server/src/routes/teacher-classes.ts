import { Router, type IRouter } from "express";
import { db, teacherClassesTable, studentsTable } from "@workspace/db";
import { and, eq, isNotNull, or, sql } from "drizzle-orm";
import { featureAccess } from "@workspace/billing";

const router: IRouter = Router();
const CLASS_COLOR_KEYS = new Set([
  "teal",
  "indigo",
  "rose",
  "amber",
  "purple",
  "cyan",
  "orange",
  "green",
]);

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.teacherId) return res.status(401).json({ message: "غير مصرح" });
  next();
}

async function backfillFromStudents(teacherId: number) {
  const tid = Number(teacherId);
  await db.execute(sql`
    INSERT INTO teacher_classes (teacher_id, name)
    SELECT DISTINCT ${tid}::int, grade_level
    FROM students
    WHERE teacher_id = ${tid}::int AND grade_level IS NOT NULL AND grade_level <> ''
    ON CONFLICT (teacher_id, name) DO NOTHING
  `);
}

router.get("/teacher/classes", requireAuth, async (req: any, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const teacherId = req.session.teacherId;
    await backfillFromStudents(teacherId);
    const rows = await db
      .select({
        id: teacherClassesTable.id,
        name: teacherClassesTable.name,
        groupName: teacherClassesTable.groupName,
        color: teacherClassesTable.color,
      })
      .from(teacherClassesTable)
      .where(eq(teacherClassesTable.teacherId, teacherId))
      .orderBy(teacherClassesTable.groupName, teacherClassesTable.name);
    res.json(rows);
  } catch (err) {
    req.log?.error(err, "List teacher classes error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.post("/teacher/classes", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const name = (req.body?.name || "").toString().trim();
    if (!name) return res.status(400).json({ message: "الاسم مطلوب" });

    // Subscription gate: enforce maxClasses cap (NULL = unlimited).
    const gate = await featureAccess.check(teacherId, "create_class");
    if (!gate.allowed) {
      return res.status(403).json({
        message: "وصلت إلى الحد الأقصى لعدد الصفوف في باقتك الحالية. يرجى ترقية الاشتراك.",
        reason: gate.reason, limit: gate.limit, used: gate.used, remaining: gate.remaining,
      });
    }

    await db
      .insert(teacherClassesTable)
      .values({ teacherId, name })
      .onConflictDoNothing();
    await featureAccess.increment(teacherId, "create_class").catch(() => {});
    res.json({ ok: true, name });
  } catch (err) {
    req.log?.error(err, "Create teacher class error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.delete("/teacher/classes/:name", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const name = decodeURIComponent(req.params.name);
    await db
      .delete(teacherClassesTable)
      .where(and(eq(teacherClassesTable.teacherId, teacherId), eq(teacherClassesTable.name, name)));
    res.json({ ok: true });
  } catch (err) {
    req.log?.error(err, "Delete teacher class error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.patch("/teacher/classes/rename", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const oldName = (req.body?.oldName || "").toString();
    const newName = (req.body?.newName || "").toString().trim();
    if (!oldName || !newName) return res.status(400).json({ message: "الاسم مطلوب" });

    try {
      await db.transaction(async (tx) => {
        const renamed = await tx.update(teacherClassesTable)
          .set({ name: newName })
          .where(and(eq(teacherClassesTable.teacherId, teacherId), eq(teacherClassesTable.name, oldName)))
          .returning({ id: teacherClassesTable.id });
        if (!renamed[0]) throw new Error("class_not_found");
        await tx.execute(sql`
          UPDATE classroom_reward_transactions
          SET class_name_snapshot=${newName}
          WHERE teacher_id=${teacherId}
            AND teacher_class_id IS NULL
            AND class_name_snapshot=${oldName}
        `);
        await tx.update(studentsTable)
          .set({ gradeLevel: newName, studentClass: newName })
          .where(and(
            eq(studentsTable.teacherId, teacherId),
            or(
              eq(studentsTable.studentClass, oldName),
              eq(studentsTable.gradeLevel, oldName),
            ),
          ));
      });
    } catch (error: any) {
      if (error?.message === "class_not_found") return res.status(404).json({ message: "الصف غير موجود" });
      if (error?.code === "23505" || error?.cause?.code === "23505") return res.status(409).json({ message: "اسم الصف مستخدم بالفعل" });
      throw error;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log?.error(err, "Rename teacher class error");
    res.status(500).json({ message: "خطأ" });
  }
});

/** PATCH /api/teacher/classes/group — assign a class to a group */
router.patch("/teacher/classes/group", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const { className, groupName } = req.body || {};
    if (!className) return res.status(400).json({ message: "اسم الصف مطلوب" });
    await db
      .update(teacherClassesTable)
      .set({ groupName: groupName || null })
      .where(and(eq(teacherClassesTable.teacherId, teacherId), eq(teacherClassesTable.name, className)));
    res.json({ ok: true });
  } catch (err) {
    req.log?.error(err, "Group class error");
    res.status(500).json({ message: "خطأ" });
  }
});

/** PATCH /api/teacher/classes/color — set or reset a class accent color */
router.patch("/teacher/classes/color", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const className = (req.body?.className || "").toString().trim();
    const rawColor = req.body?.color;
    const color = rawColor === null || rawColor === "" || rawColor === undefined
      ? null
      : rawColor.toString().trim();

    if (!className) return res.status(400).json({ message: "اسم الصف مطلوب" });
    if (color !== null && !CLASS_COLOR_KEYS.has(color)) {
      return res.status(400).json({ message: "لون الصف غير صالح" });
    }

    const updated = await db
      .update(teacherClassesTable)
      .set({ color })
      .where(and(eq(teacherClassesTable.teacherId, teacherId), eq(teacherClassesTable.name, className)))
      .returning({ id: teacherClassesTable.id });

    if (!updated[0]) return res.status(404).json({ message: "الصف غير موجود" });
    res.json({ ok: true, color });
  } catch (err) {
    req.log?.error(err, "Class color update error");
    res.status(500).json({ message: "خطأ" });
  }
});

export default router;
