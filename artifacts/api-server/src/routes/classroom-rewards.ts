import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import { classroomRewardFingerprint, classroomRewardReversalKey } from "../lib/classroom-reward-fingerprint";
import { evaluateClassroomRewardEvidence } from "../lib/classroom-reward-evaluator";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();
const ICONS = new Set(["Star", "Heart", "ThumbsUp", "Zap", "Trophy", "Target", "Shield", "Flame", "Award", "Crown", "Lightbulb", "Rocket"]);
// Keep this server-side allowlist deliberately closed: only bundled illustrations
// and approved emoji are accepted, never user-supplied URLs, data URIs, or SVG.
export const NORMAL_AVATARS = new Set([
  "/avatars/adventurer-boy.webp","/avatars/adventurer-girl.webp","/avatars/space-boy.webp",
  "/avatars/space-girl.webp","/avatars/science-girl.webp","/avatars/nature-boy.webp",
  "/avatars/ocean-girl.webp","/avatars/hero-boy.webp",
  "/avatars/junior-archaeologist.webp","/avatars/hijabi-stargazer.webp",
  "/avatars/teen-inventor.webp","/avatars/hijabi-navigator.webp",
  "/avatars/wise-explorer.webp","/avatars/oryx-companion.webp",
  "/avatars/falcon-guide.webp","/avatars/desert-fox.webp","/avatars/arabian-horse.webp",
  "/avatars/gulf-boy-thobe.webp","/avatars/gulf-girl-abaya.webp","/avatars/gulf-boy-bisht.webp",
  "/avatars/arab-formal-boy.webp","/avatars/arab-formal-girl.webp","/avatars/arab-formal-hijabi.webp",
  "/avatars/casual-curly-boy.webp","/avatars/casual-braids-girl.webp","/avatars/casual-bob-girl.webp",
  "🧕🏽","👳🏽‍♂️","🤵🏽‍♂️","👰🏽‍♀️","👨🏽‍🎓","👩🏽‍🎓","👨🏽‍🏫","👩🏽‍🏫",
  "👨🏽‍💼","👩🏽‍💼","👨🏽‍⚕️","👩🏽‍⚕️","👨🏽‍💻","👩🏽‍💻","🧑🏽‍🚀","🧑🏽‍🔬",
  "🏃🏽‍♂️","🏃🏽‍♀️","⛹🏽‍♂️","🤸🏽‍♀️","👦🏽","👧🏽","🧒🏽","🧑🏽","👨🏽","👩🏽",
  "🦁","🐯","🦊","🐻","🐼","🐸","🦄","🐨","🐺","🦅",
]);
const STUDENT_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const STUDENT_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const STUDENT_AVATAR_OBJECT = /^\/objects\/uploads\/student-avatars\/(\d+)\/(\d+)\/[A-Za-z0-9_-]+$/;
function serializedStudentAvatar(studentId: number, avatar: unknown) {
  return typeof avatar === "string" && STUDENT_AVATAR_OBJECT.test(avatar)
    ? `/api/classroom-rewards/students/${studentId}/avatar`
    : avatar ?? null;
}
const COLORS = new Set(["#468064", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#0891b2", "#f97316"]);
const requestKey = z.string().trim().min(8).max(200);
const typeInput = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().min(1).max(100).optional(),
  points: z.number().int().min(1).max(1000),
  icon: z.string().refine((v) => ICONS.has(v), "invalid icon"),
  color: z.string().refine((v) => COLORS.has(v), "invalid color"),
  order: z.number().int().min(0).max(10000),
  active: z.boolean(),
});
const grantInput = z.object({
  className: z.string().trim().min(1).max(200),
  studentIds: z.array(z.number().int().positive()).min(1).max(500),
  typeId: z.number().int().positive().optional(),
  customReason: z.string().trim().min(1).max(100).optional(),
  customPoints: z.number().int().min(1).max(1000).optional(),
  idempotencyKey: requestKey,
}).refine((v) => (v.typeId !== undefined) !== (v.customReason !== undefined), "حدد سببًا واحدًا").refine((v) => !v.customReason || v.customPoints !== undefined, "نقاط السبب المخصص مطلوبة");
const balanceAdjustmentInput = z.object({
  points: z.number().int().min(1).max(1000),
  reason: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: requestKey,
}).strict();
const bulkBalanceAdjustmentInput = balanceAdjustmentInput.extend({
  className: z.string().trim().min(1).max(200),
  studentIds: z.array(z.number().int().positive()).min(2).max(500),
}).strict().refine((value) => new Set(value.studentIds).size === value.studentIds.length, "معرفات الطلاب مكررة");
const groupInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(160).nullable().optional(),
  color: z.string().refine((v) => COLORS.has(v), "invalid color"),
  avatar: z.string().refine((v) => NORMAL_AVATARS.has(v), "invalid avatar").nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  studentIds: z.array(z.number().int().positive()).max(500).optional(),
}).strict();
const groupMembersInput = z.object({
  studentIds: z.array(z.number().int().positive()).max(500),
}).strict();
const groupScoreInput = z.object({ points: z.number().int().min(1).max(1000), idempotencyKey: requestKey }).strict();
const groupResetInput = z.object({ idempotencyKey: requestKey }).strict();
const classBalanceAdjustmentInput = z.object({
  operation: z.enum(["award", "deduct"]),
  points: z.number().int().min(1).max(1000),
  reason: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: requestKey,
}).strict();
const ruleInput = z.object({
  name: z.string().trim().min(1).max(100),
  sourceType: z.enum(["assignment_submission", "kids_activity_completion", "game_history"]),
  conditionType: z.enum(["completion", "score_at_least"]),
  threshold: z.number().int().min(0).max(1000).optional(),
  rewardTypeId: z.number().int().positive(),
  amount: z.number().int().min(1).max(1000),
  isActive: z.boolean().optional(),
}).strict().superRefine((v, ctx) => { if (v.conditionType === "score_at_least" && v.threshold === undefined) ctx.addIssue({ code: "custom", message: "threshold required" }); });

function teacher(req: any, res: any): number | null {
  const value = Number(req.session?.teacherId);
  if (!Number.isInteger(value) || value < 1) { res.status(401).json({ message: "غير مسجل الدخول" }); return null; }
  return value;
}
function resultRows(result: any): any[] { return result.rows ?? result ?? []; }
function numericId(value: unknown): number | null { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; }
function validateClassName(value: unknown): string | null { return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 200 ? value.trim() : null; }
function formatAcademicScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
function periodStart(period: string | undefined) {
  if (period === "today") return sql`date_trunc('day', NOW())`;
  if (period === "week") return sql`date_trunc('week', NOW())`;
  return null;
}
const DEFAULT_TYPES = [
  ["مشاركة مميزة", "participation", 1, "Star", "#468064", 0],
  ["تعاون رائع", "cooperation", 1, "Heart", "#3b82f6", 1],
  ["إنجاز ممتاز", "achievement", 2, "Trophy", "#f59e0b", 2],
] as const;
async function ensureDefaults(teacherId: number) {
  for (const [name, category, points, icon, color, order] of DEFAULT_TYPES) {
    await db.execute(sql`INSERT INTO classroom_reward_types (teacher_id,name,category,default_amount,icon,color,sort_order,is_active) VALUES (${teacherId},${name},${category},${points},${icon},${color},${order},TRUE) ON CONFLICT (teacher_id,name) DO NOTHING`);
  }
}
function normalizedType(t: any) {
  return { id: t.id, name: t.name, category: t.category, points: t.default_amount, icon: t.icon, color: t.color, order: t.sort_order, active: t.is_active };
}
function normalizedRule(r: any) { return { id:r.id, name:r.name, sourceType:r.source_type, conditionType:r.condition, threshold:r.threshold, rewardTypeId:r.reward_type_id, amount:r.amount, isActive:r.is_enabled }; }

router.get("/classroom-rewards/rules", async (req: any, res) => {
  const teacherId=teacher(req,res); if (!teacherId) return;
  res.json(resultRows(await db.execute(sql`SELECT * FROM classroom_reward_rules WHERE teacher_id=${teacherId} ORDER BY id DESC`)).map(normalizedRule));
});
router.post("/classroom-rewards/rules", async (req: any, res) => {
  const teacherId=teacher(req,res); if (!teacherId) return; const parsed=ruleInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message:"بيانات القاعدة غير صالحة" }); const d=parsed.data;
  const type=resultRows(await db.execute(sql`SELECT * FROM classroom_reward_types WHERE id=${d.rewardTypeId} AND teacher_id=${teacherId}`))[0];
  if (!type) return res.status(404).json({message:"نوع التحفيز غير موجود"});
  const row=resultRows(await db.execute(sql`INSERT INTO classroom_reward_rules (teacher_id,name,source_type,condition,threshold,reward_type_id,amount,category_snapshot,is_enabled) VALUES (${teacherId},${d.name},${d.sourceType},${d.conditionType},${d.conditionType==="score_at_least"?d.threshold!:null},${d.rewardTypeId},${d.amount},${type.category},${d.isActive ?? true}) RETURNING *`))[0];
  await db.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id) VALUES (${teacherId},'create','reward_rule',${row.id})`);
  res.status(201).json(normalizedRule(row));
});
router.patch("/classroom-rewards/rules/:id", async (req:any,res) => {
  const teacherId=teacher(req,res), ruleId=numericId(req.params.id); if(!teacherId)return; if(!ruleId)return res.status(400).json({message:"معرف غير صالح"});
  const parsed=ruleInput.partial().safeParse(req.body); if(!parsed.success || !Object.keys(parsed.data).length)return res.status(400).json({message:"بيانات القاعدة غير صالحة"});
  const old=resultRows(await db.execute(sql`SELECT * FROM classroom_reward_rules WHERE id=${ruleId} AND teacher_id=${teacherId}`))[0]; if(!old)return res.status(404).json({message:"القاعدة غير موجودة"});
  const d=parsed.data; const typeId=d.rewardTypeId??old.reward_type_id; const type=resultRows(await db.execute(sql`SELECT * FROM classroom_reward_types WHERE id=${typeId} AND teacher_id=${teacherId}`))[0]; if(!type)return res.status(404).json({message:"نوع التحفيز غير موجود"});
  const condition=d.conditionType??old.condition, threshold=d.threshold ?? old.threshold; if(condition==="score_at_least" && threshold===null)return res.status(400).json({message:"الحد مطلوب"});
  const row=resultRows(await db.execute(sql`UPDATE classroom_reward_rules SET name=${d.name??old.name},source_type=${d.sourceType??old.source_type},condition=${condition},threshold=${condition==="score_at_least"?threshold:null},reward_type_id=${typeId},amount=${d.amount??old.amount},category_snapshot=${type.category},is_enabled=${d.isActive??old.is_enabled},updated_at=NOW() WHERE id=${ruleId} RETURNING *`))[0];
  await db.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id) VALUES (${teacherId},'update','reward_rule',${ruleId})`); res.json(normalizedRule(row));
});
router.post("/classroom-rewards/rules/:id/enable", async (req:any,res) => {
 const teacherId=teacher(req,res), ruleId=numericId(req.params.id); if(!teacherId)return;if(!ruleId)return res.status(400).json({message:"معرف غير صالح"});
 const enabled=typeof req.body?.isActive==="boolean"?req.body.isActive:true; const row=resultRows(await db.execute(sql`UPDATE classroom_reward_rules SET is_enabled=${enabled},updated_at=NOW() WHERE id=${ruleId} AND teacher_id=${teacherId} RETURNING *`))[0]; if(!row)return res.status(404).json({message:"القاعدة غير موجودة"}); res.json(normalizedRule(row));
});
router.delete("/classroom-rewards/rules/:id", async (req:any,res) => {
 const teacherId=teacher(req,res), ruleId=numericId(req.params.id); if(!teacherId)return;if(!ruleId)return res.status(400).json({message:"معرف غير صالح"});
 const row=resultRows(await db.execute(sql`UPDATE classroom_reward_rules SET is_enabled=FALSE,updated_at=NOW() WHERE id=${ruleId} AND teacher_id=${teacherId} RETURNING id`))[0];
 if(!row)return res.status(404).json({message:"القاعدة غير موجودة"});
 await db.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id) VALUES (${teacherId},'disable','reward_rule',${ruleId})`);
 res.status(409).json({message:"لا يمكن حذف القاعدة؛ تم تعطيلها للحفاظ على السجل"});
});
router.post("/classroom-rewards/rules/:id/reprocess", async (req:any,res) => {
  const teacherId=teacher(req,res), ruleId=numericId(req.params.id); if(!teacherId)return;if(!ruleId)return res.status(400).json({message:"معرف غير صالح"});
  const rule=resultRows(await db.execute(sql`SELECT * FROM classroom_reward_rules WHERE id=${ruleId} AND teacher_id=${teacherId}`))[0];
  if(!rule)return res.status(404).json({message:"القاعدة غير موجودة"});
  const outcomes=await db.transaction(async tx => {
    const evidence=rule.source_type==="assignment_submission"
      ? resultRows(await tx.execute(sql`SELECT sub.id source_id,sub.student_id,COALESCE(sub.teacher_adjusted_points,sub.earned_points) score,sub.total_points FROM submissions sub JOIN assignments a ON a.id=sub.assignment_id WHERE a.teacher_id=${teacherId} AND sub.student_id IS NOT NULL AND sub.student_identity_verified=TRUE ORDER BY sub.id`))
      : rule.source_type==="kids_activity_completion"
        ? resultRows(await tx.execute(sql`SELECT ss.id source_id,st.id student_id,ss.score,NULL::real total_points,ss.activity_id FROM kids_activity_sessions ss JOIN kids_profiles kp ON kp.id=ss.profile_id JOIN students st ON st.student_account_id=kp.student_account_id AND st.teacher_id=${teacherId} WHERE ss.status='completed' AND (SELECT COUNT(*) FROM students one_st WHERE one_st.student_account_id=kp.student_account_id)=1 ORDER BY ss.id`))
        : resultRows(await tx.execute(sql`SELECT gh.id source_id,gh.assignment_id,entry FROM game_history gh CROSS JOIN LATERAL jsonb_array_elements(COALESCE(gh.detailed_results,'[]'::jsonb)) entry WHERE gh.teacher_id=${teacherId} ORDER BY gh.id`)).flatMap((row:any) => Number.isInteger(Number(row.entry?.studentId)) && Number(row.entry.studentId)>0 ? [{source_id:row.source_id,student_id:Number(row.entry.studentId),score:Number(row.entry.score),assignment_id:row.assignment_id,rank:row.entry.rank,total_correct:row.entry.totalCorrect,total_questions:row.entry.totalQuestions}] : []);
    const all:any[]=[]; for(const e of evidence) all.push(...await evaluateClassroomRewardEvidence(tx,{teacherId,ruleId,sourceType:rule.source_type,sourceResultId:e.source_id,studentId:e.student_id,completed:true,score:Number(e.score),evidenceSummary:rule.source_type==="assignment_submission"?{effectivePoints:e.score,totalPoints:e.total_points}:rule.source_type==="kids_activity_completion"?{score:e.score,activityId:e.activity_id}:{gameHistoryId:e.source_id,assignmentId:e.assignment_id,score:e.score,rank:e.rank,totalCorrect:e.total_correct,totalQuestions:e.total_questions}})); return all;
  });
  await db.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,detail) VALUES (${teacherId},'automatic_reprocess','reward_rule',${ruleId},'recent evidence')`);
  res.json({outcomes});
});

