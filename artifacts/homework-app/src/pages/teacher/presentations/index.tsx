import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  Play,
  Pencil,
  Copy,
  Trash2,
  Loader2,
  Presentation as PresIcon,
  Clock,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { platformHarvestBg } from "@/lib/platform-harvest-bg";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Pres = {
  id: number;
  title: string;
  subject: string | null;
  gradeLevel: string | null;
  theme: string;
  coverEmoji: string | null;
  description: string | null;
  slideCount: number;
  lastPresentedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const THEMES: Record<string, string> = {
  ocean: "from-sky-500 via-blue-600 to-indigo-600",
  sunset: "from-amber-400 via-orange-500 to-rose-500",
  midnight: "from-slate-700 via-indigo-900 to-purple-900",
  rose: "from-rose-400 via-pink-500 to-fuchsia-600",
};

export default function PresentationsListPage() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<Pres[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/presentations`, { credentials: "include" });
      if (r.status === 401) {
        setLocation("/login");
        return;
      }
      if (!r.ok) throw new Error();
      const data = await r.json();
      setItems(data.presentations || []);
    } catch {
      toast.error(lang === "ar" ? "تعذّر تحميل العروض" : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDuplicate = async (id: number) => {
    setBusy(id);
    try {
      const r = await fetch(`${API_BASE}/api/presentations/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      toast.success(lang === "ar" ? "تم النسخ" : "Duplicated");
      load();
    } catch {
      toast.error(lang === "ar" ? "فشل النسخ" : "Duplicate failed");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm(lang === "ar" ? "هل أنت متأكد من حذف هذا العرض؟" : "Delete this presentation?")) return;
    setBusy(id);
    try {
      const r = await fetch(`${API_BASE}/api/presentations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error();
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch {
      toast.error(lang === "ar" ? "فشل الحذف" : "Delete failed");
    } finally {
      setBusy(null);
    }
  };

  const formatRelative = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days === 0) return lang === "ar" ? "اليوم" : "Today";
    if (days === 1) return lang === "ar" ? "أمس" : "Yesterday";
    if (days < 7) return lang === "ar" ? `قبل ${days} أيام` : `${days}d ago`;
    return d.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US");
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Hero header — هوية المنصة (أخضر + ذهبي + أبيض) كلوحة التحكم */}
        <div
          className="relative overflow-hidden rounded-2xl px-4 sm:px-5 py-3 sm:py-4 mb-6 sm:mb-8 shadow-md"
          style={{ background: platformHarvestBg(lang === "ar") }}
        >
          <div className="absolute -top-10 -end-10 w-40 h-40 rounded-full bg-white/12 blur-2xl pointer-events-none" />
          <div
            className="absolute -bottom-10 -end-10 w-48 h-48 rounded-full blur-2xl pointer-events-none"
            style={{ backgroundColor: "rgba(212, 175, 55, 0.35)" }}
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 relative z-[1] [text-shadow:0_1px_3px_rgba(0,0,0,0.45)]">
              <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-white text-[10px] sm:text-xs font-bold mb-2 ring-1 ring-white/25">
                <Sparkles className="w-2.5 h-2.5" />
                {lang === "ar" ? "جديد · ذكاء اصطناعي" : "New · AI"}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight mb-1">
                {lang === "ar" ? "العروض التفاعلية" : "Interactive Presentations"}
              </h1>
              <p className="text-white/85 text-xs sm:text-sm max-w-xl leading-relaxed line-clamp-3">
                {lang === "ar"
                  ? "أنشئ عروض درسية كاملة بالذكاء الاصطناعي مع أنشطة وألعاب حصاد التفاعلية في ثوانٍ."
                  : "Generate complete lesson decks with AI, packed with Hasad's interactive games and activities."}
              </p>
            </div>
            <Link href="/teacher/presentations/new" className="shrink-0 self-start sm:self-center">
              <button
                type="button"
                className="inline-flex items-center gap-2 bg-white text-[#1f5a3e] hover:bg-amber-50 px-3.5 py-2 rounded-lg text-sm font-bold shadow-md shadow-black/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {lang === "ar" ? "إنشاء عرض جديد" : "Create New"}
              </button>
            </Link>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-card border border-dashed border-border rounded-3xl">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-xl font-bold mb-2">
              {lang === "ar" ? "لا توجد عروض بعد" : "No presentations yet"}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {lang === "ar"
                ? "ابدأ بإنشاء عرضك الأول — اكتب عنوان الدرس والذكاء الاصطناعي يتولى الباقي."
                : "Create your first deck — enter a lesson title and AI does the rest."}
            </p>
            <Link href="/teacher/presentations/new">
              <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:opacity-90">
                <Sparkles className="w-4 h-4" />
                {lang === "ar" ? "أنشئ عرضك الأول" : "Create your first"}
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((p) => {
              const themeKey =
                typeof p.theme === "string" && p.theme.trim() ? p.theme.trim() : "harvest";
              const gradClass = THEMES[themeKey];
              const useHarvestBg = themeKey === "harvest" || !gradClass;
              return (
                <div
                  key={p.id}
                  className="group bg-card rounded-2xl border border-border overflow-hidden hover:shadow-2xl hover:border-primary/40 transition-all hover:-translate-y-1"
                >
                  <Link href={`/teacher/presentations/${p.id}`}>
                    <div
                      className={cn(
                        "relative h-36 cursor-pointer overflow-hidden",
                        !useHarvestBg && gradClass && `bg-gradient-to-br ${gradClass}`,
                      )}
                      style={
                        useHarvestBg
                          ? { background: platformHarvestBg(lang === "ar") }
                          : undefined
                      }
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-6xl drop-shadow-lg">
                        {p.coverEmoji || "📚"}
                      </div>
                      <div className="absolute top-2 end-2 bg-black/30 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {p.slideCount} {lang === "ar" ? "شريحة" : "slides"}
                      </div>
                    </div>
                  </Link>
                  <div className="p-4">
                    <Link href={`/teacher/presentations/${p.id}`}>
                      <h3 className="font-bold text-base line-clamp-1 group-hover:text-primary cursor-pointer mb-1" title={p.title}>
                        {p.title}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
                      {p.subject && <span className="bg-muted px-2 py-0.5 rounded">{p.subject}</span>}
                      {p.gradeLevel && <span className="bg-muted px-2 py-0.5 rounded">{p.gradeLevel}</span>}
                      <span className="inline-flex items-center gap-1 ms-auto">
                        <Clock className="w-3 h-3" />
                        {formatRelative(p.updatedAt)}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <Link href={`/teacher/presentations/${p.id}/present`} className="flex-1">
                        <button className="w-full inline-flex items-center justify-center gap-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold hover:opacity-90">
                          <Play className="w-3.5 h-3.5" />
                          {lang === "ar" ? "عرض" : "Present"}
                        </button>
                      </Link>
                      <Link href={`/teacher/presentations/${p.id}`}>
                        <button title={lang === "ar" ? "تعديل" : "Edit"} className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </Link>
                      <button
                        onClick={() => onDuplicate(p.id)}
                        disabled={busy === p.id}
                        title={lang === "ar" ? "نسخ" : "Duplicate"}
                        className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground disabled:opacity-50"
                      >
                        {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onDelete(p.id)}
                        disabled={busy === p.id}
                        title={lang === "ar" ? "حذف" : "Delete"}
                        className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/60 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help footer */}
        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <PresIcon className="w-4 h-4" />
          {lang === "ar"
            ? "كل عرض تنشئه يحفظ تلقائياً ويمكنك العودة إليه في أي وقت."
            : "Every deck saves automatically and can be reopened any time."}
        </div>
      </div>
    </Layout>
  );
}
