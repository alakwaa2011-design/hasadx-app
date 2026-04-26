import { Router } from "express";
import { db, letrlyPuzzlesTable, teachersTable } from "@workspace/db";
import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";

// Sentinel row used to persist Letrly game options inside the existing
// letrly_puzzles table (no new schema). It is excluded from all bank /
// random queries via category != OPTIONS_CATEGORY.
const OPTIONS_CATEGORY = "__settings__";
const OPTIONS_WORD = "__OPTIONS__";

const router = Router();

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
function normalizeArabic(text: string): string {
  return text
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/\s+/g, "")
    .trim();
}

const VALID_CATEGORIES = new Set(["general", "animals", "fruits", "cities", "science", "islamic"]);

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function isAdmin(req: any): Promise<boolean> {
  if (!req.session?.teacherId) return false;
  const [teacher] = await db
    .select({ isAdmin: teachersTable.isAdmin })
    .from(teachersTable)
    .where(eq(teachersTable.id, req.session.teacherId))
    .limit(1);
  return !!teacher?.isAdmin;
}

function validatePuzzleInput(body: any): { ok: true; word: string; normalized: string; hint: string; length: number; category: string } | { ok: false; error: string } {
  const rawWord = typeof body?.word === "string" ? body.word.trim() : "";
  const hint = typeof body?.hint === "string" ? body.hint.trim().slice(0, 200) : "";
  const category = typeof body?.category === "string" && VALID_CATEGORIES.has(body.category) ? body.category : "general";
  if (!rawWord) return { ok: false, error: "الكلمة مطلوبة" };
  if (!/^[\u0600-\u06FF\s]+$/.test(rawWord)) return { ok: false, error: "الكلمة يجب أن تكون عربية فقط" };
  const normalized = normalizeArabic(rawWord);
  if (normalized.length < 3 || normalized.length > 7) {
    return { ok: false, error: "طول الكلمة يجب أن يكون بين ٣ و٧ حروف بعد التسوية" };
  }
  return { ok: true, word: rawWord, normalized, hint, length: normalized.length, category };
}

