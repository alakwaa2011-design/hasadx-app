import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";

const GROUND_Y = 155;
const CENTER_X = 250;
const CHAR_SPACING = 60;

interface CharProps {
  side: "blue" | "red";
  index: number;
  slideX: number;
  isPulling: boolean;
  isUrgent: boolean;
  isCelebrating: boolean;
  isWinnerSide: boolean;
  pullCycle: number;
}

function Character({ side, index, slideX, isPulling, isUrgent, isCelebrating, isWinnerSide, pullCycle }: CharProps) {
  const isBlue = side === "blue";
  const dir = isBlue ? 1 : -1;
  const baseX = isBlue ? CENTER_X - 65 - index * CHAR_SPACING : CENTER_X + 65 + index * CHAR_SPACING;
  const cx = baseX + slideX;
  const stagger = index * 0.25 + (isBlue ? 0 : 0.12);
  const cycle = pullCycle + stagger * 3;
  const sin1 = Math.sin(cycle * 1.6);
  const cos1 = Math.cos(cycle * 1.6);
  const isWinning = isWinnerSide || (isBlue ? slideX < -5 : slideX > 5);
  const leanDeg = isPulling ? (isWinning ? -32 : -16) + sin1 * 4 : isCelebrating && isWinnerSide ? -5 : -3;
  const leanRad = (leanDeg * Math.PI) / 180;
  const skin = index === 0 ? "#FDBCB4" : "#E8A87C";
  const skinD = index === 0 ? "#D4956B" : "#C68642";
  const shirt = isBlue ? (index === 0 ? "#2563EB" : "#3B82F6") : (index === 0 ? "#DC2626" : "#EF4444");
  const shirtD = isBlue ? "#1D4ED8" : "#B91C1C";
  const shorts = isBlue ? "#1E3A5F" : "#7F1D1D";
  const shoe = "#EEE";
  const sock = isBlue ? "#93C5FD" : "#FCA5A5";
  const hair = index === 0 ? "#2C1810" : "#4A2C17";
  const band = isBlue ? "#60A5FA" : "#F87171";
  const feetY = GROUND_Y;
  const hipY = feetY - 32;
  const shoulderY = hipY - 30;
  const neckY = shoulderY - 3;
  const headCenterY = neckY - 13;
  const hipCx = cx + Math.sin(leanRad) * 8 * dir;
  const shoulderCx = cx + Math.sin(leanRad) * 24 * dir;
  const neckCx = shoulderCx + Math.sin(leanRad) * 3 * dir;
  const headCx = neckCx + Math.sin(leanRad) * 4 * dir;
  const ropeGripY = shoulderY + 14;
  const hand1X = shoulderCx + 22 * dir;
  const hand2X = shoulderCx + 17 * dir;
  const legSpread = 11;
  const frontFootX = cx + legSpread * dir + (isPulling ? sin1 * 5 * dir : 0);
  const backFootX = cx - legSpread * dir + (isPulling ? -cos1 * 4 * dir : 0);
  const frontKneeX = (frontFootX + hipCx) / 2 + (isPulling ? 3 * dir : 0);
  const frontKneeY = hipY + 14 + (isPulling ? sin1 * 2 : 0);
  const backKneeX = (backFootX + hipCx) / 2 - (isPulling ? 2 * dir : 0);
  const backKneeY = hipY + 15 + (isPulling ? -cos1 * 2 : 0);
  const celebJump = isCelebrating && isWinnerSide ? Math.abs(Math.sin(cycle * 3)) * -15 : 0;
  const mouthOpen = isPulling && Math.abs(sin1) > 0.65;
  const sOff = 7 * dir;
  const lsx = shoulderCx - sOff;
  const rsx = shoulderCx + sOff;

  return (
    <g>
      <ellipse cx={cx} cy={GROUND_Y + 2} rx={12} ry={3} fill="rgba(0,0,0,0.12)" />
      <g transform={`translate(0, ${celebJump})`}>
        <path d={`M${hipCx - 2 * dir},${hipY} L${backKneeX},${backKneeY} L${backFootX},${feetY}`} stroke={shorts} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx={backFootX} cy={feetY} rx={6} ry={3} fill={shoe} />
        <ellipse cx={backFootX} cy={feetY - 1.5} rx={5} ry={2} fill={sock} opacity={0.4} />
        <path d={`M${hipCx + 2 * dir},${hipY} L${frontKneeX},${frontKneeY} L${frontFootX},${feetY}`} stroke={shorts} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx={frontFootX} cy={feetY} rx={6} ry={3} fill={shoe} />
        <ellipse cx={frontFootX} cy={feetY - 1.5} rx={5} ry={2} fill={sock} opacity={0.4} />
        <path d={`M${hipCx},${hipY + 3} Q${(hipCx + shoulderCx) / 2},${(hipY + shoulderY) / 2} ${shoulderCx},${shoulderY}`} stroke={shirt} strokeWidth={17} strokeLinecap="round" fill="none" />
        <path d={`M${hipCx},${hipY + 3} Q${(hipCx + shoulderCx) / 2},${(hipY + shoulderY) / 2} ${shoulderCx},${shoulderY}`} stroke={shirtD} strokeWidth={17} strokeLinecap="round" fill="none" opacity={0.12} />
        <line x1={lsx} y1={shoulderY} x2={rsx} y2={shoulderY} stroke={shirt} strokeWidth={8} strokeLinecap="round" />
        <text x={(hipCx + shoulderCx) / 2} y={(hipY + shoulderY) / 2 + 5} textAnchor="middle" fill="white" fontSize={8} fontWeight="bold" fontFamily="sans-serif" opacity={0.8}>{index + 1}</text>
        {isCelebrating && isWinnerSide ? (
          <>
            <path d={`M${lsx},${shoulderY} Q${lsx - 8 * dir},${shoulderY - 14} ${lsx - 13 * dir},${shoulderY - 26}`} stroke={skin} strokeWidth={5} strokeLinecap="round" fill="none" />
            <circle cx={lsx - 13 * dir} cy={shoulderY - 28} r={3.5} fill={skin} />
            <path d={`M${rsx},${shoulderY} Q${rsx + 7 * dir},${shoulderY - 12} ${rsx + 11 * dir},${shoulderY - 22}`} stroke={skin} strokeWidth={5} strokeLinecap="round" fill="none" />
            <circle cx={rsx + 11 * dir} cy={shoulderY - 24} r={3.5} fill={skin} />
          </>
        ) : (
          <>
            <path d={`M${rsx},${shoulderY} Q${rsx + 9 * dir},${shoulderY + 6} ${hand1X},${ropeGripY}`} stroke={shirt} strokeWidth={6} strokeLinecap="round" fill="none" />
            <path d={`M${rsx + 1 * dir},${shoulderY + 1} Q${rsx + 8 * dir},${shoulderY + 7} ${hand1X},${ropeGripY + 1}`} stroke={skin} strokeWidth={5} strokeLinecap="round" fill="none" />
            <circle cx={hand1X} cy={ropeGripY} r={3.5} fill={skin} />
            <path d={`M${lsx},${shoulderY} Q${lsx + 6 * dir},${shoulderY + 7} ${hand2X},${ropeGripY + 4}`} stroke={shirt} strokeWidth={6} strokeLinecap="round" fill="none" />
            <path d={`M${lsx + 1 * dir},${shoulderY + 1} Q${lsx + 5 * dir},${shoulderY + 8} ${hand2X},${ropeGripY + 5}`} stroke={skin} strokeWidth={5} strokeLinecap="round" fill="none" />
            <circle cx={hand2X} cy={ropeGripY + 4} r={3.5} fill={skin} />
          </>
        )}
        <line x1={shoulderCx} y1={shoulderY - 2} x2={neckCx} y2={neckY} stroke={skin} strokeWidth={6} strokeLinecap="round" />
        <g>
          <circle cx={headCx} cy={headCenterY} r={11} fill={skin} />
          <ellipse cx={headCx} cy={headCenterY - 9} rx={12} ry={7} fill={hair} />
          <ellipse cx={headCx - 8} cy={headCenterY - 4} rx={4} ry={7} fill={hair} />
          <ellipse cx={headCx + 8} cy={headCenterY - 4} rx={4} ry={7} fill={hair} />
          <rect x={headCx - 12} y={headCenterY - 9} width={24} height={5} rx={2} fill={band} />
          <ellipse cx={headCx - 4} cy={headCenterY} rx={2} ry={2.5} fill="white" />
          <ellipse cx={headCx + 4} cy={headCenterY} rx={2} ry={2.5} fill="white" />
          {isCelebrating && isWinnerSide ? (
            <>
              <circle cx={headCx - 4} cy={headCenterY} r={1.5} fill="#333" />
              <circle cx={headCx + 4} cy={headCenterY} r={1.5} fill="#333" />
              <path d={`M${headCx - 3},${headCenterY + 5} Q${headCx},${headCenterY + 9} ${headCx + 3},${headCenterY + 5}`} stroke="#333" strokeWidth={1.5} fill="none" strokeLinecap="round" />
            </>
          ) : isPulling ? (
            <>
              <ellipse cx={headCx - 4 + dir * 0.5} cy={headCenterY} rx={1.5} ry={2} fill="#333" />
              <ellipse cx={headCx + 4 + dir * 0.5} cy={headCenterY} rx={1.5} ry={2} fill="#333" />
              {mouthOpen ? <ellipse cx={headCx} cy={headCenterY + 6} rx={3} ry={2} fill="#8B0000" /> : <line x1={headCx - 3} y1={headCenterY + 6} x2={headCx + 3} y2={headCenterY + 6} stroke="#333" strokeWidth={1.5} strokeLinecap="round" />}
              <circle cx={headCx - 8} cy={headCenterY + 2} r={2} fill="#FF9999" opacity={0.2} />
              <circle cx={headCx + 8} cy={headCenterY + 2} r={2} fill="#FF9999" opacity={0.2} />
            </>
          ) : (
            <>
              <circle cx={headCx - 4} cy={headCenterY} r={1.3} fill="#333" />
              <circle cx={headCx + 4} cy={headCenterY} r={1.3} fill="#333" />
              <path d={`M${headCx - 2},${headCenterY + 5} Q${headCx},${headCenterY + 7} ${headCx + 2},${headCenterY + 5}`} stroke="#333" strokeWidth={1} fill="none" />
            </>
          )}
        </g>
      </g>
    </g>
  );
}

