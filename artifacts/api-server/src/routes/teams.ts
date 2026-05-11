import { Router, type IRouter } from "express";
import { db, teachersTable, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

// Education API scopes + offline_access for refresh tokens
const SCOPES = [
  "offline_access",
  "User.Read",
  "EduRoster.ReadBasic.All",
  "EduAssignments.ReadWrite.All",
].join(" ");

function getRedirectUri(req: any): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
  return `${proto}://${host}/api/auth/microsoft/teams/callback`;
}

async function refreshIfNeeded(
  teacherId: number,
  token: { accessToken: string; refreshToken: string; expiry: Date | null },
): Promise<string | null> {
  const now = Date.now();
  const expiryMs = token.expiry ? token.expiry.getTime() : 0;
  if (expiryMs - now > 5 * 60 * 1000) return token.accessToken;

  try {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
    });
    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!r.ok) return null;
    const data = await r.json() as any;
    const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
    await db.update(teachersTable).set({
      teamsAccessToken: data.access_token,
      ...(data.refresh_token ? { teamsRefreshToken: data.refresh_token } : {}),
      teamsTokenExpiry: newExpiry,
    }).where(eq(teachersTable.id, teacherId));
    return data.access_token as string;
  } catch {
    return null;
  }
}

async function getAccessToken(teacherId: number): Promise<string | null> {
  const [row] = await db
    .select({
      accessToken: teachersTable.teamsAccessToken,
      refreshToken: teachersTable.teamsRefreshToken,
      expiry: teachersTable.teamsTokenExpiry,
    })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);

  if (!row?.accessToken || !row?.refreshToken) return null;
  return refreshIfNeeded(teacherId, {
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiry: row.expiry,
  });
}

