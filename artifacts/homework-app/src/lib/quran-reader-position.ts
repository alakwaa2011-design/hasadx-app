export type QuranReaderPositionState = {
  ayah: number;
  navigationKey: string;
};

export type QuranReaderPositionAction =
  | { type: "navigation"; key: string; ayah: number }
  | { type: "click"; ayah: number };

export function clampQuranAyah(ayah: number): number {
  return Math.max(Math.trunc(ayah), 1);
}

export function quranNavigationKey(
  surahNumber: number,
  requestedAyah: number | null,
  startAyah: number | null,
): string {
  return `${surahNumber}:${requestedAyah ?? startAyah ?? 1}`;
}

/**
 * URL/prop navigation initializes the reader, while a click owns the current
 * selection until navigation inputs actually change. This prevents a stale
 * requested URL from undoing a click during unrelated rerenders or saves.
 */
export function reduceQuranReaderPosition(
  state: QuranReaderPositionState,
  action: QuranReaderPositionAction,
): QuranReaderPositionState {
  if (action.type === "click") {
    return { ...state, ayah: clampQuranAyah(action.ayah) };
  }
  if (action.key === state.navigationKey) return state;
  return {
    ayah: clampQuranAyah(action.ayah),
    navigationKey: action.key,
  };
}