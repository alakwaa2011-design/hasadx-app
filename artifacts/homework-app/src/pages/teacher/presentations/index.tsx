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

// ألوان accent هادئة — لا تسيطر على البطاقة، تُستخدم كشريط جانبي فقط
const SLIDE_ACCENTS = [
  { bar: "#225739", bg: "#f0faf4", text: "#1a4730" },
  { bar: "#1e40af", bg: "#eff6ff", text: "#1e3a8a" },
  { bar: "#7c3aed", bg: "#f5f3ff", text: "#4c1d95" },
  { bar: "#0f766e", bg: "#f0fdfa", text: "#134e4a" },
  { bar: "#b45309", bg: "#fffbeb", text: "#92400e" },
  { bar: "#be185d", bg: "#fdf2f8", text: "#831843" },
];

function getSlideAccent(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return SLIDE_ACCENTS[h % SLIDE_ACCENTS.length];
}

// أنماط pseudo-preview مختلفة حسب hash — تمنع التكرار البصري
function getSlideLayout(title: string): 0 | 1 | 2 | 3 {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 17 + title.charCodeAt(i)) >>> 0;
  return (h % 4) as 0 | 1 | 2 | 3;
}

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
        {/* Header — معلوماتي فقط، بدون أزرار إجراء */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${BRAND_GREEN}10`, color: BRAND_GREEN }}
            >
              <Monitor className="w-4.5 h-4.5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground leading-tight flex items-center gap-2 flex-wrap">
                {isAr ? "العروض التفاعلية" : "Interactive Presentations"}
                {showLock && tier && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{ color: BRAND_GREEN, borderColor: `${BRAND_GOLD}80`, background: `${BRAND_GOLD}10` }}
                    title={isAr
                      ? `الباقة المجانية — حتى ${tier.limits.maxSlidesRegular} شريحة و${tier.limits.maxImagesRegular} صورة لكل عرض`
                      : `Free tier — up to ${tier.limits.maxSlidesRegular} slides and ${tier.limits.maxImagesRegular} images per deck`}
                  >
                    <Lock className="w-2.5 h-2.5" />
                    {isAr ? "مجاني" : "Free"}
                  </span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {!isLoading && (
                  <>
                    <span className="font-semibold text-foreground">{counts.recent}</span>
                    {" "}{isAr ? `عرض · ${counts.published} منشور · ${counts.drafts} مسودة` : `deck${counts.recent !== 1 ? "s" : ""} · ${counts.published} published · ${counts.drafts} draft${counts.drafts !== 1 ? "s" : ""}`}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ── ابدأ بسرعة ─────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-muted-foreground mb-3 tracking-wide">
            {isAr ? "ابدأ بسرعة" : "Quick start"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* عرض جديد */}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-start transition-all hover:border-[#225739]/40 hover:bg-[#225739]/[0.03] hover:shadow-sm active:scale-[0.99]"
            >
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
                style={{ background: `${BRAND_GREEN}12`, color: BRAND_GREEN }}
              >
                <Plus className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">
                  {isAr ? "عرض جديد" : "New deck"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {isAr ? "ابنِ شرائحك يدوياً من الصفر" : "Build slides manually from scratch"}
                </p>
              </div>
            </button>

            {/* توليد بالذكاء */}
            <button
              type="button"
              onClick={() => setLocation("/teacher/presentations/new")}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-start transition-all hover:border-amber-400/50 hover:bg-amber-50/40 hover:shadow-sm active:scale-[0.99]"
            >
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
                style={{ background: `${BRAND_GOLD}18`, color: "#a16207" }}
              >
                <Sparkles className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">
                  {isAr ? "توليد بالذكاء" : "AI Generate"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {isAr ? "الذكاء يبني الحصة كاملةً تلقائياً" : "AI builds a complete lesson for you"}
                </p>
              </div>
            </button>

            {/* استيراد ملف */}
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-start transition-all hover:border-blue-400/40 hover:bg-blue-50/40 hover:shadow-sm active:scale-[0.99]"
            >
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-blue-600 bg-blue-50 transition-all group-hover:scale-105">
                <Upload className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight">
                  {isAr ? "استيراد ملف" : "Import file"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {isAr ? "PDF، Word، PPTX، أو صور" : "PDF, Word, PPTX, or images"}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Sticky mobile CTA */}
        <div className="sm:hidden fixed bottom-4 inset-x-4 z-40 flex gap-2">
          <Button
            onClick={() => setShowImport(true)}
            variant="outline"
            className="gap-2 font-bold shadow-xl py-6 bg-background"
          >
            <Upload className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setLocation("/teacher/presentations/new")}
            variant="outline"
            className="gap-2 font-bold shadow-xl py-6 bg-background border-2"
            style={{ borderColor: BRAND_GREEN, color: BRAND_GREEN }}
          >
            <Sparkles className="w-5 h-5" />
            <span className="sr-only">{isAr ? "توليد بالذكاء" : "AI Generate"}</span>
          </Button>
          <Button
            onClick={() => setShowCreate(true)}
            className="flex-1 gap-2 font-bold shadow-xl py-6"
            style={{ background: BRAND_GREEN, color: "white" }}
          >
            <Plus className="w-5 h-5" />
            {isAr ? "عرض جديد" : "New presentation"}
          </Button>
        </div>

        {/* Tabs + search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/40 border border-border w-full sm:w-fit overflow-x-auto">
            {(
              [
                { id: "recent", label: isAr ? "الأحدث" : "Recent", icon: Clock },
                { id: "published", label: isAr ? "المنشورة" : "Published", icon: CheckCircle2 },
                { id: "drafts", label: isAr ? "المسودات" : "Drafts", icon: FileText },
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
                      ? "bg-white shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={active ? { color: BRAND_GREEN } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                  <span className="text-[10px] font-bold opacity-70">
                    {counts[t.id]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              style={{ [isAr ? "right" : "left"]: 12 } as React.CSSProperties}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث عن عرض..." : "Search presentations..."}
              className={`${isAr ? "pr-9" : "pl-9"} rounded-2xl bg-card`}
            />
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-3xl border border-border bg-card animate-pulse" />
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
  const accent = getSlideAccent(p.title);
  const layout = getSlideLayout(p.title);
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

  // محاكاة شريحة حقيقية — أربعة أنماط مختلفة
  const SlidePreview = () => {
    const base = "w-full h-full flex flex-col";
    if (layout === 0) {
      // نمط: عنوان + خطوط محتوى
      return (
        <div className={`${base} p-5 gap-3`}>
          <div className="h-2 rounded-full w-3/4" style={{ background: accent.bar, opacity: 0.85 }} />
          <div className="h-1.5 rounded-full w-1/2 bg-current opacity-15" />
          <div className="flex-1 flex flex-col justify-end gap-1.5">
            <div className="h-1 rounded-full w-full bg-current opacity-10" />
            <div className="h-1 rounded-full w-5/6 bg-current opacity-10" />
            <div className="h-1 rounded-full w-4/6 bg-current opacity-10" />
          </div>
        </div>
      );
    }
    if (layout === 1) {
      // نمط: شريط جانبي + محتوى
      return (
        <div className={`${base} flex-row p-0`}>
          <div className="w-1.5 rounded-e-none" style={{ background: accent.bar }} />
          <div className="flex-1 p-4 flex flex-col gap-2.5">
            <div className="h-2 rounded-full w-2/3" style={{ background: accent.bar, opacity: 0.7 }} />
            <div className="h-1 rounded-full w-1/2 bg-current opacity-12" />
            <div className="flex-1 grid grid-cols-2 gap-1.5 mt-1">
              {[0.15, 0.1, 0.12, 0.08].map((op, i) => (
                <div key={i} className="rounded bg-current" style={{ opacity: op }} />
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (layout === 2) {
      // نمط: محتوى + صورة مستطيلة (placeholder)
      return (
        <div className={`${base} p-4 gap-2`}>
          <div className="h-2 rounded-full w-3/5" style={{ background: accent.bar, opacity: 0.8 }} />
          <div className="flex-1 flex gap-3 mt-1">
            <div className="flex-1 flex flex-col gap-1.5 justify-center">
              <div className="h-1 rounded-full w-full bg-current opacity-12" />
              <div className="h-1 rounded-full w-5/6 bg-current opacity-10" />
              <div className="h-1 rounded-full w-4/6 bg-current opacity-10" />
            </div>
            <div className="w-12 rounded-lg" style={{ background: accent.bar, opacity: 0.18 }} />
          </div>
        </div>
      );
    }
    // layout === 3: عنوان مركزي كبير
    return (
      <div className={`${base} items-center justify-center p-5 gap-2`}>
        <div className="h-2.5 rounded-full w-2/3" style={{ background: accent.bar, opacity: 0.8 }} />
        <div className="h-1.5 rounded-full w-2/5 bg-current opacity-12" />
        <div className="h-px w-10 rounded-full mt-1" style={{ background: accent.bar, opacity: 0.35 }} />
      </div>
    );
  };

  return (
    <div
      onClick={editing ? undefined : onOpen}
      className="group relative flex flex-col rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:shadow-black/8 hover:-translate-y-px hover:border-border"
      style={{ cursor: editing ? "default" : "pointer" }}
    >
      {/* ── Slide pseudo-preview ──────────────────────────── */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{ height: 128, background: accent.bg, color: accent.text }}
      >
        {/* نسبة عرض الشريحة 16:9 */}
        <div className="absolute inset-0">
          <SlidePreview />
        </div>

        {/* شريط علوي شفاف مع badges */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-2.5 pb-1">
          {/* حالة النشر */}
          {isPublished ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80 backdrop-blur-sm shadow-sm"
              style={{ color: BRAND_GREEN }}
            >
              <Globe className="w-2.5 h-2.5" />
              {isAr ? "منشور" : "Published"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/70 text-muted-foreground backdrop-blur-sm">
              {isAr ? "مسودة" : "Draft"}
            </span>
          )}
          {/* لغة العرض */}
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/60 text-muted-foreground backdrop-blur-sm">
            {p.language === "ar" ? "AR" : "EN"}
          </span>
        </div>

        {/* زر فتح يظهر عند hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/8">
          <span
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white shadow-md text-foreground"
            style={{ color: accent.text }}
          >
            <Pencil className="w-3 h-3" />
            {isAr ? "فتح المحرر" : "Open editor"}
          </span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 px-3.5 pt-3 pb-3">
        {/* العنوان + قائمة الإجراءات */}
        <div className="flex items-start gap-1.5 mb-2.5">
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
              className="flex-1 text-sm font-bold text-foreground bg-muted/50 border border-border rounded-lg px-2.5 py-1 outline-none min-w-0"
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
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors flex-shrink-0 -mt-0.5"
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

        {/* ── Footer: المعلومات ────────────────────────────── */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-1 border-t border-border/50">
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {p.slideCount} {isAr ? "شريحة" : "slides"}
          </span>
          <span className="inline-flex items-center gap-1 ms-auto">
            <Clock className="w-3 h-3" />
            {formatRelative(p.updatedAt, isAr)}
          </span>
          {!isOwner && p.ownerName && (
            <span className="truncate max-w-[80px]" title={p.ownerName}>
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
      <div className="text-center py-16 px-6 rounded-3xl border border-border/70 bg-card text-muted-foreground">
        <Search className="w-10 h-10 mx-auto mb-3 opacity-35" />
        <p className="text-sm font-medium">
          {isAr ? "لا توجد نتائج مطابقة" : "No matching results"}
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
    <div className="text-center py-16 px-6 rounded-3xl border border-dashed border-border bg-card">
      <div
        className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center"
        style={{ background: `${BRAND_GREEN}15`, color: BRAND_GREEN }}
      >
        <Sparkles className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-black text-foreground mb-2">
        {isAr ? "ابدأ هنا" : "Get started"}
      </h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">{msg}</p>
      <Button
        onClick={onCreate}
        className="gap-2 font-bold rounded-2xl"
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
