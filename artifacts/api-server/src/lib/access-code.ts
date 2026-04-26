// Constant-time-ish access code comparison so an attacker can't easily detect
// which prefix matched via timing. Lengths typically differ on mismatch which
// short-circuits, but for equal-length strings we compare byte-by-byte without
// early return. Comparison is case-sensitive — callers should normalize the
// input first if a case-insensitive match is desired.
export function safeAccessCodeEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Normalizes user-supplied access codes the same way for every check (trim +
// upper-case). This must match how teachers' codes are stored.
export function normalizeAccessCode(input: string | null | undefined): string {
  return (input || "").trim().toUpperCase();
}
