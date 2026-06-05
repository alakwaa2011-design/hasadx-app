/**
 * Shared game icon components.
 * Each component uses React.useId() to generate unique SVG gradient/clipPath IDs,
 * so multiple instances on the same page won't conflict.
 */
import { useId } from "react";

export const WameethIcon = ({ height = 36 }: { height?: number }) => {
  const uid = useId().replace(/:/g, "");
  const w = Math.round(height * 130 / 72);
  return (
    <svg width={w} height={height} viewBox="0 0 130 72" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}wm-red`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C41818"/><stop offset="100%" stopColor="#7A0A0A"/>
        </linearGradient>
        <linearGradient id={`${uid}wm-blue`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1870C0"/><stop offset="100%" stopColor="#08386E"/>
        </linearGradient>
        <linearGradient id={`${uid}wm-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DAA520"/><stop offset="100%" stopColor="#9A6A08"/>
        </linearGradient>
        <linearGradient id={`${uid}wm-purple`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B40D8"/><stop offset="100%" stopColor="#5A1A8A"/>
        </linearGradient>
      </defs>
      <rect width="130" height="72" rx="10" fill="#0D2118"/>
      <rect x="68" y="4"  width="58" height="30" rx="6" fill={`url(#${uid}wm-red)`}/>
      <text x="97" y="19" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="16" fontWeight="bold" fontFamily="system-ui,sans-serif">أ</text>
      <rect x="4"  y="4"  width="58" height="30" rx="6" fill={`url(#${uid}wm-blue)`}/>
      <text x="33" y="19" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="16" fontWeight="bold" fontFamily="system-ui,sans-serif">ب</text>
      <rect x="68" y="38" width="58" height="30" rx="6" fill={`url(#${uid}wm-gold)`}/>
      <text x="97" y="53" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="16" fontWeight="bold" fontFamily="system-ui,sans-serif">ج</text>
      <rect x="4"  y="38" width="58" height="30" rx="6" fill={`url(#${uid}wm-purple)`}/>
      <text x="33" y="53" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="16" fontWeight="bold" fontFamily="system-ui,sans-serif">د</text>
    </svg>
  );
};

export const HackIcon = ({ size = 56 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`${uid}hck-screen`}><rect x="17" y="20" width="66" height="38"/></clipPath>
        <radialGradient id={`${uid}hck-glow`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#00ff41" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#00ff41" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="6" y="8" width="88" height="60" rx="6" fill="#1c1c1c"/>
      <rect x="10" y="12" width="80" height="52" rx="4" fill="#111"/>
      <rect x="17" y="18" width="66" height="42" rx="2" fill="#020d05"/>
      <g clipPath={`url(#${uid}hck-screen)`}>
        <rect x="17" y="18" width="66" height="42" fill={`url(#${uid}hck-glow)`}/>
        <text x="20" y="28" fill="#00ff41" fontSize="5.2" fontFamily="monospace" opacity="0.85">01 AC FF 7E 3B</text>
        <text x="20" y="34" fill="#00dd33" fontSize="5.2" fontFamily="monospace" opacity="0.7">{"if(root){hack()}"}</text>
        <text x="20" y="40" fill="#00ff41" fontSize="5.2" fontFamily="monospace" fontWeight="bold">ACCESS_GRANTED</text>
        <text x="20" y="46" fill="#009922" fontSize="5.2" fontFamily="monospace" opacity="0.6">0xDEAD 0xBEEF</text>
        <text x="20" y="52" fill="#00dd33" fontSize="5.2" fontFamily="monospace" opacity="0.75">{">>> decrypt..."}</text>
        <text x="50" y="53" fill="#39ff14" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="2">HACK</text>
        <rect x="74" y="47" width="4" height="6" fill="#00ff41"/>
      </g>
      <rect x="3" y="68" width="94" height="9" rx="4" fill="#1c1c1c"/>
      <rect x="6" y="67" width="88" height="4" rx="2" fill="#141414"/>
      <rect x="37" y="70" width="26" height="4" rx="2" fill="#2a2a2a"/>
    </svg>
  );
};

