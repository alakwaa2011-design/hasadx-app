import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import { db, presentationsTable, presentationSessionsTable, presentationResponsesTable, presentationInlineQuizRunsTable, teacherClassesTable, studentsTable, assignmentsTable } from "@workspace/db";
import { and, eq, ne, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { hydrateActivityQuestions } from "./presentations";
import { mintPresentationJoinToken, verifyPresentationJoinToken } from "../lib/presentation-join-token";

/**
 * Presentations 2B — Live MVP REST surface.
 *
 * All endpoints live under either:
 *   - `/api/presentations/:id/sessions`     (owner-only, session create/end)
 *   - `/api/p/sessions/...`                 (public student/PIN endpoints)
 *
 * Nothing here touches the existing `/api/presentations/:id` routes,
 * deck schema, or the existing live-game PIN namespace (Wameedh,
 * Million, Hack...). Sessions live in their own table with their own
 * unique-active-PIN constraint.
 */

const router: IRouter = Router();

function requireTeacher(req: any, res: any, next: any) {
  if (!req.session?.teacherId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

async function ownsPresentation(teacherId: number, id: number): Promise<boolean> {
  const [row] = await db
    .select({ teacherId: presentationsTable.teacherId })
    .from(presentationsTable)
    .where(eq(presentationsTable.id, id))
    .limit(1);
  return !!row && row.teacherId === teacherId;
}

/** 6-digit numeric PIN, regenerated up to 10 times if it collides
 *  with an active (non-ended) session. Active uniqueness is enforced
 *  by the partial unique index on (pin) WHERE status<>'ended'. */
async function generateUniquePin(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const [exists] = await db
      .select({ id: presentationSessionsTable.id })
      .from(presentationSessionsTable)
      .where(and(eq(presentationSessionsTable.pin, pin), ne(presentationSessionsTable.status, "ended")))
      .limit(1);
    if (!exists) return pin;
  }
  throw new Error("Could not allocate PIN");
}

/** Resolve one activity element from a slide using the shared
 *  `hydrateActivityQuestions` helper from `routes/presentations.ts`
 *  to guarantee identical hydration behavior across the codebase. */
export async function resolveActivityElement(slide: any, elementId: string): Promise<any | null> {
  if (!slide || !Array.isArray(slide.elements)) return null;
  const hydrated = await hydrateActivityQuestions([slide]) as any[];
  const hSlide = hydrated[0];
  if (!hSlide?.elements) return null;
  /* Phase 6 — also resolve `hasad-game` (the inline live-quiz
     element) so REST `/state` can rehydrate inline runs after a
     student reload. Was previously activity-only, which silently
     dropped the active element for hasad-games and broke the new
     inline rehydration path. */
  return (
    hSlide.elements.find(
      (e: any) =>
        e?.id === elementId && (e?.kind === "activity" || e?.kind === "hasad-game"),
    ) ?? null
  );
}

async function loadDeck(presentationId: number) {
  const [row] = await db
    .select()
    .from(presentationsTable)
    .where(eq(presentationsTable.id, presentationId))
    .limit(1);
  return row ?? null;
}

/* ─────────────────── Owner-only: create session ─────────────────── */

router.post("/presentations/:id/sessions", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Bad id" });
    if (!(await ownsPresentation(teacherId, id))) return res.status(403).json({ message: "Forbidden" });

    const deck = await loadDeck(id);
    if (!deck) return res.status(404).json({ message: "Not found" });

    /* Class targeting derivation — authoritative source order:
       (1) Presentation's 2A linked assignment's `targetClass` (the
           single source of truth when the deck is linked); else
       (2) Explicit `targetClass` in request body (teacher chose at
           launch time via the editor's class selector).
       If neither yields a known class on this teacher's roster, the
       session falls back to `guest` mode. */
    let targetClassId: number | null = null;
    let mode: "class" | "guest" = "guest";
    let resolvedClassName: string | null = null;

    if (deck.linkedActivityId && deck.linkedActivityKind === "assignment") {
      const aid = parseInt(deck.linkedActivityId, 10);
      if (Number.isFinite(aid)) {
        const [a] = await db
          .select({ targetClass: assignmentsTable.targetClass })
          .from(assignmentsTable)
          .where(and(eq(assignmentsTable.id, aid), eq(assignmentsTable.teacherId, teacherId)))
          .limit(1);
        if (a?.targetClass) resolvedClassName = a.targetClass.trim();
      }
    }
    if (!resolvedClassName && typeof req.body?.targetClass === "string") {
      const t = req.body.targetClass.trim();
      if (t) resolvedClassName = t;
    }
    if (resolvedClassName) {
      const [cls] = await db
        .select({ id: teacherClassesTable.id })
        .from(teacherClassesTable)
        .where(and(eq(teacherClassesTable.teacherId, teacherId), eq(teacherClassesTable.name, resolvedClassName)))
        .limit(1);
      if (cls) {
        targetClassId = cls.id;
        mode = "class";
      }
    }

    const pin = await generateUniquePin();

    const [created] = await db
      .insert(presentationSessionsTable)
      .values({
        presentationId: id,
        teacherId,
        pin,
        status: "lobby",
        currentSlideIndex: 0,
        targetClassId,
        mode,
        startedAt: new Date(),
      })
      .returning();

    res.json({
      sessionId: created.id,
      pin: created.pin,
      mode: created.mode,
      controlUrl: `/p/control/${created.id}`,
      showUrl: `/p/show/${created.id}`,
      joinUrl: `/p/join`,
    });
  } catch (err) {
    req.log?.error({ err }, "Create presentation session failed");
    res.status(500).json({ message: "Failed to create session" });
  }
});

/* ─────────────────── Owner-only: end session ─────────────────── */

router.post("/presentations/sessions/:id/end", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const sid = parseInt(req.params.id, 10);
    if (!Number.isFinite(sid)) return res.status(400).json({ message: "Bad id" });
    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.id, sid))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "Not found" });
    if (sess.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });

    await db
      .update(presentationSessionsTable)
      .set({ status: "ended", endedAt: new Date(), activeElementId: null })
      .where(eq(presentationSessionsTable.id, sid));

    /* Notify any connected sockets so client UIs can react. */
    try {
      const { getGameIo } = await import("../game/socket-handlers");
      const io = getGameIo();
      io?.to(`presentation:${sid}`).emit("session:ended");
    } catch { /* socket layer optional in tests */ }

    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }, "End presentation session failed");
    res.status(500).json({ message: "Failed to end session" });
  }
});

/* ─────────────────── Owner-only: get session info ─────────────────── */

router.get("/presentations/sessions/:id", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const sid = parseInt(req.params.id, 10);
    if (!Number.isFinite(sid)) return res.status(400).json({ message: "Bad id" });
    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.id, sid))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "Not found" });
    if (sess.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });

    const deck = await loadDeck(sess.presentationId);
    res.json({
      session: sess,
      deck: deck
        ? {
            id: deck.id,
            title: deck.title,
            language: deck.language,
            theme: deck.theme,
            pattern: deck.pattern,
            slides: deck.slides,
          }
        : null,
    });
  } catch (err) {
    req.log?.error({ err }, "Get session failed");
    res.status(500).json({ message: "Failed" });
  }
});

/* ─────────────────── Owner-only: results dashboard ───────────────────
   Returns per-activity aggregates (option distribution, % correct,
   answered count) plus per-student rows so the teacher can see who
   answered what once a session has ended. Available while running too,
   but the control panel only links here after `session:ended`. */
