import { Router } from "express";
import { db, notificationsTable, teachersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

interface MaraquiStageQuestion {
  text: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
}

interface MaraquiStage {
  num: number;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  questions: MaraquiStageQuestion[];
}

function validateStages(stages: unknown): stages is MaraquiStage[] {
  if (!Array.isArray(stages) || stages.length === 0 || stages.length > 10) return false;
  for (const stage of stages) {
    if (typeof stage !== "object" || stage === null) return false;
    const s = stage as Record<string, unknown>;
    if (typeof s.num !== "number") return false;
    if (typeof s.name !== "string" || s.name.trim().length === 0) return false;
    if (!["easy", "medium", "hard"].includes(s.difficulty as string)) return false;
    if (!Array.isArray(s.questions) || s.questions.length === 0 || s.questions.length > 20) return false;
    for (const q of s.questions) {
      if (typeof q !== "object" || q === null) return false;
      const qObj = q as Record<string, unknown>;
      if (typeof qObj.text !== "string" || qObj.text.trim().length === 0) return false;
      if (!Array.isArray(qObj.options) || qObj.options.length !== 4) return false;
      for (const opt of qObj.options) {
        if (typeof opt !== "string" || opt.trim().length === 0) return false;
      }
      if (typeof qObj.correct !== "number" || ![0, 1, 2, 3].includes(qObj.correct)) return false;
    }
  }
  return true;
}

async function isTeacherAdmin(teacherId: number): Promise<boolean> {
  const r = await db.execute(sql`SELECT is_admin FROM teachers WHERE id = ${teacherId} LIMIT 1`);
  const t = r.rows[0] as Record<string, unknown> | undefined;
  return !!t?.is_admin;
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Public paths ──────────────────────────────────────────────────────────────

router.get("/maraqui-paths/public", async (_req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT id, title, description, pin, stages, creator_id, creator_type, is_public, is_approved, group_id, created_at
          FROM maraqui_paths
          WHERE (creator_type = 'organizer' AND is_public = true)
             OR (creator_type = 'teacher' AND is_public = true AND is_approved = true)
          ORDER BY created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch public paths" });
  }
});

// ── Pending approval (admin only) ──────────────────────────────────────────

router.get("/maraqui-paths/pending", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    if (!await isTeacherAdmin(req.session.teacherId)) return res.status(403).json({ error: "Admin only" });
    const result = await db.execute(
      sql`SELECT mp.*, t.name as creator_name FROM maraqui_paths mp
          LEFT JOIN teachers t ON t.id = mp.creator_id
          WHERE mp.is_public = true AND mp.is_approved = false
          ORDER BY mp.created_at DESC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch pending paths" });
  }
});

// ── All paths for teacher (admin sees all; regular teacher sees own only) ───

router.get("/maraqui-paths", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const isAdmin = await isTeacherAdmin(req.session.teacherId);
    const result = isAdmin
      ? await db.execute(
          sql`SELECT mp.*, t.name as creator_name, mg.name as group_name
              FROM maraqui_paths mp
              LEFT JOIN teachers t ON t.id = mp.creator_id
              LEFT JOIN maraqui_groups mg ON mg.id = mp.group_id
              ORDER BY mp.created_at DESC LIMIT 200`
        )
      : await db.execute(
          sql`SELECT mp.*, t.name as creator_name, mg.name as group_name
              FROM maraqui_paths mp
              LEFT JOIN teachers t ON t.id = mp.creator_id
              LEFT JOIN maraqui_groups mg ON mg.id = mp.group_id
              WHERE mp.creator_id = ${req.session.teacherId}
              ORDER BY mp.created_at DESC LIMIT 200`
        );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch paths" });
  }
});

// ── Get path by ID (for editing — teacher auth) ────────────────────────────

router.get("/maraqui-path-by-id/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const result = await db.execute(sql`SELECT * FROM maraqui_paths WHERE id = ${id} LIMIT 1`);
    if (!result.rows[0]) return res.status(404).json({ error: "Path not found" });
    const isAdmin = await isTeacherAdmin(req.session.teacherId);
    if (!isAdmin && result.rows[0].creator_id !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized to view this path" });
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch path" });
  }
});

// ── Get single path by PIN ─────────────────────────────────────────────────

router.get("/maraqui-paths/:pin", async (req, res) => {
  try {
    const { pin } = req.params;
    const result = await db.execute(
      sql`SELECT * FROM maraqui_paths WHERE pin = ${pin} LIMIT 1`
    );
    const path = result.rows[0];
    if (!path) return res.status(404).json({ error: "Path not found" });
    res.json(path);
  } catch {
    res.status(500).json({ error: "Failed to fetch path" });
  }
});

// ── Create path ────────────────────────────────────────────────────────────

router.post("/maraqui-paths", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const { title, description, stages, isPublic } = req.body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "Title required" });
    }
    if (!validateStages(stages)) {
      return res.status(400).json({ error: "Invalid stages" });
    }
    const isPublicBool = isPublic === true;
    const isAdmin = await isTeacherAdmin(req.session.teacherId);
    const isApproved = isAdmin ? isPublicBool : false;
    const creatorType = isAdmin ? "organizer" : "teacher";
    let row: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const pin = generatePin();
      try {
        const result = await db.execute(
          sql`INSERT INTO maraqui_paths (title, description, pin, stages, creator_id, creator_type, is_public, is_approved)
              VALUES (${title.trim().slice(0, 100)}, ${description?.trim().slice(0, 300) || null}, ${pin},
                      ${JSON.stringify(stages)}::jsonb, ${req.session.teacherId}, ${creatorType}, ${isPublicBool}, ${isApproved})
              RETURNING *`
        );
        row = result.rows[0] as Record<string, unknown>;
        break;
      } catch (e: unknown) {
        if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505" && attempt < 4) continue;
        throw e;
      }
    }
    res.json(row);

    // Notify admins when a regular teacher requests public listing
    if (!isAdmin && isPublicBool && row) {
      try {
        const creatorResult = await db.execute(sql`SELECT name FROM teachers WHERE id = ${req.session.teacherId} LIMIT 1`);
        const creatorName = (creatorResult.rows[0] as Record<string, unknown>)?.name ?? "معلم";
        const admins = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.isAdmin, true));
        if (admins.length > 0) {
          await db.insert(notificationsTable).values(
            admins.map(admin => ({
              teacherId: admin.id,
              type: "maraqui_approval",
              title: `طلب نشر مسار مراقي`,
              body: `${creatorName} يطلب الموافقة على نشر مسار "${title.trim().slice(0, 50)}"`,
            }))
          );
        }
      } catch {
        // notification failure is non-critical
      }
    }
  } catch {
    res.status(500).json({ error: "Failed to create path" });
  }
});

// ── Edit path (any logged-in teacher or admin) ─────────────────────────────

router.put("/maraqui-paths/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const { title, description, stages, isPublic } = req.body;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({ error: "Title required" });
    }
    if (!validateStages(stages)) {
      return res.status(400).json({ error: "Invalid stages" });
    }

    const pathCheck = await db.execute(sql`SELECT id, creator_id FROM maraqui_paths WHERE id = ${id} LIMIT 1`);
    if (!pathCheck.rows[0]) return res.status(404).json({ error: "Path not found" });

    const isAdmin = await isTeacherAdmin(req.session.teacherId);
    if (!isAdmin && pathCheck.rows[0].creator_id !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized to edit this path" });
    }

    const isPublicBool = isPublic === true;
    const isApproved = isAdmin ? isPublicBool : false;

    const result = await db.execute(
      sql`UPDATE maraqui_paths
          SET title = ${title.trim().slice(0, 100)},
              description = ${description?.trim().slice(0, 300) || null},
              stages = ${JSON.stringify(stages)}::jsonb,
              is_public = ${isPublicBool},
              is_approved = CASE WHEN ${isAdmin} THEN ${isApproved} ELSE is_approved END
          WHERE id = ${id}
          RETURNING *`
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update path" });
  }
});

// ── Approve path (admin only) ──────────────────────────────────────────────

router.patch("/maraqui-paths/:id/approve", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    if (!await isTeacherAdmin(req.session.teacherId)) return res.status(403).json({ error: "Admin only" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { approved } = req.body;
    const isApproved = approved === true;
    const result = await db.execute(
      sql`UPDATE maraqui_paths
          SET is_approved = ${isApproved}, is_public = CASE WHEN ${isApproved} THEN is_public ELSE false END
          WHERE id = ${id} RETURNING *`
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Path not found" });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update path" });
  }
});

// ── Assign path to group ───────────────────────────────────────────────────

router.patch("/maraqui-paths/:id/group", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const ownerCheck = await db.execute(sql`SELECT creator_id FROM maraqui_paths WHERE id = ${id} LIMIT 1`);
    if (!ownerCheck.rows[0]) return res.status(404).json({ error: "Path not found" });
    const isAdmin = await isTeacherAdmin(req.session.teacherId);
    if (!isAdmin && ownerCheck.rows[0].creator_id !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { groupId } = req.body;
    const groupIdVal = groupId === null || groupId === undefined ? null : parseInt(String(groupId), 10);

    if (groupIdVal !== null && isNaN(groupIdVal)) return res.status(400).json({ error: "Invalid groupId" });

    const result = await db.execute(
      sql`UPDATE maraqui_paths SET group_id = ${groupIdVal} WHERE id = ${id} RETURNING *`
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Path not found" });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update group" });
  }
});

// ── Delete path ────────────────────────────────────────────────────────────

router.delete("/maraqui-paths/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = await db.execute(sql`SELECT creator_id FROM maraqui_paths WHERE id = ${id} LIMIT 1`);
    if (!existing.rows[0]) return res.status(404).json({ error: "Path not found" });
    const isAdmin = await isTeacherAdmin(req.session.teacherId);
    if (!isAdmin && existing.rows[0].creator_id !== req.session.teacherId) {
      return res.status(403).json({ error: "Not authorized to delete this path" });
    }
    await db.execute(sql`DELETE FROM maraqui_paths WHERE id = ${id}`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete path" });
  }
});

// ── Groups CRUD ────────────────────────────────────────────────────────────

router.get("/maraqui-groups", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const result = await db.execute(
      sql`SELECT mg.*, COUNT(mp.id)::int as path_count
          FROM maraqui_groups mg
          LEFT JOIN maraqui_paths mp ON mp.group_id = mg.id
          WHERE mg.teacher_id = ${req.session.teacherId}
          GROUP BY mg.id
          ORDER BY mg.created_at ASC`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

router.post("/maraqui-groups", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Group name required" });
    }
    const result = await db.execute(
      sql`INSERT INTO maraqui_groups (name, teacher_id) VALUES (${name.trim().slice(0, 60)}, ${req.session.teacherId}) RETURNING *`
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to create group" });
  }
});

router.put("/maraqui-groups/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { name } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Name required" });
    }
    const result = await db.execute(
      sql`UPDATE maraqui_groups SET name = ${name.trim().slice(0, 60)} WHERE id = ${id} AND teacher_id = ${req.session.teacherId} RETURNING *`
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Group not found" });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to update group" });
  }
});

router.delete("/maraqui-groups/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) return res.status(401).json({ error: "Authentication required" });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await db.execute(sql`UPDATE maraqui_paths SET group_id = NULL WHERE group_id = ${id}`);
    await db.execute(sql`DELETE FROM maraqui_groups WHERE id = ${id} AND teacher_id = ${req.session.teacherId}`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete group" });
  }
});

// ── Progress ───────────────────────────────────────────────────────────────

router.post("/maraqui-progress", async (req, res) => {
  try {
    const { pathId, playerName, completedStages, attempts } = req.body;
    if (!pathId || typeof pathId !== "number") return res.status(400).json({ error: "pathId required" });
    if (!playerName || typeof playerName !== "string" || playerName.trim().length === 0) {
      return res.status(400).json({ error: "playerName required" });
    }
    const newCompleted = typeof completedStages === "number" ? Math.max(0, completedStages) : 0;
    const newAttempts = typeof attempts === "number" ? Math.max(1, attempts) : 1;

    const pathResult = await db.execute(sql`SELECT id, stages FROM maraqui_paths WHERE id = ${pathId} LIMIT 1`);
    const pathRow = pathResult.rows[0] as Record<string, unknown> | undefined;
    if (!pathRow) return res.status(404).json({ error: "Path not found" });
    const stages = Array.isArray(pathRow.stages) ? pathRow.stages : [];
    const totalStages = stages.length;

    const studentAccountId = req.session.studentAccountId || null;
    const normalizedName = (playerName as string).trim().slice(0, 50);
    const existing = await db.execute(
      studentAccountId
        ? sql`SELECT id, completed_stages, attempts, completed_at FROM maraqui_progress
              WHERE path_id = ${pathId} AND student_account_id = ${studentAccountId} LIMIT 1`
        : sql`SELECT id, completed_stages, attempts, completed_at FROM maraqui_progress
              WHERE path_id = ${pathId} AND player_name = ${normalizedName} AND student_account_id IS NULL LIMIT 1`
    );

    let row: Record<string, unknown>;
    if (existing.rows[0]) {
      const prev = existing.rows[0] as Record<string, unknown>;
      const prevCompleted = typeof prev.completed_stages === "number" ? prev.completed_stages : 0;
      const prevAttempts = typeof prev.attempts === "number" ? prev.attempts : 1;
      const safeCompleted = Math.min(newCompleted, prevCompleted + 1);
      const safeAttempts = Math.max(prevAttempts, newAttempts);
      const complete = safeCompleted >= totalStages && totalStages > 0;
      const completedAt = complete && !prev.completed_at ? new Date().toISOString() : (prev.completed_at as string | null);
      const result = await db.execute(
        sql`UPDATE maraqui_progress SET completed_stages = ${safeCompleted}, attempts = ${safeAttempts},
            is_complete = ${complete}, completed_at = ${completedAt}, student_account_id = ${studentAccountId},
            updated_at = NOW() WHERE id = ${prev.id} RETURNING *`
      );
      row = result.rows[0] as Record<string, unknown>;
    } else {
      const safeCompleted = Math.min(newCompleted, 1);
      const complete = safeCompleted >= totalStages && totalStages > 0;
      const completedAt = complete ? new Date().toISOString() : null;
      const result = await db.execute(
        sql`INSERT INTO maraqui_progress (path_id, player_name, student_account_id, completed_stages, attempts, is_complete, completed_at)
            VALUES (${pathId}, ${normalizedName}, ${studentAccountId}, ${safeCompleted}, ${newAttempts}, ${complete}, ${completedAt})
            RETURNING *`
      );
      row = result.rows[0] as Record<string, unknown>;
    }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to save progress" });
  }
});

router.get("/maraqui-progress/:pathId", async (req, res) => {
  try {
    const pathId = parseInt(req.params.pathId, 10);
    if (isNaN(pathId)) return res.status(400).json({ error: "Invalid pathId" });
    const result = await db.execute(
      sql`SELECT * FROM maraqui_progress WHERE path_id = ${pathId}
          ORDER BY is_complete DESC, attempts ASC, completed_at ASC LIMIT 100`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

router.get("/maraqui-progress-me/:pathId", async (req, res) => {
  try {
    const pathId = parseInt(req.params.pathId, 10);
    if (isNaN(pathId)) return res.status(400).json({ error: "Invalid pathId" });
    const { playerName } = req.query;
    if (!playerName || typeof playerName !== "string") return res.status(400).json({ error: "playerName required" });
    const studentAccountId = req.session.studentAccountId || null;
    const result = await db.execute(
      studentAccountId
        ? sql`SELECT * FROM maraqui_progress WHERE path_id = ${pathId} AND student_account_id = ${studentAccountId} LIMIT 1`
        : sql`SELECT * FROM maraqui_progress WHERE path_id = ${pathId} AND player_name = ${playerName} AND student_account_id IS NULL LIMIT 1`
    );
    res.json(result.rows[0] || null);
  } catch {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

export default router;
