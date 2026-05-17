import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { ArrowRight, ArrowLeft, Trash2, Users, Play, CheckCircle2, XCircle, Copy, Video, GraduationCap, TrendingUp, Award, User, Share2, Loader2, Radio, Pencil, ChevronDown, ChevronUp, Download, QrCode, X, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { QRCodeSVG } from "qrcode.react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface VideoLessonFull {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  videoUrl?: string | null;
  videoType: string;
  targetClass: string | null;
  teacherClassId?: number | null;
  accessMode: string;
  accessCode: string | null;
  teacherId: number;
  isShared: boolean;
  createdAt: string;
  totalPoints: number;
  questions: {
    id: number;
    timestampSeconds: number;
    questionType: string;
    text: string;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
    correctAnswer: string | null;
    points: number;
  }[];
}

interface Submission {
  id: number;
  studentName: string;
  studentClass: string;
  score: number;
  earnedPoints: number;
  totalPoints: number;
  totalQuestions: number;
  correctAnswers: number;
  submittedAt: string;
}

interface SubmissionAnswerRow {
  id: number;
  videoQuestionId: number;
  selectedAnswer: string;
  isCorrect: boolean;
  questionText: string;
  questionType: string;
  correctAnswer: string | null;
  points: number;
  timestampSeconds: number;
}

interface SubmissionWithAnswers extends Submission {
  answers?: SubmissionAnswerRow[];
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function extractYouTubeId(url: string | null | undefined): string | null {
  if (url == null || typeof url !== "string") return null;
  const u = url.trim();
  if (!u) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];
  for (const p of patterns) {
    const m = u.match(p);
    if (m) return m[1];
  }
  return null;
}

