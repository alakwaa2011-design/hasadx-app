export type LetrlyCategory = "general" | "animals" | "fruits" | "cities" | "science" | "islamic";
export type LetrlyLength = 4 | 5 | 6;

export interface LetrlyWord {
  word: string;
  normalized: string;
  hint: string;
  category: LetrlyCategory;
}

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

export function normalizeArabic(text: string): string {
  return text
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/\s+/g, "")
    .trim();
}

const RAW_WORDS: Array<Omit<LetrlyWord, "normalized">> = [
  // ===== حيوانات =====
  { word: "حصان", category: "animals", hint: "يُركَب ويجري بسرعة" },
  { word: "ثعلب", category: "animals", hint: "حيوان ماكر" },
  { word: "أرنب", category: "animals", hint: "يحب الجزر" },
  { word: "غزال", category: "animals", hint: "حيوان رشيق وسريع" },
  { word: "نمر", category: "animals", hint: "حيوان مخطط مفترس" },
  { word: "ذئب", category: "animals", hint: "يعوي في الليل" },
  { word: "قطة", category: "animals", hint: "أليفة وتموء" },
  { word: "بقرة", category: "animals", hint: "تعطي الحليب" },
  { word: "خروف", category: "animals", hint: "نأخذ منه الصوف" },
  { word: "جمل", category: "animals", hint: "سفينة الصحراء" },
  { word: "نسر", category: "animals", hint: "طائر جارح كبير" },
  { word: "حوت", category: "animals", hint: "أكبر كائن في البحر" },
  { word: "فهد", category: "animals", hint: "أسرع حيوان بري" },
  { word: "زرافة", category: "animals", hint: "أطول حيوان في العالم" },
  { word: "دلفين", category: "animals", hint: "حيوان بحري ذكي" },
  { word: "تمساح", category: "animals", hint: "زاحف خطير في الأنهار" },
  { word: "حمامة", category: "animals", hint: "رمز السلام" },
  { word: "عصفور", category: "animals", hint: "طائر صغير يغرد" },
  { word: "فراشة", category: "animals", hint: "حشرة ملونة تطير" },
  { word: "ضفدع", category: "animals", hint: "ينقّ قرب الماء" },
  { word: "غراب", category: "animals", hint: "طائر أسود ذكي" },
  { word: "ضبع", category: "animals", hint: "حيوان يأكل الجِيَف" },
  { word: "بطة", category: "animals", hint: "طائر مائي" },
  { word: "فيل", category: "animals", hint: "أكبر حيوان بري" },
  { word: "أسد", category: "animals", hint: "ملك الغابة" },
  { word: "قرد", category: "animals", hint: "يتسلق الأشجار" },
  { word: "دب", category: "animals", hint: "ضخم يحب العسل" },
  { word: "ثور", category: "animals", hint: "ذكر البقرة" },
  { word: "كلب", category: "animals", hint: "صديق الإنسان الوفي" },
  { word: "عقرب", category: "animals", hint: "حشرة سامة لها ذيل" },
  { word: "حمار", category: "animals", hint: "يحمل الأثقال" },
  { word: "نعامة", category: "animals", hint: "أكبر طائر لا يطير" },
  { word: "أفعى", category: "animals", hint: "زاحف طويل" },
  { word: "ببغاء", category: "animals", hint: "يقلّد الكلام" },

  // ===== فواكه وخضار =====
  { word: "تفاح", category: "fruits", hint: "أحمر أو أخضر" },
  { word: "موز", category: "fruits", hint: "فاكهة صفراء منحنية" },
  { word: "عنب", category: "fruits", hint: "في عناقيد" },
  { word: "بطيخ", category: "fruits", hint: "أخضر من الخارج، أحمر من الداخل" },
  { word: "رمان", category: "fruits", hint: "مليء بالحبوب الحمراء" },
  { word: "تين", category: "fruits", hint: "ذكر في القرآن" },
  { word: "خوخ", category: "fruits", hint: "ناعم برتقالي" },
  { word: "ليمون", category: "fruits", hint: "حامض أصفر" },
  { word: "كرز", category: "fruits", hint: "صغير أحمر داكن" },
  { word: "تمر", category: "fruits", hint: "فاكهة النخيل" },
  { word: "أناناس", category: "fruits", hint: "استوائي شوكي" },
  { word: "مشمش", category: "fruits", hint: "صغير برتقالي" },
  { word: "مانجو", category: "fruits", hint: "استوائي حلو" },
  { word: "فراولة", category: "fruits", hint: "حمراء صغيرة" },
  { word: "كمثرى", category: "fruits", hint: "شكلها كالجرس" },
  { word: "برتقال", category: "fruits", hint: "حمضي برتقالي" },
  { word: "جزر", category: "fruits", hint: "يقوّي النظر" },
  { word: "خيار", category: "fruits", hint: "أخضر طويل" },
  { word: "بصل", category: "fruits", hint: "يبكينا عند تقطيعه" },
  { word: "ثوم", category: "fruits", hint: "رائحته قوية" },
  { word: "بطاطا", category: "fruits", hint: "تُقلى أو تُسلق" },
  { word: "فلفل", category: "fruits", hint: "حار أو حلو" },
  { word: "طماطم", category: "fruits", hint: "أحمر للصلصة" },
  { word: "خس", category: "fruits", hint: "أوراق خضراء للسلطة" },
  { word: "قرنبيط", category: "fruits", hint: "أبيض على شكل وردة" },
  { word: "كوسا", category: "fruits", hint: "خضراء طويلة تُحشى" },

  // ===== مدن وبلدان =====
  { word: "مكة", category: "cities", hint: "أقدس مدن المسلمين" },
  { word: "المدينة", category: "cities", hint: "مدينة الرسول ﷺ" },
  { word: "الرياض", category: "cities", hint: "عاصمة السعودية" },
  { word: "جدة", category: "cities", hint: "عروس البحر الأحمر" },
  { word: "دبي", category: "cities", hint: "مدينة برج خليفة" },
  { word: "القاهرة", category: "cities", hint: "عاصمة مصر" },
  { word: "بغداد", category: "cities", hint: "عاصمة العراق" },
  { word: "دمشق", category: "cities", hint: "عاصمة سوريا" },
  { word: "بيروت", category: "cities", hint: "عاصمة لبنان" },
  { word: "عمان", category: "cities", hint: "عاصمة الأردن" },
  { word: "تونس", category: "cities", hint: "عاصمة وبلد" },
  { word: "الجزائر", category: "cities", hint: "عاصمة وبلد" },
  { word: "الخرطوم", category: "cities", hint: "عاصمة السودان" },
  { word: "مسقط", category: "cities", hint: "عاصمة عمان" },
  { word: "الدوحة", category: "cities", hint: "عاصمة قطر" },
  { word: "صنعاء", category: "cities", hint: "عاصمة اليمن" },
  { word: "الكويت", category: "cities", hint: "بلد خليجي" },
  { word: "البحرين", category: "cities", hint: "أرخبيل خليجي" },
  { word: "إسطنبول", category: "cities", hint: "مدينة على بوغاز" },
  { word: "باريس", category: "cities", hint: "مدينة الأنوار" },
  { word: "لندن", category: "cities", hint: "عاصمة بريطانيا" },
  { word: "روما", category: "cities", hint: "عاصمة إيطاليا" },
  { word: "طوكيو", category: "cities", hint: "عاصمة اليابان" },
  { word: "موسكو", category: "cities", hint: "عاصمة روسيا" },
  { word: "الأقصى", category: "cities", hint: "أولى القبلتين" },
  { word: "حلب", category: "cities", hint: "أقدم المدن" },
  { word: "فاس", category: "cities", hint: "عاصمة علمية مغربية" },

  // ===== علوم =====
  { word: "ذرة", category: "science", hint: "أصغر وحدة في المادة" },
  { word: "خلية", category: "science", hint: "وحدة بناء الكائن الحي" },
  { word: "كوكب", category: "science", hint: "يدور حول النجم" },
  { word: "نجم", category: "science", hint: "يضيء في السماء" },
  { word: "قمر", category: "science", hint: "تابع الأرض" },
  { word: "شمس", category: "science", hint: "نجم مجموعتنا" },
  { word: "مريخ", category: "science", hint: "الكوكب الأحمر" },
  { word: "زحل", category: "science", hint: "كوكب ذو حلقات" },
  { word: "حديد", category: "science", hint: "معدن صلب" },
  { word: "ذهب", category: "science", hint: "معدن نفيس أصفر" },
  { word: "فضة", category: "science", hint: "معدن أبيض لامع" },
  { word: "نحاس", category: "science", hint: "معدن أحمر للأسلاك" },
  { word: "ماء", category: "science", hint: "H2O" },
  { word: "هواء", category: "science", hint: "خليط من غازات" },
  { word: "بركان", category: "science", hint: "ينفجر منه الحمم" },
  { word: "زلزال", category: "science", hint: "اهتزاز الأرض" },
  { word: "محيط", category: "science", hint: "أكبر مسطح مائي" },
  { word: "صحراء", category: "science", hint: "أرض جافة رملية" },
  { word: "مغناطيس", category: "science", hint: "يجذب الحديد" },
  { word: "كهرباء", category: "science", hint: "تشغّل الأجهزة" },
  { word: "ضوء", category: "science", hint: "ينير الظلام" },
  { word: "صوت", category: "science", hint: "موجة نسمعها" },
  { word: "غاز", category: "science", hint: "حالة من حالات المادة" },
  { word: "بخار", category: "science", hint: "ماء غازي" },
  { word: "ثلج", category: "science", hint: "ماء متجمد" },
  { word: "نبات", category: "science", hint: "كائن أخضر يصنع غذاءه" },
  { word: "حيوان", category: "science", hint: "كائن يتحرك" },
  { word: "سحاب", category: "science", hint: "في السماء يحمل المطر" },

  // ===== إسلامي =====
  { word: "صلاة", category: "islamic", hint: "ركن من أركان الإسلام" },
  { word: "زكاة", category: "islamic", hint: "ركن مالي من أركان الإسلام" },
  { word: "صيام", category: "islamic", hint: "ركن في رمضان" },
  { word: "حج", category: "islamic", hint: "ركن إلى البيت الحرام" },
  { word: "قرآن", category: "islamic", hint: "كلام الله المنزل" },
  { word: "كعبة", category: "islamic", hint: "قبلة المسلمين" },
  { word: "مسجد", category: "islamic", hint: "بيت الله" },
  { word: "أذان", category: "islamic", hint: "نداء للصلاة" },
  { word: "إيمان", category: "islamic", hint: "تصديق بالقلب" },
  { word: "إسلام", category: "islamic", hint: "دين الحق" },
  { word: "توحيد", category: "islamic", hint: "إفراد الله بالعبادة" },
  { word: "تقوى", category: "islamic", hint: "خوف من الله" },
  { word: "شكر", category: "islamic", hint: "حمد على النعمة" },
  { word: "صبر", category: "islamic", hint: "خلق محبوب" },
  { word: "زمزم", category: "islamic", hint: "بئر مبارك" },
  { word: "هجرة", category: "islamic", hint: "انتقال الرسول ﷺ" },
  { word: "نبي", category: "islamic", hint: "مرسل من الله" },
  { word: "رسول", category: "islamic", hint: "نبي بشرع جديد" },
  { word: "ملاك", category: "islamic", hint: "مخلوق من نور" },
  { word: "جنة", category: "islamic", hint: "دار النعيم" },
  { word: "وضوء", category: "islamic", hint: "طهارة قبل الصلاة" },
  { word: "ركوع", category: "islamic", hint: "ركن في الصلاة" },
  { word: "سجود", category: "islamic", hint: "أقرب ما يكون العبد" },
  { word: "تسبيح", category: "islamic", hint: "ذكر سبحان الله" },
  { word: "تكبير", category: "islamic", hint: "قول الله أكبر" },
  { word: "محراب", category: "islamic", hint: "مكان الإمام في المسجد" },
  { word: "عمرة", category: "islamic", hint: "زيارة لبيت الله" },
  { word: "فطر", category: "islamic", hint: "عيد بعد رمضان" },
  { word: "أضحى", category: "islamic", hint: "عيد بعد الحج" },
  { word: "إخلاص", category: "islamic", hint: "سورة فيها التوحيد" },

  // ===== عام =====
  { word: "كتاب", category: "general", hint: "خير جليس" },
  { word: "قلم", category: "general", hint: "أداة الكتابة" },
  { word: "باب", category: "general", hint: "مدخل البيت" },
  { word: "بيت", category: "general", hint: "مأوى الإنسان" },
  { word: "ولد", category: "general", hint: "ابن صغير" },
  { word: "بنت", category: "general", hint: "أنثى صغيرة" },
  { word: "أم", category: "general", hint: "الجنة تحت قدميها" },
  { word: "أب", category: "general", hint: "ربّ الأسرة" },
  { word: "أخ", category: "general", hint: "ابن أبيك" },
  { word: "أخت", category: "general", hint: "بنت أبيك" },
  { word: "صديق", category: "general", hint: "رفيق وفي" },
  { word: "حب", category: "general", hint: "شعور جميل" },
  { word: "فرح", category: "general", hint: "سرور وانشراح" },
  { word: "حلم", category: "general", hint: "ما تراه في النوم" },
  { word: "نور", category: "general", hint: "ضد الظلام" },
  { word: "ظل", category: "general", hint: "يبرد في الصيف" },
  { word: "ليل", category: "general", hint: "ضد النهار" },
  { word: "نهار", category: "general", hint: "زمن الضوء" },
  { word: "صباح", category: "general", hint: "بداية اليوم" },
  { word: "مساء", category: "general", hint: "آخر اليوم" },
  { word: "مدرسة", category: "general", hint: "مكان التعلم" },
  { word: "معلم", category: "general", hint: "يشرح الدرس" },
  { word: "طالب", category: "general", hint: "يتعلم العلم" },
  { word: "درس", category: "general", hint: "حصة تعليمية" },
  { word: "سيارة", category: "general", hint: "وسيلة نقل" },
  { word: "طائرة", category: "general", hint: "تحلق في السماء" },
  { word: "قطار", category: "general", hint: "يسير على القضبان" },
  { word: "سفينة", category: "general", hint: "تمخر البحار" },
  { word: "دراجة", category: "general", hint: "ذات عجلتين" },
  { word: "حقيبة", category: "general", hint: "نحمل فيها أغراضنا" },
  { word: "ساعة", category: "general", hint: "تخبرك بالوقت" },
  { word: "مفتاح", category: "general", hint: "يفتح القفل" },
  { word: "خبز", category: "general", hint: "غذاء أساسي" },
  { word: "حليب", category: "general", hint: "شراب أبيض" },
  { word: "عسل", category: "general", hint: "شفاء من النحل" },
  { word: "زيت", category: "general", hint: "للطبخ والقلي" },
  { word: "ملح", category: "general", hint: "يضيف الطعم" },
  { word: "سكر", category: "general", hint: "حلو المذاق" },
  { word: "شاي", category: "general", hint: "مشروب ساخن شائع" },
  { word: "قهوة", category: "general", hint: "مشروب البن" },
  { word: "وردة", category: "general", hint: "أجمل الأزهار" },
  { word: "شجرة", category: "general", hint: "ذات جذور وأغصان" },
  { word: "زهرة", category: "general", hint: "تتفتح وتعطر" },
  { word: "نهر", category: "general", hint: "ماء جار" },
  { word: "بحر", category: "general", hint: "ماء مالح واسع" },
  { word: "جبل", category: "general", hint: "أوتاد الأرض" },
  { word: "غيم", category: "general", hint: "في السماء" },
  { word: "مطر", category: "general", hint: "غيث من السماء" },
  { word: "ريح", category: "general", hint: "هواء متحرك" },
  { word: "نار", category: "general", hint: "تحرق وتضيء" },
  { word: "تراب", category: "general", hint: "ما تطؤه قدمك" },
  { word: "رمل", category: "general", hint: "حبيبات في الشاطئ" },
  { word: "حجر", category: "general", hint: "صلب يتكسر بصعوبة" },
  { word: "نقود", category: "general", hint: "للشراء" },
  { word: "هدية", category: "general", hint: "تُقدَّم بمحبة" },
  { word: "لعبة", category: "general", hint: "للمتعة والتسلية" },
  { word: "أمل", category: "general", hint: "تطلع للمستقبل" },
  { word: "علم", category: "general", hint: "نور وهدى" },
  { word: "حياة", category: "general", hint: "ضد الموت" },
  { word: "وقت", category: "general", hint: "ذهب لمن يستثمره" },
  { word: "طريق", category: "general", hint: "ممر للسير" },
  { word: "مدينة", category: "general", hint: "تجمع سكاني كبير" },
  { word: "قرية", category: "general", hint: "تجمع سكاني صغير" },
  { word: "ملك", category: "general", hint: "حاكم البلاد" },
  { word: "وزير", category: "general", hint: "مساعد الملك" },
  { word: "جيش", category: "general", hint: "حماية الوطن" },
  { word: "وطن", category: "general", hint: "حب يسكن القلب" },
  { word: "علم", category: "general", hint: "راية الدولة" },
];

