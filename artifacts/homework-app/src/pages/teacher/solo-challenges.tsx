/**
 * /teacher/solo-challenges
 * لوحة تحكم مسابقة ذاتية — تعرض كل مسابقات المعلم
 */
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Copy, Share2, Settings, Trash2, Users, Clock,
  CheckCircle, XCircle, Trophy, ChevronLeft, ChevronRight, ExternalLink, BookOpen, Sparkles, PenLine
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Layout } from "@/components/layout";

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
  const { t, dir } = useI18n();
  const s = t.soloChallenges;
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
  }, [user, authLoading, setLocation]);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/solo/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success(s.linkCopied);
  };

  const shareWhatsApp = (slug: string, title: string) => {
    const url = `${window.location.origin}/solo/${slug}`;
    const text = `${s.shareText?.replace("{title}", title) || title}\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const deleteChallenge = async (slug: string, title: string) => {
    if (!confirm(s.deleteConfirm?.replace("{title}", title) || "Delete?")) return;
    const res = await fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setChallenges(prev => prev.filter(c => c.slug !== slug));
      toast.success(s.deleted);
    } else {
      toast.error(s.deleteFailed);
    }
  };

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
    <Layout hideFooter>
    <div className="min-h-[calc(100vh-3rem)] bg-background sm:min-h-[calc(100vh-3.5rem)]" dir={dir}>
      {/* ── Header ── */}
      <div className="site-layout-subheader border-b border-border/60 bg-card/80 backdrop-blur-xl sticky z-20">
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={user?.role === "organizer" ? "/organizer" : "/teacher"} className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground group">
            {dir === "rtl" ? <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /> : <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />}
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10 shadow-inner">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground tracking-tight">{s.title}</h1>
              <p className="text-xs text-muted-foreground font-medium">{s.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-10">

        {/* ── Creation Hub ── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground">{s.chooseHow || (dir === 'rtl' ? 'بدء مسابقة جديدة' : 'Start new challenge')}</h2>
            <p className="text-sm text-muted-foreground font-medium mt-1">{s.chooseHowHint || (dir === 'rtl' ? 'اختر الطريقة الأنسب لتجهيز الأسئلة' : 'Choose how to prepare questions')}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            <Link href="/teacher/solo-challenges/new?source=assignment" className="group p-5 bg-card border border-border/60 hover:border-primary/50 rounded-2xl text-start transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden block">
              <div className="absolute top-0 end-0 w-20 h-20 bg-primary/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/3 group-hover:bg-primary/10 transition-colors" />
              <div className="w-12 h-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors border border-primary/10 relative z-10">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-black text-foreground text-base mb-1 relative z-10">{s.fromAssignment || (dir === 'rtl' ? 'من واجب' : 'From assignment')}</h3>
              <p className="text-xs text-muted-foreground font-medium relative z-10 leading-relaxed">{s.fromAssignmentHint || (dir === 'rtl' ? 'استخدم أسئلة واجب موجود' : 'Use questions from an existing assignment')}</p>
            </Link>

            <Link href="/teacher/solo-challenges/new?source=ai" className="group p-5 bg-card border border-border/60 hover:border-amber-500/50 rounded-2xl text-start transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden block">
              <div className="absolute top-0 end-0 w-20 h-20 bg-amber-500/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/3 group-hover:bg-amber-500/10 transition-colors" />
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 group-hover:bg-amber-500/20 flex items-center justify-center mb-4 transition-colors border border-amber-500/10 relative z-10">
                <Sparkles className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="font-black text-foreground text-base mb-1 relative z-10">{s.withAi || (dir === 'rtl' ? 'بالذكاء الاصطناعي' : 'With AI')}</h3>
              <p className="text-xs text-muted-foreground font-medium relative z-10 leading-relaxed">{s.withAiHint || (dir === 'rtl' ? 'ولّد أسئلة جديدة من أي نص' : 'Generate questions from text')}</p>
            </Link>

            <Link href="/teacher/solo-challenges/new?source=manual" className="group p-5 bg-card border border-border/60 hover:border-emerald-500/50 rounded-2xl text-start transition-all hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden block">
              <div className="absolute top-0 end-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl -translate-y-1/2 translate-x-1/3 group-hover:bg-emerald-500/10 transition-colors" />
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center mb-4 transition-colors border border-emerald-500/10 relative z-10">
                <PenLine className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-black text-foreground text-base mb-1 relative z-10">{s.manually || (dir === 'rtl' ? 'يدوياً' : 'Manually')}</h3>
              <p className="text-xs text-muted-foreground font-medium relative z-10 leading-relaxed">{s.manuallyHint || (dir === 'rtl' ? 'اكتب الأسئلة بنفسك' : 'Write questions yourself')}</p>
            </Link>
          </div>
        </section>

        {challenges.length > 0 && <div className="h-px bg-border/60 w-full" />}

        {/* ── Previous Challenges ── */}
        {challenges.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-foreground">{s.myChallenges}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{s.savedChallenges?.replace("{n}", String(challenges.length))}</p>
              </div>

              <div className="flex items-center bg-muted/60 p-1 rounded-xl shrink-0 self-start sm:self-auto border border-border/40">
                {([
                  { key: "all", label: s.all },
                  { key: "active", label: s.active },
                  { key: "expired", label: s.expired },
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

            {filtered.length === 0 ? (
              <motion.div
                key="empty-filter"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center py-10 text-sm text-muted-foreground bg-muted/30 rounded-2xl border border-border border-dashed"
              >
                {s.emptyFilter}
              </motion.div>
            ) : (
              <motion.div key="grid" className="grid gap-3" layout>
                <AnimatePresence>
                  {filtered.map((ch, i) => (
                    <motion.div
                      key={ch.slug}
                      layout
                      initial={{ opacity: 0, scale: 0.98, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, height: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="bg-card border border-border/60 rounded-xl p-3 sm:p-4 hover:border-primary/40 transition-all hover:shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 group overflow-hidden"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start sm:items-center gap-2 mb-1.5">
                          <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors flex-1">
                            {ch.assignmentTitle}
                          </h3>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {ch.isStandalone && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                <Target className="w-2.5 h-2.5" />{s.standalone}
                              </span>
                            )}
                            <span className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border",
                              ch.isExpired
                                ? "bg-red-500/10 text-red-600 border-red-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                            )}>
                              {ch.isExpired ? <XCircle className="w-2.5 h-2.5" /> : <CheckCircle className="w-2.5 h-2.5" />}
                              {ch.isExpired ? s.expired : s.active}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground font-medium">
                          <span className="flex items-center gap-1" title={s.players}>
                            <Users className="w-3 h-3 text-primary/60" />
                            {ch.playCount}
                          </span>
                          <span className="flex items-center gap-1" title={s.timePerQuestion}>
                            <Clock className="w-3 h-3 text-amber-500/60" />
                            {ch.timePerQuestion ?? 20} {s.secondsShort}
                          </span>
                          <span className="flex items-center gap-1" title={s.leaders}>
                            <Trophy className="w-3 h-3 text-emerald-500/60" />
                            {ch.leaderboardDisplay === "top3" ? s.top3 : ch.leaderboardDisplay === "all" ? s.all : s.top20}
                          </span>
                          {ch.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-muted-foreground/60" />
                              <span dir="ltr">{new Date(ch.expiresAt).toLocaleDateString("en-GB")}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-1 self-stretch sm:self-auto border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0 w-full sm:w-auto mt-1 sm:mt-0">
                        <button
                          onClick={() => copyLink(ch.slug)}
                          className="flex-1 sm:flex-none flex items-center justify-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title={s.copyLink}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => shareWhatsApp(ch.slug, ch.assignmentTitle)}
                          className="flex-1 sm:flex-none flex items-center justify-center p-2 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/15 transition-colors text-emerald-600"
                          title={s.shareWhatsApp}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <a
                          href={`/solo/${ch.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 sm:flex-none flex items-center justify-center p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title={s.openGameLink}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <Link
                          href={`/teacher/solo-challenges/${ch.slug}`}
                          className="flex-1 sm:flex-none flex items-center justify-center p-2 rounded-lg bg-primary/10 hover:bg-primary transition-colors text-primary hover:text-primary-foreground"
                          title={s.manage}
                        >
                          <Settings className="w-4 h-4" />
                        </Link>
                        <div className="w-px h-5 bg-border/60 mx-0.5 hidden sm:block" />
                        <button
                          onClick={() => deleteChallenge(ch.slug, ch.assignmentTitle)}
                          className="flex-1 sm:flex-none flex items-center justify-center p-2 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-600"
                          title={s.delete}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </section>
        )}
      </div>
    </div>
    </Layout>
  );
}
