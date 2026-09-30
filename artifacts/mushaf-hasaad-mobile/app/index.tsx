import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, BackHandler, Keyboard, Modal, Platform,
  Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View, useWindowDimensions, type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { getListQuranRecitersQueryKey, getQuranAyahTimings, useListQuranReciters } from '@workspace/api-client-react';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReader, bookmarkCategoryLabels, type Appearance, type PageDisplay } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';
import { privacyUrl, quranApiOrigin } from '@/lib/api-origin';
import { useOfflineContent } from '@/lib/offline-content';
import { TafsirPanel } from '@/components/TafsirPanel';
import { GuidedPractice } from '@/components/GuidedPractice';
import { MadaniWordPage } from '@/components/MadaniWordPage';
import { SimilarVersesPanel } from '@/components/SimilarVersesPanel';
import { VerseRangePanel } from '@/components/VerseRangePanel';
import { ReaderKeepAwake } from '@/components/ReaderKeepAwake';
import { usePageZoom } from '@/hooks/usePageZoom';
import { WordActions, type WordSelection } from '@/components/WordActions';
import { VerseActions } from '@/components/VerseActions';
import {
  PAGE_COUNT, chapterName, chapters, firstPageOfChapter, firstPageOfPart,
  normalize, pageImage, pageLabel, pageVerses, pages, parts, verses, type Verse,
} from '@/data/quran';

type Sheet = 'index' | 'search' | 'bookmarks' | 'settings' | 'verses' | 'verse' | 'word' | 'memorize' | 'audio' | 'tafsir' | 'range' | null;
type IndexTab = 'chapters' | 'parts' | 'bookmarks';
type AudioTab = 'reciters' | 'playback' | 'range';
type StopAt = 'ayah' | 'page' | 'surah';
const repeats = [1, 3, 5, 10, -1] as const;
const iconSize = 22;
const VERSE_FILE_RECITERS = new Set([1_000_159, 2_000_032]);
type AudioSegment = {
  startMs: number; endMs: number;
  segments: { wordPosition: number; startMs: number; endMs: number }[];
};

function getActiveWordPosition(currentTimeMs: number, verseStartMs: number, segments: AudioSegment['segments']): number | null {
  const relativeMs = currentTimeMs - verseStartMs;
  if (relativeMs < 0) return null;
  for (const segment of segments) {
    if (relativeMs >= segment.startMs && relativeMs < segment.endMs) return segment.wordPosition;
  }
  return null;
}

function pageNumberFromInput(value: string): number | null {
  const digits = value.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
  if (!/^\d{1,3}$/.test(digits)) return null;
  const page = Number(digits);
  return page >= 1 && page <= PAGE_COUNT ? page : null;
}

function recitationStyleLabel(style: string | null): string {
  switch (style) {
    case 'Mujawwad': return 'مجوّد';
    case 'Murattal': return 'مرتّل';
    case 'Kids repeat': return 'المعلّم — ترديد الأطفال';
    case 'Muallim': return 'المعلّم';
    default: return 'تلاوة';
  }
}

function IconButton({
  name, label, onPress, color, active = false,
}: { name: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; color: string; active?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={`action-${label}`}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? .45 : 1, backgroundColor: active ? `${color}1e` : 'transparent' }]}>
      <Ionicons name={name} size={iconSize} color={color} />
    </Pressable>
  );
}

function VerseNumberInput({ label, value, min, max, onCommit, colors }: {
  label: string; value: number; min: number; max: number;
  onCommit: (value: number) => void; colors: ReturnType<typeof useColors>;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const digits = draft.trim().replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
      .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
    const next = Number(digits);
    if (/^\d{1,3}$/.test(digits) && Number.isInteger(next) && next >= min && next <= max) {
      onCommit(next);
    } else {
      setDraft(String(value));
    }
  };
  return <TextInput value={draft} onChangeText={setDraft} onBlur={commit} onSubmitEditing={commit}
    keyboardType="number-pad" maxLength={3} selectTextOnFocus accessibilityLabel={`رقم ${label}`}
    style={[styles.rangeValueInput, { color: colors.foreground, borderColor: colors.border }]} />;
}