function Rope({ slideX, isPulling, pullCycle }: { slideX: number; isPulling: boolean; pullCycle: number }) {
  const shoulderY = GROUND_Y - 32 - 30;
  const ropeGripY = shoulderY + 14;
  const blueHandX = CENTER_X - 65 + slideX + Math.sin(isPulling ? 0.55 : 0.12) * 24 + 22;
  const redHandX = CENTER_X + 65 + slideX + Math.sin(isPulling ? -0.55 : -0.12) * 24 - 22;
  const tailL = CENTER_X - 65 - CHAR_SPACING + slideX - 35;
  const tailR = CENTER_X + 65 + CHAR_SPACING + slideX + 35;
  const midX = (blueHandX + redHandX) / 2;
  const sag = isPulling ? 2 : 4;
  const wobble = isPulling ? Math.sin(pullCycle * 4) * 1 : 0;

  return (
    <g>
      <path d={`M${tailL},${ropeGripY + 10} Q${tailL + 18},${ropeGripY + 5} ${blueHandX - 8},${ropeGripY + 1}`} stroke="#A0845C" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.5} />
      <line x1={tailL - 4} y1={ropeGripY + 13} x2={tailL} y2={ropeGripY + 10} stroke="#8B6914" strokeWidth={1} opacity={0.4} />
      <line x1={tailL - 2} y1={ropeGripY + 16} x2={tailL} y2={ropeGripY + 10} stroke="#8B6914" strokeWidth={1} opacity={0.4} />
      <path d={`M${blueHandX - 8},${ropeGripY + 1} L${blueHandX},${ropeGripY} Q${midX - 35},${ropeGripY + sag + wobble} ${midX},${ropeGripY + sag * 0.5 + wobble * 0.5} Q${midX + 35},${ropeGripY + sag - wobble} ${redHandX},${ropeGripY} L${redHandX + 8},${ropeGripY + 1}`}
        stroke="#5D4037" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.2} />
      <path d={`M${blueHandX - 8},${ropeGripY + 1} L${blueHandX},${ropeGripY} Q${midX - 35},${ropeGripY + sag + wobble} ${midX},${ropeGripY + sag * 0.5 + wobble * 0.5} Q${midX + 35},${ropeGripY + sag - wobble} ${redHandX},${ropeGripY} L${redHandX + 8},${ropeGripY + 1}`}
        stroke="#C9A54A" strokeWidth={3} fill="none" strokeLinecap="round" />
      <g transform={`translate(${slideX}, 0)`}>
        <rect x={CENTER_X - 3} y={ropeGripY - 3} width={6} height={10} rx={2} fill="#E53E3E" />
      </g>
      <path d={`M${redHandX + 8},${ropeGripY + 1} Q${tailR - 18},${ropeGripY + 5} ${tailR},${ropeGripY + 10}`} stroke="#A0845C" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.5} />
      <line x1={tailR} y1={ropeGripY + 10} x2={tailR + 4} y2={ropeGripY + 13} stroke="#8B6914" strokeWidth={1} opacity={0.4} />
      <line x1={tailR} y1={ropeGripY + 10} x2={tailR + 2} y2={ropeGripY + 16} stroke="#8B6914" strokeWidth={1} opacity={0.4} />
    </g>
  );
}

