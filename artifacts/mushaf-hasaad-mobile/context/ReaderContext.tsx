import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PAGE_COUNT, verses } from '@/data/quran';

const STORAGE_KEY = 'mushaf-hasaad:native-reader:v1';
export type BookmarkCategory = 'stopped_here' | 'review' | 'similar' | 'repeated_mistake' | 'ask_teacher';
export type Bookmark = { page: number; chapter: number; verse: number; category: BookmarkCategory };
export const bookmarkCategoryLabels: Record<BookmarkCategory, string> = {
  stopped_here: 'توقفت هنا', review: 'تحتاج مراجعة', similar: 'متشابهة',
  repeated_mistake: 'خطأ متكرر', ask_teacher: 'سؤال للمعلم',
};
export type Appearance = 'day' | 'warm' | 'night';
export type PageDisplay = 'words' | 'images';
export type Practice = { chapter: number; verse: number; stage: number; repeatCount: number; revealed: boolean };
export type AudioPreferences = {
  reciterId: number | null;
  repeat: number;
  stopAt: 'ayah' | 'page' | 'surah';
  speed: number;
  repeatMode: 'ayah' | 'range';
  rangeChapter: number | null;
  rangeStart: number | null;
  rangeEnd: number | null;
  pauseBetween: number;
};
type Saved = {
  page: number; bookmarks: Bookmark[]; appearance: Appearance; readingMode: boolean; pageDisplay: PageDisplay; keepAwake: boolean; tajweedEnabled: boolean;
  practice: Practice | null; practiceResults: Record<string, 'mastered' | 'review'>;
  audio: AudioPreferences;
};
type ReaderValue = Saved & {
  ready: boolean; storageError: string | null;
  goToPage: (page: number) => void;
  toggleBookmark: (chapter: number, verse: number) => void;
  setBookmarkCategory: (chapter: number, verse: number, category: BookmarkCategory) => void;
  setKeepAwake: (value: boolean) => void;
  setTajweedEnabled: (value: boolean) => void;
  setAppearance: (appearance: Appearance) => void;
  setPageDisplay: (display: PageDisplay) => void;
  setReadingMode: (mode: boolean) => void;
  startPractice: (chapter: number, verse: number) => void;
  updatePractice: (update: Partial<Pick<Practice, 'stage' | 'repeatCount' | 'revealed'>>) => void;
  assessPractice: (result: 'mastered' | 'review') => void;
  updateAudio: (update: Partial<AudioPreferences>) => void;
};
const ReaderContext = createContext<ReaderValue | null>(null);
const validPage = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= PAGE_COUNT;
const validAyah = (chapter: unknown, ayah: unknown): boolean => Number.isInteger(chapter) && Number.isInteger(ayah)
  && verses.some(v => v.chapter_id === chapter && v.number === ayah);
