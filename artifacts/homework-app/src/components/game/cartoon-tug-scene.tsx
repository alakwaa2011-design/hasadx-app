import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

const GROUND_Y = 310;
const CENTER_X = 500;
const CHAR_SPACING = 100;

interface CartoonTugSceneProps {
  ropePos: number;
  isPulling: boolean;
  isUrgent: boolean;
  isCelebrating: boolean;
  winnerSide: "blue" | "red" | null;
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

function SweatDrops({ cx, cy, active, pullCycle, index }: { cx: number; cy: number; active: boolean; pullCycle: number; index: number }) {
  if (!active) return null;
  const drops = [
    { dx: -16, dy: -5, delay: 0 },
    { dx: 14, dy: -3, delay: 0.4 },
    { dx: -10, dy: 8, delay: 0.8 },
    { dx: 18, dy: 6, delay: 1.2 },
  ];
  return (
    <g>
      {drops.map((d, i) => {
        const phase = (pullCycle * 1.5 + d.delay + index * 0.5) % 3;
        const y = d.dy + phase * 12;
        const opacity = phase < 2 ? 0.6 - phase * 0.15 : 0;
        if (opacity <= 0) return null;
        return (
          <g key={i}>
            <ellipse cx={cx + d.dx} cy={cy + y} rx={2} ry={3.5} fill="#64B5F6" opacity={opacity} />
            <ellipse cx={cx + d.dx} cy={cy + y - 1} rx={1} ry={1.5} fill="#90CAF9" opacity={opacity * 0.7} />
          </g>
        );
      })}
    </g>
  );
}

function LosingCharacter({ side, index, slideX, pullCycle }: { side: "blue" | "red"; index: number; slideX: number; pullCycle: number }) {
  const isBlue = side === "blue";
  const dir = isBlue ? 1 : -1;
  const baseX = isBlue
    ? CENTER_X - 120 - index * CHAR_SPACING
    : CENTER_X + 120 + index * CHAR_SPACING;
  const cx = baseX + slideX;
  const stagger = index * 0.25 + (isBlue ? 0 : 0.12);
  const cycle = pullCycle + stagger * 3;

  const skin = index === 0 ? "#FDBCB4" : "#E8A87C";
  const shirt = isBlue ? (index === 0 ? "#1D4ED8" : "#2563EB") : (index === 0 ? "#B91C1C" : "#DC2626");
  const shirtD = isBlue ? "#1E40AF" : "#991B1B";
  const shorts = isBlue ? "#1E3A5F" : "#7F1D1D";
  const shoe = "#EEEEEE";
  const sock = isBlue ? "#93C5FD" : "#FCA5A5";
  const hair = index === 0 ? "#2C1810" : "#4A2C17";
  const band = isBlue ? "#60A5FA" : "#F87171";

  const isSitting = index === 0;
  const bodyY = GROUND_Y - 10;
  const headY = bodyY - 35;

  const legKick1 = Math.sin(cycle * 2.5) * 12;
  const legKick2 = Math.sin(cycle * 2.5 + 1.5) * 10;

  const tearDrop1Y = Math.sin(cycle * 3) * 4;
  const tearDrop2Y = Math.sin(cycle * 3 + 1) * 4;

  if (isSitting) {
    return (
      <g>
        <ellipse cx={cx} cy={GROUND_Y + 3} rx={28} ry={5} fill="rgba(0,0,0,0.12)" />

        <path d={`M${cx - 15 * dir},${bodyY + 5} L${cx - 20 * dir + legKick1},${GROUND_Y - 5} L${cx - 25 * dir + legKick1},${GROUND_Y}`}
          stroke={shorts} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx={cx - 25 * dir + legKick1} cy={GROUND_Y} rx={9} ry={4} fill={shoe} />

        <path d={`M${cx - 8 * dir},${bodyY + 5} L${cx - 5 * dir + legKick2},${GROUND_Y - 8} L${cx - 10 * dir + legKick2},${GROUND_Y}`}
          stroke={shorts} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx={cx - 10 * dir + legKick2} cy={GROUND_Y} rx={9} ry={4} fill={shoe} />

        <ellipse cx={cx} cy={bodyY + 5} rx={18} ry={14} fill={shirt} />
        <ellipse cx={cx} cy={bodyY + 5} rx={18} ry={14} fill={shirtD} opacity={0.15} />

        <text x={cx} y={bodyY + 10} textAnchor="middle" fill="white" fontSize={12} fontWeight="bold" fontFamily="sans-serif" opacity={0.8}>{index + 1}</text>

        <path d={`M${cx - 10 * dir},${bodyY - 2} Q${cx - 18 * dir},${bodyY + 8} ${cx - 15 * dir},${bodyY + 18}`}
          stroke={skin} strokeWidth={7} strokeLinecap="round" fill="none" />
        <circle cx={cx - 15 * dir} cy={bodyY + 20} r={5} fill={skin} />

        <path d={`M${cx + 10 * dir},${bodyY - 2} Q${cx + 18 * dir},${bodyY + 8} ${cx + 15 * dir},${bodyY + 18}`}
          stroke={skin} strokeWidth={7} strokeLinecap="round" fill="none" />
        <circle cx={cx + 15 * dir} cy={bodyY + 20} r={5} fill={skin} />

        <line x1={cx} y1={bodyY - 8} x2={cx} y2={headY + 18} stroke={skin} strokeWidth={9} strokeLinecap="round" />

        <g>
          <circle cx={cx} cy={headY} r={18} fill={skin} />
          <ellipse cx={cx} cy={headY - 14} rx={19} ry={11} fill={hair} />
          <ellipse cx={cx - 12} cy={headY - 6} rx={5} ry={10} fill={hair} />
          <ellipse cx={cx + 12} cy={headY - 6} rx={5} ry={10} fill={hair} />
          <rect x={cx - 20} y={headY - 14} width={40} height={7} rx={3} fill={band} />

          <line x1={cx - 9} y1={headY - 5} x2={cx - 3} y2={headY - 2} stroke="#333" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={cx + 3} y1={headY - 2} x2={cx + 9} y2={headY - 5} stroke="#333" strokeWidth={2.5} strokeLinecap="round" />

          <ellipse cx={cx - 6} cy={headY + 2} rx={3} ry={3.5} fill="white" />
          <ellipse cx={cx + 6} cy={headY + 2} rx={3} ry={3.5} fill="white" />
          <circle cx={cx - 6} cy={headY + 2} r={1.5} fill="#333" />
          <circle cx={cx + 6} cy={headY + 2} r={1.5} fill="#333" />

          <path d={`M${cx - 5},${headY + 14} Q${cx},${headY + 9} ${cx + 5},${headY + 14}`}
            stroke="#333" strokeWidth={2.5} fill="none" strokeLinecap="round" />

          <motion.line x1={cx - 9} y1={headY + 4} x2={cx - 11} y2={headY + 12 + tearDrop1Y}
            stroke="#64B5F6" strokeWidth={2} strokeLinecap="round" opacity={0.7}
            animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger }} />
          <motion.circle cx={cx - 11} cy={headY + 14 + tearDrop1Y} r={2} fill="#64B5F6" opacity={0.5}
            animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger }} />

          <motion.line x1={cx + 9} y1={headY + 4} x2={cx + 11} y2={headY + 12 + tearDrop2Y}
            stroke="#64B5F6" strokeWidth={2} strokeLinecap="round" opacity={0.7}
            animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger + 0.3 }} />
          <motion.circle cx={cx + 11} cy={headY + 14 + tearDrop2Y} r={2} fill="#64B5F6" opacity={0.5}
            animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger + 0.3 }} />
        </g>

        <motion.text x={cx + 20 * dir} y={headY - 10} fontSize={12} fill="#999" fontWeight="bold"
          animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: stagger }}>💫</motion.text>

        <motion.text x={cx - 4} y={headY - 30} fontSize={14}
          animate={{ y: [headY - 30, headY - 50], opacity: [0.8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, delay: stagger }}>😢</motion.text>
      </g>
    );
  }

  const lieY = GROUND_Y - 8;
  const headLieX = cx + 25 * dir;
  const feetLieX = cx - 30 * dir;
  const legKickAngle = Math.sin(cycle * 3) * 15;

  return (
    <g>
      <ellipse cx={cx} cy={GROUND_Y + 3} rx={35} ry={4} fill="rgba(0,0,0,0.1)" />

      <path d={`M${feetLieX},${lieY} L${feetLieX - 15 * dir},${lieY - 15 + legKickAngle}`}
        stroke={shorts} strokeWidth={11} strokeLinecap="round" fill="none" />
      <ellipse cx={feetLieX - 15 * dir} cy={lieY - 15 + legKickAngle} rx={8} ry={4} fill={shoe}
        transform={`rotate(${legKickAngle}, ${feetLieX - 15 * dir}, ${lieY - 15 + legKickAngle})`} />

      <path d={`M${feetLieX + 8 * dir},${lieY} L${feetLieX - 8 * dir},${lieY - 18 + legKickAngle * 0.7}`}
        stroke={shorts} strokeWidth={11} strokeLinecap="round" fill="none" />
      <ellipse cx={feetLieX - 8 * dir} cy={lieY - 18 + legKickAngle * 0.7} rx={8} ry={4} fill={shoe} />

      <line x1={feetLieX + 5 * dir} y1={lieY} x2={headLieX - 10 * dir} y2={lieY - 3}
        stroke={shirt} strokeWidth={22} strokeLinecap="round" />
      <line x1={feetLieX + 5 * dir} y1={lieY} x2={headLieX - 10 * dir} y2={lieY - 3}
        stroke={shirtD} strokeWidth={22} strokeLinecap="round" opacity={0.15} />
      <ellipse cx={feetLieX + 5 * dir} cy={lieY - 2} rx={4} ry={4} fill={sock} opacity={0.3} />

      <text x={(feetLieX + headLieX) / 2} y={lieY + 4} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold" opacity={0.7}>{index + 1}</text>

      <circle cx={headLieX} cy={lieY - 8} r={16} fill={skin} />
      <ellipse cx={headLieX} cy={lieY - 22} rx={17} ry={10} fill={hair} />
      <ellipse cx={headLieX - 10} cy={lieY - 14} rx={5} ry={9} fill={hair} />
      <ellipse cx={headLieX + 10} cy={lieY - 14} rx={5} ry={9} fill={hair} />
      <rect x={headLieX - 18} y={lieY - 20} width={36} height={6} rx={3} fill={band} />

      <line x1={headLieX - 7} y1={lieY - 12} x2={headLieX - 3} y2={lieY - 10}
        stroke="#333" strokeWidth={2} strokeLinecap="round" />
      <line x1={headLieX + 3} y1={lieY - 10} x2={headLieX + 7} y2={lieY - 12}
        stroke="#333" strokeWidth={2} strokeLinecap="round" />

      <circle cx={headLieX - 5} cy={lieY - 5} r={1.2} fill="#333" />
      <circle cx={headLieX + 5} cy={lieY - 5} r={1.2} fill="#333" />

      <path d={`M${headLieX - 4},${lieY + 4} Q${headLieX},${lieY} ${headLieX + 4},${lieY + 4}`}
        stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />

      <motion.line x1={headLieX - 7} y1={lieY - 3} x2={headLieX - 9} y2={lieY + 5 + tearDrop1Y}
        stroke="#64B5F6" strokeWidth={1.5} strokeLinecap="round"
        animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 0.7, delay: stagger }} />
      <motion.circle cx={headLieX - 9} cy={lieY + 7 + tearDrop1Y} r={1.5} fill="#64B5F6"
        animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ repeat: Infinity, duration: 0.7, delay: stagger }} />

      <motion.line x1={headLieX + 7} y1={lieY - 3} x2={headLieX + 9} y2={lieY + 5 + tearDrop2Y}
        stroke="#64B5F6" strokeWidth={1.5} strokeLinecap="round"
        animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 0.7, delay: stagger + 0.2 }} />
      <motion.circle cx={headLieX + 9} cy={lieY + 7 + tearDrop2Y} r={1.5} fill="#64B5F6"
        animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ repeat: Infinity, duration: 0.7, delay: stagger + 0.2 }} />

      <motion.text x={headLieX + 14 * dir} y={lieY - 20} fontSize={10}
        animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ repeat: Infinity, duration: 0.9, delay: stagger }}>💫</motion.text>

      <motion.text x={headLieX - 4} y={lieY - 30} fontSize={12}
        animate={{ y: [lieY - 30, lieY - 48], opacity: [0.7, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, delay: stagger }}>😭</motion.text>
    </g>
  );
}

