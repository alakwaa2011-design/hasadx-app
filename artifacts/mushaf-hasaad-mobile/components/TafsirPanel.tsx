import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { getGetQuranAyahEducationQueryKey, useGetQuranAyahEducation } from '@workspace/api-client-react';
import { quranApiOrigin } from '@/lib/api-origin';
import { chapterName, type Verse } from '@/data/quran';
import { useColors } from '@/hooks/useColors';
import { useOfflineContent } from '@/lib/offline-content';

export function TafsirPanel({ verse }: { verse: Verse }) {
  const colors = useColors();
  const content = useOfflineContent();
  const [saved, setSaved] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setSaved(null);
    content.tafsir(verse.id).then(text => { if (active) setSaved(text); })
      .catch(() => { if (active) setSaved(null); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [verse.id, content.manifests.tafsirs?.generation, content.manifests.tafsirs?.checkedAt, content.freshnessTick]);
  const query = useGetQuranAyahEducation(verse.chapter_id, verse.number, undefined, {
    query: {
      queryKey: getGetQuranAyahEducationQueryKey(verse.chapter_id, verse.number),
      enabled: Boolean(quranApiOrigin),
      staleTime: 24 * 60 * 60 * 1000,
      retry: 1,
    },
  });
  if (!loaded || (!saved && !!quranApiOrigin && query.isPending)) return <ActivityIndicator style={styles.loader} color={colors.primary} />;
  if (!saved && (!quranApiOrigin || query.isError || !query.data?.tafsir?.text || !query.data.tafsir.source?.name)) {
    return <View>
      <Text style={[styles.message, { color: colors.destructive }]}>تفسير الآية غير محفوظ على هذا الجهاز؛ نزّل «التفسير الميسر» من إعدادات القراءة أو اتصل بالإنترنت.</Text>
      {!!quranApiOrigin && <Pressable accessibilityRole="button" onPress={() => query.refetch()} style={styles.retry}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>إعادة المحاولة</Text>
      </Pressable>}
    </View>;
  }
  const text = saved ?? query.data!.tafsir!.text;
  const sourceName = saved ? 'التفسير الميسر · Quran Foundation (نسخة الجهاز)' : query.data!.tafsir!.source.name;
  return <View style={styles.body}>
    <Text selectable style={[styles.explanation, { color: colors.foreground }]}>{text}</Text>
    <Text style={[styles.source, { color: colors.mutedForeground }]}>المصدر: {sourceName}</Text>
    <View style={styles.actions}>
      <Pressable style={[styles.action, { borderColor: colors.border }]}
         onPress={() => Clipboard.setStringAsync(`${text}\nالمصدر: ${sourceName}`)}>
        <Text style={{ color: colors.primary }}>نسخ التفسير</Text>
      </Pressable>
      <Pressable style={[styles.action, { borderColor: colors.border }]}
         onPress={() => Share.share({ message: `تفسير سورة ${chapterName(verse.chapter_id)}، الآية ${verse.number}\n${text}\nالمصدر: ${sourceName}` })}>
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