const initial: Saved = {
  page: 1, bookmarks: [], appearance: 'day', readingMode: false, pageDisplay: 'words', keepAwake: false, tajweedEnabled: false, practice: null, practiceResults: {},
  audio: {
    reciterId: null, repeat: 1, stopAt: 'ayah', speed: 1, repeatMode: 'ayah',
    rangeChapter: null, rangeStart: null, rangeEnd: null, pauseBetween: 1,
  },
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
      const savedAudio = saved.audio;
      const savedRangeChapter = Number.isInteger(savedAudio?.rangeChapter)
        && verses.some(v => v.chapter_id === savedAudio?.rangeChapter) ? savedAudio!.rangeChapter! : null;
      const savedRangeStart = validAyah(savedRangeChapter, savedAudio?.rangeStart) ? savedAudio!.rangeStart! : null;
      const savedRangeEnd = validAyah(savedRangeChapter, savedAudio?.rangeEnd) ? savedAudio!.rangeEnd! : null;
      const validSavedRange = savedRangeStart !== null && savedRangeEnd !== null && savedRangeStart <= savedRangeEnd;
      setState({
        page: validPage(saved.page) ? saved.page : 1,
        bookmarks: Array.isArray(saved.bookmarks)
          ? saved.bookmarks.filter(b => b && validAyah(b.chapter, b.verse))
            .map(b => ({
              page: verses.find(v => v.chapter_id === b.chapter && v.number === b.verse)!.page_id,
              chapter: b.chapter, verse: b.verse,
              category: String(b.category) === 'similar_ayah' ? 'similar' as BookmarkCategory
                : Object.hasOwn(bookmarkCategoryLabels, b.category) ? b.category : 'stopped_here' as BookmarkCategory,
            })).filter((b, index, list) => list.findIndex(other => other.chapter === b.chapter && other.verse === b.verse) === index)
          : [],
        appearance: saved.appearance === 'night' || saved.appearance === 'warm' ? saved.appearance : 'day',
        readingMode: saved.readingMode === true,
        pageDisplay: saved.pageDisplay === 'images' ? 'images' : 'words',
        keepAwake: saved.keepAwake === true,
        tajweedEnabled: saved.tajweedEnabled === true,
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
          repeatMode: saved.audio?.repeatMode === 'range' ? 'range' : 'ayah',
          rangeChapter: validSavedRange ? savedRangeChapter : null,
          rangeStart: validSavedRange ? savedRangeStart : null,
          rangeEnd: validSavedRange ? savedRangeEnd : null,
          pauseBetween: [0, .5, 1, 2, 3].includes(saved.audio?.pauseBetween ?? -1) ? saved.audio!.pauseBetween : 1,
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
          : [...previous.bookmarks, { chapter, verse, page: verses.find(v => v.chapter_id === chapter && v.number === verse)?.page_id ?? previous.page, category: 'stopped_here' }],
      };
    });
  }, []);
  const setBookmarkCategory = useCallback((chapter: number, verse: number, category: BookmarkCategory) => {
    if (!Object.hasOwn(bookmarkCategoryLabels, category)) return;
    const found = verses.find(v => v.chapter_id === chapter && v.number === verse);
    if (!found) return;
    setState(previous => ({
      ...previous,
      bookmarks: previous.bookmarks.some(b => b.chapter === chapter && b.verse === verse)
        ? previous.bookmarks.map(b => b.chapter === chapter && b.verse === verse ? { ...b, category, page: found.page_id } : b)
        : [...previous.bookmarks, { chapter, verse, page: found.page_id, category }],
    }));
  }, []);
  const setKeepAwake = useCallback((keepAwake: boolean) => setState(previous => ({ ...previous, keepAwake })), []);
  const setTajweedEnabled = useCallback((tajweedEnabled: boolean) => setState(previous => ({ ...previous, tajweedEnabled })), []);
  const setAppearance = useCallback((appearance: Appearance) => setState(previous => ({ ...previous, appearance })), []);
  const setPageDisplay = useCallback((pageDisplay: PageDisplay) => setState(previous => ({ ...previous, pageDisplay })), []);
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
    setState(previous => {
      const audio = { ...previous.audio, ...update };
      if (!((audio.reciterId === null || (Number.isInteger(audio.reciterId) && audio.reciterId > 0))
        && [1, 3, 5, 10, -1].includes(audio.repeat)
        && ['ayah', 'page', 'surah'].includes(audio.stopAt)
        && [.75, 1, 1.25].includes(audio.speed)
        && ['ayah', 'range'].includes(audio.repeatMode)
        && [0, .5, 1, 2, 3].includes(audio.pauseBetween))) return previous;
      if (audio.rangeChapter !== null && (!Number.isInteger(audio.rangeChapter)
        || !verses.some(v => v.chapter_id === audio.rangeChapter))) return previous;
      if ((audio.rangeStart === null) !== (audio.rangeEnd === null)) return previous;
      if (audio.rangeStart !== null && !validAyah(audio.rangeChapter, audio.rangeStart)) return previous;
      if (audio.rangeEnd !== null && !validAyah(audio.rangeChapter, audio.rangeEnd)) return previous;
      if (audio.rangeChapter === null && (audio.rangeStart !== null || audio.rangeEnd !== null)) return previous;
      if (audio.rangeStart !== null && audio.rangeEnd !== null && audio.rangeStart > audio.rangeEnd) return previous;
      return { ...previous, audio };
    });
  }, []);
  const value = useMemo(() => ({
    ...state, ready, storageError, goToPage, toggleBookmark, setBookmarkCategory, setKeepAwake, setTajweedEnabled, setAppearance, setPageDisplay, setReadingMode,
    startPractice, updatePractice, assessPractice, updateAudio,
  }), [state, ready, storageError, goToPage, toggleBookmark, setBookmarkCategory, setKeepAwake, setTajweedEnabled, setAppearance, setPageDisplay, setReadingMode, startPractice, updatePractice, assessPractice, updateAudio]);
  return <ReaderContext.Provider value={value}>{children}</ReaderContext.Provider>;
}

export function useReader() {
  const reader = useContext(ReaderContext);
  if (!reader) throw new Error('ReaderProvider is missing');
  return reader;
}

export function useReaderAppearance() {
  return useContext(ReaderContext)?.appearance;
}