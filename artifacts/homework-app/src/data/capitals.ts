export interface CapitalCountry {
  code: string;
  nameAr: string;
  nameEn: string;
  capitalAr: string;
  capitalEn: string;
  tier: 1 | 2 | 3 | 4;
}

export const capitalCountries: CapitalCountry[] = [
  { code: "SA", nameAr: "السعودية", nameEn: "Saudi Arabia", capitalAr: "الرياض", capitalEn: "Riyadh", tier: 1 },
  { code: "AE", nameAr: "الإمارات", nameEn: "UAE", capitalAr: "أبوظبي", capitalEn: "Abu Dhabi", tier: 1 },
  { code: "EG", nameAr: "مصر", nameEn: "Egypt", capitalAr: "القاهرة", capitalEn: "Cairo", tier: 1 },
  { code: "US", nameAr: "الولايات المتحدة", nameEn: "United States", capitalAr: "واشنطن", capitalEn: "Washington D.C.", tier: 1 },
  { code: "GB", nameAr: "بريطانيا", nameEn: "United Kingdom", capitalAr: "لندن", capitalEn: "London", tier: 1 },
  { code: "FR", nameAr: "فرنسا", nameEn: "France", capitalAr: "باريس", capitalEn: "Paris", tier: 1 },
  { code: "DE", nameAr: "ألمانيا", nameEn: "Germany", capitalAr: "برلين", capitalEn: "Berlin", tier: 1 },
  { code: "JP", nameAr: "اليابان", nameEn: "Japan", capitalAr: "طوكيو", capitalEn: "Tokyo", tier: 1 },
  { code: "CN", nameAr: "الصين", nameEn: "China", capitalAr: "بكين", capitalEn: "Beijing", tier: 1 },
  { code: "BR", nameAr: "البرازيل", nameEn: "Brazil", capitalAr: "برازيليا", capitalEn: "Brasília", tier: 1 },
  { code: "TR", nameAr: "تركيا", nameEn: "Turkey", capitalAr: "أنقرة", capitalEn: "Ankara", tier: 1 },
  { code: "IN", nameAr: "الهند", nameEn: "India", capitalAr: "نيودلهي", capitalEn: "New Delhi", tier: 1 },
  { code: "IT", nameAr: "إيطاليا", nameEn: "Italy", capitalAr: "روما", capitalEn: "Rome", tier: 1 },
  { code: "ES", nameAr: "إسبانيا", nameEn: "Spain", capitalAr: "مدريد", capitalEn: "Madrid", tier: 1 },
  { code: "KW", nameAr: "الكويت", nameEn: "Kuwait", capitalAr: "الكويت", capitalEn: "Kuwait City", tier: 1 },
  { code: "QA", nameAr: "قطر", nameEn: "Qatar", capitalAr: "الدوحة", capitalEn: "Doha", tier: 1 },
  { code: "JO", nameAr: "الأردن", nameEn: "Jordan", capitalAr: "عمّان", capitalEn: "Amman", tier: 1 },
  { code: "MA", nameAr: "المغرب", nameEn: "Morocco", capitalAr: "الرباط", capitalEn: "Rabat", tier: 1 },
  { code: "RU", nameAr: "روسيا", nameEn: "Russia", capitalAr: "موسكو", capitalEn: "Moscow", tier: 1 },
  { code: "KR", nameAr: "كوريا الجنوبية", nameEn: "South Korea", capitalAr: "سيول", capitalEn: "Seoul", tier: 1 },

  { code: "IQ", nameAr: "العراق", nameEn: "Iraq", capitalAr: "بغداد", capitalEn: "Baghdad", tier: 2 },
  { code: "SY", nameAr: "سوريا", nameEn: "Syria", capitalAr: "دمشق", capitalEn: "Damascus", tier: 2 },
  { code: "LB", nameAr: "لبنان", nameEn: "Lebanon", capitalAr: "بيروت", capitalEn: "Beirut", tier: 2 },
  { code: "PS", nameAr: "فلسطين", nameEn: "Palestine", capitalAr: "القدس", capitalEn: "Jerusalem", tier: 2 },
  { code: "OM", nameAr: "عُمان", nameEn: "Oman", capitalAr: "مسقط", capitalEn: "Muscat", tier: 2 },
  { code: "BH", nameAr: "البحرين", nameEn: "Bahrain", capitalAr: "المنامة", capitalEn: "Manama", tier: 2 },
  { code: "YE", nameAr: "اليمن", nameEn: "Yemen", capitalAr: "صنعاء", capitalEn: "Sanaa", tier: 2 },
  { code: "SD", nameAr: "السودان", nameEn: "Sudan", capitalAr: "الخرطوم", capitalEn: "Khartoum", tier: 2 },
  { code: "LY", nameAr: "ليبيا", nameEn: "Libya", capitalAr: "طرابلس", capitalEn: "Tripoli", tier: 2 },
  { code: "TN", nameAr: "تونس", nameEn: "Tunisia", capitalAr: "تونس", capitalEn: "Tunis", tier: 2 },
  { code: "DZ", nameAr: "الجزائر", nameEn: "Algeria", capitalAr: "الجزائر", capitalEn: "Algiers", tier: 2 },
  { code: "AU", nameAr: "أستراليا", nameEn: "Australia", capitalAr: "كانبرا", capitalEn: "Canberra", tier: 2 },
  { code: "CA", nameAr: "كندا", nameEn: "Canada", capitalAr: "أوتاوا", capitalEn: "Ottawa", tier: 2 },
  { code: "MX", nameAr: "المكسيك", nameEn: "Mexico", capitalAr: "مكسيكو سيتي", capitalEn: "Mexico City", tier: 2 },
  { code: "AR", nameAr: "الأرجنتين", nameEn: "Argentina", capitalAr: "بوينس آيرس", capitalEn: "Buenos Aires", tier: 2 },
  { code: "ZA", nameAr: "جنوب أفريقيا", nameEn: "South Africa", capitalAr: "بريتوريا", capitalEn: "Pretoria", tier: 2 },
  { code: "NG", nameAr: "نيجيريا", nameEn: "Nigeria", capitalAr: "أبوجا", capitalEn: "Abuja", tier: 2 },
  { code: "PK", nameAr: "باكستان", nameEn: "Pakistan", capitalAr: "إسلام آباد", capitalEn: "Islamabad", tier: 2 },
  { code: "ID", nameAr: "إندونيسيا", nameEn: "Indonesia", capitalAr: "جاكرتا", capitalEn: "Jakarta", tier: 2 },
  { code: "TH", nameAr: "تايلاند", nameEn: "Thailand", capitalAr: "بانكوك", capitalEn: "Bangkok", tier: 2 },
  { code: "MY", nameAr: "ماليزيا", nameEn: "Malaysia", capitalAr: "كوالالمبور", capitalEn: "Kuala Lumpur", tier: 2 },
  { code: "PH", nameAr: "الفلبين", nameEn: "Philippines", capitalAr: "مانيلا", capitalEn: "Manila", tier: 2 },
  { code: "NL", nameAr: "هولندا", nameEn: "Netherlands", capitalAr: "أمستردام", capitalEn: "Amsterdam", tier: 2 },
  { code: "BE", nameAr: "بلجيكا", nameEn: "Belgium", capitalAr: "بروكسل", capitalEn: "Brussels", tier: 2 },
  { code: "SE", nameAr: "السويد", nameEn: "Sweden", capitalAr: "ستوكهولم", capitalEn: "Stockholm", tier: 2 },
  { code: "NO", nameAr: "النرويج", nameEn: "Norway", capitalAr: "أوسلو", capitalEn: "Oslo", tier: 2 },
  { code: "CH", nameAr: "سويسرا", nameEn: "Switzerland", capitalAr: "برن", capitalEn: "Bern", tier: 2 },
  { code: "PT", nameAr: "البرتغال", nameEn: "Portugal", capitalAr: "لشبونة", capitalEn: "Lisbon", tier: 2 },
  { code: "PL", nameAr: "بولندا", nameEn: "Poland", capitalAr: "وارسو", capitalEn: "Warsaw", tier: 2 },
  { code: "GR", nameAr: "اليونان", nameEn: "Greece", capitalAr: "أثينا", capitalEn: "Athens", tier: 2 },

  { code: "AT", nameAr: "النمسا", nameEn: "Austria", capitalAr: "فيينا", capitalEn: "Vienna", tier: 3 },
  { code: "DK", nameAr: "الدنمارك", nameEn: "Denmark", capitalAr: "كوبنهاغن", capitalEn: "Copenhagen", tier: 3 },
  { code: "FI", nameAr: "فنلندا", nameEn: "Finland", capitalAr: "هلسنكي", capitalEn: "Helsinki", tier: 3 },
  { code: "IE", nameAr: "أيرلندا", nameEn: "Ireland", capitalAr: "دبلن", capitalEn: "Dublin", tier: 3 },
  { code: "CZ", nameAr: "التشيك", nameEn: "Czech Republic", capitalAr: "براغ", capitalEn: "Prague", tier: 3 },
  { code: "RO", nameAr: "رومانيا", nameEn: "Romania", capitalAr: "بوخارست", capitalEn: "Bucharest", tier: 3 },
  { code: "HU", nameAr: "المجر", nameEn: "Hungary", capitalAr: "بودابست", capitalEn: "Budapest", tier: 3 },
  { code: "UA", nameAr: "أوكرانيا", nameEn: "Ukraine", capitalAr: "كييف", capitalEn: "Kyiv", tier: 3 },
  { code: "CL", nameAr: "تشيلي", nameEn: "Chile", capitalAr: "سانتياغو", capitalEn: "Santiago", tier: 3 },
  { code: "CO", nameAr: "كولومبيا", nameEn: "Colombia", capitalAr: "بوغوتا", capitalEn: "Bogotá", tier: 3 },
  { code: "PE", nameAr: "بيرو", nameEn: "Peru", capitalAr: "ليما", capitalEn: "Lima", tier: 3 },
  { code: "VE", nameAr: "فنزويلا", nameEn: "Venezuela", capitalAr: "كاراكاس", capitalEn: "Caracas", tier: 3 },
  { code: "CU", nameAr: "كوبا", nameEn: "Cuba", capitalAr: "هافانا", capitalEn: "Havana", tier: 3 },
  { code: "NZ", nameAr: "نيوزيلندا", nameEn: "New Zealand", capitalAr: "ولينغتون", capitalEn: "Wellington", tier: 3 },
  { code: "SG", nameAr: "سنغافورة", nameEn: "Singapore", capitalAr: "سنغافورة", capitalEn: "Singapore", tier: 3 },
  { code: "VN", nameAr: "فيتنام", nameEn: "Vietnam", capitalAr: "هانوي", capitalEn: "Hanoi", tier: 3 },
  { code: "KE", nameAr: "كينيا", nameEn: "Kenya", capitalAr: "نيروبي", capitalEn: "Nairobi", tier: 3 },
  { code: "ET", nameAr: "إثيوبيا", nameEn: "Ethiopia", capitalAr: "أديس أبابا", capitalEn: "Addis Ababa", tier: 3 },
  { code: "GH", nameAr: "غانا", nameEn: "Ghana", capitalAr: "أكرا", capitalEn: "Accra", tier: 3 },
  { code: "TZ", nameAr: "تنزانيا", nameEn: "Tanzania", capitalAr: "دودوما", capitalEn: "Dodoma", tier: 3 },
  { code: "HR", nameAr: "كرواتيا", nameEn: "Croatia", capitalAr: "زغرب", capitalEn: "Zagreb", tier: 3 },
  { code: "RS", nameAr: "صربيا", nameEn: "Serbia", capitalAr: "بلغراد", capitalEn: "Belgrade", tier: 3 },
  { code: "BG", nameAr: "بلغاريا", nameEn: "Bulgaria", capitalAr: "صوفيا", capitalEn: "Sofia", tier: 3 },
  { code: "SK", nameAr: "سلوفاكيا", nameEn: "Slovakia", capitalAr: "براتيسلافا", capitalEn: "Bratislava", tier: 3 },
  { code: "IR", nameAr: "إيران", nameEn: "Iran", capitalAr: "طهران", capitalEn: "Tehran", tier: 3 },
  { code: "AF", nameAr: "أفغانستان", nameEn: "Afghanistan", capitalAr: "كابل", capitalEn: "Kabul", tier: 3 },
  { code: "BD", nameAr: "بنغلاديش", nameEn: "Bangladesh", capitalAr: "دكا", capitalEn: "Dhaka", tier: 3 },
  { code: "LK", nameAr: "سريلانكا", nameEn: "Sri Lanka", capitalAr: "كولومبو", capitalEn: "Colombo", tier: 3 },
  { code: "MM", nameAr: "ميانمار", nameEn: "Myanmar", capitalAr: "نايبيداو", capitalEn: "Naypyidaw", tier: 3 },
  { code: "NP", nameAr: "نيبال", nameEn: "Nepal", capitalAr: "كاتماندو", capitalEn: "Kathmandu", tier: 3 },
  { code: "KZ", nameAr: "كازاخستان", nameEn: "Kazakhstan", capitalAr: "أستانا", capitalEn: "Astana", tier: 3 },
  { code: "UZ", nameAr: "أوزبكستان", nameEn: "Uzbekistan", capitalAr: "طشقند", capitalEn: "Tashkent", tier: 3 },
  { code: "SO", nameAr: "الصومال", nameEn: "Somalia", capitalAr: "مقديشو", capitalEn: "Mogadishu", tier: 3 },
  { code: "MR", nameAr: "موريتانيا", nameEn: "Mauritania", capitalAr: "نواكشوط", capitalEn: "Nouakchott", tier: 3 },
  { code: "DJ", nameAr: "جيبوتي", nameEn: "Djibouti", capitalAr: "جيبوتي", capitalEn: "Djibouti", tier: 3 },
  { code: "KM", nameAr: "جزر القمر", nameEn: "Comoros", capitalAr: "موروني", capitalEn: "Moroni", tier: 3 },
  { code: "EC", nameAr: "الإكوادور", nameEn: "Ecuador", capitalAr: "كيتو", capitalEn: "Quito", tier: 3 },
  { code: "DO", nameAr: "جمهورية الدومينيكان", nameEn: "Dominican Republic", capitalAr: "سانتو دومينغو", capitalEn: "Santo Domingo", tier: 3 },
  { code: "PA", nameAr: "بنما", nameEn: "Panama", capitalAr: "بنما سيتي", capitalEn: "Panama City", tier: 3 },
  { code: "CR", nameAr: "كوستاريكا", nameEn: "Costa Rica", capitalAr: "سان خوسيه", capitalEn: "San José", tier: 3 },
  { code: "KP", nameAr: "كوريا الشمالية", nameEn: "North Korea", capitalAr: "بيونغيانغ", capitalEn: "Pyongyang", tier: 3 },

  { code: "SI", nameAr: "سلوفينيا", nameEn: "Slovenia", capitalAr: "ليوبليانا", capitalEn: "Ljubljana", tier: 4 },
  { code: "LT", nameAr: "ليتوانيا", nameEn: "Lithuania", capitalAr: "فيلنيوس", capitalEn: "Vilnius", tier: 4 },
  { code: "LV", nameAr: "لاتفيا", nameEn: "Latvia", capitalAr: "ريغا", capitalEn: "Riga", tier: 4 },
  { code: "EE", nameAr: "إستونيا", nameEn: "Estonia", capitalAr: "تالين", capitalEn: "Tallinn", tier: 4 },
  { code: "IS", nameAr: "آيسلندا", nameEn: "Iceland", capitalAr: "ريكيافيك", capitalEn: "Reykjavik", tier: 4 },
  { code: "AL", nameAr: "ألبانيا", nameEn: "Albania", capitalAr: "تيرانا", capitalEn: "Tirana", tier: 4 },
  { code: "MK", nameAr: "مقدونيا الشمالية", nameEn: "North Macedonia", capitalAr: "سكوبيه", capitalEn: "Skopje", tier: 4 },
  { code: "BA", nameAr: "البوسنة والهرسك", nameEn: "Bosnia & Herzegovina", capitalAr: "سراييفو", capitalEn: "Sarajevo", tier: 4 },
  { code: "ME", nameAr: "الجبل الأسود", nameEn: "Montenegro", capitalAr: "بودغوريتسا", capitalEn: "Podgorica", tier: 4 },
  { code: "GE", nameAr: "جورجيا", nameEn: "Georgia", capitalAr: "تبليسي", capitalEn: "Tbilisi", tier: 4 },
  { code: "AM", nameAr: "أرمينيا", nameEn: "Armenia", capitalAr: "يريفان", capitalEn: "Yerevan", tier: 4 },
  { code: "AZ", nameAr: "أذربيجان", nameEn: "Azerbaijan", capitalAr: "باكو", capitalEn: "Baku", tier: 4 },
  { code: "TM", nameAr: "تركمانستان", nameEn: "Turkmenistan", capitalAr: "عشق آباد", capitalEn: "Ashgabat", tier: 4 },
  { code: "KG", nameAr: "قيرغيزستان", nameEn: "Kyrgyzstan", capitalAr: "بيشكك", capitalEn: "Bishkek", tier: 4 },
  { code: "TJ", nameAr: "طاجيكستان", nameEn: "Tajikistan", capitalAr: "دوشنبه", capitalEn: "Dushanbe", tier: 4 },
  { code: "MN", nameAr: "منغوليا", nameEn: "Mongolia", capitalAr: "أولان باتور", capitalEn: "Ulaanbaatar", tier: 4 },
  { code: "KH", nameAr: "كمبوديا", nameEn: "Cambodia", capitalAr: "بنوم بنه", capitalEn: "Phnom Penh", tier: 4 },
  { code: "LA", nameAr: "لاوس", nameEn: "Laos", capitalAr: "فيينتيان", capitalEn: "Vientiane", tier: 4 },
  { code: "BN", nameAr: "بروناي", nameEn: "Brunei", capitalAr: "بندر سري بيغاوان", capitalEn: "Bandar Seri Begawan", tier: 4 },
  { code: "TL", nameAr: "تيمور الشرقية", nameEn: "Timor-Leste", capitalAr: "ديلي", capitalEn: "Dili", tier: 4 },
  { code: "MV", nameAr: "المالديف", nameEn: "Maldives", capitalAr: "ماليه", capitalEn: "Malé", tier: 4 },
  { code: "BT", nameAr: "بوتان", nameEn: "Bhutan", capitalAr: "تيمفو", capitalEn: "Thimphu", tier: 4 },
  { code: "UG", nameAr: "أوغندا", nameEn: "Uganda", capitalAr: "كمبالا", capitalEn: "Kampala", tier: 4 },
  { code: "RW", nameAr: "رواندا", nameEn: "Rwanda", capitalAr: "كيغالي", capitalEn: "Kigali", tier: 4 },
  { code: "MZ", nameAr: "موزمبيق", nameEn: "Mozambique", capitalAr: "مابوتو", capitalEn: "Maputo", tier: 4 },
  { code: "ZW", nameAr: "زيمبابوي", nameEn: "Zimbabwe", capitalAr: "هراري", capitalEn: "Harare", tier: 4 },
  { code: "BW", nameAr: "بوتسوانا", nameEn: "Botswana", capitalAr: "غابورون", capitalEn: "Gaborone", tier: 4 },
  { code: "NA", nameAr: "ناميبيا", nameEn: "Namibia", capitalAr: "ويندهوك", capitalEn: "Windhoek", tier: 4 },
  { code: "SN", nameAr: "السنغال", nameEn: "Senegal", capitalAr: "داكار", capitalEn: "Dakar", tier: 4 },
  { code: "CI", nameAr: "ساحل العاج", nameEn: "Ivory Coast", capitalAr: "ياموسوكرو", capitalEn: "Yamoussoukro", tier: 4 },
  { code: "CM", nameAr: "الكاميرون", nameEn: "Cameroon", capitalAr: "ياوندي", capitalEn: "Yaoundé", tier: 4 },
  { code: "AO", nameAr: "أنغولا", nameEn: "Angola", capitalAr: "لواندا", capitalEn: "Luanda", tier: 4 },
  { code: "CD", nameAr: "الكونغو الديمقراطية", nameEn: "DR Congo", capitalAr: "كينشاسا", capitalEn: "Kinshasa", tier: 4 },
  { code: "MG", nameAr: "مدغشقر", nameEn: "Madagascar", capitalAr: "أنتاناناريفو", capitalEn: "Antananarivo", tier: 4 },
  { code: "ML", nameAr: "مالي", nameEn: "Mali", capitalAr: "باماكو", capitalEn: "Bamako", tier: 4 },
  { code: "BF", nameAr: "بوركينا فاسو", nameEn: "Burkina Faso", capitalAr: "واغادوغو", capitalEn: "Ouagadougou", tier: 4 },
  { code: "NE", nameAr: "النيجر", nameEn: "Niger", capitalAr: "نيامي", capitalEn: "Niamey", tier: 4 },
  { code: "TD", nameAr: "تشاد", nameEn: "Chad", capitalAr: "نجامينا", capitalEn: "N'Djamena", tier: 4 },
  { code: "JM", nameAr: "جامايكا", nameEn: "Jamaica", capitalAr: "كينغستون", capitalEn: "Kingston", tier: 4 },
  { code: "TT", nameAr: "ترينيداد وتوباغو", nameEn: "Trinidad & Tobago", capitalAr: "بورت أوف سبين", capitalEn: "Port of Spain", tier: 4 },
  { code: "HT", nameAr: "هايتي", nameEn: "Haiti", capitalAr: "بورت أو برنس", capitalEn: "Port-au-Prince", tier: 4 },
  { code: "HN", nameAr: "هندوراس", nameEn: "Honduras", capitalAr: "تيغوسيغالبا", capitalEn: "Tegucigalpa", tier: 4 },
  { code: "GT", nameAr: "غواتيمالا", nameEn: "Guatemala", capitalAr: "غواتيمالا سيتي", capitalEn: "Guatemala City", tier: 4 },
  { code: "NI", nameAr: "نيكاراغوا", nameEn: "Nicaragua", capitalAr: "ماناغوا", capitalEn: "Managua", tier: 4 },
  { code: "SV", nameAr: "السلفادور", nameEn: "El Salvador", capitalAr: "سان سلفادور", capitalEn: "San Salvador", tier: 4 },
  { code: "UY", nameAr: "أوروغواي", nameEn: "Uruguay", capitalAr: "مونتيفيديو", capitalEn: "Montevideo", tier: 4 },
  { code: "PY", nameAr: "باراغواي", nameEn: "Paraguay", capitalAr: "أسونسيون", capitalEn: "Asunción", tier: 4 },
  { code: "BO", nameAr: "بوليفيا", nameEn: "Bolivia", capitalAr: "لاباز", capitalEn: "La Paz", tier: 4 },
  { code: "FJ", nameAr: "فيجي", nameEn: "Fiji", capitalAr: "سوفا", capitalEn: "Suva", tier: 4 },
  { code: "PG", nameAr: "بابوا غينيا الجديدة", nameEn: "Papua New Guinea", capitalAr: "بورت مورسبي", capitalEn: "Port Moresby", tier: 4 },
  { code: "CY", nameAr: "قبرص", nameEn: "Cyprus", capitalAr: "نيقوسيا", capitalEn: "Nicosia", tier: 4 },
  { code: "MT", nameAr: "مالطا", nameEn: "Malta", capitalAr: "فاليتا", capitalEn: "Valletta", tier: 4 },
  { code: "LU", nameAr: "لوكسمبورغ", nameEn: "Luxembourg", capitalAr: "لوكسمبورغ", capitalEn: "Luxembourg", tier: 4 },
  { code: "MD", nameAr: "مولدوفا", nameEn: "Moldova", capitalAr: "كيشيناو", capitalEn: "Chișinău", tier: 4 },
  { code: "BY", nameAr: "بيلاروسيا", nameEn: "Belarus", capitalAr: "مينسك", capitalEn: "Minsk", tier: 4 },
  { code: "CG", nameAr: "الكونغو", nameEn: "Congo", capitalAr: "برازافيل", capitalEn: "Brazzaville", tier: 4 },
  { code: "GA", nameAr: "الغابون", nameEn: "Gabon", capitalAr: "ليبرفيل", capitalEn: "Libreville", tier: 4 },
  { code: "GQ", nameAr: "غينيا الاستوائية", nameEn: "Equatorial Guinea", capitalAr: "مالابو", capitalEn: "Malabo", tier: 4 },
  { code: "GN", nameAr: "غينيا", nameEn: "Guinea", capitalAr: "كوناكري", capitalEn: "Conakry", tier: 4 },
  { code: "GW", nameAr: "غينيا بيساو", nameEn: "Guinea-Bissau", capitalAr: "بيساو", capitalEn: "Bissau", tier: 4 },
  { code: "GM", nameAr: "غامبيا", nameEn: "Gambia", capitalAr: "بانجول", capitalEn: "Banjul", tier: 4 },
  { code: "SL", nameAr: "سيراليون", nameEn: "Sierra Leone", capitalAr: "فريتاون", capitalEn: "Freetown", tier: 4 },
  { code: "LR", nameAr: "ليبيريا", nameEn: "Liberia", capitalAr: "مونروفيا", capitalEn: "Monrovia", tier: 4 },
  { code: "TG", nameAr: "توغو", nameEn: "Togo", capitalAr: "لومي", capitalEn: "Lomé", tier: 4 },
  { code: "BJ", nameAr: "بنين", nameEn: "Benin", capitalAr: "بورتو نوفو", capitalEn: "Porto-Novo", tier: 4 },
  { code: "CF", nameAr: "أفريقيا الوسطى", nameEn: "Central African Republic", capitalAr: "بانغي", capitalEn: "Bangui", tier: 4 },
  { code: "SS", nameAr: "جنوب السودان", nameEn: "South Sudan", capitalAr: "جوبا", capitalEn: "Juba", tier: 4 },
  { code: "ER", nameAr: "إريتريا", nameEn: "Eritrea", capitalAr: "أسمرة", capitalEn: "Asmara", tier: 4 },
  { code: "BI", nameAr: "بوروندي", nameEn: "Burundi", capitalAr: "غيتيغا", capitalEn: "Gitega", tier: 4 },
  { code: "MW", nameAr: "مالاوي", nameEn: "Malawi", capitalAr: "ليلونغوي", capitalEn: "Lilongwe", tier: 4 },
  { code: "ZM", nameAr: "زامبيا", nameEn: "Zambia", capitalAr: "لوساكا", capitalEn: "Lusaka", tier: 4 },
  { code: "LS", nameAr: "ليسوتو", nameEn: "Lesotho", capitalAr: "ماسيرو", capitalEn: "Maseru", tier: 4 },
  { code: "SZ", nameAr: "إسواتيني", nameEn: "Eswatini", capitalAr: "مبابان", capitalEn: "Mbabane", tier: 4 },
  { code: "MU", nameAr: "موريشيوس", nameEn: "Mauritius", capitalAr: "بورت لويس", capitalEn: "Port Louis", tier: 4 },
  { code: "SC", nameAr: "سيشل", nameEn: "Seychelles", capitalAr: "فيكتوريا", capitalEn: "Victoria", tier: 4 },
  { code: "CV", nameAr: "الرأس الأخضر", nameEn: "Cape Verde", capitalAr: "برايا", capitalEn: "Praia", tier: 4 },
  { code: "ST", nameAr: "ساو تومي وبرينسيبي", nameEn: "São Tomé & Príncipe", capitalAr: "ساو تومي", capitalEn: "São Tomé", tier: 4 },
  { code: "GY", nameAr: "غيانا", nameEn: "Guyana", capitalAr: "جورج تاون", capitalEn: "Georgetown", tier: 4 },
  { code: "SR", nameAr: "سورينام", nameEn: "Suriname", capitalAr: "باراماريبو", capitalEn: "Paramaribo", tier: 4 },
  { code: "BZ", nameAr: "بليز", nameEn: "Belize", capitalAr: "بلموبان", capitalEn: "Belmopan", tier: 4 },
  { code: "BS", nameAr: "الباهاما", nameEn: "Bahamas", capitalAr: "ناسو", capitalEn: "Nassau", tier: 4 },
  { code: "BB", nameAr: "باربادوس", nameEn: "Barbados", capitalAr: "بريدج تاون", capitalEn: "Bridgetown", tier: 4 },
  { code: "AG", nameAr: "أنتيغوا وباربودا", nameEn: "Antigua & Barbuda", capitalAr: "سانت جونز", capitalEn: "Saint John's", tier: 4 },
  { code: "DM", nameAr: "دومينيكا", nameEn: "Dominica", capitalAr: "روسو", capitalEn: "Roseau", tier: 4 },
  { code: "GD", nameAr: "غرينادا", nameEn: "Grenada", capitalAr: "سانت جورجز", capitalEn: "Saint George's", tier: 4 },
  { code: "KN", nameAr: "سانت كيتس ونيفيس", nameEn: "Saint Kitts & Nevis", capitalAr: "باستير", capitalEn: "Basseterre", tier: 4 },
  { code: "LC", nameAr: "سانت لوسيا", nameEn: "Saint Lucia", capitalAr: "كاستريس", capitalEn: "Castries", tier: 4 },
  { code: "VC", nameAr: "سانت فنسنت والغرينادين", nameEn: "Saint Vincent & the Grenadines", capitalAr: "كينغستاون", capitalEn: "Kingstown", tier: 4 },
  { code: "TO", nameAr: "تونغا", nameEn: "Tonga", capitalAr: "نوكوألوفا", capitalEn: "Nukuʻalofa", tier: 4 },
  { code: "WS", nameAr: "ساموا", nameEn: "Samoa", capitalAr: "آبيا", capitalEn: "Apia", tier: 4 },
  { code: "VU", nameAr: "فانواتو", nameEn: "Vanuatu", capitalAr: "بورت فيلا", capitalEn: "Port Vila", tier: 4 },
  { code: "SB", nameAr: "جزر سليمان", nameEn: "Solomon Islands", capitalAr: "هونيارا", capitalEn: "Honiara", tier: 4 },
  { code: "KI", nameAr: "كيريباتي", nameEn: "Kiribati", capitalAr: "تاراوا", capitalEn: "Tarawa", tier: 4 },
  { code: "MH", nameAr: "جزر مارشال", nameEn: "Marshall Islands", capitalAr: "ماجورو", capitalEn: "Majuro", tier: 4 },
  { code: "FM", nameAr: "ميكرونيسيا", nameEn: "Micronesia", capitalAr: "باليكير", capitalEn: "Palikir", tier: 4 },
  { code: "PW", nameAr: "بالاو", nameEn: "Palau", capitalAr: "نغيرولمود", capitalEn: "Ngerulmud", tier: 4 },
  { code: "NR", nameAr: "ناورو", nameEn: "Nauru", capitalAr: "يارين", capitalEn: "Yaren", tier: 4 },
  { code: "TV", nameAr: "توفالو", nameEn: "Tuvalu", capitalAr: "فونافوتي", capitalEn: "Funafuti", tier: 4 },
  { code: "AD", nameAr: "أندورا", nameEn: "Andorra", capitalAr: "أندورا لا فيلا", capitalEn: "Andorra la Vella", tier: 4 },
  { code: "MC", nameAr: "موناكو", nameEn: "Monaco", capitalAr: "موناكو", capitalEn: "Monaco", tier: 4 },
  { code: "SM", nameAr: "سان مارينو", nameEn: "San Marino", capitalAr: "سان مارينو", capitalEn: "San Marino", tier: 4 },
  { code: "LI", nameAr: "ليختنشتاين", nameEn: "Liechtenstein", capitalAr: "فادوز", capitalEn: "Vaduz", tier: 4 },
  { code: "VA", nameAr: "الفاتيكان", nameEn: "Vatican City", capitalAr: "الفاتيكان", capitalEn: "Vatican City", tier: 4 },
  { code: "XK", nameAr: "كوسوفو", nameEn: "Kosovo", capitalAr: "بريشتينا", capitalEn: "Pristina", tier: 4 },
];

