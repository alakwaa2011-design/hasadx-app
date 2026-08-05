import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import {
  Play,
  Video,
  Radio,
  CheckCircle2,
  XCircle,
  Users,
  LogIn,
  Wifi,
  WifiOff,
  ArrowLeft,
  ArrowRight,
  Info,
  Film,
  Sparkles,
  BadgeCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

const BRAND = "#1E4D35";
const PAGE_BG = "linear-gradient(165deg, #f6faf7 0%, #eef4ef 45%, #f3f7f4 100%)";
const CARD_BORDER = "rgba(30, 77, 53, 0.1)";
const CARD_SHADOW = "0 2px 16px rgba(15, 40, 28, 0.06)";
const TRANSITION = "transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]";
const FIELD_RTL =
  "text-right [direction:rtl] placeholder:text-right placeholder:text-muted-foreground";

interface YTPlayer {
  destroy: () => void;
  getCurrentTime: () => number;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
}

interface YTWindow extends Window {
  YT?: {
    Player: new (
      elementId: string | HTMLElement,
      config: Record<string, unknown>,
    ) => YTPlayer;
  };
  onYouTubeIframeAPIReady?: () => void;
}

const ytWindow = window as unknown as YTWindow;

// ─── localStorage session helpers ─────────────────────────────────────────
interface StoredVideoSession {
  roomCode: string;
  name: string;
  studentClass: string;
  participantId: string;
}

function getStoredSession(roomCode: string): StoredVideoSession | null {
  try {
    const raw = localStorage.getItem(`hasad_video_${roomCode}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredVideoSession;
    if (parsed.roomCode === roomCode && parsed.name && parsed.participantId) return parsed;
  } catch {}
  return null;
}

function saveSession(session: StoredVideoSession) {
  try {
    localStorage.setItem(`hasad_video_${session.roomCode}`, JSON.stringify(session));
  } catch {}
}

interface ActiveQuestion {
  id: number;
  text: string;
  questionType: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  points: number;
}

interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: string | null;
  points: number;
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

export default function StudentVideoLive() {
  const [, params] = useRoute("/watch/:roomCode");
  const roomCodeFromUrl = (params?.roomCode || "").toUpperCase();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const BackIcon = isAr ? ArrowLeft : ArrowRight;

  const [phase, setPhase] = useState<"join" | "reconnecting" | "watching" | "ended">("join");
  const [roomCode, setRoomCode] = useState(roomCodeFromUrl);
  const [name, setName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [joining, setJoining] = useState(false);
  const participantIdRef = useRef<string | null>(null);
  // true = teacher is playing → show "tap to resume" overlay if autoplay blocked
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const [lessonTitle, setLessonTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState("youtube");
  const [skipSegments, setSkipSegments] = useState<{ start: number; end: number }[]>([]);

  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  // Ref always in sync with activeQuestion — safe to read inside socket handlers (no stale closure)
  const activeQuestionRef = useRef<ActiveQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [teacherDisconnected, setTeacherDisconnected] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [videoActivated, setVideoActivated] = useState(false);
  const videoActivatedRef = useRef(false);
  // Tracks whether the teacher has authorized the student's video to play.
  // Used by the YouTube onStateChange guard to prevent unsolicited playback.
  const teacherPlayingRef = useRef(false);
  /** Mirrors teacher play state for overlay copy (refs alone don't re-render). */
  const [teacherPlayingUi, setTeacherPlayingUi] = useState(false);
  // Last received teacher time — used so the player can sync to the right
  // position once it becomes ready, even if sync events arrived while the
  // YouTube iframe was still loading.
  const lastTeacherTimeRef = useRef(0);
  const html5VideoRef = useRef<HTMLVideoElement>(null);
  const skipSegmentsRef = useRef<{ start: number; end: number }[]>([]);

  const youtubeId = videoType === "youtube" ? extractYouTubeId(videoUrl) : null;
  const socketRef = useRef(getSocket());

  useEffect(() => {
    if (phase === "join") setTeacherPlayingUi(false);
  }, [phase]);

  // ── Auto-join on mount if a stored session exists for this room code ─────
  useEffect(() => {
    if (!roomCodeFromUrl) return;
    const stored = getStoredSession(roomCodeFromUrl);
    if (!stored) return;

    // Pre-fill form data in case reconnect fails (so user can retry manually)
    setName(stored.name);
    setStudentClass(stored.studentClass);

    setPhase("reconnecting");
    socketRef.current.emit(
      "video:join-room",
      {
        roomCode: stored.roomCode,
        name: stored.name,
        studentClass: stored.studentClass,
        existingParticipantId: stored.participantId,
      },
      (res: {
        success?: boolean;
        participantId?: string;
        lesson?: { title: string; videoUrl: string; videoType: string; skipSegments: { start: number; end: number }[] };
        videoState?: string;
        currentTime?: number;
        activeQuestion?: ActiveQuestion | null;
        error?: string;
      }) => {
        if (res.error) {
          // Room may have ended — fall back to join form with pre-filled data
          setPhase("join");
          return;
        }
        if (res.lesson) {
          if (res.participantId) {
            participantIdRef.current = res.participantId;
            saveSession({ roomCode: stored.roomCode, name: stored.name, studentClass: stored.studentClass, participantId: res.participantId });
          }
          setLessonTitle(res.lesson.title);
          setVideoUrl(res.lesson.videoUrl);
          setVideoType(res.lesson.videoType);
          const segs = res.lesson.skipSegments || [];
          setSkipSegments(segs);
          skipSegmentsRef.current = segs;
          if (res.activeQuestion) {
            activeQuestionRef.current = res.activeQuestion;
            setActiveQuestion(res.activeQuestion);
          }
          if (typeof res.currentTime === "number") {
            lastTeacherTimeRef.current = res.currentTime;
          }
          const playing = res.videoState === "playing" && !res.activeQuestion;
          teacherPlayingRef.current = playing;
          setTeacherPlayingUi(playing);
          setPhase("watching");
        }
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCodeFromUrl]);

  const doJoin = (
    joinRoomCode: string,
    joinName: string,
    joinClass: string,
    existingParticipantId?: string,
    onDone?: () => void,
  ) => {
    const socket = socketRef.current;
    socket.emit(
      "video:join-room",
      {
        roomCode: joinRoomCode.trim().toUpperCase(),
        name: joinName.trim(),
        studentClass: joinClass.trim(),
        existingParticipantId,
      },
      (res: {
        success?: boolean;
        participantId?: string;
        lesson?: { title: string; videoUrl: string; videoType: string; skipSegments: { start: number; end: number }[] };
        videoState?: string;
        currentTime?: number;
        activeQuestion?: ActiveQuestion | null;
        error?: string;
      }) => {
        onDone?.();
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.lesson) {
          if (res.participantId) {
            participantIdRef.current = res.participantId;
            saveSession({ roomCode: joinRoomCode.trim().toUpperCase(), name: joinName.trim(), studentClass: joinClass.trim(), participantId: res.participantId });
          }
          setLessonTitle(res.lesson.title);
          setVideoUrl(res.lesson.videoUrl);
          setVideoType(res.lesson.videoType);
          const segs = res.lesson.skipSegments || [];
          setSkipSegments(segs);
          skipSegmentsRef.current = segs;
          if (res.activeQuestion) {
            activeQuestionRef.current = res.activeQuestion;
            setActiveQuestion(res.activeQuestion);
          }
          if (typeof res.currentTime === "number") {
            lastTeacherTimeRef.current = res.currentTime;
          }
          const playing = res.videoState === "playing" && !res.activeQuestion;
          teacherPlayingRef.current = playing;
          setTeacherPlayingUi(playing);
          setPhase("watching");
        }
      },
    );
  };

  const handleJoin = () => {
    if (!roomCode.trim()) {
      toast.error(isAr ? "يرجى إدخال كود الغرفة" : "Please enter room code");
      return;
    }
    if (!name.trim()) {
      toast.error(isAr ? "يرجى إدخال الاسم" : "Please enter your name");
      return;
    }
    setJoining(true);
    doJoin(roomCode, name, studentClass, undefined, () => setJoining(false));
  };

  // ── Helper: activate video and attempt autoplay ─────────────────────────
  // forcePlay = true → teacher started playing, try to play now
  // forcePlay = false → user tapped manually, play only if teacher is playing
  const tryPlayVideo = (seekTo?: number, forcePlay = true) => {
    videoActivatedRef.current = true;
    setVideoActivated(true);
    setAutoplayBlocked(false);
    const shouldPlay = forcePlay || teacherPlayingRef.current;
    if (videoType === "youtube" && playerRef.current) {
      try {
        if (seekTo !== undefined) playerRef.current.seekTo(seekTo, true);
        if (shouldPlay) playerRef.current.playVideo();
      } catch {}
    } else if (html5VideoRef.current) {
      const vid = html5VideoRef.current;
      if (seekTo !== undefined) vid.currentTime = seekTo;
      if (shouldPlay) vid.play().catch(() => setAutoplayBlocked(true));
    }
  };

  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    if (phase !== "watching") return;
    const socket = socketRef.current;

    socket.on(
      "video:sync-state",
      (data: { state: "playing" | "paused"; currentTime: number }) => {
        lastTeacherTimeRef.current = data.currentTime;
        if (activeQuestionRef.current) return;

        teacherPlayingRef.current = data.state === "playing";
        setTeacherPlayingUi(data.state === "playing");

        if (data.state === "playing") {
          if (!videoActivatedRef.current) {
            // Teacher started playing — auto-activate (browser may block, we handle that below)
            videoActivatedRef.current = true;
            setVideoActivated(true);
            if (videoType === "youtube" && playerRef.current) {
              try {
                playerRef.current.seekTo(data.currentTime, true);
                playerRef.current.playVideo();
                setAutoplayBlocked(false);
              } catch {}
            } else if (html5VideoRef.current) {
              html5VideoRef.current.currentTime = data.currentTime;
              html5VideoRef.current.play().catch(() => setAutoplayBlocked(true));
            }
            return;
          }
          if (videoType === "youtube" && playerRef.current) {
            try {
              const curTime = playerRef.current.getCurrentTime();
              if (Math.abs(curTime - data.currentTime) > 1) playerRef.current.seekTo(data.currentTime, true);
              playerRef.current.playVideo();
            } catch {}
          } else if (html5VideoRef.current) {
            const vid = html5VideoRef.current;
            if (Math.abs(vid.currentTime - data.currentTime) > 1) vid.currentTime = data.currentTime;
            vid.play().catch(() => setAutoplayBlocked(true));
          }
        } else {
          // Paused — only apply if already activated (no point activating a paused video)
          if (!videoActivatedRef.current) return;
          if (videoType === "youtube" && playerRef.current) {
            try {
              const curTime = playerRef.current.getCurrentTime();
              if (Math.abs(curTime - data.currentTime) > 1) playerRef.current.seekTo(data.currentTime, true);
              playerRef.current.pauseVideo();
            } catch {}
          } else if (html5VideoRef.current) {
            const vid = html5VideoRef.current;
            if (Math.abs(vid.currentTime - data.currentTime) > 1) vid.currentTime = data.currentTime;
            vid.pause();
          }
        }
      },
    );

    socket.on("video:question", (data: ActiveQuestion) => {
      teacherPlayingRef.current = false;
      setTeacherPlayingUi(false);
      setAutoplayBlocked(false);
      if (videoActivatedRef.current) {
        if (videoType === "youtube" && playerRef.current) {
          try { playerRef.current.pauseVideo(); } catch {}
        } else if (html5VideoRef.current) {
          html5VideoRef.current.pause();
        }
      }
      activeQuestionRef.current = data;
      setActiveQuestion(data);
      setSelectedAnswer(null);
      setAnswerResult(null);
    });

    socket.on("video:resume", (data: { currentTime: number }) => {
      teacherPlayingRef.current = true;
      setTeacherPlayingUi(true);
      activeQuestionRef.current = null;
      setActiveQuestion(null);
      setSelectedAnswer(null);
      setAnswerResult(null);
      // Teacher resumed — force activate and play
      tryPlayVideo(data.currentTime);
    });

    socket.on("video:session-ended", () => {
      setPhase("ended");
      activeQuestionRef.current = null;
      setActiveQuestion(null);
      // Clear stored session so student doesn't auto-rejoin a finished/stale room
      const code = roomCode || roomCodeFromUrl;
      if (code) {
        try { localStorage.removeItem(`hasad_video_${code}`); } catch {}
      }
    });

    socket.on("video:teacher-disconnected", () => {
      setTeacherDisconnected(true);
    });

    socket.on("video:teacher-reconnected", () => {
      setTeacherDisconnected(false);
    });

    // ── Re-join room on socket reconnect (socket.io fires "connect" on each (re)connect) ──
    const handleConnect = () => {
      if (phaseRef.current !== "watching") return;
      const storedCode = roomCode || roomCodeFromUrl;
      if (!storedCode) return;
      const stored = getStoredSession(storedCode);
      if (!stored) return;
      socket.emit(
        "video:join-room",
        {
          roomCode: stored.roomCode,
          name: stored.name,
          studentClass: stored.studentClass,
          existingParticipantId: stored.participantId,
        },
        (res: {
          success?: boolean;
          participantId?: string;
          lesson?: { title: string; videoUrl: string; videoType: string; skipSegments: { start: number; end: number }[] };
          videoState?: string;
          currentTime?: number;
          activeQuestion?: ActiveQuestion | null;
          error?: string;
        }) => {
          if (res.error) return;
          if (res.activeQuestion) {
            activeQuestionRef.current = res.activeQuestion;
            setActiveQuestion(res.activeQuestion);
          }
          if (typeof res.currentTime === "number") {
            lastTeacherTimeRef.current = res.currentTime;
          }
          if (res.videoState === "playing" && videoActivatedRef.current) {
            teacherPlayingRef.current = true;
            if (videoType === "youtube" && playerRef.current) {
              try {
                if (res.currentTime !== undefined) playerRef.current.seekTo(res.currentTime, true);
                playerRef.current.playVideo();
              } catch {}
            }
          }
        },
      );
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("video:sync-state");
      socket.off("video:question");
      socket.off("video:resume");
      socket.off("video:session-ended");
      socket.off("video:teacher-disconnected");
      socket.off("video:teacher-reconnected");
      socket.off("connect", handleConnect);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, videoType]);

  useEffect(() => {
    if (phase !== "watching" || !playerReady) return;

    const interval = setInterval(() => {
      if (!videoActivatedRef.current) return;
      const segs = skipSegmentsRef.current;
      if (!segs.length) return;
      try {
        let time = 0;
        if (videoType === "youtube" && playerRef.current) {
          time = playerRef.current.getCurrentTime();
        } else if (html5VideoRef.current) {
          time = html5VideoRef.current.currentTime;
        }
        const inSeg = segs.find((s) => time >= s.start && time < s.end);
        if (inSeg) {
          if (videoType === "youtube" && playerRef.current) {
            try { playerRef.current.seekTo(inSeg.end, true); } catch {}
          } else if (html5VideoRef.current) {
            html5VideoRef.current.currentTime = inSeg.end;
          }
        }
      } catch {}
    }, 300);

    return () => clearInterval(interval);
  }, [phase, playerReady, videoType]);

  useEffect(() => {
    if (phase !== "watching" || videoType !== "youtube" || !youtubeId) return;

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
      playerRef.current = new ytWindow.YT!.Player("yt-player-student", {
        videoId: youtubeId,
        playerVars: { controls: 0, modestbranding: 1, rel: 0, disablekb: 1, playsinline: 1 },
        events: {
          onReady: () => {
            setPlayerReady(true);
            // If teacher was already playing when we joined, attempt to seek+play
            // immediately. On mobile this will likely fail (no user gesture), but
            // onStateChange will detect the paused state and show the tap overlay.
            if (teacherPlayingRef.current && playerRef.current) {
              try {
                if (lastTeacherTimeRef.current > 0) {
                  playerRef.current.seekTo(lastTeacherTimeRef.current, true);
                }
                playerRef.current.playVideo();
                videoActivatedRef.current = true;
                setVideoActivated(true);
              } catch {}
            }
          },
          onStateChange: (event: { data: number }) => {
            // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            // State 1 = PLAYING
            if (event.data === 1) {
              if (!teacherPlayingRef.current) {
                // Playing without teacher authorization — force pause
                try { playerRef.current?.pauseVideo(); } catch {}
              } else {
                // Playing correctly — clear any blocked-autoplay overlay
                setAutoplayBlocked(false);
              }
              return;
            }
            // States 2 (paused), 5 (cued), -1 (unstarted): if teacher is playing
            // and we tried to start, the browser likely blocked autoplay (mobile).
            // Show the tap overlay so the student can resume with a direct gesture.
            if (
              (event.data === 2 || event.data === 5 || event.data === -1) &&
              teacherPlayingRef.current &&
              videoActivatedRef.current
            ) {
              setAutoplayBlocked(true);
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
  }, [phase, youtubeId, videoType]);

  const handleSubmitAnswer = (answer: string) => {
    if (!activeQuestion || submittingAnswer || answerResult) return;

    setSelectedAnswer(answer);
    setSubmittingAnswer(true);

    socketRef.current.emit(
      "video:student-answer",
      {
        roomCode: roomCode.trim().toUpperCase(),
        questionId: activeQuestion.id,
        answer,
      },
      (res: {
        isCorrect?: boolean;
        correctAnswer?: string | null;
        points?: number;
        error?: string;
      }) => {
        setSubmittingAnswer(false);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (typeof res.isCorrect === "boolean") {
          setAnswerResult({
            isCorrect: res.isCorrect,
            correctAnswer: res.correctAnswer ?? null,
            points: res.points ?? 0,
          });
        }
      },
    );
  };

  const handleActivateVideo = () => {
    // User tapped manually — play only if teacher is currently playing
    tryPlayVideo(undefined, false);
  };

  if (phase === "reconnecting") {
    return (
      <Layout>
        <div
          className="flex min-h-[100dvh] items-center justify-center px-4"
          style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-[#eef2ef]">
              <Wifi className="h-8 w-8 text-[#1E4D35] animate-pulse" />
            </div>
            <p className="text-lg font-black text-[#0f2918]">
              {isAr ? "جارٍ إعادة الاتصال بالجلسة..." : "Reconnecting to session..."}
            </p>
            <p className="text-sm font-semibold text-[#64748B]">
              {isAr ? "يرجى الانتظار لحظات" : "Please wait a moment"}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "join") {
    return (
      <Layout>
        <div
          className="min-h-[100dvh] overflow-x-hidden pb-12"
          style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="mx-auto max-w-3xl px-4 pt-8">
            <Link
              href="/"
              className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm font-bold text-[#64748B] transition-colors hover:text-[#1E4D35]"
            >
              <BackIcon className="h-4 w-4 opacity-70" />
              {isAr ? "العودة" : "Back"}
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[28px] border bg-white shadow-lg"
              style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0f2918]">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1E4D35] via-[#2d6b47] to-[#0f2918]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/15 backdrop-blur-md ring-2 ring-white/25">
                    <Radio className="h-10 w-10 text-white animate-pulse" />
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white backdrop-blur-sm ring-1 ring-white/20">
                    {isAr ? "● بث مباشر" : "● LIVE"}
                  </span>
                </div>
              </div>
              <div className="space-y-3 p-6 sm:p-8">
                <h1 className="text-start text-2xl font-black leading-tight text-[#0f2918] sm:text-3xl">
                  {isAr ? "الانضمام للبث التفاعلي" : "Join interactive live lesson"}
                </h1>
                <p className="text-start text-sm leading-relaxed text-[#64748B]">
                  {isAr
                    ? "أدخل كود الغرفة الذي يعطيك إياه المعلّم، ثم اسمك للدخول إلى نفس الجلسة."
                    : "Enter the room code from your teacher, then your name to enter the same session."}
                </p>
                <div className="flex flex-wrap justify-start gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef5f0] px-3 py-1.5 text-[11px] font-black text-[#1E4D35]">
                    <Film className="h-3.5 w-3.5" />
                    {isAr ? "فيديو تفاعلي — بث مباشر" : "Interactive live"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f7f4] px-3 py-1.5 text-[11px] font-black text-[#374151]">
                    <Users className="h-3.5 w-3.5 text-[#64748B]" />
                    {isAr ? "منصّة حصاد" : "Hasaad platform"}
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-6">
              <Card className="border border-[#e8ece9] bg-white p-6 sm:p-8 shadow-lg" style={{ borderRadius: "24px", boxShadow: CARD_SHADOW }}>
                <div
                  className="mb-5 flex gap-2.5 rounded-xl border border-[#dfe8e3] bg-[#f8faf9] px-3.5 py-2.5 text-start shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                  role="note"
                >
                  <Info className="h-4 w-4 shrink-0 text-[#1E4D35]/40 mt-0.5" aria-hidden />
                  <p className="text-[12.5px] leading-relaxed text-[#5a6b62] font-medium">
                    {isAr ? (
                      <>
                        <span className="font-semibold text-[#2d4238]">اسمك مطلوب</span> للانضمام وتسجيل إجاباتك. حقل الفصل{" "}
                        <span className="font-semibold text-[#2d4238]">اختياري</span>. بعد الدخول،{" "}
                        <span className="font-semibold text-[#2d4238]">الفيديو يعمل مع بثّ المعلّم</span>: انتظر حتى يضغط تشغيل من جهازه،
                        وسيتزامن العرض عندك تلقائياً (قد تحتاج للنقر مرة إذا منع المتصفح التشغيل التلقائي).
                      </>
                    ) : (
                      <>
                        Your <span className="font-semibold text-[#2d4238]">name is required</span> to join and save answers.{" "}
                        <span className="font-semibold text-[#2d4238]">Class is optional.</span> After joining,{" "}
                        <span className="font-semibold text-[#2d4238]">playback follows your teacher</span>: wait until they press play on their side;
                        your player syncs automatically (you may need one tap if the browser blocks autoplay).
                      </>
                    )}
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2 text-start">
                    <Label className="text-sm font-black text-[#0f2918]">{isAr ? "كود الغرفة" : "Room code"} *</Label>
                    <Input
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      dir="ltr"
                      maxLength={8}
                      className="mt-1 min-h-[52px] rounded-2xl border-2 border-[#e8ece9] bg-[#fcfdfc] text-center text-2xl font-black tracking-[0.3em] focus:border-[#1E4D35]/35 focus:ring-[#1E4D35]/10"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-2 text-start">
                      <Label className="text-sm font-black text-[#0f2918]">{isAr ? "اسمك" : "Your name"} *</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={isAr ? "اكتب اسمك الكامل" : "Full name"}
                        dir={isAr ? "rtl" : "ltr"}
                        className={cn(
                          "mt-1 min-h-[52px] rounded-2xl border-2 border-[#e8ece9] bg-[#fcfdfc] text-base font-semibold focus:border-[#1E4D35]/35 focus:ring-[#1E4D35]/10",
                          isAr ? FIELD_RTL : "",
                        )}
                      />
                    </div>
                    <div className="space-y-2 text-start">
                      <Label className="text-sm font-black text-[#0f2918]">{isAr ? "الفصل (اختياري)" : "Class (optional)"}</Label>
                      <Input
                        value={studentClass}
                        onChange={(e) => setStudentClass(e.target.value)}
                        placeholder={isAr ? "يمكنك تركه فارغاً" : "Can be left blank"}
                        dir={isAr ? "rtl" : "ltr"}
                        className={cn(
                          "mt-1 min-h-[52px] rounded-2xl border-2 border-[#e8ece9] bg-[#fcfdfc] text-base font-semibold focus:border-[#1E4D35]/35 focus:ring-[#1E4D35]/10",
                          isAr ? FIELD_RTL : "",
                        )}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining || !roomCode.trim() || !name.trim()}
                  className={cn(
                    "mt-8 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl text-base font-black text-white shadow-lg shadow-[#1E4D35]/22 transition-all hover:-translate-y-0.5 hover:opacity-[0.97] hover:shadow-xl active:translate-y-0 disabled:pointer-events-none disabled:opacity-45",
                    TRANSITION,
                  )}
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #2a6144 100%)` }}
                >
                  {joining ? (
                    <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <LogIn className="h-6 w-6 shrink-0" />
                  )}
                  {isAr ? "انضمام إلى الجلسة" : "Join session"}
                </button>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: <Radio className="h-5 w-5 text-[#1E4D35]" />,
                      t: isAr ? "البث متزامن مع شاشة المعلّم" : "Synced with your teacher",
                    },
                    {
                      icon: <BadgeCheck className="h-5 w-5 text-[#1E4D35]" />,
                      t: isAr ? "تتوقف الأسئلة عن الفيديو أثناء الإجابة" : "Questions pause the video",
                    },
                    {
                      icon: <Sparkles className="h-5 w-5 text-[#1E4D35]" />,
                      t: isAr ? "اكسب نقاطاً على الإجابات الصحيحة" : "Earn points for correct answers",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex gap-3 rounded-2xl border border-[#eef2ef] bg-[#fafdfb] p-4 text-start shadow-sm"
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

  if (phase === "ended") {
    return (
      <Layout>
        <div
          className="flex min-h-[100dvh] items-center justify-center px-4 py-12"
          style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
          dir={isAr ? "rtl" : "ltr"}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md space-y-6 text-center"
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#eef5f0] ring-2 ring-[#1E4D35]/15">
              <CheckCircle2 className="h-10 w-10 text-[#1E4D35]" />
            </div>
            <h1 className="text-2xl font-black text-[#0f2918]">
              {isAr ? "انتهت الجلسة!" : "Session ended!"}
            </h1>
            <p className="text-sm font-semibold text-[#64748B]">
              {isAr ? "شكراً لمشاركتك 🎉" : "Thanks for participating! 🎉"}
            </p>
            <button
              type="button"
              onClick={() => setLocation("/")}
              className="rounded-2xl bg-[#1E4D35] px-8 py-3 text-base font-black text-white shadow-lg shadow-[#1E4D35]/25 hover:opacity-95"
            >
              {isAr ? "الصفحة الرئيسية" : "Home"}
            </button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const overlayTeacherStarted = autoplayBlocked || teacherPlayingUi;

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
              onClick={() => setLocation("/")}
              className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-2xl border border-[#e8ece9] bg-white px-4 text-sm font-black text-[#64748B] shadow-sm transition-colors hover:bg-[#f9faf9]"
            >
              <BackIcon className="h-4 w-4" />
              {isAr ? "خروج" : "Exit"}
            </button>
            <h1 className="min-w-0 flex-1 truncate text-start text-lg font-black text-[#0f2918] sm:text-xl">{lessonTitle}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-[#b91c1c] shadow-sm ring-1 ring-red-100">
                <Radio className="h-3.5 w-3.5 animate-pulse" />
                {isAr ? "بث مباشر" : "LIVE"}
              </span>
              {teacherDisconnected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200/80">
                  <WifiOff className="h-3.5 w-3.5" />
                  {isAr ? "المعلم غير متصل" : "Teacher offline"}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <section
              className="overflow-hidden rounded-[24px] border bg-white shadow-lg"
              style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
            >
              <div className="relative">
                {videoType === "youtube" && youtubeId ? (
                  <div className="aspect-video bg-black">
                    <div id="yt-player-student" className="h-full w-full" />
                  </div>
                ) : videoUrl ? (
                  <video
                    ref={html5VideoRef}
                    src={videoUrl}
                    playsInline
                    muted
                    className="aspect-video w-full bg-black"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-black">
                    <Video className="h-16 w-16 text-white/30" />
                  </div>
                )}
                {(!videoActivated || autoplayBlocked) ? (
                  <button
                    type="button"
                    onClick={handleActivateVideo}
                    className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center bg-black/65 transition-colors hover:bg-black/55"
                  >
                    <div
                      className={`mb-3 flex h-20 w-20 items-center justify-center rounded-full backdrop-blur-sm ${
                        overlayTeacherStarted ? "bg-red-500/45 animate-pulse" : "bg-[#1E4D35]/50 ring-2 ring-white/30"
                      }`}
                    >
                      <Play className="h-10 w-10 fill-white text-white" />
                    </div>
                    <span className="max-w-[min(90%,22rem)] px-4 text-center text-lg font-black text-white leading-snug">
                      {overlayTeacherStarted
                        ? isAr
                          ? "المعلّم يشغّل الفيديو الآن — اضغط للمتابعة"
                          : "Your teacher is playing — tap to watch"
                        : isAr
                          ? "انتظر بدء المعلّم"
                          : "Waiting for your teacher"}
                    </span>
                    {!overlayTeacherStarted && (
                      <span className="mt-2 max-w-[min(92%,24rem)] px-4 text-center text-sm font-semibold leading-relaxed text-white/90">
                        {isAr
                          ? "الفيديو يعمل مع بثّ المعلّم فقط. سيتحرك تلقائياً عندما يضغط تشغيل؛ يمكنك أيضاً النقر لتجهيز الشاشة إذا احتجت."
                          : "Playback follows your teacher. It moves automatically when they press play — or tap once to prepare the player."}
                      </span>
                    )}
                    {overlayTeacherStarted && (
                      <span className="mt-2 text-sm font-bold text-red-200 animate-pulse">
                        {isAr ? "● متزامن مع البث" : "● Live sync"}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="pointer-events-auto absolute inset-0 z-10" />
                )}
              </div>
            </section>

          <AnimatePresence>
            {activeQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="mt-4"
              >
                <Card className="p-5 border-2 border-amber-500/50 bg-gradient-to-b from-amber-50/80 to-background dark:from-amber-950/30">
                  <p className="text-lg sm:text-xl font-black mb-5 text-center">
                    {activeQuestion.text}
                  </p>

                  {answerResult ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-center space-y-4"
                    >
                      {answerResult.isCorrect ? (
                        <div className="space-y-2">
                          <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-green-500" />
                          </div>
                          <p className="text-xl font-black text-green-600 dark:text-green-400">
                            {isAr ? "إجابة صحيحة! 🎉" : "Correct! 🎉"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isAr
                              ? `حصلت على ${answerResult.points} نقطة`
                              : `You earned ${answerResult.points} points`}
                          </p>
                          <p className="text-sm font-bold text-green-600 dark:text-green-400">
                            {isAr ? "أحسنت! واصل التميز 🌟" : "Great job! Keep it up 🌟"}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
                            <XCircle className="w-10 h-10 text-red-500" />
                          </div>
                          <p className="text-xl font-black text-red-600 dark:text-red-400">
                            {isAr ? "إجابة خاطئة" : "Incorrect"}
                          </p>
                          <p className="text-sm font-bold">
                            {isAr ? "الإجابة الصحيحة:" : "Correct answer:"}{" "}
                            <span className="text-green-600 dark:text-green-400">
                              {answerResult.correctAnswer === "true"
                                ? isAr
                                  ? "صح"
                                  : "True"
                                : answerResult.correctAnswer === "false"
                                  ? isAr
                                    ? "خطأ"
                                    : "False"
                                  : activeQuestion.questionType === "mcq"
                                    ? (() => {
                                        const map: Record<string, string | null> = {
                                          A: activeQuestion.optionA,
                                          B: activeQuestion.optionB,
                                          C: activeQuestion.optionC,
                                          D: activeQuestion.optionD,
                                        };
                                        return map[answerResult.correctAnswer || ""] || answerResult.correctAnswer;
                                      })()
                                    : answerResult.correctAnswer}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {isAr ? "لا بأس! حاول في المرة القادمة 💪" : "Don't worry! Try next time 💪"}
                          </p>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-3">
                        {isAr
                          ? "انتظر المعلم لمتابعة الفيديو..."
                          : "Waiting for teacher to resume..."}
                      </p>
                    </motion.div>
                  ) : activeQuestion.questionType === "mcq" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { key: "A", text: activeQuestion.optionA, color: "bg-blue-500" },
                        { key: "B", text: activeQuestion.optionB, color: "bg-green-500" },
                        { key: "C", text: activeQuestion.optionC, color: "bg-amber-500" },
                        { key: "D", text: activeQuestion.optionD, color: "bg-red-500" },
                      ]
                        .filter((o) => o.text)
                        .map((o) => (
                          <button
                            key={o.key}
                            onClick={() => handleSubmitAnswer(o.key)}
                            disabled={submittingAnswer || !!selectedAnswer}
                            className={`p-4 rounded-xl border-2 text-start font-bold transition-all ${
                              selectedAnswer === o.key
                                ? `${o.color} text-white border-transparent scale-95`
                                : "border-border hover:border-primary hover:bg-muted"
                            } disabled:cursor-not-allowed`}
                          >
                            <span className="font-black text-lg ml-1 mr-1">{o.key}.</span>{" "}
                            {o.text}
                          </button>
                        ))}
                    </div>
                  ) : activeQuestion.questionType === "true_false" ? (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        {
                          value: "true",
                          label: isAr ? "صح ✓" : "True ✓",
                          color: "bg-green-500",
                        },
                        {
                          value: "false",
                          label: isAr ? "خطأ ✗" : "False ✗",
                          color: "bg-red-500",
                        },
                      ].map((o) => (
                        <button
                          key={o.value}
                          onClick={() => handleSubmitAnswer(o.value)}
                          disabled={submittingAnswer || !!selectedAnswer}
                          className={`p-5 rounded-xl border-2 text-center font-black text-lg transition-all ${
                            selectedAnswer === o.value
                              ? `${o.color} text-white border-transparent scale-95`
                              : "border-border hover:border-primary hover:bg-muted"
                          } disabled:cursor-not-allowed`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <FillBlankInput
                      isAr={isAr}
                      disabled={submittingAnswer || !!selectedAnswer}
                      onSubmit={handleSubmitAnswer}
                    />
                  )}
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </div>
    </Layout>
  );
}

function FillBlankInput({
  isAr,
  disabled,
  onSubmit,
}: {
  isAr: boolean;
  disabled: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div className="flex gap-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isAr ? "اكتب الإجابة..." : "Type your answer..."}
        className="flex-1 text-lg font-bold"
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
        }}
      />
      <button
        onClick={() => {
          if (value.trim()) onSubmit(value.trim());
        }}
        disabled={disabled || !value.trim()}
        className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold disabled:opacity-50"
      >
        {isAr ? "إرسال" : "Submit"}
      </button>
    </div>
  );
}
