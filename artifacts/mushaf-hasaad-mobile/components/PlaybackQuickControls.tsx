import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type PlaybackPanel = 'repeat' | 'speed';
export type PlaybackStopAt = 'ayah' | 'page' | 'surah';

type Props = {
  mode: PlaybackPanel;
  repeat: number;
  stopAt: PlaybackStopAt;
  repeatMode: 'ayah' | 'range';
  rangeSession: boolean;
  pauseBetween: number;
  speed: number;
  onRepeat: (value: number) => void;
  onStopAt: (value: PlaybackStopAt) => void;
  onRepeatMode: (value: 'ayah' | 'range') => void;
  onPauseBetween: (value: number) => void;
  onSpeed: (value: number) => void;
  onOpenSettings: () => void;
};

const repeatCounts = [1, 3, 5, 10, -1] as const;
const pauseTimes = [0, .5, 1, 2, 3] as const;
const speeds = [.75, 1, 1.25] as const;

export function PlaybackQuickControls({
  mode, repeat, stopAt, repeatMode, rangeSession, pauseBetween, speed,
  onRepeat, onStopAt, onRepeatMode, onPauseBetween, onSpeed, onOpenSettings,
}: Props) {
  const colors = useColors();
  const choice = (label: string, selected: boolean, onPress: () => void, testID: string) =>
    <Pressable key={testID} testID={testID} accessibilityRole="button"
      accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
      style={({ pressed }) => [styles.choice, {
        backgroundColor: selected ? colors.primary : colors.secondary,
        opacity: pressed ? .7 : 1,
      }]}>
      <Text style={[styles.choiceLabel, { color: selected ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
    </Pressable>;
  const title = (text: string) => <Text style={[styles.title, { color: colors.foreground }]}>{text}</Text>;

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
    {mode === 'repeat' ? <>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        اختر عدد مرات التلاوة. تتغير الخيارات فورًا دون إعادة تشغيل الصوت.
      </Text>
      {title('عدد مرات التكرار')}
      <View style={styles.choices}>{repeatCounts.map(value =>
        choice(value === -1 ? 'مستمر' : `${value}×`, repeat === value,
          () => onRepeat(value), `repeat-${value}`))}</View>
      {rangeSession && <>
        {title('طريقة تكرار النطاق')}
        <View style={styles.choices}>
          {choice('كل آية', repeatMode === 'ayah', () => onRepeatMode('ayah'), 'repeat-each-ayah')}
          {choice('النطاق كاملًا', repeatMode === 'range', () => onRepeatMode('range'), 'repeat-whole-range')}
        </View>
      </>}
      {!rangeSession ? <>
        {title('التوقف بعد')}
        <View style={styles.choices}>
          {([['ayah', 'آية'], ['page', 'صفحة'], ['surah', 'سورة']] as const).map(([id, label]) =>
            choice(label, stopAt === id, () => onStopAt(id), `stop-at-${id}`))}
        </View>
      </> : <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        عند تشغيل نطاق، تنتهي التلاوة عند آخر آية فيه بعد اكتمال التكرار المحدد.
      </Text>}
      {title('الفاصل بين التكرارات')}
      <View style={styles.choices}>{pauseTimes.map(value =>
        choice(value === 0 ? 'دون' : `${value}ث`, pauseBetween === value,
          () => onPauseBetween(value), `repeat-pause-${value}`))}</View>
      {!rangeSession && <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        لتكرار عدة آيات معًا، حدد النطاق وابدأ تشغيله من إعدادات التلاوة الكاملة.
      </Text>}
    </> : <>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>تغيير السرعة يطبّق مباشرة على التلاوة الجارية.</Text>
      {title('سرعة التشغيل')}
      <View style={styles.choices}>{speeds.map(value =>
        choice(`${value}×`, speed === value, () => onSpeed(value), `playback-speed-${value}`))}</View>
    </>}
    <Pressable testID="playback-full-settings" accessibilityRole="button"
      accessibilityLabel="إعدادات التلاوة كاملة" onPress={onOpenSettings}
      style={({ pressed }) => [styles.more, { borderColor: colors.border, opacity: pressed ? .6 : 1 }]}>
      <Ionicons name="options-outline" size={19} color={colors.primary} />
      <Text style={[styles.moreText, { color: colors.primary }]}>إعدادات التلاوة كاملة</Text>
    </Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flexShrink: 1, minHeight: 0 },
  content: { paddingBottom: 12, gap: 9 },
  hint: { textAlign: 'right', writingDirection: 'rtl', fontSize: 12, lineHeight: 20, marginVertical: 3 },
  title: { textAlign: 'right', writingDirection: 'rtl', fontWeight: '700', fontSize: 15, marginTop: 9 },
  choices: { flexDirection: 'row-reverse', gap: 6 },
  choice: { flex: 1, minWidth: 0, minHeight: 44, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  choiceLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  more: { flexDirection: 'row-reverse', minHeight: 44, borderWidth: 1, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  moreText: { fontSize: 13, fontWeight: '700' },
});