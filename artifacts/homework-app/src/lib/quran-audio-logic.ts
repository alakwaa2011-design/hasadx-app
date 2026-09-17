export interface AyahTimingSegment {
  wordPosition: number;
  startMs: number;
  endMs: number;
}

export function getActiveWordPosition(
  currentTimeMs: number,
  verseStartMs: number,
  segments: AyahTimingSegment[]
): number | null {
  const relativeMs = currentTimeMs - verseStartMs;
  if (relativeMs < 0) return null;
  
  for (const seg of segments) {
    if (relativeMs >= seg.startMs && relativeMs < seg.endMs) {
      return seg.wordPosition;
    }
  }
  return null;
}

export function clampAyah(
  ayah: number | null,
  allowedStart: number | null,
  allowedEnd: number | null
): number | null {
  if (ayah === null) return null;
  if (allowedStart !== null && ayah < allowedStart) return allowedStart;
  if (allowedEnd !== null && ayah > allowedEnd) return null; // Can't play beyond end
  return ayah;
}

export function isAyahAllowed(
  ayah: number,
  allowedStart: number | null,
  allowedEnd: number | null
): boolean {
  if (allowedStart !== null && ayah < allowedStart) return false;
  if (allowedEnd !== null && ayah > allowedEnd) return false;
  return true;
}

export function getNextAyahMemo(
  currentAyah: number,
  surahLength: number,
  rangeStart: number,
  rangeEnd: number,
  repeatScope: 'ayah' | 'range',
  repeatCount: number | 'continuous',
  currentAyahPlayCount: number,
  currentRangePlayCount: number
): {
  nextAyah: number | null;
  nextAyahPlayCount: number;
  nextRangePlayCount: number;
} {
  const isContinuous = repeatCount === 'continuous';
  const maxPlays = isContinuous ? Infinity : (repeatCount as number);

  const effectiveEnd = Math.min(rangeEnd, surahLength);

  if (repeatScope === 'ayah') {
    if (currentAyahPlayCount < maxPlays) {
      return {
        nextAyah: currentAyah,
        nextAyahPlayCount: currentAyahPlayCount + 1,
        nextRangePlayCount: currentRangePlayCount,
      };
    }
    
    if (currentAyah < effectiveEnd) {
      return {
        nextAyah: currentAyah + 1,
        nextAyahPlayCount: 1,
        nextRangePlayCount: currentRangePlayCount,
      };
    }
    
    if (isContinuous) {
      return {
        nextAyah: rangeStart,
        nextAyahPlayCount: 1,
        nextRangePlayCount: currentRangePlayCount + 1,
      };
    }
    
    return { nextAyah: null, nextAyahPlayCount: 1, nextRangePlayCount: 1 };
  } else {
    // repeatScope === 'range'
    if (currentAyah < effectiveEnd) {
      return {
        nextAyah: currentAyah + 1,
        nextAyahPlayCount: 1,
        nextRangePlayCount: currentRangePlayCount,
      };
    }
    
    if (currentRangePlayCount < maxPlays) {
      return {
        nextAyah: rangeStart,
        nextAyahPlayCount: 1,
        nextRangePlayCount: currentRangePlayCount + 1,
      };
    }
    
    return { nextAyah: null, nextAyahPlayCount: 1, nextRangePlayCount: 1 };
  }
}

export function getPrevAyah(
  currentAyah: number,
  allowedStart: number | null
): number | null {
  const start = allowedStart !== null ? Math.max(allowedStart, 1) : 1;
  if (currentAyah > start) {
    return currentAyah - 1;
  }
  return null;
}

export function getNextSurahAfterEnd(
  surahNumber: number,
  hasExplicitRange: boolean,
  hasActiveSession: boolean,
): number | null {
  if (hasExplicitRange || hasActiveSession || surahNumber >= 114) return null;
  return surahNumber + 1;
}
