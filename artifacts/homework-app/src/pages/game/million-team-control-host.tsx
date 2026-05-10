import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useRoute, useSearch } from "wouter";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, ChevronLeft, ChevronRight, Loader2, ArrowRight, ArrowLeft, Eye, ArrowLeftRight, Plus, Phone, Users, Shuffle, Percent, Check, Pencil, X, Trash2, Volume2, VolumeX } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { getSocket } from "@/lib/socket";
import { HostJoinBar } from "@/components/host-join-bar";
import { ConfettiBurst } from "@/components/confetti-burst";
import { useGameAudio } from "./useGameAudio";

const API_BASE = import.meta.env.VITE_API_URL || "";
const fmt = (n: number) => n.toLocaleString("en-US");

type PointsScheme = "even" | "progressive" | "stages" | "millionaire-ladder";
const DEFAULT_LADDER = [100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000, 1_000_000];

// Mirrors the server-side reward function in million-class-handlers.ts so the
// host's "default prize" button matches what the server will actually award.
function getQuestionPoints(scheme: PointsScheme, basePoints: number, idx: number, total: number): number {
  const base = Math.max(1, Math.floor(basePoints || 100));
  switch (scheme) {
    case "even": return base;
    case "progressive": return base + Math.floor(base * 0.25) * idx;
    case "stages": {
      const lastFiveStart = Math.max(0, total - 5);
      if (idx >= lastFiveStart) return base * 5;
      const halfway = Math.floor(total / 2);
      if (idx >= halfway) return base * 2;
      return base;
    }
    case "millionaire-ladder":
    default:
      return DEFAULT_LADDER[Math.min(idx, DEFAULT_LADDER.length - 1)] ?? base;
  }
}

function describeScheme(scheme: PointsScheme, basePoints: number, total: number, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  switch (scheme) {
    case "even":
      return ar ? `كل سؤال = ${fmt(basePoints)} نقطة` : `Each question = ${fmt(basePoints)} pts`;
    case "progressive":
      return ar
        ? `يبدأ من ${fmt(basePoints)} ويزداد ${fmt(Math.floor(basePoints * 0.25))} نقطة في كل سؤال`
        : `Starts at ${fmt(basePoints)}, grows by ${fmt(Math.floor(basePoints * 0.25))} per question`;
    case "stages": {
      const half = Math.floor(total / 2);
      const lastFive = Math.min(5, total);
      return ar
        ? `أول ${half} ${fmt(basePoints)} • منتصف ${fmt(basePoints * 2)} • آخر ${lastFive} = ${fmt(basePoints * 5)}`
        : `First ${half}: ${fmt(basePoints)} • Middle: ${fmt(basePoints * 2)} • Last ${lastFive}: ${fmt(basePoints * 5)}`;
    }
    case "millionaire-ladder":
    default:
      return ar ? "سلّم المليون التقليدي" : "Classic millionaire ladder";
  }
}

function schemeLabel(scheme: PointsScheme, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  switch (scheme) {
    case "even": return ar ? "نظام متساوٍ" : "Even";
    case "progressive": return ar ? "نظام تصاعدي" : "Progressive";
    case "stages": return ar ? "نظام المراحل" : "Stages";
    case "millionaire-ladder": default: return ar ? "سلّم المليون" : "Millionaire ladder";
  }
}

interface Q {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  imageUrl?: string | null;
}

type Side = "A" | "B";
type LifelineKey = "fifty" | "phone" | "audience" | "swap";

interface TeamState {
  name: string;
  members: string[];
  score: number;
  lifelinesUsed: Record<LifelineKey, boolean>;
}

const LIFELINES: { key: LifelineKey; ar: string; en: string; Icon: typeof Phone }[] = [
  { key: "fifty", ar: "50:50", en: "50:50", Icon: Percent },
  { key: "phone", ar: "اتصال بصديق", en: "Phone a Friend", Icon: Phone },
  { key: "audience", ar: "مساعدة الجمهور", en: "Audience", Icon: Users },
  { key: "swap", ar: "تبديل السؤال", en: "Swap Question", Icon: Shuffle },
];

