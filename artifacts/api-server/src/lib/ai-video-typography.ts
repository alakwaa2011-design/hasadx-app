import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser, type LaunchOptions } from "puppeteer-core";

export interface AiVideoTermRenderOptions {
  text: string;
  language: "ar" | "en";
  width: number;
  height: number;
  outputPath: string;
}

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const MAX_TERM_CHARACTERS = 60;
const MAX_TERM_WORDS = 7;
const MAX_CANVAS_EDGE = 4096;

let cachedExecPath: string | null = null;

function resolveFontPath(): string {
  // In source MODULE_DIR is src/lib; after esbuild bundles it is dist.
  // build.mjs recursively copies src/data to dist/data.
  const candidates = [
    resolve(MODULE_DIR, "../data/fonts/Cairo-Variable.ttf"),
    resolve(MODULE_DIR, "data/fonts/Cairo-Variable.ttf"),
    resolve(process.cwd(), "src/data/fonts/Cairo-Variable.ttf"),
    resolve(process.cwd(), "dist/data/fonts/Cairo-Variable.ttf"),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(`Bundled Cairo font was not found (checked: ${candidates.join(", ")})`);
  }
  return path;
}

function resolveChromiumPath(): string {
  if (cachedExecPath) return cachedExecPath;
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH
    && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    cachedExecPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    return cachedExecPath;
  }

  for (const name of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const path = execSync(`command -v ${name}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (path && existsSync(path)) {
        cachedExecPath = path;
        return path;
      }
    } catch {
      // Try the next executable name.
    }
  }

  throw new Error(
    "No chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install chromium.",
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

function validateOptions(options: AiVideoTermRenderOptions): string {
  if (options.language !== "ar" && options.language !== "en") {
    throw new Error('AI video term language must be "ar" or "en"');
  }
  for (const [name, value] of [["width", options.width], ["height", options.height]] as const) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_CANVAS_EDGE) {
      throw new Error(`${name} must be an integer between 1 and ${MAX_CANVAS_EDGE}`);
    }
  }
  if (!options.outputPath.toLowerCase().endsWith(".png")) {
    throw new Error("AI video term outputPath must end in .png");
  }

  const text = options.text.trim().replace(/\s+/gu, " ");
  if (!text) throw new Error("AI video term text cannot be empty");
  if ([...text].length > MAX_TERM_CHARACTERS) {
    throw new Error(`AI video term text cannot exceed ${MAX_TERM_CHARACTERS} characters`);
  }
  if (text.split(" ").length > MAX_TERM_WORDS) {
    throw new Error(`AI video term text cannot exceed ${MAX_TERM_WORDS} words`);
  }
  return text;
}

function renderDocument(
  text: string,
  language: "ar" | "en",
  fontData: string,
  width: number,
  height: number,
): string {
  const escapedText = escapeHtml(text);
  const scale = Math.min(width, height) / 720;
  const fontSize = Math.max(12, Math.round(50 * scale));
  const horizontalPadding = Math.max(10, Math.round(38 * scale));
  const verticalPadding = Math.max(7, Math.round(17 * scale));
  const radius = Math.max(8, Math.round(18 * scale));

  return `<!doctype html>
<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src data:; style-src 'unsafe-inline'">
  <style>
    @font-face {
      font-family: "Cairo Video";
      src: url(data:font/ttf;base64,${fontData}) format("truetype");
      font-style: normal;
      font-weight: 200 1000;
      font-display: block;
    }
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: transparent;
    }
    body {
      position: relative;
      font-family: "Cairo Video", sans-serif;
    }
    .term-panel {
      position: absolute;
      left: 50%;
      bottom: 8%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: max-content;
      max-width: 88%;
      min-height: ${Math.max(56, Math.round(86 * scale))}px;
      padding: ${verticalPadding}px ${horizontalPadding}px;
      border-radius: ${radius}px;
      background: rgba(10, 16, 28, 0.78);
      color: #fff;
    }
    .term-text {
      display: -webkit-box;
      max-width: 100%;
      overflow: hidden;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      font-family: "Cairo Video", sans-serif;
      font-size: ${fontSize}px;
      font-style: normal;
      font-weight: 700;
      line-height: 1.32;
      letter-spacing: 0;
      text-align: center;
      text-overflow: clip;
      unicode-bidi: plaintext;
      white-space: normal;
    }
  </style>
</head>
<body>
  <div class="term-panel"><div class="term-text">${escapedText}</div></div>
</body>
</html>`;
}

/**
 * Renders a short AI-video term into a transparent, full-canvas PNG.
 *
 * Each call owns its Chromium process and page. This avoids shared-page state
 * and guarantees that concurrent renders cannot overwrite one another.
 */
export async function renderAiVideoTerm(
  options: AiVideoTermRenderOptions,
): Promise<void> {
  const text = validateOptions(options);
  const fontPath = resolveFontPath();
  const font = await readFile(fontPath);
  if (!font.length) throw new Error(`Cairo font is empty: ${fontPath}`);

  const launchOptions: LaunchOptions = {
    executablePath: resolveChromiumPath(),
    headless: true,
    timeout: 60_000,
    protocolTimeout: 60_000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--hide-scrollbars",
      "--mute-audio",
      "--no-zygote",
      "--single-process",
    ],
  };

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    try {
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = request.url();
        if (url === "about:blank" || url.startsWith("data:")) {
          void request.continue();
        } else {
          void request.abort("blockedbyclient");
        }
      });
      await page.setViewport({
        width: options.width,
        height: options.height,
        deviceScaleFactor: 1,
      });
      await page.setContent(
        renderDocument(
          text,
          options.language,
          font.toString("base64"),
          options.width,
          options.height,
        ),
        { waitUntil: "load", timeout: 30_000 },
      );

      const fontSize = Math.max(12, Math.round(50 * Math.min(options.width, options.height) / 720));
      const fontLoaded = await page.evaluate(async ({ sample, size }) => {
        const browserDocument = (globalThis as unknown as {
          document: {
            fonts: {
              ready: Promise<unknown>;
              load: (font: string, text: string) => Promise<Array<{ status: string }>>;
              check: (font: string, text: string) => boolean;
            };
          };
        }).document;
        await browserDocument.fonts.ready;
        const faces = await browserDocument.fonts.load(`700 ${size}px "Cairo Video"`, sample);
        return faces.length > 0
          && faces.every((face) => face.status === "loaded")
          && browserDocument.fonts.check(`700 ${size}px "Cairo Video"`, sample);
      }, { sample: text, size: fontSize });
      if (!fontLoaded) throw new Error("Bundled Cairo font failed to load in Chromium");

      await page.screenshot({
        path: options.outputPath as `${string}.png`,
        type: "png",
        omitBackground: true,
        captureBeyondViewport: false,
      });
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    await browser?.close().catch(() => undefined);
  }
}