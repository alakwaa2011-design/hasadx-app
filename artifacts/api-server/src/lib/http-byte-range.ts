export type ParsedByteRange = { start: number; end: number };

export function parseHttpByteRange(
  header: string | undefined,
  totalSize: number,
): ParsedByteRange | null | "invalid" {
  if (!header) return null;
  if (!Number.isSafeInteger(totalSize) || totalSize <= 0) return "invalid";

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid";
    return {
      start: Math.max(0, totalSize - suffixLength),
      end: totalSize - 1,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : totalSize - 1;
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start < 0
    || start >= totalSize
    || requestedEnd < start
  ) {
    return "invalid";
  }

  return {
    start,
    end: Math.min(requestedEnd, totalSize - 1),
  };
}