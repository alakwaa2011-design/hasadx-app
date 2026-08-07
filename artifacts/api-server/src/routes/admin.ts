import { Router, type IRouter, type Request, type Response } from "express";
import { db, pool, teachersTable, studentsTable, assignmentsTable, submissionsTable, questionBankTable, platformSettingsTable, teacherStatsTable, adventureGamesTable, videoLessonsTable, tugTemplatesTable, memoryCardSetsTable, studentAccountsTable, teacherLibraryFilesTable, DEFAULT_PRESENTATION_LIMITS, DEFAULT_ARENA_IMPORT_SOURCES, presentationsTable, worksheetsTable, lessonPlansTable, soloChallengesTable, wheelTemplatesTable, rocketTemplatesTable, letrlyPuzzlesTable, contentCollectionsTable, islamicCategoriesTable, islamicQuestionsTable } from "@workspace/db";
import { eq, sql, desc, asc, and, isNotNull, inArray } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { z } from "zod";
import { invalidateTeacherXpRewardsCache } from "../lib/xp/teacher-xp-rewards-flag";

const adminObjectStorage = new ObjectStorageService();

/** JSON bodies sometimes send "false"/"0" as strings — plain Boolean("false") is true. */
function coerceBodyBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "false" || s === "0" || s === "no" || s === "off" || s === "") return false;
    if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  }
  if (typeof v === "number") return v !== 0;
  return Boolean(v);
}

/** Safe JSON body object — avoids destructuring from null; supports loose clients. */
function platformSettingsPatchBody(req: Request): Record<string, unknown> {
  const b = req.body;
  if (b != null && typeof b === "object" && !Array.isArray(b)) {
    return b as Record<string, unknown>;
  }
  return {};
}

const TeacherIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
const BlockTeacherSchema = z.object({ blocked: z.boolean() }).strict();
const AdminFlagSchema = z.object({ isAdmin: z.boolean() }).strict();
const AiTierSchema = z
  .object({ aiTier: z.enum(["standard", "pro", "claude"]) })
  .strict();
const ProDesignSchema = z.object({ hasProDesign: z.boolean() }).strict();
const PresentationsProSchema = z.object({ presentationsProEnabled: z.boolean() }).strict();
const PresentationLimitsSchema = z.object({
  maxImagesRegular: z.number().int().min(0).max(1000),
  maxFilesRegular: z.number().int().min(0).max(1000),
  maxSlidesRegular: z.number().int().min(1).max(500),
  maxSizeMbRegular: z.number().int().min(1).max(10240),
}).strict();
const ArenaImportSourcesSchema = z.object({
  manual: z.boolean(),
  ai: z.boolean(),
  homework: z.boolean(),
  file: z.boolean(),
}).strict();

const DisplayLevelOverrideSchema = z
  .object({
    displayLevelOverride: z.union([z.null(), z.number().int().min(1).max(7)]),
  })
  .strict();

const router: IRouter = Router();

