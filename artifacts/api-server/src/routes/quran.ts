import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import {
  applyCompletedWardProgress,
  shouldApplyRecitationProgress,
} from "../lib/quran-progress";
import {
  db,
  quranCirclesTable,
  quranCircleMembersTable,
  quranProfilesTable,
  quranRecitationsTable,
  quranSubmissionsTable,
  quranIndependentPositionsTable,
  quranIndependentSessionsTable,
  quranWardsTable,
  studentsTable,
  teacherClassesTable,
} from "@workspace/db";
import {
  CreateQuranCircleBody,
  CreateQuranCircleResponse,
  CreateQuranRecitationBody,
  CreateQuranRecitationResponse,
  CreateQuranWardBody,
  CreateQuranWardResponse,
  GetQuranCircleParams,
  GetQuranCircleResponse,
  GetQuranReviewQueueResponse,
  GetQuranStudentSummaryParams,
  GetQuranStudentSummaryResponse,
  GetQuranTodayDashboardResponse,
  ListQuranCirclesResponse,
  ListQuranRecitationsParams,
  ListQuranRecitationsResponse,
  ListQuranStudentWardsParams,
  ListQuranStudentWardsResponse,
  ListMyQuranWardsResponse,
  GetMyQuranWardParams,
  GetMyQuranWardResponse,
  ListQuranStudentsResponse,
  ListQuranSurahsResponse,
  UpdateQuranCircleBody,
  UpdateQuranCircleParams,
  UpdateQuranCircleResponse,
  UpdateQuranStudentProfileBody,
  UpdateQuranStudentProfileParams,
  UpdateQuranStudentProfileResponse,
  UpdateQuranWardBody,
  UpdateQuranWardParams,
  UpdateQuranWardResponse,
  AssignQuranCircleTaskBody,
  AssignQuranCircleTaskParams,
  AssignQuranCircleTaskResponse,
  AssignQuranStudentTaskBody,
  AssignQuranStudentTaskParams,
  AssignQuranStudentTaskResponse,
  PrepareQuranSubmissionUploadBody,
  PrepareQuranSubmissionUploadResponse,
  FinalizeQuranSubmissionBody,
  FinalizeQuranSubmissionResponse,
  GetMyQuranSubmissionParams,
  GetMyQuranSubmissionResponse,
  ListMyQuranSubmissionsResponse,
  ListQuranSubmissionReviewQueueResponse,
  GetQuranSubmissionAudioUrlParams,
  GetQuranSubmissionAudioUrlResponse,
  ReviewQuranSubmissionParams,
  ReviewQuranSubmissionBody,
  ReviewQuranSubmissionResponse,
  GetQuranJourneyResponse,
  UpdateMyQuranIndependentPositionBody,
  UpdateMyQuranIndependentPositionResponse,
  RecordMyQuranIndependentSessionBody,
  RecordMyQuranIndependentSessionResponse,
} from "@workspace/api-zod";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { calculateQuranJourney } from "../lib/quran-journey";

const router: IRouter = Router();
const quranSubmissionStorage = new ObjectStorageService();
const QURAN_AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg"]);
const QURAN_AUDIO_MAX_SIZE = 30 * 1024 * 1024;
type TeacherRequest = { session?: { teacherId?: number; studentAccountId?: number }; log?: { error: (error: unknown, message: string) => void } };

// Canonical metadata only. No verse text is stored or returned by this API.
const SURAH_NAMES = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال",
  "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء",
  "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء",
  "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر",
  "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان",
  "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم",
  "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف",
  "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة",
  "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات",
  "النبأ", "النازعات", "عبس", "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج",
  "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى",
  "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات", "القارعة",
  "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون",
  "النصر", "المسد", "الإخلاص", "الفلق", "الناس",
];
const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98,
  135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75,
  85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19,
  36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4,
  7, 3, 6, 3, 5, 4, 5, 6,
];
const QURAN_SURAHS = SURAH_NAMES.map((arabicName, index) => ({
  number: index + 1,
  arabicName,
  ayahCount: SURAH_AYAH_COUNTS[index],
}));

function teacherIdOf(req: TeacherRequest): number | null {
  return typeof req.session?.teacherId === "number" ? req.session.teacherId : null;
}

