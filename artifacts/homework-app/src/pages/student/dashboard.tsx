import { useState, useEffect } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

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
}

interface RecentScore {
  id: number;
  score: number;
  name?: string;
  game: "flags" | "color" | "memory" | "multiply" | "scramble" | "capitals" | "wameeth" | "stroop";
  createdAt: string;
}

const GAME_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  flags: { ar: "أعلام الدول", en: "Flag Quiz", color: "text-emerald-600 bg-emerald-500/10" },
  color: { ar: "لعبة الألوان", en: "Color Game", color: "text-orange-600 bg-orange-500/10" },
  memory: { ar: "لعبة الذاكرة", en: "Memory Match", color: "text-pink-600 bg-pink-500/10" },
  multiply: { ar: "جدول الضرب", en: "Multiplication", color: "text-cyan-600 bg-cyan-500/10" },
  scramble: { ar: "الكلمات المبعثرة", en: "Scrambled Words", color: "text-violet-600 bg-violet-500/10" },
  capitals: { ar: "عواصم العالم", en: "World Capitals", color: "text-teal-600 bg-teal-500/10" },
  wameeth: { ar: "وميض", en: "Wameeth", color: "text-amber-600 bg-amber-500/10" },
  stroop: { ar: "ارتباك", en: "Stroop", color: "text-red-600 bg-red-500/10" },
};

