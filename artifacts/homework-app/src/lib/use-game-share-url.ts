import { useCallback, useEffect, useState } from "react";
import { createGameShareLink, publicShortUrl } from "@/lib/game-share-url";

export type GameShareUrlState =
  | { target: string; status: "idle" | "pending"; url: ""; error: "" }
  | { target: string; status: "ready"; url: string; error: "" }
  | { target: string; status: "error"; url: ""; error: string };

export function useGameShareUrl(target: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<GameShareUrlState>({ target, status: target ? "pending" : "idle", url: "", error: "" });
  useEffect(() => {
    let active = true;
    if (!target) {
      setState({ target, status: "idle", url: "", error: "" });
      return () => { active = false; };
    }
    setState({ target, status: "pending", url: "", error: "" });
    Promise.resolve().then(() => createGameShareLink(target)).then(result => {
      if (active) setState({ target, status: "ready", url: publicShortUrl(result.shortPath), error: "" });
    }).catch(error => {
      if (active) setState({ target, status: "error", url: "", error: error instanceof Error ? error.message : "Could not create a short game link" });
    });
    return () => { active = false; };
  }, [target, attempt]);

  const retry = useCallback(() => setAttempt(value => value + 1), []);
  // Ignore state for a previous target immediately, before the next effect runs.
  const current: GameShareUrlState = state.target === target
    ? state
    : target
      ? { target, status: "pending", url: "", error: "" }
      : { target, status: "idle", url: "", error: "" };
  return { ...current, retry };
}

export async function shareGameUrl(url: string, title: string, text?: string): Promise<void> {
  if (!url) throw new Error("A short game link is not ready");
  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ title, text, url });
    return;
  }
  if (!navigator.clipboard?.writeText) throw new Error("Sharing is not available in this browser");
  await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
}

/** noopener window.open returns null even for a successful popup. Prepare a
 * blank window synchronously instead, remove its opener and referrer, then
 * navigate; a null result now really means the popup was blocked. */
export function openGameShareWindow(destination: string): boolean {
  const url = new URL(destination);
  if (url.protocol !== "https:") throw new Error("Invalid sharing destination");
  const opened = window.open("about:blank", "_blank");
  if (!opened) return false;
  opened.opener = null;
  const policy = opened.document.createElement("meta");
  policy.name = "referrer";
  policy.content = "no-referrer";
  opened.document.head.appendChild(policy);
  opened.location.replace(url.toString());
  return true;
}