async function graph(path: string, accessToken: string, opts: RequestInit = {}) {
  const r = await fetch(`${GRAPH_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
  return r;
}

// ── GET /api/teams/connect ─────────────────────────────────────────────────
router.get("/teams/connect", (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.status(503).json({ message: "لم يتم إعداد Microsoft Teams بعد" });
    return;
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(req),
    response_mode: "query",
    scope: SCOPES,
    state: String(teacherId),
    prompt: "consent",
  });

  res.redirect(`${AUTH_BASE}?${params.toString()}`);
});

// ── GET /api/auth/microsoft/teams/callback ────────────────────────────────
router.get("/auth/microsoft/teams/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      req.log.warn({ error }, "Microsoft Teams OAuth denied");
      res.redirect("/teacher/teams?error=denied");
      return;
    }

    const teacherId = parseInt(state || "", 10);
    if (!teacherId || isNaN(teacherId)) {
      res.redirect("/teacher/teams?error=invalid_state");
      return;
    }

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: getRedirectUri(req),
      grant_type: "authorization_code",
      scope: SCOPES,
    });

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      req.log.error({ body }, "Microsoft Teams token exchange failed");
      res.redirect("/teacher/teams?error=callback_failed");
      return;
    }

    const tokens = await tokenRes.json() as any;
    const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);

    await db.update(teachersTable).set({
      teamsAccessToken: tokens.access_token ?? null,
      teamsRefreshToken: tokens.refresh_token ?? null,
      teamsTokenExpiry: expiry,
    }).where(eq(teachersTable.id, teacherId));

    res.redirect("/teacher/teams?connected=1");
  } catch (err) {
    req.log.error({ err }, "Microsoft Teams callback error");
    res.redirect("/teacher/teams?error=callback_failed");
  }
});

// ── GET /api/teams/status ──────────────────────────────────────────────────
router.get("/teams/status", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  const [row] = await db
    .select({
      accessToken: teachersTable.teamsAccessToken,
      refreshToken: teachersTable.teamsRefreshToken,
    })
    .from(teachersTable)
    .where(eq(teachersTable.id, teacherId))
    .limit(1);

  res.json({ connected: !!(row?.accessToken && row?.refreshToken) });
});

// ── DELETE /api/teams/disconnect ──────────────────────────────────────────
router.delete("/teams/disconnect", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  await db.update(teachersTable).set({
    teamsAccessToken: null,
    teamsRefreshToken: null,
    teamsTokenExpiry: null,
  }).where(eq(teachersTable.id, teacherId));

  res.json({ message: "تم قطع الاتصال بـ Microsoft Teams" });
});

// ── GET /api/teams/classes ─────────────────────────────────────────────────
// Returns education classes the teacher belongs to.
// Falls back to joined Teams if the Education API is unavailable.
router.get("/teams/classes", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  const token = await getAccessToken(teacherId);
  if (!token) { res.status(403).json({ message: "لم يتم ربط Microsoft Teams بعد" }); return; }

  try {
    // Try Education API first
    const eduRes = await graph("/education/classes?$top=50&$select=id,displayName,externalId,mailNickname", token);

    if (eduRes.ok) {
      const data = await eduRes.json() as any;
      const classes = (data.value || []).map((c: any) => ({
        id: c.id,
        name: c.displayName,
        externalId: c.externalId || null,
        mailNickname: c.mailNickname || null,
        source: "education",
      }));
      res.json({ classes });
      return;
    }

    // Fallback: general joined Teams
    const teamsRes = await graph("/me/joinedTeams?$select=id,displayName,description", token);
    if (!teamsRes.ok) {
      const body = await teamsRes.text();
      req.log.error({ body }, "Teams classes fetch failed");
      res.status(500).json({ message: "تعذّر جلب الفصول" });
      return;
    }
    const data = await teamsRes.json() as any;
    const classes = (data.value || []).map((t: any) => ({
      id: t.id,
      name: t.displayName,
      externalId: null,
      mailNickname: null,
      source: "teams",
    }));
    res.json({ classes });
  } catch (err: any) {
    req.log.error({ err }, "Teams classes fetch error");
    res.status(500).json({ message: "تعذّر جلب الفصول من Microsoft Teams" });
  }
});

// ── GET /api/teams/classes/:classId/members ───────────────────────────────
router.get("/teams/classes/:classId/members", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  const token = await getAccessToken(teacherId);
  if (!token) { res.status(403).json({ message: "لم يتم ربط Microsoft Teams بعد" }); return; }

  const { classId } = req.params;
  const source = (req.query.source as string) || "education";

  try {
    let members: { microsoftId: string; name: string; email: string | null }[] = [];

    if (source === "education") {
      const r = await graph(`/education/classes/${classId}/members?$select=id,displayName,mail,userPrincipalName`, token);
      if (!r.ok) throw new Error(`Education members: ${r.status}`);
      const data = await r.json() as any;
      members = (data.value || [])
        .filter((m: any) => m["@odata.type"] !== "#microsoft.graph.educationTeacher")
        .map((m: any) => ({
          microsoftId: m.id,
          name: m.displayName || m.mail || "طالب",
          email: m.mail || m.userPrincipalName || null,
        }));
    } else {
      const r = await graph(`/groups/${classId}/members?$select=id,displayName,mail,userPrincipalName`, token);
      if (!r.ok) throw new Error(`Teams members: ${r.status}`);
      const data = await r.json() as any;
      members = (data.value || []).map((m: any) => ({
        microsoftId: m.id,
        name: m.displayName || m.mail || "عضو",
        email: m.mail || m.userPrincipalName || null,
      }));
    }

    res.json({ members });
  } catch (err: any) {
    req.log.error({ err }, "Teams members fetch error");
    res.status(500).json({ message: "تعذّر جلب أعضاء الفصل" });
  }
});

// ── POST /api/teams/classes/:classId/members/import ──────────────────────
router.post("/teams/classes/:classId/members/import", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  const token = await getAccessToken(teacherId);
  if (!token) { res.status(403).json({ message: "لم يتم ربط Microsoft Teams بعد" }); return; }

  const { classId } = req.params;
  const { targetClass, source = "education" } = req.body ?? {};

  try {
    let members: { name: string; email: string | null }[] = [];

    if (source === "education") {
      const r = await graph(`/education/classes/${classId}/members?$select=id,displayName,mail,userPrincipalName`, token);
      if (!r.ok) throw new Error(`Education members: ${r.status}`);
      const data = await r.json() as any;
      members = (data.value || [])
        .filter((m: any) => m["@odata.type"] !== "#microsoft.graph.educationTeacher")
        .map((m: any) => ({
          name: m.displayName || m.mail || "طالب",
          email: m.mail || m.userPrincipalName || null,
        }));
    } else {
      const r = await graph(`/groups/${classId}/members?$select=id,displayName,mail,userPrincipalName`, token);
      if (!r.ok) throw new Error(`Teams members: ${r.status}`);
      const data = await r.json() as any;
      members = (data.value || []).map((m: any) => ({
        name: m.displayName || m.mail || "عضو",
        email: m.mail || m.userPrincipalName || null,
      }));
    }

    if (members.length === 0) {
      res.json({ imported: 0, message: "لا يوجد طلاب في هذا الفصل" });
      return;
    }

    const rows = members.map((m) => ({
      name: m.name,
      gradeLevel: null as string | null,
      studentClass: targetClass || null,
      parentPhone: null as string | null,
      notes: m.email ? `Microsoft Teams: ${m.email}` : null,
      teacherId,
    }));

    const inserted = await db.insert(studentsTable).values(rows).returning({ id: studentsTable.id });
    res.json({ imported: inserted.length, message: `تم استيراد ${inserted.length} طالب بنجاح` });
  } catch (err: any) {
    req.log.error({ err }, "Teams import error");
    res.status(500).json({ message: "تعذّر استيراد الطلاب" });
  }
});

// ── POST /api/teams/classes/:classId/assignments ──────────────────────────
// Publishes an assignment to an Education class via Microsoft Graph
router.post("/teams/classes/:classId/assignments", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  const token = await getAccessToken(teacherId);
  if (!token) { res.status(403).json({ message: "لم يتم ربط Microsoft Teams بعد" }); return; }

  const { title, instructions, dueDate, maxPoints, assignmentUrl } = req.body ?? {};
  if (!title) { res.status(400).json({ message: "عنوان الواجب مطلوب" }); return; }

  const { classId } = req.params;

  try {
    const body: any = {
      displayName: title,
      instructions: {
        content: instructions || "",
        contentType: "text",
      },
      status: "published",
    };

    if (maxPoints) {
      body.grading = { "@odata.type": "#microsoft.graph.educationAssignmentPointsGradeType", maxPoints: Number(maxPoints) };
    }

    if (dueDate) {
      body.dueDateTime = new Date(dueDate).toISOString();
    }

    if (assignmentUrl) {
      body.resources = [{
        distributeForStudentWork: false,
        resource: {
          "@odata.type": "#microsoft.graph.educationLinkResource",
          displayName: title,
          link: assignmentUrl,
        },
      }];
    }

    const r = await graph(`/education/classes/${classId}/assignments`, token, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const errBody = await r.text();
      req.log.error({ errBody, status: r.status }, "Teams assignment publish failed");
      res.status(500).json({ message: "تعذّر نشر الواجب في Microsoft Teams" });
      return;
    }

    const data = await r.json() as any;
    res.json({
      id: data.id,
      title: data.displayName,
      message: "تم نشر الواجب في Microsoft Teams بنجاح",
    });
  } catch (err: any) {
    req.log.error({ err }, "Teams assignment publish error");
    res.status(500).json({ message: "تعذّر نشر الواجب" });
  }
});

// ── GET /api/teams/classes/:classId/submissions ───────────────────────────
router.get("/teams/classes/:classId/submissions", async (req, res) => {
  const teacherId = (req.session as any).teacherId;
  if (!teacherId) { res.status(401).json({ message: "غير مسجل الدخول" }); return; }

  const token = await getAccessToken(teacherId);
  if (!token) { res.status(403).json({ message: "لم يتم ربط Microsoft Teams بعد" }); return; }

  const { assignmentId } = req.query as Record<string, string>;
  if (!assignmentId) { res.status(400).json({ message: "assignmentId مطلوب" }); return; }

  const { classId } = req.params;

  try {
    const r = await graph(
      `/education/classes/${classId}/assignments/${assignmentId}/submissions?$select=id,status,submittedDateTime,recipient`,
      token,
    );

    if (!r.ok) {
      res.status(500).json({ message: "تعذّر جلب بيانات التسليمات" });
      return;
    }

    const data = await r.json() as any;
    const submissions = (data.value || []).map((s: any) => ({
      id: s.id,
      status: s.status,
      submittedAt: s.submittedDateTime,
      studentId: s.recipient?.userId,
    }));

    res.json({ submissions });
  } catch (err: any) {
    req.log.error({ err }, "Teams submissions fetch error");
    res.status(500).json({ message: "تعذّر جلب التسليمات" });
  }
});

export default router;
