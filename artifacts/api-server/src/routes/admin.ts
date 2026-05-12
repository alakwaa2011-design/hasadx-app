import { Router, type IRouter, type Request, type Response } from "express";
import { db, pool, teachersTable, studentsTable, assignmentsTable, submissionsTable, questionBankTable, platformSettingsTable, adventureGamesTable, videoLessonsTable, tugTemplatesTable, memoryCardSetsTable, studentAccountsTable, teacherLibraryFilesTable, DEFAULT_PRESENTATION_LIMITS, DEFAULT_ARENA_IMPORT_SOURCES } from "@workspace/db";
import { eq, sql, desc, and, isNotNull, inArray } from "drizzle-orm";
import { ObjectStorageService } from "../lib/objectStorage";
import { z } from "zod";

const adminObjectStorage = new ObjectStorageService();

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

const router: IRouter = Router();

router.get("/stats/public", async (req, res) => {
  try {
    const [
      [{ count: teacherCount }],
      [{ count: assignmentCount }],
      [{ count: studentCount }],
      [{ count: submissionCount }],
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(teachersTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(assignmentsTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(studentsTable),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(submissionsTable),
    ]);
    res.json({ teacherCount, assignmentCount, studentCount, submissionCount });
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
      })
      .from(teachersTable)
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
  const [row] = await db.select().from(platformSettingsTable).limit(1);
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
    classroomEnabled: row?.classroomEnabled ?? false,
    classroomAllowedEmails: row?.classroomAllowedEmails ?? [],
    arenaImportSources: row?.arenaImportSources ?? { ...DEFAULT_ARENA_IMPORT_SOURCES },
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
    const { publicVisibility, guestLimit, primaryColor, accentColor, fontFamily, platformName, logoUrl, showAdventureGamesHome, showSpaceRaceGamesHome, showFlagsGame, showColorGame, showMemoryGame, showMultiplyGame, showScrambleGame, showTugGame, showCapitalsGame, proAiForAll, presentationsProForAll, presentationLimits, showQuranSection, showGeneralCertificates, showMaraqui, classroomEnabled, classroomAllowedEmails, arenaImportSources } = req.body;

    const update: Record<string, unknown> = {};

    if (publicVisibility !== undefined) {
      if (!["all", "none", "selective"].includes(publicVisibility)) {
        return res.status(400).json({ message: "publicVisibility غير صالح" });
      }
      update.publicVisibility = publicVisibility;
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
    if (showAdventureGamesHome !== undefined) update.showAdventureGamesHome = Boolean(showAdventureGamesHome);
    if (showSpaceRaceGamesHome !== undefined) update.showSpaceRaceGamesHome = Boolean(showSpaceRaceGamesHome);
    if (showFlagsGame !== undefined) update.showFlagsGame = Boolean(showFlagsGame);
    if (showColorGame !== undefined) update.showColorGame = Boolean(showColorGame);
    if (showMemoryGame !== undefined) update.showMemoryGame = Boolean(showMemoryGame);
    if (showMultiplyGame !== undefined) update.showMultiplyGame = Boolean(showMultiplyGame);
    if (showScrambleGame !== undefined) update.showScrambleGame = Boolean(showScrambleGame);
    if (showTugGame !== undefined) update.showTugGame = Boolean(showTugGame);
    if (showCapitalsGame !== undefined) update.showCapitalsGame = Boolean(showCapitalsGame);
    if (proAiForAll !== undefined) update.proAiForAll = Boolean(proAiForAll);
    if (presentationsProForAll !== undefined) update.presentationsProForAll = Boolean(presentationsProForAll);
    if (presentationLimits !== undefined) {
      const parsed = PresentationLimitsSchema.safeParse(presentationLimits);
      if (!parsed.success) {
        return res.status(400).json({ message: "presentationLimits غير صالح" });
      }
      update.presentationLimits = parsed.data;
    }
    if (showQuranSection !== undefined) update.showQuranSection = Boolean(showQuranSection);
    if (showGeneralCertificates !== undefined) update.showGeneralCertificates = Boolean(showGeneralCertificates);
    if (showMaraqui !== undefined) update.showMaraqui = Boolean(showMaraqui);
    if (classroomEnabled !== undefined) update.classroomEnabled = Boolean(classroomEnabled);
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
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "لا توجد حقول للتحديث" });
    }

    const current = await getPlatformSettings();
    await db
      .insert(platformSettingsTable)
      .values({ id: 1, publicVisibility: current.publicVisibility, guestLimit: current.guestLimit, ...update })
      .onConflictDoUpdate({ target: platformSettingsTable.id, set: update });

    const updated = await getPlatformSettings();
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
    await db.update(assignmentsTable).set({ isShareApproved: true }).where(eq(assignmentsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err, "Failed to approve share");
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
    await db.update(assignmentsTable)
      .set({ hiddenByAdmin: true, hiddenAt: new Date(), hiddenById: ctx.adminId, hideReason: body.reason ?? null })
      .where(eq(assignmentsTable.id, ctx.id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to hide assignment"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/assignments/:id/unhide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    await db.update(assignmentsTable)
      .set({ hiddenByAdmin: false, hiddenAt: null, hiddenById: null, hideReason: null })
      .where(eq(assignmentsTable.id, ctx.id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to unhide assignment"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/question-bank/:id/hide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    const body = HideBody.parse(req.body ?? {});
    await db.update(questionBankTable)
      .set({ hiddenByAdmin: true, hiddenAt: new Date(), hiddenById: ctx.adminId, hideReason: body.reason ?? null })
      .where(eq(questionBankTable.id, ctx.id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to hide question"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/question-bank/:id/unhide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    await db.update(questionBankTable)
      .set({ hiddenByAdmin: false, hiddenAt: null, hiddenById: null, hideReason: null })
      .where(eq(questionBankTable.id, ctx.id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to unhide question"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/video-lessons/:id/hide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    const body = HideBody.parse(req.body ?? {});
    await db.update(videoLessonsTable)
      .set({ hiddenByAdmin: true, hiddenAt: new Date(), hiddenById: ctx.adminId, hideReason: body.reason ?? null })
      .where(eq(videoLessonsTable.id, ctx.id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to hide video"); res.status(500).json({ message: "حدث خطأ" }); }
});

router.patch("/admin/video-lessons/:id/unhide", async (req, res) => {
  try {
    const ctx = await parseIdAndAdmin(req, res); if (!ctx) return;
    await db.update(videoLessonsTable)
      .set({ hiddenByAdmin: false, hiddenAt: null, hiddenById: null, hideReason: null })
      .where(eq(videoLessonsTable.id, ctx.id));
    res.json({ success: true });
  } catch (err) { req.log.error({ err }, "Failed to unhide video"); res.status(500).json({ message: "حدث خطأ" }); }
});

export { getPublicVisibility };
export default router;
