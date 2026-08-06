import { useState, useMemo, useEffect, useRef } from "react";
import { Lightbulb } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Play,
  Copy,
  Check,
  Sparkles,
  Users,
  BookText,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Crown,
  Zap,
  Loader2,
  Activity,
  Calendar,
  Pencil,
  CheckCircle2,
  GraduationCap,
  Send,
  X,
  Monitor,
  Video,
  BookOpen,
  Brain,
  FileText,
  Headphones,
  Database,
  Library,
  MessageCircle,
  Target,
  Medal,
  AlertTriangle,
  TrendingUp,
  Wand2,
} from "lucide-react";
import { WameethPreviewCard } from "@/components/teacher/WameethPreviewCard";
import { toast } from "@/components/ui/sonner";

type TabId =
  | "overview"
  | "assignments"
  | "shared"
  | "competitive"
  | "tools"
  | "videos"
  | "stats"
  | "students";

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

const BASE = (import.meta as any).env?.VITE_API_URL || "";

/* ─── Design tokens ──────────────────────────────────────────── */
const C = {
  green: "#1E4D35",
  greenDeep: "#0F3D28",
  greenMid: "#265E42",
  greenLight: "#2d7050",
  greenPale: "rgba(30,77,53,0.07)",
  gold: "#C9920A",
  goldBright: "#E8A80E",
  goldSoft: "#F5C842",
  goldPale: "rgba(201,146,10,0.10)",
  bg: "#F2F0EB",
  surface: "#F7F5F1",
  card: "#FFFFFF",
  border: "rgba(20,35,25,0.07)",
  borderMid: "rgba(20,35,25,0.12)",
  text: "#13201A",
  text2: "#3D4A42",
  muted: "#6E7B73",
  subtle: "#A3ADA7",
};