export default function StudentDashboard() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [recentScores, setRecentScores] = useState<RecentScore[]>([]);
  const [activityDays, setActivityDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [startingGameId, setStartingGameId] = useState<number | null>(null);
  const [botDialogAssignment, setBotDialogAssignment] = useState<PublicAssignment | null>(null);
  const [botCount, setBotCount] = useState(4);
  // Live "what's available right now" — open rooms count.
  const [liveCount, setLiveCount] = useState<number | null>(null);

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
    ]).then(([profileData, scoresData, daysData]) => {
      if (profileData) setStudent(profileData);
      setRecentScores(Array.isArray(scoresData) ? scoresData : []);
      setActivityDays(Array.isArray(daysData?.days) ? daysData.days : []);
    }).catch(() => setLocation("/student/login")).finally(() => setLoading(false));
  }, [setLocation]);

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
      if (!res.ok) throw new Error(data.message || "خطأ في بدء اللعبة");
      setLocation(`/game/join/${data.pin}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "خطأ في بدء اللعبة";
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
    toast.success(lang === "ar" ? "تم تسجيل الخروج" : "Logged out");
    setLocation("/");
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1E4D35" }} />
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
      title: lang === "ar" ? "أعلام الدول" : "Flag Quiz",
      color: "bg-emerald-500/10 text-emerald-600",
    },
    {
      href: "/game/color",
      icon: Palette,
      title: lang === "ar" ? "لعبة الألوان" : "Color Game",
      color: "bg-orange-500/10 text-orange-600",
    },
    {
      href: "/game/memory",
      icon: Brain,
      title: lang === "ar" ? "لعبة الذاكرة" : "Memory Match",
      color: "bg-pink-500/10 text-pink-600",
    },
    {
      href: "/game/multiply",
      icon: Calculator,
      title: lang === "ar" ? "جدول الضرب" : "Multiplication",
      color: "bg-cyan-500/10 text-cyan-600",
    },
    {
      href: "/game/scramble",
      icon: Shuffle,
      title: lang === "ar" ? "الكلمات المبعثرة" : "Scrambled Words",
      color: "bg-violet-500/10 text-violet-600",
    },
    {
      href: "/game/letrly",
      icon: Type,
      title: lang === "ar" ? "تحدي الكلمة" : "Word Challenge",
      color: "bg-emerald-500/10 text-emerald-600",
    },
    {
      href: "/game/capitals",
      icon: Landmark,
      title: lang === "ar" ? "عواصم العالم" : "World Capitals",
      color: "bg-teal-500/10 text-teal-600",
    },
    {
      href: "/game/stroop",
      icon: CircleDot,
      title: lang === "ar" ? "ارتباك" : "Stroop",
      color: "bg-red-500/10 text-red-600",
    },
    {
      href: "/game/million",
      icon: DollarSign,
      title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wins a Million?",
      color: "bg-amber-500/10 text-amber-600",
    },
    {
      href: "/game/maraqui",
      icon: Route,
      title: lang === "ar" ? "المراقي" : "Maraqui",
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

    if (lang === "ar") {
      if (diffMin < 1) return "الآن";
      if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
      if (diffHr < 24) return `منذ ${diffHr} ساعة`;
      if (diffDay < 7) return `منذ ${diffDay} يوم`;
      return d.toLocaleDateString("ar-EG");
    }
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString("en");
  };

  return (
    <Layout>
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
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,14,0.22)", border: "1px solid rgba(232,168,14,0.45)" }}
                  >
                    <GraduationCap className="w-7 h-7" style={{ color: "#E8A80E" }} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-extrabold truncate">
                      {lang === "ar" ? `مرحباً، ${student.displayName}!` : `Welcome, ${student.displayName}!`}
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
                          ? (lang === "ar" ? "ابدأ سلسلتك اليوم!" : "Start your streak!")
                          : streakInfo.playedToday
                            ? (lang === "ar"
                                ? `${arDigit(streakInfo.streak)} ${streakInfo.streak === 1 ? "يوم" : streakInfo.streak === 2 ? "يومان" : "أيام"} متتالية`
                                : `${streakInfo.streak} day${streakInfo.streak === 1 ? "" : "s"} streak`)
                            : (lang === "ar"
                                ? `${arDigit(streakInfo.streak)} ${streakInfo.streak === 1 ? "يوم" : streakInfo.streak === 2 ? "يومان" : "أيام"} • العب اليوم!`
                                : `${streakInfo.streak} day${streakInfo.streak === 1 ? "" : "s"} • play today!`)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                  title={lang === "ar" ? "تسجيل الخروج" : "Logout"}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </Card>
          </div>

          <div className="mb-6 animate-in fade-in duration-300 delay-75">
            <InstallAppButton variant="card" />
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
                {lang === "ar" ? "إجمالي النقاط" : "Total Score"}
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
                {lang === "ar" ? "الألعاب المُنجزة" : "Games Played"}
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
                {lang === "ar" ? "الترتيب" : "Rank"}
              </p>
            </Card>
          </div>

          {recentScores.length > 0 && (
            <div className="mb-8 animate-in fade-in duration-300 delay-150">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: "#1E4D35" }} />
                {lang === "ar" ? "آخر النتائج" : "Recent Results"}
              </h2>
              <Card className="divide-y divide-border">
                {recentScores.map((s) => {
                  const label = GAME_LABELS[s.game];
                  return (
                    <div key={`${s.game}-${s.id}`} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${label?.color || "bg-muted text-muted-foreground"}`}>
                          {lang === "ar" ? label?.ar : label?.en}
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
              {lang === "ar" ? "مسابقات متاحة الآن" : "Available Now"}
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
                        style={{ background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,0.25)" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold tracking-wide text-white/70 uppercase mb-0.5">
                        {lang === "ar" ? "غرف مفتوحة الآن" : "Open rooms now"}
                      </div>
                      <div className="text-2xl font-black tabular-nums leading-tight">
                        {liveCount === null
                          ? "…"
                          : (liveCount as number).toLocaleString(lang === "ar" ? "ar-EG" : "en")}
                      </div>
                      <div className="text-xs text-white/80 mt-0.5">
                        {lang === "ar"
                          ? "ادخل برمز PIN للانضمام لمسابقة"
                          : "Enter a PIN to join a contest"}
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
                    background: "linear-gradient(135deg,#064e3b 0%,#059669 100%)",
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
                        {lang === "ar" ? "بنك مسابقات" : "Quiz bank"}
                      </div>
                      <div className="text-base font-extrabold leading-tight">
                        {lang === "ar" ? "مسابقات عامة" : "General Quizzes"}
                      </div>
                      <div className="text-xs text-white/85 mt-0.5">
                        {lang === "ar"
                          ? "أسئلة جاهزة في مختلف المجالات"
                          : "Ready questions across topics"}
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
              {lang === "ar" ? "الألعاب المتاحة" : "Available Games"}
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
                            {lang === "ar" ? "اضغط للعب" : "Click to play"}
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
                  {lang === "ar" ? "أسئلة ومسابقات جاهزة" : "Ready-made Quizzes"}
                </h2>
                <Link
                  href="/public/games"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:border-amber-400/40 transition-all"
                >
                  {lang === "ar" ? "عرض الكل" : "View All"}
                  {lang === "ar" ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
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
                              {a.teacherName || (lang === "ar" ? "مجهول" : "Anonymous")}
                            </span>
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {a.questionCount} {lang === "ar" ? "سؤال" : "Q"}
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
                            ? (lang === "ar" ? "جارٍ..." : "Starting...")
                            : (lang === "ar" ? "ابدأ اللعبة" : "Start Game")}
                        </button>
                        <button
                          onClick={() => copyLink(a)}
                          className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground font-bold text-xs hover:bg-muted transition-colors"
                          title={lang === "ar" ? "نسخ الرابط" : "Copy Link"}
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
                    {lang === "ar" ? "عرض جميع المسابقات" : "View All Quizzes"}
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
                  {lang === "ar" ? "ابدأ اللعبة" : "Start Game"}
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
                    {lang === "ar" ? "هل تريد منافسة لاعبين وهميين؟" : "Want to compete with bot players?"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                  {lang === "ar"
                    ? "سيتنافس معك لاعبون وهميون ويمكنك تجميدهم أو سرقة نقاطهم!"
                    : "Bot players will compete with you — freeze them or steal their points!"}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {lang === "ar" ? "عدد الوهميين" : "Bot count"}
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
                  {lang === "ar" ? `نعم، العب مع ${botCount} لاعبين وهميين` : `Yes, play with ${botCount} bots`}
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
                  {lang === "ar" ? "لا، العب بمفردك" : "No, play solo"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