function Character({ side, index, slideX, isPulling, isUrgent, isCelebrating, isWinnerSide, isLosingSide, pullCycle, fatigue }: CharProps) {
  const isBlue = side === "blue";
  const dir = isBlue ? 1 : -1;

  if (isCelebrating && isLosingSide) {
    return <LosingCharacter side={side} index={index} slideX={slideX} pullCycle={pullCycle} />;
  }

  const baseX = isBlue
    ? CENTER_X - 120 - index * CHAR_SPACING
    : CENTER_X + 120 + index * CHAR_SPACING;
  const cx = baseX + slideX;

  const stagger = index * 0.25 + (isBlue ? 0 : 0.12);
  const cycle = pullCycle + stagger * 3;
  const sin1 = Math.sin(cycle * 1.6);
  const cos1 = Math.cos(cycle * 1.6);

  const isWinning = isWinnerSide || (isBlue ? slideX < -5 : slideX > 5);
  const isTired = isLosingSide || fatigue > 0.3;

  const baseLean = isPulling
    ? (isWinning ? -32 : isTired ? -8 - fatigue * 10 : -16) + sin1 * 4
    : isCelebrating && isWinnerSide ? -5 : -3;
  const tiredSlump = isTired && isPulling ? fatigue * 12 : 0;
  const leanDeg = baseLean + tiredSlump;
  const leanRad = (leanDeg * Math.PI) / 180;

  const skin = index === 0 ? "#FDBCB4" : "#E8A87C";
  const skinD = index === 0 ? "#D4956B" : "#C68642";
  const shirt = isBlue ? (index === 0 ? "#1D4ED8" : "#2563EB") : (index === 0 ? "#B91C1C" : "#DC2626");
  const shirtD = isBlue ? "#1E40AF" : "#991B1B";
  const shorts = isBlue ? "#1E3A5F" : "#7F1D1D";
  const shoe = "#EEEEEE";
  const sock = isBlue ? "#93C5FD" : "#FCA5A5";
  const hair = index === 0 ? "#2C1810" : "#4A2C17";
  const band = isBlue ? "#60A5FA" : "#F87171";

  const feetY = GROUND_Y;
  const hipY = feetY - 55 + (isTired ? fatigue * 8 : 0);
  const shoulderY = hipY - 50 + (isTired ? fatigue * 6 : 0);
  const neckY = shoulderY - 5;
  const headCenterY = neckY - 22 + (isTired ? fatigue * 4 : 0);

  const hipCx = cx + Math.sin(leanRad) * 15 * dir;
  const shoulderCx = cx + Math.sin(leanRad) * 40 * dir;
  const neckCx = shoulderCx + Math.sin(leanRad) * 5 * dir;
  const headCx = neckCx + Math.sin(leanRad) * 8 * dir;

  const ropeGripY = shoulderY + 25;
  const hand1X = shoulderCx + 35 * dir;
  const hand2X = shoulderCx + 28 * dir;

  const legSpread = 20;
  const tiredLegExtra = isTired ? fatigue * 8 : 0;
  const frontFootX = cx + (legSpread + tiredLegExtra) * dir + (isPulling ? sin1 * 10 * dir : 0);
  const backFootX = cx - (legSpread + tiredLegExtra) * dir + (isPulling ? -cos1 * 7 * dir : 0);
  const frontKneeX = (frontFootX + hipCx) / 2 + (isPulling ? 6 * dir : 0);
  const frontKneeY = hipY + 25 + (isPulling ? sin1 * 4 : 0) + (isTired ? fatigue * 5 : 0);
  const backKneeX = (backFootX + hipCx) / 2 - (isPulling ? 4 * dir : 0);
  const backKneeY = hipY + 27 + (isPulling ? -cos1 * 4 : 0) + (isTired ? fatigue * 5 : 0);

  const celebJump = isCelebrating && isWinnerSide
    ? Math.abs(Math.sin(cycle * 3)) * -28
    : 0;

  const mouthOpen = isPulling && (isTired ? Math.abs(sin1) > 0.3 : Math.abs(sin1) > 0.65);

  const shoulderOffsetX = 12 * dir;
  const leftShoulderX = shoulderCx - shoulderOffsetX;
  const rightShoulderX = shoulderCx + shoulderOffsetX;

  return (
    <g>
      <ellipse cx={cx} cy={GROUND_Y + 3} rx={22} ry={5}
        fill="rgba(0,0,0,0.15)"
        transform={celebJump < -5 ? `translate(0, 3)` : ""}
      />

      <g transform={`translate(0, ${celebJump})`}>
        <path
          d={`M${hipCx - 4 * dir},${hipY} L${backKneeX},${backKneeY} L${backFootX},${feetY}`}
          stroke={shorts} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        <ellipse cx={backFootX} cy={feetY} rx={11} ry={5} fill={shoe} />
        <ellipse cx={backFootX} cy={feetY - 2} rx={10} ry={3} fill={sock} opacity={0.4} />

        <path
          d={`M${hipCx + 4 * dir},${hipY} L${frontKneeX},${frontKneeY} L${frontFootX},${feetY}`}
          stroke={shorts} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        <ellipse cx={frontFootX} cy={feetY} rx={11} ry={5} fill={shoe} />
        <ellipse cx={frontFootX} cy={feetY - 2} rx={10} ry={3} fill={sock} opacity={0.4} />

        <path
          d={`M${hipCx},${hipY + 5} Q${(hipCx + shoulderCx) / 2},${(hipY + shoulderY) / 2} ${shoulderCx},${shoulderY}`}
          stroke={shirt} strokeWidth={28} strokeLinecap="round" fill="none"
        />
        <path
          d={`M${hipCx},${hipY + 5} Q${(hipCx + shoulderCx) / 2},${(hipY + shoulderY) / 2} ${shoulderCx},${shoulderY}`}
          stroke={shirtD} strokeWidth={28} strokeLinecap="round" fill="none" opacity={0.15}
        />

        <line x1={leftShoulderX} y1={shoulderY} x2={rightShoulderX} y2={shoulderY}
          stroke={shirt} strokeWidth={14} strokeLinecap="round" />

        <text
          x={(hipCx + shoulderCx) / 2}
          y={(hipY + shoulderY) / 2 + 8}
          textAnchor="middle" fill="white" fontSize={14} fontWeight="bold" fontFamily="sans-serif" opacity={0.8}
        >{index + 1}</text>

        {isCelebrating && isWinnerSide ? (
          <>
            <path d={`M${leftShoulderX},${shoulderY}
                      Q${leftShoulderX - 15 * dir},${shoulderY - 25}
                       ${leftShoulderX - 22 * dir},${shoulderY - 45}`}
              stroke={skin} strokeWidth={8} strokeLinecap="round" fill="none" />
            <circle cx={leftShoulderX - 22 * dir} cy={shoulderY - 48} r={6} fill={skin} />
            <path d={`M${rightShoulderX},${shoulderY}
                      Q${rightShoulderX + 12 * dir},${shoulderY - 20}
                       ${rightShoulderX + 18 * dir},${shoulderY - 40}`}
              stroke={skin} strokeWidth={8} strokeLinecap="round" fill="none" />
            <circle cx={rightShoulderX + 18 * dir} cy={shoulderY - 43} r={6} fill={skin} />
          </>
        ) : (
          <>
            <path d={`M${rightShoulderX},${shoulderY}
                      Q${rightShoulderX + 15 * dir},${shoulderY + 10}
                       ${hand1X},${ropeGripY}`}
              stroke={shirt} strokeWidth={9} strokeLinecap="round" fill="none" />
            <path d={`M${rightShoulderX + 3 * dir},${shoulderY + 2}
                      Q${rightShoulderX + 14 * dir},${shoulderY + 12}
                       ${hand1X},${ropeGripY + 2}`}
              stroke={skin} strokeWidth={7} strokeLinecap="round" fill="none" />
            <circle cx={hand1X} cy={ropeGripY} r={6} fill={skin} />
            <circle cx={hand1X} cy={ropeGripY} r={6} fill={skinD} opacity={0.12} />

            <path d={`M${leftShoulderX},${shoulderY}
                      Q${leftShoulderX + 10 * dir},${shoulderY + 12}
                       ${hand2X},${ropeGripY + 6}`}
              stroke={shirt} strokeWidth={9} strokeLinecap="round" fill="none" />
            <path d={`M${leftShoulderX + 2 * dir},${shoulderY + 2}
                      Q${leftShoulderX + 9 * dir},${shoulderY + 14}
                       ${hand2X},${ropeGripY + 8}`}
              stroke={skin} strokeWidth={7} strokeLinecap="round" fill="none" />
            <circle cx={hand2X} cy={ropeGripY + 6} r={6} fill={skin} />
            <circle cx={hand2X} cy={ropeGripY + 6} r={6} fill={skinD} opacity={0.12} />
          </>
        )}

        <line x1={shoulderCx} y1={shoulderY - 4} x2={neckCx} y2={neckY}
          stroke={skin} strokeWidth={10} strokeLinecap="round" />

        <g>
          <circle cx={headCx} cy={headCenterY} r={20} fill={skin} />
          {isTired && isPulling && (
            <circle cx={headCx} cy={headCenterY} r={20} fill="rgba(200,50,50,0.08)" />
          )}
          <ellipse cx={headCx} cy={headCenterY - 16} rx={21} ry={12} fill={hair} />
          <ellipse cx={headCx - 14} cy={headCenterY - 8} rx={6} ry={12} fill={hair} />
          <ellipse cx={headCx + 14} cy={headCenterY - 8} rx={6} ry={12} fill={hair} />
          <rect x={headCx - 22} y={headCenterY - 16} width={44} height={8} rx={3} fill={band} />
          <path d={isBlue
            ? `M${headCx - 22},${headCenterY - 12} L${headCx - 30},${headCenterY - 4} L${headCx - 26},${headCenterY}`
            : `M${headCx + 22},${headCenterY - 12} L${headCx + 30},${headCenterY - 4} L${headCx + 26},${headCenterY}`
          } fill={band} />

          <ellipse cx={headCx - 7} cy={headCenterY} rx={3.5} ry={4} fill="white" />
          <ellipse cx={headCx + 7} cy={headCenterY} rx={3.5} ry={4} fill="white" />

          {isCelebrating && isWinnerSide ? (
            <>
              <circle cx={headCx - 7} cy={headCenterY} r={2.5} fill="#333" />
              <circle cx={headCx + 7} cy={headCenterY} r={2.5} fill="#333" />
              <circle cx={headCx - 6} cy={headCenterY - 1} r={0.8} fill="white" />
              <circle cx={headCx + 8} cy={headCenterY - 1} r={0.8} fill="white" />
              <path d={`M${headCx - 6},${headCenterY + 8} Q${headCx},${headCenterY + 16} ${headCx + 6},${headCenterY + 8}`}
                stroke="#333" strokeWidth={2.5} fill="none" strokeLinecap="round" />
            </>
          ) : isTired && isPulling ? (
            <>
              <line x1={headCx - 10} y1={headCenterY - 5} x2={headCx - 4} y2={headCenterY - 3}
                stroke={hair} strokeWidth={2.5} strokeLinecap="round" />
              <line x1={headCx + 4} y1={headCenterY - 3} x2={headCx + 10} y2={headCenterY - 5}
                stroke={hair} strokeWidth={2.5} strokeLinecap="round" />
              <ellipse cx={headCx - 7 + dir} cy={headCenterY + 1} rx={2} ry={2.5} fill="#333" />
              <ellipse cx={headCx + 7 + dir} cy={headCenterY + 1} rx={2} ry={2.5} fill="#333" />
              {mouthOpen ? (
                <ellipse cx={headCx} cy={headCenterY + 11} rx={6} ry={5} fill="#8B0000" />
              ) : (
                <path d={`M${headCx - 5},${headCenterY + 12} Q${headCx},${headCenterY + 8} ${headCx + 5},${headCenterY + 12}`}
                  stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
              )}
              <circle cx={headCx - 14} cy={headCenterY + 4} r={5} fill="#FF9999" opacity={0.35} />
              <circle cx={headCx + 14} cy={headCenterY + 4} r={5} fill="#FF9999" opacity={0.35} />
            </>
          ) : isPulling ? (
            <>
              <ellipse cx={headCx - 7 + dir} cy={headCenterY} rx={2.5} ry={3} fill="#333" />
              <ellipse cx={headCx + 7 + dir} cy={headCenterY} rx={2.5} ry={3} fill="#333" />
              <circle cx={headCx - 6 + dir} cy={headCenterY - 1} r={0.8} fill="white" />
              <circle cx={headCx + 8 + dir} cy={headCenterY - 1} r={0.8} fill="white" />
              {isUrgent && (
                <>
                  <line x1={headCx - 13} y1={headCenterY - 7} x2={headCx - 4} y2={headCenterY - 5}
                    stroke={hair} strokeWidth={2} strokeLinecap="round" />
                  <line x1={headCx + 13} y1={headCenterY - 7} x2={headCx + 4} y2={headCenterY - 5}
                    stroke={hair} strokeWidth={2} strokeLinecap="round" />
                </>
              )}
              {mouthOpen ? (
                <ellipse cx={headCx} cy={headCenterY + 10} rx={5} ry={4} fill="#8B0000" />
              ) : (
                <line x1={headCx - 5} y1={headCenterY + 9} x2={headCx + 5} y2={headCenterY + 9}
                  stroke="#333" strokeWidth={2.5} strokeLinecap="round" />
              )}
              <circle cx={headCx - 14} cy={headCenterY + 4} r={4} fill="#FF9999" opacity={0.25} />
              <circle cx={headCx + 14} cy={headCenterY + 4} r={4} fill="#FF9999" opacity={0.25} />
            </>
          ) : (
            <>
              <circle cx={headCx - 7} cy={headCenterY} r={2} fill="#333" />
              <circle cx={headCx + 7} cy={headCenterY} r={2} fill="#333" />
              <path d={`M${headCx - 4},${headCenterY + 9} Q${headCx},${headCenterY + 13} ${headCx + 4},${headCenterY + 9}`}
                stroke="#333" strokeWidth={1.5} fill="none" />
            </>
          )}
        </g>

        <SweatDrops cx={headCx} cy={headCenterY} active={isTired && isPulling} pullCycle={pullCycle} index={index} />

        {isUrgent && isPulling && !isTired && (
          <motion.g animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.5, delay: stagger }}>
            <line x1={headCx + 18 * dir} y1={headCenterY - 8} x2={headCx + 24 * dir} y2={headCenterY - 12}
              stroke="#333" strokeWidth={1.5} />
            <line x1={headCx + 20 * dir} y1={headCenterY - 2} x2={headCx + 26 * dir} y2={headCenterY - 2}
              stroke="#333" strokeWidth={1.5} />
          </motion.g>
        )}

        {isTired && isPulling && (
          <motion.g animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger }}>
            <text x={headCx + 20 * dir} y={headCenterY - 15} fontSize={10} fill="#999" fontWeight="bold">💫</text>
          </motion.g>
        )}
      </g>

      {isCelebrating && isWinnerSide && (
        <>
          {[0, 1, 2].map(i => (
            <motion.text key={`s-${side}-${index}-${i}`}
              x={cx - 12 + i * 14} y={headCenterY - 40 + celebJump}
              fontSize={12}
              animate={{ y: [headCenterY - 40 + celebJump, headCenterY - 75 + celebJump], opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 + stagger }}
            >⭐</motion.text>
          ))}
        </>
      )}
    </g>
  );
}

