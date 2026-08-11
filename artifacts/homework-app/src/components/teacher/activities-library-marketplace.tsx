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
  ClipboardList,
  Sparkles,
  TrendingUp,
  Radio,
  Layers,
  Globe,
  LayoutGrid,
  List,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ActivityCover,
  formatUseCount,
  resolveCoverKind,
  resolveSubjectTheme,
} from "@/lib/activity-cover";

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
  if (kind === "video")    return { label: isAr ? "فيديو" : "Video",           cls: "bg-blue-600/90"    };
  if (kind === "question") return { label: isAr ? "تفاعلي" : "Interactive",    cls: "bg-violet-600/90" };
  if (type === "mcq")      return { label: isAr ? "مسابقة مباشرة" : "Live quiz", cls: "bg-emerald-700/90" };
  if (type === "true_false") return { label: isAr ? "اختبار" : "Quiz",         cls: "bg-amber-600/90"   };
  return                          { label: isAr ? "واجب" : "Assignment",        cls: "bg-[#225739]/90"   };
}

export function ActivitiesLibraryMarketplace(props: ActivitiesLibraryMarketplaceProps) {
  const {
    embedded, lang, dir,
    assignments, questions, videoLessons,
    filteredAssignments, filteredQuestions, filteredVideos,
    popularIds, newIds,
    currentTeacherId, isAdmin, showHidden, onShowHiddenChange,
    search, onSearchChange,
    subjectFilter, onSubjectFilterChange,
    gradeFilter, onGradeFilterChange,
    sortBy, onSortByChange,
    allSubjects, allGrades,
    activeTab, onActiveTabChange,
    onClearFilters, onPresentations,
    launchAsGame, importAssignment, copyLink, dismissAssignment,
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
    if (typeChip === "quiz")     list = list.filter(a => a.type === "mcq" || a.type === "mixed");
    if (typeChip === "live")     list = list.filter(a => a.type === "mcq" && a.questionCount > 0);
    if (typeChip === "homework") list = list.filter(a => a.type !== "mcq" || a.questionCount < 15);
    return list;
  }, [filteredAssignments, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const displayVideos = useMemo(() => {
    if (typeChip !== "all" && typeChip !== "video") return [];
    return filterByCategory(filteredVideos, { popularCheck: v => v.questionCount >= 5 });
  }, [filteredVideos, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const displayQuestions = useMemo(() => {
    if (typeChip !== "all" && typeChip !== "interactive") return [];
    return filterByCategory(filteredQuestions, { popularCheck: q => q.points >= 2 });
  }, [filteredQuestions, categoryTab, typeChip, popularIds, newIds, currentTeacherId]);

  const wameethPick = useMemo(() => {
    const mcq = assignments.filter(a => a.type === "mcq" && a.questionCount > 0 && !a.hiddenByAdmin);
    return mcq.find(a => a.title.includes("وميض") || a.title.toLowerCase().includes("wameeth"))
      || [...mcq].sort((a, b) => b.questionCount - a.questionCount)[0];
  }, [assignments]);

  const topVideoByUses = useMemo(() => {
    if (!libraryStats?.videoUses) return videoLessons[0];
    let best = videoLessons[0]; let max = -1;
    for (const v of videoLessons) {
      const u = libraryStats.videoUses[String(v.id)] ?? 0;
      if (u > max) { max = u; best = v; }
    }
    return best;
  }, [videoLessons, libraryStats]);

  const trendingNow = useMemo(() => {
    type Trend = { key: string; title: string; kind: "assignment" | "video"; id: number; type?: string; subject?: string | null; uses: number; typeLabel: string; activeLabel: string };
    const out: Trend[] = [];
    if (wameethPick) {
      const u = libraryStats?.assignmentUses[String(wameethPick.id)] ?? 0;
      out.push({ key: `w-${wameethPick.id}`, title: wameethPick.title, kind: "assignment", id: wameethPick.id, type: wameethPick.type, subject: wameethPick.subject, uses: u, typeLabel: isAr ? "مسابقة مباشرة" : "Live quiz", activeLabel: isAr ? (u > 0 ? `${formatUseCount(u)} استخدام` : "جاهز للتشغيل") : (u > 0 ? `${formatUseCount(u)} uses` : "Ready") });
    }
    const sciencePick = [...assignments].filter(a => resolveSubjectTheme(a.subject) === "science" && a.id !== wameethPick?.id).sort((a, b) => assignmentUseCount(b.id) - assignmentUseCount(a.id))[0];
    if (sciencePick) {
      const u = libraryStats?.assignmentUses[String(sciencePick.id)] ?? 0;
      out.push({ key: `a-${sciencePick.id}`, title: sciencePick.title, kind: "assignment", id: sciencePick.id, type: sciencePick.type, subject: sciencePick.subject, uses: u, typeLabel: isAr ? "واجب / اختبار" : "Assignment", activeLabel: isAr ? (u > 0 ? `${formatUseCount(u)} استخدام` : `${sciencePick.questionCount} سؤال`) : (u > 0 ? `${formatUseCount(u)} uses` : `${sciencePick.questionCount} Q`) });
    }
    if (topVideoByUses && !out.some(t => t.kind === "video" && t.id === topVideoByUses.id)) {
      const u = libraryStats?.videoUses[String(topVideoByUses.id)] ?? 0;
      out.push({ key: `v-${topVideoByUses.id}`, title: topVideoByUses.title, kind: "video", id: topVideoByUses.id, subject: topVideoByUses.subject, uses: u, typeLabel: isAr ? "فيديو" : "Video", activeLabel: isAr ? (u > 0 ? `${formatUseCount(u)} مشاهدة` : `${topVideoByUses.questionCount} سؤال`) : (u > 0 ? `${formatUseCount(u)} views` : `${topVideoByUses.questionCount} Q`) });
    }
    if (out.length < 3) {
      const extra = [...assignments].filter(a => !out.some(t => t.kind === "assignment" && t.id === a.id)).sort((a, b) => assignmentUseCount(b.id) - assignmentUseCount(a.id)).slice(0, 3 - out.length);
      for (const a of extra) {
        const u = libraryStats?.assignmentUses[String(a.id)] ?? 0;
        out.push({ key: `a-${a.id}`, title: a.title, kind: "assignment", id: a.id, type: a.type, subject: a.subject, uses: u, typeLabel: activityBadge("assignment", a.type, isAr).label, activeLabel: isAr ? `${formatUseCount(u) || "0"} استخدام` : `${formatUseCount(u) || "0"} uses` });
      }
    }
    return out.slice(0, 4);
  }, [assignments, wameethPick, topVideoByUses, libraryStats, isAr]);

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
    { id: "quiz",        ar: "اختبارات",         en: "Quizzes",      icon: <ClipboardList className="w-3.5 h-3.5"/> },
    { id: "homework",    ar: "واجبات",           en: "Homework",     icon: <BookText    className="w-3.5 h-3.5" /> },
    { id: "video",       ar: "فيديو",            en: "Videos",       icon: <Video       className="w-3.5 h-3.5" /> },
    { id: "interactive", ar: "أنشطة تفاعلية",    en: "Interactive",  icon: <Sparkles    className="w-3.5 h-3.5" /> },
    { id: "presentation",ar: "عروض تفاعلية",     en: "Presentations",icon: <Presentation className="w-3.5 h-3.5"/> },
  ];

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
              onClick={e => { e.stopPropagation(); toggleBookmark(a.id); }}
              className={cn("absolute top-2.5 z-10 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors", dir === "rtl" ? "left-2.5" : "right-2.5")}
              style={{ color: bookmarks.has(a.id) ? C.gold : C.muted }}
            >
              <Bookmark className={cn("w-3.5 h-3.5", bookmarks.has(a.id) && "fill-current")} />
            </button>
          </ActivityCover>
        </div>

        <div className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
          <h3 className="line-clamp-2 text-[13px] font-extrabold leading-snug tracking-tight" style={{ color: C.text }}>
            {a.title}
          </h3>
          {a.description && (
            <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed" style={{ color: C.muted }}>{a.description}</p>
          )}
          <p className="mt-1 text-[10px] font-medium" style={{ color: C.muted }}>
            {[a.subject, a.targetClass, `${a.questionCount} ${isAr ? "سؤال" : "Q"}`].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px]" style={{ color: C.muted }}>
            {!statsError && <span>{formatUseCount(uses)} {isAr ? "استخدام" : "uses"}</span>}
            {a.teacherName && !a.isAdminContent
              ? <span className="flex min-w-0 items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" />{a.teacherName}</span>
              : a.isAdminContent ? <span className="truncate font-semibold" style={{ color: C.primary }}>{isAr ? "حصاد" : "Hasaad"}</span>
              : null}
          </div>

          <div className="mt-3 flex items-center gap-1.5 border-t pt-3" style={{ borderColor: C.border }}>
            {isOwn ? (
              <span className="flex w-full items-center justify-center gap-1 rounded-xl border py-2 text-xs font-bold" style={{ borderColor: C.border, color: C.primary, background: C.soft }}>
                <CheckCircle2 className="w-3.5 h-3.5" />{isAr ? "محتواك" : "Yours"}
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
                <button
                  type="button"
                  onClick={() => importAssignment(a.id)}
                  disabled={importingIds.has(a.id) || importedIds.has(a.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:bg-[#f5f2ec] disabled:opacity-40"
                  style={{ borderColor: C.border }}
                  title={t.sharedContent.importAssignment}
                >
                  {importedIds.has(a.id) ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : importingIds.has(a.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: C.muted }} /> : <Download className="w-3.5 h-3.5" style={{ color: C.muted }} />}
                </button>
                <button
                  type="button"
                  onClick={() => copyLink(a.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:bg-[#f5f2ec]"
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

  /* ──────────────────────────────────── sidebar ──────────────────────────────── */
  const sidebar = (
    <aside
      className="shrink-0 border-s flex flex-col"
      style={{
        width: 260,
        background: C.sidebar,
        borderColor: C.border,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div className="border-b px-5 py-5" style={{ borderColor: C.border }}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: C.primary }}>
            <BookText className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-black" style={{ color: C.text }}>{isAr ? "مكتبة الأنشطة" : "Activities Library"}</p>
            <p className="text-[10px]" style={{ color: C.muted }}>{isAr ? "اكتشف وابدأ فوراً" : "Discover & launch"}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className={cn("absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2", isAr ? "right-3" : "left-3")} style={{ color: C.muted }} />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={isAr ? "ابحث عن نشاط..." : "Search..."}
            className={cn("w-full rounded-2xl border py-2.5 text-[13px] outline-none transition-all", isAr ? "pr-9 pl-9" : "pl-9 pr-9")}
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
      <div className="px-5 py-4">
        <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>{isAr ? "نوع النشاط" : "Activity type"}</p>
        <div className="flex flex-col gap-1">
          {typeFilters.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setTypeChip(f.id);
                if (f.id === "video")        onActiveTabChange("videos");
                else if (f.id === "interactive") onActiveTabChange("questions");
                else if (f.id === "presentation") onPresentations();
                else onActiveTabChange("assignments");
              }}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-all"
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

      {/* Subject pills */}
      <div className="border-t px-5 py-4" style={{ borderColor: C.border }}>
        <p className="mb-2.5 text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>{isAr ? "المادة الدراسية" : "Subject"}</p>
        <div className="flex flex-wrap gap-1.5">
          {[isAr ? "الكل" : "All", ...allSubjects].slice(0, 12).map(s => {
            const active = subjectFilter === s || (!subjectFilter && (s === "الكل" || s === "All"));
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSubjectFilterChange(active ? "" : s === "الكل" || s === "All" ? "" : s)}
                className="rounded-lg border px-2 py-1 text-[11px] transition-all"
                style={{ fontFamily: "inherit", fontWeight: active ? 700 : 500, borderColor: active ? C.primary : C.border, background: active ? C.soft : "transparent", color: active ? C.primary : C.muted, cursor: "pointer" }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grade + Sort (compact) */}
      <div className="border-t px-5 py-4" style={{ borderColor: C.border }}>
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: C.muted }}>{isAr ? "الصف والترتيب" : "Grade & sort"}</p>
        <div className="flex flex-col gap-2">
          <input
            value={gradeFilter}
            onChange={e => onGradeFilterChange(e.target.value)}
            list="lib-grades-sb"
            placeholder={isAr ? "الصف..." : "Grade..."}
            className="w-full rounded-xl border px-3 py-2 text-[12px] outline-none"
            style={{ background: C.bg, borderColor: C.border, color: C.text, fontFamily: "inherit" }}
          />
          <datalist id="lib-grades-sb">{allGrades.map(g => <option key={g} value={g} />)}</datalist>
          <select value={sortBy} onChange={e => onSortByChange(e.target.value as "newest" | "questions")} className="w-full rounded-xl border px-3 py-2 text-[12px] outline-none" style={{ background: C.bg, borderColor: C.border, color: C.text, fontFamily: "inherit" }}>
            <option value="newest">{isAr ? "الأحدث" : "Newest"}</option>
            <option value="questions">{isAr ? "الأكثر أسئلة" : "Most questions"}</option>
          </select>
        </div>
      </div>

      {/* Admin toggle */}
      {isAdmin && (
        <div className="border-t px-5 py-3" style={{ borderColor: C.border }}>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold" style={{ color: C.muted }}>
            <input type="checkbox" checked={showHidden} onChange={e => onShowHiddenChange(e.target.checked)} className="accent-[#225739]" />
            <EyeOff className="w-3.5 h-3.5" />
            {isAr ? "عرض المخفي" : "Show hidden"}
          </label>
        </div>
      )}

      {/* Share CTA */}
      <div className="mt-auto px-5 py-5">
        <Link href="/teacher/new">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13px] font-black text-white transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg,${C.primary},${C.primary2})`, boxShadow: "0 4px 16px rgba(34,87,57,0.28)", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <Plus className="h-4 w-4" />{isAr ? "شارك نشاطاً" : "Share activity"}
          </button>
        </Link>
      </div>
    </aside>
  );

  /* ──────────────────────────────────── main content ──────────────────────────── */
  const totalShown = (activeTab === "assignments" ? displayAssignments.length : 0)
    + (activeTab === "videos" ? displayVideos.length : 0)
    + (activeTab === "questions" ? displayQuestions.length : 0);

  return (
    <div
      className={cn(!embedded && "min-h-screen")}
      style={{ background: C.bg, color: C.text }}
      dir={dir}
    >
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        {sidebar}

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "28px 32px" }}>

          {/* Stats bar */}
          <div
            className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border bg-white p-4 shadow-sm lg:grid-cols-4"
            style={{ borderColor: C.border }}
          >
            {statsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
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
                    <div>
                      <p className="text-xl font-black leading-none" style={{ color: C.text }}>{s.value || "—"}</p>
                      <p className="mt-1 text-[10px]" style={{ color: C.muted }}>{s.label}</p>
                    </div>
                    {i < 3 && <div className="ms-auto h-9 w-px" style={{ background: C.border }} />}
                  </div>
                ))
            }
          </div>

          {/* Trending now */}
          {trendingNow.length > 0 && (
            <section className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-0.5 rounded-full" style={{ background: `linear-gradient(to bottom,${C.gold},${C.primary})` }} />
                  <Radio className="h-4 w-4" style={{ color: C.primary }} />
                  <h2 className="text-[17px] font-black" style={{ color: C.text }}>{isAr ? "رائج الآن" : "Trending now"}</h2>
                </div>
                <button type="button" className="flex items-center gap-1 text-xs font-bold" style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontFamily: "inherit" }}>
                  {isAr ? "عرض الكل" : "See all"} <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                {trendingNow.map((item, idx) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => item.kind === "assignment" ? launchAsGame(item.id) : onActiveTabChange("videos")}
                    className="group flex shrink-0 flex-col gap-3 overflow-hidden rounded-2xl p-4 text-start transition-all hover:-translate-y-1"
                    style={{ width: 280, background: C.primary, boxShadow: "0 4px 20px rgba(34,87,57,0.28)", border: "none", cursor: "pointer", position: "relative" }}
                  >
                    {/* Decorative circle */}
                    <div style={{ position: "absolute", top: -28, left: -28, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
                    <div className="flex items-start gap-2.5">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                        <ActivityCover kind={resolveCoverKind(item.kind, item.type)} subject={item.subject} title={item.title} type={item.type} aspect="thumb" />
                      </div>
                      <div>
                        <span className="mb-1 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[9px] font-bold text-white" style={{ background: "rgba(255,255,255,0.18)" }}>
                          {idx === 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
                          {idx === 0 ? (isAr ? "نشط الآن" : "Active") : item.typeLabel}
                        </span>
                        <p className="line-clamp-2 text-[13px] font-extrabold leading-snug text-white">{item.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-white/70">{item.activeLabel}</span>
                      <span className="rounded-xl px-3 py-1.5 text-[11px] font-black" style={{ background: C.gold, color: C.primary2 }}>
                        {isAr ? "ابدأ ▶" : "Start ▶"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Category tabs + view toggle */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1 rounded-2xl border bg-white p-1" style={{ borderColor: C.border }}>
              {categoryTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryTab(tab.id)}
                  className="rounded-xl px-3 py-2 text-xs transition-all"
                  style={{ fontFamily: "inherit", fontWeight: categoryTab === tab.id ? 800 : 600, background: categoryTab === tab.id ? C.primary : "transparent", color: categoryTab === tab.id ? "#fff" : C.muted, border: "none", cursor: "pointer" }}
                >
                  {isAr ? tab.ar : tab.en}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <button type="button" onClick={onClearFilters} className="text-xs font-bold underline" style={{ background: "none", border: "none", cursor: "pointer", color: C.primary, fontFamily: "inherit" }}>
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
          <p className="mb-4 text-xs font-semibold" style={{ color: C.muted }}>{totalShown} {isAr ? "نشاط" : "activities"}</p>

          {/* Content — Assignments */}
          {activeTab === "assignments" && (
            displayAssignments.length > 0
              ? viewMode === "grid"
                ? <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
                    {displayAssignments.map((a, i) => renderAssignmentCard(a, i))}
                  </div>
                : <div className="flex flex-col gap-2.5">
                    {displayAssignments.map((a, i) => renderListRow(a, i))}
                  </div>
              : <EmptyState isAr={isAr} icon={<BookText className="w-8 h-8" />} title={isAr ? "لا توجد أنشطة" : "No activities"} />
          )}

          {/* Content — Videos */}
          {activeTab === "videos" && (
            displayVideos.length > 0
              ? <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
                  {displayVideos.map((v, i) => (
                    <motion.article key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="group flex flex-col overflow-hidden rounded-2xl border bg-white hover:-translate-y-1 hover:shadow-md transition-all"
                      style={{ borderColor: C.border, boxShadow: "0 2px 12px rgba(31,45,36,0.06)" }}
                    >
                      <ActivityCover kind="video" subject={v.subject} title={v.title} aspect="video">
                        <span className={cn("absolute top-2 z-10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", "bg-blue-600/90")}>
                          {isAr ? "فيديو" : "Video"}
                        </span>
                      </ActivityCover>
                      <div className="flex flex-1 flex-col p-3">
                        <p className="line-clamp-2 text-[13px] font-black" style={{ color: C.text }}>{v.title}</p>
                        {v.description && <p className="mt-1 line-clamp-1 text-xs" style={{ color: C.muted }}>{v.description}</p>}
                        <p className="mt-1 text-[11px]" style={{ color: C.muted }}>{[v.subject, v.targetClass, `${v.questionCount} ${isAr ? "سؤال" : "Q"}`].filter(Boolean).join(" · ")}</p>
                        <div className="mt-2 flex items-center justify-between text-[10px]" style={{ color: C.muted }}>
                          {!statsError && <span>{formatUseCount(videoUseCount(v.id))} {isAr ? "استخدام" : "uses"}</span>}
                          {v.teacherName && <span className="flex items-center gap-1 truncate"><User className="w-3 h-3" />{v.teacherName}</span>}
                        </div>
                        <div className="mt-3 flex gap-1.5 border-t pt-3" style={{ borderColor: C.border }}>
                          <button type="button" onClick={() => importVideo(v.id)} disabled={importingVIds.has(v.id) || v.teacherId === currentTeacherId} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-white disabled:opacity-40" style={{ background: C.primary }}>
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
              ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {displayQuestions.map((q, i) => (
                    <motion.article key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col overflow-hidden rounded-2xl border bg-white hover:shadow-md transition-shadow"
                      style={{ borderColor: C.border }}
                    >
                      <ActivityCover kind="interactive" subject={q.subject} title={q.text.slice(0, 40)} tags={q.tags ?? undefined} imageUrl={q.imageUrl} aspect="video">
                        <span className={cn("absolute top-2 z-10 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", "bg-violet-600/90")}>{isAr ? "تفاعلي" : "Interactive"}</span>
                      </ActivityCover>
                      <div className="p-4">
                        <p className="line-clamp-3 text-sm font-bold" style={{ color: C.text }}>{q.text}</p>
                        <p className="mt-2 text-xs" style={{ color: C.muted }}>{[q.subject, `${q.points} ${isAr ? "نقطة" : "pts"}`].filter(Boolean).join(" · ")}</p>
                        {q.teacherName && <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: C.muted }}><User className="w-3 h-3" />{q.teacherName}</p>}
                        <button type="button" onClick={() => importQuestion(q.id)} disabled={importingQIds.has(q.id)} className="mt-3 w-full rounded-xl px-4 py-2 text-xs font-bold text-white" style={{ background: C.primary }}>
                          {importingQIds.has(q.id) ? <Loader2 className="mx-auto w-4 h-4 animate-spin" /> : isAr ? "استيراد" : "Import"}
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </div>
              : <EmptyState isAr={isAr} icon={<HelpCircle className="w-8 h-8" />} title={isAr ? "لا توجد أسئلة" : "No questions"} />
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