function studentAccountIdOf(req: TeacherRequest): number | null {
  return typeof req.session?.studentAccountId === "number" ? req.session.studentAccountId : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function wardValidation(input: { surahNumber: number; surahName: string; startAyah: number; endAyah: number }): string | null {
  const surah = QURAN_SURAHS[input.surahNumber - 1];
  if (!surah || surah.arabicName !== input.surahName) return "Surah metadata does not match the canonical catalog";
  if (input.startAyah > input.endAyah || input.endAyah > surah.ayahCount) return "Ayah range is outside the surah";
  return null;
}

async function rosterStudent(teacherId: number, studentId: number) {
  const [student] = await db.select({
    id: studentsTable.id,
    name: studentsTable.name,
    gradeLevel: studentsTable.gradeLevel,
    studentClass: studentsTable.studentClass,
  }).from(studentsTable).where(and(eq(studentsTable.id, studentId), eq(studentsTable.teacherId, teacherId)));
  return student;
}

async function circleView(teacherId: number, circleId: number) {
  const [circle] = await db.select({
    id: quranCirclesTable.id,
    name: quranCirclesTable.name,
    teacherClassId: quranCirclesTable.teacherClassId,
    notes: quranCirclesTable.notes,
  }).from(quranCirclesTable).where(and(eq(quranCirclesTable.id, circleId), eq(quranCirclesTable.teacherId, teacherId)));
  if (!circle) return undefined;
  const members = await db.select({
    id: studentsTable.id,
    name: studentsTable.name,
    gradeLevel: studentsTable.gradeLevel,
    studentClass: studentsTable.studentClass,
  }).from(quranCircleMembersTable)
    .innerJoin(studentsTable, eq(studentsTable.id, quranCircleMembersTable.studentId))
    .where(and(eq(quranCircleMembersTable.circleId, circleId), eq(studentsTable.teacherId, teacherId)))
    .orderBy(studentsTable.name);
  return { ...circle, members };
}

async function wardForTeacher(teacherId: number, wardId: number) {
  const [ward] = await db.select().from(quranWardsTable)
    .where(and(eq(quranWardsTable.id, wardId), eq(quranWardsTable.teacherId, teacherId)));
  return ward;
}

function parseError(res: { status: (code: number) => { json: (body: unknown) => void } }, message: string) {
  res.status(400).json({ error: message });
}

type QuranDbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Applies completed-recitation progress exactly once. The recitation row is
 * claimed before the profile is read/updated; the conditional update and the
 * profile write share the caller's transaction, while the advisory lock
 * serializes profile advancement across wards for the same student.
 */
async function applyCompletedRecitationProgress(
  tx: QuranDbTransaction,
  teacherId: number,
  ward: { studentId: number; surahNumber: number; endAyah: number },
  record: { id: number; status: string; progressApplied: boolean },
  recitedDate: string,
): Promise<void> {
  if (!shouldApplyRecitationProgress(record.status, record.progressApplied)) return;
  const [claimed] = await tx.update(quranRecitationsTable).set({ progressApplied: true }).where(and(
    eq(quranRecitationsTable.id, record.id),
    eq(quranRecitationsTable.teacherId, teacherId),
    eq(quranRecitationsTable.progressApplied, false),
  )).returning({ id: quranRecitationsTable.id });
  if (!claimed) return;

  await tx.execute(sql`SELECT pg_advisory_xact_lock(${teacherId}, ${ward.studentId})`);
  const [profile] = await tx.select().from(quranProfilesTable).where(and(
    eq(quranProfilesTable.teacherId, teacherId),
    eq(quranProfilesTable.studentId, ward.studentId),
  ));
  const progress = applyCompletedWardProgress(
    profile ?? {
      currentSurahNumber: null,
      currentAyah: null,
      progressPercent: 0,
      masteredAyahCount: 0,
    },
    { surahNumber: ward.surahNumber, endAyah: ward.endAyah, ayahCounts: SURAH_AYAH_COUNTS },
  );
  const lastRecitedDate = profile?.lastRecitedDate && profile.lastRecitedDate > recitedDate
    ? profile.lastRecitedDate
    : recitedDate;
  await tx.insert(quranProfilesTable).values({
    teacherId,
    studentId: ward.studentId,
    currentSurahNumber: progress.currentSurahNumber,
    currentAyah: progress.currentAyah,
    progressPercent: progress.progressPercent,
    masteredAyahCount: progress.masteredAyahCount,
    lastRecitedDate,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [quranProfilesTable.teacherId, quranProfilesTable.studentId],
    set: {
      currentSurahNumber: progress.currentSurahNumber,
      currentAyah: progress.currentAyah,
      progressPercent: progress.progressPercent,
      masteredAyahCount: progress.masteredAyahCount,
      lastRecitedDate,
      updatedAt: new Date(),
    },
  });
}

router.get("/quran/surahs", (_req, res): void => {
  res.json(ListQuranSurahsResponse.parse(QURAN_SURAHS));
});

router.get("/quran/circles", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  try {
    const circles = await db.select({ id: quranCirclesTable.id })
      .from(quranCirclesTable).where(eq(quranCirclesTable.teacherId, teacherId));
    const result = [];
    for (const circle of circles) {
      const view = await circleView(teacherId, circle.id);
      if (view) result.push(view);
    }
    res.json(ListQuranCirclesResponse.parse(result));
  } catch (error) {
    req.log?.error(error, "List Quran circles failed");
    res.status(500).json({ error: "Unable to list Quran circles" });
  }
});

router.post("/quran/circles", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = CreateQuranCircleBody.safeParse(req.body);
  if (!parsed.success) { parseError(res, parsed.error.message); return; }
  try {
    const { studentIds, teacherClassId, ...circleData } = parsed.data;
    if (teacherClassId !== undefined && teacherClassId !== null) {
      const [ownedClass] = await db.select({ id: teacherClassesTable.id }).from(teacherClassesTable)
        .where(and(eq(teacherClassesTable.id, teacherClassId), eq(teacherClassesTable.teacherId, teacherId)));
      if (!ownedClass) { res.status(404).json({ error: "Teacher class not found" }); return; }
    }
    const students = studentIds.length === 0 ? [] : await db.select({ id: studentsTable.id })
      .from(studentsTable).where(and(eq(studentsTable.teacherId, teacherId)));
    const allowed = new Set(students.map((student) => student.id));
    if (studentIds.some((id) => !allowed.has(id))) { res.status(400).json({ error: "All members must be roster students" }); return; }
    const created = await db.transaction(async (tx) => {
      const [circle] = await tx.insert(quranCirclesTable).values({
        ...circleData,
        teacherId,
        teacherClassId: teacherClassId ?? null,
      }).returning({ id: quranCirclesTable.id });
      if (studentIds.length) {
        await tx.insert(quranCircleMembersTable).values(studentIds.map((studentId) => ({ circleId: circle.id, studentId })));
      }
      return circle;
    });
    const view = await circleView(teacherId, created.id);
    res.status(201).json(CreateQuranCircleResponse.parse(view));
  } catch (error) {
    req.log?.error(error, "Create Quran circle failed");
    res.status(500).json({ error: "Unable to create Quran circle" });
  }
});

router.get("/quran/circles/:id", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = GetQuranCircleParams.safeParse(req.params);
  if (!params.success) { parseError(res, params.error.message); return; }
  const view = await circleView(teacherId, params.data.id);
  if (!view) { res.status(404).json({ error: "Circle not found" }); return; }
  res.json(GetQuranCircleResponse.parse(view));
});

router.patch("/quran/circles/:id", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = UpdateQuranCircleParams.safeParse(req.params);
  const parsed = UpdateQuranCircleBody.safeParse(req.body);
  if (!params.success || !parsed.success) { parseError(res, "Invalid circle"); return; }
  const existing = await circleView(teacherId, params.data.id);
  if (!existing) { res.status(404).json({ error: "Circle not found" }); return; }
  try {
    const { studentIds, ...updates } = parsed.data;
    if (updates.teacherClassId !== undefined && updates.teacherClassId !== null) {
      const [ownedClass] = await db.select({ id: teacherClassesTable.id }).from(teacherClassesTable)
        .where(and(eq(teacherClassesTable.id, updates.teacherClassId), eq(teacherClassesTable.teacherId, teacherId)));
      if (!ownedClass) { res.status(404).json({ error: "Teacher class not found" }); return; }
    }
    if (studentIds) {
      const students = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.teacherId, teacherId));
      const allowed = new Set(students.map((student) => student.id));
      if (studentIds.some((id) => !allowed.has(id))) { res.status(400).json({ error: "All members must be roster students" }); return; }
    }
    await db.transaction(async (tx) => {
      if (Object.keys(updates).length) {
        await tx.update(quranCirclesTable).set(updates).where(and(eq(quranCirclesTable.id, params.data.id), eq(quranCirclesTable.teacherId, teacherId)));
      }
      if (studentIds) {
        await tx.delete(quranCircleMembersTable).where(eq(quranCircleMembersTable.circleId, params.data.id));
        if (studentIds.length) await tx.insert(quranCircleMembersTable).values(studentIds.map((studentId) => ({ circleId: params.data.id, studentId })));
      }
    });
    const view = await circleView(teacherId, params.data.id);
    res.json(UpdateQuranCircleResponse.parse(view));
  } catch (error) {
    req.log?.error(error, "Update Quran circle failed");
    res.status(500).json({ error: "Unable to update Quran circle" });
  }
});

