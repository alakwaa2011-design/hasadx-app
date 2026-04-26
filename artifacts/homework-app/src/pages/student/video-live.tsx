import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";

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
      elementId: string,
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
  // Last received teacher time — used so the player can sync to the right
  // position once it becomes ready, even if sync events arrived while the
  // YouTube iframe was still loading.
  const lastTeacherTimeRef = useRef(0);
  const html5VideoRef = useRef<HTMLVideoElement>(null);
  const skipSegmentsRef = useRef<{ start: number; end: number }[]>([]);

  const youtubeId = videoType === "youtube" ? extractYouTubeId(videoUrl) : null;
  const socketRef = useRef(getSocket());

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
          if (res.videoState === "playing") {
            teacherPlayingRef.current = true;
          }
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
          if (res.videoState === "playing") {
            teacherPlayingRef.current = true;
          }
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
        teacherPlayingRef.current = data.state === "playing";
        lastTeacherTimeRef.current = data.currentTime;
        if (activeQuestionRef.current) return;

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
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <Wifi className="w-12 h-12 text-red-500 mx-auto animate-pulse" />
            <p className="text-lg font-black">
              {isAr ? "جارٍ إعادة الاتصال..." : "Reconnecting..."}
            </p>
            <p className="text-sm text-muted-foreground">
              {isAr ? "يرجى الانتظار" : "Please wait"}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (phase === "join") {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-8">
              <div className="p-4 bg-red-500/10 rounded-full w-20 h-20 mx-auto flex items-center justify-center mb-4">
                <Radio className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-2xl font-black">
                {isAr ? "انضم للبث المباشر" : "Join Live Broadcast"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isAr
                  ? "أدخل كود الغرفة واسمك للانضمام"
                  : "Enter room code and your name to join"}
              </p>
            </div>

            <Card className="p-6 space-y-4">
              <div>
                <Label className="text-sm font-bold">
                  {isAr ? "كود الغرفة" : "Room Code"} *
                </Label>
                <Input
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  dir="ltr"
                  className="text-center text-2xl font-black tracking-[0.3em] mt-1"
                  maxLength={8}
                />
              </div>
              <div>
                <Label className="text-sm font-bold">
                  {isAr ? "اسمك" : "Your Name"} *
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isAr ? "محمد أحمد" : "John Doe"}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-bold">
                  {isAr ? "الفصل" : "Class"}
                </Label>
                <Input
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder={isAr ? "مثال: 3/أ" : "e.g., 3/A"}
                  className="mt-1"
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={joining || !roomCode.trim() || !name.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joining ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {isAr ? "انضمام" : "Join"}
              </button>
            </Card>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (phase === "ended") {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-md text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="space-y-6"
          >
            <div className="p-4 bg-green-500/10 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-black">
              {isAr ? "انتهت الجلسة!" : "Session ended!"}
            </h1>
            <p className="text-muted-foreground">
              {isAr ? "شكراً لمشاركتك 🎉" : "Thanks for participating! 🎉"}
            </p>
            <button
              onClick={() => setLocation("/")}
              className="py-3 px-8 bg-primary text-primary-foreground rounded-xl font-bold"
            >
              {isAr ? "الصفحة الرئيسية" : "Home"}
            </button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 text-red-500">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="font-bold text-sm">{isAr ? "بث مباشر" : "LIVE"}</span>
          </div>
          <h1 className="text-lg font-black truncate flex-1">{lessonTitle}</h1>
          {teacherDisconnected && (
            <div className="flex items-center gap-1 text-amber-500">
              <WifiOff className="w-4 h-4" />
              <span className="text-xs font-bold">
                {isAr ? "المعلم غير متصل" : "Teacher disconnected"}
              </span>
            </div>
          )}
        </div>

        <div className="relative">
          <Card className="overflow-hidden">
            <div className="relative">
              {videoType === "youtube" && youtubeId ? (
                <div className="aspect-video bg-black">
                  <div id="yt-player-student" className="w-full h-full" />
                </div>
              ) : videoUrl ? (
                <video
                  ref={html5VideoRef}
                  src={videoUrl}
                  playsInline
                  muted
                  className="w-full aspect-video bg-black"
                />
              ) : (
                <div className="aspect-video bg-black flex items-center justify-center">
                  <Video className="w-16 h-16 text-white/30" />
                </div>
              )}
              {(!videoActivated || autoplayBlocked) ? (
                <button
                  onClick={handleActivateVideo}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 cursor-pointer transition-colors hover:bg-black/50"
                >
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm ${
                    autoplayBlocked || teacherPlayingRef.current
                      ? "bg-red-500/40 animate-pulse"
                      : "bg-white/20"
                  }`}>
                    <Play className="w-10 h-10 text-white fill-white" />
                  </div>
                  <span className="text-white font-bold text-lg">
                    {autoplayBlocked || teacherPlayingRef.current
                      ? isAr ? "المعلم بدأ الفيديو ← اضغط هنا" : "Teacher started → Tap to watch"
                      : isAr ? "انقر لبدء المشاهدة" : "Tap to start watching"}
                  </span>
                  {(autoplayBlocked || teacherPlayingRef.current) && (
                    <span className="text-red-300 text-sm font-bold mt-1 animate-pulse">
                      {isAr ? "● بث مباشر" : "● LIVE"}
                    </span>
                  )}
                </button>
              ) : (
                <div className="absolute inset-0 z-10 pointer-events-auto" />
              )}
            </div>
          </Card>

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
