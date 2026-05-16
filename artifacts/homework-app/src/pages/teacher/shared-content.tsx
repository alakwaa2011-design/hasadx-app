import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, ArrowLeft, BookText, HelpCircle, Globe,
  Search, User, Copy, Download, Loader2, CheckCircle2, X, Video, Play, GraduationCap,
  Gamepad2, EyeOff, FolderOpen, MoreVertical, Zap, Users, Plus,
} from "lucide-react";
import { Card, Button, Input } from "@/components/ui-elements";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "";

type Tab = "assignments" | "questions" | "videos";

// ---------------------------------------------------------------------------
// Fuzzy subject matching — maps Arabic/English query aliases to subject groups
// so "عربي" matches "اللغة العربية", "دين" matches "تربية إسلامية", etc.
// ---------------------------------------------------------------------------
const SUBJECT_ALIAS_GROUPS: string[][] = [
  // اللغة العربية
  ["عربي", "عربية", "عرب", "لغة عربية", "لغه عربيه", "اللغة العربية", "arabic", "لغة", "ايخص العربي"],
  // تربية إسلامية
  ["إسلامية", "اسلامية", "إسلام", "اسلام", "تربية إسلامية", "تربيه اسلاميه", "دين", "ديني", "قرآن", "قران", "quran", "islamic", "religion", "مسجد"],
  // رياضيات
  ["رياضيات", "رياض", "حساب", "math", "maths", "mathematics", "ماث", "جبر", "algebra", "هندسة"],
  // علوم
  ["علوم", "علم", "science", "فيزياء", "كيمياء", "أحياء", "احياء", "بيولوجيا", "biology", "physics", "chemistry"],
  // اللغة الإنجليزية
  ["انجليزي", "إنجليزي", "انجليزية", "إنجليزية", "لغة إنجليزية", "انكليزي", "english", "eng", "إنجليش"],
  // تربية وطنية / دراسات اجتماعية
  ["تربية وطنية", "وطنية", "اجتماعيات", "social", "دراسات اجتماعية", "مجتمع", "مواطنة"],
  // تاريخ
  ["تاريخ", "history"],
  // جغرافيا
  ["جغرافيا", "geography", "جغرافية"],
  // حاسوب / تقنية
  ["حاسوب", "تقنية", "تقنيه", "computer", "ict", "معلوماتية"],
  // تربية فنية
  ["فنون", "فنية", "تربية فنية", "رسم", "art"],
  // تربية رياضية
  ["رياضة", "تربية رياضية", "pe", "sport"],
];

