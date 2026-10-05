import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

type Executor = Pick<typeof db, "execute">;
// This entitlement is for ALL direct assistant tools, not one trial per tool.
export async function getAssistantExecutionAccess(teacherId: number, executor: Executor = db) {
  const result = await executor.execute(sql`
    SELECT p.code,
      (p.code IN ('basic','pro')
       AND s.status IN ('active','canceled','cancelled')
       AND COALESCE(s.paid_through, s.current_period_end, s.expires_at) > NOW()
       AND (s.paid_through > NOW() OR
         (s.external_subscription_id IS NULL AND s.expires_at > NOW() AND s.payment_status = 'active'))) AS entitled
    FROM subscriptions s JOIN plans p ON p.id = s.plan_id
    WHERE s.teacher_id = ${teacherId} LIMIT 1
  `);
  const subscription = result.rows[0] as { code: string; entitled: boolean } | undefined;
  const trialResult = await executor.execute(sql`
    SELECT reserved_operation_id, consumed_operation_id FROM assistant_execution_trials
    WHERE teacher_id = ${teacherId}
  `);
  const trial = trialResult.rows[0] as { reserved_operation_id: string | null; consumed_operation_id: string | null } | undefined;
  const subscribed = subscription?.entitled === true;
  const status = subscribed ? "subscription" : trial?.consumed_operation_id ? "upgrade_required" : trial?.reserved_operation_id ? "trial_reserved" : "trial_available";
  return {
    status, canExecute: status === "subscription" || status === "trial_available",
    planCode: subscribed ? subscription!.code : "free",
    reservedOperationId: trial?.reserved_operation_id ?? null,
    consumedOperationId: trial?.consumed_operation_id ?? null,
  };
}

export async function recordAssistantEvent(teacherId: number, name: string, operationId: string | null,
  metadata: Record<string, unknown> = {}, key: string = randomUUID(), executor: Executor = db) {
  await executor.execute(sql`
    INSERT INTO assistant_execution_events(teacher_id,event_name,operation_id,event_key,metadata)
    VALUES(${teacherId},${name},${operationId},${key},${JSON.stringify(metadata)}::jsonb)
    ON CONFLICT(event_key) DO NOTHING
  `);
}

export function executionAccessError(status: string) {
  return Object.assign(new Error(status), {
    status: 403, code: status === "trial_reserved" ? "EXECUTION_TRIAL_IN_PROGRESS" : "EXECUTION_SUBSCRIPTION_REQUIRED",
  });
}

/** Must run under the caller's per-teacher transaction lock, before any hold. */
export async function authorizeAssistantExecution(executor: Executor, teacherId: number, operationId: string) {
  const access = await getAssistantExecutionAccess(teacherId, executor);
  if (access.status === "subscription") return "subscription";
  if (access.status === "trial_reserved" && access.reservedOperationId === operationId) return "trial";
  if (!access.canExecute) throw executionAccessError(access.status);
  await executor.execute(sql`
    INSERT INTO assistant_execution_trials(teacher_id,reserved_operation_id)
    VALUES(${teacherId},${operationId})
    ON CONFLICT(teacher_id) DO UPDATE
    SET reserved_operation_id=${operationId}, updated_at=NOW()
    WHERE assistant_execution_trials.consumed_operation_id IS NULL
      AND assistant_execution_trials.reserved_operation_id IS NULL
  `);
  const updated = await getAssistantExecutionAccess(teacherId, executor);
  if (updated.reservedOperationId !== operationId) throw executionAccessError(updated.status);
  return "trial";
}

export async function releaseAssistantTrial(executor: Executor, teacherId: number, operationId: string, reason = "failed") {
  const result = await executor.execute(sql`
    UPDATE assistant_execution_trials SET reserved_operation_id=NULL,updated_at=NOW()
    WHERE teacher_id=${teacherId} AND reserved_operation_id=${operationId} AND consumed_operation_id IS NULL
    RETURNING teacher_id
  `);
  if (result.rows.length) {
    const name = reason === "cancelled" ? "trial_cancelled" : "trial_failed";
    await recordAssistantEvent(teacherId, name, operationId, {}, `${name}:${operationId}`, executor);
  }
}

export async function completeAssistantExecution(executor: Executor, teacherId: number, operationId: string) {
  const result = await executor.execute(sql`
    UPDATE assistant_execution_trials
    SET consumed_operation_id=${operationId}, consumed_at=NOW(),reserved_operation_id=NULL,updated_at=NOW()
    WHERE teacher_id=${teacherId} AND reserved_operation_id=${operationId} AND consumed_operation_id IS NULL
    RETURNING teacher_id
  `);
  if (result.rows.length) await recordAssistantEvent(teacherId, "trial_completed", operationId, {}, `trial_completed:${operationId}`, executor);
  await recordAssistantEvent(teacherId, "execution_completed", operationId, { tool: "worksheet" }, `execution_completed:${operationId}`, executor);
}

/** Called only within the provider-verified initial paid-invoice transaction. */
export async function recordAssistantPaidUpgrade(executor: Executor, teacherId: number, invoiceId: string, planCode: string, paidAt: Date) {
  await executor.execute(sql`
    INSERT INTO assistant_execution_events(teacher_id,event_name,operation_id,event_key,metadata,created_at)
    SELECT ${teacherId},'upgrade_paid',e.operation_id,${`upgrade_paid:${invoiceId}`},
      ${JSON.stringify({ planCode, attribution: "assistant_checkout_30d" })}::jsonb,${paidAt}
    FROM assistant_execution_events e
    WHERE e.teacher_id=${teacherId} AND e.event_name='upgrade_checkout_started'
      AND e.created_at <= ${paidAt}::timestamptz AND e.created_at >= ${paidAt}::timestamptz - INTERVAL '30 days'
    ORDER BY e.created_at DESC LIMIT 1 ON CONFLICT(event_key) DO NOTHING
  `);
}

export async function getAssistantExecutionMetrics() {
  const result = await db.execute(sql`
    SELECT event_name, COUNT(*)::int AS events, COUNT(DISTINCT teacher_id)::int AS users
    FROM assistant_execution_events WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY event_name ORDER BY event_name
  `);
  const cohort = await db.execute(sql`
    SELECT COUNT(DISTINCT t.teacher_id)::int AS trial_users,
      COUNT(DISTINCT p.teacher_id)::int AS converted_users
    FROM assistant_execution_trials t LEFT JOIN assistant_execution_events p
      ON p.teacher_id=t.teacher_id AND p.event_name='upgrade_paid'
      AND p.created_at>=t.consumed_at AND p.created_at<=t.consumed_at + INTERVAL '30 days'
    WHERE t.consumed_at > NOW() - INTERVAL '30 days'
  `);
  const counts = cohort.rows[0] as { trial_users: number; converted_users: number };
  return { days: 30, stages: result.rows, trialUsers: counts.trial_users, convertedUsers: counts.converted_users };
}
