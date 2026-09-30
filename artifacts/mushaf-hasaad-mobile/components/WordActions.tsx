import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  getGetQuranAyahEducationQueryKey, getGetQuranWordTajweedQueryKey,
  useGetQuranAyahEducation, useGetQuranWordTajweed,
} from '@workspace/api-client-react';
import { chapterName } from '@/data/quran';
import { quranApiOrigin } from '@/lib/api-origin';
import { useColors } from '@/hooks/useColors';

export type WordSelection = { id: number; position: number; verseKey: string; text: string };
type ViewMode = 'actions' | 'meaning' | 'translation' | 'tajweed';

export function WordActions({ word, onPronounce, playing, audioError, onVerse }: {
  word: WordSelection;
  onPronounce: () => void;
  playing: boolean;
  audioError: string | null;
  onVerse: () => void;
}) {
  const colors = useColors();
  const [mode, setMode] = useState<ViewMode>('actions');
  const [chapter, verse] = word.verseKey.split(':').map(Number);
  const params = { wordPosition: word.position };
  const education = useGetQuranAyahEducation(chapter, verse, params, {
    query: {
      queryKey: getGetQuranAyahEducationQueryKey(chapter, verse, params),
      enabled: !!quranApiOrigin && (mode === 'meaning' || mode === 'translation'),
      retry: 1, staleTime: 24 * 60 * 60 * 1000,
    },
  });
  const tajweed = useGetQuranWordTajweed(chapter, verse, word.position, {
    query: {
      queryKey: getGetQuranWordTajweedQueryKey(chapter, verse, word.position),
      enabled: !!quranApiOrigin,
      retry: 1, staleTime: 24 * 60 * 60 * 1000,
    },
  });
  const verifiedTajweed = tajweed.data?.verseKey === word.verseKey
    && tajweed.data.wordId === word.id && tajweed.data.position === word.position
    && tajweed.data.rules.length > 0 ? tajweed.data : null;
  const selected = education.data?.verseKey === word.verseKey
    && education.data.selectedWord?.id === word.id
    && education.data.selectedWord.position === word.position
    ? education.data.selectedWord : null;
  const text = mode === 'meaning' ? selected?.arabicMeaning?.text
    : mode === 'translation' ? selected?.meaning : null;
  const source = mode === 'meaning' ? selected?.arabicMeaning?.source.name
    : mode === 'translation' ? selected?.source.name : null;
  const button = (label: string, icon: React.ComponentProps<typeof Ionicons>['name'], onPress: () => void, id: string) =>
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label}
      onPress={onPress} style={[styles.action, { backgroundColor: colors.secondary }]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>;

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={[styles.word, { color: colors.primary }]}>{word.text}</Text>
    <Text style={[styles.caption, { color: colors.mutedForeground }]}>
      سورة {chapterName(chapter)} · الآية {verse}
    </Text>
    {mode === 'actions' ? <>
      <View style={styles.actions}>
        {button(playing ? 'إيقاف النطق' : 'نطق', playing ? 'stop-circle-outline' : 'volume-high-outline', onPronounce, 'word-action-pronounce')}
        {button('معنى الكلمة', 'book-outline', () => setMode('meaning'), 'word-action-meaning')}
        {button('ترجمة', 'language-outline', () => setMode('translation'), 'word-action-translation')}
        {verifiedTajweed && button('تجويد', 'color-palette-outline', () => setMode('tajweed'), 'word-action-tajweed')}
      </View>
      {!!audioError && <Text style={[styles.warning, { color: colors.destructive }]}>{audioError}</Text>}
      {button('نسخ الكلمة', 'copy-outline', () => { Clipboard.setStringAsync(word.text).catch(() => undefined); }, 'word-action-copy')}
      {button('خيارات الآية', 'list-outline', onVerse, 'word-action-verse')}
    </> : <>
      <Pressable testID="word-action-back" accessibilityRole="button" onPress={() => setMode('actions')} style={styles.back}>
        <Ionicons name="arrow-forward" size={17} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '700' }}>خيارات الكلمة</Text>
      </Pressable>
      {mode === 'tajweed' && verifiedTajweed ? <>
        {verifiedTajweed.rules.map((rule, index) =>
          <View key={`${rule.class}-${index}`} style={[styles.result, { backgroundColor: colors.secondary }]}>
            <View style={styles.ruleHeading}>
              <View style={[styles.swatch, { backgroundColor: rule.color }]} />
              <Text style={[styles.ruleTitle, { color: colors.foreground }]}>{rule.nameAr} ({rule.colorNameAr})</Text>
            </View>
            <Text style={[styles.body, { color: colors.foreground }]}>{rule.descriptionAr}</Text>
          </View>)}
        {button(playing ? 'إيقاف الاستماع' : 'استمع لنطق الكلمة', 'volume-high-outline', onPronounce, 'word-tajweed-listen')}
        {!!audioError && <Text style={[styles.warning, { color: colors.destructive }]}>{audioError}</Text>}
        <Text style={[styles.source, { color: colors.mutedForeground }]}>المصدر: {verifiedTajweed.source.name}</Text>
      </> : mode === 'tajweed' ? null : education.isPending || education.isFetching && !education.data ? (
        <ActivityIndicator color={colors.primary} style={styles.spinner} />
      ) : education.isError || !education.data ? (
        <Text style={[styles.warning, { color: colors.destructive }]}>تعذّر تحميل محتوى موثّق الآن، لذلك لن نعرض معنى أو ترجمة بلا مصدر.</Text>
      ) : text ? <>
        <Text testID="word-study-result" style={[styles.result, styles.body, { color: colors.foreground, backgroundColor: colors.secondary }]}>{text}</Text>
        <View style={styles.actions}>
          {button('نسخ النص', 'copy-outline', () => { Clipboard.setStringAsync(text).catch(() => undefined); }, 'word-result-copy')}
          {button('مشاركة', 'share-outline', () => { Share.share({ message: `${word.text}: ${text}` }).catch(() => undefined); }, 'word-result-share')}
        </View>
        {!!source && <Text style={[styles.source, { color: colors.mutedForeground }]}>المصدر: {source}</Text>}
      </> : <Text style={[styles.warning, { color: colors.mutedForeground }]}>
        {mode === 'meaning' ? 'لا يورد المرجع شرحًا مستقلًا لهذه الكلمة في هذا الموضع.' : 'لا يورد المصدر ترجمة مستقلة موثّقة لهذه الكلمة.'}
      </Text>}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1, minHeight: 0 },
  content: { paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  word: { textAlign: 'center', fontSize: 24, fontWeight: '700', writingDirection: 'rtl' },
  caption: { textAlign: 'center', fontSize: 12 },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  action: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 12, minHeight: 42 },
  actionLabel: { fontSize: 13, fontWeight: '700' },
  back: { alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingVertical: 5 },
  result: { borderRadius: 12, padding: 14 },
  ruleHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginBottom: 7 },
  ruleTitle: { fontSize: 15, fontWeight: '700' },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  body: { fontSize: 16, lineHeight: 29, textAlign: 'right', writingDirection: 'rtl' },
  warning: { textAlign: 'right', fontSize: 14, lineHeight: 24, padding: 12 },
  source: { textAlign: 'right', fontSize: 11 },
  spinner: { padding: 25 },
});