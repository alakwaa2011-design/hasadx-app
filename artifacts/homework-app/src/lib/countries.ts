/* Shared country/phone-prefix data used by auth and settings pages. */

export interface Country {
  iso: string;
  code: string;
  flag: string;
  name: string;
  nameEn: string;
  digits: number;
  group: "gulf" | "arab" | "world";
}

export const COUNTRIES: Country[] = [
  // Gulf
  { iso: "KW", code: "+965", flag: "🇰🇼", name: "الكويت",            nameEn: "Kuwait",           digits: 8,  group: "gulf" },
  { iso: "SA", code: "+966", flag: "🇸🇦", name: "السعودية",          nameEn: "Saudi Arabia",     digits: 9,  group: "gulf" },
  { iso: "AE", code: "+971", flag: "🇦🇪", name: "الإمارات",          nameEn: "UAE",              digits: 9,  group: "gulf" },
  { iso: "QA", code: "+974", flag: "🇶🇦", name: "قطر",               nameEn: "Qatar",            digits: 8,  group: "gulf" },
  { iso: "BH", code: "+973", flag: "🇧🇭", name: "البحرين",           nameEn: "Bahrain",          digits: 8,  group: "gulf" },
  { iso: "OM", code: "+968", flag: "🇴🇲", name: "عُمان",             nameEn: "Oman",             digits: 8,  group: "gulf" },
  // Arab
  { iso: "YE", code: "+967", flag: "🇾🇪", name: "اليمن",             nameEn: "Yemen",            digits: 9,  group: "arab" },
  { iso: "JO", code: "+962", flag: "🇯🇴", name: "الأردن",            nameEn: "Jordan",           digits: 9,  group: "arab" },
  { iso: "LB", code: "+961", flag: "🇱🇧", name: "لبنان",             nameEn: "Lebanon",          digits: 8,  group: "arab" },
  { iso: "SY", code: "+963", flag: "🇸🇾", name: "سوريا",             nameEn: "Syria",            digits: 9,  group: "arab" },
  { iso: "IQ", code: "+964", flag: "🇮🇶", name: "العراق",            nameEn: "Iraq",             digits: 10, group: "arab" },
  { iso: "EG", code: "+20",  flag: "🇪🇬", name: "مصر",               nameEn: "Egypt",            digits: 10, group: "arab" },
  { iso: "LY", code: "+218", flag: "🇱🇾", name: "ليبيا",             nameEn: "Libya",            digits: 9,  group: "arab" },
  { iso: "TN", code: "+216", flag: "🇹🇳", name: "تونس",              nameEn: "Tunisia",          digits: 8,  group: "arab" },
  { iso: "DZ", code: "+213", flag: "🇩🇿", name: "الجزائر",           nameEn: "Algeria",          digits: 9,  group: "arab" },
  { iso: "MA", code: "+212", flag: "🇲🇦", name: "المغرب",            nameEn: "Morocco",          digits: 9,  group: "arab" },
  { iso: "SD", code: "+249", flag: "🇸🇩", name: "السودان",           nameEn: "Sudan",            digits: 9,  group: "arab" },
  { iso: "PS", code: "+970", flag: "🇵🇸", name: "فلسطين",            nameEn: "Palestine",        digits: 9,  group: "arab" },
  { iso: "SO", code: "+252", flag: "🇸🇴", name: "الصومال",           nameEn: "Somalia",          digits: 8,  group: "arab" },
  { iso: "MR", code: "+222", flag: "🇲🇷", name: "موريتانيا",         nameEn: "Mauritania",       digits: 8,  group: "arab" },
  { iso: "DJ", code: "+253", flag: "🇩🇯", name: "جيبوتي",            nameEn: "Djibouti",         digits: 8,  group: "arab" },
  { iso: "KM", code: "+269", flag: "🇰🇲", name: "جزر القمر",         nameEn: "Comoros",          digits: 7,  group: "arab" },
  // World — Americas
  { iso: "US", code: "+1",   flag: "🇺🇸", name: "الولايات المتحدة",  nameEn: "USA",              digits: 10, group: "world" },
  { iso: "CA", code: "+1",   flag: "🇨🇦", name: "كندا",              nameEn: "Canada",           digits: 10, group: "world" },
  { iso: "MX", code: "+52",  flag: "🇲🇽", name: "المكسيك",           nameEn: "Mexico",           digits: 10, group: "world" },
  { iso: "BR", code: "+55",  flag: "🇧🇷", name: "البرازيل",          nameEn: "Brazil",           digits: 11, group: "world" },
  { iso: "AR", code: "+54",  flag: "🇦🇷", name: "الأرجنتين",         nameEn: "Argentina",        digits: 10, group: "world" },
  { iso: "CO", code: "+57",  flag: "🇨🇴", name: "كولومبيا",          nameEn: "Colombia",         digits: 10, group: "world" },
  { iso: "CL", code: "+56",  flag: "🇨🇱", name: "تشيلي",             nameEn: "Chile",            digits: 9,  group: "world" },
  { iso: "PE", code: "+51",  flag: "🇵🇪", name: "بيرو",              nameEn: "Peru",             digits: 9,  group: "world" },
  { iso: "VE", code: "+58",  flag: "🇻🇪", name: "فنزويلا",           nameEn: "Venezuela",        digits: 10, group: "world" },
  { iso: "EC", code: "+593", flag: "🇪🇨", name: "الإكوادور",         nameEn: "Ecuador",          digits: 9,  group: "world" },
  { iso: "GT", code: "+502", flag: "🇬🇹", name: "غواتيمالا",         nameEn: "Guatemala",        digits: 8,  group: "world" },
  { iso: "SV", code: "+503", flag: "🇸🇻", name: "السلفادور",         nameEn: "El Salvador",      digits: 8,  group: "world" },
  // World — Europe
  { iso: "GB", code: "+44",  flag: "🇬🇧", name: "المملكة المتحدة",   nameEn: "UK",               digits: 10, group: "world" },
  { iso: "FR", code: "+33",  flag: "🇫🇷", name: "فرنسا",             nameEn: "France",           digits: 9,  group: "world" },
  { iso: "DE", code: "+49",  flag: "🇩🇪", name: "ألمانيا",           nameEn: "Germany",          digits: 10, group: "world" },
  { iso: "IT", code: "+39",  flag: "🇮🇹", name: "إيطاليا",           nameEn: "Italy",            digits: 10, group: "world" },
  { iso: "ES", code: "+34",  flag: "🇪🇸", name: "إسبانيا",           nameEn: "Spain",            digits: 9,  group: "world" },
  { iso: "PT", code: "+351", flag: "🇵🇹", name: "البرتغال",          nameEn: "Portugal",         digits: 9,  group: "world" },
  { iso: "NL", code: "+31",  flag: "🇳🇱", name: "هولندا",            nameEn: "Netherlands",      digits: 9,  group: "world" },
  { iso: "BE", code: "+32",  flag: "🇧🇪", name: "بلجيكا",            nameEn: "Belgium",          digits: 9,  group: "world" },
  { iso: "CH", code: "+41",  flag: "🇨🇭", name: "سويسرا",            nameEn: "Switzerland",      digits: 9,  group: "world" },
  { iso: "AT", code: "+43",  flag: "🇦🇹", name: "النمسا",            nameEn: "Austria",          digits: 10, group: "world" },
  { iso: "SE", code: "+46",  flag: "🇸🇪", name: "السويد",            nameEn: "Sweden",           digits: 9,  group: "world" },
  { iso: "NO", code: "+47",  flag: "🇳🇴", name: "النرويج",           nameEn: "Norway",           digits: 8,  group: "world" },
  { iso: "DK", code: "+45",  flag: "🇩🇰", name: "الدنمارك",          nameEn: "Denmark",          digits: 8,  group: "world" },
  { iso: "FI", code: "+358", flag: "🇫🇮", name: "فنلندا",            nameEn: "Finland",          digits: 9,  group: "world" },
  { iso: "PL", code: "+48",  flag: "🇵🇱", name: "بولندا",            nameEn: "Poland",           digits: 9,  group: "world" },
  { iso: "CZ", code: "+420", flag: "🇨🇿", name: "التشيك",            nameEn: "Czech Republic",   digits: 9,  group: "world" },
  { iso: "HU", code: "+36",  flag: "🇭🇺", name: "المجر",             nameEn: "Hungary",          digits: 9,  group: "world" },
  { iso: "RO", code: "+40",  flag: "🇷🇴", name: "رومانيا",           nameEn: "Romania",          digits: 9,  group: "world" },
  { iso: "UA", code: "+380", flag: "🇺🇦", name: "أوكرانيا",          nameEn: "Ukraine",          digits: 9,  group: "world" },
  { iso: "GR", code: "+30",  flag: "🇬🇷", name: "اليونان",           nameEn: "Greece",           digits: 10, group: "world" },
  { iso: "RU", code: "+7",   flag: "🇷🇺", name: "روسيا",             nameEn: "Russia",           digits: 10, group: "world" },
  // World — Asia
  { iso: "TR", code: "+90",  flag: "🇹🇷", name: "تركيا",             nameEn: "Turkey",           digits: 10, group: "world" },
  { iso: "IR", code: "+98",  flag: "🇮🇷", name: "إيران",             nameEn: "Iran",             digits: 10, group: "world" },
  { iso: "AF", code: "+93",  flag: "🇦🇫", name: "أفغانستان",         nameEn: "Afghanistan",      digits: 9,  group: "world" },
  { iso: "IN", code: "+91",  flag: "🇮🇳", name: "الهند",             nameEn: "India",            digits: 10, group: "world" },
  { iso: "PK", code: "+92",  flag: "🇵🇰", name: "باكستان",           nameEn: "Pakistan",         digits: 10, group: "world" },
  { iso: "BD", code: "+880", flag: "🇧🇩", name: "بنغلاديش",          nameEn: "Bangladesh",       digits: 10, group: "world" },
  { iso: "LK", code: "+94",  flag: "🇱🇰", name: "سريلانكا",          nameEn: "Sri Lanka",        digits: 9,  group: "world" },
  { iso: "NP", code: "+977", flag: "🇳🇵", name: "نيبال",             nameEn: "Nepal",            digits: 10, group: "world" },
  { iso: "CN", code: "+86",  flag: "🇨🇳", name: "الصين",             nameEn: "China",            digits: 11, group: "world" },
  { iso: "JP", code: "+81",  flag: "🇯🇵", name: "اليابان",           nameEn: "Japan",            digits: 10, group: "world" },
  { iso: "KR", code: "+82",  flag: "🇰🇷", name: "كوريا الجنوبية",    nameEn: "South Korea",      digits: 10, group: "world" },
  { iso: "HK", code: "+852", flag: "🇭🇰", name: "هونغ كونغ",         nameEn: "Hong Kong",        digits: 8,  group: "world" },
  { iso: "SG", code: "+65",  flag: "🇸🇬", name: "سنغافورة",          nameEn: "Singapore",        digits: 8,  group: "world" },
  { iso: "MY", code: "+60",  flag: "🇲🇾", name: "ماليزيا",           nameEn: "Malaysia",         digits: 9,  group: "world" },
  { iso: "TH", code: "+66",  flag: "🇹🇭", name: "تايلاند",           nameEn: "Thailand",         digits: 9,  group: "world" },
  { iso: "VN", code: "+84",  flag: "🇻🇳", name: "فيتنام",            nameEn: "Vietnam",          digits: 9,  group: "world" },
  { iso: "PH", code: "+63",  flag: "🇵🇭", name: "الفلبين",           nameEn: "Philippines",      digits: 10, group: "world" },
  { iso: "ID", code: "+62",  flag: "🇮🇩", name: "إندونيسيا",         nameEn: "Indonesia",        digits: 10, group: "world" },
  { iso: "MM", code: "+95",  flag: "🇲🇲", name: "ميانمار",           nameEn: "Myanmar",          digits: 9,  group: "world" },
  { iso: "KH", code: "+855", flag: "🇰🇭", name: "كمبوديا",           nameEn: "Cambodia",         digits: 9,  group: "world" },
  { iso: "LA", code: "+856", flag: "🇱🇦", name: "لاوس",              nameEn: "Laos",             digits: 8,  group: "world" },
  { iso: "MN", code: "+976", flag: "🇲🇳", name: "منغوليا",           nameEn: "Mongolia",         digits: 8,  group: "world" },
  // World — Oceania
  { iso: "AU", code: "+61",  flag: "🇦🇺", name: "أستراليا",          nameEn: "Australia",        digits: 9,  group: "world" },
  { iso: "NZ", code: "+64",  flag: "🇳🇿", name: "نيوزيلندا",         nameEn: "New Zealand",      digits: 9,  group: "world" },
  { iso: "FJ", code: "+679", flag: "🇫🇯", name: "فيجي",              nameEn: "Fiji",             digits: 7,  group: "world" },
  // World — Africa
  { iso: "NG", code: "+234", flag: "🇳🇬", name: "نيجيريا",           nameEn: "Nigeria",          digits: 10, group: "world" },
  { iso: "KE", code: "+254", flag: "🇰🇪", name: "كينيا",             nameEn: "Kenya",            digits: 9,  group: "world" },
  { iso: "ZA", code: "+27",  flag: "🇿🇦", name: "جنوب أفريقيا",      nameEn: "South Africa",     digits: 9,  group: "world" },
  { iso: "ET", code: "+251", flag: "🇪🇹", name: "إثيوبيا",           nameEn: "Ethiopia",         digits: 9,  group: "world" },
  { iso: "TZ", code: "+255", flag: "🇹🇿", name: "تنزانيا",           nameEn: "Tanzania",         digits: 9,  group: "world" },
  { iso: "UG", code: "+256", flag: "🇺🇬", name: "أوغندا",            nameEn: "Uganda",           digits: 9,  group: "world" },
  { iso: "GH", code: "+233", flag: "🇬🇭", name: "غانا",              nameEn: "Ghana",            digits: 9,  group: "world" },
  { iso: "CM", code: "+237", flag: "🇨🇲", name: "الكاميرون",         nameEn: "Cameroon",         digits: 9,  group: "world" },
  { iso: "CI", code: "+225", flag: "🇨🇮", name: "ساحل العاج",        nameEn: "Ivory Coast",      digits: 10, group: "world" },
  { iso: "SN", code: "+221", flag: "🇸🇳", name: "السنغال",           nameEn: "Senegal",          digits: 9,  group: "world" },
  { iso: "CD", code: "+243", flag: "🇨🇩", name: "الكونغو الديمقراطية", nameEn: "DR Congo",       digits: 9,  group: "world" },
  { iso: "MZ", code: "+258", flag: "🇲🇿", name: "موزمبيق",           nameEn: "Mozambique",       digits: 9,  group: "world" },
  { iso: "ZM", code: "+260", flag: "🇿🇲", name: "زامبيا",            nameEn: "Zambia",           digits: 9,  group: "world" },
  { iso: "ZW", code: "+263", flag: "🇿🇼", name: "زيمبابوي",          nameEn: "Zimbabwe",         digits: 9,  group: "world" },
];

/** Kuwait is the default country (index 0). */
export const KUWAIT: Country = COUNTRIES[0];

/**
 * Parse a stored phone string ("+96512345678" or legacy "12345678") into
 * a country object and the local digits. Falls back to Kuwait if no match.
 */
export function parseStoredPhone(stored: string): { country: Country; digits: string } {
  if (!stored) return { country: KUWAIT, digits: "" };
  // Legacy 8-digit Kuwait number (no country code prefix)
  if (/^\d{7,15}$/.test(stored)) return { country: KUWAIT, digits: stored };
  // Match by code — try longest codes first to avoid "+1" matching "+123"
  const sorted = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (stored.startsWith(c.code)) {
      return { country: c, digits: stored.slice(c.code.length) };
    }
  }
  return { country: KUWAIT, digits: stored };
}
