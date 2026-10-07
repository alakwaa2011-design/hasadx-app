import { useEffect, useRef, useState } from "react";

export interface ParticipationDraft {
  text: string;
  columnId: string;
  color: string;
  tags: string;
  referenceUrl: string;
  imageId: string | null;
  /** Small local thumbnail only. Never persist signed media URLs or credentials. */
  thumbnail: string | null;
  clientId: string;
}

const temporaryDrafts = new Map<string, ParticipationDraft>();
export const draftKey = (boardId: string, actorId: string, postId?: string) =>
  `hasaad-collab-draft:v1:${encodeURIComponent(boardId)}:${encodeURIComponent(actorId)}:${encodeURIComponent(postId ?? "new")}`;

function validDraft(value: unknown): value is ParticipationDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as ParticipationDraft;
  return ["text", "columnId", "color", "tags", "referenceUrl", "clientId"].every(k => typeof d[k as keyof ParticipationDraft] === "string")
    && (d.imageId === null || typeof d.imageId === "string")
    && (d.thumbnail === null || (typeof d.thumbnail === "string" && /^data:image\/(?:png|jpeg|webp);base64,/.test(d.thumbnail)));
}

export function readDraft(key: string): { draft?: ParticipationDraft; persistent: boolean } {
  // A failed write can leave an older persistent copy. The latest in-page copy wins.
  const temporary = temporaryDrafts.get(key);
  try {
    const raw = localStorage.getItem(key);
    const stored: unknown = raw ? JSON.parse(raw) : null;
    const draft = temporary ?? (validDraft(stored) ? stored : undefined);
    return { draft, persistent: !!draft && raw === JSON.stringify(draft) };
  } catch {
    return { draft: temporary, persistent: false };
  }
}

export function writeDraft(key: string, draft: ParticipationDraft): boolean {
  temporaryDrafts.set(key, draft);
  try {
    const raw = JSON.stringify(draft);
    localStorage.setItem(key, raw);
    return localStorage.getItem(key) === raw;
  } catch {
    return false;
  }
}

export function removeDraft(key: string): boolean {
  try {
    localStorage.removeItem(key);
    const removed = localStorage.getItem(key) === null;
    if (removed) temporaryDrafts.delete(key);
    return removed;
  } catch {
    return false;
  }
}

export function useParticipationDraft(key: string, initial: ParticipationDraft) {
  const [loaded] = useState(() => readDraft(key));
  const [draft, setDraft] = useState(loaded.draft ?? initial);
  const current = useRef(draft);
  const [persistent, setPersistent] = useState(loaded.persistent);
  const [touched, setTouched] = useState(!!loaded.draft);
  const update = (patch: Partial<ParticipationDraft>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    // Write during the input event, not a deferred effect: dismissal/reload cannot race it.
    setPersistent(writeDraft(key, next));
    setTouched(true);
    setDraft(next);
    return next;
  };
  useEffect(() => {
    if (!touched || persistent) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [touched, persistent]);
  return { draft, update, persistent, touched, restored: !!loaded.draft, clear: () => removeDraft(key) };
}
