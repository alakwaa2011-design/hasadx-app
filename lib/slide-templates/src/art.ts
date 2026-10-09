/* Illustration library for the v2 slide designs.
   Every drawing is a small standalone SVG (viewBox 0 0 200 200) painted with the colours of the
   active design, so the same idea looks native in every identity. The AI never draws: it names an
   idea (an `icon` hint or topic words) and `pickArt` returns the closest drawing. */

export interface ArtColors {
  /** main colour of the design */
  p: string;
  /** secondary colour */
  s: string;
  /** accent / highlight */
  a: string;
  /** dark ink */
  i: string;
}

type Draw = (c: ArtColors) => string;
const V = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${inner}</svg>`;

function star(cx: number, cy: number, r: number, fill: string, pts = 8): string {
  let d = "";
  for (let k = 0; k < pts * 2; k++) {
    const ang = (k * Math.PI) / pts - Math.PI / 2;
    const rr = k % 2 ? r * 0.55 : r;
    d += `${k ? "L" : "M"}${(cx + Math.cos(ang) * rr).toFixed(1)} ${(cy + Math.sin(ang) * rr).toFixed(1)}`;
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
}

export const ART: Record<string, Draw> = {
  idea: (c) => V(`<path d="M100 22a56 56 0 0 0-30 103v20h60v-20A56 56 0 0 0 100 22Z" fill="${c.a}"/><rect x="74" y="150" width="52" height="12" rx="6" fill="${c.i}"/><rect x="82" y="168" width="36" height="12" rx="6" fill="${c.i}"/><path d="M86 70l14 30 14-30" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 80h14M166 80h14M36 36l10 10M164 36l-10 10" stroke="${c.a}" stroke-width="7" stroke-linecap="round"/>`),
  book: (c) => V(`<path d="M24 50Q62 36 100 54V164Q62 148 24 162Z" fill="${c.p}"/><path d="M176 50Q138 36 100 54V164Q138 148 176 162Z" fill="${c.s}"/><path d="M36 66Q62 58 90 70M36 86Q62 78 90 90M36 106Q62 98 90 110" stroke="#fff" stroke-opacity=".6" stroke-width="5" fill="none"/><path d="M110 70Q138 58 164 66M110 90Q138 78 164 86" stroke="#fff" stroke-opacity=".6" stroke-width="5" fill="none"/>`),
  target: (c) => V(`<circle cx="100" cy="104" r="78" fill="${c.p}"/><circle cx="100" cy="104" r="58" fill="#fff"/><circle cx="100" cy="104" r="40" fill="${c.s}"/><circle cx="100" cy="104" r="20" fill="#fff"/><circle cx="100" cy="104" r="9" fill="${c.a}"/><path d="M100 104L166 38" stroke="${c.i}" stroke-width="7" stroke-linecap="round"/><path d="M150 22l16 16-6 22-22-6z" fill="${c.a}"/>`),
  trophy: (c) => V(`<path d="M56 28H144V84Q144 128 100 134Q56 128 56 84Z" fill="${c.a}"/><path d="M56 44Q20 44 28 84Q34 108 62 104" fill="none" stroke="${c.a}" stroke-width="9"/><path d="M144 44Q180 44 172 84Q166 108 138 104" fill="none" stroke="${c.a}" stroke-width="9"/><rect x="90" y="134" width="20" height="26" fill="${c.a}"/><rect x="60" y="158" width="80" height="16" rx="7" fill="${c.p}"/>${star(100, 76, 22, "#fff")}`),
  check: (c) => V(`<circle cx="100" cy="100" r="86" fill="${c.s}"/><circle cx="100" cy="100" r="74" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="4"/><path d="M58 102L90 134L146 70" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`),
  cross: (c) => V(`<circle cx="100" cy="100" r="86" fill="${c.a}"/><circle cx="100" cy="100" r="74" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="4"/><path d="M68 68L132 132M132 68L68 132" stroke="#fff" stroke-width="18" stroke-linecap="round"/>`),
  heart: (c) => V(`<path d="M100 172C30 120 22 62 62 48C84 40 98 56 100 68C102 56 116 40 138 48C178 62 170 120 100 172Z" fill="${c.a}"/><path d="M70 64q-18 4-20 28" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="8" stroke-linecap="round"/>`),
  question: (c) => V(`<circle cx="100" cy="100" r="82" fill="${c.p}"/><path d="M72 82a28 28 0 1 1 42 24c-10 6-14 12-14 24" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/><circle cx="100" cy="158" r="10" fill="${c.a}"/>`),
  chat: (c) => V(`<path d="M30 40H150Q168 40 168 58V116Q168 134 150 134H92L56 168V134H30Q12 134 12 116V58Q12 40 30 40Z" fill="${c.p}"/><rect x="40" y="70" width="100" height="10" rx="5" fill="#fff"/><rect x="40" y="94" width="68" height="10" rx="5" fill="#fff" fill-opacity=".7"/><circle cx="168" cy="144" r="26" fill="${c.a}"/><path d="M158 144h20M168 134v20" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`),
  people: (c) => V(`<circle cx="64" cy="70" r="26" fill="${c.p}"/><path d="M16 150Q16 108 64 108Q112 108 112 150Z" fill="${c.p}"/><circle cx="138" cy="78" r="22" fill="${c.s}"/><path d="M98 154Q98 116 138 116Q178 116 178 154Z" fill="${c.s}"/><circle cx="100" cy="50" r="14" fill="${c.a}"/>`),
  clock: (c) => V(`<circle cx="100" cy="106" r="76" fill="#fff" stroke="${c.p}" stroke-width="10"/><path d="M100 106V58M100 106L132 126" stroke="${c.p}" stroke-width="10" stroke-linecap="round"/><circle cx="100" cy="106" r="8" fill="${c.a}"/><rect x="84" y="14" width="32" height="14" rx="6" fill="${c.p}"/>${[0, 90, 180, 270].map((d) => `<rect x="97" y="38" width="6" height="12" rx="3" fill="${c.s}" transform="rotate(${d} 100 106)"/>`).join("")}`),
  star: (c) => V(`${star(100, 104, 82, c.a, 5)}${star(100, 104, 50, "#fff", 5).replace("fill=", 'fill-opacity=".5" fill=')}`),
  medal: (c) => V(`<path d="M64 20L100 84L136 20Z" fill="${c.p}"/><circle cx="100" cy="116" r="54" fill="${c.a}"/><circle cx="100" cy="116" r="42" fill="#fff" fill-opacity=".35"/>${star(100, 116, 28, c.p)}`),
  pencil: (c) => V(`<path d="M40 150L52 120L136 36L164 64L80 148Z" fill="${c.a}"/><path d="M136 36L164 64L176 52Q182 40 170 28Q158 18 148 24Z" fill="${c.p}"/><path d="M40 150L52 120L80 148Z" fill="#F4C1BC"/><path d="M40 150L46 134L56 144Z" fill="${c.i}"/>`),
  letters: (c) => V(`<rect x="14" y="40" width="172" height="120" rx="20" fill="${c.p}"/><text x="58" y="124" font-family="Cairo,Tajawal,sans-serif" font-weight="900" font-size="78" fill="#fff" text-anchor="middle">أ</text><text x="136" y="124" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="70" fill="${c.a}" text-anchor="middle">Aa</text>`),
  atom: (c) => V(`<ellipse cx="100" cy="100" rx="82" ry="30" fill="none" stroke="${c.p}" stroke-width="7"/><ellipse cx="100" cy="100" rx="82" ry="30" fill="none" stroke="${c.s}" stroke-width="7" transform="rotate(60 100 100)"/><ellipse cx="100" cy="100" rx="82" ry="30" fill="none" stroke="${c.a}" stroke-width="7" transform="rotate(120 100 100)"/><circle cx="100" cy="100" r="16" fill="${c.i}"/><circle cx="178" cy="100" r="8" fill="${c.p}"/><circle cx="60" cy="168" r="8" fill="${c.s}"/><circle cx="60" cy="32" r="8" fill="${c.a}"/>`),
  flask: (c) => V(`<path d="M78 24H122V80L168 154Q176 172 156 176H44Q24 172 32 154L78 80Z" fill="#fff" stroke="${c.p}" stroke-width="8" stroke-linejoin="round"/><path d="M58 128H142L168 160Q172 170 156 170H44Q28 170 32 160Z" fill="${c.s}"/><circle cx="90" cy="148" r="8" fill="#fff" fill-opacity=".7"/><circle cx="118" cy="138" r="6" fill="#fff" fill-opacity=".7"/><rect x="70" y="16" width="60" height="12" rx="6" fill="${c.p}"/>`),
  microscope: (c) => V(`<rect x="40" y="164" width="120" height="14" rx="7" fill="${c.p}"/><path d="M70 164A56 56 0 0 1 92 70" fill="none" stroke="${c.s}" stroke-width="12" stroke-linecap="round"/><rect x="84" y="26" width="30" height="76" rx="10" transform="rotate(22 99 64)" fill="${c.p}"/><rect x="62" y="124" width="64" height="10" rx="5" fill="${c.a}"/><circle cx="148" cy="52" r="10" fill="${c.a}"/>`),
  leaf: (c) => V(`<path d="M30 160C20 70 90 22 176 28C182 108 130 176 44 170" fill="${c.s}"/><path d="M30 170C70 120 110 84 160 44" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="7" stroke-linecap="round"/><path d="M80 120l36-4M100 98l30-8M62 140l30 0" stroke="#fff" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>`),
  sun: (c) => V(`<circle cx="100" cy="100" r="40" fill="${c.a}"/>${[...Array(12)].map((_, k) => `<rect x="95" y="18" width="10" height="26" rx="5" fill="${c.a}" transform="rotate(${k * 30} 100 100)"/>`).join("")}`),
  drop: (c) => V(`<path d="M100 20C70 66 44 96 44 128A56 56 0 0 0 156 128C156 96 130 66 100 20Z" fill="${c.s}"/><path d="M76 132a26 26 0 0 0 24 26" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="8" stroke-linecap="round"/>`),
  planet: (c) => V(`<circle cx="100" cy="100" r="52" fill="${c.p}"/><path d="M62 82q38-22 80 6M56 112q44 16 90-10" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="9"/><ellipse cx="100" cy="100" rx="92" ry="22" fill="none" stroke="${c.a}" stroke-width="9" transform="rotate(-20 100 100)"/><circle cx="168" cy="40" r="5" fill="${c.a}"/><circle cx="30" cy="160" r="4" fill="${c.s}"/>`),
  magnet: (c) => V(`<path d="M44 40V108A56 56 0 0 0 156 108V40H120V108A20 20 0 0 1 80 108V40Z" fill="${c.a}"/><rect x="44" y="40" width="36" height="34" fill="#fff"/><rect x="120" y="40" width="36" height="34" fill="#fff"/><path d="M26 30l10 10M60 18v14M140 18v14M174 30l-10 10" stroke="${c.p}" stroke-width="6" stroke-linecap="round"/>`),
  calculator: (c) => V(`<rect x="40" y="20" width="120" height="160" rx="18" fill="${c.p}"/><rect x="54" y="34" width="92" height="38" rx="8" fill="#E8F3F0"/>${[0, 1, 2].flatMap((r) => [0, 1, 2].map((q) => `<rect x="${54 + q * 32}" y="${86 + r * 28}" width="28" height="22" rx="6" fill="${r === 2 && q === 2 ? c.a : "#fff"}" fill-opacity="${r === 2 && q === 2 ? 1 : 0.85}"/>`)).join("")}<text x="136" y="64" font-family="Inter,Arial" font-weight="800" font-size="26" fill="${c.i}" text-anchor="end">3.14</text>`),
  shapes: (c) => V(`<circle cx="60" cy="64" r="38" fill="${c.p}"/><rect x="104" y="30" width="72" height="72" rx="8" fill="${c.a}"/><path d="M100 176L40 96L160 96Z" transform="translate(0 0)" fill="${c.s}"/>`),
  ruler: (c) => V(`<g transform="rotate(-30 100 100)"><rect x="10" y="70" width="180" height="60" rx="10" fill="${c.a}"/>${[...Array(12)].map((_, k) => `<rect x="${24 + k * 14}" y="70" width="4" height="${k % 3 === 0 ? 26 : 16}" fill="${c.i}"/>`).join("")}</g>`),
  chart: (c) => V(`<path d="M28 24V172H178" fill="none" stroke="${c.i}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><rect x="48" y="118" width="26" height="54" rx="5" fill="${c.s}"/><rect x="88" y="84" width="26" height="88" rx="5" fill="${c.p}"/><rect x="128" y="48" width="26" height="124" rx="5" fill="${c.a}"/>`),
  plusminus: (c) => V(`<rect x="14" y="14" width="80" height="80" rx="18" fill="${c.p}"/><path d="M54 34V74M34 54H74" stroke="#fff" stroke-width="12" stroke-linecap="round"/><rect x="106" y="14" width="80" height="80" rx="18" fill="${c.a}"/><path d="M126 54H166" stroke="#fff" stroke-width="12" stroke-linecap="round"/><rect x="14" y="106" width="80" height="80" rx="18" fill="${c.s}"/><path d="M34 126L74 166M74 126L34 166" stroke="#fff" stroke-width="12" stroke-linecap="round"/><rect x="106" y="106" width="80" height="80" rx="18" fill="${c.i}"/><path d="M126 146H166M146 128v0M126 128h40M126 164h40" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`),
  globe: (c) => V(`<circle cx="100" cy="100" r="78" fill="${c.p}"/><path d="M54 70C70 58 88 64 92 78C96 94 78 100 84 118C90 132 70 140 60 130C44 112 40 88 54 70ZM116 50C134 46 156 62 156 82C156 96 140 98 134 110C128 124 112 118 112 104C112 90 100 80 106 66C108 58 112 52 116 50Z" fill="${c.s}"/><ellipse cx="100" cy="100" rx="78" ry="30" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="4"/><ellipse cx="100" cy="100" rx="30" ry="78" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="4"/>`),
  map: (c) => V(`<path d="M24 52L72 36L128 52L176 36V148L128 164L72 148L24 164Z" fill="${c.s}"/><path d="M72 36V148M128 52V164" stroke="#fff" stroke-opacity=".6" stroke-width="5"/><path d="M148 74a14 14 0 1 1 28 0c0 14-14 28-14 28S148 88 148 74Z" fill="${c.a}"/><circle cx="162" cy="74" r="5" fill="#fff"/>`),
  mountain: (c) => V(`<path d="M10 170L72 56L108 112L132 78L190 170Z" fill="${c.p}"/><path d="M72 56L92 92L72 86L58 94Z" fill="#fff"/><path d="M132 78L146 100L132 96L120 104Z" fill="#fff"/><circle cx="156" cy="40" r="16" fill="${c.a}"/>`),
  compass: (c) => V(`<circle cx="100" cy="100" r="80" fill="#fff" stroke="${c.p}" stroke-width="10"/><path d="M100 100L128 56L106 108Z" fill="${c.a}"/><path d="M100 100L72 144L94 92Z" fill="${c.s}"/><circle cx="100" cy="100" r="8" fill="${c.i}"/>${[0, 90, 180, 270].map((d) => `<rect x="97" y="26" width="6" height="14" rx="3" fill="${c.p}" transform="rotate(${d} 100 100)"/>`).join("")}`),
  mosque: (c) => V(`<rect x="20" y="132" width="160" height="40" fill="#F4EBDD"/><path d="M52 132a48 48 0 0 1 96 0Z" fill="${c.s}"/><circle cx="100" cy="64" r="6" fill="${c.a}"/><rect x="26" y="68" width="16" height="106" fill="#E9DFCB"/><path d="M22 68L34 36L46 68Z" fill="${c.s}"/><rect x="158" y="68" width="16" height="106" fill="#E9DFCB"/><path d="M154 68L166 36L178 68Z" fill="${c.s}"/><path d="M92 172v-26a8 8 0 0 1 16 0v26Z" fill="${c.i}"/><path d="M60 148h16v16H60ZM124 148h16v16h-16Z" fill="#AEDDF5"/>`),
  crescent: (c) => V(`<path d="M132 22a84 84 0 1 0 44 128a68 68 0 1 1-44-128Z" fill="${c.a}"/>${star(160, 52, 14, c.a, 4)}`),
  quran: (c) => V(`<path d="M30 56L100 40L170 56V150L100 134L30 150Z" fill="${c.p}"/><path d="M100 40V134" stroke="#fff" stroke-opacity=".6" stroke-width="4"/>${star(65, 96, 22, c.a)}${star(135, 96, 22, c.a)}<path d="M40 166H160" stroke="${c.i}" stroke-width="9" stroke-linecap="round"/><path d="M62 150L50 172M138 150L150 172" stroke="${c.i}" stroke-width="8" stroke-linecap="round"/>`),
  tv: (c) => V(`<rect x="22" y="40" width="156" height="104" rx="14" fill="${c.i}"/><rect x="32" y="50" width="136" height="84" rx="8" fill="${c.s}"/><path d="M32 112C70 90 100 128 168 98V134H32Z" fill="${c.p}"/><circle cx="130" cy="76" r="14" fill="${c.a}"/><rect x="70" y="150" width="60" height="10" rx="5" fill="${c.i}"/><rect x="50" y="160" width="100" height="8" rx="4" fill="${c.p}"/>`),
  laptop: (c) => V(`<rect x="38" y="40" width="124" height="88" rx="10" fill="${c.i}"/><rect x="46" y="48" width="108" height="72" rx="5" fill="${c.s}"/><path d="M60 100l22-26 18 20 14-12 24 18" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 138H186L172 160H28Z" fill="${c.p}"/>`),
  code: (c) => V(`<rect x="16" y="32" width="168" height="136" rx="16" fill="${c.i}"/><circle cx="38" cy="52" r="6" fill="${c.a}"/><circle cx="58" cy="52" r="6" fill="${c.s}"/><circle cx="78" cy="52" r="6" fill="${c.p}"/><path d="M62 98L42 118L62 138M138 98L158 118L138 138M112 90L88 146" fill="none" stroke="${c.a}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`),
  plate: (c) => V(`<circle cx="100" cy="120" r="66" fill="#fff" stroke="${c.a}" stroke-width="8"/><circle cx="100" cy="120" r="50" fill="${c.s}" fill-opacity=".25"/><ellipse cx="82" cy="116" rx="13" ry="20" transform="rotate(-20 82 116)" fill="${c.i}"/><ellipse cx="112" cy="108" rx="13" ry="20" transform="rotate(15 112 108)" fill="${c.p}"/><ellipse cx="102" cy="138" rx="13" ry="20" transform="rotate(80 102 138)" fill="${c.i}"/><circle cx="160" cy="40" r="22" fill="${c.a}"/>`),
  glass: (c) => V(`<path d="M52 36H148L136 170Q134 182 122 182H78Q66 182 64 170Z" fill="#fff" stroke="${c.s}" stroke-width="6"/><path d="M58 84H142L135 168Q134 176 124 176H76Q66 176 65 168Z" fill="${c.s}"/><path d="M70 100q16-12 32 0t32 0" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5"/>`),
  bed: (c) => V(`<rect x="22" y="126" width="156" height="22" rx="8" fill="${c.p}"/><rect x="22" y="96" width="14" height="76" rx="6" fill="${c.i}"/><rect x="164" y="112" width="14" height="60" rx="6" fill="${c.i}"/><rect x="36" y="100" width="128" height="30" rx="14" fill="${c.s}"/><ellipse cx="62" cy="96" rx="26" ry="14" fill="#fff"/><text x="118" y="66" font-family="Cairo" font-weight="900" font-size="30" fill="${c.a}">Z</text><text x="140" y="44" font-family="Cairo" font-weight="900" font-size="22" fill="${c.a}">z</text>`),
  balance: (c) => V(`<path d="M96 40H104V160H96Z" fill="${c.p}"/><rect x="60" y="160" width="80" height="14" rx="7" fill="${c.p}"/><path d="M28 56L172 56" stroke="${c.a}" stroke-width="9" stroke-linecap="round"/><path d="M28 56L8 120H48ZM172 56L152 120H192Z" fill="none" stroke="${c.i}" stroke-width="4"/><path d="M8 120a20 12 0 0 0 40 0ZM152 120a20 12 0 0 0 40 0Z" fill="${c.s}"/><circle cx="100" cy="40" r="10" fill="${c.a}"/>`),
  puzzle: (c) => V(`<path d="M30 54H78a18 18 0 1 1 36 0H162V102a18 18 0 1 0 0 36V170H114a18 18 0 1 0-36 0H30V138a18 18 0 1 0 0-36Z" fill="${c.p}"/><path d="M110 80h40v40h-40z" fill="${c.a}"/>`),
  lock: (c) => V(`<path d="M62 90V64a38 38 0 0 1 76 0V90" fill="none" stroke="${c.i}" stroke-width="14"/><rect x="38" y="88" width="124" height="88" rx="16" fill="${c.p}"/><circle cx="100" cy="128" r="12" fill="${c.a}"/><rect x="95" y="132" width="10" height="26" rx="5" fill="${c.a}"/>`),
  flag: (c) => V(`<rect x="36" y="22" width="10" height="160" rx="5" fill="${c.i}"/><path d="M46 28C80 12 108 44 150 28V100C108 116 80 84 46 100Z" fill="${c.p}"/><path d="M46 28C80 12 108 44 150 28V50C108 66 80 34 46 50Z" fill="${c.a}"/>`),
  arrowup: (c) => V(`<path d="M20 160L70 110L106 140L170 60" fill="none" stroke="${c.p}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M130 52H174V96" fill="none" stroke="${c.a}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`),
  music: (c) => V(`<path d="M72 150V52L158 36V134" fill="none" stroke="${c.i}" stroke-width="10" stroke-linejoin="round"/><ellipse cx="54" cy="150" rx="24" ry="18" fill="${c.p}"/><ellipse cx="140" cy="134" rx="24" ry="18" fill="${c.a}"/><path d="M72 76L158 60" stroke="${c.i}" stroke-width="10"/>`),
  palette: (c) => V(`<path d="M100 22C50 22 18 60 18 104C18 150 56 180 98 176C116 174 112 156 124 150C140 142 182 150 182 108C182 60 148 22 100 22Z" fill="${c.s}"/><circle cx="62" cy="96" r="14" fill="${c.p}"/><circle cx="92" cy="62" r="14" fill="${c.a}"/><circle cx="132" cy="70" r="14" fill="#fff"/><circle cx="148" cy="108" r="14" fill="${c.i}"/>`),
  home: (c) => V(`<rect x="38" y="90" width="124" height="82" rx="8" fill="${c.s}"/><path d="M20 98L100 28L180 98Z" fill="${c.p}"/><rect x="84" y="120" width="32" height="52" rx="6" fill="${c.i}"/><rect x="50" y="108" width="24" height="24" rx="4" fill="#fff"/><rect x="126" y="108" width="24" height="24" rx="4" fill="#fff"/>`),
  health: (c) => V(`<rect x="20" y="46" width="160" height="116" rx="22" fill="${c.p}"/><path d="M100 68V140M64 104H136" stroke="#fff" stroke-width="20" stroke-linecap="round"/><rect x="72" y="26" width="56" height="26" rx="10" fill="${c.i}"/>`),
  tree: (c) => V(`<rect x="90" y="110" width="20" height="66" rx="6" fill="${c.i}"/><circle cx="100" cy="76" r="50" fill="${c.s}"/><circle cx="64" cy="100" r="34" fill="${c.p}"/><circle cx="138" cy="98" r="34" fill="${c.p}"/><circle cx="84" cy="64" r="8" fill="${c.a}"/><circle cx="124" cy="84" r="8" fill="${c.a}"/>`),
  history: (c) => V(`<rect x="30" y="40" width="26" height="130" fill="${c.p}"/><rect x="82" y="40" width="26" height="130" fill="${c.p}"/><rect x="134" y="40" width="26" height="130" fill="${c.p}"/><path d="M16 40L100 8L184 40Z" fill="${c.a}"/><rect x="16" y="170" width="168" height="14" rx="4" fill="${c.i}"/>`),
};

