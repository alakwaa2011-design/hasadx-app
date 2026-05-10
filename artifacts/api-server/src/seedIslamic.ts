import { db } from "@workspace/db";
import {
  islamicSectionsTable,
  islamicCategoriesTable,
  islamicQuestionsTable,
} from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { logger } from "./lib/logger";

type Q = {
  q: string;
  a: string;
  b: string;
  c: string;
  d: string;
  correct: string;
  difficulty: "easy" | "medium" | "hard";
};

const SECTION_NAME = "مسابقات قرآنية";
const SECTION_DESC =
  "مسابقات قرآنية تنافسية: ماذا بعد، أين وردت، من القارئ، غريب القرآن.";

type CatSpec = {
  name: string;
  description: string;
  order: number;
  level: "easy" | "medium" | "hard" | "mixed";
  questions: Q[];
};

const CATEGORIES: CatSpec[] = [
  {
    name: "ماذا بعد؟ — جزء عمّ",
    description: "اختر الآية التالية من جزء عمّ.",
    order: 1,
    level: "mixed",
    questions: [
      {
        q: "ماذا بعد (عَمَّ يَتَسَاءَلُونَ)؟",
        a: "عَنِ النَّبَإِ الْعَظِيمِ",
        b: "عَنِ الْيَوْمِ الْعَظِيمِ",
        c: "عَنِ الْأَمْرِ الْعَظِيمِ",
        d: "عَنِ الْخَبَرِ الْعَظِيمِ",
        correct: "عَنِ النَّبَإِ الْعَظِيمِ",
        difficulty: "easy",
      },
      {
        q: "ماذا بعد (وَالنَّازِعَاتِ غَرْقًا)؟",
        a: "وَالنَّاشِطَاتِ نَشْطًا",
        b: "وَالسَّابِحَاتِ سَبْحًا",
        c: "وَالصَّافَّاتِ صَفًّا",
        d: "وَالذَّارِيَاتِ ذَرْوًا",
        correct: "وَالنَّاشِطَاتِ نَشْطًا",
        difficulty: "easy",
      },
      {
        q: "ماذا بعد (إِذَا الشَّمْسُ كُوِّرَتْ)؟",
        a: "وَإِذَا النُّجُومُ انكَدَرَتْ",
        b: "وَإِذَا الْجِبَالُ سُيِّرَتْ",
        c: "وَإِذَا الْبِحَارُ فُجِّرَتْ",
        d: "وَإِذَا الْأَرْضُ مُدَّتْ",
        correct: "وَإِذَا النُّجُومُ انكَدَرَتْ",
        difficulty: "easy",
      },
      {
        q: "ماذا بعد (وَالْفَجْرِ)؟",
        a: "وَلَيَالٍ عَشْرٍ",
        b: "وَالشَّفْعِ وَالْوَتْرِ",
        c: "وَاللَّيْلِ إِذَا يَسْرِ",
        d: "هَلْ فِي ذَلِكَ قَسَمٌ",
        correct: "وَلَيَالٍ عَشْرٍ",
        difficulty: "medium",
      },
      {
        q: "ماذا بعد (لَمْ يَكُنِ الَّذِينَ كَفَرُوا)؟",
        a: "مِنْ أَهْلِ الْكِتَابِ وَالْمُشْرِكِينَ",
        b: "مِنَ الْمُنَافِقِينَ مُنفَكِّينَ",
        c: "لِيُبَيِّنَ لَهُمُ الْحَقَّ",
        d: "مُنفَكِّينَ حَتَّى تَأْتِيَهُمُ",
        correct: "مِنْ أَهْلِ الْكِتَابِ وَالْمُشْرِكِينَ",
        difficulty: "medium",
      },
      {
        q: "ماذا بعد (أَلْهَاكُمُ التَّكَاثُرُ)؟",
        a: "حَتَّى زُرْتُمُ الْمَقَابِرَ",
        b: "كَلَّا سَوْفَ تَعْلَمُونَ",
        c: "ثُمَّ كَلَّا سَوْفَ تَعْلَمُونَ",
        d: "كَلَّا لَوْ تَعْلَمُونَ",
        correct: "حَتَّى زُرْتُمُ الْمَقَابِرَ",
        difficulty: "medium",
      },
      {
        q: "ماذا بعد (وَالْعَصْرِ)؟",
        a: "إِنَّ الْإِنسَانَ لَفِي خُسْرٍ",
        b: "إِلَّا الَّذِينَ آمَنُوا",
        c: "وَعَمِلُوا الصَّالِحَاتِ",
        d: "وَتَوَاصَوْا بِالْحَقِّ",
        correct: "إِنَّ الْإِنسَانَ لَفِي خُسْرٍ",
        difficulty: "hard",
      },
      {
        q: "ماذا بعد (فَصَلِّ لِرَبِّكَ وَانْحَرْ)؟",
        a: "إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ",
        b: "إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ",
        c: "وَالَّذِي هُوَ يُطْعِمُنِي",
        d: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
        correct: "إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ",
        difficulty: "hard",
      },
      {
        q: "ماذا بعد (قُلْ يَا أَيُّهَا الْكَافِرُونَ)؟",
        a: "لَا أَعْبُدُ مَا تَعْبُدُونَ",
        b: "وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ",
        c: "لَكُمْ دِينُكُمْ وَلِيَ دِينِ",
        d: "وَلَا أَنَا عَابِدٌ مَّا عَبَدتُّمْ",
        correct: "لَا أَعْبُدُ مَا تَعْبُدُونَ",
        difficulty: "hard",
      },
    ],
  },
  {
    name: "أين وردت؟",
    description: "حدّد السورة التي وردت فيها الآية.",
    order: 2,
    level: "mixed",
    questions: [
      {
        q: "في أي سورة (وَالضُّحَى وَاللَّيْلِ إِذَا سَجَى)؟",
        a: "الضحى",
        b: "الشرح",
        c: "الليل",
        d: "الفجر",
        correct: "الضحى",
        difficulty: "easy",
      },
      {
        q: "في أي سورة (أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ)؟",
        a: "الشرح",
        b: "الضحى",
        c: "العلق",
        d: "القدر",
        correct: "الشرح",
        difficulty: "easy",
      },
      {
        q: "في أي سورة (وَالْعَادِيَاتِ ضَبْحًا)؟",
        a: "العاديات",
        b: "الزلزلة",
        c: "التكاثر",
        d: "القارعة",
        correct: "العاديات",
        difficulty: "easy",
      },
      {
        q: "في أي سورة (إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ)؟",
        a: "الكوثر",
        b: "الماعون",
        c: "قريش",
        d: "الفيل",
        correct: "الكوثر",
        difficulty: "medium",
      },
      {
        q: "في أي سورة (تَبَّتْ يَدَا أَبِي لَهَبٍ)؟",
        a: "المسد",
        b: "الإخلاص",
        c: "الفلق",
        d: "الناس",
        correct: "المسد",
        difficulty: "medium",
      },
      {
        q: "في أي سورة (لِإِيلَافِ قُرَيْشٍ)؟",
        a: "قريش",
        b: "الفيل",
        c: "الماعون",
        d: "الكوثر",
        correct: "قريش",
        difficulty: "medium",
      },
      {
        q: "في أي سورة (أَرَأَيْتَ الَّذِي يُكَذِّبُ بِالدِّينِ)؟",
        a: "الماعون",
        b: "الكوثر",
        c: "قريش",
        d: "التكاثر",
        correct: "الماعون",
        difficulty: "hard",
      },
      {
        q: "في أي سورة (وَمَا أَدْرَاكَ مَا الْقَارِعَةُ)؟",
        a: "القارعة",
        b: "الزلزلة",
        c: "التكاثر",
        d: "العاديات",
        correct: "القارعة",
        difficulty: "hard",
      },
      {
        q: "في أي سورة (يَوْمَ يَكُونُ النَّاسُ كَالْفَرَاشِ الْمَبْثُوثِ)؟",
        a: "القارعة",
        b: "الزلزلة",
        c: "العاديات",
        d: "التكاثر",
        correct: "القارعة",
        difficulty: "hard",
      },
    ],
  },
  {
    name: "من القارئ؟",
    description:
      "تعرّف على القارئ. (سيتم استبدال هذه الأسئلة لاحقاً بمقاطع صوتية.)",
    order: 3,
    level: "mixed",
    questions: [
      {
        q: "أي القراء يُلقَّب بـ«صوت القرآن»؟",
        a: "الشيخ عبدالباسط عبدالصمد",
        b: "الشيخ محمود خليل الحصري",
        c: "الشيخ مشاري راشد العفاسي",
        d: "الشيخ سعد الغامدي",
        correct: "الشيخ عبدالباسط عبدالصمد",
        difficulty: "easy",
      },
      {
        q: "أي القراء كان شيخاً لعموم المقارئ المصرية؟",
        a: "الشيخ محمود خليل الحصري",
        b: "الشيخ عبدالباسط عبدالصمد",
        c: "الشيخ محمد صديق المنشاوي",
        d: "الشيخ مصطفى إسماعيل",
        correct: "الشيخ محمود خليل الحصري",
        difficulty: "medium",
      },
      {
        q: "أي القراء يُعرف بـ«بلبل القرآن»؟",
        a: "الشيخ محمد صديق المنشاوي",
        b: "الشيخ عبدالباسط عبدالصمد",
        c: "الشيخ محمود خليل الحصري",
        d: "الشيخ مصطفى إسماعيل",
        correct: "الشيخ محمد صديق المنشاوي",
        difficulty: "hard",
      },
    ],
  },
  {
    name: "غريب القرآن",
    description: "ما معنى الكلمة القرآنية؟",
    order: 4,
    level: "mixed",
    questions: [
      {
        q: "ما معنى (سِجِّيل)؟",
        a: "حجارة من طين",
        b: "نار شديدة",
        c: "ريح عاتية",
        d: "ماء متدفق",
        correct: "حجارة من طين",
        difficulty: "easy",
      },
      {
        q: "ما معنى (الْأَبَّ)؟",
        a: "الكلأ والمرعى",
        b: "الماء العذب",
        c: "الهواء النقي",
        d: "الضوء الساطع",
        correct: "الكلأ والمرعى",
        difficulty: "easy",
      },
      {
        q: "ما معنى (غِسْلِينٍ)؟",
        a: "صديد أهل النار",
        b: "ماء بارد",
        c: "طعام لذيذ",
        d: "شراب حلو",
        correct: "صديد أهل النار",
        difficulty: "easy",
      },
      {
        q: "ما معنى (الضَّرِيعُ)؟",
        a: "نبات شوكي مر في النار",
        b: "ماء آسن",
        c: "حجارة ملتهبة",
        d: "هواء ساخن",
        correct: "نبات شوكي مر في النار",
        difficulty: "medium",
      },
      {
        q: "ما معنى (السِّجِلُّ)؟",
        a: "الصحيفة والكتاب",
        b: "الختم والطابع",
        c: "القلم والحبر",
        d: "الرسالة والبيان",
        correct: "الصحيفة والكتاب",
        difficulty: "medium",
      },
      {
        q: "ما معنى (وَابِلٌ)؟",
        a: "مطر شديد",
        b: "ريح قوية",
        c: "برق خاطف",
        d: "رعد مدوٍّ",
        correct: "مطر شديد",
        difficulty: "medium",
      },
      {
        q: "ما معنى (الْأَغْلَالُ)؟",
        a: "القيود في الأعناق",
        b: "الجدران الضخمة",
        c: "الأبواب الثقيلة",
        d: "الحراس الأشداء",
        correct: "القيود في الأعناق",
        difficulty: "hard",
      },
      {
        q: "ما معنى (صَلْدًا)؟",
        a: "أملس لا تربة فيه",
        b: "طيناً لزجاً",
        c: "رملاً ناعماً",
        d: "حجراً متشققاً",
        correct: "أملس لا تربة فيه",
        difficulty: "hard",
      },
      {
        q: "ما معنى (يَسْتَنكِفُ)؟",
        a: "يأنف ويتكبر",
        b: "يستعجل ويسرع",
        c: "يستغرب ويتعجب",
        d: "يستسلم ويخضع",
        correct: "يأنف ويتكبر",
        difficulty: "hard",
      },
    ],
  },
];

