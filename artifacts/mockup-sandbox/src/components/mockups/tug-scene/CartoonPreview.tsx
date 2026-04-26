import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

const GROUND_Y = 345;
const CENTER_X = 350;
const CHAR_SPACING = 80;

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

  const baseX = isBlue
    ? CENTER_X - 90 - index * CHAR_SPACING
    : CENTER_X + 90 + index * CHAR_SPACING;
  const cx = baseX + slideX;

  const stagger = index * 0.25 + (isBlue ? 0 : 0.12);
  const cycle = pullCycle + stagger * 3;
  const sin1 = Math.sin(cycle * 1.6);
  const cos1 = Math.cos(cycle * 1.6);

  const isWinning = isWinnerSide || (isBlue ? slideX < -5 : slideX > 5);
  const leanDeg = isPulling
    ? (isWinning ? -32 : -16) + sin1 * 4
    : isCelebrating && isWinnerSide ? -5 : -3;
  const leanRad = (leanDeg * Math.PI) / 180;

  const skin = index === 0 ? "#FDBCB4" : "#E8A87C";
  const skinD = index === 0 ? "#D4956B" : "#C68642";
  const shirt = isBlue ? (index === 0 ? "#2563EB" : "#3B82F6") : (index === 0 ? "#DC2626" : "#EF4444");
  const shirtD = isBlue ? "#1D4ED8" : "#B91C1C";
  const shorts = isBlue ? "#1E3A5F" : "#7F1D1D";
  const shoe = "#EEEEEE";
  const sock = isBlue ? "#93C5FD" : "#FCA5A5";
  const hair = index === 0 ? "#2C1810" : "#4A2C17";
  const band = isBlue ? "#60A5FA" : "#F87171";

  const feetY = GROUND_Y;
  const hipY = feetY - 55;
  const shoulderY = hipY - 50;
  const neckY = shoulderY - 5;
  const headCenterY = neckY - 22;

  const hipCx = cx + Math.sin(leanRad) * 15 * dir;
  const shoulderCx = cx + Math.sin(leanRad) * 40 * dir;
  const neckCx = shoulderCx + Math.sin(leanRad) * 5 * dir;
  const headCx = neckCx + Math.sin(leanRad) * 8 * dir;

  const ropeGripY = shoulderY + 25;
  const hand1X = shoulderCx + 35 * dir;
  const hand2X = shoulderCx + 28 * dir;

  const legSpread = 20;
  const frontFootX = cx + legSpread * dir + (isPulling ? sin1 * 10 * dir : 0);
  const backFootX = cx - legSpread * dir + (isPulling ? -cos1 * 7 * dir : 0);
  const frontKneeX = (frontFootX + hipCx) / 2 + (isPulling ? 6 * dir : 0);
  const frontKneeY = hipY + 25 + (isPulling ? sin1 * 4 : 0);
  const backKneeX = (backFootX + hipCx) / 2 - (isPulling ? 4 * dir : 0);
  const backKneeY = hipY + 27 + (isPulling ? -cos1 * 4 : 0);

  const celebJump = isCelebrating && isWinnerSide
    ? Math.abs(Math.sin(cycle * 3)) * -28
    : 0;

  const mouthOpen = isPulling && Math.abs(sin1) > 0.65;

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

        {isUrgent && isPulling && (
          <motion.g animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.5, delay: stagger }}>
            <line x1={headCx + 18 * dir} y1={headCenterY - 8} x2={headCx + 24 * dir} y2={headCenterY - 12}
              stroke="#333" strokeWidth={1.5} />
            <line x1={headCx + 20 * dir} y1={headCenterY - 2} x2={headCx + 26 * dir} y2={headCenterY - 2}
              stroke="#333" strokeWidth={1.5} />
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