/* Keyword → drawing. Arabic and English hints; first match wins, so order matters. */
const KEYS: Array<[RegExp, string]> = [
  [/صلاة|مسجد|مصلى|أذان|إسلام|mosque|prayer/i, "mosque"],
  [/قرآن|مصحف|آية|سورة|quran|verse/i, "quran"],
  [/رمضان|صيام|صوم|هلال|عيد|crescent|ramadan|fasting/i, "crescent"],
  [/ذرة|ذرات|ذري|atom|كيمياء|chemi/i, "atom"],
  [/تجربة|مختبر|محلول|تفاعل كيميائي|flask|lab|experiment/i, "flask"],
  [/خلية|مجهر|ميكروب|بكتيريا|microscope|cell|bacteria/i, "microscope"],
  [/نبات|ورقة|ورق شجر|تمثيل ضوئي|leaf|plant|photosynth/i, "leaf"],
  [/شجرة|غابة|بيئة|tree|forest|environment/i, "tree"],
  [/شمس|ضوء|طاقة|حرارة|sun|light|energy|heat/i, "sun"],
  [/ماء|مطر|قطرة|دورة الماء|water|rain|drop/i, "drop"],
  [/كوكب|فضاء|فلك|مجرة|نجم|planet|space|galaxy|star system/i, "planet"],
  [/مغناطيس|كهرباء|قوة|magnet|electric|force/i, "magnet"],
  [/آلة حاسبة|حساب|جمع|طرح|ضرب|قسمة|عمليات|calculat|arithmetic|operations/i, "plusminus"],
  [/هندسة|شكل|مثلث|مربع|دائرة|geometry|shape|triangle/i, "shapes"],
  [/قياس|مسطرة|طول|measure|ruler|length/i, "ruler"],
  [/إحصاء|رسم بياني|نسبة|بيانات|chart|graph|data|statistic|percent/i, "chart"],
  [/معادلة|جبر|رياضيات|equation|algebra|math|number/i, "calculator"],
  [/خريطة|موقع|اتجاه|map|location|direction/i, "map"],
  [/كرة أرضية|عالم|قارة|دول|جغرافيا|globe|world|continent|geograph/i, "globe"],
  [/جبل|تضاريس|mountain|terrain/i, "mountain"],
  [/بوصلة|compass/i, "compass"],
  [/حرف|حروف|إملاء|نحو|قراءة|كتابة|لغة|letter|alphabet|grammar|spelling|language/i, "letters"],
  [/قلم|اكتب|كتابة|تدريب|write|pencil|exercise/i, "pencil"],
  [/تاريخ|حضارة|دولة|عصر|history|civiliz|empire/i, "history"],
  [/برمجة|كود|خوارزمية|code|program|algorithm/i, "code"],
  [/حاسوب|تقنية|كمبيوتر|إنترنت|laptop|computer|technolog|internet/i, "laptop"],
  [/موسيقى|نشيد|لحن|music|song/i, "music"],
  [/رسم|فن|ألوان|لوحة|art|paint|color/i, "palette"],
  [/صحة|طب|مرض|دواء|health|medic|disease/i, "health"],
  [/بيت|أسرة|منزل|home|family|house/i, "home"],
  [/تلفاز|شاشة|tv|screen|television/i, "tv"],
  [/نوم|نائم|سرير|sleep|bed/i, "bed"],
  [/طعام|أكل|إفطار|غذاء|food|meal|eat/i, "plate"],
  [/عدل|ميزان|حق|حقوق|balance|justice|rights/i, "balance"],
  [/أمان|حماية|كلمة سر|سرية|lock|secure|privacy|safety/i, "lock"],
  [/علم|راية|هدف الدولة|flag/i, "flag"],
  [/نمو|تطور|تقدم|زيادة|growth|progress|increase/i, "arrowup"],
  [/تعاون|فريق|جماعة|أصدقاء|team|group|friends|people|cooperat/i, "people"],
  [/حوار|نقاش|محادثة|رأي|chat|discuss|dialog|opinion/i, "chat"],
  [/سؤال|لغز|اختبر|question|quiz|riddle/i, "question"],
  [/وقت|ساعة|زمن|مدة|clock|time|duration/i, "clock"],
  [/فوز|بطل|جائزة|مسابقة|trophy|win|champion|award|contest/i, "trophy"],
  [/حب|محبة|رحمة|قلب|love|heart|mercy|kind/i, "heart"],
  [/هدف|غاية|target|goal|aim/i, "target"],
  [/فكرة|اكتشف|تفكير|idea|think|discover|bulb/i, "idea"],
  [/ميدالية|تميز|medal|excel/i, "medal"],
  [/كتاب|درس|قراءة|منهج|book|lesson|read/i, "book"],
  [/خطأ|ممنوع|تجنب|حرام|wrong|avoid|forbidden|never/i, "cross"],
  [/صحيح|نجاح|تم|correct|right|done|success/i, "check"],
  [/ألغاز|تركيب|ترابط|puzzle|connect/i, "puzzle"],
];

