import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, presentationSessionsTable as sessions, presentationWordCloudRunsTable as runs, presentationWordCloudSubmissionsTable as submissions, presentationSessionEventsTable as events } from "@workspace/db";

/** Same session-row lock is taken by open/close/slide/end updates. This makes
 * accepting a word atomic with respect to the active round changing. */
export async function openWordCloud(sessionId: number, teacherId: number, elementId: string, expectedSlide: number, element?: any) {
  return db.transaction(async tx => {
    const [session] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for("update");
    if (!session || session.teacherId !== teacherId || session.status === "ended" ||
        session.currentSlideIndex !== expectedSlide) return null;
    const [run] = await tx.insert(runs).values({ id: randomUUID(), sessionId, elementId }).returning();
    await tx.update(sessions).set({
      status: "running", activeElementId: elementId, activeWordCloudRunId: run.id, activeWallRunId: null,
      revealDistribution: false, revealAnswer: false,
    }).where(eq(sessions.id, sessionId));
    await tx.insert(events).values({
      sessionId, kind: "open", eventKey: run.id,
      payload: { elementId, element: element ?? { id: elementId, kind: "activity", activityKind: "word_cloud" },
        slideIndex: expectedSlide, openedAt: run.openedAt.getTime() },
    });
    return run;
  });
}

/** Single SQL snapshot: never combine a new round's pointer with old counts.
 * Empty runs still return one row through the left join. */
export async function getWordCloudSnapshot(sessionId: number) {
  const result = await db.execute(sql`
    SELECT r.id, r.element_id, r.opened_at, w.word, count(w.student_key)::integer AS count
    FROM presentation_sessions s
    JOIN presentation_word_cloud_runs r ON r.id = s.active_word_cloud_run_id
      AND r.session_id = s.id AND r.element_id = s.active_element_id
    LEFT JOIN presentation_word_cloud_submissions w ON w.run_id = r.id
    WHERE s.id = ${sessionId} AND s.status <> 'ended'
    GROUP BY r.id, r.element_id, r.opened_at, w.word ORDER BY w.word`);
  const first = result.rows[0];
  if (!first) return null;
  const words = result.rows.filter(r => r.word !== null).map(r => ({ text: String(r.word), count: Number(r.count) }));
  return {
    runId: String(first.id), elementId: String(first.element_id),
    openedAt: new Date(first.opened_at as string).getTime(),
    words, total: words.reduce((n, w) => n + w.count, 0),
  };
}

export async function hasWordCloudSubmission(runId: string, studentKey: string) {
  const [row] = await db.select({ studentKey: submissions.studentKey }).from(submissions)
    .where(and(eq(submissions.runId, runId), eq(submissions.studentKey, studentKey))).limit(1);
  return !!row;
}

export async function submitWordCloud(input: {
  sessionId: number; elementId: string; runId: string;
  studentKey: string; studentName: string; classStudentId: number | null; text: string;
}) {
  const word = String(input.text ?? "").trim().slice(0, 60).toLowerCase();
  if (!word) return "empty" as const;
  return db.transaction(async tx => {
    const [session] = await tx.select().from(sessions).where(eq(sessions.id, input.sessionId)).for("update");
    if (!session || session.status === "ended") return "ended" as const;
    if (session.sessionMode !== "teacher" || session.activeElementId !== input.elementId ||
        !session.activeWordCloudRunId || session.activeWordCloudRunId !== input.runId) return "not-active" as const;
    const [run] = await tx.select().from(runs).where(and(
      eq(runs.id, session.activeWordCloudRunId), eq(runs.sessionId, session.id), eq(runs.elementId, input.elementId),
    ));
    if (!run) return "not-active" as const;
    const inserted = await tx.insert(submissions).values({
      runId: run.id, studentKey: input.studentKey, studentName: input.studentName,
      classStudentId: input.classStudentId, word,
    }).onConflictDoNothing().returning({ studentKey: submissions.studentKey });
    if (!inserted.length) return "already" as const;
    // Preserve the incoming reporting feature atomically with the cloud write.
    // Cloud contributions are descriptive only: no scoring or legacy graded row.
    const [opening] = await tx.select().from(events).where(and(
      eq(events.sessionId, session.id), eq(events.kind, "open"), eq(events.eventKey, run.id),
    )).limit(1);
    await tx.insert(events).values({
      sessionId: session.id, kind: "answer", eventKey: `${run.id}:${input.elementId}:${input.studentKey}`,
      payload: { elementId: input.elementId, baseElementId: input.elementId, slideIndex: session.currentSlideIndex,
        studentKey: input.studentKey, studentName: input.studentName, classStudentId: input.classStudentId,
        answerIndex: null, answerText: String(input.text).trim().slice(0, 60), isCorrect: null,
        responseSec: Math.max(0, Math.round((Date.now() - run.openedAt.getTime()) / 1000)),
        meta: opening?.payload.element ?? { id: input.elementId, kind: "activity", activityKind: "word_cloud" } },
    }).onConflictDoNothing();
    return "accepted" as const;
  });
}

export async function migratePresentationWordCloud() {
  await db.execute(sql`ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS active_word_cloud_run_id UUID`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS presentation_word_cloud_runs (
    id UUID PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
    element_id TEXT NOT NULL, opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS presentation_word_cloud_runs_session_idx ON presentation_word_cloud_runs(session_id)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS presentation_word_cloud_submissions (
    run_id UUID NOT NULL REFERENCES presentation_word_cloud_runs(id) ON DELETE CASCADE,
    student_key VARCHAR(40) NOT NULL, student_name TEXT NOT NULL,
    class_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    word VARCHAR(60) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, student_key)
  )`);
}