function RopeComplete({ slideX, isPulling, pullCycle }: { slideX: number; isPulling: boolean; pullCycle: number }) {
  const shoulderY = GROUND_Y - 55 - 50;
  const ropeGripY = shoulderY + 25;

  const blueChar0X = CENTER_X - 90 + slideX;
  const redChar0X = CENTER_X + 90 + slideX;

  const leanBlue = isPulling ? 0.55 : 0.12;
  const leanRed = isPulling ? -0.55 : -0.12;
  const blueHandX = blueChar0X + Math.sin(leanBlue) * 40 + 35;
  const redHandX = redChar0X + Math.sin(leanRed) * 40 - 35;

  const tailLeft = CENTER_X - 90 - CHAR_SPACING + slideX - 60;
  const tailRight = CENTER_X + 90 + CHAR_SPACING + slideX + 60;

  const midX = (blueHandX + redHandX) / 2;
  const tension = Math.abs(slideX) / 80;
  const sag = isPulling ? 2 + (1 - tension) * 5 : 7;
  const wobble = isPulling ? Math.sin(pullCycle * 4) * 1.5 : 0;

  return (
    <g>
      <path
        d={`M${tailLeft},${ropeGripY + 18} Q${tailLeft + 30},${ropeGripY + 10} ${blueHandX - 15},${ropeGripY + 2}`}
        stroke="#A0845C" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.5}
      />
      <line x1={tailLeft - 6} y1={ropeGripY + 22} x2={tailLeft} y2={ropeGripY + 18} stroke="#8B6914" strokeWidth={2} opacity={0.4} />
      <line x1={tailLeft - 3} y1={ropeGripY + 26} x2={tailLeft} y2={ropeGripY + 18} stroke="#8B6914" strokeWidth={2} opacity={0.4} />
      <line x1={tailLeft - 8} y1={ropeGripY + 16} x2={tailLeft} y2={ropeGripY + 18} stroke="#8B6914" strokeWidth={2} opacity={0.4} />

      <path
        d={`M${blueHandX - 15},${ropeGripY + 2}
            L${blueHandX},${ropeGripY}
            Q${midX - 60},${ropeGripY + sag + wobble}
             ${midX},${ropeGripY + sag * 0.5 + wobble * 0.5}
            Q${midX + 60},${ropeGripY + sag - wobble}
             ${redHandX},${ropeGripY}
            L${redHandX + 15},${ropeGripY + 2}`}
        stroke="#5D4037" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.2}
      />
      <path
        d={`M${blueHandX - 15},${ropeGripY + 2}
            L${blueHandX},${ropeGripY}
            Q${midX - 60},${ropeGripY + sag + wobble}
             ${midX},${ropeGripY + sag * 0.5 + wobble * 0.5}
            Q${midX + 60},${ropeGripY + sag - wobble}
             ${redHandX},${ropeGripY}
            L${redHandX + 15},${ropeGripY + 2}`}
        stroke="#C9A54A" strokeWidth={5} fill="none" strokeLinecap="round"
      />
      <path
        d={`M${blueHandX},${ropeGripY - 1}
            Q${midX - 60},${ropeGripY + sag + wobble - 2}
             ${midX},${ropeGripY + sag * 0.5 - 2}
            Q${midX + 60},${ropeGripY + sag - wobble - 2}
             ${redHandX},${ropeGripY - 1}`}
        stroke="#E8D08A" strokeWidth={1.5} fill="none" opacity={0.4}
      />

      {isPulling && [0.25, 0.5, 0.75].map((t, i) => {
        const px = blueHandX + (redHandX - blueHandX) * t;
        return <g key={i} opacity={0.2}><line x1={px - 1} y1={ropeGripY - 2} x2={px + 1} y2={ropeGripY + 4} stroke="#8B6914" strokeWidth={1} /></g>;
      })}

      <path
        d={`M${redHandX + 15},${ropeGripY + 2} Q${tailRight - 30},${ropeGripY + 10} ${tailRight},${ropeGripY + 18}`}
        stroke="#A0845C" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.5}
      />
      <line x1={tailRight} y1={ropeGripY + 18} x2={tailRight + 6} y2={ropeGripY + 22} stroke="#8B6914" strokeWidth={2} opacity={0.4} />
      <line x1={tailRight} y1={ropeGripY + 18} x2={tailRight + 3} y2={ropeGripY + 26} stroke="#8B6914" strokeWidth={2} opacity={0.4} />
      <line x1={tailRight} y1={ropeGripY + 18} x2={tailRight + 8} y2={ropeGripY + 16} stroke="#8B6914" strokeWidth={2} opacity={0.4} />

      <g transform={`translate(${slideX}, 0)`}>
        <rect x={CENTER_X - 5} y={ropeGripY - 5} width={10} height={16} rx={3} fill="#E53E3E" />
        <rect x={CENTER_X - 6} y={ropeGripY - 8} width={12} height={5} rx={2} fill="#C53030" />
      </g>

      {isPulling && tension > 0.35 && (
        <motion.g animate={{ opacity: [0.15, 0.5, 0.15] }} transition={{ repeat: Infinity, duration: 0.2 }}>
          {[0.3, 0.5, 0.7].map((t, i) => {
            const px = blueHandX + (redHandX - blueHandX) * t;
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
      <rect x={CENTER_X - 3} y={GROUND_Y - 40} width={6} height={80} rx={2} fill="#FFD700" opacity={0.85} />
      <rect x={CENTER_X - 1} y={GROUND_Y - 40} width={2} height={80} fill="white" opacity={0.4} />
      <line x1={CENTER_X - 18} y1={GROUND_Y - 40} x2={CENTER_X + 18} y2={GROUND_Y - 40}
        stroke="#FFD700" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <line x1={CENTER_X - 18} y1={GROUND_Y + 40} x2={CENTER_X + 18} y2={GROUND_Y + 40}
        stroke="#FFD700" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <polygon points={`${CENTER_X},${GROUND_Y - 48} ${CENTER_X - 9},${GROUND_Y - 38} ${CENTER_X + 9},${GROUND_Y - 38}`}
        fill="#FFD700" opacity={0.8} />
      <motion.circle cx={CENTER_X} cy={GROUND_Y - 46} r={5}
        fill="none" stroke="#FFD700" strokeWidth={1.5}
        animate={{ opacity: [0.3, 0.8, 0.3], r: [5, 8, 5] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
    </g>
  );
}

function Arena() {
  return (
    <g>
      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4FA8E0" />
          <stop offset="40%" stopColor="#87CEEB" />
          <stop offset="100%" stopColor="#D4EFFA" />
        </linearGradient>
        <linearGradient id="grassG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ABF4B" />
          <stop offset="40%" stopColor="#4CAF50" />
          <stop offset="100%" stopColor="#2E7D32" />
        </linearGradient>
        <linearGradient id="dirtG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4B07A" />
          <stop offset="100%" stopColor="#A0845C" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={700} height={GROUND_Y} fill="url(#skyG)" />
      <circle cx={620} cy={50} r={40} fill="#FFF9C4" opacity={0.3} />
      <circle cx={620} cy={50} r={20} fill="#FFF9C4" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
        <line key={i}
          x1={620 + Math.cos(a * Math.PI / 180) * 26} y1={50 + Math.sin(a * Math.PI / 180) * 26}
          x2={620 + Math.cos(a * Math.PI / 180) * 36} y2={50 + Math.sin(a * Math.PI / 180) * 36}
          stroke="#FFE082" strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      ))}
      <ellipse cx={100} cy={60} rx={48} ry={16} fill="white" opacity={0.75} />
      <ellipse cx={128} cy={57} rx={35} ry={13} fill="white" opacity={0.6} />
      <ellipse cx={400} cy={75} rx={52} ry={14} fill="white" opacity={0.5} />
      <rect x={0} y={GROUND_Y - 5} width={700} height={70} fill="url(#grassG)" />
      <rect x={130} y={GROUND_Y - 3} width={440} height={40} rx={5} fill="url(#dirtG)" opacity={0.4} />
      {Array.from({ length: 22 }).map((_, i) => {
        const gx = 8 + i * 32;
        return <line key={i} x1={gx} y1={GROUND_Y - 3} x2={gx + (i % 2 === 0 ? 2 : -2)} y2={GROUND_Y - 8 - (i % 3) * 3}
          stroke="#66BB6A" strokeWidth={1.5} opacity={0.35} />;
      })}
      {[20, 675].map((tx, ti) => (
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
      {Array.from({ length: 10 }).map((_, i) => {
        const bx = 120 + i * 46;
        const ph = (pullCycle * 2.5 + i * 0.9) % (Math.PI * 2);
        if (Math.sin(ph) < 0) return null;
        return <circle key={i} cx={bx + Math.cos(ph + i) * 5} cy={GROUND_Y - Math.sin(ph) * 10 + 2}
          r={2 + Math.sin(ph) * 2} fill="#C9A96E" opacity={Math.sin(ph) * 0.3} />;
      })}
    </g>
  );
}

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const p = Array.from({ length: 20 }).map((_, i) => ({
    x: 80 + Math.random() * 540,
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

function ScoreHUD({ slideX }: { slideX: number }) {
  const bluePower = Math.round(Math.max(0, Math.min(100, 50 - slideX * 0.625)));
  const redPower = 100 - bluePower;
  return (
    <g>
      <rect x={10} y={10} width={130} height={38} rx={12} fill="#1E40AF" opacity={0.92} />
      <text x={75} y={35} textAnchor="middle" fill="white" fontSize={15} fontWeight="bold" fontFamily="sans-serif">🔵 الأزرق</text>
      <rect x={560} y={10} width={130} height={38} rx={12} fill="#991B1B" opacity={0.92} />
      <text x={625} y={35} textAnchor="middle" fill="white" fontSize={15} fontWeight="bold" fontFamily="sans-serif">🔴 الأحمر</text>
      <rect x={230} y={12} width={240} height={34} rx={10} fill="rgba(0,0,0,0.7)" />
      <rect x={235} y={17} width={230} height={24} rx={7} fill="rgba(0,0,0,0.3)" />
      <motion.rect x={235} y={17} height={24} rx={7} fill="#3B82F6"
        animate={{ width: (bluePower / 100) * 230 }} transition={{ duration: 0.3 }} />
      <text x={350} y={35} textAnchor="middle" fill="white" fontSize={13} fontWeight="bold" fontFamily="monospace">
        {bluePower} : {redPower}
      </text>
    </g>
  );
}

export function CartoonPreview() {
  const [slideX, setSlideX] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [winnerSide, setWinnerSide] = useState<"blue" | "red" | null>(null);
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

  useEffect(() => {
    mountedRef.current = true;
    const run = async () => {
      if (!mountedRef.current) return;
      await d(1500);
      if (!mountedRef.current) return;
      setIsPulling(true);

      for (let i = 0; i < 5; i++) { await d(650); if (!mountedRef.current) return; setSlideX(p => p + 4 + Math.random() * 3); }
      for (let i = 0; i < 3; i++) { await d(600); if (!mountedRef.current) return; setSlideX(p => p - 5 - Math.random() * 2); }
      for (let i = 0; i < 4; i++) { await d(550); if (!mountedRef.current) return; setSlideX(p => p + 3 + Math.random() * 3); }

      if (!mountedRef.current) return; setIsUrgent(true);
      for (let i = 0; i < 5; i++) { await d(350); if (!mountedRef.current) return; setSlideX(p => p + 6 + Math.random() * 4); }
      if (!mountedRef.current) return; setIsUrgent(false);

      for (let i = 0; i < 3; i++) { await d(500); if (!mountedRef.current) return; setSlideX(p => p - 4 - Math.random() * 2); }
      for (let i = 0; i < 6; i++) { await d(350); if (!mountedRef.current) return; setSlideX(p => p + 5 + Math.random() * 3); }

      if (!mountedRef.current) return;
      setIsPulling(false);
      setIsCelebrating(true);
      setWinnerSide("red");
      await d(4500);

      if (!mountedRef.current) return;
      setIsCelebrating(false); setWinnerSide(null); setSlideX(0);
      await d(2000);
      if (mountedRef.current) run();
    };
    run();
    return () => { mountedRef.current = false; };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-200 via-sky-100 to-green-100 flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div className="w-full max-w-full sm:max-w-3xl md:max-w-5xl">
        <div className="text-center mb-3 sm:mb-5">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-800">⚡ شد الحبل ⚡</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-2">الفريق الأحمر يسحب الأزرق — المسحوب يخسر</p>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border-4 border-amber-300" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
          <svg viewBox="0 0 700 400" className="w-full h-auto" style={{ display: "block", minHeight: "280px" }}>
            <Arena />
            <CenterLine />
            <RopeComplete slideX={slideX} isPulling={isPulling} pullCycle={pullCycle} />
            <DustCloud isPulling={isPulling} pullCycle={pullCycle} />
            <Character side="blue" index={1} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "blue"} pullCycle={pullCycle} />
            <Character side="red" index={1} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "red"} pullCycle={pullCycle} />
            <Character side="blue" index={0} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "blue"} pullCycle={pullCycle} />
            <Character side="red" index={0} slideX={slideX} isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating} isWinnerSide={winnerSide === "red"} pullCycle={pullCycle} />
            <Confetti active={isCelebrating} />
            <ScoreHUD slideX={slideX} />
          </svg>
        </div>
        <div className="mt-5 flex justify-center gap-3 flex-wrap text-sm">
          <div className={`px-4 py-2 rounded-full font-bold shadow-lg ${isPulling && !isUrgent && !isCelebrating ? "bg-amber-400 text-amber-900" : "bg-gray-100 text-gray-400"}`}>💪 سحب</div>
          <div className={`px-4 py-2 rounded-full font-bold shadow-lg ${isUrgent ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 text-gray-400"}`}>⚠ استعجال</div>
          <div className={`px-4 py-2 rounded-full font-bold shadow-lg ${isCelebrating ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400"}`}>🏆 فوز الأحمر</div>
        </div>
      </div>
    </div>
  );
}

function d(ms: number) { return new Promise(r => setTimeout(r, ms)); }
