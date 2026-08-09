// ─────────────────────────────────────────────────────────────────────────────
// وميض الصف — split-screen classroom flash quiz.
// ─────────────────────────────────────────────────────────────────────────────
import {
  useEffect, useReducer, useRef, useState, useCallback, useMemo,
} from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import {
  Volume2, VolumeX, X as XIcon, Zap, Flame,
  CheckCircle, XCircle, Snowflake, School, Trophy, Crown,
  Gift, EyeOff, Eye, Clock3, Timer, Pause, Play, LogOut,
} from "lucide-react";
import {
  playCorrectSound, playWrongSound, playVictoryFanfare,
  playGiftSound, playStealSound, playGameStartSound,
  startBackgroundBeat, stopBackgroundBeat,
  playTickSound, toggleMute, getIsMuted,
} from "@/lib/game-sounds";
import {
  wameethClassReducer, createWameethClassState,
  currentWameethQuestion,
  type TeamId, type GiftType, type GiftChoiceType,
  type WameethTeamState, type WameethClassQuestion,
  type WameethClassState,
} from "@/lib/wameeth-class-engine";

// ─── Session-storage key ──────────────────────────────────────────────────────
export const WAMEETH_CLASS_SETUP_KEY = "wameeth-class-setup";

interface WameethClassSetup {
  questions: WameethClassQuestion[];
  duration: number;
  title?: string;
}

// ─── Game settings ────────────────────────────────────────────────────────────
interface ClassSettings {
  duration: number;       // seconds per question
  giftsEnabled: boolean;  // award gift boxes
  showCorrect: boolean;   // highlight correct answer after wrong guess
  freezeDuration: number; // seconds opponent is frozen (timer cap)
}

const DURATION_OPTIONS       = [10, 15, 20, 30, 45];
const FREEZE_DURATION_OPTIONS = [5, 10, 15, 20];

const CLASS_SETTINGS_KEY = "wameeth_class_settings";

function readSetup(): WameethClassSetup | null {
  try {
    const raw = sessionStorage.getItem(WAMEETH_CLASS_SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WameethClassSetup>;
    if (!Array.isArray(parsed.questions) || parsed.questions.length < 2) return null;
    return {
      questions: parsed.questions,
      duration: parsed.duration || 20,
      title: typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim() : undefined,
    };
  } catch { return null; }
}

// ─── Answer-button colours ────────────────────────────────────────────────────
const OPTION_STYLES: Array<{ bg: string; shadow: string; badge: string }> = [
  { bg: "linear-gradient(150deg,#7A0A0A,#B01414)",  shadow: "0 4px 18px rgba(176,20,20,0.45)",   badge: "linear-gradient(135deg,#9B1212,#C71A1A)" },
  { bg: "linear-gradient(150deg,#08386E,#1260A8)",  shadow: "0 4px 18px rgba(18,96,168,0.45)",   badge: "linear-gradient(135deg,#0A4A8E,#1A72C8)" },
  { bg: "linear-gradient(150deg,#B8860B,#DAA520)",  shadow: "0 4px 18px rgba(218,165,32,0.45)",  badge: "linear-gradient(135deg,#C89010,#EAB830)" },
  { bg: "linear-gradient(150deg,#5A1A8A,#8B35C8)",  shadow: "0 4px 18px rgba(139,53,200,0.45)",  badge: "linear-gradient(135deg,#6E20A0,#A040D8)" },
];
const AR_LETTERS = ["أ", "ب", "ج", "د"];
const EN_LETTERS = ["A", "B", "C", "D"];

// ─── Seeded shuffle (Fisher-Yates + LCG) ─────────────────────────────────────
// Returns: { options: shuffled text[], map: shuffledIdx → originalIdx }
// Seed is stable per (team × question) so options don't jump mid-question.
function seededShuffle(opts: string[], seed: number): { options: string[]; map: number[] } {
  const items = [...opts];
  const map   = opts.map((_, i) => i);
  let s = seed | 0;
  const rand = () => {
    s = Math.imul(s, 1664525) + 1013904223;
    return (s >>> 0) / 0x1_0000_0000;
  };
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
    [map[i],   map[j]]   = [map[j],   map[i]];
  }
  return { options: items, map };
}

// ─── Gift choice metadata ─────────────────────────────────────────────────────
const CHOICE_INFO: Record<GiftChoiceType, {
  icon: string; ar: string; en: string;
  resultAr: (n?: number) => string; resultEn: (n?: number) => string;
  bg: string; border: string; glow: string;
}> = {
  freeze: {
    icon: "🥶",
    ar: "تجميد الخصم", en: "Freeze Opponent",
    resultAr: () => "الخصم مُجمَّد! 🥶",    resultEn: () => "Opponent frozen! 🥶",
    bg: "linear-gradient(150deg,#0c2d6e,#1a5cbf)",
    border: "#3b82f6",  glow: "rgba(59,130,246,0.4)",
  },
  steal: {
    icon: "💰",
    ar: "سرقة نقاط", en: "Steal Points",
    resultAr: (n) => `سرقت ${n ?? 300} نقطة! 💰`, resultEn: (n) => `Stole ${n ?? 300} pts! 💰`,
    bg: "linear-gradient(150deg,#7c2d12,#c2410c)",
    border: "#f97316",  glow: "rgba(249,115,22,0.4)",
  },
  bonus: {
    icon: "✨",
    ar: "نقاط مجانية", en: "Bonus Points",
    resultAr: (n) => `+${n ?? 0} نقطة! ✨`,     resultEn: (n) => `+${n ?? 0} pts! ✨`,
    bg: "linear-gradient(150deg,#14532d,#16a34a)",
    border: "#4ade80",  glow: "rgba(74,222,128,0.4)",
  },
  shield: {
    icon: "🛡️",
    ar: "درع واقٍ", en: "Shield",
    resultAr: () => "الدرع مُفعَّل! 🛡️",         resultEn: () => "Shield activated! 🛡️",
    bg: "linear-gradient(150deg,#713f12,#ca8a04)",
    border: "#fbbf24",  glow: "rgba(251,191,36,0.4)",
  },
};