router.get("/quran/students", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const students = await db.select({ id: studentsTable.id, name: studentsTable.name, gradeLevel: studentsTable.gradeLevel, studentClass: studentsTable.studentClass })
    .from(studentsTable).where(eq(studentsTable.teacherId, teacherId)).orderBy(studentsTable.name);
  res.json(ListQuranStudentsResponse.parse(students));
});

router.get("/quran/students/:studentId", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = GetQuranStudentSummaryParams.safeParse(req.params);
  if (!params.success) { parseError(res, params.error.message); return; }
  const student = await rosterStudent(teacherId, params.data.studentId);
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  const [profile] = await db.select().from(quranProfilesTable)
    .where(and(eq(quranProfilesTable.teacherId, teacherId), eq(quranProfilesTable.studentId, student.id)));
  const wards = await db.select().from(quranWardsTable)
    .where(and(eq(quranWardsTable.teacherId, teacherId), eq(quranWardsTable.studentId, student.id))).orderBy(desc(quranWardsTable.createdAt));
  const recentRecitations = await db.select().from(quranRecitationsTable)
    .where(and(eq(quranRecitationsTable.teacherId, teacherId), eq(quranRecitationsTable.studentId, student.id)))
    .orderBy(desc(quranRecitationsTable.recitedDate), desc(quranRecitationsTable.createdAt)).limit(20);
  const safeProfile = profile ?? {
    currentSurahNumber: null,
    currentAyah: null,
    progressPercent: 0,
    masteredAyahCount: 0,
    lastRecitedDate: null,
  };
  res.json(GetQuranStudentSummaryResponse.parse({ student, profile: safeProfile, wards, recentRecitations }));
});

router.get("/quran/students/:studentId/wards", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = ListQuranStudentWardsParams.safeParse(req.params);
  if (!params.success) { parseError(res, params.error.message); return; }
  if (!await rosterStudent(teacherId, params.data.studentId)) { res.status(404).json({ error: "Student not found" }); return; }
  const wards = await db.select().from(quranWardsTable)
    .where(and(eq(quranWardsTable.teacherId, teacherId), eq(quranWardsTable.studentId, params.data.studentId)))
    .orderBy(desc(quranWardsTable.createdAt));
  res.json(ListQuranStudentWardsResponse.parse(wards));
});

router.get("/quran/me/wards", async (req, res): Promise<void> => {
  res.set("Cache-Control", "private, no-store");
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const [student] = await db.select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.studentAccountId, studentAccountId))
    .limit(1);
  if (!student) { res.status(404).json({ error: "Student profile not found" }); return; }
  const wards = await db.select({
    id: quranWardsTable.id,
    studentId: quranWardsTable.studentId,
    mode: quranWardsTable.mode,
    surahNumber: quranWardsTable.surahNumber,
    surahName: quranWardsTable.surahName,
    startAyah: quranWardsTable.startAyah,
    endAyah: quranWardsTable.endAyah,
    assignedDate: quranWardsTable.assignedDate,
    dueDate: quranWardsTable.dueDate,
    notes: quranWardsTable.notes,
    status: quranWardsTable.status,
    assignmentRequestId: quranWardsTable.assignmentRequestId,
  }).from(quranWardsTable)
    .innerJoin(studentsTable, eq(studentsTable.id, quranWardsTable.studentId))
    .where(and(
      eq(studentsTable.studentAccountId, studentAccountId),
      eq(quranWardsTable.studentId, student.id),
    ))
    .orderBy(desc(quranWardsTable.assignedDate), desc(quranWardsTable.createdAt));
  res.json(ListMyQuranWardsResponse.parse(wards));
});

router.patch("/quran/me/independent-position", async (req, res): Promise<void> => {
  res.set("Cache-Control", "private, no-store");
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = UpdateMyQuranIndependentPositionBody.safeParse(req.body);
  if (!parsed.success) { parseError(res, parsed.error.message); return; }
  if (Object.keys(parsed.data).length === 0) { parseError(res, "At least one position is required"); return; }
  try {
    const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(parsed.data, key);
    const update = {
      ...(has("textSurahNumber") ? { textSurahNumber: parsed.data.textSurahNumber ?? null } : {}),
      ...(has("textAyah") ? { textAyah: parsed.data.textAyah ?? null } : {}),
      ...(has("pageNumber") ? { pageNumber: parsed.data.pageNumber ?? null } : {}),
      updatedAt: new Date(),
    };
    const [position] = await db.insert(quranIndependentPositionsTable).values({
      studentAccountId,
      textSurahNumber: parsed.data.textSurahNumber ?? null,
      textAyah: parsed.data.textAyah ?? null,
      pageNumber: parsed.data.pageNumber ?? null,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: quranIndependentPositionsTable.studentAccountId,
      set: update,
    }).returning({
      textSurahNumber: quranIndependentPositionsTable.textSurahNumber,
      textAyah: quranIndependentPositionsTable.textAyah,
      pageNumber: quranIndependentPositionsTable.pageNumber,
      updatedAt: quranIndependentPositionsTable.updatedAt,
    });
    res.json(UpdateMyQuranIndependentPositionResponse.parse(position));
  } catch (error) {
    req.log?.error(error, "Save independent Quran position failed");
    res.status(500).json({ error: "Unable to save independent Quran position" });
  }
});

router.post("/quran/me/independent-sessions", async (req, res): Promise<void> => {
  res.set("Cache-Control", "private, no-store");
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = RecordMyQuranIndependentSessionBody.safeParse(req.body);
  if (!parsed.success) { parseError(res, parsed.error.message); return; }
  try {
    const practicedDate = parsed.data.practicedDate ?? today();
    const [session] = await db.insert(quranIndependentSessionsTable).values({
      studentAccountId,
      practicedDate,
    }).onConflictDoNothing({
      target: [quranIndependentSessionsTable.studentAccountId, quranIndependentSessionsTable.practicedDate],
    }).returning({
      id: quranIndependentSessionsTable.id,
      practicedDate: quranIndependentSessionsTable.practicedDate,
      createdAt: quranIndependentSessionsTable.createdAt,
    });
    if (session) {
      res.status(201).json(RecordMyQuranIndependentSessionResponse.parse(session));
      return;
    }
    const [existing] = await db.select({
      id: quranIndependentSessionsTable.id,
      practicedDate: quranIndependentSessionsTable.practicedDate,
      createdAt: quranIndependentSessionsTable.createdAt,
    }).from(quranIndependentSessionsTable).where(and(
      eq(quranIndependentSessionsTable.studentAccountId, studentAccountId),
      eq(quranIndependentSessionsTable.practicedDate, practicedDate),
    )).limit(1);
    res.status(201).json(RecordMyQuranIndependentSessionResponse.parse(existing));
  } catch (error) {
    req.log?.error(error, "Record independent Quran session failed");
    res.status(500).json({ error: "Unable to record independent Quran session" });
  }
});

