import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Save,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Globe,
  KeyRound,
  GraduationCap,
  Play,
  Clock,
  Loader2,
  Upload,
  Link2,
  Video,
  ChevronDown,
  Pencil,
  SkipForward,
  Eye,
  MoreHorizontal,
  Users,
  Sparkles,
} from "lucide-react";
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
    Player: new (elementId: string | HTMLElement, config: Record<string, unknown>) => YTPlayer;
  };
  onYouTubeIframeAPIReady?: () => void;
}

const ytWindow = window as unknown as YTWindow;

const API_BASE = import.meta.env.VITE_API_URL || "";

const VIDEO_LESSON_DRAFT_KEY = "hasad-video-lesson-builder-draft-v1";

const FIELD_RTL =
  "text-right [direction:rtl] placeholder:text-right placeholder:text-muted-foreground";

type AccessMode = "public" | "private";
type VideoSource = "youtube" | "upload" | "external";
type AccessUi = "public" | "code";

interface SkipSegment {
  start: number;
  end: number;
}

interface VideoQuestion {
  timestampSeconds: number;
  questionType: "mcq" | "true_false" | "fill_blank";
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  points: number;
}

interface APILessonQuestion {
  timestampSeconds: number;
  questionType: "mcq" | "true_false" | "fill_blank";
  text: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  points: number;
}

interface APILesson {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  videoUrl: string;
  videoType: string;
  targetClass: string | null;
  teacherClassId: number | null;
  accessMode: string;
  accessCode: string | null;
  isShared: boolean;
  skipSegments: SkipSegment[] | null;
  questions: APILessonQuestion[];
}

interface TeacherClassOption {
  id: number;
  name: string;
  groupName: string | null;
}

function generateAccessCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
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

function parseTimestamp(str: string): number | null {
  const parts = str.split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1 && !isNaN(parts[0])) {
    return parts[0];
  }
  return null;
}

function emptyQuestion(ts: number): VideoQuestion {
  return {
    timestampSeconds: ts,
    questionType: "mcq",
    text: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "A",
    points: 1,
  };
}

type PreviewRow = VideoQuestion & { _ord: number };

