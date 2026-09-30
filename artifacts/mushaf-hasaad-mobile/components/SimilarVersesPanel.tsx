import React, { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getQuranPhraseIndex,
  getQuranSimilarPassages,
  getSharedPhrase,
  getWordDifferences,
  type QuranSimilarPassageCategory,
} from '@workspace/quran-similarity';
import { chapterName, verses } from '@/data/quran';
import { useColors } from '@/hooks/useColors';

type ResultFilter = 'all' | 'exact' | 'phrase' | 'variation';

const categoryLabels: Record<QuranSimilarPassageCategory, string> = {
  repeated_verse: 'نص الآية متكرر',
  repeated_phrase: 'عبارة مشتركة',
  lafzi: 'عبارة متطابقة',
  word_swap: 'تبديل لفظ',
  addition_omission: 'زيادة أو حذف',
  ending_variation: 'اختلاف الخاتمة',
  order_change: 'تغيّر الترتيب',
  pronoun_shift: 'اختلاف الضمير',
  structural: 'تشابه في الصياغة',
};

const FILTERS: Array<{ id: ResultFilter; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'exact', label: 'مطابق' },
  { id: 'phrase', label: 'عبارة' },
  { id: 'variation', label: 'اختلاف' },
];

function VerseText({
  text,
  highlighted,
  different,
  colors,
}: {
  text: string;
  highlighted: Set<number>;
  different: Set<number>;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Text style={[styles.verseText, { color: colors.foreground }]}>
      {text.split(/\s+/).filter(Boolean).map((word, index) => (
        <Text
          key={`${index}-${word}`}
          style={highlighted.has(index)
            ? { color: colors.accentForeground, backgroundColor: colors.accent }
            : different.has(index)
              ? { color: colors.primary, backgroundColor: colors.secondary }
              : undefined}
        >
          {word}{' '}
        </Text>
      ))}
    </Text>
  );
}

