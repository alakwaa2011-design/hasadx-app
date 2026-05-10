import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { db, teachersTable, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : process.env.APP_BASE_URL || "";
const REDIRECT_URI = `${BASE_URL}/api/auth/google/classroom/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
];

function makeOAuth2Client() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

async function getAuthedClient(teacherId: number) {
  const [teacher] = await db
    .select({
      accessToken: teachersTable.classroomAccessToken,
      refreshToken: teachersTable.classroomRefreshToken,
      expiry: teachersTable.classroomTokenExpiry,
    })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);

  if (!teacher?.accessToken || !teacher?.refreshToken) return null;

  const oauth2 = makeOAuth2Client();
  oauth2.setCredentials({
    access_token: teacher.accessToken,
    refresh_token: teacher.refreshToken,
    expiry_date: teacher.expiry ? teacher.expiry.getTime() : undefined,
  });

  // Auto-refresh if token is expired / near expiry
  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await db
        .update(teachersTable)
        .set({
          classroomAccessToken: tokens.access_token,
          classroomTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        })
        .where(eq(teachersTable.id, teacherId));
    }
  });

  return oauth2;
}

// ── GET /api/classroom/connect ─────────────────────────────────────────────
// Initiates the OAuth2 authorization flow
router.get("/classroom/connect", (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(503).json({ message: "لم يتم إعداد Google Classroom بعد" });
    return;
  }

  const oauth2 = makeOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state: String(teacherId),
  });

  res.redirect(url);
});

// ── GET /api/auth/google/classroom/callback ────────────────────────────────
// Handles the OAuth2 callback from Google
router.get("/auth/google/classroom/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      req.log.warn({ error }, "Google Classroom OAuth denied");
      res.redirect("/teacher/classroom?error=denied");
      return;
    }

    const teacherId = parseInt(state || "", 10);
    if (!teacherId || isNaN(teacherId)) {
      res.redirect("/teacher/classroom?error=invalid_state");
      return;
    }

    const oauth2 = makeOAuth2Client();
    const { tokens } = await oauth2.getToken(code);

    await db
      .update(teachersTable)
      .set({
        classroomAccessToken: tokens.access_token ?? null,
        classroomRefreshToken: tokens.refresh_token ?? null,
        classroomTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      })
      .where(eq(teachersTable.id, teacherId));

    res.redirect("/teacher/classroom?connected=1");
  } catch (err) {
    req.log.error({ err }, "Google Classroom callback error");
    res.redirect("/teacher/classroom?error=callback_failed");
  }
});

// ── GET /api/classroom/status ──────────────────────────────────────────────
router.get("/classroom/status", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  const [teacher] = await db
    .select({
      accessToken: teachersTable.classroomAccessToken,
      refreshToken: teachersTable.classroomRefreshToken,
    })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);

  res.json({ connected: !!(teacher?.accessToken && teacher?.refreshToken) });
});

// ── DELETE /api/classroom/disconnect ──────────────────────────────────────
router.delete("/classroom/disconnect", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  try {
    const oauth2 = await getAuthedClient(teacherId);
    if (oauth2) {
      const creds = oauth2.credentials;
      if (creds.access_token) {
        await oauth2.revokeToken(creds.access_token).catch(() => {});
      }
    }
  } catch {
    // Best-effort revocation
  }

  await db
    .update(teachersTable)
    .set({
      classroomAccessToken: null,
      classroomRefreshToken: null,
      classroomTokenExpiry: null,
    })
    .where(eq(teachersTable.id, teacherId));

  res.json({ message: "تم قطع الاتصال بـ Google Classroom" });
});

// ── GET /api/classroom/courses ─────────────────────────────────────────────
router.get("/classroom/courses", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  try {
    const oauth2 = await getAuthedClient(teacherId);
    if (!oauth2) { res.status(403).json({ message: "لم يتم ربط Google Classroom بعد" }); return; }

    const classroom = google.classroom({ version: "v1", auth: oauth2 });
    const { data } = await classroom.courses.list({ teacherId: "me", courseStates: ["ACTIVE"] });
    const courses = (data.courses || []).map((c) => ({
      id: c.id,
      name: c.name,
      section: c.section,
      room: c.room,
      enrollmentCode: c.enrollmentCode,
    }));

    res.json({ courses });
  } catch (err: any) {
    req.log.error({ err }, "Classroom courses fetch error");
    if (err?.code === 401 || err?.status === 401) {
      res.status(401).json({ message: "انتهت صلاحية الاتصال بـ Google Classroom، أعد الربط" });
    } else {
      res.status(500).json({ message: "تعذّر جلب المقررات من Google Classroom" });
    }
  }
});

// ── GET /api/classroom/courses/:courseId/students ─────────────────────────
router.get("/classroom/courses/:courseId/students", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  try {
    const oauth2 = await getAuthedClient(teacherId);
    if (!oauth2) { res.status(403).json({ message: "لم يتم ربط Google Classroom بعد" }); return; }

    const classroom = google.classroom({ version: "v1", auth: oauth2 });
    const { data } = await classroom.courses.students.list({
      courseId: req.params.courseId,
    });

    const students = (data.students || []).map((s) => ({
      googleId: s.userId,
      name: s.profile?.name?.fullName || s.profile?.emailAddress || "طالب",
      email: s.profile?.emailAddress,
    }));

    res.json({ students });
  } catch (err: any) {
    req.log.error({ err }, "Classroom students fetch error");
    res.status(500).json({ message: "تعذّر جلب الطلاب من Google Classroom" });
  }
});

// ── POST /api/classroom/courses/:courseId/students/import ─────────────────
// Imports Google Classroom students into the Hasad platform
router.post("/classroom/courses/:courseId/students/import", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  try {
    const oauth2 = await getAuthedClient(teacherId);
    if (!oauth2) { res.status(403).json({ message: "لم يتم ربط Google Classroom بعد" }); return; }

    const { targetClass } = req.body ?? {};

    const classroom = google.classroom({ version: "v1", auth: oauth2 });
    const { data } = await classroom.courses.students.list({
      courseId: req.params.courseId,
    });

    const googleStudents = (data.students || []).map((s) => ({
      name: s.profile?.name?.fullName || s.profile?.emailAddress || "طالب",
      gradeLevel: null as string | null,
      studentClass: targetClass || null,
      parentPhone: null as string | null,
      notes: s.profile?.emailAddress ? `Google: ${s.profile.emailAddress}` : null,
      teacherId,
    }));

    if (googleStudents.length === 0) {
      res.json({ imported: 0, message: "لا يوجد طلاب في هذا المقرر" });
      return;
    }

    const inserted = await db.insert(studentsTable).values(googleStudents).returning({ id: studentsTable.id });

    res.json({ imported: inserted.length, message: `تم استيراد ${inserted.length} طالب بنجاح` });
  } catch (err: any) {
    req.log.error({ err }, "Classroom import students error");
    res.status(500).json({ message: "تعذّر استيراد الطلاب" });
  }
});

// ── POST /api/classroom/courses/:courseId/coursework ──────────────────────
// Publishes a Hasad assignment to Google Classroom
router.post("/classroom/courses/:courseId/coursework", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  try {
    const oauth2 = await getAuthedClient(teacherId);
    if (!oauth2) { res.status(403).json({ message: "لم يتم ربط Google Classroom بعد" }); return; }

    const { title, description, dueDate, maxPoints, assignmentUrl } = req.body ?? {};
    if (!title) { res.status(400).json({ message: "عنوان الواجب مطلوب" }); return; }

    const classroom = google.classroom({ version: "v1", auth: oauth2 });

    const coursework: any = {
      title,
      description: description || "",
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
    };

    if (maxPoints) coursework.maxPoints = Number(maxPoints);

    if (assignmentUrl) {
      coursework.materials = [{
        link: { url: assignmentUrl, title: title },
      }];
    }

    if (dueDate) {
      const d = new Date(dueDate);
      coursework.dueDate = {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
      };
      coursework.dueTime = {
        hours: d.getHours(),
        minutes: d.getMinutes(),
      };
    }

    const { data } = await classroom.courses.courseWork.create({
      courseId: req.params.courseId,
      requestBody: coursework,
    });

    res.json({
      id: data.id,
      title: data.title,
      alternateLink: data.alternateLink,
      message: "تم نشر الواجب في Google Classroom بنجاح",
    });
  } catch (err: any) {
    req.log.error({ err }, "Classroom publish assignment error");
    res.status(500).json({ message: "تعذّر نشر الواجب في Google Classroom" });
  }
});

// ── GET /api/classroom/courses/:courseId/submissions ──────────────────────
// Fetches grades/submissions for a coursework item
router.get("/classroom/courses/:courseId/submissions", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  const { courseWorkId } = req.query as Record<string, string>;
  if (!courseWorkId) { res.status(400).json({ message: "courseWorkId مطلوب" }); return; }

  try {
    const oauth2 = await getAuthedClient(teacherId);
    if (!oauth2) { res.status(403).json({ message: "لم يتم ربط Google Classroom بعد" }); return; }

    const classroom = google.classroom({ version: "v1", auth: oauth2 });
    const { data } = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: req.params.courseId,
      courseWorkId,
    });

    const submissions = (data.studentSubmissions || []).map((s) => ({
      id: s.id,
      userId: s.userId,
      state: s.state,
      assignedGrade: s.assignedGrade,
      draftGrade: s.draftGrade,
    }));

    res.json({ submissions });
  } catch (err: any) {
    req.log.error({ err }, "Classroom submissions fetch error");
    res.status(500).json({ message: "تعذّر جلب بيانات الدرجات" });
  }
});

export default router;
