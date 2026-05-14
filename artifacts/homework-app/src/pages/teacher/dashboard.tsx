import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useListAssignments,
  useGetCurrentTeacher,
  useDeleteAssignment,
} from "@workspace/api-client-react";
import type { Assignment } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ClassSelector, getRememberedTargetClass } from "@/components/teacher/class-selector";
import { Link, useLocation } from "wouter";
import {
  Plus,
  BookText,
  Users,
  ArrowLeft,
  ArrowRight,
  Gamepad2,
  Calendar,
  Sparkles,
  Download,
  MessageSquarePlus,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  Copy,
  Trophy,
  User,
  UsersRound,
  Database,
  Crown,
  Globe,
  Trash2,
  Tag,
  FolderOpen,
  Search,
  Loader2,
  Check,
  Video,
  Pencil,
  ChevronDown,
  Share2,
  Zap,
  Coins,
  Mountain,
  Palette,
  Swords,
  GripVertical,
  ImagePlus,
  MoreVertical,
  Library,
  Home,
  Star,
  X,
  Rocket,
  ChevronLeft,
  Lock,
  ExternalLink,
  FileText,
  BookOpen,
  Monitor,
  Brain,
  GraduationCap,
  Flame,
  ChevronRight,
} from "lucide-react";
import SharedContentPage from "@/pages/teacher/shared-content";
import PresentationsIndex from "@/pages/teacher/presentations/index";
import GroupQuickEditModal from "@/components/teacher/GroupQuickEditModal";
import GuestDraftImportBanner from "@/components/teacher/GuestDraftImportBanner";
import DashboardOverview from "@/components/teacher/DashboardOverview";
import { Card, Button } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

/* ── Sidebar XP Card ──────────────────────────────────────────────────────── */

const API_BASE_DASH = import.meta.env.VITE_API_URL || "";

const LEVEL_STARTS = [0, 250, 750, 2000, 5000, 12000];
const LEVEL_EMOJIS = ["🌱", "📖", "✨", "🎯", "🚀", "🏆"];

interface SidebarXpStats {
  totalXp: number;
  level: number;
  levelNameAr: string;
  nextLevelMinXp: number | null;
  currentStreakDays: number;
  badgeCount: number;
}

function xpPct(s: SidebarXpStats): number {
  if (!s.nextLevelMinXp) return 100;
  const start = LEVEL_STARTS[Math.min(s.level - 1, LEVEL_STARTS.length - 1)] ?? 0;
  const span = s.nextLevelMinXp - start;
  if (span <= 0) return 100;
  return Math.min(100, Math.round(((s.totalXp - start) / span) * 100));
}

/** SVG donut arc — degrees helper */
function arcPath(pct: number, r = 18): string {
  const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
  const x = 22 + r * Math.cos(angle);
  const y = 22 + r * Math.sin(angle);
  const large = pct > 50 ? 1 : 0;
  return pct >= 99.9
    ? `M 22 4 A ${r} ${r} 0 1 1 21.99 4`
    : `M 22 4 A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
}

function SidebarXpCard({
  setLocation,
  isAr,
}: {
  setLocation: (path: string) => void;
  isAr: boolean;
}) {
  const { data } = useQuery<SidebarXpStats>({
    queryKey: ["sidebar-xp"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_DASH}/api/me/achievements`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("xp");
      const json = await res.json();
      return json.stats as SidebarXpStats;
    },
    staleTime: 60_000,
    retry: false,
  });

  if (!data) return null;

  const pct = xpPct(data);
  const emoji = LEVEL_EMOJIS[Math.min(data.level - 1, LEVEL_EMOJIS.length - 1)];

  return (
    <div style={{ padding: "12px 12px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "auto" }}>
      <button
        type="button"
        onClick={() => setLocation("/teacher/achievements")}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(201,160,80,0.35)",
          borderRadius: 12,
          padding: "12px 14px",
          cursor: "pointer",
          textAlign: "right" as const,
          fontFamily: "inherit",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* SVG donut ring */}
          <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
            <svg viewBox="0 0 44 44" style={{ width: 44, height: 44, transform: "rotate(0deg)" }}>
              {/* Track */}
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="3.5" />
              {/* Progress arc */}
              <path
                d={arcPath(pct)}
                fill="none"
                stroke="url(#xpGold)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="xpGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E8A80E" />
                  <stop offset="100%" stopColor="#F5C842" />
                </linearGradient>
              </defs>
            </svg>
            {/* Level number inside ring */}
            <span style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#F5C842",
            }}>
              {data.level}
            </span>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>
              {emoji} {data.levelNameAr}
            </p>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#fff", marginBottom: 5 }}>
              {data.totalXp.toLocaleString("ar-SA")}{" "}
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                {isAr ? "نقطة XP" : "XP"}
              </span>
            </p>
            {/* Progress bar */}
            <div style={{ height: 4, background: "rgba(255,255,255,0.10)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: "linear-gradient(90deg,#E8A80E,#F5C842)",
                width: `${pct}%`,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>

          <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
        </div>

        {/* Streak + badges row */}
        {(data.currentStreakDays > 0 || data.badgeCount > 0) && (
          <div style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {data.currentStreakDays > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#fb923c" }}>
                <Flame style={{ width: 11, height: 11 }} />
                {data.currentStreakDays} {isAr ? "يوم متتالي" : "day streak"}
              </span>
            )}
            {data.badgeCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#F5C842" }}>
                🏅 {data.badgeCount} {isAr ? "شارة" : "badges"}
              </span>
            )}
          </div>
        )}

        <p style={{ margin: "8px 0 0", fontSize: 10, fontWeight: 700, color: "rgba(201,160,80,0.8)", textAlign: "center" as const }}>
          {isAr ? "عرض الإنجازات كاملة ←" : "View all achievements →"}
        </p>
      </button>
    </div>
  );
}

/* ── End Sidebar XP Card ──────────────────────────────────────────────────── */

type TabId =
  | "overview"
  | "assignments"
  | "shared"
  | "library_homework"
  | "library_competitions"
  | "competitive"
  | "tools"
  | "presentations"
  | "islamic"
  | "videos"
  | "stats"
  | "students";

interface SharedAssignment {
  id: number;
  title: string;
  type: string;
  subject: string | null;
  description: string | null;
  isShared: boolean;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  createdAt: string;
  questionCount: number;
}

type GameMode = "solo" | "teams";