router.get("/presentations/sessions/:id/results", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const sid = parseInt(req.params.id, 10);
    if (!Number.isFinite(sid)) return res.status(400).json({ message: "Bad id" });

    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.id, sid))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "Not found" });
    if (sess.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });

    const deck = await loadDeck(sess.presentationId);
    if (!deck) return res.status(404).json({ message: "Deck not found" });

    const rawSlides = Array.isArray(deck.slides) ? (deck.slides as any[]) : [];
    const hydrated = (await hydrateActivityQuestions(rawSlides)) as any[];

    /* Build a map of every activity element on the deck, keyed by
       elementId. We iterate the hydrated slides so option labels and
       correctIndex are present for client-side rendering. */
    const activityIndex = new Map<string, { slideIndex: number; element: any }>();
    hydrated.forEach((slide, slideIndex) => {
      if (!slide || !Array.isArray(slide.elements)) return;
      for (const el of slide.elements) {
        if (el?.kind === "activity" && typeof el.id === "string") {
          activityIndex.set(el.id, { slideIndex, element: el });
        }
      }
    });

    /* Pull every persisted response for this session. The unique
       constraint on (sessionId, elementId, studentKey) means at most
       one row per student per activity. */
    const rows = await db
      .select()
      .from(presentationResponsesTable)
      .where(eq(presentationResponsesTable.sessionId, sid));

    /* Group responses by elementId → list of rows. Activities the
       teacher never opened (or that no one answered) are still
       included in the output via the deck walk above. */
    const byElement = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byElement.get(r.elementId) ?? [];
      list.push(r);
      byElement.set(r.elementId, list);
    }
    /* Include responses for elements that no longer exist on the deck
       (rare — element deleted mid-session) so we don't lose data. */
    for (const elId of byElement.keys()) {
      if (!activityIndex.has(elId)) {
        activityIndex.set(elId, { slideIndex: -1, element: { id: elId, kind: "activity", prompt: "(نشاط محذوف)", options: [] } });
      }
    }

    /* Distinct participants = distinct studentKeys across all rows.
       studentName is taken from the most recent row for that key. */
    const participantNames = new Map<string, string>();
    for (const r of rows) participantNames.set(r.studentKey, r.studentName);

    /* Resolve target class roster (when bound). Used to:
        - compute participation rate (participants / classSize), and
        - tag each student row as `class` vs `guest` so the UI can
          surface students who joined without being on the roster. */
    let className: string | null = null;
    let classSize: number | null = null;
    const rosterNames = new Set<string>();
    const rosterIds = new Set<number>();
    const rosterList: Array<{ id: number; name: string }> = [];
    if (sess.mode === "class" && sess.targetClassId) {
      const [cls] = await db
        .select({ name: teacherClassesTable.name })
        .from(teacherClassesTable)
        .where(eq(teacherClassesTable.id, sess.targetClassId))
        .limit(1);
      if (cls) {
        className = cls.name;
        const roster = await db
          .select({ id: studentsTable.id, name: studentsTable.name })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.teacherId, sess.teacherId),
            eq(studentsTable.studentClass, cls.name),
          ));
        classSize = roster.length;
        for (const r of roster) {
          rosterIds.add(r.id);
          if (r.name) rosterNames.add(r.name.trim().toLowerCase());
          if (r.name) rosterList.push({ id: r.id, name: r.name });
        }
      }
    }

    // Per-activity avg response time (per-student gaps, capped at 10min) + skipped count.
    const sessionStartMs = sess.startedAt?.getTime() ?? null;
    const respByStudent = new Map<string, Array<{ elementId: string; t: number }>>();
    for (const r of rows) {
      const arr = respByStudent.get(r.studentKey) ?? [];
      arr.push({ elementId: r.elementId, t: r.createdAt.getTime() });
      respByStudent.set(r.studentKey, arr);
    }
    for (const arr of respByStudent.values()) arr.sort((a, b) => a.t - b.t);
    const gapsByActivity = new Map<string, number[]>();
    const allGaps: number[] = [];
    for (const arr of respByStudent.values()) {
      let prev: number | null = sessionStartMs;
      for (const r of arr) {
        if (prev != null) {
          const gap = Math.round((r.t - prev) / 1000);
          if (gap >= 0 && gap <= 600) {
            const list = gapsByActivity.get(r.elementId) ?? [];
            list.push(gap);
            gapsByActivity.set(r.elementId, list);
            allGaps.push(gap);
          }
        }
        prev = r.t;
      }
    }
    const avgOf = (arr: number[]): number | null =>
      arr.length === 0 ? null : Math.round(arr.reduce((s, x) => s + x, 0) / arr.length);

    const totalParticipantSet = new Set<string>();
    for (const r of rows) totalParticipantSet.add(r.studentKey);
    const totalParticipants = totalParticipantSet.size;

    const activities = Array.from(activityIndex.entries())
      .map(([elementId, { slideIndex, element }]) => {
        const responses = byElement.get(elementId) ?? [];
        const counts: Record<string, number> = {};
        let correct = 0;
        let answered = 0;
        const answeredKeys = new Set<string>();
        for (const r of responses) {
          answered++;
          answeredKeys.add(r.studentKey);
          const k = r.answerIndex == null ? "?" : String(r.answerIndex);
          counts[k] = (counts[k] ?? 0) + 1;
          if (r.isCorrect === true) correct++;
        }
        const correctIndex = typeof element.correctIndex === "number" ? element.correctIndex : null;
        const correctPct = answered > 0 && correctIndex != null ? Math.round((correct / answered) * 100) : null;
        const avgResponseSec = avgOf(gapsByActivity.get(elementId) ?? []);
        /* "Skipped" = present-in-session students who didn't answer this Q. */
        const skipped = Math.max(0, totalParticipants - answeredKeys.size);
        return {
          elementId,
          slideIndex,
          activityKind: element.activityKind ?? "mcq",
          prompt: element.prompt ?? "",
          options: Array.isArray(element.options) ? element.options : [],
          correctIndex,
          counts,
          answered,
          correct,
          correctPct,
          skipped,
          avgResponseSec,
          responses: responses
            .slice()
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((r) => ({
              studentKey: r.studentKey,
              studentName: r.studentName,
              answerIndex: r.answerIndex,
              answerText: r.answerText,
              isCorrect: r.isCorrect,
              createdAt: r.createdAt.toISOString(),
            })),
        };
      })
      .sort((a, b) => a.slideIndex - b.slideIndex);

    /* Per-student aggregates: answered, correct (only over scorable
       responses — those where `isCorrect` was set at submit time, so
       polls never count and historical edits to the deck cannot
       retroactively change the numbers). Students keyed by
       `studentKey` so the same human joining twice (different name
       spelling) still produces one row. */
    const scorableActivities = activities.filter((a) => a.correctIndex != null);
    const scorableResponseElementIds = new Set<string>();
    for (const r of rows) {
      if (r.isCorrect != null) scorableResponseElementIds.add(r.elementId);
    }
    type StudentAgg = { studentKey: string; name: string; answered: number; correct: number; classStudentId: number | null };
    const studentMap = new Map<string, StudentAgg>();
    for (const r of rows) {
      const cur = studentMap.get(r.studentKey) ?? {
        studentKey: r.studentKey,
        name: r.studentName,
        answered: 0,
        correct: 0,
        classStudentId: null,
      };
      cur.name = r.studentName;
      /* Latch the most recent non-null classStudentId so any single
         tagged response promotes this student key to "class". */
      if (r.classStudentId != null) cur.classStudentId = r.classStudentId;
      if (r.isCorrect != null) {
        cur.answered++;
        if (r.isCorrect === true) cur.correct++;
      }
      studentMap.set(r.studentKey, cur);
    }
    const totalScorableForStudent = scorableResponseElementIds.size;
    const students = Array.from(studentMap.values()).map((s) => {
      /* Classify by stable id first; fall back to name match for
         legacy rows that pre-date the class_student_id column. */
      let isClass = false;
      if (className != null) {
        if (s.classStudentId != null && rosterIds.has(s.classStudentId)) isClass = true;
        else if (s.classStudentId == null && rosterNames.has((s.name ?? "").trim().toLowerCase())) isClass = true;
      }
      const total = totalScorableForStudent;
      const pct = total > 0 ? Math.round((s.correct / total) * 100) : null;
      return {
        studentKey: s.studentKey,
        name: s.name,
        answered: s.answered,
        correct: s.correct,
        totalScorable: total,
        pct,
        kind: (className == null ? "guest" : isClass ? "class" : "guest") as "class" | "guest",
        /* Stable roster id for the timeline link. Only surfaced when
           the student is actually on the roster — guest rows stay
           null even if they happened to type a real student's name. */
        classStudentId: isClass && s.classStudentId != null && rosterIds.has(s.classStudentId)
          ? s.classStudentId
          : null,
      };
    });
    students.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.name.localeCompare(b.name, "ar"));

    // Top-3 hardest scorable activities by lowest correctPct (ties: higher answered first).
    const hardestActivities = scorableActivities
      .filter((a) => a.answered > 0 && a.correctPct != null)
      .slice()
      .sort((a, b) => (a.correctPct ?? 100) - (b.correctPct ?? 100) || b.answered - a.answered)
      .slice(0, 3)
      .map((a) => ({
        elementId: a.elementId,
        slideIndex: a.slideIndex,
        prompt: a.prompt,
        answered: a.answered,
        correct: a.correct,
        correctPct: a.correctPct,
      }));

    // Session totals from stored isCorrect (not current deck) so post-session edits don't shift numbers.
    let totalScorableAnswers = 0;
    let totalCorrect = 0;
    for (const r of rows) {
      if (r.isCorrect != null) {
        totalScorableAnswers++;
        if (r.isCorrect === true) totalCorrect++;
      }
    }
    const avgScorePct = totalScorableAnswers > 0 ? Math.round((totalCorrect / totalScorableAnswers) * 100) : null;
    const participationPct = classSize && classSize > 0
      ? Math.min(100, Math.round((participantNames.size / classSize) * 100))
      : null;
    const startedAtMs = sess.startedAt?.getTime() ?? null;
    const endedAtMs = sess.endedAt?.getTime() ?? null;
    const durationMin = startedAtMs && endedAtMs ? Math.max(1, Math.round((endedAtMs - startedAtMs) / 60000)) : null;

    // Phase 1 insights (computed in-memory from the rows we already pulled).
    const avgAnswerSec = avgOf(allGaps);

    // Most-engaged slide: most distinct students; ties broken by earlier slideIndex.
    const slideStudents = new Map<number, Set<string>>();
    for (const r of rows) {
      const meta = activityIndex.get(r.elementId);
      const idx = meta?.slideIndex ?? -1;
      if (idx < 0) continue;
      let set = slideStudents.get(idx);
      if (!set) { set = new Set(); slideStudents.set(idx, set); }
      set.add(r.studentKey);
    }
    let mostEngagedSlide: { slideIndex: number; participants: number } | null = null;
    for (const [idx, set] of slideStudents.entries()) {
      if (!mostEngagedSlide
        || set.size > mostEngagedSlide.participants
        || (set.size === mostEngagedSlide.participants && idx < mostEngagedSlide.slideIndex)) {
        mostEngagedSlide = { slideIndex: idx, participants: set.size };
      }
    }

    // Class-mode non-responders: roster ids/names absent from any response.
    const respondedClassIds = new Set<number>();
    const respondedNamesLower = new Set<string>();
    for (const s of studentMap.values()) {
      if (s.classStudentId != null) respondedClassIds.add(s.classStudentId);
      respondedNamesLower.add((s.name ?? "").trim().toLowerCase());
    }
    const nonResponders = className == null ? [] : rosterList
      .filter((r) =>
        !respondedClassIds.has(r.id)
        && !respondedNamesLower.has((r.name ?? "").trim().toLowerCase()),
      )
      .map((r) => ({ id: r.id, name: r.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"))
      .slice(0, 50);

    // Lowest-3 by participation (answered count). Skip if deck has no scorable items.
    const totalScorableActivities = activities.filter((a) => a.correctIndex != null).length;
    const lowestParticipants = className == null || totalScorableActivities === 0 ? [] : students
      .filter((s) => s.kind === "class")
      .filter((s) => s.answered < totalScorableActivities)
      .slice()
      .sort((a, b) =>
        a.answered - b.answered
        || (a.pct ?? 0) - (b.pct ?? 0)
        || a.name.localeCompare(b.name, "ar"),
      )
      .slice(0, 3)
      .map((s) => ({
        studentKey: s.studentKey,
        name: s.name,
        pct: s.pct,
        correct: s.correct,
        answered: s.answered,
        totalActivities: totalScorableActivities,
      }));

    // Class-only average (excludes guest rows in class mode); null if no class data.
    let classAvgPct: number | null = null;
    if (className != null) {
      let cAns = 0;
      let cCor = 0;
      const classStudentKeys = new Set(students.filter((s) => s.kind === "class").map((s) => s.studentKey));
      for (const r of rows) {
        if (r.isCorrect == null) continue;
        if (!classStudentKeys.has(r.studentKey)) continue;
        cAns++;
        if (r.isCorrect === true) cCor++;
      }
      classAvgPct = cAns > 0 ? Math.round((cCor / cAns) * 100) : null;
    } else {
      classAvgPct = avgScorePct;
    }

    const insights = {
      hardestQ: hardestActivities[0] ?? null,
      mostEngagedSlide,
      participationPct,
      nonResponders,
      avgAnswerSec,
      successPct: avgScorePct,
      lowestParticipants,
      classAvgPct,
    };

    res.json({
      session: {
        id: sess.id,
        pin: sess.pin,
        status: sess.status,
        mode: sess.mode,
        startedAt: sess.startedAt?.toISOString() ?? null,
        endedAt: sess.endedAt?.toISOString() ?? null,
        targetClassId: sess.targetClassId,
        targetClassName: className,
      },
      deck: { id: deck.id, title: deck.title, language: deck.language },
      participantsCount: participantNames.size,
      classSize,
      summary: {
        participantsCount: participantNames.size,
        classSize,
        participationPct,
        avgScorePct,
        scorableActivities: scorableActivities.length,
        totalActivities: activities.length,
        totalAnswers: rows.length,
        durationMin,
      },
      hardestActivities,
      students,
      activities,
      insights,
    });
  } catch (err) {
    req.log?.error({ err }, "Get session results failed");
    res.status(500).json({ message: "Failed to load results" });
  }
});

