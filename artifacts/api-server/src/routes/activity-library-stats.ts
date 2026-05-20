import { Router, type IRouter } from "express";
import {
  db,
  assignmentsTable,
  questionBankTable,
  videoLessonsTable,
  presentationsTable,
  gameHistoryTable,
  submissionsTable,
  videoSubmissionsTable,
  presentationSessionsTable,
} from "@workspace/db";
import { and, eq, ne, or, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    return res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
  }
  next();
}

/** Shared homework library rows (platform-wide moderation filter). */
const sharedHomeworkAssignmentFilter = and(
  eq(assignmentsTable.isShared, true),
  ne(assignmentsTable.accessMode, "private"),
  eq(assignmentsTable.hiddenByAdmin, false),
  or(eq(assignmentsTable.contentKind, "homework"), eq(assignmentsTable.contentKind, "both")),
);

const sharedQuestionFilter = and(
  eq(questionBankTable.isShared, true),
  eq(questionBankTable.hiddenByAdmin, false),
);

const sharedVideoFilter = and(
  eq(videoLessonsTable.isShared, true),
  eq(videoLessonsTable.hiddenByAdmin, false),
);

const sharedPresentationFilter = eq(presentationsTable.isShared, true);

/**
 * GET /api/teacher/activity-library/stats
 * Platform-wide stats for مكتبة الأنشطة (homework library).
 */
router.get("/teacher/activity-library/stats", requireAuth, async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      assignmentCountRow,
      questionCountRow,
      videoCountRow,
      presentationCountRow,
      assignmentTeachers,
      questionTeachers,
      videoTeachers,
      presentationTeachers,
      newAssignments,
      newQuestions,
      newVideos,
      newPresentations,
      gameUsesRow,
      submissionUsesRow,
      videoUsesRow,
      presentationUsesRow,
      assignmentUseRows,
      videoUseRows,
    ] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(assignmentsTable)
        .where(sharedHomeworkAssignmentFilter),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(questionBankTable)
        .where(sharedQuestionFilter),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(videoLessonsTable)
        .where(sharedVideoFilter),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(presentationsTable)
        .where(sharedPresentationFilter),
      db
        .selectDistinct({ teacherId: assignmentsTable.teacherId })
        .from(assignmentsTable)
        .where(sharedHomeworkAssignmentFilter),
      db
        .selectDistinct({ teacherId: questionBankTable.teacherId })
        .from(questionBankTable)
        .where(sharedQuestionFilter),
      db
        .selectDistinct({ teacherId: videoLessonsTable.teacherId })
        .from(videoLessonsTable)
        .where(sharedVideoFilter),
      db
        .selectDistinct({ teacherId: presentationsTable.teacherId })
        .from(presentationsTable)
        .where(sharedPresentationFilter),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(assignmentsTable)
        .where(and(sharedHomeworkAssignmentFilter, gte(assignmentsTable.createdAt, weekAgo))),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(questionBankTable)
        .where(and(sharedQuestionFilter, gte(questionBankTable.createdAt, weekAgo))),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(videoLessonsTable)
        .where(and(sharedVideoFilter, gte(videoLessonsTable.createdAt, weekAgo))),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(presentationsTable)
        .where(and(sharedPresentationFilter, gte(presentationsTable.createdAt, weekAgo))),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(gameHistoryTable)
        .innerJoin(assignmentsTable, eq(gameHistoryTable.assignmentId, assignmentsTable.id))
        .where(sharedHomeworkAssignmentFilter),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(submissionsTable)
        .innerJoin(assignmentsTable, eq(submissionsTable.assignmentId, assignmentsTable.id))
        .where(sharedHomeworkAssignmentFilter),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(videoSubmissionsTable)
        .innerJoin(videoLessonsTable, eq(videoSubmissionsTable.videoLessonId, videoLessonsTable.id))
        .where(sharedVideoFilter),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(presentationSessionsTable)
        .innerJoin(presentationsTable, eq(presentationSessionsTable.presentationId, presentationsTable.id))
        .where(sharedPresentationFilter),
      db
        .select({
          id: assignmentsTable.id,
          plays: sql<number>`(
            SELECT COUNT(*)::int FROM ${gameHistoryTable}
            WHERE ${gameHistoryTable.assignmentId} = ${assignmentsTable.id}
          )`,
          subs: sql<number>`(
            SELECT COUNT(*)::int FROM ${submissionsTable}
            WHERE ${submissionsTable.assignmentId} = ${assignmentsTable.id}
          )`,
        })
        .from(assignmentsTable)
        .where(sharedHomeworkAssignmentFilter),
      db
        .select({
          id: videoLessonsTable.id,
          uses: sql<number>`(
            SELECT COUNT(*)::int FROM ${videoSubmissionsTable}
            WHERE ${videoSubmissionsTable.videoLessonId} = ${videoLessonsTable.id}
          )`,
        })
        .from(videoLessonsTable)
        .where(sharedVideoFilter),
    ]);

    const teacherIds = new Set<number>();
    for (const row of [
      ...assignmentTeachers,
      ...questionTeachers,
      ...videoTeachers,
      ...presentationTeachers,
    ]) {
      if (row.teacherId != null) teacherIds.add(row.teacherId);
    }

    const totalActivities =
      (assignmentCountRow[0]?.n ?? 0) +
      (questionCountRow[0]?.n ?? 0) +
      (videoCountRow[0]?.n ?? 0) +
      (presentationCountRow[0]?.n ?? 0);

    const newThisWeek =
      (newAssignments[0]?.n ?? 0) +
      (newQuestions[0]?.n ?? 0) +
      (newVideos[0]?.n ?? 0) +
      (newPresentations[0]?.n ?? 0);

    const totalUses =
      (gameUsesRow[0]?.n ?? 0) +
      (submissionUsesRow[0]?.n ?? 0) +
      (videoUsesRow[0]?.n ?? 0) +
      (presentationUsesRow[0]?.n ?? 0);

    const assignmentUses: Record<string, number> = {};
    for (const row of assignmentUseRows) {
      assignmentUses[String(row.id)] = (row.plays ?? 0) + (row.subs ?? 0);
    }

    const videoUses: Record<string, number> = {};
    for (const row of videoUseRows) {
      videoUses[String(row.id)] = row.uses ?? 0;
    }

    res.json({
      totalActivities,
      contributingTeachers: teacherIds.size,
      totalUses,
      newThisWeek,
      assignmentUses,
      videoUses,
      presentationUses: presentationUsesRow[0]?.n ?? 0,
      // Question-bank items have no per-item usage log in DB — card footer shows 0.
      questionUsesTracked: false,
    });
  } catch (err) {
    req.log?.error?.(err, "Activity library stats error");
    res.status(500).json({ message: "خطأ في تحميل الإحصائيات" });
  }
});

export default router;
