import { Resvg } from "@resvg/resvg-js";

/**
 * Generates a 1200×630 branded PNG card for a solo challenge share link.
 * Dark emerald background, gold accents, Arabic RTL title — ready for OG.
 */
export function generateSoloChallengeOgImage(
  title: string,
  questionCount: number,
): Buffer {
  const escXml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const safeTitle = escXml(title);
  const safeCount = questionCount > 0 ? `${questionCount} سؤال` : "تحدي حصاد";

  // Wrap long titles — split into up to 2 lines of ≤28 chars each.
  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > 28 && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
    if (lines.length === 2) { current = ""; break; }
  }
  if (current) lines.push(current.trim());
  const [line1, line2] = [escXml(lines[0] ?? safeTitle), escXml(lines[1] ?? "")];

  const titleY = line2 ? 270 : 310;
  const titleBlock = line2
    ? `<text x="600" y="${titleY}" font-size="64" font-weight="bold" fill="#E8B84B"
         text-anchor="middle" font-family="serif" direction="rtl">${line1}</text>
       <text x="600" y="${titleY + 80}" font-size="64" font-weight="bold" fill="#E8B84B"
         text-anchor="middle" font-family="serif" direction="rtl">${line2}</text>`
    : `<text x="600" y="${titleY}" font-size="68" font-weight="bold" fill="#E8B84B"
         text-anchor="middle" font-family="serif" direction="rtl">${line1}</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b2416"/>
      <stop offset="100%" stop-color="#1a3a2a"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#E8B84B" stop-opacity="0"/>
      <stop offset="50%" stop-color="#E8B84B"/>
      <stop offset="100%" stop-color="#E8B84B" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Subtle grid pattern -->
  <rect width="1200" height="630" fill="none" stroke="#1e4d35" stroke-width="1" opacity="0.4"/>

  <!-- Corner glows -->
  <ellipse cx="0" cy="0" rx="300" ry="300" fill="#E8B84B" opacity="0.04"/>
  <ellipse cx="1200" cy="630" rx="300" ry="300" fill="#E8B84B" opacity="0.04"/>

  <!-- Top gold bar -->
  <rect x="0" y="0" width="1200" height="4" fill="url(#gold)"/>

  <!-- حصاد logo area -->
  <text x="600" y="90" font-size="28" fill="#86c4a0" text-anchor="middle"
        font-family="serif" letter-spacing="4" opacity="0.9">حصاد X</text>
  <text x="600" y="118" font-size="14" fill="#6aaa88" text-anchor="middle"
        font-family="serif" opacity="0.7">تجربة تفاعلية ذكية</text>

  <!-- Diamond separator -->
  <line x1="400" y1="145" x2="570" y2="145" stroke="#E8B84B" stroke-width="1" opacity="0.4"/>
  <polygon points="600,138 608,145 600,152 592,145" fill="#E8B84B" opacity="0.8"/>
  <line x1="630" y1="145" x2="800" y2="145" stroke="#E8B84B" stroke-width="1" opacity="0.4"/>

  <!-- Challenge title -->
  ${titleBlock}

  <!-- Divider line under title -->
  <rect x="400" y="${titleY + (line2 ? 110 : 50)}" width="400" height="2"
        fill="url(#gold)" rx="1" opacity="0.6"/>

  <!-- Question count badge -->
  <rect x="490" y="${titleY + (line2 ? 135 : 75)}" width="220" height="44"
        rx="22" fill="#E8B84B" fill-opacity="0.12"
        stroke="#E8B84B" stroke-width="1.5" stroke-opacity="0.5"/>
  <text x="600" y="${titleY + (line2 ? 163 : 103)}" font-size="20" fill="#E8B84B"
        text-anchor="middle" font-family="serif" direction="rtl">${escXml(safeCount)}</text>

  <!-- Bottom CTA -->
  <text x="600" y="560" font-size="22" fill="#86c4a0" text-anchor="middle"
        font-family="serif" direction="rtl" opacity="0.9">🎯 هل تقدر تتغلب عليه؟</text>
  <text x="600" y="596" font-size="15" fill="#4a8c6a" text-anchor="middle"
        font-family="serif" opacity="0.7">hasadx.com</text>

  <!-- Bottom gold bar -->
  <rect x="0" y="626" width="1200" height="4" fill="url(#gold)"/>
</svg>`;

  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: true },
    fitTo: { mode: "width", value: 1200 },
  });

  return Buffer.from(resvg.render().asPng());
}
