import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Play, Users, Swords, Sparkles, Check, Trophy,
  Plus, Trash2, ChevronRight, ChevronLeft, X, UserPlus, LogIn, Lock,
  ChevronDown, Award, Image as ImageIcon, Upload, Edit3, Globe, FolderPlus,
  Save, Camera, Crown,
} from "lucide-react";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import {
  ARENA_SECTIONS, HELPERS, buildCustomSection, coverForIndex,
  type ArenaCustomQuestion, type ArenaDifficulty, type ArenaSection,
  type ArenaSubCategory, type ArenaCover, type HelperId,
  type MemoryPair, type CategorizeGroup, type SinJeemPrompt,
} from "@/data/arena-questions";
import { saveArenaState, loadArenaLastSettings, saveArenaLastSettings, type ArenaState } from "@/lib/arena-store";
import {
  fetchArenaCategories, fetchArenaActivities, buildDbSections,
  createArenaCategory, updateArenaCategory, deleteArenaCategory,
  createArenaActivity, updateArenaActivity, deleteArenaActivity,
  uploadImageFile, type DbArenaCategory, type DbArenaActivity,
} from "@/lib/arena-content";
import { toast } from "@/components/ui/sonner";

const TEAM_COLORS = [
  { color: "#2563eb", name: "أزرق" },
  { color: "#dc2626", name: "أحمر" },
  { color: "#16a34a", name: "أخضر" },
  { color: "#d97706", name: "ذهبي" },
  { color: "#7c3aed", name: "بنفسجي" },
  { color: "#0891b2", name: "تركواز" },
  { color: "#ea580c", name: "برتقالي" },
  { color: "#db2777", name: "وردي" },
];

const TEAM_EMOJIS = [
  "🦅", "🦁", "🐅", "🐺", "🦊", "🐉", "🐎", "🦬",
  "⚔️", "🛡️", "🏆", "👑", "⚜️", "🎖️", "🏅", "🎯",
  "⭐", "🔥", "🌾", "💎", "🏯", "⛰️", "📜", "✨",
];

const DIFFICULTIES: ArenaDifficulty[] = [200, 400, 600, 800];

const DIFF_CHIP_STYLES: Record<number, { text: string; bg: string; activeBg: string; border: string }> = {
  200: { text: "#93c5fd", bg: "rgba(36,87,168,0.20)", activeBg: "rgba(36,87,168,0.60)", border: "rgba(36,87,168,0.55)" },
  400: { text: "#c4b5fd", bg: "rgba(85,37,168,0.20)", activeBg: "rgba(85,37,168,0.60)", border: "rgba(85,37,168,0.55)" },
  600: { text: "#fca5a5", bg: "rgba(146,35,64,0.20)", activeBg: "rgba(146,35,64,0.60)", border: "rgba(146,35,64,0.55)" },
  800: { text: "#fde68a", bg: "rgba(180,83,9,0.20)", activeBg: "rgba(180,83,9,0.65)", border: "rgba(180,83,9,0.65)" },
};