function Arena() {
  return (
    <g>
      <defs>
        <linearGradient id="skyG2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB" />
          <stop offset="100%" stopColor="#D4EFFA" />
        </linearGradient>
        <linearGradient id="grassG2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ABF4B" />
          <stop offset="100%" stopColor="#2E7D32" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={500} height={GROUND_Y} fill="url(#skyG2)" />
      <circle cx={440} cy={20} r={12} fill="#FFF9C4" />
      <ellipse cx={80} cy={25} rx={30} ry={8} fill="white" opacity={0.5} />
      <rect x={0} y={GROUND_Y - 2} width={500} height={35} fill="url(#grassG2)" />
      <rect x={80} y={GROUND_Y - 1} width={340} height={20} rx={3} fill="#D4B07A" opacity={0.3} />
    </g>
  );
}

function CenterLine() {
  return (
    <g>
      <rect x={CENTER_X - 1.5} y={GROUND_Y - 20} width={3} height={40} rx={1} fill="#FFD700" opacity={0.8} />
      <polygon points={`${CENTER_X},${GROUND_Y - 24} ${CENTER_X - 5},${GROUND_Y - 18} ${CENTER_X + 5},${GROUND_Y - 18}`} fill="#FFD700" opacity={0.7} />
    </g>
  );
}

