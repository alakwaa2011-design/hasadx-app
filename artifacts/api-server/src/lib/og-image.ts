import { Resvg } from "@resvg/resvg-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(__dirname, "../data/fonts");

/**
 * Split an Arabic title into at most 2 display lines.
 * Rules:
 *  - Max ~22 chars per line (display-width heuristic; Arabic is wider than Latin)
 *  - Never end a line on a lone conjunction (و، أو، في، من، على، إلى، لا)
 *  - If it fits on one line, return one element
 */
function splitArabicTitle(title: string): [string] | [string, string] {
  const CONJUNCTIONS = new Set(["و", "أو", "في", "من", "على", "إلى", "لا", "ثم"]);
  const MAX = 22;

  if (title.length <= MAX) return [title];

  const words = title.split(" ");
  let best = -1;

  for (let i = 1; i < words.length; i++) {
    const left = words.slice(0, i).join(" ");
    if (left.length > MAX) break;
    const lastWord = words[i - 1];
    if (!CONJUNCTIONS.has(lastWord)) best = i;
  }

  if (best < 1) {
    const pivot = words.findIndex((_, idx) => words.slice(0, idx + 1).join(" ").length > MAX);
    best = pivot > 1 ? pivot : Math.ceil(words.length / 2);
  }

  return [
    words.slice(0, best).join(" "),
    words.slice(best).join(" "),
  ];
}

/**
 * Generates a 1200×630 branded PNG card for a solo challenge share link.
 * Uses Noto Naskh Arabic Bold for elegant Arabic typography.
 */
export function generateSoloChallengeOgImage(
  title: string,
  questionCount: number,
): Buffer {
  const escXml = (s: string) =>
    s.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const lines = splitArabicTitle(title.trim());
  const twoLines = lines.length === 2;

  const fontSize = lines[0].length > 18 ? 62 : 70;
  const titleY = twoLines ? 255 : 330;
  const lineGap = fontSize + 14;

  const titleSvg = lines
    .map((line, i) =>
      `<text x="600" y="${titleY + i * lineGap}" font-size="${fontSize}"
         font-weight="bold" fill="#E8B84B"
         text-anchor="middle" font-family="Noto Naskh Arabic"
         direction="rtl" unicode-bidi="embed">${escXml(line)}</text>`,
    )
    .join("\n  ");

  const badgeY = titleY + lines.length * lineGap + 22;
  const countLabel = questionCount > 0 ? `${questionCount} سؤال` : "تحدي حصاد";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1f13"/>
      <stop offset="100%" stop-color="#16362a"/>
    </linearGradient>
    <linearGradient id="goldBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#E8B84B" stop-opacity="0"/>
      <stop offset="30%"  stop-color="#E8B84B"/>
      <stop offset="70%"  stop-color="#E8B84B"/>
      <stop offset="100%" stop-color="#E8B84B" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Subtle vignette border -->
  <rect x="0" y="0" width="1200" height="630"
        fill="none" stroke="#E8B84B" stroke-width="3" opacity="0.18"/>

  <!-- Top and bottom gold bars -->
  <rect x="0" y="0"   width="1200" height="5" fill="url(#goldBar)"/>
  <rect x="0" y="625" width="1200" height="5" fill="url(#goldBar)"/>

  <!-- Soft corner glows -->
  <circle cx="60"  cy="60"  r="120" fill="#E8B84B" opacity="0.045"/>
  <circle cx="1140" cy="570" r="120" fill="#E8B84B" opacity="0.045"/>

  <!-- حصاد X — site brand at top -->
  <text x="600" y="82" font-size="26" fill="#a8d5be"
        text-anchor="middle" font-family="Noto Naskh Arabic"
        direction="rtl" letter-spacing="1" opacity="0.85">حصاد X</text>

  <!-- thin gold rule under brand -->
  <rect x="520" y="100" width="160" height="1.5"
        rx="1" fill="#E8B84B" opacity="0.35"/>

  <!-- Challenge title (1 or 2 lines) -->
  ${titleSvg}

  <!-- Question count pill -->
  <rect x="${600 - 100}" y="${badgeY}" width="200" height="40"
        rx="20" fill="#E8B84B" fill-opacity="0.12"
        stroke="#E8B84B" stroke-width="1.2" stroke-opacity="0.45"/>
  <text x="600" y="${badgeY + 26}" font-size="19" fill="#E8B84B"
        text-anchor="middle" font-family="Noto Naskh Arabic"
        direction="rtl">${escXml(countLabel)}</text>

  <!-- Bottom call-to-action -->
  <text x="600" y="552" font-size="22" fill="#86c4a0"
        text-anchor="middle" font-family="Noto Naskh Arabic"
        direction="rtl" opacity="0.9">هل تقدر تتغلب عليه؟</text>
  <text x="600" y="594" font-size="16" fill="#507a64"
        text-anchor="middle" font-family="Noto Naskh Arabic"
        opacity="0.8">hasadx.com</text>
</svg>`;

  const resvg = new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontDirs: [FONT_DIR],
    },
    fitTo: { mode: "width", value: 1200 },
  });

  return Buffer.from(resvg.render().asPng());
}
