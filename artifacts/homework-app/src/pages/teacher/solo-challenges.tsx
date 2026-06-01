/**
 * /teacher/solo-challenges
 * لوحة تحكم وميض حر — تعرض كل مسابقات المعلم
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Zap, Plus, Copy, Share2, Settings, Trash2, Users, Clock,
  CheckCircle, XCircle, Trophy, BarChart2, ChevronLeft, ExternalLink,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_URL || "";

interface SoloChallengeRow {
  id: number;
  slug: string;
  shortSlug: string | null;
  assignmentId: number | null;
  assignmentTitle: string;
  notes: string | null;
  expiresAt: string | null;
  timePerQuestion: number | null;
  leaderboardDisplay: string | null;
  playCount: number;
  createdAt: string;
  isStandalone: boolean;
  isExpired: boolean;
}

export default function SoloChallengesPage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: authLoading } = useGetCurrentTeacher({ query: { retry: false } as any });
  const [challenges, setChallenges] = useState<SoloChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { setLocation("/login"); return; }
    if (!user) return;
    fetch(`${API}/api/solo-challenges`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setChallenges(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/solo/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("تم نسخ الرابط");
  };

  const shareWhatsApp = (slug: string, title: string) => {
    const url = `${window.location.origin}/solo/${slug}`;
    const text = `🎯 شاركوا في مسابقة "${title}" وتنافسوا على المراكز الأولى!\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const deleteChallenge = async (slug: string, title: string) => {
    if (!confirm(`هل تريد حذف مسابقة "${title}"؟ سيُحذف تاريخ اللاعبين أيضاً.`)) return;
    const res = await fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setChallenges(prev => prev.filter(c => c.slug !== slug));
      toast.success("تم حذف المسابقة");
    } else {
      toast.error("فشل الحذف");
    }
  };

  const totalPlays = challenges.reduce((s, c) => s + c.playCount, 0);
  const active = challenges.filter(c => !c.isExpired).length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border/60 bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher" className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-lg font-black text-foreground">وميض حر</h1>
                <p className="text-xs text-muted-foreground">مسابقات مفتوحة بدون جلسة</p>
              </div>
            </div>
          </div>
          <Link
            href="/teacher/solo-challenges/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            مسابقة جديدة
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Explainer card */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/40 p-4 flex gap-4 items-start">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <Zap className="w-5 h-5 text-amber-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-sm font-black text-amber-800 dark:text-amber-300">ما هو وميض حر؟</h2>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              مسابقة أسئلة تُنشئها مرة واحدة وتُرسل رابطها للطلاب — يلعبون بشكل فردي في أي وقت يناسبهم، دون الحاجة لجلسة مباشرة.
              كل طالب يجيب على الأسئلة بمفرده وفق مؤقت لكل سؤال، وتُجمع النتائج تلقائياً في قائمة متصدرين يمكنك مراجعتها.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
              {[
                { icon: Clock, text: "مؤقت لكل سؤال" },
                { icon: Trophy, text: "قائمة متصدرين" },
                { icon: Users, text: "لعب فردي مستقل" },
                { icon: Share2, text: "رابط قابل للمشاركة" },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Icon className="w-3 h-3" />
                  {text}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        {challenges.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "المسابقات", value: challenges.length, icon: Zap, color: "text-amber-500 bg-amber-500/10" },
              { label: "نشطة", value: active, icon: CheckCircle, color: "text-green-600 bg-green-500/10" },
              { label: "إجمالي اللاعبين", value: totalPlays, icon: Users, color: "text-blue-600 bg-blue-500/10" },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border/60 rounded-2xl p-4 text-center">
                <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-2`}>
                  <s.icon className="w-4.5 h-4.5" />
                </div>
                <p className="text-2xl font-black text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Challenges list */}
        {challenges.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">لا توجد مسابقات بعد</h2>
            <p className="text-muted-foreground text-sm mb-6">أنشئ مسابقتك الأولى من واجب موجود أو بأسئلة جديدة بمساعدة الذكاء الاصطناعي</p>
            <Link
              href="/teacher/solo-challenges/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              إنشاء مسابقة جديدة
            </Link>
          </motion.div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {challenges.map((ch, i) => (
              <motion.div
                key={ch.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-amber-500/30 transition-colors group"
              >
                {/* Card header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ch.isExpired
                            ? "bg-red-500/10 text-red-500"
                            : "bg-green-500/10 text-green-600"
                        }`}>
                          {ch.isExpired ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                          {ch.isExpired ? "منتهية" : "نشطة"}
                        </span>
                        {ch.isStandalone && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600">
                            <Zap className="w-3 h-3" />
                            مستقلة
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">
                        {ch.assignmentTitle}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {ch.playCount} لاعب
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {ch.timePerQuestion ?? 20}ث/سؤال
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      {ch.leaderboardDisplay === "top3" ? "أفضل 3" : ch.leaderboardDisplay === "all" ? "الكل" : "أفضل 20"}
                    </span>
                  </div>

                  {ch.expiresAt && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      ينتهي: {new Date(ch.expiresAt).toLocaleDateString("ar-SA")}
                    </p>
                  )}
                </div>

                {/* Card actions */}
                <div className="border-t border-border/40 px-3 py-2.5 flex items-center gap-1.5 bg-muted/20">
                  <Link
                    href={`/teacher/solo-challenges/${ch.slug}`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/15 text-primary transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    إدارة
                  </Link>
                  <button
                    onClick={() => copyLink(ch.slug)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="نسخ الرابط"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => shareWhatsApp(ch.slug, ch.assignmentTitle)}
                    className="p-2 rounded-lg hover:bg-green-500/10 transition-colors text-muted-foreground hover:text-green-600"
                    title="مشاركة واتساب"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <a
                    href={`/solo/${ch.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="فتح رابط اللعبة"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => deleteChallenge(ch.slug, ch.assignmentTitle)}
                    className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
