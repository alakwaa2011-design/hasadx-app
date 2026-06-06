import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

const GROUND_Y = 310;
const CENTER_X = 500;
const CHAR_SPACING = 100;

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
  /** Transient reactive nudge fired on each answer / big pull (presentational only). */
  impulse?: TugImpulse | null;
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

// Stable per-athlete build/skin/hair variety. Keyed by side+index so each of the
// four visible players is subtly distinct (height, shoulder width, skin, hair)
// without random per-frame jitter. Team colours live in `palette`, untouched.
const VARIANTS: Record<"blue" | "red", ReadonlyArray<{
  legLen: number; torso: number; shoulder: number;
  skin: string; skinHi: string; skinD: string; hair: string; fringe: boolean;
}>> = {
  blue: [
    { legLen: 5, torso: 4, shoulder: 3, skin: "#F3B68E", skinHi: "#FCD9BE", skinD: "#C9784F", hair: "#241008", fringe: false },
    { legLen: -3, torso: -1, shoulder: -1, skin: "#E6A074", skinHi: "#F6C9A4", skinD: "#B96A40", hair: "#3C2616", fringe: true },
  ],
  red: [
    { legLen: 1, torso: 2, shoulder: 0, skin: "#DDA06A", skinHi: "#F3C896", skinD: "#AC6A3E", hair: "#2A1810", fringe: true },
    { legLen: -4, torso: 3, shoulder: 4, skin: "#CE9059", skinHi: "#EBBC86", skinD: "#9C5E35", hair: "#1C1009", fringe: false },
  ],
};

