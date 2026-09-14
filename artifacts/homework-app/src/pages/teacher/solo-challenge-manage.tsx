/**
 * /teacher/solo-challenges/:slug
 * إدارة مسابقة مسابقة ذاتية — إعدادات، كشف اللاعبين، الحذف
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, ChevronLeft, ChevronRight, Copy, Share2, ExternalLink, Users, Clock,
  Trophy, FileText, Calendar, CheckCircle, XCircle, Trash2,
  Loader2, Check, Save, Edit3, BarChart2, Medal, RotateCw, Volume2, VolumeX, Music, AlertCircle, Settings, Gamepad2, ShieldAlert, Search, Download
} from "lucide-react";
import AudioPicker from "@/components/AudioPicker";
import { QRModalButton } from "@/components/game-qr-code";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

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
  const { t, dir, lang } = useI18n();
  const s = t.soloChallenges;
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
  const [participantSearch, setParticipantSearch] = useState("");

  // Questions editor (standalone only)
  const [editQuestions, setEditQuestions] = useState<SoloQuestion[]>([]);
  const [expandedAudio, setExpandedAudio] = useState<number | null>(null);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [questionsDirty, setQuestionsDirty] = useState(false);

  // Dashboard layout tabs
  type TabType = "overview" | "settings" | "questions" | "leaderboard" | "danger";
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [chalRes, partRes] = await Promise.all([
        fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug)}/teacher`, { credentials: "include" }),
        fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug)}/participants`, { credentials: "include" }),
      ]);
      if (chalRes.status === 401 || chalRes.status === 403) { setLocation("/login"); return; }
      if (!chalRes.ok) { toast.error(s.emptyTitle); setLocation("/teacher/solo-challenges"); return; }
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
      if (Array.isArray(chal.questions)) {
        setEditQuestions(chal.questions as SoloQuestion[]);
      }
    } catch {
      toast.error(s.loadError);
    } finally {
      setLoading(false);
    }
  }, [slug, s.emptyTitle, s.loadError, setLocation]);

  useEffect(() => {
    if (!authLoading && !user) { setLocation("/login"); return; }
    if (user) load();
  }, [user, authLoading, load, setLocation]);

  useEffect(() => {
    if (!settingsDirty && !questionsDirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [settingsDirty, questionsDirty]);

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
      toast.success(t.common.saved);
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
      toast.error(err.message || t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const deleteChallenge = async () => {
    if (!challenge) return;
    if (!confirm(s.deleteConfirm.replace("{title}", challenge.assignmentTitle))) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/solo-challenges/${encodeURIComponent(slug!)}/`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast.success(s.deleted);
      setLocation("/teacher/solo-challenges");
    } catch {
      toast.error(s.deleteFailed);
      setDeleting(false);
    }
  };

  const deleteParticipant = async (participant: Participant) => {
    if (!confirm(`${s.delete} "${participant.playerName}"?`)) return;
    setDeletingParticipantId(participant.id);
    try {
      const res = await fetch(
        `${API}/api/solo-challenges/${encodeURIComponent(slug!)}/participants/${participant.id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message);
      setParticipants(prev => prev.filter(p => p.id !== participant.id));
      toast.success(s.participantDeleted);
    } catch (err: any) {
      toast.error(err.message || s.deleteFailed);
    } finally {
      setDeletingParticipantId(null);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/solo/${slug}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success(s.linkCopied);
  };

  const shareWA = () => {
    if (!challenge) return;
    const url = `${window.location.origin}/solo/${slug}`;
    const text = `${s.shareText.replace("{title}", challenge.assignmentTitle)}\n${url}`;
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
      toast.success(s.questionsSaved);
      setQuestionsDirty(false);
      setExpandedAudio(null);
      setChallenge(prev => prev ? { ...prev, questions: editQuestions, questionCount: editQuestions.length } : prev);
    } catch (err: any) {
      toast.error(err.message || s.saveQuestionsFailed);
    } finally {
      setSavingQuestions(false);
    }
  };

  const updateQuestionAudio = (idx: number, audioUrl: string | null) => {
    setEditQuestions(qs => qs.map((q, i) => i === idx ? { ...q, audioUrl: audioUrl ?? undefined } : q));
    setQuestionsDirty(true);
  };

  const updateQuestionField = <K extends keyof SoloQuestion>(idx: number, field: K, value: SoloQuestion[K]) => {
    setEditQuestions(qs => qs.map((q, i) => i === idx ? { ...q, [field]: value } : q));
    setQuestionsDirty(true);
  };

  const handleGlobalSave = async () => {
    if (settingsDirty) await saveSettings();
    if (questionsDirty) await saveQuestions();
  };

  const leaveControlCenter = () => {
    if ((settingsDirty || questionsDirty) && !window.confirm(
      lang === "ar" ? "لديك تغييرات غير محفوظة. هل تريد المغادرة؟" : "You have unsaved changes. Leave anyway?",
    )) return;
    setLocation("/teacher/solo-challenges");
  };

  const openAssignmentQuestionEditor = () => {
    if (!challenge?.assignmentId || !slug) return;
    if ((settingsDirty || questionsDirty) && !window.confirm(
      lang === "ar" ? "لديك تغييرات غير محفوظة. هل تريد فتح محرر الواجب؟" : "You have unsaved changes. Open the assignment editor anyway?",
    )) return;
    const returnTo = `/teacher/solo-challenges/${encodeURIComponent(slug)}`;
    setLocation(`/teacher/assignment/${challenge.assignmentId}?edit=1&tab=questions&returnTo=${encodeURIComponent(returnTo)}`);
  };

  const exportParticipantsCsv = () => {
    const escapeCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const rows = [
      ["Rank", "Player", "Points", "Correct", "Time (seconds)", "Played at"],
      ...participants.map((participant, index) => [
        index + 1,
        participant.playerName,
        participant.score,
        participant.correctCount,
        participant.timeTaken ?? "",
        participant.playedAt,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${challenge?.assignmentTitle || "solo-challenge"}-results.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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
  const challengeQrUrl = `${window.location.origin}/solo/${encodeURIComponent(slug!)}`;

  // Use the active language for icon direction, rather than the inherited
  // document direction, so the Arabic back affordance is always ">".
  const BackIcon = lang === "ar" ? ChevronRight : ChevronLeft;
  const isAnyDirty = settingsDirty || questionsDirty;
  const normalizedSearch = participantSearch.trim().toLocaleLowerCase(lang === "ar" ? "ar" : "en");
  const filteredParticipants = normalizedSearch
    ? participants.filter((participant) => participant.playerName.toLocaleLowerCase(lang === "ar" ? "ar" : "en").includes(normalizedSearch))
    : participants;

  const tabs = [
    { id: "overview", label: lang === "ar" ? "نظرة عامة ومشاركة" : "Overview & Share", icon: Share2 },
    { id: "settings", label: lang === "ar" ? "إعدادات المسابقة" : "Settings", icon: Settings },
    { id: "questions", label: lang === "ar" ? "الأسئلة" : "Questions", icon: FileText, count: challenge.questionCount },
    { id: "leaderboard", label: lang === "ar" ? "لوحة المتصدرين" : "Leaderboard", icon: Trophy, count: participants.length },
    { id: "danger", label: lang === "ar" ? "منطقة الخطر" : "Danger Zone", icon: ShieldAlert, danger: true },
  ];

  return (
    <div className="min-h-[100dvh] bg-muted/20" dir={dir}>
      {/* Header */}
      <div className="border-b border-border/60 bg-card/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <button type="button" onClick={leaveControlCenter} className="p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-muted-foreground group shrink-0" aria-label={lang === "ar" ? "العودة إلى المسابقات" : "Back to challenges"}>
              <BackIcon className={cn("w-5 h-5 transition-transform", lang === "ar" ? "group-hover:translate-x-1" : "group-hover:-translate-x-1")} />
            </button>
            <div className="min-w-0">
              <h1 className="font-black text-foreground text-lg md:text-xl truncate tracking-tight">{challenge.assignmentTitle}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border",
                  challenge.isExpired ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                )}>
                  {challenge.isExpired ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                  {challenge.isExpired ? s.expired : s.active}
                </span>
                {challenge.isStandalone && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    <Target className="w-3 h-3" />{s.standalone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 pb-32">
        <div className="flex flex-col md:flex-row gap-8">

          {/* Sidebar Navigation */}
          <aside className="md:w-64 shrink-0">
            <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 hide-scrollbar scroll-smooth">
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    data-testid={`tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all shrink-0 md:shrink border",
                      isActive
                        ? (tab.danger ? "bg-red-500 text-white border-red-500 shadow-md" : "bg-primary text-primary-foreground border-primary shadow-md")
                        : "bg-card border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <tab.icon className={cn("w-5 h-5", !isActive && tab.danger ? "text-red-500" : "")} />
                      <span className={cn(!isActive && tab.danger ? "text-red-500" : "")}>{tab.label}</span>
                    </div>
                    {tab.count !== undefined && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black border ltr:ml-4 rtl:mr-4",
                        isActive
                          ? "bg-white/20 border-white/10 text-white"
                          : "bg-primary/10 border-primary/20 text-primary"
                      )}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">

              {/* 1. Overview Tab */}
              {activeTab === "overview" && (
                <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { icon: Users, label: s.totalPlays, value: challenge.playCount, color: "text-primary bg-primary/10 border-primary/20" },
                      { icon: BarChart2, label: s.questions, value: challenge.questionCount, color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
                      { icon: Trophy, label: s.leaders, value: participants[0]?.playerName ?? "—", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", textSmall: true },
                    ].map(st => (
                      <div key={st.label} className="bg-card border border-border/60 rounded-3xl p-6 text-center flex flex-col items-center shadow-sm">
                        <div className={`w-14 h-14 rounded-2xl ${st.color} border flex items-center justify-center mb-4 shadow-sm`}>
                          <st.icon className="w-7 h-7" />
                        </div>
                        <p className={cn("font-black text-foreground", st.textSmall ? "text-base md:text-lg truncate w-full px-2" : "text-3xl")}>{st.value}</p>
                        <p className="text-sm font-bold text-muted-foreground mt-1.5">{st.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Share Card */}
                  <div className="bg-card border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent rounded-3xl p-6 md:p-8 shadow-sm">
                    <div className="max-w-xl">
                      <h3 className="text-lg font-black text-foreground mb-2 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-primary" />
                        {s.copyLink}
                      </h3>
                      <p className="text-sm font-medium text-muted-foreground mb-6">
                        {lang === "ar" ? "شارك هذا الرابط مع طلابك للبدء في حل التحدي مباشرة عبر المنصة." : "Share this link with your students to start the challenge immediately."}
                      </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                      <div className="flex-1 min-w-0 bg-background rounded-2xl px-5 py-4 text-sm font-mono font-bold text-muted-foreground truncate border border-border/60 shadow-inner" dir="ltr">
                        {challengeUrl}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button data-testid="button-copy-link" onClick={copyLink} className="flex-1 md:flex-none px-5 py-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground transition-colors flex items-center justify-center gap-2 font-black text-sm shadow-md" title={s.copyLink}>
                          <Copy className="w-5 h-5" />
                          <span className="md:hidden">{s.copyLink}</span>
                        </button>
                        <button data-testid="button-share-wa" onClick={shareWA} className="flex-1 md:flex-none px-5 py-4 rounded-2xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] transition-colors flex items-center justify-center gap-2 font-black text-sm" title={s.shareWhatsApp}>
                          <Share2 className="w-5 h-5" />
                          <span className="md:hidden">{s.shareWhatsApp}</span>
                        </button>
                        <QRModalButton url={challengeQrUrl} pin="" label="" />
                        <a href={challengeUrl} target="_blank" rel="noopener noreferrer" className="px-5 py-4 rounded-2xl bg-muted/60 hover:bg-muted text-muted-foreground transition-colors flex items-center justify-center gap-2" title={s.openGameLink}>
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 2. Settings Tab */}
              {activeTab === "settings" && (
                <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">

                  {/* General Info */}
                  <section className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-base font-black text-foreground mb-6 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      {lang === "ar" ? "المعلومات العامة" : "General Information"}
                    </h3>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground">
                        {lang === "ar" ? "تعليمات وملاحظات للمشاركين" : "Instructions for Participants"}
                      </label>
                      <textarea
                        value={editNotes}
                        onChange={e => { setEditNotes(e.target.value); mark(); }}
                        placeholder={s.instructionsPlaceholder}
                        rows={3}
                        maxLength={1000}
                        className="w-full px-4 py-3 rounded-xl bg-muted/30 border border-border/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 text-sm resize-none text-foreground placeholder:text-muted-foreground transition-all"
                      />
                    </div>
                  </section>

                  {/* Game Mechanics */}
                  <section className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-base font-black text-foreground mb-6 flex items-center gap-2">
                      <Gamepad2 className="w-5 h-5 text-amber-500" />
                      {lang === "ar" ? "آليات اللعب" : "Game Mechanics"}
                    </h3>

                    <div className="space-y-4">
                      {/* Time Per Question */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-border/60 bg-muted/20 gap-4">
                         <div>
                           <div className="flex items-center gap-2 font-black text-sm text-foreground"><Clock className="w-4 h-4 text-amber-500" /> وقت كل سؤال</div>
                           <p className="text-xs font-medium text-muted-foreground mt-1">المدة المسموحة للإجابة على السؤال الواحد بالثواني</p>
                         </div>
                         <div className="flex items-center gap-1 bg-background rounded-xl border border-border/60 p-1 shadow-sm shrink-0">
                            <button onClick={() => { setEditTime(t => Math.max(5, t - 5)); mark(); }} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted font-black text-lg transition-colors">−</button>
                            <span className="w-16 text-center text-sm font-black tabular-nums">{editTime} {s.secondsShort}</span>
                            <button onClick={() => { setEditTime(t => Math.min(120, t + 5)); mark(); }} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted font-black text-lg transition-colors">+</button>
                         </div>
                      </div>

                      {/* Difficulty Distribution OR QPP */}
                      {editDiffDistribution ? (
                        <div className="p-4 rounded-2xl border border-border/60 bg-muted/20">
                           <div className="flex items-center justify-between mb-4">
                             <div>
                               <div className="flex items-center gap-2 font-black text-sm text-foreground"><Target className="w-4 h-4 text-primary" /> توزيع الصعوبة</div>
                               <p className="text-xs font-medium text-muted-foreground mt-1">{s.distributionHint}</p>
                             </div>
                             <button onClick={() => { setEditDiffDistribution(null); mark(); }} className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-bold hover:bg-muted text-muted-foreground transition-colors shrink-0">إلغاء التوزيع</button>
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                             {(['easy', 'medium', 'hard'] as const).map(k => (
                                <div key={k} className="bg-background rounded-xl p-3 border border-border/60 flex flex-col items-center gap-3 shadow-sm">
                                   <span className={cn("text-[11px] font-black px-3 py-1 rounded-md text-white w-full text-center", k === 'easy' ? 'bg-emerald-500' : k === 'medium' ? 'bg-amber-500' : 'bg-red-500')}>
                                      {k === 'easy' ? s.easy : k === 'medium' ? s.medium : s.hard}
                                   </span>
                                   <div className="flex items-center gap-2 w-full justify-center">
                                      <button onClick={() => { setEditDiffDistribution(d => d ? { ...d, [k]: Math.max(0, d[k] - 1) } : null); mark(); }} className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center font-black text-lg transition-colors hover:bg-muted/80">−</button>
                                      <span className="w-10 text-center font-black text-base">{editDiffDistribution[k]}</span>
                                      <button onClick={() => { setEditDiffDistribution(d => d ? { ...d, [k]: d[k] + 1 } : null); mark(); }} className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center font-black text-lg transition-colors hover:bg-muted/80">+</button>
                                   </div>
                                </div>
                             ))}
                           </div>
                           <div className="border-t border-border mt-4 pt-3 flex items-center justify-between px-2">
                             <span className="text-xs font-bold text-muted-foreground">{s.total}</span>
                             <span className="text-base font-black text-primary">{editDiffDistribution.easy + editDiffDistribution.medium + editDiffDistribution.hard} أسئلة</span>
                           </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-border/60 bg-muted/20 gap-4">
                           <div>
                             <div className="flex items-center gap-2 font-black text-sm text-foreground"><Target className="w-4 h-4 text-emerald-500" /> أسئلة لكل متسابق</div>
                             <p className="text-xs font-medium text-muted-foreground mt-1">عدد الأسئلة العشوائية التي ستظهر لكل طالب (اتركه فارغاً لعرض الكل)</p>
                           </div>
                           <div className="flex items-center gap-1 bg-background rounded-xl border border-border/60 p-1 shadow-sm shrink-0">
                              <button onClick={() => { if (editQpp === "" || (editQpp as number) <= 1) { setEditQpp(""); mark(); } else { setEditQpp((editQpp as number) - 1); mark(); } }} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted font-black text-lg transition-colors">−</button>
                              <span className="w-16 text-center text-sm font-black tabular-nums">{editQpp === "" ? s.all : String(editQpp)}</span>
                              <button onClick={() => { const next = (editQpp === "" ? 0 : (editQpp as number)) + 1; if (challenge.questionCount > 0 && next > challenge.questionCount) return; setEditQpp(next); mark(); }} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted font-black text-lg transition-colors">+</button>
                           </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Player Experience */}
                  <section className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-base font-black text-foreground mb-6 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      {lang === "ar" ? "تجربة اللاعب" : "Player Experience"}
                    </h3>

                    <div className="space-y-4">
                      {/* Attempts */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-border/60 bg-muted/20 gap-4">
                         <div>
                           <div className="flex items-center gap-2 font-black text-sm text-foreground"><RotateCw className="w-4 h-4 text-primary" /> المحاولات المسموحة</div>
                           <p className="text-xs font-medium text-muted-foreground mt-1">كم مرة يمكن للطالب إعادة التحدي لتحسين نتيجته؟</p>
                         </div>
                         <div className="flex items-center gap-1 bg-background rounded-xl border border-border/60 p-1 shadow-sm shrink-0">
                             {([1, 2, 0] as const).map(v => (
                               <button key={v} onClick={() => { setEditMaxAttempts(v); mark(); }}
                                 className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-colors", editMaxAttempts === v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
                               >
                                  {v === 1 ? s.attemptsOnce : v === 2 ? s.attemptsTwice : s.attemptsUnlimited}
                               </button>
                            ))}
                         </div>
                      </div>
                       {editMaxAttempts === 2 && (
                        <div className="ml-4 mr-4 p-4 bg-primary/5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between border border-primary/10 gap-3">
                            <span className="text-xs font-bold text-primary">{s.attemptsChoose}</span>
                        </div>
                      )}

                      {/* Leaderboard Display */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-border/60 bg-muted/20 gap-4">
                         <div>
                           <div className="flex items-center gap-2 font-black text-sm text-foreground"><Users className="w-4 h-4 text-emerald-500" /> عرض لوحة الشرف</div>
                           <p className="text-xs font-medium text-muted-foreground mt-1">من يظهر في لوحة الشرف بنهاية التحدي؟</p>
                         </div>
                         <div className="flex items-center gap-1 bg-background rounded-xl border border-border/60 p-1 shadow-sm shrink-0 flex-wrap sm:flex-nowrap">
                            {([{v: "top3", l: s.top3}, {v: "top20", l: s.top20}, {v: "all", l: s.all}] as const).map(o => (
                               <button key={o.v} onClick={() => { setEditLd(o.v); mark(); }}
                                 className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-colors flex-1 sm:flex-none whitespace-nowrap", editLd === o.v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}
                               >
                                 {o.l}
                               </button>
                            ))}
                         </div>
                      </div>
                    </div>
                  </section>

                  {/* Access & Security */}
                  <section className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-base font-black text-foreground mb-6 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      {lang === "ar" ? "الوصول والأمان" : "Access & Security"}
                    </h3>

                    <div className="space-y-4">
                      {/* Expiry */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-border/60 bg-muted/20 gap-4">
                         <div>
                           <div className="flex items-center gap-2 font-black text-sm text-foreground"><Clock className="w-4 h-4 text-amber-600" /> موعد الانتهاء</div>
                           <p className="text-xs font-medium text-muted-foreground mt-1">يُغلق التحدي تلقائياً بعد هذا الموعد ولن يقبل مشاركات جديدة.</p>
                         </div>
                         <div className="flex items-center gap-2 shrink-0">
                            <input type="datetime-local" dir="ltr" value={editExpires} onChange={e => { setEditExpires(e.target.value); mark(); }} className="text-sm font-bold px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 w-full md:w-auto" />
                            {editExpires && (
                               <button onClick={() => { setEditExpires(""); mark(); }} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors shrink-0"><XCircle className="w-5 h-5" /></button>
                            )}
                         </div>
                      </div>

                      {/* Class Restriction */}
                      <div className="p-4 rounded-2xl border border-border/60 bg-muted/20">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                           <div>
                             <div className="flex items-center gap-2 font-black text-sm text-foreground"><Users className="w-4 h-4 text-primary" /> تقييد بصفوف محددة</div>
                             <p className="text-xs font-medium text-muted-foreground mt-1">إذا لم تحدد أي صف، سيتمكن أي شخص لديه الرابط من الدخول.</p>
                           </div>
                           {editAllowedClasses.length > 0 && <span className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-black shadow-sm shrink-0">{editAllowedClasses.length} {lang === "ar" ? "صفوف محددة" : "Classes Selected"}</span>}
                         </div>

                         {teacherClasses.length === 0 ? (
                           <div className="bg-amber-500/10 text-amber-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2 border border-amber-500/20">
                             <AlertCircle className="w-5 h-5 shrink-0"/> لا توجد صفوف مضافة في حسابك. أضف صفوفاً من إعدادات الطلاب أولاً لتمكين التقييد.
                           </div>
                         ) : (
                           <div className="flex flex-wrap gap-2">
                             {teacherClasses.map(cls => {
                               const selected = editAllowedClasses.includes(cls);
                               return (
                                 <button key={cls} onClick={() => { setEditAllowedClasses(prev => selected ? prev.filter(c => c !== cls) : [...prev, cls]); mark(); }}
                                   className={cn("px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shadow-sm", selected ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground")}>
                                   {selected && <Check className="w-3.5 h-3.5" />} {cls}
                                 </button>
                               );
                             })}
                           </div>
                         )}
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}

              {/* 3. Questions Tab */}
              {activeTab === "questions" && (
                <motion.div key="questions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div className="bg-card border border-border/60 rounded-3xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between bg-muted/20 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Edit3 className="w-5 h-5 text-primary" />
                          <h2 className="font-black text-lg text-foreground">
                            {challenge.isStandalone ? (lang === "ar" ? "تحرير الأسئلة" : "Edit questions") : (lang === "ar" ? "أسئلة الواجب" : "Assignment Questions")}
                          </h2>
                        </div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {challenge.isStandalone
                            ? (lang === "ar" ? "افتح أي سؤال لتعديل نصه وخياراته وإجابته الصحيحة." : "Open any question to edit its text, choices, and correct answer.")
                            : (lang === "ar" ? "تُعدّل هذه الأسئلة من محرر الواجب الأساسي حتى تبقى الحماية وسجل النسخ فعالين." : "Edit these questions in the original assignment editor to preserve safeguards and revision history.")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        {!challenge.isStandalone && (
                          <button
                            type="button"
                            onClick={openAssignmentQuestionEditor}
                            className="text-xs font-bold text-white bg-primary hover:bg-primary/90 px-4 py-2 rounded-xl border border-primary flex items-center gap-1.5"
                            data-testid="button-edit-assignment-questions"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {lang === "ar" ? "فتح محرر الواجب" : "Open assignment editor"}
                          </button>
                        )}
                        {challenge.isStandalone && (
                          <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 shrink-0">
                            {editQuestions.length} {lang === "ar" ? "أسئلة" : "questions"}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="divide-y divide-border/30">
                      {(challenge.isStandalone ? editQuestions : (challenge.questions || [])).map((q, idx) => (
                        <div key={idx} className="hover:bg-muted/10 transition-colors">
                          {challenge.isStandalone ? (
                            <>
                              <button
                                data-testid={`button-edit-question-${idx}`}
                                onClick={() => setExpandedAudio(expandedAudio === idx ? null : idx)}
                                className="w-full flex items-center gap-4 px-6 py-4 text-start group"
                              >
                                <span className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-black text-primary shrink-0 border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                  {idx + 1}
                                </span>
                                <p dir="auto" className="flex-1 text-sm font-bold text-foreground line-clamp-2 text-start">{q.text}</p>
                                <Edit3 className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                              </button>
                              <AnimatePresence>
                                {expandedAudio === idx && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-4 sm:px-6 pb-6 pt-2 sm:ltr:ml-12 sm:rtl:mr-12">
                                      <div className="p-4 bg-background border border-border/60 rounded-2xl shadow-sm space-y-4">
                                        <div>
                                          <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "نص السؤال" : "Question text"}</label>
                                          <textarea
                                            value={q.text}
                                            onChange={(event) => updateQuestionField(idx, "text", event.target.value)}
                                            rows={2}
                                            dir="auto"
                                            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold resize-y"
                                          />
                                        </div>

                                        {q.questionType === "fill_blank" ? (
                                          <div>
                                            <label className="block text-xs font-bold text-muted-foreground mb-1.5">{lang === "ar" ? "الإجابة الصحيحة" : "Correct answer"}</label>
                                            <input
                                              value={q.correctAnswer}
                                              onChange={(event) => updateQuestionField(idx, "correctAnswer", event.target.value)}
                                              dir="auto"
                                              className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm font-bold"
                                            />
                                          </div>
                                        ) : (
                                          <div>
                                            <p className="text-xs font-bold text-muted-foreground mb-2">
                                              {q.questionType === "true_false"
                                                ? (lang === "ar" ? "حدد الإجابة الصحيحة" : "Select the correct answer")
                                                : (lang === "ar" ? "عدّل الخيارات وحدد الإجابة الصحيحة" : "Edit the choices and select the correct answer")}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              {(["A", "B", "C", "D"] as const)
                                                .slice(0, q.questionType === "true_false" ? 2 : 4)
                                                .map((letter) => {
                                                  const field = `option${letter}` as "optionA" | "optionB" | "optionC" | "optionD";
                                                  return (
                                                    <label key={letter} className={cn(
                                                      "flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
                                                      q.correctAnswer === letter ? "border-primary bg-primary/5" : "border-border bg-card",
                                                    )}>
                                                      <input
                                                        type="radio"
                                                        name={`correct-answer-${idx}`}
                                                        checked={q.correctAnswer === letter}
                                                        onChange={() => updateQuestionField(idx, "correctAnswer", letter)}
                                                      />
                                                      <span className="text-xs font-black text-primary">{letter}</span>
                                                      <input
                                                        value={q.questionType === "true_false"
                                                          ? (letter === "A" ? (lang === "ar" ? "صح" : "True") : (lang === "ar" ? "خطأ" : "False"))
                                                          : q[field]}
                                                        onChange={(event) => updateQuestionField(idx, field, event.target.value)}
                                                        readOnly={q.questionType === "true_false"}
                                                        dir="auto"
                                                        className={cn("min-w-0 flex-1 bg-transparent text-sm font-bold outline-none", q.questionType === "true_false" && "cursor-default")}
                                                        placeholder={lang === "ar" ? `الخيار ${letter}` : `Option ${letter}`}
                                                      />
                                                    </label>
                                                  );
                                                })}
                                            </div>
                                          </div>
                                        )}

                                        <details className="rounded-xl border border-border bg-muted/20">
                                          <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-muted-foreground">
                                            {lang === "ar" ? "إضافة صوت اختياري" : "Add optional audio"}
                                          </summary>
                                          <div className="p-3 border-t border-border">
                                            <AudioPicker
                                              value={q.audioUrl ?? null}
                                              onChange={(url) => updateQuestionAudio(idx, url)}
                                              uploadEndpoint="/api/solo-challenges/uploads/audio-url"
                                            />
                                          </div>
                                        </details>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          ) : (
                            <div className="w-full flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4 text-start">
                              <span className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-sm font-black text-muted-foreground shrink-0 border border-border/60">
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0 text-start">
                                <p dir="auto" className="text-sm font-bold text-foreground line-clamp-2">{q.text}</p>
                                <p className="text-[11px] font-medium text-muted-foreground mt-1.5 flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                  {lang === "ar" ? "الإجابة الصحيحة:" : "Correct Answer:"} <span className="font-bold text-emerald-600 mx-1">{q.correctAnswer}</span>
                                </p>
                              </div>
                              {q.audioUrl && (
                                <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                  <Volume2 className="w-3 h-3" /> {s.audio}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 4. Leaderboard Tab */}
              {activeTab === "leaderboard" && (
                <motion.div key="leaderboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-sm">
                     <div className="px-6 py-5 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <h2 className="font-black text-lg text-foreground">{s.participants}</h2>
                      </div>
                       <div className="flex items-center gap-2 w-full sm:w-auto">
                         <label className="relative flex-1 sm:w-56">
                           <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                           <input
                             value={participantSearch}
                             onChange={(event) => setParticipantSearch(event.target.value)}
                             placeholder={lang === "ar" ? "ابحث عن مشارك" : "Search participants"}
                             className="w-full h-10 ps-9 pe-3 rounded-xl border border-border bg-background text-sm font-medium"
                             data-testid="input-participant-search"
                           />
                         </label>
                         <button
                           type="button"
                           onClick={exportParticipantsCsv}
                           disabled={participants.length === 0}
                           className="h-10 px-3 rounded-xl border border-border bg-background hover:bg-muted disabled:opacity-40 inline-flex items-center gap-2 text-xs font-bold"
                           data-testid="button-export-participants"
                         >
                           <Download className="w-4 h-4" />
                           CSV
                         </button>
                       </div>
                    </div>

                    {participants.length === 0 ? (
                      <div className="px-6 py-20 text-center flex flex-col items-center">
                        <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-6 border border-border/60 shadow-sm">
                          <Users className="w-10 h-10 text-muted-foreground/40" />
                        </div>
                        <p className="text-base font-black text-foreground mb-2">{s.noParticipants}</p>
                        <p className="text-sm font-medium text-muted-foreground max-w-sm">{s.noParticipantsHint}</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                         {filteredParticipants.map((p) => {
                           const i = participants.findIndex((participant) => participant.id === p.id);
                           return (
                          <div key={p.id} className="flex flex-wrap sm:flex-nowrap items-center gap-4 px-6 py-4 hover:bg-muted/10 transition-colors">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 border shadow-sm",
                              i === 0 ? "bg-amber-100 border-amber-300 text-amber-600 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-500"
                              : i === 1 ? "bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-400/20 dark:border-slate-400/30 dark:text-slate-400"
                              : i === 2 ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-700/20 dark:border-orange-700/30 dark:text-orange-600"
                              : "bg-muted border-border/60 text-muted-foreground text-lg"
                            )}>
                              {i === 0 ? <Trophy className="w-6 h-6" /> : i < 3 ? <Medal className="w-6 h-6" /> : i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-black text-foreground truncate">{p.playerName}</p>
                              <p className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-2">
                                <Calendar className="w-3 h-3" />
                                {new Date(p.playedAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto shrink-0 justify-end mt-2 sm:mt-0">
                              <div className="text-end flex flex-col items-end gap-1">
                                <span className="text-sm font-black text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20 shadow-sm">
                                  {p.score.toLocaleString(lang)} {s.points}
                                </span>
                                <p className="text-[11px] font-bold text-muted-foreground">
                                  {p.correctCount}/{challenge.questionCount} صحيح • {fmtTime(p.timeTaken)}
                                </p>
                              </div>
                              <button
                                data-testid={`button-delete-participant-${p.id}`}
                                onClick={() => deleteParticipant(p)}
                                disabled={deletingParticipantId === p.id}
                                title={s.deleteParticipant}
                                className="p-3 rounded-xl text-red-500 hover:bg-red-500/10 hover:text-red-600 transition-colors disabled:opacity-50 border border-transparent hover:border-red-500/20"
                              >
                                {deletingParticipantId === p.id
                                  ? <Loader2 className="w-5 h-5 animate-spin" />
                                  : <Trash2 className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>
                           );
                         })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 5. Danger Zone Tab */}
              {activeTab === "danger" && (
                <motion.div key="danger" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                  <div className="bg-red-50 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30 rounded-3xl p-6 sm:p-8 shadow-sm">
                    <h3 className="font-black text-xl text-red-600 dark:text-red-400 flex items-center gap-3 mb-3">
                      <ShieldAlert className="w-7 h-7" />
                      {s.deleteChallenge}
                    </h3>
                    <p className="text-sm font-medium text-red-800/80 dark:text-red-300/80 mb-8 max-w-2xl leading-relaxed">
                      {lang === "ar"
                        ? "سيؤدي هذا إلى حذف الرابط وجميع نتائج اللاعبين بشكل دائم. لا يمكن استعادة البيانات بعد حذفها. تأكد من رغبتك في هذا الإجراء قبل المتابعة."
                        : "This will permanently delete the challenge and all player results. This action cannot be undone. Please be certain before proceeding."}
                    </p>
                    <button
                      data-testid="button-delete-challenge"
                      onClick={deleteChallenge}
                      disabled={deleting}
                      className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-black bg-red-600 text-white hover:bg-red-700 transition-all shadow-md hover:shadow-red-600/20 active:scale-95 disabled:opacity-50"
                    >
                      {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                      {lang === "ar" ? "نعم، احذف المسابقة نهائياً" : "Yes, delete challenge permanently"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Floating Save Bar */}
      <AnimatePresence>
        {isAnyDirty && (
          <motion.div
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 100, opacity: 0 }}
             className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] sm:w-auto"
          >
             <div className="bg-card border border-border shadow-2xl rounded-2xl sm:rounded-full px-5 sm:px-6 py-4 flex flex-col sm:flex-row items-center gap-4 w-full justify-between">
                <div className="flex items-center gap-3 text-sm font-black text-foreground">
                   <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                   </div>
                   {lang === "ar" ? "لديك تغييرات غير محفوظة" : "You have unsaved changes"}
                </div>
                <button
                   data-testid="button-save-all"
                   onClick={handleGlobalSave}
                   disabled={saving || savingQuestions}
                   className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-3 rounded-xl sm:rounded-full font-black text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
                >
                   {saving || savingQuestions ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                   {t.common.save}
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