router.get("/quran/me/journey", async (req, res): Promise<void> => {
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }

  try {
    // Independent practice belongs to the login account, not to a roster row.
    // Load it before looking up the optional teacher-linked student so
    // unlinked accounts retain their self-study history.
    const [independentPositions, independentSessions] = await Promise.all([
      db.select({
        textSurahNumber: quranIndependentPositionsTable.textSurahNumber,
        textAyah: quranIndependentPositionsTable.textAyah,
        pageNumber: quranIndependentPositionsTable.pageNumber,
        updatedAt: quranIndependentPositionsTable.updatedAt,
      }).from(quranIndependentPositionsTable).where(eq(
        quranIndependentPositionsTable.studentAccountId, studentAccountId,
      )).orderBy(desc(quranIndependentPositionsTable.updatedAt)).limit(1),
      db.select({
        practicedDate: quranIndependentSessionsTable.practicedDate,
      }).from(quranIndependentSessionsTable).where(eq(
        quranIndependentSessionsTable.studentAccountId, studentAccountId,
      )),
    ]);
    const [student] = await db.select({
      id: studentsTable.id,
      teacherId: studentsTable.teacherId,
    }).from(studentsTable).where(eq(studentsTable.studentAccountId, studentAccountId));
    if (!student) {
      const emptyJourney = calculateQuranJourney({
        profile: {
          currentSurahNumber: null,
          currentAyah: null,
          progressPercent: 0,
          masteredAyahCount: 0,
          lastRecitedDate: null,
        },
        wards: [],
        recitations: [],
        submissions: [],
        independentPractice: {
          dates: independentSessions.map((session) => session.practicedDate),
          latestPosition: independentPositions[0] ?? null,
        },
      });
      res.json(GetQuranJourneyResponse.parse(emptyJourney));
      return;
    }

    const [profile, wards, recitations, submissions] = await Promise.all([
      db.select({
        currentSurahNumber: quranProfilesTable.currentSurahNumber,
        currentAyah: quranProfilesTable.currentAyah,
        progressPercent: quranProfilesTable.progressPercent,
        masteredAyahCount: quranProfilesTable.masteredAyahCount,
        lastRecitedDate: quranProfilesTable.lastRecitedDate,
      }).from(quranProfilesTable).where(and(
        eq(quranProfilesTable.teacherId, student.teacherId),
        eq(quranProfilesTable.studentId, student.id),
      )),
      db.select({
        id: quranWardsTable.id,
        mode: quranWardsTable.mode,
        surahNumber: quranWardsTable.surahNumber,
        surahName: quranWardsTable.surahName,
        startAyah: quranWardsTable.startAyah,
        endAyah: quranWardsTable.endAyah,
        assignedDate: quranWardsTable.assignedDate,
        dueDate: quranWardsTable.dueDate,
        status: quranWardsTable.status,
      }).from(quranWardsTable)
        .innerJoin(studentsTable, eq(studentsTable.id, quranWardsTable.studentId))
        .where(and(
          eq(studentsTable.studentAccountId, studentAccountId),
          eq(quranWardsTable.studentId, student.id),
          eq(quranWardsTable.teacherId, student.teacherId),
        )),
      db.select({
        id: quranRecitationsTable.id,
        wardId: quranRecitationsTable.wardId,
        status: quranRecitationsTable.status,
        memorizationScore: quranRecitationsTable.memorizationScore,
        recitationScore: quranRecitationsTable.recitationScore,
        recitedDate: quranRecitationsTable.recitedDate,
        createdAt: quranRecitationsTable.createdAt,
      }).from(quranRecitationsTable)
        .innerJoin(studentsTable, eq(studentsTable.id, quranRecitationsTable.studentId))
        .where(and(
          eq(studentsTable.studentAccountId, studentAccountId),
          eq(quranRecitationsTable.studentId, student.id),
          eq(quranRecitationsTable.teacherId, student.teacherId),
        )),
      db.select({
        id: quranSubmissionsTable.id,
        wardId: quranSubmissionsTable.wardId,
        status: quranSubmissionsTable.status,
        memorizationScore: quranSubmissionsTable.memorizationScore,
        recitationScore: quranSubmissionsTable.recitationScore,
        createdAt: quranSubmissionsTable.createdAt,
      }).from(quranSubmissionsTable)
        .innerJoin(studentsTable, eq(studentsTable.id, quranSubmissionsTable.studentId))
        .where(and(
          eq(quranSubmissionsTable.studentAccountId, studentAccountId),
          eq(studentsTable.studentAccountId, studentAccountId),
          eq(quranSubmissionsTable.studentId, student.id),
          eq(quranSubmissionsTable.teacherId, student.teacherId),
        )),
    ]);

    const journey = calculateQuranJourney({
      profile: profile[0] ?? {
        currentSurahNumber: null,
        currentAyah: null,
        progressPercent: 0,
        masteredAyahCount: 0,
        lastRecitedDate: null,
      },
      wards,
      recitations,
      submissions,
      independentPractice: {
        dates: independentSessions.map((session) => session.practicedDate),
        latestPosition: independentPositions[0] ?? null,
      },
    });
    res.json(GetQuranJourneyResponse.parse(journey));
  } catch (error) {
    req.log?.error(error, "Get Quran journey failed");
    res.status(500).json({ error: "Unable to load Quran journey" });
  }
});

router.get("/quran/me/wards/:id", async (req, res): Promise<void> => {
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = GetMyQuranWardParams.safeParse(req.params);
  if (!params.success) { parseError(res, params.error.message); return; }
  const [ward] = await db.select({
    id: quranWardsTable.id,
    studentId: quranWardsTable.studentId,
    mode: quranWardsTable.mode,
    surahNumber: quranWardsTable.surahNumber,
    surahName: quranWardsTable.surahName,
    startAyah: quranWardsTable.startAyah,
    endAyah: quranWardsTable.endAyah,
    assignedDate: quranWardsTable.assignedDate,
    dueDate: quranWardsTable.dueDate,
    notes: quranWardsTable.notes,
    status: quranWardsTable.status,
    assignmentRequestId: quranWardsTable.assignmentRequestId,
  }).from(quranWardsTable)
    .innerJoin(studentsTable, eq(studentsTable.id, quranWardsTable.studentId))
    .where(and(
      eq(quranWardsTable.id, params.data.id),
      eq(studentsTable.studentAccountId, studentAccountId),
    ));
  if (!ward) { res.status(404).json({ error: "Ward not found" }); return; }
  res.json(GetMyQuranWardResponse.parse(ward));
});