export function SimilarVersesPanel({
  verseKey,
  onNavigate,
  onClose,
}: {
  verseKey: string;
  onNavigate: (verseKey: string, pageId: number) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [filter, setFilter] = useState<ResultFilter>('all');
  const phraseIndex = useMemo(() => getQuranPhraseIndex(verses), []);
  const current = useMemo(() => {
    const [chapterId, number] = verseKey.split(':').map(Number);
    return verses.find(verse => verse.chapter_id === chapterId && verse.number === number);
  }, [verseKey]);
  const results = useMemo(
    () => getQuranSimilarPassages(phraseIndex, verseKey),
    [phraseIndex, verseKey],
  );
  const filtered = results.filter(result => (
    filter === 'all'
    || (filter === 'exact' && result.exactVerse)
    || (filter === 'phrase' && !result.exactVerse && result.category === 'repeated_phrase')
    || (filter === 'variation' && !result.exactVerse && result.category !== 'repeated_phrase')
  ));
  const shown = filtered.slice(0, 60);
  const heading = (key: string) => {
    const [chapterId, number] = key.split(':').map(Number);
    return `سورة ${chapterName(chapterId)} · ${number}`;
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerTitle}>
                <Ionicons name="git-compare" size={22} color={colors.primary} />
                <View>
                  <Text style={[styles.title, { color: colors.foreground }]}>المتشابهات اللفظية</Text>
                  <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                    {current ? heading(verseKey) : verseKey}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق المتشابهات"
                onPress={onClose}
                hitSlop={10}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={25} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              {!current ? (
                <Text style={[styles.empty, { color: colors.destructive }]}>الآية غير موجودة في المصحف المحلي.</Text>
              ) : (
                <>
                  <Text style={[styles.count, { color: colors.mutedForeground }]}>
                    المواضع المتشابهة: {filtered.length}
                  </Text>
                  <View style={styles.filters} accessibilityRole="tablist">
                    {FILTERS.map(({ id, label }) => (
                      <Pressable
                        key={id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: filter === id }}
                        onPress={() => setFilter(id)}
                        style={[
                          styles.filter,
                          { borderColor: colors.border },
                          filter === id && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                      >
                        <Text style={[
                          styles.filterText,
                          { color: colors.foreground },
                          filter === id && { color: colors.primaryForeground },
                        ]}>
                          {label} {results.filter(result => (
                            id === 'all'
                            || (id === 'exact' && result.exactVerse)
                            || (id === 'phrase' && !result.exactVerse && result.category === 'repeated_phrase')
                            || (id === 'variation' && !result.exactVerse && result.category !== 'repeated_phrase')
                          )).length}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {results.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.mutedForeground, backgroundColor: colors.card }]}>
                      لم نجد تكرارًا مطابقًا أو عبارة مشتركة من ثلاث كلمات فأكثر، ولا علاقة منتقاة لهذه الآية.
                    </Text>
                  ) : filtered.length === 0 ? (
                    <Text style={[styles.empty, { color: colors.mutedForeground, backgroundColor: colors.card }]}>
                      لا توجد مواضع في هذا التصنيف.
                    </Text>
                  ) : null}

                  {shown.map(({ otherVerseKey, category }) => {
                    const other = verses.find(verse => `${verse.chapter_id}:${verse.number}` === otherVerseKey);
                    if (!other) return null;
                    const shared = getSharedPhrase(phraseIndex, verseKey, otherVerseKey);
                    const different = getWordDifferences(phraseIndex, verseKey, otherVerseKey);
                    return (
                      <View
                        key={otherVerseKey}
                        style={[styles.matchCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      >
                        <View style={styles.matchHeading}>
                          <Text style={[styles.matchTitle, { color: colors.foreground }]}>{heading(otherVerseKey)}</Text>
                          <Text style={[styles.badge, { color: colors.accentForeground, backgroundColor: colors.accent }]}>
                            {categoryLabels[category]}
                          </Text>
                        </View>
                        <Text style={[styles.caption, { color: colors.mutedForeground }]}>الآية الحالية</Text>
                        <VerseText
                          text={current.content}
                          highlighted={shared.first}
                          different={different.first}
                          colors={colors}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`الانتقال إلى ${heading(otherVerseKey)}`}
                          onPress={() => {
                            onNavigate(otherVerseKey, other.page_id);
                            onClose();
                          }}
                          style={[styles.target, { borderTopColor: colors.border }]}
                        >
                          <View style={styles.targetHeading}>
                            <Text style={[styles.caption, { color: colors.primary }]}>{heading(otherVerseKey)}</Text>
                            <Ionicons name="arrow-up-left-box" size={17} color={colors.primary} />
                          </View>
                          <VerseText
                            text={other.content}
                            highlighted={shared.second}
                            different={different.second}
                            colors={colors}
                          />
                        </Pressable>
                      </View>
                    );
                  })}
                  {filtered.length > shown.length && (
                    <Text style={[styles.limit, { color: colors.mutedForeground }]}>
                      تُعرض أول {shown.length} نتيجة من أصل {filtered.length}.
                    </Text>
                  )}
                  <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
                    التكرار النصي محسوب من مصحف Q-Complex المحلي. العلاقات المنتقاة للاختلافات اللفظية غير شاملة؛ المصدر:
                  </Text>
                  <View style={styles.links}>
                    <Pressable onPress={() => Linking.openURL('https://github.com/srmdn/quran-mutashabihat')}>
                      <Text style={[styles.link, { color: colors.primary }]}>quran-mutashabihat</Text>
                    </Pressable>
                    <Text style={{ color: colors.mutedForeground }}>·</Text>
                    <Pressable onPress={() => Linking.openURL('https://creativecommons.org/licenses/by/4.0/')}>
                      <Text style={[styles.link, { color: colors.primary }]}>CC BY 4.0</Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
                    بيانات العلاقات مقتصرة على الأزواج المراجعة؛ حُذفت ملاحظات المصدر.
                  </Text>
                </>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8, 18, 13, 0.66)' },
  safeArea: { flex: 1, justifyContent: 'flex-end' },
  sheet: { height: '96%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'right' },
  subtitle: { fontSize: 12, marginTop: 2, textAlign: 'right' },
  closeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 30, gap: 11 },
  count: { fontSize: 12, fontWeight: '600', textAlign: 'right' },
  filters: { flexDirection: 'row-reverse', gap: 6, marginBottom: 4 },
  filter: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, paddingHorizontal: 2, borderWidth: 1, borderRadius: 20 },
  filterText: { fontSize: 11, fontWeight: '700' },
  empty: { padding: 14, borderRadius: 12, textAlign: 'right', lineHeight: 24, overflow: 'hidden' },
  matchCard: { borderWidth: 1, borderRadius: 16, padding: 13, gap: 7 },
  matchHeading: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 },
  matchTitle: { flexShrink: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  badge: { overflow: 'hidden', borderRadius: 13, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '700' },
  caption: { fontSize: 11, fontWeight: '600', textAlign: 'right' },
  verseText: { fontSize: 20, lineHeight: 39, textAlign: 'right', writingDirection: 'rtl' },
  target: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 3, paddingTop: 9 },
  targetHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  limit: { textAlign: 'center', fontSize: 12, paddingVertical: 5 },
  attribution: { fontSize: 11, lineHeight: 19, textAlign: 'right', marginTop: 3 },
  links: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 7 },
  link: { fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
});