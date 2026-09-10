import { Router, type IRouter } from "express";
import { db, assignmentsTable, assignmentRevisionsTable, questionsTable, teachersTable, notificationsTable, gameHistoryTable, dismissedSharedTable, studentsTable, submissionsTable, teacherClassesTable, videoLessonsTable, videoQuestionsTable, videoSubmissionsTable, soloChallengesTable } from "@workspace/db";
import { eq, sql, and, ne, notInArray, inArray, isNull, isNotNull, or } from "drizzle-orm";
import {
  CreateAssignmentBody,
  GetAssignmentParams,
  DeleteAssignmentParams,
  ListAssignmentsQueryParams,
} from "@workspace/api-zod";
import { z } from "zod";
import { publicReadLimiter } from "../lib/rate-limiter";
import { safeAccessCodeEqual } from "../lib/access-code";
import { featureAccess } from "@workspace/billing";
import { logActivity } from "../lib/activity-logger";
import { trackEvent } from "../lib/analytics";
import { awardXpInTxAndNotifyAfterCommit } from "../lib/xp/socket";

const UpdateAssignmentBody = z.object({
  version: z.number().int().positive(),
  title: z.string().min(1).optional(),
  subject: z.string().min(1).nullish(),
  description: z.string().nullish(),
  submissionMode: z.enum(["electronic", "paper", "both"]).optional(),
  accessMode: z.enum(["public", "private"]).optional(),
  accessCode: z.string().nullish(),
  targetClass: z.string().nullish(),
  targetClasses: z.array(z.string()).nullish(),
  categoryId: z.number().nullish(),
  showResults: z.boolean().optional(),
  deadline: z.string().datetime({ offset: true }).nullish().or(z.literal("").transform(() => null)),
  examMode: z.boolean().optional(),
  examDurationMinutes: z.number().int().positive().nullish(),
  resultsReleaseMode: z.enum(["immediate", "after_deadline", "manual"]).optional(),
  aiGradingInstructions: z.string().nullish(),
  isShared: z.boolean().optional(),
  displayTotalPoints: z.number().positive().nullish(),
  activityType: z.string().nullish(),
  listeningAudioText: z.string().nullish(),
  listeningVoice: z.string().nullish(),
  listeningSpeed: z.union([z.string(), z.number()]).nullish().transform((v) => v == null ? v : String(v)),
  listeningSettings: z.record(z.string(), z.any()).nullish(),
  questions: z.array(
    z.object({
      id: z.number().optional(),
      text: z.string().min(1),
      questionType: z.enum(["mcq", "true_false", "fill_blank", "whiteboard", "dictation", "open"]).default("mcq"),
      optionA: z.string().nullish(),
      optionB: z.string().nullish(),
      optionC: z.string().nullish(),
      optionD: z.string().nullish(),
      correctAnswer: z.string().nullish(),
      points: z.number().positive().default(1),
      imageUrl: z.string().nullish(),
      readAloud: z.boolean().optional(),
      allowMultipleAnswers: z.boolean().optional(),
      repeatQuestion: z.boolean().optional(),
    })
  ).min(1).optional(),
}).superRefine((body, ctx) => {
  if (body.examMode === true && body.examDurationMinutes != null && body.examDurationMinutes < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["examDurationMinutes"],
      message: "مدة الاختبار يجب أن تكون دقيقة واحدة على الأقل",
    });
  }

  body.questions?.forEach((question, index) => {
    const options = [question.optionA, question.optionB, question.optionC, question.optionD]
      .map((option) => option?.trim() ?? "")
      .filter(Boolean);

    if (question.questionType === "mcq") {
      if (options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index],
          message: "سؤال الاختيار من متعدد يحتاج خيارين على الأقل",
        });
      }
      const answer = question.correctAnswer?.trim().toUpperCase();
      if (!answer || !["A", "B", "C", "D"].includes(answer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "correctAnswer"],
          message: "يجب تحديد الإجابة الصحيحة",
        });
      } else {
        const optionByLetter: Record<string, string | null | undefined> = {
          A: question.optionA,
          B: question.optionB,
          C: question.optionC,
          D: question.optionD,
        };
        if (!optionByLetter[answer]?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["questions", index, "correctAnswer"],
            message: "لا يمكن اختيار خيار فارغ كإجابة صحيحة",
          });
        }
      }
    } else if (question.questionType === "true_false") {
      if (!["true", "false"].includes(question.correctAnswer ?? "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "correctAnswer"],
          message: "يجب تحديد إجابة صح أو خطأ",
        });
      }
    } else if (question.questionType === "fill_blank" && !question.correctAnswer?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questions", index, "correctAnswer"],
        message: "يجب كتابة إجابة سؤال الفراغ",
      });
    }
  });
});

const router: IRouter = Router();

export function hasAssignmentId<T extends { assignmentId: number | null }>(
  row: T,
): row is T & { assignmentId: number } {
  return row.assignmentId !== null;
}

async function isAdminTeacher(teacherId: number | undefined): Promise<boolean> {
  if (!teacherId) return false;
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
  return !!t?.isAdmin;
}

