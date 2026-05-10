import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { execSync } from 'child_process';
import { createHmac } from 'crypto';

const SECRET = process.env.SESSION_SECRET ?? '';
function b64url(b) { return b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function mint(pid, tid) {
  const body = b64url(Buffer.from(JSON.stringify({ pid, tid, exp: Date.now()+60000 })));
  const sig = b64url(createHmac('sha256', SECRET).update(body).digest());
  return `${body}.${sig}`;
}
const path = execSync('command -v chromium', { encoding: 'utf8' }).trim();
const args = Array.from(new Set([...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']));
const browser = await puppeteer.launch({ args, executablePath: path, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

const PID = 4, TID = 52;
const url = `http://localhost:80/teacher/presentations/${PID}/print?exportToken=${encodeURIComponent(mint(PID,TID))}&ssr=1`;
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction('window.__SLIDES_READY__===true', { timeout: 15000 }).catch(()=>{});
await page.emulateMediaType('print');

const sizes = await page.$$eval('.print-slide', els => els.map(e => {
  const r = e.getBoundingClientRect();
  const cs = getComputedStyle(e);
  return { w: r.width, h: r.height, off: e.offsetHeight, pba: cs.pageBreakAfter, ba: cs.breakAfter };
}));
console.log('print-slides:', JSON.stringify(sizes, null, 1));
const bodyH = await page.evaluate(() => document.body.scrollHeight);
console.log('body scrollHeight:', bodyH);
await browser.close();
