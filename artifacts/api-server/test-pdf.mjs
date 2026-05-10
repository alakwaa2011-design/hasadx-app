import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { execSync } from 'child_process';

const path = execSync('command -v chromium', { encoding: 'utf8' }).trim();
console.log('PATH:', path);
const args = Array.from(new Set([...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']));
console.log('ARG_COUNT:', args.length);
try {
  const browser = await puppeteer.launch({ args, executablePath: path, headless: true });
  console.log('LAUNCHED');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  const r = await page.goto('http://localhost:80/api/healthz', { waitUntil: 'networkidle0', timeout: 15000 });
  console.log('STATUS:', r?.status());
  const pdf = await page.pdf({ width: '1280px', height: '720px', printBackground: true });
  console.log('PDF_SIZE:', pdf.length);
  await browser.close();
} catch (e) {
  console.log('ERROR:', e.message);
  console.log(e.stack);
}
