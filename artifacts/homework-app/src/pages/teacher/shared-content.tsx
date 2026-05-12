import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, ArrowLeft, BookText, HelpCircle, Globe,
  Search, User, Calendar, Copy, Download, Loader2, CheckCircle2, X, Video, Play, GraduationCap,
  Gamepad2, EyeOff, FolderOpen,
} from "lucide-react";
import { Card, Button, Input } from "@/components/ui-elements";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { getSocket, disconnectSocket } from "@/lib/socket";

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

export default function SharedContentPage() {
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
  const libraryKind: "homework" | "competition" | null =
    path.endsWith("/library/competitions") ? "competition" :
    path.endsWith("/library/homework") ? "homework" : null;
  const isCompetitionLibrary = libraryKind === "competition";

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
  const launchAsGame = (id: number, gameMode: "classic" | "teams" = "classic") => {
    setLaunchingIds((s) => new Set(s).add(id));
    const socket = getSocket();
    let remembered = "";
    try { remembered = localStorage.getItem("hasad:lastTargetClass") || ""; } catch {}
    socket.emit(
      "teacher:create-game",
      { assignmentId: id, gameMode, targetClass: remembered || undefined },
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

  if (loading) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-5xl" dir={dir}>
        <Link href="/teacher" className="text-primary hover:underline font-bold flex items-center gap-1 mb-6 w-fit">
          <BackArrow className="w-4 h-4" />
          {t.sharedContent.backToDashboard}
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              background: isCompetitionLibrary
                ? "linear-gradient(135deg,#f59e0b,#ea580c)"
                : "linear-gradient(135deg,#06b6d4,#0d9488)",
            }}
          >
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {libraryKind === "competition"
                ? (lang === "ar" ? "مكتبة المسابقات الجاهزة" : "Competitions Library")
                : libraryKind === "homework"
                ? (lang === "ar" ? "مكتبة الأنشطة" : "Activities Library")
                : t.sharedContent.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {libraryKind === "competition"
                ? (lang === "ar"
                    ? "تصفح وشغّل مسابقات جاهزة شاركها معلمون آخرون"
                    : "Browse ready-to-play competitions shared by other teachers")
                : libraryKind === "homework"
                ? (lang === "ar"
                    ? "تصفح أنشطة وأسئلة وفيديوهات جاهزة من معلمين آخرين"
                    : "Browse activities, questions and videos shared by other teachers")
                : t.sharedContent.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 border-b border-border pb-0">
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

        <div className="flex flex-wrap items-center gap-2 mb-4">
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

        {/* Competitions library is intentionally a question-bank only —
            no quick-launch game cards. Each competition row gets its own
            "إلعبها الآن" button below (default = Wameedh). */}

        {activeTab === "assignments" && (
          filteredAssignments.length > 0 ? (
            <div className="grid gap-3">
              {filteredAssignments.map((a, i) => (
                <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                  <Card className={`p-4 hover:shadow-md transition-shadow ${a.hiddenByAdmin ? "opacity-60 grayscale border-amber-400 border-dashed" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground mb-1">{a.title}</h3>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <AuthorBadge isAdminContent={a.isAdminContent} teacherName={a.teacherName} />
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-bold">{typeLabel(a.type)}</span>
                          <span>{a.questionCount} {lang === "ar" ? "سؤال" : "Q"}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(a.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {a.teacherId === currentTeacherId ? (
                          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-700">
                            <CheckCircle2 className="w-3 h-3" />
                            {lang === "ar" ? "محتواك · مشارك" : "Your content · Shared"}
                          </span>
                        ) : (
                          <>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => launchAsGame(a.id, "classic")}
                                disabled={launchingIds.has(a.id) || a.questionCount === 0}
                                title={a.questionCount === 0 ? (lang === "ar" ? "لا توجد أسئلة" : "No questions") : (lang === "ar" ? "ابدأ المسابقة بلعبة وميض" : "Launch live with Wameedh")}
                                className="flex items-center gap-1 text-xs py-1.5 px-3 rounded-lg font-bold transition-all border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {launchingIds.has(a.id) ? (
                                  <><Loader2 className="w-3 h-3 animate-spin" />{lang === "ar" ? "جارٍ البدء..." : "Starting..."}</>
                                ) : (
                                  <><Gamepad2 className="w-3 h-3" />{lang === "ar" ? "إلعبها الآن · وميض" : "Play now · Wameedh"}</>
                                )}
                              </button>
                              {/* Subtle "switch game" affordance — defaults to
                                  Wameedh; teachers can pick teams mode when
                                  they want a different format. */}
                              <details className="relative">
                                <summary
                                  className="cursor-pointer list-none text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 px-1 py-1.5 select-none"
                                  title={lang === "ar" ? "تغيير اللعبة" : "Change game"}
                                >
                                  {lang === "ar" ? "تغيير اللعبة" : "Change game"}
                                </summary>
                                <div className={`absolute z-20 mt-1 ${lang === "ar" ? "left-0" : "right-0"} min-w-[160px] rounded-lg border border-border bg-popover shadow-lg p-1 text-xs`}>
                                  <button
                                    onClick={() => launchAsGame(a.id, "classic")}
                                    disabled={launchingIds.has(a.id) || a.questionCount === 0}
                                    className="w-full text-start px-2 py-1.5 rounded hover:bg-muted disabled:opacity-40"
                                  >
                                    {lang === "ar" ? "وميض (افتراضي)" : "Wameedh (default)"}
                                  </button>
                                  <button
                                    onClick={() => launchAsGame(a.id, "teams")}
                                    disabled={launchingIds.has(a.id) || a.questionCount === 0}
                                    className="w-full text-start px-2 py-1.5 rounded hover:bg-muted disabled:opacity-40"
                                  >
                                    {lang === "ar" ? "وضع الفِرَق" : "Teams mode"}
                                  </button>
                                </div>
                              </details>
                            </div>
                            <Button variant="outline" onClick={() => copyLink(a.id)} className="gap-1 text-xs py-1.5 px-3 h-auto">
                              <Copy className="w-3 h-3" />
                              {isCompetitionLibrary
                                ? t.sharedContent.copyLink
                                : (lang === "ar" ? "نسخ الرابط كواجب" : "Copy as assignment")}
                            </Button>
                            <button
                              onClick={() => importAssignment(a.id)}
                              disabled={importingIds.has(a.id) || importedIds.has(a.id)}
                              className={`flex items-center gap-1 text-xs py-1.5 px-3 rounded-lg font-bold transition-all border ${
                                importedIds.has(a.id)
                                  ? "border-green-400 bg-green-50 text-green-700 dark:bg-green-900/20"
                                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                              } disabled:opacity-60`}
                            >
                              {importingIds.has(a.id) ? (
                                <><Loader2 className="w-3 h-3 animate-spin" />{t.sharedContent.importing}</>
                              ) : importedIds.has(a.id) ? (
                                <><CheckCircle2 className="w-3 h-3" />{lang === "ar" ? "تم" : "Done"}</>
                              ) : (
                                <><Download className="w-3 h-3" />{t.sharedContent.importAssignment}</>
                              )}
                            </button>
                            <button
                              onClick={() => dismissItem("assignment", a.id)}
                              disabled={dismissingIds.has(`assignment-${a.id}`)}
                              title={lang === "ar" ? "إخفاء من قائمتي" : "Remove from my list"}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                            >
                              {dismissingIds.has(`assignment-${a.id}`) ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                        {isAdmin && (
                          <>
                            {/* Library placement picker — inline dropdown */}
                            <div className="relative group/lib">
                              <button
                                type="button"
                                disabled={changingKindIds.has(a.id)}
                                title={lang === "ar" ? "تغيير المكتبة (مشرف)" : "Change library (admin)"}
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-bold text-indigo-600 border border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                              >
                                {changingKindIds.has(a.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">
                                  {a.contentKind === "both"
                                    ? (lang === "ar" ? "كلتاهما" : "Both")
                                    : a.contentKind === "competition"
                                      ? (lang === "ar" ? "مسابقات" : "Comp.")
                                      : (lang === "ar" ? "أنشطة" : "Act.")}
                                </span>
                              </button>
                              {/* Dropdown */}
                              <div className="absolute z-20 top-full mt-1 end-0 hidden group-hover/lib:flex flex-col min-w-[180px] rounded-xl border border-border bg-background shadow-lg overflow-hidden">
                                {(
                                  [
                                    { value: "homework",    labelAr: "مكتبة الأنشطة فقط",   labelEn: "Activities only",     cls: "text-blue-700 hover:bg-blue-50" },
                                    { value: "competition", labelAr: "مكتبة المسابقات فقط",  labelEn: "Competitions only",   cls: "text-amber-700 hover:bg-amber-50" },
                                    { value: "both",        labelAr: "كلتا المكتبتين",        labelEn: "Both libraries",      cls: "text-purple-700 hover:bg-purple-50" },
                                  ] as const
                                ).map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => changeLibraryKind(a.id, opt.value)}
                                    className={`text-start px-4 py-2.5 text-xs font-bold transition-colors ${opt.cls} ${a.contentKind === opt.value ? "bg-muted font-extrabold" : ""}`}
                                  >
                                    {lang === "ar" ? opt.labelAr : opt.labelEn}
                                    {a.contentKind === opt.value && " ✓"}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {/* Hide / restore */}
                            {a.hiddenByAdmin ? (
                              <button
                                onClick={() => unhideAsAdmin("assignments", a.id)}
                                disabled={hidingIds.has(`assignments-${a.id}`)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-bold text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-400 transition-colors disabled:opacity-40"
                              >
                                {hidingIds.has(`assignments-${a.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                                {lang === "ar" ? "إعادة الإظهار" : "Restore"}
                              </button>
                            ) : (
                              <button
                                onClick={() => hideAsAdmin("assignments", a.id)}
                                disabled={hidingIds.has(`assignments-${a.id}`)}
                                title={lang === "ar" ? "إخفاء من المكتبة (مشرف)" : "Hide from library (admin)"}
                                className="p-1.5 rounded-lg text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-300 transition-colors disabled:opacity-40"
                              >
                                {hidingIds.has(`assignments-${a.id}`) ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="py-12 text-center border-dashed">
              <BookText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-bold text-foreground">{lang === "ar" ? "لا توجد واجبات مشتركة" : "No shared assignments"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "لم يشارك أي معلم واجباته بعد" : "No teachers have shared their assignments yet"}</p>
            </Card>
          )
        )}

        {activeTab === "videos" && (
          videoLessons.length > 0 ? (
            <div className="grid gap-3">
              {videoLessons
                .filter(v =>
                  (!search || v.title.includes(search) || v.teacherName?.includes(search)) &&
                  matchesSubject(v.subject) &&
                  (!gradeFilter || gradeMatchesQuery(v.targetClass, gradeFilter))
                )
                .map((v, i) => (
                <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                  <Card className={`p-4 hover:shadow-md transition-shadow ${v.hiddenByAdmin ? "opacity-60 grayscale border-amber-400 border-dashed" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                            <Video className="w-4 h-4 text-red-500" />
                          </div>
                          <h3 className="font-bold text-foreground">{v.title}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <AuthorBadge isAdminContent={v.isAdminContent} teacherName={v.teacherName} />
                          {v.subject && <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded font-bold">{v.subject}</span>}
                          <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {v.questionCount} {lang === "ar" ? "سؤال" : "Q"}</span>
                          {v.targetClass && <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {v.targetClass}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(v.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {v.teacherId === currentTeacherId ? (
                          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-700">
                            <CheckCircle2 className="w-3 h-3" />
                            {lang === "ar" ? "محتواك · مشارك" : "Your content · Shared"}
                          </span>
                        ) : importedVIds.has(v.id) ? (
                          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            {lang === "ar" ? "تم الاستيراد" : "Imported"}
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => importVideoLesson(v.id)}
                            disabled={importingVIds.has(v.id)}
                            className="gap-1 text-xs py-1.5 px-3 h-auto"
                          >
                            {importingVIds.has(v.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                            {lang === "ar" ? "استيراد الدرس" : "Import Lesson"}
                          </Button>
                        )}
                        {isAdmin && (
                          v.hiddenByAdmin ? (
                            <button
                              onClick={() => unhideAsAdmin("video-lessons", v.id)}
                              disabled={hidingIds.has(`video-lessons-${v.id}`)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-bold text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-400 transition-colors disabled:opacity-40"
                            >
                              {hidingIds.has(`video-lessons-${v.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                              {lang === "ar" ? "إعادة الإظهار" : "Restore"}
                            </button>
                          ) : (
                            <button
                              onClick={() => hideAsAdmin("video-lessons", v.id)}
                              disabled={hidingIds.has(`video-lessons-${v.id}`)}
                              title={lang === "ar" ? "إخفاء من المكتبة (مشرف)" : "Hide from library (admin)"}
                              className="p-1.5 rounded-lg text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-300 transition-colors disabled:opacity-40"
                            >
                              {hidingIds.has(`video-lessons-${v.id}`) ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="py-12 text-center border-dashed">
              <Video className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-bold text-foreground">{lang === "ar" ? "لا توجد دروس فيديو مشتركة" : "No shared video lessons"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "لم يشارك أي معلم دروسه بعد" : "No teachers have shared their video lessons yet"}</p>
            </Card>
          )
        )}

        {activeTab === "questions" && (
          filteredQuestions.length > 0 ? (
            <div className="grid gap-3">
              {filteredQuestions.map((q, i) => (
                <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                  <Card className={`p-4 hover:shadow-md transition-shadow ${q.hiddenByAdmin ? "opacity-60 grayscale border-amber-400 border-dashed" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground mb-1">{q.text}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <AuthorBadge isAdminContent={q.isAdminContent} teacherName={q.teacherName} />
                          {q.subject && <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded font-bold">{q.subject}</span>}
                          <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded font-bold">{q.points} {lang === "ar" ? "درجة" : "pts"}</span>
                          {q.correctAnswer && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded font-bold">{q.correctAnswer}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(q.createdAt)}</span>
                        </div>
                        {(q.optionA || q.optionB) && (
                          <div className="grid grid-cols-2 gap-1 mt-2 text-sm text-muted-foreground">
                            {q.optionA && <span className={q.correctAnswer === "A" ? "text-green-600 font-bold" : ""}>أ) {q.optionA}</span>}
                            {q.optionB && <span className={q.correctAnswer === "B" ? "text-green-600 font-bold" : ""}>ب) {q.optionB}</span>}
                            {q.optionC && <span className={q.correctAnswer === "C" ? "text-green-600 font-bold" : ""}>ج) {q.optionC}</span>}
                            {q.optionD && <span className={q.correctAnswer === "D" ? "text-green-600 font-bold" : ""}>د) {q.optionD}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {q.teacherId === currentTeacherId ? (
                          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-700">
                            <CheckCircle2 className="w-3 h-3" />
                            {lang === "ar" ? "محتواك · مشارك" : "Your content · Shared"}
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => importQuestion(q.id)}
                              disabled={importingQIds.has(q.id) || importedQIds.has(q.id)}
                              className={`flex items-center gap-1 text-xs py-1.5 px-3 rounded-lg font-bold transition-all border ${
                                importedQIds.has(q.id)
                                  ? "border-green-400 bg-green-50 text-green-700 dark:bg-green-900/20"
                                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                              } disabled:opacity-60`}
                            >
                              {importingQIds.has(q.id) ? (
                                <><Loader2 className="w-3 h-3 animate-spin" />{t.sharedContent.importing}</>
                              ) : importedQIds.has(q.id) ? (
                                <><CheckCircle2 className="w-3 h-3" />{lang === "ar" ? "تم" : "Done"}</>
                              ) : (
                                <><Download className="w-3 h-3" />{t.sharedContent.importQuestion}</>
                              )}
                            </button>
                            <button
                              onClick={() => dismissItem("question", q.id)}
                              disabled={dismissingIds.has(`question-${q.id}`)}
                              title={lang === "ar" ? "إخفاء من قائمتي" : "Remove from my list"}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                            >
                              {dismissingIds.has(`question-${q.id}`) ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                        {isAdmin && (
                          q.hiddenByAdmin ? (
                            <button
                              onClick={() => unhideAsAdmin("question-bank", q.id)}
                              disabled={hidingIds.has(`question-bank-${q.id}`)}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-bold text-emerald-700 hover:text-white hover:bg-emerald-600 border border-emerald-400 transition-colors disabled:opacity-40"
                            >
                              {hidingIds.has(`question-bank-${q.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                              {lang === "ar" ? "إعادة الإظهار" : "Restore"}
                            </button>
                          ) : (
                            <button
                              onClick={() => hideAsAdmin("question-bank", q.id)}
                              disabled={hidingIds.has(`question-bank-${q.id}`)}
                              title={lang === "ar" ? "إخفاء من المكتبة (مشرف)" : "Hide from library (admin)"}
                              className="p-1.5 rounded-lg text-amber-600 hover:text-white hover:bg-amber-600 border border-amber-300 transition-colors disabled:opacity-40"
                            >
                              {hidingIds.has(`question-bank-${q.id}`) ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="py-12 text-center border-dashed">
              <HelpCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-bold text-foreground">{lang === "ar" ? "لا توجد أسئلة مشتركة" : "No shared questions"}</h3>
              <p className="text-sm text-muted-foreground mt-1">{lang === "ar" ? "لم يشارك أي معلم أسئلته بعد" : "No teachers have shared their questions yet"}</p>
            </Card>
          )
        )}

      </div>
    </Layout>
  );
}
