import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { getSocket } from "@/lib/socket";
import { SlideStage } from "@/lib/slide-render";
import { Loader2, Cloud, MessageSquare } from "lucide-react";

/* ── Word cloud overlay ────────────────────────────────────────────── */
interface CloudWord { text: string; count: number }
const CLOUD_COLORS = [
  "#D9A521", "#60b8a0", "#7ec8e3", "#f4845f", "#b5a1dc",
  "#6bcb77", "#f9c74f", "#f8961e", "#90e0ef", "#c77dff",
];
function WordCloudOverlay({ words, isAr }: { words: CloudWord[]; isAr: boolean }) {
  if (words.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
        <Cloud className="w-16 h-16 opacity-30 text-white" />
        <div className="text-white/50 text-lg font-bold">
          {isAr ? "في انتظار كلمات الطلاب…" : "Waiting for student words…"}
        </div>
      </div>
    );
  }
  const maxCount = Math.max(...words.map((w) => w.count), 1);
  const sorted = [...words].sort((a, b) => b.count - a.count);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-10">
      <div
        dir={isAr ? "rtl" : "ltr"}
        className="w-full h-full flex flex-wrap items-center justify-center gap-x-6 gap-y-3 content-center"
      >
        <AnimatePresence>
          {sorted.map((w, i) => {
            const ratio = w.count / maxCount;
            const size = Math.round(28 + ratio * 72);
            const color = CLOUD_COLORS[i % CLOUD_COLORS.length];
            const rot = ((i * 37) % 21) - 10;
            return (
              <motion.span
                key={w.text}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.4 }}
                transition={{ type: "spring", stiffness: 280, damping: 22 }}
                style={{
                  fontSize: size,
                  color,
                  fontWeight: ratio > 0.6 ? 900 : ratio > 0.3 ? 700 : 500,
                  transform: `rotate(${rot}deg)`,
                  textShadow: `0 2px 12px ${color}44`,
                  fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
                  lineHeight: 1.1,
                  userSelect: "none",
                  display: "inline-block",
                }}
              >
                {w.text}
              </motion.span>
            );
          })}
        </AnimatePresence>
      </div>
      <div
        className="absolute bottom-5 right-5 text-white/40 text-sm font-bold tabular-nums"
        dir="ltr"
      >
        {words.length} {isAr ? "كلمة" : "words"}
      </div>
    </div>
  );
}

/* ── Open wall overlay ─────────────────────────────────────────────── */
interface WallCard { id: string; name: string; text: string; visible: boolean }
function OpenWallOverlay({ cards, isAr }: { cards: WallCard[]; isAr: boolean }) {
  const visible = cards.filter((c) => c.visible);
  if (visible.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
        <MessageSquare className="w-16 h-16 opacity-30 text-white" />
        <div className="text-white/50 text-lg font-bold">
          {isAr ? "في انتظار ردود الطلاب…" : "Waiting for student responses…"}
        </div>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 bg-black/80 p-8 overflow-hidden">
      <div
        dir={isAr ? "rtl" : "ltr"}
        className="h-full grid gap-4 content-start"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
      >
        <AnimatePresence>
          {visible.slice(0, 16).map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 260, damping: 24 }}
              className="rounded-2xl p-5 flex flex-col gap-2 shadow-xl"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                backdropFilter: "blur(6px)",
              }}
            >
              <div className="text-xs font-bold" style={{ color: "#D9A521" }}>
                {c.name}
              </div>
              <div
                className="text-white font-bold break-words"
                style={{ fontSize: "clamp(14px, 2vw, 22px)", lineHeight: 1.4 }}
              >
                {c.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="absolute bottom-5 right-5 text-white/40 text-sm font-bold tabular-nums" dir="ltr">
        {visible.length} {isAr ? "رد" : "responses"}
      </div>
    </div>
  );
}

/* ── Stage Mode: Countdown timer ───────────────────────────────────── */
const STAGE_TIMER_SECS = 60;

/**
 * Circular SVG countdown for Stage Mode. Receives `startedAt` — the unix-ms
 * timestamp when the activity was opened on the server — so late-joining or
 * reconnecting projectors show the correct remaining time rather than
 * restarting from 60s.  Pass `null` to hide the timer (no activity open).
 */
