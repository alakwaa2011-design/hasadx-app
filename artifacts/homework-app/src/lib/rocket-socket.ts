import { io, Socket } from "socket.io-client";

let rocketSocket: Socket | null = null;

/** Single shared Rocket namespace socket (do not recreate on reconnect — avoids duplicate listeners). */
export function getRocketSocket(): Socket {
  if (!rocketSocket) {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    rocketSocket = io(`${baseUrl}/rocket`, {
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
  return rocketSocket;
}

export function disconnectRocketSocket() {
  if (rocketSocket) {
    rocketSocket.disconnect();
    rocketSocket = null;
  }
}