router.get("/assignments", async (req, res) => {
  try {
    const query = ListAssignmentsQueryParams.parse(req.query);
    const includeShared = (req.query.include as string | undefined) === "shared";
    const archived = req.query.archived === "true";
    if (!req.session?.teacherId) {
      res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
      return;
    }
    if (query.teacherId && query.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بعرض واجبات معلم آخر" });
      return;
    }

    const selectShape = {
      id: assignmentsTable.id,
      title: assignmentsTable.title,
      subject: assignmentsTable.subject,
      description: assignmentsTable.description,
      submissionMode: assignmentsTable.submissionMode,
      accessMode: assignmentsTable.accessMode,
      targetClass: assignmentsTable.targetClass,
      targetClasses: assignmentsTable.targetClasses,
      categoryId: assignmentsTable.categoryId,
      showResults: assignmentsTable.showResults,
      teacherId: assignmentsTable.teacherId,
      teacherName: teachersTable.name,
      isAdminContent: teachersTable.isAdmin,
      totalPoints: assignmentsTable.totalPoints,
      deadline: assignmentsTable.deadline,
      createdAt: assignmentsTable.createdAt,
      updatedAt: assignmentsTable.updatedAt,
      version: assignmentsTable.version,
      archivedAt: assignmentsTable.archivedAt,
      examMode: assignmentsTable.examMode,
      examDurationMinutes: assignmentsTable.examDurationMinutes,
      resultsReleaseMode: assignmentsTable.resultsReleaseMode,
      isShared: assignmentsTable.isShared,
      isShareApproved: assignmentsTable.isShareApproved,
      contentKind: assignmentsTable.contentKind,
      hiddenByAdmin: assignmentsTable.hiddenByAdmin,
      questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.assignment_id = ${assignmentsTable.id})`.as("question_count"),
      submissionCount: sql<number>`(SELECT COUNT(*) FROM submissions WHERE submissions.assignment_id = ${assignmentsTable.id})`.as("submission_count"),
      hasModelImage: sql<boolean>`(${assignmentsTable.modelImageBase64} IS NOT NULL)`.as("has_model_image"),
      isAdaptive: assignmentsTable.isAdaptive,
    };

    const baseQuery = db
      .select(selectShape)
      .from(assignmentsTable)
      .innerJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
      .orderBy(sql`${assignmentsTable.createdAt} DESC`);

    // Ownership is always relative to the authenticated requester (when available),
    // never to the optional teacherId filter. This keeps isOwn/shared semantics correct
    // even if a teacher passes ?teacherId=X for a different teacher.
    const requesterTeacherId = req.session?.teacherId ?? null;

    /* Exclude assignments auto-generated from presentation activity slides — they are
       reused internally by the launch-game endpoint and should not clutter the list. */
    const notFromPresentation = isNull(assignmentsTable.fromPresentationSlide);
    /* Also exclude internal assignments auto-created to power worksheet
       smart paper grading — the teacher manages those through the
       worksheet grading page, never through the assignments list. */
    const notInternal = and(
      notFromPresentation,
      sql`${assignmentsTable.source} IS DISTINCT FROM 'worksheet'`,
    );
    const archiveFilter = archived
      ? isNotNull(assignmentsTable.archivedAt)
      : isNull(assignmentsTable.archivedAt);

    let ownResults;
    if (query.teacherId) {
      ownResults = await baseQuery.where(and(eq(assignmentsTable.teacherId, query.teacherId), notInternal, archiveFilter));
    } else if (req.session?.teacherId) {
      ownResults = await baseQuery.where(and(eq(assignmentsTable.teacherId, req.session.teacherId), notInternal, archiveFilter));
    } else {
      ownResults = await baseQuery.where(and(notInternal, archiveFilter));
    }

    let sharedResults: typeof ownResults = [];
    if (includeShared && requesterTeacherId) {
      sharedResults = await db
        .select(selectShape)
        .from(assignmentsTable)
        .innerJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
        .where(
          and(
            // Approval gating was removed in task #595 — every shared row
            // is publicly visible by default; admins curate via hide.
          eq(assignmentsTable.isShared, true),
          isNull(assignmentsTable.archivedAt),
            eq(assignmentsTable.hiddenByAdmin, false),
            // Defensive privacy filter: private-access rows must never
            // appear in the shared library even if a stale isShared flag
            // ever leaks through.
            ne(assignmentsTable.accessMode, "private"),
            ne(assignmentsTable.teacherId, requesterTeacherId),
            isNull(assignmentsTable.archivedAt),
          ),
        )
        .orderBy(sql`${assignmentsTable.createdAt} DESC`);
    }

    const seen = new Set<number>();
    const merged: Array<(typeof ownResults)[number] & { isOwn: boolean; ownerName: string | null }> = [];
    for (const r of ownResults) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const isOwn = requesterTeacherId !== null ? r.teacherId === requesterTeacherId : true;
      merged.push({ ...r, isOwn, ownerName: r.teacherName });
    }
    for (const r of sharedResults) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      merged.push({ ...r, isOwn: false, ownerName: r.teacherName });
    }

    res.json(
      merged.map((r) => ({
        id: r.id,
        title: r.title,
        subject: r.subject,
        description: r.description,
        submissionMode: r.submissionMode,
        accessMode: r.accessMode,
        targetClass: r.targetClass,
        targetClasses: r.targetClasses,
        categoryId: r.categoryId,
        showResults: r.showResults,
        teacherId: r.teacherId,
        teacherName: r.teacherName,
        isAdminContent: !!r.isAdminContent,
        questionCount: Number(r.questionCount),
        submissionCount: Number(r.submissionCount),
        totalPoints: r.totalPoints,
        hasModelImage: !!r.hasModelImage,
        deadline: r.deadline ? r.deadline.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        version: r.version,
        archivedAt: r.archivedAt?.toISOString() ?? null,
        examMode: r.examMode,
        examDurationMinutes: r.examDurationMinutes,
        resultsReleaseMode: r.resultsReleaseMode,
        isAdaptive: r.isAdaptive,
        isShared: r.isShared,
        isShareApproved: r.isShareApproved,
        isOwn: r.isOwn,
        ownerName: r.ownerName,
      })),
    );
  } catch (error: any) {
    req.log.error({ err: error }, "List assignments error");
    res.status(500).json({ message: "خطأ في جلب الواجبات" });
  }
});

router.post("/assignments", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  // Policy 2026-08: manual work creation is never limited by plan quotas.
  // AI costs are governed exclusively by the Hasad credits system.
  const teacherId = req.session.teacherId;

  try {
    const body = CreateAssignmentBody.parse(req.body);

    const totalPoints = body.questions?.reduce((sum, q) => sum + (q.points || 1), 0) || 0;

    const isExam = body.examMode === true;
    const effectiveSubmissionMode = isExam ? "electronic" : (body.submissionMode || "both");

    if (isExam && body.resultsReleaseMode === "after_deadline" && !body.deadline) {
      res.status(400).json({ message: "يجب تحديد موعد تسليم عند اختيار عرض النتائج بعد انتهاء الموعد" });
      return;
    }

    if (body.questions) {
      for (const q of body.questions) {
        const qt = q.questionType || "mcq";
        if (qt === "true_false" && q.correctAnswer && !["true", "false"].includes(q.correctAnswer)) {
          res.status(400).json({ message: "إجابة سؤال صح/خطأ يجب أن تكون true أو false" });
          return;
        }
        if (qt === "mcq" && q.correctAnswer) {
          const validLetters = ["A", "B", "C", "D"];
          const parts = q.correctAnswer.split(",").map(s => s.trim());
          if (!parts.every(p => validLetters.includes(p))) {
            res.status(400).json({ message: "إجابة سؤال الاختيار يجب أن تكون من A أو B أو C أو D" });
            return;
          }
        }
      }
    }

    const effectiveAccessMode = body.accessMode || "public";
    let effectiveAccessCode: string | null = null;
    if (effectiveAccessMode === "private") {
      if (!body.accessCode || !body.accessCode.trim()) {
        res.status(400).json({ message: "يجب تحديد كود دخول للواجب الخاص" });
        return;
      }
      effectiveAccessCode = body.accessCode.trim().toUpperCase();
    }

    const { assignment, runAfterCommit } = await db.transaction(async (tx) => {
    const [assignmentRow] = await tx
      .insert(assignmentsTable)
      .values({
        title: body.title,
        subject: body.subject,
        description: body.description,
        submissionMode: effectiveSubmissionMode,
        accessMode: effectiveAccessMode,
        accessCode: effectiveAccessCode,
        targetClass: (Array.isArray((req.body as any).targetClasses) && (req.body as any).targetClasses.length > 0
          ? (req.body as any).targetClasses[0]
          : (body.targetClass || null)),
        targetClasses: (Array.isArray((req.body as any).targetClasses) && (req.body as any).targetClasses.length > 0
          ? (req.body as any).targetClasses.filter((c: any) => typeof c === "string" && c.trim()).map((c: string) => c.trim())
          : (body.targetClass ? [body.targetClass] : null)),
        categoryId: body.categoryId || null,
        showResults: body.showResults !== undefined ? body.showResults : true,
        modelImageBase64: body.modelImageBase64 || null,
        totalPoints,
        deadline: body.deadline ? new Date(body.deadline) : null,
        examMode: body.examMode || false,
        examDurationMinutes: body.examDurationMinutes || null,
        resultsReleaseMode: body.resultsReleaseMode || "immediate",
        aiGradingInstructions: body.aiGradingInstructions || null,
        // Sharing defaults to PUBLIC. Teachers can opt-out via the "make
        // private" toggle (sends isShared:false). All shares are
        // auto-approved — admins can later HIDE individual rows via
        // POST /admin/assignments/:id/hide.
        // Privacy invariant: an assignment with private access mode
        // is NEVER shared in the public library, regardless of the
        // client-supplied isShared value. Public-access assignments
        // default to shared and respect the explicit opt-out.
        isShared: effectiveAccessMode === "private" ? false : (body.isShared === false ? false : true),
        // Approval gating was removed — every new row is implicitly
        // approved. Admins can later HIDE individual rows via
        // PATCH /admin/assignments/:id/hide.
        isShareApproved: true,
        // Auto-tag: assignments auto-created from a presentation activity
        // slide are competitions by definition (task #599) — bypass the
        // explicit contentKind picker so the competitions library stays
        // current without relying on the teacher form.
        contentKind: (typeof (req.body as any)?.fromPresentationSlide === "string"
          && (req.body as any).fromPresentationSlide.trim().length > 0)
          ? "competition"
          : (body.contentKind === "competition" ? "competition" : "homework"),
        fromPresentationSlide: (typeof (req.body as any)?.fromPresentationSlide === "string"
          && (req.body as any).fromPresentationSlide.trim().length > 0)
          ? (req.body as any).fromPresentationSlide.trim()
          : null,
        isAdaptive: body.isAdaptive || false,
        adaptiveConfig: body.adaptiveConfig ? JSON.stringify(body.adaptiveConfig) : null,
        activityType: body.activityType || null,
        listeningAudioText: body.listeningAudioText || null,
        listeningVoice: body.listeningVoice || null,
        listeningSpeed: body.listeningSpeed || null,
        listeningSettings: body.listeningSettings ? JSON.stringify(body.listeningSettings) : null,
        teacherId,
      })
      .returning();

    if (body.questions && body.questions.length > 0) {
      await tx.insert(questionsTable).values(
        body.questions.map((q) => ({
          assignmentId: assignmentRow.id,
          questionType: q.questionType || "mcq",
          text: q.text,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
          points: q.points || 1,
          imageUrl: q.imageUrl || null,
          readAloud: q.readAloud ?? false,
          difficulty: q.difficulty ?? null,
          skill: q.skill?.trim() || null,
          allowMultipleAnswers: (q as any).allowMultipleAnswers ?? false,
          repeatQuestion: (q as any).repeatQuestion ?? false,
        })),
      );
    }

      const xp = await awardXpInTxAndNotifyAfterCommit(tx, {
        teacherId,
        actionKey: "assignment.create",
        refId: `assignment:${assignmentRow.id}`,
        reason: assignmentRow.title,
      });
      return { assignment: assignmentRow, runAfterCommit: xp.runAfterCommit };
    });

    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, req.session.teacherId))
      .limit(1);

    void runAfterCommit();

    res.status(201).json({
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      description: assignment.description,
      submissionMode: assignment.submissionMode,
      accessMode: assignment.accessMode,
      accessCode: assignment.accessCode,
      targetClass: assignment.targetClass,
      targetClasses: assignment.targetClasses,
      showResults: assignment.showResults,
      teacherId: assignment.teacherId,
      teacherName: teacher?.name || "",
      questionCount: body.questions?.length || 0,
      submissionCount: 0,
      totalPoints,
      hasModelImage: !!assignment.modelImageBase64,
      deadline: assignment.deadline ? assignment.deadline.toISOString() : null,
      createdAt: assignment.createdAt.toISOString(),
      examMode: assignment.examMode,
      examDurationMinutes: assignment.examDurationMinutes,
      resultsReleaseMode: assignment.resultsReleaseMode,
    });

    logActivity({
      req,
      userId: teacherId,
      userName: teacher?.name ?? null,
      userRole: "teacher",
      action: "create_homework",
      details: { assignmentId: assignment.id, title: assignment.title, subject: assignment.subject, questionCount: body.questions?.length || 0 },
    });
    trackEvent({
      req,
      userId: teacherId,
      userName: teacher?.name ?? null,
      userRole: "teacher",
      eventName: "assignment_created_success",
      eventCategory: "assignment",
      metadata: {
        assignmentId: assignment.id,
        subject: assignment.subject,
        questionCount: body.questions?.length || 0,
        examMode: assignment.examMode,
      },
    });
  } catch (error: unknown) {
    trackEvent({
      req,
      userId: teacherId,
      userRole: "teacher",
      eventName: "assignment_created_failed",
      eventCategory: "assignment",
      metadata: {
        reason: error instanceof z.ZodError
          ? "validation"
          : error instanceof Error
            ? error.message.slice(0, 200)
            : "unknown",
      },
    });
    const isZodError = error instanceof z.ZodError;
    const message = error instanceof Error ? error.message : "خطأ في إنشاء الواجب";
    req.log.error({ err: error, isAdaptive: req.body?.isAdaptive, stage: isZodError ? "validation" : "db_insert" }, "Create assignment error");
    if (isZodError) {
      res.status(400).json({ message: "بيانات غير صالحة: " + message });
    } else {
      res.status(500).json({ message: "خطأ في إنشاء الواجب" });
    }
  }
});

router.get("/assignments/shared", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const teacherId = req.session.teacherId!;
    const dismissed = await db
      .select({ itemId: dismissedSharedTable.itemId })
      .from(dismissedSharedTable)
      .where(and(
        eq(dismissedSharedTable.teacherId, teacherId),
        eq(dismissedSharedTable.itemType, "assignment")
      ));
    const dismissedIds = dismissed.map(d => d.itemId);

    // ?kind=homework|competition narrows the public library. When omitted we
    // return both so existing clients keep working.
    const kindParam = (req.query.kind as string | undefined);
    const kindFilter = kindParam === "competition" || kindParam === "homework" ? kindParam : null;

    // Admins may opt in to seeing hidden rows from the same endpoint by
    // passing ?showHidden=1 — used by the moderation tab. Non-admins
    // never see hidden content even with the flag.
    const wantHidden = req.query.showHidden === "1" || req.query.showHidden === "true";
    const isAdminRequester = wantHidden ? await isAdminTeacher(teacherId) : false;
    const whereClause = and(
      // Approval gating dropped (task #595): rely on hide for moderation.
      eq(assignmentsTable.isShared, true),
      isNull(assignmentsTable.archivedAt),
      // Defensive privacy filter — private-access rows are never visible
      // in the public library regardless of any stale isShared flag.
      ne(assignmentsTable.accessMode, "private"),
      (wantHidden && isAdminRequester) ? undefined : eq(assignmentsTable.hiddenByAdmin, false),
      ne(assignmentsTable.teacherId, teacherId),
      kindFilter ? or(eq(assignmentsTable.contentKind, kindFilter), eq(assignmentsTable.contentKind, "both")) : undefined,
      dismissedIds.length > 0 ? notInArray(assignmentsTable.id, dismissedIds) : undefined
    );

    const assignments = await db
      .select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        type: assignmentsTable.submissionMode,
        subject: assignmentsTable.subject,
        description: assignmentsTable.description,
        targetClass: assignmentsTable.targetClass,
        totalPoints: assignmentsTable.totalPoints,
        isShared: assignmentsTable.isShared,
        contentKind: assignmentsTable.contentKind,
        // hiddenByAdmin lets the admin "show hidden" toggle render
        // an unhide button on already-moderated rows.
        hiddenByAdmin: assignmentsTable.hiddenByAdmin,
        hideReason: assignmentsTable.hideReason,
        teacherId: assignmentsTable.teacherId,
        teacherName: teachersTable.name,
        createdAt: assignmentsTable.createdAt,
        updatedAt: assignmentsTable.updatedAt,
        version: assignmentsTable.version,
        archivedAt: assignmentsTable.archivedAt,
        closedAt: assignmentsTable.closedAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM questions WHERE questions.assignment_id = assignments.id)::int`,
      })
      .from(assignmentsTable)
      .leftJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
      .where(whereClause)
      .orderBy(sql`${assignmentsTable.createdAt} DESC`);

    res.json(assignments);
  } catch (err) {
    req.log.error(err, "Shared assignments error");
    res.status(500).json({ message: "خطأ" });
  }
});