export const MemoryIcon = ({ size = 56 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  const cW = 28, cH = 38, gX = 4, gY = 4, sX = 5, sY = 11;
  type CardDef = { x: number; y: number; matched: boolean };
  const cards: CardDef[] = [
    { x: sX,            y: sY,       matched: false },
    { x: sX+cW+gX,      y: sY,       matched: true  },
    { x: sX+(cW+gX)*2,  y: sY,       matched: false },
    { x: sX,            y: sY+cH+gY, matched: false },
    { x: sX+cW+gX,      y: sY+cH+gY, matched: true  },
    { x: sX+(cW+gX)*2,  y: sY+cH+gY, matched: false },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}mem-back`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#4338CA"/>
        </linearGradient>
        <linearGradient id={`${uid}mem-rose`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FB7185"/><stop offset="100%" stopColor="#BE123C"/>
        </linearGradient>
        <pattern id={`${uid}mem-stripe`} width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="0" y1="6" x2="6" y2="0" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
        </pattern>
      </defs>
      {cards.map((c, i) => c.matched ? (
        <g key={i}>
          <rect x={c.x} y={c.y} width={cW} height={cH} rx="5" fill={`url(#${uid}mem-rose)`}/>
          <rect x={c.x} y={c.y} width={cW} height={10} rx="5" fill="rgba(255,255,255,0.22)"/>
          <text x={c.x+cW/2} y={c.y+cH/2+1} textAnchor="middle" dominantBaseline="central" fontSize="15" fill="white">★</text>
          <rect x={c.x-1.5} y={c.y-1.5} width={cW+3} height={cH+3} rx="6.5" fill="none" stroke="#4ADE80" strokeWidth="2.2"/>
        </g>
      ) : (
        <g key={i}>
          <rect x={c.x} y={c.y} width={cW} height={cH} rx="5" fill={`url(#${uid}mem-back)`}/>
          <rect x={c.x} y={c.y} width={cW} height={cH} rx="5" fill={`url(#${uid}mem-stripe)`}/>
          <circle cx={c.x+4}    cy={c.y+4}    r="1.5" fill="rgba(255,255,255,0.45)"/>
          <circle cx={c.x+cW-4} cy={c.y+4}    r="1.5" fill="rgba(255,255,255,0.45)"/>
          <circle cx={c.x+4}    cy={c.y+cH-4} r="1.5" fill="rgba(255,255,255,0.45)"/>
          <circle cx={c.x+cW-4} cy={c.y+cH-4} r="1.5" fill="rgba(255,255,255,0.45)"/>
          <text x={c.x+cW/2} y={c.y+cH/2+1} textAnchor="middle" dominantBaseline="central" fontSize="13" fill="rgba(255,255,255,0.35)">?</text>
        </g>
      ))}
    </svg>
  );
};

export const LetrlyIcon = ({ size = 56 }: { size?: number }) => {
  const sq = 16, gap = 3;
  const startX = (100 - (5 * sq + 4 * gap)) / 2;
  const startY = 8;
  const rows: Array<Array<[string, "g"|"y"|"z"]>> = [
    [["ح","z"],["ف","z"],["ك","z"],["ن","z"],["س","z"]],
    [["م","g"],["ر","z"],["ا","g"],["س","z"],["ب","g"]],
    [["م","g"],["ل","g"],["ا","g"],["ع","g"],["ب","g"]],
  ];
  const fill = { g: "#10B981", y: "#F59E0B", z: "#6B7280" };
  const border = { g: "#059669", y: "#D97706", z: "#4B5563" };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="14" fill="#F8FAF9"/>
      {rows.map((row, ri) =>
        row.map(([letter, state], ci) => {
          const x = startX + ci * (sq + gap);
          const y = startY + ri * (sq + gap + 2);
          return (
            <g key={`${ri}-${ci}`}>
              <rect x={x} y={y} width={sq} height={sq} rx="3" fill={fill[state]} stroke={border[state]} strokeWidth="1"/>
              <text x={x+sq/2} y={y+sq/2+1} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="9" fontWeight="900" fontFamily="system-ui,sans-serif">{letter}</text>
            </g>
          );
        })
      )}
      <text x="50" y="93" textAnchor="middle" dominantBaseline="central" fill="#256B3A" fontSize="7.5" fontWeight="700" fontFamily="system-ui,sans-serif">خمن الكلمة</text>
    </svg>
  );
};

