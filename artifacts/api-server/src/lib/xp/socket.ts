/**
 * Debounced socket emit for XP grants. Coalesces multiple grants within
 * 3 seconds into a single "teacher:xp" event so the toast UI doesn't spam.
 *
 * Payload contract (spec §5):
 *   { totalDelta, items, newBadgeKeys, newGrantIds }
 *
 * Authoritative totals (totalXp, level) are NEVER included — the client
 * must refetch /me/achievements after a milestone to get trusted state.
 * This neutralises any client-side tampering with the socket stream.
 */
import type { Server as IoServer } from "socket.io";
import type { AwardXpResult } from "./engine";

let ioRef: IoServer | null = null;
export function bindXpSocket(io: IoServer): void {
  ioRef = io;
}

interface ActionCount {
  action: string;
  count: number;
}

interface PendingGrant {
  totalDelta: number;
  items: Map<string, number>; // action → count
  leveledUp: boolean;
  newBadgeKeys: string[];
  newGrantIds: number[];
  timer: NodeJS.Timeout;
}

const pending = new Map<number, PendingGrant>();
/**
 * 3-second debounce window — long enough to coalesce bulk-grading runs
 * (teacher grades 12 submissions quickly) into one toast, short enough
 * that feedback still feels immediate.
 */
const DEBOUNCE_MS = 3_000;

function flush(teacherId: number): void {
  const p = pending.get(teacherId);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(teacherId);
  if (!ioRef) return;

  const items: ActionCount[] = Array.from(p.items.entries()).map(
    ([action, count]) => ({ action, count }),
  );

  ioRef.to(`teacher:${teacherId}`).emit("teacher:xp", {
    totalDelta: p.totalDelta,
    items,
    leveledUp: p.leveledUp,
    newBadgeKeys: p.newBadgeKeys,
    newGrantIds: p.newGrantIds,
  });
}

export function emitXpToTeacher(
  teacherId: number,
  result: AwardXpResult,
): void {
  if (!ioRef || !result.awarded) return;
  const existing = pending.get(teacherId);
  if (existing) clearTimeout(existing.timer);

  const items: Map<string, number> = new Map(existing?.items ?? []);
  const prev = items.get(result.actionKey ?? "") ?? 0;
  if (result.actionKey) items.set(result.actionKey, prev + 1);

  const merged: PendingGrant = {
    totalDelta: (existing?.totalDelta ?? 0) + result.delta,
    items,
    leveledUp: (existing?.leveledUp ?? false) || (result.leveledUp ?? false),
    newBadgeKeys: [
      ...(existing?.newBadgeKeys ?? []),
      ...(result.newBadgeKeys ?? []),
    ],
    newGrantIds: [
      ...(existing?.newGrantIds ?? []),
      ...(result.newGrantIds ?? []),
    ],
    timer: setTimeout(() => flush(teacherId), DEBOUNCE_MS),
  };
  pending.set(teacherId, merged);

  // Milestone events (level-up, new badge, new reward grant) bypass the
  // debounce window so the user sees the celebratory toast immediately.
  const milestone =
    result.leveledUp ||
    (result.newBadgeKeys?.length ?? 0) > 0 ||
    (result.newGrantIds?.length ?? 0) > 0;
  if (milestone) flush(teacherId);
}

/**
 * Convenience: award XP and (if granted) emit the debounced socket event.
 * Use this from instrumentation points instead of calling awardXp directly,
 * unless you specifically don't want a socket emit.
 */
import {
  awardXp,
  runAwardXpSideEffects,
  type AwardXpInput,
  type XpTx,
} from "./engine";
export async function awardXpAndNotify(
  input: AwardXpInput,
): Promise<AwardXpResult> {
  const result = await awardXp(input);
  if (result.awarded) emitXpToTeacher(input.teacherId, { ...result, actionKey: input.actionKey });
  return result;
}

/**
 * Award XP atomically with the caller's open transaction. The ledger row +
 * stats update commit together with the originating action — if the outer
 * tx rolls back, no XP is granted.
 *
 * Returns a `runAfterCommit` callback the caller MUST invoke after their
 * transaction commits. That callback runs the post-grant side-effects
 * (badges, threshold rewards, quests) and emits the debounced socket event.
 * Skipping it just means the socket toast is missed — the XP itself is safe.
 */
export async function awardXpInTxAndNotifyAfterCommit(
  tx: XpTx,
  input: AwardXpInput,
): Promise<{ result: AwardXpResult; runAfterCommit: () => Promise<void> }> {
  const result = await awardXp(input, { tx });
  const runAfterCommit = async (): Promise<void> => {
    if (!result.awarded) return;
    const { newBadgeKeys, newGrantIds } = await runAwardXpSideEffects(
      input.teacherId,
      input.actionKey,
    );
    emitXpToTeacher(input.teacherId, {
      ...result,
      actionKey: input.actionKey,
      newBadgeKeys,
      newGrantIds,
    });
  };
  return { result, runAfterCommit };
}
