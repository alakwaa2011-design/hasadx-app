import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, studentAccountsTable, flagScoresTable, colorScoresTable, memoryScoresTable, multiplicationScoresTable, scrambleScoresTable, capitalScoresTable, wameethScoresTable, stroopScoresTable, studentsTable } from "@workspace/db";
import { eq, desc, gt, gte, sql, count, and } from "drizzle-orm";
import { authLimiter, registerLimiter } from "../lib/rate-limiter";
import { logActivity } from "../lib/activity-logger";

const router: IRouter = Router();

router.post("/student-auth/register", registerLimiter, async (req, res) => {
  try {
    const { username, displayName, password } = req.body;

    if (!username || !displayName || !password) {
      res.status(400).json({ message: "يجب إدخال اسم المستخدم والاسم وكلمة المرور" });
      return;
    }

    if (username.length < 3 || username.length > 30) {
      res.status(400).json({ message: "اسم المستخدم يجب أن يكون بين 3 و 30 حرفاً" });
      return;
    }

    if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(username)) {
      res.status(400).json({ message: "اسم المستخدم يجب أن يحتوي على حروف وأرقام فقط" });
      return;
    }

    if (typeof password !== "string" || password.length < 6) {
      res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
      return;
    }
    if (password.length > 100) {
      res.status(400).json({ message: "كلمة المرور طويلة جداً" });
      return;
    }

    const [existing] = await db
      .select()
      .from(studentAccountsTable)
      .where(eq(studentAccountsTable.username, username))
      .limit(1);

    if (existing) {
      res.status(409).json({ message: "اسم المستخدم مسجّل مسبقاً" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [student] = await db
      .insert(studentAccountsTable)
      .values({
        username,
        displayName,
        passwordHash,
      })
      .returning();

    delete req.session.teacherId;
    req.session.studentAccountId = student.id;

    res.status(201).json({
      student: {
        id: student.id,
        username: student.username,
        displayName: student.displayName,
        totalScore: student.totalScore,
        gamesPlayed: student.gamesPlayed,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "خطأ في التسجيل";
    req.log.error({ err: error }, "Student registration error");
    res.status(400).json({ message: msg });
  }
});

router.post("/student-auth/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: "يجب إدخال اسم المستخدم وكلمة المرور" });
      return;
    }

    const [student] = await db
      .select()
      .from(studentAccountsTable)
      .where(eq(studentAccountsTable.username, username))
      .limit(1);

    if (!student) {
      res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
      return;
    }

    const valid = await bcrypt.compare(password, student.passwordHash);
    if (!valid) {
      res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
      return;
    }

    delete req.session.teacherId;
    req.session.studentAccountId = student.id;

    logActivity({
      req,
      userId: student.id,
      userName: student.displayName || student.username,
      userRole: "student",
      action: "login",
      details: { method: "password" },
    });

    res.json({
      student: {
        id: student.id,
        username: student.username,
        displayName: student.displayName,
        totalScore: student.totalScore,
        gamesPlayed: student.gamesPlayed,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "خطأ في تسجيل الدخول";
    req.log.error({ err: error }, "Student login error");
    res.status(400).json({ message: msg });
  }
});

router.get("/student-auth/me", async (req, res) => {
  if (!req.session.studentAccountId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentAccountsTable)
    .where(eq(studentAccountsTable.id, req.session.studentAccountId))
    .limit(1);

  if (!student) {
    res.status(401).json({ message: "المستخدم غير موجود" });
    return;
  }

  const [rankResult] = await db
    .select({ cnt: count() })
    .from(studentAccountsTable)
    .where(gt(studentAccountsTable.totalScore, student.totalScore));
  const rank = (rankResult?.cnt ?? 0) + 1;

  res.json({
    id: student.id,
    username: student.username,
    displayName: student.displayName,
    avatar: student.avatar,
    totalScore: student.totalScore,
    gamesPlayed: student.gamesPlayed,
    rank,
    role: "student",
  });
});

router.get("/student-auth/recent-scores", async (req, res) => {
  if (!req.session.studentAccountId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }

  const sid = req.session.studentAccountId;

  try {
    const [flagRows, colorRows, memoryRows, multiplyRows, scrambleRows, capitalRows, wameethRows, stroopRows] = await Promise.all([
      db.select({ id: flagScoresTable.id, name: flagScoresTable.name, score: flagScoresTable.score, createdAt: flagScoresTable.createdAt })
        .from(flagScoresTable).where(eq(flagScoresTable.studentAccountId, sid)).orderBy(desc(flagScoresTable.createdAt)).limit(5),
      db.select({ id: colorScoresTable.id, name: colorScoresTable.name, score: colorScoresTable.score, createdAt: colorScoresTable.createdAt })
        .from(colorScoresTable).where(eq(colorScoresTable.studentAccountId, sid)).orderBy(desc(colorScoresTable.createdAt)).limit(5),
      db.select({ id: memoryScoresTable.id, name: memoryScoresTable.name, score: memoryScoresTable.score, createdAt: memoryScoresTable.createdAt })
        .from(memoryScoresTable).where(eq(memoryScoresTable.studentAccountId, sid)).orderBy(desc(memoryScoresTable.createdAt)).limit(5),
      db.select({ id: multiplicationScoresTable.id, name: multiplicationScoresTable.name, score: multiplicationScoresTable.score, createdAt: multiplicationScoresTable.createdAt })
        .from(multiplicationScoresTable).where(eq(multiplicationScoresTable.studentAccountId, sid)).orderBy(desc(multiplicationScoresTable.createdAt)).limit(5),
      db.select({ id: scrambleScoresTable.id, name: scrambleScoresTable.name, score: scrambleScoresTable.score, createdAt: scrambleScoresTable.createdAt })
        .from(scrambleScoresTable).where(eq(scrambleScoresTable.studentAccountId, sid)).orderBy(desc(scrambleScoresTable.createdAt)).limit(5),
      db.select({ id: capitalScoresTable.id, name: capitalScoresTable.name, score: capitalScoresTable.score, createdAt: capitalScoresTable.createdAt })
        .from(capitalScoresTable).where(eq(capitalScoresTable.studentAccountId, sid)).orderBy(desc(capitalScoresTable.createdAt)).limit(5),
      db.select({ id: wameethScoresTable.id, name: wameethScoresTable.assignmentTitle, score: wameethScoresTable.score, createdAt: wameethScoresTable.createdAt })
        .from(wameethScoresTable).where(eq(wameethScoresTable.studentAccountId, sid)).orderBy(desc(wameethScoresTable.createdAt)).limit(5),
      db.select({ id: stroopScoresTable.id, name: stroopScoresTable.name, score: stroopScoresTable.score, createdAt: stroopScoresTable.createdAt })
        .from(stroopScoresTable).where(eq(stroopScoresTable.studentAccountId, sid)).orderBy(desc(stroopScoresTable.createdAt)).limit(5),
    ]);

    const all = [
      ...flagRows.map(r => ({ ...r, game: "flags" as const })),
      ...colorRows.map(r => ({ ...r, game: "color" as const })),
      ...memoryRows.map(r => ({ ...r, game: "memory" as const })),
      ...multiplyRows.map(r => ({ ...r, game: "multiply" as const })),
      ...scrambleRows.map(r => ({ ...r, game: "scramble" as const })),
      ...capitalRows.map(r => ({ ...r, game: "capitals" as const })),
      ...wameethRows.map(r => ({ ...r, game: "wameeth" as const })),
      ...stroopRows.map(r => ({ ...r, game: "stroop" as const })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    res.json(all);
  } catch (error: unknown) {
    req.log.error({ err: error }, "Failed to fetch student scores");
    res.status(500).json({ message: "خطأ في جلب النتائج" });
  }
});

// Returns the distinct YYYY-MM-DD activity days for the last 60 days.
// Used by the student dashboard to compute the daily streak chip.
router.get("/student-auth/activity-days", async (req, res) => {
  if (!req.session.studentAccountId) {
    res.status(401).json({ message: "غير مسجل الدخول" });
    return;
  }
  const sid = req.session.studentAccountId;
  const since = new Date();
  since.setDate(since.getDate() - 60);
  since.setHours(0, 0, 0, 0);

  try {
    const tables = [
      flagScoresTable, colorScoresTable, memoryScoresTable,
      multiplicationScoresTable, scrambleScoresTable, capitalScoresTable,
      wameethScoresTable, stroopScoresTable,
    ] as const;
    const results = await Promise.all(
      tables.map(t =>
        db.select({ createdAt: t.createdAt })
          .from(t)
          .where(and(eq(t.studentAccountId, sid), gte(t.createdAt, since)))
      )
    );
    const days = new Set<string>();
    for (const rows of results) {
      for (const r of rows) {
        if (!r.createdAt) continue;
        const d = new Date(r.createdAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        days.add(`${y}-${m}-${day}`);
      }
    }
    res.json({ days: Array.from(days).sort().reverse() });
  } catch (error: unknown) {
    req.log.error({ err: error }, "Failed to fetch activity days");
    res.status(500).json({ message: "خطأ" });
  }
});

router.post("/student-auth/google", authLimiter, async (req, res) => {
  try {
    const { credential } = req.body ?? {};
    if (!credential || typeof credential !== "string") {
      res.status(400).json({ message: "بيانات Google ناقصة" });
      return;
    }

    const { verifyGoogleIdToken } = await import("../lib/google-verify");
    let profile;
    try {
      profile = await verifyGoogleIdToken(credential);
    } catch (err) {
      req.log.warn({ err }, "Google ID token verification failed (student)");
      res.status(401).json({ message: "تعذّر التحقق من حساب Google" });
      return;
    }

    if (!profile.email || !profile.emailVerified) {
      res.status(400).json({ message: "بريد Google غير مُفعَّل" });
      return;
    }

    const email = profile.email.toLowerCase();
    const displayName = profile.name?.trim() || email.split("@")[0];

    let student: typeof studentAccountsTable.$inferSelect | undefined;

    const byGoogle = await db
      .select()
      .from(studentAccountsTable)
      .where(eq(studentAccountsTable.googleId, profile.sub))
      .limit(1);
    student = byGoogle[0];

    if (!student) {
      const byEmail = await db
        .select()
        .from(studentAccountsTable)
        .where(eq(studentAccountsTable.email, email))
        .limit(1);
      const existingByEmail = byEmail[0];

      if (existingByEmail) {
        const [linked] = await db
          .update(studentAccountsTable)
          .set({ googleId: profile.sub })
          .where(eq(studentAccountsTable.id, existingByEmail.id))
          .returning();
        student = linked;
      } else {
        // Derive a unique username from the email local part.
        const rawLocal = email.split("@")[0] || "user";
        const baseUsername = rawLocal
          .replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, "_")
          .slice(0, 24) || "user";

        let username = baseUsername;
        for (let i = 0; i < 30; i++) {
          const [clash] = await db
            .select({ id: studentAccountsTable.id })
            .from(studentAccountsTable)
            .where(eq(studentAccountsTable.username, username))
            .limit(1);
          if (!clash) break;
          username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const crypto = await import("crypto");
        const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

        const [created] = await db
          .insert(studentAccountsTable)
          .values({
            username,
            displayName,
            passwordHash: randomHash,
            email,
            googleId: profile.sub,
          })
          .returning();
        student = created;
      }
    }

    if (!student) {
      res.status(500).json({ message: "تعذّر إنشاء الحساب" });
      return;
    }

    delete req.session.teacherId;
    req.session.studentAccountId = student.id;

    res.json({
      student: {
        id: student.id,
        username: student.username,
        displayName: student.displayName,
        totalScore: student.totalScore,
        gamesPlayed: student.gamesPlayed,
      },
    });
  } catch (error: unknown) {
    req.log.error({ err: error }, "Student Google login error");
    res.status(500).json({ message: "خطأ في تسجيل الدخول عبر Google" });
  }
});

router.post("/student-auth/logout", (req, res) => {
  const sess: any = req.session;
  const sid = sess?.studentAccountId ?? null;
  if (sid) {
    logActivity({ req, userId: sid, userRole: "student", action: "logout" });
  }
  req.session.destroy(() => {
    res.json({ message: "تم تسجيل الخروج بنجاح" });
  });
});

router.post("/teacher/reset-student-password", async (req, res) => {
  try {
    const teacherId = req.session.teacherId;
    if (!teacherId) {
      res.status(401).json({ message: "يجب تسجيل الدخول كمعلم" });
      return;
    }

    const { studentId, newPassword } = req.body;

    if (!studentId || !newPassword) {
      res.status(400).json({ message: "معرّف الطالب وكلمة المرور الجديدة مطلوبان" });
      return;
    }

    if (typeof newPassword !== "string" || newPassword.length < 4) {
      res.status(400).json({ message: "كلمة المرور يجب أن تكون 4 أحرف على الأقل" });
      return;
    }

    const parsedStudentId = parseInt(String(studentId), 10);
    if (isNaN(parsedStudentId)) {
      res.status(400).json({ message: "معرّف الطالب غير صالح" });
      return;
    }

    const [rosterStudent] = await db
      .select()
      .from(studentsTable)
      .where(and(eq(studentsTable.id, parsedStudentId), eq(studentsTable.teacherId, teacherId)))
      .limit(1);

    if (!rosterStudent) {
      res.status(404).json({ message: "الطالب غير موجود في قائمة طلابك" });
      return;
    }

    if (!rosterStudent.studentAccountId) {
      res.status(400).json({ message: "لم يُربط حساب منصة لهذا الطالب بعد — أضف اسم المستخدم من بيانات الطالب أولاً" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const [updated] = await db
      .update(studentAccountsTable)
      .set({ passwordHash: newHash })
      .where(eq(studentAccountsTable.id, rosterStudent.studentAccountId))
      .returning({ id: studentAccountsTable.id });

    if (!updated) {
      res.status(404).json({ message: "حساب الطالب غير موجود" });
      return;
    }

    req.log.info({ teacherId, studentId: parsedStudentId, studentAccountId: rosterStudent.studentAccountId }, "Teacher reset student password");
    res.json({ message: "تم تغيير كلمة مرور الطالب بنجاح" });
  } catch (error: unknown) {
    req.log.error({ err: error }, "Failed to reset student password");
    res.status(500).json({ message: "حدث خطأ أثناء تغيير كلمة المرور" });
  }
});

export default router;
