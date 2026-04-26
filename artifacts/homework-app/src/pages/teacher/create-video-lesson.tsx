import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import { Plus, Trash2, Save, ArrowRight, ArrowLeft, CheckCircle2, X, Globe, Lock, GraduationCap, Play, Clock, Video, Loader2, Settings, ChevronUp, ChevronDown, Upload, Link2, Share2, Pencil, SkipForward } from "lucide-react";
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
  };
  onYouTubeIframeAPIReady?: () => void;
}

const ytWindow = window as unknown as YTWindow;

const API_BASE = import.meta.env.VITE_API_URL || "";

type AccessMode = "public" | "private";
type VideoSource = "youtube" | "upload" | "external";

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

export default function CreateVideoLesson() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const BackArrowIcon = isAr ? ArrowRight : ArrowLeft;

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((u) => { if (u?.isAdmin) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoSource, setVideoSource] = useState<VideoSource>("youtube");
  const [targetClass, setTargetClass] = useState("");
  const [accessMode, setAccessMode] = useState<AccessMode>("public");
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
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [skipSegments, setSkipSegments] = useState<SkipSegment[]>([]);
  const [pendingSegmentStart, setPendingSegmentStart] = useState<number | null>(null);
  const [segmentEndInput, setSegmentEndInput] = useState("");

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
          const vType = (["youtube", "upload", "external"].includes(data.videoType) ? data.videoType : "youtube") as VideoSource;
          setVideoSource(vType);
          setTargetClass(data.targetClass || "");
          setAccessMode((data.accessMode === "private" ? "private" : "public") as AccessMode);
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
            }))
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
      .then((r) => r.ok ? r.json() : [])
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
            } catch {}
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
        try { playerRef.current.destroy(); } catch {}
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
      } catch {}
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
    } catch (err) {
      toast.error(isAr ? "خطأ في رفع الفيديو" : "Video upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const addQuestionAtCurrentTime = () => {
    let ts = 0;
    if (videoSource === "youtube" && playerReady) {
      ts = currentTime;
    } else if (videoSource !== "youtube" && html5VideoRef.current) {
      ts = Math.floor(html5VideoRef.current.currentTime);
    }
    setQuestions((prev) => {
      const newQ: VideoQuestion = {
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
      const updated = [...prev, newQ].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
      const newIdx = updated.indexOf(newQ);
      setTimeout(() => setEditingIdx(newIdx), 0);
      return updated;
    });
  };

  const updateQuestion = (idx: number, field: keyof VideoQuestion, value: string | number) => {
    setQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const handleQuestionTypeChange = (idx: number, type: VideoQuestion["questionType"]) => {
    setQuestions((prev) => {
      const updated = [...prev];
      const q = { ...updated[idx] };
      q.questionType = type;
      q.optionA = "";
      q.optionB = "";
      q.optionC = "";
      q.optionD = "";
      if (type === "true_false") {
        q.correctAnswer = "true";
      } else if (type === "fill_blank") {
        q.correctAnswer = "";
      } else {
        q.correctAnswer = "A";
      }
      updated[idx] = q;
      return updated;
    });
  };

  const isVideoValid = () => {
    if (videoSource === "youtube") return !!youtubeId;
    return !!videoUrl.trim();
  };

  const handleSave = async () => {
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
        accessMode,
        accessCode: accessMode === "private" ? accessCode : undefined,
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
      toast.success(editId ? (isAr ? "تم تحديث الدرس بنجاح!" : "Lesson updated!") : (isAr ? "تم إنشاء درس الفيديو بنجاح!" : "Video lesson created!"));
      setLocation(`/teacher/video-lesson/${lessonId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : (isAr ? "خطأ في الحفظ" : "Error saving");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const seekTo = (seconds: number) => {
    if (videoSource === "youtube") {
      try { playerRef.current?.seekTo?.(seconds, true); } catch {}
    } else if (html5VideoRef.current) {
      html5VideoRef.current.currentTime = seconds;
    }
  };

  const hasVideoPreview = (videoSource === "youtube" && !!youtubeId) || (videoSource !== "youtube" && !!videoUrl.trim());
  const isPlayerReady = videoSource === "youtube" ? playerReady : !!videoUrl.trim();

  if (loadingEdit) {
    return (
      <Layout>
        <div className="flex justify-center p-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <button
          onClick={() => setLocation(editId ? `/teacher/video-lesson/${editId}` : "/teacher")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-semibold mb-6 transition-colors"
        >
          <BackArrowIcon className="w-5 h-5" />
          {editId ? (isAr ? "العودة للدرس" : "Back to Lesson") : (isAr ? "العودة للوحة التحكم" : "Back to Dashboard")}
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-red-500/10 rounded-2xl">
            {editId ? <Pencil className="w-8 h-8 text-red-500" /> : <Video className="w-8 h-8 text-red-500" />}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              {editId ? (isAr ? "تعديل درس الفيديو" : "Edit Video Lesson") : (isAr ? "درس فيديو تفاعلي" : "Interactive Video Lesson")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {editId ? (isAr ? "عدّل محتوى الدرس وأسئلته" : "Update the lesson content and questions") : (isAr ? "أضف أسئلة على الفيديو ليتوقف تلقائياً عندها" : "Add questions that pause the video automatically")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <Card className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-sm font-bold">{isAr ? "عنوان الدرس" : "Lesson Title"} *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={isAr ? "مثال: الدرس الأول - الجمع والطرح" : "e.g., Lesson 1 - Addition"}
                    className="text-base font-bold mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-bold">{isAr ? "المادة" : "Subject"}</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={isAr ? "رياضيات" : "Math"} className="mt-1" />
                </div>
                <div>
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    {isAr ? "الفصل المستهدف" : "Target Class"}
                  </Label>
                  {gradeLevels.length > 0 ? (
                    <select
                      value={targetClass}
                      onChange={(e) => setTargetClass(e.target.value)}
                      className="w-full mt-1 px-3 py-2.5 rounded-xl border border-input bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">{isAr ? "— جميع الفصول —" : "— All classes —"}</option>
                      {gradeLevels.map((g) => (
                        <option key={g.gradeLevel} value={g.gradeLevel}>
                          {g.gradeLevel} ({g.count} {isAr ? "طالب" : "students"})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input value={targetClass} onChange={(e) => setTargetClass(e.target.value)} placeholder={isAr ? "مثال: 3/أ" : "e.g., 3/A"} className="mt-1" />
                  )}
                </div>
              </div>
              <div>
                <Label className="text-sm font-bold">{isAr ? "الوصف" : "Description"}</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isAr ? "وصف اختياري" : "Optional"} className="mt-1" />
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <Label className="text-sm font-bold">
                {isAr ? "مصدر الفيديو" : "Video Source"} *
                {editId && (
                  <span className="mr-2 text-xs font-normal text-muted-foreground">
                    ({isAr ? "لا يمكن تغيير نوع الفيديو بعد الإنشاء" : "Video type cannot be changed after creation"})
                  </span>
                )}
              </Label>
              <div className={`grid gap-2 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
                {([
                  { key: "youtube" as VideoSource, label: isAr ? "يوتيوب" : "YouTube", icon: <Play className="w-4 h-4" /> },
                  ...(isAdmin ? [{ key: "upload" as VideoSource, label: isAr ? "رفع فيديو" : "Upload", icon: <Upload className="w-4 h-4" /> }] : []),
                  { key: "external" as VideoSource, label: isAr ? "رابط خارجي" : "External URL", icon: <Link2 className="w-4 h-4" /> },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    disabled={!!editId && tab.key !== videoSource}
                    onClick={() => { if (!editId) { setVideoSource(tab.key); if (tab.key !== videoSource) { setVideoUrl(""); setPlayerReady(false); } } }}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                      videoSource === tab.key ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400" : "border-border text-muted-foreground hover:border-red-300"
                    } ${editId && tab.key !== videoSource ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {videoSource === "youtube" && (
                <div>
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    dir="ltr"
                    className="text-base font-mono"
                  />
                  {videoUrl && !youtubeId && (
                    <p className="text-xs text-destructive font-bold mt-1">
                      {isAr ? "رابط يوتيوب غير صالح" : "Invalid YouTube URL"}
                    </p>
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
                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
                  />
                  {!videoUrl ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full p-8 border-2 border-dashed border-red-300 dark:border-red-800 rounded-2xl text-center hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-50"
                    >
                      {uploading ? (
                        <div className="space-y-2">
                          <Loader2 className="w-8 h-8 text-red-500 mx-auto animate-spin" />
                          <p className="text-sm font-bold text-red-600 dark:text-red-400">
                            {isAr ? `جاري الرفع... ${uploadProgress}%` : `Uploading... ${uploadProgress}%`}
                          </p>
                          <div className="w-full bg-muted rounded-full h-2 max-w-xs mx-auto">
                            <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 text-red-400 mx-auto" />
                          <p className="text-sm font-bold text-muted-foreground">
                            {isAr ? "اضغط لاختيار ملف فيديو (حد 500 ميجا)" : "Click to select a video file (max 500MB)"}
                          </p>
                          <p className="text-xs text-muted-foreground">MP4, WebM, MOV</p>
                        </div>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      <span className="text-sm font-bold text-green-700 dark:text-green-300 flex-1">{isAr ? "تم رفع الفيديو بنجاح" : "Video uploaded successfully"}</span>
                      <button
                        onClick={() => { setVideoUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        className="text-xs text-red-500 hover:underline font-bold"
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
                    className="text-base font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? "أدخل رابط مباشر لملف فيديو (MP4, WebM)" : "Enter a direct video file URL (MP4, WebM)"}
                  </p>
                </div>
              )}
            </Card>

            {hasVideoPreview && (
              <Card className="overflow-hidden">
                {videoSource === "youtube" && youtubeId ? (
                  <div className="aspect-video bg-black">
                    <div id="yt-player-create" className="w-full h-full" />
                  </div>
                ) : (videoSource === "upload" || videoSource === "external") && videoUrl ? (
                  <div className="aspect-video bg-black">
                    <video
                      ref={html5VideoRef}
                      src={videoUrl}
                      controls
                      className="w-full h-full"
                    />
                  </div>
                ) : null}
                {isPlayerReady && (
                  <div className="p-3 space-y-2 border-t bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span dir="ltr">{formatTimestamp(currentTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pendingSegmentStart === null ? (
                          <button
                            onClick={() => {
                              setPendingSegmentStart(currentTime);
                              setSegmentEndInput("");
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-400/30 text-xs font-bold hover:bg-orange-500/20 transition-colors"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            {isAr ? "قطع مقطع" : "Skip Segment"}
                          </button>
                        ) : null}
                        <Button
                          onClick={addQuestionAtCurrentTime}
                          className="gap-2 py-1.5 px-3 h-auto bg-red-500 hover:bg-red-600 text-white"
                        >
                          <Plus className="w-4 h-4" />
                          {isAr ? "سؤال عند هذا التوقيت" : "Question at this time"}
                        </Button>
                      </div>
                    </div>
                    {pendingSegmentStart !== null && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-500/10 border border-orange-400/30">
                        <SkipForward className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="text-xs font-bold text-orange-700 dark:text-orange-300 shrink-0">
                          {isAr ? "من:" : "From:"} <span dir="ltr">{formatTimestamp(pendingSegmentStart)}</span>
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">{isAr ? "إلى:" : "To:"}</span>
                        <Input
                          value={segmentEndInput}
                          onChange={(e) => setSegmentEndInput(e.target.value)}
                          placeholder="00:45"
                          dir="ltr"
                          className="w-20 text-center text-xs font-mono py-1 h-auto"
                        />
                        <button
                          onClick={() => {
                            setSegmentEndInput(formatTimestamp(currentTime));
                          }}
                          className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline shrink-0"
                        >
                          {isAr ? "الحالي" : "Current"}
                        </button>
                        <button
                          onClick={() => {
                            const end = parseTimestamp(segmentEndInput);
                            if (end === null || end <= pendingSegmentStart) {
                              toast.error(isAr ? "يجب أن يكون وقت النهاية بعد وقت البداية" : "End time must be after start time");
                              return;
                            }
                            const overlaps = skipSegments.some(
                              (s) => end > s.start && pendingSegmentStart < s.end
                            );
                            if (overlaps) {
                              toast.error(isAr ? "هذا المقطع يتداخل مع مقطع آخر" : "This segment overlaps with another");
                              return;
                            }
                            setSkipSegments((prev) =>
                              [...prev, { start: pendingSegmentStart, end }].sort((a, b) => a.start - b.start)
                            );
                            setPendingSegmentStart(null);
                            setSegmentEndInput("");
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          {isAr ? "إضافة" : "Add"}
                        </button>
                        <button
                          onClick={() => { setPendingSegmentStart(null); setSegmentEndInput(""); }}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {skipSegments.length > 0 && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <SkipForward className="w-4 h-4 text-orange-500" />
                  <h3 className="text-sm font-bold">
                    {isAr ? "مقاطع التخطي" : "Skip Segments"} ({skipSegments.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {skipSegments.map((seg, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-400/30"
                    >
                      <SkipForward className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="text-xs font-mono font-bold flex-1" dir="ltr">
                        {formatTimestamp(seg.start)} → {formatTimestamp(seg.end)}
                        <span className="mr-2 ml-2 text-muted-foreground font-normal">
                          ({seg.end - seg.start}s)
                        </span>
                      </span>
                      <button
                        onClick={() => setSkipSegments((prev) => prev.filter((_, j) => j !== i))}
                        className="p-1 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  {skipSegments.map((seg, i) => {
                    const scale = videoDuration > 0
                      ? videoDuration
                      : Math.max(...skipSegments.map((s) => s.end), 1);
                    return (
                      <div
                        key={i}
                        className="absolute top-0 h-full bg-orange-500/60 rounded"
                        style={{
                          left: `${(seg.start / scale) * 100}%`,
                          width: `${((seg.end - seg.start) / scale) * 100}%`,
                        }}
                      />
                    );
                  })}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-bold mb-2 block">{isAr ? "وضع الوصول" : "Access Mode"}</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAccessMode("public")}
                      className={`flex-1 p-2.5 rounded-xl border-2 text-center transition-all text-sm ${accessMode === "public" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      <Globe className="w-4 h-4 mx-auto mb-0.5" />
                      <p className="text-xs font-bold">{isAr ? "عام" : "Public"}</p>
                    </button>
                    <button
                      onClick={() => setAccessMode("private")}
                      className={`flex-1 p-2.5 rounded-xl border-2 text-center transition-all text-sm ${accessMode === "private" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      <Lock className="w-4 h-4 mx-auto mb-0.5" />
                      <p className="text-xs font-bold">{isAr ? "خاص بكود" : "Private"}</p>
                    </button>
                  </div>
                  {accessMode === "private" && (
                    <div className="mt-2">
                      <Input value={accessCode} onChange={(e) => setAccessCode(e.target.value)} dir="ltr" className="font-mono tracking-widest text-center" />
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-bold mb-2 block">{isAr ? "مشاركة مع المعلمين" : "Share with Teachers"}</Label>
                  <button
                    onClick={() => setIsShared(!isShared)}
                    className={`w-full p-2.5 rounded-xl border-2 text-center transition-all text-sm ${isShared ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400" : "border-border text-muted-foreground"}`}
                  >
                    <Share2 className="w-4 h-4 mx-auto mb-0.5" />
                    <p className="text-xs font-bold">{isShared ? (isAr ? "مشارك ✓" : "Shared ✓") : (isAr ? "خاص" : "Private")}</p>
                  </button>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Play className="w-5 h-5 text-red-500" />
                {isAr ? "الأسئلة التفاعلية" : "Interactive Questions"} ({questions.length})
              </h2>
              {!hasVideoPreview && (
                <Button onClick={() => {
                  setQuestions((prev) => {
                    const newQ: VideoQuestion = { timestampSeconds: 0, questionType: "mcq", text: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A", points: 1 };
                    const updated = [...prev, newQ];
                    setTimeout(() => setEditingIdx(updated.length - 1), 0);
                    return updated;
                  });
                }} className="gap-1 py-1.5 px-3 h-auto text-sm">
                  <Plus className="w-4 h-4" />
                  {isAr ? "إضافة سؤال" : "Add Question"}
                </Button>
              )}
            </div>

            {questions.length === 0 && (
              <Card className="p-8 text-center">
                <Play className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-bold text-sm">
                  {isAr
                    ? "لم تتم إضافة أسئلة بعد. شغّل الفيديو وأضف سؤالاً عند التوقيت المطلوب."
                    : "No questions yet. Play the video and add questions at desired timestamps."}
                </p>
              </Card>
            )}

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {questions.map((q, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card
                    className={`p-4 cursor-pointer transition-all ${editingIdx === idx ? "ring-2 ring-red-500/50 border-red-500/30" : "hover:border-primary/30"}`}
                    onClick={() => {
                      setEditingIdx(editingIdx === idx ? null : idx);
                      seekTo(q.timestampSeconds);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-black text-xs">{idx + 1}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); seekTo(q.timestampSeconds); }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs font-mono font-bold text-muted-foreground hover:text-foreground transition-colors"
                          dir="ltr"
                        >
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(q.timestampSeconds)}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground">
                          {q.points} {isAr ? "نقطة" : "pt"}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeQuestion(idx); }}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-sm font-bold truncate">
                      {q.text || (
                        <span className="text-muted-foreground italic">
                          {isAr ? "اضغط لكتابة السؤال..." : "Click to write question..."}
                        </span>
                      )}
                    </p>

                    <AnimatePresence>
                      {editingIdx === idx && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 space-y-3 overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-bold shrink-0">{isAr ? "التوقيت" : "Time"}</Label>
                            <Input
                              value={formatTimestamp(q.timestampSeconds)}
                              onChange={(e) => {
                                const parsed = parseTimestamp(e.target.value);
                                if (parsed !== null) updateQuestion(idx, "timestampSeconds", parsed);
                              }}
                              dir="ltr"
                              className="w-24 text-center font-mono text-sm"
                              placeholder="00:30"
                            />
                            {isPlayerReady && (
                              <button
                                onClick={() => updateQuestion(idx, "timestampSeconds", currentTime)}
                                className="text-xs font-bold text-red-500 hover:underline shrink-0"
                              >
                                {isAr ? "استخدم الحالي" : "Use current"}
                              </button>
                            )}
                          </div>

                          <div>
                            <Label className="text-xs font-bold">{isAr ? "نص السؤال" : "Question Text"} *</Label>
                            <Input
                              value={q.text}
                              onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                              placeholder={isAr ? "اكتب السؤال هنا..." : "Write the question..."}
                              className="mt-1 font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-bold shrink-0">{isAr ? "النوع" : "Type"}</Label>
                            <select
                              value={q.questionType}
                              onChange={(e) => handleQuestionTypeChange(idx, e.target.value as "mcq" | "true_false" | "fill_blank")}
                              className="flex-1 px-3 py-2 rounded-lg bg-background border border-input text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <option value="mcq">{isAr ? "اختيار من متعدد" : "MCQ"}</option>
                              <option value="true_false">{isAr ? "صح أو خطأ" : "True/False"}</option>
                              <option value="fill_blank">{isAr ? "أكمل الفراغ" : "Fill blank"}</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <Label className="text-xs font-bold shrink-0">{isAr ? "نقاط" : "Pts"}</Label>
                              <Input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={q.points}
                                onChange={(e) => updateQuestion(idx, "points", parseFloat(e.target.value) || 1)}
                                className="w-16 text-center text-sm"
                              />
                            </div>
                          </div>

                          {q.questionType === "mcq" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(["A", "B", "C", "D"] as const).map((opt) => (
                                <div key={opt} className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => updateQuestion(idx, "correctAnswer", opt)}
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border-2 transition-all ${
                                      q.correctAnswer === opt
                                        ? "bg-green-500 border-green-500 text-white"
                                        : "border-border text-muted-foreground hover:border-green-400"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                  <Input
                                    value={q[`option${opt}` as keyof VideoQuestion] as string || ""}
                                    onChange={(e) => updateQuestion(idx, `option${opt}` as keyof VideoQuestion, e.target.value)}
                                    placeholder={`${isAr ? "الخيار" : "Option"} ${opt}`}
                                    className="text-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {q.questionType === "true_false" && (
                            <div className="flex gap-3">
                              <button
                                onClick={() => updateQuestion(idx, "correctAnswer", "true")}
                                className={`flex-1 p-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                  q.correctAnswer === "true" ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-border text-muted-foreground"
                                }`}
                              >
                                <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
                                {isAr ? "صح" : "True"}
                              </button>
                              <button
                                onClick={() => updateQuestion(idx, "correctAnswer", "false")}
                                className={`flex-1 p-3 rounded-xl border-2 font-bold text-sm transition-all ${
                                  q.correctAnswer === "false" ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" : "border-border text-muted-foreground"
                                }`}
                              >
                                <X className="w-5 h-5 mx-auto mb-1" />
                                {isAr ? "خطأ" : "False"}
                              </button>
                            </div>
                          )}

                          {q.questionType === "fill_blank" && (
                            <div>
                              <Label className="text-xs font-bold">{isAr ? "الإجابة الصحيحة" : "Correct Answer"}</Label>
                              <Input
                                value={q.correctAnswer}
                                onChange={(e) => updateQuestion(idx, "correctAnswer", e.target.value)}
                                placeholder={isAr ? "اكتب الإجابة..." : "Type the answer..."}
                                className="mt-1 text-sm"
                              />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="pt-4 border-t border-border">
              <Button
                onClick={handleSave}
                disabled={saving || !title.trim() || !isVideoValid() || questions.length === 0}
                className="w-full gap-2 py-3 text-base font-black"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isAr ? "جاري الحفظ..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {editId ? (isAr ? "حفظ التعديلات" : "Save Changes") : (isAr ? "حفظ درس الفيديو" : "Save Video Lesson")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
