import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { useRefreshCreditsBalance } from "@/components/credits-chip";
import {
  deleteSavedGameActivity,
  createSavedGamePlayLink,
  revokeSavedGamePlayLink,
  listSavedGameActivities,
  savedGamePlayUrl,
  trackSavedGameEvent,
  type SavedGameActivity,
} from "@/lib/saved-game-activities";
import { copyGameShortUrl } from "@/lib/game-share-url";
import { EVENTS } from "@/lib/analytics";
import {
  creditAwareFetch,
  isInsufficientCreditsResponse,
} from "@/lib/credit-aware-fetch";
import {
  Library,
  Video,
  Upload,
  Link as LinkIcon,
  FolderPlus,
  Trash2,
  Pencil,
  Search,
  FileText,
  FileImage,
  FileArchive,
  Presentation,
  ExternalLink,
  Download,
  Move,
  Plus,
  Loader2,
  Sparkles,
  Wand2,
  Save,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  CheckSquare,
  Square,
  Ban,
  StopCircle,
  Folder,
  FilePlus,
  BookOpen,
  Play,
  Copy,
  Layers,
  ArrowRight,
  ArrowLeft,
  Camera,
  Gamepad2,
  MessageSquarePlus,
  Users,
  Unlink,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import PresentationsIndex from "@/pages/teacher/presentations/index";
import { XoName, XoTitle } from "@/components/game/xo-display";

interface LibraryGroup {
  id: number;
  name: string;
  parentGroupId: number | null;
  createdAt: string;
  fileCount: number;
  childCount: number;
}

interface LibraryFile {
  id: number;
  groupId: number | null;
  name: string;
  fileType: string;
  sizeBytes: number;
  source: "upload" | "link";
  objectPath: string | null;
  externalUrl: string | null;
  description: string | null;
  createdAt: string;
}

type UploadStatus = "pending" | "uploading" | "success" | "error" | "cancelled";

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
}