/* Injected once — micro-animation keyframes for the dashboard */
const DASH_KEYFRAMES = `
@keyframes dashShine {
  0% { transform: translateX(-160%) skewX(-18deg); }
  100% { transform: translateX(260%) skewX(-18deg); }
}
@keyframes dashFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes dashPulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.78); }
}
@keyframes dashTwinkle {
  0%, 100% { opacity: 0.9; transform: scale(1); }
  50% { opacity: 0.25; transform: scale(0.7); }
}
@keyframes dashSpinSlow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;

function timeAgo(date: string | undefined, isAr: boolean): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `قبل ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `قبل ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return isAr ? `قبل ${days} ي` : `${days}d ago`;
}

function getSubjectEmoji(
  subject?: string | null,
  type?: string | null,
): string {
  if (type === "listening") return "🎧";
  if (!subject) return "📝";
  const s = subject.toLowerCase();
  if (s.includes("إسلام") || s.includes("قرآن") || s.includes("دين"))
    return "📖";
  if (s.includes("رياض") || s.includes("math") || s.includes("حساب"))
    return "🔢";
  if (s.includes("علوم") || s.includes("science")) return "🌍";
  if (s.includes("english") || s.includes("إنجل")) return "🔤";
  if (s.includes("عرب") || s.includes("arab")) return "✍️";
  return "📝";
}

function getSubjectBg(subject?: string | null): string {
  if (!subject) return "rgba(30,77,53,0.09)";
  const s = subject.toLowerCase();
  if (s.includes("رياض") || s.includes("math")) return "rgba(201,146,10,0.10)";
  if (s.includes("علوم") || s.includes("science"))
    return "rgba(37,99,235,0.09)";
  if (s.includes("english") || s.includes("إنجل"))
    return "rgba(239,68,68,0.09)";
  if (s.includes("إسلام") || s.includes("قرآن")) return "rgba(109,40,217,0.09)";
  return "rgba(30,77,53,0.09)";
}

/* Animated count-up for hero stat numbers */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const startedFor = useRef<number | null>(null);
  useEffect(() => {
    if (startedFor.current === target) return;
    startedFor.current = target;
    if (target <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT — "Hasaad Command Center"
   ════════════════════════════════════════════════════════════ */
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
  const isMobile = useIsMobile();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    try {
      return localStorage.getItem("hasad_onboarding_dismissed") === "1";
    } catch {
      return false;
    }
  });

  const { data: classes = [] } = useQuery<ClassInfo[]>({
    queryKey: ["dashboard-overview", "classes"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/teacher/classes`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data)
        ? data.map((c: any) => ({
            name: c.name,
            studentCount: c.studentCount ?? 0,
          }))
        : [];
    },
  });

  const stats = useMemo(() => {
    const list = assignments || [];
    const totalSubmissions = list.reduce(
      (acc, a) => acc + (a.submissionCount || 0),
      0,
    );
    const now = Date.now();
    const active = list.filter(
      (a) => !a.deadline || new Date(a.deadline).getTime() >= now,
    ).length;
    const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);
    const avgRate =
      list.length > 0 && totalStudents > 0
        ? Math.min(
            100,
            Math.round(
              (totalSubmissions / (list.length * totalStudents)) * 100,
            ),
          )
        : 0;
    return {
      total: list.length,
      submissions: totalSubmissions,
      active,
      classes: classes.length,
      totalStudents,
      avgRate,
    };
  }, [assignments, classes]);

  const recentAssignments = useMemo(
    () =>
      [...(assignments || [])]
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 5),
    [assignments],
  );

  const upcomingAssignments = useMemo(() => {
    const now = Date.now();
    return [...(assignments || [])]
      .filter((a) => a.deadline && new Date(a.deadline).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
      )
      .slice(0, 4);
  }, [assignments]);

  /* Assignments that need the teacher's attention:
     active but with zero submissions, or deadline within 3 days */
  const attentionItems = useMemo(() => {
    const now = Date.now();
    return [...(assignments || [])]
      .filter((a) => {
        const dl = a.deadline ? new Date(a.deadline).getTime() : null;
        const isActive = !dl || dl >= now;
        if (!isActive) return false;
        const daysLeft = dl ? Math.ceil((dl - now) / 86400000) : null;
        return (
          (a.submissionCount === 0 && a.questionCount > 0) ||
          (daysLeft !== null && daysLeft <= 3)
        );
      })
      .sort((a, b) => {
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return da - db;
      })
      .slice(0, 3);
  }, [assignments]);

  const { data: topStudents = [] } = useQuery<TopStudent[]>({
    queryKey: ["dashboard-overview", "top-students"],
    enabled: !!user && !!assignments && assignments.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/teacher/stats`, {
        credentials: "include",
      });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data?.topStudents) ? data.topStudents : [];
    },
  });

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (isAr) return h < 12 ? "صباح الخير" : "مساء الخير";
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, [isAr]);

  const todayLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString(isAr ? "ar" : "en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    } catch {
      return "";
    }
  }, [isAr]);

  const teacherName =
    user?.fullName || user?.username || (isAr ? "أستاذ" : "Teacher");
  const firstName = teacherName.split(" ")[0];

  async function copyLink(a: Assignment) {
    const url = `${window.location.origin}/student/assignment/${a.id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(a.id);
    toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
    setTimeout(() => setCopiedId(null), 2000);
  }

  /* ── Onboarding steps (same logic as before) ── */
  const onboardingSteps = [
    {
      done: classes.length > 0,
      locked: false,
      title: isAr ? "أنشئ فصلك الأول" : "Create your first class",
      desc: isAr
        ? "نظِّم طلابك في فصول لمتابعة أسهل"
        : "Organize your students into classes",
      cta: isAr ? "أنشئ فصلاً" : "Create class",
      onClick: () => setActiveTab("students"),
    },
    {
      done: stats.totalStudents > 0,
      locked: classes.length === 0,
      title: isAr ? "أضِف الطلاب" : "Add students",
      desc: isAr
        ? "ادعُ طلابك بمشاركة رابط الفصل"
        : "Invite students by sharing the class link",
      cta: isAr ? "أضِف طلاباً" : "Add students",
      onClick: () => setActiveTab("students"),
    },
    {
      done: (assignments?.length ?? 0) > 0,
      locked: false,
      title: isAr ? "أنشئ أوّل واجب" : "Create your first assignment",
      desc: isAr
        ? "اختر قالباً جاهزاً أو أنشئ من الصفر"
        : "Pick a template or build from scratch",
      cta: isAr ? "أنشئ واجباً" : "Create",
      onClick: () => setLocation("/teacher/new"),
    },
  ];
  const onboardingCompleted = onboardingSteps.filter((s) => s.done).length;
  const showOnboarding =
    onboardingCompleted < onboardingSteps.length &&
    !onboardingDismissed &&
    !isLoading;
  const dismissOnboarding = () => {
    try {
      localStorage.setItem("hasad_onboarding_dismissed", "1");
    } catch {}
    setOnboardingDismissed(true);
  };

  /* ── Layout ────────────────────────────────────────────────── */
  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1100px 480px at ${isAr ? "88%" : "12%"} -8%, rgba(30,77,53,0.055), transparent 60%), radial-gradient(900px 420px at ${isAr ? "8%" : "92%"} 4%, rgba(232,168,14,0.05), transparent 55%), ${C.bg}`,
        fontFamily: "inherit",
        direction: isAr ? "rtl" : "ltr",
        flex: 1,
        minWidth: 0,
        overflowX: "hidden",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: DASH_KEYFRAMES }} />

      <div
        style={{
          padding: isMobile ? "14px 14px 20px" : "26px 30px 40px",
          maxWidth: 1240,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: isMobile ? 14 : 20,
        }}
      >
        {/* ══════════ HERO — greeting + live pulse + primary actions ══════════ */}
        <HeroPanel
          isAr={isAr}
          isMobile={isMobile}
          greeting={greeting}
          todayLabel={todayLabel}
          firstName={firstName}
          stats={stats}
          onCreate={() => setLocation("/teacher/new")}
          onLiveQuiz={() => setActiveTab("competitive")}
        />

        {/* ══════════ ONBOARDING — full-width, right below hero ══════════ */}
        <AnimatePresence>
          {showOnboarding && (
            <OnboardingCard
              key="onboarding"
              isAr={isAr}
              isMobile={isMobile}
              steps={onboardingSteps}
              completed={onboardingCompleted}
              firstName={firstName}
              onDismiss={dismissOnboarding}
            />
          )}
        </AnimatePresence>

        {/* ══════════ QUICK CREATE STUDIO — every creation tool, one tap away ══════════ */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <SectionHead
            icon={<Wand2 style={{ width: 15, height: 15, color: C.green }} />}
            title={isAr ? "استوديو الإنشاء" : "Creation studio"}
            isAr={isAr}
          />
          <QuickCreateStudio
            isAr={isAr}
            isMobile={isMobile}
            setLocation={setLocation}
          />
        </motion.section>

        {/* ══════════ MAIN GRID — content + insight rail ══════════ */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) 350px",
            gap: isMobile ? 14 : 20,
            alignItems: "start",
          }}
        >
          {/* ── Main column ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? 14 : 20,
              minWidth: 0,
            }}
          >
            {/* Featured experiences */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 }}
            >
              <SectionHead
                icon={
                  <Sparkles
                    style={{ width: 15, height: 15, color: C.gold }}
                  />
                }
                title={isAr ? "الألعاب والتجارب المباشرة" : "Live games & experiences"}
                linkLabel={isAr ? "عرض الكل" : "View all"}
                onLink={() => setActiveTab("competitive")}
                isAr={isAr}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? 12 : 14,
                }}
              >
                <ArenaBanner
                  isAr={isAr}
                  isMobile={isMobile}
                  onClick={() => setLocation("/game/arena")}
                />
                <GamesArcade
                  isAr={isAr}
                  isMobile={isMobile}
                  onOpen={() => setActiveTab("competitive")}
                />
                <WameethPreviewCard
                  onStart={() => setLocation("/game/wameeth/create")}
                />
              </div>
            </motion.section>

            {/* Recent assignments — open by default */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.14 }}
            >
              <SectionHead
                icon={
                  <BookText
                    style={{ width: 15, height: 15, color: C.green }}
                  />
                }
                title={isAr ? "آخر الواجبات والمسابقات" : "Recent assignments"}
                badge={stats.total > 0 ? `${stats.total}` : undefined}
                linkLabel={isAr ? "عرض الكل" : "View all"}
                onLink={() => setActiveTab("assignments")}
                isAr={isAr}
              />
              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  overflow: "hidden",
                  boxShadow: "0 2px 10px rgba(19,32,26,0.04)",
                }}
              >
                {isLoading ? (
                  [1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        height: 72,
                        borderBottom: i === 3 ? "none" : `1px solid ${C.border}`,
                        background:
                          "linear-gradient(90deg, rgba(0,0,0,0.02), rgba(0,0,0,0.045), rgba(0,0,0,0.02))",
                        backgroundSize: "200% 100%",
                        animation: "pulse 1.5s infinite",
                      }}
                    />
                  ))
                ) : recentAssignments.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "44px 20px",
                      color: C.muted,
                    }}
                  >
                    <div
                      style={{
                        width: 62,
                        height: 62,
                        borderRadius: 18,
                        margin: "0 auto 14px",
                        background: C.greenPale,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <BookText
                        style={{ width: 28, height: 28, color: C.green, opacity: 0.55 }}
                      />
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: C.text2,
                        margin: "0 0 4px",
                      }}
                    >
                      {isAr ? "لا توجد واجبات بعد" : "No assignments yet"}
                    </p>
                    <p style={{ fontSize: 12, margin: "0 0 16px" }}>
                      {isAr
                        ? "أنشئ أول نشاط وسيظهر هنا مباشرة"
                        : "Create your first activity and it will show up here"}
                    </p>
                    <button
                      onClick={() => setLocation("/teacher/new")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "10px 22px",
                        background: C.green,
                        color: "#fff",
                        border: "none",
                        borderRadius: 11,
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: "0 4px 14px rgba(30,77,53,0.25)",
                      }}
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                      {isAr ? "إنشاء أول واجب" : "Create first"}
                    </button>
                  </div>
                ) : (
                  recentAssignments.map((a, idx) => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      isAr={isAr}
                      isLast={idx === recentAssignments.length - 1}
                      onPlay={() => startGame(a.id)}
                      onCopy={() => copyLink(a)}
                      onOpen={() => setLocation(`/teacher/assignment/${a.id}`)}
                      isStarting={creatingGameForId === a.id}
                      copied={copiedId === a.id}
                    />
                  ))
                )}
              </div>
            </motion.section>
          </div>

          {/* ── Insight rail ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: isMobile ? 14 : 18,
              minWidth: 0,
            }}
          >
            {/* Classroom pulse — smart insights */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.14 }}
            >
              <SectionHead
                icon={
                  <TrendingUp
                    style={{ width: 15, height: 15, color: C.green }}
                  />
                }
                title={isAr ? "نبض الأداء" : "Classroom pulse"}
                linkLabel={isAr ? "التفاصيل" : "Details"}
                onLink={() => setActiveTab("stats")}
                isAr={isAr}
              />
              <PulsePanel
                isAr={isAr}
                stats={stats}
                assignments={assignments || []}
                onDayClick={() => setActiveTab("assignments")}
              />
            </motion.section>

            {/* Needs your attention */}
            {attentionItems.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.16 }}
              >
                <SectionHead
                  icon={
                    <AlertTriangle
                      style={{ width: 15, height: 15, color: "#D97706" }}
                    />
                  }
                  title={isAr ? "يحتاج انتباهك" : "Needs your attention"}
                  badge={`${attentionItems.length}`}
                  isAr={isAr}
                />
                <div
                  style={{
                    background: C.card,
                    border: "1px solid rgba(245,158,11,0.25)",
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 2px 10px rgba(180,120,10,0.06)",
                  }}
                >
                  {attentionItems.map((a, idx) => (
                    <AttentionRow
                      key={a.id}
                      assignment={a}
                      isAr={isAr}
                      isLast={idx === attentionItems.length - 1}
                      copied={copiedId === a.id}
                      onCopy={() => copyLink(a)}
                      onOpen={() => setLocation(`/teacher/assignment/${a.id}`)}
                    />
                  ))}
                </div>
              </motion.section>
            )}

            {/* Upcoming deadlines */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.18 }}
            >
              <SectionHead
                icon={
                  <Calendar
                    style={{ width: 15, height: 15, color: C.green }}
                  />
                }
                title={isAr ? "المواعيد القادمة" : "Upcoming deadlines"}
                badge={
                  upcomingAssignments.length > 0
                    ? `${upcomingAssignments.length}`
                    : undefined
                }
                linkLabel={
                  upcomingAssignments.length > 0
                    ? isAr
                      ? "عرض الكل"
                      : "View all"
                    : undefined
                }
                onLink={
                  upcomingAssignments.length > 0
                    ? () => setActiveTab("assignments")
                    : undefined
                }
                isAr={isAr}
              />
              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 2px 10px rgba(19,32,26,0.04)",
                }}
              >
                {upcomingAssignments.length === 0 ? (
                  <RailEmpty
                    icon={<Calendar style={{ width: 26, height: 26 }} />}
                    text={
                      isAr ? "لا توجد مواعيد قادمة" : "No upcoming deadlines"
                    }
                  />
                ) : (
                  upcomingAssignments.map((a, idx) => (
                    <UpcomingRow
                      key={a.id}
                      assignment={a}
                      isAr={isAr}
                      isLast={idx === upcomingAssignments.length - 1}
                    />
                  ))
                )}
              </div>
            </motion.section>

            {/* Highlights — top students + activity in one tabbed card */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.22 }}
            >
              <HighlightsCard
                isAr={isAr}
                topStudents={topStudents}
                assignments={assignments || []}
                onStudentsLink={() => setActiveTab("stats")}
                onActivityLink={() => setActiveTab("assignments")}
              />
            </motion.section>

            {/* Quick links */}
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.28 }}
            >
              <SectionHead
                icon={
                  <Zap style={{ width: 15, height: 15, color: C.gold }} />
                }
                title={isAr ? "وصول سريع" : "Quick access"}
                isAr={isAr}
              />
              <QuickLinks isAr={isAr} setLocation={setLocation} />
            </motion.section>

            {/* Daily tip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              style={{
                position: "relative",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background:
                  "linear-gradient(135deg, rgba(245,200,66,0.14) 0%, rgba(232,168,14,0.08) 100%)",
                border: "1px solid rgba(201,146,10,0.22)",
                borderRadius: 15,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "rgba(232,168,14,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Lightbulb
                  style={{ width: 17, height: 17, color: C.gold }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12.5,
                  color: C.text2,
                  lineHeight: 1.55,
                }}
              >
                <span style={{ fontWeight: 800, color: C.text }}>
                  {isAr ? "اقتراح اليوم: " : "Tip: "}
                </span>
                {isAr
                  ? "جرّب نشاط الاستماع — يطوّر تركيز الطلاب أكثر من الأسئلة العادية."
                  : "Try a listening activity — it boosts student focus more than standard questions."}
              </div>
              <button
                onClick={() => setLocation("/teacher/new/dictation")}
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  color: "#fff",
                  background: C.green,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  padding: "7px 14px",
                  borderRadius: 9,
                  boxShadow: "0 3px 10px rgba(30,77,53,0.2)",
                  flexShrink: 0,
                }}
              >
                {isAr ? "ابدأ الآن" : "Start"}
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   HERO PANEL
   ════════════════════════════════════════════════════════════ */
function HeroPanel({
  isAr,
  isMobile,
  greeting,
  todayLabel,
  firstName,
  stats,
  onCreate,
  onLiveQuiz,
}: {
  isAr: boolean;
  isMobile: boolean;
  greeting: string;
  todayLabel: string;
  firstName: string;
  stats: {
    total: number;
    submissions: number;
    active: number;
    classes: number;
    totalStudents: number;
    avgRate: number;
  };
  onCreate: () => void;
  onLiveQuiz: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: isMobile ? 20 : 26,
        background: `linear-gradient(132deg, ${C.greenDeep} 0%, ${C.green} 52%, #245A3E 100%)`,
        boxShadow:
          "0 24px 60px -18px rgba(15,61,40,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset",
        padding: isMobile ? "22px 18px 20px" : "30px 34px 28px",
      }}
    >
      {/* decorative: gold orb */}
      <div
        style={{
          position: "absolute",
          top: -90,
          [isAr ? "left" : "right"]: -60,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232,168,14,0.25) 0%, rgba(232,168,14,0.07) 45%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* decorative: soft light sweep */}
      <div
        style={{
          position: "absolute",
          bottom: -140,
          [isAr ? "right" : "left"]: -80,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />
      {/* decorative: fine grid pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1.4px)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.15))",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.15))",
        }}
      />
      {/* decorative: gold top hairline */}
      <div
        style={{
          position: "absolute",
          top: 0,
          [isAr ? "right" : "left"]: "6%",
          width: "40%",
          height: 2.5,
          background:
            "linear-gradient(90deg, transparent, rgba(245,200,66,0.85), transparent)",
          pointerEvents: "none",
        }}
      />
      {/* decorative: twinkles */}
      {!isMobile && (
        <>
          <span
            style={{
              position: "absolute",
              top: 28,
              [isAr ? "left" : "right"]: 120,
              fontSize: 13,
              color: "rgba(245,200,66,0.75)",
              animation: "dashTwinkle 3.2s ease-in-out infinite",
              pointerEvents: "none",
            }}
          >
            ✦
          </span>
          <span
            style={{
              position: "absolute",
              top: 74,
              [isAr ? "left" : "right"]: 58,
              fontSize: 9,
              color: "rgba(255,255,255,0.5)",
              animation: "dashTwinkle 2.6s ease-in-out 0.8s infinite",
              pointerEvents: "none",
            }}
          >
            ✦
          </span>
        </>
      )}

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Date kicker */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: C.goldSoft,
              boxShadow: "0 0 10px rgba(245,200,66,0.9)",
              animation: "dashPulseDot 2.4s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: isMobile ? 11 : 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.65)",
              letterSpacing: "0.02em",
            }}
          >
            {todayLabel}
          </span>
        </div>

        {/* Greeting */}
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? 24 : 32,
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}
        >
          {greeting}
          {isAr ? "، " : ", "}
          <span
            style={{
              background: `linear-gradient(90deg, ${C.goldSoft}, ${C.goldBright})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {isAr ? `أ. ${firstName}` : firstName}
          </span>
          {" "}👋
        </h1>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: isMobile ? 12.5 : 14,
            color: "rgba(255,255,255,0.72)",
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          {isAr
            ? "هذه نبضة صفوفك اليوم — كل شيء جاهز للانطلاق."
            : "Here's your classroom pulse today — everything is ready to go."}
        </p>

        {/* Stat chips */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "repeat(2, minmax(0,1fr))"
              : "repeat(4, minmax(0,1fr))",
            gap: isMobile ? 8 : 12,
            marginTop: isMobile ? 16 : 20,
          }}
        >
          <HeroStat
            isMobile={isMobile}
            icon={<GraduationCap style={{ width: 16, height: 16 }} />}
            label={isAr ? "الطلاب" : "Students"}
            value={stats.totalStudents}
          />
          <HeroStat
            isMobile={isMobile}
            icon={<Users style={{ width: 16, height: 16 }} />}
            label={isAr ? "الفصول" : "Classes"}
            value={stats.classes}
          />
          <HeroStat
            isMobile={isMobile}
            icon={<BookText style={{ width: 16, height: 16 }} />}
            label={isAr ? "واجبات نشطة" : "Active"}
            value={stats.active}
          />
          <HeroStat
            isMobile={isMobile}
            icon={<CheckCircle2 style={{ width: 16, height: 16 }} />}
            label={isAr ? "التسليمات" : "Submissions"}
            value={stats.submissions}
          />
        </div>

        {/* Primary actions */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 10 : 14,
            marginTop: isMobile ? 16 : 22,
          }}
        >
          {/* Create activity — gold primary */}
          <button
            onClick={onCreate}
            style={{
              position: "relative",
              overflow: "hidden",
              flex: isMobile ? undefined : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              padding: isMobile ? "14px 20px" : "15px 26px",
              background: `linear-gradient(135deg, ${C.goldSoft} 0%, ${C.goldBright} 55%, ${C.gold} 100%)`,
              color: C.greenDeep,
              border: "none",
              borderRadius: 14,
              fontSize: isMobile ? 14.5 : 15.5,
              fontWeight: 900,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow:
                "0 10px 26px rgba(232,168,14,0.4), inset 0 1px 0 rgba(255,255,255,0.4)",
              transition: "transform 180ms ease, box-shadow 180ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow =
                "0 16px 36px rgba(232,168,14,0.5), inset 0 1px 0 rgba(255,255,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 10px 26px rgba(232,168,14,0.4), inset 0 1px 0 rgba(255,255,255,0.4)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(-1px) scale(0.985)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(-3px) scale(1)";
            }}
          >
            {/* shine sweep */}
            <span
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: 46,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
                animation: "dashShine 3.4s ease-in-out infinite",
                pointerEvents: "none",
              }}
            />
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "rgba(15,61,40,0.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Plus style={{ width: 16, height: 16, strokeWidth: 3 }} />
            </span>
            <span>
              {isAr ? "أنشئ نشاطاً جديداً" : "Create new activity"}
            </span>
          </button>

          {/* Live quiz — glass secondary */}
          <button
            onClick={onLiveQuiz}
            style={{
              flex: isMobile ? undefined : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              padding: isMobile ? "14px 20px" : "15px 26px",
              background: "rgba(255,255,255,0.09)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 14,
              fontSize: isMobile ? 14.5 : 15.5,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              transition:
                "transform 180ms ease, background 180ms ease, border-color 180ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.background = "rgba(255,255,255,0.16)";
              e.currentTarget.style.borderColor = "rgba(245,200,66,0.55)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.background = "rgba(255,255,255,0.09)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(-1px) scale(0.985)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(-3px) scale(1)";
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: C.goldBright,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 0 14px rgba(232,168,14,0.55)",
              }}
            >
              <Play
                style={{
                  width: 12,
                  height: 12,
                  color: C.greenDeep,
                  fill: C.greenDeep,
                  marginInlineStart: 1,
                }}
              />
            </span>
            <span>{isAr ? "ابدأ مسابقة مباشرة" : "Start live quiz"}</span>
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function HeroStat({
  icon,
  label,
  value,
  isMobile,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  isMobile: boolean;
}) {
  const animated = useCountUp(value);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: isMobile ? "10px 12px" : "12px 14px",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 13,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: isMobile ? 30 : 34,
          height: isMobile ? 30 : 34,
          borderRadius: 10,
          background: "rgba(245,200,66,0.16)",
          color: C.goldSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: isMobile ? 17 : 20,
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {animated}
        </div>
        <div
          style={{
            fontSize: isMobile ? 9.5 : 10.5,
            fontWeight: 700,
            color: "rgba(255,255,255,0.55)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ONBOARDING CARD
   ════════════════════════════════════════════════════════════ */
function OnboardingCard({
  isAr,
  isMobile,
  steps,
  completed,
  firstName,
  onDismiss,
}: {
  isAr: boolean;
  isMobile: boolean;
  steps: {
    done: boolean;
    locked: boolean;
    title: string;
    desc: string;
    cta: string;
    onClick: () => void;
  }[];
  completed: number;
  firstName: string;
  onDismiss: () => void;
}) {
  const total = steps.length;
  const remaining = total - completed;
  const pct = (completed / total) * 100;
  // ring geometry
  const R = 24;
  const CIRC = 2 * Math.PI * R;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: -8 }}
      transition={{ duration: 0.28 }}
      style={{
        position: "relative",
        overflow: "hidden",
        background: C.card,
        border: "1px solid rgba(201,146,10,0.28)",
        borderRadius: 20,
        padding: isMobile ? 16 : 22,
        boxShadow: "0 10px 30px -12px rgba(30,77,53,0.14)",
      }}
    >
      {/* gold corner glow */}
      <div
        style={{
          position: "absolute",
          top: -50,
          [isAr ? "left" : "right"]: -50,
          width: 190,
          height: 190,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232,168,14,0.16) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 12 : 16,
          marginBottom: 14,
          position: "relative",
        }}
      >
        {/* progress ring */}
        <div
          style={{
            position: "relative",
            width: 58,
            height: 58,
            flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 58 58" style={{ width: 58, height: 58 }}>
            <circle
              cx="29"
              cy="29"
              r={R}
              fill="none"
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="5"
            />
            <motion.circle
              cx="29"
              cy="29"
              r={R}
              fill="none"
              stroke="url(#obGold)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: CIRC * (1 - pct / 100) }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              transform="rotate(-90 29 29)"
            />
            <defs>
              <linearGradient id="obGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E8A80E" />
                <stop offset="100%" stopColor="#1E4D35" />
              </linearGradient>
            </defs>
          </svg>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 900,
              color: C.green,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {completed}/{total}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 3,
            }}
          >
            <Sparkles style={{ width: 13, height: 13, color: C.goldBright }} />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: C.gold,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {isAr ? "ابدأ رحلتك" : "Get started"}
            </span>
          </div>
          <h2
            style={{
              fontSize: isMobile ? 16.5 : 19,
              fontWeight: 900,
              color: C.text,
              margin: 0,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
            }}
          >
            {isAr
              ? `أهلاً ${firstName} في حصاد!`
              : `Welcome to Hasaad, ${firstName}!`}
          </h2>
          <p style={{ fontSize: 12, color: C.muted, margin: "3px 0 0" }}>
            {isAr
              ? `أكمل ${remaining === 1 ? "خطوة واحدة" : `${remaining} خطوات`} لتفعيل لوحتك`
              : `${remaining} step${remaining === 1 ? "" : "s"} left to activate your dashboard`}
          </p>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: "rgba(0,0,0,0.04)",
            border: "none",
            width: 30,
            height: 30,
            borderRadius: 9,
            cursor: "pointer",
            color: C.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          title={isAr ? "تخطّي" : "Skip"}
        >
          <X style={{ width: 15, height: 15 }} />
        </button>
      </div>

      {/* steps — horizontal on desktop, vertical on mobile */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0,1fr))",
          gap: 10,
          position: "relative",
        }}
      >
        {steps.map((step, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: isMobile ? "center" : "flex-start",
              flexDirection: isMobile ? "row" : "column",
              gap: isMobile ? 10 : 10,
              padding: isMobile ? "11px 12px" : "14px 14px 12px",
              background: step.done
                ? "rgba(30,77,53,0.05)"
                : step.locked
                  ? "rgba(0,0,0,0.02)"
                  : C.surface,
              border: `1px solid ${
                step.done
                  ? "rgba(30,77,53,0.16)"
                  : step.locked
                    ? "rgba(0,0,0,0.06)"
                    : "rgba(201,146,10,0.25)"
              }`,
              borderRadius: 13,
              opacity: step.done ? 0.72 : step.locked ? 0.5 : 1,
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                minWidth: 0,
                flex: isMobile ? 1 : undefined,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: step.done
                    ? C.green
                    : step.locked
                      ? "rgba(0,0,0,0.07)"
                      : "rgba(232,168,14,0.18)",
                  color: step.done ? "#fff" : step.locked ? C.muted : C.gold,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 12.5,
                  flexShrink: 0,
                }}
              >
                {step.done ? (
                  <Check style={{ width: 15, height: 15 }} />
                ) : (
                  idx + 1
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: step.locked ? C.muted : C.text,
                    textDecoration: step.done ? "line-through" : "none",
                    lineHeight: 1.3,
                  }}
                >
                  {step.title}
                </div>
                {!step.done && !isMobile && (
                  <div
                    style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}
                  >
                    {step.locked
                      ? isAr
                        ? "أكمل الخطوة السابقة أولاً"
                        : "Complete the previous step first"
                      : step.desc}
                  </div>
                )}
              </div>
            </div>
            {!step.done && !step.locked && (
              <button
                onClick={step.onClick}
                style={{
                  padding: "7px 14px",
                  background: C.green,
                  color: "#fff",
                  border: "none",
                  borderRadius: 9,
                  fontSize: 11.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(30,77,53,0.2)",
                  transition: "transform 0.1s ease",
                  marginTop: isMobile ? 0 : "auto",
                  alignSelf: isMobile ? "center" : "stretch",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.96)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                {step.cta}
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════
   ARENA BANNER — تحدي حصاد
   ════════════════════════════════════════════════════════════ */
function ArenaBanner({
  isAr,
  isMobile,
  onClick,
}: {
  isAr: boolean;
  isMobile: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      style={{
        width: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        padding: isMobile ? "16px 16px" : "18px 24px",
        border: "1px solid rgba(245,200,66,0.28)",
        background: `linear-gradient(120deg, ${C.greenDeep} 0%, ${C.green} 58%, #2A6247 100%)`,
        boxShadow: "0 14px 36px -16px rgba(15,61,40,0.45)",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 12 : 22,
        cursor: "pointer",
        textAlign: isAr ? "right" : "left",
        fontFamily: "inherit",
      }}
    >
      {/* gold radial behind trophy */}
      <div
        style={{
          position: "absolute",
          [isAr ? "left" : "right"]: isMobile ? -30 : 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: isMobile ? 160 : 220,
          height: isMobile ? 160 : 220,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232,168,14,0.3) 0%, rgba(232,168,14,0.1) 45%, transparent 70%)",
          filter: "blur(6px)",
          pointerEvents: "none",
        }}
      />
      {/* top gold hairline */}
      <div
        style={{
          position: "absolute",
          top: 0,
          [isAr ? "right" : "left"]: 0,
          width: "46%",
          height: 2.5,
          background:
            "linear-gradient(90deg, transparent, rgba(245,200,66,0.9), transparent)",
          pointerEvents: "none",
        }}
      />
      {/* dotted texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1.4px)",
          backgroundSize: "22px 22px",
          pointerEvents: "none",
        }}
      />

      {/* Text */}
      <div style={{ position: "relative", zIndex: 2, flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 5,
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#fff",
              fontSize: isMobile ? 19 : 22,
              fontWeight: 900,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {isAr ? "تحدي حصاد" : "Hasaad Challenge"}
          </h2>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 9.5,
              fontWeight: 900,
              padding: "3px 9px",
              borderRadius: 999,
              background: "rgba(245,200,66,0.16)",
              color: C.goldSoft,
              border: "1px solid rgba(245,200,66,0.3)",
              letterSpacing: "0.04em",
            }}
          >
            <Zap style={{ width: 10, height: 10, fill: "currentColor" }} />
            {isAr ? "مميز" : "FEATURED"}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            color: "rgba(255,255,255,0.68)",
            fontSize: isMobile ? 11.5 : 12.5,
            lineHeight: 1.6,
            fontWeight: 500,
            maxWidth: 460,
          }}
        >
          {isAr
            ? "مسابقة جماعية مباشرة أمام الجمهور — مثالية للحفلات والملتقيات المدرسية."
            : "A live audience competition made for school events and gatherings."}
        </p>
      </div>

      {/* Trophy + CTA */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 10 : 18,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: isMobile ? "8px 14px" : "9px 18px",
            borderRadius: 11,
            background: `linear-gradient(135deg, ${C.goldSoft}, ${C.goldBright})`,
            color: C.greenDeep,
            fontSize: isMobile ? 11.5 : 12.5,
            fontWeight: 900,
            boxShadow: "0 6px 18px rgba(232,168,14,0.35)",
            whiteSpace: "nowrap",
          }}
        >
          <Play style={{ width: 12, height: 12, fill: "currentColor" }} />
          {isAr ? "ابدأ الآن" : "Start now"}
        </div>
        {!isMobile && (
          <span
            style={{
              fontSize: 52,
              lineHeight: 1,
              filter:
                "drop-shadow(0 10px 12px rgba(0,0,0,0.35)) drop-shadow(0 0 18px rgba(232,168,14,0.3))",
              animation: "dashFloat 4s ease-in-out infinite",
              display: "block",
            }}
          >
            🏆
          </span>
        )}
      </div>
    </motion.button>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION HEAD
   ════════════════════════════════════════════════════════════ */
