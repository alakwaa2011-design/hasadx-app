import { io, Socket } from "socket.io-client";

let hotseatSocket: Socket | null = null;

export function getHotSeatSocket(): Socket {
  // Only create a new socket if none exists yet.
  // Never recreate based on .connected status — let the built-in
  // auto-reconnect logic handle temporary disconnections.
  if (!hotseatSocket) {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    hotseatSocket = io(`${baseUrl}/hotseat`, {
      path: `${basePath}/api/socket.io`.replace(/\/\//g, "/"),
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 30000,
      forceNew: false,
    });
  }
  return hotseatSocket;
}

export function disconnectHotSeatSocket() {
  if (hotseatSocket) {
    hotseatSocket.disconnect();
    hotseatSocket = null;
  }
}
