/**
 * generate-image-sitemap.mjs
 *
 * Reads arena-covers/ and regenerates public/image-sitemap.xml automatically.
 * Only .webp files are indexed (png duplicates and svg logos are skipped).
 * Run via: node scripts/generate-image-sitemap.mjs
 * Wired into the build step in package.json.
 */

import { readdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const COVERS_DIR = resolve(ROOT, "public/arena-covers");
const OUT_FILE = resolve(ROOT, "public/image-sitemap.xml");
const BASE_URL = "https://hasadx.com";

// ---------------------------------------------------------------------------
// Title + caption map keyed by filename stem (no extension).
// Titles are the Arabic display names used in search results.
// Captions are optional; only the Islamic section carries them.
// ---------------------------------------------------------------------------

/** @type {Record<string, { title: string; caption?: string }>} */
const COVER_META = {
  // ── General arena covers → /games ────────────────────────────────────────
  "arab-capitals":            { title: "عواصم الدول العربية — أرينا حصاد" },
  "arabic-food":              { title: "الأطعمة العربية — أرينا حصاد" },
  "arabic-proverbs":          { title: "الأمثال العربية — أرينا حصاد" },
  "asia-capitals":            { title: "عواصم آسيا — أرينا حصاد" },
  "astronauts":               { title: "رواد الفضاء — أرينا حصاد" },
  "astronomical-phenomena":   { title: "الظواهر الفلكية — أرينا حصاد" },
  "beverages":                { title: "المشروبات — أرينا حصاد" },
  "body-organs":              { title: "أعضاء جسم الإنسان — أرينا حصاد" },
  "cars-american":            { title: "السيارات الأمريكية — أرينا حصاد" },
  "cars-european":            { title: "السيارات الأوروبية — أرينا حصاد" },
  "cars-japanese":            { title: "السيارات اليابانية — أرينا حصاد" },
  "desserts":                 { title: "الحلويات — أرينا حصاد" },
  "europe-capitals":          { title: "عواصم أوروبا — أرينا حصاد" },
  "first-aid":                { title: "الإسعافات الأولية — أرينا حصاد" },
  "folk-proverbs":            { title: "الأمثال الشعبية — أرينا حصاد" },
  "healthy-nutrition":        { title: "التغذية الصحية — أرينا حصاد" },
  "rivers-seas":              { title: "الأنهار والبحار — أرينا حصاد" },
  "scholars-wisdom":          { title: "العلماء والحكمة — أرينا حصاد" },
  "senses-diseases":          { title: "الحواس والأمراض — أرينا حصاد" },
  "solar-system":             { title: "المجموعة الشمسية — أرينا حصاد" },
  "stars-galaxies":           { title: "النجوم والمجرات — أرينا حصاد" },
  "vehicles-types":           { title: "أنواع المركبات — أرينا حصاد" },
  "world-cuisines":           { title: "مطابخ العالم — أرينا حصاد" },
  "world-scientists":         { title: "علماء العالم — أرينا حصاد" },
  "world-wisdom":             { title: "حكم العالم — أرينا حصاد" },
  "writers-poets":            { title: "الكتّاب والشعراء — أرينا حصاد" },

  // ── Public / sec covers → /public/games ──────────────────────────────────
  "sec_curriculum":    { title: "المناهج الدراسية — أنشطة حصاد العامة" },
  "sec_kids":          { title: "دنيا الأطفال — أنشطة حصاد العامة" },
  "sec_riddles":       { title: "الألغاز والأحاجي — أنشطة حصاد العامة" },
  "sec_picture-q":     { title: "أسئلة الصور — أنشطة حصاد العامة" },
  "sec_space-planets": { title: "الفضاء والكواكب — أنشطة حصاد العامة" },
  "sec_cinema-arabic": { title: "السينما العربية — أنشطة حصاد العامة" },
  "sec_world-cuisine": { title: "مطبخ العالم — أنشطة حصاد العامة" },
  "sec_animals":       { title: "عالم الحيوانات — أنشطة حصاد العامة" },
  "sec_cars-engines":  { title: "السيارات والمحركات — أنشطة حصاد العامة" },
  "sec_ramadan":       { title: "رمضان المبارك — أنشطة حصاد العامة" },

  // ── Islamic section covers → /islamic ────────────────────────────────────
  // (sec_ramadan also appears here with a different caption — handled below)
  "seerah":             { title: "السيرة النبوية — أرينا حصاد",          caption: "مسابقات السيرة النبوية في منصة حصاد" },
  "caliphs":            { title: "الخلفاء الراشدون — أرينا حصاد",        caption: "مسابقات الخلفاء الراشدون في منصة حصاد" },
  "prophets-ulul-azm":  { title: "أنبياء أولو العزم — أرينا حصاد",       caption: "مسابقات أنبياء أولو العزم في منصة حصاد" },
  "prophets-lineage":   { title: "سلسلة الأنبياء — أرينا حصاد",          caption: "مسابقات سلسلة الأنبياء في منصة حصاد" },
  "prophets-israel":    { title: "أنبياء بني إسرائيل — أرينا حصاد",      caption: "مسابقات أنبياء بني إسرائيل في منصة حصاد" },
  "mothers-believers":  { title: "أمهات المؤمنين — أرينا حصاد",          caption: "مسابقات أمهات المؤمنين في منصة حصاد" },
  "ten-companions":     { title: "العشرة المبشّرون بالجنة — أرينا حصاد", caption: "مسابقات العشرة المبشّرون بالجنة في منصة حصاد" },
  "tabiin":             { title: "التابعون — أرينا حصاد",                 caption: "مسابقات التابعون في منصة حصاد" },
  "leaders-conquerors": { title: "القادة والفاتحون — أرينا حصاد",         caption: "مسابقات القادة والفاتحون الإسلاميون في منصة حصاد" },
  "muslim-scientists":  { title: "العلماء المسلمون — أرينا حصاد",        caption: "مسابقات العلماء المسلمون في منصة حصاد" },
  "joseph-brothers":    { title: "يوسف وإخوته — أرينا حصاد",             caption: "قصص القرآن: يوسف وإخوته في منصة حصاد" },
  "moses-pharaoh":      { title: "موسى والفرعون — أرينا حصاد",           caption: "قصص القرآن: موسى والفرعون في منصة حصاد" },
  "cave-people":        { title: "أهل الكهف — أرينا حصاد",               caption: "قصص القرآن: أهل الكهف في منصة حصاد" },
  "elephant-people":    { title: "أصحاب الفيل — أرينا حصاد",             caption: "قصص القرآن: أصحاب الفيل في منصة حصاد" },
};

// Stems that belong to the Islamic /islamic page.
const ISLAMIC_STEMS = new Set([
  "seerah", "caliphs", "prophets-ulul-azm", "prophets-lineage",
  "prophets-israel", "mothers-believers", "ten-companions", "tabiin",
  "leaders-conquerors", "muslim-scientists", "joseph-brothers",
  "moses-pharaoh", "cave-people", "elephant-people",
  // sec_ramadan appears in both /public/games AND /islamic
  "sec_ramadan",
]);

// Stems that are sec_ covers → /public/games
// (derived automatically from prefix, but kept explicit for ordering)
const SEC_ORDER = [
  "sec_curriculum", "sec_kids", "sec_riddles", "sec_picture-q",
  "sec_space-planets", "sec_cinema-arabic", "sec_world-cuisine",
  "sec_animals", "sec_cars-engines", "sec_ramadan",
];

// Islamic section order (matches hand-written sitemap)
const ISLAMIC_ORDER = [
  "seerah", "caliphs", "prophets-ulul-azm", "prophets-lineage",
  "prophets-israel", "mothers-believers", "ten-companions", "tabiin",
  "leaders-conquerors", "muslim-scientists", "joseph-brothers",
  "moses-pharaoh", "cave-people", "elephant-people", "sec_ramadan",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escape(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function imageEntry(stem, ext, caption) {
  const meta = COVER_META[stem];
  const title = meta?.title ?? `${stem} — أرينا حصاد`;
  const effectiveCaption = caption ?? meta?.caption;
  const loc = `${BASE_URL}/arena-covers/${stem}.${ext}`;
  const lines = [
    `    <image:image>`,
    `      <image:loc>${escape(loc)}</image:loc>`,
    `      <image:title>${escape(title)}</image:title>`,
    ...(effectiveCaption ? [`      <image:caption>${escape(effectiveCaption)}</image:caption>`] : []),
    `    </image:image>`,
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Read arena-covers directory
// ---------------------------------------------------------------------------

const files = readdirSync(COVERS_DIR);

// Collect all .webp stems present on disk
const webpStems = new Set(
  files
    .filter((f) => extname(f) === ".webp")
    .map((f) => basename(f, ".webp"))
);

// Warn about stems in the directory that have no title mapping
const unmappedStems = [...webpStems].filter((s) => !(s in COVER_META));
if (unmappedStems.length > 0) {
  console.warn(
    `[generate-image-sitemap] WARNING: ${unmappedStems.length} cover(s) have no Arabic title mapping and will use a placeholder title.\n` +
    `  Add entries to COVER_META in scripts/generate-image-sitemap.mjs for: ${unmappedStems.join(", ")}`
  );
}

// ---------------------------------------------------------------------------
// Build each URL block
// ---------------------------------------------------------------------------

// /games — general covers (not sec_, not logo, and not exclusively islamic)
// Islamic covers can also appear on /games if the arena is listed there; the
// hand-written sitemap kept them separate, so we replicate that: only non-sec_,
// non-islamic stems land in /games.
const gamesStems = [...webpStems]
  .filter((s) => !s.startsWith("sec_") && !ISLAMIC_STEMS.has(s))
  .sort();

// /public/games — sec_ covers present on disk, in canonical order then extras
const secPresent = SEC_ORDER.filter((s) => webpStems.has(s));
const secExtra = [...webpStems]
  .filter((s) => s.startsWith("sec_") && !SEC_ORDER.includes(s))
  .sort();
const secStems = [...secPresent, ...secExtra];

// /islamic — islamic covers present on disk, in canonical order then extras
const islamicPresent = ISLAMIC_ORDER.filter((s) => webpStems.has(s));
const islamicExtra = [...webpStems]
  .filter((s) => ISLAMIC_STEMS.has(s) && !ISLAMIC_ORDER.includes(s))
  .sort();
const islamicStems = [...islamicPresent, ...islamicExtra];

// sec_ramadan caption differs in the islamic section
const RAMADAN_ISLAMIC_CAPTION = "مسابقات رمضان في منصة حصاد";

// ---------------------------------------------------------------------------
// Render XML
// ---------------------------------------------------------------------------

const lines = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`,
  `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
  ``,
  `  <!-- ===== الصفحة الرئيسية — شعار + صورة Open Graph ===== -->`,
  `  <url>`,
  `    <loc>${BASE_URL}/</loc>`,
  `    <image:image>`,
  `      <image:loc>${BASE_URL}/opengraph.jpg</image:loc>`,
  `      <image:title>منصة حصاد التعليمية — HasadX</image:title>`,
  `      <image:caption>منصة حصاد: منصة تعليم تفاعلي عربية للمعلمين والمدارس — عروض تفاعلية، مسابقات تعليمية، وواجبات وأنشطة</image:caption>`,
  `    </image:image>`,
  `    <image:image>`,
  `      <image:loc>${BASE_URL}/images/logo-mark.png</image:loc>`,
  `      <image:title>شعار منصة حصاد التعليمية</image:title>`,
  `      <image:caption>الشعار الرسمي لمنصة حصاد التعليمية (HasadX)</image:caption>`,
  `    </image:image>`,
  `    <image:image>`,
  `      <image:loc>${BASE_URL}/images/logo-hasaad.png</image:loc>`,
  `      <image:title>حصاد — HasadX</image:title>`,
  `      <image:caption>اسم وشعار منصة حصاد التعليمية</image:caption>`,
  `    </image:image>`,
  `  </url>`,
  ``,
  `  <!-- ===== صفحة الألعاب — غلافات أرينا حصاد ===== -->`,
  `  <url>`,
  `    <loc>${BASE_URL}/games</loc>`,
  ...gamesStems.map((s) => imageEntry(s, "webp")),
  `  </url>`,
  ``,
  `  <!-- ===== الأنشطة العامة — غلافات sec ===== -->`,
  `  <url>`,
  `    <loc>${BASE_URL}/public/games</loc>`,
  ...secStems.map((s) => imageEntry(s, "webp")),
  `  </url>`,
  ``,
  `  <!-- ===== صفحة القسم الإسلامي — غلافات إسلامية ===== -->`,
  `  <url>`,
  `    <loc>${BASE_URL}/islamic</loc>`,
  ...islamicStems.map((s) =>
    imageEntry(s, "webp", s === "sec_ramadan" ? RAMADAN_ISLAMIC_CAPTION : undefined)
  ),
  `  </url>`,
  ``,
  `</urlset>`,
];

const xml = lines.join("\n") + "\n";
writeFileSync(OUT_FILE, xml, "utf-8");
console.log(`[generate-image-sitemap] Written ${OUT_FILE}`);
