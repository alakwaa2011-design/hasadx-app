/**
 * /teacher/solo-challenges
 * لوحة تحكم مسابقة ذاتية — تعرض كل مسابقات المعلم
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Copy, Share2, Settings, Trash2, Users, Clock,
  CheckCircle, XCircle, Trophy, ChevronLeft, ExternalLink, Activity
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");

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
    const text = `شاركوا في مسابقة "${title}" وتنافسوا على المراكز الأولى!\n${url}`;
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
  const activeCount = challenges.filter(c => !c.isExpired).length;
  const expiredCount = challenges.length - activeCount;

  const filtered = challenges.filter(c => {
    if (filter === "active") return !c.isExpired;
    if (filter === "expired") return c.isExpired;
    return true;
  });

  const tabCounts = { all: challenges.length, active: activeCount, expired: expiredCount };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── Header ── */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={user?.role === "organizer" ? "/organizer" : "/teacher"} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground group">
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-black text-foreground tracking-tight">المسابقات الذاتية</h1>
                <p className="text-xs text-muted-foreground font-medium">مسابقات مفتوحة للتدريب الفردي</p>
              </div>
            </div>
          </div>
          <Link
            href="/teacher/solo-challenges/new"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md hover:shadow-primary/25 hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            إنشاء مسابقة جديدة
          </Link>
          <Link
            href="/teacher/solo-challenges/new"
            className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">

        {/* ── Stats bar ── */}
        {challenges.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {([
              { label: "المسابقات", value: challenges.length, icon: Target,      bg: "bg-primary/10", fg: "text-primary" },
              { label: "النشطة",       value: activeCount,       icon: CheckCircle, bg: "bg-emerald-500/10",  fg: "text-emerald-600" },
              { label: "إجمالي اللعبات", value: totalPlays,   icon: Activity,    bg: "bg-amber-500/10",   fg: "text-amber-600"  },
            ] as const).map((s, i) => (
              <motion.div 
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border/60 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-start gap-2 sm:gap-4 hover:border-primary/20 transition-colors"
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", s.bg)}>
                  <s.icon className={cn("w-5 h-5", s.fg)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl sm:text-2xl font-black text-foreground leading-none">{s.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-1.5 font-medium truncate">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Section header + filter tabs ── */}
        {challenges.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-black text-foreground">مسابقاتي</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{challenges.length} مسابقة محفوظة</p>
            </div>
            <div className="flex items-center bg-muted/60 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-border/40">
              {([
                { key: "all",     label: "الكل"    },
                { key: "active",  label: "نشطة"    },
                { key: "expired", label: "منتهية"  },
              ] as const).map(tab => {
                const cnt = tabCounts[tab.key];
                const active = filter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative",
                       active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="relative z-10">{tab.label}</span>
                    {cnt > 0 && (
                      <span className={cn(
                        "relative z-10 text-[10px] px-1.5 py-0.5 rounded-md font-black leading-none",
                         active ? "bg-white/20 text-primary-foreground" : "bg-border text-muted-foreground",
                      )}>
                        {cnt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Challenges grid / empty state ── */}
        <AnimatePresence mode="popLayout">
          {challenges.length === 0 ? (
            /* ── Full empty state with explainer ── */
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 16 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.96 }}
              className="space-y-6"
            >
              <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 sm:p-8 flex flex-col sm:flex-row gap-5 items-start relative overflow-hidden">
                <div className="absolute top-0 end-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 border border-primary/20 shadow-sm relative z-10">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div className="space-y-2 relative z-10">
                  <h2 className="text-base font-black text-foreground tracking-tight">ما هي المسابقة الذاتية؟</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    أنشئ تحديات مخصصة بأسئلة اختيار من متعدد أو صح وخطأ. شارك الرابط مع طلابك ليتنافسوا فردياً في أي وقت، دون الحاجة لجلسة مباشرة. وتُجمع النتائج تلقائياً في قائمة المتصدرين.
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 pt-3">
                    {[
                      { icon: Clock,   text: "مؤقت لكل سؤال" },
                      { icon: Trophy,  text: "قائمة متصدرين" },
                      { icon: Users,   text: "لعب فردي مستقل" },
                      { icon: Share2,  text: "رابط قابل للمشاركة" },
                    ].map(({ icon: Icon, text }) => (
                      <span key={text} className="flex items-center gap-1.5 text-xs font-bold text-primary/80">
                        <Icon className="w-3.5 h-3.5" />{text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-5 border border-border">
                  <Target className="w-8 h-8 text-muted-foreground/60" />
                </div>
                <h2 className="text-lg font-black text-foreground mb-2">لا توجد مسابقات بعد</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">ابدأ الآن وأنشئ أول مسابقة ذاتية لطلابك، سواء من واجب موجود أو بأسئلة جديدة كلياً.</p>
                <Link
                  href="/teacher/solo-challenges/new"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Plus className="w-5 h-5" />
                  إنشاء مسابقة جديدة
                </Link>
              </div>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div 
              key="empty-filter"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-16 text-sm text-muted-foreground bg-muted/30 rounded-2xl border border-border border-dashed"
            >
              لا توجد مسابقات في هذا التصنيف
            </motion.div>
          ) : (
            <motion.div key="grid" className="grid gap-4 sm:grid-cols-2" layout>
              <AnimatePresence>
                {filtered.map((ch, i) => (
                  <motion.div
                    key={ch.slug}
                    layout
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/40 transition-all hover:shadow-md group flex flex-col"
                  >
                    {/* Card body */}
                    <div className="p-5 flex-1 flex flex-col">
                      {/* Status badges */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border",
                          ch.isExpired 
                            ? "bg-red-500/10 text-red-600 border-red-500/20" 
                            : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                        )}>
                          {ch.isExpired ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                          {ch.isExpired ? "منتهية" : "نشطة"}
                        </span>
                        {ch.isStandalone && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Target className="w-3 h-3" />مستقلة
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-black text-foreground text-base leading-snug line-clamp-2 mb-4 group-hover:text-primary transition-colors">
                        {ch.assignmentTitle}
                      </h3>

                      <div className="mt-auto"></div>

                      {/* Meta row */}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground font-medium p-3 bg-muted/40 rounded-xl border border-border/40">
                        <span className="flex items-center gap-1.5" title="اللاعبين">
                          <Users className="w-3.5 h-3.5 text-primary/60" />
                          {ch.playCount}
                        </span>
                        <span className="flex items-center gap-1.5" title="الوقت لكل سؤال">
                          <Clock className="w-3.5 h-3.5 text-amber-500/60" />
                          {ch.timePerQuestion ?? 20}ث
                        </span>
                        <span className="flex items-center gap-1.5" title="المتصدرين">
                          <Trophy className="w-3.5 h-3.5 text-emerald-500/60" />
                          {ch.leaderboardDisplay === "top3" ? "أفضل 3" : ch.leaderboardDisplay === "all" ? "الكل" : "أفضل 20"}
                        </span>
                      </div>

                      {ch.expiresAt && (
                        <p className="text-[10px] text-muted-foreground mt-3 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          ينتهي: <span dir="ltr">{new Date(ch.expiresAt).toLocaleDateString("en-GB")}</span>
                        </p>
                      )}
                    </div>

                    {/* Action bar */}
                    <div className="border-t border-border/40 px-3 py-3 flex items-center gap-2 bg-card">
                      <Link
                        href={`/teacher/solo-challenges/${ch.slug}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        إدارة
                      </Link>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyLink(ch.slug)}
                          className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="نسخ الرابط"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => shareWhatsApp(ch.slug, ch.assignmentTitle)}
                          className="p-2 rounded-xl bg-emerald-500/5 hover:bg-emerald-500/15 transition-colors text-emerald-600"
                          title="مشاركة واتساب"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <a
                          href={`/solo/${ch.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="فتح رابط اللعبة"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <div className="w-px h-6 bg-border/60 mx-1" />
                        <button
                          onClick={() => deleteChallenge(ch.slug, ch.assignmentTitle)}
                          className="p-2 rounded-xl hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-600"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}