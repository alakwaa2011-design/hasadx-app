import { useState, useRef, useEffect, useMemo } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { useGetAssignment, useSubmitAssignment, useSubmitAssignmentImage, useStartExamSession, useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "@/components/ui/sonner";
import { Gamepad2 } from "lucide-react";
import { disconnectSocket } from "@/lib/socket";
import type { AnswerBody, SubmissionResult } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input, Button, Label } from "@/components/ui-elements";
import { fileToBase64 } from "@/lib/utils";
import { Camera, MousePointerClick, Send, BrainCircuit, CheckCircle2, XCircle, ChevronLeft, ChevronRight, FileText, Star, GraduationCap, Lock, AlertCircle, EyeOff, Clock, Users, Volume2, VolumeX, Sparkles, Headphones, Play, Pause, Loader2, Gauge, RotateCcw, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { WhiteboardCanvas } from "@/components/whiteboard-canvas";
import { getSocket } from "@/lib/socket";
import { ConfettiBurst } from "@/components/confetti-burst";
import { feedbackOnSelect, feedbackOnCelebrate, isSolveSoundEnabled, setSolveSoundEnabled } from "@/lib/solve-feedback";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getDeviceFingerprint(): string {
  const key = "hw_device_fp";
  let fp = localStorage.getItem(key);
  if (!fp) {
    fp = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    localStorage.setItem(key, fp);
  }
  return fp;
}

const OPTION_LABELS = ["A", "B", "C", "D"] as const;
const OPTION_COLORS = [
  "from-blue-500 to-blue-600",
  "from-violet-500 to-violet-600",
  "from-primary to-primary/80",
  "from-emerald-500 to-emerald-600",
];

type ListeningSettings = {
  maxListens?: number;
  allowSpeedControl?: boolean;
  allowSeek?: boolean;
  showTranscript?: boolean;
};

function ListeningPlayer({
  assignmentId,
  audioText,
  defaultSpeed,
  settings,
  lang,
  accessCode,
}: {
  assignmentId: number;
  audioText: string | null;
  defaultSpeed: string;
  settings: ListeningSettings;
  lang: "ar" | "en";
  accessCode?: string;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [listensUsed, setListensUsed] = useState(0);
  const [speed, setSpeed] = useState<number>(parseFloat(defaultSpeed) || 1);
  const [showText, setShowText] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const maxListens = settings.maxListens ?? 0;
  const unlimited = !maxListens || maxListens <= 0;
  const remaining = unlimited ? Infinity : Math.max(0, maxListens - listensUsed);
  const exhausted = !unlimited && remaining <= 0;

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioUrl]);

  const fetchAudio = async (): Promise<string | null> => {
    if (audioUrl) return audioUrl;
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (accessCode) headers["X-Access-Code"] = accessCode;
      const res = await fetch(`${API_BASE}/api/assignments/${assignmentId}/listening-audio`, {
        method: "GET",
        credentials: "include",
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      // Assign directly so we don't have to wait for a re-render before play().
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
      }
      return url;
    } catch (e) {
      setError(lang === "ar" ? "تعذر تحميل الصوت، حاول مرة أخرى" : "Failed to load audio, try again");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (exhausted && !isPlaying) {
      toast.error(lang === "ar" ? "لقد استنفدت عدد مرات الاستماع المسموحة" : "You have used all allowed listens");
      return;
    }
    let url = audioUrl;
    if (!url) {
      url = await fetchAudio();
      if (!url) return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (!el.src) el.src = url;
    if (isPlaying) {
      el.pause();
    } else {
      el.playbackRate = speed;
      try {
        await el.play();
      } catch {
        // ignore autoplay/race errors
      }
    }
  };

  const seekBy = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    const dur = isFinite(el.duration) ? el.duration : (duration || el.currentTime + Math.abs(delta));
    el.currentTime = Math.max(0, Math.min(dur, el.currentTime + delta));
  };

  const canRewind = currentTime > 0.5;
  const canForward = duration === 0 || currentTime < duration - 0.5;

  const onEnded = () => {
    setIsPlaying(false);
    setListensUsed((n) => n + 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-emerald-300/60 dark:border-emerald-700/50 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/30 dark:via-background dark:to-emerald-950/20 p-5 md:p-6 shadow-sm"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 shrink-0 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
          <Headphones className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-lg leading-tight">
            {lang === "ar" ? "نشاط استماع" : "Listening activity"}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lang === "ar"
              ? "اضغط زر التشغيل للاستماع للنص ثم أجب على الأسئلة"
              : "Press play to listen, then answer the questions"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={handlePlayPause}
          disabled={loading || (exhausted && !isPlaying)}
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-black text-base shadow-md transition-all ${
            exhausted && !isPlaying
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          <span>
            {loading
              ? (lang === "ar" ? "جاري التحميل…" : "Loading…")
              : isPlaying
              ? (lang === "ar" ? "إيقاف" : "Pause")
              : (lang === "ar" ? "استمع" : "Listen")}
          </span>
        </motion.button>

        {!unlimited && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-sm font-bold">
            <Volume2 className="w-4 h-4" />
            {lang === "ar"
              ? `المتبقي: ${remaining} من ${maxListens}`
              : `Remaining: ${remaining} of ${maxListens}`}
          </div>
        )}

        {settings.allowSpeedControl && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-card border-2 border-emerald-200 dark:border-emerald-800">
            <Gauge className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <select
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="bg-transparent text-sm font-bold focus:outline-none"
            >
              {[0.75, 1, 1.25, 1.5].map((s) => (
                <option key={s} value={s}>{s}x</option>
              ))}
            </select>
          </div>
        )}

        {settings.showTranscript && (
          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-card border-2 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
          >
            <FileText className="w-4 h-4" />
            {showText
              ? (lang === "ar" ? "إخفاء النص" : "Hide text")
              : (lang === "ar" ? "عرض النص" : "Show text")}
          </button>
        )}
      </div>

      {showText && settings.showTranscript && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 p-4 rounded-xl bg-white/70 dark:bg-card/60 border border-emerald-200 dark:border-emerald-800 text-sm leading-relaxed whitespace-pre-wrap"
        >
          {audioText}
        </motion.div>
      )}

      {error && (
        <p className="mt-3 text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={() => seekBy(-10)}
          disabled={!audioUrl || !canRewind}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-card border-2 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
          aria-label={lang === "ar" ? "إرجاع 10 ثوانٍ" : "Back 10 seconds"}
        >
          <RotateCcw className="w-4 h-4" />
          <span>{lang === "ar" ? "−10ث" : "−10s"}</span>
        </button>
        <button
          type="button"
          onClick={() => seekBy(10)}
          disabled={!audioUrl || !canForward}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-card border-2 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
          aria-label={lang === "ar" ? "تقديم 10 ثوانٍ" : "Forward 10 seconds"}
        >
          <RotateCw className="w-4 h-4" />
          <span>{lang === "ar" ? "+10ث" : "+10s"}</span>
        </button>
      </div>
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime || 0)}
        onLoadedMetadata={(e) => {
          const d = (e.target as HTMLAudioElement).duration;
          setDuration(isFinite(d) ? d : 0);
        }}
        controls={settings.allowSeek === true && !!audioUrl}
        className={settings.allowSeek === true && audioUrl ? "w-full mt-3" : "hidden"}
      />
    </motion.div>
  );
}

function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={10} stroke="currentColor" fill="none" className="text-muted/30" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} strokeWidth={10} stroke={color} fill="none"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - filled }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ScoreStars({ score }: { score: number }) {
  const stars = score >= 90 ? 3 : score >= 60 ? 2 : score >= 30 ? 1 : 0;
  return (
    <div className="flex items-center justify-center gap-1 my-2">
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: i <= stars ? 1 : 0.7, rotate: 0 }}
          transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 260 }}
        >
          <Star className={`w-8 h-8 ${i <= stars ? "text-primary fill-primary" : "text-muted/30"}`} />
        </motion.div>
      ))}
    </div>
  );
}