function csvEscape(cell: string): string {
  const t = String(cell ?? "").replace(/"/g, '""');
  return `"${t}"`;
}

export default function VideoLessonDetail() {
  const [, params] = useRoute("/teacher/video-lesson/:id");
  const id = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const BackArrowIcon = isAr ? ArrowRight : ArrowLeft;
  const locale = isAr ? "ar-EG" : "en-US";

  const [lesson, setLesson] = useState<VideoLessonFull | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "submissions">("overview");
  const [expandedSubId, setExpandedSubId] = useState<number | null>(null);
  const [submissionDetails, setSubmissionDetails] = useState<Record<number, SubmissionWithAnswers>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/api/video-lessons/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setLesson(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`${API_BASE}/api/video-lessons/${id}/submissions`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setSubmissions(Array.isArray(data) ? data : []);
        setSubmissionsLoading(false);
      })
      .catch(() => setSubmissionsLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(isAr ? "هل تريد حذف هذا الدرس؟ سيتم حذف جميع الأسئلة والتسليمات." : "Delete this lesson? All questions and submissions will be removed.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/api/video-lessons/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast.success(isAr ? "تم حذف الدرس" : "Lesson deleted");
        setLocation("/teacher");
      } else {
        toast.error(isAr ? "خطأ في الحذف" : "Delete error");
      }
    } catch {
      toast.error(isAr ? "خطأ" : "Error");
    } finally {
      setDeleting(false);
    }
  };

  const toggleShare = async () => {
    if (!lesson) return;
    setSharingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/video-lessons/${id}/share`, { method: "PATCH", credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLesson({ ...lesson, isShared: data.isShared });
        toast.success(data.isShared ? (isAr ? "تم مشاركة الدرس" : "Lesson shared") : (isAr ? "تم إلغاء المشاركة" : "Sharing disabled"));
      } else {
        toast.error(isAr ? "فشل في تغيير حالة المشاركة" : "Failed to toggle sharing");
      }
    } catch {
      toast.error(isAr ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setSharingLoading(false);
    }
  };

  const shareUrl = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    let path = `${base}${basePath}/video/${id}`;
    if (lesson?.accessMode === "private" && lesson.accessCode?.trim()) {
      path += `?code=${encodeURIComponent(lesson.accessCode.trim())}`;
    }
    return path;
  }, [id, lesson?.accessMode, lesson?.accessCode]);

  const copyStudentLinkOnly = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
  };

  const copyStudentLinkAndOpenShareCard = () => {
    navigator.clipboard.writeText(shareUrl);
    setShareModalOpen(true);
    toast.success(
      isAr ? "تم نسخ الرابط — يمكنك مشاركة البطاقة مع الطلاب" : "Link copied — share the card with students",
    );
  };

  const copyAccessCodeOnly = () => {
    const code = lesson?.accessCode?.trim();
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(isAr ? "تم نسخ رمز الدخول" : "Access code copied");
  };

  const toggleSubmissionExpand = async (subId: number) => {
    if (expandedSubId === subId) {
      setExpandedSubId(null);
      return;
    }
    setExpandedSubId(subId);
    if (!submissionDetails[subId]) {
      setDetailLoadingId(subId);
      try {
        const r = await fetch(`${API_BASE}/api/video-lessons/${id}/submissions/${subId}`, { credentials: "include" });
        if (r.ok) {
          const data = (await r.json()) as SubmissionWithAnswers;
          setSubmissionDetails((prev) => ({ ...prev, [subId]: data }));
        }
      } finally {
        setDetailLoadingId(null);
      }
    }
  };

  const downloadSubmissionsCsv = async () => {
    if (!lesson || submissions.length === 0) return;
    setCsvDownloading(true);
    try {
      const details = await Promise.all(
        submissions.map(async (s) => {
          const cached = submissionDetails[s.id];
          if (cached?.answers && cached.answers.length > 0) return cached;
          const r = await fetch(`${API_BASE}/api/video-lessons/${id}/submissions/${s.id}`, { credentials: "include" });
          if (!r.ok) return { ...s, answers: [] as SubmissionAnswerRow[] };
          return r.json() as Promise<SubmissionWithAnswers>;
        }),
      );
      const headers = [
        "studentName",
        "studentClass",
        "scorePct",
        "earned",
        "total",
        "correct",
        "totalQuestions",
        "submittedAt",
        "questionOrder",
        "questionTime",
        "questionText",
        "selectedAnswer",
        "correctAnswer",
        "isCorrect",
        "points",
      ];
      const lines = [headers.join(",")];
      for (const row of details) {
        const ansList = row.answers && row.answers.length > 0 ? row.answers : [];
        if (ansList.length === 0) {
          lines.push(
            [
              csvEscape(row.studentName),
              csvEscape(row.studentClass),
              String(Math.round(row.score)),
              String(row.earnedPoints),
              String(row.totalPoints),
              String(row.correctAnswers),
              String(row.totalQuestions),
              csvEscape(row.submittedAt),
              "",
              "",
              "",
              "",
              "",
              "",
              "",
            ].join(","),
          );
          continue;
        }
        for (let i = 0; i < ansList.length; i++) {
          const a = ansList[i];
          lines.push(
            [
              csvEscape(row.studentName),
              csvEscape(row.studentClass),
              String(Math.round(row.score)),
              String(row.earnedPoints),
              String(row.totalPoints),
              String(row.correctAnswers),
              String(row.totalQuestions),
              csvEscape(row.submittedAt),
              String(i + 1),
              formatTimestamp(a.timestampSeconds),
              csvEscape(a.questionText),
              csvEscape(a.selectedAnswer),
              csvEscape(a.correctAnswer || ""),
              a.isCorrect ? "1" : "0",
              String(a.points),
            ].join(","),
          );
        }
      }
      const bom = "\uFEFF";
      const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-lesson-${id}-report.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isAr ? "تم تنزيل التقرير" : "Report downloaded");
    } catch {
      toast.error(isAr ? "فشل التنزيل" : "Download failed");
    } finally {
      setCsvDownloading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center p-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!lesson) {
    return (
      <Layout>
        <div className="text-center p-20">{isAr ? "درس غير موجود" : "Lesson not found"}</div>
      </Layout>
    );
  }

  const youtubeId = extractYouTubeId(lesson.videoUrl);
  const avgScore = submissions.length > 0 ? Math.round(submissions.reduce((s, sub) => s + sub.score, 0) / submissions.length) : 0;
  const highScore = submissions.length > 0 ? Math.round(Math.max(...submissions.map((s) => s.score))) : 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <button
          onClick={() => setLocation("/teacher")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold mb-6 transition-colors"
        >
          <BackArrowIcon className="w-5 h-5" />
          {isAr ? "العودة للوحة التحكم" : "Back to Dashboard"}
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-red-500/10 rounded-2xl shrink-0">
              <Video className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">{lesson.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                {lesson.subject && <span className="font-bold">{lesson.subject}</span>}
                {lesson.targetClass && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {lesson.targetClass}
                  </span>
                )}
                <span>{new Date(lesson.createdAt).toLocaleDateString(locale)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              onClick={() => setLocation(`/teacher/video-lesson/${id}/live`)}
              className="gap-2 py-1.5 px-3 h-auto bg-red-500 hover:bg-red-600 text-white"
            >
              <Radio className="w-4 h-4" />
              {isAr ? "بث مباشر" : "Go Live"}
            </Button>
            <Button
              onClick={() => setLocation(`/teacher/create-video-lesson?edit=${id}`)}
              variant="outline"
              className="gap-2 py-1.5 px-3 h-auto"
            >
              <Pencil className="w-4 h-4" />
              {isAr ? "تعديل" : "Edit"}
            </Button>
            <Button
              onClick={toggleShare}
              disabled={sharingLoading}
              variant="outline"
              className={`gap-2 py-1.5 px-3 h-auto ${lesson.isShared ? "text-teal-600 border-teal-300 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-700" : ""}`}
            >
              {sharingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              {lesson.isShared ? (isAr ? "مشاركة المعلمين ✓" : "Teachers’ share ✓") : (isAr ? "مشاركة المعلمين" : "Teachers’ share")}
            </Button>
            <Button onClick={copyStudentLinkAndOpenShareCard} variant="outline" className="gap-2 py-1.5 px-3 h-auto">
              <Copy className="w-4 h-4" />
              {isAr ? "نسخ الرابط" : "Copy link"}
            </Button>
            <Button onClick={handleDelete} variant="outline" disabled={deleting} className="gap-2 py-1.5 px-3 h-auto text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
              {isAr ? "حذف" : "Delete"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-4 bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-xl text-red-500"><Play className="w-5 h-5" /></div>
              <div>
                <p className="text-xs font-bold text-muted-foreground">{isAr ? "الأسئلة" : "Questions"}</p>
                <p className="text-xl font-black">{lesson.questions.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl text-blue-500"><Users className="w-5 h-5" /></div>
              <div>
                <p className="text-xs font-bold text-muted-foreground">{isAr ? "التسليمات" : "Submissions"}</p>
                <p className="text-xl font-black">{submissions.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-xl text-green-500"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-xs font-bold text-muted-foreground">{isAr ? "متوسط النتيجة" : "Avg Score"}</p>
                <p className="text-xl font-black">{avgScore}%</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-xl text-yellow-500"><Award className="w-5 h-5" /></div>
              <div>
                <p className="text-xs font-bold text-muted-foreground">{isAr ? "أعلى نتيجة" : "High Score"}</p>
                <p className="text-xl font-black">{highScore}%</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex gap-1 p-1 bg-muted/50 rounded-xl mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
              activeTab === "overview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Video className="w-4 h-4" />
            {isAr ? "نظرة عامة" : "Overview"}
          </button>
          <button
            onClick={() => setActiveTab("submissions")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
              activeTab === "submissions" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" />
            {isAr ? "التسليمات" : "Submissions"} ({submissions.length})
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {lesson.videoUrl && (
                <Card className="overflow-hidden">
                  <div className="aspect-video">
                    {lesson.videoType === "youtube" && youtubeId ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      />
                    ) : (
                      <video
                        src={lesson.videoUrl}
                        controls
                        className="w-full h-full"
                      />
                    )}
                  </div>
                </Card>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Play className="w-5 h-5 text-red-500" />
                {isAr ? "الأسئلة التفاعلية" : "Interactive Questions"} ({lesson.questions.length})
              </h2>
              {lesson.questions.map((q, idx) => (
                <Card key={q.id} className={`p-4 ${isAr ? "border-r-4 border-r-red-500/50" : "border-l-4 border-l-red-500/50"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs">{idx + 1}</span>
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded" dir="ltr">
                        {formatTimestamp(q.timestampSeconds)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">
                      {q.points} {isAr ? "نقطة" : "pt"} · {q.questionType === "mcq" ? (isAr ? "اختيار" : "MCQ") : q.questionType === "true_false" ? (isAr ? "صح/خطأ" : "T/F") : (isAr ? "فراغ" : "Fill")}
                    </span>
                  </div>
                  <p className="text-sm font-bold">{q.text}</p>
                  {q.correctAnswer && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-bold mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {isAr ? "الإجابة:" : "Answer:"} {q.correctAnswer}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "submissions" && (
          <div className="space-y-3">
            {submissionsLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : submissions.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-bold">{isAr ? "لا توجد تسليمات بعد" : "No submissions yet"}</p>
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 font-bold"
                    disabled={csvDownloading}
                    onClick={() => void downloadSubmissionsCsv()}
                  >
                    {csvDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isAr ? "تحميل تقرير CSV" : "Download CSV report"}
                  </Button>
                </div>
                {submissions.map((sub) => {
                  const expanded = expandedSubId === sub.id;
                  const detail = submissionDetails[sub.id];
                  const loadingDetail = detailLoadingId === sub.id;
                  return (
                    <Card key={sub.id} className="overflow-hidden hover:border-primary/30 transition-all">
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{sub.studentName}</p>
                            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                              {sub.studentClass && (
                                <span className="flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3" />
                                  {sub.studentClass}
                                </span>
                              )}
                              <span>{new Date(sub.submittedAt).toLocaleString(locale)}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                          <div className="text-center">
                            <p className={`text-xl font-black ${sub.score >= 80 ? "text-green-500" : sub.score >= 50 ? "text-yellow-500" : "text-destructive"}`}>
                              {Math.round(sub.score)}%
                            </p>
                            <p className="text-xs text-muted-foreground font-bold">
                              {sub.earnedPoints}/{sub.totalPoints}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-black text-foreground">{sub.correctAnswers}/{sub.totalQuestions}</p>
                            <p className="text-xs text-muted-foreground">{isAr ? "صحيح / الكل" : "correct / total"}</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="gap-1 font-bold h-9 px-2"
                            onClick={() => void toggleSubmissionExpand(sub.id)}
                          >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {isAr ? "التفاصيل" : "Details"}
                          </Button>
                        </div>
                      </div>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-border bg-muted/30"
                          >
                            <div className="p-4 space-y-3">
                              {loadingDetail ? (
                                <div className="flex justify-center py-6">
                                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                              ) : (
                                (detail?.answers ?? []).map((a, i) => (
                                  <div
                                    key={a.id}
                                    className={`rounded-xl border p-3 text-sm ${a.isCorrect ? "border-green-200 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20" : "border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"}`}
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2 font-black text-foreground">
                                        <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
                                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded" dir="ltr">{formatTimestamp(a.timestampSeconds)}</span>
                                        {a.isCorrect ? (
                                          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                                        ) : (
                                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                        )}
                                      </div>
                                      <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">{a.points} {isAr ? "نقطة" : "pts"}</span>
                                    </div>
                                    <p className="font-bold text-foreground mb-2">{a.questionText}</p>
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-bold">{isAr ? "إجابة الطالب:" : "Student:"}</span>{" "}
                                      <span className="font-semibold text-foreground">{a.selectedAnswer}</span>
                                    </p>
                                    {!a.isCorrect && a.correctAnswer != null && (
                                      <p className="text-xs text-green-700 dark:text-green-400 font-bold mt-1">
                                        {isAr ? "الصحيح:" : "Correct:"} {a.correctAnswer}
                                      </p>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}

        {shareModalOpen && lesson && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShareModalOpen(false)}
            dir={isAr ? "rtl" : "ltr"}
          >
            <div
              className="bg-card rounded-2xl shadow-2xl border border-border max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 p-5 border-b border-border bg-gradient-to-br from-primary/10 via-transparent to-emerald-500/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-primary mb-1.5">
                    <QrCode className="w-5 h-5 shrink-0" />
                    <span className="text-[11px] font-black uppercase tracking-wide opacity-85">
                      {isAr ? "مشاركة مع الطلاب" : "Share with students"}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-foreground leading-snug">{lesson.title}</h2>
                  {lesson.targetClass && (
                    <p className="text-xs font-bold text-muted-foreground mt-1 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />
                      {lesson.targetClass}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(false)}
                  className="shrink-0 rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={isAr ? "إغلاق" : "Close"}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                {lesson.accessMode === "private" && lesson.accessCode?.trim() && (
                  <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 dark:bg-amber-950/35 dark:border-amber-800/60 p-4">
                    <div className="flex items-center gap-2 text-amber-950 dark:text-amber-100 font-black text-sm mb-3">
                      <KeyRound className="w-4 h-4" />
                      {isAr ? "رمز الدخول للدرس الخاص" : "Private lesson access code"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xl sm:text-2xl font-black tracking-[0.2em] text-foreground bg-background px-4 py-2.5 rounded-xl border shadow-sm">
                        {lesson.accessCode.trim()}
                      </span>
                      <Button type="button" variant="outline" className="gap-2 font-bold" onClick={copyAccessCodeOnly}>
                        <Copy className="w-4 h-4" />
                        {isAr ? "نسخ الرمز" : "Copy code"}
                      </Button>
                    </div>
                    <p className="text-[11px] text-amber-900/80 dark:text-amber-200/90 font-semibold mt-3 leading-relaxed">
                      {isAr
                        ? "الرابط أدناه يتضمن الرمز تلقائياً عند المسح. يمكن للطالب أيضاً إدخال الرمز يدوياً إن لزم."
                        : "The link below includes the code when scanned. Students can also enter the code manually if needed."}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2">{isAr ? "رابط الدرس للطلاب" : "Student lesson URL"}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs sm:text-sm font-mono text-foreground outline-none focus:ring-2 focus:ring-primary/25"
                      dir="ltr"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button type="button" variant="outline" className="gap-2 font-bold shrink-0" onClick={copyStudentLinkOnly}>
                      <Copy className="w-4 h-4" />
                      {isAr ? "نسخ الرابط" : "Copy URL"}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/20 py-5 px-4">
                  <p className="text-xs font-bold text-muted-foreground text-center">
                    {isAr ? "رمز QR — تصويره بالهاتف للدخول السريع" : "QR code — scan with a phone camera"}
                  </p>
                  <div className="rounded-2xl bg-white p-4 border shadow-inner dark:bg-white">
                    <QRCodeSVG value={shareUrl} size={200} level="M" includeMargin />
                  </div>
                </div>

                <Button type="button" className="w-full gap-2 font-black min-h-11" onClick={() => setShareModalOpen(false)}>
                  {isAr ? "تم" : "Done"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