router.get("/stats/public", async (req, res) => {
  try {
    const settings = await getPlatformSettings();
    if (!settings.showPublicStats) {
      return res.json({ hidden: true });
    }
    const ov = (settings.publicStatsOverride as any) ?? {};
    const [
      [{ count: teacherCountRaw }],
      [{ count: assignmentCountRaw }],
      [{ count: studentCountRaw }],
      [{ count: submissionCountRaw }],
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(teachersTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(assignmentsTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(studentsTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(submissionsTable),
    ]);
    res.json({
      hidden: false,
      teacherCount:    ov.teacherValue    != null ? Number(ov.teacherValue)    : teacherCountRaw,
      assignmentCount: ov.assignmentValue != null ? Number(ov.assignmentValue) : assignmentCountRaw,
      studentCount:    ov.studentValue    != null ? Number(ov.studentValue)    : studentCountRaw,
      submissionCount: ov.submissionValue != null ? Number(ov.submissionValue) : submissionCountRaw,
      labels: {
        teacher:    ov.teacherLabel    ?? null,
        assignment: ov.assignmentLabel ?? null,
        student:    ov.studentLabel    ?? null,
        submission: ov.submissionLabel ?? null,
      },
      notes: {
        teacher:    ov.teacherNote    ?? null,
        assignment: ov.assignmentNote ?? null,
        student:    ov.studentNote    ?? null,
        submission: ov.submissionNote ?? null,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to get public stats");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

async function requireAdmin(req: any, res: any): Promise<boolean> {
  if (!req.session.teacherId) {
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

router.get("/admin/teachers", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const teachers = await db
      .select({
        id: teachersTable.id,
        name: teachersTable.name,
        email: teachersTable.email,
        phone: teachersTable.phone,
        isAdmin: teachersTable.isAdmin,
        isBlocked: teachersTable.isBlocked,
        aiTier: teachersTable.aiTier,
        hasProDesign: teachersTable.hasProDesign,
        presentationsProEnabled: teachersTable.presentationsProEnabled,
        lastLoginAt: teachersTable.lastLoginAt,
        createdAt: teachersTable.createdAt,
        assignmentCount: sql<number>`(SELECT COUNT(*) FROM assignments WHERE assignments.teacher_id = teachers.id)::int`,
        submissionCount: sql<number>`(SELECT COUNT(*) FROM submissions s JOIN assignments a ON s.assignment_id = a.id WHERE a.teacher_id = teachers.id)::int`,
        studentCount: sql<number>`(SELECT COUNT(*) FROM students WHERE students.teacher_id = teachers.id)::int`,
        questionCount: sql<number>`(SELECT COUNT(*) FROM question_bank WHERE question_bank.teacher_id = teachers.id)::int`,
        soloChallengeCount: sql<number>`(SELECT COUNT(*) FROM solo_challenges WHERE solo_challenges.teacher_id = teachers.id)::int`,
        presentationCount: sql<number>`(SELECT COUNT(*) FROM presentations WHERE presentations.teacher_id = teachers.id)::int`,
        worksheetCount: sql<number>`(SELECT COUNT(*) FROM worksheets WHERE worksheets.teacher_id = teachers.id)::int`,
        lessonPlanCount: sql<number>`(SELECT COUNT(*) FROM lesson_plans WHERE lesson_plans.teacher_id = teachers.id)::int`,
        videoLessonCount: sql<number>`(SELECT COUNT(*) FROM video_lessons WHERE video_lessons.teacher_id = teachers.id)::int`,
        tugTemplateCount: sql<number>`(SELECT COUNT(*) FROM tug_templates WHERE tug_templates.teacher_id = teachers.id)::int`,
        wheelTemplateCount: sql<number>`(SELECT COUNT(*) FROM wheel_templates WHERE wheel_templates.teacher_id = teachers.id)::int`,
        rocketTemplateCount: sql<number>`(SELECT COUNT(*) FROM rocket_templates WHERE rocket_templates.teacher_id = teachers.id)::int`,
        letrlyPuzzleCount: sql<number>`(SELECT COUNT(*) FROM letrly_puzzles WHERE letrly_puzzles.creator_teacher_id = teachers.id)::int`,
        collectionCount: sql<number>`(SELECT COUNT(*) FROM content_collections WHERE content_collections.teacher_id = teachers.id)::int`,
        totalXp: sql<number>`COALESCE(${teacherStatsTable.totalXp}, 0)::int`,
        xpLevel: sql<number>`COALESCE(${teacherStatsTable.level}, 1)::int`,
        displayLevelOverride: teacherStatsTable.displayLevelOverride,
      })
      .from(teachersTable)
      .leftJoin(teacherStatsTable, eq(teachersTable.id, teacherStatsTable.teacherId))
      .orderBy(sql`${teachersTable.createdAt} DESC`);

    res.json(teachers);
  } catch (err) {
    req.log.error(err, "Failed to list teachers");
    res.status(500).json({ message: "حدث خطأ أثناء جلب بيانات المعلمين" });
  }
});

router.get("/admin/students", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const students = await db
      .select({
        id: studentsTable.id,
        name: studentsTable.name,
        studentClass: studentsTable.studentClass,
        parentPhone: studentsTable.parentPhone,
        notes: studentsTable.notes,
        teacherId: studentsTable.teacherId,
        teacherName: teachersTable.name,
        createdAt: studentsTable.createdAt,
      })
      .from(studentsTable)
      .leftJoin(teachersTable, eq(studentsTable.teacherId, teachersTable.id))
      .orderBy(sql`${studentsTable.createdAt} DESC`);

    res.json(students);
  } catch (err) {
    req.log.error(err, "Failed to list students for admin");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/stats", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const [
      [{ count: teacherCount }],
      [{ count: studentCount }],
      [{ count: assignmentCount }],
      [{ count: submissionCount }],
      [{ count: questionCount }],
      [{ count: blockedCount }],
      [{ count: sharedAssignmentCount }],
      [{ count: sharedQuestionCount }],
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(teachersTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(studentsTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(assignmentsTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(submissionsTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(questionBankTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(teachersTable).where(eq(teachersTable.isBlocked, true)),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(assignmentsTable).where(eq(assignmentsTable.isShared, true)),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(questionBankTable).where(eq(questionBankTable.isShared, true)),
    ]);

    res.json({
      teacher_count: teacherCount,
      student_count: studentCount,
      assignment_count: assignmentCount,
      submission_count: submissionCount,
      question_count: questionCount,
      blocked_count: blockedCount,
      shared_assignment_count: sharedAssignmentCount,
      shared_question_count: sharedQuestionCount,
    });
  } catch (err) {
    req.log.error(err, "Failed to get admin stats");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/full-stats", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const [
      countsResult,
      gameCountsResult,
      teacherGrowthResult,
      studentGrowthResult,
      recentTeachersData,
      recentStudentAccountsData,
      sessionBreakdownResult,
    ] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM teachers) AS teacher_count,
          (SELECT COUNT(*)::int FROM student_accounts) AS student_account_count,
          (SELECT COUNT(*)::int FROM students) AS roster_student_count,
          (SELECT COUNT(*)::int FROM assignments) AS assignment_count,
          (SELECT COUNT(*)::int FROM submissions) AS submission_count,
          (SELECT COUNT(*)::int FROM adventure_games) AS adventure_game_count,
          (SELECT COUNT(*)::int FROM question_bank) AS question_count
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM flag_scores) AS flag_plays,
          (SELECT COUNT(*)::int FROM color_scores) AS color_plays,
          (SELECT COUNT(*)::int FROM memory_scores) AS memory_plays,
          (SELECT COUNT(*)::int FROM multiplication_scores) AS multiply_plays,
          (SELECT COUNT(*)::int FROM scramble_scores) AS scramble_plays
      `),
      pool.query(`
        SELECT
          to_char(created_at, 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM teachers
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month ASC
      `),
      pool.query(`
        SELECT
          to_char(created_at, 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM student_accounts
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month ASC
      `),
      db.select({
        id: teachersTable.id,
        name: teachersTable.name,
        email: teachersTable.email,
        createdAt: teachersTable.createdAt,
      }).from(teachersTable).orderBy(desc(teachersTable.createdAt)).limit(5),
      db.select({
        id: studentAccountsTable.id,
        username: studentAccountsTable.username,
        displayName: studentAccountsTable.displayName,
        createdAt: studentAccountsTable.createdAt,
      }).from(studentAccountsTable).orderBy(desc(studentAccountsTable.createdAt)).limit(5),
      pool.query(`
        SELECT
          COUNT(*)::int AS total_sessions,
          COUNT(*) FILTER (WHERE (s.sess::json->>'teacherId') IS NOT NULL AND (s.sess::json->>'teacherId') ~ '^[0-9]+$')::int AS teacher_sessions,
          COUNT(*) FILTER (WHERE (s.sess::json->>'studentAccountId') IS NOT NULL AND (s.sess::json->>'studentAccountId') ~ '^[0-9]+$')::int AS student_sessions
        FROM session s
        WHERE s.expire > NOW()
      `),
    ]);

    const counts = countsResult.rows[0] ?? {};
    const gameCounts = gameCountsResult.rows[0] ?? {};
    const sessionBreakdown = sessionBreakdownResult.rows[0] ?? {};
    const totalSessions = sessionBreakdown.total_sessions ?? 0;
    const teacherSessions = sessionBreakdown.teacher_sessions ?? 0;
    const studentSessions = sessionBreakdown.student_sessions ?? 0;
    const visitorSessions = Math.max(0, totalSessions - teacherSessions - studentSessions);

    res.json({
      counts: {
        teachers: counts.teacher_count ?? 0,
        studentAccounts: counts.student_account_count ?? 0,
        rosterStudents: counts.roster_student_count ?? 0,
        assignments: counts.assignment_count ?? 0,
        submissions: counts.submission_count ?? 0,
        adventureGames: counts.adventure_game_count ?? 0,
        questions: counts.question_count ?? 0,
      },
      gamePlays: {
        flags: gameCounts.flag_plays ?? 0,
        color: gameCounts.color_plays ?? 0,
        memory: gameCounts.memory_plays ?? 0,
        multiply: gameCounts.multiply_plays ?? 0,
        scramble: gameCounts.scramble_plays ?? 0,
      },
      sessions: {
        total: totalSessions,
        teachers: teacherSessions,
        students: studentSessions,
        visitors: visitorSessions,
      },
      growth: {
        teachers: teacherGrowthResult.rows,
        students: studentGrowthResult.rows,
      },
      recentTeachers: recentTeachersData,
      recentStudentAccounts: recentStudentAccountsData,
    });
  } catch (err) {
    req.log.error(err, "Failed to get full stats");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/acquisition-stats", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const result = await pool.query(`
      SELECT
        COALESCE(acquisition_source, 'غير معروف') AS source,
        COUNT(*)::int AS count
      FROM teachers
      GROUP BY acquisition_source
      ORDER BY count DESC
      LIMIT 20
    `);
    const total = result.rows.reduce((s: number, r: any) => s + r.count, 0);
    res.json({ bySource: result.rows, total });
  } catch (err) {
    req.log.error(err, "Failed to get acquisition stats");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/country-stats", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const result = await pool.query(`
      SELECT
        COALESCE(registration_country,      'غير معروف') AS country,
        COALESCE(registration_country_code, '')           AS country_code,
        COUNT(*)::int                                     AS count
      FROM teachers
      GROUP BY registration_country, registration_country_code
      ORDER BY count DESC
      LIMIT 30
    `);
    const total = result.rows.reduce((s: number, r: any) => s + r.count, 0);
    res.json({ byCountry: result.rows, total });
  } catch (err) {
    req.log.error(err, "Failed to get country stats");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/teachers/:id/block", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const idParse = TeacherIdParamSchema.safeParse(req.params);
    if (!idParse.success) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const id = idParse.data.id;
    if (id === req.session.teacherId) {
      res.status(400).json({ message: "لا يمكنك حظر نفسك" });
      return;
    }
    const bodyParse = BlockTeacherSchema.safeParse(req.body);
    if (!bodyParse.success) { res.status(400).json({ message: "بيانات غير صحيحة" }); return; }
    const { blocked } = bodyParse.data;
    const [updated] = await db
      .update(teachersTable)
      .set({ isBlocked: blocked })
      .where(eq(teachersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "المعلم غير موجود" });
      return;
    }
    res.json({ id: updated.id, isBlocked: updated.isBlocked });
  } catch (err) {
    req.log.error(err, "Failed to block/unblock teacher");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/teachers/:id/admin", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const idParse = TeacherIdParamSchema.safeParse(req.params);
    if (!idParse.success) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const id = idParse.data.id;
    const bodyParse = AdminFlagSchema.safeParse(req.body);
    if (!bodyParse.success) { res.status(400).json({ message: "بيانات غير صحيحة" }); return; }
    const { isAdmin } = bodyParse.data;
    // Keep `role` in sync with `isAdmin` so role-based UI routing stays correct.
    // Granting admin sets role='admin'; revoking admin falls back to 'teacher'
    // unless the user already had a meaningful non-admin role (e.g. organizer).
    const [existing] = await db
      .select({ role: teachersTable.role })
      .from(teachersTable)
      .where(eq(teachersTable.id, id))
      .limit(1);
    const nextRole = isAdmin
      ? "admin"
      : existing?.role === "admin"
        ? "teacher"
        : (existing?.role ?? "teacher");
    const [updated] = await db
      .update(teachersTable)
      .set({ isAdmin, role: nextRole })
      .where(eq(teachersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "المعلم غير موجود" });
      return;
    }
    res.json({ id: updated.id, isAdmin: updated.isAdmin, role: updated.role });
  } catch (err) {
    req.log.error(err, "Failed to toggle admin");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/teachers/:id/ai-tier", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const idParse = TeacherIdParamSchema.safeParse(req.params);
    if (!idParse.success) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const id = idParse.data.id;
    const bodyParse = AiTierSchema.safeParse(req.body);
    const tier = bodyParse.success ? bodyParse.data.aiTier : "standard";
    const [updated] = await db
      .update(teachersTable)
      .set({ aiTier: tier })
      .where(eq(teachersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "المعلم غير موجود" });
      return;
    }
    res.json({ id: updated.id, aiTier: updated.aiTier });
  } catch (err) {
    req.log.error(err, "Failed to update AI tier");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/teachers/:id/pro-design", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const idParse = TeacherIdParamSchema.safeParse(req.params);
    if (!idParse.success) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const id = idParse.data.id;
    const bodyParse = ProDesignSchema.safeParse(req.body);
    if (!bodyParse.success) { res.status(400).json({ message: "بيانات غير صحيحة" }); return; }
    const { hasProDesign } = bodyParse.data;
    const [updated] = await db
      .update(teachersTable)
      .set({ hasProDesign })
      .where(eq(teachersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "المعلم غير موجود" });
      return;
    }
    res.json({ id: updated.id, hasProDesign: updated.hasProDesign });
  } catch (err) {
    req.log.error(err, "Failed to update pro design");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* Toggle the Pro tier of interactive presentations for a single teacher.
   Independent of `hasProDesign` so admins can grant the Pro feature
   set (uncapped slides/assets) to a specific teacher before flipping
   it on globally via /admin/platform-settings. */
router.patch("/admin/teachers/:id/presentations-pro", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const idParse = TeacherIdParamSchema.safeParse(req.params);
    if (!idParse.success) { res.status(400).json({ message: "معرّف غير صالح" }); return; }
    const id = idParse.data.id;
    const bodyParse = PresentationsProSchema.safeParse(req.body);
    if (!bodyParse.success) { res.status(400).json({ message: "بيانات غير صحيحة" }); return; }
    const { presentationsProEnabled } = bodyParse.data;
    const [updated] = await db
      .update(teachersTable)
      .set({ presentationsProEnabled })
      .where(eq(teachersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "المعلم غير موجود" });
      return;
    }
    res.json({ id: updated.id, presentationsProEnabled: updated.presentationsProEnabled });
  } catch (err) {
    req.log.error(err, "Failed to update presentations pro");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/** Pin achievements display tier (1–7) or clear to follow XP. */
router.patch("/admin/teachers/:id/display-level", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const idParse = TeacherIdParamSchema.safeParse(req.params);
    if (!idParse.success) {
      res.status(400).json({ message: "معرّف غير صالح" });
      return;
    }
    const id = idParse.data.id;
    const bodyParse = DisplayLevelOverrideSchema.safeParse(req.body);
    if (!bodyParse.success) {
      res.status(400).json({ message: "بيانات غير صحيحة" });
      return;
    }
    const displayLevelOverride = bodyParse.data.displayLevelOverride;

    const [exists] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.id, id)).limit(1);
    if (!exists) {
      res.status(404).json({ message: "المعلم غير موجود" });
      return;
    }

    await db
      .insert(teacherStatsTable)
      .values({ teacherId: id, displayLevelOverride })
      .onConflictDoUpdate({
        target: teacherStatsTable.teacherId,
        set: { displayLevelOverride, updatedAt: new Date() },
      });

    res.json({ id, displayLevelOverride });
  } catch (err) {
    req.log.error(err, "Failed to update teacher display level");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.delete("/admin/teachers/:id", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id);
    if (id === req.session.teacherId) {
      res.status(400).json({ message: "لا يمكنك حذف نفسك" });
      return;
    }
    const libraryBlobs = await db
      .select({ id: teacherLibraryFilesTable.id, objectPath: teacherLibraryFilesTable.objectPath })
      .from(teacherLibraryFilesTable)
      .where(
        and(
          eq(teacherLibraryFilesTable.teacherId, id),
          eq(teacherLibraryFilesTable.source, "upload"),
          isNotNull(teacherLibraryFilesTable.objectPath),
        ),
      );
    const [deleted] = await db
      .delete(teachersTable)
      .where(eq(teachersTable.id, id))
      .returning();
    if (deleted) {
      for (const f of libraryBlobs) {
        if (!f.objectPath) continue;
        try {
          await adminObjectStorage.tryDeleteObjectEntity(f.objectPath);
        } catch (blobErr) {
          req.log.error({ err: blobErr, objectPath: f.objectPath, fileId: f.id, teacherId: id }, "library cascade delete blob error");
        }
      }
    }
    if (!deleted) {
      res.status(404).json({ message: "المعلم غير موجود" });
      return;
    }
    res.json({ message: "تم حذف المعلم بنجاح" });
  } catch (err) {
    req.log.error(err, "Failed to delete teacher");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* ── Platform Settings ──────────────────────────────────────── */

async function getPlatformSettings() {
  const [row] = await db
    .select()
    .from(platformSettingsTable)
    .orderBy(asc(platformSettingsTable.id))
    .limit(1);
  return {
    publicVisibility: row?.publicVisibility ?? "selective",
    guestLimit: row?.guestLimit ?? 1,
    primaryColor: row?.primaryColor ?? null,
    accentColor: row?.accentColor ?? null,
    fontFamily: row?.fontFamily ?? null,
    platformName: row?.platformName ?? null,
    logoUrl: row?.logoUrl ?? null,
    showAdventureGamesHome: row?.showAdventureGamesHome ?? false,
    showSpaceRaceGamesHome: row?.showSpaceRaceGamesHome ?? false,
    showFlagsGame: row?.showFlagsGame ?? true,
    showColorGame: row?.showColorGame ?? true,
    showMemoryGame: row?.showMemoryGame ?? true,
    showMultiplyGame: row?.showMultiplyGame ?? true,
    showScrambleGame: row?.showScrambleGame ?? true,
    showTugGame: row?.showTugGame ?? false,
    showCapitalsGame: row?.showCapitalsGame ?? true,
    proAiForAll: row?.proAiForAll ?? false,
    presentationsProForAll: row?.presentationsProForAll ?? false,
    presentationLimits: row?.presentationLimits ?? DEFAULT_PRESENTATION_LIMITS,
    showQuranSection: row?.showQuranSection ?? false,
    showGeneralCertificates: row?.showGeneralCertificates ?? false,
    showMaraqui: row?.showMaraqui ?? false,
    showSecretGame: row?.showSecretGame ?? false,
    classroomEnabled: row?.classroomEnabled ?? false,
    classroomAllowedEmails: row?.classroomAllowedEmails ?? [],
    arenaImportSources: row?.arenaImportSources ?? { ...DEFAULT_ARENA_IMPORT_SOURCES },
    teacherXpRewardsEnabled: row?.teacherXpRewardsEnabled ?? true,
    showPublicStats: row?.showPublicStats ?? false,
    publicStatsOverride: row?.publicStatsOverride ?? null,
  };
}

async function getPublicVisibility(): Promise<string> {
  const s = await getPlatformSettings();
  return s.publicVisibility;
}

router.get("/admin/platform-settings", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const settings = await getPlatformSettings();
    res.json(settings);
  } catch (err) {
    req.log.error(err, "Failed to get platform settings");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/platform-settings", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const patchBody = platformSettingsPatchBody(req);
    const {
      publicVisibility,
      guestLimit,
      primaryColor,
      accentColor,
      fontFamily,
      platformName,
      logoUrl,
      showAdventureGamesHome,
      showSpaceRaceGamesHome,
      showFlagsGame,
      showColorGame,
      showMemoryGame,
      showMultiplyGame,
      showScrambleGame,
      showTugGame,
      showCapitalsGame,
      proAiForAll,
      presentationsProForAll,
      presentationLimits,
      showQuranSection,
      showGeneralCertificates,
      showMaraqui,
      showSecretGame,
      classroomEnabled,
      classroomAllowedEmails,
      arenaImportSources,
      showPublicStats,
      publicStatsOverride,
    } = patchBody;

    const update: Record<string, unknown> = {};

    if (publicVisibility !== undefined) {
      const pv =
        typeof publicVisibility === "string"
          ? publicVisibility.trim().toLowerCase()
          : "";
      if (!["all", "none", "selective"].includes(pv)) {
        return res.status(400).json({ message: "publicVisibility غير صالح" });
      }
      update.publicVisibility = pv;
    }

    if (guestLimit !== undefined) {
      const limit = Number(guestLimit);
      if (!Number.isInteger(limit) || limit < 0 || limit > 9999) {
        return res.status(400).json({ message: "guestLimit يجب أن يكون رقماً بين 0 و9999" });
      }
      update.guestLimit = limit;
    }

    if (primaryColor !== undefined) update.primaryColor = primaryColor || null;
    if (accentColor !== undefined) update.accentColor = accentColor || null;
    if (fontFamily !== undefined) update.fontFamily = fontFamily || null;
    if (platformName !== undefined) update.platformName = platformName || null;
    if (logoUrl !== undefined) update.logoUrl = logoUrl || null;
    if (showAdventureGamesHome !== undefined) update.showAdventureGamesHome = coerceBodyBool(showAdventureGamesHome);
    if (showSpaceRaceGamesHome !== undefined) update.showSpaceRaceGamesHome = coerceBodyBool(showSpaceRaceGamesHome);
    if (showFlagsGame !== undefined) update.showFlagsGame = coerceBodyBool(showFlagsGame);
    if (showColorGame !== undefined) update.showColorGame = coerceBodyBool(showColorGame);
    if (showMemoryGame !== undefined) update.showMemoryGame = coerceBodyBool(showMemoryGame);
    if (showMultiplyGame !== undefined) update.showMultiplyGame = coerceBodyBool(showMultiplyGame);
    if (showScrambleGame !== undefined) update.showScrambleGame = coerceBodyBool(showScrambleGame);
    if (showTugGame !== undefined) update.showTugGame = coerceBodyBool(showTugGame);
    if (showCapitalsGame !== undefined) update.showCapitalsGame = coerceBodyBool(showCapitalsGame);
    if (proAiForAll !== undefined) update.proAiForAll = coerceBodyBool(proAiForAll);
    if (presentationsProForAll !== undefined) update.presentationsProForAll = coerceBodyBool(presentationsProForAll);
    if (presentationLimits !== undefined) {
      const parsed = PresentationLimitsSchema.safeParse(presentationLimits);
      if (!parsed.success) {
        return res.status(400).json({ message: "presentationLimits غير صالح" });
      }
      update.presentationLimits = parsed.data;
    }
    if (showQuranSection !== undefined) update.showQuranSection = coerceBodyBool(showQuranSection);
    if (showGeneralCertificates !== undefined) update.showGeneralCertificates = coerceBodyBool(showGeneralCertificates);
    if (showMaraqui !== undefined) update.showMaraqui = coerceBodyBool(showMaraqui);
    if (showSecretGame !== undefined) update.showSecretGame = coerceBodyBool(showSecretGame);
    if (classroomEnabled !== undefined) update.classroomEnabled = coerceBodyBool(classroomEnabled);
    if (classroomAllowedEmails !== undefined) {
      if (!Array.isArray(classroomAllowedEmails)) {
        return res.status(400).json({ message: "classroomAllowedEmails يجب أن يكون قائمة" });
      }
      const cleaned = Array.from(
        new Set(
          classroomAllowedEmails
            .map((e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
            .filter((e: string) => e.length > 0 && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
        ),
      ).slice(0, 500);
      update.classroomAllowedEmails = cleaned;
    }
    if (arenaImportSources !== undefined) {
      const parsed = ArenaImportSourcesSchema.safeParse(arenaImportSources);
      if (!parsed.success) {
        return res.status(400).json({ message: "arenaImportSources غير صالح" });
      }
      update.arenaImportSources = parsed.data;
    }
    if (showPublicStats !== undefined) update.showPublicStats = coerceBodyBool(showPublicStats);
    if (publicStatsOverride !== undefined) {
      update.publicStatsOverride = publicStatsOverride === null ? null : publicStatsOverride;
    }
    /* XP toggle: must use property checks — value `false` is valid; some proxies send snake_case. */
    if (
      Object.prototype.hasOwnProperty.call(patchBody, "teacherXpRewardsEnabled") ||
      Object.prototype.hasOwnProperty.call(patchBody, "teacher_xp_rewards_enabled")
    ) {
      const raw = Object.prototype.hasOwnProperty.call(patchBody, "teacherXpRewardsEnabled")
        ? patchBody.teacherXpRewardsEnabled
        : patchBody.teacher_xp_rewards_enabled;
      update.teacherXpRewardsEnabled = coerceBodyBool(raw);
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "لا توجد حقول للتحديث" });
    }

    const current = await getPlatformSettings();

    const [settingsRow] = await db
      .select({ id: platformSettingsTable.id })
      .from(platformSettingsTable)
      .orderBy(asc(platformSettingsTable.id))
      .limit(1);

    if (settingsRow) {
      await db
        .update(platformSettingsTable)
        .set(update as Partial<typeof platformSettingsTable.$inferInsert>)
        .where(eq(platformSettingsTable.id, settingsRow.id));
    } else {
      await db.insert(platformSettingsTable).values({
        id: 1,
        publicVisibility: current.publicVisibility,
        guestLimit: current.guestLimit,
        ...update,
      } as typeof platformSettingsTable.$inferInsert);
    }

    const updated = await getPlatformSettings();
    if ("teacherXpRewardsEnabled" in update) invalidateTeacherXpRewardsCache();
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Failed to update platform settings");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* ── Admin Content Management ───────────────────────────────── */

router.get("/admin/content", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const [assignments, tugTemplates] = await Promise.all([
      db.select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        subject: assignmentsTable.subject,
        isShared: assignmentsTable.isShared,
        teacherName: teachersTable.name,
        createdAt: assignmentsTable.createdAt,
      })
        .from(assignmentsTable)
        .leftJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
        .orderBy(sql`${assignmentsTable.createdAt} DESC`),
      db.select({
        id: tugTemplatesTable.id,
        title: tugTemplatesTable.title,
        duration: tugTemplatesTable.duration,
        isShared: tugTemplatesTable.isShared,
        teacherName: teachersTable.name,
        teacherIsAdmin: teachersTable.isAdmin,
        createdAt: tugTemplatesTable.createdAt,
      })
        .from(tugTemplatesTable)
        .leftJoin(teachersTable, eq(tugTemplatesTable.teacherId, teachersTable.id))
        .orderBy(sql`${tugTemplatesTable.createdAt} DESC`),
    ]);
    res.json({ assignments, tugTemplates });
  } catch (err) {
    req.log.error(err, "Failed to get admin content");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/content/tug-templates/:id/share", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ message: "معرّف غير صالح" });
    const { isShared } = req.body;
    if (typeof isShared !== "boolean") return res.status(400).json({ message: "isShared يجب أن يكون boolean" });
    const [updated] = await db
      .update(tugTemplatesTable)
      .set({ isShared })
      .where(eq(tugTemplatesTable.id, id))
      .returning({ id: tugTemplatesTable.id, isShared: tugTemplatesTable.isShared });
    if (!updated) return res.status(404).json({ message: "القالب غير موجود" });
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Failed to toggle tug template share");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/admin/content/tug-templates/bulk-share", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { isShared } = req.body;
    if (typeof isShared !== "boolean") return res.status(400).json({ message: "isShared يجب أن يكون boolean" });
    // Only share/unshare templates owned by admin teachers
    const adminIds = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.isAdmin, true));
    const ids = adminIds.map(a => a.id);
    if (ids.length === 0) return res.json({ message: "لا يوجد مسؤولون" });
    await db.update(tugTemplatesTable).set({ isShared }).where(inArray(tugTemplatesTable.teacherId, ids));
    res.json({ message: "تم تطبيق التغييرات" });
  } catch (err) {
    req.log.error(err, "Failed to bulk share tug");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.patch("/admin/content/assignments/:id/share", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id);
    if (!id || isNaN(id) || id <= 0) return res.status(400).json({ message: "معرّف غير صالح" });
    const { isShared } = req.body;
    if (typeof isShared !== "boolean") return res.status(400).json({ message: "isShared يجب أن يكون boolean" });
    const [updated] = await db
      .update(assignmentsTable)
      .set({ isShared, isShareApproved: isShared })
      .where(eq(assignmentsTable.id, id))
      .returning({ id: assignmentsTable.id, isShared: assignmentsTable.isShared });
    if (!updated) return res.status(404).json({ message: "الواجب غير موجود" });
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Failed to toggle assignment share");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/admin/content/bulk-share", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { isShared } = req.body;
    if (typeof isShared !== "boolean") return res.status(400).json({ message: "isShared يجب أن يكون boolean" });
    // Toggle isShared on all assignments (existing behavior).
    await db.update(assignmentsTable).set({ isShared });
    // Auto-approve only admin-owned rows; non-admin teachers' assignments
    // still require the normal approval flow.
    await db.execute(sql`
      UPDATE assignments SET is_share_approved = ${isShared}
      WHERE teacher_id IN (SELECT id FROM teachers WHERE is_admin = true)
    `);
    res.json({ message: "تم تطبيق التغييرات" });
  } catch (err) {
    req.log.error(err, "Failed to bulk share");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/activities", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const LIMIT = 100;

    const [assignments, games, videoLessons, tugGames, memorySets, countsResult] = await Promise.all([
      db.select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        subject: assignmentsTable.subject,
        teacherName: teachersTable.name,
        teacherId: assignmentsTable.teacherId,
        createdAt: assignmentsTable.createdAt,
        isShared: assignmentsTable.isShared,
        isAdaptive: assignmentsTable.isAdaptive,
        examMode: assignmentsTable.examMode,
        accessMode: assignmentsTable.accessMode,
        targetClass: assignmentsTable.targetClass,
        submissionCount: sql<number>`(SELECT COUNT(*) FROM submissions WHERE submissions.assignment_id = assignments.id)::int`,
        questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.assignment_id = assignments.id)::int`,
      })
        .from(assignmentsTable)
        .leftJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
        .orderBy(sql`${assignmentsTable.createdAt} DESC`)
        .limit(LIMIT),

      db.select({
        id: adventureGamesTable.id,
        title: adventureGamesTable.title,
        teacherName: teachersTable.name,
        teacherId: adventureGamesTable.teacherId,
        pin: adventureGamesTable.pin,
        status: adventureGamesTable.status,
        gameType: adventureGamesTable.gameType,
        isShared: adventureGamesTable.isShared,
        createdAt: adventureGamesTable.createdAt,
      })
        .from(adventureGamesTable)
        .leftJoin(teachersTable, eq(adventureGamesTable.teacherId, teachersTable.id))
        .orderBy(sql`${adventureGamesTable.createdAt} DESC`)
        .limit(LIMIT),

      db.select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        teacherName: teachersTable.name,
        teacherId: videoLessonsTable.teacherId,
        isPublished: videoLessonsTable.isPublished,
        isShared: videoLessonsTable.isShared,
        videoType: videoLessonsTable.videoType,
        createdAt: videoLessonsTable.createdAt,
      })
        .from(videoLessonsTable)
        .leftJoin(teachersTable, eq(videoLessonsTable.teacherId, teachersTable.id))
        .orderBy(sql`${videoLessonsTable.createdAt} DESC`)
        .limit(LIMIT),

      db.select({
        id: tugTemplatesTable.id,
        title: tugTemplatesTable.title,
        teacherName: teachersTable.name,
        teacherId: tugTemplatesTable.teacherId,
        duration: tugTemplatesTable.duration,
        createdAt: tugTemplatesTable.createdAt,
      })
        .from(tugTemplatesTable)
        .leftJoin(teachersTable, eq(tugTemplatesTable.teacherId, teachersTable.id))
        .orderBy(sql`${tugTemplatesTable.createdAt} DESC`)
        .limit(LIMIT),

      db.select({
        id: memoryCardSetsTable.id,
        title: memoryCardSetsTable.title,
        teacherName: teachersTable.name,
        creatorId: memoryCardSetsTable.creatorId,
        gradeLevel: memoryCardSetsTable.gradeLevel,
        pin: memoryCardSetsTable.pin,
        createdAt: memoryCardSetsTable.createdAt,
      })
        .from(memoryCardSetsTable)
        .leftJoin(teachersTable, eq(memoryCardSetsTable.creatorId, teachersTable.id))
        .orderBy(sql`${memoryCardSetsTable.createdAt} DESC`)
        .limit(LIMIT),

      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM assignments) AS total_assignments,
          (SELECT COUNT(*)::int FROM adventure_games) AS total_games,
          (SELECT COUNT(*)::int FROM video_lessons) AS total_video_lessons,
          (SELECT COUNT(*)::int FROM tug_templates) AS total_tug_games,
          (SELECT COUNT(*)::int FROM memory_card_sets) AS total_memory_sets,
          (SELECT COUNT(*)::int FROM submissions) AS total_submissions
      `),
    ]);

    const counts = countsResult.rows[0] ?? {};

    res.json({
      assignments,
      games,
      videoLessons,
      tugGames,
      memorySets,
      summary: {
        totalAssignments: counts.total_assignments ?? assignments.length,
        totalGames: counts.total_games ?? games.length,
        totalVideoLessons: counts.total_video_lessons ?? videoLessons.length,
        totalTugGames: counts.total_tug_games ?? tugGames.length,
        totalMemorySets: counts.total_memory_sets ?? memorySets.length,
        totalSubmissions: counts.total_submissions ?? 0,
      },
    });
  } catch (err) {
    req.log.error(err, "Failed to get admin activities");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/online", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const countsResult = await pool.query(
      `SELECT
         COUNT(*)::int AS "totalActiveSessions",
         COUNT(*) FILTER (WHERE (s.sess::json->>'teacherId') IS NOT NULL AND (s.sess::json->>'teacherId') ~ '^[0-9]+$')::int AS "teacherSessions",
         COUNT(*) FILTER (WHERE (s.sess::json->>'studentAccountId') IS NOT NULL AND (s.sess::json->>'studentAccountId') ~ '^[0-9]+$')::int AS "studentSessions"
       FROM session s WHERE s.expire > NOW()`
    );
    const totalActiveSessions: number = countsResult.rows[0]?.totalActiveSessions ?? 0;
    const teacherSessions: number = countsResult.rows[0]?.teacherSessions ?? 0;
    const studentSessions: number = countsResult.rows[0]?.studentSessions ?? 0;
    const visitorSessions = Math.max(0, totalActiveSessions - teacherSessions - studentSessions);

    const onlineResult = await pool.query(
      `SELECT DISTINCT t.id, t.name, t.email, t.last_login_at AS "lastLoginAt"
       FROM session s
       JOIN LATERAL (SELECT CASE WHEN s.sess::json->>'teacherId' ~ '^[0-9]+$' THEN (s.sess::json->>'teacherId')::int END AS tid) parsed ON true
       JOIN teachers t ON t.id = parsed.tid
       WHERE s.expire > NOW() AND parsed.tid IS NOT NULL
       ORDER BY t.last_login_at DESC NULLS LAST`
    );
    const onlineTeachers = onlineResult.rows;

    const recentLogins = await db
      .select({
        id: teachersTable.id,
        name: teachersTable.name,
        email: teachersTable.email,
        lastLoginAt: teachersTable.lastLoginAt,
      })
      .from(teachersTable)
      .where(sql`${teachersTable.lastLoginAt} IS NOT NULL`)
      .orderBy(sql`${teachersTable.lastLoginAt} DESC`)
      .limit(20);

    res.json({
      totalActiveSessions,
      onlineTeacherCount: onlineTeachers.length,
      studentSessions,
      visitorSessions,
      onlineTeachers,
      recentLogins,
    });
  } catch (err) {
    req.log.error(err, "Failed to get online data");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.get("/admin/pending-shares", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const pending = await db
      .select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        subject: sql<string>`${assignmentsTable.subject}`,
        teacherId: assignmentsTable.teacherId,
        teacherName: teachersTable.name,
        createdAt: assignmentsTable.createdAt,
        contentKind: assignmentsTable.contentKind,
        questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.assignment_id = ${assignmentsTable.id})::int`,
      })
      .from(assignmentsTable)
      .leftJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
      .where(and(eq(assignmentsTable.isShared, true), eq(assignmentsTable.isShareApproved, false)))
      .orderBy(desc(assignmentsTable.createdAt));
    res.json(pending);
  } catch (err) {
    req.log.error(err, "Failed to get pending shares");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/admin/assignments/:id/approve-share", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صحيح" }); return; }
    const rawKind = req.body?.contentKind;
    const contentKind = (rawKind === "competition" || rawKind === "homework" || rawKind === "both") ? rawKind : undefined;
    const update: Record<string, unknown> = { isShareApproved: true };
    if (contentKind) update.contentKind = contentKind;
    await db.update(assignmentsTable).set(update as never).where(eq(assignmentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to approve share");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* ── Admin: change the library classification of a shared assignment ─────
   Lets admins move a shared assignment between 'homework' (مكتبة الأنشطة),
   'competition' (مكتبة المسابقات), or 'both' (كلتا المكتبتين). */
router.patch("/admin/assignments/:id/content-kind", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صحيح" }); return; }
    const { contentKind } = req.body;
    if (contentKind !== "homework" && contentKind !== "competition" && contentKind !== "both") {
      return res.status(400).json({ message: "contentKind يجب أن يكون homework أو competition أو both" });
    }
    const [updated] = await db
      .update(assignmentsTable)
      .set({ contentKind })
      .where(eq(assignmentsTable.id, id))
      .returning({ id: assignmentsTable.id, contentKind: assignmentsTable.contentKind });
    if (!updated) return res.status(404).json({ message: "الواجب غير موجود" });
    res.json(updated);
  } catch (err) {
    req.log.error(err, "Failed to update content kind");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/admin/assignments/:id/reject-share", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صحيح" }); return; }
    await db.update(assignmentsTable).set({ isShared: false, isShareApproved: false }).where(eq(assignmentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to reject share");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* ── Admin: list all hidden items across types ──────────────────
   Powers the "Hidden by admin" review page. Returns flat rows with
   {type, id, title, teacherName, hiddenAt, hideReason, hiddenByName}
   so a single sortable table can render assignments + question-bank
   + video-lessons together. */
router.get("/admin/hidden", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const assignmentRows = await db.execute(sql`
      SELECT a.id, a.title, a.subject, a.hidden_at AS "hiddenAt",
             a.hide_reason AS "hideReason", a.hidden_by_id AS "hiddenById",
             owner.name AS "teacherName", hider.name AS "hiddenByName"
        FROM assignments a
        LEFT JOIN teachers owner ON owner.id = a.teacher_id
        LEFT JOIN teachers hider ON hider.id = a.hidden_by_id
       WHERE a.hidden_by_admin = true
       ORDER BY a.hidden_at DESC NULLS LAST, a.id DESC
    `);

    const questionRows = await db.execute(sql`
      SELECT q.id, q.text AS title, q.subject, q.hidden_at AS "hiddenAt",
             q.hide_reason AS "hideReason", q.hidden_by_id AS "hiddenById",
             owner.name AS "teacherName", hider.name AS "hiddenByName"
        FROM question_bank q
        LEFT JOIN teachers owner ON owner.id = q.teacher_id
        LEFT JOIN teachers hider ON hider.id = q.hidden_by_id
       WHERE q.hidden_by_admin = true
       ORDER BY q.hidden_at DESC NULLS LAST, q.id DESC
    `);

    const videoRows = await db.execute(sql`
      SELECT v.id, v.title, v.subject, v.hidden_at AS "hiddenAt",
             v.hide_reason AS "hideReason", v.hidden_by_id AS "hiddenById",
             owner.name AS "teacherName", hider.name AS "hiddenByName"
        FROM video_lessons v
        LEFT JOIN teachers owner ON owner.id = v.teacher_id
        LEFT JOIN teachers hider ON hider.id = v.hidden_by_id
       WHERE v.hidden_by_admin = true
       ORDER BY v.hidden_at DESC NULLS LAST, v.id DESC
    `);

    type HiddenRow = Record<string, unknown> & { type: "assignment" | "question-bank" | "video-lesson"; hiddenAt: string | null };
    const items: HiddenRow[] = [
      ...(assignmentRows.rows as Array<Record<string, unknown>>).map((r) => ({ ...r, type: "assignment" as const }) as HiddenRow),
      ...(questionRows.rows as Array<Record<string, unknown>>).map((r) => ({ ...r, type: "question-bank" as const }) as HiddenRow),
      ...(videoRows.rows as Array<Record<string, unknown>>).map((r) => ({ ...r, type: "video-lesson" as const }) as HiddenRow),
    ];

    items.sort((a, b) => {
      const ta = a.hiddenAt ? new Date(a.hiddenAt).getTime() : 0;
      const tb = b.hiddenAt ? new Date(b.hiddenAt).getTime() : 0;
      return tb - ta;
    });

    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "Failed to list hidden items");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

/* ── Admin hide / unhide endpoints ──────────────────────────────
   The new sharing model auto-publishes everything; admins moderate
   reactively by hiding individual rows from the public libraries.
   These endpoints set hidden_by_admin/hidden_at/hidden_by_id/hide_reason
   on assignments, question_bank rows, and video_lessons. */
const HideBody = z.object({ reason: z.string().max(500).optional() });

// Each handler is bound to a specific Drizzle table so its `set` /
// `where` calls keep their generated column types — no `any` escapes.
async function parseIdAndAdmin(req: Request, res: Response): Promise<{ id: number; adminId: number } | null> {
  if (!(await requireAdmin(req, res))) return null;
  const adminId = req.session.teacherId as number;
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ message: "معرّف غير صحيح" }); return null; }
  return { id, adminId };
}

