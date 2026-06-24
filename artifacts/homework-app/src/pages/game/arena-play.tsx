import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Eye,
  Clock,
  RotateCcw,
  Home,
  Zap,
  X,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  BookOpen,
  Sparkles,
  ChevronLeft,
  Share2,
  Flag,
  Phone,
  RefreshCw,
  AlertTriangle,
  Lock,
  LogIn,
  Copy,
  Check as CheckIcon,
  Tv2,
  ChevronDown,
  Users,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { ConfettiBurst } from "@/components/confetti-burst";
import { toast } from "@/components/ui/sonner";
import {
  ARENA_SECTIONS,
  HELPERS,
  buildCustomSection,
  type ArenaDifficulty,
  type ArenaSection,
  type ArenaSubCategory,
  type HelperId,
  type ArenaQuestion,
  type MemoryPayload,
  type SinJeemPayload,
  type CategorizePayload,
  type LogoPayload,
  type SecretPayload,
} from "@/data/arena-questions";
import { getStaticCoverImage, toCoverThumb } from "@/data/arena-cover-images";
import {
  cardKey,
  getNextTeam,
  loadArenaState,
  otherSide,
  pickKey,
  saveArenaState,
  getSeenIndices,
  markQuestionSeen,
  clearSeenBucket,
  saveArenaReport,
  getOrCreateShareCode,
  getOrCreateWriteSecret,
  loadArenaLastSettings,
  type ArenaActiveQuestion,
  type ArenaCardSlot,
  type ArenaState,
  type TeamSide,
} from "@/lib/arena-store";
import {
  fetchArenaCategories,
  fetchArenaActivities,
  buildDbSections,
  submitArenaReport,
} from "@/lib/arena-content";
import { io as socketIOClient } from "socket.io-client";
import QRCodeLib from "react-qr-code";

/** Base difficulty tiers shown on the board. 800 is only added when
 *  the sub-category has explicit 800-pt questions (DB-backed only). */
const BASE_POINT_VALUES: ArenaDifficulty[] = [200, 400, 600];
const SLOTS: ArenaCardSlot[] = [1, 2];

/** Returns the difficulty tiers available for a given sub-category.
 *  Static categories: always [200,400,600].
 *  DB-backed categories: add 800 only when the organizer explicitly enables it
 *  AND the sub-category has 800-pt questions. */
function subDifficulties(
  subId: string,
  sub: ArenaSubCategory,
  show800 = false,
): ArenaDifficulty[] {
  if (
    show800 &&
    subId.startsWith("db-") &&
    (sub.questions[800]?.length ?? 0) > 0
  ) {
    return [200, 400, 600, 800];
  }
  return BASE_POINT_VALUES;
}

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

function findSubCategory(
  id: string,
  sections: ArenaSection[] = ARENA_SECTIONS,
): ArenaSubCategory | undefined {
  for (const sec of sections) {
    const sub = sec.subCategories.find((s) => s.id === id);
    if (sub) return sub;
  }
  return undefined;
}

function findSection(
  subId: string,
  sections: ArenaSection[] = ARENA_SECTIONS,
): ArenaSection | undefined {
  return sections.find((sec) => sec.subCategories.some((s) => s.id === subId));
}