router.get("/classroom-rewards/types", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  await ensureDefaults(teacherId);
  const found = resultRows(await db.execute(sql`SELECT * FROM classroom_reward_types WHERE teacher_id=${teacherId} AND name NOT LIKE '__custom__:%' ORDER BY sort_order,name`));
  res.json(found.map(normalizedType));
});
router.post("/classroom-rewards/types", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const parsed = typeInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "بيانات النوع غير صالحة" });
  const d = parsed.data;
  try {
    const type = resultRows(await db.execute(sql`INSERT INTO classroom_reward_types (teacher_id,name,category,default_amount,icon,color,sort_order,is_active) VALUES (${teacherId},${d.name},${d.category ?? "general"},${d.points},${d.icon},${d.color},${d.order},${d.active}) RETURNING *`))[0];
    await db.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id) VALUES (${teacherId},'create','reward_type',${type.id})`);
    res.status(201).json(normalizedType(type));
  } catch (error: any) { res.status(error?.code === "23505" ? 409 : 500).json({ message: error?.code === "23505" ? "النوع موجود بالفعل" : "حدث خطأ" }); }
});
router.patch("/classroom-rewards/types/:id", async (req: any, res) => {
  const teacherId = teacher(req, res), typeId = numericId(req.params.id); if (!teacherId) return; if (!typeId) return res.status(400).json({ message: "معرف غير صالح" });
  const parsed = typeInput.partial().safeParse(req.body); if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "بيانات النوع غير صالحة" });
  try {
    const old = resultRows(await db.execute(sql`SELECT * FROM classroom_reward_types WHERE id=${typeId} AND teacher_id=${teacherId}`))[0]; if (!old) return res.status(404).json({ message: "النوع غير موجود" });
    const d = parsed.data;
    const updated = resultRows(await db.execute(sql`UPDATE classroom_reward_types SET name=${d.name ?? old.name},category=${d.category ?? old.category},default_amount=${d.points ?? old.default_amount},icon=${d.icon ?? old.icon},color=${d.color ?? old.color},sort_order=${d.order ?? old.sort_order},is_active=${d.active ?? old.is_active},updated_at=NOW() WHERE id=${typeId} AND teacher_id=${teacherId} RETURNING *`))[0];
    await db.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id) VALUES (${teacherId},'update','reward_type',${typeId})`);
    res.json(normalizedType(updated));
  } catch (error: any) {
    res.status(error?.code === "23505" || error?.cause?.code === "23505" ? 409 : 500).json({ message: error?.code === "23505" || error?.cause?.code === "23505" ? "اسم نوع التحفيز مستخدم بالفعل" : "حدث خطأ" });
  }
});

