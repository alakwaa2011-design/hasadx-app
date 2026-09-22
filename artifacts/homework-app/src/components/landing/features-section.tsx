import { BookOpen, MonitorPlay, FileText, CheckCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function FeaturesSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  
  const features = [
    {
      icon: <BookOpen className="w-6 h-6" />,
      titleAr: "تخطيط الدروس بذكاء",
      titleEn: "Smart Lesson Planning",
      descAr: "حوّل أهدافك التعليمية إلى خطة درس متكاملة بنقرة واحدة بمساعدة الذكاء الاصطناعي.",
      descEn: "Turn your learning objectives into a complete lesson plan with one click using AI."
    },
    {
      icon: <MonitorPlay className="w-6 h-6" />,
      titleAr: "أنشطة تفاعلية وألعاب",
      titleEn: "Interactive Activities & Games",
      descAr: "اصنع مسابقات، ألعاب، وغرف هروب تعليمية تجعل حصتك أكثر متعة وتفاعلاً.",
      descEn: "Create quizzes, games, and educational escape rooms that make your class more fun."
    },
    {
      icon: <FileText className="w-6 h-6" />,
      titleAr: "أوراق عمل وعروض تقديمية",
      titleEn: "Worksheets & Presentations",
      descAr: "ولّد أوراق عمل جاهزة للطباعة وعروض تقديمية تفاعلية تتوافق مع محتوى درسك.",
      descEn: "Generate print-ready worksheets and interactive presentations aligned with your lesson."
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      titleAr: "تقارير وتحليل النتائج",
      titleEn: "Reports & Result Analysis",
      descAr: "راقب تقدم طلابك، واعرف نقاط القوة والضعف من خلال تقارير فورية ومفصلة.",
      descEn: "Monitor student progress and identify strengths and weaknesses through instant reports."
    }
  ];

  return (
    <section className="py-16 md:py-24" dir={dir}>
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
            {isAr ? "ماذا يمكنك أن تفعل مع حصاد؟" : "What can you do with Hasaad?"}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
            {isAr 
              ? "مجموعة متكاملة من الأدوات المصممة خصيصاً لتوفير وقت المعلم ورفع مستوى التفاعل في الغرفة الصفية."
              : "A complete set of tools designed specifically to save teachers' time and increase classroom engagement."}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feat, i) => (
            <div key={i} className="group bg-card hover:bg-muted/30 border border-border hover:border-secondary/30 rounded-2xl p-8 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-secondary/20 group-hover:text-secondary transition-all">
                {feat.icon}
              </div>
              <h3 className="text-xl font-black text-foreground mb-3">{isAr ? feat.titleAr : feat.titleEn}</h3>
              <p className="text-muted-foreground leading-relaxed font-medium text-lg">
                {isAr ? feat.descAr : feat.descEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
