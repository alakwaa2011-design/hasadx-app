/**
 * Curated from Quranpedia's "تعريف الآيات" chapter.
 *
 * Inclusion rule: an item has one verse (or two short, directly connected
 * verses) and no more than one brief explanatory sentence in its answer.
 */
export type TaarifAyatShortItem = {
  prompt: string;
  verse: string;
  surah: string;
  ayah: string;
  explanation?: string;
  sourceUrl: string;
};

export const TAARIF_AYAT_SHORT_SOURCE_URL =
  "https://quranpedia.net/quran-qa/chapters/taarif-ayat";

export const TAARIF_AYAT_SHORT_ITEMS = [
  {
    prompt: "ما الآية التي أطلق فيها القرآن الوفاة على النوم؟",
    verse: "وَهُوَ الَّذِي يَتَوَفَّاكُمْ بِاللَّيْلِ وَيَعْلَمُ مَا جَرَحْتُمْ بِالنَّهَارِ",
    surah: "الأنعام",
    ayah: "60",
    sourceUrl: "https://quranpedia.net/quran-qa/al-anam/46",
  },
  {
    prompt: "ما الآية التي أشارت إلى الفراسة في الناس؟",
    verse: "إِنَّ فِي ذَٰلِكَ لَآيَاتٍ لِلْمُتَوَسِّمِينَ",
    surah: "الحجر",
    ayah: "75",
    explanation: "المتوسمون: المتفرسون.",
    sourceUrl: "https://quranpedia.net/quran-qa/al-hijr/50",
  },
  {
    prompt: "ما الآية التي فسرها ابن عباس بخائنة العين؟",
    verse: "يَعْلَمُ خَائِنَةَ الْأَعْيُنِ وَمَا تُخْفِي الصُّدُورُ",
    surah: "غافر",
    ayah: "19",
    sourceUrl: "https://quranpedia.net/quran-qa/ghafir/67",
  },
  {
    prompt: "ما الآية التي تأمر بحسن معاشرة الزوجة؟",
    verse: "وَعَاشِرُوهُنَّ بِالْمَعْرُوفِ",
    surah: "النساء",
    ayah: "19",
    sourceUrl: "https://quranpedia.net/quran-qa/an-nisa/280",
  },
  {
    prompt: "ما الآية التي تذكر أن فيما يكرهه الإنسان خيرًا كثيرًا؟",
    verse: "فَإِنْ كَرِهْتُمُوهُنَّ فَعَسَىٰ أَنْ تَكْرَهُوا شَيْئًا وَيَجْعَلَ اللَّهُ فِيهِ خَيْرًا كَثِيرًا",
    surah: "النساء",
    ayah: "19",
    sourceUrl: "https://quranpedia.net/quran-qa/an-nisa/289",
  },
  {
    prompt: "ما الآية التي ترفع الحرج عن الزواج من زوجة الابن المتبنّى بعد فراقه لها؟",
    verse: "لِكَيْ لَا يَكُونَ عَلَى الْمُؤْمِنِينَ حَرَجٌ فِي أَزْوَاجِ أَدْعِيَائِهِمْ إِذَا قَضَوْا مِنْهُنَّ وَطَرًا",
    surah: "الأحزاب",
    ayah: "37",
    sourceUrl: "https://quranpedia.net/quran-qa/al-ahzab/292",
  },
  {
    prompt: "ما الآية التي تقرر للنساء حقوقًا بالمعروف كما عليهن واجبات؟",
    verse: "وَلَهُنَّ مِثْلُ الَّذِي عَلَيْهِنَّ بِالْمَعْرُوفِ",
    surah: "البقرة",
    ayah: "228",
    sourceUrl: "https://quranpedia.net/quran-qa/al-baqara/294",
  },
  {
    prompt: "ما الآية التي تأمر من لا يجد نكاحًا بالاستعفاف؟",
    verse: "وَلْيَسْتَعْفِفِ الَّذِينَ لَا يَجِدُونَ نِكَاحًا حَتَّىٰ يُغْنِيَهُمُ اللَّهُ مِنْ فَضْلِهِ",
    surah: "النور",
    ayah: "33",
    sourceUrl: "https://quranpedia.net/quran-qa/an-nur/295",
  },
  {
    prompt: "ما الآية التي تحرم الجمع بين الأختين؟",
    verse: "وَأَنْ تَجْمَعُوا بَيْنَ الْأُخْتَيْنِ إِلَّا مَا قَدْ سَلَفَ ۗ إِنَّ اللَّهَ كَانَ غَفُورًا رَحِيمًا",
    surah: "النساء",
    ayah: "23",
    sourceUrl: "https://quranpedia.net/quran-qa/an-nisa/299",
  },
  {
    prompt: "ما الآية التي تأمر بالإشهاد على الطلاق أو الرجعة؟",
    verse: "وَأَشْهِدُوا ذَوَيْ عَدْلٍ مِنْكُمْ",
    surah: "الطلاق",
    ayah: "2",
    sourceUrl: "https://quranpedia.net/quran-qa/at-talaq/313",
  },
  {
    prompt: "ما الآية التي تبين مؤهلي العامل: القوة والأمانة؟",
    verse: "يَا أَبَتِ اسْتَأْجِرْهُ ۖ إِنَّ خَيْرَ مَنِ اسْتَأْجَرْتَ الْقَوِيُّ الْأَمِينُ",
    surah: "القصص",
    ayah: "26",
    sourceUrl: "https://quranpedia.net/quran-qa/al-qasas/897",
  },
  {
    prompt: "ما الآية التي تبين أثر التقوى عند مسّ طائف من الشيطان؟",
    verse: "إِنَّ الَّذِينَ اتَّقَوْا إِذَا مَسَّهُمْ طَائِفٌ مِنَ الشَّيْطَانِ تَذَكَّرُوا فَإِذَا هُمْ مُبْصِرُونَ",
    surah: "الأعراف",
    ayah: "201",
    sourceUrl: "https://quranpedia.net/quran-qa/al-araf/899",
  },
  {
    prompt: "ما الآية التي تجعل غض البصر وحفظ الفرج أزكى للمؤمنين؟",
    verse: "قُلْ لِلْمُؤْمِنِينَ يَغُضُّوا مِنْ أَبْصَارِهِمْ وَيَحْفَظُوا فُرُوجَهُمْ ۚ ذَٰلِكَ أَزْكَىٰ لَهُمْ",
    surah: "النور",
    ayah: "30",
    sourceUrl: "https://quranpedia.net/quran-qa/an-nur/906",
  },
  {
    prompt: "ما الآية التي تجعل الخوف من الله شرطًا للإيمان؟",
    verse: "وَخَافُونِ إِنْ كُنْتُمْ مُؤْمِنِينَ",
    surah: "آل عمران",
    ayah: "175",
    sourceUrl: "https://quranpedia.net/quran-qa/aal-imran/910",
  },
  {
    prompt: "ما الآية التي تعلق الفلاح بالصبر والتقوى؟",
    verse: "يَا أَيُّهَا الَّذِينَ آمَنُوا اصْبِرُوا وَصَابِرُوا وَرَابِطُوا وَاتَّقُوا اللَّهَ لَعَلَّكُمْ تُفْلِحُونَ",
    surah: "آل عمران",
    ayah: "200",
    sourceUrl: "https://quranpedia.net/quran-qa/aal-imran/913",
  },
  {
    prompt: "ما الآية التي تبين أن الشكوى إلى الله لا تنافي الصبر الجميل؟",
    verse: "قَالَ إِنَّمَا أَشْكُو بَثِّي وَحُزْنِي إِلَى اللَّهِ",
    surah: "يوسف",
    ayah: "86",
    sourceUrl: "https://quranpedia.net/quran-qa/yusuf/914",
  },
  {
    prompt: "ما الآية التي تأمر بالثبات وذكر الله عند لقاء العدو؟",
    verse: "يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا لَقِيتُمْ فِئَةً فَاثْبُتُوا وَاذْكُرُوا اللَّهَ كَثِيرًا لَعَلَّكُمْ تُفْلِحُونَ",
    surah: "الأنفال",
    ayah: "45",
    sourceUrl: "https://quranpedia.net/quran-qa/al-anfal/916",
  },
  {
    prompt: "ما الآية التي توحي بمشروعية التخفي عن الأعداء؟",
    verse: "وَلَا يُشْعِرَنَّ بِكُمْ أَحَدًا",
    surah: "الكهف",
    ayah: "19",
    sourceUrl: "https://quranpedia.net/quran-qa/al-kahf/928",
  },
  {
    prompt: "ما الآية التي جمعت زينة البدن وزينة القلب؟",
    verse: "يَا بَنِي آدَمَ قَدْ أَنْزَلْنَا عَلَيْكُمْ لِبَاسًا يُوَارِي سَوْآتِكُمْ وَرِيشًا ۖ وَلِبَاسُ التَّقْوَىٰ ذَٰلِكَ خَيْرٌ",
    surah: "الأعراف",
    ayah: "26",
    sourceUrl: "https://quranpedia.net/quran-qa/al-araf/937",
  },
  {
    prompt: "ما الآية التي تبين أن الفلاح في الوقاية من الشح؟",
    verse: "وَمَنْ يُوقَ شُحَّ نَفْسِهِ فَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ",
    surah: "الحشر",
    ayah: "9",
    sourceUrl: "https://quranpedia.net/quran-qa/al-hashr/939",
  },
  {
    prompt: "ما الآية التي تقرن الإيمان والتوحيد بالأمن؟",
    verse: "الَّذِينَ آمَنُوا وَلَمْ يَلْبِسُوا إِيمَانَهُمْ بِظُلْمٍ أُولَٰئِكَ لَهُمُ الْأَمْنُ وَهُمْ مُهْتَدُونَ",
    surah: "الأنعام",
    ayah: "82",
    explanation: "فسر النبي ﷺ الظلم هنا بالشرك.",
    sourceUrl: "https://quranpedia.net/quran-qa/al-anam/979",
  },
  {
    prompt: "ما الآية التي تبين أن الله يدافع عن الذين آمنوا؟",
    verse: "إِنَّ اللَّهَ يُدَافِعُ عَنِ الَّذِينَ آمَنُوا ۗ إِنَّ اللَّهَ لَا يُحِبُّ كُلَّ خَوَّانٍ كَفُورٍ",
    surah: "الحج",
    ayah: "38",
    sourceUrl: "https://quranpedia.net/quran-qa/al-hajj/981",
  },
  {
    prompt: "ما الآية التي تقرر أن المؤمنين إخوة؟",
    verse: "إِنَّمَا الْمُؤْمِنُونَ إِخْوَةٌ فَأَصْلِحُوا بَيْنَ أَخَوَيْكُمْ",
    surah: "الحجرات",
    ayah: "10",
    sourceUrl: "https://quranpedia.net/quran-qa/al-hujurat/995",
  },
] as const satisfies readonly TaarifAyatShortItem[];

export const TAARIF_AYAT_SHORT_COUNT = TAARIF_AYAT_SHORT_ITEMS.length;