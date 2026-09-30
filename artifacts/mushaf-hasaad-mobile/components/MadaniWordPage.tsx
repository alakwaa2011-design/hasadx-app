import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Font from 'expo-font';
import { getGetQuranMadaniPageQueryKey, useGetQuranMadaniPage } from '@workspace/api-client-react';
import { chapterName, pageImage, pageVerses } from '@/data/quran';
import { quranApiOrigin } from '@/lib/api-origin';
import { useColors } from '@/hooks/useColors';
import type { WordSelection } from '@/components/WordActions';

type Decoration = { kind: 'surah' | 'bismillah'; chapter: number };
const fontUrl = (page: number) => `https://static.qurancdn.com/fonts/quran/hafs/v2/ttf/p${page}.ttf`;
const bismillah = 'ﱁ ﱂ ﱃ ﱄ';
async function loadPageFonts(page: number) {
  const family = `qcf-v2-p${page}`;
  const pending: Promise<void>[] = [];
  if (!Font.isLoaded(family)) pending.push(Font.loadAsync({ [family]: { uri: fontUrl(page) } }));
  if (!Font.isLoaded('qcf-v2-bismillah')) {
    pending.push(Font.loadAsync({ 'qcf-v2-bismillah': { uri: fontUrl(1) } }));
  }
  await Promise.race([
    Promise.all(pending),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('QCF font timeout')), 15000)),
  ]);
}

export function MadaniWordPage({ page, width, height, background, selectedVerseKey, onVersePress }: {
  page: number; width: number; height: number; background: string;
  selectedVerseKey?: string | null;
  onVersePress: (word: WordSelection | { verseKey: string }) => void;
}) {
  const colors = useColors();
  const [fontStatus, setFontStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fallbackImageError, setFallbackImageError] = useState(false);
  const [offline, setOffline] = useState(
    () => Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine,
  );
  const family = `qcf-v2-p${page}`;
  const { data, isError, isPending, refetch } = useGetQuranMadaniPage(page, {
    query: { queryKey: getGetQuranMadaniPageQueryKey(page), enabled: !!quranApiOrigin && !offline, retry: 1, staleTime: Infinity },
  });

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
    if (!quranApiOrigin || offline) return;
    let active = true;
    const load = async () => {
      try {
        await loadPageFonts(page);
        if (active) setFontStatus('ready');
      } catch (error) {
        console.warn('تعذر تحميل خط المصحف التفاعلي', error);
        if (active) setFontStatus('error');
      }
    };
    load();
    return () => { active = false; };
  }, [family, page, offline]);

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

  const missing = offline || !quranApiOrigin || isError || fontStatus === 'error';
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
            : offline ? 'الاتصال غير متاح؛ تُعرض صورة الصفحة المحفوظة على الجهاز. يمكنك اختيار صور الصفحات من الإعدادات.'
            : 'تعذّر تحميل الكلمات أو خطّها؛ تُعرض صورة الصفحة مؤقتًا. صور المصحف متاحة دائمًا من الإعدادات.'}
        </Text>
        {!!quranApiOrigin && !offline && <Pressable accessibilityRole="button" onPress={() => {
          setFontStatus('loading');
          loadPageFonts(page).then(() => setFontStatus('ready')).catch(() => setFontStatus('error'));
          refetch();
        }}><Text style={{ color: colors.primary, fontWeight: '700' }}>إعادة المحاولة</Text></Pressable>}
      </View>
    </View>;
  }
  if (!data || isPending || fontStatus !== 'ready') {
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
        {line.words.map(word => <Pressable key={word.id} testID={`word-${word.id}`}
          accessibilityRole="button" accessibilityLabel={`${word.text}، الآية ${word.verseKey}`}
          onPress={() => onVersePress(word.type === 'word'
            ? { id: word.id, position: word.position, verseKey: word.verseKey, text: word.text }
            : { verseKey: word.verseKey })}
          style={({ pressed }) => [styles.word, {
            backgroundColor: selectedVerseKey === word.verseKey ? colors.secondary : 'transparent',
            opacity: pressed ? .55 : 1,
          }]}>
          <Text allowFontScaling={false} style={[styles.glyph, {
            fontFamily: family, fontSize, lineHeight: rowHeight,
            color: word.type === 'end' ? colors.primary : colors.foreground,
          }]}>{word.glyph}</Text>
        </Pressable>)}
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  page: { borderWidth: 1, overflow: 'hidden', borderRadius: 2 },
  loading: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  line: { flex: 1, minHeight: 0, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  words: { width: '100%' },
  word: { flexShrink: 0, borderRadius: 3, paddingHorizontal: 1, overflow: 'visible' },
  glyph: { textAlign: 'center', includeFontPadding: false, writingDirection: 'rtl' },
  chapter: { textAlign: 'center', fontSize: 15, fontWeight: '700' },
  fallback: { position: 'absolute', top: 8, left: 8, right: 8, padding: 8, borderRadius: 8, borderWidth: 1, gap: 4, alignItems: 'center' },
});