/* ─────────────────── Owner-only: compare sessions of one deck ─────────
   Cross-session comparison for a deck — used by `/teacher/presentations
   /:id/compare`. Produces one row per session with shared dimensions
   (participants, avgScore, participation, avg-answer-sec, hardest Q),
   plus a deck-level rollup that surfaces the question that has been
   the hardest across the most sessions. */
router.get("/presentations/:id/sessions/compare", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Bad id" });
    if (!(await ownsPresentation(teacherId, id))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deck = await loadDeck(id);
    if (!deck) return res.status(404).json({ message: "Deck not found" });

    const sessions = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.presentationId, id))
      .orderBy(presentationSessionsTable.createdAt);
    if (sessions.length === 0) {
      return res.json({
        deck: { id: deck.id, title: deck.title, language: deck.language },
        sessions: [],
        repeatedHardest: null,
      });
    }

    /* Hydrate the deck once — we need element prompts/correctIndex to
       label the hardest-Q output. */
    const rawSlides = Array.isArray(deck.slides) ? (deck.slides as any[]) : [];
    const hydrated = (await hydrateActivityQuestions(rawSlides)) as any[];
    const elementMeta = new Map<string, { slideIndex: number; prompt: string; correctIndex: number | null }>();
    hydrated.forEach((slide, slideIndex) => {
      if (!slide || !Array.isArray(slide.elements)) return;
      for (const el of slide.elements) {
        if (el?.kind === "activity" && typeof el.id === "string") {
          elementMeta.set(el.id, {
            slideIndex,
            prompt: el.prompt ?? "",
            correctIndex: typeof el.correctIndex === "number" ? el.correctIndex : null,
          });
        }
      }
    });

    /* Pull every response for every session in one round-trip. */
    const sessionIds = sessions.map((s) => s.id);
    const sessionIdsSql = sql.join(sessionIds.map((x) => sql`${x}`), sql`, `);
    const allRows = await db
      .select()
      .from(presentationResponsesTable)
      .where(sql`${presentationResponsesTable.sessionId} IN (${sessionIdsSql})`);

    const rowsBySession = new Map<number, typeof allRows>();
    for (const r of allRows) {
      const list = rowsBySession.get(r.sessionId) ?? [];
      list.push(r);
      rowsBySession.set(r.sessionId, list);
    }

    /* Class roster sizes — same grouped query pattern used by /history. */
    const classIds = Array.from(new Set(sessions.map((s) => s.targetClassId).filter((x): x is number => x != null)));
    const classMeta = new Map<number, { name: string; size: number }>();
    if (classIds.length > 0) {
      const classes = await db
        .select({ id: teacherClassesTable.id, name: teacherClassesTable.name })
        .from(teacherClassesTable)
        .where(sql`${teacherClassesTable.id} IN (${sql.join(classIds.map((x) => sql`${x}`), sql`, `)})`);
      const classNames = classes.map((c) => c.name);
      const sizeByName = new Map<string, number>();
      if (classNames.length > 0) {
        const sizeRows = await db
          .select({
            studentClass: studentsTable.studentClass,
            n: sql<number>`COUNT(*)`.mapWith(Number),
          })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.teacherId, teacherId),
            sql`${studentsTable.studentClass} IN (${sql.join(classNames.map((x) => sql`${x}`), sql`, `)})`,
          ))
          .groupBy(studentsTable.studentClass);
        for (const r of sizeRows) {
          if (r.studentClass) sizeByName.set(r.studentClass, r.n ?? 0);
        }
      }
      for (const c of classes) {
        classMeta.set(c.id, { name: c.name, size: sizeByName.get(c.name) ?? 0 });
      }
    }

    /* Per-session aggregate. Mirrors the /results computations but
       collapsed to a single row per session. */
    const hardestCounter = new Map<string, number>();
    const out = sessions.map((s) => {
      const rows = rowsBySession.get(s.id) ?? [];
      const cls = s.targetClassId != null ? classMeta.get(s.targetClassId) : undefined;
      const startMs = s.startedAt?.getTime() ?? null;
      const endMs = s.endedAt?.getTime() ?? null;
      const durationMin = startMs && endMs ? Math.max(1, Math.round((endMs - startMs) / 60000)) : null;

      const partSet = new Set<string>();
      let scorable = 0;
      let correct = 0;
      const perElem = new Map<string, { ans: number; cor: number }>();
      for (const r of rows) {
        partSet.add(r.studentKey);
        if (r.isCorrect != null) {
          scorable++;
          if (r.isCorrect === true) correct++;
          const e = perElem.get(r.elementId) ?? { ans: 0, cor: 0 };
          e.ans++;
          if (r.isCorrect === true) e.cor++;
          perElem.set(r.elementId, e);
        }
      }
      const avgScorePct = scorable > 0 ? Math.round((correct / scorable) * 100) : null;
      const participationPct = cls && cls.size > 0
        ? Math.min(100, Math.round((partSet.size / cls.size) * 100))
        : null;

      // Per-student gaps -> overall avg answer time.
      const byStu = new Map<string, number[]>();
      for (const r of rows) {
        const arr = byStu.get(r.studentKey) ?? [];
        arr.push(r.createdAt.getTime());
        byStu.set(r.studentKey, arr);
      }
      const gaps: number[] = [];
      for (const arr of byStu.values()) {
        arr.sort((a, b) => a - b);
        let prev: number | null = startMs;
        for (const t of arr) {
          if (prev != null) {
            const g = Math.round((t - prev) / 1000);
            if (g >= 0 && g <= 600) gaps.push(g);
          }
          prev = t;
        }
      }
      const avgAnswerSec = gaps.length > 0
        ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
        : null;

      // Hardest Q from response rows (so deleted/edited deck items still register historically).
      let hardest: { elementId: string; prompt: string; correctPct: number; answered: number; slideIndex: number } | null = null;
      for (const [eid, e] of perElem.entries()) {
        if (e.ans === 0) continue;
        const meta = elementMeta.get(eid);
        const pct = Math.round((e.cor / e.ans) * 100);
        if (!hardest || pct < hardest.correctPct) {
          hardest = {
            elementId: eid,
            prompt: meta?.prompt ?? "(سؤال محذوف)",
            correctPct: pct,
            answered: e.ans,
            slideIndex: meta?.slideIndex ?? -1,
          };
        }
      }
      if (hardest) hardestCounter.set(hardest.elementId, (hardestCounter.get(hardest.elementId) ?? 0) + 1);

      return {
        id: s.id,
        pin: s.pin,
        status: s.status,
        mode: s.mode,
        targetClassName: cls?.name ?? null,
        classSize: cls?.size ?? null,
        startedAt: s.startedAt?.toISOString() ?? null,
        endedAt: s.endedAt?.toISOString() ?? null,
        durationMin,
        participantsCount: partSet.size,
        avgScorePct,
        participationPct,
        avgAnswerSec,
        hardest,
      };
    });

    // Repeated-hardest: elementId that was hardest in ≥2 sessions.
    let repeatedHardest: { elementId: string; prompt: string; slideIndex: number; sessions: number } | null = null;
    for (const [eid, n] of hardestCounter.entries()) {
      if (n < 2) continue;
      if (!repeatedHardest || n > repeatedHardest.sessions) {
        const meta = elementMeta.get(eid);
        repeatedHardest = {
          elementId: eid,
          prompt: meta?.prompt ?? "(سؤال محذوف)",
          slideIndex: meta?.slideIndex ?? -1,
          sessions: n,
        };
      }
    }

    res.json({
      deck: { id: deck.id, title: deck.title, language: deck.language },
      sessions: out,
      repeatedHardest,
    });
  } catch (err) {
    req.log?.error({ err }, "Compare presentation sessions failed");
    res.status(500).json({ message: "Failed to compare" });
  }
});