router.post("/quran/students/:studentId/assign", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = AssignQuranStudentTaskParams.safeParse(req.params);
  const parsed = AssignQuranStudentTaskBody.safeParse(req.body);
  if (!params.success || !parsed.success) { parseError(res, "Invalid student task"); return; }
  if (!await rosterStudent(teacherId, params.data.studentId)) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  const memorization = parsed.data.memorization ?? [];
  const review = parsed.data.review ?? [];
  if (memorization.length === 0 && review.length === 0) {
    parseError(res, "Select memorization or review");
    return;
  }
  const memorizationError = memorization.map(wardValidation).find(Boolean);
  const reviewError = review.map(wardValidation).find(Boolean);
  if (memorizationError || reviewError) {
    parseError(res, memorizationError ?? reviewError ?? "Invalid range");
    return;
  }
  const segmentRequestIds = [
    ...memorization.map((_, index) => `${parsed.data.requestId}:ح:${index}`),
    ...review.map((_, index) => `${parsed.data.requestId}:م:${index}`),
  ];
  try {
    const rows = await db.transaction(async (tx) => {
      await tx.insert(quranWardsTable).values([
        ...memorization.map((range, index) => ({
          teacherId,
          studentId: params.data.studentId,
          mode: "memorization",
          ...range,
          assignedDate: parsed.data.assignedDate,
          dueDate: parsed.data.dueDate,
          notes: parsed.data.notes ?? null,
          status: "assigned",
          assignmentRequestId: segmentRequestIds[index],
        })),
        ...review.map((range, index) => ({
          teacherId,
          studentId: params.data.studentId,
          mode: "review",
          ...range,
          assignedDate: parsed.data.assignedDate,
          dueDate: parsed.data.dueDate,
          notes: parsed.data.notes ?? null,
          status: "assigned",
          assignmentRequestId: segmentRequestIds[memorization.length + index],
        })),
      ]).onConflictDoNothing();
      return tx.select().from(quranWardsTable).where(and(
        eq(quranWardsTable.teacherId, teacherId),
        eq(quranWardsTable.studentId, params.data.studentId),
        inArray(quranWardsTable.assignmentRequestId, segmentRequestIds),
      )).orderBy(quranWardsTable.mode, quranWardsTable.surahNumber, quranWardsTable.startAyah);
    });
    res.status(201).json(AssignQuranStudentTaskResponse.parse(rows));
  } catch (error) {
    req.log?.error(error, "Assign Quran student task failed");
    res.status(500).json({ error: "Unable to assign student task" });
  }
});

router.patch("/quran/students/:studentId/profile", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = UpdateQuranStudentProfileParams.safeParse(req.params);
  const parsed = UpdateQuranStudentProfileBody.safeParse(req.body);
  if (!params.success || !parsed.success) { parseError(res, "Invalid Quran profile"); return; }
  if (!await rosterStudent(teacherId, params.data.studentId)) { res.status(404).json({ error: "Student not found" }); return; }
  try {
    const [profile] = await db.insert(quranProfilesTable).values({
      teacherId,
      studentId: params.data.studentId,
      currentSurahNumber: parsed.data.currentSurahNumber ?? null,
      currentAyah: parsed.data.currentAyah ?? null,
      progressPercent: parsed.data.progressPercent ?? 0,
      lastRecitedDate: parsed.data.lastRecitedDate ?? null,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [quranProfilesTable.teacherId, quranProfilesTable.studentId],
      set: { ...parsed.data, updatedAt: new Date() },
    }).returning();
    res.json(UpdateQuranStudentProfileResponse.parse(profile));
  } catch (error) {
    req.log?.error(error, "Update Quran profile failed");
    res.status(500).json({ error: "Unable to update Quran profile" });
  }
});

router.post("/quran/wards", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = CreateQuranWardBody.safeParse(req.body);
  if (!parsed.success) { parseError(res, parsed.error.message); return; }
  const wardError = wardValidation(parsed.data);
  if (wardError) { parseError(res, wardError); return; }
  if (!await rosterStudent(teacherId, parsed.data.studentId)) { res.status(404).json({ error: "Student not found" }); return; }
  try {
    const [ward] = await db.insert(quranWardsTable).values({ ...parsed.data, teacherId, status: parsed.data.status ?? "assigned" }).returning();
    res.status(201).json(CreateQuranWardResponse.parse(ward));
  } catch (error) {
    req.log?.error(error, "Create Quran ward failed");
    res.status(500).json({ error: "Unable to create Quran ward" });
  }
});

router.post("/quran/circles/:id/assign", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = AssignQuranCircleTaskParams.safeParse(req.params);
  const parsed = AssignQuranCircleTaskBody.safeParse(req.body);
  if (!params.success || !parsed.success) { parseError(res, "Invalid circle task"); return; }
  const memorization = parsed.data.memorization ?? [];
  const review = parsed.data.review ?? [];
  if (memorization.length === 0 && review.length === 0) {
    parseError(res, "Select memorization or review");
    return;
  }
  const memorizationError = memorization.map(wardValidation).find(Boolean);
  const reviewError = review.map(wardValidation).find(Boolean);
  if (memorizationError || reviewError) { parseError(res, memorizationError ?? reviewError ?? "Invalid range"); return; }
  try {
    const existingCircle = await circleView(teacherId, params.data.id);
    if (!existingCircle) { res.status(404).json({ error: "Circle not found" }); return; }
    if (existingCircle.members.length === 0) { parseError(res, "Circle has no students"); return; }
    const segmentRequestIds = [
      ...memorization.map((_, index) => `${parsed.data.requestId}:ح:${index}`),
      ...review.map((_, index) => `${parsed.data.requestId}:م:${index}`),
    ];
    const rows = await db.transaction(async (tx) => {
      await tx.insert(quranWardsTable).values(existingCircle.members.flatMap((student) => [
        ...memorization.map((range, index) => ({
          teacherId,
          studentId: student.id,
          mode: "memorization",
          ...range,
          assignedDate: parsed.data.assignedDate,
          dueDate: parsed.data.dueDate,
          notes: parsed.data.notes ?? null,
          status: "assigned",
          assignmentRequestId: segmentRequestIds[index],
        })),
        ...review.map((range, index) => ({
          teacherId,
          studentId: student.id,
          mode: "review",
          ...range,
          assignedDate: parsed.data.assignedDate,
          dueDate: parsed.data.dueDate,
          notes: parsed.data.notes ?? null,
          status: "assigned",
          assignmentRequestId: segmentRequestIds[memorization.length + index],
        })),
      ])).onConflictDoNothing();
      return tx.select().from(quranWardsTable).where(and(
        eq(quranWardsTable.teacherId, teacherId),
        inArray(quranWardsTable.assignmentRequestId, segmentRequestIds),
      )).orderBy(quranWardsTable.studentId, quranWardsTable.mode);
    });
    res.status(201).json(AssignQuranCircleTaskResponse.parse(rows));
  } catch (error) {
    req.log?.error(error, "Assign Quran circle task failed");
    res.status(500).json({ error: "Unable to assign circle task" });
  }
});

