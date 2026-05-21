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
  BookOpen,
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
    <div className={embedded ? "py-4" : "container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-6xl"} dir={isAr ? "rtl" : "ltr"}>

        {/* ─── Hero Banner ─────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-3xl mb-8"
          style={{ background: "linear-gradient(135deg, #092b16 0%, #14532d 55%, #1a6638 100%)" }}
        >
          {/* Ambient glow orbs */}
          <div className="pointer-events-none absolute -top-20 -end-20 w-80 h-80 rounded-full opacity-[0.11]"
               style={{ background: "radial-gradient(circle, #4ade80, transparent 65%)" }} />
          <div className="pointer-events-none absolute -bottom-14 -start-10 w-60 h-60 rounded-full opacity-[0.07]"
               style={{ background: "radial-gradient(circle, #fbbf24, transparent 65%)" }} />
          {/* Dot grid texture */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
               style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

          <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Left: title + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.13)", backdropFilter: "blur(8px)" }}
                >
                  <Monitor className="w-6 h-6 text-white" />
                </div>
                {showLock && tier && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
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
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
                {isAr ? "العروض التفاعلية" : "Interactive Presentations"}
              </h1>
              <p className="text-sm sm:text-[15px] text-white/60 mb-5 leading-relaxed max-w-md">
                {isAr
                  ? "أنشئ عروضاً تفاعلية احترافية بالذكاء الاصطناعي"
                  : "Build professional interactive lessons powered by AI"}
              </p>
              {!isLoading && (
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { icon: <Layers className="w-3 h-3" />, label: isAr ? `${counts.recent} عرض` : `${counts.recent} decks` },
                    { icon: <Globe className="w-3 h-3" />, label: isAr ? `${counts.published} منشور` : `${counts.published} published` },
                    { icon: <FileText className="w-3 h-3" />, label: isAr ? `${counts.drafts} مسودة` : `${counts.drafts} drafts` },
                  ].map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)" }}
                    >
                      {s.icon}
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: primary CTAs */}
            <div className="flex flex-row sm:flex-col gap-3 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2.5 rounded-2xl font-bold text-sm transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.97] select-none"
                style={{ background: "white", color: "#0a4d26", padding: "14px 28px", minWidth: 152 }}
              >
                <Plus className="w-4 h-4 shrink-0" />
                {isAr ? "عرض جديد" : "New deck"}
              </button>
              <button
                type="button"
                onClick={() => setLocation("/teacher/presentations/new")}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2.5 rounded-2xl font-bold text-sm border-2 transition-all duration-200 hover:scale-[1.03] hover:bg-amber-400/20 active:scale-[0.97] select-none"
                style={{ borderColor: "#d97706", color: "#fde68a", background: "rgba(217,119,6,0.14)", padding: "14px 28px", minWidth: 152 }}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                {isAr ? "توليد بالذكاء" : "AI generate"}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Quick Actions ───────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-[11px] font-bold text-muted-foreground mb-3 tracking-[0.12em] uppercase ps-1">
            {isAr ? "ابدأ بسرعة" : "Quick start"}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                {
                  icon: Upload,
                  label: isAr ? "استيراد ملف" : "Import file",
                  sub: isAr ? "PDF، PPTX، صور" : "PDF, PPTX, images",
                  onClick: () => setShowImport(true),
                  iconColor: "#0ea5e9",
                  bg: "#f0f9ff",
                  border: "#bae6fd",
                  textColor: "#075985",
                },
                {
                  icon: BookOpen,
                  label: isAr ? "من واجب" : "From homework",
                  sub: isAr ? "حوّل واجباً لعرض" : "Turn homework into a deck",
                  onClick: () => setLocation("/teacher"),
                  iconColor: "#7c3aed",
                  bg: "#f5f3ff",
                  border: "#ddd6fe",
                  textColor: "#4c1d95",
                },
                {
                  icon: Layers,
                  label: isAr ? "بنك الشرائح" : "Slide bank",
                  sub: isAr ? "شرائح جاهزة للتخصيص" : "Ready-made slides",
                  onClick: () => setLocation("/teacher/presentations/new"),
                  iconColor: "#0891b2",
                  bg: "#ecfeff",
                  border: "#a5f3fc",
                  textColor: "#164e63",
                },
                {
                  icon: Sparkles,
                  label: isAr ? "قوالب جاهزة" : "Templates",
                  sub: isAr ? "قوالب احترافية" : "Professional templates",
                  onClick: () => setShowCreate(true),
                  iconColor: "#d97706",
                  bg: "#fffbeb",
                  border: "#fde68a",
                  textColor: "#92400e",
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="group text-start flex flex-col gap-2.5 p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-md active:scale-[0.98]"
                  style={{ background: item.bg, borderColor: item.border }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${item.iconColor}22`, color: item.iconColor }}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight" style={{ color: item.textColor }}>
                      {item.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{item.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sticky mobile CTA */}
        <div className="sm:hidden fixed bottom-4 inset-x-4 z-40 flex gap-2">
          <Button
            onClick={() => setShowImport(true)}
            variant="outline"
            className="w-12 h-12 p-0 rounded-2xl shadow-xl bg-background"
          >
            <Upload className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setLocation("/teacher/presentations/new")}
            variant="outline"
            className="w-12 h-12 p-0 rounded-2xl shadow-xl bg-background border-2"
            style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}
          >
            <Sparkles className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setShowCreate(true)}
            className="flex-1 gap-2 font-bold shadow-xl h-12 rounded-2xl"
            style={{ background: BRAND_GREEN, color: "white" }}
          >
            <Plus className="w-5 h-5" />
            {isAr ? "عرض جديد" : "New"}
          </Button>
        </div>

        {/* ─── Tabs + Search ───────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-muted/30 border border-border/50 w-full sm:w-fit overflow-x-auto">
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
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                    active
                      ? "text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  style={active ? { background: BRAND_GREEN } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 lg:max-w-xs">
            <Search
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
              style={{ [isAr ? "right" : "left"]: 12 } as React.CSSProperties}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث عن عرض..." : "Search presentations..."}
              className={`${isAr ? "pr-9" : "pl-9"} rounded-2xl bg-card/80 h-10`}
            />
          </div>
        </div>

        {/* ─── Grid ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
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
  const kind = detectContentKind(p.title);
  const theme = KIND_THEME[kind];
  // hash بسيط للتنويع داخل نفس النوع
  let _h = 0;
  for (let i = 0; i < p.title.length; i++) _h = (_h * 31 + p.title.charCodeAt(i)) >>> 0;
  const variant = _h % 3; // 0, 1, 2 داخل كل نوع
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

  // ── معاينة ذكية حسب نوع المحتوى ─────────────────────
  const SmartPreview = () => {
    const b = theme.bar;
    const d = theme.dim;

    if (kind === "islamic") {
      // هوية إسلامية: قوس هادئ + خطوط نص عربي
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-5 relative overflow-hidden">
          {/* قوس ديكوري */}
          <svg className="absolute top-0 inset-x-0 w-full opacity-10" viewBox="0 0 200 60" preserveAspectRatio="none">
            <path d="M0 60 Q50 0 100 20 Q150 40 200 0 L200 60Z" fill={b} />
          </svg>
          <div className="relative z-10 flex flex-col items-center gap-2 w-full">
            {/* زخرفة دائرية */}
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ borderColor: b, opacity: 0.45 }}>
              <div className="w-3 h-3 rounded-full" style={{ background: b, opacity: 0.6 }} />
            </div>
            <div className="h-1.5 rounded-full w-1/2" style={{ background: b, opacity: 0.6 }} />
            <div className="h-1 rounded-full w-2/5" style={{ background: b, opacity: 0.3 }} />
          </div>
          {/* نقاط زخرفية */}
          <div className="absolute bottom-3 flex gap-1.5">
            {[0.25, 0.4, 0.25].map((op, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: b, opacity: op }} />
            ))}
          </div>
        </div>
      );
    }

    if (kind === "math") {
      // رياضيات: شبكة + رموز معادلات
      return (
        <div className="w-full h-full relative overflow-hidden">
          {/* شبكة خلفية */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id={`grid-${variant}`} width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M 16 0 L 0 0 0 16" fill="none" stroke={b} strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#grid-${variant})`} />
          </svg>
          <div className="relative z-10 flex flex-col p-4 gap-2 h-full">
            <div className="h-2 rounded w-3/5" style={{ background: b, opacity: 0.7 }} />
            <div className="flex-1 flex items-center justify-center">
              {variant === 0 && (
                <div className="flex items-center gap-2 opacity-30" style={{ color: b }}>
                  <div className="w-7 h-5 rounded border-2" style={{ borderColor: d }} />
                  <span className="text-base font-black" style={{ color: d }}>+</span>
                  <div className="w-5 h-5 rounded border-2" style={{ borderColor: d }} />
                  <span className="text-base font-black" style={{ color: d }}>=</span>
                  <div className="w-6 h-5 rounded" style={{ background: d, opacity: 0.25 }} />
                </div>
              )}
              {variant === 1 && (
                <div className="flex gap-1.5 items-end opacity-50" style={{ color: d }}>
                  {[60, 90, 70, 100, 55, 80].map((h, i) => (
                    <div key={i} className="w-3 rounded-t" style={{ height: h * 0.35, background: d, opacity: 0.5 + i * 0.08 }} />
                  ))}
                </div>
              )}
              {variant === 2 && (
                <div className="text-center opacity-25" style={{ color: d }}>
                  <div className="text-lg font-black tracking-wider" style={{ fontFamily: "serif" }}>∑ · ∫ · π</div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (kind === "science") {
      // علوم: عناصر دائرية (ذرة / خلية)
      return (
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
          {variant === 0 && (
            /* نموذج ذرة مبسط */
            <svg viewBox="0 0 100 80" className="w-24 opacity-20" style={{ color: d }}>
              <circle cx="50" cy="40" r="6" fill={b} opacity="0.7" />
              <ellipse cx="50" cy="40" rx="30" ry="12" fill="none" stroke={b} strokeWidth="1.5" opacity="0.5" />
              <ellipse cx="50" cy="40" rx="30" ry="12" fill="none" stroke={b} strokeWidth="1.5" opacity="0.4" transform="rotate(60 50 40)" />
              <ellipse cx="50" cy="40" rx="30" ry="12" fill="none" stroke={b} strokeWidth="1.5" opacity="0.4" transform="rotate(-60 50 40)" />
            </svg>
          )}
          {variant === 1 && (
            /* خلايا شبكية */
            <div className="grid grid-cols-3 gap-1.5 p-5 w-full h-full">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="rounded-full border" style={{ borderColor: b, opacity: 0.15 + (i % 3) * 0.08 }} />
              ))}
            </div>
          )}
          {variant === 2 && (
            /* مخطط مراحل */
            <div className="flex items-center gap-1.5 px-4">
              {[1, 2, 3, 4].map((n, i) => (
                <div key={n} className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
                    style={{ borderColor: b, color: b, opacity: 0.45 + i * 0.12 }}>
                    {n}
                  </div>
                  {i < 3 && <div className="w-3 h-px" style={{ background: b, opacity: 0.3 }} />}
                </div>
              ))}
            </div>
          )}
          {/* عنوان */}
          <div className="absolute bottom-3 inset-x-0 px-4">
            <div className="h-1.5 rounded-full w-1/2" style={{ background: b, opacity: 0.45 }} />
          </div>
        </div>
      );
    }

    if (kind === "arabic-lang") {
      // لغة عربية: typography واضح + خطوط نصية
      return (
        <div className="w-full h-full flex flex-col p-4 gap-2 relative overflow-hidden" dir="rtl">
          {/* زخرفة نقطية */}
          <div className="absolute top-3 left-3 w-6 h-6 rounded-full opacity-8" style={{ background: b }} />
          <div className="h-2.5 rounded w-3/4" style={{ background: b, opacity: 0.65 }} />
          <div className="h-px w-1/3 mt-0.5" style={{ background: b, opacity: 0.35 }} />
          <div className="flex-1 flex flex-col justify-center gap-1.5">
            {[0.13, 0.09, 0.11, 0.07].map((op, i) => (
              <div key={i} className="h-1 rounded-full" style={{ background: b, opacity: op, width: `${85 - i * 12}%` }} />
            ))}
          </div>
          {/* علامة تشكيل ديكورية */}
          <div className="absolute bottom-3 end-4 text-base font-black opacity-15" style={{ color: b }}>ـ</div>
        </div>
      );
    }

    if (kind === "history") {
      // تاريخ: timeline أفقي
      return (
        <div className="w-full h-full flex flex-col p-4 gap-3 relative overflow-hidden">
          <div className="h-2 rounded-full w-2/3" style={{ background: b, opacity: 0.7 }} />
          <div className="flex-1 flex items-center">
            <div className="relative flex-1">
              {/* خط الزمن */}
              <div className="absolute top-1/2 inset-x-0 h-px" style={{ background: b, opacity: 0.25 }} />
              <div className="relative flex justify-between items-center">
                {[0.5, 0.35, 0.55, 0.3, 0.45].map((op, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full border-2" style={{ borderColor: b, opacity: op, background: i === 2 ? b : "transparent" }} />
                    <div className="w-4 h-0.5 rounded" style={{ background: b, opacity: op * 0.7 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // general — نمط نظيف بدون تصميم مفرط
    return (
      <div className="w-full h-full flex flex-col p-4 gap-2.5">
        <div className="h-2 rounded-full" style={{ background: b, opacity: 0.6, width: variant === 0 ? "60%" : variant === 1 ? "75%" : "55%" }} />
        <div className="h-1.5 rounded-full w-2/5" style={{ background: b, opacity: 0.25 }} />
        <div className="flex-1 flex flex-col justify-end gap-1.5">
          {[0.09, 0.07, 0.06].map((op, i) => (
            <div key={i} className="h-1 rounded-full bg-current" style={{ opacity: op, width: `${90 - i * 15}%` }} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={editing ? undefined : onOpen}
      className="group relative flex flex-col rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5"
      style={{
        background: "var(--card)",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
        cursor: editing ? "default" : "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          `0 20px 60px rgba(0,0,0,0.1), 0 0 0 1px ${theme.bar}28`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 16px rgba(0,0,0,0.05)";
      }}
    >
      {/* ── Cover preview ────────────────────────────────── */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{ height: 160, background: theme.bg, color: theme.text }}
      >
        {/* Subject accent bar */}
        <div
          className="absolute inset-y-0 start-0 w-[3px] opacity-60"
          style={{ background: theme.bar }}
        />
        <div className="absolute inset-0">
          <SmartPreview />
        </div>

        {/* Badges */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between px-3 pt-2.5">
          {isPublished ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm"
              style={{ background: "rgba(255,255,255,0.92)", color: BRAND_GREEN }}
            >
              <Globe className="w-2.5 h-2.5" />
              {isAr ? "منشور" : "Published"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/75 text-muted-foreground">
              {isAr ? "مسودة" : "Draft"}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-black/10 text-white/90">
            {p.language === "ar" ? "AR" : "EN"}
          </span>
        </div>

        {/* Hover overlay with "Open editor" */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 bg-black/[0.07]">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white shadow-lg translate-y-1 group-hover:translate-y-0 transition-transform duration-200"
            style={{ color: theme.bar }}
          >
            <Pencil className="w-3.5 h-3.5" />
            {isAr ? "فتح المحرر" : "Open editor"}
          </span>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4">
        {/* Title + menu */}
        <div className="flex items-start gap-1.5 mb-3">
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
              className={`flex-1 text-sm font-bold text-foreground line-clamp-2 leading-snug${isOwner ? " cursor-text select-none" : ""}`}
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
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors flex-shrink-0 -mt-0.5"
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

        {/* Visible quick-action buttons */}
        {isOwner && !editing && (
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onGoLive(); }}
              disabled={goLiveLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 hover:scale-[1.04] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: `${BRAND_GOLD}1c`, color: "#b45309" }}
            >
              {goLiveLoading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Radio className="w-3.5 h-3.5" />}
              {isAr ? "مباشر" : "Go live"}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onResults(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground transition-all duration-150 hover:text-foreground hover:bg-muted hover:scale-[1.04] active:scale-[0.97]"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {isAr ? "نتائج" : "Results"}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-2.5 border-t border-border/40">
          <span className="inline-flex items-center gap-1 font-medium">
            <FileText className="w-3 h-3" />
            {p.slideCount} {isAr ? "شريحة" : "slides"}
          </span>
          <span className="inline-flex items-center gap-1 ms-auto font-medium">
            <Clock className="w-3 h-3" />
            {formatRelative(p.updatedAt, isAr)}
          </span>
          {!isOwner && p.ownerName && (
            <span className="truncate max-w-[80px] opacity-70" title={p.ownerName}>
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
