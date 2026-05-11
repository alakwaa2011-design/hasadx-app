import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Eye, Clock, RotateCcw, Home, Zap, X, Volume2, VolumeX,
  Maximize, Minimize, BookOpen, Sparkles, ChevronLeft, Share2, Flag,
  Phone, RefreshCw, AlertTriangle, Lock, LogIn, Copy, Check as CheckIcon, Tv2, ChevronDown,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { ConfettiBurst } from "@/components/confetti-burst";
import { toast } from "@/components/ui/sonner";
import {
  ARENA_SECTIONS, HELPERS, buildCustomSection,
  type ArenaDifficulty, type ArenaSection, type ArenaSubCategory,
  type HelperId, type ArenaQuestion,
  type MemoryPayload, type SinJeemPayload, type CategorizePayload, type LogoPayload,
} from "@/data/arena-questions";
import { getStaticCoverImage } from "@/data/arena-cover-images";
import {
  cardKey, getNextTeam, loadArenaState, otherSide, pickKey, saveArenaState,
  getSeenIndices, markQuestionSeen, clearSeenBucket,
  saveArenaReport, getOrCreateShareCode, getOrCreateWriteSecret,
  loadArenaLastSettings,
  type ArenaActiveQuestion, type ArenaCardSlot, type ArenaState, type TeamSide,
} from "@/lib/arena-store";

const POINT_VALUES: ArenaDifficulty[] = [200, 400, 600, 800];
const SLOTS: ArenaCardSlot[] = [1, 2];

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

function findSubCategory(
  id: string,
  sections: ArenaSection[] = ARENA_SECTIONS,
): ArenaSubCategory | undefined {
  for (const sec of sections) {
    const sub = sec.subCategories.find(s => s.id === id);
    if (sub) return sub;
  }
  return undefined;
}

function findSection(
  subId: string,
  sections: ArenaSection[] = ARENA_SECTIONS,
): ArenaSection | undefined {
  return sections.find(sec => sec.subCategories.some(s => s.id === subId));
}

