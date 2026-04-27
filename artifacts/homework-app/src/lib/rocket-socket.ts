import { io, Socket } from "socket.io-client";

let rocketSocket: Socket | null = null;

export function getRocketSocket(): Socket {
  if (!rocketSocket || !rocketSocket.connected) {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    rocketSocket = io(`${baseUrl}/rocket`, {
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
  return rocketSocket;
}

export function disconnectRocketSocket() {
  if (rocketSocket) {
    rocketSocket.disconnect();
    rocketSocket = null;
  }
}
