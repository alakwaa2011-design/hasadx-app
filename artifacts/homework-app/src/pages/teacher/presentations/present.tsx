/**
 * Present mode — full-screen runtime that shows a presentation deck to
 * a class. Reachable from the editor's "Start" button. Supports:
 *   • keyboard nav (←/→, space, Esc, F for fullscreen)
 *   • persistent, compact on-screen controls
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
  User, UsersRound, Gamepad2, Flame, Sparkles, StickyNote,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useGameShareUrl } from "@/lib/use-game-share-url";
import { createHasadActivityFromSlide } from "@/lib/presentation-hasad-activities";
import { motionProfile, revealGroups, artKeyOfStep, type SlideMotionState } from "@/lib/slide-motion";
import { playMotionSound, soundForArt } from "@/lib/motion-sound";
import { baseDesignKey } from "@workspace/slide-templates";
import { SlideStage, type PresentActivityState } from "@/lib/slide-render";
import { AttachedSlideFrame } from "@/components/presentations/attached-slide-frame";
import type { Slide, SlideElement } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { getWameethSetupPath } from "@/lib/wameeth-entry";

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
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(kind === "correct" ? 0.26 : 0.18, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "correct" ? 0.62 : 0.38));
    master.connect(ctx.destination);

    const notes = kind === "correct"
      ? [523.25, 659.25, 783.99, 1046.5]
      : [246.94, 196];
    notes.forEach((freq, i) => {
      const t = now + i * (kind === "correct" ? 0.075 : 0.105);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === "correct" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(kind === "correct" ? 0.58 : 0.5, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "correct" ? 0.24 : 0.2));
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + (kind === "correct" ? 0.28 : 0.24));
    });
    if (kind === "correct") {
      [1318.51, 1567.98].forEach((freq, i) => {
        const t = now + 0.24 + i * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.32, t + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    }
  } catch {
    // Audio feedback should never block presenting.
  }
}

/** Classroom games that run on one screen, opened in the same tab so the presentation stays the home page.
 *  Wameedh (class) / Tug of war (class) / XO (class) read their questions from sessionStorage; the
 *  self-paced challenge is created from the slide's questions and opened in its own setup page. */
type ClassGameKind = "kahoot" | "tug" | "xo";
const CLASS_GAME_ROUTE: Record<ClassGameKind, { key: string; path: string }> = {
  kahoot: { key: "wameeth-class-setup", path: "/game/wameeth/class" },
  tug: { key: "tug-class-setup", path: "/game/tug/class" },
  xo: { key: "xo-class-setup", path: "/game/xo/class" },
};
function launchClassGame(
  kind: ClassGameKind,
  el: HasadGameEl,
  title: string,
  go: (to: string) => void,
): boolean {
  const questions = (el.questions ?? [])
    .filter((q) => q.options?.length >= 2)
    .map((q) => ({ text: q.prompt, options: q.options, correct: q.correctIndex }));
  if (questions.length < 2) return false;
  const route = CLASS_GAME_ROUTE[kind];
  try {
    sessionStorage.setItem(route.key, JSON.stringify({ questions, duration: 20, title, endMode: "questions" }));
  } catch {
    return false;
  }
  go(route.path);
  return true;
}