export default function MushafReader() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const reader = useReader();
  const offlineContent = useOfflineContent();
  const { page, goToPage, bookmarks, toggleBookmark, setBookmarkCategory, appearance, setAppearance, pageDisplay, setPageDisplay, readingMode, setReadingMode, keepAwake, setKeepAwake, tajweedEnabled, setTajweedEnabled, practice, startPractice, storageError, audio, updateAudio } = reader;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [audioTab, setAudioTab] = useState<AudioTab>('reciters');
  const openAudio = (tab: AudioTab = 'reciters') => { setAudioTab(tab); setSheet('audio'); };
  const [tab, setTab] = useState<IndexTab>('chapters');
  const [query, setQuery] = useState('');
  const [reciterQuery, setReciterQuery] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [similarVerseKey, setSimilarVerseKey] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordSelection | null>(null);
  const viewport = useWindowDimensions();
  const [imageError, setImageError] = useState(false);
  const [audioVerse, setAudioVerse] = useState<Verse | null>(null);
  const [audioSegment, setAudioSegment] = useState<AudioSegment | null>(null);
  const [pendingSegment, setPendingSegment] = useState<(AudioSegment & { request: number; seenUnloaded: boolean }) | null>(null);
  const audioRequest = useRef(0);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAudioAction = useRef<(() => void) | null>(null);
  const pauseRequest = useRef(0);
  const pauseDeadline = useRef(0);
  const pauseRemaining = useRef(0);
  const [betweenVerses, setBetweenVerses] = useState(false);
  const [betweenPaused, setBetweenPaused] = useState(false);
  const ignoreStaleFinish = useRef(false);
  const currentChapterSource = useRef<string | null>(null);
  const [played, setPlayed] = useState(0);
  const [rangePlayed, setRangePlayed] = useState(0);
  const [rangeSession, setRangeSession] = useState(false);
  const { reciterId, repeat, stopAt, speed, repeatMode, rangeChapter, rangeStart, rangeEnd, pauseBetween } = audio;
  const setReciterId = (value: number) => updateAudio({ reciterId: value });
  const setRepeat = (value: number) => updateAudio({ repeat: value });
  const setStopAt = (value: StopAt) => updateAudio({ stopAt: value });
  const setSpeed = (value: number) => updateAudio({ speed: value });
  const [audioError, setAudioError] = useState<string | null>(null);
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const audioStatus = useAudioPlayerStatus(player);
  const wordPlayer = useAudioPlayer(null);
  const wordStatus = useAudioPlayerStatus(wordPlayer);
  const [wordAudioKey, setWordAudioKey] = useState<string | null>(null);
  const [wordError, setWordError] = useState<string | null>(null);
  const activeWordPosition = audioSegment && audioStatus.playing
    ? getActiveWordPosition(audioStatus.currentTime * 1000, audioSegment.startMs, audioSegment.segments)
    : null;
  const catalog = useListQuranReciters({ query: { queryKey: getListQuranRecitersQueryKey(), enabled: !!quranApiOrigin } });
  const reciters = catalog.data?.reciters.filter(reciter => reciter.available !== false) ?? [];
  const shownReciters = reciters.filter(reciter => {
    const term = normalize(reciterQuery);
    return !term || normalize(`${reciter.name} ${recitationStyleLabel(reciter.style)}`).includes(term);
  });
  const activeReciter = reciters.find(r => r.id === reciterId)?.id
    ?? reciters.find(r => r.id === catalog.data?.preferredRecitationId)?.id
    ?? reciters[0]?.id ?? null;
  const currentPage = useRef(page);
  currentPage.current = page;
  const surface = appearance === 'night' ? colors.background : appearance === 'warm' ? '#f2e9d8' : colors.background;
  const paper = appearance === 'night' ? colors.card : appearance === 'warm' ? '#f3e7ce' : '#fffdf8';
  const fg = colors.foreground;
  const pageInfo = pages[page - 1];
  const visibleVerses = pageVerses.get(page) ?? [];
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const landscape = viewport.width > viewport.height;
  const compactLandscape = landscape && viewport.height < 520;
  const topInset = Platform.OS === 'web' && !compactLandscape ? Math.max(67, insets.top) : insets.top;

  const close = useCallback(() => { Keyboard.dismiss(); setSheet(null); }, []);
  const stopWord = useCallback(() => { wordPlayer.pause(); setWordAudioKey(null); }, [wordPlayer]);
  const navigate = useCallback((next: number) => {
    if (next < 1 || next > PAGE_COUNT) return;
    stopWord();
    goToPage(next);
    setSelectedVerse(null);
    setSelectedWord(null);
    setImageError(false);
    close();
    Haptics.selectionAsync().catch(() => undefined);
  }, [goToPage, close, stopWord]);
  const pageRef = useRef(navigate);
  pageRef.current = navigate;
  const finishHandled = useRef(false);
  const turnPage = useCallback((direction: -1 | 1) => {
    pageRef.current(currentPage.current + direction);
  }, []);

  useEffect(() => {
    if (!sheet || Platform.OS === 'web') return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => listener.remove();
  }, [sheet, close]);
  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return [];
    return verses.filter(v => normalize(v.content).includes(term)).slice(0, 60);
  }, [query]);
  const matchingChapters = useMemo(() => {
    const term = normalize(query);
    return term ? chapters.filter(c => normalize(c.name).includes(term)).slice(0, 8) : [];
  }, [query]);
  const numericPage = pageNumberFromInput(query);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(error => console.warn('Audio mode', error));
  }, []);
  useEffect(() => () => {
    ++audioRequest.current;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pendingAudioAction.current = null;
  }, []);
  const schedulePendingPause = useCallback((request: number, durationMs: number) => {
    pauseDeadline.current = Date.now() + durationMs;
    pauseTimer.current = setTimeout(() => {
      pauseTimer.current = null;
      const action = pendingAudioAction.current;
      pendingAudioAction.current = null;
      setBetweenVerses(false);
      setBetweenPaused(false);
      if (request === audioRequest.current) action?.();
    }, durationMs);
  }, []);
  useEffect(() => {
    if (sheet !== 'audio') setReciterQuery('');
  }, [sheet]);
  useEffect(() => {
    if (!audioStatus.error) return;
    ++audioRequest.current;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
    pendingAudioAction.current = null;
    setBetweenVerses(false);
    setBetweenPaused(false);
    player.pause();
    currentChapterSource.current = null;
    setPendingSegment(null);
    setAudioSegment(null);
    setAudioVerse(null);
    setAudioError('تعذّر تشغيل التلاوة. تحقق من الاتصال أو اختر قارئًا آخر.');
    setAudioTab('reciters'); setSheet('audio');
  }, [audioStatus.error, player]);
  useEffect(() => {
    if (wordStatus.error && wordAudioKey) {
      setWordError('تعذّر تشغيل نطق هذه الكلمة. تحقق من الاتصال وحاول مجددًا.');
      setWordAudioKey(null);
    }
  }, [wordStatus.error, wordAudioKey]);
  const playVerse = useCallback(async (verse: Verse, reciter = activeReciter) => {
    if (!quranApiOrigin || !reciter) {
      setAudioError('التلاوة غير متاحة الآن. تحقق من الاتصال وانتظر تحميل قائمة القرّاء.');
      return;
    }
    const request = ++audioRequest.current;
    if (verse.page_id !== currentPage.current) goToPage(verse.page_id);
    ignoreStaleFinish.current = true;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
    pendingAudioAction.current = null;
    setBetweenVerses(false);
    setBetweenPaused(false);
    stopWord();
    player.pause();
    finishHandled.current = true;
    setAudioError(null);
    setAudioVerse(verse);
    setAudioSegment(null);
    setPendingSegment(null);
    try {
      if (reciter >= 1_000_000 && !VERSE_FILE_RECITERS.has(reciter)) {
        const timing = await getQuranAyahTimings(reciter, verse.chapter_id, verse.number);
        if (request !== audioRequest.current) return;
        if (!timing.synchronized || timing.verseEndMs <= timing.verseStartMs) {
          throw new Error('توقيت التلاوة غير متاح');
        }
        const segment: AudioSegment = {
          startMs: timing.verseStartMs,
          endMs: timing.verseEndMs,
          segments: Array.isArray(timing.segments) ? timing.segments.filter(item =>
            Number.isInteger(item.wordPosition) && item.wordPosition > 0
            && Number.isFinite(item.startMs) && Number.isFinite(item.endMs) && item.endMs > item.startMs) : [],
        };
        const audioUrl = timing.audioUrl.startsWith('/api/')
          ? `${quranApiOrigin}${timing.audioUrl}` : timing.audioUrl;
        if (currentChapterSource.current !== audioUrl) {
          currentChapterSource.current = audioUrl;
          setPendingSegment({ ...segment, request, seenUnloaded: false });
          player.replace({ uri: audioUrl });
          player.setPlaybackRate(speed);
        } else {
          await player.seekTo(segment.startMs / 1000);
          if (request !== audioRequest.current) return;
          setAudioSegment(segment);
          player.setPlaybackRate(speed);
          finishHandled.current = false;
          player.play();
        }
      } else {
        currentChapterSource.current = null;
        setAudioSegment(null);
        player.replace({ uri: `${quranApiOrigin}/api/quran/audio/${reciter}/${verse.chapter_id}/${verse.number}` });
        player.setPlaybackRate(speed);
        finishHandled.current = false;
        player.play();
      }
    } catch (error) {
      if (request !== audioRequest.current) return;
      console.warn('تعذّر بدء التلاوة', error);
      player.pause();
      currentChapterSource.current = null;
      setAudioVerse(null);
      setPendingSegment(null);
      setAudioError('تعذّر تشغيل هذا القارئ أو تحميل توقيت الآية. تحقق من الاتصال أو اختر قارئًا آخر.');
      setAudioTab('reciters'); setSheet('audio');
    }
  }, [activeReciter, player, speed, stopWord, goToPage]);
  useEffect(() => {
    if (!pendingSegment || pendingSegment.request !== audioRequest.current) return;
    // replace() is asynchronous on native. An isLoaded=true from the previous
    // source must never cause us to seek to the new verse in the old recording.
    if (!audioStatus.isLoaded) {
      if (!pendingSegment.seenUnloaded) setPendingSegment({ ...pendingSegment, seenUnloaded: true });
      return;
    }
    if (!pendingSegment.seenUnloaded) return;
    const { request, startMs, endMs, segments } = pendingSegment;
    setPendingSegment(null);
    player.seekTo(startMs / 1000).then(() => {
      if (request !== audioRequest.current) return;
      setAudioSegment({ startMs, endMs, segments });
      finishHandled.current = false;
      player.play();
    }).catch(() => {
      if (request !== audioRequest.current) return;
      player.pause();
      currentChapterSource.current = null;
      setAudioVerse(null);
      setAudioError('تعذّر تحديد موضع الآية في تسجيل القارئ. اختر قارئًا آخر.');
      setAudioTab('reciters'); setSheet('audio');
    });
  }, [pendingSegment, audioStatus.isLoaded, player]);
  useEffect(() => {
    if (!pendingSegment) return;
    const request = pendingSegment.request;
    const timeout = setTimeout(() => {
      if (request !== audioRequest.current) return;
      ++audioRequest.current;
      player.pause();
      currentChapterSource.current = null;
      setPendingSegment(null);
      setAudioVerse(null);
      setAudioError('انتهت مهلة تحميل تسجيل القارئ. تحقق من الاتصال وحاول مجددًا.');
      setAudioTab('reciters'); setSheet('audio');
    }, 15000);
    return () => clearTimeout(timeout);
  }, [pendingSegment?.request, player]);
  useEffect(() => {
    if (!audioStatus.didJustFinish) ignoreStaleFinish.current = false;
    const reachedEnd = audioSegment
      ? audioStatus.isLoaded && audioStatus.playing && player.currentTime >= audioSegment.endMs / 1000 - .08
      : audioStatus.didJustFinish;
    if (!audioSegment && audioStatus.didJustFinish && ignoreStaleFinish.current) return;
    if (!reachedEnd) {
      if (!audioSegment && !audioStatus.didJustFinish) finishHandled.current = false;
      return;
    }
    if (finishHandled.current) return;
    finishHandled.current = true;
    if (!audioVerse) return;
    if (audioSegment) player.pause();
    const request = audioRequest.current;
    const configuredRange = rangeSession && rangeChapter === audioVerse.chapter_id
      && rangeStart !== null && rangeEnd !== null && rangeStart <= rangeEnd;
    const stop = () => {
      setAudioVerse(null);
      setAudioSegment(null);
      setPlayed(0);
      setRangePlayed(0);
      setRangeSession(false);
      setBetweenVerses(false);
      setBetweenPaused(false);
    };
    const afterPause = (action: () => void) => {
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      pendingAudioAction.current = action;
      pauseRequest.current = request;
      pauseRemaining.current = pauseBetween * 1000;
      setBetweenVerses(true);
      setBetweenPaused(false);
      schedulePendingPause(request, pauseRemaining.current);
    };
    const transitionTo = (target: Verse, nextPlayed = 0, nextRangePlayed = rangePlayed) => {
      setPlayed(nextPlayed);
      setRangePlayed(nextRangePlayed);
      afterPause(() => { void playVerse(target); });
    };

    if (configuredRange && audioVerse.number >= rangeStart && audioVerse.number <= rangeEnd) {
      if (repeatMode === 'ayah') {
        if (repeat === -1 || played + 1 < repeat) {
          setPlayed(value => value + 1);
          afterPause(() => {
            player.seekTo(audioSegment ? audioSegment.startMs / 1000 : 0).then(() => {
              if (request !== audioRequest.current) return;
              finishHandled.current = false;
              player.play();
            }).catch(() => {
              if (request === audioRequest.current) setAudioError('تعذّر تكرار الآية');
            });
          });
          return;
        }
        setPlayed(0);
        if (audioVerse.number < rangeEnd) {
          const next = verses.find(v => v.chapter_id === audioVerse.chapter_id && v.number === audioVerse.number + 1);
          if (next) { transitionTo(next); return; }
        }
        stop();
        return;
      }
      if (audioVerse.number < rangeEnd) {
        const next = verses.find(v => v.chapter_id === audioVerse.chapter_id && v.number === audioVerse.number + 1);
        if (next) { transitionTo(next); return; }
      }
      if (repeat === -1 || rangePlayed + 1 < repeat) {
        const first = verses.find(v => v.chapter_id === audioVerse.chapter_id && v.number === rangeStart);
        if (first) { transitionTo(first, 0, rangePlayed + 1); return; }
      }
      stop();
      return;
    }

    if (repeat === -1 || played + 1 < repeat) {
      setPlayed(value => value + 1);
      afterPause(() => {
        player.seekTo(audioSegment?.startMs ? audioSegment.startMs / 1000 : 0).then(() => {
          if (request !== audioRequest.current) return;
          finishHandled.current = false;
          player.play();
        }).catch(() => {
          if (request === audioRequest.current) setAudioError('تعذّر تكرار الآية');
        });
      });
      return;
    }
    setPlayed(0);
    const next = verses.find(v => v.chapter_id === audioVerse.chapter_id && v.number === audioVerse.number + 1);
    if (stopAt === 'ayah' || !next || (stopAt === 'page' && next.page_id !== audioVerse.page_id)
      || (stopAt === 'surah' && next.chapter_id !== audioVerse.chapter_id)) {
      stop();
      return;
    }
    transitionTo(next);
  }, [audioStatus.currentTime, audioStatus.didJustFinish, audioStatus.isLoaded, audioStatus.playing,
    audioSegment, audioVerse, played, rangePlayed, repeat, repeatMode, rangeChapter, rangeStart, rangeEnd,
    rangeSession, pauseBetween, stopAt, player, playVerse, schedulePendingPause]);
  const stopAudio = () => {
    ++audioRequest.current;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
    pendingAudioAction.current = null;
    setBetweenVerses(false);
    setBetweenPaused(false);
    player.pause();
    setAudioVerse(null);
    setAudioSegment(null);
    setPendingSegment(null);
    setPlayed(0);
    setRangePlayed(0);
    setRangeSession(false);
  };
  const toggleAudioPlayback = () => {
    if (betweenVerses && pendingAudioAction.current) {
      if (betweenPaused) {
        setBetweenPaused(false);
        schedulePendingPause(pauseRequest.current, pauseRemaining.current);
      } else {
        if (pauseTimer.current) clearTimeout(pauseTimer.current);
        pauseTimer.current = null;
        pauseRemaining.current = Math.max(0, pauseDeadline.current - Date.now());
        setBetweenPaused(true);
      }
      return;
    }
    if (audioStatus.playing) player.pause();
    else player.play();
  };
  const playWord = (word: WordSelection) => {
    const key = `${word.verseKey}:${word.position}`;
    if (wordAudioKey === key && wordStatus.playing) { stopWord(); return; }
    if (!quranApiOrigin) {
      setWordError('نطق الكلمات يحتاج اتصالًا بخدمة حصاد.');
      return;
    }
    stopAudio();
    setWordError(null);
    setWordAudioKey(key);
    const [chapter, verseNumber] = word.verseKey.split(':').map(Number);
    try {
      wordPlayer.replace({ uri: `${quranApiOrigin}/api/quran/audio/word/${chapter}/${verseNumber}/${word.position}` });
      wordPlayer.play();
    } catch (error) {
      console.warn('تعذر بدء نطق الكلمة', error);
      setWordError('تعذّر تشغيل نطق هذه الكلمة.');
      setWordAudioKey(null);
    }
  };
  const moveAudio = (direction: -1 | 1) => {
    if (!audioVerse) return;
    if (rangeSession && rangeChapter === audioVerse.chapter_id
      && ((direction < 0 && rangeStart !== null && audioVerse.number <= rangeStart)
        || (direction > 0 && rangeEnd !== null && audioVerse.number >= rangeEnd))) return;
    const target = verses.find(v => v.chapter_id === audioVerse.chapter_id && v.number === audioVerse.number + direction);
    if (target) {
      setPlayed(0);
      setRangePlayed(0);
      if (target.page_id !== page) goToPage(target.page_id);
      playVerse(target);
    }
  };
  const openVerse = (verse: Verse) => {
    setSelectedVerse(verse);
    setSelectedWord(null);
    setSheet('verse');
  };
  const openPrintedWord = (selection: WordSelection | { verseKey: string }) => {
    const [chapter, verseNumber] = selection.verseKey.split(':').map(Number);
    const verse = visibleVerses.find(v => v.chapter_id === chapter && v.number === verseNumber);
    if (!verse) return;
    setSelectedVerse(verse);
    setSelectedWord('id' in selection ? selection : null);
    setWordError(null);
    setSheet('id' in selection ? 'word' : 'verse');
  };
  const beginPractice = (verse: Verse) => {
    setSelectedVerse(verse);
    startPractice(verse.chapter_id, verse.number);
    setSheet('memorize');
  };
  const resumePractice = () => {
    const saved = practice && verses.find(v => v.chapter_id === practice.chapter && v.number === practice.verse);
    const target = saved ?? visibleVerses[0];
    if (target) {
      if (!saved) startPractice(target.chapter_id, target.number);
      setSelectedVerse(target);
      setSheet('memorize');
    }
  };
  const shareVerse = async () => {
    if (!selectedVerse) return;
    await Share.share({ message: `${selectedVerse.content}\nسورة ${chapterName(selectedVerse.chapter_id)}، الآية ${selectedVerse.number}` });
  };
  const copyVerse = async () => {
    if (selectedVerse) await Clipboard.setStringAsync(`${selectedVerse.content}\nسورة ${chapterName(selectedVerse.chapter_id)}، الآية ${selectedVerse.number}`);
  };

  const stageHeight = Math.max(1, compactLandscape
    ? viewport.height - Math.max(topInset, 8) - bottomInset - 44 - (audioVerse ? 100 : 12)
    : viewport.height - topInset - bottomInset - (readingMode ? audioVerse ? 116 : 36 : audioVerse ? 228 : 132));
  const enteredPage = pageNumberFromInput(pageInput);
  const pageInputValid = enteredPage !== null;
  const imageWidth = Math.min(viewport.width - (compactLandscape ? 110 : 12), Math.max(0, stageHeight) * (382.677 / 547.086));
  const imageHeight = imageWidth * (547.086 / 382.677);
  const wordWidth = landscape
    ? Math.max(1, viewport.width - insets.left - insets.right - (compactLandscape ? 100 : 24))
    : Math.min(viewport.width - 12, 640);
  const { panHandlers, onStageLayout, zoomStyle, zoomed, resetZoom } = usePageZoom({
    page, display: pageDisplay, readingMode, viewportWidth: viewport.width,
    viewportHeight: viewport.height, pageWidth: pageDisplay === 'words' ? wordWidth : imageWidth,
    pageHeight: pageDisplay === 'words' ? stageHeight : imageHeight, onTurn: turnPage,
  });
  if (!reader.ready) return <View style={[styles.center, { backgroundColor: surface }]}><ActivityIndicator color={colors.primary} /></View>;
  const menuStyle = { backgroundColor: colors.card, borderColor: colors.border };
  const rangeUiChapter = audioVerse?.chapter_id ?? selectedVerse?.chapter_id ?? visibleVerses[0]?.chapter_id ?? 1;
  const rangeUiChapterLength = chapters.find(chapter => chapter.id === rangeUiChapter)?.verse_count ?? 1;
  const rangeSuggestedStart = (audioVerse?.chapter_id === rangeUiChapter ? audioVerse.number
    : selectedVerse?.chapter_id === rangeUiChapter ? selectedVerse.number
      : visibleVerses.find(v => v.chapter_id === rangeUiChapter)?.number) ?? 1;
  const rangeUiStart = rangeChapter === rangeUiChapter && rangeStart !== null ? rangeStart : rangeSuggestedStart;
  const rangeUiEnd = rangeChapter === rangeUiChapter && rangeEnd !== null ? rangeEnd : rangeUiStart;
  const rangeIsConfigured = rangeChapter === rangeUiChapter && rangeStart !== null && rangeEnd !== null;
  const saveRange = (start: number, end: number) => updateAudio({
    rangeChapter: rangeUiChapter, rangeStart: start, rangeEnd: end,
  });

  return (
    <View testID="mushaf-reader" style={[styles.root, { backgroundColor: surface }]}>
      {keepAwake && Platform.OS !== 'web' && <ReaderKeepAwake />}
       <View style={[styles.header, compactLandscape && styles.landscapeHeader,
         { paddingTop: topInset + 4, pointerEvents: compactLandscape ? 'box-none' : 'auto' }]}>
        {!readingMode && (
          <>
            <IconButton name="menu-outline" label="الفهرس" onPress={() => setSheet('index')} color={fg} />
             <View style={[styles.headerTitle, compactLandscape && { opacity: 0, pointerEvents: 'none' }]}>
              <Text numberOfLines={1} style={[styles.surahName, { color: fg }]}>{pageLabel(page)}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>الجزء {pageInfo?.part_id}  ·  صفحة {page}</Text>
            </View>
            <IconButton name="search-outline" label="البحث" onPress={() => setSheet('search')} color={fg} />
            <IconButton name="bookmark-outline" label="العلامات" onPress={() => setSheet('bookmarks')} color={fg} />
            <IconButton name="headset-outline" label="التلاوة" onPress={() => openAudio()} color={fg} active={!!audioVerse} />
            <IconButton name="layers-outline" label="حفظني" onPress={resumePractice} color={fg} />
          </>
        )}
        {readingMode && !compactLandscape && <Text style={[styles.readingHint, { color: colors.mutedForeground }]}>وضع القراءة · المس الصفحة لإظهار الأدوات</Text>}
      </View>
      {!!storageError && <Text style={[styles.storageWarning, { color: colors.destructive }]}>{storageError}</Text>}
       <View testID="page-stage" style={[styles.pageStage, compactLandscape && { paddingTop: topInset + 44, paddingBottom: bottomInset },
         Platform.OS === 'web' && ({ touchAction: 'none' } as ViewStyle)]}
         onLayout={onStageLayout} {...panHandlers}>
        <Animated.View testID="page-zoom-layer" style={[{
          width: pageDisplay === 'words' ? wordWidth : imageWidth,
          height: pageDisplay === 'words' ? stageHeight : imageHeight,
        }, zoomStyle]}>
        {pageDisplay === 'words'
           ? <MadaniWordPage key={page} page={page} width={wordWidth} height={stageHeight}
              background={paper} selectedVerseKey={selectedVerse ? `${selectedVerse.chapter_id}:${selectedVerse.number}` : null}
               activeVerseKey={audioVerse ? `${audioVerse.chapter_id}:${audioVerse.number}` : null}
               activeWordPosition={activeWordPosition} tajweedEnabled={tajweedEnabled}
              onVersePress={openPrintedWord} />
          : <Pressable testID="mushaf-page" accessibilityRole="button" accessibilityLabel={`صورة صفحة المصحف ${page}، اضغط لإظهار أدوات القراءة`}
              onPress={() => setReadingMode(!readingMode)} style={[styles.paper, {
                backgroundColor: paper, width: imageWidth, height: imageHeight,
                borderColor: colors.border,
              }, Platform.OS === 'web'
                ? { boxShadow: '0 7px 16px rgba(27,56,35,.09)' }
                : { shadowColor: '#1b3823', shadowRadius: 15, shadowOpacity: .09, elevation: 3 }]}>
              {!imageError
                ? <Image source={pageImage(page)} style={[styles.pageImage, page <= 2 && { transform: [{ scale: 1.65 }] }]}
                    contentFit="contain" cachePolicy="disk"
                    onError={() => setImageError(true)} accessible accessibilityLabel={`صورة الصفحة ${page} من مصحف المدينة`} />
                 : <ScrollView testID="offline-verses" style={{ width: '100%' }} contentContainerStyle={{ padding: 18 }}>
                     <Text style={[styles.note, { color: colors.mutedForeground }]}>تعذّر عرض صورة الصفحة؛ يظهر نص الآيات المحفوظ بدلًا منها.</Text>
                     {visibleVerses.map(verse => <Text key={verse.id} style={{ color: fg, fontSize: 21, lineHeight: 44, textAlign: 'right', writingDirection: 'rtl' }}>
                       {verse.content} ﴿{verse.number}﴾
                     </Text>)}
                     <Pressable onPress={() => setImageError(false)}><Text style={{ color: colors.primary, textAlign: 'right' }}>إعادة تحميل الصورة</Text></Pressable>
                   </ScrollView>}
            </Pressable>}
        </Animated.View>
        {zoomed && <Pressable testID="reset-page-zoom" accessibilityRole="button" accessibilityLabel="إعادة الصفحة إلى الحجم الأصلي"
          onPress={resetZoom} style={[styles.zoomReset, compactLandscape && { top: topInset + 52, bottom: undefined },
            { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="contract-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>الحجم الأصلي</Text>
        </Pressable>}
        {pageDisplay === 'words' && readingMode &&
          <View style={styles.showTools}>
            <IconButton name="options-outline" label="إظهار أدوات القراءة" onPress={() => setReadingMode(false)} color={fg} />
          </View>}
      </View>
       {!!audioVerse && <View style={[styles.audioDock, compactLandscape && [styles.landscapeAudioDock, { bottom: bottomInset + 2 }], { backgroundColor: colors.secondary }]}>
         <View style={styles.audioTransport}>
           <IconButton name="close" label="إيقاف التلاوة" onPress={stopAudio} color={fg} />
           <IconButton name="play-skip-forward" label="الآية السابقة" onPress={() => moveAudio(-1)} color={fg} />
           <IconButton name={(betweenVerses && !betweenPaused) || audioStatus.playing ? 'pause' : 'play'}
             label={(betweenVerses && !betweenPaused) || audioStatus.playing ? 'إيقاف مؤقت' : 'استئناف'}
             onPress={toggleAudioPlayback} color={colors.primary} />
           <IconButton name="play-skip-back" label="الآية التالية" onPress={() => moveAudio(1)} color={fg} />
           <Pressable accessibilityRole="button" accessibilityLabel="إعدادات التلاوة" onPress={() => openAudio()} style={styles.audioCaption}>
             <Text numberOfLines={1} style={{ color: fg }}>سورة {chapterName(audioVerse.chapter_id)} · {audioVerse.number}</Text>
           </Pressable>
         </View>
         <View style={styles.audioQuickRow}>
           <Pressable testID="audio-repeat-button" accessibilityRole="button" accessibilityLabel={`خيارات التكرار، ${repeat === -1 ? 'مستمر' : `${repeat} مرات`}`}
             onPress={() => openAudio('playback')}
             style={({ pressed }) => [styles.audioQuickButton, { backgroundColor: colors.card, opacity: pressed ? .6 : 1 }]}>
             <Ionicons name="repeat-outline" size={17} color={colors.primary} />
             <Text numberOfLines={1} style={[styles.audioQuickLabel, { color: fg }]}>
               {compactLandscape ? 'تكرار' : 'التكرار ·'} {repeat === -1 ? compactLandscape ? '∞' : 'مستمر' : `${repeat}×`}
             </Text>
           </Pressable>
           <Pressable testID="audio-speed-button" accessibilityRole="button" accessibilityLabel={`سرعة التشغيل، ${speed} ضعف`}
             onPress={() => openAudio('playback')}
             style={({ pressed }) => [styles.audioQuickButton, { backgroundColor: colors.card, opacity: pressed ? .6 : 1 }]}>
             <Ionicons name="speedometer-outline" size={17} color={colors.primary} />
             <Text numberOfLines={1} style={[styles.audioQuickLabel, { color: fg }]}>
               {compactLandscape ? 'سرعة' : 'السرعة ·'} {speed}×
             </Text>
           </Pressable>
         </View>
      </View>}
      {!readingMode && <View style={[styles.dock, compactLandscape && {
        position: 'absolute', right: 7, top: Math.max(topInset, 8) + 64,
        flexDirection: 'column', paddingTop: 0,
      }, { paddingBottom: compactLandscape ? 0 : bottomInset + 6 }]}>
        <IconButton name="chevron-forward" label="الصفحة السابقة" onPress={() => navigate(page - 1)} color={fg} />
        <Pressable onPress={() => { setPageInput(String(page)); setSheet('index'); }}
          style={[styles.pagePill, menuStyle]} accessibilityRole="button" accessibilityLabel={`الانتقال إلى صفحة، الحالية ${page}`}>
          <Text style={[styles.pagePillText, { color: fg }]}>{page} / {PAGE_COUNT}</Text>
        </Pressable>
        <IconButton name="chevron-back" label="الصفحة التالية" onPress={() => navigate(page + 1)} color={fg} />
        <View style={[styles.dockDivider, compactLandscape && { height: 1, width: 26 }, { backgroundColor: colors.border }]} />
        <IconButton name="list-outline" label="آيات الصفحة" onPress={() => setSheet('verses')} color={fg} />
        <IconButton name="settings-outline" label="الإعدادات" onPress={() => setSheet('settings')} color={fg} />
      </View>}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.modalFrame}>
          <Pressable style={styles.scrim} onPress={close} accessibilityLabel="إغلاق اللوحة" />
          <View style={[styles.sheet, menuStyle, {
            paddingBottom: bottomInset + 14,
            maxHeight: viewport.height * (sheet === 'audio' && compactLandscape ? .94 : .84),
          }, sheet === 'audio' && { height: Math.min(viewport.height * (compactLandscape ? .94 : .84), 700) }]}>
             <View style={[styles.sheetHeading, compactLandscape && { height: 50 }]}>
              <IconButton name="close" label="إغلاق" color={fg} onPress={close} />
              <Text style={[styles.sheetTitle, { color: fg }]}>{
                sheet === 'index' ? 'فهرس المصحف' : sheet === 'search' ? 'البحث في القرآن' :
                  sheet === 'bookmarks' ? 'علاماتي' : sheet === 'settings' ? 'إعدادات القراءة' :
                    sheet === 'word' ? 'خيارات الكلمة' :
                    sheet === 'verses' ? `آيات الصفحة ${page}` : sheet === 'memorize' ? 'حفظني' :
                      sheet === 'audio' ? 'التلاوة' : sheet === 'tafsir' ? 'تفسير الآية' :
                        sheet === 'range' ? 'نسخ ومشاركة نطاق آيات' : 'خيارات الآية'
              }</Text>
              <View style={{ width: 44 }} />
            </View>
            {sheet === 'index' && <>
              <View style={styles.pageFormInline}>
                <TextInput value={pageInput} onChangeText={setPageInput} keyboardType="number-pad" maxLength={3}
                  style={[styles.input, styles.pageInput, { color: fg, borderColor: colors.border }]}
                  placeholder="رقم الصفحة" placeholderTextColor={colors.mutedForeground} textAlign="right" />
                 <Pressable accessibilityRole="button" accessibilityLabel="الانتقال إلى الصفحة" disabled={!pageInputValid}
                   style={[styles.primaryButton, styles.pageSubmit, { backgroundColor: colors.primary, opacity: pageInputValid ? 1 : .45 }]}
                   onPress={() => { if (enteredPage !== null) navigate(enteredPage); }}><Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>انتقال</Text></Pressable>
              </View>
               {!pageInputValid && !!pageInput.trim() && <Text style={[styles.inputHint, { color: colors.destructive }]}>أدخل رقم صفحة من 1 إلى {PAGE_COUNT}</Text>}
              <View style={styles.segment}>
                {([['chapters', 'السور'], ['parts', 'الأجزاء'], ['bookmarks', 'العلامات']] as const).map(([id, label]) =>
                   <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}
                     style={[styles.segmentItem, tab === id && { backgroundColor: colors.secondary }]}
                    onPress={() => setTab(id)}><Text style={[styles.segmentText, { color: tab === id ? colors.primary : colors.mutedForeground }]}>{label}</Text></Pressable>)}
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
                  {tab === 'chapters' ? chapters.map(chapter =>
                    <Row key={chapter.id} title={chapter.name} detail={`سورة ${chapter.id} · ${chapter.verse_count} آية · ص ${firstPageOfChapter(chapter.id)}`}
                      onPress={() => navigate(firstPageOfChapter(chapter.id))} colors={colors} />)
                    : tab === 'parts' ? parts.map(part => <Row key={part.id} title={part.name} detail={`ص ${firstPageOfPart(part.id)}`}
                      onPress={() => navigate(firstPageOfPart(part.id))} colors={colors} />)
                      : bookmarks.map(bookmark => <Row key={`${bookmark.chapter}:${bookmark.verse}`}
                        title={`سورة ${chapterName(bookmark.chapter)} · الآية ${bookmark.verse}`}
                         detail={`${bookmarkCategoryLabels[bookmark.category]} · الصفحة ${bookmark.page}`} onPress={() => navigate(bookmark.page)} colors={colors} />)}
                  {tab === 'bookmarks' && !bookmarks.length && <Text style={[styles.empty, { color: colors.mutedForeground }]}>لا توجد علامات محفوظة</Text>}
              </ScrollView>
            </>}
            {sheet === 'search' && <>
              <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="ابحث عن كلمة أو سورة أو صفحة"
                placeholderTextColor={colors.mutedForeground} style={[styles.input, styles.searchInput, { color: fg, borderColor: colors.border }]}
                textAlign="right" testID="search-input" />
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {numericPage !== null &&
                  <Row title={`الصفحة ${numericPage}`} detail="انتقال مباشر" onPress={() => navigate(numericPage)} colors={colors} />}
                {matchingChapters.map(chapter => <Row key={`c${chapter.id}`} title={`سورة ${chapter.name}`}
                  detail={`صفحة ${firstPageOfChapter(chapter.id)}`} onPress={() => navigate(firstPageOfChapter(chapter.id))} colors={colors} />)}
                {results.map(verse => <Row key={verse.id} title={verse.content} detail={`سورة ${chapterName(verse.chapter_id)} · آية ${verse.number} · صفحة ${verse.page_id}`}
                  onPress={() => { navigate(verse.page_id); setSelectedWord(null); setSelectedVerse(verse); setSheet('verse'); }} colors={colors} />)}
                {!!query.trim() && !results.length && !matchingChapters.length && numericPage === null &&
                  <Text style={[styles.empty, { color: colors.mutedForeground }]}>لا توجد نتائج مطابقة</Text>}
                {!query.trim() && <Text style={[styles.empty, { color: colors.mutedForeground }]}>البحث متاح دون إنترنت في النص المعتمد بالمشروع</Text>}
              </ScrollView>
            </>}
            {sheet === 'bookmarks' && <ScrollView style={styles.list}>
              {bookmarks.length ? bookmarks.map(bookmark =>
                <Row key={`${bookmark.chapter}:${bookmark.verse}`} title={`سورة ${chapterName(bookmark.chapter)} · الآية ${bookmark.verse}`}
                   detail={`${bookmarkCategoryLabels[bookmark.category]} · الصفحة ${bookmark.page}`} onPress={() => {
                    navigate(bookmark.page);
                    setSelectedWord(null);
                    setSelectedVerse(verses.find(v => v.chapter_id === bookmark.chapter && v.number === bookmark.verse) ?? null);
                    setSheet('verse');
                  }} colors={colors} />)
                : <Text style={[styles.empty, { color: colors.mutedForeground }]}>لا توجد علامات بعد. اختر آية من قائمة آيات الصفحة لإضافتها.</Text>}
            </ScrollView>}
            {sheet === 'settings' && <ScrollView style={styles.list}>
               <Text style={[styles.sectionTitle, { color: fg }]}>القراءة دون إنترنت</Text>
                <Row title={pageDisplay === 'images' ? 'اعرض الكلمات التفاعلية' : 'اعرض صور صفحات المصحف المحلية'}
                 detail={Platform.OS === 'web'
                   ? 'النص محفوظ؛ صور لم تُفتح قد تحتاج اتصالًا في معاينة المتصفح'
                   : 'صور المصحف تعمل دون اتصال · التلاوة تحتاج اتصالًا'}
                  onPress={() => { setPageDisplay(pageDisplay === 'images' ? 'words' : 'images'); close(); }} colors={colors} />
               <Text style={[styles.note, { color: colors.mutedForeground }]}>في تطبيق الجوال: 604 صفحات مصورة ونص 6236 آية للبحث والفهرس، مضمنة دون تنزيل إضافي. العلامات تُحفظ على الجهاز.{Platform.OS === 'web' ? ' معاينة المتصفح تحتاج اتصالًا لصور لم تُفتح من قبل، ويظهر نص الآيات بدلًا منها عند تعذّر الصورة.' : ''}</Text>
               <Text style={[styles.sectionTitle, { color: fg }]}>محتوى إضافي دون إنترنت</Text>
               <Text style={[styles.note, { color: colors.mutedForeground }]}>مصدر بيانات الكلمات: Quran Foundation · mushafs:1 (QCF V2). مصدر الشرح: التفسير الميسر عبر Quran Foundation · tafsirs:16. اختر التنزيل أول مرة (نحو 28 م.ب للبيانات، والخطوط اختيارية ومنفصلة). تُفحص التغييرات بعد ذلك عند فتح التطبيق والعودة إليه، ولا تُعرض نسخة مرّ على فحصها 7 أيام حتى تتجدد.</Text>
               {(['mushafs', 'tafsirs'] as const).map(group => {
                 const meta = offlineContent.manifests[group];
                 const title = group === 'mushafs' ? 'مواضع كلمات المصحف' : 'التفسير الميسر';
                 return <Text key={group} style={[styles.note, { color: colors.mutedForeground }]}>
                   {title} · {meta && offlineContent.available(group)
                     ? `محفوظ ≈ ${(meta.bytes / 1024 / 1024).toFixed(1)} م.ب · آخر فحص ${new Date(meta.checkedAt).toLocaleDateString('ar')}`
                     : meta ? 'يحتاج تحديثًا (مرّ 7 أيام)' : 'لم يُنزّل'}
                 </Text>;
               })}
               {Platform.OS !== 'web'
                 ? <Row title="تنزيل / تحديث الكلمات والتفسير" detail="يلزم اتصال بالإنترنت؛ نحو 28 م.ب أول مرة" onPress={() => { void offlineContent.syncNow(); }} colors={colors} />
                 : <Text style={[styles.note, { color: colors.mutedForeground }]}>تنزيل المحتوى التفاعلي للاستخدام دون اتصال متاح في تطبيق الهاتف فقط، وليس معاينة المتصفح.</Text>}
               <Text style={[styles.note, { color: colors.mutedForeground }]}>
                 خطوط QCF V2 من static.qurancdn.com (Quran Foundation) · {Platform.OS === 'web'
                   ? 'معاينة المتصفح لا تحفظ الخطوط؛ العرض التفاعلي بلا اتصال غير متاح فيها.'
                   : `${offlineContent.fontCount} / 604 صفحة محفوظة · ${(offlineContent.fontBytes / 1024 / 1024).toFixed(1)} م.ب`}
               </Text>
               {Platform.OS !== 'web' && <Row title="تنزيل خطوط الصفحات للقراءة التفاعلية" detail="تنزيل اختياري كبير، يمكن إيقافه واستكماله لاحقًا"
                 onPress={() => { void offlineContent.downloadFonts(); }} colors={colors} />}
               {offlineContent.progress && <>
                 <Text testID="content-sync-progress" style={[styles.note, { color: colors.primary }]}>{offlineContent.progress}</Text>
                 {offlineContent.progress.startsWith('خطوط') && <Row title="إيقاف تنزيل الخطوط" detail="تبقى الخطوط المكتملة محفوظة"
                   onPress={offlineContent.cancelFonts} colors={colors} />}
               </>}
               {offlineContent.error && <Text style={[styles.note, { color: colors.destructive }]}>{offlineContent.error}</Text>}
                <Text style={[styles.note, { color: colors.mutedForeground }]}>الخطوط مورد منفصل عن بيانات Content Sync. عدم تنزيل خط صفحة معينة يمنع عرض كلماتها بخط المصحف بلا إنترنت، وتبقى صورتها متاحة. نطق الكلمات ومعانيها وترجمتها والتلاوة تحتاج الاتصال؛ خط ألوان التجويد يُحفظ عند عرضه أول مرة.</Text>
              <Row title="التلاوة" detail="القرّاء والتكرار والسرعة" onPress={() => openAudio()} colors={colors} />
              <Text style={[styles.sectionTitle, { color: fg }]}>طريقة عرض المصحف</Text>
               <Row title={tajweedEnabled ? 'ألوان التجويد مفعّلة' : 'تفعيل ألوان التجويد'}
                 detail="خط QCF V4 الرسمي للكلمات التفاعلية؛ دليل قابل للفتح على الصفحة"
                 onPress={() => { setTajweedEnabled(!tajweedEnabled); if (pageDisplay !== 'words') setPageDisplay('words'); }}
                 colors={colors} />
              <View style={styles.segment}>
                {([['words', 'كلمات تفاعلية'], ['images', 'صور الصفحات']] as [PageDisplay, string][]).map(([id, label]) =>
                   <Pressable key={id} accessibilityRole="button" accessibilityLabel={label}
                     accessibilityState={{ selected: pageDisplay === id }} testID={`display-${id}`}
                    style={[styles.segmentItem, pageDisplay === id && { backgroundColor: colors.secondary }]}
                    onPress={() => setPageDisplay(id)}>
                    <Text style={[styles.segmentText, { color: pageDisplay === id ? colors.primary : fg }]}>{label}</Text>
                  </Pressable>)}
              </View>
                <Text style={[styles.note, { color: colors.mutedForeground }]}>الكلمات التفاعلية تعمل دون اتصال للصفحات التي حُفظت بياناتها وخطّها، وإلا تُعرض صورة الصفحة المضمّنة. صور الصفحات متاحة دائمًا على الهاتف.</Text>
              <Text style={[styles.sectionTitle, { color: fg }]}>مظهر المصحف</Text>
              <View style={styles.segment}>
                {([['day', 'نهاري'], ['warm', 'دافئ'], ['night', 'ليلي']] as [Appearance, string][]).map(([id, label]) =>
                   <Pressable key={id} accessibilityRole="button" accessibilityLabel={`مظهر ${label}`}
                     accessibilityState={{ selected: appearance === id }}
                     style={[styles.segmentItem, appearance === id && { backgroundColor: colors.secondary }]}
                    onPress={() => setAppearance(id)}><Text style={[styles.segmentText, { color: appearance === id ? colors.primary : fg }]}>{label}</Text></Pressable>)}
              </View>
              <Row title="وضع القراءة" detail="إخفاء الأدوات لعرض المصحف بوضوح" onPress={() => { setReadingMode(!readingMode); close(); }} colors={colors} />
               {Platform.OS !== 'web' && <Row title={keepAwake ? 'منع انطفاء الشاشة: يعمل' : 'منع انطفاء الشاشة: متوقف'}
                 detail="أبقِ الشاشة مضاءة ما دام المصحف مفتوحًا؛ يمكن إيقافه هنا"
                 onPress={() => setKeepAwake(!keepAwake)} colors={colors} />}
              <Text style={[styles.sectionTitle, { color: fg }]}>حول مصحف حصاد</Text>
                 <Text style={[styles.note, { color: colors.mutedForeground }]}>صور صفحات مصحف المدينة برواية حفص من مجمع الملك فهد لطباعة المصحف الشريف؛ النص المحلي من quran-db (MIT). بيانات مواضع الكلمات والتفسير من Quran Foundation، والخطوط QCF V2/V4 الرسمية. الصور والبحث والعلامات والمتشابهات تعمل محليًا؛ الكلمات والتفسير يعملان دون اتصال بعد تنزيل مواردهما، وألوان التجويد بعد تحميل خط الصفحة. الصوت ومعاني الكلمات تحتاج الاتصال.</Text>
              {privacyUrl
                ? <Row title="سياسة الخصوصية" detail="تفتح في المتصفح"
                    onPress={() => { if (privacyUrl) Linking.openURL(privacyUrl).catch(() => undefined); }} colors={colors} />
                : <Text style={[styles.note, { color: colors.destructive }]}>رابط سياسة الخصوصية غير مُعدّ لنسخة التطبيق النهائية.</Text>}
              <Text style={[styles.note, { color: colors.mutedForeground }]}>الإصدار 1.0.0 · تُحفظ اختيارات القراءة على هذا الجهاز.</Text>
            </ScrollView>}
            {sheet === 'verses' && <ScrollView style={styles.list}>
               <Text style={[styles.note, { color: colors.mutedForeground }]}>{pageDisplay === 'images' ? 'في وضع الصور، اختر الآية هنا؛ الصور ليست مناطق لمس.' : 'يمكنك لمس الكلمة أو رقم الآية على صفحة المصحف، أو اختيار الآية من هذه القائمة.'}</Text>
              {visibleVerses.map(verse => <Row key={verse.id} title={verse.content}
                detail={`سورة ${chapterName(verse.chapter_id)} · الآية ${verse.number}`}
                onPress={() => openVerse(verse)} colors={colors} />)}
            </ScrollView>}
            {sheet === 'word' && selectedWord && <WordActions key={`${selectedWord.verseKey}:${selectedWord.position}`}
              word={selectedWord} onPronounce={() => playWord(selectedWord)}
              playing={wordAudioKey === `${selectedWord.verseKey}:${selectedWord.position}` && wordStatus.playing}
              audioError={wordError} onVerse={() => setSheet('verse')} />}
             {sheet === 'verse' && selectedVerse && <ScrollView style={styles.list}>
               <VerseActions key={selectedVerse.id} verse={selectedVerse}
                 category={bookmarks.find(b => b.chapter === selectedVerse.chapter_id && b.verse === selectedVerse.number)?.category ?? null}
                 onPlay={() => {
                    if (!activeReciter) { openAudio(); return; }
                   setRangeSession(false); setPlayed(0); setRangePlayed(0);
                   void playVerse(selectedVerse);
                   close();
                 }}
                 onTafsir={() => setSheet('tafsir')}
                 onBookmark={category => setBookmarkCategory(selectedVerse.chapter_id, selectedVerse.number, category)}
                 onRemoveBookmark={() => toggleBookmark(selectedVerse.chapter_id, selectedVerse.number)}
                 onCopy={() => { void copyVerse(); close(); }}
                 onCopyRange={() => setSheet('range')}
                 onSimilar={() => { setSheet(null); setSimilarVerseKey(`${selectedVerse.chapter_id}:${selectedVerse.number}`); }}
                 onShare={() => { void shareVerse(); }}
                  onAudioSettings={() => openAudio()}
                 onPractice={() => beginPractice(selectedVerse)} />
             </ScrollView>}
            {sheet === 'range' && (selectedVerse ?? visibleVerses[0]) &&
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                <VerseRangePanel key={(selectedVerse ?? visibleVerses[0]).id} initialVerse={(selectedVerse ?? visibleVerses[0])!} />
              </ScrollView>}
            {sheet === 'tafsir' && selectedVerse && <ScrollView style={styles.list}>
              <Text style={[styles.note, { color: colors.mutedForeground }]}>سورة {chapterName(selectedVerse.chapter_id)} · الآية {selectedVerse.number}</Text>
              <TafsirPanel verse={selectedVerse} />
            </ScrollView>}
            {sheet === 'memorize' && practice && <ScrollView style={styles.list}>
              <GuidedPractice key={`${practice.chapter}:${practice.verse}`}
                verse={verses.find(v => v.chapter_id === practice.chapter && v.number === practice.verse)!}
               onPlay={(verse, times) => {
                 setRangeSession(false); setRangePlayed(0); setRepeat(times); setStopAt('ayah'); setPlayed(0); playVerse(verse);
               }}
                onPause={() => player.pause()} playing={audioStatus.playing} audioError={audioError}
                 onNext={next => { stopAudio(); startPractice(next.chapter_id, next.number); setSelectedVerse(next); goToPage(next.page_id); }}
                 onFinish={() => { stopAudio(); close(); }} />
            </ScrollView>}
            {sheet === 'audio' && <>
              <View style={[styles.audioTabs, { backgroundColor: colors.secondary }]}>
                {([['reciters', 'القرّاء'], ['playback', 'التكرار والسرعة'], ['range', 'النطاق']] as [AudioTab, string][]).map(([id, label]) =>
                  <Pressable key={id} testID={`audio-tab-${id}`} accessibilityRole="tab"
                    accessibilityLabel={label} accessibilityState={{ selected: audioTab === id }}
                    onPress={() => { Keyboard.dismiss(); setAudioTab(id); }}
                    style={[styles.audioTab, audioTab === id && { backgroundColor: colors.card }]}>
                    <Text numberOfLines={1} style={[styles.audioTabLabel, {
                      color: audioTab === id ? colors.primary : colors.mutedForeground,
                    }]}>{label}</Text>
                  </Pressable>)}
              </View>
              <View style={styles.audioContextRow}>
                <Text numberOfLines={1} style={[styles.audioContext, { color: colors.mutedForeground }]}>
                  {audioVerse ? `يُتلى الآن: سورة ${chapterName(audioVerse.chapter_id)} · الآية ${audioVerse.number}`
                    : selectedVerse ? `البداية: سورة ${chapterName(selectedVerse.chapter_id)} · الآية ${selectedVerse.number}`
                      : `البداية: الصفحة ${page}`}
                </Text>
                {compactLandscape && audioTab === 'playback' &&
                  <Text style={[styles.audioScrollHint, { color: colors.mutedForeground }]}>
                    مرّر للأسفل لبقية الخيارات ↓
                  </Text>}
              </View>
              <ScrollView style={styles.audioContent} contentContainerStyle={styles.audioContentBody}
                keyboardShouldPersistTaps="handled">
                {audioTab === 'reciters' && <>
                  {catalog.isPending && !!quranApiOrigin && <ActivityIndicator color={colors.primary} />}
                  {!quranApiOrigin && <Text style={[styles.note, { color: colors.destructive }]}>تحتاج التلاوة إلى عنوان خدمة حصاد الموثوقة.</Text>}
                  {catalog.isError && <View>
                    <Text style={[styles.note, { color: colors.destructive }]}>تعذّر تحميل القرّاء. تحقق من اتصال الإنترنت.</Text>
                    <Pressable accessibilityRole="button" onPress={() => catalog.refetch()}>
                      <Text style={{ color: colors.primary, textAlign: 'right', fontWeight: '700' }}>إعادة المحاولة</Text>
                    </Pressable>
                  </View>}
                  {!!reciters.length && <TextInput value={reciterQuery} onChangeText={setReciterQuery}
                    placeholder="ابحث عن قارئ أو نوع التلاوة" placeholderTextColor={colors.mutedForeground}
                    style={[styles.input, styles.searchInput, { color: fg, borderColor: colors.border }]}
                    textAlign="right" accessibilityLabel="البحث عن قارئ" testID="reciter-search" />}
                  {!!reciterQuery && !shownReciters.length && <Text style={[styles.empty, { color: colors.mutedForeground }]}>لا يوجد قارئ مطابق</Text>}
                  {shownReciters.map(reciter => {
                    const selected = activeReciter === reciter.id;
                    return <Pressable key={reciter.id} accessibilityRole="button"
                      accessibilityLabel={`${reciter.name}، ${recitationStyleLabel(reciter.style)}`}
                      accessibilityState={{ selected }} testID={`audio-reciter-${reciter.id}`}
                      onPress={() => {
                        const start = audioVerse ?? selectedVerse ?? visibleVerses[0];
                        setReciterId(reciter.id);
                        if (start && (!audioVerse || reciter.id !== activeReciter)) {
                          if (!audioVerse) setRangeSession(false);
                          setPlayed(0);
                          setRangePlayed(0);
                          void playVerse(start, reciter.id);
                        }
                        close();
                      }}
                      style={[styles.reciterCard, {
                        backgroundColor: selected ? colors.secondary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      }]}>
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={23}
                        color={selected ? colors.primary : colors.mutedForeground} />
                      <View style={styles.rowBody}>
                        <Text style={[styles.rowTitle, { color: fg }]}>{reciter.name}</Text>
                        <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>{recitationStyleLabel(reciter.style)}</Text>
                      </View>
                    </Pressable>;
                  })}
                  {activeReciter !== null && VERSE_FILE_RECITERS.has(activeReciter) &&
                    <Text style={[styles.note, { color: colors.mutedForeground }]}>
                      تسجيل هذا القارئ بلا توقيت موثّق للكلمات؛ يظهر موضع الآية دون تظليل كلمة غير مؤكّد.
                    </Text>}
                  <Text style={[styles.note, { color: colors.mutedForeground }]}>
                    الاستماع يحتاج اتصالًا بالإنترنت؛ تنزيل تسجيل القارئ غير متاح حاليًا.
                  </Text>
                </>}
                {audioTab === 'playback' && <>
                  <View style={compactLandscape && styles.audioPlaybackTop}>
                  <View style={[styles.audioGroup, compactLandscape && styles.audioPlaybackColumn, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.audioGroupTitle, { color: fg }]}>عدد مرات التكرار</Text>
                    <View style={styles.segment}>
                      {repeats.map(value => <Pressable key={value} accessibilityRole="button"
                        accessibilityLabel={value === -1 ? 'تكرار مستمر' : `تكرار ${value} مرات`}
                        accessibilityState={{ selected: repeat === value }} testID={`audio-repeat-${value}`}
                        style={[styles.audioOption, { backgroundColor: repeat === value ? colors.primary : colors.card }]}
                        onPress={() => { setRepeat(value); setPlayed(0); setRangePlayed(0); }}>
                        <Text style={[styles.audioOptionText, { color: repeat === value ? colors.primaryForeground : fg }]}>
                          {value === -1 ? 'مستمر' : `${value}×`}
                        </Text>
                      </Pressable>)}
                    </View>
                  </View>
                  <View style={[styles.audioGroup, compactLandscape && styles.audioPlaybackColumn, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.audioGroupTitle, { color: fg }]}>سرعة التشغيل</Text>
                    <View style={styles.segment}>{[.75, 1, 1.25].map(value =>
                      <Pressable key={value} accessibilityRole="button" accessibilityLabel={`سرعة ${value} ضعف`}
                        accessibilityState={{ selected: speed === value }} testID={`audio-speed-${value}`}
                        style={[styles.audioOption, { backgroundColor: speed === value ? colors.primary : colors.card }]}
                        onPress={() => { setSpeed(value); player.setPlaybackRate(value); }}>
                        <Text style={[styles.audioOptionText, { color: speed === value ? colors.primaryForeground : fg }]}>{value}×</Text>
                      </Pressable>)}</View>
                  </View>
                  </View>
                  {(!audioVerse || !rangeSession) ? <View style={[styles.audioGroup, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.audioGroupTitle, { color: fg }]}>التوقف بعد</Text>
                    <View style={styles.segment}>
                      {([['ayah', 'آية'], ['page', 'صفحة'], ['surah', 'سورة']] as [StopAt, string][]).map(([id, label]) =>
                        <Pressable key={id} accessibilityRole="button" accessibilityLabel={`التوقف بعد ${label}`}
                          accessibilityState={{ selected: stopAt === id }} testID={`audio-stop-${id}`}
                          style={[styles.audioOption, { backgroundColor: stopAt === id ? colors.primary : colors.card }]}
                          onPress={() => setStopAt(id)}>
                          <Text style={[styles.audioOptionText, { color: stopAt === id ? colors.primaryForeground : fg }]}>{label}</Text>
                        </Pressable>)}
                    </View>
                  </View> : <Text style={[styles.note, { color: colors.mutedForeground }]}>
                    النطاق الجاري يتوقف عند آخر آية فيه؛ يمكنك تغيير طريقة تكراره من تبويب النطاق.
                  </Text>}
                  <View style={[styles.audioGroup, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.audioGroupTitle, { color: fg }]}>الفاصل بين الآيات والتكرار</Text>
                    <View style={styles.segment}>{[0, .5, 1, 2, 3].map(value =>
                      <Pressable key={value} accessibilityRole="button" accessibilityLabel={`فاصل ${value} ثانية`}
                        accessibilityState={{ selected: pauseBetween === value }} testID={`audio-pause-${value}`}
                        style={[styles.audioOption, { backgroundColor: pauseBetween === value ? colors.primary : colors.card }]}
                        onPress={() => updateAudio({ pauseBetween: value })}>
                        <Text style={[styles.audioOptionText, { color: pauseBetween === value ? colors.primaryForeground : fg }]}>
                          {value === 0 ? 'دون' : `${value}ث`}
                        </Text>
                      </Pressable>)}</View>
                  </View>
                  {pageDisplay === 'images' && <Text style={[styles.note, { color: colors.mutedForeground }]}>
                    تظليل الكلمة المنطوقة يظهر في وضع الكلمات التفاعلية، وليس على صورة الصفحة.
                  </Text>}
                </>}
                {audioTab === 'range' && <>
                  <Text style={[styles.note, { color: colors.mutedForeground }]}>
                    حدد آيات من سورة {chapterName(rangeUiChapter)}، ثم ابدأ النطاق من الزر أسفل اللوحة.
                  </Text>
                  <View style={[styles.audioGroup, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.audioGroupTitle, { color: fg }]}>حدود النطاق</Text>
                    {([
                      ['من الآية', rangeUiStart, 1, rangeUiEnd, (value: number) => saveRange(value, rangeUiEnd)],
                      ['إلى الآية', rangeUiEnd, rangeUiStart, rangeUiChapterLength, (value: number) => saveRange(rangeUiStart, value)],
                    ] as [string, number, number, number, (value: number) => void][]).map(([label, value, min, max, setValue]) =>
                      <View key={label} style={styles.rangeRow}>
                        <Text style={[styles.rowTitle, { color: fg, flex: 1 }]}>{label}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={`${label} السابقة`}
                          disabled={value <= min} onPress={() => setValue(value - 1)}
                          style={[styles.rangeStep, { borderColor: colors.border, opacity: value <= min ? .4 : 1 }]}>
                          <Ionicons name="remove" size={18} color={fg} />
                        </Pressable>
                        <VerseNumberInput key={`${rangeUiChapter}-${label}-${value}`} label={label}
                          value={value} min={min} max={max} onCommit={setValue} colors={colors} />
                        <Pressable accessibilityRole="button" accessibilityLabel={`${label} التالية`}
                          disabled={value >= max} onPress={() => setValue(value + 1)}
                          style={[styles.rangeStep, { borderColor: colors.border, opacity: value >= max ? .4 : 1 }]}>
                          <Ionicons name="add" size={18} color={fg} />
                        </Pressable>
                      </View>)}
                  </View>
                  <View style={[styles.audioGroup, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.audioGroupTitle, { color: fg }]}>طريقة التكرار</Text>
                    <View style={styles.segment}>
                      {([['ayah', 'كل آية'], ['range', 'النطاق كاملًا']] as const).map(([id, label]) =>
                        <Pressable key={id} accessibilityRole="button" accessibilityLabel={label}
                          accessibilityState={{ selected: repeatMode === id }} testID={`audio-range-mode-${id}`}
                          style={[styles.audioOption, { backgroundColor: repeatMode === id ? colors.primary : colors.card }]}
                          onPress={() => {
                            updateAudio({ repeatMode: id, ...(id === 'range' && !rangeIsConfigured
                              ? { rangeChapter: rangeUiChapter, rangeStart: rangeUiStart, rangeEnd: rangeUiEnd } : {}) });
                            setPlayed(0); setRangePlayed(0);
                          }}>
                          <Text style={[styles.audioOptionText, { color: repeatMode === id ? colors.primaryForeground : fg }]}>{label}</Text>
                        </Pressable>)}
                    </View>
                  </View>
                  {rangeSession && !!audioVerse && <Text style={[styles.note, { color: colors.mutedForeground }]}>
                    لتطبيق حدود نطاق جديدة أثناء التلاوة، اضغط «بدء النطاق» مرة أخرى.
                  </Text>}
                </>}
              </ScrollView>
              {!!audioError && <Text style={[styles.audioError, { color: colors.destructive }]}>{audioError}</Text>}
              <View style={[styles.audioFooter, { borderColor: colors.border }]}>
                <Pressable testID="audio-start-button" accessibilityRole="button"
                  disabled={!activeReciter && (!audioVerse || audioTab === 'range')}
                  style={[styles.primaryButton, { backgroundColor: colors.primary,
                    opacity: !activeReciter && (!audioVerse || audioTab === 'range') ? .5 : 1 }]}
                  onPress={() => {
                    if (audioVerse && audioTab !== 'range') { close(); return; }
                    const usingRange = audioTab === 'range';
                    const start = usingRange
                      ? verses.find(v => v.chapter_id === rangeUiChapter && v.number === rangeUiStart)
                      : selectedVerse ?? visibleVerses[0];
                    if (!start) return;
                    if (usingRange && !rangeIsConfigured) saveRange(rangeUiStart, rangeUiEnd);
                    setPlayed(0); setRangePlayed(0); setRangeSession(usingRange);
                    if (start.page_id !== currentPage.current) goToPage(start.page_id);
                    void playVerse(start); close();
                  }}>
                  <Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>
                    {audioTab === 'range' ? 'بدء النطاق' : audioVerse ? 'العودة للمصحف' : 'بدء التلاوة'}
                  </Text>
                </Pressable>
              </View>
            </>}
          </View>
        </View>
      </Modal>
      {!!similarVerseKey && <SimilarVersesPanel verseKey={similarVerseKey} onClose={() => setSimilarVerseKey(null)}
        onNavigate={(verseKey, pageId) => {
          const [chapter, ayah] = verseKey.split(':').map(Number);
          goToPage(pageId);
          setSelectedWord(null);
          setSelectedVerse(verses.find(v => v.chapter_id === chapter && v.number === ayah) ?? null);
          setSimilarVerseKey(null);
          setSheet('verse');
        }} />}
    </View>
  );
}

