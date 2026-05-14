import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Plus, Pencil, Trash2, Image as ImageIcon, Upload, Search,
  Sparkles, ChevronLeft, X, Check, Lock, LogIn, Loader2, AlertTriangle,
  Globe, User as UserIcon, Eye, RefreshCw,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { toast } from "@/components/ui/sonner";
import {
  fetchArenaCategories, fetchArenaActivities,
  createArenaCategory, updateArenaCategory, deleteArenaCategory,
  createArenaActivity, updateArenaActivity, deleteArenaActivity,
  uploadImageFile, aiGenerateArenaQuestions,
  type DbArenaCategory, type DbArenaActivity,
} from "@/lib/arena-content";

const BRAND = { green: "#225739", gold: "#D9A521", light: "#FCFAF8" };

const SECTION_COLORS = [
  "#225739", "#1E4D35", "#0F766E", "#1E3A8A", "#6D28D9", "#9F1239",
  "#B45309", "#7C2D12", "#0c4a6e", "#365314", "#4a044e", "#831843",
];

const POINTS = [200, 200, 400, 400, 600, 600] as const;

type Difficulty = 200 | 400 | 600 | 800;

/* ─────────────────────── Image Picker Modal ─────────────────────── */

interface ImagePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
  initialQuery?: string;
}

interface SearchResult {
  url: string;
  thumbUrl: string;
  title: string;
  source: string;
}