function DustCloud({ isPulling, pullCycle }: { isPulling: boolean; pullCycle: number }) {
  if (!isPulling) return null;
  return (
    <g>
      {Array.from({ length: 6 }).map((_, i) => {
        const bx = 100 + i * 60;
        const ph = (pullCycle * 2.5 + i * 0.9) % (Math.PI * 2);
        if (Math.sin(ph) < 0) return null;
        return <circle key={i} cx={bx + Math.cos(ph + i) * 3} cy={GROUND_Y - Math.sin(ph) * 5 + 1} r={1 + Math.sin(ph) * 1} fill="#C9A96E" opacity={Math.sin(ph) * 0.25} />;
      })}
    </g>
  );
}

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const p = Array.from({ length: 12 }).map((_, i) => ({
    x: 60 + Math.random() * 380, c: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF7F50"][i % 8],
    s: 2 + Math.random() * 2.5, d: 1.2 + Math.random() * 1.5, dl: Math.random() * 2,
  }));
  return <g>{p.map((c, i) => (
    <motion.rect key={i} x={c.x} y={-10} width={c.s} height={c.s * 0.5} rx={1} fill={c.c}
      animate={{ y: [-10, GROUND_Y + 10], x: [c.x, c.x + Math.sin(i) * 20], rotate: [0, i % 2 === 0 ? 360 : -360], opacity: [1, 1, 0.3] }}
      transition={{ repeat: Infinity, duration: c.d, delay: c.dl, ease: "linear" }} />
  ))}</g>;
}

function TimerRing({ timeLeft, total }: { timeLeft: number; total: number }) {
  const pct = timeLeft / total;
  const r = 16;
  const circ = 2 * Math.PI * r;
  const color = pct > 0.5 ? "#22C55E" : pct > 0.25 ? "#EAB308" : "#EF4444";
  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <svg width={40} height={40} className="absolute -rotate-90">
        <circle cx={20} cy={20} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} />
        <motion.circle cx={20} cy={20} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} animate={{ strokeDashoffset: circ * (1 - pct) }} transition={{ duration: 0.3 }} />
      </svg>
      <span className="text-xs font-black" style={{ color }}>{timeLeft}</span>
    </div>
  );
}

type Phase = "countdown" | "question" | "answered" | "round-end";

const demoQuestion = {
  text: "ما هي عاصمة المملكة العربية السعودية؟",
  options: ["جدة", "الرياض", "مكة المكرمة", "الدمام"],
  correctIndex: 1,
  index: 2,
  total: 5,
  duration: 15,
};

const optionLetters = ["أ", "ب", "ج", "د"];

