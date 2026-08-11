/**
 * /teacher/solo-challenges/:slug
 * إدارة مسابقة مسابقة ذاتية — إعدادات، كشف اللاعبين، الحذف
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, ChevronLeft, Copy, Share2, ExternalLink, Users, Clock,
  Trophy, FileText, Calendar, CheckCircle, XCircle, Trash2,
  Loader2, Check, Save, Edit3, BarChart2, Medal, RotateCw, Volume2, VolumeX, Music, AlertCircle, Settings
} from "lucide-react";
import AudioPicker from "@/components/AudioPicker";
import { QRModalButton } from "@/components/game-qr-code";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "";

interface SoloQuestion {
  text: string;
  questionType: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  difficulty?: number | null;
  audioUrl?: string | null;
}

interface ChallengeTeacherData {
  id: number;
  slug: string;
  shortSlug: string | null;
  assignmentId: number | null;
  assignmentTitle: string;
  notes: string | null;
  expiresAt: string | null;
  questions: SoloQuestion[] | null;
  timePerQuestion: number | null;
  questionsPerParticipant: number | null;
  leaderboardDisplay: string | null;
  maxAttempts: number | null;
  playCount: number;
  createdAt: string;
  isStandalone: boolean;
  isExpired: boolean;
  questionCount: number;
  difficultyDistribution?: { easy: number; medium: number; hard: number } | null;
  isMultiLevel?: boolean;
  levels?: Array<{ name: string; questionCount: number; timePerQuestion: number }> | null;
  allowedClasses?: string[];
}

interface Participant {
  id: number;
  playerName: string;
  score: number;
  correctCount: number;
  timeTaken: number | null;
  playedAt: string;
}

function fmtTime(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}د ${s}ث` : `${s}ث`;
}

export default function SoloChallengeManagePage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { data: user, isLoading: authLoading } = useGetCurrentTeacher({ query: { retry: false } as any });

  const [challenge, setChallenge] = useState<ChallengeTeacherData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Settings edit state
  const [editNotes, setEditNotes] = useState("");
  const [editExpires, setEditExpires] = useState("");
  const [editTime, setEditTime] = useState(20);
  const [editLd, setEditLd] = useState<"top3" | "top20" | "all">("top20");
  const [editQpp, setEditQpp] = useState<number | "">("");
  const [editMaxAttempts, setEditMaxAttempts] = useState(1);
  const [editDiffDistribution, setEditDiffDistribution] = useState<{ easy: number; medium: number; hard: number } | null>(null);
  const [editAllowedClasses, setEditAllowedClasses] = useState<string[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [deletingParticipantId, setDeletingParticipantId] = useState<number | null>(null);
  const isAdmin = Boolean((user as any)?.isAdmin);

  // Questions editor (standalone only)
  const [editQuestions, setEditQuestions] = useState<SoloQuestion[]>([]);
  const [expandedAudio, setExpandedAudio] = useState<number | null>(null);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [questionsDirty, setQuestionsDirty] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [chalRes, partRes] = await Promise.all([
        fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug)}/teacher`, { credentials: "include" }),
        fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug)}/participants`, { credentials: "include" }),
      ]);
      if (chalRes.status === 401 || chalRes.status === 403) { setLocation("/login"); return; }
      if (!chalRes.ok) { toast.error("المسابقة غير موجودة"); setLocation("/teacher/solo-challenges"); return; }
      const chal = await chalRes.json();
      const parts = partRes.ok ? await partRes.json() : [];
      setChallenge(chal);
      setParticipants(Array.isArray(parts) ? parts : []);
      setEditNotes(chal.notes ?? "");
      setEditTime(chal.timePerQuestion ?? 20);
      setEditQpp(chal.questionsPerParticipant ?? "");
      const ld = chal.leaderboardDisplay ?? "top20";
      setEditLd(["top3","top20","all"].includes(ld) ? ld : "top20");
      setEditMaxAttempts(chal.maxAttempts ?? 1);
      const rawDist = (chal as any).difficultyDistribution;
      setEditDiffDistribution(rawDist && typeof rawDist === "object" && (rawDist.easy + rawDist.medium + rawDist.hard) > 0
        ? { easy: Math.max(0, Number(rawDist.easy) || 0), medium: Math.max(0, Number(rawDist.medium) || 0), hard: Math.max(0, Number(rawDist.hard) || 0) }
        : null);
      setEditExpires(
        chal.expiresAt ? new Date(chal.expiresAt).toISOString().slice(0, 16) : ""
      );
      setEditAllowedClasses(Array.isArray(chal.allowedClasses) ? chal.allowedClasses : []);
      if (chal.assignmentId === null && Array.isArray(chal.questions)) {
        setEditQuestions(chal.questions as SoloQuestion[]);
      }
    } catch {
      toast.error("خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!authLoading && !user) { setLocation("/login"); return; }
    if (user) load();
  }, [user, authLoading, load]);

  // Fetch teacher classes for class restriction picker
  useEffect(() => {
    if (!user) return;
    fetch(`${API}/api/teacher/classes`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ name: string; group_name?: string }>) => {
        const names = data.map(c => c.group_name ? `${c.name} - ${c.group_name}` : c.name);
        setTeacherClasses([...new Set(names)]);
      })
      .catch(() => {});
  }, [user]);

  const saveSettings = async () => {
    if (!challenge) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug!)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          notes: editNotes.trim() || null,
          expiresAt: editExpires || null,
          timePerQuestion: editTime,
          leaderboardDisplay: editLd,
          questionsPerParticipant: editQpp === "" ? null : editQpp,
          maxAttempts: editMaxAttempts,
          difficultyDistribution: editDiffDistribution,
          allowedClasses: editAllowedClasses,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("تم حفظ الإعدادات");
      setSettingsDirty(false);
      setChallenge(prev => prev ? {
        ...prev,
        notes: editNotes.trim() || null,
        expiresAt: editExpires ? new Date(editExpires).toISOString() : null,
        timePerQuestion: editTime,
        leaderboardDisplay: editLd,
        questionsPerParticipant: editQpp === "" ? null : editQpp,
        maxAttempts: editMaxAttempts,
        isExpired: editExpires ? new Date(editExpires) < new Date() : false,
      } : prev);
    } catch (err: any) {
      toast.error(err.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const deleteChallenge = async () => {
    if (!challenge) return;
    if (!confirm(`هل تريد حذف مسابقة "${challenge.assignmentTitle}"؟ لا يمكن التراجع.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug!)}/`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast.success("تم حذف المسابقة");
      setLocation("/teacher/solo-challenges");
    } catch {
      toast.error("فشل الحذف");
      setDeleting(false);
    }
  };

  const deleteParticipant = async (participant: Participant) => {
    if (!confirm(`هل تريد حذف نتيجة "${participant.playerName}"؟ لا يمكن التراجع.`)) return;
    setDeletingParticipantId(participant.id);
    try {
      const res = await fetch(
        `${API}/api/solo-challenges/${encodeURIComponent(slug!)}/participants/${participant.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message);
      setParticipants(prev => prev.filter(p => p.id !== participant.id));
      toast.success("تم حذف المشارك");
    } catch (err: any) {
      toast.error(err.message || "فشل الحذف");
    } finally {
      setDeletingParticipantId(null);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/solo/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("تم نسخ الرابط");
  };

  const shareWA = () => {
    if (!challenge) return;
    const url = `${window.location.origin}/solo/${slug}`;
    const text = `شاركوا في مسابقة "${challenge.assignmentTitle}" وتنافسوا على المراكز الأولى!\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const mark = () => setSettingsDirty(true);

  const saveQuestions = async () => {
    if (!challenge) return;
    setSavingQuestions(true);
    try {
      const res = await fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug!)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questions: editQuestions }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success("تم حفظ الأسئلة");
      setQuestionsDirty(false);
      setExpandedAudio(null);
      setChallenge(prev => prev ? { ...prev, questions: editQuestions, questionCount: editQuestions.length } : prev);
    } catch (err: any) {
      toast.error(err.message || "فشل حفظ الأسئلة");
    } finally {
      setSavingQuestions(false);
    }
  };

  const updateQuestionAudio = (idx: number, audioUrl: string | null) => {
    setEditQuestions(qs => qs.map((q, i) => i === idx ? { ...q, audioUrl: audioUrl ?? undefined } : q));
    setQuestionsDirty(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!challenge) return null;

  const challengeUrl = `${window.location.origin}/solo/${slug}`;
  // Use percent-encoded slug for QR so all scanners handle Arabic correctly
  const challengeQrUrl = `${window.location.origin}/solo/${encodeURIComponent(slug!)}`;
  const top3 = participants.slice(0, 3);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/teacher/solo-challenges" className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground group shrink-0">
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-foreground text-lg truncate tracking-tight">{challenge.assignmentTitle}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                challenge.isExpired ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              )}>
                {challenge.isExpired ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                {challenge.isExpired ? "منتهية" : "نشطة"}
              </span>
              {challenge.isStandalone && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <Target className="w-3 h-3" />مستقلة
                </span>
              )}
            </div>
          </div>
          {settingsDirty && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onClick={saveSettings}
              disabled={saving}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md active:scale-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الإعدادات
            </motion.button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">

        {/* Link card */}
        <div className="bg-card border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent rounded-3xl p-5 shadow-sm">
          <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            رابط المسابقة
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 min-w-0 bg-background rounded-xl px-4 py-3.5 text-sm font-mono font-medium text-muted-foreground truncate border border-border/60 shadow-inner">
              {challengeUrl}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={copyLink} className="flex-1 sm:flex-none p-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors flex items-center justify-center gap-2 font-bold text-sm shadow-md" title="نسخ">
                <Copy className="w-4 h-4" />
                <span className="sm:hidden">نسخ</span>
              </button>
              <button onClick={shareWA} className="flex-1 sm:flex-none p-3.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-colors flex items-center justify-center gap-2 font-bold text-sm" title="واتساب">
                <Share2 className="w-4 h-4" />
                <span className="sm:hidden">مشاركة</span>
              </button>
              <QRModalButton url={challengeQrUrl} pin="" label="" />
              <a href={challengeUrl} target="_blank" rel="noopener noreferrer" className="p-3.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground transition-colors flex items-center justify-center gap-2" title="فتح">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { icon: Users, label: "إجمالي اللعبات", value: challenge.playCount, color: "text-primary bg-primary/10" },
            { icon: BarChart2, label: "الأسئلة", value: challenge.questionCount, color: "text-amber-600 bg-amber-500/10" },
            { icon: Trophy, label: "المتصدر", value: participants[0]?.playerName ?? "—", color: "text-emerald-600 bg-emerald-500/10", small: true },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/60 rounded-2xl p-4 sm:p-5 text-center flex flex-col items-center hover:border-primary/20 transition-colors">
              <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3 shadow-sm`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className={cn("font-black text-foreground", s.small ? "text-sm truncate w-full px-2" : "text-2xl")}>{s.value}</p>
              <p className="text-[11px] sm:text-xs font-medium text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Settings panel */}
        <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
            <h2 className="font-black text-base text-foreground flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              إعدادات المسابقة
            </h2>
            {settingsDirty && (
              <button
                onClick={saveSettings}
                disabled={saving}
                className="sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                حفظ
              </button>
            )}
          </div>
          <div className="divide-y divide-border/30">

             {/* ── Participant instructions ── */}
             <div className="px-5 py-4 hover:bg-muted/10 transition-colors">
               <label className="flex items-center gap-2 text-sm font-bold text-foreground mb-3">
                 <FileText className="w-4 h-4 text-emerald-600" />
                 تعليمات أو ملاحظات للمشاركين
               </label>
               <textarea value={editNotes} onChange={e => { setEditNotes(e.target.value); mark(); }}
                 placeholder="تعليمات أو رسالة ترحيب تظهر قبل بدء المسابقة..."
                 rows={2} maxLength={1000}
                 className="w-full px-4 py-3 rounded-xl bg-card border border-border/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm resize-none text-foreground placeholder:text-muted-foreground shadow-sm transition-all"
               />
             </div>

            {/* ── Time per question ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-muted/10 transition-colors">
              <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Clock className="w-4 h-4 text-amber-500" />
                وقت كل سؤال
              </label>
              <div className="flex items-center gap-2 self-start sm:self-auto bg-muted/50 p-1 rounded-xl border border-border/50">
                <button onClick={() => { setEditTime(t => Math.max(5, t - 5)); mark(); }} className="w-8 h-8 rounded-lg bg-background hover:bg-muted font-black text-base flex items-center justify-center transition-colors border border-border/50 shadow-sm">−</button>
                <span className="w-12 text-center text-sm font-black tabular-nums text-foreground">{editTime} ث</span>
                <button onClick={() => { setEditTime(t => Math.min(120, t + 5)); mark(); }} className="w-8 h-8 rounded-lg bg-background hover:bg-muted font-black text-base flex items-center justify-center transition-colors border border-border/50 shadow-sm">+</button>
              </div>
            </div>

            {/* ── Difficulty distribution ── */}
            <div className="hover:bg-muted/10 transition-colors">
              <div className="flex items-center justify-between px-5 py-4">
                <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Target className="w-4 h-4 text-primary" />
                  توزيع الصعوبة
                </label>
                <button
                  onClick={() => { setEditDiffDistribution(editDiffDistribution ? null : { easy: 4, medium: 4, hard: 2 }); mark(); }}
                  className={cn("relative w-11 h-6 rounded-full transition-colors flex-shrink-0 border-2", editDiffDistribution ? "bg-primary border-primary" : "bg-muted border-transparent")}
                >
                  <span className={cn("absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-all", editDiffDistribution ? "start-[22px]" : "start-[2px]")} />
                </button>
              </div>
              {editDiffDistribution && (
                <div className="px-5 pt-1 pb-4 bg-primary/5 space-y-3 mx-4 mb-4 rounded-xl border border-primary/10">
                  <p className="text-[11px] font-bold text-primary/70">حدّد عدد أسئلة كل مستوى (يجب تصنيف الأسئلة أولاً)</p>
                  <div className="grid gap-3">
                    {([
                      { key: "easy" as const, label: "سهل", color: "bg-emerald-500" },
                      { key: "medium" as const, label: "متوسط", color: "bg-amber-500" },
                      { key: "hard" as const, label: "صعب", color: "bg-red-500" },
                    ]).map(({ key, label, color }) => (
                      <div key={key} className="flex items-center justify-between bg-card px-3 py-2 rounded-lg border border-border/50 shadow-sm">
                        <span className={cn("text-xs font-black px-2.5 py-1 rounded-md text-white w-16 text-center", color)}>{label}</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setEditDiffDistribution(d => d ? { ...d, [key]: Math.max(0, d[key] - 1) } : null); mark(); }} className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 font-black text-sm flex items-center justify-center transition-colors">−</button>
                          <span className="w-8 text-center font-black text-sm">{editDiffDistribution[key]}</span>
                          <button onClick={() => { setEditDiffDistribution(d => d ? { ...d, [key]: d[key] + 1 } : null); mark(); }} className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 font-black text-sm flex items-center justify-center transition-colors">+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-primary/10 pt-2 flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-primary">إجمالي الأسئلة المستهدفة:</span>
                    <span className="text-sm font-black text-primary">{editDiffDistribution.easy + editDiffDistribution.medium + editDiffDistribution.hard}</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Questions per participant ── */}
            {!editDiffDistribution && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-muted/10 transition-colors">
                <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Target className="w-4 h-4 text-emerald-500" />
                  أسئلة لكل متسابق
                </label>
                <div className="flex items-center gap-2 self-start sm:self-auto bg-muted/50 p-1 rounded-xl border border-border/50">
                  <button
                    onClick={() => {
                      if (editQpp === "" || (editQpp as number) <= 1) { setEditQpp(""); mark(); }
                      else { setEditQpp((editQpp as number) - 1); mark(); }
                    }}
                    className="w-8 h-8 rounded-lg bg-background hover:bg-muted font-black text-base flex items-center justify-center transition-colors border border-border/50 shadow-sm"
                  >−</button>
                  <span className="w-12 text-center text-sm font-black text-foreground">
                    {editQpp === "" ? "الكل" : String(editQpp)}
                  </span>
                  <button
                    onClick={() => {
                      const cur = editQpp === "" ? 0 : (editQpp as number);
                      const next = cur + 1;
                      if (challenge.questionCount > 0 && next > challenge.questionCount) return;
                      setEditQpp(next); mark();
                    }}
                    className="w-8 h-8 rounded-lg bg-background hover:bg-muted font-black text-base flex items-center justify-center transition-colors border border-border/50 shadow-sm"
                  >+</button>
                </div>
              </div>
            )}

            {/* ── Leaderboard ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-muted/10 transition-colors">
              <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Trophy className="w-4 h-4 text-amber-500" />
                لوحة المتصدرين
              </label>
              <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50 self-start sm:self-auto">
                {([
                  { value: "top3" as const, label: "أفضل 3" },
                  { value: "top20" as const, label: "أفضل 20" },
                  { value: "all" as const, label: "الكل" },
                ]).map((o, idx) => {
                  const active = editLd === o.value;
                  return (
                    <button key={o.value} onClick={() => { setEditLd(o.value); mark(); }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold transition-all rounded-lg relative",
                         active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="relative z-10">{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Attempts ── */}
            <div className="hover:bg-muted/10 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3">
                <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <RotateCw className="w-4 h-4 text-primary" />
                  المحاولات المسموحة
                </label>
                <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50 self-start sm:self-auto">
                  {([1, 2, 3] as const).map((v, idx) => {
                    const active = editMaxAttempts === v;
                    return (
                      <button key={v} onClick={() => { setEditMaxAttempts(v); mark(); }}
                        className={cn(
                          "px-3 py-1.5 text-xs font-bold transition-all rounded-lg relative",
                           active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="relative z-10">{v === 1 ? "مرة" : v === 2 ? "مرتان" : "3 أفضل"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {editMaxAttempts > 1 && (
                <div className="flex items-center justify-between px-5 py-3 bg-primary/5 border-t border-border/30">
                  <span className="text-xs font-bold text-primary/80">
                    {editMaxAttempts === 2 ? "يختار اللاعب بعد المحاولتين" : `يُحتسب أفضل نتيجة من ${editMaxAttempts}`}
                  </span>
                  <input type="number" min={2} max={10} value={editMaxAttempts}
                    onChange={e => { let n = Math.max(2, Math.min(10, Number(e.target.value) || 2)); setEditMaxAttempts(n); mark(); }}
                    className="w-16 px-2 py-1.5 rounded-lg bg-card border border-primary/20 focus:outline-none focus:border-primary text-sm font-black text-center shadow-sm"
                  />
                </div>
              )}
            </div>

            {/* ── Expiry ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-3 hover:bg-muted/10 transition-colors">
              <label className="flex items-center gap-2 text-sm font-bold text-foreground shrink-0">
                <Calendar className="w-4 h-4 text-amber-600" />
                موعد انتهاء المسابقة
              </label>
              <div className="flex items-center gap-2 min-w-0 self-start sm:self-auto">
                <span dir="ltr">
                  <input type="datetime-local" lang="en" value={editExpires} onChange={e => { setEditExpires(e.target.value); mark(); }}
                    className="text-xs font-bold px-3 py-2 rounded-xl bg-card border border-border/60 focus:outline-none focus:border-primary text-foreground min-w-0 shadow-sm" />
                </span>
                {editExpires && (
                  <button onClick={() => { setEditExpires(""); mark(); }} className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors" title="إزالة">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Class restriction ── */}
            <div className="px-5 py-4 hover:bg-muted/10 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Users className="w-4 h-4 text-primary" />
                  تقييد المشاركة بصفوف محددة
                </label>
                {editAllowedClasses.length > 0 && (
                  <span className="text-[10px] font-black text-primary-foreground bg-primary px-2 py-0.5 rounded-md shadow-sm">
                    {editAllowedClasses.length} صف محدد
                  </span>
                )}
              </div>
              {teacherClasses.length === 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  لا توجد صفوف مضافة في حسابك. أضف صفوفاً من إعدادات الطلاب أولاً لتمكين التقييد.
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    اختر الصفوف المسموح لها بالمشاركة. إذا لم تحدد أي صف، يمكن لأي شخص لديه الرابط الدخول.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {teacherClasses.map(cls => {
                      const selected = editAllowedClasses.includes(cls);
                      return (
                        <button
                          key={cls}
                          onClick={() => {
                            setEditAllowedClasses(prev => selected ? prev.filter(c => c !== cls) : [...prev, cls]);
                            mark();
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5",
                            selected
                              ? "bg-primary border-primary text-primary-foreground shadow-sm"
                              : "bg-card border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {selected && <Check className="w-3 h-3" />}
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* ── Save (Mobile) ── */}
            {settingsDirty && (
              <div className="px-5 py-4 sm:hidden bg-primary/5">
                <button onClick={saveSettings} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md active:scale-95 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Questions editor — standalone only */}
        {challenge.isStandalone && editQuestions.length > 0 && (
          <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                <h2 className="font-black text-base text-foreground">تعديل صوت الأسئلة</h2>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  {editQuestions.filter(q => q.audioUrl).length}/{editQuestions.length} صوتي
                </span>
              </div>
              {questionsDirty && (
                <button
                  onClick={saveQuestions}
                  disabled={savingQuestions}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-sm disabled:opacity-60"
                >
                  {savingQuestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ الأصوات
                </button>
              )}
            </div>
            <div className="divide-y divide-border/30">
              {editQuestions.map((q, idx) => (
                <div key={idx} className="hover:bg-muted/10 transition-colors">
                  <button
                    onClick={() => setExpandedAudio(expandedAudio === idx ? null : idx)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-start"
                  >
                    <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-black text-primary shrink-0 border border-primary/20">
                      {idx + 1}
                    </span>
                    <p className="flex-1 text-sm font-bold text-foreground line-clamp-2 text-right">{q.text}</p>
                    <span className={cn(
                      "shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border",
                      q.audioUrl
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border/50"
                    )}>
                      {q.audioUrl
                        ? <><Volume2 className="w-3 h-3" /> صوتي</>
                        : <><VolumeX className="w-3 h-3" /> بلا صوت</>
                      }
                    </span>
                  </button>
                  <AnimatePresence>
                    {expandedAudio === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 ml-10">
                          <AudioPicker
                            value={q.audioUrl ?? null}
                            onChange={(url) => updateQuestionAudio(idx, url)}
                            uploadEndpoint="/api/solo-challenges/uploads/audio-url"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
              {questionsDirty && (
                <div className="px-5 py-4 bg-primary/5 border-t border-primary/10">
                  <button
                    onClick={saveQuestions}
                    disabled={savingQuestions}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-md active:scale-95 disabled:opacity-60"
                  >
                    {savingQuestions ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {savingQuestions ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Participants */}
        <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-black text-base text-foreground">كشف اللاعبين</h2>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
              {participants.length} مشارك
            </span>
          </div>

          {participants.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-4 border border-border">
                <Users className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-bold text-foreground">لا يوجد مشاركون بعد</p>
              <p className="text-xs text-muted-foreground mt-1">شارك الرابط مع طلابك لتبدأ النتائج بالظهور هنا</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {participants.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-muted/5 transition-colors">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0 border shadow-sm",
                    i === 0 ? "bg-amber-100 border-amber-300 text-amber-600 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-500"
                    : i === 1 ? "bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-400/20 dark:border-slate-400/30 dark:text-slate-400"
                    : i === 2 ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-700/20 dark:border-orange-700/30 dark:text-orange-600"
                    : "bg-muted border-border/60 text-muted-foreground text-base"
                  )}>
                    {i === 0 ? <Trophy className="w-5 h-5" /> : i < 3 ? <Medal className="w-5 h-5" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground truncate">{p.playerName}</p>
                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                      {new Date(p.playedAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                      {p.score.toLocaleString("ar")} نقطة
                    </span>
                    <p className="text-[10px] font-bold text-muted-foreground">
                      {p.correctCount}/{challenge.questionCount} صحيح • {fmtTime(p.timeTaken)}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteParticipant(p)}
                      disabled={deletingParticipantId === p.id}
                      title="حذف المشارك (المسؤول فقط)"
                      className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors disabled:opacity-50 shrink-0 ml-1"
                    >
                      {deletingParticipantId === p.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-5 sm:p-6 shadow-sm">
          <h3 className="font-black text-base text-red-600 flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5" />
            منطقة الخطر
          </h3>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-foreground">حذف المسابقة نهائياً</p>
              <p className="text-xs font-medium text-muted-foreground mt-1 max-w-sm">
                سيؤدي هذا إلى حذف الرابط وجميع نتائج اللاعبين بشكل دائم. هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </div>
            <button
              onClick={deleteChallenge}
              disabled={deleting}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black bg-red-500 text-white hover:bg-red-600 transition-all shadow-md hover:shadow-red-500/20 active:scale-95 disabled:opacity-50 shrink-0"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              حذف المسابقة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
