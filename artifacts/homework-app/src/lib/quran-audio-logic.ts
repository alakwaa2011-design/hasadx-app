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

export function getNextAyah(
  currentAyah: number,
  surahLength: number,
  allowedStart: number | null,
  allowedEnd: number | null,
  currentPlay: number,
  maxPlays: number
): { nextAyah: number | null; nextPlay: number } {
  if (currentPlay < maxPlays) {
    return { nextAyah: currentAyah, nextPlay: currentPlay + 1 };
  }
  
  const end = allowedEnd !== null ? Math.min(allowedEnd, surahLength) : surahLength;
  if (currentAyah < end) {
    return { nextAyah: currentAyah + 1, nextPlay: 1 };
  }
  
  return { nextAyah: null, nextPlay: 1 };
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