async function classStudents(teacherId: number, className: string, teacherClassId: number) {
  const teacherClass = await ownedClass(teacherId, className);
  if (!teacherClass || Number(teacherClass.id) !== teacherClassId) return [];
  const rows = resultRows(await db.execute(sql`
    SELECT s.id,s.name,COALESCE(s.avatar,a.avatar,k.avatar_key,NULL) AS avatar,
      COALESCE(SUM(b.balance),0)::int AS points,
      (SELECT MAX(tr.created_at) FROM classroom_reward_transactions tr
       WHERE tr.teacher_id=${teacherId} AND tr.student_id=s.id AND tr.kind='grant'
          AND (tr.teacher_class_id=${teacherClassId} OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=${className} AND tr.created_at>=${teacherClass.created_at}))
         AND NOT EXISTS (SELECT 1 FROM classroom_reward_transactions rv WHERE rv.reversal_of_id=tr.id)) AS last_reward_at
    FROM students s
    LEFT JOIN student_accounts a ON a.id=s.student_account_id
    LEFT JOIN kids_profiles k ON k.student_account_id=s.student_account_id
    LEFT JOIN classroom_reward_balances b ON b.teacher_id=${teacherId} AND b.student_id=s.id
    WHERE s.teacher_id=${teacherId} AND (s.student_class=${className} OR (s.student_class IS NULL AND s.grade_level=${className}))
    GROUP BY s.id,s.name,s.avatar,a.avatar,k.avatar_key ORDER BY s.name
  `));
  return rows.map((row) => ({
    ...row,
    avatar: serializedStudentAvatar(Number(row.id), row.avatar),
  }));
}
async function ownedClass(teacherId: number, name: string) {
  return resultRows(await db.execute(sql`SELECT id,name,created_at FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${name}`))[0] ?? null;
}
const goalInput = z.object({
  title: z.string().trim().min(1).max(160),
  skill: z.string().trim().min(1).max(160).optional(),
  targetPoints: z.number().int().positive().max(100000),
  studentId: z.number().int().positive().optional().nullable(),
  rewardTypeId: z.number().int().positive().optional().nullable(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
  status: z.enum(["active", "archived"]).optional(),
}).strict();
function goalObject(row: any) {
  return {
    id: Number(row.id), className: row.class_name, studentId: row.student_id == null ? null : Number(row.student_id),
    title: row.title, skill: row.skill, rewardTypeId: row.reward_type_id == null ? null : Number(row.reward_type_id),
    targetPoints: Number(row.target_points), startsAt: row.starts_at, endsAt: row.ends_at,
    status: row.status, currentPoints: Number(row.current_points ?? 0),
    completed: Number(row.current_points ?? 0) >= Number(row.target_points),
  };
}
const goalSelect = (teacherId: number, classId: number, goalId?: number) => sql`
  SELECT g.*,tc.name class_name,
    COALESCE((SELECT SUM(tr.amount) FROM classroom_reward_transactions tr
      WHERE tr.teacher_id=g.teacher_id AND (tr.teacher_class_id=g.teacher_class_id OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=tc.name AND tr.created_at>=tc.created_at))
        AND tr.kind='grant' AND tr.created_at>=g.starts_at AND (g.ends_at IS NULL OR tr.created_at<=g.ends_at)
        AND (g.reward_type_id IS NULL OR tr.reward_type_id=g.reward_type_id)
        AND (g.student_id IS NULL OR tr.student_id=g.student_id)
        AND NOT EXISTS (SELECT 1 FROM classroom_reward_transactions rv WHERE rv.reversal_of_id=tr.id AND rv.kind='reversal')),0)::int current_points
  FROM classroom_reward_goals g JOIN teacher_classes tc ON tc.id=g.teacher_class_id
  WHERE g.teacher_id=${teacherId} AND g.teacher_class_id=${classId} ${goalId ? sql`AND g.id=${goalId}` : sql``}
`;
router.get("/classroom-rewards/classes/:className/goals", async (req: any, res) => {
  const teacherId=teacher(req,res); if(!teacherId)return;
  const name=validateClassName(req.params.className); if(!name)return res.status(400).json({message:"اسم الصف غير صالح"});
  const c=await ownedClass(teacherId,name); if(!c)return res.status(404).json({message:"الصف غير موجود"});
  const rows=resultRows(await db.execute(sql`${goalSelect(teacherId,Number(c.id))} AND g.status='active' AND g.is_active=TRUE AND (g.ends_at IS NULL OR g.ends_at>=NOW()) ORDER BY g.id DESC`));
  res.json({goals:rows.map(goalObject)});
});
router.post("/classroom-rewards/classes/:className/goals", async (req: any, res) => {
  const teacherId=teacher(req,res); if(!teacherId)return;
  const name=validateClassName(req.params.className); const parsed=goalInput.safeParse(req.body);
  if(!name||!parsed.success)return res.status(400).json({message:"بيانات الهدف غير صالحة"});
  const d=parsed.data, c=await ownedClass(teacherId,name); if(!c)return res.status(404).json({message:"الصف غير موجود"});
  const starts=d.startsAt ? new Date(d.startsAt) : new Date();
  if(Number.isNaN(starts.getTime()) || (d.endsAt && Number.isNaN(new Date(d.endsAt).getTime())) || (d.endsAt && new Date(d.endsAt)<=starts)) return res.status(400).json({message:"التواريخ غير صالحة"});
  if(d.studentId!==null && d.studentId!==undefined) {
    const s=resultRows(await db.execute(sql`SELECT id FROM students WHERE id=${d.studentId} AND teacher_id=${teacherId} AND (student_class=${name} OR (student_class IS NULL AND grade_level=${name}))`))[0];
    if(!s)return res.status(403).json({message:"الطالب ليس ضمن الصف"});
  }
  if(d.rewardTypeId!==null && d.rewardTypeId!==undefined) {
    const type=resultRows(await db.execute(sql`SELECT id FROM classroom_reward_types WHERE id=${d.rewardTypeId} AND teacher_id=${teacherId}`))[0];
    if(!type)return res.status(404).json({message:"نوع التحفيز غير موجود"});
  }
  await db.execute(sql`UPDATE classroom_reward_goals SET status='archived',is_active=FALSE,updated_at=NOW()
    WHERE teacher_id=${teacherId} AND teacher_class_id=${c.id}
      AND ${d.studentId ? sql`student_id=${d.studentId}` : sql`student_id IS NULL`} AND status='active'`);
  const row=resultRows(await db.execute(sql`INSERT INTO classroom_reward_goals(teacher_id,teacher_class_id,student_id,title,skill,target_points,reward_type_id,starts_at,ends_at,status,is_active) VALUES (${teacherId},${c.id},${d.studentId??null},${d.title},${d.skill??d.title},${d.targetPoints},${d.rewardTypeId??null},${starts.toISOString()},${d.endsAt?new Date(d.endsAt).toISOString():null},${d.status??"active"},${(d.status??"active")==="active"}) RETURNING id`))[0];
  const saved=resultRows(await db.execute(sql`${goalSelect(teacherId,Number(c.id),Number(row.id))}`))[0];
  await db.execute(sql`INSERT INTO classroom_reward_audit_logs(teacher_id,action,entity_type,entity_id,detail) VALUES (${teacherId},'create','reward_goal',${row.id},${name})`);
  res.status(201).json(goalObject(saved));
});
router.patch("/classroom-rewards/goals/:goalId", async (req:any,res) => {
  const teacherId=teacher(req,res), id=numericId(req.params.goalId); if(!teacherId)return; if(!id)return res.status(400).json({message:"معرف الهدف غير صالح"});
  const parsed=goalInput.partial().safeParse(req.body); if(!parsed.success||!Object.keys(parsed.data).length)return res.status(400).json({message:"بيانات الهدف غير صالحة"});
  const old=resultRows(await db.execute(sql`SELECT g.*,tc.name class_name FROM classroom_reward_goals g JOIN teacher_classes tc ON tc.id=g.teacher_class_id WHERE g.id=${id} AND g.teacher_id=${teacherId}`))[0]; if(!old)return res.status(404).json({message:"الهدف غير موجود"});
  const d=parsed.data;
  if(d.studentId!==undefined&&d.studentId!==null){const s=resultRows(await db.execute(sql`SELECT id FROM students WHERE id=${d.studentId} AND teacher_id=${teacherId} AND (student_class=${old.class_name} OR (student_class IS NULL AND grade_level=${old.class_name}))`))[0];if(!s)return res.status(403).json({message:"الطالب ليس ضمن الصف"});}
  const starts=d.startsAt?new Date(d.startsAt):new Date(old.starts_at), ends=d.endsAt===null?null:d.endsAt?new Date(d.endsAt):old.ends_at;
  if(Number.isNaN(starts.getTime())||(ends&&new Date(ends)<=starts))return res.status(400).json({message:"التواريخ غير صالحة"});
  if(d.rewardTypeId!==undefined&&d.rewardTypeId!==null){const type=resultRows(await db.execute(sql`SELECT id FROM classroom_reward_types WHERE id=${d.rewardTypeId} AND teacher_id=${teacherId}`))[0];if(!type)return res.status(404).json({message:"نوع التحفيز غير موجود"});}
  const status=d.status??old.status;
  await db.execute(sql`UPDATE classroom_reward_goals SET title=${d.title??old.title},skill=${d.skill??old.skill},reward_type_id=${d.rewardTypeId===undefined?old.reward_type_id:d.rewardTypeId},target_points=${d.targetPoints??old.target_points},student_id=${d.studentId===undefined?old.student_id:d.studentId},starts_at=${starts.toISOString()},ends_at=${ends},status=${status},is_active=${status==="active"},updated_at=NOW() WHERE id=${id} AND teacher_id=${teacherId}`);
  const saved=resultRows(await db.execute(sql`${goalSelect(teacherId,Number(old.teacher_class_id),id)}`))[0]; res.json(goalObject(saved));
});
router.delete(["/classroom-rewards/goals/:goalId", "/classroom-rewards/classes/:className/goals/:goalId"], async (req:any,res) => {
  const teacherId=teacher(req,res), id=numericId(req.params.goalId); if(!teacherId)return; if(!id)return res.status(400).json({message:"معرف الهدف غير صالح"});
  const className=req.params.className ? validateClassName(req.params.className) : null;
  const c=className ? await ownedClass(teacherId,className) : null;
  if(req.params.className&&!className)return res.status(400).json({message:"اسم الصف غير صالح"});
  if(className&&!c)return res.status(404).json({message:"الصف غير موجود"});
  const row=resultRows(await db.execute(sql`UPDATE classroom_reward_goals SET status='archived',is_active=FALSE,updated_at=NOW() WHERE id=${id} AND teacher_id=${teacherId} ${c ? sql`AND teacher_class_id=${c.id}` : sql``} RETURNING id`))[0]; if(!row)return res.status(404).json({message:"الهدف غير موجود"});
  await db.execute(sql`INSERT INTO classroom_reward_audit_logs(teacher_id,action,entity_type,entity_id) VALUES (${teacherId},'archive','reward_goal',${id})`);
  res.json({archived:true});
});
router.get("/classroom-rewards/classes/:className", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const name = validateClassName(req.params.className); if (!name) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const c=await ownedClass(teacherId,name); if(!c)return res.status(404).json({message:"الصف غير موجود"});
  const students=await classStudents(teacherId,name,Number(c.id));
  const goals=resultRows(await db.execute(sql`SELECT * FROM classroom_reward_goals WHERE teacher_id=${teacherId} AND teacher_class_id=${c.id} AND status='active' AND is_active=TRUE AND (ends_at IS NULL OR ends_at>=NOW()) ORDER BY (student_id IS NOT NULL) DESC,created_at DESC,id DESC`)).map(goalObject);
  const progress=resultRows(await db.execute(sql`
    SELECT g.id goal_id,s.id student_id,COALESCE(SUM(CASE WHEN tr.id IS NOT NULL THEN tr.amount ELSE 0 END),0)::int progress
    FROM classroom_reward_goals g JOIN students s ON s.teacher_id=${teacherId}
      AND (s.student_class=${name} OR (s.student_class IS NULL AND s.grade_level=${name}))
      AND (g.student_id IS NULL OR g.student_id=s.id)
    LEFT JOIN classroom_reward_transactions tr ON tr.teacher_id=${teacherId} AND tr.student_id=s.id AND tr.kind='grant'
      AND (tr.teacher_class_id=g.teacher_class_id OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=${name} AND tr.created_at>=${c.created_at}))
      AND tr.created_at>=g.starts_at AND (g.ends_at IS NULL OR tr.created_at<=g.ends_at)
      AND (g.reward_type_id IS NULL OR tr.reward_type_id=g.reward_type_id)
      AND NOT EXISTS (SELECT 1 FROM classroom_reward_transactions rv WHERE rv.reversal_of_id=tr.id)
    WHERE g.teacher_id=${teacherId} AND g.teacher_class_id=${c.id} AND g.status='active' AND g.is_active=TRUE
    GROUP BY g.id,s.id`));
  res.json({students:students.map(s=>{const goal=goals.find(g=>g.studentId===Number(s.id))??goals.find(g=>g.studentId===null)??null;const achieved=goal?Number(progress.find(p=>Number(p.goal_id)===goal.id&&Number(p.student_id)===Number(s.id))?.progress??0):0;return{...s,lastRewardAt:s.last_reward_at,goal:goal?{...goal,progress:achieved,remaining:Math.max(0,goal.targetPoints-achieved)}:null};}),goals});
});
router.get("/classroom-rewards/classes/:className/suggestions", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const className = validateClassName(req.params.className);
  if (!className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const classRow = await ownedClass(teacherId, className);
  if (!classRow) return res.status(404).json({ message: "الصف غير موجود" });
  await ensureDefaults(teacherId);
  const rewardType = resultRows(await db.execute(sql`
    SELECT id,name,default_amount
    FROM classroom_reward_types
    WHERE teacher_id=${teacherId} AND is_active=TRUE AND name NOT LIKE '__custom__:%'
    ORDER BY CASE WHEN category='achievement' THEN 0 ELSE 1 END,sort_order,id
    LIMIT 1
  `))[0];
  if (!rewardType) return res.json({ suggestions: [] });

  const evidence = resultRows(await db.execute(sql`
    SELECT DISTINCT ON (sub.student_id)
      sub.id AS submission_id,
      sub.student_id,
      s.name AS student_name,
      COALESCE(s.avatar,sa.avatar,kp.avatar_key,NULL) AS student_avatar,
      a.title AS assignment_title,
      COALESCE(sub.teacher_adjusted_points,sub.earned_points,0)::real AS earned_points,
      COALESCE(NULLIF(sub.total_points,0),NULLIF(sub.total_questions,0),1)::real AS total_points,
      sub.submitted_at
    FROM submissions sub
    JOIN assignments a ON a.id=sub.assignment_id AND a.teacher_id=${teacherId}
    JOIN students s ON s.id=sub.student_id AND s.teacher_id=${teacherId}
    LEFT JOIN student_accounts sa ON sa.id=s.student_account_id
    LEFT JOIN kids_profiles kp ON kp.student_account_id=s.student_account_id
    WHERE sub.student_id IS NOT NULL
      AND sub.student_identity_verified=TRUE
      AND (s.student_class=${className} OR (s.student_class IS NULL AND s.grade_level=${className}))
      AND sub.submitted_at >= NOW() - INTERVAL '14 days'
      AND COALESCE(sub.teacher_adjusted_points,sub.earned_points,0) > 0
      AND COALESCE(sub.teacher_adjusted_points,sub.earned_points,0)
        / COALESCE(NULLIF(sub.total_points,0),NULLIF(sub.total_questions,0),1) >= 0.8
      AND NOT EXISTS (
        SELECT 1 FROM classroom_reward_transactions tr
        WHERE tr.teacher_id=${teacherId}
          AND tr.student_id=sub.student_id
          AND tr.kind='grant'
          AND tr.created_at >= date_trunc('week',NOW())
          AND NOT EXISTS (
            SELECT 1 FROM classroom_reward_transactions rv
            WHERE rv.reversal_of_id=tr.id
          )
      )
    ORDER BY sub.student_id,sub.submitted_at DESC,sub.id DESC
    LIMIT 12
  `));
  res.json({
    suggestions: evidence.map((row) => {
      const earned = Number(row.earned_points);
      const total = Number(row.total_points);
      const percentage = Math.round((earned / total) * 100);
      return {
        id: `assignment_submission:${row.submission_id}`,
        submissionId: Number(row.submission_id),
        studentId: Number(row.student_id),
        studentName: row.student_name,
        studentAvatar: serializedStudentAvatar(Number(row.student_id), row.student_avatar),
        reason: "إنجاز أكاديمي موثّق",
        evidenceLabel: row.assignment_title || "واجب مكتمل",
        evidenceDetail: `${formatAcademicScore(earned)} من ${formatAcademicScore(total)} (${percentage}٪)`,
        rewardTypeId: Number(rewardType.id),
        rewardTypeName: rewardType.name,
        points: Number(rewardType.default_amount),
      };
    }),
  });
});
router.post("/classroom-rewards/classes/:className/suggestions/:submissionId/approve", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const className = validateClassName(req.params.className);
  const submissionId = numericId(req.params.submissionId);
  if (!className || !submissionId) return res.status(400).json({ message: "بيانات الاقتراح غير صالحة" });
  try {
    const outcome = await db.transaction(async (tx) => {
      const evidence = resultRows(await tx.execute(sql`
        SELECT sub.id,sub.student_id,s.name student_name,a.title assignment_title,
          COALESCE(sub.teacher_adjusted_points,sub.earned_points,0)::real earned_points,
          COALESCE(NULLIF(sub.total_points,0),NULLIF(sub.total_questions,0),1)::real total_points,
          tc.id teacher_class_id
        FROM submissions sub
        JOIN assignments a ON a.id=sub.assignment_id AND a.teacher_id=${teacherId}
        JOIN students s ON s.id=sub.student_id AND s.teacher_id=${teacherId}
        JOIN teacher_classes tc ON tc.teacher_id=${teacherId} AND tc.name=${className}
        WHERE sub.id=${submissionId}
          AND sub.student_identity_verified=TRUE
          AND (s.student_class=${className} OR (s.student_class IS NULL AND s.grade_level=${className}))
          AND sub.submitted_at >= NOW() - INTERVAL '14 days'
        FOR UPDATE OF sub,s
      `))[0];
      if (!evidence) throw new Error("evidence_unavailable");
      const earned = Number(evidence.earned_points);
      const total = Number(evidence.total_points);
      if (earned <= 0 || earned / total < 0.8) throw new Error("evidence_unavailable");

      const prior = resultRows(await tx.execute(sql`
        SELECT * FROM classroom_reward_transactions
        WHERE teacher_id=${teacherId}
          AND source_type='reward_suggestion_submission'
          AND source_result_id=${submissionId}
          AND kind='grant'
        FOR UPDATE
      `))[0];
      if (prior) return { grant: prior, idempotent: true };

      const type = resultRows(await tx.execute(sql`
        SELECT * FROM classroom_reward_types
        WHERE teacher_id=${teacherId} AND is_active=TRUE AND name NOT LIKE '__custom__:%'
        ORDER BY CASE WHEN category='achievement' THEN 0 ELSE 1 END,sort_order,id
        LIMIT 1 FOR UPDATE
      `))[0];
      if (!type) throw new Error("reward_type_unavailable");
      const key = `reward-suggestion:assignment:${submissionId}`;
      const fingerprint = JSON.stringify({ className, submissionId, studentId: Number(evidence.student_id), typeId: Number(type.id) });
      const batch = resultRows(await tx.execute(sql`
        INSERT INTO classroom_reward_batches
          (teacher_id,idempotency_key,class_name_snapshot,teacher_class_id,reward_type_id,reason_snapshot,points,target_count,request_fingerprint)
        VALUES
          (${teacherId},${key},${className},${evidence.teacher_class_id},${type.id},${type.name},${type.default_amount},1,${fingerprint})
        ON CONFLICT (teacher_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
        RETURNING id
      `))[0];
      const grant = resultRows(await tx.execute(sql`
        INSERT INTO classroom_reward_transactions
          (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,batch_id,batch_key,class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot,source_type,source_result_id)
        VALUES
          (${teacherId},${evidence.student_id},${evidence.student_name},${type.id},${type.default_amount},'grant',${key},${batch.id},${key},${className},${evidence.teacher_class_id},${type.name},${type.category},'reward_suggestion_submission',${submissionId})
        ON CONFLICT (teacher_id,source_result_id)
          WHERE source_type='reward_suggestion_submission' AND kind='grant'
        DO NOTHING RETURNING *
      `))[0];
      if (!grant) {
        const concurrent = resultRows(await tx.execute(sql`
          SELECT * FROM classroom_reward_transactions
          WHERE teacher_id=${teacherId}
            AND source_type='reward_suggestion_submission'
            AND source_result_id=${submissionId}
            AND kind='grant'
        `))[0];
        return { grant: concurrent, idempotent: true };
      }
      await tx.execute(sql`
        INSERT INTO classroom_reward_balances (teacher_id,student_id,reward_type_id,balance,updated_at)
        VALUES (${teacherId},${evidence.student_id},${type.id},${type.default_amount},NOW())
        ON CONFLICT (teacher_id,student_id,reward_type_id)
        DO UPDATE SET balance=classroom_reward_balances.balance+EXCLUDED.balance,updated_at=NOW()
      `);
      await tx.execute(sql`
        INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,idempotency_key,detail)
        VALUES (${teacherId},'approve_reward_suggestion','submission',${submissionId},${key},${evidence.assignment_title})
      `);
      return { grant, idempotent: false };
    });
    res.status(outcome.idempotent ? 200 : 201).json(outcome);
  } catch (error: any) {
    if (error?.message === "evidence_unavailable") return res.status(409).json({ message: "لم يعد الدليل الأكاديمي صالحًا للاعتماد" });
    if (error?.message === "reward_type_unavailable") return res.status(409).json({ message: "لا يوجد نوع تحفيز نشط للاعتماد" });
    res.status(500).json({ message: "تعذر اعتماد الاقتراح" });
  }
});
// Historical alias retained for clients released before the route contract was final.
router.get("/classroom-rewards/classes/:className/students", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const name = validateClassName(req.params.className); if (!name) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const c=await ownedClass(teacherId,name); if(!c)return res.status(404).json({message:"الصف غير موجود"});
  res.json({ students: await classStudents(teacherId, name, Number(c.id)) });
});

