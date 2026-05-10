/**
 * Short-lived signed join tokens for presentation live sessions.
 *
 * The PIN-gated REST endpoint `/api/p/sessions/by-pin` mints a token
 * bound to (sessionId, studentKey). Socket joins (`student:join`)
 * and the public `/state` endpoint require a matching token, so a
 * caller cannot join or observe a session by guessing a numeric
 * `sessionId` — they must have proven possession of the PIN once
 * via the rate-limited REST endpoint.
 *
 * Tokens last 6 hours, easily covering a class period plus reconnects.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 6 * 60 * 60 * 1000;
const SECRET = process.env.SESSION_SECRET ?? "";

interface Payload {
  sid: number;
  /** First 16 chars of studentKey — enough to bind the token without
   *  bloating the URL. The handler still verifies the full studentKey
   *  payload separately when persisting answers. */
  k: string;
  /** Stable class roster student id when the joiner picked themselves
   *  off the roster in class-mode. Omitted for guest-mode joins. */
  c?: number;
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

export function mintPresentationJoinToken(
  sessionId: number,
  studentKey: string,
  classStudentId?: number | null,
): string {
  if (!SECRET) throw new Error("SESSION_SECRET not configured");
  const payload: Payload = { sid: sessionId, k: studentKey.slice(0, 16), exp: Date.now() + TTL_MS };
  if (classStudentId != null && Number.isFinite(classStudentId)) payload.c = classStudentId;
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyPresentationJoinToken(
  token: string,
  sessionId: number,
  studentKey?: string,
): { sid: number; k: string; c?: number } | null {
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
  if (payload.sid !== sessionId) return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (studentKey && payload.k !== studentKey.slice(0, 16)) return null;
  return { sid: payload.sid, k: payload.k, c: payload.c };
}
