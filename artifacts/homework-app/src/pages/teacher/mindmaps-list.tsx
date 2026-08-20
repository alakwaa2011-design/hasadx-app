import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { Loader2, Plus, Brain, Trash2, ArrowRight, ArrowLeft, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface MindMapSummary {
  id: number;
  title: string;
  topic: string;
  language: string;
  depth: string;
  createdAt: string;
}

export default function MindMapsList() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const [, setLocation] = useLocation();

  const [maps, setMaps] = useState<MindMapSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchMaps();
  }, []);

  const fetchMaps = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`${API_BASE}/api/mindmaps`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setMaps(data);
    } catch {
      setLoadError(true);
      toast.error(isAr ? "تعذّر تحميل الخرائط المحفوظة" : "Failed to load saved maps");
    } finally {
      setLoading(false);
    }
  };

  const deleteMap = async (id: number) => {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذه الخريطة؟" : "Are you sure you want to delete this map?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/mindmaps/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setMaps((prev) => prev.filter((m) => m.id !== id));
      toast.success(isAr ? "تم حذف الخريطة بنجاح" : "Map deleted successfully");
    } catch (e) {
      toast.error(isAr ? "تعذّر حذف الخريطة" : "Failed to delete map");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Layout>
      <div dir={isAr ? "rtl" : "ltr"} className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] pb-32 font-display">
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
          <button
            type="button"
            onClick={() => setLocation("/teacher")}
            className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
            aria-label={isAr ? "رجوع" : "Back"}
            data-testid="btn-back"
          >
            {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                {isAr ? "مكتبة الخرائط الذهنية" : "Mind Maps Library"}
              </h1>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                {isAr ? "استعرض الخرائط الذهنية التي قمت بتوليدها مسبقاً" : "Browse your previously generated mind maps"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setLocation("/teacher/mindmap/create")}
            data-testid="btn-new-map"
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl shadow-md shadow-emerald-600/10 hover:-translate-y-0.5 transition-all text-xs sm:text-sm"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">{isAr ? "خريطة جديدة" : "New Map"}</span>
          </button>
        </header>

        <main className="max-w-5xl mx-auto px-4 pt-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-emerald-600/50" data-testid="loading-indicator">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <p className="font-bold text-sm">{isAr ? "جارٍ التحميل…" : "Loading…"}</p>
            </div>
          ) : loadError ? (
            <div
              data-testid="mindmaps-error-state"
              className="text-center py-20 px-6 bg-white dark:bg-[#15201B] border border-red-100 dark:border-red-900/40 rounded-[2rem] shadow-sm"
            >
              <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-3">
                {isAr ? "تعذّر تحميل الخرائط" : "Could not load maps"}
              </h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-7">
                {isAr ? "تحقق من اتصالك ثم أعد المحاولة." : "Check your connection, then try again."}
              </p>
              <button
                type="button"
                onClick={fetchMaps}
                data-testid="button-retry-mindmaps-load"
                className="inline-flex items-center gap-2 bg-[#225739] hover:bg-[#183e29] text-white font-black px-6 py-3 rounded-xl transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {isAr ? "إعادة المحاولة" : "Try again"}
              </button>
            </div>
          ) : maps.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              data-testid="empty-state"
              className="text-center py-20 px-6 bg-white dark:bg-[#15201B] border border-dashed border-emerald-200 dark:border-emerald-800/50 rounded-[2rem] shadow-sm mb-12"
            >
              <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Brain className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">{isAr ? "لا توجد خرائط محفوظة بعد" : "No saved maps yet"}</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                {isAr ? "قم بتوليد خريطتك الذهنية الأولى باستخدام الذكاء الاصطناعي وسيتم حفظها هنا تلقائياً." : "Generate your first mind map using AI and it will be saved here automatically."}
              </p>
              <button
                onClick={() => setLocation("/teacher/mindmap/create")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-emerald-600/20 hover:-translate-y-1 transition-all"
              >
                {isAr ? "ابدأ التوليد الآن" : "Start Generating"}
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="maps-grid">
              <AnimatePresence>
                {maps.map((map) => (
                  <motion.div
                    key={map.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 rounded-3xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-800/60 transition-all cursor-pointer relative overflow-hidden"
                    onClick={() => setLocation(`/teacher/mindmaps/${map.id}`)}
                    data-testid={`map-card-${map.id}`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100/50 to-transparent dark:from-emerald-900/20 rounded-bl-[100px] pointer-events-none" />
                    
                    <div className="flex items-start justify-between gap-3 relative">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/40 rounded-2xl flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                        <Brain size={24} />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMap(map.id);
                        }}
                        disabled={deletingId === map.id}
                        className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 flex items-center justify-center transition-colors disabled:opacity-50"
                        title={isAr ? "حذف" : "Delete"}
                        data-testid={`btn-delete-${map.id}`}
                      >
                        {deletingId === map.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>

                    <div className="flex-1 min-w-0 mt-2 relative">
                      <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 truncate mb-1" title={map.title}>
                        {map.title}
                      </h3>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed" title={map.topic}>
                        {map.topic}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400 dark:text-slate-500 pt-3 border-t border-slate-100 dark:border-slate-800/60 mt-2 relative">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        <span>{formatDate(map.createdAt)}</span>
                      </div>
                      <div className="flex-1" />
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
                        <span>{isAr ? "عرض" : "Open"}</span>
                        <ExternalLink size={14} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
