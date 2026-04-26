import { Router, type IRouter } from "express";
import { db, classCustomColumnsTable, studentCustomGradesTable, studentsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.teacherId) return res.status(401).json({ message: "غير مصرح" });
  next();
}

router.get("/custom-columns", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const className = req.query.class as string | undefined;

    const cols = await db
      .select()
      .from(classCustomColumnsTable)
      .where(eq(classCustomColumnsTable.teacherId, teacherId))
      .orderBy(classCustomColumnsTable.createdAt);

    if (className) {
      const filtered = cols.filter(
        (c) => c.appliedTo === "*" || c.appliedTo.split(",").map((s) => s.trim()).includes(className)
      );
      res.json(filtered);
    } else {
      res.json(cols);
    }
  } catch (err) {
    req.log?.error(err, "Get custom columns error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.post("/custom-columns", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const { name, applyToAll, className } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "الاسم مطلوب" });

    const appliedTo = applyToAll ? "*" : (className || "*");

    const [col] = await db
      .insert(classCustomColumnsTable)
      .values({ teacherId, name: name.trim(), appliedTo })
      .returning();

    res.status(201).json(col);
  } catch (err) {
    req.log?.error(err, "Create custom column error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.delete("/custom-columns/:id", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });

    await db
      .delete(classCustomColumnsTable)
      .where(and(eq(classCustomColumnsTable.id, id), eq(classCustomColumnsTable.teacherId, teacherId)));

    res.json({ ok: true });
  } catch (err) {
    req.log?.error(err, "Delete custom column error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.patch("/custom-columns/:id", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });
    const { name, appliedTo } = req.body;

    const updates: any = {};
    if (name?.trim()) updates.name = name.trim();
    if (appliedTo !== undefined) updates.appliedTo = appliedTo;

    const [col] = await db
      .update(classCustomColumnsTable)
      .set(updates)
      .where(and(eq(classCustomColumnsTable.id, id), eq(classCustomColumnsTable.teacherId, teacherId)))
      .returning();

    res.json(col);
  } catch (err) {
    req.log?.error(err, "Update custom column error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.get("/custom-grades/:className", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const className = decodeURIComponent(req.params.className);

    const studentsList = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(and(eq(studentsTable.teacherId, teacherId), eq(studentsTable.gradeLevel, className)));

    const studentIds = studentsList.map((s) => s.id);

    const cols = await db
      .select()
      .from(classCustomColumnsTable)
      .where(eq(classCustomColumnsTable.teacherId, teacherId));

    const relevantCols = cols.filter(
      (c) => c.appliedTo === "*" || c.appliedTo.split(",").map((s) => s.trim()).includes(className)
    );

    if (studentIds.length === 0 || relevantCols.length === 0) {
      return res.json({ columns: relevantCols, grades: [] });
    }

    const grades = await db
      .select()
      .from(studentCustomGradesTable)
      .where(
        and(
          inArray(studentCustomGradesTable.studentId, studentIds),
          inArray(studentCustomGradesTable.columnId, relevantCols.map((c) => c.id))
        )
      );

    res.json({ columns: relevantCols, grades });
  } catch (err) {
    req.log?.error(err, "Get custom grades error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.put("/custom-grades", requireAuth, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId;
    const { columnId, studentId, value } = req.body;
    if (!columnId || !studentId) return res.status(400).json({ message: "بيانات ناقصة" });

    const [col] = await db
      .select()
      .from(classCustomColumnsTable)
      .where(and(eq(classCustomColumnsTable.id, columnId), eq(classCustomColumnsTable.teacherId, teacherId)))
      .limit(1);
    if (!col) return res.status(403).json({ message: "غير مصرح" });

    const [student] = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(and(eq(studentsTable.id, studentId), eq(studentsTable.teacherId, teacherId)))
      .limit(1);
    if (!student) return res.status(403).json({ message: "غير مصرح" });

    const existing = await db
      .select()
      .from(studentCustomGradesTable)
      .where(
        and(
          eq(studentCustomGradesTable.columnId, columnId),
          eq(studentCustomGradesTable.studentId, studentId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(studentCustomGradesTable)
        .set({ value: String(value ?? ""), updatedAt: new Date() })
        .where(eq(studentCustomGradesTable.id, existing[0].id))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(studentCustomGradesTable)
        .values({ columnId, studentId, value: String(value ?? "") })
        .returning();
      res.json(created);
    }
  } catch (err) {
    req.log?.error(err, "Upsert custom grade error");
    res.status(500).json({ message: "خطأ" });
  }
});

export default router;
