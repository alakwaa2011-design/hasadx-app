import { Router, type IRouter } from "express";
import { db, assignmentsTable, questionsTable, teachersTable, notificationsTable, gameHistoryTable, dismissedSharedTable, studentsTable } from "@workspace/db";
import { eq, sql, and, ne, notInArray, inArray, isNull, or } from "drizzle-orm";
import { submissionsTable } from "@workspace/db";
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
import { awardXpAndNotify } from "../lib/xp/socket";

const UpdateAssignmentBody = z.object({
  title: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  description: z.string().optional(),
  submissionMode: z.enum(["electronic", "paper", "both"]).optional(),
  accessMode: z.enum(["public", "private"]).optional(),
  accessCode: z.string().nullish(),
  targetClass: z.string().nullish(),
  targetClasses: z.array(z.string()).nullish(),
  categoryId: z.number().nullish(),
  showResults: z.boolean().optional(),
  deadline: z.string().datetime({ offset: true }).nullish().or(z.literal("").transform(() => null)),
  examMode: z.boolean().optional(),
  examDurationMinutes: z.number().nullish(),
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
      points: z.number().min(0).default(1),
      imageUrl: z.string().nullish(),
      readAloud: z.boolean().optional(),
      allowMultipleAnswers: z.boolean().optional(),
      repeatQuestion: z.boolean().optional(),
    })
  ).min(1).optional(),
});

const router: IRouter = Router();

async function isAdminTeacher(teacherId: number | undefined): Promise<boolean> {
  if (!teacherId) return false;
  const [t] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, teacherId)).limit(1);
  return !!t?.isAdmin;
}

router.get("/assignments", async (req, res) => {
  try {
    const query = ListAssignmentsQueryParams.parse(req.query);
    const includeShared = (req.query.include as string | undefined) === "shared";

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

    let ownResults;
    if (query.teacherId) {
      ownResults = await baseQuery.where(and(eq(assignmentsTable.teacherId, query.teacherId), notFromPresentation));
    } else if (req.session?.teacherId) {
      ownResults = await baseQuery.where(and(eq(assignmentsTable.teacherId, req.session.teacherId), notFromPresentation));
    } else {
      ownResults = await baseQuery.where(notFromPresentation);
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
            eq(assignmentsTable.hiddenByAdmin, false),
            // Defensive privacy filter: private-access rows must never
            // appear in the shared library even if a stale isShared flag
            // ever leaks through.
            ne(assignmentsTable.accessMode, "private"),
            ne(assignmentsTable.teacherId, requesterTeacherId),
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

  // ── Subscription gate: enforce monthly homework limit. NULL = unlimited.
  // We increment FIRST so concurrent requests can't both slip past a near-limit.
  const teacherId = req.session.teacherId;
  const gate = await featureAccess.increment(teacherId, "create_homework");
  if (!gate.allowed) {
    res.status(403).json({
      message: "لقد وصلت إلى الحد الشهري للواجبات في باقتك الحالية. يرجى ترقية الاشتراك.",
      reason: gate.reason,
      limit: gate.limit,
      used: gate.used,
      remaining: gate.remaining,
    });
    return;
  }

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

    const [assignment] = await db
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
        teacherId: req.session.teacherId,
      })
      .returning();

    if (body.questions && body.questions.length > 0) {
      await db.insert(questionsTable).values(
        body.questions.map((q) => ({
          assignmentId: assignment.id,
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

    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.id, req.session.teacherId))
      .limit(1);

    void awardXpAndNotify({
      teacherId: req.session.teacherId,
      actionKey: "assignment.create",
      refId: `assignment:${assignment.id}`,
      reason: assignment.title,
    });

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
  } catch (error: unknown) {
    // Refund the slot we incremented at the top of the handler since the
    // creation failed and no homework was actually persisted.
    await featureAccess.refund(teacherId, "create_homework").catch(() => {});
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
        examMode: assignmentsTable.examMode,
        examDurationMinutes: assignmentsTable.examDurationMinutes,
        resultsReleaseMode: assignmentsTable.resultsReleaseMode,
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
      })
      .from(assignmentsTable)
      .innerJoin(teachersTable, eq(assignmentsTable.teacherId, teachersTable.id))
      .where(eq(assignmentsTable.id, id))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }

    const questions = await db
      .select()
      .from(questionsTable)
      .where(eq(questionsTable.assignmentId, id));

    const isTeacher = req.session.teacherId === assignment.teacherId;
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
    // Other authenticated teachers may view correctAnswer for admin-approved shared
    // assignments so they can use them in their own games (Tug, Million, etc.).
    const isApprovedSharedForTeacher =
      !!req.session.teacherId && !isTeacher && assignment.isShared && assignment.isShareApproved;
    const canSeeCorrectAnswer = isTeacher || isApprovedSharedForTeacher;

    // Private assignments require either the owner, an approved-shared viewer,
    // or a valid access code in the X-Access-Code header. Without these we
    // return only a minimal stub so the student frontend can prompt for the
    // code without leaking questions or class targeting.
    if (assignment.accessMode === "private" && !isTeacher && !isApprovedSharedForTeacher) {
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
      examMode: assignment.examMode,
      examDurationMinutes: assignment.examDurationMinutes,
      resultsReleaseMode: assignment.resultsReleaseMode,
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

    res.json({ students, assignments, submissions });
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

    if (body.accessMode === "private" && !body.accessCode && !assignment.accessCode) {
      res.status(400).json({ message: "يجب تحديد كود الدخول للواجب الخاص" });
      return;
    }

    await db.transaction(async (tx) => {
      const updateData: Record<string, any> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.subject !== undefined) updateData.subject = body.subject;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.submissionMode !== undefined) updateData.submissionMode = body.submissionMode;
      if (body.accessMode !== undefined) {
        updateData.accessMode = body.accessMode;
        // Privacy invariant: switching to private access mode forces
        // the assignment out of the public library.
        if (body.accessMode === "private") updateData.isShared = false;
      }
      if (body.accessCode !== undefined) updateData.accessCode = body.accessCode;
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
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: "بيانات غير صالحة" });
      return;
    }
    res.status(500).json({ message: "خطأ في تحديث الواجب" });
  }
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

