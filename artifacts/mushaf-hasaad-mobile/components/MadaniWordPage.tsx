import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Font from 'expo-font';
import { File, Paths } from 'expo-file-system';
import { getGetQuranMadaniPageQueryKey, useGetQuranMadaniPage } from '@workspace/api-client-react';
import { chapterName, pageImage, pageVerses } from '@/data/quran';
import { quranApiOrigin } from '@/lib/api-origin';
import { useColors } from '@/hooks/useColors';
import type { WordSelection } from '@/components/WordActions';
import { useOfflineContent, type OfflinePage } from '@/lib/offline-content';
import { TajweedLegend } from '@/components/TajweedLegend';

type Decoration = { kind: 'surah' | 'bismillah'; chapter: number };
const bismillah = 'ﱁ ﱂ ﱃ ﱄ';
const tajweedFontUrls = (page: number) => [
  `https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/ttf/p${page}.ttf`,
  `https://static.qurancdn.com/fonts/quran/hafs/v4/ttf/p${page}.ttf`,
];
const tajweedFontLoads = new Map<number, Promise<void>>();

async function isTrueType(file: File) {
  if (!file.exists || !file.size || file.size <= 1000) return false;
  const header = new Uint8Array((await file.arrayBuffer()).slice(0, 4));
  return (header[0] === 0 && header[1] === 1 && header[2] === 0 && header[3] === 0)
    || String.fromCharCode(...header) === 'OTTO';
}

async function loadTajweedFontUncached(page: number) {
  const family = `qcf-v4-p${page}`;
  if (Font.isLoaded(family)) return;
  if (Platform.OS === 'web') {
    let lastError: unknown;
    for (const uri of tajweedFontUrls(page)) {
      try {
        await Font.loadAsync({ [family]: { uri } });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error(`خط QCF V4 للصفحة ${page} غير متاح`);
  }

  const target = new File(Paths.document, `qcf-v4-p${page}.ttf`);
  if (await isTrueType(target)) {
    // Preserve the validated offline copy if font registration fails transiently.
    await Font.loadAsync({ [family]: { uri: target.uri } });
    return;
  }

  let lastError: unknown;
  for (const [index, uri] of tajweedFontUrls(page).entries()) {
    const temporary = new File(Paths.document, `qcf-v4-p${page}-${index}.partial`);
    try {
      const downloaded = await File.downloadFileAsync(uri, temporary, { idempotent: true });
      if (!(await isTrueType(downloaded))) throw new Error('ملف خط QCF V4 غير صالح');
      // A valid target is never replaced by a competing download. Only an
      // invalid/incomplete old target can be discarded before the move.
      if (target.exists && !(await isTrueType(target))) target.delete();
      downloaded.move(target);
      await Font.loadAsync({ [family]: { uri: target.uri } });
      return;
    } catch (error) {
      lastError = error;
      if (temporary.exists) temporary.delete();
      // Retain the validated target even if Font.loadAsync failed.
    }
  }
  throw lastError ?? new Error(`خط QCF V4 للصفحة ${page} غير متاح`);
}

function loadTajweedFont(page: number): Promise<void> {
  const existing = tajweedFontLoads.get(page);
  if (existing) return existing;
  const loading = loadTajweedFontUncached(page);
  tajweedFontLoads.set(page, loading);
  void loading.finally(() => { if (tajweedFontLoads.get(page) === loading) tajweedFontLoads.delete(page); }).catch(() => undefined);
  return loading;
}

async function loadV2Font(page: number, resolveFont: (page: number, online: boolean) => Promise<string | null>, online: boolean) {
  const family = `qcf-v2-p${page}`;
  if (!Font.isLoaded(family)) {
    const uri = await resolveFont(page, online);
    if (!uri) throw new Error(`خط QCF V2 للصفحة ${page} لم يُنزّل`);
    await Font.loadAsync({ [family]: { uri } });
  }
}

async function loadBismillahFont(resolveFont: (page: number, online: boolean) => Promise<string | null>, online: boolean) {
  if (Font.isLoaded('qcf-v2-bismillah')) return;
  const uri = await resolveFont(1, online);
  if (!uri) throw new Error('خط البسملة لم يُنزّل');
  await Font.loadAsync({ 'qcf-v2-bismillah': { uri } });
}

async function loadPageFonts(
  page: number,
  resolveFont: (page: number, online: boolean) => Promise<string | null>,
  online: boolean,
  tajweedEnabled: boolean,
): Promise<'v2' | 'v4'> {
  let tajweedFontError: unknown;
  if (tajweedEnabled) {
    try {
      await Promise.race([
        loadTajweedFont(page),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('QCF V4 font timeout')), 8000)),
      ]);
      await loadBismillahFont(resolveFont, online);
      return 'v4';
    } catch (error) {
      tajweedFontError = error;
    }
  }
  await loadV2Font(page, resolveFont, online);
  await loadBismillahFont(resolveFont, online);
  if (tajweedEnabled && tajweedFontError) console.warn('تعذر تحميل خط التجويد الملون؛ استُخدم خط QCF V2', tajweedFontError);
  return 'v2';
}