const FALLBACK = ["idea", "book", "target", "star", "puzzle", "chat", "trophy", "clock", "people", "medal"];

/** Name of the drawing that best fits the given words (title, hint…). */
const ALIAS: Record<string, string> = {
  lightbulb: "idea", brain: "idea", sparkles: "star", users: "people", info: "question", alert: "cross", zap: "arrowup",
  layers: "puzzle", chart: "chart", globe: "globe", flask: "flask", heart: "heart", check: "check", book: "book",
};

export function pickArtKey(words: Array<string | undefined | null>, index = 0): string {
  /* an exact drawing name (or alias) given as a hint wins over keyword guessing */
  for (const w of words) {
    const k = w?.trim().toLowerCase();
    if (k && (ART[k] || ALIAS[k])) return ART[k] ? k : ALIAS[k];
  }
  const text = words.filter(Boolean).join(" ");
  for (const [re, key] of KEYS) if (re.test(text)) return key;
  /* an exact art name given as a hint */
  for (const w of words) if (w && ART[w.toLowerCase()]) return w.toLowerCase();
  return FALLBACK[index % FALLBACK.length];
}

export function artSvg(key: string, colors: ArtColors): string {
  const draw = ART[key] ?? ART.idea;
  return draw(colors);
}

/** `data:` URL for an image element. */
export function svgUri(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export const ART_KEYS = Object.keys(ART);