router.post("/shared/dismiss", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  const { itemType, itemId } = req.body;
  if (!["assignment", "question", "game"].includes(itemType) || !itemId) {
    res.status(400).json({ message: "بيانات غير صحيحة" });
    return;
  }
  try {
    await db
      .insert(dismissedSharedTable)
      .values({ teacherId: req.session.teacherId!, itemType, itemId: Number(itemId) })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err, "Dismiss shared error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── معلومات التصحيح الورقي لواجب عادي — للمالك فقط. تغذي صفحة التصحيح
   بالتصوير (/teacher/assignments/:id/grade) بنفس عقد ورقة العمل. */
router.get("/assignments/:id/grading-info", async (req, res) => {
  try {
    const teacherId = req.session.teacherId as number | undefined;
    if (!teacherId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ message: "Bad id" });
      return;
    }
    const [assignment] = await db
      .select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        teacherId: assignmentsTable.teacherId,
        totalPoints: assignmentsTable.totalPoints,
        submissionCount: sql<number>`(SELECT COUNT(*) FROM submissions WHERE submissions.assignment_id = ${assignmentsTable.id})`,
      })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);
    if (!assignment) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    if (assignment.teacherId !== teacherId) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    res.json({
      worksheetId: null,
      worksheetTitle: assignment.title,
      assignmentId: assignment.id,
      totalPoints: assignment.totalPoints,
      submissionCount: Number(assignment.submissionCount) || 0,
    });
  } catch (err) {
    req.log.error({ err }, "Assignment grading info failed");
    res.status(500).json({ message: "Failed to load grading info" });
  }
});

router.get("/assignments/:id", publicReadLimiter, async (req, res) => {
  try {
    const { id } = GetAssignmentParams.parse(req.params);

    const [assignment] = await db
      .select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        subject: assignmentsTable.subject,
        description: assignmentsTable.description,
        submissionMode: assignmentsTable.submissionMode,
        accessMode: assignmentsTable.accessMode,
        accessCode: assignmentsTable.accessCode,
        targetClass: assignmentsTable.targetClass,
        targetClasses: assignmentsTable.targetClasses,
        categoryId: assignmentsTable.categoryId,
        showResults: assignmentsTable.showResults,
        teacherId: assignmentsTable.teacherId,
        teacherName: teachersTable.name,
        totalPoints: assignmentsTable.totalPoints,
        deadline: assignmentsTable.deadline,
        modelImageBase64: assignmentsTable.modelImageBase64,
        createdAt: assignmentsTable.createdAt,
        updatedAt: assignmentsTable.updatedAt,
        version: assignmentsTable.version,
        archivedAt: assignmentsTable.archivedAt,
        closedAt: assignmentsTable.closedAt,
        examMode: assignmentsTable.examMode,
        examDurationMinutes: assignmentsTable.examDurationMinutes,
        resultsReleaseMode: assignmentsTable.resultsReleaseMode,
        displayTotalPoints: assignmentsTable.displayTotalPoints,
        aiGradingInstructions: assignmentsTable.aiGradingInstructions,
        isShared: assignmentsTable.isShared,
        isShareApproved: assignmentsTable.isShareApproved,
        hiddenByAdmin: assignmentsTable.hiddenByAdmin,
        isAdaptive: assignmentsTable.isAdaptive,
        adaptiveConfig: assignmentsTable.adaptiveConfig,
        activityType: assignmentsTable.activityType,
        listeningAudioText: assignmentsTable.listeningAudioText,
        listeningVoice: assignmentsTable.listeningVoice,
        listeningSpeed: assignmentsTable.listeningSpeed,
        listeningSettings: assignmentsTable.listeningSettings,
        source: assignmentsTable.source,
      })
      .from(assignmentsTable)
      .innerJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    /* Internal worksheet-grading assignments are never addressable through
       the generic assignment detail endpoint — they carry no access code and
       are managed exclusively via the worksheet grading page. */
    if (assignment && (assignment as any).source === "worksheet") {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, id));

    const isTeacher = req.session.teacherId === assignment.teacherId;
    if (assignment.archivedAt && !isTeacher) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }
    // Hidden moderation: admins (and the owner) keep full access, but a
    // hidden assignment is invisible to everyone else — even when they
    // know the ID — so the public detail endpoint cannot be used to
    // bypass the library hide filter.
    // Only enforce the hide check against other authenticated TEACHERS
    // browsing the public library — students and access-code visitors
    // who already received the link / id should still be able to load
    // the assignment (the row is just hidden from the library, not
    // unpublished). Owner and admin always retain access.
    if (assignment.hiddenByAdmin && !isTeacher && req.session.teacherId) {
      const requesterIsAdmin = await isAdminTeacher(req.session.teacherId);
      if (!requesterIsAdmin) {
        res.status(404).json({ message: "الواجب غير موجود" });
        return;
      }
    }
    // A signed-in teacher can load correct answers from an activity that is
    // currently visible in the shared library. Wameeth needs those answers to
    // prepare its local/class flows, but private or admin-hidden content must
    // never be opened by guessing its ID.
    const isVisibleSharedForTeacher =
      !!req.session.teacherId
      && !isTeacher
      && assignment.isShared === true
      && assignment.hiddenByAdmin === false
      && assignment.accessMode !== "private";
    const canSeeCorrectAnswer = isTeacher || isVisibleSharedForTeacher;

    // Private assignments require either the owner, a visible-library viewer,
    // or a valid access code in the X-Access-Code header. Without these we
    // return only a minimal stub so the student frontend can prompt for the
    // code without leaking questions or class targeting.
    if (assignment.accessMode === "private" && !isTeacher && !isVisibleSharedForTeacher) {
      const headerCode = (req.headers["x-access-code"] as string | undefined)?.trim();
      if (!safeAccessCodeEqual(headerCode, assignment.accessCode)) {
        res.status(403).json({
          requiresAccessCode: true,
          id: assignment.id,
          title: assignment.title,
          accessMode: "private",
          message: "هذا الواجب مغلق ويحتاج إلى رمز وصول.",
        });
        return;
      }
    }

    res.json({
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      description: assignment.description,
      submissionMode: assignment.submissionMode,
      accessMode: assignment.accessMode,
      accessCode: isTeacher ? assignment.accessCode : undefined,
      targetClass: assignment.targetClass,
      targetClasses: assignment.targetClasses,
      categoryId: assignment.categoryId,
      showResults: assignment.showResults,
      teacherId: assignment.teacherId,
      teacherName: assignment.teacherName,
      totalPoints: assignment.totalPoints,
      hasModelImage: !!assignment.modelImageBase64,
      deadline: assignment.deadline ? assignment.deadline.toISOString() : null,
      createdAt: assignment.createdAt.toISOString(),
      updatedAt: assignment.updatedAt.toISOString(),
      version: assignment.version,
      archivedAt: assignment.archivedAt?.toISOString() ?? null,
      closedAt: assignment.closedAt?.toISOString() ?? null,
      examMode: assignment.examMode,
      examDurationMinutes: assignment.examDurationMinutes,
      resultsReleaseMode: assignment.resultsReleaseMode,
      displayTotalPoints: assignment.displayTotalPoints,
      aiGradingInstructions: isTeacher ? assignment.aiGradingInstructions : undefined,
      isAdaptive: assignment.isAdaptive,
      adaptiveConfig: assignment.adaptiveConfig ? JSON.parse(assignment.adaptiveConfig) : null,
      activityType: assignment.activityType,
      // The transcript is sensitive content for listening activities — students
      // hear it via /api/assignments/:id/listening-audio. Only the owner teacher
      // (or an approved-shared teacher) sees the raw text, plus students when
      // the teacher explicitly enabled showTranscript.
      listeningAudioText: (() => {
        if (canSeeCorrectAnswer) return assignment.listeningAudioText;
        if (assignment.activityType !== "listening") return assignment.listeningAudioText;
        const parsed = (() => {
          try {
            return assignment.listeningSettings
              ? (JSON.parse(assignment.listeningSettings as string) as { showTranscript?: boolean })
              : null;
          } catch {
            return null;
          }
        })();
        return parsed?.showTranscript === true ? assignment.listeningAudioText : null;
      })(),
      listeningVoice: assignment.listeningVoice,
      listeningSpeed: assignment.listeningSpeed,
      listeningSettings: assignment.listeningSettings
        ? (() => { try { return JSON.parse(assignment.listeningSettings as string); } catch { return null; } })()
        : null,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        questionType: q.questionType,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: canSeeCorrectAnswer ? q.correctAnswer : undefined,
        points: q.points,
        imageUrl: q.imageUrl || null,
        readAloud: q.readAloud ?? false,
        difficulty: q.difficulty,
        skill: q.skill,
        allowMultipleAnswers: q.allowMultipleAnswers ?? false,
        repeatQuestion: q.repeatQuestion ?? false,
      })),
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Get assignment error");
    res.status(500).json({ message: "خطأ في جلب الواجب" });
  }
});

