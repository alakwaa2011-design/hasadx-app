import { useState, useCallback, useEffect } from 'react';

export interface MemoSessionState {
  isActive: boolean;
  rangeStart: number;
  rangeEnd: number;
  repeatScope: 'ayah' | 'range';
  repeatCount: number | 'continuous';
  pauseSeconds: number;
}

export function useQuranMemoSession(
  surahNumber: number,
  selectedAyah: number,
  wardStart: number | null,
  wardEnd: number | null,
  mode: string | null
) {
  const [memoSession, setMemoSession] = useState<MemoSessionState>({
    isActive: mode === 'memorization',
    rangeStart: wardStart ?? selectedAyah,
    rangeEnd: wardEnd ?? selectedAyah,
    repeatScope: 'ayah',
    repeatCount: 3,
    pauseSeconds: 0,
  });

  const [memoView, setMemoView] = useState<'show' | 'hide' | 'progressive'>(
    mode === 'memorization' ? 'hide' : 'show'
  );
  
  const [revealedAyahs, setRevealedAyahs] = useState<Set<string>>(new Set());

  const isAyahConcealed = useCallback((surah: number, ayah: number, playingAyahNum: number | null) => {
    if (memoView === 'show') return false;
    if (surah !== surahNumber) return false;
    if (revealedAyahs.has(`${surah}:${ayah}`)) return false;
    
    if (memoView === 'progressive') {
      const progressPoint = playingAyahNum ?? (memoSession.isActive ? memoSession.rangeStart : (wardStart ?? 1));
      if (ayah <= progressPoint) {
         return false;
      }
    }
    
    return true;
  }, [memoView, revealedAyahs, memoSession.isActive, memoSession.rangeStart, surahNumber, wardStart]);

  const toggleReveal = useCallback((surah: number, ayah: number) => {
    setRevealedAyahs(prev => {
      const next = new Set(prev);
      const key = `${surah}:${ayah}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const resetReveal = useCallback(() => {
    setRevealedAyahs(new Set());
  }, []);

  useEffect(() => {
    if (!memoSession.isActive) {
      setMemoSession(s => ({
        ...s,
        rangeStart: wardStart ?? selectedAyah,
        rangeEnd: wardEnd ?? selectedAyah
      }));
    }
  }, [surahNumber, selectedAyah, memoSession.isActive, wardStart, wardEnd]);

  const startSession = useCallback(() => {
    setMemoSession(s => ({
      ...s,
      isActive: true,
      rangeStart: wardStart ?? selectedAyah,
      rangeEnd: wardEnd ?? selectedAyah
    }));
    setMemoView('hide');
  }, [wardStart, wardEnd, selectedAyah]);

  const endSession = useCallback(() => {
    setMemoSession(s => ({ ...s, isActive: false }));
    setMemoView('show');
    resetReveal();
  }, [resetReveal]);

  return {
    memoSession, setMemoSession,
    memoView, setMemoView,
    isAyahConcealed, toggleReveal, resetReveal,
    startSession, endSession
  };
}