// ─── Confetti + Fireworks ──────────────────────────────────────────────────────
function Fireworks() {
  const colors      = ["#fbbf24","#f59e0b","#fcd34d","#fde68a","#d946ef","#a855f7"];
  const burstColors = ["#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899"];
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div key={`c${i}`}
          initial={{ y: -20, x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 500), opacity: 1 }}
          animate={{ y: (typeof window !== "undefined" ? window.innerHeight : 800) + 20, opacity: 0, rotate: Math.random() * 720 }}
          transition={{ duration: 3 + Math.random() * 2, delay: Math.random() * 2, repeat: Infinity }}
          className="absolute w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[i % 6] }} />
      ))}
      {Array.from({ length: 6 }).map((_, bi) => {
        const cx = 15 + Math.random() * 70, cy = 10 + Math.random() * 50;
        return Array.from({ length: 12 }).map((_, j) => {
          const angle = (j / 12) * Math.PI * 2, dist = 60 + Math.random() * 80;
          return (
            <motion.div key={`fw-${bi}-${j}`}
              initial={{ x: `${cx}%`, y: `${cy}%`, scale: 0, opacity: 1 }}
              animate={{ x: `calc(${cx}% + ${Math.cos(angle)*dist}px)`, y: `calc(${cy}% + ${Math.sin(angle)*dist}px)`, scale: [0,1.5,0], opacity: [0,1,0] }}
              transition={{ duration: 1.2, delay: bi*0.5+0.5, repeat: Infinity, repeatDelay: 3+Math.random()*2 }}
              className="absolute w-2 h-2 rounded-full"
              style={{ backgroundColor: burstColors[(bi+j)%burstColors.length], boxShadow: `0 0 6px ${burstColors[(bi+j)%burstColors.length]}` }} />
          );
        });
      })}
    </div>
  );
}

