import { Router, type IRouter } from "express";
import {
  db,
  videoLessonsTable,
  videoQuestionsTable,
  videoSubmissionsTable,
  videoAnswersTable,
  teachersTable,
  studentsTable,
  teacherClassesTable,
} from "@workspace/db";
import { eq, sql, and, desc, or } from "drizzle-orm";
import { z } from "zod";
import { awardXpInTxAndNotifyAfterCommit } from "../lib/xp/socket";
import { reverseXpIfWithinWindow } from "../lib/xp/engine";

const router: IRouter = Router();

function formatZodError(error: z.ZodError): string {
  const first = error.errors[0];
  if (first?.message) return first.message;
  return "بيانات غير صالحة";
}

/** يُرجع عدداً صالحاً أو undefined — يدعم سلاسل JSON من الواجهة/المسودة. */
function coerceFiniteNumber(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const n = Number(val.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function coerceFiniteNumberWithDefault(val: unknown, def: number): number {
  const n = coerceFiniteNumber(val);
  return n === undefined ? def : n;
}

function preprocessSkipSegments(val: unknown): unknown {
  if (val === undefined || val === null) return [];
  let raw: unknown[] = [];
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      raw = Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  } else if (Array.isArray(val)) {
    raw = val;
  } else {
    return [];
  }
  const out: { start: number; end: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const start = coerceFiniteNumber(o.start);
    const end = coerceFiniteNumber(o.end);
    if (start === undefined || end === undefined || end <= start) continue;
    out.push({ start, end });
  }
  return out;
}

function preprocessSkipSegmentsPatch(val: unknown): unknown {
  if (val === undefined) return undefined;
  return preprocessSkipSegments(val);
}

function preprocessQuestionNullableString(val: unknown): unknown {
  if (val === undefined || val === null) return null;
  if (typeof val !== "string") {
    const s = String(val).trim();
    return s === "" ? null : s;
  }
  const t = val.trim();
  return t === "" ? null : t;
}

const SkipSegmentRowSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
});

/** سؤال درس فيديو — قيم مرنة من الواجهة (نصوص أرقام، مسودة، إلخ). */
const VideoLessonQuestionInputSchema = z.object({
  id: z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = coerceFiniteNumber(v);
    if (n === undefined || !Number.isInteger(n) || n <= 0) return v;
    return n;
  }, z.number().int().positive().optional()),
  timestampSeconds: z.preprocess((v) => coerceFiniteNumberWithDefault(v, 0), z.number().min(0)),
  questionType: z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return "mcq";
    const s = String(v).trim().toLowerCase();
    if (s === "mcq" || s === "true_false" || s === "fill_blank") return s;
    return v;
  }, z.enum(["mcq", "true_false", "fill_blank"])),
  text: z.preprocess((v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim()), z.string().min(1)),
  optionA: z.preprocess(preprocessQuestionNullableString, z.union([z.string(), z.null()])),
  optionB: z.preprocess(preprocessQuestionNullableString, z.union([z.string(), z.null()])),
  optionC: z.preprocess(preprocessQuestionNullableString, z.union([z.string(), z.null()])),
  optionD: z.preprocess(preprocessQuestionNullableString, z.union([z.string(), z.null()])),
  correctAnswer: z.preprocess(preprocessQuestionNullableString, z.union([z.string(), z.null()])),
  points: z.preprocess((v) => coerceFiniteNumberWithDefault(v, 1), z.number().min(0)),
});

const VideoLessonQuestionCreateSchema = VideoLessonQuestionInputSchema.omit({ id: true });

/** DB يخزّن private وليس private_code — نقبل alias من الواجهة ونطبّعه. */
function preprocessVideoLessonAccessMode(val: unknown): unknown {
  if (val === null || val === undefined || val === "") return "public";
  if (typeof val === "number") return "__INVALID_ACCESS_MODE_NUMBER__";
  const s = String(val).trim().toLowerCase().replace(/-/g, "_");
  if (s === "private_code" || s === "private") return "private";
  if (s === "public") return "public";
  return val;
}

function preprocessOptionalEmptyTextToNull(val: unknown): unknown {
  if (val === undefined || val === null) return null;
  if (typeof val !== "string") return val;
  const t = val.trim();
  return t === "" ? null : t;
}

/** للـ PATCH: لا تُبدّل الحقل إذا وُجد undefined (غير مرسل). */
function preprocessOptionalEmptyTextPatch(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  if (typeof val !== "string") return val;
  const t = val.trim();
  return t === "" ? null : t;
}