export function FullGamePreview() {
  const [slideX, setSlideX] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [winnerSide, setWinnerSide] = useState<"blue" | "red" | null>(null);
  const [pullCycle, setPullCycle] = useState(0);
  const animRef = useRef(0);
  const mountedRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("countdown");
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [countNum, setCountNum] = useState(3);
  const [showCorrect, setShowCorrect] = useState(false);
  const [blueScore, setBlueScore] = useState(450);
  const [redScore, setRedScore] = useState(380);

  useEffect(() => {
    mountedRef.current = true;
    const s = performance.now();
    const tick = (n: number) => {
      if (!mountedRef.current) return;
      setPullCycle((n - s) / 1000 * Math.PI * 2 * 1.2);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { mountedRef.current = false; cancelAnimationFrame(animRef.current); };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const run = async () => {
      if (!mountedRef.current) return;

      setPhase("countdown"); setCountNum(3); setSlideX(0); setIsPulling(false);
      setIsCelebrating(false); setWinnerSide(null); setSelectedAnswer(null);
      setAnswerCorrect(null); setShowCorrect(false); setTimeLeft(15);
      setBlueScore(450); setRedScore(380);

      await d(800); if (!mountedRef.current) return; setCountNum(2);
      await d(800); if (!mountedRef.current) return; setCountNum(1);
      await d(800); if (!mountedRef.current) return;

      setPhase("question"); setIsPulling(true);

      for (let i = 15; i >= 8; i--) { await d(400); if (!mountedRef.current) return; setTimeLeft(i); }

      setSelectedAnswer(1); setAnswerCorrect(true); setPhase("answered");

      for (let i = 0; i < 4; i++) { await d(300); if (!mountedRef.current) return; setSlideX(p => p + 8); }

      await d(1200); if (!mountedRef.current) return;

      setPhase("round-end"); setShowCorrect(true); setBlueScore(550); setRedScore(380);

      await d(3000); if (!mountedRef.current) return;

      setPhase("countdown"); setCountNum(3); setSelectedAnswer(null);
      setAnswerCorrect(null); setShowCorrect(false); setTimeLeft(15);
      await d(800); if (!mountedRef.current) return; setCountNum(2);
      await d(800); if (!mountedRef.current) return; setCountNum(1);
      await d(800); if (!mountedRef.current) return;

      setPhase("question"); setIsPulling(true);

      for (let i = 15; i >= 4; i--) { await d(350); if (!mountedRef.current) return; setTimeLeft(i); }
      if (!mountedRef.current) return; setIsUrgent(true);
      for (let i = 3; i >= 1; i--) { await d(350); if (!mountedRef.current) return; setTimeLeft(i); }

      setSelectedAnswer(3); setAnswerCorrect(false); setPhase("answered"); setIsUrgent(false);

      for (let i = 0; i < 3; i++) { await d(300); if (!mountedRef.current) return; setSlideX(p => p - 6); }

      await d(1200); if (!mountedRef.current) return;
      setPhase("round-end"); setShowCorrect(true); setRedScore(480);

      await d(3000); if (!mountedRef.current) return;

      setIsPulling(false); setIsCelebrating(true); setWinnerSide("blue");
      setPhase("countdown");
      await d(4000); if (!mountedRef.current) return;

      if (mountedRef.current) run();
    };
    run();
    return () => { mountedRef.current = false; };
  }, []);

  const optionBg = (idx: number) => {
    if (showCorrect && idx === demoQuestion.correctIndex) return "bg-green-500/80 border-green-400 text-white";
    if (selectedAnswer === idx) {
      if (answerCorrect) return "bg-green-500/80 border-green-400 text-white";
      return "bg-red-500/80 border-red-400 text-white";
    }
    if (selectedAnswer !== null && showCorrect && idx !== demoQuestion.correctIndex) return "bg-white/5 border-white/10 text-white/30";
    return "bg-white/10 border-white/20 text-white hover:bg-white/20";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white flex items-start justify-center p-2 pt-3">
      <div className="w-full max-w-md mx-auto flex flex-col" style={{ maxHeight: "100vh" }}>

        <div className="flex items-center justify-between px-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/80 px-3 py-1 rounded-full text-xs font-bold">🔵 {blueScore}</div>
          </div>
          <div className="text-amber-300 text-sm font-black">⚡ شد الحبل</div>
          <div className="flex items-center gap-2">
            <div className="bg-red-600/80 px-3 py-1 rounded-full text-xs font-bold">🔴 {redScore}</div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border-2 border-amber-400/40 shadow-xl relative mb-2" style={{ boxShadow: isUrgent ? "inset 0 0 40px rgba(239,68,68,0.4)" : "0 10px 40px rgba(0,0,0,0.3)" }}>
          <svg viewBox="0 0 500 185" className="w-full block">
            <Arena />
            <CenterLine />
            <Rope slideX={slideX} isPulling={isPulling} pullCycle={pullCycle} />
            <DustCloud isPulling={isPulling} pullCycle={pullCycle} />
            <Character side="blue" index={1} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "blue"} pullCycle={pullCycle} />
            <Character side="red" index={1} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "red"} pullCycle={pullCycle} />
            <Character side="blue" index={0} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "blue"} pullCycle={pullCycle} />
            <Character side="red" index={0} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "red"} pullCycle={pullCycle} />
            <Confetti active={isCelebrating} />
          </svg>

          {isCelebrating && winnerSide && (
            <motion.div className="absolute inset-0 flex items-center justify-center" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-2xl text-center">
                <div className="text-4xl mb-1">🏆</div>
                <div className="text-lg font-black text-amber-300">{winnerSide === "blue" ? "الأزرق فاز!" : "الأحمر فاز!"}</div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {phase === "countdown" && !isCelebrating && (
              <motion.div key="cd" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-5">
                <motion.div key={countNum} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl">
                  <span className="text-3xl font-black text-white">{countNum}</span>
                </motion.div>
              </motion.div>
            )}

            {(phase === "question" || phase === "answered") && (
              <motion.div key="q" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-1">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-white/40 text-xs font-bold bg-white/10 px-2 py-0.5 rounded-lg">
                    {demoQuestion.index + 1} / {demoQuestion.total}
                  </span>
                  <TimerRing timeLeft={timeLeft} total={demoQuestion.duration} />
                </div>

                <div className="bg-white/10 rounded-2xl p-3.5 mb-3 text-center border border-white/10 shadow-inner">
                  <p className="text-sm font-black leading-snug">{demoQuestion.text}</p>
                </div>

                <AnimatePresence>
                  {phase === "answered" && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      className={`text-center py-2 px-3 rounded-xl mb-2.5 font-black text-sm border ${
                        answerCorrect ? "bg-green-500/30 text-green-300 border-green-500/40" : "bg-red-500/30 text-red-300 border-red-500/40"
                      }`}>
                      {answerCorrect ? "✅ إجابة صحيحة! +100" : "❌ إجابة خاطئة — الحبل يرتد!"}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid gap-2">
                  {demoQuestion.options.map((opt, idx) => (
                    <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-xl border-2 font-bold text-sm transition-all ${optionBg(idx)}`}>
                      <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-xs font-black shrink-0">
                        {optionLetters[idx]}
                      </span>
                      <span className="leading-tight text-xs">{opt}</span>
                    </div>
                  ))}
                </div>

                {phase === "answered" && (
                  <p className="text-center text-white/30 text-xs mt-2">⏳ انتظر حتى يجيب الجميع...</p>
                )}
              </motion.div>
            )}

            {phase === "round-end" && (
              <motion.div key="re" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="px-1">
                <div className="text-center mb-2.5">
                  <span className="text-3xl">📊</span>
                  <h3 className="text-base font-black mt-0.5">نتيجة الجولة</h3>
                </div>
                <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-2 mb-2.5 text-center">
                  <p className="text-green-300 text-xs">✅ الإجابة الصحيحة</p>
                  <p className="font-black text-sm mt-0.5">{demoQuestion.options[demoQuestion.correctIndex]}</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                  <div className="bg-blue-500/20 border border-blue-400/30 rounded-xl p-2 text-center">
                    <p className="text-blue-300 text-xs">🔵 الأزرق</p>
                    <p className="text-xl font-black text-blue-200">{blueScore}</p>
                  </div>
                  <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-2 text-center">
                    <p className="text-red-300 text-xs">🔴 الأحمر</p>
                    <p className="text-xl font-black text-red-200">{redScore}</p>
                  </div>
                </div>
                <div className="text-center text-xs font-bold opacity-50">
                  {blueScore > redScore ? "⬅️ الأزرق يتقدم!" : redScore > blueScore ? "➡️ الأحمر يتقدم!" : "⚖️ تعادل!"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function d(ms: number) { return new Promise(r => setTimeout(r, ms)); }
