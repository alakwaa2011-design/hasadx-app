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
} from "@workspace/api-zod";

const router: IRouter = Router();
type TeacherRequest = { session?: { teacherId?: number }; log?: { error: (error: unknown, message: string) => void } };

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
      if (shouldApplyRecitationProgress(record.status, record.progressApplied)) {
        // Serialize profile advancement for this teacher/student across different wards.
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
        const lastRecitedDate = profile?.lastRecitedDate && profile.lastRecitedDate > parsed.data.recitedDate
          ? profile.lastRecitedDate
          : parsed.data.recitedDate;
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
        await tx.update(quranRecitationsTable).set({ progressApplied: true }).where(and(
          eq(quranRecitationsTable.id, record.id),
          eq(quranRecitationsTable.teacherId, teacherId),
          eq(quranRecitationsTable.progressApplied, false),
        ));
      }
      return record;
    });
    if (!result) { res.status(404).json({ error: "Ward not found" }); return; }
    res.status(201).json(CreateQuranRecitationResponse.parse(result));
  } catch (error) {
    req.log?.error(error, "Create Quran recitation failed");
    res.status(500).json({ error: "Unable to save Quran recitation" });
  }
});

async function dueWards(teacherId: number) {
  return db.select({
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