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
  const [loading, setLoading] = useState(true);

  const [assignments, setAssignments] = useState<PublicAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [startingGameId, setStartingGameId] = useState<number | null>(null);
  const [botDialogAssignment, setBotDialogAssignment] = useState<PublicAssignment | null>(null);
  const [botCount, setBotCount] = useState(4);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/assignments`)
      .then(r => r.ok ? r.json() : [])
      .then(a => setAssignments(Array.isArray(a) ? a.slice(0, 12) : []))
      .catch(() => {})
      .finally(() => setAssignmentsLoading(false));
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
    ]).then(([profileData, scoresData]) => {
      if (profileData) setStudent(profileData);
      setRecentScores(Array.isArray(scoresData) ? scoresData : []);
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </Layout>
    );
  }

  if (!student) return null;

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
      <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-blue-50 to-background dark:from-blue-950/30 dark:to-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="mb-8 animate-in fade-in duration-300">
            <Card className="p-6 sm:p-8 bg-gradient-to-br from-blue-600 to-cyan-600 text-white border-0 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                    <GraduationCap className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-extrabold">
                      {lang === "ar" ? `مرحباً، ${student.displayName}!` : `Welcome, ${student.displayName}!`}
                    </h1>
                    <p className="text-white/70 text-sm mt-0.5">@{student.username}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
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

          <div className="grid grid-cols-3 gap-4 mb-8 animate-in fade-in duration-300 delay-100">
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">
                {student.totalScore.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar" ? "إجمالي النقاط" : "Total Score"}
              </p>
            </Card>
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Gamepad2 className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">
                {student.gamesPlayed.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar" ? "الألعاب المُنجزة" : "Games Played"}
              </p>
            </Card>
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <Medal className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-2xl font-extrabold text-foreground">
                #{student.rank.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "ar" ? "الترتيب" : "Rank"}
              </p>
            </Card>
          </div>

          {recentScores.length > 0 && (
            <div className="mb-8 animate-in fade-in duration-300 delay-150">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
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

          <div className="animate-in fade-in duration-300 delay-200">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              {lang === "ar" ? "الألعاب المتاحة" : "Available Games"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {games.map((game) => {
                const Icon = game.icon;
                return (
                  <Link key={game.href} href={game.href}>
                    <Card className="p-5 hover:shadow-lg transition-all cursor-pointer group hover:border-blue-300 dark:hover:border-blue-700">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${game.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground group-hover:text-blue-600 transition-colors">
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
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60"
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
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-2 shadow-lg">
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
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-blue-500" />
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
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
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
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-sm hover:opacity-90 transition-opacity shadow-md disabled:opacity-60"
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
