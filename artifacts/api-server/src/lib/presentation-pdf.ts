/**
 * Server-side PDF builder for presentation decks.
 *
 * Drives a cached headless chromium (`puppeteer-core` + the system
 * Chromium installed via Nix) to navigate to the homework-app's print
 * page (`/teacher/presentations/:id/print?exportToken=…&ssr=1`) and
 * prints the resulting DOM with `page.pdf()`. The print page reuses
 * the exact same `SlideRender` React component used by present mode,
 * so the PDF is pixel-for-pixel identical to what the teacher sees in
 * the editor — without re-implementing slide rendering server-side.
 *
 * Browser binary: Replit's environment ships `pkgs.chromium` via Nix
 * (see `replit.nix`); its required shared libraries are baked into
 * the binary's RPATH, so it launches reliably in both dev and the
 * deployment image. Puppeteer's bundled Chromium needs `libglib` /
 * `libnss` from standard system paths that don't exist on Replit, and
 * `@sparticuz/chromium` (a Lambda binary) needs a brotli tarball that
 * isn't shipped here — both fail to launch. Only the Nix Chromium
 * works. We resolve it from `PATH` (or honor `PUPPETEER_EXECUTABLE_PATH`
 * if explicitly set as an escape hatch).
 *
 * Auth: the chromium worker has no teacher session cookie, so the
 * caller (the `/export/pdf` route handler) mints a 60-second
 * HMAC-signed export token bound to (presentationId, teacherId) and
 * passes it in the URL. The print page reads the deck via the
 * tokenized `GET /api/presentations/:id/export-data?token=…` endpoint.
 *
 * Readiness: the print page sets `window.__SLIDES_READY__ = true`
 * once every slide has mounted (and the `?ssr=1` flag suppresses the
 * client-side `window.print()` call so we don't double-trigger).
 */
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer-core";
import { logger } from "./logger.js";

const CANVAS_W = 1280;
const CANVAS_H = 720;

let cachedExecPath: string | null = null;
function resolveChromiumPath(): string {
  if (cachedExecPath) return cachedExecPath;
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH &&
    existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    cachedExecPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    logger.info({ path: cachedExecPath, source: "env" }, "chromium resolved");
    return cachedExecPath;
  }
  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const out = execSync(`command -v ${name}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (out && existsSync(out)) {
        cachedExecPath = out;
        logger.info({ path: cachedExecPath, source: "path" }, "chromium resolved");
        return cachedExecPath;
      }
    } catch {
      /* not found, try next */
    }
  }
  throw new Error(
    "No chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install chromium via the Replit package manager (it should already be in replit.nix as pkgs.chromium).",
  );
}

let cachedBrowser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (cachedBrowser && cachedBrowser.connected) return cachedBrowser;
  /* Args tuned for Replit's containerized environment:
       --no-sandbox / --disable-setuid-sandbox: containers don't grant
         the syscalls Chrome's sandbox needs.
       --disable-dev-shm-usage: /dev/shm is tiny in containers and
         Chrome needs > a few MB to render anything substantial.
       --disable-gpu / --disable-software-rasterizer / --hide-scrollbars
         / --mute-audio: pure headless rendering, no GPU/audio.
       --no-zygote / --single-process: avoids the zygote-fork pattern
         that fails in restricted production sandboxes (the root cause
         of the "WS endpoint URL never appeared" timeout we observed
         in deploy logs — Chrome's main process was waiting on a
         zygote that couldn't fork). */
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-zygote",
    "--single-process",
  ];
  const executablePath = resolveChromiumPath();
  const opts: LaunchOptions = {
    args,
    executablePath,
    headless: true,
    /* Increase from the puppeteer default (30s) — first-launch in a
       cold container can spend several seconds resolving dynamic
       libs before Chrome starts printing on stdout. */
    timeout: 60_000,
    protocolTimeout: 60_000,
  };
  try {
    cachedBrowser = await puppeteer.launch(opts);
    logger.info({ executablePath }, "chromium launched");
    return cachedBrowser;
  } catch (err) {
    logger.error({ err, executablePath }, "puppeteer.launch failed");
    /* Invalidate the cached path so a follow-up request can re-probe
       (e.g. if the operator installs a different chromium). */
    cachedExecPath = null;
    throw new Error(
      `Failed to launch Chromium for PDF export (path=${executablePath}): ${(err as Error).message}`,
    );
  }
}

/**
 * Build a PDF by navigating chromium to the supplied print URL.
 * Caller is responsible for minting the export token and constructing
 * the URL with `?exportToken=…&ssr=1`.
 */
export async function buildPdf(printUrl: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  /* Surface browser-side errors. Without this, a runtime exception in
     the print page (broken bundle, asset 404, hydration crash) shows
     up as an empty PDF with the right page count instead of a useful
     server log. */
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warn") {
      logger.warn({ pdfPage: t, text: msg.text() }, "pdf print page console");
    }
  });
  page.on("pageerror", (err: Error) => {
    logger.error({ err: err.message, stack: err.stack }, "pdf print page error");
  });
  page.on("requestfailed", (req) => {
    logger.warn({ url: req.url(), reason: req.failure()?.errorText }, "pdf print page request failed");
  });
  try {
    await page.setViewport({ width: CANVAS_W, height: CANVAS_H, deviceScaleFactor: 2 });
    /* `networkidle0` waits for fonts + images. The print page also
       sets `window.__SLIDES_READY__` once every slide has rendered;
       wait on it as a stronger signal of layout completion. */
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.waitForFunction(
      "window.__SLIDES_READY__ === true",
      { timeout: 15_000 },
    ).catch(() => undefined);
    /* Diagnostic: how many slide divs actually rendered, and is the
       first one non-empty? Helps tell "page count looks right but
       blank" from "renderer never mounted". */
    const diag = await page.evaluate(`(() => {
      const slides = document.querySelectorAll('.print-slide');
      const first = slides[0];
      const rect = first ? first.getBoundingClientRect() : null;
      return {
        count: slides.length,
        firstHtmlLen: first ? first.innerHTML.length : 0,
        firstChildren: first ? first.children.length : 0,
        bodyBg: getComputedStyle(document.body).background.slice(0, 80),
        firstBg: first ? getComputedStyle(first).background.slice(0, 120) : null,
        firstW: rect ? rect.width : 0,
        firstH: rect ? rect.height : 0,
      };
    })()`).catch(() => null);
    logger.info({ diag }, "pdf print page diag");
    /* Emulate `print` so any `@media print` rules in the deck (such
       as the print-page's own `@page` size rule) take effect. */
    await page.emulateMediaType("print");
    const pdf = await page.pdf({
      width: `${CANVAS_W}px`,
      height: `${CANVAS_H}px`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
  }
}