interface UsageInfo {
  usedBytes: number;
  quotaBytes: number | null;
  unlimited: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

const ALLOWED_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.zip";

interface InteractiveVideoLesson {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  videoType: string;
  targetClass: string | null;
  createdAt: string;
  questionCount: number;
  submissionCount: number;
}

function InteractiveVideoLessonsList({
  isAr,
  setLocation,
}: {
  isAr: boolean;
  setLocation: (path: string) => void;
}) {
  const [lessons, setLessons] = useState<InteractiveVideoLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/video-lessons`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: InteractiveVideoLesson[]) => {
        if (!cancelled) setLessons(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setLessons([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black">
              {isAr ? "فيديوهاتي التفاعلية" : "My interactive videos"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "كل دروس الفيديو التي أضفتها إلى حسابك"
                : "All interactive video lessons you created"}
            </p>
          </div>
        </div>
        <Button onClick={() => setLocation("/teacher/video-lesson/new")} className="gap-1.5">
          <Plus className="w-4 h-4" />
          {isAr ? "فيديو تفاعلي جديد" : "New interactive video"}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-2xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <Video className="w-10 h-10 mx-auto mb-3 text-rose-400/70" />
          <h3 className="font-bold">
            {isAr ? "لا توجد فيديوهات تفاعلية بعد" : "No interactive videos yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {isAr
              ? "أنشئ فيديو يحتوي على أسئلة تظهر للطالب أثناء المشاهدة"
              : "Create a video with questions that appear while students watch"}
          </p>
          <Button variant="outline" onClick={() => setLocation("/teacher/video-lesson/new")}>
            <Plus className="w-4 h-4 me-1.5" />
            {isAr ? "إنشاء أول فيديو" : "Create your first video"}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lessons.map((lesson) => (
            <button
              key={lesson.id}
              type="button"
              onClick={() => setLocation(`/teacher/video-lesson/${lesson.id}`)}
              className="text-start rounded-2xl border border-border/60 bg-card p-4 hover:border-rose-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black truncate">{lesson.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {lesson.subject || lesson.targetClass || (isAr ? "فيديو تفاعلي" : "Interactive video")}
                  </p>
                </div>
                <ArrowLeft className={`w-4 h-4 mt-1 text-muted-foreground group-hover:text-rose-600 ${isAr ? "" : "rotate-180"}`} />
              </div>
              <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  {lesson.questionCount} {isAr ? "أسئلة" : "questions"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {lesson.submissionCount} {isAr ? "إجابات" : "responses"}
                </span>
                <span className="ms-auto">
                  {new Date(lesson.createdAt).toLocaleDateString(isAr ? "ar" : "en", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fileIcon(fileType: string, name: string) {
  const lower = (name || "").toLowerCase();
  if (fileType.startsWith("image/")) return <FileImage className="w-5 h-5 text-pink-500" />;
  if (fileType.includes("pdf") || lower.endsWith(".pdf"))
    return <FileText className="w-5 h-5 text-red-500" />;
  if (fileType.includes("presentation") || lower.endsWith(".ppt") || lower.endsWith(".pptx"))
    return <Presentation className="w-5 h-5 text-orange-500" />;
  if (fileType.includes("word") || lower.endsWith(".doc") || lower.endsWith(".docx"))
    return <FileText className="w-5 h-5 text-blue-500" />;
  if (fileType.includes("zip") || lower.endsWith(".zip"))
    return <FileArchive className="w-5 h-5 text-amber-600" />;
  if (fileType === "link") return <LinkIcon className="w-5 h-5 text-violet-500" />;
  return <FileText className="w-5 h-5 text-muted-foreground" />;
}

export default function TeacherLibraryPage() {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const refreshCreditsBalance = useRefreshCreditsBalance();

  const [groups, setGroups] = useState<LibraryGroup[]>([]);
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>("root"); // "root" | "all" | "none" | groupId-as-string
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupParentId, setNewGroupParentId] = useState<number | null>(null);
  const [renameTarget, setRenameTarget] = useState<LibraryGroup | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [showAddFile, setShowAddFile] = useState(false);
  const [addFileTab, setAddFileTab] = useState<"upload" | "link">("upload");
  const handleAddFileTabChange = (v: string) => {
    if (v === "upload" || v === "link") setAddFileTab(v);
  };
  const [uploadGroupId, setUploadGroupId] = useState<string>("none");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const currentXhrRef = useRef<XMLHttpRequest | null>(null);
  const currentAbortRef = useRef<AbortController | null>(null);
  const currentUploadIdRef = useRef<string | null>(null);
  const cancelledIdsRef = useRef<Set<string>>(new Set());
  const stopRequestedRef = useRef(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [moveTarget, setMoveTarget] = useState<LibraryFile | null>(null);
  const [moveGroupId, setMoveGroupId] = useState<string>("none");
  const [deleteTarget, setDeleteTarget] = useState<LibraryFile | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<LibraryGroup | null>(null);

  // ── AI extraction state ──
  type ExtractedQuestionType = "mcq" | "true_false" | "fill_blank";
  type ExtractedQuestion = {
    questionType?: ExtractedQuestionType;
    text: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    points: number;
    sourceFileName?: string;
  };
  const [extractTarget, setExtractTarget] = useState<LibraryFile | null>(null);
  const [extractBulkTargets, setExtractBulkTargets] = useState<LibraryFile[] | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [extractCount, setExtractCount] = useState<number>(10);
  const [extractDifficulty, setExtractDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [extractSubject, setExtractSubject] = useState<string>("");
  const [extractQuestionType, setExtractQuestionType] = useState<ExtractedQuestionType>("mcq");
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[] | null>(null);
  const [extractExpanded, setExtractExpanded] = useState<Set<number>>(new Set());
  const [savingBank, setSavingBank] = useState(false);
  const [, setLocation] = useLocation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const T = useMemo(
    () => ({
      title: isAr ? "مكتبتي" : "My Library",
      subtitle: isAr
        ? "مكان واحد مرتب لكل ملفاتك ودروسك وألعابك"
        : "One organized place for your files, lessons, and games",
      addFile: isAr ? "إضافة ملف" : "Add file",
      addGroup: isAr ? "مجلد جديد" : "New folder",
      root: isAr ? "الجذر" : "Root",
      all: isAr ? "كل الملفات" : "All files",
      none: isAr ? "بدون مجموعة" : "Ungrouped",
      folders: isAr ? "المجلدات" : "Folders",
      openFolder: isAr ? "فتح المجلد" : "Open folder",
      filesCount: (n: number) => (isAr ? `${n} ملف` : `${n} file${n === 1 ? "" : "s"}`),
      subfoldersCount: (n: number) => (isAr ? `${n} مجلد فرعي` : `${n} subfolder${n === 1 ? "" : "s"}`),
      search: isAr ? "بحث في الملفات..." : "Search files...",
      empty: isAr ? "لا توجد ملفات بعد" : "No files yet",
      uploadTab: isAr ? "رفع من الجهاز" : "Upload from device",
      linkTab: isAr ? "إضافة رابط" : "Add link",
      group: isAr ? "المجلد" : "Folder",
      description: isAr ? "وصف (اختياري)" : "Description (optional)",
      cancel: isAr ? "إلغاء" : "Cancel",
      save: isAr ? "حفظ" : "Save",
      add: isAr ? "إضافة" : "Add",
      preview: isAr ? "معاينة" : "Preview",
      download: isAr ? "تحميل" : "Download",
      move: isAr ? "نقل" : "Move",
      delete: isAr ? "حذف" : "Delete",
      rename: isAr ? "إعادة تسمية" : "Rename",
      groupName: isAr ? "اسم المجلد" : "Folder name",
      fileName: isAr ? "اسم الملف" : "File name",
      url: isAr ? "الرابط" : "URL",
      uploadingFile: isAr ? "جاري الرفع..." : "Uploading...",
      usage: (used: string, total: string) =>
        isAr ? `تم استخدام ${used} من ${total}` : `Used ${used} of ${total}`,
      unlimited: isAr ? "تخزين غير محدود" : "Unlimited storage",
      confirmDeleteFile: isAr ? "حذف هذا الملف نهائياً؟" : "Permanently delete this file?",
      confirmDeleteGroup: isAr
        ? "حذف المجلد؟ ستبقى الملفات، وسيتم حذف المجلدات الفرعية"
        : "Delete this folder? Files will remain ungrouped and subfolders will be removed",
      moveToGroup: isAr ? "نقل إلى مجموعة" : "Move to group",
      browse: isAr ? "اختر ملفات" : "Choose files",
      maxSize: isAr ? "الحد الأقصى 500 ميغابايت لكل ملف" : "Max 500 MB per file",
      allowedTypes: isAr ? "PDF, DOCX, PPTX, PNG, JPG, ZIP" : "PDF, DOCX, PPTX, PNG, JPG, ZIP",
      extract: isAr ? "استخراج أسئلة" : "Extract questions",
      extractTitle: isAr ? "استخراج أسئلة من الملف" : "Extract questions from file",
      extractSubtitle: isAr
        ? "سيقوم الذكاء الاصطناعي بقراءة الملف وتوليد أسئلة اختيار من متعدد"
        : "AI will read the file and generate multiple choice questions",
      countLabel: isAr ? "عدد الأسئلة" : "Number of questions",
      difficultyLabel: isAr ? "الصعوبة" : "Difficulty",
      questionTypeLabel: isAr ? "نوع السؤال" : "Question type",
      typeMcq: isAr ? "اختيار من متعدد" : "Multiple choice",
      typeTrueFalse: isAr ? "صح / خطأ" : "True / False",
      typeFillBlank: isAr ? "إكمال الفراغ" : "Fill in the blank",
      trueLabel: isAr ? "صح" : "True",
      falseLabel: isAr ? "خطأ" : "False",
      answerLabel: isAr ? "الإجابة:" : "Answer:",
      easy: isAr ? "سهل" : "Easy",
      medium: isAr ? "متوسط" : "Medium",
      hard: isAr ? "صعب" : "Hard",
      subjectLabel: isAr ? "المادة (اختياري)" : "Subject (optional)",
      subjectPlaceholder: isAr ? "مثال: علوم، رياضيات..." : "e.g. Science, Math...",
      generate: isAr ? "توليد الأسئلة" : "Generate questions",
      generating: isAr ? "جاري الاستخراج..." : "Extracting...",
      previewTitle: (n: number) => (isAr ? `تم توليد ${n} سؤال` : `${n} questions generated`),
      saveToBank: isAr ? "حفظ في بنك الأسئلة" : "Save to question bank",
      createAssignment: isAr ? "إنشاء واجب جديد" : "Create new assignment",
      regenerate: isAr ? "إعادة التوليد" : "Regenerate",
      saving: isAr ? "جاري الحفظ..." : "Saving...",
      savedToBank: (n: number) => (isAr ? `تم حفظ ${n} سؤال في بنك الأسئلة` : `Saved ${n} questions to bank`),
      extractError: isAr ? "تعذر استخراج الأسئلة" : "Failed to extract questions",
      correctLabel: isAr ? "الإجابة الصحيحة:" : "Correct:",
      dropHint: isAr ? "اسحب الملفات إلى هنا أو" : "Drag files here or",
      uploadAll: (n: number) => (isAr ? `رفع ${n} ملفاً` : `Upload ${n} file${n === 1 ? "" : "s"}`),
      uploadingN: (done: number, total: number) =>
        isAr ? `جاري الرفع ${done}/${total}` : `Uploading ${done}/${total}`,
      pendingFiles: isAr ? "في الانتظار" : "Pending",
      doneFiles: isAr ? "تم" : "Done",
      failedFiles: isAr ? "فشل" : "Failed",
      retry: isAr ? "إعادة المحاولة" : "Retry",
      remove: isAr ? "إزالة" : "Remove",
      tooLarge: isAr ? "يتجاوز 500 ميغابايت" : "Exceeds 500 MB",
      notAllowed: isAr ? "نوع غير مسموح" : "Type not allowed",
      tooLargeRule: isAr
        ? "الحد الأقصى لكل ملف هو 500 ميغابايت."
        : "Each file must be 500 MB or smaller.",
      notAllowedRule: isAr
        ? "الأنواع المسموح بها فقط: PDF، DOC، DOCX، PPT، PPTX، PNG، JPG/JPEG، ZIP."
        : "Only these types are allowed: PDF, DOC, DOCX, PPT, PPTX, PNG, JPG/JPEG, ZIP.",
      whyRejected: isAr ? "لماذا؟" : "Why?",
      skippedToast: (total: number, badType: number, tooBig: number) => {
        if (isAr) {
          const fileWord = total === 1 ? "ملف" : "ملفات";
          const reasons: string[] = [];
          if (badType > 0) reasons.push(`${badType} نوع غير مدعوم`);
          if (tooBig > 0) reasons.push(`${tooBig} يتجاوز ٥٠٠ ميغابايت`);
          return `تم تخطي ${total} ${fileWord} (${reasons.join("، ")}). يُسمح فقط بـ PDF و DOC/DOCX و PPT/PPTX و PNG و JPG/JPEG و ZIP حتى 500 ميغابايت.`;
        }
        const reasons: string[] = [];
        if (badType > 0) reasons.push(`${badType} wrong type`);
        if (tooBig > 0) reasons.push(`${tooBig} too large`);
        return `Skipped ${total} file${total === 1 ? "" : "s"} (${reasons.join(", ")}). Only PDF, DOC/DOCX, PPT/PPTX, PNG, JPG/JPEG and ZIP up to 500 MB are accepted.`;
      },
      quotaExceededTotal: isAr
        ? "إجمالي حجم الملفات يتجاوز الحصة المتبقية"
        : "Total size exceeds your remaining quota",
      duplicateInQueue: isAr ? "موجود في القائمة" : "Already in queue",
      close: isAr ? "إغلاق" : "Close",
      finishedSummary: (ok: number, fail: number, cancelled: number = 0) =>
        isAr
          ? `تم رفع ${ok} ملفاً${fail > 0 ? ` · فشل ${fail}` : ""}${cancelled > 0 ? ` · أُلغي ${cancelled}` : ""}`
          : `Uploaded ${ok} file${ok === 1 ? "" : "s"}${fail > 0 ? ` · ${fail} failed` : ""}${cancelled > 0 ? ` · ${cancelled} cancelled` : ""}`,
      abort: isAr ? "إلغاء الرفع" : "Abort",
      stopAll: isAr ? "إيقاف الرفع" : "Stop",
      cancelled: isAr ? "أُلغي" : "Cancelled",
      stopping: isAr ? "جاري الإيقاف..." : "Stopping...",
      questionTextLabel: isAr ? "نص السؤال" : "Question text",
      optionLabel: (l: string) => (isAr ? `الخيار ${l}` : `Option ${l}`),
      markCorrect: isAr ? "تعيين كإجابة صحيحة" : "Mark as correct",
      correctBadge: isAr ? "صحيحة" : "Correct",
      emptyQuestion: isAr ? "نص السؤال مطلوب" : "Question text required",
      deleteQuestion: isAr ? "حذف السؤال" : "Delete question",
      addQuestion: isAr ? "إضافة سؤال" : "Add question",
      selectMode: isAr ? "تحديد متعدد" : "Multi-select",
      exitSelect: isAr ? "إنهاء التحديد" : "Exit selection",
      selectedCount: (n: number) => (isAr ? `تم تحديد ${n}` : `${n} selected`),
      bulkExtract: isAr ? "استخراج من الملفات المختارة" : "Extract from selected",
      selectAtLeastTwo: isAr
        ? "اختر ملفين قابلين للاستخراج على الأقل"
        : "Select at least two extractable files",
      bulkExtractTitle: isAr
        ? "استخراج أسئلة من عدة ملفات"
        : "Extract questions from multiple files",
      bulkExtractSubtitle: isAr
        ? "سيتم دمج محتوى الملفات وإرسالها للذكاء الاصطناعي في طلب واحد"
        : "Files will be combined and sent to the AI in one request",
      filesIncluded: (n: number) =>
        isAr ? `${n} ملفات مدمجة` : `${n} files combined`,
      skippedFiles: isAr ? "تعذرت قراءة:" : "Skipped:",
      sourceFileBadge: (name: string) => (isAr ? `من: ${name}` : `from: ${name}`),
    }),
    [isAr],
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [u, g] = await Promise.all([
        fetch("/api/library/usage", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/library/groups", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setUsage(u);
      setGroups(Array.isArray(g) ? g : []);
    } catch {
      toast.error(isAr ? "تعذر تحميل المكتبة" : "Failed to load library");
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles() {
    try {
      const params = new URLSearchParams();
      params.set("groupId", activeGroup === "root" ? "root" : activeGroup);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/library/files?${params}`, { cache: "no-store" });
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch {
      toast.error(isAr ? "تعذر تحميل الملفات" : "Failed to load files");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadFiles, 200);
    return () => clearTimeout(t);
  }, [activeGroup, search]);

  async function handleCreateGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/library/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentGroupId: newGroupParentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "خطأ");
      }
      setNewGroupName("");
      setShowAddGroup(false);
      toast.success(isAr ? "تم إنشاء المجلد" : "Folder created");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message || (isAr ? "تعذر إنشاء المجموعة" : "Failed to create group"));
    }
  }

  async function handleRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/library/groups/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "خطأ");
      }
      setRenameTarget(null);
      toast.success(isAr ? "تم التحديث" : "Updated");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message || (isAr ? "تعذر التحديث" : "Update failed"));
    }
  }

  async function handleDeleteGroup() {
    if (!deleteGroupTarget) return;
    try {
      const res = await fetch(`/api/library/groups/${deleteGroupTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (activeGroup === String(deleteGroupTarget.id)) setActiveGroup("all");
      setDeleteGroupTarget(null);
      toast.success(isAr ? "تم الحذف" : "Deleted");
      await loadAll();
      await loadFiles();
    } catch {
      toast.error(isAr ? "تعذر الحذف" : "Delete failed");
    }
  }

  function isAcceptedFile(file: File): boolean {
    const lower = file.name.toLowerCase();
    const exts = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".zip"];
    return exts.some((e) => lower.endsWith(e));
  }

  function addFilesToQueue(picked: File[]) {
    if (!picked.length) return;
    let badType = 0;
    let tooBig = 0;
    const accepted: File[] = [];
    for (const file of picked) {
      if (!isAcceptedFile(file)) {
        badType += 1;
        continue;
      }
      if (file.size > 500 * 1024 * 1024) {
        tooBig += 1;
        continue;
      }
      accepted.push(file);
    }
    if (badType + tooBig > 0) {
      toast.warning(T.skippedToast(badType + tooBig, badType, tooBig));
    }
    if (!accepted.length) return;
    setUploadQueue((prev) => {
      const next = [...prev];
      for (const file of accepted) {
        const dup = next.some(
          (q) => q.file.name === file.name && q.file.size === file.size,
        );
        if (dup) continue;
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          status: "pending",
          progress: 0,
        });
      }
      return next;
    });
  }

  function removeFromQueue(id: string) {
    if (isUploading) return;
    setUploadQueue((prev) => prev.filter((q) => q.id !== id || q.status === "uploading"));
  }

  function resetQueueItem(id: string) {
    setUploadQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "pending", progress: 0, error: undefined } : q)),
    );
  }

  function cancelCurrentUpload(id: string) {
    cancelledIdsRef.current.add(id);
    if (currentUploadIdRef.current === id) {
      try {
        currentXhrRef.current?.abort();
      } catch {}
      try {
        currentAbortRef.current?.abort();
      } catch {}
    } else {
      // Item is still pending — mark it as cancelled so the loop skips it
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === id && q.status === "pending"
            ? { ...q, status: "cancelled", progress: 0, error: undefined }
            : q,
        ),
      );
    }
  }

  function stopAllUploads() {
    stopRequestedRef.current = true;
    setStopRequested(true);
    try {
      currentXhrRef.current?.abort();
    } catch {}
    try {
      currentAbortRef.current?.abort();
    } catch {}
    // Mark all still-pending items as cancelled
    setUploadQueue((prev) =>
      prev.map((q) =>
        q.status === "pending"
          ? { ...q, status: "cancelled", progress: 0, error: undefined }
          : q,
      ),
    );
  }

  async function uploadOneItem(item: UploadItem): Promise<"success" | "error" | "cancelled"> {
    const file = item.file;
    const abortCtrl = new AbortController();
    currentAbortRef.current = abortCtrl;
    currentUploadIdRef.current = item.id;
    const isCancelled = () =>
      cancelledIdsRef.current.has(item.id) || stopRequestedRef.current;

    setUploadQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: "uploading", progress: 0, error: undefined } : q)),
    );
    try {
      if (isCancelled()) throw new Error("__cancelled__");
      const reqRes = await fetch("/api/library/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
        signal: abortCtrl.signal,
      });
      if (!reqRes.ok) {
        const err = await reqRes.json().catch(() => ({}));
        throw new Error(err.message || (isAr ? "تعذر إعداد الرفع" : "Failed to prepare upload"));
      }
      const { uploadURL, objectPath } = await reqRes.json();
      if (isCancelled()) throw new Error("__cancelled__");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        currentXhrRef.current = xhr;
        xhr.open("PUT", uploadURL);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, progress: pct } : q)),
            );
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed"));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.onabort = () => reject(new Error("__cancelled__"));
        xhr.send(file);
      });

      if (isCancelled()) throw new Error("__cancelled__");

      const finalizeRes = await fetch("/api/library/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          fileType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          objectPath,
          groupId: uploadGroupId === "none" ? null : parseInt(uploadGroupId),
          description: uploadDescription.trim() || null,
        }),
        signal: abortCtrl.signal,
      });
      if (!finalizeRes.ok) {
        const err = await finalizeRes.json().catch(() => ({}));
        throw new Error(err.message || (isAr ? "فشل الرفع" : "Upload failed"));
      }
      setUploadQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "success", progress: 100 } : q)),
      );
      return "success";
    } catch (e: any) {
      if (e?.message === "__cancelled__" || e?.name === "AbortError" || isCancelled()) {
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "cancelled", progress: 0, error: undefined }
              : q,
          ),
        );
        return "cancelled";
      }
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: "error", error: e?.message || (isAr ? "فشل الرفع" : "Upload failed") }
            : q,
        ),
      );
      return "error";
    } finally {
      if (currentUploadIdRef.current === item.id) {
        currentUploadIdRef.current = null;
        currentXhrRef.current = null;
        currentAbortRef.current = null;
      }
    }
  }

  async function handleStartUploads() {
    const pending = uploadQueue.filter((q) => q.status === "pending");
    if (!pending.length) return;
    if (usage && !usage.unlimited && usage.quotaBytes != null) {
      const totalSize = pending.reduce((s, q) => s + q.file.size, 0);
      if (usage.usedBytes + totalSize > usage.quotaBytes) {
        toast.error(T.quotaExceededTotal);
        return;
      }
    }
    stopRequestedRef.current = false;
    setStopRequested(false);
    cancelledIdsRef.current = new Set();
    setIsUploading(true);
    let ok = 0;
    let fail = 0;
    let cancelled = 0;
    for (const item of pending) {
      if (stopRequestedRef.current || cancelledIdsRef.current.has(item.id)) {
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id && (q.status === "pending" || q.status === "uploading")
              ? { ...q, status: "cancelled", progress: 0, error: undefined }
              : q,
          ),
        );
        cancelled++;
        continue;
      }
      const result = await uploadOneItem(item);
      if (result === "success") ok++;
      else if (result === "cancelled") cancelled++;
      else fail++;
    }
    setIsUploading(false);
    stopRequestedRef.current = false;
    setStopRequested(false);
    cancelledIdsRef.current = new Set();
    if (ok > 0) toast.success(T.finishedSummary(ok, fail, cancelled));
    else if (fail > 0) toast.error(T.finishedSummary(ok, fail, cancelled));
    else if (cancelled > 0) toast(T.finishedSummary(ok, fail, cancelled));
    await loadAll();
    await loadFiles();
  }

  async function handleAddLink() {
    const name = linkName.trim();
    const url = linkUrl.trim();
    if (!name || !url) {
      toast.error(isAr ? "الاسم والرابط مطلوبان" : "Name and URL required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/library/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          externalUrl: url,
          fileType: "link",
          groupId: uploadGroupId === "none" ? null : parseInt(uploadGroupId),
          description: linkDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "خطأ");
      }
      toast.success(isAr ? "تمت الإضافة" : "Link added");
      setLinkName("");
      setLinkUrl("");
      setLinkDescription("");
      setShowAddFile(false);
      await loadFiles();
    } catch (e: any) {
      toast.error(e.message || (isAr ? "تعذرت الإضافة" : "Failed to add"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMove() {
    if (!moveTarget) return;
    try {
      const res = await fetch(`/api/library/files/${moveTarget.id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: moveGroupId === "none" ? null : parseInt(moveGroupId) }),
      });
      if (!res.ok) throw new Error();
      setMoveTarget(null);
      toast.success(isAr ? "تم النقل" : "Moved");
      await loadAll();
      await loadFiles();
    } catch {
      toast.error(isAr ? "تعذر النقل" : "Move failed");
    }
  }

  async function handleDeleteFile() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/library/files/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteTarget(null);
      toast.success(isAr ? "تم الحذف" : "Deleted");
      await loadAll();
      await loadFiles();
    } catch {
      toast.error(isAr ? "تعذر الحذف" : "Delete failed");
    }
  }

  function isExtractable(f: LibraryFile): boolean {
    if (f.source !== "upload") return false;
    const lower = (f.name || "").toLowerCase();
    return (
      f.fileType.includes("pdf") ||
      f.fileType.includes("wordprocessingml") ||
      f.fileType.includes("presentationml") ||
      lower.endsWith(".pdf") ||
      lower.endsWith(".docx") ||
      lower.endsWith(".pptx")
    );
  }

  function openExtractDialog(f: LibraryFile) {
    setExtractTarget(f);
    setExtractBulkTargets(null);
    setExtractedQuestions(null);
    setExtractExpanded(new Set());
    setExtractCount(10);
    setExtractDifficulty("medium");
    setExtractSubject("");
    setExtractQuestionType("mcq");
  }

  function openBulkExtractDialog() {
    const selected = files.filter((f) => selectedFileIds.has(f.id) && isExtractable(f));
    if (selected.length < 2) {
      toast.error(T.selectAtLeastTwo);
      return;
    }
    setExtractTarget(null);
    setExtractBulkTargets(selected);
    setExtractedQuestions(null);
    setExtractExpanded(new Set());
    setExtractCount(10);
    setExtractDifficulty("medium");
    setExtractSubject("");
  }

  function toggleFileSelection(fileId: number) {
    const next = new Set(selectedFileIds);
    if (next.has(fileId)) next.delete(fileId);
    else next.add(fileId);
    setSelectedFileIds(next);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedFileIds(new Set());
  }

  async function handleExtractGenerate() {
    if (!extractTarget && (!extractBulkTargets || extractBulkTargets.length < 2)) return;
    setExtractLoading(true);
    try {
      const url = extractBulkTargets
        ? `/api/library/files/extract-questions-bulk`
        : `/api/library/files/${extractTarget!.id}/extract-questions`;
      const body: any = {
        count: extractCount,
        difficulty: extractDifficulty,
        subject: extractSubject.trim() || undefined,
        language: lang,
      };
      if (extractBulkTargets) {
        body.fileIds = extractBulkTargets.map((f) => f.id);
      }
      const res = await creditAwareFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, questionType: extractQuestionType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (isInsufficientCreditsResponse(res)) return;
        throw new Error(err.message || T.extractError);
      }
      const data = await res.json();
      const qs: ExtractedQuestion[] = Array.isArray(data.questions) ? data.questions : [];
      if (qs.length === 0) throw new Error(T.extractError);
      if (qs.length < extractCount) {
        toast.warning(
          isAr
            ? `تم استخراج ${qs.length} من أصل ${extractCount} سؤالاً — المحتوى لم يكفِ للعدد المطلوب.`
            : `Extracted ${qs.length} of ${extractCount} requested questions — the content wasn't enough for more.`
        );
      }
      setExtractedQuestions(qs);
      setExtractExpanded(new Set([0]));
    } catch (e: any) {
      toast.error(e.message || T.extractError);
    } finally {
      setExtractLoading(false);
      refreshCreditsBalance();
    }
  }

  function updateExtractedQuestion(index: number, patch: Partial<ExtractedQuestion>) {
    setExtractedQuestions((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function deleteExtractedQuestion(index: number) {
    setExtractedQuestions((prev) => {
      if (!prev) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setExtractExpanded((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  }

  function addBlankExtractedQuestion() {
    setExtractedQuestions((prev) => {
      const list = prev ? [...prev] : [];
      const newIndex = list.length;
      list.push({
        text: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: "A",
        points: 1,
      });
      setExtractExpanded((s) => new Set(s).add(newIndex));
      return list;
    });
  }

  function validateExtractedQuestions(): boolean {
    if (!extractedQuestions || extractedQuestions.length === 0) return false;
    for (let i = 0; i < extractedQuestions.length; i++) {
      const q = extractedQuestions[i];
      if (!q.text.trim()) {
        toast.error(`${isAr ? "سؤال" : "Question"} ${i + 1}: ${T.emptyQuestion}`);
        setExtractExpanded((s) => new Set(s).add(i));
        return false;
      }
      const correctOpt = q[`option${q.correctAnswer}` as keyof ExtractedQuestion] as string | undefined;
      if (!correctOpt || !String(correctOpt).trim()) {
        toast.error(
          `${isAr ? "سؤال" : "Question"} ${i + 1}: ${
            isAr ? "الخيار الصحيح فارغ" : "Correct option is empty"
          }`,
        );
        setExtractExpanded((s) => new Set(s).add(i));
        return false;
      }
    }
    return true;
  }

  async function handleSaveToBank() {
    if (!extractedQuestions || extractedQuestions.length === 0) return;
    if (!validateExtractedQuestions()) return;
    setSavingBank(true);
    try {
      const fallbackSubject =
        extractTarget?.name ||
        (extractBulkTargets && extractBulkTargets.length > 0
          ? extractBulkTargets.map((f) => f.name).join(" + ")
          : "");
      const payload = extractedQuestions.map((q) => ({
        subject: extractSubject.trim() || fallbackSubject,
        questionType: q.questionType || extractQuestionType,
        text: q.text.trim(),
        optionA: q.optionA ? q.optionA.trim() : null,
        optionB: q.optionB ? q.optionB.trim() : null,
        optionC: q.optionC ? q.optionC.trim() : null,
        optionD: q.optionD ? q.optionD.trim() : null,
        correctAnswer: q.correctAnswer,
        points: q.points || 1,
      }));
      const res = await fetch(`/api/question-bank/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || (isAr ? "تعذر الحفظ" : "Save failed"));
      }
      const saved = await res.json();
      toast.success(T.savedToBank(Array.isArray(saved) ? saved.length : extractedQuestions.length));
      setExtractTarget(null);
      setExtractBulkTargets(null);
      setExtractedQuestions(null);
      exitSelectionMode();
    } catch (e: any) {
      toast.error(e.message || (isAr ? "تعذر الحفظ" : "Save failed"));
    } finally {
      setSavingBank(false);
    }
  }

  function handleCreateAssignmentFromExtracted() {
    if (!extractedQuestions || extractedQuestions.length === 0) return;
    if (!validateExtractedQuestions()) return;
    const sourceName = extractTarget?.name || (extractBulkTargets ? extractBulkTargets.map((f) => f.name).join(" + ") : "");
    try {
      sessionStorage.setItem(
        "librarySeedQuestions",
        JSON.stringify({
          questions: extractedQuestions.map((q) => ({
            ...q,
            questionType: q.questionType || extractQuestionType,
          })),
          subject: extractSubject.trim(),
          sourceFileName: sourceName,
          sourceFileNames: extractBulkTargets ? extractBulkTargets.map((f) => f.name) : undefined,
          questionType: extractQuestionType,
          ts: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
    setExtractTarget(null);
    setExtractBulkTargets(null);
    setExtractedQuestions(null);
    exitSelectionMode();
    setLocation("/teacher/new");
  }

  async function handleDownload(file: LibraryFile, openInTab: boolean) {
    try {
      const res = await fetch(`/api/library/files/${file.id}/download-url`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      if (openInTab) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      toast.error(isAr ? "تعذر فتح الملف" : "Could not open file");
    }
  }

  const usagePct = usage && usage.quotaBytes ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100) : 0;
  const activeGroupId =
    activeGroup !== "root" && activeGroup !== "all" && activeGroup !== "none"
      ? Number(activeGroup)
      : null;
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const activeFolder = activeGroupId ? groupById.get(activeGroupId) : null;
  const folderPath: LibraryGroup[] = [];
  let pathFolder = activeFolder;
  while (pathFolder) {
    folderPath.unshift(pathFolder);
    pathFolder = pathFolder.parentGroupId ? groupById.get(pathFolder.parentGroupId) : undefined;
  }

  const openNewFolder = (parentGroupId: number | null = activeGroupId) => {
    setNewGroupParentId(parentGroupId);
    setNewGroupName("");
    setShowAddGroup(true);
  };

  const visibleFolders =
    activeGroup === "all" || activeGroup === "none"
      ? []
      : groups.filter((folder) => folder.parentGroupId === activeGroupId);

  const renderFolder = (folder: LibraryGroup, depth = 0): ReactNode => {
    const childFolders = groups.filter((child) => child.parentGroupId === folder.id);
    const hasChildren = childFolders.length > 0;
    const isExpanded = expandedGroupIds.has(folder.id);

    return (
      <div key={folder.id}>
        <div
          className={`group flex items-center gap-1 rounded-xl ${
            activeGroup === String(folder.id) ? "bg-violet-500/15" : ""
          }`}
          style={{ marginInlineStart: depth * 12 }}
        >
          <button
            onClick={() => {
              setActiveGroup(String(folder.id));
              if (hasChildren) {
                setExpandedGroupIds((previous) => {
                  const next = new Set(previous);
                  if (next.has(folder.id)) next.delete(folder.id);
                  else next.add(folder.id);
                  return next;
                });
              }
            }}
            className={`flex-1 min-w-0 text-start px-3 py-2.5 text-sm font-semibold ${
              activeGroup === String(folder.id) ? "text-violet-700" : "hover:bg-muted rounded-xl"
            }`}
            data-testid={`group-${folder.id}`}
          >
            <span className="flex min-w-0 items-start gap-2">
              {hasChildren ? (
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform ${
                    isExpanded ? "" : "-rotate-90"
                  }`}
                />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <Folder className="w-4 h-4 shrink-0 text-violet-500" />
              <span className="min-w-0 truncate">{folder.name}</span>
              <span className="text-[11px] text-muted-foreground">({folder.fileCount})</span>
            </span>
          </button>
          <button
            onClick={() => openNewFolder(folder.id)}
            className="opacity-0 group-hover:opacity-100 transition p-1 text-muted-foreground hover:text-violet-600"
            title={isAr ? "مجلد فرعي" : "Subfolder"}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setRenameTarget(folder);
              setRenameValue(folder.name);
            }}
            className="opacity-0 group-hover:opacity-100 transition p-1 text-muted-foreground hover:text-foreground"
            title={T.rename}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteGroupTarget(folder)}
            className="opacity-0 group-hover:opacity-100 transition p-1 text-muted-foreground hover:text-red-600 me-1"
            title={T.delete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {isExpanded &&
          childFolders.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-5" dir={isAr ? "rtl" : "ltr"}>
        <div className="relative overflow-hidden rounded-[28px] border border-violet-200/60 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 sm:p-6 shadow-sm">
          <div className="pointer-events-none absolute -top-20 -end-12 h-48 w-48 rounded-full bg-violet-200/35 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setLocation("/teacher")}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card hover:bg-muted transition-colors shrink-0"
              aria-label={isAr ? "رجوع" : "Back"}
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
            <div className="p-3 bg-violet-600 rounded-2xl shadow-lg shadow-violet-600/20">
              <Library className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{T.title}</h1>
              <p className="text-sm text-muted-foreground">{T.subtitle}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap" dir={isAr ? "ltr" : "rtl"}>
            <Button
              variant={selectionMode ? "default" : "outline"}
              onClick={() => {
                if (selectionMode) exitSelectionMode();
                else setSelectionMode(true);
              }}
              data-testid="btn-toggle-select"
            >
              {selectionMode ? (
                <>
                  <X className="w-4 h-4 me-1.5" />
                  {T.exitSelect}
                </>
              ) : (
                <>
                  <CheckSquare className="w-4 h-4 me-1.5" />
                  {T.selectMode}
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => openNewFolder(activeGroupId)} data-testid="btn-add-group">
              <FolderPlus className="w-4 h-4 me-1.5" />
              {T.addGroup}
            </Button>
            <Button
              onClick={() => {
                setUploadGroupId(activeGroupId ? String(activeGroupId) : "none");
                setShowAddFile(true);
              }}
              data-testid="btn-add-file"
            >
              <Plus className="w-4 h-4 me-1.5" />
              {T.addFile}
            </Button>
          </div>
          </div>
        </div>

        <>
        {selectionMode && (
          <Card className="p-3 flex items-center gap-3 flex-wrap bg-violet-50/50 dark:bg-violet-950/20 border-violet-300">
            <div className="text-sm font-semibold flex-1">
              {T.selectedCount(selectedFileIds.size)}
            </div>
            <Button
              size="sm"
              onClick={openBulkExtractDialog}
              disabled={
                files.filter((f) => selectedFileIds.has(f.id) && isExtractable(f)).length < 2
              }
              data-testid="btn-bulk-extract"
            >
              <Sparkles className="w-4 h-4 me-1.5" />
              {T.bulkExtract}
            </Button>
          </Card>
        )}

        {usage && (
          <Card className="p-4">
            {usage.unlimited ? (
              <div className="text-sm font-semibold text-emerald-600">{T.unlimited}</div>
            ) : (
              <>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold">
                    {T.usage(formatBytes(usage.usedBytes), formatBytes(usage.quotaBytes!))}
                  </span>
                  <span className="text-muted-foreground">{usagePct.toFixed(1)}%</span>
                </div>
                <Progress value={usagePct} className="h-2" />
              </>
            )}
          </Card>
        )}

        {/* Top-level tabs — switch between uploaded files, generated
            worksheets, lesson plans, and saved games. Each tab is a separate listing
            against its own backing API; only the active tab fetches. */}
        <Tabs defaultValue="worksheets" dir={isAr ? "rtl" : "ltr"} className="w-full">
          {/* Stylized tab bar — DOM order is RTL-friendly: in Arabic the
              first item appears on the right. Active tab gets a soft
              primary tint, an underline accent and a subtle shadow. */}
          <TabsList
            className="h-auto p-1.5 bg-slate-100/80 border border-border/60 rounded-2xl gap-1 w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 max-w-6xl shadow-sm"
          >
            <TabsTrigger
              value="worksheets"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
            >
              <ClipboardList className="w-4 h-4" />
              {isAr ? "أوراق العمل" : "Worksheets"}
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
            >
              <Folder className="w-4 h-4" />
              {isAr ? "الملفات" : "Files"}
            </TabsTrigger>
            <TabsTrigger
              value="lesson-plans"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              {isAr ? "تحضير الدروس" : "Lesson plans"}
            </TabsTrigger>
            <TabsTrigger
              value="presentations"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
              data-testid="tab-interactive-presentations"
            >
              <Presentation className="w-4 h-4" />
              {isAr ? "العروض التفاعلية" : "Presentations"}
            </TabsTrigger>
            <TabsTrigger
              value="interactive-videos"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
              data-testid="tab-interactive-videos"
            >
              <Video className="w-4 h-4" />
              {isAr ? "الفيديو التفاعلي" : "Interactive video"}
            </TabsTrigger>
            <TabsTrigger
              value="games"
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/20 transition-all"
              data-testid="tab-saved-games"
            >
              <Gamepad2 className="w-4 h-4" />
              {isAr ? "ألعابي" : "My games"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="pt-4">
        <div className="flex flex-col md:flex-row-reverse gap-4" dir="ltr">
          {/* Group sidebar */}
          <Card dir={isAr ? "rtl" : "ltr"} className="order-2 md:order-1 p-3 h-fit md:w-[240px] shrink-0 rounded-2xl border-border/60 shadow-sm">
             <button
               onClick={() => setActiveGroup("root")}
               className={`w-full text-start px-3 py-2 rounded-lg text-sm font-medium transition ${
                 activeGroup === "root" ? "bg-violet-500/15 text-violet-700" : "hover:bg-muted"
               }`}
             >
               {T.root}
             </button>
             <button
                onClick={() => setActiveGroup("all")}
              className={`w-full text-start px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeGroup === "all" ? "bg-violet-500/15 text-violet-700" : "hover:bg-muted"
              }`}
            >
                 {T.all}
            </button>
            <button
              onClick={() => setActiveGroup("none")}
              className={`w-full text-start px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeGroup === "none" ? "bg-violet-500/15 text-violet-700" : "hover:bg-muted"
              }`}
            >
              {T.none}
            </button>
            <div className="my-2 border-t" />
            {groups.length === 0 && (
              <div className="text-xs text-muted-foreground px-3 py-2">
                {isAr ? "لا توجد مجموعات" : "No groups yet"}
              </div>
            )}
            {groups.filter((folder) => folder.parentGroupId === null).map((folder) => renderFolder(folder))}
          </Card>

           {/* Computer-style contents view: folders at this level first,
               then the files that belong to the currently open folder. */}
          <div dir={isAr ? "rtl" : "ltr"} className="order-1 md:order-2 min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveGroup("root")}
                className="hover:text-violet-700 transition-colors"
              >
                {activeGroup === "root" ? T.root : T.all}
              </button>
              {folderPath.map((folder) => (
                <span key={folder.id} className="inline-flex items-center gap-1.5">
                  <span className="text-muted-foreground/50">/</span>
                  <button
                    type="button"
                    onClick={() => setActiveGroup(String(folder.id))}
                    className={`hover:text-violet-700 transition-colors ${
                      folder.id === activeGroupId ? "text-violet-700" : ""
                    }`}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
            {activeFolder && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200/70 bg-violet-50/60 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-violet-800">
                  <Folder className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {isAr ? `إجراءات مجلد: ${activeFolder.name}` : `Actions for: ${activeFolder.name}`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    variant={selectionMode ? "default" : "outline"}
                    onClick={() => {
                      if (selectionMode) exitSelectionMode();
                      else setSelectionMode(true);
                    }}
                    size="icon"
                    className="h-8 w-8 p-0"
                    title={selectionMode ? T.exitSelect : T.selectMode}
                    aria-label={selectionMode ? T.exitSelect : T.selectMode}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => openNewFolder(activeGroupId)}
                    className="h-8 w-8 p-0"
                    title={T.addGroup}
                    aria-label={T.addGroup}
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => {
                      setUploadGroupId(String(activeFolder.id));
                      setShowAddFile(true);
                    }}
                    className="h-8 w-8 p-0"
                    title={T.addFile}
                    aria-label={T.addFile}
                  >
                    <FilePlus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={T.search}
                className={isAr ? "pe-9 ps-3 text-right" : "ps-9"}
              />
            </div>

             {visibleFolders.length > 0 && (
               <section className="space-y-2" aria-labelledby="library-folders-heading">
                 <div className="flex items-center justify-between gap-3">
                   <h2 id="library-folders-heading" className="text-sm font-black text-foreground">
                     {T.folders}
                   </h2>
                   <Button
                     type="button"
                     size="sm"
                     variant="ghost"
                     onClick={() => openNewFolder(activeGroupId)}
                     className="h-8 gap-1.5 text-violet-700 hover:bg-violet-50"
                   >
                     <FolderPlus className="w-4 h-4" />
                     {T.addGroup}
                   </Button>
                 </div>
                 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                   {visibleFolders.map((folder) => (
                     <div
                       key={folder.id}
                       className="group rounded-2xl border border-violet-200/70 bg-card p-3 shadow-sm hover:border-violet-400 hover:shadow-md transition-all"
                     >
                       <div className="flex items-start gap-2.5">
                         <button
                           type="button"
                           onClick={() => setActiveGroup(String(folder.id))}
                           className="flex min-w-0 flex-1 items-start gap-2.5 text-start"
                           title={T.openFolder}
                           data-testid={`open-group-${folder.id}`}
                         >
                           <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                             <Folder className="h-5 w-5 fill-violet-200" />
                           </span>
                           <span className="min-w-0 pt-0.5">
                             <span className="block truncate text-sm font-black">{folder.name}</span>
                             <span className="mt-1 block text-[11px] text-muted-foreground">
                               {T.filesCount(folder.fileCount)}
                             </span>
                           </span>
                         </button>
                         <div className="flex shrink-0 items-center gap-0.5">
                           <button
                             type="button"
                             onClick={() => {
                               setRenameTarget(folder);
                               setRenameValue(folder.name);
                             }}
                             className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"
                             title={T.rename}
                             aria-label={`${T.rename}: ${folder.name}`}
                           >
                             <Pencil className="h-3.5 w-3.5" />
                           </button>
                           <button
                             type="button"
                             onClick={() => setDeleteGroupTarget(folder)}
                             className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                             title={T.delete}
                             aria-label={`${T.delete}: ${folder.name}`}
                           >
                             <Trash2 className="h-3.5 w-3.5" />
                           </button>
                         </div>
                       </div>
                       <button
                         type="button"
                         onClick={() => setActiveGroup(String(folder.id))}
                         className="mt-3 flex w-full items-center justify-between border-t border-border/60 pt-2 text-[11px] font-semibold text-muted-foreground hover:text-violet-700"
                       >
                         <span>{T.openFolder}</span>
                         <ArrowLeft className={`h-3.5 w-3.5 ${isAr ? "" : "rotate-180"}`} />
                       </button>
                       {folder.childCount > 0 && (
                         <div className="mt-1 text-[10px] text-muted-foreground">
                           {T.subfoldersCount(folder.childCount)}
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               </section>
             )}

            {loading ? (
              <Card className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </Card>
            ) : files.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">
                <Library className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <div>{T.empty}</div>
              </Card>
            ) : (
              <Card className="divide-y">
                {files.map((f) => {
                  const group = groups.find((g) => g.id === f.groupId);
                  const checked = selectedFileIds.has(f.id);
                  const canSelect = isExtractable(f);
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center gap-3 p-3 hover:bg-muted/40 ${
                        selectionMode && checked ? "bg-violet-50/60 dark:bg-violet-950/20" : ""
                      } ${selectionMode && canSelect ? "cursor-pointer" : ""}`}
                      onClick={(e) => {
                        if (!selectionMode || !canSelect) return;
                        const target = e.target as HTMLElement;
                        if (target.closest("button") || target.closest("input")) return;
                        toggleFileSelection(f.id);
                      }}
                    >
                      {selectionMode && (
                        <div className="shrink-0">
                          {canSelect ? (
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleFileSelection(f.id)}
                              data-testid={`checkbox-file-${f.id}`}
                            />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground/40" />
                          )}
                        </div>
                      )}
                      <div className="shrink-0">{fileIcon(f.fileType, f.name)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" data-testid={`file-name-${f.id}`}>
                          {f.name}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                          {f.source === "upload" && <span>{formatBytes(f.sizeBytes)}</span>}
                          {f.source === "link" && <span>{T.linkTab}</span>}
                          <span>·</span>
                          <span>{new Date(f.createdAt).toLocaleDateString(isAr ? "ar" : "en")}</span>
                          {group && (
                            <>
                              <span>·</span>
                              <span className="text-violet-600">{group.name}</span>
                            </>
                          )}
                        </div>
                        {f.description && (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {f.description}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {isExtractable(f) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openExtractDialog(f)}
                            title={T.extract}
                            className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                            data-testid={`btn-extract-${f.id}`}
                          >
                            <Sparkles className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(f, true)}
                          title={T.preview}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        {f.source === "upload" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(f, false)}
                            title={T.download}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMoveTarget(f);
                            setMoveGroupId(f.groupId ? String(f.groupId) : "none");
                          }}
                          title={T.move}
                        >
                          <Move className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(f)}
                          title={T.delete}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        </div>
          </TabsContent>

          <TabsContent value="worksheets" className="pt-4">
            <SavedDocsList kind="worksheets" isAr={isAr} />
          </TabsContent>

          <TabsContent value="lesson-plans" className="pt-4">
            <SavedDocsList kind="lesson-plans" isAr={isAr} />
          </TabsContent>

          <TabsContent value="presentations" className="pt-4">
            <div className="rounded-[28px] border border-border/60 bg-card/50 p-2 sm:p-4 shadow-sm">
              <div className="px-2 pb-3">
                <p className="text-xs font-bold text-violet-600">{isAr ? "داخل مكتبتي" : "Inside My Library"}</p>
                <h2 className="text-lg font-black">{isAr ? "العروض التفاعلية" : "Interactive presentations"}</h2>
              </div>
              <PresentationsIndex embedded viewOnly />
            </div>
          </TabsContent>

          <TabsContent value="interactive-videos" className="pt-4">
            <InteractiveVideoLessonsList isAr={isAr} setLocation={setLocation} />
          </TabsContent>

          <TabsContent value="games" className="pt-4">
            <SavedGameActivitiesList isAr={isAr} />
          </TabsContent>

        </Tabs>
        </>
      </div>

      {/* Add group dialog */}
      <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{T.addGroup}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{T.groupName}</Label>
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddGroup(false)}>
              {T.cancel}
            </Button>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              {T.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename group */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{T.rename}</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              {T.cancel}
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>
              {T.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete group */}
      <Dialog open={!!deleteGroupTarget} onOpenChange={(o) => !o && setDeleteGroupTarget(null)}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{T.confirmDeleteGroup}</DialogTitle>
          </DialogHeader>
          <div className="text-sm">
            <span className="font-semibold">{deleteGroupTarget?.name}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGroupTarget(null)}>
              {T.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup}>
              {T.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add file dialog */}
      <Dialog
        open={showAddFile}
        onOpenChange={(o) => {
          if (submitting || isUploading) return;
          setShowAddFile(o);
          if (!o) {
            setUploadQueue([]);
            setUploadDescription("");
            setIsDragging(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}
      >
        <DialogContent dir={isAr ? "rtl" : "ltr"} className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{T.addFile}</DialogTitle>
          </DialogHeader>
          <Tabs value={addFileTab} onValueChange={handleAddFileTabChange}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="upload">
                <Upload className="w-4 h-4 me-1.5" />
                {T.uploadTab}
              </TabsTrigger>
              <TabsTrigger value="link">
                <LinkIcon className="w-4 h-4 me-1.5" />
                {T.linkTab}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label>{T.group}</Label>
                <Select value={uploadGroupId} onValueChange={setUploadGroupId} disabled={isUploading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{T.none}</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{T.description}</Label>
                <Textarea
                  rows={2}
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  disabled={isUploading}
                />
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isUploading) setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (isUploading) return;
                  const dropped = Array.from(e.dataTransfer.files || []);
                  addFilesToQueue(dropped);
                }}
                className={`border-2 border-dashed rounded-lg p-6 text-center space-y-2 transition ${
                  isDragging ? "border-violet-500 bg-violet-500/5" : ""
                }`}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <div className="text-sm text-muted-foreground">{T.dropHint}</div>
                <div className="text-xs text-muted-foreground">{T.allowedTypes}</div>
                <div className="text-xs text-muted-foreground">{T.maxSize}</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || []);
                    addFilesToQueue(picked);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="btn-pick-files"
                >
                  {T.browse}
                </Button>
              </div>

              {uploadQueue.length > 0 && (
                <div className="border rounded-lg max-h-60 overflow-y-auto divide-y" data-testid="upload-queue">
                  {uploadQueue.map((q) => {
                    const isRejected =
                      q.status === "error" && (q.error === T.tooLarge || q.error === T.notAllowed);
                    const ruleText =
                      q.error === T.tooLarge
                        ? T.tooLargeRule
                        : q.error === T.notAllowed
                        ? T.notAllowedRule
                        : undefined;
                    return (
                    <div
                      key={q.id}
                      className={`flex items-center gap-2 p-2 text-sm ${
                        isRejected ? "bg-red-50 dark:bg-red-950/20" : ""
                      }`}
                      title={isRejected ? ruleText : undefined}
                      data-testid={isRejected ? "queue-row-rejected" : `upload-row-${q.id}`}
                    >
                      <div className="shrink-0">
                        {q.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : q.status === "error" ? (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        ) : q.status === "uploading" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                        ) : q.status === "cancelled" ? (
                          <Ban className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`truncate font-medium ${q.status === "cancelled" ? "line-through text-muted-foreground" : ""}`} title={q.file.name}>
                          {q.file.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatBytes(q.file.size)}</span>
                          {q.status === "uploading" && (
                            <>
                              <span>·</span>
                              <span>{q.progress}%</span>
                            </>
                          )}
                          {q.status === "cancelled" && (
                            <>
                              <span>·</span>
                              <span>{T.cancelled}</span>
                            </>
                          )}
                          {q.status === "error" && q.error && (
                            <>
                              <span>·</span>
                              <span className="text-red-600 truncate">{q.error}</span>
                              {ruleText && (
                                <button
                                  type="button"
                                  className="text-red-600 underline underline-offset-2 hover:text-red-700 shrink-0"
                                  title={ruleText}
                                  aria-label={ruleText}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    toast.info(ruleText);
                                  }}
                                  data-testid="link-why-rejected"
                                >
                                  {T.whyRejected}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                        {q.status === "uploading" && (
                          <Progress value={q.progress} className="h-1 mt-1" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {q.status === "uploading" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelCurrentUpload(q.id)}
                            title={T.abort}
                            data-testid={`btn-abort-${q.id}`}
                          >
                            <Ban className="w-3.5 h-3.5 text-red-600" />
                          </Button>
                        )}
                        {q.status === "pending" && isUploading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelCurrentUpload(q.id)}
                            title={T.abort}
                            data-testid={`btn-cancel-pending-${q.id}`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {q.status === "error" && !isUploading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (q.error === T.tooLarge || q.error === T.notAllowed) return;
                              resetQueueItem(q.id);
                            }}
                            disabled={q.error === T.tooLarge || q.error === T.notAllowed}
                            title={T.retry}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {q.status === "cancelled" && !isUploading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetQueueItem(q.id)}
                            title={T.retry}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {q.status !== "uploading" && !isUploading && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromQueue(q.id)}
                            title={T.remove}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddFile(false)}
                  disabled={isUploading}
                >
                  {T.close}
                </Button>
                {isUploading && (
                  <Button
                    variant="destructive"
                    onClick={stopAllUploads}
                    disabled={stopRequested}
                    data-testid="btn-stop-uploads"
                  >
                    <StopCircle className="w-4 h-4 me-1.5" />
                    {stopRequested ? T.stopping : T.stopAll}
                  </Button>
                )}
                <Button
                  onClick={handleStartUploads}
                  disabled={
                    isUploading || uploadQueue.filter((q) => q.status === "pending").length === 0
                  }
                  data-testid="btn-start-uploads"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                      {T.uploadingN(
                        uploadQueue.filter(
                          (q) => q.status === "success" || q.status === "error" || q.status === "cancelled",
                        ).length,
                        uploadQueue.length,
                      )}
                    </>
                  ) : (
                    T.uploadAll(uploadQueue.filter((q) => q.status === "pending").length)
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="link" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label>{T.fileName}</Label>
                <Input value={linkName} onChange={(e) => setLinkName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{T.url}</Label>
                <Input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>{T.group}</Label>
                <Select value={uploadGroupId} onValueChange={setUploadGroupId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{T.none}</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{T.description}</Label>
                <Textarea
                  rows={2}
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddFile(false)} disabled={submitting}>
                  {T.cancel}
                </Button>
                <Button onClick={handleAddLink} disabled={submitting || !linkName.trim() || !linkUrl.trim()}>
                  {T.add}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Move file */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{T.moveToGroup}</DialogTitle>
          </DialogHeader>
          <Select value={moveGroupId} onValueChange={setMoveGroupId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{T.none}</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>
              {T.cancel}
            </Button>
            <Button onClick={handleMove}>{T.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extract questions */}
      <Dialog
        open={!!extractTarget || !!extractBulkTargets}
        onOpenChange={(o) => {
          if (extractLoading || savingBank) return;
          if (!o) {
            setExtractTarget(null);
            setExtractBulkTargets(null);
            setExtractedQuestions(null);
          }
        }}
      >
        <DialogContent dir={isAr ? "rtl" : "ltr"} className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              {extractBulkTargets ? T.bulkExtractTitle : T.extractTitle}
            </DialogTitle>
          </DialogHeader>

          {extractTarget && (
            <div className="text-xs text-muted-foreground border rounded-lg p-2 flex items-center gap-2">
              {fileIcon(extractTarget.fileType, extractTarget.name)}
              <span className="font-medium truncate">{extractTarget.name}</span>
            </div>
          )}

          {extractBulkTargets && (
            <div className="text-xs text-muted-foreground border rounded-lg p-2 space-y-1.5">
              <div className="font-semibold text-violet-600">
                {T.filesIncluded(extractBulkTargets.length)}
              </div>
              {extractBulkTargets.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  {fileIcon(f.fileType, f.name)}
                  <span className="font-medium truncate">{f.name}</span>
                </div>
              ))}
            </div>
          )}

          {!extractedQuestions && (
            <>
              <p className="text-sm text-muted-foreground">
                {extractBulkTargets ? T.bulkExtractSubtitle : T.extractSubtitle}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">{T.countLabel}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={extractCount}
                    onChange={(e) => setExtractCount(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                    disabled={extractLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{T.difficultyLabel}</Label>
                  <Select
                    value={extractDifficulty}
                    onValueChange={(v) => setExtractDifficulty(v as "easy" | "medium" | "hard")}
                    disabled={extractLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">{T.easy}</SelectItem>
                      <SelectItem value="medium">{T.medium}</SelectItem>
                      <SelectItem value="hard">{T.hard}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{T.questionTypeLabel}</Label>
                <Select
                  value={extractQuestionType}
                  onValueChange={(v) => setExtractQuestionType(v as ExtractedQuestionType)}
                  disabled={extractLoading}
                >
                  <SelectTrigger data-testid="select-question-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mcq">{T.typeMcq}</SelectItem>
                    <SelectItem value="true_false">{T.typeTrueFalse}</SelectItem>
                    <SelectItem value="fill_blank">{T.typeFillBlank}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{T.subjectLabel}</Label>
                <Input
                  value={extractSubject}
                  onChange={(e) => setExtractSubject(e.target.value)}
                  placeholder={T.subjectPlaceholder}
                  disabled={extractLoading}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractTarget(null);
                    setExtractBulkTargets(null);
                  }}
                  disabled={extractLoading}
                >
                  {T.cancel}
                </Button>
                <Button onClick={handleExtractGenerate} disabled={extractLoading} data-testid="btn-extract-generate">
                  {extractLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                      {T.generating}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 me-1.5" />
                      {T.generate}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {extractedQuestions && (
            <>
              <div className="text-sm font-bold text-emerald-600">
                {T.previewTitle(extractedQuestions.length)}
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {extractedQuestions.map((q, i) => {
                  const expanded = extractExpanded.has(i);
                  return (
                    <div key={i} className="border rounded-lg p-3" data-testid={`extracted-q-${i}`}>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-start"
                          onClick={() => {
                            const next = new Set(extractExpanded);
                            if (expanded) next.delete(i);
                            else next.add(i);
                            setExtractExpanded(next);
                          }}
                        >
                          <div className="text-xs text-muted-foreground">
                            {isAr ? `سؤال ${i + 1}` : `Question ${i + 1}`}
                          </div>
                          {!expanded && (
                            <div className="text-sm font-semibold mt-0.5 line-clamp-2">
                              {q.text || (isAr ? "(فارغ)" : "(empty)")}
                            </div>
                          )}
                          {q.sourceFileName && (
                            <div
                              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[10px] font-medium max-w-full"
                              title={q.sourceFileName}
                              data-testid={`q-source-${i}`}
                            >
                              <FileText className="w-3 h-3 shrink-0" />
                              <span className="truncate">{T.sourceFileBadge(q.sourceFileName)}</span>
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = new Set(extractExpanded);
                            if (expanded) next.delete(i);
                            else next.add(i);
                            setExtractExpanded(next);
                          }}
                          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                          aria-label={expanded ? "collapse" : "expand"}
                        >
                          {expanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExtractedQuestion(i)}
                          className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
                          aria-label={T.deleteQuestion}
                          title={T.deleteQuestion}
                          data-testid={`btn-delete-q-${i}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {expanded && (
                        <div className="mt-2 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{T.questionTextLabel}</Label>
                            <Textarea
                              rows={2}
                              value={q.text}
                              onChange={(e) =>
                                updateExtractedQuestion(i, { text: e.target.value })
                              }
                              data-testid={`input-q-text-${i}`}
                            />
                          </div>
                          {(q.questionType || extractQuestionType) === "mcq" && (
                            <div className="space-y-1.5">
                              {(["A", "B", "C", "D"] as const).map((letter) => {
                                const key = `option${letter}` as keyof ExtractedQuestion;
                                const opt = q[key] as string;
                                const isCorrect = q.correctAnswer === letter;
                                return (
                                  <div
                                    key={letter}
                                    className={`flex items-center gap-2 p-1.5 rounded border ${
                                      isCorrect
                                        ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                                        : "border-transparent"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateExtractedQuestion(i, { correctAnswer: letter })
                                      }
                                      title={T.markCorrect}
                                      className={`shrink-0 w-7 h-7 rounded-full font-mono text-xs font-bold flex items-center justify-center transition ${
                                        isCorrect
                                          ? "bg-emerald-500 text-white"
                                          : "bg-muted text-muted-foreground hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                                      }`}
                                      data-testid={`btn-correct-${i}-${letter}`}
                                    >
                                      {letter}
                                    </button>
                                    <Input
                                      value={opt || ""}
                                      onChange={(e) =>
                                        updateExtractedQuestion(i, {
                                          [key]: e.target.value,
                                        } as Partial<ExtractedQuestion>)
                                      }
                                      placeholder={T.optionLabel(letter)}
                                      className="h-8 text-sm"
                                      data-testid={`input-q-option-${i}-${letter}`}
                                    />
                                    {isCorrect && (
                                      <span className="text-xs font-bold text-emerald-600 shrink-0">
                                        {T.correctBadge}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {(q.questionType || extractQuestionType) === "true_false" && (
                            <div className="flex gap-2">
                              {(["true", "false"] as const).map((val) => {
                                const isCorrect = q.correctAnswer === val;
                                return (
                                  <button
                                    type="button"
                                    key={val}
                                    onClick={() =>
                                      updateExtractedQuestion(i, { correctAnswer: val })
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                      isCorrect
                                        ? val === "true"
                                          ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                                          : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-300"
                                        : "text-muted-foreground border-muted hover:bg-muted"
                                    }`}
                                    data-testid={`btn-tf-${i}-${val}`}
                                  >
                                    {val === "true" ? T.trueLabel : T.falseLabel}
                                    {isCorrect && " ✓"}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {(q.questionType || extractQuestionType) === "fill_blank" && (
                            <div className="space-y-1">
                              <Label className="text-xs">{T.answerLabel}</Label>
                              <Input
                                value={q.correctAnswer || ""}
                                onChange={(e) =>
                                  updateExtractedQuestion(i, { correctAnswer: e.target.value })
                                }
                                className="h-8 text-sm"
                                data-testid={`input-q-fill-${i}`}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addBlankExtractedQuestion}
                  className="w-full border-dashed"
                  data-testid="btn-add-extracted-question"
                >
                  <Plus className="w-4 h-4 me-1.5" />
                  {T.addQuestion}
                </Button>
              </div>

              <DialogFooter className="flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractedQuestions(null);
                    setExtractExpanded(new Set());
                  }}
                  disabled={savingBank}
                >
                  {T.regenerate}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveToBank}
                  disabled={savingBank}
                  data-testid="btn-save-to-bank"
                >
                  {savingBank ? (
                    <>
                      <Loader2 className="w-4 h-4 me-1.5 animate-spin" />
                      {T.saving}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 me-1.5" />
                      {T.saveToBank}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCreateAssignmentFromExtracted}
                  disabled={savingBank}
                  data-testid="btn-create-assignment"
                >
                  <ClipboardList className="w-4 h-4 me-1.5" />
                  {T.createAssignment}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete file */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{T.confirmDeleteFile}</DialogTitle>
          </DialogHeader>
          <div className="text-sm font-semibold">{deleteTarget?.name}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {T.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDeleteFile}>
              {T.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SavedDocsList
// ─────────────────────────────────────────────────────────────────────────
// Lightweight listing for generated documents that live in their own
// tables (worksheets and lesson_plans) rather than the file-storage
// backend used by the main "Files" tab. Each row links out to the
// dedicated print/edit pages so this component stays tab-scoped and
// doesn't have to know about the rich editor state.
type SavedDoc = {
  id: number;
  title: string;
  subject?: string | null;
  gradeLevel?: string | null;
  language?: "ar" | "en";
  updatedAt?: string;
  isShared?: boolean;
  ownerName?: string | null;
  ownerIsAdmin?: boolean;
  linkedAssignmentId?: number | null;
};

function SavedDocsList({
  kind,
  isAr,
}: {
  kind: "worksheets" | "lesson-plans";
  isAr: boolean;
}) {
  const [, setLocation] = useLocation();
  const [rows, setRows] = useState<SavedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<SavedDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Endpoint and route prefixes are derived from `kind` so we have one
  // component for both document types instead of two near-identical ones.
  const apiPath = kind === "worksheets" ? "/api/worksheets" : "/api/lesson-plans";
  // The dedicated detail route for both kinds lives under `/<id>/print` —
  // there is no plain `/<id>` view route registered in App.tsx. Sending
  // teachers there directly avoids 404s when they click "Open".
  const viewSuffix = "/print";
  const viewPrefix = kind === "worksheets" ? "/teacher/worksheets" : "/teacher/lesson-plans";
  const createPath =
    kind === "worksheets" ? "/teacher/worksheets/create" : "/teacher/lesson-plans/create";

  const T = {
    search: isAr ? "ابحث بالعنوان..." : "Search by title...",
    empty: isAr
      ? kind === "worksheets"
        ? "لا توجد أوراق عمل محفوظة بعد."
        : "لا توجد خطط دروس محفوظة بعد."
      : kind === "worksheets"
      ? "No saved worksheets yet."
      : "No saved lesson plans yet.",
    open: isAr ? "فتح" : "Open",
    edit: isAr ? "تعديل" : "Edit",
    delete: isAr ? "حذف" : "Delete",
    create: isAr
      ? kind === "worksheets"
        ? "إنشاء ورقة عمل"
        : "إنشاء خطة درس"
      : kind === "worksheets"
      ? "Create worksheet"
      : "Create lesson plan",
    confirm: isAr ? "تأكيد الحذف؟" : "Confirm delete?",
    cancel: isAr ? "إلغاء" : "Cancel",
    sharedByAdmin: isAr ? "مُشارك من الإدارة" : "Shared by admin",
    grade: isAr ? "تصحيح" : "Grade",
    deleted: isAr ? "تم الحذف" : "Deleted",
    deleteFailed: isAr ? "تعذّر الحذف" : "Delete failed",
  };

  const refresh = () => {
    setLoading(true);
    fetch(apiPath, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const r = await fetch(`${apiPath}/${confirmDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("delete failed");
      toast.success(T.deleted);
      setConfirmDelete(null);
      refresh();
    } catch {
      toast.error(T.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = rows.filter(
    (r) => !search.trim() || r.title.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={T.search}
            className="ps-9"
          />
        </div>
        <Button onClick={() => setLocation(createPath)} data-testid={`btn-create-${kind}`}>
          <Plus className="w-4 h-4 me-1.5" />
          {T.create}
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Library className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <div>{T.empty}</div>
        </Card>
      ) : (
        <Card className="divide-y">
          {filtered.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 p-3 hover:bg-muted/40 flex-wrap"
              data-testid={`saved-doc-${kind}-${row.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold truncate">{row.title || (isAr ? "(بدون عنوان)" : "(untitled)")}</span>
                  {row.isShared && row.ownerIsAdmin && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {T.sharedByAdmin}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  {row.subject && <span>{row.subject}</span>}
                  {row.gradeLevel && <span>· {row.gradeLevel}</span>}
                  {row.language && <span className="uppercase">· {row.language}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {kind === "worksheets" && row.linkedAssignmentId != null && (
                  <Button
                    size="sm"
                    onClick={() => setLocation(`/teacher/worksheets/${row.id}/grade`)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    data-testid={`btn-grade-${kind}-${row.id}`}
                  >
                    <Camera className="w-3.5 h-3.5 me-1" />
                    {T.grade}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`${viewPrefix}/${row.id}${viewSuffix}`)}
                  data-testid={`btn-open-${kind}-${row.id}`}
                >
                  {T.open}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`${createPath}?edit=${row.id}`)}
                  data-testid={`btn-edit-${kind}-${row.id}`}
                >
                  <Pencil className="w-3.5 h-3.5 me-1" />
                  {T.edit}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDelete(row)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`btn-delete-${kind}-${row.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{T.confirm}</DialogTitle>
          </DialogHeader>
          <div className="text-sm font-semibold">{confirmDelete?.title}</div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deleting}
            >
              {T.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 me-1.5 animate-spin" /> : null}
              {T.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SavedGameActivitiesList
// ─────────────────────────────────────────────────────────────────────────
// Saved games are intentionally fetched through their small, game-specific
// client helper. That endpoint returns only activities owned by the current
// teacher, unlike the document lists which may include shared admin content.
const gameCreatorPaths: Record<string, string> = {
  arena: "/game/arena",
  solo: "/teacher/solo-challenges/new",
  wameeth: "/game/wameeth/create",
  wameeth_class: "/game/wameeth/create",
  tug: "/game/tug/create",
  "tug-of-war": "/game/tug/create",
  tug_of_war: "/game/tug/create",
  xo: "/game/xo/create",
  escape: "/game/escape/create",
  escape_room: "/game/escape/create",
  "escape-room": "/game/escape/create",
  rocket: "/game/rocket/create",
  rocket_race: "/game/rocket/create",
  "rocket-race": "/game/rocket/create",
  hotseat: "/game/hotseat/create",
  wheel: "/game/wheel/create",
  flags: "/game/flags",
  capitals: "/game/capitals",
  color: "/game/color",
  multiply: "/game/multiply",
  memory: "/game/memory/create",
  letrly: "/game/letrly/create",
  scramble: "/game/scramble/create",
  stroop: "/game/stroop/create",
  maraqui: "/game/maraqui/create",
  million: "/game/million",
};

function SavedGameActivitiesList({ isAr }: { isAr: boolean }) {
  const [, setLocation] = useLocation();
  const [games, setGames] = useState<SavedGameActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedGameActivity | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<SavedGameActivity | null>(null);
  const [revoking, setRevoking] = useState(false);

  const T = {
    empty: isAr ? "لا توجد ألعاب محفوظة بعد." : "No saved games yet.",
    loading: isAr ? "جارٍ تحميل ألعابك..." : "Loading your games...",
    loadFailed: isAr ? "تعذّر تحميل الألعاب المحفوظة." : "Unable to load saved games.",
    retry: isAr ? "إعادة المحاولة" : "Try again",
    questions: (count: number) => (isAr ? `${count} سؤال` : `${count} question${count === 1 ? "" : "s"}`),
    plays: (count: number) => (isAr ? `${count} مرة لعب` : `${count} play${count === 1 ? "" : "s"}`),
    lastPlayed: (date: string) => (isAr ? `آخر لعب: ${date}` : `Last played: ${date}`),
    runAgain: isAr ? "تشغيل مجدداً" : "Run again",
    delete: isAr ? "حذف" : "Delete",
    confirm: isAr ? "حذف اللعبة المحفوظة؟" : "Delete saved game?",
    confirmHint: isAr
      ? "سيتم حذف مجموعة الأسئلة المحفوظة نهائياً."
      : "This will permanently delete the saved question set.",
    cancel: isAr ? "إلغاء" : "Cancel",
    deleted: isAr ? "تم حذف اللعبة المحفوظة" : "Saved game deleted",
    deleteFailed: isAr ? "تعذّر حذف اللعبة المحفوظة" : "Unable to delete saved game",
    copyLink: isAr ? "نسخ رابط اللعب" : "Copy play link",
    linkCopied: isAr ? "تم نسخ رابط اللعب الدائم" : "Permanent play link copied",
    linkFailed: isAr ? "تعذّر إنشاء رابط اللعب" : "Unable to create play link",
    revokeLink: isAr ? "إلغاء الرابط" : "Revoke link",
    revokeConfirm: isAr ? "إلغاء رابط اللعب الدائم؟" : "Revoke permanent play link?",
    revokeHint: isAr
      ? "سيتوقف الرابط الحالي فورًا. يمكنك بعد ذلك نسخ رابط جديد برمز مختلف."
      : "The current link will stop working immediately. You can then copy a new link with a different token.",
    revoked: isAr ? "تم إلغاء الرابط الحالي" : "Current link revoked",
    revokeFailed: isAr ? "تعذّر إلغاء رابط اللعب" : "Unable to revoke play link",
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setGames(await listSavedGameActivities());
    } catch (cause) {
      setGames([]);
      setError(cause instanceof Error && cause.message ? cause.message : T.loadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const localGameType = (gameType: string) => {
    const normalized = gameType.toLowerCase().trim();
    const labels: Record<string, [string, string]> = {
      wameeth: ["وميض", "Wameeth"],
      wameeth_class: ["وميض", "Wameeth"],
      tug: ["شد الحبل", "Tug of War"],
      "tug-of-war": ["شد الحبل", "Tug of War"],
      tug_of_war: ["شد الحبل", "Tug of War"],
      xo: ["X O", "X O"],
      escape: ["غرفة الهروب", "Escape Room"],
      escape_room: ["غرفة الهروب", "Escape Room"],
      "escape-room": ["غرفة الهروب", "Escape Room"],
      rocket: ["سباق الصواريخ", "Rocket Race"],
      rocket_race: ["سباق الصواريخ", "Rocket Race"],
      "rocket-race": ["سباق الصواريخ", "Rocket Race"],
      hotseat: ["المقعد الساخن", "Hot Seat"],
      wheel: ["عجلة الحظ", "Wheel"],
      flags: ["أعلام العالم", "Flags"],
      capitals: ["عواصم العالم", "Capitals"],
      color: ["لعبة الألوان", "Color Game"],
      multiply: ["تحدي الضرب", "Multiplication Challenge"],
      memory: ["تطابق الذاكرة", "Memory Match"],
      letrly: ["لِتْرَلي", "Letrly"],
      scramble: ["الكلمات المبعثرة", "Scrambled Words"],
      stroop: ["تأثير ستروب", "Stroop Effect"],
      maraqui: ["مراكي", "Maraqui"],
      million: ["من سيحصد المليون", "Who Wants a Million"],
    };
    return labels[normalized]?.[isAr ? 0 : 1] || gameType;
  };

  const playCount = (game: SavedGameActivity): number | null => {
    const value = game.playCount ?? game.plays ?? game.timesPlayed ?? game.runCount;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const lastPlayed = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(isAr ? "ar-SA" : "en-US");
  };

  const runAgain = (game: SavedGameActivity) => {
    const path = gameCreatorPaths[game.gameType.toLowerCase().trim()];
    if (!path) {
      toast.error(isAr ? "لا تتوفر صفحة إعداد لهذه اللعبة." : "A setup page is not available for this game.");
      return;
    }
    setLocation(`${path}?savedGameId=${encodeURIComponent(String(game.id))}`);
  };

  const copyPlayLink = async (game: SavedGameActivity) => {
    if (game.gameType.toLowerCase().trim() !== "xo") return;
    try {
      await copyGameShortUrl(createSavedGamePlayLink(game.id).then(savedGamePlayUrl));
      toast.success(T.linkCopied);
    } catch (cause) {
      toast.error(cause instanceof Error && cause.message ? cause.message : T.linkFailed);
    }
  };

  async function handleRevokeLink() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeSavedGamePlayLink(revokeTarget.id);
      setRevokeTarget(null);
      toast.success(T.revoked);
    } catch (cause) {
      toast.error(cause instanceof Error && cause.message ? cause.message : T.revokeFailed);
    } finally {
      setRevoking(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSavedGameActivity(deleteTarget.id);
      trackSavedGameEvent(EVENTS.savedGameDeleted, deleteTarget.gameType, "saved_games_library");
      setDeleteTarget(null);
      toast.success(T.deleted);
      await refresh();
    } catch (cause) {
      toast.error(cause instanceof Error && cause.message ? cause.message : T.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-8 text-center text-muted-foreground" data-testid="saved-games-loading">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        <div className="text-sm">{T.loading}</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center" data-testid="saved-games-error">
        <AlertCircle className="w-9 h-9 mx-auto mb-3 text-red-500" />
        <p className="text-sm font-medium text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh()} className="mt-4" data-testid="btn-retry-saved-games">
          <RotateCcw className="w-3.5 h-3.5 me-1.5" />
          {T.retry}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {games.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground" data-testid="saved-games-empty">
          <Gamepad2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <div>{T.empty}</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {games.map((game) => {
            const count = playCount(game);
            const played = lastPlayed(game.lastUsedAt);
            return (
              <Card
                key={game.id}
                className="p-4 border-border/70 hover:border-primary/30 hover:shadow-sm transition-all"
                data-testid={`saved-game-${game.id}`}
              >
                <div className="flex gap-3 items-start">
                  <div className="shrink-0 rounded-xl p-2.5 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold leading-tight truncate" data-testid={`saved-game-title-${game.id}`}>
                      {game.gameType.toLowerCase().trim() === "xo"
                        ? <XoTitle title={game.title} lang={isAr ? "ar" : "en"} />
                        : game.title || (isAr ? "(بدون عنوان)" : "(untitled)")}
                    </h3>
                    <p className="text-xs font-semibold text-primary mt-1">
                      {game.gameType.toLowerCase().trim() === "xo" ? <XoName /> : localGameType(game.gameType)}
                    </p>
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-2 gap-y-1">
                      <span>{T.questions(game.questionCount)}</span>
                      {count !== null && <span>· {T.plays(count)}</span>}
                      {played && <span>· {T.lastPlayed(played)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-3 border-t border-border/60">
                  <Button size="sm" onClick={() => runAgain(game)} data-testid={`btn-run-saved-game-${game.id}`}>
                    <Play className="w-3.5 h-3.5 me-1.5" />
                    {T.runAgain}
                  </Button>
                  {game.gameType.toLowerCase().trim() === "xo" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void copyPlayLink(game)}
                        data-testid={`btn-copy-saved-game-link-${game.id}`}
                      >
                        <Copy className="w-3.5 h-3.5 me-1.5" />
                        {T.copyLink}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRevokeTarget(game)}
                        className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                        data-testid={`btn-revoke-saved-game-link-${game.id}`}
                      >
                        <Unlink className="w-3.5 h-3.5 me-1.5" />
                        {T.revokeLink}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(game)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`btn-delete-saved-game-${game.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 me-1.5" />
                    {T.delete}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{T.confirm}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{deleteTarget?.title}</p>
            <p className="text-sm text-muted-foreground">{T.confirmHint}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {T.cancel}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} data-testid="btn-confirm-delete-saved-game">
              {deleting && <Loader2 className="w-4 h-4 me-1.5 animate-spin" />}
              {T.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && !revoking && setRevokeTarget(null)}>
        <DialogContent dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{T.revokeConfirm}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{revokeTarget?.title}</p>
            <p className="text-sm text-muted-foreground">{T.revokeHint}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              {T.cancel}
            </Button>
            <Button variant="destructive" onClick={handleRevokeLink} disabled={revoking} data-testid="btn-confirm-revoke-saved-game-link">
              {revoking && <Loader2 className="w-4 h-4 me-1.5 animate-spin" />}
              {T.revokeLink}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

