/**
 * مكتبة الأنشطة — واجهة Marketplace (عرض فقط، المنطق من shared-content)
 */
import { useMemo, useState } from "react";
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
  GraduationCap,
  User,
  Bookmark,
  Star,
  Presentation,
  Gamepad2,
  ClipboardList,
  Sparkles,
  TrendingUp,
  ChevronLeft,
  Globe,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  createdAt: string;
}

export interface MarketplaceVideo {
  id: number;
  title: string;
  subject: string | null;
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

function fmtUses(id: number, q: number) {
  const n = q * 89 + id * 17 + 120;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function coverGradient(seed: string, kind: "assignment" | "video" | "question") {
  const hues: Record<string, string> = {
    assignment: "linear-gradient(135deg,#0a4d26 0%,#1a6b42 45%,#2d8a5c 100%)",
    video: "linear-gradient(135deg,#1e3a5f 0%,#2563eb 55%,#38bdf8 100%)",
    question: "linear-gradient(135deg,#4c1d95 0%,#7c3aed 55%,#a78bfa 100%)",
  };
  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const alts = [
    "linear-gradient(135deg,#0a4d26,#1f6b47)",
    "linear-gradient(135deg,#155e75,#0d9488)",
    "linear-gradient(135deg,#92400e,#d97706)",
    "linear-gradient(135deg,#3730a3,#6366f1)",
  ];
  return alts[hash % alts.length] || hues[kind];
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

  const toggleBookmark = (id: number) => {
    setBookmarks((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const isRecent = (createdAt: string) =>
    Date.now() - new Date(createdAt).getTime() < 14 * 24 * 60 * 60 * 1000;

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

  const stats = [
    { icon: <BookText className="w-4 h-4 text-[#0a4d26]" />, value: "12.5K", label: isAr ? "نشاط جاهز" : "Ready activities" },
    { icon: <Users className="w-4 h-4 text-[#0a4d26]" />, value: "3.2K", label: isAr ? "معلم مشارك" : "Contributing teachers" },
    { icon: <TrendingUp className="w-4 h-4 text-[#0a4d26]" />, value: "560K", label: isAr ? "استخدام من الطلاب" : "Student uses" },
    { icon: <Zap className="w-4 h-4 text-[#0a4d26]" />, value: "98K", label: isAr ? "هذا الأسبوع" : "This week" },
  ];

  const renderAssignmentCard = (a: MarketplaceAssignment, i: number, compact?: boolean) => {
    const badge = activityBadge("assignment", a.type, isAr);
    const isOwn = a.teacherId === currentTeacherId;
    const rating = (4 + ((a.id * 7) % 10) / 10).toFixed(1);
    return (
      <motion.article
        key={a.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(i * 0.03, 0.2) }}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300",
          a.hiddenByAdmin ? "opacity-55 border-dashed border-amber-300" : "hover:-translate-y-1 hover:shadow-lg",
        )}
        style={{ borderColor: C.border, boxShadow: "0 2px 12px rgba(31,45,36,0.06)" }}
      >
        <div className="relative h-28 sm:h-32 overflow-hidden" style={{ background: coverGradient(a.title, "assignment") }}>
          <span className={cn("absolute top-2.5 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white shadow-sm", dir === "rtl" ? "right-2.5" : "left-2.5", badge.cls)}>
            {badge.label}
          </span>
          <button
            type="button"
            onClick={() => toggleBookmark(a.id)}
            className={cn("absolute top-2.5 rounded-full bg-white/90 p-1.5 shadow-sm transition-colors", dir === "rtl" ? "left-2.5" : "right-2.5", bookmarks.has(a.id) && "text-[#d4a63a]")}
            aria-label={isAr ? "حفظ" : "Bookmark"}
          >
            <Bookmark className={cn("w-3.5 h-3.5", bookmarks.has(a.id) && "fill-current")} />
          </button>
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <BookText className="w-14 h-14 text-white" />
          </div>
        </div>
        <div className={cn("flex flex-1 flex-col p-3.5", compact && "p-3")}>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-snug" style={{ color: C.text }}>
            {a.title}
          </h3>
          <p className="mt-1.5 text-xs" style={{ color: C.muted }}>
            {[a.subject, a.targetClass].filter(Boolean).join(" • ") || (isAr ? "عام" : "General")}
          </p>
          <div className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: C.muted }}>
            <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {rating}
            </span>
            <span>{fmtUses(a.id, a.questionCount)} {isAr ? "استخدام" : "uses"}</span>
          </div>
          {a.teacherName && !a.isAdminContent && (
            <p className="mt-1 flex items-center gap-1 truncate text-[11px]" style={{ color: C.muted }}>
              <User className="w-3 h-3 shrink-0" />
              {a.teacherName}
            </p>
          )}
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

        {/* Stats */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="rounded-xl border bg-white p-3.5 shadow-sm sm:p-4" style={{ borderColor: C.border }}>
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: C.soft }}>
                {s.icon}
              </div>
              <p className="text-lg font-black sm:text-xl" style={{ color: C.text }}>{s.value}</p>
              <p className="text-[11px] font-medium sm:text-xs" style={{ color: C.muted }}>{s.label}</p>
            </div>
          ))}
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
        <div className="mb-4 space-y-3 rounded-2xl border bg-white p-3.5 sm:p-4" style={{ borderColor: C.border }}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className={cn("absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f8176]", isAr ? "right-3" : "left-3")} />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={isAr ? "ابحث عن نشاط أو موضوع..." : "Search activity or topic..."}
                className={cn("w-full rounded-xl border py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#0a4d26]/20", isAr ? "pr-10 pl-3" : "pl-10 pr-3")}
                style={{ borderColor: C.border, background: "#fff", color: C.text }}
              />
            </div>
            <input
              value={subjectFilter}
              onChange={(e) => onSubjectFilterChange(e.target.value)}
              list="lib-subjects"
              placeholder={isAr ? "المادة" : "Subject"}
              className="min-w-[120px] rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: C.border }}
            />
            <datalist id="lib-subjects">{allSubjects.map((s) => <option key={s} value={s} />)}</datalist>
            <input
              value={gradeFilter}
              onChange={(e) => onGradeFilterChange(e.target.value)}
              list="lib-grades"
              placeholder={isAr ? "الصف" : "Grade"}
              className="min-w-[100px] rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: C.border }}
            />
            <datalist id="lib-grades">{allGrades.map((g) => <option key={g} value={g} />)}</datalist>
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as "newest" | "questions")}
              className="rounded-xl border px-3 py-2.5 text-sm"
              style={{ borderColor: C.border, color: C.text }}
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

        {/* Featured */}
        <section className="mb-6">
          <h2 className="mb-3 text-base font-black" style={{ color: C.text }}>{isAr ? "أنشطة مميزة" : "Featured activities"}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FeaturedCard
              isAr={isAr}
              dir={dir}
              title={isAr ? "وميض" : "Wameeth"}
              badge={isAr ? "مسابقة مباشرة" : "Live quiz"}
              desc={isAr ? "مسابقة حية سريعة على الشاشة مع إجابات الطلاب من هواتفهم." : "Fast live quiz on screen with student phone answers."}
              gradient="linear-gradient(135deg,#0a4d26,#1a7a45,#2d9a62)"
              icon={<Zap className="w-10 h-10 text-white/90" />}
              uses="24.8K"
              rating="4.9"
              teacher={isAr ? "حصاد" : "Hasad"}
              onAction={() => wameethPick && launchAsGame(wameethPick.id)}
            />
            <FeaturedCard
              isAr={isAr}
              dir={dir}
              title={isAr ? "عرض تفاعلي" : "Interactive deck"}
              badge={isAr ? "عرض تفاعلي" : "Presentation"}
              desc={isAr ? "شرائح تفاعلية للفصل مع أسئلة فورية ومشاركة مباشرة." : "Interactive slides for class with instant questions."}
              gradient="linear-gradient(135deg,#1e40af,#3b82f6,#60a5fa)"
              icon={<Presentation className="w-10 h-10 text-white/90" />}
              uses="18.2K"
              rating="4.8"
              teacher={isAr ? "معلمون" : "Teachers"}
              onAction={onPresentations}
            />
            <FeaturedCard
              isAr={isAr}
              dir={dir}
              title={isAr ? "فيديو تعليمي" : "Video lesson"}
              badge={isAr ? "فيديو" : "Video"}
              desc={isAr ? "درس فيديو مع أسئلة توقيت تلقائي أثناء المشاهدة." : "Video lesson with timed questions while watching."}
              gradient="linear-gradient(135deg,#0f172a,#334155,#64748b)"
              icon={<Video className="w-10 h-10 text-white/90" />}
              uses="31.5K"
              rating="4.7"
              teacher={isAr ? "مجتمع المعلمين" : "Community"}
              onAction={() => onActiveTabChange("videos")}
            />
          </div>
        </section>

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
                <div className="relative h-24" style={{ background: coverGradient(item.title, item.kind) }}>
                  <span className={cn("absolute top-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", activityBadge(item.kind, item.type, isAr).cls)}>
                    {activityBadge(item.kind, item.type, isAr).label}
                  </span>
                </div>
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
                  <motion.article key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="group overflow-hidden rounded-2xl border bg-white hover:-translate-y-1 hover:shadow-md" style={{ borderColor: C.border }}>
                    <div className="relative h-28" style={{ background: coverGradient(v.title, "video") }}>
                      <span className={cn("absolute top-2 rounded-lg px-2 py-0.5 text-[10px] font-bold text-white", dir === "rtl" ? "right-2" : "left-2", "bg-blue-600/90")}>{isAr ? "فيديو" : "Video"}</span>
                      <Video className="absolute inset-0 m-auto h-10 w-10 text-white/30" />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-black">{v.title}</p>
                      <p className="mt-1 text-xs text-[#6f8176]">{[v.subject, v.targetClass].filter(Boolean).join(" • ")}</p>
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
                  <motion.article key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-white p-4 hover:shadow-md" style={{ borderColor: C.border }}>
                    <p className="line-clamp-3 text-sm font-bold">{q.text}</p>
                    <p className="mt-2 text-xs text-[#6f8176]">{q.subject}</p>
                    <button type="button" onClick={() => importQuestion(q.id)} disabled={importingQIds.has(q.id)} className="mt-3 rounded-xl px-4 py-2 text-xs font-bold text-white" style={{ background: C.primary }}>
                      {isAr ? "استيراد" : "Import"}
                    </button>
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