export const ScrambleIcon = ({ size = 56 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  const slotY = 14, slotW = 18, slotH = 22, slotGap = 4;
  const slotStart = (100 - (4 * slotW + 3 * slotGap)) / 2;
  const tileY = 58, tileW = 22, tileH = 26, tileGap = 5;
  const tileStart = (100 - (3 * tileW + 2 * tileGap)) / 2;
  const letters = ["ص", "ا", "د"];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}scr-tile`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#5B21B6"/>
        </linearGradient>
        <linearGradient id={`${uid}scr-filled`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5CF6"/><stop offset="100%" stopColor="#6D28D9"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="14" fill="#F5F0FF"/>
      <rect width="100" height="18" rx="14" fill="rgba(139,92,246,0.08)"/>
      {[0,1,2,3].map(i => {
        const x = slotStart + i * (slotW + slotGap);
        const filled = i === 3;
        return (
          <g key={i}>
            {filled && <rect x={x} y={slotY+4} width={slotW} height={slotH} rx="5" fill="rgba(109,40,217,0.35)"/>}
            <rect x={x} y={slotY} width={slotW} height={slotH} rx="5"
                  fill={filled ? `url(#${uid}scr-filled)` : "rgba(139,92,246,0.12)"}
                  stroke={filled ? "none" : "#C4B5FD"} strokeWidth="1.5"/>
            {filled && (
              <text x={x+slotW/2} y={slotY+slotH/2+1} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="13" fontWeight="900" fontFamily="system-ui,sans-serif">ح</text>
            )}
          </g>
        );
      })}
      <text x="50" y="47" textAnchor="middle" dominantBaseline="central" fill="#7C3AED" fontSize="7.5" fontWeight="600" fontFamily="system-ui,sans-serif">رتّب الحروف</text>
      {letters.map((letter, i) => {
        const x = tileStart + i * (tileW + tileGap);
        return (
          <g key={i}>
            <rect x={x} y={tileY+5} width={tileW} height={tileH} rx="6" fill="#6D28D9" opacity="0.45"/>
            <rect x={x} y={tileY} width={tileW} height={tileH} rx="6" fill={`url(#${uid}scr-tile)`}/>
            <rect x={x} y={tileY} width={tileW} height={8} rx="6" fill="rgba(255,255,255,0.22)"/>
            <text x={x+tileW/2} y={tileY+tileH/2+1} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="15" fontWeight="900" fontFamily="system-ui,sans-serif">{letter}</text>
          </g>
        );
      })}
    </svg>
  );
};

export const StroopIcon = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="14" fill="#FFFBF5"/>
    <rect width="100" height="16" rx="14" fill="rgba(239,68,68,0.06)"/>
    <text x="50" y="34" textAnchor="middle" dominantBaseline="central" fill="#2563EB" fontSize="30" fontWeight="900" fontFamily="'Segoe UI',Tahoma,Arial,sans-serif">أحمر</text>
    <line x1="14" y1="52" x2="86" y2="52" stroke="#E5E7EB" strokeWidth="1.5"/>
    <text x="50" y="70" textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="30" fontWeight="900" fontFamily="'Segoe UI',Tahoma,Arial,sans-serif">أزرق</text>
    <text x="50" y="89" textAnchor="middle" dominantBaseline="central" fill="#9CA3AF" fontSize="8" fontFamily="system-ui,sans-serif">ما لون الحبر؟</text>
  </svg>
);

export const ArenaIcon = ({ size = 56 }: { size?: number }) => {
  const cols = 3, rows = 3, pad = 3, gap = 2;
  const cardW = Math.round((size - pad*2 - gap*(cols-1)) / cols);
  const cardH = Math.round((size - pad*2 - gap*(rows-1)) / rows);
  const colors = ["#2a5d6a", "#4a5572", "#a07f37"];
  const labels = ["200", "400", "600"];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg"
         style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>
      <rect width={size} height={size} rx="10" fill="#0f1e14"/>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((_, col) => {
          const x = pad + col * (cardW + gap);
          const y = pad + row * (cardH + gap);
          const color = colors[row];
          const label = labels[row];
          const fontSize = Math.round(cardH * 0.38);
          return (
            <g key={`${row}-${col}`}>
              <rect x={x} y={y} width={cardW} height={cardH} rx="3" fill={color}/>
              <rect x={x} y={y} width={cardW} height={Math.round(cardH*0.35)} rx="3" fill="rgba(255,255,255,0.08)"/>
              <text x={x+cardW/2} y={y+cardH/2+fontSize*0.36} textAnchor="middle" fill="#fff" fontSize={fontSize} fontFamily="monospace" fontWeight="bold">{label}</text>
            </g>
          );
        })
      )}
      <rect x={pad} y={pad} width={size-pad*2} height="2" rx="1" fill="#d6ad55" opacity="0.6"/>
    </svg>
  );
};