export type CapitalQuestionMode = "country-to-capital" | "capital-to-country" | "mixed";

export function getCapitalsByTier(maxTier: 1 | 2 | 3 | 4): CapitalCountry[] {
  return capitalCountries.filter(c => c.tier <= maxTier);
}

export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface CapitalQuestion {
  country: CapitalCountry;
  questionMode: "country-to-capital" | "capital-to-country";
  options: { label: string; labelAr: string; value: string }[];
  correctValue: string;
}

export function generateCapitalQuestions(
  pool: CapitalCountry[],
  count: number,
  mode: CapitalQuestionMode
): CapitalQuestion[] {
  const shuffled = shuffleArray(pool);
  const selected = shuffled.slice(0, count);
  return selected.map(country => {
    const resolvedMode: "country-to-capital" | "capital-to-country" =
      mode === "mixed" ? (Math.random() > 0.5 ? "country-to-capital" : "capital-to-country") : mode;

    if (resolvedMode === "country-to-capital") {
      const others = pool.filter(c => c.code !== country.code);
      const distractors = shuffleArray(others).slice(0, 3);
      const allOptions = shuffleArray([
        { label: country.capitalEn, labelAr: country.capitalAr, value: country.code },
        ...distractors.map(d => ({ label: d.capitalEn, labelAr: d.capitalAr, value: d.code })),
      ]);
      return { country, questionMode: resolvedMode, options: allOptions, correctValue: country.code };
    } else {
      const others = pool.filter(c => c.code !== country.code);
      const distractors = shuffleArray(others).slice(0, 3);
      const allOptions = shuffleArray([
        { label: country.nameEn, labelAr: country.nameAr, value: country.code },
        ...distractors.map(d => ({ label: d.nameEn, labelAr: d.nameAr, value: d.code })),
      ]);
      return { country, questionMode: resolvedMode, options: allOptions, correctValue: country.code };
    }
  });
}

export const CAPITAL_LEVELS = [
  { tier: 1 as const, count: 20, nameAr: "مبتدئ", nameEn: "Beginner", icon: "🌱", color: "from-green-500 to-emerald-600" },
  { tier: 2 as const, count: 30, nameAr: "متوسط", nameEn: "Intermediate", icon: "📚", color: "from-blue-500 to-indigo-600" },
  { tier: 3 as const, count: 50, nameAr: "متقدم", nameEn: "Advanced", icon: "🔥", color: "from-orange-500 to-red-600" },
  { tier: 4 as const, count: 100, nameAr: "محترف", nameEn: "Professional", icon: "👑", color: "from-purple-500 to-pink-600" },
  { tier: 4 as const, count: 200, nameAr: "خبير العواصم", nameEn: "Capitals Expert", icon: "🏆", color: "from-yellow-500 to-amber-600" },
] as const;

export const CAPITAL_DURATIONS = [3, 5, 7, 10, 15] as const;

export function getFlagUrl(code: string, size: number = 256): string {
  return `https://flagcdn.com/w${size}/${code.toLowerCase()}.png`;
}
