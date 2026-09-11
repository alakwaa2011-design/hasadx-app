import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

const GROUND_Y = 320;
const CENTER_X = 500;
const CHAR_SPACING = 90;

export interface TugImpulse {
  team: "blue" | "red";
  kind: "win" | "lose";
  id: number;
}

interface CartoonTugSceneProps {
  ropePos: number;
  isPulling: boolean;
  isUrgent: boolean;
  isCelebrating: boolean;
  winnerSide: "blue" | "red" | null;
  impulse?: TugImpulse | null;
  intro?: "waiting" | "run";
  brace?: "blue" | "red" | null;
}

interface CharProps {
  side: "blue" | "red";
  index: number;
  slideX: number;
  isPulling: boolean;
  isUrgent: boolean;
  isCelebrating: boolean;
  isWinnerSide: boolean;
  isLosingSide: boolean;
  pullCycle: number;
  fatigue: number;
}

export function solveIK(x1: number, y1: number, x2: number, y2: number, l1: number, l2: number, sign: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= l1 + l2 || d === 0) {
    const ratio = d === 0 ? 0 : l1 / d;
    return [x1 + dx * ratio, y1 + dy * ratio];
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const xm = x1 + (dx * a) / d;
  const ym = y1 + (dy * a) / d;
  const rx = -dy / d;
  const ry = dx / d;
  return [xm + rx * h * sign, ym + ry * h * sign];
}

const VARIANTS = {
  blue: [
    { id: "b1", avatar: "/avatars/casual-curly-boy.webp", skin: "#F3B68E", primary: "#2563EB", pants: "#0F172A", legLen: 34, torso: 32 },
    { id: "b2", avatar: "/avatars/casual-braids-girl.webp", skin: "#DDA06A", primary: "#3B82F6", pants: "#1E293B", legLen: 32, torso: 30 },
    { id: "b3", avatar: "/avatars/space-boy.webp", skin: "#CE9059", primary: "#1D4ED8", pants: "#082F6F", legLen: 36, torso: 33 },
  ],
  red: [
    { id: "r1", avatar: "/avatars/casual-bob-girl.webp", skin: "#F3C896", primary: "#EF4444", pants: "#450A0A", legLen: 32, torso: 30 },
    { id: "r2", avatar: "/avatars/adventurer-boy.webp", skin: "#CE9059", primary: "#DC2626", pants: "#7F1D1D", legLen: 34, torso: 32 },
    { id: "r3", avatar: "/avatars/arab-formal-hijabi.webp", skin: "#AC6A3E", primary: "#B91C1C", pants: "#3E0B0B", legLen: 33, torso: 31 },
  ]
};

function IKThickLimb({ x1, y1, x2, y2, x3, y3, color, w1, w2, shadowColor = "rgba(0,0,0,0.25)" }: any) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={shadowColor} strokeWidth={w1 + 4} strokeLinecap="round" />
      <line x1={x2} y1={y2} x2={x3} y2={y3} stroke={shadowColor} strokeWidth={w2 + 4} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w1} strokeLinecap="round" />
      <line x1={x2} y1={y2} x2={x3} y2={y3} stroke={color} strokeWidth={w2} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth={w1 * 0.3} strokeLinecap="round" transform="translate(-1, -1)" />
      <line x1={x2} y1={y2} x2={x3} y2={y3} stroke="rgba(255,255,255,0.15)" strokeWidth={w2 * 0.3} strokeLinecap="round" transform="translate(-1, -1)" />
    </g>
  );
}

function Torso({ shoulderX, shoulderY, hipX, hipY, color, w }: any) {
  return (
    <g>
      <line x1={shoulderX} y1={shoulderY} x2={hipX} y2={hipY} stroke="rgba(0,0,0,0.25)" strokeWidth={w + 4} strokeLinecap="round" />
      <line x1={shoulderX} y1={shoulderY} x2={hipX} y2={hipY} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <line x1={shoulderX} y1={shoulderY} x2={hipX} y2={hipY} stroke="rgba(0,0,0,0.15)" strokeWidth={w - 12} strokeLinecap="round" transform="translate(4, 0)" />
    </g>
  );
}