function SectionHead({
  icon,
  title,
  badge,
  linkLabel,
  onLink,
  isAr,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  linkLabel?: string;
  onLink?: () => void;
  isAr: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
        paddingInline: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14.5,
          fontWeight: 900,
          color: C.text,
          letterSpacing: "-0.01em",
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            background: C.card,
            border: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        {title}
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              background: C.greenPale,
              color: C.green,
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {linkLabel && onLink && (
        <button
          onClick={onLink}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            fontSize: 11.5,
            fontWeight: 800,
            color: C.green,
            cursor: "pointer",
            padding: "5px 10px",
            borderRadius: 8,
            border: "none",
            background: "transparent",
            fontFamily: "inherit",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(30,77,53,0.06)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          {linkLabel}
          {isAr ? (
            <ChevronLeft style={{ width: 12, height: 12 }} />
          ) : (
            <ChevronRight style={{ width: 12, height: 12 }} />
          )}
        </button>
      )}
    </div>
  );
}

/* Empty state for rail cards */
function RailEmpty({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "26px 18px",
        color: C.subtle,
        textAlign: "center",
        gap: 8,
      }}
    >
      <span style={{ opacity: 0.55 }}>{icon}</span>
      <p style={{ fontSize: 12, margin: 0, color: C.muted, lineHeight: 1.5 }}>
        {text}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ASSIGNMENT ROW
   ════════════════════════════════════════════════════════════ */
