/* /features/games — صفحة تعريفية بمجموعة الألعاب التعليمية في حصاد */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Gamepad2, Zap, Globe, Brain, AlignLeft, Dices,
  Trophy, Users, Smartphone, CheckCircle2, ArrowLeft,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

const GAMES = [
  { name: "وميض", desc: "مسابقات أسئلة مباشرة في الفصل — البديل العربي لـ Kahoot.", href: "/features/wameeth" },
  { name: "أرينا حصاد", desc: "مسابقة فئات على طراز Jeopardy — فريقان يتنافسان على الإجابة الصحيحة.", href: "/games" },
  { name: "من سيربح المليون؟", desc: "نسخة تعليمية من البرنامج الشهير بالأسئلة المتدرجة الصعوبة.", href: "/games" },
  { name: "اكتشف السر", desc: "تعاون لكشف الكلمة المخفية خلية بخلية — نشاط صفي جماعي.", href: "/features/escape-room" },
  { name: "مراقي", desc: "سلّم الثقافة العربية — ألف سؤال ثقافي بمستويات متصاعدة.", href: "/games" },
  { name: "لترلي", desc: "خمّن الكلمة العربية في ستة محاولات — Wordle بالعربي.", href: "/games" },
  { name: "الكلمة المبعثرة", desc: "رتّب حروف الكلمة المبعثرة في أسرع وقت.", href: "/games" },
  { name: "مسابقة الأعلام", desc: "خمّن علم الدولة — اختبر معلوماتك الجغرافية.", href: "/games" },
  { name: "عواصم العالم", desc: "أسئلة عواصم الدول بوضع منفرد أو تنافسي بين الفصل.", href: "/games" },
  { name: "لعبة الذاكرة", desc: "طابق البطاقات المخفية — يمكن للمعلم تخصيص المحتوى.", href: "/games" },
  { name: "شد الحبل", desc: "فريقان يتنافسان بالإجابات لشدّ الحبل نحو ملعبهم.", href: "/games" },
  { name: "الكرسي الساخن", desc: "طالب يجلس وظهره للشاشة — يُجيب بمساعدة أصدقائه.", href: "/games" },
  { name: "سباق الصواريخ", desc: "أجب أسرع لتقود صاروخك نحو خط النهاية.", href: "/games" },
  { name: "عجلة التحدي", desc: "عجلة عشوائية تختار الطالب أو الموضوع — مناسبة للتفاعل الصفي.", href: "/games" },
  { name: "ستروب", desc: "اختبار تركيز وسرعة استجابة — علم النفس داخل الفصل.", href: "/games" },
  { name: "جداول الضرب", desc: "تعلّم الضرب بطريقة لعبية ممتعة مناسبة للمراحل الأولى.", href: "/games" },
];

