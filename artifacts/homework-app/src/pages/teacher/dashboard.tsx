import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Wameeth icon — landscape rectangle, 4 wide answer blocks matching exact game colours,
 * Arabic labels أ ب ج د, Hasad dark-green background.
 * Aspect ratio 130 × 72  (≈ 9:5).
 */
const WameethIcon = ({ height = 36 }: { height?: number }) => {
  const w = Math.round(height * 130 / 72);
  return (
    <svg width={w} height={height} viewBox="0 0 130 72" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wm-red2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C41818"/>
          <stop offset="100%" stopColor="#7A0A0A"/>
        </linearGradient>
        <linearGradient id="wm-blue2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1870C0"/>
          <stop offset="100%" stopColor="#08386E"/>
        </linearGradient>
        <linearGradient id="wm-gold2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DAA520"/>
          <stop offset="100%" stopColor="#9A6A08"/>
        </linearGradient>
        <linearGradient id="wm-purple2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B40D8"/>
          <stop offset="100%" stopColor="#5A1A8A"/>
        </linearGradient>
      </defs>
      {/* Hasad dark-green background */}
      <rect width="130" height="72" rx="10" fill="#0D2118"/>
      {/* Row 1 — top-right: أ (Red), top-left: ب (Blue) — RTL matches game */}
      <rect x="68" y="4"  width="58" height="30" rx="6" fill="url(#wm-red2)"/>
      <text x="97" y="19" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="16" fontWeight="bold" fontFamily="system-ui,sans-serif">أ</text>
      <rect x="4"  y="4"  width="58" height="30" rx="6" fill="url(#wm-blue2)"/>
      <text x="33" y="19" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="16" fontWeight="bold" fontFamily="system-ui,sans-serif">ب</text>
      {/* Row 2 — bottom-right: ج (Gold), bottom-left: د (Purple) */}
      <rect x="68" y="38" width="58" height="30" rx="6" fill="url(#wm-gold2)"/>
      <text x="97" y="53" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="16" fontWeight="bold" fontFamily="system-ui,sans-serif">ج</text>
      <rect x="4"  y="38" width="58" height="30" rx="6" fill="url(#wm-purple2)"/>
      <text x="33" y="53" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="16" fontWeight="bold" fontFamily="system-ui,sans-serif">د</text>
    </svg>
  );
};

/** Hack Game icon — laptop with clipped green-matrix screen, no white background */
const HackIcon = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      {/* Clip to keep all text strictly inside the screen */}
      <clipPath id="hck-screen">
        <rect x="17" y="20" width="66" height="38"/>
      </clipPath>
      <radialGradient id="hck-glow" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="#00ff41" stopOpacity="0.3"/>
        <stop offset="100%" stopColor="#00ff41" stopOpacity="0"/>
      </radialGradient>
    </defs>

    {/* ── Laptop lid ── */}
    <rect x="6" y="8" width="88" height="60" rx="6" fill="#1c1c1c"/>
    {/* Bezel */}
    <rect x="10" y="12" width="80" height="52" rx="4" fill="#111"/>
    {/* Screen (dark green-black) */}
    <rect x="17" y="18" width="66" height="42" rx="2" fill="#020d05"/>

    {/* Clipped content: glow + code lines */}
    <g clipPath="url(#hck-screen)">
      <rect x="17" y="18" width="66" height="42" fill="url(#hck-glow)"/>
      <text x="20" y="28" fill="#00ff41" fontSize="5.2" fontFamily="monospace" opacity="0.85">01 AC FF 7E 3B</text>
      <text x="20" y="34" fill="#00dd33" fontSize="5.2" fontFamily="monospace" opacity="0.7">{"if(root){hack()}"}</text>
      <text x="20" y="40" fill="#00ff41" fontSize="5.2" fontFamily="monospace" fontWeight="bold">ACCESS_GRANTED</text>
      <text x="20" y="46" fill="#009922" fontSize="5.2" fontFamily="monospace" opacity="0.6">0xDEAD 0xBEEF</text>
      <text x="20" y="52" fill="#00dd33" fontSize="5.2" fontFamily="monospace" opacity="0.75">{">>> decrypt..."}</text>
      {/* Blinking cursor block */}
      <rect x="74" y="47" width="4" height="6" fill="#00ff41"/>
    </g>

    {/* ── Laptop base ── */}
    <rect x="3" y="68" width="94" height="9" rx="4" fill="#1c1c1c"/>
    {/* Hinge notch */}
    <rect x="6" y="67" width="88" height="4" rx="2" fill="#141414"/>
    {/* Trackpad */}
    <rect x="37" y="70" width="26" height="4" rx="2" fill="#2a2a2a"/>
  </svg>
);

/**
 * Memory Match icon — 3×2 card grid: 4 face-down (purple back + stripe + corner dots)
 * and one matched pair revealed (rose gradient + ★ + green ring). No background.
 */
const MemoryIcon = ({ size = 56 }: { size?: number }) => {
  const cW = 28, cH = 38, gX = 4, gY = 4, sX = 5, sY = 11;
  type CardDef = { x: number; y: number; matched: boolean };
  const cards: CardDef[] = [
    { x: sX,              y: sY,        matched: false },
    { x: sX + cW + gX,   y: sY,        matched: true  },
    { x: sX+(cW+gX)*2,   y: sY,        matched: false },
    { x: sX,              y: sY+cH+gY,  matched: false },
    { x: sX + cW + gX,   y: sY+cH+gY,  matched: true  },
    { x: sX+(cW+gX)*2,   y: sY+cH+gY,  matched: false },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mem-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#4338CA"/>
        </linearGradient>
        <linearGradient id="mem-rose" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FB7185"/><stop offset="100%" stopColor="#BE123C"/>
        </linearGradient>
        <pattern id="mem-stripe" width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="0" y1="6" x2="6" y2="0" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
        </pattern>
      </defs>

      {cards.map((c, i) => c.matched ? (
        <g key={i}>
          {/* Face-up matched card */}
          <rect x={c.x} y={c.y} width={cW} height={cH} rx="5" fill="url(#mem-rose)"/>
          <rect x={c.x} y={c.y} width={cW} height={10}  rx="5" fill="rgba(255,255,255,0.22)"/>
          <text x={c.x+cW/2} y={c.y+cH/2+1} textAnchor="middle" dominantBaseline="central"
                fontSize="15" fill="white">★</text>
          {/* Green matched ring */}
          <rect x={c.x-1.5} y={c.y-1.5} width={cW+3} height={cH+3} rx="6.5"
                fill="none" stroke="#4ADE80" strokeWidth="2.2"/>
        </g>
      ) : (
        <g key={i}>
          {/* Face-down card */}
          <rect x={c.x} y={c.y} width={cW} height={cH} rx="5" fill="url(#mem-back)"/>
          <rect x={c.x} y={c.y} width={cW} height={cH} rx="5" fill="url(#mem-stripe)"/>
          {/* Corner dots — matches real game */}
          <circle cx={c.x+4}    cy={c.y+4}    r="1.5" fill="rgba(255,255,255,0.45)"/>
          <circle cx={c.x+cW-4} cy={c.y+4}    r="1.5" fill="rgba(255,255,255,0.45)"/>
          <circle cx={c.x+4}    cy={c.y+cH-4} r="1.5" fill="rgba(255,255,255,0.45)"/>
          <circle cx={c.x+cW-4} cy={c.y+cH-4} r="1.5" fill="rgba(255,255,255,0.45)"/>
          <text x={c.x+cW/2} y={c.y+cH/2+1} textAnchor="middle" dominantBaseline="central"
                fontSize="13" fill="rgba(255,255,255,0.35)">?</text>
        </g>
      ))}
    </svg>
  );
};

/**
 * Letrly (Wordle) icon — 3 rows × 5 squares with green/yellow/gray states.
 * Matches the actual game's visual language exactly. Light background.
 */
/**
 * Letrly (Wordle-Arabic) icon — real Arabic letters in a 3-row × 5-col grid.
 * Secret word: ر-ي-ا-ض-ة  showing 3 guesses with true green/yellow/gray states.
 */
const LetrlyIcon = ({ size = 56 }: { size?: number }) => {
  const sq = 16, gap = 3;
  const startX = (100 - (5 * sq + 4 * gap)) / 2;
  const startY = 8;
  // Secret word: م-ل-ا-ع-ب  (ملاعب)
  // Each entry: [letter, state]  g=green  y=yellow  z=gray
  const rows: Array<Array<[string, "g"|"y"|"z"]>> = [
    [["ح","z"],["ف","z"],["ك","z"],["ن","z"],["س","z"]], // all wrong
    [["م","g"],["ر","z"],["ا","g"],["س","z"],["ب","g"]], // 3 correct positions
    [["م","g"],["ل","g"],["ا","g"],["ع","g"],["ب","g"]], // WIN!
  ];
  const fill = { g: "#10B981", y: "#F59E0B", z: "#6B7280" };
  const border = { g: "#059669", y: "#D97706", z: "#4B5563" };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {/* White background like real game */}
      <rect width="100" height="100" rx="14" fill="#F8FAF9"/>
      {rows.map((row, ri) =>
        row.map(([letter, state], ci) => {
          const x = startX + ci * (sq + gap);
          const y = startY + ri * (sq + gap + 2);
          return (
            <g key={`${ri}-${ci}`}>
              <rect x={x} y={y} width={sq} height={sq} rx="3"
                    fill={fill[state]} stroke={border[state]} strokeWidth="1"/>
              <text x={x + sq/2} y={y + sq/2 + 1}
                    textAnchor="middle" dominantBaseline="central"
                    fill="white" fontSize="9" fontWeight="900"
                    fontFamily="system-ui,sans-serif">{letter}</text>
            </g>
          );
        })
      )}
      {/* Label bottom */}
      <text x="50" y="93" textAnchor="middle" dominantBaseline="central"
            fill="#256B3A" fontSize="7.5" fontWeight="700" fontFamily="system-ui,sans-serif">خمن الكلمة</text>
    </svg>
  );
};

/**
 * Scrambled Words icon — letter tiles (violet gradient, 3-D shadow) scattered below
 * and partially-filled answer slots above. Matches the real game exactly.
 */
const ScrambleIcon = ({ size = 56 }: { size?: number }) => {
  // Answer slots: 4 positions, first one filled
  const slotY = 14, slotW = 18, slotH = 22, slotGap = 4;
  const slotStart = (100 - (4 * slotW + 3 * slotGap)) / 2; // centered
  // Tile row: 3 remaining tiles (one already placed)
  const tileY = 58, tileW = 22, tileH = 26, tileGap = 5;
  const tileStart = (100 - (3 * tileW + 2 * tileGap)) / 2;
  const letters = ["ص", "ا", "د"];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scr-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#5B21B6"/>
        </linearGradient>
        <linearGradient id="scr-filled" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#6D28D9"/>
        </linearGradient>
      </defs>
      {/* Light lavender background — tiles pop against it */}
      <rect width="100" height="100" rx="14" fill="#F5F0FF"/>
      <rect width="100" height="18" rx="14" fill="rgba(139,92,246,0.08)"/>

      {/* ── Answer slots ── */}
      {[0,1,2,3].map(i => {
        const x = slotStart + i * (slotW + slotGap);
        const filled = i === 0;
        return (
          <g key={i}>
            {filled && <rect x={x} y={slotY+4} width={slotW} height={slotH} rx="5" fill="rgba(109,40,217,0.35)"/>}
            <rect x={x} y={slotY} width={slotW} height={slotH} rx="5"
                  fill={filled ? "url(#scr-filled)" : "rgba(139,92,246,0.12)"}
                  stroke={filled ? "none" : "#C4B5FD"} strokeWidth="1.5"/>
            {filled && (
              <text x={x+slotW/2} y={slotY+slotH/2+1} textAnchor="middle" dominantBaseline="central"
                    fill="white" fontSize="13" fontWeight="900" fontFamily="system-ui,sans-serif">ح</text>
            )}
          </g>
        );
      })}

      {/* Hint label */}
      <text x="50" y="47" textAnchor="middle" dominantBaseline="central"
            fill="#7C3AED" fontSize="7.5" fontWeight="600" fontFamily="system-ui,sans-serif">رتّب الحروف</text>

      {/* ── Scrambled letter tiles ── */}
      {letters.map((letter, i) => {
        const x = tileStart + i * (tileW + tileGap);
        return (
          <g key={i}>
            {/* 3-D bottom shadow */}
            <rect x={x} y={tileY+5} width={tileW} height={tileH} rx="6" fill="#6D28D9" opacity="0.45"/>
            {/* Tile face */}
            <rect x={x} y={tileY} width={tileW} height={tileH} rx="6" fill="url(#scr-tile)"/>
            {/* Top gloss */}
            <rect x={x} y={tileY} width={tileW} height={8} rx="6" fill="rgba(255,255,255,0.22)"/>
            {/* Letter */}
            <text x={x+tileW/2} y={tileY+tileH/2+1} textAnchor="middle" dominantBaseline="central"
                  fill="white" fontSize="15" fontWeight="900" fontFamily="system-ui,sans-serif">{letter}</text>
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Stroop Game icon — the word "أحمر" written in BLUE ink (classic Stroop mismatch),
 * and "أزرق" written in RED ink below it. Dark background. No external background.
 */
const StroopIcon = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    {/* Clean white background — coloured text pops best on white */}
    <rect width="100" height="100" rx="14" fill="#FFFBF5"/>
    {/* Subtle top tint */}
    <rect width="100" height="16" rx="14" fill="rgba(239,68,68,0.06)"/>

    {/* "أحمر" — the WORD says red, but written in BLUE */}
    <text x="50" y="34"
          textAnchor="middle" dominantBaseline="central"
          fill="#2563EB" fontSize="30" fontWeight="900"
          fontFamily="'Segoe UI',Tahoma,Arial,sans-serif">أحمر</text>

    {/* Divider */}
    <line x1="14" y1="52" x2="86" y2="52" stroke="#E5E7EB" strokeWidth="1.5"/>

    {/* "أزرق" — the WORD says blue, but written in RED */}
    <text x="50" y="70"
          textAnchor="middle" dominantBaseline="central"
          fill="#DC2626" fontSize="30" fontWeight="900"
          fontFamily="'Segoe UI',Tahoma,Arial,sans-serif">أزرق</text>

    {/* Hint */}
    <text x="50" y="89"
          textAnchor="middle" dominantBaseline="central"
          fill="#9CA3AF" fontSize="8" fontFamily="system-ui,sans-serif">ما لون الحبر؟</text>
  </svg>
);

/**
 * Rocket Race icon — exact same SVG rocket used in the actual game,
 * violet/fuchsia colour, flame, window. No background.
 */
const RocketIcon = ({ size = 70 }: { size?: number }) => {
  const color = "#a855f7"; // violet-500 — matches card gradient
  const w = Math.round(size * 60 / 96);
  return (
    <svg width={w} height={size} viewBox="0 0 60 96" xmlns="http://www.w3.org/2000/svg"
         style={{ filter: `drop-shadow(0 2px 10px ${color}90)` }}>
      <defs>
        <linearGradient id="rkt-body" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.75"/>
          <stop offset="40%" stopColor="#fff" stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.95"/>
        </linearGradient>
      </defs>
      {/* Flame */}
      <path d="M20 78 Q30 100 40 78 Q35 90 30 92 Q25 90 20 78 Z" fill="#ff6b1a" opacity="0.95"/>
      <path d="M23 78 Q30 90 37 78 Q33 86 30 88 Q27 86 23 78 Z" fill="#ffd54f" opacity="0.95"/>
      <path d="M26 78 Q30 84 34 78 Q32 82 30 83 Q28 82 26 78 Z" fill="#fff9c4" opacity="0.9"/>
      {/* Body */}
      <path d="M30 4 L44 30 L44 70 Q44 80 30 80 Q16 80 16 70 L16 30 Z" fill={color}/>
      <path d="M30 4 L44 30 L44 70 Q44 80 30 80 Q16 80 16 70 L16 30 Z" fill="url(#rkt-body)"/>
      {/* Window */}
      <circle cx="30" cy="40" r="8" fill="#b3e5fc" stroke="#fff" strokeWidth="2.5" opacity="0.95"/>
      <circle cx="30" cy="40" r="5" fill="#0288d1" opacity="0.7"/>
      <circle cx="28" cy="38" r="2" fill="#fff" opacity="0.55"/>
      {/* Fins */}
      <path d="M16 62 L4 82 L16 78 Z" fill={color} opacity="0.9"/>
      <path d="M44 62 L56 82 L44 78 Z" fill={color} opacity="0.9"/>
    </svg>
  );
};

/**
 * Multiplication icon — a mini "chalkboard" equation: 7 × 8 = ? with the answer revealed below.
 * Amber/orange colours matching the game card. No background.
 */
const MultiplyIcon = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mul-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FB923C" stopOpacity="0.85"/>
        <stop offset="100%" stopColor="#D97706" stopOpacity="0.85"/>
      </linearGradient>
      <linearGradient id="mul-ans" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FCD34D"/>
        <stop offset="100%" stopColor="#F59E0B"/>
      </linearGradient>
    </defs>

    {/* Chalkboard / card background */}
    <rect x="4" y="4" width="92" height="92" rx="14" fill="url(#mul-bg)"/>
    {/* Subtle top gloss */}
    <rect x="4" y="4" width="92" height="22" rx="14" fill="rgba(255,255,255,0.15)"/>

    {/* Equation: 7 × 8 = ? */}
    <text x="50" y="46"
          textAnchor="middle" dominantBaseline="central"
          fill="white" fontSize="30" fontWeight="900"
          fontFamily="system-ui,monospace">{"7 × 8"}</text>
    <text x="50" y="72"
          textAnchor="middle" dominantBaseline="central"
          fill="rgba(255,255,255,0.75)" fontSize="24" fontWeight="700"
          fontFamily="system-ui,monospace">= ?</text>
  </svg>
);

/**
 * Flag Quiz icon — 2×2 grid of four recognisable country flags.
 * France | Japan  /  Germany | Italy  — no background.
 */
const FlagQuizIcon = ({ size = 56 }: { size?: number }) => {
  const h = Math.round(size * 76 / 100);
  return (
    <svg width={size} height={h} viewBox="0 0 100 76" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="fq-fr"><rect x="2" y="2"  width="46" height="30" rx="5"/></clipPath>
        <clipPath id="fq-jp"><rect x="52" y="2"  width="46" height="30" rx="5"/></clipPath>
        <clipPath id="fq-de"><rect x="2" y="36" width="46" height="30" rx="5"/></clipPath>
        <clipPath id="fq-it"><rect x="52" y="36" width="46" height="30" rx="5"/></clipPath>
      </defs>

      {/* ── France (blue | white | red — vertical) ── */}
      <rect x="2"  y="2"  width="46" height="30" rx="5" fill="white"/>
      <g clipPath="url(#fq-fr)">
        <rect x="2"   y="2"  width="15.3" height="30" fill="#002395"/>
        <rect x="17.3" y="2" width="15.3" height="30" fill="white"/>
        <rect x="32.6" y="2" width="15.4" height="30" fill="#ED2939"/>
      </g>
      <rect x="2"  y="2"  width="46" height="30" rx="5" fill="none" stroke="rgba(0,0,0,0.13)" strokeWidth="1.2"/>

      {/* ── Japan (white + red circle) ── */}
      <rect x="52" y="2"  width="46" height="30" rx="5" fill="white"/>
      <g clipPath="url(#fq-jp)">
        <circle cx="75" cy="17" r="9.5" fill="#BC002D"/>
      </g>
      <rect x="52" y="2"  width="46" height="30" rx="5" fill="none" stroke="rgba(0,0,0,0.13)" strokeWidth="1.2"/>

      {/* ── Germany (black | red | gold — horizontal) ── */}
      <rect x="2"  y="36" width="46" height="30" rx="5" fill="#000"/>
      <g clipPath="url(#fq-de)">
        <rect x="2" y="36" width="46" height="10" fill="#000"/>
        <rect x="2" y="46" width="46" height="10" fill="#DD0000"/>
        <rect x="2" y="56" width="46" height="10" fill="#FFCE00"/>
      </g>
      <rect x="2"  y="36" width="46" height="30" rx="5" fill="none" stroke="rgba(0,0,0,0.13)" strokeWidth="1.2"/>

      {/* ── Italy (green | white | red — vertical) ── */}
      <rect x="52" y="36" width="46" height="30" rx="5" fill="white"/>
      <g clipPath="url(#fq-it)">
        <rect x="52"   y="36" width="15.3" height="30" fill="#009246"/>
        <rect x="67.3" y="36" width="15.3" height="30" fill="white"/>
        <rect x="82.6" y="36" width="15.4" height="30" fill="#CE2B37"/>
      </g>
      <rect x="52" y="36" width="46" height="30" rx="5" fill="none" stroke="rgba(0,0,0,0.13)" strokeWidth="1.2"/>
    </svg>
  );
};

/**
 * Capitals Game icon — 4 answer boxes in the exact game colours (red/blue/amber/green),
 * teal dark background, landscape rectangle like Wameeth.
 */
const CapitalsIcon = ({ height = 36 }: { height?: number }) => {
  const w = Math.round(height * 130 / 72);
  return (
    <svg width={w} height={height} viewBox="0 0 130 72" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cap-red2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F87171"/><stop offset="100%" stopColor="#B91C1C"/>
        </linearGradient>
        <linearGradient id="cap-blue2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60A5FA"/><stop offset="100%" stopColor="#1D4ED8"/>
        </linearGradient>
        <linearGradient id="cap-amber2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCD34D"/><stop offset="100%" stopColor="#B45309"/>
        </linearGradient>
        <linearGradient id="cap-green2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ADE80"/><stop offset="100%" stopColor="#15803D"/>
        </linearGradient>
      </defs>
      {/* Dark teal background — distinguishes from Wameeth */}
      <rect width="130" height="72" rx="10" fill="#0D3D3A"/>
      {/* Top-right: Red — باريس */}
      <rect x="68" y="4"  width="58" height="30" rx="6" fill="url(#cap-red2)"/>
      <text x="97" y="19" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui,sans-serif">باريس</text>
      {/* Top-left: Blue — لندن */}
      <rect x="4"  y="4"  width="58" height="30" rx="6" fill="url(#cap-blue2)"/>
      <text x="33" y="19" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui,sans-serif">لندن</text>
      {/* Bottom-right: Amber — طوكيو */}
      <rect x="68" y="38" width="58" height="30" rx="6" fill="url(#cap-amber2)"/>
      <text x="97" y="53" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui,sans-serif">طوكيو</text>
      {/* Bottom-left: Green — برلين */}
      <rect x="4"  y="38" width="58" height="30" rx="6" fill="url(#cap-green2)"/>
      <text x="33" y="53" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui,sans-serif">برلين</text>
    </svg>
  );
};

/**
 * Color Game icon — 4×4 grid of same-colour squares, one is a different shade.
 * Mirrors the actual game mechanic. No background.
 */
const ColorGameIcon = ({ size = 56 }: { size?: number }) => {
  // Base: vivid violet  |  Different: lighter purple
  const base = "#7C3AED";
  const diff = "#C084FC";
  // Odd square at row=2, col=1 (non-obvious position like real game)
  const oddIdx = 2 * 4 + 1; // = 9
  const sq = 22, gap = 3, start = 2;
  const pos = (n: number) => start + n * (sq + gap);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 16 }).map((_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const isOdd = i === oddIdx;
        return (
          <rect
            key={i}
            x={pos(col)} y={pos(row)}
            width={sq} height={sq}
            rx="5"
            fill={isOdd ? diff : base}
            opacity={isOdd ? 1 : 0.88}
          />
        );
      })}
      {/* Subtle white ring on the odd square to make it "pop" */}
      <rect
        x={pos(1) - 2} y={pos(2) - 2}
        width={sq + 4} height={sq + 4}
        rx="7"
        fill="none"
        stroke="white"
        strokeWidth="2"
        opacity="0.55"
      />
    </svg>
  );
};

