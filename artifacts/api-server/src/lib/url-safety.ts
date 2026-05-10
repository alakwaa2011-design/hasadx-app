/**
 * SSRF guard for server-side fetches of teacher-supplied URLs.
 *
 * Used by the PPTX builder (image embedding) and the PDF builder
 * (background fetch). The URLs themselves are user-controlled, so
 * without this guard a teacher could probe internal AWS metadata,
 * DB ports, or other services on the Replit container's network.
 *
 * Hardened against redirect-based bypasses: we follow redirects
 * manually and re-validate every hop's hostname/IP before issuing
 * the next request.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + AWS metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true;
  return false;
}
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80")) return true;
  if (lower.startsWith("::ffff:")) return isPrivateIPv4(lower.slice(7));
  return false;
}
function isPrivateIP(ip: string): boolean {
  return isIP(ip) === 6 ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

async function isHostSafe(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return !isPrivateIP(hostname);
  try {
    const records = await lookup(hostname, { all: true });
    if (records.length === 0) return false;
    return records.every((r) => !isPrivateIP(r.address));
  } catch {
    return false;
  }
}

export interface SafeFetchResult {
  body: Buffer;
  contentType: string;
}

/**
 * Manual redirect-following fetch with per-hop URL validation.
 * Returns null on any failure (private host at any hop, oversized
 * response, timeout, redirect loop, non-2xx, etc.).
 */
async function safeFetchHttp(rawUrl: string): Promise<SafeFetchResult | null> {
  let currentUrl: URL;
  try { currentUrl = new URL(rawUrl); } catch { return null; }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (currentUrl.protocol !== "https:" && currentUrl.protocol !== "http:") return null;
    if (!(await isHostSafe(currentUrl.hostname))) return null;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(currentUrl.toString(), {
        signal: ctrl.signal,
        redirect: "manual",
      });
    } catch {
      clearTimeout(t);
      return null;
    }
    clearTimeout(t);

    /* Manual redirect handling — re-validate the next hop. */
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      let next: URL;
      try { next = new URL(loc, currentUrl); } catch { return null; }
      currentUrl = next;
      continue;
    }
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") ?? "application/octet-stream";
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      total += step.value.byteLength;
      if (total > MAX_BYTES) {
        try { await reader.cancel(); } catch { /* ignore */ }
        return null;
      }
      chunks.push(step.value);
    }
    return { body: Buffer.concat(chunks), contentType: ct };
  }
  return null; // exceeded MAX_REDIRECTS
}

export async function safeFetchAsset(rawUrl: string): Promise<SafeFetchResult | null> {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > 2000) return null;
  if (rawUrl.startsWith("data:")) {
    const m = /^data:([^;,]+)(?:;base64)?,(.*)$/i.exec(rawUrl);
    if (!m) return null;
    try {
      const body = Buffer.from(m[2], "base64");
      if (body.byteLength > MAX_BYTES) return null;
      return { body, contentType: m[1] };
    } catch { return null; }
  }
  return safeFetchHttp(rawUrl);
}

export async function safeFetchAsDataUri(rawUrl: string): Promise<string | null> {
  if (rawUrl.startsWith("data:")) return rawUrl;
  const r = await safeFetchAsset(rawUrl);
  if (!r) return null;
  return `data:${r.contentType};base64,${r.body.toString("base64")}`;
}