export const ALL_WORDS: LetrlyWord[] = RAW_WORDS.map((w) => ({
  ...w,
  normalized: normalizeArabic(w.word),
}));

const NORMALIZED_SET = new Set(ALL_WORDS.map((w) => w.normalized));

export const CATEGORY_LABELS: Record<LetrlyCategory, string> = {
  general: "متنوّع",
  animals: "حيوانات",
  fruits: "فواكه وخضار",
  cities: "مدن وبلدان",
  science: "علوم",
  islamic: "إسلامي",
};

export const CATEGORY_EMOJI: Record<LetrlyCategory, string> = {
  general: "✨",
  animals: "🦁",
  fruits: "🍎",
  cities: "🕌",
  science: "🔬",
  islamic: "📖",
};

// "general" acts as a mixed pool (any category). Other categories filter strictly
// and return null when no words exist for that category × length combination.
export function getRandomWord(
  category: LetrlyCategory,
  length: LetrlyLength
): LetrlyWord | null {
  const byLen = ALL_WORDS.filter((w) => w.normalized.length === length);
  const pool = category === "general" ? byLen : byLen.filter((w) => w.category === category);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function countWords(category: LetrlyCategory, length: LetrlyLength): number {
  const byLen = ALL_WORDS.filter((w) => w.normalized.length === length);
  if (category === "general") return byLen.length;
  return byLen.filter((w) => w.category === category).length;
}

// Per-length sets of normalized words loaded on demand from /data/dict-N.json.
// These augment NORMALIZED_SET (the small themed list) so the game accepts
// virtually any real Arabic word as a guess. Loaded once per length per
// session and cached.
const LOADED_DICTS: Record<number, Set<string> | null> = { 4: null, 5: null, 6: null };
const LOAD_PROMISES: Record<number, Promise<Set<string>> | null> = { 4: null, 5: null, 6: null };

export function isDictionaryLoaded(length: number): boolean {
  return LOADED_DICTS[length] !== null;
}

export function preloadDictionary(length: number): Promise<Set<string>> {
  if (length !== 4 && length !== 5 && length !== 6) {
    return Promise.resolve(new Set<string>());
  }
  if (LOADED_DICTS[length]) return Promise.resolve(LOADED_DICTS[length]!);
  if (LOAD_PROMISES[length]) return LOAD_PROMISES[length]!;
  // BASE_URL already includes a trailing slash and the artifact prefix.
  const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
  const url = `${base}data/dict-${length}.json`;
  const p = fetch(url, { credentials: "omit" })
    .then((r) => {
      if (!r.ok) throw new Error(`dict ${length} HTTP ${r.status}`);
      return r.json() as Promise<string[]>;
    })
    .then((arr) => {
      const set = new Set<string>(arr);
      // Always include the themed words for that length so even if the asset
      // is unavailable the original behavior is preserved.
      for (const w of ALL_WORDS) {
        if (w.normalized.length === length) set.add(w.normalized);
      }
      LOADED_DICTS[length] = set;
      return set;
    })
    .catch((err) => {
      // On failure, fall back to the static themed-word set so the game still
      // works (just with the small list as before).
      console.warn("[letrly] dictionary preload failed", err);
      const fallback = new Set<string>();
      for (const w of ALL_WORDS) {
        if (w.normalized.length === length) fallback.add(w.normalized);
      }
      LOADED_DICTS[length] = fallback;
      return fallback;
    });
  LOAD_PROMISES[length] = p;
  return p;
}

export function isInDictionary(guess: string, length: number): boolean {
  const n = normalizeArabic(guess);
  if (n.length !== length) return false;
  const loaded = LOADED_DICTS[length];
  if (loaded && loaded.has(n)) return true;
  return NORMALIZED_SET.has(n);
}

export type TileState = "correct" | "present" | "absent" | "empty" | "tbd";

export interface TileResult {
  letter: string;
  state: TileState;
}

export function evaluateGuess(guess: string, target: string): TileResult[] {
  const g = normalizeArabic(guess);
  const t = normalizeArabic(target);
  const len = t.length;
  const result: TileResult[] = new Array(len);
  const targetLetters = t.split("");
  const guessLetters = g.split("");
  const used = new Array(len).fill(false);

  for (let i = 0; i < len; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = { letter: guessLetters[i], state: "correct" };
      used[i] = true;
    }
  }

  for (let i = 0; i < len; i++) {
    if (result[i]) continue;
    let foundIdx = -1;
    for (let j = 0; j < len; j++) {
      if (!used[j] && targetLetters[j] === guessLetters[i]) {
        foundIdx = j;
        break;
      }
    }
    if (foundIdx >= 0) {
      result[i] = { letter: guessLetters[i], state: "present" };
      used[foundIdx] = true;
    } else {
      result[i] = { letter: guessLetters[i], state: "absent" };
    }
  }

  return result;
}

