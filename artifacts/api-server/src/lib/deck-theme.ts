/* Picks a v2 design identity (lib/slide-templates/designs.ts) from the lesson subject/topic/grade. */
function hashText(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function pickDeckTheme(brief: { subject?: string; topic?: string; gradeLevel?: string }): string {
  /* Choose a v2 design identity by subject and audience (lib/slide-templates/designs.ts). The pools hold
     several fitting identities; a hash of the topic picks one deterministically so two different lessons
     in the same subject do not always look identical. */
  const text = `${brief.subject ?? ""} ${brief.topic ?? ""}`.toLowerCase();
  const grade = `${(brief as { gradeLevel?: string }).gradeLevel ?? ""}`;
  const young = /(الأول|الاول|الثاني|الثالث|تمهيدي|روضة|kg|grade ?[1-3]\b|first|second|third)/i.test(grade) && !/(عشر|ثانوي|متوسط|جامع)/.test(grade);
  const religious = /(قرآن|قران|حديث|فقه|إسلام|اسلام|سيرة|توحيد|تجويد|quran|hadith|fiqh|islam)/i.test(text);
  const science = /(علوم|فيزياء|كيمياء|أحياء|احياء|تقنية|حاسب|برمجة|science|physics|chemistry|biology|computer|coding)/i.test(text);
  const nature = /(بيئة|نبات|حيوان|جغرافيا|زراعة|طبيعة|environment|plant|animal|geography)/i.test(text);
  const history = /(تاريخ|حضارة|غزوة|فلسفة|قانون|history|civilization|law|philosophy)/i.test(text);
  const language = /(عربي|لغة|نحو|بلاغة|أدب|ادب|إملاء|english|grammar|literature|language)/i.test(text);
  const math = /(رياضيات|جبر|هندسة|حساب|math|algebra|geometry)/i.test(text);
  const pool: string[] = young ? ["d_kids", "d_nature", "d_modern"]
    : religious ? ["d_textbook", "d_academic", "d_modern"]
      : math ? ["d_chalk", "d_lab", "d_modern"]
        : science ? ["d_lab", "d_chalk", "d_nature"]
          : nature ? ["d_nature", "d_lab", "d_modern"]
            : history ? ["d_academic", "d_textbook", "d_modern"]
              : language ? ["d_textbook", "d_academic", "d_modern", "d_kids"]
                : ["d_modern", "d_lab", "d_nature", "d_academic", "d_textbook"];
  return pool[hashText(text || "deck") % pool.length];
}
