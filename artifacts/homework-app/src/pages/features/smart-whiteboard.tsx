/* /features/smart-whiteboard — السبورة الذكية */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  PenLine, Smartphone, Share2, Layers, Eye,
  Users, CheckCircle2, ArrowLeft, Sparkles, LayoutGrid,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import { useI18n } from "@/lib/i18n";

export default function FeatureSmartWhiteboard() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  useSeo({
    title: isAr
      ? "السبورة الذكية التفاعلية للفصل الدراسي | منصة حصاد"
      : "Smart Interactive Whiteboard for the Classroom | Hasad Platform",
    description: isAr
      ? "سبورة ذكية تفاعلية يراها طلابك من هواتفهم في الوقت الفعلي. ارسم، أضف أشكالاً ونصوصاً، وضع صوراً — وكل طالب يتابع على شاشته أثناء الشرح."
      : "An interactive smart whiteboard your students see on their phones in real time. Draw, add shapes, text, and images — every student follows along on their screen during the lesson.",
    canonicalPath: "/features/smart-whiteboard",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": isAr ? "السبورة الذكية — حصاد" : "Smart Whiteboard — Hasad",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": isAr ? "ar" : "en",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": isAr
        ? "سبورة تفاعلية ذكية للفصل الدراسي — يرى الطلاب ما يرسمه المعلم على هواتفهم في الوقت الفعلي."
        : "A smart interactive whiteboard for the classroom — students see what the teacher draws on their phones in real time.",
      "url": "https://hasadx.com/features/smart-whiteboard",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "whiteboard-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("whiteboard-schema")?.remove(); };
  }, [isAr]);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir={dir}>
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <PenLine className="w-4 h-4" />
              {isAr ? "سبورة ذكية · حصاد" : "Smart Whiteboard · Hasad"}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              {isAr
                ? "السبورة الذكية — لوح تفاعلي يراه كل طلابك من هواتفهم في الوقت الفعلي"
                : "Smart Whiteboard — An Interactive Board Every Student Sees on Their Phone in Real Time"}
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-alpha mx-auto">
              {isAr ? (
                <>
                  لم تعد السبورة مقيّدة بمقدمة الفصل. مع <strong>السبورة الذكية في حصاد</strong>،
                  ارسم وأضف نصوصاً وصوراً وأشكالاً على شاشتك، وكل طالب يتابع كل حركة قلمك
                  على هاتفه في الوقت الفعلي — سواء في الفصل أو عن بُعد.
                </>
              ) : (
                <>
                  The whiteboard is no longer confined to the front of the class. With <strong>Hasad's Smart Whiteboard</strong>,
                  draw, add text, images, and shapes on your screen — and every student follows every stroke of your pen
                  on their phone in real time, whether in the classroom or learning remotely.
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                {isAr ? "جرّب السبورة مجاناً" : "Try the Whiteboard for Free"}
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/presentations-ai" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                {isAr ? "أيضاً: العروض التفاعلية" : "Also: Interactive Presentations"}
              </Link>
            </div>
          </header>

          {/* ما هي / What is it */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              {isAr ? "ما هي السبورة الذكية في حصاد؟" : "What is Hasad's Smart Whiteboard?"}
            </h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                {isAr ? (
                  <>
                    <strong>السبورة الذكية</strong> في حصاد هي لوح رسم رقمي تشاركي —
                    تفتحه المعلم على حاسوبه أو جهازه اللوحي، ويُشاهده الطلاب على هواتفهم بمجرد مشاركة رمز الجلسة.
                    كل ما ترسمه أو تكتبه يظهر لهم فورياً دون أي تأخير.
                  </>
                ) : (
                  <>
                    The <strong>Smart Whiteboard</strong> in Hasad is a collaborative digital drawing board —
                    the teacher opens it on their computer or tablet, and students view it on their phones the moment they enter the session code.
                    Everything you draw or write appears to them instantly with no delay.
                  </>
                )}
              </p>
              <p>
                {isAr ? (
                  <>
                    يمكنك استخدامها كسبورة عادية لشرح الدروس، أو إنشاء لوحات منظّمة مسبقاً
                    بمحتوى تعليمي وعرضها بشكل تدريجي. مع <strong>الذكاء الاصطناعي المدمج</strong>،
                    اطلب منه توليد لوحة شرح لأي موضوع في ثوانٍ.
                  </>
                ) : (
                  <>
                    You can use it as a regular whiteboard to explain lessons, or create pre-organised boards
                    with educational content and reveal them progressively. With the <strong>built-in AI</strong>,
                    ask it to generate an explanatory board for any topic in seconds.
                  </>
                )}
              </p>
            </div>
          </section>

          {/* المميزات / Features */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              {isAr ? "ما تقدّمه السبورة الذكية" : "What the Smart Whiteboard Offers"}
            </h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {[
                {
                  icon: <Share2 className="w-5 h-5" />,
                  title: isAr ? "مشاركة فورية بالرمز" : "Instant Code Sharing",
                  body: isAr
                    ? "يُشاهد الطلاب السبورة على هواتفهم فور إدخال رمز الجلسة — بدون حساب أو تحميل."
                    : "Students view the whiteboard on their phones as soon as they enter the session code — no account or download needed.",
                },
                {
                  icon: <PenLine className="w-5 h-5" />,
                  title: isAr ? "أدوات رسم متكاملة" : "Comprehensive Drawing Tools",
                  body: isAr
                    ? "قلم حر، خطوط، أشكال هندسية، أسهم، نصوص، ممحاة — كل ما تحتاجه لشرح أي فكرة."
                    : "Freehand pen, lines, geometric shapes, arrows, text, eraser — everything you need to explain any concept.",
                },
                {
                  icon: <Layers className="w-5 h-5" />,
                  title: isAr ? "شرائح متعددة" : "Multiple Slides",
                  body: isAr
                    ? "أنشئ عدة لوحات في نفس الجلسة وانتقل بينها كشرائح عرض."
                    : "Create multiple boards in the same session and navigate between them like presentation slides.",
                },
                {
                  icon: <Sparkles className="w-5 h-5" />,
                  title: isAr ? "ذكاء اصطناعي مدمج" : "Built-in AI",
                  body: isAr
                    ? "اطلب من الذكاء الاصطناعي توليد لوحة شرح أو خريطة مفاهيم لأي موضوع."
                    : "Ask the AI to generate an explanatory board or concept map for any topic.",
                },
                {
                  icon: <Eye className="w-5 h-5" />,
                  title: isAr ? "وضع التركيز" : "Focus Mode",
                  body: isAr
                    ? "اخفِ أجزاء من اللوحة واكشفها تدريجياً للتشويق والمتابعة."
                    : "Hide parts of the board and reveal them gradually to build suspense and maintain engagement.",
                },
                {
                  icon: <Users className="w-5 h-5" />,
                  title: isAr ? "مناسبة للتعلم عن بُعد" : "Perfect for Remote Learning",
                  body: isAr
                    ? "تعمل مثالياً في Google Meet وZoom — شارك شاشتك أو استخدمها كأداة مستقلة."
                    : "Works seamlessly with Google Meet and Zoom — share your screen or use it as a standalone tool.",
                },
                {
                  icon: <LayoutGrid className="w-5 h-5" />,
                  title: isAr ? "قوالب جاهزة" : "Ready-Made Templates",
                  body: isAr
                    ? "قوالب جداول، خرائط مفاهيم، تسلسل زمني — ابدأ منها وعدّل حسب درسك."
                    : "Table templates, concept maps, timelines — start from them and customise to fit your lesson.",
                },
                {
                  icon: <CheckCircle2 className="w-5 h-5" />,
                  title: isAr ? "حفظ وإعادة الاستخدام" : "Save and Reuse",
                  body: isAr
                    ? "احفظ لوحاتك في مكتبتك واستخدمها في حصص قادمة أو شاركها مع زملاء."
                    : "Save your boards to your library and reuse them in future sessions or share them with colleagues.",
                },
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

          {/* الاستخدامات / Use Cases */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              {isAr ? "أمثلة على الاستخدام" : "Usage Examples"}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  title: isAr ? "شرح الرياضيات" : "Explaining Mathematics",
                  body: isAr
                    ? "ارسم المعادلات والأشكال الهندسية خطوة بخطوة وكل طالب يتابع على هاتفه."
                    : "Draw equations and geometric shapes step by step while every student follows along on their phone.",
                },
                {
                  title: isAr ? "خريطة مفاهيم" : "Concept Map",
                  body: isAr
                    ? "استخدم ذكاء حصاد لتوليد خريطة مفاهيم للدرس وعرّضها على الفصل."
                    : "Use Hasad's AI to generate a concept map for the lesson and display it to the class.",
                },
                {
                  title: isAr ? "التعلّم عن بُعد" : "Remote Learning",
                  body: isAr
                    ? "في الفصول الافتراضية، السبورة تُعوّض سبورة الفصل الحقيقية بالكامل."
                    : "In virtual classrooms, the whiteboard fully replaces the physical classroom board.",
                },
              ].map(({ title, body }) => (
                <div key={title} className="p-5 bg-white border border-emerald-100 rounded-xl">
                  <PenLine className="w-6 h-6 text-emerald-600 mb-2" />
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* روابط داخلية / Internal Links */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              {isAr ? "أدوات حصاد الأخرى" : "Other Hasad Tools"}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                {
                  href: "/features/presentations-ai",
                  label: isAr ? "العروض التفاعلية بالذكاء الاصطناعي" : "AI-Powered Interactive Presentations",
                },
                {
                  href: "/features/interactive-video",
                  label: isAr ? "الفيديو التعليمي التفاعلي" : "Interactive Educational Video",
                },
                {
                  href: "/features/wameeth",
                  label: isAr ? "وميض — مسابقات مباشرة" : "Wameeth — Live Quizzes",
                },
                {
                  href: "/features/worksheet-ai",
                  label: isAr ? "مولّد أوراق العمل" : "Worksheet Generator",
                },
                {
                  href: "/features/lesson-plan-ai",
                  label: isAr ? "مولّد خطة الدرس" : "Lesson Plan Generator",
                },
              ].map(({ href, label }) => (
                <Link key={href} href={href} className="px-4 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm font-semibold hover:bg-emerald-50 transition">
                  {label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center bg-emerald-900 text-white rounded-2xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              {isAr ? "ابدأ بسبورتك الذكية الآن" : "Start Your Smart Whiteboard Now"}
            </h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              {isAr
                ? "أنشئ حسابك مجاناً وأطلق أول جلسة سبورة ذكية مع طلابك."
                : "Create your free account and launch your first smart whiteboard session with your students."}
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
