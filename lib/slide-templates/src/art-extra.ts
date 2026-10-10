/* Second batch of the drawing library. Same contract as art.ts: 200×200 viewBox, recoloured by the deck
   identity's four art colours (p primary, s secondary, a accent, i ink). No human figures, so the set is safe
   for religious subjects. `EXTRA_KEYS` is consulted before the original keyword list so a specific topic
   (Kaaba, ablution, battle…) wins over a broad one (Islam, lesson…). */

import type { ArtColors } from "./art";

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

export const EXTRA_ART: Record<string, Draw> = {
  kaaba: (c) => V(`<path d="M40 70L100 52L160 70V160L100 178L40 160Z" fill="${c.i}"/><path d="M100 52V178" stroke="#fff" stroke-opacity=".15" stroke-width="3"/><path d="M40 86L100 70L160 86V100L100 84L40 100Z" fill="${c.a}"/><rect x="70" y="116" width="26" height="46" rx="4" fill="${c.a}" fill-opacity=".85"/><path d="M20 176H180" stroke="${c.p}" stroke-width="10" stroke-linecap="round"/>`),
  prayerrug: (c) => V(`<rect x="46" y="22" width="108" height="156" rx="8" fill="${c.p}"/><rect x="58" y="34" width="84" height="132" rx="6" fill="none" stroke="${c.a}" stroke-width="5"/><path d="M72 160V90a28 28 0 0 1 56 0V160Z" fill="${c.s}"/>${star(100, 120, 14, c.a)}<path d="M46 22V10M62 22V10M78 22V10M94 22V10M110 22V10M126 22V10M142 22V10M46 178v12M62 178v12M78 178v12M94 178v12M110 178v12M126 178v12M142 178v12" stroke="${c.a}" stroke-width="4" stroke-linecap="round"/>`),
  lantern: (c) => V(`<path d="M100 10V32" stroke="${c.i}" stroke-width="8" stroke-linecap="round"/><path d="M72 36H128L138 56H62Z" fill="${c.p}"/><path d="M62 56H138L150 130Q150 150 100 160Q50 150 50 130Z" fill="${c.a}"/><path d="M100 70V150M76 66l-8 78M124 66l8 78" stroke="${c.i}" stroke-opacity=".35" stroke-width="4"/><ellipse cx="100" cy="106" rx="20" ry="30" fill="#fff" fill-opacity=".55"/><rect x="74" y="160" width="52" height="14" rx="6" fill="${c.p}"/>`),
  dates: (c) => V(`<ellipse cx="68" cy="116" rx="26" ry="38" transform="rotate(-18 68 116)" fill="${c.i}"/><ellipse cx="116" cy="108" rx="26" ry="38" transform="rotate(14 116 108)" fill="${c.p}"/><ellipse cx="100" cy="146" rx="26" ry="36" transform="rotate(80 100 146)" fill="${c.i}"/><path d="M76 82q10-10 6-30M120 74q4-18 20-24" stroke="${c.s}" stroke-width="8" stroke-linecap="round" fill="none"/><ellipse cx="62" cy="108" rx="6" ry="14" transform="rotate(-18 62 108)" fill="#fff" fill-opacity=".25"/>`),
  tap: (c) => V(`<path d="M26 56H112Q140 56 140 84V96H112V84Q112 80 108 80H26Z" fill="${c.p}"/><rect x="14" y="44" width="26" height="48" rx="8" fill="${c.i}"/><rect x="108" y="96" width="38" height="14" rx="4" fill="${c.i}"/><path d="M127 118Q112 146 127 156Q142 146 127 118Z" fill="${c.s}"/><path d="M127 168Q118 180 127 186Q136 180 127 168Z" fill="${c.s}" fill-opacity=".7"/><rect x="50" y="34" width="14" height="24" rx="5" fill="${c.a}"/><rect x="36" y="28" width="42" height="12" rx="6" fill="${c.a}"/>`),
  coin: (c) => V(`<circle cx="100" cy="100" r="74" fill="${c.a}"/><circle cx="100" cy="100" r="58" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="6"/><path d="M100 60V140M80 82q0-14 20-14t20 12q0 14-20 18t-20 18q0 14 20 14t20-14" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><circle cx="160" cy="44" r="18" fill="${c.p}"/><circle cx="160" cy="44" r="10" fill="#fff" fill-opacity=".5"/>`),
  moneybag: (c) => V(`<path d="M72 38Q100 22 128 38L116 60H84Z" fill="${c.p}"/><path d="M84 60H116C170 96 168 176 100 176C32 176 30 96 84 60Z" fill="${c.a}"/><path d="M76 66h48" stroke="${c.i}" stroke-width="9" stroke-linecap="round"/><path d="M100 104V150M84 118q0-10 16-10t16 8q0 10-16 12t-16 12q0 10 16 10t16-10" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`),
  handshake: (c) => V(`<path d="M10 90L54 72L96 104L70 138Z" fill="${c.p}"/><path d="M190 90L146 72L104 104L130 138Z" fill="${c.s}"/><path d="M54 72L96 52L136 68L104 104L70 92Z" fill="${c.a}"/><path d="M70 138L88 156Q96 164 104 156L130 138" fill="none" stroke="${c.i}" stroke-width="9" stroke-linecap="round"/><path d="M84 124l16 16M102 112l20 18" stroke="#fff" stroke-opacity=".7" stroke-width="7" stroke-linecap="round"/>`),
  beads: (c) => V(`${[...Array(11)].map((_, k) => {
    const a = (k / 11) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${(100 + Math.cos(a) * 62).toFixed(1)}" cy="${(88 + Math.sin(a) * 62).toFixed(1)}" r="12" fill="${k % 2 ? c.p : c.s}"/>`;
  }).join("")}<path d="M100 150V176" stroke="${c.i}" stroke-width="6"/><circle cx="100" cy="150" r="13" fill="${c.a}"/><path d="M94 176h12l-4 16h-4Z" fill="${c.a}"/>`),
  battle: (c) => V(`<path d="M100 20L160 44V104Q160 150 100 180Q40 150 40 104V44Z" fill="${c.p}"/><path d="M100 20V180" stroke="#fff" stroke-opacity=".35" stroke-width="4"/><path d="M70 62L134 126M134 62L70 126" stroke="${c.a}" stroke-width="12" stroke-linecap="round"/><circle cx="66" cy="132" r="8" fill="${c.i}"/><circle cx="134" cy="132" r="8" fill="${c.i}"/>`),
  fort: (c) => V(`<rect x="28" y="84" width="144" height="92" fill="${c.s}"/><path d="M28 84V56h22v14h20V56h22v14h20V56h22v14h20V56h20v28Z" fill="${c.p}"/><path d="M80 176v-44a20 20 0 0 1 40 0v44Z" fill="${c.i}"/><rect x="42" y="104" width="14" height="22" rx="7" fill="${c.i}"/><rect x="144" y="104" width="14" height="22" rx="7" fill="${c.i}"/><path d="M100 56V22L124 32L100 42" fill="${c.a}"/>`),
  scroll: (c) => V(`<rect x="46" y="36" width="108" height="130" rx="6" fill="#fff"/><path d="M46 36q-24 0-24 22t24 22M154 166q24 0 24-22t-24-22" fill="${c.s}" stroke="${c.p}" stroke-width="6"/><rect x="30" y="30" width="140" height="16" rx="8" fill="${c.p}"/><rect x="30" y="156" width="140" height="16" rx="8" fill="${c.p}"/><path d="M66 70H134M66 90H134M66 110H120M66 130H100" stroke="${c.i}" stroke-opacity=".6" stroke-width="7" stroke-linecap="round"/>`),
  key: (c) => V(`<circle cx="62" cy="100" r="40" fill="${c.a}"/><circle cx="62" cy="100" r="16" fill="#fff"/><path d="M96 100H182M146 100v26M168 100v18" stroke="${c.p}" stroke-width="16" stroke-linecap="round"/>`),
  sprout: (c) => V(`<path d="M100 176V98" stroke="${c.i}" stroke-width="9" stroke-linecap="round"/><path d="M100 110C60 112 40 84 42 52C80 50 102 76 100 110Z" fill="${c.s}"/><path d="M100 96C132 98 156 76 158 40C122 38 98 62 100 96Z" fill="${c.p}"/><path d="M60 176H140Q150 176 146 160H54Q50 176 60 176Z" fill="${c.a}"/>`),
  flower: (c) => V(`${[0, 60, 120, 180, 240, 300].map((d) => `<ellipse cx="100" cy="52" rx="20" ry="32" fill="${d % 120 ? c.s : c.p}" transform="rotate(${d} 100 84)"/>`).join("")}<circle cx="100" cy="84" r="18" fill="${c.a}"/><path d="M100 104V182" stroke="${c.i}" stroke-width="8" stroke-linecap="round"/><path d="M100 150C70 150 58 130 60 112C86 112 100 130 100 150Z" fill="${c.s}"/>`),
  butterfly: (c) => V(`<path d="M100 100C70 40 18 40 22 90C24 122 70 120 100 100Z" fill="${c.p}"/><path d="M100 100C130 40 182 40 178 90C176 122 130 120 100 100Z" fill="${c.s}"/><path d="M100 104C76 120 50 148 70 166C90 178 100 130 100 104Z" fill="${c.a}"/><path d="M100 104C124 120 150 148 130 166C110 178 100 130 100 104Z" fill="${c.p}"/><rect x="95" y="62" width="10" height="96" rx="5" fill="${c.i}"/><path d="M98 62Q88 38 70 30M102 62Q112 38 130 30" stroke="${c.i}" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  bird: (c) => V(`<path d="M20 112C30 70 70 52 110 62C128 36 168 40 172 70L190 78L170 90C168 130 130 162 84 156C52 152 28 136 20 112Z" fill="${c.p}"/><path d="M60 118C80 138 112 138 134 112C120 128 84 132 60 118Z" fill="${c.s}"/><circle cx="150" cy="68" r="6" fill="#fff"/><circle cx="152" cy="68" r="3" fill="${c.i}"/><path d="M190 78L176 70V86Z" fill="${c.a}"/><path d="M92 156L84 184M108 154L104 184" stroke="${c.a}" stroke-width="6" stroke-linecap="round"/>`),
  fish: (c) => V(`<path d="M20 100C50 44 112 44 146 100C112 156 50 156 20 100Z" fill="${c.p}"/><path d="M142 100L182 66V134Z" fill="${c.a}"/><circle cx="56" cy="92" r="8" fill="#fff"/><circle cx="54" cy="92" r="4" fill="${c.i}"/><path d="M88 72q-12 28 0 56M112 76q-10 24 0 48" stroke="#fff" stroke-opacity=".5" stroke-width="6" fill="none" stroke-linecap="round"/>`),
  bee: (c) => V(`<ellipse cx="82" cy="60" rx="24" ry="38" transform="rotate(-24 82 60)" fill="${c.s}" fill-opacity=".7"/><ellipse cx="124" cy="58" rx="24" ry="38" transform="rotate(22 124 58)" fill="${c.s}" fill-opacity=".7"/><ellipse cx="100" cy="116" rx="52" ry="42" fill="${c.a}"/><path d="M80 78V154M104 74V158M128 82V150" stroke="${c.i}" stroke-width="12"/><circle cx="64" cy="112" r="6" fill="#fff"/><path d="M152 116L176 120" stroke="${c.i}" stroke-width="6" stroke-linecap="round"/>`),
  apple: (c) => V(`<path d="M100 60C70 38 28 58 32 106C36 148 70 184 100 168C130 184 164 148 168 106C172 58 130 38 100 60Z" fill="${c.a}"/><path d="M100 60C100 44 108 30 124 22" stroke="${c.i}" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M110 40C128 20 156 28 160 40C140 54 120 52 110 40Z" fill="${c.s}"/><path d="M58 94q-6 22 6 40" stroke="#fff" stroke-opacity=".5" stroke-width="8" stroke-linecap="round" fill="none"/>`),
  backpack: (c) => V(`<rect x="46" y="44" width="108" height="130" rx="30" fill="${c.p}"/><path d="M76 44V30Q76 16 100 16T124 30V44" fill="none" stroke="${c.i}" stroke-width="9"/><rect x="64" y="104" width="72" height="50" rx="14" fill="${c.s}"/><rect x="92" y="116" width="16" height="12" rx="4" fill="${c.a}"/><path d="M60 82H140" stroke="${c.a}" stroke-width="8" stroke-linecap="round"/>`),
  school: (c) => V(`<rect x="24" y="84" width="152" height="90" fill="${c.s}"/><path d="M14 90L100 30L186 90Z" fill="${c.p}"/><rect x="84" y="126" width="32" height="48" rx="4" fill="${c.i}"/><rect x="40" y="104" width="30" height="26" rx="4" fill="#fff"/><rect x="130" y="104" width="30" height="26" rx="4" fill="#fff"/><circle cx="100" cy="68" r="9" fill="#fff"/><path d="M100 30V10l22 8-22 8" fill="${c.a}"/>`),
  blackboard: (c) => V(`<rect x="16" y="28" width="168" height="112" rx="10" fill="${c.i}"/><rect x="24" y="36" width="152" height="96" rx="6" fill="${c.p}"/><path d="M44 70H120M44 94H150M44 114H96" stroke="#fff" stroke-opacity=".85" stroke-width="7" stroke-linecap="round"/><rect x="16" y="140" width="168" height="12" rx="6" fill="${c.a}"/><rect x="150" y="120" width="20" height="8" rx="3" fill="#fff"/>`),
  microphone: (c) => V(`<rect x="70" y="18" width="60" height="92" rx="30" fill="${c.p}"/><path d="M82 46h36M82 66h36M82 86h36" stroke="#fff" stroke-opacity=".6" stroke-width="5"/><path d="M46 90a54 54 0 0 0 108 0" fill="none" stroke="${c.i}" stroke-width="10" stroke-linecap="round"/><path d="M100 144V172M70 176H130" stroke="${c.i}" stroke-width="10" stroke-linecap="round"/>`),
  camera: (c) => V(`<path d="M24 62H66L78 42H122L134 62H176Q186 62 186 74V150Q186 160 176 160H24Q14 160 14 150V74Q14 62 24 62Z" fill="${c.p}"/><circle cx="100" cy="108" r="40" fill="${c.i}"/><circle cx="100" cy="108" r="28" fill="${c.s}"/><circle cx="90" cy="98" r="8" fill="#fff" fill-opacity=".6"/><circle cx="160" cy="82" r="7" fill="${c.a}"/>`),
  phone: (c) => V(`<rect x="56" y="14" width="88" height="172" rx="18" fill="${c.i}"/><rect x="64" y="32" width="72" height="130" rx="6" fill="${c.s}"/><circle cx="100" cy="174" r="6" fill="${c.p}"/><rect x="82" y="20" width="36" height="5" rx="2.5" fill="${c.p}"/><path d="M76 124l16-20 14 12 20-30" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  bolt: (c) => V(`<path d="M116 14L46 112H92L76 186L156 76H108Z" fill="${c.a}"/><path d="M116 14L46 112H70L116 44Z" fill="#fff" fill-opacity=".35"/><circle cx="40" cy="50" r="7" fill="${c.p}"/><circle cx="164" cy="140" r="7" fill="${c.s}"/>`),
  gear: (c) => V(`${[...Array(8)].map((_, k) => `<rect x="86" y="10" width="28" height="36" rx="6" fill="${c.p}" transform="rotate(${k * 45} 100 100)"/>`).join("")}<circle cx="100" cy="100" r="62" fill="${c.p}"/><circle cx="100" cy="100" r="30" fill="#fff"/><circle cx="100" cy="100" r="12" fill="${c.a}"/>`),
  rocket: (c) => V(`<path d="M100 14C140 48 148 108 132 148H68C52 108 60 48 100 14Z" fill="${c.p}"/><circle cx="100" cy="84" r="20" fill="#fff"/><circle cx="100" cy="84" r="12" fill="${c.s}"/><path d="M68 112L36 140L48 164L68 148ZM132 112L164 140L152 164L132 148Z" fill="${c.a}"/><path d="M84 148H116L100 184Z" fill="${c.a}"/>`),
  moon: (c) => V(`<path d="M128 22A84 84 0 1 0 178 130A68 68 0 0 1 128 22Z" fill="${c.a}"/><circle cx="84" cy="96" r="10" fill="#000" fill-opacity=".08"/><circle cx="110" cy="130" r="14" fill="#000" fill-opacity=".08"/>${star(160, 44, 10, c.p, 4)}${star(42, 52, 7, c.s, 4)}`),
  cloud: (c) => V(`<path d="M52 148Q18 148 22 114Q26 84 58 86Q64 50 100 50Q136 50 144 84Q182 82 182 118Q182 148 148 148Z" fill="${c.s}"/><path d="M52 148Q18 148 22 114Q26 84 58 86" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5"/><path d="M70 164v14M100 164v18M130 164v14" stroke="${c.p}" stroke-width="7" stroke-linecap="round"/>`),
  rainbow: (c) => V(`<path d="M16 150A84 84 0 0 1 184 150" fill="none" stroke="${c.a}" stroke-width="18"/><path d="M36 150A64 64 0 0 1 164 150" fill="none" stroke="${c.s}" stroke-width="18"/><path d="M56 150A44 44 0 0 1 144 150" fill="none" stroke="${c.p}" stroke-width="18"/><ellipse cx="30" cy="158" rx="28" ry="16" fill="#fff"/><ellipse cx="170" cy="158" rx="28" ry="16" fill="#fff"/>`),
  flame: (c) => V(`<path d="M100 16C112 54 156 78 156 124C156 160 130 184 100 184C70 184 44 160 44 124C44 94 62 80 70 56C82 70 86 80 90 86C94 62 96 40 100 16Z" fill="${c.a}"/><path d="M100 108C108 128 130 138 130 156C130 172 118 180 100 180C82 180 70 172 70 156C70 140 90 130 100 108Z" fill="#fff" fill-opacity=".6"/>`),
  volcano: (c) => V(`<path d="M10 176L74 74H126L190 176Z" fill="${c.i}"/><path d="M74 74L86 64H114L126 74L100 90Z" fill="${c.a}"/><path d="M92 64C84 36 112 28 104 6M110 62C124 40 104 26 120 12" stroke="${c.s}" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M100 90V176M80 120l-14 56" stroke="${c.a}" stroke-width="6" stroke-linecap="round"/>`),
  dna: (c) => V(`<path d="M60 14C60 60 140 60 140 106S60 152 60 190M140 14C140 60 60 60 60 106S140 152 140 190" fill="none" stroke="${c.p}" stroke-width="10" stroke-linecap="round"/><path d="M72 36H128M66 62H134M72 84H128M72 128H128M66 150H134M72 172H128" stroke="${c.a}" stroke-width="7" stroke-linecap="round"/>`),
  pulse: (c) => V(`<path d="M100 172C26 124 18 66 58 52C80 44 96 58 100 70C104 58 120 44 142 52C182 66 174 124 100 172Z" fill="${c.p}"/><path d="M26 104H70L84 76L106 136L120 104H174" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`),
  eye: (c) => V(`<path d="M10 100Q100 20 190 100Q100 180 10 100Z" fill="#fff" stroke="${c.p}" stroke-width="9"/><circle cx="100" cy="100" r="38" fill="${c.s}"/><circle cx="100" cy="100" r="18" fill="${c.i}"/><circle cx="90" cy="90" r="7" fill="#fff"/>`),
  ear: (c) => V(`<path d="M64 150C40 130 30 90 48 56C66 22 120 18 144 52C164 80 148 110 126 120C114 126 112 140 108 150C100 174 76 174 64 150Z" fill="${c.p}"/><path d="M78 62C100 44 130 62 120 88C112 106 96 100 96 118" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M164 60q16 12 0 30M178 48q26 24 0 54" stroke="${c.a}" stroke-width="7" stroke-linecap="round" fill="none"/>`),
  handstop: (c) => V(`<path d="M70 176Q40 150 40 118V74a10 10 0 0 1 20 0V108H64V42a10 10 0 0 1 20 0V100H88V32a10 10 0 0 1 20 0V100H112V44a10 10 0 0 1 20 0V108H136V76a10 10 0 0 1 20 0V132Q156 168 124 180Z" fill="${c.a}"/>`),
  soap: (c) => V(`<rect x="38" y="104" width="96" height="62" rx="18" fill="${c.p}"/><rect x="48" y="112" width="76" height="14" rx="7" fill="#fff" fill-opacity=".5"/><circle cx="64" cy="70" r="26" fill="${c.s}" fill-opacity=".55" stroke="#fff" stroke-width="4"/><circle cx="116" cy="50" r="18" fill="${c.s}" fill-opacity=".55" stroke="#fff" stroke-width="4"/><circle cx="154" cy="92" r="14" fill="${c.s}" fill-opacity=".55" stroke="#fff" stroke-width="4"/><circle cx="150" cy="30" r="9" fill="${c.s}" fill-opacity=".55" stroke="#fff" stroke-width="3"/>`),
  traffic: (c) => V(`<rect x="62" y="12" width="76" height="152" rx="22" fill="${c.i}"/><circle cx="100" cy="46" r="20" fill="#E53935"/><circle cx="100" cy="88" r="20" fill="${c.a}"/><circle cx="100" cy="130" r="20" fill="#43A047"/><rect x="92" y="164" width="16" height="28" rx="5" fill="${c.p}"/>`),
  car: (c) => V(`<path d="M16 130V108Q16 96 30 92L56 56Q62 48 74 48H128Q140 48 148 58L172 92Q186 96 186 108V130Z" fill="${c.p}"/><path d="M68 58H100V92H52ZM110 58H128L152 92H110Z" fill="#fff" fill-opacity=".85"/><circle cx="54" cy="134" r="22" fill="${c.i}"/><circle cx="54" cy="134" r="9" fill="#fff"/><circle cx="148" cy="134" r="22" fill="${c.i}"/><circle cx="148" cy="134" r="9" fill="#fff"/><rect x="170" y="104" width="14" height="10" rx="4" fill="${c.a}"/>`),
  plane: (c) => V(`<path d="M12 112L188 36L128 168L106 118Z" fill="${c.p}"/><path d="M106 118L188 36L82 126Z" fill="${c.s}"/><path d="M82 126L90 168L106 118Z" fill="${c.a}"/>`),
  boat: (c) => V(`<path d="M20 126H180L158 168Q154 176 144 176H56Q46 176 42 168Z" fill="${c.p}"/><path d="M100 22V120" stroke="${c.i}" stroke-width="8" stroke-linecap="round"/><path d="M104 28L160 108H104Z" fill="${c.s}"/><path d="M96 46L52 108H96Z" fill="${c.a}"/><path d="M10 186q22-14 44 0t44 0 44 0 44 0" fill="none" stroke="${c.s}" stroke-width="7" stroke-linecap="round"/>`),
  shop: (c) => V(`<rect x="28" y="80" width="144" height="94" fill="${c.s}"/><path d="M20 80L34 34H166L180 80Z" fill="${c.p}"/>${[0, 1, 2, 3].map((k) => `<path d="M${20 + k * 40} 80q20 28 40 0Z" fill="${k % 2 ? c.a : "#fff"}"/>`).join("")}<rect x="82" y="118" width="36" height="56" rx="4" fill="${c.i}"/><rect x="40" y="104" width="30" height="34" rx="4" fill="#fff" fill-opacity=".85"/><rect x="130" y="104" width="30" height="34" rx="4" fill="#fff" fill-opacity=".85"/>`),
  hourglass: (c) => V(`<rect x="40" y="16" width="120" height="14" rx="7" fill="${c.i}"/><rect x="40" y="170" width="120" height="14" rx="7" fill="${c.i}"/><path d="M52 30H148Q148 80 108 100Q148 120 148 170H52Q52 120 92 100Q52 80 52 30Z" fill="#fff" stroke="${c.p}" stroke-width="8" stroke-linejoin="round"/><path d="M64 38H136Q136 70 100 90Q64 70 64 38Z" fill="${c.a}"/><path d="M76 168Q100 130 124 168Z" fill="${c.a}"/>`),
  calendar: (c) => V(`<rect x="24" y="36" width="152" height="140" rx="16" fill="#fff" stroke="${c.p}" stroke-width="8"/><path d="M24 52Q24 36 40 36H160Q176 36 176 52V76H24Z" fill="${c.p}"/><rect x="58" y="20" width="12" height="32" rx="6" fill="${c.i}"/><rect x="130" y="20" width="12" height="32" rx="6" fill="${c.i}"/>${[0, 1, 2].flatMap((r) => [0, 1, 2, 3].map((q) => `<rect x="${42 + q * 34}" y="${92 + r * 26}" width="22" height="16" rx="4" fill="${r === 1 && q === 2 ? c.a : c.s}" fill-opacity="${r === 1 && q === 2 ? 1 : 0.55}"/>`)).join("")}`),
  mail: (c) => V(`<rect x="18" y="44" width="164" height="116" rx="16" fill="${c.p}"/><path d="M18 56L100 114L182 56" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/><circle cx="170" cy="48" r="20" fill="${c.a}"/><circle cx="170" cy="48" r="8" fill="#fff"/>`),
  bell: (c) => V(`<path d="M100 20C58 20 50 62 50 100C50 128 36 140 28 150H172C164 140 150 128 150 100C150 62 142 20 100 20Z" fill="${c.a}"/><circle cx="100" cy="20" r="9" fill="${c.i}"/><path d="M80 158Q80 182 100 182T120 158Z" fill="${c.p}"/><path d="M74 62q-8 20-6 40" stroke="#fff" stroke-opacity=".6" stroke-width="7" stroke-linecap="round" fill="none"/>`),
  sound: (c) => V(`<path d="M16 78H50L98 36V164L50 122H16Z" fill="${c.p}"/><path d="M120 76q16 24 0 48M142 56q30 44 0 88M164 38q42 62 0 124" fill="none" stroke="${c.a}" stroke-width="9" stroke-linecap="round"/>`),
  pie: (c) => V(`<circle cx="100" cy="100" r="74" fill="${c.s}"/><path d="M100 100V26A74 74 0 0 1 174 100Z" fill="${c.a}"/><path d="M100 100L174 100A74 74 0 0 1 100 174Z" fill="${c.p}"/><circle cx="100" cy="100" r="74" fill="none" stroke="#fff" stroke-width="5"/>`),
  cube: (c) => V(`<path d="M100 18L172 56V140L100 182L28 140V56Z" fill="${c.p}"/><path d="M100 18L172 56L100 94L28 56Z" fill="${c.s}"/><path d="M100 94V182L28 140V56Z" fill="${c.i}" fill-opacity=".35"/><path d="M100 94L172 56" stroke="#fff" stroke-opacity=".4" stroke-width="3"/>`),
  brain: (c) => V(`<path d="M100 28C80 14 46 22 40 52C20 58 14 88 30 100C20 124 36 150 58 150C64 172 94 176 100 160C106 176 136 172 142 150C164 150 180 124 170 100C186 88 180 58 160 52C154 22 120 14 100 28Z" fill="${c.p}"/><path d="M100 36V158M64 66Q78 74 78 92M136 66Q122 74 122 92M52 112Q70 112 78 126M148 112Q130 112 122 126" stroke="#fff" stroke-opacity=".6" stroke-width="6" stroke-linecap="round" fill="none"/>`),
  tooth: (c) => V(`<path d="M52 36C74 22 90 38 100 38C110 38 126 22 148 36C170 52 164 92 154 112C148 134 148 176 128 176C112 176 116 140 100 140C84 140 88 176 72 176C52 176 52 134 46 112C36 92 30 52 52 36Z" fill="#fff" stroke="${c.p}" stroke-width="8" stroke-linejoin="round"/><path d="M66 56q-6 14-2 30" stroke="${c.s}" stroke-width="7" stroke-linecap="round" fill="none"/>`),
  bandage: (c) => V(`<g transform="rotate(-35 100 100)"><rect x="14" y="68" width="172" height="64" rx="30" fill="${c.a}"/><rect x="68" y="68" width="64" height="64" fill="#fff" fill-opacity=".8"/><circle cx="86" cy="84" r="4" fill="${c.i}" fill-opacity=".5"/><circle cx="114" cy="84" r="4" fill="${c.i}" fill-opacity=".5"/><circle cx="86" cy="116" r="4" fill="${c.i}" fill-opacity=".5"/><circle cx="114" cy="116" r="4" fill="${c.i}" fill-opacity=".5"/></g>`),
  bubble: (c) => V(`<path d="M30 30H170Q184 30 184 44V116Q184 130 170 130H110L72 168V130H30Q16 130 16 116V44Q16 30 30 30Z" fill="${c.s}"/><path d="M44 66H156M44 92H120" stroke="#fff" stroke-width="9" stroke-linecap="round"/><circle cx="150" cy="146" r="6" fill="${c.a}"/><circle cx="170" cy="146" r="6" fill="${c.p}"/>`),
  award: (c) => V(`<path d="M60 14H140V74Q140 112 100 120Q60 112 60 74Z" fill="${c.a}"/><path d="M60 30H34Q30 60 56 76M140 30H166Q170 60 144 76" fill="none" stroke="${c.a}" stroke-width="8"/><rect x="88" y="120" width="24" height="26" fill="${c.p}"/><rect x="62" y="146" width="76" height="20" rx="8" fill="${c.p}"/><rect x="72" y="170" width="56" height="12" rx="6" fill="${c.i}"/>${star(100, 62, 20, "#fff", 5)}`),
  paperplane: (c) => V(`<path d="M12 98L188 22L146 178L104 128Z" fill="${c.p}"/><path d="M104 128L188 22L72 112Z" fill="${c.s}"/><path d="M104 128L96 170L124 148Z" fill="${c.a}"/><path d="M20 160q20-6 30 8M34 186q14-4 20 6" stroke="${c.s}" stroke-width="5" stroke-linecap="round" fill="none"/>`),
  pizza: (c) => V(`<path d="M100 184L22 54Q100 8 178 54Z" fill="${c.a}"/><path d="M22 54Q100 8 178 54L170 68Q100 28 30 68Z" fill="${c.p}"/><circle cx="82" cy="78" r="9" fill="${c.i}"/><circle cx="118" cy="86" r="9" fill="${c.i}"/><circle cx="100" cy="122" r="9" fill="${c.i}"/>`),
};

/* Arabic has no usable \b in JS regexes, so whole-word matches use explicit (^|\s) … (\s|$) anchors, and words
   that are substrings of common words (حج in حجم, تمر in تمرين, بيع in ربيع…) are anchored or avoided. */
const W = (w: string) => `(?:^|\\s)(?:ال)?(?:${w})(?:\\s|$)`;

export const EXTRA_KEYS: Array<[RegExp, string]> = [
  [new RegExp(`${W("حج|عمرة|كعبة")}|الكعبة|مناسك|طواف|الحرم المكي|kaaba|hajj|umrah|pilgrim`, "i"), "kaaba"],
  [/سجادة|سجود|ركوع|خشوع|الصلاة|صلاة|prayer mat|prayer rug|salah|salat/i, "prayerrug"],
  [/وضوء|طهارة|توضأ|غسل|wudu|ablution|purif/i, "tap"],
  [/تسبيح|أذكار|استغفار|سبحة|tasbih|dhikr/i, "beads"],
  [/زكاة|صدقة|إنفاق|charity|zakat|alms|donat/i, "moneybag"],
  [/مؤاخاة|إخاء|تآخي|أخوة|مصافحة|handshake|brotherhood|alliance/i, "handshake"],
  [/غزوة|معركة|جهاد|حرب|battle|conquest|military/i, "battle"],
  [/قلعة|حصن|حصار|خندق|castle|fortress|siege/i, "fort"],
  [/معاهدة|وثيقة|عهد|صلح|كتاب النبي|treaty|scroll|contract/i, "scroll"],
  [/مفتاح|مفاتيح|key\b/i, "key"],
  [new RegExp(`${W("تمر")}|تمور|نخل|نخيل|palm|dates\\b`, "i"), "dates"],
  [/فانوس|قنديل|lantern/i, "lantern"],
  [/قمر|الليل|ليلة القدر|moon|lunar/i, "moon"],
  [/نبتة|بذرة|إنبات|زراعة|sprout|germinat|seedling/i, "sprout"],
  [/زهرة|زهور|الورود|وردة|تلقيح|flower|bloom|pollinat/i, "flower"],
  [/فراشة|دورة حياة|butterfly|metamorph|life cycle/i, "butterfly"],
  [/طائر|طيور|عصفور|ريش|bird|feather/i, "bird"],
  [/سمكة|أسماك|بحر|محيط|حوت|fish|\bsea\b|ocean|marine/i, "fish"],
  [/نحلة|نحل|عسل|حشرة|\bbee\b|honey|insect/i, "bee"],
  [/تفاح|فاكهة|فواكه|فيتامين|apple|vitamin/i, "apple"],
  [/حقيبة|school bag|backpack/i, "backpack"],
  [/مدرسة|فصل دراسي|classroom|school/i, "school"],
  [/سبورة|blackboard|whiteboard/i, "blackboard"],
  [/ميكروفون|خطابة|خطبة|إلقاء|إذاعة|microphone|speech|broadcast|podcast/i, "microphone"],
  [/كاميرا|تصوير|camera|photograph/i, "camera"],
  [/هاتف|جوال|phone|mobile/i, "phone"],
  [/كهرباء|صاعقة|برق|تيار|lightning|electric/i, "bolt"],
  [/الترس|ترس|محرك|ميكانيك|الآلات البسيطة|gear|engine|mechanic/i, "gear"],
  [/صاروخ|مركبة فضائية|rocket|spacecraft/i, "rocket"],
  [/سحاب|غيم|طقس|مناخ|cloud|weather|climate|atmosphere/i, "cloud"],
  [/قوس قزح|ألوان الطيف|rainbow|spectrum/i, "rainbow"],
  [new RegExp(`${W("نار")}|حريق|احتراق|اشتعال|\\bfire\\b|flame|combustion`, "i"), "flame"],
  [/بركان|زلزال|صفائح|volcano|earthquake|tectonic/i, "volcano"],
  [/وراثة|جينات|حمض نووي|كروموسوم|dna|\bgene|chromosome|heredity/i, "dna"],
  [/نبض|دورة دموية|heartbeat|pulse|circulat/i, "pulse"],
  [/بصر|رؤية|حاسة البصر|\beye\b|vision|sight/i, "eye"],
  [/الصوت|حاسة السمع|sound|hearing/i, "sound"],
  [/نظافة|تعقيم|صابون|soap|hygiene|sanit/i, "soap"],
  [/احذر|تحذير|خطر|danger|warning|caution/i, "handstop"],
  [/إشارة المرور|إشارة مرور|سلامة الطريق|traffic|road safety/i, "traffic"],
  [/سيارة|مواصلات|\bcar\b|vehicle/i, "car"],
  [/طائرة|طيران|سفر|\bplane\b|flight|aviation/i, "plane"],
  [/سفينة|قارب|إبحار|ملاحة|\bboat\b|\bship\b|sail/i, "boat"],
  [/سوق|تجارة|متجر|البيع|الشراء|market|trade|shop|commerce/i, "shop"],
  [/ساعة رملية|صبر|hourglass|patience/i, "hourglass"],
  [/تقويم|موعد|جدول زمني|calendar|schedule/i, "calendar"],
  [/بريد|مراسلة|إيميل|\bmail\b|email/i, "mail"],
  [/جرس|إشعار|\bbell\b|notification/i, "bell"],
  [/الكسور|كسور|الكسر|fraction|pie chart/i, "pie"],
  [/مجسم|مكعب|حجم|ثلاثي الأبعاد|\bcube\b|volume|3d/i, "cube"],
  [/دماغ|العقل|الذاكرة|brain|memory/i, "brain"],
  [/أسنان|الأسنان|tooth|teeth|dental/i, "tooth"],
  [/جرح|إسعاف|علاج|إصابة|first aid|bandage|injury|wound/i, "bandage"],
  [/تكريم|إنجاز|certificate|achievement|prize/i, "award"],
  [/إرسال|paper plane|\bsend\b/i, "paperplane"],
  [/بيتزا|وجبة|مطعم|طبخ|pizza|restaurant|cook|recipe/i, "pizza"],
];
