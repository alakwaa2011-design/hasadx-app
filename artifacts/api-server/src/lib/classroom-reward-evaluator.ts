import { sql } from "drizzle-orm";

/** Serializes assignment grants with identity corrections for one submission. */
export async function lockAssignmentRewardEvidence(tx: any, teacherId: number, submissionId: number) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(
    hashtextextended(${"classroom_reward:assignment_submission:" + teacherId + ":" + submissionId}, 0)
  )`);
}

export async function hasActiveAutomaticAssignmentGrant(tx: any, teacherId: number, submissionId: number) {
  const row = (await tx.execute(sql`
    SELECT tr.id FROM classroom_reward_transactions tr
    WHERE tr.teacher_id=${teacherId} AND tr.kind='grant' AND tr.rule_id IS NOT NULL
      AND tr.source_type='assignment_submission' AND tr.source_result_id=${submissionId}
      AND NOT EXISTS (
        SELECT 1 FROM classroom_reward_transactions rv
        WHERE rv.reversal_of_id=tr.id AND rv.kind='reversal'
      )
    FOR UPDATE
  `)).rows[0];
  return Boolean(row);
}

/**
 * The only automatic-reward entry point. Callers must first persist final
 * evidence and supply the concrete students.id; it deliberately accepts no
 * names, client score, or account identifiers.
 */
export async function evaluateClassroomRewardEvidence(tx: any, evidence: {
  teacherId: number;
  sourceType: "assignment_submission" | "kids_activity_completion" | "game_history";
  sourceResultId: number;
  studentId: number;
  completed: boolean;
  score: number | null;
  evidenceSummary: Record<string, unknown>;
  ruleId?: number;
}) {
  if (evidence.sourceType === "assignment_submission") {
    await lockAssignmentRewardEvidence(tx, evidence.teacherId, evidence.sourceResultId);
  }
  const rules = (await tx.execute(sql`
    SELECT r.*, rt.name reward_type_name, rt.category reward_type_category
    FROM classroom_reward_rules r JOIN classroom_reward_types rt ON rt.id=r.reward_type_id
    WHERE r.teacher_id=${evidence.teacherId} AND r.source_type=${evidence.sourceType}
      AND r.is_enabled=TRUE ${evidence.ruleId ? sql`AND r.id=${evidence.ruleId}` : sql``}
  `)).rows as any[];
  const outcomes: any[] = [];
  for (const rule of rules) {
    const eligible = evidence.completed && (rule.condition === "completion" ||
      (rule.condition === "score_at_least" && evidence.score !== null && Number(evidence.score) >= Number(rule.threshold)));
    // A non-qualifying score is recorded in the audit trail but intentionally
    // does not consume the once receipt: a later teacher adjustment may make
    // the same final submission eligible. Grants, once made, are never undone.
    if (!eligible) {
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,detail)
        VALUES (${evidence.teacherId},'automatic_skip','reward_rule',${rule.id},${`${evidence.sourceType}:${evidence.sourceResultId}:condition_not_met`})`);
      outcomes.push({ ruleId: rule.id, outcome: "skipped" }); continue;
    }
    // Lock an existing receipt. granted/pending are terminal for this caller;
    // only a recorded failure can be retried.
    let receipt = (await tx.execute(sql`SELECT * FROM classroom_reward_rule_evaluations
      WHERE rule_id=${rule.id} AND source_type=${evidence.sourceType} AND source_result_id=${evidence.sourceResultId}
        AND student_id=${evidence.studentId} FOR UPDATE`)).rows[0] as any;
    if (receipt?.outcome === "granted" || receipt?.outcome === "pending") {
      outcomes.push({ ruleId: rule.id, outcome: "already_processed" }); continue;
    }
    if (receipt?.outcome === "failed") {
      await tx.execute(sql`UPDATE classroom_reward_rule_evaluations SET outcome='pending',detail=NULL,evidence_summary=${JSON.stringify(evidence.evidenceSummary)}::jsonb WHERE id=${receipt.id}`);
    } else receipt = (await tx.execute(sql`
      INSERT INTO classroom_reward_rule_evaluations
        (teacher_id,rule_id,source_type,source_result_id,student_id,outcome,detail,evidence_summary,rule_name_snapshot)
       VALUES (${evidence.teacherId},${rule.id},${evidence.sourceType},${evidence.sourceResultId},${evidence.studentId},
         'pending',NULL,${JSON.stringify(evidence.evidenceSummary)}::jsonb,${rule.name})
      ON CONFLICT (rule_id,source_type,source_result_id,student_id) DO NOTHING RETURNING *
    `)).rows[0] as any;
    if (!receipt) { outcomes.push({ ruleId: rule.id, outcome: "already_processed" }); continue; }
    try {
      // A savepoint ensures a failed transaction/balance write cannot survive
      // beside a failed receipt; the receipt itself remains retryable.
      await tx.execute(sql`SAVEPOINT classroom_reward_grant`);
      const student = (await tx.execute(sql`SELECT id,name,student_class,grade_level FROM students WHERE id=${evidence.studentId} AND teacher_id=${evidence.teacherId} FOR UPDATE`)).rows[0] as any;
      if (!student) throw new Error("student_not_owned");
      const key = `rule:${rule.id}:source:${evidence.sourceType}:${evidence.sourceResultId}:student:${evidence.studentId}`;
      const grant = (await tx.execute(sql`INSERT INTO classroom_reward_transactions
        (teacher_id,student_id,student_name_snapshot,reward_type_id,amount,kind,idempotency_key,
         class_name_snapshot,reward_type_name_snapshot,category_snapshot,source_type,source_result_id,rule_id)
        VALUES (${evidence.teacherId},${student.id},${student.name},${rule.reward_type_id},${rule.amount},'grant',${key},
          ${student.student_class ?? student.grade_level ?? null},${rule.reward_type_name},${rule.category_snapshot},
          ${evidence.sourceType},${evidence.sourceResultId},${rule.id})
        ON CONFLICT (teacher_id,idempotency_key,student_id) DO NOTHING RETURNING *`)).rows[0] as any;
      if (!grant) throw new Error("grant_conflict");
      await tx.execute(sql`INSERT INTO classroom_reward_balances (teacher_id,student_id,reward_type_id,balance,updated_at)
        VALUES (${evidence.teacherId},${student.id},${rule.reward_type_id},${rule.amount},NOW())
        ON CONFLICT (teacher_id,student_id,reward_type_id) DO UPDATE
        SET balance=classroom_reward_balances.balance+EXCLUDED.balance,updated_at=NOW()`);
      await tx.execute(sql`UPDATE classroom_reward_rule_evaluations SET outcome='granted',transaction_id=${grant.id} WHERE id=${receipt.id}`);
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,detail)
        VALUES (${evidence.teacherId},'automatic_grant','reward_rule',${rule.id},${`${evidence.sourceType}:${evidence.sourceResultId}:transaction:${grant.id}`})`);
      await tx.execute(sql`RELEASE SAVEPOINT classroom_reward_grant`);
      outcomes.push({ ruleId: rule.id, outcome: "granted", transactionId: grant.id });
    } catch (error: any) {
      await tx.execute(sql`ROLLBACK TO SAVEPOINT classroom_reward_grant`);
      await tx.execute(sql`UPDATE classroom_reward_rule_evaluations SET outcome='failed',detail=${String(error?.message ?? "unknown").slice(0, 300)} WHERE id=${receipt.id}`);
      await tx.execute(sql`INSERT INTO classroom_reward_audit_logs (teacher_id,action,entity_type,entity_id,detail)
        VALUES (${evidence.teacherId},'automatic_failure','reward_rule',${rule.id},${String(error?.message ?? "unknown").slice(0, 300)})`);
      outcomes.push({ ruleId: rule.id, outcome: "failed" });
    }
  }
  return outcomes;
}