import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  Pencil,
  SkipForward,
  Eye,
  MoreHorizontal,
  Users,
  Sparkles,
  FileText,
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
    Player: new (elementId: string, config: Record<string, unknown>) => YTPlayer;
  };
  onYouTubeIframeAPIReady?: () => void;
}

const ytWindow = window as unknown as YTWindow;

const API_BASE = import.meta.env.VITE_API_URL || "";

/** هوية المنصة — أخضر حصاد */
const BRAND = "#1E4D35";
const PAGE_BG = "linear-gradient(to bottom, #f8faf8, #f3f7f4)";
const CARD_BORDER = "rgba(30, 77, 53, 0.08)";
const CARD_SHADOW = "0 1px 2px rgba(15, 40, 28, 0.04), 0 10px 28px rgba(15, 40, 28, 0.07)";
const TRANSITION = "transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]";
const VIDEO_LESSON_DRAFT_KEY = "hasad-video-lesson-builder-draft-v1";

const FIELD_RTL =
  "text-right [direction:rtl] placeholder:text-right placeholder:text-muted-foreground";

type AccessMode = "public" | "private";
type VideoSource = "youtube" | "upload" | "external";
/** واجهة الوصول: عام | خاص بكود فقط */
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
  accessMode: string;
  accessCode: string | null;
  isShared: boolean;
  skipSegments: SkipSegment[] | null;
  questions: APILessonQuestion[];
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

  useEffect(() => {
    if (!open || !isYt || !youtubeId) return;

    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.id = "yt-iframe-api";
      document.head.appendChild(tag);
    }

    const init = () => {
      if (prevYtRef.current) {
        try {
          prevYtRef.current.destroy();
        } catch {
          /* ignore */
        }
      }
      prevYtRef.current = new ytWindow.YT!.Player("yt-player-teacher-preview", {
        videoId: youtubeId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => setPrevReady(true),
        },
      });
    };

    if (ytWindow.YT?.Player) init();
    else ytWindow.onYouTubeIframeAPIReady = init;

    return () => {
      if (prevYtRef.current) {
        try {
          prevYtRef.current.destroy();
        } catch {
          /* ignore */
        }
        prevYtRef.current = null;
      }
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
          "max-h-[92vh] overflow-y-auto rounded-[22px] border sm:max-w-[920px]",
          isAr && "[&>button]:start-4 [&>button]:end-auto",
        )}
        style={{ borderColor: CARD_BORDER }}
        dir={isAr ? "rtl" : "ltr"}
      >
        <DialogHeader className="space-y-1 text-right sm:text-right">
          <DialogTitle className="text-lg font-black text-[#0f2918]">
            {isAr ? "معاينة كما يراها الطالب" : "Preview as student"}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-[#64748B]">
            {titleHint || (isAr ? "بدون عنوان" : "Untitled")} ·{" "}
            {isAr
              ? "يتوقف الفيديو عند الأسئلة كما في واجهة الطالب — للمعاينة فقط."
              : "Playback pauses at questions like the student view — preview only."}
          </DialogDescription>
        </DialogHeader>

        {!hasMedia ? (
          <p className="py-8 text-center text-sm font-bold text-[#64748B]">
            {isAr ? "أضف فيديوً أولاً." : "Add a video first."}
          </p>
        ) : (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              {isYt && youtubeId ? (
                <div id="yt-player-teacher-preview" className="h-full w-full" />
              ) : (
                <video ref={prevHtmlRef} src={videoUrl} controls className="h-full w-full object-contain" />
              )}
            </div>

            <AnimatePresence mode="wait">
              {activeRow && (
                <motion.div
                  key={activeRow._ord}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-4 overflow-hidden rounded-[20px] border bg-white p-5 shadow-md"
                  style={{ borderColor: CARD_BORDER }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-black text-[#94a3ab]">
                    <span className="rounded-full bg-[#eef5f0] px-2 py-0.5 text-[#1E4D35]">
                      {isAr ? "سؤال" : "Q"} {activeRow._ord + 1}/{sorted.length}
                    </span>
                    <span dir="ltr" className="font-mono tabular-nums">
                      {formatTimestamp(activeRow.timestampSeconds)}
                    </span>
                  </div>
                  <p className="mb-4 text-right text-base font-black leading-relaxed text-[#0f2918]">{activeRow.text}</p>

                  {activeRow.questionType === "mcq" && (
                    <div className="mb-4 grid gap-2">
                      {(["A", "B", "C", "D"] as const).map((opt) => {
                        const lab = activeRow[`option${opt}` as keyof VideoQuestion] as string;
                        if (!lab?.trim()) return null;
                        return (
                          <div
                            key={opt}
                            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#eef2ef] bg-[#fafdfb] px-3 py-2 text-right text-sm font-bold text-[#374151]"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-[#1E4D35] ring-1 ring-[#e8ece9]">
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
                      <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#eef2ef] bg-[#fafdfb] text-sm font-black text-[#64748B]">
                        {isAr ? "صح" : "True"}
                      </div>
                      <div className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#eef2ef] bg-[#fafdfb] text-sm font-black text-[#64748B]">
                        {isAr ? "خطأ" : "False"}
                      </div>
                    </div>
                  )}

                  {activeRow.questionType === "fill_blank" && (
                    <div className="mb-4 min-h-[44px] rounded-xl border border-dashed border-[#dce8e0] bg-[#fcfdfc] px-3 py-3 text-right text-sm text-[#94a3ab]">
                      {isAr ? "حقل إجابة قصيرة…" : "Short answer field…"}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={continuePreview}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl font-black text-white shadow-md"
                    style={{ background: BRAND }}
                  >
                    <Play className="h-4 w-4" fill="currentColor" />
                    {isAr ? "متابعة الفيديو" : "Continue video"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {!activeRow && sorted.length === 0 && (
              <p className="mt-3 text-center text-xs font-bold text-[#94a3ab]">
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
  const [accessUi, setAccessUi] = useState<AccessUi>("public");
  const [accessCode, setAccessCode] = useState(generateAccessCode());
  const [isShared, setIsShared] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<{ gradeLevel: string; count: number }[]>([]);
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
  const [timelineHover, setTimelineHover] = useState<number | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const sourceCardRef = useRef<HTMLDivElement>(null);

  const youtubeId = videoSource === "youtube" ? extractYouTubeId(videoUrl) : null;
  const playerRef = useRef<YTPlayer | null>(null);
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
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/students/grade-levels`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setGradeLevels)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (videoSource !== "youtube" || !youtubeId) {
      setPlayerReady(false);
      return;
    }

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
      playerRef.current = new ytWindow.YT!.Player("yt-player-create", {
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

    setSaving(true);
    try {
      const body = {
        title,
        subject: subject || undefined,
        description: description || undefined,
        videoUrl,
        videoType: videoSource === "external" && extractYouTubeId(videoUrl) ? "youtube" : videoSource,
        targetClass: targetClass || undefined,
        accessMode: accessModeForApi,
        accessCode: accessUi === "code" ? accessCode : undefined,
        isShared,
        skipSegments: skipSegments.length > 0 ? skipSegments : [],
        questions: questions.map((q) => ({
          timestampSeconds: q.timestampSeconds,
          questionType: q.questionType,
          text: q.text,
          optionA: q.optionA || null,
          optionB: q.optionB || null,
          optionC: q.optionC || null,
          optionD: q.optionD || null,
          correctAnswer: q.correctAnswer || null,
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
        throw new Error((err as { message?: string }).message || "Error");
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

  const timelineDuration = useMemo(() => {
    const ends = [
      videoDuration,
      ...questions.map((q) => q.timestampSeconds + 5),
      ...skipSegments.map((s) => s.end),
      60,
    ];
    return Math.max(...ends, 1);
  }, [videoDuration, questions, skipSegments]);

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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div
        className="min-h-[100dvh] overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
        style={{ background: PAGE_BG, fontFamily: "'Cairo', system-ui, sans-serif" }}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div className="mx-auto max-w-[1060px] px-4 py-4 sm:py-6">
          {/* العودة */}
          <button
            type="button"
            onClick={() => setLocation(editId ? `/teacher/video-lesson/${editId}` : "/teacher")}
            className={cn(
              "mb-4 flex min-h-[44px] items-center gap-2 text-sm font-bold text-[#64748B] transition-colors hover:text-[#0f2918]",
              TRANSITION,
            )}
          >
            <BackArrowIcon className="h-5 w-5 shrink-0 opacity-70" />
            {editId ? (isAr ? "العودة للدرس" : "Back to lesson") : isAr ? "العودة للوحة التحكم" : "Back to dashboard"}
          </button>

          <h1 className="mb-3 text-right text-xl font-black leading-tight text-[#0f2918] sm:text-2xl">
            {editId
              ? isAr
                ? "تعديل درس فيديو تفاعلي"
                : "Edit interactive video"
              : isAr
                ? "درس فيديو تفاعلي"
                : "Interactive video lesson"}
          </h1>

          {/* عنوان + مادة + فصل — أولاً */}
          <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
            <div className="min-w-0">
              <Label className="mb-1 block text-[11px] font-bold text-[#64748B]">
                {isAr ? "عنوان الدرس" : "Lesson title"} *
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isAr ? "مثال: الدوال الخطية — مقدمة" : "e.g. Linear functions — intro"}
                className={cn(
                  "min-h-[48px] rounded-xl border-2 py-2.5 text-sm font-bold focus:border-[#1E4D35]/35 focus:ring-[#1E4D35]/12",
                  isAr && FIELD_RTL,
                )}
                dir={isAr ? "rtl" : undefined}
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1 block text-[11px] font-bold text-[#64748B]">{isAr ? "المادة" : "Subject"}</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={isAr ? "رياضيات، علوم…" : "Math, Science…"}
                className={cn(
                  "min-h-[48px] rounded-xl border-2 focus:border-[#1E4D35]/35 focus:ring-[#1E4D35]/12",
                  isAr && FIELD_RTL,
                )}
                dir={isAr ? "rtl" : undefined}
              />
            </div>
            <div className="min-w-0">
              <Label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-[#64748B]">
                <GraduationCap className="h-3.5 w-3.5 text-[#1E4D35]" />
                {isAr ? "الصف / الفصل" : "Target class"}
              </Label>
              {gradeLevels.length > 0 ? (
                <select
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                  className={cn(
                    "min-h-[48px] w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-bold focus:border-[#1E4D35]/35 focus:outline-none focus:ring-4 focus:ring-[#1E4D35]/10",
                    isAr && FIELD_RTL,
                  )}
                  dir={isAr ? "rtl" : undefined}
                >
                  <option value="">{isAr ? "— جميع الفصول —" : "— All classes —"}</option>
                  {gradeLevels.map((g) => (
                    <option key={g.gradeLevel} value={g.gradeLevel}>
                      {g.gradeLevel} ({g.count} {isAr ? "طالب" : "students"})
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                  placeholder={isAr ? "مثال: 3/أ" : "e.g. 3/A"}
                  className={cn(
                    "min-h-[48px] rounded-xl border-2 focus:border-[#1E4D35]/35 focus:ring-[#1E4D35]/12",
                    isAr && FIELD_RTL,
                  )}
                  dir={isAr ? "rtl" : undefined}
                />
              )}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Popover open={descriptionOpen} onOpenChange={setDescriptionOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-black text-[#374151] shadow-sm hover:bg-[#fafdfb]",
                    TRANSITION,
                  )}
                  style={{ borderColor: CARD_BORDER }}
                >
                  <FileText className="h-4 w-4 shrink-0 text-[#1E4D35]" />
                  {isAr ? "الوصف" : "Description"}
                  {description.trim() ? (
                    <span className="rounded-full bg-[#eef5f0] px-1.5 py-0.5 text-[10px] font-bold text-[#1E4D35]">
                      {isAr ? "محفوظ" : "Saved"}
                    </span>
                  ) : null}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="rounded-2xl border p-4 shadow-xl sm:w-[400px] sm:max-w-[min(400px,calc(100vw-2rem))]"
                style={{ borderColor: CARD_BORDER }}
                align={isAr ? "start" : "end"}
                sideOffset={8}
                dir={isAr ? "rtl" : "ltr"}
              >
                <p className="mb-2 text-sm font-black text-[#0f2918]">{isAr ? "وصف الدرس" : "Lesson description"}</p>
                <p className="mb-3 text-[11px] leading-relaxed text-[#64748B]">
                  {isAr ? "اختياري — يظهر للطالب حسب سياسة العرض في المنصة." : "Optional — visibility follows platform rules."}
                </p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={isAr ? "اكتب وصفاً مختصراً للدرس…" : "Write a short lesson description…"}
                  rows={5}
                  className={cn(
                    "mb-3 rounded-xl border-2 bg-background text-sm font-semibold focus-visible:border-[#1E4D35]/35 focus-visible:ring-[#1E4D35]/12",
                    isAr && FIELD_RTL,
                  )}
                  dir={isAr ? "rtl" : undefined}
                />
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl font-black text-white hover:opacity-[0.96]"
                  style={{ background: BRAND }}
                  onClick={() => setDescriptionOpen(false)}
                >
                  {isAr ? "تم" : "Done"}
                </Button>
              </PopoverContent>
            </Popover>
          </div>

          {/* تذكير بعد الحقول — زر الأسئلة بجانب الفيديو */}
          <div
            className={cn("relative mb-5 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-4", TRANSITION)}
            style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
          >
            <div
              className="pointer-events-none absolute -start-10 top-0 h-24 w-24 rounded-full opacity-[0.1]"
              style={{ background: `radial-gradient(circle at center, ${BRAND}, transparent 70%)` }}
            />
            <div className="relative flex flex-wrap items-start justify-end gap-3 text-right">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black text-white shadow-sm",
                    !isAr && "uppercase tracking-wide",
                  )}
                  style={{ background: `linear-gradient(90deg, ${BRAND}, #2a6b47)` }}
                >
                  <Sparkles className="h-3 w-3" />
                  {isAr ? "تلميح" : "Tip"}
                </span>
                <span className="rounded-full bg-[#eef5f0] px-2 py-0.5 text-[11px] font-bold text-[#1E4D35]">
                  {questions.length}{" "}
                  {isAr
                    ? questions.length === 1
                      ? "سؤال"
                      : "أسئلة"
                    : questions.length === 1
                      ? "question"
                      : "questions"}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1 sm:text-right">
                <p className="text-sm font-black leading-snug text-[#0f2918]">
                  {isAr
                    ? "أوقف الفيديو عند اللحظة المناسبة واضغط «إضافة سؤال» بجانب عنوان الفيديو (على اليسار)."
                    : "Pause where it matters and tap “Add question” next to the video title (on the left)."}
                </p>
                <p className="text-[12px] leading-relaxed text-[#64748B]">
                  {isAr
                    ? "معاينة الدرس: من الشريط السفلي أو من زر «معاينة» بجانب «إضافة سؤال» — تعرض التوقف عند كل سؤال كما للطالب."
                    : "Preview from the bottom bar or the “Preview” button next to “Add question” — pauses match the student view."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8" dir="ltr">
            {/* عمود الفيديو — يسار الشاشة، عرض محدود */}
            <div className="w-full space-y-5 lg:w-[min(100%,472px)] lg:max-w-[100%] lg:shrink-0" dir="rtl">
              {/* رأس المشغّل: زر إضافة السؤال على اليسار (اتجاه LTR للصف فقط) */}
              <div dir="ltr" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm" style={{ borderColor: CARD_BORDER }}>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={openAddQuestionModal}
                    className={cn(
                      "flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-black text-white shadow-md hover:brightness-[1.05] active:scale-[0.99]",
                      TRANSITION,
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${BRAND} 0%, #174030 100%)`,
                      boxShadow: "0 6px 20px rgba(30, 77, 53, 0.28)",
                    }}
                  >
                    <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                    {isAr ? "إضافة سؤال" : "Add question"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    disabled={!isVideoValid() || questions.length === 0}
                    title={isAr ? "معاينة كما يراها الطالب" : "Preview as student"}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#dce8e0] bg-[#fafdfb] px-3 text-[11px] font-black text-[#1E4D35] hover:bg-[#f3f7f4] disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Eye className="h-4 w-4 shrink-0" />
                    {isAr ? "معاينة" : "Preview"}
                  </button>
                </div>
                <div dir="rtl" className="min-w-0 text-right">
                  <p className="text-[13px] font-black text-[#0f2918]">{isAr ? "فيديو الدرس" : "Lesson video"}</p>
                  <p className="text-[11px] text-[#64748B]">{isAr ? "شغّل ثم أضِف أسئلتك من هنا" : "Play, then add cues here"}</p>
                </div>
              </div>

              {/* بطل الفيديو */}
              <section
                className={cn("overflow-hidden rounded-[24px] border bg-white", TRANSITION)}
                style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
              >
                <div className="relative aspect-video w-full bg-black">
                  {videoSource === "youtube" && youtubeId ? (
                    <div id="yt-player-create" className="absolute inset-0 h-full w-full" />
                  ) : (videoSource === "upload" || videoSource === "external") && videoUrl.trim() ? (
                    <video ref={html5VideoRef} src={videoUrl} controls className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gradient-to-b from-[#0f2918] to-[#1a2e24] px-6 text-center">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                        <Play className="h-10 w-10 text-white opacity-90" fill="currentColor" />
                      </div>
                      <p className="max-w-sm text-sm font-bold leading-relaxed text-white/85">
                        {isAr ? "أضف رابط فيديو أو ارفع ملفاً للبدء" : "Add a video link or upload a file to start"}
                      </p>
                      <button
                        type="button"
                        onClick={scrollToVideoSource}
                        className="min-h-[44px] rounded-2xl bg-white px-6 text-sm font-black text-[#0f2918] shadow-lg hover:bg-[#eef5f0]"
                      >
                        {isAr ? "إضافة فيديو" : "Add video"}
                      </button>
                    </div>
                  )}
                </div>

                {hasVideoPreview && isPlayerReady && (
                  <div className="border-t border-[#eef2ef] bg-[#fafdfb]" style={{ borderColor: CARD_BORDER }}>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="flex items-center gap-2 text-xs font-black tabular-nums text-[#64748B]" dir="ltr">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-[#1E4D35]" />
                        <span>{formatTimestamp(currentTime)}</span>
                        <span className="text-[#94a3ab]">/</span>
                        <span>{formatTimestamp(videoDuration || currentTime)}</span>
                      </div>
                    </div>

                    {/* قطع / تخطّي مقاطع — ظاهر دائماً تحت المشغّل */}
                    <div className="border-t border-amber-200/40 bg-gradient-to-b from-amber-50/80 to-[#fafdfb] px-3 py-2.5">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-right">
                        <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1 ring-1 ring-amber-200/60">
                          <SkipForward className="h-3.5 w-3.5 text-amber-600" />
                          <span className="text-[11px] font-black text-amber-950">
                            {isAr ? "تخطّي جزء من الفيديو" : "Skip part of the video"}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold leading-snug text-amber-900/75">
                          {isAr
                            ? "حدّد بداية ونهاية المقطع لتعدّيه أثناء التشغيل أو المعاينة."
                            : "Set start and end to jump over it during playback or preview."}
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
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-400/55 bg-white px-3 text-[11px] font-black text-amber-950 shadow-sm hover:bg-amber-50"
                          >
                            <SkipForward className="h-3.5 w-3.5" />
                            {isAr ? "قطع مقطع من هنا" : "Cut segment from here"}
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/55 bg-white px-2 py-1.5 shadow-sm">
                            <span className="text-[11px] font-bold text-amber-950">
                              {isAr ? "من" : "From"}{" "}
                              <span dir="ltr" className="tabular-nums">
                                {formatTimestamp(pendingSegmentStart)}
                              </span>
                            </span>
                            <span className="text-[11px] text-amber-800/80">{isAr ? "إلى" : "To"}</span>
                            <Input
                              value={segmentEndInput}
                              onChange={(e) => setSegmentEndInput(e.target.value)}
                              placeholder="00:45"
                              dir="ltr"
                              className="h-9 w-[4.5rem] rounded-lg border text-center text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setSegmentEndInput(formatTimestamp(currentTime))}
                              className="text-[11px] font-black text-amber-700 underline-offset-2 hover:underline"
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
                              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-amber-600 px-2.5 text-[11px] font-black text-white hover:bg-amber-700"
                            >
                              <Plus className="h-3 w-3" />
                              {isAr ? "تأكيد" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPendingSegmentStart(null);
                                setSegmentEndInput("");
                              }}
                              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-amber-800/70 hover:bg-amber-100 hover:text-amber-950"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      {skipSegments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 border-t border-amber-200/40 pt-2">
                          {skipSegments.map((seg, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 rounded-lg border border-amber-300/45 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-950 shadow-sm"
                            >
                              <span dir="ltr" className="font-mono tabular-nums">
                                {formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSkipSegments((prev) => prev.filter((_, j) => j !== i))}
                                className="rounded p-1 text-red-600 hover:bg-red-50"
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
            </div>

            <div className="min-w-0 flex-1 space-y-5" dir="rtl">

            {/* مصدر الفيديو + الوصول — عمود جانبي ضيق */}
            <div ref={sourceCardRef} className="scroll-mt-24 space-y-4">
              <section
                className={cn("rounded-2xl border bg-white p-3 sm:p-4", TRANSITION)}
                style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
              >
                <h2 className="mb-2 text-right text-xs font-black text-[#0f2918]">
                  {isAr ? "مصدر الفيديو" : "Video source"} *
                </h2>
                {editId && (
                  <p className="mb-2 text-[10px] leading-relaxed text-[#94a3ab]">
                    {isAr ? "لا يمكن تغيير نوع المصدر بعد الإنشاء." : "Source type is fixed after creation."}
                  </p>
                )}
                <div
                  className={cn("mb-3 grid gap-0.5 rounded-xl bg-[#f3f7f4] p-0.5", isAdmin ? "grid-cols-3" : "grid-cols-2")}
                >
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
                        "flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-black transition-colors sm:flex-row sm:gap-1 sm:px-1.5 sm:text-[11px]",
                        videoSource === key
                          ? "bg-white text-[#1E4D35] shadow-sm"
                          : "text-[#64748B] hover:text-[#0f2918]",
                        editId && key !== videoSource && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      <span className="sm:hidden">{short}</span>
                      <span className="hidden sm:inline">{full}</span>
                    </button>
                  ))}
                </div>

                {videoSource === "youtube" && (
                  <div className="space-y-2">
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      dir="ltr"
                      className="min-h-[44px] rounded-xl border-2 font-mono text-xs focus:border-[#1E4D35]/35"
                    />
                    {videoUrl && !youtubeId && (
                      <p className="text-[11px] font-bold text-destructive">{isAr ? "رابط يوتيوب غير صالح" : "Invalid URL"}</p>
                    )}
                    {youtubeId && (
                      <div
                        className="overflow-hidden rounded-lg border bg-black shadow-inner"
                        style={{ borderColor: CARD_BORDER }}
                      >
                        <img
                          src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                          alt=""
                          className="max-h-24 w-full object-cover opacity-90"
                        />
                      </div>
                    )}
                  </div>
                )}

                {videoSource === "upload" && (
                  <div className="space-y-3">
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
                        "cursor-pointer rounded-xl border-2 border-dashed px-3 py-6 text-center transition-colors",
                        dragUpload ? "border-[#1E4D35] bg-[#eef5f0]" : "border-[#dce8e0] bg-[#fafdfb] hover:border-[#1E4D35]/35",
                      )}
                    >
                      {uploading ? (
                        <div className="space-y-2">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1E4D35]" />
                          <p className="text-sm font-black text-[#1E4D35]">
                            {isAr ? `جاري الرفع… ${uploadProgress}%` : `Uploading… ${uploadProgress}%`}
                          </p>
                          <div className="mx-auto h-2 max-w-xs overflow-hidden rounded-full bg-[#e8ece9]">
                            <div
                              className="h-full rounded-full bg-[#1E4D35] transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="mx-auto h-6 w-6 text-[#1E4D35]/70" />
                          <p className="text-xs font-black text-[#0f2918]">
                            {isAr ? "اسحب الفيديو أو اختر ملفاً" : "Drag or choose a video"}
                          </p>
                          <p className="text-[11px] font-semibold text-[#94a3ab]">MP4, WebM, MOV · max 500MB</p>
                        </div>
                      )}
                    </div>
                    {videoUrl && (
                      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                        <span className="flex-1 text-xs font-bold text-green-800">
                          {isAr ? "تم الرفع" : "Uploaded"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setVideoUrl("");
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="text-xs font-black text-red-600 hover:underline"
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
                      className="min-h-[44px] rounded-xl border-2 font-mono text-xs focus:border-[#1E4D35]/35"
                    />
                    <p className="mt-2 text-[11px] leading-relaxed text-[#94a3ab]">
                      {isAr ? "رابط مباشر لملف فيديو (MP4 أو WebM)." : "Direct link to a video file (MP4 or WebM)."}
                    </p>
                  </div>
                )}
              </section>

              <section
                className={cn(
                  "rounded-2xl border-2 bg-gradient-to-br from-[#f8faf8] to-white p-3 sm:p-4",
                  TRANSITION,
                )}
                style={{ borderColor: "rgba(30, 77, 53, 0.14)", boxShadow: "0 2px 14px rgba(30, 77, 53, 0.06)" }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5 text-right">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E4D35]/10 text-[#1E4D35]"
                      aria-hidden
                    >
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-black text-[#0f2918]">{isAr ? "مشاركة مع المعلمين" : "Share with teachers"}</p>
                      <p className="text-[11px] leading-relaxed text-[#64748B]">
                        {isAr
                          ? "فعّلها إذا أردت أن يطلع زملاؤك على الدرس ويعيدوا استخدامه."
                          : "Enable so colleagues can discover and reuse this lesson."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e8ece9] bg-white px-3 py-2 sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                    <span className="text-[11px] font-bold text-[#64748B] sm:hidden">
                      {isShared ? (isAr ? "مفعّل" : "On") : isAr ? "معطّل" : "Off"}
                    </span>
                    <Switch checked={isShared} onCheckedChange={setIsShared} className="data-[state=checked]:bg-[#1E4D35]" />
                  </div>
                </div>
              </section>

              <section
                className={cn("rounded-2xl border bg-white p-3 sm:p-4", TRANSITION)}
                style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
              >
                <h2 className="mb-2 text-right text-xs font-black text-[#0f2918]">{isAr ? "وضع الوصول" : "Access"}</h2>
                <div
                  className="flex rounded-xl border border-[#e5e7eb] bg-[#f3f7f4] p-0.5"
                  role="tablist"
                  aria-label={isAr ? "وضع الوصول" : "Access mode"}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={accessUi === "public"}
                    onClick={() => setAccessUi("public")}
                    className={cn(
                      "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[11px] font-black transition-colors",
                      accessUi === "public" ? "bg-white text-[#1E4D35] shadow-sm" : "text-[#64748B] hover:text-[#0f2918]",
                    )}
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0 opacity-80" />
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
                      "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[11px] font-black transition-colors",
                      accessUi === "code" ? "bg-white text-[#1E4D35] shadow-sm" : "text-[#64748B] hover:text-[#0f2918]",
                    )}
                  >
                    <KeyRound className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    {isAr ? "خاص بكود" : "Code"}
                  </button>
                </div>
                {accessUi === "code" && (
                  <div className="mt-3">
                    <Label className="mb-1 text-[10px] font-bold text-[#64748B]">{isAr ? "رمز الوصول" : "Access code"}</Label>
                    <Input
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      dir="ltr"
                      className="mt-1 min-h-[44px] rounded-xl border-2 text-center font-mono text-sm tracking-[0.15em]"
                    />
                  </div>
                )}
              </section>
            </div>
              {/* تايم لاين */}
              <section
                className={cn("rounded-2xl border bg-white p-3 sm:p-4", TRANSITION)}
                style={{ borderColor: CARD_BORDER, boxShadow: CARD_SHADOW }}
              >
                <h3 className="mb-3 text-right text-sm font-black text-[#0f2918]">
                  {isAr ? "خط الأسئلة" : "Question timeline"}
                </h3>
                <div dir="ltr" className="max-w-full overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                  <div className="relative mx-auto min-h-[52px] min-w-[min(100%,280px)] px-1">
                    <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-[#e8ece9]">
                      {skipSegments.map((seg, i) => (
                        <div
                          key={i}
                          className="absolute top-0 h-full rounded-full bg-amber-400/55"
                          style={{
                            left: `${(seg.start / timelineDuration) * 100}%`,
                            width: `${((seg.end - seg.start) / timelineDuration) * 100}%`,
                          }}
                        />
                      ))}
                      <div
                        className="absolute top-0 h-full rounded-full bg-[#1E4D35]/25 transition-[width]"
                        style={{
                          width: `${Math.min(100, ((videoDuration ? currentTime : 0) / timelineDuration) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="relative mt-0 h-10">
                      {sortedQuestionIndices.map((realIdx, order) => {
                        const q = questions[realIdx];
                        const pct = (q.timestampSeconds / timelineDuration) * 100;
                        return (
                          <button
                            key={`${realIdx}-${order}`}
                            type="button"
                            title={`${q.text?.slice(0, 120) || (isAr ? "سؤال" : "Question")} · ${formatTimestamp(q.timestampSeconds)}`}
                            style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                            className="absolute top-1 flex flex-col items-center outline-none"
                            onMouseEnter={() => setTimelineHover(realIdx)}
                            onMouseLeave={() => setTimelineHover(null)}
                            onClick={() => seekTo(q.timestampSeconds)}
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1E4D35] bg-[#eef5f0] text-[11px] font-black text-[#1E4D35] shadow-sm hover:bg-[#1E4D35] hover:text-white">
                              {order + 1}
                            </span>
                            {timelineHover === realIdx && (
                              <span
                                className="absolute top-10 z-10 max-w-[min(240px,calc(100vw-3rem))] rounded-lg border bg-white px-2 py-1.5 text-start text-[10px] font-bold leading-snug text-[#0f2918] shadow-md"
                                style={{ borderColor: CARD_BORDER }}
                              >
                                <span className="block text-[#94a3ab]">
                                  #{order + 1} · <span dir="ltr">{formatTimestamp(q.timestampSeconds)}</span>
                                </span>
                                <span className="mt-0.5 block text-[#0f2918]">
                                  {q.text?.trim()
                                    ? q.text.length > 90
                                      ? `${q.text.slice(0, 90)}…`
                                      : q.text
                                    : isAr
                                      ? "(بلا نص)"
                                      : "(No text)"}
                                </span>
                                <span className="mt-0.5 block text-[10px] font-semibold text-[#64748B]">
                                  {questionTypeLabel(q.questionType)}
                                </span>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {questions.length === 0 && (
                  <p className="mt-3 text-center text-[13px] font-semibold leading-relaxed text-[#64748B]">
                    {isAr
                      ? "لم تتم إضافة أسئلة بعد. شغّل الفيديو وأضف سؤالاً عند التوقيت المطلوب."
                      : "No questions yet. Play the video and add a question at the right moment."}
                  </p>
                )}
              </section>

              {/* قائمة الأسئلة */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef2ef] pb-3">
                  <h3 className="text-right text-sm font-black text-[#0f2918]">
                    {isAr ? `الأسئلة التفاعلية (${questions.length})` : `Interactive questions (${questions.length})`}
                  </h3>
                  <button
                    type="button"
                    onClick={openAddQuestionModal}
                    className="text-[11px] font-black text-[#1E4D35] underline-offset-4 hover:underline"
                  >
                    {isAr ? "+ إضافة سريعة" : "+ Quick add"}
                  </button>
                </div>
                <div className="space-y-2">
                  {sortedQuestionIndices.map((realIdx, order) => {
                    const q = questions[realIdx];
                    return (
                      <motion.div
                        key={`card-${realIdx}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card
                          className={cn(
                            "border border-[#eef2ef] p-3 shadow-sm transition-colors hover:border-[#1E4D35]/20",
                            TRANSITION,
                          )}
                          style={{ borderRadius: "14px", boxShadow: "0 1px 2px rgba(15, 40, 28, 0.04)" }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-1.5 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-[#eef5f0] px-1.5 text-[11px] font-black text-[#1E4D35]">
                                  {order + 1}
                                </span>
                                <button
                                  type="button"
                                  dir="ltr"
                                  onClick={() => seekTo(q.timestampSeconds)}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-[#f3f7f4] px-2 py-1 text-[11px] font-black tabular-nums text-[#374151] sm:min-h-0"
                                >
                                  <Clock className="h-3 w-3 text-[#94a3ab]" />
                                  {formatTimestamp(q.timestampSeconds)}
                                </button>
                                <span className="rounded-full bg-[#f8faf8] px-2 py-0.5 text-[10px] font-bold text-[#64748B]">
                                  {questionTypeLabel(q.questionType)}
                                </span>
                              </div>
                              <p className="text-[13px] font-bold leading-snug text-[#0f2918]">
                                {q.text || (
                                  <span className="italic text-[#94a3ab]">
                                    {isAr ? "لا يوجد نص بعد" : "No text yet"}
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] font-bold text-[#94a3ab]">
                                {q.points} {isAr ? "درجة" : "pts"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditQuestionModal(realIdx)}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#1E4D35] hover:bg-[#f3f7f4]"
                                title={isAr ? "تعديل" : "Edit"}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeQuestion(realIdx)}
                                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-red-100 bg-white text-red-600 hover:bg-red-50"
                                title={isAr ? "حذف" : "Delete"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#e5e7eb] bg-white text-[#64748B] hover:bg-[#f9faf9]"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border shadow-lg" dir={isAr ? "rtl" : "ltr"}>
                                  <DropdownMenuItem
                                    className="font-bold"
                                    onClick={() => seekTo(q.timestampSeconds)}
                                  >
                                    <Play className="h-4 w-4 opacity-60" />
                                    {isAr ? "انتقل لهذا التوقيت" : "Jump to time"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </section>

            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <footer
          className={cn(
            "fixed bottom-0 inset-x-0 z-40 border-t border-[#eef2ef] bg-[#fcfdfc]/95 backdrop-blur-md",
            TRANSITION,
          )}
          style={{ borderColor: CARD_BORDER }}
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="mx-auto flex w-full max-w-[1060px] flex-wrap items-center justify-center gap-1.5 px-3 py-2 sm:justify-between">
            <button
              type="button"
              onClick={() => setLocation(editId ? `/teacher/video-lesson/${editId}` : "/teacher")}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 text-xs font-black text-[#374151] hover:bg-[#f9faf9] sm:flex-none sm:text-[13px]"
            >
              <BackArrowIcon className="h-3.5 w-3.5" />
              {isAr ? "رجوع" : "Back"}
            </button>
            <button
              type="button"
              onClick={saveDraftLocal}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-dashed border-[#dce8e0] px-3 text-xs font-bold text-[#64748B] hover:border-[#1E4D35]/25 hover:text-[#1E4D35] sm:flex-none sm:text-[13px]"
            >
              {isAr ? "حفظ كمسودة" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={!isVideoValid() || questions.length === 0}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-3 text-xs font-black text-[#1E4D35] hover:bg-[#f3f7f4] disabled:pointer-events-none disabled:opacity-40 sm:flex-none sm:text-[13px]"
            >
              <Eye className="h-3.5 w-3.5" />
              {isAr ? "معاينة الدرس" : "Preview"}
            </button>
            <button
              type="button"
              onClick={handlePublishClick}
              disabled={saving || !title.trim() || !isVideoValid() || questions.length === 0}
              className={cn(
                "flex min-h-[44px] flex-[1_1_140px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-black text-white shadow-md disabled:pointer-events-none disabled:opacity-45 sm:min-w-[158px] sm:flex-none sm:text-[13px]",
                TRANSITION,
              )}
              style={{
                background: `linear-gradient(90deg, ${BRAND} 0%, #225739 100%)`,
                boxShadow: "0 6px 18px rgba(30, 77, 53, 0.22)",
              }}
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
              "max-h-[min(90vh,720px)] overflow-y-auto rounded-[24px] border p-6 sm:max-w-xl",
              isAr && "[&>button]:start-4 [&>button]:end-auto rtl:text-right",
            )}
            style={{ borderColor: CARD_BORDER }}
            dir={isAr ? "rtl" : "ltr"}
          >
            <DialogHeader className={cn("space-y-2 text-right sm:text-right")}>
              <DialogTitle className="text-xl font-black text-[#0f2918]">
                {qModalIdx === null
                  ? isAr ? "سؤال جديد" : "New question"
                  : isAr ? "تعديل السؤال" : "Edit question"}
              </DialogTitle>
              <DialogDescription className="text-[13px] leading-relaxed text-[#64748B]">
                {isAr ? "اضبط التوقيت والنوع والدرجة ثم احفظ." : "Set time, type, and points, then save."}
              </DialogDescription>
            </DialogHeader>
            {draftQ && (
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs font-bold text-[#64748B]">{isAr ? "التوقيت" : "Timestamp"}</Label>
                  <Input
                    value={formatTimestamp(draftQ.timestampSeconds)}
                    onChange={(e) => {
                      const p = parseTimestamp(e.target.value);
                      if (p !== null) setDraftQ({ ...draftQ, timestampSeconds: p });
                    }}
                    dir="ltr"
                    className="h-10 w-[5.5rem] rounded-xl border-2 text-center font-mono text-sm"
                  />
                  {isPlayerReady && (
                    <>
                      <button
                        type="button"
                        onClick={() => setDraftQ({ ...draftQ, timestampSeconds: getVideoTimestamp() })}
                        className="text-xs font-black text-[#1E4D35] underline-offset-2 hover:underline"
                      >
                        {isAr ? "استخدم موضع التشغيل" : "Use playhead"}
                      </button>
                      <span className="w-full text-[11px] font-bold text-[#94a3ab] sm:w-auto">
                        {isAr ? "التشغيل الآن:" : "Now at:"}{" "}
                        <span dir="ltr" className="font-mono tabular-nums text-[#1E4D35]">
                          {formatTimestamp(getVideoTimestamp())}
                        </span>
                      </span>
                    </>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-bold text-[#64748B]">{isAr ? "نص السؤال" : "Question"} *</Label>
                  <Textarea
                    value={draftQ.text}
                    onChange={(e) => setDraftQ({ ...draftQ, text: e.target.value })}
                    placeholder={isAr ? "اكتب السؤال…" : "Write the question…"}
                    rows={3}
                    className={cn("mt-1 rounded-2xl border-2", isAr && FIELD_RTL)}
                    dir={isAr ? "rtl" : undefined}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Label className="text-xs font-bold text-[#64748B]">{isAr ? "النوع" : "Type"}</Label>
                  <select
                    value={draftQ.questionType}
                    onChange={(e) =>
                      handleQuestionTypeDraft(e.target.value as VideoQuestion["questionType"])
                    }
                    className={cn(
                      "min-h-10 flex-1 rounded-xl border-2 border-border bg-background px-3 text-sm font-bold focus:border-[#1E4D35]/35 focus:outline-none",
                      isAr && FIELD_RTL,
                    )}
                    dir={isAr ? "rtl" : undefined}
                  >
                    <option value="mcq">{isAr ? "اختيار متعدد" : "Multiple choice"}</option>
                    <option value="true_false">{isAr ? "صح أو خطأ" : "True / False"}</option>
                    <option value="fill_blank">{isAr ? "إجابة قصيرة" : "Short answer"}</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold text-[#64748B]">{isAr ? "درجة" : "Pts"}</Label>
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
                      className="h-10 w-20 rounded-xl border-2 text-center text-sm font-black tabular-nums"
                    />
                  </div>
                </div>

                {draftQ.questionType === "mcq" && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(["A", "B", "C", "D"] as const).map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDraftQ({ ...draftQ, correctAnswer: opt })}
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 text-xs font-black transition-colors",
                            draftQ.correctAnswer === opt
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-[#e5e7eb] text-[#64748B]",
                          )}
                        >
                          {opt}
                        </button>
                        <Input
                          value={(draftQ[`option${opt}` as keyof VideoQuestion] as string) || ""}
                          onChange={(e) => setDraftQ({ ...draftQ, [`option${opt}`]: e.target.value })}
                          placeholder={`${isAr ? "خيار" : "Option"} ${opt}`}
                          className={cn("rounded-xl border-2 text-sm", isAr && FIELD_RTL)}
                          dir={isAr ? "rtl" : undefined}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {draftQ.questionType === "true_false" && (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDraftQ({ ...draftQ, correctAnswer: "true" })}
                      className={cn(
                        "flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-2xl border-2 py-3 text-sm font-black transition-colors",
                        draftQ.correctAnswer === "true"
                          ? "border-green-600 bg-green-50 text-green-800"
                          : "border-[#e5e7eb] text-[#64748B]",
                      )}
                    >
                      <CheckCircle2 className="mb-1 h-5 w-5" />
                      {isAr ? "صح" : "True"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftQ({ ...draftQ, correctAnswer: "false" })}
                      className={cn(
                        "flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-2xl border-2 py-3 text-sm font-black transition-colors",
                        draftQ.correctAnswer === "false"
                          ? "border-red-500 bg-red-50 text-red-800"
                          : "border-[#e5e7eb] text-[#64748B]",
                      )}
                    >
                      <X className="mb-1 h-5 w-5" />
                      {isAr ? "خطأ" : "False"}
                    </button>
                  </div>
                )}

                {draftQ.questionType === "fill_blank" && (
                  <div>
                    <Label className="text-xs font-bold text-[#64748B]">{isAr ? "الإجابة الصحيحة" : "Correct answer"}</Label>
                    <Input
                      value={draftQ.correctAnswer}
                      onChange={(e) => setDraftQ({ ...draftQ, correctAnswer: e.target.value })}
                      placeholder={isAr ? "الإجابة المتوقعة" : "Expected answer"}
                      className={cn("mt-1 rounded-xl border-2", isAr && FIELD_RTL)}
                      dir={isAr ? "rtl" : undefined}
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] rounded-2xl border-2 font-bold"
                onClick={() => {
                  setQModalOpen(false);
                  setDraftQ(null);
                  setQModalIdx(null);
                }}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="button" className="min-h-[44px] rounded-2xl font-black" onClick={commitQuestionModal}>
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