export function MadaniWordPage({ page, width, height, background, selectedVerseKey, onVersePress, tajweedEnabled = false, activeVerseKey = null, activeWordPosition = null }: {
  page: number; width: number; height: number; background: string;
  selectedVerseKey?: string | null;
  onVersePress: (word: WordSelection | { verseKey: string }) => void;
  tajweedEnabled?: boolean;
  activeVerseKey?: string | null;
  activeWordPosition?: number | null;
}) {
  const colors = useColors();
  const [fontStatus, setFontStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fontVersion, setFontVersion] = useState<'v2' | 'v4'>('v2');
  const [offlineData, setOfflineData] = useState<OfflinePage | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [fallbackImageError, setFallbackImageError] = useState(false);
  const content = useOfflineContent();
  const [offline, setOffline] = useState(
    () => Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine,
  );
  const family = `${fontVersion === 'v4' && tajweedEnabled ? 'qcf-v4' : 'qcf-v2'}-p${page}`;
  const { data: onlineData, isError, refetch } = useGetQuranMadaniPage(page, {
    query: { queryKey: getGetQuranMadaniPageQueryKey(page), enabled: !!quranApiOrigin && !offline, retry: 1, staleTime: Infinity },
  });
  const data = offlineData ?? (offline ? null : onlineData);
  useEffect(() => {
    let active = true;
    setLocalReady(false);
    setOfflineData(null);
    content.page(page).then(value => { if (active) setOfflineData(value); })
      .catch(() => { if (active) setOfflineData(null); })
      .finally(() => { if (active) setLocalReady(true); });
    return () => { active = false; };
  }, [content.manifests.mushafs?.generation, content.manifests.mushafs?.checkedAt, content.freshnessTick, page]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setFontStatus('loading');
    const load = async () => {
      try {
        const version = await Promise.race([
          loadPageFonts(page, content.font, !offline && !!quranApiOrigin, tajweedEnabled),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('QCF font timeout')), 20000)),
        ]);
        if (active) setFontVersion(version);
        if (active) setFontStatus('ready');
      } catch (error) {
        console.warn('تعذر تحميل خط المصحف التفاعلي', error);
        if (active) setFontStatus('error');
      }
    };
    load();
    return () => { active = false; };
  }, [page, offline, content.font, tajweedEnabled]);

  const layout = useMemo(() => {
    const decorations = new Map<number, Decoration>();
    const partialLines = new Set<number>();
    if (!data) return { decorations, partialLines };
    const occupied = [...new Set(data.lines.map(line => line.lineNumber))].sort((a, b) => a - b);
    for (const start of data.surahStarts) {
      const before = occupied.filter(line => line < start.lineNumber).at(-1) ?? 0;
      const room = start.lineNumber - before - 1;
      const hasBismillah = start.surahNumber !== 1 && start.surahNumber !== 9;
      if (hasBismillah && room === 1) {
        decorations.set(start.lineNumber - 1, { kind: 'bismillah', chapter: start.surahNumber });
        continue;
      }
      const heading = hasBismillah && room >= 2 ? start.lineNumber - 2 : start.lineNumber - 1;
      if (heading > before && !occupied.includes(heading)) {
        decorations.set(heading, { kind: 'surah', chapter: start.surahNumber });
      }
      if (hasBismillah && start.lineNumber - 1 > heading && !occupied.includes(start.lineNumber - 1)) {
        decorations.set(start.lineNumber - 1, { kind: 'bismillah', chapter: start.surahNumber });
      }
      const previousContentLine = occupied.filter(line => line < heading).at(-1);
      if (previousContentLine) partialLines.add(previousContentLine);
    }
    for (let i = data.lines.length - 1; i >= 0; i--) {
      if (data.lines[i].words.length > 6) break;
      partialLines.add(data.lines[i].lineNumber);
    }
    return { decorations, partialLines };
  }, [data]);

  const missing = localReady && (!data || fontStatus === 'error' || (offline && !offlineData));
  if (missing) {
    return <View testID={offline ? 'offline-page' : undefined}
      style={[styles.page, { width, height, backgroundColor: background, borderColor: colors.border }]}>
      {!fallbackImageError
        ? <Image source={pageImage(page)} style={StyleSheet.absoluteFill} contentFit="contain"
            onError={() => setFallbackImageError(true)} />
        : <ScrollView testID="offline-verses" style={{ flex: 1, width: '100%' }}
            contentContainerStyle={{ padding: 22, paddingTop: 70 }}>
            {(pageVerses.get(page) ?? []).map(verse =>
              <Text key={verse.id} style={{ color: colors.foreground, fontSize: 22, lineHeight: 47, textAlign: 'right', writingDirection: 'rtl' }}>
                {verse.content} ﴿{verse.number}﴾
              </Text>)}
          </ScrollView>}
      <View style={[styles.fallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground, textAlign: 'center', fontSize: 12 }}>
          {fallbackImageError ? 'تعذّر عرض صورة الصفحة؛ يُعرض نص آياتها المحفوظ في التطبيق.'
           : fontStatus === 'error' ? `خط QCF V2 للصفحة ${page} أو خط البسملة غير متاح على الجهاز. تُعرض الصورة؛ نزّل الخط من الإعدادات عند توفر الاتصال.`
             : `بيانات كلمات الصفحة ${page} غير محفوظة محليًا${offline ? ' والاتصال غير متاح' : isError ? ' وتعذّر جلبها' : ''}. تُعرض صورة الصفحة بدلًا منها.`}
        </Text>
        {!!quranApiOrigin && !offline && <Pressable accessibilityRole="button" onPress={() => {
          setFontStatus('loading');
           loadPageFonts(page, content.font, true, tajweedEnabled)
             .then(version => { setFontVersion(version); setFontStatus('ready'); })
             .catch(() => setFontStatus('error'));
          refetch();
        }}><Text style={{ color: colors.primary, fontWeight: '700' }}>إعادة المحاولة</Text></Pressable>}
      </View>
    </View>;
  }
   if (!localReady || !data || fontStatus !== 'ready') {
    return <View style={[styles.page, styles.loading, { width, height, backgroundColor: background, borderColor: colors.border }]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.mutedForeground }}>جارٍ تحميل كلمات الصفحة {page}…</Text>
    </View>;
  }

  const firstLines = page <= 2 ? data.lines.filter(line => line.words.length > 0) : null;
  const rowCount = firstLines ? 9 : 15;
  const firstLineStart = firstLines ? Math.max(1, Math.floor((rowCount - firstLines.length) / 2) + 1) : null;
  const rowHeight = (height * .88) / rowCount;
  const fontSize = Math.min(width * (firstLines ? .065 : .052), rowHeight * .78);
  const lineByNumber = new Map(data.lines.map(line => [line.lineNumber, line]));
  return <View testID={`word-page-${page}`} style={[styles.page, {
    width, height, paddingHorizontal: width * .075, paddingVertical: height * .06,
    backgroundColor: background, borderColor: colors.border,
  }]}>
     {tajweedEnabled && <TajweedLegend fontFallback={fontVersion === 'v2' && fontStatus === 'ready'} />}
    {Array.from({ length: rowCount }, (_, i) => i + 1).map(row => {
      const line = firstLines && firstLineStart
        ? firstLines[row - firstLineStart]
        : lineByNumber.get(row);
      const decoration: Decoration | undefined = firstLines
        ? (page === 2 && row === (firstLineStart ?? 1) - 1 ? { kind: 'bismillah', chapter: 2 } : undefined)
        : layout.decorations.get(row);
      if (decoration?.kind === 'surah') {
        return <View key={row} style={styles.line}>
          <Text style={[styles.chapter, { color: colors.primary }]}>{chapterName(decoration.chapter)}</Text>
        </View>;
      }
      if (decoration?.kind === 'bismillah') {
        return <View key={row} style={styles.line}>
          <Text allowFontScaling={false} style={[styles.glyph, { fontFamily: 'qcf-v2-bismillah', fontSize, color: colors.foreground }]}>{bismillah}</Text>
        </View>;
      }
      if (!line?.words.length) return <View key={row} style={styles.line} />;
      const short = page <= 2 || layout.partialLines.has(row) || line.words.length <= 2;
      return <View key={row} style={[styles.line, styles.words, { justifyContent: short ? 'center' : 'space-between' }]}>
        {line.words.map(word => {
          const playingWord = word.type === 'word'
            && activeVerseKey === word.verseKey && activeWordPosition === word.position;
          return <Pressable key={word.id} testID={`word-${word.id}`}
           accessibilityRole="button" accessibilityLabel={offlineData
             ? `الكلمة ${word.position}، الآية ${word.verseKey}` : `${word.text}، الآية ${word.verseKey}`}
          onPress={() => onVersePress(word.type === 'word'
             ? { id: word.id, position: word.position, verseKey: word.verseKey, text: word.text,
                 glyphOnly: !!offlineData, page }
            : { verseKey: word.verseKey })}
          style={({ pressed }) => [styles.word, {
             backgroundColor: playingWord ? `${colors.primary}88`
               : selectedVerseKey === word.verseKey
               ? colors.secondary
               : activeVerseKey === word.verseKey ? `${colors.primary}18` : 'transparent',
             opacity: pressed ? .6 : 1,
          }]}>
          <Text allowFontScaling={false} style={[styles.glyph, {
             fontFamily: family, fontSize, lineHeight: rowHeight,
             color: word.type === 'end' ? colors.primary : colors.foreground,
             opacity: activeVerseKey === word.verseKey && activeWordPosition !== null
               && !playingWord && word.type === 'word' ? .86 : 1,
          }]}>{word.glyph}</Text>
        </Pressable>;
        })}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  page: { borderWidth: 1, overflow: 'hidden', borderRadius: 2 },
  loading: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  line: { flex: 1, minHeight: 0, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  words: { width: '100%' },
  word: { flexShrink: 0, borderRadius: 4, paddingHorizontal: 1, overflow: 'visible' },
  glyph: { textAlign: 'center', includeFontPadding: false, writingDirection: 'rtl' },
  chapter: { textAlign: 'center', fontSize: 15, fontWeight: '700' },
  fallback: { position: 'absolute', top: 8, left: 8, right: 8, padding: 8, borderRadius: 8, borderWidth: 1, gap: 4, alignItems: 'center' },
});