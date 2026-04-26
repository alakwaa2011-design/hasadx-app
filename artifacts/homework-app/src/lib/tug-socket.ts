import { io, Socket } from "socket.io-client";

let tugSocket: Socket | null = null;

export function getTugSocket(): Socket {
  if (!tugSocket || !tugSocket.connected) {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    tugSocket = io(`${baseUrl}/tug`, {
      path: `${basePath}/api/socket.io`.replace(/\/\//g, "/"),
      transports: ["polling", "websocket"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
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