router.patch("/quran/wards/:id", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = UpdateQuranWardParams.safeParse(req.params);
  const parsed = UpdateQuranWardBody.safeParse(req.body);
  if (!params.success || !parsed.success) { parseError(res, "Invalid ward"); return; }
  const existingWard = await wardForTeacher(teacherId, params.data.id);
  if (!existingWard) { res.status(404).json({ error: "Ward not found" }); return; }
  const wardError = wardValidation({
    surahNumber: parsed.data.surahNumber ?? existingWard.surahNumber,
    surahName: parsed.data.surahName ?? existingWard.surahName,
    startAyah: parsed.data.startAyah ?? existingWard.startAyah,
    endAyah: parsed.data.endAyah ?? existingWard.endAyah,
  });
  if (wardError) { parseError(res, wardError); return; }
  try {
    const [ward] = await db.update(quranWardsTable).set(parsed.data)
      .where(and(eq(quranWardsTable.id, params.data.id), eq(quranWardsTable.teacherId, teacherId))).returning();
    res.json(UpdateQuranWardResponse.parse(ward));
  } catch (error) {
    req.log?.error(error, "Update Quran ward failed");
    res.status(500).json({ error: "Unable to update Quran ward" });
  }
});

router.get("/quran/wards/:id/recitations", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = ListQuranRecitationsParams.safeParse(req.params);
  if (!params.success) { parseError(res, params.error.message); return; }
  if (!await wardForTeacher(teacherId, params.data.id)) { res.status(404).json({ error: "Ward not found" }); return; }
  const records = await db.select().from(quranRecitationsTable)
    .where(and(eq(quranRecitationsTable.teacherId, teacherId), eq(quranRecitationsTable.wardId, params.data.id)))
    .orderBy(desc(quranRecitationsTable.recitedDate), desc(quranRecitationsTable.createdAt));
  res.json(ListQuranRecitationsResponse.parse(records));
});

router.post("/quran/wards/:id/recitations", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = ListQuranRecitationsParams.safeParse(req.params);
  const parsed = CreateQuranRecitationBody.safeParse(req.body);
  if (!params.success || !parsed.success) { parseError(res, "Invalid recitation"); return; }
  try {
    const result = await db.transaction(async (tx) => {
      const [ward] = await tx.select().from(quranWardsTable)
        .where(and(eq(quranWardsTable.id, params.data.id), eq(quranWardsTable.teacherId, teacherId)));
      if (!ward) return null;
      const recitable = parsed.data.status !== "absent" && parsed.data.status !== "not_recited";
      const [record] = await tx.insert(quranRecitationsTable).values({
        teacherId,
        wardId: ward.id,
        studentId: ward.studentId,
        status: parsed.data.status,
        memorizationScore: recitable ? (parsed.data.memorizationScore ?? null) : null,
        recitationScore: recitable ? (parsed.data.recitationScore ?? null) : null,
        mistakeCounts: parsed.data.mistakeCounts ?? null,
        teacherNote: parsed.data.teacherNote ?? null,
        recitedDate: parsed.data.recitedDate,
        progressApplied: false,
      }).onConflictDoUpdate({
        target: [quranRecitationsTable.teacherId, quranRecitationsTable.wardId, quranRecitationsTable.recitedDate],
        set: {
          status: parsed.data.status,
          memorizationScore: recitable ? (parsed.data.memorizationScore ?? null) : null,
          recitationScore: recitable ? (parsed.data.recitationScore ?? null) : null,
          mistakeCounts: parsed.data.mistakeCounts ?? null,
          teacherNote: parsed.data.teacherNote ?? null,
        },
      }).returning();
      if (parsed.data.status === "completed" || parsed.data.status === "needs_review") {
        await tx.update(quranWardsTable).set({
          status: parsed.data.status === "completed" ? "completed" : "needs_review",
          updatedAt: new Date(),
        }).where(and(eq(quranWardsTable.id, ward.id), eq(quranWardsTable.teacherId, teacherId)));
      }
      await applyCompletedRecitationProgress(tx, teacherId, ward, record, parsed.data.recitedDate);
      return record;
    });
    if (!result) { res.status(404).json({ error: "Ward not found" }); return; }
    res.status(201).json(CreateQuranRecitationResponse.parse(result));
  } catch (error) {
    req.log?.error(error, "Create Quran recitation failed");
    res.status(500).json({ error: "Unable to save Quran recitation" });
  }
});

const submissionPublicColumns = {
  id: quranSubmissionsTable.id,
  wardId: quranSubmissionsTable.wardId,
  studentId: quranSubmissionsTable.studentId,
  status: quranSubmissionsTable.status,
  memorizationScore: quranSubmissionsTable.memorizationScore,
  recitationScore: quranSubmissionsTable.recitationScore,
  mistakeCounts: quranSubmissionsTable.mistakeCounts,
  feedback: quranSubmissionsTable.feedback,
  contentType: quranSubmissionsTable.contentType,
  fileSize: quranSubmissionsTable.fileSize,
  createdAt: quranSubmissionsTable.createdAt,
  updatedAt: quranSubmissionsTable.updatedAt,
};

const submissionReviewColumns = {
  ...submissionPublicColumns,
  teacherId: quranSubmissionsTable.teacherId,
  reviewedByTeacherId: quranSubmissionsTable.reviewedByTeacherId,
};

type ReviewPayload = {
  status: "reviewed" | "needs_resubmission";
  memorizationScore?: number | null;
  recitationScore?: number | null;
  mistakeCounts?: Record<string, number> | null;
  feedback?: string | null;
};

function normalizedReviewPayload(payload: ReviewPayload) {
  return {
    status: payload.status,
    memorizationScore: payload.memorizationScore ?? null,
    recitationScore: payload.recitationScore ?? null,
    mistakeCounts: payload.mistakeCounts
      ? Object.fromEntries(Object.entries(payload.mistakeCounts).sort(([left], [right]) => left.localeCompare(right)))
      : null,
    feedback: payload.feedback ?? null,
  };
}

function matchesCompletedReview(
  existing: {
    status: string;
    memorizationScore: number | null;
    recitationScore: number | null;
    mistakeCounts: Record<string, number> | null;
    feedback: string | null;
    reviewedByTeacherId: number | null;
  },
  payload: ReviewPayload,
  teacherId: number,
): boolean {
  const expected = normalizedReviewPayload(payload);
  const actual = normalizedReviewPayload(existing as ReviewPayload);
  return existing.reviewedByTeacherId === teacherId
    && JSON.stringify(actual) === JSON.stringify(expected);
}

