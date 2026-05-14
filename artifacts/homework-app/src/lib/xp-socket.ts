import { io, type Socket } from "socket.io-client";

let xpSocket: Socket | null = null;

export interface XpEventPayload {
  delta: number;
  totalXp?: number;
  level?: number;
  leveledUp?: boolean;
  newBadgeKeys: string[];
  newGrantIds: number[];
}

export function getXpSocket(): Socket {
  if (!xpSocket) {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    xpSocket = io(baseUrl, {
      path: `${basePath}/api/socket.io`.replace(/\/\//g, "/"),
      transports: ["polling", "websocket"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
      timeout: 25000,
    });
  }
  return xpSocket;
}
