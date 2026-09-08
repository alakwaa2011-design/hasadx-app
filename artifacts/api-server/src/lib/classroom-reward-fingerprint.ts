import { createHash } from "node:crypto";

/** Canonical request identity: target order cannot alter an idempotent grant request. */
export function classroomRewardFingerprint(input: {
  className: string;
  studentIds: number[];
  typeId?: number;
  customReason?: string;
  customPoints?: number;
}): string {
  const payload = {
    className: input.className,
    studentIds: [...new Set(input.studentIds)].sort((a, b) => a - b),
    typeId: input.typeId ?? null,
    customReason: input.customReason ?? null,
    customPoints: input.customPoints ?? null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/** Keeps reversal request identities disjoint from client-supplied grant keys. */
export function classroomRewardReversalKey(idempotencyKey: string): string {
  return `__reversal__:${idempotencyKey}`;
}