router.patch("/admin/assignments/:id/hide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    const body = HideBody.parse(req.body ?? {});
    const rows = await db.update(assignmentsTable)
      .set({ hiddenByAdmin: true, hiddenAt: new Date(), hiddenById: ctx.adminId, hideReason: body.reason ?? null })
      .where(eq(assignmentsTable.id, ctx.id))
      .returning({ id: assignmentsTable.id });
    if (rows.length === 0) { res.status(404).json({ message: "غير موجود" }); return; }
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to hide assignment"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/assignments/:id/unhide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    const rows = await db.update(assignmentsTable)
      .set({ hiddenByAdmin: false, hiddenAt: null, hiddenById: null, hideReason: null })
      .where(eq(assignmentsTable.id, ctx.id))
      .returning({ id: assignmentsTable.id });
    if (rows.length === 0) { res.status(404).json({ message: "غير موجود" }); return; }
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to unhide assignment"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/question-bank/:id/hide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    const body = HideBody.parse(req.body ?? {});
    const rows = await db.update(questionBankTable)
      .set({ hiddenByAdmin: true, hiddenAt: new Date(), hiddenById: ctx.adminId, hideReason: body.reason ?? null })
      .where(eq(questionBankTable.id, ctx.id))
      .returning({ id: questionBankTable.id });
    if (rows.length === 0) { res.status(404).json({ message: "غير موجود" }); return; }
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to hide question"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/question-bank/:id/unhide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    const rows = await db.update(questionBankTable)
      .set({ hiddenByAdmin: false, hiddenAt: null, hiddenById: null, hideReason: null })
      .where(eq(questionBankTable.id, ctx.id))
      .returning({ id: questionBankTable.id });
    if (rows.length === 0) { res.status(404).json({ message: "غير موجود" }); return; }
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to unhide question"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/video-lessons/:id/hide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    const body = HideBody.parse(req.body ?? {});
    const rows = await db.update(videoLessonsTable)
      .set({ hiddenByAdmin: true, hiddenAt: new Date(), hiddenById: ctx.adminId, hideReason: body.reason ?? null })
      .where(eq(videoLessonsTable.id, ctx.id))
      .returning({ id: videoLessonsTable.id });
    if (rows.length === 0) { res.status(404).json({ message: "غير موجود" }); return; }
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to hide video"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/video-lessons/:id/unhide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    const rows = await db.update(videoLessonsTable)
      .set({ hiddenByAdmin: false, hiddenAt: null, hiddenById: null, hideReason: null })
      .where(eq(videoLessonsTable.id, ctx.id))
      .returning({ id: videoLessonsTable.id });
    if (rows.length === 0) { res.status(404).json({ message: "غير موجود" }); return; }
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to unhide video"); res.status(500).json({ message: "حدث خطأ" }); }
});

