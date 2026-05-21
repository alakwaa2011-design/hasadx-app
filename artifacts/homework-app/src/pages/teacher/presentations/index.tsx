import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPresentations,
  useCreatePresentation,
  useDeletePresentation,
  useUpdatePresentation,
  usePublishPresentation,
  useUnpublishPresentation,
  useDuplicatePresentation,
  useGetCurrentTeacher,
  useGetPresentationsLimits,
  getListPresentationsQueryKey,
  getGetCurrentTeacherQueryKey,
  getGetPresentationsLimitsQueryKey,
  type PresentationSummary,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import {
  Monitor,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Globe,
  EyeOff,
  Loader2,
  Sparkles,
  Clock,
  CheckCircle2,
  FileText,
  Lock,
  BarChart3,
  Radio,
  Upload,
  FileUp,
  Layers,
} from "lucide-react";

const BRAND_GREEN = "#225739";
const BRAND_GOLD = "#D9A521";

type TabId = "recent" | "published" | "drafts";

function formatRelative(d: Date | string | undefined, isAr: boolean): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? "الآن" : "now";
  if (mins < 60) return isAr ? `قبل ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `قبل ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return isAr ? `قبل ${days} ي` : `${days}d ago`;
  return date.toLocaleDateString(isAr ? "ar" : "en");
}

// ─── كشف نوع العرض من العنوان ───────────────────────────
type ContentKind = "islamic" | "math" | "science" | "arabic-lang" | "history" | "general";

function detectContentKind(title: string): ContentKind {
  const t = title.toLowerCase();
  const has = (...kw: string[]) => kw.some((k) => t.includes(k));
  if (has("قرآن", "سورة", "آية", "تفسير", "فقه", "حديث", "إسلام", "صلاة", "زكاة", "حج", "سيرة", "نبي", "رسول", "عقيدة", "توحيد", "quran", "islamic", "seerah"))
    return "islamic";
  if (has("رياضيات", "حساب", "جبر", "هندسة", "معادل", "كسر", "ضرب", "قسمة", "إحصاء", "تفاضل", "تكامل", "math", "algebra", "geometry", "equation", "calculus", "fraction"))
    return "math";
  if (has("علوم", "فيزياء", "كيمياء", "أحياء", "نبات", "حيوان", "ذرة", "خلية", "تجربة", "science", "physics", "chemistry", "biology", "atom", "cell", "experiment"))
    return "science";
  if (has("لغة عربية", "نحو", "صرف", "بلاغة", "إملاء", "تعبير", "قراءة", "أدب", "شعر", "نص", "arabic language", "grammar", "spelling", "literature"))
    return "arabic-lang";
  if (has("تاريخ", "حضارة", "قديم", "عصر", "دولة", "معركة", "history", "civilization", "ancient", "empire", "battle", "era"))
    return "history";
  return "general";
}

// ألوان ثابتة لكل نوع
const KIND_THEME: Record<ContentKind, { bar: string; bg: string; text: string; dim: string }> = {
  "islamic":    { bar: "#1a5c3a", bg: "#f0faf4", text: "#0f3d25", dim: "#1a5c3a" },
  "math":       { bar: "#1e3a8a", bg: "#eff6ff", text: "#1e3a8a", dim: "#3b82f6" },
  "science":    { bar: "#0d5f6c", bg: "#ecfeff", text: "#0e4f5a", dim: "#06b6d4" },
  "arabic-lang":{ bar: "#5b21b6", bg: "#f5f3ff", text: "#3b0764", dim: "#8b5cf6" },
  "history":    { bar: "#7c2d12", bg: "#fff7ed", text: "#7c2d12", dim: "#ea580c" },
  "general":    { bar: "#374151", bg: "#f9fafb", text: "#1f2937", dim: "#6b7280" },
};

