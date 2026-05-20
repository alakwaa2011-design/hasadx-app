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
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { SlideStage } from "@/lib/slide-render";
import type { Slide, SlideElement } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";

type GameQuestion = { prompt: string; options: string[]; correctIndex: number };
type HasadGameEl = SlideElement & { questions?: GameQuestion[]; prompt?: string; topic?: string; gameKind?: string; accentColor?: string };
type HasadActivityEl = SlideElement & { assignmentId?: number; assignmentTitle?: string };

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLaunchingActivity, setIsLaunchingActivity] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setIdx(initialIdx); }, [initialIdx]);

  const deckLang = (data?.language ?? "ar") as "ar" | "en";
  const isAr = deckLang === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const goNext = useCallback(() => {
    setDirection("next");
    setIdx((i) => Math.min(i + 1, total - 1));
  }, [total]);
  const goPrev = useCallback(() => {
    setDirection("prev");
    setIdx((i) => Math.max(i - 1, 0));
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
        case "Home":       e.preventDefault(); setIdx(0); break;
        case "End":        e.preventDefault(); setIdx(Math.max(0, total - 1)); break;
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

  const current = slides[Math.min(idx, total - 1)];
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

  /** Create a live game session from the linked assignment, then navigate
   *  the pre-opened tab to the teacher game console.
   *
   *  The blank tab is opened synchronously inside the user-gesture handler
   *  so browsers don't block it as a popup. The socket callback then sets
   *  the tab's URL once the PIN is returned. */
  const launchHasadActivity = useCallback(() => {
    if (!activeActivityEl?.assignmentId || isLaunchingActivity) return;

    /* Open the tab now, inside the synchronous user-gesture, so popup
       blockers treat it as trusted. We'll set the URL in the callback. */
    const gameTab = window.open("", "_blank", "noopener");

    setIsLaunchingActivity(true);
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      { assignmentId: activeActivityEl.assignmentId, gameMode: "kahoot" },
      (res: { pin?: string; error?: string }) => {
        setIsLaunchingActivity(false);
        if (res.error || !res.pin) {
          gameTab?.close();
          disconnectSocket();
          /* Brief visible error so the teacher knows the launch failed. */
          alert(isAr ? "تعذّر إنشاء اللعبة. حاول مرة أخرى." : "Could not create game session. Please try again.");
          return;
        }
        /* Show the PIN overlay on the slide so students can join without
           the teacher switching windows. The teacher console still opens
           in the background tab as before. */
        setActivePin(res.pin);
        if (gameTab) {
          gameTab.location.href = `/teacher/game/${encodeURIComponent(res.pin)}`;
        } else {
          /* Fallback: tab was blocked despite the synchronous open — use same tab. */
          setLocation(`/teacher/game/${encodeURIComponent(res.pin)}`);
        }
      },
    );
  }, [activeActivityEl, isLaunchingActivity, isAr, setLocation]);

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
          />
        )}
      </div>

      <style>{`
        @keyframes slideEnter {
          from { opacity: 0; transform: translateX(var(--slide-dx, 0)); }
          to   { opacity: 1; transform: translateX(0); }
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
      />
      <button
        type="button"
        aria-label={isAr ? "التالي" : "Next"}
        onClick={goNext}
        className={`absolute top-12 bottom-20 w-1/3 ${isAr ? "left-0 cursor-w-resize" : "right-0 cursor-e-resize"}`}
      />

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
            {activeGameEl && (
              <button
                onClick={() => launchActivityRunner(activeGameEl, data.theme)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
                style={{ background: "#225739", border: "1px solid #D9A52166" }}
                title={isAr ? "تشغيل النشاط التفاعلي" : "Launch activity"}
              >
                <Play className="w-4 h-4 fill-white" />
                {isAr
                  ? `نشاط · ${activeGameEl.questions?.length ?? 0} سؤال`
                  : `Activity · ${activeGameEl.questions?.length ?? 0} Q`}
              </button>
            )}
            {activeActivityEl && (
              <button
                onClick={launchHasadActivity}
                disabled={isLaunchingActivity}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "#D9A521", border: "1px solid #ffffff33", color: "#1f2937" }}
                title={isAr ? "تشغيل نشاط حصاد" : "Launch Hasad activity"}
              >
                {isLaunchingActivity
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Rocket className="w-4 h-4" />}
                {isAr
                  ? (activeActivityEl.assignmentTitle
                      ? `تشغيل · ${activeActivityEl.assignmentTitle}`
                      : "تشغيل النشاط")
                  : (activeActivityEl.assignmentTitle
                      ? `Launch · ${activeActivityEl.assignmentTitle}`
                      : "Launch Activity")}
              </button>
            )}
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
