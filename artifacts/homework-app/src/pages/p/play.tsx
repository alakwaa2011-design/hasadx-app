import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { getSocket } from "@/lib/socket";
import { SlideStage } from "@/lib/slide-render";
import { Loader2, CheckCircle2, LogOut, Play, ChevronLeft, ChevronRight } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

const KEY = "hasad:presKey";

interface Stored { sessionId: number; studentKey: string; name: string; joinToken: string }
function loadStored(): Stored | null {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

/* Student playing view. Shows a calm holding card by default, swaps
   to the activity card when the teacher opens one, locks the chosen
   answer, and reveals correctness when the teacher kicks reveal on. */
export default function PresentationPlay() {
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sid = Number(params.sessionId);

  const [stored, setStored] = useState<Stored | null>(null);
  const [live, setLive] = useState<any>(null);
  const [deckMeta, setDeckMeta] = useState<{ language: "ar" | "en"; theme: string; pattern: string } | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [dist, setDist] = useState<{ counts: Record<string, number>; total: number } | null>(null);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  /* Phase 3 — when the teacher launches a Hasad live game, every
     student device receives a one-tap "open game" card with the URL
     to the join page. Cleared automatically when the activity is
     closed or the slide changes. */
  const [gameLaunch, setGameLaunch] = useState<
    { gameKind: string; studentUrl: string; label: string } | null
  >(null);
  /* Phase 6 — inline hasad-game live quiz state. When the teacher
     launches a question-bearing hasad-game, the server runs it
     inline (no new-tab) and broadcasts `activity:state` events that
     advance the current question, flip reveal phase, and report the
     live answer count. */
  const [inlineActivity, setInlineActivity] = useState<{
    elementId: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    phase: "asking" | "revealed";
    answeredCount: number;
    distribution?: Record<string, number>;
    prompt: string;
    options: string[];
    correctIndex?: number;
  } | null>(null);
  const [mySummary, setMySummary] = useState<{ correct: number; total: number } | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textSubmitted, setTextSubmitted] = useState(false);
  /* Self-Paced Mode state */
  const [sessionMode, setSessionMode] = useState<"teacher" | "self_paced">("teacher");
  const [selfPacedIdx, setSelfPacedIdx] = useState<number | null>(null);
  const [selfPacedCount, setSelfPacedCount] = useState(0);
  const [selfPacedSlide, setSelfPacedSlide] = useState<any>(null);
  /** Activity element on the student's current self-paced slide (sanitized, no correctIndex). */
  const [selfPacedActiveEl, setSelfPacedActiveEl] = useState<any>(null);
  const [activitiesCompleted, setActivitiesCompleted] = useState(0);
  const [selfPacedDone, setSelfPacedDone] = useState(false);
  /* Tracks whether we've already initialized self-paced navigation so we
     don't re-trigger a slide request on every state:sync event. */
  const selfPacedInitRef = useRef(false);

  useEffect(() => {
    const s = loadStored();
    if (!s || s.sessionId !== sid) {
      setLocation("/p/join");
      return;
    }
    setStored(s);
    /* One-shot fetch to learn the deck's theme/language/pattern so
       the slide renders with the right styling. The slide *content*
       arrives via socket (state:sync + slide:changed). The endpoint
       requires the join token we received from `/by-pin`. */
    fetch(`${API_BASE}/api/p/sessions/${sid}/state?token=${encodeURIComponent(s.joinToken)}`, { credentials: "include" })
      .then((r) => {
        /* If the server can't find this session anymore (404) or our
           saved join token is no longer valid for it (403), the saved
           entry is stale — clear it and bounce back to /p/join so the
           student can scan a fresh QR cleanly. */
        if (r.status === 404 || r.status === 403) {
          try { localStorage.removeItem(KEY); } catch { /* ignore */ }
          setLocation("/p/join");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((j) => {
        if (!j) return;
        /* Same auto-clear when the teacher already ended the session. */
        if (j.status === "ended") {
          try { localStorage.removeItem(KEY); } catch { /* ignore */ }
          setLocation("/p/join");
          return;
        }
        if (j.deck) setDeckMeta({ language: j.deck.language, theme: j.deck.theme, pattern: j.deck.pattern });
        /* First-paint: hydrate `live` from REST so the student sees the
           teacher's current slide (and any open activity) immediately
           without waiting for the socket `state:sync` round-trip. The
           socket will keep things in sync from here on. */
        setLive((prev: any) => ({
          ...(prev ?? {}),
          status: j.status,
          currentSlideIndex: j.currentSlideIndex,
          slide: j.deck?.currentSlide ?? prev?.slide ?? null,
          activeElementId: j.activeElementId ?? null,
          activeElement: j.activeElement ?? null,
          revealDistribution: !!j.revealDistribution,
          revealAnswer: !!j.revealAnswer,
        }));
        /* Phase 6 — REST hydration of inline-quiz state for first
           paint and reload-mid-question. Falls back to socket
           `activity:state` for live updates from there. */
        if (j.inlineActivity) {
          setInlineActivity((prev) => {
            if (prev && prev.currentQuestionIndex !== j.inlineActivity.currentQuestionIndex) {
              setChosen(null); setSubmitted(false);
            }
            return j.inlineActivity;
          });
        }
      })
      .catch(() => {});
  }, [sid, setLocation]);

  useEffect(() => {
    if (!stored) return;
    const s = getSocket();
    const join = () => s.emit("student:join", { sessionId: sid, studentKey: stored.studentKey, name: stored.name, joinToken: stored.joinToken });
    join();
    const onSync = (st: any) => {
      /* MERGE rather than replace. If the server payload happens to
         omit `slide` (e.g. transient null from a deck reload) we don't
         want to wipe the slide we already hydrated from REST — that's
         exactly the failure mode that produced the "Waiting for the
         teacher" screen in production. */
      setLive((prev: any) => {
        const next = {
          ...(prev ?? {}),
          ...st,
          slide: st?.slide ?? prev?.slide ?? null,
          activeElement: st?.activeElement ?? prev?.activeElement ?? null,
        };
        if (st?.activeElementId !== prev?.activeElementId) {
          setChosen(null); setSubmitted(false); setCorrectIndex(null); setDist(null);
        }
        return next;
      });
      /* Self-Paced Mode: on first state:sync that carries the mode, request
         slide 0 so the student starts from the beginning of the deck. */
      if (st?.sessionMode === "self_paced" && !selfPacedInitRef.current) {
        selfPacedInitRef.current = true;
        setSessionMode("self_paced");
        getSocket().emit("student:slide-change", { sessionId: sid, slideIndex: 0 });
      } else if (st?.sessionMode === "teacher") {
        setSessionMode("teacher");
      }
    };
    const onSockError = (e: any) => {
      // eslint-disable-next-line no-console
      console.warn("[presentation socket error]", e);
    };
    const onSlide = ({ index, slide }: { index: number; slide: any }) => {
      setLive((p: any) => ({ ...(p ?? {}), currentSlideIndex: index, slide, activeElementId: null, activeElement: null, revealAnswer: false, revealDistribution: false }));
      setChosen(null); setSubmitted(false); setCorrectIndex(null); setDist(null); setTotalAnswered(0);
      setGameLaunch(null);
      setInlineActivity(null); setMySummary(null);
      setTextInput(""); setTextSubmitted(false);
    };
    const onOpened = ({ elementId, element }: any) => {
      setLive((p: any) => ({ ...(p ?? {}), activeElementId: elementId, activeElement: element, revealAnswer: false, revealDistribution: false }));
      setChosen(null); setSubmitted(false); setCorrectIndex(null); setDist(null);
      if (element?.kind !== "hasad-game") setGameLaunch(null);
      setMySummary(null);
      setTextInput(""); setTextSubmitted(false);
    };
    const onClosed = () => {
      setLive((p: any) => ({ ...(p ?? {}), activeElementId: null, activeElement: null }));
      setChosen(null); setSubmitted(false); setCorrectIndex(null); setDist(null);
      setGameLaunch(null);
      setInlineActivity(null); setMySummary(null);
      setTextInput(""); setTextSubmitted(false);
    };
    const onGameLaunch = (p: { gameKind: string; studentUrl: string; label: string }) => {
      setGameLaunch({ gameKind: p.gameKind, studentUrl: p.studentUrl, label: p.label ?? "" });
    };
    /* Phase 6 — inline live quiz: on every state update, reset our
       per-question local pick state if the question index changed,
       so the new question is interactive. */
    const onInlineState = (p: any) => {
      setInlineActivity((prev) => {
        if (prev && prev.currentQuestionIndex !== p.currentQuestionIndex) {
          setChosen(null); setSubmitted(false);
        }
        return p;
      });
      setMySummary(null);
    };
    const onInlineSummary = (p: { rows: { correct: number; total: number }[]; totalQuestions: number }) => {
      const my = Array.isArray(p.rows) && p.rows.length > 0 ? p.rows[0] : null;
      setMySummary(my ? { correct: my.correct, total: p.totalQuestions } : { correct: 0, total: p.totalQuestions });
      setInlineActivity(null);
    };
    const onRevealDist = ({ on }: { on: boolean }) => setLive((p: any) => ({ ...(p ?? {}), revealDistribution: on }));
    const onRevealAns = ({ on, correctIndex: ci }: any) => {
      setLive((p: any) => ({ ...(p ?? {}), revealAnswer: on }));
      if (on && typeof ci === "number") setCorrectIndex(ci);
      if (!on) setCorrectIndex(null);
    };
    const onDist = (d: any) => { setDist({ counts: d.counts, total: d.total }); setTotalAnswered(d.total); };
    const onTotal = (d: any) => setTotalAnswered(d.total);
    const onAccepted = () => {
      setSubmitted(true);
      /* In self-paced mode, count each accepted answer as a completed activity. */
      if (selfPacedInitRef.current) {
        setActivitiesCompleted((n) => n + 1);
      }
    };
    const onAlready = () => setSubmitted(true);
    /* Self-Paced Mode: server sends back the requested slide + count + optional activity. */
    const onSelfPacedSlide = ({ slideIndex, slide, slideCount, activeElement, activitiesCompleted: ac }: {
      slideIndex: number; slide: any; slideCount: number; activeElement?: any; activitiesCompleted?: number;
    }) => {
      setSelfPacedIdx(slideIndex);
      setSelfPacedCount(slideCount);
      setSelfPacedSlide(slide);
      setSelfPacedActiveEl(activeElement ?? null);
      if (typeof ac === "number") setActivitiesCompleted(ac);
      /* Reset per-slide activity state whenever the slide changes. */
      setChosen(null); setSubmitted(false); setCorrectIndex(null); setDist(null);
      setInlineActivity(null); setMySummary(null); setTextInput(""); setTextSubmitted(false);
      setGameLaunch(null);
    };
    /* Self-Paced Mode: teacher reclaimed control — lock back to teacher pace. */
    const onSelfPacedEnded = ({ currentSlideIndex, slide }: { currentSlideIndex: number; slide: any }) => {
      selfPacedInitRef.current = false;
      setSessionMode("teacher");
      setSelfPacedIdx(null);
      setSelfPacedSlide(null);
      setSelfPacedActiveEl(null);
      setSelfPacedDone(false);
      setLive((prev: any) => ({ ...(prev ?? {}), currentSlideIndex, slide }));
    };
    const onEnded = () => {
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      /* Bounce back to /p/join so the student can scan a fresh QR
         immediately. Storage is already cleared above so /p/join
         won't try to auto-resume into the dead session. */
      setLocation("/p/join");
    };
    const onReconnect = () => join();

    s.on("state:sync", onSync);
    s.on("slide:changed", onSlide);
    s.on("activity:opened", onOpened);
    s.on("activity:closed", onClosed);
    s.on("activity:state", onInlineState);
    s.on("activity:summary", onInlineSummary);
    s.on("results:reveal-distribution", onRevealDist);
    s.on("results:reveal-answer", onRevealAns);
    s.on("results:distribution", onDist);
    s.on("results:total", onTotal);
    s.on("answer:accepted", onAccepted);
    s.on("answer:already", onAlready);
    s.on("session:ended", onEnded);
    s.on("game:launch", onGameLaunch);
    s.on("connect", onReconnect);
    s.on("error", onSockError);
    s.on("connect_error", onSockError);
    s.on("self_paced:slide", onSelfPacedSlide);
    s.on("self_paced:ended", onSelfPacedEnded);
    /* Defensive REST polling — if for any reason the socket layer
       fails to deliver state:sync (auth race, network blip, proxy
       hiccup), poll the REST `/state` endpoint every 4s so the
       student still sees the current slide and any open activity.
       Cheap (one request, no payload waste), and self-correcting
       once the socket recovers. */
    const poll = setInterval(() => {
      fetch(`${API_BASE}/api/p/sessions/${sid}/state?token=${encodeURIComponent(stored.joinToken)}`, { credentials: "include" })
        .then((r) => {
          /* Mirror the initial-fetch behavior: if the session vanished
             (404) or our token is no longer valid (403), the saved
             entry is dead — clear it and bounce so the student isn't
             silently stuck polling a non-existent session. */
          if (r.status === 404 || r.status === 403) {
            try { localStorage.removeItem(KEY); } catch { /* ignore */ }
            clearInterval(poll);
            setLocation("/p/join");
            return null;
          }
          return r.ok ? r.json() : null;
        })
        .then((j) => {
          if (!j) return;
          /* Same auto-clear when the teacher ends the session and the
             socket `session:ended` event was missed (offline tab,
             socket dropped). */
          if (j.status === "ended") {
            try { localStorage.removeItem(KEY); } catch { /* ignore */ }
            clearInterval(poll);
            setLocation("/p/join");
            return;
          }
          setLive((prev: any) => ({
            ...(prev ?? {}),
            status: j.status,
            currentSlideIndex: j.currentSlideIndex,
            slide: j.deck?.currentSlide ?? prev?.slide ?? null,
            activeElementId: j.activeElementId ?? null,
            activeElement: j.activeElement ?? prev?.activeElement ?? null,
            revealDistribution: !!j.revealDistribution,
            revealAnswer: !!j.revealAnswer,
          }));
          /* Phase 6 — also rehydrate inline-quiz state from REST
             during defensive polling, so a brief socket dropout
             can't strand the student on a stale question. */
          if (j.inlineActivity) {
            setInlineActivity((prev) => {
              if (prev && prev.currentQuestionIndex !== j.inlineActivity.currentQuestionIndex) {
                setChosen(null); setSubmitted(false);
              }
              return j.inlineActivity;
            });
          } else if (!j.activeElementId) {
            setInlineActivity(null);
          }
        })
        .catch(() => {});
    }, 4000 + Math.floor(Math.random() * 1000));
    return () => {
      clearInterval(poll);
      s.off("state:sync", onSync);
      s.off("slide:changed", onSlide);
      s.off("activity:opened", onOpened);
      s.off("activity:closed", onClosed);
      s.off("results:reveal-distribution", onRevealDist);
      s.off("results:reveal-answer", onRevealAns);
      s.off("results:distribution", onDist);
      s.off("results:total", onTotal);
      s.off("answer:accepted", onAccepted);
      s.off("answer:already", onAlready);
      s.off("session:ended", onEnded);
      s.off("game:launch", onGameLaunch);
      s.off("activity:state", onInlineState);
      s.off("activity:summary", onInlineSummary);
      s.off("connect", onReconnect);
      s.off("error", onSockError);
      s.off("connect_error", onSockError);
      s.off("self_paced:slide", onSelfPacedSlide);
      s.off("self_paced:ended", onSelfPacedEnded);
    };
    /* Intentionally NOT depending on `live?.activeElementId` — that
       caused the effect (and the poll interval, and the listener
       set) to tear down and recreate on every state:sync, which both
       wasted resources and triggered duplicate `student:join` emits.
       The activity-reset that previously needed it is now handled
       inside `onSync` via the setLive callback. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, sid]);

  /* Self-Paced Mode: navigate to next/prev slide. */
  function selfPacedNav(delta: 1 | -1) {
    const current = selfPacedIdx ?? 0;
    const next = Math.max(0, Math.min(selfPacedCount - 1, current + delta));
    if (next === current && delta > 0 && current >= selfPacedCount - 1) {
      /* Already on last slide — show completion screen. */
      setSelfPacedDone(true);
      return;
    }
    getSocket().emit("student:slide-change", { sessionId: sid, slideIndex: next });
  }

  function answer(i: number) {
    if (submitted || chosen != null) return;
    setChosen(i);
    getSocket().emit("student:answer", {
      sessionId: sid,
      elementId: live?.activeElementId,
      answerIndex: i,
      /* Phase 6 — included for inline hasad-game quizzes; ignored
         server-side for legacy single-question activity elements. */
      questionIndex: inlineActivity?.currentQuestionIndex,
    });
  }

  /* Default to Arabic until deckMeta loads (the platform default).
     Once we have the deck language, every visible string + the page
     direction follows it so a teacher running an English deck shows
     LTR English copy to students. */
  const isAr = deckMeta ? deckMeta.language !== "en" : true;
  const dir = isAr ? "rtl" : "ltr";

  const wameedhBg =
    "radial-gradient(at 15% 18%, rgba(34,87,57,0.75) 0px, transparent 55%)," +
    "radial-gradient(at 82% 80%, rgba(8,30,16,0.85) 0px, transparent 55%)," +
    "linear-gradient(160deg, #0a1a0f 0%, #0e2118 55%, #121a14 100%)";

  if (!stored) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: wameedhBg }}>
      <Loader2 className="w-8 h-8 animate-spin text-white/50" />
    </div>
  );

  if (live?.status === "ended") {
    return (
      <div
        dir={dir}
        className="fixed inset-0 flex flex-col items-center justify-center text-white p-4 text-center"
        style={{ background: wameedhBg, fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif" }}
      >
        <div className="text-5xl mb-4">👋</div>
        <h1 className="text-2xl font-black mb-2">{isAr ? "انتهت الجلسة" : "Session ended"}</h1>
        <p style={{ color: "rgba(255,255,255,0.55)" }}>{isAr ? "شكراً لمشاركتك!" : "Thanks for joining!"}</p>
      </div>
    );
  }

  /* Self-Paced Mode completion screen — shown when student reaches the last
     slide and presses the "تم" / "Done" button. */
  if (selfPacedDone) {
    return (
      <div
        dir={dir}
        className="fixed inset-0 flex flex-col items-center justify-center text-white p-6 text-center"
        style={{ background: wameedhBg, fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif" }}
      >
        <div className="rounded-3xl p-8 max-w-sm w-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(12px)" }}>
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-black mb-2" style={{ color: "#D9A521" }}>
            {isAr ? "أتممت العرض!" : "All done!"}
          </h1>
          <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>
            {isAr ? `أكملت ${selfPacedCount} شريحة` : `You went through ${selfPacedCount} slide${selfPacedCount === 1 ? "" : "s"}`}
            {activitiesCompleted > 0 && (isAr ? ` وأجبت على ${activitiesCompleted} نشاط` : ` and completed ${activitiesCompleted} activit${activitiesCompleted === 1 ? "y" : "ies"}`)}
          </p>
          {activitiesCompleted > 0 && (
            <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: "rgba(34,87,57,0.4)", border: "1px solid rgba(34,87,57,0.6)" }}>
              <div className="flex items-center justify-center gap-2 text-white font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>
                  {isAr ? `${activitiesCompleted} نشاط مكتمل` : `${activitiesCompleted} activit${activitiesCompleted === 1 ? "y" : "ies"} completed`}
                </span>
              </div>
            </div>
          )}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            {isAr ? "سيُعلمك المعلم عند انتهاء الجلسة." : "Your teacher will let you know when the session ends."}
          </p>
        </div>
      </div>
    );
  }

  /* In self-paced mode, use the activity element bundled with the student's
     current slide. In teacher-paced mode, use the globally opened element. */
  const el = sessionMode === "self_paced" ? (selfPacedActiveEl ?? live?.activeElement) : live?.activeElement;
  const opts: string[] = Array.isArray(el?.options) ? el.options : [];

  /* English students get Latin A/B/C/D markers; Arabic students keep
     the Arabic abjad sequence (ا، ب، ج، د). */
  const optionLetter = (i: number) =>
    isAr ? String.fromCharCode(0x0623 + i) : String.fromCharCode(0x41 + i);

  /* Show a slide as the primary view as soon as we have one. We don't
     gate on `deckMeta` — if the deck metadata fetch is still in flight
     (or failed), fall back to sane defaults so the student isn't
     stranded staring at a wait message while a slide IS being
     broadcast. The teacher's slide *content* is the most important
     thing to display. */
  const slideLang = (deckMeta?.language ?? (isAr ? "ar" : "en")) as "ar" | "en";
  const slideTheme = deckMeta?.theme ?? "emerald-gold";
  const slidePattern = deckMeta?.pattern ?? "dots";

  /* In self-paced mode, always use the student's own slide (delivered by
     the server via self_paced:slide). Fall back to the teacher's current
     slide (live.slide) if the self-paced slide hasn't loaded yet. */
  const displaySlide = sessionMode === "self_paced" && selfPacedSlide != null
    ? selfPacedSlide
    : live?.slide;
  const displaySlideIndex = sessionMode === "self_paced" && selfPacedIdx != null
    ? selfPacedIdx
    : (live?.currentSlideIndex ?? 0);
  const displaySlideCount = sessionMode === "self_paced" && selfPacedCount > 0
    ? selfPacedCount
    : undefined;

  /* Two-mode layout. The default ("watch") view is immersive — the
     teacher's slide fills the entire viewport so a student watching on
     a phone can actually READ it instead of squinting at a thumbnail.
     A small overlay strip at the top shows the student name + slide
     number so they know they're connected. The footer hint sits as a
     subtle pill so it doesn't compete with the slide.

     When the teacher opens an activity (or launches a game) we switch
     to "answer" mode: the slide collapses to a small thumbnail at the
     top and the answer/game card takes over the screen — that's the
     moment the student needs to TAP, not READ. */
  const inActivity = !!el || !!gameLaunch || !!inlineActivity || !!mySummary;
  /* Phase 6 — when an inline hasad-game quiz is running, the current
     question's prompt + options come straight off the `activity:state`
     socket payload. The full `questions[]` array is no longer shipped
     to students, so future prompts stay hidden until the teacher
     advances. */
  const inlineOpts: string[] = Array.isArray((inlineActivity as any)?.options)
    ? ((inlineActivity as any).options as string[])
    : [];
  const inlinePrompt: string =
    typeof (inlineActivity as any)?.prompt === "string"
      ? ((inlineActivity as any).prompt as string)
      : "";
  const isInlineGame = !!inlineActivity && inlineOpts.length > 0;

  /* Manual escape hatch — clears the saved session and returns the
     student to /p/join. Without this, a student stuck on an old
     session (e.g. teacher's QR was regenerated outside the device's
     view) would have to clear browser storage by hand. */
  const leaveSession = () => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setLocation("/p/join");
  };

  return (
    <div
      dir={dir}
      className="min-h-screen flex flex-col items-stretch"
      style={{
        background:
          "radial-gradient(at 15% 18%, rgba(34,87,57,0.75) 0px, transparent 55%)," +
          "radial-gradient(at 82% 80%, rgba(8,30,16,0.85) 0px, transparent 55%)," +
          "linear-gradient(160deg, #0a1a0f 0%, #0e2118 55%, #121a14 100%)",
      }}
    >
      {/* === WATCH MODE — slide fills viewport === */}
      {!inActivity && (
        <>
          {/* Slide stage — anchored full-bleed under a tiny overlay
              header. Sanitized server-side (no correctIndex, no future
              slides). */}
          <div className="relative flex-1 bg-black overflow-hidden">
            {displaySlide ? (
              <SlideStage lang={slideLang} slide={displaySlide} theme={slideTheme} pattern={slidePattern} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 text-base gap-3">
                <Loader2 className="w-7 h-7 animate-spin" />
                <span>{isAr ? "في انتظار المعلم لبدء العرض…" : "Waiting for the teacher to start…"}</span>
              </div>
            )}
            {/* Overlay header — minimal, semi-transparent. */}
            <div className="absolute top-0 inset-x-0 flex items-center justify-between gap-2 px-4 py-2 text-white/85 text-[11px] bg-gradient-to-b from-black/55 to-transparent">
              <span className="truncate font-medium pointer-events-none">{isAr ? `مرحباً، ${stored.name}` : `Welcome, ${stored.name}`}</span>
              <div className="flex items-center gap-3">
                <span className="opacity-80 tabular-nums pointer-events-none">
                  {displaySlideCount != null
                    ? (isAr ? `شريحة ${displaySlideIndex + 1} / ${displaySlideCount}` : `Slide ${displaySlideIndex + 1} / ${displaySlideCount}`)
                    : (isAr ? `شريحة ${displaySlideIndex + 1}` : `Slide ${displaySlideIndex + 1}`)}
                </span>
                <button
                  type="button"
                  onClick={leaveSession}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 px-2 py-0.5 transition-colors"
                  title={isAr ? "تغيير الجلسة" : "Change session"}
                >
                  <LogOut className="w-3 h-3" />
                  <span>{isAr ? "تغيير" : "Leave"}</span>
                </button>
              </div>
            </div>

            {/* Self-Paced Mode: navigation controls at the bottom. */}
            {sessionMode === "self_paced" && selfPacedCount > 0 && (
              <div className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
                <button
                  type="button"
                  disabled={displaySlideIndex <= 0}
                  onClick={() => selfPacedNav(-1)}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "rgba(255,255,255,0.15)", color: "white", backdropFilter: "blur(6px)" }}
                >
                  {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  {isAr ? "السابقة" : "Prev"}
                </button>

                {/* Dot-style progress indicator */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(selfPacedCount, 12) }).map((_, i) => {
                    const active = i === Math.floor(displaySlideIndex / Math.max(1, Math.ceil(selfPacedCount / 12)));
                    return (
                      <div
                        key={i}
                        className="rounded-full transition-all"
                        style={{
                          width: active ? 20 : 6,
                          height: 6,
                          background: active ? "#D9A521" : "rgba(255,255,255,0.3)",
                        }}
                      />
                    );
                  })}
                </div>

                {displaySlideIndex >= selfPacedCount - 1 ? (
                  <button
                    type="button"
                    onClick={() => setSelfPacedDone(true)}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all"
                    style={{ background: "#D9A521", color: "#1c1003" }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isAr ? "تم" : "Done"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => selfPacedNav(1)}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all"
                    style={{ background: "rgba(255,255,255,0.15)", color: "white", backdropFilter: "blur(6px)" }}
                  >
                    {isAr ? "التالية" : "Next"}
                    {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}
              </div>
            )}

            {/* Footer hint — teacher-paced mode only. */}
            {sessionMode !== "self_paced" && displaySlide && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
                <div className="rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-[11px] text-white/80">
                  {isAr ? "تابع مع المعلم — سيظهر السؤال هنا عند فتحه" : "Follow along — questions appear when opened"}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* === ANSWER / GAME MODE — slide thumbnail + interactive card === */}
      {inActivity && (
        <>
          {/* Compact slide preview so the student keeps context but the
              answer card gets the focus. */}
          <div className="px-3 pt-3">
            <div className="flex items-center justify-between gap-2 text-white/80 text-[11px] mb-1.5">
              <span className="truncate font-medium">{stored.name}</span>
              <div className="flex items-center gap-3">
                <span className="opacity-70 tabular-nums">
                  {isAr ? `شريحة ${(live?.currentSlideIndex ?? 0) + 1}` : `Slide ${(live?.currentSlideIndex ?? 0) + 1}`}
                </span>
                <button
                  type="button"
                  onClick={leaveSession}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 px-2 py-0.5 transition-colors"
                  title={isAr ? "تغيير الجلسة" : "Change session"}
                >
                  <LogOut className="w-3 h-3" />
                  <span>{isAr ? "تغيير" : "Leave"}</span>
                </button>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-white/10 bg-black w-full" style={{ aspectRatio: "16 / 9", maxHeight: "22vh" }}>
              {displaySlide && (
                <SlideStage lang={slideLang} slide={displaySlide} theme={slideTheme} pattern={slidePattern} />
              )}
            </div>
          </div>

          {mySummary ? (
            /* Phase 6 — end-of-quiz summary card. Shows the student
               their own score from the inline hasad-game run. */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-6">
              <div className="rounded-2xl bg-white/95 shadow-xl p-6 w-full max-w-md">
                <div className="text-5xl mb-3">🏁</div>
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "#225739" }}>
                  {isAr ? "انتهى النشاط" : "Activity finished"}
                </div>
                <div className="text-3xl font-black text-slate-900 mb-2 tabular-nums">
                  {mySummary.correct} / {mySummary.total}
                </div>
                <p className="text-sm text-slate-600">
                  {isAr ? "إجابات صحيحة" : "correct answers"}
                </p>
              </div>
            </div>
          ) : isInlineGame ? (
            /* Phase 6 — inline live quiz. The student now sees the EXACT
               same layout as the teacher's control overlay: dark gradient
               stage, centered prompt card, 2-column Wameedh tiles with
               English A/B/C/D letters, status footer. Keeping the two
               screens visually identical means students can follow the
               teacher's announcements without re-orienting. */
            <div
              className="flex-1 flex flex-col p-6 sm:p-10 gap-5 sm:gap-7 overflow-y-auto"
              style={{
                background:
                  "linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(34,87,57,0.94) 60%, rgba(120,53,15,0.94) 100%)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm sm:text-base text-white/85 tabular-nums font-bold">
                  {isAr
                    ? `سؤال ${inlineActivity!.currentQuestionIndex + 1} / ${inlineActivity!.totalQuestions}`
                    : `Q ${inlineActivity!.currentQuestionIndex + 1} / ${inlineActivity!.totalQuestions}`}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm uppercase tracking-wider text-amber-300 font-black">
                    {isAr ? "نشاط مباشر" : "Live"}
                  </span>
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                    style={{ background: "#D9A521", color: "#1c1003" }}
                  >
                    <Play className="w-4 h-4" />
                  </span>
                </div>
              </div>

              {/* Prompt card — matches teacher control */}
              <div className="rounded-2xl bg-black/35 border border-white/15 px-6 py-5 sm:px-8 sm:py-6">
                <div className="text-xl sm:text-3xl font-black text-white leading-snug break-words text-center">
                  {inlinePrompt || (isAr ? "سؤال" : "Question")}
                </div>
              </div>

              {/* Wameedh tiles — identical sizing/colors/letters to
                  control.tsx: A=red, B=blue, C=gold, D=purple, English
                  letters always (not localized) so they line up 1:1 with
                  the teacher's screen. A chosen-but-not-revealed answer
                  gets a thick white ring. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1 content-center">
                {(() => {
                  const wameedhTiles = [
                    "linear-gradient(135deg,#c0392b 0%,#7e1d1d 100%)",
                    "linear-gradient(135deg,#2563b8 0%,#173f7a 100%)",
                    "linear-gradient(135deg,#d9a521 0%,#a87a10 100%)",
                    "linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%)",
                  ];
                  return inlineOpts.map((opt, i) => {
                    const isChosen = chosen === i;
                    const revealed = inlineActivity!.phase === "revealed";
                    const correctIdx = inlineActivity!.correctIndex;
                    const isCorrect = revealed && correctIdx === i;
                    const isWrong = revealed && isChosen && typeof correctIdx === "number" && correctIdx !== i;
                    const dim = revealed && !isCorrect && !isWrong;
                    const bg = isCorrect
                      ? "linear-gradient(135deg,#059669 0%,#047857 100%)"
                      : isWrong
                        ? "linear-gradient(135deg,#dc2626 0%,#991b1b 100%)"
                        : wameedhTiles[i % wameedhTiles.length];
                    return (
                      <button
                        key={i}
                        disabled={submitted || chosen != null || revealed}
                        onClick={() => answer(i)}
                        className={`rounded-2xl px-5 py-5 sm:px-6 sm:py-6 flex items-center gap-4 border-2 transition-all min-h-[88px] text-start disabled:cursor-not-allowed ${
                          isCorrect
                            ? "border-emerald-300 shadow-2xl scale-[1.02]"
                            : isWrong
                              ? "border-red-300 shadow-2xl"
                              : isChosen && !revealed
                                ? "border-white shadow-2xl ring-4 ring-white/40 scale-[1.01]"
                                : dim
                                  ? "border-white/10 opacity-50"
                                  : "border-white/15 shadow-lg"
                        }`}
                        style={{ background: bg, color: "#fff" }}
                      >
                        <span
                          className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full font-black text-base sm:text-lg shrink-0"
                          style={{ background: "rgba(0,0,0,0.4)", color: "#fff" }}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1 font-bold break-words text-base sm:text-xl leading-snug">{opt}</span>
                        {isCorrect && <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-100 shrink-0" />}
                      </button>
                    );
                  });
                })()}
              </div>

              <div className="flex items-center justify-between text-sm sm:text-base text-white/85 font-bold">
                <span>
                  {isAr
                    ? `أجاب: ${inlineActivity!.answeredCount} طالب`
                    : `${inlineActivity!.answeredCount} answered`}
                </span>
                <span>
                  {inlineActivity!.phase === "revealed"
                    ? (isAr ? "تم كشف الإجابة" : "Answer revealed")
                    : submitted
                      ? (isAr ? "تم إرسال إجابتك" : "Submitted")
                      : (isAr ? "بانتظار اختيارك…" : "Pick your answer…")}
                </span>
              </div>
            </div>
          ) : gameLaunch ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-6">
              <div className="rounded-2xl bg-white/95 shadow-xl p-6 w-full max-w-md">
                <div className="text-5xl mb-3">🎮</div>
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "#225739" }}>
                  {isAr ? "المعلم بدأ لعبة" : "Teacher launched a game"}
                </div>
                {gameLaunch.label ? (
                  <div className="text-lg font-bold text-slate-900 mb-4">{gameLaunch.label}</div>
                ) : null}
                <a
                  href={gameLaunch.studentUrl}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-bold shadow-md w-full"
                  style={{ background: "#D9A521", color: "#1c1003" }}
                >
                  {isAr ? "افتح اللعبة الآن" : "Open the game now"}
                </a>
                <p className="mt-3 text-xs text-slate-500">
                  {isAr
                    ? "سيعطيك المعلم رمز الانضمام (PIN). افتح اللعبة في تبويب جديد ثم أدخل الرمز."
                    : "Your teacher will share a join code (PIN). Open the game in a new tab and enter the code."}
                </p>
              </div>
            </div>
          ) : el && (el.activityKind === "word_cloud" || el.activityKind === "open_wall") ? (
            /* ── Word cloud / open wall — text input card ── */
            <div className="flex-1 flex flex-col p-4">
              <div className="rounded-2xl bg-white/95 shadow-xl p-5 mb-4">
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: el.activityKind === "word_cloud" ? "#7ec8e3" : "#D9A521" }}>
                  {el.activityKind === "word_cloud"
                    ? (isAr ? "☁ سحابة الكلمات" : "☁ Word Cloud")
                    : (isAr ? "💬 جدار الردود" : "💬 Response Wall")}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-4">
                  {el.prompt || (isAr ? "أرسل ردك" : "Send your response")}
                </h2>

                {textSubmitted ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    <div className="text-lg font-bold text-slate-800">
                      {isAr ? "تم إرسال ردك!" : "Response sent!"}
                    </div>
                    <div className="text-sm text-slate-500">
                      {el.activityKind === "word_cloud"
                        ? (isAr ? "شاهد الكلمات تظهر على الشاشة" : "Watch the words appear on screen")
                        : (isAr ? "سيظهر ردك على الشاشة عند موافقة المعلم" : "Your response will appear when the teacher approves it")}
                    </div>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value.slice(0, el.activityKind === "word_cloud" ? 60 : 500))}
                      rows={el.activityKind === "word_cloud" ? 2 : 4}
                      className="w-full p-3 text-base border-2 border-slate-200 rounded-xl bg-white resize-none outline-none focus:border-emerald-500 transition-colors"
                      placeholder={
                        el.activityKind === "word_cloud"
                          ? (isAr ? "اكتب كلمة أو عبارة قصيرة…" : "Type a word or short phrase…")
                          : (isAr ? "اكتب ردك هنا…" : "Type your response here…")
                      }
                      dir={isAr ? "rtl" : "ltr"}
                    />
                    <button
                      disabled={!textInput.trim()}
                      onClick={() => {
                        const cleaned = textInput.trim();
                        if (!cleaned) return;
                        const event = el.activityKind === "word_cloud" ? "word_cloud:submit" : "wall:submit";
                        getSocket().emit(event, {
                          sessionId: sid,
                          elementId: live?.activeElementId,
                          text: cleaned,
                        });
                        setTextSubmitted(true);
                      }}
                      className="mt-3 w-full rounded-xl py-3 text-base font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "#225739", color: "white" }}
                    >
                      {isAr ? "إرسال" : "Send"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : el ? (
        <div className="flex-1 flex flex-col p-4">
          <div className="rounded-2xl bg-white/95 shadow-xl p-5 mb-4">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "#D9A521" }}>
              {isAr ? "نشاط" : "Activity"}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{el!.prompt || (isAr ? "سؤال" : "Question")}</h2>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {opts.map((opt, i) => {
              const isChosen = chosen === i;
              const isCorrect = correctIndex === i;
              const isWrong = live?.revealAnswer && isChosen && correctIndex != null && correctIndex !== i;
              const bg = isCorrect ? "#16a34a" : isWrong ? "#dc2626" : isChosen ? "#D9A521" : "rgba(255,255,255,0.95)";
              const fg = isCorrect || isWrong || isChosen ? "white" : "#0f172a";
              const distCount = dist?.counts?.[String(i)] ?? 0;
              const total = dist?.total ?? 0;
              const pct = total > 0 ? Math.round((distCount / total) * 100) : 0;
              return (
                <button
                  key={i}
                  disabled={submitted || chosen != null}
                  onClick={() => answer(i)}
                  className="rounded-2xl px-4 py-4 text-start text-lg font-bold shadow-md transition-all disabled:cursor-not-allowed relative overflow-hidden"
                  style={{ background: bg, color: fg }}
                >
                  {live?.revealDistribution && (
                    <div className="absolute inset-0 bg-black/10" style={{ width: `${pct}%`, transition: "width .3s" }} />
                  )}
                  <span className="relative">
                    <span className="inline-block w-7 h-7 rounded-full me-2 text-center leading-7 text-sm" style={{ background: "rgba(0,0,0,0.15)" }}>
                      {optionLetter(i)}
                    </span>
                    {opt}
                  </span>
                  {live?.revealDistribution && (
                    <span className="relative float-end text-sm opacity-80">{pct}%</span>
                  )}
                </button>
              );
            })}
          </div>

          {submitted && (
            <div className="mt-4 rounded-xl bg-emerald-700/60 text-white text-center py-3 font-bold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {isAr ? "تم إرسال إجابتك" : "Answer submitted"}
            </div>
          )}
          {!live?.revealDistribution && totalAnswered > 0 && (
            <div className="mt-2 text-center text-xs text-white/60">
              {isAr
                ? `${totalAnswered} إجابة مستلمة`
                : `${totalAnswered} answer${totalAnswered === 1 ? "" : "s"} received`}
            </div>
          )}
        </div>
          ) : null}
        </>
      )}
    </div>
  );
}
