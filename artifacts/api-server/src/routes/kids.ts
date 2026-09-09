import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { evaluateKidsMastery, selectKidsAdventure, isKidsAvatarKeyForAgeBand, normalizeKidsAvatarAgeBand, defaultKidsAvatarAgeBand, type KidsActivity, type KidsAttempt } from "@workspace/api-zod";
import { randomInt } from "node:crypto";
import { evaluateClassroomRewardEvidence } from "../lib/classroom-reward-evaluator";

const router: IRouter = Router();
let kidsReady = false;
export const setKidsReady = (ready: boolean) => { kidsReady = ready; };
router.use(["/kids", "/teacher/kids"], (_req, res, next) => {
  if (kidsReady) return next();
  res.setHeader("Retry-After", "2");
  return res.status(503).json({ code: "KIDS_NOT_READY", message: "عالم حصاد الصغير قيد التجهيز" });
});
const id = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const key = (req: any) => typeof req.headers["idempotency-key"] === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(req.headers["idempotency-key"]) ? req.headers["idempotency-key"] : null;
const studentId = (req: any) => Number(req.session?.studentAccountId) || null;

export function kidsAdventureAttemptFromRow(row: any): KidsAttempt {
  return {
    activityId: String(row.content?.id ?? row.activity_id),
    activityType: row.activity_type,
    skillId: String(row.skill_id),
    exampleId: row.example_id,
    sessionId: String(row.session_id),
    completedAt: row.created_at,
    correctWeight: row.correct_weight,
    possibleWeight: row.possible_weight,
    errors: row.errors ?? [],
  };
}

export function isKidsCompletionEligible(input: {
  activityId: number;
  assignmentId?: number | null;
  dailyActivityIds?: unknown;
  dailyCompletedIds?: unknown;
}): boolean {
  if (input.assignmentId) return true;
  const activityIds = Array.isArray(input.dailyActivityIds) ? input.dailyActivityIds.map(Number) : [];
  const completedIds = Array.isArray(input.dailyCompletedIds) ? input.dailyCompletedIds.map(Number) : [];
  return activityIds.find((activityId) => !completedIds.includes(activityId)) === input.activityId;
}