/* ── POST /admin/dedup-islamic-questions ─────────────────────────────────
   Removes duplicate islamic_questions rows (keeps oldest per category+text)
   then inserts new unique questions.  Admin-only, idempotent. */
router.post("/admin/dedup-islamic-questions", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    type Q = readonly [string, string, string, string, string, string, 0 | 1 | 2 | 3];
    const NEW_QUESTIONS: Record<string, Q[]> = {
      "سيرة النبي ﷺ": [
        ["ما الجبل الذي يوجد فيه غار حراء؟","جبل النور","جبل أحد","جبل ثور","جبل عرفات","medium",0],
        ["من رافق النبي ﷺ في رحلة الهجرة إلى المدينة؟","عمر بن الخطاب","علي بن أبي طالب","أبو بكر الصديق","عثمان بن عفان","easy",2],
        ["كم سنة مكث النبي ﷺ في مكة بعد البعثة قبل الهجرة؟","عشر سنوات","اثنتا عشرة سنة","ثلاث عشرة سنة","خمس عشرة سنة","medium",2],
        ["ما أول سورة نزلت في القرآن الكريم؟","الفاتحة","العلق","البقرة","المدثر","easy",1],
        ["ما اسم أول من استُشهدت في الإسلام؟","عمار بن ياسر","ياسر بن عامر","سمية بنت خياط","بلال بن رباح","medium",2],
        ["في أي عام فُتحت مكة هجرياً؟","السنة السادسة","السنة السابعة","السنة الثامنة","السنة التاسعة","medium",2],
        ["في أي يوم من الأسبوع وُلد النبي ﷺ وفق الرواية المشهورة؟","الأحد","الاثنين","الثلاثاء","الجمعة","medium",1],
        ["كم عدد أبناء النبي ﷺ الذكور؟","اثنان","ثلاثة","أربعة","خمسة","medium",1],
        ["ما اسم عم النبي ﷺ الذي استشهد في غزوة أحد؟","أبو طالب","أبو لهب","حمزة بن عبد المطلب","العباس بن عبد المطلب","easy",2],
        ["ما اسم الصحابي الذي أذّن أول أذان في الإسلام؟","أبو بكر","عمر بن الخطاب","سعد بن أبي وقاص","بلال بن رباح","easy",3],
        ["ما المعجزة الخالدة التي أُوتيها النبي ﷺ؟","إحياء الموتى","القرآن الكريم","شق القمر","إبراء الأكمه والأبرص","easy",1],
        ["في أي مدينة توفي النبي ﷺ؟","مكة المكرمة","المدينة المنورة","الطائف","تبوك","easy",1],
        ["ما اسم المعركة التي سمّيت بغزوة الأحزاب؟","غزوة بدر","غزوة أحد","غزوة الخندق","غزوة حنين","medium",2],
        ["كم كان عمر السيدة خديجة حين تزوجت النبي ﷺ؟","٢٥","٣٠","٤٠","٤٥","hard",2],
        ["ما اسم الصحابي الذي كان يُعرف بـ«صهيب الرومي»؟","صهيب بن سنان","صهيب البصري","صهيب الأنصاري","صهيب الهاشمي","hard",0],
      ],
      "الخلفاء الراشدون": [
        ["ما لقب أبي بكر الصديق في الإسلام؟","الفاروق","الصديق","ذو النورين","أسد الله","easy",1],
        ["من هو الخليفة الذي أمر بتدوين القرآن في مصحف أول مرة؟","عمر بن الخطاب","أبو بكر الصديق","عثمان بن عفان","علي بن أبي طالب","medium",1],
        ["في أي مدينة استُشهد عثمان بن عفان؟","مكة","الكوفة","المدينة المنورة","البصرة","medium",2],
        ["ما اسم ابنة أبي بكر الصديق التي تزوجها النبي ﷺ؟","فاطمة","عائشة","حفصة","أم سلمة","easy",1],
        ["ما اسم ابنة عمر بن الخطاب التي تزوجها النبي ﷺ؟","رقية","عائشة","حفصة","زينب","easy",2],
        ["ما اسم المعركة الفاصلة التي انتصر فيها المسلمون على الفرس في عهد عمر؟","اليرموك","القادسية","أجنادين","ذات الصواري","medium",1],
        ["من هو الصحابي الملقّب بـ«أمين الأمة»؟","أبو عبيدة بن الجراح","خالد بن الوليد","سعد بن أبي وقاص","عمرو بن العاص","hard",0],
        ["كم سنة دامت خلافة علي بن أبي طالب تقريباً؟","ثلاث سنوات","أربع سنوات وتسعة أشهر","ست سنوات","سبع سنوات","hard",1],
        ["ما الاسم الكامل لعمر بن الخطاب رضي الله عنه؟","عمر بن الخطاب بن نفيل","عمر بن الخطاب بن عدي","عمر بن الخطاب بن عمرو","عمر بن الخطاب بن حذيفة","hard",0],
        ["في عهد أيّ خليفة وقعت معركة اليرموك الفاصلة؟","أبي بكر الصديق","عمر بن الخطاب","عثمان بن عفان","علي بن أبي طالب","medium",1],
        ["ما اسم الصحابي الذي تولّى قضاء المدينة في عهد عمر بن الخطاب؟","علي بن أبي طالب","أبو موسى الأشعري","زيد بن ثابت","عبد الله بن مسعود","hard",2],
        ["من هو الخليفة الراشد الذي اغتاله ابن ملجم؟","أبو بكر الصديق","عمر بن الخطاب","عثمان بن عفان","علي بن أبي طالب","medium",3],
        ["ما اسم الحرب التي دارت بين علي بن أبي طالب وطلحة والزبير؟","صفين","النهروان","الجمل","أُحد","medium",2],
        ["كم عدد الخلفاء الراشدين الأربعة بترتيبهم الزمني؟","أبو بكر عمر عثمان علي","أبو بكر علي عمر عثمان","عمر أبو بكر عثمان علي","أبو بكر عثمان عمر علي","easy",0],
        ["ما لقب عمر بن الخطاب الذي أعطاه له النبي ﷺ؟","الصديق","الفاروق","ذو النورين","حيدر","easy",1],
        ["من هو الخليفة الذي أسّس مدينة البصرة والكوفة؟","أبو بكر","عمر بن الخطاب","عثمان","علي","medium",1],
      ],
      "علوم عامة": [
        ["ما وحدة قياس الضغط الجوي؟","نيوتن","باسكال","جول","واط","medium",1],
        ["ما اسم العالم الذي طوّر نظرية التطور؟","إسحاق نيوتن","ألبرت أينشتاين","لويس باستور","تشارلز داروين","medium",3],
        ["كم درجة تبلغ درجة الحرارة عند الصفر المطلق بالكلفن؟","صفر","١٠٠","٢٧٣","٣٧٣","medium",0],
        ["ما عدد أضلع الشكل السداسي المنتظم؟","٤","٥","٦","٨","easy",2],
        ["ما النوع من الموجات المستخدمة في الميكروويف؟","أشعة سينية","أشعة فوق بنفسجية","موجات دقيقة","موجات راديو","medium",2],
        ["ما اسم العملية التي تتكاثر فيها البكتيريا؟","الانقسام المتساوي","الانشطار الثنائي","الإخصاب","التبرعم","medium",1],
        ["ما أسرع الغازات انتشاراً؟","الأكسجين","الهيدروجين","الكربون","النيتروجين","hard",1],
        ["ما المادة المكوّنة لجدران خلايا النباتات؟","الغلوكوز","السليلوز","النشا","البروتين","medium",1],
        ["ما اسم أصغر وحدة في الحياة؟","الجين","الخلية","الذرة","الجزيء","easy",1],
        ["ما المعدن الذي يُستخدم في أعمدة البطاريات؟","النحاس","الحديد","الزنك","الألومنيوم","medium",2],
        ["كم عدد عناصر الجدول الدوري حتى الآن؟","٩٢","١٠٨","١١٨","١٢٦","hard",2],
        ["ما النوع من الطاقة الذي تحوّله ألواح الشمسية؟","الحرارية إلى كيميائية","الضوئية إلى كهربائية","الكيميائية إلى حرارية","الحركية إلى ضوئية","medium",1],
      ],
      "الفلك والفضاء": [
        ["كم يستغرق الضوء للانتقال من الشمس إلى الأرض تقريباً؟","٨ ثوانٍ","٨ دقائق","٨ ساعات","٨ أيام","medium",1],
        ["ما الكوكب الذي يملك أكبر عدد من الأقمار؟","المريخ","المشتري","زحل","أورانوس","medium",2],
        ["ما اسم أول قمر اصطناعي أُطلق في التاريخ؟","أبولو","سبوتنيك","فوياجر","هابل","medium",1],
        ["ما اسم المجرة الأقرب إلى مجرتنا درب التبانة؟","المثلث","أندروميدا","المغيلانية الكبرى","برنارد","hard",1],
        ["ما الظاهرة التي يحجب فيها ظل الأرض ضوء الشمس عن القمر؟","كسوف الشمس","خسوف القمر","المد والجزر","النيزك","easy",1],
        ["كم يستغرق القمر لإتمام دورة حول الأرض؟","٧ أيام","١٤ يوماً","٢٩.٥ يوماً","٣٦٥ يوماً","easy",2],
        ["ما الوقود الرئيسي للشمس؟","الأكسجين","الهيدروجين","الهيليوم","الميثان","medium",1],
        ["ما اسم أكبر تلسكوب فضائي أُطلق عام 2021؟","هابل","كيبلر","جيمس ويب","سبيتزر","medium",2],
        ["ما الكوكب الذي لديه حلقات بارزة جداً؟","المشتري","أورانوس","زحل","نبتون","easy",2],
        ["كم يبلغ قطر الشمس تقريباً مقارنةً بالأرض؟","١٠ أضعاف","٥٠ ضعفاً","١٠٩ أضعاف","١٠٠٠ ضعف","hard",2],
        ["كم يستغرق المريخ لإتمام دورة حول الشمس؟","٦ أشهر","سنة واحدة","١.٨٨ سنة","٣ سنوات","hard",2],
      ],
      "عواصم الدول العربية": [
        ["ما عاصمة فلسطين المعترف بها عربياً؟","غزة","رام الله","القدس","حيفا","easy",2],
        ["ما عاصمة دولة الإمارات العربية المتحدة؟","دبي","الشارقة","أبوظبي","العين","easy",2],
        ["ما عاصمة المغرب الإدارية (مقر الحكومة)؟","الدار البيضاء","مراكش","الرباط","فاس","medium",2],
        ["ما اسم عاصمة ليبيا؟","بنغازي","طرابلس","مصراتة","درنة","easy",1],
        ["ما عاصمة موريتانيا؟","نواكشوط","نواذيبو","كيفة","روصو","medium",0],
        ["ما عاصمة الصومال؟","هرجيسة","كيسمايو","مقديشو","بيدوا","medium",2],
        ["ما عاصمة جيبوتي؟","علي صبيح","تاجورة","جيبوتي","دخيل","medium",2],
        ["ما عاصمة جزر القمر؟","موروني","فومبوني","موتسامودو","دومبيني","hard",0],
        ["ما عاصمة السودان؟","بورتسودان","أم درمان","الخرطوم","كسلا","medium",2],
        ["ما عاصمة اليمن المعترف بها دولياً؟","عدن","تعز","صنعاء","الحديدة","easy",2],
        ["ما عاصمة العراق؟","البصرة","الموصل","بغداد","أربيل","easy",2],
        ["ما عاصمة لبنان؟","طرابلس","صيدا","بيروت","صور","easy",2],
        ["ما عاصمة قطر؟","الريان","الوكرة","الدوحة","الخور","easy",2],
      ],
      "معلومات عامة متنوعة": [
        ["من هو مؤسس شركة آبل؟","بيل غيتس","ستيف جوبز","إيلون ماسك","مارك زوكربيرج","easy",1],
        ["ما أكبر صحراء في العالم من حيث المساحة؟","الصحراء الكبرى","ربع الخالي","صحراء القطب الجنوبي","غوبي","hard",2],
        ["كم عدد دول مجلس التعاون الخليجي؟","٤","٥","٦","٧","easy",2],
        ["ما أعلى جبل في العالم؟","K2","إيفرست","كيليمنجارو","مونت بلان","easy",1],
        ["من يُعدّ أول رئيس للولايات المتحدة الأمريكية؟","أبراهام لنكولن","توماس جفرسون","جورج واشنطن","بنجامين فرانكلين","easy",2],
        ["ما عاصمة الفاتيكان؟","روما","مدينة الفاتيكان","ميلانو","فلورنسا","medium",1],
        ["في أي دولة يوجد نهر النيل في معظمه؟","إثيوبيا","السودان","مصر","يمر بكل هذه","medium",3],
        ["ما عدد نجوم علم الاتحاد الأوروبي؟","١٠","١٢","١٥","٢٥","hard",1],
        ["ما أكبر محيط في العالم؟","الأطلسي","الهندي","الهادئ","المتجمد الشمالي","easy",2],
      ],
      "حساب وأرقام": [
        ["ما ناتج 17 × 13؟","٢١٠","٢٢١","٢٣١","٢٠٩","medium",1],
        ["ما الجذر التربيعي للعدد 225؟","١٣","١٤","١٥","١٦","medium",2],
        ["ما ناتج 20% من 350؟","٦٠","٦٥","٧٠","٧٥","easy",2],
        ["إذا كان مجموع عددين 50 وفرقهما 10، فما العدد الأكبر؟","٢٠","٢٥","٣٠","٣٥","medium",2],
        ["ما ناتج 3³ ÷ 3؟","٣","٦","٩","٢٧","medium",2],
        ["كم عدد الدرجات في الدائرة الكاملة؟","١٨٠","٢٧٠","٣٦٠","٤٥٠","easy",2],
        ["ما ناتج 1001 - 298؟","٦٩٣","٧٠٣","٧١٣","٦٨٣","medium",1],
        ["ما النسبة المئوية للكسر ½؟","٢٥٪","٤٠٪","٥٠٪","٦٠٪","easy",2],
        ["ما ناتج 6! (6 مضروبة)؟","٣٦","٧٢٠","١٢٠","٤٠٣٢٠","medium",1],
        ["كم يساوي 0.5 + 0.25؟","٠٫٦٢٥","٠٫٧٠","٠٫٧٥","٠٫٨٠","easy",2],
      ],
      "قواعد اللغة العربية": [
        ["ما علامة نصب الاسم المفرد؟","الضمة","الفتحة","الكسرة","السكون","easy",1],
        ["ما اسم الفاعل من فعل «كتب»؟","مكتوب","كتّاب","كاتب","كتابة","easy",2],
        ["أيٌّ من التالي اسم فاعل؟","مقروء","قراءة","قارئ","مقرأة","medium",2],
        ["ما المصدر من فعل «تعلّم»؟","تعليم","علم","تعلُّم","معلوم","medium",2],
        ["ما جمع المؤنث السالم لكلمة «معلمة»؟","معلمون","معلمات","معالم","معلمة","easy",1],
        ["ما إعراب «في» في جملة «جلستُ في البيت»؟","اسم","فعل","حرف جر","أداة شرط","easy",2],
        ["ما علامة جزم الفعل المضارع الصحيح الآخر؟","الفتحة","السكون","الكسرة","حذف النون","medium",1],
        ["ما نوع المفعول به في «قرأتُ كتاباً»؟","صريح","مؤوّل","مطلق","لأجله","medium",0],
        ["أيٌّ من الآتي يُعرب بالحروف؟","المثنى","الاسم المفرد","جمع التكسير","المصدر","medium",0],
        ["ما اسم المفعول من فعل «علّم»؟","عالم","معلوم","معلَّم","تعليم","medium",2],
        ["ما الذي يُعرب نعتاً في الجملة؟","التمييز","الصفة","الحال","المفعول به","easy",1],
        ["ما نوع الجملة الاسمية؟","تبدأ بفعل","تبدأ باسم","تبدأ بحرف","تبدأ بظرف","easy",1],
        ["ما إعراب الفعل المضارع المسبوق بـ«لن»؟","مرفوع","مجزوم","منصوب","مبني","medium",2],
        ["ما إعراب الفعل المضارع المسبوق بـ«لم»؟","مرفوع","منصوب","مجزوم","مبني","medium",2],
      ],
      "عواصم دول العالم": [
        ["ما عاصمة أمريكا؟","نيويورك","لوس أنجلوس","واشنطن","شيكاغو","easy",2],
        ["ما عاصمة سويسرا؟","جنيف","زيورخ","برن","بازل","medium",2],
        ["ما عاصمة اليونان؟","إسطنبول","أثينا","نيقوسيا","تيرانا","easy",1],
        ["ما عاصمة رومانيا؟","صوفيا","براغ","بخارست","وارسو","medium",2],
        ["ما عاصمة المجر؟","براتيسلافا","بودابست","فيينا","لوبليانا","medium",1],
        ["ما عاصمة أوكرانيا؟","لفيف","أوديسا","خاركيف","كييف","medium",3],
        ["ما عاصمة نيوزيلندا؟","أوكلاند","كرايستشيرش","ويلينغتون","هاميلتون","medium",2],
        ["ما عاصمة إثيوبيا؟","نيروبي","كمبالا","أديس أبابا","خرطوم","medium",2],
        ["ما عاصمة الأرجنتين؟","ساو باولو","بوينس آيرس","سانتياغو","ليما","easy",1],
        ["ما عاصمة بولندا؟","براغ","فيينا","وارسو","بودابست","medium",2],
      ],
      "أحاديث شريفة": [
        ["ما معنى «التبسّم في وجه أخيك صدقة»؟","إعطاء الصدقة واجب","البشاشة والطلاقة حسنة","الضحك فرض","التبسم ينقص الحسنات","easy",1],
        ["أكمل الحديث: «من كان يؤمن بالله واليوم الآخر فليقل...»","خيراً أو ليكفر","خيراً أو ليصمت","خيراً أو ليرحل","الحقيقة فقط","medium",1],
        ["ما الحديث الذي يحثّ على إتقان العمل؟","إن الله يحب إذا عمل أحدكم عملاً أن يتقنه","العمل شرف","الله مع الصابرين","الأمانة خير","medium",0],
        ["ما معنى «الحياء شعبة من الإيمان»؟","الحياء ليس من الدين","الحياء جزء لا يتجزأ من الإيمان","الإيمان لا يحتاج حياء","الحياء ضعف","easy",1],
        ["أكمل: «من لا يشكر الناس...»","لا يُكافأ","لا يشكر الله","لا يُقبل منه","لا يُغفر له","medium",1],
        ["ما ركن الإسلام الخامس؟","الزكاة","الصيام","الحج","الجهاد","easy",2],
        ["ما المقصود بـ«الأمانة»؟","حفظ السرّ فقط","ردّ الودائع والوفاء بالعهد","عدم الكذب","العدل فقط","medium",1],
        ["أكمل: «لا يؤمن أحدكم حتى يحبّ لأخيه...»","ما يحبّ لأهله","ما يحبّ لنفسه","ما يحبّ للأمة","الخير كله","easy",1],
        ["ما المقصود بحديث «اتق الله حيثما كنت»؟","الصلاة في كل مكان","مراقبة الله في السر والعلن","أداء الزكاة","الصدق مع الناس","medium",1],
        ["أكمل: «المسلم من سَلِمَ الناس من...»","يده وصوته","يده ولسانه","قلبه ويده","لسانه وعينه","easy",1],
        ["ما الحديث الذي يدلّ على فضل طلب العلم؟","طلب العلم فريضة على كل مسلم","العلم نور","طالب العلم يستغفر له الملائكة","كلاهما أ وج","easy",0],
        ["أكمل: «إنما الأعمال بالنيات وإنما لكل امرئ...»","ما أراد","ما نوى","ما كسب","ما قصد","easy",1],
      ],
      "تقنية ومعلوماتية": [
        ["ما اختصار CPU؟","وحدة الذاكرة المركزية","وحدة المعالجة المركزية","وحدة الطاقة المركزية","وحدة الإخراج المركزية","easy",1],
        ["ما اختصار RAM؟","ذاكرة الوصول العشوائي","ذاكرة القراءة فقط","وحدة التخزين الدائم","وحدة المعالجة","easy",0],
        ["ما اختصار HTML؟","لغة تصميم الصفحات","لغة ترميز النص التشعبي","لغة البرمجة النصية","لغة الوصف المتقدم","medium",1],
        ["من مؤسس شركة مايكروسوفت؟","ستيف جوبز","مارك زوكربيرج","بيل غيتس","لاري بيدج","easy",2],
        ["ما عدد بتات في البايت الواحد؟","٤","٦","٨","١٦","easy",2],
        ["ما اسم نظام التشغيل الذي تطوّره شركة آبل للحاسوب؟","ويندوز","أندرويد","macOS","لينكس","easy",2],
        ["ما معنى Wi-Fi كمصطلح تقني؟","تقنية إرسال لاسلكي","شبكة التردد اللاسلكي","مصطلح تجاري لتقنية الشبكات اللاسلكية","الشبكة العالمية","hard",2],
        ["ما لغة البرمجة المستخدمة أساساً لتطوير مواقع الويب؟","Python","C++","JavaScript","Swift","easy",2],
        ["ما محرك البحث الأكثر استخداماً في العالم؟","Bing","Yahoo","Google","DuckDuckGo","easy",2],
        ["ما اختصار URL؟","معرف الموارد الموحد","محدد موقع الموارد الموحد","عنوان الشبكة الموحد","بروتوكول الإنترنت","medium",1],
        ["من هو المؤسس المشارك لموقع تويتر؟","مارك زوكربيرج","جاك دورسي","إيلون ماسك","بيل غيتس","medium",1],
        ["ما الجيل الحالي لشبكات الهاتف المحمول الأوسع انتشاراً؟","3G","4G","5G","6G","easy",2],
        ["ما اختصار AI؟","الأتمتة الصناعية","الذكاء الاصطناعي","نظم المعلومات","الواقع المعزز","easy",1],
      ],
      "أدب عربي وشعر": [
        ["من هو شاعر النيل؟","المتنبي","حافظ إبراهيم","أبو تمام","أبو نواس","medium",1],
        ["من صاحب قصيدة «على قدر أهل العزم تأتي العزائم»؟","البحتري","ابن الرومي","المتنبي","أبو نواس","medium",2],
        ["من كتب رواية «الأيام»؟","نجيب محفوظ","طه حسين","توفيق الحكيم","إحسان عبد القدوس","medium",1],
        ["من كتب «ألف ليلة وليلة»؟","ابن بطوطة","مؤلف مجهول عبر الأجيال","المتنبي","الجاحظ","hard",1],
        ["بماذا اشتُهر الجاحظ؟","شاعر عباسي","أديب وكاتب وعالم عباسي","فيلسوف يوناني","مؤرخ أندلسي","medium",1],
        ["ما مطلع معلقة امرئ القيس الشهيرة؟","قفا نبكِ","عفت الديار","أمن آل مية","هل غادر الشعراء","medium",0],
        ["في أي عصر عاش أبو العلاء المعري؟","الجاهلي","الأموي","العباسي","الأندلسي","medium",2],
        ["ما المقامات في الأدب العربي؟","قصائد شعرية طويلة","نثر فني يمزج اللغة بالحكمة والمفاجأة","خطب دينية","رسائل رسمية","hard",1],
        ["من يُلقّب بـ«أمير الشعراء»؟","المتنبي","أحمد شوقي","حافظ إبراهيم","أبو تمام","medium",1],
        ["ما اسم أشهر كتاب للجاحظ؟","الأغاني","البيان والتبيين","الفهرست","العقد الفريد","hard",1],
        ["من كتب رواية «موسم الهجرة إلى الشمال»؟","نجيب محفوظ","الطيب صالح","غسان كنفاني","يوسف إدريس","hard",1],
        ["ما أشهر أعمال نجيب محفوظ؟","الزيني بركات","ثلاثية القاهرة","موسم الهجرة","رجال في الشمس","medium",1],
        ["من هو أبو نواس وبماذا اشتُهر؟","شاعر الحكمة العباسي","شاعر المديح الأموي","شاعر الخمريات والهجاء العباسي","شاعر الرثاء الجاهلي","medium",2],
        ["ما البحر الشعري الأشيع في قصائد المتنبي؟","الكامل","البسيط","الطويل","الوافر","hard",2],
        ["من كتب ديوان «أوراق الزيتون»؟","محمود درويش","نزار قباني","أدونيس","سميح القاسم","medium",0],
        ["ما اسم أشهر مسرحية لتوفيق الحكيم؟","عودة الروح","الملك أوديب","أهل الكهف","شجرة الحكمة","hard",2],
        ["ما نوع الأدب الذي اشتُهر به ابن المقفع؟","الشعر الغزلي","الترجمة والنثر الأدبي","الخطابة الدينية","النقد الأدبي","hard",1],
        ["من هو صاحب كتاب «مقدمة ابن خلدون»؟","ابن بطوطة","ابن خلدون","ابن رشد","ابن سينا","easy",1],
      ],
    };

    // ── 1. Dedup ──────────────────────────────────────────────────────────
    const dedupRes = await db.execute(sql`
      DELETE FROM islamic_questions
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM islamic_questions
        GROUP BY category_id, LOWER(TRIM(question_text))
      )
    `);
    const deletedCount = (dedupRes as any).rowCount ?? 0;

    // ── 2. Insert new questions ───────────────────────────────────────────
    let totalInserted = 0;
    const details: Record<string, number> = {};

    for (const [categoryName, questions] of Object.entries(NEW_QUESTIONS)) {
      const [cat] = await db
        .select({ id: islamicCategoriesTable.id })
        .from(islamicCategoriesTable)
        .where(eq(islamicCategoriesTable.name, categoryName))
        .limit(1);

      if (!cat) { details[categoryName] = 0; continue; }

      const existingRows = await db
        .select({ qt: sql<string>`LOWER(TRIM(${islamicQuestionsTable.questionText}))` })
        .from(islamicQuestionsTable)
        .where(eq(islamicQuestionsTable.categoryId, cat.id));

      const existingSet = new Set(existingRows.map((r) => r.qt));
      let inserted = 0;

      for (const [text, a, b, c, d, diff, correctIdx] of questions) {
        if (existingSet.has(text.toLowerCase().trim())) continue;
        const correct = ["A", "B", "C", "D"][correctIdx];
        await db.insert(islamicQuestionsTable).values({
          categoryId: cat.id,
          questionText: text,
          optionA: a,
          optionB: b,
          optionC: c,
          optionD: d,
          correctAnswer: correct,
          difficulty: diff,
        });
        inserted++;
        existingSet.add(text.toLowerCase().trim());
      }

      details[categoryName] = inserted;
      totalInserted += inserted;
    }

    req.log.info({ deletedCount, totalInserted }, "admin dedup-islamic-questions done");
    res.json({ ok: true, deletedDuplicates: deletedCount, newQuestionsInserted: totalInserted, details });
  } catch (err) {
    req.log.error({ err }, "admin dedup-islamic-questions error");
    res.status(500).json({ message: "خطأ في التنظيف" });
  }
});