function TwistedRope({ slideX, isPulling, pullCycle, isCelebrating }: { slideX: number; isPulling: boolean; pullCycle: number; isCelebrating: boolean }) {
  const shoulderY = GROUND_Y - 55 - 50;
  const ropeGripY = shoulderY + 25;

  const leanDeg = isPulling ? -16 : -3;
  const leanRad = (leanDeg * Math.PI) / 180;

  const handOffset = Math.sin(leanRad) * 40 + 35;

  const blue0cx = CENTER_X - 120 + slideX;
  const blue1cx = CENTER_X - 120 - CHAR_SPACING + slideX;
  const red0cx = CENTER_X + 120 + slideX;
  const red1cx = CENTER_X + 120 + CHAR_SPACING + slideX;

  const blue0hand = blue0cx + handOffset;
  const blue1hand = blue1cx + handOffset;
  const red0hand = red0cx - handOffset;
  const red1hand = red1cx - handOffset;

  const overhang = 18;
  const leftEnd = blue1hand - overhang;
  const rightEnd = red1hand + overhang;

  const wobble = isPulling ? Math.sin(pullCycle * 4) * 1.2 : 0;
  const tension = Math.abs(slideX) / 80;
  const sag = isPulling ? 3 + (1 - tension) * 5 : 8;

  const ropeLen = rightEnd - leftEnd;
  const seg = 30;

  const blueGripFrac = (blue1hand - leftEnd) / ropeLen;
  const redGripFrac = (red1hand - leftEnd) / ropeLen;

  const getPoint = (t: number): [number, number] => {
    const px = leftEnd + ropeLen * t;
    const sagAtT = Math.sin(t * Math.PI) * sag;
    const wobbleAtT = Math.sin(t * Math.PI * 2 + pullCycle * 4) * wobble * Math.sin(t * Math.PI);

    let droop = 0;
    if (t < blueGripFrac) {
      const droopT = 1 - t / blueGripFrac;
      droop = droopT * droopT * 15;
    } else if (t > redGripFrac) {
      const droopT = (t - redGripFrac) / (1 - redGripFrac);
      droop = droopT * droopT * 15;
    }

    const py = ropeGripY + sagAtT + wobbleAtT + droop;
    return [px, py];
  };

  const mainPoints: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    mainPoints.push(getPoint(i / seg));
  }

  let mainPath = `M${mainPoints[0][0]},${mainPoints[0][1]}`;
  for (let i = 1; i < mainPoints.length; i++) {
    if (i === 1) {
      mainPath += ` L${mainPoints[i][0]},${mainPoints[i][1]}`;
    } else {
      const cpx = (mainPoints[i - 1][0] + mainPoints[i][0]) / 2;
      const cpy = (mainPoints[i - 1][1] + mainPoints[i][1]) / 2;
      mainPath += ` Q${mainPoints[i - 1][0]},${mainPoints[i - 1][1]} ${cpx},${cpy}`;
    }
  }

  const twistCount = 20;
  const twistAmp = 3;
  const strand1Points: [number, number][] = [];
  const strand2Points: [number, number][] = [];

  for (let i = 0; i <= twistCount; i++) {
    const t = i / twistCount;
    const [px, py] = getPoint(t);
    const twist = Math.sin(t * Math.PI * 10 + pullCycle * 2) * twistAmp;
    strand1Points.push([px, py + twist]);
    strand2Points.push([px, py - twist]);
  }

  const buildPath = (pts: [number, number][]) => {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const cpx = (pts[i - 1][0] + pts[i][0]) / 2;
      const cpy = (pts[i - 1][1] + pts[i][1]) / 2;
      d += ` Q${pts[i - 1][0]},${pts[i - 1][1]} ${cpx},${cpy}`;
    }
    return d;
  };

  const s1Path = buildPath(strand1Points);
  const s2Path = buildPath(strand2Points);

  if (isCelebrating) {
    const fallenY = GROUND_Y - 2;
    const fallenSag = 4;
    const fallenPoints: [number, number][] = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const px = leftEnd + ropeLen * t;
      const waveSag = Math.sin(t * Math.PI * 3) * fallenSag;
      fallenPoints.push([px, fallenY + waveSag]);
    }
    let fallenPath = `M${fallenPoints[0][0]},${fallenPoints[0][1]}`;
    for (let i = 1; i < fallenPoints.length; i++) {
      const cpx = (fallenPoints[i - 1][0] + fallenPoints[i][0]) / 2;
      const cpy = (fallenPoints[i - 1][1] + fallenPoints[i][1]) / 2;
      fallenPath += ` Q${fallenPoints[i - 1][0]},${fallenPoints[i - 1][1]} ${cpx},${cpy}`;
    }

    return (
      <motion.g
        initial={{ y: 0 }}
        animate={{ y: fallenY - ropeGripY }}
        transition={{ duration: 0.6, ease: "easeIn" }}
      >
        <path d={mainPath} stroke="#3E2723" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.15} />
        <path d={mainPath} stroke="#8D6E3C" strokeWidth={7} fill="none" strokeLinecap="round" />
        <path d={s1Path} stroke="#C9A54A" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
        <path d={s2Path} stroke="#A07A3A" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.6} />
        <g transform={`translate(${slideX}, 0)`}>
          <rect x={CENTER_X - 5} y={ropeGripY - 5} width={10} height={16} rx={3} fill="#E53E3E" />
          <rect x={CENTER_X - 6} y={ropeGripY - 8} width={12} height={5} rx={2} fill="#C53030" />
        </g>
      </motion.g>
    );
  }

  return (
    <g>
      <path d={mainPath} stroke="#3E2723" strokeWidth={9} fill="none" strokeLinecap="round" opacity={0.15} />

      <path d={mainPath} stroke="#8D6E3C" strokeWidth={7} fill="none" strokeLinecap="round" />

      <path d={s1Path} stroke="#C9A54A" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
      <path d={s2Path} stroke="#A07A3A" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.6} />

      <path d={mainPath} stroke="#D4B06A" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.3} />

      {Array.from({ length: 12 }).map((_, i) => {
        const t = (i + 0.5) / 12;
        const [px, py] = getPoint(t);
        const angle = Math.atan2(
          getPoint(Math.min(t + 0.03, 1))[1] - getPoint(Math.max(t - 0.03, 0))[1],
          getPoint(Math.min(t + 0.03, 1))[0] - getPoint(Math.max(t - 0.03, 0))[0]
        );
        const perpAngle = angle + Math.PI / 2;
        const dx = Math.cos(perpAngle) * 3;
        const dy = Math.sin(perpAngle) * 3;
        return (
          <line key={i} x1={px - dx} y1={py - dy} x2={px + dx} y2={py + dy}
            stroke="#5D4037" strokeWidth={0.8} opacity={0.25} />
        );
      })}

      <g transform={`translate(${slideX}, 0)`}>
        <rect x={CENTER_X - 5} y={ropeGripY - 5} width={10} height={16} rx={3} fill="#E53E3E" />
        <rect x={CENTER_X - 6} y={ropeGripY - 8} width={12} height={5} rx={2} fill="#C53030" />
      </g>

      {isPulling && tension > 0.35 && (
        <motion.g animate={{ opacity: [0.15, 0.5, 0.15] }} transition={{ repeat: Infinity, duration: 0.2 }}>
          {[0.3, 0.5, 0.7].map((t, i) => {
            const [px] = getPoint(t);
            return <line key={i} x1={px - 3} y1={ropeGripY - 5} x2={px + 3} y2={ropeGripY + 5} stroke="#FFD700" strokeWidth={1.5} opacity={0.4} />;
          })}
        </motion.g>
      )}
    </g>
  );
}