function preprocessTeacherClassId(val: unknown): unknown {
  if (val === "" || val === undefined || val === null) return null;
  if (typeof val === "number" && Number.isInteger(val) && val > 0) return val;
  if (typeof val === "string" && /^\d+$/.test(val.trim())) return parseInt(val.trim(), 10);
  return val;
}

function preprocessTeacherClassIdPatch(val: unknown): unknown {
  if (val === undefined) return undefined;
  return preprocessTeacherClassId(val);
}

function preprocessVideoType(val: unknown): unknown {
  if (val === undefined || val === null || val === "") return "youtube";
  const s = String(val).trim().toLowerCase();
  if (s === "youtube" || s === "upload" || s === "external") return s;
  return val;
}

function preprocessIsShared(val: unknown): unknown {
  if (val === undefined || val === null) return true;
  if (typeof val === "boolean") return val;
  if (val === "false" || val === 0) return false;
  if (val === "true" || val === 1) return true;
  return val;
}

const CreateVideoLessonBody = z
  .object({
    title: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1)),
    subject: z.preprocess(preprocessOptionalEmptyTextToNull, z.union([z.string(), z.null()])),
    description: z.preprocess(preprocessOptionalEmptyTextToNull, z.union([z.string(), z.null()])),
    videoUrl: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1)),
    videoType: z.preprocess(preprocessVideoType, z.enum(["youtube", "upload", "external"])),
    teacherClassId: z.preprocess(preprocessTeacherClassId, z.union([z.number().int().positive(), z.null()])),
    targetClass: z.preprocess(preprocessOptionalEmptyTextToNull, z.union([z.string(), z.null()])),
    accessMode: z.preprocess(preprocessVideoLessonAccessMode, z.enum(["public", "private"])),
    accessCode: z.preprocess(preprocessOptionalEmptyTextToNull, z.union([z.string(), z.null()])),
    isShared: z.preprocess(preprocessIsShared, z.boolean()),
    skipSegments: z.preprocess(preprocessSkipSegments, z.array(SkipSegmentRowSchema)),
    questions: z.array(VideoLessonQuestionCreateSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.accessMode === "private") {
      const code = data.accessCode?.trim();
      if (!code) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "يرجى إدخال كود الوصول عند اختيار وضع خاص",
          path: ["accessCode"],
        });
      }
    }
  });

const UpdateVideoLessonBody = z.object({
  title: z.string().min(1).optional(),
  subject: z.preprocess(preprocessOptionalEmptyTextPatch, z.union([z.string(), z.null()])).optional(),
  description: z.preprocess(preprocessOptionalEmptyTextPatch, z.union([z.string(), z.null()])).optional(),
  videoUrl: z.string().min(1).optional(),
  videoType: z.preprocess(
    (v) => (v === undefined ? undefined : preprocessVideoType(v)),
    z.enum(["youtube", "upload", "external"]).optional(),
  ),
  teacherClassId: z.preprocess(preprocessTeacherClassIdPatch, z.union([z.number().int().positive(), z.null()])).optional(),
  targetClass: z.preprocess(preprocessOptionalEmptyTextPatch, z.union([z.string(), z.null()])).optional(),
  accessMode: z.preprocess(
    (v) => (v === undefined ? undefined : preprocessVideoLessonAccessMode(v)),
    z.enum(["public", "private"]).optional(),
  ),
  accessCode: z.preprocess(preprocessOptionalEmptyTextPatch, z.union([z.string(), z.null()])).optional(),
  isShared: z.preprocess((v) => (v === undefined ? undefined : preprocessIsShared(v)), z.boolean()).optional(),
  skipSegments: z.preprocess(preprocessSkipSegmentsPatch, z.array(SkipSegmentRowSchema)).optional(),
  questions: z.array(VideoLessonQuestionInputSchema).min(1).optional(),
});

const SubmitVideoLessonBody = z.object({
  studentName: z.string().min(1),
  studentClass: z.string().default(""),
  studentId: z.number().optional(),
  accessCode: z.string().optional(),
  answers: z.array(
    z.object({
      questionId: z.number(),
      selectedAnswer: z.string(),
    })
  ),
});

/** تحقق فوري أثناء التشغيل — نفس منطق المقارنة في submit */
const CheckVideoAnswerBody = z.object({
  questionId: z.preprocess(
    (val) => {
      if (val === null || val === undefined) return NaN;
      if (typeof val === "number") return val;
      if (typeof val === "string") return parseInt(val.trim(), 10);
      return NaN;
    },
    z.number().int().positive(),
  ),
  selectedAnswer: z.string().min(1),
  accessCode: z.string().optional(),
});