/** Games that can be launched from an assignment (live session). Default: وميض */
type AssignmentLiveGameChoice =
  | "knowledge_race"
  | "tug_of_war"
  | "million"
  | "hack"
  | "rocket_race"
  | "hotseat";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const [creatingGameForId, setCreatingGameForId] = useState<number | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [gameSetupModal, setGameSetupModal] = useState<number | null>(null);
  const [gameTargetClass, setGameTargetClass] = useState<string>(() => getRememberedTargetClass());
  const [gameMode, setGameMode] = useState<GameMode>("solo");
  const [teamCount, setTeamCount] = useState(2);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  /** Assignment ID awaiting live-game choice (وميض default), then branch to setup / navigate */
  const [assignmentGamePickerId, setAssignmentGamePickerId] = useState<number | null>(
    null,
  );
  /** From `/teacher?liveGame=1` (نشاط جديد → لعبة مباشرة): open وميض assignment picker */
  const [openWameethDeepLink, setOpenWameethDeepLink] = useState(false);
  const { t, lang } = useI18n();
  const BackArrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const {
    data: user,
    isLoading: isUserLoading,
    error: userError,
  } = useGetCurrentTeacher({ query: { retry: false } as any });

  const { data: assignmentsRaw, isLoading: isAssignmentsLoading } =
    useListAssignments(user ? { teacherId: user.id } : undefined, {
      query: { enabled: !!user } as any,
    });
  const assignments: Assignment[] = Array.isArray(assignmentsRaw)
    ? assignmentsRaw
    : Array.isArray((assignmentsRaw as any)?.assignments)
      ? (assignmentsRaw as any).assignments
      : [];

  const queryClient = useQueryClient();
  const deleteAssignmentMutation = useDeleteAssignment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
        toast.success(
          t.assignmentDetail?.deleted ||
            (lang === "ar" ? "تم حذف الواجب" : "Assignment deleted"),
        );
      },
      onError: () => {
        toast.error(
          lang === "ar" ? "خطأ في حذف الواجب" : "Error deleting assignment",
        );
      },
    },
  });

  const [sharedAssignments, setSharedAssignments] = useState<
    SharedAssignment[]
  >([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [importingIds, setImportingIds] = useState<Set<number>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (userError) setLocation("/login");
  }, [userError, setLocation]);

  const consumeWameethDeepLink = useCallback(() => {
    setOpenWameethDeepLink(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const allowed = ["overview", "assignments", "shared", "library_homework", "library_competitions", "competitive", "tools", "videos", "stats", "students"] as const;
    type AllowedTab = typeof allowed[number];
    if (tabParam && (allowed as readonly string[]).includes(tabParam)) {
      setActiveTab(tabParam as AllowedTab);
      params.delete("tab");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
    if (params.get("liveGame") !== "1") return;
    setActiveTab("competitive");
    setOpenWameethDeepLink(true);
    params.delete("liveGame");
    const qs = params.toString();
    const path = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState({}, "", path);
  }, [user]);

  useEffect(() => {
    if (activeTab !== "shared" || !user) return;
    if (sharedAssignments.length > 0) return;
    setSharedLoading(true);
    fetch(`${BASE_URL}/api/assignments/shared`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setSharedAssignments(
          Array.isArray(d)
            ? (d as SharedAssignment[]).filter((a) => a.teacherId !== user.id)
            : [],
        ),
      )
      .catch(() => setSharedAssignments([]))
      .finally(() => setSharedLoading(false));
  }, [activeTab, user]);

  const importSharedAssignment = async (id: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setImportingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`${BASE_URL}/api/assignments/${id}/import`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast.success(
          lang === "ar"
            ? "تم الاستيراد! الواجب الآن في قائمتك."
            : "Imported! Assignment added to your list.",
        );
        setImportedIds((prev) => new Set(prev).add(id));
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(
          d.message || (lang === "ar" ? "خطأ في الاستيراد" : "Import failed"),
        );
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاستيراد" : "Import failed");
    } finally {
      setImportingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const openGameSetup = (assignmentId: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAssignmentGamePickerId(assignmentId);
  };

  const handleAssignmentGameChoice = (choice: AssignmentLiveGameChoice) => {
    const id = assignmentGamePickerId;
    if (id == null) return;
    setAssignmentGamePickerId(null);

    if (choice === "knowledge_race") {
      setGameMode("solo");
      setTeamCount(2);
      setCustomTeamNames(["", "", "", "", "", ""]);
      setGameSetupModal(id);
      return;
    }
    if (choice === "tug_of_war") {
      setLocation(`/game/tug/create?assignmentId=${id}`);
      return;
    }
    if (choice === "rocket_race") {
      setLocation(`/game/rocket/create?assignmentId=${id}`);
      return;
    }
    if (choice === "hotseat") {
      setLocation(`/game/hotseat/create`);
      return;
    }
    if (choice === "million") {
      setLocation(`/game/million?assignmentId=${id}`);
      return;
    }
    if (choice === "hack") {
      setCreatingGameForId(id);
      const socket = getSocket();
      const remembered = getRememberedTargetClass();
      socket.emit(
        "teacher:create-game",
        { assignmentId: id, hackMode: true, gameMode: "solo", targetClass: remembered || undefined },
        (res: { pin?: string; error?: string }) => {
          setCreatingGameForId(null);
          if (res.error) {
            toast.error(res.error);
            disconnectSocket();
            return;
          }
          setLocation(`/teacher/game/${res.pin}`);
        },
      );
    }
  };

  const confirmStartGame = () => {
    if (!gameSetupModal) return;
    const assignmentId = gameSetupModal;
    setGameSetupModal(null);
    setCreatingGameForId(assignmentId);
    const socket = getSocket();
    const validCustomNames =
      gameMode === "teams"
        ? customTeamNames.slice(0, teamCount).map((n) => n.trim())
        : undefined;
    const hasCustomNames =
      validCustomNames && validCustomNames.some((n) => n.length > 0);
    socket.emit(
      "teacher:create-game",
      {
        assignmentId,
        gameMode,
        teamCount: gameMode === "teams" ? teamCount : undefined,
        customTeamNames: hasCustomNames ? validCustomNames : undefined,
        targetClass: gameTargetClass || undefined,
      },
      (res: { pin?: string; error?: string }) => {
        setCreatingGameForId(null);
        if (res.error) {
          toast.error(res.error);
          disconnectSocket();
          return;
        }
        setLocation(`/teacher/game/${res.pin}`);
      },
    );
  };

  if (userError) return null;

  if (isUserLoading)
    return (
      <Layout>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-6xl">
          <div className="mb-12 space-y-3">
            <div className="h-10 w-64 bg-muted/60 rounded-xl skeleton-shimmer" />
            <div className="h-5 w-48 bg-muted/40 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 sm:p-6 rounded-xl border border-border/40 bg-card animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-muted/60" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-24 bg-muted/40 rounded" />
                    <div className="h-7 w-12 bg-muted/60 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-12 w-full bg-muted/30 rounded-xl animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl border border-border/40 bg-card animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </Layout>
    );

  const tabs: {
    id: TabId;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    href?: string;
  }[] = [
    {
      id: "overview",
      label: lang === "ar" ? "الرئيسية" : "Overview",
      shortLabel: lang === "ar" ? "الرئيسية" : "Home",
      icon: <Home className="w-4 h-4" />,
    },
    {
      id: "assignments",
      label: lang === "ar" ? "واجباتي" : "My Assignments",
      shortLabel: lang === "ar" ? "واجباتي" : "Assignments",
      icon: <BookText className="w-4 h-4" />,
    },
    {
      id: "library_homework",
      label: lang === "ar" ? "مكتبة الأنشطة" : "Activities Library",
      shortLabel: lang === "ar" ? "الأنشطة" : "Activities",
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: "library_competitions",
      label: lang === "ar" ? "مكتبة المسابقات الجاهزة" : "Competitions Library",
      shortLabel: lang === "ar" ? "المسابقات" : "Competitions",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: "competitive",
      label: lang === "ar" ? "الألعاب التعليمية" : "Educational Games",
      shortLabel: lang === "ar" ? "ابدأ مسابقة" : "Start Quiz",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: "tools",
      label: lang === "ar" ? "الأدوات" : "Tools",
      shortLabel: lang === "ar" ? "أدوات" : "Tools",
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: "presentations",
      label: lang === "ar" ? "العروض التفاعلية" : "Interactive Presentations",
      shortLabel: lang === "ar" ? "العروض" : "Decks",
      icon: <Monitor className="w-4 h-4" />,
    },
    {
      id: "videos",
      label: lang === "ar" ? "الفيديو التفاعلي" : "Interactive Video",
      shortLabel: lang === "ar" ? "الفيديو" : "Video",
      icon: <Video className="w-4 h-4" />,
    },
    {
      id: "stats",
      label: lang === "ar" ? "ملخص الأداء" : "Performance Summary",
      shortLabel: lang === "ar" ? "الأداء" : "Stats",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: "students",
      label: lang === "ar" ? "صفوفي وطلابي" : "My Classes & Students",
      shortLabel: lang === "ar" ? "الطلاب" : "Students",
      icon: <Users className="w-4 h-4" />,
    },
  ];

  const mcqAssignments = assignments?.filter((a) => a.questionCount > 0) || [];
  const totalSubmissions =
    assignments?.reduce((acc, curr) => acc + curr.submissionCount, 0) || 0;
  const activeAssignments =
    assignments?.filter(
      (a) => !a.deadline || new Date(a.deadline) >= new Date(),
    ) || [];
  const expiredAssignments =
    assignments?.filter(
      (a) => a.deadline && new Date(a.deadline) < new Date(),
    ) || [];
  const avgSubmissions =
    assignments && assignments.length > 0
      ? Math.round((totalSubmissions / assignments.length) * 10) / 10
      : 0;

  const isAr = lang === "ar";

  // Admin-controlled feature flag for the Google Classroom integration.
  // Hidden by default; surfaced only when the admin enables it.
  const [classroomEnabled, setClassroomEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE_URL}/api/public/settings`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setClassroomEnabled(!!d.classroomEnabled); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const tabContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
      >
        {activeTab === "assignments" && (
          <AssignmentsTab
            assignments={assignments}
            isLoading={isAssignmentsLoading}
            creatingGameForId={creatingGameForId}
            startGame={openGameSetup}
            lang={lang}
            t={t}
            setLocation={setLocation}
            setActiveTab={setActiveTab}
            BackArrow={BackArrow}
            queryClient={queryClient}
            deleteAssignment={(id: number) => {
              if (
                confirm(
                  isAr
                    ? "هل تريد حذف هذا الواجب؟ سيتم حذف جميع الأسئلة والتسليمات."
                    : "Delete this assignment? All questions and submissions will be removed.",
                )
              ) {
                deleteAssignmentMutation.mutate({ id });
              }
            }}
            user={user}
          />
        )}
        {activeTab === "shared" && (
          <SharedTab
            assignments={sharedAssignments}
            isLoading={sharedLoading}
            lang={lang}
            importingIds={importingIds}
            importedIds={importedIds}
            importAssignment={importSharedAssignment}
            creatingGameForId={creatingGameForId}
            startGame={openGameSetup}
          />
        )}
        {activeTab === "competitive" && (
          <CompetitiveTab
            t={t}
            lang={lang}
            setLocation={setLocation}
            user={user}
            mcqAssignments={mcqAssignments}
            creatingGameForId={creatingGameForId}
            startGame={openGameSetup}
            initialOpenWameeth={openWameethDeepLink}
            onConsumeWameethDeepLink={consumeWameethDeepLink}
          />
        )}
        {activeTab === "tools" && (
          <ToolsTab t={t} lang={lang} setLocation={setLocation} user={user} classroomEnabled={classroomEnabled} />
        )}
        {activeTab === "videos" && (
          <VideoLessonsTab lang={lang} setLocation={setLocation} user={user} />
        )}
        {activeTab === "stats" && (
          <StatsTab
            assignments={assignments}
            totalSubmissions={totalSubmissions}
            activeAssignments={activeAssignments}
            expiredAssignments={expiredAssignments}
            avgSubmissions={avgSubmissions}
            t={t}
            lang={lang}
          />
        )}
        {activeTab === "students" && (
          <StudentsInlineTab lang={lang} setLocation={setLocation} />
        )}
        {activeTab === "library_homework" && (
          <SharedContentPage embedded forceKind="homework" />
        )}
        {activeTab === "library_competitions" && (
          <SharedContentPage embedded forceKind="competition" />
        )}
        {activeTab === "presentations" && (
          <PresentationsIndex embedded />
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <Layout>
      {/* ── Desktop sidebar layout ── */}
      <div className="hidden lg:flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 flex flex-col sticky top-0 h-screen overflow-y-auto" style={{background: "#1E4D35", borderInlineEnd: "none", paddingTop: 12}}>
          {/* Logo intentionally removed — the main top header already shows the Hasad logo. */}
          {/* User greeting — shown only on overview tab */}
          {activeTab === "overview" && (
            <div style={{padding: "10px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10}}>
              <div style={{width: 30, height: 30, background: "rgba(255,255,255,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.2)"}}>
                {(user?.name || "?").charAt(0)}
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <p style={{fontSize: 9, color: "rgba(255,255,255,0.5)", margin: 0, fontWeight: 600}}>{isAr ? "مرحباً" : "Hello"}</p>
                <p style={{fontSize: 12, fontWeight: 800, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{user?.name}</p>
              </div>
            </div>
          )}
          {/* Create CTA — always visible in sidebar */}
          <div style={{padding: "12px 12px 8px"}}>
            <button
              onClick={() => setLocation("/teacher/new")}
              style={{width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", background: "#E8A80E", color: "#1E4D35", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 12px rgba(232,168,14,0.35)"}}
            >
              <Plus className="w-3.5 h-3.5" />
              {isAr ? "أنشئ نشاطًا جديدًا" : "Create New Activity"}
            </button>
          </div>
          <nav className="flex-1 space-y-0.5">
            {/* ── Section: Main ── */}
            <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-widest" style={{color: "rgba(255,255,255,0.4)"}}>
              {isAr ? "الرئيسية" : "Main"}
            </p>
            {tabs.filter(t => ["overview","assignments","library_homework","library_competitions","competitive","islamic","stats","students"].includes(t.id)).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.href) setLocation(tab.href);
                    else setActiveTab(tab.id);
                  }}
                  className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all overflow-hidden group"
                  style={active ? { background: "rgba(255,255,255,0.15)", color: "#fff" } : { color: "rgba(255,255,255,0.65)" }}
                >
                  {!active && (
                    <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(255,255,255,0.07)" }} />
                  )}
                  {active && (
                    <span className={cn("absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full", isAr ? "end-0" : "start-0")} style={{ background: "#E8A80E" }} />
                  )}
                  <span className="relative [&_svg]:w-4 [&_svg]:h-4 shrink-0" style={{color: active ? "#fff" : "rgba(255,255,255,0.55)"}}>
                    {tab.icon}
                  </span>
                  <span className="relative truncate">{tab.label}</span>
                </button>
              );
            })}

            {/* ── Divider ── */}
            <div className="my-3 border-t border-border/50" />

            {/* ── Section: Content ── */}
            <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-widest" style={{color: "rgba(255,255,255,0.4)"}}>
              {isAr ? "المحتوى" : "Content"}
            </p>
            {tabs.filter(t => ["tools","presentations","videos"].includes(t.id)).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.href) setLocation(tab.href);
                    else setActiveTab(tab.id);
                  }}
                  className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all overflow-hidden group"
                  style={active ? { background: "rgba(255,255,255,0.15)", color: "#fff" } : { color: "rgba(255,255,255,0.65)" }}
                >
                  {!active && (
                    <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(255,255,255,0.07)" }} />
                  )}
                  {active && (
                    <span className={cn("absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full", isAr ? "end-0" : "start-0")} style={{ background: "#E8A80E" }} />
                  )}
                  <span className="relative [&_svg]:w-4 [&_svg]:h-4 shrink-0" style={{color: active ? "#fff" : "rgba(255,255,255,0.55)"}}>
                    {tab.icon}
                  </span>
                  <span className="relative truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* ── XP / Achievements sidebar card ── */}
          <SidebarXpCard setLocation={setLocation} isAr={isAr} />

        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0" style={{display: activeTab === "overview" ? "flex" : "block", flexDirection: "column"}}>
          {activeTab !== "overview" && (
            <div className="py-8 px-6 xl:px-10 2xl:px-14">
              <div className="mb-6">
                <GuestDraftImportBanner />
              </div>
              {/* Tab heading */}
              <div className="mb-5">
                <h1 className="text-2xl font-extrabold text-foreground">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h1>
              </div>
          {/* Prominent stat cards — hidden on tabs where they aren't relevant */}
          {!["tools", "competitive", "students", "shared", "library_homework", "library_competitions"].includes(activeTab) && (
          <div className="grid grid-cols-3 gap-3 mb-7">
            <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BookText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {isAr ? "الواجبات" : "Assignments"}
                </p>
                <p className="text-2xl font-black text-foreground leading-tight">
                  {assignments?.length || 0}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:border-amber-400/50 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {isAr ? "التسليمات" : "Submissions"}
                </p>
                <p className="text-2xl font-black text-foreground leading-tight">
                  {totalSubmissions}
                </p>
              </div>
            </div>
            <Link href="/teacher/students" className="block">
              <div className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3 hover:border-emerald-400/50 transition-colors h-full">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {isAr ? "النشطة" : "Active"}
                  </p>
                  <p className="text-2xl font-black text-foreground leading-tight">
                    {activeAssignments.length}
                  </p>
                </div>
              </div>
            </Link>
          </div>
          )}
          {tabContent}
            </div>
          )}
          {activeTab === "overview" && (
            <DashboardOverview
              user={user}
              assignments={assignments}
              isLoading={isAssignmentsLoading}
              lang={lang}
              setLocation={setLocation}
              setActiveTab={setActiveTab}
              startGame={openGameSetup}
              creatingGameForId={creatingGameForId}
            />
          )}
        </main>
      </div>

      {/* ── Mobile overview ── */}
      {activeTab === "overview" && (
        <div className="lg:hidden pb-28">
          <DashboardOverview
            user={user}
            assignments={assignments}
            isLoading={isAssignmentsLoading}
            lang={lang}
            setLocation={setLocation}
            setActiveTab={setActiveTab}
            startGame={openGameSetup}
            creatingGameForId={creatingGameForId}
          />
        </div>
      )}

      {/* ── Mobile layout (< lg) — non-overview tabs ──
          Header (logo + name + bell) is rendered in the global layout, and tab
          switching happens via the fixed bottom nav, so this view only needs a
          simple page title + the tab content. */}
      <div className={activeTab === "overview" ? "hidden" : "lg:hidden"}>
        <div className="px-4 pt-4 pb-2">
          <div className="mb-3">
            <GuestDraftImportBanner />
          </div>
          <h1 className="text-lg font-extrabold text-foreground flex items-center gap-2">
            <span className="[&_svg]:w-5 [&_svg]:h-5 text-primary">
              {tabs.find((t) => t.id === activeTab)?.icon}
            </span>
            {tabs.find((t) => t.id === activeTab)?.label}
          </h1>
        </div>

        {/* Tab content */}
        <div className="px-4 pb-28">{tabContent}</div>
      </div>

      {/* Fixed mobile bottom nav — visible on all teacher dashboard tabs (< lg) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/60 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        dir={isAr ? "rtl" : "ltr"}
      >
        {tabs
          .filter((tab) =>
            ["overview", "assignments", "competitive", "tools", "islamic"].includes(tab.id),
          )
          .map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.href) setLocation(tab.href);
                  else setActiveTab(tab.id);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-3 px-0.5 transition-all relative",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Active indicator dot at top */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full"
                    style={{ background: "#D9A521" }}
                  />
                )}
                <span
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl transition-all [&_svg]:w-6 [&_svg]:h-6",
                    active ? "text-white" : "",
                  )}
                  style={active ? { background: "#225739" } : undefined}
                >
                  {tab.icon}
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-none",
                    active ? "font-bold" : "font-semibold",
                  )}
                >
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
      </nav>

      {/* ── Modal: اختيار لعبة من الواجب ── */}
      <AnimatePresence>
        {assignmentGamePickerId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setAssignmentGamePickerId(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              className="bg-card rounded-2xl border border-border shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6 border-b border-border/60 bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                      <Gamepad2 className="w-6 h-6 text-primary shrink-0" />
                      {lang === "ar"
                        ? "اختر نوع اللعبة الحية"
                        : "Choose your live game"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {lang === "ar"
                        ? "أسئلة الواجب ستُستخدم في اللعبة التي تختارها. وميض هي اللعبة الافتراضية (أسلوب كاهوت)."
                        : "This assignment's questions power the mode you pick. Wameeth is the default (Kahoot-style)."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignmentGamePickerId(null)}
                    className="shrink-0 rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label={lang === "ar" ? "إغلاق" : "Close"}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "knowledge_race" as const,
                      emoji: "⚡",
                      titleAr: "وميض",
                      titleEn: "Wameeth",
                      descAr:
                        "مسابقة حية على الشاشة الكبيرة — طلابك يجيبون من هواتفهم (مثل كاهوت).",
                      descEn:
                        "Live quiz on the big screen — students answer from phones (Kahoot-style).",
                      gradient: "from-fuchsia-500 to-purple-600",
                      defaultBadge: true,
                    },
                    {
                      key: "tug_of_war" as const,
                      emoji: "🪢",
                      titleAr: "شد الحبل",
                      titleEn: "Tug of War",
                      descAr:
                        "فريقان يتنافسان بالإجابة؛ الحبل يتحرك مع كل إجابة صحيحة.",
                      descEn:
                        "Two teams answer MCQs; the rope moves with each correct answer.",
                      gradient: "from-blue-500 to-indigo-600",
                    },
                    {
                      key: "million" as const,
                      emoji: "🏆",
                      titleAr: "من سيحصد المليون؟",
                      titleEn: "Who Wants a Million?",
                      descAr:
                        "سلسلة أسئلة متصاعدة مع أطواق نجاة — يحتاج واجبك ٥ أسئلة أو أكثر.",
                      descEn:
                        "Escalating questions with lifelines — assignment needs 5+ questions.",
                      gradient: "from-amber-500 to-orange-600",
                    },
                    {
                      key: "hack" as const,
                      emoji: "💻",
                      titleAr: "لعبة الاختراق",
                      titleEn: "Hack Game",
                      descAr:
                        "ماراثون تنافسي: كلمات سر، صناديق، وسحب نقاط بين الطلاب.",
                      descEn:
                        "Competitive marathon: passwords, loot boxes, steal points.",
                      gradient: "from-emerald-700 to-teal-800",
                    },
                    {
                      key: "rocket_race" as const,
                      emoji: "🚀",
                      titleAr: "سباق الصواريخ",
                      titleEn: "Rocket Race",
                      descAr:
                        "كل طالب صاروخاً يصعد مع الإجابات الصحيحة السريعة.",
                      descEn:
                        "Each student is a rocket — faster correct answers climb higher.",
                      gradient: "from-violet-500 to-fuchsia-600",
                    },
                    {
                      key: "hotseat" as const,
                      emoji: "🔥",
                      titleAr: "الكرسي الساخن",
                      titleEn: "HotSeat",
                      descAr:
                        "طالب على الكرسي يجيب على أسئلة زملائه المجهولة والجميع يصوّت.",
                      descEn:
                        "One student answers anonymous classmates' questions — everyone votes.",
                      gradient: "from-orange-500 to-red-600",
                    },
                  ] as const
                ).map((opt) => {
                  const busy =
                    creatingGameForId === assignmentGamePickerId &&
                    opt.key === "hack";
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={busy}
                      onClick={() => handleAssignmentGameChoice(opt.key)}
                      className="text-start rounded-2xl border-2 border-border/70 bg-card hover:border-primary/50 hover:bg-primary/[0.03] hover:shadow-lg transition-all p-4 flex flex-col gap-2 disabled:opacity-60 disabled:pointer-events-none group"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.gradient} flex items-center justify-center text-2xl shadow-md shrink-0`}
                        >
                          {opt.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <span className="font-black text-base text-foreground leading-tight">
                              {lang === "ar" ? opt.titleAr : opt.titleEn}
                            </span>
                            {(opt as { defaultBadge?: boolean }).defaultBadge && (
                              <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                                {lang === "ar" ? "افتراضي" : "Default"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                            {lang === "ar" ? opt.descAr : opt.descEn}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-primary group-hover:underline mt-1">
                        {busy
                          ? lang === "ar"
                            ? "جاري الإنشاء…"
                            : "Creating…"
                          : lang === "ar"
                            ? "اضغط للمتابعة ←"
                            : "Tap to continue →"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal إعداد اللعبة ── */}
      <AnimatePresence>
        {gameSetupModal !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setGameSetupModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <Gamepad2 className="w-12 h-12 text-purple-500 mx-auto mb-2" />
                <h3 className="text-xl font-black text-foreground">
                  {t.teacherGame.gameMode}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setGameMode("solo")}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${gameMode === "solo" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-border bg-muted/30 text-muted-foreground hover:border-purple-300"}`}
                >
                  <User className="w-7 h-7 mx-auto mb-1.5" />
                  <p className="font-black text-sm">{t.teacherGame.soloMode}</p>
                  <p className="text-xs mt-0.5 opacity-70">
                    {t.teacherGame.soloModeDesc}
                  </p>
                </button>
                <button
                  onClick={() => setGameMode("teams")}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${gameMode === "teams" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-border bg-muted/30 text-muted-foreground hover:border-purple-300"}`}
                >
                  <UsersRound className="w-7 h-7 mx-auto mb-1.5" />
                  <p className="font-black text-sm">{t.teacherGame.teamMode}</p>
                  <p className="text-xs mt-0.5 opacity-70">
                    {t.teacherGame.teamModeDesc}
                  </p>
                </button>
              </div>
              {gameMode === "teams" && (
                <div className="mb-5 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-2 text-center">
                      {t.teacherGame.teamCount}
                    </label>
                    <div className="flex justify-center gap-2">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => setTeamCount(n)}
                          className={`w-10 h-10 rounded-xl font-black text-base transition-all ${teamCount === n ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-2 text-center">
                      {lang === "ar"
                        ? "أسماء الفرق (اختياري)"
                        : "Team Names (optional)"}
                    </label>
                    <div className="space-y-2">
                      {Array.from({ length: teamCount }).map((_, i) => {
                        const defaults =
                          lang === "ar"
                            ? [
                                "الأذكياء",
                                "المتميزون",
                                "الفائقون",
                                "المبدعون",
                                "الرائعون",
                                "الرياديون",
                              ]
                            : [
                                "Champions",
                                "Stars",
                                "Warriors",
                                "Innovators",
                                "Legends",
                                "Pioneers",
                              ];
                        return (
                          <input
                            key={i}
                            type="text"
                            value={customTeamNames[i] || ""}
                            onChange={(e) => {
                              const next = [...customTeamNames];
                              next[i] = e.target.value;
                              setCustomTeamNames(next);
                            }}
                            placeholder={defaults[i]}
                            maxLength={20}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-sm font-bold focus:outline-none focus:border-purple-400 transition-colors"
                            dir={lang === "ar" ? "rtl" : "ltr"}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-1.5">
                      {lang === "ar"
                        ? "اتركها فارغة للاستخدام الافتراضي"
                        : "Leave blank to use defaults"}
                    </p>
                  </div>
                </div>
              )}
              <div className="mb-5">
                <ClassSelector
                  value={gameTargetClass}
                  onChange={setGameTargetClass}
                  accent="#a855f7"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setGameSetupModal(null)}
                  className="flex-1 px-4 py-3 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors"
                >
                  {t.teacherGame.cancelGame}
                </button>
                <button
                  onClick={confirmStartGame}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black shadow-lg shadow-green-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Gamepad2 className="w-5 h-5" />
                  {t.teacherGame.startGame}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

const BASE_URL = import.meta.env.VITE_API_URL || "";

interface DashboardCollection {
  id: number;
  name: string;
  description: string | null;
  coverImageUrl?: string | null;
  isPublic?: boolean;
  itemCount: number;
  assignmentIds: number[];
  teacherName?: string;
}

interface VideoLessonSummary {
  id: number;
  title: string;
  subject: string | null;
  videoType: string;
  targetClass: string | null;
  createdAt: string;
  questionCount: number;
  submissionCount: number;
}

function AssignmentsTab({
  assignments,
  isLoading,
  creatingGameForId,
  startGame,
  lang,
  t,
  setLocation,
  setActiveTab,
  BackArrow,
  deleteAssignment,
  queryClient,
  user,
}: any) {
  const [collections, setCollections] = useState<DashboardCollection[]>([]);
  const [publicCollections, setPublicCollections] = useState<DashboardCollection[]>([]);
  const [filterCollectionId, setFilterCollectionId] = useState<
    number | "all" | "none"
  >("all");
  const [creatingGroupName, setCreatingGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    loadCollections();
    loadPublicCollections();
  }, []);

  function loadCollections() {
    fetch(`${BASE_URL}/api/collections`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: DashboardCollection[]) =>
        setCollections(Array.isArray(data) ? data : []),
      )
      .catch(() => {});
  }

  function loadPublicCollections() {
    fetch(`${BASE_URL}/api/collections/public-from-others`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: DashboardCollection[]) =>
        setPublicCollections(Array.isArray(data) ? data : []),
      )
      .catch(() => {});
  }

  async function createGroup(name: string, isPublic: boolean) {
    const r = await fetch(`${BASE_URL}/api/collections`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), isPublic }),
    });
    if (r.ok) {
      const newCol = await r.json();
      toast.success(
        lang === "ar" ? `تم إنشاء "${newCol.name}"` : `Created "${newCol.name}"`,
      );
      loadCollections();
      return newCol;
    }
    throw new Error("create failed");
  }

  async function addToCollection(collectionId: number, assignmentId: number) {
    // Optimistic update — show the assignment in the collection immediately
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              assignmentIds: c.assignmentIds?.includes(assignmentId)
                ? c.assignmentIds
                : [...(c.assignmentIds || []), assignmentId],
              itemCount: c.assignmentIds?.includes(assignmentId)
                ? c.itemCount
                : (c.itemCount || 0) + 1,
            }
          : c,
      ),
    );
    try {
      const r = await fetch(
        `${BASE_URL}/api/collections/${collectionId}/items`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId, itemOrder: 0 }),
        },
      );
      if (r.ok) {
        toast.success(
          lang === "ar" ? "تمت الإضافة للمجموعة" : "Added to group",
        );
        loadCollections();
      } else {
        // Revert optimistic update on failure
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId
              ? {
                  ...c,
                  assignmentIds: (c.assignmentIds || []).filter(
                    (id) => id !== assignmentId,
                  ),
                  itemCount: Math.max(0, (c.itemCount || 0) - 1),
                }
              : c,
          ),
        );
        const d = await r.json().catch(() => ({}));
        toast.error(d.message || (lang === "ar" ? "خطأ" : "Error"));
      }
    } catch {
      // Revert optimistic update on error
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                assignmentIds: (c.assignmentIds || []).filter(
                  (id) => id !== assignmentId,
                ),
                itemCount: Math.max(0, (c.itemCount || 0) - 1),
              }
            : c,
        ),
      );
      toast.error(lang === "ar" ? "خطأ" : "Error");
    }
  }

  async function removeFromCollection(
    collectionId: number,
    assignmentId: number,
  ) {
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return;
    try {
      const itemsRes = await fetch(
        `${BASE_URL}/api/collections/${collectionId}/items`,
        { credentials: "include", cache: "no-store" },
      );
      if (!itemsRes.ok) return;
      const data = await itemsRes.json();
      const item = (data.items || []).find(
        (it: any) => it.assignmentId === assignmentId,
      );
      if (!item) return;
      const r = await fetch(
        `${BASE_URL}/api/collections/${collectionId}/items/${item.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (r.ok) {
        toast.success(
          lang === "ar" ? "تمت الإزالة من المجموعة" : "Removed from group",
        );
        loadCollections();
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ" : "Error");
    }
  }

  async function createGroupAndAdd(assignmentId: number) {
    if (!creatingGroupName.trim()) return;
    setSavingGroup(true);
    try {
      const r = await fetch(`${BASE_URL}/api/collections`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: creatingGroupName.trim() }),
      });
      if (r.ok) {
        const newCol = await r.json();
        toast.success(
          lang === "ar"
            ? `تم إنشاء "${newCol.name}"`
            : `Created "${newCol.name}"`,
        );
        setCreatingGroupName("");
        await addToCollection(newCol.id, assignmentId);
        loadCollections();
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ" : "Error");
    } finally {
      setSavingGroup(false);
    }
  }

  const filteredAssignments = !assignments ? [] : assignments;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="p-5 border-border/40"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-16 bg-muted/60 rounded-md skeleton-shimmer" />
                  <div className="h-5 w-40 bg-muted/50 rounded-md skeleton-shimmer" />
                </div>
                <div className="h-4 w-60 bg-muted/30 rounded skeleton-shimmer" />
              </div>
              <div className="h-8 w-20 bg-muted/40 rounded-lg skeleton-shimmer" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card className="py-16 text-center border-dashed">
        <BookText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">
          {t.dashboard.noAssignments}
        </h3>
        <p className="text-muted-foreground mb-6">
          {t.dashboard.noAssignmentsDesc}
        </p>
        <Button onClick={() => setLocation("/teacher/new")}>
          {t.dashboard.createAssignment}
        </Button>
      </Card>
    );
  }

  return (
    <AssignmentsTabRender
      assignments={assignments}
      filteredAssignments={filteredAssignments}
      collections={collections}
      publicCollections={publicCollections}
      filterCollectionId={filterCollectionId}
      setFilterCollectionId={setFilterCollectionId}
      creatingGameForId={creatingGameForId}
      startGame={startGame}
      deleteAssignment={deleteAssignment}
      setLocation={setLocation}
      setActiveTab={setActiveTab}
      lang={lang}
      t={t}
      queryClient={queryClient}
      addToCollection={addToCollection}
      removeFromCollection={removeFromCollection}
      creatingGroupName={creatingGroupName}
      setCreatingGroupName={setCreatingGroupName}
      createGroupAndAdd={createGroupAndAdd}
      createGroup={createGroup}
      savingGroup={savingGroup}
      user={user}
      reloadCollections={loadCollections}
    />
  );
}

function CompetitiveTab({
  t,
  lang,
  setLocation,
  user,
  mcqAssignments,
  creatingGameForId,
  startGame,
  initialOpenWameeth,
  onConsumeWameethDeepLink,
}: any) {
  const [showKnowledgeRace, setShowKnowledgeRace] = useState(false);
  const [showWameethModal, setShowWameethModal] = useState(false);
  const wameethPickerRef = useRef<HTMLDivElement | null>(null);
  const [showMaraquiPublic, setShowMaraquiPublic] = useState(false);
  const BASE = import.meta.env.VITE_API_URL || "";

  const isAdmin = Boolean(user?.isAdmin) || user?.role === "admin";
  const maraquiVisible = isAdmin || showMaraquiPublic;

  useEffect(() => {
    fetch(`${BASE}/api/public/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (d?.showMaraqui !== undefined) setShowMaraquiPublic(Boolean(d.showMaraqui));
      });
  }, [BASE]);

  useEffect(() => {
    if (!initialOpenWameeth) return;
    setShowWameethModal(true);
    onConsumeWameethDeepLink?.();
  }, [initialOpenWameeth, onConsumeWameethDeepLink]);

  const openGameFromCatalog = (game: {
    type: string;
    available?: boolean;
  }) => {
    if (game.available === false) return;
    const { type } = game;
    if (type === "knowledge_race") {
      setShowWameethModal(true);
      return;
    }
    else if (type === "tug_of_war") setLocation("/game/tug/create");
    else if (type === "rocket_race") setLocation("/game/rocket/create");
    else if (type === "wheel_of_fortune") setLocation("/game/wheel/create");
    else if (type === "hotseat") setLocation("/game/hotseat/create");
    else if (type === "video_lesson")
      setLocation("/teacher/video-lesson/new");
    else if (type === "flag_quiz") setLocation("/game/flags");
    else if (type === "capitals") setLocation("/game/capitals");
    else if (type === "color_game") setLocation("/game/color");
    else if (type === "memory_match") setLocation("/game/memory");
    else if (type === "multiplication") setLocation("/game/multiply");
    else if (type === "scramble_words") setLocation("/game/scramble");
    else if (type === "stroop") setLocation("/game/stroop/create");
    else if (type === "maraqui") setLocation("/game/maraqui");
    else if (type === "million") setLocation("/game/million");
    else if (type === "million_team")
      setLocation("/game/million/team-setup");
    else if (type === "hack") setLocation("/game/hack");
    else if (type === "letrly") setLocation("/game/letrly");
    else if (type === "arena") setLocation("/game/arena");
  };

  /** مسابقات مع طلاب الصف — أسئلة من واجباتك أو بنك الأسئلة */
  const liveGames = [
    {
      icon: "⚔️",
      title: lang === "ar" ? "تحدّي حصاد" : "Hasad Arena",
      desc:
        lang === "ar"
          ? "مسابقة فريقين على شاشة كبيرة — 6 فئات، 6 بطاقات لكل فئة (200 و 400 و 600)، وسائل مساعدة استراتيجية، ومناسبة للكبار والمؤسسات والصفوف."
          : "Two-team big-screen quiz — 6 categories with 6 cards each (200/400/600), strategic helpers, suitable for adults, institutions, and classrooms.",
      color: "from-emerald-700 to-amber-600",
      type: "arena",
      available: true,
      pill: lang === "ar" ? "شاشة كبيرة · جديد" : "Big screen · New",
    },
    {
      icon: "⚡",
      title:
        t.competitiveGames?.knowledgeRaceTitle ||
        (lang === "ar" ? "وميض" : "Wameeth"),
      desc:
        t.competitiveGames?.knowledgeRaceDesc ||
        (lang === "ar"
          ? "مسابقة حية على الشاشة — الطلاب يجيبون من هواتفهم (مثل كاهوت أو وورد وال). اربطها بواجبك."
          : "Live quiz on screen — students answer on phones (Kahoot-style). Link an assignment."),
      color: "from-fuchsia-500 to-purple-600",
      type: "knowledge_race",
      available: true,
      pill:
        lang === "ar" ? "موصى به — مثل كاهوت" : "Recommended — Kahoot-style",
    },
    {
      icon: "🪢",
      title: lang === "ar" ? "شد الحبل" : "Tug of War",
      desc:
        lang === "ar"
          ? "فريقان يتنافسان بأسئلة اختيار من متعدد؛ الحبل يتحرك مع كل إجابة صحيحة."
          : "Two teams battle with MCQs; the rope swings with correct answers.",
      color: "from-blue-500 to-indigo-600",
      type: "tug_of_war",
      available: true,
      pill: lang === "ar" ? "جماعي" : "Team play",
    },
    {
      icon: "🎡",
      title: lang === "ar" ? "عجلة الحظ" : "Wheel of Fortune",
      desc:
        lang === "ar"
          ? "أدر العجلة على شاشة الفصل، اقرأ السؤال، ومنح النقاط للفرق — أسئلة جاهزة بالذكاء الاصطناعي."
          : "Spin the wheel on the class display, read the question, and award team points — AI-generated segments.",
      color: "from-emerald-700 to-yellow-600",
      type: "wheel_of_fortune",
      available: true,
      pill: lang === "ar" ? "عرض صفّي" : "Class display",
    },
    {
      icon: "🚀",
      title: lang === "ar" ? "سباق الصواريخ" : "Rocket Race",
      desc:
        lang === "ar"
          ? "كل طالب صاروخ — السرعة والدقة ترقيه في المدرج. جيد للحماس الفردي داخل الصف."
          : "Each student is a rocket — speed and accuracy climb the leaderboard.",
      color: "from-violet-500 to-fuchsia-600",
      type: "rocket_race",
      available: true,
      pill: lang === "ar" ? "سباق حي" : "Live race",
    },
    {
      icon: "🔥",
      title: lang === "ar" ? "الكرسي الساخن" : "HotSeat",
      desc:
        lang === "ar"
          ? "طالب يجلس على الكرسي ويجيب على أسئلة زملائه المجهولة — والجميع يصوّت على إجابته. نقاط للأسرع والأكثر إقناعاً!"
          : "One student sits in the hot seat and answers anonymous classmates' questions — everyone votes. Points for speed and persuasion!",
      color: "from-orange-500 to-red-600",
      type: "hotseat",
      available: true,
      pill: lang === "ar" ? "حوار وتقييم" : "Q&A + vote",
    },
    {
      icon: "🏆",
      title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wants a Million?",
      desc:
        lang === "ar"
          ? "أسئلة متصاعدة حتى الجائزة الكبرى مع أطواق نجاة — مناسبة للعرض على السبورة."
          : "Escalating ladder to the grand prize with lifelines — great for whole-class display.",
      color: "from-amber-500 to-yellow-600",
      type: "million",
      available: true,
      pill: lang === "ar" ? "عرض صفّي" : "Class display",
    },
    {
      icon: "💻",
      title: lang === "ar" ? "لعبة الاختراق" : "Hack Game",
      desc:
        lang === "ar"
          ? "ماراثون تقني: كلمات سر، صناديق، وسحب نقاط بين الطلاب في جوّ مسابقات."
          : "Terminal marathon: passwords, loot boxes, steal points — competitive energy.",
      color: "from-green-700 to-emerald-900",
      type: "hack",
      available: true,
      pill: lang === "ar" ? "تنافس عالي" : "High stakes",
    },
    {
      icon: "🆚",
      title:
        lang === "ar" ? "مليون — فريق ضد فريق" : "Million — Team vs Team",
      desc:
        lang === "ar"
          ? "فريقان يصوتان على نفس الأسئلة في الوقت الفعلي كما في برامج التلفاز."
          : "Two teams vote on the same questions in real-time TV-show style.",
      color: "from-blue-500 to-purple-600",
      type: "million_team",
      available: true,
      pill: lang === "ar" ? "تصويت جماعي" : "Team voting",
    },
    {
      icon: "🎬",
      title: lang === "ar" ? "فيديو تفاعلي" : "Interactive Video",
      desc:
        lang === "ar"
          ? "أنشئ درس فيديو يتوقف تلقائياً عند الأسئلة لقياس الفهم أثناء العرض."
          : "Video lessons that pause for questions — formative checks while watching.",
      color: "from-red-500 to-rose-600",
      type: "video_lesson",
      available: true,
      pill: lang === "ar" ? "درس مرئي" : "Video lesson",
    },
  ];

  /** تحديات فردية — للتمرّن أو مسابقات الزوار بدون غرفة صفّية مباشرة */
  const soloGamesAll = [
    {
      icon: "🪜",
      title: lang === "ar" ? "مَراقي" : "Maraqui",
      desc:
        lang === "ar"
          ? "مسابقة ثقافية بمراحل متدرجة حتى المرحلة الأخيرة — تحدّ نفسك بالتاريخ والثقافة."
          : "Progressive cultural quiz ladder — challenge yourself to the final stage.",
      color: "from-teal-500 to-emerald-600",
      type: "maraqui",
      available: true,
      pill: lang === "ar" ? "مراحل" : "Stages",
      _gated: "maraqui" as const,
    },
    {
      icon: "🎨",
      title: lang === "ar" ? "لعبة الألوان" : "Color Game",
      desc:
        lang === "ar"
          ? "اختبار تركيز بصري — اعثر على المربع المختلف بين شبكة متشابهة بسرعة."
          : "Visual attention — spot the odd square in a grid, fast.",
      color: "from-violet-500 to-fuchsia-600",
      type: "color_game",
      available: true,
      pill: lang === "ar" ? "تركيز" : "Focus",
    },
    {
      icon: "🏁",
      title: lang === "ar" ? "أعلام الدول" : "Flag Quiz",
      desc:
        lang === "ar"
          ? "اختبر ذاكرتك الجغرافية بربط الدول بأعلامها في وقت محدود."
          : "Geography recall — match flags to countries against the clock.",
      color: "from-sky-500 to-indigo-600",
      type: "flag_quiz",
      available: true,
      pill: lang === "ar" ? "جغرافيا" : "Geo",
    },
    {
      icon: "🌍",
      title: lang === "ar" ? "عواصم البلدان" : "World Capitals",
      desc:
        lang === "ar"
          ? "اختبر معلوماتك الجغرافية بتحديد عواصم دول العالم — منافردة أو مع الآخرين."
          : "Test your geography knowledge by naming world capitals — solo or multiplayer.",
      color: "from-teal-500 to-cyan-600",
      type: "capitals",
      available: true,
      pill: lang === "ar" ? "جغرافيا" : "Geo",
    },
    {
      icon: "🧠",
      title: lang === "ar" ? "لعبة الذاكرة" : "Memory Match",
      desc:
        lang === "ar"
          ? "اقلب البطاقات واذكر مواقع الأزواج — تمرين ذاكرة عملي وممتع."
          : "Flip and pair cards — practical memory training.",
      color: "from-indigo-500 to-pink-600",
      type: "memory_match",
      available: true,
      pill: lang === "ar" ? "ذاكرة" : "Memory",
    },
    {
      icon: "✖️",
      title: lang === "ar" ? "جدول الضرب" : "Multiplication",
      desc:
        lang === "ar"
          ? "سرعة وحساب — سلسلة أسئلة ضرب لتثبيت الجدول بطريقة لعبية."
          : "Speed drills — multiplication chains in a playful loop.",
      color: "from-orange-500 to-amber-600",
      type: "multiplication",
      available: true,
      pill: lang === "ar" ? "رياضيات" : "Math",
    },
    {
      icon: "🧠",
      title: lang === "ar" ? "لعبة ارتباك" : "Stroop Game",
      desc:
        lang === "ar"
          ? "اضغط لون الحبر لا معنى الكلمة — كلاسيك علم النفس المعرفي."
          : "Tap ink color, not word meaning — classic cognitive science.",
      color: "from-red-500 to-orange-600",
      type: "stroop",
      available: true,
      pill: lang === "ar" ? "دماغ" : "Brain",
    },
    {
      icon: "🔤",
      title: lang === "ar" ? "الكلمات المبعثرة" : "Scrambled Words",
      desc:
        lang === "ar"
          ? "رتّب الحروف لتكوين الكلمات — مناسبة للتهجئة والمفردات."
          : "Unscramble letters — spelling and vocabulary practice.",
      color: "from-violet-500 to-fuchsia-600",
      type: "scramble_words",
      available: true,
      pill: lang === "ar" ? "إملاء" : "Spelling",
    },
    {
      icon: "🔡",
      title: lang === "ar" ? "تحدي الكلمة" : "Word Challenge",
      desc:
        lang === "ar"
          ? "Wordle بالعربية — كلمة سرّية ومحاولات محدودة، للعب الفردي أو مشاركة الرابط مع الطلاب."
          : "Wordle-style — secret word, limited guesses; solo or share a link.",
      color: "from-emerald-500 to-teal-600",
      type: "letrly",
      available: true,
      pill: lang === "ar" ? "كلمة يومية" : "Daily word",
    },
  ];

  const soloGames = soloGamesAll.filter(
    (g) => !("_gated" in g) || g._gated !== "maraqui" || maraquiVisible,
  );

  const GameCatalogSection = ({
    title,
    subtitle,
    accentClass,
    games,
    delayOffset,
  }: {
    title: string;
    subtitle: string;
    accentClass: string;
    games: typeof liveGames;
    delayOffset: number;
  }) => (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3
              className={`text-lg sm:text-xl font-black tracking-tight ${accentClass}`}
            >
              {title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {games.map((game, i) => (
          <motion.div
            key={`${game.type}-${i}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (delayOffset + i) * 0.04 }}
          >
            <Card
              className="group h-full p-4 sm:p-5 cursor-pointer transition-all hover:shadow-xl hover:border-primary/35 hover:-translate-y-0.5 border-2 border-border/70 bg-card"
              onClick={() => openGameFromCatalog(game)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={`w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br ${game.color} flex items-center justify-center text-2xl shadow-lg`}
                >
                  {game.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-black text-base sm:text-lg text-foreground leading-snug">
                      {game.title}
                    </h4>
                    {(game as any).pill && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {(game as any).pill}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {game.desc}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-[11px] font-bold text-primary group-hover:underline">
                  {game.type === "knowledge_race"
                    ? lang === "ar"
                      ? "اختر واجباً وابدأ ←"
                      : "Pick assignment & start →"
                    :                     game.type === "tug_of_war" ||
                        game.type === "video_lesson" ||
                        game.type === "rocket_race" ||
                        game.type === "hotseat"
                      ? lang === "ar"
                        ? "إنشاء غرفة ←"
                        : "Create session →"
                      : lang === "ar"
                        ? "فتح اللعبة ←"
                        : "Open game →"}
                </span>
                <Gamepad2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-10">
      <div className="text-center py-2 sm:py-4">
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex p-4 bg-gradient-to-br from-primary/15 to-amber-500/15 rounded-2xl mb-3 ring-1 ring-border/60"
        >
          <Trophy className="w-10 h-10 text-primary" />
        </motion.div>
        <h2 className="text-xl sm:text-3xl font-black text-foreground mb-2 tracking-tight">
          {t.dashboard.tabCompetitive || "ألعاب تعليمية"}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2">
          {lang === "ar"
            ? "مكتبة ألعاب منظّمة: مسابقات حية مع صفّك كما في المنصات العالمية، وتحديات فردية للتمرّن والترفيه."
            : "A structured game library: live class modes like leading platforms, plus solo brain challenges."}
        </p>
      </div>

      {/* مسابقات عامة — بطاقة وصول سريع في أعلى التبويب */}
      <Card
        onClick={() => setLocation("/islamic")}
        className="group p-4 sm:p-5 cursor-pointer transition-all hover:shadow-xl hover:border-primary/35 hover:-translate-y-0.5 border-2 border-border/70 bg-gradient-to-br from-teal-500/10 via-card to-cyan-500/5"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shrink-0">
            <Globe className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-black text-foreground">
              {lang === "ar" ? "مسابقات عامة" : "Public Quizzes"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {lang === "ar"
                ? "مكتبة مسابقات جاهزة للزوار والطلاب — شاركها برابط أو رمز."
                : "Ready-made quizzes for visitors and students — share by link or PIN."}
            </p>
          </div>
          <ChevronLeft
            className={`w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors ${lang === "ar" ? "" : "rotate-180"}`}
          />
        </div>
      </Card>

      <GameCatalogSection
        title={
          lang === "ar"
            ? "مسابقات حية مع الصفّ"
            : "Live classroom games"
        }
        subtitle={
          lang === "ar"
            ? "ألعاب جماعية بوقت حقيقي — اربط واجباتك أو أنشئ غرفة وشارك الرمز أو الرابط مع الطلاب."
            : "Real-time whole-class modes — tie to assignments or create a room and share PIN/link."
        }
        accentClass="text-primary"
        games={liveGames}
        delayOffset={0}
      />

      {/* ── Modal: وميض — اختر الواجب ── */}
      <AnimatePresence>
        {showWameethModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowWameethModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-card w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-border/60 bg-gradient-to-r from-fuchsia-500/10 to-purple-600/10 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚡</span>
                  <div>
                    <h3 className="text-lg font-black text-foreground">
                      {lang === "ar" ? "وميض — ابدأ مسابقة حية" : "Wameeth — Start a Live Quiz"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lang === "ar"
                        ? "اختر الواجب الذي تريد استخدام أسئلته"
                        : "Pick an assignment to power your live room"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWameethModal(false)}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-4 sm:p-5">
                {mcqAssignments.length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="text-5xl mb-4 block">📭</span>
                    <h4 className="font-bold text-foreground mb-2">
                      {lang === "ar" ? "لا توجد واجبات بأسئلة" : "No assignments with questions"}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      {lang === "ar"
                        ? "أنشئ واجباً يحتوي أسئلة اختيار من متعدد أولاً"
                        : "Create an assignment with MCQ questions first"}
                    </p>
                    <button
                      onClick={() => { setShowWameethModal(false); setLocation("/teacher/new"); }}
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      {lang === "ar" ? "إنشاء واجب" : "Create assignment"}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mcqAssignments.map((assignment: any) => (
                      <button
                        key={assignment.id}
                        onClick={() => {
                          setShowWameethModal(false);
                          startGame(assignment.id);
                        }}
                        disabled={creatingGameForId === assignment.id}
                        className="text-start p-4 rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-md transition-all group disabled:opacity-60"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center shrink-0 group-hover:bg-fuchsia-500/20 transition-colors">
                            <Gamepad2 className="w-5 h-5 text-fuchsia-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate text-sm">
                              {assignment.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {assignment.subject} · {assignment.questionCount} {lang === "ar" ? "سؤال" : "questions"}
                            </p>
                          </div>
                          <ChevronLeft className={`w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors ${lang === "ar" ? "" : "rotate-180"}`} />
                        </div>
                        {creatingGameForId === assignment.id && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-primary font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {lang === "ar" ? "جاري الإنشاء..." : "Creating..."}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Safe area spacer for mobile */}
              <div className="h-2 sm:h-0 shrink-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* وميض: اختيار الواجب — مباشرة تحت بطاقات المسابقات الحية */}
      <div
        ref={wameethPickerRef}
        id="wameeth-assignment-picker"
        className="scroll-mt-28"
      >
        <AnimatePresence>
          {showKnowledgeRace && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 pb-2">
                <Card className="p-4 sm:p-6 border-2 border-primary/25 bg-primary/[0.03] shadow-lg">
                  <h3 className="text-lg font-black text-foreground mb-1 flex items-center gap-2">
                    <Gamepad2 className="w-6 h-6 text-primary shrink-0" />
                    {lang === "ar"
                      ? "وميض — اختر الواجب وابدأ المسابقة الحية"
                      : "Wameeth — pick an assignment to host"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    {lang === "ar"
                      ? "كل واجب يحتوي أسئلة اختيار من متعدد يمكن استخدامه في الغرفة الحية. بعد الاختيار ستُفتح نافذة إعداد الفرق ثم مشاركة الرمز مع الطلاب."
                      : "Any assignment with MCQs can power your live room. After you pick one, you'll set teams/solo mode then share the PIN."}
                  </p>
                  {mcqAssignments.length === 0 ? (
                    <Card className="py-12 text-center border-dashed border-primary/30 bg-muted/20">
                      <Gamepad2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <h4 className="text-lg font-bold text-foreground mb-1">
                        {t.dashboard.noMcqAssignments}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t.dashboard.noMcqDesc}
                      </p>
                      <Button
                        onClick={() => setLocation("/teacher/new")}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {t.dashboard.createNew}
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {mcqAssignments.map((assignment: any, i: number) => (
                        <motion.div
                          key={assignment.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <Card className="p-4 sm:p-5 hover:border-primary/40 hover:shadow-md transition-all group border-border">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                  {assignment.title}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {assignment.subject} — {assignment.questionCount}{" "}
                                  {t.dashboard.questionsCount}
                                </p>
                              </div>
                              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                                <Gamepad2 className="w-4 h-4" />
                              </div>
                            </div>
                            <button
                              onClick={() => startGame(assignment.id)}
                              disabled={
                                creatingGameForId === assignment.id
                              }
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-emerald-700 text-primary-foreground rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
                            >
                              <Gamepad2 className="w-4 h-4" />
                              {creatingGameForId === assignment.id
                                ? t.dashboard.creating
                                : lang === "ar"
                                  ? "اختر اللعبة وابدأ"
                                  : "Choose game & start"}
                            </button>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GameCatalogSection
        title={
          lang === "ar"
            ? "تحديات ذكاء فردية"
            : "Solo brain challenges"
        }
        subtitle={
          lang === "ar"
            ? "تمارين تركيز وذاكرة ولغة للعب الذاتي أو مسابقات الزوار — بدون غرفة صفّية كاملة."
            : "Focus, memory, and language drills for solo play or visitor quizzes — no full live room required."
        }
        accentClass="text-foreground"
        games={soloGames}
        delayOffset={liveGames.length}
      />

    </div>
  );
}

function ToolsTab({ t, lang, setLocation, user, classroomEnabled }: any) {
  const isAr = lang === "ar";

  // Brand palette for tools — green primary, gold accent, warm white bg
  const BRAND = { green: "#225739", gold: "#D9A521", light: "#FCFAF8" };

  const toolGroups = [
    {
      // AI generators grouped at the top so the teacher sees every
      // "create something with AI" entry point side-by-side. Renders
      // in the same 4-up grid as the other groups so the cards line up.
      groupId: "ai-tools",
      groupTitle: isAr ? "أدوات الذكاء الاصطناعي" : "AI Tools",
      groupIcon: <Sparkles className="w-4 h-4" />,
      tools: [
        {
          icon: <Sparkles className="w-6 h-6" />,
          title: t.dashboard.toolAiGenerator,
          desc: t.dashboard.toolAiGeneratorDesc,
          accent: BRAND.gold,
          href: "/teacher/new/assignment",
        },
        {
          icon: <BookOpen className="w-6 h-6" />,
          title: isAr ? "مولّد خطط الدروس" : "Lesson Plan Generator",
          desc: isAr
            ? "خطّط حصّة كاملة بأهداف وأنشطة وتقويم بمساعدة الذكاء الاصطناعي"
            : "Plan a full class with objectives, activities, and assessment using AI",
          accent: BRAND.gold,
          href: "/teacher/lesson-plans/create",
        },
        {
          icon: <FileText className="w-6 h-6" />,
          title: isAr ? "مولّد ورقة العمل" : "Worksheet Generator",
          desc: isAr
            ? "صمّم ورقة عمل احترافية للطباعة بمساعدة الذكاء الاصطناعي"
            : "Design a print-ready worksheet with AI assistance",
          accent: BRAND.gold,
          href: "/teacher/worksheets/create",
        },
        {
          icon: <Brain className="w-6 h-6" />,
          title: isAr ? "مولّد الخرائط الذهنية" : "Mind Map Generator",
          desc: isAr
            ? "حوّل أي موضوع أو درس إلى خريطة ذهنية بصرية رائعة بضغطة واحدة"
            : "Turn any topic or lesson into a stunning visual mind map in one click",
          accent: BRAND.gold,
          href: "/teacher/mindmap/create",
        },
        {
          icon: <Video className="w-6 h-6" />,
          title: isAr ? "درس فيديو تفاعلي" : "Interactive Video Lesson",
          desc: isAr
            ? "أنشئ درساً بأسئلة تتوقف تلقائياً أثناء الفيديو"
            : "Create a lesson with auto-pausing questions during the video",
          accent: BRAND.gold,
          href: "/teacher/video-lesson/new",
        },
        {
          icon: <Monitor className="w-6 h-6" />,
          title: isAr ? "العروض التفاعلية" : "Interactive Presentations",
          desc: isAr
            ? "أنشئ عروضاً تقديمية تفاعلية لطلابك في الفصل"
            : "Build interactive slide decks for your classroom",
          accent: BRAND.gold,
          href: "/teacher/presentations",
        },
      ],
    },
    {
      groupId: "content",
      groupTitle: isAr ? "تنظيم المحتوى" : "Content Library",
      groupIcon: <Database className="w-4 h-4" />,
      tools: [
        {
          icon: <Database className="w-6 h-6" />,
          title: t.dashboard.toolQuestionBank,
          desc: t.dashboard.toolQuestionBankDesc,
          accent: BRAND.green,
          href: "/teacher/question-bank",
        },
        {
          icon: <FolderOpen className="w-6 h-6" />,
          title: t.dashboard.toolCollections,
          desc: t.dashboard.toolCollectionsDesc,
          accent: BRAND.green,
          href: "/teacher/collections",
        },
        {
          icon: <Tag className="w-6 h-6" />,
          title: t.dashboard.toolCategories,
          desc: t.dashboard.toolCategoriesDesc,
          accent: BRAND.green,
          href: "/teacher/categories",
        },
        {
          icon: <Sparkles className="w-6 h-6" />,
          title: isAr ? (isAdmin ? "محتوى تحدي حصاد" : "فئاتي في تحدي حصاد") : (isAdmin ? "Hasad Arena Content" : "My Arena Categories"),
          desc: isAr
            ? (isAdmin
                ? "أدر أقسام وأسئلة تحدي حصاد مع الصور والتوليد بالذكاء"
                : "أنشئ فئاتك وأسئلتك الخاصة في تحدي حصاد — تبقى في حسابك")
            : (isAdmin
                ? "Manage Arena sections, sub-categories & questions with images and AI"
                : "Create your own private Arena categories and questions"),
          accent: BRAND.green,
          href: "/teacher/arena-content",
        },
        {
          icon: <Library className="w-6 h-6" />,
          title: isAr ? "مكتبة المعلم" : "Teacher Library",
          desc: isAr
            ? "ارفع وأدر كتبك وأوراق عملك وخطط دروسك"
            : "Upload and manage your books, worksheets & lesson plans",
          accent: BRAND.green,
          href: "/teacher/library",
        },
        {
          icon: <Globe className="w-6 h-6" />,
          title: isAr ? "المحتوى المشترك" : "Shared Content",
          desc: isAr
            ? "تصفح واجبات وأسئلة ومسابقات المعلمين الآخرين"
            : "Browse assignments, questions & games from other teachers",
          accent: BRAND.green,
          href: "/teacher/library/homework",
        },
      ],
    },
    {
      groupId: "students",
      groupTitle: isAr ? "إدارة الطلاب" : "Student Management",
      groupIcon: <Users className="w-4 h-4" />,
      tools: [
        {
          icon: <Users className="w-6 h-6" />,
          title: t.dashboard.toolStudents,
          desc: t.dashboard.toolStudentsDesc,
          accent: BRAND.green,
          href: "/teacher/students",
        },
        ...(classroomEnabled ? [{
          icon: <GraduationCap className="w-6 h-6" />,
          title: isAr ? "Google Classroom" : "Google Classroom",
          desc: isAr
            ? "استيراد الطلاب ونشر الواجبات ومزامنة الدرجات"
            : "Import students, publish assignments & sync grades",
          accent: "#4285F4",
          href: "/teacher/classroom",
        }] : []),
        {
          icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="5" fill="#5059C9" />
              <path d="M14.5 8.5C14.5 9.88 13.38 11 12 11C10.62 11 9.5 9.88 9.5 8.5C9.5 7.12 10.62 6 12 6C13.38 6 14.5 7.12 14.5 8.5Z" fill="white" />
              <path d="M16 11H8C7.45 11 7 11.45 7 12V16.5C7 17.05 7.45 17.5 8 17.5H16C16.55 17.5 17 17.05 17 16.5V12C17 11.45 16.55 11 16 11Z" fill="white" />
              <circle cx="17.5" cy="8" r="2.5" fill="#7B83EB" />
              <path d="M19.5 10.5H15.5V14C15.5 14.83 16.17 15.5 17 15.5H18C19.1 15.5 20 14.6 20 13.5V11C20 10.72 19.78 10.5 19.5 10.5Z" fill="#7B83EB" />
            </svg>
          ),
          title: isAr ? "Microsoft Teams" : "Microsoft Teams",
          desc: isAr
            ? "استيراد الطلاب ونشر الواجبات عبر Teams"
            : "Import students, publish assignments via Teams",
          accent: "#5059C9",
          href: "/teacher/teams",
        },
      ],
    },
    {
      groupId: "other",
      groupTitle: isAr ? "أخرى" : "Other",
      groupIcon: <MessageSquarePlus className="w-4 h-4" />,
      tools: [
        {
          icon: <MessageSquarePlus className="w-6 h-6" />,
          title: t.dashboard.toolFeedback,
          desc: t.dashboard.toolFeedbackDesc,
          accent: BRAND.green,
          href: "/feedback",
        },
        ...(user?.isAdmin
          ? [
              {
                icon: <Crown className="w-6 h-6" />,
                title: isAr ? "لوحة المسؤول" : "Admin Panel",
                desc: isAr
                  ? "إدارة المعلمين والطلاب ومراقبة المنصة"
                  : "Manage teachers, students & monitor platform",
                accent: BRAND.gold,
                href: "/teacher/admin",
              },
            ]
          : []),
      ],
    },
  ].filter((g) => g.tools.length > 0);

  const ChevronEnd = isAr ? ArrowLeft : ArrowRight;
  let globalIdx = 0;

  return (
    <div className="space-y-9 sm:space-y-12">
      {/* Header — left-aligned on desktop, centered on mobile for a more
          professional feel than the centered icon-stack of before. */}
      <div className="flex items-center gap-3 sm:gap-4 px-1">
        <div
          className="inline-flex w-11 h-11 sm:w-12 sm:h-12 rounded-2xl items-center justify-center shrink-0"
          style={{ background: "rgba(34,87,57,0.10)", color: BRAND.green }}
        >
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-extrabold text-foreground leading-tight">
            {t.dashboard.toolsTitle}
          </h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug mt-0.5">
            {isAr
              ? "كل الأدوات التي تحتاجها لإدارة فصلك وإثراء تجربة الطلاب"
              : "Everything you need to manage your class and enrich student experience"}
          </p>
        </div>
      </div>

      {toolGroups.map((group) => (
        <section key={group.groupId}>
          {/* Group header — clean, left-aligned with a soft accent
              underline. Reads more like a Notion/Linear section than a
              decorative chip-in-a-divider. */}
          <div className="flex items-end justify-between gap-3 mb-4 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(34,87,57,0.08)", color: BRAND.green }}
              >
                {group.groupIcon}
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground truncate">
                {group.groupTitle}
              </h3>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: "rgba(34,87,57,0.08)", color: BRAND.green }}
              >
                {group.tools.length}
              </span>
            </div>
            <div
              className="flex-1 h-px mb-2 hidden sm:block"
              style={{ background: "rgba(34,87,57,0.12)" }}
            />
          </div>

          {/* Auto-fit grid — cards stretch to fill the row no matter how
              many there are, so an odd count (3 or 5) doesn't leave an
              awkward visual gap like a fixed 4-column layout would. The
              `min(100%, 240px)` lower bound keeps cards comfortably
              wide on mobile (single column) without breaking on tiny
              viewports. */}
          <div
            className="grid gap-3 sm:gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            }}
          >
            {group.tools.map((tool) => {
              const delay = globalIdx++ * 0.025;
              const isAi = group.groupId === "ai-tools";
              // AI cards wear the brand gold as a subtle gradient border
              // + faint warm tint, with a tiny sparkle in the corner.
              // Other cards stay quiet — just a hairline border.
              // Stronger, identity-clear borders: bold gold for AI,
              // bold dark green for everything else. Each card's edge
              // immediately reads as "AI" or "platform".
              const restBorder = isAi
                ? "rgba(217,165,33,0.75)"
                : "rgba(34,87,57,0.55)";
              const hoverBorder = isAi
                ? BRAND.gold
                : tool.accent === BRAND.green
                  ? BRAND.green
                  : tool.accent;
              return (
                <motion.button
                  key={tool.href}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay, duration: 0.22 }}
                  onClick={() => tool.href && setLocation(tool.href)}
                  className="group relative flex items-start gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-xl border bg-card/60 text-start transition-colors duration-200 hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 min-h-[96px] overflow-hidden"
                  style={{
                    borderColor: restBorder,
                    background: isAi
                      ? "linear-gradient(135deg, rgba(217,165,33,0.05) 0%, rgba(252,250,248,0) 55%)"
                      : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = hoverBorder;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = restBorder;
                  }}
                >
                  {/* AI sparkle — only on AI tool cards. Sits in the
                      top corner opposite the icon as a subtle "made
                      with AI" mark. Brightens on hover. */}
                  {isAi && (
                    <span
                      className={`absolute top-2 ${isAr ? "left-2" : "right-2"} text-[#D9A521]/40 group-hover:text-[#D9A521] transition-all duration-300 group-hover:rotate-12`}
                      aria-hidden
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                  )}

                  {/* Icon — slightly stronger gold tint on AI cards so
                      it reads as "AI" without being heavy. */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200"
                    style={{
                      color: tool.accent,
                      background: `${tool.accent}${isAi ? "14" : "0A"}`,
                    }}
                  >
                    {tool.icon}
                  </div>

                  <div className="relative flex-1 min-w-0 pt-0.5">
                    <h4 className="font-bold text-foreground text-sm sm:text-[14.5px] leading-snug line-clamp-2 mb-1">
                      {tool.title}
                    </h4>
                    {tool.desc && (
                      <p className="text-[11.5px] sm:text-xs text-muted-foreground/90 leading-relaxed line-clamp-2">
                        {tool.desc}
                      </p>
                    )}
                  </div>

                  <span
                    className="shrink-0 self-center text-muted-foreground/40 group-hover:text-foreground transition-colors duration-200"
                  >
                    <ChevronEnd className="w-4 h-4" />
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Students Inline Tab ──────────────────────────────────
function StudentsInlineTab({ lang, setLocation }: { lang: string; setLocation: (p: string) => void }) {
  const isAr = lang === "ar";
  const BASE = (import.meta as any).env?.VITE_API_URL || "";
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/teacher/classes`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => { setClasses(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(34,87,57,0.10)", color: "#225739" }}>
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-extrabold text-foreground text-base truncate">{isAr ? "صفوفي وطلابي" : "My Classes & Students"}</h2>
            <p className="text-xs text-muted-foreground truncate">{isAr ? "إدارة الصفوف والطلاب" : "Manage classes and students"}</p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/teacher/students")}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-bold transition-all hover:opacity-90 shrink-0"
          style={{ background: "#225739", color: "#FCFAF8" }}
        >
          <Users className="w-4 h-4" />
          {isAr ? "إدارة الطلاب" : "Manage"}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-bold text-foreground mb-1">{isAr ? "لا توجد صفوف بعد" : "No classes yet"}</p>
          <button onClick={() => setLocation("/teacher/students")} className="px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white mt-2" style={{ background: "#225739" }}>
            {isAr ? "أضف صفاً جديداً" : "Add class"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {classes.map((cls: any) => (
            <button key={cls.name} onClick={() => setLocation(`/teacher/students?class=${encodeURIComponent(cls.name)}`)}
              className="group text-start p-4 min-h-[44px] rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden relative"
            >
              <div className="absolute top-0 inset-x-0 h-[2.5px] rounded-t-xl" style={{ background: "#225739" }} />
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "rgba(34,87,57,0.10)", color: "#225739" }}>
                <Users className="w-4 h-4" />
              </div>
              <p className="font-bold text-xs text-foreground truncate">{cls.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{cls.studentCount || 0} {isAr ? "طالب" : "students"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsTab({
  assignments,
  totalSubmissions,
  activeAssignments,
  expiredAssignments,
  avgSubmissions,
  t,
  lang,
}: any) {
  const [advancedStats, setAdvancedStats] = useState<any>(null);
  const BASE = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    if (assignments && assignments.length > 0) {
      fetch(`${BASE}/api/teacher/stats`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setAdvancedStats(data))
        .catch(() => {});
    }
  }, [assignments]);

  if (!assignments || assignments.length === 0) {
    return (
      <Card className="py-16 text-center border-dashed">
        <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">
          {t.dashboard.noStatsYet}
        </h3>
        <p className="text-muted-foreground">{t.dashboard.noStatsDesc}</p>
      </Card>
    );
  }

  const statCards = [
    {
      label: t.dashboard.totalAssignments,
      value: assignments.length,
      icon: <BookText className="w-5 h-5" />,
      color: "text-primary bg-primary/10",
    },
    {
      label: t.dashboard.totalSubmissions,
      value: totalSubmissions,
      icon: <Users className="w-5 h-5" />,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: t.dashboard.statsAvgSubmissions,
      value: avgSubmissions,
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: t.dashboard.statsActiveAssignments,
      value: activeAssignments.length,
      icon: <Clock className="w-5 h-5" />,
      color: "text-green-600 bg-green-50",
    },
    {
      label: t.dashboard.statsExpiredAssignments,
      value: expiredAssignments.length,
      icon: <Calendar className="w-5 h-5" />,
      color: "text-red-500 bg-red-50",
    },
    {
      label: t.dashboard.statsCompletionRate,
      value:
        assignments.length > 0
          ? `${Math.round((assignments.filter((a: any) => a.submissionCount > 0).length / assignments.length) * 100)}%`
          : "—",
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: "text-amber-600 bg-amber-50",
    },
  ];

  const GRADE_COLORS = [
    "#10b981",
    "#22c55e",
    "#84cc16",
    "#f59e0b",
    "#f97316",
    "#ef4444",
  ];
  const strongest = advancedStats?.studentRanking?.[0];
  const weakest =
    advancedStats?.studentRanking?.length > 1
      ? advancedStats.studentRanking[advancedStats.studentRanking.length - 1]
      : null;

  return (
    <div>
      <div className="text-center py-4 mb-4">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl mb-4"
        >
          <BarChart3 className="w-10 h-10 text-blue-600" />
        </motion.div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-2">
          {t.dashboard.statsTitle}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {statCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="p-4 sm:p-5 text-center">
              <div
                className={cn(
                  "p-2.5 rounded-xl w-fit mx-auto mb-3",
                  card.color,
                )}
              >
                {card.icon}
              </div>
              <p className="text-2xl sm:text-3xl font-black text-foreground mb-1">
                {card.value}
              </p>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                {card.label}
              </p>
            </Card>
          </motion.div>
        ))}
      </div>

      {advancedStats?.gradeDistribution?.some((g: any) => g.count > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {lang === "ar" ? "توزيع الدرجات" : "Grade Distribution"}
            </h3>
            <div style={{ width: "100%", height: 280 }} dir="ltr">
              <ResponsiveContainer>
                <BarChart
                  data={advancedStats.gradeDistribution}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [
                      value,
                      lang === "ar" ? "طلاب" : "Students",
                    ]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {advancedStats.gradeDistribution.map(
                      (_: any, index: number) => (
                        <Cell
                          key={index}
                          fill={GRADE_COLORS[index % GRADE_COLORS.length]}
                        />
                      ),
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      )}

      {(strongest || weakest) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {strongest && (
              <Card className="p-5 border-green-200 bg-green-50/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-green-100 text-green-600">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-600">
                      {lang === "ar" ? "الأقوى أداءً" : "Top Performer"}
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {strongest.name}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "متوسط الدرجات" : "Average Score"}:{" "}
                  <strong className="text-green-600">
                    {strongest.avgScore}%
                  </strong>
                  <span className="mx-2">·</span>
                  {strongest.submissions}{" "}
                  {lang === "ar" ? "تسليم" : "submissions"}
                </p>
              </Card>
            )}
            {weakest && (
              <Card className="p-5 border-orange-200 bg-orange-50/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-600">
                      {lang === "ar" ? "يحتاج متابعة" : "Needs Attention"}
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {weakest.name}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "متوسط الدرجات" : "Average Score"}:{" "}
                  <strong className="text-orange-600">
                    {weakest.avgScore}%
                  </strong>
                  <span className="mx-2">·</span>
                  {weakest.submissions}{" "}
                  {lang === "ar" ? "تسليم" : "submissions"}
                </p>
              </Card>
            )}
          </div>
        </motion.div>
      )}

      {advancedStats?.submissionTimeline?.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-600" />
              {lang === "ar" ? "الأداء عبر الزمن" : "Performance Over Time"}
            </h3>
            <div style={{ width: "100%", height: 280 }} dir="ltr">
              <ResponsiveContainer>
                <AreaChart
                  data={advancedStats.submissionTimeline}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 13,
                    }}
                    formatter={(value: number, name: string) => [
                      name === "avgScore" ? `${value}%` : value,
                      name === "avgScore"
                        ? lang === "ar"
                          ? "متوسط الدرجة"
                          : "Avg Score"
                        : lang === "ar"
                          ? "التسليمات"
                          : "Submissions",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgScore"
                    stroke="#8b5cf6"
                    fill="#8b5cf680"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      )}

      {advancedStats?.studentRanking?.length > 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-blue-600" />
              {lang === "ar" ? "ترتيب الطلاب" : "Student Ranking"}
            </h3>
            <div className="space-y-2">
              {advancedStats.studentRanking
                .slice(0, 10)
                .map((s: any, i: number) => (
                  <div key={s.name} className="flex items-center gap-3 py-2">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                        i === 0
                          ? "bg-amber-100 text-amber-700"
                          : i === 1
                            ? "bg-muted text-muted-foreground"
                            : i === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">
                        {s.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.submissions}{" "}
                        {lang === "ar" ? "تسليم" : "submissions"}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-sm font-black",
                        s.avgScore >= 80
                          ? "bg-green-100 text-green-700"
                          : s.avgScore >= 60
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700",
                      )}
                    >
                      {s.avgScore}%
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </motion.div>
      )}

      {assignments.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t.dashboard.myAssignments}
          </h3>
          <div className="space-y-2">
            {assignments.map((a: any, i: number) => {
              const maxSub = Math.max(
                ...assignments.map((x: any) => x.submissionCount),
                1,
              );
              const pct =
                a.submissionCount > 0
                  ? Math.round((a.submissionCount / maxSub) * 100)
                  : 0;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: lang === "ar" ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link href={`/teacher/assignment/${a.id}`}>
                    <Card className="p-3 sm:p-4 hover:border-primary/40 cursor-pointer transition-all group">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                            {a.subject}
                          </span>
                          <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {a.title}
                          </span>
                        </div>
                        <span className="text-sm font-black text-primary shrink-0">
                          {a.submissionCount} {t.dashboard.submission}
                        </span>
                      </div>
                      <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                        />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SharedTab({
  assignments,
  isLoading,
  lang,
  importingIds,
  importedIds,
  importAssignment,
  creatingGameForId,
  startGame,
}: {
  assignments: SharedAssignment[];
  isLoading: boolean;
  lang: string;
  importingIds: Set<number>;
  importedIds: Set<number>;
  importAssignment: (id: number, e?: React.MouseEvent) => void;
  creatingGameForId: number | null;
  startGame: (id: number, e?: React.MouseEvent) => void;
}) {
  const [search, setSearch] = useState("");
  const isRtl = lang === "ar";
  const filtered = assignments.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.teacherName ?? "").includes(search),
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="p-5 border-border/40 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="h-5 w-48 bg-muted/60 rounded-md" />
                <div className="h-4 w-32 bg-muted/30 rounded" />
              </div>
              <div className="h-8 w-28 bg-muted/40 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card className="py-16 text-center border-dashed">
        <Globe className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">
          {lang === "ar"
            ? "لا توجد مسابقات مشتركة بعد"
            : "No shared assignments yet"}
        </h3>
        <p className="text-muted-foreground text-sm">
          {lang === "ar"
            ? "عندما يشارك المعلمون واجباتهم للعموم، ستظهر هنا"
            : "When teachers share assignments publicly, they'll appear here"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2 border border-border/40">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            lang === "ar"
              ? "ابحث باسم الواجب أو المعلم..."
              : "Search by title or teacher..."
          }
          className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
          dir={isRtl ? "rtl" : "ltr"}
        />
      </div>
      {filtered.length === 0 ? (
        <Card className="py-10 text-center border-dashed">
          <p className="text-muted-foreground text-sm">
            {lang === "ar" ? "لا توجد نتائج" : "No results"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {filtered.map((a: SharedAssignment, i: number) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {a.subject && (
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-bold rounded-md shrink-0">
                        {a.subject}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-foreground truncate">
                      {a.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {!a.isAdminContent && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {a.teacherName || (lang === "ar" ? "معلم" : "Teacher")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BookText className="w-3 h-3" />
                      {a.questionCount} {lang === "ar" ? "سؤال" : "Q"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                  {a.questionCount > 0 && (
                    <button
                      onClick={(e) => startGame(a.id, e)}
                      disabled={creatingGameForId === a.id}
                      className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      {creatingGameForId === a.id
                        ? lang === "ar"
                          ? "جارٍ الإنشاء..."
                          : "Creating..."
                        : lang === "ar"
                          ? "لعبة مباشرة"
                          : "Live Game"}
                    </button>
                  )}
                  <button
                    onClick={(e) => importAssignment(a.id, e)}
                    disabled={importingIds.has(a.id) || importedIds.has(a.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl font-bold text-xs border-2 transition-all whitespace-nowrap ${importedIds.has(a.id) ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-primary/40 hover:border-primary text-primary hover:bg-primary/5"} disabled:opacity-60`}
                  >
                    {importingIds.has(a.id) ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {lang === "ar" ? "جارٍ الاستيراد..." : "Importing..."}
                      </>
                    ) : importedIds.has(a.id) ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lang === "ar" ? "تم الاستيراد ✓" : "Imported ✓"}
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        {lang === "ar" ? "استيراد إلى مسابقاتي" : "Import"}
                      </>
                    )}
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Mockup-style Section (collapsible card) ── */
function Section({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-3 sm:px-5 sm:py-4 hover:bg-muted/40 transition-colors min-h-[44px]"
      >
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-foreground text-sm">{title}</span>
          {count !== undefined && (
            <span className="text-[11px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60" />
            <div className="px-3 py-3 sm:px-5 sm:py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Assignment Row (compact, expandable) ── */
function AssignmentRow({
  assignment,
  groupName,
  isExpanded,
  onToggle,
  creatingGameForId,
  startGame,
  deleteAssignment,
  setLocation,
  lang,
  t,
  queryClient,
  onShare,
  collections,
  addToCollection,
  removeFromCollection,
  creatingGroupName,
  setCreatingGroupName,
  createGroupAndAdd,
  savingGroup,
  isFavorite,
  onToggleFavorite,
}: any) {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const groupBtnRef = useRef<HTMLButtonElement>(null);

  const openGroupMenu = () => {
    if (groupBtnRef.current) {
      const r = groupBtnRef.current.getBoundingClientRect();
      const menuWidth = 240;
      const left =
        lang === "ar"
          ? Math.max(8, r.right - menuWidth)
          : Math.min(window.innerWidth - menuWidth - 8, r.left);
      setMenuPos({ top: r.bottom + 6, left });
    }
    setShowGroupMenu(true);
  };

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/x-assignment-id",
      String(assignment.id),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`rounded-xl border transition-all duration-150 ${isExpanded ? "border-border bg-muted/30" : "border-border/60 hover:border-border"} cursor-grab active:cursor-grabbing`}
    >
      <div className="w-full flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5 min-h-[56px]">
        <span
          className="hidden sm:inline-flex shrink-0 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors p-2 -m-2"
          title={lang === "ar" ? "اسحب إلى مجموعة" : "Drag to group"}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        <button
          type="button"
          onClick={onToggleFavorite}
          className="shrink-0 transition-all hover:scale-110 active:scale-95 inline-flex items-center justify-center min-w-[44px] min-h-[44px]"
          title={
            lang === "ar"
              ? isFavorite
                ? "إزالة من المفضلة"
                : "إضافة للمفضلة"
              : isFavorite
                ? "Remove from favorites"
                : "Add to favorites"
          }
        >
          <Star
            className={`w-4 h-4 transition-colors ${isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-400"}`}
          />
        </button>
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 min-h-[44px] flex items-center gap-2 text-start"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground truncate">
                {assignment.title}
              </span>
              {assignment.subject && (
                <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {assignment.subject}
                </span>
              )}
              {groupName && (
                <span className="text-[11px] text-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 px-2 py-0.5 rounded-md">
                  {groupName}
                </span>
              )}
              {assignment.deadline &&
                new Date(assignment.deadline) < new Date() && (
                  <span className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-300 px-2 py-0.5 rounded-md">
                    {t.dashboard.deadlineExpired}
                  </span>
                )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {assignment.questionCount} {t.dashboard.question} ·{" "}
              {assignment.submissionCount} {t.dashboard.submission}
            </p>
          </div>
        </button>
        {assignment.questionCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              startGame(assignment.id, e);
            }}
            disabled={creatingGameForId === assignment.id}
            className="shrink-0 text-xs font-bold px-3 py-2 min-h-[44px] min-w-[44px] text-white rounded-lg transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shadow-sm hover:brightness-110 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#1f8246 0%,#155d32 100%)", boxShadow: "0 4px 12px -4px rgba(27,107,63,0.45)" }}
            title={t.dashboard.liveGame}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {creatingGameForId === assignment.id
                ? t.dashboard.creating
                : t.dashboard.liveGame}
            </span>
          </button>
        )}
        <button
          onClick={onToggle}
          className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-muted/60 transition-colors"
          aria-label="toggle"
        >
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground/70 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60" />
            <div className="px-3 py-3 sm:px-4 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setLocation(`/teacher/assignment/${assignment.id}`)
                }
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                {lang === "ar" ? "تعديل" : "Edit"}
              </button>
              <button
                onClick={() =>
                  setLocation(`/teacher/assignment/${assignment.id}`)
                }
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                {lang === "ar" ? "النتائج" : "Results"}
              </button>
              <button
                onClick={async () => {
                  try {
                    const url = `${window.location.origin}/solve/${assignment.id}`;
                    await navigator.clipboard.writeText(url);
                    toast.success(
                      lang === "ar"
                        ? "تم نسخ رابط الواجب"
                        : "Assignment link copied",
                    );
                  } catch {
                    toast.error(lang === "ar" ? "تعذر النسخ" : "Copy failed");
                  }
                }}
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {lang === "ar" ? "نسخ رابط الواجب" : "Copy assignment link"}
              </button>
              <button
                onClick={() => onShare(assignment.id)}
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                {lang === "ar" ? "مشاركة" : "Share"}
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `${BASE_URL}/api/assignments/${assignment.id}/duplicate`,
                      {
                        method: "POST",
                        credentials: "include",
                      },
                    );
                    if (res.ok) {
                      toast.success(
                        lang === "ar" ? "تم نسخ الواجب" : "Duplicated",
                      );
                      queryClient?.invalidateQueries({
                        queryKey: ["/api/assignments"],
                      });
                    } else {
                      toast.error(
                        lang === "ar" ? "خطأ في النسخ" : "Duplication failed",
                      );
                    }
                  } catch {
                    toast.error(
                      lang === "ar" ? "خطأ في النسخ" : "Duplication failed",
                    );
                  }
                }}
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {lang === "ar" ? "تكرار" : "Duplicate"}
              </button>
              <button
                ref={groupBtnRef}
                onClick={(e) => {
                  e.stopPropagation();
                  openGroupMenu();
                }}
                className={`text-xs font-medium px-3 py-2 min-h-[44px] border rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                  collections?.some((c: any) =>
                    c.assignmentIds?.includes(assignment.id),
                  )
                    ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800"
                    : "bg-card text-foreground border-border hover:border-foreground/40"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {lang === "ar" ? "مجموعة" : "Group"}
              </button>
              {showGroupMenu &&
                menuPos &&
                createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[100]"
                      onClick={() => setShowGroupMenu(false)}
                    />
                    <div
                      className="fixed w-60 bg-card border border-border rounded-xl shadow-2xl z-[101] p-2"
                      style={{ top: menuPos.top, left: menuPos.left }}
                      onClick={(e) => e.stopPropagation()}
                      dir={lang === "ar" ? "rtl" : "ltr"}
                    >
                      <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">
                        {lang === "ar" ? "المجموعات" : "Groups"}
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {(collections || []).map((col: any) => {
                          const inGroup = col.assignmentIds?.includes(
                            assignment.id,
                          );
                          return (
                            <button
                              key={col.id}
                              onClick={() =>
                                inGroup
                                  ? removeFromCollection(col.id, assignment.id)
                                  : addToCollection(col.id, assignment.id)
                              }
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-start ${
                                inGroup
                                  ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                  : "text-foreground hover:bg-muted"
                              }`}
                            >
                              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                              <span className="flex-1 truncate">
                                {col.name}
                              </span>
                              {inGroup && (
                                <Check className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                        {(!collections || collections.length === 0) && (
                          <p className="text-[11px] text-muted-foreground px-2 py-2 text-center">
                            {lang === "ar"
                              ? "لا توجد مجموعات بعد"
                              : "No groups yet"}
                          </p>
                        )}
                      </div>
                      <div className="border-t border-border mt-1.5 pt-1.5 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={creatingGroupName}
                          onChange={(e) => setCreatingGroupName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            createGroupAndAdd(assignment.id)
                          }
                          placeholder={
                            lang === "ar" ? "مجموعة جديدة..." : "New group..."
                          }
                          className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-border bg-muted/30 focus:outline-none focus:border-violet-400 min-w-0"
                          dir={lang === "ar" ? "rtl" : "ltr"}
                        />
                        <button
                          onClick={() => createGroupAndAdd(assignment.id)}
                          disabled={!creatingGroupName?.trim() || savingGroup}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>,
                  document.body,
                )}
              <button
                onClick={() => deleteAssignment(assignment.id)}
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-red-500 border border-border rounded-lg hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors inline-flex items-center gap-1.5 ms-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {lang === "ar" ? "حذف" : "Delete"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Group accordion row component ── */
function GroupAccordionRow({
  col,
  assignments,
  lang,
  expanded,
  onToggle,
  onEdit,
  onRemoveAssignment,
  addToCollection,
  creatingGameForId,
  startGame,
  setLocation,
  t,
}: any) {
  const colAssignments = (assignments || []).filter((a: any) =>
    (col.assignmentIds || []).includes(a.id),
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove(
      "ring-2",
      "ring-emerald-400",
    );
    const aid = parseInt(
      e.dataTransfer.getData("application/x-assignment-id") || "0",
    );
    if (!aid) return;
    if ((col.assignmentIds || []).includes(aid)) {
      toast.info(lang === "ar" ? "موجود بالفعل في المجموعة" : "Already in group");
      return;
    }
    addToCollection(col.id, aid);
  };

  return (
    <div
      className="rounded-xl border border-border overflow-hidden transition-all"
      onDrop={handleDrop}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-assignment-id")) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).classList.add(
            "ring-2",
            "ring-emerald-400",
          );
        }
      }}
      onDragLeave={(e) =>
        (e.currentTarget as HTMLElement).classList.remove(
          "ring-2",
          "ring-emerald-400",
        )
      }
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 select-none"
        onClick={onToggle}
      >
        {col.isPublic ? (
          <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <Lock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        )}
        <span className="flex-1 text-sm font-semibold text-foreground truncate">
          {col.name}
        </span>
        {col.isPublic && (
          <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md shrink-0">
            {lang === "ar" ? "عام" : "PUBLIC"}
          </span>
        )}
        <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground shrink-0">
          {col.assignmentIds?.length || 0}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="shrink-0 p-1 rounded-md hover:bg-muted/60 text-muted-foreground"
          title={lang === "ar" ? "تعديل" : "Edit"}
        >
          <Pencil className="w-3 h-3" />
        </button>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground/70 transition-transform duration-150 shrink-0 ${expanded ? "rotate-180" : ""}`}
        />
      </div>

      {/* Content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40">
              {colAssignments.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                  {lang === "ar"
                    ? "🎯 اسحب واجبًا من القائمة أدناه وأفلته هنا"
                    : "🎯 Drag an assignment from the list below and drop it here"}
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {colAssignments.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-muted/20"
                    >
                      <span className="flex-1 text-xs font-medium text-foreground truncate">
                        {a.title}
                      </span>
                      {a.subject && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md hidden sm:block shrink-0">
                          {a.subject}
                        </span>
                      )}
                      {a.questionCount > 0 && (
                        <button
                          onClick={() =>
                            startGame(a.id, {
                              stopPropagation: () => {},
                            } as any)
                          }
                          disabled={creatingGameForId === a.id}
                          className="shrink-0 p-1.5 rounded-md transition-all disabled:opacity-50 text-white hover:brightness-110"
                          style={{ background: "linear-gradient(135deg,#1f8246 0%,#155d32 100%)" }}
                          title={t?.dashboard?.liveGame || "تشغيل"}
                        >
                          <Gamepad2 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setLocation(`/teacher/assignments/${a.id}`)
                        }
                        className="shrink-0 p-1.5 hover:bg-muted/60 rounded-md text-muted-foreground"
                        title={lang === "ar" ? "فتح" : "Open"}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onRemoveAssignment(col.id, a.id)}
                        className="shrink-0 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-muted-foreground hover:text-red-500 transition-colors"
                        title={
                          lang === "ar"
                            ? "إزالة من المجموعة"
                            : "Remove from group"
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main mockup-style render ── */
function AssignmentsTabRender({
  assignments,
  filteredAssignments,
  collections,
  publicCollections,
  filterCollectionId,
  setFilterCollectionId,
  creatingGameForId,
  startGame,
  deleteAssignment,
  setLocation,
  setActiveTab,
  lang,
  t,
  queryClient,
  addToCollection,
  removeFromCollection,
  creatingGroupName,
  setCreatingGroupName,
  createGroupAndAdd,
  createGroup,
  savingGroup,
  user,
  reloadCollections,
}: any) {
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "expired" | "favorites"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupIsPublic, setNewGroupIsPublic] = useState(false);
  const [savingNewGroup, setSavingNewGroup] = useState(false);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(
    new Set(),
  );
  const [showPublicGroups, setShowPublicGroups] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("assignment_favorites");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("assignment_favorites", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setSavingNewGroup(true);
    try {
      const col = await createGroup(newGroupName.trim(), newGroupIsPublic);
      setShowNewGroupForm(false);
      setNewGroupName("");
      setNewGroupIsPublic(false);
      if (col?.id) {
        setExpandedGroupIds((prev) => new Set([...prev, col.id]));
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الإنشاء" : "Creation failed");
    } finally {
      setSavingNewGroup(false);
    }
  }

  const now = new Date();
  const statusFiltered = filteredAssignments.filter((a: any) => {
    if (statusFilter === "favorites" && !favorites.has(a.id)) return false;
    if (statusFilter === "active" && a.deadline && new Date(a.deadline) < now)
      return false;
    if (
      statusFilter === "expired" &&
      (!a.deadline || new Date(a.deadline) >= now)
    )
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (a.title || "").toLowerCase().includes(q) ||
        (a.subject || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const groupNameById = (id: number) => {
    const col = collections.find((c: any) => c.assignmentIds?.includes(id));
    return col?.name;
  };

  const onShare = async (id: number) => {
    try {
      const url = `${window.location.origin}/solve/${id}`;
      await navigator.clipboard.writeText(url);
      toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied");
    } catch {
      toast.error(lang === "ar" ? "تعذر النسخ" : "Copy failed");
    }
  };

  const games = [
    {
      type: "hack",
      title: lang === "ar" ? "لعبة الاختراق" : "Hack Game",
      desc:
        lang === "ar"
          ? "ماراثون اختراق: كلمات سر، صناديق غامضة، وسحب نقاط الخصوم"
          : "Hack marathon: passwords, mystery boxes, and stealing opponents' points",
      icon: Gamepad2,
    },
    {
      type: "knowledge_race",
      title: lang === "ar" ? "وميض" : "Wameeth",
      desc: lang === "ar" ? "لعبة جماعية سريعة" : "Live group game",
      icon: Zap,
      tag: lang === "ar" ? "شائع" : "Popular",
    },
    {
      type: "tug_of_war",
      title: lang === "ar" ? "شد الحبل" : "Tug of War",
      desc: lang === "ar" ? "فريقان يتنافسان" : "Two teams compete",
      icon: Swords,
    },
    {
      type: "rocket_race",
      title: lang === "ar" ? "سباق الصواريخ" : "Rocket Race",
      desc: lang === "ar" ? "سباق فردي للصواريخ" : "Individual rocket race",
      icon: Rocket,
      tag: lang === "ar" ? "جديد" : "New",
    },
    {
      type: "maraqui",
      title: lang === "ar" ? "مَراقي" : "Maraqui",
      desc: lang === "ar" ? "مراحل متدرجة الصعوبة" : "Progressive stages",
      icon: Mountain,
    },
    {
      type: "million",
      title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wants a Million?",
      desc: lang === "ar" ? "15 سؤالاً متدرجاً" : "15 escalating questions",
      icon: Coins,
    },
    {
      type: "color_game",
      title: lang === "ar" ? "لعبة الألوان" : "Color Game",
      desc: lang === "ar" ? "ابحث عن المربع المختلف" : "Find the odd square",
      icon: Palette,
    },
    {
      type: "video_lesson",
      title: lang === "ar" ? "فيديو تفاعلي" : "Interactive Video",
      desc: lang === "ar" ? "درس فيديو بأسئلة" : "Video lesson with questions",
      icon: Video,
    },
  ];

  const launchGame = (type: string) => {
    switch (type) {
      case "knowledge_race":
        setActiveTab?.("competitive");
        break;
      case "tug_of_war":
        setLocation("/game/tug/create");
        break;
      case "rocket_race":
        setLocation("/game/rocket/create");
        break;
      case "maraqui":
        setLocation("/game/maraqui");
        break;
      case "million":
        setLocation("/game/million");
        break;
      case "color_game":
        setLocation("/game/color");
        break;
      case "video_lesson":
        setLocation("/teacher/video-lesson/new");
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Assignments Section with create button in header ── */}
      <div className="flex items-center justify-end mb-0">
        <button
          onClick={() => setLocation("/teacher/new")}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          {lang === "ar" ? "إنشاء واجب / نشاط" : "New Assignment"}
        </button>
      </div>

      <Section
        title={
          lang === "ar" ? "الواجبات والمسابقات" : "Assignments & Competitions"
        }
        count={filteredAssignments.length}
        defaultOpen
      >
        {/* ── Groups Section ── */}
        <div className="mb-4 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-violet-500" />
              {lang === "ar" ? "مجموعاتي" : "My Groups"}
              {collections.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  ({collections.length})
                </span>
              )}
            </h3>
            <button
              onClick={() => setShowNewGroupForm((v: boolean) => !v)}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" />
              {lang === "ar" ? "مجموعة جديدة" : "New Group"}
            </button>
          </div>

          {/* New Group inline form */}
          <AnimatePresence>
            {showNewGroupForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-dashed border-violet-300 bg-violet-50 dark:bg-violet-900/20">
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleCreateGroup()
                    }
                    placeholder={
                      lang === "ar" ? "اسم المجموعة..." : "Group name..."
                    }
                    autoFocus
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm"
                  />
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={newGroupIsPublic}
                      onChange={(e) => setNewGroupIsPublic(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-600"
                    />
                    <Globe className="w-3 h-3 text-emerald-600" />
                    <span>{lang === "ar" ? "عام" : "Public"}</span>
                  </label>
                  <button
                    onClick={handleCreateGroup}
                    disabled={savingNewGroup || !newGroupName.trim()}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 transition-colors shrink-0"
                  >
                    {savingNewGroup
                      ? "..."
                      : lang === "ar"
                        ? "إنشاء"
                        : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewGroupForm(false);
                      setNewGroupName("");
                    }}
                    className="p-1.5 hover:bg-muted rounded-lg shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* My Groups list */}
          {collections.length === 0 && !showNewGroupForm ? (
            <div className="text-center py-5 border-2 border-dashed border-border rounded-xl text-xs text-muted-foreground">
              {lang === "ar"
                ? "لا توجد مجموعات بعد — اضغط «مجموعة جديدة» لإنشاء مجموعة"
                : "No groups yet — click «New Group» to create one"}
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map((col: any) => (
                <GroupAccordionRow
                  key={col.id}
                  col={col}
                  assignments={assignments}
                  lang={lang}
                  expanded={expandedGroupIds.has(col.id)}
                  onToggle={() =>
                    setExpandedGroupIds((prev: Set<number>) => {
                      const next = new Set(prev);
                      if (next.has(col.id)) next.delete(col.id);
                      else next.add(col.id);
                      return next;
                    })
                  }
                  onEdit={() => setEditingCollection(col)}
                  onRemoveAssignment={removeFromCollection}
                  addToCollection={addToCollection}
                  creatingGameForId={creatingGameForId}
                  startGame={startGame}
                  setLocation={setLocation}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* Public Groups from other teachers */}
          {(publicCollections?.length ?? 0) > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowPublicGroups((v: boolean) => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                {lang === "ar"
                  ? `مجموعات عامة من معلمين آخرين (${publicCollections.length})`
                  : `Public groups from other teachers (${publicCollections.length})`}
                <ChevronDown
                  className={`w-3.5 h-3.5 ms-auto transition-transform ${showPublicGroups ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {showPublicGroups && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden mt-2 space-y-2"
                  >
                    {publicCollections.map((col: any) => (
                      <div
                        key={col.id}
                        className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 overflow-hidden"
                      >
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="flex-1 text-sm font-semibold text-foreground truncate">
                            {col.name}
                          </span>
                          {col.teacherName && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              👤 {col.teacherName}
                            </span>
                          )}
                          <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground shrink-0">
                            {col.assignmentIds?.length || 0}
                          </span>
                        </div>
                        {col.description && (
                          <p className="px-3 pb-2 text-[11px] text-muted-foreground">
                            {col.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <Search
            className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 ${lang === "ar" ? "right-3" : "left-3"}`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === "ar" ? "ابحث عن واجب..." : "Search assignments..."
            }
            className={`w-full py-2 bg-muted/40 border border-border/60 rounded-xl text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:bg-background transition-all ${lang === "ar" ? "pr-9 pl-3 text-right" : "pl-9 pr-3"}`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground ${lang === "ar" ? "left-3" : "right-3"}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status filters */}
        <div
          className="flex items-center gap-2 mb-3 flex-wrap"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {[
            { key: "all", label: lang === "ar" ? "الكل" : "All" },
            {
              key: "favorites",
              label: lang === "ar" ? "⭐ المفضلة" : "⭐ Favorites",
            },
            { key: "active", label: lang === "ar" ? "نشط" : "Active" },
            { key: "expired", label: lang === "ar" ? "منتهي" : "Expired" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key as any)}
              className={cn(
                "px-3 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all border",
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/40 text-muted-foreground border-border/60 hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ms-1">
            {statusFiltered.length}
          </span>
        </div>

        {/* Assignments list */}
        <div className="space-y-2 mb-5">
          {statusFiltered.length === 0 ? (
            (assignments?.length || 0) === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/5 via-amber-50/40 to-emerald-50/30 dark:from-primary/10 dark:via-amber-900/10 dark:to-emerald-900/10 px-6 py-10 text-center">
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h4 className="font-extrabold text-foreground text-base mb-1.5">
                  {lang === "ar"
                    ? "ابدأ مغامرتك التعليمية!"
                    : "Start your teaching adventure!"}
                </h4>
                <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto leading-relaxed">
                  {lang === "ar"
                    ? "أنشئ واجبك الأول أو لعبتك الأولى واستمتع بمشاركة طلابك بطريقة ممتعة وتفاعلية."
                    : "Create your first assignment or game and engage your students in a fun, interactive way."}
                </p>
                <button
                  onClick={() => setLocation("/teacher/new")}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/25 transition-all hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  {lang === "ar" ? "أنشئ نشاطًا الآن" : "Create Activity Now"}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-7 text-center">
                <Search className="w-7 h-7 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm font-bold text-foreground mb-1">
                  {lang === "ar"
                    ? "لا توجد نتائج مطابقة"
                    : "No matching results"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar"
                    ? "جرّب تغيير الفلتر أو مسح كلمات البحث."
                    : "Try clearing the filter or your search."}
                </p>
              </div>
            )
          ) : (
            (() => {
              const PAGE = 6;
              const visibleAssignments = showAllAssignments
                ? statusFiltered
                : statusFiltered.slice(0, PAGE);
              const hiddenCount = statusFiltered.length - PAGE;
              return (
                <>
                  {visibleAssignments.map((a: any) => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      groupName={groupNameById(a.id)}
                      isExpanded={expandedRowId === a.id}
                      onToggle={() =>
                        setExpandedRowId(expandedRowId === a.id ? null : a.id)
                      }
                      creatingGameForId={creatingGameForId}
                      startGame={startGame}
                      deleteAssignment={deleteAssignment}
                      setLocation={setLocation}
                      lang={lang}
                      t={t}
                      queryClient={queryClient}
                      onShare={onShare}
                      collections={collections}
                      addToCollection={addToCollection}
                      removeFromCollection={removeFromCollection}
                      creatingGroupName={creatingGroupName}
                      setCreatingGroupName={setCreatingGroupName}
                      createGroupAndAdd={createGroupAndAdd}
                      savingGroup={savingGroup}
                      isFavorite={favorites.has(a.id)}
                      onToggleFavorite={(e: React.MouseEvent) =>
                        toggleFavorite(a.id, e)
                      }
                    />
                  ))}
                  {!showAllAssignments && hiddenCount > 0 && (
                    <button
                      onClick={() => setShowAllAssignments(true)}
                      className="w-full py-2.5 bg-muted/40 border border-border/60 rounded-xl text-xs font-semibold text-primary hover:bg-muted/70 hover:border-primary/40 transition-all"
                    >
                      {lang === "ar"
                        ? `عرض الكل (${statusFiltered.length})`
                        : `View all (${statusFiltered.length})`}
                    </button>
                  )}
                  {showAllAssignments && statusFiltered.length > PAGE && (
                    <button
                      onClick={() => setShowAllAssignments(false)}
                      className="w-full py-2.5 bg-muted/30 border border-border/40 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {lang === "ar" ? "عرض أقل" : "Show less"}
                    </button>
                  )}
                </>
              );
            })()
          )}
          <button
            onClick={() => setLocation("/teacher/new")}
            className="w-full py-2.5 border border-dashed border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            + {lang === "ar" ? "إضافة واجب" : "Add Assignment"}
          </button>
        </div>

        {/* Games grid */}
        <div className="border-t border-border/60 pt-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">
            {lang === "ar" ? "الألعاب والمسابقات" : "Games & Competitions"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {games.map((game, i) => {
              const Icon = game.icon;
              return (
                <button
                  key={i}
                  onClick={() => launchGame(game.type)}
                  className="flex items-start gap-2.5 p-3 min-h-[56px] bg-muted/40 border border-border/60 rounded-xl hover:bg-card hover:border-border hover:shadow-sm transition-all text-start"
                >
                  <div className="p-1.5 rounded-lg bg-card text-foreground/70 shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium text-foreground leading-tight">
                        {game.title}
                      </p>
                      {game.tag && (
                        <span className="text-[9px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
                          {game.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {game.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <GroupQuickEditModal
        open={!!editingCollection}
        collection={editingCollection}
        isAdmin={!!user?.isAdmin}
        lang={lang}
        onClose={() => setEditingCollection(null)}
        onSaved={() => {
          reloadCollections?.();
        }}
      />
    </div>
  );
}

/* ── Interactive Video Lessons Tab ── */
function VideoLessonsTab({ lang, setLocation, user }: any) {
  const [lessons, setLessons] = useState<VideoLessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const BASE = import.meta.env.VITE_API_URL || "";
  const isAr = lang === "ar";

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/video-lessons`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: VideoLessonSummary[]) =>
        setLessons(Array.isArray(data) ? data : []),
      )
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl border border-border/40 bg-card animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-red-500/10 shrink-0">
            <Video className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-foreground truncate">
              {isAr ? "الفيديو التفاعلي" : "Interactive Video"}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {lessons.length}{" "}
              {isAr ? "فيديو" : lessons.length === 1 ? "video" : "videos"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/teacher/video-lesson/new")}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          {isAr ? "فيديو جديد" : "New Video"}
        </button>
      </div>

      {/* Empty state */}
      {lessons.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <Video className="w-8 h-8 text-red-400/60" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-2">
            {isAr ? "لا يوجد فيديو تفاعلي بعد" : "No interactive videos yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
            {isAr
              ? "أنشئ فيديو يحتوي على أسئلة تظهر للطالب أثناء المشاهدة"
              : "Create a video with questions that appear while students watch"}
          </p>
          <button
            onClick={() => setLocation("/teacher/video-lesson/new")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-xl transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            {isAr ? "إنشاء أول فيديو" : "Create First Video"}
          </button>
        </div>
      ) : (
        /* Lessons grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lessons.map((vl) => (
            <button
              key={vl.id}
              onClick={() => setLocation(`/teacher/video-lesson/${vl.id}`)}
              className="flex items-stretch gap-0 rounded-2xl border border-border/60 bg-card hover:border-red-300 hover:shadow-md transition-all text-start overflow-hidden group"
            >
              {/* Thumbnail */}
              <div className="w-[90px] shrink-0 bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center relative">
                <Video className="w-7 h-7 text-red-400/50" />
                <span className="absolute bottom-1.5 start-1.5 text-[9px] font-bold bg-black/40 text-white px-1.5 py-0.5 rounded-md">
                  {vl.videoType === "youtube"
                    ? "YT"
                    : vl.videoType === "upload"
                      ? "UP"
                      : "URL"}
                </span>
              </div>
              {/* Content */}
              <div className="flex-1 p-3 min-w-0">
                <p className="text-sm font-bold text-foreground line-clamp-2 leading-tight mb-1">
                  {vl.title}
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  {vl.subject && (
                    <span className="bg-muted px-2 py-0.5 rounded-md">
                      {vl.subject}
                    </span>
                  )}
                  {vl.targetClass && (
                    <span className="bg-muted px-2 py-0.5 rounded-md">
                      {vl.targetClass}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquarePlus className="w-3 h-3" />
                    {vl.questionCount} {isAr ? "سؤال" : "Q"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {vl.submissionCount} {isAr ? "تسليم" : "sub."}
                  </span>
                </div>
              </div>
              <div className="flex items-center px-3 text-muted-foreground/40 group-hover:text-red-400 transition-colors">
                {lang === "ar" ? (
                  <ArrowLeft className="w-4 h-4" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Admin note about video upload */}
      {user?.isAdmin && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          {isAr
            ? "بصفتك مسؤولاً، يمكنك رفع ملفات فيديو مباشرة عند إنشاء الدرس"
            : "As admin, you can upload video files directly when creating a lesson"}
        </p>
      )}
    </div>
  );
}
