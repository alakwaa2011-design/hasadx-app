import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import { ArrowRight, ArrowLeft, Trash2, Users, Play, CheckCircle2, XCircle, Copy, Video, Clock, Star, GraduationCap, BarChart3, TrendingUp, Award, User, ExternalLink, Share2, Loader2, Radio, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface VideoLessonFull {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  videoUrl: string;
  videoType: string;
  targetClass: string | null;
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

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
    /youtube\.com\/shorts\/([^&\s?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
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

  const copyLink = () => {
    const base = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    navigator.clipboard.writeText(`${base}${basePath}/video/${id}`);
    toast.success(isAr ? "تم نسخ الرابط" : "Link copied");
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
              {lesson.isShared ? (isAr ? "مشارك ✓" : "Shared ✓") : (isAr ? "مشاركة" : "Share")}
            </Button>
            <Button onClick={copyLink} variant="outline" className="gap-2 py-1.5 px-3 h-auto">
              <Copy className="w-4 h-4" />
              {isAr ? "نسخ الرابط" : "Copy Link"}
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
              submissions.map((sub) => (
                <Card key={sub.id} className="p-4 hover:border-primary/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{sub.studentName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          {sub.studentClass && <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />{sub.studentClass}</span>}
                          <span>{new Date(sub.submittedAt).toLocaleString(locale)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
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
                        <p className="text-xs text-muted-foreground">{isAr ? "صحيح" : "correct"}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