router.get("/assignments/:id/class-students", publicReadLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ message: "Invalid ID" }); return; }

    const [assignment] = await db
      .select({
        targetClass: assignmentsTable.targetClass,
        targetClasses: assignmentsTable.targetClasses,
        teacherId: assignmentsTable.teacherId,
        accessMode: assignmentsTable.accessMode,
        accessCode: assignmentsTable.accessCode,
      })
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      res.json([]);
      return;
    }

    const isOwner = req.session.teacherId === assignment.teacherId;
    // Private assignments: roster is gated behind the access code so an
    // attacker who only knows the assignment id can't enumerate the class
    // roster (student PII).
    if (assignment.accessMode === "private" && !isOwner) {
      const headerCode = (req.headers["x-access-code"] as string | undefined)?.trim();
      if (!safeAccessCodeEqual(headerCode, assignment.accessCode)) {
        res.status(403).json({ requiresAccessCode: true, message: "رمز الوصول مطلوب." });
        return;
      }
    }

    const classList = (assignment.targetClasses && assignment.targetClasses.length > 0)
      ? assignment.targetClasses
      : (assignment.targetClass ? [assignment.targetClass] : []);

    if (classList.length === 0) {
      res.json([]);
      return;
    }

    const students = await db
      .select({ id: studentsTable.id, name: studentsTable.name, gradeLevel: studentsTable.gradeLevel })
      .from(studentsTable)
      .where(and(eq(studentsTable.teacherId, assignment.teacherId), inArray(studentsTable.gradeLevel, classList)));

    res.json(students);
  } catch {
    res.status(500).json({ message: "خطأ في جلب الطلاب" });
  }
});

router.get("/class-grades/:gradeLevel", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const gradeLevel = decodeURIComponent(req.params.gradeLevel);
    const teacherId = req.session.teacherId;

    // ── Pro gate: detailed gradebook is an advanced report ───────────────
    const sub = await featureAccess.getSubscription(teacherId);
    if (sub.planCode !== "pro" && !sub.isAdmin) {
      res.status(403).json({ code: "PRO_REQUIRED", message: "سجل الدرجات متاح لمشتركي Pro فقط" });
      return;
    }

    const students = await db
      .select({ id: studentsTable.id, name: studentsTable.name })
      .from(studentsTable)
      .where(and(eq(studentsTable.teacherId, teacherId), eq(studentsTable.gradeLevel, gradeLevel)));

    const assignments = await db
      .select({
        id: assignmentsTable.id,
        title: assignmentsTable.title,
        subject: assignmentsTable.subject,
        totalPoints: assignmentsTable.totalPoints,
        displayTotalPoints: assignmentsTable.displayTotalPoints,
      })
      .from(assignmentsTable)
      .where(and(
        eq(assignmentsTable.teacherId, teacherId),
        sql`(${assignmentsTable.targetClass} = ${gradeLevel} OR ${gradeLevel} = ANY(${assignmentsTable.targetClasses}))`
      ));

    const assignmentIds = assignments.map(a => a.id);
    let submissions: { id?: number; assignmentId: number; studentName: string; studentId: number | null; earnedPoints: number; totalPoints: number; teacherAdjustedPoints: number | null; score: number; correctAnswers: number; totalQuestions: number }[] = [];

    // Helper: round to 2 decimal places to keep the gradebook clean.
    const round2 = (n: number) => Math.round(n * 100) / 100;

    if (assignmentIds.length > 0) {
      const rawSubmissions = await db
        .select({
          id: submissionsTable.id,
          assignmentId: submissionsTable.assignmentId,
          studentName: submissionsTable.studentName,
          studentId: submissionsTable.studentId,
          earnedPoints: submissionsTable.earnedPoints,
          totalPoints: submissionsTable.totalPoints,
          teacherAdjustedPoints: submissionsTable.teacherAdjustedPoints,
          score: submissionsTable.score,
          correctAnswers: submissionsTable.correctAnswers,
          totalQuestions: submissionsTable.totalQuestions,
        })
        .from(submissionsTable)
        .where(inArray(submissionsTable.assignmentId, assignmentIds));

      // Rescale every DB submission to the assignment's effective display
      // total. The submission row stores a snapshot of totalPoints from the
      // moment it was submitted; we rescale by the *snapshot* ratio so a
      // student who scored 12/15 displays as 4/5 when the override is 5.
      submissions = rawSubmissions.map((s) => {
        const a = assignments.find((x) => x.id === s.assignmentId);
        const effectiveTotal = a?.displayTotalPoints ?? a?.totalPoints ?? s.totalPoints;
        const snapshotTotal = s.totalPoints ?? a?.totalPoints ?? effectiveTotal;
        const ratio = snapshotTotal > 0 ? effectiveTotal / snapshotTotal : 1;
        const scaledEarned = round2(s.earnedPoints * ratio);
        const scaledAdjusted = s.teacherAdjustedPoints != null
          ? round2(s.teacherAdjustedPoints * ratio)
          : null;
        // Keep `score` consistent with the rescaled values so any downstream
        // consumer that reads `score` directly sees the same percentage as
        // the rescaled earned/total.
        const effectiveEarned = scaledAdjusted ?? scaledEarned;
        const rescaledScore = effectiveTotal > 0
          ? Math.round((effectiveEarned / effectiveTotal) * 100)
          : s.score;
        return {
          ...s,
          earnedPoints: scaledEarned,
          totalPoints: round2(effectiveTotal),
          teacherAdjustedPoints: scaledAdjusted,
          score: rescaledScore,
        };
      });

      const gameResults = await db
        .select({
          assignmentId: gameHistoryTable.assignmentId,
          questionCount: gameHistoryTable.questionCount,
          detailedResults: gameHistoryTable.detailedResults,
        })
        .from(gameHistoryTable)
        .where(inArray(gameHistoryTable.assignmentId, assignmentIds))
        .orderBy(sql`${gameHistoryTable.createdAt} DESC`);

      const studentNames = new Set(students.map(s => s.name.trim().toLowerCase()));
      const studentIds = new Set(students.map(s => s.id));

      interface PlayerResult {
        name?: string;
        studentId?: number | null;
        score?: number;
        totalCorrect?: number;
        totalQuestions?: number;
      }

      for (const gr of gameResults) {
        if (!hasAssignmentId(gr)) continue;
        if (!Array.isArray(gr.detailedResults)) continue;
        const assignment = assignments.find(a => a.id === gr.assignmentId);
        const baseTotal = assignment?.totalPoints ?? gr.questionCount;
        const effectiveTotal = assignment?.displayTotalPoints ?? baseTotal;

        for (const entry of gr.detailedResults) {
          const pr = entry as PlayerResult;
          if (!pr || typeof pr !== "object") continue;
          const matchById = pr.studentId && studentIds.has(pr.studentId);
          const matchByName = studentNames.has((pr.name || "").trim().toLowerCase());
          if (!matchById && !matchByName) continue;

          const prNameNorm = (pr.name || "").trim().toLowerCase();
          const alreadyExists = submissions.some(s => {
            if (s.assignmentId !== gr.assignmentId) return false;
            if (pr.studentId && s.studentId) return s.studentId === pr.studentId;
            return s.studentName.trim().toLowerCase() === prNameNorm;
          });
          if (alreadyExists) continue;

          // Normalize game score directly to the effective (display) total
          // based on (correct / totalQuestions) × effectiveTotal — never the
          // raw game points (which include speed bonuses).
          const correct = Math.max(0, pr.totalCorrect || 0);
          const totalQs = pr.totalQuestions || gr.questionCount || 0;
          const earnedPoints = totalQs > 0
            ? round2((correct / totalQs) * effectiveTotal)
            : 0;
          const cappedEarnedPoints = Math.min(earnedPoints, effectiveTotal);

          submissions.push({
            assignmentId: gr.assignmentId,
            studentName: pr.name || "",
            studentId: pr.studentId || null,
            earnedPoints: cappedEarnedPoints,
            totalPoints: round2(effectiveTotal),
            teacherAdjustedPoints: null,
            score: effectiveTotal > 0 ? Math.round((cappedEarnedPoints / effectiveTotal) * 100) : 0,
            correctAnswers: correct,
            totalQuestions: totalQs,
          });
        }
      }
    }

    const teacherClassesForTeacher = await db
      .select({ id: teacherClassesTable.id, name: teacherClassesTable.name })
      .from(teacherClassesTable)
      .where(eq(teacherClassesTable.teacherId, teacherId));

    const tcIdToName = new Map(teacherClassesForTeacher.map((r) => [r.id, r.name]));

    const allVideoLessons = await db
      .select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        teacherClassId: videoLessonsTable.teacherClassId,
        targetClass: videoLessonsTable.targetClass,
      })
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.teacherId, teacherId));

    const videoLessons: { id: number; title: string; subject: string | null; totalPoints: number }[] = [];
    const matchingVideoIds: number[] = [];

    for (const vl of allVideoLessons) {
      const resolved =
        vl.teacherClassId != null ? tcIdToName.get(vl.teacherClassId) ?? vl.targetClass : vl.targetClass;
      if (resolved !== gradeLevel) continue;
      matchingVideoIds.push(vl.id);
      videoLessons.push({
        id: vl.id,
        title: vl.title,
        subject: vl.subject,
        totalPoints: 0,
      });
    }

    let videoSubmissions: {
      id: number;
      videoLessonId: number;
      studentName: string;
      studentId: number | null;
      earnedPoints: number;
      totalPoints: number;
      teacherAdjustedPoints: null;
      score: number;
      correctAnswers: number;
      totalQuestions: number;
    }[] = [];

    if (matchingVideoIds.length > 0) {
      const totals = await db
        .select({
          videoLessonId: videoQuestionsTable.videoLessonId,
          totalPoints: sql<number>`coalesce(sum(${videoQuestionsTable.points}), 0)::real`,
        })
        .from(videoQuestionsTable)
        .where(inArray(videoQuestionsTable.videoLessonId, matchingVideoIds))
        .groupBy(videoQuestionsTable.videoLessonId);

      const totalByLesson = new Map(totals.map((t) => [t.videoLessonId, round2(Number(t.totalPoints))]));

      for (const v of videoLessons) {
        v.totalPoints = totalByLesson.get(v.id) ?? 0;
      }

      const vsRows = await db
        .select({
          id: videoSubmissionsTable.id,
          videoLessonId: videoSubmissionsTable.videoLessonId,
          studentName: videoSubmissionsTable.studentName,
          studentId: videoSubmissionsTable.studentId,
          earnedPoints: videoSubmissionsTable.earnedPoints,
          totalPoints: videoSubmissionsTable.totalPoints,
          score: videoSubmissionsTable.score,
          correctAnswers: videoSubmissionsTable.correctAnswers,
          totalQuestions: videoSubmissionsTable.totalQuestions,
        })
        .from(videoSubmissionsTable)
        .where(inArray(videoSubmissionsTable.videoLessonId, matchingVideoIds));

      videoSubmissions = vsRows.map((s) => ({
        id: s.id,
        videoLessonId: s.videoLessonId,
        studentName: s.studentName,
        studentId: s.studentId,
        earnedPoints: round2(s.earnedPoints),
        totalPoints: round2(s.totalPoints),
        teacherAdjustedPoints: null,
        score: Math.round(Number(s.score)),
        correctAnswers: s.correctAnswers,
        totalQuestions: s.totalQuestions,
      }));
    }

    res.json({ students, assignments, submissions, videoLessons, videoSubmissions });
  } catch (err) {
    req.log.error({ err }, "Class grades error");
    res.status(500).json({ message: "خطأ في جلب الدرجات" });
  }
});

