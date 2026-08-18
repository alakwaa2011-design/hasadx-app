/* /features/worksheet-ai — مولّد أوراق العمل بالذكاء الاصطناعي */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, FileText, Layers, Clock, Printer,
  GraduationCap, CheckCircle2, ArrowLeft, Sliders, Globe,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import { useI18n } from "@/lib/i18n";

export default function FeatureWorksheetAI() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  useSeo({
    title: isAr
      ? "مولّد أوراق العمل بالذكاء الاصطناعي | منصة حصاد للمعلمين"
      : "AI Worksheet Generator | Hasad Platform for Teachers",
    description: isAr
      ? "أنشئ ورقة عمل احترافية بالذكاء الاصطناعي في أقل من دقيقة. اختر الموضوع والمرحلة ونوع الأسئلة، وحصاد يبني لك ورقة جاهزة للطباعة أو المشاركة الإلكترونية."
      : "Create a professional AI-powered worksheet in under a minute. Choose the topic, grade level, and question types — Hasad builds a print-ready or shareable worksheet for you.",
    canonicalPath: "/features/worksheet-ai",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": isAr
        ? "مولّد أوراق العمل بالذكاء الاصطناعي — حصاد"
        : "AI Worksheet Generator — Hasad",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": isAr ? "ar" : "en",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": isAr
        ? "أداة ذكاء اصطناعي لإنشاء أوراق عمل تعليمية احترافية في دقيقة — اختيار متعدد، صح وخطأ، إكمال الفراغ، أسئلة مفتوحة."
        : "An AI tool for creating professional educational worksheets in minutes — multiple choice, true/false, fill-in-the-blank, and open-ended questions.",
      "url": "https://hasaadx.com/features/worksheet-ai",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "worksheet-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("worksheet-schema")?.remove(); };
  }, [isAr]);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir={dir}>
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              {isAr ? "ذكاء اصطناعي · أوراق العمل" : "AI · Worksheets"}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              {isAr
                ? "مولّد أوراق العمل بالذكاء الاصطناعي — ورقة عمل احترافية في أقل من دقيقة"
                : "AI Worksheet Generator — A Professional Worksheet in Under a Minute"}
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              {isAr ? (
                <>
                  أنهِ ساعات التحضير في دقائق. أدخل موضوع الدرس والمرحلة الدراسية وعدد الأسئلة،
                  وسيبني لك <strong>الذكاء الاصطناعي في حصاد</strong> ورقة عمل متكاملة بأنواع أسئلة متنوعة،
                  جاهزة للطباعة أو المشاركة الإلكترونية مع طلابك.
                </>
              ) : (
                <>
                  Turn hours of preparation into minutes. Enter your lesson topic, grade level, and number
                  of questions — <strong>Hasad's AI</strong> builds a complete worksheet with varied question
                  types, ready to print or share digitally with your students.
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                {isAr ? "جرّب المولّد مجاناً" : "Try the Generator for Free"}
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/lesson-plan-ai" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                {isAr ? "مولّد خطة الدرس أيضاً" : "Also: Lesson Plan Generator"}
              </Link>
            </div>
          </header>

          {/* كيف يعمل */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              {isAr ? "كيف يعمل مولّد أوراق العمل؟" : "How Does the Worksheet Generator Work?"}
            </h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {(isAr ? [
                { step: "١", title: "حدّد الموضوع", body: "اكتب عنوان الدرس أو موضوعه، واختر المرحلة الدراسية ومستوى الصعوبة." },
                { step: "٢", title: "اختر نوع الأسئلة", body: "اختيار متعدد، صح وخطأ، إكمال الفراغ، أسئلة مفتوحة، أو مزيج منها." },
                { step: "٣", title: "اطبع أو شارك", body: "في ثوانٍ تظهر ورقة العمل كاملة — احفظها أو شاركها رابطاً مع طلابك." },
              ] : [
                { step: "1", title: "Define the Topic", body: "Enter the lesson title or subject, then choose the grade level and difficulty." },
                { step: "2", title: "Choose Question Types", body: "Multiple choice, true/false, fill-in-the-blank, open-ended, or a mix of all." },
                { step: "3", title: "Print or Share", body: "Your complete worksheet appears in seconds — save it or share a link with your students." },
              ]).map(({ step, title, body }) => (
                <div key={step} className="p-5 bg-white border border-emerald-100 rounded-xl text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-extrabold text-lg flex items-center justify-center mx-auto mb-3">{step}</div>
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                {isAr ? (
                  <>
                    المولّد لا يكتفي بتوليد أسئلة عشوائية — بل يصمّم الورقة بناءً على <strong>المنهج العربي وأهداف الدرس</strong>،
                    مراعياً مستوى الطلاب واحتياجات المرحلة. كل ورقة يمكن تعديلها قبل الطباعة.
                  </>
                ) : (
                  <>
                    The generator doesn't just produce random questions — it designs the worksheet based on{" "}
                    <strong>the curriculum and lesson objectives</strong>, taking into account student level and
                    grade requirements. Every worksheet can be edited before printing.
                  </>
                )}
              </p>
            </div>
          </section>

          {/* المميزات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              {isAr ? "ما يميّز مولّد حصاد" : "What Sets Hasad's Generator Apart"}
            </h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {(isAr ? [
                { icon: <Sparkles className="w-5 h-5" />, title: "ذكاء اصطناعي مُدرَّب على المناهج العربية", body: "النماذج مُعدَّلة لتفهم المنهج الدراسي العربي وتُنتج أسئلة مناسبة وليس مجرد ترجمة." },
                { icon: <Layers className="w-5 h-5" />, title: "7 قوالب بصرية", body: "اختر بين قوالب متنوعة لتصميم ورقة العمل — جادة أكاديمية أو ملوّنة وممتعة للصغار." },
                { icon: <Sliders className="w-5 h-5" />, title: "تحكم كامل في الأسئلة", body: "عدّل أي سؤال، أضف أسئلة يدوياً، أو أعد توليد الأسئلة التي لا تناسبك." },
                { icon: <Printer className="w-5 h-5" />, title: "جاهزة للطباعة فوراً", body: "تخرج الورقة بتنسيق مثالي للطباعة A4 مع نموذج الإجابة المنفصل." },
                { icon: <Clock className="w-5 h-5" />, title: "من ساعات إلى دقيقة", body: "ما كان يأخذ ساعة في التحضير يصبح جاهزاً في أقل من دقيقة." },
                { icon: <Globe className="w-5 h-5" />, title: "دعم RTL وعربية كاملة", body: "النص والمحتوى والتصميم كلها من اليمين لليسار دون أي مشكلة في التنسيق." },
              ] : [
                { icon: <Sparkles className="w-5 h-5" />, title: "AI Trained on Arabic Curricula", body: "Models are fine-tuned to understand Arabic curricula and produce fitting questions — not mere translations." },
                { icon: <Layers className="w-5 h-5" />, title: "7 Visual Templates", body: "Choose from a variety of worksheet designs — serious academic layouts or colourful fun styles for younger students." },
                { icon: <Sliders className="w-5 h-5" />, title: "Full Question Control", body: "Edit any question, add questions manually, or regenerate ones that don't suit you." },
                { icon: <Printer className="w-5 h-5" />, title: "Instantly Print-Ready", body: "The worksheet is exported in a perfect A4 print format, with a separate answer key." },
                { icon: <Clock className="w-5 h-5" />, title: "From Hours to a Minute", body: "What used to take an hour of preparation is ready in under a minute." },
                { icon: <Globe className="w-5 h-5" />, title: "Full RTL & Arabic Support", body: "Text, content, and layout all flow right-to-left with no formatting issues." },
              ]).map(({ icon, title, body }) => (
                <li key={title} className="flex items-start gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm list-none">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">{icon}</div>
                  <div>
                    <h3 className="font-bold text-emerald-900 mb-1">{title}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* حالات الاستخدام */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              {isAr ? "أمثلة على الاستخدام" : "Usage Examples"}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {(isAr ? [
                { icon: <GraduationCap className="w-5 h-5" />, title: "مراجعة نهاية الوحدة", body: "ورقة شاملة بكل مفاهيم الوحدة الدراسية مرتّبة من الأسهل للأصعب." },
                { icon: <FileText className="w-5 h-5" />, title: "واجب بيتي", body: "أنشئ واجباً متنوعاً مع نموذج إجابة منفصل يُسهّل التصحيح." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "اختبار قصير (Quiz)", body: "اختبار سريع لقياس فهم الطلاب في بداية الحصة أو نهايتها." },
              ] : [
                { icon: <GraduationCap className="w-5 h-5" />, title: "End-of-Unit Review", body: "A comprehensive worksheet covering all unit concepts, ordered from easiest to most challenging." },
                { icon: <FileText className="w-5 h-5" />, title: "Homework Assignment", body: "Create a varied homework sheet with a separate answer key to simplify marking." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "Quick Quiz", body: "A rapid assessment to gauge student understanding at the start or end of a lesson." },
              ]).map(({ icon, title, body }) => (
                <div key={title} className="p-5 bg-white border border-emerald-100 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">{icon}</div>
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* روابط داخلية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              {isAr ? "أدوات الذكاء الاصطناعي الأخرى في حصاد" : "Other AI Tools in Hasad"}
            </h2>
            <div className="flex flex-wrap gap-3">
              {(isAr ? [
                { href: "/features/lesson-plan-ai", label: "مولّد خطة الدرس" },
                { href: "/features/presentations-ai", label: "العروض التفاعلية بالذكاء الاصطناعي" },
                { href: "/features/interactive-video", label: "الفيديو التعليمي التفاعلي" },
                { href: "/features/wameeth", label: "وميض — المسابقات المباشرة" },
                { href: "/features/games", label: "الألعاب التعليمية" },
              ] : [
                { href: "/features/lesson-plan-ai", label: "Lesson Plan Generator" },
                { href: "/features/presentations-ai", label: "AI Interactive Presentations" },
                { href: "/features/interactive-video", label: "Interactive Educational Video" },
                { href: "/features/wameeth", label: "Wameeth — Live Competitions" },
                { href: "/features/games", label: "Educational Games" },
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
              {isAr ? "وفّر وقت التحضير — ابدأ الآن" : "Save Preparation Time — Start Now"}
            </h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              {isAr
                ? "أنشئ أول ورقة عمل بالذكاء الاصطناعي مجاناً وشاهد الفرق بنفسك."
                : "Create your first AI-powered worksheet for free and see the difference for yourself."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">
                {isAr ? "ابدأ مجاناً" : "Get Started Free"} <ArrowLeft className="w-4 h-4" />
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
