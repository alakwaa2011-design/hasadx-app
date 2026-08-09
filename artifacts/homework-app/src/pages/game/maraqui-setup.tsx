import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Trophy, Lock, CheckCircle2, Play, Plus, Loader2,
  Search, Pencil, Trash2, FolderPlus, FolderOpen, ChevronDown, ChevronRight,
  Check, X, Gamepad2, Users, Swords,
} from "lucide-react";
import { MultiplayerLobby } from "@/components/multiplayer-lobby";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface MaraquiStage {
  num: number;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  questions: { text: string; options: [string, string, string, string]; correct: number }[];
}

interface MaraquiPath {
  id: number;
  creator_id: number;
  title: string;
  description: string | null;
  pin: string;
  stages: MaraquiStage[];
  is_public: boolean;
  is_approved: boolean;
  group_id: number | null;
  creator_name?: string;
  created_at: string;
}

interface MaraquiGroup {
  id: number;
  name: string;
  teacher_id: number;
  path_count: number;
}

interface ProgressRow {
  id: number;
  path_id: number;
  player_name: string;
  completed_stages: number;
  attempts: number;
  is_complete: boolean;
  completed_at: string | null;
}

const DIFF_BADGE = {
  easy: { ar: "سهل", color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" },
  medium: { ar: "متوسط", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" },
  hard: { ar: "صعب", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
};

export default function MaraquiSetup() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  // ── Player state ──────────────────────────────────────────────────────────
  const [publicPaths, setPublicPaths] = useState<MaraquiPath[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const [activePath, setActivePath] = useState<MaraquiPath | null>(null);
  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [showArenaLobby, setShowArenaLobby] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ProgressRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [playerDisplayName, setPlayerDisplayName] = useState(() => {
    try { return localStorage.getItem("maraqui_player_name") || ""; } catch { return ""; }
  });

  // ── Teacher/Admin state ───────────────────────────────────────────────────
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myTeacherId, setMyTeacherId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"player" | "teacher">("player");
  const [teacherPaths, setTeacherPaths] = useState<MaraquiPath[]>([]);
  const [teacherGroups, setTeacherGroups] = useState<MaraquiGroup[]>([]);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState<{ id: number; name: string } | null>(null);
  const [deletingPath, setDeletingPath] = useState<number | null>(null);
  const [movingPath, setMovingPath] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacherPath, setSelectedTeacherPath] = useState<MaraquiPath | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("arenaPin")) {
      setShowArenaLobby(true);
    }
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/maraqui-paths/public`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setPublicPaths(Array.isArray(d) ? d : []))
      .catch(() => setPublicPaths([]))
      .finally(() => setPublicLoading(false));

    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(async r => {
        setIsTeacher(r.ok);
        if (r.ok) {
          const me = await r.json().catch(() => ({}));
          setMyTeacherId(me?.teacherId ?? me?.id ?? null);
          if (me?.isAdmin) setIsAdmin(true);
          loadTeacherData();
        }
      })
      .catch(() => setIsTeacher(false));

    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get("pin");
    if (pinParam) setPin(pinParam);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pinParam = params.get("pin");
    if (pinParam && pin === pinParam) handleLoadPin(pinParam);
  }, []);

  const loadTeacherData = async () => {
    setTeacherLoading(true);
    try {
      const [pathsRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE}/api/maraqui-paths`, { credentials: "include" }),
        fetch(`${API_BASE}/api/maraqui-groups`, { credentials: "include" }),
      ]);
      if (pathsRes.ok) setTeacherPaths(await pathsRes.json());
      if (groupsRes.ok) setTeacherGroups(await groupsRes.json());
    } catch { /* ignore */ }
    finally { setTeacherLoading(false); }
  };

  // ── Player actions ────────────────────────────────────────────────────────
  const handleLoadPin = async (pinToLoad?: string) => {
    const p = (pinToLoad || pin).trim();
    if (!p) return;
    setPinLoading(true); setPinError("");
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-paths/${p}`);
      if (!res.ok) { setPinError(isRtl ? "كود غير صحيح. تحقق من الـ PIN وحاول مجدداً." : "Invalid PIN. Please try again."); return; }
      const data: MaraquiPath = await res.json();
      setActivePath(data); loadLeaderboard(data.id);
    } catch { setPinError(isRtl ? "حدث خطأ. حاول مجدداً." : "An error occurred."); }
    finally { setPinLoading(false); }
  };

  const loadLeaderboard = async (pathId: number) => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-progress/${pathId}`);
      if (res.ok) setLeaderboard(await res.json());
    } catch { /* ignore */ }
    finally { setLeaderboardLoading(false); }
  };

  const handleSelectPublic = (path: MaraquiPath) => {
    setActivePath(path); setPin(path.pin);
    loadLeaderboard(path.id);
  };

  const handleStartPlay = (stageNum: number) => {
    if (!activePath) return;
    const name = playerDisplayName.trim();
    if (name) {
      try { localStorage.setItem("maraqui_player_name", name); } catch {}
    }
    const nameParam = name ? `&name=${encodeURIComponent(name)}` : "";
    setLocation(`/game/maraqui/play?pin=${activePath.pin}&stage=${stageNum}${nameParam}`);
  };

  const getCompletedStages = (): number => (progress && activePath) ? progress.completed_stages : 0;
  const firstAvailableStage = activePath ? Math.min(getCompletedStages() + 1, activePath.stages.length) : 1;

  // ── Teacher: Group actions ─────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setSavingGroup(true);
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-groups`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ name: newGroupName.trim() }),
      });
      if (!res.ok) throw new Error();
      const g = await res.json() as MaraquiGroup;
      setTeacherGroups(prev => [...prev, { ...g, path_count: 0 }]);
      setNewGroupName(""); setShowCreateGroup(false);
      setExpandedGroups(prev => new Set([...prev, g.id]));
      toast.success(isRtl ? "تم إنشاء المجموعة" : "Group created");
    } catch { toast.error(isRtl ? "فشل إنشاء المجموعة" : "Failed to create group"); }
    finally { setSavingGroup(false); }
  };

  const handleRenameGroup = async (groupId: number, name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-groups/${groupId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setTeacherGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
      setRenamingGroup(null);
      toast.success(isRtl ? "تم تغيير الاسم" : "Renamed");
    } catch { toast.error(isRtl ? "فشل تغيير الاسم" : "Failed to rename"); }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-groups/${groupId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error();
      setTeacherGroups(prev => prev.filter(g => g.id !== groupId));
      setTeacherPaths(prev => prev.map(p => p.group_id === groupId ? { ...p, group_id: null } : p));
      toast.success(isRtl ? "تم حذف المجموعة" : "Group deleted");
    } catch { toast.error(isRtl ? "فشل حذف المجموعة" : "Failed to delete group"); }
  };

  const handleMoveToGroup = async (pathId: number, groupId: number | null) => {
    setMovingPath(pathId);
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-paths/${pathId}/group`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ groupId }),
      });
      if (!res.ok) throw new Error();
      setTeacherPaths(prev => prev.map(p => p.id === pathId ? { ...p, group_id: groupId } : p));
      toast.success(isRtl ? "تم نقل المسار" : "Path moved");
    } catch { toast.error(isRtl ? "فشل نقل المسار" : "Failed to move"); }
    finally { setMovingPath(null); }
  };

  const handleDeletePath = async (pathId: number) => {
    if (!confirm(isRtl ? "هل تريد حذف هذا المسار نهائياً؟" : "Delete this path permanently?")) return;
    setDeletingPath(pathId);
    try {
      const res = await fetch(`${API_BASE}/api/maraqui-paths/${pathId}`, {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) throw new Error();
      setTeacherPaths(prev => prev.filter(p => p.id !== pathId));
      toast.success(isRtl ? "تم حذف المسار" : "Path deleted");
    } catch { toast.error(isRtl ? "فشل الحذف" : "Failed to delete"); }
    finally { setDeletingPath(null); }
  };

  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  // ── Teacher path card ─────────────────────────────────────────────────────
  const TeacherPathCard = ({ path }: { path: MaraquiPath }) => {
    const stages = Array.isArray(path.stages) ? path.stages : [];
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border/60 rounded-2xl p-5 hover:shadow-md hover:border-teal-300/50 dark:hover:border-teal-700/50 transition-all"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-xl shrink-0 shadow-sm">🪜</div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-foreground text-base leading-tight truncate">{path.title}</p>
            {path.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{path.description}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="text-xs font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded-full">
            {stages.length} {isRtl ? "مراحل" : "stages"}
          </span>
          {stages.slice(0, 3).map((s, i) => {
            const d = DIFF_BADGE[s.difficulty];
            return (
              <span key={i} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${d.color}`}>
                {isRtl ? d.ar : s.difficulty}
              </span>
            );
          })}
          {path.creator_name && (
            <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Users className="w-2.5 h-2.5" />{path.creator_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <select
            value={path.group_id ?? ""}
            onChange={e => {
              const val = e.target.value;
              handleMoveToGroup(path.id, val === "" ? null : parseInt(val, 10));
            }}
            disabled={movingPath === path.id}
            className="flex-1 px-2.5 py-1.5 rounded-xl bg-muted/50 border border-border text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-teal-400/30 transition-colors"
          >
            <option value="">{isRtl ? "📂 بدون مجموعة" : "📂 No group"}</option>
            {teacherGroups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {movingPath === path.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500 shrink-0" />}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedTeacherPath(path)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {isRtl ? "عرض وتعديل" : "View & Edit"}
          </button>
          <button
            onClick={() => handleDeletePath(path.id)}
            disabled={deletingPath === path.id}
            className="py-2 px-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            {deletingPath === path.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </motion.div>
    );
  };

  // ── Filtered paths for teacher view ──────────────────────────────────────
  // Admin sees all paths; regular teacher sees only their own
  const visiblePaths = isAdmin ? teacherPaths : teacherPaths.filter(p => p.creator_id === myTeacherId);
  const filteredPaths = visiblePaths.filter(p =>
    !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const ungroupedPaths = filteredPaths.filter(p => !p.group_id);
  const pathsInGroup = (groupId: number) => filteredPaths.filter(p => p.group_id === groupId);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-cyan-950/20 py-8 px-4" dir={dir}>
        <div className="max-w-2xl mx-auto">

          {/* Back button */}
          <motion.div initial={{ opacity: 0, x: isRtl ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} className="mb-4">
            <button
              onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/teacher")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/60 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              <BackArrow className="w-4 h-4" />
              {isRtl ? "رجوع" : "Back"}
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-2xl shadow-teal-500/30 mb-4 text-5xl">🪜</div>
            <h1 className="text-3xl font-black text-foreground mb-1">{isRtl ? "مَراقي" : "Maraqui"}</h1>
            <p className="text-muted-foreground text-sm">{isRtl ? "ترتقي بثقافتك في مراحل ممتعة" : "Elevate your knowledge through engaging stages"}</p>
          </motion.div>

          {/* ── PLAYER VIEW ── */}
          {!activePath && activeTab === "player" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {publicLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
              ) : publicPaths.length > 0 ? (
                <div className="space-y-3">
                  {publicPaths.map(path => {
                    let savedCompleted = 0;
                    try { savedCompleted = parseInt(localStorage.getItem(`maraqui_progress_${path.id}`) || "0", 10) || 0; } catch {}
                    const hasProgress = savedCompleted > 0 && savedCompleted < path.stages.length;
                    const resumeStage = Math.min(savedCompleted + 1, path.stages.length);
                    const isComplete = savedCompleted >= path.stages.length;
                    return (
                      <motion.div
                        key={path.id}
                        whileHover={{ y: -1 }}
                        className="bg-card border border-border/60 rounded-2xl p-5 hover:border-teal-400/50 hover:shadow-xl hover:shadow-teal-500/10 transition-all"
                      >
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-3xl shrink-0 shadow-md shadow-teal-500/20">🪜</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-foreground text-lg leading-tight">{path.title}</p>
                            {path.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{path.description}</p>}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <span className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2.5 py-1 rounded-full">
                                {path.stages.length} {isRtl ? "مراحل" : "stages"}
                              </span>
                              {path.stages.slice(0, 2).map((s, i) => {
                                const d = DIFF_BADGE[s.difficulty];
                                return (
                                  <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.color}`}>
                                    {isRtl ? d.ar : s.difficulty}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Progress indicator */}
                        {hasProgress && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                                {isRtl ? `المرحلة ${savedCompleted} من ${path.stages.length} مكتملة` : `${savedCompleted} of ${path.stages.length} stages done`}
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all"
                                style={{ width: `${Math.round((savedCompleted / path.stages.length) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {isComplete && (
                          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-teal-600 dark:text-teal-400">
                            <CheckCircle2 className="w-4 h-4" />
                            {isRtl ? "أكملت هذا المسار ✅" : "Completed ✅"}
                          </div>
                        )}

                        <button
                          onClick={() => {
                            const name = playerDisplayName.trim();
                            if (name) { try { localStorage.setItem("maraqui_player_name", name); } catch {} }
                            const nameParam = name ? `&name=${encodeURIComponent(name)}` : "";
                            const stage = hasProgress ? resumeStage : 1;
                            setLocation(`/game/maraqui/play?pin=${path.pin}&stage=${stage}${nameParam}`);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black shadow-md hover:shadow-teal-500/30 transition-all text-base"
                        >
                          <Play className="w-5 h-5" />
                          {hasProgress
                            ? (isRtl ? `استأنف من المرحلة ${resumeStage} ▶` : `Resume Stage ${resumeStage} ▶`)
                            : isComplete
                              ? (isRtl ? "العب مجدداً 🔁" : "Play Again 🔁")
                              : (isRtl ? "ابدأ اللعبة" : "Start Game")}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-5xl mb-3">🪜</p>
                  <p className="font-bold text-foreground mb-1">{isRtl ? "لا توجد مسارات عامة بعد" : "No public paths yet"}</p>
                  <p className="text-sm text-muted-foreground">{isRtl ? "سيضيف المسؤول مسارات قريباً" : "Paths will be added soon"}</p>
                </div>
              )}

              {/* Player name input */}
              <div className="bg-teal-50/60 dark:bg-teal-900/10 border border-teal-200/50 dark:border-teal-800/30 rounded-2xl p-4">
                <label className="block text-sm font-bold text-teal-700 dark:text-teal-400 mb-2">
                  {isRtl ? "اسمك في لوحة الصدارة" : "Your leaderboard name"}
                </label>
                <input
                  type="text"
                  value={playerDisplayName}
                  onChange={e => { setPlayerDisplayName(e.target.value); try { localStorage.setItem("maraqui_player_name", e.target.value); } catch {} }}
                  placeholder={isRtl ? "أدخل اسمك..." : "Enter your name..."}
                  maxLength={32}
                  className="w-full px-3 py-2.5 rounded-xl border border-teal-300/50 dark:border-teal-700/50 bg-white dark:bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/50 placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {isRtl ? "اختياري — يظهر اسمك في لوحة الصدارة عند الإكمال" : "Optional — shown on the leaderboard when you complete stages"}
                </p>
              </div>

              {/* All teachers: create + manage buttons at bottom */}
              {isTeacher && (
                <div className="pt-3 border-t border-border/30 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setLocation("/game/maraqui/create")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {isRtl ? "إنشاء مسابقة" : "New competition"}
                  </button>
                  <button
                    onClick={() => { setActiveTab("teacher"); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    {isRtl ? "مسابقاتي" : "My paths"}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── ACTIVE PATH (Player) ── */}
          {activePath && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-foreground">{activePath.title}</h2>
                    {activePath.description && <p className="text-sm text-muted-foreground mt-1">{activePath.description}</p>}
                  </div>
                  <button
                    onClick={() => { setActivePath(null); setProgress(null); setLeaderboard([]); }}
                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors shrink-0"
                  >
                    <BackArrow className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded-full">
                    {activePath.stages.length} {isRtl ? "مراحل" : "stages"}
                  </span>
                </div>
              </div>

              <div className="bg-teal-50/50 dark:bg-teal-900/10 border border-teal-200/50 dark:border-teal-800/30 rounded-2xl p-4">
                <label className="block text-sm font-bold text-teal-700 dark:text-teal-400 mb-2">
                  {isRtl ? "اسمك في لوحة الصدارة" : "Your leaderboard name"}
                </label>
                <input
                  type="text"
                  value={playerDisplayName}
                  onChange={e => setPlayerDisplayName(e.target.value)}
                  placeholder={isRtl ? "أدخل اسمك..." : "Enter your name..."}
                  maxLength={32}
                  className="w-full px-3 py-2.5 rounded-xl border border-teal-300/50 dark:border-teal-700/50 bg-white dark:bg-card text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/50 placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {isRtl ? "اختياري — يظهر اسمك للجميع في لوحة الصدارة" : "Optional — your name appears on the leaderboard"}
                </p>
              </div>

              <div>
                <h3 className="text-base font-black text-foreground mb-3">{isRtl ? "المراحل" : "Stages"}</h3>
                <div className="space-y-2">
                  {activePath.stages.map((stage, i) => {
                    const completedCount = getCompletedStages();
                    const isCompleted = i < completedCount;
                    const isAvailable = i < completedCount + 1;
                    const diff = DIFF_BADGE[stage.difficulty];
                    return (
                      <motion.div
                        key={stage.num}
                        initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                          isCompleted
                            ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800/50"
                            : isAvailable
                              ? "bg-card border-border/60 hover:border-teal-400/50 hover:shadow-md cursor-pointer"
                              : "bg-muted/30 border-border/20 opacity-60"
                        }`}
                        onClick={() => isAvailable && handleStartPlay(stage.num)}
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm ${
                          isCompleted ? "bg-teal-500" : isAvailable ? "bg-gradient-to-br from-teal-400 to-emerald-500" : "bg-muted"
                        }`}>
                          {isCompleted ? "✅" : isAvailable ? "🟢" : <Lock className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-foreground">{stage.name || (isRtl ? `المرحلة ${stage.num}` : `Stage ${stage.num}`)}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${diff.color}`}>{isRtl ? diff.ar : stage.difficulty}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{stage.questions.length} {isRtl ? "سؤال" : "questions"}</p>
                        </div>
                        {isAvailable && !isCompleted && (
                          <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-bold shrink-0">
                            <Play className="w-3 h-3" />
                            {isRtl ? "ابدأ" : "Play"}
                          </span>
                        )}
                        {isCompleted && <CheckCircle2 className="w-5 h-5 text-teal-500 shrink-0" />}
                        {!isAvailable && <Lock className="w-4 h-4 text-muted-foreground shrink-0" />}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-col gap-2 items-center">
                  <button
                    onClick={() => handleStartPlay(firstAvailableStage)}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black shadow-lg hover:shadow-teal-500/30 transition-all"
                  >
                    <Play className="w-4 h-4" />
                    {isRtl ? "ابدأ اللعبة" : "Start Game"}
                  </button>
                  <button
                    onClick={() => setShowArenaLobby(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black shadow-lg hover:shadow-indigo-500/30 transition-all"
                  >
                    <Swords className="w-4 h-4" />
                    {isRtl ? "تحدِّ صديقاً (Arena) ⚔️" : "Challenge a Friend (Arena) ⚔️"}
                  </button>
                  <AnimatePresence>
                    {showArenaLobby && activePath && (
                      <MultiplayerLobby
                        gameId="maraqui"
                        gameTitle={activePath.title}
                        playUrl={`/game/maraqui/play?pin=${activePath.pin}&stage=1`}
                        playerName={playerDisplayName}
                        onClose={() => setShowArenaLobby(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {leaderboard.length > 0 && (
                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                  <h3 className="text-base font-black text-foreground mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    {isRtl ? "المتصدرون" : "Leaderboard"}
                  </h3>
                  {leaderboardLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>
                  ) : (
                    <div className="space-y-2">
                      {leaderboard.filter(r => r.is_complete).slice(0, 10).map((row, i) => (
                        <div key={row.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                          <span className="w-6 text-center font-black text-sm text-muted-foreground">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                          </span>
                          <span className="flex-1 font-bold text-sm text-foreground truncate">{row.player_name}</span>
                          <span className="text-xs text-teal-600 font-bold">{row.attempts} {isRtl ? "محاولة" : "attempts"}</span>
                        </div>
                      ))}
                      {leaderboard.filter(r => !r.is_complete).length > 0 && (
                        <div className="pt-2 border-t border-border/30">
                          <p className="text-xs font-bold text-muted-foreground mb-1">{isRtl ? "قيد التقدم" : "In progress"}</p>
                          {leaderboard.filter(r => !r.is_complete).slice(0, 5).map(row => (
                            <div key={row.id} className="flex items-center gap-3 py-1.5">
                              <span className="w-6" />
                              <span className="flex-1 font-medium text-sm text-muted-foreground truncate">{row.player_name}</span>
                              <span className="text-xs text-muted-foreground">{row.completed_stages}/{activePath.stages.length} {isRtl ? "مراحل" : "stages"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── TEACHER MANAGE VIEW (create/edit/delete own paths) ── */}
          {activeTab === "teacher" && isTeacher && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

              {/* Actions bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTab("player")}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-card border border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <BackArrow className="w-4 h-4" />
                  {isRtl ? "للاعبين" : "Players"}
                </button>
                <button
                  onClick={() => setLocation("/game/maraqui/create")}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm font-bold shadow-sm hover:shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {isRtl ? "مسار جديد" : "New Path"}
                </button>
                <button
                  onClick={() => { setShowCreateGroup(true); setNewGroupName(""); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-card border border-border text-sm font-bold text-foreground hover:bg-muted/50 transition-colors"
                >
                  <FolderPlus className="w-4 h-4 text-teal-500" />
                  {isRtl ? "مجموعة جديدة" : "New Group"}
                </button>
                <button
                  onClick={loadTeacherData}
                  disabled={teacherLoading}
                  className="p-2.5 rounded-xl bg-card border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  {teacherLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>

              {/* Teacher path preview panel */}
              <AnimatePresence>
                {selectedTeacherPath && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-card border border-teal-300 dark:border-teal-700 rounded-2xl shadow-lg overflow-hidden"
                  >
                    <div className="flex items-start gap-3 p-5 border-b border-border/40">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-2xl shrink-0 shadow-sm">🪜</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-foreground text-lg leading-tight">{selectedTeacherPath.title}</h3>
                        {selectedTeacherPath.description && (
                          <p className="text-sm text-muted-foreground mt-1">{selectedTeacherPath.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded-full">
                            {selectedTeacherPath.stages.length} {isRtl ? "مراحل" : "stages"}
                          </span>
                          <span className="text-[10px] font-mono text-teal-600 bg-muted px-2 py-0.5 rounded-full tracking-widest" dir="ltr">
                            {selectedTeacherPath.pin}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedTeacherPath(null)}
                        className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Stage summary */}
                    <div className="p-4 space-y-1.5 max-h-52 overflow-y-auto">
                      {selectedTeacherPath.stages.map((stage, i) => {
                        const diff = DIFF_BADGE[stage.difficulty];
                        return (
                          <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-muted/30">
                            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-black shrink-0">{stage.num}</span>
                            <span className="flex-1 text-sm font-bold text-foreground truncate">{stage.name || (isRtl ? `المرحلة ${stage.num}` : `Stage ${stage.num}`)}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${diff.color}`}>{isRtl ? diff.ar : stage.difficulty}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{stage.questions.length} {isRtl ? "سؤال" : "q"}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* CTA */}
                    <div className="p-4 border-t border-border/40 flex gap-2">
                      <button
                        onClick={() => { setSelectedTeacherPath(null); setLocation(`/game/maraqui/create?edit=${selectedTeacherPath.id}`); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm font-black shadow-sm hover:shadow-teal-500/30 transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                        {isRtl ? "تعديل الأسئلة" : "Edit Questions"}
                      </button>
                      <button
                        onClick={() => setSelectedTeacherPath(null)}
                        className="px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
                      >
                        {isRtl ? "إغلاق" : "Close"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Create group form */}
              <AnimatePresence>
                {showCreateGroup && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-card border border-teal-200 dark:border-teal-800/50 rounded-2xl p-4 flex gap-2 items-center">
                      <FolderPlus className="w-4 h-4 text-teal-500 shrink-0" />
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleCreateGroup(); if (e.key === "Escape") setShowCreateGroup(false); }}
                        placeholder={isRtl ? "اسم المجموعة..." : "Group name..."}
                        maxLength={60}
                        autoFocus
                        className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400 transition-colors"
                      />
                      <button
                        onClick={handleCreateGroup}
                        disabled={!newGroupName.trim() || savingGroup}
                        className="p-2.5 rounded-xl bg-teal-500 text-white hover:bg-teal-600 transition-colors disabled:opacity-40"
                      >
                        {savingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setShowCreateGroup(false)} className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Search */}
              {visiblePaths.length > 4 && (
                <div className="relative">
                  <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRtl ? "right-3" : "left-3"}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? "بحث في المسارات..." : "Search paths..."}
                    className={`w-full px-4 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400/30 transition-colors ${isRtl ? "pr-9" : "pl-9"}`}
                  />
                </div>
              )}

              {teacherLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-teal-500 animate-spin" /></div>
              ) : (
                <>
                  {/* Ungrouped paths */}
                  {ungroupedPaths.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5" />
                        {isRtl ? "بدون مجموعة" : "Ungrouped"}
                        <span className="bg-muted/70 px-1.5 py-0.5 rounded-full text-[10px]">{ungroupedPaths.length}</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ungroupedPaths.map(path => <TeacherPathCard key={path.id} path={path} />)}
                      </div>
                    </div>
                  )}

                  {/* Groups */}
                  {teacherGroups.map(group => {
                    const groupPaths = pathsInGroup(group.id);
                    const isExpanded = expandedGroups.has(group.id);
                    return (
                      <div key={group.id} className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex items-center gap-3 p-4">
                          <button
                            onClick={() => toggleGroup(group.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-start"
                          >
                            <span className="text-lg">{isExpanded ? "📂" : "📁"}</span>
                            {renamingGroup?.id === group.id ? (
                              <input
                                type="text"
                                value={renamingGroup.name}
                                onChange={e => setRenamingGroup({ id: group.id, name: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === "Enter") handleRenameGroup(group.id, renamingGroup.name);
                                  if (e.key === "Escape") setRenamingGroup(null);
                                }}
                                onClick={e => e.stopPropagation()}
                                autoFocus
                                maxLength={60}
                                className="flex-1 px-3 py-1 rounded-lg bg-background border border-teal-400 text-foreground text-sm font-bold focus:outline-none"
                              />
                            ) : (
                              <span className="font-black text-foreground text-sm truncate">{group.name}</span>
                            )}
                            <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full shrink-0">
                              {groupPaths.length}
                            </span>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            {renamingGroup?.id === group.id ? (
                              <>
                                <button
                                  onClick={() => handleRenameGroup(group.id, renamingGroup.name)}
                                  className="p-1.5 rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setRenamingGroup(null)}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setRenamingGroup({ id: group.id, name: group.name })}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(isRtl ? `حذف مجموعة "${group.name}"؟ ستبقى المسارات بدون مجموعة.` : `Delete group "${group.name}"? Paths will become ungrouped.`)) {
                                      handleDeleteGroup(group.id);
                                    }
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-1 border-t border-border/40">
                                {groupPaths.length === 0 ? (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    {isRtl ? "لا توجد مسارات في هذه المجموعة" : "No paths in this group"}
                                  </p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                    {groupPaths.map(path => <TeacherPathCard key={path.id} path={path} />)}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {visiblePaths.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-3">🪜</div>
                      <p className="font-bold text-foreground mb-1">{isRtl ? "لا توجد مسارات بعد" : "No paths yet"}</p>
                      <p className="text-sm text-muted-foreground mb-4">{isRtl ? "أنشئ أول مسار مَراقي الآن" : "Create your first Maraqui path"}</p>
                      <button
                        onClick={() => setLocation("/game/maraqui/create")}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-sm font-bold shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        {isRtl ? "إنشاء مسار" : "Create Path"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

        </div>
      </div>
    </Layout>
  );
}
