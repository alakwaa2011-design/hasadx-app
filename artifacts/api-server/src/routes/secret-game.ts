import { Router, type IRouter } from "express";
import { db, secretGameCategoriesTable, secretGameItemsTable } from "@workspace/db";
import { eq, sql, or, and, isNull, count } from "drizzle-orm";
import { secretGameRooms, verifyRevealToken, generateRevealToken } from "../game/secret-game-handlers";

async function canAccessCategory(categoryId: number, teacherId?: number): Promise<boolean> {
  const [cat] = await db
    .select()
    .from(secretGameCategoriesTable)
    .where(eq(secretGameCategoriesTable.id, categoryId))
    .limit(1);
  if (!cat || !cat.isActive) return false;
  if (!cat.isCustom) return true;
  if (cat.isPublic) return true;
  if (teacherId && cat.teacherId === teacherId) return true;
  return false;
}

const router: IRouter = Router();

function requireTeacher(req: any, res: any): number | null {
  const teacherId = req.session?.teacherId;
  if (!teacherId) { res.status(401).json({ error: "غير مصرح" }); return null; }
  return teacherId;
}

router.get("/secret-game/categories", async (req, res) => {
  try {
    const teacherId: number | undefined = req.session?.teacherId;
    const rows = await db
      .select({
        id: secretGameCategoriesTable.id,
        nameAr: secretGameCategoriesTable.nameAr,
        icon: secretGameCategoriesTable.icon,
        sortOrder: secretGameCategoriesTable.sortOrder,
        isActive: secretGameCategoriesTable.isActive,
        createdAt: secretGameCategoriesTable.createdAt,
        itemCount: count(secretGameItemsTable.id),
        coverImageUrl: sql<string | null>`(
          SELECT image_url FROM secret_game_items
          WHERE category_id = ${secretGameCategoriesTable.id}
            AND image_url IS NOT NULL
          ORDER BY id
          LIMIT 1
        )`,
      })
      .from(secretGameCategoriesTable)
      .leftJoin(
        secretGameItemsTable,
        eq(secretGameItemsTable.categoryId, secretGameCategoriesTable.id),
      )
      .where(
        and(
          eq(secretGameCategoriesTable.isActive, true),
          or(
            eq(secretGameCategoriesTable.isCustom, false),
            eq(secretGameCategoriesTable.isPublic, true),
            teacherId
              ? eq(secretGameCategoriesTable.teacherId, teacherId)
              : isNull(secretGameCategoriesTable.teacherId),
          ),
        ),
      )
      .groupBy(secretGameCategoriesTable.id)
      .orderBy(secretGameCategoriesTable.isCustom, secretGameCategoriesTable.sortOrder);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list secret-game categories");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/categories/:id/preview", async (req, res) => {
  try {
    const categoryId = Number(req.params.id);
    if (!Number.isFinite(categoryId)) return res.status(400).json({ error: "Invalid category" });

    const [countRow] = await db
      .select({ total: count(secretGameItemsTable.id) })
      .from(secretGameItemsTable)
      .where(eq(secretGameItemsTable.categoryId, categoryId));

    const sampleRows = await db
      .select({ nameAr: secretGameItemsTable.nameAr })
      .from(secretGameItemsTable)
      .where(eq(secretGameItemsTable.categoryId, categoryId))
      .orderBy(sql`RANDOM()`)
      .limit(3);

    res.json({
      count: countRow?.total ?? 0,
      samples: sampleRows.map(r => r.nameAr),
    });
  } catch (err) {
    req.log.error({ err }, "secret-game category preview");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/items/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    if (!Number.isFinite(categoryId)) return res.status(400).json({ error: "Invalid category" });
    const teacherId: number | undefined = req.session?.teacherId;
    if (!await canAccessCategory(categoryId, teacherId)) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const rows = await db
      .select()
      .from(secretGameItemsTable)
      .where(eq(secretGameItemsTable.categoryId, categoryId));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "list secret-game items");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/items/random/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const count = Math.min(Number(req.query.count ?? 2), 20);
    if (!Number.isFinite(categoryId)) return res.status(400).json({ error: "Invalid category" });
    const teacherId: number | undefined = req.session?.teacherId;
    if (!await canAccessCategory(categoryId, teacherId)) {
      return res.status(403).json({ error: "غير مسموح" });
    }
    const rows = await db
      .select()
      .from(secretGameItemsTable)
      .where(eq(secretGameItemsTable.categoryId, categoryId))
      .orderBy(sql`RANDOM()`)
      .limit(count);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "random secret-game items");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/secret-game/custom-categories", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const { nameAr, icon, isPublic, items } = req.body ?? {};
    if (!nameAr || typeof nameAr !== "string" || !nameAr.trim()) {
      return res.status(400).json({ error: "اسم الفئة مطلوب" });
    }
    if (!Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: "يجب إضافة عنصرين على الأقل" });
    }
    const validItems = items.filter(
      (it: any) => it && typeof it.nameAr === "string" && it.nameAr.trim(),
    );
    if (validItems.length < 2) {
      return res.status(400).json({ error: "يجب إضافة عنصرين على الأقل بأسماء صحيحة" });
    }

    const [category] = await db
      .insert(secretGameCategoriesTable)
      .values({
        nameAr: nameAr.trim(),
        icon: typeof icon === "string" && icon.trim() ? icon.trim() : "📋",
        isCustom: true,
        isPublic: isPublic === true,
        teacherId,
        sortOrder: 999,
      })
      .returning();

    const itemRows = await db
      .insert(secretGameItemsTable)
      .values(
        validItems.map((it: any) => ({
          categoryId: category.id,
          nameAr: it.nameAr.trim(),
          imageUrl: typeof it.imageUrl === "string" && it.imageUrl.trim() ? it.imageUrl.trim() : null,
        })),
      )
      .returning();

    res.status(201).json({ category, items: itemRows });
  } catch (err) {
    req.log.error({ err }, "create custom secret-game category");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/secret-game/custom-categories/:id", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const categoryId = Number(req.params.id);
    if (!Number.isFinite(categoryId)) return res.status(400).json({ error: "Invalid id" });

    const [existing] = await db
      .select()
      .from(secretGameCategoriesTable)
      .where(eq(secretGameCategoriesTable.id, categoryId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "الفئة غير موجودة" });
    if (!existing.isCustom || existing.teacherId !== teacherId) {
      return res.status(403).json({ error: "غير مسموح بتعديل هذه الفئة" });
    }

    const { nameAr, icon, isPublic, items } = req.body ?? {};

    const updates: Partial<typeof secretGameCategoriesTable.$inferInsert> = {};
    if (typeof nameAr === "string" && nameAr.trim()) updates.nameAr = nameAr.trim();
    if (typeof icon === "string" && icon.trim()) updates.icon = icon.trim();
    if (typeof isPublic === "boolean") updates.isPublic = isPublic;

    if (Object.keys(updates).length > 0) {
      await db
        .update(secretGameCategoriesTable)
        .set(updates)
        .where(eq(secretGameCategoriesTable.id, categoryId));
    }

    if (Array.isArray(items)) {
      const validItems = items.filter(
        (it: any) => it && typeof it.nameAr === "string" && it.nameAr.trim(),
      );
      if (validItems.length >= 2) {
        await db.delete(secretGameItemsTable).where(eq(secretGameItemsTable.categoryId, categoryId));
        await db.insert(secretGameItemsTable).values(
          validItems.map((it: any) => ({
            categoryId,
            nameAr: it.nameAr.trim(),
            imageUrl: typeof it.imageUrl === "string" && it.imageUrl.trim() ? it.imageUrl.trim() : null,
          })),
        );
      }
    }

    const [updated] = await db
      .select()
      .from(secretGameCategoriesTable)
      .where(eq(secretGameCategoriesTable.id, categoryId));
    const updatedItems = await db
      .select()
      .from(secretGameItemsTable)
      .where(eq(secretGameItemsTable.categoryId, categoryId));

    res.json({ category: updated, items: updatedItems });
  } catch (err) {
    req.log.error({ err }, "update custom secret-game category");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/secret-game/custom-categories/:id", async (req, res) => {
  try {
    const teacherId = requireTeacher(req, res);
    if (!teacherId) return;

    const categoryId = Number(req.params.id);
    if (!Number.isFinite(categoryId)) return res.status(400).json({ error: "Invalid id" });

    const [existing] = await db
      .select()
      .from(secretGameCategoriesTable)
      .where(eq(secretGameCategoriesTable.id, categoryId))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "الفئة غير موجودة" });
    if (!existing.isCustom || existing.teacherId !== teacherId) {
      return res.status(403).json({ error: "غير مسموح بحذف هذه الفئة" });
    }

    await db.delete(secretGameCategoriesTable).where(eq(secretGameCategoriesTable.id, categoryId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete custom secret-game category");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/secret-game/reveal-token", (req, res) => {
  try {
    const pin = (req.body?.pin as string | undefined)?.toUpperCase();
    const team = req.body?.team as string | undefined;
    if (!pin || !team) return res.status(400).json({ error: "pin and team required" });
    if (team !== "A" && team !== "B") return res.status(400).json({ error: "team must be A or B" });
    const room = secretGameRooms.get(pin);
    if (!room) return res.status(404).json({ error: "الجلسة غير موجودة أو انتهت" });
    if (room.phase === "ended") return res.status(410).json({ error: "اللعبة انتهت" });
    const token = generateRevealToken(pin, team, room.teams[team].secretId);
    res.json({ token });
  } catch (err) {
    req.log.error({ err }, "secret-game reveal-token");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/join", (req, res) => {
  try {
    const pin = (req.query.pin as string | undefined)?.toUpperCase();
    const team = req.query.team as string | undefined;
    if (!pin || !team) return res.status(400).json({ error: "pin and team required" });
    if (team !== "A" && team !== "B") return res.status(400).json({ error: "team must be A or B" });
    const room = secretGameRooms.get(pin);
    if (!room) return res.status(404).json({ error: "الجلسة غير موجودة أو انتهت" });
    if (room.phase === "ended") return res.status(410).json({ error: "اللعبة انتهت" });
    const token = generateRevealToken(pin, team, room.teams[team].secretId);
    res.json({
      token,
      teamName: room.teams[team].name,
      teamColor: room.teams[team].color,
      opponentName: room.teams[team === "A" ? "B" : "A"].name,
      phase: room.phase,
    });
  } catch (err) {
    req.log.error({ err }, "secret-game join");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/secret-game/reveal/:token", (req, res) => {
  try {
    const { token } = req.params;
    const decoded = verifyRevealToken(token);
    if (!decoded) return res.status(401).json({ error: "رمز غير صالح أو منتهي الصلاحية" });

    const room = secretGameRooms.get(decoded.pin.toUpperCase());
    if (!room) return res.status(404).json({ error: "الجلسة غير موجودة" });

    const teamState = room.teams[decoded.team];
    if (teamState.secretId !== decoded.itemId) return res.status(401).json({ error: "رمز غير مطابق" });

    res.json({
      team: decoded.team,
      teamName: teamState.name,
      teamColor: teamState.color,
      secret: {
        id: teamState.secretId,
        name: teamState.secretName,
        image: teamState.secretImage,
      },
      categoryId: room.categoryId,
      pin: decoded.pin,
    });
  } catch (err) {
    req.log.error({ err }, "secret-game reveal");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/image-proxy", async (req, res) => {
  try {
    const url = req.query.url as string | undefined;
    if (!url) return res.status(400).end();
    const parsed = new URL(url);
    const allowed = ["upload.wikimedia.org", "commons.wikimedia.org", "en.wikipedia.org", "ar.wikipedia.org"];
    if (!allowed.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
      return res.status(403).end();
    }

    let fetchUrl = url;
    if (parsed.hostname === "upload.wikimedia.org" && parsed.pathname.includes("/thumb/")) {
      fetchUrl = url
        .replace(/\/thumb\//, "/")
        .replace(/\/[^/]+$/, "");
    }

    const imgRes = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Referer": "https://en.wikipedia.org/",
        "Accept": "image/*,*/*;q=0.8",
      },
    });
    if (!imgRes.ok) return res.status(imgRes.status).end();
    const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buf = await imgRes.arrayBuffer();
    res.end(Buffer.from(buf));
  } catch {
    res.status(500).end();
  }
});

export default router;
