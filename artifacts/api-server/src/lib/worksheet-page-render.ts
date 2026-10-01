import type { Browser, BrowserContext, HTTPRequest, Page } from "puppeteer-core";
import {
  getWorksheetRenderBrowser,
  launchWorksheetRenderFallbackBrowser,
} from "./presentation-pdf";
import { logger } from "./logger";

const MAX_RENDER_CONCURRENCY = 2;
const RENDER_TIMEOUT_MS = 30_000;
const GOOGLE_FONTS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800&family=Amiri:wght@400;700&family=Noto+Naskh+Arabic:wght@400;500;700&family=Reem+Kufi:wght@400;500;700;800&family=Inter:wght@400;500;600;700;800&display=swap";

let activeRenders = 0;

export class WorksheetPageRenderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 422 | 429 | 503 | 504 = 422,
  ) {
    super(message);
    this.name = "WorksheetPageRenderError";
  }
}

/**
 * Only browser requests needed by the renderer are allowed. Check the raw
 * authority as well as URL fields: URL normalizes an explicit :443 away,
 * while even that explicitly supplied port is outside this allowlist.
 */
export function isAllowedWorksheetRenderRequest(
  urlValue: string,
  resourceType: string,
): boolean {
  if (urlValue.startsWith("data:")) {
    return ["image", "font", "stylesheet"].includes(resourceType);
  }
  if (!["stylesheet", "font"].includes(resourceType)) return false;

  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    return false;
  }
  const authority = /^https:\/\/([^/?#]*)/i.exec(urlValue)?.[1];
  if (!authority || authority.includes(":") || authority.includes("@")) return false;
  return (
    parsed.hostname === "fonts.googleapis.com" ||
    parsed.hostname === "fonts.gstatic.com"
  );
}

function abortRequest(request: HTTPRequest): Promise<void> {
  return request.abort("blockedbyclient").catch(() => undefined);
}

function continueRequest(request: HTTPRequest): Promise<void> {
  return request.continue().catch(() => undefined);
}

async function waitForPageResources(page: Page, stylesheetFailed: () => boolean): Promise<void> {
  await page.waitForFunction(
    `(() => {
      const stylesheet = document.getElementById("worksheet-fonts");
      return !!stylesheet && !!stylesheet.sheet;
    })()`,
    { timeout: 12_000 },
  ).catch(() => {
    if (stylesheetFailed()) {
      throw new WorksheetPageRenderError("Worksheet font stylesheet could not be loaded.");
    }
    throw new WorksheetPageRenderError("Worksheet font stylesheet timed out.");
  });

  await page.evaluate(`(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images);
    await Promise.all(images.map((image) => image.decode()));
  })()`).catch(() => {
    throw new WorksheetPageRenderError("A worksheet image or font could not be loaded.");
  });

  const resourceStatus = await page.evaluate(`(() => ({
    imageFailures: Array.from(document.images).some((image) => image.naturalWidth === 0),
    fontFailures: Array.from(document.fonts).some((font) => font.status === "error"),
  }))()`) as { imageFailures: boolean; fontFailures: boolean };
  if (resourceStatus.imageFailures) {
    throw new WorksheetPageRenderError("A worksheet image could not be loaded.");
  }
  if (resourceStatus.fontFailures) {
    throw new WorksheetPageRenderError("A worksheet font could not be loaded.");
  }
}

async function renderInIsolatedContext(
  html: string,
  width: number,
  height: number,
  signal: AbortSignal,
): Promise<Buffer> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let fallbackBrowserIsOwned = false;
  let abortCleanup: (() => void) | null = null;
  const blockedResourceErrors: string[] = [];
  let stylesheetFailed = false;
  let phase = "launch";
  try {
    try {
      browser = await getWorksheetRenderBrowser();
    } catch (error) {
      logger.warn(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Using dedicated screenshot-only Chromium fallback",
      );
    }
    if (signal.aborted) {
      throw new WorksheetPageRenderError("Worksheet page rendering timed out.", 504);
    }
    if (browser) {
      try {
        phase = "context";
        context = await browser.createBrowserContext();
        const activeContext = context;
        abortCleanup = () => {
          void activeContext.close().catch(() => undefined);
        };
        signal.addEventListener("abort", abortCleanup, { once: true });
        phase = "page";
        page = await context.newPage();
      } catch (error) {
        logger.warn(
          { errorName: error instanceof Error ? error.name : "UnknownError", phase },
          "Worksheet Chromium could not create an isolated page; using per-job fallback",
        );
        if (abortCleanup) signal.removeEventListener("abort", abortCleanup);
        abortCleanup = null;
        if (context) await context.close().catch(() => undefined);
        context = null;
        page = null;
        browser = null;
      }
    }
    if (!page) {
      if (signal.aborted) {
        throw new WorksheetPageRenderError("Worksheet page rendering timed out.", 504);
      }
      phase = "fallback-launch";
      browser = await launchWorksheetRenderFallbackBrowser();
      fallbackBrowserIsOwned = true;
      if (signal.aborted) {
        throw new WorksheetPageRenderError("Worksheet page rendering timed out.", 504);
      }
      const fallbackBrowser = browser;
      abortCleanup = () => {
        void fallbackBrowser.close().catch(() => undefined);
      };
      signal.addEventListener("abort", abortCleanup, { once: true });
      phase = "fallback-page";
      page = await browser.newPage();
    }
    phase = "configure";
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setRequestInterception(true);

    page.on("request", (request) => {
      const url = request.url();
      const type = request.resourceType();
      if (isAllowedWorksheetRenderRequest(url, type)) {
        void continueRequest(request);
      } else {
        if (["image", "font", "stylesheet"].includes(type)) {
          if (type === "stylesheet" && url === GOOGLE_FONTS_STYLESHEET) {
            stylesheetFailed = true;
          }
          blockedResourceErrors.push(type);
        }
        void abortRequest(request);
      }
    });
    page.on("requestfailed", (request) => {
      const type = request.resourceType();
      if (["image", "font", "stylesheet"].includes(type)) {
        if (type === "stylesheet" && request.url() === GOOGLE_FONTS_STYLESHEET) {
          stylesheetFailed = true;
        }
        blockedResourceErrors.push(type);
      }
    });

    const safeWidth = Math.floor(width);
    const safeHeight = Math.floor(height);
    phase = "load";
    await page.setContent(`<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src data:; font-src data: https://fonts.gstatic.com; style-src 'unsafe-inline' data: https://fonts.googleapis.com; object-src 'none'; media-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
<link id="worksheet-fonts" rel="stylesheet" href="${GOOGLE_FONTS_STYLESHEET}">
<style>
  html, body { margin: 0; padding: 0; width: ${safeWidth}px; height: ${safeHeight}px; overflow: hidden; }
  body { position: relative; }
  #worksheet-page { width: ${safeWidth}px !important; height: ${safeHeight}px !important; box-sizing: border-box !important; overflow: hidden !important; position: relative !important; }
</style>
</head><body><article id="worksheet-page">${html}</article></body></html>`, {
      waitUntil: "networkidle0",
      timeout: 18_000,
    });

    phase = "resources";
    await waitForPageResources(page, () => stylesheetFailed);
    if (blockedResourceErrors.length > 0) {
      throw new WorksheetPageRenderError("A worksheet image, font, or stylesheet used a blocked resource.");
    }
    phase = "screenshot";
    const article = await page.$("#worksheet-page");
    if (!article) {
      throw new WorksheetPageRenderError("Worksheet page content could not be rendered.");
    }
    const image = await article.screenshot({ type: "png", captureBeyondViewport: false });
    return Buffer.from(image);
  } catch (error) {
    if (!(error instanceof WorksheetPageRenderError)) {
      logger.error(
        {
          errorName: error instanceof Error ? error.name : "UnknownError",
          phase,
        },
        "Worksheet renderer browser operation failed",
      );
    }
    if (error instanceof Error && /timeout/i.test(error.name)) {
      throw new WorksheetPageRenderError("Worksheet page rendering timed out.", 504);
    }
    throw error;
  } finally {
    if (abortCleanup) signal.removeEventListener("abort", abortCleanup);
    if (page) await page.close().catch(() => undefined);
    if (context) await context.close().catch(() => undefined);
    if (fallbackBrowserIsOwned && browser) await browser.close().catch(() => undefined);
  }
}

export async function renderWorksheetPage(
  html: string,
  width: number,
  height: number,
): Promise<Buffer> {
  if (activeRenders >= MAX_RENDER_CONCURRENCY) {
    throw new WorksheetPageRenderError("Worksheet page renderer is busy. Try again shortly.", 429);
  }
  activeRenders += 1;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const renderTask = renderInIsolatedContext(html, width, height, controller.signal)
    .finally(() => {
      activeRenders -= 1;
    });
  try {
    return await Promise.race([
      renderTask,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new WorksheetPageRenderError("Worksheet page rendering timed out.", 504));
        }, RENDER_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (error instanceof WorksheetPageRenderError) throw error;
    throw new WorksheetPageRenderError("Worksheet page rendering failed.", 503);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}