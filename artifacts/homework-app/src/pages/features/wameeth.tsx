/* /features/wameeth — صفحة تعريفية بأداة وميض للمسابقات التفاعلية المباشرة */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Zap, Users, Trophy, Timer, Smartphone, BarChart3,
  CheckCircle2, ArrowLeft, Gamepad2, Globe,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function FeatureWameeth() {
  useSeo({
    title: "وميض — المسابقات التفاعلية المباشرة للفصل الدراسي | منصة حصاد",
    description:
      "وميض من حصاد: أطلق مسابقة تفاعلية مباشرة في فصلك في ثوانٍ. يدخل الطلاب برمز PIN، يتنافسون على الإجابة السريعة، وتتابع النتائج لحظة بلحظة. البديل العربي لـ Kahoot.",
    canonicalPath: "/features/wameeth",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "وميض — مسابقات تفاعلية مباشرة",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web, iOS, Android",
      "inLanguage": "ar",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": "أداة مسابقات تعليمية تفاعلية مباشرة للفصل الدراسي — يدخل الطلاب برمز PIN ويتنافسون على الإجابة الصحيحة والسريعة.",
      "url": "https://hasadx.com/features/wameeth",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "wameeth-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("wameeth-schema")?.remove(); };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir="rtl">
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Zap className="w-4 h-4" />
              وميض · مسابقات مباشرة
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              وميض — حوّل الأسئلة إلى مسابقة مباشرة في فصلك
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              أداة <strong>وميض</strong> من منصة حصاد تتيح للمعلم إطلاق مسابقة تفاعلية حية في الفصل الدراسي خلال ثوانٍ.
              يدخل الطلاب برمز الجلسة من هواتفهم، ويتنافسون على أسرع إجابة صحيحة، بينما تتابع أنت النتائج لحظة بلحظة على شاشتك.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition"
              >
                جرّب وميض مجاناً
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link
                href="/games"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition"
              >
                تصفّح كل الألعاب
              </Link>
            </div>
          </header>

          {/* ما هو وميض */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">ما هي لعبة وميض؟</h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                <strong>وميض</strong> هي أداة <strong>مسابقات تعليمية تفاعلية مباشرة</strong> مصمَّمة للفصل الدراسي العربي.
                ينشئ المعلم مجموعة أسئلة — اختيار متعدد، صح وخطأ، إدخال نصي — ويشغّل الجلسة المباشرة،
                ثم يعرض رمز الدخول للطلاب الذين يلتحقون فوراً من أي جهاز دون تحميل تطبيق.
              </p>
              <p>
                يظهر السؤال على شاشة المعلم وعلى هواتف الطلاب في آنٍ واحد. من يُجيب أسرع وأصحّ يتصدّر لوحة النتائج.
                في نهاية الجلسة يحصل المعلم على تقرير مفصّل بأداء كل طالب وبالأسئلة التي أربكت الفصل.
              </p>
            </div>
          </section>

          {/* المميزات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">أبرز مميزات وميض</h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {[
                { icon: <Zap className="w-5 h-5" />, title: "إطلاق فوري", body: "أنشئ مسابقتك في دقيقة وشغّلها مباشرة — بدون إعدادات معقدة أو تحميل تطبيق." },
                { icon: <Smartphone className="w-5 h-5" />, title: "دخول بدون حساب", body: "يدخل الطالب برمز الجلسة من هاتفه، بدون تسجيل أو كلمة مرور." },
                { icon: <Timer className="w-5 h-5" />, title: "عداد زمني لكل سؤال", body: "حدّد وقت كل سؤال بنفسك، والنقاط تُحتسب بناءً على سرعة الإجابة الصحيحة." },
                { icon: <Trophy className="w-5 h-5" />, title: "لوحة متصدرين حية", body: "تُحدَّث النتائج فورياً أثناء المسابقة لإبقاء التنافس والحماس مشتعلاً." },
                { icon: <Users className="w-5 h-5" />, title: "يدعم الفصول الكبيرة", body: "تعمل وميض بسلاسة مع فصول كبيرة — عشرات الطلاب في وقت واحد." },
                { icon: <BarChart3 className="w-5 h-5" />, title: "تقرير أداء مفصّل", body: "بعد الجلسة تحصل على تقرير بأداء كل طالب وبأكثر الأسئلة التي أخطأ فيها الفصل." },
                { icon: <Globe className="w-5 h-5" />, title: "دعم RTL كامل", body: "واجهة عربية بالكامل، تعمل من اليمين لليسار دون أي مشكلات في النص." },
                { icon: <Gamepad2 className="w-5 h-5" />, title: "أوضاع لعب متعددة", body: "العب بشكل فردي أو قسّم الفصل لفرق، واختر وضع الأسئلة المتتابعة أو الحرة." },
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
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">متى تستخدم وميض؟</h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "مراجعة قبل الاختبار", body: "كرّر أهم النقاط مع الطلاب في جو تنافسي ممتع بدلاً من المراجعة التقليدية." },
                { title: "قياس الفهم الفوري", body: "بعد شرح درس جديد، اكتشف فوراً من فهم ومن يحتاج شرحاً إضافياً." },
                { title: "تنشيط الفصل", body: "كسر روتين الحصة بمسابقة سريعة تعيد انتباه الطلاب وتحفّزهم على المشاركة." },
              ].map(({ title, body }) => (
                <div key={title} className="p-5 bg-white border border-emerald-100 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mb-2" />
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
                { href: "/features/games", label: "الألعاب التعليمية" },
                { href: "/features/escape-room", label: "غرفة الهروب" },
                { href: "/features/presentations-ai", label: "العروض التفاعلية بالذكاء الاصطناعي" },
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
            <h2 className="text-2xl md:text-3xl font-bold mb-3">جاهز لإطلاق أول مسابقة وميض؟</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              أنشئ حسابك مجاناً وابدأ أول مسابقة تفاعلية مع طلابك خلال دقائق.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">
                ابدأ مجاناً
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/about" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">
                تعرّف على المنصة
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
