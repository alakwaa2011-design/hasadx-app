import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PAGE_COUNT, verses } from '@/data/quran';

const STORAGE_KEY = 'mushaf-hasaad:native-reader:v1';
export type Bookmark = { page: number; chapter: number; verse: number; category: 'stopped_here' | 'review' };
export type Appearance = 'day' | 'warm' | 'night';
export type Practice = { chapter: number; verse: number; stage: number; repeatCount: number; revealed: boolean };
export type AudioPreferences = { reciterId: number | null; repeat: number; stopAt: 'ayah' | 'page' | 'surah'; speed: number };
type Saved = {
  page: number; bookmarks: Bookmark[]; appearance: Appearance; readingMode: boolean;
  practice: Practice | null; practiceResults: Record<string, 'mastered' | 'review'>;
  audio: AudioPreferences;
};
type ReaderValue = Saved & {
  ready: boolean; storageError: string | null;
  goToPage: (page: number) => void;
  toggleBookmark: (chapter: number, verse: number) => void;
  setAppearance: (appearance: Appearance) => void;
  setReadingMode: (mode: boolean) => void;
  startPractice: (chapter: number, verse: number) => void;
  updatePractice: (update: Partial<Pick<Practice, 'stage' | 'repeatCount' | 'revealed'>>) => void;
  assessPractice: (result: 'mastered' | 'review') => void;
  updateAudio: (update: Partial<AudioPreferences>) => void;
};
const ReaderContext = createContext<ReaderValue | null>(null);
const validPage = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= PAGE_COUNT;
const initial: Saved = {
  page: 1, bookmarks: [], appearance: 'day', readingMode: false, practice: null, practiceResults: {},
  audio: { reciterId: null, repeat: 1, stopAt: 'ayah', speed: 1 },
};

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Saved>(initial);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!active || !raw) return;
      const saved = JSON.parse(raw) as Partial<Saved>;
      setState({
        page: validPage(saved.page) ? saved.page : 1,
        bookmarks: Array.isArray(saved.bookmarks)
          ? saved.bookmarks.filter(b => validPage(b.page) && Number.isInteger(b.chapter) && Number.isInteger(b.verse) && (b.category === 'review' || b.category === 'stopped_here'))
          : [],
        appearance: saved.appearance === 'night' || saved.appearance === 'warm' ? saved.appearance : 'day',
        readingMode: saved.readingMode === true,
        practice: saved.practice && verses.some(v => v.chapter_id === saved.practice?.chapter && v.number === saved.practice?.verse)
          && Number.isInteger(saved.practice.stage) && saved.practice.stage >= 0 && saved.practice.stage <= 5
          ? { chapter: saved.practice.chapter, verse: saved.practice.verse, stage: saved.practice.stage,
            repeatCount: [1, 3, 5, 10, -1].includes(saved.practice.repeatCount) ? saved.practice.repeatCount : 3,
            revealed: saved.practice.revealed === true }
          : null,
        practiceResults: saved.practiceResults && typeof saved.practiceResults === 'object' && !Array.isArray(saved.practiceResults)
          ? saved.practiceResults : {},
        audio: {
          reciterId: Number.isInteger(saved.audio?.reciterId) && (saved.audio?.reciterId ?? 0) > 0 ? saved.audio!.reciterId : null,
          repeat: [1, 3, 5, 10, -1].includes(saved.audio?.repeat ?? 0) ? saved.audio!.repeat : 1,
          stopAt: saved.audio?.stopAt === 'page' || saved.audio?.stopAt === 'surah' ? saved.audio.stopAt : 'ayah',
          speed: [.75, 1, 1.25].includes(saved.audio?.speed ?? 0) ? saved.audio!.speed : 1,
        },
      });
    }).catch(error => {
      console.warn('تعذر تحميل حالة المصحف', error);
      if (active) setStorageError('تعذّر تحميل بيانات القراءة على هذا الجهاز. لن نستبدل بياناتك المحفوظة.');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (ready && !storageError) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      .catch(error => {
        console.warn('تعذر حفظ حالة المصحف', error);
        setStorageError('تعذّر حفظ القراءة والعلامات. تحقق من مساحة الجهاز ثم أعد فتح التطبيق.');
      });
  }, [ready, storageError, state]);
  const goToPage = useCallback((page: number) => {
    if (validPage(page)) setState(previous => ({ ...previous, page }));
  }, []);
  const toggleBookmark = useCallback((chapter: number, verse: number) => {
    setState(previous => {
      const existing = previous.bookmarks.find(b => b.chapter === chapter && b.verse === verse);
      return {
        ...previous,
        bookmarks: existing
          ? previous.bookmarks.filter(b => b !== existing)
          : [...previous.bookmarks, { chapter, verse, page: previous.page, category: 'stopped_here' }],
      };
    });
  }, []);
  const setAppearance = useCallback((appearance: Appearance) => setState(previous => ({ ...previous, appearance })), []);
  const setReadingMode = useCallback((readingMode: boolean) => setState(previous => ({ ...previous, readingMode })), []);
  const startPractice = useCallback((chapter: number, verse: number) => {
    setState(previous => ({
      ...previous, practice: { chapter, verse, stage: 0, repeatCount: 3, revealed: false },
    }));
  }, []);
  const updatePractice = useCallback((update: Partial<Pick<Practice, 'stage' | 'repeatCount' | 'revealed'>>) => {
    setState(previous => ({
      ...previous, practice: previous.practice ? { ...previous.practice, ...update } : null,
    }));
  }, []);
  const assessPractice = useCallback((result: 'mastered' | 'review') => {
    setState(previous => {
      if (!previous.practice) return previous;
      const { chapter, verse } = previous.practice;
      return { ...previous, practiceResults: { ...previous.practiceResults, [`${chapter}:${verse}`]: result } };
    });
  }, []);
  const updateAudio = useCallback((update: Partial<AudioPreferences>) => {
    setState(previous => ({ ...previous, audio: { ...previous.audio, ...update } }));
  }, []);
  const value = useMemo(() => ({
    ...state, ready, storageError, goToPage, toggleBookmark, setAppearance, setReadingMode,
    startPractice, updatePractice, assessPractice, updateAudio,
  }), [state, ready, storageError, goToPage, toggleBookmark, setAppearance, setReadingMode, startPractice, updatePractice, assessPractice, updateAudio]);
  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReader() {
  const reader = useContext(ReaderContext);
  if (!reader) throw new Error('ReaderProvider is missing');
  return reader;
}