/* ─────────────────── Owner-only: sessions history ───────────────────
   List of past + active sessions for a given deck. Used by the
   "Past results" page and the per-card "Results" entry. Each row
   carries the lightweight aggregates needed to render a list — full
   per-question / per-student data is fetched lazily by clicking
   through to `/p/results/:sessionId`. */
router.get("/presentations/:id/sessions/history", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Bad id" });
    if (!(await ownsPresentation(teacherId, id))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const sessions = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.presentationId, id))
      .orderBy(desc(presentationSessionsTable.createdAt));

    if (sessions.length === 0) return res.json({ sessions: [] });

    /* Load the deck only for the header label (title/language). All
       score aggregates are computed from the stored response.isCorrect
       so they remain stable even if the deck is later edited. */
    const deck = await loadDeck(id);

    /* Single round-trip per-session aggregate: distinct participants,
       total answers, scorable answers (isCorrect IS NOT NULL), and
       correct count. COUNT(DISTINCT) keeps a student answering many
       questions as one participant. */
    const sessionIds = sessions.map((s) => s.id);
    const sessionIdsSql = sql.join(sessionIds.map((x) => sql`${x}`), sql`, `);
    const aggRows = await db
      .select({
        sessionId: presentationResponsesTable.sessionId,
        participants: sql<number>`COUNT(DISTINCT ${presentationResponsesTable.studentKey})`.mapWith(Number),
        totalAnswers: sql<number>`COUNT(*)`.mapWith(Number),
        scorableAnswers: sql<number>`SUM(CASE WHEN ${presentationResponsesTable.isCorrect} IS NOT NULL THEN 1 ELSE 0 END)`.mapWith(Number),
        correct: sql<number>`SUM(CASE WHEN ${presentationResponsesTable.isCorrect} = true THEN 1 ELSE 0 END)`.mapWith(Number),
      })
      .from(presentationResponsesTable)
      .where(sql`${presentationResponsesTable.sessionId} IN (${sessionIdsSql})`)
      .groupBy(presentationResponsesTable.sessionId);
    const aggBySession = new Map<number, { participants: number; totalAnswers: number; scorableAnswers: number; correct: number }>();
    for (const r of aggRows) {
      aggBySession.set(r.sessionId, {
        participants: r.participants ?? 0,
        totalAnswers: r.totalAnswers ?? 0,
        scorableAnswers: r.scorableAnswers ?? 0,
        correct: r.correct ?? 0,
      });
    }

    /* Roster sizes per bound class — single grouped query covering
       every class referenced by any session. No per-class loop. */
    const classIds = Array.from(new Set(sessions.map((s) => s.targetClassId).filter((x): x is number => x != null)));
    const classMeta = new Map<number, { name: string; size: number }>();
    if (classIds.length > 0) {
      const classes = await db
        .select({ id: teacherClassesTable.id, name: teacherClassesTable.name })
        .from(teacherClassesTable)
        .where(sql`${teacherClassesTable.id} IN (${sql.join(classIds.map((x) => sql`${x}`), sql`, `)})`);
      const classNames = classes.map((c) => c.name);
      const sizeByName = new Map<string, number>();
      if (classNames.length > 0) {
        const sizeRows = await db
          .select({
            studentClass: studentsTable.studentClass,
            n: sql<number>`COUNT(*)`.mapWith(Number),
          })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.teacherId, teacherId),
            sql`${studentsTable.studentClass} IN (${sql.join(classNames.map((x) => sql`${x}`), sql`, `)})`,
          ))
          .groupBy(studentsTable.studentClass);
        for (const r of sizeRows) {
          if (r.studentClass) sizeByName.set(r.studentClass, r.n ?? 0);
        }
      }
      for (const c of classes) {
        classMeta.set(c.id, { name: c.name, size: sizeByName.get(c.name) ?? 0 });
      }
    }

    const out = sessions.map((s) => {
      const agg = aggBySession.get(s.id) ?? { participants: 0, totalAnswers: 0, scorableAnswers: 0, correct: 0 };
      const cls = s.targetClassId != null ? classMeta.get(s.targetClassId) : undefined;
      const startedMs = s.startedAt?.getTime() ?? null;
      const endedMs = s.endedAt?.getTime() ?? null;
      const durationMin = startedMs && endedMs ? Math.max(1, Math.round((endedMs - startedMs) / 60000)) : null;
      return {
        id: s.id,
        pin: s.pin,
        status: s.status,
        mode: s.mode,
        targetClassId: s.targetClassId,
        targetClassName: cls?.name ?? null,
        classSize: cls?.size ?? null,
        createdAt: s.createdAt.toISOString(),
        startedAt: s.startedAt?.toISOString() ?? null,
        endedAt: s.endedAt?.toISOString() ?? null,
        durationMin,
        participantsCount: agg.participants,
        totalAnswers: agg.totalAnswers,
        avgScorePct: agg.scorableAnswers > 0 ? Math.round((agg.correct / agg.scorableAnswers) * 100) : null,
        participationPct: cls && cls.size > 0
          ? Math.min(100, Math.round((agg.participants / cls.size) * 100))
          : null,
      };
    });

    res.json({
      deck: deck ? { id: deck.id, title: deck.title, language: deck.language } : null,
      sessions: out,
    });
  } catch (err) {
    req.log?.error({ err }, "List session history failed");
    res.status(500).json({ message: "Failed to load history" });
  }
});

