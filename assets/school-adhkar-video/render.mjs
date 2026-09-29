import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const dir = fileURLToPath(new URL(".", import.meta.url));
const workspace = resolve(dir, "../..");
const requireFromApp = createRequire(resolve(workspace, "artifacts/homework-app/package.json"));
const { chromium } = requireFromApp("@playwright/test");
const items = JSON.parse(await readFile(join(dir, "content.json"), "utf8"));
const audioDir = join(dir, "audio");
const frameDir = join(dir, "frames");
const normalizedDir = join(dir, "normalized");
await mkdir(frameDir, { recursive: true });
await mkdir(normalizedDir, { recursive: true });

const FONT = (await readFile(resolve(workspace, "artifacts/homework-app/public/fonts/amiri-400-arabic.woff2"))).toString("base64");
const SILENCE_SECONDS = [0.8, 1.3, 1.8, 3.2, 5];
const quranBoundaries = {
  ikhlas: [0, 7.91, 11.992, 15.601, 19.932],
  falaq: [0, 7.566, 11.802, 15.756, 21.824, 28.798],
  nas: [0, 7.858, 14.670, 19.935, 25.379, 34.168, 42.332],
};
const arabicNumeral = (number) => new Intl.NumberFormat("ar-EG", { useGrouping: false }).format(number);
const htmlEscape = (text) => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function run(program, args, quiet = false) {
  return execFileSync(program, args, { encoding: "utf8", stdio: quiet ? ["ignore", "pipe", "pipe"] : "inherit" });
}
function duration(path) {
  return Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], true).trim());
}
function normalAudio(input, id) {
  const output = join(normalizedDir, `${id}.wav`);
  run("ffmpeg", ["-loglevel", "error", "-y", "-i", input, "-vn", "-af", "loudnorm=I=-18:TP=-2:LRA=8",
    "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", output], true);
  return output;
}
for (const seconds of SILENCE_SECONDS) {
  const output = join(normalizedDir, `silence-${seconds}.wav`);
  run("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-t", String(seconds), "-c:a", "pcm_s16le", output], true);
}
const silent = (seconds) => join(normalizedDir, `silence-${seconds}.wav`);
const audio = new Map();
for (const item of items) {
  const segments = item.type === "quran"
    ? [join(audioDir, item.audio)]
    : item.lines.map((_, index) => join(audioDir, `${item.id}-${index}.wav`));
  for (const [index, segment] of segments.entries()) {
    const id = `${item.id}-${index}`;
    audio.set(id, normalAudio(segment, id));
  }
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    || process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE
    || run("which", ["chromium"], true).trim(),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Amiri;src:url(data:font/woff2;base64,${FONT}) format("woff2");font-weight:400}
