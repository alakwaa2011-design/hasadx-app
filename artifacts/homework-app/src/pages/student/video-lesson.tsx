import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import { Play, Pause, CheckCircle2, XCircle, Lock, GraduationCap, Users, AlertCircle, Star, Clock, Video, ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

interface YTPlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
}

interface YTWindow extends Window {
  YT?: {
    Player: new (elementId: string, config: Record<string, unknown>) => YTPlayer;
    PlayerState: { PLAYING: number };
  };
  onYouTubeIframeAPIReady?: () => void;
}

const ytWindow = window as unknown as YTWindow;

const API_BASE = import.meta.env.VITE_API_URL || "";

interface VideoQuestionData {
  id: number;
  timestampSeconds: number;
  questionType: string;
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  points: number;
}

interface SkipSegment {
  start: number;
  end: number;
}

interface LessonData {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  videoUrl: string;
  videoType: string;
  targetClass: string | null;
  accessMode: string;
  requiresCode?: boolean;
  questions: VideoQuestionData[];
  skipSegments: SkipSegment[];
  totalPoints: number;
}

interface SubmissionResult {
  studentName: string;
  studentClass: string;
  score: number;
  earnedPoints: number;
  totalPoints: number;
  totalQuestions: number;
  correctAnswers: number;
  answers: {
    questionId: number;
    selectedAnswer: string;
    isCorrect: boolean;
    questionText: string;
    correctAnswer: string | null;
    points: number;
    earnedPoints: number;
  }[];
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

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function StudentVideoLesson() {
  const [, params] = useRoute("/video/:id");
  const [, setLocation] = useLocation();
  const id = parseInt(params?.id || "0");
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const BackIcon = isAr ? ArrowLeft : ArrowRight;

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [studentId, setStudentId] = useState<number | null>(null);
  const [classStudents, setClassStudents] = useState<{ id: number; name: string; gradeLevel: string }[]>([]);
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [started, setStarted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [activeQuestion, setActiveQuestion] = useState<VideoQuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // answeredQuestions state is used only for UI rendering (progress bar, chips).
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  // Refs mirror the state so the polling interval can read them without being
  // listed as a dependency (avoids constant interval teardown/recreation).
  const answeredQsRef = useRef<Set<number>>(new Set());
  // Separate "triggered" ref — a question is triggered the moment the video
  // reaches its timestamp, preventing it from firing a second time.
  const triggeredQsRef = useRef<Set<number>>(new Set());

  const playerRef = useRef<YTPlayer | null>(null);
  const html5VideoRef = useRef<HTMLVideoElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const lastCheckedTime = useRef(-1);
  const activeQuestionRef = useRef<VideoQuestionData | null>(null);

  const isYoutube = lesson?.videoType === "youtube";
  const youtubeId = lesson?.videoUrl && isYoutube ? extractYouTubeId(lesson.videoUrl) : null;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    const codeParam = accessCode ? `?code=${encodeURIComponent(accessCode)}` : "";
    fetch(`${API_BASE}/api/video-lessons/${id}${codeParam}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          setError(r.status === 404
            ? (isAr ? "درس غير موجود" : "Lesson not found")
            : (isAr ? "خطأ في تحميل الدرس" : "Error loading lesson"));
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setLesson(data);
          setLoading(false);
        }
      })
      .catch(() => {
        setError(isAr ? "خطأ في تحميل الدرس" : "Error loading lesson");
        setLoading(false);
      });
  }, [id, accessCode]);

  useEffect(() => {
    if (!lesson?.targetClass) return;
    const codeParam = accessCode ? `?code=${encodeURIComponent(accessCode)}` : "";
    fetch(`${API_BASE}/api/video-lessons/${id}/class-students${codeParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setClassStudents(data);
          setStudentClass(lesson.targetClass || "");
        }
      })
      .catch(() => {});
  }, [lesson?.targetClass, id]);

  useEffect(() => {
    if (!started || !isYoutube || !youtubeId) return;

    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.id = "yt-iframe-api";
      document.head.appendChild(tag);
    }

    const initPlayer = () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
      }
      playerRef.current = new ytWindow.YT!.Player("yt-player-watch", {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: (event: { data: number }) => {
            if (event.data === 0) {
              setVideoEnded(true);
            }
          },
        },
      });
    };

    if (ytWindow.YT?.Player) {
      setTimeout(initPlayer, 100);
    } else {
      ytWindow.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
    };
  }, [started, youtubeId, isYoutube]);

  useEffect(() => {
    if (!started || isYoutube) return;
    const vid = html5VideoRef.current;
    if (!vid) return;
    const onReady = () => setPlayerReady(true);
    const onEnd = () => setVideoEnded(true);
    vid.addEventListener("canplay", onReady);
    vid.addEventListener("ended", onEnd);
    return () => {
      vid.removeEventListener("canplay", onReady);
      vid.removeEventListener("ended", onEnd);
    };
  }, [started, isYoutube, lesson?.videoUrl]);

  // Keep activeQuestionRef in sync with state so the interval can read it
  // without being listed as a dependency (avoids constant interval teardown).
  useEffect(() => { activeQuestionRef.current = activeQuestion; }, [activeQuestion]);

  useEffect(() => {
    if (!playerReady || !lesson?.questions) return;

    // 300 ms on mobile is more reliable than 500 ms when browsers throttle timers.
    const interval = setInterval(() => {
      // If a question is already visible, don't fire another one.
      if (activeQuestionRef.current) return;
      try {
        let time = 0;
        if (isYoutube) {
          time = Math.floor(playerRef.current?.getCurrentTime?.() || 0);
        } else {
          time = Math.floor(html5VideoRef.current?.currentTime || 0);
        }
        if (time === lastCheckedTime.current) return;
        lastCheckedTime.current = time;

        // Skip segments
        const segments = lesson.skipSegments || [];
        for (const seg of segments) {
          if (time >= seg.start && time < seg.end) {
            if (isYoutube) {
              playerRef.current?.seekTo?.(seg.end, true);
            } else if (html5VideoRef.current) {
              html5VideoRef.current.currentTime = seg.end;
            }
            lastCheckedTime.current = seg.end;
            return;
          }
        }

        // Fire the earliest un-triggered question whose timestamp has been reached.
        // No upper-bound window — once time >= timestamp and not yet triggered,
        // we show the question. This prevents questions being missed even when the
        // browser heavily throttles the interval (e.g. on low-end mobile).
        const sortedQ = [...lesson.questions].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
        for (const q of sortedQ) {
          if (triggeredQsRef.current.has(q.id)) continue;
          if (time >= q.timestampSeconds) {
            triggeredQsRef.current.add(q.id);
            if (isYoutube) {
              playerRef.current?.pauseVideo?.();
            } else {
              html5VideoRef.current?.pause();
            }
            setActiveQuestion(q);
            setSelectedAnswer("");
            break;
          }
        }
      } catch {}
    }, 300);

    return () => clearInterval(interval);
    // Stable deps — answeredQsRef / triggeredQsRef are refs, not state,
    // so this interval is created once and never torn down mid-session.
  }, [playerReady, lesson?.questions, lesson?.skipSegments, isYoutube]);

  const handleAnswerQuestion = () => {
    if (!activeQuestion || !selectedAnswer.trim()) return;
    answeredQsRef.current.add(activeQuestion.id);
    setAnsweredQuestions((prev) => new Set(prev).add(activeQuestion.id));
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: selectedAnswer }));
    setActiveQuestion(null);
    setSelectedAnswer("");
    setTimeout(() => {
      try {
        if (isYoutube) {
          playerRef.current?.playVideo?.();
        } else {
          html5VideoRef.current?.play();
        }
      } catch {}
    }, 300);
  };

  const handleSubmit = async () => {
    if (!lesson) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/video-lessons/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          studentName,
          studentClass,
          studentId: studentId || undefined,
          accessCode: accessCode || undefined,
          answers: Object.entries(answers).map(([qId, ans]) => ({
            questionId: parseInt(qId),
            selectedAnswer: ans,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Error");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : (isAr ? "خطأ في التسليم" : "Submission error");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (videoEnded && !result && lesson) {
      const allAnswered = lesson.questions.every((q) => answeredQuestions.has(q.id));
      if (allAnswered) {
        handleSubmit();
      }
    }
  }, [videoEnded]);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (error || !lesson) {
    return (
      <Layout>
        <div className="text-center p-20 text-xl font-bold">{error || (isAr ? "درس غير موجود" : "Lesson not found")}</div>
      </Layout>
    );
  }

  if (lesson.requiresCode && !lesson.questions) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-md">
          <Card className="p-8 text-center">
            <Lock className="w-16 h-16 text-primary/30 mx-auto mb-4" />
            <h2 className="text-xl font-black mb-2">{lesson.title}</h2>
            <p className="text-muted-foreground mb-6">{isAr ? "هذا الدرس يتطلب كود دخول" : "This lesson requires an access code"}</p>
            <Input
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder={isAr ? "أدخل كود الدخول" : "Enter access code"}
              dir="ltr"
              className="font-mono tracking-widest text-center text-lg mb-3"
            />
            {accessError && <p className="text-destructive text-sm font-bold mb-3">{accessError}</p>}
          </Card>
        </div>
      </Layout>
    );
  }

  if (result) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="p-8 text-center border-t-8 border-t-red-500 mb-8 overflow-hidden relative">
              <div className="inline-flex p-4 rounded-full bg-red-500/10 text-red-500 mb-4">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h1 className="text-3xl font-black mb-2">
                {isAr ? "أحسنت" : "Well done"} {result.studentName}!
              </h1>
              {result.studentClass && (
                <p className="text-muted-foreground mb-2 flex items-center justify-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  {result.studentClass}
                </p>
              )}
              <p className="text-muted-foreground mb-8">{isAr ? "تم تصحيح إجاباتك تلقائياً" : "Your answers were auto-graded"}</p>

              <div className="flex justify-center gap-6 sm:gap-12 mb-8">
                <div className="text-center">
                  <p className="text-sm font-bold text-muted-foreground mb-1">{isAr ? "الدرجة" : "Grade"}</p>
                  <p className="text-4xl font-black text-foreground">
                    {result.earnedPoints} <span className="text-lg text-muted-foreground">/ {result.totalPoints}</span>
                  </p>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center">
                  <p className="text-sm font-bold text-muted-foreground mb-1">{isAr ? "النسبة" : "Percentage"}</p>
                  <p className={`text-4xl font-black ${result.score >= 80 ? "text-green-500" : result.score >= 50 ? "text-yellow-500" : "text-destructive"}`}>
                    {Math.round(result.score)}%
                  </p>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center">
                  <p className="text-sm font-bold text-muted-foreground mb-1">{isAr ? "صحيح" : "Correct"}</p>
                  <p className="text-4xl font-black text-foreground">
                    {result.correctAnswers} <span className="text-lg text-muted-foreground">/ {result.totalQuestions}</span>
                  </p>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4">{isAr ? "تفاصيل الإجابات" : "Answer Details"}</h2>
              {result.answers.map((ans, i) => (
                <Card key={ans.questionId} className={`p-5 flex items-start gap-4 ${isAr ? "border-l-4" : "border-r-4"} ${ans.isCorrect ? (isAr ? "border-l-green-500" : "border-r-green-500") : (isAr ? "border-l-destructive" : "border-r-destructive")}`}>
                  <div className={`mt-1 shrink-0 ${ans.isCorrect ? "text-green-500" : "text-destructive"}`}>
                    {ans.isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold">{isAr ? "سؤال" : "Q"} {i + 1}: {ans.questionText}</p>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${ans.isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                        {ans.earnedPoints} / {ans.points}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{isAr ? "إجابتك:" : "Your answer:"} </span>
                      <span className={`font-bold ${ans.isCorrect ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                        {ans.selectedAnswer}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/">
                <Button variant="outline">{isAr ? "العودة للرئيسية" : "Back to Home"}</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (!started) {
    return (
      <Layout>
        <div className="bg-red-500 text-white py-10 md:py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10 mix-blend-multiply" />
          <div className="container relative z-10 mx-auto px-4 max-w-4xl">
            <Link href="/" className="inline-flex items-center gap-1 text-white/80 hover:text-white mb-6 text-sm font-semibold transition-colors">
              <BackIcon className="w-4 h-4" />
              {isAr ? "العودة" : "Back"}
            </Link>
            {lesson.subject && (
              <div className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-sm font-bold mb-4">
                {lesson.subject}
              </div>
            )}
            <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">{lesson.title}</h1>
            {lesson.description && <p className="text-white/80 text-lg max-w-2xl">{lesson.description}</p>}
            <div className="mt-6 flex items-center gap-4 text-sm font-medium flex-wrap">
              <span className="flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-lg">
                <Video className="w-4 h-4" /> {isAr ? "درس فيديو تفاعلي" : "Interactive Video"}
              </span>
              <span className="flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-lg">
                <Play className="w-4 h-4" /> {lesson.questions?.length || 0} {isAr ? "سؤال" : "questions"}
              </span>
              <span className="flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-lg">
                <Star className="w-4 h-4" /> {lesson.totalPoints} {isAr ? "نقطة" : "points"}
              </span>
              {lesson.targetClass && (
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-lg">
                  <GraduationCap className="w-4 h-4" /> {lesson.targetClass}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 max-w-4xl -mt-8 relative z-20">
          <Card className="p-6 md:p-8 shadow-2xl shadow-red-500/5">
            <div className="mb-8 space-y-4 max-w-lg">
              {classStudents.length > 0 ? (
                <div className="space-y-3">
                  <Label className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-red-500" />
                    {isAr ? "اختر اسمك من القائمة" : "Select your name"}
                  </Label>
                  <select
                    value={studentId ?? ""}
                    onChange={(e) => {
                      const sid = parseInt(e.target.value);
                      const found = classStudents.find((s) => s.id === sid);
                      if (found) {
                        setStudentId(found.id);
                        setStudentName(found.name);
                        setStudentClass(found.gradeLevel);
                      } else {
                        setStudentId(null);
                        setStudentName("");
                      }
                    }}
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">{isAr ? "— اختر اسمك —" : "— Select your name —"}</option>
                    {classStudents.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-lg">{isAr ? "اسم الطالب" : "Student Name"}</Label>
                    <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder={isAr ? "أدخل اسمك الكامل" : "Full name"} className="text-lg" />
                  </div>
                  <div>
                    <Label className="text-lg">{isAr ? "الفصل" : "Class"}</Label>
                    <Input value={studentClass} onChange={(e) => setStudentClass(e.target.value)} placeholder={isAr ? "مثال: 3/أ" : "e.g., 3/A"} className="text-lg" />
                  </div>
                </div>
              )}

              {accessError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {accessError}
                </div>
              )}
            </div>

            <Button
              onClick={() => {
                if (!studentName.trim()) {
                  toast.error(isAr ? "يرجى إدخال اسمك" : "Please enter your name");
                  return;
                }
                if (!studentClass.trim()) {
                  toast.error(isAr ? "يرجى إدخال الفصل" : "Please enter your class");
                  return;
                }
                setStarted(true);
              }}
              disabled={!studentName.trim() || !studentClass.trim()}
              className="w-full gap-2 py-3 text-lg font-black bg-red-500 hover:bg-red-600 text-white"
            >
              <Play className="w-6 h-6" />
              {isAr ? "ابدأ مشاهدة الدرس" : "Start Watching"}
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  const progress = lesson.questions.length > 0 ? (answeredQuestions.size / lesson.questions.length) * 100 : 0;
  const allAnswered = lesson.questions.every((q) => answeredQuestions.has(q.id));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              if (answeredQuestions.size > 0 && !result) {
                setShowExitConfirm(true);
              } else {
                setLocation("/");
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-sm font-bold transition-all shrink-0"
          >
            <BackIcon className="w-4 h-4" />
            {isAr ? "خروج" : "Exit"}
          </button>
          <h1 className="text-xl font-black text-foreground truncate flex-1">{lesson.title}</h1>
          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            {answeredQuestions.size}/{lesson.questions.length}
          </div>
        </div>

        {/* Exit confirmation dialog */}
        <AnimatePresence>
          {showExitConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setShowExitConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 16 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border"
                dir={isAr ? "rtl" : "ltr"}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-lg text-foreground">
                    {isAr ? "هل تريد المغادرة؟" : "Leave the lesson?"}
                  </h3>
                  <button onClick={() => setShowExitConfirm(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  {isAr
                    ? "لم تُكمل الدرس بعد. هل تريد الخروج وفقدان تقدمك؟"
                    : "You haven't finished the lesson. Your progress will be lost."}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-muted text-foreground font-bold hover:bg-muted/80 transition-colors text-sm"
                  >
                    {isAr ? "متابعة الدرس" : "Keep watching"}
                  </button>
                  <button
                    onClick={() => setLocation("/")}
                    className="flex-1 py-2.5 rounded-xl bg-destructive text-white font-bold hover:bg-destructive/90 transition-colors text-sm"
                  >
                    {isAr ? "خروج" : "Exit"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full bg-muted rounded-full h-2 mb-6">
          <div className="bg-red-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="relative">
          <div className="aspect-video bg-black rounded-xl overflow-hidden">
            {isYoutube ? (
              <div id="yt-player-watch" className="w-full h-full" />
            ) : (
              <video
                ref={html5VideoRef}
                src={lesson.videoUrl}
                controls
                className="w-full h-full"
              />
            )}
          </div>

          <AnimatePresence>
            {activeQuestion && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 rounded-xl"
              >
                <motion.div
                  initial={{ scale: 0.85, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.85, y: 20 }}
                  className="bg-card rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-border"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                      <Pause className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                      {formatTimestamp(activeQuestion.timestampSeconds)}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground ms-auto">
                      {activeQuestion.points} {isAr ? "نقطة" : "pt"}
                    </span>
                  </div>

                  <p className="text-lg font-black mb-4">{activeQuestion.text}</p>

                  {activeQuestion.questionType === "mcq" && (
                    <div className="grid grid-cols-1 gap-2 mb-4">
                      {(["A", "B", "C", "D"] as const).map((opt) => {
                        const optText = activeQuestion[`option${opt}` as keyof VideoQuestionData] as string | null;
                        if (!optText) return null;
                        return (
                          <button
                            key={opt}
                            onClick={() => setSelectedAnswer(opt)}
                            className={`p-3 rounded-xl border-2 text-start font-bold transition-all ${
                              selectedAnswer === opt
                                ? "border-red-500 bg-red-500/10 text-foreground"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            <span className="inline-flex w-7 h-7 rounded-lg bg-muted items-center justify-center text-xs font-bold me-2">{opt}</span>
                            {optText}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeQuestion.questionType === "true_false" && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={() => setSelectedAnswer("true")}
                        className={`p-4 rounded-xl border-2 font-bold text-center transition-all ${
                          selectedAnswer === "true" ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-border text-muted-foreground"
                        }`}
                      >
                        <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
                        {isAr ? "صح" : "True"}
                      </button>
                      <button
                        onClick={() => setSelectedAnswer("false")}
                        className={`p-4 rounded-xl border-2 font-bold text-center transition-all ${
                          selectedAnswer === "false" ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" : "border-border text-muted-foreground"
                        }`}
                      >
                        <XCircle className="w-6 h-6 mx-auto mb-1" />
                        {isAr ? "خطأ" : "False"}
                      </button>
                    </div>
                  )}

                  {activeQuestion.questionType === "fill_blank" && (
                    <div className="mb-4">
                      <Input
                        value={selectedAnswer}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        placeholder={isAr ? "اكتب إجابتك..." : "Type your answer..."}
                        className="text-lg font-bold"
                        autoFocus
                      />
                    </div>
                  )}

                  <Button
                    onClick={handleAnswerQuestion}
                    disabled={!selectedAnswer.trim()}
                    className="w-full gap-2 py-2.5 font-black bg-red-500 hover:bg-red-600 text-white"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isAr ? "تأكيد الإجابة" : "Submit Answer"}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {lesson.questions
              .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
              .map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => {
                    if (isYoutube) {
                      playerRef.current?.seekTo?.(q.timestampSeconds, true);
                    } else if (html5VideoRef.current) {
                      html5VideoRef.current.currentTime = q.timestampSeconds;
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    answeredQuestions.has(q.id)
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {answeredQuestions.has(q.id) && <CheckCircle2 className="w-3 h-3" />}
                  <span dir="ltr">{formatTimestamp(q.timestampSeconds)}</span>
                </button>
              ))}
          </div>

          {allAnswered && !result && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-2 py-2 px-4 h-auto font-black bg-red-500 hover:bg-red-600 text-white"
            >
              {submitting ? (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {isAr ? "إرسال الإجابات" : "Submit Answers"}
            </Button>
          )}
        </div>
      </div>
    </Layout>
  );
}