router.get("/teacher/grade-levels", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const levels = await db
      .select({ gradeLevel: studentsTable.gradeLevel, count: sql<number>`count(*)::int` })
      .from(studentsTable)
      .where(eq(studentsTable.teacherId, req.session.teacherId))
      .groupBy(studentsTable.gradeLevel);

    res.json(levels.filter(l => l.gradeLevel));
  } catch {
    res.status(500).json({ message: "خطأ" });
  }
});

router.put("/assignments/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const { id } = GetAssignmentParams.parse(req.params);

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    if (assignment.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بتعديل هذا الواجب" });
      return;
    }

    const parsed = UpdateAssignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "بيانات غير صالحة", errors: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;

    const nextAccessMode = body.accessMode ?? assignment.accessMode;
    const nextAccessCode = body.accessCode !== undefined
      ? body.accessCode?.trim().toUpperCase() || null
      : assignment.accessCode;
    if (nextAccessMode === "private" && !nextAccessCode) {
      res.status(400).json({ message: "يجب تحديد كود الدخول للواجب الخاص" });
      return;
    }
    const nextDeadline = body.deadline !== undefined
      ? (body.deadline ? new Date(body.deadline) : null)
      : assignment.deadline;
    const nextResultsReleaseMode = body.resultsReleaseMode ?? assignment.resultsReleaseMode;
    if (nextResultsReleaseMode === "after_deadline" && !nextDeadline) {
      res.status(400).json({ message: "يجب تحديد موعد نهائي لإظهار النتائج بعده" });
      return;
    }
    const nextExamMode = body.examMode ?? assignment.examMode;
    const nextExamDuration = body.examDurationMinutes !== undefined
      ? body.examDurationMinutes
      : assignment.examDurationMinutes;
    if (nextExamMode && (!nextExamDuration || nextExamDuration < 1)) {
      res.status(400).json({ message: "مدة الاختبار يجب أن تكون دقيقة واحدة على الأقل" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM assignments WHERE id = ${id} FOR UPDATE`);
      const [currentAssignment] = await tx
        .select({ version: assignmentsTable.version })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, id))
        .limit(1);
      if (body.version !== undefined && currentAssignment?.version !== body.version) {
        const conflict = new Error("تم تعديل الواجب في جلسة أخرى. أعد تحميل أحدث نسخة قبل الحفظ.");
        (conflict as any).statusCode = 409;
        (conflict as any).code = "ASSIGNMENT_VERSION_CONFLICT";
        throw conflict;
      }
      if (body.questions !== undefined) {
        // Lock the parent row before checking submissions. PostgreSQL's FK
        // key-share lock on new submissions conflicts with this lock, so a
        // concurrent submission cannot slip between the check and question edits.
        await tx.execute(sql`SELECT id FROM assignments WHERE id = ${id} FOR UPDATE`);
        const [existingSubmission] = await tx
          .select({ id: submissionsTable.id })
          .from(submissionsTable)
          .where(eq(submissionsTable.assignmentId, id))
          .limit(1);
        if (existingSubmission) {
          const conflict = new Error("لا يمكن تعديل أسئلة واجب يحتوي على تسليمات. كرّر الواجب لإنشاء نسخة جديدة.");
          (conflict as any).statusCode = 409;
          (conflict as any).code = "ASSIGNMENT_QUESTIONS_LOCKED";
          throw conflict;
        }
      }

      // Capture the complete pre-mutation state while holding the assignment
      // lock. This makes every successful PUT recoverable and race-free.
      const [snapshotAssignment] = await tx.select().from(assignmentsTable)
        .where(eq(assignmentsTable.id, id)).limit(1);
      const snapshotQuestions = await tx.select().from(questionsTable)
        .where(eq(questionsTable.assignmentId, id));
      if (snapshotAssignment) {
        await tx.insert(assignmentRevisionsTable).values({
          assignmentId: id,
          teacherId: snapshotAssignment.teacherId,
          sourceVersion: snapshotAssignment.version,
          settings: snapshotAssignment as unknown as Record<string, unknown>,
          questions: snapshotQuestions as unknown as unknown[],
        });
      }

      const updateData: Record<string, any> = {};
      updateData.updatedAt = new Date();
      updateData.version = sql`${assignmentsTable.version} + 1`;
      if (body.title !== undefined) updateData.title = body.title;
      if (body.subject !== undefined) updateData.subject = body.subject;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.submissionMode !== undefined) updateData.submissionMode = body.submissionMode;
      if (nextExamMode) updateData.submissionMode = "electronic";
      if (body.accessMode !== undefined) {
        updateData.accessMode = body.accessMode;
        // Privacy invariant: switching to private access mode forces
        // the assignment out of the public library.
        if (body.accessMode === "private") updateData.isShared = false;
      }
      if (body.accessCode !== undefined) updateData.accessCode = nextAccessCode;
      if (body.targetClasses !== undefined) {
        const cleaned = Array.isArray(body.targetClasses)
          ? body.targetClasses.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim())
          : [];
        updateData.targetClasses = cleaned.length > 0 ? cleaned : null;
        updateData.targetClass = cleaned.length > 0 ? cleaned[0] : null;
      } else if (body.targetClass !== undefined) {
        updateData.targetClass = body.targetClass;
        updateData.targetClasses = body.targetClass ? [body.targetClass] : null;
      }
      if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
      if (body.showResults !== undefined) updateData.showResults = body.showResults;
      if (body.deadline !== undefined) updateData.deadline = body.deadline ? new Date(body.deadline) : null;
      if (body.examMode !== undefined) updateData.examMode = body.examMode;
      if (body.examDurationMinutes !== undefined) updateData.examDurationMinutes = body.examDurationMinutes;
      if (body.resultsReleaseMode !== undefined) updateData.resultsReleaseMode = body.resultsReleaseMode;
      if (body.aiGradingInstructions !== undefined) updateData.aiGradingInstructions = body.aiGradingInstructions;
      if (body.displayTotalPoints !== undefined) updateData.displayTotalPoints = body.displayTotalPoints;
      if (body.activityType !== undefined) updateData.activityType = body.activityType;
      if (body.listeningAudioText !== undefined) updateData.listeningAudioText = body.listeningAudioText;
      if (body.listeningVoice !== undefined) updateData.listeningVoice = body.listeningVoice;
      if (body.listeningSpeed !== undefined) updateData.listeningSpeed = body.listeningSpeed;
      if (body.listeningSettings !== undefined) {
        updateData.listeningSettings = body.listeningSettings ? JSON.stringify(body.listeningSettings) : null;
      }

      if (body.questions !== undefined) {
        const totalPoints = body.questions.reduce((sum, q) => sum + (q.points ?? 1), 0);
        updateData.totalPoints = totalPoints;
      }

      if (Object.keys(updateData).length > 0) {
        await tx
          .update(assignmentsTable)
          .set(updateData)
          .where(eq(assignmentsTable.id, id));
      }

      if (body.questions !== undefined) {
        const existingQuestions = await tx
          .select()
          .from(questionsTable)
          .where(eq(questionsTable.assignmentId, id));

        const existingIds = existingQuestions.map((q) => q.id);
        const existingMap = new Map(existingQuestions.map((q) => [q.id, q]));
        const incomingIds = body.questions.filter((q) => q.id).map((q) => q.id!);

        const toDelete = existingIds.filter((eid) => !incomingIds.includes(eid));
        for (const delId of toDelete) {
          await tx.delete(questionsTable).where(eq(questionsTable.id, delId));
        }

        for (const q of body.questions) {
          if (q.id && existingIds.includes(q.id)) {
            const existing = existingMap.get(q.id);
            await tx
              .update(questionsTable)
              .set({
                text: q.text,
                questionType: q.questionType || "mcq",
                optionA: q.optionA || null,
                optionB: q.optionB || null,
                optionC: q.optionC || null,
                optionD: q.optionD || null,
                correctAnswer: q.correctAnswer || null,
                points: q.points ?? 1,
                imageUrl: q.imageUrl || null,
                readAloud: q.readAloud !== undefined ? q.readAloud : (existing?.readAloud ?? false),
                allowMultipleAnswers: q.allowMultipleAnswers !== undefined ? q.allowMultipleAnswers : (existing?.allowMultipleAnswers ?? false),
                repeatQuestion: q.repeatQuestion !== undefined ? q.repeatQuestion : (existing?.repeatQuestion ?? false),
              })
              .where(eq(questionsTable.id, q.id));
          } else {
            await tx.insert(questionsTable).values({
              assignmentId: id,
              questionType: q.questionType || "mcq",
              text: q.text,
              optionA: q.optionA || null,
              optionB: q.optionB || null,
              optionC: q.optionC || null,
              optionD: q.optionD || null,
              correctAnswer: q.correctAnswer || null,
              points: q.points ?? 1,
              imageUrl: q.imageUrl || null,
              readAloud: q.readAloud ?? false,
              allowMultipleAnswers: q.allowMultipleAnswers ?? false,
              repeatQuestion: q.repeatQuestion ?? false,
            });
          }
        }
      }
    });

    res.json({ message: "تم تحديث الواجب بنجاح" });

    logActivity({
      req,
      userId: req.session.teacherId!,
      userRole: "teacher",
      action: "edit_homework",
      details: { assignmentId: id },
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Update assignment error");
    if (error?.statusCode === 409) {
      res.status(409).json({
        message: error.message,
        messageAr: error.message,
        messageEn: error.code === "ASSIGNMENT_VERSION_CONFLICT"
          ? "Assignment changed in another session. Reload the latest version before saving."
          : "Questions cannot be edited because submissions exist. Duplicate the assignment instead.",
        code: error.code,
      });
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    res.status(500).json({ message: "خطأ في تحديث الواجب" });
  }
});

const revisionError = (code: string, messageAr: string, messageEn: string) =>
  ({ code, message: { ar: messageAr, en: messageEn } });

// Revision endpoints are deliberately owner-only; historical answer keys are
// never exposed to students or other teachers.
router.get("/assignments/:id/revisions", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json(revisionError("AUTH_REQUIRED", "يجب تسجيل الدخول أولاً", "Authentication required")); return; }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json(revisionError("INVALID_ASSIGNMENT_ID", "معرّف الواجب غير صالح", "Invalid assignment id")); return; }
  try {
    const [owner] = await db.select({ teacherId: assignmentsTable.teacherId }).from(assignmentsTable).where(eq(assignmentsTable.id, id)).limit(1);
    if (!owner) { res.status(404).json(revisionError("ASSIGNMENT_NOT_FOUND", "الواجب غير موجود", "Assignment not found")); return; }
    if (owner.teacherId !== teacherId) { res.status(403).json(revisionError("OWNER_ONLY", "غير مصرح لك", "Owner access required")); return; }
    const rows = await db.select({
      id: assignmentRevisionsTable.id,
      sourceVersion: assignmentRevisionsTable.sourceVersion,
      createdAt: assignmentRevisionsTable.createdAt,
      questionCount: sql<number>`jsonb_array_length(${assignmentRevisionsTable.questions})`,
      title: sql<string>`${assignmentRevisionsTable.settings}->>'title'`,
    })
      .from(assignmentRevisionsTable).where(eq(assignmentRevisionsTable.assignmentId, id))
      .orderBy(sql`${assignmentRevisionsTable.createdAt} DESC`);
    res.json(rows);
  } catch (error) { req.log.error({ err: error }, "List assignment revisions failed"); res.status(500).json(revisionError("REVISION_LIST_FAILED", "تعذر جلب سجل الإصدارات", "Could not list revisions")); }
});

router.get("/assignments/:id/revisions/:revisionId", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json(revisionError("AUTH_REQUIRED", "يجب تسجيل الدخول أولاً", "Authentication required")); return; }
  try {
    const [row] = await db.select().from(assignmentRevisionsTable)
      .innerJoin(assignmentsTable, eq(assignmentRevisionsTable.assignmentId, assignmentsTable.id))
      .where(and(eq(assignmentRevisionsTable.id, Number(req.params.revisionId)), eq(assignmentRevisionsTable.assignmentId, Number(req.params.id)), eq(assignmentsTable.teacherId, teacherId))).limit(1);
    if (!row) { res.status(404).json(revisionError("REVISION_NOT_FOUND", "الإصدار غير موجود", "Revision not found")); return; }
    res.json(row.assignment_revisions);
  } catch (error) { req.log.error({ err: error }, "Get assignment revision failed"); res.status(500).json(revisionError("REVISION_GET_FAILED", "تعذر جلب الإصدار", "Could not fetch revision")); }
});

router.post("/assignments/:id/revisions/:revisionId/restore", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json(revisionError("AUTH_REQUIRED", "يجب تسجيل الدخول أولاً", "Authentication required")); return; }
  const mode = req.body?.mode === "settings" ? "settings" : "full";
  const expectedVersion = Number(req.body?.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) { res.status(400).json(revisionError("VERSION_REQUIRED", "يجب إرسال رقم الإصدار الحالي", "Current version is required")); return; }
  try {
    const result = await db.transaction(async (tx) => {
      const [a] = await tx.select().from(assignmentsTable).where(eq(assignmentsTable.id, Number(req.params.id))).for("update");
      const [r] = await tx.select().from(assignmentRevisionsTable).where(and(eq(assignmentRevisionsTable.id, Number(req.params.revisionId)), eq(assignmentRevisionsTable.assignmentId, Number(req.params.id)), eq(assignmentRevisionsTable.teacherId, teacherId))).limit(1);
      if (!a) throw Object.assign(new Error("not found"), { statusCode: 404, code: "ASSIGNMENT_NOT_FOUND" });
      if (a.teacherId !== teacherId) throw Object.assign(new Error("owner only"), { statusCode: 403, code: "OWNER_ONLY" });
      if (!r) throw Object.assign(new Error("not found"), { statusCode: 404, code: "REVISION_NOT_FOUND" });
      if (a.version !== expectedVersion) throw Object.assign(new Error("version conflict"), { statusCode: 409, code: "ASSIGNMENT_VERSION_CONFLICT" });
      const currentQuestions = await tx.select().from(questionsTable).where(eq(questionsTable.assignmentId, a.id));
      await tx.insert(assignmentRevisionsTable).values({
        assignmentId: a.id,
        teacherId,
        sourceVersion: a.version,
        settings: a as unknown as Record<string, unknown>,
        questions: currentQuestions as unknown as unknown[],
      });
      const settings = r.settings as Record<string, any>;
      const update: Record<string, any> = { updatedAt: new Date(), version: sql`${assignmentsTable.version} + 1` };
      const keys = ["title","subject","description","submissionMode","accessMode","accessCode","targetClass","targetClasses","categoryId","showResults","modelImageBase64","totalPoints","displayTotalPoints","deadline","examMode","examDurationMinutes","resultsReleaseMode","aiGradingInstructions","isShared","isShareApproved","contentKind","isAdaptive","adaptiveConfig","activityType","listeningAudioText","listeningVoice","listeningSpeed","listeningSettings"];
      for (const key of keys) {
        if (mode === "settings" && key === "totalPoints") continue;
        if (settings[key] !== undefined) update[key] = settings[key];
      }
      if (update.deadline) update.deadline = new Date(update.deadline);
      // Restoring historical settings must never republish content implicitly.
      update.isShared = false;
      update.isShareApproved = false;
      if (a.accessMode === "private") {
        update.accessMode = "private";
        update.accessCode = a.accessCode;
      }
      if (mode === "full") {
        const [s] = await tx.select({ id: submissionsTable.id }).from(submissionsTable).where(eq(submissionsTable.assignmentId, a.id)).limit(1);
        if (s) throw Object.assign(new Error("submissions"), { statusCode: 409, code: "REVISION_QUESTIONS_LOCKED" });
        await tx.delete(questionsTable).where(eq(questionsTable.assignmentId, a.id));
        const questions = (r.questions as any[]) || [];
        if (questions.length) await tx.insert(questionsTable).values(questions.map(({ id: _id, assignmentId: _aid, ...q }) => ({ ...q, assignmentId: a.id })));
      }
      const [updated] = await tx.update(assignmentsTable).set(update).where(eq(assignmentsTable.id, a.id)).returning({ version: assignmentsTable.version });
      return updated;
    });
    res.json({ ok: true, mode, version: result.version });
  } catch (error: any) {
    if (error.statusCode) { res.status(error.statusCode).json(revisionError(error.code, error.code === "REVISION_QUESTIONS_LOCKED" ? "لا يمكن استعادة الأسئلة لوجود تسليمات" : error.message, error.code === "REVISION_QUESTIONS_LOCKED" ? "Question restore is blocked because submissions exist" : error.message)); return; }
    req.log.error({ err: error }, "Restore assignment revision failed"); res.status(500).json(revisionError("REVISION_RESTORE_FAILED", "تعذر استعادة الإصدار", "Could not restore revision"));
  }
});

router.post("/assignments/:id/revisions/:revisionId/duplicate", async (req, res) => {
  const teacherId = req.session.teacherId;
  if (!teacherId) { res.status(401).json(revisionError("AUTH_REQUIRED", "يجب تسجيل الدخول أولاً", "Authentication required")); return; }
  try {
    const [r] = await db.select().from(assignmentRevisionsTable).where(and(eq(assignmentRevisionsTable.id, Number(req.params.revisionId)), eq(assignmentRevisionsTable.assignmentId, Number(req.params.id)), eq(assignmentRevisionsTable.teacherId, teacherId))).limit(1);
    if (!r) { res.status(404).json(revisionError("REVISION_NOT_FOUND", "الإصدار غير موجود", "Revision not found")); return; }
    const s = r.settings as Record<string, any>;
    const [copy] = await db.transaction(async (tx) => {
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        archivedAt: _archivedAt,
        ...copyableSettings
      } = s;
      const [created] = await tx.insert(assignmentsTable).values({
        ...copyableSettings,
        deadline: copyableSettings.deadline ? new Date(copyableSettings.deadline) : null,
        title: `${s.title} (نسخة)`,
        teacherId,
        version: 1,
        archivedAt: null,
        isShared: false,
        isShareApproved: false,
        hiddenByAdmin: false,
        hiddenAt: null,
        hiddenById: null,
        hideReason: null,
      }).returning();
      const qs = (r.questions as any[]) || [];
      if (qs.length) await tx.insert(questionsTable).values(qs.map(({ id: _id, assignmentId: _aid, ...q }) => ({ ...q, assignmentId: created.id })));
      return [created];
    });
    res.status(201).json({ id: copy.id, version: copy.version, sourceRevisionId: r.id });
  } catch (error) { req.log.error({ err: error }, "Duplicate assignment revision failed"); res.status(500).json(revisionError("REVISION_DUPLICATE_FAILED", "تعذر نسخ الإصدار", "Could not duplicate revision")); }
});

router.post("/assignments/:id/duplicate", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const { id } = GetAssignmentParams.parse(req.params);

    const [original] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!original) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    if (original.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بنسخ هذا الواجب" });
      return;
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, id));

    const [newAssignment] = await db
      .insert(assignmentsTable)
      .values({
        title: `${original.title} (نسخة)`,
        subject: original.subject,
        description: original.description,
        submissionMode: original.submissionMode,
        accessMode: original.accessMode,
        accessCode: original.accessCode,
        targetClass: original.targetClass,
        targetClasses: original.targetClasses,
        categoryId: original.categoryId,
        showResults: original.showResults,
        modelImageBase64: original.modelImageBase64,
        totalPoints: original.totalPoints,
        deadline: original.deadline,
        examMode: original.examMode,
        examDurationMinutes: original.examDurationMinutes,
        resultsReleaseMode: original.resultsReleaseMode,
        teacherId: req.session.teacherId,
      })
      .returning();

    if (questions.length > 0) {
      await db.insert(questionsTable).values(
        questions.map((q) => ({
          assignmentId: newAssignment.id,
          questionType: q.questionType || "mcq",
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          points: q.points || 1,
          imageUrl: q.imageUrl || null,
          readAloud: q.readAloud ?? false,
          allowMultipleAnswers: q.allowMultipleAnswers ?? false,
          repeatQuestion: q.repeatQuestion ?? false,
        })),
      );
    }

    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, req.session.teacherId))
      .limit(1);

    res.status(201).json({
      id: newAssignment.id,
      title: newAssignment.title,
      subject: newAssignment.subject,
      description: newAssignment.description,
      submissionMode: newAssignment.submissionMode,
      accessMode: newAssignment.accessMode,
      targetClass: newAssignment.targetClass,
      targetClasses: newAssignment.targetClasses,
      showResults: newAssignment.showResults,
      teacherId: newAssignment.teacherId,
      teacherName: teacher?.name || "",
      questionCount: questions.length,
      submissionCount: 0,
      totalPoints: newAssignment.totalPoints,
      hasModelImage: !!newAssignment.modelImageBase64,
      deadline: newAssignment.deadline ? newAssignment.deadline.toISOString() : null,
      createdAt: newAssignment.createdAt.toISOString(),
      examMode: newAssignment.examMode,
      examDurationMinutes: newAssignment.examDurationMinutes,
      resultsReleaseMode: newAssignment.resultsReleaseMode,
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Duplicate assignment error");
    res.status(500).json({ message: "خطأ في نسخ الواجب" });
  }
});

router.patch("/assignments/:id/archive", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const { id } = GetAssignmentParams.parse(req.params);
    const { archived, version } = z.object({
      archived: z.boolean(),
      version: z.number().int().positive(),
    }).parse(req.body);
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM assignments WHERE id = ${id} FOR UPDATE`);
      const [assignment] = await tx
        .select({ teacherId: assignmentsTable.teacherId, version: assignmentsTable.version })
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, id))
        .limit(1);
      if (!assignment) throw Object.assign(new Error("الواجب غير موجود"), { statusCode: 404 });
      if (assignment.teacherId !== req.session.teacherId) {
        throw Object.assign(new Error("غير مصرح لك بتعديل هذا الواجب"), { statusCode: 403 });
      }
      if (assignment.version !== version) {
        throw Object.assign(new Error("تم تعديل الواجب في جلسة أخرى. أعد تحميل القائمة وحاول مجددًا."), {
          statusCode: 409,
          code: "ASSIGNMENT_VERSION_CONFLICT",
        });
      }
      return (await tx
        .update(assignmentsTable)
        .set({
          archivedAt: archived ? new Date() : null,
          isShared: false,
          updatedAt: new Date(),
          version: sql`${assignmentsTable.version} + 1`,
        })
        .where(and(
          eq(assignmentsTable.id, id),
          eq(assignmentsTable.teacherId, req.session.teacherId),
          eq(assignmentsTable.version, version),
        ))
        .returning({
          id: assignmentsTable.id,
          archivedAt: assignmentsTable.archivedAt,
          version: assignmentsTable.version,
          updatedAt: assignmentsTable.updatedAt,
        }))[0];
    });
    res.json({
      id: updated.id,
      archivedAt: updated.archivedAt?.toISOString() ?? null,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    req.log.error({ err: error }, "Archive assignment error");
    res.status(error?.statusCode || 500).json({
      message: error?.message || "تعذر تحديث حالة الأرشفة",
      ...(error?.code ? { code: error.code } : {}),
    });
  }
});

