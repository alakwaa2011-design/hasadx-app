// ─────────────────────────────────────────────────────────────────────────────
// «قبو حصاد» — DEVICE MODE student page.
// Join with PIN + name → wait in the lobby → the teacher seals the doors →
// each student runs their OWN escape locally (engine on-device) and streams
// progress snapshots to the teacher's live board.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import { toast } from "@/components/ui/sonner";
import {
  createEscapeState, escapeReducer, escapeScore,
  type EscapeAction, type EscapeState, type EscapeQuestion,
} from "@/lib/escape-engine";
import {
  EscapeSoundEngine, EscapeGameView, EscapeEndStats, VaultBackdrop,
  TreasureBurst, ESCAPE_BG, GOLD,
} from "@/components/game/escape-shared";

interface RoomConfig {
  questions: EscapeQuestion[];
  totalTime: number;
  lockCount: number;
  hints: number;
  title?: string;
}

type Phase = "enter" | "joining" | "lobby" | "ready" | "playing" | "done";

export default function EscapePlay() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const [, setLocation] = useLocation();

  const urlPin = new URLSearchParams(window.location.search).get("pin") || "";
  const [pin, setPin] = useState(urlPin);
  const [name, setName] = useState(() => {
    try { return localStorage.getItem("escape-player-name") || ""; } catch { return ""; }
  });
  const [phase, setPhase] = useState<Phase>("enter");
  const [config, setConfig] = useState<RoomConfig | null>(null);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [lobbyCount, setLobbyCount] = useState(0);
  const [muted, setMuted] = useState(false);

  const soundRef = useRef<EscapeSoundEngine | null>(null);
  const getSound = useCallback((): EscapeSoundEngine => {
    if (!soundRef.current) soundRef.current = new EscapeSoundEngine();
    return soundRef.current;
  }, []);
  useEffect(() => () => { soundRef.current?.destroy(); soundRef.current = null; }, []);

  // Engine: created when the room config arrives, started on the student's tap.
  const [state, rawDispatch] = useReducer(
    (s: EscapeState | null, a: EscapeAction | { type: "__init"; state: EscapeState }): EscapeState | null => {
      if (a.type === "__init") return a.state;
      return s ? escapeReducer(s, a) : s;
    },
    null,
  );
  const dispatch = useCallback((a: EscapeAction) => rawDispatch(a), []);

  // ── Socket wiring ──
  const joinedRef = useRef(false);
  const join = useCallback((p: string, n: string) => {
    setPhase("joining");
    const socket = getSocket();
    socket.emit("escape:join", { pin: p, name: n },
      (res: { ok?: boolean; error?: string; title?: string; state?: string; config?: RoomConfig }) => {
        if (!res?.ok) {
          setPhase("enter");
          toast.error(res?.error === "not-found"
            ? (ar ? "لم نجد قبواً بهذا الرمز" : "No vault with this PIN")
            : (ar ? "أدخل اسمك أولاً" : "Enter your name first"));
          return;
        }
        joinedRef.current = true;
        setTitle(res.title);
        try { localStorage.setItem("escape-player-name", n); } catch (_) { /* ignore */ }
        if (res.state === "playing" && res.config) {
          setConfig(res.config);
          rawDispatch({
            type: "__init",
            state: createEscapeState({
              questions: res.config.questions, totalTime: res.config.totalTime,
              lockCount: res.config.lockCount, hints: res.config.hints,
            }),
          });
          setPhase("ready");
        } else {
          setPhase("lobby");
        }
      });
  }, [ar]);

  useEffect(() => {
    const socket = getSocket();
    const onStarted = (data: { config?: RoomConfig }) => {
      if (!data?.config) return;
      setConfig(data.config);
      rawDispatch({
        type: "__init",
        state: createEscapeState({
          questions: data.config.questions, totalTime: data.config.totalTime,
          lockCount: data.config.lockCount, hints: data.config.hints,
        }),
      });
      setPhase((p) => (p === "lobby" ? "ready" : p));
    };
    const onLobbyCount = (data: { count?: number }) => {
      if (typeof data?.count === "number") setLobbyCount(data.count);
    };
    const onEnded = () => {
      toast(ar ? "أنهى المعلم الجلسة" : "The teacher ended the session");
      setLocation("/");
    };
    const onReconnect = () => {
      // Same name ⇒ the server resumes our player record silently.
      if (joinedRef.current && pin && name.trim()) {
        socket.emit("escape:join", { pin, name: name.trim() }, () => {});
      }
    };
    socket.on("escape:started", onStarted);
    socket.on("escape:lobby-count", onLobbyCount);
    socket.on("escape:ended", onEnded);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("escape:started", onStarted);
      socket.off("escape:lobby-count", onLobbyCount);
      socket.off("escape:ended", onEnded);
      socket.off("connect", onReconnect);
    };
  }, [ar, pin, name, setLocation]);

  // ── Stream progress snapshots to the teacher's board ──
  const lastSnapshot = useRef("");
  useEffect(() => {
    if (!state || phase !== "playing" && phase !== "done") return;
    const snapshot = {
      locksOpen: state.locks.filter((l) => l.open).length,
      correct: state.correctCount,
      wrong: state.wrongCount,
      score: escapeScore(state),
      timeLeft: state.timeLeft,
      status: state.status === "won" ? "won" : state.status === "lost" ? "lost" : "playing",
    };
    const key = JSON.stringify(snapshot);
    if (key === lastSnapshot.current) return;
    lastSnapshot.current = key;
    getSocket().emit("escape:progress", snapshot);
  }, [state, phase]);

  // ── End transitions + stingers (the game view unmounts on the final render,
  //    so the page owns the victory fanfare and the time-up slam) ──
  useEffect(() => {
    if (!state) return;
    if ((state.status === "won" || state.status === "lost") && phase === "playing") {
      if (state.status === "lost") getSound().playTimeUp();
      else {
        getSound().playVaultOpen();
        try { navigator.vibrate?.([60, 40, 60, 40, 120]); } catch (_) { /* ignore */ }
      }
      setPhase("done");
    }
  }, [state, phase, getSound]);

  const toggleMute = () => {
    const s = getSound();
    s.setMuted(!s.muted);
    setMuted(s.muted);
    if (!s.muted && state?.status === "playing") { s.startAmbient(); s.startMusic(); }
  };

  const beginRun = () => {
    getSound().playStart();          // tap = audio-unlock gesture
    dispatch({ type: "start" });
    setPhase("playing");
  };

  const displayTitle = title || (ar ? "غرفة الهروب" : "Escape Room");

  return (
    <div className="relative flex min-h-screen flex-col select-none text-white" dir={dir} style={{ background: ESCAPE_BG }}>
      <VaultBackdrop danger={phase === "playing" && !!state && state.timeLeft <= 60} />
      {phase === "done" && state?.status === "won" && <TreasureBurst />}

      {(phase === "playing" || phase === "done") && (
        <button onClick={toggleMute}
          className="fixed top-3 z-50 rounded-full border border-white/20 bg-black/35 p-2 text-white/80 backdrop-blur-sm"
          style={{ insetInlineEnd: 12 }}
          aria-label={muted ? "unmute" : "mute"}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {/* ── ENTER: PIN + name ── */}
      {(phase === "enter" || phase === "joining") && (
        <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border-2 border-amber-300/40 text-5xl"
            style={{ background: "rgba(247,201,72,0.1)", boxShadow: "0 0 42px rgba(247,201,72,0.3)" }}>
            🔐
          </motion.div>
          <h1 className="text-2xl font-black" style={{ textShadow: "0 0 22px rgba(247,201,72,0.35)" }}>
            {ar ? "غرفة الهروب" : "Escape Room"}
          </h1>
          <p className="-mt-2 text-sm font-bold text-white/60">
            {ar ? "أدخل الرمز واسمك للانضمام إلى غرفة الهروب" : "Enter the PIN and your name to join the escape room"}
          </p>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder={ar ? "رمز الغرفة" : "Room PIN"}
            inputMode="numeric" dir="ltr"
            className="w-full rounded-2xl border-2 border-white/20 bg-black/40 px-4 py-3.5 text-center text-2xl font-black tracking-[0.3em] text-amber-200 outline-none backdrop-blur-sm placeholder:text-base placeholder:tracking-normal placeholder:text-white/30 focus:border-amber-300/60"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 30))}
            placeholder={ar ? "اسمك" : "Your name"}
            className="w-full rounded-2xl border-2 border-white/20 bg-black/40 px-4 py-3.5 text-center text-lg font-black outline-none backdrop-blur-sm placeholder:text-base placeholder:text-white/30 focus:border-amber-300/60"
          />
          <motion.button whileTap={{ scale: 0.97 }}
            disabled={phase === "joining" || pin.length < 4 || !name.trim()}
            onClick={() => join(pin, name.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-black text-[#1a2e1a] disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
              boxShadow: "0 14px 32px rgba(217,165,33,0.45), inset 0 2px 0 rgba(255,255,255,0.32)",
            }}>
            {phase === "joining" ? <Loader2 className="h-5 w-5 animate-spin" /> : "🚪"}
            {ar ? "ادخل القبو" : "Enter the vault"}
          </motion.button>
        </div>
      )}

      {/* ── LOBBY: waiting for the teacher ── */}
      {phase === "lobby" && (
        <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
          <motion.div animate={{ rotate: [0, -6, 6, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}
            className="text-6xl">🗝️</motion.div>
          <h2 className="text-xl font-black">{ar ? `أهلاً ${name.trim()}!` : `Welcome, ${name.trim()}!`}</h2>
          <p className="mx-auto w-fit max-w-full truncate rounded-full border border-amber-300/30 bg-black/35 px-4 py-1 text-sm font-black text-amber-200">
            📖 {displayTitle}
          </p>
          <p className="text-sm font-bold leading-relaxed text-white/60">
            {ar
              ? "أنت داخل القبو الآن… بانتظار أن يغلق المعلم الأبواب ويبدأ الهروب."
              : "You're inside the vault… waiting for the teacher to seal the doors and start."}
          </p>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black">
            <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>🟢</motion.span>
            {lobbyCount > 0
              ? (ar ? `${lobbyCount} داخل القبو` : `${lobbyCount} in the vault`)
              : (ar ? "متصل" : "Connected")}
          </div>
        </div>
      )}

      {/* ── READY: personal start gate (also unlocks audio) ── */}
      {phase === "ready" && state && config && (
        <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-5 text-center">
          <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}
            className="text-6xl">🚨</motion.div>
          <h2 className="text-2xl font-black text-amber-200">{ar ? "الأبواب أُغلقت!" : "The doors are sealed!"}</h2>
          <p className="text-sm font-bold leading-relaxed text-white/65">
            {ar
              ? `أمامك ${state.locks.length} أقفال و${Math.round(config.totalTime / 60)} دقائق. كل خطأ يحرق 15 ثانية. جاهز؟`
              : `${state.locks.length} locks, ${Math.round(config.totalTime / 60)} minutes. Every mistake burns 15 seconds. Ready?`}
          </p>
          <motion.button whileTap={{ scale: 0.96 }}
            animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 1.3 }}
            onClick={beginRun}
            className="w-full rounded-2xl py-4 text-lg font-black text-[#1a2e1a]"
            style={{
              background: "linear-gradient(135deg, #f7c948 0%, #f59e0b 48%, #d97706 100%)",
              boxShadow: "0 14px 32px rgba(217,165,33,0.5), inset 0 2px 0 rgba(255,255,255,0.32)",
            }}>
            🏃 {ar ? "ابدأ الهروب الآن!" : "Start escaping now!"}
          </motion.button>
        </div>
      )}

      {/* ── PLAYING ── */}
      {phase === "playing" && state && state.status === "playing" && (
        <>
          <div className="relative z-10 flex justify-center pt-3">
            <p className="w-fit max-w-[80vw] truncate rounded-full border border-amber-300/40 bg-black/50 px-5 py-1 text-center text-xs font-black text-amber-100 backdrop-blur-md sm:text-sm"
              title={displayTitle}>
              🔐 {displayTitle} — {name.trim()}
            </p>
          </div>
          <EscapeGameView state={state} dispatch={dispatch} sound={getSound()} ar={ar} variant="solo" />
        </>
      )}

      {/* ── DONE: personal result ── */}
      {phase === "done" && state && (
        <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full">
            {state.status === "won" ? (
              <>
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                  className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[1.8rem] border border-amber-300/50 bg-white/10 text-5xl shadow-[0_0_42px_rgba(217,165,33,0.5)]">
                  🏆
                </motion.div>
                <h2 className="mb-1 text-3xl font-black" style={{ color: GOLD, textShadow: "0 0 24px rgba(247,201,72,0.6)" }}>
                  {ar ? "هربت من القبو!" : "You escaped!"}
                </h2>
              </>
            ) : (
              <>
                <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-[1.8rem] border border-white/20 bg-white/5 text-5xl">
                  ⛓️
                </div>
                <h2 className="mb-1 text-3xl font-black text-red-300">
                  {ar ? "القبو أُغلق عليك!" : "The vault sealed you in!"}
                </h2>
              </>
            )}
            <p className="mb-4 text-sm font-bold text-white/65">
              {state.status === "won"
                ? (ar ? "أحسنت! نتيجتك وصلت للمعلم مباشرة 🎉" : "Well done! Your result is live on the teacher's board 🎉")
                : (ar ? "لا بأس — نتيجتك وصلت للمعلم، والجولة القادمة لك 💪" : "Your result reached the teacher — next round is yours 💪")}
            </p>

            <div className="mx-auto mb-4 w-fit rounded-2xl border-2 border-amber-300/45 bg-black/50 px-8 py-2.5">
              <p className="text-[11px] font-black text-white/55">{ar ? "نقاطك" : "Your score"}</p>
              <p className="text-4xl font-black" style={{ color: GOLD, fontVariantNumeric: "tabular-nums" }}>
                {escapeScore(state)}
              </p>
            </div>

            <div className="mb-5"><EscapeEndStats state={state} ar={ar} /></div>

            <p className="text-xs font-bold text-white/40">
              {ar ? "تابع الشاشة الكبيرة لترتيب الفصل النهائي" : "Watch the big screen for the class ranking"}
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
