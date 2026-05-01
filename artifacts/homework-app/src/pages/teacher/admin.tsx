import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowRight, ArrowLeft, Users, BookText, FileCheck,
  Shield, ShieldOff, Trash2, Ban, CheckCircle2, GraduationCap, Phone,
  Mail, BarChart3, HelpCircle, UserX, Crown, Eye, EyeOff, ChevronDown, Lock, Copy,
  Globe, FileText, Settings2, Palette, RotateCcw, Type, Link2, Zap, Gamepad2, ToggleLeft, ToggleRight,
  MessageSquare, Clock, FolderTree, Plus, Folder, FolderOpen, ChevronRight, MoveRight, X, CheckSquare, Square, Sparkles, Bot,
} from "lucide-react";
import { useThemeUpdater } from "@/lib/theme-provider";
import { Card, Button, Input } from "@/components/ui-elements";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface TeacherData {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  passwordHash: string | null;
  isAdmin: boolean;
  isBlocked: boolean;
  aiTier?: "standard" | "pro" | "claude";
  hasProDesign?: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  assignmentCount: number;
  submissionCount: number;
  studentCount: number;
  gameCount: number;
  questionCount: number;
}

interface StudentData {
  id: number;
  name: string;
  studentClass: string | null;
  parentPhone: string | null;
  notes: string | null;
  teacherId: number;
  teacherName: string | null;
  createdAt: string;
}

interface StatsData {
  teacher_count: number;
  student_count: number;
  assignment_count: number;
  submission_count: number;
  question_count: number;
  blocked_count: number;
  shared_assignment_count: number;
  shared_question_count: number;
}

type Tab = "stats" | "teachers" | "students" | "content" | "appearance" | "feedback" | "online" | "activities" | "organize" | "maraqui" | "ai-chat" | "letrly";

interface FeedbackItem {
  id: number;
  type: string;
  name: string;
  email: string | null;
  message: string;
  status: string;
  createdAt: string;
}

interface OnlineTeacher {
  id: number;
  name: string;
  email: string | null;
  lastLoginAt: string | null;
}

interface OnlineData {
  totalActiveSessions: number;
  onlineTeacherCount: number;
  studentSessions: number;
  visitorSessions: number;
  onlineTeachers: OnlineTeacher[];
  recentLogins: OnlineTeacher[];
}

interface ActivityAssignment {
  id: number;
  title: string;
  subject: string | null;
  teacherName: string | null;
  teacherId: number;
  createdAt: string;
  isShared: boolean;
  isAdaptive: boolean | null;
  examMode: boolean | null;
  accessMode: string | null;
  targetClass: string | null;
  submissionCount: number;
  questionCount: number;
}

interface ActivityGame {
  id: number;
  title: string;
  teacherName: string | null;
  teacherId: number;
  pin: string | null;
  status: string | null;
  gameType: string | null;
  isShared: boolean | null;
  createdAt: string;
}

interface ActivityVideoLesson {
  id: number;
  title: string;
  subject: string | null;
  teacherName: string | null;
  teacherId: number;
  isPublished: boolean | null;
  isShared: boolean | null;
  videoType: string | null;
  createdAt: string;
}

interface ActivityTug {
  id: number;
  title: string;
  teacherName: string | null;
  teacherId: number;
  duration: number | null;
  createdAt: string;
}

interface ActivityMemory {
  id: number;
  title: string;
  teacherName: string | null;
  creatorId: number;
  gradeLevel: string | null;
  pin: string | null;
  createdAt: string;
}

interface ActivitiesData {
  assignments: ActivityAssignment[];
  games: ActivityGame[];
  videoLessons: ActivityVideoLesson[];
  tugGames: ActivityTug[];
  memorySets: ActivityMemory[];
  summary: {
    totalAssignments: number;
    totalGames: number;
    totalVideoLessons: number;
    totalTugGames: number;
    totalMemorySets: number;
    totalSubmissions: number;
  };
}

interface ContentAssignment {
  id: number;
  title: string;
  subject: string | null;
  isShared: boolean;
  teacherName: string | null;
  createdAt: string;
}


