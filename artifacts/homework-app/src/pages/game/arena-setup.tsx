import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Play, Users, Swords, Sparkles, Check, Trophy,
  Plus, Trash2, ChevronRight, ChevronLeft, X, UserPlus, LogIn, Lock,
  ChevronDown, Award, Image as ImageIcon, Upload, Edit3, Globe, FolderPlus,
  Save, Camera, Crown, Inbox, Dices, Wand2, Info, Palette, Smile, Search,
} from "lucide-react";
import { toCoverThumb } from "@/data/arena-cover-images";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import {
  ARENA_SECTIONS, HELPERS, buildCustomSection, coverForIndex,
  type ArenaCustomQuestion, type ArenaDifficulty, type ArenaSection,
  type ArenaSubCategory, type ArenaCover, type HelperId,
  type MemoryPair, type CategorizeGroup, type SinJeemPrompt,
  type SecretPayload,
} from "@/data/arena-questions";
import { saveArenaState, loadArenaLastSettings, saveArenaLastSettings, type ArenaState } from "@/lib/arena-store";
import {
  fetchArenaCategories, fetchArenaActivities, buildDbSections,
  createArenaCategory, updateArenaCategory, deleteArenaCategory,
  createArenaActivity, updateArenaActivity, deleteArenaActivity,
  uploadImageFile, fetchArenaImportSources, aiGenerateArenaQuestions,
  type DbArenaCategory, type DbArenaActivity, type ArenaImportSources,
  type AiGeneratedQuestion,
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

  /* Scroll to top whenever the wizard step changes so the organiser
     immediately sees the new step's primary actions (e.g. "صنع فئتك"
     and "قرعة عشوائية" at the top of step 2). */
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);
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

  // Secret game categories — loaded at mount for the section picker
  const [secretSectionCats, setSecretSectionCats] = useState<{ id: number; name: string; emoji: string; coverImageUrl: string | null }[]>([]);
  useEffect(() => {
    fetch("/api/secret-game/categories", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: number; nameAr?: string; name?: string; icon?: string; emoji?: string; coverImageUrl?: string | null }[]) => {
        setSecretSectionCats(data.map(c => ({
          id: c.id,
          name: c.nameAr ?? c.name ?? "فئة",
          emoji: c.icon ?? c.emoji ?? "🔍",
          coverImageUrl: c.coverImageUrl ?? null,
        })));
      })
      .catch(() => {});
  }, []);

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

  // Virtual "اكتشف السر" section — each secret-game DB category becomes a subcategory
  const secretArenaSection = useMemo<ArenaSection | null>(() => {
    if (secretSectionCats.length === 0) return null;
    return {
      id: "secret-game",
      name: "اكتشف السر",
      emoji: "🔍",
      cover: { emoji: "🔍", color: "#7c3aed", gradient: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" },
      subCategories: secretSectionCats.map(cat => ({
        id: `secret-cat-${cat.id}`,
        name: cat.name,
        cover: { emoji: cat.emoji, color: "#7c3aed", gradient: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)", imageUrl: cat.coverImageUrl ?? null },
        questions: {
          200: [{ q: `اكتشف السر — ${cat.name}`, a: "", type: "secret" as const, payload: { categoryId: cat.id, maxQuestions: 20 } as SecretPayload }],
          400: [],
          600: [],
          800: [],
        } as Record<ArenaDifficulty, import("@/data/arena-questions").ArenaQuestion[]>,
      })),
    };
  }, [secretSectionCats]);

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
    if (secretArenaSection) all.unshift(secretArenaSection);
    if (custom) all.push(custom);
    return all;
  }, [customQuestions, dbSections, mergedSubsByStaticId, secretArenaSection]);

  // Search query for filtering visible categories on Step 2
  const [catSearch, setCatSearch] = useState("");
  const normalizedSearch = catSearch.trim().toLowerCase();
  const filteredSectionsForPicker = useMemo<ArenaSection[]>(() => {
    if (!normalizedSearch) return sectionsForPicker;
    const result: ArenaSection[] = [];
    for (const sec of sectionsForPicker) {
      const sectionMatches = sec.name.toLowerCase().includes(normalizedSearch);
      const matchedSubs = sec.subCategories.filter(s =>
        s.name.toLowerCase().includes(normalizedSearch),
      );
      if (sectionMatches) {
        // If section name itself matches, keep all its sub-categories
        result.push(sec);
      } else if (matchedSubs.length > 0) {
        result.push({ ...sec, subCategories: matchedSubs });
      }
    }
    return result;
  }, [sectionsForPicker, normalizedSearch]);
  const totalVisibleSubs = useMemo(
    () => filteredSectionsForPicker.reduce((sum, s) => sum + s.subCategories.length, 0),
    [filteredSectionsForPicker],
  );

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

  /* Mutually exclusive: opening one popover closes the other for that team. */
  const toggleEmoji = (idx: number) => {
    setShowColors(prev => prev.map((v, i) => i === idx ? false : v));
    setShowEmoji(prev => prev.map((v, i) => i === idx ? !v : v));
  };
  const toggleColors = (idx: number) => {
    setShowEmoji(prev => prev.map((v, i) => i === idx ? false : v));
    setShowColors(prev => prev.map((v, i) => i === idx ? !v : v));
  };

  /* Tap-to-reveal helper descriptions on small screens (key: `${teamIdx}:${helperId}`) */
  const [expandedHelperInfo, setExpandedHelperInfo] = useState<Set<string>>(new Set());
  const toggleHelperInfo = (teamIdx: number, helperId: HelperId) => {
    const key = `${teamIdx}:${helperId}`;
    setExpandedHelperInfo(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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

  /* ───────── Random pick (قرعة الفئات الذكية) ───────── */
  const [randomReveal, setRandomReveal] = useState<null | {
    pool: ArenaSubCategory[];
    result: string[][]; // result[teamIdx] = [3 subCategory ids]
  }>(null);

  const pickRandomCategories = () => {
    const pool: ArenaSubCategory[] = sectionsForPicker.flatMap(s => s.subCategories);
    const needed = teams.length * 3;
    if (pool.length < needed) {
      toast.error(`تحتاج ${needed} فئة على الأقل — المتاح ${pool.length}`);
      return;
    }
    /* Fisher–Yates shuffle for unbiased distribution */
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picks = shuffled.slice(0, needed);
    const result: string[][] = teams.map((_, ti) =>
      picks.slice(ti * 3, ti * 3 + 3).map(s => s.id),
    );
    setRandomReveal({ pool, result });
  };

  const applyRandomPick = () => {
    if (!randomReveal) return;
    setTeams(prev => prev.map((t, i) => ({
      ...t,
      subCategoryIds: randomReveal.result[i],
    })));
    setRandomReveal(null);
    toast.success("تم اختيار الفئات بالقرعة 🎉");
  };

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
    // Include ALL DB sub-categories in the saved state — not just the standalone
    // sections but also the ones merged into static sections (mergedSubsByStaticId).
    // The play screen resolves sub-category IDs by searching allSections; if a
    // DB sub-cat only lives in mergedSubsByStaticId it is never saved and becomes
    // invisible on the board.
    const dbSectionsForState: ArenaSection[] = [
      ...(secretArenaSection ? [secretArenaSection] : []),
      ...dbSections,
      ...Object.entries(mergedSubsByStaticId)
        .filter(([, subs]) => subs.length > 0)
        .map(([staticId, subs]) => {
          const staticSec = ARENA_SECTIONS.find(s => s.id === staticId);
          return {
            id: `db-merged-${staticId}`,
            name: staticSec?.name ?? staticId,
            emoji: staticSec?.emoji ?? "📚",
            cover: staticSec?.cover ?? { emoji: "📚", color: "#1E4D35" },
            subCategories: subs,
          } satisfies ArenaSection;
        }),
    ];

    saveArenaState({
      tournamentName: tournamentName.trim(),
      teams: teamsRecord,
      teamOrder,
      subCategoryIds: teams.flatMap(t => t.subCategoryIds),
      customQuestions,
      dbSections: dbSectionsForState,
      timerSeconds,
      currentTurn: teamOrder[0],
      usedCards: [],
      pickedQuestions: {},
      active: null,
      rulesAck: true,
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
        background: "#faf6ec",
        fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif",
      }}>
        <div className="container mx-auto px-3 sm:px-4 max-w-6xl">
          <Link href="/games">
            <button className="inline-flex items-center gap-2 text-sm font-bold mb-4 transition" style={{ color: "#5b6b87" }}>
              <BackIcon className="w-4 h-4" />
              عودة للألعاب
            </button>
          </Link>

          {/* ── Hero card — white surface, teal/gold accents ────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-3xl px-5 sm:px-8 py-5 sm:py-6"
            style={{
              background: "#ffffff",
              border: "1px solid #ebe2cd",
              boxShadow:
                "0 1px 3px rgba(0,0,0,0.04), 0 12px 32px -16px rgba(31,77,79,0.18)",
            }}
          >
            <div className="flex flex-col items-center gap-5 mb-5">
              {/* Title block — centered on all viewports */}
              <div className="text-center min-w-0">
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold mb-2"
                  style={{
                    background: "rgba(31,77,79,0.07)",
                    color: "#1f4d4f",
                    border: "1px solid rgba(31,77,79,0.18)",
                  }}
                >
                  <Trophy className="w-3.5 h-3.5" style={{ color: "#c9a14b" }} />
                  ميدان المعرفة · مسابقة الفرق
                </div>
                <h1
                  className="text-3xl sm:text-4xl md:text-5xl font-black"
                  style={{
                    color: "#1f4d4f",
                    fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif",
                    lineHeight: 1.15,
                    letterSpacing: "-0.01em",
                  }}
                >
                  تحدّي حصاد
                </h1>
                <div className="text-sm font-bold mt-1.5" style={{ color: "#5b6b87" }}>
                  {step === 1 && `الخطوة 1 من 3 — ${teams.length > 2 ? `${teams.length} فرق` : "الفريقان"} والأعضاء`}
                  {step === 2 && "الخطوة 2 من 3 — اختيار الفئات والأسئلة المخصصة"}
                  {step === 3 && "الخطوة 3 من 3 — الوسائل المساعدة والمؤقت"}
                </div>
              </div>

              {/* Tournament name input */}
              <div className="w-full max-w-md shrink-0">
                <label
                  className="flex items-center gap-1.5 mb-1.5 text-[11px] font-extrabold tracking-wider"
                  style={{ color: "#a07f37" }}
                >
                  <Crown className="w-3.5 h-3.5" />
                  وضع البطولة (اختياري)
                </label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={e => setTournamentName(e.target.value)}
                  placeholder="مثال: بطولة العلوم 2025"
                  maxLength={60}
                  className="w-full text-sm font-bold rounded-xl px-3.5 py-2.5 outline-none transition placeholder:font-normal"
                  style={{
                    background: "#faf6ec",
                    color: "#1f4d4f",
                    border: "1.5px solid #e9dfc7",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#c9a14b")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#e9dfc7")}
                />
                {tournamentName.trim() && (
                  <div className="mt-1.5 text-[11px] text-center" style={{ color: "#5b6b87" }}>
                    سيظهر <span className="font-black" style={{ color: "#a07f37" }}>«{tournamentName.trim()}»</span> في رأس الشاشة
                  </div>
                )}
              </div>
            </div>

            <Stepper step={step} />
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className={`grid gap-4 sm:gap-5 mb-4 ${teams.length === 2 ? "grid-cols-1 md:grid-cols-2" : teams.length <= 4 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
                  {teams.map((team, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl p-3 sm:p-5 relative"
                      style={{
                        background: "#ffffff",
                        border: `1.5px solid ${team.color}55`,
                        boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -12px ${team.color}55`,
                      }}
                    >
                      {/* Team color top bar */}
                      <div
                        className="absolute top-0 inset-x-0 h-1 rounded-t-2xl"
                        style={{ background: team.color }}
                      />
                      {teams.length > 2 && (
                        <button onClick={() => removeTeam(idx)} className="absolute top-3 start-3 p-1 rounded-full transition" style={{ background: "#faf6ec", color: "#b91c1c" }} title="حذف الفريق">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <div className="flex items-center gap-2 mb-3 mt-1">
                        <Users className="w-4 h-4" style={{ color: "#c9a14b" }} />
                        <span className="text-[11px] font-extrabold tracking-wider" style={{ color: "#a07f37" }}>الفريق {idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 mb-4">
                        <span className="text-3xl sm:text-4xl shrink-0">{team.emoji}</span>
                        <input
                          type="text"
                          value={team.name}
                          onChange={e => updateTeam(idx, { name: e.target.value })}
                          maxLength={24}
                          className="flex-1 min-w-0 text-lg sm:text-2xl font-black rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 outline-none transition"
                          style={{
                            background: "#faf6ec",
                            color: "#1f4d4f",
                            border: "1.5px solid #e9dfc7",
                          }}
                          onFocus={e => (e.currentTarget.style.borderColor = team.color)}
                          onBlur={e => (e.currentTarget.style.borderColor = "#e9dfc7")}
                        />
                      </div>

                      {/* Compact identity row: emoji + color side-by-side */}
                      <div className="grid grid-cols-2 gap-2 mb-4 relative">
                        {/* Emoji pill */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => toggleEmoji(idx)}
                            className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition"
                            style={{
                              background: showEmoji[idx] ? "#ffffff" : "#faf6ec",
                              border: `1.5px solid ${showEmoji[idx] ? team.color : "#ebe2cd"}`,
                              color: "#1f4d4f",
                              boxShadow: showEmoji[idx] ? `0 4px 12px -4px ${team.color}55` : "none",
                            }}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded-md flex items-center justify-center text-base shrink-0" style={{ background: `${team.color}18`, border: `1px solid ${team.color}55` }}>{team.emoji}</span>
                              <span className="text-[12px] font-extrabold truncate">الشعار</span>
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${showEmoji[idx] ? "rotate-180" : ""}`} style={{ color: "#a07f37" }} />
                          </button>
                          <AnimatePresence>
                            {showEmoji[idx] && (
                              <>
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="fixed inset-0 z-30"
                                  onClick={() => toggleEmoji(idx)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                  transition={{ duration: 0.15, ease: "easeOut" }}
                                  className="absolute z-40 top-full mt-1.5 inset-x-0 rounded-2xl p-2"
                                  style={{
                                    background: "#ffffff",
                                    border: "1px solid #ebe2cd",
                                    boxShadow: "0 14px 32px -10px rgba(31,77,79,0.25), 0 0 0 3px rgba(201,161,75,0.18)",
                                  }}
                                >
                                  <div className="text-[10px] font-black mb-1.5 px-1 inline-flex items-center gap-1" style={{ color: "#a07f37" }}>
                                    <Smile className="w-3 h-3" />
                                    اختر شعار الفريق
                                  </div>
                                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                                    {TEAM_EMOJIS.map(em => {
                                      const sel = team.emoji === em;
                                      return (
                                        <motion.button
                                          key={em}
                                          whileTap={{ scale: 0.85 }}
                                          onClick={() => { updateTeam(idx, { emoji: em }); toggleEmoji(idx); }}
                                          className="aspect-square w-full rounded-lg text-xl flex items-center justify-center transition"
                                          style={sel
                                            ? { background: `linear-gradient(135deg, ${team.color}, ${team.color}dd)`, boxShadow: `0 2px 6px ${team.color}66` }
                                            : { background: "#faf6ec", border: "1px solid #ebe2cd" }}
                                        >
                                          {em}
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Color pill */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => toggleColors(idx)}
                            className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition"
                            style={{
                              background: showColors[idx] ? "#ffffff" : "#faf6ec",
                              border: `1.5px solid ${showColors[idx] ? team.color : "#ebe2cd"}`,
                              color: "#1f4d4f",
                              boxShadow: showColors[idx] ? `0 4px 12px -4px ${team.color}55` : "none",
                            }}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded-md shrink-0" style={{ background: team.color, boxShadow: "inset 0 0 0 2px white, 0 0 0 1px #ebe2cd" }} />
                              <span className="text-[12px] font-extrabold truncate">اللون</span>
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${showColors[idx] ? "rotate-180" : ""}`} style={{ color: "#a07f37" }} />
                          </button>
                          <AnimatePresence>
                            {showColors[idx] && (
                              <>
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="fixed inset-0 z-30"
                                  onClick={() => toggleColors(idx)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                  transition={{ duration: 0.15, ease: "easeOut" }}
                                  className="absolute z-40 top-full mt-1.5 inset-x-0 rounded-2xl p-2.5"
                                  style={{
                                    background: "#ffffff",
                                    border: "1px solid #ebe2cd",
                                    boxShadow: "0 14px 32px -10px rgba(31,77,79,0.25), 0 0 0 3px rgba(201,161,75,0.18)",
                                  }}
                                >
                                  <div className="text-[10px] font-black mb-2 px-1 inline-flex items-center gap-1" style={{ color: "#a07f37" }}>
                                    <Palette className="w-3 h-3" />
                                    اختر لون الفريق
                                  </div>
                                  <div className="grid grid-cols-7 gap-1.5">
                                    {TEAM_COLORS.map(c => {
                                      const sel = team.color === c.color;
                                      return (
                                        <motion.button
                                          key={c.color}
                                          whileTap={{ scale: 0.85 }}
                                          onClick={() => { updateTeam(idx, { color: c.color }); toggleColors(idx); }}
                                          className="aspect-square w-full rounded-full transition relative flex items-center justify-center"
                                          style={{
                                            background: c.color,
                                            boxShadow: sel
                                              ? `inset 0 0 0 2px white, 0 0 0 2px ${c.color}, 0 4px 8px -2px ${c.color}88`
                                              : `inset 0 0 0 2px white, 0 0 0 1px #ebe2cd`,
                                          }}
                                          title={c.name}
                                        >
                                          {sel && <Check className="w-3.5 h-3.5 text-white drop-shadow" strokeWidth={3} />}
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: "#5b6b87" }}>
                            <UserPlus className="w-3.5 h-3.5" />
                            لاعبو الفريق <span className="opacity-70">(اختياري)</span>
                          </div>
                          <span className="text-[10px] font-bold" style={{ color: "#a07f37" }}>{team.players.length}/12</span>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={playerDraft[idx] ?? ""}
                            onChange={e => setPlayerDraft(prev => prev.map((v, i) => i === idx ? e.target.value : v))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPlayer(idx); } }}
                            placeholder="اسم اللاعب"
                            maxLength={20}
                            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition"
                            style={{ background: "#faf6ec", color: "#1f4d4f", border: "1px solid #ebe2cd" }}
                            onFocus={e => (e.currentTarget.style.borderColor = team.color)}
                            onBlur={e => (e.currentTarget.style.borderColor = "#ebe2cd")}
                          />
                          <button onClick={() => addPlayer(idx)} className="px-3 py-2 rounded-lg font-bold text-sm hover:opacity-90 shadow-sm" style={{ background: team.color }}>
                            <Plus className="w-4 h-4 text-white" />
                          </button>
                        </div>
                        {team.players.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {team.players.map(p => (
                              <span key={p} className="inline-flex items-center gap-1 rounded-full text-xs font-bold px-2.5 py-1" style={{ background: `${team.color}18`, border: `1px solid ${team.color}55`, color: team.color }}>
                                {p}
                                <button onClick={() => removePlayer(idx, p)} className="rounded-full hover:bg-black/10 p-0.5">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px]" style={{ color: "#9ca3af" }}>بدون لاعبين فرديين — سيُحتسب الإجابة للفريق فقط</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {teams.length < 8 && (
                  <button onClick={addTeam} className="w-full py-3 rounded-2xl border-2 border-dashed font-bold transition inline-flex items-center justify-center gap-2 mb-4" style={{ borderColor: "#c9a14b66", color: "#a07f37", background: "#ffffff" }}>
                    <Plus className="w-5 h-5" />
                    إضافة فريق ({teams.length}/8)
                  </button>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* Action bar: create category */}
                <div className="rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3" style={{ background: "#ffffff", border: "1px solid #ebe2cd", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(31,77,79,0.08)" }}>
                      <Swords className="w-4 h-4" style={{ color: "#1f4d4f" }} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-extrabold truncate" style={{ color: "#1f4d4f" }}>مكتبة الفئات البصرية</h2>
                      <p className="text-xs sm:text-sm" style={{ color: "#5b6b87" }}>اختر 3 فئات لكل فريق — كل فئة بـ <strong style={{ color: "#a07f37" }}>6 بطاقات</strong> (200×2، 400×2، 600×2) · يمكن إضافة <strong style={{ color: "#c9a14b" }}>800⭐</strong> عبر فئة مخصصة</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <motion.button
                      onClick={pickRandomCategories}
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.95, rotate: -2 }}
                      className="relative px-4 py-2.5 rounded-xl font-extrabold text-sm inline-flex items-center gap-2 overflow-hidden"
                      style={{
                        background: "linear-gradient(135deg, #1f4d4f 0%, #2d5e3f 55%, #1f4d4f 100%)",
                        color: "#ffffff",
                        boxShadow: "0 8px 22px -6px rgba(31,77,79,0.55), inset 0 0 0 1px rgba(201,161,75,0.45)",
                      }}
                      title="قرعة عشوائية — يختار 3 فئات لكل فريق دون تحيّز"
                    >
                      {/* Shimmer */}
                      <motion.span
                        aria-hidden
                        className="absolute inset-0"
                        animate={{ x: ["-130%", "130%"] }}
                        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
                        style={{
                          background: "linear-gradient(90deg, transparent 0%, rgba(201,161,75,0.55) 50%, transparent 100%)",
                          width: "55%",
                        }}
                      />
                      <motion.span
                        animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
                        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.2 }}
                        className="relative inline-flex"
                      >
                        <Dices className="w-4 h-4" style={{ color: "#f5d272" }} />
                      </motion.span>
                      <span className="relative">قرعة عشوائية</span>
                    </motion.button>
                    <button
                      onClick={() => { setEditingCat(null); setEditorOpen(true); }}
                      className="px-4 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2 shadow-md transition hover:opacity-95"
                      style={{ background: "linear-gradient(135deg, #c9a14b 0%, #b8860b 100%)", color: "white" }}
                    >
                      <FolderPlus className="w-4 h-4" />
                      اصنع فئتك
                    </button>
                  </div>
                </div>

                {/* Admin-only quick link to question reports inbox */}
                {isAdmin && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 flex-wrap"
                    style={{
                      background: "linear-gradient(135deg, #ffffff 0%, #faf6ec 100%)",
                      border: "1px solid rgba(201,161,75,0.4)",
                      boxShadow: "0 4px 14px -6px rgba(201,161,75,0.25)",
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <motion.div
                        animate={{ rotate: [0, -6, 6, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: "linear-gradient(135deg, #c9a14b, #a07f37)",
                          boxShadow: "0 6px 14px -4px rgba(201,161,75,0.55)",
                        }}
                      >
                        <Inbox className="w-4.5 h-4.5 text-white" />
                      </motion.div>
                      <div className="min-w-0">
                        <div className="font-black text-sm" style={{ color: "#1f4d4f" }}>صندوق بلاغات الأسئلة</div>
                        <div className="text-[11px] font-bold" style={{ color: "#5b6b87" }}>راجع الشكاوى التي يرسلها المعلّمون عن أسئلة تحدّي حصاد</div>
                      </div>
                    </div>
                    <Link
                      href="/teacher/arena-reports"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #1f4d4f, #2d5e3f)",
                        color: "#ffffff",
                        boxShadow: "0 6px 14px -4px rgba(31,77,79,0.45)",
                      }}
                    >
                      فتح الصندوق
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Link>
                  </motion.div>
                )}

                {/* Search bar — filters categories across all sections */}
                <div
                  className="rounded-2xl mb-4 relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, #ffffff 0%, #faf6ec 100%)",
                    border: "1.5px solid #ebe2cd",
                    boxShadow: "0 4px 14px -6px rgba(31,77,79,0.12), inset 0 0 0 1px rgba(201,161,75,0.18)",
                  }}
                >
                  {/* Gold accent strip */}
                  <div
                    className="absolute top-0 inset-x-0 h-[3px]"
                    style={{ background: "linear-gradient(90deg, transparent, #c9a14b, transparent)" }}
                  />
                  <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
                    <motion.div
                      animate={catSearch ? { rotate: [0, -10, 10, 0] } : { rotate: 0 }}
                      transition={{ duration: 0.5 }}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #1f4d4f, #2d5e3f)",
                        boxShadow: "0 6px 14px -4px rgba(31,77,79,0.45)",
                      }}
                    >
                      <Search className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
                    </motion.div>
                    <input
                      type="search"
                      value={catSearch}
                      onChange={(e) => setCatSearch(e.target.value)}
                      placeholder="ابحث عن فئة أو قسم… (مثل: جغرافيا، لغة، فلك)"
                      className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm sm:text-base font-bold placeholder:font-medium"
                      style={{ color: "#1f4d4f" }}
                      aria-label="بحث في الفئات"
                    />
                    {catSearch && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => setCatSearch("")}
                        className="w-8 h-8 rounded-full inline-flex items-center justify-center shrink-0 transition hover:bg-rose-50"
                        style={{ color: "#5b6b87" }}
                        title="مسح البحث"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    )}
                    <span
                      className="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full shrink-0"
                      style={{
                        background: catSearch ? "rgba(201,161,75,0.18)" : "rgba(31,77,79,0.08)",
                        color: catSearch ? "#a07f37" : "#1f4d4f",
                        border: `1px solid ${catSearch ? "rgba(201,161,75,0.4)" : "rgba(31,77,79,0.2)"}`,
                      }}
                    >
                      {totalVisibleSubs} فئة
                    </span>
                  </div>
                </div>

                {/* Visual category grid */}
                <div className="space-y-5">
                  {filteredSectionsForPicker.length === 0 ? (
                    <div
                      className="rounded-2xl p-8 text-center"
                      style={{ background: "#ffffff", border: "1px dashed #ebe2cd", color: "#5b6b87" }}
                    >
                      <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <div className="font-extrabold text-base mb-1" style={{ color: "#1f4d4f" }}>
                        لا توجد نتائج لـ «{catSearch}»
                      </div>
                      <div className="text-xs">جرّب كلمة أخرى أو امسح البحث لعرض كل الفئات.</div>
                    </div>
                  ) : (
                    filteredSectionsForPicker.map((sec, secIdx) => (
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
                    ))
                  )}
                </div>

                <div className="mt-3 text-xs text-center font-bold" style={{ color: "#5b6b87" }}>
                  {teams.map((t) => `${t.subCategoryIds.length}/3 لـ ${t.name}`).join(" | ")} — المجموع {allSelected.size}/{teams.length * 3}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {/* ── Helpers selection — professional white cards ──────── */}
                <div
                  className="rounded-2xl p-5 sm:p-6 mb-4"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #ebe2cd",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -16px rgba(31,77,79,0.18)",
                  }}
                >
                  <div className="flex items-start gap-3 mb-5 pb-4 border-b" style={{ borderColor: "#ebe2cd" }}>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(201,161,75,0.14)" }}>
                      <Sparkles className="w-5 h-5" style={{ color: "#c9a14b" }} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-black" style={{ color: "#1f4d4f", fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}>
                        وسائل المساعدة
                      </h2>
                      <p className="text-sm mt-0.5" style={{ color: "#5b6b87" }}>
                        اختر <strong style={{ color: "#1f4d4f" }}>3 وسائل لكل فريق</strong> — كل وسيلة تُستخدم مرة واحدة فقط في المسابقة
                      </p>
                    </div>
                  </div>

                  <div className={`grid gap-4 ${teams.length <= 2 ? "md:grid-cols-2" : teams.length <= 4 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                    {teams.map((team, teamIdx) => {
                      const complete = team.helpers.length === 3;
                      return (
                        <div
                          key={teamIdx}
                          className="rounded-2xl p-4 relative overflow-hidden transition"
                          style={{
                            background: "#faf6ec",
                            border: `1.5px solid ${complete ? team.color : "#e9dfc7"}`,
                            boxShadow: complete ? `0 6px 20px -10px ${team.color}80` : "0 1px 2px rgba(0,0,0,0.03)",
                          }}
                        >
                          {/* Team color top accent */}
                          <div className="absolute top-0 inset-x-0 h-1" style={{ background: team.color }} />

                          <div className="flex items-center gap-2 mb-3 mt-1">
                            <span className="text-2xl">{team.emoji}</span>
                            <span className="font-black text-base flex-1 truncate" style={{ color: "#1f4d4f" }}>{team.name}</span>
                            <span
                              className="text-[11px] font-extrabold px-2.5 py-1 rounded-full"
                              style={{
                                background: complete ? team.color : "#ffffff",
                                color: complete ? "white" : team.color,
                                border: `1.5px solid ${team.color}`,
                              }}
                            >
                              {team.helpers.length}/3
                            </span>
                          </div>

                          {/* Compact 2-col grid (mobile-first) — single-line on larger screens */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {HELPERS.map(h => {
                              const active = team.helpers.includes(h.id);
                              const disabled = !active && team.helpers.length >= 3;
                              const infoKey = `${teamIdx}:${h.id}`;
                              const infoOpen = expandedHelperInfo.has(infoKey);
                              return (
                                <motion.div
                                  key={h.id}
                                  layout
                                  className="relative rounded-xl overflow-hidden"
                                  style={active
                                    ? {
                                        background: "#ffffff",
                                        border: `1.5px solid ${team.color}`,
                                        boxShadow: `0 4px 14px -4px ${team.color}55, inset 0 0 0 1px ${team.color}22`,
                                      }
                                    : {
                                        background: "#ffffff",
                                        border: "1.5px solid #ebe2cd",
                                      }}
                                >
                                  {/* Info button (top corner) */}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); toggleHelperInfo(teamIdx, h.id); }}
                                    className="absolute top-1.5 start-1.5 w-6 h-6 rounded-full flex items-center justify-center transition z-10"
                                    style={{
                                      background: infoOpen ? "#1f4d4f" : "#faf6ec",
                                      color: infoOpen ? "#fff" : "#5b6b87",
                                      border: `1px solid ${infoOpen ? "#1f4d4f" : "#ebe2cd"}`,
                                    }}
                                    aria-label={infoOpen ? "إخفاء الشرح" : "عرض الشرح"}
                                    title={infoOpen ? "إخفاء الشرح" : "عرض الشرح"}
                                  >
                                    <Info className="w-3 h-3" />
                                  </button>

                                  {/* Active check badge */}
                                  {active && (
                                    <motion.div
                                      initial={{ scale: 0, rotate: -90 }}
                                      animate={{ scale: 1, rotate: 0 }}
                                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                      className="absolute top-1.5 end-1.5 w-6 h-6 rounded-full flex items-center justify-center z-10"
                                      style={{ background: team.color, boxShadow: `0 4px 8px -2px ${team.color}aa` }}
                                    >
                                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                    </motion.div>
                                  )}

                                  {/* Tap-to-toggle area */}
                                  <button
                                    type="button"
                                    onClick={() => toggleHelper(teamIdx, h.id)}
                                    disabled={disabled}
                                    className="w-full px-2 pt-7 pb-2.5 flex flex-col items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    <motion.span
                                      whileTap={{ scale: 0.9, rotate: -8 }}
                                      className="text-3xl leading-none"
                                    >
                                      {h.emoji}
                                    </motion.span>
                                    <span
                                      className="text-[12px] font-extrabold text-center leading-tight line-clamp-2"
                                      style={{ color: active ? team.color : "#1f4d4f" }}
                                    >
                                      {h.name}
                                    </span>
                                  </button>

                                  {/* Inline expandable description */}
                                  <AnimatePresence initial={false}>
                                    {infoOpen && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: "easeOut" }}
                                        className="overflow-hidden"
                                        style={{ borderTop: "1px solid #ebe2cd", background: "#faf6ec" }}
                                      >
                                        <div className="px-2.5 py-2 text-[10.5px] leading-snug font-medium" style={{ color: "#1f4d4f" }}>
                                          {h.desc}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Timer selection ─────────────────────────────────────── */}
                <div
                  className="rounded-2xl p-5 sm:p-6"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #ebe2cd",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -16px rgba(31,77,79,0.18)",
                  }}
                >
                  <div className="flex items-start gap-3 mb-4 pb-4 border-b" style={{ borderColor: "#ebe2cd" }}>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(91,107,135,0.12)" }}>
                      <Award className="w-5 h-5" style={{ color: "#5b6b87" }} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-black" style={{ color: "#1f4d4f", fontFamily: "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif" }}>
                        مدة المؤقت لكل سؤال
                      </h2>
                      <p className="text-sm mt-0.5" style={{ color: "#5b6b87" }}>المؤقت يبدأ تلقائياً عند فتح كل سؤال</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[20, 30, 45, 60, 90].map(s => {
                      const active = timerSeconds === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setTimerSeconds(s)}
                          className="px-5 py-2.5 rounded-xl font-extrabold transition text-base"
                          style={active
                            ? { background: "#1f4d4f", color: "#ffffff", boxShadow: "0 4px 12px -4px rgba(31,77,79,0.5)" }
                            : { background: "#faf6ec", color: "#1f4d4f", border: "1.5px solid #e9dfc7" }}
                        >
                          {s} ثانية
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 sm:gap-3 mt-6">
            <button
              onClick={goPrev}
              disabled={step === 1}
              className="px-4 sm:px-5 py-3 rounded-xl font-bold transition disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base shrink-0"
              style={{ background: "#ffffff", color: "#1f4d4f", border: "1.5px solid #e9dfc7" }}
            >
              <ChevronRight className="w-4 h-4" />
              <span className="hidden sm:inline">السابق</span>
            </button>
            {step < 3 ? (
              <button
                onClick={goNext}
                className="flex-1 py-3 rounded-xl font-extrabold text-base sm:text-lg transition shadow-md inline-flex items-center justify-center gap-2 sm:gap-3 hover:opacity-95"
                style={{ background: "linear-gradient(135deg, #1f4d4f 0%, #2d5e3f 100%)", color: "white", boxShadow: "0 8px 24px -10px rgba(31,77,79,0.5)" }}
              >
                التالي
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={start}
                disabled={!canStart}
                className="flex-1 py-3 sm:py-4 rounded-xl font-extrabold text-lg sm:text-2xl transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 sm:gap-3 hover:opacity-95"
                style={{
                  background: "linear-gradient(135deg, #c9a14b 0%, #b8860b 100%)",
                  color: "white",
                  boxShadow: "0 12px 32px -10px rgba(201,161,75,0.6)",
                }}
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

        <AnimatePresence>
          {randomReveal && (
            <RandomPickReveal
              teams={teams}
              pool={randomReveal.pool}
              result={randomReveal.result}
              onClose={() => setRandomReveal(null)}
              onApply={applyRandomPick}
            />
          )}
        </AnimatePresence>
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
    <div className="rounded-2xl p-3 sm:p-4" style={{
      background: "#ffffff",
      border: "1px solid #ebe2cd",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div className="flex items-center gap-2.5 mb-3 px-1">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{
          background: cover.gradient ?? cover.color,
          boxShadow: `0 4px 14px -4px ${cover.color}`,
        }}>
          <span>{cover.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-base sm:text-lg truncate" style={{ color: "#1f4d4f" }}>{section.name}</h3>
          <div className="text-[10px] sm:text-[11px] font-bold" style={{ color: "#5b6b87" }}>
            {section.subCategories.length} فئات
          </div>
        </div>
        {isCustom && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: "rgba(201,161,75,0.15)", color: "#a07f37", border: "1px solid rgba(201,161,75,0.4)" }}>
            خاص بك
          </span>
        )}
        {isDbSec && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1" style={{ background: "rgba(31,77,79,0.10)", color: "#1f4d4f", border: "1px solid rgba(31,77,79,0.25)" }}>
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
  /* Only count 200/400/600 in the badge — 800 is optional/bonus */
  const counts = (sub.questions[200]?.length ?? 0) + (sub.questions[400]?.length ?? 0) + (sub.questions[600]?.length ?? 0);
  const has800 = (sub.questions[800]?.length ?? 0) > 0 && sub.id.startsWith("db-");
  return (
    <div
      className={`rounded-2xl overflow-hidden border-2 transition-all duration-300 relative flex flex-col ${dimmed ? "opacity-35 scale-[0.98]" : ""}`}
      style={{
        background: "#ffffff",
        borderColor: taken ? (winningTeam?.color ?? cover.color) : "#ebe2cd",
        boxShadow: taken
          ? `0 8px 28px -8px ${winningTeam?.color ?? cover.color}, 0 0 0 2px ${winningTeam?.color ?? cover.color}55`
          : "0 1px 3px rgba(0,0,0,0.04), 0 4px 14px -6px rgba(31,77,79,0.12)",
      }}
    >
      {/* Cover image / gradient (top) — shorter on mobile */}
      <div
        className="aspect-[5/3] relative overflow-hidden"
        style={{ background: cover.imageUrl ? "#0E2A1D" : (cover.gradient ?? cover.color) }}
      >
        {cover.imageUrl ? (
          <img
            src={toCoverThumb(cover.imageUrl) ?? cover.imageUrl}
            alt={sub.name}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const img = e.currentTarget;
              if (cover.imageUrl && img.src !== cover.imageUrl) img.src = cover.imageUrl;
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl sm:text-5xl drop-shadow-lg" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>
              {cover.emoji}
            </span>
          </div>
        )}
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Question count badge */}
        <div className="absolute top-1.5 end-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[9px] font-bold">
          {counts}{has800 ? "+⭐" : ""} سؤال
        </div>

        {/* Edit button */}
        {editable && onEdit && (
          <button
            onClick={onEdit}
            className="absolute top-1.5 start-1.5 p-1.5 rounded-full bg-black/50 backdrop-blur-sm text-amber-200 hover:bg-amber-400 hover:text-emerald-950"
            title="تعديل الفئة"
          >
            <Edit3 className="w-3 h-3" />
          </button>
        )}

        {/* Taken badge — small, at bottom of image, not full overlay */}
        {taken && winningTeam && (
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-1.5">
            <div className="px-2.5 py-1 rounded-full font-black text-[11px] sm:text-xs shadow-xl" style={{ background: winningTeam.color, color: "white" }}>
              {winningTeam.emoji} {winningTeam.name}
            </div>
          </div>
        )}
      </div>

      {/* Title bar */}
      <div className="px-2 py-1.5 text-center" style={{ background: cover.color, color: "white" }}>
        <div className="font-extrabold text-xs sm:text-sm leading-tight truncate" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
          {sub.name}
        </div>
      </div>

      {/* Difficulty chips row — shows 200/400/600 (and 800 if DB-backed has it) */}
      <div className="px-1.5 py-1 flex gap-1 justify-center flex-wrap" style={{ background: "#faf6ec", borderTop: "1px solid #ebe2cd" }}>
        {([200, 400, 600] as ArenaDifficulty[]).map(d => {
          const c = DIFF_CHIP_STYLES[d];
          return (
            <span key={d} className="text-[8px] sm:text-[9px] font-black rounded px-1.5 py-0.5" style={{ color: c.text, background: c.activeBg }}>
              {d}
            </span>
          );
        })}
        {has800 && (
          <span className="text-[8px] sm:text-[9px] font-black rounded px-1.5 py-0.5" style={{ color: DIFF_CHIP_STYLES[800].text, background: DIFF_CHIP_STYLES[800].activeBg }}>
            800⭐
          </span>
        )}
      </div>

      {/* Team selector buttons */}
      <div className="p-1.5 grid gap-1" style={{ background: "#ffffff", borderTop: "1px solid #ebe2cd", gridTemplateColumns: `repeat(${Math.min(teams.length, 4)}, 1fr)` }}>
        {teams.map((team, teamIdx) => {
          const picked = team.subCategoryIds.includes(sub.id);
          const disabledByOther = !picked && takenByIdx !== -1 && takenByIdx !== teamIdx;
          return (
            <button
              key={teamIdx}
              onClick={() => onToggle(teamIdx)}
              disabled={disabledByOther}
              title={team.name}
              className="text-[10px] sm:text-[11px] font-extrabold rounded-md py-1.5 px-1 transition disabled:opacity-25 disabled:cursor-not-allowed truncate"
              style={picked
                ? { background: team.color, color: "#fff", boxShadow: `0 4px 10px -3px ${team.color}` }
                : { background: "#faf6ec", color: "#1f4d4f", border: "1px solid #ebe2cd" }
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

  // Import-source flags + AI generation dialog
  const [importSources, setImportSources] = useState<ArenaImportSources>({ manual: true, ai: true, homework: true, file: true });
  const [fileImporting, setFileImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(6);
  const [aiBonus, setAiBonus] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<AiGeneratedQuestion[]>([]);
  const [aiSavingAll, setAiSavingAll] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetchArenaImportSources().then(s => { if (!cancel) setImportSources(s); });
    return () => { cancel = true; };
  }, []);

  const generateAi = async () => {
    if (!aiTopic.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResults([]);
    const r = await aiGenerateArenaQuestions({
      topic: aiTopic.trim(),
      count: aiCount,
      includeBonus800: aiBonus,
      language: "ar",
      notes: aiNotes.trim() || undefined,
    });
    setAiLoading(false);
    if (r.error || r.questions.length === 0) {
      toast.error(r.error || "تعذّر توليد الأسئلة");
      return;
    }
    setAiResults(r.questions);
  };

  const handleFileImport = async (file: File) => {
    if (!savedCatId) {
      toast.error("احفظ الفئة أولاً قبل الاستيراد");
      return;
    }
    if (fileImporting) return;
    setFileImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("الملف فارغ");
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      // Accept Arabic or English headers: السؤال/question, الإجابة/answer,
      // الصعوبة/difficulty (200|400|600|800), التلميح/hint (optional).
      const norm = (s: any) => String(s ?? "").trim();
      const pickKey = (row: any, keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
          if (found && norm(row[found])) return norm(row[found]);
        }
        return "";
      };
      const parseDiff = (v: string): 200 | 400 | 600 | 800 => {
        const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
        if (n === 200 || n === 400 || n === 600 || n === 800) return n;
        return 400;
      };
      const candidates = rows
        .map(r => ({
          q: pickKey(r, ["السؤال", "question", "q"]),
          a: pickKey(r, ["الإجابة", "answer", "a"]),
          diff: parseDiff(pickKey(r, ["الصعوبة", "difficulty", "diff", "points", "النقاط"]) || "400"),
          hint: pickKey(r, ["التلميح", "hint"]),
        }))
        .filter(r => r.q && r.a);
      if (candidates.length === 0) {
        toast.error("لم نجد أعمدة 'السؤال' و'الإجابة' — تأكّد من رؤوس الجدول");
        return;
      }
      let created = 0;
      for (const r of candidates) {
        const row = await createArenaActivity({
          categoryId: savedCatId,
          type: "text",
          difficulty: r.diff,
          question: r.q,
          answer: r.a,
          hint: r.hint || null,
        }, "file");
        if (row) created++;
      }
      if (created > 0) {
        toast.success(`تم استيراد ${created} سؤال`);
        const acts = await fetchArenaActivities([savedCatId]);
        setActivities(acts);
      } else {
        toast.error("لم يُحفظ أي سؤال — قد تكون مصادر الاستيراد معطّلة");
      }
    } catch (err) {
      toast.error("تعذّر قراءة الملف — جرّب CSV أو XLSX");
    } finally {
      setFileImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveAllAi = async () => {
    if (!savedCatId || aiResults.length === 0 || aiSavingAll) return;
    setAiSavingAll(true);
    let created = 0;
    for (const q of aiResults) {
      if (!q.q.trim() || !q.a.trim()) continue;
      const row = await createArenaActivity({
        categoryId: savedCatId,
        type: "text",
        difficulty: q.difficulty,
        question: q.q.trim(),
        answer: q.a.trim(),
        hint: q.hint?.trim() || null,
      }, "ai");
      if (row) created++;
    }
    setAiSavingAll(false);
    if (created > 0) {
      toast.success(`تمت إضافة ${created} سؤال`);
      const acts = await fetchArenaActivities([savedCatId]);
      setActivities(acts);
      setAiDialogOpen(false);
      setAiResults([]);
      setAiTopic("");
      setAiNotes("");
    } else {
      toast.error("لم تُحفظ أي أسئلة");
    }
  };

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
  const [draftSecretCategoryId, setDraftSecretCategoryId] = useState<number | null>(null);
  const [secretGameCats, setSecretGameCats] = useState<{ id: number; name: string; emoji: string; count: number }[]>([]);
  const [secretGameCatsLoaded, setSecretGameCatsLoaded] = useState(false);
  const [secretCatPreviews, setSecretCatPreviews] = useState<Record<number, { samples: string[]; loading: boolean }>>({});
  const [hoveredSecretCat, setHoveredSecretCat] = useState<number | null>(null);

  useEffect(() => {
    if (draftType !== "secret" || secretGameCatsLoaded) return;
    setSecretGameCatsLoaded(true);
    fetch("/api/secret-game/categories", { credentials: "include" })
      .then(r => r.json())
      .then((data: { id: number; nameAr?: string; name?: string; icon?: string; emoji?: string; itemCount?: number }[]) => {
        setSecretGameCats(data.map(c => ({
          id: c.id,
          name: c.nameAr ?? c.name ?? "فئة",
          emoji: c.icon ?? c.emoji ?? "🔍",
          count: c.itemCount ?? 0,
        })));
        if (data.length > 0 && !draftSecretCategoryId) {
          setDraftSecretCategoryId(data[0].id);
        }
      })
      .catch(() => {});
  }, [draftType, secretGameCatsLoaded, draftSecretCategoryId]);

  const fetchSecretCatPreview = (catId: number) => {
    if (secretCatPreviews[catId]) return;
    setSecretCatPreviews(prev => ({ ...prev, [catId]: { samples: [], loading: true } }));
    fetch(`/api/secret-game/categories/${catId}/preview`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { count: number; samples: string[] }) => {
        setSecretCatPreviews(prev => ({ ...prev, [catId]: { samples: data.samples ?? [], loading: false } }));
      })
      .catch(() => {
        setSecretCatPreviews(prev => ({ ...prev, [catId]: { samples: [], loading: false } }));
      });
  };

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
    setDraftSecretCategoryId(secretGameCats[0]?.id ?? null);
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
      case "secret": {
        if (!draftSecretCategoryId) return { ok: false, error: "اختر فئة اكشف السر" };
        const catName = secretGameCats.find(c => c.id === draftSecretCategoryId)?.name ?? "اكشف السر";
        return {
          ok: true,
          data: {
            type: "secret",
            question: `اكشف السر — ${catName}`,
            answer: catName,
            payload: { categoryId: draftSecretCategoryId, maxQuestions: 10 } as unknown as DbArenaActivity["payload"],
          },
        };
      }
      default:
        return { ok: false, error: "نوع غير مدعوم" };
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
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <h4 className="font-extrabold text-base text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-amber-300" />
                      أسئلة الفئة
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {importSources.ai && (
                        <button
                          onClick={() => setAiDialogOpen(true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-gradient-to-l from-fuchsia-500/30 to-violet-500/30 border border-fuchsia-300/40 text-fuchsia-100 hover:from-fuchsia-500/45 hover:to-violet-500/45"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          توليد بالذكاء
                        </button>
                      )}
                      {importSources.homework && (
                        <button
                          onClick={() => toast.info("استيراد من واجباتك — قريباً")}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/25"
                        >
                          <Inbox className="w-3.5 h-3.5" />
                          من الواجبات
                        </button>
                      )}
                      {importSources.file && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileImport(f); }}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={fileImporting}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 bg-sky-500/15 border border-sky-400/30 text-sky-100 hover:bg-sky-500/25 disabled:opacity-60"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {fileImporting ? "جارٍ الاستيراد..." : "من ملف Excel/CSV"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {!importSources.manual && (
                    <div className="rounded-xl bg-black/30 border border-dashed border-white/10 p-3 mb-3 text-center text-emerald-100/60 text-xs">
                      الإدخال اليدوي معطّل من قِبَل المسؤول — استخدم زر «توليد بالذكاء» أعلاه.
                    </div>
                  )}
                  {importSources.manual && (
                  <div className="rounded-xl bg-black/30 border border-white/10 p-3 mb-3 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        { id: "text", label: "نصي", emoji: "📝" },
                        { id: "image", label: "بصورة", emoji: "🖼️" },
                        { id: "logo", label: "شعار", emoji: "🏷️" },
                        { id: "sin-jeem", label: "سين جيم", emoji: "🔤" },
                        { id: "memory", label: "ذاكرة", emoji: "🧠" },
                        { id: "categorize", label: "تصنيف", emoji: "🗂️" },
                        { id: "secret", label: "اكشف السر", emoji: "🔍" },
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

                    {draftType === "secret" && (
                      <div className="space-y-3 p-3 rounded-xl border border-purple-400/30 bg-purple-500/8">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-300 text-lg">🔍</span>
                          <span className="text-sm font-extrabold text-purple-200">إعداد جولة اكشف السر</span>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-emerald-100/70 mb-1 block">فئة الأسرار</label>
                          {secretGameCats.length === 0 ? (
                            <div className="text-xs text-emerald-100/50 py-2">جارٍ التحميل...</div>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {secretGameCats.map(cat => (
                                <div
                                  key={cat.id}
                                  className="relative"
                                  onMouseEnter={() => { setHoveredSecretCat(cat.id); fetchSecretCatPreview(cat.id); }}
                                  onMouseLeave={() => setHoveredSecretCat(null)}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setDraftSecretCategoryId(cat.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition ${draftSecretCategoryId === cat.id ? "bg-purple-500 text-white shadow" : "bg-white/10 text-white/70 hover:bg-white/15"}`}
                                  >
                                    <span>{cat.emoji}</span>
                                    <span>{cat.name}</span>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none ${draftSecretCategoryId === cat.id ? "bg-white/25 text-white" : "bg-white/15 text-white/60"}`}>
                                      {cat.count}
                                    </span>
                                  </button>

                                  {hoveredSecretCat === cat.id && (
                                    <div className="absolute bottom-full mb-1.5 right-0 z-50 min-w-[160px] max-w-[220px] rounded-xl bg-[#1a0d30] border border-purple-400/40 shadow-xl p-2.5 text-right pointer-events-none">
                                      <div className="text-[10px] font-extrabold text-purple-300 mb-1.5 flex items-center gap-1 justify-end">
                                        <span>عينة من الأسرار</span>
                                        <span className="text-purple-400">🔍</span>
                                      </div>
                                      {secretCatPreviews[cat.id]?.loading ? (
                                        <div className="text-[10px] text-white/40 text-center py-1">جارٍ التحميل…</div>
                                      ) : secretCatPreviews[cat.id]?.samples.length === 0 ? (
                                        <div className="text-[10px] text-white/40 text-center py-1">لا توجد عناصر</div>
                                      ) : (
                                        <ul className="space-y-1">
                                          {secretCatPreviews[cat.id]?.samples.map((s, i) => (
                                            <li key={i} className="text-[11px] text-white/80 flex items-center gap-1.5 justify-end">
                                              <span>{s}</span>
                                              <span className="text-purple-400 shrink-0">•</span>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                      <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-white/40 text-center">
                                        {cat.count} عنصر في الفئة
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-emerald-100/50 flex items-center gap-1">
                          <span className="text-purple-300">⏱</span> كل جولة تحتوي على حد أقصى 10 أسئلة
                        </div>
                      </div>
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
                  )}

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
                              {a.type === "secret" && (
                                <span className="text-base shrink-0" title="اكشف السر">🔍</span>
                              )}
                              {a.imageUrl && a.type !== "secret" && (
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

      {/* AI generation dialog */}
      <AnimatePresence>
        {aiDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
            onClick={() => !aiLoading && !aiSavingAll && setAiDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-2xl bg-gradient-to-b from-emerald-950 to-emerald-900 border-2 border-fuchsia-300/40 rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <Wand2 className="w-5 h-5 text-fuchsia-300" />
                  <div>
                    <h3 className="text-base font-extrabold text-white">توليد أسئلة بالذكاء الاصطناعي</h3>
                    <p className="text-[11px] text-emerald-100/60">يُعيّن النموذج الصعوبة تلقائياً (200/400/600) — يمكنك التعديل قبل الحفظ.</p>
                  </div>
                </div>
                <button onClick={() => !aiLoading && !aiSavingAll && setAiDialogOpen(false)} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-emerald-100/80">الموضوع</label>
                  <input
                    value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                    placeholder="مثال: الأنبياء في القرآن، عواصم الدول العربية، فيزياء الحركة"
                    className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-fuchsia-300"
                    dir="rtl"
                  />
                </div>

                <div className="grid sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5 space-y-1.5">
                    <label className="text-xs font-bold text-emerald-100/80">عدد الأسئلة</label>
                    <input
                      type="number" min={1} max={12} value={aiCount}
                      onChange={e => setAiCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                      className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-fuchsia-300"
                    />
                  </div>
                  <label className="sm:col-span-7 flex items-center gap-2 cursor-pointer rounded-lg bg-amber-400/10 border border-amber-300/30 px-3 py-2">
                    <input type="checkbox" checked={aiBonus} onChange={e => setAiBonus(e.target.checked)} className="w-4 h-4 accent-amber-400" />
                    <span className="text-xs font-bold text-amber-200">+ سؤال بونص (800 نقطة) — صعب جداً</span>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-emerald-100/80">ملاحظات للنموذج (اختياري)</label>
                  <input
                    value={aiNotes} onChange={e => setAiNotes(e.target.value)}
                    placeholder="مثال: للمرحلة الابتدائية، تجنّب المعلومات المتقدمة"
                    className="w-full bg-black/40 text-white rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-fuchsia-300 text-sm"
                    dir="rtl"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={generateAi} disabled={aiLoading || !aiTopic.trim()}
                    className="px-4 py-2 rounded-xl font-bold bg-gradient-to-l from-fuchsia-500 to-violet-500 text-white hover:from-fuchsia-400 hover:to-violet-400 inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    {aiLoading ? "جارٍ التوليد..." : (aiResults.length > 0 ? "إعادة التوليد" : "توليد")}
                  </button>
                  {aiResults.length > 0 && (
                    <span className="text-xs text-emerald-100/70">عاين الأسئلة وعدّلها قبل الحفظ.</span>
                  )}
                </div>

                {aiResults.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="text-xs font-bold text-emerald-100/80">الأسئلة المُولّدة ({aiResults.length})</div>
                    {aiResults.map((q, i) => (
                      <div key={i} className="rounded-lg bg-black/40 border border-white/10 p-2.5 space-y-1.5">
                        <div className="grid sm:grid-cols-12 gap-2">
                          <input
                            value={q.q}
                            onChange={e => setAiResults(prev => prev.map((x, j) => j === i ? { ...x, q: e.target.value } : x))}
                            className="sm:col-span-5 bg-black/40 text-white rounded-md px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-fuchsia-300"
                            placeholder="السؤال"
                          />
                          <input
                            value={q.a}
                            onChange={e => setAiResults(prev => prev.map((x, j) => j === i ? { ...x, a: e.target.value } : x))}
                            className="sm:col-span-4 bg-black/40 text-white rounded-md px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-fuchsia-300"
                            placeholder="الإجابة"
                          />
                          <div className="sm:col-span-2 flex items-center">
                            <DiffChips
                              value={q.difficulty}
                              onChange={(d) => setAiResults(prev => prev.map((x, j) => j === i ? { ...x, difficulty: d } : x))}
                            />
                          </div>
                          <button
                            onClick={() => setAiResults(prev => prev.filter((_, j) => j !== i))}
                            className="sm:col-span-1 p-1.5 rounded-md text-rose-300 hover:bg-rose-500/20 inline-flex items-center justify-center"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          value={q.hint ?? ""}
                          onChange={e => setAiResults(prev => prev.map((x, j) => j === i ? { ...x, hint: e.target.value } : x))}
                          placeholder="تلميح (اختياري)"
                          className="w-full bg-black/40 text-white rounded-md px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-fuchsia-300"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10 bg-black/30">
                <button
                  onClick={() => !aiSavingAll && setAiDialogOpen(false)}
                  disabled={aiSavingAll}
                  className="px-4 py-2 rounded-xl font-bold text-white/70 hover:text-white border border-white/15 hover:border-white/30"
                >
                  إغلاق
                </button>
                {aiResults.length > 0 && (
                  <button
                    onClick={saveAllAi} disabled={aiSavingAll}
                    className="px-5 py-2 rounded-xl font-bold bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {aiSavingAll ? "جارٍ الحفظ..." : `حفظ كل الأسئلة (${aiResults.length})`}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

/* ─────────────────────────── Random pick reveal modal ─────────────────────────── */

interface RandomPickRevealProps {
  teams: TeamFormState[];
  pool: ArenaSubCategory[];
  result: string[][]; // result[teamIdx] -> 3 sub ids
  onClose: () => void;
  onApply: () => void;
}

function RandomPickReveal({ teams, pool, result, onClose, onApply }: RandomPickRevealProps) {
  const subById = useMemo(() => {
    const m = new Map<string, ArenaSubCategory>();
    pool.forEach((s, i) => m.set(s.id, s));
    return m;
  }, [pool]);
  const coverFor = (sub: ArenaSubCategory, idx: number): ArenaCover => {
    if (sub.cover) return sub.cover;
    return coverForIndex(idx, { emoji: "🎯" });
  };
  const poolWithCover = useMemo(
    () => pool.map((s, i) => ({ sub: s, cover: coverFor(s, i) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool],
  );

  /* Track how many reels have finished — auto-apply when all done. */
  const totalReels = teams.length * 3;
  const [doneCount, setDoneCount] = useState(0);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (doneCount >= totalReels && !allDone) {
      setAllDone(true);
      const t = setTimeout(() => onApply(), 1400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [doneCount, totalReels, allDone, onApply]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(31,77,79,0.78)", backdropFilter: "blur(10px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      dir="rtl"
    >
      <motion.div
        initial={{ scale: 0.9, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        className="w-full max-w-6xl rounded-3xl overflow-hidden relative"
        style={{
          background: "#faf6ec",
          border: "1px solid #ebe2cd",
          boxShadow: "0 30px 80px -20px rgba(0,0,0,0.55), 0 0 0 4px rgba(201,161,75,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent strip */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="h-1.5 origin-right"
          style={{ background: "linear-gradient(90deg, #c9a14b 0%, #a07f37 50%, #c9a14b 100%)" }}
        />

        {/* Header */}
        <div className="px-5 sm:px-7 pt-5 pb-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ borderBottom: "1px solid #ebe2cd" }}>
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, -12, 12, -8, 8, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6 }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #c9a14b, #a07f37)",
                boxShadow: "0 10px 22px -6px rgba(201,161,75,0.55)",
              }}
            >
              <Dices className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h2 className="text-lg sm:text-xl font-black inline-flex items-center gap-2" style={{ color: "#1f4d4f" }}>
                <Wand2 className="w-4 h-4" style={{ color: "#a07f37" }} />
                قرعة الفئات الذكية
              </h2>
              <p className="text-[11px] sm:text-xs font-bold" style={{ color: "#5b6b87" }}>
                نختار {teams.length * 3} فئات بشكل عشوائي تماماً — 3 فئات لكل فريق
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition"
            style={{ color: "#5b6b87", background: "#ffffff", border: "1px solid #ebe2cd" }}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reels grid */}
        <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto">
          <div
            className="grid gap-3 sm:gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.min(teams.length, 4)}, minmax(0, 1fr))`,
            }}
          >
            {teams.map((team, ti) => (
              <motion.div
                key={ti}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: ti * 0.08 }}
                className="rounded-2xl p-3 sm:p-4 flex flex-col gap-2.5"
                style={{
                  background: "#ffffff",
                  border: `2px solid ${team.color}33`,
                  boxShadow: `0 8px 24px -10px ${team.color}55`,
                }}
              >
                {/* Team header */}
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                    style={{
                      background: `linear-gradient(135deg, ${team.color}, ${team.color}dd)`,
                      color: "#ffffff",
                      boxShadow: `0 4px 12px -3px ${team.color}88`,
                    }}
                  >
                    {team.emoji}
                  </div>
                  <div className="font-extrabold text-sm truncate" style={{ color: "#1f2937" }}>
                    {team.name}
                  </div>
                </div>

                {/* 3 reels */}
                {[0, 1, 2].map((slot) => (
                  <SlotReel
                    key={slot}
                    pool={poolWithCover}
                    finalSub={subById.get(result[ti][slot])!}
                    finalIdx={pool.findIndex(s => s.id === result[ti][slot])}
                    teamColor={team.color}
                    delay={400 + ti * 180 + slot * 520}
                    onDone={() => setDoneCount((c) => c + 1)}
                  />
                ))}
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs font-bold" style={{ color: "#5b6b87" }}>
              {allDone ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1.5"
                  style={{ color: "#2d5e3f" }}
                >
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "#c9a14b" }} />
                  اكتملت القرعة — جارٍ التطبيق...
                </motion.span>
              ) : (
                <span>{doneCount} من {totalReels} فئات تم اختيارها</span>
              )}
            </div>
            <div className="flex items-center gap-2 ms-auto">
              <button
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-bold"
                style={{ background: "#faf6ec", color: "#1f4d4f", border: "1px solid #ebe2cd" }}
              >
                إلغاء
              </button>
              {allDone && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onApply}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 text-white"
                  style={{
                    background: "linear-gradient(135deg, #2d5e3f, #1f4d4f)",
                    boxShadow: "0 8px 20px -6px rgba(31,77,79,0.55)",
                  }}
                >
                  <Check className="w-3.5 h-3.5" />
                  تطبيق الآن
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SlotReel({
  pool, finalSub, finalIdx, teamColor, delay, onDone,
}: {
  pool: { sub: ArenaSubCategory; cover: ArenaCover }[];
  finalSub: ArenaSubCategory;
  finalIdx: number;
  teamColor: string;
  delay: number;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"wait" | "spin" | "locked">("wait");
  const [tickIdx, setTickIdx] = useState(() => Math.floor(Math.random() * pool.length));

  useEffect(() => {
    let intervalId: number | undefined;
    let lockTimeoutId: number | undefined;
    const startTimeoutId = window.setTimeout(() => {
      setPhase("spin");
      let speed = 60;
      let i = tickIdx;
      const tick = () => {
        i = (i + 1) % pool.length;
        setTickIdx(i);
      };
      intervalId = window.setInterval(tick, speed);

      /* Slow-down then lock */
      lockTimeoutId = window.setTimeout(() => {
        if (intervalId) window.clearInterval(intervalId);
        setTickIdx(finalIdx >= 0 ? finalIdx : 0);
        setPhase("locked");
        onDone();
      }, 1100);
    }, delay);

    return () => {
      window.clearTimeout(startTimeoutId);
      if (intervalId) window.clearInterval(intervalId);
      if (lockTimeoutId) window.clearTimeout(lockTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = phase === "locked"
    ? { sub: finalSub, cover: pool[finalIdx >= 0 ? finalIdx : 0]?.cover ?? coverForIndex(0) }
    : pool[tickIdx] ?? { sub: finalSub, cover: coverForIndex(0) };

  const locked = phase === "locked";
  const coverImg = current.cover.imageUrl;
  const accent = locked ? teamColor : (current.cover.color ?? "#1f4d4f");

  return (
    <motion.div
      animate={
        locked
          ? { scale: [1, 1.08, 1], boxShadow: `0 0 0 3px ${teamColor}, 0 12px 28px -8px ${teamColor}aa` }
          : phase === "spin"
            ? { y: [0, -2, 0] }
            : {}
      }
      transition={
        locked
          ? { duration: 0.55, ease: "easeOut" }
          : { duration: 0.18, repeat: Infinity, ease: "easeInOut" }
      }
      className="relative rounded-xl overflow-hidden flex items-center gap-2.5 p-2"
      style={{
        background: locked
          ? "linear-gradient(135deg, #ffffff, #faf6ec)"
          : "#faf6ec",
        border: `1.5px solid ${locked ? teamColor : "#ebe2cd"}`,
        minHeight: 56,
      }}
    >
      {/* Cover thumb */}
      <div
        className="w-12 h-12 rounded-lg shrink-0 relative overflow-hidden flex items-center justify-center"
        style={{
          background: coverImg ? "#0E2A1D" : (current.cover.gradient ?? accent),
        }}
      >
        {coverImg ? (
          <img
            src={coverImg}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl">{current.cover.emoji}</span>
        )}
      </div>

      {/* Name with vertical scroll feel during spin */}
      <div className="flex-1 min-w-0 relative h-6 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${phase}-${current.sub.id}`}
            initial={phase === "spin" ? { y: 18, opacity: 0 } : { opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={phase === "spin" ? { y: -18, opacity: 0 } : { opacity: 0 }}
            transition={{ duration: phase === "spin" ? 0.12 : 0.3 }}
            className="font-extrabold text-sm truncate"
            style={{ color: locked ? "#1f4d4f" : "#1f2937" }}
          >
            {current.sub.name}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Lock indicator */}
      {locked ? (
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(135deg, ${teamColor}, ${teamColor}dd)`,
            color: "#ffffff",
            boxShadow: `0 4px 10px -2px ${teamColor}aa`,
          }}
        >
          <Check className="w-4 h-4" />
        </motion.div>
      ) : (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(201,161,75,0.18)", color: "#a07f37" }}
        >
          <Dices className="w-3.5 h-3.5" />
        </motion.div>
      )}

      {/* Lock-in shimmer flash */}
      {locked && (
        <motion.span
          aria-hidden
          initial={{ x: "-130%" }}
          animate={{ x: "130%" }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="absolute inset-y-0 w-1/2 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.7) 50%, transparent 100%)",
          }}
        />
      )}
    </motion.div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels: Record<Step, string> = { 1: "الفرق", 2: "الفئات", 3: "الوسائل والمؤقت" };
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
      {([1, 2, 3] as Step[]).map((s, idx) => {
        const done = s < step;
        const current = s === step;
        const styles = current
          ? { background: "linear-gradient(135deg, #c9a14b 0%, #b8860b 100%)", color: "white", border: "1.5px solid #b8860b", boxShadow: "0 4px 12px -4px rgba(201,161,75,0.5)" }
          : done
          ? { background: "rgba(31,77,79,0.10)", color: "#1f4d4f", border: "1.5px solid rgba(31,77,79,0.25)" }
          : { background: "#faf6ec", color: "#9ca3af", border: "1.5px solid #ebe2cd" };
        const numStyles = current
          ? { background: "rgba(255,255,255,0.25)", color: "white" }
          : done
          ? { background: "#1f4d4f", color: "white" }
          : { background: "#ffffff", color: "#9ca3af" };
        return (
          <div key={s} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3.5 py-1.5 transition" style={styles}>
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full text-[10px] sm:text-xs font-extrabold flex items-center justify-center" style={numStyles}>
                {done ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={3} /> : s}
              </span>
              <span className="text-[10px] sm:text-xs font-extrabold whitespace-nowrap">{labels[s]}</span>
            </div>
            {idx < 2 && <div className="w-4 sm:w-8 h-px" style={{ background: "#d6c89a" }} />}
          </div>
        );
      })}
    </div>
  );
}