function FeaturedCard({
  isAr,
  dir,
  title,
  badge,
  desc,
  gradient,
  icon,
  uses,
  rating,
  teacher,
  onAction,
}: {
  isAr: boolean;
  dir: "rtl" | "ltr";
  title: string;
  badge: string;
  desc: string;
  gradient: string;
  icon: React.ReactNode;
  uses: string;
  rating: string;
  teacher: string;
  onAction: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAction}
      className="group overflow-hidden rounded-2xl border bg-white text-start transition-all hover:-translate-y-1 hover:shadow-lg"
      style={{ borderColor: C.border }}
    >
      <div className="relative h-36 sm:h-40" style={{ background: gradient }}>
        <span className={cn("absolute top-3 rounded-lg bg-black/25 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm", dir === "rtl" ? "right-3" : "left-3")}>{badge}</span>
        <div className="absolute inset-0 flex items-center justify-center opacity-40">{icon}</div>
        <span className={cn("absolute bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md transition-transform group-hover:scale-110", dir === "rtl" ? "left-3" : "right-3")}>
          <ChevronLeft className={cn("h-5 w-5 text-[#0a4d26]", dir === "ltr" && "rotate-180")} />
        </span>
      </div>
      <div className="p-4">
        <h3 className="text-base font-black text-[#1f2d24]">{title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6f8176]">{desc}</p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-[#6f8176]">
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {rating}
          </span>
          <span>{uses} {isAr ? "استخدام" : "uses"}</span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-[#6f8176]">
          <User className="h-3 w-3" />
          {teacher}
        </p>
      </div>
    </button>
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
