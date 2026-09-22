import { Link } from "wouter";
import { BookOpen, Brain, FileText, Presentation, Video } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function ToolsSection() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";
  
  const tools = isAr ? [
    {
      title: "مولّد خطة الدرس",
      desc: "حوّل أهداف الدرس إلى خطة واضحة قابلة للتخصيص.",
      Icon: BookOpen,
      href: "/teacher/lesson-plans/create", // mapped to existing creation route
    },
    {
      title: "مولّد الخريطة الذهنية",
      desc: "حوّل أي موضوع إلى خريطة ذهنية بصرية في لحظات.",
      Icon: Brain,
      href: "/teacher/mindmap/create",
    },
    {
      title: "ورقة عمل",
      desc: "صمّم ورقة عمل احترافية للطباعة بمساعدة الذكاء الاصطناعي.",
      Icon: FileText,
      href: "/teacher/worksheets/create",
    },
    {
      title: "عرض تفاعلي",
      desc: "أنشئ عرضاً تفاعلياً يجمع الشرائح والأسئلة والأنشطة.",
      Icon: Presentation,
      href: "/teacher/presentations/new",
    },
    {
      title: "درس فيديو",
      desc: "أضف أسئلة إلى لحظات محددة داخل الفيديو.",
      Icon: Video,
      href: "/teacher/video-lesson/new",
    },
  ] : [
    {
      title: "Lesson Plan Generator",
      desc: "Turn your goals into a clear, customizable plan.",
      Icon: BookOpen,
      href: "/teacher/lesson-plans/create",
    },
    {
      title: "Mind Map Generator",
      desc: "Turn any topic into a visual mind map in seconds.",
      Icon: Brain,
      href: "/teacher/mindmap/create",
    },
    {
      title: "Worksheet Builder",
      desc: "Design professional print-ready worksheets with AI.",
      Icon: FileText,
      href: "/teacher/worksheets/create",
    },
    {
      title: "Interactive Presentation",
      desc: "Create an interactive presentation combining slides, questions, and activities.",
      Icon: Presentation,
      href: "/teacher/presentations/new",
    },
    {
      title: "Video Lesson",
      desc: "Add questions to specific moments inside a video.",
      Icon: Video,
      href: "/teacher/video-lesson/new",
    },
  ];

  const tones = [
    "bg-[hsl(145,55%,93%)] text-[hsl(145,55%,28%)]",
    "bg-[hsl(43,90%,93%)] text-[hsl(38,75%,38%)]",
    "bg-[hsl(220,75%,95%)] text-[hsl(220,55%,42%)]",
    "bg-[hsl(280,55%,95%)] text-[hsl(280,40%,42%)]",
    "bg-[hsl(160,55%,93%)] text-[hsl(160,55%,28%)]",
  ];

  return (
    <section id="tools" className="border-t border-border bg-[#fbfcf8] dark:bg-background py-16 sm:py-24" dir={dir}>
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-black text-primary">
            {isAr ? "أدوات المعلم" : "Teacher tools"}
          </p>
          <h2 className="mt-2 text-3xl font-black text-foreground sm:text-4xl">
            {isAr ? "أدوات حصاد الذكية للمعلم" : "Hasad's smart tools for teachers"}
          </h2>
          <p className="mt-3 text-lg leading-8 text-muted-foreground font-medium">
            {isAr
              ? "خطط لدرسك، اصنع محتواك، وشارك المتعلمين من مكان واحد."
              : "Plan lessons, create content, and engage learners from one place."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {tools.map((tool, i) => (
            <Link
              href={tool.href}
              key={tool.title}
              className="bg-card group rounded-3xl p-6 border border-border shadow-sm transition hover:-translate-y-1 hover:shadow-lg hover:border-primary/20"
            >
              <div className={`inline-flex rounded-xl p-3 mb-4 transition group-hover:scale-110 ${tones[i % tones.length]}`}>
                <tool.Icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{tool.title}</h3>
              <p className="text-sm text-muted-foreground font-medium leading-relaxed">{tool.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}