router.get("/classroom-rewards/classes/:className/groups", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const className = validateClassName(req.params.className); if (!className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const classRow = await ownedClass(teacherId, className); if (!classRow) return res.status(404).json({ message: "الصف غير موجود" });
  const groups = resultRows(await db.execute(sql`SELECT id,name,description,color,avatar,score,sort_order FROM classroom_reward_groups WHERE teacher_id=${teacherId} AND teacher_class_id=${classRow.id} ORDER BY sort_order,name,id`));
  if (!groups.length) return res.json({ groups: [] });
  const groupIds = groups.map((group) => Number(group.id));
  const members = resultRows(await db.execute(sql`
    SELECT gm.group_id,gm.student_id,s.name,COALESCE(s.avatar,a.avatar,k.avatar_key,NULL) avatar
    FROM classroom_reward_group_members gm
    JOIN students s ON s.id=gm.student_id AND s.teacher_id=${teacherId}
    LEFT JOIN student_accounts a ON a.id=s.student_account_id
    LEFT JOIN kids_profiles k ON k.student_account_id=s.student_account_id
    WHERE gm.teacher_id=${teacherId} AND gm.group_id IN (${sql.join(groupIds.map((id) => sql`${id}`), sql`,`)})
    ORDER BY s.name
  `));
  res.json({
    groups: groups.map((group) => ({
      id: Number(group.id),
      name: group.name,
      description: group.description,
      color: group.color,
      avatar: group.avatar,
      score: Number(group.score),
      sortOrder: Number(group.sort_order),
      members: members.filter((member) => Number(member.group_id) === Number(group.id)).map((member) => ({
        studentId: Number(member.student_id),
        name: member.name,
        avatar: serializedStudentAvatar(Number(member.student_id), member.avatar),
      })),
    })),
  });
});

router.get("/classroom-rewards/classes/:className/board", async (req:any,res) => {
  const teacherId=teacher(req,res); if(!teacherId)return;
  const className=validateClassName(req.params.className); if(!className)return res.status(400).json({message:"اسم الصف غير صالح"});
  const c=await ownedClass(teacherId,className); if(!c)return res.status(404).json({message:"الصف غير موجود"});
  const students=resultRows(await db.execute(sql`
    SELECT s.id,s.name,COALESCE(s.avatar,a.avatar,k.avatar_key,NULL) avatar,
      COALESCE((SELECT SUM(b.balance) FROM classroom_reward_balances b WHERE b.teacher_id=${teacherId} AND b.student_id=s.id),0)::int points,
      EXISTS(SELECT 1 FROM classroom_reward_transactions tr WHERE tr.teacher_id=${teacherId} AND tr.student_id=s.id AND tr.kind='grant' AND (tr.teacher_class_id=${c.id} OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=${className} AND tr.created_at>=${c.created_at})) AND tr.created_at>=date_trunc('week',NOW()) AND NOT EXISTS(SELECT 1 FROM classroom_reward_transactions rv WHERE rv.reversal_of_id=tr.id AND rv.kind='reversal')) recognized_this_week
    FROM students s LEFT JOIN student_accounts a ON a.id=s.student_account_id LEFT JOIN kids_profiles k ON k.student_account_id=s.student_account_id
    WHERE s.teacher_id=${teacherId} AND (s.student_class=${className} OR (s.student_class IS NULL AND s.grade_level=${className})) ORDER BY s.name`));
  const groups=resultRows(await db.execute(sql`SELECT id,name,description,color,avatar,score FROM classroom_reward_groups WHERE teacher_id=${teacherId} AND teacher_class_id=${c.id} ORDER BY sort_order,name`));
  const members=groups.length ? resultRows(await db.execute(sql`SELECT group_id,student_id FROM classroom_reward_group_members WHERE teacher_id=${teacherId} AND group_id IN (${sql.join(groups.map(g=>sql`${g.id}`),sql`,`)})`)) : [];
  const goals=resultRows(await db.execute(sql`${goalSelect(teacherId,Number(c.id))} AND g.status='active' AND g.is_active=TRUE ORDER BY g.id DESC`));
  res.json({className,students:students.map(s=>({id:Number(s.id),name:s.name,avatar:serializedStudentAvatar(Number(s.id),s.avatar),points:Number(s.points),currentWeeklyRecognition:Boolean(s.recognized_this_week)})),
    groups:groups.map(g=>({id:Number(g.id),name:g.name,description:g.description,color:g.color,avatar:g.avatar,score:Number(g.score),memberIds:members.filter(m=>Number(m.group_id)===Number(g.id)).map(m=>Number(m.student_id))})),
    goals:goals.map(goalObject),weeklyFairness:{recognizedStudentCount:students.filter(s=>s.recognized_this_week).length,totalStudentCount:students.length}});
});

router.post("/classroom-rewards/classes/:className/groups", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const className = validateClassName(req.params.className); if (!className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const parsed = groupInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "بيانات المجموعة غير صالحة" });
  const d = parsed.data;
  const ids = d.studentIds ?? [];
  if (new Set(ids).size !== ids.length) return res.status(400).json({ message: "لا يمكن تكرار الطالب في المجموعة نفسها" });
  try {
    const row = await db.transaction(async (tx) => {
      const classRow = resultRows(await tx.execute(sql`SELECT id FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${className} FOR UPDATE`))[0];
      if (!classRow) throw new Error("class_not_found");
      const students = ids.length ? resultRows(await tx.execute(sql`SELECT id FROM students WHERE teacher_id=${teacherId} AND id IN (${sql.join(ids.map((id) => sql`${id}`), sql`,`)}) AND (student_class=${className} OR (student_class IS NULL AND grade_level=${className})) FOR UPDATE`)) : [];
      if (students.length !== ids.length) throw new Error("invalid_students");
      const created = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_groups (teacher_id,teacher_class_id,name,description,color,avatar,sort_order) VALUES (${teacherId},${classRow.id},${d.name},${d.description ?? null},${d.color},${d.avatar ?? null},${d.sortOrder ?? 0}) RETURNING *`))[0];
      for (const student of students) await tx.execute(sql`INSERT INTO classroom_reward_group_members (teacher_id,group_id,student_id) VALUES (${teacherId},${created.id},${student.id})`);
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,detail) VALUES (${teacherId},'create','reward_group',${created.id},${className})`);
      return created;
    });
    res.status(201).json({ id:Number(row.id),name:row.name,description:row.description,color:row.color,avatar:row.avatar,score:Number(row.score),sortOrder:Number(row.sort_order),members:[] });
  } catch (error: any) {
    if (error?.message === "class_not_found") return res.status(404).json({ message: "الصف غير موجود" });
    if (error?.message === "invalid_students") return res.status(403).json({ message: "كل الطلاب يجب أن يكونوا ضمن الصف نفسه" });
    const duplicate = error?.code === "23505" || error?.cause?.code === "23505";
    res.status(duplicate ? 409 : 500).json({ message: duplicate ? "اسم المجموعة مستخدم في هذا الصف" : "تعذر إنشاء المجموعة" });
  }
});

router.patch("/classroom-rewards/classes/:className/groups/:groupId", async (req: any, res) => {
  const teacherId = teacher(req, res), groupId = numericId(req.params.groupId); if (!teacherId) return;
  if (!groupId) return res.status(400).json({ message: "معرف المجموعة غير صالح" });
  const className = validateClassName(req.params.className); if (!className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const parsed = groupInput.partial().safeParse(req.body); if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "بيانات المجموعة غير صالحة" });
  const d = parsed.data;
  const ids = d.studentIds;
  if (ids && new Set(ids).size !== ids.length) return res.status(400).json({ message: "لا يمكن تكرار الطالب في المجموعة نفسها" });
  try {
    const row = await db.transaction(async (tx) => {
      const classRow = resultRows(await tx.execute(sql`SELECT id FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${className} FOR UPDATE`))[0];
      if (!classRow) throw new Error("class_not_found");
      const old = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_groups WHERE id=${groupId} AND teacher_id=${teacherId} AND teacher_class_id=${classRow.id} FOR UPDATE`))[0];
      if (!old) throw new Error("group_not_found");
      const students = ids?.length ? resultRows(await tx.execute(sql`SELECT id FROM students WHERE teacher_id=${teacherId} AND id IN (${sql.join(ids.map((id) => sql`${id}`), sql`,`)}) AND (student_class=${className} OR (student_class IS NULL AND grade_level=${className})) FOR UPDATE`)) : [];
      if (ids && students.length !== ids.length) throw new Error("invalid_students");
       const updated = resultRows(await tx.execute(sql`UPDATE classroom_reward_groups SET name=${d.name ?? old.name},description=${d.description !== undefined ? d.description : old.description},color=${d.color ?? old.color},avatar=${d.avatar !== undefined ? d.avatar : old.avatar},sort_order=${d.sortOrder ?? old.sort_order},updated_at=NOW() WHERE id=${groupId} RETURNING *`))[0];
      if (ids) {
        await tx.execute(sql`DELETE FROM classroom_reward_group_members WHERE teacher_id=${teacherId} AND group_id=${groupId}`);
        for (const student of students) await tx.execute(sql`INSERT INTO classroom_reward_group_members (teacher_id,group_id,student_id) VALUES (${teacherId},${groupId},${student.id})`);
      }
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,detail) VALUES (${teacherId},'update','reward_group',${groupId},${className})`);
      return updated;
    });
    res.json({ id:Number(row.id),name:row.name,description:row.description,color:row.color,avatar:row.avatar,score:Number(row.score),sortOrder:Number(row.sort_order) });
  } catch (error: any) {
    if (error?.message === "class_not_found") return res.status(404).json({ message: "الصف غير موجود" });
    if (error?.message === "group_not_found") return res.status(404).json({ message: "المجموعة غير موجودة" });
    if (error?.message === "invalid_students") return res.status(403).json({ message: "كل الطلاب يجب أن يكونوا ضمن الصف نفسه" });
    const duplicate = error?.code === "23505" || error?.cause?.code === "23505";
    res.status(duplicate ? 409 : 500).json({ message: duplicate ? "اسم المجموعة مستخدم في هذا الصف" : "تعذر تحديث المجموعة" });
  }
});

async function changeGroupScore(teacherId: number, className: string, groupId: number, key: string, points: number, reset: boolean) {
  return db.transaction(async (tx) => {
    const classRow = resultRows(await tx.execute(sql`SELECT id FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${className} FOR UPDATE`))[0];
    if (!classRow) throw new Error("class_not_found");
    const group = resultRows(await tx.execute(sql`SELECT id FROM classroom_reward_groups WHERE id=${groupId} AND teacher_id=${teacherId} AND teacher_class_id=${classRow.id} FOR UPDATE`))[0];
    if (!group) throw new Error("group_not_found");
    const prior = resultRows(await tx.execute(sql`SELECT group_id,operation,points,score FROM classroom_reward_group_score_receipts WHERE teacher_id=${teacherId} AND idempotency_key=${key}`))[0];
    if (prior) {
      if (Number(prior.group_id) !== groupId || prior.operation !== (reset ? "reset" : "award") || Number(prior.points) !== (reset ? 0 : points)) {
        throw new Error("idempotency_conflict");
      }
      return { score: Number(prior.score), idempotent: true };
    }
    const updated = resultRows(await tx.execute(reset
      ? sql`UPDATE classroom_reward_groups SET score=0,updated_at=NOW() WHERE id=${groupId} RETURNING score`
      : sql`UPDATE classroom_reward_groups SET score=score+${points},updated_at=NOW() WHERE id=${groupId} RETURNING score`))[0];
    await tx.execute(sql`INSERT INTO classroom_reward_group_score_receipts (teacher_id,group_id,idempotency_key,operation,points,score) VALUES (${teacherId},${groupId},${key},${reset ? "reset" : "award"},${reset ? 0 : points},${updated.score})`);
    return { score: Number(updated.score), idempotent: false };
  });
}
router.post("/classroom-rewards/classes/:className/groups/:groupId/score", async (req: any, res) => {
  const teacherId=teacher(req,res), groupId=numericId(req.params.groupId); if (!teacherId) return;
  const className=validateClassName(req.params.className); if (!className || !groupId) return res.status(400).json({message:"بيانات المجموعة غير صالحة"});
  const parsed=groupScoreInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({message:"بيانات النقاط غير صالحة"});
  try { res.json({groupId,...await changeGroupScore(teacherId,className,groupId,parsed.data.idempotencyKey,parsed.data.points,false)}); }
  catch (e:any) { res.status(e.message==="idempotency_conflict"?409:e.message==="group_not_found"||e.message==="class_not_found"?404:500).json({message:e.message==="idempotency_conflict"?"مفتاح التكرار مستخدم لطلب مختلف":e.message==="class_not_found"?"الصف غير موجود":e.message==="group_not_found"?"المجموعة غير موجودة":"تعذر إضافة نقاط المجموعة"}); }
});
router.post("/classroom-rewards/classes/:className/groups/:groupId/reset", async (req: any, res) => {
  const teacherId=teacher(req,res), groupId=numericId(req.params.groupId); if (!teacherId) return;
  const className=validateClassName(req.params.className); if (!className || !groupId) return res.status(400).json({message:"بيانات المجموعة غير صالحة"});
  const parsed=groupResetInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({message:"بيانات التصفير غير صالحة"});
  try { res.json({groupId,...await changeGroupScore(teacherId,className,groupId,parsed.data.idempotencyKey,0,true)}); }
  catch (e:any) { res.status(e.message==="idempotency_conflict"?409:e.message==="group_not_found"||e.message==="class_not_found"?404:500).json({message:e.message==="idempotency_conflict"?"مفتاح التكرار مستخدم لطلب مختلف":e.message==="class_not_found"?"الصف غير موجود":e.message==="group_not_found"?"المجموعة غير موجودة":"تعذر تصفير نقاط المجموعة"}); }
});