export default function ArenaPlay() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<ArenaState | null>(null);
  const [phase, setPhase] = useState<"board" | "end">("board");
  const [pointAnimation, setPointAnimation] = useState<{
    team: TeamSide;
    pts: number;
    difficulty: ArenaDifficulty;
    player?: string;
  } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [goldenTile, setGoldenTile] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // After organiser picks the winning team we optionally show a player chooser
  // so a single individual gets credit (display only — total still goes to team).
  const [pendingWinner, setPendingWinner] = useState<TeamSide | null>(null);
  const [pendingCustomPts, setPendingCustomPts] = useState<number | undefined>(undefined);
  const [showShare, setShowShare] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [friendActive, setFriendActive] = useState(false);
  const [friendSeconds, setFriendSeconds] = useState(60);
  const [shuraVotes, setShuraVotes] = useState<{ a: number; b: number }>({
    a: 0,
    b: 0,
  });
  /** Organizer-controlled toggle: show 800-point cards on the board */
  const [show800, setShow800] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncFingerprintRef = useRef<string>("");
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs so openCard callback stays stable across renders (no stale closures)
  const stateRef = useRef<ArenaState | null>(null);
  stateRef.current = state;
  const isDemoRef = useRef(false);
  const setGoldenTileRef = useRef<typeof setGoldenTile>(setGoldenTile);
  const allSectionsRef = useRef<ArenaSection[]>(ARENA_SECTIONS);

  const { data: teacherData, isLoading: teacherAuthLoading } =
    useGetCurrentTeacher({ query: { retry: false } as any });
  const isLoggedIn = teacherAuthLoading ? null : !!teacherData;

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen();
      } else {
        void document.exitFullscreen();
      }
    } catch {
      /* fullscreen not available */
    }
  };

  useEffect(() => {
    // Demo/preview mode — seed a fake game state without touching localStorage
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      isDemoRef.current = true;
      // Pick 6 sub-categories from static sections for the demo board
      const demoSubIds = ARENA_SECTIONS.flatMap((s) =>
        s.subCategories.map((sc) => sc.id),
      ).slice(0, 6);
      const demoState: ArenaState = {
        tournamentName: "بطولة المعلمين 2025",
        teams: {
          "team-a": {
            name: "الصقور",
            color: "#f59e0b",
            emoji: "🦅",
            score: 400,
            helpers: ["friend", "swap", "shura"],
            usedHelpers: [],
            players: [],
          },
          "team-b": {
            name: "الأسود",
            color: "#6366f1",
            emoji: "🦁",
            score: 200,
            helpers: ["friend", "swap", "shura"],
            usedHelpers: [],
            players: [],
          },
        },
        teamOrder: ["team-a", "team-b"],
        subCategoryIds: demoSubIds,
        customQuestions: [],
        timerSeconds: 30,
        currentTurn: "team-a",
        usedCards: [`${demoSubIds[0]}_200_1`, `${demoSubIds[2]}_400_2`],
        pickedQuestions: {},
        active: null,
        rulesAck: true,
        startedAt: Date.now(),
        publicMode: false,
      };
      setState(demoState);
      return;
    }

    const loaded = loadArenaState();
    if (!loaded) {
      // If the last game was started from the public arena page, go back there
      const wasPublic = sessionStorage.getItem("arena_public_mode") === "1";
      setLocation(wasPublic ? "/play/arena" : "/game/arena");
      return;
    }
    setState(loaded);
  }, [setLocation]);

  useEffect(() => {
    // Never persist the demo/preview state to localStorage
    if (state && !isDemoRef.current) saveArenaState(state);
  }, [state]);

  // Recovery: if any DB-backed sub-category IDs are missing from the saved
  // dbSections (happens with old saved games before the fix, or server-resumed
  // games), silently fetch all categories + activities and rebuild dbSections.
  useEffect(() => {
    if (!state) return;
    const dbIds = state.subCategoryIds.filter((id) => id.startsWith("db-"));
    if (dbIds.length === 0) return;

    const currentSections = state.dbSections ?? [];
    const allSubIds = new Set(
      currentSections.flatMap((s) => s.subCategories.map((sc) => sc.id)),
    );
    const missing = dbIds.filter((id) => !allSubIds.has(id));
    if (missing.length === 0) return;

    // Some DB sub-categories are missing — rebuild dbSections from the API
    (async () => {
      try {
        const cats = await fetchArenaCategories();
        if (cats.length === 0) return;
        const acts = await fetchArenaActivities(cats.map((c) => c.id));
        const allCatIds = new Set(cats.map((c) => c.id));
        const { sections, mergedSubsByStaticId } = buildDbSections(
          cats,
          acts,
          allCatIds,
        );
        const recovered: typeof sections = [
          ...sections,
          ...Object.entries(mergedSubsByStaticId)
            .filter(([, subs]) => subs.length > 0)
            .map(([staticId, subs]) => {
              const staticSec = ARENA_SECTIONS.find((s) => s.id === staticId);
              return {
                id: `db-merged-${staticId}`,
                name: staticSec?.name ?? staticId,
                emoji: staticSec?.emoji ?? "📚",
                cover: staticSec?.cover ?? { emoji: "📚", color: "#1E4D35" },
                subCategories: subs,
              } as (typeof sections)[0];
            }),
        ];
        setState((prev) => (prev ? { ...prev, dbSections: recovered } : prev));
      } catch {
        /* best-effort — board will show empty slots if fetch fails */
      }
    })();
    // Only run once after state is first loaded (not on every state change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state]);

  // Auto-save to server (debounced 2s) so the teacher can resume from any device.
  useEffect(() => {
    if (!state || !isLoggedIn || phase === "end") return;
    if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
    serverSaveTimerRef.current = setTimeout(() => {
      void fetch("/api/arena/save", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      }).catch(() => {
        /* best-effort */
      });
    }, 2000);
    return () => {
      if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isLoggedIn]);

  // When the game ends, delete the server save so it doesn't appear as a resume prompt.
  // For teacher games, also clear the public-mode sessionStorage flag so a stale flag
  // from a previous public game cannot accidentally redirect the teacher to /play/arena.
  // For public games, persist the last-used settings to localStorage so the next visit
  // to /play/arena can pre-fill the setup form without re-configuring from scratch.
  useEffect(() => {
    if (phase !== "end") return;
    if (isLoggedIn) {
      void fetch("/api/arena/save", { method: "DELETE" }).catch(() => {
        /* best-effort */
      });
    }
    if (!state?.publicMode) {
      sessionStorage.removeItem("arena_public_mode");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isLoggedIn]);

  useEffect(() => {
    if (!state) return;
    const sections = allSectionsRef.current;
    const totalCards = state.subCategoryIds.reduce((sum, subId) => {
      const sub = findSubCategory(subId, sections);
      return (
        sum + (sub ? subDifficulties(subId, sub).length * SLOTS.length : 0)
      );
    }, 0);
    if (state.usedCards.length >= totalCards && !state.active) {
      setPhase("end");
    }
  }, [state]);

  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => {
      setState((prev) => {
        if (!prev || !prev.active) return prev;
        const next = prev.active.timeLeft - 1;
        if (next <= 0) {
          setTimerRunning(false);
          playSound("buzz");
          return { ...prev, active: { ...prev.active, timeLeft: 0 } };
        }
        if (next <= 5) playSound("tick");
        return { ...prev, active: { ...prev.active, timeLeft: next } };
      });
    }, 1000);
    return () => clearInterval(t);
    // Only recreate when timer starts/stops — NOT on every tick.
    // setState functional form reads latest prev, so timeLeft dep is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning]);

  const playSound = (
    kind:
      | "click"
      | "tick"
      | "buzz"
      | "correct"
      | "win"
      | "fanfare"
      | "chime"
      | "trap"
      | "swap"
      | "shura"
      | "twoAnswers"
      | "friend"
      | "harvest",
  ) => {
    if (!soundOn) return;
    try {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext ??
          (window as WindowWithWebkit).webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      switch (kind) {
        case "click":
          o.frequency.value = 600;
          g.gain.setValueAtTime(0.08, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          o.start(now);
          o.stop(now + 0.1);
          break;
        case "tick":
          o.frequency.value = 880;
          g.gain.setValueAtTime(0.05, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          o.start(now);
          o.stop(now + 0.06);
          break;
        case "buzz":
          o.type = "sawtooth";
          o.frequency.value = 180;
          g.gain.setValueAtTime(0.15, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          o.start(now);
          o.stop(now + 0.6);
          break;
        case "correct":
          o.frequency.value = 523;
          g.gain.setValueAtTime(0.1, now);
          o.frequency.exponentialRampToValueAtTime(880, now + 0.2);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          o.start(now);
          o.stop(now + 0.3);
          break;
        case "fanfare": {
          // Rising three-note fanfare for 800-pt cards
          const fanNotes = [784, 1047, 1319];
          fanNotes.forEach((f, i) => {
            const oo = ctx.createOscillator();
            const gg = ctx.createGain();
            oo.connect(gg);
            gg.connect(ctx.destination);
            oo.frequency.value = f;
            gg.gain.setValueAtTime(0.0001, now + i * 0.12);
            gg.gain.exponentialRampToValueAtTime(0.14, now + i * 0.12 + 0.02);
            gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
            oo.start(now + i * 0.12);
            oo.stop(now + i * 0.12 + 0.38);
          });
          break;
        }
        case "win": {
          const notes = [523, 659, 784, 1047];
          notes.forEach((f, i) => {
            const oo = ctx.createOscillator();
            const gg = ctx.createGain();
            oo.connect(gg);
            gg.connect(ctx.destination);
            oo.frequency.value = f;
            gg.gain.setValueAtTime(0.0001, now + i * 0.15);
            gg.gain.exponentialRampToValueAtTime(0.12, now + i * 0.15 + 0.02);
            gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
            oo.start(now + i * 0.15);
            oo.stop(now + i * 0.15 + 0.45);
          });
          break;
        }
        case "trap": {
          // Menacing descending tension sting for the trap helper backfire
          const sweep = ctx.createOscillator();
          const sweepGain = ctx.createGain();
          sweep.type = "sawtooth";
          sweep.connect(sweepGain);
          sweepGain.connect(ctx.destination);
          sweep.frequency.setValueAtTime(420, now);
          sweep.frequency.exponentialRampToValueAtTime(70, now + 0.55);
          sweepGain.gain.setValueAtTime(0.0001, now);
          sweepGain.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
          sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          sweep.start(now);
          sweep.stop(now + 0.62);
          // Dissonant low growl underneath
          const growl = ctx.createOscillator();
          const growlGain = ctx.createGain();
          growl.type = "square";
          growl.connect(growlGain);
          growlGain.connect(ctx.destination);
          growl.frequency.setValueAtTime(110, now);
          growl.frequency.exponentialRampToValueAtTime(55, now + 0.6);
          growlGain.gain.setValueAtTime(0.0001, now);
          growlGain.gain.exponentialRampToValueAtTime(0.1, now + 0.05);
          growlGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
          growl.start(now);
          growl.stop(now + 0.66);
          // Use the original oscillator to add a brief high stinger at the start
          o.type = "triangle";
          o.frequency.setValueAtTime(900, now);
          o.frequency.exponentialRampToValueAtTime(300, now + 0.18);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          o.start(now);
          o.stop(now + 0.24);
          break;
        }
        case "chime": {
          // Short ascending three-note arpeggio for double-points multiplier
          const chimeNotes = [880, 1109, 1397];
          chimeNotes.forEach((f, i) => {
            const oo = ctx.createOscillator();
            const gg = ctx.createGain();
            oo.connect(gg);
            gg.connect(ctx.destination);
            oo.type = "sine";
            oo.frequency.value = f;
            gg.gain.setValueAtTime(0.0001, now + i * 0.1);
            gg.gain.exponentialRampToValueAtTime(0.18, now + i * 0.1 + 0.015);
            gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.22);
            oo.start(now + i * 0.1);
            oo.stop(now + i * 0.1 + 0.25);
          });
          break;
        }
        case "harvest": {
          // Power-up shimmer — triangle wave ascending rapid burst, distinct from chime
          const harvestNotes = [392, 523, 659, 784];
          harvestNotes.forEach((f, i) => {
            const oo = ctx.createOscillator();
            const gg = ctx.createGain();
            oo.connect(gg);
            gg.connect(ctx.destination);
            oo.type = "triangle";
            oo.frequency.value = f;
            gg.gain.setValueAtTime(0.0001, now + i * 0.07);
            gg.gain.exponentialRampToValueAtTime(0.16, now + i * 0.07 + 0.01);
            gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
            oo.start(now + i * 0.07);
            oo.stop(now + i * 0.07 + 0.2);
          });
          break;
        }
        case "swap": {
          // Card-flip whoosh — quick descending then ascending sweep, like shuffling
          const swapDown = ctx.createOscillator();
          const swapDownG = ctx.createGain();
          swapDown.type = "sine";
          swapDown.connect(swapDownG);
          swapDownG.connect(ctx.destination);
          swapDown.frequency.setValueAtTime(800, now);
          swapDown.frequency.exponentialRampToValueAtTime(350, now + 0.12);
          swapDownG.gain.setValueAtTime(0.0001, now);
          swapDownG.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
          swapDownG.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          swapDown.start(now);
          swapDown.stop(now + 0.15);
          const swapUp = ctx.createOscillator();
          const swapUpG = ctx.createGain();
          swapUp.type = "sine";
          swapUp.connect(swapUpG);
          swapUpG.connect(ctx.destination);
          swapUp.frequency.setValueAtTime(350, now + 0.14);
          swapUp.frequency.exponentialRampToValueAtTime(700, now + 0.26);
          swapUpG.gain.setValueAtTime(0.0001, now + 0.14);
          swapUpG.gain.exponentialRampToValueAtTime(0.12, now + 0.16);
          swapUpG.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          swapUp.start(now + 0.14);
          swapUp.stop(now + 0.3);
          break;
        }
        case "shura": {
          // Council hum — three slightly detuned oscillators swell together, deliberative
          const shuraFreqs = [330, 348, 365];
          shuraFreqs.forEach((f, i) => {
            const oo = ctx.createOscillator();
            const gg = ctx.createGain();
            oo.type = "sine";
            oo.connect(gg);
            gg.connect(ctx.destination);
            oo.frequency.value = f;
            gg.gain.setValueAtTime(0.0001, now + i * 0.04);
            gg.gain.linearRampToValueAtTime(0.07, now + i * 0.04 + 0.12);
            gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.5);
            oo.start(now + i * 0.04);
            oo.stop(now + i * 0.04 + 0.55);
          });
          break;
        }
        case "twoAnswers": {
          // Triumphant rising grab — brassy two-note sting like claiming a prize
          const grabNotes = [440, 659];
          grabNotes.forEach((f, i) => {
            const oo = ctx.createOscillator();
            const gg = ctx.createGain();
            oo.type = "square";
            oo.connect(gg);
            gg.connect(ctx.destination);
            oo.frequency.value = f;
            gg.gain.setValueAtTime(0.0001, now + i * 0.14);
            gg.gain.exponentialRampToValueAtTime(0.1, now + i * 0.14 + 0.02);
            gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.25);
            oo.start(now + i * 0.14);
            oo.stop(now + i * 0.14 + 0.28);
          });
          // Bright shimmer on top
          const sparkle = ctx.createOscillator();
          const sparkleG = ctx.createGain();
          sparkle.type = "sine";
          sparkle.connect(sparkleG);
          sparkleG.connect(ctx.destination);
          sparkle.frequency.value = 1318;
          sparkleG.gain.setValueAtTime(0.0001, now + 0.2);
          sparkleG.gain.exponentialRampToValueAtTime(0.12, now + 0.22);
          sparkleG.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          sparkle.start(now + 0.2);
          sparkle.stop(now + 0.42);
          break;
        }
        case "friend": {
          // Phone ring — two classic DTMF-style tones pulsing like an incoming call
          const ringPairs = [
            [941, 1336],
            [941, 1336],
          ];
          ringPairs.forEach(([f1, f2], pulse) => {
            const start = now + pulse * 0.28;
            [f1, f2].forEach((f) => {
              const oo = ctx.createOscillator();
              const gg = ctx.createGain();
              oo.type = "sine";
              oo.connect(gg);
              gg.connect(ctx.destination);
              oo.frequency.value = f;
              gg.gain.setValueAtTime(0.0001, start);
              gg.gain.exponentialRampToValueAtTime(0.09, start + 0.01);
              gg.gain.setValueAtTime(0.09, start + 0.18);
              gg.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
              oo.start(start);
              oo.stop(start + 0.24);
            });
          });
          break;
        }
      }
    } catch {
      /* audio not available */
    }
  };

  const orderedSubCategoryIds = useMemo(
    () => state?.subCategoryIds ?? [],
    [state?.subCategoryIds],
  );

  const allSections = useMemo<ArenaSection[]>(() => {
    if (!state) return ARENA_SECTIONS;
    const custom = buildCustomSection(state.customQuestions);
    const db = state.dbSections ?? [];
    const merged = [...ARENA_SECTIONS, ...db];
    return custom ? [...merged, custom] : merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.customQuestions, state?.dbSections]);
  allSectionsRef.current = allSections;

  // Stable openCard — uses refs so board grid can be memoized without re-rendering on every timer tick
  const openCard = useCallback(
    (
      subCategoryId: string,
      difficulty: ArenaDifficulty,
      slot: ArenaCardSlot,
    ) => {
      const s = stateRef.current;
      if (!s) return;
      const key = cardKey({ subCategoryId, difficulty, slot });
      if (s.usedCards.includes(key)) return;
      if (s.active) return;
      const sections = allSectionsRef.current;
      const sub = findSubCategory(subCategoryId, sections);
      if (!sub) return;
      const pool = sub.questions[difficulty];
      if (pool.length === 0) return;
      const bucketKey = pickKey(subCategoryId, difficulty);
      const alreadyPicked = s.pickedQuestions[bucketKey] ?? [];
      const seenAcrossGames = getSeenIndices(subCategoryId, difficulty);
      const allIndices = pool.map((_, i) => i);
      let candidates = allIndices.filter(
        (i) => !alreadyPicked.includes(i) && !seenAcrossGames.includes(i),
      );
      if (candidates.length === 0) {
        candidates = allIndices.filter((i) => !alreadyPicked.includes(i));
        if (candidates.length > 0) clearSeenBucket(subCategoryId, difficulty);
      }
      if (candidates.length === 0) candidates = allIndices;
      const qi = candidates[Math.floor(Math.random() * candidates.length)];
      markQuestionSeen(subCategoryId, difficulty, qi);
      const newActive: ArenaActiveQuestion = {
        subCategoryId,
        difficulty,
        slot,
        questionIndex: qi,
        question: pool[qi],
        multiplier: 1,
        answeringTeam: s.currentTurn,
        trapUsed: false,
        trapOwner: null,
        transferUsed: false,
        twoAnswersActive: false,
        revealed: false,
        timeLeft: s.timerSeconds,
        helpersUsedThisQ: [],
        shuraVisible: false,
      };
      setState((prev) =>
        prev
          ? {
              ...prev,
              active: newActive,
              pickedQuestions: {
                ...prev.pickedQuestions,
                [bucketKey]: [...alreadyPicked, qi],
              },
            }
          : prev,
      );
      setTimerRunning(true);
      if (difficulty === 800) {
        playSound("fanfare");
        const tileKey = cardKey({ subCategoryId, difficulty, slot });
        setGoldenTileRef.current(tileKey);
        setTimeout(() => setGoldenTileRef.current(null), 1200);
      } else {
        playSound("click");
      }
      // stable — reads state via ref, never changes reference
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [],
  );

  // Phone-a-friend countdown — independent of main timer.
  // Must be declared before any early return to keep hook order stable.
  useEffect(() => {
    if (!friendActive) return;
    if (friendSeconds <= 0) {
      setFriendActive(false);
      playSound("buzz");
      return;
    }
    const t = setTimeout(() => setFriendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendActive, friendSeconds]);

  // Poll for shura vote counts while shura is active.
  useEffect(() => {
    const shuraIsOpen = state?.active?.shuraVisible ?? false;
    if (!shuraIsOpen) {
      setShuraVotes({ a: 0, b: 0 });
      return;
    }
    const fetchVotes = async () => {
      try {
        const code = getOrCreateShareCode();
        const res = await fetch(
          `/api/arena/session/${encodeURIComponent(code)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          shuraVotes?: { a: number; b: number };
        };
        if (data.shuraVotes) setShuraVotes(data.shuraVotes);
      } catch {
        /* silent */
      }
    };
    void fetchVotes();
    const t = setInterval(() => {
      void fetchVotes();
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.active?.shuraVisible]);

  // Sync audience-visible state to the server (debounced 500 ms).
  // We skip PUT if only the countdown timer changed — no need to push
  // on every tick since the audience page doesn't show a timer.
  useEffect(() => {
    if (!state) return;
    const activeQ = state.active
      ? {
          questionText: state.active.question.q,
          difficulty: state.active.difficulty,
          subCategoryName:
            findSubCategory(state.active.subCategoryId, allSections)?.name ??
            "",
        }
      : null;
    const payload = {
      writeSecret: getOrCreateWriteSecret(),
      tournamentName: state.tournamentName,
      teams: state.teamOrder.map((id) => ({
        id,
        name: state.teams[id]?.name ?? "",
        color: state.teams[id]?.color ?? "#16a34a",
        emoji: state.teams[id]?.emoji ?? "🦅",
        score: state.teams[id]?.score ?? 0,
      })),
      currentTurn: state.currentTurn,
      activeQuestion: activeQ,
      ended: phase === "end",
      shuraActive: state.active?.shuraVisible ?? false,
    };
    // Fingerprint excludes writeSecret (constant) — covers all audience-visible fields
    const { writeSecret: _ws, ...fingerprintData } = payload;
    const fingerprint = JSON.stringify(fingerprintData);
    if (fingerprint === syncFingerprintRef.current) return;
    syncFingerprintRef.current = fingerprint;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const code = getOrCreateShareCode();
      void fetch(`/api/arena/session/${encodeURIComponent(code)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {
        /* silent fail — audience feature is best-effort */
      });
    }, 500);
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
    // allSections derives from state; watching both state and phase is required
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, phase]);

  /* ── difficulty colour tokens — calm light-theme palette (teal / slate / gold) ── */
  const TILE_R = "8px";
  const diffStyle = (
    pts: ArenaDifficulty,
    used: boolean,
  ): React.CSSProperties => {
    if (used)
      return {
        background: "#f1efe7",
        borderColor: "transparent",
        color: "#b7b1a1",
        cursor: "not-allowed",
        boxShadow: "none",
        borderRadius: TILE_R,
      };
    const base = {
      boxShadow:
        "0 2px 6px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.08) inset, 0 1px 0 rgba(255,255,255,0.18) inset",
      borderRadius: TILE_R,
      borderColor: "transparent",
    };
    if (pts === 200)
      return {
        ...base,
        background: "linear-gradient(160deg,#2a5d6a,#183c46)",
        color: "#ffffff",
      };
    if (pts === 400)
      return {
        ...base,
        background: "linear-gradient(160deg,#6a7b9a,#4a5572)",
        color: "#ffffff",
      };
    if (pts === 600)
      return {
        ...base,
        background: "linear-gradient(160deg,#d6ad55,#a07f37)",
        color: "#ffffff",
      };
    return {
      ...base,
      background: "linear-gradient(160deg,#f0c266,#a87a2a)",
      color: "#fffbeb",
      boxShadow: `${base.boxShadow}, 0 0 14px rgba(217,165,73,0.55)`,
    };
  };

  /* ── Game board grid — memoized HERE (before early returns) to keep hook order stable ─────────
     Rules of Hooks: useMemo must be called unconditionally. Placing it inside JSX after early
     returns violates this rule and causes React error #310 on phase transitions.                  */
  const boardGrid = useMemo(() => {
    const usedCards = state?.usedCards ?? [];
    const activeQ = state?.active ?? null;

    return (
      <div
        style={{
          flex: "1 1 0",
          minHeight: 0,
          overflowY: "auto",
        }}
      >
              <div
                className="grid grid-cols-2 lg:grid-cols-3"
                style={{
                  maxWidth: "1280px",
                  width: "100%",
                  margin: "0 auto",
                  gap: "clamp(10px, 1.5vw, 18px)",
                  padding: "clamp(10px, 3vw, 18px)",
                }}
              >
          {orderedSubCategoryIds.map((subId) => {
            const sub = findSubCategory(subId, allSections);
            const sec = findSection(subId, allSections);
            if (!sub) return null;
            const rawImgUrl =
              sub.cover?.imageUrl ??
              (sec ? getStaticCoverImage(sec.id, subId) : undefined);
            const imgUrl = toCoverThumb(rawImgUrl) ?? rawImgUrl;
            const accentColor =
              sub.cover?.color ?? sec?.cover?.color ?? "#2d5e3f";
            const emoji = sub.cover?.emoji ?? sec?.emoji ?? "📚";
            const diffs = subDifficulties(subId, sub, show800);

            return (
              <motion.div
                key={subId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={!activeQ ? { y: -4, boxShadow: `0 14px 28px -10px ${accentColor}55, 0 4px 12px rgba(0,0,0,0.08)` } : undefined}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow:
                    "0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
                  border: "1px solid #ebe2cd",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Image area — fixed aspect ratio */}
                <div
                  className="relative"
                  style={{
                    height: window.innerWidth < 640 ? "110px" : "190px",
                    overflow: "hidden",
                    background: "#f3f0e6",
                  }}
                >
                  {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={sub.name}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full"
                    style={{
                      objectFit: "cover",
                      objectPosition: "50% 0%",
                    }}
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (rawImgUrl && el.src !== rawImgUrl) el.src = rawImgUrl;
                    }}
                  />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor}33, ${accentColor}66)`,
                      }}
                    >
                      <span style={{ fontSize: "52px" }}>{emoji}</span>
                    </div>
                  )}
                </div>

                {/* Category name — clean, no icons */}
                <div
                  className="flex items-center justify-center"
                  style={{
                    paddingTop: "8px",
                    paddingBottom: "6px",
                    paddingLeft: "10px",
                    paddingRight: "10px",
                  }}
                >
                  <span
                    style={{
                      fontFamily:
                        "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif",
                      fontWeight: 800,
                      fontSize: "19px",
                      color: "#1f2937",
                      lineHeight: 1.2,
                      textAlign: "center",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {sub.name}
                  </span>
                </div>

                {/* Buttons — 2 cols × N rows */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    padding: "0 10px 8px 10px",
                  }}
                >
                  {diffs.map((pts) => {
                    const keyA = cardKey({
                      subCategoryId: subId,
                      difficulty: pts,
                      slot: 1,
                    });
                    const keyB = cardKey({
                      subCategoryId: subId,
                      difficulty: pts,
                      slot: 2,
                    });
                    const usedA = usedCards.includes(keyA);
                    const usedB = usedCards.includes(keyB);
                    return (
                      <React.Fragment key={pts}>
                        {[
                          { key: keyA, used: usedA, slot: 1 as const },
                          { key: keyB, used: usedB, slot: 2 as const },
                        ].map(({ key, used, slot }) => (
                          <motion.button
                            key={key}
                            whileHover={
                              !used && !activeQ
                                ? { scale: 1.06, y: -2 }
                                : undefined
                            }
                            whileTap={
                              !used && !activeQ ? { scale: 0.92, y: 0 } : undefined
                            }
                            onClick={() =>
                              !used && !activeQ && openCard(subId, pts, slot)
                            }
                            disabled={used || !!activeQ}
                            className="font-black border transition-all flex items-center justify-center relative overflow-hidden group"
                            style={{
                              fontFamily: "'Tajawal', sans-serif",
                              fontSize: "15px",
                              height: "34px",
                              ...diffStyle(pts, used),
                            }}
                            animate={
                              goldenTile === key
                                ? {
                                    boxShadow: [
                                      "0 0 0px rgba(251,191,36,0)",
                                      "0 0 22px rgba(251,191,36,0.95)",
                                      "0 0 36px rgba(251,191,36,0.75)",
                                      "0 0 0px rgba(251,191,36,0)",
                                    ],
                                    scale: [1, 1.08, 1],
                                  }
                                : undefined
                            }
                            transition={{ duration: 1.2, ease: "easeOut" }}
                          >
                            {/* Idle glossy sweep on available tiles */}
                            {!used && !activeQ && (
                              <motion.span
                                className="absolute inset-y-0 -inset-x-1 pointer-events-none"
                                initial={{ x: "-120%", opacity: 0 }}
                                animate={{ x: "120%", opacity: [0, 0.8, 0] }}
                                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3.6 + (slot * 0.4), ease: "easeInOut" }}
                                style={{
                                  background:
                                    "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)",
                                  width: "40%",
                                }}
                              />
                            )}
                            {goldenTile === key && (
                              <motion.span
                                className="absolute inset-0 pointer-events-none"
                                initial={{ opacity: 0.85, scaleX: 0 }}
                                animate={{ opacity: 0, scaleX: 1 }}
                                transition={{ duration: 1.0, ease: "easeOut" }}
                                style={{
                                  background:
                                    "linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.65) 50%, transparent 100%)",
                                  transformOrigin: "left",
                                }}
                              />
                            )}
                            <span className="relative">{used ? "—" : pts}</span>
                          </motion.button>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderedSubCategoryIds,
    allSections,
    state?.usedCards,
    !!state?.active,
    openCard,
    goldenTile,
    show800,
  ]);

  if (!state) return null;

  const totalCards = orderedSubCategoryIds.reduce((sum, subId) => {
    const sub = findSubCategory(subId, allSections);
    return (
      sum +
      (sub ? subDifficulties(subId, sub, show800).length * SLOTS.length : 0)
    );
  }, 0);
  const usedCount = state.usedCards.length;
  const active = state.active;

  // openCard is now defined as useCallback above early returns (uses stateRef)

  const updateActive = (patch: Partial<ArenaActiveQuestion>) => {
    setState((prev) => {
      if (!prev || !prev.active) return prev;
      return { ...prev, active: { ...prev.active, ...patch } };
    });
  };

  const consumeHelperFrom = (side: TeamSide, helperId: HelperId) => {
    setState((prev) => {
      if (!prev) return prev;
      const team = prev.teams[side];
      if (team.usedHelpers.includes(helperId)) return prev;
      return {
        ...prev,
        teams: {
          ...prev.teams,
          [side]: { ...team, usedHelpers: [...team.usedHelpers, helperId] },
        },
      };
    });
  };

  const startTimer = () => {
    if (!active) return;
    if (active.timeLeft === 0) {
      updateActive({ timeLeft: state.timerSeconds });
    }
    setTimerRunning(true);
  };

  const stopTimer = () => setTimerRunning(false);

  const canUseHelper = (side: TeamSide, helperId: HelperId): boolean => {
    if (!active) return false;
    const team = state.teams[side];
    if (!team.helpers.includes(helperId)) return false;
    if (team.usedHelpers.includes(helperId)) return false;
    if (active.helpersUsedThisQ.includes(helperId)) return false;
    if (active.revealed) return false;
    if (helperId === "twoAnswers") {
      return (
        side === active.answeringTeam &&
        !active.twoAnswersActive &&
        !active.revealed
      );
    }
    if (helperId === "trap") {
      return (
        side === state.currentTurn && !active.trapUsed && !active.transferUsed
      );
    }
    return side === active.answeringTeam;
  };

  const useHelper = (side: TeamSide, helperId: HelperId) => {
    if (!active || !canUseHelper(side, helperId)) return;
    if (helperId === "harvest") {
      updateActive({
        multiplier: 2,
        helpersUsedThisQ: [...active.helpersUsedThisQ, helperId],
      });
    } else if (helperId === "shura") {
      setTimerRunning(false);
      updateActive({
        shuraVisible: true,
        helpersUsedThisQ: [...active.helpersUsedThisQ, helperId],
      });
    } else if (helperId === "trap") {
      updateActive({
        trapUsed: true,
        trapOwner: active.answeringTeam,
        answeringTeam: otherSide(active.answeringTeam),
        helpersUsedThisQ: [...active.helpersUsedThisQ, helperId],
      });
      consumeHelperFrom(side, helperId);
      playSound("trap");
      return;
    } else if (helperId === "swap") {
      const sub = findSubCategory(active.subCategoryId, allSections);
      if (sub) {
        const pool = sub.questions[active.difficulty];
        let nextIdx = active.questionIndex;
        if (pool.length > 1) {
          while (nextIdx === active.questionIndex) {
            nextIdx = Math.floor(Math.random() * pool.length);
          }
        }
        updateActive({
          questionIndex: nextIdx,
          question: pool[nextIdx],
          timeLeft: state.timerSeconds,
          helpersUsedThisQ: [...active.helpersUsedThisQ, helperId],
        });
      }
    } else if (helperId === "twoAnswers") {
      updateActive({
        twoAnswersActive: true,
        helpersUsedThisQ: [...active.helpersUsedThisQ, helperId],
      });
    } else if (helperId === "friend") {
      setTimerRunning(false);
      setFriendSeconds(60);
      setFriendActive(true);
      updateActive({
        helpersUsedThisQ: [...active.helpersUsedThisQ, helperId],
      });
    }
    consumeHelperFrom(side, helperId);
    const helperSoundMap: Partial<
      Record<HelperId, Parameters<typeof playSound>[0]>
    > = {
      harvest: "harvest",
      shura: "shura",
      swap: "swap",
      twoAnswers: "twoAnswers",
      friend: "friend",
    };
    playSound(helperSoundMap[helperId] ?? "click");
  };

  // Cancel-and-swap current question for a different one in the same bucket
  // (free of charge — for damaged or unreadable questions).
  const replaceQuestion = () => {
    if (!active) return;
    const sub = findSubCategory(active.subCategoryId, allSections);
    if (!sub) return;
    const pool = sub.questions[active.difficulty];
    if (pool.length <= 1) {
      toast.error("لا توجد أسئلة أخرى في هذه الفئة");
      return;
    }
    let nextIdx = active.questionIndex;
    let attempts = 0;
    while (nextIdx === active.questionIndex && attempts < 20) {
      nextIdx = Math.floor(Math.random() * pool.length);
      attempts++;
    }
    markQuestionSeen(active.subCategoryId, active.difficulty, nextIdx);
    updateActive({
      questionIndex: nextIdx,
      question: pool[nextIdx],
      timeLeft: state.timerSeconds,
      revealed: false,
    });
    setTimerRunning(false);
    toast.success("تم استبدال السؤال");
    playSound("click");
  };

  const submitReport = (note: string, correctAnswer: string) => {
    if (!active) return;
    /* Local cache (offline-friendly) */
    saveArenaReport({
      subCategoryId: active.subCategoryId,
      difficulty: active.difficulty,
      question: active.question.q,
      answer: active.question.a,
      note,
      correctAnswer: correctAnswer || undefined,
    });
    /* Best-effort: send to backend so admins can review */
    const dbId = active.subCategoryId.startsWith("db-")
      ? Number(active.subCategoryId.slice(3))
      : null;
    void submitArenaReport({
      categoryId: Number.isFinite(dbId) ? dbId : null,
      subCategoryId: active.subCategoryId,
      difficulty: active.difficulty,
      questionType: active.question.type ?? "text",
      questionText: active.question.q,
      currentAnswer: active.question.a,
      suggestedAnswer: correctAnswer || null,
      note,
    });
    setShowReport(false);
    toast.success("تم إرسال البلاغ — شكراً، سيراجعه المسؤول");
  };

  const reveal = () => {
    if (!active) return;
    setTimerRunning(false);
    updateActive({ revealed: true });
    playSound("click");
  };

  const transferToOther = () => {
    if (!active || active.transferUsed || active.trapUsed) return;
    setState((prev) => {
      if (!prev || !prev.active) return prev;
      return {
        ...prev,
        active: {
          ...prev.active,
          answeringTeam: getNextTeam(prev.teamOrder, prev.active.answeringTeam),
          transferUsed: true,
          revealed: false,
          shuraVisible: false,
          timeLeft: prev.timerSeconds,
        },
      };
    });
    setTimerRunning(false);
  };

  // Two-step resolve: if the winning team has a roster, pause for player pick.
  const requestResolve = (winner: TeamSide | null, customPts?: number) => {
    if (!active) return;
    // Trap rule: if no one answered correctly but a trap was active,
    // award the points to the team who set the trap.
    const effectiveWinner =
      winner === null && active.trapUsed && active.trapOwner
        ? (active.trapOwner as TeamSide)
        : winner;
    if (effectiveWinner && state.teams[effectiveWinner].players.length > 0) {
      setPendingWinner(effectiveWinner);
      setPendingCustomPts(customPts);
      return;
    }
    finalizeResolve(effectiveWinner, undefined, customPts);
  };

  const finalizeResolve = (
    winner: TeamSide | null,
    player: string | undefined,
    customPts?: number,
  ) => {
    if (!active) return;
    const pts = customPts ?? (active.difficulty * active.multiplier);
    const key = cardKey({
      subCategoryId: active.subCategoryId,
      difficulty: active.difficulty,
      slot: active.slot,
    });
    if (winner) {
      setPointAnimation({
        team: winner,
        pts,
        difficulty: active.difficulty,
        player,
      });
      if (active.multiplier > 1) {
        playSound("chime");
        setTimeout(() => playSound("correct"), 150);
      } else {
        playSound("correct");
      }
      setTimeout(() => setPointAnimation(null), 1800);
    } else {
      playSound("buzz");
    }
    setState((prev) => {
      if (!prev) return prev;
      const newTeams = { ...prev.teams };
      if (winner) {
        newTeams[winner] = {
          ...newTeams[winner],
          score: newTeams[winner].score + pts,
        };
      }
      return {
        ...prev,
        teams: newTeams,
        usedCards: prev.usedCards.includes(key)
          ? prev.usedCards
          : [...prev.usedCards, key],
        currentTurn: getNextTeam(prev.teamOrder, prev.currentTurn),
        active: null,
      };
    });
    setTimerRunning(false);
    setPendingWinner(null);
    setPendingCustomPts(undefined);
  };

  const closeQuestionUnresolved = () => {
    if (!active) return;
    setState((prev) => (prev ? { ...prev, active: null } : prev));
    setTimerRunning(false);
  };

  const restart = () => {
    const isPublic =
      state?.publicMode ?? sessionStorage.getItem("arena_public_mode") === "1";
    saveArenaState(null);
    sessionStorage.removeItem("arena_public_mode");
    void fetch("/api/arena/save", { method: "DELETE" }).catch(() => {
      /* best-effort */
    });
    setLocation(isPublic ? "/play/arena" : "/game/arena");
  };

  // Exit but keep the state so the host can come back and continue.
  const exitKeep = () => {
    const wasPublic =
      state?.publicMode || sessionStorage.getItem("arena_public_mode") === "1";
    setLocation(wasPublic ? "/games" : "/teacher");
  };

  // Force end the game (winner is computed from current scores).
  const forceEnd = () => {
    setShowEndConfirm(false);
    setPhase("end");
  };

  const isPublicGame =
    state?.publicMode || sessionStorage.getItem("arena_public_mode") === "1";
  if (isLoggedIn === false && !isPublicGame && !isDemoRef.current) {
    return <ArenaLoginGate />;
  }

  if (phase === "end") {
    const sortedEntries = state.teamOrder
      .map((id) => ({ id, team: state.teams[id] }))
      .filter((x) => x.team)
      .sort((a, b) => b.team.score - a.team.score);
    const topScore = sortedEntries[0]?.team.score ?? 0;
    const topWinners = sortedEntries.filter((x) => x.team.score === topScore);
    const winnerTeam = topWinners.length === 1 ? topWinners[0].team : null;
    const handleExit = () => {
      sessionStorage.removeItem("arena_public_mode");
      setLocation(state.publicMode ? "/play/arena" : "/games");
    };
    const lastSettings = loadArenaLastSettings();
    const quickReplay = () => {
      if (!lastSettings) {
        setLocation("/play/arena");
        return;
      }
      const sections = allSectionsRef.current;
      const allValid = lastSettings.teams.every(
        (t) =>
          t.subCategoryIds.length === 3 &&
          t.subCategoryIds.every((id) => !!findSubCategory(id, sections)),
      );
      if (!allValid) {
        toast.error("بعض الفئات لم تعد متاحة — يرجى إعادة الإعداد");
        sessionStorage.removeItem("arena_public_mode");
        setLocation("/play/arena");
        return;
      }
      const teamsRecord: ArenaState["teams"] = {};
      const teamOrder: string[] = [];
      for (let i = 0; i < lastSettings.teams.length; i++) {
        const id = `T${i + 1}`;
        teamOrder.push(id);
        const t = lastSettings.teams[i];
        teamsRecord[id] = {
          name: t.name,
          color: t.color,
          emoji: t.emoji,
          score: 0,
          helpers: t.helpers,
          usedHelpers: [],
          players: [],
        };
      }
      const newArenaState: ArenaState = {
        tournamentName: "",
        teams: teamsRecord,
        teamOrder,
        subCategoryIds: lastSettings.teams.flatMap((t) => t.subCategoryIds),
        customQuestions: [],
        // Carry forward DB-backed sections from the just-finished game so that any
        // DB categories that were selected remain resolvable on the fresh board.
        // allSectionsRef is already built from state.dbSections, so validation above
        // and this source are consistent.
        dbSections: state.dbSections ?? [],
        timerSeconds: lastSettings.timerSeconds,
        currentTurn: teamOrder[0],
        usedCards: [],
        pickedQuestions: {},
        active: null,
        rulesAck: true,
        startedAt: Date.now(),
        publicMode: true,
      };
      // Persist to localStorage so the rules overlay on the fresh board can load it
      saveArenaState(newArenaState);
      sessionStorage.setItem("arena_public_mode", "1");
      // Update React state directly — we're already on /game/arena/play so navigation
      // alone would not remount the component.  Setting state + resetting phase is the
      // only reliable way to transition from "end" back to a fresh board in-place.
      setTimerRunning(false);
      setState(newArenaState);
      setPhase("board");
    };
    return (
      <EndScreen
        winnerTeam={winnerTeam}
        teams={state.teams}
        teamOrder={state.teamOrder}
        onRestart={restart}
        onExit={handleExit}
        onWinSound={() => playSound("win")}
        publicMode={state.publicMode ?? false}
        hasLastSettings={lastSettings !== null}
        onQuickReplay={quickReplay}
      />
    );
  }

  const teamA =
    state.teams[state.teamOrder[0]] ?? Object.values(state.teams)[0];
  const teamB =
    state.teams[state.teamOrder[1]] ?? Object.values(state.teams)[1] ?? teamA;

  if (!state.rulesAck) {
    return (
      <RulesOverlay
        teamA={teamA}
        teamB={teamB}
        onAck={() =>
          setState((prev) => (prev ? { ...prev, rulesAck: true } : prev))
        }
      />
    );
  }

  const turnTeam = state.teams[state.currentTurn] ?? teamA;

  /* ── Action buttons — calm light theme, icon + label ── */
  const ACTION_BTNS = [
    {
      icon: soundOn ? (
        <Volume2 className="w-[18px] h-[18px]" />
      ) : (
        <VolumeX className="w-[18px] h-[18px]" />
      ),
      action: () => setSoundOn((s) => !s),
      label: "الصوت",
    },
    {
      icon: isFullscreen ? (
        <Minimize className="w-[18px] h-[18px]" />
      ) : (
        <Maximize className="w-[18px] h-[18px]" />
      ),
      action: toggleFullscreen,
      label: "ملء الشاشة",
    },
    {
      icon: <BookOpen className="w-[18px] h-[18px]" />,
      action: () =>
        setState((prev) => (prev ? { ...prev, rulesAck: false } : prev)),
      label: "تعليمات",
    },
    {
      icon: <Share2 className="w-[18px] h-[18px]" />,
      action: () => setShowShare(true),
      label: "مشاركة",
    },
    {
      icon: <RotateCcw className="w-[18px] h-[18px]" />,
      action: () => setShowRestartConfirm(true),
      label: "إعادة",
    },
    {
      icon: <Flag className="w-[18px] h-[18px]" />,
      action: () => setShowEndConfirm(true),
      label: "إنهاء",
    },
    {
      icon: <Home className="w-[18px] h-[18px]" />,
      action: exitKeep,
      label: "الرئيسية",
    },
  ];

  const ARABIC_FONT = "'IBM Plex Sans Arabic', 'Tajawal', sans-serif";
  const ARABIC_DISPLAY = "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif";
  const ARABIC_ELEGANT = "'Amiri', 'Readex Pro', 'IBM Plex Sans Arabic', serif";

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col"
      style={{
        background: "#faf6ec",
        fontFamily: ARABIC_FONT,
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ══ HEADER — white card, 3 zones ══════════════════════════════════ */}
      <header className="shrink-0 px-2 sm:px-4 pt-2 sm:pt-3">
        <div
          className="px-3 sm:px-5 py-2.5 gap-2 sm:gap-5 flex flex-col sm:grid items-center"
          style={{
            background: "#ffffff",
            borderRadius: "18px",
            boxShadow:
              "0 2px 10px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)",
            border: "1px solid #ebe2cd",
            maxWidth: "1280px",
            margin: "0 auto",
            width: "100%",
            gridTemplateColumns: "auto minmax(0,1fr) auto",
          }}
        >
          {/* Zone A (right in RTL): Teams pill — natural width, compact */}
          <div className="flex items-center justify-end order-1 sm:order-none w-full sm:w-auto">
            <div
              className="flex items-center gap-6 px-6 py-2 rounded-2xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,244,232,0.98) 100%)",
                border: "1px solid rgba(201,161,75,0.22)",
                boxShadow:
                  "0 4px 14px rgba(0,0,0,0.04), 0 10px 24px rgba(15,86,55,0.06)",
                fontFamily: ARABIC_FONT,
              }}
            >
              {/* Team A */}
              {(() => {
                const t = state.teams[state.teamOrder[0]];
                if (!t) return null;
                const isActive = state.currentTurn === state.teamOrder[0];

                return (
                  <motion.div
                    className="flex items-center gap-3 relative"
                    animate={isActive ? {
                      scale: [1, 1.07, 1],
                      filter: [
                        `drop-shadow(0 0 6px ${t.color}88)`,
                        `drop-shadow(0 0 18px ${t.color}dd)`,
                        `drop-shadow(0 0 6px ${t.color}88)`,
                      ],
                    } : { scale: 1, filter: "none" }}
                    transition={isActive
                      ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }}
                  >
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: [0.7, 1, 0.7], y: 0 }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        style={{
                          position: "absolute",
                          top: "-18px",
                          right: "50%",
                          transform: "translateX(50%)",
                          fontSize: "10px",
                          fontWeight: 900,
                          color: t.color,
                          whiteSpace: "nowrap",
                          background: `${t.color}18`,
                          borderRadius: "6px",
                          padding: "1px 6px",
                          fontFamily: ARABIC_FONT,
                        }}
                      >
                        ← دورك
                      </motion.span>
                    )}
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: isActive ? "38px" : "32px",
                        height: isActive ? "38px" : "32px",
                        borderRadius: "12px",
                        background: isActive ? `${t.color}30` : `${t.color}1f`,
                        transition: "all 0.3s ease",
                      }}
                    >
                      <Users
                        className="w-[18px] h-[18px]"
                        style={{ color: t.color }}
                      />
                    </div>

                    <div className="flex flex-col leading-none">
                      <span
                        style={{
                          fontSize: isActive ? "15px" : "14px",
                          fontWeight: 700,
                          color: isActive ? t.color : "#4b5563",
                          whiteSpace: "nowrap",
                          lineHeight: 1.2,
                          transition: "all 0.3s ease",
                        }}
                      >
                        {t.name}
                      </span>

                      <span
                        style={{
                          fontSize: isActive ? "34px" : "28px",
                          fontWeight: 800,
                          lineHeight: 1.1,
                          marginTop: "2px",
                          color: isActive ? t.color : "#1f2937",
                          fontVariantNumeric: "tabular-nums",
                          transition: "all 0.3s ease",
                        }}
                      >
                        {t.score}
                      </span>
                    </div>
                  </motion.div>
                );
              })()}

              {/* VS */}
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "16px",
                  background:
                    "linear-gradient(135deg, #c9a14b 0%, #e0bb69 100%)",
                  boxShadow:
                    "0 8px 20px rgba(201,161,75,0.28)",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 900,
                    color: "#ffffff",
                    fontFamily: ARABIC_DISPLAY,
                    letterSpacing: "0.08em",
                  }}
                >
                  VS
                </span>
              </div>

              {/* Team B */}
              {(() => {
                const t = state.teams[state.teamOrder[1]];
                if (!t) return null;
                const isActive = state.currentTurn === state.teamOrder[1];

                return (
                  <motion.div
                    className="flex items-center gap-3 relative"
                    animate={isActive ? {
                      scale: [1, 1.07, 1],
                      filter: [
                        `drop-shadow(0 0 6px ${t.color}88)`,
                        `drop-shadow(0 0 18px ${t.color}dd)`,
                        `drop-shadow(0 0 6px ${t.color}88)`,
                      ],
                    } : { scale: 1, filter: "none" }}
                    transition={isActive
                      ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }}
                  >
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: [0.7, 1, 0.7], y: 0 }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        style={{
                          position: "absolute",
                          top: "-18px",
                          left: "50%",
                          transform: "translateX(-50%)",
                          fontSize: "10px",
                          fontWeight: 900,
                          color: t.color,
                          whiteSpace: "nowrap",
                          background: `${t.color}18`,
                          borderRadius: "6px",
                          padding: "1px 6px",
                          fontFamily: ARABIC_FONT,
                        }}
                      >
                        دورك →
                      </motion.span>
                    )}
                    <div className="flex flex-col leading-none items-end">
                      <span
                        style={{
                          fontSize: isActive ? "15px" : "14px",
                          fontWeight: 700,
                          color: isActive ? t.color : "#4b5563",
                          whiteSpace: "nowrap",
                          lineHeight: 1.2,
                          transition: "all 0.3s ease",
                        }}
                      >
                        {t.name}
                      </span>

                      <span
                        style={{
                          fontSize: isActive ? "34px" : "28px",
                          fontWeight: 800,
                          lineHeight: 1.1,
                          marginTop: "2px",
                          color: isActive ? t.color : "#1f2937",
                          fontVariantNumeric: "tabular-nums",
                          transition: "all 0.3s ease",
                        }}
                      >
                        {t.score}
                      </span>
                    </div>

                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: isActive ? "38px" : "32px",
                        height: isActive ? "38px" : "32px",
                        borderRadius: "12px",
                        background: isActive ? `${t.color}30` : `${t.color}1f`,
                        transition: "all 0.3s ease",
                      }}
                    >
                      <Users
                        className="w-[18px] h-[18px]"
                        style={{ color: t.color }}
                      />
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          </div>
          {/* Zone B (center): Brand */}
          <div className="flex items-center justify-center gap-2 sm:gap-2.5 order-2 sm:order-none">
            <div className="flex flex-col leading-none items-center">
              <span
                className="arena-brand-title"
                style={{
                  fontFamily: ARABIC_DISPLAY,
                  fontWeight: 800,
                  color: "#2d5e3f",
                  letterSpacing: "0.02em",
                }}
              >
                تحدّي حصاد
              </span>
              <span
                className="arena-brand-subtitle"
                style={{
                  fontSize: "25px",
                  fontWeight: 800,
                  fontFamily: ARABIC_ELEGANT,
                  color: "#8a6d2c",
                  marginTop: "5px",
                  paddingTop: "4px",
                  borderTop: "1px solid #e8dfc8",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  letterSpacing: "0.005em",
                }}
              >
                {state.tournamentName ?? "بطولة المعرفة والتحدي"}
              </span>
            </div>
          </div>

          {/* Zone C (left in RTL): Action buttons — icon-only on mobile, labeled on desktop */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap sm:flex-wrap justify-center order-3 sm:order-none">
            {ACTION_BTNS.map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                title={btn.label}
                aria-label={btn.label}
                className="flex flex-col items-center justify-center rounded-xl transition-all active:scale-90 w-[44px] h-[44px] sm:w-[46px] sm:h-[46px]"
                style={{
                  color: "#5b6b87",
                  background: "#faf6ec",
                  border: "1px solid #ebe2cd",
                  fontFamily: ARABIC_FONT,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#f0e8d4";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "#2d5e3f";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#faf6ec";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "#5b6b87";
                }}
              >
                {btn.icon}
                <span
                  className="hidden sm:inline"
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    color: "#8a7d5e",
                    marginTop: "2px",
                  }}
                >
                  {btn.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Sub-header strip: turn indicator ─────────────────────────── */}
        <div className="flex items-center justify-center py-3" style={{ width: "100%" }}>
          <motion.div
            key={state.currentTurn}
            initial={{ scale: 0.82, opacity: 0, y: -8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            className="relative inline-flex items-center gap-3 overflow-hidden"
            style={{
              borderRadius: "999px",
              padding: "10px 24px 10px 18px",
              background: `linear-gradient(135deg, ${turnTeam.color}18 0%, ${turnTeam.color}08 100%)`,
              border: `2px solid ${turnTeam.color}55`,
              boxShadow: `0 0 0 4px ${turnTeam.color}14, 0 8px 28px -6px ${turnTeam.color}55`,
              fontFamily: ARABIC_FONT,
            }}
          >
            {/* Outer pulse ring */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ borderRadius: "999px" }}
              animate={{
                boxShadow: [
                  `0 0 0 0px ${turnTeam.color}44`,
                  `0 0 0 8px ${turnTeam.color}00`,
                ],
              }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            {/* Shimmer sweep */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ x: "-130%" }}
              animate={{ x: "130%" }}
              transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
              style={{
                background: `linear-gradient(110deg, transparent 25%, ${turnTeam.color}40 50%, transparent 75%)`,
                borderRadius: "999px",
              }}
            />
            {/* Live dot */}
            <div className="relative z-10 flex items-center gap-1.5">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: "9px",
                  height: "9px",
                  borderRadius: "999px",
                  background: turnTeam.color,
                  boxShadow: `0 0 8px ${turnTeam.color}`,
                  flexShrink: 0,
                }}
              />
            </div>
            {/* Label */}
            <div className="relative z-10 flex flex-col leading-none items-start">
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  letterSpacing: "0.18em",
                  color: turnTeam.color,
                  opacity: 0.75,
                  textTransform: "uppercase",
                  fontFamily: ARABIC_FONT,
                }}
              >
                الدور الآن
              </span>
              <motion.span
                key={turnTeam.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                style={{
                  fontSize: "20px",
                  fontWeight: 900,
                  color: turnTeam.color,
                  lineHeight: 1.15,
                  fontFamily: ARABIC_FONT,
                  textShadow: `0 0 24px ${turnTeam.color}88`,
                  whiteSpace: "nowrap",
                }}
              >
                {turnTeam.emoji} {turnTeam.name}
              </motion.span>
            </div>
          </motion.div>
        </div>
        {/* ── Audience strip ───────────────────────────────────────────── */}
        {isPublicGame && (
          <button
            onClick={() => setShowShare(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold transition-all hover:brightness-95"
            style={{
              background: "#f0fdf4",
              borderTop: "1px solid #bbf7d0",
              color: "#065f46",
            }}
          >
            <Tv2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>وضع المتفرج — شارك رابط الجمهور مع شاشة ثانية</span>
            <Share2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          </button>
        )}
      </header>

      {/* ══ BOARD ═══════════════════════════════════════════════════════════ */}
      {boardGrid}

      <AnimatePresence>
        {active && (
          <QuestionModal
            state={state}
            active={active}
            sections={allSections}
            timerRunning={timerRunning}
            shuraVotes={shuraVotes}
            onStartTimer={startTimer}
            onStopTimer={stopTimer}
            onReveal={reveal}
            onTransfer={transferToOther}
            onResolve={requestResolve}
            onClose={closeQuestionUnresolved}
            onUseHelper={useHelper}
            canUseHelper={canUseHelper}
            onReplaceQuestion={replaceQuestion}
            onReport={() => setShowReport(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingWinner && active && (
          <PlayerPickerOverlay
            team={state.teams[pendingWinner]}
            side={pendingWinner}
            onPick={(player) => finalizeResolve(pendingWinner, player, pendingCustomPts)}
            onSkip={() => finalizeResolve(pendingWinner, undefined, pendingCustomPts)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {friendActive && active && (
          <FriendCallOverlay
            seconds={friendSeconds}
            team={state.teams[active.answeringTeam]}
            onClose={() => setFriendActive(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShare && <ShareDialog onClose={() => setShowShare(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showReport && active && (
          <ReportDialog
            question={active.question.q}
            answer={active.question.a}
            onClose={() => setShowReport(false)}
            onSubmit={submitReport}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEndConfirm && (
          <ConfirmDialog
            title="إنهاء اللعبة الآن؟"
            body="سيظهر الفائز بناءً على النقاط الحالية ولا يمكن التراجع."
            confirmLabel="نعم، أنهِ اللعبة"
            confirmTone="amber"
            onCancel={() => setShowEndConfirm(false)}
            onConfirm={forceEnd}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestartConfirm && (
          <ConfirmDialog
            title="إعادة من البداية؟"
            body="سيتم حذف هذه المسابقة بكل بياناتها والعودة لإعداد لعبة جديدة."
            confirmLabel="نعم، أعد من البداية"
            confirmTone="rose"
            onCancel={() => setShowRestartConfirm(false)}
            onConfirm={() => {
              setShowRestartConfirm(false);
              restart();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────  Login gate  ───────────────────────────── */

function ArenaLoginGate() {
  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(ellipse at top, #064e3b 0%, #022c22 60%, #000 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl rounded-3xl p-8 sm:p-10 border-4 text-center backdrop-blur-sm"
        style={{
          background:
            "linear-gradient(160deg, rgba(6,78,59,0.95), rgba(2,44,34,0.95))",
          borderColor: "rgba(245,158,11,0.55)",
        }}
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-400/15 border-2 border-amber-300/40 mb-4">
          <Lock className="w-10 h-10 text-amber-300" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-amber-200 mb-3">
          تسجيل الدخول مطلوب
        </h1>
        <p className="text-emerald-100/85 text-base sm:text-lg leading-relaxed mb-6">
          سجّل دخولك لمتابعة لعبة تحدّي حصاد.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login">
            <button className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-extrabold text-lg bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 inline-flex items-center justify-center gap-2 shadow-xl">
              <LogIn className="w-5 h-5" />
              تسجيل الدخول
            </button>
          </Link>
          <Link href="/games">
            <button className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20">
              العودة للألعاب
            </button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────  Turn Indicator  ───────────────────────────── */

function TurnIndicator({
  team,
  side,
}: {
  team: { name: string; emoji: string; color: string };
  side: TeamSide;
}) {
  return (
    <div className="relative px-3 py-1.5 flex items-center justify-center">
      <motion.div
        key={`${side}-${team.name}`}
        initial={{ scale: 0.7, opacity: 0, y: -10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
        className="relative inline-flex items-center gap-2 sm:gap-3 rounded-2xl px-4 sm:px-5 py-2 overflow-hidden"
        style={{
          background: "#ffffff",
          border: `2px solid ${team.color}`,
          boxShadow: `0 6px 22px -6px ${team.color}99, 0 0 0 4px ${team.color}1a`,
          fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif",
        }}
      >
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ x: "-120%" }}
          animate={{ x: "120%" }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
          style={{
            background: `linear-gradient(110deg, transparent 30%, ${team.color}33 50%, transparent 70%)`,
          }}
        />
        {/* Pulsing color ring */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ boxShadow: [`inset 0 0 0 0 ${team.color}00`, `inset 0 0 0 3px ${team.color}55`, `inset 0 0 0 0 ${team.color}00`] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          animate={{ scale: [1, 1.18, 1], rotate: [0, -8, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl relative z-10"
          style={{ willChange: "transform", filter: `drop-shadow(0 2px 6px ${team.color}88)` }}
        >
          {team.emoji}
        </motion.span>
        <div className="relative text-right z-10">
          <div className="text-[9px] font-black tracking-[0.3em] flex items-center gap-1" style={{ color: "#a07f37" }}>
            <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}>
              <Zap className="w-2.5 h-2.5" style={{ color: "#c9a14b" }} fill="#c9a14b" />
            </motion.span>
            الدور الآن
          </div>
          <div
            className="text-lg sm:text-2xl font-black"
            style={{ color: team.color, lineHeight: 1.1, fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}
          >
            {team.name}
          </div>
        </div>
        <motion.div
          animate={{ x: [0, -6, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10"
          style={{ willChange: "transform" }}
        >
          <ChevronLeft className="w-5 h-5" style={{ color: team.color }} />
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────  Player picker  ───────────────────────────── */

function PlayerPickerOverlay({
  team,
  side,
  onPick,
  onSkip,
}: {
  team: { name: string; emoji: string; color: string; players: string[] };
  side: TeamSide;
  onPick: (player: string) => void;
  onSkip: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-none"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <motion.div
        key={side}
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 border-4 shadow-2xl text-center"
        style={{
          background: `linear-gradient(160deg, #022c22, #064e3b)`,
          borderColor: team.color,
        }}
      >
        <div className="text-5xl mb-2">{team.emoji}</div>
        <div className="text-amber-200/80 text-sm font-bold mb-1">
          من أجاب من
        </div>
        <div
          className="text-3xl sm:text-4xl font-black mb-5"
          style={{ color: team.color }}
        >
          {team.name}؟
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          {team.players.map((p) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              className="rounded-xl py-3 sm:py-4 px-3 font-extrabold text-base sm:text-lg text-white border-2 transition hover:scale-105 active:scale-95"
              style={{
                background: `linear-gradient(160deg, ${team.color}66, ${team.color}33)`,
                borderColor: team.color,
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={onSkip}
          className="px-6 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20"
        >
          تخطي — إجابة جماعية
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────  Question modal  ───────────────────────────── */

function QuestionModal({
  state,
  active,
  sections,
  timerRunning,
  shuraVotes,
  onStartTimer,
  onStopTimer,
  onReveal,
  onTransfer,
  onResolve,
  onClose,
  onUseHelper,
  canUseHelper,
  onReplaceQuestion,
  onReport,
}: {
  state: ArenaState;
  active: ArenaActiveQuestion;
  sections: ArenaSection[];
  timerRunning: boolean;
  shuraVotes: { a: number; b: number };
  onStartTimer: () => void;
  onStopTimer: () => void;
  onReveal: () => void;
  onTransfer: () => void;
  onResolve: (winner: TeamSide | null, customPts?: number) => void;
  onClose: () => void;
  onUseHelper: (side: TeamSide, helperId: HelperId) => void;
  canUseHelper: (side: TeamSide, helperId: HelperId) => boolean;
  onReplaceQuestion: () => void;
  onReport: () => void;
}) {
  const teamA =
    state.teams[state.teamOrder[0]] ?? Object.values(state.teams)[0];
  const teamB =
    state.teams[state.teamOrder[1]] ?? Object.values(state.teams)[1] ?? teamA;
  const answeringTeam = state.teams[active.answeringTeam];
  const otherTeam =
    state.teams[getNextTeam(state.teamOrder, active.answeringTeam)];
  const sec = findSection(active.subCategoryId, sections);
  const sub = findSubCategory(active.subCategoryId, sections);

  // Safety guard: if the active question is somehow missing its content (e.g.
  // a stale localStorage shape, a custom-section question that lost its body,
  // or a deleted bank entry), surface a friendly recovery prompt instead of
  // throwing on `active.question.q`.
  if (!active.question || typeof active.question.q !== "string") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 backdrop-blur-none"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        <div className="w-full max-w-md rounded-3xl p-8 border-2 border-amber-400/40 bg-emerald-950 text-white text-center">
          <div className="text-4xl mb-3">🛟</div>
          <div className="text-xl font-extrabold mb-2 text-amber-200">
            تعذّر تحميل هذا السؤال
          </div>
          <div className="text-sm text-white/70 mb-5">
            قد يكون السؤال محذوفاً أو الفئة معدّلة. أغلق هذا الكرت وجرّب كرتاً
            آخر.
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold"
          >
            إغلاق الكرت
          </button>
        </div>
      </motion.div>
    );
  }

  const transferAvailable =
    active.revealed && !active.transferUsed && !active.trapUsed;
  const onlyAnsweringTeamCanWin = active.transferUsed || active.trapUsed;

  const lowTimer = active.timeLeft <= 5 && timerRunning;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm"
      style={{ background: "rgba(31,77,79,0.55)" }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 60, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl overflow-y-auto relative"
        style={{
          maxHeight: "96dvh",
          background: "#faf6ec",
          border: "1px solid #ebe2cd",
          borderBottom: "none",
          boxShadow: "0 -8px 60px rgba(31,77,79,0.35), 0 24px 80px -20px rgba(31,77,79,0.5)",
          fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif",
        }}
      >
        {/* ── Top strip — cream + accent bar ── */}
        <div
          className="flex items-center gap-2 px-4 pt-4 pb-3 sticky top-0 z-10 relative"
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #ebe2cd",
            boxShadow: "0 4px 12px -8px rgba(31,77,79,0.15)",
          }}
        >
          {/* Animated accent bar tied to answering team */}
          <motion.div
            key={`bar-${active.answeringTeam}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute top-0 inset-x-0 h-1 origin-right"
            style={{ background: `linear-gradient(90deg, ${answeringTeam.color} 0%, #c9a14b 100%)` }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-extrabold tracking-wide mb-0.5 inline-flex items-center gap-1" style={{ color: "#5b6b87" }}>
              <span className="text-base">{sec?.emoji}</span>
              <span>{sub?.name}</span>
            </div>
            <div
              className="text-xl font-black leading-none inline-flex items-center gap-1"
              style={{
                color: active.difficulty === 800 ? "#a07f37" : "#1f4d4f",
                fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif",
              }}
            >
              {active.difficulty === 800 && (
                <motion.span
                  animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.18, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ fontSize: "0.85em", display: "inline-block", filter: "drop-shadow(0 2px 6px rgba(201,161,75,0.6))" }}
                >⭐</motion.span>
              )}
              <span className="tabular-nums">{active.difficulty}</span>
              {active.multiplier > 1 && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="ms-2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[12px] font-extrabold"
                  style={{ background: "linear-gradient(135deg, #c9a14b 0%, #b8860b 100%)", color: "white", boxShadow: "0 4px 12px -4px rgba(201,161,75,0.6)" }}
                >
                  × {active.multiplier}
                </motion.span>
              )}
            </div>
          </div>
          {/* Timer + close */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.div
              className="relative flex items-baseline gap-1 px-3 py-1.5 rounded-2xl"
              animate={lowTimer ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={lowTimer ? { duration: 0.6, repeat: Infinity } : {}}
              style={{
                background: lowTimer ? "rgba(220,38,38,0.10)" : "#faf6ec",
                border: `1.5px solid ${lowTimer ? "#dc2626" : "#ebe2cd"}`,
              }}
            >
              <span
                className="text-2xl font-black leading-none tabular-nums"
                style={{ color: lowTimer ? "#dc2626" : "#1f4d4f" }}
              >
                {active.timeLeft}
              </span>
              <span className="text-[10px] font-bold" style={{ color: lowTimer ? "#dc2626" : "#5b6b87" }}>ث</span>
            </motion.div>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="ms-1 p-1.5 rounded-lg"
              style={{ background: "#faf6ec", color: "#5b6b87", border: "1px solid #ebe2cd" }}
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="px-4 py-4 space-y-3 flex flex-col items-center">
          {/* Answering team badge — animated, vibrant */}
          <motion.div
            key={`banner-${active.answeringTeam}-${active.transferUsed}-${active.trapUsed}`}
            initial={{ scale: 0.85, opacity: 0, y: -6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            className="flex items-center justify-center gap-2.5 rounded-2xl px-5 py-2 w-fit mx-auto relative overflow-hidden"
            style={{
              background: "#ffffff",
              border: `2px solid ${answeringTeam.color}`,
              boxShadow: `0 6px 18px -6px ${answeringTeam.color}88`,
            }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ x: "-120%" }}
              animate={{ x: "120%" }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
              style={{ background: `linear-gradient(110deg, transparent 30%, ${answeringTeam.color}26 50%, transparent 70%)` }}
            />
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="text-2xl relative z-10"
            >{answeringTeam.emoji}</motion.span>
            <div className="min-w-0 relative z-10">
              <div className="text-[10px] font-extrabold tracking-wide" style={{ color: "#a07f37" }}>
                يجيب الآن
              </div>
              <div className="font-black text-base truncate leading-tight" style={{ color: answeringTeam.color, fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}>
                {answeringTeam.name}
              </div>
            </div>
            {active.trapUsed && (
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                className="ms-auto relative z-10 flex flex-col items-end gap-0.5"
              >
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                  style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5" }}
                >
                  🪤 فخ
                </span>
                {active.trapOwner && state.teams[active.trapOwner] && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={{
                      background: `${state.teams[active.trapOwner].color}18`,
                      color: state.teams[active.trapOwner].color,
                      border: `1px solid ${state.teams[active.trapOwner].color}44`,
                    }}
                  >
                    فشلوا؟ → {state.teams[active.trapOwner].emoji} {state.teams[active.trapOwner].name}
                  </span>
                )}
              </motion.div>
            )}
            {active.transferUsed && !active.trapUsed && (
              <motion.span
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                className="ms-auto relative z-10 text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #93c5fd" }}
              >
                ↔️ محوّل
              </motion.span>
            )}
            {active.twoAnswersActive && (
              <motion.span
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                className="ms-auto relative z-10 text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                style={{ background: "#fffbeb", color: "#a07f37", border: "1px solid #fcd34d" }}
              >
                2️⃣ جوابين
              </motion.span>
            )}
          </motion.div>
          {/* Question area — white card with gold corner accents */}
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="rounded-[28px] px-6 py-8 text-center mx-auto relative"
            style={{
              background: "#ffffff",
              border: "1.5px solid #ebe2cd",
              maxWidth: "900px",
              width: "100%",
              boxShadow: "0 12px 36px -12px rgba(31,77,79,0.18), 0 1px 3px rgba(0,0,0,0.04)",
              color: "#1f2937",
            }}
          >
            {/* Gold corner ornaments */}
            <div className="absolute top-3 right-3 w-6 h-6 rounded-tr-xl pointer-events-none" style={{ borderTop: "2px solid #c9a14b", borderRight: "2px solid #c9a14b" }} />
            <div className="absolute top-3 left-3 w-6 h-6 rounded-tl-xl pointer-events-none" style={{ borderTop: "2px solid #c9a14b", borderLeft: "2px solid #c9a14b" }} />
            <div className="absolute bottom-3 right-3 w-6 h-6 rounded-br-xl pointer-events-none" style={{ borderBottom: "2px solid #c9a14b", borderRight: "2px solid #c9a14b" }} />
            <div className="absolute bottom-3 left-3 w-6 h-6 rounded-bl-xl pointer-events-none" style={{ borderBottom: "2px solid #c9a14b", borderLeft: "2px solid #c9a14b" }} />

            <InteractiveActivity
              key={`${active.question.type ?? "text"}::${active.question.q}`}
              question={active.question}
              revealed={active.revealed}
              awardedPts={active.difficulty * active.multiplier}
              onAutoResolve={(winner, customPts) =>
                onResolve(
                  winner === null
                    ? null
                    : winner === "A"
                    ? active.answeringTeam
                    : getNextTeam(state.teamOrder, active.answeringTeam),
                  customPts,
                )
              }
              teamInfo={{
                A: { name: answeringTeam.name, color: answeringTeam.color },
                B: { name: otherTeam.name, color: otherTeam.color },
              }}
            />
            <AnimatePresence>
              {active.revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 18, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 240, damping: 22 }}
                  className="mt-5 px-5 py-4 rounded-2xl text-center relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, rgba(201,161,75,0.10) 0%, rgba(201,161,75,0.04) 100%)",
                    border: "2px solid #c9a14b",
                    boxShadow: "0 6px 20px -8px rgba(201,161,75,0.4)",
                  }}
                >
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ x: "-120%" }}
                    animate={{ x: "120%" }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{ background: "linear-gradient(110deg, transparent 30%, rgba(201,161,75,0.3) 50%, transparent 70%)" }}
                  />
                  <div className="text-[10px] font-extrabold tracking-[0.25em] mb-1.5 inline-flex items-center justify-center gap-1.5" style={{ color: "#a07f37" }}>
                    <Sparkles className="w-3 h-3" />
                    الإجابة الصحيحة
                    <Sparkles className="w-3 h-3" />
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold relative" style={{ color: "#1f4d4f", fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}>
                    {active.question.a}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Shura voting */}
          {active.shuraVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl overflow-hidden border border-blue-400/30 bg-blue-500/08"
              style={{ background: "rgba(59,130,246,0.08)" }}
            >
              <div
                className="flex items-center gap-2 px-3 py-2 bg-blue-500/12 border-b border-blue-400/15"
                style={{ background: "rgba(59,130,246,0.12)" }}
              >
                <span>🗣️</span>
                <span className="text-blue-200 font-bold text-xs">
                  تصويت الجمهور
                </span>
                <span className="text-blue-100/40 text-[10px] ms-auto">
                  {shuraVotes.a + shuraVotes.b} صوت
                </span>
              </div>
              <div className="px-3 py-2.5 space-y-1.5">
                {[
                  {
                    label: "خيار أ",
                    votes: shuraVotes.a,
                    color: "bg-blue-400",
                  },
                  {
                    label: "خيار ب",
                    votes: shuraVotes.b,
                    color: "bg-violet-400",
                  },
                ].map(({ label, votes, color }) => {
                  const total = shuraVotes.a + shuraVotes.b;
                  const pct =
                    total > 0 ? Math.round((votes / total) * 100) : 50;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] font-bold text-blue-100/70 mb-0.5">
                        <span>{label}</span>
                        <span>
                          {votes} ({pct}٪)
                        </span>
                      </div>
                      <div
                        className="h-2 rounded-full bg-white/8 overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.08)" }}
                      >
                        <motion.div
                          className={`h-full rounded-full ${color}`}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: "spring", stiffness: 80 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Helpers — split by team, cream theme */}
          {active.question.type !== "secret" && state.teamOrder.some(
            (side) => state.teams[side]?.helpers.length > 0,
          ) && (
            <div className="grid grid-cols-2 gap-3 w-full max-w-[900px] mx-auto">
              {state.teamOrder.slice(0, 2).map((side, index) => {
                const t = state.teams[side];
                if (!t || t.helpers.length === 0) return <div key={side} />;

                const isActive = active.answeringTeam === side;

                return (
                  <motion.div
                    key={side}
                    animate={{
                      opacity: isActive ? 1 : 0.5,
                      scale: isActive ? 1 : 0.98,
                    }}
                    transition={{ type: "spring", stiffness: 240, damping: 22 }}
                    className={`rounded-2xl p-2.5 relative overflow-hidden ${
                      index === 0 ? "text-right" : "text-left"
                    }`}
                    style={{
                      background: "#ffffff",
                      border: `1.5px solid ${isActive ? t.color : "#ebe2cd"}`,
                      boxShadow: isActive ? `0 6px 18px -8px ${t.color}66` : "0 1px 2px rgba(0,0,0,0.03)",
                    }}
                  >
                    {isActive && (
                      <div className="absolute top-0 inset-x-0 h-1" style={{ background: t.color }} />
                    )}
                    <div
                      className="text-[11px] font-black mb-2 truncate flex items-center gap-1.5 mt-1"
                      style={{
                        color: isActive ? t.color : "#5b6b87",
                        justifyContent: index === 0 ? "flex-end" : "flex-start",
                      }}
                    >
                      <span className="text-base">{t.emoji}</span>
                      <span>{t.name}</span>
                    </div>

                    <div
                      className={`flex flex-wrap gap-1.5 ${
                        index === 0 ? "justify-end" : "justify-start"
                      }`}
                    >
                      {t.helpers.map((hid) => {
                        const h = HELPERS.find((x) => x.id === hid);
                        if (!h) return null;

                        const usable = canUseHelper(side, hid);
                        const consumed = t.usedHelpers.includes(hid);

                        return (
                          <motion.button
                            key={hid}
                            whileHover={usable ? { y: -2, scale: 1.05 } : undefined}
                            whileTap={usable ? { scale: 0.94 } : undefined}
                            onClick={() => onUseHelper(side, hid)}
                            disabled={!usable}
                            title={consumed ? `${h.name} — تم استخدامه` : h.desc}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold transition relative overflow-hidden"
                            style={{
                              opacity: consumed ? 0.4 : usable ? 1 : 0.55,
                              filter: consumed ? "grayscale(0.8)" : undefined,
                              cursor: usable ? "pointer" : "not-allowed",
                              background: consumed
                                ? "#faf6ec"
                                : usable
                                ? `${t.color}14`
                                : "#faf6ec",
                              border: `1.5px solid ${consumed ? "#ebe2cd" : usable ? `${t.color}66` : "#e9dfc7"}`,
                              color: consumed ? "#9ca3af" : usable ? t.color : "#9ca3af",
                              boxShadow: usable ? `0 2px 6px -2px ${t.color}44` : undefined,
                            }}
                          >
                            {usable && !consumed && (
                              <motion.span
                                className="absolute inset-0 pointer-events-none"
                                initial={{ x: "-130%" }}
                                animate={{ x: "130%" }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 + (HELPERS.findIndex(x => x.id === hid) * 0.3), ease: "easeInOut" }}
                                style={{ background: `linear-gradient(110deg, transparent 30%, ${t.color}33 50%, transparent 70%)` }}
                              />
                            )}
                            <span className="relative text-base leading-none">{h.emoji}</span>
                            <span className="hidden sm:inline relative">{h.name}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          {/* Utility row — soft cream pills */}
          {active.question.type !== "secret" && (
          <div className="flex gap-1.5 flex-wrap justify-center">
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onReplaceQuestion}
              className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5 transition"
              style={{ background: "#ffffff", color: "#a07f37", border: "1px solid #e9dfc7" }}
            >
              <RefreshCw className="w-3 h-3" /> استبدال السؤال
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onReport}
              className="px-3 py-1.5 rounded-lg text-[11px] font-extrabold inline-flex items-center gap-1.5 transition"
              style={{ background: "#ffffff", color: "#b91c1c", border: "1px solid #fecaca" }}
            >
              <AlertTriangle className="w-3 h-3" /> إبلاغ
            </motion.button>
          </div>
          )}

          {/* Action buttons — timer + reveal + resolve, animated */}
          {active.question.type !== "secret" && (
          <div className="flex flex-wrap gap-2 pt-1 pb-2 w-full max-w-[900px]">
            {!timerRunning && !active.revealed && (
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={onStartTimer}
                className="flex-1 min-w-[120px] py-3 rounded-2xl font-extrabold text-sm inline-flex items-center justify-center gap-1.5 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #1f4d4f 0%, #2d5e3f 100%)",
                  color: "white",
                  boxShadow: "0 8px 20px -6px rgba(31,77,79,0.45)",
                }}
              >
                <motion.span
                  className="absolute inset-0 pointer-events-none"
                  initial={{ x: "-130%" }}
                  animate={{ x: "130%" }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
                  style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)" }}
                />
                <Clock className="w-4 h-4 relative" />
                <span className="relative">{active.timeLeft === 0 || active.timeLeft === state.timerSeconds
                  ? "بدء المؤقت"
                  : "متابعة"}</span>
              </motion.button>
            )}
            {timerRunning && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={onStopTimer}
                className="flex-1 min-w-[120px] py-3 rounded-2xl font-extrabold text-sm inline-flex items-center justify-center gap-1.5"
                style={{
                  background: "#ffffff",
                  color: "#1f4d4f",
                  border: "1.5px solid #e9dfc7",
                }}
              >
                إيقاف المؤقت
              </motion.button>
            )}
            {!active.revealed && (
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={onReveal}
                className="flex-1 min-w-[120px] py-3 rounded-2xl font-extrabold text-sm inline-flex items-center justify-center gap-1.5 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #c9a14b 0%, #b8860b 100%)",
                  color: "white",
                  boxShadow: "0 10px 24px -6px rgba(201,161,75,0.55)",
                }}
              >
                <motion.span
                  className="absolute inset-0 pointer-events-none"
                  initial={{ x: "-130%" }}
                  animate={{ x: "130%" }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
                  style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)" }}
                />
                <Eye className="w-4 h-4 relative" /> <span className="relative">كشف الإجابة</span>
              </motion.button>
            )}
            {active.revealed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 220 }}
                className="w-full flex flex-wrap gap-2"
              >
                {state.teamOrder.map((teamId) => {
                  const t = state.teams[teamId];
                  if (!t) return null;
                  const disabled = onlyAnsweringTeamCanWin && active.answeringTeam !== teamId;
                  return (
                    <motion.button
                      key={teamId}
                      whileHover={!disabled ? { scale: 1.04, y: -2 } : undefined}
                      whileTap={!disabled ? { scale: 0.94 } : undefined}
                      onClick={() => onResolve(teamId)}
                      disabled={disabled}
                      className="flex-1 min-w-[110px] py-3 rounded-2xl font-black text-white text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-25 disabled:cursor-not-allowed relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${t.color} 0%, ${t.color}dd 100%)`,
                        boxShadow: !disabled ? `0 8px 20px -6px ${t.color}99` : undefined,
                      }}
                    >
                      {!disabled && (
                        <motion.span
                          className="absolute inset-0 pointer-events-none"
                          initial={{ x: "-130%" }}
                          animate={{ x: "130%" }}
                          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
                          style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)" }}
                        />
                      )}
                      <span className="relative text-base">{t.emoji}</span> <span className="relative">{t.name} ✓</span>
                    </motion.button>
                  );
                })}
                {transferAvailable && (
                  <motion.button
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={onTransfer}
                    className="flex-1 min-w-[110px] py-3 rounded-2xl font-extrabold text-sm inline-flex items-center justify-center gap-1.5"
                    style={{
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1.5px solid #93c5fd",
                    }}
                  >
                    ↔️ {otherTeam.name}
                  </motion.button>
                )}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onResolve(null)}
                  className="flex-1 min-w-[110px] py-3 rounded-2xl font-extrabold text-sm inline-flex items-center justify-center gap-1.5"
                  style={active.trapUsed && active.trapOwner ? {
                    background: `${state.teams[active.trapOwner]?.color}14`,
                    color: state.teams[active.trapOwner]?.color ?? "#b91c1c",
                    border: `1.5px solid ${state.teams[active.trapOwner]?.color ?? "#b91c1c"}55`,
                  } : {
                    background: "#ffffff",
                    color: "#5b6b87",
                    border: "1.5px solid #e9dfc7",
                  }}
                >
                  {active.trapUsed && active.trapOwner
                    ? <>🪤 نقطة لـ {state.teams[active.trapOwner]?.name}</>
                    : "لا أحد"}
                </motion.button>
              </motion.div>
            )}
          </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────  Phone-a-friend overlay  ───────────────────────────── */

function FriendCallOverlay({
  seconds,
  team,
  onClose,
}: {
  seconds: number;
  team: { name: string; emoji: string; color: string };
  onClose: () => void;
}) {
  const pct = Math.max(0, Math.min(100, (seconds / 60) * 100));
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-none"
      style={{ background: "rgba(0,0,0,0.92)" }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        className="w-full max-w-2xl rounded-3xl p-8 sm:p-10 border-4 text-center"
        style={{
          background: "linear-gradient(160deg, #022c22, #064e3b)",
          borderColor: team.color,
          boxShadow: `0 0 80px -20px ${team.color}`,
        }}
      >
        <motion.div
          animate={{ rotate: [0, -8, 8, -8, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4"
          style={{
            background: `${team.color}33`,
            border: `3px solid ${team.color}`,
            willChange: "transform",
          }}
        >
          <Phone className="w-12 h-12" style={{ color: team.color }} />
        </motion.div>
        <div className="text-amber-200/80 text-sm font-bold tracking-widest mb-1">
          اتصال بصديق
        </div>
        <div className="text-2xl sm:text-3xl font-black text-white mb-1">
          {team.emoji} {team.name}
        </div>
        <div className="text-emerald-100/70 text-sm mb-6">
          لديك ٦٠ ثانية للاتصال بصديق وأخذ رأيه — لن يتم خصم وقت السؤال أثناء
          المكالمة
        </div>

        <div
          className={`text-7xl sm:text-9xl font-black mb-3 ${seconds <= 10 ? "text-red-400 animate-pulse" : "text-amber-300"}`}
        >
          {seconds}
        </div>
        <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-6">
          <motion.div
            className="h-full rounded-full"
            style={{ background: seconds <= 10 ? "#f87171" : team.color }}
            animate={{ width: `${pct}%` }}
            transition={{ ease: "linear", duration: 0.6 }}
          />
        </div>

        <button
          onClick={onClose}
          className="px-7 py-3 rounded-xl font-extrabold bg-white/10 hover:bg-white/20 text-white border border-white/20 inline-flex items-center gap-2"
        >
          <X className="w-5 h-5" />
          إنهاء المكالمة الآن
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────  Audience link helpers  ───────────────────────────── */

function buildAudienceUrl(code: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/game/arena/audience?code=${code}`;
}

function buildAudienceQrUrl(audienceUrl: string, size: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(audienceUrl)}`;
}

/* ─────────────────────────────  Share dialog (QR for audience)  ───────────────────────────── */

function ShareDialog({ onClose }: { onClose: () => void }) {
  const code = useMemo(() => getOrCreateShareCode(), []);
  const url = useMemo(() => buildAudienceUrl(code), [code]);
  const qrUrl = buildAudienceQrUrl(url, 260);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[65] flex items-center justify-center p-4 backdrop-blur-none"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md rounded-3xl p-7 border-4 text-center"
        style={{
          background: "linear-gradient(160deg, #064e3b, #022c22)",
          borderColor: "rgba(245,158,11,0.6)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-black text-amber-200 flex items-center gap-2">
            <Share2 className="w-6 h-6" />
            مشاركة مع الجمهور
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-emerald-100/80 text-sm mb-4">
          امسح الرمز أو افتح الرابط على الشاشة الكبيرة ليصوّت الجمهور أو يتابع
          اللعبة
        </p>
        <div className="bg-white p-3 rounded-2xl inline-block mb-4 shadow-2xl">
          <img src={qrUrl} alt="QR" className="w-56 h-56 block" />
        </div>
        <div className="text-amber-200 font-mono font-extrabold text-2xl tracking-[0.3em] mb-3">
          {code}
        </div>
        <div className="flex items-center gap-2 bg-black/40 rounded-lg p-2 mb-3">
          <input
            readOnly
            value={url}
            className="flex-1 bg-transparent text-emerald-100 text-xs px-2 py-1 outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={copy}
            className="px-3 py-1.5 rounded-md font-bold bg-amber-400 text-emerald-950 hover:bg-amber-300 inline-flex items-center gap-1.5 text-sm"
          >
            {copied ? (
              <CheckIcon className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? "نُسخ" : "نسخ"}
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20"
        >
          تم
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────  Report dialog  ───────────────────────────── */

function ReportDialog({
  question,
  answer,
  onClose,
  onSubmit,
}: {
  question: string;
  answer: string;
  onClose: () => void;
  onSubmit: (note: string, correctAnswer: string) => void;
}) {
  const [note, setNote] = useState("");
  const [correct, setCorrect] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{ background: "rgba(31,77,79,0.55)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl overflow-hidden relative"
        style={{
          background: "#ffffff",
          border: "1px solid #ebe2cd",
          boxShadow: "0 24px 60px -16px rgba(31,77,79,0.35), 0 0 0 4px rgba(201,161,75,0.18)",
        }}
        dir="rtl"
      >
        {/* Animated accent strip */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-1.5 origin-right"
          style={{ background: "linear-gradient(90deg, #c9a14b 0%, #a07f37 50%, #c9a14b 100%)" }}
        />
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black flex items-center gap-2" style={{ color: "#1f4d4f" }}>
              <motion.div
                animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2.5 }}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #c9a14b, #a07f37)",
                  boxShadow: "0 6px 16px -4px rgba(201,161,75,0.55)",
                }}
              >
                <AlertTriangle className="w-5 h-5 text-white" />
              </motion.div>
              إبلاغ عن خطأ في السؤال
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition"
              style={{ color: "#5b6b87" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#faf6ec"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="rounded-2xl p-4 mb-4 relative overflow-hidden" style={{ background: "#faf6ec", border: "1px solid #ebe2cd" }}>
            <div className="text-[10px] font-black mb-1 inline-flex items-center gap-1.5" style={{ color: "#a07f37" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#c9a14b" }} />
              السؤال
            </div>
            <div className="text-sm font-bold mb-3 leading-relaxed" style={{ color: "#1f2937" }}>{question}</div>
            <div className="text-[10px] font-black mb-1 inline-flex items-center gap-1.5" style={{ color: "#1f4d4f" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#2d5e3f" }} />
              الإجابة الحالية
            </div>
            <div className="text-sm font-bold leading-relaxed" style={{ color: "#1f4d4f" }}>{answer}</div>
          </div>

          <label className="block mb-3">
            <span className="text-sm font-extrabold mb-1.5 block" style={{ color: "#1f4d4f" }}>
              ما المشكلة؟ <span style={{ color: "#a07f37" }}>*</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="مثلاً: السؤال غير واضح، أو الإجابة غير دقيقة، أو الصورة لا تطابق..."
              className="w-full rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none"
              style={{
                background: "#ffffff",
                color: "#1f2937",
                border: "1.5px solid #ebe2cd",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#c9a14b"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,161,75,0.18)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#ebe2cd"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </label>

          <label className="block mb-5">
            <span className="text-sm font-extrabold mb-1.5 block" style={{ color: "#1f4d4f" }}>
              الإجابة الصحيحة المقترحة{" "}
              <span className="text-xs font-bold" style={{ color: "#5b6b87" }}>(اختياري)</span>
            </span>
            <input
              type="text"
              value={correct}
              onChange={(e) => setCorrect(e.target.value)}
              placeholder="ساعدنا — اكتب الإجابة التي تراها صحيحة"
              className="w-full rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none"
              style={{
                background: "#ffffff",
                color: "#1f2937",
                border: "1.5px solid #ebe2cd",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#c9a14b"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,161,75,0.18)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#ebe2cd"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </label>

          <div className="flex gap-2.5">
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm transition"
              style={{
                background: "#faf6ec",
                color: "#1f4d4f",
                border: "1px solid #ebe2cd",
              }}
            >
              إلغاء
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (!note.trim()) {
                  toast.error("اكتب وصف المشكلة");
                  return;
                }
                onSubmit(note.trim(), correct.trim());
              }}
              className="flex-1 py-2.5 rounded-xl font-black text-sm text-white relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #c9a14b 0%, #a07f37 100%)",
                boxShadow: "0 8px 22px -6px rgba(201,161,75,0.55)",
              }}
            >
              <motion.span
                aria-hidden
                className="absolute inset-0"
                animate={{ x: ["-130%", "130%"] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                  width: "60%",
                }}
              />
              <span className="relative inline-flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                إرسال البلاغ
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────  Confirm dialog  ───────────────────────────── */

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  confirmTone,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmTone: "amber" | "rose";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const tone =
    confirmTone === "rose"
      ? "bg-rose-500 hover:bg-rose-400 text-white"
      : "bg-amber-400 hover:bg-amber-300 text-emerald-950";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[68] flex items-center justify-center p-4 backdrop-blur-none"
      style={{ background: "rgba(0,0,0,0.85)" }}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-md rounded-3xl p-6 border-4 text-center"
        style={{
          background: "linear-gradient(160deg, #064e3b, #022c22)",
          borderColor: "rgba(245,158,11,0.5)",
        }}
      >
        <h2 className="text-2xl font-black text-amber-200 mb-2">{title}</h2>
        <p className="text-emerald-100/85 text-base mb-5 leading-relaxed">
          {body}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl font-extrabold ${tone}`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────  Rules overlay  ───────────────────────────── */

function RulesOverlay({
  teamA,
  teamB,
  onAck,
}: {
  teamA: { name: string; emoji: string; color: string };
  teamB: { name: string; emoji: string; color: string };
  onAck: () => void;
}) {
  return (
    <div
      dir="rtl"
      className="min-h-screen overflow-y-auto flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6"
      style={{ background: "#faf6ec", fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-3xl py-6"
      >
        {/* Header */}
        <div className="text-center mb-5">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold mb-3"
            style={{
              background: "rgba(31,77,79,0.08)",
              color: "#1f4d4f",
              border: "1px solid rgba(31,77,79,0.20)",
            }}
          >
            <BookOpen className="w-3 h-3" style={{ color: "#c9a14b" }} />
            قوانين تحدّي حصاد
          </div>
          <h1
            className="text-3xl sm:text-4xl font-black mb-2"
            style={{ lineHeight: 1.2, color: "#1f4d4f", fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}
          >
            استعدّوا للتحدّي
          </h1>
          <div className="flex items-center justify-center gap-2 text-lg">
            <span className="font-black" style={{ color: teamA.color }}>
              {teamA.emoji} {teamA.name}
            </span>
            <span style={{ color: "#5b6b87" }}>×</span>
            <span className="font-black" style={{ color: teamB.color }}>
              {teamB.emoji} {teamB.name}
            </span>
          </div>
        </div>

        {/* Rules panels */}
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <RulesPanel
            title="طريقة اللعب"
            items={[
              "كل فريق يختار 3 فئات — مجموع 6 فئات على اللوحة",
              "كل فئة فيها 6 بطاقات: 200 مرتين، 400 مرتين، 600 مرتين",
              "في كل دور يفتح الفريق صاحب الدور بطاقة من فئاته",
              "للمؤقت مدة محددة لكل سؤال — يديرها المنظّم",
              "ينتهي التحدّي حين تُفتح كل البطاقات، ويفوز صاحب أعلى نقاط",
            ]}
          />
          <RulesPanel
            title="ملاحظات مهمّة"
            items={[
              "لا يمكن لفريقين اختيار نفس الفئة الفرعية",
              "كل وسيلة مساعدة تُستخدم مرة واحدة فقط في المسابقة",
              "بعض الوسائل لها قيود على مَن يستخدمها ومتى",
              "يستطيع المنظّم تحويل السؤال يدوياً بعد كشف الإجابة",
              "إذا أضفت لاعبين، يمكنك تمييز من أجاب فعلاً من الفريق",
            ]}
          />
        </div>

        {/* Helpers — compact grid */}
        <div
          className="rounded-2xl p-4 mb-4"
          style={{
            background: "#ffffff",
            border: "1px solid #ebe2cd",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" style={{ color: "#c9a14b" }} />
            <h2 className="text-base font-extrabold" style={{ color: "#1f4d4f" }}>
              الوسائل المساعدة
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {HELPERS.map((h) => (
              <div
                key={h.id}
                className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
                style={{
                  background: "#faf6ec",
                  border: "1px solid #ebe2cd",
                }}
              >
                <span className="text-2xl shrink-0 leading-none mt-0.5">
                  {h.emoji}
                </span>
                <div>
                  <div className="font-extrabold text-sm leading-tight" style={{ color: "#1f4d4f" }}>
                    {h.name}
                  </div>
                  <div className="text-xs leading-relaxed mt-0.5" style={{ color: "#5b6b87" }}>
                    {h.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onAck}
          className="w-full py-4 rounded-2xl font-extrabold text-lg transition inline-flex items-center justify-center gap-2 hover:opacity-95"
          style={{
            background: "linear-gradient(135deg, #c9a14b 0%, #b8860b 100%)",
            color: "#ffffff",
            boxShadow: "0 12px 32px -10px rgba(201,161,75,0.6)",
          }}
        >
          <Sparkles className="w-5 h-5" />
          فهمنا — ابدأ اللعبة
        </button>
      </motion.div>
    </div>
  );
}

function RulesPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: "#ffffff",
        border: "1px solid #ebe2cd",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <h3 className="text-sm font-black mb-2" style={{ color: "#1f4d4f" }}>{title}</h3>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li
            key={i}
            className="text-xs sm:text-sm leading-relaxed flex gap-2"
            style={{ color: "#1f2937" }}
          >
            <span className="shrink-0 mt-0.5" style={{ color: "#c9a14b" }}>•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────  End screen  ───────────────────────────── */

function EndScreen({
  winnerTeam,
  teams,
  teamOrder,
  onRestart,
  onExit,
  onWinSound,
  publicMode,
  hasLastSettings,
  onQuickReplay,
}: {
  winnerTeam: {
    name: string;
    emoji: string;
    color: string;
    score: number;
  } | null;
  teams: ArenaState["teams"];
  teamOrder: string[];
  onRestart: () => void;
  onExit: () => void;
  onWinSound: () => void;
  publicMode?: boolean;
  hasLastSettings?: boolean;
  onQuickReplay?: () => void;
}) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareCode = useMemo(() => getOrCreateShareCode(), []);
  const audienceUrl = useMemo(() => buildAudienceUrl(shareCode), [shareCode]);
  const qrUrl = buildAudienceQrUrl(audienceUrl, 220);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(audienceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  useEffect(() => {
    if (!winnerTeam) return;
    const t = setTimeout(onWinSound, 200);
    return () => clearTimeout(t);
  }, [winnerTeam, onWinSound]);

  const showQuickReplay = publicMode && hasLastSettings && !!onQuickReplay;

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "#faf6ec", fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif" }}
    >
      <ConfettiBurst active={!!winnerTeam} />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="text-center z-10 w-full max-w-2xl rounded-3xl p-6 sm:p-10"
        style={{
          background: "#ffffff",
          border: "1px solid #ebe2cd",
          boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 24px 64px -24px rgba(31,77,79,0.25)",
        }}
      >
        {/* Trophy / result */}
        <div className="mb-5">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full" style={{ background: "rgba(201,161,75,0.14)", border: "2px solid rgba(201,161,75,0.35)" }}>
            <Trophy className="w-14 h-14" style={{ color: "#c9a14b", filter: "drop-shadow(0 4px 12px rgba(201,161,75,0.4))" }} />
          </div>
        </div>
        {winnerTeam ? (
          <>
            <div className="text-xs font-extrabold tracking-[0.3em] uppercase mb-2" style={{ color: "#a07f37" }}>
              الفائز
            </div>
            <div
              className="text-4xl sm:text-6xl font-black mb-2 leading-tight"
              style={{ color: winnerTeam.color, fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}
            >
              {winnerTeam.emoji} {winnerTeam.name}
            </div>
            <div
              className="text-2xl font-extrabold mb-8"
              style={{ color: "#1f4d4f" }}
            >
              {winnerTeam.score} <span className="text-lg" style={{ color: "#5b6b87" }}>نقطة</span>
            </div>
          </>
        ) : (
          <div className="text-4xl font-black mb-6" style={{ color: "#c9a14b" }}>
            تعادل!
          </div>
        )}

        {/* Score cards */}
        <div
          className={`grid gap-3 mb-8 ${teamOrder.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
        >
          {teamOrder.map((side) => {
            const t = teams[side];
            if (!t) return null;
            const isWinner = winnerTeam && t.color === winnerTeam.color && t.name === winnerTeam.name;
            return (
              <div
                key={side}
                className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: "#faf6ec",
                  border: `1.5px solid ${isWinner ? t.color : "#e9dfc7"}`,
                  boxShadow: isWinner ? `0 6px 20px -8px ${t.color}66` : "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                <div className="absolute top-0 inset-x-0 h-1" style={{ background: t.color }} />
                <div className="text-3xl mb-1 mt-1">{t.emoji}</div>
                <div className="font-black text-base mb-0.5 truncate" style={{ color: "#1f4d4f" }}>
                  {t.name}
                </div>
                <div
                  className="text-2xl font-extrabold tabular-nums"
                  style={{ color: t.color }}
                >
                  {t.score}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick replay — public mode only, shown prominently above other actions */}
        {showQuickReplay && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-4"
          >
            <button
              onClick={onQuickReplay}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg inline-flex items-center justify-center gap-2.5 hover:opacity-95 transition"
              style={{
                background: "linear-gradient(135deg, #1f4d4f 0%, #2d5e3f 100%)",
                color: "#fff",
                boxShadow: "0 12px 32px -10px rgba(31,77,79,0.55)",
              }}
            >
              <Zap className="w-5 h-5" />
              إعادة فورية بنفس الإعدادات
            </button>
            <div className="text-xs mt-2 font-bold" style={{ color: "#5b6b87" }}>
              يبدأ التحدّي فوراً بنفس الفرق والفئات — بدون خطوات الإعداد
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={onRestart}
            className="px-7 py-3.5 rounded-2xl font-extrabold text-lg inline-flex items-center gap-2 hover:opacity-95 transition"
            style={{
              background: "linear-gradient(135deg, #c9a14b 0%, #b8860b 100%)",
              color: "#ffffff",
              boxShadow: "0 8px 24px -8px rgba(201,161,75,0.55)",
            }}
          >
            <RotateCcw className="w-5 h-5" />
            {showQuickReplay ? "إعادة مع تغيير الإعدادات" : "إعادة اللعب"}
          </button>
          <button
            onClick={onExit}
            className="px-7 py-3.5 rounded-2xl font-bold text-lg inline-flex items-center gap-2 transition"
            style={{
              background: "#ffffff",
              color: "#1f4d4f",
              border: "1.5px solid #e9dfc7",
            }}
          >
            <Home className="w-5 h-5" />
            خروج
          </button>
        </div>

        {/* Collapsible share / QR section */}
        <div className="mt-6 w-full">
          <button
            onClick={() => setShowQr((v) => !v)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl font-bold text-sm transition hover:opacity-95"
            style={{ background: "#faf6ec", color: "#a07f37", border: "1.5px solid rgba(201,161,75,0.4)" }}
          >
            <Share2 className="w-4 h-4" />
            شارك النتيجة
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${showQr ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {showQr && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div
                  className="mt-3 rounded-2xl p-5 text-center"
                  style={{
                    background: "#faf6ec",
                    border: "1.5px solid rgba(201,161,75,0.35)",
                  }}
                >
                  <p className="text-xs mb-4" style={{ color: "#5b6b87" }}>
                    امسح الرمز ليرى المتأخرون النتيجة النهائية على شاشتهم
                  </p>
                  <div className="bg-white p-2.5 rounded-xl inline-block mb-3 shadow-lg" style={{ border: "1px solid #ebe2cd" }}>
                    <img src={qrUrl} alt="QR" className="w-44 h-44 block" />
                  </div>
                  <div className="font-mono font-extrabold text-xl tracking-[0.3em] mb-3" style={{ color: "#a07f37" }}>
                    {shareCode}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg p-2" style={{ background: "#ffffff", border: "1px solid #ebe2cd" }}>
                    <input
                      readOnly
                      value={audienceUrl}
                      className="flex-1 bg-transparent text-xs px-2 py-1 outline-none"
                      style={{ color: "#1f4d4f" }}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={copyUrl}
                      className="px-3 py-1.5 rounded-md font-bold inline-flex items-center gap-1.5 text-sm hover:opacity-90"
                      style={{ background: "#c9a14b", color: "white" }}
                    >
                      {copied ? (
                        <CheckIcon className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? "نُسخ" : "نسخ"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────  Team badge  ───────────────────────────── */

function TeamBadge({
  team,
  side,
  active,
  animation,
}: {
  team: {
    name: string;
    emoji: string;
    color: string;
    score: number;
    helpers: HelperId[];
    usedHelpers: HelperId[];
  };
  side: TeamSide;
  active: boolean;
  animation: {
    team: TeamSide;
    pts: number;
    difficulty: ArenaDifficulty;
    player?: string;
  } | null;
}) {
  return (
    <div
      className={`flex-1 rounded-xl p-2 border-2 transition relative overflow-hidden ${
        active ? "shadow-xl" : "opacity-80"
      }`}
      style={{
        background: active
          ? `linear-gradient(135deg, #ffffff 0%, ${team.color}20 100%)`
          : `linear-gradient(135deg, #f9f5ef 0%, ${team.color}12 100%)`,
        borderColor: active ? team.color : `${team.color}60`,
        boxShadow: active ? `0 0 20px -6px ${team.color}` : undefined,
      }}
    >
      <AnimatePresence>
        {animation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1.2, y: -28 }}
            exit={{ opacity: 0, y: -48 }}
            transition={{ duration: 1.4 }}
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10"
          >
            <div
              className="text-3xl font-black drop-shadow-lg"
              style={{
                color: animation.difficulty === 800 ? "#fde68a" : "#fcd34d",
                textShadow:
                  animation.difficulty === 800
                    ? "0 0 12px rgba(251,191,36,0.8), 0 0 24px rgba(251,191,36,0.4)"
                    : undefined,
              }}
            >
              +{animation.pts}
            </div>
            {animation.player && (
              <div className="text-xs font-bold text-white drop-shadow-md mt-0.5 px-2 py-0.5 rounded-full bg-black/50">
                {animation.player}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2">
        <div className="text-xl sm:text-2xl">{team.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-gray-900 text-sm truncate leading-tight">
            {team.name}
          </div>
          <div
            className="text-xl sm:text-2xl font-black leading-none"
            style={{ color: team.color }}
          >
            {team.score}
          </div>
          <div className="flex gap-0.5 mt-0.5 flex-wrap">
            {team.helpers.map((hid) => {
              const h = HELPERS.find((x) => x.id === hid);
              if (!h) return null;
              const used = team.usedHelpers.includes(hid);
              return (
                <span
                  key={hid}
                  className={`text-sm ${used ? "opacity-25 grayscale" : ""}`}
                  title={used ? `${h.name} — مستهلك` : h.name}
                >
                  {h.emoji}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Interactive Activity Renderers ───────────────────────────

function InteractiveActivity({
  question,
  revealed,
  onAutoResolve,
  teamInfo,
  awardedPts,
}: {
  question: ArenaQuestion;
  revealed: boolean;
  onAutoResolve?: (winner: "A" | "B" | null, customPts?: number) => void;
  teamInfo?: { A: { name: string; color: string }; B: { name: string; color: string } };
  awardedPts?: number;
}) {
  const t = question.type;
  if (t === "sin-jeem")
    return <SinJeemPlay question={question} revealed={revealed} />;
  if (t === "memory")
    return <MemoryPlay question={question} revealed={revealed} />;
  if (t === "categorize")
    return <CategorizePlay question={question} revealed={revealed} />;
  if (t === "logo") return <LogoPlay question={question} revealed={revealed} />;
  if (t === "audio") return <AudioPlay question={question} revealed={revealed} />;
  if (t === "secret")
    return (
      <SecretArenaActivity
        question={question}
        onAutoResolve={onAutoResolve}
        teamInfo={teamInfo}
        awardedPts={awardedPts}
      />
    );
  if (t === "image")
    return (
      <ImagePlay
        key={question.imageUrl ?? question.q}
        question={question}
        revealed={revealed}
      />
    );
  // Default: text/image/video
  return (
    <>
      {question.imageUrl && (
        <div className="mb-4 flex justify-center">
          <img
            src={question.imageUrl}
            alt="سؤال"
            decoding="async"
            {...({ fetchpriority: "high" } as any)}
            onError={(e) => {
              /* If the image URL is broken (e.g. blocked CDN), hide gracefully
               * instead of showing the torn-icon placeholder. */
              const el = e.currentTarget;
              el.style.display = "none";
              const wrap = el.parentElement;
              if (wrap) wrap.style.display = "none";
            }}
            className="max-h-[40vh] sm:max-h-[50vh] max-w-full rounded-2xl object-contain"
            style={{ boxShadow: "0 12px 40px -12px rgba(201,161,75,0.35)", border: "2px solid #c9a14b66", background: "#faf6ec" }}
          />
        </div>
      )}
      <div className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.4] mb-4" style={{ color: "#1f2937", fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}>
        {question.q}
      </div>
    </>
  );
}

/** Extract YouTube video ID from a URL */
function ytId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * AudioPlay — plays a YouTube audio embed or a direct audio URL.
 * Shows only an audio-player style UI (no video), plus the question text.
 * The answer is revealed on demand like all other question types.
 */
function AudioPlay({
  question,
  revealed,
}: {
  question: ArenaQuestion;
  revealed: boolean;
}) {
  const src = question.videoUrl ?? "";
  const yt = ytId(src);
  const isYt = !!yt;

  return (
    <div className="w-full flex flex-col items-center gap-6">
      {/* Audio player */}
      <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
           style={{ background: "#0d1520", border: "2px solid rgba(201,161,75,0.35)" }}>
        {isYt ? (
          /* YouTube embed — narrow height so it looks like an audio player */
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                 style={{ background: "linear-gradient(to bottom, transparent 0%, #0d1520 100%)" }}/>
            <iframe
              src={`https://www.youtube.com/embed/${yt}?autoplay=1&controls=1&rel=0&modestbranding=1`}
              title="صوت السؤال"
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="w-full"
              style={{ height: 120, border: "none" }}
            />
          </div>
        ) : (
          /* Direct audio file */
          <div className="p-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                   style={{ background: "rgba(201,161,75,0.2)", border: "2px solid #c9a14b" }}>
                🎵
              </div>
              <span className="text-white font-bold text-sm">صوت السؤال</span>
            </div>
            <audio
              controls
              autoPlay
              src={src}
              className="w-full"
              style={{ borderRadius: 8 }}
            />
          </div>
        )}

        {/* Animated sound-wave decoration */}
        <div className="flex items-end justify-center gap-1 px-4 pb-3 h-8">
          {[3,6,10,8,12,7,4,9,11,6,3,8,10,5,7].map((h, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 3,
                height: h,
                background: "#c9a14b",
                opacity: 0.6,
                animation: `pulse ${0.4 + i * 0.07}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Question description */}
      <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-[1.4] text-center"
           style={{ color: "#1f2937", fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}>
        {question.q}
      </div>

      {/* Answer — shown after reveal */}
      {revealed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="px-8 py-4 rounded-2xl font-extrabold text-2xl text-center"
          style={{ background: "linear-gradient(135deg,#1a4731,#0f2d1f)", border: "2px solid #c9a14b", color: "#fde68a" }}
        >
          {question.a}
        </motion.div>
      )}
    </div>
  );
}

function SinJeemPlay({
  question,
  revealed,
}: {
  question: ArenaQuestion;
  revealed: boolean;
}) {
  const payload = (question.payload ?? {}) as Partial<SinJeemPayload>;
  const letter = payload.letter ?? "؟";
  const prompts = payload.prompts ?? [];
  return (
    <div className="flex flex-col items-center gap-4 sm:gap-5">
      <div className="text-sm sm:text-base font-extrabold" style={{ color: "#a07f37" }}>
        أجب بكلمة تبدأ بحرف
      </div>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="text-[120px] sm:text-[180px] leading-none font-black select-none"
        style={{
          color: "#c9a14b",
          textShadow:
            "0 6px 24px rgba(201,161,75,0.45), 0 2px 0 rgba(160,127,55,0.25)",
          fontFamily: "'Amiri', 'Readex Pro', serif",
        }}
      >
        {letter}
      </motion.div>
      <div className="grid sm:grid-cols-2 gap-2.5 w-full max-w-3xl">
        {prompts.map((p, i) => (
          <div
            key={i}
            className="rounded-xl px-4 py-3 text-right transition"
            style={{ background: "#faf6ec", border: "1.5px solid #ebe2cd" }}
          >
            <div className="text-[11px] font-extrabold mb-1" style={{ color: "#a07f37" }}>
              سؤال {i + 1}
            </div>
            <div className="text-base sm:text-xl font-bold" style={{ color: "#1f2937" }}>
              {p.prompt}
            </div>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="mt-2 font-extrabold text-base sm:text-lg"
                style={{ color: "#1f4d4f" }}
              >
                ← {p.answer}
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface MemoryCardItem {
  id: string;
  pairId: number;
  side: { kind: "text" | "image"; value: string };
}

function MemoryPlay({
  question,
  revealed,
}: {
  question: ArenaQuestion;
  revealed: boolean;
}) {
  const payload = (question.payload ?? {}) as Partial<MemoryPayload>;
  const pairs = payload.pairs ?? [];

  const cards = useMemo<MemoryCardItem[]>(() => {
    const all: MemoryCardItem[] = [];
    pairs.forEach((p, i) => {
      all.push({ id: `${i}-a`, pairId: i, side: p.a });
      all.push({ id: `${i}-b`, pairId: i, side: p.b });
    });
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, [pairs]);

  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<number[]>([]);

  const handleClick = (card: MemoryCardItem) => {
    if (revealed) return;
    if (flipped.includes(card.id) || matched.includes(card.pairId)) return;
    if (flipped.length === 2) return;
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length === 2) {
      const a = cards.find((c) => c.id === next[0])!;
      const b = cards.find((c) => c.id === next[1])!;
      if (a.pairId === b.pairId) {
        setMatched((prev) => [...prev, a.pairId]);
        window.setTimeout(() => setFlipped([]), 700);
      } else {
        window.setTimeout(() => setFlipped([]), 1200);
      }
    }
  };

  if (cards.length === 0) {
    return <div style={{ color: "#a07f37" }}>لا توجد بطاقات للمطابقة.</div>;
  }

  const cols = cards.length <= 4 ? 2 : cards.length <= 6 ? 3 : 4;
  const allMatched = matched.length === pairs.length;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="text-sm font-extrabold" style={{ color: "#a07f37" }}>
        طابق الأزواج المتشابهة
        {!revealed && (
          <span className="ms-2" style={{ color: "#1f4d4f" }}>
            ({matched.length}/{pairs.length}){allMatched && " 🎉"}
          </span>
        )}
      </div>
      <div
        className="grid gap-2 sm:gap-3 w-full max-w-3xl"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {cards.map((card) => {
          const isFlipped =
            revealed ||
            flipped.includes(card.id) ||
            matched.includes(card.pairId);
          const isMatched = revealed || matched.includes(card.pairId);
          return (
            <motion.button
              key={card.id}
              onClick={() => handleClick(card)}
              whileHover={!isFlipped ? { scale: 1.04, y: -2 } : undefined}
              whileTap={!isFlipped ? { scale: 0.96 } : undefined}
              className="aspect-[4/5] rounded-xl border-2 transition flex items-center justify-center overflow-hidden relative shadow-lg"
              style={
                isFlipped
                  ? {
                      background: isMatched
                        ? "linear-gradient(160deg, #2d5e3f, #1f4d4f)"
                        : "linear-gradient(160deg, #ffffff, #faf6ec)",
                      borderColor: isMatched ? "#2d5e3f" : "#c9a14b",
                      boxShadow: isMatched
                        ? "0 6px 18px -6px rgba(45,94,63,0.5)"
                        : "0 4px 12px -4px rgba(201,161,75,0.3)",
                    }
                  : {
                      background: "linear-gradient(160deg, #c9a14b, #a07f37)",
                      borderColor: "#a07f37",
                    }
              }
            >
              {isFlipped ? (
                card.side.kind === "image" ? (
                  <img
                    src={card.side.value}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-sm sm:text-lg font-extrabold p-2 text-center break-words" style={{ color: isMatched ? "#ffffff" : "#1f2937" }}>
                    {card.side.value}
                  </div>
                )
              ) : (
                <div className="text-4xl sm:text-6xl font-black" style={{ color: "#ffffff", textShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>
                  ؟
                </div>
              )}
              {isMatched && !revealed && (
                <div className="absolute top-1 end-1 rounded-full p-0.5" style={{ background: "#c9a14b" }}>
                  <CheckIcon className="w-3 h-3 text-white" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function CategorizePlay({
  question,
  revealed,
}: {
  question: ArenaQuestion;
  revealed: boolean;
}) {
  const payload = (question.payload ?? {}) as Partial<CategorizePayload>;
  const groups = payload.groups ?? [];

  const allItems = useMemo(() => {
    const items: { item: string; groupIdx: number; key: string }[] = [];
    groups.forEach((g, gi) =>
      g.items.forEach((it, ii) =>
        items.push({ item: it, groupIdx: gi, key: `${gi}-${ii}` }),
      ),
    );
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [groups]);

  // Click an item, then click a group bucket to assign.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, number>>({});

  const assign = (groupIdx: number) => {
    if (!selectedKey) return;
    setAssignments((prev) => ({ ...prev, [selectedKey]: groupIdx }));
    setSelectedKey(null);
  };

  if (groups.length === 0) {
    return <div style={{ color: "#a07f37" }}>لا توجد عناصر للتصنيف.</div>;
  }

  if (revealed) {
    return (
      <div className="flex flex-col items-center gap-3 w-full">
        <div className="text-sm font-extrabold mb-1" style={{ color: "#a07f37" }}>
          التصنيف الصحيح
        </div>
        <div
          className="grid gap-2.5 w-full max-w-4xl"
          style={{
            gridTemplateColumns: `repeat(${Math.min(groups.length, 2)}, minmax(0,1fr))`,
          }}
        >
          {groups.map((g, gi) => (
            <div
              key={gi}
              className="rounded-xl p-3"
              style={{ background: "#faf6ec", border: "1.5px solid #2d5e3f" }}
            >
              <div className="font-extrabold text-base sm:text-lg mb-2 text-center" style={{ color: "#2d5e3f" }}>
                {g.name}
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {g.items.map((it, j) => (
                  <span
                    key={j}
                    className="px-3 py-1.5 rounded-lg text-white font-bold text-sm"
                    style={{ background: "linear-gradient(135deg, #2d5e3f, #1f4d4f)" }}
                  >
                    {it}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const unassigned = allItems.filter((it) => assignments[it.key] === undefined);
  const correctCount = Object.entries(assignments).filter(([key, gi]) => {
    const it = allItems.find((x) => x.key === key);
    return it && it.groupIdx === gi;
  }).length;

  return (
    <div className="flex flex-col gap-3 w-full max-w-4xl mx-auto">
      <div className="text-sm font-extrabold text-center" style={{ color: "#a07f37" }}>
        اضغط عنصراً ثم اضغط مجموعته
        {Object.keys(assignments).length > 0 && (
          <span className="ms-2" style={{ color: "#1f4d4f" }}>
            ({correctCount}/{Object.keys(assignments).length} صحيح)
          </span>
        )}
      </div>
      <div className="rounded-xl p-3" style={{ background: "#faf6ec", border: "1px solid #ebe2cd" }}>
        <div className="text-[11px] font-extrabold mb-2" style={{ color: "#5b6b87" }}>
          العناصر
        </div>
        <div className="flex flex-wrap gap-2 justify-center min-h-[3rem]">
          {unassigned.length === 0 ? (
            <div className="text-sm" style={{ color: "#5b6b87" }}>— تم تصنيف الكل —</div>
          ) : (
            unassigned.map((it) => (
              <button
                key={it.key}
                onClick={() =>
                  setSelectedKey(it.key === selectedKey ? null : it.key)
                }
                className="px-3 py-1.5 rounded-lg font-bold text-sm border-2 transition"
                style={
                  selectedKey === it.key
                    ? { background: "linear-gradient(135deg,#c9a14b,#a07f37)", color: "#ffffff", borderColor: "#a07f37", transform: "scale(1.08)", boxShadow: "0 6px 14px -4px rgba(201,161,75,0.5)" }
                    : { background: "#ffffff", color: "#1f2937", borderColor: "#e9dfc7" }
                }
              >
                {it.item}
              </button>
            ))
          )}
        </div>
      </div>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(groups.length, 2)}, minmax(0,1fr))`,
        }}
      >
        {groups.map((g, gi) => {
          const inside = Object.entries(assignments)
            .filter(([, gIdx]) => gIdx === gi)
            .map(([key]) => allItems.find((x) => x.key === key)!)
            .filter(Boolean);
          return (
            <button
              key={gi}
              onClick={() => assign(gi)}
              disabled={!selectedKey}
              className="rounded-xl border-2 p-3 min-h-[6rem] text-right transition"
              style={
                selectedKey
                  ? { borderColor: "#c9a14b", background: "rgba(201,161,75,0.08)", cursor: "pointer" }
                  : { borderColor: "#ebe2cd", background: "#ffffff", cursor: "default" }
              }
            >
              <div className="font-extrabold text-base sm:text-lg mb-2 text-center" style={{ color: "#1f4d4f" }}>
                {g.name}
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {inside.map((it) => {
                  const correct = it.groupIdx === gi;
                  return (
                    <span
                      key={it.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignments((prev) => {
                          const next = { ...prev };
                          delete next[it.key];
                          return next;
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg font-bold text-xs border cursor-pointer text-white"
                      style={correct
                        ? { background: "#2d5e3f", borderColor: "#1f4d4f" }
                        : { background: "#dc2626", borderColor: "#b91c1c" }}
                      title="اضغط لإزالته"
                    >
                      {it.item} {correct ? "✓" : "✗"}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImagePlay({
  question,
  revealed,
}: {
  question: ArenaQuestion;
  revealed: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {question.imageUrl ? (
        <div className="relative w-full flex justify-center">
          {status === "loading" && (
            <div className="w-64 h-44 rounded-2xl animate-pulse" style={{ background: "#f0e8d4" }} />
          )}
          {status === "error" && (
            <div className="w-64 h-44 rounded-2xl flex flex-col items-center justify-center gap-2" style={{ background: "#faf6ec", border: "2px solid #ebe2cd", color: "#a07f37" }}>
              <span className="text-4xl">🖼️</span>
              <span className="text-xs">تعذّر تحميل الصورة</span>
            </div>
          )}
          <img
            src={question.imageUrl}
            alt="سؤال مصوّر"
            decoding="async"
            {...({ fetchpriority: "high" } as any)}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className="max-h-[38vh] sm:max-h-[46vh] max-w-full rounded-2xl object-contain"
            style={{
              boxShadow: "0 12px 40px -12px rgba(201,161,75,0.45)",
              border: "2px solid #c9a14b88",
              background: "#faf6ec",
              opacity: status === "loaded" ? 1 : 0,
              transition: "opacity 0.35s ease",
              position: status === "loaded" ? "static" : "absolute",
              pointerEvents: status === "loaded" ? "auto" : "none",
            }}
          />
          {status === "loaded" && (
            <span className="absolute top-2 end-2 text-[10px] font-black px-2 py-0.5 rounded-full select-none text-white" style={{ background: "linear-gradient(135deg, #c9a14b, #a07f37)" }}>
              🖼️ سؤال مصوّر
            </span>
          )}
        </div>
      ) : (
        <div className="w-64 h-44 rounded-2xl flex items-center justify-center text-5xl" style={{ background: "#faf6ec", border: "2px solid #ebe2cd", color: "#a07f37" }}>
          🖼️
        </div>
      )}
      <div className="text-xl sm:text-3xl font-extrabold leading-[1.4] text-center px-2" style={{ color: "#1f2937", fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}>
        {question.q}
      </div>
    </div>
  );
}

function LogoPlay({
  question,
  revealed,
}: {
  question: ArenaQuestion;
  revealed: boolean;
}) {
  const payload = (question.payload ?? {}) as Partial<LogoPayload>;
  const [revealLevel, setRevealLevel] = useState(0); // 0..3
  const blur = revealed ? 0 : Math.max(0, 18 - revealLevel * 6);
  const hint = payload.hint;
  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative inline-block">
        {question.imageUrl ? (
          <img
            src={question.imageUrl}
            alt="logo"
            decoding="async"
            {...({ fetchpriority: "high" } as any)}
            className="max-h-[40vh] sm:max-h-[50vh] max-w-full rounded-2xl object-contain transition-all"
            style={{
              filter: `blur(${blur}px)`,
              border: "2px solid #c9a14b66",
              background: "#faf6ec",
              boxShadow: "0 12px 40px -12px rgba(201,161,75,0.35)",
            }}
          />
        ) : (
          <div className="w-64 h-40 rounded-2xl flex items-center justify-center" style={{ background: "#faf6ec", border: "2px solid #ebe2cd", color: "#a07f37" }}>
            لا توجد صورة
          </div>
        )}
      </div>
      {!revealed && question.imageUrl && (
        <motion.button
          whileHover={{ scale: 1.05, y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setRevealLevel((l) => Math.min(3, l + 1))}
          disabled={revealLevel >= 3}
          className="px-3 py-1.5 rounded-lg font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5 text-white"
          style={{ background: "linear-gradient(135deg, #c9a14b, #a07f37)", boxShadow: "0 4px 10px -3px rgba(201,161,75,0.55)" }}
        >
          <Eye className="w-3.5 h-3.5" />
          توضيح الشعار ({revealLevel}/3)
        </motion.button>
      )}
      <div className="text-2xl sm:text-3xl font-extrabold leading-[1.4]" style={{ color: "#1f2937", fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}>
        ما اسم هذا الشعار؟
      </div>
      {hint && !revealed && (
        <div className="text-sm rounded-lg px-3 py-1.5" style={{ color: "#1f4d4f", background: "rgba(31,77,79,0.08)", border: "1px solid #2d5e3f55" }}>
          💡 تلميح: {hint}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── اكتشف السر — Arena Integration ───────────────────────────

interface SecretArenaTeamState {
  name: string;
  color: string;
  scanned: boolean;
  questionCount: number;
  penalty: boolean;
}
interface SecretArenaGameState {
  pin: string;
  teams: { A: SecretArenaTeamState; B: SecretArenaTeamState };
  currentAsker: "A" | "B";
  totalQuestions: number;
  maxQuestions: number;
  phase: "waiting_scan" | "playing" | "guessing" | "ended";
  winner: "A" | "B" | null;
}
const MAX_SECRET_QUESTIONS = 10;

function calcSecretScore(used: number): number {
  if (used <= 3) return 600;
  if (used <= 6) return 400;
  if (used <= 9) return 200;
  return 0;
}

function SecretArenaActivity({
  question,
  onAutoResolve,
  teamInfo,
}: {
  question: ArenaQuestion;
  onAutoResolve?: (winner: "A" | "B" | null, customPts?: number) => void;
  teamInfo?: { A: { name: string; color: string }; B: { name: string; color: string } };
  awardedPts?: number;
}) {
  const payload = (question.payload ?? {}) as Partial<SecretPayload>;
  const categoryId = payload.categoryId ?? 1;

  const socketRef = React.useRef<ReturnType<typeof socketIOClient> | null>(null);
  const [status, setStatus] = React.useState<"connecting" | "ready" | "error">("connecting");
  const [gameState, setGameState] = React.useState<SecretArenaGameState | null>(null);
  const [tokenA, setTokenA] = React.useState<string>("");
  const [tokenB, setTokenB] = React.useState<string>("");
  const [qrTeam, setQrTeam] = React.useState<"A" | "B">("A");
  const [boxCountA, setBoxCountA] = React.useState(0);
  const [boxCountB, setBoxCountB] = React.useState(0);
  const [scoreResult, setScoreResult] = React.useState<{ team: "A" | "B"; score: number } | null>(null);
  const [undoFlashBox, setUndoFlashBox] = React.useState<{ A: number | null; B: number | null }>({ A: null, B: null });
  const [undoBtnFlash, setUndoBtnFlash] = React.useState<{ A: boolean; B: boolean }>({ A: false, B: false });
  const onAutoResolveRef = React.useRef(onAutoResolve);
  onAutoResolveRef.current = onAutoResolve;

  const BASE = typeof window !== "undefined" ? window.location.origin : "";

  React.useEffect(() => {
    const sock = socketIOClient(BASE, { path: "/api/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = sock;

    sock.on("connect", () => {
      const teamAName = teamInfo?.A.name ?? "الفريق الأول";
      const teamAColor = teamInfo?.A.color ?? "#dc2626";
      const teamBName = teamInfo?.B.name ?? "الفريق الثاني";
      const teamBColor = teamInfo?.B.color ?? "#2563eb";
      sock.emit(
        "secret:create",
        { categoryId, maxQuestions: MAX_SECRET_QUESTIONS, teamAName, teamAColor, teamBName, teamBColor },
        (res: { pin?: string; tokenA?: string; tokenB?: string; error?: string }) => {
          if (res.error || !res.pin) { setStatus("error"); return; }
          setTokenA(res.tokenA ?? "");
          setTokenB(res.tokenB ?? "");
          sock.emit(
            "secret:get_state",
            { pin: res.pin },
            (stateRes: { state?: SecretArenaGameState; error?: string }) => {
              if (stateRes.state) setGameState(stateRes.state);
              setStatus("ready");
            },
          );
        },
      );
    });
    sock.on("connect_error", () => setStatus("error"));
    sock.on("secret:state", (s: SecretArenaGameState) => {
      setGameState(s);
      setBoxCountA(s.teams.A.questionCount);
      setBoxCountB(s.teams.B.questionCount);
    });
    sock.on("secret:started", (s: SecretArenaGameState) => setGameState(s));

    return () => { sock.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPlaying = gameState?.phase === "playing";

  // Auto-zero: only when playing — if any team reaches the question limit, end the round with 0 points
  const autoZeroFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (scoreResult || autoZeroFiredRef.current || !gameState || !isPlaying) return;
    if (boxCountA < MAX_SECRET_QUESTIONS && boxCountB < MAX_SECRET_QUESTIONS) return;
    autoZeroFiredRef.current = true;
    const pin = gameState.pin;
    const zeroTeam: "A" | "B" = boxCountA >= MAX_SECRET_QUESTIONS ? "A" : "B";
    const timer = setTimeout(() => {
      socketRef.current?.emit(
        "secret:award_score",
        { pin, winner: null },
        (res: { ok?: boolean; score?: number; error?: string }) => {
          if (res.error) { autoZeroFiredRef.current = false; return; }
          setScoreResult({ team: zeroTeam, score: 0 });
          setTimeout(() => onAutoResolveRef.current?.(null, 0), 2000);
        },
      );
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxCountA, boxCountB, isPlaying]);

  const handleBoxClick = (team: "A" | "B") => {
    if (scoreResult || !isPlaying) return;
    const count = team === "A" ? boxCountA : boxCountB;
    const setCount = team === "A" ? setBoxCountA : setBoxCountB;
    if (count >= MAX_SECRET_QUESTIONS) return;
    // Optimistic local update for snappy UX (only in playing phase)
    setCount(count + 1);
    socketRef.current?.emit(
      "secret:team_question",
      { pin: gameState!.pin, team },
      (res: { ok?: boolean; questionCount?: number; error?: string }) => {
        if (res.error) {
          // Revert optimistic update on server rejection
          setCount(count);
        } else if (res.ok && res.questionCount !== undefined) {
          setCount(res.questionCount);
        }
      },
    );
  };

  const handleCorrect = (team: "A" | "B") => {
    if (scoreResult || !isPlaying || !gameState) return;
    socketRef.current?.emit(
      "secret:award_score",
      { pin: gameState.pin, winner: team },
      (res: { ok?: boolean; score?: number; error?: string }) => {
        if (res.error) return; // Server rejected — do not award
        const score = res.score ?? calcSecretScore(team === "A" ? boxCountA : boxCountB);
        setScoreResult({ team, score });
        setTimeout(() => onAutoResolveRef.current?.(team, score), 2500);
      },
    );
  };

  const handleUndo = (team: "A" | "B") => {
    if (scoreResult || !isPlaying || !gameState) return;
    const count = team === "A" ? boxCountA : boxCountB;
    const setCount = team === "A" ? setBoxCountA : setBoxCountB;
    if (count <= 0) return;
    // Flash the box that is being un-filled and pulse the undo button
    setUndoFlashBox((prev) => ({ ...prev, [team]: count }));
    setUndoBtnFlash((prev) => ({ ...prev, [team]: true }));
    setTimeout(() => setUndoFlashBox((prev) => ({ ...prev, [team]: null })), 420);
    setTimeout(() => setUndoBtnFlash((prev) => ({ ...prev, [team]: false })), 380);
    // Optimistic local update
    setCount(count - 1);
    socketRef.current?.emit(
      "secret:undo_question",
      { pin: gameState.pin, team },
      (res: { ok?: boolean; questionCount?: number; error?: string }) => {
        if (res.error) {
          // Revert on server rejection
          setCount(count);
        } else if (res.ok && res.questionCount !== undefined) {
          setCount(res.questionCount);
        }
      },
    );
  };

  const handleSkip = () => {
    if (!isPlaying || !gameState) return;
    socketRef.current?.emit(
      "secret:award_score",
      { pin: gameState.pin, winner: null },
      (res: { ok?: boolean; score?: number; error?: string }) => {
        if (res.error) return;
        onAutoResolveRef.current?.(null, 0);
      },
    );
  };

  if (status === "connecting") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-gray-500">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">جارٍ إنشاء جلسة اكتشف السر…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-red-500">
        <AlertTriangle className="w-8 h-8" />
        <p className="text-sm font-bold">تعذّر الاتصال بالسيرفر</p>
      </div>
    );
  }

  if (scoreResult) {
    const winnerInfo = scoreResult.team === "A" ? teamInfo?.A : teamInfo?.B;
    const usedCount = scoreResult.team === "A" ? boxCountA : boxCountB;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="flex flex-col items-center gap-4 py-4 text-center"
        dir="rtl"
      >
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
          className="text-5xl leading-none select-none"
        >
          🏆
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-xs font-bold uppercase tracking-widest text-purple-500 mb-1">أجاب صحيح!</p>
          <p className="text-xl font-black text-gray-800">
            {winnerInfo?.name ?? (scoreResult.team === "A" ? "الفريق أ" : "الفريق ب")}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 280, damping: 15 }}
          className="px-6 py-3 rounded-2xl font-black text-2xl text-white shadow-lg"
          style={{ background: winnerInfo?.color ?? "#7c3aed" }}
        >
          +{scoreResult.score} نقطة
        </motion.div>
        <p className="text-xs text-gray-400">{usedCount} سؤال مستهلك</p>
        <div className="w-full space-y-1.5">
          <p className="text-[11px] text-gray-400">سيتم إسناد النقاط للفريق الفائز تلقائياً…</p>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 2.5, ease: "linear" }}
              style={{ background: winnerInfo?.color ?? "#7c3aed" }}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-gray-500">
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">جارٍ تحميل حالة اللعبة…</p>
      </div>
    );
  }

  const pin = gameState.pin;
  const revealUrlA = `${BASE}/game/secret/reveal?token=${encodeURIComponent(tokenA)}`;
  const revealUrlB = `${BASE}/game/secret/reveal?token=${encodeURIComponent(tokenB)}`;

  return (
    <div className="w-full" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-purple-500" />
          <span className="font-black text-gray-800 text-lg">اكتشف السر</span>
        </div>
        <div className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded-lg" dir="ltr">{pin}</div>
      </div>

      {/* QR codes — one team at a time */}
      {(gameState.phase === "waiting_scan" || !gameState.teams.A.scanned || !gameState.teams.B.scanned) && (
        <div className="mb-4">
          <div className="flex gap-2 mb-3">
            {(["A", "B"] as const).map((t) => {
              const tInfo = t === "A" ? teamInfo?.A : teamInfo?.B;
              const scanned = gameState.teams[t].scanned;
              return (
                <button
                  key={t}
                  onClick={() => setQrTeam(t)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: qrTeam === t ? (tInfo?.color ?? "#7c3aed") : "#f3f4f6",
                    color: qrTeam === t ? "#fff" : "#6b7280",
                    border: `1.5px solid ${qrTeam === t ? (tInfo?.color ?? "#7c3aed") : "#e5e7eb"}`,
                  }}
                >
                  {gameState.teams[t].name}{scanned ? " ✅" : ""}
                </button>
              );
            })}
          </div>

          {gameState.teams[qrTeam].scanned ? (
            <div className="text-center py-4 text-green-600 font-bold text-sm">
              ✅ {gameState.teams[qrTeam].name} مسح الباركود بنجاح
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-2 p-4 rounded-xl border"
              style={{
                borderColor: `${(qrTeam === "A" ? teamInfo?.A : teamInfo?.B)?.color ?? "#888"}40`,
                background: `${(qrTeam === "A" ? teamInfo?.A : teamInfo?.B)?.color ?? "#888"}08`,
              }}
            >
              <p className="text-xs font-bold" style={{ color: (qrTeam === "A" ? teamInfo?.A : teamInfo?.B)?.color ?? "#888" }}>
                {gameState.teams[qrTeam].name}
              </p>
              <div className="bg-white p-2 rounded-xl">
                <QRCodeLib value={qrTeam === "A" ? revealUrlA : revealUrlB} size={130} />
              </div>
              <p className="text-xs text-gray-400">امسح الباركود لرؤية سرّك</p>
            </div>
          )}

          {gameState.phase === "waiting_scan" && (
            <div className="flex justify-center mt-3">
              <button
                onClick={() => socketRef.current?.emit("secret:force_start", { pin })}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors"
              >
                بدء اللعبة فوراً
              </button>
            </div>
          )}
        </div>
      )}

      {/* Per-team question boxes + correct answer buttons */}
      <div className="space-y-3 mt-2">
        {(["A", "B"] as const).map((t) => {
          const tInfo = t === "A" ? teamInfo?.A : teamInfo?.B;
          const count = t === "A" ? boxCountA : boxCountB;
          const tColor = tInfo?.color ?? (t === "A" ? "#dc2626" : "#2563eb");
          const tName = gameState.teams[t].name;
          const dynamicScore = calcSecretScore(count);
          const flashBox = t === "A" ? undoFlashBox.A : undoFlashBox.B;
          const btnFlash = t === "A" ? undoBtnFlash.A : undoBtnFlash.B;

          return (
            <div
              key={t}
              className="rounded-2xl border p-3"
              style={{ borderColor: `${tColor}30`, background: `${tColor}06` }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-black" style={{ color: tColor }}>{tName}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-gray-400">
                    {count}/{MAX_SECRET_QUESTIONS} سؤال
                  </span>
                  <button
                    type="button"
                    disabled={count === 0 || !!scoreResult || !isPlaying}
                    onClick={() => handleUndo(t)}
                    title="تراجع عن آخر سؤال"
                    className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed${btnFlash ? " undo-btn-pulse" : ""}`}
                    style={{
                      background: count > 0 && !scoreResult && isPlaying ? `${tColor}18` : "#f3f4f6",
                      color: count > 0 && !scoreResult && isPlaying ? tColor : "#9ca3af",
                      border: `1px solid ${count > 0 && !scoreResult && isPlaying ? `${tColor}40` : "#e5e7eb"}`,
                    }}
                  >
                    ↩
                  </button>
                </div>
              </div>

              {/* 10 numbered boxes — split into scoring zones */}
              {(() => {
                const zones: { label: string; from: number; to: number; zoneColor: string }[] = [
                  { label: "600 نقطة", from: 1, to: 3, zoneColor: "#16a34a" },
                  { label: "400 نقطة", from: 4, to: 6, zoneColor: "#ca8a04" },
                  { label: "200 نقطة", from: 7, to: 9, zoneColor: "#dc2626" },
                  { label: "0 نقطة",   from: 10, to: 10, zoneColor: "#6b7280" },
                ];
                return (
                  <div className="flex gap-1.5 mb-3 items-end">
                    {zones.map((zone, zi) => (
                      <div key={zone.label} className="flex flex-col items-center gap-0.5">
                        {/* Zone label */}
                        <span
                          className="text-[9px] font-black rounded px-1 py-0.5 leading-none whitespace-nowrap"
                          style={{ color: zone.zoneColor, background: `${zone.zoneColor}18` }}
                        >
                          {zone.label}
                        </span>
                        {/* Boxes in this zone */}
                        <div
                          className="flex gap-1 p-1 rounded-xl"
                          style={{ background: `${zone.zoneColor}12`, border: `1px dashed ${zone.zoneColor}40` }}
                        >
                          {Array.from({ length: zone.to - zone.from + 1 }, (_, i) => {
                            const boxNum = zone.from + i;
                            const isUsed = boxNum <= count;
                            const isNext = boxNum === count + 1 && count < MAX_SECRET_QUESTIONS;
                            const isFlashing = flashBox === boxNum;
                            return (
                              <button
                                key={boxNum}
                                type="button"
                                disabled={!isNext || !isPlaying}
                                onClick={() => { if (isNext) handleBoxClick(t); }}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black transition-all${isFlashing ? " undo-box-flash" : ""}`}
                                style={{
                                  background: isUsed ? tColor : isNext ? `${tColor}25` : "#f3f4f6",
                                  color: isUsed ? "#fff" : isNext ? tColor : "#9ca3af",
                                  border: `1.5px solid ${isUsed ? tColor : isNext ? tColor : "#e5e7eb"}`,
                                  transform: isNext ? "scale(1.1)" : "scale(1)",
                                  cursor: isNext ? "pointer" : "default",
                                  opacity: !isUsed && !isNext ? 0.45 : 1,
                                  boxShadow: isNext ? `0 0 0 2px ${tColor}30` : "none",
                                }}
                              >
                                {boxNum}
                              </button>
                            );
                          })}
                        </div>
                        {/* Divider between zones (not after last) */}
                        {zi < zones.length - 1 && (
                          <div className="h-1 w-1 rounded-full mt-0.5" style={{ background: "#d1d5db" }} />
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Correct answer button */}
              <button
                type="button"
                disabled={count >= MAX_SECRET_QUESTIONS || !!scoreResult || !isPlaying}
                onClick={() => handleCorrect(t)}
                className="w-full py-2 rounded-xl text-sm font-black text-white transition-all active:scale-95 disabled:opacity-40"
                style={{ background: tColor }}
              >
                ✅ أجاب صحيح — +{dynamicScore} نقطة
              </button>
            </div>
          );
        })}
      </div>

      {/* Skip */}
      <button
        type="button"
        disabled={!isPlaying || !!scoreResult}
        onClick={handleSkip}
        className="w-full mt-3 py-2 rounded-xl text-xs font-bold text-gray-400 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-40"
      >
        تخطّي بدون نقاط
      </button>
    </div>
  );
}

function GuessEntry({
  pin,
  teams,
  teamInfo,
  socketRef,
  answerer,
  answererTeam,
}: {
  pin: string;
  teams: { A: SecretArenaTeamState; B: SecretArenaTeamState };
  teamInfo?: { A: { name: string; color: string }; B: { name: string; color: string } };
  socketRef: React.RefObject<ReturnType<typeof socketIOClient> | null>;
  answerer: "A" | "B";
  answererTeam: SecretArenaTeamState;
}) {
  const [guess, setGuess] = React.useState("");
  const [guessingTeam, setGuessingTeam] = React.useState<"A" | "B">(answerer);
  const tInfo = guessingTeam === "A" ? teamInfo?.A : teamInfo?.B;

  const submitGuess = () => {
    if (!guess.trim()) return;
    socketRef.current?.emit("secret:guess", { pin, team: guessingTeam, guess: guess.trim() });
    setGuess("");
  };

  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-2">
      <p className="text-xs font-bold text-gray-500">تخمين الفريق</p>
      <div className="flex gap-1">
        {(["A", "B"] as const).map((t) => (
          <button key={t} onClick={() => setGuessingTeam(t)}
            className="flex-1 py-1 rounded-lg text-xs font-bold transition-colors"
            style={{
              background: guessingTeam === t ? (t === "A" ? teamInfo?.A.color : teamInfo?.B.color) ?? "#7c3aed" : "#f3f4f6",
              color: guessingTeam === t ? "#fff" : "#6b7280",
            }}>
            {teams[t].name}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitGuess()}
          placeholder={`تخمين ${tInfo?.name ?? ""}`}
          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-purple-300"
          dir="rtl"
        />
        <button onClick={submitGuess} disabled={!guess.trim()}
          className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-bold transition-colors">
          تخمين
        </button>
      </div>
      {teams[guessingTeam].penalty && (
        <p className="text-xs text-red-500 font-bold">⏳ هذا الفريق في فترة عقوبة (30 ثانية)</p>
      )}
    </div>
  );
}
