import { Router, type IRouter } from "express";
import { db, teachersTable, sectionsTable, subSectionsTable, activitySectionMapTable } from "@workspace/db";
import { eq, sql, asc } from "drizzle-orm";

const router: IRouter = Router();

async function requireAdmin(req: Record<string, unknown>, res: Record<string, unknown>): Promise<boolean> {
  const session = (req as Record<string, Record<string, unknown>>).session;
  const resFn = res as { status: (code: number) => { json: (data: Record<string, unknown>) => void } };
  if (!session.teacherId) {
    resFn.status(401).json({ message: "غير مسجل الدخول" });
    return false;
  }
  const [teacher] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, session.teacherId as number))
    .limit(1);
  if (!teacher?.isAdmin) {
    resFn.status(403).json({ message: "غير مصرح" });
    return false;
  }
  return true;
}

router.get("/sections", async (_req, res) => {
  try {
    const sections = await db
      .select()
      .from(sectionsTable)
      .orderBy(asc(sectionsTable.sortOrder), asc(sectionsTable.id));

    const subSections = await db
      .select()
      .from(subSectionsTable)
      .orderBy(asc(subSectionsTable.sortOrder), asc(subSectionsTable.id));

    const mappings = await db
      .select()
      .from(activitySectionMapTable)
      .orderBy(asc(activitySectionMapTable.sortOrder));

    res.json({ sections, subSections, mappings });
  } catch (err) {
    (res as Record<string, unknown> & { status: (c: number) => { json: (d: Record<string, unknown>) => void } }).status(500).json({ message: "خطأ في تحميل الأقسام" });
  }
});

router.post("/admin/sections", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const { name, nameEn, icon, color } = r.body as { name: string; nameEn?: string; icon?: string; color?: string };
    if (!name?.trim()) { resFn.status(400).json({ message: "الاسم مطلوب" }); return; }

    const maxOrder = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` }).from(sectionsTable);
    const [section] = await db.insert(sectionsTable).values({
      name: name.trim(),
      nameEn: nameEn?.trim() || null,
      icon: icon || "Folder",
      color: color || "#0d6b75",
      sortOrder: (maxOrder[0]?.max || 0) + 1,
    }).returning();
    resFn.json(section);
  } catch (err) {
    resFn.status(500).json({ message: "خطأ" });
  }
});

router.patch("/admin/sections/:id", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const id = Number((r.params as Record<string, string>).id);
    const { name, nameEn, icon, color, sortOrder } = r.body as {
      name?: string; nameEn?: string; icon?: string; color?: string; sortOrder?: number;
    };
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (nameEn !== undefined) updates.nameEn = nameEn?.trim() || null;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const [updated] = await db.update(sectionsTable).set(updates).where(eq(sectionsTable.id, id)).returning();
    if (!updated) { resFn.status(404).json({ message: "قسم غير موجود" }); return; }
    resFn.json(updated);
  } catch (err) {
    resFn.status(500).json({ message: "خطأ" });
  }
});

router.delete("/admin/sections/:id", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const id = Number((r.params as Record<string, string>).id);
    await db.delete(sectionsTable).where(eq(sectionsTable.id, id));
    resFn.json({ success: true });
  } catch (err) {
    resFn.status(500).json({ message: "خطأ" });
  }
});

router.post("/admin/sub-sections", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const { sectionId, name, nameEn, icon } = r.body as { sectionId: number; name: string; nameEn?: string; icon?: string };
    if (!name?.trim() || !sectionId) { resFn.status(400).json({ message: "البيانات ناقصة" }); return; }

    const maxOrder = await db.select({ max: sql<number>`COALESCE(MAX(sort_order), 0)` }).from(subSectionsTable).where(eq(subSectionsTable.sectionId, sectionId));
    const [sub] = await db.insert(subSectionsTable).values({
      sectionId,
      name: name.trim(),
      nameEn: nameEn?.trim() || null,
      icon: icon || "FolderOpen",
      sortOrder: (maxOrder[0]?.max || 0) + 1,
    }).returning();
    resFn.json(sub);
  } catch (err) {
    resFn.status(500).json({ message: "خطأ" });
  }
});

router.patch("/admin/sub-sections/:id", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const id = Number((r.params as Record<string, string>).id);
    const { name, nameEn, icon, sortOrder } = r.body as { name?: string; nameEn?: string; icon?: string; sortOrder?: number };
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (nameEn !== undefined) updates.nameEn = nameEn?.trim() || null;
    if (icon !== undefined) updates.icon = icon;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const [updated] = await db.update(subSectionsTable).set(updates).where(eq(subSectionsTable.id, id)).returning();
    if (!updated) { resFn.status(404).json({ message: "قسم فرعي غير موجود" }); return; }
    resFn.json(updated);
  } catch (err) {
    resFn.status(500).json({ message: "خطأ" });
  }
});

router.delete("/admin/sub-sections/:id", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const id = Number((r.params as Record<string, string>).id);
    await db.delete(subSectionsTable).where(eq(subSectionsTable.id, id));
    resFn.json({ success: true });
  } catch (err) {
    resFn.status(500).json({ message: "خطأ" });
  }
});

router.post("/admin/activities/assign-section", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const { items, sectionId, subSectionId } = r.body as {
      items: Array<{ activityType: string; activityId: string }>;
      sectionId: number;
      subSectionId?: number | null;
    };
    if (!items?.length || !sectionId) { resFn.status(400).json({ message: "البيانات ناقصة" }); return; }

    for (const item of items) {
      await db.execute(sql`
        INSERT INTO activity_section_map (activity_type, activity_id, section_id, sub_section_id, sort_order)
        VALUES (${item.activityType}::activity_type, ${item.activityId}, ${sectionId}, ${subSectionId || null}, 0)
        ON CONFLICT (activity_type, activity_id)
        DO UPDATE SET section_id = ${sectionId}, sub_section_id = ${subSectionId || null}
      `);
    }
    resFn.json({ success: true, count: items.length });
  } catch (err) {
    resFn.status(500).json({ message: "خطأ في تعيين الأقسام" });
  }
});

router.post("/admin/activities/unassign", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const { items } = r.body as { items: Array<{ activityType: string; activityId: string }> };
    if (!items?.length) { resFn.status(400).json({ message: "البيانات ناقصة" }); return; }

    for (const item of items) {
      await db.execute(sql`
        DELETE FROM activity_section_map
        WHERE activity_type = ${item.activityType}::activity_type AND activity_id = ${item.activityId}
      `);
    }
    resFn.json({ success: true, count: items.length });
  } catch (err) {
    resFn.status(500).json({ message: "خطأ" });
  }
});

router.patch("/admin/sections/reorder", async (req: Record<string, unknown>, res: Record<string, unknown>) => {
  if (!(await requireAdmin(req, res))) return;
  const r = req as Record<string, Record<string, unknown>>;
  const resFn = res as { json: (d: Record<string, unknown>) => void; status: (c: number) => { json: (d: Record<string, unknown>) => void } };
  try {
    const { orders } = r.body as { orders: Array<{ id: number; sortOrder: number }> };
    for (const o of orders) {
      await db.update(sectionsTable).set({ sortOrder: o.sortOrder }).where(eq(sectionsTable.id, o.id));
    }
    resFn.json({ success: true });
  } catch (err) {
    resFn.status(500).json({ message: "خطأ" });
  }
});

export default router;
