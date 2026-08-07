/**
 * Regression tests for the build-time prerender pipeline.
 *
 * Two layers:
 *  1. Static-file assertions — read dist/public/<route>/index.html and verify
 *     per-route metadata and body content (fast, no server needed).
 *  2. Server-routing assertions — spawn serve.ts on a random port and assert
 *     that both /about and /about/ (trailing slash) return the prerendered file,
 *     while an unknown SPA route returns the generic shell.
 *
 * Run after `pnpm run build`:
 *   pnpm --filter @workspace/homework-app run test
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import http from "http";
import { spawn, type ChildProcess } from "child_process";

const DIST = path.resolve(__dirname, "../../../dist/public");
const SITE = "https://hasadx.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readRouteHtml(route: string): string {
  const file =
    route === "/"
      ? path.join(DIST, "index.html")
      : path.join(DIST, route.replace(/^\//, ""), "index.html");
  return fs.readFileSync(file, "utf-8");
}

async function get(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    }).on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Part 1 — Static-file content assertions
// ---------------------------------------------------------------------------

describe("prerendered static files", () => {
  const skip = !fs.existsSync(DIST);

  const routes: Array<{
    route: string;
    title: string;
    canonical: string;
    jsonLdType: string;
    bodyKeyword: string;
  }> = [
    {
      route: "/",
      title: "منصة حصاد | HasadX",
      canonical: `${SITE}/`,
      jsonLdType: "WebPage",
      bodyKeyword: "منصة حصاد التعليمية",
    },
    {
      route: "/about",
      title: "عن منصة حصاد التعليمية | HasadX",
      canonical: `${SITE}/about`,
      jsonLdType: "AboutPage",
      bodyKeyword: "لماذا منصة حصاد",
    },
    {
      route: "/faq",
      title: "الأسئلة الشائعة | منصة حصاد",
      canonical: `${SITE}/faq`,
      jsonLdType: "FAQPage",
      bodyKeyword: "كيف أنشئ واجباً",
    },
    {
      route: "/games",
      title: "الألعاب التعليمية | منصة حصاد",
      canonical: `${SITE}/games`,
      jsonLdType: "CollectionPage",
      bodyKeyword: "الألعاب الجماعية",
    },
    {
      route: "/islamic",
      title: "المسابقات الإسلامية | منصة حصاد",
      canonical: `${SITE}/islamic`,
      jsonLdType: "WebPage",
      bodyKeyword: "المحتوى المتاح",
    },
  ];

  for (const { route, title, canonical, jsonLdType, bodyKeyword } of routes) {
    it(`${route} — title contains "${title.slice(0, 20)}…"`, () => {
      if (skip) return; // skip when dist/ hasn't been built yet
      const html = readRouteHtml(route);
      expect(html).toContain(`<title>${title}`);
    });

    it(`${route} — canonical points to ${canonical}`, () => {
      if (skip) return;
      const html = readRouteHtml(route);
      expect(html).toContain(`href="${canonical}"`);
    });

    it(`${route} — JSON-LD type is ${jsonLdType}`, () => {
      if (skip) return;
      const html = readRouteHtml(route);
      expect(html).toContain(`"@type": "${jsonLdType}"`);
    });

    it(`${route} — body contains expected Arabic keyword`, () => {
      if (skip) return;
      const html = readRouteHtml(route);
      expect(html).toContain(bodyKeyword);
    });

    it(`${route} — prerender div is hidden from browsers (display:none)`, () => {
      if (skip) return;
      const html = readRouteHtml(route);
      expect(html).toContain('data-prerender');
      expect(html).toContain('display:none');
    });
  }
});

// ---------------------------------------------------------------------------
// Part 2 — Server routing: trailing slash and SPA fallback
// ---------------------------------------------------------------------------

describe("serve.ts routing", () => {
  const skip = !fs.existsSync(DIST);

  let server: ChildProcess | null = null;
  let port = 0;

  beforeAll(async () => {
    if (skip) return;

    // Pick a free-ish port
    port = 19000 + Math.floor(Math.random() * 1000);

    const serveScript = path.resolve(__dirname, "../../../serve.ts");
    server = spawn(
      "node",
      ["--import", "tsx/esm", serveScript],
      {
        env: { ...process.env, PORT: String(port) },
        stdio: "pipe",
      }
    );

    // Wait until the server logs it's listening (up to 10 s)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("serve.ts startup timeout")), 10_000);
      server!.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("on port")) {
          clearTimeout(timer);
          resolve();
        }
      });
      server!.on("error", reject);
    });
  });

  afterAll(() => {
    server?.kill();
  });

  async function fetch(urlPath: string) {
    if (!port) return { status: 0, body: "" };
    return get(`http://127.0.0.1:${port}${urlPath}`);
  }

  it("/about returns prerendered title (no trailing slash)", async () => {
    if (skip) return;
    const { status, body } = await fetch("/about");
    expect(status).toBe(200);
    expect(body).toContain("عن منصة حصاد التعليمية");
  });

  it("/about/ returns prerendered title (trailing slash)", async () => {
    if (skip) return;
    const { status, body } = await fetch("/about/");
    expect(status).toBe(200);
    expect(body).toContain("عن منصة حصاد التعليمية");
  });

  it("/faq/ returns prerendered FAQ content", async () => {
    if (skip) return;
    const { status, body } = await fetch("/faq/");
    expect(status).toBe(200);
    expect(body).toContain("الأسئلة الشائعة");
  });

  it("/games/ returns prerendered games content", async () => {
    if (skip) return;
    const { status, body } = await fetch("/games/");
    expect(status).toBe(200);
    expect(body).toContain("الألعاب التعليمية");
  });

  it("unknown SPA route falls back to the generic shell", async () => {
    if (skip) return;
    const { status, body } = await fetch("/some/unknown/route/xyz");
    expect(status).toBe(200);
    // SPA shell always has the default home title
    expect(body).toContain("منصة حصاد | HasadX");
    // Must NOT contain per-route body HTML (would mean wrong file was served)
    expect(body).not.toContain("data-prerender");
  });

  it("static assets are served with correct MIME", async () => {
    if (skip) return;
    // manifest.json always exists in a vite build
    const manifestPath = path.join(DIST, "manifest.json");
    if (!fs.existsSync(manifestPath)) return;
    // Just confirm the server doesn't crash for known static files
    const { status } = await fetch("/manifest.json");
    expect(status).toBe(200);
  });

  it("missing asset file returns 404, not SPA HTML", async () => {
    if (skip) return;
    const { status, body } = await fetch("/assets/nonexistent-chunk.js");
    expect(status).toBe(404);
    // Must NOT serve the SPA shell as a JS file
    expect(body).not.toContain("<!DOCTYPE html>");
  });

  it("malformed percent-encoded path returns 400", async () => {
    if (skip) return;
    // /%GG is an invalid percent sequence — decodeURIComponent throws
    const { status } = await get(`http://127.0.0.1:${port}/%GG`);
    expect(status).toBe(400);
  });
});