export default function PresentationsIndex({ embedded }: { embedded?: boolean } = {}) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const [location] = useLocation();
  const [tab, setTab] = useState<TabId>("recent");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [goLiveLoading, setGoLiveLoading] = useState<number | null>(null);

  useEffect(() => {
    if (location === "/teacher/presentations/new") {
      setShowCreate(true);
      setLocation("/teacher/presentations", { replace: true });
    }
  }, [location, setLocation]);
  const [deleteTarget, setDeleteTarget] = useState<PresentationSummary | null>(null);

  const { data: me } = useGetCurrentTeacher({
    query: { queryKey: getGetCurrentTeacherQueryKey(), retry: false },
  });
  const { data, isLoading } = useListPresentations();
  const list: PresentationSummary[] = Array.isArray(data) ? data : [];

  /* Tier badge in the header — non-Pro teachers see a Lock + Free
     badge that explains the per-deck limits. Per-deck "X / Y"
     counters live inside the editor (see editor.tsx UsageStrip). */
  const { data: tier } = useGetPresentationsLimits({
    query: { queryKey: getGetPresentationsLimitsQueryKey(), retry: false },
  });
  const showLock = !!tier && !tier.isPro;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListPresentationsQueryKey() });

  const createMut = useCreatePresentation({
    mutation: {
      onSuccess: (p) => {
        invalidate();
        toast.success(isAr ? "تم إنشاء العرض" : "Presentation created");
        setShowCreate(false);
        setLocation(`/teacher/presentations/${p.id}`);
      },
      onError: () => toast.error(isAr ? "تعذّر الإنشاء" : "Create failed"),
    },
  });
  const deleteMut = useDeletePresentation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(isAr ? "تم الحذف" : "Deleted");
        setDeleteTarget(null);
      },
      onError: () => toast.error(isAr ? "تعذّر الحذف" : "Delete failed"),
    },
  });
  const updateMut = useUpdatePresentation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(isAr ? "تم التحديث" : "Updated");
      },
      onError: () => toast.error(isAr ? "تعذّر التحديث" : "Update failed"),
    },
  });
  const publishMut = usePublishPresentation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(isAr ? "تم النشر" : "Published");
      },
      onError: () => toast.error(isAr ? "تعذّر النشر" : "Publish failed"),
    },
  });
  const unpublishMut = useUnpublishPresentation({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(isAr ? "تم إلغاء النشر" : "Unpublished");
      },
      onError: () => toast.error(isAr ? "تعذّر إلغاء النشر" : "Unpublish failed"),
    },
  });
  const duplicateMut = useDuplicatePresentation({
    mutation: {
      onSuccess: (p) => {
        invalidate();
        toast.success(isAr ? "تم النسخ" : "Duplicated");
        setLocation(`/teacher/presentations/${p.id}`);
      },
      onError: () => toast.error(isAr ? "تعذّر النسخ" : "Duplicate failed"),
    },
  });

  /* Import-file handler — sends one or more files to the backend.
     Multiple files are only accepted for image uploads; the server
     creates one slide per image and a single deck from all of them. */
  const [importLoading, setImportLoading] = useState(false);
  const handleImport = async (files: File[]) => {
    if (files.length === 0) return;
    setImportLoading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("file", f);
      const r = await fetch("/api/presentations/import-file", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error((j as { message?: string }).message ?? (isAr ? "تعذّر الاستيراد" : "Import failed"));
        return;
      }
      setShowImport(false);
      invalidate();
      toast.success(isAr ? "تم الاستيراد — جارٍ فتح المحرّر" : "Imported — opening editor");
      setLocation(`/teacher/presentations/${(j as { presentationId: number }).presentationId}`);
    } catch {
      toast.error(isAr ? "خطأ في الشبكة" : "Network error");
    } finally {
      setImportLoading(false);
    }
  };

  /* Go-live handler — creates a session and navigates to the control panel. */
  const handleGoLive = async (presentationId: number) => {
    setGoLiveLoading(presentationId);
    try {
      const r = await fetch(`/api/presentations/${presentationId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetClass: null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error((j as { message?: string }).message ?? (isAr ? "تعذّر بدء الجلسة" : "Failed to start live session"));
        return;
      }
      setLocation(`/p/control/${(j as { sessionId: string }).sessionId}`);
    } catch {
      toast.error(isAr ? "خطأ في الشبكة" : "Network error");
    } finally {
      setGoLiveLoading(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = list.filter((p) => (q ? p.title.toLowerCase().includes(q) : true));
    if (tab === "published") arr = arr.filter((p) => p.status === "published");
    else if (tab === "drafts") arr = arr.filter((p) => p.status === "draft");
    arr = [...arr].sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return tb - ta;
    });
    if (tab === "recent") arr = arr.slice(0, 24);
    return arr;
  }, [list, search, tab]);

  const counts = useMemo(
    () => ({
      recent: list.length,
      published: list.filter((p) => p.status === "published").length,
      drafts: list.filter((p) => p.status === "draft").length,
    }),
    [list],
  );

  const presentationsInner = (
    <>
    <div
      className={
        embedded
          ? "py-4"
          : "container mx-auto max-sm:max-w-none px-4 sm:px-6 lg:px-8 pt-3 pb-[calc(96px+env(safe-area-inset-bottom))] sm:py-8 max-w-6xl max-sm:bg-[#f6f8f7] max-sm:min-h-screen"
      }
      dir={isAr ? "rtl" : "ltr"}
    >

        {/* ─── Hero Banner ─────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-[20px] sm:rounded-3xl mb-4 sm:mb-6 bg-white sm:[background:linear-gradient(135deg,#071f0f_0%,#0f3d21_40%,#14532d_75%,#195e34_100%)] max-sm:border max-sm:border-black/[0.04] max-sm:shadow-sm"
        >
          {/* Radial glow — top-end */}
          <div className="hidden sm:block pointer-events-none absolute -top-16 -end-16 w-72 h-72 rounded-full opacity-[0.16]"
               style={{ background: "radial-gradient(circle, #4ade80, transparent 60%)" }} />
          {/* Radial glow — bottom-start */}
          <div className="hidden sm:block pointer-events-none absolute -bottom-10 -start-8 w-52 h-52 rounded-full opacity-[0.09]"
               style={{ background: "radial-gradient(circle, #fbbf24, transparent 60%)" }} />
          {/* Centre soft elliptical highlight */}
          <div className="hidden sm:block pointer-events-none absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-24 opacity-[0.04]"
               style={{ background: "radial-gradient(ellipse, #ffffff, transparent 70%)" }} />
          {/* Dot grid */}
          <div className="hidden sm:block pointer-events-none absolute inset-0 opacity-[0.025]"
               style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          {/* Top sheen */}
          <div className="hidden sm:block pointer-events-none absolute top-0 inset-x-0 h-px"
               style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18) 50%, transparent)" }} />
          {/* Floating micro-particles */}
          <div className="hidden sm:block pointer-events-none absolute top-[22%] start-[28%] w-1 h-1 rounded-full bg-green-300 opacity-30" />
          <div className="hidden sm:block pointer-events-none absolute top-[65%] start-[18%] w-1.5 h-1.5 rounded-full bg-amber-300 opacity-20" />
          <div className="hidden sm:block pointer-events-none absolute top-[42%] end-[38%] w-1 h-1 rounded-full bg-green-200 opacity-25" />
          <div className="hidden sm:block pointer-events-none absolute bottom-[28%] end-[22%] w-[3px] h-[3px] rounded-full bg-white opacity-15" />

          <div className="relative z-10 px-4 py-4 sm:px-10 sm:py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-5">
            {/* Left: title + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: "rgba(34,87,57,0.08)",
                    backdropFilter: "blur(8px)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                  }}
                >
                  <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-[#225739] sm:text-white" />
                </div>
                {showLock && tier && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: "rgba(217,151,6,0.2)", color: "#fde68a", border: "1px solid rgba(251,191,36,0.25)" }}
                    title={isAr
                      ? `الباقة المجانية — حتى ${tier.limits.maxSlidesRegular} شريحة و${tier.limits.maxImagesRegular} صورة لكل عرض`
                      : `Free tier — up to ${tier.limits.maxSlidesRegular} slides and ${tier.limits.maxImagesRegular} images per deck`}
                  >
                    <Lock className="w-3 h-3" />
                    {isAr ? "باقة مجانية" : "Free plan"}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-[28px] font-black text-[#173d2a] sm:text-white mb-1 sm:mb-1.5 leading-tight tracking-tight">
                {isAr ? "العروض التفاعلية" : "Interactive Presentations"}
              </h1>
              <p className="text-[11px] sm:text-sm text-slate-500 sm:text-white/55 mb-2.5 sm:mb-4 leading-relaxed max-w-sm">
                {isAr
                  ? "أنشئ عروضاً تفاعلية احترافية بالذكاء الاصطناعي"
                  : "Build professional interactive lessons powered by AI"}
              </p>
              {!isLoading && (
                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { icon: <Layers className="w-3 h-3" />, label: isAr ? `${counts.recent} عرض` : `${counts.recent} decks` },
                    { icon: <Globe className="w-3 h-3" />, label: isAr ? `${counts.published} منشور` : `${counts.published} published` },
                    { icon: <FileText className="w-3 h-3" />, label: isAr ? `${counts.drafts} مسودة` : `${counts.drafts} drafts` },
                  ].map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-[#f1f5f3] text-slate-500 border border-slate-200 sm:bg-white/[0.09] sm:text-white/70 sm:border-white/10"
                    >
                      {s.icon}
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: CTAs */}
            <div className="grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex sm:flex-col shrink-0">
              {/* Primary — عرض جديد */}
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="w-full sm:w-auto inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-2xl font-bold text-[11px] sm:text-sm transition-all duration-200 sm:hover:scale-[1.03] active:scale-[0.98] select-none bg-[#225739] text-white shadow-sm sm:text-[#0a4d26] sm:[background:linear-gradient(135deg,#ffffff_0%,#e8f5ec_100%)] sm:shadow-[0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.6)] px-2 py-2.5 sm:px-[26px] sm:py-[13px] sm:min-w-[148px]"
              >
                <Plus className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
                {isAr ? "عرض جديد" : "New deck"}
              </button>
              {/* Secondary — توليد بالذكاء */}
              <button
                type="button"
                onClick={() => setLocation("/teacher/presentations/new")}
                className="w-full sm:w-auto inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-2xl font-bold text-[11px] sm:text-sm border transition-all duration-200 sm:hover:scale-[1.03] active:scale-[0.98] select-none bg-white text-[#225739] border-[#225739]/20 shadow-none sm:border-2 sm:border-[#d97706] sm:text-[#fde68a] sm:[background:linear-gradient(135deg,rgba(217,119,6,0.2)_0%,rgba(245,158,11,0.12)_100%)] sm:shadow-[0_4px_16px_rgba(0,0,0,0.15)] px-2 py-2.5 sm:px-[26px] sm:py-[13px] sm:min-w-[148px]"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                {isAr ? "توليد بالذكاء" : "AI generate"}
              </button>
              {/* Tertiary — استيراد ملف */}
              <button
                type="button"
                onClick={() => setShowImport(true)}
                className="inline-flex flex-col sm:flex-row sm:flex-none items-center justify-center gap-1 sm:gap-2 rounded-2xl sm:rounded-xl text-[11px] sm:text-[13px] font-bold sm:font-medium border transition-all duration-200 sm:hover:scale-[1.02] sm:hover:bg-white/12 active:scale-[0.98] select-none bg-white text-[#225739] border-[#225739]/20 px-2 py-2.5 sm:px-[18px] sm:py-[9px] sm:min-w-[148px] sm:bg-white/[0.06] sm:text-white/60 sm:border-white/[0.15]"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                {isAr ? "استيراد ملف" : "Import file"}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Tabs + Search ───────────────────────────────────── */}
        <div className="flex flex-col-reverse sm:flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 sm:mb-5">
          <div className="flex items-center gap-0.5 p-1 rounded-2xl bg-white sm:bg-muted/25 border border-border/40 w-full sm:w-fit overflow-x-auto">
            {(
              [
                { id: "recent", label: isAr ? "الكل" : "All", icon: Clock, count: counts.recent },
                { id: "published", label: isAr ? "المنشورة" : "Published", icon: CheckCircle2, count: counts.published },
                { id: "drafts", label: isAr ? "المسودات" : "Drafts", icon: FileText, count: counts.drafts },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 ${
                    active
                      ? "text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                  style={active ? { background: BRAND_GREEN, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" } : undefined}
                >
                  <Icon className="hidden sm:block w-3.5 h-3.5" />
                  {t.label}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      active ? "bg-white/20 text-white" : "bg-muted/70 text-muted-foreground"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 lg:max-w-64">
            <Search
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none"
              style={{ [isAr ? "right" : "left"]: 12 } as React.CSSProperties}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث عن عرض..." : "Search presentations..."}
              className={`${isAr ? "pr-9" : "pl-9"} rounded-2xl bg-white sm:bg-background h-10 border-border/40 text-sm shadow-sm`}
            />
          </div>
        </div>

        {/* ─── Grid ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="rounded-3xl overflow-hidden"
                style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
              >
                <div className="h-[156px] animate-pulse" style={{ background: "#f0fdf4" }} />
                <div className="p-4 space-y-3 bg-card">
                  <div className="h-4 w-3/4 rounded-full animate-pulse bg-muted" />
                  <div className="h-3 w-1/2 rounded-full animate-pulse bg-muted/60" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-7 w-20 rounded-xl animate-pulse bg-muted/50" />
                    <div className="h-7 w-16 rounded-xl animate-pulse bg-muted/50" />
                  </div>
                  <div className="h-px bg-border/40" />
                  <div className="flex justify-between">
                    <div className="h-3 w-16 rounded-full animate-pulse bg-muted/50" />
                    <div className="h-3 w-20 rounded-full animate-pulse bg-muted/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState isAr={isAr} onCreate={() => setShowCreate(true)} hasSearch={!!search} tab={tab} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
            {filtered.map((p) => (
              <PresentationCard
                key={p.id}
                p={p}
                isAr={isAr}
                onOpen={() => setLocation(`/teacher/presentations/${p.id}`)}
                onSave={(title) => updateMut.mutate({ id: p.id, data: { title } })}
                onResults={() => setLocation(`/teacher/presentations/${p.id}/sessions`)}
                onDuplicate={() => duplicateMut.mutate({ id: p.id })}
                onDelete={() => setDeleteTarget(p)}
                onPublish={() => publishMut.mutate({ id: p.id })}
                onUnpublish={() => unpublishMut.mutate({ id: p.id })}
                onGoLive={() => handleGoLive(p.id)}
                goLiveLoading={goLiveLoading === p.id}
                isOwner={!!me && p.teacherId === me.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <CreateModal
        open={showCreate}
        onOpenChange={setShowCreate}
        isAr={isAr}
        loading={createMut.isPending}
        onSubmit={(payload) => createMut.mutate({ data: payload })}
      />

      {/* Import file */}
      <ImportModal
        open={showImport}
        onOpenChange={setShowImport}
        isAr={isAr}
        loading={importLoading}
        onImport={handleImport}
        maxMb={tier?.limits.maxSizeMbRegular ?? 50}
        maxImages={tier?.isPro ? 10 : 5}
      />


      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent dir={isAr ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isAr ? "حذف العرض؟" : "Delete presentation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `سيتم حذف «${deleteTarget?.title}» نهائياً. لا يمكن التراجع.`
                : `"${deleteTarget?.title}" will be permanently deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate({ id: deleteTarget.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {isAr ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return embedded ? presentationsInner : <Layout>{presentationsInner}</Layout>;
}

// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────
function PresentationCard({
  p,
  isAr,
  onOpen,
  onSave,
  onResults,
  onDuplicate,
  onDelete,
  onPublish,
  onUnpublish,
  onGoLive,
  goLiveLoading,
  isOwner,
}: {
  p: PresentationSummary;
  isAr: boolean;
  onOpen: () => void;
  onSave: (title: string) => void;
  onResults: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onGoLive: () => void;
  goLiveLoading: boolean;
  isOwner: boolean;
}) {
  const isPublished = p.status === "published";

  // Deterministic color palette based on title hash — 6 vibrant options
  let _h = 0;
  for (let i = 0; i < p.title.length; i++) _h = (_h * 31 + p.title.charCodeAt(i)) >>> 0;

  const COVER_PALETTES = [
    { bg: "linear-gradient(140deg, #064e3b 0%, #065f46 40%, #047857 100%)",  accent: "#6ee7b7", shape: "circles" },
    { bg: "linear-gradient(125deg, #1e3a8a 0%, #1e40af 45%, #2563eb 100%)",  accent: "#93c5fd", shape: "bars"    },
    { bg: "linear-gradient(150deg, #3b0764 0%, #4c1d95 45%, #6d28d9 100%)",  accent: "#d8b4fe", shape: "dots"    },
    { bg: "linear-gradient(130deg, #7c2d12 0%, #9a3412 40%, #b45309 100%)",  accent: "#fcd34d", shape: "waves"   },
    { bg: "linear-gradient(145deg, #134e4a 0%, #0e5f5a 45%, #0f766e 100%)",  accent: "#5eead4", shape: "grid"    },
    { bg: "linear-gradient(138deg, #111827 0%, #1e2d3d 45%, #1e3a5f 100%)",  accent: "#93c5fd", shape: "rects"   },
  ];
  const cover = COVER_PALETTES[_h % 6];
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(p.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(p.title);
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  }, [p.title]);

  const commit = useCallback(() => {
    const title = editValue.trim();
    if (title && title !== p.title) onSave(title);
    setEditing(false);
  }, [editValue, p.title, onSave]);

  const cancel = useCallback(() => {
    setEditing(false);
    setEditValue(p.title);
  }, [p.title]);

  return (
    <div
      onClick={editing ? undefined : onOpen}
      className="group relative flex h-[206px] sm:h-auto flex-col rounded-[20px] sm:rounded-3xl overflow-hidden transition-all duration-300 sm:hover:-translate-y-2"
      style={{
        background: "var(--card)",
        border: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 1px 8px rgba(15,23,42,0.045)",
        cursor: editing ? "default" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (window.matchMedia("(max-width: 639px)").matches) return;
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          `0 20px 56px rgba(0,0,0,0.13), 0 4px 16px rgba(0,0,0,0.06), 0 0 0 1.5px ${cover.accent}45`;
      }}
      onMouseLeave={(e) => {
        if (window.matchMedia("(max-width: 639px)").matches) return;
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          "0 2px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)";
      }}
    >
      {/* ── Vibrant cover ─────────────────────────────────── */}
      <div
        className="relative h-[110px] sm:h-[168px] overflow-hidden shrink-0"
        style={{
          background: cover.bg,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      >
        {/* Main radial glow — top-end */}
        <div
          className="pointer-events-none absolute -top-10 -end-10 w-44 h-44 rounded-full"
          style={{ background: `radial-gradient(circle, ${cover.accent}60, transparent 65%)` }}
        />
        {/* Secondary radial glow — bottom-start */}
        <div
          className="pointer-events-none absolute -bottom-8 -start-6 w-32 h-32 rounded-full"
          style={{ background: `radial-gradient(circle, ${cover.accent}40, transparent 65%)` }}
        />
        {/* Top sheen line */}
        <div className="pointer-events-none absolute top-0 inset-x-0 h-px"
             style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />

        {/* Mock slide-content lines */}
        <div className="absolute top-4 sm:top-6 start-4 end-20 space-y-1.5 sm:space-y-2 opacity-[0.20] sm:opacity-[0.32]">
          <div className="h-2 sm:h-2.5 rounded-full" style={{ background: cover.accent, width: "68%" }} />
          <div className="h-1 sm:h-1.5 rounded-full" style={{ background: cover.accent, width: "46%" }} />
        </div>

        {/* Decorative element — varies per shape type */}
        {cover.shape === "bars" && (
          <div className="absolute bottom-8 sm:bottom-10 end-5 flex items-end gap-1 opacity-[0.20] sm:opacity-[0.30]">
            {[42, 68, 52, 78, 58, 70].map((h, i) => (
              <div key={i} className="w-2.5 rounded-t-sm" style={{ height: h * 0.38, background: cover.accent }} />
            ))}
          </div>
        )}
        {cover.shape === "circles" && (
          <div className="absolute bottom-7 sm:bottom-8 end-5 opacity-[0.18] sm:opacity-[0.26]">
            <div className="w-14 h-14 rounded-full border-[3px]" style={{ borderColor: cover.accent }} />
            <div className="w-7 h-7 rounded-full border-2 absolute top-[15%] start-[15%]" style={{ borderColor: cover.accent }} />
          </div>
        )}
        {cover.shape === "dots" && (
          <div className="absolute bottom-7 sm:bottom-8 end-5 grid grid-cols-3 gap-1.5 opacity-[0.20] sm:opacity-[0.30]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full" style={{ background: cover.accent }} />
            ))}
          </div>
        )}
        {cover.shape === "waves" && (
          <div className="absolute bottom-7 sm:bottom-9 end-4 start-4 space-y-1.5 opacity-[0.18] sm:opacity-[0.28]">
            {[100, 78, 60].map((w, i) => (
              <div key={i} className="h-1.5 rounded-full" style={{ width: `${w}%`, background: cover.accent }} />
            ))}
          </div>
        )}
        {cover.shape === "grid" && (
          <div className="absolute bottom-7 sm:bottom-8 end-5 grid grid-cols-3 gap-1 opacity-[0.18] sm:opacity-[0.26]">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-sm" style={{ background: cover.accent }} />
            ))}
          </div>
        )}
        {cover.shape === "rects" && (
          <div className="absolute bottom-7 sm:bottom-8 end-5 flex gap-2 opacity-[0.18] sm:opacity-[0.26]">
            {[{ w: 28, h: 20 }, { w: 18, h: 28 }, { w: 22, h: 14 }].map((r, i) => (
              <div key={i} className="rounded-md" style={{ width: r.w, height: r.h, background: cover.accent }} />
            ))}
          </div>
        )}

        {/* Title overlay — deep gradient strip */}
        <div className="hidden sm:block absolute bottom-0 inset-x-0 px-3.5 pt-8 pb-3"
             style={{ background: "linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 55%, transparent 100%)" }}>
          <p className="text-white text-xs font-bold leading-tight line-clamp-2" dir="auto">
            {p.title}
          </p>
        </div>

        {/* Badges */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-3 pt-2.5">
          {isPublished ? (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 rounded-full text-[9px] sm:text-[10px] font-bold shadow-sm"
              style={{ background: "rgba(255,255,255,0.92)", color: BRAND_GREEN }}
            >
              <Globe className="w-2.5 h-2.5" />
              {isAr ? "منشور" : "Published"}
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-black/25 text-white/85">
              {isAr ? "مسودة" : "Draft"}
            </span>
          )}
          <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] font-bold bg-black/20 text-white/80">
            {p.language === "ar" ? "AR" : "EN"}
          </span>
        </div>

        {/* Hover overlay */}
        <div className="hidden sm:flex absolute inset-0 items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 bg-black/20">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white shadow-lg translate-y-1 group-hover:translate-y-0 transition-transform duration-200"
            style={{ color: "#0a4d26" }}
          >
            <Pencil className="w-3.5 h-3.5" />
            {isAr ? "فتح المحرر" : "Open editor"}
          </span>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-col flex-1 px-3 py-2.5 sm:p-4 sm:pt-3.5">
        {/* Title + menu */}
        <div className="flex items-start gap-1.5 mb-1">
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { e.preventDefault(); cancel(); }
              }}
              onBlur={commit}
              onClick={(e) => e.stopPropagation()}
              maxLength={200}
              dir={isAr ? "rtl" : "ltr"}
              className="flex-1 text-sm font-bold text-foreground bg-muted/50 border border-border rounded-xl px-3 py-1.5 outline-none min-w-0"
              style={{ boxShadow: `0 0 0 2px ${BRAND_GREEN}40` }}
            />
          ) : (
            <h3
              className={`flex-1 text-[13px] sm:text-[14px] font-semibold text-foreground line-clamp-1 sm:line-clamp-2 leading-[1.25] sm:leading-[1.4]${isOwner ? " cursor-text select-none" : ""}`}
              onDoubleClick={isOwner ? startEdit : undefined}
              title={isOwner ? (isAr ? "انقر مرتين لتغيير الاسم" : "Double-click to rename") : undefined}
            >
              {p.title}
            </h3>
          )}
          {!editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors flex-shrink-0 -mt-0.5"
                  aria-label={isAr ? "إجراءات" : "Actions"}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isAr ? "start" : "end"} onClick={(e) => e.stopPropagation()}>
                {isOwner && (
                  <DropdownMenuItem onClick={startEdit}>
                    <Pencil className="w-4 h-4 me-2" />
                    {isAr ? "إعادة تسمية" : "Rename"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="w-4 h-4 me-2" />
                  {isAr ? "نسخ" : "Duplicate"}
                </DropdownMenuItem>
                {isOwner && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onGoLive(); }}
                    disabled={goLiveLoading}
                    className="font-bold"
                    style={{ color: BRAND_GOLD }}
                  >
                    {goLiveLoading ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Radio className="w-4 h-4 me-2" />}
                    {isAr ? "بدء عرض مباشر" : "Start live session"}
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <DropdownMenuItem onClick={onResults}>
                    <BarChart3 className="w-4 h-4 me-2" />
                    {isAr ? "النتائج السابقة" : "Past results"}
                  </DropdownMenuItem>
                )}
                {isOwner && (isPublished ? (
                  <DropdownMenuItem onClick={onUnpublish}>
                    <EyeOff className="w-4 h-4 me-2" />
                    {isAr ? "إلغاء النشر" : "Unpublish"}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onPublish}>
                    <Globe className="w-4 h-4 me-2" />
                    {isAr ? "نشر" : "Publish"}
                  </DropdownMenuItem>
                ))}
                {isOwner && <DropdownMenuSeparator />}
                {isOwner && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 me-2" />
                    {isAr ? "حذف" : "Delete"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="sm:hidden mb-1.5 inline-flex w-fit items-center gap-1 rounded-lg border border-[#225739]/12 bg-[#f1f7f3] px-2 py-0.5 text-[10px] font-bold text-[#225739]"
        >
          <Pencil className="w-2.5 h-2.5" />
          {isAr ? "فتح المحرر" : "Open editor"}
        </button>

        {/* Visible quick-action buttons */}
        {isOwner && !editing && (
          <div className="hidden sm:flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onGoLive(); }}
              disabled={goLiveLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 hover:scale-[1.04] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "rgba(234,179,8,0.1)",
                color: "#92400e",
                border: "1px solid rgba(234,179,8,0.22)",
              }}
            >
              {goLiveLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Radio className="w-3.5 h-3.5" />}
              {isAr ? "مباشر" : "Go live"}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onResults(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground/70 transition-all duration-150 hover:text-foreground hover:bg-muted/70 hover:scale-[1.04] active:scale-[0.97]"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {isAr ? "نتائج" : "Results"}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5 text-[9px] sm:text-[11px] text-muted-foreground/70 mt-auto pt-1.5 border-t border-border/20 sm:gap-2 sm:pt-2.5 sm:border-border/30">
          <span className="inline-flex items-center gap-0.5 sm:gap-1 font-medium">
            <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-60" />
            {p.slideCount} {isAr ? "شريحة" : "slides"}
          </span>
          <span className="inline-flex items-center gap-0.5 sm:gap-1 ms-auto font-medium">
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-60" />
            {formatRelative(p.updatedAt, isAr)}
          </span>
          <span
            className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:hidden"
            style={{
              background: isPublished ? "#edf7f1" : "#f4f4f5",
              color: isPublished ? BRAND_GREEN : "#71717a",
            }}
          >
            {isPublished ? (isAr ? "منشور" : "Live") : (isAr ? "مسودة" : "Draft")}
          </span>
          {!isOwner && p.ownerName && (
            <span className="hidden sm:inline truncate max-w-[80px] opacity-60" title={p.ownerName}>
              {p.ownerName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────
function EmptyState({
  isAr,
  onCreate,
  hasSearch,
  tab,
}: {
  isAr: boolean;
  onCreate: () => void;
  hasSearch: boolean;
  tab: TabId;
}) {
  if (hasSearch) {
    return (
      <div className="text-center py-20 px-6 rounded-3xl border border-dashed border-border/40 bg-card/50">
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: "#f1f5f9" }}
        >
          <Search className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">
          {isAr ? "لا توجد نتائج مطابقة" : "No matching results"}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {isAr ? "جرّب كلمات مختلفة" : "Try different keywords"}
        </p>
      </div>
    );
  }
  const msg =
    tab === "published"
      ? isAr
        ? "لا توجد عروض منشورة بعد"
        : "No published presentations yet"
      : tab === "drafts"
        ? isAr
          ? "لا توجد مسودات"
          : "No drafts"
        : isAr
          ? "ابدأ بإنشاء أول عرض تفاعلي لك"
          : "Create your first interactive presentation";
  return (
    <div
      className="text-center py-20 px-6 rounded-3xl"
      style={{
        background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 60%, #f0fdf4 100%)",
        border: "2px dashed #86efac",
      }}
    >
      <div
        className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center shadow-lg"
        style={{ background: `linear-gradient(135deg, ${BRAND_GREEN}, #16a34a)` }}
      >
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      <h3 className="text-xl font-black text-foreground mb-2">
        {isAr ? "ابدأ إبداعك هنا" : "Start creating"}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">{msg}</p>
      <Button
        onClick={onCreate}
        className="gap-2 font-bold rounded-2xl px-6 h-auto py-2.5"
        style={{ background: BRAND_GREEN, color: "white" }}
      >
        <Plus className="w-4 h-4" />
        {isAr ? "عرض جديد" : "New presentation"}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Import file modal
// ─────────────────────────────────────────────
const IMPORT_ACCEPT = ".pptx,.ppt,.pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp";
const IMPORT_ACCEPT_LABEL_AR = "PDF، PPTX، Word، Excel، PNG، JPG، WebP";
const IMPORT_ACCEPT_LABEL_EN = "PDF, PPTX, Word, Excel, PNG, JPG, WebP";

const IMAGE_EXTS_SET = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
function isImageFile(f: File): boolean {
  const ext = f.name.includes(".")
    ? f.name.slice(f.name.lastIndexOf(".")).toLowerCase()
    : "";
  return f.type.startsWith("image/") || IMAGE_EXTS_SET.has(ext);
}

function ImportModal({
  open,
  onOpenChange,
  isAr,
  loading,
  onImport,
  maxMb,
  maxImages,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAr: boolean;
  loading: boolean;
  onImport: (files: File[]) => void;
  maxMb: number;
  maxImages: number;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allImages = files.length > 0 && files.every(isImageFile);
  const tooManyImages = allImages && files.length > maxImages;
  const bigFile = files.find((f) => f.size > maxMb * 1024 * 1024);
  const canSubmit = files.length > 0 && !tooManyImages && !bigFile;

  const reset = () => { setFiles([]); setDragging(false); };

  const accept = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const arr = Array.from(incoming);
    /* If mixing images + documents, keep only the first document
       (existing single-file flow). If all images, keep them all. */
    const imgs = arr.filter(isImageFile);
    const docs = arr.filter((f) => !isImageFile(f));
    if (docs.length > 0) {
      setFiles([docs[0]]);
    } else {
      setFiles(imgs);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent dir={isAr ? "rtl" : "ltr"} className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `${BRAND_GREEN}12`, color: BRAND_GREEN }}>
              <FileUp className="w-5 h-5" />
            </span>
            {isAr ? "استيراد ملف كعرض جديد" : "Import file as new deck"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          {isAr
            ? `يمكنك رفع ملف واحد (PDF، PPTX، Word، Excel) أو حتى ${maxImages} صور دفعةً واحدة. الحجم الأقصى: ${maxMb} م.ب.`
            : `Upload one document (PDF, PPTX, Word, Excel) or up to ${maxImages} images at once. Max size: ${maxMb} MB.`}
        </p>
        <div className="flex flex-wrap gap-2 -mt-1">
          {(isAr
            ? ["PDF", "Word (.docx)", "Excel (.xlsx)", `صور (حتى ${maxImages})`]
            : ["PDF", "Word (.docx)", "Excel (.xlsx)", `Images (up to ${maxImages})`]
          ).map((label) => (
            <span
              key={label}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "#f0fdf4", color: "#225739", border: "1px solid #bbf7d0" }}
            >
              {label}
            </span>
          ))}
        </div>
        <div
          className={`relative rounded-3xl border border-dashed p-8 text-center transition-colors cursor-pointer ${dragging ? "border-current bg-muted/30" : "border-muted hover:border-muted-foreground/50"}`}
          style={dragging ? { borderColor: BRAND_GREEN } : undefined}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            accept(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={IMPORT_ACCEPT}
            multiple
            onChange={(e) => accept(e.target.files)}
          />
          {files.length > 0 ? (
            <div className="space-y-1">
              <FileText className="w-10 h-10 mx-auto mb-2" style={{ color: BRAND_GREEN }} />
              {files.length === 1 ? (
                <p className="font-bold text-sm text-foreground truncate max-w-full">{files[0].name}</p>
              ) : (
                <p className="font-bold text-sm text-foreground">
                  {isAr ? `${files.length} صور محددة` : `${files.length} images selected`}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {files.length === 1
                  ? `${(files[0].size / (1024 * 1024)).toFixed(2)} MB`
                  : `${(files.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(2)} MB ${isAr ? "إجمالي" : "total"}`}
              </p>
              {bigFile && (
                <p className="text-xs text-destructive font-semibold">
                  {isAr ? `"${bigFile.name}" أكبر من ${maxMb} م.ب` : `"${bigFile.name}" exceeds ${maxMb} MB`}
                </p>
              )}
              {tooManyImages && (
                <p className="text-xs text-destructive font-semibold">
                  {isAr
                    ? `يمكنك رفع ${maxImages} صور كحد أقصى في هذه الباقة`
                    : `Your plan allows up to ${maxImages} images per import`}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">
                {isAr ? "اسحب ملفاً هنا أو اضغط للاختيار" : "Drag files here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isAr ? IMPORT_ACCEPT_LABEL_AR : IMPORT_ACCEPT_LABEL_EN}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="rounded-2xl">
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={() => { if (canSubmit) onImport(files); }}
            disabled={!canSubmit || loading}
            style={{ background: BRAND_GREEN, color: "white" }}
            className="gap-2 font-bold rounded-2xl"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? (isAr ? "جارٍ الاستيراد…" : "Importing…")
              : allImages
                ? (isAr ? `استيراد ${files.length} صورة` : `Import ${files.length} image${files.length === 1 ? "" : "s"}`)
                : (isAr ? "توليد عرض بالذكاء الاصطناعي" : "Generate deck with AI")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Create modal
// ─────────────────────────────────────────────
function CreateModal({
  open,
  onOpenChange,
  isAr,
  loading,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAr: boolean;
  loading: boolean;
  onSubmit: (data: {
    title: string;
    language: "ar" | "en";
    subject?: string;
    gradeLevel?: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<"ar" | "en">(isAr ? "ar" : "en");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");

  const reset = () => {
    setTitle("");
    setSubject("");
    setGradeLevel("");
    setLanguage(isAr ? "ar" : "en");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent dir={isAr ? "rtl" : "ltr"} className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: `${BRAND_GOLD}18`, color: BRAND_GREEN }}>
              <Sparkles className="w-5 h-5" />
            </span>
            {isAr ? "عرض تفاعلي جديد" : "New Presentation"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="mb-2 block">
              {isAr ? "عنوان العرض" : "Title"}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAr ? "مثال: مقدمة في الكسور" : "e.g. Intro to fractions"}
              maxLength={200}
              autoFocus
              className="rounded-2xl"
            />
          </div>
          <div>
            <Label className="mb-2 block">{isAr ? "اللغة" : "Language"}</Label>
            <Select value={language} onValueChange={(v) => setLanguage(v as "ar" | "en")}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-2 block text-xs">
                {isAr ? "المادة (اختياري)" : "Subject (optional)"}
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={isAr ? "علوم" : "Science"}
                maxLength={100}
                className="rounded-2xl"
              />
            </div>
            <div>
              <Label className="mb-2 block text-xs">
                {isAr ? "الصف (اختياري)" : "Grade (optional)"}
              </Label>
              <Input
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder={isAr ? "السادس" : "Grade 6"}
                maxLength={50}
                className="rounded-2xl"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={() => {
              const t = title.trim();
              if (!t) return;
              onSubmit({
                title: t,
                language,
                subject: subject.trim() || undefined,
                gradeLevel: gradeLevel.trim() || undefined,
              });
            }}
            disabled={loading || !title.trim()}
            style={{ background: BRAND_GREEN, color: "white" }}
            className="gap-2 font-bold rounded-2xl"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isAr ? "إنشاء وفتح المحرر" : "Create & open editor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
