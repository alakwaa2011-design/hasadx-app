export type IstihdarAyatPoint = {
  answer: string;
  reference: string;
};

export type IstihdarAyatItem = {
  kind: "single_recall" | "multi_point" | "numeric";
  prompt: string;
  answer: string;
  reference: string;
  sourceUrl: string;
  points?: readonly IstihdarAyatPoint[];
};

const source = (id: number) => `https://quranpedia.net/quran-qa/chapters/istihdar/${id}`;

/** Conservatively curated and verified against the linked Quranpedia pages. */
export const ISTIHDAR_AYAT_ITEMS = [
  { kind: "single_recall", prompt: "اذكر الآية الدالة على أن الصدقات تكفر بعض الذنوب والسيئات.", answer: "إِن تُبْدُواْ الصَّدَقَاتِ فَنِعِمَّا هِيَ... وَيُكَفِّرُ عَنكُم مِّن سَيِّئَاتِكُمْ", reference: "البقرة: 271", sourceUrl: source(3495) },
  { kind: "single_recall", prompt: "اذكر الآية الدالة على تكفير السيئات لمن اجتنب الكبائر.", answer: "إِن تَجْتَنِبُواْ كَبَآئِرَ مَا تُنْهَوْنَ عَنْهُ نُكَفِّرْ عَنكُمْ سَيِّئَاتِكُمْ", reference: "النساء: 31", sourceUrl: source(3552) },
  { kind: "single_recall", prompt: "اذكر الآية الدالة على رخصة قصر الصلاة في حال السفر والخوف.", answer: "وَإِذَا ضَرَبْتُمْ فِي الأَرْضِ فَلَيْسَ عَلَيْكُمْ جُنَاحٌ أَن تَقْصُرُواْ مِنَ الصَّلاَةِ", reference: "النساء: 101", sourceUrl: source(3571) },
  { kind: "single_recall", prompt: "ما مصير المنافقين يوم القيامة؟", answer: "الدرك الأسفل من النار.", reference: "النساء: 145", sourceUrl: source(3583) },
  { kind: "single_recall", prompt: "اذكر الآية التي تأمر بالعدل حتى مع الأعداء.", answer: "وَلاَ يَجْرِمَنَّكُمْ شَنَآنُ قَوْمٍ عَلَى أَلاَّ تَعْدِلُواْ اعْدِلُواْ هُوَ أَقْرَبُ لِلتَّقْوَى", reference: "المائدة: 8", sourceUrl: source(3599) },
  { kind: "single_recall", prompt: "ما سبب هلاك الأمم العظيمة؟", answer: "بسبب ذنوبهم.", reference: "الأنعام: 6", sourceUrl: source(3635) },
  { kind: "single_recall", prompt: "اذكر الآية التي تأمر بالأكل مما ذُكر اسم الله عليه.", answer: "فَكُلُواْ مِمَّا ذُكِرَ اسْمُ اللّهِ عَلَيْهِ", reference: "الأنعام: 118", sourceUrl: source(3657) },
  { kind: "single_recall", prompt: "اذكر الآية التي تبين أن الأرض موضع حياة الإنسان وموته وبعثه.", answer: "فِيهَا تَحْيَوْنَ وَفِيهَا تَمُوتُونَ وَمِنْهَا تُخْرَجُونَ", reference: "الأعراف: 25", sourceUrl: source(3681) },
  { kind: "single_recall", prompt: "اذكر الآية التي تتحدى الكفار أن يأتوا بسورة مثل القرآن.", answer: "قُلْ فَأْتُواْ بِسُورَةٍ مِّثْلِهِ", reference: "يونس: 38", sourceUrl: source(3825) },
  { kind: "single_recall", prompt: "اذكر الآية الدالة على حفظ الله للقرآن.", answer: "إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ", reference: "الحجر: 9", sourceUrl: source(3931) },
  { kind: "single_recall", prompt: "اذكر الآية الدالة على أن المكره على كلمة الكفر لا لوم عليه.", answer: "إِلاَّ مَنْ أُكْرِهَ وَقَلْبُهُ مُطْمَئِنٌّ بِالإِيمَانِ", reference: "النحل: 106", sourceUrl: source(3967) },
  { kind: "single_recall", prompt: "اذكر الآية الدالة على أن كل شيء يسبح بحمد الله.", answer: "وَإِن مِّن شَيْءٍ إِلاَّ يُسَبِّحُ بِحَمْدَهِ", reference: "الإسراء: 44", sourceUrl: source(3977) },
  { kind: "single_recall", prompt: "اذكر الآية المبينة لمشروعية تسبيح الله عقب الصلوات.", answer: "وَمِنَ اللَّيْلِ فَسَبِّحْهُ وَأَدْبَارَ السُّجُودِ", reference: "ق: 40", sourceUrl: source(4369) },
  { kind: "single_recall", prompt: "اذكر الآية التي تبين أن الضحك والبكاء من الله تعالى.", answer: "وَأَنَّهُ هُوَ أَضْحَكَ وَأَبْكَى", reference: "النجم: 43", sourceUrl: source(4401) },
  { kind: "single_recall", prompt: "اذكر الآية الدالة على أن المساجد لله فلا يدعى مع الله أحد.", answer: "وَأَنَّ الْمَسَاجِدَ لِلَّهِ فَلَا تَدْعُوا مَعَ اللَّهِ أَحَداً", reference: "الجن: 18", sourceUrl: source(4541) },

  { kind: "multi_point", prompt: "اذكر حالات الإنسان في ذكر الله تعالى، وما الوقت المفضل لهذا الذكر؟", answer: "في النفس تضرعًا وخيفة، ودون الجهر، بالغدو والآصال.", reference: "الأعراف: 205", sourceUrl: source(3746), points: [{ answer: "في نفسك", reference: "الأعراف: 205" }, { answer: "تضرعًا وخيفة", reference: "الأعراف: 205" }, { answer: "دون الجهر من القول", reference: "الأعراف: 205" }, { answer: "بالغدو والآصال", reference: "الأعراف: 205" }] },
  { kind: "multi_point", prompt: "اذكر المحرمات من البهائم والطير على المسلمين.", answer: "الميتة، الدم المسفوح، لحم الخنزير، وما أُهل لغير الله به.", reference: "الأنعام: 145", sourceUrl: source(3665), points: [{ answer: "الميتة", reference: "الأنعام: 145" }, { answer: "دمًا مسفوحًا", reference: "الأنعام: 145" }, { answer: "لحم خنزير", reference: "الأنعام: 145" }, { answer: "فسقًا أُهل لغير الله به", reference: "الأنعام: 145" }] },
  { kind: "multi_point", prompt: "اذكر من أُمرنا بإيتائهم حقهم، وماذا نقول إن أعرضنا عنهم؟", answer: "ذا القربى والمسكين وابن السبيل، وقولًا ميسورًا.", reference: "الإسراء: 26-28", sourceUrl: source(3976), points: [{ answer: "ذا القربى", reference: "الإسراء: 26" }, { answer: "المسكين", reference: "الإسراء: 26" }, { answer: "ابن السبيل", reference: "الإسراء: 26" }, { answer: "فقل لهم قولاً ميسورًا", reference: "الإسراء: 28" }] },
  { kind: "multi_point", prompt: "اذكر آداب الاستئذان في دخول البيوت.", answer: "الاستئناس، السلام، انتظار الإذن، والرجوع إذا طُلب.", reference: "النور: 27-28", sourceUrl: source(4080), points: [{ answer: "حتى تستأنسوا", reference: "النور: 27" }, { answer: "وتسلموا على أهلها", reference: "النور: 27" }, { answer: "فلا تدخلوها حتى يؤذن لكم", reference: "النور: 28" }, { answer: "وإن قيل لكم ارجعوا فارجعوا", reference: "النور: 28" }] },
  { kind: "multi_point", prompt: "اذكر فضل الله تعالى على عبده داود عليه السلام.", answer: "تسخير الجبال والطير، وشد الملك، وإيتاء الحكمة وفصل الخطاب.", reference: "ص: 17-20", sourceUrl: source(4245), points: [{ answer: "سخّر الجبال معه يسبحن", reference: "ص: 18" }, { answer: "والطير محشورة", reference: "ص: 19" }, { answer: "وشددنا ملكه", reference: "ص: 20" }, { answer: "وآتيناه الحكمة وفصل الخطاب", reference: "ص: 20" }] },
  { kind: "multi_point", prompt: "اذكر الأنهار الموجودة في الجنة.", answer: "ماء غير آسن، ولبن، وخمر، وعسل مصفى.", reference: "محمد: 15", sourceUrl: source(4343), points: [{ answer: "ماء غير آسن", reference: "محمد: 15" }, { answer: "لبن لم يتغير طعمه", reference: "محمد: 15" }, { answer: "خمر لذة للشاربين", reference: "محمد: 15" }, { answer: "عسل مصفى", reference: "محمد: 15" }] },
  { kind: "multi_point", prompt: "اذكر حال الناس عند خروجهم من قبورهم يوم القيامة.", answer: "خشع الأبصار، يخرجون كجراد منتشر، مهطعين إلى الداع.", reference: "القمر: 7-8", sourceUrl: source(4411), points: [{ answer: "خشعًا أبصارهم", reference: "القمر: 7" }, { answer: "يخرجون من الأجداث كأنهم جراد منتشر", reference: "القمر: 7" }, { answer: "مهطعين إلى الداع", reference: "القمر: 8" }] },
  { kind: "multi_point", prompt: "يوم القيامة يكون الخلق على ثلاثة أصناف، اذكرهم.", answer: "أصحاب الميمنة، وأصحاب المشأمة، والسابقون.", reference: "الواقعة: 8-11", sourceUrl: source(4432), points: [{ answer: "أصحاب الميمنة", reference: "الواقعة: 8" }, { answer: "أصحاب المشأمة", reference: "الواقعة: 9" }, { answer: "السابقون السابقون", reference: "الواقعة: 10-11" }] },
  { kind: "multi_point", prompt: "اذكر الآيات التي تبين بغض الله لمن يقول ما لا يفعل.", answer: "لِمَ تَقُولُونَ مَا لَا تَفْعَلُونَ، وكبر مقتًا عند الله أن تقولوا ما لا تفعلون.", reference: "الصف: 2-3", sourceUrl: source(4475), points: [{ answer: "لم تقولون ما لا تفعلون", reference: "الصف: 2" }, { answer: "كبر مقتًا عند الله أن تقولوا ما لا تفعلون", reference: "الصف: 3" }] },
  { kind: "multi_point", prompt: "اذكر الآيات التي تشبه إعراض الكافرين عن القرآن بحمر فرّت من أسد.", answer: "معرضين عن التذكرة، كأنهم حمر مستنفرة، فرت من قسورة.", reference: "المدثر: 49-51", sourceUrl: source(4562), points: [{ answer: "عن التذكرة معرضين", reference: "المدثر: 49" }, { answer: "كأنهم حمر مستنفرة", reference: "المدثر: 50" }, { answer: "فرت من قسورة", reference: "المدثر: 51" }] },

  { kind: "numeric", prompt: "ما عدد السموات؟", answer: "سبع سماوات.", reference: "البقرة: 29", sourceUrl: source(3455) },
  { kind: "numeric", prompt: "ما عدد الأبقار والسنابل التي رآها الملك في الرؤيا؟", answer: "سبع بقرات سمان، وسبع عجاف، وسبع سنبلات خضر، وأخر يابسات.", reference: "يوسف: 43", sourceUrl: source(3884) },
  { kind: "numeric", prompt: "ما عدد أبواب جهنم؟", answer: "لها سبعة أبواب.", reference: "الحجر: 44", sourceUrl: source(3933) },
  { kind: "numeric", prompt: "ما عدد الملائكة التي تحمل عرش الله تعالى؟", answer: "ثمانية.", reference: "الحاقة: 17", sourceUrl: source(4521) },
  { kind: "numeric", prompt: "ما عدد خزنة جهنم؟", answer: "تسعة عشر ملكًا من الزبانية الأشداء.", reference: "المدثر: 30-31", sourceUrl: source(4557) },
] as const satisfies readonly IstihdarAyatItem[];

export const ISTIHDAR_AYAT_COUNT = ISTIHDAR_AYAT_ITEMS.length;