function Head({ cx, cy, dir, v, isPulling, isTired, layer }: any) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <defs>
        <clipPath id={`clip-${v.id}-${layer}`}>
          <circle cx="0" cy="0" r="22" />
        </clipPath>
      </defs>
      <circle cx="0" cy="0" r="24" fill={v.primary} opacity={0.2} />
      <g transform={`scale(${dir}, 1)`}>
        <image
          href={v.avatar}
          x="-30" y="-24" width="60" height="60"
          clipPath={`url(#clip-${v.id}-${layer})`}
          preserveAspectRatio="xMidYMid slice"
        />
        {isPulling && !isTired && (
          <path d="M 12,-14 Q 18,-8 14,-2 Z" fill="#93C5FD" opacity={0.8} />
        )}
        {isTired && (
          <path d="M 12,0 Q 18,6 14,12 Z" fill="#93C5FD" opacity={0.8} />
        )}
      </g>
    </g>
  );
}

function Shoe({ x, y, dir, isBack }: any) {
  const color = isBack ? "#222" : "#444";
  return (
    <g>
      <path d={`M${x - 8},${y - 4} L${x + 10 * dir},${y - 2} A4,4 0 0,1 ${x + 14 * dir},${y + 4} L${x - 10},${y + 4} Z`} fill={color} />
      <line x1={x - 10} y1={y + 5} x2={x + 14 * dir} y2={y + 5} stroke="#FFF" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

function Character({ side, index, slideX, isPulling, isUrgent, isCelebrating, isWinnerSide, isLosingSide, pullCycle, fatigue, layer }: CharProps & { layer: "back" | "front" }) {
  const isBlue = side === "blue";
  const dir = isBlue ? 1 : -1;
  const cx = (isBlue ? CENTER_X - 110 - index * CHAR_SPACING : CENTER_X + 110 + index * CHAR_SPACING) + slideX;
  
  const stagger = index * 0.3 + (isBlue ? 0 : 0.15);
  const cycle = pullCycle + stagger * 3;
  const sin1 = Math.sin(cycle * 1.6);
  
  const isWinning = isWinnerSide || (isBlue ? slideX < -5 : slideX > 5);
  const isTired = isLosingSide || fatigue > 0.3;
  
  const baseLean = isPulling
    ? (isWinning ? -45 : isTired ? -24 - fatigue * 9 : -35) + sin1 * 3.5
    : isCelebrating && isWinnerSide ? -5
    : isCelebrating && isLosingSide ? 16
    : -3;
  
  const leanRad = (baseLean * Math.PI) / 180;
  const typedVariants = VARIANTS[side] as any;
  const v = typedVariants[index] || typedVariants[0];
  
  const legSpread = isPulling ? 32 : 24;
  const footOffset = isPulling ? sin1 * 6 : 0;
  const frontFootX = cx + legSpread * dir + footOffset * dir;
  const frontFootY = GROUND_Y;
  const backFootX = cx - legSpread * dir - footOffset * dir;
  const backFootY = GROUND_Y;
  
  const hipX = cx + Math.sin(leanRad) * 16 * dir;
  const hipY = GROUND_Y - 55 + Math.cos(leanRad) * 6;
  
  const shoulderX = hipX + Math.sin(leanRad) * 42 * dir;
  const shoulderY = hipY - Math.cos(leanRad) * 42;
  
  const neckX = shoulderX + Math.sin(leanRad) * 5 * dir;
  const neckY = shoulderY - Math.cos(leanRad) * 5;
  const headCx = neckX + Math.sin(leanRad) * 12 * dir;
  const headCy = neckY - Math.cos(leanRad) * 12;
  
  const ropeGripY = GROUND_Y - 48;
  const hand1X = cx + 38 * dir;
  const hand1Y = ropeGripY + (isBlue ? -2 : 2);
  const hand2X = cx + 56 * dir;
  const hand2Y = ropeGripY + (isBlue ? 2 : -2);
  
  const [frontKneeX, frontKneeY] = solveIK(hipX, hipY, frontFootX, frontFootY - 6, v.legLen, v.legLen + 2, isBlue ? -1 : 1);
  const [backKneeX, backKneeY] = solveIK(hipX, hipY, backFootX, backFootY - 6, v.legLen, v.legLen + 2, isBlue ? -1 : 1);
  const [elbow1X, elbow1Y] = solveIK(shoulderX, shoulderY, hand1X, hand1Y, 32, 34, isBlue ? 1 : -1);
  const [elbow2X, elbow2Y] = solveIK(shoulderX, shoulderY, hand2X, hand2Y, 32, 34, isBlue ? 1 : -1);
  
  const celebJump = isCelebrating && isWinnerSide ? Math.abs(Math.sin(cycle * 3)) * -28 : 0;
  const idleBob = (!isPulling && !isCelebrating) ? Math.sin(cycle) * 2 : 0;
  const yOffset = celebJump + idleBob;

  return (
    <g transform={`translate(0, ${yOffset})`}>
      {layer === "back" && (
        <>
          <IKThickLimb x1={shoulderX} y1={shoulderY} x2={elbow2X} y2={elbow2Y} x3={hand2X} y3={hand2Y} color={v.skin} w1={13} w2={11} shadowColor="rgba(0,0,0,0.35)" />
          <IKThickLimb x1={shoulderX} y1={shoulderY} x2={(shoulderX + elbow2X)/2} y2={(shoulderY + elbow2Y)/2} x3={(shoulderX + elbow2X)/2} y3={(shoulderY + elbow2Y)/2} color={v.primary} w1={16} w2={16} />
          <IKThickLimb x1={hipX} y1={hipY} x2={backKneeX} y2={backKneeY} x3={backFootX} y3={backFootY - 6} color={v.pants} w1={18} w2={14} shadowColor="rgba(0,0,0,0.35)" />
          <Shoe x={backFootX} y={backFootY} dir={dir} isBack={true} />
        </>
      )}
      {layer === "front" && (
        <>
          <Torso shoulderX={shoulderX} shoulderY={shoulderY} hipX={hipX} hipY={hipY} color={v.primary} w={28} />
          <IKThickLimb x1={hipX} y1={hipY} x2={frontKneeX} y2={frontKneeY} x3={frontFootX} y3={frontFootY - 6} color={v.pants} w1={19} w2={15} />
          <Shoe x={frontFootX} y={frontFootY} dir={dir} isBack={false} />
          <Head cx={headCx} cy={headCy} dir={dir} v={v} isPulling={isPulling} isTired={isTired} layer={layer} />
          <IKThickLimb x1={shoulderX} y1={shoulderY} x2={elbow1X} y2={elbow1Y} x3={hand1X} y3={hand1Y} color={v.skin} w1={14} w2={12} />
          <IKThickLimb x1={shoulderX} y1={shoulderY} x2={(shoulderX*0.4 + elbow1X*0.6)} y2={(shoulderY*0.4 + elbow1Y*0.6)} x3={(shoulderX*0.4 + elbow1X*0.6)} y3={(shoulderY*0.4 + elbow1Y*0.6)} color={v.primary} w1={17} w2={17} />
          <circle cx={hand2X} cy={hand2Y} r={6.5} fill={v.skin} />
          <circle cx={hand1X} cy={hand1Y} r={6.5} fill={v.skin} />
        </>
      )}
    </g>
  );
}

function BraidedRope({ slideX, isPulling, pullCycle }: any) {
  const ropeGripY = GROUND_Y - 48;
  const wave = isPulling ? 0 : Math.sin(pullCycle) * 3;
  const startX = -100 + slideX;
  const endX = 1100 + slideX;
  
  return (
    <g transform={`translate(0, ${wave})`}>
      <line x1={startX} y1={ropeGripY} x2={endX} y2={ropeGripY} stroke="#78350f" strokeWidth={14} strokeLinecap="round" />
      <line x1={startX} y1={ropeGripY} x2={endX} y2={ropeGripY} stroke="#d97706" strokeWidth={14} strokeDasharray="12 8" strokeLinecap="round" />
      <line x1={startX} y1={ropeGripY} x2={endX} y2={ropeGripY} stroke="rgba(0,0,0,0.3)" strokeWidth={14} strokeDasharray="12 8" strokeDashoffset="6" strokeLinecap="round" />
      <rect x={CENTER_X - 15 + slideX} y={ropeGripY - 10} width={30} height={20} fill="#dc2626" rx={4} />
      <rect x={CENTER_X - 5 + slideX} y={ropeGripY - 10} width={10} height={20} fill="#fcd34d" />
    </g>
  );
}

function DustCloud({ isPulling, pullCycle, slideX, burst }: { isPulling: boolean; pullCycle: number; slideX: number; burst: boolean }) {
  if (!isPulling && !burst) return null;
  return (
    <g opacity={burst ? 0.9 : 0.45}>
      {[0, 1, 2, 3].map(i => {
        const cx = CENTER_X + slideX + (i - 1.5) * 40;
        const cy = GROUND_Y - 5;
        const r = burst ? 22 + (pullCycle * 15 % 15) : 12 + Math.sin(pullCycle * 4 + i) * 6;
        return <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.4)" opacity={0.6} />;
      })}
    </g>
  );
}

function VictoryTrophy({ x }: { x: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.g
      initial={reducedMotion ? { y: GROUND_Y - 260, scale: 1, opacity: 1 } : { y: GROUND_Y - 50, scale: 0, opacity: 0 }}
      animate={{ y: GROUND_Y - 260, scale: 1, opacity: 1 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 12, delay: 0.3 }}
    >
      <circle cx={x} cy={0} r={40} fill="rgba(255,215,0,0.2)" />
      <path d={`M${x - 20},0 Q${x},30 ${x + 20},0 Z`} fill="#FFD700" />
      <rect x={x - 5} y={15} width={10} height={20} fill="#DAA520" />
      <rect x={x - 15} y={35} width={30} height={8} fill="#B8860B" rx={2} />
      <path d={`M${x - 20}, -5 Q${x - 40}, -15 ${x - 20}, 5`} stroke="#FFD700" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d={`M${x + 20}, -5 Q${x + 40}, -15 ${x + 20}, 5`} stroke="#FFD700" strokeWidth={4} fill="none" strokeLinecap="round" />
    </motion.g>
  );
}

export function CartoonTugScene({ ropePos, isPulling, isUrgent, isCelebrating, winnerSide, impulse, intro, brace }: CartoonTugSceneProps) {
  const [pullCycle, setPullCycle] = useState(0);
  const reducedMotion = useReducedMotion();
  const introMode = reducedMotion ? undefined : intro;
  
  const [displayPos, setDisplayPos] = useState(ropePos);
  
  const ropePosRef = useRef(ropePos);
  ropePosRef.current = ropePos;
  const isPullingRef = useRef(isPulling);
  isPullingRef.current = isPulling;
  
  const [kick, setKick] = useState(0);
  const [burstOn, setBurstOn] = useState(false);
  const kickPosRef = useRef(0);
  const kickVelRef = useRef(0);
  const burstUntilRef = useRef(0);
  const lastImpulseId = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayPos(ropePos);
      setPullCycle(isPulling ? 1.5 : 0);
      setKick(0);
      setBurstOn(false);
    }
  }, [reducedMotion, ropePos, isPulling]);

  useEffect(() => {
    if (reducedMotion) return;

    let handle: number;
    let lastTime = performance.now();
    let acc = 0;
    
    const tick = (time: number) => {
      handle = requestAnimationFrame(tick);
      
      const delta = time - lastTime;
      acc += delta;
      lastTime = time;
      
      if (acc < 33) return; // Cap at ~30fps max calculation
      
      let dtScale = acc / 16.666; // Scale relative to 60fps
      if (dtScale > 3) dtScale = 3; // Prevent physics explosion if tab was inactive
      acc = 0;

      setPullCycle(p => p + 0.04 * dtScale);
      setDisplayPos(prev => {
        const diff = ropePosRef.current - prev;
        return prev + diff * (0.08 * dtScale);
      });
      
      const k = kickPosRef.current;
      const v = kickVelRef.current;
      const force = -k * 0.12 - v * 0.18;
      kickVelRef.current += force * dtScale;
      kickPosRef.current += kickVelRef.current * dtScale;
      
      if (Math.abs(kickPosRef.current) < 0.1 && Math.abs(kickVelRef.current) < 0.1) {
        kickPosRef.current = 0;
        kickVelRef.current = 0;
      }
      setKick(kickPosRef.current);
      setBurstOn(Date.now() < burstUntilRef.current);
    };
    
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [reducedMotion]);

  useEffect(() => {
    if (impulse && impulse.id !== lastImpulseId.current) {
      lastImpulseId.current = impulse.id;
      if (reducedMotion) return;
      const power = impulse.kind === "win" ? 22 : 12;
      // Blue pulls LEFT (decreases ropePos). Red pulls RIGHT (increases ropePos).
      // A win for Blue means the rope goes LEFT (- kick).
      // A win for Red means the rope goes RIGHT (+ kick).
      kickVelRef.current = impulse.team === "blue" ? -power : power;
      burstUntilRef.current = Date.now() + 400;
    }
  }, [impulse, reducedMotion]);

  // Rope 50 = slide 0. Rope 100 = red wall.
  // When displayPos increases (Red is pulling), slideX should be positive (moves everything right).
  const rawSlide = (displayPos - 50) * 6;
  const slideX = rawSlide + kick;

  const blueFatigue = ropePos > 80 ? (ropePos - 80) / 20 : 0;
  const redFatigue = ropePos < 20 ? (20 - ropePos) / 20 : 0;
  const blueIsLosing = ropePos > 85;
  const redIsLosing = ropePos < 15;

  const transitionConfig = (i: number) => 
    introMode === "run" ? { x: { duration: 0.9, ease: "easeOut", delay: i === 2 ? 0 : 0.15 } } : reducedMotion ? { duration: 0 } : { duration: 0.18 };
  
  const getAnimateConfig = (team: "blue" | "red") => {
    const isBlue = team === "blue";
    const dir = isBlue ? -1 : 1;
    if (introMode === "waiting") return { x: dir * 340, y: 0 };
    if (introMode === "run") return { x: 0 };
    if (brace === team) return { x: dir * 5, y: 3 };
    return { x: 0, y: 0 };
  };

  return (
    <div className="w-full h-full relative overflow-hidden pointer-events-none select-none">
      <svg width="100%" height="100%" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice">
        <image href="/arena_bg.jpg" x={0} y={0} width={1000} height={400} preserveAspectRatio="xMidYMid slice" opacity={0.95} />
        
        {/* Draw Back Layers */}
        {[2, 1, 0].map(i => (
          <motion.g key={`blue-back-${i}`} initial={false}
            animate={getAnimateConfig("blue")}
            transition={transitionConfig(i)}
          >
            <Character side="blue" index={i} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "blue"} isLosingSide={blueIsLosing} pullCycle={pullCycle} fatigue={blueFatigue} layer="back" />
          </motion.g>
        ))}
        {[2, 1, 0].map(i => (
          <motion.g key={`red-back-${i}`} initial={false}
            animate={getAnimateConfig("red")}
            transition={transitionConfig(i)}
          >
            <Character side="red" index={i} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "red"} isLosingSide={redIsLosing} pullCycle={pullCycle} fatigue={redFatigue} layer="back" />
          </motion.g>
        ))}

        <DustCloud isPulling={isPulling} pullCycle={pullCycle} slideX={slideX} burst={burstOn} />

        <BraidedRope slideX={slideX} isPulling={isPulling} pullCycle={pullCycle} />

        {/* Draw Front Layers */}
        {[2, 1, 0].map(i => (
          <motion.g key={`blue-front-${i}`} initial={false}
            animate={getAnimateConfig("blue")}
            transition={transitionConfig(i)}
          >
            <Character side="blue" index={i} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "blue"} isLosingSide={blueIsLosing} pullCycle={pullCycle} fatigue={blueFatigue} layer="front" />
          </motion.g>
        ))}
        {[2, 1, 0].map(i => (
          <motion.g key={`red-front-${i}`} initial={false}
            animate={getAnimateConfig("red")}
            transition={transitionConfig(i)}
          >
            <Character side="red" index={i} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "red"} isLosingSide={redIsLosing} pullCycle={pullCycle} fatigue={redFatigue} layer="front" />
          </motion.g>
        ))}

        {isCelebrating && winnerSide && (
          <VictoryTrophy x={winnerSide === "blue" ? 330 + slideX : 670 + slideX} />
        )}
      </svg>
    </div>
  );
}
