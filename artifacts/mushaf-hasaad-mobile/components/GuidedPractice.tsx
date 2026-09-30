import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReader } from '@/context/ReaderContext';
import { chapterName, verses, type Verse } from '@/data/quran';
import { useColors } from '@/hooks/useColors';

const steps = ['استمع', 'اقرأ', 'إخفاء جزئي', 'سمّع', 'اربط', 'قيّم'];

export function GuidedPractice({ verse, onPlay, onPause, playing, audioError, onNext }: {
  verse: Verse; onPlay: (verse: Verse, repeat: number) => void; onPause: () => void;
  playing: boolean; audioError: string | null; onNext: (verse: Verse) => void;
}) {
  const colors = useColors();
  const { practice, practiceResults, updatePractice, assessPractice } = useReader();
  const [hints, setHints] = useState<number[]>([]);
  if (!practice) return null;
  const stage = practice.stage;
  const previous = verses.find(v => v.chapter_id === verse.chapter_id && v.number === verse.number - 1);
  const next = verses.find(v => v.chapter_id === verse.chapter_id && v.number === verse.number + 1);
  const verdict = practiceResults[`${verse.chapter_id}:${verse.number}`];
  const step = (value: number) => { updatePractice({ stage: value, revealed: false }); setHints([]); };
  const words = verse.content.trim().split(/\s+/);
  const solid = colors.primary;
  const soft = colors.mutedForeground;
  const button = (label: string, action: () => void, secondary = false) =>
    <Pressable onPress={action} style={[styles.button, { backgroundColor: secondary ? colors.secondary : solid }]}>
      <Text style={[styles.buttonText, { color: secondary ? colors.secondaryForeground : colors.primaryForeground }]}>{label}</Text>
    </Pressable>;

  return <View style={styles.body}>
    <Text style={[styles.caption, { color: soft }]}>سورة {chapterName(verse.chapter_id)} · الآية {verse.number}</Text>
    <View style={styles.steps}>{steps.map((title, index) =>
      <Pressable key={title} accessibilityLabel={`مرحلة ${title}`} onPress={() => step(index)}
        style={[styles.step, { backgroundColor: index === stage ? colors.secondary : colors.muted }]}>
        <Text style={[styles.stepText, { color: index === stage ? solid : soft }]}>{title}</Text>
      </Pressable>)}</View>
    <Text style={[styles.title, { color: colors.foreground }]}>{steps[stage]}</Text>
    {stage === 0 && <>
      <Text style={[styles.caption, { color: soft }]}>استمع للآية من القارئ المحدد. يلزم الاتصال بالإنترنت للصوت.</Text>
      <View style={styles.repeatRow}>{[1, 3, 5, 10, -1].map(count =>
        <Pressable key={count} onPress={() => updatePractice({ repeatCount: count })}
          style={[styles.repeat, { borderColor: count === practice.repeatCount ? solid : colors.border, backgroundColor: count === practice.repeatCount ? colors.secondary : colors.card }]}>
          <Text style={{ color: solid }}>{count < 0 ? '∞' : count}</Text>
        </Pressable>)}</View>
      {button(playing ? 'إيقاف مؤقت' : 'تشغيل التلاوة', () => playing ? onPause() : onPlay(verse, practice.repeatCount))}
      {!!audioError && <Text style={[styles.caption, { color: colors.destructive }]}>{audioError}</Text>}
      {button('استمعت جيدًا', () => step(1), true)}
    </>}
    {stage === 1 && <>
      <Text style={[styles.verse, { color: colors.foreground }]}>{verse.content}</Text>
      <Text style={[styles.caption, { color: soft }]}>اقرأ الآية بصوت واضح، ثم انتقل عندما تصبح مستعدًا.</Text>
      {button('انتقل إلى الإخفاء الجزئي', () => step(2))}
    </>}
    {stage === 2 && <>
      <View style={styles.words}>{words.map((word, index) =>
        <Pressable key={index} onPress={() => setHints(value => [...value, index])}
          style={[styles.word, { backgroundColor: colors.muted }]}>
          <Text style={[styles.wordText, { color: colors.foreground }]}>{index % 2 === 0 || hints.includes(index) ? word : '••••'}</Text>
        </Pressable>)}</View>
      <Text style={[styles.caption, { color: soft }]}>اضغط على أي كلمة مخفية لرؤيتها.</Text>
      {button('جاهز للتسميع', () => step(3))}
    </>}
    {stage === 3 && <>
      <Text style={[styles.verse, { color: colors.foreground }]}>
        {practice.revealed ? verse.content : 'سمّع الآية دون النظر، ثم اكشفها وقارن تلاوتك بالنص.'}
      </Text>
      {button(practice.revealed ? 'انتقل إلى ربط الآيات' : 'اكشف الآية للمقارنة',
        () => practice.revealed ? step(4) : updatePractice({ revealed: true }))}
    </>}
    {stage === 4 && <>
      <Text style={[styles.caption, { color: soft }]}>اقرأ نهاية الآية السابقة مع هذه الآية، ثم أعدهما من حفظك.</Text>
      {previous && <Text style={[styles.verse, { color: colors.foreground }]}>{previous.content}</Text>}
      <Text style={[styles.verse, { color: colors.foreground }]}>{verse.content}</Text>
      {button('أتممت الربط', () => step(5))}
    </>}
    {stage === 5 && <>
      <Text style={[styles.caption, { color: soft }]}>قيّم نفسك بصدق. هذا تقييم ذاتي محفوظ على الجهاز، وليس اختبارًا صوتيًا آليًا.</Text>
      {button('أتقنتها', () => assessPractice('mastered'))}
      {button('أحتاج مراجعة', () => assessPractice('review'), true)}
      {!!verdict && <Text style={[styles.caption, { color: solid }]}>
        {verdict === 'mastered' ? 'سُجل الإتقان على هذا الجهاز.' : 'سُجلت الحاجة للمراجعة على هذا الجهاز.'}
      </Text>}
      {next && button('الآية التالية', () => onNext(next), true)}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 20 },
  steps: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  step: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12 },
  stepText: { fontSize: 12, fontWeight: '700' },
  title: { fontWeight: '700', fontSize: 17, textAlign: 'right' },
  caption: { fontSize: 13, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
  verse: { textAlign: 'center', writingDirection: 'rtl', lineHeight: 42, fontSize: 23, paddingVertical: 15 },
  button: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingHorizontal: 14 },
  buttonText: { fontWeight: '700', fontSize: 15 },
  repeatRow: { flexDirection: 'row-reverse', gap: 8 },
  repeat: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  words: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 6, paddingVertical: 18 },
  word: { minHeight: 42, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 9 },
  wordText: { fontSize: 19, writingDirection: 'rtl' },
});