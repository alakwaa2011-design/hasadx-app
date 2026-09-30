import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReader } from '@/context/ReaderContext';
import { chapterName, type Verse } from '@/data/quran';
import { useColors } from '@/hooks/useColors';

const steps = [
  { name: 'استمع', icon: 'headset-outline' },
  { name: 'اقرأ', icon: 'book-outline' },
  { name: 'إخفاء جزئي', icon: 'eye-off-outline' },
  { name: 'سمّع', icon: 'mic-outline' },
  { name: 'اربط', icon: 'link-outline' },
  { name: 'قيّم', icon: 'checkmark-circle-outline' },
] as const;

const headings = [
  'استمع', 'اقرأ الآية بوضوح', 'أكمل الكلمات المخفية',
  'سمّع دون النظر', 'اربط الآيات', 'قيّم تسميعك',
];
const descriptions = [
  'استمع للتلاوة المتكررة، وركّز على مخارج الكلمات وترتيبها.',
  'اقرأ معها من المصحف مرة أو مرتين لتثبيت إيقاع الآية.',
  'اضغط كلمة مخفية في المصحف لطلب تلميح.',
  'بعد التسميع، اكشف الآية وقارن قراءتك بالنص.',
  'اقرأ نهاية الآية السابقة مع بداية هذه، ثم أعدهما بلا توقف.',
  'قيّم تسميعك بصدق لنحدد الخطوة التالية.',
];

