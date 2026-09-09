import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { classroomRewardFingerprint, classroomRewardReversalKey } from "../lib/classroom-reward-fingerprint";
import { evaluateClassroomRewardEvidence } from "../lib/classroom-reward-evaluator";

const router: IRouter = Router();
const ICONS = new Set(["Star", "Heart", "ThumbsUp", "Zap", "Trophy", "Target", "Shield", "Flame", "Award", "Crown", "Lightbulb", "Rocket"]);
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

async function classStudents(teacherId: number, className: string) {
  return resultRows(await db.execute(sql`
    SELECT s.id,s.name,COALESCE(a.avatar,k.avatar_key,NULL) AS avatar,
      COALESCE(SUM(b.balance),0)::int AS points
    FROM students s
    LEFT JOIN student_accounts a ON a.id=s.student_account_id
    LEFT JOIN kids_profiles k ON k.student_account_id=s.student_account_id
    LEFT JOIN classroom_reward_balances b ON b.teacher_id=${teacherId} AND b.student_id=s.id
    WHERE s.teacher_id=${teacherId} AND (s.student_class=${className} OR s.grade_level=${className})
    GROUP BY s.id,s.name,a.avatar,k.avatar_key ORDER BY s.name
  `));
}
async function ownedClass(teacherId: number, name: string) {
  return resultRows(await db.execute(sql`SELECT id,name FROM teacher_classes WHERE teacher_id=${teacherId} AND name=${name}`))[0] ?? null;
}
router.get("/classroom-rewards/classes/:className", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const name = validateClassName(req.params.className); if (!name) return res.status(400).json({ message: "اسم الصف غير صالح" });
  res.json({ students: await classStudents(teacherId, name) });
});
// Historical alias retained for clients released before the route contract was final.
router.get("/classroom-rewards/classes/:className/students", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const name = validateClassName(req.params.className); if (!name) return res.status(400).json({ message: "اسم الصف غير صالح" });
  res.json({ students: await classStudents(teacherId, name) });
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
      const students = resultRows(await tx.execute(sql`SELECT id,name FROM students WHERE teacher_id=${teacherId} AND id IN (${sql.join(d.studentIds.map((v) => sql`${v}`), sql`,`)}) AND (student_class=${d.className} OR grade_level=${d.className}) FOR UPDATE`));
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
    ${className ? sql`AND (tr.teacher_class_id=${classRow!.id} OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=${className}))` : sql``}
    ${studentId ? sql`AND tr.student_id=${studentId}` : sql``}
    ${start ? sql`AND tr.created_at>=${start}` : sql``}
    ORDER BY tr.created_at DESC,tr.id DESC LIMIT 500
  `));
  res.json(found.map((r) => ({ id: r.id, studentName: r.student_name, reason: r.reason, points: r.points, createdAt: r.created_at, isReversed: r.is_reversed, ruleName:r.rule_name, sourceType:r.source_type, sourceId:r.source_result_id, evidenceSummary:r.evidence_summary })));
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
    const original = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE id=${ledgerId} AND teacher_id=${teacherId} AND kind='grant' FOR UPDATE`))[0];
    if (!original) return null;
    const existing = resultRows(await tx.execute(sql`SELECT * FROM classroom_reward_transactions WHERE reversal_of_id=${ledgerId}`))[0];
    if (existing) return { entry: existing, idempotent: true };
    const reversal = resultRows(await tx.execute(sql`INSERT INTO classroom_reward_transactions (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,reversal_of_id,class_name_snapshot,teacher_class_id,reward_type_name_snapshot,category_snapshot) VALUES (${teacherId},${original.student_id},${original.student_name_snapshot},${original.reward_type_id},${-original.amount},'reversal',${reversalKey},${ledgerId},${original.class_name_snapshot},${original.teacher_class_id},${original.reward_type_name_snapshot},${original.category_snapshot}) RETURNING *`))[0];
    if (original.student_id !== null) await tx.execute(sql`UPDATE classroom_reward_balances SET balance=balance-${original.amount},updated_at=NOW() WHERE teacher_id=${teacherId} AND student_id=${original.student_id} AND reward_type_id=${original.reward_type_id}`);
    await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,idempotency_key) VALUES (${teacherId},'reverse','transaction',${reversal.id},${d.idempotencyKey})`);
    return { entry: reversal, idempotent: false };
  }); } catch (error: any) {
    if (error?.message === "reversal_key_conflict") return res.status(409).json({ message: "مفتاح التكرار مستخدم لحركة مختلفة" });
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

router.get("/classroom-rewards/summary", async (req: any, res) => {
  const teacherId = teacher(req, res); if (!teacherId) return;
  const className = req.query.className === undefined ? undefined : validateClassName(req.query.className);
  if (req.query.className !== undefined && !className) return res.status(400).json({ message: "اسم الصف غير صالح" });
  const classRow = className ? await ownedClass(teacherId, className) : null;
  if (className && !classRow) return res.status(404).json({ message: "الصف غير موجود" });
  const start = periodStart(typeof req.query.period === "string" ? req.query.period : undefined);
  const scope = sql`WHERE tr.teacher_id=${teacherId} ${className ? sql`AND (tr.teacher_class_id=${classRow!.id} OR (tr.teacher_class_id IS NULL AND tr.class_name_snapshot=${className}))` : sql``} ${start ? sql`AND tr.created_at>=${start}` : sql``}`;
  const studentRows = resultRows(await db.execute(sql`SELECT tr.student_id,COALESCE(s.name,tr.student_name_snapshot) AS student_name,SUM(tr.amount)::int AS points FROM classroom_reward_transactions tr LEFT JOIN students s ON s.id=tr.student_id ${scope} GROUP BY tr.student_id,COALESCE(s.name,tr.student_name_snapshot)`));
  const typeRows = resultRows(await db.execute(sql`SELECT tr.reward_type_id,tr.reward_type_name_snapshot AS type_name,COUNT(*) FILTER (WHERE tr.kind='grant')::int AS count,SUM(tr.amount)::int AS points FROM classroom_reward_transactions tr ${scope} GROUP BY tr.reward_type_id,tr.reward_type_name_snapshot`));
  res.json({ studentSummaries: studentRows.map((r) => ({ studentId: r.student_id, studentName: r.student_name, points: r.points })), typeSummaries: typeRows.map((r) => ({ typeId: r.reward_type_id, typeName: r.type_name, count: r.count, points: r.points })) });
});

export default router;