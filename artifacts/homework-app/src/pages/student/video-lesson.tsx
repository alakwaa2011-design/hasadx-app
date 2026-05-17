import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import {
  Play,
  CheckCircle2,
  XCircle,
  Lock,
  GraduationCap,
  Users,
  AlertCircle,
  Video,
  ArrowRight,
  ArrowLeft,
  X,
  Loader2,
  Film,
  BadgeCheck,
  Sparkles,
  Clock,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface YTPlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration?: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
}

interface YTWindow extends Window {
  YT?: {
    Player: new (elementId: string | HTMLElement, config: Record<string, unknown>) => YTPlayer;
    PlayerState: { PLAYING: number; ENDED: number };
  };
  onYouTubeIframeAPIReady?: () => void;
}

const ytWindow = window as unknown as YTWindow;

/** Same-origin API root: use VITE_API_URL when set; otherwise prefix with Vite BASE_PATH so /api works under subpath deploys. */
function apiUrl(apiPath: string): string {
  const env = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  if (env) return `${env}${path}`;
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

const BRAND = "#1E4D35";
const PAGE_BG = "linear-gradient(165deg, #f6faf7 0%, #eef4ef 45%, #f3f7f4 100%)";
const CARD_BORDER = "rgba(30, 77, 53, 0.1)";
const CARD_SHADOW = "0 2px 16px rgba(15, 40, 28, 0.06)";
const TRANSITION = "transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]";

const FIELD_RTL =
  "text-right [direction:rtl] placeholder:text-right placeholder:text-muted-foreground";

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
  teacherClassId?: number | null;
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

function formatCorrectReveal(q: VideoQuestionData, raw: string | null | undefined): string {
  if (!raw) return "";
  const t = raw.trim();
  if (q.questionType === "mcq" && /^[ABCD]$/i.test(t)) {
    const letter = t.toUpperCase() as "A" | "B" | "C" | "D";
    const label = q[`option${letter}` as keyof VideoQuestionData] as string | null;
    return label ? `${letter}: ${label}` : t;
  }
  return t;
}

function normalizeMcqLetter(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  return /^[ABCD]$/.test(t) ? t : null;
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
  const [classStudents, setClassStudents] = useState<{ id: number; name: string }[]>([]);
  const [accessCode, setAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const [started, setStarted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [activeQuestion, setActiveQuestion] = useState<VideoQuestionData | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [answerFeedback, setAnswerFeedback] = useState<{
    isCorrect: boolean;
    earnedPoints: number;
    correctAnswer: string | null;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sessionEarned, setSessionEarned] = useState(0);

  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const answeredQsRef = useRef<Set<number>>(new Set());
  const triggeredQsRef = useRef<Set<number>>(new Set());

  const playerRef = useRef<YTPlayer | null>(null);
  const ytPlayerMountRef = useRef<HTMLDivElement>(null);
  const html5VideoRef = useRef<HTMLVideoElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const lastCheckedTime = useRef(-1);
  const activeQuestionRef = useRef<VideoQuestionData | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [playheadSec, setPlayheadSec] = useState(0);

  const isYoutube = lesson?.videoType === "youtube";
  const youtubeId = lesson?.videoUrl && isYoutube ? extractYouTubeId(lesson.videoUrl) : null;

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("code");
    if (p) setAccessCode(p.trim());
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    const codeParam = accessCode ? `?code=${encodeURIComponent(accessCode)}` : "";
    fetch(apiUrl(`/api/video-lessons/${id}${codeParam}`), { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          setError(
            r.status === 404
              ? isAr
                ? "درس غير موجود"
                : "Lesson not found"
              : isAr
                ? "خطأ في تحميل الدرس"
                : "Error loading lesson",
          );
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
    fetch(apiUrl(`/api/video-lessons/${id}/class-students${codeParam}`))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setClassStudents(data);
          if (lesson.targetClass) setStudentClass(lesson.targetClass);
        }
      })
      .catch(() => {});
  }, [lesson?.targetClass, lesson?.teacherClassId, id, accessCode]);

  useLayoutEffect(() => {
    if (!started || !isYoutube || !youtubeId) return;

    const mountEl = ytPlayerMountRef.current;
    if (!mountEl) return;

    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.id = "yt-iframe-api";
      document.head.appendChild(tag);
    }

    const initPlayer = () => {
      const el = ytPlayerMountRef.current;
      if (!el) return;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      setPlayerReady(false);
      el.innerHTML = "";

      playerRef.current = new ytWindow.YT!.Player(el, {
        videoId: youtubeId,
        playerVars: {
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
        },
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
      initPlayer();
    } else {
      ytWindow.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          /* ignore */
        }
        playerRef.current = null;
      }
      if (ytPlayerMountRef.current) {
        ytPlayerMountRef.current.innerHTML = "";
      }
      setPlayerReady(false);
    };
  }, [started, youtubeId, isYoutube]);

  useEffect(() => {
    if (!started || isYoutube) return;
    const vid = html5VideoRef.current;
    if (!vid) return;
    const onReady = () => setPlayerReady(true);
    const onEnd = () => setVideoEnded(true);
    const onMeta = () => {
      if (vid.duration && isFinite(vid.duration)) setDurationSec(Math.floor(vid.duration));
    };
    vid.addEventListener("canplay", onReady);
    vid.addEventListener("ended", onEnd);
    vid.addEventListener("loadedmetadata", onMeta);
    return () => {
      vid.removeEventListener("canplay", onReady);
      vid.removeEventListener("ended", onEnd);
      vid.removeEventListener("loadedmetadata", onMeta);
    };
  }, [started, isYoutube, lesson?.videoUrl]);

  useEffect(() => {
    if (!playerReady || !isYoutube) return;
    const t = setInterval(() => {
      try {
        const d = playerRef.current?.getDuration?.();
        if (typeof d === "number" && d > 0 && isFinite(d)) setDurationSec(Math.floor(d));
      } catch {
        /* ignore */
      }
    }, 800);
    return () => clearInterval(t);
  }, [playerReady, isYoutube]);

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  useEffect(() => {
    if (!playerReady || !lesson?.questions) return;

    const interval = setInterval(() => {
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
        setPlayheadSec(time);

        const segments = lesson.skipSegments || [];
        for (const seg of segments) {
          if (time >= seg.start && time < seg.end) {
            if (isYoutube) {
              playerRef.current?.seekTo?.(seg.end, true);
            } else if (html5VideoRef.current) {
              html5VideoRef.current.currentTime = seg.end;
            }
            lastCheckedTime.current = seg.end;
            setPlayheadSec(seg.end);
            return;
          }
        }

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
            setAnswerFeedback(null);
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }, 300);

    return () => clearInterval(interval);
  }, [playerReady, lesson?.questions, lesson?.skipSegments, isYoutube]);

  const resumePlayback = useCallback(() => {
    setTimeout(() => {
      try {
        if (isYoutube) {
          playerRef.current?.playVideo?.();
        } else {
          html5VideoRef.current?.play();
        }
      } catch {
        /* ignore */
      }
    }, 200);
  }, [isYoutube]);

  const verifyAnswer = async () => {
    if (!activeQuestion || !selectedAnswer.trim()) return;
    const rawQid = activeQuestion.id;
    const questionId = typeof rawQid === "number" ? rawQid : parseInt(String(rawQid), 10);
    if (!Number.isFinite(questionId) || questionId < 1) {
      toast.error(isAr ? "بيانات السؤال غير صالحة. أعد تحميل الصفحة." : "Invalid question data. Reload the page.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch(apiUrl(`/api/video-lessons/${id}/check-answer`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          questionId,
          selectedAnswer: selectedAnswer.trim(),
          accessCode: accessCode.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        code?: string;
        isCorrect?: boolean;
        earnedPoints?: number;
        correctAnswer?: string | null;
      } | null;
      if (!res.ok) {
        const classroomLeak =
          data?.code === "classroom_disabled" ||
          data?.code === "classroom_not_allowed" ||
          (typeof data?.message === "string" &&
            (data.message.includes("Google Classroom") || data.message.includes("كلاس روم")));
        const fallback =
          isAr
            ? data?.message?.trim()
              ? data.message
              : `تعذّر التحقق من الإجابة (رمز ${res.status}). حاول مجدداً.`
            : data?.message?.trim()
              ? data.message
              : `Could not verify answer (HTTP ${res.status}). Try again.`;
        toast.error(
          classroomLeak
            ? isAr
              ? "تعذّر التحقق من الإجابة. حاول مجدداً."
              : "Could not verify answer. Try again."
            : fallback,
        );
        return;
      }
      if (typeof data?.isCorrect !== "boolean") {
        toast.error(isAr ? "استجابة غير متوقعة من الخادم." : "Unexpected server response.");
        return;
      }
      const earnedPts = typeof data.earnedPoints === "number" ? data.earnedPoints : 0;
      setAnswerFeedback({
        isCorrect: data.isCorrect,
        earnedPoints: earnedPts,
        correctAnswer: data.correctAnswer ?? null,
      });
      if (data.isCorrect) setSessionEarned((s) => s + earnedPts);
    } catch {
      toast.error(
        isAr ? "تعذّر الاتصال بالخادم. تحقق من الشبكة." : "Could not reach the server. Check your connection.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const continueAfterFeedback = () => {
    if (!activeQuestion || !answerFeedback) return;
    answeredQsRef.current.add(activeQuestion.id);
    setAnsweredQuestions((prev) => new Set(prev).add(activeQuestion.id));
    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: selectedAnswer.trim() }));
    setActiveQuestion(null);
    setSelectedAnswer("");
    setAnswerFeedback(null);
    resumePlayback();
  };

  const handleSubmit = useCallback(async () => {
    if (!lesson) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/video-lessons/${id}/submit`), {
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
      const message = err instanceof Error ? err.message : isAr ? "خطأ في التسليم" : "Submission error";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }, [lesson, id, studentName, studentClass, studentId, accessCode, answers, isAr]);

  useEffect(() => {
    if (!videoEnded || result || !lesson) return;
    const allAnswered = lesson.questions.every((q) => answeredQuestions.has(q.id));
    if (allAnswered) void handleSubmit();
  }, [videoEnded, result, lesson, answeredQuestions, handleSubmit]);

  const timelineScale = useMemo(() => {
    if (!lesson?.questions?.length) return Math.max(durationSec, 120);
    const maxQ = Math.max(...lesson.questions.map((q) => q.timestampSeconds));
    return Math.max(durationSec, maxQ + 45, 90);
  }, [lesson?.questions, durationSec]);

  const sortedQs = useMemo(
    () => (lesson?.questions ? [...lesson.questions].sort((a, b) => a.timestampSeconds - b.timestampSeconds) : []),
    [lesson?.questions],
  );

  const approxMinutes = useMemo(() => {
    if (!lesson?.questions?.length) return Math.max(2, Math.ceil(durationSec / 60) || 3);
    const tail = Math.max(...lesson.questions.map((q) => q.timestampSeconds));
    return Math.max(2, Math.ceil((Math.max(tail + 90, durationSec)) / 60));
  }, [lesson?.questions, durationSec]);

  const seekTo = (seconds: number) => {
    if (isYoutube) {
      try {
        playerRef.current?.seekTo?.(seconds, true);
      } catch {
        /* ignore */
      }
    } else if (html5VideoRef.current) {
      html5VideoRef.current.currentTime = seconds;
    }
  };

  const thumbYoutubeId = youtubeId;
  const thumbUrl = thumbYoutubeId ? `https://img.youtube.com/vi/${thumbYoutubeId}/hqdefault.jpg` : null;

  if (loading) {
    return (
      <Layout>
        <div
          className="flex min-h-[50vh] items-center justify-center"
          style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
        >
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#1E4D35]/25 border-t-[#1E4D35]" />
        </div>
      </Layout>
    );
  }

  if (error || !lesson) {
    return (
      <Layout>
        <div
          className="min-h-[60vh] px-4 py-16 text-center text-lg font-black text-[#374151]"
          style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          {error || (isAr ? "درس غير موجود" : "Lesson not found")}
        </div>
      </Layout>
    );
  }

  if (lesson.requiresCode && !lesson.questions) {
    return (
      <Layout>
        <div
          className="min-h-[100dvh] overflow-x-hidden px-4 py-10"
          style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
          dir="rtl"
        >
          <div className="mx-auto max-w-md">
            <Link href="/" className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-[#64748B] hover:text-[#0f2918]">
              <BackIcon className="h-4 w-4" />
              {isAr ? "العودة" : "Back"}
            </Link>
            <Card className="border border-[#e8ece9] bg-white p-8 shadow-lg" style={{ borderRadius: "24px", boxShadow: CARD_SHADOW }}>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef5f0] text-[#1E4D35]">
                <Lock className="h-8 w-8" />
              </div>
              <h2 className="mb-2 text-center text-xl font-black text-[#0f2918]">{lesson.title}</h2>
              <p className="mb-6 text-center text-sm leading-relaxed text-[#64748B]">
                {isAr ? "هذا الدرس يتطلب كود دخول" : "This lesson requires an access code"}
              </p>
              <Label className="mb-2 block text-right text-xs font-bold text-[#64748B]">
                {isAr ? "رمز الدخول" : "Access code"}
              </Label>
              <Input
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder={isAr ? "أدخل الكود" : "Enter code"}
                dir="ltr"
                className={cn("mb-4 min-h-[52px] rounded-2xl border-2 text-center font-mono tracking-[0.25em]", TRANSITION)}
              />
              {accessError && (
                <p className="mb-3 text-center text-sm font-bold text-red-700/90">{accessError}</p>
              )}
              <p className="text-center text-[11px] text-[#94a3ab]">
                {isAr ? "سيتم تحميل الدرس تلقائياً عند إدخال الكود الصحيح." : "The lesson loads when the code matches."}
              </p>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  if (result) {
    return (
      <Layout>
        <div
          className="min-h-[100dvh] overflow-x-hidden px-4 py-10"
          style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="mx-auto max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div
                className="mb-8 overflow-hidden rounded-[28px] border bg-white p-8 text-center shadow-lg"
                style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <BadgeCheck className="h-9 w-9" strokeWidth={2.25} />
                </div>
                <h1 className="mb-2 text-2xl font-black text-[#0f2918] sm:text-3xl">
                  {isAr ? "أحسنت،" : "Great job,"} {result.studentName}!
                </h1>
                {result.studentClass && (
                  <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-[#64748B]">
                    <GraduationCap className="h-4 w-4" />
                    {result.studentClass}
                  </p>
                )}
                <p className="mb-8 text-sm text-[#64748B]">{isAr ? "إليك ملخص أدائك في الدرس" : "Here is your lesson summary"}</p>

                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                  <div>
                    <p className="mb-1 text-xs font-bold text-[#94a3ab]">{isAr ? "النقاط" : "Points"}</p>
                    <p className="text-3xl font-black tabular-nums text-[#1E4D35]">
                      {result.earnedPoints}{" "}
                      <span className="text-lg font-bold text-[#94a3ab]">/ {result.totalPoints}</span>
                    </p>
                  </div>
                  <div className="hidden h-12 w-px bg-[#e8ece9] sm:block" />
                  <div>
                    <p className="mb-1 text-xs font-bold text-[#94a3ab]">{isAr ? "النسبة" : "Score"}</p>
                    <p
                      className={cn(
                        "text-3xl font-black tabular-nums",
                        result.score >= 75 ? "text-emerald-700" : result.score >= 50 ? "text-amber-700" : "text-rose-700/90",
                      )}
                    >
                      {Math.round(result.score)}%
                    </p>
                  </div>
                  <div className="hidden h-12 w-px bg-[#e8ece9] sm:block" />
                  <div>
                    <p className="mb-1 text-xs font-bold text-[#94a3ab]">{isAr ? "صحيح" : "Correct"}</p>
                    <p className="text-3xl font-black tabular-nums text-[#0f2918]">
                      {result.correctAnswers}{" "}
                      <span className="text-lg font-bold text-[#94a3ab]">/ {result.totalQuestions}</span>
                    </p>
                  </div>
                </div>
              </div>

              <h2 className="mb-4 text-lg font-black text-[#0f2918]">{isAr ? "تفاصيل الإجابات" : "Answer breakdown"}</h2>
              <div className="space-y-3">
                {result.answers.map((ans, i) => (
                  <Card
                    key={ans.questionId}
                    className={cn(
                      "border p-5 text-right shadow-sm",
                      ans.isCorrect ? "border-emerald-200/80 bg-emerald-50/35" : "border-rose-200/70 bg-rose-50/30",
                    )}
                    style={{ borderRadius: "20px" }}
                  >
                    <div className="flex gap-3">
                      <div className="shrink-0 pt-0.5">
                        {ans.isCorrect ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        ) : (
                          <XCircle className="h-6 w-6 text-rose-600/85" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                          <p className="font-bold leading-snug text-[#0f2918]">
                            {isAr ? "سؤال" : "Q"} {i + 1}: {ans.questionText}
                          </p>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums",
                              ans.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800",
                            )}
                          >
                            {ans.earnedPoints} / {ans.points}
                          </span>
                        </div>
                        <p className="text-sm text-[#64748B]">
                          <span className="font-semibold">{isAr ? "إجابتك:" : "Your answer:"}</span>{" "}
                          <span className={cn("font-black", ans.isCorrect ? "text-emerald-800" : "text-rose-800/90")}>
                            {ans.selectedAnswer}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="mt-10 text-center">
                <Link href="/">
                  <Button variant="outline" className="min-h-[48px] rounded-2xl border-2 px-8 font-black">
                    {isAr ? "العودة للرئيسية" : "Back to home"}
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!started) {
    return (
      <Layout>
        <div
          className="min-h-[100dvh] overflow-x-hidden pb-12"
          style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
          dir="rtl"
        >
          <div className="mx-auto max-w-3xl px-4 pt-8">
            <Link
              href="/"
              className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-[#64748B] transition-colors hover:text-[#1E4D35]"
            >
              <BackIcon className="h-4 w-4 opacity-70" />
              {isAr ? "العودة" : "Back"}
            </Link>

            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[28px] border bg-white shadow-lg"
              style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0f2918]">
                {thumbUrl ? (
                  <>
                    <img src={thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-85" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f2918]/85 via-[#0f2918]/25 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1E4D35] via-[#2d6b47] to-[#0f2918]" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-2 ring-white/25">
                    <Play className="h-10 w-10 text-white" fill="white" />
                  </div>
                  {lesson.subject && (
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                      {lesson.subject}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-4 p-6 sm:p-8">
                <h1 className="text-right text-2xl font-black leading-tight text-[#0f2918] sm:text-3xl">{lesson.title}</h1>
                {lesson.description && (
                  <p className="text-right text-sm leading-relaxed text-[#64748B]">{lesson.description}</p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5f0] px-3 py-1.5 text-[11px] font-black text-[#1E4D35]">
                    <Film className="h-3.5 w-3.5" />
                    {isAr ? "فيديو تفاعلي" : "Interactive"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f7f4] px-3 py-1.5 text-[11px] font-black text-[#374151]">
                    <Clock className="h-3.5 w-3.5 text-[#64748B]" />
                    {lesson.questions?.length ?? 0} {isAr ? "أسئلة" : "questions"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f7f4] px-3 py-1.5 text-[11px] font-black text-[#374151]">
                    <Sparkles className="h-3.5 w-3.5 text-[#64748B]" />
                    {lesson.totalPoints} {isAr ? "نقاط" : "pts"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f7f4] px-3 py-1.5 text-[11px] font-black text-[#374151]">
                    <Video className="h-3.5 w-3.5 text-[#64748B]" />
                    {isAr ? `≈ ${approxMinutes} د فيديو` : `≈ ${approxMinutes} min`}
                  </span>
                  {lesson.targetClass && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f7f4] px-3 py-1.5 text-[11px] font-black text-[#374151]">
                      <GraduationCap className="h-3.5 w-3.5 text-[#64748B]" />
                      {lesson.targetClass}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Form */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-6">
              <Card className="border border-[#e8ece9] bg-white p-6 sm:p-8 shadow-lg" style={{ borderRadius: "24px", boxShadow: CARD_SHADOW }}>
                <div
                  className="mb-5 flex gap-2.5 rounded-xl border border-[#dfe8e3] bg-[#f8faf9] px-3.5 py-2.5 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                  role="note"
                >
                  <Info className="h-4 w-4 shrink-0 text-[#1E4D35]/40 mt-0.5" aria-hidden />
                  <p className="text-[12.5px] leading-relaxed text-[#5a6b62] font-medium">
                    {isAr ? (
                      <>
                        اكتب <span className="font-semibold text-[#2d4238]">اسمك</span> أو اختره من القائمة لتتمكن من{" "}
                        <span className="font-semibold text-[#2d4238]">مشاهدة الفيديو</span> وتسجيل إجاباتك. حقل الفصل{" "}
                        <span className="font-semibold text-[#2d4238]">اختياري</span>.
                      </>
                    ) : (
                      <>
                        Enter your <span className="font-semibold text-[#2d4238]">name</span> (or pick it from the list) to{" "}
                        <span className="font-semibold text-[#2d4238]">watch the video</span> and save your answers.{" "}
                        <span className="font-semibold text-[#2d4238]">Class is optional.</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="mb-8 space-y-5">
                  {classStudents.length > 0 ? (
                    <div className="space-y-2 text-right">
                      <Label className="text-sm font-black text-[#0f2918]">
                        <Users className="mb-0.5 inline h-4 w-4 text-[#1E4D35]" />{" "}
                        {isAr ? "اختر اسمك من القائمة" : "Pick your name"}
                      </Label>
                      <select
                        value={studentId ?? ""}
                        onChange={(e) => {
                          const sid = parseInt(e.target.value);
                          const found = classStudents.find((s) => s.id === sid);
                          if (found) {
                            setStudentId(found.id);
                            setStudentName(found.name);
                            setStudentClass(lesson.targetClass?.trim() || "");
                          } else {
                            setStudentId(null);
                            setStudentName("");
                          }
                        }}
                        className={cn(
                          "min-h-[52px] w-full rounded-2xl border-2 border-[#e8ece9] bg-[#fcfdfc] px-4 text-base font-bold text-[#0f2918] focus:border-[#1E4D35]/35 focus:outline-none focus:ring-4 focus:ring-[#1E4D35]/10",
                          FIELD_RTL,
                        )}
                      >
                        <option value="">{isAr ? "— اختر اسمك —" : "— Select —"}</option>
                        {classStudents.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div className="space-y-2 text-right">
                        <Label className="text-sm font-black text-[#0f2918]">{isAr ? "اسم الطالب" : "Your name"}</Label>
                        <Input
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder={isAr ? "اكتب اسمك الكامل" : "Full name"}
                          dir="rtl"
                          className={cn("min-h-[52px] rounded-2xl border-2 text-base font-semibold focus:border-[#1E4D35]/35 focus:ring-[#1E4D35]/10", FIELD_RTL)}
                        />
                      </div>
                      <div className="space-y-2 text-right">
                        <Label className="text-sm font-black text-[#0f2918]">{isAr ? "الفصل (اختياري)" : "Class (optional)"}</Label>
                        <Input
                          value={studentClass}
                          onChange={(e) => setStudentClass(e.target.value)}
                          placeholder={isAr ? "يمكنك تركه فارغاً" : "Can be left blank"}
                          dir="rtl"
                          className={cn("min-h-[52px] rounded-2xl border-2 text-base font-semibold focus:border-[#1E4D35]/35 focus:ring-[#1E4D35]/10", FIELD_RTL)}
                        />
                      </div>
                    </div>
                  )}

                  {accessError && (
                    <div className="flex items-center gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm font-bold text-rose-900/90">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      {accessError}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!studentName.trim()) {
                      toast.error(isAr ? "يرجى إدخال اسمك أو اختياره من القائمة لمشاهدة الفيديو" : "Please enter or select your name to watch the video");
                      return;
                    }
                    setStarted(true);
                  }}
                  disabled={!studentName.trim()}
                  className={cn(
                    "flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl text-base font-black text-white shadow-lg shadow-[#1E4D35]/22 transition-all hover:-translate-y-0.5 hover:opacity-[0.97] hover:shadow-xl active:translate-y-0 disabled:pointer-events-none disabled:opacity-45",
                    TRANSITION,
                  )}
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #2a6144 100%)` }}
                >
                  <Play className="h-6 w-6 shrink-0" fill="currentColor" />
                  {isAr ? "ابدأ مشاهدة الدرس" : "Start lesson"}
                </button>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: <Film className="h-5 w-5 text-[#1E4D35]" />,
                      t: isAr ? "سيتوقف الفيديو تلقائياً عند الأسئلة" : "Video pauses at each question",
                    },
                    {
                      icon: <BadgeCheck className="h-5 w-5 text-[#1E4D35]" />,
                      t: isAr ? "ستعرف نتيجة إجابتك فوراً" : "See if you're right instantly",
                    },
                    {
                      icon: <Sparkles className="h-5 w-5 text-[#1E4D35]" />,
                      t: isAr ? "اجمع النقاط بعد كل إجابة صحيحة" : "Earn points for correct answers",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex gap-3 rounded-2xl border border-[#eef2ef] bg-[#fafdfb] p-4 text-right shadow-sm"
                      style={{ borderRadius: "18px" }}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">{item.icon}</div>
                      <p className="text-[13px] font-bold leading-relaxed text-[#374151]">{item.t}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  const progress = lesson.questions.length > 0 ? (answeredQuestions.size / lesson.questions.length) * 100 : 0;
  const allAnswered = lesson.questions.every((q) => answeredQuestions.has(q.id));

  const activeQuestionOrder = activeQuestion
    ? sortedQs.findIndex((q) => q.id === activeQuestion.id) + 1
    : 0;

  return (
    <Layout>
      <div
        className="min-h-[100dvh] overflow-x-hidden pb-8"
        style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (answeredQuestions.size > 0 && !result) setShowExitConfirm(true);
                else setLocation("/");
              }}
              className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border border-[#e8ece9] bg-white px-4 text-sm font-black text-[#64748B] shadow-sm transition-colors hover:bg-[#f9faf9]"
            >
              <BackIcon className="h-4 w-4" />
              {isAr ? "خروج" : "Exit"}
            </button>
            <h1 className="min-w-0 flex-1 truncate text-right text-lg font-black text-[#0f2918] sm:text-xl">{lesson.title}</h1>
            <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-bold text-[#64748B]">
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-[#eef2ef]">
                {answeredQuestions.size}/{lesson.questions.length}
              </span>
              {sessionEarned > 0 && (
                <span className="rounded-full bg-[#eef5f0] px-3 py-1.5 font-black text-[#1E4D35] ring-1 ring-[#1E4D35]/10">
                  +{sessionEarned} {isAr ? "نقطة" : "pts"}
                </span>
              )}
            </div>
          </div>

          <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#e8ece9]">
            <motion.div
              className="h-full rounded-full bg-[#1E4D35]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.35 }}
            />
          </div>

          <AnimatePresence>
            {showExitConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
                onClick={() => setShowExitConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.94, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.94, y: 12 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm rounded-[24px] border bg-white p-6 shadow-2xl"
                  style={{ borderColor: CARD_BORDER }}
                  dir={isAr ? "rtl" : "ltr"}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-black text-[#0f2918]">{isAr ? "مغادرة الدرس؟" : "Leave lesson?"}</h3>
                    <button type="button" onClick={() => setShowExitConfirm(false)} className="rounded-xl p-2 hover:bg-[#f3f7f4]">
                      <X className="h-4 w-4 text-[#64748B]" />
                    </button>
                  </div>
                  <p className="mb-5 text-sm leading-relaxed text-[#64748B]">
                    {isAr
                      ? "لم تكمل الدرس بعد. الخروج الآن قد يفقد تقدمك."
                      : "You have not finished. Leaving may lose your progress."}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowExitConfirm(false)}
                      className="min-h-[44px] flex-1 rounded-2xl bg-[#f3f7f4] font-black text-[#374151] hover:bg-[#eef5f0]"
                    >
                      {isAr ? "متابعة" : "Stay"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocation("/")}
                      className="min-h-[44px] flex-1 rounded-2xl bg-rose-700/90 font-black text-white hover:bg-rose-700"
                    >
                      {isAr ? "خروج" : "Leave"}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* مشغل + تايم لاين — السؤال يظهر طبقة فوق الفيديو */}
          <section
            className="overflow-hidden rounded-[24px] border bg-white shadow-lg"
            style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            <div className="relative aspect-video bg-black">
              {isYoutube ? (
                <div className="absolute inset-0 z-0 h-full w-full">
                  <div ref={ytPlayerMountRef} className="h-full w-full min-h-0" />
                  {/* يمنع فتح youtube.com عند النقر على شعار/رابط يوتيوب (غالباً أسفل يمين أو بعد زر التشغيل يساراً) */}
                  <div
                    className="pointer-events-auto absolute bottom-0 right-0 z-[12] h-[52px] w-[130px] max-[380px]:w-[100px] sm:h-[56px] sm:w-[150px]"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-auto absolute bottom-0 left-12 z-[12] h-[52px] w-[min(42%,140px)] sm:left-14 sm:h-[56px]"
                    aria-hidden
                  />
                </div>
              ) : (
                <video ref={html5VideoRef} src={lesson.videoUrl} controls className="h-full w-full object-contain" />
              )}
              {sortedQs.length > 0 && !activeQuestion && (
                <div className="pointer-events-auto absolute left-3 top-3 z-[15] max-w-[min(46%,13.5rem)]">
                  <div className="rounded-lg bg-white/95 px-2 py-1.5 shadow-lg ring-1 ring-black/10 backdrop-blur-sm">
                    <p className="text-[10px] font-black text-[#1E4D35]">
                      {isAr ? `الأسئلة (${sortedQs.length})` : `Questions (${sortedQs.length})`}
                    </p>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {sortedQs.map((q, i) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => seekTo(q.timestampSeconds)}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-[#374151] transition-colors hover:bg-[#eef5f0]"
                        >
                          <span dir="ltr" className="font-mono tabular-nums">
                            {formatTimestamp(q.timestampSeconds)}
                          </span>
                          <span className="shrink-0 rounded bg-[#eef5f0] px-1 text-[9px] font-black text-[#1E4D35]">
                            ({i + 1})
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <AnimatePresence>
                {activeQuestion && (
                  <>
                    <motion.div
                      key={`dim-${activeQuestion.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-20 bg-black/45 backdrop-blur-[1px]"
                      aria-hidden
                    />
                    <motion.div
                      key={activeQuestion.id}
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      transition={{ duration: 0.22 }}
                      className="absolute inset-0 z-30 flex items-center justify-center px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4"
                    >
                      <div
                        className="flex max-h-[min(85dvh,620px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-white/97 shadow-2xl ring-1 ring-black/10"
                        style={{ borderColor: CARD_BORDER }}
                      >
                        <div className="shrink-0 border-b border-[#f1f4f2] px-4 pb-3 pt-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#eef5f0] px-2.5 py-0.5 text-[10px] font-black text-[#1E4D35]">
                              {isAr ? "سؤال" : "Q"} {activeQuestionOrder}/{lesson.questions.length}
                            </span>
                            <span dir="ltr" className="rounded-full bg-[#f9faf9] px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-[#64748B]">
                              {formatTimestamp(activeQuestion.timestampSeconds)}
                            </span>
                            <span className="rounded-full bg-[#fcfdfc] px-2 py-0.5 text-[10px] font-bold text-[#94a3ab]">
                              {activeQuestion.points} {isAr ? "نقطة" : "pts"}
                            </span>
                          </div>
                          <p className="mt-3 text-start text-base font-black leading-relaxed text-[#0f2918]">{activeQuestion.text}</p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                          {activeQuestion.questionType === "mcq" && (
                            <div className="grid grid-cols-1 gap-2">
                            {(["A", "B", "C", "D"] as const).map((opt) => {
                              const optText = activeQuestion[`option${opt}` as keyof VideoQuestionData] as string | null;
                              if (!optText) return null;
                              const fb = answerFeedback;
                              const cor = normalizeMcqLetter(fb?.correctAnswer);
                              const sel = normalizeMcqLetter(selectedAnswer);
                              const show = !!fb;
                              const correctOpt = show && cor === opt;
                              const wrongSel = show && sel === opt && cor !== opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  disabled={verifying || !!fb}
                                  onClick={() => setSelectedAnswer(opt)}
                                  className={cn(
                                    "flex min-h-[44px] w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-right text-sm font-bold transition-all",
                                    !show && selectedAnswer === opt && "border-[#1E4D35] bg-[#eef5f0]",
                                    !show && selectedAnswer !== opt && "border-[#eef2ef] bg-[#fafdfb] hover:border-[#1E4D35]/25",
                                    correctOpt && "border-emerald-600/70 bg-emerald-50 text-emerald-900",
                                    wrongSel && "border-rose-400/70 bg-rose-50 text-rose-900",
                                    show && !correctOpt && !wrongSel && "border-[#eef2ef] bg-[#f9faf9] opacity-60",
                                  )}
                                >
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-[#1E4D35] ring-1 ring-[#e8ece9]">
                                    {opt}
                                  </span>
                                  <span className="flex-1 leading-snug">{optText}</span>
                                  {correctOpt && (
                                    <span className="text-lg font-black text-emerald-700" aria-hidden>
                                      ✓
                                    </span>
                                  )}
                                  {wrongSel && (
                                    <span className="text-lg font-black text-rose-700" aria-hidden>
                                      ✕
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {activeQuestion.questionType === "true_false" && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {(["true", "false"] as const).map((value) => {
                              const fb = answerFeedback;
                              const cor = fb?.correctAnswer?.trim().toLowerCase();
                              const sel = selectedAnswer.trim().toLowerCase();
                              const show = !!fb;
                              const isCor = show && cor === value;
                              const isWrong = show && sel === value && cor !== value;
                              const labelAr = value === "true" ? "صح" : "خطأ";
                              const labelEn = value === "true" ? "True" : "False";
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  disabled={verifying || !!fb}
                                  onClick={() => setSelectedAnswer(value)}
                                  className={cn(
                                    "flex min-h-[48px] flex-col items-center justify-center rounded-xl border-2 py-2 text-sm font-black transition-all",
                                    !show && selectedAnswer === value && "border-[#1E4D35] bg-[#eef5f0] text-[#0f2918]",
                                    !show && selectedAnswer !== value && "border-[#eef2ef] bg-[#fafdfb] text-[#64748B]",
                                    isCor && "border-emerald-600/70 bg-emerald-50 text-emerald-900",
                                    isWrong && "border-rose-400/70 bg-rose-50 text-rose-900",
                                    show && !isCor && !isWrong && "border-[#eef2ef] bg-[#f9faf9] opacity-55",
                                  )}
                                >
                                  <span className="flex items-center gap-1.5">
                                    {isCor && (
                                      <span className="text-lg text-emerald-700" aria-hidden>
                                        ✓
                                      </span>
                                    )}
                                    {isWrong && (
                                      <span className="text-lg text-rose-700" aria-hidden>
                                        ✕
                                      </span>
                                    )}
                                    {isAr ? labelAr : labelEn}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {activeQuestion.questionType === "fill_blank" && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={selectedAnswer}
                                onChange={(e) => setSelectedAnswer(e.target.value)}
                                placeholder={isAr ? "اكتب إجابتك…" : "Type your answer…"}
                                dir="rtl"
                                disabled={!!answerFeedback}
                                className={cn(
                                  "min-h-[48px] flex-1 rounded-xl border-2 text-base font-semibold",
                                  FIELD_RTL,
                                  answerFeedback?.isCorrect && "border-emerald-600/60 bg-emerald-50/50",
                                  answerFeedback && !answerFeedback.isCorrect && "border-rose-400/60 bg-rose-50/40",
                                )}
                                autoFocus={!answerFeedback}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && selectedAnswer.trim() && !answerFeedback) void verifyAnswer();
                                }}
                              />
                              {answerFeedback?.isCorrect && (
                                <span className="text-xl font-black text-emerald-700" aria-hidden>
                                  ✓
                                </span>
                              )}
                              {answerFeedback && !answerFeedback.isCorrect && (
                                <span className="text-xl font-black text-rose-700" aria-hidden>
                                  ✕
                                </span>
                              )}
                            </div>
                            {answerFeedback && !answerFeedback.isCorrect && answerFeedback.correctAnswer && (
                              <p className="text-[12px] font-semibold leading-relaxed text-[#64748B]">
                                <span className="font-black text-[#0f2918]">{isAr ? "الصحيح: " : "Correct: "}</span>
                                {formatCorrectReveal(activeQuestion, answerFeedback.correctAnswer)}
                              </p>
                            )}
                          </div>
                        )}

                        {answerFeedback && !answerFeedback.isCorrect && answerFeedback.correctAnswer && activeQuestion.questionType === "mcq" && (
                          <p className="mt-3 text-[11px] leading-relaxed text-[#64748B]">
                            <span className="font-black text-[#0f2918]">{isAr ? "الإجابة الصحيحة: " : "Correct: "}</span>
                            {formatCorrectReveal(activeQuestion, answerFeedback.correctAnswer)}
                          </p>
                        )}
                        </div>

                        <div className="shrink-0 border-t border-[#f1f4f2] bg-[#fcfdfc] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
                        {!answerFeedback ? (
                          <button
                            type="button"
                            onClick={() => void verifyAnswer()}
                            disabled={!selectedAnswer.trim() || verifying}
                            className={cn(
                              "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl font-black text-white shadow-md disabled:opacity-45",
                              TRANSITION,
                            )}
                            style={{ background: BRAND }}
                          >
                            {verifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                            {isAr ? "إرسال الإجابة" : "Submit answer"}
                          </button>
                        ) : (
                          <div className="space-y-3">
                            {answerFeedback.isCorrect && answerFeedback.earnedPoints > 0 && (
                              <p className="text-center text-sm font-black text-emerald-800">
                                +{answerFeedback.earnedPoints} {isAr ? "نقطة" : "pts"}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={continueAfterFeedback}
                              className={cn(
                                "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl font-black text-white shadow-md",
                                TRANSITION,
                              )}
                              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #2a6144 100%)` }}
                            >
                              <Play className="h-5 w-5" fill="currentColor" />
                              {isAr ? "متابعة الفيديو" : "Continue video"}
                            </button>
                          </div>
                        )}
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="border-t border-[#eef2ef] px-4 py-4">
              <p className="mb-2 text-right text-[11px] font-black uppercase tracking-wide text-[#94a3ab]">
                {isAr ? "خط الأسئلة" : "Timeline"}
              </p>
              <div dir="ltr" className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                <div className="relative mx-auto min-h-14 min-w-[260px] px-1">
                  <div className="relative mt-7 h-2 overflow-hidden rounded-full bg-[#e8ece9]">
                    <div
                      className="absolute top-0 h-full rounded-full bg-[#1E4D35]/20 transition-[width]"
                      style={{
                        width: `${Math.min(100, (playheadSec / timelineScale) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="relative -mt-1 h-10">
                    {sortedQs.map((q, i) => {
                      const pct = (q.timestampSeconds / timelineScale) * 100;
                      const done = answeredQuestions.has(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                          className="absolute top-0 flex flex-col items-center"
                          onClick={() => seekTo(q.timestampSeconds)}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-black shadow-sm transition-transform active:scale-95",
                              done
                                ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                                : "border-[#1E4D35]/40 bg-white text-[#1E4D35]",
                            )}
                          >
                            {i + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
          <div className="mt-6 flex justify-end">
            {allAnswered && !result && (
              <Button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="min-h-[48px] shrink-0 gap-2 rounded-2xl px-6 font-black"
                style={{ background: BRAND }}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isAr ? "إنهاء وتسليم" : "Finish & submit"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
