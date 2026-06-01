/**
 * /teacher/solo-challenges/:slug
 * إدارة مسابقة وميض حر — إعدادات، كشف اللاعبين، الحذف
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, ChevronLeft, Copy, Share2, ExternalLink, Users, Clock,
  Trophy, FileText, Calendar, CheckCircle, XCircle, Trash2,
  Loader2, Check, Save, Edit3, BarChart2, Medal,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const API = import.meta.env.VITE_API_URL || "";

interface ChallengeTeacherData {
  id: number;
  slug: string;
  shortSlug: string | null;
  assignmentId: number | null;
  assignmentTitle: string;
  notes: string | null;
  expiresAt: string | null;
  questions: unknown[] | null;
  timePerQuestion: number | null;
  leaderboardDisplay: string | null;
  playCount: number;
  createdAt: string;
  isStandalone: boolean;
  isExpired: boolean;
  questionCount: number;
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
  const [saving, setSaving] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

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
      const ld = chal.leaderboardDisplay ?? "top20";
      setEditLd(["top3","top20","all"].includes(ld) ? ld : "top20");
      setEditExpires(
        chal.expiresAt ? new Date(chal.expiresAt).toISOString().slice(0, 16) : ""
      );
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
          <div className="p-4 space-y-4">
            {/* Notes */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                <FileText className="w-3.5 h-3.5" />
                ملاحظات تظهر قبل المسابقة
              </label>
              <textarea
                value={editNotes}
                onChange={e => { setEditNotes(e.target.value); mark(); }}
                placeholder="تعليمات أو رسالة للاعبين..."
                rows={2}
                maxLength={1000}
                className="w-full px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:border-amber-500 text-sm resize-none"
              />
            </div>

            {/* Time per question */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                <Clock className="w-3.5 h-3.5" />
                وقت كل سؤال: <span className="text-foreground font-bold">{editTime} ثانية</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={5} max={120} step={5}
                  value={editTime}
                  onChange={e => { setEditTime(Number(e.target.value)); mark(); }}
                  className="flex-1 accent-amber-500"
                />
                <div className="flex gap-1">
                  {[10, 20, 30, 60].map(t => (
                    <button
                      key={t}
                      onClick={() => { setEditTime(t); mark(); }}
                      className={cn(
                        "px-2 py-1 rounded-lg text-xs font-bold transition-colors",
                        editTime === t ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Leaderboard display */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                <Trophy className="w-3.5 h-3.5" />
                عرض لوحة المتصدرين
              </label>
              <div className="flex gap-2">
                {[
                  { value: "top3", label: "أفضل 3 فقط" },
                  { value: "top20", label: "أفضل 20" },
                  { value: "all", label: "جميع اللاعبين" },
                ].map(o => (
                  <button
                    key={o.value}
                    onClick={() => { setEditLd(o.value as any); mark(); }}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-colors",
                      editLd === o.value
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "border-border text-muted-foreground hover:border-amber-400",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiry */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-1.5">
                <Calendar className="w-3.5 h-3.5" />
                موعد انتهاء المسابقة
              </label>
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={editExpires}
                  onChange={e => { setEditExpires(e.target.value); mark(); }}
                  className="flex-1 px-3 py-2 rounded-xl bg-muted border border-border focus:outline-none focus:border-amber-500 text-sm"
                />
                {editExpires && (
                  <button
                    onClick={() => { setEditExpires(""); mark(); }}
                    className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    إزالة
                  </button>
                )}
              </div>
            </div>

            {settingsDirty && (
              <button
                onClick={saveSettings}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </button>
            )}
          </div>
        </div>

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
