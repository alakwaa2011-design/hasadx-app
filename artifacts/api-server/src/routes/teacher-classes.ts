import { Router, type IRouter } from "express";
import { db, teacherClassesTable, studentsTable } from "@workspace/db";
import { and, eq, isNotNull, sql } from "drizzle-orm";

const router: IRouter = Router();

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
      .select({ id: teacherClassesTable.id, name: teacherClassesTable.name, groupName: teacherClassesTable.groupName })
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
    await db
      .insert(teacherClassesTable)
      .values({ teacherId, name })
      .onConflictDoNothing();
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

    // Insert/ensure new exists
    await db
      .insert(teacherClassesTable)
      .values({ teacherId, name: newName })
      .onConflictDoNothing();
    // Remove old
    await db
      .delete(teacherClassesTable)
      .where(and(eq(teacherClassesTable.teacherId, teacherId), eq(teacherClassesTable.name, oldName)));
    // Rename gradeLevel on students
    await db
      .update(studentsTable)
      .set({ gradeLevel: newName, studentClass: newName })
      .where(and(eq(studentsTable.teacherId, teacherId), eq(studentsTable.gradeLevel, oldName)));
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

export default router;
