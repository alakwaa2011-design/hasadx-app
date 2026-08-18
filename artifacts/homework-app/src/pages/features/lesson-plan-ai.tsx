/* /features/lesson-plan-ai — مولّد خطة الدرس بالذكاء الاصطناعي */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, BookOpen, Clock, Target, ListChecks,
  FileText, CheckCircle2, ArrowLeft, Printer, GraduationCap,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import { useI18n } from "@/lib/i18n";

export default function FeatureLessonPlanAI() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  useSeo({
    title: isAr
      ? "مولّد خطة الدرس بالذكاء الاصطناعي — خطة متكاملة في دقائق | حصاد"
      : "AI Lesson Plan Generator — Complete Lesson Plans in Minutes | Hasad",
    description: isAr
      ? "ولّد خطة درس احترافية بالذكاء الاصطناعي في دقائق: أهداف تعليمية، خطوات الدرس، أنشطة الطلاب، التقييم، والموارد — كل ذلك بلغة عربية واضحة وجاهز للطباعة."
      : "Generate a professional AI-powered lesson plan in minutes: learning objectives, lesson steps, student activities, assessment, and resources — clear, ready to print or edit.",
    canonicalPath: "/features/lesson-plan-ai",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": isAr
        ? "مولّد خطة الدرس بالذكاء الاصطناعي — حصاد"
        : "AI Lesson Plan Generator — Hasad",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": isAr ? "ar" : "en",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": isAr
        ? "أداة توليد خطط دروس احترافية بالذكاء الاصطناعي — أهداف ومراحل وأنشطة وتقييم في دقائق."
        : "AI-powered lesson plan generation tool — objectives, stages, activities, and assessment in minutes.",
      "url": "https://hasaadx.com/features/lesson-plan-ai",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "lesson-plan-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("lesson-plan-schema")?.remove(); };
  }, [isAr]);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir={dir}>
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              {isAr ? "ذكاء اصطناعي · خطة الدرس" : "AI · Lesson Plan"}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              {isAr
                ? "مولّد خطة الدرس بالذكاء الاصطناعي — خطة درس متكاملة في دقائق"
                : "AI Lesson Plan Generator — A Complete Lesson Plan in Minutes"}
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              {isAr ? (
                <>
                  لم تعد خطة الدرس تستغرق ساعات. مع <strong>مولّد خطة الدرس بالذكاء الاصطناعي في حصاد</strong>،
                  أدخل عنوان الدرس والمرحلة والمدة الزمنية، واحصل في دقيقتين على خطة كاملة
                  بالأهداف التعليمية وخطوات الدرس والأنشطة ووسائل التقييم — جاهزة للطباعة أو التعديل.
                </>
              ) : (
                <>
                  Lesson planning no longer has to take hours. With <strong>Hasad's AI Lesson Plan Generator</strong>,
                  simply enter the lesson title, grade level, and duration, and get a complete plan in two minutes —
                  including learning objectives, lesson steps, activities, and assessment tools, ready to print or edit.
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                {isAr ? "جرّب المولّد مجاناً" : "Try the Generator for Free"}
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/worksheet-ai" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                {isAr ? "أيضاً: مولّد أوراق العمل" : "Also: Worksheet Generator"}
              </Link>
            </div>
          </header>

          {/* ما هي */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              {isAr ? "ما الذي يُنشئه المولّد بالضبط؟" : "What Does the Generator Produce?"}
            </h2>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {(isAr ? [
                { icon: <Target className="w-5 h-5" />, title: "الأهداف التعليمية", body: "أهداف واضحة وقابلة للقياس مُصاغة بصيغة (يستطيع الطالب أن…) وفق تصنيف بلوم." },
                { icon: <ListChecks className="w-5 h-5" />, title: "خطوات الدرس المفصّلة", body: "التمهيد — العرض — التطبيق — التقييم — الإغلاق، مع توقيت مقترح لكل مرحلة." },
                { icon: <BookOpen className="w-5 h-5" />, title: "أنشطة الطلاب", body: "أنشطة فردية وجماعية مناسبة للمرحلة ومرتبطة بأهداف الدرس." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "وسائل التقييم", body: "أدوات تقييم مقترحة — أسئلة شفهية، ورقة عمل، ملاحظة مباشرة." },
                { icon: <FileText className="w-5 h-5" />, title: "الوسائل التعليمية", body: "قائمة بالوسائل والمواد اللازمة لتنفيذ الدرس بنجاح." },
                { icon: <GraduationCap className="w-5 h-5" />, title: "الفروق الفردية", body: "مقترحات لاستيعاب الطلاب المتقدمين والمحتاجين لدعم إضافي." },
              ] : [
                { icon: <Target className="w-5 h-5" />, title: "Learning Objectives", body: "Clear, measurable objectives framed as 'The student will be able to…' aligned with Bloom's Taxonomy." },
                { icon: <ListChecks className="w-5 h-5" />, title: "Detailed Lesson Steps", body: "Introduction — Presentation — Application — Assessment — Closure, with a suggested time for each phase." },
                { icon: <BookOpen className="w-5 h-5" />, title: "Student Activities", body: "Individual and group activities appropriate for the grade level, tied to the lesson objectives." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "Assessment Tools", body: "Suggested assessment methods — oral questions, worksheets, direct observation." },
                { icon: <FileText className="w-5 h-5" />, title: "Teaching Materials", body: "A list of resources and materials needed to successfully deliver the lesson." },
                { icon: <GraduationCap className="w-5 h-5" />, title: "Differentiated Instruction", body: "Suggestions for accommodating advanced students and those needing additional support." },
              ]).map(({ icon, title, body }) => (
                <div key={title} className="flex items-start gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">{icon}</div>
                  <div>
                    <h3 className="font-bold text-emerald-900 mb-1">{title}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* كيف يعمل */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              {isAr ? "خطوات بسيطة للحصول على خطة كاملة" : "Simple Steps to Get a Complete Plan"}
            </h2>
            <div className="grid md:grid-cols-4 gap-4">
              {(isAr ? [
                { step: "١", title: "عنوان الدرس", body: "اكتب عنوان الدرس أو الموضوع الرئيسي." },
                { step: "٢", title: "المرحلة والمادة", body: "حدّد المرحلة الدراسية والمادة." },
                { step: "٣", title: "المدة والأهداف", body: "أدخل مدة الحصة وأي تفضيلات خاصة." },
                { step: "٤", title: "اطبع أو عدّل", body: "احفظ الخطة أو عدّل عليها وطبعها." },
              ] : [
                { step: "1", title: "Lesson Title", body: "Enter the lesson title or main topic." },
                { step: "2", title: "Grade & Subject", body: "Specify the grade level and subject area." },
                { step: "3", title: "Duration & Goals", body: "Enter the class duration and any special preferences." },
                { step: "4", title: "Print or Edit", body: "Save the plan, make edits, and print it." },
              ]).map(({ step, title, body }) => (
                <div key={step} className="p-4 bg-white border border-emerald-100 rounded-xl text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-extrabold text-lg flex items-center justify-center mx-auto mb-3">{step}</div>
                  <h3 className="font-bold text-emerald-900 mb-1 text-sm">{title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* مميزات إضافية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              {isAr ? "ما يُميّز مولّد حصاد" : "What Sets Hasad's Generator Apart"}
            </h2>
            <ul className="space-y-3">
              {(isAr ? [
                "الأهداف تُصاغ وفق تصنيف بلوم المعدّل مع مراعاة المنهج الوطني.",
                "الخطة تراعي المرحلة العمرية وتقترح طرق تدريس مناسبة (استقرائية، استنتاجية، نشطة).",
                "يمكن توليد عدة خطط بأساليب تدريس مختلفة للمادة نفسها ومقارنتها.",
                "كل الخطط محفوظة في مكتبتك للرجوع إليها وتعديلها في أي وقت.",
                "جاهزة للطباعة بتنسيق احترافي مناسب للملفات الرسمية والمشرفين.",
              ] : [
                "Objectives are framed using the revised Bloom's Taxonomy, aligned with the national curriculum.",
                "The plan accounts for the students' age group and suggests suitable teaching methods (inductive, deductive, active learning).",
                "Multiple plans with different teaching styles can be generated for the same topic and compared.",
                "All plans are saved to your library for easy retrieval and editing at any time.",
                "Ready to print in a professional format suitable for official records and supervisors.",
              ]).map((text) => (
                <li key={text} className="flex items-start gap-2 text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* روابط داخلية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              {isAr ? "أدوات الذكاء الاصطناعي الأخرى في حصاد" : "Other AI Tools in Hasad"}
            </h2>
            <div className="flex flex-wrap gap-3">
              {(isAr ? [
                { href: "/features/worksheet-ai", label: "مولّد أوراق العمل" },
                { href: "/features/presentations-ai", label: "العروض التفاعلية بالذكاء الاصطناعي" },
                { href: "/features/interactive-video", label: "الفيديو التعليمي التفاعلي" },
                { href: "/features/wameeth", label: "وميض — مسابقات مباشرة" },
                { href: "/features/smart-whiteboard", label: "السبورة الذكية" },
              ] : [
                { href: "/features/worksheet-ai", label: "Worksheet Generator" },
                { href: "/features/presentations-ai", label: "AI Interactive Presentations" },
                { href: "/features/interactive-video", label: "Interactive Educational Video" },
                { href: "/features/wameeth", label: "Wameeth — Live Quizzes" },
                { href: "/features/smart-whiteboard", label: "Smart Whiteboard" },
              ]).map(({ href, label }) => (
                <Link key={href} href={href} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              {isAr ? "وفّر وقت التحضير — ابدأ الآن" : "Save Prep Time — Start Now"}
            </h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              {isAr
                ? "أنشئ حسابك مجاناً وولّد أول خطة درس بالذكاء الاصطناعي في دقيقتين."
                : "Create your free account and generate your first AI lesson plan in two minutes."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">
                {isAr ? "ابدأ مجاناً" : "Get Started for Free"} <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/about" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">
                {isAr ? "تعرّف على حصاد" : "Learn About Hasad"}
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
