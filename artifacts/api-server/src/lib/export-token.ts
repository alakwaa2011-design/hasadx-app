/**
 * Short-lived signed export tokens. The PDF export flow needs the
 * homework-app's print page to render the deck under puppeteer,
 * but puppeteer has no teacher session cookie. Instead of granting
 * it a session, we mint an HMAC-signed token bound to (presentationId,
 * teacherId, expiresAt) and accept it on a single tokenized read
 * endpoint. Tokens are valid for 60 seconds.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 60_000;
const SECRET = process.env.SESSION_SECRET ?? "";

interface Payload {
  pid: number;
  tid: number;
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}
function sign(data: string): string {
  return b64url(createHmac("sha256", SECRET).update(data).digest());
}

export function mintExportToken(presentationId: number, teacherId: number): string {
  if (!SECRET) throw new Error("SESSION_SECRET not configured");
  const payload: Payload = { pid: presentationId, tid: teacherId, exp: Date.now() + TTL_MS };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyExportToken(token: string, presentationId: number): { teacherId: number } | null {
  if (!SECRET || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: Payload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as Payload;
  } catch { return null; }
  if (payload.pid !== presentationId) return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return { teacherId: payload.tid };
}
