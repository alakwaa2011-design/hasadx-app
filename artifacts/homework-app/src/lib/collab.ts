import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCollaborationBoard,
  getGetCollaborationBoardQueryKey,
  getListCollaborationBoardsQueryKey,
  useUpdateCollaborationBoard,
  useGetCurrentTeacher,
  getGetCurrentTeacherQueryKey,
  type CollaborationAction,
  type CollaborationView,
  type CollaborationSettings,
  type CollaborationColumn,
} from "@workspace/api-client-react";

export const API_BASE = import.meta.env.VITE_API_URL || "";

export interface CollabSession {
  token: string;
  participantId: string;
  name: string;
}
const key = (id: string) => `hasaad-collab:${id}`;
export function loadSession(id: string): CollabSession | null {
  try {
    const raw = localStorage.getItem(key(id));
    const value = raw ? JSON.parse(raw) as CollabSession : null;
    return value && /^[a-f0-9]{64}$/.test(value.token) && typeof value.participantId === "string"
      && typeof value.name === "string" ? value : null;
  } catch {
    return null;
  }
}
export function saveSession(id: string, s: CollabSession) {
  try {
    localStorage.setItem(key(id), JSON.stringify(s));
  } catch {
    throw new Error("تعذر حفظ هوية المشاركة على هذا الجهاز. اسمح بالتخزين في المتصفح ثم حاول مجددًا.");
  }
}
export function clearSession(id: string) {
  try {
    localStorage.removeItem(key(id));
  } catch {
    /* ignore */
  }
}
export function authHeaders(id: string): Record<string, string> {
  const s = loadSession(id);
  return s ? { "X-Collaboration-Token": s.token } : {};
}
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}
export function errMessage(e: unknown): string {
  const x = e as { status?: number; data?: { error?: string; message?: string }; message?: string } | null;
  if (x?.status === 0 || (e instanceof TypeError)) return "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.";
  return x?.data?.error || x?.data?.message || x?.message || "حدث خطأ غير متوقع";
}
export function errStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status;
}
export function mediaUrl(u?: string | null) {
  if (!u) return "";
  return /^https?:/.test(u) ? u : `${API_BASE}${u}`;
}
export function safeLink(u?: string | null) {
  if (!u) return null;
  try {
    const x = new URL(u);
    return x.protocol === "https:" ? x.toString() : null;
  } catch {
    return null;
  }
}

export const DEFAULT_SETTINGS: CollaborationSettings = {
  moderation: true,
  allowComments: true,
  allowImages: true,
  allowReactions: true,
  showNames: false,
  silent: false,
  revealed: false,
  maxPosts: 3,
  voteBudget: 3,
};
export const DEFAULT_COLUMNS: CollaborationColumn[] = [{ id: "main", title: "الأفكار" }];

export const COLORS: Record<string, { bg: string; bar: string; label: string }> = {
  mint: { bg: "#e3f1e8", bar: "#468064", label: "نعناعي" },
  sand: { bg: "#f5ecd3", bar: "#C9A050", label: "رملي" },
  sky: { bg: "#dcebf5", bar: "#4d86ad", label: "سماوي" },
  rose: { bg: "#f6e1e0", bar: "#c0706c", label: "وردي" },
  lavender: { bg: "#e9e3f4", bar: "#8a76b5", label: "بنفسجي" },
};

export function useBoard(id: string) {
  const { data: teacher } = useGetCurrentTeacher({ query: { queryKey: getGetCurrentTeacherQueryKey(), retry: false } });
  const session = loadSession(id);
  const scopedKey = [...getGetCollaborationBoardQueryKey(id), teacher?.id ?? "anonymous", session?.participantId ?? "owner"];
  const q = useGetCollaborationBoard(id, {
    query: {
      queryKey: scopedKey,
      enabled: !!id,
      refetchInterval: 2500,
      retry: false,
      structuralSharing: (oldData, newData) => {
        const old = oldData as CollaborationView | undefined, fresh = newData as CollaborationView;
        return old && old.revision > fresh.revision ? old : fresh;
      },
    },
    request: { headers: authHeaders(id) },
  });
  return q;
}

export function useAct(id: string) {
  const qc = useQueryClient();
  return useUpdateCollaborationBoard({
    mutation: {
      onSuccess: (view: CollaborationView) => {
        qc.setQueriesData<CollaborationView>({ queryKey: getGetCollaborationBoardQueryKey(id) }, old =>
          !old || old.selfId !== view.selfId ? old : old.revision > view.revision ? old : view);
        qc.invalidateQueries({ queryKey: getGetCollaborationBoardQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListCollaborationBoardsQueryKey() });
      },
    },
    request: { headers: authHeaders(id) },
  });
}
export type { CollaborationAction };

export function useCountdown(endsAt: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}
export function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function useOnline() {
  const [on, setOn] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener("online", a);
    window.addEventListener("offline", b);
    return () => {
      window.removeEventListener("online", a);
      window.removeEventListener("offline", b);
    };
  }, []);
  return on;
}

function csvCell(v: string) {
  let s = v.replace(/\r?\n/g, " ");
  if (/^\s*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
export function exportCsv(b: CollaborationView) {
  const col = (id: string) => b.columns.find((c) => c.id === id)?.title ?? "";
  const rows = [["العمود", "الكاتب", "النص", "الوسوم", "الرابط", "الحالة", "التفاعلات", "التعليقات"]];
  for (const p of b.posts) {
    rows.push([
      col(p.columnId),
      p.teacher ? "المعلم" : p.authorName,
      p.text,
      p.tags.join("، "),
      p.referenceUrl ?? "",
      p.hidden ? "مخفي" : p.status === "pending" ? "بانتظار الموافقة" : "معتمد",
      p.reactions.filter((r) => r.count).map((r) => `${r.kind}:${r.count}`).join(" "),
      p.comments.map((c) => `${c.authorName}: ${c.text}`).join(" | "),
    ]);
  }
  const csv = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `hasaad-board-${b.pin}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
