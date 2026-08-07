/* /features/presentations-ai — العروض التفاعلية بالذكاء الاصطناعي */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, Presentation, MessageSquare, BarChart3,
  Users, Wand2, CheckCircle2, ArrowLeft, Play, Layers,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function FeaturePresentationsAI() {
  useSeo({
    title: "العروض التفاعلية بالذكاء الاصطناعي | منصة حصاد للمعلمين",
    description:
      "أنشئ عرضاً تقديمياً تفاعلياً بالذكاء الاصطناعي في ثوانٍ. أضف أسئلة واستطلاعات مباشرة على الشرائح وتفاعل مع طلابك في الوقت الفعلي. البديل العربي لـ Mentimeter وNearPod.",
    canonicalPath: "/features/presentations-ai",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "العروض التفاعلية بالذكاء الاصطناعي — حصاد",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": "ar",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": "منصة لإنشاء عروض تقديمية تفاعلية بالذكاء الاصطناعي — شرائح مع أسئلة واستطلاعات وتفاعل مباشر مع الطلاب.",
      "url": "https://hasadx.com/features/presentations-ai",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "presentations-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("presentations-schema")?.remove(); };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir="rtl">
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              عروض تفاعلية · ذكاء اصطناعي
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              العروض التفاعلية بالذكاء الاصطناعي — من فكرة إلى عرض جاهز في ثوانٍ
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              أنشئ <strong>عرضاً تقديمياً تفاعلياً</strong> كاملاً بعنوان درسك في ثوانٍ،
              أضف عليه أسئلة واستطلاعات وكلمات سحابية مباشرة على الشرائح،
              وقدّمه لطلابك بينما يتفاعلون من هواتفهم في الوقت الفعلي.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                جرّب العروض مجاناً
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/interactive-video" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                أيضاً: الفيديو التفاعلي
              </Link>
            </div>
          </header>

          {/* ما هو */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">ما هي العروض التفاعلية في حصاد؟</h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                العروض التفاعلية في حصاد تجمع بين <strong>إنشاء المحتوى بالذكاء الاصطناعي</strong>
                و<strong>التفاعل المباشر مع الطلاب أثناء العرض</strong>.
                لا تحتاج لمعرفة تصميم ولا لتحميل برامج — كل شيء في المتصفح.
              </p>
              <p>
                الذكاء الاصطناعي يبني شرائح منظّمة مع أمثلة وأسئلة مناسبة للمرحلة،
                وأنت تُعدّل وتُضيف وتحذف حسب احتياجك، ثم تُقدّم العرض بينما يرى الطلاب
                كل شريحة على هواتفهم ويُجيبون على الأسئلة المدمجة فيها مباشرة.
              </p>
            </div>
          </section>

          {/* المميزات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">ما يجعل عروض حصاد مختلفة</h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {[
                { icon: <Wand2 className="w-5 h-5" />, title: "توليد كامل بالذكاء الاصطناعي", body: "اكتب عنوان الدرس واختر عدد الشرائح — الذكاء الاصطناعي يبني لك شرائح منظّمة مع محتوى مناسب." },
                { icon: <MessageSquare className="w-5 h-5" />, title: "أسئلة مدمجة في الشرائح", body: "أضف سؤال اختيار متعدد أو استطلاع رأي أو كلمة سحابية داخل أي شريحة وتلقّ إجابات الطلاب لحظياً." },
                { icon: <Play className="w-5 h-5" />, title: "عرض مباشر بتزامن فوري", body: "يرى الطلاب كل شريحة على هواتفهم بمجرد انتقالك لها — بدون أي تأخير." },
                { icon: <BarChart3 className="w-5 h-5" />, title: "نتائج فورية على الشاشة", body: "تظهر إجابات الطلاب على الشاشة الرئيسية فور إرسالها — مرئياً ومؤثراً." },
                { icon: <Users className="w-5 h-5" />, title: "دخول بدون حساب", body: "يدخل الطلاب برمز PIN من أي متصفح دون تسجيل أو تحميل." },
                { icon: <Layers className="w-5 h-5" />, title: "تعديل كامل قبل العرض", body: "تحكّم في كل شريحة — النص والصور والأسئلة وترتيب الشرائح." },
                { icon: <Presentation className="w-5 h-5" />, title: "وضع عرض احترافي", body: "واجهة عرض نظيفة بدون إلهاءات — مثالية لشاشة الفصل أو عرض Zoom." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "تقارير مشاركة بعد العرض", body: "احصل على تقرير يُظهر من شارك وما هي الإجابات الأكثر شيوعاً لكل سؤال." },
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

          {/* الاستخدامات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">كيف يستخدمها المعلمون؟</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "شرح درس جديد", body: "قدّم الدرس بشرائح منظّمة وأسئلة تفقّد الفهم دمجتها في كل شريحة." },
                { title: "مراجعة تفاعلية", body: "مرّر الطلاب على أهم المفاهيم بأسئلة تتضمّن نقاشات وتصويتات حية." },
                { title: "ورشة عمل جماعية", body: "استخدم الكلمة السحابية لجمع أفكار الطلاب والعصف الذهني الجماعي." },
              ].map(({ title, body }) => (
                <div key={title} className="p-5 bg-white border border-emerald-100 rounded-xl">
                  <Sparkles className="w-6 h-6 text-emerald-600 mb-2" />
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* روابط داخلية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">استكشف أدوات حصاد الأخرى</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: "/features/interactive-video", label: "الفيديو التعليمي التفاعلي" },
                { href: "/features/smart-whiteboard", label: "السبورة الذكية" },
                { href: "/features/worksheet-ai", label: "مولّد أوراق العمل" },
                { href: "/features/lesson-plan-ai", label: "مولّد خطة الدرس" },
                { href: "/features/wameeth", label: "وميض — مسابقات مباشرة" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">أنشئ عرضك الأول الآن</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              اكتب عنوان الدرس واجعل الذكاء الاصطناعي يبني لك العرض — مجاناً تماماً.
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