/** Write activity payload to localStorage then open the runner in a new tab. */
function launchActivityRunner(el: HasadGameEl, themeKey: string | undefined, language?: "ar" | "en", go?: (to: string) => void) {
  const seedId = el.id ?? `run-${Date.now()}`;
  const payload = {
    gameKind: el.gameKind ?? "kahoot",
    prompt: el.topic ?? el.prompt ?? "",
    questions: el.questions ?? [],
    themeKey: themeKey ?? null,
    language,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  try {
    localStorage.setItem(`hasad:activity:${seedId}`, JSON.stringify(payload));
  } catch { /* ignore */ }
  const to = `/teacher/presentations/activity-runner/${encodeURIComponent(seedId)}`;
  if (go) go(to);
  else window.open(to, "_blank", "noopener");
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
    let resume: string | null = null;
    try {
      resume = sessionStorage.getItem(`hasad:present-resume:${id}`);
    } catch { /* ignore */ }
    const raw = sp.get("slide") !== null
      ? parseInt(sp.get("slide") ?? "1", 10)
      : (resume !== null ? parseInt(resume, 10) + 1 : 1);
    if (!Number.isFinite(raw) || raw < 1) return 0;
    return Math.min(raw - 1, Math.max(0, total - 1));
  }, [total, id]);

  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [revealAnswers, setRevealAnswers] = useState(false);
  const [presentActivityState, setPresentActivityState] = useState<PresentActivityState>({
    elementId: null,
    questionIndex: 0,
    selectedIndex: null,
    completed: false,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLaunchingActivity, setIsLaunchingActivity] = useState(false);
  const [activePin, setActivePin] = useState<string | null>(null);
  const activePinShare = useGameShareUrl(activePin ? `/game/join/${encodeURIComponent(activePin)}` : "");
  const [showGameModeModal, setShowGameModeModal] = useState(false);
  const [selectedGameMode, setSelectedGameMode] = useState<"solo" | "teams" | "rocket" | "hotseat">("solo");
  const [selectedTeamCount, setSelectedTeamCount] = useState(2);
  const [activeGamePin, setActiveGamePin] = useState<string | null>(null);
  const [showGameFinishedBanner, setShowGameFinishedBanner] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setIdx(initialIdx); }, [initialIdx]);
  /* The saved slide has been applied; drop it so a later fresh start begins at slide 1. */
  useEffect(() => {
    if (total === 0) return;
    try { sessionStorage.removeItem(`hasad:present-resume:${id}`); } catch { /* ignore */ }
  }, [id, total]);

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

  /* Motion (identity decks only): the slide's cards appear one step per "next", and the slide itself
     enters with the identity's transition. Calm for the formal identities, playful for kids/nature. */
  type MotionMode = "auto" | "calm" | "playful" | "off";
  const [motionMode, setMotionModeState] = useState<MotionMode>(() => {
    try {
      const v = localStorage.getItem(`hasad:motion:${id}`);
      return v === "calm" || v === "playful" || v === "off" ? v : "auto";
    } catch { return "auto"; }
  });
  const [motionMenuOpen, setMotionMenuOpen] = useState(false);
  const [motionSound, setMotionSoundState] = useState<boolean>(() => {
    try { return localStorage.getItem(`hasad:motion-sound:${id}`) !== "off"; } catch { return true; }
  });
  const setMotionSound = useCallback((on: boolean) => {
    setMotionSoundState(on);
    try { localStorage.setItem(`hasad:motion-sound:${id}`, on ? "on" : "off"); } catch { /* ignore */ }
  }, [id]);
  const setMotionMode = useCallback((m: MotionMode) => {
    setMotionModeState(m);
    setMotionMenuOpen(false);
    try { localStorage.setItem(`hasad:motion:${id}`, m); } catch { /* ignore */ }
  }, [id]);
  const baseProfile = useMemo(() => motionProfile(data?.theme), [data?.theme]);
  const profile = useMemo(() => {
    if (!baseProfile || motionMode === "off") return null;
    if (motionMode === "calm") {
      return { ...baseProfile, style: "calm" as const, stagger: 60, transition: baseProfile.transition === "zoom" ? ("rise" as const) : baseProfile.transition };
    }
    if (motionMode === "playful") return { ...baseProfile, style: "playful" as const, stagger: 100 };
    return baseProfile;
  }, [baseProfile, motionMode]);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const groups = useMemo(() => (profile && current ? revealGroups(current) : []), [profile, current]);
  const [revealStep, setRevealStep] = useState(0);
  const [animateStep, setAnimateStep] = useState(false);
  useEffect(() => {
    /* a new slide starts hidden when entered going forward, fully shown when coming back to it */
    setRevealStep(direction === "prev" ? groups.length : 0);
    setAnimateStep(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, groups.length]);
  const lastSoundIdx = useRef<number | null>(null);
  useEffect(() => {
    if (lastSoundIdx.current !== null && lastSoundIdx.current !== idx && profile && motionSound && !reducedMotion) {
      playMotionSound(profile.reveal === "wipe" ? "chalk" : "slide", profile.style);
    }
    lastSoundIdx.current = idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);
  const onCountStart = useCallback(() => {
    if (profile && motionSound && !reducedMotion) playMotionSound("count", profile.style);
  }, [profile, motionSound, reducedMotion]);
  const slideMotion = useMemo<SlideMotionState | undefined>(() => {
    if (!profile) return undefined;
    /* revealStep belongs to the previous slide for one render after a slide change: clamp it to this slide */
    const step = Math.max(0, Math.min(revealStep, groups.length));
    const hidden = new Set<string>();
    groups.slice(step).forEach((g) => g.forEach((id) => hidden.add(id)));
    const entering = new Map<string, number>();
    if (animateStep && step > 0 && !reducedMotion) {
      (groups[step - 1] ?? []).forEach((id, n) => entering.set(id, n));
    }
    return {
      hidden, entering, style: profile.style, stagger: profile.stagger, idle: !reducedMotion,
      reveal: profile.style === "playful" && profile.reveal === "lift" ? "pop" : profile.reveal,
      rtl: deckLang === "ar", onCount: onCountStart,
    };
  }, [profile, groups, revealStep, animateStep, reducedMotion, deckLang, onCountStart]);

  const goNext = useCallback(() => {
    if (groups.length > 0 && revealStep < groups.length && !presentActivityState.completed) {
      setRevealStep((n) => n + 1);
      setAnimateStep(true);
      if (profile && motionSound && !reducedMotion) {
        /* chalk decks scratch; a card with a drawing sounds like its drawing; plain cards climb a scale */
        const art = soundForArt(artKeyOfStep(current, groups[revealStep] ?? []));
        const kind = baseDesignKey(data?.theme) === "d_chalk" ? "chalk" : (art ?? "pop");
        playMotionSound(kind, profile.style, revealStep);
      }
      return;
    }
    if (presentActivityState.completed) {
      setDirection("next");
      setRevealAnswers(false);
      setPresentActivityState({ elementId: null, questionIndex: 0, selectedIndex: null, completed: false });
      setIdx((i) => Math.min(i + 1, total - 1));
      return;
    }
    if (currentHasRevealableAnswer && !revealAnswers) {
      setRevealAnswers(true);
      return;
    }
    setDirection("next");
    setRevealAnswers(false);
    setPresentActivityState({ elementId: null, questionIndex: 0, selectedIndex: null, completed: false });
    setIdx((i) => Math.min(i + 1, total - 1));
  }, [currentHasRevealableAnswer, presentActivityState.completed, revealAnswers, total, groups.length, revealStep, profile, motionSound, reducedMotion, current, data?.theme, groups]);
  const goPrev = useCallback(() => {
    if (groups.length > 0 && revealStep > 0) {
      setRevealStep((n) => n - 1);
      setAnimateStep(false);
      return;
    }
    setDirection("prev");
    setRevealAnswers(false);
    setPresentActivityState({ elementId: null, questionIndex: 0, selectedIndex: null, completed: false });
    setIdx((i) => Math.max(i - 1, 0));
  }, [groups.length, revealStep]);
  const handlePresentAnswerSelect = useCallback((elementId: string, answerIndex: number) => {
    const activeElement = (current?.elements ?? []).find((el: SlideElement) => el.id === elementId);
    let correctIndex: number | undefined;
    let isLastQuestion = true;
    if (activeElement?.kind === "activity") {
      correctIndex = typeof activeElement.correctIndex === "number" ? activeElement.correctIndex : undefined;
    } else if (activeElement?.kind === "hasad-game") {
      const questions: GameQuestion[] = Array.isArray((activeElement as HasadGameEl).questions) ? ((activeElement as HasadGameEl).questions ?? []) : [];
      const qIndex = presentActivityState.elementId === elementId ? presentActivityState.questionIndex : 0;
      correctIndex = questions[qIndex]?.correctIndex;
      isLastQuestion = qIndex >= questions.length - 1;
    }
    if (typeof correctIndex === "number") {
      playPresentAnswerSound(answerIndex === correctIndex ? "correct" : "wrong");
    }
    setRevealAnswers(true);
    setPresentActivityState((prev) => ({
      elementId,
      questionIndex: prev.elementId === elementId ? prev.questionIndex : 0,
      selectedIndex: answerIndex,
      completed: isLastQuestion,
    }));
  }, [current, presentActivityState.elementId, presentActivityState.questionIndex]);
  const handlePresentNextQuestion = useCallback((elementId: string) => {
    setRevealAnswers(false);
    setPresentActivityState((prev) => ({
      elementId,
      questionIndex: prev.elementId === elementId ? prev.questionIndex + 1 : 0,
      selectedIndex: null,
      completed: false,
    }));
  }, []);
  const handlePresentFinishActivity = useCallback(() => {
    setDirection("next");
    setRevealAnswers(false);
    setPresentActivityState({ elementId: null, questionIndex: 0, selectedIndex: null, completed: false });
    setIdx((i) => Math.min(i + 1, total - 1));
  }, [total]);
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
        case "Home":       e.preventDefault(); setRevealAnswers(false); setPresentActivityState({ elementId: null, questionIndex: 0, selectedIndex: null, completed: false }); setIdx(0); break;
        case "End":        e.preventDefault(); setRevealAnswers(false); setPresentActivityState({ elementId: null, questionIndex: 0, selectedIndex: null, completed: false }); setIdx(Math.max(0, total - 1)); break;
        case "Escape":     e.preventDefault(); exit(); break;
        case "f":
        case "F":          e.preventDefault(); void toggleFullscreen(); break;
        case "n":
        case "N":          e.preventDefault(); if (notesEnabledRef.current) setShowNotes((v) => !v); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAr, goNext, goPrev, exit, toggleFullscreen, total]);

  /* Speaker notes. "N" toggles an on-screen panel (for a teacher who is alone with the screen); the notes
     button opens the presenter window, which follows this one over a BroadcastChannel and can drive it. */
  const [showNotes, setShowNotes] = useState(false);
  /* The teacher can switch the notes feature off entirely (button, N key and panel disappear). */
  const [notesEnabled, setNotesEnabledState] = useState<boolean>(() => {
    try { return localStorage.getItem("hasad:notes-enabled") !== "off"; } catch { return true; }
  });
  const setNotesEnabled = useCallback((on: boolean) => {
    setNotesEnabledState(on);
    if (!on) setShowNotes(false);
    try { localStorage.setItem("hasad:notes-enabled", on ? "on" : "off"); } catch { /* ignore */ }
  }, []);
  const notesEnabledRef = useRef(true);
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  useEffect(() => { goNextRef.current = goNext; goPrevRef.current = goPrev; }, [goNext, goPrev]);
  useEffect(() => { notesEnabledRef.current = notesEnabled; }, [notesEnabled]);
  const idxRef = useRef(idx);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  const presenterChan = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (isPublic || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(`hasad-present-${id}`);
    presenterChan.current = ch;
    ch.onmessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; cmd?: string };
      if (m?.type === "hello") ch.postMessage({ type: "slide", idx: idxRef.current });
      else if (m?.type === "cmd" && m.cmd === "next") goNextRef.current();
      else if (m?.type === "cmd" && m.cmd === "prev") goPrevRef.current();
    };
    return () => { ch.close(); presenterChan.current = null; };
  }, [id, isPublic]);
  useEffect(() => {
    presenterChan.current?.postMessage({ type: "slide", idx });
  }, [idx]);
  const openPresenterWindow = useCallback(() => {
    window.open(`/teacher/presentations/${id}/presenter`, "hasad-presenter", "width=560,height=760,noopener=no");
  }, [id]);
  const currentNotes = ((current as { notes?: string } | undefined)?.notes ?? "").trim();

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

  /** Open a game page in this same tab, remembering the slide so "back" lands on it. */
  const goKeepingSlide = useCallback((path: string) => {
    try { sessionStorage.setItem(`hasad:present-resume:${id}`, String(idx)); } catch { /* ignore */ }
    setLocation(path);
  }, [id, idx, setLocation]);

  /** Start the slide's own game: a single-screen classroom mode opened in this same tab (the page the
   *  teacher returns to with "back"), or the self-paced challenge built from the slide's questions. */
  const launchGameFromSlide = useCallback(async (el: HasadGameEl) => {
    const kind = el.gameKind as string | undefined;
    const title = el.topic || el.prompt || data?.title || "";
    try {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?slide=${idx + 1}`);
    } catch { /* ignore */ }
    if (kind === "kahoot" || kind === "tug" || kind === "xo") {
      if (launchClassGame(kind, el, title, setLocation)) return;
    }
    if (kind === "wheel" && current) {
      try {
        const created = await createHasadActivityFromSlide(
          current as unknown as Parameters<typeof createHasadActivityFromSlide>[0],
          id,
          "quick_quiz",
        );
        goKeepingSlide(`/game/wheel/create?assignmentId=${created.assignmentId}`);
        return;
      } catch {
        /* fall back to the in-page runner below */
      }
    }
    if (kind === "solo" && current) {
      try {
        const created = await createHasadActivityFromSlide(
          current as unknown as Parameters<typeof createHasadActivityFromSlide>[0],
          id,
          "quick_quiz",
        );
        setLocation(`/teacher/solo-challenges/new?source=assignment&assignmentId=${created.assignmentId}`);
        return;
      } catch {
        /* fall back to the in-page runner below */
      }
    }
    launchActivityRunner(el, data?.theme, deckLang, goKeepingSlide);
  }, [current, data?.theme, data?.title, deckLang, id, idx, setLocation, goKeepingSlide]);

  /** If the editor already stored a game type, launch it directly. */
  const launchSelectedHasadGame = useCallback(() => {
    if (!activeActivityEl?.assignmentId || isLaunchingActivity) return;
    const assignmentId = activeActivityEl.assignmentId;
    const gameType = activeActivityEl.gameType ?? "knowledge_race";

    if (gameType === "rocket_race") {
      goKeepingSlide(`/game/rocket/create?assignmentId=${assignmentId}`);
      return;
    }
    if (gameType === "tug_of_war") {
      goKeepingSlide(`/game/tug/create?assignmentId=${assignmentId}`);
      return;
    }
    if (gameType === "million") {
      goKeepingSlide(`/game/million?assignmentId=${assignmentId}`);
      return;
    }
    if (gameType === "hack") {
      createWameethSession(assignmentId, true);
      return;
    }
    if (gameType === "knowledge_race") {
      goKeepingSlide(getWameethSetupPath(assignmentId));
      return;
    }
    /* Wheel still uses Wameeth-compatible questions from presentations, so
       send it through the canonical Wameeth setup instead of creating a
       parallel session directly. */
    goKeepingSlide(getWameethSetupPath(assignmentId));
  }, [activeActivityEl, createWameethSession, isLaunchingActivity, goKeepingSlide]);

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
      goKeepingSlide(`/game/rocket/create?assignmentId=${activeActivityEl.assignmentId}`);
      return;
    }

    if (selectedGameMode === "hotseat") {
      goKeepingSlide("/game/hotseat/create");
      return;
    }

    // Wameeth's play mode and session setup live in one place. The new tab
    // preserves presentation behavior without duplicating socket setup here.
    goKeepingSlide(getWameethSetupPath(activeActivityEl.assignmentId));
  }, [activeActivityEl, isLaunchingActivity, selectedGameMode, selectedTeamCount, isAr, setLocation, goKeepingSlide]);

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

  const navigationControls = (
    <div className="flex flex-col">
      {showNotes && !isPublic && notesEnabled && (
        <div
          className="max-h-[34vh] overflow-y-auto border-t-4 border-amber-400 bg-slate-950 px-5 py-3 text-white"
          dir={dir}
          role="complementary"
          aria-label={isAr ? "ملاحظات المعلم" : "Speaker notes"}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-black text-amber-300">{isAr ? "ملاحظات المعلم" : "Speaker notes"}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={openPresenterWindow} className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold hover:bg-white/20">
                {isAr ? "فتح في نافذة منفصلة" : "Open in a separate window"}
              </button>
              <button onClick={() => setShowNotes(false)} className="rounded-md bg-white/10 p-1.5 hover:bg-white/20" aria-label="close"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <p className="whitespace-pre-wrap text-lg font-bold leading-[1.85]">
            {currentNotes || (isAr ? "لا توجد ملاحظات لهذه الشريحة. أضفها من المحرر في «ملاحظات المعلم»." : "No notes for this slide. Add them in the editor.")}
          </p>
        </div>
      )}
    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-amber-400/40 bg-slate-900 p-2">
      <button onClick={exit} className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" title={isAr ? "إنهاء (Esc)" : "Exit (Esc)"} aria-label={isAr ? "إنهاء العرض" : "Exit presentation"}>
        <X className="w-5 h-5" />
      </button>
      <button onClick={goPrev} disabled={idx === 0} aria-label={isAr ? "الشريحة السابقة" : "Previous slide"} className="flex min-h-11 items-center justify-center gap-1 rounded-lg bg-white px-3 font-bold text-slate-950 hover:bg-slate-200 disabled:opacity-40">
        {isAr ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        {isAr ? "السابق" : "Previous"}
      </button>
      <span dir="ltr" className="text-sm font-bold tabular-nums text-white">{idx + 1} / {total}</span>
      <button onClick={goNext} disabled={idx >= total - 1 && !(groups.length > 0 && revealStep < groups.length)} aria-label={isAr ? "الشريحة التالية" : "Next slide"} className="flex min-h-11 items-center justify-center gap-1 rounded-lg px-3 font-black hover:brightness-110 disabled:opacity-40" style={{ background: "#D9A521", color: "#1c1003" }}>
        {isAr ? "التالي" : "Next"}
        {isAr ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>
      {!isPublic && notesEnabled && (
        <button
          onClick={() => setShowNotes((v) => !v)}
          className={`flex h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-white hover:bg-white/20 ${showNotes ? "bg-amber-500/40" : "bg-white/10"}`}
          title={isAr ? "ملاحظات المعلم (N)" : "Speaker notes (N)"}
          aria-pressed={showNotes}
          aria-label={isAr ? "ملاحظات المعلم" : "Speaker notes"}
        >
          <StickyNote className="w-5 h-5" />
          <span className="hidden sm:inline text-sm font-bold">{isAr ? "ملاحظات المعلم" : "Notes"}</span>
        </button>
      )}
      {!isPublic && (
        <div className="relative">
          <button
            onClick={() => setMotionMenuOpen((o) => !o)}
            className={`flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/20 ${profile ? "bg-amber-500/30" : "bg-white/10"}`}
            title={isAr ? "الحركة" : "Motion"}
            aria-label={isAr ? "إعدادات الحركة" : "Motion settings"}
            aria-expanded={motionMenuOpen}
          >
            <Sparkles className="w-5 h-5" />
          </button>
          {motionMenuOpen && (
            <div
              className="absolute bottom-full mb-2 end-0 z-50 w-56 rounded-xl border border-white/15 bg-slate-900 p-1.5 text-start shadow-2xl"
              role="menu"
            >
              {baseProfile && ([
                ["auto", isAr ? "تلقائية (بحسب التصميم)" : "Automatic (by design)"],
                ["calm", isAr ? "هادئة ومهنية" : "Calm"],
                ["playful", isAr ? "مرحة" : "Playful"],
                ["off", isAr ? "بدون حركة" : "No motion"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  role="menuitemradio"
                  aria-checked={motionMode === value}
                  onClick={() => setMotionMode(value)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${motionMode === value ? "bg-amber-500 text-slate-950" : "text-white hover:bg-white/10"}`}
                >
                  <span>{label}</span>
                  {motionMode === value && <span aria-hidden>✓</span>}
                </button>
              ))}
              {baseProfile && <div className="my-1 h-px bg-white/10" />}
              <button
                role="menuitemcheckbox"
                aria-checked={notesEnabled}
                onClick={() => setNotesEnabled(!notesEnabled)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
              >
                <span>{isAr ? "ملاحظات المعلم" : "Speaker notes"}</span>
                <span aria-hidden>{notesEnabled ? "✓" : "—"}</span>
              </button>
              {baseProfile && <button
                role="menuitemcheckbox"
                aria-checked={motionSound}
                onClick={() => setMotionSound(!motionSound)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
              >
                <span>{isAr ? "المؤثرات الصوتية" : "Sound effects"}</span>
                <span aria-hidden>{motionSound ? "🔊" : "🔇"}</span>
              </button>}
            </div>
          )}
        </div>
      )}
      <button onClick={toggleFullscreen} className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" title={isAr ? "ملء الشاشة (F)" : "Fullscreen (F)"} aria-label={isAr ? "ملء الشاشة" : "Fullscreen"}>
        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </button>
    </div>
    </div>
  );

  return (
    <div
      dir={dir}
      lang={deckLang}
      className="fixed inset-0 bg-black select-none overflow-hidden"
      style={{ touchAction: "manipulation" }}
    >
      {/* Direction-aware transition: slide enters from the side that
          matches the navigation direction, in reading order (RTL flips
          the X delta). Keyed on slide id so React fully remounts and
          the CSS animation re-runs. `prefers-reduced-motion` users get
          an instant cut via the `motion-safe:` utility. */}
      <div
        key={current?.id ?? idx}
        className={`absolute inset-0 flex items-center justify-center ${profile ? "" : "motion-safe:animate-[slideEnter_.32s_ease-out]"}`}
        style={{
          zIndex: 10,
          ...(profile && !reducedMotion
            ? { animation: `${profile.transition === "zoom" ? "_hdZoom" : profile.transition === "rise" ? "_hdRise" : "_hdFade"} ${profile.style === "playful" ? 520 : 420}ms cubic-bezier(.2,.8,.2,1) both` }
            : {}),
          /* CSS var consumed by the keyframe; sign flipped for RTL so
             "next" always animates in from the leading edge. */
          ["--slide-dx" as string]:
            direction === "next"
              ? (isAr ? "-32px" : "32px")
              : (isAr ? "32px" : "-32px"),
        }}
      >
        <AttachedSlideFrame footer={navigationControls} header={(activeGameEl || activeActivityEl) && (
          <div
            className="flex flex-wrap items-center justify-center gap-2 border-b border-amber-400/40 bg-slate-900 p-3"
          >
            {activeGameEl && (
              <button
                type="button"
                onClick={() => void launchGameFromSlide(activeGameEl)}
                className="pointer-events-auto flex min-h-14 items-center gap-3 rounded-2xl px-8 py-3 text-lg font-black text-white ring-4 ring-amber-300/60 transition-all hover:scale-105 active:scale-95 motion-safe:animate-pulse"
                style={{
                  background: "#D9A521",
                  color: "#1c1003",
                  border: "1.5px solid rgba(217,165,33,0.55)",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Play className="w-4 h-4 fill-current" />
                {isAr ? "إطلاق اللعبة الآن" : "Launch game"}
              </button>
            )}
            {activeActivityEl && (
              <button
                type="button"
                onClick={activeActivityEl.gameType ? launchSelectedHasadGame : launchHasadActivity}
                disabled={isLaunchingActivity}
                className="pointer-events-auto flex min-h-14 items-center gap-3 rounded-2xl px-8 py-3 text-lg font-black ring-4 ring-amber-300/60 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
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
                {isAr ? (activeActivityEl.gameType ? "إطلاق اللعبة الآن" : "فتح النشاط") : "Launch activity"}
              </button>
            )}
          </div>
        )}>
          {current && (
            <SlideStage lang={deckLang}
              motion={slideMotion}
              slide={current}
              theme={data.theme}
              pattern={data.pattern}
              revealAnswers={revealAnswers}
              presentActivityState={presentActivityState}
              presentActivityHandlers={{
                onSelectAnswer: handlePresentAnswerSelect,
                onNextQuestion: handlePresentNextQuestion,
                onFinishActivity: handlePresentFinishActivity,
              }}
            />
          )}
          {/* Edge navigation belongs to the slide, never to its control bars. */}
          {!currentHasRevealableAnswer && (
            <>
              <button type="button" aria-label={isAr ? "السابق" : "Previous"} onClick={presentActivityState.completed ? goNext : goPrev} className={`absolute inset-y-0 z-20 w-1/6 ${isAr ? "right-0 cursor-e-resize" : "left-0 cursor-w-resize"}`} />
              <button type="button" aria-label={isAr ? "التالي" : "Next"} onClick={goNext} className={`absolute inset-y-0 z-20 w-1/6 ${isAr ? "left-0 cursor-w-resize" : "right-0 cursor-e-resize"}`} />
            </>
          )}
        </AttachedSlideFrame>
      </div>

      <style>{`
        @keyframes slideEnter {
          from { opacity: 0; transform: translateX(var(--slide-dx, 0)); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes _hdFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes _hdRise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes _hdZoom { from { opacity: 0; transform: scale(.93); } to { opacity: 1; transform: none; } }
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
              {activePinShare.status === "ready" ? (
                <QRCodeSVG
                  value={activePinShare.url}
                  size={160}
                  fgColor="#1f2937"
                  bgColor="#ffffff"
                  level="M"
                />
              ) : (
                <div style={{ width: 160, height: 160, display: "grid", placeItems: "center", background: "#f3f4f6", color: "#6b7280", fontSize: 12, textAlign: "center", padding: 12 }}>
                  {activePinShare.status === "error"
                    ? (isAr ? "تعذّر تجهيز الرابط" : "Could not prepare link")
                    : (isAr ? "جارٍ تجهيز الرابط…" : "Preparing link…")}
                </div>
              )}
            </div>
            {activePinShare.status === "pending" && (
              <div role="status" style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                {isAr ? "جارٍ تجهيز رابط المشاركة…" : "Preparing share link…"}
              </div>
            )}
            {activePinShare.status === "error" && (
              <button
                type="button"
                onClick={activePinShare.retry}
                style={{ color: "#fecaca", fontSize: 13, textDecoration: "underline" }}
              >
                {isAr ? "تعذّر تجهيز الرابط — إعادة المحاولة" : "Could not prepare link — retry"}
              </button>
            )}

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
                ? "امسح الرمز أو اكتب الرمز على hasaadx.com"
                : "Scan the code or go to hasaadx.com and enter the PIN"}
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
        className="absolute top-0 inset-x-0 z-30 h-1 bg-white/10"
      >
        <div
          className="h-full transition-all"
          style={{ width: `${progress}%`, background: "#D9A521" }}
        />
      </div>

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

    </div>
  );
}
