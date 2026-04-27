import { io, Socket } from "socket.io-client";

let hotseatSocket: Socket | null = null;

export function getHotSeatSocket(): Socket {
  if (!hotseatSocket || !hotseatSocket.connected) {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    hotseatSocket = io(`${baseUrl}/hotseat`, {
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
  return hotseatSocket;
}

export function disconnectHotSeatSocket() {
  if (hotseatSocket) {
    hotseatSocket.disconnect();
    hotseatSocket = null;
  }
}