function AssignmentRow({
  assignment: a,
  isAr,
  isLast,
  onPlay,
  onCopy,
  onOpen,
  isStarting,
  copied,
}: {
  assignment: Assignment;
  isAr: boolean;
  isLast: boolean;
  onPlay: () => void;
  onCopy: () => void;
  onOpen: () => void;
  isStarting: boolean;
  copied: boolean;
}) {
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState(false);
  const isExpired = a.deadline && new Date(a.deadline) < new Date();
  const emoji = getSubjectEmoji(a.subject, a.type);
  const emojiBg = getSubjectBg(a.subject);

  const statusPill = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 800,
        padding: "3px 9px",
        borderRadius: 20,
        background: isExpired
          ? "rgba(239,68,68,0.09)"
          : "rgba(16,185,129,0.1)",
        color: isExpired ? "#B91C1C" : "#047857",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "currentColor",
          ...(isExpired
            ? {}
            : { animation: "dashPulseDot 2s ease-in-out infinite" }),
        }}
      />
      {isExpired ? (isAr ? "منتهي" : "Ended") : isAr ? "نشط" : "Active"}
    </span>
  );

  const deadlineLabel = a.deadline
    ? new Date(a.deadline).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
        month: "short",
        day: "numeric",
      })
    : isAr
      ? "بلا موعد"
      : "No deadline";

  const actions = (
    <div
      style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {a.questionCount > 0 && (
        <button
          onClick={onPlay}
          disabled={isStarting}
          style={{
            height: 32,
            paddingInline: isMobile ? 12 : 13,
            borderRadius: 9,
            border: "1px solid rgba(201,146,10,0.25)",
            background:
              "linear-gradient(135deg, rgba(245,200,66,0.16), rgba(232,168,14,0.1))",
            display: "flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            color: "#8a6407",
            fontSize: 11,
            fontWeight: 800,
            fontFamily: "inherit",
            transition: "transform 0.12s ease, box-shadow 0.12s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(201,146,10,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
          title={isAr ? "ابدأ لعبة" : "Play"}
        >
          {isStarting ? (
            <Loader2
              style={{
                width: 13,
                height: 13,
                animation: "spin 1s linear infinite",
              }}
            />
          ) : (
            <Gamepad2 style={{ width: 13, height: 13 }} />
          )}
          {isAr ? "لعبة" : "Play"}
        </button>
      )}
      <button
        onClick={onCopy}
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          border: `1px solid ${copied ? "rgba(30,77,53,0.3)" : C.borderMid}`,
          background: copied ? "rgba(30,77,53,0.06)" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: copied ? C.green : C.muted,
          transition: "all 0.15s ease",
        }}
        title={isAr ? "نسخ رابط الطالب" : "Copy student link"}
      >
        {copied ? (
          <Check style={{ width: 13, height: 13 }} />
        ) : (
          <Copy style={{ width: 13, height: 13 }} />
        )}
      </button>
      <button
        onClick={onOpen}
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          border: `1px solid ${C.borderMid}`,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: C.muted,
          transition: "all 0.15s ease",
        }}
        title={isAr ? "فتح التفاصيل" : "Open details"}
      >
        <Pencil style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <div
        style={{
          padding: "13px 14px",
          borderBottom: isLast ? "none" : `1px solid ${C.border}`,
          cursor: "pointer",
        }}
        onClick={onOpen}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              flexShrink: 0,
              background: emojiBg,
            }}
          >
            {emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: C.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.title}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 10.5,
                color: C.muted,
                marginTop: 3,
              }}
            >
              <Calendar style={{ width: 10, height: 10 }} />
              {deadlineLabel}
              <span style={{ color: C.subtle }}>·</span>
              <Users style={{ width: 10, height: 10 }} />
              {a.submissionCount} {isAr ? "تسليم" : "subs"}
            </div>
          </div>
          {statusPill}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 9,
            marginInlineStart: 51,
          }}
        >
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "13px 18px",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        cursor: "pointer",
        background: hovered ? "rgba(30,77,53,0.025)" : "transparent",
        transition: "background 0.15s ease",
      }}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
          flexShrink: 0,
          background: emojiBg,
          transition: "transform 0.15s ease",
          transform: hovered ? "scale(1.06)" : "scale(1)",
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 800,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {a.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: C.muted,
            marginTop: 3,
          }}
        >
          <Calendar style={{ width: 10, height: 10 }} />
          {deadlineLabel}
          <span style={{ color: C.subtle }}>·</span>
          <Users style={{ width: 10, height: 10 }} />
          {a.submissionCount} {isAr ? "تسليم" : "subs"}
          {a.questionCount > 0 && (
            <>
              <span style={{ color: C.subtle }}>·</span>
              {a.questionCount} {isAr ? "سؤال" : "questions"}
            </>
          )}
        </div>
      </div>
      {statusPill}
      {actions}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   TOP STUDENTS
   ════════════════════════════════════════════════════════════ */