router.get("/classroom-rewards/classes/:className/class-balance", async (req: any, res) => {
  const teacherId=teacher(req,res); if (!teacherId) return;
  const className=validateClassName(req.params.className); if (!className) return res.status(400).json({message:"اسم الصف غير صالح"});
  const classRow=await ownedClass(teacherId,className); if (!classRow) return res.status(404).json({message:"الصف غير موجود"});
  const balanceRow=resultRows(await db.execute(sql`SELECT balance,updated_at FROM classroom_reward_class_balances WHERE teacher_id=${teacherId} AND teacher_class_id=${classRow.id}`))[0];
  const history=resultRows(await db.execute(sql`
    SELECT id,operation,amount,resulting_balance,reason,created_at
    FROM classroom_reward_class_transactions
    WHERE teacher_id=${teacherId} AND teacher_class_id=${classRow.id}
    ORDER BY created_at DESC,id DESC LIMIT 20
  `));
  res.json({
    className,
    balance:Number(balanceRow?.balance ?? 0),
    updatedAt:balanceRow?.updated_at ?? null,
    history:history.map((row)=>({
      id:Number(row.id),operation:row.operation,amount:Number(row.amount),
      resultingBalance:Number(row.resulting_balance),reason:row.reason,createdAt:row.created_at,
    })),
  });
});

router.post("/classroom-rewards/classes/:className/class-balance/adjust", async (req: any, res) => {
  const teacherId=teacher(req,res); if (!teacherId) return;
  const className=validateClassName(req.params.className); if (!className) return res.status(400).json({message:"اسم الصف غير صالح"});
  const parsed=classBalanceAdjustmentInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({message:"بيانات نقاط الصف غير صالحة"});
  const d=parsed.data;
  try {
    const outcome=await db.transaction(async(tx)=>{
      const classRow=resultRows(await tx.execute(sql`SELECT id FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${className} FOR UPDATE`))[0];
      if (!classRow) throw new Error("class_not_found");
      await tx.execute(sql`INSERT INTO classroom_reward_class_balances(teacher_id,teacher_class_id,balance) VALUES (${teacherId},${classRow.id},0) ON CONFLICT (teacher_id,teacher_class_id) DO NOTHING`);
      const balanceRow=resultRows(await tx.execute(sql`SELECT balance FROM classroom_reward_class_balances WHERE teacher_id=${teacherId} AND teacher_class_id=${classRow.id} FOR UPDATE`))[0];
      const reason=d.reason?.trim() || null;
      const prior=resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_class_transactions WHERE teacher_id=${teacherId} AND idempotency_key=${d.idempotencyKey}`))[0];
      if (prior) {
        if (Number(prior.teacher_class_id)!==Number(classRow.id) || prior.operation!==d.operation || Math.abs(Number(prior.amount))!==d.points || (prior.reason ?? null)!==reason) throw new Error("idempotency_conflict");
        return {transaction:prior,balance:Number(prior.resulting_balance),idempotent:true};
      }
      const current=Number(balanceRow?.balance ?? 0);
      if (d.operation==="deduct" && d.points>current) throw new Error("insufficient_balance");
      const amount=d.operation==="award"?d.points:-d.points;
      const balance=current+amount;
      await tx.execute(sql`UPDATE classroom_reward_class_balances SET balance=${balance},updated_at=NOW() WHERE teacher_id=${teacherId} AND teacher_class_id=${classRow.id}`);
      const transaction=resultRows(await tx.execute(sql`
        INSERT INTO classroom_reward_class_transactions(teacher_id,teacher_class_id,idempotency_key,operation,amount,resulting_balance,reason)
        VALUES (${teacherId},${classRow.id},${d.idempotencyKey},${d.operation},${amount},${balance},${reason}) RETURNING *
      `))[0];
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs(teacher_id,action,entity_type,entity_id,idempotency_key,detail) VALUES (${teacherId},${d.operation==="award"?"award_class_balance":"deduct_class_balance"},'teacher_class',${classRow.id},${d.idempotencyKey},${reason})`);
      return {transaction,balance,idempotent:false};
    });
    res.status(outcome.idempotent?200:201).json({
      balance:outcome.balance,idempotent:outcome.idempotent,
      transaction:{id:Number(outcome.transaction.id),operation:outcome.transaction.operation,amount:Number(outcome.transaction.amount),resultingBalance:Number(outcome.transaction.resulting_balance),reason:outcome.transaction.reason,createdAt:outcome.transaction.created_at},
    });
  } catch(error:any) {
    if (error?.message==="class_not_found") return res.status(404).json({message:"الصف غير موجود"});
    if (error?.message==="insufficient_balance") return res.status(409).json({message:"لا يمكن أن يتجاوز الخصم رصيد الصف الحالي"});
    if (error?.message==="idempotency_conflict" || error?.code==="23505" || error?.cause?.code==="23505") return res.status(409).json({message:"مفتاح التكرار مستخدم لعملية مختلفة"});
    res.status(500).json({message:"تعذر تعديل نقاط الصف"});
  }
});

router.put("/classroom-rewards/classes/:className/groups/:groupId/members", async (req: any, res) => {
  const teacherId = teacher(req, res), groupId = numericId(req.params.groupId); if (!teacherId) return;
  if (!groupId) return res.status(400).json({ message: "معرف المجموعة غير صالح" });
  const className = validateClassName(req.params.className); if (!className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const parsed = groupMembersInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "قائمة الطلاب غير صالحة" });
  const ids = parsed.data.studentIds;
  if (new Set(ids).size !== ids.length) return res.status(400).json({ message: "لا يمكن تكرار الطالب في المجموعة نفسها" });
  try {
    const members = await db.transaction(async (tx) => {
      const classRow = resultRows(await tx.execute(sql`SELECT id FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${className} FOR UPDATE`))[0];
      if (!classRow) throw new Error("class_not_found");
      const group = resultRows(await tx.execute(sql`SELECT id FROM classroom_reward_groups WHERE id=${groupId} AND teacher_id=${teacherId} AND teacher_class_id=${classRow.id} FOR UPDATE`))[0];
      if (!group) throw new Error("group_not_found");
      const students = ids.length ? resultRows(await tx.execute(sql`SELECT id,name FROM students WHERE teacher_id=${teacherId} AND id IN (${sql.join(ids.map((id) => sql`${id}`), sql`,`)}) AND (student_class=${className} OR (student_class IS NULL AND grade_level=${className})) FOR UPDATE`)) : [];
      if (students.length !== ids.length) throw new Error("invalid_students");
      await tx.execute(sql`DELETE FROM classroom_reward_group_members WHERE teacher_id=${teacherId} AND group_id=${groupId}`);
      for (const student of students) {
        await tx.execute(sql`INSERT INTO classroom_reward_group_members (teacher_id,group_id,student_id) VALUES (${teacherId},${groupId},${student.id})`);
      }
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,detail) VALUES (${teacherId},'replace_members','reward_group',${groupId},${String(ids.length)})`);
      return students.map((student) => ({ studentId:Number(student.id),name:student.name }));
    });
    res.json({ groupId, members });
  } catch (error: any) {
    if (error?.message === "class_not_found") return res.status(404).json({ message: "الصف غير موجود" });
    if (error?.message === "group_not_found") return res.status(404).json({ message: "المجموعة غير موجودة" });
    if (error?.message === "invalid_students") return res.status(403).json({ message: "كل الطلاب يجب أن يكونوا ضمن الصف نفسه" });
    res.status(500).json({ message: "تعذر حفظ طلاب المجموعة" });
  }
});

router.delete("/classroom-rewards/classes/:className/groups/:groupId", async (req: any, res) => {
  const teacherId = teacher(req, res), groupId = numericId(req.params.groupId); if (!teacherId) return;
  if (!groupId) return res.status(400).json({ message: "معرف المجموعة غير صالح" });
  const className = validateClassName(req.params.className); if (!className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const classRow = await ownedClass(teacherId, className); if (!classRow) return res.status(404).json({ message: "الصف غير موجود" });
  const deleted = resultRows(await db.execute(sql`DELETE FROM classroom_reward_groups WHERE id=${groupId} AND teacher_id=${teacherId} AND teacher_class_id=${classRow.id} RETURNING id`))[0];
  if (!deleted) return res.status(404).json({ message: "المجموعة غير موجودة" });
  await db.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,detail) VALUES (${teacherId},'delete','reward_group',${groupId},${className})`);
  res.json({ deleted: true });
});