/* ─────────────────── Owner-only: results CSV export ───────────────────
   Streams the same per-(student, activity) data shown on the results
   dashboard as a CSV download. One row per response, columns:
   slideIndex, activityPrompt, studentName, studentKey, answer,
   isCorrect, timestamp. Filename embeds the deck title + session id. */
router.get("/presentations/sessions/:id/results.csv", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const sid = parseInt(req.params.id, 10);
    if (!Number.isFinite(sid)) return res.status(400).json({ message: "Bad id" });

    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.id, sid))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "Not found" });
    if (sess.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });

    const deck = await loadDeck(sess.presentationId);
    if (!deck) return res.status(404).json({ message: "Deck not found" });

    const rawSlides = Array.isArray(deck.slides) ? (deck.slides as any[]) : [];
    const hydrated = (await hydrateActivityQuestions(rawSlides)) as any[];
    const activityIndex = new Map<string, { slideIndex: number; element: any }>();
    hydrated.forEach((slide, slideIndex) => {
      if (!slide || !Array.isArray(slide.elements)) return;
      for (const el of slide.elements) {
        if (el?.kind === "activity" && typeof el.id === "string") {
          activityIndex.set(el.id, { slideIndex, element: el });
        }
      }
    });

    const rows = await db
      .select()
      .from(presentationResponsesTable)
      .where(eq(presentationResponsesTable.sessionId, sid));

    /* Stable order: by slide index, then by response time. Responses
       for activities no longer present on the deck are appended last. */
    rows.sort((a, b) => {
      const sa = activityIndex.get(a.elementId)?.slideIndex ?? Number.MAX_SAFE_INTEGER;
      const sb = activityIndex.get(b.elementId)?.slideIndex ?? Number.MAX_SAFE_INTEGER;
      if (sa !== sb) return sa - sb;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    /* Prefix CSV cells that start with =, +, -, @, tab, or CR with a
       leading apostrophe to neutralize spreadsheet formula injection
       (untrusted student names/answers can otherwise be evaluated by
       Excel/Sheets/Numbers when the file is opened). */
    const escape = (v: unknown): string => {
      let s = v == null ? "" : String(v);
      if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = ["slide", "activity", "student", "studentKey", "answer", "isCorrect", "timestamp"];
    const lines: string[] = [header.join(",")];
    for (const r of rows) {
      const meta = activityIndex.get(r.elementId);
      const el = meta?.element;
      const slideLabel = meta && meta.slideIndex >= 0 ? String(meta.slideIndex + 1) : "";
      const prompt = el?.prompt ?? "(نشاط محذوف)";
      const options: string[] = Array.isArray(el?.options) ? el.options : [];
      const answer = r.answerText
        ?? (r.answerIndex != null && options[r.answerIndex] != null
          ? options[r.answerIndex]
          : (r.answerIndex != null ? `#${r.answerIndex + 1}` : ""));
      const isCorrect = r.isCorrect == null ? "" : r.isCorrect ? "true" : "false";
      lines.push([
        escape(slideLabel),
        escape(prompt),
        escape(r.studentName),
        escape(r.studentKey),
        escape(answer),
        escape(isCorrect),
        escape(r.createdAt.toISOString()),
      ].join(","));
    }

    /* BOM so Excel opens UTF-8 Arabic correctly. */
    const csv = "\ufeff" + lines.join("\r\n") + "\r\n";

    /* Filename: slugify deck title to ASCII-safe chars, fall back to
       a generic name; also send a UTF-8 filename* for browsers that
       support RFC 5987 so Arabic deck titles aren't lost. */
    const titleRaw = (deck.title ?? "presentation").trim() || "presentation";
    const asciiSlug = titleRaw
      .replace(/[\\/:*?"<>|\r\n]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 60) || "presentation";
    const fnameAscii = `${asciiSlug}-session-${sid}.csv`;
    const fnameUtf8 = encodeURIComponent(`${titleRaw} - جلسة ${sid}.csv`);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fnameAscii}"; filename*=UTF-8''${fnameUtf8}`,
    );
    res.send(csv);
  } catch (err) {
    req.log?.error({ err }, "Export session results CSV failed");
    res.status(500).json({ message: "Failed to export CSV" });
  }
});

