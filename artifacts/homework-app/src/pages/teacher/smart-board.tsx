import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  Plus, BookOpen, Trash2, PlayCircle, Clock,
  Monitor, GraduationCap, PenLine, MonitorPlay, Edit3, Loader2, Sparkles
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface Lesson {
  id: number;
  topic: string;
  subject?: string;
  grade_level?: string;
  level?: string;
  language: string;
  created_at: string;
}

function formatDate(dateStr: string, lang: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "ar" ? "ar-SA" : "en", { year: "numeric", month: "short", day: "numeric" });
}

function SubjectBadge({ subject }: { subject?: string }) {
  if (!subject) return null;
  return (
    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg px-2.5 py-1 text-[10px] font-black shrink-0">
      {subject}
    </span>
  );
}

export default function SmartBoardPage() {
  const { lang } = useI18n();
  const [, navigate] = useLocation();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/whiteboard/lessons`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setLessons(d.lessons ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function deleteLesson(id: number) {
    if (!confirm(lang === "ar" ? "حذف هذا الدرس نهائياً؟" : "Delete this lesson permanently?")) return;
    setDeleting(id);
    try {
      await fetch(`${API_BASE}/api/whiteboard/lessons/${id}`, { method: "DELETE", credentials: "include" });
      setLessons(prev => prev.filter(l => l.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Layout>
      <div className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] font-display pb-24" dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
          
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Monitor className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-black text-2xl sm:text-3xl text-slate-800 dark:text-slate-100 leading-tight">السبورة الذكية</h1>
                <p className="text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                  أنشئ درسًا، راجع الخطوات، واعرضه على السبورة أمام طلابك
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/teacher/smart-board/new")}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-2xl shadow-md shadow-emerald-600/10 hover:-translate-y-0.5 transition-all w-full sm:w-auto"
            >
              <Plus size={18} />
              <span>درس جديد</span>
            </button>
          </header>

          {/* Main Content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 text-emerald-600/50">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <p className="font-bold text-sm">جارٍ التحميل…</p>
            </div>
          ) : lessons.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 px-6 bg-white dark:bg-[#15201B] border border-dashed border-emerald-200 dark:border-emerald-800/50 rounded-[2rem] shadow-sm mb-12"
            >
              <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <MonitorPlay className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-3">لا توجد دروس محفوظة بعد</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
                اكتب موضوع درس وسيُنشئ الذكاء الاصطناعي خطة شرح كاملة لعرضها على السبورة ومناقشتها مع الطلاب.
              </p>
              <button
                onClick={() => navigate("/teacher/smart-board/new")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-emerald-600/20 hover:-translate-y-1 transition-all"
              >
                ابدأ درسك الأول
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-4 mb-12">
              {lessons.map((lesson, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  key={lesson.id}
                  className="group bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-5 shadow-sm hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-800/60 transition-all"
                >
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center shrink-0">
                    <BookOpen size={22} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 truncate">{lesson.topic}</h3>
                      <SubjectBadge subject={lesson.subject} />
                      {lesson.grade_level && (
                        <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg px-2.5 py-1 text-[10px] font-black shrink-0">
                          {lesson.grade_level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-emerald-500" />
                        <span>{formatDate(lesson.created_at, lang)}</span>
                      </div>
                      {lesson.level && (
                        <div className="flex items-center gap-1.5 before:content-['•'] before:text-slate-300 dark:before:text-slate-600 before:me-2">
                          <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md text-[10px]">
                            {{ brief: "موجز", standard: "عادي", detailed: "تفصيلي" }[lesson.level as string] ?? lesson.level}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 mt-3 sm:mt-0">
                    <button
                      onClick={() => navigate(`/teacher/smart-board/present/${lesson.id}`)}
                      title="عرض الدرس"
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 text-xs font-black transition-colors"
                    >
                      <PlayCircle size={16} />
                      <span>عرض</span>
                    </button>
                    <button
                      onClick={() => navigate(`/teacher/smart-board/edit/${lesson.id}`)}
                      title="تعديل الدرس"
                      className="flex items-center gap-2 bg-[#f4f7f5] hover:bg-emerald-50 dark:bg-[#0B100E] dark:hover:bg-emerald-900/30 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 border border-slate-200 hover:border-emerald-200 dark:border-slate-800 dark:hover:border-emerald-800 rounded-xl px-4 py-2.5 text-xs font-black transition-colors"
                    >
                      <GraduationCap size={16} />
                      <span className="hidden sm:inline">تعديل</span>
                    </button>
                    <button
                      onClick={() => deleteLesson(lesson.id)}
                      disabled={deleting === lesson.id}
                      title="حذف"
                      className="flex items-center justify-center w-10 h-10 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {deleting === lesson.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* How it works */}
          {lessons.length === 0 && (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-100 dark:via-emerald-900/50 to-transparent" />
                <h3 className="text-sm font-black text-slate-400 dark:text-slate-500 px-2">كيف تعمل السبورة الذكية؟</h3>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-100 dark:via-emerald-900/50 to-transparent" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: <PenLine size={24} className="text-emerald-500" />, title: "اكتب موضوع الدرس", desc: "حدد المادة والصف وعمق الشرح" },
                  { icon: <Sparkles size={24} className="text-emerald-500" />, title: "يُنشئ الذكاء الاصطناعي", desc: "خطة درس كاملة بخطوات وشرح صوتي" },
                  { icon: <Edit3 size={24} className="text-emerald-500" />, title: "راجع وعدّل", desc: "تحكم في كل خطوة قبل البدء" },
                  { icon: <MonitorPlay size={24} className="text-emerald-500" />, title: "اعرض على الفصل", desc: "كتابة تدريجية مع إمكانية الرسم" },
                ].map((item, i) => (
                  <div key={i} className="bg-white dark:bg-[#15201B] border border-emerald-50 dark:border-emerald-900/30 rounded-3xl p-5 text-center shadow-sm">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      {item.icon}
                    </div>
                    <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 mb-2">{item.title}</h4>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