*{box-sizing:border-box}
body{margin:0;color:#233a31;background:radial-gradient(circle at 18% 20%,#2c4f3f 0%,transparent 29%),
  radial-gradient(circle at 86% 82%,#35503c 0%,transparent 38%),#112e29;font-family:Amiri,serif}
.stage{width:1600px;height:900px;position:relative;overflow:hidden}
.stage:before{content:"";position:absolute;inset:31px;border:1px solid #a98a50aa;border-radius:20px;pointer-events:none}
.decor{position:absolute;inset:44px;border:1px solid #d8bb7544;border-radius:15px;pointer-events:none}
.corner{position:absolute;width:29px;height:29px;border:2px solid #d2b978;transform:rotate(45deg);top:38px;right:38px;background:#17382f}
.corner.b{left:38px;right:auto}.corner.c{top:auto;bottom:38px}.corner.d{left:38px;right:auto;top:auto;bottom:38px}
.top{height:126px;padding:55px 104px 0;display:flex;align-items:start;justify-content:space-between;color:#f5eeda}
.top-right{display:flex;align-items:center;gap:18px}.seal{height:44px;width:44px;display:flex;align-items:center;justify-content:center;
  border-radius:50%;border:1px solid #d9b875;color:#e1c888;font:27px Amiri}
.series{font:20px Amiri;color:#dbccb0;line-height:1.5}
.top-left{font:30px Amiri;color:#ffebb9;padding:3px 18px 0;background:#204235;
  border:1px solid #b79657;border-radius:20px;line-height:1.4}
.progress-dots{display:inline-flex;vertical-align:middle;gap:8px;margin-right:15px;direction:rtl}
.progress-dots i{width:10px;height:10px;border-radius:50%;border:1px solid #c6b37c;display:inline-block}
.progress-dots i.on{background:#dfba66}
.titlebar{margin:7px 94px 0;height:85px;display:flex;align-items:baseline;justify-content:space-between;color:#f8f1dd}
.titlebar h1{font:400 48px Amiri;margin:0;line-height:1.3}
.titlebar small{color:#d9c596;font:21px Amiri}
.paper{position:absolute;inset:220px 102px 93px;background:#f7f0dc;border-radius:6px;
  box-shadow:0 22px 70px #071c1980, inset 0 0 95px #c7b88d25;overflow:hidden}
.paper:before{content:"";position:absolute;inset:13px;border:2px solid #b49a6188;pointer-events:none}
.paper:after{content:"";position:absolute;inset:21px;border:1px solid #cbb68999;pointer-events:none}
.paper-head{height:68px;display:flex;align-items:center;justify-content:center;color:#7a6947;font:27px Amiri;position:relative}
.paper-head:before,.paper-head:after{content:"۞";font-size:28px;color:#af9563;margin:0 20px}
.page-inner{height:481px;margin:0 58px;display:flex;flex-direction:column;justify-content:center;gap:5px;
  overflow:hidden;direction:rtl;text-align:center}
.line{padding:1px 15px;margin:0 auto;max-width:100%;border-radius:11px;line-height:1.72;transition:none}
.line.dim{color:#647064}.line.active{color:#153c30;background:#e7d8a7;box-shadow:0 0 0 2px #c3a35e80,inset 0 1px #fff7dd;font-weight:400}
.quran .line{font-size:57px}.quran.long .line{font-size:35px;line-height:1.66}
.quran.long .page-inner{gap:0;position:relative}
.quran.long .page-inner:before{content:"";position:absolute;top:50%;left:12%;right:12%;height:345px;
  transform:translateY(-50%);background:#e7d8a7;border:1px solid #c3a35e80;border-radius:12px}
.quran.long .line.active{position:relative;background:none;box-shadow:none}
.dua .line{font-size:54px}.dua.multi .line{font-size:45px}
.bismillah{font:36px Amiri;color:#958353;text-align:center;margin:0 0 6px}
.bismillah.active{color:#173f33;background:#e7d8a7;border-radius:12px;box-shadow:0 0 0 2px #c3a35e80}
.paper-foot{position:absolute;bottom:16px;left:40px;right:40px;display:flex;justify-content:space-between;align-items:center;
  color:#7a715d;font:18px Amiri;padding:0 40px}
.paper-foot .line-mark{width:160px;height:1px;background:#b9aa84}
.bottom{position:absolute;bottom:46px;left:107px;right:107px;display:flex;align-items:center;justify-content:space-between;
  color:#d6c6a3;font:20px Amiri}
.bottom .track{width:43%;height:3px;background:#617367;border-radius:20px;overflow:hidden}
.bottom .track span{height:100%;display:block;background:#d8b36c}
.intro-title{position:absolute;inset:26% 0 auto;text-align:center;color:#f5ecd6;font:400 108px Amiri;line-height:1.4}
.intro-sub{position:absolute;inset:49% 0 auto;text-align:center;color:#dec995;font:32px Amiri}
.intro-mark{position:absolute;inset:17% 0 auto;text-align:center;color:#bda66b;font:50px Amiri}
.credits{position:absolute;inset:24% 190px auto;text-align:center;color:#f8eed9;font:40px Amiri;line-height:1.6}
.credits .sm{font:22px Amiri;color:#d3c3a2;line-height:1.8;display:block;margin-top:34px}
</style></head><body><div id="root"></div></body></html>`);
await page.evaluate(() => document.fonts.ready);

function chrome() {
  return `<div class="decor"></div><div class="corner"></div><div class="corner b"></div><div class="corner c"></div><div class="corner d"></div>`;
}
async function screenshot(key, markup) {
  const out = join(frameDir, `${key}.png`);
  await page.locator("#root").evaluate((root, content) => { root.innerHTML = content; }, markup);
  const overflow = await page.evaluate(() => {
    const area = document.querySelector(".page-inner");
    if (!area) return 0;
    const lines = area.querySelectorAll(".line");
    while (area.scrollHeight > area.clientHeight + 3) {
      const size = Number.parseFloat(getComputedStyle(lines[0]).fontSize);
      if (size <= 26) break;
      lines.forEach((line) => { line.style.fontSize = `${size - 2}px`; });
    }
    return area.scrollHeight - area.clientHeight;
  });
  if (overflow > 8) throw new Error(`Text overflows for ${key}: ${overflow}px`);
  await page.screenshot({ path: out });
  return out;
}
function screen(item, active, repetition, forIntro = false) {
  const total = item.repeat;
  const kind = item.type === "quran" ? "القرآن الكريم" : "أذكار الصباح";
  const repeatLabel = total === 1 ? "مرة واحدة" : `المرة ${arabicNumeral(repetition)} من ${arabicNumeral(total)}`;
  const dots = total > 1 ? `<span class="progress-dots">${Array.from({ length: total }, (_, i) =>
    `<i class="${i < repetition ? "on" : ""}"></i>`).join("")}</span>` : "";
  const lines = item.lines.map((text, index) =>
    `<div class="line ${!forIntro && (active === index || item.id === "ayat-kursi") ? "active" : "dim"}">${htmlEscape(text)}</div>`).join("");
  const basmala = item.type === "quran" && item.id !== "ayat-kursi"
    ? `<div class="bismillah ${active === -1 && !forIntro ? "active" : ""}">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>` : "";
  return `<main class="stage">${chrome()}
    <header class="top"><div class="top-right"><div class="seal">۞</div><div class="series">أذكار الصباح<br>${kind}</div></div>
    <div class="top-left">${dots}${repeatLabel}</div></header>
    <div class="titlebar"><h1>${htmlEscape(item.title)}</h1><small>${htmlEscape(item.reference)}</small></div>
    <div class="paper ${item.type === "quran" ? `quran ${item.id === "ayat-kursi" ? "long" : ""}` : `dua ${item.lines.length > 1 ? "multi" : ""}`}">
      <div class="paper-head">${item.type === "quran" ? "القرآن الكريم" : "أذكار الصباح"}</div><div class="page-inner">${basmala}${lines}</div>
      <div class="paper-foot"><span class="line-mark"></span><span>${forIntro ? "استعدّ للقراءة" : "تابع الكلام المُظلّل مع الصوت"}</span><span class="line-mark"></span></div>
    </div><footer class="bottom"><span>${htmlEscape(item.number)} / ٠٩</span><span class="track"><span style="width:${((items.indexOf(item) + 1) / items.length) * 100}%"></span></span>
    <span>${total > 1 ? repeatLabel : "ذكر الصباح"}</span></footer></main>`;
}

const videoEvents = [];
const audioEvents = [];
const add = (image, seconds) => { videoEvents.push({ image, seconds }); };
const play = (path) => { audioEvents.push(path); return duration(path); };
const gap = (image, seconds) => { add(image, seconds); play(silent(seconds)); };

gap(await screenshot("intro", `<div class="stage">${chrome()}<div class="intro-mark">۞</div><div class="intro-title">أذكار الصباح</div>
  <div class="intro-sub">اقرأ مع التلاوة · اتبع التظليل · انتبه لعدد التكرارات</div></div>`), 3.2);
for (const item of items) {
  for (let repetition = 1; repetition <= item.repeat; repetition += 1) {
    const title = await screenshot(`${item.id}-${repetition}-ready`, screen(item, item.type === "quran" && item.id !== "ayat-kursi" ? -1 : 0, repetition, true));
    gap(title, repetition === 1 ? 1.8 : 1.3);
    if (item.type === "quran") {
      const audioFile = audio.get(`${item.id}-0`);
      const seconds = play(audioFile);
      const starts = quranBoundaries[item.id] ?? [0];
      for (const [part, start] of starts.entries()) {
        const active = item.id === "ayat-kursi" ? 0 : part - 1;
        const end = starts[part + 1] ?? seconds;
        const image = await screenshot(`${item.id}-${repetition}-${part}`, screen(item, active, repetition));
        add(image, end - start);
      }
    } else {
      for (const [part] of item.lines.entries()) {
        const image = await screenshot(`${item.id}-${repetition}-${part}`, screen(item, part, repetition));
        add(image, play(audio.get(`${item.id}-${part}`)));
      }
    }
    if (repetition < item.repeat) {
      const last = videoEvents.at(-1).image;
      gap(last, 0.8);
    }
  }
  gap(videoEvents.at(-1).image, 1.3);
}
gap(await screenshot("outro", `<div class="stage">${chrome()}<div class="intro-mark">۞</div>
  <div class="credits">تمّت أذكار الصباح<br>بارك الله فيكم
  <span class="sm">التلاوة القرآنية: سعود الشريم · عاقب عزيز<br>قراءة الأدعية: صوت عربي مولّد · المصادر والترخيص في ملف المراجع المرفق</span></div></div>`), 5);
await browser.close();

const videoList = ["ffconcat version 1.0"];
for (const event of videoEvents) {
  videoList.push(`file '${event.image.replaceAll("'", "'\\''")}'`);
  videoList.push(`duration ${event.seconds.toFixed(6)}`);
}
videoList.push(`file '${videoEvents.at(-1).image}'`);
const audioList = ["ffconcat version 1.0", ...audioEvents.map((path) => `file '${path}'`)];
await writeFile(join(dir, "frames.ffconcat"), `${videoList.join("\n")}\n`);
await writeFile(join(dir, "audio.ffconcat"), `${audioList.join("\n")}\n`);

const plannedVideo = videoEvents.reduce((sum, event) => sum + event.seconds, 0);
const plannedAudio = audioEvents.reduce((sum, path) => sum + duration(path), 0);
if (Math.abs(plannedVideo - plannedAudio) > 0.15) throw new Error(`Timeline drift: video ${plannedVideo}, audio ${plannedAudio}`);
console.log(`Rendering ${videoEvents.length} visual beats, ${Math.round(plannedVideo)}s / ${Math.round(plannedVideo / 60)}min`);
run("ffmpeg", ["-hide_banner", "-loglevel", "warning", "-stats", "-y",
  "-f", "concat", "-safe", "0", "-i", join(dir, "frames.ffconcat"),
  "-f", "concat", "-safe", "0", "-i", join(dir, "audio.ffconcat"),
  "-map", "0:v:0", "-map", "1:a:0", "-r", "12",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
  "-movflags", "+faststart", "-shortest", join(dir, "adhkar-school-16x9.mp4")]);