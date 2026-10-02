import { randomBytes } from "node:crypto";

const INTERNAL_ORIGIN = "https://game-share.invalid";
export const GAME_SHARE_CODE = /^[a-z2-7]{10}$/;

/** Preserve encoded names, duplicate query parameters and fragments verbatim.
 * Allow public game namespaces, not arbitrary sites, auth or teacher pages.
 * New games inside these namespaces inherit shortening without a type switch.
 */
export function normalizeGameSharePath(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 8192 ||
      !input.startsWith("/") || input.startsWith("//") ||
      /[\u0000-\u001f\u007f\\]/.test(input)) return null;
  try {
    const url = new URL(input, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN || url.username || url.password) return null;
    const decodedPath = decodeURI(url.pathname);
    if (!/^\/(?:game|games|play|solo|solve|board|watch|video|kids)(?:\/|$)/.test(decodedPath) &&
        !/^\/api\/(?:g|s|share)(?:\/|$)/.test(decodedPath)) return null;
    const destination = url.pathname + url.search + url.hash;
    return destination.length <= 8192 ? destination : null;
  } catch {
    return null;
  }
}

export function generateGameShareCode(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  return Array.from(randomBytes(10), byte => alphabet[byte & 31]).join("");
}