function Row({ title, detail, onPress, colors }: { title: string; detail: string; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}، ${detail}`}
    style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? .55 : 1 }]}>
    <Ionicons name="chevron-back" size={19} color={colors.mutedForeground} />
    <View style={styles.rowBody}>
      <Text style={[styles.rowTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>{detail}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  header: { minHeight: 64, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 6 },
  landscapeHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3, minHeight: 44 },
  headerTitle: { flex: 1, alignItems: 'center', minWidth: 80 },
  surahName: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  iconButton: { width: 43, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  readingHint: { flex: 1, textAlign: 'center', fontSize: 12 },
  storageWarning: { textAlign: 'center', fontSize: 12, paddingHorizontal: 12 },
  pageStage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' },
  zoomReset: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row-reverse', alignItems: 'center',
    gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, minHeight: 38, zIndex: 2 },
  showTools: { position: 'absolute', top: 10, right: 10 },
  paper: { borderWidth: 1, overflow: 'hidden' },
  pageImage: { width: '100%', height: '100%' },
  feedback: { fontSize: 15 },
  dock: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', paddingTop: 8, gap: 6 },
  audioDock: { alignItems: 'center', paddingHorizontal: 8, minHeight: 89 },
  audioTransport: { flexDirection: 'row-reverse', alignItems: 'center', width: '100%' },
  audioQuickRow: { flexDirection: 'row-reverse', gap: 8, width: '100%', paddingBottom: 7 },
  audioQuickButton: { flex: 1, minHeight: 37, borderRadius: 12, flexDirection: 'row-reverse',
    alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6 },
  audioQuickLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  audioTabs: { flexDirection: 'row-reverse', padding: 4, borderRadius: 14, gap: 3, minHeight: 50 },
  audioTab: { flex: 1, minWidth: 0, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  audioTabLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl' },
  audioContextRow: { flexDirection: 'row-reverse', alignItems: 'center' },
  audioContext: { flex: 1, fontSize: 12, textAlign: 'right', writingDirection: 'rtl', marginVertical: 10 },
  audioScrollHint: { fontSize: 11, textAlign: 'left' },
  audioContent: { flex: 1, minHeight: 0 },
  audioContentBody: { paddingBottom: 16 },
  reciterCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 64,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 13, marginBottom: 7 },
  audioGroup: { borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  audioPlaybackTop: { flexDirection: 'row-reverse', gap: 10 },
  audioPlaybackColumn: { flex: 1, minWidth: 0 },
  audioGroupTitle: { fontSize: 15, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  audioOption: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  audioOptionText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  audioError: { fontSize: 12, lineHeight: 19, textAlign: 'right', marginTop: 4 },
  audioFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  landscapeAudioDock: { position: 'absolute', left: 8, bottom: 0, zIndex: 3, borderRadius: 14, width: 260, maxWidth: 260 },
  audioCaption: { flex: 1, alignItems: 'flex-end', paddingRight: 8 },
  pagePill: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, minWidth: 85, alignItems: 'center' },
  pagePillText: { fontSize: 15, fontWeight: '700' },
  dockDivider: { height: 26, width: 1, marginHorizontal: 3 },
  modalFrame: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,27,17,.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, minHeight: 220,
    paddingHorizontal: 18, width: '100%', maxWidth: 720, alignSelf: 'center' },
  sheetHeading: { height: 62, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 19, fontWeight: '700' },
  segment: { flexDirection: 'row-reverse', gap: 7, marginVertical: 10 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12 },
  rangeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 46 },
  rangeStep: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  rangeValueInput: { width: 62, height: 38, borderWidth: 1, borderRadius: 10, textAlign: 'center', fontSize: 16 },
  rangeValue: { minWidth: 28, textAlign: 'center', fontWeight: '700', fontSize: 16 },
  segmentText: { fontSize: 14, fontWeight: '700' },
  bookmarkCategories: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  bookmarkChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  list: { maxHeight: 520, flexShrink: 1, minHeight: 0 },
  pageFormInline: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginVertical: 8 },
  pageInput: { flex: 1 },
  inputHint: { fontSize: 12, textAlign: 'right', marginBottom: 4 },
  pageSubmit: { minWidth: 84, paddingHorizontal: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
  searchInput: { marginBottom: 8 },
  primaryButton: { minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 64, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  rowBody: { flex: 1, alignItems: 'flex-end' },
  rowTitle: { textAlign: 'right', fontSize: 16, fontWeight: '600', writingDirection: 'rtl' },
  rowDetail: { textAlign: 'right', fontSize: 12, marginTop: 3, writingDirection: 'rtl' },
  empty: { textAlign: 'center', paddingVertical: 30, lineHeight: 24 },
  note: { fontSize: 13, lineHeight: 22, textAlign: 'right', marginVertical: 12, writingDirection: 'rtl' },
  sectionTitle: { fontSize: 16, fontWeight: '700', textAlign: 'right', marginTop: 15 },
  verseText: { fontSize: 23, lineHeight: 42, textAlign: 'center', writingDirection: 'rtl', paddingVertical: 15 },
});