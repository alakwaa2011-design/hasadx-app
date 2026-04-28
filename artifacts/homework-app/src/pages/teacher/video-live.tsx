import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Button } from "@/components/ui-elements";
import {
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  Users,
  Copy,
  Video,
  Radio,
  CheckCircle2,
  XCircle,
  SkipForward,
  StopCircle,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";

interface YTPlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getPlayerState: () => number;
}

interface YTWindow extends Window {
  YT?: {
    Player: new (
      elementId: string,
      config: Record<string, unknown>,
    ) => YTPlayer;
    PlayerState: { PLAYING: number; PAUSED: number };
  };
  onYouTubeIframeAPIReady?: () => void;
}

const ytWindow = window as unknown as YTWindow;
const API_BASE = import.meta.env.VITE_API_URL || "";

interface VideoQuestion {
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
}

interface StudentInfo {
  participantId: string;
  name: string;
  studentClass: string;
}

interface AnswerStats {
  total: number;
  correct: number;
  wrong: number;
  distribution: Record<string, number>;
  studentCount: number;
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

export default function VideoLive() {
  const [, params] = useRoute("/teacher/video-lesson/:id/live");
  const lessonId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const BackArrowIcon = isAr ? ArrowRight : ArrowLeft;

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState("youtube");
  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [skipSegments, setSkipSegments] = useState<{ start: number; end: number }[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [answerStats, setAnswerStats] = useState<AnswerStats | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<{ participantId: string; name: string; selectedAnswer: string; isCorrect: boolean }[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{
    studentCount: number;
    totalQuestions: number;
    students: { name: string; studentClass: string; correctAnswers: number; totalQuestions: number; earnedPoints: number; totalPoints: number; score: number }[];
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [connecting, setConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const html5VideoRef = useRef<HTMLVideoElement>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggeredQuestionsRef = useRef<Set<number>>(new Set());

  const youtubeId = videoType === "youtube" ? extractYouTubeId(videoUrl) : null;

  const socketRef = useRef(getSocket());
  const roomCodeRef = useRef<string | null>(null);
  const sessionEndedRef = useRef(false);
  const endSessionRef = useRef<() => void>(() => {});
  const activeQuestionIdRef = useRef<number | null>(null);
  const handleResumeRef = useRef<(() => void) | null>(null);
  const pendingQuestionRef = useRef<number | null>(null);
  // Fail-safe: if the socket ack never arrives (silent failure/network drop),
  // automatically clear pendingQuestionRef after a timeout so the same question
  // can be re-attempted on the next sync interval pass.
  const pendingQuestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    activeQuestionIdRef.current = activeQuestionId;
  }, [activeQuestionId]);

  useEffect(() => {
    sessionEndedRef.current = sessionEnded;
  }, [sessionEnded]);

  // NOTE: We intentionally do NOT send video:end-session on beforeunload.
  // The server keeps the room alive with a 10-minute grace period so the
  // teacher can refresh the page and seamlessly rejoin the same session.

  useEffect(() => {
    const socket = socketRef.current;
    const hasInitializedRef = { current: false };

    const applyRoomData = (res: {
      roomCode?: string;
      lesson?: { title: string; videoUrl: string; videoType: string; questions: VideoQuestion[]; skipSegments: { start: number; end: number }[] };
      error?: string;
    }, isInitial: boolean) => {
      if (isInitial) setConnecting(false);
      if (res.error) {
        if (isInitial) setConnectionError(res.error);
        return;
      }
      if (res.roomCode && res.lesson) {
        setRoomCode(res.roomCode);
        setLessonTitle(res.lesson.title);
        setVideoUrl(res.lesson.videoUrl);
        setVideoType(res.lesson.videoType);
        setQuestions(res.lesson.questions);
        setSkipSegments(res.lesson.skipSegments || []);
      }
    };

    socket.emit("video:create-room", { lessonId }, (res: { roomCode?: string; lesson?: { title: string; videoUrl: string; videoType: string; questions: VideoQuestion[]; skipSegments: { start: number; end: number }[] }; error?: string }) => {
      hasInitializedRef.current = true;
      applyRoomData(res, true);
    });

    socket.on(
      "video:student-joined",
      (data: { name: string; studentCount: number; students: StudentInfo[] }) => {
        setStudents(data.students);
        toast.success(isAr ? `انضم ${data.name}` : `${data.name} joined`);
      },
    );

    socket.on(
      "video:student-left",
      (data: { name: string; studentCount: number; students: StudentInfo[] }) => {
        setStudents(data.students);
      },
    );

    socket.on(
      "video:answer-update",
      (data: {
        questionId: number;
        participantId: string;
        studentName: string;
        selectedAnswer: string;
        isCorrect: boolean;
        stats: AnswerStats;
      }) => {
        setAnswerStats(data.stats);
        setStudentAnswers((prev) => [
          { participantId: data.participantId, name: data.studentName, selectedAnswer: data.selectedAnswer, isCorrect: data.isCorrect },
          ...prev,
        ]);
      },
    );

    socket.on(
      "video:question-active",
      (data: { questionId: number; stats: AnswerStats }) => {
        setActiveQuestionId(data.questionId);
        setAnswerStats(data.stats);
        setStudentAnswers([]);
      },
    );

    socket.on(
      "video:session-ended",
      (data: {
        summary?: {
          studentCount: number;
          totalQuestions: number;
          students: { name: string; studentClass: string; correctAnswers: number; totalQuestions: number; earnedPoints: number; totalPoints: number; score: number }[];
        };
      }) => {
        setSessionEnded(true);
        if (data.summary) {
          setSessionSummary(data.summary);
        }
      },
    );

    // Auto-rejoin the room when the socket reconnects after network drops.
    // We skip the very first "connect" if the initial emit already handled it.
    const handleConnect = () => {
      if (sessionEndedRef.current) return;
      // If the initial socket.emit hasn't completed yet, don't double-call
      if (!hasInitializedRef.current) return;
      socket.emit(
        "video:create-room",
        { lessonId },
        (res: { roomCode?: string; lesson?: { title: string; videoUrl: string; videoType: string; questions: VideoQuestion[]; skipSegments: { start: number; end: number }[] }; error?: string }) => {
          applyRoomData(res, false);
        },
      );
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("video:student-joined");
      socket.off("video:student-left");
      socket.off("video:answer-update");
      socket.off("video:question-active");
      socket.off("video:session-ended");
      socket.off("connect", handleConnect);
    };
  }, [lessonId, isAr]);

  useEffect(() => {
    if (videoType !== "youtube" || !youtubeId || !roomCode) return;

    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.id = "yt-iframe-api";
      document.head.appendChild(tag);
    }

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      playerRef.current = new ytWindow.YT!.Player("yt-player-live", {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (event: { target: YTPlayer }) => {
            setPlayerReady(true);
            try {
              const dur = event.target.getDuration() || 0;
              if (dur > 0) setVideoDuration(dur);
            } catch {}
          },
          onStateChange: (event: { data: number }) => {
            // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            const playing = event.data === 1;
            const paused = event.data === 2 || event.data === 0;
            if (playing || paused) {
              // If the teacher tapped/clicked the video directly while a question
              // was displayed, treat it exactly like pressing "Resume" — clear the
              // active question and notify students to resume.
              if (playing && activeQuestionIdRef.current !== null) {
                handleResumeRef.current?.();
                return;
              }
              setIsPlaying(playing);
              // Immediately sync to students — don't wait for the 500ms interval.
              if (roomCodeRef.current && activeQuestionIdRef.current === null) {
                const time = (() => {
                  try { return playerRef.current?.getCurrentTime() ?? 0; } catch { return 0; }
                })();
                socketRef.current.emit("video:sync-state", {
                  roomCode: roomCodeRef.current,
                  state: playing ? "playing" : "paused",
                  currentTime: Math.floor(time),
                });
              }
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
        } catch {}
        playerRef.current = null;
      }
    };
  }, [youtubeId, videoType, roomCode]);

  const getCurrentVideoTime = useCallback((): number => {
    if (videoType === "youtube" && playerRef.current) {
      try {
        return playerRef.current.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    }
    if (html5VideoRef.current) {
      return html5VideoRef.current.currentTime || 0;
    }
    return 0;
  }, [videoType]);

  const showQuestion = useCallback((questionId: number) => {
    if (videoType === "youtube" && playerRef.current) {
      try {
        playerRef.current.pauseVideo();
      } catch {}
    } else if (html5VideoRef.current) {
      html5VideoRef.current.pause();
    }
    setIsPlaying(false);

    // Fail-safe: if the socket ack never fires (silent network failure), clear
    // pendingQuestionRef after 2 s so the question can be re-attempted on the
    // next sync interval pass.
    if (pendingQuestionTimeoutRef.current) clearTimeout(pendingQuestionTimeoutRef.current);
    pendingQuestionTimeoutRef.current = setTimeout(() => {
      if (pendingQuestionRef.current === questionId) {
        pendingQuestionRef.current = null;
      }
    }, 2000);

    socketRef.current.emit(
      "video:show-question",
      { roomCode, questionId },
      (res: { success?: boolean; error?: string }) => {
        if (pendingQuestionTimeoutRef.current) {
          clearTimeout(pendingQuestionTimeoutRef.current);
          pendingQuestionTimeoutRef.current = null;
        }
        pendingQuestionRef.current = null;
        if (res?.success) {
          triggeredQuestionsRef.current.add(questionId);
        } else {
          // Server rejected the question — roll back local UI state so the
          // teacher doesn't get stuck in a phantom active-question state.
          setActiveQuestionId(null);
          setIsPlaying(true);
          if (videoType === "youtube" && playerRef.current) {
            try { playerRef.current.playVideo(); } catch {}
          } else if (html5VideoRef.current) {
            html5VideoRef.current.play().catch(() => {});
          }
        }
      },
    );
    setActiveQuestionId(questionId);
    setAnswerStats(null);
    setStudentAnswers([]);
  }, [videoType, roomCode]);

  useEffect(() => {
    if (!roomCode) return;

    syncIntervalRef.current = setInterval(() => {
      const time = Math.floor(getCurrentVideoTime());
      setCurrentTime(time);

      const socket = socketRef.current;

      if (isPlaying && activeQuestionId === null) {
        const inSegment = skipSegments.find((seg) => time >= seg.start && time < seg.end);
        if (inSegment) {
          if (videoType === "youtube" && playerRef.current) {
            try { playerRef.current.seekTo(inSegment.end, true); } catch {}
          } else if (html5VideoRef.current) {
            html5VideoRef.current.currentTime = inSegment.end;
          }
          socket.emit("video:sync-state", {
            roomCode,
            state: "playing",
            currentTime: inSegment.end,
          });
          return;
        }
      }

      const state = isPlaying ? "playing" : "paused";
      socket.emit("video:sync-state", {
        roomCode,
        state,
        currentTime: time,
      });

      if (isPlaying && activeQuestionId === null) {
        for (const q of questions) {
          if (
            Math.abs(time - q.timestampSeconds) <= 2 &&
            !triggeredQuestionsRef.current.has(q.id) &&
            !answeredQuestions.has(q.id) &&
            pendingQuestionRef.current !== q.id
          ) {
            pendingQuestionRef.current = q.id;
            showQuestion(q.id);
            break;
          }
        }
      }
    }, 500);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [roomCode, isPlaying, questions, skipSegments, videoType, activeQuestionId, answeredQuestions, getCurrentVideoTime, showQuestion]);

  const handleResume = () => {
    if (!roomCode) return;

    setAnsweredQuestions((prev) => {
      const next = new Set(prev);
      if (activeQuestionId !== null) next.add(activeQuestionId);
      return next;
    });
    setActiveQuestionId(null);
    setAnswerStats(null);
    setStudentAnswers([]);

    const time = getCurrentVideoTime();
    socketRef.current.emit("video:resume", { roomCode, currentTime: time });

    if (videoType === "youtube" && playerRef.current) {
      try {
        playerRef.current.playVideo();
      } catch {}
    } else if (html5VideoRef.current) {
      html5VideoRef.current.play();
    }
    setIsPlaying(true);
  };

  // Keep handleResumeRef always pointing to the latest handleResume so that
  // the YouTube onStateChange callback (registered once on player init) can
  // call handleResume without capturing a stale closure.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { handleResumeRef.current = handleResume; });

  const handleEndSession = useCallback(() => {
    const code = roomCodeRef.current;
    if (!code) return;
    socketRef.current.emit(
      "video:end-session",
      { roomCode: code },
      (res: { success?: boolean; error?: string }) => {
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(isAr ? "تم إنهاء الجلسة وحفظ النتائج" : "Session ended and results saved");
      },
    );
  }, [isAr]);

  useEffect(() => {
    endSessionRef.current = handleEndSession;
  }, [handleEndSession]);

  const copyRoomCode = () => {
    if (!roomCode) return;
    const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/watch/${roomCode}`;
    navigator.clipboard.writeText(joinUrl).then(() => {
      toast.success(isAr ? "تم نسخ رابط الانضمام" : "Join link copied");
    });
  };

  const handlePlayPause = () => {
    if (activeQuestionId !== null) return;
    if (videoType === "youtube" && playerRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.pauseVideo();
        } else {
          playerRef.current.playVideo();
        }
      } catch {}
    } else if (html5VideoRef.current) {
      if (isPlaying) {
        html5VideoRef.current.pause();
      } else {
        html5VideoRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoType === "youtube" && playerRef.current) {
      try {
        playerRef.current.seekTo(time, true);
      } catch {}
    } else if (html5VideoRef.current) {
      html5VideoRef.current.currentTime = time;
    }
    setCurrentTime(time);
    const code = roomCodeRef.current;
    if (code) {
      socketRef.current.emit("video:sync-state", {
        roomCode: code,
        currentTime: time,
        state: isPlaying ? "playing" : "paused",
      });
    }
  };

  const activeQuestion = questions.find((q) => q.id === activeQuestionId);

  if (connecting || connectionError) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4 max-w-md px-4">
            {connecting ? (
              <>
                <Radio className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
                <p className="text-lg font-bold">{isAr ? "جاري إنشاء الغرفة..." : "Creating room..."}</p>
              </>
            ) : (
              <>
                <XCircle className="w-12 h-12 text-destructive mx-auto" />
                <p className="text-lg font-bold text-destructive">{connectionError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 transition-opacity"
                >
                  {isAr ? "إعادة تحميل الصفحة" : "Reload Page"}
                </button>
              </>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  if (sessionEnded) {
    const avgScore = sessionSummary && sessionSummary.students.length > 0
      ? Math.round(sessionSummary.students.reduce((s, st) => s + st.score, 0) / sessionSummary.students.length)
      : 0;

    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-6"
          >
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-500/10 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="text-3xl font-black">
                {isAr ? "انتهت الجلسة بنجاح!" : "Session ended successfully!"}
              </h1>
              <p className="text-muted-foreground text-lg">{lessonTitle}</p>
            </div>

            {sessionSummary && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-4 text-center bg-gradient-to-br from-blue-500/10 to-transparent">
                    <Users className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                    <p className="text-2xl font-black">{sessionSummary.studentCount}</p>
                    <p className="text-xs text-muted-foreground font-bold">
                      {isAr ? "طالب" : "Students"}
                    </p>
                  </Card>
                  <Card className="p-4 text-center bg-gradient-to-br from-amber-500/10 to-transparent">
                    <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                    <p className="text-2xl font-black">{sessionSummary.totalQuestions}</p>
                    <p className="text-xs text-muted-foreground font-bold">
                      {isAr ? "سؤال" : "Questions"}
                    </p>
                  </Card>
                  <Card className="p-4 text-center bg-gradient-to-br from-green-500/10 to-transparent">
                    <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
                    <p className="text-2xl font-black">{avgScore}%</p>
                    <p className="text-xs text-muted-foreground font-bold">
                      {isAr ? "متوسط النتيجة" : "Avg Score"}
                    </p>
                  </Card>
                </div>

                <Card className="p-4">
                  <h3 className="font-bold mb-3">
                    {isAr ? "نتائج الطلاب" : "Student Results"}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="py-2 text-start font-bold">{isAr ? "الطالب" : "Student"}</th>
                          <th className="py-2 text-start font-bold">{isAr ? "الفصل" : "Class"}</th>
                          <th className="py-2 text-center font-bold">{isAr ? "صحيح" : "Correct"}</th>
                          <th className="py-2 text-center font-bold">{isAr ? "النقاط" : "Points"}</th>
                          <th className="py-2 text-center font-bold">{isAr ? "النتيجة" : "Score"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionSummary.students
                          .sort((a, b) => b.score - a.score)
                          .map((st, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2 font-bold">{st.name}</td>
                              <td className="py-2 text-muted-foreground">{st.studentClass || "—"}</td>
                              <td className="py-2 text-center">
                                {st.correctAnswers}/{st.totalQuestions}
                              </td>
                              <td className="py-2 text-center">
                                {st.earnedPoints}/{st.totalPoints}
                              </td>
                              <td className="py-2 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    st.score >= 70
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                      : st.score >= 40
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  }`}
                                >
                                  {st.score}%
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            <div className="text-center">
              <Button
                onClick={() => setLocation(`/teacher/video-lesson/${lessonId}`)}
                className="py-3 px-8 bg-primary text-primary-foreground rounded-xl font-bold"
              >
                {isAr ? "العودة لتفاصيل الدرس" : "Back to lesson details"}
              </Button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setLocation(`/teacher/video-lesson/${lessonId}`)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold transition-colors"
          >
            <BackArrowIcon className="w-5 h-5" />
            {isAr ? "العودة" : "Back"}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-red-500">
              <Radio className="w-5 h-5 animate-pulse" />
              <span className="font-bold text-sm">{isAr ? "بث مباشر" : "LIVE"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-500/10 rounded-2xl">
            <Video className="w-7 h-7 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black truncate">{lessonTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {isAr ? "بث مباشر تفاعلي" : "Live interactive broadcast"}
            </p>
          </div>
        </div>

        {roomCode && (
          <Card className="p-4 mb-6 border-2 border-red-500/30 bg-red-500/5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground">
                  {isAr ? "كود الغرفة:" : "Room Code:"}
                </span>
                <span className="text-2xl font-black tracking-[0.3em] text-red-600 dark:text-red-400">
                  {roomCode}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background rounded-lg">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-bold">{students.length}</span>
                </div>
                <button
                  onClick={copyRoomCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-bold text-sm"
                >
                  <Copy className="w-4 h-4" />
                  {isAr ? "نسخ الرابط" : "Copy link"}
                </button>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="overflow-hidden">
              {videoType === "youtube" && youtubeId ? (
                <div className="aspect-video bg-black">
                  <div id="yt-player-live" className="w-full h-full" />
                </div>
              ) : videoUrl ? (
                <video
                  ref={html5VideoRef}
                  src={videoUrl}
                  playsInline
                  className="w-full aspect-video bg-black"
                  onPlay={() => {
                    // If the teacher tapped the video to resume while a question
                    // was showing, treat it like pressing the "Resume" button.
                    if (activeQuestionIdRef.current !== null) {
                      handleResumeRef.current?.();
                      return;
                    }
                    setIsPlaying(true);
                  }}
                  onPause={() => setIsPlaying(false)}
                  onLoadedMetadata={(e) => setVideoDuration((e.target as HTMLVideoElement).duration || 0)}
                  onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime || 0)}
                />
              ) : null}

              <div className="p-3 space-y-2 border-t">
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 1}
                  step={0.5}
                  value={currentTime}
                  onChange={handleSeek}
                  disabled={activeQuestionId !== null}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-red-500 disabled:opacity-50"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePlayPause}
                      disabled={activeQuestionId !== null}
                      className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>
                    <span className="text-sm font-mono text-muted-foreground">
                      {formatTimestamp(currentTime)} / {formatTimestamp(videoDuration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeQuestionId !== null && (
                      <button
                        onClick={handleResume}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity font-bold text-sm"
                      >
                        <SkipForward className="w-4 h-4" />
                        {isAr ? "متابعة الفيديو" : "Resume"}
                      </button>
                    )}
                    <button
                      onClick={handleEndSession}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity font-bold text-sm"
                    >
                      <StopCircle className="w-4 h-4" />
                      {isAr ? "إنهاء الجلسة" : "End Session"}
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <AnimatePresence>
              {activeQuestion && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="p-5 border-2 border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-600" />
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {isAr ? "السؤال النشط" : "Active Question"}
                        </span>
                      </div>
                      <span className="text-sm font-mono bg-amber-200/50 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                        {formatTimestamp(activeQuestion.timestampSeconds)}
                      </span>
                    </div>

                    <p className="text-lg font-bold mb-4">{activeQuestion.text}</p>

                    {activeQuestion.questionType === "mcq" && (
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {[
                          { key: "A", text: activeQuestion.optionA },
                          { key: "B", text: activeQuestion.optionB },
                          { key: "C", text: activeQuestion.optionC },
                          { key: "D", text: activeQuestion.optionD },
                        ]
                          .filter((o) => o.text)
                          .map((o) => (
                            <div
                              key={o.key}
                              className={`p-2.5 rounded-lg border text-sm font-semibold ${
                                o.key === activeQuestion.correctAnswer
                                  ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                                  : "border-border"
                              }`}
                            >
                              <span className="font-black ml-1 mr-1">{o.key}.</span> {o.text}
                            </div>
                          ))}
                      </div>
                    )}

                    {activeQuestion.questionType === "true_false" && (
                      <div className="flex gap-3 mb-4">
                        {["true", "false"].map((v) => (
                          <div
                            key={v}
                            className={`flex-1 p-2.5 rounded-lg border text-center text-sm font-bold ${
                              v === activeQuestion.correctAnswer
                                ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                                : "border-border"
                            }`}
                          >
                            {v === "true"
                              ? isAr ? "صح ✓" : "True ✓"
                              : isAr ? "خطأ ✗" : "False ✗"}
                          </div>
                        ))}
                      </div>
                    )}

                    {answerStats && (
                      <div className="mb-4 p-3 bg-background rounded-xl border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-muted-foreground">
                            {isAr ? "الإجابات" : "Answers"}
                          </span>
                          <span className="font-bold">
                            {answerStats.total} / {answerStats.studentCount}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {answerStats.correct}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="font-bold text-red-600 dark:text-red-400">
                              {answerStats.wrong}
                            </span>
                          </div>
                        </div>
                        {answerStats.total > 0 && (
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{
                                width: `${(answerStats.correct / answerStats.total) * 100}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-4">
                      <p className="text-xs font-bold text-muted-foreground mb-2">
                        {isAr ? "تفاصيل الإجابات" : "Answer Details"}
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {students.map((s) => {
                          const answer = studentAnswers.find((a) => a.participantId === s.participantId);
                          return (
                            <div
                              key={s.participantId}
                              className={`flex items-center justify-between text-sm px-2.5 py-1.5 rounded-lg border ${
                                answer
                                  ? answer.isCorrect
                                    ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/10"
                                    : "border-red-500/30 bg-red-50/50 dark:bg-red-950/10"
                                  : "border-border bg-muted/30"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {answer ? (
                                  answer.isCorrect ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )
                                ) : (
                                  <Clock className="w-4 h-4 text-muted-foreground animate-pulse" />
                                )}
                                <span className="font-bold">{s.name}</span>
                              </div>
                              <span className={`text-xs font-bold ${
                                answer
                                  ? answer.isCorrect
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground"
                              }`}>
                                {answer
                                  ? answer.selectedAnswer
                                  : isAr ? "لم يجب" : "No answer"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card className="p-4">
              <h3 className="font-bold text-sm text-muted-foreground mb-3">
                {isAr ? "الأسئلة" : "Questions"} ({questions.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {questions.map((q) => {
                  const isActive = q.id === activeQuestionId;
                  const isDone = answeredQuestions.has(q.id);
                  return (
                    <div
                      key={q.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                          : isDone
                            ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/10"
                            : "border-border"
                      }`}
                    >
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {formatTimestamp(q.timestampSeconds)}
                      </span>
                      <span className="flex-1 text-sm font-semibold truncate">
                        {q.text}
                      </span>
                      {isDone && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {isActive && (
                        <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
                      )}
                      {!isActive && !isDone && (
                        <button
                          onClick={() => showQuestion(q.id)}
                          className="text-xs px-2 py-1 bg-primary/10 text-primary rounded font-bold hover:bg-primary/20 transition-colors"
                        >
                          {isAr ? "عرض" : "Show"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-bold">
                  {isAr ? "الطلاب المتصلون" : "Connected Students"} ({students.length})
                </h3>
              </div>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {isAr
                    ? "لم ينضم أي طالب بعد..."
                    : "No students joined yet..."}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                  {students.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {s.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{s.name}</p>
                        {s.studentClass && (
                          <p className="text-xs text-muted-foreground">
                            {s.studentClass}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {roomCode && (
              <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {isAr ? "رابط انضمام الطلاب" : "Student join link"}
                </p>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/watch/${roomCode}`}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