const SEED_MARKER = "عَمَّ يَتَسَاءَلُونَ";

export async function seedIslamicIfNeeded(): Promise<void> {
  try {
    const existingMarker = await db
      .select({ id: islamicQuestionsTable.id })
      .from(islamicQuestionsTable)
      .where(like(islamicQuestionsTable.questionText, `%${SEED_MARKER}%`))
      .limit(1);
    if (existingMarker.length > 0) return;

    logger.info("[seedIslamic] applying canonical General Quizzes seed…");

    let section = (
      await db
        .select()
        .from(islamicSectionsTable)
        .where(eq(islamicSectionsTable.name, SECTION_NAME))
        .limit(1)
    )[0];
    if (!section) {
      [section] = await db
        .insert(islamicSectionsTable)
        .values({
          name: SECTION_NAME,
          description: SECTION_DESC,
          isVisible: false,
          order: 1,
        })
        .returning();
    } else {
      await db
        .update(islamicSectionsTable)
        .set({ description: SECTION_DESC, isVisible: false, order: 1 })
        .where(eq(islamicSectionsTable.id, section.id));
    }

    for (const cat of CATEGORIES) {
      const existing = await db
        .select()
        .from(islamicCategoriesTable)
        .where(
          and(
            eq(islamicCategoriesTable.sectionId, section.id),
            eq(islamicCategoriesTable.order, cat.order),
          ),
        )
        .limit(1);

      let catRow = existing[0];
      if (!catRow) {
        [catRow] = await db
          .insert(islamicCategoriesTable)
          .values({
            sectionId: section.id,
            name: cat.name,
            description: cat.description,
            level: cat.level,
            order: cat.order,
            isVisible: true,
          })
          .returning();
      } else {
        await db
          .update(islamicCategoriesTable)
          .set({
            name: cat.name,
            description: cat.description,
            level: cat.level,
            isVisible: true,
          })
          .where(eq(islamicCategoriesTable.id, catRow.id));
      }

      await db
        .delete(islamicQuestionsTable)
        .where(eq(islamicQuestionsTable.categoryId, catRow.id));

      await db.insert(islamicQuestionsTable).values(
        cat.questions.map((q) => ({
          categoryId: catRow.id,
          questionText: q.q,
          optionA: q.a,
          optionB: q.b,
          optionC: q.c,
          optionD: q.d,
          correctAnswer: q.correct,
          difficulty: q.difficulty,
        })),
      );
    }

    logger.info(
      { sectionId: section.id, categories: CATEGORIES.length },
      "[seedIslamic] General Quizzes seed applied",
    );
  } catch (err) {
    logger.error({ err }, "[seedIslamic] failed");
  }
}