export default function StudentSolve() {
  const [, params] = useRoute("/solve/:id");
  const id = parseInt(params?.id || "0");
  const searchStr = useSearch();
  const urlAccessCode = useMemo(() => {
    const sp = new URLSearchParams(searchStr);
    return (sp.get("code") || sp.get("accessCode") || "").trim();
  }, [searchStr]);
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const BackIcon = lang === "ar" ? ChevronLeft : ChevronRight;
  const [, setSolveLocation] = useLocation();

  // Persist the access code in sessionStorage so a refresh inside the same
  // tab keeps the student from having to re-enter it.
  const accessCodeStorageKey = `hw_access_code_${id}`;
  const [verifiedAccessCode, setVerifiedAccessCode] = useState<string>(() => {
    if (typeof window === "undefined" || !id) return "";
    if (urlAccessCode) return urlAccessCode;
    try { return sessionStorage.getItem(accessCodeStorageKey) || ""; } catch { return ""; }
  });
  const { data: assignment, isLoading, error: assignmentError, refetch: refetchAssignment } = useGetAssignment(id, {
    request: verifiedAccessCode
      ? { headers: { "X-Access-Code": verifiedAccessCode } }
      : undefined,
    query: {
      // Include the code in the queryKey so changing the code triggers a
      // refetch with the new header.
      queryKey: [`/api/assignments/${id}`, verifiedAccessCode],
      retry: false,
    },
  });
  const { data: currentTeacher } = useGetCurrentTeacher({ query: { retry: false } as any });
  const [launchingShared, setLaunchingShared] = useState(false);
  const [pendingAccessCode, setPendingAccessCode] = useState("");
  const [accessCodePromptError, setAccessCodePromptError] = useState("");

  // Detect "access code required" 403 from the assignment fetch and surface
  // the gated prompt with the assignment title only.
  const accessCodeGate = (() => {
    if (!assignmentError) return null;
    const data = (assignmentError as any)?.data;
    if (data && data.requiresAccessCode) {
      return { title: data.title as string | undefined };
    }
    return null;
  })();

  const isSharedForOtherTeacher =
    !!currentTeacher &&
    !!assignment &&
    (assignment as any).isShared &&
    (assignment as any).isShareApproved &&
    (assignment as any).teacherId !== (currentTeacher as any).id;

  const launchSharedAsTeacher = () => {
    if (!id) return;
    setLaunchingShared(true);
    import("@/lib/socket").then(({ getSocket }) => {
      const socket = getSocket();
      socket.emit(
        "teacher:create-game",
        { assignmentId: id, gameMode: "solo" },
        (res: { pin?: string; error?: string }) => {
          setLaunchingShared(false);
          if (res?.error || !res?.pin) {
            toast.error(res?.error || (lang === "ar" ? "تعذّر بدء المسابقة" : "Failed to start"));
            disconnectSocket();
            return;
          }
          setSolveLocation(`/teacher/game/${res.pin}`);
        },
      );
    });
  };
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [studentId, setStudentId] = useState<number | null>(null);
  const [classStudents, setClassStudents] = useState<{ id: number; name: string; gradeLevel: string }[]>([]);
  const [accessCode, setAccessCode] = useState(verifiedAccessCode || "");
  useEffect(() => {
    if (!urlAccessCode) return;
    try { sessionStorage.setItem(accessCodeStorageKey, urlAccessCode); } catch {}
    setVerifiedAccessCode(urlAccessCode);
    setAccessCode(urlAccessCode);
    setPendingAccessCode(urlAccessCode);
  }, [accessCodeStorageKey, urlAccessCode]);
  // Keep the legacy `accessCode` field in sync after the student verifies the
  // code through the gate prompt so the eventual submit/start-exam payload
  // includes it without re-typing.
  useEffect(() => {
    if (verifiedAccessCode && !accessCode) setAccessCode(verifiedAccessCode);
  }, [verifiedAccessCode, accessCode]);
  const [accessError, setAccessError] = useState("");
  const [mode, setMode] = useState<'mcq' | 'image'>('mcq');

  useEffect(() => {
    if (!assignment || !id) return;
    const hasClasses = !!assignment.targetClass || (Array.isArray((assignment as any).targetClasses) && (assignment as any).targetClasses.length > 0);
    if (!hasClasses) return;
    // Forward the verified access code so the server unlocks the roster for
    // private assignments. Without it the server returns 403 (by design).
    const headers: Record<string, string> = {};
    if (verifiedAccessCode) headers["X-Access-Code"] = verifiedAccessCode;
    fetch(`${API_BASE}/api/assignments/${id}/class-students`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setClassStudents(data);
          const tc = (assignment as any).targetClasses;
          const list: string[] = Array.isArray(tc) && tc.length > 0 ? tc : (assignment.targetClass ? [assignment.targetClass] : []);
          if (list.length === 1) setStudentClass(list[0]);
        }
      })
      .catch(() => {});
  }, [assignment, id, verifiedAccessCode]);

  // Submit the typed code: try fetching the assignment with it as a header.
  // If the server now returns 200, store the code and move on; otherwise
  // surface a clear "wrong code" message without leaking timing.
  const submitAccessCodePrompt = async () => {
    const code = pendingAccessCode.trim();
    if (!code) {
      setAccessCodePromptError(lang === "ar" ? "أدخل رمز الوصول" : "Enter the access code");
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/api/assignments/${id}`, {
        credentials: "include",
        headers: { "X-Access-Code": code },
      });
      if (!r.ok) {
        setAccessCodePromptError(lang === "ar" ? "رمز الوصول غير صحيح" : "Incorrect access code");
        return;
      }
      try { sessionStorage.setItem(accessCodeStorageKey, code); } catch {}
      setVerifiedAccessCode(code);
      setAccessCodePromptError("");
      // Trigger a refetch with the new code in the queryKey/header.
      setTimeout(() => { void refetchAssignment(); }, 0);
    } catch {
      setAccessCodePromptError(lang === "ar" ? "تعذّر التحقق من الرمز" : "Could not verify the code");
    }
  };

  const draftStorageKey = `hw_draft_answers_${id}`;
  const loadDraft = (): Record<number, string> => {
    if (typeof window === "undefined" || !id) return {};
    try {
      const raw = localStorage.getItem(`hw_draft_answers_${id}`);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const out: Record<number, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const n = Number(k);
        if (Number.isInteger(n) && n > 0 && typeof v === "string") {
          out[n] = v;
        }
      }
      return out;
    } catch {
      return {};
    }
  };
  const [answers, setAnswers] = useState<Record<number, string>>(loadDraft);
  const [confirmedMultiAnswers, setConfirmedMultiAnswers] = useState<Set<number>>(() => {
    const initial = loadDraft();
    const s = new Set<number>();
    for (const [k, v] of Object.entries(initial)) {
      if (typeof v === "string" && v.includes(",")) s.add(Number(k));
    }
    return s;
  });
  const [draftRestored, setDraftRestored] = useState<boolean>(() => Object.keys(loadDraft()).length > 0);

  useEffect(() => {
    if (typeof window === "undefined" || !id) return;
    try {
      const hasAnswers = Object.values(answers).some(v => v !== undefined && v !== "");
      if (hasAnswers) {
        localStorage.setItem(draftStorageKey, JSON.stringify(answers));
      } else {
        localStorage.removeItem(draftStorageKey);
      }
    } catch {}
  }, [answers, draftStorageKey, id]);

  const clearDraft = () => {
    try { localStorage.removeItem(draftStorageKey); } catch {}
    setDraftRestored(false);
  };

  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => isSolveSoundEnabled());
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setSolveSoundEnabled(next);
    if (next) feedbackOnSelect();
  };
  const celebratedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [repeatRound, setRepeatRound] = useState<boolean>(false);
  const [repeatAnswers, setRepeatAnswers] = useState<Record<number, string>>({});
  const [firstRoundResult, setFirstRoundResult] = useState<SubmissionResult | null>(null);
  const [repeatSubmitting, setRepeatSubmitting] = useState(false);
  const [repeatError, setRepeatError] = useState("");
  const [examStarted, setExamStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const autoSubmitRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());
  const [examSessionId, setExamSessionId] = useState<number | null>(null);

  const startExam = useStartExamSession({
    mutation: {
      onSuccess: (data) => {
        setExamSessionId(data.sessionId);
        const expiresAt = new Date(data.expiresAt).getTime();
        const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        setTimeLeft(remaining);
        setExamStarted(true);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || "Error starting exam";
        setAccessError(msg);
      }
    }
  });

  const submitMcq = useSubmitAssignment({
    mutation: {
      onSuccess: (data) => {
        if (!assignment) { setResult(data); return; }
        let repeatableWrongIds: number[] = [];
        if (data.showResults && data.answers?.length) {
          repeatableWrongIds = (data.answers as Array<{ questionId: number; isCorrect: boolean }>)
            .filter((ans) => !ans.isCorrect)
            .map((ans) => ans.questionId)
            .filter((qId: number) => {
              const q = assignment.questions.find(q => q.id === qId);
              return q?.repeatQuestion === true;
            });
        } else if (!data.showResults && data.repeatEligibleIds?.length) {
          repeatableWrongIds = (data.repeatEligibleIds as number[]).filter((qId: number) => {
            const q = assignment.questions.find(q => q.id === qId);
            return q?.repeatQuestion === true;
          });
        }
        if (repeatableWrongIds.length > 0) {
          setFirstRoundResult(data);
          setRepeatRound(true);
          setRepeatAnswers({});
        } else {
          setResult(data);
        }
        clearDraft();
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || t.solve.error;
        setAccessError(msg);
      }
    }
  });

  const submitImg = useSubmitAssignmentImage({
    mutation: {
      onSuccess: (data) => { setResult(data); clearDraft(); },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || t.solve.error;
        setAccessError(msg);
      }
    }
  });

  const submissionMode = assignment?.submissionMode || "both";

  useEffect(() => {
    if (assignment) {
      const sm = assignment.submissionMode || "both";
      if (sm === "paper") {
        setMode("image");
      } else if (sm === "electronic") {
        setMode("mcq");
      }
    }
  }, [assignment]);

  const isExamMode = assignment?.examMode === true;
  const examDuration = assignment?.examDurationMinutes;

  const [whiteboardLocked, setWhiteboardLocked] = useState<Record<number, boolean>>({});
  const [whiteboardClearTrigger, setWhiteboardClearTrigger] = useState<Record<number, number>>({});
  const [teacherStrokes, setTeacherStrokes] = useState<Record<number, import("@/components/whiteboard-canvas").Stroke[]>>({});

  useEffect(() => {
    if (!assignment || !studentName.trim() || !studentClass.trim()) return;
    const wbQuestions = assignment.questions.filter(q => q.questionType === "whiteboard");
    if (wbQuestions.length === 0) return;

    const socket = getSocket();

    wbQuestions.forEach(q => {
      socket.emit("whiteboard:student-join", {
        assignmentId: id,
        questionId: q.id,
        studentName,
        studentClass,
      });
    });

    socket.on("whiteboard:lock-state", (data: { locked: boolean; assignmentId: number; questionId: number }) => {
      if (data.assignmentId !== id) return;
      setWhiteboardLocked(prev => ({ ...prev, [data.questionId]: data.locked }));
    });

    socket.on("whiteboard:cleared-by-teacher", (data: { assignmentId: number; questionId: number }) => {
      if (data.assignmentId !== id) return;
      setWhiteboardClearTrigger(prev => ({ ...prev, [data.questionId]: (prev[data.questionId] || 0) + 1 }));
      setTeacherStrokes(prev => ({ ...prev, [data.questionId]: [] }));
    });

    socket.on("whiteboard:teacher-drew", (data: { stroke: import("@/components/whiteboard-canvas").Stroke; assignmentId: number; questionId: number }) => {
      if (data.assignmentId !== id) return;
      setTeacherStrokes(prev => ({
        ...prev,
        [data.questionId]: [...(prev[data.questionId] || []), data.stroke],
      }));
    });

    socket.on("whiteboard:teacher-undo", (data: { assignmentId: number; questionId: number; strokes: import("@/components/whiteboard-canvas").Stroke[] }) => {
      if (data.assignmentId !== id) return;
      const tStrokes = data.strokes.filter((s: any) => s.isTeacher);
      setTeacherStrokes(prev => ({
        ...prev,
        [data.questionId]: tStrokes,
      }));
    });

    return () => {
      socket.off("whiteboard:lock-state");
      socket.off("whiteboard:cleared-by-teacher");
      socket.off("whiteboard:teacher-drew");
      socket.off("whiteboard:teacher-undo");
    };
  }, [assignment, studentName, studentClass, id]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, result]);

  useEffect(() => {
    if (timeLeft === 0 && !result && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      handleMcqSubmit();
    }
  }, [timeLeft, result]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (assignment && (assignment as unknown as Record<string, unknown>).isAdaptive) {
      window.location.replace(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/solve/adaptive/${id}`);
    }
  }, [assignment, id]);

  const wrongRepeatQuestions = useMemo(() => {
    if (!repeatRound || !firstRoundResult || !assignment) return [];
    return assignment.questions.filter(q => {
      if (q.repeatQuestion !== true) return false;
      if (firstRoundResult.showResults && firstRoundResult.answers?.length) {
        return (firstRoundResult.answers as Array<{ questionId: number; isCorrect: boolean }>)
          .some((a) => a.questionId === q.id && !a.isCorrect);
      }
      return (firstRoundResult.repeatEligibleIds || []).includes(q.id);
    });
  }, [repeatRound, firstRoundResult, assignment]);

  useEffect(() => {
    if (repeatRound && firstRoundResult && wrongRepeatQuestions.length === 0) {
      setRepeatRound(false);
      setResult(firstRoundResult);
    }
  }, [repeatRound, firstRoundResult, wrongRepeatQuestions.length]);

  useEffect(() => {
    if (!result || celebratedRef.current) return;
    const canSeeResults = result.showResults !== false;
    const score = Math.round(result.score);
    if (canSeeResults && score >= 80) {
      celebratedRef.current = true;
      feedbackOnCelebrate();
    }
  }, [result]);

  if (isLoading) return <Layout><div className="flex h-96 items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" /></div></Layout>;
  // If the assignment fetch was rejected because the assignment is private and
  // we don't have the right access code, render only a code prompt — no
  // questions, no class info, no deadline, nothing else leaks.
  if (accessCodeGate) {
    return (
      <Layout>
        <div className="max-w-md mx-auto mt-16 p-6 bg-card border-2 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Lock className="w-5 h-5" />
            <h2 className="text-lg font-bold">
              {accessCodeGate.title || (lang === "ar" ? "واجب مغلق" : "Private assignment")}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {lang === "ar"
              ? "هذا الواجب يتطلّب رمز وصول. اطلبه من معلمك."
              : "This assignment requires an access code from your teacher."}
          </p>
          <Input
            value={pendingAccessCode}
            onChange={e => { setPendingAccessCode(e.target.value); setAccessCodePromptError(""); }}
            onKeyDown={e => { if (e.key === "Enter") void submitAccessCodePrompt(); }}
            placeholder={lang === "ar" ? "أدخل رمز الوصول" : "Enter access code"}
            className="text-base font-mono tracking-widest border-2"
            dir="ltr"
            autoFocus
          />
          {accessCodePromptError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {accessCodePromptError}
            </div>
          )}
          <Button onClick={() => void submitAccessCodePrompt()} className="w-full">
            {lang === "ar" ? "متابعة" : "Continue"}
          </Button>
        </div>
      </Layout>
    );
  }
  if (!assignment) return <Layout><div className="text-center p-20 text-xl font-bold">{t.solve.notFound}</div></Layout>;
  if ((assignment as unknown as Record<string, unknown>).isAdaptive) return <Layout><div className="flex h-96 items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" /></div></Layout>;

  const isExpired = assignment.deadline ? new Date(assignment.deadline) < new Date() : false;

  if (repeatRound && firstRoundResult && assignment && wrongRepeatQuestions.length > 0) {
    const canSubmitRepeat = wrongRepeatQuestions.every(q => repeatAnswers[q.id] !== undefined && repeatAnswers[q.id] !== "");
    const handleRepeatSubmit = async () => {
      setRepeatSubmitting(true);
      setRepeatError("");
      try {
        const answers = Object.entries(repeatAnswers).map(([qId, selectedAnswer]) => ({
          questionId: parseInt(qId),
          selectedAnswer,
        }));
        const deviceFingerprint = getDeviceFingerprint();
        const res = await fetch(`${API_BASE}/api/assignments/${id}/submissions/${firstRoundResult.id}/repeat`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, deviceFingerprint }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "خطأ في إرسال إجابات التكرار");
        setRepeatRound(false);
        setResult(data as SubmissionResult);
        clearDraft();
      } catch (err: unknown) {
        setRepeatError(err instanceof Error ? err.message : "خطأ في إرسال إجابات التكرار");
      } finally {
        setRepeatSubmitting(false);
      }
    };

    const answeredCount = wrongRepeatQuestions.filter(q => repeatAnswers[q.id] !== undefined && repeatAnswers[q.id] !== "").length;

    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background dark:from-primary/10">
          <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border shadow-sm">
            <div className="container mx-auto px-4 max-w-3xl py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔁</span>
                <div>
                  <p className="font-black text-base">{lang === "ar" ? "جولة التكرار" : "Repeat Round"}</p>
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "أجب مرة أخرى على الأسئلة التي أخطأت فيها" : "Answer the questions you got wrong again"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold text-primary">
                  {answeredCount} / {wrongRepeatQuestions.length}
                </div>
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${(answeredCount / wrongRepeatQuestions.length) * 100}%` }}
                    transition={{ type: "spring", stiffness: 100 }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="space-y-6">
              {wrongRepeatQuestions.map((q, i) => {
                const qType = q.questionType || "mcq";
                const isAnswered = repeatAnswers[q.id] !== undefined && repeatAnswers[q.id] !== "";
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className={`bg-card rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-300 ${isAnswered ? 'border-primary shadow-primary/10' : 'border-border'}`}>
                      <div className="p-5 pb-0">
                        <div className="flex gap-3 items-start mb-4">
                          <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-sm ${isAnswered ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                            {isAnswered ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-bold leading-snug">{q.text}</p>
                          </div>
                          <span className="shrink-0 text-xs font-black bg-primary/15 text-primary dark:text-primary/80 px-2.5 py-1 rounded-lg">
                            {q.points} {t.solve.gradeUnit}
                          </span>
                        </div>
                        {q.imageUrl && (
                          <div className="mb-4">
                            <img src={q.imageUrl} alt={q.text} className="max-h-48 rounded-xl border border-border object-contain" />
                          </div>
                        )}
                      </div>

                      <div className="p-5 pt-2">
                        {qType === "mcq" && q.optionA && (
                          <div className="space-y-2.5">
                            {q.allowMultipleAnswers && (
                              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">
                                {lang === "ar" ? "✅ اختر جميع الإجابات الصحيحة" : "✅ Select all correct answers"}
                              </p>
                            )}
                            {OPTION_LABELS.map((opt, oi) => {
                              const optText = q[`option${opt}` as keyof typeof q] as string;
                              if (!optText) return null;
                              const isSelected = q.allowMultipleAnswers
                                ? (repeatAnswers[q.id] || "").split(",").map(s => s.trim()).filter(Boolean).includes(opt)
                                : repeatAnswers[q.id] === opt;
                              return (
                                <motion.label
                                  key={opt}
                                  whileTap={{ scale: 0.98 }}
                                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50 hover:bg-muted/40'}`}
                                >
                                  <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black transition-all duration-200 ${isSelected ? `bg-gradient-to-br ${OPTION_COLORS[oi]} text-white` : 'bg-muted text-muted-foreground'}`}>
                                    {opt}
                                  </span>
                                  {q.allowMultipleAnswers ? (
                                    <input type="checkbox" value={opt} checked={isSelected}
                                      onChange={() => {
                                        const cur = (repeatAnswers[q.id] || "").split(",").map(s => s.trim()).filter(Boolean);
                                        const next = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
                                        setRepeatAnswers({ ...repeatAnswers, [q.id]: next.sort().join(",") });
                                        feedbackOnSelect();
                                      }}
                                      className="sr-only" />
                                  ) : (
                                    <input type="radio" name={`rq-${q.id}`} value={opt} checked={isSelected}
                                      onChange={() => { setRepeatAnswers({ ...repeatAnswers, [q.id]: opt }); feedbackOnSelect(); }}
                                      className="sr-only" />
                                  )}
                                  <span className="font-medium text-sm flex-1">{optText}</span>
                                  {isSelected && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                                </motion.label>
                              );
                            })}
                          </div>
                        )}

                        {qType === "true_false" && (
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { value: "true", label: lang === "ar" ? "صح" : "True", icon: "✓", cls: "green" },
                              { value: "false", label: lang === "ar" ? "خطأ" : "False", icon: "✗", cls: "red" },
                            ].map(opt => (
                              <motion.button
                                key={opt.value}
                                whileTap={{ scale: 0.97 }}
                                type="button"
                                onClick={() => { setRepeatAnswers({ ...repeatAnswers, [q.id]: opt.value }); feedbackOnSelect(); }}
                                className={`py-4 rounded-xl border-2 font-black text-lg transition-all duration-200 flex flex-col items-center gap-1 ${
                                  repeatAnswers[q.id] === opt.value
                                    ? opt.cls === "green"
                                      ? 'border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-green-100 dark:shadow-green-900/20 shadow-md'
                                      : 'border-red-500 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 shadow-red-100 dark:shadow-red-900/20 shadow-md'
                                    : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                                }`}
                              >
                                <span className="text-2xl">{opt.icon}</span>
                                <span className="text-base">{opt.label}</span>
                              </motion.button>
                            ))}
                          </div>
                        )}

                        {qType === "fill_blank" && (
                          <div className="relative">
                            <Input
                              value={repeatAnswers[q.id] || ""}
                              onChange={e => setRepeatAnswers({ ...repeatAnswers, [q.id]: e.target.value })}
                              placeholder={t.solve.fillBlankPlaceholder}
                              className="text-base py-3 pr-4 border-2 rounded-xl focus:border-primary"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {repeatError && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {repeatError}
              </div>
            )}

            <div className="mt-6">
              <Button
                onClick={handleRepeatSubmit}
                disabled={!canSubmitRepeat || repeatSubmitting}
                className="w-full py-4 text-base font-bold bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
              >
                {repeatSubmitting
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Send className={`w-5 h-5 ${lang === "ar" ? "ml-2" : "mr-2"}`} /> {lang === "ar" ? "تسليم الجولة الثانية" : "Submit Repeat Round"}</>
                }
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (result) {
    const canSeeResults = result.showResults !== false;
    const score = Math.round(result.score);
    const isGreat = score >= 80;
    const isOk = score >= 50;

    const celebMsg = canSeeResults
      ? isGreat
        ? (lang === "ar" ? "🎉 عمل رائع! أنت متميز!" : "🎉 Excellent work! You're a star!")
        : isOk
          ? (lang === "ar" ? "💪 جيد! استمر في التحسن!" : "💪 Good job! Keep improving!")
          : (lang === "ar" ? "📚 لا بأس، المحاولة تستحق!" : "📚 Nice try, keep practicing!")
      : null;

    return (
      <Layout>
        <ConfettiBurst active={canSeeResults && isGreat} />
        <div className="min-h-screen relative overflow-hidden bg-[linear-gradient(180deg,hsl(40_45%_97%)_0%,hsl(40_33%_98%)_60%,hsl(40_30%_99%)_100%)] dark:bg-gradient-to-b dark:from-primary/5 dark:to-background">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 14% 20%, hsl(145 55% 32% / 0.10) 0, transparent 32%), radial-gradient(circle at 86% 12%, hsl(43 74% 49% / 0.10) 0, transparent 30%)",
            }}
          />
          <div className="container relative z-10 mx-auto px-4 py-10 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="soft-card rounded-[28px] overflow-hidden mb-6">
                <div className={`h-2 w-full ${isGreat ? 'bg-gradient-to-r from-green-400 to-emerald-500' : isOk ? 'bg-gradient-to-r from-primary to-primary/70' : 'bg-gradient-to-r from-red-400 to-rose-500'}`} />
                <div className="p-8 text-center">
                  <motion.p
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-2xl mb-1"
                  >
                    {canSeeResults ? celebMsg : "📨"}
                  </motion.p>

                  <motion.h1
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl md:text-3xl font-black mb-1 mt-2"
                  >
                    {t.solve.submittedSuccess} {result.studentName}!
                  </motion.h1>

                  {result.studentClass && (
                    <p className="text-muted-foreground text-sm flex items-center justify-center gap-1 mb-4">
                      <GraduationCap className="w-4 h-4" />
                      {t.solve.classPrefix} {result.studentClass}
                    </p>
                  )}

                  {canSeeResults && assignment.activityType === "listening" ? (
                    <div className="mt-4 mb-2">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center">
                        <Headphones className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                          {lang === "ar" ? "تم استلام إجاباتك بنجاح" : "Your answers were received"}
                        </p>
                        <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80">
                          {lang === "ar"
                            ? "سيظهر التقييم النهائي بعد مراجعة معلمك"
                            : "Your final grade will appear after teacher review"}
                        </p>
                      </div>
                    </div>
                  ) : canSeeResults ? (
                    <>
                      <div className="flex items-center justify-center my-6">
                        <div className="relative inline-flex items-center justify-center">
                          <ScoreRing score={score} size={148} />
                          <div className="absolute text-center">
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.8 }}
                              className={`text-4xl font-black ${isGreat ? 'text-green-500' : isOk ? 'text-primary' : 'text-red-500'}`}
                            >
                              {score}%
                            </motion.p>
                          </div>
                        </div>
                      </div>

                      <ScoreStars score={score} />

                      <p className="text-sm text-muted-foreground mb-6">{t.solve.autoGraded}</p>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-6">
                        <div className="bg-muted/40 rounded-2xl p-4 text-center">
                          <p className="text-xs font-bold text-muted-foreground mb-1">{t.solve.grade}</p>
                          <p className="text-2xl font-black">{result.earnedPoints}</p>
                          <p className="text-xs text-muted-foreground">/ {result.totalPoints}</p>
                        </div>
                        <div className="bg-muted/40 rounded-2xl p-4 text-center">
                          <p className="text-xs font-bold text-muted-foreground mb-1">{t.solve.correctAnswers}</p>
                          <p className="text-2xl font-black text-green-500">{result.correctAnswers}</p>
                          <p className="text-xs text-muted-foreground">/ {result.totalQuestions}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-1 bg-muted/40 rounded-2xl p-4 text-center">
                          <p className="text-xs font-bold text-muted-foreground mb-1">{t.solve.percentageLabel}</p>
                          <p className={`text-2xl font-black ${isGreat ? 'text-green-500' : isOk ? 'text-primary' : 'text-red-500'}`}>{score}%</p>
                          <p className="text-xs text-muted-foreground">&nbsp;</p>
                        </div>
                      </div>

                      {result.aiFeedback && (
                        <div className={`bg-primary/5 border border-primary/20 rounded-2xl p-5 ${lang === "ar" ? "text-right" : "text-left"} flex gap-4`}>
                          <BrainCircuit className="w-7 h-7 text-primary shrink-0 mt-0.5" />
                          <div>
                            <h3 className="font-bold text-primary mb-1 text-sm">{t.solve.aiFeedback}</h3>
                            <p className="text-sm leading-relaxed text-foreground/80">{result.aiFeedback}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-4 mb-2">
                      <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center">
                        <EyeOff className="w-10 h-10 text-primary mx-auto mb-3" />
                        <p className="text-lg font-bold text-primary dark:text-primary/80 mb-1">{t.solve.submissionReceived}</p>
                        <p className="text-sm text-primary">{t.solve.resultsLater}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {canSeeResults && result.answers.length > 0 && assignment.activityType === "listening" && (() => {
                const autoTypes = new Set(["mcq", "true_false"]);
                const qById = new Map(assignment.questions.map(q => [q.id, q] as const));
                let autoCount = 0;
                let autoCorrect = 0;
                let pendingCount = 0;
                for (const ans of result.answers) {
                  const q = qById.get(ans.questionId);
                  const t = q?.questionType || "mcq";
                  if (autoTypes.has(t)) {
                    autoCount++;
                    if (ans.isCorrect) autoCorrect++;
                  } else {
                    pendingCount++;
                  }
                }
                const sentence = lang === "ar"
                  ? (() => {
                      const parts: string[] = [];
                      if (autoCount > 0) parts.push(`أجبت بشكل صحيح عن ${autoCorrect} من ${autoCount}`);
                      if (pendingCount > 0) parts.push(`وهناك ${pendingCount} ${pendingCount === 1 ? "إجابة سيراجعها معلمك" : "إجابات سيراجعها معلمك"}`);
                      return parts.join("، ") || "تم استلام إجاباتك بنجاح";
                    })()
                  : (() => {
                      const parts: string[] = [];
                      if (autoCount > 0) parts.push(`You answered ${autoCorrect} of ${autoCount} correctly`);
                      if (pendingCount > 0) parts.push(`and ${pendingCount} ${pendingCount === 1 ? "answer is" : "answers are"} pending teacher review`);
                      return parts.join(", ") || "Your answers were received";
                    })();
                return (
                  <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background p-5 text-right">
                    <h2 className="text-lg font-black mb-2 flex items-center gap-2">
                      <Headphones className="w-5 h-5 text-emerald-600" />
                      {lang === "ar" ? "ملخص نشاط الاستماع" : "Listening activity summary"}
                    </h2>
                    <p className="text-sm text-foreground/85">{sentence}.</p>
                  </div>
                );
              })()}

              {canSeeResults && result.answers.length > 0 && assignment.activityType !== "listening" && (
                <div className="space-y-3">
                  <h2 className="text-lg font-black mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {t.solve.answerDetails}
                  </h2>
                  {result.answers.map((ans, i) => (
                    <motion.div
                      key={ans.questionId}
                      initial={{ opacity: 0, x: lang === "ar" ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                    >
                      <div className={`bg-card rounded-2xl border-2 overflow-hidden ${ans.isCorrect ? 'border-green-200 dark:border-green-800 fb-correct-once' : 'border-red-200 dark:border-red-800 fb-wrong-once'}`}>
                        <div className={`flex items-center gap-3 px-4 py-3 ${ans.isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${ans.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                            {ans.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </div>
                          <p className="font-bold text-sm flex-1">{t.solve.questionPrefix} {i + 1}: {ans.questionText}</p>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg shrink-0 ${ans.isCorrect ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                            {ans.earnedPoints} / {ans.points}
                          </span>
                        </div>
                        <div className="px-4 py-3 flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs font-medium">{t.solve.yourAnswer} </span>
                            <span className={`font-bold ${ans.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {ans.selectedAnswer}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="mt-8 text-center">
                <Link href="/">
                  <Button variant="outline" className="px-8">
                    <BackIcon className="w-4 h-4 me-1" />
                    {t.solve.backToHome}
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </Layout>
    );
  }

  const isSubmitting = submitMcq.isPending || submitImg.isPending;
  const hasElectronicQuestions = assignment.questions.some(q => {
    const qt = q.questionType || "mcq";
    return qt === "true_false" || qt === "fill_blank" || qt === "whiteboard" || qt === "dictation" || qt === "open" || q.optionA;
  });
  const nonWhiteboardCount = assignment.questions.filter(q => q.questionType !== "whiteboard").length;
  const multiAnswerQuestions = assignment.questions.filter(q => (q.questionType || "mcq") === "mcq" && q.allowMultipleAnswers && q.optionA);
  const allMultiAnswersConfirmed = multiAnswerQuestions.every(q => confirmedMultiAnswers.has(q.id));

  const answeredCount = assignment.questions.filter(q => {
    if (q.questionType === "whiteboard") return true;
    return answers[q.id] !== undefined && answers[q.id] !== "";
  }).length;
  const totalCount = assignment.questions.length;
  const progressPct = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  const canSubmitMcq = studentName.trim() !== "" && studentClass.trim() !== "" && (nonWhiteboardCount === 0 || Object.keys(answers).length >= nonWhiteboardCount) && allMultiAnswersConfirmed;
  const canSubmitImg = studentName.trim() !== "" && studentClass.trim() !== "" && imagePreview !== null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setImagePreview(base64);
    }
  };

  const handleMcqSubmit = () => {
    setAccessError("");
    const allAnswers: Record<number, string> = { ...answers };
    if (assignment) {
      assignment.questions.forEach(q => {
        if (q.questionType === "whiteboard") {
          const canvas = document.getElementById(`wb-canvas-${q.id}`) as HTMLCanvasElement | null;
          if (canvas) {
            const data = (canvas as any).getWhiteboardData?.();
            if (data?.dataURL) {
              allAnswers[q.id] = data.dataURL;
            }
          }
        }
      });
    }
    const formattedAnswers: AnswerBody[] = Object.entries(allAnswers).map(([qId, ans]) => ({
      questionId: parseInt(qId),
      selectedAnswer: ans
    }));
    const deviceFingerprint = getDeviceFingerprint();
    const durationSeconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
    submitMcq.mutate({ id, data: { studentName, studentClass, studentId: studentId || undefined, answers: formattedAnswers, accessCode: accessCode || undefined, deviceFingerprint, examSessionId: examSessionId || undefined, durationSeconds } } as any);
  };

  const handleImgSubmit = () => {
    setAccessError("");
    if (imagePreview) {
      const deviceFingerprint = getDeviceFingerprint();
      submitImg.mutate({ id, data: { studentName, studentClass, studentId: studentId || undefined, imageBase64: imagePreview, accessCode: accessCode || undefined, deviceFingerprint } } as any);
    }
  };

  const showModeToggle = submissionMode === "both" && hasElectronicQuestions;
  const showElectronic = (submissionMode === "electronic" || submissionMode === "both") && hasElectronicQuestions;
  const showPaper = submissionMode === "paper" || submissionMode === "both";

  return (
    <Layout>
      {isSharedForOtherTeacher && (
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-b border-emerald-700/30">
          <div className="container mx-auto px-4 max-w-4xl py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm sm:text-base font-bold">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="font-extrabold leading-tight">
                  {lang === "ar" ? "هذه مسابقة مشتركة" : "This is a shared competition"}
                </p>
                <p className="text-xs sm:text-sm opacity-90 font-semibold">
                  {lang === "ar"
                    ? "أنت معلم — يمكنك تشغيلها مباشرة مع طلابك"
                    : "You're a teacher — launch it live with your class"}
                </p>
              </div>
            </div>
            <button
              onClick={launchSharedAsTeacher}
              disabled={launchingShared}
              className="inline-flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-md transition-all shrink-0"
            >
              {launchingShared ? (
                <>
                  <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  {lang === "ar" ? "جارٍ البدء..." : "Starting..."}
                </>
              ) : (
                <>
                  <Gamepad2 className="w-4 h-4" />
                  {lang === "ar" ? "شغّلها مع طلابي" : "Play with my class"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
      <div className="min-h-screen relative overflow-hidden bg-[linear-gradient(180deg,hsl(40_45%_97%)_0%,hsl(40_33%_98%)_60%,hsl(40_30%_99%)_100%)] dark:bg-gradient-to-b dark:from-primary/8 dark:via-background dark:to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 18%, hsl(145 55% 32% / 0.10) 0, transparent 32%), radial-gradient(circle at 88% 10%, hsl(43 74% 49% / 0.10) 0, transparent 30%), radial-gradient(circle at 50% 95%, hsl(145 55% 32% / 0.06) 0, transparent 40%)",
          }}
        />
        <div className="hero-stage text-primary-foreground relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -right-20 w-[28rem] h-[28rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,transparent_60%)]" />
            <div className="absolute -bottom-32 -left-16 w-[22rem] h-[22rem] rounded-full bg-[radial-gradient(circle,rgba(43,74,49,0.45)_0%,transparent_55%)]" />
            <Sparkles className="absolute top-10 right-1/3 w-6 h-6 text-primary/30 animate-float-slow" />
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
                backgroundSize: "22px 22px",
              }}
            />
          </div>
          <div className="container relative z-10 mx-auto px-4 max-w-4xl py-8 md:py-14">
            <div className="flex items-center justify-between mb-6">
              <Link href="/" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/12 hover:bg-white/22 backdrop-blur-md text-white/90 hover:text-white text-sm font-semibold transition-colors">
                <BackIcon className="w-4 h-4" />
                {t.solve.back}
              </Link>
              <button
                type="button"
                onClick={toggleSound}
                aria-label={soundEnabled ? (lang === "ar" ? "إيقاف الصوت" : "Mute sound") : (lang === "ar" ? "تشغيل الصوت" : "Unmute sound")}
                title={soundEnabled ? (lang === "ar" ? "الصوت مفعل" : "Sound on") : (lang === "ar" ? "الصوت مكتوم" : "Sound off")}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-primary-foreground/90 text-xs font-bold mb-4 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              {lang === "ar" ? "واجب من حصاد" : "A Hasad Assignment"}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-sm font-bold">
                {assignment.subject}
              </span>
              {assignment.accessMode === "private" && (
                <span className="px-3 py-1 bg-white/15 rounded-full text-sm font-medium flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> {t.solve.requiresCode}
                </span>
              )}
            </div>
            <h1 className="font-display-display text-3xl md:text-5xl font-black mb-3 leading-[1.15] hero-title text-white drop-shadow-[0_2px_8px_rgba(0,40,20,0.25)]">
              {assignment.title}
            </h1>
            {assignment.description && (
              <p className="text-white/85 text-base md:text-lg max-w-2xl mb-5 leading-relaxed">{assignment.description}</p>
            )}
            <div className="flex items-center flex-wrap gap-2 text-sm font-medium">
              <span className="flex items-center gap-1.5 bg-black/25 backdrop-blur-md ring-1 ring-white/10 px-3 py-1.5 rounded-lg">
                <FileText className="w-4 h-4" /> {assignment.questions.length} {t.solve.questionsCount}
              </span>
              <span className="flex items-center gap-1.5 bg-black/25 backdrop-blur-md ring-1 ring-white/10 px-3 py-1.5 rounded-lg">
                <Star className="w-4 h-4 text-primary/80" /> {assignment.totalPoints} {t.solve.gradeUnit}
              </span>
              {assignment.targetClass && (
                <span className="flex items-center gap-1.5 bg-black/25 backdrop-blur-md ring-1 ring-white/10 px-3 py-1.5 rounded-lg">
                  <GraduationCap className="w-4 h-4" /> {assignment.targetClass}
                </span>
              )}
              {assignment.deadline && (
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur-md ring-1 ${isExpired ? 'bg-red-500/40 ring-red-200/30' : 'bg-primary/30 ring-primary/30'}`}>
                  <AlertCircle className="w-4 h-4" />
                  {isExpired ? t.solve.deadlineExpired : `${t.solve.deadline} ${new Date(assignment.deadline).toLocaleString(locale)}`}
                </span>
              )}
            </div>
          </div>
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 h-6 bg-[linear-gradient(180deg,transparent_0%,hsl(40_45%_97%)_100%)] dark:bg-[linear-gradient(180deg,transparent_0%,hsl(var(--background))_100%)]"
          />
        </div>

        {mode === 'mcq' && showElectronic && !isExamMode && (
          <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border shadow-sm">
            <div className="container mx-auto px-4 max-w-4xl py-2.5 flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-muted-foreground shrink-0">
                {answeredCount} / {totalCount} {lang === "ar" ? "سؤال" : "answered"}
              </p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ type: "spring", stiffness: 100 }}
                />
              </div>
              <div className="flex gap-1 shrink-0">
                {assignment.questions.slice(0, Math.min(totalCount, 12)).map((q, i) => {
                  const done = answers[q.id] !== undefined && answers[q.id] !== "" || q.questionType === "whiteboard";
                  return (
                    <div
                      key={q.id}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${done ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    />
                  );
                })}
                {totalCount > 12 && <span className="text-xs text-muted-foreground">+{totalCount - 12}</span>}
              </div>
            </div>
          </div>
        )}

        <div className="container relative z-10 mx-auto px-4 py-8 max-w-4xl">
          <div className="soft-card rounded-[26px] p-6 md:p-8 mb-6">
            <div className="mb-6 space-y-4 max-w-lg">
              {classStudents.length > 0 ? (() => {
                const classList = Array.from(new Set(classStudents.map(s => s.gradeLevel))).sort((a, b) => a.localeCompare(b, "ar"));
                const showClassPicker = classList.length > 1;
                const filteredStudents = studentClass
                  ? classStudents.filter(s => s.gradeLevel === studentClass).sort((a, b) => a.name.localeCompare(b.name, "ar"))
                  : [];
                return (
                <div className="space-y-3">
                  {showClassPicker && (
                    <div>
                      <Label className="text-base font-bold flex items-center gap-2 mb-2">
                        <GraduationCap className="w-5 h-5 text-primary" />
                        {lang === "ar" ? "اختر صفك أولاً" : "Select your class first"}
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {classList.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setStudentClass(c);
                              setStudentId(null);
                              setStudentName("");
                            }}
                            className={`px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                              studentClass === c
                                ? "border-primary bg-primary text-white shadow-md"
                                : "border-input bg-background hover:border-primary/50 hover:bg-primary/5"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {studentClass && (
                    <div>
                      <Label className="text-base font-bold flex items-center gap-2 mb-2">
                        <Users className="w-5 h-5 text-primary" />
                        {lang === "ar" ? "اختر اسمك من القائمة" : "Select your name"}
                      </Label>
                      <select
                        value={studentId ?? ""}
                        onChange={e => {
                          const sid = parseInt(e.target.value);
                          const found = filteredStudents.find(s => s.id === sid);
                          if (found) {
                            setStudentId(found.id);
                            setStudentName(found.name);
                            setStudentClass(found.gradeLevel);
                          } else {
                            setStudentId(null);
                            setStudentName("");
                          }
                        }}
                        className="w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                      >
                        <option value="">{lang === "ar" ? "— اختر اسمك —" : "— Select your name —"}</option>
                        {filteredStudents.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      {studentId && (
                        <div className="flex items-center gap-2 p-3 mt-2 bg-primary/5 border border-primary/20 rounded-xl text-sm font-medium text-primary">
                          <GraduationCap className="w-4 h-4" />
                          {studentClass}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })() : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-bold mb-1.5 block">{t.solve.studentName}</Label>
                    <Input
                      value={studentName}
                      onChange={e => setStudentName(e.target.value)}
                      placeholder={t.solve.namePlaceholder}
                      className="text-base border-2"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-bold mb-1.5 block">{t.solve.classLabel}</Label>
                    <Input
                      value={studentClass}
                      onChange={e => setStudentClass(e.target.value)}
                      placeholder={t.solve.classPlaceholder}
                      className="text-base border-2"
                    />
                  </div>
                </div>
              )}
              {assignment.accessMode === "private" && (
                <div>
                  <Label className="text-sm font-bold mb-1.5 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    {t.solve.accessCode}
                  </Label>
                  <Input
                    value={accessCode}
                    onChange={e => { setAccessCode(e.target.value); setAccessError(""); }}
                    placeholder={t.solve.accessCodePlaceholder}
                    className="text-base font-mono tracking-widest border-2"
                    dir="ltr"
                  />
                </div>
              )}
              {accessError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {accessError}
                </div>
              )}
            </div>

            {showModeToggle && (
              <div className="flex bg-muted/50 p-1.5 rounded-xl mb-6">
                <button
                  onClick={() => setMode('mcq')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${mode === 'mcq' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <MousePointerClick className="w-5 h-5" />
                  {t.solve.electronicSolve}
                </button>
                <button
                  onClick={() => setMode('image')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${mode === 'image' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Camera className="w-5 h-5" />
                  {t.solve.uploadPaper}
                </button>
              </div>
            )}

            {!showModeToggle && submissionMode === "paper" && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-6 text-sm text-blue-800 font-medium dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
                <Camera className="w-5 h-5 shrink-0" />
                {t.solve.paperOnly}
              </div>
            )}

            {!showModeToggle && submissionMode === "electronic" && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 mb-6 text-sm text-green-800 font-medium dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                <MousePointerClick className="w-5 h-5 shrink-0" />
                {t.solve.electronicOnly}
              </div>
            )}

            {isExamMode && examStarted && timeLeft !== null && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`sticky top-16 z-30 mb-6 flex items-center justify-center gap-3 py-3 px-6 rounded-2xl shadow-lg font-black text-lg ${timeLeft <= 60 ? 'bg-red-500 text-white animate-pulse' : timeLeft <= 300 ? 'bg-orange-500 text-white' : 'bg-primary text-primary-foreground'}`}
              >
                <Clock className="w-5 h-5" />
                {t.solve.examTimer}: {formatTime(timeLeft)}
              </motion.div>
            )}

            {isExamMode && !examStarted && mode === 'mcq' && showElectronic ? (
              <div className="text-center py-10 space-y-5">
                <div className="inline-flex p-5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  <Clock className="w-14 h-14" />
                </div>
                <h2 className="text-2xl font-black">{t.createAssignment?.examMode || "Exam Mode"}</h2>
                <p className="text-muted-foreground max-w-md mx-auto text-sm">{t.solve.autoSubmitWarning}</p>
                <p className="text-4xl font-black text-orange-600">{examDuration} {t.solve.minutes}</p>
                <Button
                  onClick={() => {
                    const deviceFingerprint = getDeviceFingerprint();
                    startExam.mutate({ id, data: { studentName: studentName.trim(), studentClass: studentClass.trim(), deviceFingerprint, accessCode: accessCode || undefined } } as any);
                  }}
                  disabled={!studentName.trim() || !studentClass.trim() || startExam.isPending}
                  className="px-12 py-4 text-lg bg-orange-500 hover:bg-orange-600"
                >
                  <Clock className={`w-5 h-5 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
                  {t.solve.startExam}
                </Button>
                {(!studentName.trim() || !studentClass.trim()) && (
                  <p className="text-sm text-muted-foreground">{t.solve.enterNameFirst}</p>
                )}
              </div>
            ) : mode === 'mcq' && showElectronic ? (
              <div className="space-y-5">
                {draftRestored && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span>{lang === "ar" ? "تم استعادة إجاباتك المحفوظة" : "Your saved answers have been restored"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAnswers({}); clearDraft(); }}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white dark:bg-blue-950 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                    >
                      {lang === "ar" ? "بدء من جديد" : "Start fresh"}
                    </button>
                  </motion.div>
                )}
                {assignment.activityType === "listening" && (
                  <ListeningPlayer
                    assignmentId={assignment.id}
                    audioText={assignment.listeningAudioText ?? null}
                    defaultSpeed={assignment.listeningSpeed || "1"}
                    settings={(assignment.listeningSettings as ListeningSettings) || {}}
                    lang={lang}
                    accessCode={verifiedAccessCode || undefined}
                  />
                )}
                {assignment.questions.map((q, i) => {
                  const qType = q.questionType || "mcq";
                  const isAnswered = qType === "whiteboard" || (answers[q.id] !== undefined && answers[q.id] !== "");
                  return (
                    <motion.div
                      key={q.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.35 }}
                    >
                      <div className={`rounded-2xl border-2 bg-card overflow-hidden transition-all duration-300 ${isAnswered ? 'border-primary/30 shadow-sm shadow-primary/10' : 'border-border'}`}>
                        <div className="p-5">
                          <div className="flex gap-3 items-start mb-4">
                            <motion.div
                              animate={{ backgroundColor: isAnswered ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}
                              className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-sm transition-colors duration-300 ${isAnswered ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                            >
                              <AnimatePresence mode="wait">
                                {isAnswered ? (
                                  <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                    <CheckCircle2 className="w-5 h-5" />
                                  </motion.span>
                                ) : (
                                  <motion.span key="num" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                    {i + 1}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base md:text-lg font-bold leading-snug">{q.text}</p>
                            </div>
                            <span className="shrink-0 text-xs font-black bg-primary/8 text-primary px-2.5 py-1 rounded-lg">
                              {q.points} {t.solve.gradeUnit}
                            </span>
                          </div>

                          {q.imageUrl && (
                            <div className="mb-4 rounded-xl overflow-hidden border border-border">
                              <img src={q.imageUrl} alt={q.text} className="max-h-56 w-full object-contain bg-muted/20" />
                            </div>
                          )}

                          {qType === "mcq" && q.optionA && (
                            <div className="space-y-2.5">
                              {q.allowMultipleAnswers && (
                                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">
                                  {lang === "ar" ? "✅ اختر جميع الإجابات الصحيحة ثم اضغط تأكيد" : "✅ Select all correct answers then confirm"}
                                </p>
                              )}
                              {OPTION_LABELS.map((opt, oi) => {
                                const optText = q[`option${opt}` as keyof typeof q] as string;
                                if (!optText) return null;
                                const isSelected = q.allowMultipleAnswers
                                  ? (answers[q.id] || "").split(",").map(s => s.trim()).filter(Boolean).includes(opt)
                                  : answers[q.id] === opt;
                                return (
                                  <motion.label
                                    key={opt}
                                    whileTap={{ scale: 0.985 }}
                                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 select-none ${isSelected ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40'}`}
                                  >
                                    <motion.span
                                      animate={{
                                        background: isSelected
                                          ? `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`
                                          : undefined
                                      }}
                                      className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-black transition-all duration-200 ${isSelected ? `bg-gradient-to-br ${OPTION_COLORS[oi]} text-white shadow-sm` : 'bg-muted text-muted-foreground'}`}
                                    >
                                      {opt}
                                    </motion.span>
                                    {q.allowMultipleAnswers ? (
                                      <input
                                        type="checkbox"
                                        value={opt}
                                        checked={isSelected}
                                        onChange={() => {
                                          const cur = (answers[q.id] || "").split(",").map(s => s.trim()).filter(Boolean);
                                          const next = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
                                          setAnswers({ ...answers, [q.id]: next.sort().join(",") });
                                          setConfirmedMultiAnswers(prev => { const s = new Set(prev); s.delete(q.id); return s; });
                                          feedbackOnSelect();
                                        }}
                                        className="sr-only"
                                      />
                                    ) : (
                                      <input
                                        type="radio"
                                        name={`q-${q.id}`}
                                        value={opt}
                                        checked={isSelected}
                                        onChange={() => { setAnswers({ ...answers, [q.id]: opt }); feedbackOnSelect(); }}
                                        className="sr-only"
                                      />
                                    )}
                                    <span className="font-medium text-sm flex-1 leading-snug">{optText}</span>
                                    <AnimatePresence>
                                      {isSelected && (
                                        <motion.span
                                          key="check"
                                          initial={{ scale: 0, opacity: 0 }}
                                          animate={{ scale: 1, opacity: 1 }}
                                          exit={{ scale: 0, opacity: 0 }}
                                          className="text-primary shrink-0"
                                        >
                                          <CheckCircle2 className="w-4 h-4" />
                                        </motion.span>
                                      )}
                                    </AnimatePresence>
                                  </motion.label>
                                );
                              })}
                              {q.allowMultipleAnswers && (
                                <div className="mt-2">
                                  <AnimatePresence mode="wait">
                                    {confirmedMultiAnswers.has(q.id) ? (
                                      <motion.p
                                        key="confirmed"
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                        {lang === "ar" ? "تم تأكيد الإجابة" : "Answer confirmed"}
                                      </motion.p>
                                    ) : (
                                      <motion.button
                                        key="confirm-btn"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        type="button"
                                        disabled={!answers[q.id] || answers[q.id] === ""}
                                        onClick={() => setConfirmedMultiAnswers(prev => new Set([...prev, q.id]))}
                                        className="py-2 px-4 rounded-lg text-sm font-bold bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                      >
                                        {lang === "ar" ? "تأكيد الاختيار" : "Confirm Selection"}
                                      </motion.button>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                            </div>
                          )}

                          {qType === "true_false" && (
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { value: "true", label: lang === "ar" ? "صح" : "True", icon: "✓", cls: "green" },
                                { value: "false", label: lang === "ar" ? "خطأ" : "False", icon: "✗", cls: "red" },
                              ].map(opt => (
                                <motion.button
                                  key={opt.value}
                                  whileTap={{ scale: 0.96 }}
                                  type="button"
                                  onClick={() => { setAnswers({ ...answers, [q.id]: opt.value }); feedbackOnSelect(); }}
                                  className={`py-5 rounded-xl border-2 font-black text-base transition-all duration-200 flex flex-col items-center gap-1.5 ${
                                    answers[q.id] === opt.value
                                      ? opt.cls === "green"
                                        ? 'border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-md shadow-green-100 dark:shadow-green-900/20'
                                        : 'border-red-500 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 shadow-md shadow-red-100 dark:shadow-red-900/20'
                                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                                  }`}
                                >
                                  <span className="text-2xl">{opt.icon}</span>
                                  <span>{opt.label}</span>
                                </motion.button>
                              ))}
                            </div>
                          )}

                          {qType === "fill_blank" && (
                            <div className="relative">
                              <Input
                                value={answers[q.id] || ""}
                                onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                                placeholder={t.solve.fillBlankPlaceholder}
                                className="text-base py-3 border-2 rounded-xl focus:border-primary"
                              />
                              {answers[q.id] && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`absolute top-1/2 -translate-y-1/2 ${lang === "ar" ? "left-3" : "right-3"}`}
                                >
                                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                                </motion.div>
                              )}
                            </div>
                          )}

                          {qType === "whiteboard" && (
                            <WhiteboardCanvas
                              key={`wb-${q.id}-${whiteboardClearTrigger[q.id] || 0}`}
                              boardStyle={(q.optionA as "blank" | "lined") || "blank"}
                              canvasId={`wb-canvas-${q.id}`}
                              locked={whiteboardLocked[q.id] || false}
                              injectedStrokes={teacherStrokes[q.id] || []}
                              onStroke={(stroke) => {
                                const socket = getSocket();
                                socket.emit("whiteboard:stroke", { assignmentId: id, questionId: q.id, stroke });
                              }}
                              onClear={() => {
                                const socket = getSocket();
                                socket.emit("whiteboard:student-clear", { assignmentId: id, questionId: q.id });
                              }}
                            />
                          )}

                          {(qType === "dictation" || qType === "open") && (
                            <div className="relative">
                              <textarea
                                value={answers[q.id] || ""}
                                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                                placeholder={
                                  qType === "dictation"
                                    ? (lang === "ar" ? "اكتب ما تسمعه هنا…" : "Write what you hear here…")
                                    : (lang === "ar" ? "اكتب إجابتك هنا…" : "Write your answer here…")
                                }
                                rows={qType === "dictation" ? 3 : 5}
                                dir="rtl"
                                className="w-full rounded-xl border-2 border-input bg-background p-3 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-y"
                              />
                              {answers[q.id] && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`absolute top-3 ${lang === "ar" ? "left-3" : "right-3"}`}
                                >
                                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                                </motion.div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: assignment.questions.length * 0.06 }}
                  className="pt-2"
                >
                  <Button
                    onClick={handleMcqSubmit}
                    disabled={!canSubmitMcq || isSubmitting}
                    className="w-full py-4 text-base font-bold rounded-xl shadow-lg shadow-primary/20"
                  >
                    {isSubmitting
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><Send className={`w-5 h-5 ${lang === "ar" ? "ml-2" : "mr-2"}`} /> {t.solve.submitAndGrade}</>
                    }
                  </Button>
                  {!canSubmitMcq && studentName.trim() && studentClass.trim() && (
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      {lang === "ar" ? "أجب على جميع الأسئلة للمتابعة" : "Answer all questions to continue"}
                    </p>
                  )}
                </motion.div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {t.solve.questionsAndGrades}
                  </h3>
                  <div className="space-y-2">
                    {assignment.questions.map((q, i) => (
                      <div key={q.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border">
                        <span className="font-medium text-sm flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</span>
                          {q.text}
                        </span>
                        <span className={`text-sm font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-lg shrink-0 ${lang === "ar" ? "mr-2" : "ml-2"}`}>
                          {q.points} {t.solve.gradeUnit}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
                      <span className="font-bold text-primary text-sm">{t.solve.totalGrade}</span>
                      <span className="font-black text-base text-secondary">{assignment.totalPoints} {t.solve.gradeUnit}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 border-2 border-primary/20 border-dashed rounded-2xl p-8 text-center">
                  <BrainCircuit className="w-14 h-14 mx-auto text-primary mb-4 opacity-80" />
                  <h3 className="text-xl font-bold mb-2">{t.solve.smartGrading}</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm">
                    {t.solve.smartGradingDesc}
                    {assignment.hasModelImage && (
                      <span className="block mt-2 text-primary font-bold">{t.solve.modelAnswerNote}</span>
                    )}
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />

                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant={imagePreview ? "outline" : "default"}
                    className="mx-auto"
                  >
                    <Camera className={`w-5 h-5 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
                    {imagePreview ? t.solve.changeImage : t.solve.captureOrChoose}
                  </Button>
                </div>

                {imagePreview && (
                  <div className="rounded-2xl overflow-hidden border-2 border-primary/20 relative">
                    <img src={imagePreview} alt="Preview" className="w-full max-h-[400px] object-contain bg-black/5" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                      <span className="text-white font-medium flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        {t.solve.imageReady}
                      </span>
                    </div>
                  </div>
                )}

                {showPaper && (
                  <Button
                    onClick={handleImgSubmit}
                    disabled={!canSubmitImg || isSubmitting}
                    className="w-full py-4 text-base font-bold rounded-xl"
                  >
                    {isSubmitting
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <><Send className={`w-5 h-5 ${lang === "ar" ? "ml-2" : "mr-2"}`} /> {t.solve.submitAndGrade}</>
                    }
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
