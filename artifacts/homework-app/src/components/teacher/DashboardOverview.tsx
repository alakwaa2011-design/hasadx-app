import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Play,
  Share2,
  Copy,
  Check,
  Sparkles,
  Trophy,
  Users,
  BookText,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Gamepad2,
  TrendingUp,
  Crown,
  Send,
  Zap,
  Globe,
  Video,
  ArrowUpRight,
  MessageCircle,
  Loader2,
  Radio,
  Link as LinkIcon,
  X,
  Search,
  Award,
  Flame,
  Rocket,
  Star,
  Target,
  PartyPopper,
} from "lucide-react";
import { Card, Button } from "@/components/ui-elements";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";
import { platformHarvestBg } from "@/lib/platform-harvest-bg";

type TabId = "overview" | "assignments" | "shared" | "competitive" | "tools" | "videos" | "stats";

interface Assignment {
  id: number;
  title: string;
  type?: string | null;
  subject?: string | null;
  questionCount: number;
  submissionCount: number;
  deadline?: string | null;
  createdAt?: string;
}

interface Props {
  user: any;
  assignments: Assignment[] | undefined;
  isLoading: boolean;
  lang: "ar" | "en";
  setLocation: (path: string) => void;
  setActiveTab: (tab: TabId) => void;
  startGame: (assignmentId: number, e?: React.MouseEvent) => void;
  creatingGameForId: number | null;
}

interface ClassInfo {
  name: string;
  studentCount: number;
}

interface TopStudent {
  id: number;
  name: string;
  className?: string | null;
  score: number;
}

