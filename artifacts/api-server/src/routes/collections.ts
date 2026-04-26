import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { contentCollectionsTable, collectionItemsTable, assignmentsTable, teachersTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.teacherId) return res.status(401).json({ message: "غير مصرح" });
  next();
}

/** Verify collection belongs to current teacher. Returns null if not found/unauthorized. */
async function getOwnedCollection(collectionId: number, teacherId: number) {
  const [col] = await db
    .select()
    .from(contentCollectionsTable)
    .where(and(eq(contentCollectionsTable.id, collectionId), eq(contentCollectionsTable.teacherId, teacherId)));
  return col || null;
}

/* ── GET /collections ─────────────────────────── list my collections with item counts + assignment IDs */
router.get("/collections", requireAuth, async (req: any, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const teacherId = req.session.teacherId;
    const cols = await db
      .select({
        id: contentCollectionsTable.id,
        name: contentCollectionsTable.name,
        description: contentCollectionsTable.description,
        coverImageUrl: contentCollectionsTable.coverImageUrl,
        isPublic: contentCollectionsTable.isPublic,
        featuredOn: contentCollectionsTable.featuredOn,
        createdAt: contentCollectionsTable.createdAt,
        itemCount: sql<number>`(SELECT COUNT(*) FROM collection_items WHERE collection_items.collection_id = ${contentCollectionsTable.id})::int`,
        assignmentIds: sql<number[]>`COALESCE((SELECT json_agg(ci.assignment_id) FROM collection_items ci WHERE ci.collection_id = ${contentCollectionsTable.id} AND ci.assignment_id IS NOT NULL), '[]')`,
      })
      .from(contentCollectionsTable)
      .where(eq(contentCollectionsTable.teacherId, teacherId))
      .orderBy(contentCollectionsTable.createdAt);
    res.json(cols);
  } catch (err) {
    req.log.error(err, "List collections error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── POST /collections ──────────────────────────── create collection */
router.post("/collections", requireAuth, async (req: any, res) => {
  try {
    const { name, description, coverImageUrl } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "الاسم مطلوب" });
    const [col] = await db
      .insert(contentCollectionsTable)
      .values({
        teacherId: req.session.teacherId,
        name: name.trim(),
        description: description?.trim() || null,
        coverImageUrl: coverImageUrl?.trim() || null,
      })
      .returning();
    res.json(col);
  } catch (err) {
    req.log.error(err, "Create collection error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── PUT /collections/:id ──────────────────────── update collection */
router.put("/collections/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, coverImageUrl } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "الاسم مطلوب" });
    const updateData: any = {
      name: name.trim(),
      description: description?.trim() || null,
    };
    if (coverImageUrl !== undefined) {
      updateData.coverImageUrl = coverImageUrl?.trim() || null;
    }
    const [col] = await db
      .update(contentCollectionsTable)
      .set(updateData)
      .where(and(eq(contentCollectionsTable.id, id), eq(contentCollectionsTable.teacherId, req.session.teacherId)))
      .returning();
    if (!col) return res.status(404).json({ message: "غير موجود" });
    res.json(col);
  } catch (err) {
    req.log.error(err, "Update collection error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── PATCH /collections/:id/quick-edit ───────── update name + cover only (used by 3-dot menu) */
router.patch("/collections/:id/quick-edit", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, coverImageUrl } = req.body;
    const updateData: any = {};
    if (typeof name === "string" && name.trim()) updateData.name = name.trim();
    if (coverImageUrl !== undefined) updateData.coverImageUrl = coverImageUrl?.trim() || null;
    if (Object.keys(updateData).length === 0) return res.status(400).json({ message: "لا تغييرات" });
    const [col] = await db
      .update(contentCollectionsTable)
      .set(updateData)
      .where(and(eq(contentCollectionsTable.id, id), eq(contentCollectionsTable.teacherId, req.session.teacherId)))
      .returning();
    if (!col) return res.status(404).json({ message: "غير موجود" });
    res.json(col);
  } catch (err) {
    req.log.error(err, "Update collection error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── DELETE /collections/:id ──────────────────── delete collection */
router.delete("/collections/:id", requireAuth, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .delete(contentCollectionsTable)
      .where(and(eq(contentCollectionsTable.id, id), eq(contentCollectionsTable.teacherId, req.session.teacherId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Delete collection error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── GET /collections/:id ─────────────────────── get collection with items */
router.get("/collections/:id", requireAuth, async (req: any, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const colId = parseInt(req.params.id);
    const col = await getOwnedCollection(colId, req.session.teacherId);
    if (!col) return res.status(404).json({ message: "غير موجود" });

    const items = await db
      .select()
      .from(collectionItemsTable)
      .where(eq(collectionItemsTable.collectionId, colId))
      .orderBy(asc(collectionItemsTable.itemOrder));

    const enriched = await Promise.all(items.map(async (item) => {
      let detail: any = null;
      if (item.assignmentId) {
        const [a] = await db.select({ id: assignmentsTable.id, title: assignmentsTable.title, subject: assignmentsTable.subject })
          .from(assignmentsTable).where(eq(assignmentsTable.id, item.assignmentId));
        detail = a ? { type: "assignment", ...a } : null;
      }
      return { ...item, detail };
    }));

    res.json({ collection: col, items: enriched });
  } catch (err) {
    req.log.error(err, "Get collection error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── GET /collections/:id/items ─────────────── alias for convenience */
router.get("/collections/:id/items", requireAuth, async (req: any, res) => {
  res.set("Cache-Control", "no-store");
  const colId = parseInt(req.params.id);
  const col = await getOwnedCollection(colId, req.session.teacherId);
  if (!col) return res.status(404).json({ message: "غير موجود" });

  const items = await db
    .select()
    .from(collectionItemsTable)
    .where(eq(collectionItemsTable.collectionId, colId))
    .orderBy(asc(collectionItemsTable.itemOrder));

  const enriched = await Promise.all(items.map(async (item) => {
    let detail: any = null;
    if (item.assignmentId) {
      const [a] = await db.select({ id: assignmentsTable.id, title: assignmentsTable.title, subject: assignmentsTable.subject })
        .from(assignmentsTable).where(eq(assignmentsTable.id, item.assignmentId));
      detail = a ? { type: "assignment", ...a } : null;
    }
    return { ...item, detail };
  }));

  res.json({ collection: col, items: enriched });
});

/* ── POST /collections/:id/items ─────────────── add item (only teacher-owned content) */
router.post("/collections/:id/items", requireAuth, async (req: any, res) => {
  try {
    const colId = parseInt(req.params.id);
    const col = await getOwnedCollection(colId, req.session.teacherId);
    if (!col) return res.status(404).json({ message: "غير موجود" });

    const { assignmentId, itemOrder } = req.body;

    if (!assignmentId) {
      return res.status(400).json({ message: "يجب تحديد واجب" });
    }

    // Verify the assignment belongs to this teacher
    const [a] = await db.select({ id: assignmentsTable.id })
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, assignmentId), eq(assignmentsTable.teacherId, req.session.teacherId)));
    if (!a) return res.status(403).json({ message: "الواجب لا ينتمي إليك" });

    // Check for duplicate
    const [existing] = await db
      .select({ id: collectionItemsTable.id })
      .from(collectionItemsTable)
      .where(and(eq(collectionItemsTable.collectionId, colId), eq(collectionItemsTable.assignmentId, assignmentId)));
    if (existing) return res.json(existing);

    const [item] = await db
      .insert(collectionItemsTable)
      .values({
        collectionId: colId,
        assignmentId: assignmentId,
        itemOrder: itemOrder ?? 0,
      })
      .returning();
    res.json(item);
  } catch (err) {
    req.log.error(err, "Add collection item error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── DELETE /collections/:id/items/:itemId ────── remove item (ownership check) */
router.delete("/collections/:id/items/:itemId", requireAuth, async (req: any, res) => {
  try {
    const colId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);

    // Verify the collection belongs to this teacher
    const col = await getOwnedCollection(colId, req.session.teacherId);
    if (!col) return res.status(404).json({ message: "المجموعة غير موجودة" });

    // Verify the item belongs to this collection
    const [item] = await db
      .select({ id: collectionItemsTable.id })
      .from(collectionItemsTable)
      .where(and(eq(collectionItemsTable.id, itemId), eq(collectionItemsTable.collectionId, colId)));
    if (!item) return res.status(404).json({ message: "العنصر غير موجود في هذه المجموعة" });

    await db.delete(collectionItemsTable).where(eq(collectionItemsTable.id, itemId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Remove collection item error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── PATCH /collections/:id/reorder ──────────── reorder items */
router.patch("/collections/:id/reorder", requireAuth, async (req: any, res) => {
  try {
    const colId = parseInt(req.params.id);
    const col = await getOwnedCollection(colId, req.session.teacherId);
    if (!col) return res.status(404).json({ message: "غير موجود" });

    const { itemIds } = req.body;
    if (!Array.isArray(itemIds)) return res.status(400).json({ message: "itemIds مطلوب" });

    await Promise.all(
      itemIds.map((id: number, idx: number) =>
        db.update(collectionItemsTable)
          .set({ itemOrder: idx })
          .where(and(eq(collectionItemsTable.id, id), eq(collectionItemsTable.collectionId, colId)))
      )
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Reorder collection items error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── PATCH /collections/:id/visibility ────────── ADMIN: set public + featuredOn */
router.patch("/collections/:id/visibility", requireAuth, async (req: any, res) => {
  try {
    const [me] = await db.select({ isAdmin: teachersTable.isAdmin })
      .from(teachersTable).where(eq(teachersTable.id, req.session.teacherId));
    if (!me?.isAdmin) return res.status(403).json({ message: "صلاحيات المسؤول مطلوبة" });

    const id = parseInt(req.params.id);
    const { isPublic, featuredOn } = req.body;
    const ALLOWED_PLACEMENTS = ["home", "assignments"];
    const updateData: any = {};
    if (typeof isPublic === "boolean") updateData.isPublic = isPublic;
    if (featuredOn === null || featuredOn === "") {
      updateData.featuredOn = null;
    } else if (typeof featuredOn === "string") {
      if (!ALLOWED_PLACEMENTS.includes(featuredOn)) {
        return res.status(400).json({ message: "قيمة غير صالحة" });
      }
      updateData.featuredOn = featuredOn;
    }
    if (Object.keys(updateData).length === 0) return res.status(400).json({ message: "لا تغييرات" });

    const [col] = await db.update(contentCollectionsTable)
      .set(updateData)
      .where(eq(contentCollectionsTable.id, id))
      .returning();
    if (!col) return res.status(404).json({ message: "غير موجود" });
    res.json(col);
  } catch (err) {
    req.log.error(err, "Visibility update error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── GET /public/featured-collections ─────────── public: list featured collections */
router.get("/public/featured-collections", async (req: any, res) => {
  try {
    const placement = (req.query.placement as string) || null;
    const where = placement
      ? and(eq(contentCollectionsTable.isPublic, true), eq(contentCollectionsTable.featuredOn, placement))
      : eq(contentCollectionsTable.isPublic, true);
    const cols = await db.select({
      id: contentCollectionsTable.id,
      name: contentCollectionsTable.name,
      description: contentCollectionsTable.description,
      coverImageUrl: contentCollectionsTable.coverImageUrl,
      featuredOn: contentCollectionsTable.featuredOn,
      itemCount: sql<number>`(SELECT COUNT(*) FROM collection_items WHERE collection_items.collection_id = ${contentCollectionsTable.id})::int`,
    })
      .from(contentCollectionsTable)
      .where(where)
      .orderBy(asc(contentCollectionsTable.createdAt));
    res.json(cols);
  } catch (err) {
    req.log.error(err, "Featured collections error");
    res.status(500).json({ message: "خطأ" });
  }
});

export default router;