router.post("/classroom-rewards/grants", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const parsed = grantInput.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "بيانات المنح غير صالحة" });
  const d = parsed.data;
  const fingerprint = classroomRewardFingerprint(d);
  try {
    const outcome = await db.transaction(async (tx) => {
      // Fast replay check occurs before type validation: a valid old request must
      // remain replayable even if its configured type was later deactivated.
      const priorBatch = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_batches WHERE teacher_id=${teacherId} AND idempotency_key=${d.idempotencyKey} FOR UPDATE`))[0];
      if (priorBatch) {
        if (priorBatch.request_fingerprint !== fingerprint) throw new Error("idempotency_conflict");
        const replay = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE batch_id=${priorBatch.id} ORDER BY id`));
        return { grants: replay, replay: true };
      }
      let type: any;
      const classRow = resultRows(await tx.execute(sql`SELECT id,name FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${d.className} FOR UPDATE`))[0];
      if (!classRow) throw new Error("invalid_class");
      if (d.typeId) {
        type = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_types WHERE id=${d.typeId} AND teacher_id=${teacherId} AND is_active=TRUE FOR UPDATE`))[0];
        if (!type) throw new Error("invalid_type");
      }
      const points = d.customReason ? d.customPoints! : type.default_amount;
      const reason = d.customReason ?? type.name;
      const createdBatch = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_batches (teacher_id,idempotency_key,class_name_snapshot,teacher_class_id,reward_type_id,reason_snapshot,points,target_count,request_fingerprint) VALUES (${teacherId},${d.idempotencyKey},${d.className},${classRow.id},${d.typeId ?? null},${reason},${points},${d.studentIds.length},${fingerprint}) ON CONFLICT (teacher_id,idempotency_key) DO NOTHING RETURNING *`))[0];
      if (!createdBatch) {
        const batch = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_batches WHERE teacher_id=${teacherId} AND idempotency_key=${d.idempotencyKey} FOR UPDATE`))[0];
        if (batch.request_fingerprint !== fingerprint) throw new Error("idempotency_conflict");
        const replay = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE batch_id=${batch.id} ORDER BY id`));
        return { grants: replay, replay: true };
      }
      if (!type) {
        // Reserve a non-display namespace so a custom reason can never mutate a teacher's configured type.
        const internalName = `__custom__:${d.customReason!}`;
        const inserted = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_types (teacher_id,name,category,default_amount,icon,color,sort_order,is_active) VALUES (${teacherId},${internalName},'custom',${d.customPoints!},'Star','#468064',9999,FALSE) ON CONFLICT (teacher_id,name) DO UPDATE SET default_amount=EXCLUDED.default_amount RETURNING *`));
        type = inserted[0];
        await tx.execute(sql`UPDATE classroom_reward_batches SET reward_type_id=${type.id} WHERE id=${createdBatch.id}`);
      }
      const students = resultRows(await tx.execute(sql`SELECT id,name FROM students WHERE teacher_id=${teacherId} AND id IN (${sql.join(d.studentIds.map((v) => sql`${v}`), sql`,`)}) AND (student_class=${d.className} OR (student_class IS NULL AND grade_level=${d.className})) FOR UPDATE`));
      // Exact cardinality makes cross-owner IDs, duplicates, and other-class IDs reject the entire batch.
      if (students.length !== d.studentIds.length || new Set(d.studentIds).size !== d.studentIds.length) throw new Error("invalid_students");
      const output: any[] = [];
      for (const student of students) {
        const inserted = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_transactions (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,batch_id,batch_key,class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot) VALUES (${teacherId},${student.id},${student.name},${type.id},${points},'grant',${d.idempotencyKey},${createdBatch.id},${d.idempotencyKey},${d.className},${classRow.id},${reason},${type.category}) ON CONFLICT (teacher_id,idempotency_key,student_id) DO NOTHING RETURNING *`))[0];
        if (inserted) {
          await tx.execute(sql`INSERT INTO classroom_reward_balances (teacher_id,student_id,reward_type_id,balance,updated_at) VALUES (${teacherId},${student.id},${type.id},${points},NOW()) ON CONFLICT (teacher_id,student_id,reward_type_id) DO UPDATE SET balance=classroom_reward_balances.balance+EXCLUDED.balance,updated_at=NOW()`);
          output.push(inserted);
        }
      }
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,idempotency_key,detail) VALUES (${teacherId},'grant_batch','class',${d.idempotencyKey},${d.className})`);
      return { grants: output, replay: false };
    });
    res.status(outcome.replay ? 200 : 201).json({ grants: outcome.grants, idempotent: outcome.replay });
  } catch (error: any) {
    if (error?.message === "invalid_students") return res.status(403).json({ message: "كل الطلاب يجب أن يكونوا ضمن صف المعلم" });
    if (error?.message === "invalid_type") return res.status(404).json({ message: "نوع التحفيز غير موجود" });
    if (error?.message === "invalid_class") return res.status(404).json({ message: "الصف غير موجود" });
    if (error?.message === "idempotency_conflict") return res.status(409).json({ message: "مفتاح التكرار مستخدم لطلب مختلف" });
    res.status(500).json({ message: "حدث خطأ" });
  }
});

router.post("/classroom-rewards/students/:studentId/balance-adjustments", async (req: any, res) => {
  const teacherId = teacher(req, res), studentId = numericId(req.params.studentId);
  if (!teacherId) return;
  if (!studentId) return res.status(400).json({ message: "معرف غير صالح" });
  const parsed = balanceAdjustmentInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "بيانات تعديل الرصيد غير صالحة" });
  const d = parsed.data;
  try {
    const outcome = await db.transaction(async (tx) => {
      const student = resultRows(await tx.execute(sql`SELECT id,name,student_class,grade_level FROM students WHERE id=${studentId} AND teacher_id=${teacherId} FOR UPDATE`))[0];
      if (!student) throw new Error("student_not_found");

      const prior = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE teacher_id=${teacherId} AND student_id=${studentId} AND idempotency_key=${d.idempotencyKey} FOR UPDATE`))[0];
      const displayReason = d.reason?.trim() || "خصم نقاط";
      if (prior) {
        if (prior.kind !== "adjustment" || Number(prior.amount) !== -d.points || prior.reward_type_name_snapshot !== displayReason) {
          throw new Error("idempotency_conflict");
        }
        const current = resultRows(await tx.execute(sql`SELECT COALESCE(SUM(balance),0)::int points FROM classroom_reward_balances WHERE teacher_id=${teacherId} AND student_id=${studentId}`))[0];
        return { entry: prior, balance: Number(current?.points ?? 0), idempotent: true };
      }

      const balanceRows = resultRows(await tx.execute(sql`SELECT balance FROM classroom_reward_balances WHERE teacher_id=${teacherId} AND student_id=${studentId} FOR UPDATE`));
      const currentBalance = balanceRows.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
      if (d.points > currentBalance) throw new Error("insufficient_balance");

      const type = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_types (teacher_id,name,category,default_amount,icon,color,sort_order,is_active) VALUES (${teacherId},'__balance_adjustment__','adjustment',1,'Target','#468064',10000,FALSE) ON CONFLICT (teacher_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`))[0];
      const className = student.student_class || student.grade_level || null;
      const classRow = className ? resultRows(await tx.execute(sql`SELECT id FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${className}`))[0] : null;
      const entry = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_transactions (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot) VALUES (${teacherId},${studentId},${student.name},${type.id},${-d.points},'adjustment',${d.idempotencyKey},${className},${classRow?.id ?? null},${displayReason},'adjustment') RETURNING *`))[0];
      await tx.execute(sql`INSERT INTO classroom_reward_balances (teacher_id,student_id,reward_type_id,balance,updated_at) VALUES (${teacherId},${studentId},${type.id},${-d.points},NOW()) ON CONFLICT (teacher_id,student_id,reward_type_id) DO UPDATE SET balance=classroom_reward_balances.balance+EXCLUDED.balance,updated_at=NOW()`);
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,idempotency_key,detail) VALUES (${teacherId},'adjust_balance','student',${studentId},${d.idempotencyKey},${d.reason ?? null})`);
      return { entry, balance: currentBalance - d.points, idempotent: false };
    });
    res.status(outcome.idempotent ? 200 : 201).json(outcome);
  } catch (error: any) {
    if (error?.message === "student_not_found") return res.status(404).json({ message: "الطالب غير موجود" });
    if (error?.message === "insufficient_balance") return res.status(409).json({ message: "لا يمكن أن يتجاوز التعديل رصيد الطالب الحالي" });
    if (error?.message === "idempotency_conflict" || error?.code === "23505" || error?.cause?.code === "23505") {
      return res.status(409).json({ message: "مفتاح التكرار مستخدم لتعديل مختلف" });
    }
    res.status(500).json({ message: "تعذر تعديل الرصيد" });
  }
});

router.post("/classroom-rewards/balance-adjustments", async (req: any, res) => {
  const teacherId = teacher(req, res);
  if (!teacherId) return;
  const parsed = bulkBalanceAdjustmentInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "بيانات تعديل الأرصدة غير صالحة" });
  const d = parsed.data;
  const fingerprint = JSON.stringify({
    className: d.className,
    studentIds: [...d.studentIds].sort((a, b) => a - b),
    points: d.points,
    reason: d.reason ?? null,
  });
  const displayReason = d.reason?.trim() || "خصم نقاط";
  try {
    const outcome = await db.transaction(async (tx) => {
      const priorBatch = resultRows(await tx.execute(sql`
        SELECT * FROM classroom_reward_batches
        WHERE teacher_id=${teacherId} AND idempotency_key=${d.idempotencyKey}
        FOR UPDATE
      `))[0];
      if (priorBatch) {
        if (priorBatch.request_fingerprint !== fingerprint) throw new Error("idempotency_conflict");
        const replay = resultRows(await tx.execute(sql`
          SELECT tr.student_id,tr.student_name_snapshot,
            COALESCE((SELECT SUM(balance) FROM classroom_reward_balances b WHERE b.teacher_id=${teacherId} AND b.student_id=tr.student_id),0)::int balance
          FROM classroom_reward_transactions tr
          WHERE tr.teacher_id=${teacherId} AND tr.batch_id=${priorBatch.id} AND tr.kind='adjustment'
          ORDER BY tr.id
        `));
        return {
          adjusted: replay.map((row) => ({ studentId: row.student_id, studentName: row.student_name_snapshot, balance: Number(row.balance) })),
          excluded: [],
          idempotent: true,
        };
      }

      const classRow = resultRows(await tx.execute(sql`
        SELECT id FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${d.className} FOR UPDATE
      `))[0];
      if (!classRow) throw new Error("invalid_class");
      const students = resultRows(await tx.execute(sql`
        SELECT id,name FROM students
        WHERE teacher_id=${teacherId}
          AND id IN (${sql.join(d.studentIds.map((id) => sql`${id}`), sql`,`)})
          AND (student_class=${d.className} OR grade_level=${d.className})
        ORDER BY id FOR UPDATE
      `));
      if (students.length !== d.studentIds.length) throw new Error("invalid_students");

      await tx.execute(sql`
        SELECT id FROM classroom_reward_balances
        WHERE teacher_id=${teacherId}
          AND student_id IN (${sql.join(d.studentIds.map((id) => sql`${id}`), sql`,`)})
        ORDER BY student_id,id FOR UPDATE
      `);
      const balances = resultRows(await tx.execute(sql`
        SELECT s.id student_id,COALESCE(SUM(b.balance),0)::int balance
        FROM students s
        LEFT JOIN classroom_reward_balances b ON b.teacher_id=${teacherId} AND b.student_id=s.id
        WHERE s.id IN (${sql.join(d.studentIds.map((id) => sql`${id}`), sql`,`)})
        GROUP BY s.id ORDER BY s.id
      `));
      const balanceByStudent = new Map(balances.map((row) => [Number(row.student_id), Number(row.balance)]));
      const eligible = students.filter((student) => (balanceByStudent.get(Number(student.id)) ?? 0) >= d.points);
      const excluded = students
        .filter((student) => (balanceByStudent.get(Number(student.id)) ?? 0) < d.points)
        .map((student) => ({
          studentId: Number(student.id),
          studentName: student.name,
          balance: balanceByStudent.get(Number(student.id)) ?? 0,
          reason: "الرصيد الحالي لا يكفي",
        }));

      const type = resultRows(await tx.execute(sql`
        INSERT INTO classroom_reward_types (teacher_id,name,category,default_amount,icon,color,sort_order,is_active)
        VALUES (${teacherId},'__balance_adjustment__','adjustment',1,'Target','#468064',10000,FALSE)
        ON CONFLICT (teacher_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id
      `))[0];
      const batch = resultRows(await tx.execute(sql`
        INSERT INTO classroom_reward_batches
          (teacher_id,idempotency_key,class_name_snapshot,teacher_class_id,reward_type_id,reason_snapshot,points,target_count,request_fingerprint)
        VALUES
          (${teacherId},${d.idempotencyKey},${d.className},${classRow.id},${type.id},${displayReason},${d.points},${d.studentIds.length},${fingerprint})
        ON CONFLICT (teacher_id,idempotency_key) DO NOTHING
        RETURNING id
      `))[0];
      if (!batch) {
        const concurrentBatch = resultRows(await tx.execute(sql`
          SELECT * FROM classroom_reward_batches
          WHERE teacher_id=${teacherId} AND idempotency_key=${d.idempotencyKey}
          FOR UPDATE
        `))[0];
        if (!concurrentBatch || concurrentBatch.request_fingerprint !== fingerprint) throw new Error("idempotency_conflict");
        const replay = resultRows(await tx.execute(sql`
          SELECT tr.student_id,tr.student_name_snapshot,
            COALESCE((SELECT SUM(balance) FROM classroom_reward_balances b WHERE b.teacher_id=${teacherId} AND b.student_id=tr.student_id),0)::int balance
          FROM classroom_reward_transactions tr
          WHERE tr.teacher_id=${teacherId} AND tr.batch_id=${concurrentBatch.id} AND tr.kind='adjustment'
          ORDER BY tr.id
        `));
        return {
          adjusted: replay.map((row) => ({ studentId: row.student_id, studentName: row.student_name_snapshot, balance: Number(row.balance) })),
          excluded: [],
          idempotent: true,
        };
      }
      const adjusted: any[] = [];
      for (const student of eligible) {
        const currentBalance = balanceByStudent.get(Number(student.id)) ?? 0;
        await tx.execute(sql`
          INSERT INTO classroom_reward_transactions
            (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,batch_id,batch_key,class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot)
          VALUES
            (${teacherId},${student.id},${student.name},${type.id},${-d.points},'adjustment',${d.idempotencyKey},${batch.id},${d.idempotencyKey},${d.className},${classRow.id},${displayReason},'adjustment')
        `);
        await tx.execute(sql`
          INSERT INTO classroom_reward_balances (teacher_id,student_id,reward_type_id,balance,updated_at)
          VALUES (${teacherId},${student.id},${type.id},${-d.points},NOW())
          ON CONFLICT (teacher_id,student_id,reward_type_id)
          DO UPDATE SET balance=classroom_reward_balances.balance+EXCLUDED.balance,updated_at=NOW()
        `);
        adjusted.push({ studentId: Number(student.id), studentName: student.name, balance: currentBalance - d.points });
      }
      await tx.execute(sql`
        INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,idempotency_key,detail)
        VALUES (${teacherId},'adjust_balance_batch','class',${classRow.id},${d.idempotencyKey},${d.reason ?? null})
      `);
      return { adjusted, excluded, idempotent: false };
    });
    res.status(outcome.idempotent ? 200 : 201).json(outcome);
  } catch (error: any) {
    if (error?.message === "invalid_class") return res.status(404).json({ message: "الصف غير موجود" });
    if (error?.message === "invalid_students") return res.status(403).json({ message: "كل الطلاب يجب أن يكونوا ضمن صف المعلم" });
    if (error?.message === "idempotency_conflict" || error?.code === "23505" || error?.cause?.code === "23505") {
      return res.status(409).json({ message: "مفتاح التكرار مستخدم لتعديل مختلف" });
    }
    res.status(500).json({ message: "تعذر تعديل أرصدة الطلاب" });
  }
});

router.get("/classroom-rewards/ledger", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const className = req.query.className === undefined ? undefined : validateClassName(req.query.className);
  if (req.query.className !== undefined && !className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const classRow = className ? await ownedClass(teacherId, className) : null;
  if (className && !classRow) return res.status(404).json({ message: "الصف غير موجود" });
  const studentId = req.query.studentId === undefined ? null : numericId(req.query.studentId);
  if (req.query.studentId !== undefined && !studentId) return res.status(400).json({ message: "معرف غير صالح" });
  const start = periodStart(typeof req.query.period === "string" ? req.query.period : undefined);
  const found = resultRows(await db.execute(sql`
    SELECT tr.id,COALESCE(s.name,tr.student_name_snapshot) AS student_name,tr.reward_type_name_snapshot AS reason,tr.amount AS points,tr.created_at,tr.source_type,tr.source_result_id,tr.rule_id,COALESCE(ev.rule_name_snapshot,r.name) rule_name,ev.evidence_summary,
      EXISTS(SELECT 1 FROM classroom_reward_transactions rv WHERE rv.reversal_of_id=tr.id) AS is_reversed
    FROM classroom_reward_transactions tr LEFT JOIN students s ON s.id=tr.student_id LEFT JOIN classroom_reward_rules r ON r.id=tr.rule_id LEFT JOIN classroom_reward_rule_evaluations ev ON ev.transaction_id=tr.id
    WHERE tr.teacher_id=${teacherId} AND tr.kind='grant'
    ${className ? sql`AND (tr.teacher_class_id=${classRow!.id} OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=${className} AND tr.created_at>=${classRow!.created_at}))` : sql``}
    ${studentId ? sql`AND tr.student_id=${studentId}` : sql``}
    ${start ? sql`AND tr.created_at>=${start}` : sql``}
    ORDER BY tr.created_at DESC,tr.id DESC LIMIT 500
  `));
  res.json(found.map((r) => ({ id: r.id, studentName: r.student_name, reason: r.reason, points: r.points, createdAt: r.created_at, isReversed: r.is_reversed, ruleName:r.rule_name, sourceType:r.source_type, sourceId:r.source_result_id, evidenceSummary:r.evidence_summary })));
});
const blankToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const controlProfileInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  gradeLevel: z.preprocess(blankToNull, z.string().trim().max(100).nullish()),
  studentClass: z.preprocess(blankToNull, z.string().trim().max(100).nullish()),
  parentPhone: z.preprocess(blankToNull, z.string().trim().max(100).nullish()),
  parentName: z.preprocess(blankToNull, z.string().trim().max(200).nullish()),
  parentEmail: z.preprocess(blankToNull, z.string().trim().email().max(320).nullish()),
  notes: z.preprocess(blankToNull, z.string().max(5000).nullish()),
  avatar: z.preprocess(blankToNull, z.string().refine(
    (v) => NORMAL_AVATARS.has(v) || STUDENT_AVATAR_OBJECT.test(v),
    "invalid avatar",
  ).nullish()),
}).strict();

router.post("/classroom-rewards/students/:studentId/avatar-upload", async (req: any, res) => {
  const teacherId = teacher(req, res), studentId = numericId(req.params.studentId);
  if (!teacherId) return;
  if (!studentId) return res.status(400).json({ message: "معرف الطالب غير صالح" });
  const parsed = z.object({
    name: z.string().trim().min(1).max(255),
    size: z.number().int().positive().max(STUDENT_AVATAR_MAX_BYTES),
    contentType: z.string().refine((value) => STUDENT_AVATAR_TYPES.has(value)),
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "اختر صورة JPG أو PNG أو WebP أو AVIF بحجم لا يتجاوز 5 ميجابايت" });
  }
  const owned = resultRows(await db.execute(sql`SELECT id FROM students WHERE id=${studentId} AND teacher_id=${teacherId}`))[0];
  if (!owned) return res.status(404).json({ message: "الطالب غير موجود" });
  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL(`student-avatars/${teacherId}/${studentId}`);
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (error) {
    req.log.error({ err: error, teacherId, studentId }, "Failed to create student avatar upload URL");
    res.status(500).json({ message: "تعذر تجهيز رفع صورة الطالب" });
  }
});

router.get("/classroom-rewards/students/:studentId/avatar", async (req: any, res) => {
  const teacherId = teacher(req, res), studentId = numericId(req.params.studentId);
  if (!teacherId) return;
  if (!studentId) return res.status(400).json({ message: "معرف الطالب غير صالح" });
  const student = resultRows(await db.execute(sql`SELECT avatar FROM students WHERE id=${studentId} AND teacher_id=${teacherId}`))[0];
  if (!student || typeof student.avatar !== "string" || !STUDENT_AVATAR_OBJECT.test(student.avatar)) {
    return res.status(404).json({ message: "صورة الطالب غير موجودة" });
  }
  try {
    const file = await objectStorage.getObjectEntityFile(student.avatar);
    const [metadata] = await file.getMetadata();
    const contentType = String(metadata.contentType || "");
    if (!STUDENT_AVATAR_TYPES.has(contentType)) return res.status(404).json({ message: "صورة الطالب غير موجودة" });
    const signedUrl = await objectStorage.signFileDownloadUrl(file, 300);
    res.setHeader("Cache-Control", "private, no-store");
    res.redirect(302, signedUrl);
  } catch (error) {
    if (!(error instanceof ObjectNotFoundError)) {
      req.log.error({ err: error, teacherId, studentId }, "Failed to serve student avatar");
    }
    res.status(404).json({ message: "صورة الطالب غير موجودة" });
  }
});

/** Compact, owner-scoped control-center payload; secrets and assignment codes are never selected. */
router.get("/classroom-rewards/students/:studentId", async (req: any, res) => {
  const teacherId = teacher(req, res), studentId = numericId(req.params.studentId);
  if (!teacherId) return; if (!studentId) return res.status(400).json({ message: "معرف غير صالح" });
  const student = resultRows(await db.execute(sql`SELECT s.id,s.name,s.grade_level,s.student_class,s.parent_phone,s.parent_name,s.parent_email,s.notes,s.avatar,s.student_account_id,sa.username account_username,sa.display_name account_display_name,(s.student_account_id IS NOT NULL AND sa.id IS NOT NULL) account_linked FROM students s LEFT JOIN student_accounts sa ON sa.id=s.student_account_id WHERE s.id=${studentId} AND s.teacher_id=${teacherId}`))[0];
  if (!student) return res.status(404).json({ message: "الطالب غير موجود" });
  const balance = resultRows(await db.execute(sql`SELECT COALESCE(SUM(balance),0)::int points FROM classroom_reward_balances WHERE teacher_id=${teacherId} AND student_id=${studentId}`))[0];
  const ledger = resultRows(await db.execute(sql`SELECT id,amount AS points,kind,reward_type_name_snapshot AS reason,created_at FROM classroom_reward_transactions WHERE teacher_id=${teacherId} AND student_id=${studentId} ORDER BY created_at DESC,id DESC LIMIT 20`));
  const assignments = resultRows(await db.execute(sql`SELECT a.id,a.title,a.subject,a.deadline,a.total_points,s.score,COALESCE(s.teacher_adjusted_points,s.earned_points) earned_points,s.submitted_at FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.teacher_id=${teacherId} AND s.student_id=${studentId} ORDER BY s.submitted_at DESC,s.id DESC LIMIT 20`));
  const achievements = student.student_account_id
    ? resultRows(await db.execute(sql`SELECT d.id,d.title,d.description,d.icon_key,g.granted_at FROM motivation_badge_grants g JOIN motivation_badge_definitions d ON d.id=g.badge_definition_id AND d.teacher_id=${teacherId} JOIN kids_profiles kp ON kp.id=g.profile_id AND kp.student_account_id=${student.student_account_id} ORDER BY g.granted_at DESC LIMIT 20`))
    : [];
  const activity = student.student_account_id ? resultRows(await db.execute(sql`SELECT action,event_category,created_at FROM activity_logs WHERE user_id=${student.student_account_id} AND user_role='student' ORDER BY created_at DESC,id DESC LIMIT 20`)) : [];
  const className=student.student_class??student.grade_level;
  const classRow=className?await ownedClass(teacherId,className):null;
  const activeGoals=classRow?resultRows(await db.execute(sql`SELECT g.*,tc.name class_name FROM classroom_reward_goals g JOIN teacher_classes tc ON tc.id=g.teacher_class_id WHERE g.teacher_id=${teacherId} AND g.teacher_class_id=${classRow.id} AND g.status='active' AND g.is_active=TRUE AND (g.ends_at IS NULL OR g.ends_at>=NOW()) ORDER BY (g.student_id IS NOT NULL) DESC,g.created_at DESC,g.id DESC`)): [];
  const goalRow=activeGoals.find(g=>Number(g.student_id)===studentId)??activeGoals.find(g=>g.student_id==null)??null;
  const goal=goalRow?goalObject(goalRow):null;
  const goalProgress=goal&&classRow?Number(resultRows(await db.execute(sql`SELECT COALESCE(SUM(tr.amount),0)::int progress FROM classroom_reward_transactions tr WHERE tr.teacher_id=${teacherId} AND tr.student_id=${studentId} AND tr.kind='grant' AND (tr.teacher_class_id=${classRow.id} OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=${className} AND tr.created_at>=${classRow.created_at})) AND tr.created_at>=${new Date(goal.startsAt)} AND (${goal.endsAt?sql`tr.created_at<=${new Date(goal.endsAt)}`:sql`TRUE`}) AND (${goal.rewardTypeId?sql`tr.reward_type_id=${goal.rewardTypeId}`:sql`TRUE`}) AND NOT EXISTS (SELECT 1 FROM classroom_reward_transactions rv WHERE rv.reversal_of_id=tr.id)`))[0]?.progress??0):0;
  res.json({
    student: { id:student.id,name:student.name,gradeLevel:student.grade_level,studentClass:student.student_class,parentPhone:student.parent_phone,parentName:student.parent_name,parentEmail:student.parent_email,notes:student.notes,avatar:serializedStudentAvatar(student.id,student.avatar),account:{linked:Boolean(student.account_linked),username:student.account_linked?student.account_username:null,displayName:student.account_linked?student.account_display_name:null} },
    rewards:{balance:Number(balance?.points??0),ledger:ledger.map((r)=>({id:r.id,points:Number(r.points),kind:r.kind,reason:r.reason,createdAt:r.created_at}))},
    achievements:achievements.map((r)=>({id:r.id,title:r.title,description:r.description,icon:r.icon_key,grantedAt:r.granted_at})),
    assignments:assignments.map((r)=>({id:r.id,title:r.title,subject:r.subject,deadline:r.deadline,totalPoints:r.total_points,score:r.score,earnedPoints:r.earned_points,submittedAt:r.submitted_at})),
    activity:activity.map((r)=>({action:r.action,category:r.event_category,createdAt:r.created_at})),
    goal:goal?{...goal,progress:goalProgress,remaining:Math.max(0,goal.targetPoints-goalProgress)}:null,
  });
});

router.patch(["/classroom-rewards/students/:studentId/profile", "/classroom-rewards/students/:studentId"], async (req: any, res) => {
  const teacherId=teacher(req,res), studentId=numericId(req.params.studentId); if(!teacherId)return; if(!studentId)return res.status(400).json({message:"معرف غير صالح"});
  const parsed=controlProfileInput.safeParse(req.body);
  if(!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message = field === "parentEmail" ? "البريد الإلكتروني لولي الأمر غير صالح" : field === "avatar" ? "شخصية الطالب المختارة غير معتمدة" : "بيانات الطالب غير صالحة";
    return res.status(400).json({message});
  }
  if(!Object.keys(parsed.data).length)return res.status(400).json({message:"لا توجد تغييرات للحفظ"});
  const owned=resultRows(await db.execute(sql`SELECT id,avatar FROM students WHERE id=${studentId} AND teacher_id=${teacherId}`))[0]; if(!owned)return res.status(404).json({message:"الطالب غير موجود"});
  const d=parsed.data;
  if (typeof d.avatar === "string" && STUDENT_AVATAR_OBJECT.test(d.avatar)) {
    const match = d.avatar.match(STUDENT_AVATAR_OBJECT);
    if (!match || Number(match[1]) !== teacherId || Number(match[2]) !== studentId) {
      return res.status(400).json({ message: "صورة الطالب لا تتبع هذا الحساب" });
    }
    try {
      const file = await objectStorage.getObjectEntityFile(d.avatar);
      const [metadata] = await file.getMetadata();
      const contentType = String(metadata.contentType || "");
      const size = Number(metadata.size || 0);
      if (!STUDENT_AVATAR_TYPES.has(contentType) || !Number.isFinite(size) || size < 1 || size > STUDENT_AVATAR_MAX_BYTES) {
        return res.status(400).json({ message: "ملف صورة الطالب غير صالح" });
      }
    } catch (error) {
      req.log.warn({ err: error, teacherId, studentId }, "Student avatar verification failed");
      return res.status(400).json({ message: "لم يكتمل رفع صورة الطالب" });
    }
  }
  const updates = [
    d.name !== undefined ? sql`name=${d.name}` : null,
    d.gradeLevel !== undefined ? sql`grade_level=${d.gradeLevel}` : null,
    d.studentClass !== undefined ? sql`student_class=${d.studentClass}` : null,
    d.parentPhone !== undefined ? sql`parent_phone=${d.parentPhone}` : null,
    d.parentName !== undefined ? sql`parent_name=${d.parentName}` : null,
    d.parentEmail !== undefined ? sql`parent_email=${d.parentEmail}` : null,
    d.notes !== undefined ? sql`notes=${d.notes}` : null,
    d.avatar !== undefined ? sql`avatar=${d.avatar}` : null,
  ].filter((v): v is ReturnType<typeof sql> => v !== null);
  const row=resultRows(await db.execute(sql`UPDATE students SET ${sql.join(updates, sql`, `)} WHERE id=${studentId} AND teacher_id=${teacherId} RETURNING id,name,grade_level,student_class,parent_phone,parent_name,parent_email,notes,avatar`))[0];
  if (
    typeof owned.avatar === "string"
    && STUDENT_AVATAR_OBJECT.test(owned.avatar)
    && owned.avatar !== row.avatar
  ) {
    objectStorage.tryDeleteObjectEntity(owned.avatar).catch((error) => {
      req.log.warn({ err: error, teacherId, studentId }, "Failed to delete replaced student avatar");
    });
  }
  res.json({student:{...row,avatar:serializedStudentAvatar(studentId,row.avatar)}});
});

router.post("/classroom-rewards/students/:studentId/reset-password", async (req:any,res) => {
  const teacherId=teacher(req,res), studentId=numericId(req.params.studentId); if(!teacherId)return; if(!studentId)return res.status(400).json({message:"معرف غير صالح"});
  const password=req.body?.newPassword; if(typeof password!=="string"||password.length<6||password.length>200)return res.status(400).json({message:"كلمة المرور يجب أن تكون بين 6 و200 حرفاً"});
  const roster=resultRows(await db.execute(sql`SELECT student_account_id FROM students WHERE id=${studentId} AND teacher_id=${teacherId}`))[0]; if(!roster)return res.status(404).json({message:"الطالب غير موجود"}); if(!roster.student_account_id)return res.status(400).json({message:"لا يوجد حساب طالب مرتبط"});
  const hash=await bcrypt.hash(password,10), account=resultRows(await db.execute(sql`UPDATE student_accounts SET password_hash=${hash} WHERE id=${roster.student_account_id} RETURNING id`))[0]; if(!account)return res.status(404).json({message:"حساب الطالب غير موجود"}); res.json({message:"تم تغيير كلمة مرور الطالب بنجاح"});
});

router.post("/classroom-rewards/ledger/:id/reverse", async (req: any, res) => {
  const teacherId = teacher(req, res), ledgerId = numericId(req.params.id); if (!teacherId) return; if (!ledgerId) return res.status(400).json({ message: "معرف غير صالح" });
  const parsed = z.object({ idempotencyKey: requestKey }).safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: "مفتاح التكرار غير صالح" });
  const d = parsed.data;
  const reversalKey = classroomRewardReversalKey(d.idempotencyKey);
  let outcome: any;
  try { outcome = await db.transaction(async (tx) => {
    const keyed = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE teacher_id=${teacherId} AND idempotency_key=${reversalKey} AND kind='reversal' FOR UPDATE`))[0];
    if (keyed) {
      if (keyed.reversal_of_id !== ledgerId) throw new Error("reversal_key_conflict");
      return { entry: keyed, idempotent: true };
    }
    const originalRef = resultRows(await tx.execute(sql`SELECT student_id FROM classroom_reward_transactions WHERE id=${ledgerId} AND teacher_id=${teacherId} AND kind='grant'`))[0];
    if (!originalRef) return null;
    if (originalRef.student_id !== null) {
      await tx.execute(sql`SELECT id FROM students WHERE id=${originalRef.student_id} AND teacher_id=${teacherId} FOR UPDATE`);
    }
    const original = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE id=${ledgerId} AND teacher_id=${teacherId} AND kind='grant' FOR UPDATE`))[0];
    if (!original) return null;
    const existing = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE reversal_of_id=${ledgerId}`))[0];
    if (existing) return { entry: existing, idempotent: true };
    if (original.student_id !== null) {
      const balances = resultRows(await tx.execute(sql`SELECT balance FROM classroom_reward_balances WHERE teacher_id=${teacherId} AND student_id=${original.student_id} FOR UPDATE`));
      const totalBalance = balances.reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
      if (Number(original.amount) > totalBalance) throw new Error("insufficient_balance_for_reversal");
    }
    const reversal = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_transactions (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,reversal_of_id,class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot) VALUES (${teacherId},${original.student_id},${original.student_name_snapshot},${original.reward_type_id},${-original.amount},'reversal',${reversalKey},${ledgerId},${original.class_name_snapshot},${original.teacher_class_id},${original.reward_type_name_snapshot},${original.category_snapshot}) RETURNING *`))[0];
    if (original.student_id !== null) await tx.execute(sql`UPDATE classroom_reward_balances SET balance=balance-${original.amount},updated_at=NOW() WHERE teacher_id=${teacherId} AND student_id=${original.student_id} AND reward_type_id=${original.reward_type_id}`);
    await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,idempotency_key) VALUES (${teacherId},'reverse','transaction',${reversal.id},${d.idempotencyKey})`);
    return { entry: reversal, idempotent: false };
  }); } catch (error: any) {
    if (error?.message === "reversal_key_conflict") return res.status(409).json({ message: "مفتاح التكرار مستخدم لحركة مختلفة" });
    if (error?.message === "insufficient_balance_for_reversal") return res.status(409).json({ message: "لا يمكن التراجع عن هذه المنحة لأن الرصيد عُدّل بعدها" });
    if (error?.code === "23505" || error?.cause?.code === "23505") {
      const existing = resultRows(await db.execute(sql`SELECT * FROM classroom_reward_transactions WHERE teacher_id=${teacherId} AND idempotency_key=${reversalKey} AND kind='reversal'`))[0];
      if (existing && existing.reversal_of_id === ledgerId) return res.json({ entry: existing, idempotent: true });
      return res.status(409).json({ message: "تعذر توحيد طلب التراجع المتزامن" });
    }
    throw error;
  }
  if (!outcome) return res.status(404).json({ message: "حركة المنح غير موجودة" });
  res.status(outcome.idempotent ? 200 : 201).json(outcome);
});

