import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, presentationSessionsTable as sessions, presentationWallRunsTable as runs,
  presentationWallCardsTable as cards, presentationSessionEventsTable as events } from "@workspace/db";

/** All mutations lock the session row, also locked by slide/close/end updates.
 * No card or moderation confirmation is sent until the transaction commits. */
export async function openWall(sessionId: number, teacherId: number, elementId: string, expectedSlide: number, element?: any) {
  return db.transaction(async tx => {
    const [session] = await tx.select().from(sessions).where(eq(sessions.id, sessionId)).for("update");
    if (!session || session.teacherId !== teacherId || session.status === "ended" ||
        session.currentSlideIndex !== expectedSlide || session.sessionMode !== "teacher") return null;
    const [run] = await tx.insert(runs).values({ id: randomUUID(), sessionId, elementId }).returning();
    await tx.update(sessions).set({
      status: "running", activeElementId: elementId, activeWallRunId: run.id, activeWordCloudRunId: null,
      revealDistribution: false, revealAnswer: false,
    }).where(eq(sessions.id, sessionId));
    await tx.insert(events).values({
      sessionId, kind: "open", eventKey: run.id,
      payload: { elementId, element: element ?? { id: elementId, kind: "activity", activityKind: "open_wall" },
        slideIndex: expectedSlide, openedAt: run.openedAt.getTime() },
    });
    return run;
  });
}

/** One SQL snapshot keeps round, version and cards consistent, including empty runs. */
export async function getWallSnapshot(sessionId: number, forTeacher = false) {
  const result = await db.execute(sql`
    SELECT r.id AS run_id, r.element_id, r.opened_at, r.revision,
      c.id, c.student_key, c.student_name, c.text, c.visible
    FROM presentation_sessions s
    JOIN presentation_wall_runs r ON r.id = s.active_wall_run_id
      AND r.session_id = s.id AND r.element_id = s.active_element_id
    LEFT JOIN presentation_wall_cards c ON c.run_id = r.id AND (${forTeacher}::boolean OR c.visible)
    WHERE s.id = ${sessionId} AND s.status <> 'ended'
    ORDER BY c.created_at, c.id`);
  const first = result.rows[0];
  if (!first) return null;
  return {
    runId: String(first.run_id), elementId: String(first.element_id), revision: Number(first.revision),
    openedAt: new Date(first.opened_at as string).getTime(),
    cards: result.rows.filter(r => r.id !== null).map(r => ({
      id: String(r.id), studentKey: String(r.student_key), name: String(r.student_name),
      text: String(r.text), visible: Boolean(r.visible),
    })),
  };
}

export async function hasWallSubmission(runId: string, studentKey: string) {
  const [row] = await db.select({ id: cards.id }).from(cards)
    .where(and(eq(cards.runId, runId), eq(cards.studentKey, studentKey))).limit(1);
  return !!row;
}