const MEDALS = [
  { bg: "linear-gradient(135deg,#F5C842,#E8A80E)", ring: "rgba(232,168,14,0.4)", emoji: "🥇" },
  { bg: "linear-gradient(135deg,#D7DBE0,#AEB6BF)", ring: "rgba(156,163,175,0.4)", emoji: "🥈" },
  { bg: "linear-gradient(135deg,#E0A96D,#C9820A)", ring: "rgba(201,130,10,0.35)", emoji: "🥉" },
];
const AVATAR_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];
const BAR_COLORS = ["#E8A80E", "#9CA3AF", "#C9820A", "#3B82F6", "#8B5CF6"];

function TopStudentRow({
  student,
  rank,
  isAr,
  isLast,
}: {
  student: TopStudent;
  rank: number;
  isAr: boolean;
  isLast: boolean;
}) {
  const medal = MEDALS[rank - 1];
  const avatarColor = AVATAR_COLORS[(rank - 1) % AVATAR_COLORS.length];
  const barColor = BAR_COLORS[(rank - 1) % BAR_COLORS.length];
  const initial = (student.name || "?").charAt(0);
  const displayPct =
    student.score <= 100
      ? student.score
      : Math.min(100, Math.round((student.score / 1000) * 100));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 14px",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        minHeight: 54,
      }}
    >
      {/* rank */}
      <div
        style={{
          width: 24,
          textAlign: "center",
          fontSize: medal ? 15 : 12,
          fontWeight: 900,
          color: C.muted,
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {medal ? medal.emoji : rank}
      </div>
      {/* avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: avatarColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 800,
          fontSize: 13,
          flexShrink: 0,
          boxShadow: medal ? `0 0 0 2px ${medal.ring}` : "none",
        }}
      >
        {initial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 800,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {student.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginTop: 4,
          }}
        >
          <div
            style={{
              flex: 1,
              maxWidth: 90,
              height: 4,
              background: "rgba(0,0,0,0.06)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${displayPct}%` }}
              transition={{ duration: 0.7, delay: rank * 0.08, ease: "easeOut" }}
              style={{
                height: "100%",
                background: barColor,
                borderRadius: 2,
              }}
            />
          </div>
          <span style={{ fontSize: 9.5, color: C.subtle, whiteSpace: "nowrap" }}>
            {student.className || (isAr ? "طالب" : "Student")}
          </span>
        </div>
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: C.text,
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {student.score <= 100 ? `${student.score}%` : student.score}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   UPCOMING DEADLINE ROW
   ════════════════════════════════════════════════════════════ */
function UpcomingRow({
  assignment: a,
  isAr,
  isLast,
}: {
  assignment: Assignment;
  isAr: boolean;
  isLast: boolean;
}) {
  const d = new Date(a.deadline!);
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const urgent = daysLeft <= 2;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 14px",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
      }}
    >
      {/* date tile */}
      <div
        style={{
          width: 42,
          flexShrink: 0,
          borderRadius: 11,
          border: `1px solid ${urgent ? "rgba(245,158,11,0.3)" : C.border}`,
          background: urgent ? "rgba(245,158,11,0.07)" : C.surface,
          padding: "6px 0 5px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: urgent ? "#B45309" : C.green,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {d.getDate()}
        </div>
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 800,
            color: C.muted,
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          {d.toLocaleDateString(isAr ? "ar-SA" : "en-US", { month: "short" })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {a.title}
        </div>
        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
          {a.submissionCount} {isAr ? "تسليم حتى الآن" : "submitted so far"}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          padding: "3px 9px",
          borderRadius: 20,
          background: urgent ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.1)",
          color: urgent ? "#B45309" : "#1D4ED8",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {daysLeft} {isAr ? "أيام" : "days"}
      </span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   QUICK CREATE STUDIO — 8 real creation tools
   ════════════════════════════════════════════════════════════ */
function QuickCreateStudio({
  isAr,
  isMobile,
  setLocation,
}: {
  isAr: boolean;
  isMobile: boolean;
  setLocation: (path: string) => void;
}) {
  const tools: {
    icon: React.ReactNode;
    title: string;
    href: string;
  }[] = [
    {
      icon: <Plus style={{ width: 16, height: 16 }} />,
      title: isAr ? "نشاط جديد" : "New activity",
      href: "/teacher/new",
    },
    {
      icon: <Monitor style={{ width: 16, height: 16 }} />,
      title: isAr ? "عرض تفاعلي" : "Presentation",
      href: "/teacher/presentations/new",
    },
    {
      icon: <Video style={{ width: 16, height: 16 }} />,
      title: isAr ? "درس فيديو" : "Video lesson",
      href: "/teacher/video-lesson/new",
    },
    {
      icon: <BookOpen style={{ width: 16, height: 16 }} />,
      title: isAr ? "خطة درس" : "Lesson plan",
      href: "/teacher/lesson-plans/create",
    },
    {
      icon: <Brain style={{ width: 16, height: 16 }} />,
      title: isAr ? "خريطة ذهنية" : "Mind map",
      href: "/teacher/mindmap/create",
    },
    {
      icon: <FileText style={{ width: 16, height: 16 }} />,
      title: isAr ? "ورقة عمل" : "Worksheet",
      href: "/teacher/worksheets/create",
    },
    {
      icon: <Headphones style={{ width: 16, height: 16 }} />,
      title: isAr ? "نشاط استماع" : "Listening",
      href: "/teacher/new/dictation",
    },
    {
      icon: <Pencil style={{ width: 16, height: 16 }} />,
      title: isAr ? "السبورة الذكية" : "Smart board",
      href: "/teacher/smart-board",
    },
  ];

  return (
    <div
      style={
        isMobile
          ? {
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "38%",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 6,
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
            }
          : {
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: 10,
            }
      }
    >
      {tools.map((tool, i) => (
        <motion.button
          key={tool.href}
          onClick={() => setLocation(tool.href)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.03 * i }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 13,
            padding: isMobile ? "9px 11px" : "10px 13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 9,
            textAlign: isAr ? "right" : "left",
            fontFamily: "inherit",
            width: "100%",
            minWidth: 0,
            boxShadow: "0 1px 4px rgba(19,32,26,0.03)",
            scrollSnapAlign: "start",
            transition:
              "border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(201,146,10,0.4)";
            e.currentTarget.style.background = "#FFFDF6";
            e.currentTarget.style.boxShadow =
              "0 6px 16px -6px rgba(201,146,10,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.background = C.card;
            e.currentTarget.style.boxShadow = "0 1px 4px rgba(19,32,26,0.03)";
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: C.greenPale,
              color: C.green,
              flexShrink: 0,
            }}
          >
            {tool.icon}
          </span>
          <span
            style={{
              fontSize: isMobile ? 11.5 : 12.5,
              fontWeight: 800,
              color: C.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {tool.title}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   GAMES ARCADE — live game shortcuts
   ════════════════════════════════════════════════════════════ */
function GamesArcade({
  isAr,
  isMobile,
  onOpen,
}: {
  isAr: boolean;
  isMobile: boolean;
  onOpen: () => void;
}) {
  const games = [
    { emoji: "⚡", name: isAr ? "وميض" : "Wameeth" },
    { emoji: "🚀", name: isAr ? "سباق الصواريخ" : "Rocket Race" },
    { emoji: "💰", name: isAr ? "المليون" : "Million" },
    { emoji: "🎡", name: isAr ? "عجلة الحظ" : "Lucky Wheel" },
    { emoji: "🪢", name: isAr ? "شد الحبل" : "Tug of War" },
    { emoji: "🔥", name: isAr ? "الكرسي الساخن" : "Hot Seat" },
  ];

  return (
    <div
      style={{
        display: "grid",
        ...(isMobile
          ? {
              gridAutoFlow: "column",
              gridAutoColumns: "30%",
              overflowX: "auto",
              paddingBottom: 6,
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
            }
          : { gridTemplateColumns: "repeat(6, minmax(0,1fr))" }),
        gap: isMobile ? 8 : 10,
      }}
    >
      {games.map((g, i) => (
        <motion.button
          key={g.name}
          onClick={onOpen}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: 0.04 * i }}
          whileTap={{ scale: 0.96 }}
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 13,
            padding: "11px 6px 9px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            fontFamily: "inherit",
            minWidth: 0,
            boxShadow: "0 1px 4px rgba(19,32,26,0.03)",
            scrollSnapAlign: "start",
            transition:
              "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(30,77,53,0.35)";
            e.currentTarget.style.boxShadow =
              "0 8px 18px -8px rgba(30,77,53,0.3)";
            e.currentTarget.style.transform = "translateY(-3px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.boxShadow = "0 1px 4px rgba(19,32,26,0.03)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          title={g.name}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(145deg, rgba(30,77,53,0.08), rgba(232,168,14,0.07))",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            {g.emoji}
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              color: C.text2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {g.name}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PULSE PANEL — smart classroom insights
   ════════════════════════════════════════════════════════════ */
function PulsePanel({
  isAr,
  stats,
  assignments,
  onDayClick,
}: {
  isAr: boolean;
  stats: {
    total: number;
    submissions: number;
    active: number;
    classes: number;
    totalStudents: number;
    avgRate: number;
  };
  assignments: Assignment[];
  onDayClick: () => void;
}) {
  const rate = stats.avgRate;
  const R = 26;
  const CIRC = 2 * Math.PI * R;

  /* deadlines per day for the next 7 days */
  const week = useMemo(() => {
    const days: { label: string; date: number; count: number; isToday: boolean }[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const dayEnd = d.getTime() + 86400000;
      const count = assignments.filter((a) => {
        if (!a.deadline) return false;
        const t = new Date(a.deadline).getTime();
        return t >= d.getTime() && t < dayEnd;
      }).length;
      days.push({
        label: d.toLocaleDateString(isAr ? "ar" : "en-US", { weekday: "narrow" }),
        date: d.getDate(),
        count,
        isToday: i === 0,
      });
    }
    return days;
  }, [assignments, isAr]);

  const topAssignment = useMemo(() => {
    const sorted = [...assignments].sort(
      (a, b) => (b.submissionCount || 0) - (a.submissionCount || 0),
    );
    return sorted[0] && sorted[0].submissionCount > 0 ? sorted[0] : null;
  }, [assignments]);

  const rateColor =
    rate >= 70 ? "#059669" : rate >= 40 ? C.goldBright : "#DC2626";

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "16px 16px 14px",
        boxShadow: "0 2px 10px rgba(19,32,26,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* rate donut + summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
          <svg viewBox="0 0 64 64" style={{ width: 64, height: 64 }}>
            <circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="6"
            />
            <motion.circle
              cx="32"
              cy="32"
              r={R}
              fill="none"
              stroke={rateColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              initial={{ strokeDashoffset: CIRC }}
              animate={{ strokeDashoffset: CIRC * (1 - rate / 100) }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 900,
              color: C.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {rate}%
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: C.text }}>
            {isAr ? "معدل التسليم العام" : "Overall submission rate"}
          </div>
          <div
            style={{
              fontSize: 11,
              color: C.muted,
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            {isAr
              ? `${stats.submissions} تسليماً عبر ${stats.total} نشاطاً`
              : `${stats.submissions} submissions across ${stats.total} activities`}
          </div>
        </div>
      </div>

      {/* smart insight line */}
      {topAssignment && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 11px",
            background: "rgba(30,77,53,0.05)",
            border: "1px solid rgba(30,77,53,0.1)",
            borderRadius: 11,
            fontSize: 11.5,
            color: C.text2,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>🔥</span>
          <span style={{ minWidth: 0 }}>
            {isAr ? "الأكثر تفاعلاً: " : "Most engaging: "}
            <strong style={{ fontWeight: 800, color: C.text }}>
              {topAssignment.title}
            </strong>{" "}
            ({topAssignment.submissionCount} {isAr ? "تسليم" : "subs"})
          </span>
        </div>
      )}

      {/* 7-day deadline strip */}
      <div>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: C.muted,
            marginBottom: 7,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {isAr ? "مواعيد الأسبوع" : "This week"}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {week.map((d, i) => (
            <button
              key={i}
              onClick={onDayClick}
              title={
                d.count > 0
                  ? `${d.count} ${isAr ? "موعد تسليم" : "deadline(s)"}`
                  : undefined
              }
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "7px 0 6px",
                borderRadius: 10,
                border: d.isToday
                  ? `1.5px solid ${C.green}`
                  : `1px solid ${d.count > 0 ? "rgba(201,146,10,0.35)" : C.border}`,
                background: d.isToday
                  ? "rgba(30,77,53,0.07)"
                  : d.count > 0
                    ? "rgba(232,168,14,0.07)"
                    : "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  color: d.isToday ? C.green : C.subtle,
                }}
              >
                {d.label}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: d.isToday ? C.green : C.text2,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {d.date}
              </span>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: d.count > 0 ? C.goldBright : "transparent",
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ATTENTION ROW — assignments that need follow-up
   ════════════════════════════════════════════════════════════ */
function AttentionRow({
  assignment: a,
  isAr,
  isLast,
  copied,
  onCopy,
  onOpen,
}: {
  assignment: Assignment;
  isAr: boolean;
  isLast: boolean;
  copied: boolean;
  onCopy: () => void;
  onOpen: () => void;
}) {
  const dl = a.deadline ? new Date(a.deadline).getTime() : null;
  const daysLeft = dl ? Math.ceil((dl - Date.now()) / 86400000) : null;
  const noSubs = a.submissionCount === 0;
  const reason = noSubs
    ? isAr
      ? "لا توجد تسليمات بعد"
      : "No submissions yet"
    : isAr
      ? `يُغلق خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}`
      : `Closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "11px 13px",
        borderBottom: isLast ? "none" : `1px solid ${C.border}`,
        cursor: "pointer",
      }}
      onClick={onOpen}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: noSubs ? "rgba(220,38,38,0.08)" : "rgba(245,158,11,0.1)",
          color: noSubs ? "#DC2626" : "#B45309",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {noSubs ? (
          <Send style={{ width: 14, height: 14, transform: isAr ? "scaleX(-1)" : "none" }} />
        ) : (
          <Calendar style={{ width: 14, height: 14 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: C.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {a.title}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: noSubs ? "#DC2626" : "#B45309",
            fontWeight: 700,
            marginTop: 2,
          }}
        >
          {reason}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: 28,
          paddingInline: 10,
          borderRadius: 8,
          border: `1px solid ${copied ? "rgba(30,77,53,0.3)" : C.borderMid}`,
          background: copied ? "rgba(30,77,53,0.06)" : "transparent",
          cursor: "pointer",
          color: copied ? C.green : C.muted,
          fontSize: 10.5,
          fontWeight: 800,
          fontFamily: "inherit",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
        title={isAr ? "انسخ الرابط وذكّر طلابك" : "Copy link to remind students"}
      >
        {copied ? (
          <Check style={{ width: 11, height: 11 }} />
        ) : (
          <Copy style={{ width: 11, height: 11 }} />
        )}
        {isAr ? "ذكّرهم" : "Remind"}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   HIGHLIGHTS CARD — top students + activity, one tabbed card
   ════════════════════════════════════════════════════════════ */
function HighlightsCard({
  isAr,
  topStudents,
  assignments,
  onStudentsLink,
  onActivityLink,
}: {
  isAr: boolean;
  topStudents: TopStudent[];
  assignments: Assignment[];
  onStudentsLink: () => void;
  onActivityLink: () => void;
}) {
  const [tab, setTab] = useState<"students" | "activity">("students");

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 2px 10px rgba(19,32,26,0.04)",
      }}
    >
      {/* segmented header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 4,
            background: "rgba(0,0,0,0.04)",
            borderRadius: 10,
            padding: 3,
          }}
        >
          {(
            [
              {
                id: "students" as const,
                icon: <Crown style={{ width: 12, height: 12 }} />,
                label: isAr ? "أفضل الطلاب" : "Top students",
              },
              {
                id: "activity" as const,
                icon: <Activity style={{ width: 12, height: 12 }} />,
                label: isAr ? "آخر الأنشطة" : "Activity",
              },
            ]
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: active ? C.card : "transparent",
                  color: active ? C.green : C.muted,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: active ? "0 1px 4px rgba(19,32,26,0.08)" : "none",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={tab === "students" ? onStudentsLink : onActivityLink}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            fontSize: 10.5,
            fontWeight: 800,
            color: C.green,
            cursor: "pointer",
            padding: "4px 6px",
            borderRadius: 7,
            border: "none",
            background: "transparent",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {isAr ? "الكل" : "All"}
          {isAr ? (
            <ChevronLeft style={{ width: 11, height: 11 }} />
          ) : (
            <ChevronRight style={{ width: 11, height: 11 }} />
          )}
        </button>
      </div>

      {/* content */}
      {tab === "students" ? (
        topStudents.length === 0 ? (
          <RailEmpty
            icon={<Crown style={{ width: 26, height: 26 }} />}
            text={
              isAr
                ? "لا يوجد ترتيب بعد — انتظر تسليمات الطلاب"
                : "No ranking yet — waiting for submissions"
            }
          />
        ) : (
          topStudents
            .slice(0, 5)
            .map((s, idx, arr) => (
              <TopStudentRow
                key={`${s.id}-${idx}`}
                student={s}
                rank={idx + 1}
                isAr={isAr}
                isLast={idx === arr.length - 1}
              />
            ))
        )
      ) : (
        <ActivityFeed isAr={isAr} assignments={assignments} bare />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   QUICK LINKS — real destinations, one tap
   ════════════════════════════════════════════════════════════ */
function QuickLinks({
  isAr,
  setLocation,
}: {
  isAr: boolean;
  setLocation: (path: string) => void;
}) {
  const links: {
    icon: React.ReactNode;
    label: string;
    href: string;
  }[] = [
    {
      icon: <Database style={{ width: 14, height: 14 }} />,
      label: isAr ? "بنك الأسئلة" : "Question bank",
      href: "/teacher/question-bank",
    },
    {
      icon: <Library style={{ width: 14, height: 14 }} />,
      label: isAr ? "مكتبة المحتوى" : "Content library",
      href: "/teacher/library",
    },
    {
      icon: <Target style={{ width: 14, height: 14 }} />,
      label: isAr ? "التحديات الفردية" : "Solo challenges",
      href: "/teacher/solo-challenges",
    },
    {
      icon: <MessageCircle style={{ width: 14, height: 14 }} />,
      label: isAr ? "رسائل الأهالي" : "Parent messages",
      href: "/teacher/parent-messages",
    },
    {
      icon: <Medal style={{ width: 14, height: 14 }} />,
      label: isAr ? "إنجازاتي" : "Achievements",
      href: "/teacher/achievements",
    },
    {
      icon: <Users style={{ width: 14, height: 14 }} />,
      label: isAr ? "صفوفي وطلابي" : "My classes",
      href: "/teacher/students",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0,1fr))",
        gap: 8,
      }}
    >
      {links.map((link) => (
        <button
          key={link.href}
          onClick={() => setLocation(link.href)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 11px",
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: isAr ? "right" : "left",
            minWidth: 0,
            boxShadow: "0 1px 4px rgba(19,32,26,0.03)",
            transition:
              "border-color 0.13s ease, background 0.13s ease, box-shadow 0.13s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#FFFDF6";
            e.currentTarget.style.borderColor = "rgba(201,146,10,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = C.card;
            e.currentTarget.style.borderColor = C.border;
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: C.greenPale,
              color: C.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {link.icon}
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 11,
              fontWeight: 800,
              color: C.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {link.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ACTIVITY FEED
   ════════════════════════════════════════════════════════════ */
function ActivityFeed({
  isAr,
  assignments,
  bare,
}: {
  isAr: boolean;
  assignments: Assignment[];
  bare?: boolean;
}) {
  const COLORS = ["#10B981", "#E8A80E", "#3B82F6", "#F59E0B", "#8B5CF6"];

  const items = useMemo(() => {
    return assignments
      .filter((a) => a.submissionCount > 0)
      .sort((a, b) => (b.submissionCount || 0) - (a.submissionCount || 0))
      .slice(0, 5)
      .map((a, i) => ({
        color: COLORS[i % COLORS.length],
        initial: (a.title || "?").charAt(0),
        title: a.title,
        count: a.submissionCount,
        time: timeAgo(a.createdAt, isAr),
      }));
  }, [assignments, isAr]);

  const wrapperStyle: React.CSSProperties = bare
    ? {}
    : {
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 2px 10px rgba(19,32,26,0.04)",
      };

  if (items.length === 0) {
    return (
      <div style={wrapperStyle}>
        <RailEmpty
          icon={<Activity style={{ width: 26, height: 26 }} />}
          text={isAr ? "لا توجد نشاطات بعد" : "No activity yet"}
        />
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "11px 14px",
            borderBottom:
              i === items.length - 1 ? "none" : `1px solid ${C.border}`,
            minHeight: 52,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: `${item.color}1A`,
              border: `1px solid ${item.color}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 900,
              color: item.color,
              flexShrink: 0,
            }}
          >
            {item.initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                color: C.text2,
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <strong style={{ fontWeight: 800, color: C.text }}>
                {item.title}
              </strong>{" "}
              — {item.count} {isAr ? "تسليم" : "submissions"}
            </div>
            <div style={{ fontSize: 10, color: C.subtle, marginTop: 2 }}>
              {item.time}
            </div>
          </div>
          <Send
            style={{
              width: 12,
              height: 12,
              color: item.color,
              opacity: 0.6,
              flexShrink: 0,
              transform: isAr ? "scaleX(-1)" : "none",
            }}
          />
        </div>
      ))}
    </div>
  );
}