async function studentWardForAccount(studentAccountId: number, wardId: number) {
  const [ward] = await db.select({
    id: quranWardsTable.id,
    studentId: quranWardsTable.studentId,
    teacherId: quranWardsTable.teacherId,
  }).from(quranWardsTable)
    .innerJoin(studentsTable, eq(studentsTable.id, quranWardsTable.studentId))
    .where(and(
      eq(quranWardsTable.id, wardId),
      eq(studentsTable.studentAccountId, studentAccountId),
    ));
  return ward;
}

router.post("/quran/me/submissions/upload-url", async (req, res): Promise<void> => {
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = PrepareQuranSubmissionUploadBody.safeParse(req.body);
  if (!parsed.success) { parseError(res, parsed.error.message); return; }
  if (!QURAN_AUDIO_TYPES.has(parsed.data.contentType) || parsed.data.fileSize > QURAN_AUDIO_MAX_SIZE) {
    res.status(400).json({ error: "Unsupported audio type or file size" });
    return;
  }
  if (!await studentWardForAccount(studentAccountId, parsed.data.wardId)) {
    res.status(404).json({ error: "Ward not found" });
    return;
  }
  try {
    const uploadURL = await quranSubmissionStorage.getObjectEntityUploadURL(
      `quran-submissions/${studentAccountId}`,
    );
    const objectPath = quranSubmissionStorage.normalizeObjectEntityPath(uploadURL);
    res.json(PrepareQuranSubmissionUploadResponse.parse({
      uploadURL,
      objectPath,
      expiresIn: 900,
    }));
  } catch (error) {
    req.log?.error(error, "Prepare Quran submission upload failed");
    res.status(500).json({ error: "Unable to prepare audio upload" });
  }
});

router.post("/quran/me/submissions", async (req, res): Promise<void> => {
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const parsed = FinalizeQuranSubmissionBody.safeParse(req.body);
  if (!parsed.success) { parseError(res, parsed.error.message); return; }
  const ward = await studentWardForAccount(studentAccountId, parsed.data.wardId);
  if (!ward) { res.status(404).json({ error: "Ward not found" }); return; }
  const expectedPrefix = `/objects/uploads/quran-submissions/${studentAccountId}/`;
  if (!parsed.data.objectPath.startsWith(expectedPrefix) || parsed.data.objectPath.includes("..")) {
    res.status(400).json({ error: "Invalid audio object" });
    return;
  }

  try {
    const objectFile = await quranSubmissionStorage.getObjectEntityFile(parsed.data.objectPath);
    const [metadata] = await objectFile.getMetadata();
    const contentType = String(metadata.contentType || "");
    const fileSize = Number(metadata.size || 0);
    if (!QURAN_AUDIO_TYPES.has(contentType) || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > QURAN_AUDIO_MAX_SIZE) {
      res.status(400).json({ error: "Uploaded audio metadata is invalid" });
      return;
    }

    const existing = await db.select({
      ...submissionPublicColumns,
      objectPath: quranSubmissionsTable.objectPath,
    })
      .from(quranSubmissionsTable)
      .where(and(
        eq(quranSubmissionsTable.studentAccountId, studentAccountId),
        eq(quranSubmissionsTable.clientRequestId, parsed.data.clientRequestId),
      ));
    if (existing[0]) {
      if (existing[0].wardId !== parsed.data.wardId || existing[0].objectPath !== parsed.data.objectPath) {
        res.status(409).json({ error: "Client request id belongs to a different submission" });
        return;
      }
      res.status(200).json(FinalizeQuranSubmissionResponse.parse(existing[0]));
      return;
    }

    const [created] = await db.insert(quranSubmissionsTable).values({
      wardId: ward.id,
      teacherId: ward.teacherId,
      studentId: ward.studentId,
      studentAccountId,
      clientRequestId: parsed.data.clientRequestId,
      objectPath: parsed.data.objectPath,
      contentType,
      fileSize,
      status: "submitted",
    }).onConflictDoNothing({
      target: [quranSubmissionsTable.studentAccountId, quranSubmissionsTable.clientRequestId],
    }).returning(submissionPublicColumns);
    if (created) {
      res.status(201).json(FinalizeQuranSubmissionResponse.parse(created));
      return;
    }
    const [replayed] = await db.select({
      ...submissionPublicColumns,
      objectPath: quranSubmissionsTable.objectPath,
    })
      .from(quranSubmissionsTable)
      .where(and(
        eq(quranSubmissionsTable.studentAccountId, studentAccountId),
        eq(quranSubmissionsTable.clientRequestId, parsed.data.clientRequestId),
      ));
    if (!replayed || replayed.wardId !== parsed.data.wardId || replayed.objectPath !== parsed.data.objectPath) {
      res.status(409).json({ error: "Client request id belongs to a different submission" });
      return;
    }
    res.status(200).json(FinalizeQuranSubmissionResponse.parse(replayed));
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Uploaded audio was not found" });
      return;
    }
    req.log?.error(error, "Finalize Quran submission failed");
    res.status(500).json({ error: "Unable to finalize Quran submission" });
  }
});

router.get("/quran/me/submissions", async (req, res): Promise<void> => {
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const submissions = await db.select(submissionPublicColumns)
    .from(quranSubmissionsTable)
    .where(eq(quranSubmissionsTable.studentAccountId, studentAccountId))
    .orderBy(desc(quranSubmissionsTable.createdAt));
  res.json(ListMyQuranSubmissionsResponse.parse(submissions));
});

router.get("/quran/me/submissions/:id", async (req, res): Promise<void> => {
  const studentAccountId = studentAccountIdOf(req);
  if (studentAccountId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = GetMyQuranSubmissionParams.safeParse(req.params);
  if (!params.success) { parseError(res, params.error.message); return; }
  const [submission] = await db.select(submissionPublicColumns)
    .from(quranSubmissionsTable)
    .where(and(
      eq(quranSubmissionsTable.id, params.data.id),
      eq(quranSubmissionsTable.studentAccountId, studentAccountId),
    ));
  if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }
  res.json(GetMyQuranSubmissionResponse.parse(submission));
});

router.get("/quran/submissions/review-queue", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const submissions = await db.select({
    ...submissionPublicColumns,
    studentName: studentsTable.name,
    surahName: quranWardsTable.surahName,
    startAyah: quranWardsTable.startAyah,
    endAyah: quranWardsTable.endAyah,
    mode: quranWardsTable.mode,
  }).from(quranSubmissionsTable)
    .innerJoin(studentsTable, eq(studentsTable.id, quranSubmissionsTable.studentId))
    .innerJoin(quranWardsTable, eq(quranWardsTable.id, quranSubmissionsTable.wardId))
    .where(and(
      eq(quranSubmissionsTable.teacherId, teacherId),
      eq(quranSubmissionsTable.status, "submitted"),
    ))
    .orderBy(quranSubmissionsTable.createdAt);
  res.json(ListQuranSubmissionReviewQueueResponse.parse(submissions));
});

