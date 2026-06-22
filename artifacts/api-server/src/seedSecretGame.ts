import { db, secretGameCategoriesTable, secretGameItemsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

const SEED_KEY = "secret_game_v1";

const CATEGORIES_DATA: Array<{
  nameAr: string;
  icon: string;
  coverImageUrl: string;
  sortOrder: number;
  items: Array<{ nameAr: string; imageUrl: string; difficulty: string }>;
}> = [
  {
    nameAr: "الحيوانات",
    icon: "🐾",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Lion_waiting_in_Namibia.jpg/300px-Lion_waiting_in_Namibia.jpg",
    sortOrder: 1,
    items: [
      { nameAr: "أسد", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Lion_waiting_in_Namibia.jpg/300px-Lion_waiting_in_Namibia.jpg", difficulty: "easy" },
      { nameAr: "فيل", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/African_Bush_Elephant.jpg/300px-African_Bush_Elephant.jpg", difficulty: "easy" },
      { nameAr: "زرافة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Giraffe_Mikumi_National_Park.jpg/300px-Giraffe_Mikumi_National_Park.jpg", difficulty: "easy" },
      { nameAr: "نمر", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Bengal_tiger_background_cut.jpg/300px-Bengal_tiger_background_cut.jpg", difficulty: "easy" },
      { nameAr: "دولفين", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Tursiops_truncatus_01.jpg/300px-Tursiops_truncatus_01.jpg", difficulty: "easy" },
      { nameAr: "جمل", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Camels_in_Jordan.jpg/300px-Camels_in_Jordan.jpg", difficulty: "easy" },
      { nameAr: "ذئب", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Kolm%C3%A5rden_Wolf.jpg/300px-Kolm%C3%A5rden_Wolf.jpg", difficulty: "medium" },
      { nameAr: "بطريق", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Penguins-under-water.jpg/300px-Penguins-under-water.jpg", difficulty: "easy" },
      { nameAr: "تمساح", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Nile_crocodile_head.jpg/300px-Nile_crocodile_head.jpg", difficulty: "medium" },
      { nameAr: "طاووس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Peacock_Plumage.jpg/300px-Peacock_Plumage.jpg", difficulty: "medium" },
      { nameAr: "قرد", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Capuchin_Costa_Rica.jpg/300px-Capuchin_Costa_Rica.jpg", difficulty: "easy" },
      { nameAr: "حصان", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Nokota_Horses_cropped.jpg/300px-Nokota_Horses_cropped.jpg", difficulty: "easy" },
      { nameAr: "وحيد القرن", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Black_Rhino_Ngorongoro.jpg/300px-Black_Rhino_Ngorongoro.jpg", difficulty: "medium" },
      { nameAr: "أخطبوط", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Giant_octopus_seba.jpg/300px-Giant_octopus_seba.jpg", difficulty: "medium" },
      { nameAr: "كنغر", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Kangaroo_and_joey03.jpg/300px-Kangaroo_and_joey03.jpg", difficulty: "medium" },
      { nameAr: "فهد", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Cheeta_Racing.jpg/300px-Cheeta_Racing.jpg", difficulty: "medium" },
      { nameAr: "دب", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Ours_brun_parcanimalierpyrenees_1.jpg/300px-Ours_brun_parcanimalierpyrenees_1.jpg", difficulty: "easy" },
      { nameAr: "أرنب", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Oryctolagus_cuniculus_Rcdo.jpg/300px-Oryctolagus_cuniculus_Rcdo.jpg", difficulty: "easy" },
    ],
  },
  {
    nameAr: "الأنبياء",
    icon: "🌙",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Masjid_Al_Nabawi.jpg/300px-Masjid_Al_Nabawi.jpg",
    sortOrder: 2,
    items: [
      { nameAr: "موسى", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Crossing_the_Red_Sea_by_the_Israelites.jpg/300px-Crossing_the_Red_Sea_by_the_Israelites.jpg", difficulty: "easy" },
      { nameAr: "عيسى", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Jesus_und_die_Sünderin.jpg/300px-Jesus_und_die_Sünderin.jpg", difficulty: "easy" },
      { nameAr: "إبراهيم", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Kaaba_2010.jpg/300px-Kaaba_2010.jpg", difficulty: "easy" },
      { nameAr: "محمد ﷺ", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Masjid_Al_Nabawi.jpg/300px-Masjid_Al_Nabawi.jpg", difficulty: "easy" },
      { nameAr: "يوسف", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Egypt_Giza.jpg/300px-Egypt_Giza.jpg", difficulty: "easy" },
      { nameAr: "نوح", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Mount_Ararat_and_the_Araratian_plain.jpg/300px-Mount_Ararat_and_the_Araratian_plain.jpg", difficulty: "medium" },
      { nameAr: "داود", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Jerusalem_-_panoramio.jpg/300px-Jerusalem_-_panoramio.jpg", difficulty: "medium" },
      { nameAr: "سليمان", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Jerusalem_-_panoramio.jpg/300px-Jerusalem_-_panoramio.jpg", difficulty: "medium" },
      { nameAr: "يونس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/White_shark.jpg/300px-White_shark.jpg", difficulty: "medium" },
      { nameAr: "إسماعيل", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Kaaba_2010.jpg/300px-Kaaba_2010.jpg", difficulty: "medium" },
      { nameAr: "صالح", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Mada%27in_Salih.jpg/300px-Mada%27in_Salih.jpg", difficulty: "hard" },
      { nameAr: "هود", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Hadhramaut.jpg/300px-Hadhramaut.jpg", difficulty: "hard" },
      { nameAr: "أيوب", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Patience.jpg/300px-Patience.jpg", difficulty: "hard" },
      { nameAr: "إدريس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Starry_Night_Over_the_Rhone.jpg/300px-Starry_Night_Over_the_Rhone.jpg", difficulty: "hard" },
      { nameAr: "زكريا", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/ChurchofNativity.jpg/300px-ChurchofNativity.jpg", difficulty: "hard" },
    ],
  },
  {
    nameAr: "سور القرآن",
    icon: "📖",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Quran_reading.jpg/300px-Quran_reading.jpg",
    sortOrder: 3,
    items: [
      { nameAr: "الفاتحة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Al-Fatiha.jpg/300px-Al-Fatiha.jpg", difficulty: "easy" },
      { nameAr: "البقرة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Baqara.jpg/300px-Baqara.jpg", difficulty: "easy" },
      { nameAr: "يوسف", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Egypt_Giza.jpg/300px-Egypt_Giza.jpg", difficulty: "medium" },
      { nameAr: "الكهف", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Cave_Hira.jpg/300px-Cave_Hira.jpg", difficulty: "medium" },
      { nameAr: "مريم", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Mariam_bint_Imran.jpg/300px-Mariam_bint_Imran.jpg", difficulty: "medium" },
      { nameAr: "يس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Quran_reading.jpg/300px-Quran_reading.jpg", difficulty: "easy" },
      { nameAr: "الرحمن", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Surah_Rahman.jpg/300px-Surah_Rahman.jpg", difficulty: "easy" },
      { nameAr: "الواقعة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Quran_reading.jpg/300px-Quran_reading.jpg", difficulty: "medium" },
      { nameAr: "الملك", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Quran_reading.jpg/300px-Quran_reading.jpg", difficulty: "medium" },
      { nameAr: "الإخلاص", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Surah_Ikhlas.jpg/300px-Surah_Ikhlas.jpg", difficulty: "easy" },
      { nameAr: "الفلق", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Quran_reading.jpg/300px-Quran_reading.jpg", difficulty: "easy" },
      { nameAr: "الناس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Quran_reading.jpg/300px-Quran_reading.jpg", difficulty: "easy" },
      { nameAr: "العلق", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Hira_Cave.JPG/300px-Hira_Cave.JPG", difficulty: "medium" },
      { nameAr: "آل عمران", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Quran_reading.jpg/300px-Quran_reading.jpg", difficulty: "medium" },
      { nameAr: "الضحى", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Sunset_2007-1.jpg/300px-Sunset_2007-1.jpg", difficulty: "medium" },
    ],
  },
  {
    nameAr: "المدن",
    icon: "🌍",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Kuwait_Towers01.jpg/300px-Kuwait_Towers01.jpg",
    sortOrder: 4,
    items: [
      { nameAr: "مكة المكرمة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Kaaba_2010.jpg/300px-Kaaba_2010.jpg", difficulty: "easy" },
      { nameAr: "المدينة المنورة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Masjid_Al_Nabawi.jpg/300px-Masjid_Al_Nabawi.jpg", difficulty: "easy" },
      { nameAr: "الرياض", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Riyadh_skyline.jpg/300px-Riyadh_skyline.jpg", difficulty: "easy" },
      { nameAr: "القاهرة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Cairo_Collage_by_Sherif_Mohsen.jpg/300px-Cairo_Collage_by_Sherif_Mohsen.jpg", difficulty: "easy" },
      { nameAr: "بغداد", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Baghdad_by_Mstyslav_Chernov.jpg/300px-Baghdad_by_Mstyslav_Chernov.jpg", difficulty: "medium" },
      { nameAr: "دمشق", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Damascus_Umayyad_Mosque.jpg/300px-Damascus_Umayyad_Mosque.jpg", difficulty: "medium" },
      { nameAr: "الكويت", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Kuwait_Towers01.jpg/300px-Kuwait_Towers01.jpg", difficulty: "easy" },
      { nameAr: "إسطنبول", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Istanbul_2015.jpg/300px-Istanbul_2015.jpg", difficulty: "medium" },
      { nameAr: "القدس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Dome_of_the_rock_jerusalem_1.jpg/300px-Dome_of_the_rock_jerusalem_1.jpg", difficulty: "medium" },
      { nameAr: "الدوحة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Qatar_Skyline.jpg/300px-Qatar_Skyline.jpg", difficulty: "medium" },
      { nameAr: "أبوظبي", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Abu_dhabi_edit.jpg/300px-Abu_dhabi_edit.jpg", difficulty: "medium" },
      { nameAr: "بيروت", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Beirut_night.jpg/300px-Beirut_night.jpg", difficulty: "medium" },
      { nameAr: "جدة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Jeddah_from_above.jpg/300px-Jeddah_from_above.jpg", difficulty: "easy" },
      { nameAr: "الرباط", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Mausolee_Mohammed_V.jpg/300px-Mausolee_Mohammed_V.jpg", difficulty: "hard" },
      { nameAr: "تونس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Tunis_medina_3.jpg/300px-Tunis_medina_3.jpg", difficulty: "hard" },
    ],
  },
  {
    nameAr: "معالم العالم",
    icon: "🏛️",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/300px-Tour_Eiffel_Wikimedia_Commons.jpg",
    sortOrder: 5,
    items: [
      { nameAr: "برج إيفل", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/300px-Tour_Eiffel_Wikimedia_Commons.jpg", difficulty: "easy" },
      { nameAr: "أهرامات الجيزة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kheops-Pyramid.jpg/300px-Kheops-Pyramid.jpg", difficulty: "easy" },
      { nameAr: "برج خليفة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Burj_Khalifa.jpg/300px-Burj_Khalifa.jpg", difficulty: "easy" },
      { nameAr: "تاج محل", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/300px-Taj_Mahal_%28Edited%29.jpeg", difficulty: "medium" },
      { nameAr: "برج بيزا", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Leaning_tower_of_pisa.jpg/300px-Leaning_tower_of_pisa.jpg", difficulty: "medium" },
      { nameAr: "سور الصين العظيم", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/The_Great_Wall_of_China_at_Jinshanling-edit.jpg/300px-The_Great_Wall_of_China_at_Jinshanling-edit.jpg", difficulty: "medium" },
      { nameAr: "قبة الصخرة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Dome_of_the_rock_jerusalem_1.jpg/300px-Dome_of_the_rock_jerusalem_1.jpg", difficulty: "medium" },
      { nameAr: "الكولوسيوم", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseum_in_Rome%2C_Italy_-_April_2007.jpg/300px-Colosseum_in_Rome%2C_Italy_-_April_2007.jpg", difficulty: "medium" },
      { nameAr: "تمثال الحرية", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Statue_of_Liberty_7.jpg/300px-Statue_of_Liberty_7.jpg", difficulty: "easy" },
      { nameAr: "الأكروبوليس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/The_Parthenon_in_Athens.jpg/300px-The_Parthenon_in_Athens.jpg", difficulty: "hard" },
      { nameAr: "أبوسمبل", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Abu_Simbel%2C_Ramesses_II%2C_front.jpg/300px-Abu_Simbel%2C_Ramesses_II%2C_front.jpg", difficulty: "hard" },
      { nameAr: "قصر الحمراء", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Patio_de_los_Leones_003.jpg/300px-Patio_de_los_Leones_003.jpg", difficulty: "hard" },
    ],
  },
  {
    nameAr: "الأعلام",
    icon: "🏴",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Flag_of_Saudi_Arabia.svg/300px-Flag_of_Saudi_Arabia.svg.png",
    sortOrder: 6,
    items: [
      { nameAr: "علم السعودية", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Flag_of_Saudi_Arabia.svg/300px-Flag_of_Saudi_Arabia.svg.png", difficulty: "easy" },
      { nameAr: "علم الكويت", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Flag_of_Kuwait.svg/300px-Flag_of_Kuwait.svg.png", difficulty: "easy" },
      { nameAr: "علم مصر", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Flag_of_Egypt.svg/300px-Flag_of_Egypt.svg.png", difficulty: "easy" },
      { nameAr: "علم الإمارات", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Flag_of_the_United_Arab_Emirates.svg/300px-Flag_of_the_United_Arab_Emirates.svg.png", difficulty: "easy" },
      { nameAr: "علم قطر", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Flag_of_Qatar.svg/300px-Flag_of_Qatar.svg.png", difficulty: "easy" },
      { nameAr: "علم البحرين", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Flag_of_Bahrain.svg/300px-Flag_of_Bahrain.svg.png", difficulty: "medium" },
      { nameAr: "علم الأردن", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Flag_of_Jordan.svg/300px-Flag_of_Jordan.svg.png", difficulty: "medium" },
      { nameAr: "علم تركيا", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Flag_of_Turkey.svg/300px-Flag_of_Turkey.svg.png", difficulty: "easy" },
      { nameAr: "علم المغرب", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Flag_of_Morocco.svg/300px-Flag_of_Morocco.svg.png", difficulty: "medium" },
      { nameAr: "علم فلسطين", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Flag_of_Palestine.svg/300px-Flag_of_Palestine.svg.png", difficulty: "easy" },
      { nameAr: "علم اليابان", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Flag_of_Japan.svg/300px-Flag_of_Japan.svg.png", difficulty: "easy" },
      { nameAr: "علم البرازيل", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Flag_of_Brazil.svg/300px-Flag_of_Brazil.svg.png", difficulty: "medium" },
    ],
  },
  {
    nameAr: "الرياضة",
    icon: "⚽",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Swimming_Torinoaug09.jpg/300px-Swimming_Torinoaug09.jpg",
    sortOrder: 7,
    items: [
      { nameAr: "كرة القدم", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Football_in_Bloomington%2C_Indiana%2C_1996.jpg/300px-Football_in_Bloomington%2C_Indiana%2C_1996.jpg", difficulty: "easy" },
      { nameAr: "كرة السلة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Basketball.png/300px-Basketball.png", difficulty: "easy" },
      { nameAr: "السباحة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Swimming_Torinoaug09.jpg/300px-Swimming_Torinoaug09.jpg", difficulty: "easy" },
      { nameAr: "الملاكمة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Boxing_match.jpg/300px-Boxing_match.jpg", difficulty: "easy" },
      { nameAr: "التنس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/2019-French-Open-Day-1-Womens-Singles-First-Round-Maria_Sharapova_vs_Rebecca_Peterson.jpg/300px-2019-French-Open-Day-1-Womens-Singles-First-Round-Maria_Sharapova_vs_Rebecca_Peterson.jpg", difficulty: "easy" },
      { nameAr: "كرة الطائرة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Volleyball_Vak_Lechi-Spartak_Volley_2013_04.jpg/300px-Volleyball_Vak_Lechi-Spartak_Volley_2013_04.jpg", difficulty: "medium" },
      { nameAr: "الجودو", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Judo_uchi_mata.jpg/300px-Judo_uchi_mata.jpg", difficulty: "medium" },
      { nameAr: "الجمناستيك", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Alexandra_Raisman_2012_Olympics_floor_exercise.jpg/300px-Alexandra_Raisman_2012_Olympics_floor_exercise.jpg", difficulty: "medium" },
      { nameAr: "الغوص", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Scuba_diving.jpg/300px-Scuba_diving.jpg", difficulty: "medium" },
      { nameAr: "ركوب الخيل", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Competitive_horseback_riding.jpg/300px-Competitive_horseback_riding.jpg", difficulty: "hard" },
    ],
  },
  {
    nameAr: "الفواكه",
    icon: "🍎",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Red_Apple.jpg/300px-Red_Apple.jpg",
    sortOrder: 8,
    items: [
      { nameAr: "تفاحة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Red_Apple.jpg/300px-Red_Apple.jpg", difficulty: "easy" },
      { nameAr: "موز", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Banana-Fruit.jpg/300px-Banana-Fruit.jpg", difficulty: "easy" },
      { nameAr: "رمان", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Hapus_Mango.jpg/300px-Hapus_Mango.jpg", difficulty: "easy" },
      { nameAr: "بطيخ", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png", difficulty: "easy" },
      { nameAr: "عنب", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Table_grapes_on_white.jpg/300px-Table_grapes_on_white.jpg", difficulty: "easy" },
      { nameAr: "مانجو", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Hapus_Mango.jpg/300px-Hapus_Mango.jpg", difficulty: "easy" },
      { nameAr: "أناناس", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Pineapple_and_cross_section.jpg/300px-Pineapple_and_cross_section.jpg", difficulty: "easy" },
      { nameAr: "كيوي", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Kiwi_Fruit.jpg/300px-Kiwi_Fruit.jpg", difficulty: "medium" },
      { nameAr: "جوافة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Guava_ID.jpg/300px-Guava_ID.jpg", difficulty: "medium" },
      { nameAr: "توت", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Satsuma_Orange.jpg/300px-Satsuma_Orange.jpg", difficulty: "medium" },
      { nameAr: "برتقال", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Fresh_made_orange_juice.jpg/300px-Fresh_made_orange_juice.jpg", difficulty: "easy" },
      { nameAr: "ليمون", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Lemons.jpg/300px-Lemons.jpg", difficulty: "easy" },
      { nameAr: "تمر", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Dattelpalme.jpg/300px-Dattelpalme.jpg", difficulty: "easy" },
      { nameAr: "بابايا", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Papaya_cross_section_BNC.jpg/300px-Papaya_cross_section_BNC.jpg", difficulty: "hard" },
      { nameAr: "خوخ", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Peach_and_cross_section.jpg/300px-Peach_and_cross_section.jpg", difficulty: "medium" },
    ],
  },
  {
    nameAr: "المركبات",
    icon: "🚗",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Container_ship_Cosco_Shipping_Pisces.jpg/300px-Container_ship_Cosco_Shipping_Pisces.jpg",
    sortOrder: 9,
    items: [
      { nameAr: "سيارة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/2006_BMW_M5_%28E60%29%2C_front_8.26.19.jpg/300px-2006_BMW_M5_%28E60%29%2C_front_8.26.19.jpg", difficulty: "easy" },
      { nameAr: "طائرة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Boeing_737_clip_art.svg/300px-Boeing_737_clip_art.svg.png", difficulty: "easy" },
      { nameAr: "قطار", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Train_No_832_Arriving_at_Gua_Musang_Station.jpg/300px-Train_No_832_Arriving_at_Gua_Musang_Station.jpg", difficulty: "easy" },
      { nameAr: "غواصة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/US_Navy_070614-N-8907D-001_The_Los_Angeles-class_fast_attack_submarine_USS_Columbus_%28SSN_762%29_approaches_the_pier_at_Naval_Station_Pearl_Harbor.jpg/300px-US_Navy_070614.jpg", difficulty: "medium" },
      { nameAr: "دراجة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Single_speed_bicycle.jpg/300px-Single_speed_bicycle.jpg", difficulty: "easy" },
      { nameAr: "سفينة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Container_ship_Cosco_Shipping_Pisces.jpg/300px-Container_ship_Cosco_Shipping_Pisces.jpg", difficulty: "medium" },
      { nameAr: "مروحية", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/CH-46E_refueling.jpg/300px-CH-46E_refueling.jpg", difficulty: "medium" },
      { nameAr: "دراجة نارية", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Motorcycle.jpg/300px-Motorcycle.jpg", difficulty: "easy" },
      { nameAr: "جرار", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/JD_tractor.jpg/300px-JD_tractor.jpg", difficulty: "medium" },
      { nameAr: "رافعة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Crane_at_construction_site.jpg/300px-Crane_at_construction_site.jpg", difficulty: "medium" },
    ],
  },
  {
    nameAr: "شخصيات تاريخية",
    icon: "👑",
    coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Avicenna-miniature.jpg/300px-Avicenna-miniature.jpg",
    sortOrder: 10,
    items: [
      { nameAr: "صلاح الدين", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Saladin_and_Guy.jpg/300px-Saladin_and_Guy.jpg", difficulty: "medium" },
      { nameAr: "خالد بن الوليد", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Islamic_Cavalry.jpg/300px-Islamic_Cavalry.jpg", difficulty: "medium" },
      { nameAr: "ابن بطوطة", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/IbnBatuta.jpg/300px-IbnBatuta.jpg", difficulty: "medium" },
      { nameAr: "ابن سينا", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Avicenna-miniature.jpg/300px-Avicenna-miniature.jpg", difficulty: "hard" },
      { nameAr: "الخوارزمي", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Khwarizmi_Amirkabir_University_of_Technology.png/300px-Khwarizmi_Amirkabir_University_of_Technology.png", difficulty: "hard" },
      { nameAr: "ابن خلدون", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Ibn_Khaldun.jpg/300px-Ibn_Khaldun.jpg", difficulty: "hard" },
      { nameAr: "نابليون", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg/300px.jpg", difficulty: "medium" },
      { nameAr: "الإسكندر الأكبر", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/AlexanderTheGreat_Bust.jpg/300px-AlexanderTheGreat_Bust.jpg", difficulty: "medium" },
      { nameAr: "ماركوني بولو", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Marco_Polo_miniature.jpg/300px-Marco_Polo_miniature.jpg", difficulty: "hard" },
      { nameAr: "عمر بن الخطاب", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/OmarMosque.jpg/300px-OmarMosque.jpg", difficulty: "medium" },
    ],
  },
];

export async function seedSecretGameIfNeeded(): Promise<void> {
  try {
    const existing = await db.execute(sql`
      SELECT key FROM seed_completions WHERE key = ${SEED_KEY}
    `);
    const rows = (existing as any).rows ?? existing;
    if (Array.isArray(rows) && rows.length > 0) {
      logger.info("Secret game seed already done, skipping");
      return;
    }

    logger.info("Seeding secret game data...");

    for (const cat of CATEGORIES_DATA) {
      const [inserted] = await db
        .insert(secretGameCategoriesTable)
        .values({ nameAr: cat.nameAr, icon: cat.icon, coverImageUrl: cat.coverImageUrl, sortOrder: cat.sortOrder })
        .returning();

      if (inserted) {
        await db.insert(secretGameItemsTable).values(
          cat.items.map((item) => ({
            categoryId: inserted.id,
            nameAr: item.nameAr,
            imageUrl: item.imageUrl,
            difficulty: item.difficulty,
          })),
        );
        logger.info({ category: cat.nameAr, items: cat.items.length }, "Secret game category seeded");
      }
    }

    await db.execute(sql`
      INSERT INTO seed_completions (key) VALUES (${SEED_KEY})
      ON CONFLICT (key) DO NOTHING
    `);
    logger.info("Secret game seed complete");
  } catch (err) {
    logger.error(err, "Secret game seed failed");
  }
}