router.patch("/assignments/:id/lifecycle", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const { id } = GetAssignmentParams.parse(req.params);
    const { closed, version } = z.object({
      closed: z.boolean(),
      version: z.number().int().positive(),
    }).parse(req.body);
    const teacherId = req.session.teacherId;
    const result = await db.transaction(async (tx) => {
      const [assignment] = await tx.select().from(assignmentsTable)
        .where(eq(assignmentsTable.id, id)).for("update").limit(1);
      if (!assignment) throw Object.assign(new Error("not found"), { statusCode: 404 });
      if (assignment.teacherId !== teacherId) throw Object.assign(new Error("forbidden"), { statusCode: 403 });
      if (assignment.version !== version) throw Object.assign(new Error("conflict"), { statusCode: 409 });
      const snapshotQuestions = await tx.select().from(questionsTable)
        .where(eq(questionsTable.assignmentId, id));
      await tx.insert(assignmentRevisionsTable).values({
        assignmentId: id,
        teacherId,
        sourceVersion: assignment.version,
        settings: assignment as unknown as Record<string, unknown>,
        questions: snapshotQuestions as unknown as unknown[],
      });
      const [updated] = await tx.update(assignmentsTable).set({
        closedAt: closed ? new Date() : null,
        updatedAt: new Date(),
        version: sql`${assignmentsTable.version} + 1`,
      }).where(and(
        eq(assignmentsTable.id, id),
        eq(assignmentsTable.teacherId, teacherId),
        eq(assignmentsTable.version, version),
      )).returning({
        id: assignmentsTable.id,
        closedAt: assignmentsTable.closedAt,
        version: assignmentsTable.version,
        updatedAt: assignmentsTable.updatedAt,
      });
      if (!updated) throw Object.assign(new Error("conflict"), { statusCode: 409 });
      return updated;
    });
    res.json({
      id: result.id,
      closedAt: result.closedAt?.toISOString() ?? null,
      version: result.version,
      updatedAt: result.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }
    if (error?.statusCode === 403) {
      res.status(403).json({ message: "غير مصرح لك بتعديل هذا الواجب" });
      return;
    }
    if (error?.statusCode === 409) {
      res.status(409).json({
        message: "تم تعديل الواجب في جلسة أخرى. أعد تحميل الصفحة وحاول مجددًا.",
        code: "ASSIGNMENT_VERSION_CONFLICT",
      });
      return;
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "بيانات حالة الواجب غير صالحة" });
      return;
    }
    req.log.error({ err: error }, "Update assignment lifecycle failed");
    res.status(500).json({ message: "تعذر تحديث حالة الواجب" });
  }
});

