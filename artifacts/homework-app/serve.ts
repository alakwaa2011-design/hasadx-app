/**
 * serve.ts — production static-file server for the homework-app SPA.
 * Pure Node.js built-ins only — no extra dependencies.
 *
 * Serving order:
 *   1. Exact static file in dist/public  (assets, images, sw.js, manifest…)
 *   2. Pre-rendered route file           (dist/public/<path>/index.html)
 *   3. SPA shell fallback               (dist/public/index.html)
 *
 * Pre-rendered files give bots (GPTBot, ClaudeBot, OAI-SearchBot, Perplexity)
 * rich Arabic HTML without needing JavaScript.  Regular browsers get React.
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "dist/public");
const SPA_SHELL = path.join(DIST, "index.html");
const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;

if (!fs.existsSync(DIST)) {
  console.error(`[serve] ERROR: ${DIST} not found. Run 'pnpm run build' first.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// MIME type map
// ---------------------------------------------------------------------------
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".gif":  "image/gif",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".otf":  "font/otf",
  ".txt":  "text/plain",
  ".xml":  "application/xml",
  ".webmanifest": "application/manifest+json",
};

function mime(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Cache headers
// ---------------------------------------------------------------------------
function cacheHeader(filePath: string): string {
  if (filePath.endsWith(".html")) return "no-cache";
  // Content-hashed assets can be cached forever
  if (filePath.includes("/assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}

// ---------------------------------------------------------------------------
// Send file helper
// ---------------------------------------------------------------------------
function sendFile(
  res: http.ServerResponse,
  filePath: string,
  _req: http.IncomingMessage,
): void {
  res.setHeader("Content-Type", mime(filePath));
  res.setHeader("Cache-Control", cacheHeader(filePath));
  // No manual gzip: Replit's reverse proxy handles Content-Encoding
  // automatically. Double-compressing (proxy + server) corrupts JS/CSS
  // and prevents React from mounting.
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // Guard against malformed percent-encoded paths (e.g. /%GG).
  // decodeURIComponent throws URIError on invalid sequences; return 400.
  let rawPath: string;
  try {
    rawPath = decodeURIComponent(url.pathname.replace(/\/+$/, "")) || "/";
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad Request: invalid URI encoding");
    return;
  }

  // Security: reject path traversal
  const candidateBase = path.resolve(DIST, rawPath.replace(/^\//, ""));
  if (!candidateBase.startsWith(DIST)) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  // 1. Exact static file?
  const staticPath = path.join(DIST, rawPath);
  if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
    sendFile(res, staticPath, req);
    return;
  }

  // 2. Asset-like request with a file extension → 404 (do NOT fall through
  //    to the SPA shell for missing JS/CSS/images; serving HTML as JS would
  //    break the app and hide deployment/asset failures).
  const ext = path.extname(rawPath);
  if (ext && ext !== ".html") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  // 3. Pre-rendered route? (dist/public/<path>/index.html)
  if (rawPath !== "/") {
    const prerendered = path.join(DIST, rawPath, "index.html");
    if (fs.existsSync(prerendered)) {
      sendFile(res, prerendered, req);
      return;
    }
  }

  // 4. SPA shell fallback — let React Router handle unknown app routes.
  sendFile(res, SPA_SHELL, req);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[serve] hasad-app on port ${PORT} → ${DIST}`);
});