function Character({ side, index, slideX, isPulling, isUrgent, isCelebrating, isWinnerSide, isLosingSide, pullCycle, fatigue }: CharProps) {
  const isBlue = side === "blue";
  const dir = isBlue ? 1 : -1;

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
    ? (isWinning ? -45 : isTired ? -24 - fatigue * 9 : -36) + sin1 * 2.5
    : isCelebrating && isWinnerSide ? -5
    : isCelebrating && isLosingSide ? 16   // defeated slump forward
    : -3;
  const tiredSlump = isTired && isPulling ? fatigue * 12 : 0;
  const leanDeg = baseLean + tiredSlump;
  const leanRad = (leanDeg * Math.PI) / 180;

  // ── Per-athlete variety ──────────────────────────────────────────────────
  // Each of the 4 players gets a stable build/skin/hair seeded by side+index, so
  // a team reads as real people instead of clones. Deterministic (no per-frame
  // randomness). Team colours are NOT touched — only build, skin and hair vary.
  const v = VARIANTS[side][index] ?? VARIANTS[side][0];
  const skin = v.skin;
  const skinHi = v.skinHi;
  const skinD = v.skinD;
  const hair = v.hair;
  const uid = `${side}${index}`;
  const palette = isBlue
    ? {
      jersey: index === 0 ? "#1D4ED8" : "#2563EB",
      jerseyHi: "#3B82F6",
      jerseyDark: "#0F2F7A",
      jerseyLight: "#F8FAFC",
      shorts: "#082F6F",
      shortsDark: "#051C44",
      sock: "#DBEAFE",
      band: "#EAF2FF",
      bandTail: "#60A5FA",
      shoe: "#F8FAFC",
      sole: "#1E3A8A",
    }
    : {
      jersey: index === 0 ? "#DC2626" : "#EF4444",
      jerseyHi: "#F87171",
      jerseyDark: "#7F1D1D",
      jerseyLight: "#F8FAFC",
      shorts: "#5F1111",
      shortsDark: "#3E0B0B",
      sock: "#FEE2E2",
      band: "#2F0B0B",
      bandTail: "#F87171",
      shoe: "#F8FAFC",
      sole: "#7F1D1D",
    };

  const feetY = GROUND_Y;
  // v.legLen / v.torso give each athlete a slightly different height & build.
  const hipY = feetY - (55 + v.legLen) + (isTired ? fatigue * 8 : 0);
  const shoulderY = hipY - (50 + v.torso) + (isTired ? fatigue * 6 : 0);
  const neckY = shoulderY - 5;
  const headCenterY = neckY - 25 + (isTired ? fatigue * 4 : 0);

  const hipCx = cx + Math.sin(leanRad) * 15 * dir;
  const shoulderCx = cx + Math.sin(leanRad) * 40 * dir;
  const neckCx = shoulderCx + Math.sin(leanRad) * 5 * dir;
  const headCx = neckCx + Math.sin(leanRad) * 8 * dir;

  const ropeGripY = shoulderY + 25;
  const hand1X = shoulderCx + 35 * dir;
  const hand2X = shoulderCx + 28 * dir;

  const legSpread = isPulling ? 29 : 24;
  const tiredLegExtra = isTired ? fatigue * 8 : 0;
  const frontFootX = cx + (legSpread + tiredLegExtra) * dir + (isPulling ? (sin1 * 7 + 4) * dir : 0);
  const backFootX = cx - (legSpread + tiredLegExtra) * dir + (isPulling ? (-cos1 * 5 - 4) * dir : 0);
  const frontKneeX = (frontFootX + hipCx) / 2 + (isPulling ? 10 * dir : 0);
  const frontKneeY = hipY + 31 + (isPulling ? sin1 * 3 : 0) + (isTired ? fatigue * 5 : 0);
  const backKneeX = (backFootX + hipCx) / 2 - (isPulling ? 9 * dir : 0);
  const backKneeY = hipY + 33 + (isPulling ? -cos1 * 3 : 0) + (isTired ? fatigue * 5 : 0);

  const celebJump = isCelebrating && isWinnerSide
    ? Math.abs(Math.sin(cycle * 3)) * -28
    : 0;

  const mouthOpen = isPulling && (isTired ? Math.abs(sin1) > 0.3 : Math.abs(sin1) > 0.65);

  const shoulderOffsetX = (15 + v.shoulder) * dir;
  const leftShoulderX = shoulderCx - shoulderOffsetX;
  const rightShoulderX = shoulderCx + shoulderOffsetX;
  const bounce = isCelebrating && isWinnerSide ? Math.sin(cycle * 3) * 3 : 0;
  const pullShake = isPulling ? Math.sin(cycle * 2.4) * 1.4 : Math.sin(cycle * 0.9 + index) * 0.7;

  return (
    <g>
      {/* Per-athlete gradients (unique IDs avoid cross-character collisions) for
          a less flat, more premium cartoon look. */}
      <defs>
        <linearGradient id={`jg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.jerseyHi} />
          <stop offset="50%" stopColor={palette.jersey} />
          <stop offset="100%" stopColor={palette.jerseyDark} />
        </linearGradient>
        <radialGradient id={`sg-${uid}`} cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor={skinHi} />
          <stop offset="62%" stopColor={skin} />
          <stop offset="100%" stopColor={skinD} />
        </radialGradient>
        <linearGradient id={`pg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.shorts} />
          <stop offset="100%" stopColor={palette.shortsDark} />
        </linearGradient>
      </defs>
      <ellipse cx={cx} cy={GROUND_Y + 4} rx={31} ry={7}
        fill="rgba(0,0,0,0.28)"
        transform={celebJump < -5 ? `translate(0, 3)` : ""}
      />
      <ellipse cx={cx + 3 * dir} cy={GROUND_Y + 2} rx={21} ry={4}
        fill={isBlue ? "rgba(59,130,246,0.18)" : "rgba(239,68,68,0.18)"}
      />

      <motion.g
        animate={
          isCelebrating && isWinnerSide
            ? { y: [0, -22, -8, -18, 0], rotate: [0, -2.5 * dir, 1.8 * dir, -1.2 * dir, 0] }
            : isCelebrating && isLosingSide
              ? { y: [0, 3, 1, 3, 0], x: [0, 0.6 * dir, -0.4 * dir, 0.6 * dir, 0] }
              : isPulling
                ? { y: celebJump + bounce, x: pullShake * dir, rotate: [0, -1.4 * dir, 0.9 * dir, 0] }
                // Idle: gentle breathing + faint sway so the team never looks frozen
                : { y: [0, -1.8, 0, -1.6, 0], x: [0, 0.5 * dir, 0, -0.5 * dir, 0], rotate: [0, -0.5 * dir, 0, 0.5 * dir, 0] }
        }
        transition={
          isCelebrating
            ? { repeat: Infinity, duration: isWinnerSide ? 0.85 : 2.8, ease: "easeInOut" }
            : isPulling
              ? { repeat: Infinity, duration: 0.55, ease: "easeInOut" }
              : { repeat: Infinity, duration: 2.6 + index * 0.3, ease: "easeInOut" }
        }
        style={{ transformOrigin: `${cx}px ${feetY}px` }}
      >
        <path
          d={`M${hipCx - 4 * dir},${hipY} L${backKneeX},${backKneeY} L${backFootX},${feetY}`}
          stroke={`url(#pg-${uid})`} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        <path d={`M${backFootX - 12},${feetY - 2} Q${backFootX},${feetY - 10} ${backFootX + 14},${feetY - 2} Q${backFootX + 10},${feetY + 5} ${backFootX - 10},${feetY + 4} Z`}
          fill={palette.shoe} />
        <path d={`M${backFootX - 8},${feetY - 4} Q${backFootX},${feetY - 8} ${backFootX + 9},${feetY - 4}`}
          stroke="rgba(255,255,255,0.85)" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.6} />
        <path d={`M${backFootX - 12},${feetY + 2} Q${backFootX},${feetY + 7} ${backFootX + 14},${feetY + 1}`} stroke={palette.sole} strokeWidth={3} strokeLinecap="round" />
        <path d={`M${backFootX - 7},${feetY + 4} L${backFootX - 10},${feetY + 8} M${backFootX + 1},${feetY + 4} L${backFootX - 1},${feetY + 8} M${backFootX + 9},${feetY + 3} L${backFootX + 8},${feetY + 7}`}
          stroke={palette.sole} strokeWidth={1.5} strokeLinecap="round" opacity={0.65} />

        <path
          d={`M${hipCx + 4 * dir},${hipY} L${frontKneeX},${frontKneeY} L${frontFootX},${feetY}`}
          stroke={`url(#pg-${uid})`} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        <path d={`M${frontFootX - 12},${feetY - 2} Q${frontFootX},${feetY - 10} ${frontFootX + 15},${feetY - 2} Q${frontFootX + 11},${feetY + 5} ${frontFootX - 10},${feetY + 4} Z`}
          fill={palette.shoe} />
        <path d={`M${frontFootX - 8},${feetY - 4} Q${frontFootX},${feetY - 8} ${frontFootX + 10},${feetY - 4}`}
          stroke="rgba(255,255,255,0.85)" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.6} />
        <path d={`M${frontFootX - 12},${feetY + 2} Q${frontFootX},${feetY + 7} ${frontFootX + 15},${feetY + 1}`} stroke={palette.sole} strokeWidth={3} strokeLinecap="round" />
        <path d={`M${frontFootX - 7},${feetY + 4} L${frontFootX - 10},${feetY + 8} M${frontFootX + 1},${feetY + 4} L${frontFootX - 1},${feetY + 8} M${frontFootX + 10},${feetY + 3} L${frontFootX + 8},${feetY + 7}`}
          stroke={palette.sole} strokeWidth={1.5} strokeLinecap="round" opacity={0.65} />
        <path d={`M${backKneeX},${backKneeY - 3} L${backFootX},${feetY - 15}`} stroke={palette.sock} strokeWidth={6} strokeLinecap="round" opacity={0.75} />
        <path d={`M${frontKneeX},${frontKneeY - 3} L${frontFootX},${feetY - 15}`} stroke={palette.sock} strokeWidth={6} strokeLinecap="round" opacity={0.75} />

        <path
          d={`M${hipCx - 14},${hipY + 7}
              Q${(hipCx + shoulderCx) / 2 - 20 * dir},${(hipY + shoulderY) / 2}
              ${leftShoulderX},${shoulderY}
              Q${shoulderCx},${shoulderY - 12}
              ${rightShoulderX},${shoulderY}
              Q${(hipCx + shoulderCx) / 2 + 16 * dir},${(hipY + shoulderY) / 2}
              ${hipCx + 14},${hipY + 7}
              Q${hipCx},${hipY + 17}
              ${hipCx - 14},${hipY + 7} Z`}
          fill={`url(#jg-${uid})`}
        />
        {/* Soft shadow cast by the head/neck onto the chest */}
        <ellipse cx={shoulderCx} cy={shoulderY + 3} rx={11} ry={4} fill="rgba(0,0,0,0.13)" />
        <path
          d={`M${leftShoulderX + 5 * dir},${shoulderY + 2}
              Q${shoulderCx},${shoulderY + 28}
              ${hipCx + 10 * dir},${hipY + 12}`}
          stroke={palette.jerseyDark}
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.36}
        />
        <path d={`M${leftShoulderX},${shoulderY + 2} Q${shoulderCx},${shoulderY - 4} ${rightShoulderX},${shoulderY + 2}`}
          stroke={palette.jerseyLight} strokeWidth={5} strokeLinecap="round" opacity={0.75} />
        <path d={`M${shoulderCx - 10 * dir},${shoulderY + 8} Q${(hipCx + shoulderCx) / 2 - 10 * dir},${(hipY + shoulderY) / 2 + 6} ${hipCx - 7 * dir},${hipY + 9}`}
          stroke="white" strokeWidth={5} strokeLinecap="round" opacity={0.92} />
        <path d={`M${shoulderCx + 10 * dir},${shoulderY + 8} Q${(hipCx + shoulderCx) / 2 + 8 * dir},${(hipY + shoulderY) / 2 + 8} ${hipCx + 8 * dir},${hipY + 10}`}
          stroke="white" strokeWidth={4.5} strokeLinecap="round" opacity={0.74} />

        <text
          x={(hipCx + shoulderCx) / 2}
          y={(hipY + shoulderY) / 2 + 11}
          textAnchor="middle" fill="white" fontSize={15} fontWeight="900" fontFamily="sans-serif" opacity={0.9}
        >{index + 1}</text>

        {isCelebrating && isWinnerSide ? (
          <>
            {/* Victory arms raised */}
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
        ) : isCelebrating && isLosingSide ? (
          <>
            {/* Defeated arms hanging down at sides */}
            <path d={`M${leftShoulderX},${shoulderY}
                      Q${leftShoulderX - 8 * dir},${shoulderY + 20}
                       ${leftShoulderX - 10 * dir},${shoulderY + 42}`}
              stroke={palette.jerseyDark} strokeWidth={11} strokeLinecap="round" fill="none" />
            <path d={`M${leftShoulderX - 2 * dir},${shoulderY + 3}
                      Q${leftShoulderX - 6 * dir},${shoulderY + 22}
                       ${leftShoulderX - 8 * dir},${shoulderY + 43}`}
              stroke={skin} strokeWidth={7} strokeLinecap="round" fill="none" />
            <circle cx={leftShoulderX - 8 * dir} cy={shoulderY + 46} r={5.5} fill={skin} />
            <path d={`M${rightShoulderX},${shoulderY}
                      Q${rightShoulderX + 8 * dir},${shoulderY + 20}
                       ${rightShoulderX + 10 * dir},${shoulderY + 42}`}
              stroke={palette.jerseyDark} strokeWidth={11} strokeLinecap="round" fill="none" />
            <path d={`M${rightShoulderX + 2 * dir},${shoulderY + 3}
                      Q${rightShoulderX + 6 * dir},${shoulderY + 22}
                       ${rightShoulderX + 8 * dir},${shoulderY + 43}`}
              stroke={skin} strokeWidth={7} strokeLinecap="round" fill="none" />
            <circle cx={rightShoulderX + 8 * dir} cy={shoulderY + 46} r={5.5} fill={skin} />
          </>
        ) : (
          <>
            <path d={`M${rightShoulderX},${shoulderY}
                      Q${rightShoulderX + 15 * dir},${shoulderY + 10}
                       ${hand1X},${ropeGripY}`}
              stroke={palette.jerseyDark} strokeWidth={13.5} strokeLinecap="round" fill="none" />
            <path d={`M${rightShoulderX + 9 * dir},${shoulderY + 6}
                      Q${rightShoulderX + 20 * dir},${shoulderY + 14}
                       ${hand1X - 6 * dir},${ropeGripY - 2}`}
              stroke={skinD} strokeWidth={3.2} strokeLinecap="round" fill="none" opacity={0.55} />
            <path d={`M${rightShoulderX + 3 * dir},${shoulderY + 2}
                      Q${rightShoulderX + 14 * dir},${shoulderY + 12}
                       ${hand1X},${ropeGripY + 2}`}
              stroke={skin} strokeWidth={9.5} strokeLinecap="round" fill="none" />
            <circle cx={hand1X} cy={ropeGripY} r={7} fill={skin} />
            <circle cx={hand1X} cy={ropeGripY} r={7} fill={skinD} opacity={0.14} />
            {/* Knuckle shadow + top highlight for a rounder fist */}
            <path d={`M${hand1X - 5},${ropeGripY - 1} Q${hand1X},${ropeGripY - 3} ${hand1X + 5},${ropeGripY - 1}`}
              stroke={skinD} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.45} />
            <circle cx={hand1X - 2} cy={ropeGripY - 3} r={2.2} fill="rgba(255,255,255,0.3)" />

            <path d={`M${leftShoulderX},${shoulderY}
                      Q${leftShoulderX + 10 * dir},${shoulderY + 12}
                       ${hand2X},${ropeGripY + 6}`}
              stroke={palette.jerseyDark} strokeWidth={13.5} strokeLinecap="round" fill="none" />
            <path d={`M${leftShoulderX + 7 * dir},${shoulderY + 7}
                      Q${leftShoulderX + 16 * dir},${shoulderY + 16}
                       ${hand2X - 5 * dir},${ropeGripY + 5}`}
              stroke={skinD} strokeWidth={3.2} strokeLinecap="round" fill="none" opacity={0.52} />
            <path d={`M${leftShoulderX + 2 * dir},${shoulderY + 2}
                      Q${leftShoulderX + 9 * dir},${shoulderY + 14}
                       ${hand2X},${ropeGripY + 8}`}
              stroke={skin} strokeWidth={9.5} strokeLinecap="round" fill="none" />
            <circle cx={hand2X} cy={ropeGripY + 6} r={7} fill={skin} />
            <circle cx={hand2X} cy={ropeGripY + 6} r={7} fill={skinD} opacity={0.14} />
            <path d={`M${hand2X - 5},${ropeGripY + 5} Q${hand2X},${ropeGripY + 3} ${hand2X + 5},${ropeGripY + 5}`}
              stroke={skinD} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.45} />
            <circle cx={hand2X - 2} cy={ropeGripY + 3} r={2.2} fill="rgba(255,255,255,0.3)" />
          </>
        )}

        <line x1={shoulderCx} y1={shoulderY - 4} x2={neckCx} y2={neckY}
          stroke={skin} strokeWidth={11} strokeLinecap="round" />

        {/* Ear — drawn before head so head overlaps and hides inner part */}
        <ellipse cx={headCx - dir * 22} cy={headCenterY + 3} rx={5.5} ry={6.5} fill={skin} />
        <ellipse cx={headCx - dir * 22} cy={headCenterY + 3} rx={3.5} ry={4.5} fill={skinD} opacity={0.28} />

        <g>
          <circle cx={headCx} cy={headCenterY} r={24} fill={`url(#sg-${uid})`} />
          {/* Soft jaw / cheek shading for a rounder, less flat face */}
          <ellipse cx={headCx} cy={headCenterY + 13} rx={16} ry={8} fill={skinD} opacity={0.16} />
          <circle cx={headCx - 7} cy={headCenterY - 6} r={7} fill="rgba(255,255,255,0.18)" />
          {isTired && isPulling && (
            <circle cx={headCx} cy={headCenterY} r={24} fill="rgba(200,50,50,0.08)" />
          )}
          <path d={`M${headCx - 24},${headCenterY - 12}
                    Q${headCx - 16},${headCenterY - 31} ${headCx + 6},${headCenterY - 26}
                    Q${headCx + 25},${headCenterY - 22} ${headCx + 22},${headCenterY - 5}
                    Q${headCx + 6},${headCenterY - 15} ${headCx - 24},${headCenterY - 12} Z`}
            fill={hair} />
          {/* Hair sheen highlight */}
          <path d={`M${headCx - 14},${headCenterY - 23} Q${headCx - 2},${headCenterY - 28} ${headCx + 11},${headCenterY - 22}`}
            stroke="rgba(255,255,255,0.16)" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          {/* Variant side fringe — only some athletes have it */}
          {v.fringe && (
            <path d={`M${headCx - 17 * dir},${headCenterY - 15} Q${headCx - 5 * dir},${headCenterY - 21} ${headCx + 3 * dir},${headCenterY - 9}`}
              stroke={hair} strokeWidth={4.2} fill="none" strokeLinecap="round" />
          )}
          <path d={`M${headCx - 22},${headCenterY - 16} Q${headCx},${headCenterY - 22} ${headCx + 23},${headCenterY - 16} L${headCx + 22},${headCenterY - 8} Q${headCx},${headCenterY - 13} ${headCx - 22},${headCenterY - 8} Z`}
            fill={palette.band} />
          <path d={isBlue
            ? `M${headCx - 22},${headCenterY - 12} L${headCx - 33},${headCenterY - 5} L${headCx - 27},${headCenterY + 2}`
            : `M${headCx + 22},${headCenterY - 12} L${headCx + 33},${headCenterY - 5} L${headCx + 27},${headCenterY + 2}`
          } fill={palette.bandTail} />
          <path d={isBlue
            ? `M${headCx - 22},${headCenterY - 12} L${headCx - 30},${headCenterY - 4} L${headCx - 26},${headCenterY}`
            : `M${headCx + 22},${headCenterY - 12} L${headCx + 30},${headCenterY - 4} L${headCx + 26},${headCenterY}`
          } fill={palette.bandTail} opacity={0.65} />

          <ellipse cx={headCx - 8} cy={headCenterY} rx={5.5} ry={6.2} fill="white" />
          <ellipse cx={headCx + 8} cy={headCenterY} rx={5.5} ry={6.2} fill="white" />
          <path d={`M${headCx - 16},${headCenterY - 9} L${headCx - 5},${headCenterY - 12}`} stroke="#111827" strokeWidth={3.5} strokeLinecap="round" />
          <path d={`M${headCx + 5},${headCenterY - 12} L${headCx + 16},${headCenterY - 9}`} stroke="#111827" strokeWidth={3.5} strokeLinecap="round" />
          <path d={`M${headCx - 2},${headCenterY + 4} Q${headCx},${headCenterY + 6} ${headCx + 2},${headCenterY + 4}`} stroke={skinD} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.65} />

          {isCelebrating && isWinnerSide ? (
            <>
            <circle cx={headCx - 8} cy={headCenterY} r={4.2} fill={isBlue ? "#2563EB" : "#DC2626"} />
            <circle cx={headCx - 8} cy={headCenterY} r={2.5} fill="#111827" />
            <circle cx={headCx + 8} cy={headCenterY} r={4.2} fill={isBlue ? "#2563EB" : "#DC2626"} />
            <circle cx={headCx + 8} cy={headCenterY} r={2.5} fill="#111827" />
            <circle cx={headCx - 6.8} cy={headCenterY - 1.5} r={1} fill="white" />
            <circle cx={headCx + 9.2} cy={headCenterY - 1.5} r={1} fill="white" />
            <path d={`M${headCx - 8},${headCenterY + 9} Q${headCx},${headCenterY + 18} ${headCx + 8},${headCenterY + 9}`}
              stroke="#1F2937" strokeWidth={3} fill="none" strokeLinecap="round" />
            </>
          ) : isTired && isPulling ? (
            <>
              {/* Sad/defeated eyebrows — angle inward at top (inner corners raised) */}
              <line x1={headCx - 14} y1={headCenterY - 5} x2={headCx - 4} y2={headCenterY - 10}
                stroke="#1F2937" strokeWidth={3.5} strokeLinecap="round" />
              <line x1={headCx + 4} y1={headCenterY - 10} x2={headCx + 14} y2={headCenterY - 5}
                stroke="#1F2937" strokeWidth={3.5} strokeLinecap="round" />
              <ellipse cx={headCx - 8 + dir} cy={headCenterY + 1} rx={3.8} ry={3.2} fill={isBlue ? "#2563EB" : "#DC2626"} />
              <ellipse cx={headCx + 8 + dir} cy={headCenterY + 1} rx={3.8} ry={3.2} fill={isBlue ? "#2563EB" : "#DC2626"} />
              <ellipse cx={headCx - 8 + dir} cy={headCenterY + 1.5} rx={2.2} ry={1.8} fill="#111827" />
              <ellipse cx={headCx + 8 + dir} cy={headCenterY + 1.5} rx={2.2} ry={1.8} fill="#111827" />
              {mouthOpen ? (
                <ellipse cx={headCx} cy={headCenterY + 12} rx={7} ry={5.5} fill="#7F1D1D" />
              ) : (
                /* Deeper frown for losing team */
                <path d={`M${headCx - 7},${headCenterY + 15} Q${headCx},${headCenterY + 8} ${headCx + 7},${headCenterY + 15}`}
                  stroke="#1F2937" strokeWidth={2.8} fill="none" strokeLinecap="round" />
              )}
              <circle cx={headCx - 14} cy={headCenterY + 4} r={5} fill="#FF9999" opacity={0.35} />
              <circle cx={headCx + 14} cy={headCenterY + 4} r={5} fill="#FF9999" opacity={0.35} />
            </>
          ) : isPulling ? (
            <>
              <ellipse cx={headCx - 8 + dir} cy={headCenterY} rx={4.2} ry={4.8} fill={isBlue ? "#2563EB" : "#DC2626"} />
              <ellipse cx={headCx + 8 + dir} cy={headCenterY} rx={4.2} ry={4.8} fill={isBlue ? "#2563EB" : "#DC2626"} />
              <ellipse cx={headCx - 8 + dir} cy={headCenterY + 0.5} rx={2.5} ry={2.9} fill="#111827" />
              <ellipse cx={headCx + 8 + dir} cy={headCenterY + 0.5} rx={2.5} ry={2.9} fill="#111827" />
              <circle cx={headCx - 6.8 + dir} cy={headCenterY - 1} r={0.9} fill="white" />
              <circle cx={headCx + 9.2 + dir} cy={headCenterY - 1} r={0.9} fill="white" />
              {isUrgent && (
                <>
                  <line x1={headCx - 15} y1={headCenterY - 8} x2={headCx - 4} y2={headCenterY - 5}
                    stroke="#1F2937" strokeWidth={2.7} strokeLinecap="round" />
                  <line x1={headCx + 15} y1={headCenterY - 8} x2={headCx + 4} y2={headCenterY - 5}
                    stroke="#1F2937" strokeWidth={2.7} strokeLinecap="round" />
                </>
              )}
              {mouthOpen ? (
                <ellipse cx={headCx} cy={headCenterY + 11} rx={6} ry={4.5} fill="#7F1D1D" />
              ) : (
                <>
                  <rect x={headCx - 6} y={headCenterY + 8} width={12} height={5} rx={2} fill="#F9FAFB" opacity={0.95} />
                  <line x1={headCx - 6} y1={headCenterY + 10.5} x2={headCx + 6} y2={headCenterY + 10.5}
                    stroke="#1F2937" strokeWidth={1.2} strokeLinecap="round" opacity={0.65} />
                </>
              )}
              <circle cx={headCx - 14} cy={headCenterY + 4} r={4} fill="#FF9999" opacity={0.25} />
              <circle cx={headCx + 14} cy={headCenterY + 4} r={4} fill="#FF9999" opacity={0.25} />
            </>
          ) : (
            <>
              <circle cx={headCx - 8} cy={headCenterY} r={3.6} fill={isBlue ? "#2563EB" : "#DC2626"} />
              <circle cx={headCx - 8} cy={headCenterY} r={2} fill="#111827" />
              <circle cx={headCx + 8} cy={headCenterY} r={3.6} fill={isBlue ? "#2563EB" : "#DC2626"} />
              <circle cx={headCx + 8} cy={headCenterY} r={2} fill="#111827" />
              <circle cx={headCx - 7} cy={headCenterY - 1.2} r={0.7} fill="white" />
              <circle cx={headCx + 9} cy={headCenterY - 1.2} r={0.7} fill="white" />
              <path d={`M${headCx - 5},${headCenterY + 10} Q${headCx},${headCenterY + 14} ${headCx + 5},${headCenterY + 10}`}
                stroke="#1F2937" strokeWidth={2} fill="none" />
            </>
          )}
        </g>

        <SweatDrops cx={headCx} cy={headCenterY} active={isPulling && !isLosingSide && (isUrgent || isTired || fatigue > 0.15)} pullCycle={pullCycle} index={index} />

        {/* Losing team: watery eyes + falling tears */}
        {isLosingSide && isPulling && (
          <g>
            {/* Blue watery tint over eyes */}
            <ellipse cx={headCx - 8} cy={headCenterY} rx={5.5} ry={6.2} fill="#93C5FD" opacity={0.25} />
            <ellipse cx={headCx + 8} cy={headCenterY} rx={5.5} ry={6.2} fill="#93C5FD" opacity={0.25} />
            {/* Animated tear drops driven by pullCycle */}
            {[
              { dx: -7, phase: 0 },
              { dx: 7, phase: 1.1 },
            ].map(({ dx, phase }) => {
              const t = ((pullCycle * 1.1 + phase) % 2.8);
              const dropY = headCenterY + 7 + t * 7;
              const opacity = t < 2.2 ? 0.75 - t * 0.2 : 0;
              if (opacity <= 0) return null;
              return (
                <ellipse
                  key={dx}
                  cx={headCx + dx}
                  cy={dropY}
                  rx={1.6}
                  ry={2.2}
                  fill="#93C5FD"
                  opacity={opacity}
                />
              );
            })}
          </g>
        )}

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
      </motion.g>

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