export default function ArenaPlay() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<ArenaState | null>(null);
  const [phase, setPhase] = useState<"board" | "end">("board");
  const [pointAnimation, setPointAnimation] = useState<{ team: TeamSide; pts: number; difficulty: ArenaDifficulty; player?: string } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // After organiser picks the winning team we optionally show a player chooser
  // so a single individual gets credit (display only — total still goes to team).
  const [pendingWinner, setPendingWinner] = useState<TeamSide | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [friendActive, setFriendActive] = useState(false);
  const [friendSeconds, setFriendSeconds] = useState(60);
  const [shuraVotes, setShuraVotes] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncFingerprintRef = useRef<string>("");
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs so openCard callback stays stable across renders (no stale closures)
  const stateRef = useRef<ArenaState | null>(null);
  stateRef.current = state;
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
    if (state) saveArenaState(state);
  }, [state]);

  // Auto-save to server (debounced 2s) so the teacher can resume from any device.
  useEffect(() => {
    if (!state || !isLoggedIn || phase === "end") return;
    if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
    serverSaveTimerRef.current = setTimeout(() => {
      void fetch("/api/arena/save", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      }).catch(() => { /* best-effort */ });
    }, 2000);
    return () => { if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current); };
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
      void fetch("/api/arena/save", { method: "DELETE" }).catch(() => { /* best-effort */ });
    }
    if (!state?.publicMode) {
      sessionStorage.removeItem("arena_public_mode");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isLoggedIn]);

  useEffect(() => {
    if (!state) return;
    const totalCards = state.subCategoryIds.length * POINT_VALUES.length * SLOTS.length;
    if (state.usedCards.length >= totalCards && !state.active) {
      setPhase("end");
    }
  }, [state]);

  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => {
      setState(prev => {
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

  const playSound = (kind: "click" | "tick" | "buzz" | "correct" | "win") => {
    if (!soundOn) return;
    try {
      if (!audioCtxRef.current) {
        const Ctor = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      switch (kind) {
        case "click": o.frequency.value = 600; g.gain.setValueAtTime(0.08, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.08); o.start(now); o.stop(now + 0.1); break;
        case "tick": o.frequency.value = 880; g.gain.setValueAtTime(0.05, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.05); o.start(now); o.stop(now + 0.06); break;
        case "buzz": o.type = "sawtooth"; o.frequency.value = 180; g.gain.setValueAtTime(0.15, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.6); o.start(now); o.stop(now + 0.6); break;
        case "correct": o.frequency.value = 523; g.gain.setValueAtTime(0.1, now); o.frequency.exponentialRampToValueAtTime(880, now + 0.2); g.gain.exponentialRampToValueAtTime(0.001, now + 0.3); o.start(now); o.stop(now + 0.3); break;
        case "win": {
          const notes = [523, 659, 784, 1047];
          notes.forEach((f, i) => {
            const oo = ctx.createOscillator(); const gg = ctx.createGain();
            oo.connect(gg); gg.connect(ctx.destination);
            oo.frequency.value = f;
            gg.gain.setValueAtTime(0.0001, now + i * 0.15);
            gg.gain.exponentialRampToValueAtTime(0.12, now + i * 0.15 + 0.02);
            gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
            oo.start(now + i * 0.15); oo.stop(now + i * 0.15 + 0.45);
          });
          break;
        }
      }
    } catch {
      /* audio not available */
    }
  };

  const orderedSubCategoryIds = useMemo(() => state?.subCategoryIds ?? [], [state?.subCategoryIds]);

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
  const openCard = useCallback((subCategoryId: string, difficulty: ArenaDifficulty, slot: ArenaCardSlot) => {
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
    let candidates = allIndices.filter(i => !alreadyPicked.includes(i) && !seenAcrossGames.includes(i));
    if (candidates.length === 0) {
      candidates = allIndices.filter(i => !alreadyPicked.includes(i));
      if (candidates.length > 0) clearSeenBucket(subCategoryId, difficulty);
    }
    if (candidates.length === 0) candidates = allIndices;
    const qi = candidates[Math.floor(Math.random() * candidates.length)];
    markQuestionSeen(subCategoryId, difficulty, qi);
    const newActive: ArenaActiveQuestion = {
      subCategoryId, difficulty, slot, questionIndex: qi,
      question: pool[qi], multiplier: 1, answeringTeam: s.currentTurn,
      trapUsed: false, transferUsed: false, ghaneemaUsed: false,
      revealed: false, timeLeft: s.timerSeconds, helpersUsedThisQ: [], shuraVisible: false,
    };
    setState(prev => prev ? {
      ...prev,
      active: newActive,
      pickedQuestions: { ...prev.pickedQuestions, [bucketKey]: [...alreadyPicked, qi] },
    } : prev);
    setTimerRunning(true);
    playSound("click");
  // stable — reads state via ref, never changes reference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phone-a-friend countdown — independent of main timer.
  // Must be declared before any early return to keep hook order stable.
  useEffect(() => {
    if (!friendActive) return;
    if (friendSeconds <= 0) {
      setFriendActive(false);
      playSound("buzz");
      return;
    }
    const t = setTimeout(() => setFriendSeconds(s => s - 1), 1000);
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
        const res = await fetch(`/api/arena/session/${encodeURIComponent(code)}`);
        if (!res.ok) return;
        const data = await res.json() as { shuraVotes?: { a: number; b: number } };
        if (data.shuraVotes) setShuraVotes(data.shuraVotes);
      } catch { /* silent */ }
    };
    void fetchVotes();
    const t = setInterval(() => { void fetchVotes(); }, 3000);
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
          subCategoryName: findSubCategory(state.active.subCategoryId, allSections)?.name ?? "",
        }
      : null;
    const payload = {
      writeSecret: getOrCreateWriteSecret(),
      tournamentName: state.tournamentName,
      teams: state.teamOrder.map(id => ({
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
      }).catch(() => { /* silent fail — audience feature is best-effort */ });
    }, 500);
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  // allSections derives from state; watching both state and phase is required
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, phase]);

  /* ── difficulty colour tokens — defined before early returns so diffStyle is available in useMemo ── */
  const TILE_R = "14px";
  const TILE_SH = "0 1px 4px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.12)";
  const diffStyle = (pts: ArenaDifficulty, used: boolean): React.CSSProperties => {
    if (used) return {
      background: "rgba(0,0,0,0.05)", borderColor: "rgba(0,0,0,0.08)",
      color: "rgba(0,0,0,0.18)", cursor: "not-allowed",
      boxShadow: "none", borderRadius: TILE_R,
    };
    const base = { boxShadow: TILE_SH, borderRadius: TILE_R };
    if (pts === 200) return { ...base, background: "linear-gradient(160deg,#2457a8,#1e408e)", borderColor: "#183270", color: "#cfe0ff" };
    if (pts === 400) return { ...base, background: "linear-gradient(160deg,#5525a8,#421e88)", borderColor: "#311668", color: "#ddd5ff" };
    if (pts === 600) return { ...base, background: "linear-gradient(160deg,#922340,#7a1c34)", borderColor: "#561224", color: "#ffd5e0" };
    return                  { ...base, background: "linear-gradient(160deg,#b45309,#78350f)", borderColor: "#451a03", color: "#fef3c7", boxShadow: `${TILE_SH}, 0 0 8px rgba(251,191,36,0.35)` };
  };

  /* ── Game board grid — memoized HERE (before early returns) to keep hook order stable ─────────
     Rules of Hooks: useMemo must be called unconditionally. Placing it inside JSX after early
     returns violates this rule and causes React error #310 on phase transitions.                  */
  const boardGrid = useMemo(() => {
    const usedCards = state?.usedCards ?? [];
    const activeQ = state?.active ?? null;
    return (
      <div
        className="relative flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3"
        style={{
          padding: "clamp(10px, 2.5vw, 32px)",
          gap: "clamp(10px, 2.5vw, 32px)",
          gridAutoRows: "1fr",
        }}
      >
        {orderedSubCategoryIds.map(subId => {
          const sub = findSubCategory(subId, allSections);
          const sec = findSection(subId, allSections);
          if (!sub) return null;
          const imgUrl = sec ? getStaticCoverImage(sec.id, subId) : undefined;
          const accentColor = sub.cover?.color ?? sec?.cover?.color ?? "#4a6fa5";

          return (
            <div
              key={subId}
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: "rgba(22,27,34,0.95)",
                border: `1.5px solid ${accentColor}33`,
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: `0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
              }}
            >
              {/* Image / icon area */}
              <div className="relative overflow-hidden" style={{ height: "clamp(60px, 13vw, 160px)", flexShrink: 0 }}>
                {imgUrl ? (
                  <img src={imgUrl} alt={sub.name} className="absolute inset-0 w-full h-full" style={{ objectFit: "cover", objectPosition: "center", filter: "brightness(0.85) saturate(0.9)" }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ background: `linear-gradient(160deg, ${accentColor}18 0%, ${accentColor}35 100%)`, color: accentColor }}>
                    {sec?.emoji ?? "📚"}
                  </div>
                )}
                {/* Gradient overlay for text readability */}
                <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: "linear-gradient(to bottom, transparent, rgba(14,17,23,0.85))" }} />
              </div>
              {/* Name strip */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "5px 8px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)", borderTop: `1px solid ${accentColor}33` }}>
                {sec?.emoji && <span style={{ fontSize: "clamp(11px, 2.4vw, 15px)", lineHeight: 1 }}>{sec.emoji}</span>}
                <span style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: 900, fontSize: "clamp(11px, 2.6vw, 16px)", color: "#f1f5f9", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {sub.name}
                </span>
              </div>
              {/* Buttons grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px", padding: "4px" }}>
                {POINT_VALUES.map(pts => {
                  const keyA = cardKey({ subCategoryId: subId, difficulty: pts, slot: 1 });
                  const keyB = cardKey({ subCategoryId: subId, difficulty: pts, slot: 2 });
                  const usedA = usedCards.includes(keyA);
                  const usedB = usedCards.includes(keyB);
                  return (
                    <React.Fragment key={pts}>
                      <motion.button
                        whileHover={!usedA && !activeQ ? { scale: 1.05, y: -1 } : undefined}
                        whileTap={!usedA && !activeQ ? { scale: 0.94 } : undefined}
                        onClick={() => !usedA && !activeQ && openCard(subId, pts, 1)}
                        disabled={usedA || !!activeQ}
                        className="font-bold border transition-all flex items-center justify-center"
                        style={{ height: "clamp(26px, 5vw, 34px)", fontFamily: "'Tajawal', sans-serif", fontSize: "clamp(11px, 2.5vw, 14px)", ...diffStyle(pts, usedA) }}
                      >
                        {usedA ? "—" : pts}
                      </motion.button>
                      <motion.button
                        whileHover={!usedB && !activeQ ? { scale: 1.05, y: -1 } : undefined}
                        whileTap={!usedB && !activeQ ? { scale: 0.94 } : undefined}
                        onClick={() => !usedB && !activeQ && openCard(subId, pts, 2)}
                        disabled={usedB || !!activeQ}
                        className="font-bold border transition-all flex items-center justify-center"
                        style={{ height: "clamp(26px, 5vw, 34px)", fontFamily: "'Tajawal', sans-serif", fontSize: "clamp(11px, 2.5vw, 14px)", ...diffStyle(pts, usedB) }}
                      >
                        {usedB ? "—" : pts}
                      </motion.button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedSubCategoryIds, allSections, state?.usedCards, !!(state?.active), openCard]);

  if (!state) return null;

  const totalCards = orderedSubCategoryIds.length * POINT_VALUES.length * SLOTS.length;
  const usedCount = state.usedCards.length;
  const active = state.active;

  // openCard is now defined as useCallback above early returns (uses stateRef)

  const updateActive = (patch: Partial<ArenaActiveQuestion>) => {
    setState(prev => {
      if (!prev || !prev.active) return prev;
      return { ...prev, active: { ...prev.active, ...patch } };
    });
  };

  const consumeHelperFrom = (side: TeamSide, helperId: HelperId) => {
    setState(prev => {
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
    if (helperId === "ghaneema") {
      return (
        side !== active.answeringTeam &&
        !active.ghaneemaUsed &&
        !active.transferUsed &&
        !active.trapUsed
      );
    }
    if (helperId === "trap") {
      return side === state.currentTurn && !active.trapUsed && !active.transferUsed;
    }
    return side === active.answeringTeam;
  };

  const useHelper = (side: TeamSide, helperId: HelperId) => {
    if (!active || !canUseHelper(side, helperId)) return;
    if (helperId === "harvest") {
      updateActive({ multiplier: 2, helpersUsedThisQ: [...active.helpersUsedThisQ, helperId] });
    } else if (helperId === "shura") {
      setTimerRunning(false);
      updateActive({ shuraVisible: true, helpersUsedThisQ: [...active.helpersUsedThisQ, helperId] });
    } else if (helperId === "trap") {
      updateActive({
        trapUsed: true,
        answeringTeam: otherSide(active.answeringTeam),
        helpersUsedThisQ: [...active.helpersUsedThisQ, helperId],
      });
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
    } else if (helperId === "ghaneema") {
      setTimerRunning(false);
      updateActive({
        ghaneemaUsed: true,
        answeringTeam: side,
        transferUsed: true,
        revealed: false,
        shuraVisible: false,
        timeLeft: state.timerSeconds,
        helpersUsedThisQ: [...active.helpersUsedThisQ, helperId],
      });
    } else if (helperId === "friend") {
      setTimerRunning(false);
      setFriendSeconds(60);
      setFriendActive(true);
      updateActive({ helpersUsedThisQ: [...active.helpersUsedThisQ, helperId] });
    }
    consumeHelperFrom(side, helperId);
    playSound("click");
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
    saveArenaReport({
      subCategoryId: active.subCategoryId,
      difficulty: active.difficulty,
      question: active.question.q,
      answer: active.question.a,
      note,
      correctAnswer: correctAnswer || undefined,
    });
    setShowReport(false);
    toast.success("تم إرسال البلاغ — شكراً");
  };

  const reveal = () => {
    if (!active) return;
    setTimerRunning(false);
    updateActive({ revealed: true });
    playSound("click");
  };

  const transferToOther = () => {
    if (!active || active.transferUsed || active.trapUsed) return;
    setState(prev => {
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
  const requestResolve = (winner: TeamSide | null) => {
    if (!active) return;
    if (winner && state.teams[winner].players.length > 0) {
      setPendingWinner(winner);
      return;
    }
    finalizeResolve(winner, undefined);
  };

  const finalizeResolve = (winner: TeamSide | null, player: string | undefined) => {
    if (!active) return;
    const pts = active.difficulty * active.multiplier;
    const key = cardKey({ subCategoryId: active.subCategoryId, difficulty: active.difficulty, slot: active.slot });
    if (winner) {
      setPointAnimation({ team: winner, pts, difficulty: active.difficulty, player });
      playSound("correct");
      setTimeout(() => setPointAnimation(null), 1800);
    } else {
      playSound("buzz");
    }
    setState(prev => {
      if (!prev) return prev;
      const newTeams = { ...prev.teams };
      if (winner) {
        newTeams[winner] = { ...newTeams[winner], score: newTeams[winner].score + pts };
      }
      return {
        ...prev,
        teams: newTeams,
        usedCards: prev.usedCards.includes(key) ? prev.usedCards : [...prev.usedCards, key],
        currentTurn: getNextTeam(prev.teamOrder, prev.currentTurn),
        active: null,
      };
    });
    setTimerRunning(false);
    setPendingWinner(null);
  };

  const closeQuestionUnresolved = () => {
    if (!active) return;
    setState(prev => prev ? { ...prev, active: null } : prev);
    setTimerRunning(false);
  };

  const restart = () => {
    const isPublic = state?.publicMode ?? sessionStorage.getItem("arena_public_mode") === "1";
    saveArenaState(null);
    sessionStorage.removeItem("arena_public_mode");
    void fetch("/api/arena/save", { method: "DELETE" }).catch(() => { /* best-effort */ });
    setLocation(isPublic ? "/play/arena" : "/game/arena");
  };

  // Exit but keep the state so the host can come back and continue.
  const exitKeep = () => {
    const wasPublic = state?.publicMode || sessionStorage.getItem("arena_public_mode") === "1";
    setLocation(wasPublic ? "/games" : "/teacher");
  };

  // Force end the game (winner is computed from current scores).
  const forceEnd = () => {
    setShowEndConfirm(false);
    setPhase("end");
  };

  const isPublicGame = state?.publicMode || sessionStorage.getItem("arena_public_mode") === "1";
  if (isLoggedIn === false && !isPublicGame) {
    return <ArenaLoginGate />;
  }

  if (phase === "end") {
    const sortedEntries = state.teamOrder
      .map(id => ({ id, team: state.teams[id] }))
      .filter(x => x.team)
      .sort((a, b) => b.team.score - a.team.score);
    const topScore = sortedEntries[0]?.team.score ?? 0;
    const topWinners = sortedEntries.filter(x => x.team.score === topScore);
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
        t =>
          t.subCategoryIds.length === 3 &&
          t.subCategoryIds.every(id => !!findSubCategory(id, sections)),
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
        subCategoryIds: lastSettings.teams.flatMap(t => t.subCategoryIds),
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
        rulesAck: false,
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

  const teamA = state.teams[state.teamOrder[0]] ?? Object.values(state.teams)[0];
  const teamB = state.teams[state.teamOrder[1]] ?? Object.values(state.teams)[1] ?? teamA;

  if (!state.rulesAck) {
    return (
      <RulesOverlay
        teamA={teamA}
        teamB={teamB}
        onAck={() => setState(prev => prev ? { ...prev, rulesAck: true } : prev)}
      />
    );
  }

  const turnTeam = state.teams[state.currentTurn] ?? teamA;

  return (
    <div dir="rtl" className="h-screen overflow-hidden flex flex-col" style={{ background: "#0e1117", fontFamily: "'Tajawal', sans-serif" }}>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header className="shrink-0" style={{ background: "rgba(16,20,28,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Row 1 — scores */}
        <div className="flex items-stretch gap-1.5 px-2 pt-2 pb-1">

          {/* Teams (first two) */}
          {state.teamOrder.slice(0, 2).map(teamId => {
            const t = state.teams[teamId];
            if (!t) return null;
            const isActive = state.currentTurn === teamId;
            return (
              <motion.div
                key={teamId}
                animate={{ scale: isActive ? 1 : 0.97, opacity: isActive ? 1 : 0.6 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 min-w-0 flex-1"
                style={{
                  background: isActive ? `${t.color}22` : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${isActive ? t.color + "88" : "rgba(255,255,255,0.07)"}`,
                  boxShadow: isActive ? `0 0 16px -4px ${t.color}66` : undefined,
                }}
              >
                <span className="text-xl leading-none shrink-0">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-white text-xs truncate leading-tight">{t.name}</div>
                  <div className="font-black text-base leading-tight" style={{ color: t.color }}>{t.score}</div>
                  {isActive && (
                    <div className="text-[9px] font-bold mt-0.5" style={{ color: t.color }}>● دوره الآن</div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Center: logo + progress */}
          <div className="flex flex-col items-center justify-center px-2 shrink-0">
            <div className="text-[9px] font-black tracking-[0.2em] text-emerald-400/70">تحدّي</div>
            <div className="text-sm font-black text-white leading-tight">حصاد 🌾</div>
            <div className="text-[9px] text-white/30 mt-0.5">{usedCount}/{totalCards}</div>
          </div>

          {/* Extra teams (3+) */}
          {state.teamOrder.slice(2).map(teamId => {
            const t = state.teams[teamId];
            if (!t) return null;
            const isActive = state.currentTurn === teamId;
            return (
              <div
                key={teamId}
                className="flex items-center gap-1 rounded-xl px-2 py-1.5 flex-1"
                style={{
                  background: isActive ? `${t.color}22` : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${isActive ? t.color + "66" : "rgba(255,255,255,0.07)"}`,
                  opacity: isActive ? 1 : 0.6,
                }}
              >
                <span className="text-lg shrink-0">{t.emoji}</span>
                <div className="font-black text-xs text-white truncate">{t.name}</div>
                <div className="font-black text-sm ms-auto" style={{ color: t.color }}>{t.score}</div>
              </div>
            );
          })}
        </div>

        {/* Row 2 — turn pill + action buttons */}
        <div className="flex items-center px-2 pb-2 gap-2">
          {/* Turn pill */}
          <motion.div
            key={state.currentTurn}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 flex-1 min-w-0 rounded-lg px-2.5 py-1"
            style={{ background: `${turnTeam.color}18`, border: `1px solid ${turnTeam.color}44` }}
          >
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="text-base leading-none shrink-0"
            >
              {turnTeam.emoji}
            </motion.span>
            <span className="text-[10px] text-white/50 shrink-0">الدور:</span>
            <span className="font-black text-xs truncate" style={{ color: turnTeam.color }}>{turnTeam.name}</span>
          </motion.div>

          {/* Action icon buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {[
              { icon: soundOn ? <Volume2 className="w-4 h-4"/> : <VolumeX className="w-4 h-4"/>, action: () => setSoundOn(s => !s), label: soundOn ? "صوت" : "صامت" },
              { icon: isFullscreen ? <Minimize className="w-4 h-4"/> : <Maximize className="w-4 h-4"/>, action: toggleFullscreen, label: "شاشة" },
              { icon: <BookOpen className="w-4 h-4"/>, action: () => setState(prev => prev ? { ...prev, rulesAck: false } : prev), label: "قواعد" },
              { icon: <Share2 className="w-4 h-4"/>, action: () => setShowShare(true), label: "مشاركة" },
              { icon: <RotateCcw className="w-4 h-4"/>, action: () => setShowRestartConfirm(true), label: "إعادة" },
              { icon: <Flag className="w-4 h-4"/>, action: () => setShowEndConfirm(true), label: "إنهاء" },
              { icon: <Home className="w-4 h-4"/>, action: exitKeep, label: "خروج" },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                title={btn.label}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
              >
                {btn.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3 — Audience mode strip (public games only) */}
        {isPublicGame && (
          <button
            onClick={() => setShowShare(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold transition-all hover:brightness-125"
            style={{ background: "linear-gradient(90deg,#065f46,#047857)", borderTop: "1px solid rgba(52,211,153,0.2)" }}
          >
            <Tv2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span className="text-emerald-200">وضع المتفرج — شارك رابط الجمهور مع شاشة ثانية</span>
            <Share2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
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
            onPick={(player) => finalizeResolve(pendingWinner, player)}
            onSkip={() => finalizeResolve(pendingWinner, undefined)}
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
        {showShare && (
          <ShareDialog onClose={() => setShowShare(false)} />
        )}
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
            onConfirm={() => { setShowRestartConfirm(false); restart(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────  Login gate  ───────────────────────────── */

function ArenaLoginGate() {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-6" style={{
      background: "radial-gradient(ellipse at top, #064e3b 0%, #022c22 60%, #000 100%)",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl rounded-3xl p-8 sm:p-10 border-4 text-center backdrop-blur-sm"
        style={{
          background: "linear-gradient(160deg, rgba(6,78,59,0.95), rgba(2,44,34,0.95))",
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

function TurnIndicator({ team, side }: {
  team: { name: string; emoji: string; color: string };
  side: TeamSide;
}) {
  return (
    <div className="relative px-3 py-1.5 flex items-center justify-center">
      <motion.div
        key={`${side}-${team.name}`}
        initial={{ scale: 0.85, opacity: 0, y: -8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="relative inline-flex items-center gap-2 sm:gap-3 rounded-xl px-4 sm:px-5 py-1.5 sm:py-2 border"
        style={{
          background: `linear-gradient(120deg, ${team.color}22 0%, ${team.color}44 50%, ${team.color}22 100%)`,
          borderColor: `${team.color}88`,
          boxShadow: `0 4px 18px -4px ${team.color}66`,
          fontFamily: "'Tajawal', sans-serif",
        }}
      >
        <motion.span
          animate={{ scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="text-2xl sm:text-3xl drop-shadow-lg relative"
          style={{ willChange: "transform" }}
        >
          {team.emoji}
        </motion.span>
        <div className="relative text-right">
          <div className="text-[9px] font-black tracking-[0.3em] uppercase text-white/70 flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-amber-300" />
            الدور الآن
          </div>
          <div
            className="text-lg sm:text-2xl font-black text-white drop-shadow-lg"
            style={{ textShadow: `0 2px 18px ${team.color}`, lineHeight: 1.1 }}
          >
            {team.name}
          </div>
        </div>
        <motion.div
          animate={{ x: [0, -4, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          style={{ willChange: "transform" }}
        >
          <ChevronLeft className="w-5 h-5 text-amber-300" />
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────  Player picker  ───────────────────────────── */

function PlayerPickerOverlay({
  team, side, onPick, onSkip,
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
        <div className="text-amber-200/80 text-sm font-bold mb-1">من أجاب من</div>
        <div className="text-3xl sm:text-4xl font-black mb-5" style={{ color: team.color }}>
          {team.name}؟
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          {team.players.map(p => (
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
  state, active, sections, timerRunning, shuraVotes,
  onStartTimer, onStopTimer, onReveal, onTransfer, onResolve, onClose,
  onUseHelper, canUseHelper, onReplaceQuestion, onReport,
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
  onResolve: (winner: TeamSide | null) => void;
  onClose: () => void;
  onUseHelper: (side: TeamSide, helperId: HelperId) => void;
  canUseHelper: (side: TeamSide, helperId: HelperId) => boolean;
  onReplaceQuestion: () => void;
  onReport: () => void;
}) {
  const teamA = state.teams[state.teamOrder[0]] ?? Object.values(state.teams)[0];
  const teamB = state.teams[state.teamOrder[1]] ?? Object.values(state.teams)[1] ?? teamA;
  const answeringTeam = state.teams[active.answeringTeam];
  const otherTeam = state.teams[getNextTeam(state.teamOrder, active.answeringTeam)];
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
            قد يكون السؤال محذوفاً أو الفئة معدّلة. أغلق هذا الكرت وجرّب
            كرتاً آخر.
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

  const transferAvailable = active.revealed && !active.transferUsed && !active.trapUsed;
  const onlyAnsweringTeamCanWin = active.transferUsed || active.trapUsed;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-none"
      style={{ background: "rgba(0,0,0,0.88)" }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl overflow-y-auto"
        style={{
          maxHeight: "96dvh",
          background: "rgba(13,17,23,0.98)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderBottom: "none",
          boxShadow: "0 -8px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        {/* ── Top strip ── */}
        <div
          className="flex items-center gap-2 px-4 pt-4 pb-3 sticky top-0 z-10"
          style={{ background: "rgba(13,17,23,0.97)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-emerald-400/70 tracking-wide mb-0.5">
              {sec?.emoji} {sub?.name}
            </div>
            <div
              className="text-xl font-black leading-none inline-flex items-center gap-1"
              style={{
                color: active.difficulty === 800 ? "#fde68a" : "#fbbf24",
                textShadow: active.difficulty === 800 ? "0 0 10px rgba(251,191,36,0.6)" : undefined,
              }}
            >
              {active.difficulty === 800 && <span style={{ fontSize: "0.75em" }}>⭐</span>}
              {active.difficulty}
              {active.multiplier > 1 && <span className="text-emerald-300 ms-2">× {active.multiplier} 🌾</span>}
            </div>
          </div>
          {/* Timer + close */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`text-3xl font-black leading-none tabular-nums ${active.timeLeft <= 5 && timerRunning ? "text-red-400 animate-pulse" : "text-white/90"}`}
            >
              {active.timeLeft}
            </div>
            <span className="text-[10px] text-white/30">ث</span>
            <button
              onClick={onClose}
              className="ms-1 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="px-4 py-4 space-y-3">

          {/* Answering team badge — compact */}
          <motion.div
            key={`banner-${active.answeringTeam}-${active.transferUsed}-${active.trapUsed}`}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border"
            style={{
              borderColor: `${answeringTeam.color}55`,
              background: `${answeringTeam.color}18`,
            }}
          >
            <span className="text-2xl">{answeringTeam.emoji}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-white/45 tracking-wide">يجيب الآن</div>
              <div className="font-black text-base text-white truncate leading-tight">{answeringTeam.name}</div>
            </div>
            {active.trapUsed && (
              <span className="ms-auto text-[10px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-400/30">🪤 فخ</span>
            )}
            {active.transferUsed && !active.trapUsed && (
              <span className="ms-auto text-[10px] font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-400/30">↔️ محوّل</span>
            )}
          </motion.div>

          {/* Question area */}
          <div
            className="rounded-xl px-3 py-4 text-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <InteractiveActivity
              key={`${active.question.type ?? "text"}::${active.question.q}`}
              question={active.question}
              revealed={active.revealed}
            />
            <AnimatePresence>
              {active.revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 220 }}
                  className="mt-4 px-4 py-3 rounded-xl text-center"
                  style={{ background: "rgba(251,191,36,0.12)", border: "1.5px solid rgba(251,191,36,0.4)" }}
                >
                  <div className="text-amber-400/80 text-[10px] font-bold tracking-wide mb-1">الإجابة الصحيحة</div>
                  <div className="text-xl sm:text-2xl font-extrabold text-amber-200">{active.question.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Shura voting */}
          {active.shuraVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl overflow-hidden border border-blue-400/30 bg-blue-500/08"
              style={{ background: "rgba(59,130,246,0.08)" }}
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/12 border-b border-blue-400/15" style={{ background: "rgba(59,130,246,0.12)" }}>
                <span>🗣️</span>
                <span className="text-blue-200 font-bold text-xs">تصويت الجمهور</span>
                <span className="text-blue-100/40 text-[10px] ms-auto">{shuraVotes.a + shuraVotes.b} صوت</span>
              </div>
              <div className="px-3 py-2.5 space-y-1.5">
                {[
                  { label: "خيار أ", votes: shuraVotes.a, color: "bg-blue-400" },
                  { label: "خيار ب", votes: shuraVotes.b, color: "bg-violet-400" },
                ].map(({ label, votes, color }) => {
                  const total = shuraVotes.a + shuraVotes.b;
                  const pct = total > 0 ? Math.round((votes / total) * 100) : 50;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] font-bold text-blue-100/70 mb-0.5">
                        <span>{label}</span><span>{votes} ({pct}٪)</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/8 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <motion.div className={`h-full rounded-full ${color}`} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 80 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Helpers — compact single-row per team */}
          {state.teamOrder.some(side => state.teams[side]?.helpers.length > 0) && (
            <div className="space-y-1.5">
              {state.teamOrder.map(side => {
                const t = state.teams[side];
                if (!t || t.helpers.length === 0) return null;
                return (
                  <div key={side} className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-[10px] font-black shrink-0 px-1.5 py-0.5 rounded-md"
                      style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}44` }}
                    >
                      {t.emoji}
                    </span>
                    {t.helpers.map(hid => {
                      const h = HELPERS.find(x => x.id === hid);
                      if (!h) return null;
                      const usable = canUseHelper(side, hid);
                      const consumed = t.usedHelpers.includes(hid);
                      return (
                        <button
                          key={hid}
                          onClick={() => onUseHelper(side, hid)}
                          disabled={!usable}
                          title={consumed ? `${h.name} — تم استخدامه` : h.desc}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition"
                          style={{
                            opacity: consumed ? 0.28 : usable ? 1 : 0.45,
                            filter: consumed ? "grayscale(1)" : undefined,
                            cursor: usable ? "pointer" : "not-allowed",
                            background: consumed ? "rgba(255,255,255,0.04)" : `${t.color}28`,
                            borderColor: consumed ? "rgba(255,255,255,0.10)" : `${t.color}55`,
                            color: "white",
                          }}
                        >
                          <span>{h.emoji}</span>
                          <span className="hidden sm:inline">{h.name}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Utility row */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={onReplaceQuestion}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 hover:bg-white/12 text-amber-200/80 border border-white/08 inline-flex items-center gap-1.5"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <RefreshCw className="w-3 h-3" /> استبدال السؤال
            </button>
            <button
              onClick={onReport}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/5 hover:bg-rose-500/15 text-rose-300/80 inline-flex items-center gap-1.5"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <AlertTriangle className="w-3 h-3" /> إبلاغ
            </button>
          </div>

          {/* Action buttons — timer + reveal + resolve */}
          <div
            className="flex flex-wrap gap-2 pt-1 pb-2"
          >
            {!timerRunning && !active.revealed && (
              <button
                onClick={onStartTimer}
                className="flex-1 min-w-[120px] py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center justify-center gap-1.5"
              >
                <Clock className="w-4 h-4" />
                {active.timeLeft === 0 || active.timeLeft === state.timerSeconds ? "بدء المؤقت" : "متابعة"}
              </button>
            )}
            {timerRunning && (
              <button
                onClick={onStopTimer}
                className="flex-1 min-w-[120px] py-3 rounded-xl font-bold text-sm text-white inline-flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                إيقاف المؤقت
              </button>
            )}
            {!active.revealed && (
              <button
                onClick={onReveal}
                className="flex-1 min-w-[120px] py-3 rounded-xl font-bold text-sm bg-amber-400 hover:bg-amber-300 text-slate-950 inline-flex items-center justify-center gap-1.5"
              >
                <Eye className="w-4 h-4" /> كشف الإجابة
              </button>
            )}
            {active.revealed && (
              <div className="w-full flex flex-wrap gap-2">
                {state.teamOrder.map(teamId => {
                  const t = state.teams[teamId];
                  if (!t) return null;
                  return (
                    <button
                      key={teamId}
                      onClick={() => onResolve(teamId)}
                      disabled={onlyAnsweringTeamCanWin && active.answeringTeam !== teamId}
                      className="flex-1 min-w-[110px] py-3 rounded-xl font-black text-white text-sm inline-flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-25 disabled:cursor-not-allowed"
                      style={{ background: t.color }}
                    >
                      {t.emoji} {t.name} ✓
                    </button>
                  );
                })}
                {transferAvailable && (
                  <button
                    onClick={onTransfer}
                    className="flex-1 min-w-[110px] py-3 rounded-xl font-bold text-sm text-blue-200 inline-flex items-center justify-center gap-1.5"
                    style={{ background: "rgba(59,130,246,0.18)", border: "1px solid rgba(147,197,253,0.3)" }}
                  >
                    ↔️ {otherTeam.name}
                  </button>
                )}
                <button
                  onClick={() => onResolve(null)}
                  className="flex-1 min-w-[110px] py-3 rounded-xl font-bold text-sm text-white/70 inline-flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  لا أحد
                </button>
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────  Phone-a-friend overlay  ───────────────────────────── */

function FriendCallOverlay({
  seconds, team, onClose,
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
          style={{ background: `${team.color}33`, border: `3px solid ${team.color}`, willChange: "transform" }}
        >
          <Phone className="w-12 h-12" style={{ color: team.color }} />
        </motion.div>
        <div className="text-amber-200/80 text-sm font-bold tracking-widest mb-1">اتصال بصديق</div>
        <div className="text-2xl sm:text-3xl font-black text-white mb-1">
          {team.emoji} {team.name}
        </div>
        <div className="text-emerald-100/70 text-sm mb-6">
          لديك ٦٠ ثانية للاتصال بصديق وأخذ رأيه — لن يتم خصم وقت السؤال أثناء المكالمة
        </div>

        <div className={`text-7xl sm:text-9xl font-black mb-3 ${seconds <= 10 ? "text-red-400 animate-pulse" : "text-amber-300"}`}>
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
          <button onClick={onClose} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-emerald-100/80 text-sm mb-4">
          امسح الرمز أو افتح الرابط على الشاشة الكبيرة ليصوّت الجمهور أو يتابع اللعبة
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
            onFocus={e => e.currentTarget.select()}
          />
          <button
            onClick={copy}
            className="px-3 py-1.5 rounded-md font-bold bg-amber-400 text-emerald-950 hover:bg-amber-300 inline-flex items-center gap-1.5 text-sm"
          >
            {copied ? <CheckIcon className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
  question, answer, onClose, onSubmit,
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
      className="fixed inset-0 z-[65] flex items-center justify-center p-4 backdrop-blur-none"
      style={{ background: "rgba(0,0,0,0.85)" }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-lg rounded-3xl p-6 border-4"
        style={{
          background: "linear-gradient(160deg, #064e3b, #022c22)",
          borderColor: "rgba(244,114,182,0.5)",
        }}
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-black text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            إبلاغ عن خطأ في السؤال
          </h2>
          <button onClick={onClose} className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="rounded-lg bg-black/30 border border-white/10 p-3 mb-3">
          <div className="text-[10px] font-bold text-amber-200/70 mb-1">السؤال</div>
          <div className="text-white text-sm font-bold mb-2">{question}</div>
          <div className="text-[10px] font-bold text-amber-200/70 mb-1">الإجابة الحالية</div>
          <div className="text-emerald-200 text-sm">{answer}</div>
        </div>
        <label className="block mb-3">
          <span className="text-emerald-100/85 text-sm font-bold mb-1 block">ما المشكلة؟</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="مثلاً: السؤال غير واضح، أو الإجابة غير دقيقة..."
            className="w-full bg-black/30 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-rose-300"
          />
        </label>
        <label className="block mb-4">
          <span className="text-emerald-100/85 text-sm font-bold mb-1 block">
            الإجابة الصحيحة المقترحة <span className="opacity-60">(اختياري)</span>
          </span>
          <input
            type="text"
            value={correct}
            onChange={e => setCorrect(e.target.value)}
            className="w-full bg-black/30 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-rose-300"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20"
          >
            إلغاء
          </button>
          <button
            onClick={() => {
              if (!note.trim()) {
                toast.error("اكتب وصف المشكلة");
                return;
              }
              onSubmit(note.trim(), correct.trim());
            }}
            className="flex-1 py-2.5 rounded-xl font-extrabold bg-rose-500 hover:bg-rose-400 text-white"
          >
            إرسال البلاغ
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────  Confirm dialog  ───────────────────────────── */

function ConfirmDialog({
  title, body, confirmLabel, confirmTone, onCancel, onConfirm,
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
        <p className="text-emerald-100/85 text-base mb-5 leading-relaxed">{body}</p>
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
  teamA, teamB, onAck,
}: {
  teamA: { name: string; emoji: string; color: string };
  teamB: { name: string; emoji: string; color: string };
  onAck: () => void;
}) {
  return (
    <div
      dir="rtl"
      className="min-h-screen overflow-y-auto flex flex-col items-center justify-start sm:justify-center p-4 sm:p-6"
      style={{ background: "#0e1117", fontFamily: "'Tajawal', sans-serif" }}
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
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-3"
            style={{ background: "rgba(16,185,129,0.12)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.25)" }}
          >
            <BookOpen className="w-3 h-3" />
            قوانين تحدّي حصاد
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2" style={{ lineHeight: 1.2 }}>
            استعدّوا للتحدّي
          </h1>
          <div className="flex items-center justify-center gap-2 text-lg">
            <span className="font-black" style={{ color: teamA.color }}>{teamA.emoji} {teamA.name}</span>
            <span className="text-white/30">×</span>
            <span className="font-black" style={{ color: teamB.color }}>{teamB.emoji} {teamB.name}</span>
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
          style={{ background: "rgba(22,27,34,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-300/70" />
            <h2 className="text-base font-extrabold text-amber-200/90">الوسائل المساعدة</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {HELPERS.map(h => (
              <div
                key={h.id}
                className="rounded-xl px-3 py-2.5 flex items-start gap-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-2xl shrink-0 leading-none mt-0.5">{h.emoji}</span>
                <div>
                  <div className="font-bold text-white text-sm leading-tight">{h.name}</div>
                  <div className="text-white/55 text-xs leading-relaxed mt-0.5">{h.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onAck}
          className="w-full py-4 rounded-2xl font-bold text-lg transition inline-flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#0c0f14" }}
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
      style={{ background: "rgba(22,27,34,0.95)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <h3 className="text-sm font-black text-amber-300/90 mb-2">{title}</h3>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-white/65 text-xs sm:text-sm leading-relaxed flex gap-2">
            <span className="text-emerald-400/70 shrink-0 mt-0.5">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────  End screen  ───────────────────────────── */

function EndScreen({
  winnerTeam, teams, teamOrder, onRestart, onExit, onWinSound,
  publicMode, hasLastSettings, onQuickReplay,
}: {
  winnerTeam: { name: string; emoji: string; color: string; score: number } | null;
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
      style={{ background: "#0e1117", fontFamily: "'Tajawal', sans-serif" }}
    >
      <ConfettiBurst active={!!winnerTeam} />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="text-center z-10 w-full max-w-2xl"
      >
        {/* Trophy / result */}
        <div className="mb-5">
          <Trophy className="w-20 h-20 inline text-amber-400/90 drop-shadow-xl" />
        </div>
        {winnerTeam ? (
          <>
            <div className="text-sm font-bold text-white/40 tracking-widest uppercase mb-1">الفائز</div>
            <div
              className="text-5xl sm:text-6xl font-black text-white mb-2 leading-tight"
              style={{ textShadow: `0 0 40px ${winnerTeam.color}` }}
            >
              {winnerTeam.emoji} {winnerTeam.name}
            </div>
            <div className="text-2xl font-bold mb-8" style={{ color: winnerTeam.color }}>
              {winnerTeam.score} نقطة
            </div>
          </>
        ) : (
          <div className="text-4xl font-extrabold text-amber-300 mb-6">تعادل!</div>
        )}

        {/* Score cards */}
        <div className={`grid gap-3 mb-8 ${teamOrder.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {teamOrder.map(side => {
            const t = teams[side];
            if (!t) return null;
            return (
              <div
                key={side}
                className="rounded-2xl p-4 border"
                style={{ background: `${t.color}14`, borderColor: `${t.color}44` }}
              >
                <div className="text-3xl mb-1">{t.emoji}</div>
                <div className="font-black text-white text-base mb-0.5 truncate">{t.name}</div>
                <div className="text-2xl font-extrabold" style={{ color: t.color }}>{t.score}</div>
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
              className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-lg inline-flex items-center justify-center gap-2.5 shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                boxShadow: "0 8px 32px -8px rgba(16,185,129,0.6)",
              }}
            >
              <Zap className="w-5 h-5" />
              إعادة فورية بنفس الإعدادات
            </button>
            <div className="text-emerald-400/60 text-xs mt-2 font-bold">
              يبدأ التحدّي فوراً بنفس الفرق والفئات — بدون خطوات الإعداد
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={onRestart}
            className="px-7 py-3.5 rounded-2xl font-bold text-lg inline-flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)", color: "#0c0f14" }}
          >
            <RotateCcw className="w-5 h-5" />
            {showQuickReplay ? "إعادة مع تغيير الإعدادات" : "إعادة اللعب"}
          </button>
          <button
            onClick={onExit}
            className="px-7 py-3.5 rounded-2xl font-bold text-lg text-white inline-flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)" }}
          >
            <Home className="w-5 h-5" />
            خروج
          </button>
        </div>

        {/* Collapsible share / QR section */}
        <div className="mt-6 w-full">
          <button
            onClick={() => setShowQr(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-2xl font-bold text-sm text-amber-300 border border-amber-400/30 hover:bg-amber-400/10 transition"
            style={{ background: "rgba(245,158,11,0.06)" }}
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
                  className="mt-3 rounded-2xl p-5 border text-center"
                  style={{
                    background: "linear-gradient(160deg, #064e3b22, #022c2244)",
                    borderColor: "rgba(245,158,11,0.25)",
                  }}
                >
                  <p className="text-emerald-100/70 text-xs mb-4">
                    امسح الرمز ليرى المتأخرون النتيجة النهائية على شاشتهم
                  </p>
                  <div className="bg-white p-2.5 rounded-xl inline-block mb-3 shadow-lg">
                    <img src={qrUrl} alt="QR" className="w-44 h-44 block" />
                  </div>
                  <div className="text-amber-200 font-mono font-extrabold text-xl tracking-[0.3em] mb-3">
                    {shareCode}
                  </div>
                  <div className="flex items-center gap-2 bg-black/30 rounded-lg p-2">
                    <input
                      readOnly
                      value={audienceUrl}
                      className="flex-1 bg-transparent text-emerald-100 text-xs px-2 py-1 outline-none"
                      onFocus={e => e.currentTarget.select()}
                    />
                    <button
                      onClick={copyUrl}
                      className="px-3 py-1.5 rounded-md font-bold bg-amber-400 text-emerald-950 hover:bg-amber-300 inline-flex items-center gap-1.5 text-sm"
                    >
                      {copied ? <CheckIcon className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
  team, side, active, animation,
}: {
  team: { name: string; emoji: string; color: string; score: number; helpers: HelperId[]; usedHelpers: HelperId[] };
  side: TeamSide;
  active: boolean;
  animation: { team: TeamSide; pts: number; difficulty: ArenaDifficulty; player?: string } | null;
}) {
  return (
    <div className={`flex-1 rounded-xl p-2 border-2 transition relative overflow-hidden ${
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
                textShadow: animation.difficulty === 800 ? "0 0 12px rgba(251,191,36,0.8), 0 0 24px rgba(251,191,36,0.4)" : undefined,
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
          <div className="font-black text-gray-900 text-sm truncate leading-tight">{team.name}</div>
          <div className="text-xl sm:text-2xl font-black leading-none" style={{ color: team.color }}>{team.score}</div>
          <div className="flex gap-0.5 mt-0.5 flex-wrap">
            {team.helpers.map(hid => {
              const h = HELPERS.find(x => x.id === hid);
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

function InteractiveActivity({ question, revealed }: { question: ArenaQuestion; revealed: boolean }) {
  const t = question.type;
  if (t === "sin-jeem") return <SinJeemPlay question={question} revealed={revealed} />;
  if (t === "memory") return <MemoryPlay question={question} revealed={revealed} />;
  if (t === "categorize") return <CategorizePlay question={question} revealed={revealed} />;
  if (t === "logo") return <LogoPlay question={question} revealed={revealed} />;
  if (t === "image") return <ImagePlay key={question.imageUrl ?? question.q} question={question} revealed={revealed} />;
  // Default: text/image/video
  return (
    <>
      {question.imageUrl && (
        <div className="mb-4 flex justify-center">
          <img
            src={question.imageUrl}
            alt="سؤال"
            className="max-h-[40vh] sm:max-h-[50vh] max-w-full rounded-2xl border-2 border-amber-300/30 object-contain bg-black/40"
            style={{ boxShadow: "0 12px 40px -12px rgba(232,168,14,0.4)" }}
          />
        </div>
      )}
      <div className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-[1.4] mb-4">
        {question.q}
      </div>
    </>
  );
}

function SinJeemPlay({ question, revealed }: { question: ArenaQuestion; revealed: boolean }) {
  const payload = (question.payload ?? {}) as Partial<SinJeemPayload>;
  const letter = payload.letter ?? "؟";
  const prompts = payload.prompts ?? [];
  return (
    <div className="flex flex-col items-center gap-4 sm:gap-5">
      <div className="text-amber-200/80 text-sm sm:text-base font-bold">
        أجب بكلمة تبدأ بحرف
      </div>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="text-[120px] sm:text-[180px] leading-none font-black text-amber-300 select-none"
        style={{ textShadow: "0 4px 32px rgba(251,191,36,0.7), 0 1px 0 rgba(0,0,0,0.4)" }}
      >
        {letter}
      </motion.div>
      <div className="grid sm:grid-cols-2 gap-2.5 w-full max-w-3xl">
        {prompts.map((p, i) => (
          <div
            key={i}
            className="rounded-xl border-2 border-amber-300/25 bg-black/35 px-4 py-3 text-right transition"
          >
            <div className="text-amber-200/80 text-[11px] font-bold mb-1">سؤال {i + 1}</div>
            <div className="text-base sm:text-xl font-bold text-white">{p.prompt}</div>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="mt-2 text-emerald-300 font-extrabold text-base sm:text-lg"
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

function MemoryPlay({ question, revealed }: { question: ArenaQuestion; revealed: boolean }) {
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
      const a = cards.find(c => c.id === next[0])!;
      const b = cards.find(c => c.id === next[1])!;
      if (a.pairId === b.pairId) {
        setMatched(prev => [...prev, a.pairId]);
        window.setTimeout(() => setFlipped([]), 700);
      } else {
        window.setTimeout(() => setFlipped([]), 1200);
      }
    }
  };

  if (cards.length === 0) {
    return <div className="text-amber-200">لا توجد بطاقات للمطابقة.</div>;
  }

  const cols = cards.length <= 4 ? 2 : cards.length <= 6 ? 3 : 4;
  const allMatched = matched.length === pairs.length;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="text-amber-200/80 text-sm font-bold">
        طابق الأزواج المتشابهة
        {!revealed && (
          <span className="ms-2 text-emerald-300">
            ({matched.length}/{pairs.length})
            {allMatched && " 🎉"}
          </span>
        )}
      </div>
      <div
        className="grid gap-2 sm:gap-3 w-full max-w-3xl"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {cards.map(card => {
          const isFlipped = revealed || flipped.includes(card.id) || matched.includes(card.pairId);
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
                        ? "linear-gradient(160deg, #064e3b, #022c22)"
                        : "linear-gradient(160deg, #1e3a8a, #1e40af)",
                      borderColor: isMatched ? "rgba(52,211,153,0.6)" : "rgba(245,158,11,0.6)",
                      boxShadow: isMatched ? "0 0 24px -6px rgba(52,211,153,0.5)" : undefined,
                    }
                  : {
                      background: "linear-gradient(160deg, #d97706, #92400e)",
                      borderColor: "rgba(245,158,11,0.6)",
                    }
              }
            >
              {isFlipped ? (
                card.side.kind === "image" ? (
                  <img src={card.side.value} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-white text-sm sm:text-lg font-extrabold p-2 text-center break-words">
                    {card.side.value}
                  </div>
                )
              ) : (
                <div className="text-4xl sm:text-6xl text-amber-200 font-black drop-shadow">؟</div>
              )}
              {isMatched && !revealed && (
                <div className="absolute top-1 end-1 bg-emerald-500 rounded-full p-0.5">
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

function CategorizePlay({ question, revealed }: { question: ArenaQuestion; revealed: boolean }) {
  const payload = (question.payload ?? {}) as Partial<CategorizePayload>;
  const groups = payload.groups ?? [];

  const allItems = useMemo(() => {
    const items: { item: string; groupIdx: number; key: string }[] = [];
    groups.forEach((g, gi) => g.items.forEach((it, ii) => items.push({ item: it, groupIdx: gi, key: `${gi}-${ii}` })));
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
    setAssignments(prev => ({ ...prev, [selectedKey]: groupIdx }));
    setSelectedKey(null);
  };

  if (groups.length === 0) {
    return <div className="text-amber-200">لا توجد عناصر للتصنيف.</div>;
  }

  if (revealed) {
    return (
      <div className="flex flex-col items-center gap-3 w-full">
        <div className="text-amber-200/80 text-sm font-bold mb-1">التصنيف الصحيح</div>
        <div
          className="grid gap-2.5 w-full max-w-4xl"
          style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 2)}, minmax(0,1fr))` }}
        >
          {groups.map((g, gi) => (
            <div key={gi} className="rounded-xl border-2 border-emerald-400/50 bg-emerald-500/10 p-3">
              <div className="text-emerald-200 font-extrabold text-base sm:text-lg mb-2 text-center">{g.name}</div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {g.items.map((it, j) => (
                  <span key={j} className="px-3 py-1.5 rounded-lg bg-emerald-600/80 text-white font-bold text-sm">
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

  const unassigned = allItems.filter(it => assignments[it.key] === undefined);
  const correctCount = Object.entries(assignments).filter(([key, gi]) => {
    const it = allItems.find(x => x.key === key);
    return it && it.groupIdx === gi;
  }).length;

  return (
    <div className="flex flex-col gap-3 w-full max-w-4xl mx-auto">
      <div className="text-amber-200/80 text-sm font-bold text-center">
        اضغط عنصراً ثم اضغط مجموعته
        {Object.keys(assignments).length > 0 && (
          <span className="ms-2 text-emerald-300">
            ({correctCount}/{Object.keys(assignments).length} صحيح)
          </span>
        )}
      </div>
      <div className="rounded-xl border border-amber-300/20 bg-black/30 p-3">
        <div className="text-[11px] font-bold text-emerald-200/70 mb-2">العناصر</div>
        <div className="flex flex-wrap gap-2 justify-center min-h-[3rem]">
          {unassigned.length === 0 ? (
            <div className="text-emerald-200/50 text-sm">— تم تصنيف الكل —</div>
          ) : (
            unassigned.map(it => (
              <button
                key={it.key}
                onClick={() => setSelectedKey(it.key === selectedKey ? null : it.key)}
                className={`px-3 py-1.5 rounded-lg font-bold text-sm border-2 transition ${
                  selectedKey === it.key
                    ? "bg-amber-400 text-emerald-950 border-amber-200 scale-110 shadow-lg"
                    : "bg-amber-300/15 text-white border-amber-300/40 hover:bg-amber-300/25"
                }`}
              >
                {it.item}
              </button>
            ))
          )}
        </div>
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.min(groups.length, 2)}, minmax(0,1fr))` }}
      >
        {groups.map((g, gi) => {
          const inside = Object.entries(assignments)
            .filter(([, gIdx]) => gIdx === gi)
            .map(([key]) => allItems.find(x => x.key === key)!)
            .filter(Boolean);
          return (
            <button
              key={gi}
              onClick={() => assign(gi)}
              disabled={!selectedKey}
              className={`rounded-xl border-2 p-3 min-h-[6rem] text-right transition ${
                selectedKey
                  ? "border-amber-300/60 bg-amber-300/10 hover:bg-amber-300/20 cursor-pointer"
                  : "border-white/10 bg-black/30 cursor-default"
              }`}
            >
              <div className="text-white font-extrabold text-base sm:text-lg mb-2 text-center">{g.name}</div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {inside.map(it => {
                  const correct = it.groupIdx === gi;
                  return (
                    <span
                      key={it.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignments(prev => {
                          const next = { ...prev };
                          delete next[it.key];
                          return next;
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs border cursor-pointer ${
                        correct
                          ? "bg-emerald-600 text-white border-emerald-400"
                          : "bg-rose-600 text-white border-rose-400"
                      }`}
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

function ImagePlay({ question, revealed }: { question: ArenaQuestion; revealed: boolean }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {question.imageUrl ? (
        <div className="relative w-full flex justify-center">
          {status === "loading" && (
            <div className="w-64 h-44 rounded-2xl bg-white/10 animate-pulse" />
          )}
          {status === "error" && (
            <div className="w-64 h-44 rounded-2xl border-2 border-amber-300/20 bg-black/40 flex flex-col items-center justify-center gap-2 text-amber-200/50">
              <span className="text-4xl">🖼️</span>
              <span className="text-xs">تعذّر تحميل الصورة</span>
            </div>
          )}
          <img
            src={question.imageUrl}
            alt="سؤال مصوّر"
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            className="max-h-[38vh] sm:max-h-[46vh] max-w-full rounded-2xl border-2 border-amber-300/40 object-contain bg-black/30 shadow-2xl"
            style={{
              boxShadow: "0 12px 40px -12px rgba(232,168,14,0.5)",
              opacity: status === "loaded" ? 1 : 0,
              transition: "opacity 0.35s ease",
              position: status === "loaded" ? "static" : "absolute",
              pointerEvents: status === "loaded" ? "auto" : "none",
            }}
          />
          {status === "loaded" && (
            <span className="absolute top-2 end-2 bg-amber-400 text-emerald-950 text-[10px] font-black px-2 py-0.5 rounded-full select-none">
              🖼️ سؤال مصوّر
            </span>
          )}
        </div>
      ) : (
        <div className="w-64 h-44 rounded-2xl border-2 border-amber-300/30 bg-black/40 flex items-center justify-center text-amber-200/50 text-5xl">
          🖼️
        </div>
      )}
      <div className="text-xl sm:text-3xl font-extrabold text-white leading-[1.4] text-center px-2">
        {question.q}
      </div>
    </div>
  );
}

function LogoPlay({ question, revealed }: { question: ArenaQuestion; revealed: boolean }) {
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
            className="max-h-[40vh] sm:max-h-[50vh] max-w-full rounded-2xl border-2 border-amber-300/30 object-contain bg-white/5 transition-all"
            style={{
              filter: `blur(${blur}px)`,
              boxShadow: "0 12px 40px -12px rgba(232,168,14,0.4)",
            }}
          />
        ) : (
          <div className="w-64 h-40 rounded-2xl border-2 border-amber-300/30 bg-black/40 flex items-center justify-center text-amber-200/60">
            لا توجد صورة
          </div>
        )}
      </div>
      {!revealed && question.imageUrl && (
        <button
          onClick={() => setRevealLevel(l => Math.min(3, l + 1))}
          disabled={revealLevel >= 3}
          className="px-3 py-1.5 rounded-lg bg-amber-400 text-emerald-950 font-bold text-xs hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          توضيح الشعار ({revealLevel}/3)
        </button>
      )}
      <div className="text-2xl sm:text-3xl font-extrabold text-white leading-[1.4]">
        ما اسم هذا الشعار؟
      </div>
      {hint && !revealed && (
        <div className="text-emerald-200/80 text-sm bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-3 py-1.5">
          💡 تلميح: {hint}
        </div>
      )}
    </div>
  );
}
