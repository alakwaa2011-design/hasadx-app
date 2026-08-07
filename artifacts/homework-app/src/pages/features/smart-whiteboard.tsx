/* /features/smart-whiteboard — السبورة الذكية */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  PenLine, Smartphone, Share2, Layers, Eye,
  Users, CheckCircle2, ArrowLeft, Sparkles, LayoutGrid,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function FeatureSmartWhiteboard() {
  useSeo({
    title: "السبورة الذكية التفاعلية للفصل الدراسي | منصة حصاد",
    description:
      "سبورة ذكية تفاعلية يراها طلابك من هواتفهم في الوقت الفعلي. ارسم، أضف أشكالاً ونصوصاً، وضع صوراً — وكل طالب يتابع على شاشته أثناء الشرح.",
    canonicalPath: "/features/smart-whiteboard",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "السبورة الذكية — حصاد",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": "ar",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": "سبورة تفاعلية ذكية للفصل الدراسي — يرى الطلاب ما يرسمه المعلم على هواتفهم في الوقت الفعلي.",
      "url": "https://hasadx.com/features/smart-whiteboard",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "whiteboard-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("whiteboard-schema")?.remove(); };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir="rtl">
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <PenLine className="w-4 h-4" />
              سبورة ذكية · حصاد
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              السبورة الذكية — لوح تفاعلي يراه كل طلابك من هواتفهم في الوقت الفعلي
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-alpha mx-auto">
              لم تعد السبورة مقيّدة بمقدمة الفصل. مع <strong>السبورة الذكية في حصاد</strong>،
              ارسم وأضف نصوصاً وصوراً وأشكالاً على شاشتك، وكل طالب يتابع كل حركة قلمك
              على هاتفه في الوقت الفعلي — سواء في الفصل أو عن بُعد.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                جرّب السبورة مجاناً
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/presentations-ai" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                أيضاً: العروض التفاعلية
              </Link>
            </div>
          </header>

          {/* ما هي */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">ما هي السبورة الذكية في حصاد؟</h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                <strong>السبورة الذكية</strong> في حصاد هي لوح رسم رقمي تشاركي —
                تفتحه المعلم على حاسوبه أو جهازه اللوحي، ويُشاهده الطلاب على هواتفهم بمجرد مشاركة رمز الجلسة.
                كل ما ترسمه أو تكتبه يظهر لهم فورياً دون أي تأخير.
              </p>
              <p>
                يمكنك استخدامها كسبورة عادية لشرح الدروس، أو إنشاء لوحات منظّمة مسبقاً
                بمحتوى تعليمي وعرضها بشكل تدريجي. مع <strong>الذكاء الاصطناعي المدمج</strong>،
                اطلب منه توليد لوحة شرح لأي موضوع في ثوانٍ.
              </p>
            </div>
          </section>

          {/* المميزات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">ما تقدّمه السبورة الذكية</h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {[
                { icon: <Share2 className="w-5 h-5" />, title: "مشاركة فورية بالرمز", body: "يُشاهد الطلاب السبورة على هواتفهم فور إدخال رمز الجلسة — بدون حساب أو تحميل." },
                { icon: <PenLine className="w-5 h-5" />, title: "أدوات رسم متكاملة", body: "قلم حر، خطوط، أشكال هندسية، أسهم، نصوص، ممحاة — كل ما تحتاجه لشرح أي فكرة." },
                { icon: <Layers className="w-5 h-5" />, title: "شرائح متعددة", body: "أنشئ عدة لوحات في نفس الجلسة وانتقل بينها كشرائح عرض." },
                { icon: <Sparkles className="w-5 h-5" />, title: "ذكاء اصطناعي مدمج", body: "اطلب من الذكاء الاصطناعي توليد لوحة شرح أو خريطة مفاهيم لأي موضوع." },
                { icon: <Eye className="w-5 h-5" />, title: "وضع التركيز", body: "اخفِ أجزاء من اللوحة واكشفها تدريجياً للتشويق والمتابعة." },
                { icon: <Users className="w-5 h-5" />, title: "مناسبة للتعلم عن بُعد", body: "تعمل مثالياً في Google Meet وZoom — شارك شاشتك أو استخدمها كأداة مستقلة." },
                { icon: <LayoutGrid className="w-5 h-5" />, title: "قوالب جاهزة", body: "قوالب جداول، خرائط مفاهيم، تسلسل زمني — ابدأ منها وعدّل حسب درسك." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "حفظ وإعادة الاستخدام", body: "احفظ لوحاتك في مكتبتك واستخدمها في حصص قادمة أو شاركها مع زملاء." },
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
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">أمثلة على الاستخدام</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "شرح الرياضيات", body: "ارسم المعادلات والأشكال الهندسية خطوة بخطوة وكل طالب يتابع على هاتفه." },
                { title: "خريطة مفاهيم", body: "استخدم ذكاء حصاد لتوليد خريطة مفاهيم للدرس وعرّضها على الفصل." },
                { title: "التعلّم عن بُعد", body: "في الفصول الافتراضية، السبورة تُعوّض سبورة الفصل الحقيقية بالكامل." },
              ].map(({ title, body }) => (
                <div key={title} className="p-5 bg-white border border-emerald-100 rounded-xl">
                  <PenLine className="w-6 h-6 text-emerald-600 mb-2" />
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* روابط داخلية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">أدوات حصاد الأخرى</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: "/features/presentations-ai", label: "العروض التفاعلية بالذكاء الاصطناعي" },
                { href: "/features/interactive-video", label: "الفيديو التعليمي التفاعلي" },
                { href: "/features/wameeth", label: "وميض — مسابقات مباشرة" },
                { href: "/features/worksheet-ai", label: "مولّد أوراق العمل" },
                { href: "/features/lesson-plan-ai", label: "مولّد خطة الدرس" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">ابدأ بسبورتك الذكية الآن</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              أنشئ حسابك مجاناً وأطلق أول جلسة سبورة ذكية مع طلابك.
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
