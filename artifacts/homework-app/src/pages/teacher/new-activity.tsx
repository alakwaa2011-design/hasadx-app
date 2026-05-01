import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import {
  FileText,
  Mic,
  Play,
  Monitor,
  Zap,
  ArrowRight,
  ArrowLeft,
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
  route: string;
}

const ACTIVITY_TYPES: ActivityType[] = [
  {
    id: "assignment",
    icon: <FileText className="w-12 h-12" />,
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
    icon: <Mic className="w-12 h-12" />,
    title: "إملاء صوتي",
    titleEn: "Audio Dictation",
    description: "يسمع الطالب ويكتب — اختبار حقيقي للحفظ",
    descriptionEn: "Student listens and types — a real retention test",
    color: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-100 dark:bg-teal-900/40",
    border: "border-border",
    hoverBorder: "hover:border-teal-400 hover:shadow-teal-100 dark:hover:shadow-teal-900/30",
    badge: "جديد",
    route: "/teacher/new/dictation",
  },
  {
    id: "video",
    icon: <Play className="w-12 h-12" />,
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
    icon: <Monitor className="w-12 h-12" />,
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
    id: "live",
    icon: <Zap className="w-12 h-12" />,
    title: "لعبة مباشرة",
    titleEn: "Live Game",
    description: "ابدأ مسابقة الآن مع طلابك",
    descriptionEn: "Start a competition right now with your students",
    color: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    border: "border-border",
    hoverBorder: "hover:border-amber-400 hover:shadow-amber-100 dark:hover:shadow-amber-900/30",
    route: "/teacher?liveGame=1",
  },
];

export default function NewActivity() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const dir = isAr ? "rtl" : "ltr";

  return (
    <div
      className="min-h-screen bg-background"
      dir={dir}
    >
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
            {isAr ? "اختر نوع النشاط" : "Choose Activity Type"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isAr ? "ابدأ بإنشاء نشاط تعليمي جديد" : "Start by creating a new educational activity"}
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ACTIVITY_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setLocation(type.route)}
              className={`group relative text-start p-5 rounded-2xl border-2 bg-card shadow-sm transition-all duration-200 ${type.border} ${type.hoverBorder} hover:shadow-md active:scale-[0.98]`}
            >
              {/* "جديد" badge */}
              {type.badge && (
                <span className="absolute top-3 end-3 px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 text-[10px] font-black tracking-wide">
                  {type.badge}
                </span>
              )}

              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 ${type.iconBg} ${type.color}`}>
                {type.icon}
              </div>

              {/* Text */}
              <h2 className="text-[17px] font-black text-foreground mb-1">
                {isAr ? type.title : type.titleEn}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isAr ? type.description : type.descriptionEn}
              </p>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
