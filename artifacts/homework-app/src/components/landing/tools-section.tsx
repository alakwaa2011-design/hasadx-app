import { Link } from "wouter";
import { BookOpen, Brain, FileText, Presentation, Video, MonitorPlay, ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

export function ToolsSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  const tools = isAr ? [
    { title: "مولّد خطة الدرس", icon: BookOpen, desc: "حوّل أهدافك إلى خطة واضحة", href: "/teacher/lesson-plans/create" },
    { title: "مولّد الخريطة الذهنية", icon: Brain, desc: "لخّص أي موضوع بصرياً", href: "/teacher/mindmap/create" },
    { title: "عرض تفاعلي", icon: Presentation, desc: "شرائح وأسئلة في مكان واحد", href: "/teacher/presentations/new" },
    { title: "فيديو تفاعلي", icon: Video, desc: "أضف أسئلة داخل الفيديو", href: "/teacher/video-lesson/new" },
    { title: "الشرح الذكي", icon: MonitorPlay, desc: "لوحة تفاعلية لشرح أعمق", href: "/teacher/smart-board" },
    { title: "ورقة عمل", icon: FileText, desc: "صمّم أوراق عمل احترافية", href: "/teacher/worksheets/create" },
  ] : [
    { title: "Lesson Plan Generator", icon: BookOpen, desc: "Turn goals into clear plans", href: "/teacher/lesson-plans/create" },
    { title: "Mind Map Generator", icon: Brain, desc: "Summarize visually", href: "/teacher/mindmap/create" },
    { title: "Interactive Presentation", icon: Presentation, desc: "Slides & questions together", href: "/teacher/presentations/new" },
    { title: "Interactive Video", icon: Video, desc: "Embed questions in videos", href: "/teacher/video-lesson/new" },
    { title: "Smart Explanation", icon: MonitorPlay, desc: "Interactive board for deep dive", href: "/teacher/smart-board" },
    { title: "Worksheet", icon: FileText, desc: "Design professional sheets", href: "/teacher/worksheets/create" },
  ];

  return (
    <section id="tools" className="py-20 lg:py-32 bg-background border-t border-border/50" dir={dir}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-sm font-black text-primary mb-3">
            {isAr ? "أدوات المعلم" : "Teacher Tools"}
          </p>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4">
            {isAr ? "كل ما يحتاجه المعلم في منصة واحدة" : "Everything a teacher needs in one platform"}
          </h2>
          <p className="text-lg text-muted-foreground font-medium">
            {isAr
              ? "أدوات أساسية صُممت بعناية لتوفير وقتك وزيادة جودة تفاعل المتعلمين."
              : "Essential tools carefully designed to save your time and increase learners' interaction quality."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {tools.map((tool, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={tool.href} className="block h-full bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-all hover:-translate-y-1 group">
                <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-primary">
                  <tool.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{tool.title}</h3>
                <p className="text-muted-foreground font-medium">{tool.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center">
          <Link href="/register" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-secondary text-secondary-foreground font-black text-lg hover:bg-secondary/90 transition-all hover:-translate-y-1 shadow-lg shadow-secondary/20">
            {isAr ? "استكشف جميع أدوات المعلم" : "Explore all teacher tools"}
            {isAr ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
          </Link>
        </div>
      </div>
    </section>
  );
}