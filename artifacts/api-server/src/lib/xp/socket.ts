/**
 * Debounced socket emit for XP grants. Coalesces multiple grants within
 * 500ms into a single "teacher:xp" event so the toast UI doesn't spam.
 */
import type { Server as IoServer } from "socket.io";
import type { AwardXpResult } from "./engine";

let ioRef: IoServer | null = null;
export function bindXpSocket(io: IoServer): void {
  ioRef = io;
}

interface PendingGrant {
  totalDelta: number;
  newTotalXp?: number;
  newLevel?: number;
  leveledUp?: boolean;
  newBadgeKeys: string[];
  newGrantIds: number[];
  timer: NodeJS.Timeout;
}

const pending = new Map<number, PendingGrant>();
const DEBOUNCE_MS = 500;

export function emitXpToTeacher(
  teacherId: number,
  result: AwardXpResult,
): void {
  if (!ioRef || !result.awarded) return;
  const existing = pending.get(teacherId);
  if (existing) clearTimeout(existing.timer);
  const merged: PendingGrant = {
    totalDelta: (existing?.totalDelta ?? 0) + result.delta,
    newTotalXp: result.newTotalXp ?? existing?.newTotalXp,
    newLevel: result.newLevel ?? existing?.newLevel,
    leveledUp: existing?.leveledUp || result.leveledUp,
    newBadgeKeys: [
      ...(existing?.newBadgeKeys ?? []),
      ...(result.newBadgeKeys ?? []),
    ],
    newGrantIds: [
      ...(existing?.newGrantIds ?? []),
      ...(result.newGrantIds ?? []),
    ],
    timer: setTimeout(() => {
      const p = pending.get(teacherId);
      pending.delete(teacherId);
      if (!p || !ioRef) return;
      ioRef.to(`teacher:${teacherId}`).emit("teacher:xp", {
        delta: p.totalDelta,
        totalXp: p.newTotalXp,
        level: p.newLevel,
        leveledUp: p.leveledUp ?? false,
        newBadgeKeys: p.newBadgeKeys,
        newGrantIds: p.newGrantIds,
      });
    }, DEBOUNCE_MS),
  };
  pending.set(teacherId, merged);
}

/**
 * Convenience: award XP and (if granted) emit the debounced socket event.
 * Use this from instrumentation points instead of calling awardXp directly,
 * unless you specifically don't want a socket emit.
 */
import { awardXp, type AwardXpInput } from "./engine";
export async function awardXpAndNotify(
  input: AwardXpInput,
): Promise<AwardXpResult> {
  const result = await awardXp(input);
  if (result.awarded) emitXpToTeacher(input.teacherId, result);
  return result;
}