// ─── End screen ───────────────────────────────────────────────────────────────
function FinishedScreen({ state, blueName, redName, ar, onRematch, onExit }: {
  state: WameethClassState; blueName: string; redName: string; ar: boolean;
  onRematch: (swap: boolean) => void; onExit: () => void;
}) {
  const { winner, teams } = state;
  const isDraw = winner === "draw";
  const accentOf = (id: TeamId) => id === "blue" ? "#60a5fa" : "#f87171";
  const ordered: { id: TeamId; name: string }[] = winner === "blue"
    ? [{ id: "blue", name: blueName }, { id: "red", name: redName }]
    : winner === "red"
    ? [{ id: "red", name: redName }, { id: "blue", name: blueName }]
    : [{ id: "blue", name: blueName }, { id: "red", name: redName }];
  const first = ordered[0], second = ordered[1];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-8"
      style={{ background: "linear-gradient(160deg,#0D2118 0%,#1A3A28 50%,#0F2A1C 100%)" }}
      dir={ar ? "rtl" : "ltr"}>
      <Fireworks />
      <div className="max-w-2xl mx-auto relative z-20">
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 mt-4">
          <motion.div animate={{ rotate: [0,-5,5,0], scale: [1,1.1,1] }} transition={{ repeat: Infinity, duration: 2 }}>
            <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
          </motion.div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-2">{ar ? "انتهت اللعبة" : "Game Over"}</h1>
          {!isDraw
            ? <p className="text-amber-300 text-xl font-bold">{ar ? "الفائز:" : "Winner:"} <span className="text-white font-black">{first.name} 🏆</span></p>
            : <p className="text-amber-300 text-xl font-bold">🤝 {ar ? "تعادل!" : "Draw!"}</p>}
        </motion.div>
        <div className="flex items-end justify-center gap-6 mb-10">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-col items-center">
            <Crown className="w-8 h-8 text-yellow-400 mb-1 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]" />
            <div className="w-28 rounded-t-2xl flex flex-col items-center justify-end pb-4 pt-6"
              style={{ height: 160, background: `linear-gradient(160deg,${accentOf(first.id)}33,${accentOf(first.id)}11)`, border: `2px solid ${accentOf(first.id)}88`, boxShadow: `0 0 30px ${accentOf(first.id)}44` }}>
              <span className="text-3xl font-black" style={{ color: accentOf(first.id) }}>{teams[first.id].score.toLocaleString()}</span>
              <span className="text-white/80 text-xs font-bold mt-1 px-1 text-center leading-tight">{first.name}</span>
              <span className="text-white/40 text-[10px] mt-0.5">{teams[first.id].correctCount}/{state.questions.length} {ar?"صح":"✓"}</span>
            </div>
            <div className="w-28 h-8 rounded-b-lg flex items-center justify-center font-black text-lg" style={{ background: accentOf(first.id), color: "#fff" }}>1</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col items-center">
            <div className="w-6 h-6 mb-1" />
            <div className="w-24 rounded-t-2xl flex flex-col items-center justify-end pb-4 pt-6"
              style={{ height: 120, background: `linear-gradient(160deg,${accentOf(second.id)}22,${accentOf(second.id)}0a)`, border: `1.5px solid ${accentOf(second.id)}55` }}>
              <span className="text-2xl font-black" style={{ color: accentOf(second.id) }}>{teams[second.id].score.toLocaleString()}</span>
              <span className="text-white/70 text-xs font-bold mt-1 px-1 text-center leading-tight">{second.name}</span>
              <span className="text-white/40 text-[10px] mt-0.5">{teams[second.id].correctCount}/{state.questions.length} {ar?"صح":"✓"}</span>
            </div>
            <div className="w-24 h-7 rounded-b-lg flex items-center justify-center font-black text-base" style={{ background: accentOf(second.id)+"bb", color: "#fff" }}>2</div>
          </motion.div>
        </div>
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.7 }}
          className="rounded-2xl p-5 mb-6"
          style={{ background:"rgba(255,255,255,0.05)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.1)" }}>
          {(["blue","red"] as TeamId[]).map((id) => {
            const name = id==="blue"?blueName:redName; const t=teams[id]; const accent=accentOf(id); const isW=winner===id;
            return (
              <div key={id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-2 last:mb-0"
                style={{ background:isW?`${accent}18`:"rgba(255,255,255,0.04)", border:`1px solid ${isW?accent+"44":"rgba(255,255,255,0.08)"}` }}>
                <div className="flex items-center gap-2">
                  {isW && <Crown className="w-4 h-4 text-yellow-400 shrink-0" />}
                  <span className="font-bold text-sm" style={{ color:accent }}>{name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-white/50">{t.correctCount}/{state.questions.length} {ar?"إجابة صحيحة":"correct"}</span>
                  <span className="font-black text-white flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-yellow-300"/>{t.score.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </motion.div>
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.9 }} className="flex gap-3 flex-wrap justify-center">
          <button onClick={()=>onRematch(true)} className="px-6 py-2.5 rounded-xl font-extrabold text-sm text-white border border-white/20 hover:border-white/40 transition-all" style={{ background:"rgba(255,255,255,0.08)" }}>
            ↔ {ar?"جولة أخرى — تبادل الجهتين":"Rematch — swap sides"}
          </button>
          <button onClick={()=>onRematch(false)} className="px-6 py-2.5 rounded-xl font-extrabold text-sm text-white border border-white/20 hover:border-white/40 transition-all" style={{ background:"rgba(255,255,255,0.08)" }}>
            🔁 {ar?"جولة أخرى":"Rematch"}
          </button>
          <button onClick={onExit} className="px-6 py-2.5 rounded-xl font-extrabold text-sm" style={{ background:"linear-gradient(135deg,#f4c95d,#d4a63a)", color:"#1a0e00" }}>
            {ar?"خروج":"Exit"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Countdown overlay ────────────────────────────────────────────────────────
function CountdownOverlay({ count, ar }: { count: number; ar: boolean }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background:"radial-gradient(ellipse at 50% 50%,rgba(10,58,34,0.92) 0%,rgba(2,10,5,0.97) 100%)" }}>
      <motion.div key={count} initial={{ scale:0.4, opacity:0 }} animate={{ scale:1.05, opacity:1 }} exit={{ scale:1.6, opacity:0 }}
        transition={{ duration:0.35, ease:"backOut" }} className="font-black text-yellow-300"
        style={{ fontSize:"clamp(6rem,22vw,14rem)", textShadow:"0 0 80px rgba(244,201,93,0.8)" }}>
        {count}
      </motion.div>
      <p className="text-white/60 font-bold mt-6 text-xl">{ar?"استعدوا!":"Get ready!"}</p>
    </motion.div>
  );
}

// ─── Small toggle pill ────────────────────────────────────────────────────────
function TogglePill({ on, onChange, labelOn, labelOff, icon }: {
  on: boolean; onChange: (v: boolean) => void;
  labelOn: string; labelOff: string; icon: React.ReactNode;
}) {
  return (
    <button onClick={()=>onChange(!on)}
      className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all"
      style={{
        background: on ? "rgba(244,201,93,0.18)" : "rgba(255,255,255,0.06)",
        border: `1.5px solid ${on ? "rgba(244,201,93,0.55)" : "rgba(255,255,255,0.12)"}`,
        color: on ? "#f4c95d" : "rgba(255,255,255,0.45)",
      }}>
      {icon}{on ? labelOn : labelOff}
    </button>
  );
}

// ─── Idle overlay (with full settings panel) ───────────────────────────────────
function IdleOverlay({ setup, blueName, redName, blueOnRight, ar, settings, onSettings, onStart, onBlueName, onRedName }: {
  setup: WameethClassSetup; blueName: string; redName: string; blueOnRight: boolean; ar: boolean;
  settings: ClassSettings; onSettings: (s: ClassSettings) => void;
  onStart: () => void; onBlueName: (n: string) => void; onRedName: (n: string) => void;
}) {
  const leftColor  = blueOnRight ? "#f87171" : "#60a5fa";
  const rightColor = blueOnRight ? "#60a5fa" : "#f87171";
  const leftName   = blueOnRight ? redName   : blueName;
  const rightName  = blueOnRight ? blueName  : redName;
  const leftSet    = blueOnRight ? onRedName : onBlueName;
  const rightSet   = blueOnRight ? onBlueName : onRedName;

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-5 py-8 overflow-y-auto"
      style={{ background:[
        "radial-gradient(ellipse 80% 50% at 50% 0%,rgba(244,201,93,0.13) 0%,transparent 65%)",
        "linear-gradient(160deg,#060e0a 0%,#0d2118 50%,#060e0a 100%)"
      ].join(",") }}>

      {/* Logo */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2.5">
          <School className="w-8 h-8 text-yellow-300"/>
          <span className="text-yellow-300 font-black text-3xl" style={{ letterSpacing:"0.06em" }}>وميض الصف</span>
        </div>
        {setup.title && <span className="text-white/50 text-sm font-bold">{setup.title}</span>}
      </div>

      {/* Team names */}
      <div className="flex gap-4 w-full max-w-md" style={{ direction: ar ? "rtl" : "ltr" }}>
        {[
          { label: ar?"الفريق الأيسر":"Left team",   color: leftColor,  val: leftName,  set: leftSet  },
          { label: ar?"الفريق الأيمن":"Right team",  color: rightColor, val: rightName, set: rightSet },
        ].map(({ label, color, val, set }) => (
          <div key={label} className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-bold" style={{ color }}>{label}</label>
            <input value={val} onChange={(e)=>set(e.target.value)}
              className="rounded-xl px-3 py-2.5 font-bold text-sm text-white focus:outline-none transition-all"
              style={{ background:"rgba(255,255,255,0.08)", border:`1.5px solid ${color}40` }}/>
          </div>
        ))}
      </div>

      {/* Settings panel */}
      <div className="w-full max-w-md rounded-2xl p-4 flex flex-col gap-4"
        style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)" }}
        dir={ar?"rtl":"ltr"}>

        <p className="text-white/50 text-xs font-black uppercase tracking-widest">
          {ar?"إعدادات اللعبة":"Game settings"}
        </p>

        {/* Question duration */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-white/70 text-xs font-bold">
            <Clock3 className="w-3.5 h-3.5"/>
            {ar?"مدة السؤال":"Duration per question"}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {DURATION_OPTIONS.map((d)=>(
              <button key={d} onClick={()=>onSettings({...settings,duration:d})}
                className="px-3 py-1.5 rounded-lg text-sm font-black transition-all"
                style={{
                  background: settings.duration===d ? "linear-gradient(135deg,#f4c95d,#d4a63a)" : "rgba(255,255,255,0.07)",
                  color: settings.duration===d ? "#1a0e00" : "rgba(255,255,255,0.50)",
                  border: `1.5px solid ${settings.duration===d ? "#d4a63a" : "rgba(255,255,255,0.10)"}`,
                }}>
                {d}{ar?"ث":"s"}
              </button>
            ))}
          </div>
        </div>

        {/* Gifts toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-white/70 text-xs font-bold">
            <Gift className="w-3.5 h-3.5"/>
            {ar?"صناديق الهدايا":"Gift boxes"}
          </div>
          <TogglePill on={settings.giftsEnabled} onChange={(v)=>onSettings({...settings,giftsEnabled:v})}
            labelOn={ar?"مفعّلة":"On"} labelOff={ar?"مُعطَّلة":"Off"}
            icon={<span className="text-base leading-none">🎁</span>}/>
        </div>

        {/* Freeze duration — only shown when gifts are on */}
        {settings.giftsEnabled && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-white/70 text-xs font-bold">
              <Timer className="w-3.5 h-3.5"/>
              {ar?"مدة التجميد":"Freeze duration"}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FREEZE_DURATION_OPTIONS.map((d)=>(
                <button key={d} onClick={()=>onSettings({...settings,freezeDuration:d})}
                  className="px-3 py-1.5 rounded-lg text-sm font-black transition-all"
                  style={{
                    background: settings.freezeDuration===d ? "linear-gradient(135deg,#3b82f6,#1d4ed8)" : "rgba(255,255,255,0.07)",
                    color: settings.freezeDuration===d ? "#fff" : "rgba(255,255,255,0.50)",
                    border: `1.5px solid ${settings.freezeDuration===d ? "#3b82f6" : "rgba(255,255,255,0.10)"}`,
                  }}>
                  🥶 {d}{ar?"ث":"s"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Show correct answer toggle */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-white/70 text-xs font-bold">
              {settings.showCorrect ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5"/>}
              {ar?"إظهار الإجابة الصحيحة":"Show correct answer"}
            </div>
            <p className="text-white/35 text-[10px] leading-snug" style={{ maxWidth:200 }}>
              {settings.showCorrect
                ? (ar?"تظهر للفريق فور الخطأ":"Revealed immediately after wrong guess")
                : (ar?"لا تُكشف الإجابة — تمنع الغش":"Hidden — prevents the other team from copying")}
            </p>
          </div>
          <TogglePill on={settings.showCorrect} onChange={(v)=>onSettings({...settings,showCorrect:v})}
            labelOn={ar?"ظاهرة":"Shown"} labelOff={ar?"مخفية":"Hidden"}
            icon={settings.showCorrect ? <Eye className="w-3.5 h-3.5"/> : <EyeOff className="w-3.5 h-3.5"/>}/>
        </div>
      </div>

      {/* Info chips */}
      <div className="flex gap-2 flex-wrap justify-center">
        {[
          `⚡ ${setup.questions.length} ${ar?"سؤال":"questions"}`,
          `⏱ ${settings.duration}${ar?"ث":"s"}/${ar?"سؤال":"q"}`,
          settings.giftsEnabled ? `🎁 ${ar?"هدايا مُفعَّلة":"Gifts on"} · 🥶${settings.freezeDuration}${ar?"ث":"s"}` : `🚫 ${ar?"بلا هدايا":"No gifts"}`,
          settings.showCorrect  ? `👁 ${ar?"الإجابة ظاهرة":"Answer shown"}` : `🙈 ${ar?"الإجابة مخفية":"Answer hidden"}`,
        ].map((t)=>(
          <span key={t} className="bg-white/6 border border-white/12 text-white/55 px-3 py-1 rounded-full text-xs font-bold">{t}</span>
        ))}
      </div>

      <motion.button whileTap={{ scale:0.96 }} whileHover={{ scale:1.02 }} onClick={onStart}
        className="px-12 py-4 rounded-2xl font-black text-xl"
        style={{ background:"linear-gradient(135deg,#f4c95d 0%,#d4a63a 100%)", color:"#1a0e00", boxShadow:"0 8px 32px rgba(244,201,93,0.45)" }}>
        {ar?"ابدأ اللعبة ⚡":"Start Game ⚡"}
      </motion.button>
    </motion.div>
  );
}

// ─── Gift choice picker (replaces prize picker) ────────────────────────────────
function GiftChoicePicker({ t, ar, team, onPick }: {
  t: WameethTeamState; ar: boolean; team: TeamId;
  onPick: (idx: number) => void;
}) {
  const mp = t.mysteryPicking;
  if (!mp) return null;
  const isBlue    = team === "blue";
  const panelAccent = isBlue ? "#60a5fa" : "#f87171";

  return (
    <motion.div
      initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.9 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-2xl p-4"
      style={{ background:"rgba(3,8,5,0.95)", backdropFilter:"blur(10px)", border:`1.5px solid ${panelAccent}55` }}>

      {/* Header */}
      <div className="text-center mb-1">
        <p className="text-3xl mb-1">🎁</p>
        <p className="font-black text-white text-base leading-tight" dir={ar?"rtl":"ltr"}>
          {mp.revealed === null
            ? (ar?"اختر مكافأتك!":"Choose your reward!")
            : (ar?"تمّ الاختيار!":"Done!")}
        </p>
      </div>

      {/* Choice grid — 2×2 */}
      <div className="grid grid-cols-2 gap-2 w-full">
        {mp.choices.map((choice, idx) => {
          const info      = CHOICE_INFO[choice];
          const isRevealed = mp.revealed !== null;
          const isChosen   = mp.revealed === idx;
          return (
            <motion.button key={idx}
              whileTap={{ scale: 0.93 }}
              whileHover={!isRevealed ? { scale: 1.04 } : {}}
              onClick={() => !isRevealed && onPick(idx)}
              disabled={isRevealed}
              className="relative rounded-xl flex flex-col items-center justify-center gap-1.5 py-3 px-2 font-black transition-all"
              style={{
                background: isChosen
                  ? info.bg
                  : isRevealed ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)",
                border: `1.5px solid ${isChosen ? info.border : isRevealed ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.18)"}`,
                boxShadow: isChosen ? `0 0 20px ${info.glow}` : "none",
                opacity: isRevealed && !isChosen ? 0.28 : 1,
                cursor: isRevealed ? "default" : "pointer",
              }}>
              <span className="text-2xl leading-none">{info.icon}</span>
              <span className="text-white text-[11px] font-black text-center leading-tight" dir={ar?"rtl":"ltr"}>
                {ar ? info.ar : info.en}
              </span>
              {isChosen && (
                <motion.span initial={{ scale:0 }} animate={{ scale:1 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-400 flex items-center justify-center text-[10px] text-green-900 font-black">
                  ✓
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Result message */}
      <AnimatePresence>
        {mp.revealed !== null && (
          <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            className="text-center mt-0.5" dir={ar?"rtl":"ltr"}>
            <p className="font-black text-base" style={{ color: CHOICE_INFO[mp.choices[mp.revealed]].border }}>
              {ar
                ? CHOICE_INFO[mp.choices[mp.revealed]].resultAr(mp.bonusAmount)
                : CHOICE_INFO[mp.choices[mp.revealed]].resultEn(mp.bonusAmount)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Gift boxes bar (shown directly below answers) ────────────────────────────
function GiftBoxBar({ gifts, shield, frozen, ar, onUse }: {
  gifts: GiftType[]; shield: boolean; frozen: boolean; ar: boolean;
  onUse: (g: GiftType) => void;
}) {
  if (gifts.length === 0 && !shield) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-2 pb-0.5 flex-wrap shrink-0"
      style={{ direction: ar ? "rtl" : "ltr" }}>
      {shield && (
        <motion.div animate={{ scale:[1,1.06,1] }} transition={{ repeat:Infinity, duration:2 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black"
          style={{ background:"rgba(234,179,8,0.20)", border:"1px solid rgba(234,179,8,0.5)", color:"#fde047" }}>
          🛡️ {ar?"محمي":"Shield"}
        </motion.div>
      )}
      {gifts.map((_, i) => (
        <motion.button key={i}
          whileTap={{ scale:0.90 }} whileHover={{ scale:1.08 }}
          disabled={frozen}
          onClick={() => onUse("mystery")}
          className="relative flex items-center gap-1.5 px-4 py-2 rounded-full font-black text-white transition-all disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg,rgba(168,85,247,0.35),rgba(139,53,200,0.45))",
            border: "1.5px solid rgba(168,85,247,0.65)",
            boxShadow: "0 0 14px rgba(168,85,247,0.3)",
          }}>
          <span className="text-lg leading-none">🎁</span>
          <span className="text-sm font-black">{ar?"افتح الصندوق":"Open Box"}</span>
          {/* Badge with count if > 1 */}
          {gifts.length > 1 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-purple-400 text-purple-900 flex items-center justify-center text-[10px] font-black">
              {gifts.length - i}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}

// ─── Timer ring SVG ───────────────────────────────────────────────────────────
function TimerRing({ pct, urgent, value }: { pct: number; urgent: boolean; value: number }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = circ * Math.max(0, pct / 100);
  return (
    <div className="relative flex items-center justify-center" style={{ width:72, height:72 }}>
      <svg className="absolute inset-0 -rotate-90" width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="5" stroke="rgba(255,255,255,0.10)"/>
        <motion.circle cx="36" cy="36" r={r} fill="none" strokeWidth="5"
          stroke={urgent ? "#ef4444" : "#f4c95d"}
          strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration:0.4, ease:"linear" }}
          style={{ filter: urgent ? "drop-shadow(0 0 6px rgba(239,68,68,0.8))" : "drop-shadow(0 0 5px rgba(244,201,93,0.6))" }}
        />
      </svg>
      <motion.span key={value}
        initial={{ scale: urgent ? 1.3 : 1 }} animate={{ scale:1 }} transition={{ duration:0.2 }}
        className="relative font-mono font-black select-none"
        style={{
          fontSize: value >= 10 ? "1.5rem" : "1.75rem",
          color: urgent ? "#fca5a5" : "#ffffff",
          textShadow: urgent ? "0 0 12px rgba(239,68,68,0.7)" : "none",
        }}>
        {Math.ceil(Math.max(0, value))}
      </motion.span>
    </div>
  );
}

// ─── Single team panel ────────────────────────────────────────────────────────
function TeamPanel({
  team, name, t, question, qTotal, duration, ar,
  showCorrect, giftsEnabled, onAnswer, onUseGift, onPickMystery,
}: {
  team: TeamId; name: string; t: WameethTeamState;
  question: WameethClassQuestion | null; qTotal: number; duration: number; ar: boolean;
  showCorrect: boolean; giftsEnabled: boolean;
  onAnswer: (idx: number) => void;
  onUseGift: (g: GiftType) => void;
  onPickMystery: (idx: number) => void;
}) {
  const letters    = ar ? AR_LETTERS : EN_LETTERS;
  const isBlue     = team === "blue";
  const accent     = isBlue ? "#60a5fa" : "#f87171";
  const accentRgb  = isBlue ? "59,130,246" : "239,68,68";

  const timerPct   = Math.max(0, (t.timeLeft / duration) * 100);
  const isUrgent   = t.timeLeft <= 5 && t.phase === "question";
  const inFeedback = t.phase === "feedback";
  const exhausted  = t.phase === "exhausted";
  const frozen     = t.frozen && t.phase === "question";
  const picking    = !!t.mysteryPicking;

  // Shuffle options once per (team × question) — different for each team and each question.
  // Stays stable within the same question so options don't jump while the player reads.
  const { options: shuffledOpts, map: shuffleMap } = useMemo(() => {
    if (!question) return { options: [] as string[], map: [] as number[] };
    // Build a seed that's different per team and per question index.
    const teamBit = team === "blue" ? 0x4e3a : 0x7c1f;
    const seed    = (t.qIndex * 0x9e3779b9 ^ teamBit) | 0;
    return seededShuffle(question.options, seed);
  }, [question, team, t.qIndex]);

  const popupKey = `${team}-${t.correctCount}-${t.lastGain}`;

  return (
    <div className="relative flex flex-col flex-1 min-w-0 min-h-0 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(180deg,#091812 0%,#0f2418 55%,#091812 100%)",
        border: `1.5px solid rgba(${accentRgb},0.48)`,
        boxShadow: `0 0 32px rgba(${accentRgb},0.14), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>

      {/* Progress bar */}
      <div className="h-1.5 w-full shrink-0" style={{ background:"rgba(255,255,255,0.08)" }}>
        <motion.div className="h-full rounded-r-full"
          animate={{ width:`${timerPct}%` }} transition={{ duration:0.4 }}
          style={{ background: isUrgent ? "#ef4444" : `rgba(${accentRgb},0.9)` }}/>
      </div>

      {/* Inner layout */}
      <div className="flex flex-col flex-1 min-h-0 px-2.5 sm:px-3 pt-2 pb-2">

        {/* ZONE A — Header */}
        <div className="flex items-start justify-between gap-1 shrink-0 mb-2"
          style={{ direction: ar ? "rtl" : "ltr" }}>
          <div className="flex flex-col min-w-0">
            <span className="font-black text-sm sm:text-base leading-tight truncate" style={{ color:accent }}>
              {name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background:"rgba(255,255,255,0.10)", color:"rgba(255,255,255,0.55)" }}>
                {Math.min(t.qIndex+1, qTotal)}/{qTotal}
              </span>
              {t.streak >= 2 && (
                <motion.span initial={{ scale:0 }} animate={{ scale:1 }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background:"rgba(234,88,12,0.25)", color:"#fb923c" }}>
                  <Flame className="w-2.5 h-2.5"/>{t.streak}×
                </motion.span>
              )}
              {t.shield && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background:"rgba(234,179,8,0.20)", color:"#fde047" }}>🛡️</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300 shrink-0"/>
            <motion.span key={t.score}
              initial={{ scale:1.25 }} animate={{ scale:1 }} transition={{ duration:0.25 }}
              className="font-black text-yellow-300 leading-none"
              style={{ fontSize:"clamp(1rem,3.5vw,1.5rem)" }}>
              {t.score.toLocaleString()}
            </motion.span>
          </div>
        </div>

        {/* ZONE B — Timer + Question + Answers + Gift bar (all grouped, no spacer between) */}
        <div className="flex flex-col shrink-0 gap-2 sm:gap-2.5">

          {/* Timer ring */}
          {!exhausted && (
            <div className="flex justify-center">
              <TimerRing pct={timerPct} urgent={isUrgent} value={t.timeLeft}/>
            </div>
          )}

          {/* Question card */}
          {!exhausted && question ? (
            <motion.div key={t.qIndex}
              initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.25 }}
              className="rounded-xl px-4 py-4 sm:py-5 text-center"
              style={{
                background:"linear-gradient(160deg,rgba(255,255,255,0.055) 0%,rgba(15,42,28,0.35) 100%)",
                backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
                border:"1.5px solid rgba(244,201,93,0.32)",
                boxShadow:"0 8px 28px rgba(0,0,0,0.30), 0 0 20px rgba(244,201,93,0.07), inset 0 1px 0 rgba(255,255,255,0.06)",
                direction: ar ? "rtl" : "ltr",
              }}>
              <h2 className="font-black text-white" style={{ fontSize:"clamp(0.85rem,2.6vw,1.2rem)", lineHeight:1.6 }}>
                {question.text}
              </h2>
              {question.imageUrl && (
                <div className="flex justify-center mt-2">
                  <img src={question.imageUrl} alt="" className="rounded-lg object-contain" style={{ maxHeight: "clamp(90px,18vh,180px)", maxWidth: "80%" }} />
                </div>
              )}
            </motion.div>
          ) : exhausted ? (
            <div className="flex items-center justify-center py-6">
              <p className="text-white/40 font-bold text-center text-sm">{ar?"انتهت الأسئلة ✓":"All done ✓"}</p>
            </div>
          ) : null}

          {/* Answer grid — 1 col on mobile, 2 col on sm+
              Options are shuffled per team × question via seededShuffle so positions
              differ between teams and between rounds. */}
          {!exhausted && question && (
            <div className="grid grid-cols-1 sm:grid-cols-2"
              style={{ gap:"clamp(0.3rem,1.1vw,0.55rem)", direction:"ltr" }}>
              {shuffledOpts.map((opt, i) => {
                const origIdx    = shuffleMap[i];           // original index in question.options
                const optStyle   = OPTION_STYLES[i] ?? OPTION_STYLES[0];
                const isSelected = t.selected === origIdx;  // engine stores original index
                const isCorrect  = origIdx === question.correct;
                const showResult = inFeedback;

                let background = optStyle.bg, boxShadow = optStyle.shadow, ring = "", dimmed = false;

                if (showResult) {
                  if (isSelected && t.correct) {
                    background = "linear-gradient(150deg,#16a34a,#22c55e)";
                    boxShadow  = "0 4px 22px rgba(34,197,94,0.55)";
                    ring       = "ring-4 ring-green-300 scale-[1.02]";
                  } else if (isSelected && !t.correct) {
                    background = "linear-gradient(150deg,#7f1d1d,#dc2626)";
                    boxShadow  = "0 4px 22px rgba(220,38,38,0.55)";
                    ring       = "ring-4 ring-red-400 opacity-80";
                  } else if (isCorrect && showCorrect) {
                    background = "linear-gradient(150deg,#16a34a,#22c55e)";
                    boxShadow  = "0 4px 22px rgba(34,197,94,0.55)";
                    ring       = "ring-[5px] ring-green-200 scale-[1.02] shadow-[0_0_18px_rgba(74,222,128,0.65)]";
                  } else { dimmed = true; }
                }

                const disabled = t.selected !== null || frozen || inFeedback || exhausted || picking;

                return (
                  <motion.button key={i}
                    initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay:i*0.04, duration:0.2 }}
                    onClick={()=>!disabled && onAnswer(origIdx)}
                    /* Arabic: badge on right; English: badge on left */
                    dir={ar?"rtl":"ltr"}
                    className={`relative rounded-xl font-black text-white
                      flex items-center gap-2.5 px-3 sm:px-3.5
                      min-h-[52px] sm:min-h-[68px]
                      transition-all duration-150 ease-out active:scale-[0.97] touch-manipulation
                      ${ring} ${dimmed?"opacity-30":""}`}
                    style={{ background, boxShadow, cursor:disabled?"default":"pointer" }}>

                    {/* Letter badge */}
                    <span className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black border-2 border-white/30 select-none"
                      style={{ background:optStyle.badge, fontSize:"clamp(0.7rem,2vw,0.9rem)", boxShadow:"0 2px 8px rgba(0,0,0,0.4)", minWidth:"2rem" }}>
                      {letters[i]}
                    </span>

                    {/* Option text */}
                    <span className="flex-1 leading-snug break-words text-start"
                      style={{ fontSize:"clamp(0.75rem,1.9vw,1rem)" }}>
                      {opt}
                    </span>

                    {/* Result icons */}
                    {showResult && isCorrect && showCorrect && (
                      <motion.div initial={{ scale:0 }} animate={{ scale:[0,1.2,1] }} className="shrink-0">
                        <CheckCircle className="w-5 h-5 text-white" strokeWidth={2.5}/>
                      </motion.div>
                    )}
                    {showResult && isSelected && !t.correct && (
                      <motion.div initial={{ scale:0, rotate:-90 }} animate={{ scale:1, rotate:0 }} className="shrink-0">
                        <XCircle className="w-5 h-5 text-white" strokeWidth={2.5}/>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* ── Gift boxes — directly below answers, always visible ── */}
          {giftsEnabled && (
            <GiftBoxBar gifts={t.gifts} shield={t.shield} frozen={frozen} ar={ar} onUse={onUseGift}/>
          )}
        </div>

        {/* Remaining space pushes nothing upward — layout is naturally top-aligned */}
        <div className="flex-1 min-h-0"/>
      </div>

      {/* Gift choice picker overlay */}
      <AnimatePresence>
        {picking && <GiftChoicePicker t={t} ar={ar} team={team} onPick={onPickMystery}/>}
      </AnimatePresence>

      {/* Feedback flash */}
      {inFeedback && (
        <motion.div key={`flash-${t.qIndex}`} initial={{ opacity:0.5 }} animate={{ opacity:0 }} transition={{ duration:0.55 }}
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: t.correct?"rgba(74,222,128,0.20)":"rgba(239,68,68,0.20)" }}/>
      )}

      {/* Freeze overlay */}
      <AnimatePresence>
        {frozen && (
          <motion.div key="freeze" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl"
            style={{ background:"rgba(10,20,50,0.82)", backdropFilter:"blur(4px)" }}>
            <motion.div animate={{ rotate:[0,15,-15,0] }} transition={{ repeat:Infinity, duration:1.8 }}>
              <Snowflake className="w-14 h-14 text-cyan-300 drop-shadow-[0_0_20px_rgba(103,232,249,0.8)]"/>
            </motion.div>
            <p className="text-cyan-200 font-black text-base">{ar?"مُجمَّد! 🥶":"Frozen! 🥶"}</p>
            <p className="text-cyan-300/60 font-bold text-sm font-mono">{Math.ceil(Math.max(0, t.timeLeft))}s</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* +N floating popup */}
      <AnimatePresence>
        {t.lastGain > 0 && (
          <motion.div key={popupKey} initial={{ opacity:1, y:0 }} animate={{ opacity:0, y:-52 }} transition={{ duration:1 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none font-black text-2xl text-yellow-300"
            style={{ textShadow:"0 2px 12px rgba(0,0,0,0.9)" }}>
            +{t.lastGain.toLocaleString()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── VS divider ───────────────────────────────────────────────────────────────
function Divider({ state }: { state: WameethClassState }) {
  const { blue, red } = state.teams;
  const blueLeads = blue.score > red.score, tied = blue.score === red.score;
  return (
    <>
      <div className="hidden sm:flex flex-col items-center justify-center gap-2 w-10 shrink-0 select-none py-2">
        <div className="flex-1 w-px" style={{ background:"linear-gradient(to bottom,transparent,rgba(244,201,93,0.35),transparent)" }}/>
        <div className="rounded-full w-9 h-9 flex items-center justify-center font-black text-xs text-yellow-300 shrink-0"
          style={{ background:"radial-gradient(circle,rgba(244,201,93,0.14) 0%,transparent 70%)", border:"1px solid rgba(244,201,93,0.30)" }}>VS</div>
        {state.status==="playing" && !tied && (
          <motion.div key={blueLeads?"b":"r"} initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="text-xs font-black" style={{ color:blueLeads?"#60a5fa":"#f87171" }}>
            {blueLeads?"◀":"▶"}
          </motion.div>
        )}
        <div className="flex-1 w-px" style={{ background:"linear-gradient(to bottom,transparent,rgba(244,201,93,0.35),transparent)" }}/>
      </div>
      <div className="sm:hidden flex items-center gap-2 px-2 shrink-0 select-none h-6">
        <div className="flex-1 h-px" style={{ background:"linear-gradient(to right,transparent,rgba(244,201,93,0.35),transparent)" }}/>
        <span className="rounded-full px-2.5 py-0.5 font-black text-[10px] text-yellow-300 shrink-0"
          style={{ background:"rgba(244,201,93,0.10)", border:"1px solid rgba(244,201,93,0.25)" }}>VS</span>
        <div className="flex-1 h-px" style={{ background:"linear-gradient(to right,transparent,rgba(244,201,93,0.35),transparent)" }}/>
      </div>
    </>
  );
}

// ─── Main game component ──────────────────────────────────────────────────────
function WameethClassGame({ setup, blueOnRight, settings, onRematch, onExit, onSettings }: {
  setup: WameethClassSetup; blueOnRight: boolean; settings: ClassSettings;
  onSettings: (s: ClassSettings) => void;
  onRematch: (swap: boolean) => void; onExit: () => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";

  const [state, dispatch] = useReducer(
    wameethClassReducer, undefined,
    () => createWameethClassState(setup.questions, settings.duration, {
      giftsEnabled:  settings.giftsEnabled,
      freezeDuration: settings.freezeDuration,
    }),
  );

  const [blueName, setBlueName] = useState(ar ? "الفريق الأزرق" : "Blue Team");
  const [redName,  setRedName]  = useState(ar ? "الفريق الأحمر" : "Red Team");
  const [muted,  setMuted]      = useState(getIsMuted);
  const [paused, setPaused]     = useState(false);

  useEffect(() => {
    if (paused) return;
    if (state.status !== "countdown" && state.status !== "playing") return;
    const h = setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => clearInterval(h);
  }, [state.status, paused]);

  useEffect(() => {
    if (state.status === "playing" && !paused) { startBackgroundBeat(); }
    else                                        { stopBackgroundBeat();  }
    return () => { stopBackgroundBeat(); };
  }, [state.status, paused]);

  const prevStatus = useRef(state.status);
  useEffect(() => {
    const prev = prevStatus.current; prevStatus.current = state.status;
    if (prev === "countdown" && state.status === "playing") playGameStartSound();
    if (state.status === "finished") { stopBackgroundBeat(); playVictoryFanfare(); }
  }, [state.status]);

  useEffect(() => {
    if (state.status === "countdown") playTickSound();
  }, [state.status, state.countdown]);

  const lastImpulseId = useRef<number | null>(null);
  useEffect(() => {
    const imp = state.lastImpulse;
    if (!imp || imp.id === lastImpulseId.current) return;
    lastImpulseId.current = imp.id;
    if      (imp.kind === "correct")                       playCorrectSound();
    else if (imp.kind === "wrong")                         playWrongSound();
    else if (imp.kind === "gift" && imp.gift === "steal")  playStealSound();
    else if (imp.kind === "gift")                          playGiftSound();
  }, [state.lastImpulse]);

  const prevBlue = useRef(setup.duration), prevRed = useRef(setup.duration);
  useEffect(() => {
    if (state.status !== "playing") return;
    const bt = state.teams.blue.timeLeft, rt = state.teams.red.timeLeft;
    if ((bt<=5&&bt>0&&bt<prevBlue.current&&state.teams.blue.phase==="question") ||
        (rt<=5&&rt>0&&rt<prevRed.current &&state.teams.red.phase ==="question")) playTickSound();
    prevBlue.current = bt; prevRed.current = rt;
  }, [state.teams.blue.timeLeft, state.teams.red.timeLeft, state.status]);

  const blueRevealed = state.teams.blue.mysteryPicking?.revealed;
  const redRevealed  = state.teams.red.mysteryPicking?.revealed;
  useEffect(() => {
    if (blueRevealed==null) return;
    const h = setTimeout(() => dispatch({ type:"dismiss-mystery", team:"blue" }), 1700);
    return () => clearTimeout(h);
  }, [blueRevealed]);
  useEffect(() => {
    if (redRevealed==null) return;
    const h = setTimeout(() => dispatch({ type:"dismiss-mystery", team:"red" }), 1700);
    return () => clearTimeout(h);
  }, [redRevealed]);

  const braceTimers = useRef<Record<TeamId, ReturnType<typeof setTimeout>|null>>({ blue:null, red:null });
  const handleAnswer = useCallback((team: TeamId, index: number) => {
    if (braceTimers.current[team] !== null) return;
    braceTimers.current[team] = setTimeout(() => {
      braceTimers.current[team] = null;
      dispatch({ type:"answer", team, index });
    }, 260);
  }, []);
  useEffect(() => () => {
    (["blue","red"] as const).forEach((id) => { const h=braceTimers.current[id]; if (h!==null) clearTimeout(h); });
  }, []);

  const handleUseGift     = useCallback((team: TeamId, g: GiftType) => dispatch({ type:"use-gift",     fromTeam:team, gift:g }), []);
  const handlePickMystery = useCallback((team: TeamId, idx: number)  => dispatch({ type:"pick-mystery", team, idx }), []);
  const handleToggleMute  = () => { const m=toggleMute(); setMuted(m); };

  const makePanel = (team: TeamId, name: string) => (
    <TeamPanel team={team} name={name} t={state.teams[team]}
      question={currentWameethQuestion(state, team)}
      qTotal={state.questions.length} duration={settings.duration} ar={ar}
      showCorrect={settings.showCorrect} giftsEnabled={settings.giftsEnabled}
      onAnswer={(i) => handleAnswer(team, i)}
      onUseGift={(g) => handleUseGift(team, g)}
      onPickMystery={(i) => handlePickMystery(team, i)}/>
  );

  const bluePanel  = makePanel("blue", blueName);
  const redPanel   = makePanel("red",  redName);
  const leftPanel  = blueOnRight ? redPanel  : bluePanel;
  const rightPanel = blueOnRight ? bluePanel : redPanel;

  if (state.status === "finished") {
    return <FinishedScreen state={state} blueName={blueName} redName={redName} ar={ar}
      onRematch={onRematch} onExit={onExit}/>;
  }

  return (
    <div className="flex flex-col"
      style={{ height:"100dvh", background:[
        "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(244,201,93,0.06) 0%, transparent 60%)",
        "linear-gradient(180deg,#060c09 0%,#0c1e14 50%,#060c09 100%)",
      ].join(",") }}>

      {/* Control bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 shrink-0"
        style={{ direction: ar ? "rtl" : "ltr" }}>
        <span className="truncate text-xs font-black text-amber-200/70 flex items-center gap-1.5">
          <School className="w-3.5 h-3.5 shrink-0"/>
          {setup.title || (ar?"وميض الصف":"Wameeth Class")}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={handleToggleMute}
            className="rounded-full border border-white/15 bg-black/40 p-1.5 text-white/60 hover:text-white transition-colors"
            aria-label={muted?"unmute":"mute"}>
            {muted ? <VolumeX className="h-3.5 w-3.5"/> : <Volume2 className="h-3.5 w-3.5"/>}
          </button>
          {/* Pause / Resume — only during active play */}
          {(state.status === "playing" || state.status === "countdown") && (
            <button
              onClick={() => setPaused((p) => !p)}
              className="rounded-full border border-white/15 bg-black/40 p-1.5 transition-colors"
              style={{ color: paused ? "#f4c95d" : "rgba(255,255,255,0.60)" }}
              aria-label={paused ? "resume" : "pause"}>
              {paused ? <Play className="h-3.5 w-3.5"/> : <Pause className="h-3.5 w-3.5"/>}
            </button>
          )}
          <button onClick={onExit}
            className="rounded-full border border-white/15 bg-black/40 p-1.5 text-white/60 hover:text-white transition-colors"
            aria-label="exit">
            <XIcon className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>

      {/* Arena */}
      <div className="flex flex-col sm:flex-row flex-1 min-h-0 gap-1.5 sm:gap-3 px-2 sm:px-3 pb-2 sm:pb-3"
        style={{ direction:"ltr" }}>
        {leftPanel}
        <Divider state={state}/>
        {rightPanel}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {state.status==="countdown" && <CountdownOverlay key="cd" count={state.countdown} ar={ar}/>}
        {state.status==="idle"      && (
          <IdleOverlay key="idle" setup={setup} blueName={blueName} redName={redName}
            blueOnRight={blueOnRight} ar={ar}
            settings={settings} onSettings={onSettings}
            onStart={() => dispatch({ type:"start" })}
            onBlueName={setBlueName} onRedName={setRedName}/>
        )}
        {/* Pause overlay */}
        {paused && state.status === "playing" && (
          <motion.div key="pause"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6"
            style={{ background: "rgba(3,8,5,0.88)", backdropFilter: "blur(12px)" }}
            dir={ar ? "rtl" : "ltr"}>

            {/* Icon */}
            <motion.div
              initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "rgba(244,201,93,0.12)", border: "2px solid rgba(244,201,93,0.35)" }}>
              <Pause className="w-9 h-9 text-yellow-300"/>
            </motion.div>

            <div className="text-center">
              <h2 className="text-3xl font-black text-white mb-1">{ar ? "اللعبة متوقفة" : "Game Paused"}</h2>
              <p className="text-white/45 text-sm font-bold">
                {ar ? "اضغط استمر أو العب من حيث توقفت" : "Resume or end the session below"}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Resume */}
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setPaused(false)}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-black text-lg"
                style={{ background: "linear-gradient(135deg,#f4c95d,#d4a63a)", color: "#1a0e00", boxShadow: "0 6px 24px rgba(244,201,93,0.40)" }}>
                <Play className="w-5 h-5"/>
                {ar ? "استمر" : "Resume"}
              </motion.button>

              {/* End game */}
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={onExit}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-black text-lg text-white"
                style={{ background: "rgba(239,68,68,0.18)", border: "1.5px solid rgba(239,68,68,0.45)" }}>
                <LogOut className="w-5 h-5 text-red-400"/>
                {ar ? "إنهاء اللعبة" : "End Game"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function WameethClass() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [, setLocation] = useLocation();
  const [setup]   = useState<WameethClassSetup | null>(readSetup);
  const [round,   setRound]   = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [settings, setSettings] = useState<ClassSettings>(() =>
    loadClassSettings(setup?.duration ?? 20)
  );
  useEffect(() => {
    try { localStorage.setItem(CLASS_SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);
  const blueOnRight = ar !== swapped;

  if (!setup) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <School className="w-14 h-14 text-yellow-400"/>
          <h2 className="text-2xl font-black">{ar?"وميض الصف":"Wameeth Class"}</h2>
          <p className="max-w-sm text-muted-foreground">
            {ar?"افتح صفحة إنشاء وميض، اختر واجباً ثم اضغط «وميض الصف».":"Open the Wameeth create page, pick a quiz, then tap «Wameeth Class»."}
          </p>
          <button onClick={() => setLocation("/game/wameeth/create")}
            className="rounded-xl px-6 py-3 font-bold"
            style={{ background:"linear-gradient(135deg,#f7c948,#d97706)", color:"#1a1008" }}>
            {ar?"اختر مسابقة":"Pick a quiz"}
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <WameethClassGame
        key={`${round}-${settings.duration}-${settings.giftsEnabled}-${settings.freezeDuration}`}
        setup={{ ...setup, duration: settings.duration }}
        blueOnRight={blueOnRight}
        settings={settings}
        onSettings={setSettings}
        onRematch={(swap) => { if (swap) setSwapped((s) => !s); setRound((r) => r + 1); }}
        onExit={() => setLocation("/game/wameeth/create")}/>
    </Layout>
  );
}

function loadClassSettings(defaultDuration: number): ClassSettings {
  try {
    const raw = localStorage.getItem(CLASS_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ClassSettings>;
      return {
        duration:       typeof parsed.duration === "number"       ? parsed.duration       : defaultDuration,
        giftsEnabled:   typeof parsed.giftsEnabled === "boolean"  ? parsed.giftsEnabled   : true,
        showCorrect:    typeof parsed.showCorrect === "boolean"   ? parsed.showCorrect    : true,
        freezeDuration: typeof parsed.freezeDuration === "number" ? parsed.freezeDuration : 10,
      };
    }
  } catch { /* ignore */ }
  return { duration: defaultDuration, giftsEnabled: true, showCorrect: true, freezeDuration: 10 };
}
