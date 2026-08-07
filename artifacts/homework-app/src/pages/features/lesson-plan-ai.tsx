/* /features/lesson-plan-ai — مولّد خطة الدرس بالذكاء الاصطناعي */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, BookOpen, Clock, Target, ListChecks,
  FileText, CheckCircle2, ArrowLeft, Printer, GraduationCap,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function FeatureLessonPlanAI() {
  useSeo({
    title: "مولّد خطة الدرس بالذكاء الاصطناعي — خطة متكاملة في دقائق | حصاد",
    description:
      "ولّد خطة درس احترافية بالذكاء الاصطناعي في دقائق: أهداف تعليمية، خطوات الدرس، أنشطة الطلاب، التقييم، والموارد — كل ذلك بلغة عربية واضحة وجاهز للطباعة.",
    canonicalPath: "/features/lesson-plan-ai",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "مولّد خطة الدرس بالذكاء الاصطناعي — حصاد",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": "ar",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": "أداة توليد خطط دروس احترافية بالذكاء الاصطناعي — أهداف ومراحل وأنشطة وتقييم في دقائق.",
      "url": "https://hasadx.com/features/lesson-plan-ai",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "lesson-plan-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("lesson-plan-schema")?.remove(); };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir="rtl">
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              ذكاء اصطناعي · خطة الدرس
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              مولّد خطة الدرس بالذكاء الاصطناعي — خطة درس متكاملة في دقائق
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              لم تعد خطة الدرس تستغرق ساعات. مع <strong>مولّد خطة الدرس بالذكاء الاصطناعي في حصاد</strong>،
              أدخل عنوان الدرس والمرحلة والمدة الزمنية، واحصل في دقيقتين على خطة كاملة
              بالأهداف التعليمية وخطوات الدرس والأنشطة ووسائل التقييم — جاهزة للطباعة أو التعديل.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                جرّب المولّد مجاناً
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/worksheet-ai" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                أيضاً: مولّد أوراق العمل
              </Link>
            </div>
          </header>

          {/* ما هي */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">ما الذي يُنشئه المولّد بالضبط؟</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {[
                { icon: <Target className="w-5 h-5" />, title: "الأهداف التعليمية", body: "أهداف واضحة وقابلة للقياس مُصاغة بصيغة (يستطيع الطالب أن…) وفق تصنيف بلوم." },
                { icon: <ListChecks className="w-5 h-5" />, title: "خطوات الدرس المفصّلة", body: "التمهيد — العرض — التطبيق — التقييم — الإغلاق، مع توقيت مقترح لكل مرحلة." },
                { icon: <BookOpen className="w-5 h-5" />, title: "أنشطة الطلاب", body: "أنشطة فردية وجماعية مناسبة للمرحلة ومرتبطة بأهداف الدرس." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "وسائل التقييم", body: "أدوات تقييم مقترحة — أسئلة شفهية، ورقة عمل، ملاحظة مباشرة." },
                { icon: <FileText className="w-5 h-5" />, title: "الوسائل التعليمية", body: "قائمة بالوسائل والمواد اللازمة لتنفيذ الدرس بنجاح." },
                { icon: <GraduationCap className="w-5 h-5" />, title: "الفروق الفردية", body: "مقترحات لاستيعاب الطلاب المتقدمين والمحتاجين لدعم إضافي." },
              ].map(({ icon, title, body }) => (
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
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">خطوات بسيطة للحصول على خطة كاملة</h2>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { step: "١", title: "عنوان الدرس", body: "اكتب عنوان الدرس أو الموضوع الرئيسي." },
                { step: "٢", title: "المرحلة والمادة", body: "حدّد المرحلة الدراسية والمادة." },
                { step: "٣", title: "المدة والأهداف", body: "أدخل مدة الحصة وأي تفضيلات خاصة." },
                { step: "٤", title: "اطبع أو عدّل", body: "احفظ الخطة أو عدّل عليها وطبعها." },
              ].map(({ step, title, body }) => (
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
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">ما يُميّز مولّد حصاد</h2>
            <ul className="space-y-3">
              {[
                "الأهداف تُصاغ وفق تصنيف بلوم المعدّل مع مراعاة المنهج الوطني.",
                "الخطة تراعي المرحلة العمرية وتقترح طرق تدريس مناسبة (استقرائية، استنتاجية، نشطة).",
                "يمكن توليد عدة خطط بأساليب تدريس مختلفة للمادة نفسها ومقارنتها.",
                "كل الخطط محفوظة في مكتبتك للرجوع إليها وتعديلها في أي وقت.",
                "جاهزة للطباعة بتنسيق احترافي مناسب للملفات الرسمية والمشرفين.",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2 text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* روابط داخلية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">أدوات الذكاء الاصطناعي الأخرى في حصاد</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: "/features/worksheet-ai", label: "مولّد أوراق العمل" },
                { href: "/features/presentations-ai", label: "العروض التفاعلية بالذكاء الاصطناعي" },
                { href: "/features/interactive-video", label: "الفيديو التعليمي التفاعلي" },
                { href: "/features/wameeth", label: "وميض — مسابقات مباشرة" },
                { href: "/features/smart-whiteboard", label: "السبورة الذكية" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">وفّر وقت التحضير — ابدأ الآن</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              أنشئ حسابك مجاناً وولّد أول خطة درس بالذكاء الاصطناعي في دقيقتين.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">
                ابدأ مجاناً <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/about" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">
                تعرّف على حصاد
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
