/**
 * مكتبة الأنشطة — واجهة Marketplace (عرض فقط، المنطق من shared-content)
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  FolderOpen,
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
  MoreVertical,
  User,
  Bookmark,
  Presentation,
  ClipboardList,
  Sparkles,
  TrendingUp,
  Radio,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ActivityCover,
  formatUseCount,
  resolveCoverKind,
  resolveSubjectTheme,
} from "@/lib/activity-cover";

const FILTER_INPUT =
  "h-10 rounded-xl border border-[#e8e1d8] bg-[#fcfbfa] text-sm text-[#1f2d24] shadow-[inset_0_1px_2px_rgba(31,45,36,0.04)] outline-none transition-shadow placeholder:text-[#9aa89f] focus:border-[#0a4d26]/35 focus:ring-2 focus:ring-[#0a4d26]/10";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ActivityLibraryStats {
  totalActivities: number;
  contributingTeachers: number;
  totalUses: number;
  newThisWeek: number;
  assignmentUses: Record<string, number>;
  videoUses: Record<string, number>;
  presentationUses: number;
  questionUsesTracked: boolean;
}

const C = {
  bg: "#faf8f3",
  card: "#ffffff",
  primary: "#0a4d26",
  soft: "#e8f4ec",
  gold: "#d4a63a",
  border: "#e8e1d8",
  text: "#1f2d24",
  muted: "#6f8176",
} as const;

type Tab = "assignments" | "questions" | "videos";
type CategoryTab = "all" | "popular" | "new" | "featured" | "peers";
type TypeChip = "all" | "homework" | "quiz" | "presentation" | "video" | "live" | "interactive";

export interface MarketplaceAssignment {
  id: number;
  title: string;
  type: string;
  questionCount: number;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  hiddenByAdmin?: boolean;
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
  hiddenByAdmin?: boolean;
  questionCount: number;
  createdAt: string;
}

export interface ActivitiesLibraryMarketplaceProps {
  embedded?: boolean;
  lang: "ar" | "en";
  dir: "rtl" | "ltr";
  assignments: MarketplaceAssignment[];
  questions: MarketplaceQuestion[];
  videoLessons: MarketplaceVideo[];
  filteredAssignments: MarketplaceAssignment[];
  filteredQuestions: MarketplaceQuestion[];
  filteredVideos: MarketplaceVideo[];
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
  onPresentations: () => void;
  launchAsGame: (id: number, mode?: "classic" | "teams") => void;
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
  if (kind === "video") return { label: isAr ? "فيديو" : "Video", cls: "bg-blue-600/90" };
  if (kind === "question") return { label: isAr ? "تفاعلي" : "Interactive", cls: "bg-violet-600/90" };
  if (type === "mcq") return { label: isAr ? "مسابقة مباشرة" : "Live quiz", cls: "bg-emerald-700/90" };
  if (type === "true_false") return { label: isAr ? "اختبار" : "Quiz", cls: "bg-amber-600/90" };
  return { label: isAr ? "واجب" : "Assignment", cls: "bg-[#0a4d26]/90" };
}

export function ActivitiesLibraryMarketplace(props: ActivitiesLibraryMarketplaceProps) {
  const {
    embedded,
    lang,
    dir,
    assignments,
    questions,
    videoLessons,
    filteredAssignments,
    filteredQuestions,
    filteredVideos,
    popularIds,
    newIds,
    currentTeacherId,
    isAdmin,
    showHidden,
    onShowHiddenChange,
    search,
    onSearchChange,
    subjectFilter,
    onSubjectFilterChange,
    gradeFilter,
    onGradeFilterChange,
    sortBy,
    onSortByChange,
    allSubjects,
    allGrades,
    activeTab,
    onActiveTabChange,
    onClearFilters,
    onPresentations,
    launchAsGame,
    importAssignment,
    copyLink,
    dismissAssignment,
    importQuestion,
    dismissQuestion,
    importVideo,
    launchingIds,
    importingIds,
    importedIds,
    importingQIds,
    importedQIds,
    importingVIds,
    importedVIds,
    dismissingIds,
    t,
  } = props;

  const isAr = lang === "ar";
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("all");
  const [typeChip, setTypeChip] = useState<TypeChip>("all");
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [libraryStats, setLibraryStats] = useState<ActivityLibraryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      setStatsError(false);
      try {
        const statsUrl = API_BASE
          ? `${API_BASE}/api/teacher/activity-library/stats`
          : "/api/teacher/activity-library/stats";
        const res = await fetch(statsUrl, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("stats failed");
        const data = (await res.json()) as ActivityLibraryStats;
        if (!cancelled) setLibraryStats(data);
      } catch {
        if (!cancelled) {
          setStatsError(true);
          setLibraryStats(null);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const assignmentUseCount = (id: number) => libraryStats?.assignmentUses[String(id)] ?? 0;
  const videoUseCount = (id: number) => libraryStats?.videoUses[String(id)] ?? 0;

  const toggleBookmark = (id: number) => {
    setBookmarks((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const isRecent = (createdAt: string) =>
    Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;

  const filterByCategory = <T extends { id: number; isAdminContent?: boolean; teacherId: number; createdAt: string }>(
    list: T[],
    opts?: { popularCheck?: (item: T) => boolean },
  ): T[] => {
    if (categoryTab === "all") return list;
    if (categoryTab === "popular") {
      return list.filter((item) =>
        popularIds.has(item.id) || opts?.popularCheck?.(item),
      );
    }
    if (categoryTab === "new") {
      return list.filter((item) => newIds.has(item.id) || isRecent(item.createdAt));
    }
    if (categoryTab === "featured") return list.filter((item) => item.isAdminContent);
    if (categoryTab === "peers") {
      return list.filter((item) => item.teacherId !== currentTeacherId && !item.isAdminContent);
    }
    return list;
  };

  const displayAssignments = useMemo(() => {
    let list = filterByCategory(filteredAssignments);
    if (typeChip === "quiz") list = list.filter((a) => a.type === "mcq" || a.type === "mixed");
    if (typeChip === "live") list = list.filter((a) => a.type === "mcq" && a.questionCount > 0);
    if (typeChip === "homework") list = list.filter((a) => a.type !== "mcq" || a.questionCount < 15);
    return list;
  }, [filteredAssignments, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const displayVideos = useMemo(() => {
    if (typeChip !== "all" && typeChip !== "video") return [];
    return filterByCategory(filteredVideos, {
      popularCheck: (v) => v.questionCount >= 5,
    });
  }, [filteredVideos, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const displayQuestions = useMemo(() => {
    if (typeChip !== "all" && typeChip !== "interactive") return [];
    return filterByCategory(filteredQuestions, {
      popularCheck: (q) => q.points >= 2,
    });
  }, [filteredQuestions, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const wameethPick = useMemo(() => {
    const mcq = assignments.filter((a) => a.type === "mcq" && a.questionCount > 0 && !a.hiddenByAdmin);
    return (
      mcq.find((a) => a.title.includes("وميض") || a.title.toLowerCase().includes("wameeth")) ||
      [...mcq].sort((a, b) => b.questionCount - a.questionCount)[0]
    );
  }, [assignments]);

  const newWeekItems = useMemo(() => {
    const items: { key: string; kind: "assignment" | "video" | "question"; id: number; title: string; subject?: string | null; grade?: string | null; meta: string; teacher?: string | null; type?: string }[] = [];
    for (const a of displayAssignments.filter((x) => newIds.has(x.id)).slice(0, 8)) {
      items.push({
        key: `a-${a.id}`,
        kind: "assignment",
        id: a.id,
        title: a.title,
        subject: a.subject,
        grade: a.targetClass,
        meta: `${a.questionCount} ${isAr ? "سؤال" : "questions"}`,
        teacher: a.teacherName,
        type: a.type,
      });
    }
    for (const v of displayVideos.filter((x) => newIds.has(x.id)).slice(0, 4)) {
      items.push({
        key: `v-${v.id}`,
        kind: "video",
        id: v.id,
        title: v.title,
        subject: v.subject,
        grade: v.targetClass,
        meta: `${v.questionCount} ${isAr ? "سؤال" : "Q"}`,
        teacher: v.teacherName,
      });
    }
    if (items.length < 6) {
      for (const a of displayAssignments.slice(0, 6 - items.length)) {
        if (!items.some((i) => i.key === `a-${a.id}`)) {
          items.push({
            key: `a-${a.id}`,
            kind: "assignment",
            id: a.id,
            title: a.title,
            subject: a.subject,
            grade: a.targetClass,
            meta: `${a.questionCount} ${isAr ? "سؤال" : "questions"}`,
            teacher: a.teacherName,
            type: a.type,
          });
        }
      }
    }
    return items.slice(0, 10);
  }, [displayAssignments, displayVideos, newIds, isAr]);

  const categoryTabs: { id: CategoryTab; ar: string; en: string }[] = [
    { id: "all", ar: "الكل", en: "All" },
    { id: "popular", ar: "الأكثر استخداماً", en: "Most used" },
    { id: "new", ar: "جديد هذا الأسبوع", en: "New this week" },
    { id: "featured", ar: "أنشطة مميزة", en: "Featured" },
    { id: "peers", ar: "أنشطة من معلميني", en: "From teachers" },
  ];

  const typeChips: { id: TypeChip; ar: string; en: string; icon: React.ReactNode }[] = [
    { id: "all", ar: "كل الأنواع", en: "All types", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "homework", ar: "واجبات", en: "Homework", icon: <BookText className="w-3.5 h-3.5" /> },
    { id: "quiz", ar: "اختبارات", en: "Quizzes", icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: "presentation", ar: "عروض تفاعلية", en: "Presentations", icon: <Presentation className="w-3.5 h-3.5" /> },
    { id: "video", ar: "فيديوهات", en: "Videos", icon: <Video className="w-3.5 h-3.5" /> },
    { id: "live", ar: "مسابقات مباشرة", en: "Live quizzes", icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "interactive", ar: "أنشطة تفاعلية", en: "Interactive", icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  const statsLabels = [
    { icon: <BookText className="w-4 h-4 text-[#0a4d26]" />, label: isAr ? "نشاط جاهز" : "Ready activities", value: formatUseCount(libraryStats?.totalActivities) },
    { icon: <Users className="w-4 h-4 text-[#0a4d26]" />, label: isAr ? "معلم مشارك" : "Contributing teachers", value: formatUseCount(libraryStats?.contributingTeachers) },
    { icon: <TrendingUp className="w-4 h-4 text-[#0a4d26]" />, label: isAr ? "مرات الاستخدام" : "Total uses", value: formatUseCount(libraryStats?.totalUses) },
    { icon: <Zap className="w-4 h-4 text-[#0a4d26]" />, label: isAr ? "جديد هذا الأسبوع" : "New this week", value: formatUseCount(libraryStats?.newThisWeek) },
  ];

  const topVideoByUses = useMemo(() => {
    if (!libraryStats?.videoUses) return videoLessons[0];
    let best = videoLessons[0];
    let max = -1;
    for (const v of videoLessons) {
      const u = libraryStats.videoUses[String(v.id)] ?? 0;
      if (u > max) {
        max = u;
        best = v;
      }
    }
    return best;
  }, [videoLessons, libraryStats]);

  const trendingNow = useMemo(() => {
    type Trend = {
      key: string;
      title: string;
      kind: "assignment" | "video";
      id: number;
      type?: string;
      subject?: string | null;
      uses: number;
      typeLabel: string;
      activeLabel: string;
    };
    const out: Trend[] = [];

    if (wameethPick) {
      const u = libraryStats?.assignmentUses[String(wameethPick.id)] ?? 0;
      out.push({
        key: `w-${wameethPick.id}`,
        title: wameethPick.title,
        kind: "assignment",
        id: wameethPick.id,
        type: wameethPick.type,
        subject: wameethPick.subject,
        uses: u,
        typeLabel: isAr ? "مسابقة مباشرة" : "Live quiz",
        activeLabel: isAr
          ? (u > 0 ? `${formatUseCount(u)} استخدام حديث` : "جاهز للتشغيل")
          : (u > 0 ? `${formatUseCount(u)} recent uses` : "Ready to launch"),
      });
    }

    const sciencePick = [...assignments]
      .filter((a) => resolveSubjectTheme(a.subject) === "science" && a.id !== wameethPick?.id)
      .sort((a, b) => assignmentUseCount(b.id) - assignmentUseCount(a.id))[0];
    if (sciencePick) {
      const u = libraryStats?.assignmentUses[String(sciencePick.id)] ?? 0;
      out.push({
        key: `a-${sciencePick.id}`,
        title: sciencePick.title,
        kind: "assignment",
        id: sciencePick.id,
        type: sciencePick.type,
        subject: sciencePick.subject,
        uses: u,
        typeLabel: isAr ? "واجب / اختبار" : "Assignment",
        activeLabel: isAr
          ? (u > 0 ? `${formatUseCount(u)} استخدام` : `${sciencePick.questionCount} سؤال`)
          : (u > 0 ? `${formatUseCount(u)} uses` : `${sciencePick.questionCount} Q`),
      });
    }

    if (topVideoByUses) {
      const u = libraryStats?.videoUses[String(topVideoByUses.id)] ?? 0;
      if (!out.some((t) => t.kind === "video" && t.id === topVideoByUses.id)) {
        out.push({
          key: `v-${topVideoByUses.id}`,
          title: topVideoByUses.title,
          kind: "video",
          id: topVideoByUses.id,
          subject: topVideoByUses.subject,
          uses: u,
          typeLabel: isAr ? "فيديو" : "Video",
          activeLabel: isAr
            ? (u > 0 ? `${formatUseCount(u)} مشاهدة` : `${topVideoByUses.questionCount} سؤال`)
            : (u > 0 ? `${formatUseCount(u)} views` : `${topVideoByUses.questionCount} Q`),
        });
      }
    }

    if (out.length < 3) {
      const extra = [...assignments]
        .filter((a) => !out.some((t) => t.kind === "assignment" && t.id === a.id))
        .sort((a, b) => assignmentUseCount(b.id) - assignmentUseCount(a.id))
        .slice(0, 3 - out.length);
      for (const a of extra) {
        const u = libraryStats?.assignmentUses[String(a.id)] ?? 0;
        out.push({
          key: `a-${a.id}`,
          title: a.title,
          kind: "assignment",
          id: a.id,
          type: a.type,
          subject: a.subject,
          uses: u,
          typeLabel: activityBadge("assignment", a.type, isAr).label,
          activeLabel: isAr ? `${formatUseCount(u) || "0"} استخدام` : `${formatUseCount(u) || "0"} uses`,
        });
      }
    }

    return out.slice(0, 4);
  }, [assignments, wameethPick, topVideoByUses, libraryStats, isAr]);

  const renderAssignmentCard = (a: MarketplaceAssignment, i: number, compact?: boolean) => {
    const badge = activityBadge("assignment", a.type, isAr);
    const isOwn = a.teacherId === currentTeacherId;
    const uses = statsError ? undefined : assignmentUseCount(a.id);
    const coverKind = resolveCoverKind("assignment", a.type);
    return (
      <motion.article
        key={a.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i * 0.03, 0.2) }}
        className={cn(
          "group relative flex flex-col rounded-2xl border bg-white transition-all duration-300",
          a.hiddenByAdmin ? "opacity-55 border-dashed border-amber-300" : "hover:-translate-y-1 hover:shadow-lg",
        )}
        style={{ borderColor: C.border, boxShadow: "0 2px 12px rgba(31,45,36,0.06)" }}
      >
        <div className="relative overflow-hidden rounded-t-2xl">
          <ActivityCover kind={coverKind} subject={a.subject} title={a.title} type={a.type} aspect="video">
            <span className={cn("absolute top-2.5 z-10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-sm", dir === "rtl" ? "right-2.5" : "left-2.5", badge.cls)}>
              {badge.label}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark(a.id);
              }}
              className={cn("absolute top-2.5 z-10 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors", dir === "rtl" ? "left-2.5" : "right-2.5", bookmarks.has(a.id) && "text-[#d4a63a]")}
              aria-label={isAr ? "حفظ" : "Bookmark"}
            >
              <Bookmark className={cn("w-3.5 h-3.5", bookmarks.has(a.id) && "fill-current")} />
            </button>
          </ActivityCover>
        </div>
        <div className={cn("flex flex-1 flex-col px-3 pb-3 pt-2.5", compact && "px-2.5 pb-2.5")}>
          <h3 className="line-clamp-2 text-[13px] font-extrabold leading-snug tracking-tight" style={{ color: C.text }}>
            {a.title}
          </h3>
          {a.description ? (
            <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed" style={{ color: "#9aa89f" }}>
              {a.description}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] font-medium tracking-wide" style={{ color: C.muted }}>
            {[a.subject, a.targetClass, `${a.questionCount} ${isAr ? "سؤال" : "Q"}`].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px]" style={{ color: C.muted }}>
            {!statsError && (
              <span>
                {formatUseCount(uses)} {isAr ? "استخدام" : "uses"}
              </span>
            )}
            {a.teacherName && !a.isAdminContent ? (
              <span className="flex min-w-0 items-center gap-1 truncate">
                <User className="w-3 h-3 shrink-0" />
                {a.teacherName}
              </span>
            ) : a.isAdminContent ? (
              <span className="truncate font-semibold" style={{ color: C.primary }}>
                {isAr ? "حصاد" : "Hasad"}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex items-center gap-1.5 border-t pt-3" style={{ borderColor: C.border }}>
            {isOwn ? (
              <span className="flex w-full items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold" style={{ borderColor: C.border, color: C.primary, background: C.soft }}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isAr ? "محتواك" : "Yours"}
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => launchAsGame(a.id, "classic")}
                  disabled={launchingIds.has(a.id) || a.questionCount === 0}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold text-white transition-all hover:brightness-110 disabled:opacity-40"
                  style={{ background: C.primary }}
                >
                  {launchingIds.has(a.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Play className="w-3.5 h-3.5 fill-current" />{isAr ? "ابدأ" : "Start"}</>}
                </button>
                <div className="relative group/menu">
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:bg-[#f5f2ec]" style={{ borderColor: C.border }}>
                    <MoreVertical className="w-4 h-4" style={{ color: C.muted }} />
                  </button>
                  <div className={cn("absolute z-30 top-full mt-1 hidden min-w-[180px] flex-col rounded-xl border bg-white py-1 shadow-xl group-hover/menu:flex", dir === "rtl" ? "left-0" : "right-0")} style={{ borderColor: C.border }}>
                    <button type="button" onClick={() => importAssignment(a.id)} disabled={importingIds.has(a.id) || importedIds.has(a.id)} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-[#f5f2ec] disabled:opacity-50">
                      {importedIds.has(a.id) ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Download className="w-3.5 h-3.5" />}
                      {t.sharedContent.importAssignment}
                    </button>
                    <button type="button" onClick={() => copyLink(a.id)} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-[#f5f2ec]">
                      <Copy className="w-3.5 h-3.5" />
                      {t.sharedContent.copyLink}
                    </button>
                    <button type="button" onClick={() => dismissAssignment(a.id)} disabled={dismissingIds.has(`assignment-${a.id}`)} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">
                      <X className="w-3.5 h-3.5" />
                      {isAr ? "إخفاء" : "Hide"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <div
      className={cn(!embedded && "min-h-full")}
      style={{ background: C.bg, color: C.text }}
      dir={dir}
    >
      <div className={cn(embedded ? "py-2" : "container mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-6")}>
        {/* Header */}
        <div
          className="mb-5 flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          style={{
            borderColor: C.border,
            background: "linear-gradient(135deg, #f0f7f2 0%, #faf8f3 55%, #ffffff 100%)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: C.soft }}>
              <FolderOpen className="h-5 w-5" style={{ color: C.primary }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black sm:text-xl" style={{ color: C.text }}>
                {isAr ? "مكتبة الأنشطة" : "Activities Library"}
              </h1>
              <p className="mt-0.5 max-w-xl text-xs leading-relaxed sm:text-sm" style={{ color: C.muted }}>
                {isAr
                  ? "اكتشف آلاف الأنشطة الجاهزة التي شاركها المعلمون واستخدمها مع طلابك بسهولة."
                  : "Discover ready-made activities shared by teachers and use them with your students easily."}
              </p>
            </div>
          </div>
          <Link href="/teacher/new">
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-white"
              style={{ borderColor: C.border, color: C.primary, background: "rgba(255,255,255,0.85)" }}
            >
              <Plus className="w-4 h-4" />
              {isAr ? "شارك نشاطاً" : "Share activity"}
            </button>
          </Link>
        </div>

        {/* Stats — GET /api/teacher/activity-library/stats */}
        <div className="mb-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border bg-white p-3.5 sm:p-4"
                    style={{ borderColor: C.border }}
                  >
                    <div className="mb-3 flex h-9 w-9 animate-pulse items-center justify-center rounded-lg bg-gradient-to-br from-[#e8f4ec] to-[#f0ebe3]" />
                    <div className="mb-2 h-8 w-20 animate-pulse rounded-md bg-gradient-to-r from-[#f0ebe3] via-[#e8e1d8] to-[#f0ebe3] bg-[length:200%_100%]" style={{ animation: "shimmer 1.8s ease-in-out infinite" }} />
                    <div className="h-3 w-28 animate-pulse rounded bg-[#f0ebe3]" />
                  </div>
                ))
              : statsError
                ? statsLabels.map((s, i) => (
                    <div key={i} className="rounded-xl border bg-white px-3.5 py-4 sm:px-4" style={{ borderColor: C.border }}>
                      <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: C.soft }}>
                        {s.icon}
                      </div>
                      <p className="text-[11px] font-semibold sm:text-xs" style={{ color: C.muted }}>{s.label}</p>
                    </div>
                  ))
                : statsLabels.map((s, i) => (
                    <div key={i} className="rounded-xl border bg-white p-3.5 shadow-sm sm:p-4" style={{ borderColor: C.border }}>
                      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: C.soft }}>
                        {s.icon}
                      </div>
                      <p className="text-xl font-extrabold tracking-tight sm:text-2xl" style={{ color: C.text }}>{s.value}</p>
                      <p className="text-[10px] font-medium sm:text-[11px]" style={{ color: C.muted }}>{s.label}</p>
                    </div>
                  ))}
          </div>
          {statsError && !statsLoading && (
            <p className="mt-2.5 text-center text-[11px] font-medium" style={{ color: "#9aa89f" }} role="status">
              {isAr ? "سيتم تحديث الإحصائيات قريباً" : "Stats will update shortly"}
            </p>
          )}
        </div>

        {/* Category tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto border-b pb-0 scrollbar-thin" style={{ borderColor: C.border }}>
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryTab(tab.id)}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2.5 text-sm font-bold transition-colors -mb-px",
                categoryTab === tab.id ? "border-[#0a4d26] text-[#0a4d26]" : "border-transparent text-[#6f8176] hover:text-[#1f2d24]",
              )}
            >
              {isAr ? tab.ar : tab.en}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="mb-4 space-y-3 rounded-2xl border bg-white/90 p-3.5 shadow-sm sm:p-4" style={{ borderColor: C.border }}>
          <div className="flex flex-wrap items-stretch gap-2.5">
            <div className="relative min-w-[min(100%,220px)] flex-1">
              <Search className={cn("absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa89f]", isAr ? "right-3" : "left-3")} />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={isAr ? "ابحث عن نشاط أو موضوع..." : "Search activity or topic..."}
                className={cn("w-full", FILTER_INPUT, isAr ? "pr-10 pl-3" : "pl-10 pr-3")}
              />
            </div>
            <input
              value={subjectFilter}
              onChange={(e) => onSubjectFilterChange(e.target.value)}
              list="lib-subjects"
              placeholder={isAr ? "المادة" : "Subject"}
              className={cn("min-w-[108px] flex-1 sm:flex-none sm:w-[128px]", FILTER_INPUT, "px-3")}
            />
            <datalist id="lib-subjects">{allSubjects.map((s) => <option key={s} value={s} />)}</datalist>
            <input
              value={gradeFilter}
              onChange={(e) => onGradeFilterChange(e.target.value)}
              list="lib-grades"
              placeholder={isAr ? "الصف" : "Grade"}
              className={cn("min-w-[96px] flex-1 sm:flex-none sm:w-[112px]", FILTER_INPUT, "px-3")}
            />
            <datalist id="lib-grades">{allGrades.map((g) => <option key={g} value={g} />)}</datalist>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as "newest" | "questions")}
              className={cn("min-w-[120px] flex-1 sm:flex-none", FILTER_INPUT, "px-3")}
            >
              <option value="newest">{isAr ? "الأحدث" : "Newest"}</option>
              <option value="questions">{isAr ? "الأكثر أسئلة" : "Most questions"}</option>
            </select>
            {(search || subjectFilter || gradeFilter) && (
              <button type="button" onClick={onClearFilters} className="text-xs font-bold underline" style={{ color: C.primary }}>
                {isAr ? "مسح الفلاتر" : "Clear filters"}
              </button>
            )}
            {isAdmin && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-bold" style={{ borderColor: C.border }}>
                <input type="checkbox" checked={showHidden} onChange={(e) => onShowHiddenChange(e.target.checked)} className="accent-[#0a4d26]" />
                <EyeOff className="w-3.5 h-3.5" />
                {isAr ? "عرض المخفي" : "Show hidden"}
              </label>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {typeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setTypeChip(chip.id);
                  if (chip.id === "video") onActiveTabChange("videos");
                  else if (chip.id === "interactive") onActiveTabChange("questions");
                  else if (chip.id === "presentation") onPresentations();
                  else onActiveTabChange("assignments");
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  typeChip === chip.id ? "border-[#0a4d26] bg-[#0a4d26] text-white" : "border-[#e8e1d8] bg-[#faf8f3] text-[#6f8176] hover:border-[#0a4d26]/30",
                )}
              >
                {chip.icon}
                {isAr ? chip.ar : chip.en}
              </button>
            ))}
          </div>
          <div className="flex gap-1 border-t pt-3" style={{ borderColor: C.border }}>
            {[
              { key: "assignments" as Tab, label: t.sharedContent.tabAssignments, icon: BookText, count: assignments.length },
              { key: "questions" as Tab, label: t.sharedContent.tabQuestions, icon: HelpCircle, count: questions.length },
              { key: "videos" as Tab, label: isAr ? "دروس فيديو" : "Video lessons", icon: Video, count: videoLessons.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onActiveTabChange(tab.key)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-bold -mb-px transition-colors",
                  activeTab === tab.key ? "border-[#0a4d26] text-[#0a4d26]" : "border-transparent text-[#6f8176]",
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <span className="rounded-full bg-[#e8f4ec] px-1.5 py-0.5 text-[10px]">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>


        {/* Trending now */}
        {trendingNow.length > 0 && (
          <section className="mb-6">
            <div className="mb-2.5 flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#0a4d26]" />
              <h2 className="text-sm font-extrabold tracking-tight" style={{ color: C.text }}>
                {isAr ? "رائج الآن" : "Trending now"}
              </h2>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
              {trendingNow.map((item, idx) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    if (item.kind === "assignment") launchAsGame(item.id);
                    else onActiveTabChange("videos");
                  }}
                  className="group flex w-[min(100%,260px)] shrink-0 items-center gap-2.5 rounded-xl border bg-white p-2 text-start shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md sm:w-[240px]"
                  style={{ borderColor: C.border }}
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                    <ActivityCover
                      kind={resolveCoverKind(item.kind, item.type)}
                      subject={item.subject}
                      title={item.title}
                      type={item.type}
                      aspect="thumb"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1">
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-[#0a4d26] px-1.5 py-0.5 text-[9px] font-bold text-white">
                          <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-300" />
                          {isAr ? "نشط الآن" : "Active"}
                        </span>
                      )}
                      <span className="rounded-md bg-[#f5f2ec] px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: C.muted }}>
                        {item.typeLabel}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs font-extrabold" style={{ color: C.text }}>{item.title}</p>
                    <p className="mt-0.5 text-[10px] font-medium" style={{ color: C.muted }}>{item.activeLabel}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* New this week */}
        <section className="mb-6">
          <h2 className="mb-3 text-base font-black" style={{ color: C.text }}>{isAr ? "جديد هذا الأسبوع" : "New this week"}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {newWeekItems.map((item, i) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.kind === "assignment") launchAsGame(item.id);
                  else if (item.kind === "video") onActiveTabChange("videos");
                }}
                className="group overflow-hidden rounded-2xl border bg-white text-start transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: C.border }}
              >
                <ActivityCover
                  kind={resolveCoverKind(item.kind, item.type)}
                  subject={item.subject}
                  title={item.title}
                  type={item.type}
                  aspect="photo"
                >
                  <span className={cn("absolute top-2 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", activityBadge(item.kind, item.type, isAr).cls)}>
                    {activityBadge(item.kind, item.type, isAr).label}
                  </span>
                </ActivityCover>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs font-black leading-snug" style={{ color: C.text }}>{item.title}</p>
                  <p className="mt-1 truncate text-[10px]" style={{ color: C.muted }}>{[item.subject, item.grade].filter(Boolean).join(" • ")}</p>
                  <p className="mt-1 text-[10px] font-semibold" style={{ color: C.muted }}>{item.meta}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Main grid */}
        <section>
          <h2 className="mb-3 text-base font-black" style={{ color: C.text }}>
            {activeTab === "assignments" && (isAr ? "الواجبات والمسابقات" : "Assignments & quizzes")}
            {activeTab === "videos" && (isAr ? "دروس الفيديو" : "Video lessons")}
            {activeTab === "questions" && (isAr ? "بنك الأسئلة" : "Question bank")}
          </h2>
          {activeTab === "assignments" && (
            displayAssignments.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {displayAssignments.map((a, i) => renderAssignmentCard(a, i))}
              </div>
            ) : (
              <EmptyState isAr={isAr} icon={<BookText className="w-8 h-8" />} title={isAr ? "لا توجد أنشطة" : "No activities"} />
            )
          )}
          {activeTab === "videos" && (
            displayVideos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {displayVideos.map((v, i) => (
                  <motion.article key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="group flex flex-col overflow-hidden rounded-2xl border bg-white hover:-translate-y-1 hover:shadow-md" style={{ borderColor: C.border }}>
                    <ActivityCover kind="video" subject={v.subject} title={v.title} aspect="video">
                      <span className={cn("absolute top-2 z-10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", "bg-blue-600/90")}>{isAr ? "فيديو" : "Video"}</span>
                    </ActivityCover>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="line-clamp-2 text-sm font-black">{v.title}</p>
                      {v.description ? <p className="mt-1 line-clamp-2 text-xs text-[#6f8176]">{v.description}</p> : null}
                      <p className="mt-1 text-[11px] text-[#6f8176]">
                        {[v.subject, v.targetClass, `${v.questionCount} ${isAr ? "سؤال" : "Q"}`].filter(Boolean).join(" • ")}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-[#6f8176]">
                        {!statsError && (
                          <span>{formatUseCount(videoUseCount(v.id))} {isAr ? "استخدام" : "uses"}</span>
                        )}
                        {v.teacherName ? (
                          <span className="flex items-center gap-1 truncate">
                            <User className="w-3 h-3" />
                            {v.teacherName}
                          </span>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => importVideo(v.id)} disabled={importingVIds.has(v.id) || v.teacherId === currentTeacherId} className="mt-2 w-full rounded-xl py-2 text-xs font-bold text-white disabled:opacity-40" style={{ background: C.primary }}>
                        {importingVIds.has(v.id) ? <Loader2 className="mx-auto w-4 h-4 animate-spin" /> : isAr ? "استيراد" : "Import"}
                      </button>
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <EmptyState isAr={isAr} icon={<Video className="w-8 h-8" />} title={isAr ? "لا توجد دروس فيديو" : "No video lessons"} />
            )
          )}
          {activeTab === "questions" && (
            displayQuestions.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayQuestions.map((q, i) => (
                  <motion.article key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col overflow-hidden rounded-2xl border bg-white hover:shadow-md" style={{ borderColor: C.border }}>
                    <ActivityCover kind="interactive" subject={q.subject} title={q.text.slice(0, 40)} tags={q.tags ?? undefined} imageUrl={q.imageUrl} aspect="video">
                      <span className={cn("absolute top-2 z-10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", "bg-violet-600/90")}>
                        {isAr ? "تفاعلي" : "Interactive"}
                      </span>
                    </ActivityCover>
                    <div className="p-4">
                      <p className="line-clamp-3 text-sm font-bold">{q.text}</p>
                      <p className="mt-2 text-xs text-[#6f8176]">{[q.subject, `${q.points} ${isAr ? "نقطة" : "pts"}`].filter(Boolean).join(" • ")}</p>
                      <div className="mt-2 text-[11px] text-[#6f8176]">
                        {/* questionUsesTracked=false: no per-question usage in DB yet */}
                        {formatUseCount(0)} {isAr ? "استخدام" : "uses"}
                      </div>
                      {q.teacherName ? (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-[#6f8176]">
                          <User className="w-3 h-3" />
                          {q.teacherName}
                        </p>
                      ) : null}
                      <button type="button" onClick={() => importQuestion(q.id)} disabled={importingQIds.has(q.id)} className="mt-3 w-full rounded-xl px-4 py-2 text-xs font-bold text-white" style={{ background: C.primary }}>
                        {isAr ? "استيراد" : "Import"}
                      </button>
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <EmptyState isAr={isAr} icon={<HelpCircle className="w-8 h-8" />} title={isAr ? "لا توجد أسئلة" : "No questions"} />
            )
          )}
        </section>
      </div>
    </div>
  );
}


function EmptyState({ isAr, icon, title }: { isAr: boolean; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border bg-white py-16 text-center" style={{ borderColor: C.border }}>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f4ec] text-[#0a4d26]/40">{icon}</div>
      <p className="font-bold text-[#1f2d24]">{title}</p>
      <p className="mt-1 text-sm text-[#6f8176]">{isAr ? "جرّب تغيير الفلاتر" : "Try changing filters"}</p>
    </div>
  );
}
