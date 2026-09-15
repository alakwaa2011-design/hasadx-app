export type QuranProgressState = {
  currentSurahNumber: number | null;
  currentAyah: number | null;
  progressPercent: number;
  masteredAyahCount: number;
};

export type CompletedWardProgress = {
  surahNumber: number;
  endAyah: number;
  ayahCounts: readonly number[];
};

function positionIndex(surahNumber: number, ayah: number, ayahCounts: readonly number[]): number {
  return ayahCounts.slice(0, surahNumber - 1).reduce((sum, count) => sum + count, 0) + ayah;
}

export function nextPositionForCompletedWard(
  surahNumber: number,
  endAyah: number,
  ayahCounts: readonly number[],
): { surahNumber: number; ayah: number } {
  const ayahCount = ayahCounts[surahNumber - 1] ?? endAyah;
  if (endAyah < ayahCount) return { surahNumber, ayah: endAyah + 1 };
  if (surahNumber < ayahCounts.length) return { surahNumber: surahNumber + 1, ayah: 1 };
  return { surahNumber: ayahCounts.length, ayah: ayahCount };
}

export function applyCompletedWardProgress(
  current: QuranProgressState,
  ward: CompletedWardProgress,
): QuranProgressState {
  const completedAyahCount = positionIndex(ward.surahNumber, ward.endAyah, ward.ayahCounts);
  const masteredAyahCount = Math.max(current.masteredAyahCount, completedAyahCount);
  const currentIndex = current.currentSurahNumber !== null && current.currentAyah !== null
    ? positionIndex(current.currentSurahNumber, current.currentAyah, ward.ayahCounts)
    : -1;
  const next = nextPositionForCompletedWard(ward.surahNumber, ward.endAyah, ward.ayahCounts);
  const nextIndex = positionIndex(next.surahNumber, next.ayah, ward.ayahCounts);
  const shouldAdvancePosition = nextIndex > currentIndex;
  return {
    currentSurahNumber: shouldAdvancePosition ? next.surahNumber : current.currentSurahNumber,
    currentAyah: shouldAdvancePosition ? next.ayah : current.currentAyah,
    progressPercent: Math.max(current.progressPercent, Math.min(100, Math.round((masteredAyahCount / ayahCountsTotal(ward.ayahCounts)) * 100))),
    masteredAyahCount,
  };
}

export function ayahCountsTotal(ayahCounts: readonly number[]): number {
  return ayahCounts.reduce((sum, count) => sum + count, 0);
}

export function shouldApplyRecitationProgress(
  status: string,
  progressApplied: boolean,
): boolean {
  return status === "completed" && !progressApplied;
}