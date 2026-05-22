/**
 * Present mode — full-screen runtime that shows a presentation deck to
 * a class. Reachable from the editor's "Start" button. Supports:
 *   • keyboard nav (←/→, space, Esc, F for fullscreen)
 *   • on-screen controls (autohide after 2.5s of mouse idle)
 *   • per-presentation language direction (RTL for Arabic)
 *   • smooth fade transitions, honoring `prefers-reduced-motion`
 *   • `?slide=N` query param to start from a specific slide
 *
 * Public viewer (`/p/:id`) wraps the same component but loads from a
 * public endpoint instead of the auth-gated one.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, X, Maximize2, Minimize2, Loader2, Play, Rocket,
  User, UsersRound, Gamepad2, Flame,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { SlideStage, type PresentActivityState } from "@/lib/slide-render";
import type { Slide, SlideElement } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";

type GameQuestion = { prompt: string; options: string[]; correctIndex: number };
type HasadGameEl = SlideElement & { questions?: GameQuestion[]; prompt?: string; topic?: string; gameKind?: string; accentColor?: string };
type HasadActivityEl = SlideElement & { assignmentId?: number; assignmentTitle?: string; gameType?: string };

let presentAudioCtx: AudioContext | null = null;

function getPresentAudioCtx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!presentAudioCtx) presentAudioCtx = new Ctor();
    if (presentAudioCtx.state === "suspended") presentAudioCtx.resume().catch(() => {});
    return presentAudioCtx;
  } catch {
    return null;
  }
}

function playPresentAnswerSound(kind: "correct" | "wrong") {
  const ctx = getPresentAudioCtx();
  if (!ctx) return;
  try {
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(kind === "correct" ? 0.22 : 0.16, ctx.currentTime + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "correct" ? 0.42 : 0.3));
    master.connect(ctx.destination);

    const notes = kind === "correct" ? [659.25, 783.99, 1046.5] : [220, 174.61];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * (kind === "correct" ? 0.075 : 0.095);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "correct" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(kind === "correct" ? 0.7 : 0.55, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "correct" ? 0.22 : 0.18));
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + (kind === "correct" ? 0.26 : 0.22));
    });
  } catch {
    // Audio feedback should never block presenting.
  }
}

/** Write activity payload to localStorage then open the runner in a new tab. */
function launchActivityRunner(el: HasadGameEl, themeKey: string | undefined) {
  const seedId = el.id ?? `run-${Date.now()}`;
  const payload = {
    gameKind: el.gameKind ?? "kahoot",
    prompt: el.topic ?? el.prompt ?? "",
    questions: el.questions ?? [],
    themeKey: themeKey ?? null,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  try {
    localStorage.setItem(`hasad:activity:${seedId}`, JSON.stringify(payload));
  } catch { /* ignore */ }
  window.open(
    `/teacher/presentations/activity-runner/${encodeURIComponent(seedId)}`,
    "_blank",
    "noopener",
  );
}

const API_BASE = import.meta.env.VITE_API_URL || "";

type DeckPayload = {
  id: number;
  title: string;
  language: "ar" | "en";
  theme: string;
  pattern: string;
  status?: "draft" | "published";
  slides: Slide[];
};

export type PresentViewProps = {
  /** When true the source endpoint is the public one, drafts return 404. */
  isPublic?: boolean;
};

export default function PresentView({ isPublic = false }: PresentViewProps) {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = params.id;

  /* Direction comes from the deck itself, not the UI locale: a teacher
     can browse the platform in English while presenting an Arabic deck. */
  const { lang: uiLang } = useI18n();

  const endpoint = isPublic
    ? `${API_BASE}/api/presentations/public/${id}`
    : `${API_BASE}/api/presentations/${id}`;

  const { data, isLoading, error } = useQuery<DeckPayload>({
    queryKey: [endpoint],
    queryFn: async () => {
      const r = await fetch(endpoint, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    retry: 0,
  });

  const slides = data?.slides ?? [];
  const total = slides.length;

  /* Initial slide can be requested via `?slide=N` (1-indexed) so the
     editor's "Start from current slide" button can deep-link in. */
  const initialIdx = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    const raw = parseInt(sp.get("slide") ?? "1", 10);
    if (!Number.isFinite(raw) || raw < 1) return 0;
    return Math.min(raw - 1, Math.max(0, total - 1));
  }, [total]);

  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [revealAnswers, setRevealAnswers] = useState(false);
  const [presentActivityState, setPresentActivityState] = useState<PresentActivityState>({
    elementId: null,
    questionIndex: 0,
    selectedIndex: null,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLaunchingActivity, setIsLaunchingActivity] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [showGameModeModal, setShowGameModeModal] = useState(false);
  const [selectedGameMode, setSelectedGameMode] = useState<"solo" | "teams" | "rocket" | "hotseat">("solo");
  const [selectedTeamCount, setSelectedTeamCount] = useState(2);
  const [activeGamePin, setActiveGamePin] = useState<string | null>(null);
  const [showGameFinishedBanner, setShowGameFinishedBanner] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setIdx(initialIdx); }, [initialIdx]);

  /* Listen for game-finished broadcast from the teacher game console tab. */
  useEffect(() => {
    if (!activeGamePin) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("hasad:presentation");
      bc.onmessage = (ev) => {
        if (ev.data?.type === "game-finished" && ev.data?.pin === activeGamePin) {
          setShowGameFinishedBanner(true);
          setActiveGamePin(null);
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => setShowGameFinishedBanner(false), 7000);
        }
      };
    } catch { /* BroadcastChannel not supported */ }
    return () => { bc?.close(); };
  }, [activeGamePin]);

  /* Dismiss banner when teacher advances the slide. */
  useEffect(() => {
    if (showGameFinishedBanner) {
      setShowGameFinishedBanner(false);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const deckLang = (data?.language ?? "ar") as "ar" | "en";
  const isAr = deckLang === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const current = slides[Math.min(idx, total - 1)];
  const currentHasRevealableAnswer = useMemo(() => {
    const elements = current?.elements ?? [];
    return elements.some((el: SlideElement) => {
      if (el.kind === "activity") {
        return (el.activityKind === "mcq" || el.activityKind === "true_false") && typeof el.correctIndex === "number";
      }
      if (el.kind === "hasad-game") {
        const questions: GameQuestion[] = Array.isArray((el as HasadGameEl).questions) ? ((el as HasadGameEl).questions ?? []) : [];
        return typeof questions[0]?.correctIndex === "number";
      }
      return false;
    });
  }, [current]);

  const goNext = useCallback(() => {
    if (currentHasRevealableAnswer && !revealAnswers) {
      setRevealAnswers(true);
      return;
    }
    setDirection("next");
    setRevealAnswers(false);
    setPresentActivityState({ elementId: null, questionIndex: 0, selectedIndex: null });
    setIdx((i) => Math.min(i + 1, total - 1));
  }, [currentHasRevealableAnswer, revealAnswers, total]);
  const goPrev = useCallback(() => {
    setDirection("prev");
    setRevealAnswers(false);
    setPresentActivityState({ elementId: null, questionIndex: 0, selectedIndex: null });
    setIdx((i) => Math.max(i - 1, 0));
  }, []);
  const handlePresentAnswerSelect = useCallback((elementId: string, answerIndex: number) => {
    const activeElement = (current?.elements ?? []).find((el: SlideElement) => el.id === elementId);
    let correctIndex: number | undefined;
    if (activeElement?.kind === "activity") {
      correctIndex = typeof activeElement.correctIndex === "number" ? activeElement.correctIndex : undefined;
    } else if (activeElement?.kind === "hasad-game") {
      const questions: GameQuestion[] = Array.isArray((activeElement as HasadGameEl).questions) ? ((activeElement as HasadGameEl).questions ?? []) : [];
      const qIndex = presentActivityState.elementId === elementId ? presentActivityState.questionIndex : 0;
      correctIndex = questions[qIndex]?.correctIndex;
    }
    if (typeof correctIndex === "number") {
      playPresentAnswerSound(answerIndex === correctIndex ? "correct" : "wrong");
    }
    setRevealAnswers(true);
    setPresentActivityState((prev) => ({
      elementId,
      questionIndex: prev.elementId === elementId ? prev.questionIndex : 0,
      selectedIndex: answerIndex,
    }));
  }, [current, presentActivityState.elementId, presentActivityState.questionIndex]);
  const handlePresentNextQuestion = useCallback((elementId: string) => {
    setRevealAnswers(false);
    setPresentActivityState((prev) => ({
      elementId,
      questionIndex: prev.elementId === elementId ? prev.questionIndex + 1 : 0,
      selectedIndex: null,
    }));
  }, []);
  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (isPublic) {
      /* Public viewer has nowhere obvious to go back to — close the tab
         if we opened it, otherwise route to the platform root. */
      window.close();
      setTimeout(() => setLocation("/"), 50);
    } else {
      setLocation(`/teacher/presentations/${id}`);
    }
  }, [id, isPublic, setLocation]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* user-gesture / unsupported — ignore */ }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* Arrow keys are flipped for RTL so ← always means "previous in
     reading order" regardless of language. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      switch (e.key) {
        case "ArrowRight": e.preventDefault(); (isAr ? goPrev : goNext)(); break;
        case "ArrowLeft":  e.preventDefault(); (isAr ? goNext : goPrev)(); break;
        case " ":
        case "PageDown":   e.preventDefault(); goNext(); break;
        case "PageUp":     e.preventDefault(); goPrev(); break;
        case "Home":       e.preventDefault(); setRevealAnswers(false); setIdx(0); break;
        case "End":        e.preventDefault(); setRevealAnswers(false); setIdx(Math.max(0, total - 1)); break;
        case "Escape":     e.preventDefault(); exit(); break;
        case "f":
        case "F":          e.preventDefault(); void toggleFullscreen(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAr, goNext, goPrev, exit, toggleFullscreen, total]);

  /* Autohide controls after idle, restore on any pointer move. */
  useEffect(() => {
    const onMove = () => {
      setShowControls(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setShowControls(false), 2500);
    };
    onMove();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  const progress = total > 1 ? ((idx + 1) / total) * 100 : 100;

  /* Detect if the current slide has a hasad-game element with questions
     so we can surface a "Launch activity" button in the control bar. */
  const activeGameEl = useMemo<HasadGameEl | null>(() => {
    if (!current?.elements) return null;
    const el = (current.elements as SlideElement[]).find(
      (e) => e.kind === "hasad-game" && Array.isArray((e as HasadGameEl).questions) && ((e as HasadGameEl).questions?.length ?? 0) > 0,
    );
    return (el as HasadGameEl) ?? null;
  }, [current]);

  /* Detect if the current slide has a hasad-activity element (linked assignment). */
  const activeActivityEl = useMemo<HasadActivityEl | null>(() => {
    if (!current?.elements) return null;
    const el = (current.elements as SlideElement[]).find(
      (e) => e.kind === "hasad-activity" && typeof (e as HasadActivityEl).assignmentId === "number",
    );
    return (el as HasadActivityEl) ?? null;
  }, [current]);

  /** Show the game-mode picker modal instead of immediately launching. */
  const launchHasadActivity = useCallback(() => {
    if (!activeActivityEl?.assignmentId || isLaunchingActivity) return;
    setSelectedGameMode("solo");
    setSelectedTeamCount(2);
    setShowGameModeModal(true);
  }, [activeActivityEl, isLaunchingActivity]);

  const createWameethSession = useCallback((assignmentId: number, hackMode = false) => {
    const gameTab = window.open("", "_blank", "noopener");
    setIsLaunchingActivity(true);
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      { assignmentId, gameMode: "solo", hackMode: hackMode || undefined },
      (res: { pin?: string; error?: string }) => {
        setIsLaunchingActivity(false);
        if (res.error || !res.pin) {
          gameTab?.close();
          disconnectSocket();
          alert(isAr ? "تعذّر إنشاء اللعبة. حاول مرة أخرى." : "Could not create game session. Please try again.");
          return;
        }
        setActivePin(res.pin);
        setActiveGamePin(res.pin);
        if (gameTab) {
          gameTab.location.href = `/teacher/game/${encodeURIComponent(res.pin)}`;
        } else {
          setLocation(`/teacher/game/${encodeURIComponent(res.pin)}`);
        }
      },
    );
  }, [isAr, setLocation]);

  /** If the editor already stored a game type, launch it directly. */
  const launchSelectedHasadGame = useCallback(() => {
    if (!activeActivityEl?.assignmentId || isLaunchingActivity) return;
    const assignmentId = activeActivityEl.assignmentId;
    const gameType = activeActivityEl.gameType ?? "knowledge_race";

    if (gameType === "rocket_race") {
      window.open(`/game/rocket/create?assignmentId=${assignmentId}`, "_blank", "noopener");
      return;
    }
    if (gameType === "tug_of_war") {
      window.open(`/game/tug/create?assignmentId=${assignmentId}`, "_blank", "noopener");
      return;
    }
    if (gameType === "million") {
      window.open(`/game/million?assignmentId=${assignmentId}`, "_blank", "noopener");
      return;
    }
    if (gameType === "hack") {
      createWameethSession(assignmentId, true);
      return;
    }
    /* wheel currently runs through Wameeth-compatible questions until a
       dedicated wheel route exists for presentation launch. */
    createWameethSession(assignmentId, false);
  }, [activeActivityEl, createWameethSession, isLaunchingActivity]);

  /** Confirm the game-mode selection and launch the appropriate game session.
   *
   *  - solo / teams  → teacher:create-game socket → /teacher/game/:pin
   *  - rocket        → navigate to /game/rocket/create?assignmentId=...
   *  - hotseat       → navigate to /game/hotseat/create
   *
   *  For socket-based modes, the blank tab is opened synchronously inside
   *  the user-gesture handler so popup blockers treat it as trusted. */
  const confirmLaunchActivity = useCallback(() => {
    if (!activeActivityEl?.assignmentId || isLaunchingActivity) return;
    setShowGameModeModal(false);

    if (selectedGameMode === "rocket") {
      window.open(
        `/game/rocket/create?assignmentId=${activeActivityEl.assignmentId}`,
        "_blank",
        "noopener",
      );
      return;
    }

    if (selectedGameMode === "hotseat") {
      window.open("/game/hotseat/create", "_blank", "noopener");
      return;
    }

    /* solo / teams — use the socket to create a game session then open
       the teacher console in the pre-opened tab. */
    const gameTab = window.open("", "_blank", "noopener");
    setIsLaunchingActivity(true);
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      {
        assignmentId: activeActivityEl.assignmentId,
        gameMode: selectedGameMode,
        teamCount: selectedGameMode === "teams" ? selectedTeamCount : undefined,
      },
      (res: { pin?: string; error?: string }) => {
        setIsLaunchingActivity(false);
        if (res.error || !res.pin) {
          gameTab?.close();
          disconnectSocket();
          alert(isAr ? "تعذّر إنشاء اللعبة. حاول مرة أخرى." : "Could not create game session. Please try again.");
          return;
        }
        /* Show the PIN overlay on the slide so students can join without
           the teacher switching windows. The teacher console still opens
           in the background tab as before. */
        setActivePin(res.pin);
        setActiveGamePin(res.pin);
        if (gameTab) {
          gameTab.location.href = `/teacher/game/${encodeURIComponent(res.pin)}`;
        } else {
          setLocation(`/teacher/game/${encodeURIComponent(res.pin)}`);
        }
      },
    );
  }, [activeActivityEl, isLaunchingActivity, selectedGameMode, selectedTeamCount, isAr, setLocation]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    /* Drafts return 404 from the public endpoint — show a friendly
       message rather than a raw error. */
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white p-6 text-center" dir={dir}>
        <div>
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-2">
            {uiLang === "ar" ? "تعذّر فتح العرض" : "Could not open presentation"}
          </h1>
          <p className="text-white/70">
            {uiLang === "ar"
              ? "العرض غير موجود أو لم يُنشر بعد."
              : "This presentation does not exist or has not been published yet."}
          </p>
        </div>
      </div>
    );
  }
  if (total === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white" dir={dir}>
        {isAr ? "لا توجد شرائح" : "No slides"}
      </div>
    );
  }

  return (
    <div
      dir={dir}
      lang={deckLang}
      className="fixed inset-0 bg-black select-none overflow-hidden"
      style={{ cursor: showControls ? "default" : "none", touchAction: "manipulation" }}
    >
      {/* Direction-aware transition: slide enters from the side that
          matches the navigation direction, in reading order (RTL flips
          the X delta). Keyed on slide id so React fully remounts and
          the CSS animation re-runs. `prefers-reduced-motion` users get
          an instant cut via the `motion-safe:` utility. */}
      <div
        key={current?.id ?? idx}
        className="absolute inset-0 flex items-center justify-center motion-safe:animate-[slideEnter_.32s_ease-out]"
        style={{
          zIndex: 10,
          /* CSS var consumed by the keyframe; sign flipped for RTL so
             "next" always animates in from the leading edge. */
          ["--slide-dx" as string]:
            direction === "next"
              ? (isAr ? "-32px" : "32px")
              : (isAr ? "32px" : "-32px"),
        }}
      >
        {current && (
          <SlideStage lang={deckLang}
            slide={current}
            theme={data.theme}
            pattern={data.pattern}
            revealAnswers={revealAnswers}
            presentActivityState={presentActivityState}
            presentActivityHandlers={{
              onSelectAnswer: handlePresentAnswerSelect,
              onNextQuestion: handlePresentNextQuestion,
            }}
          />
        )}

        {/* Activity launch button — overlaid at the top corner of the slide
            so it feels attached to the activity card, not a distant toolbar. */}
        {(activeGameEl || activeActivityEl) && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: 14,
              [isAr ? "left" : "right"]: 12,
              zIndex: 25,
              opacity: showControls ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          >
            {activeGameEl && (
              <button
                type="button"
                onClick={() => launchActivityRunner(activeGameEl, data.theme)}
                className="pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "rgba(34,87,57,0.92)",
                  border: "1.5px solid rgba(217,165,33,0.55)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Play className="w-4 h-4 fill-white" />
                {isAr ? "إطلاق اللعبة الآن" : "Launch game"}
              </button>
            )}
            {activeActivityEl && (
              <button
                type="button"
                onClick={activeActivityEl.gameType ? launchSelectedHasadGame : launchHasadActivity}
                disabled={isLaunchingActivity}
                className="pointer-events-auto flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "rgba(217,165,33,0.95)",
                  color: "#1f2937",
                  border: "1.5px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
                  backdropFilter: "blur(10px)",
                }}
              >
                {isLaunchingActivity
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Rocket className="w-4 h-4" />}
                {isAr ? "إطلاق اللعبة الآن" : "Launch activity"}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideEnter {
          from { opacity: 0; transform: translateX(var(--slide-dx, 0)); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes bannerSlideIn {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* PIN + QR overlay — shown after a hasad-activity is launched so
          students can join without the teacher switching windows. The
          teacher can dismiss it once everyone has joined. Clicking outside
          the card does NOT dismiss it (accidental taps during navigation),
          only the explicit × button does. */}
      {activePin && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 40 }}
        >
          <div
            className="pointer-events-auto"
            style={{
              background: "rgba(0,0,0,0.82)",
              backdropFilter: "blur(12px)",
              borderRadius: 24,
              padding: "32px 40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              border: "1.5px solid rgba(217,165,33,0.35)",
              minWidth: 320,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 16 }}>
              <div style={{
                color: "#D9A521", fontWeight: 900, fontSize: 15, letterSpacing: 1, textTransform: "uppercase",
              }}>
                {isAr ? "رمز الانضمام" : "Join Code"}
              </div>
              <button
                onClick={() => setActivePin(null)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none", cursor: "pointer",
                  borderRadius: "50%", width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white",
                }}
                title={isAr ? "إخفاء" : "Dismiss"}
              >
                <X size={16} />
              </button>
            </div>

            {/* QR code */}
            <div style={{
              background: "white",
              borderRadius: 16,
              padding: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}>
              <QRCodeSVG
                value={`${window.location.origin}/game/join/${activePin}`}
                size={160}
                fgColor="#1f2937"
                bgColor="#ffffff"
                level="M"
              />
            </div>

            {/* PIN digits */}
            <div style={{
              color: "white",
              fontFamily: "monospace",
              fontSize: 60,
              fontWeight: 900,
              letterSpacing: 12,
              lineHeight: 1,
              textShadow: "0 2px 12px rgba(0,0,0,0.5)",
            }}>
              {activePin}
            </div>

            {/* Instruction */}
            <div style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 13,
              fontWeight: 500,
              textAlign: "center",
              maxWidth: 260,
            }}>
              {isAr
                ? "امسح الرمز أو اكتب الرمز على hasadx.com"
                : "Scan the code or go to hasadx.com and enter the PIN"}
            </div>
          </div>
        </div>
      )}

      {/* Game-finished banner */}
      {showGameFinishedBanner && (
        <div
          className="absolute top-6 inset-x-0 flex justify-center z-50 pointer-events-none"
          style={{ animation: "bannerSlideIn .35s ease-out" }}
        >
          <div
            className="flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl text-white font-bold text-lg"
            style={{ background: "linear-gradient(135deg, #225739 0%, #1a4229 100%)", border: "1.5px solid #D9A52166", backdropFilter: "blur(8px)" }}
          >
            <span className="text-2xl">✅</span>
            <span dir="rtl">
              {isAr ? "النشاط انتهى — انتقل للشريحة التالية" : "Activity finished — advance to next slide"}
            </span>
          </div>
        </div>
      )}

      {/* Top progress bar */}
      <div
        className="absolute top-0 inset-x-0 h-1 bg-white/10 transition-opacity"
        style={{ opacity: showControls ? 1 : 0 }}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${progress}%`, background: "#D9A521" }}
        />
      </div>

      {/* Tap zones — mapped to reading order so the side closer to
          the start-of-line goes "previous" and the trailing side
          goes "next". For Arabic (RTL) that means tapping the right
          edge moves backward and tapping the left edge advances —
          matching the reading flow and the on-screen chevrons in
          the bottom control bar (which already flip for RTL). The
          zones sit outside the top progress bar and bottom controls
          so those stay clickable. */}
      <button
        type="button"
        aria-label={isAr ? "السابق" : "Previous"}
        onClick={goPrev}
        className={`absolute top-12 bottom-20 w-1/3 ${isAr ? "right-0 cursor-e-resize" : "left-0 cursor-w-resize"}`}
        style={{ zIndex: currentHasRevealableAnswer ? 5 : 20 }}
      />
      <button
        type="button"
        aria-label={isAr ? "التالي" : "Next"}
        onClick={goNext}
        className={`absolute top-12 bottom-20 w-1/3 ${isAr ? "left-0 cursor-w-resize" : "right-0 cursor-e-resize"}`}
        style={{ zIndex: currentHasRevealableAnswer ? 5 : 20 }}
      />

      {/* Game mode picker modal */}
      {showGameModeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowGameModeModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
            dir={dir}
          >
            <div className="text-center mb-5">
              <Gamepad2 className="w-10 h-10 text-purple-500 mx-auto mb-2" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                {isAr ? "وضع اللعب" : "Game Mode"}
              </h3>
              {activeActivityEl?.assignmentTitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                  {activeActivityEl.assignmentTitle}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {(
                [
                  {
                    key: "solo" as const,
                    icon: <User className="w-6 h-6 mx-auto mb-1" />,
                    labelAr: "فردي",
                    labelEn: "Individual",
                    descAr: "كل لاعب يتنافس لوحده",
                    descEn: "Every player alone",
                  },
                  {
                    key: "teams" as const,
                    icon: <UsersRound className="w-6 h-6 mx-auto mb-1" />,
                    labelAr: "فرق",
                    labelEn: "Teams",
                    descAr: "اللاعبون في فرق",
                    descEn: "Players divided into teams",
                  },
                  {
                    key: "rocket" as const,
                    icon: <Rocket className="w-6 h-6 mx-auto mb-1" />,
                    labelAr: "سباق الصواريخ",
                    labelEn: "Rocket Race",
                    descAr: "تنافس بالصواريخ",
                    descEn: "Race to the finish",
                  },
                  {
                    key: "hotseat" as const,
                    icon: <Flame className="w-6 h-6 mx-auto mb-1" />,
                    labelAr: "الكرسي الساخن",
                    labelEn: "Hot Seat",
                    descAr: "طالب يجيب وزملاؤه يصوّتون",
                    descEn: "One student, class votes",
                  },
                ] as const
              ).map(({ key, icon, labelAr, labelEn, descAr, descEn }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedGameMode(key)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    selectedGameMode === key
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:border-purple-300"
                  }`}
                >
                  {icon}
                  <p className="font-black text-sm">{isAr ? labelAr : labelEn}</p>
                  <p className="text-xs mt-0.5 opacity-70">{isAr ? descAr : descEn}</p>
                </button>
              ))}
            </div>

            {selectedGameMode === "teams" && (
              <div className="mb-5">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 text-center">
                  {isAr ? "عدد الفرق" : "Number of Teams"}
                </label>
                <div className="flex justify-center gap-2">
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelectedTeamCount(n)}
                      className={`w-10 h-10 rounded-xl font-black text-base transition-all ${
                        selectedTeamCount === n
                          ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowGameModeModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={confirmLaunchActivity}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black shadow-lg shadow-green-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <Gamepad2 className="w-5 h-5" />
                {isAr ? "ابدأ اللعبة!" : "Start Game!"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      <div
        className="absolute bottom-0 inset-x-0 px-4 pb-4 pt-8 bg-gradient-to-t from-black/70 to-transparent transition-opacity"
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}
      >
        <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
          <button
            onClick={exit}
            className="rounded-full bg-white/10 hover:bg-white/20 text-white p-2"
            title={isAr ? "إنهاء (Esc)" : "Exit (Esc)"}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={idx === 0}
              className="rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white p-2"
              title={isAr ? "السابق" : "Previous"}
            >
              {isAr ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            <div className="text-white text-sm font-mono tabular-nums px-3 py-1.5 rounded bg-white/10 min-w-[5ch] text-center">
              {idx + 1} / {total}
            </div>
            <button
              onClick={goNext}
              disabled={idx >= total - 1}
              className="rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white p-2"
              title={isAr ? "التالي" : "Next"}
            >
              {isAr ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="rounded-full bg-white/10 hover:bg-white/20 text-white p-2"
              title={isAr ? "ملء الشاشة (F)" : "Fullscreen (F)"}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
