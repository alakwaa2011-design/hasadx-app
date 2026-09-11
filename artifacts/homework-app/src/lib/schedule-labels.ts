const ARABIC_LESSON_NUMBERS = [
  "الأولى",
  "الثانية",
  "الثالثة",
  "الرابعة",
  "الخامسة",
  "السادسة",
  "السابعة",
  "الثامنة",
  "التاسعة",
  "العاشرة",
];

export function lessonNumberLabel(number: number | null | undefined, isAr: boolean) {
  if (!number) return isAr ? "حصة" : "Lesson";
  return isAr
    ? `الحصة ${ARABIC_LESSON_NUMBERS[number - 1] || number}`
    : `Lesson ${number}`;
}