export default function FeatureGames() {
  useSeo({
    title: "الألعاب التعليمية التفاعلية — منصة حصاد | ألعاب صفية للمعلمين",
    description:
      "اكتشف أكثر من 15 لعبة تعليمية تفاعلية في منصة حصاد: مسابقات مباشرة، ألعاب فردية، تحديات جماعية. حوّل فصلك الدراسي إلى تجربة تعلّم لا تُنسى.",
    canonicalPath: "/features/games",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "الألعاب التعليمية التفاعلية — منصة حصاد",
      "description": "أكثر من 15 لعبة تعليمية للفصل الدراسي: مسابقات مباشرة وألعاب فردية وتحديات جماعية بواجهة عربية كاملة.",
      "url": "https://hasadx.com/features/games",
      "inLanguage": "ar",
      "about": { "@type": "Thing", "name": "ألعاب تعليمية تفاعلية" },
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "games-feature-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("games-feature-schema")?.remove(); };
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir="rtl">
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Gamepad2 className="w-4 h-4" />
              الألعاب التعليمية · منصة حصاد
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              الألعاب التعليمية التفاعلية — عشر ألعاب تجعل التعلّم تنافساً ممتعاً
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              تقدّم <strong>منصة حصاد</strong> مكتبة متكاملة من <strong>الألعاب التعليمية التفاعلية</strong> مصمَّمة خصيصاً
              للفصل الدراسي العربي. من المسابقات المباشرة إلى الألعاب الفردية والتحديات الجماعية — كل لعبة وسيلة
              لتحويل أي محتوى دراسي إلى تجربة لا يُنساها الطالب.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/games" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                تصفّح الألعاب الآن
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                أنشئ حساباً مجاناً
              </Link>
            </div>
          </header>

          {/* لماذا الألعاب */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">لماذا الألعاب التعليمية في الفصل؟</h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                أثبتت الدراسات أن <strong>التعلّم القائم على اللعب</strong> يرفع التركيز والاحتفاظ بالمعلومات بشكل ملحوظ.
                حين يتنافس الطالب أو يتعاون مع زملائه على حل سؤال، يكون أكثر انتباهاً وأسرع استيعاباً مما لو جلس يستمع سلبياً.
              </p>
              <p>
                الفارق في حصاد هو أن <strong>المعلم يتحكم في المحتوى بالكامل</strong>: يُضيف أسئلته من المنهج أو يستخدم بنك الأسئلة الجاهز،
                ويُشغّل الجلسة بنقرة، ويُتابع الأداء الفردي لكل طالب في تقرير واضح.
              </p>
            </div>
          </section>

          {/* الألعاب */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">الألعاب المتوفرة في حصاد</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {GAMES.map(({ name, desc, href }) => (
                <Link key={name} href={href} className="flex items-start gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm hover:border-emerald-300 hover:shadow-md transition group">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-900 mb-0.5 group-hover:text-emerald-700 transition">{name}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* مميزات مشتركة */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">ما يجمع كل الألعاب</h2>
            <ul className="space-y-3">
              {[
                { icon: <Smartphone className="w-5 h-5" />, text: "تعمل على أي هاتف أو حاسوب — لا تحميل تطبيق مطلوب." },
                { icon: <Globe className="w-5 h-5" />, text: "واجهة عربية بالكامل مع دعم RTL أصيل." },
                { icon: <Users className="w-5 h-5" />, text: "دخول الطلاب برمز الجلسة دون حاجة لإنشاء حساب." },
                { icon: <Trophy className="w-5 h-5" />, text: "لوحة متصدرين حية تُحفّز التنافس الصحي." },
                { icon: <Brain className="w-5 h-5" />, text: "المعلم يُضيف محتواه من المنهج أو يستخدم الأسئلة الجاهزة." },
                { icon: <AlignLeft className="w-5 h-5" />, text: "تقارير أداء فردية بعد كل جلسة لمتابعة تقدّم الطلاب." },
              ].map(({ icon, text }) => (
                <li key={text} className="flex items-center gap-3 p-4 bg-white border border-emerald-100 rounded-xl shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">{icon}</div>
                  <span className="text-slate-700 leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* روابط داخلية */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">أدوات حصاد الأخرى</h2>
            <div className="flex flex-wrap gap-3">
              {[
                { href: "/features/wameeth", label: "وميض — المسابقات المباشرة" },
                { href: "/features/escape-room", label: "غرفة الهروب التعليمية" },
                { href: "/features/presentations-ai", label: "العروض التفاعلية بالذكاء الاصطناعي" },
                { href: "/features/worksheet-ai", label: "مولّد أوراق العمل" },
                { href: "/features/interactive-video", label: "الفيديو التفاعلي" },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">جاهز لجعل التعلّم ممتعاً؟</h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              أنشئ حسابك مجاناً وابدأ أول لعبة تعليمية في فصلك خلال دقائق.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-emerald-900 font-bold hover:bg-emerald-50 transition">
                ابدأ مجاناً <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/games" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-white/40 text-white font-bold hover:bg-white/10 transition">
                تصفّح الألعاب
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
