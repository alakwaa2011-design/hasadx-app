import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const root = resolve(".");
const work = resolve("attached_assets/teachers-day-film");
mkdirSync(`${work}/render`, { recursive: true });
const require = createRequire(resolve("artifacts/homework-app/package.json"));
const { chromium } = require("@playwright/test");
const photos = [
  "attached_assets/F4A34B6D-1942-4F24-BDCB-02F6C4F1F536_1791183493234.png",
  "attached_assets/IMG_4421_1791183493234.jpeg",
  "attached_assets/IMG_4420_1791183493234.jpeg",
].map((p, i) => `data:image/${i === 0 ? "png" : "jpeg"};base64,${readFileSync(p).toString("base64")}`);
const fonts = [400, 800].map(w => `@font-face{font-family:Film;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(`artifacts/homework-app/public/fonts/tajawal-${w}-arabic.woff2`).toString("base64")})}`).join("");
const starts = [0, 5.8, 12.1, 18.5, 25.4, 32, 38.6, 45];
const duration = 50.048;
const fade = 0.6;
const shots = [
  { photo: 0, label: "٥ أكتوبر", title: "يوم المعلم", sub: "إلى من علّمنا…", style: "bleed", push: true },
  { photo: 1, label: "", title: "المعرفة نور", sub: "وأنتم من يضيء الطريق", style: "bleed", push: true },
  { photo: 2, label: "", title: "بكم نكبر", sub: "علمٌ وثقةٌ وأمل", style: "paper", push: false },
  { photo: 1, label: "", title: "أكثر من درس", sub: "أثرٌ يمتدّ إلى الحياة", style: "macro", push: true },
  { photo: 0, label: "", title: "وبكم نحلم", sub: "ونمضي بثقة نحو الغد", style: "bleed", push: true },
  { photo: 1, label: "", title: "لحظات تصنع المستقبل", sub: "بصبركم… واهتمامكم", style: "pair", push: false },
  { photo: 2, label: "", title: "شكرًا من القلب", sub: "لكل معلمٍ ومعلمة", style: "bleed", push: true },
  { photo: 0, label: "يوم المعلم", title: "أثركم يبقى", sub: "كل عام وأنتم مصدر الإلهام", style: "paper", push: false },
];
const browser = await chromium.launch({ headless: true, ...(process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i], paper = shot.style === "paper";
    let image = `<img class="hero ${shot.style}" src="${photos[shot.photo]}">`;
    if (shot.style === "pair") image = `<div class="print a"><img src="${photos[1]}"></div><div class="print b"><img src="${photos[2]}"></div>`;
    const html = `<style>${fonts}
      *{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:${paper ? "#f1e8db" : "#24221f"};font-family:Film}
      .hero{position:absolute;width:1080px;height:1920px;object-fit:cover}
      .macro{width:1260px;height:2240px;left:-90px;top:-260px}
      .paper{width:900px;height:1410px;left:90px;top:80px;object-position:50% 40%;border:12px solid #fffaf1;box-shadow:0 20px 65px #6a4e2828}
      .print{position:absolute;overflow:hidden;border:14px solid #f9f0e3;box-shadow:0 35px 85px #0007}
      .print img{width:100%;height:100%;object-fit:cover}
      .a{width:680px;height:1190px;left:-35px;top:130px;transform:rotate(-6deg)}
      .b{width:640px;height:1110px;right:-35px;top:485px;transform:rotate(6deg)}
      .vignette{position:absolute;inset:0;background:linear-gradient(0deg,#121713ed 0%,#111811b8 12%,#11181150 26%,transparent 46%)}
      .rule{position:absolute;top:1520px;left:120px;width:840px;height:2px;background:#b9975b}
    </style>${image}${paper ? '<div class="rule"></div>' : '<div class="vignette"></div>'}`;
    await page.setContent(html);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(im=>im.decode())); });
    await page.screenshot({ path: `${work}/render/bg-${i}.png` });
    await page.setContent(`<style>${fonts}*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:transparent;font-family:Film;color:${paper ? "#302a22" : "#fff8eb"}}
      .titles{position:absolute;left:78px;right:78px;bottom:${paper ? 108 : 175}px;text-align:center;direction:rtl}
      .label{font-size:38px;letter-spacing:1px;color:${paper ? "#84622d" : "#e7ca91"};margin-bottom:24px}
      .line{width:90px;height:3px;margin:0 auto 31px;background:#cba765}
      h1{font-size:${shot.style === "pair" ? 78 : 104}px;font-weight:800;line-height:1.24;margin:0 0 25px;text-shadow:${paper ? "none" : "0 5px 22px #0006"}}
      p{font-size:49px;font-weight:400;line-height:1.4;margin:0}
    </style><div class="titles">${shot.label ? `<div class="label">${shot.label}</div>` : '<div class="line"></div>'}<h1>${shot.title}</h1><p>${shot.sub}</p></div>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${work}/render/title-${i}.png`, omitBackground: true });
  }
} finally { await browser.close(); }