export default function AdminPage() {
  const { t, lang } = useI18n();
  const updateTheme = useThemeUpdater();
  const [location, setLocation] = useLocation();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;
  const urlTab = new URLSearchParams(location.split("?")[1] ?? "").get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(urlTab ?? "teachers");
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedTeacher, setExpandedTeacher] = useState<number | null>(null);
  const [currentTeacherId, setCurrentTeacherId] = useState<number | null>(null);
  const [shownPasswords, setShownPasswords] = useState<Set<number>>(new Set());
  const [publicVisibility, setPublicVisibility] = useState<"all" | "none" | "selective">("selective");
  const [contentAssignments, setContentAssignments] = useState<ContentAssignment[]>([]);
  const [contentTugTemplates, setContentTugTemplates] = useState<{ id: number; title: string; duration: number; isShared: boolean; teacherName: string | null; teacherIsAdmin: boolean | null; createdAt: string }[]>([]);

  const [savingVisibility, setSavingVisibility] = useState(false);
  const [guestLimit, setGuestLimit] = useState(1);
  const [guestLimitInput, setGuestLimitInput] = useState(1);
  const [savingGuestLimit, setSavingGuestLimit] = useState(false);
  const [proAiForAll, setProAiForAll] = useState(false);

  const [showAdventureGamesHome, setShowAdventureGamesHome] = useState(false);
  const [showSpaceRaceGamesHome, setShowSpaceRaceGamesHome] = useState(false);
  const [showFlagsGame, setShowFlagsGame] = useState(true);
  const [showColorGame, setShowColorGame] = useState(true);
  const [showMemoryGame, setShowMemoryGame] = useState(true);
  const [showMultiplyGame, setShowMultiplyGame] = useState(true);
  const [showScrambleGame, setShowScrambleGame] = useState(true);
  const [showTugGame, setShowTugGame] = useState(false);
  const [showCapitalsGame, setShowCapitalsGame] = useState(true);
  const [savingGameVisibility, setSavingGameVisibility] = useState(false);

  // Appearance
  const [appearancePrimaryColor, setAppearancePrimaryColor] = useState("#0d6b75");
  const [appearanceAccentColor, setAppearanceAccentColor] = useState("#c9a227");
  const [appearanceFontFamily, setAppearanceFontFamily] = useState("Tajawal");
  const [appearancePlatformName, setAppearancePlatformName] = useState("");
  const [appearanceLogoUrl, setAppearanceLogoUrl] = useState("");
  const [savingAppearance, setSavingAppearance] = useState(false);

  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [onlineData, setOnlineData] = useState<OnlineData | null>(null);
  const [onlineLoading, setOnlineLoading] = useState(false);

  const [activitiesData, setActivitiesData] = useState<ActivitiesData | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesSection, setActivitiesSection] = useState<"assignments" | "games" | "video" | "tug" | "memory">("assignments");

  interface FullStatsData {
    counts: { teachers: number; studentAccounts: number; rosterStudents: number; assignments: number; submissions: number; adventureGames: number; questions: number };
    gamePlays: { flags: number; color: number; memory: number; multiply: number; scramble: number };
    sessions: { total: number; teachers: number; students: number; visitors: number };
    growth: { teachers: { month: string; count: number }[]; students: { month: string; count: number }[] };
    recentTeachers: { id: number; name: string; email: string | null; createdAt: string }[];
    recentStudentAccounts: { id: number; username: string; displayName: string; createdAt: string }[];
  }
  const [fullStats, setFullStats] = useState<FullStatsData | null>(null);
  const [fullStatsLoading, setFullStatsLoading] = useState(false);

  interface OrgSection { id: number; name: string; nameEn: string | null; icon: string; color: string; sortOrder: number; }
  interface OrgSubSection { id: number; sectionId: number; name: string; nameEn: string | null; icon: string; sortOrder: number; }
  interface OrgMapping { activityType: string; activityId: string; sectionId: number; subSectionId: number | null; }
  const [orgSections, setOrgSections] = useState<OrgSection[]>([]);
  const [orgSubSections, setOrgSubSections] = useState<OrgSubSection[]>([]);
  const [orgMappings, setOrgMappings] = useState<OrgMapping[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgNewSectionName, setOrgNewSectionName] = useState("");
  const [orgNewSectionNameEn, setOrgNewSectionNameEn] = useState("");
  const [orgNewSectionColor, setOrgNewSectionColor] = useState("#0d6b75");
  const [orgNewSectionIcon, setOrgNewSectionIcon] = useState("Folder");
  const [orgNewSubName, setOrgNewSubName] = useState("");
  const [orgNewSubNameEn, setOrgNewSubNameEn] = useState("");
  const [orgNewSubParent, setOrgNewSubParent] = useState<number | null>(null);
  const [orgSelected, setOrgSelected] = useState<Set<string>>(new Set());
  const [orgMoveTarget, setOrgMoveTarget] = useState<{ sectionId: number; subSectionId?: number | null }>({ sectionId: 0 });
  const [orgExpandedSection, setOrgExpandedSection] = useState<number | null>(null);
  const [orgSaving, setOrgSaving] = useState(false);

  interface PendingMaraquiPath {
    id: number;
    title: string;
    description: string | null;
    pin: string;
    stages: { num: number; name: string; difficulty: string; questions: unknown[] }[];
    creator_id: number;
    creator_name: string | null;
    is_public: boolean;
    is_approved: boolean;
    created_at: string;
  }
  const [pendingMaraqui, setPendingMaraqui] = useState<PendingMaraquiPath[]>([]);
  const [maraquiLoading, setMaraquiLoading] = useState(false);
  const [maraquiActing, setMaraquiActing] = useState<number | null>(null);

  interface PendingShare {
    id: number;
    title: string;
    subject: string;
    teacherId: number;
    teacherName: string | null;
    createdAt: string;
    questionCount: number;
  }
  const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [sharesActing, setSharesActing] = useState<number | null>(null);

  const loadPendingShares = () => {
    setSharesLoading(true);
    fetch(`${API_BASE}/api/admin/pending-shares`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setPendingShares(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setSharesLoading(false));
  };

  const handleShareDecision = async (id: number, approve: boolean) => {
    setSharesActing(id);
    try {
      const endpoint = approve ? "approve-share" : "reject-share";
      const res = await fetch(`${API_BASE}/api/admin/assignments/${id}/${endpoint}`, {
        method: "POST", credentials: "include",
      });
      if (res.ok) setPendingShares(prev => prev.filter(p => p.id !== id));
    } catch {}
    setSharesActing(null);
  };

  const loadPendingMaraqui = () => {
    setMaraquiLoading(true);
    fetch(`${API_BASE}/api/maraqui-paths/pending`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setPendingMaraqui(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setMaraquiLoading(false));
  };

  const handleMaraquiApprove = async (id: number, approved: boolean) => {
    setMaraquiActing(id);
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-paths/${id}/approve`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (res.ok) {
        setPendingMaraqui(prev => prev.filter(p => p.id !== id));
        toast.success(approved ? (lang === "ar" ? "تمت الموافقة" : "Approved") : (lang === "ar" ? "تم الرفض" : "Rejected"));
      }
    } finally { setMaraquiActing(null); }
  };

  const handleMaraquiDelete = async (id: number) => {
    if (!confirm(lang === "ar" ? "حذف هذا المسار نهائياً؟" : "Delete this path permanently?")) return;
    setMaraquiActing(id);
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-paths/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) {
        setPendingMaraqui(prev => prev.filter(p => p.id !== id));
        toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
      }
    } finally { setMaraquiActing(null); }
  };

  const allActivities: Array<{ type: string; id: string; label: string; labelEn: string }> = [
    { type: "game_flags", id: "flags", label: "لعبة أعلام الدول", labelEn: "World Flags Game" },
    { type: "game_color", id: "color", label: "لعبة الألوان", labelEn: "Color Game" },
    { type: "game_memory", id: "memory", label: "لعبة الذاكرة", labelEn: "Memory Match" },
    { type: "game_multiply", id: "multiply", label: "جدول الضرب", labelEn: "Multiplication" },
    { type: "game_scramble", id: "scramble", label: "الكلمات المبعثرة", labelEn: "Scrambled Words" },
    { type: "game_tug", id: "tug", label: "شد الحبل", labelEn: "Tug of War" },
    { type: "game_capitals", id: "capitals", label: "عواصم العالم", labelEn: "World Capitals" },
  ];

  const loadOrganize = () => {
    setOrgLoading(true);
    fetch(`${API_BASE}/api/sections`)
      .then(r => r.ok ? r.json() : { sections: [], subSections: [], mappings: [] })
      .then(d => {
        setOrgSections(d.sections || []);
        setOrgSubSections(d.subSections || []);
        setOrgMappings(d.mappings || []);
      })
      .catch(() => {})
      .finally(() => setOrgLoading(false));
  };

  const getActivitySection = (type: string) => {
    const m = orgMappings.find(mp => mp.activityType === type);
    if (!m) return null;
    const sec = orgSections.find(s => s.id === m.sectionId);
    const sub = m.subSectionId ? orgSubSections.find(s => s.id === m.subSectionId) : null;
    return { section: sec, subSection: sub };
  };

  const toggleSelect = (key: string) => {
    setOrgSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (orgSelected.size === allActivities.length) {
      setOrgSelected(new Set());
    } else {
      setOrgSelected(new Set(allActivities.map(a => `${a.type}::${a.id}`)));
    }
  };

  const handleCreateSection = async () => {
    if (!orgNewSectionName.trim()) return;
    setOrgSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: orgNewSectionName.trim(), nameEn: orgNewSectionNameEn.trim() || undefined, icon: orgNewSectionIcon, color: orgNewSectionColor }),
      });
      if (!r.ok) throw new Error();
      toast.success(lang === "ar" ? "تم إنشاء القسم" : "Section created");
      setOrgNewSectionName("");
      setOrgNewSectionNameEn("");
      setOrgNewSectionColor("#0d6b75");
      setOrgNewSectionIcon("Folder");
      loadOrganize();
    } catch { toast.error(lang === "ar" ? "خطأ" : "Error"); }
    finally { setOrgSaving(false); }
  };

  const handleCreateSubSection = async () => {
    if (!orgNewSubName.trim() || !orgNewSubParent) return;
    setOrgSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/sub-sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sectionId: orgNewSubParent, name: orgNewSubName.trim(), nameEn: orgNewSubNameEn.trim() || undefined }),
      });
      if (!r.ok) throw new Error();
      toast.success(lang === "ar" ? "تم إنشاء القسم الفرعي" : "Subsection created");
      setOrgNewSubName("");
      setOrgNewSubNameEn("");
      loadOrganize();
    } catch { toast.error(lang === "ar" ? "خطأ" : "Error"); }
    finally { setOrgSaving(false); }
  };

  const handleDeleteSection = async (id: number) => {
    if (!confirm(lang === "ar" ? "حذف هذا القسم؟" : "Delete this section?")) return;
    try {
      await fetch(`${API_BASE}/api/admin/sections/${id}`, { method: "DELETE", credentials: "include" });
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
      loadOrganize();
    } catch { toast.error(lang === "ar" ? "خطأ" : "Error"); }
  };

  const handleDeleteSubSection = async (id: number) => {
    if (!confirm(lang === "ar" ? "حذف هذا القسم الفرعي؟" : "Delete this subsection?")) return;
    try {
      await fetch(`${API_BASE}/api/admin/sub-sections/${id}`, { method: "DELETE", credentials: "include" });
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
      loadOrganize();
    } catch { toast.error(lang === "ar" ? "خطأ" : "Error"); }
  };

  const handleBulkAssign = async () => {
    if (orgSelected.size === 0 || !orgMoveTarget.sectionId) {
      toast.error(lang === "ar" ? "اختر أنشطة وقسم" : "Select activities and section");
      return;
    }
    setOrgSaving(true);
    try {
      const items = Array.from(orgSelected).map(k => {
        const [activityType, activityId] = k.split("::");
        return { activityType, activityId };
      });
      const r = await fetch(`${API_BASE}/api/admin/activities/assign-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items, sectionId: orgMoveTarget.sectionId, subSectionId: orgMoveTarget.subSectionId || null }),
      });
      if (!r.ok) throw new Error();
      toast.success(lang === "ar" ? `تم نقل ${items.length} نشاط` : `Moved ${items.length} activities`);
      setOrgSelected(new Set());
      loadOrganize();
    } catch { toast.error(lang === "ar" ? "خطأ" : "Error"); }
    finally { setOrgSaving(false); }
  };

  const handleUnassign = async (type: string, id: string) => {
    try {
      await fetch(`${API_BASE}/api/admin/activities/unassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: [{ activityType: type, activityId: id }] }),
      });
      toast.success(lang === "ar" ? "تم إزالة التصنيف" : "Unassigned");
      loadOrganize();
    } catch { toast.error(lang === "ar" ? "خطأ" : "Error"); }
  };

  const togglePassword = (id: number) => {
    setShownPasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
        if (!meRes.ok) { setLocation("/login"); return; }
        const me = await meRes.json();
        if (!me.isAdmin) { setLocation("/teacher"); toast.error(t.admin.accessDenied || (lang === "ar" ? "غير مصرح" : "Admin access required")); return; }
        setCurrentTeacherId(me.id);
        const [tRes, sRes, stRes, psRes, cRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/teachers`, { credentials: "include" }),
          fetch(`${API_BASE}/api/admin/students`, { credentials: "include" }),
          fetch(`${API_BASE}/api/admin/stats`, { credentials: "include" }),
          fetch(`${API_BASE}/api/admin/platform-settings`, { credentials: "include" }),
          fetch(`${API_BASE}/api/admin/content`, { credentials: "include" }),
        ]);
        if (tRes.ok) setTeachers(await tRes.json());
        if (sRes.ok) setStudents(await sRes.json());
        if (stRes.ok) setStats(await stRes.json());
        if (psRes.ok) {
          const ps = await psRes.json();
          setPublicVisibility(ps.publicVisibility ?? "selective");
          if (ps.guestLimit !== undefined) { setGuestLimit(ps.guestLimit); setGuestLimitInput(ps.guestLimit); }
          if (ps.primaryColor) setAppearancePrimaryColor(ps.primaryColor);
          if (ps.accentColor) setAppearanceAccentColor(ps.accentColor);
          if (ps.fontFamily) setAppearanceFontFamily(ps.fontFamily);
          setAppearancePlatformName(ps.platformName ?? "");
          setAppearanceLogoUrl(ps.logoUrl ?? "");
          setShowAdventureGamesHome(ps.showAdventureGamesHome ?? false);
          setShowSpaceRaceGamesHome(ps.showSpaceRaceGamesHome ?? false);
          setShowFlagsGame(ps.showFlagsGame ?? true);
          setShowColorGame(ps.showColorGame ?? true);
          setShowMemoryGame(ps.showMemoryGame ?? true);
          setShowMultiplyGame(ps.showMultiplyGame ?? true);
          setShowScrambleGame(ps.showScrambleGame ?? true);
          setShowTugGame(ps.showTugGame ?? false);
          setShowCapitalsGame(ps.showCapitalsGame ?? true);
          setProAiForAll(ps.proAiForAll ?? false);
        }
        if (cRes.ok) { const c = await cRes.json(); setContentAssignments(c.assignments ?? []); setContentTugTemplates(c.tugTemplates ?? []); }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (activeTab !== "feedback" || feedbackItems.length > 0) return;
    setFeedbackLoading(true);
    fetch(`${API_BASE}/api/admin/feedback`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => setFeedbackItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setFeedbackLoading(false));
  }, [activeTab]);

  const loadOnlineData = () => {
    setOnlineLoading(true);
    fetch(`${API_BASE}/api/admin/online`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setOnlineData(d); })
      .catch(() => {})
      .finally(() => setOnlineLoading(false));
  };

  useEffect(() => {
    if (activeTab !== "online") return;
    loadOnlineData();
    const interval = setInterval(loadOnlineData, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const loadActivities = () => {
    setActivitiesLoading(true);
    fetch(`${API_BASE}/api/admin/activities`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setActivitiesData(d); })
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
  };

  useEffect(() => {
    if (activeTab !== "activities") return;
    if (!activitiesData) loadActivities();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "stats") return;
    if (fullStats) return;
    setFullStatsLoading(true);
    fetch(`${API_BASE}/api/admin/full-stats`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFullStats(d); })
      .catch(() => {})
      .finally(() => setFullStatsLoading(false));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "organize") return;
    if (orgSections.length === 0 && !orgLoading) loadOrganize();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "maraqui") return;
    loadPendingMaraqui();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "content") return;
    loadPendingShares();
  }, [activeTab]);

  async function updateFeedbackStatus(id: number, status: string) {
    const r = await fetch(`${API_BASE}/api/admin/feedback/${id}/status`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      const updated = await r.json();
      setFeedbackItems(prev => prev.map(f => f.id === id ? { ...f, status: updated.status } : f));
    }
  }

  async function deleteFeedback(id: number) {
    if (!confirm(lang === "ar" ? "حذف هذه الملاحظة؟" : "Delete this feedback?")) return;
    const r = await fetch(`${API_BASE}/api/admin/feedback/${id}`, {
      method: "DELETE", credentials: "include",
    });
    if (r.ok) {
      setFeedbackItems(prev => prev.filter(f => f.id !== id));
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
    }
  }

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString(lang === "ar" ? "ar-KW" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const handleBlock = async (id: number, blocked: boolean) => {
    const res = await fetch(`${API_BASE}/api/admin/teachers/${id}/block`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ blocked }),
    });
    if (res.ok) {
      setTeachers(prev => prev.map(t => t.id === id ? { ...t, isBlocked: blocked } : t));
      toast.success(blocked ? t.admin.blockTeacher : t.admin.unblockTeacher);
    }
  };

  const handleToggleAdmin = async (id: number, isAdmin: boolean) => {
    const res = await fetch(`${API_BASE}/api/admin/teachers/${id}/admin`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ isAdmin }),
    });
    if (res.ok) {
      setTeachers(prev => prev.map(t => t.id === id ? { ...t, isAdmin } : t));
      toast.success(isAdmin ? t.admin.grantAdmin : t.admin.revokeAdmin);
    }
  };

  const handleSetAiTier = async (id: number, next: "standard" | "pro" | "claude") => {
    const res = await fetch(`${API_BASE}/api/admin/teachers/${id}/ai-tier`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ aiTier: next }),
    });
    if (res.ok) {
      setTeachers(prev => prev.map(t => t.id === id ? { ...t, aiTier: next } : t));
      const msg = next === "claude"
        ? (lang === "ar" ? "تم تفعيل Claude" : "Claude enabled")
        : next === "pro"
          ? (lang === "ar" ? "تم تفعيل النسخة الاحترافية" : "Pro AI enabled")
          : (lang === "ar" ? "تم تعيين النسخة العادية" : "Standard AI set");
      toast.success(msg);
    } else {
      toast.error(lang === "ar" ? "تعذّر التحديث" : "Update failed");
    }
  };

  const handleToggleProDesign = async (id: number, current: boolean | undefined) => {
    const next = !current;
    const res = await fetch(`${API_BASE}/api/admin/teachers/${id}/pro-design`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ hasProDesign: next }),
    });
    if (res.ok) {
      setTeachers(prev => prev.map(t => t.id === id ? { ...t, hasProDesign: next } : t));
      toast.success(
        next
          ? (lang === "ar" ? "تم تفعيل التصاميم الاحترافية" : "Pro Design enabled")
          : (lang === "ar" ? "تم إلغاء التصاميم الاحترافية" : "Pro Design removed"),
      );
    } else {
      toast.error(lang === "ar" ? "تعذّر التحديث" : "Update failed");
    }
  };

  const handleToggleProAiForAll = async (next: boolean) => {
    const res = await fetch(`${API_BASE}/api/admin/platform-settings`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ proAiForAll: next }),
    });
    if (res.ok) {
      setProAiForAll(next);
      toast.success(
        next
          ? (lang === "ar" ? "تم تفعيل النسخة الاحترافية لجميع المعلمين" : "Pro AI enabled for everyone")
          : (lang === "ar" ? "تم إيقاف النسخة الاحترافية للجميع" : "Pro AI disabled for everyone"),
      );
    } else {
      toast.error(lang === "ar" ? "تعذّر التحديث" : "Update failed");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(lang === "ar" ? `حذف المعلم "${name}" وجميع بياناته؟ لا يمكن التراجع!` : `Delete "${name}" and all their data? This cannot be undone!`)) return;
    const res = await fetch(`${API_BASE}/api/admin/teachers/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      setTeachers(prev => prev.filter(t => t.id !== id));
      toast.success(lang === "ar" ? "تم حذف المعلم" : "Teacher deleted");
    }
  };

  const refetchContent = async () => {
    const [psRes, cRes] = await Promise.all([
      fetch(`${API_BASE}/api/admin/platform-settings`, { credentials: "include" }),
      fetch(`${API_BASE}/api/admin/content`, { credentials: "include" }),
    ]);
    if (psRes.ok) {
      const ps = await psRes.json();
      setPublicVisibility(ps.publicVisibility ?? "selective");
      if (ps.guestLimit !== undefined) { setGuestLimit(ps.guestLimit); setGuestLimitInput(ps.guestLimit); }
      setProAiForAll(ps.proAiForAll ?? false);
    }
    if (cRes.ok) { const c = await cRes.json(); setContentAssignments(c.assignments ?? []); setContentTugTemplates(c.tugTemplates ?? []); }
  };

  const handleSaveGuestLimit = async () => {
    const val = Math.max(0, Math.min(9999, Math.floor(Number(guestLimitInput))));
    setSavingGuestLimit(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/platform-settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ guestLimit: val }),
      });
      if (res.ok) {
        setGuestLimit(val);
        setGuestLimitInput(val);
        toast.success(t.admin.guestLimitSaved);
      }
    } finally { setSavingGuestLimit(false); }
  };

  const handleSaveVisibility = async (mode: "all" | "none" | "selective") => {
    setSavingVisibility(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/platform-settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ publicVisibility: mode }),
      });
      if (res.ok) { toast.success(t.admin.platformSettingsSaved); await refetchContent(); }
    } finally { setSavingVisibility(false); }
  };

  const handleToggleAssignment = async (id: number, isShared: boolean) => {
    const res = await fetch(`${API_BASE}/api/admin/content/assignments/${id}/share`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ isShared }),
    });
    if (res.ok) await refetchContent();
  };

  const handleBulkShare = async (isShared: boolean) => {
    const res = await fetch(`${API_BASE}/api/admin/content/bulk-share`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ isShared }),
    });
    if (res.ok) {
      toast.success(isShared ? t.admin.bulkShareAll : t.admin.bulkUnshareAll);
      await refetchContent();
    }
  };

  const handleToggleAdventureGames = async () => {
    const newValue = !showAdventureGamesHome;
    setShowAdventureGamesHome(newValue);
    setSavingGameVisibility(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/platform-settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ showAdventureGamesHome: newValue }),
      });
      if (res.ok) toast.success(t.admin.gameVisibilitySaved);
      else setShowAdventureGamesHome(!newValue);
    } catch { setShowAdventureGamesHome(!newValue); } finally { setSavingGameVisibility(false); }
  };

  const handleToggleSpaceRaceGames = async () => {
    const newValue = !showSpaceRaceGamesHome;
    setShowSpaceRaceGamesHome(newValue);
    setSavingGameVisibility(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/platform-settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ showSpaceRaceGamesHome: newValue }),
      });
      if (res.ok) toast.success(t.admin.gameVisibilitySaved);
      else setShowSpaceRaceGamesHome(!newValue);
    } catch { setShowSpaceRaceGamesHome(!newValue); } finally { setSavingGameVisibility(false); }
  };

  const gameToggleMap: Record<string, { get: boolean; set: (v: boolean) => void; key: string }> = {
    flags: { get: showFlagsGame, set: setShowFlagsGame, key: "showFlagsGame" },
    color: { get: showColorGame, set: setShowColorGame, key: "showColorGame" },
    memory: { get: showMemoryGame, set: setShowMemoryGame, key: "showMemoryGame" },
    multiply: { get: showMultiplyGame, set: setShowMultiplyGame, key: "showMultiplyGame" },
    scramble: { get: showScrambleGame, set: setShowScrambleGame, key: "showScrambleGame" },
    tug: { get: showTugGame, set: setShowTugGame, key: "showTugGame" },
    capitals: { get: showCapitalsGame, set: setShowCapitalsGame, key: "showCapitalsGame" },
  };

  const handleToggleGame = async (gameId: string) => {
    const entry = gameToggleMap[gameId];
    if (!entry) return;
    const newValue = !entry.get;
    entry.set(newValue);
    setSavingGameVisibility(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/platform-settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ [entry.key]: newValue }),
      });
      if (res.ok) toast.success(t.admin.gameVisibilitySaved);
      else entry.set(!newValue);
    } catch { entry.set(!newValue); } finally { setSavingGameVisibility(false); }
  };

  const handleSaveAppearance = async () => {
    setSavingAppearance(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/platform-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          primaryColor: appearancePrimaryColor,
          accentColor: appearanceAccentColor,
          fontFamily: appearanceFontFamily,
          platformName: appearancePlatformName,
          logoUrl: appearanceLogoUrl,
        }),
      });
      if (res.ok) {
        const newSettings = {
          primaryColor: appearancePrimaryColor,
          accentColor: appearanceAccentColor,
          fontFamily: appearanceFontFamily,
          platformName: appearancePlatformName || null,
          logoUrl: appearanceLogoUrl || null,
        };
        updateTheme(newSettings);
        toast.success(t.admin.appearanceSaved);
      }
    } finally {
      setSavingAppearance(false);
    }
  };

  const handleResetAppearance = async () => {
    if (!confirm(t.admin.resetAppearanceConfirm)) return;
    setSavingAppearance(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/platform-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          primaryColor: null,
          accentColor: null,
          fontFamily: null,
          platformName: null,
          logoUrl: null,
        }),
      });
      if (res.ok) {
        setAppearancePrimaryColor("#0d6b75");
        setAppearanceAccentColor("#c9a227");
        setAppearanceFontFamily("Tajawal");
        setAppearancePlatformName("");
        setAppearanceLogoUrl("");
        updateTheme({ primaryColor: null, accentColor: null, fontFamily: null, platformName: null, logoUrl: null });
        toast.success(t.admin.appearanceReset);
      }
    } finally {
      setSavingAppearance(false);
    }
  };

  const filteredTeachers = teachers.filter(t =>
    t.name.includes(search) || t.email?.includes(search) || t.phone?.includes(search)
  );

  const filteredStudents = students.filter(s =>
    s.name.includes(search) || s.studentClass?.includes(search) || s.teacherName?.includes(search)
  );

  if (loading) return (
    <Layout>
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    </Layout>
  );

  const statCards = stats ? [
    { label: t.admin.statsTeachers, value: stats.teacher_count, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30" },
    { label: t.admin.statsStudents, value: stats.student_count, icon: GraduationCap, color: "text-green-600 bg-green-50 dark:bg-green-900/30" },
    { label: t.admin.statsAssignments, value: stats.assignment_count, icon: BookText, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30" },
    { label: t.admin.statsSubmissions, value: stats.submission_count, icon: FileCheck, color: "text-teal-600 bg-teal-50 dark:bg-teal-900/30" },
    { label: lang === "ar" ? "بنك الأسئلة" : "Questions", value: stats.question_count, icon: HelpCircle, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" },
    { label: lang === "ar" ? "محظورين" : "Blocked", value: stats.blocked_count, icon: UserX, color: "text-red-600 bg-red-50 dark:bg-red-900/30" },
    { label: t.admin.statsSharedAssignments, value: stats.shared_assignment_count, icon: Eye, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30" },
    { label: t.admin.statsSharedQuestions, value: stats.shared_question_count ?? 0, icon: HelpCircle, color: "text-violet-600 bg-violet-50 dark:bg-violet-900/30" },
  ] : [];

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-6xl" dir={dir}>
        <Link href="/teacher" className="text-primary hover:underline font-bold flex items-center gap-1 mb-6 w-fit">
          <BackArrow className="w-4 h-4" />
          {t.admin.backToDashboard}
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {t.admin.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t.admin.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 border-b border-border pb-0 overflow-x-auto scrollbar-none">
          {([
            { key: "online" as Tab, label: lang === "ar" ? "المتصلون" : "Online", icon: Zap },
            { key: "stats" as Tab, label: t.admin.tabStats, icon: BarChart3 },
            { key: "activities" as Tab, label: lang === "ar" ? "الأنشطة" : "Activities", icon: BookText },
            { key: "teachers" as Tab, label: t.admin.tabTeachers, icon: Users },
            { key: "students" as Tab, label: t.admin.tabStudents, icon: GraduationCap },
            { key: "content" as Tab, label: t.admin.tabPublicContent, icon: Globe },
            { key: "feedback" as Tab, label: lang === "ar" ? "الملاحظات" : "Feedback", icon: MessageSquare },
            { key: "organize" as Tab, label: lang === "ar" ? "تنظيم" : "Organize", icon: FolderTree },
            { key: "maraqui" as Tab, label: lang === "ar" ? "مَراقي" : "Maraqui", icon: Gamepad2 },
            { key: "appearance" as Tab, label: t.admin.tabAppearance, icon: Palette },
            { key: "ai-chat" as Tab, label: lang === "ar" ? "محادثات المساعد" : "AI Chats", icon: Sparkles },
            { key: "letrly" as Tab, label: lang === "ar" ? "تحدي الكلمة" : "Word Challenge", icon: Type },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(""); }}
              className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all -mb-px ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "online" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{lang === "ar" ? "المتصلون الآن" : "Currently Online"}</h2>
              <button
                onClick={loadOnlineData}
                disabled={onlineLoading}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className={`w-4 h-4 ${onlineLoading ? "animate-spin" : ""}`} />
                {lang === "ar" ? "تحديث" : "Refresh"}
              </button>
            </div>

            {onlineLoading && !onlineData ? (
              <div className="text-center py-12 text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>
            ) : onlineData ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="p-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                      <Users className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-black text-foreground">{onlineData.totalActiveSessions}</p>
                    <p className="text-xs text-muted-foreground font-bold mt-1">{lang === "ar" ? "إجمالي الجلسات" : "Total Sessions"}</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center mx-auto mb-2">
                      <Shield className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-black text-foreground">{onlineData.onlineTeacherCount}</p>
                    <p className="text-xs text-muted-foreground font-bold mt-1">{lang === "ar" ? "منظّمون متصلون" : "Organizers Online"}</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 flex items-center justify-center mx-auto mb-2">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-black text-foreground">{onlineData.studentSessions}</p>
                    <p className="text-xs text-muted-foreground font-bold mt-1">{lang === "ar" ? "جلسات طلاب" : "Student Sessions"}</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center mx-auto mb-2">
                      <Eye className="w-5 h-5" />
                    </div>
                    <p className="text-2xl font-black text-foreground">{onlineData.visitorSessions}</p>
                    <p className="text-xs text-muted-foreground font-bold mt-1">{lang === "ar" ? "جلسات زوار" : "Visitor Sessions"}</p>
                  </Card>
                </div>

                {onlineData.onlineTeachers.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      {lang === "ar" ? "المعلمون المتصلون حالياً" : "Currently Online Teachers"}
                    </h3>
                    <div className="divide-y divide-border">
                      {onlineData.onlineTeachers.map((teacher) => (
                        <div key={teacher.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 flex items-center justify-center font-bold text-sm">
                              {teacher.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{teacher.name}</p>
                              {teacher.email && <p className="text-xs text-muted-foreground">{teacher.email}</p>}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {teacher.lastLoginAt
                              ? new Date(teacher.lastLoginAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", { dateStyle: "short", timeStyle: "short" })
                              : (lang === "ar" ? "—" : "—")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <Card className="p-4">
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    {lang === "ar" ? "آخر تسجيلات الدخول" : "Recent Logins"}
                  </h3>
                  <div className="divide-y divide-border">
                    {onlineData.recentLogins.map((teacher) => (
                      <div key={teacher.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm">
                            {teacher.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{teacher.name}</p>
                            {teacher.email && <p className="text-xs text-muted-foreground">{teacher.email}</p>}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {teacher.lastLoginAt
                            ? new Date(teacher.lastLoginAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" })
                            : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ) : null}
          </div>
        )}

        {activeTab === "activities" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{lang === "ar" ? "جميع أنشطة المعلمين" : "All Teacher Activities"}</h2>
              <button
                onClick={loadActivities}
                disabled={activitiesLoading}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className={`w-4 h-4 ${activitiesLoading ? "animate-spin" : ""}`} />
                {lang === "ar" ? "تحديث" : "Refresh"}
              </button>
            </div>

            {activitiesLoading && !activitiesData ? (
              <div className="text-center py-12 text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>
            ) : activitiesData ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { key: "assignments" as const, label: lang === "ar" ? "الواجبات" : "Assignments", count: activitiesData.summary.totalAssignments, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600", icon: FileCheck },
                    { key: "games" as const, label: lang === "ar" ? "ألعاب وميض" : "Wameeth Games", count: activitiesData.summary.totalGames, color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600", icon: Zap },
                    { key: "video" as const, label: lang === "ar" ? "دروس الفيديو" : "Video Lessons", count: activitiesData.summary.totalVideoLessons, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600", icon: Eye },
                    { key: "tug" as const, label: lang === "ar" ? "شد الحبل" : "Tug of War", count: activitiesData.summary.totalTugGames, color: "bg-red-100 dark:bg-red-900/30 text-red-600", icon: Gamepad2 },
                    { key: "memory" as const, label: lang === "ar" ? "تطابق الذاكرة" : "Memory Match", count: activitiesData.summary.totalMemorySets, color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600", icon: HelpCircle },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setActivitiesSection(item.key)}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        activitiesSection === item.key
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:border-border"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center mx-auto mb-1`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <p className="text-xl font-black">{item.count}</p>
                      <p className="text-[11px] text-muted-foreground font-bold">{item.label}</p>
                    </button>
                  ))}
                  <div className="p-3 rounded-xl text-center">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center mx-auto mb-1">
                      <FileText className="w-4 h-4" />
                    </div>
                    <p className="text-xl font-black">{activitiesData.summary.totalSubmissions}</p>
                    <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "إجمالي التسليمات" : "Total Submissions"}</p>
                  </div>
                </div>

                {activitiesSection === "assignments" && (
                  <Card className="p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-blue-600" />
                      {lang === "ar" ? `الواجبات والاختبارات (${activitiesData.assignments.length})` : `Assignments (${activitiesData.assignments.length})`}
                    </h3>
                    {activitiesData.assignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{lang === "ar" ? "لا توجد واجبات بعد" : "No assignments yet"}</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {activitiesData.assignments.map(a => (
                          <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate">{a.title}</p>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{a.teacherName || "—"}</span>
                                  {a.subject && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{a.subject}</span>}
                                  {a.targetClass && <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">{a.targetClass}</span>}
                                  {a.examMode && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">{lang === "ar" ? "اختبار" : "Exam"}</span>}
                                  {a.isAdaptive && <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">{lang === "ar" ? "تكيفي" : "Adaptive"}</span>}
                                  {a.isShared && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">{lang === "ar" ? "مشارك" : "Shared"}</span>}
                                </div>
                              </div>
                              <div className="text-left shrink-0">
                                <p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</p>
                                <p className="text-xs mt-0.5">
                                  <span className="text-blue-600 font-bold">{a.questionCount}</span> {lang === "ar" ? "سؤال" : "Q"} · <span className="text-emerald-600 font-bold">{a.submissionCount}</span> {lang === "ar" ? "تسليم" : "Sub"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {activitiesSection === "games" && (
                  <Card className="p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-600" />
                      {lang === "ar" ? `ألعاب وميض (${activitiesData.games.length})` : `Wameeth Games (${activitiesData.games.length})`}
                    </h3>
                    {activitiesData.games.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{lang === "ar" ? "لا توجد ألعاب بعد" : "No games yet"}</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {activitiesData.games.map(g => (
                          <div key={g.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{g.title}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{g.teacherName || "—"}</span>
                                {g.gameType && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">{g.gameType}</span>}
                                <span className={`text-xs px-2 py-0.5 rounded-full ${g.status === "active" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{g.status === "active" ? (lang === "ar" ? "نشطة" : "Active") : (lang === "ar" ? "منتهية" : "Ended")}</span>
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              <p className="text-xs text-muted-foreground">{new Date(g.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</p>
                              {g.pin && <p className="text-xs font-mono font-bold mt-0.5">PIN: {g.pin}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {activitiesSection === "video" && (
                  <Card className="p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-purple-600" />
                      {lang === "ar" ? `دروس الفيديو (${activitiesData.videoLessons.length})` : `Video Lessons (${activitiesData.videoLessons.length})`}
                    </h3>
                    {activitiesData.videoLessons.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{lang === "ar" ? "لا توجد دروس فيديو بعد" : "No video lessons yet"}</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {activitiesData.videoLessons.map(v => (
                          <div key={v.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{v.title}</p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{v.teacherName || "—"}</span>
                                {v.subject && <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">{v.subject}</span>}
                                {v.videoType && <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">{v.videoType}</span>}
                                {v.isPublished ? <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">{lang === "ar" ? "منشور" : "Published"}</span> : <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{lang === "ar" ? "مسودة" : "Draft"}</span>}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">{new Date(v.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {activitiesSection === "tug" && (
                  <Card className="p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4 text-red-600" />
                      {lang === "ar" ? `شد الحبل (${activitiesData.tugGames.length})` : `Tug of War (${activitiesData.tugGames.length})`}
                    </h3>
                    {activitiesData.tugGames.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{lang === "ar" ? "لا توجد ألعاب شد الحبل بعد" : "No tug of war games yet"}</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {activitiesData.tugGames.map(t2 => (
                          <div key={t2.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{t2.title}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{t2.teacherName || "—"}</span>
                                {t2.duration && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">{t2.duration} {lang === "ar" ? "ث" : "s"}</span>}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground shrink-0">{new Date(t2.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {activitiesSection === "memory" && (
                  <Card className="p-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-emerald-600" />
                      {lang === "ar" ? `تطابق الذاكرة (${activitiesData.memorySets.length})` : `Memory Match (${activitiesData.memorySets.length})`}
                    </h3>
                    {activitiesData.memorySets.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">{lang === "ar" ? "لا توجد مجموعات ذاكرة بعد" : "No memory sets yet"}</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {activitiesData.memorySets.map(m => (
                          <div key={m.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{m.title}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{m.teacherName || "—"}</span>
                                {m.gradeLevel && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">{m.gradeLevel}</span>}
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              <p className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</p>
                              {m.pin && <p className="text-xs font-mono font-bold mt-0.5">PIN: {m.pin}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </>
            ) : null}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="space-y-6">
            {fullStats && (
              <div className="flex items-center justify-end">
                <button
                  onClick={() => {
                    setFullStatsLoading(true);
                    fetch(`${API_BASE}/api/admin/full-stats`, { credentials: "include" })
                      .then(r => r.ok ? r.json() : null)
                      .then(d => { if (d) setFullStats(d); })
                      .catch(() => {})
                      .finally(() => setFullStatsLoading(false));
                  }}
                  disabled={fullStatsLoading}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className={`w-4 h-4 ${fullStatsLoading ? "animate-spin" : ""}`} />
                  {lang === "ar" ? "تحديث" : "Refresh"}
                </button>
              </div>
            )}
            {fullStatsLoading && !fullStats ? (
              <div className="text-center py-12 text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</div>
            ) : fullStats ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: lang === "ar" ? "المنظّمون" : "Organizers", value: fullStats.counts.teachers, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30" },
                    { label: lang === "ar" ? "حسابات الطلاب" : "Student Accounts", value: fullStats.counts.studentAccounts, icon: GraduationCap, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30" },
                    { label: lang === "ar" ? "الواجبات" : "Assignments", value: fullStats.counts.assignments, icon: BookText, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30" },
                    { label: lang === "ar" ? "التسليمات" : "Submissions", value: fullStats.counts.submissions, icon: FileCheck, color: "text-teal-600 bg-teal-50 dark:bg-teal-900/30" },
                    { label: lang === "ar" ? "طلاب القوائم" : "Roster Students", value: fullStats.counts.rosterStudents, icon: Users, color: "text-green-600 bg-green-50 dark:bg-green-900/30" },
                    { label: lang === "ar" ? "بنك الأسئلة" : "Questions", value: fullStats.counts.questions, icon: HelpCircle, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" },
                    { label: lang === "ar" ? "ألعاب المغامرة" : "Adventure Games", value: fullStats.counts.adventureGames, icon: Gamepad2, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30" },
                  ].map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <Card className="p-4 text-center">
                        <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-2`}>
                          <s.icon className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-black text-foreground">{s.value.toLocaleString(lang === "ar" ? "ar-EG" : "en")}</p>
                        <p className="text-xs text-muted-foreground font-bold mt-1">{s.label}</p>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <Card className="p-5">
                    <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-500" />
                      {lang === "ar" ? "الجلسات النشطة الآن" : "Active Sessions Now"}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-xl font-black text-foreground">{fullStats.sessions.total}</p>
                        <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "إجمالي" : "Total"}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                        <p className="text-xl font-black text-blue-600">{fullStats.sessions.teachers}</p>
                        <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "منظّمون" : "Organizers"}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
                        <p className="text-xl font-black text-cyan-600">{fullStats.sessions.students}</p>
                        <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "طلاب" : "Students"}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                        <p className="text-xl font-black text-amber-600">{fullStats.sessions.visitors}</p>
                        <p className="text-[11px] text-muted-foreground font-bold">{lang === "ar" ? "زوار" : "Visitors"}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                  <Card className="p-5">
                    <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4 text-purple-500" />
                      {lang === "ar" ? "إجمالي مرات اللعب" : "Total Game Plays"}
                    </h3>
                    {(() => {
                      const gameEntries = [
                        { label: lang === "ar" ? "أعلام الدول" : "Flag Quiz", value: fullStats.gamePlays.flags, color: "bg-emerald-500" },
                        { label: lang === "ar" ? "الألوان" : "Color Game", value: fullStats.gamePlays.color, color: "bg-orange-500" },
                        { label: lang === "ar" ? "الذاكرة" : "Memory", value: fullStats.gamePlays.memory, color: "bg-pink-500" },
                        { label: lang === "ar" ? "جدول الضرب" : "Multiply", value: fullStats.gamePlays.multiply, color: "bg-cyan-500" },
                        { label: lang === "ar" ? "الكلمات المبعثرة" : "Scramble", value: fullStats.gamePlays.scramble, color: "bg-violet-500" },
                      ];
                      const maxVal = Math.max(...gameEntries.map(e => e.value), 1);
                      return (
                        <div className="space-y-3">
                          {gameEntries.map((g, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs font-bold text-muted-foreground w-28 shrink-0 text-end">{g.label}</span>
                              <div className="flex-1 h-7 bg-muted/50 rounded-lg overflow-hidden relative">
                                <div
                                  className={`h-full ${g.color} rounded-lg transition-all duration-700`}
                                  style={{ width: `${Math.max((g.value / maxVal) * 100, 2)}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-foreground mix-blend-difference">
                                  {g.value.toLocaleString(lang === "ar" ? "ar-EG" : "en")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <Card className="p-5">
                    <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-500" />
                      {lang === "ar" ? "نمو التسجيل (آخر 6 أشهر)" : "Registration Growth (Last 6 Months)"}
                    </h3>
                    {(() => {
                      const months = new Set<string>();
                      fullStats.growth.teachers.forEach(r => months.add(r.month));
                      fullStats.growth.students.forEach(r => months.add(r.month));
                      const sortedMonths = Array.from(months).sort();
                      if (sortedMonths.length === 0) {
                        return <p className="text-sm text-muted-foreground text-center py-4">{lang === "ar" ? "لا توجد بيانات بعد" : "No data yet"}</p>;
                      }
                      const teacherMap = new Map(fullStats.growth.teachers.map(r => [r.month, r.count]));
                      const studentMap = new Map(fullStats.growth.students.map(r => [r.month, r.count]));
                      const maxVal = Math.max(
                        ...sortedMonths.map(m => Math.max(teacherMap.get(m) ?? 0, studentMap.get(m) ?? 0)),
                        1
                      );
                      return (
                        <div className="flex items-end gap-2 h-40">
                          {sortedMonths.map((m) => {
                            const tVal = teacherMap.get(m) ?? 0;
                            const sVal = studentMap.get(m) ?? 0;
                            const tH = Math.max((tVal / maxVal) * 100, 4);
                            const sH = Math.max((sVal / maxVal) * 100, 4);
                            const monthLabel = m.split("-")[1];
                            return (
                              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                                <div className="flex items-end gap-0.5 h-28 w-full justify-center">
                                  <div className="flex flex-col items-center gap-0.5 flex-1">
                                    <span className="text-[10px] font-bold text-blue-600">{tVal || ""}</span>
                                    <div className="w-full bg-blue-500 rounded-t" style={{ height: `${tH}%` }} />
                                  </div>
                                  <div className="flex flex-col items-center gap-0.5 flex-1">
                                    <span className="text-[10px] font-bold text-cyan-600">{sVal || ""}</span>
                                    <div className="w-full bg-cyan-500 rounded-t" style={{ height: `${sH}%` }} />
                                  </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-bold">{monthLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> {lang === "ar" ? "منظّمون" : "Organizers"}</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cyan-500" /> {lang === "ar" ? "طلاب" : "Students"}</span>
                    </div>
                  </Card>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                    <Card className="p-5">
                      <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        {lang === "ar" ? "أحدث المنظّمين" : "Latest Organizers"}
                      </h3>
                      {fullStats.recentTeachers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-3">{lang === "ar" ? "لا يوجد" : "None"}</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {fullStats.recentTeachers.map((t) => (
                            <div key={t.id} className="flex items-center justify-between py-2.5">
                              <div>
                                <p className="text-sm font-bold text-foreground">{t.name}</p>
                                {t.email && <p className="text-xs text-muted-foreground">{t.email}</p>}
                              </div>
                              <span className="text-[11px] text-muted-foreground">{formatDate(t.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
                    <Card className="p-5">
                      <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-cyan-500" />
                        {lang === "ar" ? "أحدث الطلاب المسجّلين" : "Latest Student Registrations"}
                      </h3>
                      {fullStats.recentStudentAccounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-3">{lang === "ar" ? "لا يوجد" : "None"}</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {fullStats.recentStudentAccounts.map((s) => (
                            <div key={s.id} className="flex items-center justify-between py-2.5">
                              <div>
                                <p className="text-sm font-bold text-foreground">{s.displayName}</p>
                                <p className="text-xs text-muted-foreground">@{s.username}</p>
                              </div>
                              <span className="text-[11px] text-muted-foreground">{formatDate(s.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                </div>
              </>
            ) : stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statCards.map((s, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="p-4 text-center">
                      <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-2`}>
                        <s.icon className="w-5 h-5" />
                      </div>
                      <p className="text-2xl font-black text-foreground">{s.value}</p>
                      <p className="text-xs text-muted-foreground font-bold mt-1">{s.label}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "teachers" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === "ar" ? "ابحث بالاسم أو البريد أو الهاتف..." : "Search by name, email, or phone..."} className={lang === "ar" ? "pr-10" : "pl-10"} />
              </div>
              <span className="text-sm text-muted-foreground font-bold">{filteredTeachers.length} {lang === "ar" ? "معلم" : "teachers"}</span>
            </div>

            <div className="space-y-2">
              {filteredTeachers.map((teacher, i) => (
                <motion.div key={teacher.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}>
                  <Card className={`transition-colors ${teacher.isBlocked ? "border-red-300 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10" : ""}`}>
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer"
                      onClick={() => setExpandedTeacher(expandedTeacher === teacher.id ? null : teacher.id)}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                        teacher.isAdmin ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700" :
                        teacher.isBlocked ? "bg-red-100 dark:bg-red-900/30 text-red-600" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {teacher.isAdmin ? <Crown className="w-5 h-5" /> : teacher.isBlocked ? <Ban className="w-5 h-5" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground">{teacher.name}</p>
                          {teacher.isAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 font-black">{lang === "ar" ? "مسؤول" : "Admin"}</span>}
                          {teacher.isBlocked && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 font-black">{lang === "ar" ? "محظور" : "Blocked"}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {teacher.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {teacher.email}</span>}
                          {teacher.phone && <span className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr"><Phone className="w-3 h-3" /> {teacher.phone}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold">{teacher.assignmentCount} {lang === "ar" ? "واجب" : "hw"}</span>
                          <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 text-xs font-bold">{teacher.studentCount} {lang === "ar" ? "طالب" : "st"}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedTeacher === teacher.id ? "rotate-180" : ""}`} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedTeacher === teacher.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="px-4 pb-4 pt-3 border-t border-border/50 space-y-4">

                            {/* Stats grid */}
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                              {[
                                { label: "الواجبات", value: teacher.assignmentCount, color: "bg-purple-50 text-purple-700" },
                                { label: "التسليمات", value: teacher.submissionCount, color: "bg-teal-50 text-teal-700" },
                                { label: "الطلاب", value: teacher.studentCount, color: "bg-green-50 text-green-700" },
                                { label: "المسابقات", value: teacher.gameCount, color: "bg-orange-50 text-orange-700" },
                                { label: "الأسئلة", value: teacher.questionCount, color: "bg-indigo-50 text-indigo-700" },
                              ].map((s, idx) => (
                                <div key={idx} className={`text-center p-2 rounded-lg ${s.color}`}>
                                  <p className="text-lg font-black">{s.value}</p>
                                  <p className="text-[10px] font-bold">{s.label}</p>
                                </div>
                              ))}
                            </div>

                            {/* Full data rows */}
                            <div className="space-y-2 text-sm">
                              {/* Email */}
                              {teacher.email && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground min-w-16">البريد:</span>
                                  <span className="font-mono flex-1 text-xs" dir="ltr">{teacher.email}</span>
                                  <button onClick={() => copyToClipboard(teacher.email!, "البريد")} className="p-1 hover:bg-muted rounded">
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                </div>
                              )}
                              {/* Phone */}
                              {teacher.phone && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground min-w-16">الهاتف:</span>
                                  <span className="font-mono flex-1 text-xs" dir="ltr">{teacher.phone}</span>
                                  <button onClick={() => copyToClipboard(teacher.phone!, "الهاتف")} className="p-1 hover:bg-muted rounded">
                                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                </div>
                              )}
                              {/* Password hash */}
                              {teacher.passwordHash && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                                  <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground min-w-16">كلمة المرور:</span>
                                  <span className="font-mono flex-1 text-xs truncate" dir="ltr">
                                    {shownPasswords.has(teacher.id) ? teacher.passwordHash : "••••••••••••••••••••"}
                                  </span>
                                  <button onClick={() => togglePassword(teacher.id)} className="p-1 hover:bg-muted rounded shrink-0">
                                    {shownPasswords.has(teacher.id) ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                                  </button>
                                  {shownPasswords.has(teacher.id) && (
                                    <button onClick={() => copyToClipboard(teacher.passwordHash!, "كلمة المرور")} className="p-1 hover:bg-muted rounded shrink-0">
                                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* Dates */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-muted-foreground">
                                <span><strong>تاريخ التسجيل:</strong> {formatDate(teacher.createdAt)}</span>
                                <span><strong>آخر دخول:</strong> {formatDate(teacher.lastLoginAt)}</span>
                                <span><strong>ID:</strong> {teacher.id}</span>
                              </div>
                            </div>

                            {/* Action buttons */}
                            {teacher.id !== currentTeacherId && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  variant={teacher.isAdmin ? "outline" : "default"}
                                  onClick={() => handleToggleAdmin(teacher.id, !teacher.isAdmin)}
                                  className="gap-1.5 text-xs py-1.5 px-3 h-auto"
                                >
                                  {teacher.isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                                  {teacher.isAdmin ? t.admin.revokeAdmin : t.admin.grantAdmin}
                                </Button>
                                {!teacher.isAdmin && (
                                  <div
                                    className="inline-flex rounded-lg border border-border overflow-hidden"
                                    role="group"
                                    aria-label={lang === "ar" ? "اختر نسخة الذكاء الاصطناعي" : "Pick AI tier"}
                                  >
                                    {([
                                      { key: "standard", labelAr: "عادي",     labelEn: "Standard", icon: Sparkles, active: "bg-slate-800 text-white" },
                                      { key: "pro",      labelAr: "احترافي",  labelEn: "Pro",      icon: Crown,    active: "bg-violet-600 text-white" },
                                      { key: "claude",   labelAr: "كلود",     labelEn: "Claude",   icon: Bot,      active: "bg-amber-600 text-white" },
                                    ] as const).map((opt) => {
                                      const Icon = opt.icon;
                                      const current = teacher.aiTier ?? "standard";
                                      const isActive = current === opt.key;
                                      return (
                                        <button
                                          key={opt.key}
                                          type="button"
                                          onClick={() => { if (!isActive) void handleSetAiTier(teacher.id, opt.key); }}
                                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition ${
                                            isActive ? opt.active : "bg-card text-muted-foreground hover:bg-muted"
                                          }`}
                                          title={lang === "ar"
                                            ? `النسخة: ${opt.labelAr}`
                                            : `Tier: ${opt.labelEn}`}
                                        >
                                          <Icon className="w-3.5 h-3.5" />
                                          {lang === "ar" ? opt.labelAr : opt.labelEn}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {!teacher.isAdmin && (
                                  <Button
                                    variant={teacher.hasProDesign ? "outline" : "default"}
                                    onClick={() => handleToggleProDesign(teacher.id, teacher.hasProDesign)}
                                    className={`gap-1.5 text-xs py-1.5 px-3 h-auto ${teacher.hasProDesign ? "border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-700" : ""}`}
                                    title={lang === "ar" ? "تفعيل التصاميم الاحترافية للعروض" : "Toggle Pro Design"}
                                  >
                                    <Crown className="w-3.5 h-3.5" />
                                    {teacher.hasProDesign
                                      ? (lang === "ar" ? "إلغاء تصاميم احترافية" : "Remove Pro Design")
                                      : (lang === "ar" ? "تفعيل تصاميم احترافية" : "Enable Pro Design")}
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  onClick={() => handleBlock(teacher.id, !teacher.isBlocked)}
                                  className={`gap-1.5 text-xs py-1.5 px-3 h-auto ${teacher.isBlocked ? "text-green-600 border-green-300" : "text-orange-600 border-orange-300"}`}
                                >
                                  {teacher.isBlocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                  {teacher.isBlocked ? t.admin.unblockTeacher : t.admin.blockTeacher}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleDelete(teacher.id, teacher.name)}
                                  className="gap-1.5 text-xs py-1.5 px-3 h-auto text-red-600 border-red-300 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {t.admin.deleteTeacher}
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "students" && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === "ar" ? "ابحث بالاسم أو الصف أو المعلم..." : "Search by name, class, or teacher..."} className={lang === "ar" ? "pr-10" : "pl-10"} />
              </div>
              <span className="text-sm text-muted-foreground font-bold">{filteredStudents.length} {lang === "ar" ? "طالب" : "students"}</span>
            </div>

            {filteredStudents.length > 0 ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-start px-4 py-3 font-semibold text-muted-foreground w-10">#</th>
                        <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{lang === "ar" ? "الاسم" : "Name"}</th>
                        <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{lang === "ar" ? "الصف" : "Class"}</th>
                        <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{lang === "ar" ? "هاتف ولي الأمر" : "Parent Phone"}</th>
                        <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{lang === "ar" ? "المعلم" : "Teacher"}</th>
                        <th className="text-start px-4 py-3 font-semibold text-muted-foreground">{lang === "ar" ? "ملاحظات" : "Notes"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s, i) => (
                        <tr key={s.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground text-xs font-bold">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-foreground">{s.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{s.studentClass || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground" dir="ltr">{s.parentPhone || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{s.teacherName || "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">{s.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <Card className="py-12 text-center border-dashed">
                <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="text-lg font-bold text-foreground">{lang === "ar" ? "لا يوجد طلاب" : "No students"}</h3>
              </Card>
            )}
          </div>
        )}
        {activeTab === "content" && (
          <div className="space-y-6">
            {/* Pro AI access */}
            <Card className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="w-5 h-5 text-violet-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-extrabold text-foreground">
                    {lang === "ar" ? "النسخة الاحترافية للذكاء الاصطناعي" : "Pro AI for presentations"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {lang === "ar"
                      ? "النسخة العادية (gpt-5-mini) متاحة للجميع، وهي أسرع وأقل تكلفة. النسخة الاحترافية (gpt-5.2) تعطي شرائح أعمق وأرقى. يمكنك تفعيلها لكل المعلمين أو لمعلم محدد من قسم المعلمين. صلاحياتك أنت كمسؤول مفتوحة على جميع النسخ تلقائياً."
                      : "The standard tier (gpt-5-mini) is fast and cheap and available to everyone. The Pro tier (gpt-5.2) produces richer slides. Enable it for everyone here, or per-teacher in the Teachers section. Admins always have access to all tiers."}
                  </p>
                </div>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3 cursor-pointer">
                <div>
                  <div className="font-bold text-foreground text-sm">
                    {lang === "ar" ? "تفعيل الاحترافي للجميع" : "Enable Pro AI for everyone"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {lang === "ar"
                      ? "عند التفعيل، كل المعلمين يحصلون على خيار اختيار النسخة الاحترافية."
                      : "When on, every teacher can choose the Pro tier when generating."}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={proAiForAll}
                  onChange={(e) => handleToggleProAiForAll(e.target.checked)}
                  className="w-5 h-5 accent-violet-600 cursor-pointer"
                />
              </label>
            </Card>

            {/* Guest limit */}
            <Card className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-foreground">{t.admin.guestLimitTitle}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.admin.guestLimitDesc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setGuestLimitInput(v => Math.max(0, Number(v) - 1))}
                    className="px-3 py-2 text-lg font-bold hover:bg-muted transition-colors"
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={guestLimitInput}
                    onChange={e => setGuestLimitInput(Math.max(0, Math.min(9999, parseInt(e.target.value) || 0)))}
                    className="w-16 text-center py-2 bg-transparent border-x focus:outline-none font-bold text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setGuestLimitInput(v => Math.min(9999, Number(v) + 1))}
                    className="px-3 py-2 text-lg font-bold hover:bg-muted transition-colors"
                  >+</button>
                </div>
                <span className="text-sm text-muted-foreground">
                  {guestLimitInput === 0 ? t.admin.guestLimitZero : `${t.admin.guestLimitLabel}: ${guestLimitInput}`}
                </span>
                <button
                  onClick={handleSaveGuestLimit}
                  disabled={savingGuestLimit || guestLimitInput === guestLimit}
                  className="ms-auto py-1.5 px-4 h-auto rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                  {savingGuestLimit ? (lang === "ar" ? "جارٍ الحفظ…" : "Saving…") : (lang === "ar" ? "حفظ" : "Save")}
                </button>
              </div>
            </Card>

            {/* Game Visibility */}
            <Card className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <Gamepad2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-foreground">{t.admin.gameVisibilityTitle}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.admin.gameVisibilityDesc}</p>
                </div>
              </div>
              <div className="space-y-3">
                {/* وميض — always on */}
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                  <div>
                    <p className="font-bold text-sm text-foreground">{t.admin.gameWameeth}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.admin.gameWameethDesc}</p>
                  </div>
                  <ToggleRight className="w-8 h-8 text-amber-500 shrink-0" />
                </div>
                {/* Adventure Games */}
                <button
                  onClick={handleToggleAdventureGames}
                  disabled={savingGameVisibility}
                  className="w-full flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-4 py-3 hover:bg-muted/30 transition-colors text-start disabled:opacity-60"
                >
                  <div>
                    <p className="font-bold text-sm text-foreground">{t.admin.gameAdventure}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.admin.gameAdventureDesc}</p>
                  </div>
                  {showAdventureGamesHome
                    ? <ToggleRight className="w-8 h-8 text-primary shrink-0" />
                    : <ToggleLeft className="w-8 h-8 text-muted-foreground shrink-0" />}
                </button>
                {/* Space Race Games */}
                <button
                  onClick={handleToggleSpaceRaceGames}
                  disabled={savingGameVisibility}
                  className="w-full flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-4 py-3 hover:bg-muted/30 transition-colors text-start disabled:opacity-60"
                >
                  <div>
                    <p className="font-bold text-sm text-foreground">{t.admin.gameSpaceRace}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.admin.gameSpaceRaceDesc}</p>
                  </div>
                  {showSpaceRaceGamesHome
                    ? <ToggleRight className="w-8 h-8 text-primary shrink-0" />
                    : <ToggleLeft className="w-8 h-8 text-muted-foreground shrink-0" />}
                </button>

                <div className="border-t border-border/40 my-2" />
                <p className="text-xs font-bold text-muted-foreground px-1 mb-1">{lang === "ar" ? "الألعاب التعليمية" : "Educational Games"}</p>

                {([
                  { id: "flags", label: t.admin.gameFlags, desc: t.admin.gameFlagsDesc, value: showFlagsGame },
                  { id: "color", label: t.admin.gameColor, desc: t.admin.gameColorDesc, value: showColorGame },
                  { id: "memory", label: t.admin.gameMemory, desc: t.admin.gameMemoryDesc, value: showMemoryGame },
                  { id: "multiply", label: t.admin.gameMultiply, desc: t.admin.gameMultiplyDesc, value: showMultiplyGame },
                  { id: "scramble", label: t.admin.gameScramble, desc: t.admin.gameScrambleDesc, value: showScrambleGame },
                  { id: "tug", label: t.admin.gameTug, desc: t.admin.gameTugDesc, value: showTugGame },
                  { id: "capitals", label: t.admin.gameCapitals, desc: t.admin.gameCapitalsDesc, value: showCapitalsGame },
                ] as const).map(game => (
                  <button
                    key={game.id}
                    onClick={() => handleToggleGame(game.id)}
                    disabled={savingGameVisibility}
                    className="w-full flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-4 py-3 hover:bg-muted/30 transition-colors text-start disabled:opacity-60"
                  >
                    <div>
                      <p className="font-bold text-sm text-foreground">{game.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{game.desc}</p>
                    </div>
                    {game.value
                      ? <ToggleRight className="w-8 h-8 text-primary shrink-0" />
                      : <ToggleLeft className="w-8 h-8 text-muted-foreground shrink-0" />}
                  </button>
                ))}
              </div>
            </Card>

            {/* Mode selector */}
            <Card className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <Settings2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-foreground">{t.admin.contentModeLabel}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.admin.publicContentDesc}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { key: "all" as const, label: t.admin.publicModeAll, desc: t.admin.publicModeAllDesc, color: "border-green-400 bg-green-50 dark:bg-green-900/20", icon: "🌐", active: "border-green-500 ring-2 ring-green-300" },
                  { key: "none" as const, label: t.admin.publicModeNone, desc: t.admin.publicModeNoneDesc, color: "border-red-400 bg-red-50 dark:bg-red-900/20", icon: "🔒", active: "border-red-500 ring-2 ring-red-300" },
                  { key: "selective" as const, label: t.admin.publicModeSelective, desc: t.admin.publicModeSelectiveDesc, color: "border-primary/40 bg-primary/5", icon: "⚙️", active: "border-primary ring-2 ring-primary/30" },
                ]).map(m => (
                  <button
                    key={m.key}
                    onClick={() => handleSaveVisibility(m.key)}
                    disabled={savingVisibility}
                    className={`rounded-xl border-2 p-4 text-start transition-all ${m.color} ${publicVisibility === m.key ? m.active : "opacity-70 hover:opacity-100"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{m.icon}</span>
                      <span className="font-extrabold text-foreground text-sm">{m.label}</span>
                      {publicVisibility === m.key && <CheckCircle2 className="w-4 h-4 text-primary ms-auto shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                  </button>
                ))}
              </div>
            </Card>

            {/* Content list — only in selective mode */}
            {publicVisibility !== "selective" && (
              <Card className="p-6 text-center">
                <Globe className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground text-sm">
                  {publicVisibility === "all"
                    ? (lang === "ar" ? "الكل عام — لا حاجة للتحكم الفردي" : "All content is public — individual controls not needed")
                    : (lang === "ar" ? "الكل خاص — لا يرى الزوار أي محتوى" : "All content is private — guests see nothing")}
                </p>
              </Card>
            )}
            {publicVisibility === "selective" && <Card className="p-0 overflow-hidden">
              {/* Sub-tab header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  {t.admin.contentAssignments} <span className="text-xs opacity-70">({contentAssignments.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleBulkShare(true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 hover:bg-green-200 font-bold transition-colors"
                  >
                    {t.admin.bulkShareAll}
                  </button>
                  <button
                    onClick={() => handleBulkShare(false)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 hover:bg-red-200 font-bold transition-colors"
                  >
                    {t.admin.bulkUnshareAll}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
                {contentAssignments.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>{lang === "ar" ? "لا توجد واجبات" : "No assignments"}</p>
                  </div>
                ) : contentAssignments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.teacherName || "—"} {a.subject ? `· ${a.subject}` : ""}</p>
                    </div>
                    <button
                      onClick={() => handleToggleAssignment(a.id, !a.isShared)}
                      className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors border ${
                        a.isShared
                          ? "bg-green-100 dark:bg-green-900/30 border-green-300 text-green-700 hover:bg-green-200"
                          : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {a.isShared ? t.admin.contentShared : t.admin.contentPrivate}
                    </button>
                  </div>
                ))}
              </div>
            </Card>}

            {publicVisibility === "selective" && <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Gamepad2 className="w-4 h-4" />
                  {lang === "ar" ? "ألعاب شد الحبل" : "Tug of War Templates"} <span className="text-xs opacity-70">({contentTugTemplates.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const r = await fetch(`${API_BASE}/api/admin/content/tug-templates/bulk-share`, {
                        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                        body: JSON.stringify({ isShared: true }),
                      });
                      if (r.ok) { toast.success(lang === "ar" ? "تمت مشاركة قوالبك مع الجميع" : "Your templates are shared"); await refetchContent(); }
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 hover:bg-green-200 font-bold transition-colors"
                  >
                    {lang === "ar" ? "شارك قوالبي" : "Share my templates"}
                  </button>
                  <button
                    onClick={async () => {
                      const r = await fetch(`${API_BASE}/api/admin/content/tug-templates/bulk-share`, {
                        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                        body: JSON.stringify({ isShared: false }),
                      });
                      if (r.ok) { toast.success(lang === "ar" ? "تم إلغاء المشاركة" : "Unshared"); await refetchContent(); }
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 hover:bg-red-200 font-bold transition-colors"
                  >
                    {lang === "ar" ? "إلغاء المشاركة" : "Unshare all"}
                  </button>
                </div>
              </div>
              <div className="divide-y divide-border/40 max-h-[420px] overflow-y-auto">
                {contentTugTemplates.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Gamepad2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>{lang === "ar" ? "لا توجد قوالب" : "No templates"}</p>
                  </div>
                ) : contentTugTemplates.map(tt => (
                  <div key={tt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{tt.title}</p>
                      <p className="text-xs text-muted-foreground">{tt.teacherName || "—"} · {tt.duration}{lang === "ar" ? "ث" : "s"}</p>
                    </div>
                    <button
                      onClick={async () => {
                        const r = await fetch(`${API_BASE}/api/admin/content/tug-templates/${tt.id}/share`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
                          body: JSON.stringify({ isShared: !tt.isShared }),
                        });
                        if (r.ok) await refetchContent();
                      }}
                      className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors border ${
                        tt.isShared
                          ? "bg-green-100 dark:bg-green-900/30 border-green-300 text-green-700 hover:bg-green-200"
                          : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {tt.isShared ? (lang === "ar" ? "مشترك" : "Shared") : (lang === "ar" ? "خاص" : "Private")}
                    </button>
                  </div>
                ))}
              </div>
            </Card>}

            {/* Pending Share Requests */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-extrabold text-foreground">{lang === "ar" ? "طلبات مشاركة الواجبات" : "Assignment Share Requests"}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{lang === "ar" ? "واجبات طلب المعلمون مشاركتها — في انتظار موافقتك" : "Assignments teachers requested to share — awaiting your approval"}</p>
                  </div>
                </div>
                <button onClick={loadPendingShares} disabled={sharesLoading} className="px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-xs font-bold text-muted-foreground transition-colors">
                  {lang === "ar" ? "تحديث" : "Refresh"}
                </button>
              </div>
              {sharesLoading ? (
                <div className="flex justify-center py-8"><span className="animate-spin text-2xl">⏳</span></div>
              ) : pendingShares.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Globe className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="font-bold">{lang === "ar" ? "لا توجد طلبات معلّقة" : "No pending requests"}</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {pendingShares.map(s => (
                    <div key={s.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{s.teacherName || "—"} {s.subject ? `· ${s.subject}` : ""} · {s.questionCount} {lang === "ar" ? "سؤال" : "questions"}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleShareDecision(s.id, true)}
                          disabled={sharesActing === s.id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold bg-green-100 dark:bg-green-900/30 border border-green-300 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                        >
                          {lang === "ar" ? "موافقة" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleShareDecision(s.id, false)}
                          disabled={sharesActing === s.id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold bg-red-100 dark:bg-red-900/30 border border-red-300 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          {lang === "ar" ? "رفض" : "Reject"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === "feedback" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <h2 className="font-extrabold text-foreground text-lg">{lang === "ar" ? "الملاحظات والاقتراحات" : "Feedback & Suggestions"}</h2>
                <p className="text-sm text-muted-foreground">{lang === "ar" ? "جميع الملاحظات والاقتراحات المرسلة من الزوار والمعلمين" : "All feedback and suggestions from visitors and teachers"}</p>
              </div>
            </div>

            {feedbackLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Card key={i} className="p-4 animate-pulse"><div className="h-5 bg-muted rounded w-48" /></Card>)}
              </div>
            ) : feedbackItems.length === 0 ? (
              <Card className="py-12 text-center border-dashed">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-bold">{lang === "ar" ? "لا توجد ملاحظات بعد" : "No feedback yet"}</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {feedbackItems.map((fb, i) => {
                  const typeLabels: Record<string, { ar: string; en: string; color: string }> = {
                    suggestion: { ar: "اقتراح", en: "Suggestion", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
                    bug: { ar: "خلل", en: "Bug", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
                    praise: { ar: "إشادة", en: "Praise", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
                    other: { ar: "أخرى", en: "Other", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
                  };
                  const statusLabels: Record<string, { ar: string; en: string; color: string }> = {
                    new: { ar: "جديد", en: "New", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
                    read: { ar: "مقروء", en: "Read", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
                    resolved: { ar: "تم الرد", en: "Resolved", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
                  };
                  const tl = typeLabels[fb.type] || typeLabels.other;
                  const sl = statusLabels[fb.status] || statusLabels.new;
                  return (
                    <motion.div key={fb.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                      <Card className={`p-4 ${fb.status === "new" ? "border-yellow-300 dark:border-yellow-700" : ""}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tl.color}`}>
                                {lang === "ar" ? tl.ar : tl.en}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sl.color}`}>
                                {lang === "ar" ? sl.ar : sl.en}
                              </span>
                              <span className="text-xs text-muted-foreground font-bold">{fb.name}</span>
                              {fb.email && <span className="text-xs text-muted-foreground">{fb.email}</span>}
                              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(fb.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{fb.message}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {fb.status === "new" && (
                              <button
                                onClick={() => updateFeedbackStatus(fb.id, "read")}
                                className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-muted-foreground hover:text-blue-600 transition-colors"
                                title={lang === "ar" ? "تحديد كمقروء" : "Mark as read"}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {fb.status !== "resolved" && (
                              <button
                                onClick={() => updateFeedbackStatus(fb.id, "resolved")}
                                className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-muted-foreground hover:text-green-600 transition-colors"
                                title={lang === "ar" ? "تم الرد" : "Mark as resolved"}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteFeedback(fb.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                              title={lang === "ar" ? "حذف" : "Delete"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "appearance" && (
          <div className="space-y-6 max-w-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-extrabold text-foreground text-lg">{t.admin.appearanceTitle}</h2>
                <p className="text-sm text-muted-foreground">{t.admin.appearanceDesc}</p>
              </div>
            </div>

            {/* Platform Identity */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Link2 className="w-4 h-4 text-primary" />
                <h3 className="font-extrabold text-foreground">{t.admin.identitySection}</h3>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1">{t.admin.platformNameLabel}</label>
                <Input
                  value={appearancePlatformName}
                  onChange={e => setAppearancePlatformName(e.target.value)}
                  placeholder={t.admin.platformNamePlaceholder}
                />
                <p className="text-xs text-muted-foreground mt-1">{t.admin.platformNameDesc}</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1">{t.admin.logoUrlLabel}</label>
                <Input
                  value={appearanceLogoUrl}
                  onChange={e => setAppearanceLogoUrl(e.target.value)}
                  placeholder={t.admin.logoUrlPlaceholder}
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground mt-1">{t.admin.logoUrlDesc}</p>
                {appearanceLogoUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={appearanceLogoUrl}
                      alt="logo preview"
                      className="w-10 h-10 rounded-lg object-cover border border-border"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="text-xs text-muted-foreground">{lang === "ar" ? "معاينة الشعار" : "Logo preview"}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Colors */}
            <Card className="p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Palette className="w-4 h-4 text-primary" />
                <h3 className="font-extrabold text-foreground">{t.admin.colorSection}</h3>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1">{t.admin.primaryColorLabel}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={appearancePrimaryColor}
                    onChange={e => setAppearancePrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                  />
                  <span className="font-mono text-sm text-foreground" dir="ltr">{appearancePrimaryColor}</span>
                  <div
                    className="flex-1 h-8 rounded-lg border border-border/50"
                    style={{ backgroundColor: appearancePrimaryColor }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t.admin.primaryColorDesc}</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1">{t.admin.accentColorLabel}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={appearanceAccentColor}
                    onChange={e => setAppearanceAccentColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                  />
                  <span className="font-mono text-sm text-foreground" dir="ltr">{appearanceAccentColor}</span>
                  <div
                    className="flex-1 h-8 rounded-lg border border-border/50"
                    style={{ backgroundColor: appearanceAccentColor }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{t.admin.accentColorDesc}</p>
              </div>
            </Card>

            {/* Font */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Type className="w-4 h-4 text-primary" />
                <h3 className="font-extrabold text-foreground">{t.admin.fontSection}</h3>
              </div>
              <div>
                <label className="block text-sm font-bold text-foreground mb-1">{t.admin.fontFamilyLabel}</label>
                <select
                  value={appearanceFontFamily}
                  onChange={e => setAppearanceFontFamily(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="Tajawal">{t.admin.fontTajawal}</option>
                  <option value="Cairo">{t.admin.fontCairo}</option>
                  <option value="Almarai">{t.admin.fontAlmarai}</option>
                  <option value="Noto Kufi Arabic">{t.admin.fontNotoKufi}</option>
                  <option value="IBM Plex Arabic">{t.admin.fontIBMPlex}</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">{t.admin.fontFamilyDesc}</p>
              </div>
            </Card>

            {/* Live Preview */}
            <Card className="p-5">
              <h3 className="font-extrabold text-foreground mb-3">{t.admin.previewTitle}</h3>
              <div className="rounded-xl border border-border bg-muted/20 p-5 space-y-3">
                <p className="font-bold text-foreground" style={{ fontFamily: `'${appearanceFontFamily}', sans-serif` }}>
                  {appearancePlatformName || t.nav.siteName}
                </p>
                <p className="text-sm text-muted-foreground" style={{ fontFamily: `'${appearanceFontFamily}', sans-serif` }}>
                  {t.admin.previewText}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: appearancePrimaryColor }}
                  >
                    {t.admin.previewBtn}
                  </button>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: appearanceAccentColor }}
                  >
                    {t.admin.previewAccent}
                  </span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSaveAppearance}
                disabled={savingAppearance}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Palette className="w-4 h-4" />
                {savingAppearance ? t.admin.savingAppearance : t.admin.saveAppearance}
              </button>
              <button
                onClick={handleResetAppearance}
                disabled={savingAppearance}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t.admin.resetAppearance}
              </button>
            </div>
          </div>
        )}

        {activeTab === "maraqui" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                <Gamepad2 className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-extrabold text-foreground text-lg">{lang === "ar" ? "مسارات مَراقي المعلّقة" : "Pending Maraqui Paths"}</h2>
                <p className="text-sm text-muted-foreground">{lang === "ar" ? "مسارات طلب أصحابها نشرها للعموم — وافق أو ارفض" : "Paths submitted for public listing — approve or reject"}</p>
              </div>
              <button onClick={loadPendingMaraqui} disabled={maraquiLoading} className="px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm font-bold text-muted-foreground transition-colors">
                <RotateCcw className={`w-4 h-4 ${maraquiLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {maraquiLoading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pendingMaraqui.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm bg-muted/20 rounded-2xl border border-border/40">
                <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {lang === "ar" ? "لا توجد مسارات معلّقة حالياً" : "No pending paths at the moment"}
              </div>
            ) : (
              <div className="space-y-3">
                {pendingMaraqui.map(path => (
                  <div key={path.id} className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-xl shrink-0">🪜</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground">{path.title}</p>
                        {path.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{path.description}</p>}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          <span className="text-xs text-teal-600 font-medium">{path.stages?.length ?? 0} {lang === "ar" ? "مراحل" : "stages"}</span>
                          <span className="text-xs text-muted-foreground" dir="ltr">PIN: {path.pin}</span>
                          {path.creator_name && <span className="text-xs text-muted-foreground">{lang === "ar" ? "بقلم:" : "by:"} {path.creator_name}</span>}
                          <span className="text-xs text-muted-foreground">{new Date(path.created_at).toLocaleDateString(lang === "ar" ? "ar-KW" : "en-US")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMaraquiApprove(path.id, true)}
                        disabled={maraquiActing === path.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-teal-500 text-white text-sm font-bold hover:bg-teal-600 disabled:opacity-60 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {lang === "ar" ? "وافق" : "Approve"}
                      </button>
                      <button
                        onClick={() => handleMaraquiApprove(path.id, false)}
                        disabled={maraquiActing === path.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500/10 text-amber-600 text-sm font-bold hover:bg-amber-500/20 disabled:opacity-60 border border-amber-500/30 transition-colors"
                      >
                        <Ban className="w-4 h-4" />
                        {lang === "ar" ? "ارفض" : "Reject"}
                      </button>
                      <button
                        onClick={() => handleMaraquiDelete(path.id)}
                        disabled={maraquiActing === path.id}
                        className="px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 disabled:opacity-60 border border-destructive/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "organize" && (
          <div className="space-y-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FolderTree className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-extrabold text-foreground text-lg">{lang === "ar" ? "تنظيم الأنشطة" : "Organize Activities"}</h2>
                <p className="text-sm text-muted-foreground">{lang === "ar" ? "أنشئ أقساماً وصنّف الأنشطة فيها لتنظيم الصفحة الرئيسية" : "Create sections and assign activities to organize the home page"}</p>
              </div>
              <button onClick={loadOrganize} disabled={orgLoading} className="ms-auto px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm font-bold text-muted-foreground transition-colors">
                <RotateCcw className={`w-4 h-4 ${orgLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  {lang === "ar" ? "إنشاء قسم جديد" : "Create New Section"}
                </h3>
                <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</label>
                      <input value={orgNewSectionName} onChange={e => setOrgNewSectionName(e.target.value)} placeholder={lang === "ar" ? "مثال: ألعاب ذكاء" : "e.g. Brain Games"} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</label>
                      <input value={orgNewSectionNameEn} onChange={e => setOrgNewSectionNameEn(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "اللون" : "Color"}</label>
                      <input type="color" value={orgNewSectionColor} onChange={e => setOrgNewSectionColor(e.target.value)} className="w-full h-9 rounded-lg cursor-pointer" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الأيقونة" : "Icon"}</label>
                      <select value={orgNewSectionIcon} onChange={e => setOrgNewSectionIcon(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm">
                        {["Folder", "Gamepad2", "Brain", "Trophy", "Star", "Zap", "Globe", "BookOpen", "Sparkles", "Calculator"].map(ic => (
                          <option key={ic} value={ic}>{ic}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleCreateSection} disabled={orgSaving || !orgNewSectionName.trim()} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    <Plus className="w-4 h-4" />
                    {lang === "ar" ? "إنشاء القسم" : "Create Section"}
                  </button>
                </div>

                {orgSections.length > 0 && (
                  <>
                    <h3 className="font-bold text-foreground flex items-center gap-2 mt-4">
                      <FolderOpen className="w-4 h-4" />
                      {lang === "ar" ? "إضافة قسم فرعي" : "Add Subsection"}
                    </h3>
                    <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "القسم الرئيسي" : "Parent Section"}</label>
                        <select value={orgNewSubParent || ""} onChange={e => setOrgNewSubParent(Number(e.target.value) || null)} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm">
                          <option value="">{lang === "ar" ? "اختر القسم..." : "Select section..."}</option>
                          {orgSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</label>
                          <input value={orgNewSubName} onChange={e => setOrgNewSubName(e.target.value)} placeholder={lang === "ar" ? "مثال: ألغاز" : "e.g. Puzzles"} className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</label>
                          <input value={orgNewSubNameEn} onChange={e => setOrgNewSubNameEn(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-primary" />
                        </div>
                      </div>
                      <button onClick={handleCreateSubSection} disabled={orgSaving || !orgNewSubName.trim() || !orgNewSubParent} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-bold hover:bg-secondary/90 disabled:opacity-50 transition-colors">
                        <Plus className="w-4 h-4" />
                        {lang === "ar" ? "إضافة قسم فرعي" : "Add Subsection"}
                      </button>
                    </div>
                  </>
                )}

                {orgSections.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      <FolderTree className="w-4 h-4" />
                      {lang === "ar" ? "الأقسام الحالية" : "Current Sections"}
                    </h3>
                    {orgSections.map(sec => {
                      const subs = orgSubSections.filter(s => s.sectionId === sec.id);
                      const secMaps = orgMappings.filter(m => m.sectionId === sec.id);
                      const isExp = orgExpandedSection === sec.id;
                      return (
                        <div key={sec.id} className="bg-card border border-border/50 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/20" onClick={() => setOrgExpandedSection(isExp ? null : sec.id)}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: sec.color + "20", color: sec.color }}>
                              <Folder className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate">{sec.name}</p>
                              <p className="text-[10px] text-muted-foreground">{secMaps.length} {lang === "ar" ? "نشاط" : "activities"} · {subs.length} {lang === "ar" ? "فرعي" : "sub"}</p>
                            </div>
                            <button onClick={e => { e.stopPropagation(); handleDeleteSection(sec.id); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExp ? "rotate-180" : ""}`} />
                          </div>
                          {isExp && (
                            <div className="border-t border-border/30 p-3 space-y-2">
                              {subs.map(sub => (
                                <div key={sub.id} className="flex items-center gap-2 bg-muted/20 rounded-lg p-2">
                                  <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-xs font-semibold flex-1">{sub.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{orgMappings.filter(m => m.subSectionId === sub.id).length} {lang === "ar" ? "نشاط" : "act."}</span>
                                  <button onClick={() => handleDeleteSubSection(sub.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {secMaps.length > 0 && (
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  {lang === "ar" ? "الأنشطة:" : "Activities:"} {secMaps.map(m => {
                                    const act = allActivities.find(a => a.type === m.activityType);
                                    return act ? (lang === "ar" ? act.label : act.labelEn) : m.activityType;
                                  }).join("، ")}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <MoveRight className="w-4 h-4" />
                  {lang === "ar" ? "نقل الأنشطة إلى قسم" : "Move Activities to Section"}
                </h3>
                <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={selectAll} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                      {orgSelected.size === allActivities.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      {orgSelected.size === allActivities.length ? (lang === "ar" ? "إلغاء الكل" : "Deselect All") : (lang === "ar" ? "تحديد الكل" : "Select All")}
                    </button>
                    {orgSelected.size > 0 && (
                      <span className="text-xs text-muted-foreground">{orgSelected.size} {lang === "ar" ? "محدد" : "selected"}</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {allActivities.map(act => {
                      const key = `${act.type}::${act.id}`;
                      const isSelected = orgSelected.has(key);
                      const assigned = getActivitySection(act.type);
                      return (
                        <div key={key} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${isSelected ? "border-primary/50 bg-primary/5" : "border-border/30 hover:bg-muted/20"}`} onClick={() => toggleSelect(key)}>
                          {isSelected ? <CheckSquare className="w-4 h-4 text-primary shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{lang === "ar" ? act.label : act.labelEn}</p>
                            {assigned ? (
                              <p className="text-[10px] text-muted-foreground">
                                {assigned.section?.name}{assigned.subSection ? ` → ${assigned.subSection.name}` : ""}
                              </p>
                            ) : (
                              <p className="text-[10px] text-orange-500">{lang === "ar" ? "غير مصنّف" : "Unassigned"}</p>
                            )}
                          </div>
                          {assigned && (
                            <button
                              onClick={e => { e.stopPropagation(); handleUnassign(act.type, act.id); }}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                              title={lang === "ar" ? "إزالة التصنيف" : "Remove assignment"}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {orgSections.length > 0 && orgSelected.size > 0 && (
                    <div className="border-t border-border/30 pt-3 space-y-3">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "نقل إلى قسم" : "Move to section"}</label>
                        <select
                          value={orgMoveTarget.sectionId || ""}
                          onChange={e => setOrgMoveTarget({ sectionId: Number(e.target.value), subSectionId: null })}
                          className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm"
                        >
                          <option value="">{lang === "ar" ? "اختر القسم..." : "Select section..."}</option>
                          {orgSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      {orgMoveTarget.sectionId > 0 && orgSubSections.filter(s => s.sectionId === orgMoveTarget.sectionId).length > 0 && (
                        <div>
                          <label className="text-xs font-bold text-muted-foreground mb-1 block">{lang === "ar" ? "قسم فرعي (اختياري)" : "Subsection (optional)"}</label>
                          <select
                            value={orgMoveTarget.subSectionId ?? ""}
                            onChange={e => setOrgMoveTarget(prev => ({ ...prev, subSectionId: Number(e.target.value) || null }))}
                            className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm"
                          >
                            <option value="">{lang === "ar" ? "بدون قسم فرعي" : "No subsection"}</option>
                            {orgSubSections.filter(s => s.sectionId === orgMoveTarget.sectionId).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <button
                        onClick={handleBulkAssign}
                        disabled={orgSaving || !orgMoveTarget.sectionId}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        <MoveRight className="w-4 h-4" />
                        {lang === "ar" ? `نقل ${orgSelected.size} نشاط` : `Move ${orgSelected.size} activities`}
                      </button>
                    </div>
                  )}

                  {orgSections.length === 0 && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      {lang === "ar" ? "أنشئ قسماً أولاً لتتمكن من نقل الأنشطة" : "Create a section first to move activities"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai-chat" && <AdminAiChatTab lang={lang} />}

        {activeTab === "letrly" && <AdminLetrlyTab lang={lang} />}

      </div>
    </Layout>
  );
}

interface LetrlyDailyPuzzle {
  id: string;
  word: string;
  hint: string;
  category: string;
  dailyDate: string;
  createdAt: string;
}

const LETRLY_CATEGORIES_LIST = ["general", "animals", "fruits", "cities", "science", "islamic"] as const;
const LETRLY_LENGTHS_LIST = [4, 5, 6] as const;
const LETRLY_CAT_LABEL_AR: Record<string, string> = {
  general: "عام", animals: "حيوانات", fruits: "فواكه", cities: "مدن", science: "علوم", islamic: "إسلامي",
};
const LETRLY_CAT_LABEL_EN: Record<string, string> = {
  general: "General", animals: "Animals", fruits: "Fruits", cities: "Cities", science: "Science", islamic: "Islamic",
};

interface LetrlyBankWord {
  id: string;
  word: string;
  hint: string | null;
  length: number;
  category: string;
  createdAt: string;
}

function AdminLetrlyOptions({ lang }: { lang: string }) {
  const [opts, setOpts] = useState<{ categories: Record<string, boolean>; lengths: Record<string, boolean> } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const r = await fetch(`${API_BASE}/api/letrly/admin/options`, { credentials: "include" });
    if (r.ok) setOpts(await r.json());
  };

  useEffect(() => { load(); }, []);

  const toggleCat = (c: string) => {
    if (!opts) return;
    setOpts({ ...opts, categories: { ...opts.categories, [c]: opts.categories[c] === false ? true : false } });
  };
  const toggleLen = (l: number) => {
    if (!opts) return;
    const k = String(l);
    setOpts({ ...opts, lengths: { ...opts.lengths, [k]: opts.lengths[k] === false ? true : false } });
  };

  const save = async () => {
    if (!opts) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/letrly/admin/options`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts),
      });
      if (r.ok) {
        toast.success(lang === "ar" ? "تم حفظ الخيارات" : "Options saved");
      } else {
        toast.error(lang === "ar" ? "فشل الحفظ" : "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!opts) {
    return (
      <div className="bg-white border border-card-border rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-card-border rounded-2xl p-5 shadow-sm">
      <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-emerald-600" />
        {lang === "ar" ? "خيارات اللعبة" : "Game Options"}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        {lang === "ar"
          ? "تحكّم في التصنيفات وأطوال الكلمات التي يراها الطالب في صفحة الإعداد."
          : "Control which categories and word lengths students can choose from."}
      </p>

      <div className="mb-5">
        <h4 className="text-sm font-bold text-foreground mb-2">{lang === "ar" ? "التصنيفات" : "Categories"}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LETRLY_CATEGORIES_LIST.map((c) => {
            const enabled = opts.categories[c] !== false;
            return (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                  enabled ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-zinc-50 opacity-60"
                }`}
              >
                <span className="text-sm font-bold">
                  {lang === "ar" ? LETRLY_CAT_LABEL_AR[c] : LETRLY_CAT_LABEL_EN[c]}
                </span>
                {enabled ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-zinc-400" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-sm font-bold text-foreground mb-2">{lang === "ar" ? "أطوال الكلمات" : "Word Lengths"}</h4>
        <div className="grid grid-cols-3 gap-2">
          {LETRLY_LENGTHS_LIST.map((l) => {
            const enabled = opts.lengths[String(l)] !== false;
            return (
              <button
                key={l}
                onClick={() => toggleLen(l)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                  enabled ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-zinc-50 opacity-60"
                }`}
              >
                <span className="text-sm font-bold">
                  {lang === "ar" ? `${l} حروف` : `${l} letters`}
                </span>
                {enabled ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-zinc-400" />}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl"
      >
        {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ الخيارات" : "Save Options")}
      </button>
    </div>
  );
}

function AdminLetrlyBank({ lang }: { lang: string }) {
  const [words, setWords] = useState<LetrlyBankWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/letrly/admin/bank`, { credentials: "include" });
      if (r.ok) setWords(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!word.trim()) {
      toast.error(lang === "ar" ? "أدخل الكلمة" : "Enter word");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/letrly/admin/bank`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim(), hint: hint.trim(), category }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d?.error || (lang === "ar" ? "فشل الحفظ" : "Save failed"));
        return;
      }
      toast.success(lang === "ar" ? "أُضيفت إلى البنك" : "Added to bank");
      setWord("");
      setHint("");
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(lang === "ar" ? "حذف هذه الكلمة من البنك؟" : "Delete this word from the bank?")) return;
    const r = await fetch(`${API_BASE}/api/letrly/admin/bank/${id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
      load();
    } else {
      toast.error(lang === "ar" ? "فشل الحذف" : "Delete failed");
    }
  };

  return (
    <div className="bg-white border border-card-border rounded-2xl p-5 shadow-sm">
      <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
        <BookText className="w-5 h-5 text-emerald-600" />
        {lang === "ar" ? "بنك الكلمات" : "Word Bank"}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        {lang === "ar"
          ? "كلمات يضيفها المسؤول وتظهر للجميع كأسئلة عشوائية في وضع اللعب الحرّ."
          : "Words added here appear as random puzzles in solo free play for everyone."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">
            {lang === "ar" ? "الكلمة" : "Word"}
          </label>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            maxLength={10}
            dir="rtl"
            className="w-full px-3 py-2 border-2 border-input rounded-xl font-bold focus:border-primary outline-none"
            placeholder="مثال: كتاب"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">
            {lang === "ar" ? "تلميح" : "Hint"}
          </label>
          <input
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            maxLength={120}
            dir="rtl"
            className="w-full px-3 py-2 border-2 border-input rounded-xl focus:border-primary outline-none"
            placeholder={lang === "ar" ? "اختياري" : "Optional"}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1">
            {lang === "ar" ? "التصنيف" : "Category"}
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border-2 border-input rounded-xl focus:border-primary outline-none bg-white"
          >
            {LETRLY_CATEGORIES_LIST.map((c) => (
              <option key={c} value={c}>
                {lang === "ar" ? LETRLY_CAT_LABEL_AR[c] : LETRLY_CAT_LABEL_EN[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={submit}
        disabled={saving}
        className="mb-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl"
      >
        {saving
          ? (lang === "ar" ? "...جاري الإضافة" : "Adding...")
          : (lang === "ar" ? "أضف إلى البنك" : "Add to Bank")}
      </button>

      <h4 className="text-sm font-bold text-foreground mb-2">
        {lang === "ar" ? `كلمات البنك (${words.length})` : `Bank Words (${words.length})`}
      </h4>
      {loading ? (
        <p className="text-sm text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
      ) : words.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {lang === "ar" ? "لا توجد كلمات في البنك بعد." : "No words in the bank yet."}
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {words.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3 border border-border rounded-xl px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="text-xs font-mono bg-muted px-2 py-1 rounded shrink-0">
                  {lang === "ar" ? LETRLY_CAT_LABEL_AR[w.category] : LETRLY_CAT_LABEL_EN[w.category]} · {w.length}
                </div>
                <div className="font-extrabold text-base truncate" dir="rtl">{w.word}</div>
                {w.hint && <div className="text-xs text-muted-foreground truncate" dir="rtl">— {w.hint}</div>}
              </div>
              <button
                onClick={() => remove(w.id)}
                className="text-red-600 hover:bg-red-50 p-2 rounded-lg shrink-0"
                aria-label="delete"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminLetrlyTab({ lang }: { lang: string }) {
  const [puzzles, setPuzzles] = useState<LetrlyDailyPuzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [category, setCategory] = useState("general");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/letrly/admin/daily`, { credentials: "include" });
      if (r.ok) setPuzzles(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!word.trim() || !date) {
      toast.error(lang === "ar" ? "أدخل الكلمة والتاريخ" : "Enter word and date");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/letrly/admin/daily`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim(), hint: hint.trim(), category, date }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d?.error || (lang === "ar" ? "فشل الحفظ" : "Save failed"));
        return;
      }
      toast.success(lang === "ar" ? "تم حفظ كلمة اليوم" : "Daily word saved");
      setWord("");
      setHint("");
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(lang === "ar" ? "حذف هذه الكلمة؟" : "Delete this word?")) return;
    const r = await fetch(`${API_BASE}/api/letrly/admin/daily/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) {
      toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
      load();
    } else {
      toast.error(lang === "ar" ? "فشل الحذف" : "Delete failed");
    }
  };

  return (
    <div className="space-y-6" dir={lang === "ar" ? "rtl" : "ltr"}>
      <AdminLetrlyOptions lang={lang} />
      <AdminLetrlyBank lang={lang} />
      <div className="bg-white border border-card-border rounded-2xl p-5 shadow-sm">
        <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
          <Type className="w-5 h-5 text-emerald-600" />
          {lang === "ar" ? "تحديد كلمة اليوم" : "Set Daily Word"}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              {lang === "ar" ? "الكلمة (عربية، 4–6 حروف)" : "Word (Arabic, 4–6 letters)"}
            </label>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              maxLength={10}
              dir="rtl"
              className="w-full px-3 py-2 border-2 border-input rounded-xl font-bold text-lg focus:border-primary outline-none"
              placeholder="مثال: مدرسة"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              {lang === "ar" ? "تلميح (اختياري)" : "Hint (optional)"}
            </label>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              maxLength={120}
              dir="rtl"
              className="w-full px-3 py-2 border-2 border-input rounded-xl focus:border-primary outline-none"
              placeholder={lang === "ar" ? "مكان للتعلم" : "Place of learning"}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              {lang === "ar" ? "التصنيف" : "Category"}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border-2 border-input rounded-xl focus:border-primary outline-none bg-white"
            >
              <option value="general">{lang === "ar" ? "عام" : "General"}</option>
              <option value="animals">{lang === "ar" ? "حيوانات" : "Animals"}</option>
              <option value="fruits">{lang === "ar" ? "فواكه" : "Fruits"}</option>
              <option value="cities">{lang === "ar" ? "مدن" : "Cities"}</option>
              <option value="science">{lang === "ar" ? "علوم" : "Science"}</option>
              <option value="islamic">{lang === "ar" ? "إسلامي" : "Islamic"}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">
              {lang === "ar" ? "تاريخ اليوم" : "Date"}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-input rounded-xl focus:border-primary outline-none"
            />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={saving}
          className="mt-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl"
        >
          {saving
            ? lang === "ar" ? "جاري الحفظ..." : "Saving..."
            : lang === "ar" ? "حفظ كلمة اليوم" : "Save Daily Word"}
        </button>
        <p className="text-xs text-muted-foreground mt-2">
          {lang === "ar"
            ? "إذا كانت هناك كلمة محفوظة لنفس التاريخ، سيتم استبدالها."
            : "If a word already exists for that date, it will be replaced."}
        </p>
      </div>

      <div className="bg-white border border-card-border rounded-2xl p-5 shadow-sm">
        <h3 className="text-lg font-extrabold mb-4">
          {lang === "ar" ? "الكلمات اليومية المحفوظة" : "Saved Daily Words"}
        </h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">{lang === "ar" ? "جاري التحميل..." : "Loading..."}</p>
        ) : puzzles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {lang === "ar" ? "لا توجد كلمات محفوظة بعد." : "No saved words yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {puzzles.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border border-border rounded-xl px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="text-xs font-mono bg-muted px-2 py-1 rounded">{p.dailyDate}</div>
                  <div className="font-extrabold text-lg" dir="rtl">{p.word}</div>
                  {p.hint && <div className="text-xs text-muted-foreground" dir="rtl">— {p.hint}</div>}
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                  aria-label="delete"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AdminConvo {
  id: number;
  title: string;
  teacherId: number;
  teacherName: string | null;
  teacherEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminMessage {
  id: number;
  role: string;
  content: string;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costMicroUsd: number | null;
  cached: number;
  createdAt: string;
}

interface AdminStats {
  totals: {
    conversations: number;
    messages: number;
    cacheEntries: number;
    cacheHits: number;
    totalCostMicroUsd: number;
  };
  today: {
    messages: number;
    costMicroUsd: number;
  };
}

function AdminAiChatTab({ lang }: { lang: string }) {
  const [convos, setConvos] = useState<AdminConvo[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedMsgs, setSelectedMsgs] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [instructionsDraft, setInstructionsDraft] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/ai-chat/admin/conversations`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/ai-chat/admin/stats`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API_BASE}/api/ai-chat/admin/instructions`, { credentials: "include" }).then(r => r.json()),
    ])
      .then(([c, s, ins]) => {
        setConvos(c.conversations || []);
        setStats(s);
        const txt = ins.content || "";
        setInstructions(txt);
        setInstructionsDraft(txt);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function saveInstructions() {
    setSavingInstructions(true);
    try {
      const r = await fetch(`${API_BASE}/api/ai-chat/admin/instructions`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: instructionsDraft }),
      });
      if (r.ok) {
        setInstructions(instructionsDraft);
        toast.success(lang === "ar" ? "تم الحفظ ✓" : "Saved ✓");
      } else {
        toast.error(lang === "ar" ? "فشل الحفظ" : "Save failed");
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ" : "Error");
    } finally {
      setSavingInstructions(false);
    }
  }

  async function loadConvo(id: number) {
    setSelectedId(id);
    const r = await fetch(`${API_BASE}/api/ai-chat/admin/conversations/${id}`, { credentials: "include" });
    if (r.ok) {
      const d = await r.json();
      setSelectedMsgs(d.messages || []);
    }
  }

  const fmtCost = (micro: number | null) =>
    micro == null ? "-" : `$${(micro / 1_000_000).toFixed(4)}`;

  if (loading) return <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-6">

      {/* ── Custom Instructions Editor ── */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="font-extrabold text-base text-foreground">
            {lang === "ar" ? "تعليمات مخصصة للمساعد الذكي" : "Custom AI Instructions"}
          </h3>
          <span className="ms-auto text-[11px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border">
            {lang === "ar" ? "تُضاف تلقائياً لكل محادثة" : "Appended to every chat"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {lang === "ar"
            ? "اكتب هنا أي تعليمات أو معلومات تريد أن يعرفها المساعد ويُجيب بناءً عليها. مثال: «إذا سُئلت عن لعبة وميض، أخبر المعلم أنها اللعبة الرئيسية في المنصة وأن...»"
            : "Write any instructions or facts you want the assistant to follow. E.g. «If asked about Wameeth game, tell teachers it is the main game of the platform and that...»"}
        </p>
        <textarea
          value={instructionsDraft}
          onChange={e => setInstructionsDraft(e.target.value)}
          rows={7}
          dir="auto"
          placeholder={lang === "ar" ? "اكتب تعليماتك هنا..." : "Write your instructions here..."}
          className="w-full rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground p-3 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y font-mono leading-relaxed"
        />
        <div className="flex items-center gap-3 justify-end">
          {instructionsDraft !== instructions && (
            <button
              onClick={() => setInstructionsDraft(instructions)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {lang === "ar" ? "تراجع" : "Revert"}
            </button>
          )}
          <button
            onClick={saveInstructions}
            disabled={savingInstructions || instructionsDraft === instructions}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-xl text-sm font-bold transition-colors"
          >
            {savingInstructions
              ? (lang === "ar" ? "جارٍ الحفظ..." : "Saving...")
              : (lang === "ar" ? "حفظ التعليمات" : "Save Instructions")}
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: lang === "ar" ? "محادثات" : "Conversations", v: stats.totals.conversations },
            { label: lang === "ar" ? "رسائل المساعد" : "AI Messages", v: stats.totals.messages },
            { label: lang === "ar" ? "حفظ من الذاكرة" : "Cache Hits", v: stats.totals.cacheHits },
            { label: lang === "ar" ? "اليوم" : "Today", v: stats.today.messages },
            { label: lang === "ar" ? "التكلفة الكلية" : "Total Cost", v: fmtCost(stats.totals.totalCostMicroUsd) },
          ].map((c, i) => (
            <div key={i} className="bg-muted/50 border border-border rounded-xl p-3">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-black mt-1">{c.v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 font-bold text-sm border-b border-border">
            {lang === "ar" ? "المحادثات" : "Conversations"} ({convos.length})
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {convos.map((c) => (
              <button
                key={c.id}
                onClick={() => loadConvo(c.id)}
                className={`w-full text-right px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors ${
                  selectedId === c.id ? "bg-primary/10" : ""
                }`}
              >
                <div className="font-medium text-sm truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{c.teacherName || c.teacherEmail || `#${c.teacherId}`}</span>
                  <span>•</span>
                  <span>{new Date(c.updatedAt).toLocaleString(lang === "ar" ? "ar" : "en")}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 font-bold text-sm border-b border-border">
            {lang === "ar" ? "الرسائل" : "Messages"}
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-3 space-y-2">
            {!selectedId && (
              <div className="text-center text-sm text-muted-foreground py-12">
                {lang === "ar" ? "اختر محادثة لعرضها" : "Select a conversation"}
              </div>
            )}
            {selectedMsgs.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-muted border border-border"
                }`}
              >
                <div className="text-xs font-bold mb-1 flex items-center gap-2 text-muted-foreground">
                  <span>{m.role === "user" ? (lang === "ar" ? "المعلم" : "Teacher") : (lang === "ar" ? "المساعد" : "Assistant")}</span>
                  {m.cached === 1 && <span className="text-[10px]">⚡ {lang === "ar" ? "ذاكرة" : "cache"}</span>}
                  {m.tokensIn != null && (
                    <span className="ml-auto text-[10px]">
                      {m.tokensIn}+{m.tokensOut} tok · {fmtCost(m.costMicroUsd)}
                    </span>
                  )}
                </div>
                <div>{m.content}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
