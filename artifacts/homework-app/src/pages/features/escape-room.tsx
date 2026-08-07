/* /features/escape-room — غرفة الهروب التعليمية (اكتشف السر) */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Lock, Unlock, Users, Grid3x3, Trophy,
  CheckCircle2, ArrowLeft, Sparkles, Lightbulb,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

export default function FeatureEscapeRoom() {
  useSeo({
    title: "غرفة الهروب التعليمية — اكتشف السر من خلال الإجابة الصحيحة | حصاد",
    description:
      "نشاط صفي تعليمي على شكل غرفة هروب: يُجيب الطلاب على الأسئلة لكشف خلايا شبكة تخفي كلمة أو صورة سرية. نشاط تعاوني ممتع يناسب كل المراحل.",
    canonicalPath: "/features/escape-room",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "اكتشف السر — غرفة الهروب التعليمية بحصاد",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": "ar",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": "لعبة اكتشف السر — نشاط صفي تعليمي تعاوني: يُجيب الطلاب على أسئلة لكشف خلايا تُخفي كلمة أو صورة سرية.",
      "url": "https://hasadx.com/features/escape-room",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "escape-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("escape-schema")?.remove(); };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir="rtl">
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Lock className="w-4 h-4" />
              اكتشف السر · نشاط تعاوني
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              غرفة الهروب التعليمية — اكتشف السر من خلال الإجابة الصحيحة
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              <strong>اكتشف السر</strong> هو نشاط صفي تعاوني يجعل الطلاب يُجيبون على الأسئلة
              لكشف خلايا شبكة تُخفي كلمة أو صورة سرية تحتها. كل إجابة صحيحة تكشف قطعة من السر
              وتُقرّب الفصل من الاكتشاف الكامل — حماس حقيقي طوال النشاط.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                جرّب اكتشف السر
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/wameeth" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                أيضاً: وميض المسابقات
              </Link>
            </div>
          </header>

          {/* كيف يعمل */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">كيف تعمل لعبة اكتشف السر؟</h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                المعلم يُنشئ شبكة من الخلايا — كل خلية تُخفي جزءاً من كلمة أو صورة سرية وراء سؤال.
                يختار الطالب أو الفريق خلية، يُجيب على سؤالها، وإن أجاب صحيحاً انكشفت الخلية كاشفةً
                قطعة من السر. الهدف هو اكتشاف السر الكامل قبل نفاد المحاولات.
              </p>
              <p>
                النشاط مرن تماماً — يمكن لعبه بشكل فردي، أو تقسيم الفصل لفريقين يتناوبان،
                أو جماعياً حيث يختار الفصل كله الخلايا. المعلم يتحكم في إيقاع اللعبة من شاشته.
              </p>
            </div>
          </section>

          {/* المميزات */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">لماذا اكتشف السر؟</h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {[
                { icon: <Sparkles className="w-5 h-5" />, title: "توليد بالذكاء الاصطناعي", body: "أدخل موضوع الدرس واجعل الذكاء الاصطناعي يُنشئ الأسئلة والسر المخفي تلقائياً." },
                { icon: <Grid3x3 className="w-5 h-5" />, title: "شبكة مرنة الحجم", body: "اختر حجم الشبكة — من 9 خلايا للنشاط السريع إلى 25 خلية للجلسات الأطول." },
                { icon: <Users className="w-5 h-5" />, title: "فردي أو جماعي", body: "العب مع الفصل كله، أو قسّمهم لفرق تتنافس على الاكتشاف أولاً." },
                { icon: <Lock className="w-5 h-5" />, title: "سر مخصص", body: "اختر أي كلمة أو مصطلح أو صورة كسر مخفي — يتعلّمه الطلاب باكتشافه." },
                { icon: <Lightbulb className="w-5 h-5" />, title: "تعلّم بالاكتشاف", body: "الطالب يكتشف المعلومة بنفسه عوضاً عن تلقّيها جاهزة — أعمق أثراً في الذاكرة." },
                { icon: <Trophy className="w-5 h-5" />, title: "نقاط وتنافس", body: "كل إجابة صحيحة تُسجّل نقاطاً — يمكن عرض المتصدرين في نهاية النشاط." },
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
                { icon: <Unlock className="w-5 h-5" />, title: "تقديم وحدة جديدة", body: "السر هو اسم الموضوع الجديد — الطلاب يكتشفونه باتشويق قبل بدء الدرس." },
                { icon: <CheckCircle2 className="w-5 h-5" />, title: "مراجعة المفاهيم", body: "كل خلية تتضمن مصطلحاً من الوحدة — الاكتشاف يُعيد تعلّم كل المفاهيم." },
                { icon: <Users className="w-5 h-5" />, title: "نشاط ختامي للفصل", body: "أنهِ الوحدة بنشاط جماعي ممتع يُوحّد الفصل ويُلخّص ما تعلّموه." },
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
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">ألعاب وأدوات أخرى في حصاد</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: "/features/wameeth", label: "وميض — مسابقات مباشرة" },
                { href: "/features/games", label: "كل الألعاب التعليمية" },
                { href: "/features/presentations-ai", label: "العروض التفاعلية" },
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
            <h2 className="text-2xl md:text-3xl font-bold mb-3">اجعل درسك مغامرة اكتشاف</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              أنشئ حسابك مجاناً وابدأ أول نشاط اكتشف السر مع فصلك.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">
                ابدأ مجاناً <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/games" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">
                تصفّح كل الألعاب
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