/* ─────────────────── Owner-only: students summary CSV ───────────────────
   Per-student aggregate (one row per studentKey) with totals, % score,
   and class/guest tag. Lighter than the per-response CSV — meant for
   quick gradebook-style exports. */
router.get("/presentations/sessions/:id/students.csv", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const sid = parseInt(req.params.id, 10);
    if (!Number.isFinite(sid)) return res.status(400).json({ message: "Bad id" });

    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.id, sid))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "Not found" });
    if (sess.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });

    const deck = await loadDeck(sess.presentationId);
    if (!deck) return res.status(404).json({ message: "Deck not found" });

    const rawSlides = Array.isArray(deck.slides) ? (deck.slides as any[]) : [];
    const hydrated = (await hydrateActivityQuestions(rawSlides)) as any[];
    const scorableIds = new Set<string>();
    for (const slide of hydrated) {
      if (!slide || !Array.isArray(slide.elements)) continue;
      for (const el of slide.elements) {
        if (el?.kind === "activity" && typeof el.id === "string" && typeof el.correctIndex === "number") {
          scorableIds.add(el.id);
        }
      }
    }

    const rows = await db
      .select()
      .from(presentationResponsesTable)
      .where(eq(presentationResponsesTable.sessionId, sid));

    const rosterNames = new Set<string>();
    const rosterIds = new Set<number>();
    let className: string | null = null;
    if (sess.mode === "class" && sess.targetClassId) {
      const [cls] = await db
        .select({ name: teacherClassesTable.name })
        .from(teacherClassesTable)
        .where(eq(teacherClassesTable.id, sess.targetClassId))
        .limit(1);
      if (cls) {
        className = cls.name;
        const roster = await db
          .select({ id: studentsTable.id, name: studentsTable.name })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.teacherId, sess.teacherId),
            eq(studentsTable.studentClass, cls.name),
          ));
        for (const r of roster) {
          rosterIds.add(r.id);
          if (r.name) rosterNames.add(r.name.trim().toLowerCase());
        }
      }
    }

    type Agg = { name: string; answered: number; correct: number; lastAt: Date; classStudentId: number | null };
    const byKey = new Map<string, Agg>();
    for (const r of rows) {
      const a = byKey.get(r.studentKey) ?? { name: r.studentName, answered: 0, correct: 0, lastAt: r.createdAt, classStudentId: null };
      a.name = r.studentName;
      if (r.classStudentId != null) a.classStudentId = r.classStudentId;
      if (scorableIds.has(r.elementId)) {
        a.answered++;
        if (r.isCorrect === true) a.correct++;
      }
      if (r.createdAt > a.lastAt) a.lastAt = r.createdAt;
      byKey.set(r.studentKey, a);
    }

    const total = scorableIds.size;
    const escape = (v: unknown): string => {
      let s = v == null ? "" : String(v);
      if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const header = ["student", "studentKey", "kind", "answered", "correct", "totalScorable", "scorePct", "lastActivityAt"];
    const lines: string[] = [header.join(",")];
    const out = Array.from(byKey.entries()).map(([key, a]) => {
      let isClass = false;
      if (className != null) {
        if (a.classStudentId != null && rosterIds.has(a.classStudentId)) isClass = true;
        else if (a.classStudentId == null && rosterNames.has((a.name ?? "").trim().toLowerCase())) isClass = true;
      }
      const kind = className == null ? "guest" : isClass ? "class" : "guest";
      const pct = total > 0 ? Math.round((a.correct / total) * 100) : "";
      return { key, ...a, kind, pct };
    });
    out.sort((a, b) => (typeof b.pct === "number" ? b.pct : -1) - (typeof a.pct === "number" ? a.pct : -1));
    for (const r of out) {
      lines.push([
        escape(r.name),
        escape(r.key),
        escape(r.kind),
        escape(r.answered),
        escape(r.correct),
        escape(total),
        escape(r.pct),
        escape(r.lastAt.toISOString()),
      ].join(","));
    }

    const csv = "\ufeff" + lines.join("\r\n") + "\r\n";
    const titleRaw = (deck.title ?? "presentation").trim() || "presentation";
    const asciiSlug = titleRaw.replace(/[\\/:*?"<>|\r\n]/g, "").replace(/\s+/g, "_").slice(0, 60) || "presentation";
    const fnameAscii = `${asciiSlug}-students-${sid}.csv`;
    const fnameUtf8 = encodeURIComponent(`${titleRaw} - طلاب جلسة ${sid}.csv`);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fnameAscii}"; filename*=UTF-8''${fnameUtf8}`,
    );
    res.send(csv);
  } catch (err) {
    req.log?.error({ err }, "Export session students CSV failed");
    res.status(500).json({ message: "Failed to export CSV" });
  }
});

/* ─────────────────── Public: PIN lookup + join ─────────────────── */

/* PIN brute-force guard — 5 attempts/min/IP per spec. */
const pinJoinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "محاولات كثيرة. حاول مجدداً بعد دقيقة." },
});

/** Strip the correct answer + any internal-only fields. The answer is
 *  only re-emitted via the dedicated `results:reveal-answer` event.
 *  Phase 6 — also strips nested `questions[*].correctIndex` for
 *  hasad-game elements so inline-quiz answer keys never leak via REST. */
function sanitizeElementForStudents(el: any): any {
  if (!el || typeof el !== "object") return el;
  const { correctIndex: _omit, questions, ...rest } = el as any;
  /* Phase 6 — drop the full `questions[]` from non-owner REST
     payloads. Students only need the count for badges; the current
     question's prompt/options are surfaced via the `inlineActivity`
     field on the same `/state` response (computed below in the
     route handler) so reload still resumes mid-quiz. */
  if (Array.isArray(questions)) {
    (rest as any).questionsCount = questions.length;
  }
  return rest;
}

/** Strip teacher-only metadata from a slide so non-owner callers
 *  (show projector + students) can't peek at activity answers.
 *  Phase 6 — sanitizes both `activity` AND `hasad-game` elements; the
 *  latter carries nested `questions[*].correctIndex`. */
function sanitizeSlideForPublic(slide: any): any {
  if (!slide || typeof slide !== "object") return slide;
  if (!Array.isArray(slide.elements)) return slide;
  return {
    ...slide,
    elements: slide.elements.map((e: any) =>
      e?.kind === "activity" || e?.kind === "hasad-game"
        ? sanitizeElementForStudents(e)
        : e,
    ),
  };
}

