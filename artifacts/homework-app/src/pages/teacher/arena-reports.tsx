import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2, XCircle,
  Trash2, Edit3, Clock, Inbox, Filter, RefreshCw, Loader2, User,
  ShieldCheck,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import {
  fetchArenaReports,
  updateArenaReport,
  deleteArenaReport,
  type ArenaQuestionReport,
} from "@/lib/arena-content";

type StatusFilter = "open" | "resolved" | "dismissed" | "all";

const STATUS_META: Record<"open" | "resolved" | "dismissed", { label: string; color: string; bg: string; border: string }> = {
  open:      { label: "قيد المراجعة", color: "#a07f37", bg: "rgba(201,161,75,0.12)",  border: "rgba(201,161,75,0.35)" },
  resolved:  { label: "تم الحل",     color: "#1f4d4f", bg: "rgba(31,77,79,0.10)",   border: "rgba(31,77,79,0.30)" },
  dismissed: { label: "مرفوض",       color: "#5b6b87", bg: "rgba(91,107,135,0.10)", border: "rgba(91,107,135,0.30)" },
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function ArenaReportsPage() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;
  const [, setLocation] = useLocation();

  const { data: teacherData, isLoading: teacherLoading } =
    useGetCurrentTeacher({ query: { retry: false } as any });
  const isAdmin = !!(teacherData as any)?.isAdmin;

  const [filter, setFilter] = useState<StatusFilter>("open");
  const [reports, setReports] = useState<ArenaQuestionReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const list = await fetchArenaReports(filter === "all" ? undefined : filter);
    setReports(list);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, isAdmin]);

  const counts = useMemo(() => {
    const c = { open: 0, resolved: 0, dismissed: 0 };
    for (const r of reports) c[r.status]++;
    return c;
  }, [reports]);

  if (!teacherLoading && !isAdmin) {
    return (
      <Layout>
        <div dir={dir} className="min-h-screen flex items-center justify-center p-6" style={{ background: "#faf6ec" }}>
          <div className="max-w-md w-full p-8 rounded-3xl text-center" style={{ background: "#ffffff", border: "1px solid #ebe2cd", boxShadow: "0 8px 24px -8px rgba(31,77,79,0.15)" }}>
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: "rgba(160,127,55,0.12)" }}>
              <ShieldCheck className="w-8 h-8" style={{ color: "#a07f37" }} />
            </div>
            <h2 className="text-xl font-black mb-2" style={{ color: "#1f4d4f" }}>هذه الصفحة للمسؤولين فقط</h2>
            <p className="text-sm mb-5" style={{ color: "#5b6b87" }}>
              صفحة بلاغات الأسئلة متاحة لمسؤولي المنصّة فقط.
            </p>
            <Link href="/teacher" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm" style={{ background: "#1f4d4f", color: "#fff" }}>
              <BackIcon className="w-4 h-4" />
              العودة
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  const setStatus = async (id: number, status: "open" | "resolved" | "dismissed") => {
    setPendingId(id);
    const updated = await updateArenaReport(id, { status });
    setPendingId(null);
    if (!updated) { toast.error("تعذّر التحديث"); return; }
    toast.success(status === "resolved" ? "تم وضعها كمحلولة" : status === "dismissed" ? "تم تجاهل البلاغ" : "أُعيد فتح البلاغ");
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm("حذف البلاغ نهائياً؟")) return;
    setPendingId(id);
    const ok = await deleteArenaReport(id);
    setPendingId(null);
    if (!ok) { toast.error("تعذّر الحذف"); return; }
    toast.success("تم الحذف");
    await load();
  };

  return (
    <Layout>
      <div dir={dir} className="min-h-screen pb-20" style={{ background: "#faf6ec" }}>
        {/* Header */}
        <div className="sticky top-0 z-20" style={{ background: "rgba(250,246,236,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #ebe2cd" }}>
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocation("/teacher/games")}
                className="p-2 rounded-xl"
                style={{ background: "#ffffff", border: "1px solid #ebe2cd", color: "#1f4d4f" }}
                aria-label="رجوع"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={{ rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #c9a14b, #a07f37)",
                    boxShadow: "0 8px 20px -6px rgba(201,161,75,0.55)",
                  }}
                >
                  <Inbox className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-lg sm:text-xl font-black" style={{ color: "#1f4d4f" }}>
                    بلاغات أسئلة تحدّي حصاد
                  </h1>
                  <p className="text-[11px] sm:text-xs font-bold" style={{ color: "#5b6b87" }}>
                    راجع شكاوى الأسئلة وحدّد الإجراء المناسب
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50"
              style={{ background: "#ffffff", border: "1px solid #ebe2cd", color: "#1f4d4f" }}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              تحديث
            </button>
          </div>

          {/* Filter tabs */}
          <div className="max-w-5xl mx-auto px-4 pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Filter className="w-4 h-4 shrink-0" style={{ color: "#5b6b87" }} />
              {([
                { id: "open" as const, label: "قيد المراجعة", count: counts.open },
                { id: "resolved" as const, label: "محلولة",     count: counts.resolved },
                { id: "dismissed" as const, label: "مرفوضة",   count: counts.dismissed },
                { id: "all" as const, label: "الكل",           count: undefined },
              ]).map(t => {
                const active = filter === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setFilter(t.id)}
                    className="px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all"
                    style={active
                      ? { background: "#1f4d4f", color: "#fff", boxShadow: "0 4px 12px -4px rgba(31,77,79,0.4)" }
                      : { background: "#ffffff", color: "#1f4d4f", border: "1px solid #ebe2cd" }
                    }
                  >
                    {t.label}
                    {t.count !== undefined && (
                      <span className="ms-1.5 px-1.5 rounded-full text-[10px]" style={{ background: active ? "rgba(255,255,255,0.2)" : "#faf6ec" }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="max-w-5xl mx-auto px-4 pt-5 space-y-3">
          {loading && reports.length === 0 ? (
            <div className="text-center py-16" style={{ color: "#5b6b87" }}>
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <span className="text-sm font-bold">جارٍ التحميل...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 rounded-3xl" style={{ background: "#ffffff", border: "1px dashed #ebe2cd" }}>
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: "rgba(45,94,63,0.10)" }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: "#2d5e3f" }} />
              </div>
              <div className="text-base font-black" style={{ color: "#1f4d4f" }}>لا توجد بلاغات</div>
              <div className="text-xs font-bold mt-1" style={{ color: "#5b6b87" }}>كل شيء على ما يرام في هذا التصنيف</div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {reports.map((r) => {
                const meta = STATUS_META[r.status];
                const editLink = r.categoryId ? `/teacher/games?openArenaCategory=${r.categoryId}` : null;
                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 240, damping: 26 }}
                    className="rounded-2xl overflow-hidden relative"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #ebe2cd",
                      boxShadow: "0 4px 14px -6px rgba(31,77,79,0.14)",
                    }}
                  >
                    {/* Top accent bar */}
                    <div className="h-1" style={{ background: meta.color }} />

                    <div className="p-4 sm:p-5">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black inline-flex items-center gap-1.5"
                            style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                            <AlertTriangle className="w-3 h-3" />
                            {meta.label}
                          </span>
                          {r.difficulty != null && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black" style={{ background: "#faf6ec", color: "#a07f37", border: "1px solid #ebe2cd" }}>
                              {r.difficulty} نقطة
                            </span>
                          )}
                          {r.questionType && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "#faf6ec", color: "#5b6b87", border: "1px solid #ebe2cd" }}>
                              {r.questionType}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color: "#5b6b87" }}>
                          <Clock className="w-3 h-3" />
                          {formatDate(r.createdAt)}
                        </div>
                      </div>

                      {/* Question + answers */}
                      <div className="rounded-xl p-3 mb-3" style={{ background: "#faf6ec", border: "1px solid #ebe2cd" }}>
                        <div className="text-[10px] font-black mb-1" style={{ color: "#a07f37" }}>السؤال</div>
                        <div className="text-sm font-bold mb-3 leading-relaxed" style={{ color: "#1f2937" }}>{r.questionText}</div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <div className="text-[10px] font-black mb-1" style={{ color: "#1f4d4f" }}>الإجابة الحالية</div>
                            <div className="text-sm font-bold leading-relaxed" style={{ color: "#1f4d4f" }}>{r.currentAnswer}</div>
                          </div>
                          {r.suggestedAnswer && (
                            <div className="rounded-lg p-2" style={{ background: "rgba(201,161,75,0.10)", border: "1px dashed rgba(201,161,75,0.4)" }}>
                              <div className="text-[10px] font-black mb-1" style={{ color: "#a07f37" }}>الإجابة الصحيحة المقترحة</div>
                              <div className="text-sm font-bold leading-relaxed" style={{ color: "#a07f37" }}>{r.suggestedAnswer}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Note */}
                      <div className="mb-3">
                        <div className="text-[10px] font-black mb-1" style={{ color: "#5b6b87" }}>ملاحظة المُبلِّغ</div>
                        <div className="text-sm leading-relaxed" style={{ color: "#1f2937" }}>{r.note}</div>
                      </div>

                      {/* Reporter */}
                      <div className="flex items-center justify-between gap-3 flex-wrap text-[11px]" style={{ color: "#5b6b87" }}>
                        <span className="inline-flex items-center gap-1 font-bold">
                          <User className="w-3 h-3" />
                          {r.reporterName ?? (r.reporterTeacherId ? `معلّم #${r.reporterTeacherId}` : "زائر")}
                        </span>
                        {r.categoryId && (
                          <span className="font-bold">فئة #{r.categoryId}</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 pt-3 flex flex-wrap gap-2 items-center" style={{ borderTop: "1px solid #ebe2cd" }}>
                        {editLink && (
                          <Link
                            href={editLink}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold"
                            style={{ background: "#1f4d4f", color: "#fff" }}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            تعديل الفئة
                          </Link>
                        )}
                        {r.status !== "resolved" && (
                          <button
                            onClick={() => void setStatus(r.id, "resolved")}
                            disabled={pendingId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold disabled:opacity-50"
                            style={{ background: "linear-gradient(135deg, #2d5e3f, #1f4d4f)", color: "#fff", boxShadow: "0 4px 12px -4px rgba(45,94,63,0.4)" }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            تم الحل
                          </button>
                        )}
                        {r.status !== "dismissed" && (
                          <button
                            onClick={() => void setStatus(r.id, "dismissed")}
                            disabled={pendingId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold disabled:opacity-50"
                            style={{ background: "#faf6ec", color: "#5b6b87", border: "1px solid #ebe2cd" }}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            تجاهل
                          </button>
                        )}
                        {r.status !== "open" && (
                          <button
                            onClick={() => void setStatus(r.id, "open")}
                            disabled={pendingId === r.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold disabled:opacity-50"
                            style={{ background: "#faf6ec", color: "#a07f37", border: "1px solid rgba(201,161,75,0.4)" }}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            إعادة فتح
                          </button>
                        )}
                        <button
                          onClick={() => void remove(r.id)}
                          disabled={pendingId === r.id}
                          className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold disabled:opacity-50"
                          style={{ background: "rgba(220,38,38,0.08)", color: "#b91c1c", border: "1px solid rgba(220,38,38,0.25)" }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          حذف
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </Layout>
  );
}