function ArenaImagePicker({ open, onClose, onPick, initialQuery }: ImagePickerProps) {
  const [tab, setTab] = useState<"upload" | "search" | "url">("search");
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery ?? "");
      setResults([]);
      setUrlInput("");
    }
  }, [open, initialQuery]);

  const doSearch = async () => {
    const q = query.trim();
    if (!q) { toast.error("اكتب كلمة بحث"); return; }
    setSearching(true);
    try {
      const r = await fetch("/api/presentations/image-search", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q, count: 16 }),
      });
      if (!r.ok) { toast.error("فشل البحث"); setResults([]); return; }
      const data = await r.json();
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      toast.error("فشل البحث");
    } finally {
      setSearching(false);
    }
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("الملف يجب أن يكون صورة"); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error("الحد الأقصى 10 ميجابايت"); return; }
    setUploading(true);
    const url = await uploadImageFile(f);
    setUploading(false);
    if (url) {
      onPick(url);
      onClose();
      toast.success("تم رفع الصورة");
    } else {
      toast.error("فشل رفع الصورة");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white border-2 flex flex-col"
        style={{ borderColor: BRAND.green }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(34,87,57,0.15)" }}>
          <h3 className="text-lg font-extrabold" style={{ color: BRAND.green }}>
            اختيار صورة
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b" style={{ borderColor: "rgba(34,87,57,0.15)" }}>
          {[
            { id: "search" as const, label: "بحث صور", icon: <Search className="w-4 h-4" /> },
            { id: "upload" as const, label: "رفع من جهازك", icon: <Upload className="w-4 h-4" /> },
            { id: "url" as const, label: "رابط مباشر", icon: <Globe className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-2 py-3 font-bold text-sm transition-colors"
              style={{
                color: tab === t.id ? BRAND.green : "#6b7280",
                background: tab === t.id ? "rgba(34,87,57,0.08)" : "transparent",
                borderBottom: tab === t.id ? `2px solid ${BRAND.green}` : "2px solid transparent",
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "search" && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
                  placeholder="مثال: نخلة، الكعبة، أسد..."
                  className="flex-1 px-4 py-2.5 rounded-lg border-2 focus:outline-none text-sm"
                  style={{ borderColor: "rgba(34,87,57,0.25)" }}
                  dir="rtl"
                  data-testid="image-search-input"
                />
                <button
                  onClick={doSearch}
                  disabled={searching}
                  className="px-5 py-2.5 rounded-lg font-bold text-white inline-flex items-center gap-2 disabled:opacity-50"
                  style={{ background: BRAND.green }}
                  data-testid="image-search-btn"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  بحث
                </button>
              </div>
              {searching && (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
              {!searching && results.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  ابحث عن صورة لإضافتها
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {results.map((r, i) => (
                  <button
                    key={`${r.url}-${i}`}
                    onClick={() => { onPick(r.url); onClose(); }}
                    className="group relative aspect-square rounded-lg overflow-hidden border-2 hover:border-amber-400 transition-all"
                    style={{ borderColor: "rgba(34,87,57,0.15)" }}
                  >
                    <img
                      src={r.thumbUrl || r.url}
                      alt={r.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <Check className="w-8 h-8 text-white opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="text-center py-12">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                data-testid="image-upload-input"
              />
              <div
                onClick={() => fileRef.current?.click()}
                className="mx-auto max-w-md p-10 border-2 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ borderColor: "rgba(34,87,57,0.4)" }}
              >
                {uploading ? (
                  <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: BRAND.green }} />
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto mb-3" style={{ color: BRAND.green }} />
                    <p className="font-bold text-gray-800 mb-1">اضغط لاختيار صورة</p>
                    <p className="text-xs text-gray-500">PNG / JPG / WEBP — حتى 10 ميجابايت</p>
                  </>
                )}
              </div>
            </div>
          )}

          {tab === "url" && (
            <div className="space-y-4">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-2.5 rounded-lg border-2 focus:outline-none text-sm"
                style={{ borderColor: "rgba(34,87,57,0.25)" }}
                dir="ltr"
              />
              {urlInput.trim() && (
                <div className="rounded-lg overflow-hidden border" style={{ borderColor: "rgba(34,87,57,0.2)" }}>
                  <img
                    src={urlInput.trim()}
                    alt="معاينة"
                    className="w-full max-h-64 object-contain bg-gray-50"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                  />
                </div>
              )}
              <button
                onClick={() => {
                  const v = urlInput.trim();
                  if (!v) { toast.error("ألصق رابط الصورة"); return; }
                  onPick(v);
                  onClose();
                }}
                className="w-full px-5 py-2.5 rounded-lg font-bold text-white"
                style={{ background: BRAND.green }}
              >
                استخدام هذا الرابط
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────── Cover Tile ─────────────────────── */

function CoverTile({
  imageUrl, color, emoji, onClick, size = "md",
}: { imageUrl?: string | null; color?: string | null; emoji?: string; onClick?: () => void; size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "w-12 h-12" : size === "lg" ? "w-24 h-24" : "w-16 h-16";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${dim} rounded-xl overflow-hidden flex items-center justify-center text-2xl shrink-0 border-2 hover:opacity-90 transition`}
      style={{
        background: imageUrl ? "transparent" : (color || BRAND.green),
        borderColor: "rgba(0,0,0,0.1)",
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            const parent = (e.target as HTMLImageElement).parentElement;
            if (parent) parent.style.background = color || BRAND.green;
          }}
        />
      ) : (
        <span>{emoji || "🎯"}</span>
      )}
    </button>
  );
}

/* ─────────────────────── Main page ─────────────────────── */

export default function ArenaContentAdmin() {
  const [, setLocation] = useLocation();
  const { data: teacherData, isLoading: teacherLoading } =
    useGetCurrentTeacher({ query: { retry: false } as any });
  const teacherId = (teacherData as any)?.id ?? null;
  const isAdmin = !!(teacherData as any)?.isAdmin;
  const isLoggedIn = teacherLoading ? null : !!teacherData;

  const [cats, setCats] = useState<DbArenaCategory[]>([]);
  const [acts, setActs] = useState<DbArenaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [editingCat, setEditingCat] = useState<DbArenaCategory | null>(null);
  const [creatingType, setCreatingType] = useState<"section" | "sub" | null>(null);
  const [editingAct, setEditingAct] = useState<DbArenaActivity | null>(null);
  const [creatingAct, setCreatingAct] = useState<{ difficulty: Difficulty } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: "section"; id: number; name: string }
    | { kind: "sub"; id: number; name: string }
    | { kind: "act"; id: number }
    | null
  >(null);

  const reload = async () => {
    setLoading(true);
    const c = await fetchArenaCategories();
    setCats(c);
    if (c.length > 0) {
      const a = await fetchArenaActivities(c.map(x => x.id));
      setActs(a);
    } else {
      setActs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isLoggedIn) void reload();
  }, [isLoggedIn]);

  const sections = useMemo(
    () => cats.filter(c => c.parentId == null),
    [cats],
  );

  // Admins see everything; teachers see only their own private sections
  const visibleSections = isAdmin
    ? sections
    : sections.filter(c => c.teacherId === teacherId);
  const canEditCat = (c: DbArenaCategory | null | undefined) =>
    !!c && (isAdmin || c.teacherId === teacherId);

  const subsBySection = useMemo(() => {
    const map = new Map<number, DbArenaCategory[]>();
    for (const c of cats) {
      if (c.parentId != null) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return map;
  }, [cats]);

  const subs = selectedSectionId ? (subsBySection.get(selectedSectionId) ?? []) : [];
  const selectedSub = selectedSubId ? cats.find(c => c.id === selectedSubId) : null;
  const selectedSection = selectedSectionId ? cats.find(c => c.id === selectedSectionId) : null;
  const canEditSelectedSub = selectedSub && (isAdmin || selectedSub.teacherId === teacherId);

  const subActs = useMemo(
    () => selectedSubId ? acts.filter(a => a.categoryId === selectedSubId) : [],
    [acts, selectedSubId],
  );

  // Auto-pick first section once loaded
  useEffect(() => {
    if (!selectedSectionId && visibleSections.length > 0) {
      setSelectedSectionId(visibleSections[0].id);
    }
  }, [visibleSections, selectedSectionId]);

  // Clear stale sub selection if it no longer belongs to the current section
  // (covers reload, delete, and programmatic section changes after create).
  useEffect(() => {
    if (!selectedSubId) return;
    const sub = cats.find(c => c.id === selectedSubId);
    if (!sub || sub.parentId !== selectedSectionId) {
      setSelectedSubId(null);
    }
  }, [cats, selectedSectionId, selectedSubId]);

  // Auto-pick first sub when none is selected for the current section
  useEffect(() => {
    if (selectedSectionId && !selectedSubId) {
      const list = subsBySection.get(selectedSectionId) ?? [];
      if (list.length > 0) setSelectedSubId(list[0].id);
    }
  }, [selectedSectionId, selectedSubId, subsBySection]);

  if (isLoggedIn === false) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-md w-full text-center bg-white rounded-2xl border-2 p-8" style={{ borderColor: BRAND.green }}>
            <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: BRAND.green }} />
            <h1 className="text-2xl font-extrabold mb-2" style={{ color: BRAND.green }}>تسجيل الدخول مطلوب</h1>
            <p className="text-gray-600 mb-5">يجب تسجيل الدخول لإدارة محتوى تحدي حصاد.</p>
            <Link href="/login">
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white" style={{ background: BRAND.green }}>
                <LogIn className="w-4 h-4" /> تسجيل الدخول
              </button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  // Non-admins see only their own private categories — handled via filter below

  return (
    <Layout>
      <div dir="rtl" className="min-h-[calc(100vh-4rem)]" style={{ background: BRAND.light }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setLocation("/teacher")}
                className="p-2 rounded-lg hover:bg-white"
                aria-label="رجوع"
              >
                <ArrowRight className="w-5 h-5" style={{ color: BRAND.green }} />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold truncate" style={{ color: BRAND.green }}>
                  إدارة محتوى تحدي حصاد
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  {isAdmin ? "أنت مدير — تدير المحتوى العام والخاص" : "فئاتك الخاصة — محفوظة في حسابك وتظهر في لعبتك"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void reload()}
                className="p-2 rounded-lg border-2 bg-white hover:bg-gray-50"
                style={{ borderColor: "rgba(34,87,57,0.3)" }}
                title="تحديث"
              >
                <RefreshCw className="w-4 h-4" style={{ color: BRAND.green }} />
              </button>
              <Link href="/game/arena">
                <button className="px-3 py-2 rounded-lg text-sm font-bold border-2 bg-white hover:bg-gray-50 inline-flex items-center gap-1.5" style={{ borderColor: BRAND.green, color: BRAND.green }}>
                  <Eye className="w-4 h-4" /> معاينة في اللعبة
                </button>
              </Link>
            </div>
          </div>

          {/* Info banner for non-admin teachers */}
          {!isAdmin && (
            <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm" style={{ background: "#FFF9EC", borderColor: "#C9A050", color: "#7C5A0A" }}>
              <span className="text-lg shrink-0">🔒</span>
              <div>
                <p className="font-bold mb-0.5">هذه فئاتك الخاصة فقط</p>
                <p className="font-medium opacity-80">
                  يمكنك إنشاء أقسام وأسئلة خاصة بك وتبقى في حسابك — المحتوى العام لتحدي حصاد يُدار من المسؤول فقط ولا يظهر هنا.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND.green }} />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
              {/* Sections rail */}
              <aside className="lg:col-span-3 bg-white rounded-2xl border-2 p-3 lg:p-4" style={{ borderColor: "rgba(34,87,57,0.18)" }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-sm font-extrabold" style={{ color: BRAND.green }}>الأقسام</h2>
                  <button
                    onClick={() => setCreatingType("section")}
                    className="p-1.5 rounded-md text-white hover:opacity-90"
                    style={{ background: BRAND.green }}
                    title="إضافة قسم"
                    data-testid="add-section-btn"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
                  {visibleSections.length === 0 && (
                    <p className="text-xs text-gray-500 p-3 text-center">لا توجد أقسام بعد — أضف قسماً للبدء</p>
                  )}
                  {visibleSections.map(sec => {
                    const isMine = sec.teacherId === teacherId;
                    const active = sec.id === selectedSectionId;
                    return (
                      <button
                        key={sec.id}
                        onClick={() => { setSelectedSectionId(sec.id); setSelectedSubId(null); }}
                        className="w-full flex items-center gap-2 p-2 rounded-lg text-start transition-colors"
                        style={{
                          background: active ? "rgba(34,87,57,0.10)" : "transparent",
                          border: active ? `1.5px solid ${BRAND.green}` : "1.5px solid transparent",
                        }}
                        data-testid={`section-${sec.id}`}
                      >
                        <CoverTile imageUrl={sec.coverImageUrl} color={sec.coverColor} emoji={sec.emoji} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate" style={{ color: active ? BRAND.green : "#1f2937" }}>{sec.name}</div>
                          <div className="text-[10px] text-gray-500 flex items-center gap-1">
                            {sec.isPublic ? <><Globe className="w-3 h-3" />عام</> : isMine ? <><UserIcon className="w-3 h-3" />خاص</> : "—"}
                            <span>·</span>
                            <span>{(subsBySection.get(sec.id) ?? []).length} فئة</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Sub-categories grid */}
              <section className="lg:col-span-4 bg-white rounded-2xl border-2 p-3 lg:p-4" style={{ borderColor: "rgba(34,87,57,0.18)" }}>
                <div className="flex items-center justify-between mb-3 px-1 gap-2">
                  <h2 className="text-sm font-extrabold truncate" style={{ color: BRAND.green }}>
                    {selectedSection ? `فئات: ${selectedSection.name}` : "الفئات الفرعية"}
                  </h2>
                  <div className="flex items-center gap-1">
                    {selectedSection && (isAdmin || selectedSection.teacherId === teacherId) && (
                      <>
                        <button
                          onClick={() => setEditingCat(selectedSection)}
                          className="p-1.5 rounded-md border hover:bg-gray-50"
                          style={{ borderColor: "rgba(34,87,57,0.3)" }}
                          title="تعديل القسم"
                        >
                          <Pencil className="w-4 h-4" style={{ color: BRAND.green }} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ kind: "section", id: selectedSection.id, name: selectedSection.name })}
                          className="p-1.5 rounded-md border hover:bg-red-50"
                          style={{ borderColor: "rgba(220,38,38,0.3)" }}
                          title="حذف القسم"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                        <button
                          onClick={() => setCreatingType("sub")}
                          className="p-1.5 rounded-md text-white hover:opacity-90"
                          style={{ background: BRAND.green }}
                          title="إضافة فئة"
                          data-testid="add-sub-btn"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
                  {!selectedSection && (
                    <p className="text-xs text-gray-500 p-3 text-center">اختر قسماً من اليمين</p>
                  )}
                  {selectedSection && subs.length === 0 && (
                    <p className="text-xs text-gray-500 p-3 text-center">لا توجد فئات في هذا القسم</p>
                  )}
                  {subs.map(sub => {
                    const active = sub.id === selectedSubId;
                    const count = acts.filter(a => a.categoryId === sub.id).length;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedSubId(sub.id)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg text-start transition-colors"
                        style={{
                          background: active ? "rgba(34,87,57,0.10)" : "transparent",
                          border: active ? `1.5px solid ${BRAND.green}` : "1.5px solid transparent",
                        }}
                        data-testid={`sub-${sub.id}`}
                      >
                        <CoverTile imageUrl={sub.coverImageUrl} color={sub.coverColor} emoji={sub.emoji} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate" style={{ color: active ? BRAND.green : "#1f2937" }}>{sub.name}</div>
                          <div className="text-[10px] text-gray-500">
                            {count} سؤال
                            {count < 6 && <span className="text-amber-600 font-bold"> · ينقص {6 - count}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Question editor pane */}
              <section className="lg:col-span-5 bg-white rounded-2xl border-2 p-3 lg:p-4" style={{ borderColor: "rgba(34,87,57,0.18)" }}>
                {!selectedSub ? (
                  <div className="text-center py-12 text-gray-500 text-sm">
                    اختر فئة لتحرير أسئلتها
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3 px-1">
                      <div className="min-w-0">
                        <h2 className="text-sm font-extrabold truncate" style={{ color: BRAND.green }}>
                          أسئلة: {selectedSub.name}
                        </h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          الإعداد المثالي: 200×2 · 400×2 · 600×2 = 6 أسئلة
                        </p>
                      </div>
                      {canEditSelectedSub && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setEditingCat(selectedSub)}
                            className="p-1.5 rounded-md border hover:bg-gray-50"
                            style={{ borderColor: "rgba(34,87,57,0.3)" }}
                            title="تعديل الفئة"
                          >
                            <Pencil className="w-4 h-4" style={{ color: BRAND.green }} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ kind: "sub", id: selectedSub.id, name: selectedSub.name })}
                            className="p-1.5 rounded-md border hover:bg-red-50"
                            style={{ borderColor: "rgba(220,38,38,0.3)" }}
                            title="حذف الفئة"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                          <button
                            onClick={() => setAiOpen(true)}
                            className="px-3 py-1.5 rounded-md text-xs font-extrabold text-white inline-flex items-center gap-1 shadow"
                            style={{ background: `linear-gradient(135deg, ${BRAND.gold}, #B8860B)` }}
                            data-testid="ai-generate-btn"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> توليد بالذكاء
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Slot grid */}
                    <div className="space-y-2 max-h-[60vh] lg:max-h-[68vh] overflow-y-auto pr-1">
                      {POINTS.map((pt, idx) => {
                        const matching = subActs.filter(a => a.difficulty === pt);
                        const slotIdx = idx % 2;
                        const act = matching[slotIdx];
                        return (
                          <QuestionSlot
                            key={`${pt}-${idx}`}
                            points={pt}
                            act={act}
                            canEdit={!!canEditSelectedSub}
                            onAdd={() => setCreatingAct({ difficulty: pt })}
                            onEdit={() => act && setEditingAct(act)}
                            onDelete={() => act && setConfirmDelete({ kind: "act", id: act.id })}
                          />
                        );
                      })}

                      {/* Extra activities not fitting the standard 2/2/2 layout */}
                      {(() => {
                        const slotted = new Set<number>();
                        let cursor = { 200: 0, 400: 0, 600: 0, 800: 0 } as Record<number, number>;
                        for (const pt of POINTS) {
                          const m = subActs.filter(a => a.difficulty === pt);
                          if (m[cursor[pt]]) {
                            slotted.add(m[cursor[pt]].id);
                            cursor[pt]++;
                          }
                        }
                        const extras = subActs.filter(a => !slotted.has(a.id));
                        if (extras.length === 0) return null;
                        return (
                          <div className="pt-3 mt-3 border-t" style={{ borderColor: "rgba(34,87,57,0.15)" }}>
                            <div className="text-[11px] font-bold text-gray-500 mb-1.5 px-1">أسئلة إضافية</div>
                            {extras.map(act => (
                              <QuestionSlot
                                key={act.id}
                                points={act.difficulty as Difficulty}
                                act={act}
                                canEdit={!!canEditSelectedSub}
                                onAdd={() => {}}
                                onEdit={() => setEditingAct(act)}
                                onDelete={() => setConfirmDelete({ kind: "act", id: act.id })}
                              />
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Section / sub editor modal */}
      <AnimatePresence>
        {(editingCat || creatingType) && (
          <CategoryEditor
            initial={editingCat}
            mode={editingCat ? "edit" : (creatingType === "section" ? "new-section" : "new-sub")}
            parentId={creatingType === "sub" ? selectedSectionId : null}
            isAdmin={isAdmin}
            onClose={() => { setEditingCat(null); setCreatingType(null); }}
            onSaved={async (saved) => {
              setEditingCat(null);
              setCreatingType(null);
              await reload();
              if (saved && saved.parentId == null) setSelectedSectionId(saved.id);
              if (saved && saved.parentId != null) setSelectedSubId(saved.id);
            }}
          />
        )}
      </AnimatePresence>

      {/* Activity editor modal */}
      <AnimatePresence>
        {(editingAct || creatingAct) && selectedSub && (
          <ActivityEditor
            initial={editingAct}
            categoryId={selectedSub.id}
            initialDifficulty={creatingAct?.difficulty ?? 200}
            onClose={() => { setEditingAct(null); setCreatingAct(null); }}
            onSaved={async () => {
              setEditingAct(null);
              setCreatingAct(null);
              await reload();
            }}
          />
        )}
      </AnimatePresence>

      {/* AI generate modal */}
      <AnimatePresence>
        {aiOpen && selectedSub && (
          <AiGenerateModal
            categoryId={selectedSub.id}
            categoryName={selectedSub.name}
            onClose={() => setAiOpen(false)}
            onSaved={async () => { setAiOpen(false); await reload(); }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDelete && (
          <ConfirmDeleteModal
            target={confirmDelete}
            childCount={confirmDelete.kind === "section" ? (subsBySection.get(confirmDelete.id) ?? []).length : 0}
            onClose={() => setConfirmDelete(null)}
            onConfirm={async () => {
              if (confirmDelete.kind === "act") {
                const ok = await deleteArenaActivity(confirmDelete.id);
                if (ok) { toast.success("تم الحذف"); await reload(); } else toast.error("فشل الحذف");
              } else {
                const ok = await deleteArenaCategory(confirmDelete.id);
                if (ok) {
                  toast.success("تم الحذف");
                  if (confirmDelete.kind === "section") {
                    setSelectedSectionId(null);
                    setSelectedSubId(null);
                  } else if (confirmDelete.kind === "sub") {
                    setSelectedSubId(null);
                  }
                  await reload();
                } else toast.error("فشل الحذف");
              }
              setConfirmDelete(null);
            }}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

/* ─────────────────────── Question slot row ─────────────────────── */

function QuestionSlot({
  points, act, canEdit, onAdd, onEdit, onDelete,
}: {
  points: Difficulty;
  act?: DbArenaActivity;
  canEdit: boolean;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ptColor =
    points === 200 ? "#3b82f6" :
    points === 400 ? "#8b5cf6" :
    points === 600 ? "#ef4444" : "#f59e0b";

  if (!act) {
    return (
      <div
        className="flex items-center gap-2 p-2.5 rounded-lg border-2 border-dashed"
        style={{ borderColor: `${ptColor}55` }}
      >
        <span
          className="w-12 h-9 rounded-md text-white font-extrabold text-xs flex items-center justify-center shrink-0"
          style={{ background: ptColor }}
        >
          {points}
        </span>
        <span className="flex-1 text-xs text-gray-400 italic">سؤال فارغ</span>
        {canEdit && (
          <button
            onClick={onAdd}
            className="px-2.5 py-1 rounded-md text-xs font-bold text-white inline-flex items-center gap-1"
            style={{ background: BRAND.green }}
          >
            <Plus className="w-3 h-3" /> إضافة
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2 p-2.5 rounded-lg border bg-white hover:shadow-sm transition"
      style={{ borderColor: "rgba(34,87,57,0.2)" }}
      data-testid={`q-slot-${act.id}`}
    >
      <span
        className="w-12 h-9 rounded-md text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: ptColor }}
      >
        {points}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-gray-800 line-clamp-2">{act.question}</div>
        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
          الإجابة: <span className="font-bold text-gray-700">{act.answer}</span>
          {act.imageUrl && <span className="ms-2 inline-flex items-center gap-0.5 text-emerald-700"><ImageIcon className="w-3 h-3" />صورة</span>}
        </div>
      </div>
      {act.imageUrl && (
        <img
          src={act.imageUrl}
          alt=""
          className="w-12 h-12 object-cover rounded shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      {canEdit && (
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded border hover:bg-gray-50"
            style={{ borderColor: "rgba(34,87,57,0.25)" }}
            title="تعديل"
          >
            <Pencil className="w-3.5 h-3.5" style={{ color: BRAND.green }} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded border hover:bg-red-50"
            style={{ borderColor: "rgba(220,38,38,0.25)" }}
            title="حذف"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Category editor modal ─────────────────────── */

function CategoryEditor({
  initial, mode, parentId, isAdmin, onClose, onSaved,
}: {
  initial: DbArenaCategory | null;
  mode: "edit" | "new-section" | "new-sub";
  parentId: number | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (saved: DbArenaCategory | null) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🎯");
  const [coverColor, setCoverColor] = useState(initial?.coverColor ?? BRAND.green);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initial?.coverImageUrl ?? null);
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const titleAr = mode === "edit"
    ? (initial?.parentId == null ? "تعديل القسم" : "تعديل الفئة")
    : (mode === "new-section" ? "قسم جديد" : "فئة جديدة");

  const save = async () => {
    if (!name.trim()) { toast.error("اكتب الاسم"); return; }
    setSaving(true);
    const payload: Partial<DbArenaCategory> = {
      name: name.trim(),
      emoji,
      coverColor,
      coverImageUrl: coverImageUrl || null,
      isPublic,
      parentId: mode === "new-sub" ? parentId : (initial?.parentId ?? null),
    };
    const res = initial
      ? await updateArenaCategory(initial.id, payload)
      : await createArenaCategory(payload);
    setSaving(false);
    if (res) {
      toast.success("تم الحفظ");
      onSaved(res);
    } else {
      toast.error("فشل الحفظ");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg bg-white rounded-2xl border-2 p-6 max-h-[90vh] overflow-y-auto"
        style={{ borderColor: BRAND.green }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold" style={{ color: BRAND.green }}>{titleAr}</h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">الاسم</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-2 focus:outline-none text-sm"
              style={{ borderColor: "rgba(34,87,57,0.3)" }}
              dir="rtl"
              data-testid="cat-name-input"
            />
          </div>

          <div className="flex items-start gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">الغلاف</label>
              <CoverTile imageUrl={coverImageUrl} color={coverColor} emoji={emoji} onClick={() => setPicker(true)} size="lg" />
              <button onClick={() => setPicker(true)} className="text-[11px] mt-1 underline" style={{ color: BRAND.green }}>
                {coverImageUrl ? "تغيير الصورة" : "اختر صورة"}
              </button>
              {coverImageUrl && (
                <button onClick={() => setCoverImageUrl(null)} className="text-[11px] mt-1 underline text-red-600 ms-2">
                  إزالة
                </button>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-700 block mb-1.5">رمز تعبيري</label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                className="w-20 px-3 py-2 rounded-lg border-2 text-2xl text-center"
                style={{ borderColor: "rgba(34,87,57,0.3)" }}
              />
              <label className="text-xs font-bold text-gray-700 block mt-3 mb-1.5">اللون</label>
              <div className="flex flex-wrap gap-1.5">
                {SECTION_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCoverColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c,
                      borderColor: coverColor === c ? "#000" : "transparent",
                      boxShadow: coverColor === c ? "0 0 0 2px white inset" : undefined,
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </div>

          {isAdmin && (
            <label className="flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer" style={{ borderColor: "rgba(217,165,33,0.4)", background: "rgba(217,165,33,0.05)" }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-4 h-4"
              />
              <Globe className="w-4 h-4" style={{ color: BRAND.gold }} />
              <span className="text-sm font-bold">محتوى عام (يراه جميع المعلمين)</span>
            </label>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg font-bold border-2 hover:bg-gray-50"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
            >
              إلغاء
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: BRAND.green }}
              data-testid="save-cat-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              حفظ
            </button>
          </div>
        </div>

        <ArenaImagePicker
          open={picker}
          onClose={() => setPicker(false)}
          onPick={(url) => setCoverImageUrl(url)}
          initialQuery={name}
        />
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────── Activity editor modal ─────────────────────── */

function ActivityEditor({
  initial, categoryId, initialDifficulty, onClose, onSaved,
}: {
  initial: DbArenaActivity | null;
  categoryId: number;
  initialDifficulty: Difficulty;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? initialDifficulty);
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const isImage = !!imageUrl;

  const save = async () => {
    if (!question.trim()) { toast.error("اكتب نص السؤال"); return; }
    if (!answer.trim()) { toast.error("اكتب الإجابة"); return; }
    setSaving(true);
    const payload: Partial<DbArenaActivity> = {
      categoryId,
      question: question.trim(),
      answer: answer.trim(),
      hint: hint.trim() || null,
      difficulty,
      imageUrl: imageUrl || null,
      type: isImage ? "image" : "text",
    };
    const res = initial
      ? await updateArenaActivity(initial.id, payload)
      : await createArenaActivity(payload, "manual");
    setSaving(false);
    if (res) {
      toast.success("تم الحفظ");
      onSaved();
    } else {
      toast.error("فشل الحفظ");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-xl bg-white rounded-2xl border-2 p-6 max-h-[90vh] overflow-y-auto"
        style={{ borderColor: BRAND.green }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold" style={{ color: BRAND.green }}>
            {initial ? "تعديل السؤال" : "سؤال جديد"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">النقاط</label>
            <div className="flex gap-2">
              {([200, 400, 600, 800] as Difficulty[]).map(d => {
                const c = d === 200 ? "#3b82f6" : d === 400 ? "#8b5cf6" : d === 600 ? "#ef4444" : "#f59e0b";
                const sel = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className="px-4 py-2 rounded-lg font-extrabold border-2 text-sm transition-all"
                    style={{
                      background: sel ? c : "white",
                      color: sel ? "white" : c,
                      borderColor: c,
                    }}
                    data-testid={`diff-${d}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">السؤال</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border-2 text-sm focus:outline-none"
              style={{ borderColor: "rgba(34,87,57,0.3)" }}
              dir="rtl"
              data-testid="q-input"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">الإجابة الصحيحة</label>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-2 text-sm focus:outline-none"
              style={{ borderColor: "rgba(34,87,57,0.3)" }}
              dir="rtl"
              data-testid="a-input"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">تلميح (اختياري)</label>
            <input
              type="text"
              value={hint ?? ""}
              onChange={(e) => setHint(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border-2 text-sm focus:outline-none"
              style={{ borderColor: "rgba(34,87,57,0.3)" }}
              dir="rtl"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">صورة (اختياري)</label>
            <div className="flex items-start gap-3">
              {imageUrl ? (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt=""
                    className="w-28 h-28 object-cover rounded-lg border-2"
                    style={{ borderColor: "rgba(34,87,57,0.2)" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                  />
                  <button
                    onClick={() => setImageUrl(null)}
                    className="absolute -top-2 -end-2 bg-red-500 text-white rounded-full p-1"
                    aria-label="إزالة الصورة"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setPicker(true)}
                  className="w-28 h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-xs gap-1 hover:bg-gray-50"
                  style={{ borderColor: "rgba(34,87,57,0.4)", color: BRAND.green }}
                  data-testid="add-image-btn"
                >
                  <ImageIcon className="w-6 h-6" />
                  أضف صورة
                </button>
              )}
              {imageUrl && (
                <button
                  onClick={() => setPicker(true)}
                  className="px-3 py-2 rounded-md text-xs font-bold border-2 hover:bg-gray-50"
                  style={{ borderColor: BRAND.green, color: BRAND.green }}
                >
                  تغيير
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg font-bold border-2 hover:bg-gray-50"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
            >
              إلغاء
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: BRAND.green }}
              data-testid="save-act-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              حفظ
            </button>
          </div>
        </div>

        <ArenaImagePicker
          open={picker}
          onClose={() => setPicker(false)}
          onPick={(url) => setImageUrl(url)}
          initialQuery={question || answer}
        />
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────── AI generate modal ─────────────────────── */

function AiGenerateModal({
  categoryId, categoryName, onClose, onSaved,
}: {
  categoryId: number;
  categoryName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [topic, setTopic] = useState(categoryName);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<Array<{ q: string; a: string; difficulty: Difficulty; hint?: string | null; selected: boolean }>>([]);

  const generate = async () => {
    if (!topic.trim()) { toast.error("اكتب الموضوع"); return; }
    setGenerating(true);
    const r = await aiGenerateArenaQuestions({
      topic: topic.trim(),
      count: 6,
      includeBonus800: false,
      language: "ar",
      notes: notes.trim() || undefined,
    });
    setGenerating(false);
    if (r.error || r.questions.length === 0) {
      toast.error(r.error || "فشل التوليد");
      return;
    }
    setGenerated(r.questions.map(q => ({ ...q, selected: true })));
  };

  const saveSelected = async () => {
    const sel = generated.filter(g => g.selected);
    if (sel.length === 0) { toast.error("اختر سؤالاً واحداً على الأقل"); return; }
    setSaving(true);
    let saved = 0;
    for (const g of sel) {
      const r = await createArenaActivity({
        categoryId,
        question: g.q,
        answer: g.a,
        hint: g.hint ?? null,
        difficulty: g.difficulty,
        type: "text",
      }, "ai");
      if (r) saved++;
    }
    setSaving(false);
    toast.success(`تم حفظ ${saved} سؤال`);
    onSaved();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl bg-white rounded-2xl border-2 p-6 max-h-[90vh] overflow-y-auto"
        style={{ borderColor: BRAND.gold }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold inline-flex items-center gap-2" style={{ color: BRAND.gold }}>
            <Sparkles className="w-5 h-5" /> توليد 6 أسئلة بالذكاء الاصطناعي
          </h3>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        {generated.length === 0 ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">الموضوع</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-2 text-sm focus:outline-none"
                style={{ borderColor: "rgba(217,165,33,0.5)" }}
                dir="rtl"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">ملاحظات (اختياري)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="مثال: تركّز على المرحلة الابتدائية"
                className="w-full px-3 py-2 rounded-lg border-2 text-sm focus:outline-none"
                style={{ borderColor: "rgba(217,165,33,0.5)" }}
                dir="rtl"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg font-bold border-2"
                style={{ borderColor: "rgba(0,0,0,0.15)" }}
              >
                إلغاء
              </button>
              <button
                onClick={generate}
                disabled={generating}
                className="flex-1 px-4 py-2.5 rounded-lg font-extrabold text-white inline-flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${BRAND.gold}, #B8860B)` }}
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                توليد
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 mb-2">راجع الأسئلة وحدد ما تريد حفظه:</p>
            {generated.map((g, i) => {
              const c = g.difficulty === 200 ? "#3b82f6" : g.difficulty === 400 ? "#8b5cf6" : g.difficulty === 600 ? "#ef4444" : "#f59e0b";
              return (
                <label
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50"
                  style={{ borderColor: g.selected ? BRAND.green : "rgba(0,0,0,0.1)", background: g.selected ? "rgba(34,87,57,0.04)" : "white" }}
                >
                  <input
                    type="checkbox"
                    checked={g.selected}
                    onChange={(e) => setGenerated(prev => prev.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                    className="mt-1"
                  />
                  <span className="px-2 py-0.5 rounded text-white text-xs font-extrabold shrink-0" style={{ background: c }}>{g.difficulty}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800">{g.q}</div>
                    <div className="text-xs text-gray-600 mt-0.5">الإجابة: <span className="font-bold">{g.a}</span></div>
                    {g.hint && <div className="text-[11px] text-gray-500 mt-0.5">تلميح: {g.hint}</div>}
                  </div>
                </label>
              );
            })}
            <div className="flex gap-2 pt-3">
              <button
                onClick={() => setGenerated([])}
                className="px-4 py-2.5 rounded-lg font-bold border-2"
                style={{ borderColor: "rgba(0,0,0,0.15)" }}
              >
                توليد مرة أخرى
              </button>
              <button
                onClick={saveSelected}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: BRAND.green }}
                data-testid="ai-save-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                حفظ المحدد ({generated.filter(g => g.selected).length})
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────── Confirm delete modal ─────────────────────── */

function ConfirmDeleteModal({
  target, childCount, onClose, onConfirm,
}: {
  target: { kind: "section" | "sub" | "act"; id: number; name?: string };
  childCount: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const label = target.kind === "section" ? `قسم "${target.name}"` :
                target.kind === "sub" ? `فئة "${target.name}"` : "هذا السؤال";
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md bg-white rounded-2xl border-2 p-6"
        style={{ borderColor: "#dc2626" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600 shrink-0" />
          <div>
            <h3 className="text-lg font-extrabold text-red-700">تأكيد الحذف</h3>
            <p className="text-sm text-gray-700 mt-1">سيتم حذف {label} نهائياً.</p>
            {target.kind === "section" && childCount > 0 && (
              <p className="text-xs text-red-700 mt-2 font-bold">
                ⚠️ سيتم حذف {childCount} فئة فرعية وكل أسئلتها أيضاً
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-lg font-bold border-2"
            style={{ borderColor: "rgba(0,0,0,0.15)" }}
          >
            إلغاء
          </button>
          <button
            onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
            disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            data-testid="confirm-delete-btn"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            حذف نهائي
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
