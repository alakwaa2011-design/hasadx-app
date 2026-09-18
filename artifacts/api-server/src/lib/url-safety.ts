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
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage, RequestOptions } from "node:http";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 2_000;
const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.google",
  "instance-data.ec2.internal",
]);

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
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && parts[2] === 2) return true; // documentation
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && parts[2] === 100))) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true; // documentation
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast, reserved, and broadcast
  return false;
}

function ipv6ToBigInt(ip: string): bigint | null {
  const value = ip.toLowerCase().split("%", 1)[0];
  const pieces = value.split("::");
  if (pieces.length > 2) return null;
  const left = pieces[0] ? pieces[0].split(":") : [];
  const right = pieces.length === 2 && pieces[1] ? pieces[1].split(":") : [];
  // An IPv4 suffix occupies two IPv6 words.
  const expand = (part: string[]): number[] => {
    const out: number[] = [];
    for (const word of part) {
      if (word.includes(".")) {
        const octets = word.split(".").map(Number);
        if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return [];
        out.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[\da-f]{1,4}$/i.test(word)) return [];
        out.push(parseInt(word, 16));
      }
    }
    return out;
  };
  const l = expand(left);
  const r = expand(right);
  if (!l.length && left.length) return null;
  if (!r.length && right.length) return null;
  const words = pieces.length === 2 ? [...l, ...Array(8 - l.length - r.length).fill(0), ...r] : [...l, ...r];
  if (words.length !== 8) return null;
  return words.reduce((n, word) => (n << 16n) | BigInt(word), 0n);
}

function isPrivateIPv6(ip: string): boolean {
  const n = ipv6ToBigInt(ip);
  if (n === null) return true;
  const prefix = (bits: number) => n >> BigInt(128 - bits);
  // unspecified, loopback, IPv4-mapped, unique-local, link-local,
  // multicast, documentation, and other reserved/special-purpose ranges.
  if (n === 0n || n === 1n || prefix(7) >= 126n || prefix(8) === 0xffn) return true;
  if (prefix(10) === 0x3f0n || prefix(10) === 0x3f4n || prefix(10) === 0x3fan) return true;
  if (prefix(32) === 0x20010db8n || prefix(96) === 0xffffn) {
    if (prefix(96) === 0xffffn) {
      const v4 = Number(n & 0xffffffffn);
      return isPrivateIPv4([v4 >>> 24, (v4 >>> 16) & 255, (v4 >>> 8) & 255, v4 & 255].join("."));
    }
    return true;
  }
  // 2001:0000::/32 (Teredo), 2001:2::/48, 2001:db8::/32 and
  // 2001:10::/28 are not globally routable destinations.
  if (prefix(32) === 0x20010000n || prefix(48) === 0x200100000002n || prefix(28) === 0x2001001n) return true;
  return false;
}
function isPrivateIP(ip: string): boolean {
  return isIP(ip) === 6 ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

async function isHostSafe(hostname: string): Promise<boolean> {
  return (await safeHostAddresses(hostname)) !== null;
}

async function safeHostAddresses(hostname: string): Promise<Array<{ address: string; family: number }> | null> {
  // WHATWG URL.hostname retains brackets for IPv6 literals; net.isIP and
  // the range checks expect the unbracketed address.
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost") ||
      METADATA_HOSTS.has(normalized) || normalized.endsWith(".metadata.google.internal")) return null;
  if (isIP(normalized)) return isPrivateIP(normalized) ? null : [{ address: normalized, family: isIP(normalized) }];
  try {
    const records = await lookup(normalized, { all: true });
    if (records.length === 0 || records.some((r) => isPrivateIP(r.address))) return null;
    return records.map((r) => ({ address: r.address, family: r.family }));
  } catch {
    return null;
  }
}

/** Validate a URL before making a server-side request. */
export async function validateSafeUrl(rawUrl: string): Promise<URL | null> {
  if (typeof rawUrl !== "string" || rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) return null;
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return null; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.username || parsed.password || !(await isHostSafe(parsed.hostname))) return null;
  return parsed;
}

function requestPinned(url: URL, target: { address: string; family: number }, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
      // Keep the original name for Host/SNI and certificate verification.
      servername: url.hostname.replace(/^\[|\]$/g, ""),
    } as RequestOptions;
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(url, requestOptions, resolve);
    req.once("error", reject);
    signal.addEventListener("abort", () => req.destroy(new Error("timeout")), { once: true });
    req.end();
  });
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
  let currentUrl = await validateSafeUrl(rawUrl);
  if (!currentUrl) return null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const targets = await safeHostAddresses(currentUrl.hostname);
    if (!targets || targets.length === 0) return null;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: IncomingMessage;
    try {
      const pending = requestPinned(currentUrl, targets[0], ctrl.signal);
      res = await Promise.race([
        pending,
        new Promise<never>((_, reject) => ctrl.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true })),
      ]);
    } catch {
      clearTimeout(t);
      return null;
    }
    /* Manual redirect handling — re-validate the next hop. */
    if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400) {
      clearTimeout(t);
      const loc = res.headers.location;
      if (!loc) return null;
      let next: URL;
      try { next = new URL(Array.isArray(loc) ? loc[0] : loc, currentUrl); } catch { return null; }
      currentUrl = next;
      continue;
    }
    if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) {
      clearTimeout(t);
      return null;
    }

    const ct = typeof res.headers["content-type"] === "string"
      ? res.headers["content-type"] : "application/octet-stream";
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for await (const chunk of res) {
      total += chunk.length;
      if (total > MAX_BYTES) {
        res.destroy();
        clearTimeout(t);
        return null;
      }
      chunks.push(chunk);
      }
    } catch {
      clearTimeout(t);
      return null;
    }
    clearTimeout(t);
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

export async function safeFetchText(rawUrl: string, maxBytes = 64 * 1024): Promise<string | null> {
  const result = await safeFetchHttp(rawUrl);
  if (!result || result.body.byteLength > maxBytes) return null;
  return result.body.toString("utf8");
}

export async function safeFetchAsDataUri(rawUrl: string): Promise<string | null> {
  if (rawUrl.startsWith("data:")) return rawUrl;
  const r = await safeFetchAsset(rawUrl);
  if (!r) return null;
  return `data:${r.contentType};base64,${r.body.toString("base64")}`;
}
