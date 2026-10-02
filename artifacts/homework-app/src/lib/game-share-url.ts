export interface GameShareLinkResponse {
  code: string;
  path: string;
  shortPath: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";
const createdLinks = new Map<string, Promise<GameShareLinkResponse>>();
const GAME_SHARE_PATH = /^\/(?:game|games|play|solo|solve|board|watch|video|kids)(?:\/|$)|^\/api\/(?:g|s|share)(?:\/|$)/;

/** Namespaces that may contain public game or game-adjacent destinations. */
export function isGameSharePath(pathname: string): boolean {
  try {
    return GAME_SHARE_PATH.test(decodeURI(pathname));
  } catch {
    return false;
  }
}

function appBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `/${base}`.replace(/\/+/g, "/").replace(/\/?$/, "/");
}

/**
 * Convert a game destination into a same-origin app path. Absolute URLs are
 * accepted for legacy callers only when they point at the current origin.
 */
export function canonicalGamePath(target: string, origin = typeof window !== "undefined" ? window.location.origin : "http://localhost"): string {
  const trimmed = target.trim();
  if (!trimmed) throw new Error("A game destination is required");
  const url = new URL(trimmed, origin);
  if (url.origin !== origin) throw new Error("Game share links must stay on this site");
  if (!url.pathname.startsWith("/")) throw new Error("Invalid game destination");
  const base = appBase();
  const pathname = base !== "/" && url.pathname.startsWith(base)
    ? `/${url.pathname.slice(base.length)}`
    : url.pathname;
  if (!isGameSharePath(pathname)) throw new Error("Only game destinations can be shortened");
  return `${pathname}${url.search}${url.hash}`;
}

export function publicShortUrl(shortPath: string, origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  if (!/^\/s\/[a-z2-7]{10}$/.test(shortPath)) throw new Error("Invalid game share link response");
  return `${origin}${appBase().replace(/\/$/, "")}${shortPath}`;
}

export function shareRedirectPath(code: string): string {
  if (!/^[a-z2-7]{10}$/.test(code)) throw new Error("Invalid game share code");
  return `${appBase()}api/game-share-links/${encodeURIComponent(code)}/redirect`;
}

export async function createGameShortUrl(target: string): Promise<string> {
  const result = await createGameShareLink(target);
  return publicShortUrl(result.shortPath);
}

/** Keep clipboard initiation in the click gesture on Safari/embedded browsers,
 * even when a previously unused short link still needs a network request. */
export async function copyGameShortUrl(target: string | Promise<string>): Promise<string> {
  const pending = typeof target === "string"
    ? createGameShortUrl(target)
    : target.then(createGameShortUrl);
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": pending.then(url => new Blob([url], { type: "text/plain" })),
      })]);
      return await pending;
    } catch {
      // A denied or unsupported rich clipboard can still use plain-text copy.
    }
  }
  const url = await pending;
  await copyGameShareText(url);
  return url;
}

export async function copyGameShareText(text: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
    await navigator.clipboard.writeText(text);
    return;
  } catch (error) {
    const previousFocus = document.activeElement;
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("aria-hidden", "true");
    input.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(input);
    input.select();
    try {
      if (typeof document.execCommand !== "function" || !document.execCommand("copy")) throw error;
    } finally {
      input.remove();
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    }
  }
}

/** The same canonical destination reuses the in-flight or resolved short URL. */
export function createGameShareLink(target: string): Promise<GameShareLinkResponse> {
  const path = canonicalGamePath(target);
  const existing = createdLinks.get(path);
  if (existing) return existing;
  const pending = (async () => {
    const response = await fetch(`${API_BASE}/api/game-share-links`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!response.ok) throw new Error(`Could not create a short game link (${response.status})`);
    const result = await response.json() as Partial<GameShareLinkResponse>;
    if (typeof result.code !== "string" || !/^[a-z2-7]{10}$/.test(result.code) || typeof result.path !== "string" || typeof result.shortPath !== "string") {
      throw new Error("The server returned an invalid game share link");
    }
    if (canonicalGamePath(result.path) !== path || result.shortPath !== `/s/${result.code}`) {
      throw new Error("The server returned a mismatched game share link");
    }
    return result as GameShareLinkResponse;
  })();
  createdLinks.set(path, pending);
  pending.catch(() => {
    if (createdLinks.get(path) === pending) createdLinks.delete(path);
  });
  return pending;
}

/** Test helper; deliberately not used by application UI. */
export function clearGameShareLinkCache(): void {
  createdLinks.clear();
}