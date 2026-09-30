import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chapterName, type Verse } from '@/data/quran';
import { bookmarkCategoryLabels, type BookmarkCategory } from '@/context/ReaderContext';
import { useColors } from '@/hooks/useColors';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
type Props = {
  verse: Verse;
  category: BookmarkCategory | null;
  onPlay: () => void;
  onTafsir: () => void;
  onBookmark: (category: BookmarkCategory) => void;
  onRemoveBookmark: () => void;
  onCopy: () => void;
  onCopyRange: () => void;
  onSimilar: () => void;
  onShare: () => void;
  onAudioSettings: () => void;
  onPractice: () => void;
};

export function VerseActions({
  verse, category, onPlay, onTafsir, onBookmark, onRemoveBookmark,
  onCopy, onCopyRange, onSimilar, onShare, onAudioSettings, onPractice,
}: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState<'bookmark' | 'copy' | null>(null);
  const actions: { label: string; icon: Icon; onPress: () => void; active?: boolean }[] = [
    { label: 'تلاوة', icon: 'play-outline', onPress: onPlay },
    { label: 'تفسير', icon: 'book-outline', onPress: onTafsir },
    { label: category ? 'العلامة' : 'علامة', icon: 'bookmark-outline',
      onPress: () => setExpanded(value => value === 'bookmark' ? null : 'bookmark'), active: !!category },
    { label: 'نسخ', icon: 'copy-outline',
      onPress: () => setExpanded(value => value === 'copy' ? null : 'copy') },
    { label: 'متشابهات', icon: 'git-compare-outline', onPress: onSimilar },
  ];
  const option = (label: string, icon: Icon, onPress: () => void, horizontal = false) =>
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.option, horizontal && styles.copyOption, { backgroundColor: colors.secondary, opacity: pressed ? .65 : 1 }]}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <Text style={[styles.optionLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>;

  return <View style={styles.container}>
    <View style={[styles.heading, { borderBottomColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>سورة {chapterName(verse.chapter_id)}  ·  الآية {verse.number}</Text>
      <Text numberOfLines={2} style={[styles.verse, { color: colors.foreground }]}>{verse.content}</Text>
    </View>
    <View style={styles.actions}>
      {actions.map(action => <Pressable key={action.label} accessibilityRole="button"
        accessibilityLabel={action.label === 'متشابهات' ? 'المتشابهات اللفظية' : action.label}
        onPress={action.onPress} style={({ pressed }) => [styles.action, { opacity: pressed ? .6 : 1 }]}>
        <View style={[styles.icon, { backgroundColor: action.active ? colors.accent : colors.secondary }]}>
          <Ionicons name={action.icon} size={21} color={action.active ? colors.accentForeground : colors.primary} />
        </View>
        <Text numberOfLines={1} style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
      </Pressable>)}
    </View>
    {expanded === 'bookmark' && <View style={[styles.expansion, { borderTopColor: colors.border }]}>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>اختر نوع العلامة</Text>
      <View style={styles.categories}>
        {(Object.entries(bookmarkCategoryLabels) as [BookmarkCategory, string][]).map(([id, label]) =>
          <Pressable key={id} accessibilityRole="button" accessibilityLabel={`علامة: ${label}`}
            accessibilityState={{ selected: category === id }}
            onPress={() => { onBookmark(id); setExpanded(null); }}
            style={({ pressed }) => [styles.chip, {
              borderColor: category === id ? colors.primary : colors.border,
              backgroundColor: category === id ? colors.secondary : colors.card,
              opacity: pressed ? .6 : 1,
            }]}>
            <Text style={[styles.chipLabel, { color: category === id ? colors.primary : colors.foreground }]}>
              {category === id ? '✓  ' : ''}{label}
            </Text>
          </Pressable>)}
        {category && <Pressable accessibilityRole="button" accessibilityLabel="إزالة العلامة"
          onPress={() => { onRemoveBookmark(); setExpanded(null); }}
          style={[styles.chip, { borderColor: colors.border }]}>
          <Text style={[styles.chipLabel, { color: colors.destructive }]}>إزالة العلامة</Text>
        </Pressable>}
      </View>
    </View>}
    {expanded === 'copy' && <View style={[styles.expansion, styles.copyOptions, { borderTopColor: colors.border }]}>
      {option('نسخ الآية', 'copy-outline', onCopy, true)}
      {option('عدة آيات', 'layers-outline', onCopyRange, true)}
    </View>}
    <View style={[styles.more, { borderTopColor: colors.border }]}>
      {option('مشاركة الآية', 'share-outline', onShare)}
      {option('التلاوة والتكرار', 'headset-outline', onAudioSettings)}
      {option('حفظني', 'school-outline', onPractice)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingBottom: 12 },
  heading: { alignItems: 'center', paddingHorizontal: 8, paddingBottom: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  eyebrow: { fontSize: 13, fontWeight: '700', marginBottom: 7, textAlign: 'center' },
  verse: { fontSize: 20, lineHeight: 35, textAlign: 'center', writingDirection: 'rtl' },
  actions: { flexDirection: 'row-reverse', marginVertical: 13 },
  action: { width: '20%', alignItems: 'center', gap: 7, minHeight: 65, justifyContent: 'center' },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  expansion: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingBottom: 12 },
  hint: { fontSize: 12, textAlign: 'right', marginBottom: 9 },
  categories: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 39, justifyContent: 'center' },
  chipLabel: { fontSize: 12, fontWeight: '700' },
  copyOptions: { flexDirection: 'row-reverse', gap: 8 },
  more: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 8 },
  option: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 12, minHeight: 43, borderRadius: 12 },
  copyOption: { flex: 1 },
  optionLabel: { fontSize: 13, fontWeight: '700' },
});