import React from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getGetQuranAyahEducationQueryKey, useGetQuranAyahEducation } from '@workspace/api-client-react';
import { quranApiOrigin } from '@/lib/api-origin';
import { chapterName, type Verse } from '@/data/quran';
import { useColors } from '@/hooks/useColors';

export function TafsirPanel({ verse }: { verse: Verse }) {
  const colors = useColors();
  const query = useGetQuranAyahEducation(verse.chapter_id, verse.number, undefined, {
    query: {
      queryKey: getGetQuranAyahEducationQueryKey(verse.chapter_id, verse.number),
      enabled: Boolean(quranApiOrigin),
      staleTime: 24 * 60 * 60 * 1000,
      retry: 1,
    },
  });
  if (!quranApiOrigin) return <Text style={[styles.message, { color: colors.destructive }]}>يلزم إعداد عنوان خدمة حصاد الموثوقة قبل إتاحة التفسير على نسخة الجوال النهائية.</Text>;
  if (query.isPending) return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  if (query.isError || !query.data?.tafsir?.text || !query.data.tafsir.source?.name) {
    return <View>
      <Text style={[styles.message, { color: colors.destructive }]}>تعذّر تحميل تفسير موثق الآن. تحقق من الاتصال وحاول مرة أخرى.</Text>
      <Pressable accessibilityRole="button" onPress={() => query.refetch()} style={styles.retry}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>إعادة المحاولة</Text>
      </Pressable>
    </View>;
  }
  const { text, source } = query.data.tafsir;
  return <View style={styles.body}>
    <Text selectable style={[styles.explanation, { color: colors.foreground }]}>{text}</Text>
    <Text style={[styles.source, { color: colors.mutedForeground }]}>المصدر: {source.name}</Text>
    <View style={styles.actions}>
      <Pressable style={[styles.action, { borderColor: colors.border }]}
        onPress={() => Clipboard.setStringAsync(`${text}\nالمصدر: ${source.name}`)}>
        <Text style={{ color: colors.primary }}>نسخ التفسير</Text>
      </Pressable>
      <Pressable style={[styles.action, { borderColor: colors.border }]}
        onPress={() => Share.share({ message: `تفسير سورة ${chapterName(verse.chapter_id)}، الآية ${verse.number}\n${text}\nالمصدر: ${source.name}` })}>
        <Text style={{ color: colors.primary }}>مشاركة</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  loader: { marginVertical: 45 },
  body: { paddingBottom: 16 },
  message: { textAlign: 'center', lineHeight: 25, paddingVertical: 35 },
  retry: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  explanation: { fontSize: 18, lineHeight: 34, textAlign: 'right', writingDirection: 'rtl', marginVertical: 15 },
  source: { textAlign: 'right', fontSize: 12, marginBottom: 15 },
  actions: { flexDirection: 'row-reverse', gap: 12 },
  action: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1 },
});