router.post("/classroom-rewards/batches/:batchId/reverse", async (req: any, res) => {
  const teacherId = teacher(req, res), batchId = numericId(req.params.batchId);
  if (!teacherId) return;
  if (!batchId) return res.status(400).json({ message: "معرف دفعة المنح غير صالح" });
  const parsed = z.object({ idempotencyKey: requestKey }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "مفتاح التكرار غير صالح" });
  const reversalKey = classroomRewardReversalKey(parsed.data.idempotencyKey);
  try {
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${teacherId},hashtext(${parsed.data.idempotencyKey}))`);
      const batch = resultRows(await tx.execute(sql`SELECT id FROM classroom_reward_batches WHERE id=${batchId} AND teacher_id=${teacherId} FOR UPDATE`))[0];
      if (!batch) return null;
      const priorReceipt = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_batch_reversals WHERE teacher_id=${teacherId} AND idempotency_key=${parsed.data.idempotencyKey} FOR UPDATE`))[0];
      if (priorReceipt && Number(priorReceipt.batch_id) !== batchId) throw new Error("reversal_key_conflict");
      if (priorReceipt) {
        const replay = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE teacher_id=${teacherId} AND batch_id=${batchId} AND kind='reversal' ORDER BY reversal_of_id`));
        return { entries: replay, idempotent: true };
      }
      const batchReceipt = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_batch_reversals WHERE teacher_id=${teacherId} AND batch_id=${batchId} FOR UPDATE`))[0];
      if (batchReceipt) {
        const replay = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE teacher_id=${teacherId} AND batch_id=${batchId} AND kind='reversal' ORDER BY reversal_of_id`));
        return { entries: replay, idempotent: true };
      }
      const grants = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE teacher_id=${teacherId} AND batch_id=${batchId} AND kind='grant' ORDER BY student_id,id FOR UPDATE`));
      if (!grants.length) return null;
      const grantIds = grants.map((grant) => Number(grant.id));
      const existing = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE teacher_id=${teacherId} AND reversal_of_id IN (${sql.join(grantIds.map((id) => sql`${id}`), sql`,`)}) ORDER BY reversal_of_id FOR UPDATE`));
      if (existing.length) {
        if (existing.length === grants.length && existing.every((entry) => entry.idempotency_key === reversalKey)) {
          return { entries: existing, idempotent: true };
        }
        throw new Error("batch_already_partially_reversed");
      }
      const studentIds = [...new Set(grants.map((grant) => Number(grant.student_id)).filter(Boolean))].sort((a, b) => a - b);
      if (studentIds.length) {
        await tx.execute(sql`SELECT id FROM students WHERE teacher_id=${teacherId} AND id IN (${sql.join(studentIds.map((id) => sql`${id}`), sql`,`)}) ORDER BY id FOR UPDATE`);
      }
      const balances = studentIds.length
        ? resultRows(await tx.execute(sql`SELECT student_id,reward_type_id,balance FROM classroom_reward_balances WHERE teacher_id=${teacherId} AND student_id IN (${sql.join(studentIds.map((id) => sql`${id}`), sql`,`)}) ORDER BY student_id,reward_type_id FOR UPDATE`))
        : [];
      for (const grant of grants) {
        const balance = balances.find((row) => Number(row.student_id) === Number(grant.student_id) && Number(row.reward_type_id) === Number(grant.reward_type_id));
        if (!balance || Number(balance.balance) < Number(grant.amount)) throw new Error("insufficient_balance_for_reversal");
      }
      const entries: any[] = [];
      for (const grant of grants) {
        const perGrantKey = `${reversalKey}:${grant.id}`;
        const reversal = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_transactions (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,reversal_of_id,batch_id,batch_key,class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot) VALUES (${teacherId},${grant.student_id},${grant.student_name_snapshot},${grant.reward_type_id},${-Number(grant.amount)},'reversal',${perGrantKey},${grant.id},${batchId},${parsed.data.idempotencyKey},${grant.class_name_snapshot},${grant.teacher_class_id},${grant.reward_type_name_snapshot},${grant.category_snapshot}) RETURNING *`))[0];
        await tx.execute(sql`UPDATE classroom_reward_balances SET balance=balance-${grant.amount},updated_at=NOW() WHERE teacher_id=${teacherId} AND student_id=${grant.student_id} AND reward_type_id=${grant.reward_type_id}`);
        entries.push(reversal);
      }
      await tx.execute(sql`INSERT INTO classroom_reward_batch_reversals (teacher_id,batch_id,idempotency_key) VALUES (${teacherId},${batchId},${parsed.data.idempotencyKey})`);
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,idempotency_key) VALUES (${teacherId},'reverse_batch','reward_batch',${batchId},${parsed.data.idempotencyKey})`);
      return { entries, idempotent: false };
    });
    if (!outcome) return res.status(404).json({ message: "دفعة المنح غير موجودة" });
    res.status(outcome.idempotent ? 200 : 201).json(outcome);
  } catch (error: any) {
    if (error?.message === "batch_already_partially_reversed") return res.status(409).json({ message: "تم التراجع عن جزء من هذه الدفعة سابقًا؛ راجع السجل" });
    if (error?.message === "reversal_key_conflict") return res.status(409).json({ message: "مفتاح التكرار مستخدم لدفعة مختلفة" });
    if (error?.message === "insufficient_balance_for_reversal") return res.status(409).json({ message: "لا يمكن التراجع عن الدفعة لأن أحد الأرصدة عُدّل بعدها" });
    throw error;
  }
});

router.get("/classroom-rewards/summary", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const className = req.query.className === undefined ? undefined : validateClassName(req.query.className);
  if (req.query.className !== undefined && !className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const classRow = className ? await ownedClass(teacherId, className) : null;
  if (className && !classRow) return res.status(404).json({ message: "الصف غير موجود" });
  const start = periodStart(typeof req.query.period === "string" ? req.query.period : undefined);
  const scope = sql`WHERE tr.teacher_id=${teacherId} AND tr.kind='grant' AND NOT EXISTS (SELECT 1 FROM classroom_reward_transactions rev WHERE rev.teacher_id=tr.teacher_id AND rev.reversal_of_id=tr.id AND rev.kind='reversal') ${className ? sql`AND (tr.teacher_class_id=${classRow!.id} OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=${className} AND tr.created_at>=${classRow!.created_at}))` : sql``} ${start ? sql`AND tr.created_at>=${start}` : sql``}`;
  const studentRows = resultRows(await db.execute(sql`SELECT tr.student_id,COALESCE(s.name,tr.student_name_snapshot) AS student_name,SUM(tr.amount)::int AS points FROM classroom_reward_transactions tr LEFT JOIN students s ON s.id=tr.student_id ${scope} GROUP BY tr.student_id,COALESCE(s.name,tr.student_name_snapshot)`));
  const typeRows = resultRows(await db.execute(sql`SELECT tr.reward_type_id,tr.reward_type_name_snapshot AS type_name,COUNT(*)::int AS count,SUM(tr.amount)::int AS points FROM classroom_reward_transactions tr ${scope} GROUP BY tr.reward_type_id,tr.reward_type_name_snapshot`));
  const recognizedStudentIds = studentRows.map((row) => Number(row.student_id)).filter(Boolean);
  const totalGrantedPoints = studentRows.reduce((sum, row) => sum + Number(row.points ?? 0), 0);
  res.json({
    studentSummaries: studentRows.map((r) => ({ studentId: r.student_id, studentName: r.student_name, points: r.points })),
    typeSummaries: typeRows.map((r) => ({ typeId: r.reward_type_id, typeName: r.type_name, count: r.count, points: r.points })),
    metrics: { totalGrantedPoints, recognizedStudentIds, recognizedStudentCount: recognizedStudentIds.length },
  });
});

export default router;