/**
 * Tug-of-War icon — two teams (blue/red stick figures) pulling a braided rope
 * with a red centre-flag marker. No background.
 */
const TugWarIcon = ({ size = 60 }: { size?: number }) => {
  const h = Math.round(size * 65 / 120);
  return (
    <svg width={size} height={h} viewBox="0 0 120 65" xmlns="http://www.w3.org/2000/svg">
      {/* ── Left team (blue) ── */}
      {/* person 1 */}
      <circle cx="10" cy="14" r="5.5" fill="#2563EB"/>
      <line x1="10" y1="20" x2="8"  y2="40" stroke="#2563EB" strokeWidth="3"   strokeLinecap="round"/>
      <line x1="10" y1="27" x2="25" y2="33" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8"  y1="40" x2="3"  y2="55" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8"  y1="40" x2="13" y2="55" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
      {/* person 2 (behind, slightly offset) */}
      <circle cx="21" cy="12" r="4.5" fill="#1D4ED8" opacity="0.8"/>
      <line x1="21" y1="17" x2="19" y2="35" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
      <line x1="21" y1="23" x2="30" y2="33" stroke="#1D4ED8" strokeWidth="2"   strokeLinecap="round" opacity="0.8"/>
      <line x1="19" y1="35" x2="14" y2="52" stroke="#1D4ED8" strokeWidth="2"   strokeLinecap="round" opacity="0.8"/>
      <line x1="19" y1="35" x2="23" y2="52" stroke="#1D4ED8" strokeWidth="2"   strokeLinecap="round" opacity="0.8"/>

      {/* ── Right team (red) ── */}
      {/* person 1 */}
      <circle cx="110" cy="14" r="5.5" fill="#DC2626"/>
      <line x1="110" y1="20" x2="112" y2="40" stroke="#DC2626" strokeWidth="3"   strokeLinecap="round"/>
      <line x1="110" y1="27" x2="95"  y2="33" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="112" y1="40" x2="117" y2="55" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="112" y1="40" x2="107" y2="55" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"/>
      {/* person 2 (behind) */}
      <circle cx="99" cy="12" r="4.5" fill="#B91C1C" opacity="0.8"/>
      <line x1="99" y1="17" x2="101" y2="35" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
      <line x1="99" y1="23" x2="90"  y2="33" stroke="#B91C1C" strokeWidth="2"   strokeLinecap="round" opacity="0.8"/>
      <line x1="101" y1="35" x2="106" y2="52" stroke="#B91C1C" strokeWidth="2"  strokeLinecap="round" opacity="0.8"/>
      <line x1="101" y1="35" x2="97"  y2="52" stroke="#B91C1C" strokeWidth="2"  strokeLinecap="round" opacity="0.8"/>

      {/* ── Braided rope ── */}
      {/* shadow / base */}
      <path d="M30,33 Q60,30 90,33" stroke="#5C3A0A" strokeWidth="8" fill="none" strokeLinecap="round"/>
      {/* main golden strand */}
      <path d="M30,33 Q60,30 90,33" stroke="#C8861A" strokeWidth="6" fill="none" strokeLinecap="round"/>
      {/* highlight stripe — simulates top strand */}
      <path d="M30,33 Q60,30 90,33" stroke="#E8C050" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="6,6" strokeDashoffset="0"/>
      {/* shadow stripe — opposite phase, simulates under strand */}
      <path d="M30,33 Q60,30 90,33" stroke="#8B5210" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="6,6" strokeDashoffset="6"/>

      {/* ── Centre flag / marker ── */}
      <line x1="60" y1="22" x2="60" y2="43" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
      <polygon points="60,22 69,26 60,30" fill="#EF4444"/>
    </svg>
  );
};

/** Professional SVG wheel icon — mirrors the actual game wheel colours */
const WheelIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path d="M50,50 L50,4 A46,46 0 0,1 82.5,17.5 Z" fill="#225739"/>
    <path d="M50,50 L82.5,17.5 A46,46 0 0,1 96,50 Z" fill="#D9A521"/>
    <path d="M50,50 L96,50 A46,46 0 0,1 82.5,82.5 Z" fill="#3a7a55"/>
    <path d="M50,50 L82.5,82.5 A46,46 0 0,1 50,96 Z" fill="#c47e2c"/>
    <path d="M50,50 L50,96 A46,46 0 0,1 17.5,82.5 Z" fill="#1f4d3a"/>
    <path d="M50,50 L17.5,82.5 A46,46 0 0,1 4,50 Z" fill="#e6b54f"/>
    <path d="M50,50 L4,50 A46,46 0 0,1 17.5,17.5 Z" fill="#2d6a4f"/>
    <path d="M50,50 L17.5,17.5 A46,46 0 0,1 50,4 Z" fill="#b08440"/>
    <line x1="50" y1="4" x2="50" y2="96" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="4" y1="50" x2="96" y2="50" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="17.5" y1="17.5" x2="82.5" y2="82.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <line x1="82.5" y1="17.5" x2="17.5" y2="82.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.35"/>
    <circle cx="50" cy="50" r="13" fill="white"/>
    <circle cx="50" cy="50" r="8"  fill="#225739"/>
    <circle cx="50" cy="50" r="3"  fill="white"/>
    <polygon points="50,0 43,12 57,12" fill="#D9A521"/>
    <polygon points="50,1 44,10 56,10" fill="#FFD166"/>
  </svg>
);
import { createPortal } from "react-dom";
import {
  useListAssignments,
  useGetCurrentTeacher,
  useDeleteAssignment,
} from "@workspace/api-client-react";
import type { Assignment } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ClassSelector, getRememberedTargetClass } from "@/components/teacher/class-selector";
import { Link, useLocation } from "wouter";
import {
  Plus,
  BookText,
  Users,
  ArrowLeft,
  ArrowRight,
  Gamepad2,
  Calendar,
  Sparkles,
  Download,
  MessageSquarePlus,
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  Copy,
  Trophy,
  User,
  UsersRound,
  Database,
  Crown,
  Globe,
  Trash2,
  Tag,
  FolderOpen,
  Search,
  Loader2,
  Check,
  Video,
  Pencil,
  ChevronDown,
  Share2,
  Zap,
  Coins,
  Mountain,
  Palette,
  Swords,
  GripVertical,
  ImagePlus,
  MoreVertical,
  Library,
  Home,
  Star,
  Medal,
  X,
  Rocket,
  ChevronLeft,
  FileText,
  BookOpen,
  Monitor,
  Brain,
  GraduationCap,
  Flame,
  ChevronRight,
} from "lucide-react";
import SharedContentPage from "@/pages/teacher/shared-content";
import PresentationsIndex from "@/pages/teacher/presentations/index";
import GuestDraftImportBanner from "@/components/teacher/GuestDraftImportBanner";
import DashboardOverview from "@/components/teacher/DashboardOverview";
import { Card, Button } from "@/components/ui-elements";
import { motion, AnimatePresence } from "framer-motion";
import { getSocket, disconnectSocket } from "@/lib/socket";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

/* ── Sidebar XP Card ──────────────────────────────────────────────────────── */

const API_BASE_DASH = import.meta.env.VITE_API_URL || "";

const LEVEL_STARTS = [0, 250, 750, 2000, 5000, 12000];
const LEVEL_EMOJIS = ["🌱", "📖", "✨", "🎯", "🚀", "🏆"];

interface SidebarXpStats {
  totalXp: number;
  level: number;
  levelNameAr: string;
  nextLevelMinXp: number | null;
  currentStreakDays: number;
  badgeCount: number;
}

function xpPct(s: SidebarXpStats): number {
  if (!s.nextLevelMinXp) return 100;
  const start = LEVEL_STARTS[Math.min(s.level - 1, LEVEL_STARTS.length - 1)] ?? 0;
  const span = s.nextLevelMinXp - start;
  if (span <= 0) return 100;
  return Math.min(100, Math.round(((s.totalXp - start) / span) * 100));
}

