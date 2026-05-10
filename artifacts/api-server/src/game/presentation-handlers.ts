import { Server, Socket } from "socket.io";
import { db, presentationSessionsTable, presentationResponsesTable, presentationInlineQuizRunsTable, presentationsTable, teacherClassesTable, studentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { hydrateActivityQuestions } from "../routes/presentations";
import { verifyPresentationJoinToken } from "../lib/presentation-join-token";

/**
 * Presentations 2B — Live MVP socket layer.
 *
 * Rooms:  `presentation:<sessionId>`
 *
 * Teacher events (REST owner-checked socket layer):
 *   slide:change                {index}
 *   activity:open               {elementId}
 *   activity:close              {}
 *   results:reveal-distribution {on}
 *   results:reveal-answer       {on}
 *   session:end                 {}
 *
 * Student/show events:
 *   student:join   {sessionId, studentKey, name}
 *   student:answer {elementId, answerIndex|answerText}
 *   show:join      {sessionId}
 *
 * Server broadcasts:
 *   state:sync           full snapshot to one socket
 *   slide:changed        {index}
 *   activity:opened      {elementId, element}
 *   activity:closed
 *   results:distribution {elementId, counts, total}
 *   results:answer       {elementId, correctIndex}
 *   participants:count   {n}
 *   session:ended
 */

interface LiveSession {
  id: number;
  teacherId: number;
  presentationId: number;
  /** socketId -> participant info (student or show display) */
  participants: Map<string, { name: string; studentKey: string; isShow: boolean; classStudentId: number | null }>;
  /** track teacher control sockets so emit-from-teacher can verify. */
  teacherSockets: Set<string>;
  /** Phase 6 — inline hasad-game quiz state (when the launched game
   *  carries `questions[]`, we run it inline on the student/teacher
   *  screens instead of opening the legacy game-setup tab). Cleared
   *  when the activity closes or the slide changes. In-memory only
   *  for MVP; on server restart the deck reload + state:sync will
   *  re-init at index 0. */
  inlineActivity?: {
    elementId: string;
    totalQuestions: number;
    currentQuestionIndex: number;
    phase: "asking" | "revealed";
    /** Map<questionIndex, Map<studentKey, answerIndex>> — used to
     *  show "X answered" on the teacher panel and to score the run
     *  when the activity ends. */
    answers: Map<number, Map<string, number>>;
    /** True once the final question has been completed and the
     *  end-of-quiz summary has been broadcast. The state is kept
     *  around for a short grace window before `activity:closed`
     *  fires so that late-joining or reconnecting sockets do not
     *  re-bootstrap the quiz at question 0 (which would let
     *  students answer again after the run was already finished).
     *  While `ended` is true: `student:answer` is rejected,
     *  `emitStateSync` skips the bootstrap branch, and
     *  `activity:next-question` / `activity:reveal-question` are
     *  no-ops. */
    ended?: boolean;
  };
}

const sessions = new Map<number, LiveSession>();

function room(id: number): string { return `presentation:${id}`; }

function studentCount(s: LiveSession): number {
  let n = 0;
  for (const p of s.participants.values()) if (!p.isShow) n += 1;
  return n;
}

async function loadSessionRow(id: number) {
  const [row] = await db
    .select()
    .from(presentationSessionsTable)
    .where(eq(presentationSessionsTable.id, id))
    .limit(1);
  return row ?? null;
}

async function loadDeckRow(id: number) {
  const [row] = await db
    .select()
    .from(presentationsTable)
    .where(eq(presentationsTable.id, id))
    .limit(1);
  return row ?? null;
}

/** Resolve one slide's active activity element via the shared
 *  hydration helper from `routes/presentations.ts`. */
/* Phase 3 — relative URLs for the platform's live games. The teacher's
   control panel opens the *setup* page in a new tab; every student
   device opens the generic /game/join page (the teacher reads the new
   PIN aloud). Both URLs are emitted on `game:launch` so each side can
   pick the right one for its audience. */
const HASAD_GAME_TEACHER_URL: Record<string, string> = {
  "kahoot":      "/game/teacher",
  "wheel":       "/game/wheel-create",
  "millionaire": "/game/million-setup",
  "flag-quiz":   "/game/flags-setup",
  "capitals":    "/game/capitals",
  "letrly":      "/game/letrly-setup",
  "rocket":      "/game/rocket-create",
  "tug":         "/game/tug-create",
  "maraqui":     "/game/maraqui-setup",
  "hack":        "/game/hack-setup",
};
const HASAD_GAME_STUDENT_URL = "/game/join";

type HasadQuestion = { prompt: string; options: string[]; correctIndex: number };
/* Phase 5 — split the launch payload by audience so we never broadcast
   correct answers to student/show sockets via socket.io. Teachers get
   the full question set (used to populate the in-Hasad Activity Runner
   via localStorage); everyone else gets only the join URL + label. */
function buildGameLaunchPayload(
  el: { id?: string; gameKind?: string; topic?: string; prompt?: string; questions?: HasadQuestion[] },
  forTeacher: boolean,
) {
  const gameKind = String(el.gameKind ?? "");
  const questions = Array.isArray(el.questions) ? el.questions : [];
  const hasQuestions = questions.length > 0;
  const elId = String(el.id ?? "");
  const teacherPath = hasQuestions && elId
    ? `/teacher/presentations/activity-runner/${encodeURIComponent(elId)}`
    : (HASAD_GAME_TEACHER_URL[gameKind] ?? HASAD_GAME_STUDENT_URL);
  const topicQs = !hasQuestions && el.topic ? `?topic=${encodeURIComponent(el.topic)}` : "";
  const base = {
    gameKind,
    teacherUrl: `${teacherPath}${topicQs}`,
    studentUrl: HASAD_GAME_STUDENT_URL,
    label: String(el.prompt ?? el.topic ?? ""),
  };
  if (!forTeacher) return base;
  return {
    ...base,
    /* Teacher-only: echoed so the launching client can stash the
       payload in localStorage before opening the runner tab
       (window.open with `noopener` does NOT inherit sessionStorage). */
    questions: hasQuestions ? questions : undefined,
    topic: el.topic ?? "",
    prompt: el.prompt ?? "",
  };
}

/** Phase 6 — payload shape for the inline `activity:state` event.
 *  `correctIndex` is included only on the teacher build of the
 *  payload (audience-split) and only after `phase=revealed`. */
type InlineActivityPayload = {
  elementId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  phase: "asking" | "revealed";
  /** Number of distinct students who answered the current question. */
  answeredCount: number;
  /** Per-option counts for the current question (parallel to the
   *  existing MCQ `results:distribution` shape). Keyed by option
   *  index as a string so it serializes cleanly. Sent to everyone —
   *  knowing how many peers picked each option doesn't leak the
   *  correct answer. */
  distribution: Record<string, number>;
  /** Current question text + options. These travel only via this
   *  per-question payload — students never receive the full
   *  `questions[]` array on the element, so future prompts stay
   *  hidden until the teacher advances. */
  prompt: string;
  options: string[];
  /** Teacher-only OR after reveal: the correct index for the current
   *  question, so both teacher control and (post-reveal) student
   *  screens can highlight it. */
  correctIndex?: number;
};

function buildInlineActivityPayload(
  state: NonNullable<LiveSession["inlineActivity"]>,
  el: any,
  forTeacherOrRevealed: boolean,
): InlineActivityPayload {
  const ansMap = state.answers.get(state.currentQuestionIndex);
  const q = Array.isArray(el?.questions) ? el.questions[state.currentQuestionIndex] : null;
  const distribution: Record<string, number> = {};
  if (ansMap) {
    for (const ans of ansMap.values()) {
      const k = String(ans);
      distribution[k] = (distribution[k] ?? 0) + 1;
    }
  }
  const out: InlineActivityPayload = {
    elementId: state.elementId,
    currentQuestionIndex: state.currentQuestionIndex,
    totalQuestions: state.totalQuestions,
    phase: state.phase,
    answeredCount: ansMap ? ansMap.size : 0,
    distribution,
    prompt: typeof q?.prompt === "string" ? q.prompt : "",
    options: Array.isArray(q?.options) ? q.options.map((o: any) => String(o)) : [],
  };
  if (forTeacherOrRevealed && q && typeof q.correctIndex === "number") {
    out.correctIndex = q.correctIndex;
  }
  return out;
}

/** Public read-only view of the in-memory inline-activity state for a
 *  given session. Used by the REST `/state` endpoint so reload /
 *  first-paint clients can rehydrate to the current question without
 *  exposing the full `questions[]` array. Returns `null` for non-
 *  inline (or no active) sessions. */
export function getInlineActivitySnapshot(sid: number): {
  elementId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  phase: "asking" | "revealed";
  answeredCount: number;
  prompt: string;
  options: string[];
} | null {
  const live = sessions.get(sid);
  if (!live?.inlineActivity) return null;
  const ia = live.inlineActivity;
  /* We don't have the element here — caller passes it in via the
     route. To keep this self-contained, just expose the answer-count
     + index/total + phase, and let the route resolve prompt/options
     from the deck. */
  const ansMap = ia.answers.get(ia.currentQuestionIndex);
  return {
    elementId: ia.elementId,
    currentQuestionIndex: ia.currentQuestionIndex,
    totalQuestions: ia.totalQuestions,
    phase: ia.phase,
    answeredCount: ansMap ? ansMap.size : 0,
    prompt: "",
    options: [],
  };
}

/** Broadcast the current inline-activity state to the room, splitting
 *  by audience: teachers always see `correctIndex`; students see it
 *  only after the teacher reveals the answer. */
async function broadcastInlineActivityState(io: Server, sid: number, el: any) {
  const live = sessions.get(sid);
  if (!live?.inlineActivity) return;
  const teacherIds = live.teacherSockets;
  for (const sockId of teacherIds) {
    io.to(sockId).emit(
      "activity:state",
      buildInlineActivityPayload(live.inlineActivity, el, true),
    );
  }
  io.to(room(sid))
    .except(Array.from(teacherIds))
    .emit(
      "activity:state",
      buildInlineActivityPayload(live.inlineActivity, el, live.inlineActivity.phase === "revealed"),
    );
}

async function resolveActiveElement(deckSlides: unknown, slideIndex: number, elementId: string | null) {
  if (!elementId) return null;
  const slides = Array.isArray(deckSlides) ? (deckSlides as any[]) : [];
  const slide = slides[slideIndex];
  if (!slide || !Array.isArray(slide.elements)) return null;
  const hydrated = await hydrateActivityQuestions([slide]) as any[];
  const hSlide = hydrated[0];
  if (!hSlide?.elements) return null;
  return hSlide.elements.find(
    (e: any) => e?.id === elementId && (e?.kind === "activity" || e?.kind === "hasad-game"),
  ) ?? null;
}

/** Send live answer counts. Always sent to the teacher (so they can
 *  decide when to reveal). Sent to the rest of the room only after
 *  the teacher has flipped `revealDistribution`. This keeps live
 *  per-option counts hidden from students before reveal — fairness +
 *  no peeking. */
async function broadcastDistribution(io: Server, sid: number, elementId: string) {
  const rows = await db
    .select({ idx: presentationResponsesTable.answerIndex })
    .from(presentationResponsesTable)
    .where(and(
      eq(presentationResponsesTable.sessionId, sid),
      eq(presentationResponsesTable.elementId, elementId),
    ));
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const k = r.idx == null ? "?" : String(r.idx);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const payload = { elementId, counts, total: rows.length };

  /* Always send full counts to teacher control sockets. */
  const live = sessions.get(sid);
  if (live) {
    for (const sockId of live.teacherSockets) io.to(sockId).emit("results:distribution", payload);
  }

  /* Look up reveal flag — broadcast to others only after reveal. */
  const [sess] = await db
    .select({ rev: presentationSessionsTable.revealDistribution })
    .from(presentationSessionsTable)
    .where(eq(presentationSessionsTable.id, sid))
    .limit(1);
  if (sess?.rev && live) {
    io.to(room(sid))
      .except(Array.from(live.teacherSockets))
      .emit("results:distribution", payload);
  } else if (sess?.rev && !live) {
    io.to(room(sid)).emit("results:distribution", payload);
  } else {
    /* Always send a totals-only "answers received" ping so students/
       show clients can show "X answered" without per-option counts. */
    if (live) {
      io.to(room(sid))
        .except(Array.from(live.teacherSockets))
        .emit("results:total", { elementId, total: rows.length });
    } else {
      io.to(room(sid)).emit("results:total", { elementId, total: rows.length });
    }
  }
}

/** Strip `correctIndex` so students/show clients never see the answer
 *  outside an explicit `results:reveal-answer` event. Also strips the
 *  nested `questions[*].correctIndex` on `hasad-game` launchers so the
 *  AI-generated answer key is never broadcast in `activity:opened` or
 *  `state:sync` payloads — the legacy top-level strip alone left those
 *  nested values exposed. */
function sanitizeElementForStudents(el: any): any {
  if (!el || typeof el !== "object") return el;
  const { correctIndex: _omit, questions, ...rest } = el as any;
  /* Phase 6 — never ship the full `questions[]` to non-teacher
     clients. That array would expose every future prompt/options
     ahead of time. We only surface a count so the student UI can
     render "X سؤال" badges; the per-question content arrives via
     the dedicated `activity:state` socket event one question at a
     time, controlled by the teacher. */
  if (Array.isArray(questions)) {
    (rest as any).questionsCount = questions.length;
  }
  return rest;
}

function sanitizeSlide(slide: any): any {
  if (!slide || !Array.isArray(slide.elements)) return slide;
  /* Phase 6 — both `activity` AND `hasad-game` elements may carry
     `correctIndex` (the latter inside `questions[*]`). Strip both for
     non-teacher payloads so answer keys never leak via the slide
     blob in `slide:changed` / `state:sync`. */
  return {
    ...slide,
    elements: slide.elements.map((e: any) =>
      e?.kind === "activity" || e?.kind === "hasad-game"
        ? sanitizeElementForStudents(e)
        : e,
    ),
  };
}

async function emitStateSync(_io: Server, socket: Socket, sid: number, isTeacher: boolean) {
  const sess = await loadSessionRow(sid);
  if (!sess) return;
  const deck = await loadDeckRow(sess.presentationId);
  const slides = Array.isArray(deck?.slides) ? (deck!.slides as any[]) : [];
  const rawSlide = slides[sess.currentSlideIndex] ?? null;
  const active = await resolveActiveElement(deck?.slides, sess.currentSlideIndex, sess.activeElementId);
  /* Show clients need the rendered slide for the projector. Students
     don't render slides at all in their UI (they only see activity
     cards), but we send the sanitized slide anyway for parity. */
  const slide = isTeacher ? rawSlide : sanitizeSlide(rawSlide);
  /* Always strip `correctIndex` from non-teacher state:sync. The
     answer is delivered exclusively via the dedicated
     `results:reveal-answer` event (re-emitted below for late joiners
     when reveal is currently on), so we never expose it in any other
     payload. */
  const safeActive = isTeacher ? active : sanitizeElementForStudents(active);
  socket.emit("state:sync", {
    sessionId: sess.id,
    status: sess.status,
    currentSlideIndex: sess.currentSlideIndex,
    slideCount: slides.length,
    slide,
    activeElementId: sess.activeElementId,
    activeElement: safeActive,
    revealDistribution: sess.revealDistribution,
    revealAnswer: sess.revealAnswer,
    pin: sess.pin,
  });
  /* Late-joiner support: if the teacher already revealed the answer,
     send the dedicated reveal event to this one socket so the UI can
     display correctness. Sent to teacher too for parity. */
  if (sess.revealAnswer && active && typeof active.correctIndex === "number") {
    socket.emit("results:reveal-answer", {
      on: true,
      elementId: sess.activeElementId,
      correctIndex: active.correctIndex,
    });
  }
  /* Late-joiner support for active Hasad-game launchers. */
  if (active && (active as any).kind === "hasad-game" && sess.activeElementId) {
    const hasInlineQuestions =
      Array.isArray((active as any).questions) && (active as any).questions.length > 0;
    const live = sessions.get(sid);
    if (hasInlineQuestions && live?.inlineActivity?.elementId === sess.activeElementId) {
      /* Phase 6 — inline quiz: re-emit the current question state so
         this single socket can resume mid-quiz without a full reset.
         No new-tab `game:launch` for this branch. If the run has
         already ended we deliberately do nothing here — the
         `activity:closed` broadcast on the room will land within the
         grace window, and we must not resurrect the quiz UI on a
         reconnecting client mid-tear-down. */
      if (live.inlineActivity.ended) {
        // intentional no-op
      } else {
        const showCorrect =
          isTeacher || live.inlineActivity.phase === "revealed";
        socket.emit(
          "activity:state",
          buildInlineActivityPayload(live.inlineActivity, active, showCorrect),
        );
      }
    } else if (hasInlineQuestions) {
      /* Inline-capable game but the in-memory inline state is gone
         (e.g., process restart, or all sockets had disconnected and
         the live entry was reaped). Bootstrap a fresh inline run at
         question 0 so this late joiner stays in the inline flow
         instead of regressing to the legacy new-tab launcher. */
      const live2 = sessions.get(sid);
      if (live2) {
        live2.inlineActivity = {
          elementId: sess.activeElementId,
          totalQuestions: (active as any).questions.length,
          currentQuestionIndex: 0,
          phase: "asking",
          answers: new Map(),
        };
        socket.emit(
          "activity:state",
          buildInlineActivityPayload(live2.inlineActivity, active, isTeacher),
        );
      }
    } else {
      /* Legacy launcher (no questions[]) — fall back to the old
         new-tab flow so existing decks keep working. */
      socket.emit("game:launch", {
        elementId: sess.activeElementId,
        ...buildGameLaunchPayload(active as any, isTeacher),
      });
    }
  }
}

/** Build the per-audience payload for slide:changed and
 *  activity:opened. Teachers in the room receive the unsanitized
 *  version (they already have correctIndex via the REST `/sessions/:id`
 *  endpoint, but parity is convenient); everyone else gets sanitized. */
async function emitToRoomSplit(
  io: Server,
  sid: number,
  event: string,
  build: (forTeacher: boolean) => any,
) {
  const live = sessions.get(sid);
  const teacherIds = live?.teacherSockets ?? new Set<string>();
  /* Teachers: targeted emit. */
  for (const sockId of teacherIds) {
    io.to(sockId).emit(event, build(true));
  }
  /* Everyone else in the room except teacher sockets. */
  io.to(room(sid)).except(Array.from(teacherIds)).emit(event, build(false));
}

function isTeacherForSession(socket: Socket, teacherId: number): boolean {
  const sess = (socket.request as any).session;
  return !!sess && sess.teacherId === teacherId;
}

export function setupPresentationSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    /* Teacher control join — owner-only. */
    socket.on("teacher:join-presentation", async ({ sessionId }: { sessionId: number }) => {
      try {
        const sess = await loadSessionRow(Number(sessionId));
        if (!sess) return socket.emit("error", { message: "Session not found" });
        if (!isTeacherForSession(socket, sess.teacherId)) {
          return socket.emit("error", { message: "Unauthorized" });
        }
        await socket.join(room(sess.id));
        let live = sessions.get(sess.id);
        if (!live) {
          live = { id: sess.id, teacherId: sess.teacherId, presentationId: sess.presentationId, participants: new Map(), teacherSockets: new Set() };
          sessions.set(sess.id, live);
        }
        live.teacherSockets.add(socket.id);
        await emitStateSync(io, socket, sess.id, true);
        io.to(room(sess.id)).emit("participants:count", { n: studentCount(live) });
        if (sess.activeElementId) {
          await broadcastDistribution(io, sess.id, sess.activeElementId);
        }
      } catch (err) {
        logger.error({ err }, "teacher:join-presentation failed");
      }
    });

    socket.on("show:join", async ({ sessionId }: { sessionId: number }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess) return socket.emit("error", { message: "Session not found" });
        /* Show projector is owner-only — only the teacher who created
           the session can open `/p/show/:id`. This blocks unauthorized
           projector observation by guessing a numeric sessionId. */
        if (!isTeacherForSession(socket, sess.teacherId)) {
          return socket.emit("error", { message: "Unauthorized" });
        }
        await socket.join(room(sid));
        let live = sessions.get(sid);
        if (!live) {
          live = { id: sid, teacherId: sess.teacherId, presentationId: sess.presentationId, participants: new Map(), teacherSockets: new Set() };
          sessions.set(sid, live);
        }
        live.participants.set(socket.id, { name: "(عرض)", studentKey: `show-${socket.id}`, isShow: true, classStudentId: null });
        await emitStateSync(io, socket, sid, false);
        io.to(room(sid)).emit("participants:count", { n: studentCount(live) });
      } catch (err) {
        logger.error({ err }, "show:join failed");
      }
    });

    socket.on("student:join", async ({ sessionId, studentKey, name, joinToken }: { sessionId: number; studentKey: string; name: string; joinToken?: string }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess) {
          logger.warn({ sid, socketId: socket.id }, "student:join rejected — session not found");
          return socket.emit("error", { message: "Session not found" });
        }
        if (sess.status === "ended") return socket.emit("session:ended");
        const cleanName = String(name ?? "").trim().slice(0, 40);
        const cleanKey = String(studentKey ?? "").trim().slice(0, 40);
        if (!cleanName || !cleanKey) {
          logger.warn({ sid, socketId: socket.id, hasName: !!cleanName, hasKey: !!cleanKey }, "student:join rejected — missing name/key");
          return socket.emit("error", { message: "Missing name/key" });
        }
        /* Require a valid join token bound to (sid, studentKey). The
           token is minted only by the rate-limited PIN endpoint, so
           students cannot join by guessing a numeric sessionId. The
           token may also carry the class roster id the student picked,
           which we use to persist a stable class_student_id with each
           answer instead of relying on name matching. */
        const tokenPayload = joinToken ? verifyPresentationJoinToken(String(joinToken), sid, cleanKey) : null;
        if (!tokenPayload) {
          logger.warn({ sid, socketId: socket.id, hasToken: !!joinToken }, "student:join rejected — invalid join token");
          return socket.emit("error", { message: "Invalid join token" });
        }
        let classStudentId: number | null = null;
        /* Re-validate class membership server-side. The REST /by-pin
           endpoint already enforces this, but a client could try to
           skip REST and call student:join directly with arbitrary
           {sessionId, studentKey, name}. Without this check, class-
           mode admission would be bypassable. */
        if (sess.mode === "class" && sess.targetClassId) {
          const [cls] = await db
            .select({ name: teacherClassesTable.name })
            .from(teacherClassesTable)
            .where(eq(teacherClassesTable.id, sess.targetClassId))
            .limit(1);
          if (!cls) return socket.emit("error", { message: "Class not found" });
          /* Prefer roster id from the token (set when the student
             picked themselves off the roster). Verify it still points
             to a roster row in the bound class. */
          if (tokenPayload.c != null && Number.isFinite(tokenPayload.c)) {
            const [stu] = await db
              .select({ id: studentsTable.id })
              .from(studentsTable)
              .where(and(
                eq(studentsTable.id, tokenPayload.c),
                eq(studentsTable.teacherId, sess.teacherId),
                eq(studentsTable.studentClass, cls.name),
              ))
              .limit(1);
            if (!stu) return socket.emit("error", { message: "Not on class roster" });
            classStudentId = stu.id;
          } else {
            const roster = await db
              .select({ id: studentsTable.id, name: studentsTable.name })
              .from(studentsTable)
              .where(and(
                eq(studentsTable.teacherId, sess.teacherId),
                eq(studentsTable.studentClass, cls.name),
              ));
            const matches = roster.filter((r) => (r.name ?? "").trim().toLowerCase() === cleanName.toLowerCase());
            if (matches.length === 0) return socket.emit("error", { message: "Not on class roster" });
            if (matches.length === 1) classStudentId = matches[0].id;
          }
        }
        await socket.join(room(sid));
        let live = sessions.get(sid);
        if (!live) {
          live = { id: sid, teacherId: sess.teacherId, presentationId: sess.presentationId, participants: new Map(), teacherSockets: new Set() };
          sessions.set(sid, live);
        }
        live.participants.set(socket.id, { name: cleanName, studentKey: cleanKey, isShow: false, classStudentId });
        await emitStateSync(io, socket, sid, false);
        io.to(room(sid)).emit("participants:count", { n: studentCount(live) });
        logger.info({ sid, socketId: socket.id, name: cleanName, participants: studentCount(live) }, "student:join ok");
      } catch (err) {
        logger.error({ err }, "student:join failed");
      }
    });

    /* Teacher controls — every event verifies ownership against the
       session row's teacher_id, then persists to DB and broadcasts. */
    socket.on("slide:change", async ({ sessionId, index }: { sessionId: number; index: number }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess || !isTeacherForSession(socket, sess.teacherId)) return;
        const idx = Math.max(0, Number(index) | 0);
        await db.update(presentationSessionsTable)
          .set({ currentSlideIndex: idx, activeElementId: null, revealDistribution: false, revealAnswer: false, status: sess.status === "lobby" ? "running" : sess.status })
          .where(eq(presentationSessionsTable.id, sid));
        const liveSess = sessions.get(sid);
        if (liveSess) liveSess.inlineActivity = undefined;
        const deck = await loadDeckRow(sess.presentationId);
        const slides = Array.isArray(deck?.slides) ? (deck!.slides as any[]) : [];
        const rawSlide = slides[idx] ?? null;
        await emitToRoomSplit(io, sid, "slide:changed", (forTeacher) => ({
          index: idx,
          slide: forTeacher ? rawSlide : sanitizeSlide(rawSlide),
        }));
        io.to(room(sid)).emit("activity:closed");
      } catch (err) { logger.error({ err }, "slide:change failed"); }
    });

    socket.on("activity:open", async ({ sessionId, elementId }: { sessionId: number; elementId: string }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess || !isTeacherForSession(socket, sess.teacherId)) return;
        await db.update(presentationSessionsTable)
          .set({ activeElementId: String(elementId), revealDistribution: false, revealAnswer: false })
          .where(eq(presentationSessionsTable.id, sid));
        const deck = await loadDeckRow(sess.presentationId);
        const element = await resolveActiveElement(deck?.slides, sess.currentSlideIndex, String(elementId));
        const live = sessions.get(sid);
        /* Phase 6 — clear any prior inline-activity state before we
           decide which path to take for the newly opened element. */
        if (live) live.inlineActivity = undefined;
        const isHasadGame = element && (element as any).kind === "hasad-game";
        const inlineQuestions =
          isHasadGame && Array.isArray((element as any).questions) ? (element as any).questions : [];
        const useInline = inlineQuestions.length > 0;

        await emitToRoomSplit(io, sid, "activity:opened", (forTeacher) => ({
          elementId: String(elementId),
          element: forTeacher ? element : sanitizeElementForStudents(element),
        }));

        if (useInline && live) {
          /* Phase 6 — inline quiz: initialize per-question state and
             broadcast `activity:state`. NO `game:launch` (no new-tab
             flow). Students answer right on their phone; teacher
             advances with `activity:next-question` / reveals with
             `activity:reveal-question`. */
          live.inlineActivity = {
            elementId: String(elementId),
            totalQuestions: inlineQuestions.length,
            currentQuestionIndex: 0,
            phase: "asking",
            answers: new Map(),
          };
          await broadcastInlineActivityState(io, sid, element);
        } else if (isHasadGame) {
          /* Legacy hasad-game launcher (no questions[]) — keep the old
             new-tab flow so existing decks keep working. */
          await emitToRoomSplit(io, sid, "game:launch", (forTeacher) => ({
            elementId: String(elementId),
            ...buildGameLaunchPayload(element as any, forTeacher),
          }));
        } else {
          await broadcastDistribution(io, sid, String(elementId));
        }
      } catch (err) { logger.error({ err }, "activity:open failed"); }
    });

    socket.on("activity:close", async ({ sessionId }: { sessionId: number }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess || !isTeacherForSession(socket, sess.teacherId)) return;
        await db.update(presentationSessionsTable)
          .set({ activeElementId: null, revealDistribution: false, revealAnswer: false })
          .where(eq(presentationSessionsTable.id, sid));
        const live = sessions.get(sid);
        if (live) live.inlineActivity = undefined;
        io.to(room(sid)).emit("activity:closed");
      } catch (err) { logger.error({ err }, "activity:close failed"); }
    });

    /* Phase 6 — teacher advances the inline quiz to the next question.
       Resets the per-question reveal state and broadcasts the new
       state to everyone. If there are no more questions, broadcasts
       a final summary and clears inline activity (the teacher can
       still close the activity to end fully, or move to the next
       slide). */
    socket.on("activity:next-question", async ({ sessionId }: { sessionId: number }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess || !isTeacherForSession(socket, sess.teacherId)) return;
        const live = sessions.get(sid);
        if (!live?.inlineActivity) return;
        /* Already ended — ignore stray clicks during the 4s
           tear-down window so we don't re-emit a fresh question. */
        if (live.inlineActivity.ended) return;
        const next = live.inlineActivity.currentQuestionIndex + 1;
        const deck = await loadDeckRow(sess.presentationId);
        const element = await resolveActiveElement(deck?.slides, sess.currentSlideIndex, live.inlineActivity.elementId);
        if (next >= live.inlineActivity.totalQuestions) {
          /* End of quiz — compute scores per student from the
             in-memory answer maps and broadcast a summary. Teacher
             gets per-student rows; students just see their own row. */
          const elQuestions: any[] = Array.isArray((element as any)?.questions) ? (element as any).questions : [];
          const perStudent = new Map<string, { name: string; correct: number; total: number }>();
          for (const [qIdx, ansMap] of live.inlineActivity.answers.entries()) {
            const correct = elQuestions[qIdx]?.correctIndex;
            for (const [key, ans] of ansMap.entries()) {
              const part = Array.from(live.participants.values()).find((p) => p.studentKey === key);
              const name = part?.name ?? key;
              const cur = perStudent.get(key) ?? { name, correct: 0, total: 0 };
              cur.total += 1;
              if (typeof correct === "number" && ans === correct) cur.correct += 1;
              perStudent.set(key, cur);
            }
          }
          const rows = Array.from(perStudent.entries())
            .map(([key, v]) => ({ studentKey: key, name: v.name, correct: v.correct, total: v.total }))
            .sort((a, b) => b.correct - a.correct);
          /* Persist the run so teachers can revisit results later
             (after restart/end of session). One row per student. The
             finishedAt timestamp groups the rows into a single run. */
          if (rows.length > 0) {
            try {
              const finishedAt = new Date();
              const totalQs = live.inlineActivity.totalQuestions;
              const insertRows = rows.map((r) => {
                const part = Array.from(live.participants.values()).find((p) => p.studentKey === r.studentKey);
                return {
                  sessionId: sid,
                  elementId: live.inlineActivity!.elementId,
                  totalQuestions: totalQs,
                  studentKey: r.studentKey,
                  studentName: r.name,
                  classStudentId: part?.classStudentId ?? null,
                  correct: r.correct,
                  answered: r.total,
                  finishedAt,
                };
              });
              await db.insert(presentationInlineQuizRunsTable).values(insertRows);
            } catch (err) {
              logger.error({ err, sid, elementId: live.inlineActivity.elementId }, "persist inline quiz run failed");
            }
          }
          /* Teacher: full leaderboard. */
          for (const sockId of live.teacherSockets) {
            io.to(sockId).emit("activity:summary", { elementId: live.inlineActivity.elementId, totalQuestions: live.inlineActivity.totalQuestions, rows });
          }
          /* Each student: only their own row (no leaking class scores). */
          for (const [sockId, part] of live.participants.entries()) {
            if (part.isShow) continue;
            const my = rows.find((r) => r.studentKey === part.studentKey);
            io.to(sockId).emit("activity:summary", {
              elementId: live.inlineActivity.elementId,
              totalQuestions: live.inlineActivity.totalQuestions,
              rows: my ? [my] : [],
            });
          }
          /* Phase 6 — end-of-quiz auto-close: students see the brief
             "انتهى النشاط ✓" summary card, then we automatically
             clear the active element and return everyone to slide-
             watching mode after a short pause. The teacher can also
             close earlier via `activity:close`. */
          const closingElementId = live.inlineActivity.elementId;
          /* Mark the run as ended but KEEP the inlineActivity record
             around for the 4s grace window so that:
               - reconnecting sockets in `emitStateSync` won't bootstrap
                 a fresh question 0 and resurrect a finished quiz, and
               - `student:answer` / `activity:next-question` /
                 `activity:reveal-question` reject cleanly during
                 tear-down rather than racing on undefined state. */
          live.inlineActivity.ended = true;
          setTimeout(async () => {
            try {
              const cur = await loadSessionRow(sid);
              const liveNow = sessions.get(sid);
              if (liveNow?.inlineActivity?.elementId === closingElementId) {
                liveNow.inlineActivity = undefined;
              }
              if (!cur || cur.activeElementId !== closingElementId) return;
              await db.update(presentationSessionsTable)
                .set({ activeElementId: null, revealDistribution: false, revealAnswer: false })
                .where(eq(presentationSessionsTable.id, sid));
              io.to(room(sid)).emit("activity:closed");
            } catch (err) { logger.error({ err }, "auto-close after summary failed"); }
          }, 4000);
          return;
        }
        live.inlineActivity.currentQuestionIndex = next;
        live.inlineActivity.phase = "asking";
        await broadcastInlineActivityState(io, sid, element);
      } catch (err) { logger.error({ err }, "activity:next-question failed"); }
    });

    /* Phase 6 — teacher reveals the correct answer for the current
       inline question. Flips phase=revealed and re-broadcasts state
       so student devices light up the correct option. */
    socket.on("activity:reveal-question", async ({ sessionId }: { sessionId: number }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess || !isTeacherForSession(socket, sess.teacherId)) return;
        const live = sessions.get(sid);
        if (!live?.inlineActivity) return;
        /* Same tear-down guard as next-question. */
        if (live.inlineActivity.ended) return;
        live.inlineActivity.phase = "revealed";
        const deck = await loadDeckRow(sess.presentationId);
        const element = await resolveActiveElement(deck?.slides, sess.currentSlideIndex, live.inlineActivity.elementId);
        await broadcastInlineActivityState(io, sid, element);
      } catch (err) { logger.error({ err }, "activity:reveal-question failed"); }
    });

    socket.on("results:reveal-distribution", async ({ sessionId, on }: { sessionId: number; on: boolean }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess || !isTeacherForSession(socket, sess.teacherId)) return;
        await db.update(presentationSessionsTable)
          .set({ revealDistribution: !!on })
          .where(eq(presentationSessionsTable.id, sid));
        io.to(room(sid)).emit("results:reveal-distribution", { on: !!on });
        if (on && sess.activeElementId) await broadcastDistribution(io, sid, sess.activeElementId);
      } catch (err) { logger.error({ err }, "reveal-distribution failed"); }
    });

    socket.on("results:reveal-answer", async ({ sessionId, on }: { sessionId: number; on: boolean }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess || !isTeacherForSession(socket, sess.teacherId)) return;
        await db.update(presentationSessionsTable)
          .set({ revealAnswer: !!on })
          .where(eq(presentationSessionsTable.id, sid));
        let correctIndex: number | null = null;
        if (sess.activeElementId) {
          const deck = await loadDeckRow(sess.presentationId);
          const el = await resolveActiveElement(deck?.slides, sess.currentSlideIndex, sess.activeElementId);
          if (el && typeof el.correctIndex === "number") correctIndex = el.correctIndex;
        }
        io.to(room(sid)).emit("results:reveal-answer", { on: !!on, elementId: sess.activeElementId, correctIndex });
      } catch (err) { logger.error({ err }, "reveal-answer failed"); }
    });

    socket.on("session:end", async ({ sessionId }: { sessionId: number }) => {
      try {
        const sid = Number(sessionId);
        const sess = await loadSessionRow(sid);
        if (!sess || !isTeacherForSession(socket, sess.teacherId)) return;
        await db.update(presentationSessionsTable)
          .set({ status: "ended", endedAt: new Date(), activeElementId: null })
          .where(eq(presentationSessionsTable.id, sid));
        io.to(room(sid)).emit("session:ended");
      } catch (err) { logger.error({ err }, "session:end failed"); }
    });

    /* Student answer — server validates correctness against the
       hydrated element and inserts. The DB unique constraint blocks
       duplicate answers per (session, element, student_key). For
       Phase 6 inline hasad-game quizzes the client also sends a
       `questionIndex` and we record the answer in memory under that
       index so the same student can answer multiple questions in
       one element. */
    socket.on("student:answer", async ({ sessionId, elementId, answerIndex, answerText, questionIndex }: { sessionId: number; elementId: string; answerIndex?: number; answerText?: string; questionIndex?: number }) => {
      try {
        const sid = Number(sessionId);
        const live = sessions.get(sid);
        const me = live?.participants.get(socket.id);
        if (!live || !me || me.isShow) return socket.emit("answer:rejected", { reason: "not-joined" });

        const sess = await loadSessionRow(sid);
        if (!sess || sess.status === "ended") return socket.emit("answer:rejected", { reason: "ended" });
        if (sess.activeElementId !== String(elementId)) return socket.emit("answer:rejected", { reason: "not-active" });

        const deck = await loadDeckRow(sess.presentationId);
        const el = await resolveActiveElement(deck?.slides, sess.currentSlideIndex, sess.activeElementId);

        /* Phase 6 — inline hasad-game quiz path. Record the answer
           in memory under `questionIndex`; do not write to the
           presentation_responses table (those rows are scoped to a
           single element id and would collide across questions). */
        if (live.inlineActivity && live.inlineActivity.elementId === String(elementId)) {
          /* Tear-down grace window — the run has ended but the
             activity:closed broadcast hasn't fired yet. Reject so
             a slow student tap can't slip in after the summary. */
          if (live.inlineActivity.ended) {
            return socket.emit("answer:rejected", { reason: "ended" });
          }
          const qIdx = Number(questionIndex);
          if (!Number.isFinite(qIdx) || qIdx !== live.inlineActivity.currentQuestionIndex) {
            return socket.emit("answer:rejected", { reason: "stale-question" });
          }
          if (typeof answerIndex !== "number") {
            return socket.emit("answer:rejected", { reason: "missing-answer" });
          }
          let qMap = live.inlineActivity.answers.get(qIdx);
          if (!qMap) {
            qMap = new Map();
            live.inlineActivity.answers.set(qIdx, qMap);
          }
          if (qMap.has(me.studentKey)) {
            return socket.emit("answer:already");
          }
          qMap.set(me.studentKey, answerIndex);
          socket.emit("answer:accepted");
          await broadcastInlineActivityState(io, sid, el);
          return;
        }

        let isCorrect: boolean | null = null;
        if (el && typeof el.correctIndex === "number" && typeof answerIndex === "number") {
          isCorrect = answerIndex === el.correctIndex;
        }

        try {
          await db.insert(presentationResponsesTable).values({
            sessionId: sid,
            slideIndex: sess.currentSlideIndex,
            elementId: String(elementId),
            studentKey: me.studentKey,
            studentName: me.name,
            classStudentId: me.classStudentId,
            answerIndex: typeof answerIndex === "number" ? answerIndex : null,
            answerText: typeof answerText === "string" ? answerText.slice(0, 500) : null,
            isCorrect,
          });
        } catch {
          /* duplicate — already answered. Treat as success silently. */
          return socket.emit("answer:already");
        }

        socket.emit("answer:accepted");
        await broadcastDistribution(io, sid, String(elementId));
      } catch (err) {
        logger.error({ err }, "student:answer failed");
      }
    });

    socket.on("disconnect", () => {
      for (const [sid, live] of sessions.entries()) {
        if (live.teacherSockets.delete(socket.id)) { /* nothing else needed */ }
        if (live.participants.delete(socket.id)) {
          io.to(room(sid)).emit("participants:count", { n: studentCount(live) });
        }
        if (live.participants.size === 0 && live.teacherSockets.size === 0) {
          sessions.delete(sid);
        }
      }
    });
  });
}