type TracePoint = { x: number; y: number };
export function evaluateKidsTrace(
  submitted: readonly TracePoint[],
  authored: readonly TracePoint[],
  threshold = 0.8,
): boolean {
  if (submitted.length < 5 || authored.length < 2) return false;
  const sampledGuide: TracePoint[] = [];
  let guideLength = 0;
  for (let index = 1; index < authored.length; index++) {
    const from = authored[index - 1], to = authored[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    guideLength += length;
    const steps = Math.max(1, Math.ceil(length / 0.04));
    for (let step = 0; step <= steps; step++) {
      const ratio = step / steps;
      sampledGuide.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
    }
  }
  let submittedLength = 0;
  for (let index = 1; index < submitted.length; index++) {
    submittedLength += Math.hypot(submitted[index].x - submitted[index - 1].x, submitted[index].y - submitted[index - 1].y);
  }
  const nearestGuideIndexes = submitted.map((point) => {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    sampledGuide.forEach((guide, index) => {
      const distance = Math.hypot(point.x - guide.x, point.y - guide.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return { index: nearestIndex, distance: nearestDistance };
  });
  const covered = sampledGuide.filter((guide) =>
    submitted.some((point) => Math.hypot(point.x - guide.x, point.y - guide.y) <= 0.12)
  ).length / sampledGuide.length;
  const onPathRatio = nearestGuideIndexes.filter(({ distance }) => distance <= 0.12).length / nearestGuideIndexes.length;
  const startNearGuideStart = nearestGuideIndexes[0].index <= Math.max(2, sampledGuide.length * 0.18);
  let meaningfulMoves = 0;
  let backwardsMoves = 0;
  for (let index = 1; index < nearestGuideIndexes.length; index++) {
    const delta = nearestGuideIndexes[index].index - nearestGuideIndexes[index - 1].index;
    if (Math.abs(delta) < 2) continue;
    meaningfulMoves += 1;
    if (delta < 0) backwardsMoves += 1;
  }
  const followsDirection = meaningfulMoves === 0 || backwardsMoves / meaningfulMoves <= 0.2;
  return covered >= threshold
    && onPathRatio >= 0.65
    && startNearGuideStart
    && followsDirection
    && submittedLength >= guideLength * 0.65
    && submittedLength <= guideLength * 2.5;
}

async function profileFor(req: any) {
  const accountId = studentId(req);
  if (!accountId) return null;
  const result = await db.execute(sql`SELECT * FROM kids_profiles WHERE student_account_id = ${accountId} LIMIT 1`);
  return (result as any).rows[0] ?? null;
}
async function requireProfile(req: any, res: any) {
  const profile = await profileFor(req);
  if (!profile) { res.status(studentId(req) ? 404 : 401).json({ message: studentId(req) ? "أنشئ ملف الطفل أولاً" : "غير مصرح" }); return null; }
  return profile;
}
function teacher(req: any, res: any): number | null {
  const value = Number(req.session?.teacherId);
  if (!value) { res.status(401).json({ message: "غير مصرح" }); return null; }
  return value;
}
async function teacherOwnsProfile(teacherId: number, profileId: number) {
  const r = await db.execute(sql`
    SELECT 1 FROM kids_profiles kp JOIN students s ON s.student_account_id = kp.student_account_id
    WHERE kp.id = ${profileId} AND s.teacher_id = ${teacherId} LIMIT 1
  `);
  return (r as any).rows.length > 0;
}

async function canStartKidsActivity(profileId: number, activityId: number) {
  const assignment = await db.execute(sql`
    SELECT 1 FROM kids_teacher_assignments
    WHERE profile_id=${profileId} AND activity_id=${activityId} AND completed_at IS NULL
    LIMIT 1
  `);
  if ((assignment as any).rows[0]) return true;
  const day = new Date().toISOString().slice(0, 10);
  const dailyResult = await db.execute(sql`
    SELECT activity_ids,completed_ids
    FROM kids_daily_adventures
    WHERE profile_id=${profileId} AND adventure_date=${day}
  `);
  const daily = (dailyResult as any).rows[0];
  if (!daily) return false;
  const activityIds = Array.isArray(daily.activity_ids) ? daily.activity_ids.map(Number) : [];
  const completedIds = new Set(Array.isArray(daily.completed_ids) ? daily.completed_ids.map(Number) : []);
  return activityIds.find((candidate: number) => !completedIds.has(candidate)) === activityId;
}

router.get("/kids/profile", async (req: any, res) => {
  const accountId = studentId(req); if (!accountId) return res.status(401).json({ message: "غير مصرح" });
  const profile = await profileFor(req); res.json({ profile });
});
router.post("/kids/profile", async (req: any, res) => {
  const accountId = studentId(req); if (!accountId) return res.status(401).json({ message: "غير مصرح" });
  const name = String(req.body?.displayName ?? "").trim().slice(0, 60);
  const avatarKey = String(req.body?.avatarKey ?? "kids/avatars/star");
  const suppliedAgeBand = typeof req.body?.ageBand === "string" ? req.body.ageBand : defaultKidsAvatarAgeBand;
  const normalizedBand = normalizeKidsAvatarAgeBand(suppliedAgeBand) ?? defaultKidsAvatarAgeBand;
  const ageBand = normalizeKidsAvatarAgeBand(suppliedAgeBand) ? suppliedAgeBand : defaultKidsAvatarAgeBand;
  if (!name || !isKidsAvatarKeyForAgeBand(avatarKey, normalizedBand)) return res.status(400).json({ message: "بيانات ملف الطفل غير صالحة" });
  const r = await db.execute(sql`
    INSERT INTO kids_profiles (student_account_id, display_name, avatar_key, age_band, locale)
    VALUES (${accountId}, ${name}, ${avatarKey}, ${ageBand}, 'ar')
    ON CONFLICT (student_account_id) DO UPDATE SET display_name = EXCLUDED.display_name, avatar_key = EXCLUDED.avatar_key,
      age_band = EXCLUDED.age_band, updated_at = NOW() RETURNING *
  `);
  res.status(201).json({ profile: (r as any).rows[0] });
});
router.get("/kids/worlds", async (_req, res) => {
  const r = await db.execute(sql`SELECT id, slug, title_ar, title_en, description_ar, icon_key, sort_order FROM kids_worlds WHERE is_published = TRUE ORDER BY sort_order`);
  res.json({ worlds: (r as any).rows });
});
router.get("/kids/worlds/:slug", async (req, res) => {
  const r = await db.execute(sql`
    SELECT w.*, COALESCE(json_agg(json_build_object('id',s.id,'slug',s.slug,'titleAr',s.title_ar,'titleEn',s.title_en) ORDER BY s.sort_order)
      FILTER (WHERE s.id IS NOT NULL), '[]') skills
    FROM kids_worlds w LEFT JOIN kids_skills s ON s.world_id=w.id WHERE w.slug=${String(req.params.slug)} AND w.is_published=TRUE GROUP BY w.id
  `);
  const world = (r as any).rows[0]; if (!world) return res.status(404).json({ message: "العالم غير موجود" }); res.json({ world });
});
router.get("/kids/skills", async (req: any, res) => {
  const profile = await requireProfile(req, res); if (!profile) return;
  const r = await db.execute(sql`
    SELECT s.*, w.slug world_slug, COALESCE(m.mastery_percent,0) mastery_percent, COALESCE(m.attempt_count,0) attempt_count
    FROM kids_skills s JOIN kids_worlds w ON w.id=s.world_id LEFT JOIN kids_mastery m ON m.skill_id=s.id AND m.profile_id=${profile.id}
    WHERE w.is_published=TRUE ORDER BY w.sort_order,s.sort_order
  `); res.json({ skills: (r as any).rows });
});
router.get("/kids/home", async (req: any, res) => {
  const profile = await requireProfile(req, res); if (!profile) return;
  const r = await db.execute(sql`
    SELECT a.id,a.slug,a.title_ar,a.activity_type,a.asset_key,s.slug skill_slug,w.slug world_slug
    FROM kids_activities a JOIN kids_skills s ON s.id=a.skill_id JOIN kids_worlds w ON w.id=s.world_id
    WHERE a.is_published=TRUE ORDER BY w.sort_order,s.sort_order,a.sort_order LIMIT 1
  `);
  const state = await db.execute(sql`SELECT * FROM kids_adventure_states WHERE profile_id=${profile.id}`);
  const assignments = await db.execute(sql`SELECT ta.id,ta.due_at,a.id activity_id,a.slug,a.title_ar FROM kids_teacher_assignments ta JOIN kids_activities a ON a.id=ta.activity_id WHERE ta.profile_id=${profile.id} AND ta.completed_at IS NULL ORDER BY ta.due_at NULLS LAST,ta.created_at DESC`);
  res.json({ profile, nextActivity: (r as any).rows[0] ?? null, adventure: (state as any).rows[0] ?? { stars: 0, current_world_slug: "arabic-letters" }, assignments: (assignments as any).rows });
});
router.post("/kids/board/join", async (req: any, res) => {
  const profile = await requireProfile(req, res); if (!profile) return;
  const joinCode = String(req.body?.joinCode ?? "").trim();
  if (!/^\d{6}$/.test(joinCode)) return res.status(400).json({ message: "رمز اللوحة غير صالح" });
  const r = await db.execute(sql`
    SELECT b.id,b.title,b.join_code FROM kids_board_sessions b
    JOIN students s ON s.teacher_id=b.teacher_id
    WHERE b.join_code=${joinCode} AND b.status='open' AND s.student_account_id=${profile.student_account_id}
    LIMIT 1
  `);
  const board = (r as any).rows[0];
  if (!board) return res.status(404).json({ message: "اللوحة غير موجودة أو ليست لفصلك" });
  req.session.kidsBoardId = board.id;
  res.json({ board });
});
router.post("/kids/board/:id/events", async (req: any, res) => {
  const profile = await requireProfile(req, res); const boardId = id(req.params.id);
  if (!profile) return;
  const eventType = String(req.body?.eventType ?? "").trim();
  if (!boardId || Number(req.session?.kidsBoardId) !== boardId || !["joined", "ready", "completed"].includes(eventType)) {
    return res.status(403).json({ message: "انضم إلى اللوحة أولاً" });
  }
  const r = await db.execute(sql`
    INSERT INTO kids_board_events(board_session_id,profile_id,event_type,payload)
    SELECT b.id,${profile.id},${eventType},${JSON.stringify(req.body?.payload ?? {})}::jsonb
    FROM kids_board_sessions b JOIN students s ON s.teacher_id=b.teacher_id
    WHERE b.id=${boardId} AND b.status='open' AND s.student_account_id=${profile.student_account_id}
    RETURNING *
  `);
  const event = (r as any).rows[0];
  if (!event) return res.status(403).json({ message: "اللوحة مغلقة أو ليست لفصلك" });
  res.status(201).json({ event });
});
router.get("/kids/today-adventure", async (req: any, res) => {
  const profile = await requireProfile(req, res); if (!profile) return;
  const day = new Date().toISOString().slice(0, 10);
  let result = await db.execute(sql`SELECT * FROM kids_daily_adventures WHERE profile_id=${profile.id} AND adventure_date=${day}`);
  let adventure = (result as any).rows[0];
  if (!adventure) {
    const candidates = await db.execute(sql`
      SELECT a.id,a.content,COALESCE(m.mastery_percent,0) mastery_percent,
        CASE WHEN ta.id IS NULL THEN 0 ELSE 100 END assignment_need
      FROM kids_activities a JOIN kids_skills s ON s.id=a.skill_id
      LEFT JOIN kids_mastery m ON m.profile_id=${profile.id} AND m.skill_id=s.id
      LEFT JOIN kids_teacher_assignments ta ON ta.profile_id=${profile.id} AND ta.activity_id=a.id
      WHERE a.is_published=TRUE
    `);
    const evidence = await db.execute(sql`
      SELECT a.id activity_id,a.content,a.activity_type,a.skill_id,at.example_id,at.session_id,at.created_at,at.correct_weight,at.possible_weight,at.errors
      FROM kids_attempts at JOIN kids_activity_sessions ss ON ss.id=at.session_id JOIN kids_activities a ON a.id=ss.activity_id
      WHERE ss.profile_id=${profile.id} AND ss.status='completed'
    `);
    const attempts = (evidence as any).rows.map(kidsAdventureAttemptFromRow);
    const selected = selectKidsAdventure((candidates as any).rows.map((row: any) => ({
      activity: row.content, need: Math.max(Number(row.assignment_need), 100 - Number(row.mastery_percent)),
    })), attempts);
    const bySlug = new Map((candidates as any).rows.map((row: any) => [row.content.id, row.id]));
    const ids = selected.activities.map((activity: KidsActivity) => bySlug.get(activity.id)).filter((value: unknown): value is number => Number.isInteger(value));
    if (ids.length !== 3) return res.status(503).json({ message: "مغامرة اليوم غير جاهزة" });
    result = await db.execute(sql`INSERT INTO kids_daily_adventures(profile_id,adventure_date,activity_ids) VALUES(${profile.id},${day},${JSON.stringify(ids)}::jsonb) ON CONFLICT(profile_id,adventure_date) DO UPDATE SET adventure_date=EXCLUDED.adventure_date RETURNING *`);
    adventure = (result as any).rows[0];
  }
  const activities = await db.execute(sql`SELECT id,slug,title_ar,activity_type,asset_key FROM kids_activities WHERE id = ANY(SELECT jsonb_array_elements_text(${JSON.stringify(adventure.activity_ids)}::jsonb)::int)`);
  res.json({ adventure, activities: (activities as any).rows });
});
router.post("/kids/today-adventure/start", async (req: any, res) => {
  const profile = await requireProfile(req, res); if (!profile) return;
  const day = new Date().toISOString().slice(0, 10);
  const r = await db.execute(sql`UPDATE kids_daily_adventures SET started_at=COALESCE(started_at,NOW()) WHERE profile_id=${profile.id} AND adventure_date=${day} RETURNING *`);
  if (!(r as any).rows[0]) return res.status(409).json({ message: "اطلب مغامرة اليوم أولاً" });
  res.json({ adventure: (r as any).rows[0] });
});
router.get("/kids/activities/:id", async (req, res) => {
  const activityId = id(req.params.id); if (!activityId) return res.status(400).json({ message: "نشاط غير صالح" });
  const r = await db.execute(sql`SELECT id,slug,title_ar,activity_type,content,asset_key FROM kids_activities WHERE id=${activityId} AND is_published=TRUE`);
  const activity = (r as any).rows[0]; if (!activity) return res.status(404).json({ message: "النشاط غير موجود" }); res.json({ activity });
});
router.post("/kids/sessions", async (req: any, res) => {
  const profile = await requireProfile(req, res); const activityId = id(req.body?.activityId); const requestKey = key(req);
  if (!profile) return; if (!activityId || !requestKey) return res.status(400).json({ message: "النشاط ومفتاح التكرار مطلوبان" });
  if (!(await canStartKidsActivity(profile.id, activityId))) return res.status(403).json({ message: "أكمل النشاط الحالي أولاً" });
  try {
    const r = await db.execute(sql`INSERT INTO kids_activity_sessions (profile_id,activity_id,idempotency_key) SELECT ${profile.id},id,${requestKey} FROM kids_activities WHERE id=${activityId} AND is_published=TRUE ON CONFLICT (profile_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`);
    const session = (r as any).rows[0]; if (!session) return res.status(404).json({ message: "النشاط غير موجود" }); res.status(201).json({ session });
  } catch (error: any) {
    if (error?.cause?.code === "23505" || error?.code === "23505") return res.status(409).json({ message: "هناك جلسة نشطة لهذا النشاط" });
    throw error;
  }
});
router.post("/kids/sessions/:id/attempts", async (req: any, res) => {
  const profile = await requireProfile(req, res); const sessionId = id(req.params.id); const requestKey = key(req);
  const itemKey = String(req.body?.itemKey ?? "").trim().slice(0, 100);
  const answer = String(req.body?.answer ?? "").trim().slice(0, 200);
  const tracePoints = Array.isArray(req.body?.tracePoints)
    ? req.body.tracePoints.slice(0, 300).map((point: any) => ({ x: Number(point?.x), y: Number(point?.y) }))
    : [];
  const submittedExampleId = typeof req.body?.exampleId === "string" ? req.body.exampleId.trim().slice(0, 100) : null;
  if (!profile) return; if (!sessionId || !requestKey || !itemKey || !answer) return res.status(400).json({ message: "محاولة غير صالحة" });
  const catalogResult = await db.execute(sql`SELECT a.content,a.activity_type,s.status FROM kids_activity_sessions s JOIN kids_activities a ON a.id=s.activity_id WHERE s.id=${sessionId} AND s.profile_id=${profile.id}`);
  const catalog = (catalogResult as any).rows[0];
  if (!catalog) return res.status(404).json({ message: "الجلسة غير موجودة" });
  if (catalog.status !== "started") return res.status(409).json({ message: "الجلسة مكتملة ولا تقبل محاولات جديدة" });
  const exampleId = String(catalog.content?.exampleId ?? "").trim().slice(0, 100);
  if (!exampleId || (submittedExampleId && submittedExampleId !== exampleId)) {
    return res.status(400).json({ message: "مثال النشاط غير صالح" });
  }
  const items = Array.isArray(catalog.content?.items) ? catalog.content.items :
                Array.isArray(catalog.content?.pairs) ? catalog.content.pairs :
                Array.isArray(catalog.content?.strokes) ? catalog.content.strokes :
                Array.isArray(catalog.content?.choices) ? catalog.content.choices :
                Array.isArray(catalog.content?.pieces) ? catalog.content.pieces : [];
  const item = items.find((entry: any) => String(typeof entry === "object" ? (entry.id ?? entry.letter ?? entry.value) : entry) === itemKey);
  if (item === undefined) return res.status(400).json({ message: "عنصر النشاط غير صالح" });
  let correct = false;
  switch (catalog.content?.type) {
    case "matching":
      correct = answer === String(item.right);
      break;
    case "tracing":
      correct = tracePoints.length === Number(req.body?.tracePoints?.length)
        && tracePoints.every((point: TracePoint) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)
        && evaluateKidsTrace(tracePoints, item.points ?? [], Number(catalog.content.completionThreshold ?? 0.8));
      break;
    case "media_choice":
      correct = item.isCorrect === true && answer === String(item.id);
      break;
    case "counting":
      correct = answer === String(catalog.content.correctCount);
      break;
    case "ordering_puzzle":
      correct = answer === String(item.correctPosition);
      break;
  }
  const r = await db.execute(sql`
    INSERT INTO kids_attempts (session_id,idempotency_key,item_key,is_correct,response,activity_type,example_id,correct_weight,possible_weight,errors)
    SELECT s.id,${requestKey},${itemKey},${correct},${JSON.stringify({ answer })}::jsonb,${catalog.activity_type},${exampleId},
      CASE WHEN ${correct} THEN 1 ELSE 0 END,1,${JSON.stringify(correct ? [] : [catalog.content?.type === "tracing" ? "trace-below-threshold" : "incorrect-answer"])}::jsonb FROM kids_activity_sessions s WHERE s.id=${sessionId} AND s.profile_id=${profile.id} AND s.status='started'
    ON CONFLICT (session_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *
  `); const attempt = (r as any).rows[0]; if (!attempt) return res.status(404).json({ message: "الجلسة غير موجودة" }); res.status(201).json({ attempt });
});
router.post("/kids/sessions/:id/complete", async (req: any, res) => {
  const profile = await requireProfile(req, res); const sessionId = id(req.params.id);
  if (!profile) return; if (!sessionId) return res.status(400).json({ message: "جلسة غير صالحة" });
  const outcome = await db.transaction(async (tx) => {
  const evidence = await tx.execute(sql`SELECT s.activity_id,s.status,s.score,a.skill_id,a.activity_type,a.content,at.item_key,at.example_id,at.created_at,at.correct_weight,at.possible_weight,at.errors FROM kids_activity_sessions s JOIN kids_activities a ON a.id=s.activity_id LEFT JOIN kids_attempts at ON at.session_id=s.id WHERE s.id=${sessionId} AND s.profile_id=${profile.id} FOR UPDATE OF s`);
  const rows = (evidence as any).rows; if (!rows.length) return { missing: true };
  if (rows[0].status === "completed") return { replayed: true, session: { activity_id: rows[0].activity_id, status: rows[0].status, score: rows[0].score } };
  if (rows[0].status !== "started") return { ineligible: true };
  const attempts = rows.filter((row: any) => row.item_key).map((row: any): KidsAttempt => ({ activityId: String(row.activity_id), activityType: row.activity_type as any, skillId: String(row.skill_id), exampleId: row.example_id || row.item_key, sessionId: String(sessionId), completedAt: row.created_at, correctWeight: row.correct_weight, possibleWeight: row.possible_weight, errors: row.errors ?? [] }));
  const content = rows[0].content ?? {};
  const requiredItems = Array.isArray(content.items) ? content.items :
    Array.isArray(content.pairs) ? content.pairs :
    Array.isArray(content.strokes) ? content.strokes :
    Array.isArray(content.choices) ? content.choices :
    Array.isArray(content.pieces) ? content.pieces : [];
  const requiredKeys = new Set(requiredItems.map((item: any) => String(item.id ?? item.letter ?? item.value)));
  const attemptedKeys = new Set(rows.filter((row: any) => row.item_key).map((row: any) => String(row.item_key)));
  const requiresEveryItem = ["matching", "tracing", "ordering_puzzle"].includes(content.type);
  if (
    requiredKeys.size === 0 ||
    (requiresEveryItem
      ? [...requiredKeys].some((itemKey) => !attemptedKeys.has(itemKey))
      : attemptedKeys.size === 0)
  ) return { incomplete: true };
  const activityId = Number(rows[0].activity_id);
  const assignmentResult = await tx.execute(sql`
    SELECT id FROM kids_teacher_assignments
    WHERE profile_id=${profile.id} AND activity_id=${activityId} AND completed_at IS NULL
    ORDER BY id LIMIT 1 FOR UPDATE
  `);
  const assignment = (assignmentResult as any).rows[0];
  const today = new Date().toISOString().slice(0, 10);
  const dailyResult = await tx.execute(sql`
    SELECT id,activity_ids,completed_ids FROM kids_daily_adventures
    WHERE profile_id=${profile.id} AND adventure_date=${today}
    FOR UPDATE
  `);
  const daily = (dailyResult as any).rows[0];
  if (!isKidsCompletionEligible({
    activityId,
    assignmentId: assignment?.id,
    dailyActivityIds: daily?.activity_ids,
    dailyCompletedIds: daily?.completed_ids,
  })) return { ineligible: true };
  const possible = attempts.reduce((n: number, attempt: KidsAttempt) => n + attempt.possibleWeight, 0);
  const score = possible ? Math.round(100 * attempts.reduce((n: number, attempt: KidsAttempt) => n + attempt.correctWeight, 0) / possible) : 0;
  const sessionResult = await tx.execute(sql`UPDATE kids_activity_sessions SET status='completed',score=${score},completed_at=COALESCE(completed_at,NOW()) WHERE id=${sessionId} AND profile_id=${profile.id} AND status <> 'completed' RETURNING activity_id,status`);
  const session = (sessionResult as any).rows[0];
  if (!session) { const prior = await tx.execute(sql`SELECT activity_id,status,score FROM kids_activity_sessions WHERE id=${sessionId} AND profile_id=${profile.id}`); const existing=(prior as any).rows[0]; return existing?.status === "completed" ? { replayed: true, session: existing } : { missing: true }; }
  const masteryEvidence = await tx.execute(sql`SELECT a.id activity_id,a.activity_type,a.skill_id,at.example_id,at.created_at,at.correct_weight,at.possible_weight,at.errors,at.session_id FROM kids_attempts at JOIN kids_activity_sessions ss ON ss.id=at.session_id JOIN kids_activities a ON a.id=ss.activity_id WHERE ss.profile_id=${profile.id} AND ss.status='completed' AND a.skill_id=${rows[0].skill_id}`);
  const all = (masteryEvidence as any).rows.map((row: any): KidsAttempt => ({ activityId:String(row.activity_id),activityType:row.activity_type as any,skillId:String(row.skill_id),exampleId:row.example_id,sessionId:String(row.session_id),completedAt:row.created_at,correctWeight:row.correct_weight,possibleWeight:row.possible_weight,errors:row.errors ?? [] }));
  const result = evaluateKidsMastery(String(rows[0].skill_id), all);
  const correctCount = all.reduce((n: number, a: KidsAttempt) => n + a.correctWeight, 0), attemptCount = all.length, percent = Math.round(result.weightedAccuracy * 100);
  const mastery = await tx.execute(sql`
    INSERT INTO kids_mastery (profile_id,skill_id,correct_count,attempt_count,mastery_percent,state,review_due_at)
    VALUES (${profile.id},${rows[0].skill_id},${correctCount},${attemptCount},${percent},${result.state},CASE WHEN ${result.state}='mastered' THEN NOW()+INTERVAL '7 days' ELSE NOW()+INTERVAL '1 day' END)
    ON CONFLICT (profile_id,skill_id) DO UPDATE SET correct_count=EXCLUDED.correct_count,attempt_count=EXCLUDED.attempt_count,mastery_percent=EXCLUDED.mastery_percent,state=EXCLUDED.state,review_due_at=EXCLUDED.review_due_at,updated_at=NOW() RETURNING *
  `);
  const rewardGrant = await tx.execute(sql`INSERT INTO kids_reward_grants(profile_id,session_id,reward_key) SELECT ${profile.id},${sessionId},'kids/stickers/completion-star' WHERE ${score} >= 70 ON CONFLICT(session_id) DO NOTHING RETURNING id`);
  const rewarded = Boolean((rewardGrant as any).rows[0]);
  if (rewarded) await tx.execute(sql`INSERT INTO kids_adventure_states(profile_id,stars) VALUES(${profile.id},1) ON CONFLICT(profile_id) DO UPDATE SET stars=kids_adventure_states.stars+1,updated_at=NOW()`);
  if (assignment) await tx.execute(sql`UPDATE kids_teacher_assignments SET completed_at=NOW() WHERE id=${assignment.id} AND completed_at IS NULL`);
  if (daily && isKidsCompletionEligible({ activityId, dailyActivityIds: daily.activity_ids, dailyCompletedIds: daily.completed_ids })) {
    const completedIds = Array.isArray(daily.completed_ids)
      ? daily.completed_ids.map(Number).filter(Number.isInteger)
      : [];
    if (!completedIds.includes(activityId)) completedIds.push(activityId);
    await tx.execute(sql`
      UPDATE kids_daily_adventures
      SET completed_ids=${JSON.stringify(completedIds)}::jsonb,
          completed_at=CASE WHEN ${completedIds.length >= 3} THEN COALESCE(completed_at,NOW()) ELSE completed_at END
      WHERE id=${daily.id}
    `);
  }
  // Classroom rewards are intentionally separate from stars. A kids profile is
  // eligible only if its account maps to exactly one student owned by a teacher.
  const linked = await tx.execute(sql`
    SELECT st.teacher_id,st.id student_id FROM students st
    WHERE st.student_account_id=${profile.student_account_id}
  `);
  const linkedRows=(linked as any)?.rows ?? [];
  if (linkedRows.length === 1) await evaluateClassroomRewardEvidence(tx, {
    teacherId:Number(linkedRows[0].teacher_id), sourceType:"kids_activity_completion",
    sourceResultId:sessionId, studentId:Number(linkedRows[0].student_id), completed:true, score:Number(score),
    evidenceSummary: { score, activityId },
  });
  return { session, mastery: (mastery as any).rows[0], score, reward: rewarded ? "kids/stickers/completion-star" : null };
  });
  if (outcome.missing) return res.status(404).json({ message: "الجلسة غير موجودة" });
  if (outcome.incomplete) return res.status(409).json({ message: "أكمل عناصر النشاط أولاً" });
  if (outcome.ineligible) return res.status(409).json({ message: "تم إكمال هذا النشاط أو لم يعد متاحاً" });
  if (outcome.replayed) return res.json({ session: outcome.session, score: outcome.session.score, replayed: true });
  res.json(outcome);
});
router.get("/kids/mastery", async (req: any, res) => { const p=await requireProfile(req,res); if (!p)return; const r=await db.execute(sql`SELECT * FROM kids_mastery WHERE profile_id=${p.id}`); res.json({ mastery:(r as any).rows }); });
router.get("/kids/adventure", async (req: any, res) => { const p=await requireProfile(req,res); if (!p)return; const r=await db.execute(sql`SELECT * FROM kids_adventure_states WHERE profile_id=${p.id}`); res.json({ adventure:(r as any).rows[0]??{stars:0,current_world_slug:"arabic-letters"} }); });

router.get("/teacher/kids/profiles", async (req: any, res) => { const t=teacher(req,res); if(!t)return; const r=await db.execute(sql`SELECT kp.* FROM kids_profiles kp JOIN students s ON s.student_account_id=kp.student_account_id WHERE s.teacher_id=${t} ORDER BY kp.display_name`); res.json({ profiles:(r as any).rows }); });
router.get("/teacher/kids/activities", async (req: any, res) => {
  const t = teacher(req, res); if (!t) return;
  const r = await db.execute(sql`SELECT a.id,a.slug,a.title_ar,a.activity_type,a.asset_key,s.slug skill_slug,w.slug world_slug FROM kids_activities a JOIN kids_skills s ON s.id=a.skill_id JOIN kids_worlds w ON w.id=s.world_id WHERE a.is_published=TRUE ORDER BY w.sort_order,s.sort_order,a.sort_order`);
  res.json({ activities: (r as any).rows });
});
router.get("/teacher/kids/board", async (req: any, res) => { const t=teacher(req,res); if(!t)return; const r=await db.execute(sql`SELECT kp.id,kp.display_name,kp.avatar_key,kp.age_band,COALESCE(ROUND(AVG(km.mastery_percent)),0)::int mastery_total,COALESCE(MAX(kas.stars),0)::int stars FROM kids_profiles kp JOIN students s ON s.student_account_id=kp.student_account_id LEFT JOIN kids_mastery km ON km.profile_id=kp.id LEFT JOIN kids_adventure_states kas ON kas.profile_id=kp.id WHERE s.teacher_id=${t} GROUP BY kp.id ORDER BY kp.display_name`); res.json({ board:(r as any).rows }); });
router.get("/teacher/kids/assignments", async (req: any,res)=>{const t=teacher(req,res);if(!t)return;const r=await db.execute(sql`SELECT ka.*,kp.display_name,a.title_ar FROM kids_teacher_assignments ka JOIN kids_profiles kp ON kp.id=ka.profile_id JOIN kids_activities a ON a.id=ka.activity_id WHERE ka.teacher_id=${t} ORDER BY ka.created_at DESC`);res.json({assignments:(r as any).rows});});
router.post("/teacher/kids/assignments", async (req: any,res)=>{const t=teacher(req,res);const profileId=id(req.body?.profileId),activityId=id(req.body?.activityId);if(!t)return;if(!profileId||!activityId||!(await teacherOwnsProfile(t,profileId)))return res.status(403).json({message:"غير مصرح"});const r=await db.execute(sql`INSERT INTO kids_teacher_assignments(teacher_id,profile_id,activity_id,due_at) SELECT ${t},${profileId},id,${req.body?.dueAt?new Date(req.body.dueAt):null} FROM kids_activities WHERE id=${activityId} AND is_published=TRUE ON CONFLICT(teacher_id,profile_id,activity_id) DO UPDATE SET due_at=EXCLUDED.due_at,completed_at=NULL,created_at=NOW() RETURNING *`);const assignment=(r as any).rows[0];if(!assignment)return res.status(404).json({message:"النشاط غير موجود"});res.status(201).json({assignment});});
router.get("/teacher/kids/progress/:profileId", async (req:any,res)=>{const t=teacher(req,res),p=id(req.params.profileId);if(!t)return;if(!p||!(await teacherOwnsProfile(t,p)))return res.status(403).json({message:"غير مصرح"});const r=await db.execute(sql`SELECT km.*,ks.title_ar,kw.title_ar world_title FROM kids_mastery km JOIN kids_skills ks ON ks.id=km.skill_id JOIN kids_worlds kw ON kw.id=ks.world_id WHERE km.profile_id=${p}`);res.json({progress:(r as any).rows});});
router.post("/teacher/kids/board", async (req:any,res)=>{const t=teacher(req,res);const title=String(req.body?.title??"لوحة حصاد للأطفال").trim().slice(0,100);if(!t)return;if(!title)return res.status(400).json({message:"العنوان مطلوب"});for(let attempt=0;attempt<5;attempt++){const joinCode=String(randomInt(100000,1000000));try{const r=await db.execute(sql`INSERT INTO kids_board_sessions(teacher_id,title,join_code) VALUES(${t},${title},${joinCode}) RETURNING *`);return res.status(201).json({board:(r as any).rows[0]});}catch(error:any){if(error?.cause?.code!=="23505"&&error?.code!=="23505")throw error;}}return res.status(503).json({message:"تعذر إنشاء رمز لوحة فريد"});});
router.post("/teacher/kids/board/:id/events", async (req:any,res)=>{const t=teacher(req,res),boardId=id(req.params.id),profileId=req.body?.profileId===undefined?null:id(req.body.profileId),eventType=String(req.body?.eventType??"").trim().slice(0,50);if(!t)return;if(!boardId||!eventType)return res.status(400).json({message:"حدث غير صالح"});if(profileId&&!(await teacherOwnsProfile(t,profileId)))return res.status(403).json({message:"غير مصرح"});const r=await db.execute(sql`INSERT INTO kids_board_events(board_session_id,profile_id,event_type,payload) SELECT id,${profileId},${eventType},${JSON.stringify(req.body?.payload??{})}::jsonb FROM kids_board_sessions WHERE id=${boardId} AND teacher_id=${t} AND status='open' RETURNING *`);if(!(r as any).rows[0])return res.status(404).json({message:"اللوحة غير موجودة"});res.status(201).json({event:(r as any).rows[0]});});
router.get("/teacher/kids/board/:id/results", async (req:any,res)=>{const t=teacher(req,res),boardId=id(req.params.id);if(!t)return;if(!boardId)return res.status(400).json({message:"لوحة غير صالحة"});const r=await db.execute(sql`SELECT e.*,kp.display_name FROM kids_board_events e JOIN kids_board_sessions b ON b.id=e.board_session_id LEFT JOIN kids_profiles kp ON kp.id=e.profile_id WHERE e.board_session_id=${boardId} AND b.teacher_id=${t} ORDER BY e.created_at`);res.json({events:(r as any).rows});});

const motivationCategories = new Set(["motivation_balance", "teacher_awards", "badge_count"]);
const rewardStatuses = new Set(["active", "inactive", "archived"]);
async function motivationForProfile(profileId: number) {
  await db.execute(sql`INSERT INTO student_motivation_profiles(profile_id) VALUES(${profileId}) ON CONFLICT(profile_id) DO NOTHING`);
  const r = await db.execute(sql`SELECT * FROM student_motivation_profiles WHERE profile_id=${profileId}`);
  return (r as any).rows[0];
}
async function badgeRuleSatisfied(tx: any, profileId: number, definition: any) {
  if (definition.rule_category === "motivation_balance") {
    const r = await tx.execute(sql`SELECT balance FROM student_motivation_profiles WHERE profile_id=${profileId}`);
    return Number((r as any).rows[0]?.balance ?? 0) >= Number(definition.threshold);
  }
  if (definition.rule_category === "teacher_awards") {
    const r = await tx.execute(sql`SELECT COALESCE(SUM(amount),0)::int value FROM student_motivation_ledger l JOIN student_motivation_profiles m ON m.id=l.motivation_profile_id WHERE m.profile_id=${profileId} AND l.category='teacher_award'`);
    return Number((r as any).rows[0]?.value ?? 0) >= Number(definition.threshold);
  }
  const r = await tx.execute(sql`SELECT COUNT(*)::int value FROM motivation_badge_grants WHERE profile_id=${profileId}`);
  return Number((r as any).rows[0]?.value ?? 0) >= Number(definition.threshold);
}

router.get("/kids/motivation", async (req:any,res)=>{const p=await requireProfile(req,res);if(!p)return;const m=await motivationForProfile(p.id);const [ledger,badges]=await Promise.all([
  db.execute(sql`SELECT id,amount,category,reference_type,reference_id,created_at FROM student_motivation_ledger WHERE motivation_profile_id=${m.id} ORDER BY id DESC`),
  db.execute(sql`SELECT g.id,g.granted_at,d.title,d.description,d.icon_key FROM motivation_badge_grants g JOIN motivation_badge_definitions d ON d.id=g.badge_definition_id WHERE g.profile_id=${p.id} ORDER BY g.granted_at DESC`)
]);res.json({balance:m.balance,history:(ledger as any).rows,badges:(badges as any).rows});});
router.get("/kids/motivation/rewards", async (req:any,res)=>{const p=await requireProfile(req,res);if(!p)return;const r=await db.execute(sql`SELECT r.id,r.title,r.description,r.cost,r.availability,r.status,r.created_at,r.updated_at FROM motivation_rewards r JOIN students s ON s.teacher_id=r.teacher_id WHERE s.student_account_id=${p.student_account_id} AND r.status='active' AND (r.availability IS NULL OR r.availability>0) ORDER BY r.created_at DESC`);res.json({rewards:(r as any).rows});});
router.get("/kids/motivation/redemptions",async(req:any,res)=>{const p=await requireProfile(req,res);if(!p)return;const r=await db.execute(sql`SELECT x.*,r.title reward_title,r.cost FROM motivation_redemptions x JOIN motivation_rewards r ON r.id=x.reward_id WHERE x.profile_id=${p.id} ORDER BY x.requested_at DESC`);res.json({redemptions:(r as any).rows});});
router.post("/kids/motivation/redemptions", async (req:any,res)=>{const p=await requireProfile(req,res);const rewardId=id(req.body?.rewardId),requestKey=key(req);if(!p)return;if(!rewardId||!requestKey)return res.status(400).json({message:"المكافأة ومفتاح التكرار مطلوبان"});const prior=await db.execute(sql`SELECT * FROM motivation_redemptions WHERE profile_id=${p.id} AND request_key=${requestKey}`);const existing=(prior as any).rows[0];if(existing){if(Number(existing.reward_id)!==rewardId)return res.status(409).json({message:"مفتاح التكرار مستخدم لمكافأة أخرى"});return res.json({redemption:existing,replayed:true});}const r=await db.execute(sql`INSERT INTO motivation_redemptions(profile_id,reward_id,request_key) SELECT ${p.id},r.id,${requestKey} FROM motivation_rewards r JOIN students s ON s.teacher_id=r.teacher_id WHERE r.id=${rewardId} AND s.student_account_id=${p.student_account_id} AND r.status='active' AND (r.availability IS NULL OR r.availability>0) ON CONFLICT(profile_id,request_key) DO NOTHING RETURNING *`);const redemption=(r as any).rows[0];if(!redemption){const replay=await db.execute(sql`SELECT * FROM motivation_redemptions WHERE profile_id=${p.id} AND request_key=${requestKey}`);const row=(replay as any).rows[0];if(row&&Number(row.reward_id)===rewardId)return res.json({redemption:row,replayed:true});return res.status(409).json({message:"مفتاح التكرار مستخدم لمكافأة أخرى"});}res.status(201).json({redemption});});

router.get("/teacher/kids/motivation/badges",async(req:any,res)=>{const t=teacher(req,res);if(!t)return;const r=await db.execute(sql`SELECT * FROM motivation_badge_definitions WHERE teacher_id=${t} ORDER BY created_at DESC`);res.json({badges:(r as any).rows});});
router.post("/teacher/kids/motivation/badges",async(req:any,res)=>{const t=teacher(req,res);if(!t)return;const title=String(req.body?.title??"").trim().slice(0,80),description=String(req.body?.description??"").trim().slice(0,240),iconKey=String(req.body?.iconKey??req.body?.icon_key??"motivation/badges/star").trim().slice(0,100),category=String(req.body?.ruleCategory??req.body?.rule_category??""),threshold=Number(req.body?.threshold);if(!title||!motivationCategories.has(category)||!Number.isSafeInteger(threshold)||threshold<1)return res.status(400).json({message:"قاعدة الشارة غير صالحة"});const r=await db.execute(sql`INSERT INTO motivation_badge_definitions(teacher_id,title,description,icon_key,rule_category,threshold) VALUES(${t},${title},${description},${iconKey},${category},${threshold}) RETURNING *`);res.status(201).json({badge:(r as any).rows[0]});});
router.patch("/teacher/kids/motivation/badges/:id",async(req:any,res)=>{const t=teacher(req,res),badgeId=id(req.params.id);if(!t)return;if(!badgeId)return res.status(400).json({message:"شارة غير صالحة"});const active=typeof req.body?.isActive==="boolean"?req.body.isActive:null;if(active===null)return res.status(400).json({message:"الحالة مطلوبة"});const r=await db.execute(sql`UPDATE motivation_badge_definitions SET is_active=${active} WHERE id=${badgeId} AND teacher_id=${t} RETURNING *`);if(!(r as any).rows[0])return res.status(404).json({message:"الشارة غير موجودة"});res.json({badge:(r as any).rows[0]});});
router.post("/teacher/kids/motivation/badges/:id/grants",async(req:any,res)=>{const t=teacher(req,res),badgeId=id(req.params.id),profileId=id(req.body?.profileId);if(!t)return;if(!badgeId||!profileId||!(await teacherOwnsProfile(t,profileId)))return res.status(403).json({message:"غير مصرح"});const outcome=await db.transaction(async(tx:any)=>{await tx.execute(sql`INSERT INTO student_motivation_profiles(profile_id) VALUES(${profileId}) ON CONFLICT(profile_id) DO NOTHING`);const d=await tx.execute(sql`SELECT * FROM motivation_badge_definitions WHERE id=${badgeId} AND teacher_id=${t} AND is_active=TRUE FOR UPDATE`);const definition=(d as any).rows[0];if(!definition)return {missing:true};if(!(await badgeRuleSatisfied(tx,profileId,definition)))return {ineligible:true};const r=await tx.execute(sql`INSERT INTO motivation_badge_grants(badge_definition_id,profile_id,granted_by_teacher_id) VALUES(${badgeId},${profileId},${t}) ON CONFLICT(badge_definition_id,profile_id) DO NOTHING RETURNING *`);return {grant:(r as any).rows[0],duplicate:!(r as any).rows[0]};});if(outcome.missing)return res.status(404).json({message:"الشارة غير موجودة"});if(outcome.ineligible)return res.status(409).json({message:"عتبة الشارة لم تتحقق"});res.status(outcome.duplicate?200:201).json(outcome);});

router.get("/teacher/kids/motivation/rewards",async(req:any,res)=>{const t=teacher(req,res);if(!t)return;const r=await db.execute(sql`SELECT * FROM motivation_rewards WHERE teacher_id=${t} ORDER BY created_at DESC`);res.json({rewards:(r as any).rows});});
router.post("/teacher/kids/motivation/rewards",async(req:any,res)=>{const t=teacher(req,res);if(!t)return;const title=String(req.body?.title??"").trim().slice(0,100),description=String(req.body?.description??"").trim().slice(0,300),cost=Number(req.body?.cost),availability=req.body?.availability===null||req.body?.availability===undefined?null:Number(req.body.availability);if(!title||!Number.isSafeInteger(cost)||cost<1||(availability!==null&&(!Number.isSafeInteger(availability)||availability<0)))return res.status(400).json({message:"بيانات المكافأة غير صالحة"});const r=await db.execute(sql`INSERT INTO motivation_rewards(teacher_id,title,description,cost,availability) VALUES(${t},${title},${description},${cost},${availability}) RETURNING *`);res.status(201).json({reward:(r as any).rows[0]});});
router.patch("/teacher/kids/motivation/rewards/:id",async(req:any,res)=>{const t=teacher(req,res),rewardId=id(req.params.id),status=String(req.body?.status??"");if(!t)return;if(!rewardId||!rewardStatuses.has(status))return res.status(400).json({message:"حالة المكافأة غير صالحة"});const r=await db.execute(sql`UPDATE motivation_rewards SET status=${status},updated_at=NOW() WHERE id=${rewardId} AND teacher_id=${t} RETURNING *`);if(!(r as any).rows[0])return res.status(404).json({message:"المكافأة غير موجودة"});res.json({reward:(r as any).rows[0]});});
router.post("/teacher/kids/motivation/profiles/:id/awards",async(req:any,res)=>{const t=teacher(req,res),profileId=id(req.params.id),amount=Number(req.body?.amount),requestKey=key(req);if(!t)return;if(!profileId||!requestKey||!Number.isSafeInteger(amount)||amount<1||!(await teacherOwnsProfile(t,profileId)))return res.status(400).json({message:"منح التحفيز غير صالح"});const outcome=await db.transaction(async(tx:any)=>{await tx.execute(sql`INSERT INTO student_motivation_profiles(profile_id) VALUES(${profileId}) ON CONFLICT(profile_id) DO NOTHING`);const m=await tx.execute(sql`SELECT * FROM student_motivation_profiles WHERE profile_id=${profileId} FOR UPDATE`);const existing=await tx.execute(sql`SELECT * FROM student_motivation_ledger WHERE idempotency_key=${`award:${t}:${requestKey}`}`);if((existing as any).rows[0])return {replayed:true,ledger:(existing as any).rows[0],balance:(m as any).rows[0].balance};const l=await tx.execute(sql`INSERT INTO student_motivation_ledger(motivation_profile_id,amount,category,reference_type,idempotency_key,created_by_teacher_id) VALUES(${(m as any).rows[0].id},${amount},'teacher_award','teacher_award',${`award:${t}:${requestKey}`},${t}) RETURNING *`);const updated=await tx.execute(sql`UPDATE student_motivation_profiles SET balance=balance+${amount},updated_at=NOW() WHERE id=${(m as any).rows[0].id} RETURNING balance`);return {ledger:(l as any).rows[0],balance:(updated as any).rows[0].balance};});res.status(outcome.replayed?200:201).json(outcome);});
router.get("/teacher/kids/motivation/redemptions",async(req:any,res)=>{const t=teacher(req,res);if(!t)return;const r=await db.execute(sql`SELECT x.*,r.title reward_title,r.cost,kp.display_name FROM motivation_redemptions x JOIN motivation_rewards r ON r.id=x.reward_id JOIN kids_profiles kp ON kp.id=x.profile_id JOIN students s ON s.student_account_id=kp.student_account_id WHERE r.teacher_id=${t} AND s.teacher_id=${t} ORDER BY x.requested_at DESC`);res.json({redemptions:(r as any).rows});});
router.get("/teacher/kids/motivation/profiles/:id/badges",async(req:any,res)=>{const t=teacher(req,res),profileId=id(req.params.id);if(!t)return;if(!profileId||!(await teacherOwnsProfile(t,profileId)))return res.status(403).json({message:"غير مصرح"});const r=await db.execute(sql`SELECT g.*,d.title,d.description,d.icon_key FROM motivation_badge_grants g JOIN motivation_badge_definitions d ON d.id=g.badge_definition_id WHERE g.profile_id=${profileId} AND d.teacher_id=${t} ORDER BY g.granted_at DESC`);res.json({badges:(r as any).rows});});
router.put("/teacher/kids/profile/:id/avatar",async(req:any,res)=>{const t=teacher(req,res),profileId=id(req.params.id),avatarKey=String(req.body?.avatarKey??"");if(!t)return;if(!profileId||!(await teacherOwnsProfile(t,profileId)))return res.status(403).json({message:"غير مصرح"});const current=await db.execute(sql`SELECT age_band FROM kids_profiles WHERE id=${profileId}`);const ageBand=(current as any).rows[0]?.age_band;if(!isKidsAvatarKeyForAgeBand(avatarKey,ageBand))return res.status(400).json({message:"الأفاتار غير مناسب للفئة العمرية"});const r=await db.execute(sql`UPDATE kids_profiles SET avatar_key=${avatarKey},updated_at=NOW() WHERE id=${profileId} RETURNING *`);res.json({profile:(r as any).rows[0]});});
router.post("/teacher/kids/motivation/redemptions/:id/:action",async(req:any,res)=>{const t=teacher(req,res),redemptionId=id(req.params.id),action=String(req.params.action);if(!t)return;if(!redemptionId||!["approve","reject","deliver","cancel"].includes(action))return res.status(400).json({message:"إجراء الاستبدال غير صالح"});const outcome=await db.transaction(async(tx:any)=>{const found=await tx.execute(sql`SELECT x.*,r.cost,r.availability,r.status reward_status,r.teacher_id FROM motivation_redemptions x JOIN motivation_rewards r ON r.id=x.reward_id JOIN kids_profiles kp ON kp.id=x.profile_id JOIN students s ON s.student_account_id=kp.student_account_id WHERE x.id=${redemptionId} AND r.teacher_id=${t} AND s.teacher_id=${t} FOR UPDATE OF x,r`);const x=(found as any).rows[0];if(!x)return {missing:true};if(action==="reject"){if(x.status==="rejected")return {redemption:x,replayed:true};if(x.status!=="requested")return {invalid:true};const r=await tx.execute(sql`UPDATE motivation_redemptions SET status='rejected',decided_at=NOW(),decided_by_teacher_id=${t} WHERE id=${x.id} RETURNING *`);return {redemption:(r as any).rows[0]};}if(action==="deliver"){if(x.status==="delivered")return {redemption:x,replayed:true};if(x.status!=="approved")return {invalid:true};const r=await tx.execute(sql`UPDATE motivation_redemptions SET status='delivered',delivered_at=NOW() WHERE id=${x.id} RETURNING *`);return {redemption:(r as any).rows[0]};}await tx.execute(sql`INSERT INTO student_motivation_profiles(profile_id) VALUES(${x.profile_id}) ON CONFLICT(profile_id) DO NOTHING`);const mp=await tx.execute(sql`SELECT * FROM student_motivation_profiles WHERE profile_id=${x.profile_id} FOR UPDATE`);const m=(mp as any).rows[0];if(action==="approve"){if(x.status==="approved"||x.status==="delivered")return {redemption:x,replayed:true,balance:m.balance};if(x.status!=="requested"||x.reward_status!=="active"||(x.availability!==null&&Number(x.availability)<1))return {invalid:true};const debit=await tx.execute(sql`UPDATE student_motivation_profiles SET balance=balance-${x.cost},updated_at=NOW() WHERE id=${m.id} AND balance>=${x.cost} RETURNING balance`);if(!(debit as any).rows[0])return {insufficient:true};if(x.availability!==null)await tx.execute(sql`UPDATE motivation_rewards SET availability=availability-1,updated_at=NOW() WHERE id=${x.reward_id}`);await tx.execute(sql`INSERT INTO student_motivation_ledger(motivation_profile_id,amount,category,reference_type,reference_id,idempotency_key,created_by_teacher_id) VALUES(${m.id},${-Number(x.cost)},'redemption_spend','redemption',${x.id},${`redemption:approve:${x.id}`},${t}) ON CONFLICT(idempotency_key) DO NOTHING`);const r=await tx.execute(sql`UPDATE motivation_redemptions SET status='approved',decided_at=NOW(),decided_by_teacher_id=${t} WHERE id=${x.id} RETURNING *`);return {redemption:(r as any).rows[0],balance:(debit as any).rows[0].balance};}if(x.status==="cancelled")return {redemption:x,replayed:true,balance:m.balance};if(x.status!=="approved")return {invalid:true};const credit=await tx.execute(sql`UPDATE student_motivation_profiles SET balance=balance+${x.cost},updated_at=NOW() WHERE id=${m.id} RETURNING balance`);if(x.availability!==null)await tx.execute(sql`UPDATE motivation_rewards SET availability=availability+1,updated_at=NOW() WHERE id=${x.reward_id}`);await tx.execute(sql`INSERT INTO student_motivation_ledger(motivation_profile_id,amount,category,reference_type,reference_id,idempotency_key,created_by_teacher_id) VALUES(${m.id},${x.cost},'redemption_reversal','redemption',${x.id},${`redemption:cancel:${x.id}`},${t}) ON CONFLICT(idempotency_key) DO NOTHING`);const r=await tx.execute(sql`UPDATE motivation_redemptions SET status='cancelled',cancelled_at=NOW() WHERE id=${x.id} RETURNING *`);return {redemption:(r as any).rows[0],balance:(credit as any).rows[0].balance};});if(outcome.missing)return res.status(404).json({message:"طلب الاستبدال غير موجود"});if(outcome.insufficient)return res.status(409).json({message:"رصيد التحفيز غير كاف"});if(outcome.invalid)return res.status(409).json({message:"لا يمكن تنفيذ هذا الإجراء"});res.json(outcome);});

export default router;