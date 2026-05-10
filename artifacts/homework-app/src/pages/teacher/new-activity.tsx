import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import {
  FileText,
  Mic,
  Play,
  Monitor,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ClipboardList,
  Trophy,
  BookOpen,
} from "lucide-react";

interface ActivityType {
  id: string;
  icon: React.ReactNode;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  color: string;
  iconBg: string;
  border: string;
  hoverBorder: string;
  badge?: string;
  badgeColor?: string;
  route: string;
}

interface ActivitySection {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  icon: React.ReactNode;
  accentColor: string;
  items: ActivityType[];
}

const SECTIONS: ActivitySection[] = [
  {
    id: "digital",
    title: "أنشطة ومستندات تعليمية",
    titleEn: "Activities & teaching documents",
    description: "أنشطة رقمية يحلّها الطلاب على أجهزتهم، ومولّدات ذكية لأوراق العمل وخطط الدروس الجاهزة للطباعة.",
    descriptionEn: "Digital activities students solve on their devices, plus smart generators for worksheets and lesson plans ready to print.",
    icon: <ClipboardList className="w-5 h-5" />,
    accentColor: "text-emerald-700 dark:text-emerald-400",
    items: [
      {
        id: "assignment",
        icon: <FileText className="w-10 h-10" />,
        title: "واجب / اختبار",
        titleEn: "Quiz / Homework",
        description: "أسئلة متنوعة: اختيار، صح/خطأ، أكمل الفراغ",
        descriptionEn: "Multiple question types: MCQ, true/false, fill in the blank",
        color: "text-emerald-600 dark:text-emerald-400",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
        border: "border-border",
        hoverBorder: "hover:border-emerald-400 hover:shadow-emerald-100 dark:hover:shadow-emerald-900/30",
        route: "/teacher/new/assignment",
      },
      {
        id: "dictation",
        icon: <Mic className="w-10 h-10" />,
        title: "نشاط الاستماع",
        titleEn: "Listening Activity",
        description: "يستمع الطالب لنص أو قصة ثم يجيب على الأسئلة",
        descriptionEn: "Student listens and types — a real retention test",
        color: "text-teal-600 dark:text-teal-400",
        iconBg: "bg-teal-100 dark:bg-teal-900/40",
        border: "border-border",
        hoverBorder: "hover:border-teal-400 hover:shadow-teal-100 dark:hover:shadow-teal-900/30",
        route: "/teacher/new/dictation",
      },
      {
        id: "video",
        icon: <Play className="w-10 h-10" />,
        title: "فيديو تفاعلي",
        titleEn: "Interactive Video",
        description: "أسئلة تظهر أثناء مشاهدة فيديو يوتيوب",
        descriptionEn: "Questions appear while watching a YouTube video",
        color: "text-blue-600 dark:text-blue-400",
        iconBg: "bg-blue-100 dark:bg-blue-900/40",
        border: "border-border",
        hoverBorder: "hover:border-blue-400 hover:shadow-blue-100 dark:hover:shadow-blue-900/30",
        route: "/teacher/video-lesson/new",
      },
      {
        id: "presentation",
        icon: <Monitor className="w-10 h-10" />,
        title: "عرض تفاعلي",
        titleEn: "Interactive Presentation",
        description: "عرض شرائح مع تفاعل الطلاب في الوقت الفعلي",
        descriptionEn: "Slide show with real-time student interaction",
        color: "text-violet-600 dark:text-violet-400",
        iconBg: "bg-violet-100 dark:bg-violet-900/40",
        border: "border-border",
        hoverBorder: "hover:border-violet-400 hover:shadow-violet-100 dark:hover:shadow-violet-900/30",
        route: "/teacher/presentations/new",
      },
      {
        id: "worksheet",
        icon: <Sparkles className="w-10 h-10" />,
        title: "مولّد ورقة العمل الذكي",
        titleEn: "Smart Worksheet Generator",
        description: "أنشئ ورقة عمل احترافية بالذكاء الاصطناعي — جاهزة للطباعة بشعار مدرستك",
        descriptionEn: "Generate a professional worksheet with AI — ready to print with your school logo",
        color: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-100 dark:bg-amber-900/40",
        border: "border-border",
        hoverBorder: "hover:border-amber-400 hover:shadow-amber-100 dark:hover:shadow-amber-900/30",
        badge: "ذكي",
        badgeColor: "bg-amber-400 text-amber-900",
        route: "/teacher/worksheets/create",
      },
      {
        id: "lesson-plan",
        icon: <BookOpen className="w-10 h-10" />,
        title: "خطة درس",
        titleEn: "Lesson Plan",
        description: "خطة درس منظمة بالأهداف والوسائل والتقويم — جاهزة للطباعة",
        descriptionEn: "Structured lesson plan with objectives, methods, and assessment — print-ready",
        color: "text-rose-600 dark:text-rose-400",
        iconBg: "bg-rose-100 dark:bg-rose-900/40",
        border: "border-border",
        hoverBorder: "hover:border-rose-400 hover:shadow-rose-100 dark:hover:shadow-rose-900/30",
        route: "/teacher/lesson-plans/create",
      },
    ],
  },
];

export default function NewActivity() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setLocation("/teacher")}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card hover:bg-muted transition-colors"
          aria-label={isAr ? "رجوع" : "Back"}
        >
          {isAr ? (
            <ArrowRight className="w-4 h-4" />
          ) : (
            <ArrowLeft className="w-4 h-4" />
          )}
        </button>
        <div>
          <h1 className="text-lg font-black text-foreground leading-tight">
            {isAr ? "ماذا تريد أن تنشئ اليوم؟" : "What would you like to create?"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "اختر من بين أنشطة رقمية للطلاب، أو مستندات للطباعة"
              : "Pick from digital activities or print-ready documents"}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.id}>
            {/* Section header */}
            <div className="flex items-start gap-3 mb-4">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl bg-muted ${section.accentColor}`}
              >
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-black text-foreground leading-tight">
                  {isAr ? section.title : section.titleEn}
                </h2>
                <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5 leading-relaxed">
                  {isAr ? section.description : section.descriptionEn}
                </p>
              </div>
            </div>

            {/* Section grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {section.items.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setLocation(type.route)}
                  className={`group relative text-start p-5 rounded-2xl border-2 bg-card shadow-sm transition-all duration-200 ${type.border} ${type.hoverBorder} hover:shadow-md active:scale-[0.98]`}
                >
                  {type.badge && (
                    <span
                      className={`absolute top-3 ${
                        isAr ? "left-3" : "right-3"
                      } px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${
                        type.badgeColor || "bg-amber-400 text-amber-900"
                      }`}
                    >
                      {type.badge}
                    </span>
                  )}

                  <div
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 ${type.iconBg} ${type.color}`}
                  >
                    {type.icon}
                  </div>

                  <h3 className="text-[16px] font-black text-foreground mb-1 leading-tight">
                    {isAr ? type.title : type.titleEn}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {isAr ? type.description : type.descriptionEn}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* Bottom hint */}
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-5 py-4 flex items-start gap-3">
          <Trophy className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {isAr
              ? "نصيحة: ابدأ بنشاط رقمي إن كنت تريد متابعة نتائج الطلاب، واستخدم ورقة العمل وخطة الدرس للحصص داخل الفصل."
              : "Tip: pick a digital activity if you want to track student results, and use the worksheet or lesson plan for in-class lessons."}
          </p>
        </div>
      </main>
    </div>
  );
}