// Teacher creates a custom puzzle for their class
router.post("/letrly/teacher/create", async (req, res) => {
  try {
    if (!req.session?.teacherId) {
      return res.status(401).json({ error: "يجب تسجيل الدخول" });
    }
    const v = validatePuzzleInput(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

    // Generate unique PIN (retry up to 5 times)
    let pin = "";
    for (let i = 0; i < 5; i++) {
      const candidate = generatePin();
      const [existing] = await db
        .select({ id: letrlyPuzzlesTable.id })
        .from(letrlyPuzzlesTable)
        .where(eq(letrlyPuzzlesTable.pin, candidate))
        .limit(1);
      if (!existing) {
        pin = candidate;
        break;
      }
    }
    if (!pin) return res.status(500).json({ error: "تعذّر توليد رمز فريد، حاول مرة أخرى" });

    const [row] = await db
      .insert(letrlyPuzzlesTable)
      .values({
        pin,
        creatorTeacherId: req.session.teacherId,
        word: v.word,
        normalized: v.normalized,
        hint: v.hint,
        length: v.length,
        category: v.category,
        isDaily: false,
      })
      .returning();
    res.json({ id: row.id, pin: row.pin });
  } catch (err) {
    console.error("[letrly] teacher/create error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Public: fetch a puzzle by PIN (used by play page when ?pin=XXX)
router.get("/letrly/puzzle/:pin", async (req, res) => {
  try {
    const pin = String(req.params.pin || "").trim();
    if (!pin) return res.status(400).json({ error: "رمز غير صالح" });
    const [row] = await db
      .select()
      .from(letrlyPuzzlesTable)
      .where(eq(letrlyPuzzlesTable.pin, pin))
      .limit(1);
    if (!row) return res.status(404).json({ error: "لم يتم العثور على اللعبة" });
    res.json({
      id: row.id,
      word: row.word,
      normalized: row.normalized,
      hint: row.hint,
      length: row.length,
      category: row.category,
      isDaily: row.isDaily,
    });
  } catch (err) {
    console.error("[letrly] puzzle/:pin error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Public: today's daily word (admin-set)
router.get("/letrly/today", async (_req, res) => {
  try {
    const today = todayUtcDate();
    const [row] = await db
      .select()
      .from(letrlyPuzzlesTable)
      .where(and(eq(letrlyPuzzlesTable.isDaily, true), eq(letrlyPuzzlesTable.dailyDate, today)))
      .limit(1);
    if (!row) return res.json({ available: false });
    res.json({
      available: true,
      id: row.id,
      word: row.word,
      normalized: row.normalized,
      hint: row.hint,
      length: row.length,
      category: row.category,
      date: row.dailyDate,
    });
  } catch (err) {
    console.error("[letrly] today error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Admin: list all upcoming + recent daily puzzles
router.get("/letrly/admin/daily", async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "صلاحيات إدارية مطلوبة" });
    const rows = await db
      .select()
      .from(letrlyPuzzlesTable)
      .where(and(eq(letrlyPuzzlesTable.isDaily, true), isNotNull(letrlyPuzzlesTable.dailyDate)))
      .orderBy(desc(letrlyPuzzlesTable.dailyDate))
      .limit(60);
    res.json(rows);
  } catch (err) {
    console.error("[letrly] admin/daily list error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Admin: set/replace the daily word for a given date
router.post("/letrly/admin/daily", async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "صلاحيات إدارية مطلوبة" });
    const dateStr = typeof req.body?.date === "string" ? req.body.date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: "تاريخ غير صالح (YYYY-MM-DD)" });
    }
    const v = validatePuzzleInput(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

    // Replace existing daily for that date
    await db
      .delete(letrlyPuzzlesTable)
      .where(and(eq(letrlyPuzzlesTable.isDaily, true), eq(letrlyPuzzlesTable.dailyDate, dateStr)));

    const [row] = await db
      .insert(letrlyPuzzlesTable)
      .values({
        creatorTeacherId: req.session?.teacherId ?? null,
        word: v.word,
        normalized: v.normalized,
        hint: v.hint,
        length: v.length,
        category: v.category,
        isDaily: true,
        dailyDate: dateStr,
      })
      .returning();
    res.json(row);
  } catch (err) {
    console.error("[letrly] admin/daily create error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Admin: delete a daily puzzle
router.delete("/letrly/admin/daily/:id", async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "صلاحيات إدارية مطلوبة" });
    await db.delete(letrlyPuzzlesTable).where(eq(letrlyPuzzlesTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    console.error("[letrly] admin/daily delete error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ===== Word Bank (admin-managed words used in solo random play) =====
// Bank rows are: isDaily=false AND creatorTeacherId IS NULL.
// (Teacher-created custom puzzles have creatorTeacherId set, so they're excluded.)

router.get("/letrly/admin/bank", async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "صلاحيات إدارية مطلوبة" });
    const rows = await db
      .select({
        id: letrlyPuzzlesTable.id,
        word: letrlyPuzzlesTable.word,
        hint: letrlyPuzzlesTable.hint,
        length: letrlyPuzzlesTable.length,
        category: letrlyPuzzlesTable.category,
        createdAt: letrlyPuzzlesTable.createdAt,
      })
      .from(letrlyPuzzlesTable)
      .where(and(
        eq(letrlyPuzzlesTable.isDaily, false),
        isNull(letrlyPuzzlesTable.creatorTeacherId),
        ne(letrlyPuzzlesTable.category, OPTIONS_CATEGORY),
      ))
      .orderBy(desc(letrlyPuzzlesTable.createdAt))
      .limit(500);
    res.json(rows);
  } catch (err) {
    console.error("[letrly] admin/bank list error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.post("/letrly/admin/bank", async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "صلاحيات إدارية مطلوبة" });
    const v = validatePuzzleInput(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const [row] = await db
      .insert(letrlyPuzzlesTable)
      .values({
        creatorTeacherId: null,
        word: v.word,
        normalized: v.normalized,
        hint: v.hint,
        length: v.length,
        category: v.category,
        isDaily: false,
      })
      .returning();
    res.json(row);
  } catch (err) {
    console.error("[letrly] admin/bank create error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.delete("/letrly/admin/bank/:id", async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "صلاحيات إدارية مطلوبة" });
    await db
      .delete(letrlyPuzzlesTable)
      .where(and(
        eq(letrlyPuzzlesTable.id, req.params.id),
        eq(letrlyPuzzlesTable.isDaily, false),
        isNull(letrlyPuzzlesTable.creatorTeacherId),
        ne(letrlyPuzzlesTable.category, OPTIONS_CATEGORY),
      ));
    res.json({ ok: true });
  } catch (err) {
    console.error("[letrly] admin/bank delete error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// ===== Game options (per-category & per-length toggles) =====

const ALL_CATEGORIES = ["general", "animals", "fruits", "cities", "science", "islamic"] as const;
const ALL_LENGTHS = [4, 5, 6] as const;

type LetrlyOptions = {
  categories: Record<string, boolean>;
  lengths: Record<string, boolean>;
};

function defaultOptions(): LetrlyOptions {
  const categories: Record<string, boolean> = {};
  for (const c of ALL_CATEGORIES) categories[c] = true;
  const lengths: Record<string, boolean> = {};
  for (const l of ALL_LENGTHS) lengths[String(l)] = true;
  return { categories, lengths };
}

function mergeOptions(parsed: any): LetrlyOptions {
  const merged: LetrlyOptions = defaultOptions();
  if (parsed && typeof parsed === "object") {
    if (parsed.categories && typeof parsed.categories === "object") {
      for (const c of ALL_CATEGORIES) {
        if (typeof parsed.categories[c] === "boolean") merged.categories[c] = parsed.categories[c];
      }
    }
    if (parsed.lengths && typeof parsed.lengths === "object") {
      for (const l of ALL_LENGTHS) {
        const k = String(l);
        if (typeof parsed.lengths[k] === "boolean") merged.lengths[k] = parsed.lengths[k];
      }
    }
  }
  return merged;
}

async function readOptions(): Promise<LetrlyOptions> {
  const [row] = await db
    .select({ hint: letrlyPuzzlesTable.hint })
    .from(letrlyPuzzlesTable)
    .where(and(eq(letrlyPuzzlesTable.category, OPTIONS_CATEGORY), eq(letrlyPuzzlesTable.word, OPTIONS_WORD)))
    .limit(1);
  if (!row?.hint) return defaultOptions();
  try {
    return mergeOptions(JSON.parse(row.hint));
  } catch {
    return defaultOptions();
  }
}

async function writeOptions(opts: LetrlyOptions): Promise<void> {
  const payload = JSON.stringify(opts);
  const [existing] = await db
    .select({ id: letrlyPuzzlesTable.id })
    .from(letrlyPuzzlesTable)
    .where(and(eq(letrlyPuzzlesTable.category, OPTIONS_CATEGORY), eq(letrlyPuzzlesTable.word, OPTIONS_WORD)))
    .limit(1);
  if (existing) {
    await db.update(letrlyPuzzlesTable).set({ hint: payload }).where(eq(letrlyPuzzlesTable.id, existing.id));
  } else {
    await db.insert(letrlyPuzzlesTable).values({
      word: OPTIONS_WORD,
      normalized: OPTIONS_WORD,
      hint: payload,
      length: 0,
      category: OPTIONS_CATEGORY,
      isDaily: false,
      creatorTeacherId: null,
    });
  }
}

router.get("/letrly/admin/options", async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "صلاحيات إدارية مطلوبة" });
    res.json(await readOptions());
  } catch (err) {
    console.error("[letrly] admin/options get error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.get("/letrly/options", async (_req, res) => {
  try {
    res.json(await readOptions());
  } catch (err) {
    console.error("[letrly] options get error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

router.put("/letrly/admin/options", async (req, res) => {
  try {
    if (!(await isAdmin(req))) return res.status(403).json({ error: "صلاحيات إدارية مطلوبة" });
    const incoming = req.body || {};
    const merged: LetrlyOptions = defaultOptions();
    if (incoming.categories && typeof incoming.categories === "object") {
      for (const c of ALL_CATEGORIES) {
        if (typeof incoming.categories[c] === "boolean") merged.categories[c] = incoming.categories[c];
      }
    }
    if (incoming.lengths && typeof incoming.lengths === "object") {
      for (const l of ALL_LENGTHS) {
        const k = String(l);
        if (typeof incoming.lengths[k] === "boolean") merged.lengths[k] = incoming.lengths[k];
      }
    }
    await writeOptions(merged);
    res.json(merged);
  } catch (err) {
    console.error("[letrly] admin/options put error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

// Public: random word from admin bank, filtered by options + category + length.
// If no bank words match, returns 204 so client can fall back to the local dictionary.
router.get("/letrly/random", async (req, res) => {
  try {
    const cat = typeof req.query.category === "string" ? req.query.category : "general";
    const len = parseInt(typeof req.query.length === "string" ? req.query.length : "5", 10);
    if (!VALID_CATEGORIES.has(cat)) return res.status(400).json({ error: "تصنيف غير صالح" });
    const allowedLengths: readonly number[] = ALL_LENGTHS;
    if (!allowedLengths.includes(len)) return res.status(400).json({ error: "طول غير صالح" });

    const opts = await readOptions();
    if (opts.categories[cat] === false || opts.lengths[String(len)] === false) {
      return res.status(403).json({ error: "هذا الخيار غير متاح حالياً" });
    }

    const rows = await db
      .select()
      .from(letrlyPuzzlesTable)
      .where(and(
        eq(letrlyPuzzlesTable.isDaily, false),
        isNull(letrlyPuzzlesTable.creatorTeacherId),
        eq(letrlyPuzzlesTable.category, cat),
        eq(letrlyPuzzlesTable.length, len),
      ))
      .orderBy(sql`random()`)
      .limit(1);
    if (rows.length === 0) return res.status(204).end();
    const row = rows[0];
    res.json({
      word: row.word,
      normalized: row.normalized,
      hint: row.hint,
      category: row.category,
      length: row.length,
    });
  } catch (err) {
    console.error("[letrly] random error", err);
    res.status(500).json({ error: "خطأ في الخادم" });
  }
});

export default router;
