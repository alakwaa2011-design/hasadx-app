import { useEffect, useRef, useState } from "react";
import { getXoSocket } from "./xo-socket";

const STORAGE_KEY = "xo-prepared-room-v1";
export interface PreparedXoRoom {
  teacherId: number;
  draftKey: string;
  pin: string;
  token: string;
  playRoute: string;
  savedActivityId: number | string;
  expiresAt: number;
}

function restoreRoom(teacherId: number): PreparedXoRoom | null {
  try {
    const room = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    return room?.teacherId === teacherId
      && room.expiresAt > Date.now()
      && /^\d{6}$/.test(room.pin)
      && room.playRoute === `/game/xo/play/${room.pin}`
      && typeof room.draftKey === "string"
      && typeof room.token === "string"
      && room.savedActivityId != null
      && sessionStorage.getItem(`xo-control-${room.pin}`)
      ? room : null;
  } catch { return null; }
}

function reclaimRoom(room: PreparedXoRoom): Promise<void> {
  return new Promise((resolve, reject) => {
    getXoSocket().timeout(8000).emit("xo:reclaim-host", {
      pin: room.pin, controlToken: sessionStorage.getItem(`xo-control-${room.pin}`),
    }, (error: Error | null, result?: { success?: boolean; error?: string }) => {
      if (error) reject(new Error("xo-room-connection"));
      else if (!result?.success) reject(new Error("xo-room-expired"));
      else resolve();
    });
  });
}

/** Copying and entering share one room, including after a setup-page reload. */
export function useXoPreparedRoom(
  teacherId: number | undefined,
  draftKey: string,
  save: () => Promise<{ token: string; savedActivityId: number | string }>,
) {
  const [room, setRoom] = useState<PreparedXoRoom | null>(null);
  const roomRef = useRef<PreparedXoRoom | null>(null);
  const pending = useRef<Promise<PreparedXoRoom> | null>(null);
  const mounted = useRef(true);
  const owner = useRef(teacherId);
  owner.current = teacherId;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const restored = teacherId ? restoreRoom(teacherId) : null;
    roomRef.current = restored;
    setRoom(restored);
  }, [teacherId]);

  const prepare = (): Promise<PreparedXoRoom> => {
    if (pending.current) return pending.current;
    const operation = (async () => {
      if (!teacherId) throw new Error("xo-room-login");
      const existing = roomRef.current;
      if (existing?.teacherId === teacherId && existing.draftKey === draftKey) {
        try {
          if (existing.expiresAt <= Date.now()) throw new Error("xo-room-expired");
          await reclaimRoom(existing);
          if (!mounted.current || owner.current !== teacherId) throw new Error("xo-room-cancelled");
          return existing;
        } catch (error) {
          if (owner.current === teacherId && error instanceof Error && error.message === "xo-room-expired") {
            roomRef.current = null;
            sessionStorage.removeItem(STORAGE_KEY);
            if (mounted.current) setRoom(null);
          }
          throw error; // Never replace a distributed link silently.
        }
      }
      const saved = await save();
      if (!mounted.current || owner.current !== teacherId) throw new Error("xo-room-cancelled");
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/play/${encodeURIComponent(saved.token)}/start`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "xo-room-create");
      if (!/^\d{6}$/.test(result.pin) || result.playRoute !== `/game/xo/play/${result.pin}` || !result.controlToken) {
        throw new Error("xo-room-create");
      }
      if (!mounted.current || owner.current !== teacherId) throw new Error("xo-room-cancelled");
      const prepared: PreparedXoRoom = {
        ...saved, teacherId, draftKey, pin: result.pin, playRoute: result.playRoute,
        expiresAt: Date.now() + 3 * 60 * 60 * 1000,
      };
      sessionStorage.setItem(`xo-control-${prepared.pin}`, String(result.controlToken));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prepared));
      roomRef.current = prepared;
      setRoom(prepared);
      return prepared;
    })();
    pending.current = operation;
    void operation.finally(() => {
      if (pending.current === operation) pending.current = null;
    }).catch(() => {});
    return operation;
  };
  return { room, prepare };
}