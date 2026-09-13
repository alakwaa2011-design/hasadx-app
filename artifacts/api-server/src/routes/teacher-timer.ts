import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const TimerStateBody = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("running"),
    runId: z.string().uuid(),
    expectedVersion: z.number().int().min(0),
    endAt: z.string().datetime(),
    taskName: z.string().max(200).default(""),
  }),
  z.object({
    status: z.literal("paused"),
    runId: z.string().uuid(),
    expectedVersion: z.number().int().min(0),
    remainingMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
    taskName: z.string().max(200).default(""),
  }),
  z.object({
    status: z.literal("cancelled"),
    runId: z.string().uuid().nullable(),
    expectedVersion: z.number().int().min(0),
  }),
]);

router.get("/teacher/timer-state", async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const result = await pool.query<{
    status: string;
    end_at: Date | null;
    remaining_ms: number;
    task_name: string;
    run_id: string | null;
    version: number;
    client_handled_at: Date | null;
  }>(
    `SELECT status, end_at, remaining_ms, task_name, run_id, version, client_handled_at
       FROM teacher_timer_states WHERE teacher_id = $1`,
    [req.session.teacherId],
  );
  const timer = result.rows[0];
  res.json(timer ? {
    status: timer.status,
    endAt: timer.end_at?.toISOString() ?? null,
    remainingMs: timer.remaining_ms,
    taskName: timer.task_name,
    runId: timer.run_id,
    version: timer.version,
    clientHandled: Boolean(timer.client_handled_at),
  } : { status: "cancelled", endAt: null, remainingMs: 0, taskName: "", runId: null, version: 0, clientHandled: false });
});

router.put("/teacher/timer-state", async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const parsed = TimerStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "حالة المؤقت غير صالحة" });
    return;
  }
  const body = parsed.data;
  const endAt = body.status === "running" ? new Date(body.endAt) : null;
  const remainingMs = body.status === "paused" ? body.remainingMs : 0;
  const taskName = body.status === "cancelled" ? "" : body.taskName;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ version: number; run_id: string | null; status: string }>(
      `SELECT version, run_id, status FROM teacher_timer_states WHERE teacher_id = $1 FOR UPDATE`,
      [req.session.teacherId],
    );
    const row = current.rows[0];
    if (row && row.version !== body.expectedVersion) {
      await client.query("ROLLBACK");
      res.status(409).json({ message: "تغيّرت حالة المؤقت على جهاز آخر", version: row.version });
      return;
    }
    if (row?.status === "completed" && row.run_id === body.runId && body.status === "running") {
      await client.query("ROLLBACK");
      res.status(409).json({ message: "انتهى تشغيل المؤقت بالفعل", version: row.version });
      return;
    }
    const result = await client.query<{ version: number }>(
      `INSERT INTO teacher_timer_states
         (teacher_id, status, run_id, end_at, remaining_ms, task_name, version, client_handled_at, notification_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, NULL, NULL, NOW())
       ON CONFLICT (teacher_id) DO UPDATE SET
         status = EXCLUDED.status, run_id = EXCLUDED.run_id, end_at = EXCLUDED.end_at,
         remaining_ms = EXCLUDED.remaining_ms, task_name = EXCLUDED.task_name,
         version = teacher_timer_states.version + 1,
         client_handled_at = NULL, notification_id = NULL, updated_at = NOW()
       RETURNING version`,
      [req.session.teacherId, body.status, body.runId, endAt, remainingMs, taskName],
    );
    await client.query("COMMIT");
    res.json({ success: true, version: result.rows[0].version });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/teacher/timer-state/handled", async (req, res): Promise<void> => {
  if (!req.session.teacherId) {
    res.status(401).json({ message: "يجب تسجيل الدخول" });
    return;
  }
  const runId = z.string().uuid().safeParse(req.body?.runId);
  if (!runId.success) {
    res.status(400).json({ message: "معرف تشغيل المؤقت غير صالح" });
    return;
  }
  const updated = await pool.query<{ version: number }>(
    `UPDATE teacher_timer_states
        SET client_handled_at = NOW(), status = 'completed',
            version = version + 1, updated_at = NOW()
      WHERE teacher_id = $1 AND run_id = $2 AND status = 'running' AND end_at <= NOW()
      RETURNING version`,
    [req.session.teacherId, runId.data],
  );
  res.json({ success: true, version: updated.rows[0]?.version });
});

export default router;