export const RocketIcon = ({ size = 70 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  const color = "#ef4444";
  const w = Math.round(size * 60 / 96);
  return (
    <svg width={w} height={size} viewBox="0 0 60 96" xmlns="http://www.w3.org/2000/svg"
         style={{ filter: `drop-shadow(0 2px 10px ${color}90)` }}>
      <defs>
        <linearGradient id={`${uid}rkt-body`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.75"/>
          <stop offset="40%" stopColor="#fff" stopOpacity="0.2"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.95"/>
        </linearGradient>
      </defs>
      <path d="M20 78 Q30 100 40 78 Q35 90 30 92 Q25 90 20 78 Z" fill="#ff6b1a" opacity="0.95"/>
      <path d="M23 78 Q30 90 37 78 Q33 86 30 88 Q27 86 23 78 Z" fill="#ffd54f" opacity="0.95"/>
      <path d="M26 78 Q30 84 34 78 Q32 82 30 83 Q28 82 26 78 Z" fill="#fff9c4" opacity="0.9"/>
      <path d="M30 4 L44 30 L44 70 Q44 80 30 80 Q16 80 16 70 L16 30 Z" fill={color}/>
      <path d="M30 4 L44 30 L44 70 Q44 80 30 80 Q16 80 16 70 L16 30 Z" fill={`url(#${uid}rkt-body)`}/>
      <circle cx="30" cy="40" r="8" fill="#b3e5fc" stroke="#fff" strokeWidth="2.5" opacity="0.95"/>
      <circle cx="30" cy="40" r="5" fill="#0288d1" opacity="0.7"/>
      <circle cx="28" cy="38" r="2" fill="#fff" opacity="0.55"/>
      <path d="M16 62 L4 82 L16 78 Z" fill={color} opacity="0.9"/>
      <path d="M44 62 L56 82 L44 78 Z" fill={color} opacity="0.9"/>
    </svg>
  );
};

export const MillionIcon = ({ size = 56 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"
         style={{ filter: "drop-shadow(0 2px 10px rgba(245,158,11,0.5))" }}>
      <defs>
        <radialGradient id={`${uid}ml-bg`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#0d1f3c"/><stop offset="100%" stopColor="#060e1e"/>
        </radialGradient>
        <linearGradient id={`${uid}ml-opt`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e3a7b"/><stop offset="100%" stopColor="#132660"/>
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="12" fill={`url(#${uid}ml-bg)`}/>
      <circle cx="28" cy="10" r="7" fill="#f59e0b" opacity="0.15"/>
      <circle cx="28" cy="10" r="5.5" fill="#f59e0b" opacity="0.25"/>
      <text x="28" y="14" textAnchor="middle" fill="#fde68a" fontSize="9" fontWeight="900" fontFamily="Georgia,serif">?</text>
      <rect x="50" y="18" width="3" height="20" rx="1.5" fill="rgba(245,158,11,0.15)"/>
      <rect x="50" y="30" width="3" height="4"  rx="1.5" fill="#f59e0b" opacity="0.7"/>
      <rect x="30" y="20" width="22" height="10" rx="5" fill={`url(#${uid}ml-opt)`} stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.6"/>
      <text x="47" y="27.5" fill="#93c5fd" fontSize="5.5" fontWeight="800" fontFamily="monospace" textAnchor="middle">أ</text>
      <rect x="32" y="23" width="12" height="1.5" rx="0.7" fill="rgba(255,255,255,0.07)"/>
      <rect x="4"  y="20" width="22" height="10" rx="5" fill={`url(#${uid}ml-opt)`} stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.6"/>
      <text x="21" y="27.5" fill="#93c5fd" fontSize="5.5" fontWeight="800" fontFamily="monospace" textAnchor="middle">ب</text>
      <rect x="6"  y="23" width="12" height="1.5" rx="0.7" fill="rgba(255,255,255,0.07)"/>
      <rect x="30" y="34" width="22" height="10" rx="5" fill="#92400e" stroke="#f59e0b" strokeWidth="1"/>
      <text x="47" y="41.5" fill="#fde68a" fontSize="5.5" fontWeight="800" fontFamily="monospace" textAnchor="middle">ج</text>
      <rect x="32" y="37" width="12" height="1.5" rx="0.7" fill="rgba(255,255,255,0.12)"/>
      <rect x="4"  y="34" width="22" height="10" rx="5" fill={`url(#${uid}ml-opt)`} stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.6"/>
      <text x="21" y="41.5" fill="#93c5fd" fontSize="5.5" fontWeight="800" fontFamily="monospace" textAnchor="middle">د</text>
      <rect x="6"  y="37" width="12" height="1.5" rx="0.7" fill="rgba(255,255,255,0.07)"/>
      <circle cx="18" cy="51" r="2.5" fill="#f59e0b" opacity="0.85"/>
      <circle cx="28" cy="51" r="2.5" fill="#3b82f6" opacity="0.75"/>
      <circle cx="38" cy="51" r="2.5" fill="#10b981" opacity="0.75"/>
    </svg>
  );
};

export const HotSeatIcon = ({ size = 56 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"
         style={{ filter: "drop-shadow(0 3px 18px rgba(234,88,12,0.75))" }}>
      <defs>
        <radialGradient id={`${uid}hs-glow`} cx="50%" cy="78%" r="60%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.9"/>
          <stop offset="55%" stopColor="#c2410c" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#7c2d12" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={`${uid}hs-dark`} x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#232336"/><stop offset="100%" stopColor="#111122"/>
        </linearGradient>
        <linearGradient id={`${uid}hs-mid`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2e2e48"/><stop offset="100%" stopColor="#1a1a30"/>
        </linearGradient>
      </defs>
      <rect width="60" height="60" rx="13" fill="#07070e"/>
      <rect width="60" height="60" rx="13" fill={`url(#${uid}hs-glow)`}/>
      <rect x="20" y="5" width="20" height="8" rx="4" fill={`url(#${uid}hs-dark)`}/>
      <rect x="21" y="6" width="18" height="3.5" rx="1.5" fill="rgba(255,255,255,0.09)"/>
      <rect x="20" y="11.5" width="20" height="1.5" rx="0.7" fill="#f97316" opacity="0.55"/>
      <path d="M16 12 Q15 34 17 36 L43 36 Q45 34 44 12 Z" fill={`url(#${uid}hs-dark)`}/>
      <line x1="30" y1="14" x2="30" y2="35" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      <path d="M17 28 Q30 32 43 28 L43 34 Q30 36 17 34 Z" fill="rgba(255,255,255,0.04)"/>
      <rect x="16" y="35.5" width="28" height="1.8" rx="0.9" fill="#f97316" opacity="0.8"/>
      <rect x="8"  y="35" width="3" height="7" rx="1.5" fill={`url(#${uid}hs-mid)`}/>
      <rect x="5"  y="30" width="10" height="3" rx="1.5" fill={`url(#${uid}hs-dark)`}/>
      <rect x="49" y="35" width="3" height="7" rx="1.5" fill={`url(#${uid}hs-mid)`}/>
      <rect x="45" y="30" width="10" height="3" rx="1.5" fill={`url(#${uid}hs-dark)`}/>
      <rect x="12" y="35" width="36" height="9" rx="4.5" fill={`url(#${uid}hs-mid)`}/>
      <rect x="13" y="36" width="34" height="4" rx="2" fill="rgba(255,255,255,0.09)"/>
      <rect x="12" y="43" width="36" height="1.5" rx="0.7" fill="#f97316" opacity="0.9"/>
      <rect x="26" y="44" width="8" height="8" rx="2" fill="#101020"/>
      <rect x="27" y="44" width="4" height="4" rx="1" fill="rgba(255,255,255,0.05)"/>
      {[0,72,144,216,288].map((deg, i) => {
        const r = 12;
        const rad = (deg - 90) * Math.PI / 180;
        const x2 = 30 + r * Math.cos(rad);
        const y2 = 54 + r * Math.sin(rad) * 0.45;
        return (
          <g key={i}>
            <line x1="30" y1="54" x2={x2} y2={y2} stroke="#1a1a30" strokeWidth="3.5" strokeLinecap="round"/>
            <line x1="30" y1="54" x2={x2} y2={y2} stroke="#2a2a44" strokeWidth="2" strokeLinecap="round"/>
            <ellipse cx={x2} cy={y2} rx="2.2" ry="1.5" fill="#111120"/>
            <ellipse cx={x2} cy={y2} rx="1.3" ry="0.9" fill="#f97316" opacity="0.45"/>
          </g>
        );
      })}
      <circle cx="30" cy="54" r="3" fill="#1a1a30"/>
      <circle cx="30" cy="54" r="1.5" fill="#f97316" opacity="0.5"/>
      <ellipse cx="30" cy="57" rx="18" ry="2.5" fill="#f97316" opacity="0.2"/>
    </svg>
  );
};

export const PublicQuizIcon = ({ size = 56 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg"
         style={{ filter: "drop-shadow(0 2px 10px rgba(30,77,53,0.55))" }}>
      <defs>
        <radialGradient id={`${uid}pq-globe`} cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#2d7a50"/><stop offset="100%" stopColor="#0F2A20"/>
        </radialGradient>
        <clipPath id={`${uid}pq-clip`}><circle cx="26" cy="28" r="20"/></clipPath>
      </defs>
      <circle cx="26" cy="28" r="20" fill={`url(#${uid}pq-globe)`}/>
      <g clipPath={`url(#${uid}pq-clip)`} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2">
        <line x1="6" y1="28" x2="46" y2="28"/>
        <line x1="8" y1="20" x2="44" y2="20"/>
        <line x1="8" y1="36" x2="44" y2="36"/>
        <ellipse cx="26" cy="28" rx="8" ry="20"/>
        <ellipse cx="26" cy="28" rx="15" ry="20"/>
        <ellipse cx="26" cy="28" rx="20" ry="20"/>
      </g>
      <ellipse cx="20" cy="18" rx="8" ry="5" fill="rgba(255,255,255,0.08)"/>
      <circle cx="26" cy="28" r="20" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <circle cx="42" cy="14" r="11" fill="#0F2A20"/>
      <circle cx="42" cy="14" r="9.5" fill="#1E4D35"/>
      <circle cx="42" cy="14" r="8" fill="#d6ad55"/>
      <text x="42" y="19" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900" fontFamily="Georgia, serif">?</text>
    </svg>
  );
};

export const VideoIcon = ({ size = 64 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  const w = size;
  const h = Math.round(size * 0.9);
  return (
    <svg width={w} height={h} viewBox="0 0 64 58" xmlns="http://www.w3.org/2000/svg"
         style={{ filter: "drop-shadow(0 2px 8px rgba(255,0,0,0.45))" }}>
      <rect x="4" y="18" width="56" height="36" rx="5" fill="#FF0000"/>
      <rect x="4" y="18" width="56" height="9" rx="5" fill="rgba(255,255,255,0.15)"/>
      <line x1="20" y1="26" x2="20" y2="54" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2"/>
      <line x1="36" y1="26" x2="36" y2="54" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2"/>
      <line x1="52" y1="26" x2="52" y2="54" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2"/>
      <circle cx="32" cy="38" r="11" fill="rgba(0,0,0,0.28)"/>
      <polygon points="28,32 28,44 41,38" fill="#FFFFFF"/>
      <rect x="4" y="8" width="56" height="12" rx="4" fill="#1a1a1a"/>
      <defs>
        <clipPath id={`${uid}clp-top`}><rect x="4" y="8" width="56" height="12" rx="4"/></clipPath>
      </defs>
      <g clipPath={`url(#${uid}clp-top)`}>
        {[0,1,2,3,4,5,6,7].map(i => (
          <polygon key={i}
            points={`${4+i*14},8 ${4+i*14+10},8 ${4+i*14+4},20 ${4+i*14-6},20`}
            fill={i % 2 === 0 ? "#FF0000" : "#ffffff"}
          />
        ))}
      </g>
      <rect x="4" y="8" width="56" height="12" rx="4" fill="none" stroke="#111" strokeWidth="1"/>
      <circle cx="10" cy="14" r="3" fill="#444"/>
      <circle cx="10" cy="14" r="1.5" fill="#888"/>
    </svg>
  );
};

export const MultiplyIcon = ({ size = 56 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}mul-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FB923C" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#D97706" stopOpacity="0.85"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="14" fill={`url(#${uid}mul-bg)`}/>
      <rect x="4" y="4" width="92" height="22" rx="14" fill="rgba(255,255,255,0.15)"/>
      <text x="50" y="46" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="30" fontWeight="900" fontFamily="system-ui,monospace">{"7 × 8"}</text>
      <text x="50" y="72" textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.75)" fontSize="24" fontWeight="700" fontFamily="system-ui,monospace">{"= ?"}</text>
    </svg>
  );
};

export const FlagQuizIcon = ({ size = 56 }: { size?: number }) => {
  const uid = useId().replace(/:/g, "");
  const h = Math.round(size * 76 / 100);
  return (
    <svg width={size} height={h} viewBox="0 0 100 76" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`${uid}fq-fr`}><rect x="2" y="2"  width="46" height="30" rx="5"/></clipPath>
        <clipPath id={`${uid}fq-jp`}><rect x="52" y="2"  width="46" height="30" rx="5"/></clipPath>
        <clipPath id={`${uid}fq-de`}><rect x="2" y="36" width="46" height="30" rx="5"/></clipPath>
        <clipPath id={`${uid}fq-it`}><rect x="52" y="36" width="46" height="30" rx="5"/></clipPath>
      </defs>
      <rect x="2"  y="2"  width="46" height="30" rx="5" fill="white"/>
      <g clipPath={`url(#${uid}fq-fr)`}>
        <rect x="2"   y="2"  width="15.3" height="30" fill="#002395"/>
        <rect x="17.3" y="2" width="15.3" height="30" fill="white"/>
        <rect x="32.6" y="2" width="15.4" height="30" fill="#ED2939"/>
      </g>
      <rect x="2"  y="2"  width="46" height="30" rx="5" fill="none" stroke="rgba(0,0,0,0.13)" strokeWidth="1.2"/>
      <rect x="52" y="2"  width="46" height="30" rx="5" fill="white"/>
      <g clipPath={`url(#${uid}fq-jp)`}><circle cx="75" cy="17" r="9.5" fill="#BC002D"/></g>
      <rect x="52" y="2"  width="46" height="30" rx="5" fill="none" stroke="rgba(0,0,0,0.13)" strokeWidth="1.2"/>
      <rect x="2"  y="36" width="46" height="30" rx="5" fill="#000"/>
      <g clipPath={`url(#${uid}fq-de)`}>
        <rect x="2" y="36" width="46" height="10" fill="#000"/>
        <rect x="2" y="46" width="46" height="10" fill="#DD0000"/>
        <rect x="2" y="56" width="46" height="10" fill="#FFCE00"/>
      </g>
      <rect x="2"  y="36" width="46" height="30" rx="5" fill="none" stroke="rgba(0,0,0,0.13)" strokeWidth="1.2"/>
      <rect x="52" y="36" width="46" height="30" rx="5" fill="white"/>
      <g clipPath={`url(#${uid}fq-it)`}>
        <rect x="52"   y="36" width="15.3" height="30" fill="#009246"/>
        <rect x="67.3" y="36" width="15.3" height="30" fill="white"/>
        <rect x="82.6" y="36" width="15.4" height="30" fill="#CE2B37"/>
      </g>
      <rect x="52" y="36" width="46" height="30" rx="5" fill="none" stroke="rgba(0,0,0,0.13)" strokeWidth="1.2"/>
    </svg>
  );
};

export const CapitalsIcon = ({ height = 36 }: { height?: number }) => {
  const uid = useId().replace(/:/g, "");
  const w = Math.round(height * 130 / 72);
  return (
    <svg width={w} height={height} viewBox="0 0 130 72" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}cap-red`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F87171"/><stop offset="100%" stopColor="#B91C1C"/>
        </linearGradient>
        <linearGradient id={`${uid}cap-blue`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60A5FA"/><stop offset="100%" stopColor="#1D4ED8"/>
        </linearGradient>
        <linearGradient id={`${uid}cap-amber`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCD34D"/><stop offset="100%" stopColor="#B45309"/>
        </linearGradient>
        <linearGradient id={`${uid}cap-green`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ADE80"/><stop offset="100%" stopColor="#15803D"/>
        </linearGradient>
      </defs>
      <rect width="130" height="72" rx="10" fill="#0D3D3A"/>
      <rect x="68" y="4"  width="58" height="30" rx="6" fill={`url(#${uid}cap-red)`}/>
      <text x="97" y="19" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui,sans-serif">باريس</text>
      <rect x="4"  y="4"  width="58" height="30" rx="6" fill={`url(#${uid}cap-blue)`}/>
      <text x="33" y="19" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui,sans-serif">لندن</text>
      <rect x="68" y="38" width="58" height="30" rx="6" fill={`url(#${uid}cap-amber)`}/>
      <text x="97" y="53" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui,sans-serif">طوكيو</text>
      <rect x="4"  y="38" width="58" height="30" rx="6" fill={`url(#${uid}cap-green)`}/>
      <text x="33" y="53" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="11" fontWeight="bold" fontFamily="system-ui,sans-serif">برلين</text>
    </svg>
  );
};

export const ColorGameIcon = ({ size = 56 }: { size?: number }) => {
  const base = "#7C3AED", diff = "#C084FC";
  const oddIdx = 9;
  const sq = 22, gap = 3, start = 2;
  const pos = (n: number) => start + n * (sq + gap);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 16 }).map((_, i) => {
        const row = Math.floor(i / 4), col = i % 4;
        const isOdd = i === oddIdx;
        return <rect key={i} x={pos(col)} y={pos(row)} width={sq} height={sq} rx="5" fill={isOdd ? diff : base} opacity={isOdd ? 1 : 0.88}/>;
      })}
      <rect x={pos(1)-2} y={pos(2)-2} width={sq+4} height={sq+4} rx="7" fill="none" stroke="white" strokeWidth="2" opacity="0.55"/>
    </svg>
  );
};