function DiffChips({ value, onChange }: { value: ArenaDifficulty; onChange: (d: ArenaDifficulty) => void }) {
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {DIFFICULTIES.map(d => {
        const c = DIFF_CHIP_STYLES[d];
        const selected = d === value;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className="px-2 py-1 rounded-md text-[11px] font-black border transition-all"
            style={{
              color: c.text,
              background: selected ? c.activeBg : c.bg,
              borderColor: selected ? c.text : c.border,
              boxShadow: selected && d === 800 ? `0 0 6px rgba(253,230,138,0.45)` : undefined,
              opacity: selected ? 1 : 0.65,
              outline: selected ? `1.5px solid ${c.text}` : undefined,
              outlineOffset: "1px",
            }}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

interface TeamFormState {
  name: string;
  color: string;
  emoji: string;
  subCategoryIds: string[];
  helpers: HelperId[];
  players: string[];
}

type Step = 1 | 2 | 3;

const defaultTeam = (idx: number): TeamFormState => ({
  name: `الفريق ${idx + 1}`,
  color: TEAM_COLORS[idx % TEAM_COLORS.length].color,
  emoji: TEAM_EMOJIS[idx % TEAM_EMOJIS.length],
  subCategoryIds: [],
  helpers: [],
  players: [],
});

export default function ArenaSetup() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const { data: teacherData, isLoading: teacherAuthLoading } =
    useGetCurrentTeacher({ query: { retry: false } as any });
  const isLoggedIn = teacherAuthLoading ? null : !!teacherData;
  const isAdmin = !!(teacherData as any)?.isAdmin;

  const [resumeGame, setResumeGame] = useState<ArenaState | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [tournamentName, setTournamentName] = useState(
    () => loadArenaLastSettings()?.tournamentName ?? "",
  );
  const [teams, setTeams] = useState<TeamFormState[]>([
    { name: "الفريق الأول", color: TEAM_COLORS[0].color, emoji: "🦅", subCategoryIds: [], helpers: [], players: [] },
    { name: "الفريق الثاني", color: TEAM_COLORS[1].color, emoji: "🦁", subCategoryIds: [], helpers: [], players: [] },
  ]);
  const [showEmoji, setShowEmoji] = useState<boolean[]>([false, false]);
  const [showColors, setShowColors] = useState<boolean[]>([false, false]);
  const [playerDraft, setPlayerDraft] = useState<string[]>(["", ""]);
  const [timerSeconds, setTimerSeconds] = useState(20);
  const [customQuestions, setCustomQuestions] = useState<ArenaCustomQuestion[]>([]);

  // DB-sourced categories & activities
  const [dbCats, setDbCats] = useState<DbArenaCategory[]>([]);
  const [dbActs, setDbActs] = useState<DbArenaActivity[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<DbArenaCategory | null>(null);

  // Check for a server-saved game on first login
  useEffect(() => {
    if (!isLoggedIn || resumeChecked) return;
    setResumeChecked(true);
    (async () => {
      try {
        const res = await fetch("/api/arena/save");
        if (res.ok) {
          const data = await res.json() as { state: ArenaState };
          if (data.state && data.state.subCategoryIds?.length) {
            setResumeGame(data.state);
          }
        }
      } catch { /* silent */ }
    })();
  }, [isLoggedIn, resumeChecked]);

  useEffect(() => {
    if (!isLoggedIn) return;
    (async () => {
      const cats = await fetchArenaCategories();
      setDbCats(cats);
      if (cats.length > 0) {
        const acts = await fetchArenaActivities(cats.map(c => c.id));
        setDbActs(acts);
      }
    })();
  }, [isLoggedIn]);

  const reloadDbContent = async () => {
    const cats = await fetchArenaCategories();
    setDbCats(cats);
    if (cats.length > 0) {
      const acts = await fetchArenaActivities(cats.map(c => c.id));
      setDbActs(acts);
    } else {
      setDbActs([]);
    }
  };

  // Build virtual sections for DB content. Show ALL admin-public + own categories
  // (no gating by selection) so users can see everything available.
  const dbSelectedIds = useMemo(() => new Set(dbCats.map(c => c.id)), [dbCats]);
  const { sections: dbSections, mergedSubsByStaticId } = useMemo(
    () => buildDbSections(dbCats, dbActs, dbSelectedIds),
    [dbCats, dbActs, dbSelectedIds],
  );

  // All sections for the picker: inject DB sub-cats into matching static sections,
  // then append any DB sections that have no static counterpart, then custom.
  const sectionsForPicker = useMemo<ArenaSection[]>(() => {
    const custom = buildCustomSection(customQuestions);
    const enriched = ARENA_SECTIONS.map(sec => {
      const extra = mergedSubsByStaticId[sec.id];
      if (!extra || extra.length === 0) return sec;
      return { ...sec, subCategories: [...sec.subCategories, ...extra] };
    });
    const all: ArenaSection[] = [...enriched, ...dbSections];
    if (custom) all.push(custom);
    return all;
  }, [customQuestions, dbSections, mergedSubsByStaticId]);

  const addTeam = () => {
    if (teams.length >= 8) { toast.error("الحد الأقصى 8 فرق"); return; }
    const idx = teams.length;
    setTeams(prev => [...prev, defaultTeam(idx)]);
    setShowEmoji(prev => [...prev, false]);
    setShowColors(prev => [...prev, false]);
    setPlayerDraft(prev => [...prev, ""]);
  };

  const removeTeam = (idx: number) => {
    if (teams.length <= 2) { toast.error("الحد الأدنى فريقان"); return; }
    setTeams(prev => prev.filter((_, i) => i !== idx));
    setShowEmoji(prev => prev.filter((_, i) => i !== idx));
    setShowColors(prev => prev.filter((_, i) => i !== idx));
    setPlayerDraft(prev => prev.filter((_, i) => i !== idx));
  };

  const updateTeam = (idx: number, patch: Partial<TeamFormState>) => {
    setTeams(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const toggleEmoji = (idx: number) => setShowEmoji(prev => prev.map((v, i) => i === idx ? !v : v));
  const toggleColors = (idx: number) => setShowColors(prev => prev.map((v, i) => i === idx ? !v : v));

  const toggleSub = (teamIdx: number, id: string) => {
    const takenByOther = teams.some((t, i) => i !== teamIdx && t.subCategoryIds.includes(id));
    if (takenByOther) { toast.error("هذه الفئة اختارها فريق آخر"); return; }
    const current = teams[teamIdx].subCategoryIds;
    let next: string[];
    if (current.includes(id)) next = current.filter(x => x !== id);
    else {
      if (current.length >= 3) { toast.error("لا يمكن اختيار أكثر من 3 فئات لكل فريق"); return; }
      next = [...current, id];
    }
    updateTeam(teamIdx, { subCategoryIds: next });
  };

  const toggleHelper = (teamIdx: number, id: HelperId) => {
    const current = teams[teamIdx].helpers;
    let next: HelperId[];
    if (current.includes(id)) next = current.filter(x => x !== id);
    else {
      if (current.length >= 3) { toast.error("لا يمكن اختيار أكثر من 3 وسائل مساعدة لكل فريق"); return; }
      next = [...current, id];
    }
    updateTeam(teamIdx, { helpers: next });
  };

  const addPlayer = (teamIdx: number) => {
    const name = playerDraft[teamIdx]?.trim();
    if (!name) return;
    const current = teams[teamIdx].players;
    if (current.includes(name)) { toast.error("هذا الاسم موجود مسبقاً"); return; }
    if (current.length >= 12) { toast.error("الحد الأقصى 12 لاعباً لكل فريق"); return; }
    updateTeam(teamIdx, { players: [...current, name] });
    setPlayerDraft(prev => prev.map((v, i) => i === teamIdx ? "" : v));
  };

  const removePlayer = (teamIdx: number, name: string) =>
    updateTeam(teamIdx, { players: teams[teamIdx].players.filter(p => p !== name) });

  const allSelected = useMemo(
    () => new Set(teams.flatMap(t => t.subCategoryIds)),
    [teams],
  );

  const step1Valid = teams.every(t => t.name.trim());
  const step2Valid = teams.every(t => t.subCategoryIds.length === 3);
  const step3Valid = teams.every(t => t.helpers.length === 3);
  const canStart = step1Valid && step2Valid && step3Valid;

  const goNext = () => {
    if (step === 1 && !step1Valid) { toast.error("اكتب اسم لكل فريق"); return; }
    if (step === 2 && !step2Valid) { toast.error("اختر 3 فئات لكل فريق"); return; }
    if (step < 3) setStep((step + 1) as Step);
  };
  const goPrev = () => { if (step > 1) setStep((step - 1) as Step); };

  const start = () => {
    if (!canStart) { toast.error("اكمل اختيار 3 فئات و 3 وسائل مساعدة لكل فريق"); return; }
    const teamsRecord: Record<string, { name: string; color: string; emoji: string; score: number; helpers: HelperId[]; usedHelpers: HelperId[]; players: string[] }> = {};
    const teamOrder: string[] = [];
    for (let i = 0; i < teams.length; i++) {
      const id = `T${i + 1}`;
      teamOrder.push(id);
      teamsRecord[id] = {
        name: teams[i].name.trim(),
        color: teams[i].color,
        emoji: teams[i].emoji,
        score: 0,
        helpers: teams[i].helpers,
        usedHelpers: [],
        players: teams[i].players,
      };
    }
    saveArenaLastSettings({
      timerSeconds,
      tournamentName: tournamentName.trim(),
      teams: teams.map(t => ({
        name: t.name.trim(),
        color: t.color,
        emoji: t.emoji,
        subCategoryIds: t.subCategoryIds,
        helpers: t.helpers,
      })),
    });
    saveArenaState({
      tournamentName: tournamentName.trim(),
      teams: teamsRecord,
      teamOrder,
      subCategoryIds: teams.flatMap(t => t.subCategoryIds),
      customQuestions,
      dbSections,
      timerSeconds,
      currentTurn: teamOrder[0],
      usedCards: [],
      pickedQuestions: {},
      active: null,
      rulesAck: false,
      startedAt: Date.now(),
    });
    setLocation("/game/arena/play");
  };

  if (isLoggedIn === false) {
    return (
      <Layout>
        <div dir={dir} className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6" style={{
          background: "linear-gradient(180deg, #1E4D35 0%, #0F2A20 45%, #0A1F18 100%)",
        }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl rounded-3xl p-8 sm:p-10 border-4 text-center backdrop-blur-sm"
            style={{
              background: "linear-gradient(160deg, rgba(6,78,59,0.95), rgba(2,44,34,0.95))",
              borderColor: "rgba(245,158,11,0.55)",
              boxShadow: "0 20px 60px -20px rgba(245,158,11,0.4)",
            }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-400/15 border-2 border-amber-300/40 mb-4">
              <Lock className="w-10 h-10 text-amber-300" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-amber-200 mb-3">
              تسجيل الدخول مطلوب
            </h1>
            <p className="text-emerald-100/85 text-base sm:text-lg leading-relaxed mb-6">
              تحدّي حصاد لعبة منظّمة للمعلّمين والمدرّبين — يحتاج حسابك حتى نحفظ تقدّم اللعبة وأسئلتك المخصّصة.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/login">
                <button className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-extrabold text-lg bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 inline-flex items-center justify-center gap-2 shadow-xl">
                  <LogIn className="w-5 h-5" />
                  تسجيل الدخول
                </button>
              </Link>
              <Link href="/games">
                <button className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20">
                  العودة للألعاب
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* ── Resume game dialog ─────────────────────────────────────── */}
      <AnimatePresence>
        {resumeGame && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              dir="rtl"
              className="w-full max-w-md rounded-3xl p-7 border-2 text-center"
              style={{
                background: "linear-gradient(160deg, #0c2e1e 0%, #081f14 100%)",
                borderColor: "rgba(245,158,11,0.5)",
                boxShadow: "0 24px 64px -16px rgba(0,0,0,0.8), 0 0 0 1px rgba(245,158,11,0.15)",
              }}
            >
              <div className="text-5xl mb-3">⚔️</div>
              <h2 className="text-2xl font-black text-amber-200 mb-1">لعبة في منتصف الطريق!</h2>
              {resumeGame.tournamentName && (
                <p className="text-amber-300/80 font-bold text-sm mb-3">
                  {resumeGame.tournamentName}
                </p>
              )}

              {/* Snapshot of team scores */}
              <div className="flex gap-2 justify-center flex-wrap mb-5 mt-3">
                {resumeGame.teamOrder.map(id => {
                  const t = resumeGame.teams[id];
                  if (!t) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                      style={{
                        background: `${t.color}18`,
                        borderColor: `${t.color}55`,
                      }}
                    >
                      <span className="text-xl">{t.emoji}</span>
                      <div className="text-start">
                        <div className="text-xs font-bold text-white/80">{t.name}</div>
                        <div className="text-base font-black tabular-nums" style={{ color: t.color }}>
                          {t.score.toLocaleString("ar-SA")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-emerald-100/60 text-sm mb-5">
                يمكنك الاستمرار من حيث توقفت أو بدء لعبة جديدة.
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    saveArenaState({ ...resumeGame, rulesAck: true });
                    setLocation("/game/arena/play");
                  }}
                  className="w-full py-3.5 rounded-xl font-black text-lg text-emerald-950 transition-all shadow-lg"
                  style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
                >
                  استمرار اللعبة ▶
                </button>
                <button
                  onClick={async () => {
                    await fetch("/api/arena/save", { method: "DELETE" }).catch(() => {});
                    setResumeGame(null);
                  }}
                  className="w-full py-3 rounded-xl font-bold text-white/70 hover:text-white border border-white/15 hover:border-white/30 transition-all"
                >
                  بدء لعبة جديدة
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div dir={dir} className="min-h-[calc(100vh-4rem)] py-4 sm:py-8" style={{
        background: "linear-gradient(180deg, #1E4D35 0%, #0F2A20 45%, #0A1F18 100%)",
      }}>
        <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
          <Link href="/games">
            <button className="inline-flex items-center gap-2 text-sm font-bold text-amber-200/90 hover:text-amber-100 mb-4">
              <BackIcon className="w-4 h-4" />
              عودة للألعاب
            </button>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-5"
          >
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-amber-400/15 text-amber-300 text-[10px] sm:text-xs font-bold mb-3 border border-amber-300/30 max-w-full">
              <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">ميدان المعرفة · مسابقة الفرق على الشاشة الكبيرة</span>
            </div>
            <h1
              className="text-3xl sm:text-5xl md:text-7xl font-black mb-2 sm:mb-3 text-transparent bg-clip-text bg-gradient-to-l from-amber-300 via-yellow-200 to-amber-400"
              style={{ lineHeight: 1.18, paddingBottom: "0.25em" }}
            >
              تحدّي حصاد
            </h1>

            {/* Tournament name — prominent, with crown icon to emphasize tournament mode */}
            <div className="max-w-md mx-auto mb-3">
              <div className="rounded-2xl p-3 border-2 backdrop-blur-sm" style={{
                background: "linear-gradient(135deg, rgba(232,168,14,0.15), rgba(232,168,14,0.05))",
                borderColor: "rgba(232,168,14,0.45)",
                boxShadow: "0 6px 24px -8px rgba(232,168,14,0.4)",
              }}>
                <label className="flex items-center gap-2 mb-2 text-[11px] font-black tracking-wider text-amber-200">
                  <Crown className="w-4 h-4 text-amber-300" />
                  وضع البطولة (اختياري)
                </label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={e => setTournamentName(e.target.value)}
                  placeholder="مثال: بطولة العلوم 2025 — يظهر اسم البطولة على الشاشة الكبيرة"
                  maxLength={60}
                  className="w-full text-center text-sm sm:text-base font-bold bg-black/40 text-amber-100 placeholder-amber-100/40 rounded-xl px-4 py-2.5 border border-amber-400/30 focus:outline-none focus:border-amber-300/80"
                />
                {tournamentName.trim() && (
                  <div className="mt-2 text-[11px] text-emerald-100/70 text-center">
                    سيظهر <span className="font-black text-amber-200">«{tournamentName.trim()}»</span> في رأس الشاشة طوال البطولة
                  </div>
                )}
              </div>
            </div>

            <p className="text-emerald-100/80 text-sm sm:text-base px-2">
              {step === 1 && `الخطوة 1 من 3 — ${teams.length > 2 ? `${teams.length} فرق` : "الفريقان"} والأعضاء`}
              {step === 2 && "الخطوة 2 من 3 — اختيار الفئات والأسئلة المخصصة"}
              {step === 3 && "الخطوة 3 من 3 — الوسائل المساعدة والمؤقت"}
            </p>
          </motion.div>

          <Stepper step={step} />

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className={`grid gap-4 sm:gap-5 mb-4 ${teams.length === 2 ? "grid-cols-1 md:grid-cols-2" : teams.length <= 4 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
                  {teams.map((team, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl p-3 sm:p-5 border-2 backdrop-blur-sm relative"
                      style={{
                        background: `linear-gradient(160deg, ${team.color}33, ${team.color}0a)`,
                        borderColor: `${team.color}88`,
                        boxShadow: `0 12px 40px -16px ${team.color}80`,
                      }}
                    >
                      {teams.length > 2 && (
                        <button onClick={() => removeTeam(idx)} className="absolute top-2 start-2 p-1 rounded-full bg-black/40 text-rose-300 hover:bg-rose-500/30" title="حذف الفريق">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-5 h-5 text-amber-200" />
                        <span className="text-xs font-bold text-amber-200">الفريق {idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 mb-4">
                        <span className="text-3xl sm:text-4xl shrink-0">{team.emoji}</span>
                        <input
                          type="text"
                          value={team.name}
                          onChange={e => updateTeam(idx, { name: e.target.value })}
                          maxLength={24}
                          className="flex-1 min-w-0 text-lg sm:text-2xl font-black bg-black/30 text-white rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-white/10 focus:outline-none focus:border-amber-300"
                        />
                      </div>

                      <div className="mb-3">
                        <button type="button" onClick={() => toggleEmoji(idx)} className="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-black/30 hover:bg-black/40 border border-white/10 text-emerald-100/90 transition">
                          <span className="text-xs font-bold flex items-center gap-2">
                            <span className="text-lg">{team.emoji}</span>
                            تغيير شعار الفريق
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${showEmoji[idx] ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {showEmoji[idx] && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 pt-2">
                                {TEAM_EMOJIS.map(em => (
                                  <button key={em} onClick={() => updateTeam(idx, { emoji: em })} className={`aspect-square w-full rounded-lg text-xl flex items-center justify-center transition ${team.emoji === em ? "bg-amber-400 ring-2 ring-amber-200" : "bg-white/10 hover:bg-white/20"}`}>
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="mb-4">
                        <button type="button" onClick={() => toggleColors(idx)} className="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-black/30 hover:bg-black/40 border border-white/10 text-emerald-100/90 transition">
                          <span className="text-xs font-bold flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full ring-2 ring-white/30" style={{ background: team.color }} />
                            تغيير لون الفريق
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${showColors[idx] ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {showColors[idx] && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="flex flex-wrap gap-2 pt-2">
                                {TEAM_COLORS.map(c => (
                                  <button key={c.color} onClick={() => updateTeam(idx, { color: c.color })} className={`w-8 h-8 rounded-full transition ${team.color === c.color ? "ring-2 ring-white scale-110" : ""}`} style={{ background: c.color }} title={c.name} />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-xs font-bold text-emerald-100/70 flex items-center gap-1.5">
                            <UserPlus className="w-3.5 h-3.5" />
                            لاعبو الفريق <span className="opacity-60">(اختياري)</span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-100/50">{team.players.length}/12</span>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={playerDraft[idx] ?? ""}
                            onChange={e => setPlayerDraft(prev => prev.map((v, i) => i === idx ? e.target.value : v))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPlayer(idx); } }}
                            placeholder="اسم اللاعب"
                            maxLength={20}
                            className="flex-1 bg-black/30 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-amber-300"
                          />
                          <button onClick={() => addPlayer(idx)} className="px-3 py-2 rounded-lg font-bold text-sm hover:opacity-90" style={{ background: team.color }}>
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        </div>
                        {team.players.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {team.players.map(p => (
                              <span key={p} className="inline-flex items-center gap-1 rounded-full text-xs font-bold px-2.5 py-1 border" style={{ background: `${team.color}33`, borderColor: `${team.color}88`, color: "white" }}>
                                {p}
                                <button onClick={() => removePlayer(idx, p)} className="rounded-full hover:bg-white/20 p-0.5">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-100/40">بدون لاعبين فرديين — سيُحتسب الإجابة للفريق فقط</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {teams.length < 8 && (
                  <button onClick={addTeam} className="w-full py-3 rounded-2xl border-2 border-dashed border-amber-400/40 text-amber-300 font-bold hover:border-amber-400/70 hover:bg-amber-400/5 transition inline-flex items-center justify-center gap-2 mb-4">
                    <Plus className="w-5 h-5" />
                    إضافة فريق ({teams.length}/8)
                  </button>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* Action bar: create category */}
                <div className="rounded-2xl p-4 mb-4 bg-amber-300/8 backdrop-blur-sm border border-amber-300/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Swords className="w-5 h-5 text-amber-300 shrink-0" />
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">مكتبة الفئات البصرية</h2>
                      <p className="text-emerald-100/70 text-xs sm:text-sm">اختر 3 فئات لكل فريق — كل فئة بـ <strong className="text-amber-200">8 بطاقات</strong> (200×2، 400×2، 600×2، <strong className="text-yellow-300">800×2⭐</strong>)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setEditingCat(null); setEditorOpen(true); }}
                    className="px-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 inline-flex items-center gap-2 shadow-lg shrink-0"
                  >
                    <FolderPlus className="w-4 h-4" />
                    اصنع فئتك
                  </button>
                </div>

                {/* Visual category grid */}
                <div className="space-y-5">
                  {sectionsForPicker.map((sec, secIdx) => (
                    <SectionGroup
                      key={sec.id}
                      section={sec}
                      sectionIdx={secIdx}
                      teams={teams}
                      onToggleSub={toggleSub}
                      dbCats={dbCats}
                      onEditDbCat={(c) => { setEditingCat(c); setEditorOpen(true); }}
                      isAdmin={isAdmin}
                      currentTeacherId={(teacherData as any)?.id ?? null}
                      allFull={step2Valid}
                    />
                  ))}
                </div>

                <div className="mt-3 text-xs text-emerald-100/70 text-center">
                  {teams.map((t) => `${t.subCategoryIds.length}/3 لـ ${t.name}`).join(" | ")} — المجموع {allSelected.size}/{teams.length * 3}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="rounded-2xl p-5 mb-4 bg-white/5 backdrop-blur-sm border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <h2 className="text-xl font-extrabold text-white">وسائل المساعدة (3 لكل فريق)</h2>
                  </div>
                  <div className={`grid gap-4 ${teams.length <= 2 ? "md:grid-cols-2" : teams.length <= 4 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                    {teams.map((team, teamIdx) => (
                      <div
                        key={teamIdx}
                        className="rounded-xl p-3 border-2"
                        style={{
                          background: `linear-gradient(160deg, ${team.color}22, transparent)`,
                          borderColor: `${team.color}66`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{team.emoji}</span>
                          <span className="font-black text-lg text-white">{team.name}</span>
                          <span className="text-xs font-bold ms-auto px-2 py-0.5 rounded-full" style={{ background: `${team.color}55`, color: "white" }}>
                            {team.helpers.length}/3
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {HELPERS.map(h => {
                            const active = team.helpers.includes(h.id);
                            return (
                              <button
                                key={h.id}
                                onClick={() => toggleHelper(teamIdx, h.id)}
                                className={`w-full text-right rounded-lg px-3 py-2 transition border-2 ${active ? "text-white shadow-lg" : "border-white/10 bg-white/5 hover:bg-white/10 text-emerald-50"}`}
                                style={active ? { background: `${team.color}66`, borderColor: team.color } : undefined}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{h.emoji}</span>
                                  <div className="flex-1">
                                    <div className="font-bold text-sm">{h.name}</div>
                                    <div className="text-[11px] opacity-80">{h.desc}</div>
                                  </div>
                                  {active && <Check className="w-4 h-4 text-amber-300" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-5 bg-white/5 backdrop-blur-sm border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-5 h-5 text-amber-300" />
                    <h2 className="text-xl font-extrabold text-white">مدة المؤقت لكل سؤال</h2>
                  </div>
                  <p className="text-emerald-100/60 text-sm mb-3">المؤقت يبدأ تلقائياً عند فتح كل سؤال</p>
                  <div className="flex flex-wrap gap-2">
                    {[20, 30, 45, 60, 90].map(s => (
                      <button key={s} onClick={() => setTimerSeconds(s)} className={`px-5 py-2 rounded-xl font-bold transition border-2 ${timerSeconds === s ? "bg-amber-400 text-emerald-950 border-amber-300" : "bg-white/5 text-white border-white/10 hover:bg-white/10"}`}>
                        {s} ثانية
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 sm:gap-3 mt-6">
            <button
              onClick={goPrev}
              disabled={step === 1}
              className="px-3 sm:px-5 py-3 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20 border border-white/20 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
              <span className="hidden sm:inline">السابق</span>
            </button>
            {step < 3 ? (
              <button
                onClick={goNext}
                className="flex-1 py-3 rounded-xl font-extrabold text-base sm:text-lg transition shadow-xl bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 inline-flex items-center justify-center gap-2 sm:gap-3"
              >
                التالي
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={start}
                disabled={!canStart}
                className="flex-1 py-3 sm:py-4 rounded-xl font-extrabold text-lg sm:text-2xl transition shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 inline-flex items-center justify-center gap-2 sm:gap-3"
              >
                <Play className="w-5 h-5 sm:w-7 sm:h-7" />
                ابدأ تحدّي حصاد
              </button>
            )}
          </div>
        </div>

        {/* Floating "next" banner — appears when all categories are chosen in step 2 */}
      <AnimatePresence>
        {step === 2 && step2Valid && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            dir="rtl"
            className="fixed bottom-5 inset-x-0 z-40 flex justify-center pointer-events-none px-4"
          >
            <div
              className="pointer-events-auto flex items-center gap-3 sm:gap-4 rounded-2xl px-4 sm:px-6 py-3 shadow-2xl border-2"
              style={{
                background: "linear-gradient(135deg, #0c3d28 0%, #081f14 100%)",
                borderColor: "rgba(245,158,11,0.7)",
                boxShadow: "0 12px 48px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.25)",
              }}
            >
              <div className="text-sm font-bold text-emerald-100/80 hidden sm:block">
                ✅ اكتمل الاختيار — {teams.map(t => `${t.emoji} ${t.name}`).join(" vs ")}
              </div>
              <div className="text-sm font-bold text-emerald-100/80 sm:hidden">
                ✅ اكتمل الاختيار!
              </div>
              <button
                onClick={goNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-base bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 shadow-lg transition-all active:scale-95"
              >
                التالي
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {editorOpen && (
          <CategoryEditor
            initial={editingCat}
            isAdmin={isAdmin}
            onClose={() => { setEditorOpen(false); setEditingCat(null); }}
            onSaved={async () => { await reloadDbContent(); }}
            customQuestions={customQuestions}
            setCustomQuestions={setCustomQuestions}
          />
        )}
      </div>
    </Layout>
  );
}

// ─────────────────────────── Helpers ───────────────────────────

function getSectionCover(sec: ArenaSection, idx: number): ArenaCover {
  if (sec.cover) return sec.cover;
  return coverForIndex(idx, { emoji: sec.emoji });
}

function getSubCover(sub: ArenaSubCategory, fallback: ArenaCover, idx: number): ArenaCover {
  if (sub.cover) return sub.cover;
  return { ...fallback, emoji: fallback.emoji, color: fallback.color, gradient: fallback.gradient };
}

interface SectionGroupProps {
  section: ArenaSection;
  sectionIdx: number;
  teams: TeamFormState[];
  onToggleSub: (teamIdx: number, subId: string) => void;
  dbCats: DbArenaCategory[];
  onEditDbCat: (cat: DbArenaCategory) => void;
  isAdmin: boolean;
  currentTeacherId: number | null;
  allFull: boolean;
}

function SectionGroup({ section, sectionIdx, teams, onToggleSub, dbCats, onEditDbCat, isAdmin, currentTeacherId, allFull }: SectionGroupProps) {
  const cover = getSectionCover(section, sectionIdx);
  const isCustom = section.id === "custom";
  const isDbSec = section.id.startsWith("db-section-");
  return (
    <div className="rounded-2xl p-3 sm:p-4 border" style={{
      background: "rgba(255,255,255,0.04)",
      borderColor: "rgba(255,255,255,0.08)",
    }}>
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{
          background: cover.gradient ?? cover.color,
          boxShadow: `0 4px 14px -4px ${cover.color}`,
        }}>
          <span>{cover.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-base sm:text-lg text-white truncate">{section.name}</h3>
          <div className="text-[10px] sm:text-[11px] text-emerald-100/55 font-bold">
            {section.subCategories.length} فئات
          </div>
        </div>
        {isCustom && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30">
            خاص بك
          </span>
        )}
        {isDbSec && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-400/15 text-emerald-200 border border-emerald-300/30 inline-flex items-center gap-1">
            <Globe className="w-3 h-3" />
            مكتبة
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {section.subCategories.map((sub, subIdx) => {
          const subCover = getSubCover(sub, cover, subIdx);
          const dbId = sub.id.startsWith("db-") ? Number(sub.id.slice(3)) : null;
          const dbCat = dbId ? dbCats.find(c => c.id === dbId) : null;
          const ownsDbCat = !!dbCat && (dbCat.teacherId === currentTeacherId || isAdmin);
          const takenByIdx = teams.findIndex(tm => tm.subCategoryIds.includes(sub.id));
          return (
            <CategoryCard
              key={sub.id}
              sub={sub}
              cover={subCover}
              teams={teams}
              takenByIdx={takenByIdx}
              onToggle={(teamIdx) => onToggleSub(teamIdx, sub.id)}
              editable={ownsDbCat && !!dbCat}
              onEdit={dbCat ? () => onEditDbCat(dbCat) : undefined}
              dimmed={allFull && takenByIdx === -1}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CategoryCardProps {
  sub: ArenaSubCategory;
  cover: ArenaCover;
  teams: TeamFormState[];
  takenByIdx: number;
  onToggle: (teamIdx: number) => void;
  editable?: boolean;
  onEdit?: () => void;
  dimmed?: boolean;
}

function CategoryCard({ sub, cover, teams, takenByIdx, onToggle, editable, onEdit, dimmed }: CategoryCardProps) {
  const taken = takenByIdx !== -1;
  const winningTeam = taken ? teams[takenByIdx] : null;
  const counts = (sub.questions[200]?.length ?? 0) + (sub.questions[400]?.length ?? 0) + (sub.questions[600]?.length ?? 0) + (sub.questions[800]?.length ?? 0);
  return (
    <div
      className={`rounded-2xl overflow-hidden border-2 transition-all duration-300 relative ${dimmed ? "opacity-35 scale-[0.98]" : ""}`}
      style={{
        borderColor: taken ? (winningTeam?.color ?? cover.color) : "rgba(255,255,255,0.12)",
        boxShadow: taken
          ? `0 8px 28px -8px ${winningTeam?.color ?? cover.color}, 0 0 0 2px ${winningTeam?.color ?? cover.color}55`
          : "0 4px 14px -6px rgba(0,0,0,0.4)",
      }}
    >
      {/* Cover image / gradient (top) */}
      <div
        className="aspect-[4/3] relative overflow-hidden"
        style={{
          background: cover.imageUrl ? "#0E2A1D" : (cover.gradient ?? cover.color),
        }}
      >
        {cover.imageUrl ? (
          <img src={cover.imageUrl} alt={sub.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl sm:text-6xl drop-shadow-lg" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>
              {cover.emoji}
            </span>
          </div>
        )}
        {/* Overlay gradient for legibility */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute top-2 end-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-sm text-white text-[10px] font-bold">
          {counts} سؤال
        </div>
        {editable && onEdit && (
          <button
            onClick={onEdit}
            className="absolute top-2 start-2 p-1.5 rounded-full bg-black/50 backdrop-blur-sm text-amber-200 hover:bg-amber-400 hover:text-emerald-950"
            title="تعديل الفئة"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
        {taken && winningTeam && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="px-3 py-1.5 rounded-full font-black text-sm shadow-2xl" style={{ background: winningTeam.color, color: "white" }}>
              {winningTeam.emoji} {winningTeam.name}
            </div>
          </div>
        )}
      </div>

      {/* Title bar (bottom) */}
      <div
        className="px-2.5 py-2 text-center"
        style={{
          background: cover.color,
          color: "white",
        }}
      >
        <div className="font-extrabold text-sm sm:text-base leading-tight" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
          {sub.name}
        </div>
      </div>

      {/* Team selector buttons */}
      <div className="bg-white/5 p-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(teams.length, 4)}, 1fr)` }}>
        {teams.map((team, teamIdx) => {
          const picked = team.subCategoryIds.includes(sub.id);
          const disabledByOther = !picked && takenByIdx !== -1 && takenByIdx !== teamIdx;
          return (
            <button
              key={teamIdx}
              onClick={() => onToggle(teamIdx)}
              disabled={disabledByOther}
              title={team.name}
              className="text-[11px] sm:text-xs font-extrabold rounded-md py-1.5 px-1 transition disabled:opacity-25 disabled:cursor-not-allowed truncate"
              style={picked
                ? { background: team.color, color: "#fff", boxShadow: `0 4px 10px -3px ${team.color}` }
                : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }
              }
            >
              {picked && <Check className="w-3 h-3 inline -mt-0.5 me-0.5" />}
              {team.emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────── Editor Modal ───────────────────────────

interface CategoryEditorProps {
  initial: DbArenaCategory | null;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  customQuestions: ArenaCustomQuestion[];
  setCustomQuestions: React.Dispatch<React.SetStateAction<ArenaCustomQuestion[]>>;
}

const COVER_PRESETS: { color: string; gradient: string; label: string }[] = [
  { color: "#1E4D35", gradient: "linear-gradient(135deg, #2D7048 0%, #1E4D35 60%, #0E2A1D 100%)", label: "أخضر حصاد" },
  { color: "#7C3F12", gradient: "linear-gradient(135deg, #E8A80E 0%, #B8730A 60%, #7C3F12 100%)", label: "ذهبي" },
  { color: "#1F3A6E", gradient: "linear-gradient(135deg, #4A8AD4 0%, #2D5BAA 60%, #1F3A6E 100%)", label: "أزرق" },
  { color: "#4A2A7A", gradient: "linear-gradient(135deg, #8B5FBF 0%, #6E3DAA 60%, #4A2A7A 100%)", label: "بنفسجي" },
  { color: "#8A1F3D", gradient: "linear-gradient(135deg, #E04373 0%, #B8284F 60%, #8A1F3D 100%)", label: "وردي" },
  { color: "#0F4F47", gradient: "linear-gradient(135deg, #3FA398 0%, #1F7569 60%, #0F4F47 100%)", label: "تركواز" },
];

const EDITOR_EMOJIS = ["🎯", "📚", "🌍", "🔬", "⚗️", "🏛️", "🎨", "🎭", "🎮", "🏆", "📖", "🕌", "💡", "🚀", "⚽", "🎵", "🍎", "🌟", "💎", "🦁"];

function CategoryEditor({ initial, isAdmin, onClose, onSaved, customQuestions, setCustomQuestions }: CategoryEditorProps) {
  const [mode, setMode] = useState<"saved" | "ephemeral">(initial ? "saved" : "saved");
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "🎯");
  const [coverColor, setCoverColor] = useState(initial?.coverColor ?? "#1E4D35");
  const [coverGradient, setCoverGradient] = useState(initial?.coverGradient ?? COVER_PRESETS[0].gradient);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initial?.coverImageUrl ?? null);
  const [makePublic, setMakePublic] = useState(initial?.isPublic ?? false);
  const [uploading, setUploading] = useState(false);
  const [savingCat, setSavingCat] = useState(false);
  const [savedCatId, setSavedCatId] = useState<number | null>(initial?.id ?? null);

  // Activities draft (for saved-DB mode)
  const [activities, setActivities] = useState<DbArenaActivity[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);

  useEffect(() => {
    if (savedCatId && !activitiesLoaded) {
      (async () => {
        const acts = await fetchArenaActivities([savedCatId]);
        setActivities(acts);
        setActivitiesLoaded(true);
      })();
    }
  }, [savedCatId, activitiesLoaded]);

  const [draftType, setDraftType] = useState<DbArenaActivity["type"]>("text");
  const [draftQ, setDraftQ] = useState("");
  const [draftA, setDraftA] = useState("");
  const [draftDiff, setDraftDiff] = useState<ArenaDifficulty>(200);
  const [draftImageUrl, setDraftImageUrl] = useState<string | null>(null);
  const [draftImageUploading, setDraftImageUploading] = useState(false);
  // Type-specific drafts
  const [draftHint, setDraftHint] = useState("");
  const [draftSinLetter, setDraftSinLetter] = useState("");
  const [draftSinPrompts, setDraftSinPrompts] = useState<SinJeemPrompt[]>([
    { prompt: "", answer: "" },
    { prompt: "", answer: "" },
  ]);
  const [draftMemoryPairs, setDraftMemoryPairs] = useState<MemoryPair[]>([
    { a: { kind: "text", value: "" }, b: { kind: "text", value: "" } },
    { a: { kind: "text", value: "" }, b: { kind: "text", value: "" } },
    { a: { kind: "text", value: "" }, b: { kind: "text", value: "" } },
  ]);
  const [draftCatGroups, setDraftCatGroups] = useState<CategorizeGroup[]>([
    { name: "", items: ["", ""] },
    { name: "", items: ["", ""] },
  ]);

  const resetDraft = () => {
    setDraftQ(""); setDraftA(""); setDraftImageUrl(null); setDraftHint("");
    setDraftSinLetter("");
    setDraftSinPrompts([{ prompt: "", answer: "" }, { prompt: "", answer: "" }]);
    setDraftMemoryPairs([
      { a: { kind: "text", value: "" }, b: { kind: "text", value: "" } },
      { a: { kind: "text", value: "" }, b: { kind: "text", value: "" } },
      { a: { kind: "text", value: "" }, b: { kind: "text", value: "" } },
    ]);
    setDraftCatGroups([
      { name: "", items: ["", ""] },
      { name: "", items: ["", ""] },
    ]);
  };

  const uploadInline = async (file: File): Promise<string | null> => {
    const url = await uploadImageFile(file);
    if (!url) toast.error("فشل رفع الصورة");
    return url;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImageFile(file);
    setUploading(false);
    if (url) {
      setCoverImageUrl(url);
      toast.success("تم رفع الصورة");
    } else {
      toast.error("فشل رفع الصورة");
    }
  };

  const handleQuestionImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDraftImageUploading(true);
    const url = await uploadImageFile(file);
    setDraftImageUploading(false);
    if (url) {
      setDraftImageUrl(url);
      toast.success("تم رفع صورة السؤال");
    } else {
      toast.error("فشل رفع الصورة");
    }
  };

  const saveCategory = async () => {
    if (!name.trim()) { toast.error("اكتب اسم الفئة"); return; }
    setSavingCat(true);
    if (savedCatId) {
      const updated = await updateArenaCategory(savedCatId, {
        name: name.trim(),
        emoji,
        coverColor,
        coverGradient,
        coverImageUrl,
        ...(isAdmin ? { isPublic: makePublic } : {}),
      });
      setSavingCat(false);
      if (!updated) { toast.error("فشل حفظ التغييرات"); return; }
      toast.success("تم حفظ التغييرات");
      await onSaved();
      return;
    }
    const created = await createArenaCategory({
      name: name.trim(),
      emoji,
      coverColor,
      coverGradient,
      coverImageUrl,
      isPublic: isAdmin && makePublic,
      sortOrder: 0,
    });
    setSavingCat(false);
    if (!created) { toast.error("فشل حفظ الفئة"); return; }
    setSavedCatId(created.id);
    setActivities([]);
    setActivitiesLoaded(true);
    toast.success("تم إنشاء الفئة — أضف أسئلتك الآن");
    await onSaved();
  };

  const buildActivityFromDraft = (): { ok: true; data: Partial<DbArenaActivity> } | { ok: false; error: string } => {
    switch (draftType) {
      case "text": {
        if (!draftQ.trim() || !draftA.trim()) return { ok: false, error: "اكتب نص السؤال والإجابة" };
        return { ok: true, data: { type: "text", question: draftQ.trim(), answer: draftA.trim() } };
      }
      case "image": {
        if (!draftQ.trim() || !draftA.trim()) return { ok: false, error: "اكتب نص السؤال والإجابة" };
        if (!draftImageUrl) return { ok: false, error: "ارفع صورة للسؤال" };
        return { ok: true, data: { type: "image", question: draftQ.trim(), answer: draftA.trim(), imageUrl: draftImageUrl } };
      }
      case "video": {
        if (!draftQ.trim() || !draftA.trim()) return { ok: false, error: "اكتب نص السؤال والإجابة" };
        return { ok: true, data: { type: "video", question: draftQ.trim(), answer: draftA.trim() } };
      }
      case "sin-jeem": {
        if (!draftSinLetter.trim()) return { ok: false, error: "اختر الحرف" };
        const prompts = draftSinPrompts
          .map(p => ({ prompt: p.prompt.trim(), answer: p.answer.trim() }))
          .filter(p => p.prompt && p.answer);
        if (prompts.length === 0) return { ok: false, error: "أضف على الأقل سؤالاً واحداً مع إجابته" };
        const q = `سين جيم — حرف الـ ${draftSinLetter.trim()}`;
        const a = prompts.map(p => `${p.prompt}: ${p.answer}`).join("، ");
        return {
          ok: true,
          data: {
            type: "sin-jeem", question: q, answer: a,
            payload: { letter: draftSinLetter.trim(), prompts } as unknown as DbArenaActivity["payload"],
          },
        };
      }
      case "memory": {
        const pairs = draftMemoryPairs.filter(p => p.a.value.trim() && p.b.value.trim());
        if (pairs.length < 2) return { ok: false, error: "أضف على الأقل زوجين كاملين" };
        const a = pairs.map(p => `${p.a.value} ↔ ${p.b.value}`).join("، ");
        return {
          ok: true,
          data: {
            type: "memory", question: "طابق الأزواج", answer: a,
            payload: { pairs } as unknown as DbArenaActivity["payload"],
          },
        };
      }
      case "categorize": {
        const groups = draftCatGroups
          .map(g => ({ name: g.name.trim(), items: g.items.map(i => i.trim()).filter(Boolean) }))
          .filter(g => g.name && g.items.length > 0);
        if (groups.length < 2) return { ok: false, error: "أضف مجموعتين على الأقل بعناصر" };
        const a = groups.map(g => `${g.name}: ${g.items.join("، ")}`).join(" | ");
        return {
          ok: true,
          data: {
            type: "categorize", question: "صنّف العناصر التالية", answer: a,
            payload: { groups } as unknown as DbArenaActivity["payload"],
          },
        };
      }
      case "logo": {
        if (!draftImageUrl) return { ok: false, error: "ارفع صورة الشعار" };
        if (!draftA.trim()) return { ok: false, error: "اكتب اسم الشعار" };
        return {
          ok: true,
          data: {
            type: "logo", question: "ما اسم هذا الشعار؟", answer: draftA.trim(),
            imageUrl: draftImageUrl,
            payload: (draftHint.trim() ? { hint: draftHint.trim() } : null) as unknown as DbArenaActivity["payload"],
          },
        };
      }
    }
  };

  const addSavedActivity = async () => {
    if (!savedCatId) { toast.error("احفظ الفئة أولاً"); return; }
    const built = buildActivityFromDraft();
    if (!built.ok) { toast.error(built.error); return; }
    const created = await createArenaActivity({
      categoryId: savedCatId,
      difficulty: draftDiff,
      sortOrder: activities.length,
      ...built.data,
    });
    if (!created) { toast.error("فشل حفظ السؤال"); return; }
    setActivities(prev => [...prev, created]);
    resetDraft();
    toast.success("تمت إضافة السؤال");
    await onSaved();
  };

  const removeSavedActivity = async (id: number) => {
    const ok = await deleteArenaActivity(id);
    if (ok) {
      setActivities(prev => prev.filter(a => a.id !== id));
      await onSaved();
    } else {
      toast.error("فشل الحذف");
    }
  };

  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [editDiff, setEditDiff] = useState<ArenaDifficulty>(200);
  const [editHint, setEditHint] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const startEditActivity = (a: DbArenaActivity) => {
    setEditingActivityId(a.id);
    setEditQ(a.question);
    setEditA(a.answer);
    setEditDiff(a.difficulty as ArenaDifficulty);
    setEditHint(a.hint ?? "");
  };

  const saveEditActivity = async () => {
    if (!editingActivityId || !editQ.trim() || !editA.trim()) { toast.error("اكتب نص السؤال والإجابة"); return; }
    setSavingEdit(true);
    const updated = await updateArenaActivity(editingActivityId, {
      question: editQ.trim(),
      answer: editA.trim(),
      difficulty: editDiff,
      hint: editHint.trim() || null,
    });
    setSavingEdit(false);
    if (!updated) { toast.error("فشل تعديل السؤال"); return; }
    setActivities(prev => prev.map(a => a.id === editingActivityId ? updated : a));
    setEditingActivityId(null);
    toast.success("تم تعديل السؤال");
    await onSaved();
  };

  const removeCategory = async () => {
    if (!savedCatId) return;
    if (!confirm("حذف هذه الفئة وكل أسئلتها نهائياً؟")) return;
    const ok = await deleteArenaCategory(savedCatId);
    if (ok) {
      toast.success("تم الحذف");
      await onSaved();
      onClose();
    } else { toast.error("فشل الحذف"); }
  };

  // Ephemeral one-shot custom questions (game-only)
  const addEphemeral = () => {
    if (!draftQ.trim() || !draftA.trim()) { toast.error("اكتب نص السؤال والإجابة"); return; }
    setCustomQuestions(prev => [...prev, { q: draftQ.trim(), a: draftA.trim(), difficulty: draftDiff }]);
    setDraftQ(""); setDraftA("");
    toast.success("تمت إضافة السؤال للمسابقة الحالية");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-3xl my-8 rounded-3xl border-2 overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #14352A, #0A1F18)",
          borderColor: "rgba(232,168,14,0.4)",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="text-lg font-extrabold text-white">{savedCatId ? "تعديل فئة" : "إنشاء فئة جديدة"}</h3>
              <p className="text-[11px] text-emerald-100/60">
                {isAdmin ? "بصفتك مسؤولاً يمكنك جعل الفئة عامة لكل المعلمين" : "ستكون الفئة خاصة بحسابك فقط"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Mode tabs */}
          {!savedCatId && (
            <div className="flex gap-2 rounded-xl bg-black/30 p-1 border border-white/10">
              <button
                onClick={() => setMode("saved")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition ${mode === "saved" ? "bg-amber-400 text-emerald-950" : "text-emerald-100/70 hover:text-white"}`}
              >
                <Save className="w-4 h-4 inline -mt-0.5 me-1" />
                فئة محفوظة (تظهر في كل مسابقاتك)
              </button>
              <button
                onClick={() => setMode("ephemeral")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition ${mode === "ephemeral" ? "bg-amber-400 text-emerald-950" : "text-emerald-100/70 hover:text-white"}`}
              >
                <Sparkles className="w-4 h-4 inline -mt-0.5 me-1" />
                أسئلة سريعة (للمسابقة الحالية فقط)
              </button>
            </div>
          )}

          {mode === "ephemeral" ? (
            <div className="space-y-3">
              <p className="text-emerald-100/70 text-xs">أسئلة خاصة بهذه المسابقة فقط، لن تُحفظ بعد انتهاء اللعبة.</p>
              <div className="grid sm:grid-cols-12 gap-2">
                <input value={draftQ} onChange={e => setDraftQ(e.target.value)} placeholder="نص السؤال" className="sm:col-span-5 bg-black/30 text-white rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-amber-300" />
                <input value={draftA} onChange={e => setDraftA(e.target.value)} placeholder="الإجابة" className="sm:col-span-4 bg-black/30 text-white rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-amber-300" />
                <div className="sm:col-span-2 flex items-center">
                  <DiffChips value={draftDiff} onChange={setDraftDiff} />
                </div>
                <button onClick={addEphemeral} className="sm:col-span-1 bg-amber-400 text-emerald-950 rounded-xl px-3 py-2 font-bold hover:bg-amber-300 inline-flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {customQuestions.length === 0 ? (
                <div className="text-center text-emerald-100/40 text-sm py-3">لم تضف أسئلة بعد</div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {customQuestions.map((cq, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/10 px-3 py-2">
                      <span className="text-xs font-bold shrink-0 w-10 text-center rounded-md px-1 py-0.5" style={{ color: cq.difficulty === 800 ? "#fde68a" : cq.difficulty === 600 ? "#fca5a5" : cq.difficulty === 400 ? "#c4b5fd" : "#93c5fd", background: cq.difficulty === 800 ? "rgba(180,83,9,0.35)" : cq.difficulty === 600 ? "rgba(146,35,64,0.35)" : cq.difficulty === 400 ? "rgba(85,37,168,0.35)" : "rgba(36,87,168,0.35)" }}>{cq.difficulty}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{cq.q}</div>
                        <div className="text-xs text-emerald-200/80 truncate">→ {cq.a}</div>
                      </div>
                      <button onClick={() => setCustomQuestions(prev => prev.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/20" title="حذف">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Cover preview + name */}
              <div className="grid sm:grid-cols-[180px_1fr] gap-4">
                <div
                  className="rounded-2xl aspect-[4/3] relative overflow-hidden border-2 border-white/15"
                  style={{ background: coverImageUrl ? "#0E2A1D" : (coverGradient ?? coverColor) }}
                >
                  {coverImageUrl ? (
                    <img src={coverImageUrl} alt="cover" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-5xl">{emoji}</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 text-center font-extrabold text-white text-sm" style={{ background: coverColor, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
                    {name || "اسم الفئة"}
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-emerald-100/70 mb-1 block">اسم الفئة</label>
                    <input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="مثال: علماء العرب" className="w-full bg-black/30 text-white rounded-xl px-3 py-2 border border-white/10 focus:outline-none focus:border-amber-300" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-emerald-100/70 mb-1 block">رمز تعبيري</label>
                    <div className="flex flex-wrap gap-1">
                      {EDITOR_EMOJIS.map(em => (
                        <button key={em} onClick={() => setEmoji(em)} className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition ${emoji === em ? "bg-amber-400 ring-2 ring-amber-200" : "bg-white/10 hover:bg-white/20"}`}>
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Color + image upload */}
              <div>
                <label className="text-xs font-bold text-emerald-100/70 mb-1 block">لون الغلاف</label>
                <div className="flex flex-wrap gap-2">
                  {COVER_PRESETS.map(p => (
                    <button
                      key={p.color}
                      onClick={() => { setCoverColor(p.color); setCoverGradient(p.gradient); }}
                      className={`w-12 h-12 rounded-xl transition ${coverColor === p.color ? "ring-2 ring-amber-300 scale-110" : ""}`}
                      style={{ background: p.gradient }}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-emerald-100/70 mb-1 block">صورة الغلاف (اختياري — يستبدل الرمز)</label>
                <div className="flex items-center gap-2">
                  <label className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25 cursor-pointer inline-flex items-center gap-2 text-sm font-bold">
                    <Camera className="w-4 h-4" />
                    {uploading ? "جارٍ الرفع..." : "رفع صورة"}
                    <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploading} className="hidden" />
                  </label>
                  {coverImageUrl && (
                    <button onClick={() => setCoverImageUrl(null)} className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 hover:bg-rose-500/25 text-sm font-bold inline-flex items-center gap-1">
                      <X className="w-4 h-4" />
                      إزالة
                    </button>
                  )}
                </div>
              </div>

              {/* Public toggle (admin only — shown for both create and edit) */}
              {isAdmin && (
                <label className="flex items-center gap-3 p-3 rounded-xl bg-amber-300/10 border border-amber-300/30 cursor-pointer">
                  <input type="checkbox" checked={makePublic} onChange={e => setMakePublic(e.target.checked)} className="w-5 h-5 accent-amber-400" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-amber-100 inline-flex items-center gap-1.5">
                      <Globe className="w-4 h-4" />
                      فئة عامة (مرئية لجميع المعلمين)
                    </div>
                    <div className="text-[11px] text-amber-100/60">
                      {savedCatId ? "تحديث حالة الظهور للمعلمين الآخرين" : "ستظهر في مكتبة جميع المعلمين، ولن تكون مرتبطة بحسابك"}
                    </div>
                  </div>
                </label>
              )}

              <div className="flex justify-between gap-2">
                {savedCatId && (
                  <button onClick={removeCategory} className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-200 hover:bg-rose-500/25 text-sm font-bold inline-flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    حذف الفئة
                  </button>
                )}
                <button
                  onClick={saveCategory}
                  disabled={savingCat || !name.trim()}
                  className="ms-auto px-5 py-2.5 rounded-xl font-bold bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savedCatId ? "حفظ التغييرات" : "حفظ الفئة"}
                </button>
              </div>

              {/* Activities editor (only after save) */}
              {savedCatId && (
                <div className="border-t border-white/10 pt-5">
                  <h4 className="font-extrabold text-base text-white mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-300" />
                    أسئلة الفئة
                  </h4>

                  <div className="rounded-xl bg-black/30 border border-white/10 p-3 mb-3 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        { id: "text", label: "نصي", emoji: "📝" },
                        { id: "image", label: "بصورة", emoji: "🖼️" },
                        { id: "logo", label: "شعار", emoji: "🏷️" },
                        { id: "sin-jeem", label: "سين جيم", emoji: "🔤" },
                        { id: "memory", label: "ذاكرة", emoji: "🧠" },
                        { id: "categorize", label: "تصنيف", emoji: "🗂️" },
                      ] as const).map(t => (
                        <button
                          key={t.id}
                          onClick={() => setDraftType(t.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition ${draftType === t.id ? "bg-amber-400 text-emerald-950 shadow" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                        >
                          <span>{t.emoji}</span> {t.label}
                        </button>
                      ))}
                    </div>

                    {draftType === "image" && (
                      <div>
                        {draftImageUrl ? (
                          <div className="relative inline-block">
                            <img src={draftImageUrl} alt="preview" className="max-h-32 rounded-lg border border-white/15" />
                            <button onClick={() => setDraftImageUrl(null)} className="absolute -top-2 -end-2 p-1 rounded-full bg-rose-500 text-white">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25 cursor-pointer inline-flex items-center gap-2 text-xs font-bold">
                            <Upload className="w-3.5 h-3.5" />
                            {draftImageUploading ? "جارٍ الرفع..." : "رفع صورة السؤال"}
                            <input type="file" accept="image/*" onChange={handleQuestionImageUpload} disabled={draftImageUploading} className="hidden" />
                          </label>
                        )}
                      </div>
                    )}

                    {draftType === "logo" && (
                      <LogoEditor
                        imageUrl={draftImageUrl}
                        onUpload={async (file) => { setDraftImageUploading(true); const url = await uploadInline(file); setDraftImageUploading(false); if (url) setDraftImageUrl(url); }}
                        onClear={() => setDraftImageUrl(null)}
                        uploading={draftImageUploading}
                        brandName={draftA}
                        onBrandName={setDraftA}
                        hint={draftHint}
                        onHint={setDraftHint}
                      />
                    )}

                    {draftType === "sin-jeem" && (
                      <SinJeemEditor
                        letter={draftSinLetter}
                        onLetter={setDraftSinLetter}
                        prompts={draftSinPrompts}
                        onPrompts={setDraftSinPrompts}
                      />
                    )}

                    {draftType === "memory" && (
                      <MemoryEditor
                        pairs={draftMemoryPairs}
                        onPairs={setDraftMemoryPairs}
                        onUpload={uploadInline}
                      />
                    )}

                    {draftType === "categorize" && (
                      <CategorizeEditor
                        groups={draftCatGroups}
                        onGroups={setDraftCatGroups}
                      />
                    )}

                    {(draftType === "text" || draftType === "image") && (
                      <div className="grid sm:grid-cols-12 gap-2">
                        <input value={draftQ} onChange={e => setDraftQ(e.target.value)} placeholder={draftType === "image" ? "وصف السؤال (مثال: ما هو هذا الحيوان؟)" : "نص السؤال"} className="sm:col-span-5 bg-black/40 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
                        <input value={draftA} onChange={e => setDraftA(e.target.value)} placeholder="الإجابة" className="sm:col-span-4 bg-black/40 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
                        <div className="sm:col-span-2 flex items-center">
                          <DiffChips value={draftDiff} onChange={setDraftDiff} />
                        </div>
                        <button onClick={addSavedActivity} className="sm:col-span-1 bg-amber-400 text-emerald-950 rounded-lg px-3 py-2 font-bold hover:bg-amber-300 inline-flex items-center justify-center">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {(draftType !== "text" && draftType !== "image") && (
                      <div className="flex flex-wrap gap-2 items-center pt-1">
                        <DiffChips value={draftDiff} onChange={setDraftDiff} />
                        <button onClick={addSavedActivity} className="bg-amber-400 text-emerald-950 rounded-lg px-4 py-2 font-bold hover:bg-amber-300 inline-flex items-center gap-1.5 text-sm">
                          <Plus className="w-4 h-4" />
                          إضافة السؤال
                        </button>
                      </div>
                    )}
                  </div>

                  {activities.length === 0 ? (
                    <div className="text-center text-emerald-100/40 text-sm py-4 border border-dashed border-white/10 rounded-xl">
                      لم تضف أسئلة بعد — يفضّل ≥6 أسئلة لكل فئة (2 لكل صعوبة)
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {activities.map(a => (
                        <div key={a.id}>
                          {editingActivityId === a.id ? (
                            /* ── Inline edit form ── */
                            <div className="rounded-lg bg-amber-400/10 border border-amber-300/40 px-3 py-3 space-y-2">
                              <div className="text-[11px] font-extrabold text-amber-200 mb-1">تعديل السؤال</div>
                              <div className="grid sm:grid-cols-12 gap-2">
                                <input value={editQ} onChange={e => setEditQ(e.target.value)} placeholder="نص السؤال" className="sm:col-span-5 bg-black/40 text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
                                <input value={editA} onChange={e => setEditA(e.target.value)} placeholder="الإجابة" className="sm:col-span-4 bg-black/40 text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
                                <div className="sm:col-span-3 flex items-center">
                                  <DiffChips value={editDiff} onChange={setEditDiff} />
                                </div>
                              </div>
                              <input value={editHint} onChange={e => setEditHint(e.target.value)} placeholder="تلميح (اختياري)" className="w-full bg-black/40 text-white rounded-lg px-3 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
                              <div className="flex gap-2 pt-1">
                                <button onClick={saveEditActivity} disabled={savingEdit} className="px-4 py-1.5 rounded-lg font-bold text-sm bg-amber-400 text-emerald-950 hover:bg-amber-300 inline-flex items-center gap-1.5 disabled:opacity-50">
                                  <Save className="w-3.5 h-3.5" />
                                  {savingEdit ? "جارٍ الحفظ..." : "حفظ التعديل"}
                                </button>
                                <button onClick={() => setEditingActivityId(null)} className="px-3 py-1.5 rounded-lg font-bold text-sm text-white/60 hover:text-white border border-white/15 hover:border-white/30">
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Normal row ── */
                            <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/10 px-3 py-2">
                              <span className="text-xs font-bold shrink-0 w-10 text-center rounded-md px-1 py-0.5" style={{ color: a.difficulty === 800 ? "#fde68a" : a.difficulty === 600 ? "#fca5a5" : a.difficulty === 400 ? "#c4b5fd" : "#93c5fd", background: a.difficulty === 800 ? "rgba(180,83,9,0.35)" : a.difficulty === 600 ? "rgba(146,35,64,0.35)" : a.difficulty === 400 ? "rgba(85,37,168,0.35)" : "rgba(36,87,168,0.35)" }}>{a.difficulty}</span>
                              {a.imageUrl && (
                                <img src={a.imageUrl} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-white truncate">{a.question}</div>
                                <div className="text-xs text-emerald-200/80 truncate">→ {a.answer}</div>
                              </div>
                              <button onClick={() => startEditActivity(a)} className="p-1.5 rounded-lg text-amber-300 hover:bg-amber-400/20" title="تعديل">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => removeSavedActivity(a.id)} className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-500/20" title="حذف">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────── Type-Specific Editors ───────────────────────────

const ARABIC_LETTERS = ["ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي"];

interface LogoEditorProps {
  imageUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
  uploading: boolean;
  brandName: string;
  onBrandName: (v: string) => void;
  hint: string;
  onHint: (v: string) => void;
}

function LogoEditor({ imageUrl, onUpload, onClear, uploading, brandName, onBrandName, hint, onHint }: LogoEditorProps) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-[11px] font-bold text-emerald-100/60 mb-1 block">صورة الشعار</label>
        {imageUrl ? (
          <div className="relative inline-block">
            <img src={imageUrl} alt="logo" className="max-h-32 rounded-lg border border-white/15 bg-white/5" />
            <button onClick={onClear} className="absolute -top-2 -end-2 p-1 rounded-full bg-rose-500 text-white">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <label className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25 cursor-pointer inline-flex items-center gap-2 text-xs font-bold">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "جارٍ الرفع..." : "رفع صورة الشعار"}
            <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} disabled={uploading} className="hidden" />
          </label>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-bold text-emerald-100/60 mb-1 block">اسم الشعار (الإجابة)</label>
          <input value={brandName} onChange={e => onBrandName(e.target.value)} placeholder="مثال: نايكي" className="w-full bg-black/40 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-emerald-100/60 mb-1 block">تلميح (اختياري)</label>
          <input value={hint} onChange={e => onHint(e.target.value)} placeholder="مثال: ماركة رياضية" className="w-full bg-black/40 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
        </div>
      </div>
    </div>
  );
}

interface SinJeemEditorProps {
  letter: string;
  onLetter: (v: string) => void;
  prompts: SinJeemPrompt[];
  onPrompts: (v: SinJeemPrompt[]) => void;
}

function SinJeemEditor({ letter, onLetter, prompts, onPrompts }: SinJeemEditorProps) {
  const updatePrompt = (i: number, field: "prompt" | "answer", v: string) => {
    onPrompts(prompts.map((p, j) => j === i ? { ...p, [field]: v } : p));
  };
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-[11px] font-bold text-emerald-100/60 mb-1 block">اختر الحرف</label>
        <div className="flex flex-wrap gap-1">
          {ARABIC_LETTERS.map(l => (
            <button
              key={l}
              onClick={() => onLetter(l)}
              className={`w-8 h-8 rounded-lg text-base font-extrabold transition ${letter === l ? "bg-amber-400 text-emerald-950 ring-2 ring-amber-200" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[11px] font-bold text-emerald-100/60 mb-1 block">الأسئلة (مثال: «اسم بلد» → «السودان»)</label>
        <div className="space-y-1.5">
          {prompts.map((p, i) => (
            <div key={i} className="grid sm:grid-cols-12 gap-1.5 items-center">
              <input value={p.prompt} onChange={e => updatePrompt(i, "prompt", e.target.value)} placeholder={`سؤال ${i + 1} (مثال: اسم حيوان)`} className="sm:col-span-5 bg-black/40 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
              <input value={p.answer} onChange={e => updatePrompt(i, "answer", e.target.value)} placeholder="الإجابة المتوقعة" className="sm:col-span-6 bg-black/40 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-amber-300" />
              <button
                onClick={() => onPrompts(prompts.filter((_, j) => j !== i))}
                disabled={prompts.length <= 1}
                className="sm:col-span-1 p-2 rounded-lg text-rose-300 hover:bg-rose-500/20 disabled:opacity-30 inline-flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => onPrompts([...prompts, { prompt: "", answer: "" }])}
          className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25 inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة سؤال آخر
        </button>
      </div>
    </div>
  );
}

interface MemoryEditorProps {
  pairs: MemoryPair[];
  onPairs: (v: MemoryPair[]) => void;
  onUpload: (file: File) => Promise<string | null>;
}

function MemoryEditor({ pairs, onPairs, onUpload }: MemoryEditorProps) {
  const updateSide = (i: number, side: "a" | "b", patch: Partial<{ kind: "text" | "image"; value: string }>) => {
    onPairs(pairs.map((p, j) => j === i ? { ...p, [side]: { ...p[side], ...patch } } : p));
  };
  const handleUpload = async (i: number, side: "a" | "b", file: File) => {
    const url = await onUpload(file);
    if (url) updateSide(i, side, { value: url });
  };
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-bold text-emerald-100/60">أزواج المطابقة (يفضّل 3 أو 4 أزواج)</div>
      <div className="space-y-2">
        {pairs.map((pair, i) => (
          <div key={i} className="rounded-lg bg-black/40 border border-white/10 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-amber-200">زوج {i + 1}</div>
              <button onClick={() => onPairs(pairs.filter((_, j) => j !== i))} disabled={pairs.length <= 2} className="p-1 rounded text-rose-300 hover:bg-rose-500/20 disabled:opacity-30">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {(["a", "b"] as const).map(side => (
              <div key={side} className="flex gap-1.5 items-center">
                <span className="text-[10px] font-bold text-emerald-200/70 w-6 text-center">{side === "a" ? "A" : "B"}</span>
                <select value={pair[side].kind} onChange={e => updateSide(i, side, { kind: e.target.value as "text" | "image", value: "" })} className="bg-black/50 text-white rounded px-2 py-1.5 text-xs border border-white/10">
                  <option value="text">نص</option>
                  <option value="image">صورة</option>
                </select>
                {pair[side].kind === "text" ? (
                  <input value={pair[side].value} onChange={e => updateSide(i, side, { value: e.target.value })} placeholder="نص" className="flex-1 bg-black/40 text-white rounded px-2 py-1.5 text-xs border border-white/10 focus:outline-none focus:border-amber-300" />
                ) : pair[side].value ? (
                  <div className="flex-1 flex items-center gap-2">
                    <img src={pair[side].value} alt="" className="h-10 w-10 object-cover rounded" />
                    <button onClick={() => updateSide(i, side, { value: "" })} className="px-2 py-1 rounded text-rose-300 hover:bg-rose-500/20 text-[11px] font-bold">إزالة</button>
                  </div>
                ) : (
                  <label className="flex-1 px-2 py-1.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25 cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold">
                    <Upload className="w-3 h-3" />
                    رفع صورة
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(i, side, f); }} className="hidden" />
                  </label>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <button
        onClick={() => onPairs([...pairs, { a: { kind: "text", value: "" }, b: { kind: "text", value: "" } }])}
        disabled={pairs.length >= 6}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40 inline-flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        إضافة زوج
      </button>
    </div>
  );
}

interface CategorizeEditorProps {
  groups: CategorizeGroup[];
  onGroups: (v: CategorizeGroup[]) => void;
}

function CategorizeEditor({ groups, onGroups }: CategorizeEditorProps) {
  const updateGroup = (i: number, patch: Partial<CategorizeGroup>) => {
    onGroups(groups.map((g, j) => j === i ? { ...g, ...patch } : g));
  };
  const updateItem = (gi: number, ii: number, v: string) => {
    onGroups(groups.map((g, j) => j === gi ? { ...g, items: g.items.map((it, k) => k === ii ? v : it) } : g));
  };
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-bold text-emerald-100/60">المجموعات (مثال: «خضار»، «فواكه») وعناصر كل مجموعة</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-lg bg-black/40 border border-white/10 p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input value={g.name} onChange={e => updateGroup(gi, { name: e.target.value })} placeholder="اسم المجموعة" className="flex-1 bg-black/50 text-white rounded px-2 py-1.5 text-sm font-bold border border-white/10 focus:outline-none focus:border-amber-300" />
              <button onClick={() => onGroups(groups.filter((_, j) => j !== gi))} disabled={groups.length <= 2} className="p-1.5 rounded text-rose-300 hover:bg-rose-500/20 disabled:opacity-30">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {g.items.map((it, ii) => (
                <div key={ii} className="flex gap-1.5 items-center">
                  <input value={it} onChange={e => updateItem(gi, ii, e.target.value)} placeholder={`عنصر ${ii + 1}`} className="flex-1 bg-black/40 text-white rounded px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-amber-300" />
                  <button onClick={() => updateGroup(gi, { items: g.items.filter((_, k) => k !== ii) })} disabled={g.items.length <= 1} className="p-1 rounded text-rose-300 hover:bg-rose-500/20 disabled:opacity-30">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button onClick={() => updateGroup(gi, { items: [...g.items, ""] })} className="text-[11px] text-emerald-200/80 hover:text-emerald-100 font-bold inline-flex items-center gap-1">
                <Plus className="w-3 h-3" />
                إضافة عنصر
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => onGroups([...groups, { name: "", items: ["", ""] }])}
        disabled={groups.length >= 4}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40 inline-flex items-center gap-1"
      >
        <Plus className="w-3.5 h-3.5" />
        إضافة مجموعة
      </button>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels: Record<Step, string> = { 1: "الفرق", 2: "الفئات", 3: "الوسائل والمؤقت" };
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 flex-wrap">
      {([1, 2, 3] as Step[]).map((s, idx) => {
        const done = s < step;
        const current = s === step;
        return (
          <div key={s} className="flex items-center gap-1.5 sm:gap-2">
            <div className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3 py-1.5 border-2 transition ${current ? "bg-amber-400 text-emerald-950 border-amber-200 shadow-lg" : done ? "bg-emerald-700/60 text-amber-100 border-emerald-500/60" : "bg-black/30 text-emerald-100/50 border-white/10"}`}>
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/30 text-[10px] sm:text-xs font-extrabold flex items-center justify-center">
                {done ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : s}
              </span>
              <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">{labels[s]}</span>
            </div>
            {idx < 2 && <div className="w-3 sm:w-6 h-px bg-white/15" />}
          </div>
        );
      })}
    </div>
  );
}