function StageTimer({ startedAt, isAr }: { startedAt: number | null; isAr: boolean }) {
  const computeRemaining = () =>
    startedAt
      ? Math.max(0, STAGE_TIMER_SECS - Math.floor((Date.now() - startedAt) / 1000))
      : STAGE_TIMER_SECS;

  const [remaining, setRemaining] = useState(computeRemaining);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (startedAt === null) {
      setRemaining(STAGE_TIMER_SECS);
      setShaking(false);
      return;
    }
    const init = computeRemaining();
    setRemaining(init);
    setShaking(false);
    if (init <= 0) {
      setShaking(true);
      setTimeout(() => setShaking(false), 1200);
      return;
    }
    const id = setInterval(() => {
      setRemaining((p) => {
        if (p <= 1) {
          clearInterval(id);
          setShaking(true);
          setTimeout(() => setShaking(false), 1200);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);

  if (startedAt === null) return null;

  const pct = remaining / STAGE_TIMER_SECS;
  const color = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#D9A521" : "#ef4444";
  const R = 60;
  const circumference = 2 * Math.PI * R;
  const dashOffset = circumference * (1 - pct);

  return (
    <motion.div
      animate={shaking ? { x: [-10, 10, -10, 10, -5, 5, 0], scale: [1, 1.12, 1] } : {}}
      transition={{ duration: 0.5 }}
      style={{
        position: "absolute",
        top: 24,
        insetInlineStart: 24,
        width: 144,
        height: 144,
        zIndex: 20,
        pointerEvents: "none",
      }}
    >
      <svg width={144} height={144} viewBox="0 0 144 144" style={{ position: "absolute", inset: 0 }}>
        <circle
          cx={72} cy={72} r={R}
          fill="rgba(0,0,0,0.68)"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={10}
        />
        <circle
          cx={72} cy={72} r={R}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 72 72)"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.5s" }}
        />
        {pct < 0.25 && (
          <circle cx={72} cy={72} r={R + 8} fill="none" stroke={color} strokeWidth={2} opacity={0.2} />
        )}
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
      }}>
        <div style={{
          fontSize: 46, fontWeight: 900, color, lineHeight: 1,
          fontFamily: "monospace",
          textShadow: `0 0 24px ${color}55`,
          transition: "color 0.5s",
        }}>
          {remaining}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase" }}>
          {isAr ? "ثانية" : "sec"}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Stage Mode: Dramatic reveal overlay ──────────────────────────── */
function DramaticRevealOverlay({ isAr }: { isAr: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 28 }}
    >
      {/* Spotlight glow */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(34,197,94,0.22) 0%, transparent 70%)",
      }} />
      {/* Badge */}
      <motion.div
        initial={{ scale: 0.55, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 20, delay: 0.08 }}
      >
        <motion.div
          animate={{
            boxShadow: [
              "0 0 40px rgba(34,197,94,0.35)",
              "0 0 90px rgba(34,197,94,0.70)",
              "0 0 40px rgba(34,197,94,0.35)",
            ],
          }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          style={{
            background: "linear-gradient(135deg, rgba(4,22,10,0.97) 0%, rgba(0,0,0,0.97) 100%)",
            border: "2px solid #22c55e",
            borderRadius: 24,
            padding: "24px 56px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -25 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 18, delay: 0.15 }}
            style={{ fontSize: 54, lineHeight: 1 }}
          >
            ✅
          </motion.div>
          <div style={{
            color: "#22c55e",
            fontSize: 32,
            fontWeight: 900,
            fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
            textShadow: "0 0 24px rgba(34,197,94,0.6)",
          }}>
            {isAr ? "الإجابة الصحيحة" : "Correct Answer"}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ── Wameedh brand tokens ──────────────────────────────────────────── */
const WN_BG =
  "radial-gradient(at 15% 20%, rgba(30,40,80,0.70) 0px, transparent 55%)," +
  "radial-gradient(at 82% 75%, rgba(180,145,55,0.14) 0px, transparent 50%)," +
  "linear-gradient(160deg, #060608 0%, #0d0d14 60%, #141420 100%)";
const WN_GOLD = "#D9A521";
const WN_GOLD_DIM = "rgba(217,165,33,0.18)";

/* Projector / "show" view. Anyone with the URL can watch (no auth);
   intended for a classroom screen connected to the teacher's laptop. */
export default function PresentationShow() {
  const params = useParams<{ sessionId: string }>();
  const sid = Number(params.sessionId);

  const [state, setState] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [wordCloudWords, setWordCloudWords] = useState<CloudWord[]>([]);
  const [wallCards, setWallCards] = useState<WallCard[]>([]);
  /* Track slide key for AnimatePresence — each unique slide id triggers
     the cross-fade transition without touching socket event logic. */
  const slideKeyRef = useRef<string | number>(0);

  /* Stage Mode state — ref shadows state to avoid stale closures in
     socket event handlers registered once in the useEffect. */
  const [stageMode, setStageMode] = useState(false);
  const stageModeRef = useRef(false);

  /* Dramatic reveal — revealAnswer tracks the raw flag; revealStageVisible
     is true only after the 1.5 s cinematic delay in stage mode. */
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [revealStageVisible, setRevealStageVisible] = useState(false);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Timer synchronisation — tracks when the current activity was opened.
     Provided by the server in activity:opened and state:sync so that
     reconnecting projectors show the correct remaining time. */
  const [activityOpenedAt, setActivityOpenedAt] = useState<number | null>(null);

  function clearReveal() {
    if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
    setRevealAnswer(false);
    setRevealStageVisible(false);
  }

  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    fetch(`${API_BASE}/api/p/sessions/${sid}/state`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setState)
      .catch(() => {});
  }, [sid]);

  useEffect(() => {
    if (!Number.isFinite(sid)) return;
    const s = getSocket();
    s.emit("show:join", { sessionId: sid });

    const onSync = (st: any) => {
      setLive(st);
      /* Restore stage mode from state:sync so the projector auto-applies
         the correct visual mode when reconnecting. */
      if (typeof st.stageMode === "boolean") {
        stageModeRef.current = st.stageMode;
        setStageMode(st.stageMode);
      }
      /* Restore reveal — a late-joining projector should show the badge
         immediately without the cinematic delay. */
      if (st.revealAnswer) {
        setRevealAnswer(true);
        setRevealStageVisible(true);
      }
      /* Restore timer position from server timestamp so a reconnecting
         projector shows the correct remaining time. */
      setActivityOpenedAt(typeof st.activeElementOpenedAt === "number" ? st.activeElementOpenedAt : null);
    };

    const onSlide = ({ index, slide }: { index: number; slide: any }) => {
      slideKeyRef.current = slide?.id ?? index;
      setLive((p: any) => ({
        ...(p ?? {}),
        currentSlideIndex: index,
        slide,
        activeElementId: null,
        activeElement: null,
        revealAnswer: false,
        revealDistribution: false,
      }));
      setWordCloudWords([]);
      setWallCards([]);
      clearReveal();
      setActivityOpenedAt(null);
    };

    const onOpened = ({ elementId, element, openedAt }: any) => {
      setLive((p: any) => ({ ...(p ?? {}), activeElementId: elementId, activeElement: element }));
      setWordCloudWords([]);
      setWallCards([]);
      clearReveal();
      /* Use the server-provided timestamp (or fall back to now) so the
         timer is accurate even for late-joining projectors. */
      setActivityOpenedAt(typeof openedAt === "number" ? openedAt : Date.now());
    };

    const onClosed = () => {
      setLive((p: any) => ({ ...(p ?? {}), activeElementId: null, activeElement: null }));
      setWordCloudWords([]);
      setWallCards([]);
      clearReveal();
      setActivityOpenedAt(null);
    };

    const onEnded = () => setLive((p: any) => ({ ...(p ?? {}), status: "ended" }));
    const onWordCloud = ({ words }: { words: CloudWord[] }) => setWordCloudWords(words);
    const onWall = ({ cards }: { cards: WallCard[] }) => setWallCards(cards);
    const onReconnect = () => s.emit("show:join", { sessionId: sid });

    /* Stage Mode — toggled by the teacher control panel. */
    const onStageChanged = ({ on }: { on: boolean }) => {
      stageModeRef.current = !!on;
      setStageMode(!!on);
    };

    /* Dramatic reveal — apply a 1.5 s cinematic delay in stage mode. */
    const onRevealAns = ({ on }: { on: boolean }) => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      setRevealAnswer(!!on);
      if (!on) {
        setRevealStageVisible(false);
        return;
      }
      if (stageModeRef.current) {
        setRevealStageVisible(false);
        revealTimeoutRef.current = setTimeout(() => setRevealStageVisible(true), 1500);
      } else {
        setRevealStageVisible(true);
      }
    };

    s.on("state:sync", onSync);
    s.on("slide:changed", onSlide);
    s.on("activity:opened", onOpened);
    s.on("activity:closed", onClosed);
    s.on("session:ended", onEnded);
    s.on("word_cloud:update", onWordCloud);
    s.on("wall:update", onWall);
    s.on("connect", onReconnect);
    s.on("stage:changed", onStageChanged);
    s.on("results:reveal-answer", onRevealAns);

    return () => {
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      s.off("state:sync", onSync);
      s.off("slide:changed", onSlide);
      s.off("activity:opened", onOpened);
      s.off("activity:closed", onClosed);
      s.off("session:ended", onEnded);
      s.off("word_cloud:update", onWordCloud);
      s.off("wall:update", onWall);
      s.off("connect", onReconnect);
      s.off("stage:changed", onStageChanged);
      s.off("results:reveal-answer", onRevealAns);
    };
  }, [sid]);

  const slide = live?.slide ?? state?.deck?.currentSlide ?? null;
  const pin: string | null = live?.pin ?? state?.pin ?? null;
  const inLobby = (live?.status ?? state?.status) === "lobby";
  const ended = (live?.status ?? state?.status) === "ended";
  const slideKey = slide?.id ?? live?.currentSlideIndex ?? 0;
  const activeKind: string | undefined = live?.activeElement?.activityKind ?? state?.activeElement?.activityKind;
  const isAr = state?.deck?.language !== "en";

  /* Activity-specific overlays that consume the full screen. */
  const hasActivityOverlay = !inLobby && (activeKind === "word_cloud" || activeKind === "open_wall");
  /* Show the dramatic reveal only when stage mode is on and the
     badge has cleared its 1.5 s cinematic hold. In normal mode,
     revealStageVisible is set immediately so this shows right away. */
  const showReveal = revealAnswer && revealStageVisible;

  /* ── Ended ──────────────────────────────────────────────────────── */
  if (ended) {
    return (
      <div
        dir="rtl"
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: WN_BG, fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="text-6xl mb-5">👋</div>
          <div className="text-3xl font-black text-white mb-2">انتهت الجلسة</div>
          <div className="text-base" style={{ color: "rgba(255,255,255,0.45)" }}>
            شكراً لحضور الحصة
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── Loading ────────────────────────────────────────────────────── */
  if (!state) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: WN_BG }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  /* Slide transition variants — more cinematic in Stage Mode. */
  const slideVariants = stageMode
    ? {
        initial: { opacity: 0, scale: 1.09, y: 22 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit:    { opacity: 0, scale: 0.88, y: -18 },
      }
    : {
        initial: { opacity: 0, scale: 1.025 },
        animate: { opacity: 1, scale: 1 },
        exit:    { opacity: 0, scale: 0.975 },
      };
  const slideDuration = stageMode ? 0.55 : 0.38;
  const slideEase = stageMode
    ? ([0.16, 1, 0.3, 1] as [number, number, number, number])
    : ([0.25, 0.1, 0.25, 1] as [number, number, number, number]);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 overflow-hidden"
      style={{ background: "#000" }}
    >
      {/* ── Slide with cross-fade / cinematic transition ──────── */}
      <AnimatePresence mode="wait">
        {slide && state.deck && (
          <motion.div
            key={slideKey}
            className="absolute inset-0"
            initial={slideVariants.initial}
            animate={slideVariants.animate}
            exit={slideVariants.exit}
            transition={{ duration: slideDuration, ease: slideEase }}
          >
            <SlideStage
              lang={state.deck.language}
              slide={slide}
              theme={state.deck.theme}
              pattern={state.deck.pattern}
              stageMode={stageMode}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lobby PIN screen ────────────────────────────────────── */}
      <AnimatePresence>
        {inLobby && pin && (
          <motion.div
            key="lobby"
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: WN_BG, fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Subtle corner glows */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute"
                style={{
                  top: -120, right: -120, width: 440, height: 440,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${WN_GOLD_DIM} 0%, transparent 70%)`,
                }}
              />
              <div
                className="absolute"
                style={{
                  bottom: -100, left: -100, width: 360, height: 360,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(30,60,120,0.25) 0%, transparent 70%)",
                }}
              />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center px-8 w-full max-w-3xl">
              {/* Brand wordmark */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.45 }}
                className="mb-10"
              >
                <div
                  className="text-2xl font-black tracking-widest uppercase"
                  style={{ color: WN_GOLD, letterSpacing: "0.25em" }}
                >
                  وميض
                </div>
                <div
                  className="text-xs mt-1 tracking-wider"
                  style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.18em" }}
                >
                  WAMEEDH · حصاد
                </div>
              </motion.div>

              {/* Join instruction */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mb-3"
              >
                <div
                  className="text-lg font-semibold mb-2"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  للانضمام إلى الحصة، افتح هاتفك واذهب إلى
                </div>
                <div
                  className="inline-block px-6 py-2 rounded-xl font-black text-xl"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.9)",
                    letterSpacing: "0.05em",
                  }}
                >
                  /p/join
                </div>
              </motion.div>

              {/* PIN display */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className="mt-8 mb-2"
              >
                <div
                  className="text-sm font-bold tracking-widest uppercase mb-3"
                  style={{ color: "rgba(255,255,255,0.40)", letterSpacing: "0.28em" }}
                >
                  رمز الانضمام
                </div>
                {/* PIN card */}
                <div
                  className="px-14 py-6 rounded-3xl"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `2px solid ${WN_GOLD}44`,
                    boxShadow: `0 0 60px ${WN_GOLD}18, inset 0 1px 0 rgba(255,255,255,0.07)`,
                  }}
                >
                  <div
                    className="font-black tabular-nums select-all"
                    style={{
                      fontSize: "clamp(5rem, 14vw, 10rem)",
                      lineHeight: 1,
                      color: WN_GOLD,
                      textShadow: `0 0 40px ${WN_GOLD}55, 0 0 80px ${WN_GOLD}22`,
                      letterSpacing: "0.18em",
                    }}
                  >
                    {pin}
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="mt-6 text-sm"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                في انتظار انضمام الطلاب…
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Word cloud overlay ───────────────────────────────── */}
      <AnimatePresence>
        {live?.activeElementId && !inLobby && activeKind === "word_cloud" && (
          <motion.div
            key="word-cloud-overlay"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <WordCloudOverlay words={wordCloudWords} isAr={isAr} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Open wall overlay ────────────────────────────────── */}
      <AnimatePresence>
        {live?.activeElementId && !inLobby && activeKind === "open_wall" && (
          <motion.div
            key="open-wall-overlay"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <OpenWallOverlay cards={wallCards} isAr={isAr} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage Mode: countdown timer ──────────────────────── */}
      <AnimatePresence>
        {stageMode && live?.activeElementId && !inLobby && !hasActivityOverlay && (
          <motion.div
            key={`stage-timer-${live.activeElementId}`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 19 }}
          >
            <StageTimer startedAt={activityOpenedAt} isAr={isAr} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage Mode: dramatic correct-answer reveal ────────── */}
      <AnimatePresence>
        {stageMode && showReveal && !inLobby && (
          <DramaticRevealOverlay key="stage-reveal" isAr={isAr} />
        )}
      </AnimatePresence>

      {/* ── Active activity badge ─────────────────────────────── */}
      <AnimatePresence>
        {live?.activeElementId && !inLobby && activeKind !== "word_cloud" && activeKind !== "open_wall" && (
          <motion.div
            key="activity-badge"
            className="absolute bottom-5 left-1/2"
            style={{ translateX: "-50%" }}
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 8, x: "-50%" }}
            transition={{ duration: 0.28 }}
          >
            <div
              className="rounded-full px-7 py-2.5 text-base font-black"
              style={{ background: WN_GOLD, color: "#0d0a00", boxShadow: `0 4px 24px ${WN_GOLD}55` }}
            >
              ✦ نشاط مفتوح — أجيبوا من أجهزتكم
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stage Mode indicator chip ─────────────────────────── */}
      <AnimatePresence>
        {stageMode && (
          <motion.div
            key="stage-chip"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "absolute",
              top: 16,
              insetInlineEnd: 20,
              zIndex: 22,
              pointerEvents: "none",
            }}
          >
            <div style={{
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(217,165,33,0.4)",
              borderRadius: 999,
              padding: "5px 14px",
              fontSize: 11,
              fontWeight: 800,
              color: "#D9A521",
              letterSpacing: 1,
              backdropFilter: "blur(8px)",
              fontFamily: "'Cairo', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              🎬 وضع المسرح
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