router.post("/p/sessions/by-pin", pinJoinLimiter, async (req: any, res) => {
  try {
    const pin = String(req.body?.pin ?? "").trim();
    const rawName = String(req.body?.name ?? "").trim().slice(0, 40);
    const classStudentId = req.body?.classStudentId != null ? Number(req.body.classStudentId) : null;
    let studentKey = String(req.body?.studentKey ?? "").trim().slice(0, 40);
    if (!/^\d{6}$/.test(pin)) return res.status(400).json({ message: "PIN غير صالح" });

    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(and(eq(presentationSessionsTable.pin, pin), ne(presentationSessionsTable.status, "ended")))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "لا توجد جلسة بهذا الرقم" });

    let resolvedName = rawName;
    let resolvedClassStudentId: number | null = null;

    /* Class-mode admission. Either:
       - classStudentId points to a roster row in the bound class, OR
       - name (case-insensitive) matches a roster name in that class.
       Otherwise reject. Guest mode just needs a non-empty name. */
    if (sess.mode === "class" && sess.targetClassId) {
      const [cls] = await db
        .select({ name: teacherClassesTable.name })
        .from(teacherClassesTable)
        .where(eq(teacherClassesTable.id, sess.targetClassId))
        .limit(1);
      if (!cls) return res.status(409).json({ message: "تعذّر تحميل قائمة الفصل" });

      if (classStudentId && Number.isFinite(classStudentId)) {
        const [stu] = await db
          .select({ id: studentsTable.id, name: studentsTable.name })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.id, classStudentId),
            eq(studentsTable.teacherId, sess.teacherId),
            eq(studentsTable.studentClass, cls.name),
          ))
          .limit(1);
        if (!stu) return res.status(403).json({ message: "الطالب غير موجود في الفصل" });
        resolvedName = stu.name;
        resolvedClassStudentId = stu.id;
      } else {
        if (!resolvedName) return res.status(400).json({ message: "الاسم مطلوب" });
        /* Legacy free-text path — try to match a single unique roster
           entry by name so we can still attach a stable id. If the
           name is duplicated on the roster, we fall back to no id
           (results endpoint then matches by name). */
        const roster = await db
          .select({ id: studentsTable.id, name: studentsTable.name })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.teacherId, sess.teacherId),
            eq(studentsTable.studentClass, cls.name),
          ));
        const matches = roster.filter((r) => (r.name ?? "").trim().toLowerCase() === resolvedName.toLowerCase());
        if (matches.length === 0) return res.status(403).json({ message: "اسمك غير مدرج في قائمة الفصل" });
        resolvedName = matches[0].name;
        if (matches.length === 1) resolvedClassStudentId = matches[0].id;
      }
    } else {
      if (!resolvedName) return res.status(400).json({ message: "الاسم مطلوب" });
    }

    if (!studentKey) studentKey = crypto.randomBytes(16).toString("hex");

    /* Mint a signed join token. Socket layer + public /state both
       require it, so socket joins cannot be performed by guessing a
       numeric sessionId — possession of the PIN (proven via this
       rate-limited endpoint) is mandatory. */
    const joinToken = mintPresentationJoinToken(sess.id, studentKey, resolvedClassStudentId);

    res.json({
      sessionId: sess.id,
      studentKey,
      joinToken,
      mode: sess.mode,
      currentSlideIndex: sess.currentSlideIndex,
      activeElementId: sess.activeElementId,
      revealDistribution: sess.revealDistribution,
      revealAnswer: sess.revealAnswer,
      status: sess.status,
      name: resolvedName,
      classStudentId: resolvedClassStudentId,
    });
  } catch (err) {
    req.log?.error({ err }, "PIN join failed");
    res.status(500).json({ message: "فشل الانضمام" });
  }
});

/* ─────────────────── Public: PIN info (mode + roster) ───────────────────
   Returns the session's mode and, for class-mode sessions, the roster
   so the join page can render a name picker instead of free-text. The
   PIN already gates this endpoint (caller must know it), and we never
   expose teacherId or session internals. */
router.get("/p/by-pin/:pin/info", pinJoinLimiter, async (req: any, res) => {
  try {
    const pin = String(req.params.pin ?? "").trim();
    if (!/^\d{6}$/.test(pin)) return res.status(400).json({ message: "PIN غير صالح" });
    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(and(eq(presentationSessionsTable.pin, pin), ne(presentationSessionsTable.status, "ended")))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "لا توجد جلسة بهذا الرقم" });

    /* Public language hint so the join screen can render in the
       deck's language before the student authenticates. Non-sensitive
       (just "ar" | "en"). */
    const [deckRow] = await db
      .select({ language: presentationsTable.language })
      .from(presentationsTable)
      .where(eq(presentationsTable.id, sess.presentationId))
      .limit(1);
    const language: "ar" | "en" = deckRow?.language === "en" ? "en" : "ar";

    let classRoster: { id: number; name: string }[] | null = null;
    if (sess.mode === "class" && sess.targetClassId) {
      const [cls] = await db
        .select({ name: teacherClassesTable.name })
        .from(teacherClassesTable)
        .where(eq(teacherClassesTable.id, sess.targetClassId))
        .limit(1);
      if (cls) {
        const rows = await db
          .select({ id: studentsTable.id, name: studentsTable.name })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.teacherId, sess.teacherId),
            eq(studentsTable.studentClass, cls.name),
          ));
        /* Phase 7 — dedupe by case-insensitive trimmed name. A teacher
           who runs the bulk-import + adds the same student manually
           ends up with two roster rows for the same person; the join
           screen would then show the name twice. Keep the lowest id
           (the original) so the join token still binds to a stable
           classStudentId. */
        const seen = new Map<string, { id: number; name: string }>();
        for (const r of rows) {
          const key = (r.name ?? "").trim().toLowerCase();
          if (!key) continue;
          const existing = seen.get(key);
          if (!existing || r.id < existing.id) {
            seen.set(key, { id: r.id, name: r.name });
          }
        }
        classRoster = Array.from(seen.values())
          .sort((a, b) => a.name.localeCompare(b.name, "ar"));
      }
    }

    res.json({ sessionId: sess.id, mode: sess.mode, classRoster, language });
  } catch (err) {
    req.log?.error({ err }, "PIN info failed");
    res.status(500).json({ message: "فشل" });
  }
});

/* ─────────────────── Public: full session state ─────────────────── */