function TeacherStudentPreviewDialog({
  open,
  onOpenChange,
  isAr,
  titleHint,
  videoUrl,
  videoSource,
  youtubeId,
  questions,
  skipSegments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAr: boolean;
  titleHint: string;
  videoUrl: string;
  videoSource: VideoSource;
  youtubeId: string | null;
  questions: VideoQuestion[];
  skipSegments: SkipSegment[];
}) {
  const sorted: PreviewRow[] = useMemo(
    () =>
      [...questions]
        .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
        .map((q, i) => ({ ...q, _ord: i })),
    [questions],
  );

  const prevYtRef = useRef<YTPlayer | null>(null);
  const prevYtMountRef = useRef<HTMLDivElement>(null);
  const prevHtmlRef = useRef<HTMLVideoElement>(null);
  const [prevReady, setPrevReady] = useState(false);
  const [activeRow, setActiveRow] = useState<PreviewRow | null>(null);
  const activeRowRef = useRef<PreviewRow | null>(null);
  const triggeredRef = useRef<Set<number>>(new Set());
  const lastTRef = useRef(-1);

  useEffect(() => {
    activeRowRef.current = activeRow;
  }, [activeRow]);

  const isYt = videoSource === "youtube" && !!youtubeId;
  const hasMedia =
    (videoSource === "youtube" && !!youtubeId) || ((videoSource === "upload" || videoSource === "external") && !!videoUrl.trim());

  useEffect(() => {
    if (!open) {
      triggeredRef.current = new Set();
      lastTRef.current = -1;
      setActiveRow(null);
      setPrevReady(false);
      if (prevYtRef.current) {
        try {
          prevYtRef.current.destroy();
        } catch {
          /* ignore */
        }
        prevYtRef.current = null;
      }
      return;
    }
    triggeredRef.current = new Set();
    lastTRef.current = -1;
    setActiveRow(null);
    setPrevReady(false);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !isYt || !youtubeId) return;

    let cancelled = false;
    let rafKick1 = 0;
    let rafKick2 = 0;
    let rafRetry = 0;

    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.id = "yt-iframe-api";
      document.head.appendChild(tag);
    }

    const initIntoMount = () => {
      if (cancelled) return;
      const el = prevYtMountRef.current;
      if (!el) {
        rafRetry = requestAnimationFrame(initIntoMount);
        return;
      }
      try {
        prevYtRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      prevYtRef.current = null;
      setPrevReady(false);
      el.innerHTML = "";

      prevYtRef.current = new ytWindow.YT!.Player(el, {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            if (!cancelled) setPrevReady(true);
          },
        },
      });
    };

    const kickoff = () => {
      if (cancelled) return;
      if (ytWindow.YT?.Player) {
        initIntoMount();
      } else {
        ytWindow.onYouTubeIframeAPIReady = () => {
          if (!cancelled) initIntoMount();
        };
      }
    };

    rafKick1 = requestAnimationFrame(() => {
      rafKick2 = requestAnimationFrame(kickoff);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafKick1);
      cancelAnimationFrame(rafKick2);
      cancelAnimationFrame(rafRetry);
      if (prevYtRef.current) {
        try {
          prevYtRef.current.destroy();
        } catch {
          /* ignore */
        }
        prevYtRef.current = null;
      }
      if (prevYtMountRef.current) {
        prevYtMountRef.current.innerHTML = "";
      }
      setPrevReady(false);
    };
  }, [open, isYt, youtubeId]);

  useEffect(() => {
    if (!open || isYt) return;
    const vid = prevHtmlRef.current;
    if (!vid || !videoUrl.trim()) return;
    const onReady = () => setPrevReady(true);
    const onMeta = () => setPrevReady(true);
    vid.addEventListener("canplay", onReady);
    vid.addEventListener("loadedmetadata", onMeta);
    return () => {
      vid.removeEventListener("canplay", onReady);
      vid.removeEventListener("loadedmetadata", onMeta);
    };
  }, [open, isYt, videoUrl]);

  useEffect(() => {
    if (!open || !prevReady || sorted.length === 0) return;

    const tick = setInterval(() => {
      if (activeRowRef.current) return;
      try {
        let time = 0;
        if (isYt) {
          time = Math.floor(prevYtRef.current?.getCurrentTime?.() || 0);
        } else {
          time = Math.floor(prevHtmlRef.current?.currentTime || 0);
        }
        if (time === lastTRef.current) return;
        lastTRef.current = time;

        for (const seg of skipSegments) {
          if (time >= seg.start && time < seg.end) {
            if (isYt) prevYtRef.current?.seekTo?.(seg.end, true);
            else if (prevHtmlRef.current) prevHtmlRef.current.currentTime = seg.end;
            lastTRef.current = seg.end;
            return;
          }
        }

        for (const row of sorted) {
          if (triggeredRef.current.has(row._ord)) continue;
          if (time >= row.timestampSeconds) {
            triggeredRef.current.add(row._ord);
            if (isYt) prevYtRef.current?.pauseVideo?.();
            else prevHtmlRef.current?.pause();
            setActiveRow(row);
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }, 300);

    return () => clearInterval(tick);
  }, [open, prevReady, sorted, skipSegments, isYt]);

  const continuePreview = () => {
    setActiveRow(null);
    setTimeout(() => {
      try {
        if (isYt) prevYtRef.current?.playVideo?.();
        else prevHtmlRef.current?.play();
      } catch {
        /* ignore */
      }
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92vh] overflow-y-auto rounded-3xl border border-emerald-50 dark:border-emerald-900/30 sm:max-w-[920px] bg-white dark:bg-[#15201B]",
          isAr && "[&>button]:start-4 [&>button]:end-auto rtl:text-right"
        )}
        dir={isAr ? "rtl" : "ltr"}
      >
        <DialogHeader className="space-y-1 text-right sm:text-right">
          <DialogTitle className="text-lg font-black text-slate-800 dark:text-slate-100">
            {isAr ? "معاينة كما يراها الطالب" : "Preview as student"}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {titleHint || (isAr ? "بدون عنوان" : "Untitled")} ·{" "}
            {isAr
              ? "يتوقف الفيديو عند الأسئلة كما في واجهة الطالب — للمعاينة فقط."
              : "Playback pauses at questions like the student view — preview only."}
          </DialogDescription>
        </DialogHeader>

        {!hasMedia ? (
          <p className="py-8 text-center text-sm font-bold text-slate-500">
            {isAr ? "أضف فيديوً أولاً." : "Add a video first."}
          </p>
        ) : (
          <>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-inner">
              {isYt && youtubeId ? (
                <div className="absolute inset-0 z-0 h-full w-full">
                  <div ref={prevYtMountRef} className="h-full w-full min-h-0" />
                </div>
              ) : (
                <video ref={prevHtmlRef} src={videoUrl} controls className="h-full w-full object-contain" />
              )}

              <AnimatePresence>
                {activeRow && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-[2px]"
                      aria-hidden
                    />
                    <motion.div
                      key={activeRow._ord}
                      initial={{ opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      transition={{ duration: 0.22 }}
                      className="absolute inset-0 z-20 flex items-center justify-center p-3 sm:p-4"
                    >
                      <div className="max-h-[82%] w-full max-w-md overflow-y-auto rounded-3xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] p-5 shadow-2xl">
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-500">
                          <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 text-emerald-700 dark:text-emerald-400">
                            {isAr ? "سؤال" : "Q"} {activeRow._ord + 1}/{sorted.length}
                          </span>
                          <span dir="ltr" className="font-mono tabular-nums">
                            {formatTimestamp(activeRow.timestampSeconds)}
                          </span>
                        </div>
                        <p className="mb-4 text-right text-base font-black leading-relaxed text-slate-800 dark:text-slate-100">{activeRow.text}</p>

                        {activeRow.questionType === "mcq" && (
                          <div className="mb-4 grid gap-2">
                            {(["A", "B", "C", "D"] as const).map((opt) => {
                              const lab = activeRow[`option${opt}` as keyof VideoQuestion] as string;
                              if (!lab?.trim()) return null;
                              return (
                                <div
                                  key={opt}
                                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 px-3 py-2 text-right text-sm font-bold text-slate-700 dark:text-slate-300"
                                >
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-[#111A16] text-xs font-black text-emerald-600 dark:text-emerald-400 border border-slate-100 dark:border-slate-800">
                                    {opt}
                                  </span>
                                  <span className="flex-1">{lab}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {activeRow.questionType === "true_false" && (
                          <div className="mb-4 grid grid-cols-2 gap-2">
                            <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 text-sm font-black text-slate-500 dark:text-slate-400">
                              {isAr ? "صح" : "True"}
                            </div>
                            <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 text-sm font-black text-slate-500 dark:text-slate-400">
                              {isAr ? "خطأ" : "False"}
                            </div>
                          </div>
                        )}

                        {activeRow.questionType === "fill_blank" && (
                          <div className="mb-4 min-h-[44px] rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 px-3 py-3 text-right text-sm text-slate-400 dark:text-slate-500">
                            {isAr ? "حقل إجابة قصيرة…" : "Short answer field…"}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={continuePreview}
                          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl font-black text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-md transition-colors"
                        >
                          <Play className="h-4 w-4" fill="currentColor" />
                          {isAr ? "متابعة الفيديو" : "Continue video"}
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {!activeRow && sorted.length === 0 && (
              <p className="mt-3 text-center text-xs font-bold text-slate-400">
                {isAr ? "لا أسئلة لعرضها في المعاينة." : "No questions to preview."}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CreateVideoLesson() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const BackArrowIcon = isAr ? ArrowRight : ArrowLeft;

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (u?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoSource, setVideoSource] = useState<VideoSource>("youtube");
  const [targetClass, setTargetClass] = useState("");
  const [teacherClassId, setTeacherClassId] = useState<number | "">("");
  const [accessUi, setAccessUi] = useState<AccessUi>("public");
  const [accessCode, setAccessCode] = useState(generateAccessCode());
  const [isShared, setIsShared] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClassOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [skipSegments, setSkipSegments] = useState<SkipSegment[]>([]);
  const [pendingSegmentStart, setPendingSegmentStart] = useState<number | null>(null);
  const [segmentEndInput, setSegmentEndInput] = useState("");

  const [qModalOpen, setQModalOpen] = useState(false);
  const [qModalIdx, setQModalIdx] = useState<number | null>(null);
  const [draftQ, setDraftQ] = useState<VideoQuestion | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragUpload, setDragUpload] = useState(false);
  const [extraSettingsOpen, setExtraSettingsOpen] = useState(false);

  const sourceCardRef = useRef<HTMLDivElement>(null);

  const youtubeId = videoSource === "youtube" ? extractYouTubeId(videoUrl) : null;
  const playerRef = useRef<YTPlayer | null>(null);
  const ytPlayerMountRef = useRef<HTMLDivElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const html5VideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = parseInt(params.get("edit") || "");
    if (!isNaN(idParam) && idParam > 0) {
      setEditId(idParam);
      setLoadingEdit(true);
      fetch(`${API_BASE}/api/video-lessons/${idParam}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: APILesson | null) => {
          if (!data) {
            toast.error(isAr ? "لم يتم العثور على الدرس" : "Lesson not found");
            setLoadingEdit(false);
            return;
          }
          setTitle(data.title || "");
          setSubject(data.subject || "");
          setDescription(data.description || "");
          setVideoUrl(data.videoUrl || "");
          const vType = (
            ["youtube", "upload", "external"].includes(data.videoType) ? data.videoType : "youtube"
          ) as VideoSource;
          setVideoSource(vType);
          setTargetClass(data.targetClass || "");
          setTeacherClassId(data.teacherClassId ?? "");
          setAccessUi(data.accessMode === "private" ? "code" : "public");
          setAccessCode(data.accessCode || generateAccessCode());
          setIsShared(data.isShared || false);
          setSkipSegments(Array.isArray(data.skipSegments) ? data.skipSegments : []);
          setQuestions(
            (data.questions || []).map((q) => ({
              timestampSeconds: q.timestampSeconds || 0,
              questionType: q.questionType || "mcq",
              text: q.text || "",
              optionA: q.optionA || "",
              optionB: q.optionB || "",
              optionC: q.optionC || "",
              optionD: q.optionD || "",
              correctAnswer: q.correctAnswer || "",
              points: q.points || 1,
            })),
          );
          setLoadingEdit(false);
        })
        .catch(() => {
          toast.error(isAr ? "خطأ في تحميل الدرس" : "Error loading lesson");
          setLoadingEdit(false);
        });
    }
  }, [isAr]);

  useEffect(() => {
    fetch(`${API_BASE}/api/teacher/classes`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: TeacherClassOption[]) => setTeacherClasses(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);

  useLayoutEffect(() => {
    if (videoSource !== "youtube" || !youtubeId) {
      setPlayerReady(false);
      return;
    }

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
        playerVars: { controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: (e: { target: { getDuration: () => number } }) => {
            setPlayerReady(true);
            try {
              const dur = e.target.getDuration?.();
              if (dur > 0) setVideoDuration(Math.floor(dur));
            } catch {
              /* ignore */
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
  }, [youtubeId, videoSource]);

  useEffect(() => {
    if (!playerReady) return;
    const interval = setInterval(() => {
      try {
        const t = playerRef.current?.getCurrentTime?.();
        if (typeof t === "number") setCurrentTime(Math.floor(t));
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearInterval(interval);
  }, [playerReady]);

  useEffect(() => {
    if (videoSource === "youtube") return;
    const vid = html5VideoRef.current;
    if (!vid) return;
    const onTime = () => setCurrentTime(Math.floor(vid.currentTime));
    const onMeta = () => {
      if (vid.duration && isFinite(vid.duration)) setVideoDuration(Math.floor(vid.duration));
    };
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("loadedmetadata", onMeta);
    return () => {
      vid.removeEventListener("timeupdate", onTime);
      vid.removeEventListener("loadedmetadata", onMeta);
    };
  }, [videoSource, videoUrl]);

  const getVideoTimestamp = useCallback(() => {
    if (videoSource === "youtube" && playerReady) return currentTime;
    if (videoSource !== "youtube" && html5VideoRef.current)
      return Math.floor(html5VideoRef.current.currentTime);
    return 0;
  }, [videoSource, playerReady, currentTime]);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error(isAr ? "يرجى اختيار ملف فيديو" : "Please select a video file");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error(isAr ? "حجم الملف كبير جداً (الحد 500 ميجا)" : "File too large (max 500MB)");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const metaRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!metaRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await metaRes.json();

      const xhr = new XMLHttpRequest();
      await new Promise<void>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error("Upload failed"));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      const servingUrl = `${API_BASE}/api/storage${objectPath}`;
      setVideoUrl(servingUrl);
      setVideoSource("upload");
      toast.success(isAr ? "تم رفع الفيديو بنجاح" : "Video uploaded successfully");
    } catch {
      toast.error(isAr ? "خطأ في رفع الفيديو" : "Video upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleQuestionTypeDraft = (type: VideoQuestion["questionType"]) => {
    setDraftQ((prev) => {
      if (!prev) return prev;
      const q = { ...prev, questionType: type, optionA: "", optionB: "", optionC: "", optionD: "" };
      if (type === "true_false") q.correctAnswer = "true";
      else if (type === "fill_blank") q.correctAnswer = "";
      else q.correctAnswer = "A";
      return q;
    });
  };

  const openAddQuestionModal = () => {
    const ts = getVideoTimestamp();
    setDraftQ(emptyQuestion(ts));
    setQModalIdx(null);
    setQModalOpen(true);
  };

  const openEditQuestionModal = (idx: number) => {
    setDraftQ({ ...questions[idx] });
    setQModalIdx(idx);
    setQModalOpen(true);
  };

  const commitQuestionModal = () => {
    if (!draftQ) return;
    if (!draftQ.text.trim()) {
      toast.error(isAr ? "يرجى كتابة نص السؤال" : "Question text is required");
      return;
    }
    if (qModalIdx === null) {
      setQuestions((prev) =>
        [...prev, draftQ].sort((a, b) => a.timestampSeconds - b.timestampSeconds),
      );
    } else {
      setQuestions((prev) => {
        const next = [...prev];
        next[qModalIdx] = draftQ;
        return next.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
      });
    }
    setQModalOpen(false);
    setDraftQ(null);
    setQModalIdx(null);
  };

  const isVideoValid = () => {
    if (videoSource === "youtube") return !!youtubeId;
    return !!videoUrl.trim();
  };

  const accessModeForApi: AccessMode = accessUi === "public" ? "public" : "private";

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error(isAr ? "يرجى إدخال عنوان الدرس" : "Please enter a title");
      return;
    }
    if (!videoUrl.trim()) {
      toast.error(isAr ? "يرجى إدخال رابط الفيديو أو رفعه" : "Please enter a video URL or upload one");
      return;
    }
    if (!isVideoValid()) {
      toast.error(isAr ? "رابط الفيديو غير صالح" : "Invalid video URL");
      return;
    }
    if (questions.length === 0) {
      toast.error(isAr ? "يرجى إضافة سؤال واحد على الأقل" : "Please add at least one question");
      return;
    }
    for (const q of questions) {
      if (!q.text.trim()) {
        toast.error(isAr ? "يرجى كتابة نص جميع الأسئلة" : "All questions must have text");
        return;
      }
    }
    if (accessUi === "code" && !accessCode.trim()) {
      toast.error(isAr ? "يرجى إدخال كود الوصول للدرس الخاص" : "Please enter an access code for private lessons");
      return;
    }

    setSaving(true);
    try {
      const videoType: "youtube" | "upload" | "external" =
        videoSource === "external" && extractYouTubeId(videoUrl) ? "youtube" : videoSource;

      const body: Record<string, unknown> = {
        title: title.trim(),
        subject: subject.trim() ? subject.trim() : null,
        description: description.trim() ? description.trim() : null,
        videoUrl: videoUrl.trim(),
        videoType,
        targetClass: targetClass.trim() ? targetClass.trim() : null,
        teacherClassId: teacherClassId === "" ? null : teacherClassId,
        accessMode: accessModeForApi,
        accessCode: accessUi === "code" ? (accessCode.trim() || null) : null,
        isShared,
        skipSegments,
        questions: questions.map((q) => ({
          timestampSeconds: q.timestampSeconds,
          questionType: q.questionType,
          text: q.text,
          optionA: q.optionA?.trim() ? q.optionA.trim() : null,
          optionB: q.optionB?.trim() ? q.optionB.trim() : null,
          optionC: q.optionC?.trim() ? q.optionC.trim() : null,
          optionD: q.optionD?.trim() ? q.optionD.trim() : null,
          correctAnswer: q.correctAnswer?.trim() ? q.correctAnswer.trim() : null,
          points: q.points,
        })),
      };

      const url = editId ? `${API_BASE}/api/video-lessons/${editId}` : `${API_BASE}/api/video-lessons`;
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const o = err as { message?: string; errors?: Array<{ message?: string }> };
        const detail = o.errors?.map((e) => e.message).filter(Boolean).join(" · ");
        throw new Error([o.message, detail].filter(Boolean).join(": ") || "Error");
      }

      const data = await res.json();
      const lessonId = editId ?? (data as { id: number }).id;
      toast.success(
        editId
          ? isAr
            ? "تم تحديث الدرس بنجاح!"
            : "Lesson updated!"
          : isAr
            ? "تم نشر درس الفيديو بنجاح!"
            : "Video lesson published!",
      );
      setLocation(`/teacher/video-lesson/${lessonId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : isAr ? "خطأ في الحفظ" : "Error saving";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const saveDraftLocal = () => {
    try {
      localStorage.setItem(
        VIDEO_LESSON_DRAFT_KEY,
        JSON.stringify({
          title,
          subject,
          description,
          videoUrl,
          videoSource,
          targetClass,
          teacherClassId: teacherClassId === "" ? undefined : teacherClassId,
          accessUi,
          accessCode,
          isShared,
          questions,
          skipSegments,
          savedAt: new Date().toISOString(),
        }),
      );
      toast.success(isAr ? "تم حفظ المسودة في هذا المتصفح" : "Draft saved in this browser");
    } catch {
      toast.error(isAr ? "تعذّر حفظ المسودة" : "Could not save draft");
    }
  };

  const seekTo = (seconds: number) => {
    if (videoSource === "youtube") {
      try {
        playerRef.current?.seekTo?.(seconds, true);
      } catch {
        /* ignore */
      }
    } else if (html5VideoRef.current) {
      html5VideoRef.current.currentTime = seconds;
    }
  };

  const hasVideoPreview =
    (videoSource === "youtube" && !!youtubeId) || (videoSource !== "youtube" && !!videoUrl.trim());
  const isPlayerReady = videoSource === "youtube" ? playerReady : !!videoUrl.trim();

  const sortedQuestionIndices = useMemo(() => {
    return questions
      .map((q, i) => ({ q, i }))
      .sort((a, b) => a.q.timestampSeconds - b.q.timestampSeconds)
      .map((x) => x.i);
  }, [questions]);

  const questionTypeLabel = (t: VideoQuestion["questionType"]) => {
    if (!isAr) {
      if (t === "mcq") return "Multiple choice";
      if (t === "true_false") return "True / False";
      return "Short answer";
    }
    if (t === "mcq") return "اختيار متعدد";
    if (t === "true_false") return "صح أو خطأ";
    return "إجابة قصيرة";
  };

  const scrollToVideoSource = () => {
    sourceCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handlePublishClick = () => void handlePublish();

  if (loadingEdit) {
    return (
      <Layout>
        <div className="flex justify-center p-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className="min-h-[100dvh] bg-[#f4f7f5] dark:bg-[#0B100E] font-display pb-[calc(5rem+env(safe-area-inset-bottom))]"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 dark:bg-[#111A16]/80 border-b border-emerald-100/50 dark:border-emerald-900/30 px-4 py-3 sm:py-4 flex items-center gap-4 transition-all">
          <button
            type="button"
            onClick={() => setLocation(editId ? `/teacher/video-lesson/${editId}` : "/teacher")}
            className="p-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full hover:scale-105 transition-transform shrink-0"
            aria-label={isAr ? "رجوع" : "Back"}
          >
            <BackArrowIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Video className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg sm:text-xl text-slate-800 dark:text-slate-100 truncate leading-tight">
                {editId
                  ? isAr ? "تعديل درس فيديو تفاعلي" : "Edit interactive video"
                  : isAr ? "درس فيديو تفاعلي" : "Interactive video lesson"}
              </h1>
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">
                {isAr
                  ? "أضف أسئلة على الفيديو ليتوقف تلقائياً عندها."
                  : "Add questions so the video pauses automatically at each cue."}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 pt-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            
            {/* Video Column */}
            <div className="min-w-0 flex-1 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openAddQuestionModal}
                    className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 px-3 text-[11px] font-black text-white shadow-sm transition-all"
                  >
                    <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                    {isAr ? "إضافة سؤال" : "Add question"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    disabled={!isVideoValid() || questions.length === 0}
                    title={isAr ? "معاينة كما يراها الطالب" : "Preview as student"}
                    className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 text-[11px] font-black text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:pointer-events-none disabled:opacity-40 transition-colors"
                  >
                    <Eye className="h-4 w-4 shrink-0" />
                    {isAr ? "معاينة" : "Preview"}
                  </button>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">{isAr ? "فيديو الدرس" : "Lesson video"}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{isAr ? "شغّل ثم أضِف أسئلتك" : "Play, then add questions"}</p>
                </div>
              </div>

              {/* Video Player */}
              <section className="rounded-3xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-800/50">
                <div className="relative aspect-video w-full bg-black">
                  {videoSource === "youtube" && youtubeId ? (
                    <div className="absolute inset-0 z-0 h-full w-full">
                      <div ref={ytPlayerMountRef} className="h-full w-full min-h-0" />
                    </div>
                  ) : (videoSource === "upload" || videoSource === "external") && videoUrl.trim() ? (
                    <video ref={html5VideoRef} src={videoUrl} controls className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-800 to-slate-900 px-6 text-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
                        <Play className="h-10 w-10 text-white opacity-90" fill="currentColor" />
                      </div>
                      <p className="max-w-sm text-sm font-bold leading-relaxed text-white/85">
                        {isAr ? "أضف رابط فيديو أو ارفع ملفاً للبدء" : "Add a video link or upload a file to start"}
                      </p>
                      <button
                        type="button"
                        onClick={scrollToVideoSource}
                        className="min-h-[44px] rounded-2xl bg-emerald-500 hover:bg-emerald-600 px-6 text-sm font-black text-white shadow-lg transition-colors"
                      >
                        {isAr ? "إضافة فيديو" : "Add video"}
                      </button>
                    </div>
                  )}
                  {sortedQuestionIndices.length > 0 && (
                    <div className="pointer-events-auto absolute left-3 top-3 z-20 max-w-[min(46%,13.5rem)]">
                      <div className="rounded-2xl bg-white/95 dark:bg-[#111A16]/95 px-3 py-2 shadow-lg border border-slate-100 dark:border-slate-800 backdrop-blur-sm">
                        <p className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                          {isAr ? `الأسئلة التفاعلية (${questions.length})` : `Interactive (${questions.length})`}
                        </p>
                        <div className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                          {sortedQuestionIndices.map((realIdx, order) => {
                            const q = questions[realIdx];
                            return (
                              <button
                                key={`cue-${realIdx}`}
                                type="button"
                                onClick={() => seekTo(q.timestampSeconds)}
                                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <span dir="ltr" className="font-mono tabular-nums">
                                  {formatTimestamp(q.timestampSeconds)}
                                </span>
                                <span className="shrink-0 rounded-md bg-emerald-50 dark:bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                                  ({order + 1})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {hasVideoPreview && isPlayerReady && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs font-black tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
                        <Clock className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{formatTimestamp(currentTime)}</span>
                        <span className="text-slate-300 dark:text-slate-600">/</span>
                        <span>{formatTimestamp(videoDuration || currentTime)}</span>
                      </div>
                    </div>

                    <div className="border-t border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-right">
                        <div className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-[#15201B] border border-amber-200 dark:border-amber-800 px-2 py-1 shadow-sm">
                          <SkipForward className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-[11px] font-black text-amber-900 dark:text-amber-300">
                            {isAr ? "تخطّي جزء من الفيديو" : "Skip part of the video"}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold leading-snug text-amber-800/70 dark:text-amber-400/70">
                          {isAr
                            ? "حدّد بداية ونهاية المقطع لتعدّيه أثناء التشغيل."
                            : "Set start and end to jump over it during playback."}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {pendingSegmentStart === null ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPendingSegmentStart(currentTime);
                              setSegmentEndInput("");
                            }}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-300/50 dark:border-amber-700 bg-white dark:bg-[#15201B] px-4 text-xs font-black text-amber-900 dark:text-amber-300 shadow-sm hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-colors"
                          >
                            <SkipForward className="h-4 w-4" />
                            {isAr ? "قطع مقطع من هنا" : "Cut segment from here"}
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/50 dark:border-amber-700 bg-white dark:bg-[#15201B] px-3 py-2 shadow-sm">
                            <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                              {isAr ? "من" : "From"}{" "}
                              <span dir="ltr" className="tabular-nums bg-amber-50 dark:bg-amber-900/40 px-2 py-1 rounded-lg">
                                {formatTimestamp(pendingSegmentStart)}
                              </span>
                            </span>
                            <span className="text-[11px] text-amber-800/80 dark:text-amber-400/80">{isAr ? "إلى" : "To"}</span>
                            <Input
                              value={segmentEndInput}
                              onChange={(e) => setSegmentEndInput(e.target.value)}
                              placeholder="00:45"
                              dir="ltr"
                              className="h-10 w-[5rem] rounded-xl border-amber-200 dark:border-amber-800 text-center text-xs font-mono focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => setSegmentEndInput(formatTimestamp(currentTime))}
                              className="text-[11px] font-black text-amber-700 dark:text-amber-400 underline-offset-2 hover:underline"
                            >
                              {isAr ? "الحالي" : "Now"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const end = parseTimestamp(segmentEndInput);
                                if (end === null || end <= pendingSegmentStart) {
                                  toast.error(
                                    isAr ? "يجب أن يكون وقت النهاية بعد البداية" : "End must be after start",
                                  );
                                  return;
                                }
                                const overlaps = skipSegments.some(
                                  (s) => end > s.start && pendingSegmentStart < s.end,
                                );
                                if (overlaps) {
                                  toast.error(isAr ? "يتداخل مع مقطع آخر" : "Overlaps another segment");
                                  return;
                                }
                                setSkipSegments((prev) =>
                                  [...prev, { start: pendingSegmentStart, end }].sort((a, b) => a.start - b.start),
                                );
                                setPendingSegmentStart(null);
                                setSegmentEndInput("");
                              }}
                              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 px-3 text-[11px] font-black text-white shadow-sm transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                              {isAr ? "تأكيد" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingSegmentStart(null);
                                setSegmentEndInput("");
                              }}
                              className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-amber-800/70 dark:text-amber-400/70 hover:bg-amber-100 dark:hover:bg-amber-900/60 hover:text-amber-950 dark:hover:text-amber-300 transition-colors"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {skipSegments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-amber-200/40 dark:border-amber-800/40 pt-3">
                          {skipSegments.map((seg, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 rounded-xl border border-amber-300/45 dark:border-amber-700 bg-white dark:bg-[#15201B] px-3 py-1.5 text-[11px] font-bold text-amber-950 dark:text-amber-300 shadow-sm"
                            >
                              <span dir="ltr" className="font-mono tabular-nums">
                                {formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSkipSegments((prev) => prev.filter((_, j) => j !== i))}
                                className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-50 dark:border-emerald-900/30 pb-3">
                  <h3 className="text-right text-sm font-black text-slate-800 dark:text-slate-100">
                    {isAr ? `الأسئلة (${questions.length})` : `Questions (${questions.length})`}
                  </h3>
                  <button
                    type="button"
                    onClick={openAddQuestionModal}
                    className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-4 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isAr ? "إضافة سؤال" : "Add question"}
                  </button>
                </div>
                <div className="space-y-3">
                  {sortedQuestionIndices.map((realIdx, order) => {
                    const q = questions[realIdx];
                    return (
                      <motion.div
                        key={`card-${realIdx}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div
                          className="rounded-2xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] p-4 shadow-sm transition-all hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/40 px-2 text-[11px] font-black text-emerald-700 dark:text-emerald-400">
                                  {order + 1}
                                </span>
                                <button
                                  type="button"
                                  dir="ltr"
                                  onClick={() => seekTo(q.timestampSeconds)}
                                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-slate-50 dark:bg-slate-800 px-3 py-1 text-[11px] font-black tabular-nums text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                                  {formatTimestamp(q.timestampSeconds)}
                                </button>
                                <span className="rounded-full border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  {questionTypeLabel(q.questionType)}
                                </span>
                              </div>
                              <p className="text-sm font-bold leading-relaxed text-slate-800 dark:text-slate-100 mt-2">
                                {q.text || (
                                  <span className="italic text-slate-400">
                                    {isAr ? "لا يوجد نص بعد" : "No text yet"}
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] font-bold text-slate-400">
                                {q.points} {isAr ? "درجة" : "pts"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => openEditQuestionModal(realIdx)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-[#15201B] text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 shadow-sm transition-colors border border-slate-100 dark:border-slate-700"
                                title={isAr ? "تعديل" : "Edit"}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeQuestion(realIdx)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-[#15201B] text-slate-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm transition-colors border border-slate-100 dark:border-slate-700"
                                title={isAr ? "حذف" : "Delete"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-[#15201B] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors border border-slate-100 dark:border-slate-700"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className={cn("rounded-2xl border-emerald-100 dark:border-emerald-900 shadow-xl p-2", isAr ? "[direction:rtl]" : "[direction:ltr]")}>
                                  <DropdownMenuItem
                                    className="font-bold rounded-xl cursor-pointer"
                                    onClick={() => seekTo(q.timestampSeconds)}
                                  >
                                    <Play className="h-4 w-4 mr-2 ml-2 opacity-60 text-emerald-600" />
                                    {isAr ? "انتقل لهذا التوقيت" : "Jump to time"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>

            </div>

            {/* Sidebar / Settings */}
            <aside className="w-full lg:w-[320px] shrink-0 space-y-4">
              <section className="rounded-3xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] p-5 shadow-sm">
                <Label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5 text-emerald-500" />{isAr ? "عنوان الدرس" : "Lesson title"} *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isAr ? "مثال: الدوال الخطية — مقدمة" : "e.g. Linear functions — intro"}
                  className={cn(
                    "min-h-[44px] rounded-xl border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] py-2 text-sm font-bold focus:border-emerald-400",
                    isAr && FIELD_RTL,
                  )}
                  dir={isAr ? "rtl" : undefined}
                />
              </section>

              <Collapsible open={extraSettingsOpen} onOpenChange={setExtraSettingsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-3xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] px-5 py-4 text-right text-[13px] font-black text-slate-800 dark:text-slate-100 shadow-sm hover:shadow-md transition-all"
                  >
                    <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500" />{isAr ? "إعدادات إضافية" : "Additional settings"}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-70 transition-transform", extraSettingsOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 space-y-4 rounded-3xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] p-5 shadow-sm">
                    <div>
                      <Label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? "المادة" : "Subject"}</Label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder={isAr ? "رياضيات، علوم…" : "Math, Science…"}
                        className={cn(
                          "min-h-[44px] rounded-xl border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] text-sm focus:border-emerald-400",
                          isAr && FIELD_RTL,
                        )}
                        dir={isAr ? "rtl" : undefined}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                        <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
                        {isAr ? "الصف / الفصل" : "Target class"}
                      </Label>
                      {teacherClasses.length > 0 ? (
                        <select
                          value={teacherClassId === "" ? "" : String(teacherClassId)}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              setTeacherClassId("");
                              setTargetClass("");
                              return;
                            }
                            const tid = parseInt(v, 10);
                            const tc = teacherClasses.find((x) => x.id === tid);
                            setTeacherClassId(tid);
                            setTargetClass(tc?.name || "");
                          }}
                          className={cn(
                            "min-h-[44px] w-full rounded-xl border border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] px-3 text-sm font-bold focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 focus:outline-none transition-all outline-none",
                            isAr && FIELD_RTL,
                          )}
                          dir={isAr ? "rtl" : undefined}
                        >
                          <option value="">{isAr ? "— بدون صف محدد —" : "— No class —"}</option>
                          {teacherClasses.map((tc) => (
                            <option key={tc.id} value={String(tc.id)}>
                              {tc.groupName ? `${tc.groupName} · ${tc.name}` : tc.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={targetClass}
                          onChange={(e) => {
                            setTargetClass(e.target.value);
                            setTeacherClassId("");
                          }}
                          placeholder={isAr ? "أضف صفوفك من صفحة الطلاب" : "Add classes under Students"}
                          className={cn(
                            "min-h-[44px] rounded-xl border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] text-sm focus:border-emerald-400",
                            isAr && FIELD_RTL,
                          )}
                          dir={isAr ? "rtl" : undefined}
                        />
                      )}
                    </div>
                    <div>
                      <Label className="mb-2 block text-xs font-bold text-slate-500 dark:text-slate-400">{isAr ? "الوصف" : "Description"}</Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={isAr ? "اختياري — وصف مختصر…" : "Optional short description…"}
                        rows={4}
                        className={cn(
                          "rounded-xl border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] text-sm font-semibold focus-visible:border-emerald-400 resize-none",
                          isAr && FIELD_RTL,
                        )}
                        dir={isAr ? "rtl" : undefined}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Video Source Selection */}
              <div ref={sourceCardRef} className="scroll-mt-24 space-y-4">
                <section className="rounded-3xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] p-5 shadow-sm">
                  <h2 className="mb-2 text-right text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Video className="w-4 h-4 text-emerald-500" />{isAr ? "مصدر الفيديو" : "Video source"} *</h2>
                  {editId && (
                    <p className="mb-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {isAr ? "لا يمكن تغيير نوع المصدر بعد الإنشاء." : "Source type is fixed after creation."}
                    </p>
                  )}
                  
                  <div className={cn("mb-4 grid gap-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/30 p-1", isAdmin ? "grid-cols-3" : "grid-cols-2")}>
                    {(
                      [
                        { key: "youtube" as VideoSource, short: isAr ? "يوتيوب" : "YT", full: isAr ? "يوتيوب" : "YouTube", Icon: Play },
                        ...(isAdmin
                          ? [
                              {
                                key: "upload" as VideoSource,
                                short: isAr ? "رفع" : "Up",
                                full: isAr ? "رفع فيديو" : "Upload",
                                Icon: Upload,
                              },
                            ]
                          : []),
                        {
                          key: "external" as VideoSource,
                          short: isAr ? "رابط" : "URL",
                          full: isAr ? "رابط خارجي" : "External",
                          Icon: Link2,
                        },
                      ] as const
                    ).map(({ key, short, full, Icon }) => (
                      <button
                        key={key}
                        type="button"
                        disabled={!!editId && key !== videoSource}
                        onClick={() => {
                          if (!editId) {
                            setVideoSource(key);
                            if (key !== videoSource) {
                              setVideoUrl("");
                              setPlayerReady(false);
                            }
                          }
                        }}
                        className={cn(
                          "flex min-h-[40px] flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[11px] font-black transition-colors sm:flex-row sm:px-2",
                          videoSource === key
                            ? "bg-white dark:bg-[#15201B] text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-100/50 dark:border-emerald-800"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                          editId && key !== videoSource && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-80" />
                        <span className="sm:hidden">{short}</span>
                        <span className="hidden sm:inline">{full}</span>
                      </button>
                    ))}
                  </div>

                  {videoSource === "youtube" && (
                    <div className="space-y-3">
                      <Input
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        dir="ltr"
                        className="min-h-[44px] rounded-xl border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] font-mono text-xs focus:border-emerald-400"
                      />
                      {videoUrl && !youtubeId && (
                        <p className="text-[11px] font-bold text-red-500">{isAr ? "رابط يوتيوب غير صالح" : "Invalid URL"}</p>
                      )}
                      {youtubeId && (
                        <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-black shadow-inner">
                          <img
                            src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                            alt=""
                            className="max-h-28 w-full object-cover opacity-90"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {videoSource === "upload" && (
                    <div className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                        }}
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setDragUpload(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setDragUpload(false);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragUpload(false);
                          const f = e.dataTransfer.files?.[0];
                          if (f) handleFileUpload(f);
                        }}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        className={cn(
                          "cursor-pointer rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                          dragUpload ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-emerald-100 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] hover:border-emerald-400",
                        )}
                      >
                        {uploading ? (
                          <div className="space-y-3">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
                            <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                              {isAr ? `جاري الرفع… ${uploadProgress}%` : `Uploading… ${uploadProgress}%`}
                            </p>
                            <div className="mx-auto h-2.5 max-w-xs overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="mx-auto w-12 h-12 bg-white dark:bg-[#15201B] rounded-full flex items-center justify-center shadow-sm mb-3">
                              <Upload className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                              {isAr ? "اسحب الفيديو أو اختر ملفاً" : "Drag or choose a video"}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500">MP4, WebM, MOV · max 500MB</p>
                          </div>
                        )}
                      </div>
                      {videoUrl && (
                        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="flex-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            {isAr ? "تم الرفع" : "Uploaded"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setVideoUrl("");
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="text-xs font-black text-red-500 hover:underline bg-white dark:bg-[#15201B] px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900 shadow-sm"
                          >
                            {isAr ? "تغيير" : "Change"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {videoSource === "external" && (
                    <div>
                      <Input
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://example.com/video.mp4"
                        dir="ltr"
                        className="min-h-[44px] rounded-xl border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] font-mono text-xs focus:border-emerald-400"
                      />
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        {isAr ? "رابط مباشر لملف فيديو (MP4 أو WebM)." : "Direct link to a video file (MP4 or WebM)."}
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3 text-right">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" aria-hidden>
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-black text-slate-800 dark:text-slate-100">{isAr ? "مشاركة مع المعلمين" : "Share with teachers"}</p>
                        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {isAr
                            ? "فعّلها إذا أردت أن يطلع زملاؤك على الدرس ويعيدوا استخدامه."
                            : "Enable so colleagues can discover and reuse this lesson."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <Switch checked={isShared} onCheckedChange={setIsShared} className="data-[state=checked]:bg-emerald-600" />
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] p-5 shadow-sm">
                  <h2 className="mb-3 text-right text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><KeyRound className="w-4 h-4 text-emerald-500" />{isAr ? "وضع الوصول" : "Access"}</h2>
                  <div className="flex rounded-xl border border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] p-1" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={accessUi === "public"}
                      onClick={() => setAccessUi("public")}
                      className={cn(
                        "flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg px-2 text-xs font-black transition-colors",
                        accessUi === "public" ? "bg-white dark:bg-[#15201B] text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-100/50 dark:border-emerald-800" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                      )}
                    >
                      <Globe className="h-4 w-4 shrink-0 opacity-80" />
                      {isAr ? "عام" : "Public"}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={accessUi === "code"}
                      onClick={() => {
                        setAccessUi("code");
                        if (!accessCode.trim()) setAccessCode(generateAccessCode());
                      }}
                      className={cn(
                        "flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg px-2 text-xs font-black transition-colors",
                        accessUi === "code" ? "bg-white dark:bg-[#15201B] text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-100/50 dark:border-emerald-800" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                      )}
                    >
                      <KeyRound className="h-4 w-4 shrink-0 opacity-80" />
                      {isAr ? "خاص بكود" : "Code"}
                    </button>
                  </div>
                  {accessUi === "code" && (
                    <div className="mt-4">
                      <Label className="mb-2 block text-xs font-bold text-slate-500">{isAr ? "رمز الوصول" : "Access code"}</Label>
                      <Input
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        dir="ltr"
                        className="min-h-[44px] rounded-xl border-emerald-50 dark:border-emerald-900/50 bg-[#f4f7f5] dark:bg-[#0B100E] text-center font-mono text-sm tracking-[0.2em] focus:border-emerald-400 uppercase"
                      />
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
        </main>

        {/* Bottom Action Bar */}
        <footer
          className="fixed bottom-0 inset-x-0 z-40 border-t border-emerald-100/50 dark:border-emerald-900/30 bg-white/80 dark:bg-[#111A16]/80 backdrop-blur-xl transition-all"
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-3 sm:justify-between">
            <button
              type="button"
              onClick={() => setLocation(editId ? `/teacher/video-lesson/${editId}` : "/teacher")}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#15201B] px-4 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors sm:flex-none shadow-sm"
            >
              <BackArrowIcon className="h-4 w-4" />
              {isAr ? "رجوع" : "Back"}
            </button>
            <button
              type="button"
              onClick={saveDraftLocal}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 text-xs font-bold text-slate-500 dark:text-slate-400 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors sm:flex-none"
            >
              {isAr ? "حفظ كمسودة" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={!isVideoValid() || questions.length === 0}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 text-xs font-black text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 disabled:pointer-events-none disabled:opacity-40 transition-colors sm:flex-none"
            >
              <Eye className="h-4 w-4" />
              {isAr ? "معاينة الدرس" : "Preview"}
            </button>
            <button
              type="button"
              onClick={handlePublishClick}
              disabled={saving || !title.trim() || !isVideoValid() || questions.length === 0}
              className="flex min-h-[44px] flex-[1_1_140px] items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 px-6 text-xs font-black text-white shadow-md disabled:pointer-events-none disabled:opacity-50 transition-all sm:min-w-[160px] sm:flex-none"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isAr ? "جاري النشر…" : "Publishing…"}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editId ? (isAr ? "حفظ التعديلات" : "Save changes") : isAr ? "نشر الدرس" : "Publish"}
                </>
              )}
            </button>
          </div>
        </footer>

        {/* Modal إضافة / تعديل سؤال */}
        <Dialog open={qModalOpen} onOpenChange={(o) => { if (!o) { setQModalOpen(false); setDraftQ(null); setQModalIdx(null); } }}>
          <DialogContent
            className={cn(
              "max-h-[min(90vh,720px)] overflow-y-auto rounded-[24px] border-emerald-100 dark:border-emerald-900/50 bg-white dark:bg-[#15201B] p-6 sm:max-w-xl",
              isAr && "[&>button]:start-4 [&>button]:end-auto rtl:text-right"
            )}
            dir={isAr ? "rtl" : "ltr"}
          >
            <DialogHeader className={cn("space-y-2 text-right sm:text-right")}>
              <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100">
                {qModalIdx === null
                  ? isAr ? "سؤال جديد" : "New question"
                  : isAr ? "تعديل السؤال" : "Edit question"}
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                {isAr ? "اضبط التوقيت والنوع والدرجة ثم احفظ." : "Set time, type, and points, then save."}
              </DialogDescription>
            </DialogHeader>
            {draftQ && (
              <div className="space-y-5 pt-2">
                <div className="flex flex-wrap items-center gap-3 bg-[#f4f7f5] dark:bg-[#0B100E] p-4 rounded-2xl border border-emerald-50 dark:border-emerald-900/30">
                  <Label className="text-xs font-bold text-slate-600 dark:text-slate-400">{isAr ? "التوقيت" : "Timestamp"}</Label>
                  <Input
                    value={formatTimestamp(draftQ.timestampSeconds)}
                    onChange={(e) => {
                      const p = parseTimestamp(e.target.value);
                      if (p !== null) setDraftQ({ ...draftQ, timestampSeconds: p });
                    }}
                    dir="ltr"
                    className="h-10 w-[5.5rem] rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-white dark:bg-[#15201B] text-center font-mono text-sm shadow-sm"
                  />
                  {isPlayerReady && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDraftQ({ ...draftQ, timestampSeconds: getVideoTimestamp() })}
                        className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline underline-offset-4 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50 transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {isAr ? "استخدم موضع التشغيل" : "Use playhead"}
                      </button>
                      <span className="w-full text-[11px] font-bold text-slate-400 sm:w-auto">
                        {isAr ? "التشغيل الآن:" : "Now at:"}{" "}
                        <span dir="ltr" className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-black">
                          {formatTimestamp(getVideoTimestamp())}
                        </span>
                      </span>
                    </>
                  )}
                </div>
                <div>
                  <Label className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-400">{isAr ? "نص السؤال" : "Question"} *</Label>
                  <Textarea
                    value={draftQ.text}
                    onChange={(e) => setDraftQ({ ...draftQ, text: e.target.value })}
                    placeholder={isAr ? "اكتب السؤال…" : "Write the question…"}
                    rows={3}
                    className={cn("rounded-2xl border border-emerald-50 dark:border-emerald-900/30 bg-[#f4f7f5] dark:bg-[#0B100E] text-sm focus-visible:border-emerald-400 resize-none shadow-sm", isAr && FIELD_RTL)}
                    dir={isAr ? "rtl" : undefined}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[150px]">
                    <Label className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-400">{isAr ? "النوع" : "Type"}</Label>
                    <select
                      value={draftQ.questionType}
                      onChange={(e) =>
                        handleQuestionTypeDraft(e.target.value as VideoQuestion["questionType"])
                      }
                      className={cn(
                        "min-h-[44px] w-full rounded-xl border border-emerald-50 dark:border-emerald-900/30 bg-[#f4f7f5] dark:bg-[#0B100E] px-3 text-sm font-bold focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-400/10 outline-none transition-all shadow-sm",
                        isAr && FIELD_RTL,
                      )}
                      dir={isAr ? "rtl" : undefined}
                    >
                      <option value="mcq">{isAr ? "اختيار متعدد" : "Multiple choice"}</option>
                      <option value="true_false">{isAr ? "صح أو خطأ" : "True / False"}</option>
                      <option value="fill_blank">{isAr ? "إجابة قصيرة" : "Short answer"}</option>
                    </select>
                  </div>
                  <div>
                    <Label className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-400">{isAr ? "درجة" : "Pts"}</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={draftQ.points}
                      onChange={(e) =>
                        setDraftQ({
                          ...draftQ,
                          points: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="min-h-[44px] w-24 rounded-xl border border-emerald-50 dark:border-emerald-900/30 bg-[#f4f7f5] dark:bg-[#0B100E] text-center text-sm font-black tabular-nums shadow-sm focus:border-emerald-400"
                    />
                  </div>
                </div>

                {draftQ.questionType === "mcq" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 bg-[#f4f7f5] dark:bg-[#0B100E] p-4 rounded-2xl border border-emerald-50 dark:border-emerald-900/30 mt-4">
                    {(["A", "B", "C", "D"] as const).map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDraftQ({ ...draftQ, correctAnswer: opt })}
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-black transition-colors shadow-sm",
                            draftQ.correctAnswer === opt
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-[#15201B] text-slate-400 hover:border-emerald-300 dark:hover:border-emerald-600",
                          )}
                        >
                          {opt}
                        </button>
                        <Input
                          value={(draftQ[`option${opt}` as keyof VideoQuestion] as string) || ""}
                          onChange={(e) => setDraftQ({ ...draftQ, [`option${opt}`]: e.target.value })}
                          placeholder={`${isAr ? "خيار" : "Option"} ${opt}`}
                          className={cn("min-h-[44px] rounded-xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] text-sm shadow-sm focus:border-emerald-400", isAr && FIELD_RTL)}
                          dir={isAr ? "rtl" : undefined}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {draftQ.questionType === "true_false" && (
                  <div className="flex gap-4 mt-4">
                    <button
                      type="button"
                      onClick={() => setDraftQ({ ...draftQ, correctAnswer: "true" })}
                      className={cn(
                        "flex min-h-[56px] flex-1 flex-col items-center justify-center rounded-2xl border-2 py-4 text-sm font-black transition-all shadow-sm",
                        draftQ.correctAnswer === "true"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-[#15201B] text-slate-500 hover:border-emerald-300",
                      )}
                    >
                      <CheckCircle2 className={cn("mb-1.5 h-6 w-6", draftQ.correctAnswer === "true" ? "text-emerald-600 dark:text-emerald-400" : "")} />
                      {isAr ? "صح" : "True"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftQ({ ...draftQ, correctAnswer: "false" })}
                      className={cn(
                        "flex min-h-[56px] flex-1 flex-col items-center justify-center rounded-2xl border-2 py-4 text-sm font-black transition-all shadow-sm",
                        draftQ.correctAnswer === "false"
                          ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-[#15201B] text-slate-500 hover:border-red-300",
                      )}
                    >
                      <X className={cn("mb-1.5 h-6 w-6", draftQ.correctAnswer === "false" ? "text-red-600 dark:text-red-400" : "")} />
                      {isAr ? "خطأ" : "False"}
                    </button>
                  </div>
                )}

                {draftQ.questionType === "fill_blank" && (
                  <div className="bg-[#f4f7f5] dark:bg-[#0B100E] p-4 rounded-2xl border border-emerald-50 dark:border-emerald-900/30 mt-4">
                    <Label className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-400">{isAr ? "الإجابة الصحيحة" : "Correct answer"}</Label>
                    <Input
                      value={draftQ.correctAnswer}
                      onChange={(e) => setDraftQ({ ...draftQ, correctAnswer: e.target.value })}
                      placeholder={isAr ? "الإجابة المتوقعة" : "Expected answer"}
                      className={cn("min-h-[44px] rounded-xl border border-emerald-50 dark:border-emerald-900/30 bg-white dark:bg-[#15201B] shadow-sm focus:border-emerald-400", isAr && FIELD_RTL)}
                      dir={isAr ? "rtl" : undefined}
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-3 sm:justify-start pt-4 mt-6 border-t border-emerald-50 dark:border-emerald-900/30">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 font-bold bg-white dark:bg-[#15201B] hover:bg-slate-50 dark:hover:bg-slate-900/50 shadow-sm"
                onClick={() => {
                  setQModalOpen(false);
                  setDraftQ(null);
                  setQModalIdx(null);
                }}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="button" className="min-h-[44px] rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-md text-white px-6" onClick={commitQuestionModal}>
                {isAr ? "حفظ السؤال" : "Save question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TeacherStudentPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          isAr={isAr}
          titleHint={title}
          videoUrl={videoUrl}
          videoSource={videoSource}
          youtubeId={youtubeId}
          questions={questions}
          skipSegments={skipSegments}
        />
      </div>
    </Layout>
  );
}
