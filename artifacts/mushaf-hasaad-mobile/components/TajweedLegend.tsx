import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

const colorFamilies = [
  {
    color: '#b50000',
    label: 'أحمر (بدرجاته)',
    overview: 'المد',
    description: 'أحكام المدّ بأنواعه: الطبيعي، الجائز، الواجب، واللازم — يختلف عدد الحركات حسب درجة اللون',
  },
  {
    color: '#09b000',
    label: 'أخضر',
    overview: 'الغنة والإخفاء والإقلاب',
    description: 'الغُنّة: الإخفاء، الإقلاب، والإدغام بغنة',
  },
  {
    color: '#3f48e6',
    label: 'أزرق',
    overview: 'القلقلة والتفخيم',
    description: 'القلقلة، وتفخيم حرف الراء',
  },
  {
    color: '#ff7b00',
    label: 'برتقالي/ذهبي',
    overview: 'الأحكام الإضافية',
    description: 'الإدغام بلا غنة، وبعض حالات الإخفاء الإضافية',
  },
  {
    color: '#a5a5a5',
    label: 'رمادي',
    overview: 'الحروف التي لا تنطق',
    description: 'حروف لا تُنطق أثناء التلاوة (كالألف بعد واو الجماعة)',
  },
];

export function TajweedLegend({ fontFallback = false }: { fontFallback?: boolean }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        testID="tajweed-legend-toggle"
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'إخفاء دليل ألوان التجويد' : 'عرض دليل ألوان التجويد'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        style={styles.toggle}
      >
        <View style={styles.paletteIndicator}>
          {colorFamilies.map(item => (
            <View key={item.label} style={[styles.indicator, { backgroundColor: item.color }]} />
          ))}
        </View>
        <Text style={[styles.heading, { color: colors.foreground }]}>دليل ألوان التجويد</Text>
        <Text style={[styles.chevron, { color: colors.mutedForeground }]}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>
      <View style={styles.overview}>
        {colorFamilies.map(item => (
          <View key={item.overview} style={styles.overviewFamily}>
            <Text style={[styles.overviewLabel, { color: colors.foreground }]}>{item.overview}</Text>
            <View style={[styles.overviewSwatch, { backgroundColor: item.color }]} />
          </View>
        ))}
      </View>
      {expanded && (
        <View style={[styles.details, { borderTopColor: colors.border }]}>
          {colorFamilies.map(item => (
            <View key={item.label} style={styles.family}>
              <View style={[styles.swatch, { backgroundColor: item.color }]} />
              <View style={styles.copy}>
                <Text style={[styles.label, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.description, { color: colors.mutedForeground }]}>{item.description}</Text>
              </View>
            </View>
          ))}
          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            الألوان تشرح عائلات القواعد ولا تمثل مطابقة حرفية لكل موضع، وقد تختلف درجتها حسب عرض الجهاز.
          </Text>
          <Text style={[styles.technicalNote, { color: colors.mutedForeground }]}>
            يتطلب إظهار الألوان دعم خط COLRv1 في نظام الجهاز.
          </Text>
          {fontFallback && (
            <Text style={[styles.fallback, { color: colors.primary }]}>
              تعذّر تحميل خط التجويد؛ عُرضت الصفحة بخط QCF V2 العادي.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 5,
    top: 2,
    right: 7,
    width: 280,
    maxWidth: '92%',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  toggle: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  paletteIndicator: { flexDirection: 'row', gap: 2 },
  indicator: { width: 5, height: 8, borderRadius: 3 },
  heading: { fontSize: 11, fontWeight: '700' },
  chevron: { fontSize: 17, marginLeft: 2 },
  overview: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 7,
    rowGap: 3,
  },
  overviewFamily: {
    width: '50%',
    minHeight: 18,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  overviewSwatch: { width: 7, height: 7, borderRadius: 4 },
  overviewLabel: { flexShrink: 1, fontSize: 9, lineHeight: 13, textAlign: 'right' },
  details: { borderTopWidth: StyleSheet.hairlineWidth, padding: 9, gap: 7 },
  family: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  swatch: { width: 9, height: 9, borderRadius: 5, marginTop: 3 },
  copy: { flexShrink: 1, gap: 1 },
  label: { fontSize: 10, fontWeight: '700', textAlign: 'right' },
  description: { fontSize: 9, lineHeight: 13, textAlign: 'right' },
  note: { fontSize: 9, lineHeight: 13, textAlign: 'right' },
  technicalNote: { fontSize: 8, lineHeight: 11, textAlign: 'right', opacity: 0.7 },
  fallback: { fontSize: 9, lineHeight: 13, textAlign: 'right', fontWeight: '600' },
});