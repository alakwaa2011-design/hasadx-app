import { Router, type IRouter } from "express";
import {
  db,
  presentationsTable,
  presentationSessionsTable,
  presentationResponsesTable,
  studentsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * Phase 2 Teacher Insights — per-student "Learning Timeline".
 *
 * Returns raw numeric signals for one class student across every
 * presentation owned by the requesting teacher. No human-readable
 * summary is produced here so a future AI layer can compose
 * recommendations on top of the same payload.
 *
 * Owner-guarded: the student row must belong to the requesting
 * teacher, AND every joined session must belong to a presentation
 * owned by that same teacher (defence-in-depth — guards against a
 * roster row that was somehow shared across teachers).
 */
const router: IRouter = Router();

function requireTeacher(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

/* Map elementId → activityKind for a single deck. We only need the
   kind label, so we walk the raw slides JSONB without going through
   the full `hydrateActivityQuestions` pipeline. */
function buildKindIndex(slides: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(slides)) return out;
  for (const slide of slides as any[]) {
    if (!slide || !Array.isArray(slide.elements)) continue;
    for (const el of slide.elements) {
      if (el?.kind === "activity" && typeof el.id === "string") {
        out.set(el.id, typeof el.activityKind === "string" && el.activityKind.length > 0
          ? el.activityKind
          : "mcq");
      }
    }
  }
  return out;
}

/* Least-squares slope over (i, y) where i is the index 0..n-1.
   Returns null if fewer than 2 points or all x are identical. */
function leastSquaresSlope(ys: number[]): number | null {
  const n = ys.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += ys[i]!;
    sumXY += i * ys[i]!;
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

router.get("/students/:classStudentId/timeline", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const classStudentId = parseInt(req.params.classStudentId, 10);
    if (!Number.isFinite(classStudentId)) {
      return res.status(400).json({ message: "Bad id" });
    }

    /* Owner check + load the student row. */
    const [student] = await db
      .select({
        id: studentsTable.id,
        name: studentsTable.name,
        studentClass: studentsTable.studentClass,
        teacherId: studentsTable.teacherId,
      })
      .from(studentsTable)
      .where(eq(studentsTable.id, classStudentId))
      .limit(1);
    if (!student) return res.status(404).json({ message: "Not found" });
    if (student.teacherId !== teacherId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    /* Pull all responses for this student, joined to sessions and
       presentations so we can filter to teacher-owned decks in one
       round-trip. Order chronological. */
    const rows = await db
      .select({
        responseId: presentationResponsesTable.id,
        sessionId: presentationResponsesTable.sessionId,
        elementId: presentationResponsesTable.elementId,
        isCorrect: presentationResponsesTable.isCorrect,
        createdAt: presentationResponsesTable.createdAt,
        sessionStartedAt: presentationSessionsTable.startedAt,
        sessionEndedAt: presentationSessionsTable.endedAt,
        sessionPin: presentationSessionsTable.pin,
        sessionStatus: presentationSessionsTable.status,
        presentationId: presentationsTable.id,
        presentationTitle: presentationsTable.title,
      })
      .from(presentationResponsesTable)
      .innerJoin(
        presentationSessionsTable,
        eq(presentationSessionsTable.id, presentationResponsesTable.sessionId),
      )
      .innerJoin(
        presentationsTable,
        eq(presentationsTable.id, presentationSessionsTable.presentationId),
      )
      .where(and(
        eq(presentationResponsesTable.classStudentId, classStudentId),
        eq(presentationsTable.teacherId, teacherId),
      ))
      .orderBy(presentationResponsesTable.createdAt);

    if (rows.length === 0) {
      return res.json({
        student: {
          id: student.id,
          name: student.name,
          className: student.studentClass,
          classId: null,
        },
        summary: {
          sessionsCount: 0,
          totalAnswered: 0,
          totalCorrect: 0,
          avgScorePct: null,
          participationPct: null,
          avgResponseSec: null,
        },
        byKind: [],
        strongestKind: null,
        weakestKind: null,
        recentSessions: [],
        trend: { direction: null, slope: null, sample: 0, reason: "insufficient_data" as const },
        sessions: [],
      });
    }

    /* Load decks (slides) for every distinct presentation that appears,
       so we can resolve activityKind per response. */
    const presentationIds = Array.from(new Set(rows.map((r) => r.presentationId)));
    const decks = await db
      .select({ id: presentationsTable.id, slides: presentationsTable.slides })
      .from(presentationsTable)
      .where(sql`${presentationsTable.id} IN (${sql.join(
        presentationIds.map((x) => sql`${x}`),
        sql`, `,
      )})`);
    const kindByElementId = new Map<string, string>();
    for (const d of decks) {
      const idx = buildKindIndex(d.slides);
      for (const [eid, k] of idx.entries()) kindByElementId.set(eid, k);
    }

    /* Pull every response for the involved sessions (any student) so
       we can compute total-scorable-activities per session for the
       participation metric. Single round-trip. */
    const sessionIds = Array.from(new Set(rows.map((r) => r.sessionId)));
    const allSessionRows = await db
      .select({
        sessionId: presentationResponsesTable.sessionId,
        elementId: presentationResponsesTable.elementId,
        isCorrect: presentationResponsesTable.isCorrect,
      })
      .from(presentationResponsesTable)
      .where(sql`${presentationResponsesTable.sessionId} IN (${sql.join(
        sessionIds.map((x) => sql`${x}`),
        sql`, `,
      )})`);
    const scorableElementsBySession = new Map<number, Set<string>>();
    for (const r of allSessionRows) {
      if (r.isCorrect == null) continue;
      let set = scorableElementsBySession.get(r.sessionId);
      if (!set) { set = new Set(); scorableElementsBySession.set(r.sessionId, set); }
      set.add(r.elementId);
    }

    /* ─── Per-session aggregation ─── */
    type SessionAgg = {
      sessionId: number;
      presentationId: number;
      presentationTitle: string;
      pin: string;
      startedAt: Date | null;
      endedAt: Date | null;
      status: string;
      answered: number;
      correct: number;
      answeredTimes: number[];   // ms timestamps for response-time gaps
    };
    const bySession = new Map<number, SessionAgg>();
    for (const r of rows) {
      let cur = bySession.get(r.sessionId);
      if (!cur) {
        cur = {
          sessionId: r.sessionId,
          presentationId: r.presentationId,
          presentationTitle: r.presentationTitle,
          pin: r.sessionPin,
          startedAt: r.sessionStartedAt,
          endedAt: r.sessionEndedAt,
          status: r.sessionStatus,
          answered: 0,
          correct: 0,
          answeredTimes: [],
        };
        bySession.set(r.sessionId, cur);
      }
      if (r.isCorrect != null) {
        cur.answered++;
        if (r.isCorrect === true) cur.correct++;
      }
      cur.answeredTimes.push(r.createdAt.getTime());
    }

    /* Convert sessions into a chronological list (by startedAt fallback
       to first response time) and cap at last 50. */
    const sessionsArr = Array.from(bySession.values()).map((s) => {
      s.answeredTimes.sort((a, b) => a - b);
      const startMs = s.startedAt?.getTime() ?? s.answeredTimes[0] ?? null;
      const scorePct = s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : null;
      const totalScorable = scorableElementsBySession.get(s.sessionId)?.size ?? 0;
      const participationPct = totalScorable > 0
        ? Math.min(100, Math.round((s.answered / totalScorable) * 100))
        : null;
      /* Per-student gap algorithm (matches the /results helper),
         capped at 10 minutes to ignore breaks. */
      const gaps: number[] = [];
      let prev: number | null = startMs;
      for (const t of s.answeredTimes) {
        if (prev != null) {
          const g = Math.round((t - prev) / 1000);
          if (g >= 0 && g <= 600) gaps.push(g);
        }
        prev = t;
      }
      const avgResponseSec = gaps.length > 0
        ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
        : null;
      return {
        sessionId: s.sessionId,
        presentationId: s.presentationId,
        presentationTitle: s.presentationTitle,
        pin: s.pin,
        startedAt: s.startedAt?.toISOString() ?? null,
        endedAt: s.endedAt?.toISOString() ?? null,
        status: s.status,
        answered: s.answered,
        correct: s.correct,
        scorePct,
        participationPct,
        avgResponseSec,
        sortKey: startMs ?? 0,
      };
    });
    sessionsArr.sort((a, b) => a.sortKey - b.sortKey);
    const cappedSessions = sessionsArr.slice(-50);

    /* ─── Per-kind aggregation ─── */
    type KindAgg = { kind: string; answered: number; correct: number };
    const byKind = new Map<string, KindAgg>();
    for (const r of rows) {
      const kind = kindByElementId.get(r.elementId) ?? "unknown";
      let cur = byKind.get(kind);
      if (!cur) { cur = { kind, answered: 0, correct: 0 }; byKind.set(kind, cur); }
      if (r.isCorrect != null) {
        cur.answered++;
        if (r.isCorrect === true) cur.correct++;
      }
    }
    const KIND_THRESHOLD = 5;
    const byKindOut = Array.from(byKind.values()).map((k) => {
      const correctPct = k.answered > 0 ? Math.round((k.correct / k.answered) * 100) : null;
      return {
        kind: k.kind,
        answered: k.answered,
        correct: k.correct,
        correctPct,
        eligible: k.answered >= KIND_THRESHOLD && correctPct != null,
      };
    });
    const eligible = byKindOut.filter((k) => k.eligible);
    let strongestKind: { kind: string; correctPct: number } | null = null;
    let weakestKind: { kind: string; correctPct: number } | null = null;
    if (eligible.length > 0) {
      const sortedDesc = eligible.slice().sort((a, b) => (b.correctPct ?? 0) - (a.correctPct ?? 0));
      const top = sortedDesc[0]!;
      const bottom = sortedDesc[sortedDesc.length - 1]!;
      strongestKind = { kind: top.kind, correctPct: top.correctPct! };
      /* Only show weakestKind separately if it's a different kind, so
         a single-kind student doesn't get "strongest=weakest=mcq". */
      if (bottom.kind !== top.kind) {
        weakestKind = { kind: bottom.kind, correctPct: bottom.correctPct! };
      }
    }

    /* ─── Summary totals across all sessions ─── */
    let totalAnswered = 0;
    let totalCorrect = 0;
    for (const r of rows) {
      if (r.isCorrect != null) {
        totalAnswered++;
        if (r.isCorrect === true) totalCorrect++;
      }
    }
    const avgScorePct = totalAnswered > 0
      ? Math.round((totalCorrect / totalAnswered) * 100)
      : null;
    const partVals = cappedSessions
      .map((s) => s.participationPct)
      .filter((x): x is number => x != null);
    const participationPct = partVals.length > 0
      ? Math.round(partVals.reduce((a, b) => a + b, 0) / partVals.length)
      : null;
    const respVals = cappedSessions
      .map((s) => s.avgResponseSec)
      .filter((x): x is number => x != null);
    const avgResponseSec = respVals.length > 0
      ? Math.round(respVals.reduce((a, b) => a + b, 0) / respVals.length)
      : null;

    /* ─── Trend (last up to 10 eligible sessions) ─── */
    const trendPoints = cappedSessions
      .map((s) => s.scorePct)
      .filter((x): x is number => x != null);
    const trendWindow = trendPoints.slice(-10);
    let trend: {
      direction: "improving" | "stable" | "declining" | null;
      slope: number | null;
      sample: number;
      reason?: "insufficient_data";
    };
    if (trendWindow.length < 3) {
      trend = { direction: null, slope: null, sample: trendWindow.length, reason: "insufficient_data" };
    } else {
      const slope = leastSquaresSlope(trendWindow);
      let direction: "improving" | "stable" | "declining" | null = "stable";
      if (slope == null) direction = null;
      else if (slope >= 0.5) direction = "improving";
      else if (slope <= -0.5) direction = "declining";
      trend = {
        direction,
        slope: slope == null ? null : Math.round(slope * 100) / 100,
        sample: trendWindow.length,
      };
    }

    const recentSessions = cappedSessions
      .slice()
      .reverse()
      .slice(0, 5)
      .map((s) => ({
        sessionId: s.sessionId,
        presentationId: s.presentationId,
        presentationTitle: s.presentationTitle,
        pin: s.pin,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        scorePct: s.scorePct,
        answered: s.answered,
        correct: s.correct,
        avgResponseSec: s.avgResponseSec,
      }));

    res.json({
      student: {
        id: student.id,
        name: student.name,
        className: student.studentClass,
        classId: null,
      },
      summary: {
        sessionsCount: cappedSessions.length,
        totalAnswered,
        totalCorrect,
        avgScorePct,
        participationPct,
        avgResponseSec,
      },
      byKind: byKindOut,
      strongestKind,
      weakestKind,
      recentSessions,
      trend,
      sessions: cappedSessions.map((s) => ({
        sessionId: s.sessionId,
        presentationId: s.presentationId,
        presentationTitle: s.presentationTitle,
        startedAt: s.startedAt,
        scorePct: s.scorePct,
        answered: s.answered,
        correct: s.correct,
        avgResponseSec: s.avgResponseSec,
      })),
    });
  } catch (err) {
    req.log?.error({ err }, "Student timeline failed");
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
