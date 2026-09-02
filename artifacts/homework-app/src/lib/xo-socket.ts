import { io, Socket } from "socket.io-client";

let xoSocket: Socket | null = null;

/** Shared socket for the XO namespace. */
export function getXoSocket(): Socket {
  if (!xoSocket) {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    xoSocket = io(`${window.location.origin}/xo`, {
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
  return xoSocket;
}

export function disconnectXoSocket() {
  xoSocket?.disconnect();
  xoSocket = null;
}