/** Returns true if `subject` should show up when the teacher types `query`. */
function subjectMatchesQuery(subject: string | null | undefined, query: string): boolean {
  if (!subject) return false;
  const q = query.trim().toLowerCase();
  const s = subject.toLowerCase();
  if (!q) return true;
  if (s.includes(q) || q.includes(s)) return true;
  for (const group of SUBJECT_ALIAS_GROUPS) {
    const qMatch = group.some(a => q.includes(a) || a.includes(q));
    const sMatch = group.some(a => s.includes(a) || a.includes(s));
    if (qMatch && sMatch) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Grade normalization — converts "7", "٧", "سابع", "seventh", "7th" etc.
// to the canonical ordinal number (1–12) used to compare across stored values.
// ---------------------------------------------------------------------------
const GRADE_ARABIC_ORDINALS: Record<string, number> = {
  أول: 1, الأول: 1, "1st": 1, first: 1, "1": 1, "١": 1,
  ثاني: 2, الثاني: 2, "2nd": 2, second: 2, "2": 2, "٢": 2,
  ثالث: 3, الثالث: 3, "3rd": 3, third: 3, "3": 3, "٣": 3,
  رابع: 4, الرابع: 4, "4th": 4, fourth: 4, "4": 4, "٤": 4,
  خامس: 5, الخامس: 5, "5th": 5, fifth: 5, "5": 5, "٥": 5,
  سادس: 6, السادس: 6, "6th": 6, sixth: 6, "6": 6, "٦": 6,
  سابع: 7, السابع: 7, "7th": 7, seventh: 7, "7": 7, "٧": 7,
  ثامن: 8, الثامن: 8, "8th": 8, eighth: 8, "8": 8, "٨": 8,
  تاسع: 9, التاسع: 9, "9th": 9, ninth: 9, "9": 9, "٩": 9,
  عاشر: 10, العاشر: 10, "10th": 10, tenth: 10, "10": 10, "١٠": 10,
  "حادي عشر": 11, الحادي: 11, "11th": 11, eleventh: 11, "11": 11, "١١": 11,
  "ثاني عشر": 12, "12th": 12, twelfth: 12, "12": 12, "١٢": 12,
};

/** Extracts a grade number (1-12) from any string, or null if not recognised. */
function extractGradeNumber(value: string): number | null {
  if (!value) return null;
  const v = value.trim().toLowerCase()
    // strip common prefixes
    .replace(/^(الصف|صف|grade|gr\.?\s*)/i, "").trim();
  // Try direct Arabic-numeral conversion
  const westernized = v.replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const n = parseInt(westernized, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  // Try ordinal table
  for (const [key, num] of Object.entries(GRADE_ARABIC_ORDINALS)) {
    if (v.includes(key.toLowerCase()) || key.toLowerCase().includes(v)) return num;
  }
  return null;
}

/** Returns true if `stored` grade value matches the teacher's `query`. */
function gradeMatchesQuery(stored: string | null | undefined, query: string): boolean {
  if (!stored || !query.trim()) return true;
  const q = extractGradeNumber(query);
  const s = extractGradeNumber(stored);
  if (q !== null && s !== null) return q === s;
  // Fallback: plain substring
  return stored.toLowerCase().includes(query.trim().toLowerCase());
}

interface SharedAssignment {
  id: number;
  title: string;
  type: string;
  questionCount: number;
  isShared: boolean;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  createdAt: string;
  hiddenByAdmin?: boolean;
  hideReason?: string | null;
  subject?: string | null;
  targetClass?: string | null;
  targetClasses?: string[] | null;
  contentKind?: string | null;
}

interface SharedQuestion {
  id: number;
  text: string;
  subject: string | null;
  points: number;
  tags: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string | null;
  isShared: boolean;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  createdAt: string;
  hiddenByAdmin?: boolean;
}

interface SharedVideoLesson {
  id: number;
  title: string;
  subject: string | null;
  description: string | null;
  videoType: string;
  targetClass: string | null;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  isShared: boolean;
  createdAt: string;
  questionCount: number;
  hiddenByAdmin?: boolean;
}

export default function SharedContentPage({
  embedded,
  forceKind,
}: {
  embedded?: boolean;
  forceKind?: "homework" | "competition";
} = {}) {
  const { t, lang } = useI18n();
  const [path, setLocation] = useLocation();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;

  // The page now serves three URLs:
  //   /teacher/library/homework      → kind="homework" (مكتبة الأنشطة)
  //   /teacher/library/competitions  → kind="competition" (مكتبة المسابقات الجاهزة)
  //   /teacher/shared (legacy)       → kind=null (everything, both kinds)
  // In competition mode we hide the questions/videos tabs and only show
  // assignments tagged contentKind='competition'.
  const libraryKind: "homework" | "competition" | null = forceKind
    ? forceKind
    : path.endsWith("/library/competitions") ? "competition" :
      path.endsWith("/library/homework") ? "homework" : null;
  const isCompetitionLibrary = libraryKind === "competition";
  const isActivitiesLibrary = libraryKind === "homework";

  const AuthorBadge = ({ isAdminContent, teacherName }: { isAdminContent?: boolean; teacherName?: string | null }) => {
    if (isAdminContent) return null;
    return <span className="flex items-center gap-1"><User className="w-3 h-3" /> {teacherName}</span>;
  };
  const [activeTab, setActiveTab] = useState<Tab>("assignments");
  const [assignments, setAssignments] = useState<SharedAssignment[]>([]);
  const [questions, setQuestions] = useState<SharedQuestion[]>([]);
  const [videoLessons, setVideoLessons] = useState<SharedVideoLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importingIds, setImportingIds] = useState<Set<number>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const [importingQIds, setImportingQIds] = useState<Set<number>>(new Set());
  const [importingVIds, setImportingVIds] = useState<Set<number>>(new Set());
  const [importedVIds, setImportedVIds] = useState<Set<number>>(new Set());
  const [importedQIds, setImportedQIds] = useState<Set<number>>(new Set());
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [launchingIds, setLaunchingIds] = useState<Set<number>>(new Set());
  const [hidingIds, setHidingIds] = useState<Set<string>>(new Set());
  const [changingKindIds, setChangingKindIds] = useState<Set<number>>(new Set());
  const [currentTeacherId, setCurrentTeacherId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // Admin-only toggle: when ON, the page also fetches admin-hidden rows
  // so moderators can review and (un)hide them.
  const [showHidden, setShowHidden] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "questions">("newest");

  /** Sparse labels for مكتبة الأنشطة only — must run after `assignments` state exists. */
  const activitiesPopularIds = useMemo(() => {
    if (!isActivitiesLibrary) return new Set<number>();
    const ids = [...assignments]
      .filter((a) => !a.isAdminContent && !a.hiddenByAdmin && a.questionCount >= 10)
      .sort((a, b) => b.questionCount - a.questionCount)
      .slice(0, 2)
      .map((a) => a.id);
    return new Set(ids);
  }, [assignments, isActivitiesLibrary]);

  const activitiesNewIds = useMemo(() => {
    if (!isActivitiesLibrary) return new Set<number>();
    const windowMs = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const ids = [...assignments]
      .filter((a) => !a.isAdminContent && now - new Date(a.createdAt).getTime() < windowMs)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)
      .map((a) => a.id);
    return new Set(ids);
  }, [assignments, isActivitiesLibrary]);

  function activitiesAssignmentBadge(a: SharedAssignment): "featured" | "popular" | "new" | null {
    if (!isActivitiesLibrary) return null;
    if (a.isAdminContent) return "featured";
    if (activitiesPopularIds.has(a.id)) return "popular";
    if (activitiesNewIds.has(a.id)) return "new";
    return null;
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        if (!meRes.ok) { setLocation("/login"); return; }
        const meData = await meRes.json();
        setCurrentTeacherId(meData.id || null);
        setIsAdmin(!!meData.isAdmin);
        const params = new URLSearchParams();
        if (libraryKind) params.set("kind", libraryKind);
        if (showHidden && meData.isAdmin) params.set("showHidden", "1");
        const qs = params.toString();
        const aUrl = qs
          ? `${API_BASE}/api/assignments/shared?${qs}`
          : `${API_BASE}/api/assignments/shared`;
        // Competition library: assignments only — skip the (slower) bank
        // and video lookups entirely so the tab feels snappy.
        // Admin show-hidden mode applies to ALL shared endpoints, not just
        // assignments — so question-bank and video moderation works too.
        const adminShowHidden = showHidden && meData.isAdmin;
        const qbUrl = `${API_BASE}/api/question-bank/shared${adminShowHidden ? "?showHidden=1" : ""}`;
        const vidUrl = `${API_BASE}/api/video-lessons/shared/all${adminShowHidden ? "?showHidden=1" : ""}`;
        const fetches: Promise<Response>[] = [fetch(aUrl, { credentials: "include" })];
        if (!isCompetitionLibrary) {
          fetches.push(fetch(qbUrl, { credentials: "include" }));
          fetches.push(fetch(vidUrl, { credentials: "include" }));
        }
        const [aRes, qRes, vRes] = await Promise.all(fetches);
        if (aRes.ok) setAssignments(await aRes.json());
        if (!isCompetitionLibrary) {
          if (qRes && qRes.ok) setQuestions(await qRes.json());
          if (vRes && vRes.ok) setVideoLessons(await vRes.json());
        } else {
          setQuestions([]);
          setVideoLessons([]);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [libraryKind, isCompetitionLibrary, showHidden]);

  /** Admin-only: restore a previously hidden row. */
  const unhideAsAdmin = async (
    itemType: "assignments" | "question-bank" | "video-lessons",
    itemId: number,
  ) => {
    if (!isAdmin) return;
    const key = `${itemType}-${itemId}`;
    setHidingIds(prev => new Set(prev).add(key));
    try {
      const res = await fetch(`${API_BASE}/api/admin/${itemType}/${itemId}/unhide`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        if (itemType === "assignments") {
          setAssignments(prev => prev.map(a => a.id === itemId ? { ...a, hiddenByAdmin: false } : a));
        } else if (itemType === "question-bank") {
          setQuestions(prev => prev.map(q => q.id === itemId ? { ...q, hiddenByAdmin: false } : q));
        } else {
          setVideoLessons(prev => prev.map(v => v.id === itemId ? { ...v, hiddenByAdmin: false } : v));
        }
        toast.success(lang === "ar" ? "تم استعادة العنصر إلى المكتبة" : "Item restored to library");
      } else {
        toast.error(lang === "ar" ? "تعذّر الاستعادة" : "Failed to restore");
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setHidingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  /** Admin-only: hide a row from the public library. */
  const hideAsAdmin = async (
    itemType: "assignments" | "question-bank" | "video-lessons",
    itemId: number,
  ) => {
    if (!isAdmin) return;
    const reason = window.prompt(lang === "ar"
      ? "سبب الإخفاء (اختياري):"
      : "Reason for hiding (optional):");
    if (reason === null) return; // user cancelled
    const key = `${itemType}-${itemId}`;
    setHidingIds(prev => new Set(prev).add(key));
    try {
      const res = await fetch(`${API_BASE}/api/admin/${itemType}/${itemId}/hide`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      if (res.ok) {
        // When the moderator is browsing in "show hidden" mode we keep
        // the row in place and just flip its flag, so they can still see
        // (and potentially unhide) what they just hid. Otherwise we drop
        // it from the list to mirror the public view.
        if (showHidden) {
          if (itemType === "assignments") setAssignments(prev => prev.map(a => a.id === itemId ? { ...a, hiddenByAdmin: true } : a));
          else if (itemType === "question-bank") setQuestions(prev => prev.map(q => q.id === itemId ? { ...q, hiddenByAdmin: true } : q));
          else setVideoLessons(prev => prev.map(v => v.id === itemId ? { ...v, hiddenByAdmin: true } : v));
        } else if (itemType === "assignments") setAssignments(prev => prev.filter(a => a.id !== itemId));
        else if (itemType === "question-bank") setQuestions(prev => prev.filter(q => q.id !== itemId));
        else setVideoLessons(prev => prev.filter(v => v.id !== itemId));
        toast.success(lang === "ar" ? "تم إخفاء العنصر من المكتبة" : "Item hidden from library");
      } else {
        toast.error(lang === "ar" ? "تعذّر الإخفاء" : "Failed to hide");
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setHidingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  /** Admin-only: change the library classification of a shared assignment. */
  const changeLibraryKind = async (assignmentId: number, newKind: "homework" | "competition" | "both") => {
    if (!isAdmin) return;
    setChangingKindIds(prev => new Set(prev).add(assignmentId));
    try {
      const res = await fetch(`${API_BASE}/api/admin/assignments/${assignmentId}/content-kind`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentKind: newKind }),
      });
      if (res.ok) {
        setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, contentKind: newKind } : a));
        const kindLabel = newKind === "both"
          ? (lang === "ar" ? "كلتا المكتبتين" : "both libraries")
          : newKind === "competition"
            ? (lang === "ar" ? "مكتبة المسابقات" : "Competitions Library")
            : (lang === "ar" ? "مكتبة الأنشطة" : "Activities Library");
        toast.success(lang === "ar" ? `تم نقله إلى ${kindLabel}` : `Moved to ${kindLabel}`);
      } else {
        toast.error(lang === "ar" ? "تعذّر التغيير" : "Failed to change");
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setChangingKindIds(prev => { const s = new Set(prev); s.delete(assignmentId); return s; });
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(lang === "ar" ? "ar-KW" : "en-US", { year: "numeric", month: "short", day: "numeric" });

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      mcq: lang === "ar" ? "اختيار من متعدد" : "MCQ",
      true_false: lang === "ar" ? "صح وخطأ" : "True/False",
      fill_blank: lang === "ar" ? "إكمال الفراغ" : "Fill in the blank",
      whiteboard: lang === "ar" ? "سبورة" : "Whiteboard",
      mixed: lang === "ar" ? "مختلط" : "Mixed",
    };
    return map[type] || type;
  };

  // Wameedh ("وميض") is the default live-quiz launcher — gameMode="classic"
  // resolves to the standard solo flow on the server. Teams mode is exposed
  // as a non-prominent secondary option per row so the organizer can switch
  // without leaving the library.
  // No class is pre-selected by default — the teacher can assign one from
  // the game lobby if needed. Class preferences are NOT stored on the shared
  // assignment so each teacher manages their own context locally.
  const launchAsGame = (id: number, gameMode: "classic" | "teams" = "classic") => {
    setLaunchingIds((s) => new Set(s).add(id));
    const socket = getSocket();
    socket.emit(
      "teacher:create-game",
      { assignmentId: id, gameMode, targetClass: undefined },
      (res: { pin?: string; error?: string }) => {
        setLaunchingIds((s) => { const n = new Set(s); n.delete(id); return n; });
        if (res?.error || !res?.pin) {
          toast.error(res?.error || (lang === "ar" ? "تعذّر بدء المسابقة" : "Failed to start"));
          disconnectSocket();
          return;
        }
        setLocation(`/teacher/game/${res.pin}`);
      },
    );
  };

  const copyLink = (id: number) => {
    navigator.clipboard.writeText(`${window.location.origin}/solve/${id}`);
    toast.success(t.sharedContent.linkCopied);
  };

  const importAssignment = async (id: number) => {
    setImportingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`${API_BASE}/api/assignments/${id}/import`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setImportedIds(prev => new Set(prev).add(id));
        toast.success(t.sharedContent.importedAssignment);
      } else {
        toast.error(data.message || (lang === "ar" ? "خطأ في الاستيراد" : "Import failed"));
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setImportingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const importQuestion = async (id: number) => {
    setImportingQIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`${API_BASE}/api/question-bank/${id}/import`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setImportedQIds(prev => new Set(prev).add(id));
        toast.success(t.sharedContent.importedQuestion);
      } else {
        toast.error(data.message || (lang === "ar" ? "خطأ في الاستيراد" : "Import failed"));
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setImportingQIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const importVideoLesson = async (id: number) => {
    setImportingVIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`${API_BASE}/api/video-lessons/${id}/import`, {
        method: "POST", credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setImportedVIds(prev => new Set(prev).add(id));
        toast.success(lang === "ar" ? "تم استيراد الدرس بنجاح" : "Lesson imported successfully");
      } else {
        toast.error(data.message || (lang === "ar" ? "خطأ في الاستيراد" : "Import failed"));
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setImportingVIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const dismissItem = async (itemType: "assignment" | "question" | "game", itemId: number) => {
    const key = `${itemType}-${itemId}`;
    setDismissingIds(prev => new Set(prev).add(key));
    try {
      const res = await fetch(`${API_BASE}/api/shared/dismiss`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, itemId }),
      });
      if (res.ok) {
        if (itemType === "assignment") setAssignments(prev => prev.filter(a => a.id !== itemId));
        else if (itemType === "question") setQuestions(prev => prev.filter(q => q.id !== itemId));
        else setVideoLessons(prev => prev.filter(g => g.id !== itemId));
        toast.success(lang === "ar" ? "تم إخفاء العنصر من قائمتك" : "Item removed from your list");
      } else {
        toast.error(lang === "ar" ? "خطأ في الإخفاء" : "Failed to remove");
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاتصال" : "Connection error");
    } finally {
      setDismissingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const allSubjects = Array.from(new Set([
    ...assignments.map(a => a.subject).filter(Boolean),
    ...questions.map(q => q.subject).filter(Boolean),
    ...videoLessons.map(v => v.subject).filter(Boolean),
  ])).sort() as string[];

  const allGrades = Array.from(new Set([
    ...assignments.map(a => a.targetClass).filter(Boolean),
    ...videoLessons.map(v => v.targetClass).filter(Boolean),
  ])).sort((a, b) => {
    const na = extractGradeNumber(a as string) ?? 999;
    const nb = extractGradeNumber(b as string) ?? 999;
    return na - nb;
  }) as string[];

  // Subject fuzzy filter: if the teacher typed something in the subject
  // search box it should also match via alias groups (e.g. "عربي" → arabic).
  // When subjectFilter is selected from the dropdown it uses exact match for
  // precision; the text search is the fuzzy path.
  const matchesSubject = (subject: string | null | undefined) => {
    if (!subjectFilter) return true;
    // Exact match (dropdown selection path)
    if (subject === subjectFilter) return true;
    // Fuzzy match (typed alias path)
    return subjectMatchesQuery(subject, subjectFilter);
  };

  const filteredAssignments = assignments
    .filter(a =>
      (!search || a.title.includes(search) || a.teacherName?.includes(search)) &&
      matchesSubject(a.subject) &&
      (!gradeFilter || gradeMatchesQuery(a.targetClass, gradeFilter) ||
        (a.targetClasses || []).some(tc => gradeMatchesQuery(tc, gradeFilter)))
    )
    .sort((a, b) => sortBy === "questions"
      ? (b.questionCount - a.questionCount)
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredQuestions = questions
    .filter(q =>
      (!search || (q.text || "").includes(search) || q.teacherName?.includes(search) || subjectMatchesQuery(q.subject, search)) &&
      matchesSubject(q.subject)
    )
    .sort((a, b) => sortBy === "questions"
      ? (b.points - a.points)
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (loading) {
    const spinner = (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
    return embedded ? spinner : <Layout>{spinner}</Layout>;
  }

  const inner = (
    <div
      className={cn(
        embedded ? "py-4" : "container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-5xl",
        isActivitiesLibrary &&
          !embedded &&
          "rounded-2xl border border-border/40 bg-gradient-to-b from-primary/[0.04] via-background to-muted/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
      )}
      dir={dir}
    >
      {!embedded && (
        <Link href="/teacher" className="text-primary hover:underline font-bold flex items-center gap-1 mb-6 w-fit">
          <BackArrow className="w-4 h-4" />
          {t.sharedContent.backToDashboard}
        </Link>
      )}

        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6",
            isActivitiesLibrary &&
              "rounded-2xl border border-border/35 bg-gradient-to-r from-teal-500/[0.07] via-card/60 to-background/90 px-4 py-4 sm:px-5 sm:py-4 shadow-sm",
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
              isActivitiesLibrary && "ring-2 ring-primary/10 shadow-md",
            )}
            style={{
              background: isCompetitionLibrary
                ? "linear-gradient(135deg,#f59e0b,#ea580c)"
                : "linear-gradient(135deg,#06b6d4,#0d9488)",
            }}
          >
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {libraryKind === "competition"
                ? (lang === "ar" ? "مكتبة المسابقات الجاهزة" : "Competitions Library")
                : libraryKind === "homework"
                ? (lang === "ar" ? "مكتبة الأنشطة" : "Activities Library")
                : t.sharedContent.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
              {libraryKind === "competition"
                ? (lang === "ar"
                    ? "تصفح وشغّل مسابقات جاهزة شاركها معلمون آخرون"
                    : "Browse ready-to-play competitions shared by other teachers")
                : libraryKind === "homework"
                ? (lang === "ar"
                    ? "استورد إلى حسابك أو شغّل مباشرة — صُممت للفصل دون تعقيد."
                    : "Import to your account or play live — built for class flow without clutter.")
                : t.sharedContent.subtitle}
            </p>
          </div>
          </div>
          {isActivitiesLibrary && (
            <Link href="/teacher/new">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 font-semibold border-primary/25 bg-background/85 hover:bg-background shadow-none shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {lang === "ar" ? "شارك نشاطاً" : "Share activity"}
              </Button>
            </Link>
          )}
        </div>

        <div
          className={cn(
            isActivitiesLibrary &&
              "rounded-xl border border-border/45 bg-muted/[0.06] p-3 sm:p-4 mb-5 space-y-3 shadow-sm",
          )}
        >
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border pb-0",
            isActivitiesLibrary ? "border-border/55 mb-0" : "mb-6",
          )}
        >
          {([
            { key: "assignments" as Tab, label: t.sharedContent.tabAssignments, icon: BookText, count: assignments.length },
            // Competition library: only show the assignments tab —
            // question-bank and video lessons live in the activities library.
            ...(isCompetitionLibrary ? [] : [
              { key: "questions" as Tab, label: t.sharedContent.tabQuestions, icon: HelpCircle, count: questions.length },
              { key: "videos" as Tab, label: lang === "ar" ? "دروس فيديو" : "Video Lessons", icon: Video, count: videoLessons.length },
            ]),
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(""); }}
              className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all -mb-px ${
                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className="text-xs bg-muted/60 px-1.5 py-0.5 rounded-full">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className={cn("flex flex-wrap items-center gap-2 mb-4", isActivitiesLibrary && "mb-0 pt-0.5")}>
          {/* ── Title / teacher search ── */}
          <div className="relative flex-1 min-w-48">
            <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.sharedContent.searchPlaceholder} className={lang === "ar" ? "pr-10" : "pl-10"} />
          </div>
          {/* ── Subject filter (supports fuzzy aliases via subjectMatchesQuery) ── */}
          <div className="relative min-w-36">
            <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none`} />
            <Input
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              placeholder={lang === "ar" ? "ابحث في المادة…" : "Subject…"}
              list="subject-datalist"
              className={`text-sm ${lang === "ar" ? "pr-8" : "pl-8"}`}
            />
            <datalist id="subject-datalist">
              {allSubjects.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          {/* ── Grade filter ── */}
          <div className="relative min-w-36">
            <GraduationCap className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none`} />
            <Input
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              placeholder={lang === "ar" ? "الصف (7، سابع…)" : "Grade (7, 7th…)"}
              list="grade-datalist"
              className={`text-sm ${lang === "ar" ? "pr-8" : "pl-8"}`}
            />
            <datalist id="grade-datalist">
              {allGrades.map(g => <option key={g} value={g} />)}
            </datalist>
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as "newest" | "questions")}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="newest">{lang === "ar" ? "الأحدث" : "Newest"}</option>
            <option value="questions">{lang === "ar" ? "الأكثر أسئلة" : "Most Questions"}</option>
          </select>
          {(search || subjectFilter || gradeFilter) && (
            <button
              onClick={() => { setSearch(""); setSubjectFilter(""); setGradeFilter(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
            </button>
          )}
          {isAdmin && (
            <label
              className={`inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border cursor-pointer transition-colors ${showHidden ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
              title={lang === "ar" ? "إظهار العناصر المخفية (مشرف)" : "Show hidden items (admin)"}
            >
              <input
                type="checkbox"
                checked={showHidden}
                onChange={e => setShowHidden(e.target.checked)}
                className="accent-amber-600"
              />
              <EyeOff className="w-3.5 h-3.5" />
              {lang === "ar" ? "عرض المخفي" : "Show hidden"}
            </label>
          )}
        </div>
        </div>

        {/* Competitions library is intentionally a question-bank only —
            no quick-launch game cards. Each competition row gets its own
            "إلعبها الآن" button below (default = Wameedh). */}

        {activeTab === "assignments" && (
          filteredAssignments.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredAssignments.map((a, i) => {
                // Subtle top-bar accent per question type (no labels shown)
                const barColor =
                  a.type === "mcq"        ? "#3b82f6" :
                  a.type === "true_false" ? "#f59e0b" :
                  a.type === "fill_blank" ? "#8b5cf6" :
                                           "#14b8a6";
                const isOwn = a.teacherId === currentTeacherId;
                const libBadge = isActivitiesLibrary ? activitiesAssignmentBadge(a) : null;
                return (
                <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.025, 0.25) }} className="h-full">
                  <div
                    className={cn(
                      "group relative flex flex-col rounded-2xl border bg-card h-full overflow-hidden",
                      a.hiddenByAdmin
                        ? "opacity-55 border-dashed border-amber-400 transition-all duration-200"
                        : isActivitiesLibrary
                          ? "border-border/55 bg-gradient-to-br from-card via-card to-muted/[0.35] shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-primary/22 hover:shadow-[0_14px_28px_-12px_rgba(15,118,110,0.12)] hover:-translate-y-1"
                          : "border-border/60 transition-all duration-200 hover:border-border hover:shadow-md hover:-translate-y-0.5",
                    )}
                    style={{ borderTop: `3px solid ${barColor}` }}
                  >
                    {libBadge && (
                      <span
                        className={cn(
                          "pointer-events-none absolute top-2 z-[1] max-w-[min(7rem,42%)] truncate rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide backdrop-blur-[2px]",
                          lang === "ar" ? "left-2" : "right-2",
                          libBadge === "featured" &&
                            "border-amber-400/40 bg-amber-500/[0.11] text-amber-950 dark:text-amber-50",
                          libBadge === "popular" &&
                            "border-emerald-400/35 bg-emerald-600/[0.07] text-emerald-950 dark:text-emerald-50",
                          libBadge === "new" &&
                            "border-sky-400/35 bg-sky-500/[0.09] text-sky-950 dark:text-sky-50",
                        )}
                      >
                        {libBadge === "featured" && (lang === "ar" ? "مميز" : "Featured")}
                        {libBadge === "popular" && (lang === "ar" ? "الأكثر استخدامًا" : "Popular")}
                        {libBadge === "new" && (lang === "ar" ? "جديد" : "New")}
                      </span>
                    )}
                    <div className="flex flex-col flex-1 p-3.5 gap-3">
                      {/* Title — clipped at 2 lines */}
                      <p
                        className={cn(
                          "font-black text-[13px] text-foreground leading-snug line-clamp-2 flex-1 min-h-[2.5rem]",
                          libBadge && (lang === "ar" ? "ps-[4.25rem]" : "pe-[4.25rem]"),
                        )}
                      >
                        {a.title}
                      </p>

                      {/* Meta chips: question count + subject */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                          <HelpCircle className="w-2.5 h-2.5" />
                          {a.questionCount} {lang === "ar" ? "سؤال" : "Q"}
                        </span>
                        {a.subject && (
                          <span className="inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/8 text-primary/80 border border-primary/20 max-w-[90px] truncate">
                            {a.subject}
                          </span>
                        )}
                        {a.hiddenByAdmin && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <EyeOff className="w-2.5 h-2.5" />{lang === "ar" ? "مخفي" : "Hidden"}
                          </span>
                        )}
                      </div>

                      {/* Action row */}
                      <div className="flex items-center gap-1.5 mt-auto">
                        {isOwn ? (
                          <span className="flex items-center justify-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-bold border border-teal-200 dark:border-teal-800 w-full">
                            <CheckCircle2 className="w-3 h-3" />
                            {lang === "ar" ? "محتواك" : "Yours"}
                          </span>
                        ) : (
                          <>
                            {/* PRIMARY: Play — Hasad dark green */}
                            <button
                              onClick={() => launchAsGame(a.id, "classic")}
                              disabled={launchingIds.has(a.id) || a.questionCount === 0}
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-extrabold px-3 py-2 rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 hover:-translate-y-0.5"
                              style={{
                                background: "linear-gradient(135deg,#1f8246 0%,#155d32 100%)",
                                boxShadow: "0 4px 12px -4px rgba(27,107,63,0.50)",
                              }}
                            >
                              {launchingIds.has(a.id)
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <><Zap className="w-3.5 h-3.5" />{lang === "ar" ? "ابدأ" : "Play"}</>
                              }
                            </button>

                            {/* SECONDARY overflow menu */}
                            <div className="relative group/menu">
                              <button
                                type="button"
                                className="w-7 h-7 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              <div className={`absolute z-30 top-full mt-1 ${lang === "ar" ? "left-0" : "right-0"} hidden group-hover/menu:flex flex-col min-w-[190px] rounded-2xl border border-border bg-popover shadow-xl overflow-hidden py-1`}>
                                <button
                                  onClick={() => importAssignment(a.id)}
                                  disabled={importingIds.has(a.id) || importedIds.has(a.id)}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50 text-start w-full"
                                >
                                  {importedIds.has(a.id)
                                    ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{lang === "ar" ? "تم الاستيراد" : "Imported"}</>
                                    : importingIds.has(a.id)
                                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{lang === "ar" ? "جارٍ الاستيراد…" : "Importing…"}</>
                                      : <><Download className="w-3.5 h-3.5 text-primary" />{t.sharedContent.importAssignment}</>
                                  }
                                </button>
                                <button
                                  onClick={() => copyLink(a.id)}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors text-start w-full"
                                >
                                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                  {isCompetitionLibrary ? t.sharedContent.copyLink : (lang === "ar" ? "نسخ الرابط كواجب" : "Copy as assignment")}
                                </button>
                                <button
                                  onClick={() => launchAsGame(a.id, "teams")}
                                  disabled={launchingIds.has(a.id) || a.questionCount === 0}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors text-start w-full disabled:opacity-40"
                                >
                                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                  {lang === "ar" ? "ابدأ بوضع الفِرَق" : "Play in Teams mode"}
                                </button>
                                <div className="h-px bg-border/60 mx-3 my-1" />
                                <button
                                  onClick={() => dismissItem("assignment", a.id)}
                                  disabled={dismissingIds.has(`assignment-${a.id}`)}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold hover:bg-destructive/8 text-destructive/70 hover:text-destructive transition-colors text-start w-full disabled:opacity-40"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  {lang === "ar" ? "إخفاء من قائمتي" : "Remove from my list"}
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Admin controls — shown on card hover */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="relative group/lib">
                              <button
                                type="button"
                                disabled={changingKindIds.has(a.id)}
                                title={lang === "ar" ? "تغيير المكتبة" : "Change library"}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 transition-colors disabled:opacity-40"
                              >
                                {changingKindIds.has(a.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
                              </button>
                              <div className={`absolute z-30 top-full mt-1 ${lang === "ar" ? "left-0" : "right-0"} hidden group-hover/lib:flex flex-col min-w-[190px] rounded-2xl border border-border bg-popover shadow-xl overflow-hidden py-1`}>
                                {([ { value: "homework" as const, labelAr: "مكتبة الأنشطة", cls: "text-blue-600" }, { value: "competition" as const, labelAr: "مكتبة المسابقات", cls: "text-amber-600" }, { value: "both" as const, labelAr: "كلتا المكتبتين", cls: "text-violet-600" } ]).map(opt => (
                                  <button key={opt.value} type="button" onClick={() => changeLibraryKind(a.id, opt.value)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold hover:bg-muted transition-colors text-start w-full ${opt.cls} ${a.contentKind === opt.value ? "bg-muted/60 font-bold" : ""}`}>
                                    {a.contentKind === opt.value && <CheckCircle2 className="w-3 h-3" />}
                                    {lang === "ar" ? opt.labelAr : opt.value === "both" ? "Both libraries" : opt.value === "competition" ? "Competitions" : "Activities"}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {a.hiddenByAdmin ? (
                              <button onClick={() => unhideAsAdmin("assignments", a.id)} disabled={hidingIds.has(`assignments-${a.id}`)}
                                title={lang === "ar" ? "إعادة الإظهار" : "Restore"}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 transition-colors disabled:opacity-40">
                                {hidingIds.has(`assignments-${a.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                              </button>
                            ) : (
                              <button onClick={() => hideAsAdmin("assignments", a.id)} disabled={hidingIds.has(`assignments-${a.id}`)}
                                title={lang === "ar" ? "إخفاء من المكتبة" : "Hide from library"}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-200 transition-colors disabled:opacity-40">
                                {hidingIds.has(`assignments-${a.id}`) ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
              })}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <BookText className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <h3 className="text-base font-bold text-foreground">{lang === "ar" ? "لا توجد واجبات مشتركة" : "No shared assignments"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "لم يشارك أي معلم واجباته بعد" : "No teachers have shared their assignments yet"}</p>
            </div>
          )
        )}

        {activeTab === "videos" && (
          videoLessons.length > 0 ? (
            <div className="grid gap-2.5">
              {videoLessons
                .filter(v =>
                  (!search || v.title.includes(search) || v.teacherName?.includes(search)) &&
                  matchesSubject(v.subject) &&
                  (!gradeFilter || gradeMatchesQuery(v.targetClass, gradeFilter))
                )
                .map((v, i) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.025, 0.25) }}>
                  <div className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl border bg-card hover:shadow-sm transition-all duration-150 ${v.hiddenByAdmin ? "opacity-55 border-dashed border-amber-400" : "border-border/60 hover:border-border"}`}>
                    {/* Video icon */}
                    <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
                      <Video className="w-4.5 h-4.5 text-red-500" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground leading-snug truncate mb-1.5">{v.title}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                          <Play className="w-2.5 h-2.5" />{v.questionCount} {lang === "ar" ? "سؤال" : "Q"}
                        </span>
                        {v.subject && <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800">{v.subject}</span>}
                        {v.targetClass && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground"><GraduationCap className="w-2.5 h-2.5" />{v.targetClass}</span>}
                        {!v.isAdminContent && v.teacherName && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70"><User className="w-2.5 h-2.5" />{v.teacherName}</span>}
                        {v.hiddenByAdmin && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><EyeOff className="w-2.5 h-2.5" />{lang === "ar" ? "مخفي" : "Hidden"}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {v.teacherId === currentTeacherId ? (
                        <span className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 font-bold border border-teal-200">
                          <CheckCircle2 className="w-3 h-3" />{lang === "ar" ? "محتواك" : "Yours"}
                        </span>
                      ) : importedVIds.has(v.id) ? (
                        <span className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-green-50 text-green-600 font-bold border border-green-200">
                          <CheckCircle2 className="w-3 h-3" />{lang === "ar" ? "تم" : "Imported"}
                        </span>
                      ) : (
                        <button
                          onClick={() => importVideoLesson(v.id)}
                          disabled={importingVIds.has(v.id)}
                          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground transition-all disabled:opacity-40"
                        >
                          {importingVIds.has(v.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          {lang === "ar" ? "استيراد" : "Import"}
                        </button>
                      )}
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {v.hiddenByAdmin ? (
                            <button onClick={() => unhideAsAdmin("video-lessons", v.id)} disabled={hidingIds.has(`video-lessons-${v.id}`)}
                              title={lang === "ar" ? "إعادة الإظهار" : "Restore"}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-colors disabled:opacity-40">
                              {hidingIds.has(`video-lessons-${v.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <button onClick={() => hideAsAdmin("video-lessons", v.id)} disabled={hidingIds.has(`video-lessons-${v.id}`)}
                              title={lang === "ar" ? "إخفاء" : "Hide"}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 border border-amber-200 transition-colors disabled:opacity-40">
                              {hidingIds.has(`video-lessons-${v.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Video className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <h3 className="text-base font-bold text-foreground">{lang === "ar" ? "لا توجد دروس فيديو مشتركة" : "No shared video lessons"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "لم يشارك أي معلم دروسه بعد" : "No teachers have shared their video lessons yet"}</p>
            </div>
          )
        )}

        {activeTab === "questions" && (
          filteredQuestions.length > 0 ? (
            <div className="grid gap-2.5">
              {filteredQuestions.map((q, i) => (
                <motion.div key={q.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.025, 0.25) }}>
                  <div className={`group flex items-start gap-3 px-4 py-3.5 rounded-2xl border bg-card hover:shadow-sm transition-all duration-150 ${q.hiddenByAdmin ? "opacity-55 border-dashed border-amber-400" : "border-border/60 hover:border-border"}`}>
                    {/* Icon */}
                    <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 mt-0.5">
                      <HelpCircle className="w-4.5 h-4.5 text-indigo-500" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground leading-snug mb-1.5 line-clamp-2">{q.text}</p>
                      {/* Answer options (compact) */}
                      {(q.optionA || q.optionB) && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-2">
                          {q.optionA && <span className={`text-[11px] ${q.correctAnswer === "A" ? "text-green-600 font-bold" : "text-muted-foreground"}`}>أ) {q.optionA}</span>}
                          {q.optionB && <span className={`text-[11px] ${q.correctAnswer === "B" ? "text-green-600 font-bold" : "text-muted-foreground"}`}>ب) {q.optionB}</span>}
                          {q.optionC && <span className={`text-[11px] ${q.correctAnswer === "C" ? "text-green-600 font-bold" : "text-muted-foreground"}`}>ج) {q.optionC}</span>}
                          {q.optionD && <span className={`text-[11px] ${q.correctAnswer === "D" ? "text-green-600 font-bold" : "text-muted-foreground"}`}>د) {q.optionD}</span>}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {q.subject && <span className="inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border border-indigo-200 dark:border-indigo-800">{q.subject}</span>}
                        <span className="inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{q.points} {lang === "ar" ? "درجة" : "pts"}</span>
                        {!q.isAdminContent && q.teacherName && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70"><User className="w-2.5 h-2.5" />{q.teacherName}</span>}
                        {q.hiddenByAdmin && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full"><EyeOff className="w-2.5 h-2.5" />{lang === "ar" ? "مخفي" : "Hidden"}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {q.teacherId === currentTeacherId ? (
                        <span className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 font-bold border border-teal-200">
                          <CheckCircle2 className="w-3 h-3" />{lang === "ar" ? "محتواك" : "Yours"}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => importQuestion(q.id)}
                            disabled={importingQIds.has(q.id) || importedQIds.has(q.id)}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all disabled:opacity-40 border ${
                              importedQIds.has(q.id)
                                ? "bg-green-50 border-green-200 text-green-600"
                                : "bg-primary border-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                            }`}
                          >
                            {importingQIds.has(q.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : importedQIds.has(q.id) ? <CheckCircle2 className="w-3.5 h-3.5" />
                              : <Download className="w-3.5 h-3.5" />}
                            {importedQIds.has(q.id) ? (lang === "ar" ? "تم" : "Done") : (lang === "ar" ? "استيراد" : "Import")}
                          </button>
                          <button
                            onClick={() => dismissItem("question", q.id)}
                            disabled={dismissingIds.has(`question-${q.id}`)}
                            title={lang === "ar" ? "إخفاء من قائمتي" : "Remove from my list"}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors disabled:opacity-40"
                          >
                            {dismissingIds.has(`question-${q.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {q.hiddenByAdmin ? (
                            <button onClick={() => unhideAsAdmin("question-bank", q.id)} disabled={hidingIds.has(`question-bank-${q.id}`)}
                              title={lang === "ar" ? "إعادة الإظهار" : "Restore"}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition-colors disabled:opacity-40">
                              {hidingIds.has(`question-bank-${q.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <button onClick={() => hideAsAdmin("question-bank", q.id)} disabled={hidingIds.has(`question-bank-${q.id}`)}
                              title={lang === "ar" ? "إخفاء" : "Hide"}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 border border-amber-200 transition-colors disabled:opacity-40">
                              {hidingIds.has(`question-bank-${q.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-7 h-7 text-muted-foreground/30" />
              </div>
              <h3 className="text-base font-bold text-foreground">{lang === "ar" ? "لا توجد أسئلة مشتركة" : "No shared questions"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "لم يشارك أي معلم أسئلته بعد" : "No teachers have shared their questions yet"}</p>
            </div>
          )
        )}

      </div>
  );

  return embedded ? inner : <Layout>{inner}</Layout>;
}