router.get("/quran/submissions/:id/audio-url", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = GetQuranSubmissionAudioUrlParams.safeParse(req.params);
  if (!params.success) { parseError(res, params.error.message); return; }
  const [submission] = await db.select({
    id: quranSubmissionsTable.id,
    teacherId: quranSubmissionsTable.teacherId,
    objectPath: quranSubmissionsTable.objectPath,
  }).from(quranSubmissionsTable)
    .where(and(eq(quranSubmissionsTable.id, params.data.id), eq(quranSubmissionsTable.teacherId, teacherId)));
  if (!submission) { res.status(404).json({ error: "Submission not found" }); return; }
  try {
    const objectFile = await quranSubmissionStorage.getObjectEntityFile(submission.objectPath);
    const url = await quranSubmissionStorage.signFileDownloadUrl(objectFile, 300);
    res.json(GetQuranSubmissionAudioUrlResponse.parse({ url, expiresIn: 300 }));
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Audio not found" });
      return;
    }
    req.log?.error(error, "Get Quran submission audio URL failed");
    res.status(500).json({ error: "Unable to access audio" });
  }
});

router.patch("/quran/submissions/:id/review", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const params = ReviewQuranSubmissionParams.safeParse(req.params);
  const parsed = ReviewQuranSubmissionBody.safeParse(req.body);
  if (!params.success || !parsed.success) { parseError(res, "Invalid Quran submission review"); return; }
  try {
    const updated = await db.transaction(async (tx) => {
      // Claim the submitted row first. The conditional update serializes
      // competing teachers and makes the rest of this transaction all-or-none.
      const [claimed] = await tx.update(quranSubmissionsTable).set({
        status: parsed.data.status,
        memorizationScore: parsed.data.memorizationScore ?? null,
        recitationScore: parsed.data.recitationScore ?? null,
        mistakeCounts: parsed.data.mistakeCounts ?? null,
        feedback: parsed.data.feedback ?? null,
        reviewedByTeacherId: teacherId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        eq(quranSubmissionsTable.id, params.data.id),
        eq(quranSubmissionsTable.teacherId, teacherId),
        eq(quranSubmissionsTable.status, "submitted"),
      )).returning(submissionPublicColumns);
      if (!claimed) return null;

      const [ward] = await tx.select().from(quranWardsTable).where(and(
        eq(quranWardsTable.id, claimed.wardId),
        eq(quranWardsTable.teacherId, teacherId),
      ));
      if (!ward) throw new Error("Quran submission ward is missing");

      if (parsed.data.status === "needs_resubmission") {
        await tx.update(quranWardsTable).set({
          status: "needs_review",
          updatedAt: new Date(),
        }).where(and(eq(quranWardsTable.id, ward.id), eq(quranWardsTable.teacherId, teacherId)));
        return claimed;
      }

      const recitedDate = today();
      const [record] = await tx.insert(quranRecitationsTable).values({
        teacherId,
        wardId: ward.id,
        studentId: ward.studentId,
        status: "completed",
        memorizationScore: parsed.data.memorizationScore ?? null,
        recitationScore: parsed.data.recitationScore ?? null,
        mistakeCounts: parsed.data.mistakeCounts ?? null,
        teacherNote: parsed.data.feedback ?? null,
        recitedDate,
        progressApplied: false,
      }).onConflictDoUpdate({
        target: [quranRecitationsTable.teacherId, quranRecitationsTable.wardId, quranRecitationsTable.recitedDate],
        set: {
          status: "completed",
          memorizationScore: parsed.data.memorizationScore ?? null,
          recitationScore: parsed.data.recitationScore ?? null,
          mistakeCounts: parsed.data.mistakeCounts ?? null,
          teacherNote: parsed.data.feedback ?? null,
        },
      }).returning();

      await tx.update(quranWardsTable).set({
        status: "completed",
        updatedAt: new Date(),
      }).where(and(eq(quranWardsTable.id, ward.id), eq(quranWardsTable.teacherId, teacherId)));
      await applyCompletedRecitationProgress(tx, teacherId, ward, record, recitedDate);
      return claimed;
    });
    if (updated) {
      res.json(ReviewQuranSubmissionResponse.parse(updated));
      return;
    }
  } catch (error) {
    req.log?.error(error, "Review Quran submission transaction failed");
    res.status(500).json({ error: "Unable to review Quran submission" });
    return;
  }
  const [existing] = await db.select(submissionReviewColumns)
    .from(quranSubmissionsTable).where(eq(quranSubmissionsTable.id, params.data.id));
  if (!existing || existing.teacherId !== teacherId) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }
  if (existing.status !== "submitted" && matchesCompletedReview(existing, parsed.data, teacherId)) {
    res.status(200).json(ReviewQuranSubmissionResponse.parse(existing));
    return;
  }
  res.status(409).json({ error: "Submission was already reviewed" });
});

async function dueWards(teacherId: number) {
  return db.select({
    id: quranWardsTable.id,
    assignmentRequestId: quranWardsTable.assignmentRequestId,
    studentId: quranWardsTable.studentId,
    mode: quranWardsTable.mode,
    surahNumber: quranWardsTable.surahNumber,
    surahName: quranWardsTable.surahName,
    startAyah: quranWardsTable.startAyah,
    endAyah: quranWardsTable.endAyah,
    assignedDate: quranWardsTable.assignedDate,
    dueDate: quranWardsTable.dueDate,
    notes: quranWardsTable.notes,
    status: quranWardsTable.status,
    studentName: studentsTable.name,
  }).from(quranWardsTable)
    .innerJoin(studentsTable, eq(studentsTable.id, quranWardsTable.studentId))
    .where(and(
      eq(quranWardsTable.teacherId, teacherId),
      eq(studentsTable.teacherId, teacherId),
      or(
        eq(quranWardsTable.status, "needs_review"),
        and(
          inArray(quranWardsTable.status, ["assigned", "in_progress"]),
          lte(quranWardsTable.dueDate, today()),
        ),
      ),
    )).orderBy(quranWardsTable.dueDate);
}

router.get("/quran/review-queue", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const wards = await dueWards(teacherId);
  res.json(GetQuranReviewQueueResponse.parse(wards));
});

router.get("/quran/today", async (req, res): Promise<void> => {
  const teacherId = teacherIdOf(req);
  if (teacherId === null) { res.status(401).json({ error: "Not authenticated" }); return; }
  const date = today();
  const [due, recitations] = await Promise.all([
    dueWards(teacherId),
    db.select().from(quranRecitationsTable).where(and(
      eq(quranRecitationsTable.teacherId, teacherId),
      eq(quranRecitationsTable.recitedDate, date),
    )).orderBy(desc(quranRecitationsTable.createdAt)),
  ]);
  res.json(GetQuranTodayDashboardResponse.parse({ dueWards: due, todayRecitations: recitations }));
});

export default router;