export const TugWarIcon = ({ size = 60 }: { size?: number }) => {
  const h = Math.round(size * 65 / 120);
  return (
    <svg width={size} height={h} viewBox="0 0 120 65" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="14" r="5.5" fill="#2563EB"/>
      <line x1="10" y1="20" x2="8"  y2="40" stroke="#2563EB" strokeWidth="3"   strokeLinecap="round"/>
      <line x1="10" y1="27" x2="25" y2="33" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8"  y1="40" x2="3"  y2="55" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="8"  y1="40" x2="13" y2="55" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="21" cy="12" r="4.5" fill="#1D4ED8" opacity="0.8"/>
      <line x1="21" y1="17" x2="19" y2="35" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
      <line x1="21" y1="23" x2="30" y2="33" stroke="#1D4ED8" strokeWidth="2"   strokeLinecap="round" opacity="0.8"/>
      <line x1="19" y1="35" x2="14" y2="52" stroke="#1D4ED8" strokeWidth="2"   strokeLinecap="round" opacity="0.8"/>
      <line x1="19" y1="35" x2="23" y2="52" stroke="#1D4ED8" strokeWidth="2"   strokeLinecap="round" opacity="0.8"/>
      <circle cx="110" cy="14" r="5.5" fill="#DC2626"/>
      <line x1="110" y1="20" x2="112" y2="40" stroke="#DC2626" strokeWidth="3"   strokeLinecap="round"/>
      <line x1="110" y1="27" x2="95"  y2="33" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="112" y1="40" x2="117" y2="55" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"/>
      <line x1="112" y1="40" x2="107" y2="55" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="99" cy="12" r="4.5" fill="#B91C1C" opacity="0.8"/>
      <line x1="99" y1="17" x2="101" y2="35" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
      <line x1="99" y1="23" x2="90"  y2="33" stroke="#B91C1C" strokeWidth="2"   strokeLinecap="round" opacity="0.8"/>
      <line x1="101" y1="35" x2="106" y2="52" stroke="#B91C1C" strokeWidth="2"  strokeLinecap="round" opacity="0.8"/>
      <line x1="101" y1="35" x2="97"  y2="52" stroke="#B91C1C" strokeWidth="2"  strokeLinecap="round" opacity="0.8"/>
      <path d="M30,33 Q60,30 90,33" stroke="#5C3A0A" strokeWidth="8" fill="none" strokeLinecap="round"/>
      <path d="M30,33 Q60,30 90,33" stroke="#C8861A" strokeWidth="6" fill="none" strokeLinecap="round"/>
      <path d="M30,33 Q60,30 90,33" stroke="#E8C050" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="6,6"/>
      <path d="M30,33 Q60,30 90,33" stroke="#8B5210" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="6,6" strokeDashoffset="6"/>
      <line x1="60" y1="22" x2="60" y2="43" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
      <polygon points="60,22 69,26 60,30" fill="#EF4444"/>
    </svg>
  );
};

export const WheelIcon = ({ size = 52 }: { size?: number }) => (
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