export default function MillionTeamControlHost() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/game/million/team-control/:pin");
  const search = useSearch();
  const pin = params?.pin || "";
  // The host token is stored in sessionStorage (not the URL) so that teachers
  // who mirror their browser to a projector do not expose it to students.
  // For backwards compatibility we still accept ?token=... in the URL, but we
  // immediately move it to sessionStorage and strip it from the address bar.
  const hostToken = (() => {
    const urlToken = new URLSearchParams(search).get("token");
    if (urlToken && pin) {
      try { sessionStorage.setItem(`millionClassHostToken:${pin}`, urlToken); } catch { /* ignore */ }
      try { window.history.replaceState({}, "", window.location.pathname); } catch { /* ignore */ }
      return urlToken;
    }
    try { return pin ? (sessionStorage.getItem(`millionClassHostToken:${pin}`) || "") : ""; } catch { return ""; }
  })();
  const BackIcon = lang === "ar" ? ArrowRight : ArrowLeft;

  const [questions, setQuestions] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [teamA, setTeamA] = useState<TeamState | null>(null);
  const [teamB, setTeamB] = useState<TeamState | null>(null);
  const [transferred, setTransferred] = useState<Set<number>>(new Set());
  const [awarding, setAwarding] = useState(false);
  const [customPoints, setCustomPoints] = useState<Record<Side, number>>({ A: 0, B: 0 });
  const [pointsScheme, setPointsScheme] = useState<PointsScheme>("even");
  const [basePoints, setBasePoints] = useState<number>(100);
  const [questionCount, setQuestionCount] = useState<number>(15);
  const [panelTab, setPanelTab] = useState<"teams" | "settings">("teams");
  const [editing, setEditing] = useState<Side | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftMembers, setDraftMembers] = useState<{ A: string[]; B: string[] }>({ A: [], B: [] });
  const [newMember, setNewMember] = useState("");
  const joinedRef = useRef(false);
  const audio = useGameAudio();
  const bgStartedRef = useRef(false);
  const joinUrl = pin ? `${typeof window !== "undefined" ? window.location.origin : ""}${import.meta.env.BASE_URL}game/million/join/${pin}` : "";

  useEffect(() => {
    if (!pin || bgStartedRef.current) return;
    const start = () => {
      if (bgStartedRef.current) return;
      bgStartedRef.current = true;
      try { audio.startBg(); } catch { /* ignore */ }
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      audio.stopBg();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  useEffect(() => {
    if (!pin) return;
    fetch(`${API_BASE}/api/million/class-session/${encodeURIComponent(pin)}/questions`, { credentials: "include" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "load failed");
        return d as { questions: Q[] };
      })
      .then(d => { setQuestions(d.questions || []); setLoading(false); })
      .catch(e => { toast.error(e.message || (lang === "ar" ? "فشل تحميل الأسئلة" : "Failed to load")); setLoading(false); });
  }, [pin, lang]);

  useEffect(() => {
    if (!pin || !hostToken || joinedRef.current) return;
    joinedRef.current = true;
    const socket = getSocket();
    socket.emit("million-class:create", { pin, hostToken }, (res: { ok?: boolean; error?: string }) => {
      if (res.error) toast.error(res.error);
    });
    const onTeam = (data: {
      teamA: TeamState;
      teamB: TeamState;
      currentQuestionIdx: number;
      questionRevealed: boolean;
      transferredQuestions: number[];
      pointsScheme?: PointsScheme;
      basePoints?: number;
      questionCount?: number;
    }) => {
      setTeamA(data.teamA);
      setTeamB(data.teamB);
      setCurrentIdx(data.currentQuestionIdx);
      setReveal(data.questionRevealed);
      setTransferred(new Set(data.transferredQuestions));
      if (data.pointsScheme) setPointsScheme(data.pointsScheme);
      if (typeof data.basePoints === "number") setBasePoints(data.basePoints);
      if (typeof data.questionCount === "number") setQuestionCount(data.questionCount);
    };
    socket.on("million-class:team-state", onTeam);
    return () => { socket.off("million-class:team-state", onTeam); };
  }, [pin, hostToken]);

  const currentQuestion = questions[currentIdx];
  const correctKey = currentQuestion?.correctAnswer?.toUpperCase();
  const totalQ = questions.length;
  const isLast = currentIdx >= totalQ - 1;
  const isFinished = totalQ > 0 && currentIdx >= totalQ;
  const defaultPrize = getQuestionPoints(pointsScheme, basePoints, currentIdx, questionCount || totalQ || 15);
  const isTransferred = transferred.has(currentIdx);
  const winner: "A" | "B" | "TIE" | null = !isFinished || !teamA || !teamB
    ? null
    : teamA.score > teamB.score ? "A"
    : teamB.score > teamA.score ? "B"
    : "TIE";

  // Whose turn is it conceptually? Alternate by question index, with transfers swapping it
  const baseTurn: Side = currentIdx % 2 === 0 ? "A" : "B";
  const currentTurn: Side = isTransferred ? (baseTurn === "A" ? "B" : "A") : baseTurn;

  // Fire victory fanfare + confetti exactly once when the game ends.
  const celebratedRef = useRef(false);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (!isFinished || celebratedRef.current) return;
    celebratedRef.current = true;
    setCelebrate(true);
    try { audio.stopBg(); } catch { /* ignore */ }
    try { audio.playMillion(); } catch { /* ignore */ }
    // Keep the confetti canvas mounted long enough for particles to fall.
    const t = setTimeout(() => setCelebrate(false), 9000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  function emitAction(payload: Record<string, unknown>, onAck?: (res: { ok?: boolean; error?: string }) => void) {
    const socket = getSocket();
    socket.emit("million-class:team-action", { pin, hostToken, ...payload }, (res: { ok?: boolean; error?: string }) => {
      if (res?.error) toast.error(res.error);
      onAck?.(res);
    });
  }

  function handleNext() {
    if (awarding) return;
    setAwarding(true);
    const socket = getSocket();
    socket.emit("million-class:host-next-question", { pin, hostToken }, (res: { ok?: boolean; error?: string }) => {
      setAwarding(false);
      if (res?.error) toast.error(res.error);
    });
  }

  function handleAward(side: Side, points?: number) {
    const pts = points ?? (customPoints[side] || defaultPrize);
    if (!pts || pts === 0) return;
    emitAction({ action: "award", team: side, points: pts });
  }

  function startEdit(side: Side) {
    if (!teamA || !teamB) return;
    setEditing(side);
    setDraftName(side === "A" ? teamA.name : teamB.name);
    setDraftMembers({ A: [...teamA.members], B: [...teamB.members] });
    setNewMember("");
  }

  function cancelEdit() {
    setEditing(null);
    setNewMember("");
  }

  function addDraftMember(side: Side) {
    const name = newMember.trim();
    if (!name) return;
    setDraftMembers(prev => {
      const exists = [...prev.A, ...prev.B].some(m => m.toLowerCase() === name.toLowerCase());
      if (exists) {
        toast.error(lang === "ar" ? "هذا الاسم موجود بالفعل" : "Name already in a team");
        return prev;
      }
      return { ...prev, [side]: [...prev[side], name] };
    });
    setNewMember("");
  }

  function removeDraftMember(side: Side, name: string) {
    setDraftMembers(prev => ({ ...prev, [side]: prev[side].filter(m => m !== name) }));
  }

  function moveDraftMember(from: Side, name: string) {
    const to: Side = from === "A" ? "B" : "A";
    setDraftMembers(prev => ({
      A: from === "A" ? prev.A.filter(m => m !== name) : (to === "A" ? [...prev.A, name] : prev.A),
      B: from === "B" ? prev.B.filter(m => m !== name) : (to === "B" ? [...prev.B, name] : prev.B),
    }));
  }

  function saveEdit(side: Side) {
    if (!teamA || !teamB) return;
    const trimmed = draftName.trim();
    const originalName = side === "A" ? teamA.name : teamB.name;
    const renameNeeded = !!trimmed && trimmed !== originalName;

    let renameOk = !renameNeeded;
    let rosterOk = false;
    let acks = 0;
    const expected = renameNeeded ? 2 : 1;
    const finish = () => {
      acks++;
      if (acks < expected) return;
      if (renameOk && rosterOk) {
        toast.success(lang === "ar" ? "تم حفظ التعديلات" : "Changes saved");
        setEditing(null);
        setNewMember("");
      }
      // On error the emitAction helper already showed a toast; keep the
      // editor open so the teacher can retry without losing their draft.
    };

    if (renameNeeded) {
      emitAction({ action: "rename", team: side, name: trimmed }, res => {
        if (res?.ok) renameOk = true;
        finish();
      });
    }
    emitAction({ action: "roster", teamAMembers: draftMembers.A, teamBMembers: draftMembers.B }, res => {
      if (res?.ok) rosterOk = true;
      finish();
    });
  }

  if (loading || !teamA || !teamB) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
        </div>
      </Layout>
    );
  }

  const renderTeamCard = (side: Side, t: TeamState) => {
    const isA = side === "A";
    const color = isA ? "blue" : "red";
    const isTurn = currentTurn === side;
    const isEditing = editing === side;
    const otherName = side === "A" ? teamB?.name : teamA?.name;
    return (
      <div className={`rounded-2xl p-4 transition-all ${isTurn ? `border-2` : "border"}`} style={{
        background: isA ? "rgba(59,130,246,0.08)" : "rgba(239,68,68,0.08)",
        borderColor: isA ? `rgba(59,130,246,${isTurn ? 0.7 : 0.3})` : `rgba(239,68,68,${isTurn ? 0.7 : 0.3})`,
      }}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className={`text-${color}-300 font-black text-lg flex items-center gap-2 min-w-0`}>
            <span>{isA ? "🔵" : "🔴"}</span>
            <span className="truncate">{t.name}</span>
            {isTurn && <span className={`text-[10px] px-1.5 py-0.5 rounded bg-${color}-500/30 text-${color}-200 shrink-0`}>
              {lang === "ar" ? "الدور" : "TURN"}
            </span>}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-amber-300 font-black text-2xl">{fmt(t.score)}</span>
            <button
              onClick={() => isEditing ? cancelEdit() : startEdit(side)}
              title={lang === "ar" ? "تعديل" : "Edit"}
              className={`p-1.5 rounded-md text-${color}-200 hover:bg-white/10 transition`}
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              {isEditing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="mb-3 p-3 rounded-lg space-y-2" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div>
              <label className="text-[11px] text-blue-300 font-bold uppercase tracking-wide block mb-1">
                {lang === "ar" ? "اسم الفريق" : "Team name"}
              </label>
              <input
                type="text"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                maxLength={40}
                className="w-full px-2 py-1.5 rounded text-white text-sm focus:outline-none"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)" }}
              />
            </div>
            <div>
              <label className="text-[11px] text-blue-300 font-bold uppercase tracking-wide block mb-1">
                {lang === "ar" ? "الأعضاء" : "Members"}
              </label>
              {draftMembers[side].length === 0 ? (
                <p className="text-xs text-blue-400 italic py-1">{lang === "ar" ? "لا يوجد أعضاء" : "No members"}</p>
              ) : (
                <ul className="space-y-1 mb-2">
                  {draftMembers[side].map(m => (
                    <li key={m} className="flex items-center justify-between gap-2 px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <span className="text-white text-xs truncate">{m}</span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => moveDraftMember(side, m)}
                          title={lang === "ar" ? `نقل إلى ${otherName || ""}` : `Move to ${otherName || ""}`}
                          className="p-1 rounded text-amber-300 hover:bg-amber-500/20"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeDraftMember(side, m)}
                          title={lang === "ar" ? "حذف" : "Remove"}
                          className="p-1 rounded text-red-300 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newMember}
                  onChange={e => setNewMember(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDraftMember(side); } }}
                  placeholder={lang === "ar" ? "اسم الطالب" : "Student name"}
                  maxLength={40}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded text-white text-xs focus:outline-none"
                  style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)" }}
                />
                <button
                  onClick={() => addDraftMember(side)}
                  className="px-2 py-1 rounded text-white text-xs font-bold flex items-center gap-1"
                  style={{ background: isA ? "rgba(59,130,246,0.4)" : "rgba(239,68,68,0.4)" }}
                >
                  <Plus className="w-3 h-3" /> {lang === "ar" ? "إضافة" : "Add"}
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => saveEdit(side)}
                className="flex-1 px-2 py-1.5 rounded text-white text-xs font-bold flex items-center justify-center gap-1"
                style={{ background: "rgba(34,197,94,0.45)" }}
              >
                <Check className="w-3.5 h-3.5" /> {lang === "ar" ? "حفظ" : "Save"}
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 px-2 py-1.5 rounded text-white text-xs font-bold flex items-center justify-center gap-1"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <X className="w-3.5 h-3.5" /> {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
            </div>
            <p className="text-[10px] text-blue-400 italic">
              {lang === "ar" ? "النقاط والمساعدات تبقى كما هي." : "Scores & lifelines are preserved."}
            </p>
          </div>
        ) : (
          t.members.length > 0 && (
            <p className={`text-${color}-400 text-xs mb-3`}>{t.members.join(" · ")}</p>
          )
        )}

        {/* Award buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => handleAward(side, defaultPrize)}
            className="px-3 py-2 rounded-lg text-white text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: isA ? "rgba(59,130,246,0.4)" : "rgba(239,68,68,0.4)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            +{fmt(defaultPrize)}
          </button>
          <div className="flex gap-1">
            <input
              type="number"
              value={customPoints[side] || ""}
              onChange={e => setCustomPoints(p => ({ ...p, [side]: Number(e.target.value) || 0 }))}
              placeholder={lang === "ar" ? "مخصّص" : "Custom"}
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-white text-xs focus:outline-none"
              style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
            <button
              onClick={() => handleAward(side)}
              disabled={!customPoints[side]}
              className="px-2 rounded-lg text-white text-xs font-bold disabled:opacity-40"
              style={{ background: isA ? "rgba(59,130,246,0.4)" : "rgba(239,68,68,0.4)" }}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Lifelines (used BY this team AGAINST the opponent) */}
        <p className="text-[11px] text-blue-400 mb-1.5 uppercase tracking-wide">
          {lang === "ar" ? "مساعدات ضد الخصم" : "Lifelines vs opponent"}
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {LIFELINES.map(({ key, ar, en, Icon }) => {
            const used = t.lifelinesUsed[key];
            return (
              <button
                key={key}
                onClick={() => emitAction({ action: "lifeline", team: side, lifeline: key })}
                disabled={used}
                title={lang === "ar" ? ar : en}
                className={`flex flex-col items-center gap-0.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  used ? "opacity-30 line-through" : "hover:scale-105"
                }`}
                style={{ background: isA ? "rgba(59,130,246,0.18)" : "rgba(239,68,68,0.18)", color: isA ? "#bfdbfe" : "#fecaca" }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? ar : en}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <ConfettiBurst active={celebrate} />
      <div dir={dir} className="min-h-[calc(100vh-4rem)] py-6 px-4" style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 50%, #0a1628 100%)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button onClick={() => setLocation("/game/million")} className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200">
              <BackIcon className="w-4 h-4" /> {lang === "ar" ? "رجوع" : "Back"}
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold">
                {lang === "ar" ? "وضع الفريقين (المعلم يقود)" : "Two-Teams (Host-controlled)"}
              </span>
              <button
                onClick={audio.toggleMute}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/15"
                title={audio.muted ? (lang === "ar" ? "تشغيل الصوت" : "Unmute") : (lang === "ar" ? "كتم الصوت" : "Mute")}
              >
                {audio.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {audio.muted ? (lang === "ar" ? "صامت" : "Muted") : (lang === "ar" ? "موسيقى" : "Music")}
              </button>
            </div>
          </div>

          {/* Join panel */}
          <div className="rounded-2xl p-4 mb-5 flex flex-wrap items-center justify-between gap-3"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(124,58,237,0.10))", border: "1px solid rgba(245,158,11,0.25)" }}
          >
            <div className="flex flex-col">
              <span className="text-amber-200 text-xs font-bold mb-1">
                {lang === "ar" ? "للانضمام: امسح الباركود أو افتح الرابط أو أدخل الرقم" : "To join: scan QR, open link, or enter PIN"}
              </span>
            </div>
            <HostJoinBar pin={pin} joinUrl={joinUrl} variant="dark" compact />
          </div>

          {isFinished && winner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="rounded-2xl p-6 mb-5 text-center"
              style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(124,58,237,0.18))", border: "1px solid rgba(245,158,11,0.45)" }}
            >
              <motion.div
                initial={{ rotate: -20, scale: 0.6 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              >
                <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-2 drop-shadow-[0_0_18px_rgba(245,158,11,0.7)]" />
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-2">
                {lang === "ar" ? "انتهت اللعبة!" : "Game Over!"}
              </h2>
              {winner === "TIE" ? (
                <p className="text-amber-200 text-xl font-bold">
                  {lang === "ar" ? `تعادل بـ ${fmt(teamA!.score)} نقطة!` : `Tie at ${fmt(teamA!.score)} points!`}
                </p>
              ) : (
                <p className="text-amber-200 text-xl font-bold">
                  {lang === "ar"
                    ? `الفائز: ${winner === "A" ? teamA!.name : teamB!.name} بـ ${fmt(winner === "A" ? teamA!.score : teamB!.score)} نقطة!`
                    : `Winner: ${winner === "A" ? teamA!.name : teamB!.name} with ${fmt(winner === "A" ? teamA!.score : teamB!.score)} points!`}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3 mt-4 max-w-md mx-auto">
                {(["A", "B"] as const).map(side => {
                  const t = side === "A" ? teamA! : teamB!;
                  const isWin = winner === side;
                  const isTie = winner === "TIE";
                  return (
                    <motion.div
                      key={side}
                      animate={isWin ? { scale: [1, 1.04, 1] } : {}}
                      transition={isWin ? { duration: 1.6, repeat: Infinity } : {}}
                      className="rounded-xl p-3 relative"
                      style={{
                        background: side === "A" ? "rgba(59,130,246,0.18)" : "rgba(239,68,68,0.18)",
                        border: isWin ? "2px solid rgba(245,158,11,0.9)" : isTie ? "2px solid rgba(245,158,11,0.45)" : "2px solid transparent",
                        boxShadow: isWin ? "0 0 22px rgba(245,158,11,0.55)" : "none",
                        opacity: !isWin && !isTie ? 0.65 : 1,
                      }}
                    >
                      {isWin && (
                        <span className="absolute -top-2 -right-2 text-2xl" aria-hidden>👑</span>
                      )}
                      <p className={`${side === "A" ? "text-blue-300" : "text-red-300"} text-xs font-bold`}>
                        {side === "A" ? "🔵" : "🔴"} {t.name}
                      </p>
                      <p className="text-amber-300 font-black text-3xl">{fmt(t.score)}</p>
                      {isWin && (
                        <p className="text-amber-200 text-[11px] font-bold mt-1 uppercase tracking-wider">
                          {lang === "ar" ? "الفائز" : "Winner"}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setLocation("/game/million")}
                  className="px-5 py-2.5 rounded-xl text-white font-black text-sm flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg,#9333ea,#7c3aed)", boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}
                >
                  <Trophy className="w-4 h-4" />
                  {lang === "ar" ? "بدء لعبة جديدة" : "Start a new game"}
                </button>
              </div>
            </motion.div>
          )}

          {!isFinished && <div className="grid lg:grid-cols-[2fr_1fr] gap-5">
            {/* Question + control */}
            <div className="rounded-2xl p-6 space-y-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex items-center justify-between text-blue-300 text-sm font-bold">
                <span>
                  {lang === "ar" ? `سؤال ${currentIdx + 1} من ${totalQ}` : `Question ${currentIdx + 1} / ${totalQ}`}
                </span>
                <span className="text-amber-300 text-base">{fmt(defaultPrize)}</span>
              </div>

              {currentQuestion ? (
                <>
                  <div className="rounded-xl p-5" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <p className="text-white text-xl font-bold leading-relaxed">{currentQuestion.text}</p>
                    {currentQuestion.imageUrl && (<img src={currentQuestion.imageUrl} alt="" className="mt-3 max-h-64 rounded-lg" />)}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(["A", "B", "C", "D"] as const).map(k => {
                      const opt = currentQuestion[`option${k}` as "optionA"];
                      const isCorrect = reveal && k === correctKey;
                      return (
                        <div key={k} className={`rounded-xl p-3 text-white text-base font-bold border-2 ${isCorrect ? "bg-green-500/20 border-green-400" : "bg-white/5 border-white/15"}`}>
                          <span className="text-amber-400 ml-2">{k}.</span> {opt}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => emitAction({ action: "reveal" })} className="px-4 py-2 rounded-xl text-white text-sm font-bold flex items-center gap-1.5" style={{ background: "rgba(34,197,94,0.3)" }}>
                      <Eye className="w-4 h-4" /> {lang === "ar" ? "كشف الإجابة" : "Reveal answer"}
                    </button>
                    <button onClick={() => emitAction({ action: "transfer" })} className="px-4 py-2 rounded-xl text-white text-sm font-bold flex items-center gap-1.5" style={{ background: "rgba(245,158,11,0.3)" }}>
                      <ArrowLeftRight className="w-4 h-4" /> {lang === "ar" ? "تحويل للخصم" : "Transfer to opponent"}
                    </button>
                    <div className="flex-1" />
                    <button onClick={handleNext} disabled={awarding} className="px-5 py-2.5 rounded-xl text-white font-black text-sm flex items-center gap-2 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#9333ea,#7c3aed)" }}>
                      {awarding ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                      {isLast ? (lang === "ar" ? "إنهاء" : "Finish") : (lang === "ar" ? "السؤال التالي" : "Next question")}
                    </button>
                  </div>
                  {isTransferred && (
                    <p className="text-amber-300 text-sm">
                      {lang === "ar" ? "↪ تم تحويل هذا السؤال للفريق المنافس." : "↪ This question was transferred to the opposing team."}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-blue-300 text-center py-10">{lang === "ar" ? "لا توجد أسئلة" : "No questions"}</p>
              )}
            </div>

            {/* Right panel: tabs */}
            <div className="space-y-3">
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
                <button
                  onClick={() => setPanelTab("teams")}
                  className="flex-1 py-2 text-sm font-bold transition-colors"
                  style={{
                    background: panelTab === "teams" ? "rgba(217,165,33,0.25)" : "rgba(255,255,255,0.04)",
                    color: panelTab === "teams" ? "#fde68a" : "#cbd5e1",
                  }}
                >
                  {lang === "ar" ? `الفريقان` : "Teams"}
                </button>
                <button
                  onClick={() => setPanelTab("settings")}
                  className="flex-1 py-2 text-sm font-bold transition-colors"
                  style={{
                    background: panelTab === "settings" ? "rgba(217,165,33,0.25)" : "rgba(255,255,255,0.04)",
                    color: panelTab === "settings" ? "#fde68a" : "#cbd5e1",
                  }}
                >
                  {lang === "ar" ? "السؤال والإعدادات" : "Question & settings"}
                </button>
              </div>

              {panelTab === "teams" ? (
                <>
                  {renderTeamCard("A", teamA)}
                  {renderTeamCard("B", teamB)}
                </>
              ) : (
                <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-blue-300 font-bold mb-1">
                      {lang === "ar" ? "هذا السؤال يساوي" : "This question is worth"}
                    </p>
                    <p className="text-amber-300 font-black text-3xl">{fmt(defaultPrize)} <span className="text-base font-bold opacity-70">{lang === "ar" ? "نقطة" : "pts"}</span></p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg p-2" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <p className="text-blue-300 font-bold mb-0.5">{lang === "ar" ? "نظام النقاط" : "Scheme"}</p>
                      <p className="text-white font-bold">{schemeLabel(pointsScheme, lang as "ar" | "en")}</p>
                    </div>
                    <div className="rounded-lg p-2" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <p className="text-blue-300 font-bold mb-0.5">{lang === "ar" ? "عدد الأسئلة" : "Questions"}</p>
                      <p className="text-white font-bold">{questionCount}</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-blue-200 leading-relaxed bg-black/20 rounded-lg p-2 border border-white/10">
                    {describeScheme(pointsScheme, basePoints, questionCount || totalQ || 15, lang as "ar" | "en")}
                  </p>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-blue-300 font-bold mb-2">
                      {lang === "ar" ? "قائمة الأسئلة" : "All questions"}
                    </p>
                    <div className="max-h-[420px] overflow-y-auto pr-1 space-y-1">
                      {questions.map((q, i) => {
                        const pts = getQuestionPoints(pointsScheme, basePoints, i, questionCount || totalQ || 15);
                        const isCur = i === currentIdx;
                        const isPast = i < currentIdx;
                        return (
                          <div
                            key={q.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
                            style={{
                              background: isCur ? "rgba(217,165,33,0.2)" : isPast ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
                              border: isCur ? "1px solid rgba(217,165,33,0.5)" : "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            <span className={`w-6 text-center font-bold ${isCur ? "text-amber-300" : "text-blue-300"}`}>{i + 1}</span>
                            <span className="flex-1 text-white truncate">{q.text}</span>
                            <span className="text-amber-300 font-bold shrink-0">{fmt(pts)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>}
        </div>
      </div>
    </Layout>
  );
}