function ff(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-threads", "2", ...args], { stdio: "inherit", maxBuffer: 1024 * 1024 });
}
const encode = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-video_track_timescale", "15360"];
for (let i = 0; i < shots.length; i++) {
  const len = i === 7 ? duration - starts[i] : starts[i + 1] - starts[i] + fade;
  const frames = Math.ceil(len * 30);
  const zoom = shots[i].push ? `1.025+0.065*on/${frames}` : `1.10-0.065*on/${frames}`;
  ff(["-loop", "1", "-i", `${work}/render/bg-${i}.png`, "-loop", "1", "-i", `${work}/render/title-${i}.png`,
    "-filter_complex_threads", "1", "-filter_complex",
    `[0:v]scale=2160:3840,zoompan=z='${zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30,setsar=1[bg];[1:v]format=rgba,fade=t=in:st=0.45:d=0.7:alpha=1[txt];[bg][txt]overlay=y='48*(1-min(max((t-0.45)/0.7,0),1))':shortest=1,format=yuv420p[out]`,
    "-map", "[out]", "-t", String(len), ...encode, `${work}/render/shot-${i}.mp4`]);
  console.log(`Rendered shot ${i + 1}/8`);
}
const pieces = [];
for (let i = 0; i < shots.length; i++) {
  const head = i === 0 ? 0 : fade;
  const plainLen = (i === 7 ? duration - starts[i] : starts[i + 1] - starts[i]) - head;
  const plain = `${work}/render/plain-${i}.mp4`;
  ff(["-ss", String(head), "-i", `${work}/render/shot-${i}.mp4`, "-t", String(plainLen), ...encode, plain]);
  pieces.push(plain);
  if (i < 7) {
    const transition = `${work}/render/dissolve-${i}.mp4`;
    ff(["-ss", String(starts[i + 1] - starts[i]), "-i", `${work}/render/shot-${i}.mp4`, "-i", `${work}/render/shot-${i + 1}.mp4`,
      "-filter_complex_threads", "1", "-filter_complex",
      `[0:v]settb=AVTB,setpts=PTS-STARTPTS[a];[1:v]settb=AVTB,setpts=PTS-STARTPTS[b];[a][b]xfade=transition=fade:duration=${fade}:offset=0,format=yuv420p[out]`,
      "-map", "[out]", "-t", String(fade), ...encode, transition]);
    pieces.push(transition);
  }
}
writeFileSync(`${work}/render/concat.txt`, pieces.map(p => `file '${p}'`).join("\n"));
ff(["-f", "concat", "-safe", "0", "-i", `${work}/render/concat.txt`,
  "-i", `${root}/attached_assets/جنى_الشمري_1791183792429.m4a`, "-map", "0:v:0", "-map", "1:a:0",
  "-c:v", "copy", "-af", "highpass=f=60,afftdn=nr=4:nf=-35,loudnorm=I=-16:TP=-1.5:LRA=11",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", String(duration), "-movflags", "+faststart",
  `${work}/teachers-day-1080p.mp4`]);
console.log("Finished: attached_assets/teachers-day-film/teachers-day-1080p.mp4");
