import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui-elements";
import { InstallAppButton } from "@/components/install-app-button";
import {
  Loader2,
  GraduationCap,
  Trophy,
  Gamepad2,
  Star,
  Medal,
  Globe,
  Palette,
  Brain,
  Calculator,
  Shuffle,
  Type,
  Landmark,
  LogOut,
  Clock,
  Zap,
  Play,
  Copy,
  Check,
  BookOpen,
  Users,
  FileText,
  ArrowLeft,
  ArrowRight,
  Bot,
  X,
  CircleDot,
  DollarSign,
  Route,
  Flame,
  BadgeCheck,
  ExternalLink,
  Gift,
  Award,
  History,
  Target,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import {
  useKidsMotivationAggregate,
  useKidsRewards,
  useKidsRedeemReward,
  useKidsRedemptions,
  useKidsProfile
} from "@/hooks/use-kids";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/confetti-burst";
import { AvatarDisplay } from "@/components/avatar-display";
import type { QuranWard } from "@workspace/api-client-react";

interface PublicAssignment {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  submissionMode: string;
  targetClass: string | null;
  totalPoints: number | null;
  teacherName: string | null;
  questionCount: number;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

interface StudentProfile {
  id: number;
  username: string;
  displayName: string;
  avatar: string | null;
  totalScore: number;
  gamesPlayed: number;
  rank: number;
  isVerified?: boolean;
}

interface RecentScore {
  id: number;
  score: number;
  name?: string;
  game: "flags" | "color" | "memory" | "multiply" | "scramble" | "capitals" | "wameeth" | "stroop";
  createdAt: string;
}

interface StudentRewardGoal {
  id: number;
  title: string;
  skill: string;
  targetPoints: number;
  currentPoints: number;
  remainingPoints: number;
  progressPercent: number;
  completed: boolean;
}

interface CompletedStudentRewardGoal {
  id: number;
  title: string;
  skill: string;
  targetPoints: number;
  completedAt: string;
}

const GAME_LABELS: Record<string, { key: keyof typeof import("@/locales/ar").ar.studentDashboard; color: string }> = {
  flags: { key: "flags", color: "text-emerald-600 bg-emerald-500/10" },
  color: { key: "color", color: "text-orange-600 bg-orange-500/10" },
  memory: { key: "memory", color: "text-pink-600 bg-pink-500/10" },
  multiply: { key: "multiply", color: "text-cyan-600 bg-cyan-500/10" },
  scramble: { key: "scramble", color: "text-violet-600 bg-violet-500/10" },
  capitals: { key: "capitals", color: "text-teal-600 bg-teal-500/10" },
  wameeth: { key: "wameeth", color: "text-amber-600 bg-amber-500/10" },
  stroop: { key: "stroop", color: "text-red-600 bg-red-500/10" },
};

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const { lang, t, dir } = useI18n();
  const copy = t.studentDashboard;
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [recentScores, setRecentScores] = useState<RecentScore[]>([]);
  const [activityDays, setActivityDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardGoal, setRewardGoal] = useState<StudentRewardGoal | null>(null);
  const [completedRewardGoals, setCompletedRewardGoals] = useState<CompletedStudentRewardGoal[]>([]);
  const previousGoalRef = useRef<StudentRewardGoal | null | undefined>(undefined);

  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [quranWards, setQuranWards] = useState<QuranWard[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [startingGameId, setStartingGameId] = useState<number | null>(null);
  const [botDialogAssignment, setBotDialogAssignment] = useState<PublicAssignment | null>(null);
  const [botCount, setBotCount] = useState(4);
  // Live "what's available right now" — open rooms count.
  const [liveCount, setLiveCount] = useState<number | null>(null);

  // Celebration state
  const [celebration, setCelebration] = useState<{ active: boolean; title: string; subtitle: string; icon: "badge" | "reward" } | null>(null);
  const initialFetchDone = useRef(false);

  // Motivation Data
  const { data: motivation, isLoading: motivationLoading, isError: motivationError, error: motivationErr } = useKidsMotivationAggregate({ refetchInterval: 15000 });
  const { data: rewards = [], isLoading: rewardsLoading } = useKidsRewards();
  const { data: redemptions = [], isLoading: redemptionsLoading } = useKidsRedemptions({ refetchInterval: 15000 });
  const redeemReward = useKidsRedeemReward();

  // Watch for new badges or rewards
  useEffect(() => {
    if (!student || !motivation || motivationLoading || redemptionsLoading) return;

    // Set initial fetch done after first successful render with data
    if (!initialFetchDone.current) {
      // Initialize localStorage if needed without triggering celebration
      try {
        const storageKey = `student_motivation_seen_${student.id}`;
        const seenRaw = localStorage.getItem(storageKey);
        const seen = seenRaw ? JSON.parse(seenRaw) : { badges: [], redemptions: [] };
        let changed = false;

        if (motivation.badges) {
          for (const badge of motivation.badges) {
            const badgeKey = badge.id || `${badge.title}-${badge.granted_at}`;
            if (!seen.badges.includes(badgeKey)) {
              seen.badges.push(badgeKey);
              changed = true;
            }
          }
        }

        if (redemptions) {
          for (const req of redemptions) {
            if (req.status === 'approved' || req.status === 'delivered') {
              const reqKey = `${req.id}-${req.status}`;
              if (!seen.redemptions.includes(reqKey)) {
                seen.redemptions.push(reqKey);
                changed = true;
              }
            }
          }
        }

        if (changed) {
          localStorage.setItem(storageKey, JSON.stringify(seen));
        }
      } catch(e) {}

      initialFetchDone.current = true;
      return;
    }

    if (!initialFetchDone.current || celebration?.active) return;

    try {
      const storageKey = `student_motivation_seen_${student.id}`;
      const seenRaw = localStorage.getItem(storageKey);
      const seen = seenRaw ? JSON.parse(seenRaw) : { badges: [], redemptions: [] };
      let newlySeenBadge = null;
      let newlySeenRedemption = null;
      let changed = false;

      // Check badges
      if (motivation?.badges) {
        for (const badge of motivation.badges) {
          const badgeKey = badge.id || `${badge.title}-${badge.granted_at}`;
          if (!seen.badges.includes(badgeKey)) {
            seen.badges.push(badgeKey);
            changed = true;
            newlySeenBadge = badge;
          }
        }
      }

      // Check redemptions
      if (redemptions) {
        for (const req of redemptions) {
          if (req.status === 'approved' || req.status === 'delivered') {
            const reqKey = `${req.id}-${req.status}`;
            if (!seen.redemptions.includes(reqKey)) {
              seen.redemptions.push(reqKey);
              changed = true;
              newlySeenRedemption = req;
            }
          }
        }
      }

      if (changed) {
        localStorage.setItem(storageKey, JSON.stringify(seen));

        if (newlySeenBadge) {
          setCelebration({
            active: true,
            title: "عمل رائع!",
            subtitle: `حصلت على وسام جديد: ${newlySeenBadge.title}`,
            icon: "badge"
          });
        } else if (newlySeenRedemption) {
          setCelebration({
            active: true,
            title: newlySeenRedemption.status === 'delivered' ? "تم تسليم جائزتك!" : "تمت الموافقة!",
            subtitle: `جائزتك: ${newlySeenRedemption.reward_title}`,
            icon: "reward"
          });
        }
      }
    } catch(e) {}
  }, [student, motivation, redemptions, celebration?.active]);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/assignments`)
      .then(r => r.ok ? r.json() : [])
      .then(a => setAssignments(Array.isArray(a) ? a.slice(0, 12) : []))
      .catch(() => {})
      .finally(() => setAssignmentsLoading(false));
  }, []);

  // Poll active-rooms count so students see what's available right now.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/public/active-games-count`);
        if (!r.ok) return;
        const data = await r.json();
        if (!cancelled) setLiveCount(typeof data?.count === "number" ? data.count : 0);
      } catch {
        // silent
      }
    };
    tick();
    const id = window.setInterval(tick, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/student-auth/me`, { credentials: "include" }).then(async (r) => {
        if (!r.ok) { setLocation("/student/login"); return null; }
        return r.json();
      }),
      fetch(`${API_BASE}/api/student-auth/recent-scores`, { credentials: "include" }).then(async (r) => {
        if (!r.ok) return [];
        return r.json();
      }).catch(() => []),
      fetch(`${API_BASE}/api/student-auth/activity-days`, { credentials: "include" }).then(async (r) => {
        if (!r.ok) return { days: [] };
        return r.json();
      }).catch(() => ({ days: [] })),
      fetch(`${API_BASE}/api/quran/me/wards`, { credentials: "include" }).then(async (r) => {
        if (!r.ok) return [];
        return r.json();
      }).catch(() => []),
    ]).then(([profileData, scoresData, daysData, quranWardsData]) => {
      if (profileData) setStudent(profileData);
      setRecentScores(Array.isArray(scoresData) ? scoresData : []);
      setActivityDays(Array.isArray(daysData?.days) ? daysData.days : []);
      setQuranWards(Array.isArray(quranWardsData) ? quranWardsData : []);
    }).catch(() => setLocation("/student/login")).finally(() => setLoading(false));
  }, [setLocation]);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;

    const refreshGoal = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/student-auth/me/reward-goal`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        const nextGoal: StudentRewardGoal | null = payload?.goal ?? null;
        const nextCompletedGoals = Array.isArray(payload?.completedGoals) ? payload.completedGoals : [];
        if (cancelled) return;

        const previousGoal = previousGoalRef.current;
        if (
          previousGoal !== undefined &&
          nextGoal?.completed &&
          previousGoal?.id === nextGoal.id &&
          !previousGoal.completed
        ) {
          setCelebration({
            active: true,
            title: lang === "ar" ? "أحسنت! وصلت إلى هدفك" : "Great job! You reached your goal",
            subtitle: nextGoal.title,
            icon: "badge",
          });
          window.setTimeout(() => setCelebration(null), 4200);
        }

        previousGoalRef.current = nextGoal;
        setRewardGoal(nextGoal);
        setCompletedRewardGoals(nextCompletedGoals);
      } catch {
        // Preserve the last successful response during a temporary network failure.
      }
    };

    void refreshGoal();
    const intervalId = window.setInterval(refreshGoal, 10000);
    const refreshOnFocus = () => void refreshGoal();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [student, lang]);

  const copyLink = (a: PublicAssignment) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${window.location.origin}${base}/solve/${a.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(a.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleStartGame = async (assignmentId: number, withBots: boolean, bots: number) => {
    setBotDialogAssignment(null);
    setStartingGameId(assignmentId);
    try {
      const res = await fetch(`${API_BASE}/api/public/start-wameeth/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ withBots, botCount: bots }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t.publicGames.startError);
      setLocation(`/game/join/${data.pin}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.publicGames.startError;
      toast.error(message);
    } finally {
      setStartingGameId(null);
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/student-auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    toast.success(copy.loggedOut);
    setLocation("/");
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center" role="status" aria-label={t.solve.loading}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1E4D35" }} />
          <span className="sr-only">{t.solve.loading}</span>
        </div>
      </Layout>
    );
  }

  if (!student) return null;

  // Compute daily streak from activity-days
  const streakInfo = (() => {
    const set = new Set(activityDays);
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const today = new Date();
    const playedToday = set.has(fmt(today));
    let streak = 0;
    const cursor = new Date(today);
    if (!playedToday) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      if (set.has(fmt(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return { streak, playedToday };
  })();
  const arDigit = (n: number) => n.toLocaleString(lang === "ar" ? "ar-EG" : "en");

  const games = [
    {
      href: "/game/flags",
      icon: Globe,
      title: copy.flags,
      color: "bg-emerald-500/10 text-emerald-600",
    },
    {
      href: "/game/color",
      icon: Palette,
      title: copy.color,
      color: "bg-orange-500/10 text-orange-600",
    },
    {
      href: "/game/memory",
      icon: Brain,
      title: copy.memory,
      color: "bg-pink-500/10 text-pink-600",
    },
    {
      href: "/game/multiply",
      icon: Calculator,
      title: copy.multiply,
      color: "bg-cyan-500/10 text-cyan-600",
    },
    {
      href: "/game/scramble",
      icon: Shuffle,
      title: copy.scramble,
      color: "bg-violet-500/10 text-violet-600",
    },
    {
      href: "/game/letrly",
      icon: Type,
      title: copy.wordChallenge,
      color: "bg-emerald-500/10 text-emerald-600",
    },
    {
      href: "/game/capitals",
      icon: Landmark,
      title: copy.capitals,
      color: "bg-teal-500/10 text-teal-600",
    },
    {
      href: "/game/stroop",
      icon: CircleDot,
      title: copy.stroop,
      color: "bg-red-500/10 text-red-600",
    },
    {
      href: "/game/million",
      icon: DollarSign,
      title: copy.million,
      color: "bg-amber-500/10 text-amber-600",
    },
    {
      href: "/game/maraqui",
      icon: Route,
      title: copy.maraqui,
      color: "bg-indigo-500/10 text-indigo-600",
    },
  ];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    const relative = new Intl.RelativeTimeFormat(lang === "ar" ? "ar" : "en", { numeric: "auto" });
    if (diffMin < 1) return relative.format(0, "minute");
    if (diffMin < 60) return relative.format(-diffMin, "minute");
    if (diffHr < 24) return relative.format(-diffHr, "hour");
    if (diffDay < 7) return relative.format(-diffDay, "day");
    return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US");
  };

  return (
    <Layout>
      {celebration?.active && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && (
        <ConfettiBurst active={celebration.active} />
      )}
      <AnimatePresence>
        {celebration?.active && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
            dir="rtl"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-4 border-emerald-100 dark:border-emerald-900/50 p-6 flex flex-col items-center text-center relative overflow-hidden">
              <button
                onClick={() => setCelebration(null)}
                className="absolute top-3 left-3 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 text-emerald-600 dark:text-emerald-400">
                {celebration.icon === "badge" ? <Award className="w-8 h-8" /> : <Gift className="w-8 h-8" />}
              </div>

              <h2 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mb-2">
                {celebration.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 font-bold">
                {celebration.subtitle}
              </p>

              <Button
                onClick={() => setCelebration(null)}
                className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold"
              >
                متابعة
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-emerald-50/40 to-background dark:from-emerald-950/20 dark:to-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8 animate-in fade-in duration-300">
            <Card
              className="p-6 sm:p-8 text-white border-0 shadow-xl relative overflow-hidden"
              style={{ background: "linear-gradient(135deg,#1E4D35 0%,#2d7050 60%,#1E4D35 100%)" }}
            >
              {/* gold accent corner */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: -40,
                  [dir === "rtl" ? "left" : "right"]: -40,
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(232,168,14,0.30) 0%, transparent 70%)",
                }}
              />
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-4">
                  <AvatarDisplay
                    avatar={student.avatar}
                    fallback={student.displayName.charAt(0)}
                    size="3xl"
                    className="rounded-2xl border-amber-400/45 bg-amber-400/20 object-top"
                  />
                  <div className="min-w-0">
                    <h1 className="text-2xl font-extrabold truncate">
                      {copy.welcome.replace("{name}", student.displayName)}
                    </h1>
                    <p className="text-white/75 text-sm mt-0.5">@{student.username}</p>
                    {/* Daily streak chip */}
                    <div
                      className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full"
                      style={{
                        background: streakInfo.streak > 0 ? "rgba(232,168,14,0.20)" : "rgba(255,255,255,0.10)",
                        border: `1px solid ${streakInfo.streak > 0 ? "rgba(232,168,14,0.45)" : "rgba(255,255,255,0.18)"}`,
                      }}
                    >
                      <Flame
                        className="w-3.5 h-3.5"
                        style={{ color: streakInfo.streak > 0 ? "#E8A80E" : "rgba(255,255,255,0.65)" }}
                        fill={streakInfo.streak > 0 && streakInfo.playedToday ? "#E8A80E" : "none"}
                      />
                      <span className="text-xs font-bold text-white">
                        {streakInfo.streak === 0
                          ? copy.startStreak
                          : streakInfo.playedToday
                            ? copy.streak.replace("{n}", arDigit(streakInfo.streak))
                            : copy.playToday.replace("{n}", arDigit(streakInfo.streak))}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                  title={copy.logout}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </Card>
          </div>

          <div className="mb-6 animate-in fade-in duration-300 delay-75">
            <InstallAppButton variant="card" />
          </div>

          {rewardGoal && (
            <section
              className="mb-6 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-[#f7fbf8] via-white to-amber-50/70 p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-background dark:to-amber-950/20 sm:p-6"
              aria-labelledby="student-active-goal"
              data-testid="card-student-active-goal"
            >
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="relative shrink-0">
                  <AvatarDisplay
                    avatar={student.avatar}
                    fallback={student.displayName.charAt(0)}
                    size="3xl"
                    className="rounded-3xl bg-emerald-100 ring-4 ring-white shadow-md dark:bg-emerald-900 dark:ring-emerald-950"
                  />
                  <span className="absolute -bottom-2 -end-2 grid h-9 w-9 place-items-center rounded-2xl bg-[#E8A80E] text-white shadow-md">
                    {rewardGoal.completed ? <Sparkles className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      {lang === "ar" ? "هدفي الآن" : "My goal"}
                    </p>
                    {rewardGoal.completed && (
                      <span className="rounded-full bg-[#E8A80E]/15 px-2.5 py-1 text-xs font-black text-amber-700 dark:text-amber-300">
                        {lang === "ar" ? "تم الإنجاز" : "Completed"}
                      </span>
                    )}
                  </div>
                  <h2
                    id="student-active-goal"
                    className="truncate text-xl font-black text-foreground sm:text-2xl"
                    data-testid="text-active-goal-title"
                  >
                    {rewardGoal.title}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-muted-foreground" data-testid="text-active-goal-next-step">
                    {rewardGoal.completed
                      ? (lang === "ar" ? "واصل التألق، إنجازك القادم أقرب مما تتخيل." : "Keep going—your next achievement is close.")
                      : (lang === "ar"
                        ? `خطوتك التالية: اجمع ${arDigit(rewardGoal.remainingPoints)} نقطة`
                        : `Next step: earn ${arDigit(rewardGoal.remainingPoints)} points`)}
                  </p>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
                      <span data-testid="text-active-goal-progress">{arDigit(rewardGoal.progressPercent)}%</span>
                      <span className="text-muted-foreground" data-testid="text-active-goal-points">
                        {arDigit(Math.min(rewardGoal.currentPoints, rewardGoal.targetPoints))} / {arDigit(rewardGoal.targetPoints)}
                      </span>
                    </div>
                    <div
                      className="h-3 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={rewardGoal.progressPercent}
                      aria-label={lang === "ar" ? "تقدم الهدف" : "Goal progress"}
                      data-testid="progress-active-goal"
                    >
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-l from-[#225739] to-[#E8A80E]"
                        initial={{ width: 0 }}
                        animate={{ width: `${rewardGoal.progressPercent}%` }}
                        transition={{ duration: 0.65, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {completedRewardGoals.length > 0 && (
            <section
              className="mb-6 rounded-3xl border border-amber-100 bg-white p-4 shadow-sm dark:border-amber-900/40 dark:bg-background sm:p-5"
              aria-labelledby="student-completed-goals"
              data-testid="card-student-completed-goals"
            >
              <div className="mb-4 flex items-center gap-3">
                <AvatarDisplay
                  avatar={student.avatar}
                  fallback={student.displayName.charAt(0)}
                  size="lg"
                  className="shrink-0 rounded-2xl bg-amber-50 ring-2 ring-amber-100 dark:bg-amber-950 dark:ring-amber-900"
                />
                <div className="min-w-0">
                  <p className="text-xs font-black text-amber-700 dark:text-amber-300">
                    {lang === "ar" ? "إنجازاتي" : "My achievements"}
                  </p>
                  <h2 id="student-completed-goals" className="truncate text-lg font-black">
                    {lang === "ar" ? "أهداف أكملتها" : "Completed goals"}
                  </h2>
                </div>
                <Award className="ms-auto h-6 w-6 shrink-0 text-[#E8A80E]" aria-hidden="true" />
              </div>

              <ul className="grid gap-2 sm:grid-cols-2">
                {completedRewardGoals.map((goal) => (
                  <li
                    key={goal.id}
                    className="flex min-w-0 items-center gap-3 rounded-2xl bg-amber-50/70 px-3 py-3 dark:bg-amber-950/20"
                    data-testid={`completed-goal-${goal.id}`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8A80E]/15 text-amber-700 dark:text-amber-300">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black">{goal.title}</p>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                        {lang === "ar" ? "اكتمل في " : "Completed "}
                        <time dateTime={goal.completedAt}>
                          {new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(goal.completedAt))}
                        </time>
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-black text-amber-700 shadow-sm dark:bg-background dark:text-amber-300">
                      {arDigit(goal.targetPoints)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Public profile link + verification prompt */}
          <div className="mb-6 animate-in fade-in duration-300 delay-75 space-y-2">
            <Link href={`/stu/${student.username}`}>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer">
                <span className="text-sm font-medium text-emerald-800">
                  {copy.publicProfile}
                </span>
                <ExternalLink className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
            </Link>
            {student.isVerified === false && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <BadgeCheck className="w-4 h-4 shrink-0" />
                <span>
                  {copy.unverified}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8 animate-in fade-in duration-300 delay-100">
            <Card className="p-4 sm:p-5 text-center hover:shadow-md transition-shadow">
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mx-auto mb-2.5 sm:mb-3"
                style={{ background: "rgba(232,168,14,0.12)" }}
              >
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: "#C9920A" }} />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground">
                {student.totalScore.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {copy.totalScore}
              </p>
            </Card>
            <Card className="p-4 sm:p-5 text-center hover:shadow-md transition-shadow">
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mx-auto mb-2.5 sm:mb-3"
                style={{ background: "rgba(30,77,53,0.10)" }}
              >
                <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: "#1E4D35" }} />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground">
                {student.gamesPlayed.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {copy.gamesPlayed}
              </p>
            </Card>
            <Card className="p-4 sm:p-5 text-center hover:shadow-md transition-shadow">
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mx-auto mb-2.5 sm:mb-3"
                style={{ background: "rgba(232,168,14,0.12)" }}
              >
                <Medal className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: "#E8A80E" }} />
              </div>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground">
                #{student.rank.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                {copy.rank}
              </p>
            </Card>
          </div>

          {quranWards.length > 0 && (
            <section className="mb-8 animate-in fade-in duration-300 delay-100" aria-labelledby="student-quran-wards">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                  <h2 id="student-quran-wards" className="text-xl font-bold text-foreground">
                    {lang === "ar" ? "مهامي في القرآن" : "My Quran tasks"}
                  </h2>
                </div>
                <Link
                  href="/student/quran-journey"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                >
                  {lang === "ar" ? "رحلتي القرآنية" : "Quran Journey"}
                  {dir === "rtl" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {quranWards.map((ward) => (
                  <Link key={ward.id} href={`/student/quran-wards/${ward.id}`}>
                    <Card
                      className="group h-full cursor-pointer border-emerald-100 p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-emerald-900/50"
                      data-testid={`student-quran-ward-${ward.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                            ward.mode === "memorization"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          }`}>
                            {ward.mode === "memorization"
                              ? (lang === "ar" ? "حفظ" : "Memorization")
                              : (lang === "ar" ? "مراجعة" : "Review")}
                          </span>
                          <h3 className="mt-3 truncate text-lg font-black">
                            {lang === "ar" ? `سورة ${ward.surahName}` : `Surah ${ward.surahName}`}
                          </h3>
                          <p className="mt-1 text-sm font-bold text-muted-foreground">
                            {lang === "ar"
                              ? `الآيات ${arDigit(ward.startAyah)}–${arDigit(ward.endAyah)}`
                              : `Ayahs ${ward.startAyah}–${ward.endAyah}`}
                          </p>
                          {ward.dueDate && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {lang === "ar" ? "الموعد: " : "Due: "}
                              {new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en", {
                                day: "numeric",
                                month: "short",
                              }).format(new Date(`${ward.dueDate}T00:00:00`))}
                            </p>
                          )}
                        </div>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-700 group-hover:text-white dark:bg-emerald-950">
                          {dir === "rtl" ? <ArrowLeft className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Motivation & Rewards Section */}
          <div className="mb-8 animate-in fade-in duration-300 delay-100">
            {motivationError && motivationErr?.message.includes("404") ? (
              <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-6 text-center">
                <Gift className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-50" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">نظام المكافآت</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
                  لم يتم ربط ملف الصغار الخاص بك. اطلب من معلمك تفعيل نظام المكافآت لتبدأ في جمع النجوم والأوسمة!
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Gift className="w-5 h-5 text-emerald-600" />
                    المكافآت والأوسمة
                  </h2>
                  <div className="flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-full font-bold text-sm">
                    <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
                    {motivationLoading ? "..." : motivation?.balance || 0} نقطة
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Badges */}
                  <Card className="p-5 flex flex-col h-full border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Award className="w-5 h-5 text-amber-500" />
                        أوسمتي
                      </h3>
                      <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md text-slate-500">{motivation?.badges?.length || 0} وسام</span>
                    </div>
                    {motivationLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : (motivation?.badges?.length || 0) > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {motivation!.badges.map(grant => (
                          <div key={grant.id || grant.title} className="flex flex-col items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center border border-slate-100 dark:border-slate-800">
                            <div className="w-10 h-10 mb-2 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xl">
                               <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">{grant.title}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400 dark:text-slate-500 flex-1">
                        <Award className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">لم تحصل على أوسمة بعد، استمر في التقدم!</p>
                      </div>
                    )}
                  </Card>

                  {/* Rewards */}
                  <Card className="p-5 flex flex-col h-full border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <Gift className="w-5 h-5 text-indigo-500" />
                        متجر الجوائز
                      </h3>
                    </div>
                    {rewardsLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                    ) : rewards.length > 0 ? (
                      <div className="space-y-3">
                        {rewards.map(reward => {
                          const activeRequest = redemptions.find(r => r.reward_title === reward.title && (r.status === 'requested' || r.status === 'approved'));
                          return (
                          <div key={reward.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Gift className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-bold text-sm text-slate-800 dark:text-slate-200">{reward.title}</div>
                                <div className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                                  {reward.cost} نقطة
                                </div>
                              </div>
                            </div>
                            {activeRequest ? (
                              <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">قيد التنفيذ</span>
                            ) : (
                              <Button
                                size="sm"
                                disabled={(motivation?.balance || 0) < reward.cost || redeemReward.isPending || reward.status !== 'active'}
                                onClick={() => {
                                  const idempotencyKey = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
                                  redeemReward.mutate({ rewardId: reward.id, idempotencyKey }, {
                                    onSuccess: () => toast.success("تم طلب الجائزة بنجاح! بانتظار موافقة المعلم."),
                                    onError: () => toast.error("حدث خطأ أثناء طلب الجائزة.")
                                  });
                                }}
                                className={`text-xs font-bold rounded-lg ${reward.status !== 'active' ? 'bg-slate-200 text-slate-400' : (motivation?.balance || 0) >= reward.cost ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500'}`}
                              >
                                استبدال
                              </Button>
                            )}
                          </div>
                        )})}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400 dark:text-slate-500 flex-1">
                        <Gift className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm">لا توجد جوائز متاحة حالياً.</p>
                      </div>
                    )}
                  </Card>
                </div>
              </>
            )}
          </div>

          {recentScores.length > 0 && (
            <div className="mb-8 animate-in fade-in duration-300 delay-150">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: "#1E4D35" }} />
                {copy.recentResults}
              </h2>
              <Card className="divide-y divide-border">
                {recentScores.map((s) => {
                  const label = GAME_LABELS[s.game];
                  return (
                    <div key={`${s.game}-${s.id}`} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${label?.color || "bg-muted text-muted-foreground"}`}>
                          {label ? copy[label.key] : s.game}
                        </span>
                        {s.game === "wameeth" && s.name && (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{s.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-foreground">
                          {s.score.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
                        </span>
                        <span className="text-xs text-muted-foreground min-w-[60px] text-end">
                          {formatDate(s.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          )}

          {/* Live competitions available right now (open rooms + general quizzes) */}
          <div className="animate-in fade-in duration-300 delay-100 mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              {copy.availableNow}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Open live rooms — join via PIN */}
              <Link href="/game/join">
                <Card
                  className="p-5 cursor-pointer group h-full relative overflow-hidden border-0 text-white transition-all hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg,#1E4D35 0%,#2d7050 60%,#1E4D35 100%)",
                    boxShadow: "0 10px 30px -10px rgba(30,77,53,0.5)",
                  }}
                >
                  <div
                    aria-hidden
                    className="absolute pointer-events-none"
                    style={{
                      top: -40,
                      [dir === "rtl" ? "left" : "right"]: -40,
                      width: 140,
                      height: 140,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle, rgba(232,168,14,0.30) 0%, transparent 70%)",
                    }}
                  />
                  <div className="relative flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
                      style={{
                        background: "rgba(232,168,14,0.22)",
                        border: "1px solid rgba(232,168,14,0.45)",
                      }}
                    >
                      <Users className="w-6 h-6" style={{ color: "#E8A80E" }} />
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                        style={{ background: "#468064", boxShadow: "0 0 0 3px rgba(34,197,94,0.25)" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold tracking-wide text-white/70 uppercase mb-0.5">
                        {copy.openRooms}
                      </div>
                      <div className="text-2xl font-black tabular-nums leading-tight">
                        {liveCount === null
                          ? "…"
                          : (liveCount as number).toLocaleString(lang === "ar" ? "ar-EG" : "en")}
                      </div>
                      <div className="text-xs text-white/80 mt-0.5">
                         {copy.pinHint}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>

              {/* General Quizzes — ready quiz bank, always available */}
              <Link href="/islamic">
                <Card
                  className="p-5 cursor-pointer group h-full relative overflow-hidden border-0 text-white transition-all hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg,#173a28 0%,#2f684d 100%)",
                    boxShadow: "0 10px 30px -10px rgba(5,150,105,0.5)",
                  }}
                >
                  <div
                    aria-hidden
                    className="absolute pointer-events-none"
                    style={{
                      top: -40,
                      [dir === "rtl" ? "left" : "right"]: -40,
                      width: 140,
                      height: 140,
                      borderRadius: "50%",
                      background:
                        "radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)",
                    }}
                  />
                  <div className="relative flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.18)",
                        border: "1px solid rgba(255,255,255,0.25)",
                      }}
                    >
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold tracking-wide text-white/80 uppercase mb-0.5">
                        {copy.quizBank}
                      </div>
                      <div className="text-base font-extrabold leading-tight">
                        {copy.generalQuizzes}
                      </div>
                      <div className="text-xs text-white/85 mt-0.5">
                         {copy.topicsHint}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>

          <div className="animate-in fade-in duration-300 delay-200">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: "#E8A80E" }} />
              {copy.availableGames}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {games.map((game) => {
                const Icon = game.icon;
                return (
                  <Link key={game.href} href={game.href}>
                    <Card
                      className="p-4 sm:p-5 hover:shadow-lg transition-all cursor-pointer group h-full"
                      style={{ borderColor: "rgba(0,0,0,0.08)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(232,168,14,0.45)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.08)"; }}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${game.color}`}>
                          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight transition-colors group-hover:text-[#1E4D35]">
                            {game.title}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {copy.clickToPlay}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {(assignmentsLoading || assignments.length > 0) && (
            <div className="mt-8 animate-in fade-in duration-300 delay-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  {copy.readyQuizzes}
                </h2>
                <Link
                  href="/public/games"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-amber-400/40 transition-all"
                >
                  {copy.viewAll}
                  {dir === "rtl" ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </Link>
              </div>

              {assignmentsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-36 rounded-2xl border border-border/40 bg-card animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assignments.map((a, i) => (
                    <div
                      key={a.id}
                      className="bg-card border border-border/50 rounded-2xl p-4 hover:shadow-lg transition-all hover:border-amber-400/30 flex flex-col gap-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-foreground text-sm leading-tight mb-1 line-clamp-2">{a.title}</h3>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {a.teacherName || copy.anonymous}
                            </span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {a.questionCount} {copy.questionShort}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={() => setBotDialogAssignment(a)}
                          disabled={startingGameId === a.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white font-bold text-xs hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60"
                          style={{ background: "linear-gradient(135deg,#1E4D35 0%,#2d7050 100%)" }}
                        >
                          {startingGameId === a.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          {startingGameId === a.id
                            ? copy.starting
                            : copy.startGame}
                        </button>
                        <button
                          onClick={() => copyLink(a)}
                          className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-bold text-xs hover:bg-muted transition-colors"
                          title={copy.copyLink}
                        >
                          {copiedId === a.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!assignmentsLoading && assignments.length > 0 && (
                <div className="text-center mt-6">
                  <Link
                    href="/public/games"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border hover:border-amber-400/40 text-sm font-bold text-muted-foreground hover:text-foreground transition-all"
                  >
                    <Globe className="w-4 h-4" />
                    {copy.viewAllQuizzes}
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {botDialogAssignment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setBotDialogAssignment(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              dir={dir}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setBotDialogAssignment(null)}
                className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center gap-1 mb-5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-lg"
                  style={{ background: "linear-gradient(135deg,#E8A80E 0%,#C9920A 100%)" }}
                >
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-extrabold text-foreground">
                  {copy.startGame}
                </h2>
                <p className="text-sm text-muted-foreground font-medium truncate max-w-[220px]">
                  {botDialogAssignment.title}
                </p>
              </div>

              <div className="bg-muted/50 rounded-xl p-4 mb-5 border border-border/60">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(30,77,53,0.12)" }}
                  >
                    <Bot className="w-5 h-5" style={{ color: "#1E4D35" }} />
                  </div>
                  <p className="font-bold text-foreground text-sm">
                    {t.publicGames.botPrompt}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  {t.publicGames.botDescription}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {t.publicGames.botCount}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBotCount(c => Math.max(2, c - 1))}
                      className="w-7 h-7 rounded-lg bg-background border border-border text-foreground font-bold text-base hover:bg-muted transition-colors flex items-center justify-center"
                    >-</button>
                    <span className="w-6 text-center font-extrabold text-foreground">{botCount}</span>
                    <button
                      onClick={() => setBotCount(c => Math.min(8, c + 1))}
                      className="w-7 h-7 rounded-lg bg-background border border-border text-foreground font-bold text-base hover:bg-muted transition-colors flex items-center justify-center"
                    >+</button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleStartGame(botDialogAssignment.id, true, botCount)}
                  disabled={startingGameId === botDialogAssignment.id}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#1E4D35 0%,#2d7050 100%)" }}
                >
                  {startingGameId === botDialogAssignment.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  {t.publicGames.playWithBots.replace("{n}", String(botCount))}
                </button>
                <button
                  onClick={() => handleStartGame(botDialogAssignment.id, false, 0)}
                  disabled={startingGameId === botDialogAssignment.id}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
                  style={{ background: "#E8A80E", color: "#1E4D35" }}
                >
                  {startingGameId === botDialogAssignment.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {t.publicGames.playSolo}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
