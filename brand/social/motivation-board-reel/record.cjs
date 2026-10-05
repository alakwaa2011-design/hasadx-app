// Records index.html as a 1080x1920 reel. Usage:
//   NODE_PATH=<dir with playwright-core> node record.cjs <out.mp4>
// Needs: python3 (static server), Chromium at PLAYWRIGHT_BROWSERS_PATH, ffmpeg (imageio-ffmpeg).
const { chromium } = require('playwright-core');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const out = path.resolve(process.argv[2] || 'motivation-board-reel.mp4');
const brandDir = path.resolve(__dirname, '../..');
const ffmpeg = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', '8765', '--directory', brandDir], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const vdir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'reel-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1,
    recordVideo: { dir: vdir, size: { width: 1080, height: 1920 } },
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto('http://localhost:8765/social/motivation-board-reel/index.html');
  await page.waitForFunction('window.__ready === true', null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const tStart = Date.now();
  await page.evaluate('window.startReel()');
  const total = await page.evaluate('window.__total');
  await page.waitForTimeout(total + 500);
  await page.close(); await ctx.close(); await browser.close(); srv.kill();
  const webm = path.join(vdir, fs.readdirSync(vdir).find(f => f.endsWith('.webm')));
  // find the magenta sync flash (page paints it for 300ms right before the timeline starts)
  const probe = execFileSync(ffmpeg, ['-v', 'error', '-t', '8', '-i', webm, '-vf', 'fps=50,scale=4:4', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  const fsz = 4 * 4 * 3; let first = -1, last = -1;
  for (let i = 0; i * fsz < probe.length; i++) {
    const r = probe[i * fsz], g = probe[i * fsz + 1], b = probe[i * fsz + 2];
    if (r > 200 && g < 60 && b > 200) { if (first < 0) first = i; last = i; }
  }
  if (first < 0) throw new Error('sync flash not found in recording');
  const ss = ((last + 1) / 50 + 0.02).toFixed(2); // first frame after the flash
  execFileSync(ffmpeg, ['-y', '-ss', ss, '-i', webm, '-t', String(total / 1000),
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-movflags', '+faststart', '-an', out], { stdio: 'ignore' });
  console.log('wrote', out, 'trim', ss);
})();
