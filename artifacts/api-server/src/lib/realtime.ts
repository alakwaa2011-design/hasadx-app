import type { Server } from "socket.io";

let realtimeServer: Server | null = null;

export function setRealtimeServer(io: Server): void {
  realtimeServer = io;
}

export function emitToTeacher(teacherId: number, event: string, payload: unknown): void {
  realtimeServer?.to(`teacher:${teacherId}`).emit(event, payload);
}