async function resolveLessonClassName(
  lesson: typeof videoLessonsTable.$inferSelect,
): Promise<string | null> {
  if (lesson.teacherClassId != null) {
    const [tc] = await db
      .select({ name: teacherClassesTable.name })
      .from(teacherClassesTable)
      .where(
        and(
          eq(teacherClassesTable.id, lesson.teacherClassId),
          eq(teacherClassesTable.teacherId, lesson.teacherId),
        ),
      )
      .limit(1);
    if (tc?.name) return tc.name;
  }
  return lesson.targetClass ?? null;
}

type VideoLessonDbExecutor = Pick<typeof db, "insert">;

type VideoLessonInsertPayload = {
  title: string;
  subject: string | null;
  description: string | null;
  videoUrl: string;
  videoType: "youtube" | "upload" | "external";
  targetClass: string | null;
  teacherClassId: number | null;
  accessMode: "public" | "private";
  accessCode: string | null;
  teacherId: number;
  isPublished: boolean;
  isShared: boolean;
  hiddenByAdmin: boolean;
  hiddenAt: null;
  hiddenById: null;
  hideReason: null;
  skipSegments: string | null;
};

function trimOrNull(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

/**
 * يبني كائن إدراج بحقول مسماة (Drizzle) — بدون Object.values ولا ترتيب ضمني.
 */
function buildCreateVideoLessonInsertPayload(
  body: Record<string, unknown>,
  teacherId: number,
  targetClassResolved: string | null,
  teacherClassIdResolved: number | null,
): VideoLessonInsertPayload {
  const {
    title: titleRaw,
    subject,
    description,
    videoUrl,
    video_url,
    videoType,
    video_type,
    targetClass,
    target_class,
    teacherClassId,
    teacher_class_id,
    accessMode,
    access_mode,
    accessCode,
    access_code,
    isPublished,
    is_published,
    isShared,
    is_shared,
    skipSegments,
    skip_segments,
  } = body;

  const title = typeof titleRaw === "string" ? titleRaw.trim() : String(titleRaw ?? "").trim();
  const finalVideoUrl = trimOrNull(videoUrl ?? video_url) ?? "";
  const finalVideoType = String(videoType ?? video_type ?? "youtube")
    .trim()
    .toLowerCase();
  const finalAccessMode = String(accessMode ?? access_mode ?? "public")
    .trim()
    .toLowerCase();

  if (!title) throw new Error("title is required");
  if (!finalVideoUrl) throw new Error("video_url is required");
  if (!["youtube", "upload", "external"].includes(finalVideoType)) throw new Error("invalid video_type");
  if (!["public", "private_code", "private"].includes(finalAccessMode)) {
    throw new Error("invalid access_mode");
  }

  const subjectVal = trimOrNull(subject);
  let descriptionVal = trimOrNull(description);
  if (descriptionVal && /youtube\.com|youtu\.be/i.test(descriptionVal)) {
    throw new Error("description must not be a video URL");
  }

  const resolvedTargetClass = targetClassResolved ?? trimOrNull(targetClass ?? target_class);
  const resolvedTeacherClassId =
    teacherClassIdResolved ??
    (() => {
      const raw = teacherClassId ?? teacher_class_id;
      if (raw === "" || raw === undefined || raw === null) return null;
      const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
      return Number.isInteger(n) && n > 0 ? n : null;
    })();

  const dbAccessMode = finalAccessMode === "private" || finalAccessMode === "private_code" ? "private" : "public";
  const accessCodeRaw = accessCode ?? access_code;
  const accessCodeVal =
    dbAccessMode === "private" ? trimOrNull(accessCodeRaw) : null;

  const skipRaw = skipSegments ?? skip_segments ?? [];
  const skipJson =
    Array.isArray(skipRaw) && skipRaw.length > 0 ? JSON.stringify(skipRaw) : null;

  const videoTypeNorm = finalVideoType as VideoLessonInsertPayload["videoType"];

  return {
    title,
    subject: subjectVal,
    description: descriptionVal,
    videoUrl: finalVideoUrl,
    videoType: videoTypeNorm,
    targetClass: resolvedTargetClass,
    teacherClassId: resolvedTeacherClassId,
    accessMode: dbAccessMode,
    accessCode: accessCodeVal,
    teacherId,
    isPublished: Boolean(isPublished ?? is_published ?? true),
    isShared: Boolean(isShared ?? is_shared ?? false),
    hiddenByAdmin: false,
    hiddenAt: null,
    hiddenById: null,
    hideReason: null,
    skipSegments: skipJson,
  };
}

/** إدراج عبر Drizzle بحقول مسماة — يطابق أعمدة schema دون انزياح params. */
async function insertVideoLessonReturningId(
  executor: VideoLessonDbExecutor,
  payload: VideoLessonInsertPayload,
  sessionTeacherId: number,
): Promise<number> {
  if (typeof payload.teacherId !== "number" || !Number.isFinite(payload.teacherId) || payload.teacherId <= 0) {
    throw new Error("teacher_id must be a positive number");
  }
  if (payload.teacherId !== sessionTeacherId) {
    throw new Error("teacher_id mismatch");
  }

  console.log("CREATE VIDEO LESSON VALUES", payload);

  const [row] = await executor
    .insert(videoLessonsTable)
    .values(payload)
    .returning({ id: videoLessonsTable.id });

  const newId = row?.id;
  if (newId === undefined || !Number.isFinite(newId)) {
    throw new Error("فشل إنشاء الدرس");
  }
  return newId;
}

router.get("/video-lessons", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const lessons = await db
      .select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        description: videoLessonsTable.description,
        videoUrl: videoLessonsTable.videoUrl,
        videoType: videoLessonsTable.videoType,
        targetClass: videoLessonsTable.targetClass,
        teacherClassId: videoLessonsTable.teacherClassId,
        accessMode: videoLessonsTable.accessMode,
        teacherId: videoLessonsTable.teacherId,
        isPublished: videoLessonsTable.isPublished,
        isShared: videoLessonsTable.isShared,
        createdAt: videoLessonsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM video_questions WHERE video_questions.video_lesson_id = ${videoLessonsTable.id})`.as("question_count"),
        submissionCount: sql<number>`(SELECT COUNT(*) FROM video_submissions WHERE video_submissions.video_lesson_id = ${videoLessonsTable.id})`.as("submission_count"),
      })
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.teacherId, teacherId))
      .orderBy(desc(videoLessonsTable.createdAt));

    res.json(lessons);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/shared/all", async (req, res) => {
  try {
    // Admin-only opt-in to include hidden rows for moderation.
    const wantHidden = req.query.showHidden === "1" || req.query.showHidden === "true";
    let isAdminRequester = false;
    const requesterId = req.session.teacherId;
    if (wantHidden && requesterId) {
      const [me] = await db.select({ isAdmin: teachersTable.isAdmin }).from(teachersTable).where(eq(teachersTable.id, requesterId)).limit(1);
      isAdminRequester = !!me?.isAdmin;
    }

    const lessons = await db
      .select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        description: videoLessonsTable.description,
        videoType: videoLessonsTable.videoType,
        targetClass: videoLessonsTable.targetClass,
        teacherClassId: videoLessonsTable.teacherClassId,
        teacherId: videoLessonsTable.teacherId,
        teacherName: teachersTable.name,
        isAdminContent: teachersTable.isAdmin,
        isShared: videoLessonsTable.isShared,
        hiddenByAdmin: videoLessonsTable.hiddenByAdmin,
        createdAt: videoLessonsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM video_questions WHERE video_questions.video_lesson_id = ${videoLessonsTable.id})`.as("question_count"),
      })
      .from(videoLessonsTable)
      .leftJoin(teachersTable, eq(videoLessonsTable.teacherId, teachersTable.id))
      .where(and(
        eq(videoLessonsTable.isShared, true),
        (wantHidden && isAdminRequester) ? undefined : eq(videoLessonsTable.hiddenByAdmin, false),
      ))
      .orderBy(desc(videoLessonsTable.createdAt));

    res.json(lessons.map(l => ({ ...l, isAdminContent: !!l.isAdminContent })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/shared", async (req, res) => {
  try {
    const lessons = await db
      .select({
        id: videoLessonsTable.id,
        title: videoLessonsTable.title,
        subject: videoLessonsTable.subject,
        description: videoLessonsTable.description,
        videoType: videoLessonsTable.videoType,
        targetClass: videoLessonsTable.targetClass,
        teacherClassId: videoLessonsTable.teacherClassId,
        teacherId: videoLessonsTable.teacherId,
        teacherName: teachersTable.name,
        isShared: videoLessonsTable.isShared,
        createdAt: videoLessonsTable.createdAt,
        questionCount: sql<number>`(SELECT COUNT(*) FROM video_questions WHERE video_questions.video_lesson_id = ${videoLessonsTable.id})`.as("question_count"),
      })
      .from(videoLessonsTable)
      .leftJoin(teachersTable, eq(videoLessonsTable.teacherId, teachersTable.id))
      .where(and(eq(videoLessonsTable.isShared, true), eq(videoLessonsTable.hiddenByAdmin, false)))
      .orderBy(desc(videoLessonsTable.createdAt));

    res.json(lessons);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.post("/video-lessons/:id/import", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) return res.status(401).json({ message: "غير مسجل" });

    const sourceId = parseInt(req.params.id);
    if (isNaN(sourceId)) return res.status(400).json({ message: "معرف غير صالح" });

    const [source] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, sourceId))
      .limit(1);

    if (!source) return res.status(404).json({ message: "درس غير موجود" });
    if (!source.isShared && source.teacherId !== teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }
    // Admin-hidden lessons cannot be imported even if the ID is known.
    // Owners are still allowed to clone their own (hidden) content.
    if (source.hiddenByAdmin && source.teacherId !== teacherId) {
      return res.status(404).json({ message: "درس غير متاح" });
    }

    const importVideoType =
      source.videoType === "youtube" || source.videoType === "upload" || source.videoType === "external"
        ? source.videoType
        : "youtube";
    const importPayload: VideoLessonInsertPayload = {
      title: source.title,
      subject: source.subject ?? null,
      description: source.description ?? null,
      videoUrl: source.videoUrl,
      videoType: importVideoType,
      targetClass: null,
      teacherClassId: null,
      accessMode: "public",
      accessCode: null,
      teacherId,
      isPublished: true,
      isShared: false,
      hiddenByAdmin: false,
      hiddenAt: null,
      hiddenById: null,
      hideReason: null,
      skipSegments: source.skipSegments ?? null,
    };

    const newId = await insertVideoLessonReturningId(db, importPayload, teacherId);
    const [newLesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, newId))
      .limit(1);
    if (!newLesson) {
      return res.status(500).json({ message: "فشل إنشاء نسخة الدرس" });
    }

    const sourceQuestions = await db
      .select()
      .from(videoQuestionsTable)
      .where(eq(videoQuestionsTable.videoLessonId, sourceId));

    if (sourceQuestions.length > 0) {
      await db.insert(videoQuestionsTable).values(
        sourceQuestions.map((q) => ({
          videoLessonId: newLesson.id,
          timestampSeconds: q.timestampSeconds,
          questionType: q.questionType,
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          points: q.points,
          questionOrder: q.questionOrder,
        }))
      );
    }

    res.json({ id: newLesson.id, message: "تم استيراد الدرس بنجاح" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });

    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });

    const resolvedTargetClass = await resolveLessonClassName(lesson);

    if (lesson.accessMode === "private") {
      const isTeacher = req.session.teacherId === lesson.teacherId;
      if (!isTeacher) {
        const code = (req.query.code as string || "").trim().toUpperCase();
        const storedCode = (lesson.accessCode || "").trim().toUpperCase();
        if (!code || code !== storedCode) {
          return res.json({
            id: lesson.id,
            title: lesson.title,
            subject: lesson.subject,
            description: lesson.description,
            accessMode: lesson.accessMode,
            requiresCode: true,
          });
        }
      }
    }

    const questions = await db
      .select()
      .from(videoQuestionsTable)
      .where(eq(videoQuestionsTable.videoLessonId, id))
      .orderBy(videoQuestionsTable.timestampSeconds);

    const isTeacher = req.session.teacherId === lesson.teacherId;

    const questionsForClient = questions.map((q) => ({
      id: q.id,
      timestampSeconds: q.timestampSeconds,
      questionType: q.questionType,
      text: q.text,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: isTeacher ? q.correctAnswer : undefined,
      points: q.points,
      questionOrder: q.questionOrder,
    }));

    let parsedSkipSegments: { start: number; end: number }[] = [];
    if (lesson.skipSegments) {
      try {
        const raw = JSON.parse(lesson.skipSegments);
        if (Array.isArray(raw)) parsedSkipSegments = raw;
      } catch {}
    }

    res.json({
      ...lesson,
      targetClass: resolvedTargetClass ?? lesson.targetClass,
      skipSegments: parsedSkipSegments,
      questions: questionsForClient,
      totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.post("/video-lessons", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const body = CreateVideoLessonBody.parse(req.body);

    const teacherId = req.session.teacherId;
    let teacherClassIdVal: number | null = body.teacherClassId ?? null;
    let targetClassVal: string | null = body.targetClass;
    if (teacherClassIdVal != null) {
      const [tc] = await db
        .select({ id: teacherClassesTable.id, name: teacherClassesTable.name })
        .from(teacherClassesTable)
        .where(and(eq(teacherClassesTable.id, teacherClassIdVal), eq(teacherClassesTable.teacherId, teacherId)))
        .limit(1);
      if (!tc) {
        return res.status(400).json({ message: "صف غير صالح أو غير تابع لحسابك" });
      }
      targetClassVal = tc.name;
    }

    const insertPayload = buildCreateVideoLessonInsertPayload(
      req.body as Record<string, unknown>,
      teacherId,
      targetClassVal,
      teacherClassIdVal,
    );

    if (insertPayload.accessMode === "private") {
      const code = insertPayload.accessCode;
      if (typeof code !== "string" || !code.trim()) {
        return res.status(400).json({ message: "يرجى إدخال كود الوصول عند اختيار وضع خاص" });
      }
    }

    // Wrap insert + XP in a single transaction: if either fails, both roll back.
    const { lesson, runAfterCommit } = await db.transaction(async (tx) => {
      const newId = await insertVideoLessonReturningId(tx, insertPayload, teacherId);

      const [l] = await tx
        .select()
        .from(videoLessonsTable)
        .where(eq(videoLessonsTable.id, newId))
        .limit(1);
      if (!l) throw new Error("فشل إنشاء الدرس");

      if (body.questions && body.questions.length > 0) {
        await tx.insert(videoQuestionsTable).values(
          body.questions.map((q, idx) => ({
            videoLessonId: l.id,
            timestampSeconds: q.timestampSeconds,
            questionType: q.questionType,
            text: q.text,
            optionA: q.optionA || null,
            optionB: q.optionB || null,
            optionC: q.optionC || null,
            optionD: q.optionD || null,
            correctAnswer: q.correctAnswer || null,
            points: q.points,
            questionOrder: idx,
          }))
        );
      }

      const { runAfterCommit: rac } = await awardXpInTxAndNotifyAfterCommit(tx, {
        teacherId,
        actionKey: "video_lesson.create",
        refId: `video_lesson:${l.id}`,
      });
      return { lesson: l, runAfterCommit: rac };
    });

    // Run badge/quest/threshold checks AFTER the tx commits (never inside).
    void runAfterCommit().catch(() => {});

    // Present on successful create so DevTools can confirm this API build uses raw INSERT (not Drizzle insert().returning()).
    res.setHeader("X-Hasaad-Video-Lesson-Create", "drizzle-named-insert-v1");
    res.status(201).json(lesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: formatZodError(error), errors: error.errors });
    }
    const validationErrors = [
      "title is required",
      "video_url is required",
      "invalid video_type",
      "invalid access_mode",
      "description must not be a video URL",
      "teacher_id must be a positive number",
      "teacher_id mismatch",
    ];
    if (error instanceof Error && validationErrors.includes(error.message)) {
      return res.status(400).json({ message: error.message });
    }
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.put("/video-lessons/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "درس غير موجود" });
    if (existing.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const body = UpdateVideoLessonBody.parse(req.body);

    const updateData: Partial<typeof videoLessonsTable.$inferInsert> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.subject !== undefined) updateData.subject = body.subject || null;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl;
    if (body.videoType !== undefined) updateData.videoType = body.videoType;

    if (body.teacherClassId !== undefined) {
      if (body.teacherClassId === null) {
        updateData.teacherClassId = null;
        if (body.targetClass !== undefined) {
          updateData.targetClass = body.targetClass || null;
        }
      } else {
        const [tc] = await db
          .select({ id: teacherClassesTable.id, name: teacherClassesTable.name })
          .from(teacherClassesTable)
          .where(and(
            eq(teacherClassesTable.id, body.teacherClassId),
            eq(teacherClassesTable.teacherId, req.session.teacherId),
          ))
          .limit(1);
        if (!tc) {
          return res.status(400).json({ message: "صف غير صالح أو غير تابع لحسابك" });
        }
        updateData.teacherClassId = tc.id;
        updateData.targetClass = tc.name;
      }
    } else if (body.targetClass !== undefined) {
      updateData.targetClass = body.targetClass || null;
    }

    if (body.accessMode !== undefined) updateData.accessMode = body.accessMode;
    if (body.accessCode !== undefined) updateData.accessCode = body.accessCode || null;
    if (body.isShared !== undefined) updateData.isShared = body.isShared;
    if (body.skipSegments !== undefined) {
      updateData.skipSegments = body.skipSegments.length > 0
        ? JSON.stringify(body.skipSegments)
        : null;
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(videoLessonsTable)
        .set(updateData)
        .where(eq(videoLessonsTable.id, id));
    }

    if (body.questions) {
      await db.delete(videoQuestionsTable).where(eq(videoQuestionsTable.videoLessonId, id));
      await db.insert(videoQuestionsTable).values(
        body.questions.map((q, idx) => ({
          videoLessonId: id,
          timestampSeconds: q.timestampSeconds,
          questionType: q.questionType,
          text: q.text,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
          points: q.points,
          questionOrder: idx,
        }))
      );
    }

    const [updated] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: formatZodError(error), errors: error.errors });
    }
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.delete("/video-lessons/:id", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "درس غير موجود" });
    if (existing.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    await db.delete(videoLessonsTable).where(eq(videoLessonsTable.id, id));
    // Reverse XP if deleted within 5-minute anti-abuse window (fire-and-forget)
    void reverseXpIfWithinWindow(
      existing.teacherId,
      "video_lesson.create",
      `video_lesson:${id}`,
    ).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.post("/video-lessons/:id/check-answer", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });

    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });

    const body = CheckVideoAnswerBody.parse(req.body);

    const isLessonOwner = req.session.teacherId === lesson.teacherId;
    if (lesson.accessMode === "private" && !isLessonOwner) {
      const submittedCode = (body.accessCode || "").trim().toUpperCase();
      const storedCode = (lesson.accessCode || "").trim().toUpperCase();
      if (!submittedCode || submittedCode !== storedCode) {
        return res.status(403).json({ message: "كود الدخول غير صحيح" });
      }
    }

    const [question] = await db
      .select()
      .from(videoQuestionsTable)
      .where(and(eq(videoQuestionsTable.videoLessonId, id), eq(videoQuestionsTable.id, body.questionId)))
      .limit(1);

    if (!question) return res.status(404).json({ message: "سؤال غير موجود" });

    let isCorrect = false;
    if (question.correctAnswer) {
      const studentAns = body.selectedAnswer.trim().toLowerCase();
      const correctAns = question.correctAnswer.trim().toLowerCase();
      isCorrect = studentAns === correctAns;
    }

    res.json({
      isCorrect,
      points: question.points,
      earnedPoints: isCorrect ? question.points : 0,
      /** دائماً نُرجع الإجابة المرجعية حتى تلوّن الواجهة الخيار الصحيح (أخضر) عند الإجابة الصحيحة — كان إرجاع null يجعل المختار يُعرض كخطأ. */
      correctAnswer: question.correctAnswer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: formatZodError(error), errors: error.errors });
    }
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.post("/video-lessons/:id/submit", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });

    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });

    const body = SubmitVideoLessonBody.parse(req.body);

    const isLessonOwner = req.session.teacherId === lesson.teacherId;
    if (lesson.accessMode === "private" && !isLessonOwner) {
      const submittedCode = (body.accessCode || "").trim().toUpperCase();
      const storedCode = (lesson.accessCode || "").trim().toUpperCase();
      if (!submittedCode || submittedCode !== storedCode) {
        return res.status(403).json({ message: "كود الدخول غير صحيح" });
      }
    }

    const className = await resolveLessonClassName(lesson);
    let studentNameFinal = body.studentName.trim();
    let studentClassFinal = (body.studentClass || "").trim();
    let studentIdFinal: number | null = body.studentId ?? null;

    if (className) {
      if (!body.studentId) {
        return res.status(400).json({ message: "اختر اسمك من قائمة الفصل" });
      }
      const [st] = await db
        .select()
        .from(studentsTable)
        .where(and(
          eq(studentsTable.id, body.studentId),
          eq(studentsTable.teacherId, lesson.teacherId),
          or(eq(studentsTable.gradeLevel, className), eq(studentsTable.studentClass, className)),
        ))
        .limit(1);
      if (!st) {
        return res.status(403).json({ message: "هذا الطالب غير مسجل في الفصل المحدد للدرس" });
      }
      studentNameFinal = st.name;
      studentClassFinal = className;
      studentIdFinal = st.id;
    }

    const questions = await db
      .select()
      .from(videoQuestionsTable)
      .where(eq(videoQuestionsTable.videoLessonId, id));

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let correctCount = 0;
    let earnedPoints = 0;
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const answerResults: { questionId: number; selectedAnswer: string; isCorrect: boolean; questionText: string; correctAnswer: string | null; points: number; earnedPoints: number }[] = [];

    for (const ans of body.answers) {
      const question = questionMap.get(ans.questionId);
      if (!question) continue;

      let isCorrect = false;
      if (question.correctAnswer) {
        const studentAns = ans.selectedAnswer.trim().toLowerCase();
        const correctAns = question.correctAnswer.trim().toLowerCase();
        isCorrect = studentAns === correctAns;
      }

      if (isCorrect) {
        correctCount++;
        earnedPoints += question.points;
      }

      answerResults.push({
        questionId: question.id,
        selectedAnswer: ans.selectedAnswer,
        isCorrect,
        questionText: question.text,
        correctAnswer: question.correctAnswer,
        points: question.points,
        earnedPoints: isCorrect ? question.points : 0,
      });
    }

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    const [submission] = await db
      .insert(videoSubmissionsTable)
      .values({
        videoLessonId: id,
        studentName: studentNameFinal,
        studentClass: studentClassFinal,
        studentId: studentIdFinal,
        score,
        earnedPoints,
        totalPoints,
        totalQuestions: questions.length,
        correctAnswers: correctCount,
      })
      .returning();

    if (answerResults.length > 0) {
      await db.insert(videoAnswersTable).values(
        answerResults.map((a) => ({
          videoSubmissionId: submission.id,
          videoQuestionId: a.questionId,
          selectedAnswer: a.selectedAnswer,
          isCorrect: a.isCorrect,
        }))
      );
    }

    res.json({
      submissionId: submission.id,
      studentName: studentNameFinal,
      studentClass: studentClassFinal,
      score: Math.round(score),
      earnedPoints,
      totalPoints,
      totalQuestions: questions.length,
      correctAnswers: correctCount,
      answers: answerResults,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: formatZodError(error), errors: error.errors });
    }
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/:id/submissions", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const id = parseInt(req.params.id);
    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });
    if (lesson.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const submissions = await db
      .select()
      .from(videoSubmissionsTable)
      .where(eq(videoSubmissionsTable.videoLessonId, id))
      .orderBy(desc(videoSubmissionsTable.submittedAt));

    res.json(submissions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/:id/submissions/:subId", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }

    const id = parseInt(req.params.id);
    const subId = parseInt(req.params.subId);

    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });
    if (lesson.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const [submission] = await db
      .select()
      .from(videoSubmissionsTable)
      .where(and(
        eq(videoSubmissionsTable.id, subId),
        eq(videoSubmissionsTable.videoLessonId, id)
      ))
      .limit(1);

    if (!submission) return res.status(404).json({ message: "تسليم غير موجود" });

    const answers = await db
      .select({
        id: videoAnswersTable.id,
        videoQuestionId: videoAnswersTable.videoQuestionId,
        selectedAnswer: videoAnswersTable.selectedAnswer,
        isCorrect: videoAnswersTable.isCorrect,
        questionText: videoQuestionsTable.text,
        questionType: videoQuestionsTable.questionType,
        correctAnswer: videoQuestionsTable.correctAnswer,
        points: videoQuestionsTable.points,
        timestampSeconds: videoQuestionsTable.timestampSeconds,
      })
      .from(videoAnswersTable)
      .innerJoin(videoQuestionsTable, eq(videoAnswersTable.videoQuestionId, videoQuestionsTable.id))
      .where(eq(videoAnswersTable.videoSubmissionId, subId))
      .orderBy(videoQuestionsTable.timestampSeconds);

    res.json({ ...submission, answers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.patch("/video-lessons/:id/share", async (req, res) => {
  try {
    if (!req.session.teacherId) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ message: "درس غير موجود" });
    if (existing.teacherId !== req.session.teacherId) {
      return res.status(403).json({ message: "غير مصرح" });
    }

    const newShared = !existing.isShared;
    await db
      .update(videoLessonsTable)
      .set({ isShared: newShared })
      .where(eq(videoLessonsTable.id, id));

    res.json({ isShared: newShared });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

router.get("/video-lessons/:id/class-students", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [lesson] = await db
      .select()
      .from(videoLessonsTable)
      .where(eq(videoLessonsTable.id, id))
      .limit(1);

    if (!lesson) return res.status(404).json({ message: "درس غير موجود" });

    const className = await resolveLessonClassName(lesson);
    if (!className) return res.json([]);

    const isTeacher = req.session.teacherId === lesson.teacherId;
    if (!isTeacher) {
      if (lesson.accessMode === "private") {
        const code = (req.query.code as string || "").trim().toUpperCase();
        const storedCode = (lesson.accessCode || "").trim().toUpperCase();
        if (!code || code !== storedCode) {
          return res.status(403).json({ message: "غير مصرح" });
        }
      }
    }

    const students = await db
      .select({ id: studentsTable.id, name: studentsTable.name })
      .from(studentsTable)
      .where(and(
        eq(studentsTable.teacherId, lesson.teacherId),
        or(eq(studentsTable.gradeLevel, className), eq(studentsTable.studentClass, className)),
      ));

    res.json(students);
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ في الخادم";
    res.status(500).json({ message });
  }
});

export default router;
