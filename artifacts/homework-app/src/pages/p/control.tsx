import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { getSocket } from "@/lib/socket";
import { SlideStage } from "@/lib/slide-render";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  ChevronLeft, ChevronRight, Play, Square, Eye, EyeOff,
  CheckCircle2, Users, Copy, X, Loader2, Share2, LinkIcon, Sparkles,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface SessionState {
  session: {
    id: number;
    pin: string;
    status: "lobby" | "running" | "ended";
    currentSlideIndex: number;
    activeElementId: string | null;
    revealDistribution: boolean;
    revealAnswer: boolean;
    mode: "class" | "guest";
  };
  deck: {
    id: number;
    title: string;
    language: "ar" | "en";
    theme: string;
    pattern: string;
    slides: any[];
  } | null;
}

interface LiveState {
  status: string;
  currentSlideIndex: number;
  activeElementId: string | null;
  activeElement: any | null;
  revealDistribution: boolean;
  revealAnswer: boolean;
}

/* Teacher control panel for a live presentation. Owner-only — server
   verifies the session via socket.request.session.teacherId on every
   command. The big PIN + slide nav + activity reveals all live here. */
export default function PresentationControl() {
  const params = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const sid = Number(params.sessionId);

  const [info, setInfo] = useState<SessionState | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [count, setCount] = useState(0);
  const [dist, setDist] = useState<{ counts: Record<string, number>; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  /* Phase 6 — inline hasad-game quiz state on the teacher side. The
     teacher always sees `correctIndex` for the current question (the
     server's audience-split makes that safe). */
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
  const [summary, setSummary] = useState<{
    elementId: string;
    totalQuestions: number;
    rows: { studentKey: string; name: string; correct: number; total: number }[];
  } | null>(null);
  /* Persisted inline-quiz run history for this session. Loaded from
     REST and refreshed whenever a new summary lands (so the just-
     completed run shows up without a manual reload). */
  type InlineRun = {
    elementId: string;
    label: string;
    finishedAt: string;
    totalQuestions: number;
    students: { studentKey: string; name: string; correct: number; answered: number }[];
  };
  const [history, setHistory] = useState<InlineRun[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  /* word_cloud / open_wall live state */
  const [wordCloudWords, setWordCloudWords] = useState<{ text: string; count: number }[]>([]);
  const [wallCards, setWallCards] = useState<{ id: string; text: string; visible: boolean; studentKey: string }[]>([]);
  /* Stage Mode — professional cinematic display mode for the projector. */
  const [stageMode, setStageMode] = useState(false);

  async function loadHistory() {
    if (!Number.isFinite(sid)) return;
    try {
      const r = await fetch(`${API_BASE}/api/presentations/sessions/${sid}/inline-runs`, { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json();
      setHistory(Array.isArray(j?.runs) ? j.runs : []);
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    fetch(`${API_BASE}/api/presentations/sessions/${sid}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => setInfo(j))
      .catch(() => toast.error("تعذّر تحميل الجلسة"))
      .finally(() => setLoading(false));
  }, [sid]);

  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    const s = getSocket();
    s.emit("teacher:join-presentation", { sessionId: sid });

    const onSync = (st: LiveState) => setLive(st);
    const onSlide = ({ index }: { index: number }) => {
      setLive((p) => (p ? { ...p, currentSlideIndex: index, activeElementId: null, activeElement: null, revealDistribution: false, revealAnswer: false } : p));
      setInlineActivity(null); setSummary(null);
      setWordCloudWords([]); setWallCards([]);
    };
    const onOpened = ({ elementId, element }: { elementId: string; element: any }) => {
      setLive((p) => (p ? { ...p, activeElementId: elementId, activeElement: element, revealDistribution: false, revealAnswer: false } : p));
      setSummary(null);
      setWordCloudWords([]); setWallCards([]);
      setInlineActivity((prev) => (prev && prev.elementId !== elementId ? null : prev));
    };
    const onClosed = () => {
      setLive((p) => (p ? { ...p, activeElementId: null, activeElement: null, revealDistribution: false, revealAnswer: false } : p));
      setInlineActivity(null); setSummary(null);
      setWordCloudWords([]); setWallCards([]);
    };
    const onWordCloudUpdate = ({ words }: { elementId: string; words: { text: string; count: number }[] }) => setWordCloudWords(words ?? []);
    const onWallUpdate = ({ cards }: { elementId: string; cards: { id: string; text: string; visible: boolean; studentKey: string }[] }) => setWallCards(cards ?? []);
    const onInlineState = (p: any) => { setInlineActivity(p); setSummary(null); };
    const onInlineSummary = (p: any) => {
      setSummary(p); setInlineActivity(null);
      /* Refresh persisted history so the just-finished run appears. */
      void loadHistory();
    };
    const onRevealDist = ({ on }: { on: boolean }) =>
      setLive((p) => (p ? { ...p, revealDistribution: on } : p));
    const onRevealAns = ({ on }: { on: boolean }) =>
      setLive((p) => (p ? { ...p, revealAnswer: on } : p));
    const onCount = ({ n }: { n: number }) => setCount(n);
    const onDist = (d: { elementId: string; counts: Record<string, number>; total: number }) =>
      setDist({ counts: d.counts, total: d.total });
    const onEnded = () => {
      toast.info("انتهت الجلسة");
      setLive((p) => (p ? { ...p, status: "ended" } : p));
    };
    const onReconnect = () => s.emit("teacher:join-presentation", { sessionId: sid });
    const onStageChanged = ({ on }: { on: boolean }) => setStageMode(!!on);

    s.on("state:sync", onSync);
    s.on("slide:changed", onSlide);
    s.on("activity:opened", onOpened);
    s.on("activity:closed", onClosed);
    s.on("activity:state", onInlineState);
    s.on("activity:summary", onInlineSummary);
    s.on("results:reveal-distribution", onRevealDist);
    s.on("results:reveal-answer", onRevealAns);
    s.on("participants:count", onCount);
    s.on("results:distribution", onDist);
    s.on("session:ended", onEnded);
    s.on("connect", onReconnect);
    s.on("word_cloud:update", onWordCloudUpdate);
    s.on("wall:update", onWallUpdate);
    s.on("stage:changed", onStageChanged);

    return () => {
      s.off("state:sync", onSync);
      s.off("slide:changed", onSlide);
      s.off("activity:opened", onOpened);
      s.off("activity:closed", onClosed);
      s.off("activity:state", onInlineState);
      s.off("activity:summary", onInlineSummary);
      s.off("results:reveal-distribution", onRevealDist);
      s.off("results:reveal-answer", onRevealAns);
      s.off("participants:count", onCount);
      s.off("results:distribution", onDist);
      s.off("session:ended", onEnded);
      s.off("connect", onReconnect);
      s.off("word_cloud:update", onWordCloudUpdate);
      s.off("wall:update", onWallUpdate);
      s.off("stage:changed", onStageChanged);
    };
  }, [sid]);

  const slides = info?.deck?.slides ?? [];
  const idx = live?.currentSlideIndex ?? 0;
  const total = slides.length;
  const slide = slides[idx];

  /* Activity elements on this slide (non-empty subset). Used to
     populate the "افتح نشاط" buttons. Includes both classic activity
     elements AND Phase 3 hasad-game launchers — the latter render a
     distinct "إطلاق اللعبة" button that opens the game's setup page
     in a new tab. */
  const activities = useMemo(() => {
    if (!slide || !Array.isArray(slide.elements)) return [];
    return slide.elements.filter(
      (e: any) => e?.kind === "activity" || e?.kind === "hasad-game",
    );
  }, [slide]);

  function go(delta: 1 | -1) {
    const next = Math.max(0, Math.min(total - 1, idx + delta));
    if (next === idx) return;
    getSocket().emit("slide:change", { sessionId: sid, index: next });
  }

  /* Keyboard navigation for the live control panel — mirrors the
     standalone Present view. Arrow keys are flipped for RTL so the
     "previous in reading order" key always points to the start of
     the line. Skipped when the user is typing in a text field so
     editing the title or PIN doesn't paginate the deck. */
  const isAr = info?.deck?.language !== "en";
  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    const ended = (live?.status ?? info?.session.status) === "ended";
    if (ended) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      switch (e.key) {
        case "ArrowRight": e.preventDefault(); go(isAr ? -1 : 1); break;
        case "ArrowLeft":  e.preventDefault(); go(isAr ? 1 : -1); break;
        case " ":
        case "PageDown":   e.preventDefault(); go(1); break;
        case "PageUp":     e.preventDefault(); go(-1); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, idx, total, isAr, live?.status, info?.session.status]);

  function openActivity(elId: string) {
    getSocket().emit("activity:open", { sessionId: sid, elementId: elId });
  }

  /* Phase 3 — game launch. The teacher's `activity:open` triggers the
     server to broadcast `game:launch` to every student device; we also
     listen for it ourselves so we can open the game's setup page in a
     new tab without round-tripping URLs through React state. The
     server also re-emits `game:launch` on reconnect/state-sync so
     late-joining students see the launch UI — but we don't want to
     pop open a new browser tab for the teacher every time they
     reconnect, so we dedupe by elementId. */
  const lastLaunchedRef = useRef<string | null>(null);
  useEffect(() => {
    const s = getSocket();
    const onGameLaunch = (payload: {
      teacherUrl?: string;
      elementId?: string;
      gameKind?: string;
      topic?: string;
      prompt?: string;
      label?: string;
      questions?: { prompt: string; options: string[]; correctIndex: number }[];
    }) => {
      const { teacherUrl, elementId } = payload;
      const key = elementId ?? teacherUrl ?? "";
      if (!teacherUrl || lastLaunchedRef.current === key) return;
      /* Phase 6 — if the launched game has inline questions[], the
         server now runs the quiz inline (broadcasts `activity:state`)
         and we render the question panel directly on this page. We
         must NOT pop a new tab in that case — the teacher controls
         everything from here. Only legacy launchers (no questions)
         still go to a new tab. */
      if (Array.isArray(payload.questions) && payload.questions.length > 0) {
        lastLaunchedRef.current = key;
        return;
      }
      lastLaunchedRef.current = key;
      window.open(teacherUrl, "_blank", "noopener");
    };
    const onClosed = () => { lastLaunchedRef.current = null; };
    s.on("game:launch", onGameLaunch);
    s.on("activity:closed", onClosed);
    return () => {
      s.off("game:launch", onGameLaunch);
      s.off("activity:closed", onClosed);
    };
  }, []);
  function closeActivity() {
    getSocket().emit("activity:close", { sessionId: sid });
  }
  function toggleDist() {
    getSocket().emit("results:reveal-distribution", { sessionId: sid, on: !live?.revealDistribution });
  }
  function toggleAns() {
    getSocket().emit("results:reveal-answer", { sessionId: sid, on: !live?.revealAnswer });
  }
  function revealQuestion() {
    getSocket().emit("activity:reveal-question", { sessionId: sid });
  }
  function nextQuestion() {
    getSocket().emit("activity:next-question", { sessionId: sid });
  }
  function endSession() {
    setEndDialogOpen(true);
  }
  function confirmEndSession() {
    setEndDialogOpen(false);
    getSocket().emit("session:end", { sessionId: sid });
  }
  function copyPin() {
    if (!info?.session.pin) return;
    navigator.clipboard.writeText(info.session.pin).then(() => toast.success("تم نسخ الـ PIN"));
  }
  function joinUrl() {
    if (!info?.session.pin) return "";
    return `${window.location.origin}/p/join#pin=${info.session.pin}`;
  }
  function copyJoinLink() {
    const url = joinUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => toast.success("تم نسخ الرابط"));
  }
  async function shareJoinLink() {
    const url = joinUrl();
    if (!url) return;
    const title = info?.deck?.title || "جلسة مباشرة";
    const text = `انضم إلى الجلسة: ${title}`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text, url });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to copy */
      }
    }
    copyJoinLink();
  }
  function openShow() {
    window.open(`/p/show/${sid}`, "_blank", "noopener");
  }

  if (loading) {
    return <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-white"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }
  if (!info) {
    return <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-white">تعذّر تحميل الجلسة</div>;
  }

  const ended = (live?.status ?? info.session.status) === "ended";

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white p-4 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold truncate">{info.deck?.title ?? ""}</h1>
          <div className="text-sm text-white/60">شريحة {idx + 1} / {total}</div>
        </div>

        {/* TOP activities launcher — placed above the slide stage so
            first-time teachers see "إطلاق اللعبة" immediately without
            scrolling. Uses a warm gradient + pulsing Play icon to draw
            the eye. Only renders when the current slide actually has
            launchable activities and no inline quiz is already running. */}
        {activities.length > 0 && !ended && !inlineActivity && (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{
              background:
                "linear-gradient(135deg, rgba(217,165,33,0.18) 0%, rgba(34,87,57,0.32) 100%)",
              border: "1px solid rgba(217,165,33,0.45)",
              boxShadow: "0 8px 28px -8px rgba(217,165,33,0.35)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                  style={{ background: "#D9A521", color: "#1c1003" }}
                >
                  <Play className="w-4 h-4" />
                </span>
                <div className="text-sm font-black text-white">
                  نشاط جاهز للإطلاق على هذه الشريحة
                </div>
              </div>
              <span className="text-[11px] text-amber-200/90 font-bold">
                {activities.length} نشاط
              </span>
            </div>
            {activities.map((a: any) => {
              const open = live?.activeElementId === a.id;
              const isGame = a.kind === "hasad-game";
              const label = a.prompt || a.topic || (isGame ? "لعبة حصاد" : "نشاط");
              const qCount = isGame && Array.isArray(a.questions) ? a.questions.length : 0;
              return (
                <div key={a.id} className="flex items-center gap-2 rounded-xl bg-black/30 border border-white/10 p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      {isGame ? "🎮 " : ""}{label}
                    </div>
                    {qCount > 0 && (
                      <div className="text-[11px] text-amber-200/80 mt-0.5">
                        {qCount} سؤال جاهز
                      </div>
                    )}
                  </div>
                  {isGame ? (
                    open ? (
                      <Button size="sm" variant="destructive" onClick={closeActivity}>
                        <Square className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="default"
                        onClick={() => openActivity(a.id)}
                        className="font-black shadow-lg"
                        style={{ background: "#D9A521", color: "#1c1003" }}
                      >
                        <Play className="w-4 h-4 me-1.5" /> إطلاق اللعبة الآن
                      </Button>
                    )
                  ) : open && (a.activityKind === "word_cloud" || a.activityKind === "open_wall") ? (
                    <>
                      <span className="text-xs text-white/60 tabular-nums">
                        {a.activityKind === "word_cloud" ? `${wordCloudWords.length} كلمة` : `${wallCards.length} بطاقة`}
                      </span>
                      <Button size="sm" variant="destructive" onClick={closeActivity}>
                        <Square className="w-4 h-4" />
                      </Button>
                    </>
                  ) : open ? (
                    <>
                      <Button size="sm" variant="outline" onClick={toggleDist} className="border-amber-400/40 text-amber-300">
                        {live?.revealDistribution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        <span className="ms-1">توزيع</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={toggleAns} className="border-emerald-400/40 text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="ms-1">{live?.revealAnswer ? "إخفاء" : "كشف"}</span>
                      </Button>
                      <Button size="sm" variant="destructive" onClick={closeActivity}>
                        <Square className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => openActivity(a.id)} style={{ background: "#D9A521", color: "#1c1003" }}>
                      <Play className="w-4 h-4 me-1" /> فتح النشاط
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Slide stage. When an inline quiz is running, we expand the
            stage from a cramped 16:9 thumbnail into a roomy panel
            (~70vh) so the question + answers breathe across the whole
            screen. The underlying slide stays mounted so the teacher
            can flip back to it instantly after the activity ends. */}
        <div
          className={`relative rounded-xl bg-black overflow-hidden border border-white/10 ${
            inlineActivity && !ended ? "min-h-[68vh]" : "aspect-video"
          }`}
        >
          {slide && info.deck && (
            <SlideStage lang={info.deck.language} slide={slide} theme={info.deck.theme} pattern={info.deck.pattern} />
          )}

          {/* Phase 6 — Inline live-quiz overlay. Replaces the old panel
              below the slide; renders inside the stage so the teacher
              sees the prompt + options in the same visual frame as the
              slide itself. */}
          {inlineActivity && !ended && (() => {
            const q = {
              prompt: inlineActivity.prompt,
              options: inlineActivity.options,
              correctIndex: inlineActivity.correctIndex,
            };
            if (!q.options || q.options.length === 0) return null;
            const revealed = inlineActivity.phase === "revealed";
            const isLast = inlineActivity.currentQuestionIndex >= inlineActivity.totalQuestions - 1;
            return (
              <div
                className="absolute inset-0 flex flex-col p-6 sm:p-10 gap-5 sm:gap-7 overflow-y-auto"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(34,87,57,0.94) 60%, rgba(120,53,15,0.94) 100%)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full"
                      style={{ background: "#D9A521", color: "#1c1003" }}
                    >
                      <Play className="w-4 h-4" />
                    </span>
                    <span className="text-xs sm:text-sm uppercase tracking-wider text-amber-300 font-black">
                      نشاط مباشر
                    </span>
                  </div>
                  <div className="text-sm sm:text-base text-white/85 tabular-nums font-bold">
                    سؤال {inlineActivity.currentQuestionIndex + 1} / {inlineActivity.totalQuestions}
                  </div>
                </div>

                {/* Prompt card — centered, generous, easy to read from
                    the back of a classroom. */}
                <div className="rounded-2xl bg-black/35 border border-white/15 px-6 py-5 sm:px-8 sm:py-6">
                  <div className="text-xl sm:text-3xl font-black text-white leading-snug break-words text-center">
                    {q.prompt}
                  </div>
                </div>

                {/* Wameedh-palette answer tiles. We use the same four
                    warm colors as the slide editor (amber/orange/red/
                    gold) so the teacher's control screen matches the
                    student-facing live view. Tiles are deliberately
                    compact: the teacher already sees the slide above
                    them and doesn't need oversized buttons here.
                    NOTE: we DON'T leak the correct answer before
                    reveal — pre-reveal every tile uses the same neutral
                    base. Only after `revealed=true` do we highlight the
                    correct tile in green so the teacher can confirm. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 flex-1 content-center">
                  {(() => {
                    /* Wameedh tile palette — matches the live student
                       view: A=red, B=blue, C=gold, D=purple. */
                    const wameedhTiles = [
                      "linear-gradient(135deg,#c0392b 0%,#7e1d1d 100%)",
                      "linear-gradient(135deg,#2563b8 0%,#173f7a 100%)",
                      "linear-gradient(135deg,#d9a521 0%,#a87a10 100%)",
                      "linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%)",
                    ];
                    return (q.options as string[]).map((opt, i) => {
                      const isCorrect = i === q.correctIndex;
                      const highlight = revealed && isCorrect;
                      const dim = revealed && !isCorrect;
                      const tileBg = wameedhTiles[i % wameedhTiles.length];
                      return (
                        <div
                          key={i}
                          className={`rounded-2xl px-5 py-5 sm:px-6 sm:py-6 flex items-center gap-4 border-2 transition-all min-h-[88px] ${
                            highlight
                              ? "border-emerald-300 shadow-2xl scale-[1.02]"
                              : dim
                                ? "border-white/10 opacity-50"
                                : "border-white/15 shadow-lg"
                          }`}
                          style={{
                            background: highlight
                              ? "linear-gradient(135deg,#059669 0%,#047857 100%)"
                              : tileBg,
                            color: "#fff",
                          }}
                        >
                          <span
                            className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full font-black text-base sm:text-lg shrink-0"
                            style={{
                              background: "rgba(0,0,0,0.4)",
                              color: "#fff",
                            }}
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1 font-bold break-words text-base sm:text-xl leading-snug">{opt}</span>
                          {highlight && <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-100 shrink-0" />}
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="flex items-center justify-between text-sm sm:text-base text-white/85 font-bold">
                  <span>أجاب: {inlineActivity.answeredCount} طالب</span>
                  <span>{revealed ? "تم كشف الإجابة" : "بانتظار الإجابات…"}</span>
                </div>

                <div className="flex items-center gap-3">
                  {!revealed ? (
                    <Button onClick={revealQuestion} className="flex-1 font-black h-12 text-base" style={{ background: "#225739", color: "white" }}>
                      <Eye className="w-5 h-5 me-2" /> كشف الإجابة
                    </Button>
                  ) : (
                    <Button onClick={nextQuestion} className="flex-1 font-black h-12 text-base" style={{ background: "#D9A521", color: "#1c1003" }}>
                      {isLast ? "إنهاء النشاط" : "السؤال التالي"} <ChevronLeft className="w-5 h-5 me-2" />
                    </Button>
                  )}
                  <Button variant="destructive" onClick={closeActivity} title="إغلاق النشاط" className="h-12 px-4">
                    <Square className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => go(-1)} disabled={idx === 0 || ended} className="flex-1">
            <ChevronRight className="w-4 h-4 ms-1" /> السابقة
          </Button>
          <Button onClick={() => go(1)} disabled={idx >= total - 1 || ended} className="flex-1" style={{ background: "#225739" }}>
            التالية <ChevronLeft className="w-4 h-4 me-1" />
          </Button>
        </div>

        {/* Compact running-activity status (text activities only — the
            hasad-game inline quiz is shown as an overlay on the slide). */}
        {activities.length > 0 && !ended && live?.activeElementId && !inlineActivity && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
            <div className="text-xs font-bold text-white/70">النشاط الجاري</div>
            {activities
              .filter((a: any) => a.id === live?.activeElementId)
              .map((a: any) => {
                const label = a.prompt || a.topic || "نشاط";
                const isTextActivity = a.activityKind === "word_cloud" || a.activityKind === "open_wall";
                return (
                  <div key={a.id} className="flex items-center gap-2">
                    <div className="flex-1 text-sm truncate text-white/90">{label}</div>
                    {isTextActivity ? (
                      <>
                        <span className="text-xs text-white/50 tabular-nums">
                          {a.activityKind === "word_cloud" ? `${wordCloudWords.length} كلمة` : `${wallCards.length} بطاقة`}
                        </span>
                        <Button size="sm" variant="destructive" onClick={closeActivity}>
                          <Square className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={toggleDist} className="border-amber-400/40 text-amber-300">
                          {live?.revealDistribution ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          <span className="ms-1">توزيع</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={toggleAns} className="border-emerald-400/40 text-emerald-300">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="ms-1">{live?.revealAnswer ? "إخفاء" : "كشف"}</span>
                        </Button>
                        <Button size="sm" variant="destructive" onClick={closeActivity}>
                          <Square className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            {dist && (
              <div className="text-xs text-white/60">إجابات مستلمة: {dist.total}</div>
            )}
          </div>
        )}

        {/* ── Open Wall card moderation panel ── */}
        {!ended && wallCards.length > 0 && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
            <div className="text-xs font-bold text-white/70">
              بطاقات جدار الردود ({wallCards.length})
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {wallCards.map((card) => (
                <div key={card.id} className="flex items-start gap-2 rounded-lg bg-black/30 border border-white/10 p-2">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm break-words leading-snug ${card.visible ? "text-white/90" : "text-white/40 line-through"}`}>
                      {card.text}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => getSocket().emit("wall:toggle-card", { sessionId: sid, elementId: live?.activeElementId, cardId: card.id, visible: !card.visible })}
                    className="shrink-0 rounded-md p-1.5 transition-colors"
                    style={{ background: card.visible ? "rgba(34,87,57,0.4)" : "rgba(255,255,255,0.06)" }}
                    title={card.visible ? "إخفاء البطاقة" : "إظهار البطاقة"}
                  >
                    {card.visible ? <Eye className="w-4 h-4 text-emerald-300" /> : <EyeOff className="w-4 h-4 text-white/40" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Word cloud live count ── */}
        {!ended && wordCloudWords.length > 0 && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="text-xs font-bold text-white/70 mb-2">
              ☁ سحابة الكلمات ({wordCloudWords.reduce((s, w) => s + w.count, 0)} إجابة)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {wordCloudWords
                .slice()
                .sort((a, b) => b.count - a.count)
                .slice(0, 20)
                .map((w) => (
                  <span
                    key={w.text}
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{
                      background: "rgba(34,87,57,0.5)",
                      color: w.count >= 3 ? "#D9A521" : "rgba(255,255,255,0.8)",
                      fontSize: `${Math.min(14 + w.count * 2, 20)}px`,
                    }}
                  >
                    {w.text} ({w.count})
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Phase 6 — End-of-quiz leaderboard for the teacher. */}
        {summary && !ended && (
          <div className="rounded-xl bg-emerald-900/30 border border-emerald-600/40 p-4 space-y-2">
            <div className="text-sm font-bold text-emerald-200">نتائج النشاط</div>
            <div className="text-xs text-white/60 mb-1">
              {summary.rows.length} طالب · {summary.totalQuestions} أسئلة
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {summary.rows
                .slice()
                .sort((a, b) => b.correct - a.correct)
                .map((r, i) => (
                  <div key={r.studentKey} className="flex items-center gap-2 text-sm rounded-md bg-white/5 px-2 py-1.5">
                    <span className="inline-block w-6 text-center text-xs font-bold text-amber-300 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-white/90">{r.name}</span>
                    <span className="tabular-nums font-bold text-emerald-200">
                      {r.correct} / {r.total}
                    </span>
                  </div>
                ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => setSummary(null)} className="w-full">
              إغلاق النتائج
            </Button>
          </div>
        )}
      </div>

      <aside className="space-y-3">
        {/* Join card: the join link itself is the primary CTA. The
            actual long URL stays hidden inside the anchor's href so the
            UI stays calm. PIN/QR remain as fallbacks. */}
        <div className="rounded-xl bg-emerald-900/40 border border-emerald-700/40 p-4 text-center">
          <div className="text-xs text-emerald-200 mb-3">للانضمام للجلسة</div>
          <div className="flex items-center justify-center gap-2">
            <a
              href={joinUrl()}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold shadow-sm transition-colors"
              style={{ background: "#D9A521", color: "#1c1003" }}
            >
              <LinkIcon className="w-4 h-4" />
              رابط الانضمام
            </a>
            <Button
              size="sm"
              variant="outline"
              onClick={copyJoinLink}
              title="نسخ الرابط"
              aria-label="نسخ الرابط"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={shareJoinLink}
              title="مشاركة الرابط"
              aria-label="مشاركة الرابط"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>

          {/* QR for fast phone join — encodes the join URL with the PIN
              prefilled in the hash so students don't have to type. */}
          <div className="mt-4 flex justify-center">
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={joinUrl()} size={120} />
            </div>
          </div>

          {/* PIN remains as a backup option for late joiners or anyone
              who can't scan the QR / open the shared link. */}
          <div className="mt-4 pt-3 border-t border-emerald-700/40">
            <div className="text-[11px] text-emerald-200/80 mb-1">أو استخدم الرمز</div>
            <button
              type="button"
              onClick={copyPin}
              title="نسخ الـ PIN"
              className="inline-flex items-center gap-2 text-2xl font-black tabular-nums tracking-widest hover:opacity-80 transition-opacity"
              style={{ color: "#D9A521" }}
            >
              {info.session.pin}
              <Copy className="w-4 h-4 opacity-60" />
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm"><Users className="w-4 h-4" /> المشاركون</span>
          <span className="font-bold text-lg">{count}</span>
        </div>

        <Button onClick={openShow} className="w-full" variant="outline">
          فتح شاشة العرض في تبويب جديد
        </Button>

        {/* Stage Mode toggle — professional cinematic mode for the projector.
            Emits stage:toggle to the server which broadcasts stage:changed to the room. */}
        <button
          type="button"
          onClick={() => getSocket().emit("stage:toggle", { sessionId: sid, on: !stageMode })}
          className="w-full flex items-center justify-between rounded-xl px-4 py-3 font-bold text-sm transition-all border"
          style={stageMode
            ? { background: "rgba(217,165,33,0.15)", border: "1px solid #D9A521", color: "#D9A521" }
            : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }
          }
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            وضع المسرح
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-black"
            style={stageMode
              ? { background: "#D9A521", color: "#1c1003" }
              : { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
            }
          >
            {stageMode ? "🎬 مفعّل" : "متوقف"}
          </span>
        </button>

        <Button onClick={endSession} disabled={ended} variant="destructive" className="w-full">
          <X className="w-4 h-4 me-1" /> إنهاء الجلسة
        </Button>

        {/* Persisted inline-quiz history. Lists every completed inline
            quiz run for this session — survives reloads/restarts. */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-bold text-white/90"
          >
            <span>نتائج النشاط</span>
            <span className="text-xs text-white/60 tabular-nums">{history.length}</span>
          </button>
          {historyOpen && (
            history.length === 0 ? (
              <div className="text-xs text-white/50 py-1">لا توجد نتائج محفوظة بعد</div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {history.map((run) => {
                  const dt = new Date(run.finishedAt);
                  const time = dt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={`${run.elementId}-${run.finishedAt}`} className="rounded-lg bg-black/30 border border-white/10 p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-white/90 truncate flex-1">{run.label}</div>
                        <div className="text-[10px] text-white/50 tabular-nums">{time}</div>
                      </div>
                      <div className="text-[10px] text-white/50">
                        {run.students.length} طالب · {run.totalQuestions} أسئلة
                      </div>
                      <div className="space-y-0.5">
                        {run.students.map((s, i) => (
                          <div key={s.studentKey} className="flex items-center gap-1.5 text-[11px] rounded bg-white/5 px-1.5 py-0.5">
                            <span className="inline-block w-4 text-center text-amber-300 tabular-nums font-bold">{i + 1}</span>
                            <span className="flex-1 truncate text-white/85">{s.name}</span>
                            <span className="tabular-nums font-bold text-emerald-200">{s.correct}/{run.totalQuestions}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {ended && (
          <>
            <Button
              onClick={() => setLocation(`/p/results/${sid}`)}
              className="w-full"
              style={{ background: "#D9A521", color: "#1c1003" }}
            >
              عرض نتائج الجلسة
            </Button>
            <Button onClick={() => info.deck?.id && setLocation(`/teacher/presentations/${info.deck.id}`)} className="w-full" variant="outline">
              رجوع للمحرر
            </Button>
          </>
        )}
      </aside>

      <AlertDialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <AlertDialogContent dir={isAr ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isAr ? "إنهاء الجلسة المباشرة؟" : "End the live session?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? "بعد الإنهاء لن يتمكّن الطلاب من إرسال إجابات جديدة. ستظل النتائج متاحة للعرض."
                : "Once ended, students can no longer submit answers. Results will still be available to view."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmEndSession}
              style={{ background: "#225739", color: "white" }}
            >
              {isAr ? "إنهاء الجلسة" : "End session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