function CenterLine() {
  return (
    <g>
      {/* Ground center line - horizontal white stripe on the dirt */}
      <rect x={CENTER_X - 4} y={GROUND_Y - 2} width={8} height={24} rx={2} fill="white" opacity={0.9} />
      <rect x={CENTER_X - 22} y={GROUND_Y + 2} width={44} height={6} rx={3} fill="white" opacity={0.7} />
      <rect x={CENTER_X - 14} y={GROUND_Y + 10} width={28} height={4} rx={2} fill="white" opacity={0.4} />
      {/* Small flag post at ground */}
      <line x1={CENTER_X} y1={GROUND_Y - 2} x2={CENTER_X} y2={GROUND_Y - 28}
        stroke="white" strokeWidth={2.5} opacity={0.8} />
      <polygon points={`${CENTER_X},${GROUND_Y - 28} ${CENTER_X},${GROUND_Y - 16} ${CENTER_X + 16},${GROUND_Y - 22}`}
        fill="#ef4444" opacity={0.95} />
    </g>
  );
}

function Arena() {
  return (
    <g>
      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E88E5" />
          <stop offset="40%" stopColor="#42A5F5" />
          <stop offset="100%" stopColor="#90CAF9" />
        </linearGradient>
        <linearGradient id="grassG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#43A047" />
          <stop offset="40%" stopColor="#388E3C" />
          <stop offset="100%" stopColor="#1B5E20" />
        </linearGradient>
        <linearGradient id="dirtG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4B07A" />
          <stop offset="100%" stopColor="#A0845C" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={1000} height={GROUND_Y} fill="url(#skyG)" />
      <circle cx={900} cy={50} r={40} fill="#FFF9C4" opacity={0.3} />
      <circle cx={900} cy={50} r={20} fill="#FFF9C4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <line key={i}
          x1={900 + Math.cos(a * Math.PI / 180) * 26} y1={50 + Math.sin(a * Math.PI / 180) * 26}
          x2={900 + Math.cos(a * Math.PI / 180) * 36} y2={50 + Math.sin(a * Math.PI / 180) * 36}
          stroke="#FFE082" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      ))}
      <ellipse cx={100} cy={60} rx={48} ry={16} fill="white" opacity={0.75} />
      <ellipse cx={128} cy={57} rx={35} ry={13} fill="white" opacity={0.6} />
      <ellipse cx={500} cy={75} rx={52} ry={14} fill="white" opacity={0.5} />
      <rect x={0} y={GROUND_Y - 5} width={1000} height={60} fill="url(#grassG)" />
      <rect x={130} y={GROUND_Y - 3} width={740} height={40} rx={5} fill="url(#dirtG)" opacity={0.4} />
      {Array.from({ length: 28 }).map((_, i) => {
        const gx = 8 + i * 32;
        return <line key={i} x1={gx} y1={GROUND_Y - 3} x2={gx + (i % 2 === 0 ? 2 : -2)} y2={GROUND_Y - 8 - (i % 3) * 3}
          stroke="#66BB6A" strokeWidth={1.5} opacity={0.35} />;
      })}
      {[20, 975].map((tx, ti) => (
        <g key={ti}>
          <rect x={tx - 3} y={GROUND_Y - 40} width={6} height={44} rx={2} fill="#795548" />
          <ellipse cx={tx} cy={GROUND_Y - 52} rx={18} ry={22} fill="#388E3C" opacity={0.4} />
          <ellipse cx={tx - 5} cy={GROUND_Y - 57} rx={12} ry={16} fill="#4CAF50" opacity={0.3} />
        </g>
      ))}
    </g>
  );
}