/** SVG donut arc — degrees helper */
function arcPath(pct: number, r = 18): string {
  const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
  const x = 22 + r * Math.cos(angle);
  const y = 22 + r * Math.sin(angle);
  const large = pct > 50 ? 1 : 0;
  return pct >= 99.9
    ? `M 22 4 A ${r} ${r} 0 1 1 21.99 4`
    : `M 22 4 A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
}

function SidebarXpCard({
  setLocation,
  isAr,
}: {
  setLocation: (path: string) => void;
  isAr: boolean;
}) {
  const { data } = useQuery<SidebarXpStats | null, Error>({
    queryKey: ["sidebar-xp"],
    queryFn: async (): Promise<SidebarXpStats | null> => {
      const res = await fetch(`${API_BASE_DASH}/api/me/achievements`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("xp");
      const json = await res.json();
      if (json.xpRewardsEnabled === false) return null;
      return json.stats as SidebarXpStats;
    },
    staleTime: 60_000,
    retry: false,
  });

  if (!data) return null;

  const pct = xpPct(data);
  const emoji = LEVEL_EMOJIS[Math.min(data.level - 1, LEVEL_EMOJIS.length - 1)];

  return (
    <div style={{ padding: "12px 12px 14px", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "auto" }}>
      <button
        type="button"
        onClick={() => setLocation("/teacher/achievements")}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(201,160,80,0.35)",
          borderRadius: 12,
          padding: "12px 14px",
          cursor: "pointer",
          textAlign: "right" as const,
          fontFamily: "inherit",
          transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.10)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* SVG donut ring */}
          <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
            <svg viewBox="0 0 44 44" style={{ width: 44, height: 44, transform: "rotate(0deg)" }}>
              {/* Track */}
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="3.5" />
              {/* Progress arc */}
              <path
                d={arcPath(pct)}
                fill="none"
                stroke="url(#xpGold)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="xpGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#E8A80E" />
                  <stop offset="100%" stopColor="#F5C842" />
                </linearGradient>
              </defs>
            </svg>
            {/* Level number inside ring */}
            <span style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#F5C842",
            }}>
              {data.level}
            </span>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>
              {emoji} {data.levelNameAr}
            </p>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#fff", marginBottom: 5 }}>
              {data.totalXp.toLocaleString("ar-SA")}{" "}
              <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
                {isAr ? "نقطة XP" : "XP"}
              </span>
            </p>
            {/* Progress bar */}
            <div style={{ height: 4, background: "rgba(255,255,255,0.10)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: "linear-gradient(90deg,#E8A80E,#F5C842)",
                width: `${pct}%`,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>

          <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
        </div>

        {/* Streak + badges row */}
        {(data.currentStreakDays > 0 || data.badgeCount > 0) && (
          <div style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {data.currentStreakDays > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#fb923c" }}>
                <Flame style={{ width: 11, height: 11 }} />
                {data.currentStreakDays} {isAr ? "يوم متتالي" : "day streak"}
              </span>
            )}
            {data.badgeCount > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#F5C842" }}>
                🏅 {data.badgeCount} {isAr ? "شارة" : "badges"}
              </span>
            )}
          </div>
        )}

        <p style={{ margin: "8px 0 0", fontSize: 10, fontWeight: 700, color: "rgba(201,160,80,0.8)", textAlign: "center" as const }}>
          {isAr ? "عرض الإنجازات كاملة ←" : "View all achievements →"}
        </p>
      </button>
    </div>
  );
}

/* ── End Sidebar XP Card ──────────────────────────────────────────────────── */

type TabId =
  | "overview"
  | "assignments"
  | "shared"
  | "library_homework"
  | "library_competitions"
  | "competitive"
  | "solo_challenges"
  | "tools"
  | "presentations"
  | "islamic"
  | "videos"
  | "stats"
  | "students";

interface SharedAssignment {
  id: number;
  title: string;
  type: string;
  subject: string | null;
  description: string | null;
  isShared: boolean;
  teacherId: number;
  teacherName: string | null;
  isAdminContent?: boolean;
  createdAt: string;
  questionCount: number;
}

type GameMode = "solo" | "teams";

/** Games that can be launched from an assignment (live session). Default: وميض */
type AssignmentLiveGameChoice =
  | "knowledge_race"
  | "tug_of_war"
  | "million"
  | "hack"
  | "rocket_race"
  | "hotseat";

export default function TeacherDashboard() {
  const [, setLocation] = useLocation();
  const [creatingGameForId, setCreatingGameForId] = useState<number | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [gameSetupModal, setGameSetupModal] = useState<number | null>(null);
  const [gameTargetClass, setGameTargetClass] = useState<string>(() => getRememberedTargetClass());
  const [gameMode, setGameMode] = useState<GameMode>("solo");
  const [teamCount, setTeamCount] = useState(2);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  /** Assignment ID awaiting live-game choice (وميض default), then branch to setup / navigate */
  const [assignmentGamePickerId, setAssignmentGamePickerId] = useState<number | null>(
    null,
  );
  /** From `/teacher?liveGame=1` (نشاط جديد → لعبة مباشرة): open وميض assignment picker */
  const [openWameethDeepLink, setOpenWameethDeepLink] = useState(false);
  const { t, lang } = useI18n();
  const BackArrow = lang === "ar" ? ArrowLeft : ArrowRight;
  const {
    data: user,
    isLoading: isUserLoading,
    error: userError,
  } = useGetCurrentTeacher({ query: { retry: false } as any });

  const { data: assignmentsRaw, isLoading: isAssignmentsLoading } =
    useListAssignments(user ? { teacherId: user.id } : undefined, {
      query: { enabled: !!user } as any,
    });
  const assignments: Assignment[] = Array.isArray(assignmentsRaw)
    ? assignmentsRaw
    : Array.isArray((assignmentsRaw as any)?.assignments)
      ? (assignmentsRaw as any).assignments
      : [];

  const queryClient = useQueryClient();
  const deleteAssignmentMutation = useDeleteAssignment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
        toast.success(
          t.assignmentDetail?.deleted ||
            (lang === "ar" ? "تم حذف الواجب" : "Assignment deleted"),
        );
      },
      onError: () => {
        toast.error(
          lang === "ar" ? "خطأ في حذف الواجب" : "Error deleting assignment",
        );
      },
    },
  });

  const [sharedAssignments, setSharedAssignments] = useState<
    SharedAssignment[]
  >([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [importingIds, setImportingIds] = useState<Set<number>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (userError) setLocation("/login");
  }, [userError, setLocation]);

  const consumeWameethDeepLink = useCallback(() => {
    setOpenWameethDeepLink(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const allowed = ["overview", "assignments", "shared", "library_homework", "library_competitions", "competitive", "tools", "videos", "stats", "students"] as const;
    type AllowedTab = typeof allowed[number];
    if (tabParam && (allowed as readonly string[]).includes(tabParam)) {
      setActiveTab(tabParam as AllowedTab);
      params.delete("tab");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
    if (params.get("liveGame") !== "1") return;
    setActiveTab("competitive");
    setOpenWameethDeepLink(true);
    params.delete("liveGame");
    const qs = params.toString();
    const path = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState({}, "", path);
  }, [user]);

  /* ── XP socket: real-time reward toasts ─────────────────────────────── */
  useEffect(() => {
    if (!user?.id) return;
    const socket = getSocket();
    socket.emit("join-teacher-room", { teacherId: user.id });
    function handleXp(payload: {
      delta: number;
      leveledUp?: boolean;
      newLevel?: number;
      newBadgeKeys?: string[];
    }) {
      if ((payload.delta ?? 0) > 0) {
        toast.success(`+${payload.delta} نقطة XP 🎉`, { duration: 3000 });
      }
      if (payload.leveledUp && payload.newLevel != null) {
        setTimeout(() => {
          toast.success(`🏆 ترقّيت إلى المستوى ${payload.newLevel}!`, { duration: 5000 });
        }, 400);
      }
      if ((payload.newBadgeKeys?.length ?? 0) > 0) {
        setTimeout(() => {
          toast.success(`🏅 حصلت على شارة جديدة!`, { duration: 5000 });
        }, 800);
      }
    }
    socket.on("teacher:xp", handleXp);
    return () => { socket.off("teacher:xp", handleXp); };
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== "shared" || !user) return;
    if (sharedAssignments.length > 0) return;
    setSharedLoading(true);
    fetch(`${BASE_URL}/api/assignments/shared`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setSharedAssignments(
          Array.isArray(d)
            ? (d as SharedAssignment[]).filter((a) => a.teacherId !== user.id)
            : [],
        ),
      )
      .catch(() => setSharedAssignments([]))
      .finally(() => setSharedLoading(false));
  }, [activeTab, user]);

  const importSharedAssignment = async (id: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setImportingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`${BASE_URL}/api/assignments/${id}/import`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast.success(
          lang === "ar"
            ? "تم الاستيراد! الواجب الآن في قائمتك."
            : "Imported! Assignment added to your list.",
        );
        setImportedIds((prev) => new Set(prev).add(id));
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(
          d.message || (lang === "ar" ? "خطأ في الاستيراد" : "Import failed"),
        );
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ في الاستيراد" : "Import failed");
    } finally {
      setImportingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const openGameSetup = (assignmentId: number, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setAssignmentGamePickerId(assignmentId);
  };

  const handleAssignmentGameChoice = (choice: AssignmentLiveGameChoice) => {
    const id = assignmentGamePickerId;
    if (id == null) return;
    setAssignmentGamePickerId(null);

    if (choice === "knowledge_race") {
      setGameMode("solo");
      setTeamCount(2);
      setCustomTeamNames(["", "", "", "", "", ""]);
      setGameSetupModal(id);
      return;
    }
    if (choice === "tug_of_war") {
      setLocation(`/game/tug/create?assignmentId=${id}`);
      return;
    }
    if (choice === "rocket_race") {
      setLocation(`/game/rocket/create?assignmentId=${id}`);
      return;
    }
    if (choice === "hotseat") {
      setLocation(`/game/hotseat/create`);
      return;
    }
    if (choice === "million") {
      setLocation(`/game/million?assignmentId=${id}`);
      return;
    }
    if (choice === "hack") {
      setCreatingGameForId(id);
      const socket = getSocket();
      const remembered = getRememberedTargetClass();
      socket.emit(
        "teacher:create-game",
        { assignmentId: id, hackMode: true, gameMode: "solo", targetClass: remembered || undefined },
        (res: { pin?: string; error?: string }) => {
          setCreatingGameForId(null);
          if (res.error) {
            toast.error(res.error);
            disconnectSocket();
            return;
          }
          setLocation(`/teacher/game/${res.pin}`);
        },
      );
    }
  };

  const confirmStartGame = () => {
    if (!gameSetupModal) return;
    const assignmentId = gameSetupModal;
    setGameSetupModal(null);
    setCreatingGameForId(assignmentId);
    const socket = getSocket();
    const validCustomNames =
      gameMode === "teams"
        ? customTeamNames.slice(0, teamCount).map((n) => n.trim())
        : undefined;
    const hasCustomNames =
      validCustomNames && validCustomNames.some((n) => n.length > 0);
    socket.emit(
      "teacher:create-game",
      {
        assignmentId,
        gameMode,
        teamCount: gameMode === "teams" ? teamCount : undefined,
        customTeamNames: hasCustomNames ? validCustomNames : undefined,
        targetClass: gameTargetClass || undefined,
      },
      (res: { pin?: string; error?: string }) => {
        setCreatingGameForId(null);
        if (res.error) {
          toast.error(res.error);
          disconnectSocket();
          return;
        }
        setLocation(`/teacher/game/${res.pin}`);
      },
    );
  };

  // Admin-controlled feature flag for the Google Classroom integration.
  // Hidden by default; surfaced only when the admin enables it.
  const [classroomEnabled, setClassroomEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`${BASE_URL}/api/public/settings`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setClassroomEnabled(!!d.classroomEnabled);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (userError) return null;

  if (isUserLoading)
    return (
      <Layout>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-6xl">
          <div className="mb-12 space-y-3">
            <div className="h-10 w-64 bg-muted/60 rounded-xl skeleton-shimmer" />
            <div className="h-5 w-48 bg-muted/40 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 sm:p-6 rounded-xl border border-border/40 bg-card animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-muted/60" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-24 bg-muted/40 rounded" />
                    <div className="h-7 w-12 bg-muted/60 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-12 w-full bg-muted/30 rounded-xl animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl border border-border/40 bg-card animate-pulse"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </div>
        </div>
      </Layout>
    );

  const tabs: {
    id: TabId;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    href?: string;
  }[] = [
    {
      id: "overview",
      label: lang === "ar" ? "الرئيسية" : "Overview",
      shortLabel: lang === "ar" ? "الرئيسية" : "Home",
      icon: <Home className="w-4 h-4" />,
    },
    {
      id: "assignments",
      label: lang === "ar" ? "واجباتي" : "My Assignments",
      shortLabel: lang === "ar" ? "واجباتي" : "Assignments",
      icon: <BookText className="w-4 h-4" />,
    },
    {
      id: "library_homework",
      label: lang === "ar" ? "مكتبة الأنشطة" : "Activities Library",
      shortLabel: lang === "ar" ? "الأنشطة" : "Activities",
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: "library_competitions",
      label: lang === "ar" ? "مكتبة المسابقات الجاهزة" : "Competitions Library",
      shortLabel: lang === "ar" ? "المسابقات" : "Competitions",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: "competitive",
      label: lang === "ar" ? "الألعاب التعليمية" : "Educational Games",
      shortLabel: lang === "ar" ? "ابدأ مسابقة" : "Start Quiz",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: "solo_challenges",
      label: lang === "ar" ? "وميض حر" : "Free Flash",
      shortLabel: lang === "ar" ? "وميض حر" : "Free Flash",
      icon: <Zap className="w-4 h-4" />,
      href: "/teacher/solo-challenges",
    },
    {
      id: "tools",
      label: lang === "ar" ? "الأدوات" : "Tools",
      shortLabel: lang === "ar" ? "أدوات" : "Tools",
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: "presentations",
      label: lang === "ar" ? "العروض التفاعلية" : "Interactive Presentations",
      shortLabel: lang === "ar" ? "العروض" : "Decks",
      icon: <Monitor className="w-4 h-4" />,
    },
    {
      id: "videos",
      label: lang === "ar" ? "الفيديو التفاعلي" : "Interactive Video",
      shortLabel: lang === "ar" ? "الفيديو" : "Video",
      icon: <Video className="w-4 h-4" />,
    },
    {
      id: "stats",
      label: lang === "ar" ? "ملخص الأداء" : "Performance Summary",
      shortLabel: lang === "ar" ? "الأداء" : "Stats",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: "students",
      label: lang === "ar" ? "صفوفي وطلابي" : "My Classes & Students",
      shortLabel: lang === "ar" ? "الطلاب" : "Students",
      icon: <Users className="w-4 h-4" />,
    },
  ];

  const mcqAssignments = assignments?.filter((a) => a.questionCount > 0) || [];
  const totalSubmissions =
    assignments?.reduce((acc, curr) => acc + curr.submissionCount, 0) || 0;
  const activeAssignments =
    assignments?.filter(
      (a) => !a.deadline || new Date(a.deadline) >= new Date(),
    ) || [];
  const expiredAssignments =
    assignments?.filter(
      (a) => a.deadline && new Date(a.deadline) < new Date(),
    ) || [];
  const avgSubmissions =
    assignments && assignments.length > 0
      ? Math.round((totalSubmissions / assignments.length) * 10) / 10
      : 0;

  const isAr = lang === "ar";

  const tabContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
      >
        {activeTab === "assignments" && (
          <AssignmentsTab
            assignments={assignments}
            isLoading={isAssignmentsLoading}
            creatingGameForId={creatingGameForId}
            startGame={openGameSetup}
            lang={lang}
            t={t}
            setLocation={setLocation}
            setActiveTab={setActiveTab}
            queryClient={queryClient}
            deleteAssignment={(id: number) => {
              if (
                confirm(
                  isAr
                    ? "هل تريد حذف هذا الواجب؟ سيتم حذف جميع الأسئلة والتسليمات."
                    : "Delete this assignment? All questions and submissions will be removed.",
                )
              ) {
                deleteAssignmentMutation.mutate({ id });
              }
            }}
          />
        )}
        {activeTab === "shared" && (
          <SharedTab
            assignments={sharedAssignments}
            isLoading={sharedLoading}
            lang={lang}
            importingIds={importingIds}
            importedIds={importedIds}
            importAssignment={importSharedAssignment}
            creatingGameForId={creatingGameForId}
            startGame={openGameSetup}
          />
        )}
        {activeTab === "competitive" && (
          <CompetitiveTab
            t={t}
            lang={lang}
            setLocation={setLocation}
            user={user}
            mcqAssignments={mcqAssignments}
            creatingGameForId={creatingGameForId}
            startGame={openGameSetup}
            initialOpenWameeth={openWameethDeepLink}
            onConsumeWameethDeepLink={consumeWameethDeepLink}
          />
        )}
        {activeTab === "tools" && (
          <ToolsTab t={t} lang={lang} setLocation={setLocation} user={user} classroomEnabled={classroomEnabled} />
        )}
        {activeTab === "videos" && (
          <VideoLessonsTab lang={lang} setLocation={setLocation} user={user} />
        )}
        {activeTab === "stats" && (
          <StatsTab
            assignments={assignments}
            totalSubmissions={totalSubmissions}
            activeAssignments={activeAssignments}
            expiredAssignments={expiredAssignments}
            avgSubmissions={avgSubmissions}
            t={t}
            lang={lang}
          />
        )}
        {activeTab === "students" && (
          <StudentsInlineTab lang={lang} setLocation={setLocation} />
        )}
        {activeTab === "library_homework" && (
          <SharedContentPage embedded forceKind="homework" />
        )}
        {activeTab === "library_competitions" && (
          <SharedContentPage embedded forceKind="competition" />
        )}
        {activeTab === "presentations" && (
          <PresentationsIndex embedded />
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <Layout>
      {/* ── Desktop sidebar layout ── */}
      <div className="hidden lg:flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 flex flex-col sticky top-0 h-screen overflow-y-auto" style={{background: "#1E4D35", borderInlineEnd: "none", paddingTop: 12}}>
          {/* Logo intentionally removed — the main top header already shows the Hasad logo. */}
          {/* User greeting — shown only on overview tab */}
          {activeTab === "overview" && (
            <div style={{padding: "10px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10}}>
              <div style={{width: 30, height: 30, background: "rgba(255,255,255,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 12, flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.2)"}}>
                {(user?.name || "?").charAt(0)}
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <p style={{fontSize: 9, color: "rgba(255,255,255,0.5)", margin: 0, fontWeight: 600}}>{isAr ? "مرحباً" : "Hello"}</p>
                <p style={{fontSize: 12, fontWeight: 800, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{user?.name}</p>
              </div>
            </div>
          )}
          {/* Create CTA — always visible in sidebar */}
          <div style={{padding: "12px 12px 8px"}}>
            <button
              onClick={() => setLocation("/teacher/new")}
              style={{width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", background: "#E8A80E", color: "#1E4D35", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 12px rgba(232,168,14,0.35)"}}
            >
              <Plus className="w-3.5 h-3.5" />
              {isAr ? "أنشئ نشاطًا جديدًا" : "Create New Activity"}
            </button>
          </div>
          <nav className="flex-1 space-y-0.5">
            {/* ── Section: Main ── */}
            <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-widest" style={{color: "rgba(255,255,255,0.4)"}}>
              {isAr ? "الرئيسية" : "Main"}
            </p>
            {tabs.filter(t => ["overview","assignments","library_homework","library_competitions","competitive","solo_challenges","islamic","stats","students"].includes(t.id)).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.href) setLocation(tab.href);
                    else setActiveTab(tab.id);
                  }}
                  className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all overflow-hidden group"
                  style={active ? { background: "rgba(255,255,255,0.15)", color: "#fff" } : { color: "rgba(255,255,255,0.65)" }}
                >
                  {!active && (
                    <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(255,255,255,0.07)" }} />
                  )}
                  {active && (
                    <span className={cn("absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full", isAr ? "end-0" : "start-0")} style={{ background: "#E8A80E" }} />
                  )}
                  <span className="relative [&_svg]:w-4 [&_svg]:h-4 shrink-0" style={{color: active ? "#fff" : "rgba(255,255,255,0.55)"}}>
                    {tab.icon}
                  </span>
                  <span className="relative truncate">{tab.label}</span>
                </button>
              );
            })}

            {/* ── Divider ── */}
            <div className="my-3 border-t border-border/50" />

            {/* ── Section: Content ── */}
            <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-widest" style={{color: "rgba(255,255,255,0.4)"}}>
              {isAr ? "المحتوى" : "Content"}
            </p>
            {tabs.filter(t => ["tools","presentations","videos"].includes(t.id)).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.href) setLocation(tab.href);
                    else setActiveTab(tab.id);
                  }}
                  className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all overflow-hidden group"
                  style={active ? { background: "rgba(255,255,255,0.15)", color: "#fff" } : { color: "rgba(255,255,255,0.65)" }}
                >
                  {!active && (
                    <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(255,255,255,0.07)" }} />
                  )}
                  {active && (
                    <span className={cn("absolute top-1/2 -translate-y-1/2 w-1 h-5 rounded-full", isAr ? "end-0" : "start-0")} style={{ background: "#E8A80E" }} />
                  )}
                  <span className="relative [&_svg]:w-4 [&_svg]:h-4 shrink-0" style={{color: active ? "#fff" : "rgba(255,255,255,0.55)"}}>
                    {tab.icon}
                  </span>
                  <span className="relative truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* ── XP / Achievements sidebar card ── */}
          <SidebarXpCard setLocation={setLocation} isAr={isAr} />

        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0" style={{display: activeTab === "overview" ? "flex" : "block", flexDirection: "column"}}>
          {activeTab !== "overview" && (
            <div
              className={cn(
                "px-6 xl:px-10 2xl:px-14",
                activeTab === "library_competitions" ||
                  activeTab === "library_homework" ||
                  activeTab === "assignments"
                  ? "py-4 pt-4"
                  : "py-8",
              )}
            >
              <div
                className={cn(
                  activeTab === "library_competitions" ||
                    activeTab === "library_homework" ||
                    activeTab === "assignments"
                    ? "mb-3"
                    : "mb-6",
                )}
              >
                <GuestDraftImportBanner />
              </div>
              {/* Tab heading — skipped when the tab renders its own hero (libraries + assignments). */}
              {activeTab !== "library_competitions" &&
                activeTab !== "library_homework" &&
                activeTab !== "assignments" &&
                activeTab !== "competitive" && (
              <div className="mb-5">
                <h1 className="text-2xl font-extrabold text-foreground">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </h1>
              </div>
              )}
          {/* Prominent stat cards — hidden on tabs where they aren't relevant */}
          {!["tools", "competitive", "students", "shared", "library_homework", "library_competitions"].includes(activeTab) && (
          <div
            className={cn(
              "grid grid-cols-3 gap-3",
              activeTab === "assignments" ? "gap-3 sm:gap-3.5 mb-4 sm:mb-5" : "mb-7",
            )}
          >
            <div
              className={cn(
                "rounded-xl border flex items-center transition-[box-shadow,border-color,background-color] duration-150 ease-out",
                activeTab === "assignments"
                  ? "py-5 px-4 sm:py-[22px] sm:px-5 min-h-[108px] gap-3.5 sm:gap-4 border-border/28 bg-gradient-to-br from-card via-card to-primary/[0.055] shadow-[0_1px_2px_rgba(15,23,42,0.055),0_14px_36px_-20px_rgba(30,77,53,0.11)] hover:border-primary/16 hover:shadow-[0_18px_44px_-22px_rgba(30,77,53,0.13)]"
                  : "p-4 sm:p-[18px] gap-3 sm:gap-3.5 border-border/60 bg-card hover:border-primary/40",
              )}
            >
              <div
                className={cn(
                  "rounded-xl flex items-center justify-center shrink-0",
                  activeTab === "assignments"
                    ? "w-12 h-12 shadow-[0_2px_10px_-6px_rgba(30,77,53,0.35)] bg-primary/[0.1] text-primary ring-1 ring-primary/[0.11]"
                    : "w-11 h-11 bg-primary/10 text-primary",
                )}
              >
                <BookText className={cn(activeTab === "assignments" ? "w-6 h-6" : "w-5 h-5")} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {isAr ? "الواجبات" : "Assignments"}
                </p>
                <p
                  className={cn(
                    "font-black text-foreground leading-none tracking-tight tabular-nums mt-1",
                    activeTab === "assignments" ? "text-[1.7rem] sm:text-[1.875rem]" : "text-2xl",
                  )}
                >
                  {assignments?.length || 0}
                </p>
              </div>
            </div>
            <div
              className={cn(
                "rounded-xl border flex items-center transition-[box-shadow,border-color,background-color] duration-150 ease-out",
                activeTab === "assignments"
                  ? "py-5 px-4 sm:py-[22px] sm:px-5 min-h-[108px] gap-3.5 sm:gap-4 border-border/28 bg-gradient-to-br from-card via-card to-[#D9A521]/[0.052] shadow-[0_1px_2px_rgba(15,23,42,0.055),0_14px_36px_-20px_rgba(217,165,33,0.07)] hover:border-[#D9A521]/20 hover:shadow-[0_18px_44px_-22px_rgba(217,165,33,0.09)]"
                  : "p-4 sm:p-[18px] gap-3 sm:gap-3.5 border-border/60 bg-card hover:border-amber-400/50",
              )}
            >
              <div
                className={cn(
                  "rounded-xl flex items-center justify-center shrink-0",
                  activeTab === "assignments"
                    ? "w-12 h-12 shadow-[0_2px_10px_-6px_rgba(217,165,33,0.28)] bg-[#D9A521]/[0.1] text-[#6e5820] dark:text-[#d9c06e] ring-1 ring-[#D9A521]/13"
                    : "w-11 h-11 bg-amber-500/10 text-amber-600",
                )}
              >
                <CheckCircle2 className={cn(activeTab === "assignments" ? "w-6 h-6" : "w-5 h-5")} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {isAr ? "التسليمات" : "Submissions"}
                </p>
                <p
                  className={cn(
                    "font-black text-foreground leading-none tracking-tight tabular-nums mt-1",
                    activeTab === "assignments" ? "text-[1.7rem] sm:text-[1.875rem]" : "text-2xl",
                  )}
                >
                  {totalSubmissions}
                </p>
              </div>
            </div>
            <Link href="/teacher/students" className="block">
              <div
                className={cn(
                  "rounded-xl border flex items-center transition-[box-shadow,border-color,background-color] duration-150 ease-out h-full",
                  activeTab === "assignments"
                    ? "py-5 px-4 sm:py-[22px] sm:px-5 min-h-[108px] gap-3.5 sm:gap-4 border-border/28 bg-gradient-to-br from-card via-card to-emerald-700/[0.048] shadow-[0_1px_2px_rgba(15,23,42,0.055),0_14px_36px_-20px_rgba(22,101,52,0.09)] hover:border-emerald-600/20 hover:shadow-[0_18px_44px_-22px_rgba(22,101,52,0.11)]"
                    : "p-4 sm:p-[18px] gap-3 sm:gap-3.5 border-border/60 bg-card hover:border-emerald-400/50",
                )}
              >
                <div
                  className={cn(
                    "rounded-xl flex items-center justify-center shrink-0",
                    activeTab === "assignments"
                      ? "w-12 h-12 shadow-[0_2px_10px_-6px_rgba(22,101,52,0.28)] bg-emerald-700/[0.085] text-emerald-900 dark:text-emerald-400 ring-1 ring-emerald-700/11"
                      : "w-11 h-11 bg-emerald-500/10 text-emerald-600",
                  )}
                >
                  <TrendingUp className={cn(activeTab === "assignments" ? "w-6 h-6" : "w-5 h-5")} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {isAr ? "النشطة" : "Active"}
                  </p>
                  <p
                    className={cn(
                      "font-black text-foreground leading-none tracking-tight tabular-nums mt-1",
                      activeTab === "assignments" ? "text-[1.7rem] sm:text-[1.875rem]" : "text-2xl",
                    )}
                  >
                    {activeAssignments.length}
                  </p>
                </div>
              </div>
            </Link>
          </div>
          )}
          {tabContent}
            </div>
          )}
          {activeTab === "overview" && (
            <DashboardOverview
              user={user}
              assignments={assignments}
              isLoading={isAssignmentsLoading}
              lang={lang}
              setLocation={setLocation}
              setActiveTab={setActiveTab}
              startGame={openGameSetup}
              creatingGameForId={creatingGameForId}
            />
          )}
        </main>
      </div>

      {/* ── Mobile overview ── */}
      {activeTab === "overview" && (
        <div className="lg:hidden pb-28">
          <DashboardOverview
            user={user}
            assignments={assignments}
            isLoading={isAssignmentsLoading}
            lang={lang}
            setLocation={setLocation}
            setActiveTab={setActiveTab}
            startGame={openGameSetup}
            creatingGameForId={creatingGameForId}
          />
        </div>
      )}

      {/* ── Mobile layout (< lg) — non-overview tabs ──
          Header (logo + name + bell) is rendered in the global layout, and tab
          switching happens via the fixed bottom nav, so this view only needs a
          simple page title + the tab content. */}
      <div className={activeTab === "overview" ? "hidden" : "lg:hidden"}>
        <div className="px-4 pt-4 pb-2">
          <div className="mb-3">
            <GuestDraftImportBanner />
          </div>
          {activeTab !== "assignments" && activeTab !== "competitive" && (
          <h1 className="text-lg font-extrabold text-foreground flex items-center gap-2">
            <span className="[&_svg]:w-5 [&_svg]:h-5 text-primary">
              {tabs.find((t) => t.id === activeTab)?.icon}
            </span>
            {tabs.find((t) => t.id === activeTab)?.label}
          </h1>
          )}
        </div>

        {/* Tab content */}
        <div className="px-4 pb-28">{tabContent}</div>
      </div>

      {/* Fixed mobile bottom nav — visible on all teacher dashboard tabs (< lg) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/60 flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        dir={isAr ? "rtl" : "ltr"}
      >
        {tabs
          .filter((tab) =>
            ["overview", "assignments", "competitive", "tools", "islamic"].includes(tab.id),
          )
          .map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.href) setLocation(tab.href);
                  else setActiveTab(tab.id);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-3 px-0.5 transition-all relative",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Active indicator dot at top */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full"
                    style={{ background: "#D9A521" }}
                  />
                )}
                <span
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl transition-all [&_svg]:w-6 [&_svg]:h-6",
                    active ? "text-white" : "",
                  )}
                  style={active ? { background: "#225739" } : undefined}
                >
                  {tab.icon}
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-none",
                    active ? "font-bold" : "font-semibold",
                  )}
                >
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
      </nav>

      {/* ── Modal: اختيار لعبة من الواجب ── */}
      <AnimatePresence>
        {assignmentGamePickerId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setAssignmentGamePickerId(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              className="bg-card rounded-2xl border border-border shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6 border-b border-border/60 bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2">
                      <Gamepad2 className="w-6 h-6 text-primary shrink-0" />
                      {lang === "ar"
                        ? "اختر نوع اللعبة الحية"
                        : "Choose your live game"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {lang === "ar"
                        ? "أسئلة الواجب ستُستخدم في اللعبة التي تختارها. وميض هي اللعبة الافتراضية."
                        : "This assignment's questions power the mode you pick. Wameedh is the default."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignmentGamePickerId(null)}
                    className="shrink-0 rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label={lang === "ar" ? "إغلاق" : "Close"}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "knowledge_race" as const,
                      emoji: "⚡",
                      titleAr: "وميض",
                      titleEn: "Wameedh",
                      descAr:
                        "مسابقة حية على الشاشة الكبيرة — طلابك يجيبون من هواتفهم بأسلوب وميض.",
                      descEn:
                        "Live quiz on the big screen — students answer from phones, Wameedh-style.",
                      gradient: "from-fuchsia-500 to-purple-600",
                      defaultBadge: true,
                    },
                    {
                      key: "tug_of_war" as const,
                      emoji: "🪢",
                      titleAr: "شد الحبل",
                      titleEn: "Tug of War",
                      descAr:
                        "فريقان يتنافسان بالإجابة؛ الحبل يتحرك مع كل إجابة صحيحة.",
                      descEn:
                        "Two teams answer MCQs; the rope moves with each correct answer.",
                      gradient: "from-blue-500 to-indigo-600",
                    },
                    {
                      key: "million" as const,
                      emoji: "🏆",
                      titleAr: "من سيحصد المليون؟",
                      titleEn: "Who Wants a Million?",
                      descAr:
                        "سلسلة أسئلة متصاعدة مع أطواق نجاة — يحتاج واجبك ٥ أسئلة أو أكثر.",
                      descEn:
                        "Escalating questions with lifelines — assignment needs 5+ questions.",
                      gradient: "from-amber-500 to-orange-600",
                    },
                    {
                      key: "hack" as const,
                      emoji: "💻",
                      titleAr: "لعبة الاختراق",
                      titleEn: "Hack Game",
                      descAr:
                        "ماراثون تنافسي: كلمات سر، صناديق، وسحب نقاط بين الطلاب.",
                      descEn:
                        "Competitive marathon: passwords, loot boxes, steal points.",
                      gradient: "from-emerald-700 to-teal-800",
                    },
                    {
                      key: "rocket_race" as const,
                      emoji: "🚀",
                      titleAr: "سباق الصواريخ",
                      titleEn: "Rocket Race",
                      descAr:
                        "كل طالب صاروخاً يصعد مع الإجابات الصحيحة السريعة.",
                      descEn:
                        "Each student is a rocket — faster correct answers climb higher.",
                      gradient: "from-violet-500 to-fuchsia-600",
                    },
                    {
                      key: "hotseat" as const,
                      emoji: "🔥",
                      titleAr: "الكرسي الساخن",
                      titleEn: "HotSeat",
                      descAr:
                        "طالب على الكرسي يجيب على أسئلة زملائه المجهولة والجميع يصوّت.",
                      descEn:
                        "One student answers anonymous classmates' questions — everyone votes.",
                      gradient: "from-orange-500 to-red-600",
                    },
                  ] as const
                ).map((opt) => {
                  const busy =
                    creatingGameForId === assignmentGamePickerId &&
                    opt.key === "hack";
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={busy}
                      onClick={() => handleAssignmentGameChoice(opt.key)}
                      className="text-start rounded-2xl border-2 border-border/70 bg-card hover:border-primary/50 hover:bg-primary/[0.03] hover:shadow-lg transition-all p-4 flex flex-col gap-2 disabled:opacity-60 disabled:pointer-events-none group"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.gradient} flex items-center justify-center text-2xl shadow-md shrink-0`}
                        >
                          {opt.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-0.5">
                            <span className="font-black text-base text-foreground leading-tight">
                              {lang === "ar" ? opt.titleAr : opt.titleEn}
                            </span>
                            {(opt as { defaultBadge?: boolean }).defaultBadge && (
                              <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                                {lang === "ar" ? "افتراضي" : "Default"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                            {lang === "ar" ? opt.descAr : opt.descEn}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-primary group-hover:underline mt-1">
                        {busy
                          ? lang === "ar"
                            ? "جاري الإنشاء…"
                            : "Creating…"
                          : lang === "ar"
                            ? "اضغط للمتابعة ←"
                            : "Tap to continue →"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal إعداد اللعبة ── */}
      <AnimatePresence>
        {gameSetupModal !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setGameSetupModal(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <Gamepad2 className="w-12 h-12 text-purple-500 mx-auto mb-2" />
                <h3 className="text-xl font-black text-foreground">
                  {t.teacherGame.gameMode}
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => setGameMode("solo")}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${gameMode === "solo" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-border bg-muted/30 text-muted-foreground hover:border-purple-300"}`}
                >
                  <User className="w-7 h-7 mx-auto mb-1.5" />
                  <p className="font-black text-sm">{t.teacherGame.soloMode}</p>
                  <p className="text-xs mt-0.5 opacity-70">
                    {t.teacherGame.soloModeDesc}
                  </p>
                </button>
                <button
                  onClick={() => setGameMode("teams")}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${gameMode === "teams" ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" : "border-border bg-muted/30 text-muted-foreground hover:border-purple-300"}`}
                >
                  <UsersRound className="w-7 h-7 mx-auto mb-1.5" />
                  <p className="font-black text-sm">{t.teacherGame.teamMode}</p>
                  <p className="text-xs mt-0.5 opacity-70">
                    {t.teacherGame.teamModeDesc}
                  </p>
                </button>
              </div>
              {gameMode === "teams" && (
                <div className="mb-5 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-2 text-center">
                      {t.teacherGame.teamCount}
                    </label>
                    <div className="flex justify-center gap-2">
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => setTeamCount(n)}
                          className={`w-10 h-10 rounded-xl font-black text-base transition-all ${teamCount === n ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-2 text-center">
                      {lang === "ar"
                        ? "أسماء الفرق (اختياري)"
                        : "Team Names (optional)"}
                    </label>
                    <div className="space-y-2">
                      {Array.from({ length: teamCount }).map((_, i) => {
                        const defaults =
                          lang === "ar"
                            ? [
                                "الأذكياء",
                                "المتميزون",
                                "الفائقون",
                                "المبدعون",
                                "الرائعون",
                                "الرياديون",
                              ]
                            : [
                                "Champions",
                                "Stars",
                                "Warriors",
                                "Innovators",
                                "Legends",
                                "Pioneers",
                              ];
                        return (
                          <input
                            key={i}
                            type="text"
                            value={customTeamNames[i] || ""}
                            onChange={(e) => {
                              const next = [...customTeamNames];
                              next[i] = e.target.value;
                              setCustomTeamNames(next);
                            }}
                            placeholder={defaults[i]}
                            maxLength={20}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-muted/30 text-foreground text-sm font-bold focus:outline-none focus:border-purple-400 transition-colors"
                            dir={lang === "ar" ? "rtl" : "ltr"}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-1.5">
                      {lang === "ar"
                        ? "اتركها فارغة للاستخدام الافتراضي"
                        : "Leave blank to use defaults"}
                    </p>
                  </div>
                </div>
              )}
              <div className="mb-5">
                <ClassSelector
                  value={gameTargetClass}
                  onChange={setGameTargetClass}
                  accent="#a855f7"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setGameSetupModal(null)}
                  className="flex-1 px-4 py-3 bg-muted text-muted-foreground rounded-xl font-bold hover:bg-muted/80 transition-colors"
                >
                  {t.teacherGame.cancelGame}
                </button>
                <button
                  onClick={confirmStartGame}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black shadow-lg shadow-green-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <Gamepad2 className="w-5 h-5" />
                  {t.teacherGame.startGame}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

const BASE_URL = import.meta.env.VITE_API_URL || "";

interface DashboardCollection {
  id: number;
  name: string;
  description: string | null;
  coverImageUrl?: string | null;
  isPublic?: boolean;
  itemCount: number;
  assignmentIds: number[];
  teacherName?: string;
}

interface VideoLessonSummary {
  id: number;
  title: string;
  subject: string | null;
  videoType: string;
  targetClass: string | null;
  createdAt: string;
  questionCount: number;
  submissionCount: number;
}

function AssignmentsTab({
  assignments,
  isLoading,
  creatingGameForId,
  startGame,
  lang,
  t,
  setLocation,
  setActiveTab,
  deleteAssignment,
  queryClient,
}: any) {
  const [collections, setCollections] = useState<DashboardCollection[]>([]);
  const [creatingGroupName, setCreatingGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  function loadCollections() {
    fetch(`${BASE_URL}/api/collections`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: DashboardCollection[]) =>
        setCollections(Array.isArray(data) ? data : []),
      )
      .catch(() => {});
  }

  async function addToCollection(collectionId: number, assignmentId: number) {
    // Optimistic update — show the assignment in the collection immediately
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? {
              ...c,
              assignmentIds: c.assignmentIds?.includes(assignmentId)
                ? c.assignmentIds
                : [...(c.assignmentIds || []), assignmentId],
              itemCount: c.assignmentIds?.includes(assignmentId)
                ? c.itemCount
                : (c.itemCount || 0) + 1,
            }
          : c,
      ),
    );
    try {
      const r = await fetch(
        `${BASE_URL}/api/collections/${collectionId}/items`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId, itemOrder: 0 }),
        },
      );
      if (r.ok) {
        toast.success(
          lang === "ar" ? "تمت الإضافة للمجموعة" : "Added to group",
        );
        loadCollections();
      } else {
        // Revert optimistic update on failure
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId
              ? {
                  ...c,
                  assignmentIds: (c.assignmentIds || []).filter(
                    (id) => id !== assignmentId,
                  ),
                  itemCount: Math.max(0, (c.itemCount || 0) - 1),
                }
              : c,
          ),
        );
        const d = await r.json().catch(() => ({}));
        toast.error(d.message || (lang === "ar" ? "خطأ" : "Error"));
      }
    } catch {
      // Revert optimistic update on error
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                assignmentIds: (c.assignmentIds || []).filter(
                  (id) => id !== assignmentId,
                ),
                itemCount: Math.max(0, (c.itemCount || 0) - 1),
              }
            : c,
        ),
      );
      toast.error(lang === "ar" ? "خطأ" : "Error");
    }
  }

  async function removeFromCollection(
    collectionId: number,
    assignmentId: number,
  ) {
    const col = collections.find((c) => c.id === collectionId);
    if (!col) return;
    try {
      const itemsRes = await fetch(
        `${BASE_URL}/api/collections/${collectionId}/items`,
        { credentials: "include", cache: "no-store" },
      );
      if (!itemsRes.ok) return;
      const data = await itemsRes.json();
      const item = (data.items || []).find(
        (it: any) => it.assignmentId === assignmentId,
      );
      if (!item) return;
      const r = await fetch(
        `${BASE_URL}/api/collections/${collectionId}/items/${item.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (r.ok) {
        toast.success(
          lang === "ar" ? "تمت الإزالة من المجموعة" : "Removed from group",
        );
        loadCollections();
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ" : "Error");
    }
  }

  async function createGroupAndAdd(assignmentId: number) {
    if (!creatingGroupName.trim()) return;
    setSavingGroup(true);
    try {
      const r = await fetch(`${BASE_URL}/api/collections`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: creatingGroupName.trim() }),
      });
      if (r.ok) {
        const newCol = await r.json();
        toast.success(
          lang === "ar"
            ? `تم إنشاء "${newCol.name}"`
            : `Created "${newCol.name}"`,
        );
        setCreatingGroupName("");
        await addToCollection(newCol.id, assignmentId);
        loadCollections();
      }
    } catch {
      toast.error(lang === "ar" ? "خطأ" : "Error");
    } finally {
      setSavingGroup(false);
    }
  }

  const filteredAssignments = !assignments ? [] : assignments;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="p-4 sm:p-5 border-border/45 rounded-xl shadow-sm"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-16 bg-muted/60 rounded-md skeleton-shimmer" />
                  <div className="h-5 w-40 bg-muted/50 rounded-md skeleton-shimmer" />
                </div>
                <div className="h-4 w-60 bg-muted/30 rounded skeleton-shimmer" />
              </div>
              <div className="h-8 w-20 bg-muted/40 rounded-lg skeleton-shimmer" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card className="py-14 text-center border-dashed border-border/60 rounded-xl bg-muted/[0.03] shadow-sm">
        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-primary/[0.08] flex items-center justify-center ring-1 ring-primary/12">
          <BookText className="w-7 h-7 text-primary/75" />
        </div>
        <h3 className="text-base font-bold text-foreground mb-1">
          {t.dashboard.noAssignments}
        </h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto leading-relaxed">
          {t.dashboard.noAssignmentsDesc}
        </p>
        <Button
          onClick={() => setLocation("/teacher/new")}
          className="font-bold rounded-xl shadow-md"
          style={{
            background: "linear-gradient(180deg, #1b5c3d 0%, #154a33 100%)",
            boxShadow: "0 10px 24px -14px rgba(21, 74, 51, 0.5)",
          }}
        >
          {t.dashboard.createAssignment}
        </Button>
      </Card>
    );
  }

  return (
    <AssignmentsTabRender
      assignments={assignments}
      filteredAssignments={filteredAssignments}
      collections={collections}
      creatingGameForId={creatingGameForId}
      startGame={startGame}
      deleteAssignment={deleteAssignment}
      setLocation={setLocation}
      setActiveTab={setActiveTab}
      lang={lang}
      t={t}
      queryClient={queryClient}
      addToCollection={addToCollection}
      removeFromCollection={removeFromCollection}
      creatingGroupName={creatingGroupName}
      setCreatingGroupName={setCreatingGroupName}
      createGroupAndAdd={createGroupAndAdd}
      savingGroup={savingGroup}
    />
  );
}

function CompetitiveTab({
  t,
  lang,
  setLocation,
  user,
  mcqAssignments,
  creatingGameForId,
  startGame,
  initialOpenWameeth,
  onConsumeWameethDeepLink,
}: any) {
  const [showKnowledgeRace, setShowKnowledgeRace] = useState(false);
  const [showWameethModal, setShowWameethModal] = useState(false);
  const wameethPickerRef = useRef<HTMLDivElement | null>(null);
  const [showMaraquiPublic, setShowMaraquiPublic] = useState(false);
  const BASE = import.meta.env.VITE_API_URL || "";

  const isAdmin = Boolean(user?.isAdmin) || user?.role === "admin";
  const maraquiVisible = isAdmin || showMaraquiPublic;

  useEffect(() => {
    fetch(`${BASE}/api/public/settings`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        if (d?.showMaraqui !== undefined) setShowMaraquiPublic(Boolean(d.showMaraqui));
      });
  }, [BASE]);

  useEffect(() => {
    if (!initialOpenWameeth) return;
    setShowWameethModal(true);
    onConsumeWameethDeepLink?.();
  }, [initialOpenWameeth, onConsumeWameethDeepLink]);

  const openGameFromCatalog = (game: {
    type: string;
    available?: boolean;
  }) => {
    if (game.available === false) return;
    const { type } = game;
    if (type === "knowledge_race") {
      setShowWameethModal(true);
      return;
    }
    else if (type === "tug_of_war") setLocation("/game/tug/create");
    else if (type === "rocket_race") setLocation("/game/rocket/create");
    else if (type === "wheel_of_fortune") setLocation("/game/wheel/create");
    else if (type === "hotseat") setLocation("/game/hotseat/create");
    else if (type === "video_lesson")
      setLocation("/teacher/video-lesson/new");
    else if (type === "flag_quiz") setLocation("/game/flags");
    else if (type === "capitals") setLocation("/game/capitals");
    else if (type === "color_game") setLocation("/game/color");
    else if (type === "memory_match") setLocation("/game/memory");
    else if (type === "multiplication") setLocation("/game/multiply");
    else if (type === "scramble_words") setLocation("/game/scramble");
    else if (type === "stroop") setLocation("/game/stroop/create");
    else if (type === "maraqui") setLocation("/game/maraqui");
    else if (type === "million") setLocation("/game/million");
    else if (type === "million_team")
      setLocation("/game/million/team-setup");
    else if (type === "hack") setLocation("/game/hack");
    else if (type === "letrly") setLocation("/game/letrly");
    else if (type === "arena") setLocation("/game/arena");
  };

  /** تحدّي حصاد — يُعرَض بجوار مسابقات عامة (لا يُكرَّر في شبكة المسابقات الحية) */
  const arenaGame = {
    icon: "⚔️",
    title: lang === "ar" ? "تحدّي حصاد" : "Hasad Arena",
    desc:
      lang === "ar"
        ? "مسابقة فريقين على شاشة كبيرة — 6 فئات، 6 بطاقات لكل فئة (200 و 400 و 600)، وسائل مساعدة استراتيجية، ومناسبة للكبار والمؤسسات والصفوف."
        : "Two-team big-screen quiz — 6 categories with 6 cards each (200/400/600), strategic helpers, suitable for adults, institutions, and classrooms.",
    color: "from-emerald-700 to-amber-600",
    type: "arena",
    available: true,
    pill: lang === "ar" ? "شاشة كبيرة · جديد" : "Big screen · New",
  };

  /** مسابقات مع طلاب الصف — أسئلة من واجباتك أو بنك الأسئلة */
  const liveGames = [
    {
      icon: <WameethIcon height={44} />,
      title:
        t.competitiveGames?.knowledgeRaceTitle ||
        (lang === "ar" ? "وميض" : "Wameeth"),
      desc:
        t.competitiveGames?.knowledgeRaceDesc ||
        (lang === "ar"
          ? "مسابقة حية على الشاشة — الطلاب يجيبون من هواتفهم بأسلوب وميض. اربطها بواجبك."
          : "Live quiz on screen — students answer on phones, Wameedh-style. Link an assignment."),
      color: "from-[#0D2118] to-[#1A4030]",
      type: "knowledge_race",
      available: true,
      pill:
        lang === "ar" ? "موصى به — وميض" : "Recommended — Wameedh",
    },
    {
      icon: <TugWarIcon size={70} />,
      title: lang === "ar" ? "شد الحبل" : "Tug of War",
      desc:
        lang === "ar"
          ? "فريقان يتنافسان بأسئلة اختيار من متعدد؛ الحبل يتحرك مع كل إجابة صحيحة."
          : "Two teams battle with MCQs; the rope swings with correct answers.",
      color: "from-blue-500 to-indigo-600",
      type: "tug_of_war",
      available: true,
      pill: lang === "ar" ? "جماعي" : "Team play",
    },
    {
      icon: <WheelIcon size={52} />,
      title: lang === "ar" ? "عجلة الحظ" : "Wheel of Fortune",
      desc:
        lang === "ar"
          ? "أدر العجلة على شاشة الفصل، اقرأ السؤال، ومنح النقاط للفرق — أسئلة جاهزة بالذكاء الاصطناعي."
          : "Spin the wheel on the class display, read the question, and award team points — AI-generated segments.",
      color: "from-emerald-700 to-yellow-600",
      type: "wheel_of_fortune",
      available: true,
      pill: lang === "ar" ? "عرض صفّي" : "Class display",
    },
    {
      icon: <RocketIcon size={62} />,
      title: lang === "ar" ? "سباق الصواريخ" : "Rocket Race",
      desc:
        lang === "ar"
          ? "كل طالب صاروخ — السرعة والدقة ترقيه في المدرج. جيد للحماس الفردي داخل الصف."
          : "Each student is a rocket — speed and accuracy climb the leaderboard.",
      color: "from-violet-500 to-fuchsia-600",
      type: "rocket_race",
      available: true,
      pill: lang === "ar" ? "سباق حي" : "Live race",
    },
    {
      icon: "🔥",
      title: lang === "ar" ? "الكرسي الساخن" : "HotSeat",
      desc:
        lang === "ar"
          ? "طالب يجلس على الكرسي ويجيب على أسئلة زملائه المجهولة — والجميع يصوّت على إجابته. نقاط للأسرع والأكثر إقناعاً!"
          : "One student sits in the hot seat and answers anonymous classmates' questions — everyone votes. Points for speed and persuasion!",
      color: "from-orange-500 to-red-600",
      type: "hotseat",
      available: true,
      pill: lang === "ar" ? "حوار وتقييم" : "Q&A + vote",
    },
    {
      icon: "🏆",
      title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wants a Million?",
      desc:
        lang === "ar"
          ? "أسئلة متصاعدة حتى الجائزة الكبرى مع أطواق نجاة — مناسبة للعرض على السبورة."
          : "Escalating ladder to the grand prize with lifelines — great for whole-class display.",
      color: "from-amber-500 to-yellow-600",
      type: "million",
      available: true,
      pill: lang === "ar" ? "عرض صفّي" : "Class display",
    },
    {
      icon: <HackIcon size={58} />,
      title: lang === "ar" ? "لعبة الاختراق" : "Hack Game",
      desc:
        lang === "ar"
          ? "ماراثون تقني: كلمات سر، صناديق، وسحب نقاط بين الطلاب في جوّ مسابقات."
          : "Terminal marathon: passwords, loot boxes, steal points — competitive energy.",
      color: "from-green-700 to-emerald-900",
      type: "hack",
      available: true,
      pill: lang === "ar" ? "تنافس عالي" : "High stakes",
    },
    {
      icon: "🆚",
      title:
        lang === "ar" ? "مليون — فريق ضد فريق" : "Million — Team vs Team",
      desc:
        lang === "ar"
          ? "فريقان يصوتان على نفس الأسئلة في الوقت الفعلي كما في برامج التلفاز."
          : "Two teams vote on the same questions in real-time TV-show style.",
      color: "from-blue-500 to-purple-600",
      type: "million_team",
      available: true,
      pill: lang === "ar" ? "تصويت جماعي" : "Team voting",
    },
    {
      icon: "🎬",
      title: lang === "ar" ? "فيديو تفاعلي" : "Interactive Video",
      desc:
        lang === "ar"
          ? "أنشئ درس فيديو يتوقف تلقائياً عند الأسئلة لقياس الفهم أثناء العرض."
          : "Video lessons that pause for questions — formative checks while watching.",
      color: "from-red-500 to-rose-600",
      type: "video_lesson",
      available: true,
      pill: lang === "ar" ? "درس مرئي" : "Video lesson",
    },
  ];

  /** تحديات فردية — للتمرّن أو مسابقات الزوار بدون غرفة صفّية مباشرة */
  const soloGamesAll = [
    {
      icon: "🪜",
      title: lang === "ar" ? "مَراقي" : "Maraqui",
      desc:
        lang === "ar"
          ? "مسابقة ثقافية بمراحل متدرجة حتى المرحلة الأخيرة — تحدّ نفسك بالتاريخ والثقافة."
          : "Progressive cultural quiz ladder — challenge yourself to the final stage.",
      color: "from-teal-500 to-emerald-600",
      type: "maraqui",
      available: true,
      pill: lang === "ar" ? "مراحل" : "Stages",
      _gated: "maraqui" as const,
    },
    {
      icon: <ColorGameIcon size={54} />,
      title: lang === "ar" ? "لعبة الألوان" : "Color Game",
      desc:
        lang === "ar"
          ? "اختبار تركيز بصري — اعثر على المربع المختلف بين شبكة متشابهة بسرعة."
          : "Visual attention — spot the odd square in a grid, fast.",
      color: "from-violet-500 to-fuchsia-600",
      type: "color_game",
      available: true,
      pill: lang === "ar" ? "تركيز" : "Focus",
    },
    {
      icon: <FlagQuizIcon size={58} />,
      title: lang === "ar" ? "أعلام الدول" : "Flag Quiz",
      desc:
        lang === "ar"
          ? "اختبر ذاكرتك الجغرافية بربط الدول بأعلامها في وقت محدود."
          : "Geography recall — match flags to countries against the clock.",
      color: "from-sky-500 to-indigo-600",
      type: "flag_quiz",
      available: true,
      pill: lang === "ar" ? "جغرافيا" : "Geo",
    },
    {
      icon: <CapitalsIcon height={44} />,
      title: lang === "ar" ? "عواصم البلدان" : "World Capitals",
      desc:
        lang === "ar"
          ? "اختبر معلوماتك الجغرافية بتحديد عواصم دول العالم — منافردة أو مع الآخرين."
          : "Test your geography knowledge by naming world capitals — solo or multiplayer.",
      color: "from-teal-500 to-cyan-600",
      type: "capitals",
      available: true,
      pill: lang === "ar" ? "جغرافيا" : "Geo",
    },
    {
      icon: <MemoryIcon size={56} />,
      title: lang === "ar" ? "لعبة الذاكرة" : "Memory Match",
      desc:
        lang === "ar"
          ? "اقلب البطاقات واذكر مواقع الأزواج — تمرين ذاكرة عملي وممتع."
          : "Flip and pair cards — practical memory training.",
      color: "from-indigo-500 to-pink-600",
      type: "memory_match",
      available: true,
      pill: lang === "ar" ? "ذاكرة" : "Memory",
    },
    {
      icon: <MultiplyIcon size={56} />,
      title: lang === "ar" ? "جدول الضرب" : "Multiplication",
      desc:
        lang === "ar"
          ? "سرعة وحساب — سلسلة أسئلة ضرب لتثبيت الجدول بطريقة لعبية."
          : "Speed drills — multiplication chains in a playful loop.",
      color: "from-orange-500 to-amber-600",
      type: "multiplication",
      available: true,
      pill: lang === "ar" ? "رياضيات" : "Math",
    },
    {
      icon: <StroopIcon size={56} />,
      title: lang === "ar" ? "لعبة ارتباك" : "Stroop Game",
      desc:
        lang === "ar"
          ? "اضغط لون الحبر لا معنى الكلمة — كلاسيك علم النفس المعرفي."
          : "Tap ink color, not word meaning — classic cognitive science.",
      color: "from-red-500 to-orange-600",
      type: "stroop",
      available: true,
      pill: lang === "ar" ? "دماغ" : "Brain",
    },
    {
      icon: <ScrambleIcon size={56} />,
      title: lang === "ar" ? "الكلمات المبعثرة" : "Scrambled Words",
      desc:
        lang === "ar"
          ? "رتّب الحروف لتكوين الكلمات — مناسبة للتهجئة والمفردات."
          : "Unscramble letters — spelling and vocabulary practice.",
      color: "from-violet-500 to-fuchsia-600",
      type: "scramble_words",
      available: true,
      pill: lang === "ar" ? "إملاء" : "Spelling",
    },
    {
      icon: <LetrlyIcon size={56} />,
      title: lang === "ar" ? "خمن الكلمة — WORDLE" : "Guess the Word — WORDLE",
      desc:
        lang === "ar"
          ? "Wordle بالعربية — كلمة سرّية ومحاولات محدودة، للعب الفردي أو مشاركة الرابط مع الطلاب."
          : "Wordle-style — secret word, limited guesses; solo or share a link.",
      color: "from-emerald-500 to-teal-600",
      type: "letrly",
      available: true,
      pill: lang === "ar" ? "كلمة يومية" : "Daily word",
    },
  ];

  const soloGames = soloGamesAll.filter(
    (g) => !("_gated" in g) || g._gated !== "maraqui" || maraquiVisible,
  );

  const GameCatalogSection = ({
    title,
    subtitle,
    accentClass,
    games,
    delayOffset,
  }: {
    title: string;
    subtitle: string;
    accentClass: string;
    games: typeof liveGames;
    delayOffset: number;
  }) => (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3
              className={`text-lg sm:text-xl font-black tracking-tight ${accentClass}`}
            >
              {title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {games.map((game, i) => (
          <motion.div
            key={`${game.type}-${i}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (delayOffset + i) * 0.04 }}
          >
            <Card
              className="group h-full p-4 sm:p-5 cursor-pointer transition-all hover:shadow-xl hover:border-primary/35 hover:-translate-y-0.5 border-2 border-border/70 bg-card"
              onClick={() => openGameFromCatalog(game)}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={`shrink-0 rounded-2xl shadow-lg flex items-center justify-center text-2xl ${(["knowledge_race","wheel_of_fortune","hack","tug_of_war","color_game","flag_quiz","capitals","memory_match","multiplication","stroop","scramble_words","letrly","rocket_race"] as string[]).includes(game.type) ? "" : `w-14 h-14 bg-gradient-to-br ${game.color}`}`}
                >
                  {game.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-black text-base sm:text-lg text-foreground leading-snug">
                      {game.title}
                    </h4>
                    {(game as any).pill && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {(game as any).pill}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {game.desc}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-[11px] font-bold text-primary group-hover:underline">
                  {game.type === "knowledge_race"
                    ? lang === "ar"
                      ? "اختر واجباً وابدأ ←"
                      : "Pick assignment & start →"
                    : game.type === "tug_of_war" ||
                        game.type === "video_lesson" ||
                        game.type === "rocket_race" ||
                        game.type === "hotseat"
                      ? lang === "ar"
                        ? "إنشاء غرفة ←"
                        : "Create session →"
                      : lang === "ar"
                        ? "فتح اللعبة ←"
                        : "Open game →"}
                </span>
                <Gamepad2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );

  return (
    <>
    <div className="space-y-10">
      {/* ألعاب ومسابقات جماهيرية — تحدّي حصاد + مسابقات عامة */}
      <section className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-lg sm:text-xl font-black tracking-tight text-foreground">
            {lang === "ar"
              ? "ألعاب ومسابقات جماهيرية"
              : "Public games & quiz contests"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
            {lang === "ar"
              ? "تحدٍّ على الشاشة الكبيرة للجميع، ومكتبة مسابقات عامة يمكن مشاركتها بالرابط أو الرمز."
              : "Big-screen challenges for audiences plus ready quizzes you can share by link or PIN."}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
          <Card
            onClick={() => openGameFromCatalog(arenaGame)}
            className="group p-4 sm:p-5 cursor-pointer transition-all hover:shadow-xl hover:border-[#b8922e]/45 hover:-translate-y-0.5 border-2 border-border/70 bg-gradient-to-br from-[#0a1c15]/90 via-card to-amber-500/[0.08] dark:from-[#0d241c]/80"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${arenaGame.color} flex items-center justify-center text-2xl shadow-lg shrink-0`}
                aria-hidden
              >
                {arenaGame.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <h3 className="text-base sm:text-lg font-black text-foreground">
                    {arenaGame.title}
                  </h3>
                  {arenaGame.pill && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {arenaGame.pill}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                  {arenaGame.desc}
                </p>
              </div>
              <ChevronLeft
                className={`w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors ${lang === "ar" ? "" : "rotate-180"}`}
              />
            </div>
          </Card>

          <Card
            onClick={() => setLocation("/islamic")}
            className="group p-4 sm:p-5 cursor-pointer transition-all hover:shadow-xl hover:border-amber-500/35 hover:-translate-y-0.5 border-2 border-border/70 bg-gradient-to-br from-amber-500/12 via-card to-orange-500/8"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shrink-0">
                <Medal className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-foreground">
                  {lang === "ar" ? "مسابقات عامة" : "Public Quizzes"}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {lang === "ar"
                    ? "مكتبة مسابقات جاهزة للزوار والطلاب — شاركها برابط أو رمز."
                    : "Ready-made quizzes for visitors and students — share by link or PIN."}
                </p>
              </div>
              <ChevronLeft
                className={`w-5 h-5 text-muted-foreground group-hover:text-primary shrink-0 transition-colors ${lang === "ar" ? "" : "rotate-180"}`}
              />
            </div>
          </Card>

          {/* وميض حر — مسابقة فردية بالرابط */}
          <Card
            onClick={() => setLocation("/teacher/solo-challenges")}
            className="group p-4 sm:p-5 cursor-pointer transition-all hover:shadow-xl hover:border-yellow-500/45 hover:-translate-y-0.5 border-2 border-border/70 bg-gradient-to-br from-yellow-500/10 via-card to-amber-400/8"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <WameethIcon height={40} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <h3 className="text-base sm:text-lg font-black text-foreground">
                    {lang === "ar" ? "وميض حر" : "Free Flash"}
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 border border-yellow-500/25">
                    {lang === "ar" ? "بالرابط" : "Link"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {lang === "ar"
                    ? "أنشئ مسابقة وأرسل رابطها — يجيب المشاركون في أي وقت بشكل فردي."
                    : "Create a quiz, share the link — participants answer anytime, individually."}
                </p>
              </div>
              <ChevronLeft
                className={`w-5 h-5 text-muted-foreground group-hover:text-yellow-500 shrink-0 transition-colors ${lang === "ar" ? "" : "rotate-180"}`}
              />
            </div>
          </Card>
        </div>
      </section>

      <GameCatalogSection
        title={
          lang === "ar"
            ? "مسابقات حية مع الصفّ"
            : "Live classroom games"
        }
        subtitle={
          lang === "ar"
            ? "ألعاب جماعية بوقت حقيقي — اربط واجباتك أو أنشئ غرفة وشارك الرمز أو الرابط مع الطلاب."
            : "Real-time whole-class modes — tie to assignments or create a room and share PIN/link."
        }
        accentClass="text-primary"
        games={liveGames}
        delayOffset={0}
      />

      {/* ── Modal: وميض — اختر الواجب ── */}
      <AnimatePresence>
        {showWameethModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowWameethModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-card w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-border/60 bg-gradient-to-r from-fuchsia-500/10 to-purple-600/10 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚡</span>
                  <div>
                    <h3 className="text-lg font-black text-foreground">
                      {lang === "ar" ? "وميض — ابدأ مسابقة حية" : "Wameeth — Start a Live Quiz"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lang === "ar"
                        ? "اختر الواجب الذي تريد استخدام أسئلته"
                        : "Pick an assignment to power your live room"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWameethModal(false)}
                  className="rounded-xl p-2 text-muted-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-4 sm:p-5">
                {mcqAssignments.length === 0 ? (
                  <div className="py-12 text-center">
                    <span className="text-5xl mb-4 block">📭</span>
                    <h4 className="font-bold text-foreground mb-2">
                      {lang === "ar" ? "لا توجد واجبات بأسئلة" : "No assignments with questions"}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      {lang === "ar"
                        ? "أنشئ واجباً يحتوي أسئلة اختيار من متعدد أولاً"
                        : "Create an assignment with MCQ questions first"}
                    </p>
                    <button
                      onClick={() => { setShowWameethModal(false); setLocation("/teacher/new"); }}
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      {lang === "ar" ? "إنشاء واجب" : "Create assignment"}
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mcqAssignments.map((assignment: any) => (
                      <button
                        key={assignment.id}
                        onClick={() => {
                          setShowWameethModal(false);
                          startGame(assignment.id);
                        }}
                        disabled={creatingGameForId === assignment.id}
                        className="text-start p-4 rounded-2xl border border-border hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-md transition-all group disabled:opacity-60"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center shrink-0 group-hover:bg-fuchsia-500/20 transition-colors">
                            <Gamepad2 className="w-5 h-5 text-fuchsia-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate text-sm">
                              {assignment.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {assignment.subject} · {assignment.questionCount} {lang === "ar" ? "سؤال" : "questions"}
                            </p>
                          </div>
                          <ChevronLeft className={`w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors ${lang === "ar" ? "" : "rotate-180"}`} />
                        </div>
                        {creatingGameForId === assignment.id && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-primary font-medium">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {lang === "ar" ? "جاري الإنشاء..." : "Creating..."}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Safe area spacer for mobile */}
              <div className="h-2 sm:h-0 shrink-0" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* وميض: اختيار الواجب — مباشرة تحت بطاقات المسابقات الحية */}
      <div
        ref={wameethPickerRef}
        id="wameeth-assignment-picker"
        className="scroll-mt-28"
      >
        <AnimatePresence>
          {showKnowledgeRace && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 pb-2">
                <Card className="p-4 sm:p-6 border-2 border-primary/25 bg-primary/[0.03] shadow-lg">
                  <h3 className="text-lg font-black text-foreground mb-1 flex items-center gap-2">
                    <Gamepad2 className="w-6 h-6 text-primary shrink-0" />
                    {lang === "ar"
                      ? "وميض — اختر الواجب وابدأ المسابقة الحية"
                      : "Wameeth — pick an assignment to host"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    {lang === "ar"
                      ? "كل واجب يحتوي أسئلة اختيار من متعدد يمكن استخدامه في الغرفة الحية. بعد الاختيار ستُفتح نافذة إعداد الفرق ثم مشاركة الرمز مع الطلاب."
                      : "Any assignment with MCQs can power your live room. After you pick one, you'll set teams/solo mode then share the PIN."}
                  </p>
                  {mcqAssignments.length === 0 ? (
                    <Card className="py-12 text-center border-dashed border-primary/30 bg-muted/20">
                      <Gamepad2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                      <h4 className="text-lg font-bold text-foreground mb-1">
                        {t.dashboard.noMcqAssignments}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t.dashboard.noMcqDesc}
                      </p>
                      <Button
                        onClick={() => setLocation("/teacher/new")}
                        className="gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        {t.dashboard.createNew}
                      </Button>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {mcqAssignments.map((assignment: any, i: number) => (
                        <motion.div
                          key={assignment.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <Card className="p-4 sm:p-5 hover:border-primary/40 hover:shadow-md transition-all group border-border">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                  {assignment.title}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {assignment.subject} — {assignment.questionCount}{" "}
                                  {t.dashboard.questionsCount}
                                </p>
                              </div>
                              <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                                <Gamepad2 className="w-4 h-4" />
                              </div>
                            </div>
                            <button
                              onClick={() => startGame(assignment.id)}
                              disabled={
                                creatingGameForId === assignment.id
                              }
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-emerald-700 text-primary-foreground rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
                            >
                              <Gamepad2 className="w-4 h-4" />
                              {creatingGameForId === assignment.id
                                ? t.dashboard.creating
                                : lang === "ar"
                                  ? "اختر اللعبة وابدأ"
                                  : "Choose game & start"}
                            </button>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GameCatalogSection
        title={
          lang === "ar"
            ? "تحديات ذكاء فردية"
            : "Solo brain challenges"
        }
        subtitle={
          lang === "ar"
            ? "تمارين تركيز وذاكرة ولغة للعب الذاتي أو مسابقات الزوار — بدون غرفة صفّية كاملة."
            : "Focus, memory, and language drills for solo play or visitor quizzes — no full live room required."
        }
        accentClass="text-foreground"
        games={soloGames}
        delayOffset={liveGames.length}
      />

    </div>

  </>
  );
}

function ToolsTab({ t, lang, setLocation, user, classroomEnabled }: any) {
  const isAr = lang === "ar";
  const isAdmin = !!user?.isAdmin;

  // Brand palette for tools — green primary, gold accent, warm white bg
  const BRAND = { green: "#225739", gold: "#D9A521", light: "#FCFAF8" };

  const toolGroups = [
    {
      // AI generators grouped at the top so the teacher sees every
      // "create something with AI" entry point side-by-side. Renders
      // in the same 4-up grid as the other groups so the cards line up.
      groupId: "ai-tools",
      groupTitle: isAr ? "أدوات الذكاء الاصطناعي" : "AI Tools",
      groupIcon: <Sparkles className="w-4 h-4" />,
      tools: [
        {
          icon: <Sparkles className="w-6 h-6" />,
          title: t.dashboard.toolAiGenerator,
          desc: t.dashboard.toolAiGeneratorDesc,
          accent: BRAND.gold,
          href: "/teacher/new/assignment",
        },
        {
          icon: <BookOpen className="w-6 h-6" />,
          title: isAr ? "مولّد خطط الدروس" : "Lesson Plan Generator",
          desc: isAr
            ? "خطّط حصّة كاملة بأهداف وأنشطة وتقويم بمساعدة الذكاء الاصطناعي"
            : "Plan a full class with objectives, activities, and assessment using AI",
          accent: BRAND.gold,
          href: "/teacher/lesson-plans/create",
        },
        {
          icon: <FileText className="w-6 h-6" />,
          title: isAr ? "مولّد ورقة العمل" : "Worksheet Generator",
          desc: isAr
            ? "صمّم ورقة عمل احترافية للطباعة بمساعدة الذكاء الاصطناعي"
            : "Design a print-ready worksheet with AI assistance",
          accent: BRAND.gold,
          href: "/teacher/worksheets/create",
        },
        {
          icon: <Brain className="w-6 h-6" />,
          title: isAr ? "مولّد الخرائط الذهنية" : "Mind Map Generator",
          desc: isAr
            ? "حوّل أي موضوع أو درس إلى خريطة ذهنية بصرية رائعة بضغطة واحدة"
            : "Turn any topic or lesson into a stunning visual mind map in one click",
          accent: BRAND.gold,
          href: "/teacher/mindmap/create",
        },
        {
          icon: <Video className="w-6 h-6" />,
          title: isAr ? "درس فيديو تفاعلي" : "Interactive Video Lesson",
          desc: isAr
            ? "أنشئ درساً بأسئلة تتوقف تلقائياً أثناء الفيديو"
            : "Create a lesson with auto-pausing questions during the video",
          accent: BRAND.gold,
          href: "/teacher/video-lesson/new",
        },
        {
          icon: <Monitor className="w-6 h-6" />,
          title: isAr ? "العروض التفاعلية" : "Interactive Presentations",
          desc: isAr
            ? "أنشئ عروضاً تقديمية تفاعلية لطلابك في الفصل"
            : "Build interactive slide decks for your classroom",
          accent: BRAND.gold,
          href: "/teacher/presentations",
          /** Single subtle spotlight card — calm SaaS accent, not a banner. */
          featured: true,
        },
      ],
    },
    {
      groupId: "content",
      groupTitle: isAr ? "تنظيم المحتوى" : "Content Library",
      groupIcon: <Database className="w-4 h-4" />,
      tools: [
        {
          icon: <Database className="w-6 h-6" />,
          title: t.dashboard.toolQuestionBank,
          desc: t.dashboard.toolQuestionBankDesc,
          accent: BRAND.green,
          href: "/teacher/question-bank",
        },
        {
          icon: <FolderOpen className="w-6 h-6" />,
          title: t.dashboard.toolCollections,
          desc: t.dashboard.toolCollectionsDesc,
          accent: BRAND.green,
          href: "/teacher/collections",
        },
        {
          icon: <Tag className="w-6 h-6" />,
          title: t.dashboard.toolCategories,
          desc: t.dashboard.toolCategoriesDesc,
          accent: BRAND.green,
          href: "/teacher/categories",
        },
        {
          icon: <Sparkles className="w-6 h-6" />,
          title: isAr ? (isAdmin ? "محتوى تحدي حصاد" : "فئاتي في تحدي حصاد") : (isAdmin ? "Hasad Arena Content" : "My Arena Categories"),
          desc: isAr
            ? (isAdmin
                ? "أدر أقسام وأسئلة تحدي حصاد مع الصور والتوليد بالذكاء"
                : "أنشئ فئاتك وأسئلتك الخاصة في تحدي حصاد — تبقى في حسابك")
            : (isAdmin
                ? "Manage Arena sections, sub-categories & questions with images and AI"
                : "Create your own private Arena categories and questions"),
          accent: BRAND.green,
          href: "/teacher/arena-content",
        },
        {
          icon: <Library className="w-6 h-6" />,
          title: isAr ? "مكتبة المعلم" : "Teacher Library",
          desc: isAr
            ? "ارفع وأدر كتبك وأوراق عملك وخطط دروسك"
            : "Upload and manage your books, worksheets & lesson plans",
          accent: BRAND.green,
          href: "/teacher/library",
        },
        {
          icon: <Globe className="w-6 h-6" />,
          title: isAr ? "المحتوى المشترك" : "Shared Content",
          desc: isAr
            ? "تصفح واجبات وأسئلة ومسابقات المعلمين الآخرين"
            : "Browse assignments, questions & games from other teachers",
          accent: BRAND.green,
          href: "/teacher/library/homework",
        },
      ],
    },
    {
      groupId: "students",
      groupTitle: isAr ? "إدارة الطلاب" : "Student Management",
      groupIcon: <Users className="w-4 h-4" />,
      tools: [
        {
          icon: <Users className="w-6 h-6" />,
          title: t.dashboard.toolStudents,
          desc: t.dashboard.toolStudentsDesc,
          accent: BRAND.green,
          href: "/teacher/students",
        },
        ...(classroomEnabled ? [{
          icon: <GraduationCap className="w-6 h-6" />,
          title: isAr ? "Google Classroom" : "Google Classroom",
          desc: isAr
            ? "استيراد الطلاب ونشر الواجبات ومزامنة الدرجات"
            : "Import students, publish assignments & sync grades",
          accent: "#4285F4",
          href: "/teacher/classroom",
        }] : []),
        {
          icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="24" height="24" rx="5" fill="#5059C9" />
              <path d="M14.5 8.5C14.5 9.88 13.38 11 12 11C10.62 11 9.5 9.88 9.5 8.5C9.5 7.12 10.62 6 12 6C13.38 6 14.5 7.12 14.5 8.5Z" fill="white" />
              <path d="M16 11H8C7.45 11 7 11.45 7 12V16.5C7 17.05 7.45 17.5 8 17.5H16C16.55 17.5 17 17.05 17 16.5V12C17 11.45 16.55 11 16 11Z" fill="white" />
              <circle cx="17.5" cy="8" r="2.5" fill="#7B83EB" />
              <path d="M19.5 10.5H15.5V14C15.5 14.83 16.17 15.5 17 15.5H18C19.1 15.5 20 14.6 20 13.5V11C20 10.72 19.78 10.5 19.5 10.5Z" fill="#7B83EB" />
            </svg>
          ),
          title: isAr ? "Microsoft Teams" : "Microsoft Teams",
          desc: isAr
            ? "استيراد الطلاب ونشر الواجبات عبر Teams"
            : "Import students, publish assignments via Teams",
          accent: "#5059C9",
          href: "/teacher/teams",
        },
      ],
    },
    {
      groupId: "other",
      groupTitle: isAr ? "أخرى" : "Other",
      groupIcon: <MessageSquarePlus className="w-4 h-4" />,
      tools: [
        {
          icon: <MessageSquarePlus className="w-6 h-6" />,
          title: t.dashboard.toolFeedback,
          desc: t.dashboard.toolFeedbackDesc,
          accent: BRAND.green,
          href: "/feedback",
        },
        ...(user?.isAdmin
          ? [
              {
                icon: <Crown className="w-6 h-6" />,
                title: isAr ? "لوحة المسؤول" : "Admin Panel",
                desc: isAr
                  ? "إدارة المعلمين والطلاب ومراقبة المنصة"
                  : "Manage teachers, students & monitor platform",
                accent: BRAND.gold,
                href: "/teacher/admin",
              },
            ]
          : []),
      ],
    },
  ].filter((g) => g.tools.length > 0);

  const ChevronEnd = isAr ? ArrowLeft : ArrowRight;
  let globalIdx = 0;

  return (
    <div className="space-y-9 sm:space-y-12">
      {/* Header — left-aligned on desktop, centered on mobile for a more
          professional feel than the centered icon-stack of before. */}
      <div className="flex items-center gap-3 sm:gap-4 px-1">
        <div
          className="inline-flex w-11 h-11 sm:w-12 sm:h-12 rounded-2xl items-center justify-center shrink-0"
          style={{ background: "rgba(34,87,57,0.10)", color: BRAND.green }}
        >
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-extrabold text-foreground leading-tight">
            {t.dashboard.toolsTitle}
          </h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug mt-0.5">
            {isAr
              ? "كل الأدوات التي تحتاجها لإدارة فصلك وإثراء تجربة الطلاب"
              : "Everything you need to manage your class and enrich student experience"}
          </p>
        </div>
      </div>

      {toolGroups.map((group) => (
        <section key={group.groupId}>
          {/* Group header — clean, left-aligned with a soft accent
              underline. Reads more like a Notion/Linear section than a
              decorative chip-in-a-divider. */}
          <div className="flex items-end justify-between gap-3 mb-4 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(34,87,57,0.08)", color: BRAND.green }}
              >
                {group.groupIcon}
              </span>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground truncate">
                {group.groupTitle}
              </h3>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: "rgba(34,87,57,0.08)", color: BRAND.green }}
              >
                {group.tools.length}
              </span>
            </div>
            <div
              className="flex-1 h-px mb-2 hidden sm:block"
              style={{ background: "rgba(34,87,57,0.12)" }}
            />
          </div>

          {/* Auto-fit grid — cards stretch to fill the row no matter how
              many there are, so an odd count (3 or 5) doesn't leave an
              awkward visual gap like a fixed 4-column layout would. The
              `min(100%, 240px)` lower bound keeps cards comfortably
              wide on mobile (single column) without breaking on tiny
              viewports. */}
          <div
            className="grid gap-3 sm:gap-4"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            }}
          >
            {group.tools.map((tool: {
              icon: ReactNode;
              title: string;
              desc?: string;
              accent: string;
              href: string;
              featured?: boolean;
            }) => {
              const delay = globalIdx++ * 0.025;
              const isFeatured = tool.featured === true;
              const restBorder = "rgba(34,87,57,0.14)";
              const featuredBadgeSide = isAr ? "left-2.5" : "right-2.5";

              return (
                <motion.button
                  key={tool.href}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay, duration: 0.22 }}
                  onClick={() => tool.href && setLocation(tool.href)}
                  className={cn(
                    "group relative flex items-start gap-3.5 sm:gap-4 p-4 sm:p-5 rounded-xl border bg-card/60 text-start min-h-[96px] overflow-hidden",
                    "transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "hover:-translate-y-1 hover:bg-card",
                    "hover:shadow-[0_12px_28px_-8px_rgba(34,87,57,0.12),0_0_0_1px_rgba(217,165,33,0.08)]",
                    "hover:border-[rgba(34,87,57,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isFeatured &&
                      "border-[rgba(217,165,33,0.35)] bg-gradient-to-br from-[rgba(217,165,33,0.06)] via-card/40 to-card/60 shadow-[0_0_0_1px_rgba(217,165,33,0.12)_inset]",
                    isFeatured &&
                      "hover:border-[rgba(217,165,33,0.45)] hover:shadow-[0_14px_32px_-10px_rgba(34,87,57,0.14),0_0_0_1px_rgba(217,165,33,0.18)]",
                  )}
                  style={
                    {
                      borderColor: isFeatured ? "rgba(217,165,33,0.35)" : restBorder,
                    } as CSSProperties
                  }
                >
                  {isFeatured && (
                    <span
                      className={cn(
                        "pointer-events-none absolute top-2.5 z-[1] inline-flex items-center rounded-md border border-[rgba(217,165,33,0.28)] bg-[rgba(217,165,33,0.12)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#225739]",
                        featuredBadgeSide,
                      )}
                    >
                      {isAr ? "موصى به" : "Featured"}
                    </span>
                  )}

                  <div
                    className={cn(
                      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] group-hover:-rotate-[2deg]",
                      "bg-[rgba(34,87,57,0.07)]",
                      isFeatured && "bg-[rgba(217,165,33,0.11)]",
                    )}
                    style={{ color: tool.accent }}
                  >
                    {tool.icon}
                  </div>

                  <div className="relative flex-1 min-w-0 pt-0.5">
                    <h4 className="font-bold text-foreground text-sm sm:text-[14.5px] leading-snug line-clamp-2 mb-1">
                      {tool.title}
                    </h4>
                    {tool.desc && (
                      <p className="text-[11.5px] sm:text-xs text-muted-foreground/90 leading-relaxed line-clamp-2">
                        {tool.desc}
                      </p>
                    )}
                  </div>

                  <span className="shrink-0 self-center text-muted-foreground/40 transition-colors duration-300 group-hover:text-foreground">
                    <ChevronEnd className="w-4 h-4 transition-transform duration-300 motion-safe:group-hover:-translate-x-0.5 rtl:motion-safe:group-hover:translate-x-0.5" />
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Students Inline Tab ──────────────────────────────────
function StudentsInlineTab({ lang, setLocation }: { lang: string; setLocation: (p: string) => void }) {
  const isAr = lang === "ar";
  const BASE = (import.meta as any).env?.VITE_API_URL || "";
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/teacher/classes`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => { setClasses(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(34,87,57,0.10)", color: "#225739" }}>
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-extrabold text-foreground text-base truncate">{isAr ? "صفوفي وطلابي" : "My Classes & Students"}</h2>
            <p className="text-xs text-muted-foreground truncate">{isAr ? "إدارة الصفوف والطلاب" : "Manage classes and students"}</p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/teacher/students")}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-bold transition-all hover:opacity-90 shrink-0"
          style={{ background: "#225739", color: "#FCFAF8" }}
        >
          <Users className="w-4 h-4" />
          {isAr ? "إدارة الطلاب" : "Manage"}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-bold text-foreground mb-1">{isAr ? "لا توجد صفوف بعد" : "No classes yet"}</p>
          <button onClick={() => setLocation("/teacher/students")} className="px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white mt-2" style={{ background: "#225739" }}>
            {isAr ? "أضف صفاً جديداً" : "Add class"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {classes.map((cls: any) => (
            <button key={cls.name} onClick={() => setLocation(`/teacher/students?class=${encodeURIComponent(cls.name)}`)}
              className="group text-start p-4 min-h-[44px] rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden relative"
            >
              <div className="absolute top-0 inset-x-0 h-[2.5px] rounded-t-xl" style={{ background: "#225739" }} />
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "rgba(34,87,57,0.10)", color: "#225739" }}>
                <Users className="w-4 h-4" />
              </div>
              <p className="font-bold text-xs text-foreground truncate">{cls.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{cls.studentCount || 0} {isAr ? "طالب" : "students"}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsTab({
  assignments,
  totalSubmissions,
  activeAssignments,
  expiredAssignments,
  avgSubmissions,
  t,
  lang,
}: any) {
  const [advancedStats, setAdvancedStats] = useState<any>(null);
  const BASE = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    if (assignments && assignments.length > 0) {
      fetch(`${BASE}/api/teacher/stats`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setAdvancedStats(data))
        .catch(() => {});
    }
  }, [assignments]);

  if (!assignments || assignments.length === 0) {
    return (
      <Card className="py-16 text-center border-dashed">
        <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">
          {t.dashboard.noStatsYet}
        </h3>
        <p className="text-muted-foreground">{t.dashboard.noStatsDesc}</p>
      </Card>
    );
  }

  const statCards = [
    {
      label: t.dashboard.totalAssignments,
      value: assignments.length,
      icon: <BookText className="w-5 h-5" />,
      color: "text-primary bg-primary/10",
    },
    {
      label: t.dashboard.totalSubmissions,
      value: totalSubmissions,
      icon: <Users className="w-5 h-5" />,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: t.dashboard.statsAvgSubmissions,
      value: avgSubmissions,
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: t.dashboard.statsActiveAssignments,
      value: activeAssignments.length,
      icon: <Clock className="w-5 h-5" />,
      color: "text-green-600 bg-green-50",
    },
    {
      label: t.dashboard.statsExpiredAssignments,
      value: expiredAssignments.length,
      icon: <Calendar className="w-5 h-5" />,
      color: "text-red-500 bg-red-50",
    },
    {
      label: t.dashboard.statsCompletionRate,
      value:
        assignments.length > 0
          ? `${Math.round((assignments.filter((a: any) => a.submissionCount > 0).length / assignments.length) * 100)}%`
          : "—",
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: "text-amber-600 bg-amber-50",
    },
  ];

  const GRADE_COLORS = [
    "#10b981",
    "#22c55e",
    "#84cc16",
    "#f59e0b",
    "#f97316",
    "#ef4444",
  ];
  const strongest = advancedStats?.studentRanking?.[0];
  const weakest =
    advancedStats?.studentRanking?.length > 1
      ? advancedStats.studentRanking[advancedStats.studentRanking.length - 1]
      : null;

  return (
    <div>
      <div className="text-center py-4 mb-4">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl mb-4"
        >
          <BarChart3 className="w-10 h-10 text-blue-600" />
        </motion.div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-foreground mb-2">
          {t.dashboard.statsTitle}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {statCards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="p-4 sm:p-5 text-center">
              <div
                className={cn(
                  "p-2.5 rounded-xl w-fit mx-auto mb-3",
                  card.color,
                )}
              >
                {card.icon}
              </div>
              <p className="text-2xl sm:text-3xl font-black text-foreground mb-1">
                {card.value}
              </p>
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                {card.label}
              </p>
            </Card>
          </motion.div>
        ))}
      </div>

      {advancedStats?.gradeDistribution?.some((g: any) => g.count > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              {lang === "ar" ? "توزيع الدرجات" : "Grade Distribution"}
            </h3>
            <div style={{ width: "100%", height: 280 }} dir="ltr">
              <ResponsiveContainer>
                <BarChart
                  data={advancedStats.gradeDistribution}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 13,
                    }}
                    formatter={(value: number) => [
                      value,
                      lang === "ar" ? "طلاب" : "Students",
                    ]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {advancedStats.gradeDistribution.map(
                      (_: any, index: number) => (
                        <Cell
                          key={index}
                          fill={GRADE_COLORS[index % GRADE_COLORS.length]}
                        />
                      ),
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      )}

      {(strongest || weakest) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {strongest && (
              <Card className="p-5 border-green-200 bg-green-50/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-green-100 text-green-600">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-600">
                      {lang === "ar" ? "الأقوى أداءً" : "Top Performer"}
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {strongest.name}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "متوسط الدرجات" : "Average Score"}:{" "}
                  <strong className="text-green-600">
                    {strongest.avgScore}%
                  </strong>
                  <span className="mx-2">·</span>
                  {strongest.submissions}{" "}
                  {lang === "ar" ? "تسليم" : "submissions"}
                </p>
              </Card>
            )}
            {weakest && (
              <Card className="p-5 border-orange-200 bg-orange-50/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-orange-600">
                      {lang === "ar" ? "يحتاج متابعة" : "Needs Attention"}
                    </p>
                    <p className="text-lg font-black text-foreground">
                      {weakest.name}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {lang === "ar" ? "متوسط الدرجات" : "Average Score"}:{" "}
                  <strong className="text-orange-600">
                    {weakest.avgScore}%
                  </strong>
                  <span className="mx-2">·</span>
                  {weakest.submissions}{" "}
                  {lang === "ar" ? "تسليم" : "submissions"}
                </p>
              </Card>
            )}
          </div>
        </motion.div>
      )}

      {advancedStats?.submissionTimeline?.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-600" />
              {lang === "ar" ? "الأداء عبر الزمن" : "Performance Over Time"}
            </h3>
            <div style={{ width: "100%", height: 280 }} dir="ltr">
              <ResponsiveContainer>
                <AreaChart
                  data={advancedStats.submissionTimeline}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      fontSize: 13,
                    }}
                    formatter={(value: number, name: string) => [
                      name === "avgScore" ? `${value}%` : value,
                      name === "avgScore"
                        ? lang === "ar"
                          ? "متوسط الدرجة"
                          : "Avg Score"
                        : lang === "ar"
                          ? "التسليمات"
                          : "Submissions",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgScore"
                    stroke="#8b5cf6"
                    fill="#8b5cf680"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      )}

      {advancedStats?.studentRanking?.length > 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card className="p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <UsersRound className="w-5 h-5 text-blue-600" />
              {lang === "ar" ? "ترتيب الطلاب" : "Student Ranking"}
            </h3>
            <div className="space-y-2">
              {advancedStats.studentRanking
                .slice(0, 10)
                .map((s: any, i: number) => (
                  <div key={s.name} className="flex items-center gap-3 py-2">
                    <span
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                        i === 0
                          ? "bg-amber-100 text-amber-700"
                          : i === 1
                            ? "bg-muted text-muted-foreground"
                            : i === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">
                        {s.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.submissions}{" "}
                        {lang === "ar" ? "تسليم" : "submissions"}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-sm font-black",
                        s.avgScore >= 80
                          ? "bg-green-100 text-green-700"
                          : s.avgScore >= 60
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700",
                      )}
                    >
                      {s.avgScore}%
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </motion.div>
      )}

      {assignments.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            {t.dashboard.myAssignments}
          </h3>
          <div className="space-y-2">
            {assignments.map((a: any, i: number) => {
              const maxSub = Math.max(
                ...assignments.map((x: any) => x.submissionCount),
                1,
              );
              const pct =
                a.submissionCount > 0
                  ? Math.round((a.submissionCount / maxSub) * 100)
                  : 0;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: lang === "ar" ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link href={`/teacher/assignment/${a.id}`}>
                    <Card className="p-3 sm:p-4 hover:border-primary/40 cursor-pointer transition-all group">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                            {a.subject}
                          </span>
                          <span className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {a.title}
                          </span>
                        </div>
                        <span className="text-sm font-black text-primary shrink-0">
                          {a.submissionCount} {t.dashboard.submission}
                        </span>
                      </div>
                      <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                        />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SharedTab({
  assignments,
  isLoading,
  lang,
  importingIds,
  importedIds,
  importAssignment,
  creatingGameForId,
  startGame,
}: {
  assignments: SharedAssignment[];
  isLoading: boolean;
  lang: string;
  importingIds: Set<number>;
  importedIds: Set<number>;
  importAssignment: (id: number, e?: React.MouseEvent) => void;
  creatingGameForId: number | null;
  startGame: (id: number, e?: React.MouseEvent) => void;
}) {
  const [search, setSearch] = useState("");
  const isRtl = lang === "ar";
  const filtered = assignments.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.teacherName ?? "").includes(search),
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card
            key={i}
            className="p-5 border-border/40 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="h-5 w-48 bg-muted/60 rounded-md" />
                <div className="h-4 w-32 bg-muted/30 rounded" />
              </div>
              <div className="h-8 w-28 bg-muted/40 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card className="py-16 text-center border-dashed">
        <Globe className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">
          {lang === "ar"
            ? "لا توجد مسابقات مشتركة بعد"
            : "No shared assignments yet"}
        </h3>
        <p className="text-muted-foreground text-sm">
          {lang === "ar"
            ? "عندما يشارك المعلمون واجباتهم للعموم، ستظهر هنا"
            : "When teachers share assignments publicly, they'll appear here"}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2 border border-border/40">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            lang === "ar"
              ? "ابحث باسم الواجب أو المعلم..."
              : "Search by title or teacher..."
          }
          className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
          dir={isRtl ? "rtl" : "ltr"}
        />
      </div>
      {filtered.length === 0 ? (
        <Card className="py-10 text-center border-dashed">
          <p className="text-muted-foreground text-sm">
            {lang === "ar" ? "لا توجد نتائج" : "No results"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {filtered.map((a: SharedAssignment, i: number) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, x: isRtl ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {a.subject && (
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs font-bold rounded-md shrink-0">
                        {a.subject}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-foreground truncate">
                      {a.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {!a.isAdminContent && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {a.teacherName || (lang === "ar" ? "معلم" : "Teacher")}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <BookText className="w-3 h-3" />
                      {a.questionCount} {lang === "ar" ? "سؤال" : "Q"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap border-t sm:border-t-0 pt-3 sm:pt-0 border-border">
                  {a.questionCount > 0 && (
                    <button
                      onClick={(e) => startGame(a.id, e)}
                      disabled={creatingGameForId === a.id}
                      className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 whitespace-nowrap"
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      {creatingGameForId === a.id
                        ? lang === "ar"
                          ? "جارٍ الإنشاء..."
                          : "Creating..."
                        : lang === "ar"
                          ? "لعبة مباشرة"
                          : "Live Game"}
                    </button>
                  )}
                  <button
                    onClick={(e) => importAssignment(a.id, e)}
                    disabled={importingIds.has(a.id) || importedIds.has(a.id)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl font-bold text-xs border-2 transition-all whitespace-nowrap ${importedIds.has(a.id) ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300" : "border-primary/40 hover:border-primary text-primary hover:bg-primary/5"} disabled:opacity-60`}
                  >
                    {importingIds.has(a.id) ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {lang === "ar" ? "جارٍ الاستيراد..." : "Importing..."}
                      </>
                    ) : importedIds.has(a.id) ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lang === "ar" ? "تم الاستيراد ✓" : "Imported ✓"}
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        {lang === "ar" ? "استيراد إلى مسابقاتي" : "Import"}
                      </>
                    )}
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Mockup-style Section (collapsible card) ── */
function Section({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card rounded-xl border border-border/32 shadow-[0_1px_2px_rgba(15,23,42,0.055),0_12px_36px_-22px_rgba(30,77,53,0.075)] overflow-hidden ring-1 ring-black/[0.025] dark:ring-white/[0.035]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-[11px] hover:bg-muted/[0.24] transition-colors duration-150 min-h-[44px] border-s-[3px] border-s-[#D9A521]/28"
      >
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-foreground text-sm tracking-tight">{title}</span>
          {count !== undefined && (
            <span className="text-[11px] font-semibold bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-full tabular-nums border border-border/35">
              {count}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/45" />
            <div className="px-3 py-2.5 sm:px-4 sm:py-3.5 bg-muted/[0.035]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Free Flash Button — per-card, stateless click ── */
const BASE_URL_SOLO = import.meta.env.VITE_API_URL || "";
function SoloLinkButton({ assignmentId, lang }: { assignmentId: number; lang: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied">("idle");
  const handleClick = async () => {
    if (state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch(`${BASE_URL_SOLO}/api/solo-challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const url = `${window.location.origin}/solo/${data.slug}`;
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch (err: any) {
      import("@/components/ui/sonner").then(({ toast }) =>
        toast.error(err?.message || (lang === "ar" ? "تعذّر إنشاء الرابط" : "Failed to create link"))
      );
      setState("idle");
    }
  };
  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      className="text-xs font-bold px-3 py-2 min-h-[44px] border rounded-lg transition-colors inline-flex items-center gap-1.5 border-amber-400/50 text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:border-amber-500/30"
      title={lang === "ar" ? "إنشاء وميض حر ونسخ الرابط" : "Create Free Flash & copy link"}
    >
      {state === "loading" ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : state === "copied" ? (
        <Check className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Zap className="w-3.5 h-3.5" />
      )}
      {state === "copied"
        ? (lang === "ar" ? "تم النسخ!" : "Copied!")
        : (lang === "ar" ? "وميض حر" : "Free Flash")}
    </button>
  );
}

/* ── Assignment Row (compact, expandable) ── */
function AssignmentRow({
  assignment,
  groupName,
  isExpanded,
  onToggle,
  creatingGameForId,
  startGame,
  deleteAssignment,
  setLocation,
  lang,
  t,
  queryClient,
  onShare,
  collections,
  addToCollection,
  removeFromCollection,
  creatingGroupName,
  setCreatingGroupName,
  createGroupAndAdd,
  savingGroup,
  isFavorite,
  onToggleFavorite,
}: any) {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const groupBtnRef = useRef<HTMLButtonElement>(null);

  const openGroupMenu = () => {
    if (groupBtnRef.current) {
      const r = groupBtnRef.current.getBoundingClientRect();
      const menuWidth = 240;
      const left =
        lang === "ar"
          ? Math.max(8, r.right - menuWidth)
          : Math.min(window.innerWidth - menuWidth - 8, r.left);
      setMenuPos({ top: r.bottom + 6, left });
    }
    setShowGroupMenu(true);
  };

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      "application/x-assignment-id",
      String(assignment.id),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const deadlineExpired =
    assignment.deadline && new Date(assignment.deadline) < new Date();
  const statusActive = !deadlineExpired;
  const isExam = assignment.examMode === true;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "rounded-xl border bg-card cursor-grab active:cursor-grabbing transition-[box-shadow,border-color,background-color] duration-150 ease-[cubic-bezier(0.33,1,0.68,1)]",
        "shadow-[0_1px_2px_rgba(15,23,42,0.045),0_10px_30px_-18px_rgba(30,77,53,0.085)]",
        isExpanded
          ? "border-primary/24 bg-muted/[0.09] shadow-[0_8px_32px_-18px_rgba(30,77,53,0.13)] ring-1 ring-primary/[0.07]"
          : "border-border/38 hover:border-primary/14 hover:bg-muted/[0.16] hover:shadow-[0_14px_40px_-22px_rgba(30,77,53,0.11)]",
      )}
    >
      <div className="w-full flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-3.5 min-h-[62px]">
        <span
          className="hidden sm:inline-flex shrink-0 text-muted-foreground/40 hover:text-muted-foreground/75 transition-colors p-2 -m-2"
          title={lang === "ar" ? "اسحب إلى مجموعة" : "Drag to group"}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        <button
          type="button"
          onClick={onToggleFavorite}
          className={cn(
            "shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full border transition-colors duration-150 ease-out",
            isFavorite
              ? "border-[#D9A521]/20 bg-[#D9A521]/[0.07]"
              : "border-transparent text-muted-foreground/40 hover:bg-muted/40 hover:text-[#D9A521]/75 hover:border-border/35",
          )}
          title={
            lang === "ar"
              ? isFavorite
                ? "إزالة من المفضلة"
                : "إضافة للمفضلة"
              : isFavorite
                ? "Remove from favorites"
                : "Add to favorites"
          }
        >
          <Star
            className={cn(
              "w-[17px] h-[17px] transition-colors",
              isFavorite
                ? "fill-[#c9a032]/90 text-[#c9a032]"
                : "",
            )}
          />
        </button>
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 min-h-[44px] flex items-center gap-2 text-start"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[13px] sm:text-sm text-foreground truncate">
                {assignment.title}
              </span>
              {statusActive && (
                <span className="inline-flex items-center text-[11px] font-semibold px-3 py-1 rounded-full bg-emerald-600/[0.09] text-emerald-950 dark:text-emerald-300 border border-emerald-600/14 leading-none">
                  {lang === "ar" ? "نشط" : "Active"}
                </span>
              )}
              {deadlineExpired && (
                <span className="inline-flex items-center text-[11px] font-semibold px-3 py-1 rounded-full bg-stone-500/[0.09] text-stone-900 dark:text-stone-400 border border-stone-500/16 leading-none">
                  {lang === "ar" ? "منتهي" : "Ended"}
                </span>
              )}
              {isExam ? (
                <span className="inline-flex items-center text-[11px] font-semibold px-3 py-1 rounded-full bg-amber-500/[0.1] text-amber-950 dark:text-amber-200 border border-amber-600/15 leading-none">
                  {lang === "ar" ? "اختبار" : "Exam"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1 rounded-full bg-primary/[0.075] text-[#143728] dark:text-emerald-300 border border-primary/14 leading-none">
                  <Monitor className="w-3.5 h-3.5 opacity-80 shrink-0" />
                  {lang === "ar" ? "عرض تفاعلي" : "Interactive"}
                </span>
              )}
              {isFavorite && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-3 py-1 rounded-full bg-[#D9A521]/[0.11] text-[#5c4a14] dark:text-[#ebd587] border border-[#D9A521]/18 leading-none">
                  {lang === "ar" ? "مفضلة" : "Favorite"}
                </span>
              )}
              {assignment.subject && (
                <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border/45 leading-none">
                  {assignment.subject}
                </span>
              )}
              {groupName && (
                <span className="text-[11px] text-primary bg-primary/[0.075] px-3 py-1 rounded-full border border-primary/14 leading-none font-medium">
                  {groupName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/95 mt-1">
              {assignment.questionCount} {t.dashboard.question} ·{" "}
              {assignment.submissionCount} {t.dashboard.submission}
            </p>
          </div>
        </button>
        {assignment.questionCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              startGame(assignment.id, e);
            }}
            disabled={creatingGameForId === assignment.id}
            className="shrink-0 text-xs font-semibold px-3.5 py-2 min-h-[44px] min-w-[44px] text-white rounded-xl transition-[box-shadow,filter] duration-150 ease-out disabled:opacity-45 inline-flex items-center justify-center gap-1.5 hover:brightness-[1.03] active:brightness-[0.98] shadow-[0_4px_18px_-10px_rgba(30,77,53,0.48),0_1px_2px_rgba(15,23,42,0.06)] hover:shadow-[0_10px_28px_-14px_rgba(30,77,53,0.42),0_1px_2px_rgba(15,23,42,0.06)]"
            style={{
              background: "linear-gradient(180deg, #1E4D35 0%, #17382a 100%)",
            }}
            title={t.dashboard.liveGame}
          >
            <Gamepad2 className="w-3.5 h-3.5 opacity-95" />
            <span className="hidden sm:inline">
              {creatingGameForId === assignment.id
                ? t.dashboard.creating
                : t.dashboard.liveGame}
            </span>
          </button>
        )}
        <button
          onClick={onToggle}
          className="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl hover:bg-muted/50 transition-colors duration-150"
          aria-label="toggle"
        >
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground/70 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50" />
            <div className="px-3 py-3 sm:px-4 flex flex-wrap gap-2 bg-muted/[0.04]">
              <button
                onClick={() =>
                  setLocation(`/teacher/assignment/${assignment.id}`)
                }
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                {lang === "ar" ? "تعديل" : "Edit"}
              </button>
              <button
                onClick={() =>
                  setLocation(`/teacher/assignment/${assignment.id}`)
                }
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                {lang === "ar" ? "النتائج" : "Results"}
              </button>
              <button
                onClick={async () => {
                  try {
                    const url = `${window.location.origin}/solve/${assignment.id}`;
                    await navigator.clipboard.writeText(url);
                    toast.success(
                      lang === "ar"
                        ? "تم نسخ رابط الواجب"
                        : "Assignment link copied",
                    );
                  } catch {
                    toast.error(lang === "ar" ? "تعذر النسخ" : "Copy failed");
                  }
                }}
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {lang === "ar" ? "نسخ رابط الواجب" : "Copy assignment link"}
              </button>
              {/* ── Free Flash Button ── */}
              <SoloLinkButton assignmentId={assignment.id} lang={lang} />

              <button
                onClick={() => onShare(assignment.id)}
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                {lang === "ar" ? "مشاركة" : "Share"}
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `${BASE_URL}/api/assignments/${assignment.id}/duplicate`,
                      {
                        method: "POST",
                        credentials: "include",
                      },
                    );
                    if (res.ok) {
                      toast.success(
                        lang === "ar" ? "تم نسخ الواجب" : "Duplicated",
                      );
                      queryClient?.invalidateQueries({
                        queryKey: ["/api/assignments"],
                      });
                    } else {
                      toast.error(
                        lang === "ar" ? "خطأ في النسخ" : "Duplication failed",
                      );
                    }
                  } catch {
                    toast.error(
                      lang === "ar" ? "خطأ في النسخ" : "Duplication failed",
                    );
                  }
                }}
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-foreground border border-border rounded-lg hover:border-foreground/40 transition-colors inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {lang === "ar" ? "تكرار" : "Duplicate"}
              </button>
              <button
                ref={groupBtnRef}
                onClick={(e) => {
                  e.stopPropagation();
                  openGroupMenu();
                }}
                className={`text-xs font-medium px-3 py-2 min-h-[44px] border rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                  collections?.some((c: any) =>
                    c.assignmentIds?.includes(assignment.id),
                  )
                    ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800"
                    : "bg-card text-foreground border-border hover:border-foreground/40"
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {lang === "ar" ? "مجموعة" : "Group"}
              </button>
              {showGroupMenu &&
                menuPos &&
                createPortal(
                  <>
                    <div
                      className="fixed inset-0 z-[100]"
                      onClick={() => setShowGroupMenu(false)}
                    />
                    <div
                      className="fixed w-60 bg-card border border-border rounded-xl shadow-2xl z-[101] p-2"
                      style={{ top: menuPos.top, left: menuPos.left }}
                      onClick={(e) => e.stopPropagation()}
                      dir={lang === "ar" ? "rtl" : "ltr"}
                    >
                      <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">
                        {lang === "ar" ? "المجموعات" : "Groups"}
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {(collections || []).map((col: any) => {
                          const inGroup = col.assignmentIds?.includes(
                            assignment.id,
                          );
                          return (
                            <button
                              key={col.id}
                              onClick={() =>
                                inGroup
                                  ? removeFromCollection(col.id, assignment.id)
                                  : addToCollection(col.id, assignment.id)
                              }
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-start ${
                                inGroup
                                  ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                                  : "text-foreground hover:bg-muted"
                              }`}
                            >
                              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                              <span className="flex-1 truncate">
                                {col.name}
                              </span>
                              {inGroup && (
                                <Check className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                        {(!collections || collections.length === 0) && (
                          <p className="text-[11px] text-muted-foreground px-2 py-2 text-center">
                            {lang === "ar"
                              ? "لا توجد مجموعات بعد"
                              : "No groups yet"}
                          </p>
                        )}
                      </div>
                      <div className="border-t border-border mt-1.5 pt-1.5 flex items-center gap-1.5">
                        <input
                          type="text"
                          value={creatingGroupName}
                          onChange={(e) => setCreatingGroupName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            createGroupAndAdd(assignment.id)
                          }
                          placeholder={
                            lang === "ar" ? "مجموعة جديدة..." : "New group..."
                          }
                          className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-border bg-muted/30 focus:outline-none focus:border-violet-400 min-w-0"
                          dir={lang === "ar" ? "rtl" : "ltr"}
                        />
                        <button
                          onClick={() => createGroupAndAdd(assignment.id)}
                          disabled={!creatingGroupName?.trim() || savingGroup}
                          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>,
                  document.body,
                )}
              <button
                onClick={() => deleteAssignment(assignment.id)}
                className="text-xs font-medium px-3 py-2 min-h-[44px] bg-card text-red-500 border border-border rounded-lg hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors inline-flex items-center gap-1.5 ms-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {lang === "ar" ? "حذف" : "Delete"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main mockup-style render ── */
function AssignmentsTabRender({
  assignments,
  filteredAssignments,
  collections,
  creatingGameForId,
  startGame,
  deleteAssignment,
  setLocation,
  setActiveTab,
  lang,
  t,
  queryClient,
  addToCollection,
  removeFromCollection,
  creatingGroupName,
  setCreatingGroupName,
  createGroupAndAdd,
  savingGroup,
}: any) {
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "expired" | "favorites"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("assignment_favorites");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem("assignment_favorites", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const now = new Date();
  const statusFiltered = filteredAssignments.filter((a: any) => {
    if (statusFilter === "favorites" && !favorites.has(a.id)) return false;
    if (statusFilter === "active" && a.deadline && new Date(a.deadline) < now)
      return false;
    if (
      statusFilter === "expired" &&
      (!a.deadline || new Date(a.deadline) >= now)
    )
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (a.title || "").toLowerCase().includes(q) ||
        (a.subject || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const groupNameById = (id: number) => {
    const col = collections.find((c: any) => c.assignmentIds?.includes(id));
    return col?.name;
  };

  const onShare = async (id: number) => {
    try {
      const url = `${window.location.origin}/solve/${id}`;
      await navigator.clipboard.writeText(url);
      toast.success(lang === "ar" ? "تم نسخ الرابط" : "Link copied");
    } catch {
      toast.error(lang === "ar" ? "تعذر النسخ" : "Copy failed");
    }
  };

  const games = [
    {
      type: "hack",
      title: lang === "ar" ? "لعبة الاختراق" : "Hack Game",
      desc:
        lang === "ar"
          ? "ماراثون اختراق: كلمات سر، صناديق غامضة، وسحب نقاط الخصوم"
          : "Hack marathon: passwords, mystery boxes, and stealing opponents' points",
      icon: Gamepad2,
    },
    {
      type: "knowledge_race",
      title: lang === "ar" ? "وميض" : "Wameeth",
      desc: lang === "ar" ? "لعبة جماعية سريعة" : "Live group game",
      icon: Zap,
      tag: lang === "ar" ? "شائع" : "Popular",
    },
    {
      type: "tug_of_war",
      title: lang === "ar" ? "شد الحبل" : "Tug of War",
      desc: lang === "ar" ? "فريقان يتنافسان" : "Two teams compete",
      icon: Swords,
    },
    {
      type: "rocket_race",
      title: lang === "ar" ? "سباق الصواريخ" : "Rocket Race",
      desc: lang === "ar" ? "سباق فردي للصواريخ" : "Individual rocket race",
      icon: Rocket,
      tag: lang === "ar" ? "جديد" : "New",
    },
    {
      type: "maraqui",
      title: lang === "ar" ? "مَراقي" : "Maraqui",
      desc: lang === "ar" ? "مراحل متدرجة الصعوبة" : "Progressive stages",
      icon: Mountain,
    },
    {
      type: "million",
      title: lang === "ar" ? "من سيحصد المليون؟" : "Who Wants a Million?",
      desc: lang === "ar" ? "15 سؤالاً متدرجاً" : "15 escalating questions",
      icon: Coins,
    },
    {
      type: "color_game",
      title: lang === "ar" ? "لعبة الألوان" : "Color Game",
      desc: lang === "ar" ? "ابحث عن المربع المختلف" : "Find the odd square",
      icon: Palette,
    },
    {
      type: "video_lesson",
      title: lang === "ar" ? "فيديو تفاعلي" : "Interactive Video",
      desc: lang === "ar" ? "درس فيديو بأسئلة" : "Video lesson with questions",
      icon: Video,
    },
  ];

  const launchGame = (type: string) => {
    switch (type) {
      case "knowledge_race":
        setActiveTab?.("competitive");
        break;
      case "tug_of_war":
        setLocation("/game/tug/create");
        break;
      case "rocket_race":
        setLocation("/game/rocket/create");
        break;
      case "maraqui":
        setLocation("/game/maraqui");
        break;
      case "million":
        setLocation("/game/million");
        break;
      case "color_game":
        setLocation("/game/color");
        break;
      case "video_lesson":
        setLocation("/teacher/video-lesson/new");
        break;
    }
  };

  return (
    <div className="space-y-2.5" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Hero — aligns with Activities Library; dashboard tab title hidden for this tab */}
      <div className="rounded-xl border border-border/42 bg-gradient-to-r from-primary/[0.075] via-card to-background shadow-[0_1px_2px_rgba(15,23,42,0.055),0_12px_36px_-22px_rgba(30,77,53,0.06)] px-3.5 py-3 sm:px-5 sm:py-[14px] flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between ring-1 ring-black/[0.025] dark:ring-white/[0.04]">
        <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
          <div
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl shrink-0 flex items-center justify-center text-white shadow-[0_8px_24px_-12px_rgba(22,55,40,0.45)] ring-2 ring-primary/16 mt-0.5 sm:mt-0"
            style={{
              background: "linear-gradient(145deg, #1f6f4a 0%, #1a4d36 55%, #163728 100%)",
            }}
          >
            <BookText className="w-[22px] h-[22px] sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 pt-0.5 sm:pt-0">
            <h2 className="text-[1.35rem] sm:text-[1.625rem] font-black tracking-tight text-[#102921] dark:text-foreground leading-[1.2]">
              {lang === "ar" ? "واجباتي" : "My Assignments"}
            </h2>
            <p className="text-[13px] sm:text-sm text-foreground/82 dark:text-muted-foreground mt-1.5 leading-[1.65] max-w-[34rem]">
              {lang === "ar"
                ? "أنشئ الأنشطة، تابع التسليمات، وابدأ جلسات لعب حية مع طلابك — كل ذلك من مكان واحد."
                : "Create activities, track submissions, and run live sessions with your students — all in one place."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setLocation("/teacher/new")}
          className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white transition-[box-shadow,filter] duration-150 ease-out hover:brightness-[1.03] active:brightness-[0.98] shadow-[0_8px_24px_-14px_rgba(21,74,51,0.52)] hover:shadow-[0_12px_32px_-16px_rgba(21,74,51,0.46)]"
          style={{
            background: "linear-gradient(180deg, #1b5c3d 0%, #154a33 100%)",
          }}
        >
          <Plus className="w-4 h-4" />
          {lang === "ar" ? "إنشاء واجب / نشاط" : "New Assignment"}
        </button>
      </div>

      <Section
        title={
          lang === "ar" ? "الواجبات والمسابقات" : "Assignments & Competitions"
        }
        count={filteredAssignments.length}
        defaultOpen
      >
        {/* Search + filters — Activities Library–style shell */}
        <div className="rounded-xl border border-border/35 bg-gradient-to-b from-background/95 to-muted/[0.06] p-3 shadow-[0_1px_2px_rgba(15,23,42,0.055),0_10px_32px_-24px_rgba(30,77,53,0.07)] ring-1 ring-black/[0.025] dark:ring-white/[0.035] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.04)] dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.03)] space-y-2.5 mb-2">
          <div className="relative">
            <Search
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-muted-foreground/60 ${lang === "ar" ? "right-3.5" : "left-3.5"}`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === "ar" ? "ابحث عن واجب أو مادة..." : "Search assignment or subject..."
              }
              className={`w-full py-[11px] bg-background border border-border/42 rounded-xl text-sm placeholder:text-muted-foreground/42 focus:outline-none focus:ring-2 focus:ring-primary/[0.12] focus:border-primary/26 transition-[border-color,box-shadow] duration-150 shadow-[inset_0_1px_2px_rgba(15,23,42,0.045)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)] ${lang === "ar" ? "pr-11 pl-3.5 text-right" : "pl-11 pr-3.5"}`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground ${lang === "ar" ? "left-3" : "right-3"}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div
            className="flex items-center gap-2 flex-wrap"
            dir={lang === "ar" ? "rtl" : "ltr"}
          >
            {[
              { key: "all", label: lang === "ar" ? "الكل" : "All" },
              {
                key: "favorites",
                label: lang === "ar" ? "المفضلة" : "Favorites",
              },
              { key: "active", label: lang === "ar" ? "نشط" : "Active" },
              { key: "expired", label: lang === "ar" ? "منتهي" : "Expired" },
            ].map((f) => (
              <button
                type="button"
                key={f.key}
                onClick={() => setStatusFilter(f.key as any)}
                className={cn(
                  "px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-[border-color,box-shadow,background-color] duration-150 border",
                  statusFilter === f.key
                    ? "bg-[#1E4D35] text-white border-[#1E4D35] shadow-[0_4px_14px_-10px_rgba(30,77,53,0.55)] ring-1 ring-black/[0.05]"
                    : "bg-background/85 text-muted-foreground border-border/48 hover:border-primary/22 hover:text-foreground shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]",
                )}
              >
                {f.key === "favorites" && (
                  <Star className="inline-block w-3 h-3 me-1 opacity-90 align-[-2px]" />
                )}
                {f.label}
              </button>
            ))}
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums ms-0.5 px-2.5 py-1 rounded-xl bg-background/75 border border-border/38 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              {statusFiltered.length}
            </span>
          </div>
        </div>

        {/* Assignments list */}
        <div className="space-y-2.5 mb-3">
          {statusFiltered.length === 0 ? (
            (assignments?.length || 0) === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/[0.04] px-5 py-9 text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-primary/[0.09] flex items-center justify-center ring-1 ring-primary/15">
                  <BookText className="w-7 h-7 text-primary/80" />
                </div>
                <h4 className="font-bold text-foreground text-sm mb-1">
                  {lang === "ar"
                    ? "لا توجد واجبات بعد"
                    : "No assignments yet"}
                </h4>
                <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto leading-relaxed">
                  {lang === "ar"
                    ? "ابدأ بإنشاء نشاطك الأول وشاركه مع طلابك."
                    : "Create your first activity and share it with your students."}
                </p>
                <button
                  type="button"
                  onClick={() => setLocation("/teacher/new")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition-[filter] hover:brightness-105"
                  style={{
                    background: "linear-gradient(180deg, #1b5c3d 0%, #154a33 100%)",
                    boxShadow: "0 10px 24px -14px rgba(21, 74, 51, 0.55)",
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {lang === "ar" ? "إنشاء نشاط" : "Create activity"}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/[0.04] px-5 py-6 text-center">
                <Search className="w-6 h-6 mx-auto text-muted-foreground/55 mb-2" />
                <p className="text-sm font-bold text-foreground mb-1">
                  {lang === "ar"
                    ? "لا توجد نتائج مطابقة"
                    : "No matching results"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "ar"
                    ? "جرّب تغيير الفلتر أو مسح البحث."
                    : "Try another filter or clear search."}
                </p>
              </div>
            )
          ) : (
            (() => {
              const PAGE = 6;
              const visibleAssignments = showAllAssignments
                ? statusFiltered
                : statusFiltered.slice(0, PAGE);
              const hiddenCount = statusFiltered.length - PAGE;
              return (
                <>
                  {visibleAssignments.map((a: any) => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      groupName={groupNameById(a.id)}
                      isExpanded={expandedRowId === a.id}
                      onToggle={() =>
                        setExpandedRowId(expandedRowId === a.id ? null : a.id)
                      }
                      creatingGameForId={creatingGameForId}
                      startGame={startGame}
                      deleteAssignment={deleteAssignment}
                      setLocation={setLocation}
                      lang={lang}
                      t={t}
                      queryClient={queryClient}
                      onShare={onShare}
                      collections={collections}
                      addToCollection={addToCollection}
                      removeFromCollection={removeFromCollection}
                      creatingGroupName={creatingGroupName}
                      setCreatingGroupName={setCreatingGroupName}
                      createGroupAndAdd={createGroupAndAdd}
                      savingGroup={savingGroup}
                      isFavorite={favorites.has(a.id)}
                      onToggleFavorite={(e: React.MouseEvent) =>
                        toggleFavorite(a.id, e)
                      }
                    />
                  ))}
                  {!showAllAssignments && hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllAssignments(true)}
                      className="w-full py-2.5 bg-background/90 border border-border/55 rounded-xl text-xs font-semibold text-primary hover:bg-muted/40 hover:border-primary/25 transition-all shadow-sm"
                    >
                      {lang === "ar"
                        ? `عرض الكل (${statusFiltered.length})`
                        : `View all (${statusFiltered.length})`}
                    </button>
                  )}
                  {showAllAssignments && statusFiltered.length > PAGE && (
                    <button
                      type="button"
                      onClick={() => setShowAllAssignments(false)}
                      className="w-full py-2.5 bg-muted/25 border border-border/45 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {lang === "ar" ? "عرض أقل" : "Show less"}
                    </button>
                  )}
                </>
              );
            })()
          )}
          <button
            type="button"
            onClick={() => setLocation("/teacher/new")}
            className="w-full py-2.5 border border-dashed border-border/65 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/[0.03] transition-colors"
          >
            + {lang === "ar" ? "إضافة واجب" : "Add Assignment"}
          </button>
        </div>

        {/* Games grid */}
        <div className="border-t border-border/45 pt-2.5 mt-0.5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
            {lang === "ar" ? "الألعاب والمسابقات" : "Games & Competitions"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {games.map((game, i) => {
              const Icon = game.icon;
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => launchGame(game.type)}
                  className="flex items-start gap-2.5 p-3 min-h-[56px] bg-background/80 border border-border/55 rounded-xl hover:bg-card hover:border-primary/15 hover:shadow-sm transition-all text-start"
                >
                  <div className="p-2 rounded-lg bg-primary/[0.06] text-primary shrink-0 ring-1 ring-primary/10">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-foreground leading-tight">
                        {game.title}
                      </p>
                      {game.tag && (
                        <span className="text-[9px] font-bold uppercase tracking-wide bg-[#D9A521]/12 text-amber-900/85 dark:text-amber-100/90 border border-[#D9A521]/25 px-1.5 py-0.5 rounded-md">
                          {game.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {game.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Section>

    </div>
  );
}

/* ── Interactive Video Lessons Tab ── */
function VideoLessonsTab({ lang, setLocation, user }: any) {
  const [lessons, setLessons] = useState<VideoLessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const BASE = import.meta.env.VITE_API_URL || "";
  const isAr = lang === "ar";

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/api/video-lessons`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: VideoLessonSummary[]) =>
        setLessons(Array.isArray(data) ? data : []),
      )
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl border border-border/40 bg-card animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="p-2 rounded-xl bg-red-500/10 shrink-0">
            <Video className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-foreground truncate">
              {isAr ? "الفيديو التفاعلي" : "Interactive Video"}
            </h2>
            <p className="text-xs text-muted-foreground truncate">
              {lessons.length}{" "}
              {isAr ? "فيديو" : lessons.length === 1 ? "video" : "videos"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setLocation("/teacher/video-lesson/new")}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          {isAr ? "فيديو جديد" : "New Video"}
        </button>
      </div>

      {/* Empty state */}
      {lessons.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <Video className="w-8 h-8 text-red-400/60" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-2">
            {isAr ? "لا يوجد فيديو تفاعلي بعد" : "No interactive videos yet"}
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
            {isAr
              ? "أنشئ فيديو يحتوي على أسئلة تظهر للطالب أثناء المشاهدة"
              : "Create a video with questions that appear while students watch"}
          </p>
          <button
            onClick={() => setLocation("/teacher/video-lesson/new")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold text-sm rounded-xl transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            {isAr ? "إنشاء أول فيديو" : "Create First Video"}
          </button>
        </div>
      ) : (
        /* Lessons grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {lessons.map((vl) => (
            <button
              key={vl.id}
              onClick={() => setLocation(`/teacher/video-lesson/${vl.id}`)}
              className="flex items-stretch gap-0 rounded-2xl border border-border/60 bg-card hover:border-red-300 hover:shadow-md transition-all text-start overflow-hidden group"
            >
              {/* Thumbnail */}
              <div className="w-[90px] shrink-0 bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center relative">
                <Video className="w-7 h-7 text-red-400/50" />
                <span className="absolute bottom-1.5 start-1.5 text-[9px] font-bold bg-black/40 text-white px-1.5 py-0.5 rounded-md">
                  {vl.videoType === "youtube"
                    ? "YT"
                    : vl.videoType === "upload"
                      ? "UP"
                      : "URL"}
                </span>
              </div>
              {/* Content */}
              <div className="flex-1 p-3 min-w-0">
                <p className="text-sm font-bold text-foreground line-clamp-2 leading-tight mb-1">
                  {vl.title}
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  {vl.subject && (
                    <span className="bg-muted px-2 py-0.5 rounded-md">
                      {vl.subject}
                    </span>
                  )}
                  {vl.targetClass && (
                    <span className="bg-muted px-2 py-0.5 rounded-md">
                      {vl.targetClass}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquarePlus className="w-3 h-3" />
                    {vl.questionCount} {isAr ? "سؤال" : "Q"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {vl.submissionCount} {isAr ? "تسليم" : "sub."}
                  </span>
                </div>
              </div>
              <div className="flex items-center px-3 text-muted-foreground/40 group-hover:text-red-400 transition-colors">
                {lang === "ar" ? (
                  <ArrowLeft className="w-4 h-4" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Admin note about video upload */}
      {user?.isAdmin && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          {isAr
            ? "بصفتك مسؤولاً، يمكنك رفع ملفات فيديو مباشرة عند إنشاء الدرس"
            : "As admin, you can upload video files directly when creating a lesson"}
        </p>
      )}
    </div>
  );
}
