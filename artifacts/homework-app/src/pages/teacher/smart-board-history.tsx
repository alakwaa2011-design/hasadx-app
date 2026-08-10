import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  MessageSquare, Trash2, PlayCircle, Clock, Sparkles, ArrowRight, ArrowLeft, Loader2
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface QEntry {
  id: number;
  topic: string;
  created_at: string;
}

function formatDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SmartBoardHistory() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [entries, setEntries] = useState<QEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/whiteboard/lessons?type=ask`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setEntries(d.lessons ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function replayEntry(id: number) {
    setReplaying(id);
    try {
      const res = await fetch(`${API_BASE}/api/whiteboard/lessons/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const plan = data.lesson?.plan ?? data.lesson;
      sessionStorage.setItem("whiteboard_ask_plan", JSON.stringify(plan));
      navigate("/teacher/smart-board/present/ask");
    } catch {
      alert("تعذّر تحميل السؤال — حاول مجدداً");
    } finally {
      setReplaying(null);
    }
  }

  async function deleteEntry(id: number) {
    if (!confirm(lang === "ar" ? "حذف هذا السؤال نهائياً؟" : "Delete permanently?")) return;
    setDeleting(id);
    try {
      await fetch(`${API_BASE}/api/whiteboard/lessons/${id}`, { method: "DELETE", credentials: "include" });
      setEntries(prev => prev.filter(e => e.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Layout>
      <div className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] font-display pb-24" dir={lang === "ar" ? "rtl" : "ltr"}>
        
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
          <button
            onClick={() => navigate("/teacher/smart-board")}
            className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
            title="رجوع"
          >
            {lang === "ar" ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                سجل أسئلة السبورة الذكية
              </h1>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                أسئلة طُرحت سابقاً — اضغط "اعرض مجدداً" لفتحها على السبورة فوراً
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-emerald-600/50">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <p className="font-bold text-sm">جارٍ التحميل…</p>
            </div>
          ) : entries.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 px-6 bg-white dark:bg-[#15201B] border border-dashed border-emerald-200 dark:border-emerald-800/50 rounded-[2rem] shadow-sm mb-12"
            >
              <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">لا توجد أسئلة مسجّلة بعد</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                كل سؤال تطرحه على السبورة الذكية يُحفظ هنا تلقائياً لتعود إليه لاحقاً
              </p>
              <button
                onClick={() => navigate("/teacher/smart-board/ask")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-emerald-600/20 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mx-auto"
              >
                <Sparkles size={18} />
                اطرح سؤالاً الآن
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-4 mb-12">
              {entries.map((entry, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  key={entry.id}
                  className="group bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-5 shadow-sm hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-800/60 transition-all"
                >
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center shrink-0">
                    <MessageSquare size={22} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 truncate mb-1.5">{entry.topic}</h3>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <Clock size={14} className="text-amber-500" />
                      <span>{formatDate(entry.created_at, lang)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 mt-3 sm:mt-0">
                    <button
                      onClick={() => replayEntry(entry.id)}
                      disabled={replaying === entry.id}
                      title="اعرض مجدداً"
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 text-xs font-black transition-colors"
                    >
                      {replaying === entry.id ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                      <span>اعرض مجدداً</span>
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      disabled={deleting === entry.id}
                      title="حذف"
                      className="flex items-center justify-center w-10 h-10 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {deleting === entry.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
