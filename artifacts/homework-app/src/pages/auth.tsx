import { useState, useEffect, useRef, ReactNode } from "react";
import { useLocation, Link } from "wouter";
import {
  useRegisterTeacher,
  useLoginTeacher,
  useGetCurrentTeacher,
  useLoginTeacherWithGoogle,
  type AuthResponse,
  type TeacherProfileRole,
} from "@workspace/api-client-react";
import { Input, Button, Label } from "@/components/ui-elements";
import {
  Loader2, Mail, Lock, User, AlertCircle, Eye, EyeOff,
  ChevronDown, Shield, BookOpen, BarChart2, Trophy, Users, ArrowLeft,
  GraduationCap, Crown, ShieldCheck, RotateCcw, Phone,
} from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useSeo } from "@/lib/seo";
import { toast } from "@/components/ui/sonner";
import { GoogleLogin } from "@react-oauth/google";
import { getAdminLastSurfacePath } from "@/lib/admin-last-surface";
import { captureAcquisition, getAcquisition } from "@/lib/acquisition";

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ─────────────────────────── Country data ─────────────────────────── */

interface Country {
  iso: string;
  code: string;
  flag: string;
  name: string;
  nameEn: string;
  digits: number;
  group: "gulf" | "arab" | "world";
}

const COUNTRIES: Country[] = [
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

const KUWAIT = COUNTRIES[0];

/* ─────────────────────────── LoginLayout ─────────────────────────── */

function LoginLayout({ children, dir }: { children: ReactNode; dir: "rtl" | "ltr" }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      dir={dir}
      style={{ background: "hsl(40 33% 98%)" }}
    >
      <header className="flex items-center justify-between px-5 sm:px-8 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
            alt="حصاد"
            className="w-9 h-9 rounded-xl object-cover shadow-sm"
          />
          <span className="text-xl font-extrabold" style={{ color: "#1a4731" }}>حصاد</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-black/5"
        >
          <ArrowLeft className="w-4 h-4" />
          العودة للرئيسية
        </Link>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="text-center py-4 text-xs text-muted-foreground/60">
        منصة حصاد © {new Date().getFullYear()} — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}

/* ─────────────────────────── RoleTabs ─────────────────────────── */

function RoleTabs({ onSelectStudent }: { onSelectStudent: () => void }) {
  return (
    <div
      className="flex items-center rounded-2xl p-1 mb-7 relative gap-1"
      style={{ background: "hsl(145 25% 93%)" }}
    >
      <motion.div
        layout
        layoutId="login-role-tab"
        className="absolute top-1 bottom-1 rounded-xl shadow-md"
        style={{
          width: "calc(50% - 4px)",
          right: "4px",
          background: "linear-gradient(135deg, #1a4731, #2a6647)",
        }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
      />
      <button
        type="button"
        className="relative z-10 flex-1 text-center py-2.5 text-sm font-bold rounded-xl text-white transition-colors"
      >
        دخول المعلم
      </button>
      <button
        type="button"
        className="relative z-10 flex-1 text-center py-2.5 text-sm font-bold rounded-xl transition-colors"
        style={{ color: "#2a5c3a" }}
        onClick={onSelectStudent}
      >
        دخول الطالب
      </button>
    </div>
  );
}

/* ─────────────────────────── TrustLinks ─────────────────────────── */

function TrustLinks() {
  return (
    <div className="mt-6 pt-5 border-t border-border/40">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground/70">
        <Link href="/privacy" className="hover:text-muted-foreground transition-colors">سياسة الخصوصية</Link>
        <span className="opacity-30">·</span>
        <Link href="/terms" className="hover:text-muted-foreground transition-colors">الشروط والأحكام</Link>
        <span className="opacity-30">·</span>
        <Link href="/faq" className="hover:text-muted-foreground transition-colors">الأسئلة الشائعة</Link>
        <span className="opacity-30">·</span>
        <a href="mailto:support@hasadx.com" className="hover:text-muted-foreground transition-colors">مساعدة</a>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-3 text-xs font-medium" style={{ color: "#1a4731", opacity: 0.65 }}>
        <Shield className="w-3 h-3" />
        <span>بياناتك محمية وتستخدم فقط لإدارة الحساب</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── SidePanel ─────────────────────────── */

function SidePanel() {
  const benefits = [
    { icon: <BookOpen className="w-5 h-5" />, text: "أنشئ واجبات تفاعلية في ثوانٍ" },
    { icon: <BarChart2 className="w-5 h-5" />, text: "تتبّع تقدم طلابك بسهولة" },
    { icon: <Trophy className="w-5 h-5" />, text: "مسابقات حية ومنافسة ممتعة" },
    { icon: <Users className="w-5 h-5" />, text: "إدارة الفصول والمجموعات بيسر" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="hidden lg:flex flex-col justify-between p-10 xl:p-12 rounded-3xl h-full"
      style={{ background: "linear-gradient(155deg, #1e5238 0%, #112b1e 55%, #0d2015 100%)" }}
    >
      <div>
        <div className="flex items-center gap-3.5 mb-12">
          <img
            src={`${import.meta.env.BASE_URL}images/logo-icon.png`}
            alt="حصاد"
            className="w-11 h-11 rounded-2xl object-cover ring-2 ring-white/15 shadow-xl"
          />
          <span className="text-2xl font-black text-white tracking-wide">حصاد</span>
        </div>

        <h2 className="text-[1.75rem] xl:text-3xl font-black text-white leading-tight mb-3">
          منصة التعلّم<br />
          <span style={{ color: "#c9a84c" }}>التفاعلي</span>
        </h2>
        <p className="text-white/55 text-sm leading-relaxed mb-10 max-w-[260px]">
          علّم بطريقة مختلفة. أثّر في طلابك.
        </p>

        <div className="space-y-5">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-center gap-3.5"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.2)" }}
              >
                <span style={{ color: "#c9a84c" }}>{b.icon}</span>
              </div>
              <span className="text-white/75 text-sm font-medium leading-snug">{b.text}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-10">
        <p className="text-white/25 text-xs">منصة حصاد © {new Date().getFullYear()}</p>
        <div className="w-8 h-0.5 rounded-full" style={{ background: "rgba(201,168,76,0.3)" }} />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── LoginForm ─────────────────────────── */

interface LoginFormProps {
  isLogin: boolean;
  errorMsg: string;
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  selectedCountry: Country; setSelectedCountry: (c: Country) => void;
  showCountryPicker: boolean; setShowCountryPicker: (v: boolean) => void;
  countrySearch: string; setCountrySearch: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  usePhone: boolean; setUsePhone: (v: boolean) => void;
  rememberMe: boolean; setRememberMe: (v: boolean) => void;
  showPassword: boolean; setShowPassword: (v: boolean) => void;
  isLoading: boolean;
  ctaLabel: string;
  handleSubmit: (e: React.FormEvent) => void;
  iconPositionClass: string;
  inputPaddingClass: string;
  pickerRef: React.RefObject<HTMLDivElement | null>;
  gulfCountries: Country[];
  arabCountries: Country[];
  worldCountries: Country[];
  filteredCountries: Country[];
  t: ReturnType<typeof useI18n>["t"];
  lang: string;
  dir: "rtl" | "ltr";
}

function LoginForm({
  isLogin, errorMsg,
  name, setName, email, setEmail, phone, setPhone,
  selectedCountry, setSelectedCountry, showCountryPicker, setShowCountryPicker,
  countrySearch, setCountrySearch, password, setPassword,
  usePhone, setUsePhone, rememberMe, setRememberMe,
  showPassword, setShowPassword, isLoading, ctaLabel, handleSubmit,
  iconPositionClass, inputPaddingClass, pickerRef,
  gulfCountries, arabCountries, worldCountries, filteredCountries,
  t, lang, dir,
}: LoginFormProps) {
  const loginTeacherWithGoogleMutation = useLoginTeacherWithGoogle();
  return (
    <>
      {/* Error */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 p-3.5 rounded-xl bg-destructive/8 border border-destructive/20 flex items-start gap-2.5 text-destructive"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Google Login — full-width prominent */}
      <div className="mb-2 flex flex-col items-center gap-4">
        <div className="relative w-full" style={{ height: 48 }}>
          {/* Visual layer — custom styled full-width Google button */}
          <div
            className="absolute inset-0 flex items-center justify-center gap-3 rounded-xl bg-white border-2 border-gray-200 shadow-md font-semibold text-gray-700 text-sm pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {lang === "ar" ? "المتابعة عبر Google" : "Continue with Google"}
          </div>
          {/* Click layer — invisible Google OAuth iframe that captures clicks */}
          <div className="absolute inset-0 overflow-hidden rounded-xl" style={{ opacity: 0.01, zIndex: 2 }}>
            <GoogleLogin
              onSuccess={async (resp) => {
                if (!resp.credential) {
                  toast.error(lang === "ar" ? "تعذّر الحصول على بيانات Google" : "Failed to get Google credentials");
                  return;
                }
                try {
                  const data: AuthResponse = await loginTeacherWithGoogleMutation.mutateAsync({
                    data: { credential: resp.credential },
                  });
                  toast.success(lang === "ar" ? "تم تسجيل الدخول بنجاح" : "Logged in successfully");
                  let pendingPublish = false;
                  try { pendingPublish = localStorage.getItem("pending_publish_after_auth") === "1"; } catch {}
                  // Route by role so organizers land on /organizer.
                  // Admins are sent to their last-used surface when remembered.
                  const role = data.teacher.role;
                  const isAdmin = data.teacher.isAdmin;
                  let target: string;
                  if (pendingPublish) {
                    target = "guest/create";
                  } else if (isAdmin || role === "admin") {
                    const lastPath = getAdminLastSurfacePath();
                    // Strip leading slash because BASE_URL already ends with one.
                    target = (lastPath ?? "/teacher").replace(/^\//, "");
                  } else if (role === "organizer") {
                    target = "organizer";
                  } else {
                    target = "teacher";
                  }
                  window.location.href = `${import.meta.env.BASE_URL}${target}`;
                } catch (err) {
                  const message = err instanceof Error ? err.message : "";
                  toast.error(message || (lang === "ar" ? "تعذّر تسجيل الدخول" : "Login failed"));
                }
              }}
              onError={() => {
                toast.error(lang === "ar" ? "تعذّر تسجيل الدخول عبر Google" : "Google sign-in failed");
              }}
              theme="outline"
              size="large"
              text="continue_with"
              shape="rectangular"
              width="600"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-xs font-bold text-muted-foreground/70 px-2 shrink-0">أو</span>
          <div className="flex-1 h-px bg-border/60" />
        </div>
      </div>

      {/* Animated Form */}
      <AnimatePresence mode="wait">
        <motion.form
          key={isLogin ? "login-form" : "register-form"}
          initial={{ opacity: 0, x: isLogin ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isLogin ? 10 : -10 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Name — register only */}
          {!isLogin && (
            <div>
              <Label htmlFor="name">{t.auth.fullName}</Label>
              <div className="relative">
                <User className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`} />
                <Input
                  id="name"
                  type="text"
                  placeholder={t.auth.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className={inputPaddingClass}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Email / Phone toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="contact" className="mb-0">
                {usePhone ? t.auth.phone : t.auth.email}
              </Label>
              <button
                type="button"
                onClick={() => {
                  setUsePhone(!usePhone);
                  setEmail("");
                  setPhone("");
                  setShowCountryPicker(false);
                }}
                className="text-xs font-semibold transition-colors"
                style={{ color: "#1a4731" }}
              >
                {usePhone ? t.auth.useEmail : t.auth.usePhone}
              </button>
            </div>

            {usePhone ? (
              <div className="flex gap-0 relative" ref={pickerRef} dir="ltr">
                <button
                  type="button"
                  onClick={() => { setShowCountryPicker(!showCountryPicker); setCountrySearch(""); }}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-2.5 border-2 border-input border-e-0 rounded-s-xl bg-muted hover:bg-muted/80 transition-colors text-sm font-medium whitespace-nowrap shrink-0 focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-50"
                >
                  <span className="text-base leading-none">{selectedCountry.flag}</span>
                  <span className="text-xs text-muted-foreground font-mono">{selectedCountry.code}</span>
                  <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showCountryPicker ? "rotate-180" : ""}`} />
                </button>

                <Input
                  id="contact"
                  type="tel"
                  placeholder={"x".repeat(selectedCountry.digits)}
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= selectedCountry.digits) setPhone(val);
                  }}
                  required
                  minLength={selectedCountry.digits}
                  maxLength={selectedCountry.digits}
                  className="rounded-s-none border-s-0 text-left flex-1 min-w-0"
                  dir="ltr"
                  disabled={isLoading}
                  autoComplete="tel"
                />

                <AnimatePresence>
                  {showCountryPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-1 start-0 z-50 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                      dir={dir}
                    >
                      <div className="p-2 border-b border-border">
                        <Input
                          type="text"
                          placeholder={lang === "ar" ? "ابحث عن دولة..." : "Search country..."}
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {gulfCountries.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                              {lang === "ar" ? "دول الخليج" : "Gulf Countries"}
                            </div>
                            {gulfCountries.map(c => (
                              <button
                                key={c.iso}
                                type="button"
                                onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); setCountrySearch(""); setPhone(""); }}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-start ${selectedCountry.iso === c.iso ? "bg-primary/10 text-primary font-bold" : ""}`}
                              >
                                <span className="text-base shrink-0">{c.flag}</span>
                                <span className="flex-1 truncate">{lang === "ar" ? c.name : c.nameEn}</span>
                                <span className="text-xs text-muted-foreground font-mono shrink-0">{c.code}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {arabCountries.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                              {lang === "ar" ? "الدول العربية" : "Arab Countries"}
                            </div>
                            {arabCountries.map(c => (
                              <button
                                key={c.iso}
                                type="button"
                                onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); setCountrySearch(""); setPhone(""); }}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-start ${selectedCountry.iso === c.iso ? "bg-primary/10 text-primary font-bold" : ""}`}
                              >
                                <span className="text-base shrink-0">{c.flag}</span>
                                <span className="flex-1 truncate">{lang === "ar" ? c.name : c.nameEn}</span>
                                <span className="text-xs text-muted-foreground font-mono shrink-0">{c.code}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {worldCountries.length > 0 && (
                          <>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                              {lang === "ar" ? "دول العالم" : "World"}
                            </div>
                            {worldCountries.map(c => (
                              <button
                                key={c.iso}
                                type="button"
                                onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); setCountrySearch(""); setPhone(""); }}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-start ${selectedCountry.iso === c.iso ? "bg-primary/10 text-primary font-bold" : ""}`}
                              >
                                <span className="text-base shrink-0">{c.flag}</span>
                                <span className="flex-1 truncate">{lang === "ar" ? c.name : c.nameEn}</span>
                                <span className="text-xs text-muted-foreground font-mono shrink-0">{c.code}</span>
                              </button>
                            ))}
                          </>
                        )}
                        {filteredCountries.length === 0 && (
                          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {lang === "ar" ? "لا توجد نتائج" : "No results"}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="relative">
                <Mail className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`} />
                <Input
                  id="contact"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={`${inputPaddingClass} text-left`}
                  dir="ltr"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="password" className="mb-0">{t.auth.password}</Label>
              {isLogin && (
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold transition-colors"
                  style={{ color: "#1a4731" }}
                >
                  {t.auth.forgotPassword}
                </Link>
              )}
            </div>
            <div className="relative">
              <Lock className={`absolute ${iconPositionClass} top-3.5 w-5 h-5 text-muted-foreground`} />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={`${inputPaddingClass} ${lang === "ar" ? "pl-10" : "pr-10"} text-left`}
                dir="ltr"
                disabled={isLoading}
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${lang === "ar" ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 z-10 p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors`}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          {isLogin && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none group -mt-1">
              <div className="relative shrink-0">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <div
                  className="w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center"
                  style={{
                    borderColor: rememberMe ? "#1a4731" : undefined,
                    background: rememberMe ? "#1a4731" : undefined,
                    boxShadow: rememberMe ? "0 0 0 3px rgba(26,71,49,0.12)" : undefined,
                  }}
                >
                  {rememberMe && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {t.auth.rememberMe}
              </span>
            </label>
          )}

          {/* CTA Button */}
          <Button
            type="submit"
            className="w-full py-3.5 text-base mt-1 font-bold tracking-tight shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
            disabled={isLoading}
            style={{ background: "linear-gradient(135deg, #1a4731, #2a6647)", color: "#fff" }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              ctaLabel
            )}
          </Button>

        </motion.form>
      </AnimatePresence>
    </>
  );
}

/* ─────────────────────────── OTP Verification Screen ─────────────────── */

function OtpVerifyScreen({
  identifier,
  channel,
  lang,
  dir,
  onVerified,
  onBack,
}: {
  identifier: string;
  channel: "email" | "sms";
  lang: string;
  dir: "rtl" | "ltr";
  onVerified: (teacher: { role: string; isAdmin: boolean }) => void;
  onBack: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Start 60-second resend cooldown on mount
  useEffect(() => {
    setCountdown(60);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const maskedIdentifier = channel === "email"
    ? identifier.replace(/(.{2})(.+)(@.+)/, (_, a, _b, c) => `${a}***${c}`)
    : identifier.replace(/(\+\d{3})\d+(\d{4})/, "$1***$2");

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If already verified, route back to login instead of staying on OTP screen
        if (data.alreadyVerified) {
          onBack();
          toast.success(lang === "ar" ? "حسابك محقق بالفعل — سجّل الدخول" : "Account already verified — please sign in");
          return;
        }
        setError(data.message || (lang === "ar" ? "رمز غير صحيح" : "Invalid code"));
        setLoading(false);
        return;
      }
      onVerified(data.teacher);
    } catch {
      setError(lang === "ar" ? "تعذّر الاتصال بالخادم" : "Connection error");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || (lang === "ar" ? "تعذّر إعادة الإرسال" : "Resend failed"));
        return;
      }
      setCountdown(60);
      toast.success(lang === "ar" ? "تم إرسال رمز جديد" : "New code sent");
    } catch {
      setError(lang === "ar" ? "تعذّر الاتصال بالخادم" : "Connection error");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-lg border p-7 sm:p-9"
        style={{ borderColor: "hsl(40 20% 88%)" }}
        dir={dir}
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#1e5238,#2a6647)", boxShadow: "0 8px 24px -8px rgba(30,82,56,0.45)" }}
          >
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-black text-center mb-2" style={{ color: "#1a4731" }}>
          {lang === "ar" ? "تحقق من حسابك" : "Verify your account"}
        </h1>
        <p className="text-sm text-center text-muted-foreground mb-1 leading-relaxed">
          {lang === "ar"
            ? `أرسلنا رمزاً مكوناً من 6 أرقام إلى`
            : `We sent a 6-digit code to`}
        </p>
        <p className="text-sm font-bold text-center mb-6" style={{ color: "#1a4731", direction: "ltr" }}>
          {channel === "sms" && <Phone className="w-3.5 h-3.5 inline me-1" />}
          {maskedIdentifier}
        </p>

        {/* OTP Input */}
        <div className="flex justify-center mb-5" dir="ltr">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            onComplete={handleVerify}
          >
            <InputOTPGroup>
              {[0,1,2,3,4,5].map(i => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="w-11 h-12 text-lg font-black"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl bg-destructive/8 border border-destructive/20 flex items-center gap-2 text-destructive text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verify button */}
        <Button
          type="button"
          className="w-full h-11 font-black text-sm rounded-xl mb-3"
          disabled={otp.length !== 6 || loading}
          onClick={handleVerify}
          style={{ background: "linear-gradient(135deg,#1a4731,#2a6647)", color: "#fff" }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (lang === "ar" ? "تحقق وادخل" : "Verify & continue")}
        </Button>

        {/* Resend */}
        <button
          type="button"
          onClick={handleResend}
          disabled={countdown > 0 || resending}
          className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-xl transition-all disabled:opacity-50"
          style={{ color: countdown > 0 ? "#9ca3af" : "#1a4731" }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {countdown > 0
            ? (lang === "ar" ? `إعادة الإرسال بعد ${countdown}ث` : `Resend in ${countdown}s`)
            : (lang === "ar" ? "إعادة إرسال الرمز" : "Resend code")}
        </button>

        {/* "Didn't receive the code?" help panel */}
        <div
          className="mt-4 rounded-xl p-3.5 text-xs leading-relaxed"
          style={{ background: "rgba(26,71,49,0.05)", border: "1px solid rgba(26,71,49,0.12)" }}
        >
          <p className="font-bold mb-1.5" style={{ color: "#1a4731" }}>
            {lang === "ar" ? "لم يصلك الرمز؟" : "Didn't receive the code?"}
          </p>
          <ul className="space-y-1 text-muted-foreground" style={{ listStyleType: "disc", paddingInlineStart: "1.2rem" }}>
            {channel === "email" && (
              <li>{lang === "ar" ? "تحقق من مجلد البريد غير المرغوب (Spam / Junk)" : "Check your spam or junk folder"}</li>
            )}
            <li>
              {lang === "ar"
                ? `الرمز صالح لمدة ${channel === "email" ? "30" : "10"} دقيقة — انتظر قليلاً ثم تحقق مجدداً`
                : `The code is valid for ${channel === "email" ? "30" : "10"} minutes — wait a moment then check again`}
            </li>
            <li>
              {lang === "ar" ? (
                <>
                  تحتاج مساعدة؟{" "}
                  <a href="mailto:support@hasadx.com" className="underline font-semibold" style={{ color: "#1a4731" }}>
                    تواصل مع الدعم
                  </a>
                </>
              ) : (
                <>
                  Need help?{" "}
                  <a href="mailto:support@hasadx.com" className="underline font-semibold" style={{ color: "#1a4731" }}>
                    Contact support
                  </a>
                </>
              )}
            </li>
          </ul>
        </div>

        {/* Back */}
        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {lang === "ar" ? "← العودة إلى تسجيل الدخول" : "← Back to login"}
        </button>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────── Main Auth Page ─────────────────────────── */

export default function Auth() {
  const [location, setLocation] = useLocation();
  const isLogin = location === "/login" || location === "/auth";
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  useSeo(
    isLogin
      ? {
          title: lang === "ar" ? "تسجيل الدخول | منصة حصاد — HasadX" : "Sign in | HasadX",
          description:
            lang === "ar"
              ? "سجّل الدخول إلى منصة حصاد التعليمية لإدارة الفصول والعروض التفاعلية والمسابقات والواجبات."
              : "Sign in to HasadX to manage classes, interactive presentations, quizzes and assignments.",
          canonicalPath: "/login",
          noindex: true,
        }
      : {
          title: lang === "ar" ? "إنشاء حساب جديد | منصة حصاد — HasadX" : "Create account | HasadX",
          description:
            lang === "ar"
              ? "أنشئ حساب معلم في منصة حصاد التعليمية وابدأ ببناء عروض تفاعلية ومسابقات تعليمية وواجبات وأنشطة بالذكاء الاصطناعي."
              : "Create a teacher account on HasadX and start building interactive presentations, quizzes and AI-powered lessons.",
          canonicalPath: "/register",
          noindex: true,
        },
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(KUWAIT);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [usePhone, setUsePhone] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // For the registration flow we first ask the user to pick a role:
  //   student → /student/register, teacher → form, organizer → form (role passed to API).
  // When isLogin is true, the role picker is bypassed entirely.
  // The home page can also pre-select the role via `?role=teacher|organizer`,
  // skipping the picker step so the chosen card opens the matching form directly.
  const [registerRole, setRegisterRole] = useState<"teacher" | "organizer" | null>(() => {
    if (typeof window === "undefined") return null;
    const r = new URLSearchParams(window.location.search).get("role");
    return r === "teacher" || r === "organizer" ? r : null;
  });

  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { captureAcquisition(); }, []);

  useEffect(() => {
    if (!showCountryPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCountryPicker(false);
        setCountrySearch("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCountryPicker]);

  const { data: currentUser, isLoading: isCheckingSession } = useGetCurrentTeacher({
    query: { retry: false, staleTime: 0 } as any
  });

  // Centralized role-aware post-auth redirect.
  // pendingPublish always wins; otherwise role decides the home page.
  // Admins are sent to their last-used surface (organizer / admin / teacher)
  // when one is remembered in localStorage; otherwise default to /teacher.
  const redirectByRole = (
    role: TeacherProfileRole | null | undefined,
    isAdmin?: boolean | null,
  ) => {
    let pendingPublish = false;
    try { pendingPublish = localStorage.getItem("pending_publish_after_auth") === "1"; } catch {}
    if (pendingPublish) {
      setLocation("/guest/create");
      return;
    }
    if (isAdmin || role === "admin") {
      const lastPath = getAdminLastSurfacePath();
      setLocation(lastPath ?? "/teacher");
      return;
    }
    setLocation(role === "organizer" ? "/organizer" : "/teacher");
  };

  useEffect(() => {
    if (currentUser && !isCheckingSession) {
      redirectByRole(currentUser.role, currentUser.isAdmin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isCheckingSession]);

  // Backwards-compat shim used by login flow (will read role from response).
  const postAuthRedirect = (
    role?: TeacherProfileRole | null,
    isAdmin?: boolean | null,
  ) => redirectByRole(role, isAdmin);

  const isPendingPublish = () => {
    try { return localStorage.getItem("pending_publish_after_auth") === "1"; } catch { return false; }
  };

  // OTP pending state: set after registration or unverified login attempt
  const [otpPending, setOtpPending] = useState<{
    identifier: string;
    channel: "email" | "sms";
  } | null>(null);

  const loginMutation = useLoginTeacher({
    mutation: {
      onSuccess: (data) => {
        toast.success(lang === "ar" ? "تم تسجيل الدخول بنجاح" : "Logged in successfully");
        postAuthRedirect(data.teacher.role ?? null, data.teacher.isAdmin ?? null);
      },
      onError: (err: Error & { message?: string }) => {
        // ApiError.message is prefixed ("HTTP 403 Forbidden: NEEDS_VERIFICATION"),
        // so check the structured data payload instead.
        const apiErr = err as any;
        if (apiErr?.data?.message === "NEEDS_VERIFICATION") {
          const identifier = usePhone
            ? `${selectedCountry.code}${phone}`
            : email;
          setOtpPending({ identifier, channel: usePhone ? "sms" : "email" });
          return;
        }
        setErrorMsg(err.message || t.auth.loginError);
      },
    }
  });

  const registerMutation = useRegisterTeacher({
    mutation: {
      onSuccess: (data: any) => {
        if (data?.needsVerification) {
          setOtpPending({ identifier: data.identifier, channel: data.channel ?? "email" });
          return;
        }
        toast.success(lang === "ar" ? "تم إنشاء الحساب بنجاح" : "Account created successfully");
        const role: TeacherProfileRole | null = data.teacher?.role ?? registerRole;
        const isAdmin = data.teacher?.isAdmin ?? false;
        let pendingPublish = false;
        try { pendingPublish = localStorage.getItem("pending_publish_after_auth") === "1"; } catch {}
        if (pendingPublish) {
          setLocation("/guest/create");
        } else if (isAdmin || role === "admin") {
          setLocation(getAdminLastSurfacePath() ?? "/teacher");
        } else if (role === "organizer") {
          setLocation("/organizer");
        } else {
          setLocation("/teacher");
        }
      },
      onError: (err: Error & { message?: string }) => setErrorMsg(err.message || t.auth.registerError)
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (usePhone) {
      if (phone.length !== selectedCountry.digits) {
        setErrorMsg(
          lang === "ar"
            ? `رقم الهاتف يجب أن يتكون من ${selectedCountry.digits} أرقام للدولة المختارة`
            : `Phone number must be ${selectedCountry.digits} digits for the selected country`
        );
        return;
      }
    }

    const fullPhone = usePhone ? `${selectedCountry.code}${phone}` : undefined;

    if (isLogin) {
      loginMutation.mutate({
        data: {
          ...(usePhone ? { phone: fullPhone } : { email }),
          password,
          rememberMe,
        }
      });
    } else {
      const acq = getAcquisition();
      registerMutation.mutate({
        data: {
          name,
          ...(usePhone ? { phone: fullPhone } : { email }),
          password,
          // Send selected role; defaults to teacher when picker was skipped.
          role: registerRole === "organizer" ? "organizer" : "teacher",
          ...(acq ? {
            acquisitionSource: acq.source || undefined,
            acquisitionMedium: acq.medium || undefined,
            acquisitionCampaign: acq.campaign || undefined,
            acquisitionReferrer: acq.referrer || undefined,
          } : {}),
        } as any
      });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(c =>
        c.name.includes(countrySearch) ||
        c.nameEn.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.includes(countrySearch)
      )
    : COUNTRIES;

  const gulfCountries = filteredCountries.filter(c => c.group === "gulf");
  const arabCountries = filteredCountries.filter(c => c.group === "arab");
  const worldCountries = filteredCountries.filter(c => c.group === "world");

  const iconPositionClass = lang === "ar" ? "right-4" : "left-4";
  const inputPaddingClass = lang === "ar" ? "pr-12" : "pl-12";

  if (isCheckingSession) {
    return (
      <LoginLayout dir={dir}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1a4731" }} />
        </div>
      </LoginLayout>
    );
  }

  if (currentUser) {
    return null;
  }

  // ── OTP verification screen ───────────────────────────────────────────────
  if (otpPending) {
    return (
      <LoginLayout dir={dir}>
        <OtpVerifyScreen
          identifier={otpPending.identifier}
          channel={otpPending.channel}
          lang={lang}
          dir={dir}
          onVerified={(teacher) => {
            toast.success(lang === "ar" ? "تم تفعيل حسابك بنجاح 🎉" : "Account verified successfully 🎉");
            postAuthRedirect(teacher.role as TeacherProfileRole, teacher.isAdmin);
          }}
          onBack={() => setOtpPending(null)}
        />
      </LoginLayout>
    );
  }

  // For new registrations we present a 3-button role picker (student / teacher / organizer)
  // before showing the actual form. Login flows skip this entirely.
  if (!isLogin && registerRole === null) {
    return (
      <LoginLayout dir={dir}>
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-lg border p-7 sm:p-9"
            style={{ borderColor: "hsl(40 20% 88%)" }}
          >
            <div className="text-center mb-7">
              <h1 className="text-[1.65rem] font-black mb-2 leading-tight" style={{ color: "#1a4731" }}>
                {lang === "ar" ? "كيف ستستخدم حصاد؟" : "How will you use Hasad?"}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {lang === "ar"
                  ? "اختر نوع حسابك للمتابعة"
                  : "Choose your account type to continue"}
              </p>
            </div>

            <div className="space-y-3">
              {/* Student — go straight to PIN entry. The /game/join page also
                  links to "create a student account" for those who want one. */}
              <button
                type="button"
                onClick={() => setLocation("/game/join")}
                className="w-full group relative overflow-hidden rounded-2xl p-5 text-start transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg,#1E4D35 0%,#2d7050 100%)",
                  color: "#fff",
                  boxShadow: "0 10px 28px -10px rgba(30,77,53,0.55)",
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,14,0.22)", border: "1px solid rgba(232,168,14,0.45)" }}>
                    <GraduationCap className="w-6 h-6" style={{ color: "#E8A80E" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-base">
                      {lang === "ar" ? "أنا طالب / مشارك" : "I'm a student / participant"}
                    </p>
                    <p className="text-white/80 text-xs mt-0.5">
                      {lang === "ar" ? "انضم بـ PIN واحصد نقاطك" : "Join with a PIN and collect points"}
                    </p>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-white/70 shrink-0" style={{ transform: dir === "ltr" ? "rotate(180deg)" : "none" }} />
                </div>
              </button>

              {/* Teacher */}
              <button
                type="button"
                onClick={() => setRegisterRole("teacher")}
                className="w-full group relative overflow-hidden rounded-2xl p-5 text-start transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{
                  background: "#fff",
                  border: "2px solid #1a7a45",
                  color: "#1a4731",
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(26,71,49,0.10)" }}>
                    <BookOpen className="w-6 h-6" style={{ color: "#1a4731" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-base">
                      {lang === "ar" ? "أنا معلّم" : "I'm a teacher"}
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {lang === "ar" ? "صفوف، واجبات، عروض، وألعاب صفّية" : "Classes, assignments, decks & class games"}
                    </p>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground shrink-0" style={{ transform: dir === "ltr" ? "rotate(180deg)" : "none" }} />
                </div>
              </button>

              {/* Organizer */}
              <button
                type="button"
                onClick={() => setRegisterRole("organizer")}
                className="w-full group relative overflow-hidden rounded-2xl p-5 text-start transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg,#0a1628 0%,#1e3a5f 100%)",
                  color: "#fff",
                  boxShadow: "0 10px 28px -10px rgba(30,58,95,0.55)",
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(232,168,14,0.22)", border: "1px solid rgba(232,168,14,0.45)" }}>
                    <Crown className="w-6 h-6" style={{ color: "#E8A80E" }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-base">
                      {lang === "ar" ? "أنا منظّم فعاليات" : "I'm an event organizer"}
                    </p>
                    <p className="text-white/80 text-xs mt-0.5">
                      {lang === "ar" ? "مسابقات حية، تحدّيات، وفعاليات كبرى" : "Live contests, challenges & big events"}
                    </p>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-white/70 shrink-0" style={{ transform: dir === "ltr" ? "rotate(180deg)" : "none" }} />
                </div>
              </button>
            </div>

            <Link
              href="/login"
              className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 font-bold text-sm transition-all hover:bg-primary/5"
              style={{ borderColor: "#1a7a45", color: "#1a7a45" }}
            >
              <span style={{ fontSize: "1.1em" }}>←</span>
              {t.auth.hasAccount} {t.auth.loginNow}
            </Link>

            <TrustLinks />
          </motion.div>
        </div>
      </LoginLayout>
    );
  }

  const isOrganizerRegister = !isLogin && registerRole === "organizer";
  const ctaLabel = isLogin
    ? (lang === "ar" ? "الدخول إلى لوحة المعلم" : "Sign in to Teacher Dashboard")
    : isOrganizerRegister
      ? (lang === "ar" ? "إنشاء حساب منظّم" : "Create Organizer Account")
      : t.auth.createAccountBtn;

  return (
    <LoginLayout dir={dir}>
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl flex gap-8 items-stretch">

          {/* ── Side Panel (lg+) ── */}
          <div className="lg:w-[42%] xl:w-[40%] flex-shrink-0">
            <SidePanel />
          </div>

          {/* ── Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38 }}
            className="flex-1 w-full"
          >
            <div
              className="bg-white rounded-3xl shadow-lg border p-7 sm:p-9"
              style={{ borderColor: "hsl(40 20% 88%)" }}
            >
              {/* Role Tabs (login flow only — register has its own picker step) */}
              {isLogin && (
                <RoleTabs onSelectStudent={() => setLocation("/student/login")} />
              )}

              {/* For register flow, show a small "back" link to switch role. */}
              {!isLogin && registerRole && (
                <button
                  type="button"
                  onClick={() => setRegisterRole(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold mb-5 transition-colors hover:opacity-80"
                  style={{ color: "#1a4731" }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" style={{ transform: dir === "ltr" ? "rotate(180deg)" : "none" }} />
                  {lang === "ar" ? "تغيير نوع الحساب" : "Change account type"}
                </button>
              )}

              {/* Heading */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={isLogin ? "login-heading" : `register-heading-${registerRole}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="mb-6"
                >
                  <h1 className="text-[1.65rem] font-black mb-1.5 leading-tight" style={{ color: "#1a4731" }}>
                    {isLogin
                      ? (lang === "ar" ? "مرحباً بك مجدداً" : "Welcome Back")
                      : isOrganizerRegister
                        ? (lang === "ar" ? "إنشاء حساب منظّم" : "Create Organizer Account")
                        : (lang === "ar" ? "إنشاء حساب معلم" : "Create Teacher Account")}
                  </h1>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {isLogin
                      ? (lang === "ar" ? "ادخل إلى لوحة تحكمك وتابع مع طلابك." : "Access your dashboard and continue with your students.")
                      : isOrganizerRegister
                        ? (lang === "ar" ? "أنشئ حسابك لإدارة المسابقات والفعاليات." : "Create your account to run contests and events.")
                        : (lang === "ar" ? "أنشئ حسابك وابدأ رحلة التدريس التفاعلي." : "Create your account and start your interactive teaching journey.")}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Login Form */}
              <LoginForm
                isLogin={isLogin}
                errorMsg={errorMsg}
                name={name} setName={setName}
                email={email} setEmail={setEmail}
                phone={phone} setPhone={setPhone}
                selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry}
                showCountryPicker={showCountryPicker} setShowCountryPicker={setShowCountryPicker}
                countrySearch={countrySearch} setCountrySearch={setCountrySearch}
                password={password} setPassword={setPassword}
                usePhone={usePhone} setUsePhone={setUsePhone}
                rememberMe={rememberMe} setRememberMe={setRememberMe}
                showPassword={showPassword} setShowPassword={setShowPassword}
                isLoading={isLoading}
                ctaLabel={ctaLabel}
                handleSubmit={handleSubmit}
                iconPositionClass={iconPositionClass}
                inputPaddingClass={inputPaddingClass}
                pickerRef={pickerRef}
                gulfCountries={gulfCountries}
                arabCountries={arabCountries}
                worldCountries={worldCountries}
                filteredCountries={filteredCountries}
                t={t}
                lang={lang}
                dir={dir}
              />

              {/* Register / Login switch — full-width outlined green button */}
              <Link
                href={isLogin ? "/register" : "/login"}
                className="mt-5 flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 font-bold text-sm transition-all hover:bg-primary/5 active:scale-[0.98]"
                style={{ borderColor: "#1a7a45", color: "#1a7a45" }}
              >
                {isLogin ? (
                  <>
                    <span style={{ fontSize: "1.1em" }}>✦</span>
                    {t.auth.noAccount} {t.auth.registerNow}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "1.1em" }}>←</span>
                    {t.auth.hasAccount} {t.auth.loginNow}
                  </>
                )}
              </Link>

              {/* Trust Links */}
              <TrustLinks />
            </div>
          </motion.div>
        </div>
      </div>
    </LoginLayout>
  );
}
