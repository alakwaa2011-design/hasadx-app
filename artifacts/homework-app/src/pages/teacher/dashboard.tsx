import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useListAssignments,
  useGetCurrentTeacher,
  useDeleteAssignment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
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
  Presentation,
} from "lucide-react";
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

type TabId =
  | "overview"
  | "assignments"
  | "shared"
  | "competitive"
  | "tools"
  | "presentations"
  | "videos"
  | "stats";

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

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const [creatingGameForId, setCreatingGameForId] = useState<number | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [gameSetupModal, setGameSetupModal] = useState<number | null>(null);
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
  const [statsOpen, setStatsOpen] = useState(false);
  const { t, lang } = useI18n();
  const BackArrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const {
    data: user,
    isLoading: isUserLoading,
    error: userError,
  } = useGetCurrentTeacher({ query: { retry: false } });

  const { data: assignmentsRaw, isLoading: isAssignmentsLoading } =
    useListAssignments(user ? { teacherId: user.id } : undefined, {
      query: { enabled: !!user },
    });
  const assignments = Array.isArray(assignmentsRaw)
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
    setGameMode("solo");
    setTeamCount(2);
    setCustomTeamNames(["", "", "", "", "", ""]);
    setGameSetupModal(assignmentId);
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
      id: "shared",
      label: lang === "ar" ? "مسابقات مشتركة" : "Shared Competitions",
      shortLabel: lang === "ar" ? "مشتركة" : "Shared",
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: "competitive",
      label: lang === "ar" ? "الألعاب التعليمية" : "Educational Games",
      shortLabel: lang === "ar" ? "ألعاب" : "Games",
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
      icon: <Presentation className="w-4 h-4" />,
      href: "/teacher/presentations",
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

  const tabContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
      >
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
            mcqAssignments={mcqAssignments}
            creatingGameForId={creatingGameForId}
            startGame={openGameSetup}
          />
        )}
        {activeTab === "tools" && (
          <ToolsTab t={t} lang={lang} setLocation={setLocation} user={user} />
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
      </motion.div>
    </AnimatePresence>
  );

  return (
    <Layout>
      {/* ── Desktop sidebar layout ── */}
      <div className="hidden lg:flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-e border-border/60 bg-card/60 backdrop-blur-sm flex flex-col py-6 px-3 sticky top-0 h-screen overflow-y-auto">
          <div className="mb-6 px-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
              {isAr ? "مرحباً" : "Hello"}
            </p>
            <p className="font-black text-foreground text-sm truncate">
              {user?.name}
            </p>
          </div>
          <nav className="space-y-0.5 flex-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.href) setLocation(tab.href);
                    else setActiveTab(tab.id);
                  }}
                  className={cn(
                    "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all overflow-hidden group",
                    active
                      ? "text-white shadow-md"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  style={active ? { background: "#225739" } : undefined}
                >
                  {/* Hover background for inactive */}
                  {!active && (
                    <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(34,87,57,0.07)" }} />
                  )}
                  {/* Gold accent bar on active */}
                  {active && (
                    <span className={cn("absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full", isAr ? "end-0" : "start-0")} style={{ background: "#D9A521" }} />
                  )}
                  <span className={cn("relative [&_svg]:w-4 [&_svg]:h-4 shrink-0 transition-colors", active ? "text-white" : "text-muted-foreground group-hover:text-foreground")}>
                    {tab.icon}
                  </span>
                  <span className="relative truncate">{tab.label}</span>
                </button>
              );
            })}
            <div className="pt-3 border-t border-border/50 mt-3">
              <Link href="/teacher/students">
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {isAr ? "صفوفي وطلابي" : "My Classes"}
                  </span>
                </button>
              </Link>
            </div>
          </nav>
          <div className="mt-4 pt-4 border-t border-border/50">
            <button
              onClick={() => setLocation("/teacher/new")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all hover:opacity-90 hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, #225739 0%, #2d7050 100%)", color: "#FCFAF8" }}
            >
              <Plus className="w-4 h-4" />
              {isAr ? "أنشئ نشاطًا جديدًا" : "Create New Activity"}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 py-8 px-6 xl:px-10 2xl:px-14">
          <div className="mb-6">
            <GuestDraftImportBanner />
          </div>
          {/* Tab heading */}
          <div className="mb-5">
            <h1 className="text-2xl font-extrabold text-foreground">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h1>
          </div>
          {/* Prominent stat cards */}
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
          {tabContent}
        </main>
      </div>

      {/* ── Mobile layout (< lg) ── */}
      <div className="lg:hidden">
        <div className="px-4 pt-5 pb-3">
          <div className="mb-4">
            <GuestDraftImportBanner />
          </div>
          {/* Compact mobile header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                {isAr ? "مرحباً،" : "Hello,"}
              </p>
              <h1 className="text-xl font-extrabold text-foreground leading-tight">
                {user?.name}
              </h1>
            </div>
            <button
              onClick={() => setLocation("/teacher/new")}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/25 hover:opacity-90 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              {isAr ? "أنشئ نشاطًا" : "Create"}
            </button>
          </div>
          <button
            onClick={() => setLocation("/teacher/students")}
            className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border/60 rounded-2xl mb-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-foreground">
                  {isAr ? "صفوفي وطلابي" : "My Classes"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isAr
                    ? "عرض الصفوف التي أنشأتها"
                    : "View the classes you created"}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Collapsible stats */}
          <button
            onClick={() => setStatsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-card border border-border/60 rounded-2xl mb-4 transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <BookText className="w-3.5 h-3.5 text-primary" />
                <span className="font-black text-foreground text-sm">
                  {assignments?.length || 0}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isAr ? "واجب" : "assign."}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-black text-foreground text-sm">
                  {totalSubmissions}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isAr ? "تسليم" : "subm."}
                </span>
              </span>
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                statsOpen && "rotate-180",
              )}
            />
          </button>

          <AnimatePresence>
            {statsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="grid grid-cols-2 gap-2 pb-1">
                  <Link href="/teacher/students" className="col-span-2">
                    <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border/60 rounded-2xl hover:border-primary/40 transition-colors">
                      <div className="p-2 bg-green-500/10 rounded-xl text-green-600 shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-foreground">
                          {isAr ? "إدارة الطلاب" : "Manage Students"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {isAr ? "عرض وإضافة الطلاب" : "View & add students"}
                        </p>
                      </div>
                      <BackArrow className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </Link>
                  <button
                    onClick={() => {
                      setStatsOpen(false);
                      setActiveTab("stats");
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border/60 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    {isAr ? "ملخص الأداء" : "Performance"}
                  </button>
                  <button
                    onClick={() => {
                      setStatsOpen(false);
                      setActiveTab("tools");
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 bg-card border border-border/60 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    {isAr ? "الأدوات" : "Tools"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile section picker — horizontal scrollable chip bar */}
          <div className="-mx-4 px-4 mb-3">
            <p className="text-[11px] font-bold text-muted-foreground mb-1.5">
              {isAr ? "اختر القسم:" : "Choose section:"}
            </p>
            <div
              className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x scrollbar-hide"
              style={{ scrollbarWidth: "none" }}
              dir={isAr ? "rtl" : "ltr"}
            >
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.href) setLocation(tab.href);
                      else setActiveTab(tab.id);
                    }}
                    className={cn(
                      "shrink-0 snap-start flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all",
                      active
                        ? "text-white border-transparent shadow-md"
                        : "bg-card text-muted-foreground border-border/50 hover:text-foreground",
                    )}
                    style={active ? { background: "#225739", borderColor: "#225739" } : undefined}
                  >
                    <span className="[&_svg]:w-3.5 [&_svg]:h-3.5">
                      {tab.icon}
                    </span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-base text-foreground flex items-center gap-2">
              <span className="[&_svg]:w-4 [&_svg]:h-4 text-primary">
                {tabs.find((t) => t.id === activeTab)?.icon}
              </span>
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-md hover:bg-muted/40"
            >
              <Home className="w-3.5 h-3.5" />
              {isAr ? "الرئيسية" : "Home"}
            </Link>
          </div>
        </div>

        {/* Tab content */}
        <div className="px-4 pb-28">{tabContent}</div>

        {/* Fixed mobile bottom nav */}
        <nav
          className="fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/60 flex items-stretch"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.href) setLocation(tab.href);
                  else setActiveTab(tab.id);
                }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-all relative",
                  active ? "text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Active indicator dot at top */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ background: "#D9A521" }} />
                )}
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-xl transition-all [&_svg]:w-4 [&_svg]:h-4"
                  style={active ? { background: "#225739" } : undefined}
                >
                  {tab.icon}
                </span>
                <span className="text-[10px] font-semibold leading-none">
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

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
  itemCount: number;
  assignmentIds: number[];
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
  const [filterCollectionId, setFilterCollectionId] = useState<
    number | "all" | "none"
  >("all");
  const [creatingGroupName, setCreatingGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    loadCollections();
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

  const filteredAssignments = !assignments
    ? []
    : assignments.filter((a: any) => {
        if (filterCollectionId !== "all") {
          if (filterCollectionId === "none") {
            const inAnyCollection = collections.some((c) =>
              c.assignmentIds?.includes(a.id),
            );
            if (inAnyCollection) return false;
          } else {
            const col = collections.find((c) => c.id === filterCollectionId);
            if (!col?.assignmentIds?.includes(a.id)) return false;
          }
        }
        return true;
      });

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
  mcqAssignments,
  creatingGameForId,
  startGame,
}: any) {
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showKnowledgeRace, setShowKnowledgeRace] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);
  const [detailsById, setDetailsById] = useState<Record<number, any>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const BASE = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    fetch(`${BASE}/api/game-history`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGameHistory(data);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  const gameTypes = [
    {
      icon: "🏆",
      title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wants a Million?",
      desc:
        lang === "ar"
          ? "15 سؤالاً تتصاعد صعوبةً حتى المليون — مع ثلاثة أطواق نجاة"
          : "15 escalating questions with 3 lifelines — solo or class mode",
      color: "from-amber-500 to-yellow-600",
      type: "million",
      available: true,
    },
    {
      icon: "🪜",
      title: lang === "ar" ? "مَراقي" : "Maraqui",
      desc:
        lang === "ar"
          ? "المسابقة الأكثر حماساً وثقافةً عبر مراحل، تعرف على الصحابة والتاريخ"
          : "Challenge students with progressive stages",
      color: "from-teal-500 to-emerald-600",
      type: "maraqui",
      available: true,
    },
    {
      icon: "🎨",
      title: lang === "ar" ? "لعبة الألوان" : "Color Game",
      desc:
        lang === "ar"
          ? "هل عينك حادة؟ ابحث عن المربع المختلف"
          : "Find the odd square in the grid",
      color: "from-violet-500 to-fuchsia-600",
      type: "color_game",
      available: true,
    },
    {
      icon: "⚡",
      title:
        t.competitiveGames?.knowledgeRaceTitle ||
        (lang === "ar" ? "وميض" : "Wameeth"),
      desc:
        t.competitiveGames?.knowledgeRaceDesc ||
        (lang === "ar"
          ? "لعبة جماعية مباشرة — أسئلة سريعة وتنافس حي بين الطلاب"
          : "Live group game Kahoot-style"),
      color: "from-purple-500 to-pink-600",
      type: "knowledge_race",
      available: false,
      badge: lang === "ar" ? "اللعبة الأساسية في المنصة" : "Core platform game",
    },
    {
      icon: "🪢",
      title: lang === "ar" ? "شد الحبل" : "Tug of War",
      desc:
        lang === "ar"
          ? "فريقان يتنافسان بالإجابة على الأسئلة"
          : "Two teams compete by answering questions",
      color: "from-blue-500 to-indigo-600",
      type: "tug_of_war",
      available: true,
    },
    {
      icon: "🎬",
      title: lang === "ar" ? "فيديو تفاعلي" : "Interactive Video",
      desc:
        lang === "ar"
          ? "أنشئ درس فيديو تفاعلي بأسئلة تتوقف تلقائياً"
          : "Create an interactive video lesson with auto-pausing questions",
      color: "from-red-500 to-rose-600",
      type: "video_lesson",
      available: true,
    },
    {
      icon: "🏁",
      title: lang === "ar" ? "أعلام الدول" : "Flag Quiz",
      desc:
        lang === "ar"
          ? "اختبر معلوماتك في أعلام دول العالم"
          : "Challenge students with world flags",
      color: "from-sky-500 to-indigo-600",
      type: "flag_quiz",
      available: true,
    },
    {
      icon: "🧠",
      title: lang === "ar" ? "لعبة الذاكرة" : "Memory Match",
      desc:
        lang === "ar"
          ? "اقلب البطاقات وابحث عن الأزواج المتطابقة"
          : "Flip cards and find matching pairs",
      color: "from-indigo-500 to-pink-600",
      type: "memory_match",
      available: true,
    },
    {
      icon: "✖️",
      title: lang === "ar" ? "جدول الضرب" : "Multiplication",
      desc:
        lang === "ar"
          ? "اختبر سرعتك في جدول الضرب مع مضاعفات السلسلة"
          : "Challenge students with multiplication tables",
      color: "from-orange-500 to-amber-600",
      type: "multiplication",
      available: true,
    },
    {
      icon: "🧠",
      title: lang === "ar" ? "لعبة ارتباك" : "Stroop Game",
      desc:
        lang === "ar"
          ? "اضغط على لون الحبر وليس معنى الكلمة — تحدَّ لعقلك!"
          : "Challenge your brain! Click the ink color",
      color: "from-red-500 to-orange-600",
      type: "stroop",
      available: true,
    },
    {
      icon: "🔤",
      title: lang === "ar" ? "الكلمات المبعثرة" : "Scrambled Words",
      desc:
        lang === "ar"
          ? "رتّب الحروف المبعثرة لتكوّن الكلمة الصحيحة"
          : "Unscramble letters to form words",
      color: "from-violet-500 to-fuchsia-600",
      type: "scramble_words",
      available: true,
    },
    {
      icon: "🆚",
      title: lang === "ar" ? "مليون — فريق ضد فريق" : "Million — Team vs Team",
      desc:
        lang === "ar"
          ? "نفس لعبة المليون لكن جماعية! فريقان يتنافسان في نفس الأسئلة بالتصويت"
          : "Team million! Two teams vote on the same questions in real-time",
      color: "from-blue-500 to-purple-600",
      type: "million_team",
      available: true,
    },
    {
      icon: "💻",
      title: lang === "ar" ? "لعبة الاختراق" : "Hack Game",
      desc:
        lang === "ar"
          ? "ماراثون اختراق: كلمات سر، صناديق غامضة، وسحب نقاط الخصوم"
          : "Hack marathon: passwords, mystery boxes, and stealing opponents' points",
      color: "from-green-700 to-emerald-900",
      type: "hack",
      available: true,
    },
    {
      icon: "🔡",
      title: lang === "ar" ? "تحدي الكلمة" : "Word Challenge",
      desc:
        lang === "ar"
          ? "العب بنفسك أو اكتب كلمة سرّية لطلابك وشارك الرابط — يحاولون حلّها في ٦ محاولات"
          : "Play yourself or create a custom secret word and share the link with your students",
      color: "from-emerald-500 to-teal-600",
      type: "letrly",
      available: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center py-4">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl mb-4"
        >
          <Trophy className="w-10 h-10 text-purple-600" />
        </motion.div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-2">
          {t.dashboard.tabCompetitive || "ألعاب تنافسية"}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          {t.competitiveGames?.tabDesc ||
            "اختر نوع اللعبة التنافسية وأنشئ تجربة ممتعة لطلابك"}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {gameTypes.map((game, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Card
              className={`p-3 sm:p-6 h-full transition-all ${game.available ? "cursor-pointer hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700" : "opacity-50 cursor-not-allowed select-none"}`}
              onClick={() => {
                if (!game.available) return;
                if (game.type === "knowledge_race")
                  setShowKnowledgeRace(!showKnowledgeRace);
                else if (game.type === "tug_of_war")
                  setLocation("/game/tug/create");
                else if (game.type === "video_lesson")
                  setLocation("/teacher/video-lesson/new");
                else if (game.type === "flag_quiz") setLocation("/game/flags");
                else if (game.type === "color_game") setLocation("/game/color");
                else if (game.type === "memory_match")
                  setLocation("/game/memory");
                else if (game.type === "multiplication")
                  setLocation("/game/multiply");
                else if (game.type === "scramble_words")
                  setLocation("/game/scramble");
                else if (game.type === "stroop")
                  setLocation("/game/stroop/create");
                else if (game.type === "maraqui") setLocation("/game/maraqui");
                else if (game.type === "million") setLocation("/game/million");
                else if (game.type === "million_team")
                  setLocation("/game/million/team-setup");
                else if (game.type === "hack") setLocation("/game/hack");
                else if (game.type === "letrly") setLocation("/game/letrly");
              }}
            >
              <div
                className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${game.color} flex items-center justify-center text-xl sm:text-3xl mb-2 sm:mb-4 shadow-md`}
              >
                {game.icon}
              </div>
              <h3 className="font-black text-sm sm:text-lg mb-1 sm:mb-2 leading-snug">
                {game.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none">
                {game.desc}
              </p>
              {!game.available && (game as any).badge ? (
                <span className="inline-flex items-center gap-1 mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold">
                  ⭐ {(game as any).badge}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 mt-2 sm:mt-3 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] sm:text-xs font-bold">
                  <Gamepad2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {game.type === "maraqui"
                    ? lang === "ar"
                      ? "العب الآن"
                      : "Play now"
                    : game.type === "tug_of_war" || game.type === "video_lesson"
                      ? lang === "ar"
                        ? "أنشئ"
                        : "Create"
                      : lang === "ar"
                        ? "العب الآن"
                        : "Play now"}
                </span>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showKnowledgeRace && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-purple-600" />
                {t.dashboard.startGameFrom || "ابدأ لعبة من واجب"}
              </h3>
              {mcqAssignments.length === 0 ? (
                <Card className="py-12 text-center border-dashed border-purple-200">
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
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Card className="p-4 sm:p-5 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all group">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-foreground group-hover:text-purple-600 transition-colors truncate">
                              {assignment.title}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {assignment.subject} — {assignment.questionCount}{" "}
                              {t.dashboard.questionsCount}
                            </p>
                          </div>
                          <div className="p-2 bg-purple-100 rounded-lg text-purple-600 shrink-0">
                            <Gamepad2 className="w-4 h-4" />
                          </div>
                        </div>
                        <button
                          onClick={() => startGame(assignment.id)}
                          disabled={creatingGameForId === assignment.id}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-sm shadow-md shadow-purple-500/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
                        >
                          <Gamepad2 className="w-4 h-4" />
                          {creatingGameForId === assignment.id
                            ? t.dashboard.creating
                            : t.dashboard.startNow}
                        </button>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {gameHistory.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            {t.dashboard.recentGames}
          </h3>
          <div className="space-y-3">
            {gameHistory.slice(0, 10).map((g: any, i: number) => (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={`p-4 cursor-pointer transition-all ${expandedGameId === g.id ? "border-purple-400 shadow-lg" : "hover:border-purple-400/50"}`}
                  onClick={() => {
                    if (expandedGameId === g.id) {
                      setExpandedGameId(null);
                    } else {
                      setExpandedGameId(g.id);
                      if (!detailsById[g.id]) {
                        setLoadingDetail(true);
                        fetch(`${BASE}/api/game-history/${g.id}`, {
                          credentials: "include",
                        })
                          .then((r) => r.json())
                          .then((d) =>
                            setDetailsById((prev) => ({ ...prev, [g.id]: d })),
                          )
                          .catch(() => {})
                          .finally(() => setLoadingDetail(false));
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 shrink-0">
                        <Gamepad2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-foreground text-sm truncate">
                          {g.assignmentTitle}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {g.playerCount} {t.dashboard.gameHistoryPlayers}
                          </span>
                          <span>•</span>
                          <span>
                            {g.questionCount} {t.dashboard.gameHistoryQuestions}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      {g.winnerName ? (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {t.dashboard.gameHistoryWinner}
                          </p>
                          <p className="font-bold text-sm text-foreground flex items-center gap-1 justify-end">
                            {g.winnerAvatar && <span>{g.winnerAvatar}</span>}
                            {g.winnerName}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t.dashboard.gameHistoryNoWinner}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground/60">
                    {new Date(g.createdAt).toLocaleDateString(
                      lang === "ar" ? "ar-KW" : "en-US",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </div>
                  <AnimatePresence>
                    {expandedGameId === g.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mt-4 pt-4 border-t border-border">
                          {loadingDetail && !detailsById[g.id] ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                            </div>
                          ) : detailsById[g.id]?.detailedResults ? (
                            <div className="space-y-3">
                              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-purple-600" />
                                {lang === "ar"
                                  ? "نتائج اللاعبين"
                                  : "Player Results"}
                              </h4>
                              <div className="space-y-2">
                                {(
                                  detailsById[g.id].detailedResults as any[]
                                ).map((p: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="bg-muted/50 rounded-xl p-3"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? "bg-yellow-400 text-yellow-900" : idx === 1 ? "bg-gray-300 dark:bg-slate-600 text-gray-800 dark:text-slate-100" : idx === 2 ? "bg-orange-400 text-orange-900" : "bg-muted text-muted-foreground"}`}
                                        >
                                          {p.rank}
                                        </span>
                                        <span className="text-lg">
                                          {p.avatar}
                                        </span>
                                        <span className="font-bold text-sm">
                                          {p.name}
                                        </span>
                                        {p.teamName && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold">
                                            {p.teamName}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-end">
                                        <span className="font-black text-purple-600">
                                          {p.score}
                                        </span>
                                        <span className="text-xs text-muted-foreground mx-1">
                                          |
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {p.totalCorrect}/{p.totalQuestions}
                                        </span>
                                      </div>
                                    </div>
                                    {p.answers && p.answers.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {p.answers.map(
                                          (a: any, aIdx: number) => (
                                            <span
                                              key={aIdx}
                                              className={`w-5 h-5 rounded text-[10px] flex items-center justify-center font-bold ${a.correct ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
                                            >
                                              {a.correct ? "✓" : "✗"}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {lang === "ar"
                                ? "لا توجد نتائج تفصيلية لهذه اللعبة"
                                : "No detailed results for this game"}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolsTab({ t, lang, setLocation, user }: any) {
  const isAr = lang === "ar";

  // Brand palette for tools — green primary, gold accent, warm white bg
  const BRAND = { green: "#225739", gold: "#D9A521", light: "#FCFAF8" };

  const toolGroups = [
    {
      groupId: "content",
      groupTitle: isAr ? "إنشاء المحتوى" : "Content Creation",
      groupIcon: <Sparkles className="w-4 h-4" />,
      tools: [
        {
          icon: <Sparkles className="w-6 h-6" />,
          title: t.dashboard.toolAiGenerator,
          desc: t.dashboard.toolAiGeneratorDesc,
          accent: BRAND.gold,
          href: "/teacher/new",
        },
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
      ],
    },
    {
      groupId: "teaching",
      groupTitle: isAr ? "أدوات التدريس" : "Teaching Tools",
      groupIcon: <Video className="w-4 h-4" />,
      tools: [
        {
          icon: <Video className="w-6 h-6" />,
          title: isAr ? "درس فيديو تفاعلي" : "Interactive Video Lesson",
          desc: isAr
            ? "أنشئ درساً بأسئلة تتوقف تلقائياً أثناء الفيديو"
            : "Create a lesson with auto-pausing questions during the video",
          accent: BRAND.green,
          href: "/teacher/video-lesson/new",
        },
        {
          icon: <Library className="w-6 h-6" />,
          title: isAr ? "مكتبة المعلم" : "Teacher Library",
          desc: isAr
            ? "ارفع وأدر كتبك وعروضك ووثائقك المهمة"
            : "Upload and manage your books, presentations & docs",
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
          href: "/teacher/shared",
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

  let globalIdx = 0;

  return (
    <div className="space-y-7">
      {/* Header — centered */}
      <div className="text-center py-2">
        <div
          className="inline-flex w-11 h-11 rounded-2xl items-center justify-center mb-3"
          style={{ background: "rgba(34,87,57,0.10)", color: "#225739" }}
        >
          <Sparkles className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-extrabold text-foreground mb-1">
          {t.dashboard.toolsTitle}
        </h2>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {isAr
            ? "كل الأدوات التي تحتاجها لإدارة فصلك وإثراء تجربة الطلاب"
            : "Everything you need to manage your class and enrich student experience"}
        </p>
      </div>

      {toolGroups.map((group) => (
        <div key={group.groupId}>
          {/* Group header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px" style={{ background: "rgba(34,87,57,0.15)" }} />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "rgba(34,87,57,0.07)" }}>
              <span style={{ color: "#225739" }}>{group.groupIcon}</span>
              <h3 className="text-[11px] font-bold tracking-wider" style={{ color: "#225739" }}>
                {group.groupTitle}
              </h3>
            </div>
            <div className="flex-1 h-px" style={{ background: "rgba(34,87,57,0.15)" }} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {group.tools.map((tool) => {
              const delay = globalIdx++ * 0.04;
              const isGold = tool.accent === "#D9A521";
              return (
                <motion.div
                  key={tool.href}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay }}
                >
                  <div
                    className="group relative flex flex-col p-3 rounded-xl border border-border/50 bg-card cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
                    onClick={() => tool.href && setLocation(tool.href)}
                  >
                    {/* Top accent bar */}
                    <div
                      className="absolute top-0 inset-x-0 h-[2.5px] rounded-t-xl"
                      style={{ background: tool.accent, opacity: 0.85 }}
                    />
                    {/* Hover glow */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl"
                      style={{ background: `${tool.accent}09` }}
                    />

                    {/* Icon + text row */}
                    <div className="relative flex items-center gap-2.5 mb-2.5 pt-0.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${tool.accent}12`, color: tool.accent }}
                      >
                        {tool.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground text-xs leading-snug line-clamp-2">
                          {tool.title}
                        </h3>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        tool.href && setLocation(tool.href);
                      }}
                      className="relative w-full py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:opacity-90"
                      style={{
                        background: tool.accent,
                        color: isGold ? "#1a3020" : "#FCFAF8",
                      }}
                    >
                      {isAr ? "فتح" : "Open"}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
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
                      className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 whitespace-nowrap"
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
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs border-2 transition-all whitespace-nowrap ${importedIds.has(a.id) ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-primary/40 hover:border-primary text-primary hover:bg-primary/5"} disabled:opacity-60`}
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
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/40 transition-colors"
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
            <div className="px-5 py-4">{children}</div>
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
      <div className="w-full flex items-center gap-2 px-3 py-2.5">
        <span
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
          title={lang === "ar" ? "اسحب إلى مجموعة" : "Drag to group"}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        <button
          type="button"
          onClick={onToggleFavorite}
          className="shrink-0 transition-all hover:scale-110 active:scale-95"
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
            className={`w-3.5 h-3.5 transition-colors ${isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-400"}`}
          />
        </button>
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-2 text-start"
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
            className="shrink-0 text-xs font-bold px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shadow-sm"
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
          className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
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
            <div className="px-4 py-3 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  setLocation(`/teacher/assignment/${assignment.id}`)
                }
                className="text-xs font-medium px-3 py-1.5 bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                {lang === "ar" ? "تعديل" : "Edit"}
              </button>
              <button
                onClick={() =>
                  setLocation(`/teacher/assignment/${assignment.id}`)
                }
                className="text-xs font-medium px-3 py-1.5 bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
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
                className="text-xs font-medium px-3 py-1.5 bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {lang === "ar" ? "نسخ رابط الواجب" : "Copy assignment link"}
              </button>
              <button
                onClick={() => onShare(assignment.id)}
                className="text-xs font-medium px-3 py-1.5 bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
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
                className="text-xs font-medium px-3 py-1.5 bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
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
                className={`text-xs font-medium px-3 py-1.5 border rounded-lg transition-colors inline-flex items-center gap-1.5 ${
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
                          className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 shrink-0"
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
                className="text-xs font-medium px-3 py-1.5 bg-card text-red-500 border border-border rounded-lg hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors inline-flex items-center gap-1.5 ms-auto"
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

/* ── Main mockup-style render ── */
function AssignmentsTabRender({
  assignments,
  filteredAssignments,
  collections,
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
  savingGroup,
  user,
  reloadCollections,
}: any) {
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "expired" | "favorites"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
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
      {/* ── AI Presentations promo card ── */}
      <button
        onClick={() => setLocation("/teacher/presentations")}
        className="group relative overflow-hidden w-full text-start rounded-2xl bg-gradient-to-r from-emerald-500 via-green-600 to-amber-500 p-4 sm:p-5 shadow-lg hover:shadow-2xl hover:scale-[1.01] transition-all"
      >
        <div className="absolute -top-8 -end-8 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -start-8 w-40 h-40 rounded-full bg-amber-300/20 blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="text-4xl sm:text-5xl drop-shadow-lg shrink-0">🎬</div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-white text-[10px] font-bold mb-1">
              ✨ {lang === "ar" ? "جديد · ذكاء اصطناعي" : "New · AI"}
            </div>
            <div className="text-white font-extrabold text-base sm:text-lg leading-tight">
              {lang === "ar" ? "العروض التفاعلية" : "Interactive Presentations"}
            </div>
            <div className="text-white/90 text-xs sm:text-sm mt-0.5 line-clamp-2">
              {lang === "ar"
                ? "أنشئ عرضاً درسياً كاملاً بالذكاء الاصطناعي مع ألعاب حصاد التفاعلية في ثوانٍ."
                : "Generate a complete lesson deck with Hasad games in seconds."}
            </div>
          </div>
          <div className="hidden sm:flex shrink-0 bg-white text-emerald-700 px-4 py-2.5 rounded-xl text-sm font-bold group-hover:scale-105 transition-transform">
            {lang === "ar" ? "ابدأ" : "Start"}
          </div>
        </div>
      </button>

      {/* ── Assignments Section with create button in header ── */}
      <div className="flex items-center justify-between mb-0">
        <div />
        <button
          onClick={() => setLocation("/teacher/new")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-colors shadow-sm"
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
        {/* Group filter — large card-style tiles with image background area */}
        {(() => {
          const gradients = [
            "from-violet-500 to-fuchsia-500",
            "from-blue-500 to-cyan-500",
            "from-emerald-500 to-teal-500",
            "from-amber-500 to-orange-500",
            "from-pink-500 to-rose-500",
            "from-indigo-500 to-purple-500",
            "from-lime-500 to-green-500",
            "from-sky-500 to-blue-500",
          ];
          const gradFor = (id: number) =>
            gradients[Math.abs(id) % gradients.length];
          const noGroupCount = (assignments || []).filter(
            (a: any) =>
              !collections.some((c: any) => c.assignmentIds?.includes(a.id)),
          ).length;

          const handleDrop = (
            e: React.DragEvent,
            collectionId: number | null,
          ) => {
            e.preventDefault();
            e.currentTarget.classList.remove(
              "ring-4",
              "ring-emerald-400",
              "scale-105",
            );
            const aid = parseInt(
              e.dataTransfer.getData("application/x-assignment-id") || "0",
            );
            if (!aid || !collectionId) return;
            const col = collections.find((c: any) => c.id === collectionId);
            if (col?.assignmentIds?.includes(aid)) {
              toast.info(
                lang === "ar" ? "موجود بالفعل في المجموعة" : "Already in group",
              );
              setFilterCollectionId(collectionId);
              return;
            }
            addToCollection(collectionId, aid);
            // Auto-switch to the target collection so the user sees the assignment immediately
            setFilterCollectionId(collectionId);
          };
          const handleDragOver = (e: React.DragEvent) => {
            if (e.dataTransfer.types.includes("application/x-assignment-id")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              e.currentTarget.classList.add(
                "ring-4",
                "ring-emerald-400",
                "scale-105",
              );
            }
          };
          const handleDragLeave = (e: React.DragEvent) => {
            e.currentTarget.classList.remove(
              "ring-4",
              "ring-emerald-400",
              "scale-105",
            );
          };

          const Tile = ({
            active,
            onClick,
            label,
            count,
            bg,
            initial,
            imageUrl,
            description,
            droppable,
            collectionId,
            editable,
          }: {
            active: boolean;
            onClick: () => void;
            label: string;
            count: number;
            bg: string;
            initial?: string;
            imageUrl?: string;
            description?: string;
            droppable?: boolean;
            collectionId?: number;
            editable?: any;
          }) => (
            <div
              role="button"
              tabIndex={0}
              onClick={onClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }}
              onDragOver={droppable ? handleDragOver : undefined}
              onDragLeave={droppable ? handleDragLeave : undefined}
              onDrop={
                droppable && collectionId
                  ? (e) => handleDrop(e, collectionId)
                  : undefined
              }
              className={`group relative flex-shrink-0 w-[160px] h-[140px] rounded-2xl overflow-hidden text-start cursor-pointer transition-all duration-200 ${
                active
                  ? "ring-2 ring-foreground ring-offset-2 ring-offset-card shadow-lg"
                  : "ring-1 ring-border hover:ring-foreground/40 hover:shadow-md"
              }`}
            >
              {imageUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${imageUrl})` }}
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${bg}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {initial && (
                <span className="absolute top-2 end-2.5 text-white/90 text-[24px] font-extrabold leading-none drop-shadow pointer-events-none">
                  {initial}
                </span>
              )}
              <span className="absolute top-2 start-2.5 text-[10px] font-bold text-white/95 bg-white/20 backdrop-blur-sm px-1.5 py-0.5 rounded-md pointer-events-none">
                {count}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCollection(editable);
                  }}
                  className="absolute top-1.5 end-9 z-10 p-1 rounded-md bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={
                    lang === "ar" ? "خيارات المجموعة" : "Group options"
                  }
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              )}
              {editable?.isPublic && (
                <span className="absolute bottom-2 end-2 z-10 text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-md shadow pointer-events-none">
                  {lang === "ar" ? "عام" : "PUBLIC"}
                </span>
              )}
              <div className="absolute bottom-0 inset-x-0 p-2.5 pointer-events-none">
                <p className="text-white text-[14px] font-bold leading-tight line-clamp-2 drop-shadow">
                  {label}
                </p>
                {description && (
                  <p className="text-white/85 text-[10px] mt-0.5 line-clamp-1 drop-shadow">
                    {description}
                  </p>
                )}
                <p className="text-white/85 text-[10px] mt-0.5">
                  {count}{" "}
                  {lang === "ar" ? "عنصر" : count === 1 ? "item" : "items"}
                </p>
              </div>
            </div>
          );

          return (
            <div className="flex items-stretch gap-3 overflow-x-auto pb-3 mb-4 -mx-1 px-1 scrollbar-thin">
              <Tile
                active={filterCollectionId === "all"}
                onClick={() => setFilterCollectionId("all")}
                label={lang === "ar" ? "كل الواجبات" : "All"}
                count={(assignments || []).length}
                bg="from-slate-700 to-slate-900"
                initial="✦"
              />
              {collections.map((col: any) => (
                <Tile
                  key={col.id}
                  active={filterCollectionId === col.id}
                  onClick={() => setFilterCollectionId(col.id)}
                  label={col.name}
                  count={col.assignmentIds?.length || 0}
                  bg={gradFor(col.id)}
                  initial={(col.name || "?").trim().charAt(0)}
                  imageUrl={col.coverImageUrl}
                  description={col.description}
                  droppable
                  collectionId={col.id}
                  editable={col}
                />
              ))}
              <Tile
                active={filterCollectionId === "none"}
                onClick={() => setFilterCollectionId("none")}
                label={lang === "ar" ? "بدون مجموعة" : "No Group"}
                count={noGroupCount}
                bg="from-zinc-400 to-zinc-600"
                initial="∅"
              />
              <Link
                href="/teacher/collections"
                className="flex-shrink-0 w-[120px] h-[140px] rounded-2xl border-2 border-dashed border-border hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors flex flex-col items-center justify-center gap-2 text-violet-600"
              >
                <Plus className="w-6 h-6" />
                <span className="text-[12px] font-semibold">
                  {lang === "ar" ? "إدارة" : "Manage"}
                </span>
              </Link>
            </div>
          );
        })()}

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
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
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
            statusFiltered.map((a: any) => (
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
            ))
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
          <div className="grid grid-cols-2 gap-2">
            {games.map((game, i) => {
              const Icon = game.icon;
              return (
                <button
                  key={i}
                  onClick={() => launchGame(game.type)}
                  className="flex items-start gap-2.5 p-3 bg-muted/40 border border-border/60 rounded-xl hover:bg-card hover:border-border hover:shadow-sm transition-all text-start"
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-red-500/10">
            <Video className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-foreground">
              {isAr ? "الفيديو التفاعلي" : "Interactive Video"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {lessons.length}{" "}
              {isAr ? "فيديو" : lessons.length === 1 ? "video" : "videos"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/teacher/video-lesson/new")}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm"
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
