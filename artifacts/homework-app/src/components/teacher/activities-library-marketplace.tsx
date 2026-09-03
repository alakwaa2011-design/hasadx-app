/**
 * مكتبة الأنشطة — واجهة Marketplace (عرض فقط، المنطق من shared-content)
 * تصميم جديد: سايدبار يمين + تخطيط editorial
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  BookText,
  HelpCircle,
  Video,
  Play,
  Zap,
  Users,
  Download,
  Copy,
  Loader2,
  CheckCircle2,
  X,
  EyeOff,
  User,
  Bookmark,
  Presentation,
  TrendingUp,
  Radio,
  Globe,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronDown,
  SlidersHorizontal,
  Check,
  RotateCcw,
  Gamepad2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ActivityCover,
  formatUseCount,
  resolveCoverKind,
} from "@/lib/activity-cover";
import { selectTrendingActivities } from "@/lib/activity-library-trending";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ActivityLibraryStats {
  totalActivities: number;
  contributingTeachers: number;
  totalUses: number;
  newThisWeek: number;
  assignmentUses: Record<string, number>;
  assignmentUsesLast14Days?: Record<string, number>;
  videoUses: Record<string, number>;
  videoUsesLast14Days?: Record<string, number>;
  usageWindowDays?: number;
  presentationUses: number;
  questionUsesTracked: boolean;
}

const C = {
  bg:       "#faf8f3",
  card:     "#ffffff",
  primary:  "#225739",
  primary2: "#1c4630",
  soft:     "#e8f4ec",
  gold:     "#E8B84B",
  border:   "#e8e1d8",
  text:     "#1f2d24",
  muted:    "#6f8176",
  sidebar:  "#ffffff",
} as const;

type Tab = "assignments" | "questions" | "videos" | "presentations";
type CategoryTab = "all" | "popular" | "new" | "featured" | "peers";
type TypeChip = "all" | "assignment" | "presentation" | "video" | "live";

export interface MarketplaceAssignment {
  id: number;
  title: string;
  type: string;
  questionCount: number;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  isShared?: boolean;
  hiddenByAdmin?: boolean;
  accessMode?: string;
  subject?: string | null;
  targetClass?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface MarketplaceQuestion {
  id: number;
  text: string;
  subject: string | null;
  points: number;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  hiddenByAdmin?: boolean;
  imageUrl?: string | null;
  tags?: string | null;
  createdAt: string;
}

export interface MarketplaceVideo {
  id: number;
  title: string;
  subject: string | null;
  description?: string | null;
  targetClass: string | null;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  isShared?: boolean;
  hiddenByAdmin?: boolean;
  isPublished?: boolean;
  accessMode?: string;
  questionCount: number;
  createdAt: string;
}

export interface MarketplaceGameActivity {
  id: number;
  teacherId: number;
  teacherName: string | null;
  title: string;
  gameType: string;
  questionCount: number;
  playCount: number;
  source?: string;
  subject?: string | null;
  targetClass?: string | null;
  createdAt: string;
  publishedAt?: string | null;
}

export interface MarketplacePresentation {
  id: number;
  teacherId: number;
  title: string;
  slideCount: number;
  status: string;
  isShared: boolean;
  ownerName?: string | null;
  ownerIsAdmin?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivitiesLibraryMarketplaceProps {
  embedded?: boolean;
  lang: "ar" | "en";
  dir: "rtl" | "ltr";
  assignments: MarketplaceAssignment[];
  questions: MarketplaceQuestion[];
  videoLessons: MarketplaceVideo[];
  gameActivities: MarketplaceGameActivity[];
  presentations: MarketplacePresentation[];
  filteredAssignments: MarketplaceAssignment[];
  filteredQuestions: MarketplaceQuestion[];
  filteredVideos: MarketplaceVideo[];
  filteredGameActivities: MarketplaceGameActivity[];
  filteredPresentations: MarketplacePresentation[];
  popularIds: Set<number>;
  newIds: Set<number>;
  currentTeacherId: number | null;
  isAdmin: boolean;
  showHidden: boolean;
  onShowHiddenChange: (v: boolean) => void;
  search: string;
  onSearchChange: (v: string) => void;
  subjectFilter: string;
  onSubjectFilterChange: (v: string) => void;
  gradeFilter: string;
  onGradeFilterChange: (v: string) => void;
  sortBy: "newest" | "questions";
  onSortByChange: (v: "newest" | "questions") => void;
  allSubjects: string[];
  allGrades: string[];
  activeTab: Tab;
  onActiveTabChange: (t: Tab) => void;
  onClearFilters: () => void;
  openPresentation: (id: number) => void;
  launchAsGame: (id: number, mode?: "classic" | "teams") => void;
  openGameActivity: (id: number, gameType: string) => void;
  importAssignment: (id: number) => void;
  copyLink: (id: number) => void;
  dismissAssignment: (id: number) => void;
  importQuestion: (id: number) => void;
  dismissQuestion: (id: number) => void;
  importVideo: (id: number) => void;
  launchingIds: Set<number>;
  importingIds: Set<number>;
  importedIds: Set<number>;
  importingQIds: Set<number>;
  importedQIds: Set<number>;
  importingVIds: Set<number>;
  importedVIds: Set<number>;
  dismissingIds: Set<string>;
  t: {
    sharedContent: {
      tabAssignments: string;
      tabQuestions: string;
      searchPlaceholder: string;
      importAssignment: string;
      copyLink: string;
    };
  };
}

function activityBadge(
  kind: "assignment" | "video" | "question",
  type: string | undefined,
  isAr: boolean,
) {
  if (kind === "video")    return { label: isAr ? "فيديو" : "Video",           cls: "bg-blue-600/90"    };
  if (kind === "question") return { label: isAr ? "تفاعلي" : "Interactive",    cls: "bg-violet-600/90" };
  if (type === "mcq")      return { label: isAr ? "مسابقة مباشرة" : "Live quiz", cls: "bg-emerald-700/90" };
  if (type === "true_false") return { label: isAr ? "اختبار" : "Quiz",         cls: "bg-amber-600/90"   };
  return                          { label: isAr ? "واجب" : "Assignment",        cls: "bg-[#225739]/90"   };
}

export function ActivitiesLibraryMarketplace(props: ActivitiesLibraryMarketplaceProps) {
  const {
    embedded, lang, dir,
    assignments, questions, videoLessons, presentations,
    filteredAssignments, filteredQuestions, filteredVideos,
    filteredGameActivities, filteredPresentations,
    popularIds, newIds,
    currentTeacherId, isAdmin, showHidden, onShowHiddenChange,
    search, onSearchChange,
    subjectFilter, onSubjectFilterChange,
    gradeFilter, onGradeFilterChange,
    sortBy, onSortByChange,
    allSubjects, allGrades,
    activeTab, onActiveTabChange,
    onClearFilters,
    launchAsGame, openGameActivity, openPresentation, importAssignment, copyLink, dismissAssignment,
    importQuestion, dismissQuestion, importVideo,
    launchingIds, importingIds, importedIds,
    importingQIds, importedQIds,
    importingVIds, importedVIds,
    dismissingIds, t,
  } = props;

  const isAr = lang === "ar";
  const [categoryTab,   setCategoryTab]   = useState<CategoryTab>("all");
  const [typeChip,      setTypeChip]      = useState<TypeChip>("all");
  const [bookmarks,     setBookmarks]     = useState<Set<number>>(new Set());
  const [libraryStats,  setLibraryStats]  = useState<ActivityLibraryStats | null>(null);
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [statsError,    setStatsError]    = useState(false);
  const [openMenuId,    setOpenMenuId]    = useState<string | null>(null);
  const [viewMode,      setViewMode]      = useState<"grid" | "list">("grid");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close, { capture: true });
    return () => document.removeEventListener("click", close, { capture: true });
  }, [openMenuId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      setStatsError(false);
      try {
        const statsUrl = API_BASE
          ? `${API_BASE}/api/teacher/activity-library/stats`
          : "/api/teacher/activity-library/stats";
        const res = await fetch(statsUrl, { credentials: "include" });
        if (!res.ok) throw new Error("stats failed");
        const data = (await res.json()) as ActivityLibraryStats;
        if (!cancelled) setLibraryStats(data);
      } catch {
        if (!cancelled) { setStatsError(true); setLibraryStats(null); }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const assignmentUseCount = (id: number) => libraryStats?.assignmentUses[String(id)] ?? 0;
  const videoUseCount      = (id: number) => libraryStats?.videoUses[String(id)] ?? 0;
  const toggleBookmark     = (id: number) => setBookmarks(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const isRecent           = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;

  const filterByCategory = <T extends { id: number; isAdminContent?: boolean; teacherId: number; createdAt: string }>(
    list: T[],
    opts?: { popularCheck?: (item: T) => boolean },
  ): T[] => {
    if (categoryTab === "all")      return list;
    if (categoryTab === "popular")  return list.filter(item => popularIds.has(item.id) || opts?.popularCheck?.(item));
    if (categoryTab === "new")      return list.filter(item => newIds.has(item.id) || isRecent(item.createdAt));
    if (categoryTab === "featured") return list.filter(item => item.isAdminContent);
    if (categoryTab === "peers")    return list.filter(item => item.teacherId !== currentTeacherId && !item.isAdminContent);
    return list;
  };

  const displayAssignments = useMemo(() => {
    let list = filterByCategory(filteredAssignments);
    if (typeChip === "live")     list = list.filter(a => a.type === "mcq" && a.questionCount > 0);
    return list;
  }, [filteredAssignments, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const displayVideos = useMemo(() => {
    if (typeChip !== "all" && typeChip !== "video") return [];
    return filterByCategory(filteredVideos, { popularCheck: v => v.questionCount >= 5 });
  }, [filteredVideos, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const displayQuestions = useMemo(() => {
    if (typeChip !== "all") return [];
    return filterByCategory(filteredQuestions, { popularCheck: q => q.points >= 2 });
  }, [filteredQuestions, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const displayGameActivities = useMemo(() => {
    if (typeChip !== "all" && typeChip !== "live") return [];
    return filterByCategory(filteredGameActivities, { popularCheck: game => game.playCount >= 5 });
  }, [filteredGameActivities, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const displayPresentations = useMemo(() => {
    if (typeChip !== "presentation") return [];
    return filterByCategory(filteredPresentations.map(presentation => ({
      ...presentation,
      teacherId: presentation.teacherId,
      teacherName: presentation.ownerName ?? null,
      isAdminContent: presentation.ownerIsAdmin === true,
    })));
  }, [filteredPresentations, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const trendingNow = useMemo(() => {
    if (!libraryStats) return [];

    type Trend = {
      key: string;
      title: string;
      kind: "assignment" | "video";
      id: number;
      type?: string;
      subject?: string | null;
      questionCount?: number;
      totalUses: number;
      recentUses: number;
      createdAt: string;
      isEligible: boolean;
      typeLabel: string;
      activeLabel: string;
    };

    const assignmentTrends: Trend[] = assignments.map(assignment => {
      const totalUses = libraryStats.assignmentUses[String(assignment.id)] ?? 0;
      const recentUses = libraryStats.assignmentUsesLast14Days?.[String(assignment.id)] ?? 0;
      return {
        key: `a-${assignment.id}`,
        title: assignment.title,
        kind: "assignment",
        id: assignment.id,
        type: assignment.type,
        subject: assignment.subject,
        questionCount: assignment.questionCount,
        totalUses,
        recentUses,
        createdAt: assignment.createdAt,
        isEligible:
          assignment.isShared !== false &&
          assignment.accessMode !== "private" &&
          !assignment.hiddenByAdmin,
        typeLabel: activityBadge("assignment", assignment.type, isAr).label,
        activeLabel: isAr
          ? `${formatUseCount(totalUses)} استخدام`
          : `${formatUseCount(totalUses)} uses`,
      };
    });

    const videoTrends: Trend[] = videoLessons.map(video => {
      const totalUses = libraryStats.videoUses[String(video.id)] ?? 0;
      const recentUses = libraryStats.videoUsesLast14Days?.[String(video.id)] ?? 0;
      return {
        key: `v-${video.id}`,
        title: video.title,
        kind: "video",
        id: video.id,
        subject: video.subject,
        questionCount: video.questionCount,
        totalUses,
        recentUses,
        createdAt: video.createdAt,
        isEligible:
          video.isShared !== false &&
          video.isPublished !== false &&
          video.accessMode !== "private" &&
          !video.hiddenByAdmin,
        typeLabel: isAr ? "فيديو" : "Video",
        activeLabel: isAr
          ? `${formatUseCount(totalUses)} مشاهدة`
          : `${formatUseCount(totalUses)} views`,
      };
    });

    return selectTrendingActivities(
      [...assignmentTrends, ...videoTrends],
      { recentUsageAvailable: libraryStats.usageWindowDays === 14 },
    );
  }, [assignments, videoLessons, libraryStats, isAr]);

  const statsLabels = [
    { icon: <BookText  className="w-4 h-4" />, label: isAr ? "نشاط جاهز"          : "Ready activities",        value: formatUseCount(libraryStats?.totalActivities)     },
    { icon: <Users     className="w-4 h-4" />, label: isAr ? "معلم مشارك"          : "Contributing teachers",   value: formatUseCount(libraryStats?.contributingTeachers) },
    { icon: <TrendingUp className="w-4 h-4"/>, label: isAr ? "مرة استُخدم"         : "Total uses",              value: formatUseCount(libraryStats?.totalUses)            },
    { icon: <Zap       className="w-4 h-4" />, label: isAr ? "جديد هذا الأسبوع"   : "New this week",           value: formatUseCount(libraryStats?.newThisWeek)          },
  ];

  const categoryTabs: { id: CategoryTab; ar: string; en: string }[] = [
    { id: "all",      ar: "الكل",              en: "All"          },
    { id: "popular",  ar: "الأكثر استخداماً",  en: "Most used"    },
    { id: "new",      ar: "جديد هذا الأسبوع",  en: "New this week"},
    { id: "featured", ar: "أنشطة مميزة",       en: "Featured"     },
    { id: "peers",    ar: "أنشطة من معلميني",   en: "From teachers"},
  ];

  const typeFilters: { id: TypeChip; ar: string; en: string; icon: React.ReactNode }[] = [
    { id: "all",         ar: "كل الأنواع",       en: "All types",    icon: <Globe       className="w-3.5 h-3.5" /> },
    { id: "live",        ar: "مسابقة مباشرة",    en: "Live quiz",    icon: <Zap         className="w-3.5 h-3.5" /> },
    { id: "assignment",  ar: "واجبات واختبارات", en: "Assignments & quizzes", icon: <BookText className="w-3.5 h-3.5" /> },
    { id: "video",       ar: "فيديو",            en: "Videos",       icon: <Video       className="w-3.5 h-3.5" /> },
    { id: "presentation",ar: "عروض تفاعلية",     en: "Presentations",icon: <Presentation className="w-3.5 h-3.5"/> },
  ];

  const applyTypeFilter = (id: TypeChip) => {
    setTypeChip(id);
    if (id === "video") onActiveTabChange("videos");
    else if (id === "presentation") onActiveTabChange("presentations");
    else onActiveTabChange("assignments");
  };

  const clearMobileFilters = () => {
    onClearFilters();
    setTypeChip("all");
    setCategoryTab("all");
  };

  const activeFilterCount = [subjectFilter, gradeFilter, typeChip !== "all"].filter(Boolean).length;
  const hasFilters = !!(search || subjectFilter || gradeFilter || typeChip !== "all" || categoryTab !== "all");

  /* ──────────────────────────────────── render helpers ──────────────────────── */

  const renderAssignmentCard = (a: MarketplaceAssignment, i: number) => {
    const badge  = activityBadge("assignment", a.type, isAr);
    const isOwn  = a.teacherId === currentTeacherId;
    const uses   = statsError ? undefined : assignmentUseCount(a.id);
    const coverKind = resolveCoverKind("assignment", a.type);

    return (
      <motion.article
        key={a.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i * 0.03, 0.2) }}
        className={cn(
          "group relative flex min-w-0 flex-col rounded-xl border bg-white transition-all duration-300 sm:rounded-2xl",
          a.hiddenByAdmin ? "opacity-55 border-dashed border-amber-300" : "hover:border-[#225739]/25 hover:shadow-md",
        )}
        style={{ borderColor: C.border, boxShadow: "0 1px 5px rgba(31,45,36,0.045)" }}
      >
        <div className="relative overflow-hidden rounded-t-xl sm:rounded-t-2xl">
          <ActivityCover className="aspect-[1.9/1]" kind={coverKind} subject={a.subject} title={a.title} type={a.type} aspect="video">
            <span className={cn("absolute top-2 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm sm:top-2.5 sm:rounded-lg sm:px-2 sm:text-[10px]", dir === "rtl" ? "right-2" : "left-2", badge.cls)}>
              {badge.label}
            </span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggleBookmark(a.id); }}
              aria-label={bookmarks.has(a.id) ? (isAr ? "إزالة من المحفوظات" : "Remove bookmark") : (isAr ? "حفظ النشاط" : "Save activity")}
              className={cn("absolute top-2 z-10 rounded-full bg-white/90 p-1 shadow-sm transition-colors sm:top-2.5 sm:p-1.5", dir === "rtl" ? "left-2" : "right-2")}
              style={{ color: bookmarks.has(a.id) ? C.gold : C.muted }}
            >
              <Bookmark className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", bookmarks.has(a.id) && "fill-current")} />
            </button>
          </ActivityCover>
        </div>

        <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3 sm:pt-2.5">
          <h3 className="line-clamp-2 text-[12px] font-black leading-snug tracking-tight sm:text-sm" style={{ color: C.text }}>
            {a.title}
          </h3>
          <p className="mt-1 truncate text-[10px] font-semibold sm:text-[11px]" style={{ color: C.muted }}>
            {[a.subject, a.targetClass, `${a.questionCount} ${isAr ? "سؤال" : "Q"}`].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] sm:mt-2 sm:text-[10px]" style={{ color: C.muted }}>
            {!statsError && <span>{formatUseCount(uses)} {isAr ? "استخدام" : "uses"}</span>}
            {a.teacherName && !a.isAdminContent
              ? <span className="flex min-w-0 items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" />{a.teacherName}</span>
              : a.isAdminContent ? <span className="truncate font-semibold" style={{ color: C.primary }}>{isAr ? "حصاد" : "Hasaad"}</span>
              : null}
          </div>

          <div className="mt-2.5 flex items-center gap-1 border-t pt-2.5 sm:mt-3 sm:gap-1.5 sm:pt-3" style={{ borderColor: C.border }}>
            {isOwn ? (
              <span className="flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-[10px] font-bold sm:rounded-xl sm:py-2 sm:text-xs" style={{ borderColor: C.border, color: C.primary, background: C.soft }}>
                <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />{isAr ? "محتواك" : "Yours"}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => launchAsGame(a.id, "classic")}
                  disabled={launchingIds.has(a.id) || a.questionCount === 0}
                  className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-extrabold text-white transition-all hover:brightness-110 disabled:opacity-40 sm:gap-1.5 sm:rounded-xl sm:py-2 sm:text-xs"
                  style={{ background: C.primary }}
                >
                  {launchingIds.has(a.id) ? <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" /> : <><Play className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />{isAr ? "ابدأ" : "Start"}</>}
                </button>
                <button
                  type="button"
                  onClick={() => importAssignment(a.id)}
                  disabled={importingIds.has(a.id) || importedIds.has(a.id)}
                  aria-label={t.sharedContent.importAssignment}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[#f5f2ec] disabled:opacity-40 sm:h-9 sm:w-9 sm:rounded-xl"
                  style={{ borderColor: C.border }}
                  title={t.sharedContent.importAssignment}
                >
                  {importedIds.has(a.id) ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : importingIds.has(a.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: C.muted }} /> : <Download className="w-3.5 h-3.5" style={{ color: C.muted }} />}
                </button>
                <button
                  type="button"
                  onClick={() => copyLink(a.id)}
                  aria-label={t.sharedContent.copyLink}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[#f5f2ec] sm:h-9 sm:w-9 sm:rounded-xl"
                  style={{ borderColor: C.border }}
                  title={t.sharedContent.copyLink}
                >
                  <Copy className="w-3.5 h-3.5" style={{ color: C.muted }} />
                </button>
              </>
            )}
          </div>
        </div>
      </motion.article>
    );
  };

  const renderListRow = (a: MarketplaceAssignment, i: number) => {
    const badge  = activityBadge("assignment", a.type, isAr);
    const isOwn  = a.teacherId === currentTeacherId;
    const uses   = statsError ? undefined : assignmentUseCount(a.id);

    return (
      <motion.div
        key={a.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i * 0.025, 0.18) }}
        className={cn("flex items-center gap-4 rounded-2xl border bg-white px-4 py-3.5 transition-shadow hover:shadow-md", a.hiddenByAdmin && "opacity-55 border-dashed border-amber-300")}
        style={{ borderColor: C.border }}
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
          <ActivityCover kind={resolveCoverKind("assignment", a.type)} subject={a.subject} title={a.title} type={a.type} aspect="thumb" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold" style={{ color: C.text }}>{a.title}</p>
          <p className="mt-0.5 text-[11px]" style={{ color: C.muted }}>
            {[a.subject, a.targetClass, `${a.questionCount} ${isAr ? "سؤال" : "Q"}`].filter(Boolean).join(" · ")}
            {!statsError && <> · {formatUseCount(uses)} {isAr ? "استخدام" : "uses"}</>}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white", badge.cls)}>{badge.label}</span>
        {!isOwn && (
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => launchAsGame(a.id, "classic")} disabled={launchingIds.has(a.id) || a.questionCount === 0} className="flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-40" style={{ background: C.primary }}>
              {launchingIds.has(a.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Play className="w-3.5 h-3.5 fill-current" />{isAr ? "ابدأ" : "Start"}</>}
            </button>
            <button type="button" onClick={() => importAssignment(a.id)} disabled={importingIds.has(a.id) || importedIds.has(a.id)} className="flex h-9 w-9 items-center justify-center rounded-xl border hover:bg-[#f5f2ec] disabled:opacity-40" style={{ borderColor: C.border }}>
              {importedIds.has(a.id) ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Download className="w-3.5 h-3.5" style={{ color: C.muted }} />}
            </button>
          </div>
        )}
      </motion.div>
    );
  };

  const renderGameActivityCard = (game: MarketplaceGameActivity, i: number) => {
    const labels: Record<string, [string, string]> = {
      wameeth: ["وميض", "Wameeth"],
      tug: ["شد الحبل", "Tug of War"],
      xo: ["إكس أو", "XO"],
      escape: ["غرفة الهروب", "Escape Room"],
      rocket: ["سباق الصواريخ", "Rocket Race"],
      wheel: ["عجلة الحظ", "Wheel"],
      memory: ["تطابق الذاكرة", "Memory Match"],
      letrly: ["تحدي الكلمة", "Word Challenge"],
      scramble: ["الكلمات المبعثرة", "Scrambled Words"],
      stroop: ["ارتباك الألوان", "Color Confusion"],
      maraqui: ["مراقي", "Maraqui"],
      arena: ["ساحة التحدي", "Challenge Arena"],
      solo: ["تحدٍ فردي", "Solo Challenge"],
    };
    const normalizedType = game.gameType.toLowerCase().trim();
    const gameLabel = labels[normalizedType]?.[isAr ? 0 : 1] || game.gameType;
    const isOwn = game.teacherId === currentTeacherId;

    return (
      <motion.article
        key={`game-${game.id}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i * 0.03, 0.2) }}
        className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:border-[#225739]/25 hover:shadow-md sm:rounded-2xl"
        style={{ borderColor: C.border, boxShadow: "0 1px 5px rgba(31,45,36,0.045)" }}
      >
        <ActivityCover className="aspect-[1.9/1]" kind="live" subject={game.subject} title={game.title} type={game.gameType} aspect="video" livePulse>
          <span className={cn("absolute top-2 z-10 rounded-md bg-[#225739]/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm sm:top-2.5 sm:rounded-lg sm:px-2 sm:text-[10px]", dir === "rtl" ? "right-2" : "left-2")}>
            {isAr ? "لعبة مباشرة" : "Live game"}
          </span>
          <span className={cn("absolute top-2 z-10 rounded-full bg-white/90 p-1.5 shadow-sm", dir === "rtl" ? "left-2" : "right-2")} style={{ color: C.gold }}>
            <Gamepad2 className="h-3.5 w-3.5" />
          </span>
        </ActivityCover>
        <div className="flex flex-1 flex-col p-2.5 sm:p-3">
          <p className="line-clamp-2 text-[12px] font-black leading-snug sm:text-[13px]" style={{ color: C.text }}>{game.title}</p>
          <p className="mt-1 truncate text-[9px] font-semibold sm:text-[10px]" style={{ color: C.primary }}>{gameLabel}</p>
          <p className="mt-1 truncate text-[10px] font-semibold sm:text-[10px]" style={{ color: C.muted }}>
            {[game.subject, game.targetClass, `${game.questionCount} ${isAr ? "سؤال" : "Q"}`].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-1.5 flex min-w-0 items-center justify-between gap-1 text-[9px] sm:mt-2 sm:text-[10px]" style={{ color: C.muted }}>
            <span>{formatUseCount(game.playCount)} {isAr ? "تشغيل" : "plays"}</span>
            <span className="truncate">{isOwn ? (isAr ? "نشاطك" : "Yours") : game.teacherName}</span>
          </div>
          <button
            type="button"
            onClick={() => openGameActivity(game.id, game.gameType)}
            className="mt-2.5 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-extrabold text-white transition-all hover:brightness-110 sm:mt-3 sm:rounded-xl sm:py-2 sm:text-xs"
            style={{ background: C.primary }}
          >
            <Play className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
            {isAr ? "استخدم النشاط" : "Use activity"}
          </button>
        </div>
      </motion.article>
    );
  };

  /* ──────────────────────────────────── sidebar ──────────────────────────────── */
  const sidebar = (
    <aside
      className="hidden shrink-0 border-s lg:flex lg:flex-col"
      style={{
        width: 216,
        background: C.sidebar,
        borderColor: C.border,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div className="border-b px-3.5 py-4" style={{ borderColor: C.border }}>
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: C.primary }}>
            <BookText className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-black" style={{ color: C.text }}>{isAr ? "مكتبة الأنشطة" : "Activities Library"}</p>
            <p className="text-[9px]" style={{ color: C.muted }}>{isAr ? "اكتشف وابدأ فوراً" : "Discover & launch"}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2", isAr ? "right-3" : "left-3")} style={{ color: C.muted }} />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={isAr ? "ابحث عن نشاط..." : "Search..."}
            className={cn("w-full rounded-xl border py-2 text-[11px] outline-none transition-all", isAr ? "pr-8 pl-8" : "pl-8 pr-8")}
            style={{ background: C.bg, borderColor: search ? C.primary : C.border, color: C.text, fontFamily: "inherit" }}
          />
          {search && (
            <button onClick={() => onSearchChange("")} className={cn("absolute top-1/2 -translate-y-1/2", isAr ? "left-3" : "right-3")} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Type filters */}
      <div className="px-3.5 py-3.5">
        <p className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }}>{isAr ? "نوع النشاط" : "Activity type"}</p>
        <div className="flex flex-col gap-1">
          {typeFilters.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => applyTypeFilter(f.id)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-all"
              style={{
                fontFamily: "inherit",
                fontWeight: typeChip === f.id ? 800 : 600,
                background: typeChip === f.id ? C.soft : "transparent",
                color: typeChip === f.id ? C.primary : C.muted,
                border: "none",
                cursor: "pointer",
              }}
            >
              <span style={{ color: typeChip === f.id ? C.primary : C.muted }}>{f.icon}</span>
              {isAr ? f.ar : f.en}
            </button>
          ))}
        </div>
      </div>

      {/* Subject dropdown */}
      <div className="border-t px-3.5 py-3.5" style={{ borderColor: C.border }}>
        <label className="mb-2 block text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }} htmlFor="library-subject-desktop">
          {isAr ? "المادة الدراسية" : "Subject"}
        </label>
        <div className="relative">
          <select
            id="library-subject-desktop"
            aria-label={isAr ? "المادة الدراسية" : "Subject"}
            value={subjectFilter}
            onChange={e => onSubjectFilterChange(e.target.value)}
            className="w-full appearance-none rounded-xl border px-2.5 py-2 text-[11px] outline-none transition-colors focus:ring-2 focus:ring-[#225739]/15"
            style={{ background: C.bg, borderColor: subjectFilter ? C.primary : C.border, color: subjectFilter ? C.text : C.muted, fontFamily: "inherit" }}
          >
            <option value="">{isAr ? "كل المواد" : "All subjects"}</option>
            {allSubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
          </select>
          <ChevronDown className={cn("pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2", isAr ? "left-2.5" : "right-2.5")} style={{ color: C.muted }} />
        </div>
      </div>

      {/* Grade + Sort (compact) */}
      <div className="border-t px-3.5 py-3.5" style={{ borderColor: C.border }}>
        <p className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: C.muted }}>{isAr ? "الصف والترتيب" : "Grade & sort"}</p>
        <div className="flex flex-col gap-2">
          <input
            value={gradeFilter}
            onChange={e => onGradeFilterChange(e.target.value)}
            list="lib-grades-sb"
            placeholder={isAr ? "الصف..." : "Grade..."}
            className="w-full rounded-xl border px-2.5 py-2 text-[11px] outline-none"
            style={{ background: C.bg, borderColor: C.border, color: C.text, fontFamily: "inherit" }}
          />
          <datalist id="lib-grades-sb">{allGrades.map(g => <option key={g} value={g} />)}</datalist>
          <select value={sortBy} onChange={e => onSortByChange(e.target.value as "newest" | "questions")} className="w-full rounded-xl border px-2.5 py-2 text-[11px] outline-none" style={{ background: C.bg, borderColor: C.border, color: C.text, fontFamily: "inherit" }}>
            <option value="newest">{isAr ? "الأحدث" : "Newest"}</option>
            <option value="questions">{isAr ? "الأكثر أسئلة" : "Most questions"}</option>
          </select>
        </div>
      </div>

      {/* Admin toggle */}
      {isAdmin && (
        <div className="border-t px-3.5 py-2.5" style={{ borderColor: C.border }}>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-bold" style={{ color: C.muted }}>
            <input type="checkbox" checked={showHidden} onChange={e => onShowHiddenChange(e.target.checked)} className="accent-[#225739]" />
            <EyeOff className="w-3.5 h-3.5" />
            {isAr ? "عرض المخفي" : "Show hidden"}
          </label>
        </div>
      )}

      {/* Share CTA */}
      <div className="mt-auto px-3.5 py-4">
        <Link href="/teacher/new">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[11px] font-black text-white transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg,${C.primary},${C.primary2})`, boxShadow: "0 4px 16px rgba(34,87,57,0.28)", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <Plus className="h-4 w-4" />{isAr ? "شارك نشاطاً" : "Share activity"}
          </button>
        </Link>
      </div>
    </aside>
  );

  /* ──────────────────────────────────── main content ──────────────────────────── */
  const totalShown = (activeTab === "assignments" ? displayAssignments.length + displayGameActivities.length : 0)
    + (activeTab === "videos" ? displayVideos.length : 0)
    + (activeTab === "questions" ? displayQuestions.length : 0)
    + (activeTab === "presentations" ? displayPresentations.length : 0);

  return (
    <div
      className={cn(!embedded && "min-h-screen")}
      style={{ background: C.bg, color: C.text }}
      dir={dir}
    >
      <div style={{ minHeight: "100vh" }}>
        <main className="min-w-0 w-full px-3 py-4 pb-24 sm:px-5 sm:py-5 lg:px-7 lg:py-6 lg:pb-8 xl:px-9">
          <section className="mb-3 space-y-2.5 pt-0 sm:mb-6 sm:space-y-3.5 sm:pt-3 lg:pt-4" aria-labelledby="activities-library-title">
            <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm sm:h-10 sm:w-10" style={{ borderColor: C.border, color: C.primary }}>
                  <BookText className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                </div>
                <div className="min-w-0">
                  <h1 id="activities-library-title" className="text-base font-black leading-tight sm:text-xl" style={{ color: C.text }}>
                    {isAr ? "مكتبة الأنشطة" : "Activities Library"}
                  </h1>
                  <p className="mt-0.5 text-[9px] sm:text-xs" style={{ color: C.muted }}>
                    {isAr ? "اكتشف أنشطة تعليمية جاهزة وابدأ استخدامها مع طلابك" : "Discover ready-made activities and use them with your students"}
                  </p>
                </div>
              </div>
              <Link href="/teacher/new">
                <button
                  type="button"
                  className="flex min-h-9 items-center justify-center gap-1 rounded-xl px-2.5 text-[10px] font-black text-white shadow-sm transition-all hover:brightness-105 sm:min-h-10 sm:gap-1.5 sm:px-4 sm:text-xs"
                  style={{ background: C.primary, fontFamily: "inherit" }}
                >
                  <Plus className="h-4 w-4" />
                  <span className="sm:hidden">{isAr ? "شارك" : "Share"}</span>
                  <span className="hidden sm:inline">{isAr ? "شارك نشاطاً" : "Share activity"}</span>
                </button>
              </Link>
            </div>

            <div className="relative">
              <Search className={cn("pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2", isAr ? "right-3.5" : "left-3.5")} style={{ color: C.muted }} />
              <input
                aria-label={isAr ? "البحث في مكتبة الأنشطة" : "Search activities library"}
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={isAr ? "ابحث في الأنشطة..." : "Search activities..."}
                className={cn("min-h-10 w-full rounded-xl border bg-white py-2 text-xs outline-none transition-colors focus:ring-2 focus:ring-[#225739]/15 sm:min-h-11 sm:py-2.5 sm:text-sm", isAr ? "pr-10 pl-10" : "pl-10 pr-10")}
                style={{ borderColor: search ? C.primary : C.border, color: C.text, fontFamily: "inherit" }}
              />
              {search && (
                <button type="button" aria-label={isAr ? "مسح البحث" : "Clear search"} onClick={() => onSearchChange("")} className={cn("absolute top-1/2 -translate-y-1/2 rounded-lg p-2", isAr ? "left-1.5" : "right-1.5")} style={{ color: C.muted }}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-1.5 rounded-2xl border border-[#e8e1d8]/70 bg-[#fcfbf8] p-1.5 sm:space-y-2 sm:p-2">
              <div className="library-horizontal-scroll flex max-w-full flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x sm:flex-wrap sm:overflow-visible">
                {typeFilters.map(filter => {
                  const active = typeChip === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => applyTypeFilter(filter.id)}
                      aria-pressed={active}
                      className="flex min-h-8 shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-bold transition-all sm:min-h-10 sm:px-4 sm:text-xs"
                      style={{
                        borderColor: active ? C.primary : C.border,
                        background: active ? C.primary : C.card,
                        color: active ? "#fff" : C.muted,
                        fontFamily: "inherit",
                      }}
                    >
                      {filter.icon}
                      {isAr ? filter.ar : filter.en}
                    </button>
                  );
                })}
              </div>
            <div className="hidden border-t border-[#e8e1d8]/70 px-1 pb-1 pt-2 sm:block">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <span className="sr-only">{isAr ? "المادة الدراسية" : "Subject"}</span>
                  <select
                    aria-label={isAr ? "المادة الدراسية" : "Subject"}
                    value={subjectFilter}
                    onChange={e => onSubjectFilterChange(e.target.value)}
                    className="min-h-10 w-40 appearance-none rounded-xl border bg-white px-3 pe-8 text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#225739]/15 sm:w-44 sm:text-xs"
                    style={{ borderColor: subjectFilter ? C.primary : C.border, color: subjectFilter ? C.text : C.muted, fontFamily: "inherit" }}
                  >
                    <option value="">{isAr ? "المادة: الكل" : "Subject: All"}</option>
                    {allSubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                  <ChevronDown className={cn("pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2", isAr ? "left-3" : "right-3")} style={{ color: C.muted }} />
                </label>

                <input
                  aria-label={isAr ? "المرحلة أو الصف" : "Grade"}
                  value={gradeFilter}
                  onChange={e => onGradeFilterChange(e.target.value)}
                  list="lib-grades-toolbar"
                  placeholder={isAr ? "الصف: الكل" : "Grade: All"}
                  className="min-h-10 w-36 rounded-xl border bg-white px-3 text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#225739]/15 sm:w-40 sm:text-xs"
                  style={{ borderColor: gradeFilter ? C.primary : C.border, color: C.text, fontFamily: "inherit" }}
                />
                <datalist id="lib-grades-toolbar">{allGrades.map(grade => <option key={grade} value={grade} />)}</datalist>

                <label className="relative">
                  <span className="sr-only">{isAr ? "الترتيب" : "Sort"}</span>
                  <select
                    aria-label={isAr ? "الترتيب" : "Sort"}
                    value={sortBy}
                    onChange={e => onSortByChange(e.target.value as "newest" | "questions")}
                    className="min-h-10 w-36 appearance-none rounded-xl border bg-white px-3 pe-8 text-[11px] font-bold outline-none focus:ring-2 focus:ring-[#225739]/15 sm:w-40 sm:text-xs"
                    style={{ borderColor: C.border, color: C.text, fontFamily: "inherit" }}
                  >
                    <option value="newest">{isAr ? "الترتيب: الأحدث" : "Sort: Newest"}</option>
                    <option value="questions">{isAr ? "الأكثر أسئلة" : "Most questions"}</option>
                  </select>
                  <ChevronDown className={cn("pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2", isAr ? "left-3" : "right-3")} style={{ color: C.muted }} />
                </label>

                {isAdmin && (
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 text-[11px] font-bold sm:text-xs" style={{ borderColor: showHidden ? C.gold : C.border, color: showHidden ? C.text : C.muted }}>
                    <input type="checkbox" checked={showHidden} onChange={e => onShowHiddenChange(e.target.checked)} className="accent-[#225739]" />
                    <EyeOff className="h-3.5 w-3.5" />
                    {isAr ? "عرض المخفي" : "Show hidden"}
                  </label>
                )}
              </div>
            </div>
            <div className="library-horizontal-scroll flex max-w-full min-w-0 flex-nowrap gap-1.5 overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x sm:hidden">
              <label className="relative min-w-[132px] shrink-0">
                <span className="sr-only">{isAr ? "المادة الدراسية" : "Subject"}</span>
                <select
                  aria-label={isAr ? "المادة الدراسية" : "Subject"}
                  value={subjectFilter}
                  onChange={e => onSubjectFilterChange(e.target.value)}
                  className="h-9 w-full appearance-none rounded-xl border bg-white px-2.5 pe-7 text-[10px] font-bold outline-none focus:ring-2 focus:ring-[#225739]/15"
                  style={{ borderColor: subjectFilter ? C.primary : C.border, color: subjectFilter ? C.text : C.muted, fontFamily: "inherit" }}
                >
                  <option value="">{isAr ? "المادة: الكل" : "Subject: All"}</option>
                  {allSubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
                </select>
                <ChevronDown className={cn("pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2", isAr ? "left-2.5" : "right-2.5")} style={{ color: C.muted }} />
              </label>

              <input
                aria-label={isAr ? "المرحلة أو الصف" : "Grade"}
                value={gradeFilter}
                onChange={e => onGradeFilterChange(e.target.value)}
                list="lib-grades-mobile-toolbar"
                placeholder={isAr ? "الصف: الكل" : "Grade: All"}
                className="h-9 w-[112px] shrink-0 rounded-xl border bg-white px-2.5 text-[10px] font-bold outline-none focus:ring-2 focus:ring-[#225739]/15"
                style={{ borderColor: gradeFilter ? C.primary : C.border, color: C.text, fontFamily: "inherit" }}
              />
              <datalist id="lib-grades-mobile-toolbar">{allGrades.map(grade => <option key={grade} value={grade} />)}</datalist>

              <label className="relative min-w-[118px] shrink-0">
                <span className="sr-only">{isAr ? "الترتيب" : "Sort"}</span>
                <select
                  aria-label={isAr ? "الترتيب" : "Sort"}
                  value={sortBy}
                  onChange={e => onSortByChange(e.target.value as "newest" | "questions")}
                  className="h-9 w-full appearance-none rounded-xl border bg-white px-2.5 pe-7 text-[10px] font-bold outline-none"
                  style={{ borderColor: C.border, color: C.text, fontFamily: "inherit" }}
                >
                  <option value="newest">{isAr ? "الترتيب: الأحدث" : "Sort: Newest"}</option>
                  <option value="questions">{isAr ? "الأكثر أسئلة" : "Most questions"}</option>
                </select>
                <ChevronDown className={cn("pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2", isAr ? "left-2.5" : "right-2.5")} style={{ color: C.muted }} />
              </label>

              <button
                type="button"
                onClick={() => setFilterSheetOpen(true)}
                className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border bg-white px-3 text-[10px] font-extrabold transition-colors active:scale-[0.98]"
                style={{ borderColor: activeFilterCount > 0 ? C.primary : C.border, color: C.primary, fontFamily: "inherit" }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{isAr ? "فلاتر" : "Filters"}</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white" style={{ background: C.primary }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            </div>
          </section>

          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetContent
              side="bottom"
              dir={dir}
              className="h-[min(86vh,680px)] max-h-[86vh] overflow-y-auto rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:hidden"
              style={{ background: C.bg, color: C.text }}
            >
              <SheetHeader className="pe-8 text-start">
                <SheetTitle style={{ color: C.text }}>{isAr ? "تصفية الأنشطة" : "Filter activities"}</SheetTitle>
                <SheetDescription style={{ color: C.muted }}>
                  {isAr ? "اختر ما تريد عرضه ثم اضغط عرض النتائج." : "Choose what to show, then apply the results."}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-5">
                <section aria-labelledby="mobile-type-filter">
                  <h2 id="mobile-type-filter" className="mb-3 text-xs font-black" style={{ color: C.muted }}>
                    {isAr ? "نوع النشاط" : "Activity type"}
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {typeFilters.map(f => {
                      const active = typeChip === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => applyTypeFilter(f.id)}
                          aria-pressed={active}
                          className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-start text-xs font-bold transition-colors"
                          style={{
                            borderColor: active ? C.primary : C.border,
                            background: active ? C.soft : C.card,
                            color: active ? C.primary : C.muted,
                            fontFamily: "inherit",
                          }}
                        >
                          <span style={{ color: active ? C.primary : C.muted }}>{f.icon}</span>
                          <span className="min-w-0 flex-1 truncate">{isAr ? f.ar : f.en}</span>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section aria-labelledby="mobile-subject-filter">
                  <h2 id="mobile-subject-filter" className="mb-3 text-xs font-black" style={{ color: C.muted }}>
                    {isAr ? "المادة الدراسية" : "Subject"}
                  </h2>
                  <div className="relative">
                    <select
                      aria-label={isAr ? "المادة الدراسية" : "Subject"}
                      value={subjectFilter}
                      onChange={e => onSubjectFilterChange(e.target.value)}
                      className="min-h-11 w-full appearance-none rounded-xl border bg-white px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#225739]/15"
                      style={{ borderColor: subjectFilter ? C.primary : C.border, color: subjectFilter ? C.text : C.muted, fontFamily: "inherit" }}
                    >
                      <option value="">{isAr ? "كل المواد" : "All subjects"}</option>
                      {allSubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
                    </select>
                    <ChevronDown className={cn("pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2", isAr ? "left-3" : "right-3")} style={{ color: C.muted }} />
                  </div>
                </section>

                <section aria-labelledby="mobile-grade-filter">
                  <h2 id="mobile-grade-filter" className="mb-3 text-xs font-black" style={{ color: C.muted }}>
                    {isAr ? "المرحلة / الصف" : "Grade"}
                  </h2>
                  <input
                    aria-label={isAr ? "المرحلة أو الصف" : "Grade"}
                    value={gradeFilter}
                    onChange={e => onGradeFilterChange(e.target.value)}
                    list="lib-grades-mobile"
                    placeholder={isAr ? "اختر أو اكتب الصف..." : "Choose or type a grade..."}
                    className="min-h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#225739]/15"
                    style={{ borderColor: C.border, color: C.text, fontFamily: "inherit" }}
                  />
                  <datalist id="lib-grades-mobile">{allGrades.map(g => <option key={g} value={g} />)}</datalist>
                  {allGrades.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {allGrades.map(grade => {
                        const active = gradeFilter === grade;
                        return (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => onGradeFilterChange(active ? "" : grade)}
                            aria-pressed={active}
                            className="min-h-11 rounded-xl border px-3 text-xs font-bold transition-colors"
                            style={{
                              borderColor: active ? C.primary : C.border,
                              background: active ? C.soft : C.card,
                              color: active ? C.primary : C.muted,
                              fontFamily: "inherit",
                            }}
                          >
                            {active && <Check className="me-1 inline h-3 w-3" />}
                            {grade}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {isAdmin && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border bg-white px-3 text-sm font-bold" style={{ borderColor: showHidden ? C.gold : C.border, color: showHidden ? C.text : C.muted }}>
                    <input type="checkbox" checked={showHidden} onChange={e => onShowHiddenChange(e.target.checked)} className="accent-[#225739]" />
                    <EyeOff className="h-4 w-4" />
                    {isAr ? "عرض المخفي" : "Show hidden"}
                  </label>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={clearMobileFilters}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border bg-white px-3 text-sm font-extrabold"
                  style={{ borderColor: C.border, color: C.muted, fontFamily: "inherit" }}
                >
                  <RotateCcw className="h-4 w-4" />
                  {isAr ? "إعادة ضبط" : "Reset"}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  className="min-h-12 rounded-2xl px-3 text-sm font-extrabold text-white shadow-sm"
                  style={{ background: C.primary, fontFamily: "inherit" }}
                >
                  {isAr ? "عرض النتائج" : "Show results"}
                </button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Stats bar */}
          <div
            className="hidden"
            style={{ borderColor: C.border }}
          >
            {statsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className="h-10 w-10 animate-pulse rounded-xl" style={{ background: C.soft }} />
                    <div>
                      <div className="mb-1.5 h-6 w-16 animate-pulse rounded-md" style={{ background: C.border }} />
                      <div className="h-3 w-24 animate-pulse rounded" style={{ background: C.border }} />
                    </div>
                  </div>
                ))
              : statsLabels.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: C.soft, color: C.primary }}>
                      {s.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-black leading-none sm:text-xl" style={{ color: C.text }}>{s.value || "—"}</p>
                      <p className="mt-1 truncate text-[9px] sm:text-[10px]" style={{ color: C.muted }}>{s.label}</p>
                    </div>
                    {i < 3 && <div className="ms-auto h-9 w-px" style={{ background: C.border }} />}
                  </div>
                ))
            }
          </div>

          {/* Trending now */}
          {trendingNow.length > 0 && (
            <section className="mb-4 sm:mb-5">
              <div className="mb-2.5 flex items-center justify-between sm:mb-3">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-0.5 rounded-full" style={{ background: `linear-gradient(to bottom,${C.gold},${C.primary})` }} />
                  <Radio className="h-4 w-4" style={{ color: C.primary }} />
                  <h2 className="text-[15px] font-black sm:text-[17px]" style={{ color: C.text }}>{isAr ? "رائج الآن" : "Trending now"}</h2>
                </div>
                <button type="button" className="flex items-center gap-1 text-xs font-bold" style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontFamily: "inherit" }}>
                  {isAr ? "عرض الكل" : "See all"} <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                {trendingNow.map((item, idx) => (
                  <article
                    key={item.key}
                    className="group min-w-0 overflow-hidden rounded-xl border bg-white text-start transition-all duration-200 hover:shadow-md sm:rounded-2xl"
                    style={{ borderColor: C.border, boxShadow: "0 1px 5px rgba(31,45,36,0.045)" }}
                  >
                    <div className="relative h-[138px] overflow-hidden sm:h-[145px] lg:h-[150px]">
                      <ActivityCover className="h-full" kind={resolveCoverKind(item.kind, item.type)} subject={item.subject} title={item.title} type={item.type} aspect="video">
                        <span className={cn("absolute top-2.5 z-10 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[9px] font-extrabold shadow-sm", dir === "rtl" ? "right-2.5" : "left-2.5")} style={{ color: C.primary }}>
                          {idx === 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: C.gold }} />}
                          {idx === 0 ? (isAr ? "نشط الآن" : "Active now") : item.typeLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleBookmark(item.id)}
                          aria-label={bookmarks.has(item.id) ? (isAr ? "إزالة من المحفوظات" : "Remove bookmark") : (isAr ? "حفظ النشاط" : "Save activity")}
                          className={cn("absolute top-2.5 z-10 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors", dir === "rtl" ? "left-2.5" : "right-2.5")}
                          style={{ color: bookmarks.has(item.id) ? C.gold : C.muted }}
                        >
                          <Bookmark className={cn("h-3.5 w-3.5", bookmarks.has(item.id) && "fill-current")} />
                        </button>
                      </ActivityCover>
                    </div>
                    <div className="p-2.5 sm:p-3">
                      <p className="line-clamp-2 text-[12px] font-black leading-snug sm:text-[13px]" style={{ color: C.text }}>{item.title}</p>
                      <p className="mt-1 truncate text-[9px] font-medium sm:text-[10px]" style={{ color: C.muted }}>
                        {[item.subject, item.typeLabel, item.questionCount != null ? `${item.questionCount} ${isAr ? "سؤال" : "Q"}` : null].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-semibold" style={{ color: C.muted }}>{item.activeLabel}</span>
                        <button
                          type="button"
                          onClick={() => item.kind === "assignment" ? launchAsGame(item.id) : onActiveTabChange("videos")}
                          className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[10px] font-black text-white transition-all hover:brightness-105"
                          style={{ background: C.primary }}
                        >
                          <Play className="h-3 w-3 fill-current" />
                          {isAr ? "ابدأ" : "Start"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Category tabs + view toggle */}
          <div className="mb-3.5 flex items-center justify-between gap-2 overflow-x-auto sm:mb-4">
            <div className="flex shrink-0 gap-1 rounded-xl border bg-white p-1 sm:rounded-2xl" style={{ borderColor: C.border }}>
              {categoryTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryTab(tab.id)}
                  className="rounded-lg px-2.5 py-1.5 text-[10px] transition-all sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                  style={{ fontFamily: "inherit", fontWeight: categoryTab === tab.id ? 800 : 600, background: categoryTab === tab.id ? C.primary : "transparent", color: categoryTab === tab.id ? "#fff" : C.muted, border: "none", cursor: "pointer" }}
                >
                  {isAr ? tab.ar : tab.en}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <button type="button" onClick={clearMobileFilters} className="text-xs font-bold underline" style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontFamily: "inherit" }}>
                  {isAr ? "× مسح الفلاتر" : "× Clear filters"}
                </button>
              )}
              <div className="flex gap-1">
                {(["grid", "list"] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setViewMode(v)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all"
                    style={{ borderColor: viewMode === v ? C.primary : C.border, background: viewMode === v ? C.soft : C.card, color: viewMode === v ? C.primary : C.muted, cursor: "pointer" }}
                  >
                    {v === "grid" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results count */}
          <p className="mb-3 text-[11px] font-semibold sm:mb-4 sm:text-xs" style={{ color: C.muted }}>{totalShown} {isAr ? "نشاط" : "activities"}</p>

          {/* Content — Assignments */}
          {activeTab === "assignments" && (
            displayAssignments.length + displayGameActivities.length > 0
              ? viewMode === "grid"
                ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {displayAssignments.map((a, i) => renderAssignmentCard(a, i))}
                    {displayGameActivities.map((game, i) => renderGameActivityCard(game, displayAssignments.length + i))}
                  </div>
                : <div className="flex flex-col gap-2.5">
                    {displayAssignments.map((a, i) => renderListRow(a, i))}
                  </div>
              : <EmptyState isAr={isAr} icon={<BookText className="w-8 h-8" />} title={isAr ? "لا توجد أنشطة" : "No activities"} />
          )}

          {/* Content — Videos */}
          {activeTab === "videos" && (
            displayVideos.length > 0
              ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {displayVideos.map((v, i) => (
                    <motion.article key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:border-[#225739]/25 hover:shadow-md sm:rounded-2xl"
                      style={{ borderColor: C.border, boxShadow: "0 1px 5px rgba(31,45,36,0.045)" }}
                    >
                      <ActivityCover className="aspect-[1.9/1]" kind="video" subject={v.subject} title={v.title} aspect="video">
                        <span className={cn("absolute top-2 z-10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", "bg-blue-600/90")}>
                          {isAr ? "فيديو" : "Video"}
                        </span>
                      </ActivityCover>
                      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                        <p className="line-clamp-2 text-[11px] font-black sm:text-[13px]" style={{ color: C.text }}>{v.title}</p>
                        {v.description && <p className="mt-1 hidden line-clamp-1 text-xs sm:block" style={{ color: C.muted }}>{v.description}</p>}
                        <p className="mt-1 truncate text-[10px] font-semibold sm:text-[11px]" style={{ color: C.muted }}>{[v.subject, v.targetClass, `${v.questionCount} ${isAr ? "سؤال" : "Q"}`].filter(Boolean).join(" · ")}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[9px] sm:mt-2 sm:text-[10px]" style={{ color: C.muted }}>
                          {!statsError && <span>{formatUseCount(videoUseCount(v.id))} {isAr ? "استخدام" : "uses"}</span>}
                          {v.teacherName && <span className="flex items-center gap-1 truncate"><User className="w-3 h-3" />{v.teacherName}</span>}
                        </div>
                        <div className="mt-2.5 flex gap-1 border-t pt-2.5 sm:mt-3 sm:gap-1.5 sm:pt-3" style={{ borderColor: C.border }}>
                          <button type="button" onClick={() => importVideo(v.id)} disabled={importingVIds.has(v.id) || v.teacherId === currentTeacherId} className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold text-white disabled:opacity-40 sm:gap-1.5 sm:rounded-xl sm:py-2 sm:text-xs" style={{ background: C.primary }}>
                            {importingVIds.has(v.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : importedVIds.has(v.id) ? <><CheckCircle2 className="w-3.5 h-3.5" />{isAr ? "تم الاستيراد" : "Imported"}</> : <><Download className="w-3.5 h-3.5" />{isAr ? "استيراد" : "Import"}</>}
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              : <EmptyState isAr={isAr} icon={<Video className="w-8 h-8" />} title={isAr ? "لا توجد دروس فيديو" : "No video lessons"} />
          )}

          {/* Content — Questions */}
          {activeTab === "questions" && (
            displayQuestions.length > 0
              ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {displayQuestions.map((q, i) => (
                    <motion.article key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md sm:rounded-2xl"
                      style={{ borderColor: C.border }}
                    >
                      <ActivityCover className="aspect-[1.9/1]" kind="interactive" subject={q.subject} title={q.text.slice(0, 40)} tags={q.tags ?? undefined} imageUrl={q.imageUrl} aspect="video">
                        <span className={cn("absolute top-2 z-10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", "bg-violet-600/90")}>{isAr ? "تفاعلي" : "Interactive"}</span>
                      </ActivityCover>
                      <div className="p-2.5 sm:p-4">
                        <p className="line-clamp-3 text-[11px] font-bold sm:text-sm" style={{ color: C.text }}>{q.text}</p>
                        <p className="mt-1.5 text-[9px] sm:mt-2 sm:text-xs" style={{ color: C.muted }}>{[q.subject, `${q.points} ${isAr ? "نقطة" : "pts"}`].filter(Boolean).join(" · ")}</p>
                        {q.teacherName && <p className="mt-1 flex items-center gap-1 truncate text-[9px] sm:text-[11px]" style={{ color: C.muted }}><User className="h-3 w-3" />{q.teacherName}</p>}
                        <button type="button" onClick={() => importQuestion(q.id)} disabled={importingQIds.has(q.id)} className="mt-2 w-full rounded-lg px-2 py-1.5 text-[10px] font-bold text-white sm:mt-3 sm:rounded-xl sm:px-4 sm:py-2 sm:text-xs" style={{ background: C.primary }}>
                          {importingQIds.has(q.id) ? <Loader2 className="mx-auto w-4 h-4 animate-spin" /> : isAr ? "استيراد" : "Import"}
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </div>
              : <EmptyState isAr={isAr} icon={<HelpCircle className="w-8 h-8" />} title={isAr ? "لا توجد أسئلة" : "No questions"} />
          )}

          {/* Content — Presentations */}
          {activeTab === "presentations" && (
            displayPresentations.length > 0
              ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {displayPresentations.map((presentation, i) => (
                    <motion.article
                      key={presentation.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:border-[#225739]/25 hover:shadow-md sm:rounded-2xl"
                      style={{ borderColor: C.border, boxShadow: "0 1px 5px rgba(31,45,36,0.045)" }}
                    >
                      <ActivityCover className="aspect-[1.9/1]" kind="presentation" title={presentation.title} aspect="video">
                        <span className={cn("absolute top-2 z-10 rounded-lg bg-violet-700/90 px-2 py-0.5 text-[10px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2")}>
                          {isAr ? "عرض تفاعلي" : "Interactive presentation"}
                        </span>
                      </ActivityCover>
                      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
                        <p className="line-clamp-2 text-[11px] font-black sm:text-[13px]" style={{ color: C.text }}>{presentation.title}</p>
                        <p className="mt-1 text-[9px] sm:text-[11px]" style={{ color: C.muted }}>
                          {presentation.slideCount} {isAr ? "شريحة" : "slides"}
                        </p>
                        {presentation.teacherName && (
                          <p className="mt-1 flex items-center gap-1 truncate text-[9px] sm:text-[10px]" style={{ color: C.muted }}>
                            <User className="h-3 w-3" />{presentation.teacherName}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => openPresentation(presentation.id)}
                          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-bold text-white sm:mt-3 sm:rounded-xl sm:py-2 sm:text-xs"
                          style={{ background: C.primary }}
                        >
                          <Presentation className="h-3.5 w-3.5" />
                          {isAr ? "فتح العرض" : "Open presentation"}
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </div>
              : <EmptyState isAr={isAr} icon={<Presentation className="w-8 h-8" />} title={isAr ? "لا توجد عروض تفاعلية" : "No interactive presentations"} />
          )}
        </main>
      </div>
    </div>
  );
}

function EmptyState({ isAr, icon, title }: { isAr: boolean; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border bg-white py-16 text-center" style={{ borderColor: C.border }}>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: C.soft, color: `${C.primary}66` }}>{icon}</div>
      <p className="font-bold" style={{ color: C.text }}>{title}</p>
      <p className="mt-1 text-sm" style={{ color: C.muted }}>{isAr ? "جرّب تغيير الفلاتر" : "Try changing filters"}</p>
    </div>
  );
}