router.delete("/assignments/:id/questions/:questionId", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const questionId = parseInt(req.params.questionId, 10);
    const expectedVersion = Number(req.body?.version);
    if (isNaN(assignmentId) || isNaN(questionId)) {
      res.status(400).json({ message: "معرف غير صالح" });
      return;
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      res.status(400).json({ message: "يجب إرسال رقم الإصدار الحالي", code: "VERSION_REQUIRED" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM assignments WHERE id = ${assignmentId} FOR UPDATE`);
      const [assignment] = await tx
        .select()
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, assignmentId))
        .limit(1);
      if (!assignment) throw Object.assign(new Error("الواجب غير موجود"), { statusCode: 404 });
      if (assignment.teacherId !== req.session.teacherId) {
        throw Object.assign(new Error("غير مصرح لك بحذف هذا السؤال"), { statusCode: 403 });
      }
      if (assignment.version !== expectedVersion) {
        throw Object.assign(new Error("تم تعديل الواجب في جلسة أخرى"), {
          statusCode: 409,
          code: "ASSIGNMENT_VERSION_CONFLICT",
        });
      }
      const [submission] = await tx
        .select({ id: submissionsTable.id })
        .from(submissionsTable)
        .where(eq(submissionsTable.assignmentId, assignmentId))
        .limit(1);
      if (submission) {
        throw Object.assign(new Error("لا يمكن حذف سؤال من واجب يحتوي على تسليمات"), {
          statusCode: 409,
          code: "ASSIGNMENT_QUESTIONS_LOCKED",
        });
      }
      const snapshotQuestions = await tx.select().from(questionsTable)
        .where(eq(questionsTable.assignmentId, assignmentId));
      await tx.insert(assignmentRevisionsTable).values({
        assignmentId,
        teacherId: assignment.teacherId,
        sourceVersion: assignment.version,
        settings: assignment as unknown as Record<string, unknown>,
        questions: snapshotQuestions as unknown as unknown[],
      });
      const deleted = await tx
        .delete(questionsTable)
        .where(and(eq(questionsTable.id, questionId), eq(questionsTable.assignmentId, assignmentId)))
        .returning({ id: questionsTable.id });
      if (!deleted.length) throw Object.assign(new Error("السؤال غير موجود"), { statusCode: 404 });
      await tx.update(assignmentsTable).set({
        totalPoints: sql`COALESCE((SELECT SUM(points) FROM questions WHERE assignment_id = ${assignmentId}), 0)`,
        updatedAt: new Date(),
        version: sql`${assignmentsTable.version} + 1`,
      }).where(eq(assignmentsTable.id, assignmentId));
    });
    res.json({ message: "تم حذف السؤال بنجاح" });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({ message: error.message, code: error.code });
      return;
    }
    req.log.error({ err: error }, "Delete question error");
    res.status(500).json({ message: "خطأ في حذف السؤال" });
  }
});

router.delete("/assignments/:id", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const { id } = DeleteAssignmentParams.parse(req.params);

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    if (assignment.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بحذف هذا الواجب" });
      return;
    }

    await db.delete(notificationsTable).where(eq(notificationsTable.assignmentId, id));
    await db.delete(gameHistoryTable).where(eq(gameHistoryTable.assignmentId, id));
    await db.delete(assignmentsTable).where(eq(assignmentsTable.id, id));
    res.json({ message: "تم حذف الواجب بنجاح" });

    logActivity({
      req,
      userId: req.session.teacherId!,
      userRole: "teacher",
      action: "delete_homework",
      details: { assignmentId: id, title: assignment.title },
    });
  } catch (error: any) {
    req.log.error({ err: error }, "Delete assignment error");
    res.status(500).json({ message: "خطأ في حذف الواجب" });
  }
});

router.patch("/assignments/:id/share", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const id = parseInt(req.params.id, 10);
    const { isShared, version } = z.object({
      isShared: z.boolean(),
      version: z.number().int().positive(),
    }).parse(req.body);
    const wantShared = !!isShared;
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM assignments WHERE id = ${id} FOR UPDATE`);
      const [existing] = await tx
        .select({
          accessMode: assignmentsTable.accessMode,
          version: assignmentsTable.version,
          archivedAt: assignmentsTable.archivedAt,
        })
        .from(assignmentsTable)
        .where(and(eq(assignmentsTable.id, id), eq(assignmentsTable.teacherId, req.session.teacherId!)))
        .limit(1);
      if (!existing) return null;
      if (existing.version !== version) {
        throw Object.assign(new Error("تم تعديل الواجب في جلسة أخرى. أعد تحميل الصفحة وحاول مجددًا."), {
          statusCode: 409,
          code: "ASSIGNMENT_VERSION_CONFLICT",
        });
      }
      const effectiveShared = existing.accessMode === "private" || existing.archivedAt ? false : wantShared;
      const [row] = await tx
        .update(assignmentsTable)
        .set({
          isShared: effectiveShared,
          isShareApproved: true,
          updatedAt: new Date(),
          version: sql`${assignmentsTable.version} + 1`,
        })
        .where(and(
          eq(assignmentsTable.id, id),
          eq(assignmentsTable.teacherId, req.session.teacherId!),
          eq(assignmentsTable.version, version),
        ))
        .returning();
      return row;
    });
    if (!updated) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }
    res.json({
      id: updated.id,
      isShared: updated.isShared,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err: any) {
    if (err?.statusCode) {
      res.status(err.statusCode).json({ message: err.message, code: err.code });
      return;
    }
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    req.log.error(err, "Toggle share error");
    res.status(500).json({ message: "خطأ" });
  }
});