router.delete("/assignments/:id/questions/:questionId", async (req, res) => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول أولاً" });
    return;
  }
  try {
    const assignmentId = parseInt(req.params.id, 10);
    const questionId = parseInt(req.params.questionId, 10);
    if (isNaN(assignmentId) || isNaN(questionId)) {
      res.status(400).json({ message: "معرف غير صالح" });
      return;
    }

    const [assignment] = await db
      .select()
      .from(assignmentsTable)
      .where(eq(assignmentsTable.id, assignmentId))
      .limit(1);

    if (!assignment) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }
    if (assignment.teacherId !== req.session.teacherId) {
      res.status(403).json({ message: "غير مصرح لك بحذف هذا السؤال" });
      return;
    }

    const [question] = await db
      .select()
      .from(questionsTable)
      .where(and(eq(questionsTable.id, questionId), eq(questionsTable.assignmentId, assignmentId)))
      .limit(1);

    if (!question) {
      res.status(404).json({ message: "السؤال غير موجود" });
      return;
    }

    await db.delete(questionsTable).where(eq(questionsTable.id, questionId));
    res.json({ message: "تم حذف السؤال بنجاح" });
  } catch (error: any) {
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
    const { isShared } = req.body;
    const wantShared = !!isShared;
    // Privacy invariant: a private-access assignment must never be
    // marked shared, even if the client toggles the switch. Look up
    // accessMode first and force isShared=false for private rows.
    const [existing] = await db
      .select({ accessMode: assignmentsTable.accessMode })
      .from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, id), eq(assignmentsTable.teacherId, req.session.teacherId!)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }
    const effectiveShared = existing.accessMode === "private" ? false : wantShared;
    // All shares are auto-approved now (admins can hide individual rows
    // via /admin/assignments/:id/hide). Keep isShareApproved in sync with
    // isShared for every teacher, not just admins.
    const [updated] = await db
      .update(assignmentsTable)
      .set({ isShared: effectiveShared, isShareApproved: true })
      .where(and(eq(assignmentsTable.id, id), eq(assignmentsTable.teacherId, req.session.teacherId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "الواجب غير موجود" });
      return;
    }
    res.json({ id: updated.id, isShared: updated.isShared });
  } catch (err) {
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

export default router;
