import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Play, Users, Trophy, ChevronDown, X, UserPlus, Tv2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  ARENA_SECTIONS, HELPERS, buildCustomSection,
  type ArenaDifficulty, type ArenaSection,
  type HelperId,
} from "@/data/arena-questions";
import { saveArenaState, loadArenaLastSettings, saveArenaLastSettings } from "@/lib/arena-store";
import { toCoverThumb } from "@/data/arena-cover-images";
import {
  fetchArenaCategories, fetchArenaActivities, buildDbSections,
  type DbArenaCategory, type DbArenaActivity,
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

const DIFFICULTIES: ArenaDifficulty[] = [200, 400, 600];

interface TeamFormState {
  name: string;
  color: string;
  emoji: string;
  subCategoryIds: string[];
  helpers: HelperId[];
}

type Step = 1 | 2 | 3;

const defaultTeam = (idx: number): TeamFormState => ({
  name: `الفريق ${idx + 1}`,
  color: TEAM_COLORS[idx % TEAM_COLORS.length].color,
  emoji: TEAM_EMOJIS[idx % TEAM_EMOJIS.length],
  subCategoryIds: [],
  helpers: [],
});

const STEPS = [
  { label: "الفرق" },
  { label: "الفئات" },
  { label: "المساعدات" },
];

function Stepper({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-5">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all ${
                  active
                    ? "bg-amber-400 border-amber-300 text-emerald-950"
                    : done
                    ? "bg-emerald-600 border-emerald-400 text-white"
                    : "bg-white/10 border-white/20 text-white/50"
                }`}
              >
                {done ? "✓" : n}
              </div>
              <span
                className={`text-[10px] mt-1 font-bold ${
                  active ? "text-amber-300" : done ? "text-emerald-300" : "text-white/40"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-10 sm:w-16 h-0.5 mb-5 mx-1 rounded transition-all ${
                  step > n ? "bg-emerald-500" : "bg-white/15"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function buildInitialTeams(): TeamFormState[] {
  const saved = loadArenaLastSettings();
  if (saved && saved.teams.length >= 2) {
    return saved.teams.map(t => ({
      name: t.name,
      color: t.color,
      emoji: t.emoji,
      subCategoryIds: t.subCategoryIds,
      helpers: t.helpers,
    }));
  }
  return [
    { name: "الفريق الأول", color: TEAM_COLORS[0].color, emoji: "🦅", subCategoryIds: [], helpers: [] },
    { name: "الفريق الثاني", color: TEAM_COLORS[1].color, emoji: "🦁", subCategoryIds: [], helpers: [] },
  ];
}

export default function PublicArenaSetup() {
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const [step, setStep] = useState<Step>(1);
  const [teams, setTeams] = useState<TeamFormState[]>(buildInitialTeams);
  const [showEmoji, setShowEmoji] = useState<boolean[]>(() => teams.map(() => false));
  const [showColors, setShowColors] = useState<boolean[]>(() => teams.map(() => false));
  const [timerSeconds, setTimerSeconds] = useState(() => loadArenaLastSettings()?.timerSeconds ?? 20);

  const [dbCats, setDbCats] = useState<DbArenaCategory[]>([]);
  const [dbActs, setDbActs] = useState<DbArenaActivity[]>([]);

  useEffect(() => {
    (async () => {
      const cats = await fetchArenaCategories();
      setDbCats(cats);
      if (cats.length > 0) {
        const acts = await fetchArenaActivities(cats.map(c => c.id));
        setDbActs(acts);
      }
    })();
  }, []);

  const dbSelectedIds = useMemo(() => new Set(dbCats.map(c => c.id)), [dbCats]);
  const { sections: dbSections, mergedSubsByStaticId } = useMemo(
    () => buildDbSections(dbCats, dbActs, dbSelectedIds),
    [dbCats, dbActs, dbSelectedIds],
  );

  const sectionsForPicker = useMemo<ArenaSection[]>(() => {
    const enriched = ARENA_SECTIONS.map(sec => {
      const extra = mergedSubsByStaticId[sec.id];
      if (!extra || extra.length === 0) return sec;
      return { ...sec, subCategories: [...sec.subCategories, ...extra] };
    });
    const all: ArenaSection[] = [...enriched, ...dbSections];
    return all;
  }, [dbSections, mergedSubsByStaticId]);

  const addTeam = () => {
    if (teams.length >= 8) { toast.error("الحد الأقصى 8 فرق"); return; }
    const idx = teams.length;
    setTeams(prev => [...prev, defaultTeam(idx)]);
    setShowEmoji(prev => [...prev, false]);
    setShowColors(prev => [...prev, false]);
  };

  const removeTeam = (idx: number) => {
    if (teams.length <= 2) { toast.error("الحد الأدنى فريقان"); return; }
    setTeams(prev => prev.filter((_, i) => i !== idx));
    setShowEmoji(prev => prev.filter((_, i) => i !== idx));
    setShowColors(prev => prev.filter((_, i) => i !== idx));
  };

  const updateTeam = (idx: number, patch: Partial<TeamFormState>) => {
    setTeams(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const toggleEmoji = (idx: number) => setShowEmoji(prev => prev.map((v, i) => i === idx ? !v : v));
  const toggleColors = (idx: number) => setShowColors(prev => prev.map((v, i) => i === idx ? !v : v));

  const allSelected = useMemo(
    () => new Set(teams.flatMap(t => t.subCategoryIds)),
    [teams],
  );

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
        players: [],
      };
    }
    // Persist settings before launching so per-team sub-category assignments are
    // captured directly from the form (no reconstruction needed after game ends).
    saveArenaLastSettings({
      timerSeconds,
      teams: teams.map(t => ({
        name: t.name.trim(),
        color: t.color,
        emoji: t.emoji,
        subCategoryIds: t.subCategoryIds,
        helpers: t.helpers,
      })),
    });
    sessionStorage.setItem("arena_public_mode", "1");
    saveArenaState({
      tournamentName: "",
      teams: teamsRecord,
      teamOrder,
      subCategoryIds: teams.flatMap(t => t.subCategoryIds),
      customQuestions: [],
      dbSections,
      timerSeconds,
      currentTurn: teamOrder[0],
      usedCards: [],
      pickedQuestions: {},
      active: null,
      rulesAck: false,
      startedAt: Date.now(),
      publicMode: true,
    });
    setLocation("/game/arena/play");
  };

  return (
    <div dir={dir} className="min-h-screen py-4 sm:py-8" style={{
      background: "linear-gradient(180deg, #1E4D35 0%, #0F2A20 45%, #0A1F18 100%)",
    }}>
      <div className="container mx-auto px-3 sm:px-4 max-w-5xl">
        <Link href="/games">
          <button className="inline-flex items-center gap-2 text-sm font-bold text-amber-200/90 hover:text-amber-100 mb-4">
            <ArrowRight className="w-4 h-4" />
            عودة للألعاب
          </button>
        </Link>

        {/* Guest mode badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
          وضع اللعب المفتوح — بدون تسجيل دخول
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-amber-400/15 text-amber-300 text-[10px] sm:text-xs font-bold mb-3 border border-amber-300/30">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">ميدان المعرفة · مسابقة الفرق على الشاشة الكبيرة</span>
          </div>
          <h1
            className="text-3xl sm:text-5xl md:text-6xl font-black mb-2 sm:mb-3 text-transparent bg-clip-text bg-gradient-to-l from-amber-300 via-yellow-200 to-amber-400"
            style={{ lineHeight: 1.18, paddingBottom: "0.25em" }}
          >
            تحدّي حصاد
          </h1>
          <p className="text-emerald-100/80 text-sm sm:text-base px-2">
            {step === 1 && `الخطوة 1 من 3 — ${teams.length > 2 ? `${teams.length} فرق` : "الفريقان"}`}
            {step === 2 && "الخطوة 2 من 3 — اختيار الفئات"}
            {step === 3 && "الخطوة 3 من 3 — الوسائل المساعدة والمؤقت"}
          </p>
        </motion.div>

        <Stepper step={step} />

        <AnimatePresence mode="wait">

          {/* ── Step 1: Teams ── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className={`grid gap-4 mb-4 ${teams.length <= 4 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
                {teams.map((team, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl p-4 border-2 backdrop-blur-sm relative"
                    style={{
                      background: `linear-gradient(160deg, ${team.color}33, ${team.color}0a)`,
                      borderColor: `${team.color}88`,
                      boxShadow: `0 12px 40px -16px ${team.color}80`,
                    }}
                  >
                    {teams.length > 2 && (
                      <button onClick={() => removeTeam(idx)} className="absolute top-2 start-2 p-1 rounded-full bg-black/40 text-rose-300 hover:bg-rose-500/30">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-amber-200" />
                      <span className="text-xs font-bold text-amber-200">الفريق {idx + 1}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-3xl shrink-0">{team.emoji}</span>
                      <input
                        type="text"
                        value={team.name}
                        onChange={e => updateTeam(idx, { name: e.target.value })}
                        maxLength={24}
                        className="flex-1 min-w-0 text-lg font-black bg-black/30 text-white rounded-xl px-3 py-2 border-2 border-white/10 focus:outline-none focus:border-amber-300"
                      />
                    </div>

                    {/* Emoji picker */}
                    <div className="mb-2">
                      <button type="button" onClick={() => toggleEmoji(idx)} className="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-black/30 hover:bg-black/40 border border-white/10 text-emerald-100/90 text-xs font-bold transition">
                        <span className="flex items-center gap-2"><span className="text-lg">{team.emoji}</span> شعار الفريق</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showEmoji[idx] ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {showEmoji[idx] && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 rounded-lg mt-1">
                              {TEAM_EMOJIS.map(em => (
                                <button key={em} onClick={() => { updateTeam(idx, { emoji: em }); toggleEmoji(idx); }} className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition ${team.emoji === em ? "bg-amber-400 ring-2 ring-amber-200" : "bg-white/10 hover:bg-white/20"}`}>
                                  {em}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Color picker */}
                    <div>
                      <button type="button" onClick={() => toggleColors(idx)} className="w-full flex items-center justify-between rounded-lg px-3 py-2 bg-black/30 hover:bg-black/40 border border-white/10 text-emerald-100/90 text-xs font-bold transition">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border border-white/30 inline-block" style={{ background: team.color }} />
                          لون الفريق
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showColors[idx] ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {showColors[idx] && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="flex flex-wrap gap-2 p-2 bg-black/20 rounded-lg mt-1">
                              {TEAM_COLORS.map(c => (
                                <button key={c.color} onClick={() => { updateTeam(idx, { color: c.color }); toggleColors(idx); }} className={`w-8 h-8 rounded-full border-2 transition ${team.color === c.color ? "border-white scale-125 shadow-lg" : "border-white/20 hover:border-white/60"}`} style={{ background: c.color }} title={c.name} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ))}

                {/* Add team card */}
                {teams.length < 8 && (
                  <button
                    onClick={addTeam}
                    className="rounded-2xl p-4 border-2 border-dashed border-white/20 hover:border-amber-400/50 hover:bg-amber-400/5 transition flex items-center justify-center gap-2 text-white/50 hover:text-amber-200 font-bold text-sm"
                  >
                    <UserPlus className="w-5 h-5" />
                    إضافة فريق
                  </button>
                )}
              </div>

              <div className="flex justify-end">
                <button onClick={goNext} disabled={!step1Valid} className="px-8 py-3.5 rounded-xl font-black text-lg bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-xl">
                  التالي ←
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Category picker ── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {sectionsForPicker.map(section => (
                <div key={section.id} className="mb-5">
                  <h3 className="text-sm font-extrabold text-amber-200 mb-2 flex items-center gap-2">
                    <span>{section.emoji}</span> {section.name}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {section.subCategories.map(sub => {
                      const ownerTeamIdx = teams.findIndex(t => t.subCategoryIds.includes(sub.id));
                      const ownerTeam = ownerTeamIdx !== -1 ? teams[ownerTeamIdx] : null;
                      return (
                        <div key={sub.id} className="rounded-xl overflow-hidden border border-white/10">
                          {/* Mini cover */}
                          <div
                            className="h-16 flex items-center justify-center text-2xl relative"
                            style={{
                              background: sub.cover?.gradient ?? sub.cover?.color ?? "#1E4D35",
                            }}
                          >
                            {sub.cover?.imageUrl ? (
                              <img
                                src={toCoverThumb(sub.cover.imageUrl) ?? sub.cover.imageUrl}
                                alt={sub.name}
                                className="absolute inset-0 w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  const orig = sub.cover?.imageUrl;
                                  if (orig && img.src !== orig) img.src = orig;
                                }}
                              />
                            ) : (
                              <span>{sub.cover?.emoji ?? "🎯"}</span>
                            )}
                          </div>
                          <div className="p-2" style={{ background: sub.cover?.color ?? "#1E4D35" }}>
                            <div className="text-white text-[11px] font-bold text-center truncate mb-1">{sub.name}</div>
                            <div className="flex gap-1">
                              {teams.map((team, ti) => {
                                const picked = team.subCategoryIds.includes(sub.id);
                                const takenByOther = ownerTeamIdx !== -1 && ownerTeamIdx !== ti;
                                return (
                                  <button
                                    key={ti}
                                    onClick={() => toggleSub(ti, sub.id)}
                                    disabled={takenByOther}
                                    title={`${team.name} — ${team.emoji}`}
                                    className="flex-1 rounded-lg h-6 text-xs font-black transition disabled:opacity-30 disabled:cursor-not-allowed border"
                                    style={{
                                      background: picked ? team.color : "rgba(0,0,0,0.3)",
                                      borderColor: picked ? team.color : "rgba(255,255,255,0.15)",
                                      color: picked ? "#fff" : "rgba(255,255,255,0.6)",
                                    }}
                                  >
                                    {team.emoji}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Per-team summary */}
              <div className="flex flex-wrap gap-2 mb-4">
                {teams.map((team, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold" style={{ background: `${team.color}22`, borderColor: `${team.color}55`, color: "#fff" }}>
                    <span>{team.emoji}</span>
                    <span>{team.name}</span>
                    <span className={`text-xs font-black ${team.subCategoryIds.length === 3 ? "text-emerald-300" : "text-amber-300"}`}>
                      {team.subCategoryIds.length}/3
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button onClick={goPrev} className="px-6 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20">
                  → السابق
                </button>
                <button onClick={goNext} disabled={!step2Valid} className="px-8 py-3.5 rounded-xl font-black text-lg bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 hover:from-amber-300 hover:to-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-xl">
                  التالي ←
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Helpers + Timer ── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {teams.map((team, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-4 border-2 mb-4"
                  style={{
                    background: `linear-gradient(160deg, ${team.color}22, ${team.color}08)`,
                    borderColor: `${team.color}66`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3 font-bold text-white">
                    <span className="text-2xl">{team.emoji}</span>
                    <span>{team.name}</span>
                    <span className={`text-xs font-black ms-auto ${team.helpers.length === 3 ? "text-emerald-300" : "text-amber-300"}`}>
                      {team.helpers.length}/3
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {HELPERS.map(h => {
                      const picked = team.helpers.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          onClick={() => toggleHelper(idx, h.id)}
                          className="rounded-xl p-3 border-2 text-start transition"
                          style={{
                            background: picked ? `${team.color}44` : "rgba(0,0,0,0.3)",
                            borderColor: picked ? team.color : "rgba(255,255,255,0.15)",
                          }}
                        >
                          <div className="text-2xl mb-1">{h.emoji}</div>
                          <div className="text-xs font-bold text-white">{h.name}</div>
                          <div className="text-[10px] text-emerald-100/60 leading-tight">{h.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Timer */}
              <div className="rounded-2xl p-4 border-2 border-white/15 bg-black/30 mb-6">
                <label className="text-sm font-bold text-amber-200 mb-3 block">⏱ وقت كل سؤال: {timerSeconds} ثانية</label>
                <input
                  type="range"
                  min={10} max={60} step={5}
                  value={timerSeconds}
                  onChange={e => setTimerSeconds(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-xs text-emerald-100/50 mt-1">
                  <span>10ث</span><span>30ث</span><span>60ث</span>
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={goPrev} className="px-6 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20">
                  → السابق
                </button>
                <button
                  onClick={start}
                  disabled={!canStart}
                  className="px-8 py-4 rounded-xl font-black text-xl inline-flex items-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xl"
                  style={{
                    background: canStart ? "linear-gradient(135deg, #fbbf24, #f59e0b)" : undefined,
                    backgroundColor: canStart ? undefined : "rgba(255,255,255,0.1)",
                    color: canStart ? "#0c2e1e" : "rgba(255,255,255,0.4)",
                  }}
                >
                  <Play className="w-6 h-6 fill-current" />
                  ابدأ اللعبة
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Audience mode tip */}
        <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 flex items-start gap-3">
          <Tv2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-emerald-200 font-bold text-sm mb-0.5">وضع المتفرج</p>
            <p className="text-emerald-100/60 text-xs leading-relaxed">
              بعد بدء اللعبة، ستجد زر «وضع المتفرج» في أعلى الشاشة. اضغط عليه لمشاركة رابط أو رمز QR يتيح لأي جهاز ثانٍ متابعة لوحة النقاط مباشرة بدون تسجيل دخول.
            </p>
          </div>
        </div>

        {/* Login upsell footer */}
        <div className="mt-6 text-center">
          <p className="text-emerald-100/50 text-xs mb-2">
            هل أنت معلم أو مدرّب؟
          </p>
          <Link href="/login">
            <button className="px-5 py-2 rounded-xl border border-amber-300/30 text-amber-200/80 hover:text-amber-100 hover:border-amber-300/60 text-sm font-bold transition">
              سجّل الدخول لفتح التخصيص الكامل والحفظ التلقائي
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
