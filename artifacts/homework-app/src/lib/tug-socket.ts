import { io, Socket } from "socket.io-client";

let tugSocket: Socket | null = null;

/** Single shared Tug namespace socket (same pattern as rocket-socket — do not recreate on disconnect). */
export function getTugSocket(): Socket {
  if (!tugSocket) {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    tugSocket = io(`${baseUrl}/tug`, {
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
  return tugSocket;
}

export function disconnectTugSocket() {
  if (tugSocket) {
    tugSocket.disconnect();
    tugSocket = null;
  }
}