function TwistedRope({ slideX, isPulling, pullCycle, isCelebrating, stretch = 0, shake = false }: { slideX: number; isPulling: boolean; pullCycle: number; isCelebrating: boolean; stretch?: number; shake?: boolean }) {
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

  // Stretch pulls the rope ends slightly outward (taut snap during an impulse).
  const overhang = 18 + stretch * 7;
  const leftEnd = blue1hand - overhang;
  const rightEnd = red1hand + overhang;

  // Gentle continuous sway while waiting; tighter ripple while pulling.
  // A short high-frequency shake is layered in right after an answer impulse.
  const shakeAmp = shake ? Math.sin(pullCycle * 13) * 0.55 : 0;
  const wobble = (isPulling ? Math.sin(pullCycle * 4) * 0.18 : Math.sin(pullCycle * 0.8) * 0.07) + shakeAmp;
  const tension = Math.abs(slideX) / 80;
  // Lower sag values → the rope reads as genuinely taut rather than droopy.
  // During a stretch the rope snaps even tauter (less sag).
  const sag = (isPulling ? 0.4 + (1 - tension) * 0.65 : 1.5) * (1 - stretch * 0.5);

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
  // Slow, subtle braid — not snake-like; freeze when celebrating
  const twistAmp = 2.8;
  const twistPhase = isCelebrating ? 0 : pullCycle * 0.45;
  const strand1Points: [number, number][] = [];
  const strand2Points: [number, number][] = [];

  for (let i = 0; i <= twistCount; i++) {
    const t = i / twistCount;
    const [px, py] = getPoint(t);
    const twist = Math.sin(t * Math.PI * 8 + twistPhase) * twistAmp;
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
        <path d={mainPath} stroke="rgba(0,0,0,0.38)" strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.18} transform="translate(0, 4)" />
        <path d={mainPath} stroke="#3E2723" strokeWidth={13} fill="none" strokeLinecap="round" opacity={0.15} />
        <path d={mainPath} stroke="#8D6E3C" strokeWidth={11} fill="none" strokeLinecap="round" />
        <path d={s1Path} stroke="#EEC050" strokeWidth={4.2} fill="none" strokeLinecap="round" opacity={0.85} />
        <path d={s2Path} stroke="#7A4C1E" strokeWidth={3.6} fill="none" strokeLinecap="round" opacity={0.78} />
        <g transform={`translate(${slideX}, 0)`}>
          <rect x={CENTER_X - 5} y={ropeGripY - 5} width={10} height={16} rx={3} fill="#E53E3E" />
          <rect x={CENTER_X - 6} y={ropeGripY - 8} width={12} height={5} rx={2} fill="#C53030" />
        </g>
      </motion.g>
    );
  }

  return (
    <g>
      <path d={mainPath} stroke="rgba(0,0,0,0.38)" strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.18} transform="translate(0, 4)" />
      <motion.path
        d={mainPath}
        stroke="#FCD34D"
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
        opacity={isPulling ? 0.18 : 0}
        animate={isPulling ? { opacity: [0.08, 0.22, 0.08] } : { opacity: 0 }}
        transition={{ repeat: Infinity, duration: 0.5 }}
      />
      <path d={mainPath} stroke="#3E2723" strokeWidth={11} fill="none" strokeLinecap="round" opacity={0.15} />

      <path d={mainPath} stroke="#8D6E3C" strokeWidth={9} fill="none" strokeLinecap="round" />

      <path d={s1Path} stroke="#EEC050" strokeWidth={4.2} fill="none" strokeLinecap="round" opacity={0.85} />
      <path d={s2Path} stroke="#7A4C1E" strokeWidth={3.6} fill="none" strokeLinecap="round" opacity={0.78} />

      {/* Rope highlight streak */}
      <path d={mainPath} stroke="#E8C87A" strokeWidth={2.2} fill="none" strokeLinecap="round" opacity={0.35} />

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
        {/* Red center ribbon marker */}
        <rect x={CENTER_X - 6} y={ropeGripY - 6} width={12} height={18} rx={4} fill="#E53E3E" />
        <rect x={CENTER_X - 7} y={ropeGripY - 10} width={14} height={6} rx={3} fill="#C53030" />
        <line x1={CENTER_X - 4} y1={ropeGripY - 4} x2={CENTER_X + 4} y2={ropeGripY + 4} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
        <line x1={CENTER_X - 4} y1={ropeGripY + 4} x2={CENTER_X + 4} y2={ropeGripY - 4} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
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
      <rect x={CENTER_X - 3} y={GROUND_Y - 2} width={6} height={18} rx={2} fill="white" opacity={0.45} />
      <rect x={CENTER_X - 16} y={GROUND_Y + 2} width={32} height={4} rx={2} fill="white" opacity={0.38} />
      <rect x={CENTER_X - 10} y={GROUND_Y + 9} width={20} height={3} rx={2} fill="white" opacity={0.24} />
      {/* Small flag post at ground */}
      <line x1={CENTER_X} y1={GROUND_Y - 2} x2={CENTER_X} y2={GROUND_Y - 22}
        stroke="white" strokeWidth={2} opacity={0.42} />
      <polygon points={`${CENTER_X},${GROUND_Y - 22} ${CENTER_X},${GROUND_Y - 13} ${CENTER_X + 12},${GROUND_Y - 18}`}
        fill="#ef4444" opacity={0.72} />
    </g>
  );
}

