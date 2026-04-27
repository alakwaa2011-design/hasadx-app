import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

const GROUND_Y = 310;
const CENTER_X = 500;
const CHAR_SPACING = 95;
const SVG_W = 1000;
const SVG_H = 360;
const ROPE_Y = 205; // rope grip height

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

// ─── Smooth path builder ──────────────────────────────────
function buildSmoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    if (i < pts.length - 1) {
      const cpx = pts[i][0];
      const cpy = pts[i][1];
      const ex = (pts[i][0] + pts[i + 1][0]) / 2;
      const ey = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${cpx.toFixed(1)},${cpy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
    } else {
      d += ` L${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
    }
  }
  return d;
}

// ─── Arena ────────────────────────────────────────────────
function Arena({ pullCycle, ropePos }: { pullCycle: number; ropePos: number }) {
  const cloudShift = (pullCycle * 8) % 1200;

  return (
    <g>
      <defs>
        <linearGradient id="skyG2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B2D6E" />
          <stop offset="45%" stopColor="#1565C0" />
          <stop offset="85%" stopColor="#42A5F5" />
          <stop offset="100%" stopColor="#7EC8E3" />
        </linearGradient>
        <linearGradient id="grassG2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4CAF50" />
          <stop offset="55%" stopColor="#388E3C" />
          <stop offset="100%" stopColor="#1B5E20" />
        </linearGradient>
        <linearGradient id="dirtG2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8A87A" />
          <stop offset="100%" stopColor="#9E7B58" />
        </linearGradient>
        <linearGradient id="blueZone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1565C0" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#1565C0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="redZone" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#C62828" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#C62828" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFF9C4" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FFF9C4" stopOpacity="0" />
        </radialGradient>
        <filter id="crowdBlur2">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="glowFilter">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Sky */}
      <rect x={0} y={0} width={SVG_W} height={GROUND_Y} fill="url(#skyG2)" />

      {/* Sun halo */}
      <circle cx={855} cy={52} r={90} fill="url(#sunHalo)" />

      {/* Sun */}
      <circle cx={855} cy={52} r={26} fill="#FFE082" opacity={0.9} />
      <circle cx={855} cy={52} r={19} fill="#FFD54F" />
      <circle cx={855} cy={52} r={14} fill="#FFCA28" />

      {/* Sun rays */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 + pullCycle * 6) * (Math.PI / 180);
        const r1 = 30, r2 = 46;
        return (
          <line key={i}
            x1={855 + Math.cos(angle) * r1} y1={52 + Math.sin(angle) * r1}
            x2={855 + Math.cos(angle) * r2} y2={52 + Math.sin(angle) * r2}
            stroke="#FFE082" strokeWidth={2} strokeLinecap="round" opacity={0.55}
          />
        );
      })}

      {/* Distant stadium silhouette */}
      <path d={`M0,${GROUND_Y - 95} C80,${GROUND_Y - 125} 160,${GROUND_Y - 105}
                 230,${GROUND_Y - 115} C310,${GROUND_Y - 128} 380,${GROUND_Y - 95}
                 450,${GROUND_Y - 110} L450,${GROUND_Y - 82} L0,${GROUND_Y - 82} Z`}
        fill="#0A2060" opacity={0.18} />
      <path d={`M550,${GROUND_Y - 92} C620,${GROUND_Y - 118} 700,${GROUND_Y - 100}
                 780,${GROUND_Y - 122} C850,${GROUND_Y - 108} 930,${GROUND_Y - 95}
                 SVG_W,${GROUND_Y - 90} L${SVG_W},${GROUND_Y - 78} L550,${GROUND_Y - 78} Z`}
        fill="#0A2060" opacity={0.18} />

      {/* Crowd — blue left */}
      {Array.from({ length: 22 }).map((_, i) => {
        const cx = 15 + i * 18;
        const sway = Math.sin(pullCycle * 2.2 + i * 0.65) * 4;
        const h = 14 + (i % 3) * 4;
        const headY = GROUND_Y - 82 + sway;
        return (
          <g key={`cb-${i}`} filter="url(#crowdBlur2)">
            <ellipse cx={cx} cy={headY} rx={5.5} ry={7} fill="#1E88E5" opacity={0.55} />
            <rect x={cx - 5} y={headY + 6} width={10} height={h} rx={2} fill="#1565C0" opacity={0.45} />
            {i % 4 === 0 && (
              <line x1={cx} y1={headY - 8} x2={cx + 10} y2={headY - 22}
                stroke="#1565C0" strokeWidth={1.5} opacity={0.6} strokeLinecap="round" />
            )}
          </g>
        );
      })}

      {/* Crowd — red right */}
      {Array.from({ length: 22 }).map((_, i) => {
        const cx = SVG_W - 15 - i * 18;
        const sway = Math.sin(pullCycle * 2.2 + i * 0.65 + Math.PI) * 4;
        const h = 14 + (i % 3) * 4;
        const headY = GROUND_Y - 82 + sway;
        return (
          <g key={`cr-${i}`} filter="url(#crowdBlur2)">
            <ellipse cx={cx} cy={headY} rx={5.5} ry={7} fill="#E53935" opacity={0.55} />
            <rect x={cx - 5} y={headY + 6} width={10} height={h} rx={2} fill="#C62828" opacity={0.45} />
            {i % 4 === 0 && (
              <line x1={cx} y1={headY - 8} x2={cx - 10} y2={headY - 22}
                stroke="#C62828" strokeWidth={1.5} opacity={0.6} strokeLinecap="round" />
            )}
          </g>
        );
      })}

      {/* Animated clouds */}
      <g transform={`translate(${-cloudShift % 1200},0)`}>
        <ellipse cx={190} cy={48} rx={62} ry={19} fill="white" opacity={0.8} />
        <ellipse cx={218} cy={40} rx={42} ry={17} fill="white" opacity={0.9} />
        <ellipse cx={162} cy={45} rx={36} ry={14} fill="white" opacity={0.75} />
      </g>
      <g transform={`translate(${(-cloudShift * 0.5 + 400) % 1400},0)`}>
        <ellipse cx={520} cy={72} rx={50} ry={14} fill="white" opacity={0.55} />
        <ellipse cx={545} cy={65} rx={32} ry={12} fill="white" opacity={0.6} />
      </g>
      <g transform={`translate(${(-cloudShift * 0.3 + 700) % 1600},0)`}>
        <ellipse cx={730} cy={38} rx={44} ry={13} fill="white" opacity={0.5} />
        <ellipse cx={752} cy={33} rx={28} ry={10} fill="white" opacity={0.55} />
      </g>

      {/* Ground */}
      <rect x={0} y={GROUND_Y - 2} width={SVG_W} height={SVG_H - GROUND_Y + 2} fill="url(#grassG2)" />

      {/* Grass detail */}
      {Array.from({ length: 42 }).map((_, i) => {
        const gx = 8 + i * 23;
        const gh = 5 + (i % 4) * 2;
        const lean = i % 2 === 0 ? 1.5 : -1.5;
        return (
          <line key={i} x1={gx} y1={GROUND_Y - 1} x2={gx + lean} y2={GROUND_Y - 1 - gh}
            stroke="#66BB6A" strokeWidth={1.5} opacity={0.45} strokeLinecap="round" />
        );
      })}

      {/* Dirt track */}
      <rect x={75} y={GROUND_Y - 2} width={850} height={38} rx={5} fill="url(#dirtG2)" opacity={0.52} />

      {/* Dirt texture pebbles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <ellipse key={i}
          cx={90 + i * 28 + (i % 3) * 7} cy={GROUND_Y + 12 + (i % 2) * 10}
          rx={3 + i % 3} ry={1.5} fill="#5D4037" opacity={0.12} />
      ))}

      {/* Team coloring on ground */}
      <rect x={0} y={GROUND_Y - 2} width={CENTER_X} height={32} fill="url(#blueZone)" />
      <rect x={CENTER_X} y={GROUND_Y - 2} width={CENTER_X} height={32} fill="url(#redZone)" />

      {/* Center ground line */}
      <line x1={CENTER_X} y1={GROUND_Y - 3} x2={CENTER_X} y2={GROUND_Y + 28}
        stroke="white" strokeWidth={2} strokeDasharray="5,4" opacity={0.25} />

      {/* Lane boundary lines */}
      <line x1={75} y1={GROUND_Y - 2} x2={75} y2={GROUND_Y + 36}
        stroke="white" strokeWidth={1} opacity={0.15} />
      <line x1={925} y1={GROUND_Y - 2} x2={925} y2={GROUND_Y + 36}
        stroke="white" strokeWidth={1} opacity={0.15} />
    </g>
  );
}

// ─── Realistic Twisted Rope ───────────────────────────────
function RealisticRope({ slideX, isPulling, pullCycle, isCelebrating }: {
  slideX: number; isPulling: boolean; pullCycle: number; isCelebrating: boolean;
}) {
  const tension = Math.min(1, Math.abs(slideX) / 140);
  const highTension = tension > 0.55;

  const leanDeg = isPulling ? -18 : -3;
  const leanRad = (leanDeg * Math.PI) / 180;
  const handOffset = Math.sin(leanRad) * 40 + 38;

  const blue0cx = CENTER_X - 120 + slideX;
  const blue1cx = CENTER_X - 120 - CHAR_SPACING + slideX;
  const red0cx  = CENTER_X + 120 + slideX;
  const red1cx  = CENTER_X + 120 + CHAR_SPACING + slideX;

  const blue0H = blue0cx + handOffset;
  const blue1H = blue1cx + handOffset;
  const red0H  = red0cx  - handOffset;
  const red1H  = red1cx  - handOffset;

  const overhang = 24;
  const leftEnd  = blue1H - overhang;
  const rightEnd = red1H  + overhang;
  const ropeLen  = rightEnd - leftEnd;

  const blueGripFrac = (blue1H - leftEnd) / ropeLen;
  const redGripFrac  = (red1H  - leftEnd) / ropeLen;

  // Dynamic sag: tighter when being pulled hard
  const sag = isPulling ? Math.max(1, 7 - tension * 7) : 11;
  // Vibration at high tension
  const vibAmp  = highTension && isPulling ? (tension - 0.55) * 2.8 : 0;

  function getPoint(t: number, vOffset = 0): [number, number] {
    const px = leftEnd + ropeLen * t;
    const sagAt  = Math.sin(t * Math.PI) * sag;
    const vibAt  = vibAmp > 0
      ? Math.sin(t * Math.PI * 9 + pullCycle * 14) * vibAmp * Math.sin(t * Math.PI)
      : 0;
    let droop = 0;
    if (t < blueGripFrac) {
      const dt = 1 - t / blueGripFrac;
      droop = dt * dt * 20;
    } else if (t > redGripFrac) {
      const dt = (t - redGripFrac) / (1 - redGripFrac);
      droop = dt * dt * 20;
    }
    return [px, ROPE_Y + sagAt + vibAt + droop + vOffset];
  }

  const SEG = 48;
  const mainPts: [number, number][] = Array.from({ length: SEG + 1 }, (_, i) => getPoint(i / SEG));
  const mainPath = buildSmoothPath(mainPts);

  // 3 helical strands (offset Y via sine)
  const TWIST = 11;  // full twists
  const AMP   = 2.6; // pixel amplitude
  const strandDefs = [
    { phase: 0,                   color: "#C8953A", w: 2.2, op: 0.95 },
    { phase: (Math.PI * 2) / 3,   color: "#8D5E28", w: 2.0, op: 0.85 },
    { phase: (Math.PI * 4) / 3,   color: "#E8C470", w: 1.6, op: 0.80 },
  ];

  const strandPaths = strandDefs.map(({ phase }) => {
    const pts: [number, number][] = Array.from({ length: SEG + 1 }, (_, i) => {
      const t = i / SEG;
      const [px, py] = getPoint(t);
      const twist = Math.sin(t * Math.PI * 2 * TWIST + pullCycle * 2.5 + phase);
      // Taper amplitude at rope ends for a natural look
      const endTaper = Math.min(t / 0.08, 1) * Math.min((1 - t) / 0.08, 1);
      return [px, py + twist * AMP * endTaper];
    });
    return buildSmoothPath(pts);
  });

  // Fiber cross marks along rope
  const fiberMarks = Array.from({ length: 22 }, (_, i) => {
    const t = (i + 0.5) / 22;
    const [px, py] = getPoint(t);
    const tn = Math.min(t + 0.015, 1);
    const [px2, py2] = getPoint(tn);
    const ang = Math.atan2(py2 - py, px2 - px);
    const perp = ang + Math.PI / 2;
    const len = 4.5;
    return {
      x1: px - Math.cos(perp) * len,
      y1: py - Math.sin(perp) * len,
      x2: px + Math.cos(perp) * len,
      y2: py + Math.sin(perp) * len,
    };
  });

  // Grip wrap positions along rope
  const wrapTs = [
    { t: (blue1H - leftEnd) / ropeLen + 0.02, color: "#1565C0" },
    { t: (blue0H - leftEnd) / ropeLen - 0.02, color: "#1E88E5" },
    { t: (red0H  - leftEnd) / ropeLen + 0.02, color: "#E53935" },
    { t: (red1H  - leftEnd) / ropeLen - 0.02, color: "#C62828" },
  ].filter(w => w.t > 0.02 && w.t < 0.98);

  if (isCelebrating) {
    const fallen: [number, number][] = Array.from({ length: SEG + 1 }, (_, i) => {
      const t = i / SEG;
      const px = leftEnd + ropeLen * t;
      const wave = Math.sin(t * Math.PI * 5) * 4.5 + Math.sin(t * Math.PI * 8 + pullCycle) * 2;
      return [px, GROUND_Y - 4 + wave];
    });
    const fallenPath = buildSmoothPath(fallen);

    return (
      <motion.g
        initial={{ y: 0 }} animate={{ y: GROUND_Y - ROPE_Y - 4 }}
        transition={{ duration: 0.65, ease: "easeIn" }}
      >
        <path d={mainPath} stroke="#1A0900" strokeWidth={13} fill="none" strokeLinecap="round" opacity={0.12} />
        <path d={mainPath} stroke="#6B4020" strokeWidth={11} fill="none" strokeLinecap="round" />
        <path d={mainPath} stroke="#9A6B30" strokeWidth={9}  fill="none" strokeLinecap="round" />
        {strandPaths.map((sp, si) => (
          <path key={si} d={sp} stroke={strandDefs[si].color} strokeWidth={strandDefs[si].w}
            fill="none" strokeLinecap="round" opacity={strandDefs[si].op} />
        ))}
        <path d={fallenPath} stroke="#E8C470" strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.25} />
      </motion.g>
    );
  }

  return (
    <g>
      {/* Tension glow */}
      {highTension && isPulling && (
        <path d={mainPath}
          stroke={tension > 0.82 ? "#FF6B35" : "#FFAB40"}
          strokeWidth={16} fill="none" strokeLinecap="round"
          opacity={0.12 + (tension - 0.55) * 0.25}
          style={{ filter: "blur(5px)" }}
        />
      )}

      {/* Drop shadow */}
      <path d={buildSmoothPath(mainPts.map(([x, y]) => [x + 2, y + 4] as [number, number]))}
        stroke="#1A0900" strokeWidth={12} fill="none" strokeLinecap="round" opacity={0.10}
      />

      {/* Thick base core */}
      <path d={mainPath} stroke="#4A2800" strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d={mainPath} stroke="#7A4E24" strokeWidth={11} fill="none" strokeLinecap="round" />
      <path d={mainPath} stroke="#9A6B30" strokeWidth={9}  fill="none" strokeLinecap="round" />

      {/* 3 helical strands */}
      {strandPaths.map((sp, si) => (
        <path key={si} d={sp}
          stroke={strandDefs[si].color} strokeWidth={strandDefs[si].w}
          fill="none" strokeLinecap="round" opacity={strandDefs[si].op}
        />
      ))}

      {/* Top sheen highlight */}
      <path d={buildSmoothPath(mainPts.map(([x, y]) => [x, y - 3] as [number, number]))}
        stroke="#FFF3D0" strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.38}
      />

      {/* Fiber perpendicular marks */}
      {fiberMarks.map((m, i) => (
        <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
          stroke="#3E1F00" strokeWidth={0.7} opacity={0.18} />
      ))}

      {/* Grip wraps */}
      {wrapTs.map((w, wi) => {
        const [gx, gy] = getPoint(w.t);
        return (
          <g key={wi}>
            {[-6, -3, 0, 3, 6].map((dx, j) => (
              <ellipse key={j} cx={gx + dx} cy={gy} rx={1.2} ry={5.8}
                fill="none" stroke={w.color} strokeWidth={1.5} opacity={0.45} />
            ))}
          </g>
        );
      })}

      {/* Center knot marker */}
      {(() => {
        const [kx, ky] = getPoint(0.5);
        return (
          <g>
            <circle cx={kx} cy={ky} r={10} fill="#B71C1C" stroke="#7F0000" strokeWidth={2} />
            <circle cx={kx} cy={ky} r={7.5} fill="#E53935" />
            <circle cx={kx} cy={ky} r={5} fill="#EF5350" />
            <circle cx={kx - 2} cy={ky - 2} r={1.5} fill="white" opacity={0.4} />
            {/* Knot cross detail */}
            <line x1={kx - 4} y1={ky} x2={kx + 4} y2={ky} stroke="#7F0000" strokeWidth={1} opacity={0.5} />
            <line x1={kx} y1={ky - 4} x2={kx} y2={ky + 4} stroke="#7F0000" strokeWidth={1} opacity={0.5} />
          </g>
        );
      })()}

      {/* Tension sparks */}
      {highTension && isPulling && Array.from({ length: 6 }).map((_, i) => {
        const t = 0.25 + i * 0.1;
        const [px, py] = getPoint(t);
        const ph = (pullCycle * 4 + i * 1.1) % (Math.PI * 2);
        if (Math.sin(ph) < 0.2) return null;
        return (
          <circle key={i}
            cx={px + Math.cos(ph + i * 0.9) * 9}
            cy={py - 9 - Math.sin(ph) * 7}
            r={1.6} fill="#FFD740" opacity={Math.sin(ph) * 0.85}
          />
        );
      })}
    </g>
  );
}

// ─── Dust Cloud (enhanced) ───────────────────────────────
function DustCloud({ isPulling, pullCycle, slideX }: {
  isPulling: boolean; pullCycle: number; slideX: number;
}) {
  if (!isPulling) return null;
  const sources = [
    CENTER_X - 140 + slideX,
    CENTER_X - 215 + slideX,
    CENTER_X + 140 + slideX,
    CENTER_X + 215 + slideX,
  ];

  return (
    <g>
      {sources.map((bx, si) =>
        Array.from({ length: 7 }).map((_, i) => {
          const ph = (pullCycle * 3.2 + i * 0.85 + si * 1.3) % (Math.PI * 2);
          if (Math.sin(ph) < 0) return null;
          const opacity = Math.sin(ph) * 0.22;
          const rx = 5 + Math.sin(ph) * 7;
          const ry = 3 + Math.sin(ph) * 3.5;
          const dx = (i % 2 === 0 ? 1 : -1) * (6 + Math.cos(ph + i) * 12);
          const dy = -Math.sin(ph) * 14 - 3;
          return (
            <ellipse key={`${si}-${i}`}
              cx={bx + dx} cy={GROUND_Y - 1 + dy}
              rx={rx} ry={ry}
              fill="#C4A882" opacity={opacity}
            />
          );
        })
      )}
    </g>
  );
}

// ─── SVG Confetti ─────────────────────────────────────────
function SVGConfetti({ active, side }: { active: boolean; side: "blue" | "red" | null }) {
  if (!active || !side) return null;
  const colors = side === "blue"
    ? ["#1E88E5", "#64B5F6", "#FFD700", "#FFFFFF", "#42A5F5", "#BBDEFB"]
    : ["#E53935", "#EF9A9A", "#FFD700", "#FFFFFF", "#EF5350", "#FFCDD2"];

  const pieces = Array.from({ length: 32 }, (_, i) => ({
    x: 40 + Math.random() * 920,
    c: colors[i % colors.length],
    s: 4 + Math.random() * 6,
    d: 1.5 + Math.random() * 1.8,
    dl: Math.random() * 2.2,
    rot: Math.random() > 0.5,
    dx: (Math.random() - 0.5) * 60,
  }));

  return (
    <g>
      {pieces.map((c, i) => (
        <motion.rect key={i}
          x={c.x} y={-25} width={c.s} height={c.s * 0.5} rx={1.5} fill={c.c}
          animate={{
            y: [-25, GROUND_Y + 30],
            x: [c.x, c.x + c.dx],
            rotate: [0, c.rot ? 540 : -540],
            opacity: [1, 1, 0.4],
          }}
          transition={{ repeat: Infinity, duration: c.d, delay: c.dl, ease: "linear" }}
        />
      ))}
    </g>
  );
}

// ─── Losing Character ────────────────────────────────────
function LosingCharacter({ side, index, slideX, pullCycle }: {
  side: "blue" | "red"; index: number; slideX: number; pullCycle: number;
}) {
  const isBlue = side === "blue";
  const dir = isBlue ? 1 : -1;
  const baseX = isBlue
    ? CENTER_X - 120 - index * CHAR_SPACING
    : CENTER_X + 120 + index * CHAR_SPACING;
  const cx = baseX + slideX;
  const stagger = index * 0.28 + (isBlue ? 0 : 0.15);
  const cycle = pullCycle + stagger * 3;

  const skin  = index === 0 ? "#FDBCB4" : "#E8A87C";
  const shirt = isBlue ? (index === 0 ? "#1D4ED8" : "#2563EB") : (index === 0 ? "#B91C1C" : "#DC2626");
  const shirtD = isBlue ? "#1E40AF" : "#991B1B";
  const shorts = isBlue ? "#1E3A5F" : "#7F1D1D";
  const shoe  = "#EEEEEE";
  const hair  = index === 0 ? "#2C1810" : "#4A2C17";
  const band  = isBlue ? "#60A5FA" : "#F87171";

  const bodyY = GROUND_Y - 10;
  const headY = bodyY - 35;
  const legK1 = Math.sin(cycle * 2.5) * 12;
  const legK2 = Math.sin(cycle * 2.5 + 1.5) * 10;
  const tearY1 = Math.sin(cycle * 3) * 4;
  const tearY2 = Math.sin(cycle * 3 + 1) * 4;

  return (
    <g>
      <ellipse cx={cx} cy={GROUND_Y + 3} rx={28} ry={5} fill="rgba(0,0,0,0.12)" />

      <path d={`M${cx - 15 * dir},${bodyY + 5} L${cx - 20 * dir + legK1},${GROUND_Y - 5} L${cx - 25 * dir + legK1},${GROUND_Y}`}
        stroke={shorts} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx={cx - 25 * dir + legK1} cy={GROUND_Y} rx={9} ry={4} fill={shoe} />

      <path d={`M${cx - 8 * dir},${bodyY + 5} L${cx - 5 * dir + legK2},${GROUND_Y - 8} L${cx - 10 * dir + legK2},${GROUND_Y}`}
        stroke={shorts} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx={cx - 10 * dir + legK2} cy={GROUND_Y} rx={9} ry={4} fill={shoe} />

      <ellipse cx={cx} cy={bodyY + 5} rx={18} ry={14} fill={shirt} />
      <ellipse cx={cx} cy={bodyY + 5} rx={18} ry={14} fill={shirtD} opacity={0.15} />
      <text x={cx} y={bodyY + 10} textAnchor="middle" fill="white" fontSize={11} fontWeight="bold" fontFamily="sans-serif" opacity={0.7}>{index + 1}</text>

      {/* Arms limp */}
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
        {/* Sad face */}
        <line x1={cx - 9} y1={headY - 5} x2={cx - 3} y2={headY - 2} stroke="#333" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={cx + 3} y1={headY - 2} x2={cx + 9} y2={headY - 5} stroke="#333" strokeWidth={2.5} strokeLinecap="round" />
        <ellipse cx={cx - 6} cy={headY + 2} rx={3} ry={3.5} fill="white" />
        <ellipse cx={cx + 6} cy={headY + 2} rx={3} ry={3.5} fill="white" />
        <circle cx={cx - 6} cy={headY + 2} r={1.5} fill="#333" />
        <circle cx={cx + 6} cy={headY + 2} r={1.5} fill="#333" />
        <path d={`M${cx - 5},${headY + 14} Q${cx},${headY + 9} ${cx + 5},${headY + 14}`}
          stroke="#333" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {/* Tears */}
        <motion.line x1={cx - 9} y1={headY + 4} x2={cx - 11} y2={headY + 12 + tearY1}
          stroke="#64B5F6" strokeWidth={2} strokeLinecap="round"
          animate={{ opacity: [0.4, 0.85, 0.4] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger }} />
        <motion.circle cx={cx - 11} cy={headY + 14 + tearY1} r={2.2} fill="#64B5F6"
          animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger }} />
        <motion.line x1={cx + 9} y1={headY + 4} x2={cx + 11} y2={headY + 12 + tearY2}
          stroke="#64B5F6" strokeWidth={2} strokeLinecap="round"
          animate={{ opacity: [0.4, 0.85, 0.4] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger + 0.3 }} />
        <motion.circle cx={cx + 11} cy={headY + 14 + tearY2} r={2.2} fill="#64B5F6"
          animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger + 0.3 }} />
      </g>

      <motion.text x={cx + 20 * dir} y={headY - 10} fontSize={12} fill="#999"
        animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: stagger }}>💫</motion.text>
      <motion.text x={cx - 4} y={headY - 30} fontSize={14}
        animate={{ y: [headY - 30, headY - 52], opacity: [0.8, 0] }}
        transition={{ repeat: Infinity, duration: 1.6, delay: stagger }}>😢</motion.text>
    </g>
  );
}

// ─── Main Character ───────────────────────────────────────
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

  const stagger = index * 0.26 + (isBlue ? 0 : 0.14);
  const cycle   = pullCycle + stagger * 3;
  const sin1    = Math.sin(cycle * 1.6);
  const cos1    = Math.cos(cycle * 1.6);

  const isWinning = isWinnerSide || (isBlue ? slideX < -5 : slideX > 5);
  const isTired   = isLosingSide || fatigue > 0.3;

  const baseLean = isPulling
    ? (isWinning ? -34 : isTired ? -8 - fatigue * 10 : -18) + sin1 * 4
    : isCelebrating && isWinnerSide ? -5 : -3;
  const leanDeg = baseLean + (isTired && isPulling ? fatigue * 12 : 0);
  const leanRad = (leanDeg * Math.PI) / 180;

  const skin  = index === 0 ? "#FDBCB4" : "#E8A87C";
  const skinD = index === 0 ? "#D4956B" : "#C68642";
  const shirt = isBlue ? (index === 0 ? "#1D4ED8" : "#2563EB") : (index === 0 ? "#B91C1C" : "#DC2626");
  const shirtD = isBlue ? "#1E40AF" : "#991B1B";
  const shorts = isBlue ? "#1E3A5F" : "#7F1D1D";
  const shoe  = "#F5F5F5";
  const shoeD = "#BDBDBD";
  const sock  = isBlue ? "#90CAF9" : "#EF9A9A";
  const hair  = index === 0 ? "#2C1810" : "#4A2C17";
  const band  = isBlue ? "#60A5FA" : "#F87171";

  const feetY      = GROUND_Y;
  const hipY       = feetY - 56 + (isTired ? fatigue * 8 : 0);
  const shoulderY  = hipY - 52 + (isTired ? fatigue * 6 : 0);
  const neckY      = shoulderY - 5;
  const headCenterY = neckY - 23 + (isTired ? fatigue * 4 : 0);

  const hipCx      = cx + Math.sin(leanRad) * 15 * dir;
  const shoulderCx = cx + Math.sin(leanRad) * 42 * dir;
  const neckCx     = shoulderCx + Math.sin(leanRad) * 5 * dir;
  const headCx     = neckCx + Math.sin(leanRad) * 8 * dir;

  const ropeGripY = shoulderY + 25;
  const hand1X = shoulderCx + 38 * dir;
  const hand2X = shoulderCx + 30 * dir;

  const legSpread    = 22;
  const tiredLegX    = isTired ? fatigue * 8 : 0;
  const frontFootX   = cx + (legSpread + tiredLegX) * dir + (isPulling ? sin1 * 11 * dir : 0);
  const backFootX    = cx - (legSpread + tiredLegX) * dir + (isPulling ? -cos1 * 8 * dir : 0);
  const frontKneeX   = (frontFootX + hipCx) / 2 + (isPulling ? 7 * dir : 0);
  const frontKneeY   = hipY + 26 + (isPulling ? sin1 * 4 : 0) + (isTired ? fatigue * 5 : 0);
  const backKneeX    = (backFootX + hipCx) / 2 - (isPulling ? 5 * dir : 0);
  const backKneeY    = hipY + 28 + (isPulling ? -cos1 * 4 : 0) + (isTired ? fatigue * 5 : 0);

  const celebJump = isCelebrating && isWinnerSide
    ? Math.abs(Math.sin(cycle * 2.8)) * -32
    : 0;

  const mouthOpen = isPulling && (isTired ? Math.abs(sin1) > 0.28 : Math.abs(sin1) > 0.62);
  const shoulderOffsetX = 13 * dir;
  const leftShoulderX  = shoulderCx - shoulderOffsetX;
  const rightShoulderX = shoulderCx + shoulderOffsetX;

  // Ground drag marks for front foot
  const hasDragMarks = isPulling && !isCelebrating;

  return (
    <g>
      {/* Ground shadow */}
      <ellipse cx={cx} cy={GROUND_Y + 3} rx={22} ry={5}
        fill="rgba(0,0,0,0.18)"
        transform={celebJump < -5 ? "translate(0,3)" : ""}
      />

      {/* Ground drag/scratch marks */}
      {hasDragMarks && (
        <g opacity={0.28}>
          {[-2, 0, 2].map((offset, mi) => (
            <line key={mi}
              x1={frontFootX - offset * dir}  y1={feetY - 1}
              x2={frontFootX + (12 + offset) * dir} y2={feetY - 5}
              stroke="#8D6E63" strokeWidth={1.2} strokeLinecap="round"
            />
          ))}
        </g>
      )}

      <g transform={`translate(0, ${celebJump})`}>
        {/* Back leg */}
        <path d={`M${hipCx - 4 * dir},${hipY} L${backKneeX},${backKneeY} L${backFootX},${feetY}`}
          stroke={shorts} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx={backFootX} cy={feetY} rx={11} ry={5} fill={shoeD} />
        <ellipse cx={backFootX} cy={feetY - 1} rx={9} ry={3.5} fill={shoe} />
        <ellipse cx={backFootX} cy={feetY - 2} rx={8} ry={2.5} fill={sock} opacity={0.45} />

        {/* Front leg */}
        <path d={`M${hipCx + 4 * dir},${hipY} L${frontKneeX},${frontKneeY} L${frontFootX},${feetY}`}
          stroke={shorts} strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <ellipse cx={frontFootX} cy={feetY} rx={12} ry={5} fill={shoeD} />
        <ellipse cx={frontFootX} cy={feetY - 1} rx={10} ry={3.5} fill={shoe} />
        <ellipse cx={frontFootX} cy={feetY - 2} rx={9} ry={2.5} fill={sock} opacity={0.45} />

        {/* Torso */}
        <path d={`M${hipCx},${hipY + 5} Q${(hipCx + shoulderCx) / 2},${(hipY + shoulderY) / 2} ${shoulderCx},${shoulderY}`}
          stroke={shirt} strokeWidth={30} strokeLinecap="round" fill="none" />
        <path d={`M${hipCx},${hipY + 5} Q${(hipCx + shoulderCx) / 2},${(hipY + shoulderY) / 2} ${shoulderCx},${shoulderY}`}
          stroke={shirtD} strokeWidth={30} strokeLinecap="round" fill="none" opacity={0.14} />
        <line x1={leftShoulderX} y1={shoulderY} x2={rightShoulderX} y2={shoulderY}
          stroke={shirt} strokeWidth={15} strokeLinecap="round" />

        {/* Jersey number */}
        <text x={(hipCx + shoulderCx) / 2} y={(hipY + shoulderY) / 2 + 8}
          textAnchor="middle" fill="white" fontSize={14} fontWeight="bold" fontFamily="sans-serif" opacity={0.75}
        >{index + 1}</text>

        {/* Arms */}
        {isCelebrating && isWinnerSide ? (
          <>
            <path d={`M${leftShoulderX},${shoulderY}
                        Q${leftShoulderX - 16 * dir},${shoulderY - 28}
                         ${leftShoulderX - 24 * dir},${shoulderY - 50}`}
              stroke={skin} strokeWidth={8} strokeLinecap="round" fill="none" />
            <circle cx={leftShoulderX - 24 * dir} cy={shoulderY - 53} r={6} fill={skin} />
            <path d={`M${rightShoulderX},${shoulderY}
                        Q${rightShoulderX + 13 * dir},${shoulderY - 22}
                         ${rightShoulderX + 20 * dir},${shoulderY - 44}`}
              stroke={skin} strokeWidth={8} strokeLinecap="round" fill="none" />
            <circle cx={rightShoulderX + 20 * dir} cy={shoulderY - 47} r={6} fill={skin} />
          </>
        ) : (
          <>
            {/* Rope-gripping arms */}
            <path d={`M${rightShoulderX},${shoulderY}
                        Q${rightShoulderX + 16 * dir},${shoulderY + 10}
                         ${hand1X},${ropeGripY}`}
              stroke={shirt} strokeWidth={9} strokeLinecap="round" fill="none" />
            <path d={`M${rightShoulderX + 3 * dir},${shoulderY + 2}
                        Q${rightShoulderX + 15 * dir},${shoulderY + 12}
                         ${hand1X},${ropeGripY + 2}`}
              stroke={skin} strokeWidth={7} strokeLinecap="round" fill="none" />
            <circle cx={hand1X} cy={ropeGripY}     r={6.5} fill={skin} />
            <circle cx={hand1X} cy={ropeGripY}     r={6.5} fill={skinD} opacity={0.1} />

            <path d={`M${leftShoulderX},${shoulderY}
                        Q${leftShoulderX + 11 * dir},${shoulderY + 13}
                         ${hand2X},${ropeGripY + 7}`}
              stroke={shirt} strokeWidth={9} strokeLinecap="round" fill="none" />
            <path d={`M${leftShoulderX + 2 * dir},${shoulderY + 2}
                        Q${leftShoulderX + 10 * dir},${shoulderY + 15}
                         ${hand2X},${ropeGripY + 9}`}
              stroke={skin} strokeWidth={7} strokeLinecap="round" fill="none" />
            <circle cx={hand2X} cy={ropeGripY + 7} r={6.5} fill={skin} />
            <circle cx={hand2X} cy={ropeGripY + 7} r={6.5} fill={skinD} opacity={0.1} />
          </>
        )}

        {/* Neck */}
        <line x1={shoulderCx} y1={shoulderY - 3} x2={neckCx} y2={neckY}
          stroke={skin} strokeWidth={10} strokeLinecap="round" />

        {/* Head group */}
        <g>
          <circle cx={headCx} cy={headCenterY} r={21} fill={skin} />
          {isTired && isPulling && (
            <circle cx={headCx} cy={headCenterY} r={21} fill="rgba(220,50,50,0.07)" />
          )}
          {/* Hair */}
          <ellipse cx={headCx} cy={headCenterY - 17} rx={22} ry={13} fill={hair} />
          <ellipse cx={headCx - 15} cy={headCenterY - 9} rx={6.5} ry={13} fill={hair} />
          <ellipse cx={headCx + 15} cy={headCenterY - 9} rx={6.5} ry={13} fill={hair} />
          {/* Headband */}
          <rect x={headCx - 23} y={headCenterY - 17} width={46} height={8} rx={3} fill={band} />
          <path d={isBlue
            ? `M${headCx - 23},${headCenterY - 13} L${headCx - 32},${headCenterY - 4} L${headCx - 27},${headCenterY}`
            : `M${headCx + 23},${headCenterY - 13} L${headCx + 32},${headCenterY - 4} L${headCx + 27},${headCenterY}`
          } fill={band} />

          {/* Eyes */}
          <ellipse cx={headCx - 8} cy={headCenterY + 1} rx={4} ry={4.5} fill="white" />
          <ellipse cx={headCx + 8} cy={headCenterY + 1} rx={4} ry={4.5} fill="white" />

          {isCelebrating && isWinnerSide ? (
            <>
              <circle cx={headCx - 8} cy={headCenterY + 1} r={3}   fill="#333" />
              <circle cx={headCx + 8} cy={headCenterY + 1} r={3}   fill="#333" />
              <circle cx={headCx - 7} cy={headCenterY}     r={1}   fill="white" />
              <circle cx={headCx + 9} cy={headCenterY}     r={1}   fill="white" />
              <path d={`M${headCx - 7},${headCenterY + 9} Q${headCx},${headCenterY + 18} ${headCx + 7},${headCenterY + 9}`}
                stroke="#333" strokeWidth={2.5} fill="none" strokeLinecap="round" />
            </>
          ) : isTired && isPulling ? (
            <>
              <line x1={headCx - 11} y1={headCenterY - 5} x2={headCx - 4} y2={headCenterY - 3}
                stroke={hair} strokeWidth={2.5} strokeLinecap="round" />
              <line x1={headCx + 4} y1={headCenterY - 3} x2={headCx + 11} y2={headCenterY - 5}
                stroke={hair} strokeWidth={2.5} strokeLinecap="round" />
              <ellipse cx={headCx - 8 + dir} cy={headCenterY + 2} rx={2.5} ry={3} fill="#333" />
              <ellipse cx={headCx + 8 + dir} cy={headCenterY + 2} rx={2.5} ry={3} fill="#333" />
              {mouthOpen ? (
                <ellipse cx={headCx} cy={headCenterY + 12} rx={6.5} ry={5.5} fill="#8B0000" />
              ) : (
                <path d={`M${headCx - 5},${headCenterY + 13} Q${headCx},${headCenterY + 9} ${headCx + 5},${headCenterY + 13}`}
                  stroke="#333" strokeWidth={2} fill="none" strokeLinecap="round" />
              )}
              <circle cx={headCx - 15} cy={headCenterY + 5} r={5.5} fill="#FF9999" opacity={0.38} />
              <circle cx={headCx + 15} cy={headCenterY + 5} r={5.5} fill="#FF9999" opacity={0.38} />
              {/* Sweat drops */}
              {[{ dx: -17, dy: -4 }, { dx: 15, dy: -2 }].map((d, di) => {
                const ph2 = (pullCycle * 1.8 + di * 1.4) % 3;
                const y = d.dy + ph2 * 13;
                const op = ph2 < 2 ? 0.65 - ph2 * 0.15 : 0;
                if (op <= 0) return null;
                return (
                  <g key={di}>
                    <ellipse cx={headCx + d.dx} cy={headCenterY + y} rx={2.2} ry={4} fill="#64B5F6" opacity={op} />
                    <ellipse cx={headCx + d.dx} cy={headCenterY + y - 1} rx={1} ry={1.5} fill="#90CAF9" opacity={op * 0.6} />
                  </g>
                );
              })}
            </>
          ) : isPulling ? (
            <>
              <ellipse cx={headCx - 8 + dir} cy={headCenterY + 1} rx={3} ry={3.5} fill="#333" />
              <ellipse cx={headCx + 8 + dir} cy={headCenterY + 1} rx={3} ry={3.5} fill="#333" />
              <circle  cx={headCx - 7 + dir} cy={headCenterY}     r={1}   fill="white" />
              <circle  cx={headCx + 9 + dir} cy={headCenterY}     r={1}   fill="white" />
              {isUrgent && (
                <>
                  <line x1={headCx - 14} y1={headCenterY - 7} x2={headCx - 4} y2={headCenterY - 5}
                    stroke={hair} strokeWidth={2} strokeLinecap="round" />
                  <line x1={headCx + 14} y1={headCenterY - 7} x2={headCx + 4} y2={headCenterY - 5}
                    stroke={hair} strokeWidth={2} strokeLinecap="round" />
                </>
              )}
              {mouthOpen ? (
                <ellipse cx={headCx} cy={headCenterY + 11} rx={5.5} ry={4.5} fill="#8B0000" />
              ) : (
                <line x1={headCx - 5} y1={headCenterY + 10} x2={headCx + 5} y2={headCenterY + 10}
                  stroke="#333" strokeWidth={2.5} strokeLinecap="round" />
              )}
              <circle cx={headCx - 15} cy={headCenterY + 5} r={4.5} fill="#FF9999" opacity={0.28} />
              <circle cx={headCx + 15} cy={headCenterY + 5} r={4.5} fill="#FF9999" opacity={0.28} />
            </>
          ) : (
            <>
              <circle cx={headCx - 8} cy={headCenterY + 1} r={2.5} fill="#333" />
              <circle cx={headCx + 8} cy={headCenterY + 1} r={2.5} fill="#333" />
              <path d={`M${headCx - 4},${headCenterY + 10} Q${headCx},${headCenterY + 14} ${headCx + 4},${headCenterY + 10}`}
                stroke="#333" strokeWidth={1.5} fill="none" />
            </>
          )}
        </g>

        {/* Urgent motion lines */}
        {isUrgent && isPulling && !isTired && (
          <motion.g animate={{ opacity: [0, 0.5, 0] }} transition={{ repeat: Infinity, duration: 0.4, delay: stagger }}>
            {[-22, -16, -10].map((off, mi) => (
              <line key={mi}
                x1={cx + off * dir} y1={shoulderY + mi * 12}
                x2={cx + (off - 16) * dir} y2={shoulderY + mi * 12}
                stroke="#AAA" strokeWidth={1.2} strokeLinecap="round"
              />
            ))}
          </motion.g>
        )}

        {/* Tired spin stars */}
        {isTired && isPulling && (
          <motion.g animate={{ opacity: [0.2, 0.55, 0.2] }} transition={{ repeat: Infinity, duration: 0.8, delay: stagger }}>
            <text x={headCx + 22 * dir} y={headCenterY - 16} fontSize={11} fill="#999" fontWeight="bold">💫</text>
          </motion.g>
        )}
      </g>

      {/* Celebration stars */}
      {isCelebrating && isWinnerSide && (
        <>
          {[0, 1, 2].map(i => (
            <motion.text key={`s-${side}-${index}-${i}`}
              x={cx - 14 + i * 14} y={headCenterY - 42 + celebJump}
              fontSize={13}
              animate={{
                y: [headCenterY - 42 + celebJump, headCenterY - 80 + celebJump],
                opacity: [1, 0],
              }}
              transition={{ repeat: Infinity, duration: 0.85, delay: i * 0.22 + stagger }}
            >⭐</motion.text>
          ))}
        </>
      )}
    </g>
  );
}

// ─── Main Scene ───────────────────────────────────────────
export function CartoonTugScene({ ropePos, isPulling, isUrgent, isCelebrating, winnerSide }: CartoonTugSceneProps) {
  const slideX = (ropePos - 50) * 4.5;
  const blueFatigue = Math.max(0, Math.min(1, (ropePos - 50) / 38));
  const redFatigue  = Math.max(0, Math.min(1, (50 - ropePos) / 38));

  const [pullCycle, setPullCycle] = useState(0);
  const animRef   = useRef(0);
  const mountRef  = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    const s = performance.now();
    const tick = (n: number) => {
      if (!mountRef.current) return;
      setPullCycle((n - s) / 1000 * Math.PI * 2 * 1.2);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { mountRef.current = false; cancelAnimationFrame(animRef.current); };
  }, []);

  const blueIsLosing = winnerSide === "red"  || ropePos > 55;
  const redIsLosing  = winnerSide === "blue" || ropePos < 45;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl select-none border border-white/20 shadow-2xl">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto block">
        <Arena pullCycle={pullCycle} ropePos={ropePos} />

        {/* Dust at feet */}
        <DustCloud isPulling={isPulling} pullCycle={pullCycle} slideX={slideX} />

        {/* Blue team (rendered back-to-front: index 1 first) */}
        {[1, 0].map(i => (
          <Character key={`blue-${i}`}
            side="blue" index={i} slideX={slideX}
            isPulling={isPulling} isUrgent={isUrgent}
            isCelebrating={isCelebrating}
            isWinnerSide={winnerSide === "blue"}
            isLosingSide={blueIsLosing}
            pullCycle={pullCycle} fatigue={blueFatigue}
          />
        ))}

        {/* Rope on top of characters */}
        <RealisticRope
          slideX={slideX} isPulling={isPulling}
          pullCycle={pullCycle} isCelebrating={isCelebrating}
        />

        {/* Red team */}
        {[1, 0].map(i => (
          <Character key={`red-${i}`}
            side="red" index={i} slideX={slideX}
            isPulling={isPulling} isUrgent={isUrgent}
            isCelebrating={isCelebrating}
            isWinnerSide={winnerSide === "red"}
            isLosingSide={redIsLosing}
            pullCycle={pullCycle} fatigue={redFatigue}
          />
        ))}

        {/* Celebration confetti */}
        <SVGConfetti active={isCelebrating && winnerSide !== null} side={winnerSide} />
      </svg>
    </div>
  );
}