export function mergeKeyboardStates(
  prev: Record<string, TileState>,
  results: TileResult[]
): Record<string, TileState> {
  const next = { ...prev };
  const priority: Record<TileState, number> = {
    empty: 0,
    tbd: 1,
    absent: 2,
    present: 3,
    correct: 4,
  };
  for (const r of results) {
    const cur = next[r.letter] ?? "empty";
    if (priority[r.state] > priority[cur]) {
      next[r.letter] = r.state;
    }
  }
  return next;
}

// iPhone/Galaxy-style Arabic keyboard layout (3 rows, 12/11/11 keys).
// Action keys: BACK (right side under RTL flex) and ENTER (left side).
export const ARABIC_KEYBOARD_ROWS: string[][] = [
  ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د"],
  ["ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط"],
  ["BACK", "ذ", "ظ", "ز", "و", "ة", "ى", "ر", "ؤ", "ء", "ENTER"],
];

export function buildShareGrid(rows: TileResult[][], won: boolean, max: number): string {
  const head = won ? `تحدي الكلمة ${rows.length}/${max} 🎯` : `تحدي الكلمة ✗/${max}`;
  const body = rows
    .map((row) =>
      row
        .map((t) => (t.state === "correct" ? "🟩" : t.state === "present" ? "🟨" : "⬜"))
        .join("")
    )
    .join("\n");
  return `${head}\n\n${body}`;
}