/* ── POST /admin/fix-islamic-correct-answers ──────────────────────────────
   Fixes islamic_questions rows where correct_answer is stored as a letter
   (A/B/C/D) or as partial text that doesn't match any option exactly.
   Admin-only, idempotent. */
router.post("/admin/fix-islamic-correct-answers", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const client = await pool.connect();
    try {
      // Fix letter-based answers
      const letterRes = await client.query(`
        UPDATE islamic_questions SET correct_answer = CASE
          WHEN correct_answer = 'A' THEN option_a
          WHEN correct_answer = 'B' THEN option_b
          WHEN correct_answer = 'C' THEN option_c
          WHEN correct_answer = 'D' THEN option_d
        END
        WHERE correct_answer IN ('A','B','C','D')
      `);
      const letterFixed = letterRes.rowCount ?? 0;

      // Fix partial-text answers
      const partialRes = await client.query(`
        UPDATE islamic_questions SET correct_answer = CASE
          WHEN option_a ILIKE '%' || correct_answer || '%' OR correct_answer ILIKE '%' || option_a || '%' THEN option_a
          WHEN option_b ILIKE '%' || correct_answer || '%' OR correct_answer ILIKE '%' || option_b || '%' THEN option_b
          WHEN option_c ILIKE '%' || correct_answer || '%' OR correct_answer ILIKE '%' || option_c || '%' THEN option_c
          WHEN option_d ILIKE '%' || correct_answer || '%' OR correct_answer ILIKE '%' || option_d || '%' THEN option_d
        END
        WHERE correct_answer != option_a AND correct_answer != option_b
          AND correct_answer != option_c AND correct_answer != option_d
          AND (
            option_a ILIKE '%' || correct_answer || '%' OR correct_answer ILIKE '%' || option_a || '%' OR
            option_b ILIKE '%' || correct_answer || '%' OR correct_answer ILIKE '%' || option_b || '%' OR
            option_c ILIKE '%' || correct_answer || '%' OR correct_answer ILIKE '%' || option_c || '%' OR
            option_d ILIKE '%' || correct_answer || '%' OR correct_answer ILIKE '%' || option_d || '%'
          )
      `);
      const partialFixed = partialRes.rowCount ?? 0;

      const stillBroken = await client.query(`
        SELECT COUNT(*)::int AS n FROM islamic_questions
        WHERE correct_answer != option_a AND correct_answer != option_b
          AND correct_answer != option_c AND correct_answer != option_d
      `);

      req.log.info({ letterFixed, partialFixed }, "fix-islamic-correct-answers done");
      res.json({ ok: true, letterFixed, partialFixed, stillBroken: stillBroken.rows[0].n });
    } finally { client.release(); }
  } catch (err) {
    req.log.error({ err }, "fix-islamic-correct-answers error");
    res.status(500).json({ message: "حدث خطأ" });
  }
});

export { getPublicVisibility };
export default router;
