/**
 * /teacher/solo-challenges/:slug
 * إدارة مسابقة مسابقة ذاتية — إعدادات، كشف اللاعبين، الحذف
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, ChevronLeft, Copy, Share2, ExternalLink, Users, Clock,
  Trophy, FileText, Calendar, CheckCircle, XCircle, Trash2,
  Loader2, Check, Save, Edit3, BarChart2, Medal, RotateCw, Volume2, VolumeX, Music,
} from "lucide-react";
import AudioPicker from "@/components/AudioPicker";
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
    const text = `🎯 شاركوا في مسابقة "${challenge.assignmentTitle}" وتنافسوا على المراكز الأولى!\n${url}`;
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!challenge) return null;

  const challengeUrl = `${window.location.origin}/solo/${slug}`;
  const top3 = participants.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border/60 bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/teacher/solo-challenges" className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-foreground text-base truncate">{challenge.assignmentTitle}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                challenge.isExpired ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-600"
              )}>
                {challenge.isExpired ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                {challenge.isExpired ? "منتهية" : "نشطة"}
              </span>
              {challenge.isStandalone && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                  <Zap className="w-3 h-3" />مستقلة
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Link card */}
        <div className="bg-card border border-border/60 rounded-2xl p-4">
          <p className="text-xs font-bold text-muted-foreground mb-2">رابط المسابقة</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 bg-muted rounded-xl px-3 py-2.5 text-sm font-mono text-muted-foreground truncate">
              {challengeUrl}
            </div>
            <button onClick={copyLink} className="p-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary transition-colors" title="نسخ">
              <Copy className="w-4 h-4" />
            </button>
            <button onClick={shareWA} className="p-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-600 transition-colors" title="واتساب">
              <Share2 className="w-4 h-4" />
            </button>
            <a href={challengeUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground transition-colors" title="فتح">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: "إجمالي اللعبات", value: challenge.playCount, color: "text-blue-600 bg-blue-500/10" },
            { icon: BarChart2, label: "الأسئلة", value: challenge.questionCount, color: "text-amber-600 bg-amber-500/10" },
            { icon: Trophy, label: "المتصدر", value: participants[0]?.playerName ?? "—", color: "text-yellow-600 bg-yellow-500/10", small: true },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border/60 rounded-2xl p-3 text-center">
              <div className={`w-8 h-8 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-2`}>
                <s.icon className="w-4 h-4" />
              </div>
              <p className={cn("font-black text-foreground", s.small ? "text-sm truncate" : "text-xl")}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Settings panel */}
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border/40 flex items-center justify-between">
            <h2 className="font-bold text-sm text-foreground">إعدادات المسابقة</h2>
            {settingsDirty && (
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                حفظ
              </button>
            )}
          </div>
          <div className="divide-y divide-border/30">

            {/* ── Time per question ── */}
            <div className="flex items-center justify-between px-4 py-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                وقت كل سؤال
              </label>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setEditTime(t => Math.max(5, t - 5)); mark(); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/70 font-black text-base flex items-center justify-center transition-colors">−</button>
                <span className="w-14 text-center text-sm font-bold tabular-nums text-foreground">{editTime} ث</span>
                <button onClick={() => { setEditTime(t => Math.min(120, t + 5)); mark(); }} className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/70 font-black text-base flex items-center justify-center transition-colors">+</button>
              </div>
            </div>

            {/* ── Difficulty distribution ── */}
            <>
              <div className="flex items-center justify-between px-4 py-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  توزيع الصعوبة
                </label>
                <button
                  onClick={() => { setEditDiffDistribution(editDiffDistribution ? null : { easy: 4, medium: 4, hard: 2 }); mark(); }}
                  className={cn("relative w-9 h-5 rounded-full transition-colors flex-shrink-0", editDiffDistribution ? "bg-amber-500" : "bg-muted")}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all", editDiffDistribution ? "start-4" : "start-0.5")} />
                </button>
              </div>
              {editDiffDistribution && (
                <div className="px-4 pt-1 pb-3 bg-muted/20 space-y-2">
                  <p className="text-[11px] text-muted-foreground pt-1">حدّد عدد أسئلة كل مستوى — صنّف الأسئلة أولاً.</p>
                  {([
                    { key: "easy" as const, label: "سهل", color: "bg-green-500" },
                    { key: "medium" as const, label: "متوسط", color: "bg-yellow-500" },
                    { key: "hard" as const, label: "صعب", color: "bg-red-500" },
                  ]).map(({ key, label, color }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold px-2.5 py-0.5 rounded-full text-white", color)}>{label}</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setEditDiffDistribution(d => d ? { ...d, [key]: Math.max(0, d[key] - 1) } : null); mark(); }} className="w-6 h-6 rounded-lg bg-muted hover:bg-muted/70 font-black text-sm flex items-center justify-center">−</button>
                        <span className="w-7 text-center font-bold text-sm">{editDiffDistribution[key]}</span>
                        <button onClick={() => { setEditDiffDistribution(d => d ? { ...d, [key]: d[key] + 1 } : null); mark(); }} className="w-6 h-6 rounded-lg bg-muted hover:bg-muted/70 font-black text-sm flex items-center justify-center">+</button>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground border-t border-border/30 pt-1.5">المجموع: <span className="font-bold text-foreground">{editDiffDistribution.easy + editDiffDistribution.medium + editDiffDistribution.hard} سؤال</span></p>
                </div>
              )}
            </>

            {/* ── Questions per participant ── */}
            {!editDiffDistribution && (
              <div className="flex items-center justify-between px-4 py-3">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Zap className="w-3.5 h-3.5" />
                  أسئلة لكل متسابق
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      if (editQpp === "" || (editQpp as number) <= 1) { setEditQpp(""); mark(); }
                      else { setEditQpp((editQpp as number) - 1); mark(); }
                    }}
                    className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/70 font-black text-base flex items-center justify-center transition-colors"
                  >−</button>
                  <span className="w-14 text-center text-sm font-bold text-foreground">
                    {editQpp === "" ? "الكل" : String(editQpp)}
                  </span>
                  <button
                    onClick={() => {
                      const cur = editQpp === "" ? 0 : (editQpp as number);
                      const next = cur + 1;
                      if (challenge.questionCount > 0 && next > challenge.questionCount) return;
                      setEditQpp(next); mark();
                    }}
                    className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/70 font-black text-base flex items-center justify-center transition-colors"
                  >+</button>
                </div>
              </div>
            )}

            {/* ── Leaderboard ── */}
            <div className="flex items-center justify-between px-4 py-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Trophy className="w-3.5 h-3.5" />
                لوحة المتصدرين
              </label>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {([
                  { value: "top3" as const, label: "أفضل 3" },
                  { value: "top20" as const, label: "أفضل 20" },
                  { value: "all" as const, label: "الكل" },
                ]).map((o, idx) => (
                  <button key={o.value} onClick={() => { setEditLd(o.value); mark(); }}
                    className={cn("px-2.5 py-1.5 text-xs font-bold transition-colors", idx < 2 && "border-s border-border",
                      editLd === o.value ? "bg-amber-500 text-white" : "text-muted-foreground hover:bg-muted")}
                  >{o.label}</button>
                ))}
              </div>
            </div>

            {/* ── Attempts ── */}
            <div className="flex items-center justify-between px-4 py-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <RotateCw className="w-3.5 h-3.5" />
                المحاولات المسموحة
              </label>
              <div className="flex rounded-lg overflow-hidden border border-border">
                {([1, 2, 3] as const).map((v, idx) => (
                  <button key={v} onClick={() => { setEditMaxAttempts(v); mark(); }}
                    className={cn("px-3 py-1.5 text-xs font-bold transition-colors", idx < 2 && "border-s border-border",
                      editMaxAttempts === v ? "bg-amber-500 text-white" : "text-muted-foreground hover:bg-muted")}
                  >{v === 1 ? "مرة" : v === 2 ? "مرتان" : "3 أفضل"}</button>
                ))}
              </div>
            </div>
            {editMaxAttempts > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
                <span className="text-[11px] text-muted-foreground">
                  {editMaxAttempts === 2 ? "يختار اللاعب بعد المحاولتين" : `يُحتسب أفضل نتيجة من ${editMaxAttempts}`}
                </span>
                <input type="number" min={2} max={10} value={editMaxAttempts}
                  onChange={e => { let n = Math.max(2, Math.min(10, Number(e.target.value) || 2)); setEditMaxAttempts(n); mark(); }}
                  className="w-14 px-2 py-1 rounded-lg bg-muted border border-border focus:outline-none focus:border-amber-500 text-sm text-center"
                />
              </div>
            )}

            {/* ── Notes ── */}
            <div className="px-4 py-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <FileText className="w-3.5 h-3.5" />
                ملاحظات للاعبين
              </label>
              <textarea value={editNotes} onChange={e => { setEditNotes(e.target.value); mark(); }}
                placeholder="تعليمات أو رسالة قبل المسابقة..."
                rows={2} maxLength={1000}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:border-amber-500 text-xs resize-none text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* ── Expiry ── */}
            <div className="flex items-center justify-between px-4 py-3">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground shrink-0 me-3">
                <Calendar className="w-3.5 h-3.5" />
                موعد انتهاء المسابقة
              </label>
              <div className="flex items-center gap-2 min-w-0">
                <span dir="ltr">
                  <input type="datetime-local" lang="en" value={editExpires} onChange={e => { setEditExpires(e.target.value); mark(); }}
                    className="text-xs px-2 py-1.5 rounded-lg bg-muted border border-border focus:outline-none focus:border-amber-500 text-foreground min-w-0" />
                </span>
                {editExpires && (
                  <button onClick={() => { setEditExpires(""); mark(); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">إزالة</button>
                )}
              </div>
            </div>

            {/* ── Class restriction ── */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  تقييد المشاركة بالصف
                </label>
                {editAllowedClasses.length > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {editAllowedClasses.length} صف
                  </span>
                )}
              </div>
              {teacherClasses.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">لا توجد صفوف مضافة — أضف صفوفاً من إعدادات الطلاب أولاً.</p>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    اختر الصفوف المسموح لها. إذا تركت هذا فارغاً يمكن للجميع الدخول.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {teacherClasses.map(cls => (
                      <button
                        key={cls}
                        onClick={() => {
                          setEditAllowedClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]);
                          mark();
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors",
                          editAllowedClasses.includes(cls)
                            ? "bg-amber-500 border-amber-500 text-white"
                            : "border-border text-muted-foreground hover:bg-muted/40",
                        )}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* ── Save ── */}
            {settingsDirty && (
              <div className="px-4 py-3">
                <button onClick={saveSettings} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Questions editor — standalone only */}
        {challenge.isStandalone && editQuestions.length > 0 && (
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-bold text-sm text-foreground">تعديل صوت الأسئلة</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {editQuestions.filter(q => q.audioUrl).length}/{editQuestions.length} صوتي
                </span>
              </div>
              {questionsDirty && (
                <button
                  onClick={saveQuestions}
                  disabled={savingQuestions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60"
                >
                  {savingQuestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  حفظ
                </button>
              )}
            </div>
            <div className="divide-y divide-border/30">
              {editQuestions.map((q, idx) => (
                <div key={idx}>
                  <button
                    onClick={() => setExpandedAudio(expandedAudio === idx ? null : idx)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-start"
                  >
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-black text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <p className="flex-1 text-xs text-foreground line-clamp-2 text-right">{q.text}</p>
                    <span className={cn(
                      "shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full",
                      q.audioUrl
                        ? "bg-green-500/10 text-green-600"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {q.audioUrl
                        ? <><Volume2 className="w-3 h-3" /> صوتي</>
                        : <><VolumeX className="w-3 h-3" /> بلا صوت</>
                      }
                    </span>
                  </button>
                  {expandedAudio === idx && (
                    <div className="px-4 pb-4">
                      <AudioPicker
                        value={q.audioUrl ?? null}
                        onChange={(url) => updateQuestionAudio(idx, url)}
                        uploadEndpoint="/api/islamic/teacher/uploads/audio-url"
                      />
                    </div>
                  )}
                </div>
              ))}
              {questionsDirty && (
                <div className="px-4 py-3">
                  <button
                    onClick={saveQuestions}
                    disabled={savingQuestions}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60"
                  >
                    {savingQuestions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingQuestions ? "جاري الحفظ..." : "حفظ تعديلات الصوت"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Participants */}
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-bold text-sm text-foreground">كشف اللاعبين</h2>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {participants.length} مشارك
            </span>
          </div>

          {participants.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا يوجد مشاركون بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {participants.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-sm font-black shrink-0",
                    i === 0 ? "bg-yellow-400/20 text-yellow-600"
                    : i === 1 ? "bg-slate-400/20 text-slate-600"
                    : i === 2 ? "bg-amber-700/20 text-amber-700"
                    : "bg-muted text-muted-foreground text-xs"
                  )}>
                    {i < 3 ? medals[i] : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{p.playerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.playedAt).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-black text-foreground">{p.score.toLocaleString("ar")} نقطة</p>
                    <p className="text-xs text-muted-foreground">
                      {p.correctCount}/{challenge.questionCount} صحيح • {fmtTime(p.timeTaken)}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteParticipant(p)}
                      disabled={deletingParticipantId === p.id}
                      title="حذف المشارك (المسؤول فقط)"
                      className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
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
        <div className="bg-card border border-red-500/20 rounded-2xl p-4">
          <h3 className="font-bold text-sm text-red-500 mb-3">منطقة الخطر</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">حذف المسابقة</p>
              <p className="text-xs text-muted-foreground">سيُحذف الرابط وجميع نتائج اللاعبين نهائياً</p>
            </div>
            <button
              onClick={deleteChallenge}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 border-red-500/40 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              حذف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