function Arena() {
  return (
    <g>
      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6BBFDC" />
          <stop offset="55%" stopColor="#B5DEFA" />
          <stop offset="100%" stopColor="#EAF7FE" />
        </linearGradient>
        <linearGradient id="grassG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5ABF5F" />
          <stop offset="35%" stopColor="#3EA342" />
          <stop offset="100%" stopColor="#236B27" />
        </linearGradient>
        <linearGradient id="dirtG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4B07A" />
          <stop offset="100%" stopColor="#A0845C" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={1000} height={GROUND_Y} fill="url(#skyG)" />
      {/* Crowd stand dark band */}
      <rect x={0} y={110} width={1000} height={65} fill="rgba(8,18,38,0.38)" />
      {/* Crowd silhouette — wavy heads row */}
      <path d="M0,172 Q25,157 52,162 Q80,155 108,161 Q136,154 164,160 Q192,153 220,159 Q248,152 276,158 Q304,151 332,157 Q360,150 388,156 Q416,149 444,155 Q472,148 500,154 Q528,147 556,153 Q584,146 612,152 Q640,145 668,151 Q696,144 724,150 Q752,143 780,149 Q808,142 836,148 Q864,141 892,147 Q920,140 948,146 Q974,141 1000,145 L1000,178 L0,178 Z"
        fill="rgba(4,12,28,0.55)" />
      {Array.from({ length: 36 }).map((_, i) => {
        const x = 14 + i * 27;
        const y = 124 + (i % 3) * 9;
        const fill = i % 5 === 0 ? "#C8DEFF" : i % 5 === 1 ? "#A8C8F8" : i % 5 === 2 ? "#F5B8B8" : i % 5 === 3 ? "#B8E6BC" : "#F8DCAC";
        return (
          <g key={`crowd-${i}`} opacity={0.35}>
            <circle cx={x} cy={y} r={4.8} fill={fill} />
            <rect x={x - 5.5} y={y + 5} width={11} height={10} rx={5} fill={fill} />
          </g>
        );
      })}
      {[150, 315, 670, 835].map((x, i) => (
        <g key={`flag-${i}`} opacity={0.46}>
          <line x1={x} y1={88} x2={x} y2={134} stroke="rgba(255,255,255,0.55)" strokeWidth={2} />
          <path
            d={`M${x},${92} Q${x + 20},${86 + (i % 2) * 5} ${x + 42},${94} L${x + 42},${115} Q${x + 20},${106 - (i % 2) * 3} ${x},${114} Z`}
            fill={i % 2 === 0 ? "#2563EB" : "#DC2626"}
          />
          <path d={`M${x + 8},${98} Q${x + 22},${95} ${x + 36},${100}`} stroke="rgba(255,255,255,0.45)" strokeWidth={2} fill="none" />
        </g>
      ))}
      {[210, 430, 585, 760].map((x, i) => (
        <motion.circle
          key={`sky-particle-${i}`}
          cx={x}
          cy={64 + (i % 2) * 36}
          r={1.8}
          fill="white"
          opacity={0.34}
          animate={{ y: [0, -8, 0], opacity: [0.18, 0.42, 0.18] }}
          transition={{ repeat: Infinity, duration: 3 + i * 0.4, delay: i * 0.3 }}
        />
      ))}
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
      {Array.from({ length: 44 }).map((_, i) => {
        const gx = 5 + i * 22;
        const gy = GROUND_Y - 2 + (i % 3);
        return (
          <line key={i}
            x1={gx} y1={gy}
            x2={gx + (i % 2 === 0 ? 3 : -2.5)} y2={gy - 10 - (i % 3) * 3}
            stroke={i % 3 === 0 ? "#7ED482" : "#5CC060"}
            strokeWidth={1.8}
            opacity={0.44}
          />
        );
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

function DustCloud({ isPulling, pullCycle, slideX, burst = false }: { isPulling: boolean; pullCycle: number; slideX: number; burst?: boolean }) {
  if (!isPulling && !burst) return null;
  const footPositions = [
    CENTER_X - 120 + slideX,
    CENTER_X - 120 - CHAR_SPACING + slideX,
    CENTER_X + 120 + slideX,
    CENTER_X + 120 + CHAR_SPACING + slideX,
  ];
  // Burst = a denser, higher kick-up of dust right after an answer impulse.
  const count = burst ? 8 : 5;
  const opMul = burst ? 1.7 : 1;
  const rise = burst ? 15 : 9;
  return (
    <g>
      {footPositions.flatMap((fx, fi) =>
        Array.from({ length: count }).map((_, i) => {
          const ph = (pullCycle * 2.8 + i * 0.85 + fi * 1.1) % (Math.PI * 2);
          if (Math.sin(ph) < 0) return null;
          const spread = (i - 2) * 13;
          return (
            <circle
              key={`d-${fi}-${i}`}
              cx={fx + spread + Math.cos(ph + i) * 6}
              cy={GROUND_Y - Math.sin(ph) * rise + 2}
              r={2.5 + Math.sin(ph) * (burst ? 3.5 : 2.5)}
              fill="#C9A96E"
              opacity={Math.min(0.7, Math.sin(ph) * 0.38 * opMul)}
            />
          );
        })
      )}
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

export function CartoonTugScene({ ropePos, isPulling, isUrgent, isCelebrating, winnerSide, impulse }: CartoonTugSceneProps) {
  const [pullCycle, setPullCycle] = useState(0);
  // Smoothed rope position — eases toward the real ropePos so team progress
  // glides instead of snapping. Purely presentational; never sent anywhere.
  const [displayPos, setDisplayPos] = useState(ropePos);
  const ropePosRef = useRef(ropePos);
  ropePosRef.current = ropePos;
  // Reactive impulse spring: a transient horizontal "kick" added on top of the
  // eased position so the teams lunge forward (win) / recoil (lose) then rebound.
  const [kick, setKick] = useState(0);
  const [burstOn, setBurstOn] = useState(false);
  const kickPosRef = useRef(0);
  const kickVelRef = useRef(0);
  const burstUntilRef = useRef(0);
  const lastImpulseId = useRef<number | null>(null);
  const animRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!impulse || impulse.id === lastImpulseId.current) return;
    lastImpulseId.current = impulse.id;
    // Win lunges forward (toward opponent); lose recoils backward, gentler.
    const magnitude = impulse.kind === "win" ? 30 : 19;
    const sign = (impulse.team === "blue" ? -1 : 1) * (impulse.kind === "win" ? 1 : -1);
    kickPosRef.current = sign * magnitude;
    kickVelRef.current = 0;
    burstUntilRef.current = performance.now() + 450;
  }, [impulse]);

  useEffect(() => {
    mountedRef.current = true;
    const s = performance.now();
    const tick = (n: number) => {
      if (!mountedRef.current) return;
      setPullCycle((n - s) / 1000 * Math.PI * 2 * 1.2);
      setDisplayPos((prev) => {
        const target = ropePosRef.current;
        const next = prev + (target - prev) * 0.14;
        return Math.abs(target - next) < 0.05 ? target : next;
      });
      // Spring the kick back to rest with a slight overshoot → stretch & rebound.
      if (kickPosRef.current !== 0 || kickVelRef.current !== 0) {
        kickVelRef.current += -kickPosRef.current * 0.2;
        kickVelRef.current *= 0.74;
        kickPosRef.current += kickVelRef.current;
        if (Math.abs(kickPosRef.current) < 0.12 && Math.abs(kickVelRef.current) < 0.12) {
          kickPosRef.current = 0;
          kickVelRef.current = 0;
        }
        setKick(kickPosRef.current);
      }
      setBurstOn(n < burstUntilRef.current);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { mountedRef.current = false; cancelAnimationFrame(animRef.current); };
  }, []);

  // When celebrating, losing team slides extra toward winner (retreats past center line)
  const baseSlideX = (displayPos - 50) * 4.5;
  const retreatOffset = isCelebrating && winnerSide ? (winnerSide === "blue" ? -120 : 120) : 0;
  // Clamp the whole rig inside the SVG viewBox (visible x: 100–900). The outer
  // characters sit at base x = 280 (left) and 720 (right); with their ~45px
  // bodies + rope ends, a ±130 cap keeps BOTH teams and the centre marker fully
  // on-screen — even on a landslide win (e.g. 776–0) or the celebration retreat,
  // where baseSlideX + retreat would otherwise drag the winner off the edge.
  const SLIDE_LIMIT = 130;
  const slideX = Math.max(-SLIDE_LIMIT, Math.min(SLIDE_LIMIT, baseSlideX + retreatOffset + kick));
  const blueFatigue = Math.max(0, Math.min(1, (displayPos - 50) / 40));
  const redFatigue = Math.max(0, Math.min(1, (50 - displayPos) / 40));

  const blueIsLosing = winnerSide === "red" || ropePos > 55;
  const redIsLosing = winnerSide === "blue" || ropePos < 45;

  // Clearly-leading team → soft pulsing ground aura (control-shift feedback).
  const lead: "blue" | "red" | null =
    !isPulling || isCelebrating ? null : displayPos < 42 ? "blue" : displayPos > 58 ? "red" : null;
  const leadAuraX =
    lead === "blue" ? CENTER_X - 170 + slideX : lead === "red" ? CENTER_X + 170 + slideX : 0;
  const kickStretch = Math.min(1, Math.abs(kick) / 26);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl select-none border-2 border-white/20 shadow-xl">
      {/* viewBox crops the empty upper sky and side margins → camera pushes in
          ~25% on the action while keeping the original 2.78 aspect ratio so the
          surrounding layout is untouched. */}
      <svg viewBox="100 72 800 288" className="w-full h-auto block">
        <Arena />
        <CenterLine />

        {/* Pulsing ground aura under the team currently in control */}
        {lead && (
          <motion.ellipse
            cx={leadAuraX} cy={GROUND_Y + 3} rx={86} ry={15}
            fill={lead === "blue" ? "rgba(59,130,246,0.30)" : "rgba(239,68,68,0.30)"}
            animate={{ opacity: [0.18, 0.42, 0.18], rx: [80, 92, 80] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
          />
        )}

        <DustCloud isPulling={isPulling} pullCycle={pullCycle} slideX={slideX} burst={burstOn} />

        {[1, 0].map(i => (
          <Character key={`blue-${i}`} side="blue" index={i} slideX={slideX}
            isPulling={isPulling} isUrgent={isUrgent} isCelebrating={isCelebrating}
            isWinnerSide={winnerSide === "blue"} isLosingSide={blueIsLosing}
            pullCycle={pullCycle} fatigue={blueFatigue} />
        ))}

        <TwistedRope slideX={slideX} isPulling={isPulling} pullCycle={pullCycle} isCelebrating={isCelebrating} stretch={kickStretch} shake={burstOn} />

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
