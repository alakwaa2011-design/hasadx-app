import { Router, type IRouter } from "express";
import { db, feedbackTable, teachersTable, notificationsTable } from "@workspace/db";
import { SubmitFeedbackBody } from "@workspace/api-zod";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

async function requireAdmin(req: any, res: any): Promise<boolean> {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return false;
  }
  const [teacher] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, req.session.teacherId))
    .limit(1);
  if (!teacher?.isAdmin) {
    res.status(403).json({ message: "غير مصرح — صلاحيات المسؤول مطلوبة" });
    return false;
  }
  return true;
}

const typeLabels: Record<string, string> = {
  suggestion: "اقتراح",
  bug: "خلل",
  praise: "إشادة",
  other: "أخرى",
};

router.post("/feedback", async (req, res) => {
  try {
    const body = SubmitFeedbackBody.parse(req.body);

    await db.insert(feedbackTable).values({
      type: body.type,
      name: body.name,
      email: body.email || null,
      message: body.message,
    });

    try {
      const admins = await db.select({ id: teachersTable.id })
        .from(teachersTable)
        .where(eq(teachersTable.isAdmin, true));

      if (admins.length > 0) {
        const typeLabel = typeLabels[body.type] || body.type;
        await db.insert(notificationsTable).values(
          admins.map(admin => ({
            teacherId: admin.id,
            type: "feedback",
            title: `ملاحظة جديدة (${typeLabel}) من ${body.name}`,
            body: body.message.length > 120 ? body.message.slice(0, 120) + "…" : body.message,
          }))
        );
      }
    } catch (e: any) {
      req.log.error({ err: e }, "Failed to notify admins about feedback");
    }

    res.status(201).json({ message: "تم إرسال ملاحظتك بنجاح" });
  } catch (error: any) {
    req.log.error({ err: error }, "Feedback submission error");
    res.status(400).json({ message: error.message || "خطأ في إرسال الملاحظة" });
  }
});

router.get("/admin/feedback", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const items = await db
      .select()
      .from(feedbackTable)
      .orderBy(desc(feedbackTable.createdAt));
    res.json(items);
  } catch (err) {
    req.log.error(err, "List feedback error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.patch("/admin/feedback/:id/status", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!["new", "read", "resolved"].includes(status)) return res.status(400).json({ message: "حالة غير صالحة" });
    const [updated] = await db
      .update(feedbackTable)
      .set({ status })
      .where(eq(feedbackTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: "غير موجود" });
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Update feedback status error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.delete("/admin/feedback/:id", async (req: any, res) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const id = parseInt(req.params.id);
    await db.delete(feedbackTable).where(eq(feedbackTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Delete feedback error");
    res.status(500).json({ message: "خطأ" });
  }
});

export default router;