router.get("/p/sessions/:id/state", async (req: any, res) => {
  try {
    /* This endpoint is the student's REST polling fallback for the
       socket layer. It must never be cached by intermediaries — a
       stale slide here directly produces the "stuck on slide 1" bug. */
    res.setHeader("Cache-Control", "no-store");
    const sid = parseInt(req.params.id, 10);
    if (!Number.isFinite(sid)) return res.status(400).json({ message: "Bad id" });
    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.id, sid))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "Not found" });

    /* Authorization: owner session OR a valid join token. Without
       either, refuse to leak any session state — including the PIN. */
    const isOwnerCheck = !!(req.session?.teacherId && req.session.teacherId === sess.teacherId);
    const token = typeof req.query?.token === "string" ? req.query.token : "";
    const tokenOk = token ? !!verifyPresentationJoinToken(token, sid) : false;
    if (!isOwnerCheck && !tokenOk) return res.status(403).json({ message: "Forbidden" });

    const deck = await loadDeck(sess.presentationId);
    if (!deck) return res.status(404).json({ message: "Deck not found" });

    /* Hydrate the active element (if any) so the student/show client
       gets prompt+options without an extra round trip. */
    let activeElement: any = null;
    if (sess.activeElementId) {
      const slides = Array.isArray(deck.slides) ? (deck.slides as any[]) : [];
      const slide = slides[sess.currentSlideIndex];
      activeElement = await resolveActivityElement(slide, sess.activeElementId);
    }

    const isOwner = isOwnerCheck;

    let distribution: { counts: Record<string, number>; total: number } | null = null;
    if (sess.activeElementId) {
      const rows = await db
        .select({ idx: presentationResponsesTable.answerIndex })
        .from(presentationResponsesTable)
        .where(and(
          eq(presentationResponsesTable.sessionId, sid),
          eq(presentationResponsesTable.elementId, sess.activeElementId),
        ));
      const counts: Record<string, number> = {};
      for (const r of rows) {
        const k = r.idx == null ? "?" : String(r.idx);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      distribution = { counts, total: rows.length };
    }

    /* Only ever return the *current* slide to non-owners — never the
       full deck. Activity element is sanitized unless reveal is on or
       caller is owner. PIN is intentionally public (it's the join
       code) — show projectors and joiners both need it. */
    const slides = Array.isArray(deck.slides) ? (deck.slides as any[]) : [];
    const rawSlide = slides[sess.currentSlideIndex] ?? null;
    const currentSlide = isOwner ? rawSlide : sanitizeSlideForPublic(rawSlide);
    /* Always strip the answer from non-owner /state. The reveal
       state is still surfaced via `revealAnswer: true` so clients
       know to wait for the `results:reveal-answer` socket event for
       the actual `correctIndex`. */
    const safeActive = isOwner ? activeElement : sanitizeElementForStudents(activeElement);

    /* Phase 6 — surface the current inline-activity question (if any)
       so reload / first-paint students rehydrate to the right
       question without ever receiving the full `questions[]`. The
       in-memory snapshot is the source of truth for index/phase; we
       resolve the prompt/options for that index from the deck on the
       server. `correctIndex` is gated on owner OR phase=revealed. */
    let inlineActivityState:
      | {
          elementId: string;
          currentQuestionIndex: number;
          totalQuestions: number;
          phase: "asking" | "revealed";
          answeredCount: number;
          prompt: string;
          options: string[];
          correctIndex?: number;
        }
      | null = null;
    if (sess.activeElementId && activeElement && (activeElement as any).kind === "hasad-game") {
      const { getInlineActivitySnapshot } = await import("../game/presentation-handlers");
      const snap = getInlineActivitySnapshot(sid);
      if (snap && snap.elementId === sess.activeElementId) {
        const qs = Array.isArray((activeElement as any).questions)
          ? ((activeElement as any).questions as any[])
          : [];
        const q = qs[snap.currentQuestionIndex];
        inlineActivityState = {
          elementId: snap.elementId,
          currentQuestionIndex: snap.currentQuestionIndex,
          totalQuestions: snap.totalQuestions,
          phase: snap.phase,
          answeredCount: snap.answeredCount,
          prompt: typeof q?.prompt === "string" ? q.prompt : "",
          options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o)) : [],
        };
        if ((isOwner || snap.phase === "revealed") && typeof q?.correctIndex === "number") {
          inlineActivityState.correctIndex = q.correctIndex;
        }
      }
    }

    /* Distinct-student count from persisted answers. The live socket
       layer also emits `participants:count`, but exposing it here
       keeps the REST contract self-sufficient for first-paint clients. */
    const participantsRows = await db
      .selectDistinct({ key: presentationResponsesTable.studentKey })
      .from(presentationResponsesTable)
      .where(eq(presentationResponsesTable.sessionId, sid));
    const participantsCount = participantsRows.length;

    res.json({
      sessionId: sess.id,
      presentationId: sess.presentationId,
      status: sess.status,
      mode: sess.mode,
      currentSlideIndex: sess.currentSlideIndex,
      slideCount: slides.length,
      activeElementId: sess.activeElementId,
      activeElement: safeActive,
      revealDistribution: sess.revealDistribution,
      revealAnswer: sess.revealAnswer,
      /* PIN is owner-only in this response. Token-bearing callers
         already know the PIN (they used it to mint the token); show
         projector loads it via the owner-only `/api/presentations/
         sessions/:id` endpoint. Keeping it out of the token-gated
         response avoids re-leaking it from intermediaries. */
      pin: isOwner ? sess.pin : undefined,
      participantsCount,
      deck: {
        id: deck.id,
        title: deck.title,
        language: deck.language,
        theme: deck.theme,
        pattern: deck.pattern,
        currentSlide,
      },
      distribution: isOwner || sess.revealDistribution ? distribution : null,
      inlineActivity: inlineActivityState,
    });
  } catch (err) {
    req.log?.error({ err }, "Get session state failed");
    res.status(500).json({ message: "Failed" });
  }
});

/* ─────────────────── Owner-only: inline-quiz run history ───────────────────
   Lists every persisted inline hasad-game quiz run for this session,
   newest first, with per-student scores. Powers the "نتائج النشاط"
   history view on the teacher's control panel. */
router.get("/presentations/sessions/:id/inline-runs", requireTeacher, async (req: any, res) => {
  try {
    const teacherId = req.session.teacherId as number;
    const sid = parseInt(req.params.id, 10);
    if (!Number.isFinite(sid)) return res.status(400).json({ message: "Bad id" });

    const [sess] = await db
      .select()
      .from(presentationSessionsTable)
      .where(eq(presentationSessionsTable.id, sid))
      .limit(1);
    if (!sess) return res.status(404).json({ message: "Not found" });
    if (sess.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });

    const rows = await db
      .select()
      .from(presentationInlineQuizRunsTable)
      .where(eq(presentationInlineQuizRunsTable.sessionId, sid))
      .orderBy(desc(presentationInlineQuizRunsTable.finishedAt));

    /* Group rows into runs keyed by (elementId, finishedAt). */
    type RunStudent = { studentKey: string; name: string; correct: number; answered: number };
    type Run = {
      elementId: string;
      finishedAt: string;
      totalQuestions: number;
      students: RunStudent[];
    };
    const runMap = new Map<string, Run>();
    for (const r of rows) {
      const finishedIso = r.finishedAt.toISOString();
      const key = `${r.elementId}::${finishedIso}`;
      let run = runMap.get(key);
      if (!run) {
        run = {
          elementId: r.elementId,
          finishedAt: finishedIso,
          totalQuestions: r.totalQuestions,
          students: [],
        };
        runMap.set(key, run);
      }
      run.students.push({
        studentKey: r.studentKey,
        name: r.studentName,
        correct: r.correct,
        answered: r.answered,
      });
    }
    /* Sort each run's leaderboard. */
    for (const run of runMap.values()) {
      run.students.sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name, "ar"));
    }
    /* Resolve activity prompts from the deck so the UI can show a
       human-readable label instead of raw element ids. */
    const deck = await loadDeck(sess.presentationId);
    const elementLabels = new Map<string, string>();
    if (deck && Array.isArray(deck.slides)) {
      for (const slide of deck.slides as any[]) {
        if (!slide || !Array.isArray(slide.elements)) continue;
        for (const el of slide.elements) {
          if ((el?.kind === "hasad-game" || el?.kind === "activity") && typeof el.id === "string") {
            elementLabels.set(el.id, String(el.prompt ?? el.topic ?? "نشاط"));
          }
        }
      }
    }

    const runs = Array.from(runMap.values())
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
      .map((r) => ({
        ...r,
        label: elementLabels.get(r.elementId) ?? "نشاط",
      }));

    res.json({ runs });
  } catch (err) {
    req.log?.error({ err }, "List inline quiz runs failed");
    res.status(500).json({ message: "Failed" });
  }
});

export default router;