export async function submitWall(input: {
  sessionId: number; elementId: string; runId: string; studentKey: string;
  studentName: string; classStudentId: number | null; text: string;
}) {
  const text = String(input.text ?? "").trim().slice(0, 500);
  if (!text) return "empty" as const;
  return db.transaction(async tx => {
    const [session] = await tx.select().from(sessions).where(eq(sessions.id, input.sessionId)).for("update");
    if (!session || session.status === "ended") return "ended" as const;
    if (session.sessionMode !== "teacher" || session.activeElementId !== input.elementId ||
        !session.activeWallRunId || session.activeWallRunId !== input.runId) return "not-active" as const;
    const [run] = await tx.select().from(runs).where(and(
      eq(runs.id, session.activeWallRunId), eq(runs.sessionId, session.id), eq(runs.elementId, input.elementId)));
    if (!run) return "not-active" as const;
    const inserted = await tx.insert(cards).values({
      id: randomUUID(), runId: run.id, studentKey: input.studentKey, studentName: input.studentName,
      classStudentId: input.classStudentId, text,
    }).onConflictDoNothing().returning({ id: cards.id });
    if (!inserted.length) return "already" as const;
    await tx.update(runs).set({ revision: sql`${runs.revision} + 1` }).where(eq(runs.id, run.id));
    const [opening] = await tx.select().from(events).where(and(
      eq(events.sessionId, session.id), eq(events.kind, "open"), eq(events.eventKey, run.id))).limit(1);
    // Descriptive evidence only: no graded response or reward is created.
    await tx.insert(events).values({
      sessionId: session.id, kind: "answer", eventKey: `${run.id}:${input.elementId}:${input.studentKey}`,
      payload: { elementId: input.elementId, baseElementId: input.elementId, slideIndex: session.currentSlideIndex,
        studentKey: input.studentKey, studentName: input.studentName, classStudentId: input.classStudentId,
        answerIndex: null, answerText: text, isCorrect: null,
        responseSec: Math.max(0, Math.round((Date.now() - run.openedAt.getTime()) / 1000)),
        meta: opening?.payload.element ?? { id: input.elementId, kind: "activity", activityKind: "open_wall" } },
    }).onConflictDoNothing();
    return "accepted" as const;
  });
}

export async function toggleWallCard(input: {
  sessionId: number; teacherId: number; elementId: string; runId: string; cardId: string; visible: boolean;
}) {
  return db.transaction(async tx => {
    const [session] = await tx.select().from(sessions).where(eq(sessions.id, input.sessionId)).for("update");
    if (!session || session.teacherId !== input.teacherId || session.status === "ended" ||
        session.sessionMode !== "teacher" || session.activeElementId !== input.elementId ||
        !session.activeWallRunId || session.activeWallRunId !== input.runId) return false;
    // Compare card IDs as text so malformed public input cannot fail UUID parsing.
    const updated = await tx.update(cards).set({ visible: input.visible }).where(and(
      eq(cards.runId, session.activeWallRunId), sql`${cards.id}::text = ${input.cardId}`)).returning({ id: cards.id });
    if (!updated.length) return false;
    await tx.update(runs).set({ revision: sql`${runs.revision} + 1` }).where(eq(runs.id, session.activeWallRunId));
    return true;
  });
}

/** Teacher shows or hides every card of the active round at once. */
export async function setAllWallCards(input: {
  sessionId: number; teacherId: number; elementId: string; runId: string; visible: boolean;
}) {
  return db.transaction(async tx => {
    const [session] = await tx.select().from(sessions).where(eq(sessions.id, input.sessionId)).for("update");
    if (!session || session.teacherId !== input.teacherId || session.status === "ended" ||
        session.sessionMode !== "teacher" || session.activeElementId !== input.elementId ||
        !session.activeWallRunId || session.activeWallRunId !== input.runId) return false;
    await tx.update(cards).set({ visible: input.visible }).where(eq(cards.runId, session.activeWallRunId));
    await tx.update(runs).set({ revision: sql`${runs.revision} + 1` }).where(eq(runs.id, session.activeWallRunId));
    return true;
  });
}

export async function migratePresentationWall() {
  await db.execute(sql`ALTER TABLE presentation_sessions ADD COLUMN IF NOT EXISTS active_wall_run_id UUID`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS presentation_wall_runs (
    id UUID PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES presentation_sessions(id) ON DELETE CASCADE,
    element_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS presentation_wall_runs_session_idx ON presentation_wall_runs(session_id)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS presentation_wall_cards (
    id UUID PRIMARY KEY, run_id UUID NOT NULL REFERENCES presentation_wall_runs(id) ON DELETE CASCADE,
    student_key VARCHAR(40) NOT NULL, student_name TEXT NOT NULL,
    class_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
    text VARCHAR(500) NOT NULL, visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS presentation_wall_cards_student_unique
    ON presentation_wall_cards(run_id, student_key)`);
}