export function GuidedPractice({ verse, playing, audioError, onStageChange, onRepeatCountChange,
  onReplay, onTogglePlayback, onReveal, onAssess, onMinimize, onClose, maxHeight }: {
  verse: Verse;
  playing: boolean;
  audioError: string | null;
  onStageChange: (stage: number) => void;
  onRepeatCountChange: (count: number) => void;
  onReplay: () => void;
  onTogglePlayback: () => void;
  onReveal: () => void;
  onAssess: (result: 'mastered' | 'review') => void;
  onMinimize: () => void;
  onClose: () => void;
  maxHeight: number;
}) {
  const colors = useColors();
  const { practice } = useReader();
  if (!practice) return null;
  const stage = practice.stage;
  const primary = colors.primary;
  const action = (label: string, onPress: () => void, secondary = false) =>
    <Pressable testID={`guided-${label}`} accessibilityRole="button" accessibilityLabel={label}
      onPress={onPress} style={[styles.action, { backgroundColor: secondary ? colors.secondary : primary }]}>
      <Text style={[styles.actionText, { color: secondary ? colors.secondaryForeground : colors.primaryForeground }]}>{label}</Text>
    </Pressable>;

  return <View testID="guided-practice" style={[styles.panel, {
    backgroundColor: colors.card, borderColor: colors.border, maxHeight,
  }]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: primary }]}>حفظني</Text>
          <Text style={[styles.verseLabel, { color: colors.foreground }]}>سورة {chapterName(verse.chapter_id)} · الآية {verse.number}</Text>
        </View>
        <Pressable testID="guided-play-pause" accessibilityRole="button"
          accessibilityLabel={playing ? 'إيقاف التلاوة' : 'تشغيل التلاوة'}
          onPress={onTogglePlayback} style={[styles.icon, { backgroundColor: colors.secondary }]}>
          <Ionicons name={playing ? 'pause' : 'play'} size={20} color={primary} />
        </Pressable>
        <Pressable testID="guided-minimize" accessibilityRole="button" accessibilityLabel="تصغير جلسة الحفظ"
          onPress={onMinimize} style={styles.icon}>
          <Ionicons name="chevron-down" size={21} color={colors.mutedForeground} />
        </Pressable>
        <Pressable testID="guided-close" accessibilityRole="button" accessibilityLabel="إغلاق جلسة الحفظ"
          onPress={onClose} style={styles.icon}>
          <Ionicons name="close" size={21} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <View style={styles.steps}>
        {steps.map((item, index) =>
          <Pressable key={item.name} testID={`guided-step-${index}`} accessibilityRole="button"
            accessibilityLabel={`الانتقال إلى خطوة ${item.name}`} accessibilityState={{ selected: stage === index }}
            onPress={() => onStageChange(index)} style={styles.step}>
            <View style={[styles.stepIcon, {
              backgroundColor: stage === index ? primary : index < stage ? colors.secondary : colors.muted,
            }]}>
              <Ionicons name={item.icon} size={16} color={stage === index ? colors.primaryForeground : index < stage ? primary : colors.mutedForeground} />
            </View>
            <Text numberOfLines={1} style={[styles.stepText, { color: stage === index ? primary : colors.mutedForeground }]}>{item.name}</Text>
          </Pressable>)}
      </View>
      <View style={[styles.stageCard, { backgroundColor: colors.secondary }]}>
        <Ionicons name={steps[stage].icon} size={22} color={primary} />
        <Text style={[styles.stageTitle, { color: primary }]}>
          {stage === 0 ? `استمع ${practice.repeatCount === -1 ? 'بتكرار مستمر' : `${practice.repeatCount} مرات`}` : headings[stage]}
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{descriptions[stage]}</Text>
      </View>
      {stage === 0 && <View style={styles.repeatRow}>
        <Text style={[styles.repeatLabel, { color: colors.mutedForeground }]}>مرات الاستماع</Text>
        <View style={styles.repeatOptions}>{[1, 3, 5, 10, -1].map(count =>
          <Pressable key={count} testID={`guided-repeat-${count}`} accessibilityRole="button"
            accessibilityLabel={count === -1 ? 'تكرار مستمر' : `تكرار ${count} مرات`}
            accessibilityState={{ selected: count === practice.repeatCount }}
            onPress={() => onRepeatCountChange(count)}
            style={[styles.repeat, { backgroundColor: count === practice.repeatCount ? colors.card : colors.muted }]}>
            <Text style={{ color: count === practice.repeatCount ? primary : colors.mutedForeground, fontWeight: '700' }}>{count === -1 ? '∞' : count}</Text>
          </Pressable>)}</View>
      </View>}
      {!!audioError && <Text style={[styles.description, { color: colors.destructive }]}>{audioError}</Text>}
      {stage === 0 && <View style={styles.actions}>
        <View style={styles.half}>{action(playing ? 'ابدأ من جديد' : 'إعادة التلاوة', onReplay, true)}</View>
        <View style={styles.half}>{action('استمعت جيدًا', () => onStageChange(1))}</View>
      </View>}
      {stage === 1 && action('انتقل إلى الإخفاء الجزئي', () => onStageChange(2))}
      {stage === 2 && action('جاهز للتسميع', () => onStageChange(3))}
      {stage === 3 && action(practice.revealed ? 'انتقل إلى ربط الآيات' : 'اكشف الآية للمقارنة',
        practice.revealed ? () => onStageChange(4) : onReveal)}
      {stage === 4 && action('أتممت ربط الآيات', () => onStageChange(5))}
      {stage === 5 && <View style={styles.actions}>
        <View style={styles.half}>{action('أحتاج مراجعة', () => onAssess('review'), true)}</View>
        <View style={styles.half}>{action('أتقنتها', () => onAssess('mastered'))}</View>
      </View>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 12, right: 12, bottom: 0, borderWidth: 1, borderRadius: 22, zIndex: 8, overflow: 'hidden', elevation: 8,
    shadowColor: '#000', shadowOpacity: .15, shadowRadius: 18 },
  content: { padding: 12, gap: 9 },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  eyebrow: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
  verseLabel: { fontSize: 15, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  steps: { flexDirection: 'row-reverse', gap: 2 },
  step: { flex: 1, alignItems: 'center', minWidth: 0, gap: 4 },
  stepIcon: { height: 32, width: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 9, fontWeight: '700', textAlign: 'center' },
  stageCard: { borderRadius: 15, padding: 9, alignItems: 'center', gap: 3 },
  stageTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 12, lineHeight: 17, textAlign: 'center', writingDirection: 'rtl' },
  repeatRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  repeatLabel: { fontSize: 11, fontWeight: '700' },
  repeatOptions: { flexDirection: 'row-reverse', gap: 3 },
  repeat: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  action: { minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 8 },
  actionText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  actions: { flexDirection: 'row-reverse', gap: 8 },
  half: { flex: 1 },
});