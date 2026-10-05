import { db, presentationSessionEventsTable as events, presentationResponsesTable, presentationInlineQuizRunsTable, presentationSessionsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export const answerUnits = (r: ReportResponse) => r.answerUnits;
export const correctUnits = (r: ReportResponse) => r.correctUnits;
export const scoredUnits = (r: ReportResponse) => r.scoredUnits;
export type ReportResponse = typeof presentationResponsesTable.$inferSelect & {
  answerUnits: number; correctUnits: number; scoredUnits: number;
  aggregateOnly?: boolean; responseSec?: number | null; meta?: any;
};

export async function recordPresentationEvent(sessionId: number, kind: string, eventKey: string, payload: Record<string, any>) {
  return db.insert(events).values({ sessionId, kind, eventKey, payload }).onConflictDoNothing().returning({ id: events.id });
}

export async function recordPresentationJoin(sessionId: number, studentKey: string, name: string, classStudentId: number | null) {
  await db.insert(events).values({ sessionId, kind: "join", eventKey: studentKey, payload: { studentKey, name, classStudentId } })
    .onConflictDoUpdate({ target: [events.sessionId, events.kind, events.eventKey], set: { payload: { studentKey, name, classStudentId } } });
}

export async function recordPresentationOpen(sessionId: number, element: any, slideIndex: number, openedAt: number) {
  await recordPresentationEvent(sessionId, "open", randomUUID(), { elementId: element.id, element, slideIndex, openedAt });
}

/** Commit before acknowledging. Serialize with session:end so a late answer
 * cannot be added to an already-saved ended session. */
export async function recordPresentationAnswer(sessionId: number, me: { studentKey: string; name: string; classStudentId: number | null },
  element: any, slideIndex: number, answer: { answerIndex?: number; answerText?: string; questionIndex?: number; mirrorLegacy?: boolean }) {
  if (!element) return "closed" as const;
  return db.transaction(async tx => {
    const [session] = await tx.select().from(presentationSessionsTable).where(eq(presentationSessionsTable.id, sessionId)).for("share");
    if (!session || session.status === "ended" || (session.sessionMode !== "self_paced" && session.activeElementId !== element.id)) return "closed" as const;
    const opens = await tx.select().from(events).where(and(eq(events.sessionId, sessionId), inArray(events.kind, ["open", "question-open"])));
    const runOpening = opens.filter(e => e.kind === "open" && e.payload.elementId === element.id).sort((a, b) => b.id - a.id)[0];
    const runKey = session.sessionMode === "self_paced" ? "self-paced" : runOpening?.eventKey ?? "legacy";
    const question = answer.questionIndex == null ? element : element.questions?.[answer.questionIndex];
    if (!question) return "closed" as const;
    if (answer.answerIndex != null && (!Number.isInteger(answer.answerIndex) || answer.answerIndex < 0 || answer.answerIndex >= (question.options?.length ?? 0))) return "closed" as const;
    if (answer.answerIndex == null && !answer.answerText?.trim()) return "closed" as const;
    const correctIndex = typeof question.correctIndex === "number" ? question.correctIndex : null;
    const isCorrect = answer.answerIndex != null && correctIndex != null ? answer.answerIndex === correctIndex : null;
    const now = new Date();
    const timing = answer.questionIndex == null ? runOpening : opens.filter(e =>
      e.kind === "question-open" && e.payload.elementId === element.id &&
      e.payload.questionIndex === answer.questionIndex && e.id > (runOpening?.id ?? 0)).sort((a, b) => b.id - a.id)[0] ?? runOpening;
    const responseSec = timing && session.sessionMode !== "self_paced"
      ? Math.max(0, Math.round((now.getTime() - Number(timing.payload.openedAt)) / 1000)) : null;
    const reportElementId = answer.questionIndex == null ? element.id : `${element.id}::q:${answer.questionIndex}`;
    const payload = { elementId: reportElementId, baseElementId: element.id, slideIndex, studentKey: me.studentKey,
        studentName: me.name, classStudentId: me.classStudentId, answerIndex: answer.answerIndex ?? null,
        answerText: answer.answerText ?? null, isCorrect, responseSec,
        meta: { ...question, id: reportElementId, activityKind: question.activityKind ?? (answer.questionIndex != null ? "mcq" : element.activityKind) } };
    const inserted = await tx.insert(events).values({
      sessionId, kind: "answer", eventKey: `${runKey}:${reportElementId}:${me.studentKey}`, payload,
      createdAt: now,
    }).onConflictDoNothing().returning({ id: events.id });
    if (inserted.length && answer.mirrorLegacy) {
      const [legacy] = await tx.insert(presentationResponsesTable).values({
        sessionId, slideIndex, elementId: reportElementId, studentKey: me.studentKey, studentName: me.name,
        classStudentId: me.classStudentId, answerIndex: answer.answerIndex ?? null,
        answerText: answer.answerText ?? null, isCorrect, createdAt: now,
      }).onConflictDoNothing().returning({ id: presentationResponsesTable.id });
      if (legacy) await tx.update(events).set({ payload: { ...payload, legacyResponseId: legacy.id } }).where(eq(events.id, inserted[0].id));
    }
    return inserted.length ? "saved" as const : "already" as const;
  });
}

/** One source for results, history, comparison and both CSV exports.
 * Legacy summaries stay summaries: never invent their individual answers. */
export async function loadPresentationReportData(sessionIds: number[]) {
  if (!sessionIds.length) return { rows: [] as ReportResponse[], joins: [] as (typeof events.$inferSelect)[], opens: [] as (typeof events.$inferSelect)[], snapshots: [] as (typeof events.$inferSelect)[] };
  const [saved, legacy, runs] = await Promise.all([
    db.select().from(events).where(inArray(events.sessionId, sessionIds)).orderBy(events.id),
    db.select().from(presentationResponsesTable).where(inArray(presentationResponsesTable.sessionId, sessionIds)),
    db.select().from(presentationInlineQuizRunsTable).where(inArray(presentationInlineQuizRunsTable.sessionId, sessionIds)),
  ]);
  return mergePresentationReportData(saved, legacy, runs);
}

export function mergePresentationReportData(saved: (typeof events.$inferSelect)[],
  legacy: (typeof presentationResponsesTable.$inferSelect)[], runs: (typeof presentationInlineQuizRunsTable.$inferSelect)[]) {
  const answers = saved.filter(e => e.kind === "answer");
  const logged = new Set(answers.filter(e => e.payload.legacyResponseId != null).map(e => `${e.sessionId}:${e.payload.legacyResponseId}`));
  const rows: ReportResponse[] = legacy.filter(r => !logged.has(`${r.sessionId}:${r.id}`))
    .map(r => ({ ...r, answerUnits: 1, correctUnits: r.isCorrect === true ? 1 : 0, scoredUnits: r.isCorrect != null ? 1 : 0 }));
  for (const e of answers) {
    const p = e.payload;
    rows.push({ id: -e.id, sessionId: e.sessionId, slideIndex: p.slideIndex, elementId: p.elementId,
      studentKey: p.studentKey, studentName: p.studentName, classStudentId: p.classStudentId ?? null,
      answerIndex: p.answerIndex ?? null, answerText: p.answerText ?? null, isCorrect: p.isCorrect ?? null,
      createdAt: e.createdAt, answerUnits: 1, correctUnits: p.isCorrect === true ? 1 : 0,
      scoredUnits: p.isCorrect != null ? 1 : 0, responseSec: p.responseSec ?? null, meta: p.meta });
  }
  const completed = new Set(saved.filter(e => e.kind === "quiz-complete").map(e => `${e.sessionId}:${e.payload.elementId}:${e.payload.finishedAt}`));
  for (const run of runs) {
    if (completed.has(`${run.sessionId}:${run.elementId}:${run.finishedAt.toISOString()}`)) continue;
    rows.push({ id: -run.id, sessionId: run.sessionId, slideIndex: -1, elementId: run.elementId,
      studentKey: run.studentKey, studentName: run.studentName, classStudentId: run.classStudentId,
      answerIndex: null, answerText: null, isCorrect: null, createdAt: run.finishedAt,
      answerUnits: run.answered, correctUnits: run.correct, scoredUnits: run.answered, aggregateOnly: true,
      meta: { activityKind: "hasad-game", questionCount: run.totalQuestions, aggregateOnly: true } });
  }
  return { rows, joins: saved.filter(e => e.kind === "join"), opens: saved.filter(e => e.kind === "open"), snapshots: saved.filter(e => e.kind === "snapshot") };
}

export function buildPresentationActivityIndex(slides: any[], rows: ReportResponse[], opens: { payload: Record<string, any> }[]) {
  const index = new Map<string, { slideIndex: number; element: any }>();
  const base = new Map<string, { slideIndex: number; element: any }>();
  const add = (el: any, slideIndex: number) => {
    if (!el || typeof el.id !== "string") return;
    if (el.kind === "activity") index.set(el.id, { slideIndex, element: el });
    if (el.kind === "hasad-game") {
      base.set(el.id, { slideIndex, element: el });
      (el.questions ?? []).forEach((q: any, i: number) => {
        const id = `${el.id}::q:${i}`;
        index.set(id, { slideIndex, element: { ...q, id, activityKind: "mcq" } });
      });
    }
  };
  slides.forEach((s, i) => s?.elements?.forEach((el: any) => add(el, i)));
  for (const e of opens) add(e.payload.element, e.payload.slideIndex);
  for (const r of rows) {
    const old = index.get(r.elementId) ?? base.get(r.elementId);
    if (r.meta || !old) index.set(r.elementId, { slideIndex: old?.slideIndex ?? r.slideIndex,
      element: { id: r.elementId, kind: "activity", prompt: "(نشاط سابق)", ...old?.element, ...r.meta } });
    else if (!index.has(r.elementId)) index.set(r.elementId, old);
    if (r.aggregateOnly && !rows.some(other => other.elementId.startsWith(`${r.elementId}::q:`))) {
      for (const id of index.keys()) if (id.startsWith(`${r.elementId}::q:`)) index.delete(id);
    }
  }
  return index;
}