/* ── POST /assignments/:id/import ──────────────────────────────
   Import (clone) a shared assignment from another teacher into your account */
router.post("/assignments/:id/import", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const id = Number(req.params.id);
    if (!id) { res.status(400).json({ message: "معرّف غير صالح" }); return; }

    const [original] = await db
      .select()
      .from(assignmentsTable)
      .where(and(
        eq(assignmentsTable.id, id),
        eq(assignmentsTable.isShared, true),
        // Admin-hidden items must not be importable even if the ID is known.
        eq(assignmentsTable.hiddenByAdmin, false),
        // Private-access rows are never importable from the public library.
        ne(assignmentsTable.accessMode, "private"),
      ))
      .limit(1);

    if (!original) {
      res.status(404).json({ message: "الواجب غير موجود أو غير متاح للاستيراد" });
      return;
    }

    if (original.teacherId === req.session.teacherId) {
      res.status(400).json({ message: "هذا واجبك الخاص" });
      return;
    }

    const originalTeacher = await db.select({ name: teachersTable.name }).from(teachersTable).where(eq(teachersTable.id, original.teacherId)).limit(1);
    const credit = originalTeacher[0]?.name ? ` (مستورد من ${originalTeacher[0].name})` : " (مستورد)";

    const [newAssignment] = await db
      .insert(assignmentsTable)
      .values({
        title: `${original.title}${credit}`,
        subject: original.subject,
        description: original.description,
        submissionMode: original.submissionMode,
        accessMode: "code",
        accessCode: original.accessCode,
        targetClass: original.targetClass,
        categoryId: null,
        showResults: original.showResults,
        modelImageBase64: original.modelImageBase64,
        totalPoints: original.totalPoints,
        deadline: null,
        examMode: original.examMode,
        examDurationMinutes: original.examDurationMinutes,
        resultsReleaseMode: original.resultsReleaseMode,
        teacherId: req.session.teacherId,
        isShared: false,
        // Preserve contentKind so a competition stays in the competitions
        // library when imported and (later) re-shared by the new owner.
        contentKind: original.contentKind ?? "homework",
      })
      .returning();

    const questions = await db.select().from(questionsTable).where(eq(questionsTable.assignmentId, id));

    if (questions.length > 0) {
      await db.insert(questionsTable).values(
        questions.map((q) => ({
          assignmentId: newAssignment.id,
          questionType: q.questionType || "mcq",
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          points: q.points || 1,
          imageUrl: q.imageUrl || null,
          readAloud: q.readAloud ?? false,
          allowMultipleAnswers: q.allowMultipleAnswers ?? false,
          repeatQuestion: q.repeatQuestion ?? false,
        })),
      );
    }

    res.status(201).json({ id: newAssignment.id, title: newAssignment.title });
  } catch (err) {
    req.log.error(err, "Import assignment error");
    res.status(500).json({ message: "خطأ في الاستيراد" });
  }
});

// ─── Solo Challenge Routes ────────────────────────────────────────────────────
// NOTE: Creation, by-assignment lookup, participants, and notes endpoints for
// /solo-challenges live in routes/solo-challenges.ts (the actively-maintained,
// feature-complete implementation). Only the /deadline endpoint remains here
// since it has no equivalent there.

/* PATCH /api/solo-challenges/:slug/deadline
   Teacher: set or clear the challenge expiry time. */
router.patch("/solo-challenges/:slug/deadline", async (req, res) => {
  try {
    const teacherId = (req.session as any)?.teacherId;
    if (!teacherId) return res.status(401).json({ message: "غير مصرح" });

    const slug = req.params.slug;
    const rawDeadline = req.body?.expiresAt;
    const expiresAt = rawDeadline ? new Date(rawDeadline) : null;
    if (rawDeadline && isNaN(expiresAt!.getTime())) {
      return res.status(400).json({ message: "تاريخ غير صالح" });
    }

    const [challenge] = await db
      .select({ id: soloChallengesTable.id, teacherId: soloChallengesTable.teacherId })
      .from(soloChallengesTable)
      .where(eq(soloChallengesTable.slug, slug))
      .limit(1);

    if (!challenge) return res.status(404).json({ message: "الرابط غير موجود" });
    if (challenge.teacherId !== teacherId) return res.status(403).json({ message: "غير مصرح" });

    await db.update(soloChallengesTable)
      .set({ expiresAt })
      .where(eq(soloChallengesTable.slug, slug));

    res.json({ ok: true });
  } catch (err) {
    req.log?.error(err, "Update solo challenge deadline error");
    res.status(500).json({ message: "خطأ في حفظ الموعد" });
  }
});

export default router;