function DustCloud({ isPulling, pullCycle }: { isPulling: boolean; pullCycle: number }) {
  if (!isPulling) return null;
  return (
    <g>
      {Array.from({ length: 14 }).map((_, i) => {
        const bx = 100 + i * 50;
        const ph = (pullCycle * 2.5 + i * 0.9) % (Math.PI * 2);
        if (Math.sin(ph) < 0) return null;
        return <circle key={i} cx={bx + Math.cos(ph + i) * 5} cy={GROUND_Y - Math.sin(ph) * 10 + 2}
          r={2 + Math.sin(ph) * 2} fill="#C9A96E" opacity={Math.sin(ph) * 0.3} />;
      })}
    </g>
  );
}

function SVGConfetti({ active }: { active: boolean }) {
  if (!active) return null;
  const p = Array.from({ length: 24 }).map((_, i) => ({
    x: 60 + Math.random() * 880,
    c: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF7F50"][i % 8],
    s: 3 + Math.random() * 4,
    d: 1.2 + Math.random() * 1.5,
    dl: Math.random() * 2,
  }));
  return (
    <g>
      {p.map((c, i) => (
        <motion.rect key={i} x={c.x} y={-20} width={c.s} height={c.s * 0.5} rx={1} fill={c.c}
          animate={{ y: [-20, GROUND_Y + 20], x: [c.x, c.x + Math.sin(i) * 40], rotate: [0, i % 2 === 0 ? 360 : -360], opacity: [1, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: c.d, delay: c.dl, ease: "linear" }}
        />
      ))}
    </g>
  );
}

export function CartoonTugScene({ ropePos, isPulling, isUrgent, isCelebrating, winnerSide }: CartoonTugSceneProps) {
  // When celebrating, losing team slides extra toward winner (retreats past center line)
  const baseSlideX = (ropePos - 50) * 4.5;
  const retreatOffset = isCelebrating && winnerSide ? (winnerSide === "blue" ? -120 : 120) : 0;
  const slideX = baseSlideX + retreatOffset;
  const blueFatigue = Math.max(0, Math.min(1, (ropePos - 50) / 40));
  const redFatigue = Math.max(0, Math.min(1, (50 - ropePos) / 40));
  const [pullCycle, setPullCycle] = useState(0);
  const animRef = useRef(0);
  const mountedRef = useRef(true);

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

  const blueIsLosing = winnerSide === "red" || ropePos > 55;
  const redIsLosing = winnerSide === "blue" || ropePos < 45;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl select-none border-2 border-white/20 shadow-xl">
      <svg viewBox="0 0 1000 360" className="w-full h-auto block">
        <Arena />
        <CenterLine />
        <DustCloud isPulling={isPulling} pullCycle={pullCycle} />

        {[1, 0].map(i => (
          <Character key={`blue-${i}`} side="blue" index={i} slideX={slideX}
            isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating}
            isWinnerSide={winnerSide === "blue"} isLosingSide={blueIsLosing}
            pullCycle={pullCycle} fatigue={blueFatigue} />
        ))}

        <TwistedRope slideX={slideX} isPulling={isPulling} pullCycle={pullCycle} isCelebrating={isCelebrating} />

        {[1, 0].map(i => (
          <Character key={`red-${i}`} side="red" index={i} slideX={slideX}
            isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating}
            isWinnerSide={winnerSide === "red"} isLosingSide={redIsLosing}
            pullCycle={pullCycle} fatigue={redFatigue} />
        ))}

        <SVGConfetti active={isCelebrating && winnerSide !== null} />
      </svg>
    </div>
  );
}