const SUBJECT_TONES: Record<string, { bg: string; text: string; ring: string }> = {
  islamic: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  math:    { bg: "bg-stone-100",  text: "text-stone-700",   ring: "ring-stone-200" },
  arabic:  { bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200" },
  science: { bg: "bg-teal-50",    text: "text-teal-700",    ring: "ring-teal-200" },
  english: { bg: "bg-orange-50",  text: "text-orange-700",  ring: "ring-orange-200" },
  default: { bg: "bg-stone-50",   text: "text-stone-700",   ring: "ring-stone-200" },
};

function getSubjectTone(subject?: string | null) {
  if (!subject) return SUBJECT_TONES.default;
  const s = subject.toLowerCase();
  if (s.includes("إسلام") || s.includes("islam") || s.includes("قرآن") || s.includes("دين")) return SUBJECT_TONES.islamic;
  if (s.includes("رياض") || s.includes("math") || s.includes("حساب")) return SUBJECT_TONES.math;
  if (s.includes("عرب") || s.includes("arab") || s.includes("لغة")) return SUBJECT_TONES.arabic;
  if (s.includes("علوم") || s.includes("science")) return SUBJECT_TONES.science;
  if (s.includes("english") || s.includes("إنجل")) return SUBJECT_TONES.english;
  return SUBJECT_TONES.default;
}

function timeAgo(date: string | undefined, isAr: boolean): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `قبل ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `قبل ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return isAr ? `قبل ${days} ي` : `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return isAr ? `قبل ${weeks} أ` : `${weeks}w ago`;
}

const BASE = (import.meta as any).env?.VITE_API_URL || "";

export default function DashboardOverview({
  user,
  assignments,
  isLoading,
  lang,
  setLocation,
  setActiveTab,
  startGame,
  creatingGameForId,
}: Props) {
  const isAr = lang === "ar";
  const [shareAssignment, setShareAssignment] = useState<Assignment | null>(null);

  // ── Cached fetches via React Query (avoid refetch on tab switch) ──
  const { data: classes = [] } = useQuery<ClassInfo[]>({
    queryKey: ["dashboard-overview", "classes"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/teacher/classes`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data.map((c: any) => ({ name: c.name, studentCount: c.studentCount ?? 0 })) : [];
    },
  });

  const { data: topStudents = [] } = useQuery<TopStudent[]>({
    queryKey: ["dashboard-overview", "top-students"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/teacher/stats`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data?.topStudents) ? data.topStudents.slice(0, 3) : [];
    },
  });

  const stats = useMemo(() => {
    const list = assignments || [];
    const totalSubmissions = list.reduce((acc, a) => acc + (a.submissionCount || 0), 0);
    const now = Date.now();
    const active = list.filter((a) => !a.deadline || new Date(a.deadline).getTime() >= now).length;
    return {
      total: list.length,
      submissions: totalSubmissions,
      active,
      classes: classes.length,
    };
  }, [assignments, classes]);

  const recentAssignments = useMemo(() => {
    return [...(assignments || [])]
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 4);
  }, [assignments]);

  const playableAssignments = useMemo(
    () => (assignments || []).filter((a) => a.questionCount > 0),
    [assignments]
  );

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (isAr) {
      if (h < 12) return "صباح الخير";
      return "مساء الخير";
    }
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, [isAr]);

  const teacherName = user?.fullName || user?.username || (isAr ? "أستاذ" : "Teacher");
  const subtitle = stats.submissions > 0
    ? (isAr
        ? `لديك ${stats.submissions} تسليمًا على ${stats.total} واجبًا — أحسنت!`
        : `You have ${stats.submissions} submissions across ${stats.total} assignments — great job!`)
    : (isAr ? "ابدأ بإنشاء أول مسابقة لطلابك" : "Start by creating your first competition");

  return (
    <div className="space-y-5">
      {/* ── 1. Slim greeting bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative w-full overflow-hidden rounded-2xl text-white shadow-md min-h-[52px]"
        style={{ background: "#225739" }}
      >
        <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-amber-300/10 blur-2xl pointer-events-none" />
        <div className="relative px-4 sm:px-5 py-2 flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-200 ring-1 ring-amber-300/30 shrink-0">
            <Flame className="w-3 h-3" />
            {greeting}
          </span>
          <h1 className="text-sm sm:text-base font-extrabold tracking-tight truncate min-w-0 flex-1">
            {isAr ? `أهلاً، ${teacherName}` : `Welcome, ${teacherName}`}
            <span className="ms-1.5">👋</span>
          </h1>
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-white/80">
            <span className="inline-flex items-center gap-1"><BookText className="w-3 h-3" />{stats.total}</span>
            <span className="text-white/30">·</span>
            <span className="inline-flex items-center gap-1"><Send className="w-3 h-3" />{stats.submissions}</span>
            <span className="text-white/30">·</span>
            <span className="inline-flex items-center gap-1"><Target className="w-3 h-3" />{stats.active}</span>
          </div>
          <button
            onClick={() => setLocation("/teacher/new")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-primary font-bold text-[11px] shadow hover:bg-amber-50 transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAr ? "نشاط جديد" : "New activity"}
          </button>
        </div>
      </motion.div>

      {/* ── AI Presentations promo card — prominent so teachers find it ── */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        onClick={() => setLocation("/teacher/presentations")}
        className="group relative overflow-hidden w-full text-start rounded-2xl px-4 sm:px-5 py-2 min-h-[52px] shadow-md hover:shadow-lg hover:scale-[1.005] transition-all"
        style={{ background: platformHarvestBg(isAr) }}
      >
        <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/12 blur-2xl pointer-events-none" />
        <div
          className="absolute -bottom-12 -end-12 w-48 h-48 rounded-full blur-2xl pointer-events-none"
          style={{ backgroundColor: "rgba(212, 175, 55, 0.35)" }}
        />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 pointer-events-none" />
        <div className="relative flex items-center gap-2.5 sm:gap-3">
          <div className="text-3xl sm:text-4xl drop-shadow-lg shrink-0 leading-none">🎬</div>
          <div className="flex-1 min-w-0 relative z-[1] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
            <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-white text-[10px] font-bold mb-1 ring-1 ring-white/25">
              <Sparkles className="w-2.5 h-2.5" />
              {isAr ? "جديد · ذكاء اصطناعي" : "New · AI"}
            </div>
            <div className="text-white font-extrabold text-sm sm:text-base leading-tight">
              {isAr ? "العروض التفاعلية" : "Interactive Presentations"}
            </div>
            <div className="text-white/85 text-[11px] sm:text-xs mt-0.5 line-clamp-1">
              {isAr
                ? "أنشئ عرضاً درسياً كاملاً بالذكاء الاصطناعي مع ألعاب حصاد التفاعلية في ثوانٍ."
                : "Generate a complete lesson deck with Hasad games in seconds."}
            </div>
          </div>
          <div className="hidden sm:flex shrink-0 items-center gap-1 bg-white text-[#225739] px-3 py-1.5 rounded-lg text-xs font-bold group-hover:scale-105 transition-transform shadow-md shadow-black/10">
            {isAr ? "ابدأ الآن" : "Start now"}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </motion.button>

      {/* ── 2. Quick Launch Hero ── */}
      <QuickLaunchHero
        assignments={playableAssignments}
        isAr={isAr}
        startGame={startGame}
        creatingGameForId={creatingGameForId}
        setLocation={setLocation}
      />

      {/* ── 3. Quick actions strip — full width, bright tile grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        <QuickTile
          icon={<Trophy className="w-5 h-5" />}
          label={isAr ? "ألعاب تنافسية" : "Games"}
          desc={isAr ? "تحدّيات ممتعة" : "Fun challenges"}
          tone="amber"
          onClick={() => setActiveTab("competitive")}
        />
        <QuickTile
          icon={<Globe className="w-5 h-5" />}
          label={isAr ? "مسابقات مشتركة" : "Shared"}
          desc={isAr ? "من المعلمين" : "From teachers"}
          tone="emerald"
          onClick={() => setActiveTab("shared")}
        />
        <QuickTile
          icon={<Wand2 className="w-5 h-5" />}
          label={isAr ? "ذكاء اصطناعي" : "AI tools"}
          desc={isAr ? "أنشئ بسرعة" : "Create fast"}
          tone="primary"
          onClick={() => setActiveTab("tools")}
        />
        <QuickTile
          icon={<Video className="w-5 h-5" />}
          label={isAr ? "الفيديو التفاعلي" : "Interactive Video"}
          desc={isAr ? "فيديوهات حية" : "Live videos"}
          tone="rose"
          onClick={() => setActiveTab("videos")}
        />
        <QuickTile
          icon={<TrendingUp className="w-5 h-5" />}
          label={isAr ? "ملخص الأداء" : "Stats"}
          desc={isAr ? "تقدم طلابك" : "Student growth"}
          tone="sky"
          onClick={() => setActiveTab("stats")}
        />
      </motion.div>

      {/* ── 4. Recent assignments + Top students ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="lg:col-span-2"
        >
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">
                {isAr ? "آخر الواجبات والمسابقات" : "Recent assignments & competitions"}
              </h3>
              <button
                onClick={() => setActiveTab("assignments")}
                className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
              >
                {isAr ? "عرض الكل" : "View all"}
                {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : recentAssignments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <BookText className="w-12 h-12 mx-auto opacity-30 mb-3" />
                <p className="text-sm mb-3">{isAr ? "لا توجد واجبات بعد" : "No assignments yet"}</p>
                <Button onClick={() => setLocation("/teacher/new")} className="text-sm">
                  <Plus className="w-4 h-4 me-1" />
                  {isAr ? "إنشاء أول واجب" : "Create first assignment"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAssignments.map((a) => (
                  <RecentAssignmentRow
                    key={a.id}
                    assignment={a}
                    isAr={isAr}
                    onPlay={() => startGame(a.id)}
                    onShare={() => setShareAssignment(a)}
                    onOpen={() => setLocation(`/teacher/assignment/${a.id}`)}
                    isStarting={creatingGameForId === a.id}
                  />
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.2 }}
          className="space-y-5"
        >
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-amber-500" />
                {isAr ? "أفضل الطلاب" : "Top students"}
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                {isAr ? "هذا الأسبوع" : "This week"}
              </span>
            </div>
            {topStudents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                <Trophy className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p>{isAr ? "ستظهر هنا بعد بدء التسليمات" : "Will appear after first submissions"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topStudents.map((s, i) => (
                  <TopStudentRow key={s.id} student={s} rank={i + 1} isAr={isAr} />
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 bg-gradient-to-br from-primary/5 to-amber-50/40">
            <div className="flex items-start gap-3 mb-2">
              <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground mb-1">
                  {isAr ? "هل تعلم؟" : "Did you know?"}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isAr
                    ? "يمكنك إطلاق مسابقة مباشرة ومشاركة كود PIN في WhatsApp بضغطة واحدة لينضم طلابك فوراً."
                    : "You can launch a live competition and share the PIN via WhatsApp in one click."}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ── 5. Class cards ── */}
      {classes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.25 }}
        >
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                {isAr ? "صفوفي" : "My classes"}
              </h3>
              <Link href="/teacher/students">
                <button className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5">
                  {isAr ? "إدارة الصفوف" : "Manage classes"}
                  {isAr ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {classes.slice(0, 8).map((c) => (
                <ClassCard key={c.name} cls={c} isAr={isAr} setLocation={setLocation} />
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── Share modal ── */}
      {shareAssignment && (
        <ShareCompetitionModal
          assignment={shareAssignment}
          isAr={isAr}
          onClose={() => setShareAssignment(null)}
          onLaunchHostView={(pin) => {
            setShareAssignment(null);
            setLocation(`/teacher/game/${pin}`);
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Quick Launch Hero — search, pick assignment, go live
// ─────────────────────────────────────────────────────────
function QuickLaunchHero({
  assignments,
  isAr,
  startGame,
  creatingGameForId,
  setLocation,
}: {
  assignments: Assignment[];
  isAr: boolean;
  startGame: (id: number, e?: React.MouseEvent) => void;
  creatingGameForId: number | null;
  setLocation: (path: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assignments.slice(0, 8);
    return assignments
      .filter((a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subject || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [assignments, query]);

  const selected = useMemo(
    () => assignments.find((a) => a.id === selectedId) || null,
    [assignments, selectedId]
  );

  // Click outside to close results
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (assignments.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
      >
        <Card className="p-6 sm:p-8 border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-amber-50/30 to-emerald-50/40 dark:from-primary/10 dark:via-amber-900/10 dark:to-emerald-900/10">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-start">
            <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
              <Gamepad2 className="w-7 h-7 text-white" />
            </span>
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-extrabold text-foreground mb-1">
                {isAr ? "أنشئ أول مسابقة لتبدأ التشويق!" : "Create your first competition!"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAr
                  ? "أنشئ واجباً بأسئلة، ثم أطلق مسابقة مباشرة وشارك كود PIN مع طلابك."
                  : "Create an assignment with questions, then launch a live game and share the PIN."}
              </p>
            </div>
            <button
              onClick={() => setLocation("/teacher/new")}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/25 shrink-0"
            >
              <Plus className="w-4 h-4" />
              {isAr ? "ابدأ الآن" : "Get started"}
            </button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
    >
      <Card className="relative overflow-hidden p-5 sm:p-6 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 dark:from-emerald-900/20 dark:via-card dark:to-amber-900/10 border border-emerald-200/60 dark:border-emerald-800/40">
        {/* Decorative pulse blobs */}
        <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-emerald-300/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -start-12 w-44 h-44 rounded-full bg-amber-300/15 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-foreground">
              {isAr ? "أطلق مسابقة مباشرة الآن" : "Launch a live competition now"}
            </h3>
            <span className="ms-auto inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold">
              <Zap className="w-3 h-3" />
              {isAr ? "بضغطة واحدة" : "One-click"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {isAr
              ? `ابحث في واجباتك أو اختر من القائمة (${assignments.length} متاح) — ثم اضغط زر اللعبة المباشرة.`
              : `Search your assignments or pick from the list (${assignments.length} available) — then hit Live Game.`}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-stretch">
            {/* Search + selector */}
            <div ref={containerRef} className="relative">
              <div className={cn(
                "flex items-center gap-2 bg-white dark:bg-card rounded-xl border-2 px-3 py-2.5 transition-colors",
                selected ? "border-primary/50" : "border-emerald-200 dark:border-emerald-800/60 focus-within:border-emerald-400"
              )}>
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                {selected ? (
                  <button
                    type="button"
                    onClick={() => { setSelectedId(null); setQuery(""); setShowResults(true); }}
                    className="flex-1 min-w-0 flex items-center gap-2 text-start"
                  >
                    <span className="text-sm sm:text-base font-bold text-foreground truncate">{selected.title}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">· {selected.questionCount} {isAr ? "سؤال" : "Q"}</span>
                    {selected.subject && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded shrink-0 hidden sm:inline-flex", getSubjectTone(selected.subject).bg, getSubjectTone(selected.subject).text)}>
                        {selected.subject}
                      </span>
                    )}
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground ms-auto shrink-0" />
                  </button>
                ) : (
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
                    onFocus={() => setShowResults(true)}
                    placeholder={isAr ? "ابحث عن واجب أو موضوع..." : "Search for an assignment or topic..."}
                    className="flex-1 min-w-0 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                )}
              </div>

              {/* Results dropdown */}
              {showResults && !selected && (
                <div className="absolute z-30 top-full mt-1.5 inset-x-0 max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                      {isAr ? "لا توجد نتائج" : "No matches"}
                    </div>
                  ) : (
                    filtered.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedId(a.id); setShowResults(false); setQuery(""); }}
                        className="group w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-start border-b border-border/50 last:border-b-0"
                      >
                        <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", getSubjectTone(a.subject).bg)}>
                          <BookText className={cn("w-4 h-4", getSubjectTone(a.subject).text)} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {a.questionCount} {isAr ? "سؤال" : "Q"} · {a.submissionCount} {isAr ? "تسليم" : "subs"}
                          </p>
                        </div>
                        <Play className="w-3.5 h-3.5 text-primary fill-primary opacity-0 group-hover:opacity-100" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Action button — transforms into Live Game when selected */}
            <button
              onClick={() => selected && startGame(selected.id)}
              disabled={!selected || creatingGameForId === selected?.id}
              className={cn(
                "relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black text-sm shadow-lg transition-all whitespace-nowrap",
                selected
                  ? "bg-gradient-to-br from-primary via-primary to-emerald-700 text-white hover:scale-[1.02] active:scale-[0.98] shadow-primary/30"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {selected ? (
                creatingGameForId === selected.id ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ الإطلاق..." : "Starting..."}</>
                ) : (
                  <><Gamepad2 className="w-4 h-4" />{isAr ? "ابدأ لعبة مباشرة" : "Start Live Game"}<Rocket className="w-4 h-4" /></>
                )
              ) : (
                <><Search className="w-4 h-4" />{isAr ? "اختر واجبًا أولًا" : "Pick assignment first"}</>
              )}
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Floating animated icon decoration (banner ambience)
// ─────────────────────────────────────────────────────────
function FloatingIcon({ className, delay = 0, children }: { className?: string; delay?: number; children: React.ReactNode }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: [0.95, 1.1, 0.95], y: [0, -6, 0] }}
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 3, delay, repeat: Infinity, ease: "easeInOut" },
        y: { duration: 3.5, delay, repeat: Infinity, ease: "easeInOut" },
      }}
      className={cn("absolute pointer-events-none drop-shadow-md", className)}
    >
      {children}
    </motion.span>
  );
}

// ─────────────────────────────────────────────────────────
// Compact stat chip inside the welcome banner
// ─────────────────────────────────────────────────────────
function BannerStat({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl backdrop-blur-sm ring-1",
      accent ? "bg-amber-300/20 ring-amber-300/40 text-amber-100" : "bg-white/10 ring-white/20 text-white/95"
    )}>
      <span className={cn("opacity-90", accent ? "text-amber-200" : "text-white/80")}>{icon}</span>
      <span className="text-sm font-black tabular-nums">{value}</span>
      <span className="text-[11px] font-medium opacity-80">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Quick action tile — bright, energetic, themed by tone
// ─────────────────────────────────────────────────────────
function QuickTile({
  icon,
  label,
  desc,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  tone: "primary" | "amber" | "emerald" | "rose" | "sky";
  onClick: () => void;
}) {
  const tones: Record<typeof tone, { iconBg: string; iconText: string; ring: string; bg: string }> = {
    primary: { iconBg: "bg-primary/15", iconText: "text-primary", ring: "hover:ring-primary/40", bg: "from-primary/5 to-transparent" },
    amber:   { iconBg: "bg-amber-100 dark:bg-amber-900/30", iconText: "text-amber-700 dark:text-amber-300", ring: "hover:ring-amber-400/50", bg: "from-amber-50 to-transparent dark:from-amber-900/10" },
    emerald: { iconBg: "bg-emerald-100 dark:bg-emerald-900/30", iconText: "text-emerald-700 dark:text-emerald-300", ring: "hover:ring-emerald-400/50", bg: "from-emerald-50 to-transparent dark:from-emerald-900/10" },
    rose:    { iconBg: "bg-rose-100 dark:bg-rose-900/30", iconText: "text-rose-700 dark:text-rose-300", ring: "hover:ring-rose-400/50", bg: "from-rose-50 to-transparent dark:from-rose-900/10" },
    sky:     { iconBg: "bg-sky-100 dark:bg-sky-900/30", iconText: "text-sky-700 dark:text-sky-300", ring: "hover:ring-sky-400/50", bg: "from-sky-50 to-transparent dark:from-sky-900/10" },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden p-4 rounded-2xl bg-card border border-border ring-1 ring-transparent transition-all text-start hover:-translate-y-0.5 hover:shadow-lg",
        t.ring,
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none", t.bg)} />
      <div className="relative">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 shadow-sm", t.iconBg, t.iconText)}>
          {icon}
        </div>
        <p className="text-sm font-extrabold text-foreground leading-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Action row, recent row, top student, class card
// ─────────────────────────────────────────────────────────
function ActionRow({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "primary" | "gold" | "muted";
  onClick: () => void;
}) {
  const toneClass =
    tone === "primary" ? "text-primary bg-primary/10"
    : tone === "gold" ? "text-amber-700 bg-amber-100"
    : "text-stone-700 bg-stone-100";
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-muted/50 transition-colors text-start group"
    >
      <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", toneClass)}>
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors rtl:hidden" />
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors hidden rtl:block" />
    </button>
  );
}

function RecentAssignmentRow({
  assignment,
  isAr,
  onPlay,
  onShare,
  onOpen,
  isStarting,
}: {
  assignment: Assignment;
  isAr: boolean;
  onPlay: () => void;
  onShare: () => void;
  onOpen: () => void;
  isStarting: boolean;
}) {
  const tone = getSubjectTone(assignment.subject);
  const isExpired = assignment.deadline && new Date(assignment.deadline) < new Date();
  const status: { label: string; color: string } = isExpired
    ? { label: isAr ? "منتهي" : "Ended", color: "bg-stone-100 text-stone-600" }
    : assignment.questionCount === 0
      ? { label: isAr ? "مسودة" : "Draft", color: "bg-amber-50 text-amber-700" }
      : { label: isAr ? "نشط" : "Active", color: "bg-emerald-50 text-emerald-700" };

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-border hover:bg-muted/30 transition-all">
      <button
        onClick={onOpen}
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ring-1",
          tone.bg,
          tone.ring
        )}
        title={assignment.title}
      >
        <BookText className={cn("w-5 h-5", tone.text)} />
      </button>
      <button onClick={onOpen} className="flex-1 min-w-0 text-start">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="text-sm font-semibold text-foreground truncate">{assignment.title}</h4>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0", status.color)}>
            {status.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{assignment.questionCount} {isAr ? "سؤال" : "Qs"}</span>
          <span>•</span>
          <span>{assignment.submissionCount} {isAr ? "تسليم" : "subs"}</span>
          {assignment.createdAt && (
            <>
              <span>•</span>
              <span>{timeAgo(assignment.createdAt, isAr)}</span>
            </>
          )}
        </p>
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onShare}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          title={isAr ? "مشاركة" : "Share"}
          aria-label={isAr ? "مشاركة" : "Share"}
        >
          <Share2 className="w-4 h-4" />
        </button>
        {assignment.questionCount > 0 && (
          <button
            onClick={onPlay}
            disabled={isStarting}
            className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors flex items-center gap-1 disabled:opacity-60"
          >
            {isStarting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3 fill-white" />
            )}
            {isAr ? "لعبة" : "Play"}
          </button>
        )}
      </div>
    </div>
  );
}

function TopStudentRow({
  student,
  rank,
  isAr,
}: {
  student: TopStudent;
  rank: number;
  isAr: boolean;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  const initial = (student.name || "?").charAt(0);
  return (
    <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors">
      <span className="text-lg w-6 text-center shrink-0">{medals[rank - 1] || `#${rank}`}</span>
      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary text-sm font-bold shrink-0">
        {initial}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{student.name}</p>
        {student.className && (
          <p className="text-[10px] text-muted-foreground truncate">{student.className}</p>
        )}
      </div>
      <span className="text-xs font-bold text-primary tabular-nums shrink-0">
        {student.score}
        <span className="text-[9px] text-muted-foreground ms-0.5">{isAr ? "نقطة" : "pts"}</span>
      </span>
    </div>
  );
}

function ClassCard({
  cls,
  isAr,
  setLocation,
}: {
  cls: ClassInfo;
  isAr: boolean;
  setLocation: (path: string) => void;
}) {
  return (
    <button
      onClick={() => setLocation(`/teacher/students?class=${encodeURIComponent(cls.name)}`)}
      className="group p-4 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border hover:border-primary/40 hover:shadow-md transition-all text-start"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
          <Users className="w-4 h-4 text-primary" />
        </span>
        <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <p className="text-sm font-bold text-foreground truncate mb-0.5">{cls.name}</p>
      <p className="text-[11px] text-muted-foreground">
        {cls.studentCount} {isAr ? (cls.studentCount === 1 ? "طالب" : "طالبًا") : "students"}
      </p>
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Share modal — defaults to LIVE PIN, also offers self-paced link
// ─────────────────────────────────────────────────────────
type ShareMode = "live" | "selfpaced";

function ShareCompetitionModal({
  assignment,
  isAr,
  onClose,
  onLaunchHostView,
}: {
  assignment: Assignment;
  isAr: boolean;
  onClose: () => void;
  onLaunchHostView: (pin: string) => void;
}) {
  const [mode, setMode] = useState<ShareMode>("live");
  const [pin, setPin] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"link" | "pin" | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Create live game session on mount (one-click share)
  const createSession = useCallback(() => {
    setCreating(true);
    setError(null);
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      {
        assignmentId: assignment.id,
        gameMode: "solo",
      },
      (res: { pin?: string; error?: string }) => {
        setCreating(false);
        if (res.error) {
          setError(res.error || (isAr ? "تعذّر إنشاء الجلسة" : "Failed to create session"));
          return;
        }
        if (res.pin) setPin(res.pin);
      }
    );
  }, [assignment.id, isAr]);

  useEffect(() => {
    if (mode === "live" && !pin && !creating && !error) {
      createSession();
    }
  }, [mode, pin, creating, error, createSession]);

  // Accessibility: focus management + ESC close + focus trap
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const liveLink = pin ? `${origin}/game/join/${pin}` : "";
  const selfPacedLink = `${origin}/assignment/${assignment.id}`;
  const activeLink = mode === "live" ? liveLink : selfPacedLink;

  const message = useMemo(() => {
    if (mode === "live" && pin) {
      return isAr
        ? `🎓 انضم لمسابقة "${assignment.title}" على منصة حصاد!\nالكود: ${pin}\n${liveLink}`
        : `🎓 Join "${assignment.title}" live on Hasad!\nPIN: ${pin}\n${liveLink}`;
    }
    return isAr
      ? `🎓 شاركنا في "${assignment.title}" على منصة حصاد:\n${selfPacedLink}`
      : `🎓 Join "${assignment.title}" on Hasad:\n${selfPacedLink}`;
  }, [mode, pin, assignment.title, isAr, liveLink, selfPacedLink]);

  const copy = async (text: string, field: "link" | "pin") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(isAr ? "تم النسخ ✓" : "Copied ✓");
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      toast.error(isAr ? "تعذّر النسخ" : "Copy failed");
    }
  };

  const qrUrl = activeLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(activeLink)}`
    : "";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-background rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-gradient-to-br from-primary to-emerald-700 text-white">
          <div className="flex items-center justify-between mb-1">
            <h3 id="share-modal-title" className="text-base font-bold">
              {isAr ? "شارك المسابقة" : "Share competition"}
            </h3>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              aria-label={isAr ? "إغلاق" : "Close"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-white/80 truncate">{assignment.title}</p>
        </div>

        {/* Mode toggle */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/40 border border-border" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "live"}
              onClick={() => setMode("live")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                mode === "live"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Radio className="w-3.5 h-3.5" />
              {isAr ? "مباشر (PIN)" : "Live (PIN)"}
            </button>
            <button
              role="tab"
              aria-selected={mode === "selfpaced"}
              onClick={() => setMode("selfpaced")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                mode === "selfpaced"
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              {isAr ? "حسب الوقت" : "Self-paced"}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* LIVE MODE: PIN block */}
          {mode === "live" && (
            <>
              {creating && (
                <div className="bg-muted/30 rounded-xl p-6 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "جارٍ إنشاء جلسة مباشرة..." : "Creating live session..."}
                  </p>
                </div>
              )}
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-center">
                  <p className="text-sm text-destructive font-semibold mb-2">{error}</p>
                  <Button onClick={createSession} className="bg-destructive text-destructive-foreground text-xs">
                    {isAr ? "أعد المحاولة" : "Retry"}
                  </Button>
                </div>
              )}
              {pin && !creating && (
                <>
                  <div className="bg-gradient-to-br from-primary to-emerald-700 rounded-2xl p-5 text-center text-white shadow-md">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70 mb-1">
                      {isAr ? "كود الانضمام" : "Join PIN"}
                    </p>
                    <button
                      onClick={() => copy(pin, "pin")}
                      className="group inline-flex items-center gap-2"
                      aria-label={isAr ? "نسخ الكود" : "Copy PIN"}
                    >
                      <span className="text-5xl sm:text-6xl font-black tabular-nums tracking-widest">
                        {pin}
                      </span>
                      <span className="w-9 h-9 rounded-lg bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
                        {copiedField === "pin" ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </span>
                    </button>
                    <p className="text-[11px] text-white/80 mt-2">
                      {isAr ? "يدخل الطلاب الكود من الصفحة الرئيسية" : "Students enter the PIN from the homepage"}
                    </p>
                  </div>
                  <Button
                    onClick={() => onLaunchHostView(pin)}
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 shadow-md flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    {isAr ? "افتح شاشة المعلم للجلسة" : "Open teacher session view"}
                  </Button>
                </>
              )}
            </>
          )}

          {/* Link block (always visible when there's a link to share) */}
          {(activeLink && (mode === "selfpaced" || pin)) && (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted/40 rounded-xl px-3 py-2.5 border border-border min-w-0">
                <p className="text-[10px] text-muted-foreground mb-0.5 font-semibold">
                  {isAr ? "رابط الانضمام" : "Join link"}
                </p>
                <p className="text-xs text-foreground truncate font-mono" dir="ltr">{activeLink}</p>
              </div>
              <button
                onClick={() => copy(activeLink, "link")}
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0",
                  copiedField === "link" ? "bg-emerald-500 text-white" : "bg-primary text-white hover:bg-primary/90"
                )}
                aria-label={isAr ? "نسخ الرابط" : "Copy link"}
              >
                {copiedField === "link" ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          )}

          {/* Share buttons */}
          {activeLink && (mode === "selfpaced" || pin) && (
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-semibold text-emerald-800">WhatsApp</span>
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(activeLink)}&text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-emerald-50/60 hover:bg-emerald-100/70 border border-emerald-100 transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-semibold text-primary">Telegram</span>
              </a>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: assignment.title, text: message, url: activeLink }).catch(() => {});
                  } else {
                    copy(activeLink, "link");
                  }
                }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-100 transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-semibold text-amber-800">{isAr ? "مزيد" : "More"}</span>
              </button>
            </div>
          )}

          {/* QR collapsible */}
          {qrUrl && (mode === "selfpaced" || pin) && (
            <details className="group rounded-xl border border-border overflow-hidden">
              <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors text-xs font-semibold text-foreground">
                <span>{isAr ? "إظهار رمز QR للطلاب" : "Show QR code for students"}</span>
                <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="p-4 flex justify-center bg-muted/20 border-t border-border">
                <img src={qrUrl} alt={isAr ? "رمز الاستجابة السريعة" : "QR code"} className="rounded-lg bg-white p-2" width={220} height={220} />
              </div>
            </details>
          )}
        </div>
      </motion.div>
    </div>
  );
}
