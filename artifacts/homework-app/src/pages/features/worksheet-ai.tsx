/* /features/worksheet-ai — مولّد أوراق العمل بالذكاء الاصطناعي */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, FileText, Layers, Clock, Printer,
  GraduationCap, CheckCircle2, ArrowLeft, Sliders, Globe,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function FeatureWorksheetAI() {
  useSeo({
    title: "مولّد أوراق العمل بالذكاء الاصطناعي | منصة حصاد للمعلمين",
    description:
      "أنشئ ورقة عمل احترافية بالذكاء الاصطناعي في أقل من دقيقة. اختر الموضوع والمرحلة ونوع الأسئلة، وحصاد يبني لك ورقة جاهزة للطباعة أو المشاركة الإلكترونية.",
    canonicalPath: "/features/worksheet-ai",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "مولّد أوراق العمل بالذكاء الاصطناعي — حصاد",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": "ar",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": "أداة ذكاء اصطناعي لإنشاء أوراق عمل تعليمية احترافية في دقيقة — اختيار متعدد، صح وخطأ، إكمال الفراغ، أسئلة مفتوحة.",
      "url": "https://hasadx.com/features/worksheet-ai",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "worksheet-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("worksheet-schema")?.remove(); };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir="rtl">
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              ذكاء اصطناعي · أوراق العمل
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              مولّد أوراق العمل بالذكاء الاصطناعي — ورقة عمل احترافية في أقل من دقيقة
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              أنهِ ساعات التحضير في دقائق. أدخل موضوع الدرس والمرحلة الدراسية وعدد الأسئلة،
              وسيبني لك <strong>الذكاء الاصطناعي في حصاد</strong> ورقة عمل متكاملة بأنواع أسئلة متنوعة،
              جاهزة للطباعة أو المشاركة الإلكترونية مع طلابك.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                جرّب المولّد مجاناً
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/lesson-plan-ai" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                مولّد خطة الدرس أيضاً
              </Link>
            </div>
          </header>

          {/* كيف يعمل */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">كيف يعمل مولّد أوراق العمل؟</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {[
                { step: "١", title: "حدّد الموضوع", body: "اكتب عنوان الدرس أو موضوعه، واختر المرحلة الدراسية ومستوى الصعوبة." },
                { step: "٢", title: "اختر نوع الأسئلة", body: "اختيار متعدد، صح وخطأ، إكمال الفراغ، أسئلة مفتوحة، أو مزيج منها." },
                { step: "٣", title: "اطبع أو شارك", body: "في ثوانٍ تظهر ورقة العمل كاملة — احفظها أو شاركها رابطاً مع طلابك." },
              ].map(({ step, title, body }) => (
                <div key={step} className="p-5 bg-white border border-emerald-100 rounded-xl text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-extrabold text-lg flex items-center justify-center mx-auto mb-3">{step}</div>
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                المولّد لا يكتفي بتوليد أسئلة عشوائية — بل يصمّم الورقة بناءً على <strong>المنهج العربي وأهداف الدرس</strong>،
                مراعياً مستوى الطلاب واحتياجات المرحلة. كل ورقة يمكن تعديلها قبل الطباعة.
              </p>
            </div>
          </section>

          {/* المميزات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">ما يميّز مولّد حصاد</h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {[
                { icon: <Sparkles className="w-5 h-5" />, title: "ذكاء اصطناعي مُدرَّب على المناهج العربية", body: "النماذج مُعدَّلة لتفهم المنهج الدراسي العربي وتُنتج أسئلة مناسبة وليس مجرد ترجمة." },
                { icon: <Layers className="w-5 h-5" />, title: "7 قوالب بصرية", body: "اختر بين قوالب متنوعة لتصميم ورقة العمل — جادة أكاديمية أو ملوّنة وممتعة للصغار." },
                { icon: <Sliders className="w-5 h-5" />, title: "تحكم كامل في الأسئلة", body: "عدّل أي سؤال، أضف أسئلة يدوياً، أو أعد توليد الأسئلة التي لا تناسبك." },
                { icon: <Printer className="w-5 h-5" />, title: "جاهزة للطباعة فوراً", body: "تخرج الورقة بتنسيق مثالي للطباعة A4 مع نموذج الإجابة المنفصل." },
                { icon: <Clock className="w-5 h-5" />, title: "من ساعات إلى دقيقة", body: "ما كان يأخذ ساعة في التحضير يصبح جاهزاً في أقل من دقيقة." },
                { icon: <Globe className="w-5 h-5" />, title: "دعم RTL وعربية كاملة", body: "النص والمحتوى والتصميم كلها من اليمين لليسار دون أي مشكلة في التنسيق." },
              ].map(({ icon, title, body }) => (
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
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">أمثلة على الاستخدام</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: <GraduationCap className="w-5 h-5" />, title: "مراجعة نهاية الوحدة", body: "ورقة شاملة بكل مفاهيم الوحدة الدراسية مرتّبة من الأسهل للأصعب." },
                { icon: <FileText className="w-5 h-5" />, title: "واجب بيتي", body: "أنشئ واجباً متنوعاً مع نموذج إجابة منفصل يُسهّل التصحيح." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "اختبار قصير (Quiz)", body: "اختبار سريع لقياس فهم الطلاب في بداية الحصة أو نهايتها." },
              ].map(({ icon, title, body }) => (
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
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">أدوات الذكاء الاصطناعي الأخرى في حصاد</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: "/features/lesson-plan-ai", label: "مولّد خطة الدرس" },
                { href: "/features/presentations-ai", label: "العروض التفاعلية بالذكاء الاصطناعي" },
                { href: "/features/interactive-video", label: "الفيديو التعليمي التفاعلي" },
                { href: "/features/wameeth", label: "وميض — المسابقات المباشرة" },
                { href: "/features/games", label: "الألعاب التعليمية" },
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
              أنشئ أول ورقة عمل بالذكاء الاصطناعي مجاناً وشاهد الفرق بنفسك.
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
