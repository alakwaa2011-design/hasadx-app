import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { chapterName, verses, type Verse } from '@/data/quran';
import { useColors } from '@/hooks/useColors';

const arabicNumber = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

export function formatVerseRange(selection: Verse[]): string {
  let currentChapter = 0;
  const lines: string[] = [];
  for (const verse of selection) {
    if (verse.chapter_id !== currentChapter) {
      currentChapter = verse.chapter_id;
      lines.push(`سورة ${chapterName(currentChapter)}`);
    }
    lines.push(`${verse.content} ﴿${arabicNumber(verse.number)}﴾`);
  }
  return lines.join('\n');
}

function parseEndpoint(chapter: string, ayah: string): Verse | null {
  const chapterId = Number(chapter.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)));
  const ayahNumber = Number(ayah.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660)));
  if (!Number.isInteger(chapterId) || !Number.isInteger(ayahNumber) || chapterId < 1 || chapterId > 114 || ayahNumber < 1) return null;
  return verses.find(verse => verse.chapter_id === chapterId && verse.number === ayahNumber) ?? null;
}

export function VerseRangePanel({ initialVerse }: { initialVerse: Verse }) {
  const colors = useColors();
  const [fromChapter, setFromChapter] = useState(String(initialVerse.chapter_id));
  const [fromAyah, setFromAyah] = useState(String(initialVerse.number));
  const [toChapter, setToChapter] = useState(String(initialVerse.chapter_id));
  const [toAyah, setToAyah] = useState(String(initialVerse.number));
  const [error, setError] = useState<string | null>(null);
  const selection = useMemo(() => {
    const start = parseEndpoint(fromChapter, fromAyah);
    const end = parseEndpoint(toChapter, toAyah);
    if (!start || !end) return null;
    const first = verses.indexOf(start);
    const last = verses.indexOf(end);
    return first <= last ? verses.slice(first, last + 1) : null;
  }, [fromChapter, fromAyah, toChapter, toAyah]);
  const start = parseEndpoint(fromChapter, fromAyah);
  const end = parseEndpoint(toChapter, toAyah);
  const changeEnd = (offset: number) => {
    if (!end) return;
    const next = verses[verses.indexOf(end) + offset];
    if (next) { setToChapter(String(next.chapter_id)); setToAyah(String(next.number)); }
  };
  const text = selection ? formatVerseRange(selection) : '';
  return (
    <View style={styles.panel}>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>حدد أول آية وآخر آية، ويمكن أن يمتد النطاق إلى سورة أخرى.</Text>
      {([
        ['من', fromChapter, setFromChapter, fromAyah, setFromAyah, start],
        ['إلى', toChapter, setToChapter, toAyah, setToAyah, end],
      ] as const).map(([label, chapter, setChapter, ayah, setAyah, verse]) =>
        <View key={label} style={styles.endpoint}>
          <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
          <TextInput value={chapter} onChangeText={setChapter} keyboardType="number-pad" maxLength={3}
            accessibilityLabel={`رقم السورة ${label}`} placeholder="السورة" placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
          <TextInput value={ayah} onChangeText={setAyah} keyboardType="number-pad" maxLength={3}
            accessibilityLabel={`رقم الآية ${label}`} placeholder="الآية" placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
          <Text style={[styles.chapter, { color: colors.mutedForeground }]} numberOfLines={1}>
            {verse ? chapterName(verse.chapter_id) : 'آية غير موجودة'}
          </Text>
        </View>)}
      <View style={styles.steps}>
        <Pressable accessibilityRole="button" accessibilityLabel="تقليل آخر آية" onPress={() => changeEnd(-1)}
          style={styles.step}><Text style={{ color: colors.primary, fontSize: 20 }}>−</Text></Pressable>
        <Text style={{ color: colors.foreground }}>{selection ? `${selection.length} ${selection.length === 1 ? 'آية' : 'آيات'}` : 'تحقق من النطاق وترتيب الآيات'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="زيادة آخر آية" onPress={() => changeEnd(1)}
          style={styles.step}><Text style={{ color: colors.primary, fontSize: 20 }}>+</Text></Pressable>
      </View>
      {!!selection && <Text numberOfLines={4} style={[styles.preview, { color: colors.foreground, borderColor: colors.border }]}>{text}</Text>}
      {!!error && <Text style={{ color: colors.destructive, textAlign: 'right' }}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={!selection} onPress={() => {
          Clipboard.setStringAsync(text).then(() => setError(null)).catch(() => setError('تعذّر نسخ الآيات.'));
        }} style={[styles.button, { backgroundColor: colors.secondary, opacity: selection ? 1 : .5 }]}>
          <Text style={{ color: colors.secondaryForeground, fontWeight: '700' }}>نسخ النطاق</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!selection} onPress={() => {
          Share.share({ message: text }).then(() => setError(null)).catch(() => setError('تعذّرت المشاركة على هذا الجهاز.'));
        }} style={[styles.button, { backgroundColor: colors.primary, opacity: selection ? 1 : .5 }]}>
          <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>مشاركة النطاق</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { paddingVertical: 12, gap: 12 },
  note: { textAlign: 'right', fontSize: 13 },
  endpoint: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '700', minWidth: 26 },
  input: { borderWidth: 1, borderRadius: 12, height: 46, width: 65, textAlign: 'center', fontSize: 16 },
  chapter: { flex: 1, textAlign: 'right', fontSize: 13 },
  steps: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  step: { width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  preview: { borderWidth: 1, borderRadius: 12, padding: 12, textAlign: 'right', lineHeight: 29, fontSize: 17 },
  actions: { flexDirection: 'row-reverse', gap: 8 },
  button: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});