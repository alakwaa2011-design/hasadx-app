/* /features/presentations-ai — العروض التفاعلية بالذكاء الاصطناعي */

import { useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  Sparkles, Presentation, MessageSquare, BarChart3,
  Users, Wand2, CheckCircle2, ArrowLeft, Play, Layers,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import { useI18n } from "@/lib/i18n";

export default function FeaturePresentationsAI() {
  const { lang, dir } = useI18n();
  const isAr = lang === "ar";

  useSeo({
    title: isAr
      ? "العروض التفاعلية بالذكاء الاصطناعي | منصة حصاد للمعلمين"
      : "AI Interactive Presentations | Hasad Platform for Teachers",
    description: isAr
      ? "أنشئ عرضاً تقديمياً تفاعلياً بالذكاء الاصطناعي في ثوانٍ. أضف أسئلة واستطلاعات مباشرة على الشرائح وتفاعل مع طلابك في الوقت الفعلي. البديل العربي لـ Mentimeter وNearPod."
      : "Create an AI-powered interactive presentation in seconds. Add questions and polls directly on slides and engage your students in real time. The Arabic alternative to Mentimeter and NearPod.",
    canonicalPath: "/features/presentations-ai",
    ogImage: "/opengraph.jpg",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": isAr
        ? "العروض التفاعلية بالذكاء الاصطناعي — حصاد"
        : "AI Interactive Presentations — Hasad",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web",
      "inLanguage": isAr ? "ar" : "en",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
      "description": isAr
        ? "منصة لإنشاء عروض تقديمية تفاعلية بالذكاء الاصطناعي — شرائح مع أسئلة واستطلاعات وتفاعل مباشر مع الطلاب."
        : "A platform for creating AI-powered interactive presentations — slides with embedded questions, polls, and live student engagement.",
      "url": "https://hasadx.com/features/presentations-ai",
    };
    const el = Object.assign(document.createElement("script"), {
      type: "application/ld+json",
      id: "presentations-schema",
      textContent: JSON.stringify(schema),
    });
    document.head.appendChild(el);
    return () => { document.getElementById("presentations-schema")?.remove(); };
  }, [isAr]);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white" dir={dir}>
        <div className="container mx-auto px-4 py-12 md:py-20 max-w-4xl">

          {/* Hero */}
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-4">
              <Sparkles className="w-4 h-4" />
              {isAr ? "عروض تفاعلية · ذكاء اصطناعي" : "Interactive Presentations · AI"}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-emerald-900 leading-tight mb-4">
              {isAr
                ? "العروض التفاعلية بالذكاء الاصطناعي — من فكرة إلى عرض جاهز في ثوانٍ"
                : "AI Interactive Presentations — From Idea to Ready Deck in Seconds"}
            </h1>
            <p className="text-lg md:text-xl text-slate-700 leading-relaxed max-w-3xl mx-auto">
              {isAr ? (
                <>
                  أنشئ <strong>عرضاً تقديمياً تفاعلياً</strong> كاملاً بعنوان درسك في ثوانٍ،
                  أضف عليه أسئلة واستطلاعات وكلمات سحابية مباشرة على الشرائح،
                  وقدّمه لطلابك بينما يتفاعلون من هواتفهم في الوقت الفعلي.
                </>
              ) : (
                <>
                  Generate a complete <strong>interactive presentation</strong> from your lesson title in seconds,
                  embed questions, polls, and word clouds directly on the slides,
                  and deliver it while students engage from their phones in real time.
                </>
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-800 text-white font-bold hover:bg-emerald-700 transition">
                {isAr ? "جرّب العروض مجاناً" : "Try Presentations for Free"}
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <Link href="/features/interactive-video" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-emerald-200 text-emerald-900 font-bold hover:bg-emerald-50 transition">
                {isAr ? "أيضاً: الفيديو التفاعلي" : "Also: Interactive Video"}
              </Link>
            </div>
          </header>

          {/* ما هو / What is it */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              {isAr ? "ما هي العروض التفاعلية في حصاد؟" : "What Are Interactive Presentations in Hasad?"}
            </h2>
            <div className="prose prose-lg max-w-none text-slate-700 leading-loose">
              <p>
                {isAr ? (
                  <>
                    العروض التفاعلية في حصاد تجمع بين <strong>إنشاء المحتوى بالذكاء الاصطناعي</strong>
                    و<strong>التفاعل المباشر مع الطلاب أثناء العرض</strong>.
                    لا تحتاج لمعرفة تصميم ولا لتحميل برامج — كل شيء في المتصفح.
                  </>
                ) : (
                  <>
                    Hasad's interactive presentations combine <strong>AI-powered content creation</strong> with{" "}
                    <strong>live student engagement during the session</strong>.
                    No design skills or software downloads needed — everything runs in the browser.
                  </>
                )}
              </p>
              <p>
                {isAr
                  ? "الذكاء الاصطناعي يبني شرائح منظّمة مع أمثلة وأسئلة مناسبة للمرحلة، وأنت تُعدّل وتُضيف وتحذف حسب احتياجك، ثم تُقدّم العرض بينما يرى الطلاب كل شريحة على هواتفهم ويُجيبون على الأسئلة المدمجة فيها مباشرة."
                  : "The AI builds structured slides complete with grade-appropriate examples and questions. You can edit, add, or remove anything you like, then deliver the presentation while students follow each slide on their phones and answer the embedded questions in real time."}
              </p>
            </div>
          </section>

          {/* المميزات / Features */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              {isAr ? "ما يجعل عروض حصاد مختلفة" : "What Makes Hasad Presentations Different"}
            </h2>
            <ul className="grid md:grid-cols-2 gap-4">
              {[
                {
                  icon: <Wand2 className="w-5 h-5" />,
                  title: isAr ? "توليد كامل بالذكاء الاصطناعي" : "Full AI Generation",
                  body: isAr
                    ? "اكتب عنوان الدرس واختر عدد الشرائح — الذكاء الاصطناعي يبني لك شرائح منظّمة مع محتوى مناسب."
                    : "Type your lesson title and choose the number of slides — the AI builds structured slides with relevant content for you.",
                },
                {
                  icon: <MessageSquare className="w-5 h-5" />,
                  title: isAr ? "أسئلة مدمجة في الشرائح" : "Questions Embedded in Slides",
                  body: isAr
                    ? "أضف سؤال اختيار متعدد أو استطلاع رأي أو كلمة سحابية داخل أي شريحة وتلقّ إجابات الطلاب لحظياً."
                    : "Add multiple-choice questions, opinion polls, or word clouds inside any slide and receive student responses instantly.",
                },
                {
                  icon: <Play className="w-5 h-5" />,
                  title: isAr ? "عرض مباشر بتزامن فوري" : "Live Presentation with Instant Sync",
                  body: isAr
                    ? "يرى الطلاب كل شريحة على هواتفهم بمجرد انتقالك لها — بدون أي تأخير."
                    : "Students see every slide on their phones the moment you advance — with zero delay.",
                },
                {
                  icon: <BarChart3 className="w-5 h-5" />,
                  title: isAr ? "نتائج فورية على الشاشة" : "Instant Results on Screen",
                  body: isAr
                    ? "تظهر إجابات الطلاب على الشاشة الرئيسية فور إرسالها — مرئياً ومؤثراً."
                    : "Student responses appear on the main screen the moment they're submitted — visually and impactfully.",
                },
                {
                  icon: <Users className="w-5 h-5" />,
                  title: isAr ? "دخول بدون حساب" : "Join Without an Account",
                  body: isAr
                    ? "يدخل الطلاب برمز PIN من أي متصفح دون تسجيل أو تحميل."
                    : "Students join with a PIN from any browser — no registration or downloads required.",
                },
                {
                  icon: <Layers className="w-5 h-5" />,
                  title: isAr ? "تعديل كامل قبل العرض" : "Full Editing Before Presenting",
                  body: isAr
                    ? "تحكّم في كل شريحة — النص والصور والأسئلة وترتيب الشرائح."
                    : "Take full control of every slide — text, images, questions, and slide order.",
                },
                {
                  icon: <Presentation className="w-5 h-5" />,
                  title: isAr ? "وضع عرض احترافي" : "Professional Presentation Mode",
                  body: isAr
                    ? "واجهة عرض نظيفة بدون إلهاءات — مثالية لشاشة الفصل أو عرض Zoom."
                    : "A clean, distraction-free presentation interface — perfect for classroom screens or Zoom sessions.",
                },
                {
                  icon: <CheckCircle2 className="w-5 h-5" />,
                  title: isAr ? "تقارير مشاركة بعد العرض" : "Participation Reports After the Session",
                  body: isAr
                    ? "احصل على تقرير يُظهر من شارك وما هي الإجابات الأكثر شيوعاً لكل سؤال."
                    : "Get a report showing who participated and the most common answers for each question.",
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

          {/* الاستخدامات / Use cases */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-6">
              {isAr ? "كيف يستخدمها المعلمون؟" : "How Do Teachers Use It?"}
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  title: isAr ? "شرح درس جديد" : "Introducing a New Lesson",
                  body: isAr
                    ? "قدّم الدرس بشرائح منظّمة وأسئلة تفقّد الفهم دمجتها في كل شريحة."
                    : "Present the lesson with structured slides and comprehension-check questions embedded in every slide.",
                },
                {
                  title: isAr ? "مراجعة تفاعلية" : "Interactive Review",
                  body: isAr
                    ? "مرّر الطلاب على أهم المفاهيم بأسئلة تتضمّن نقاشات وتصويتات حية."
                    : "Walk students through key concepts with questions that include live discussions and voting.",
                },
                {
                  title: isAr ? "ورشة عمل جماعية" : "Group Workshop",
                  body: isAr
                    ? "استخدم الكلمة السحابية لجمع أفكار الطلاب والعصف الذهني الجماعي."
                    : "Use the word cloud to collect student ideas and facilitate collaborative brainstorming.",
                },
              ].map(({ title, body }) => (
                <div key={title} className="p-5 bg-white border border-emerald-100 rounded-xl">
                  <Sparkles className="w-6 h-6 text-emerald-600 mb-2" />
                  <h3 className="font-bold text-emerald-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* روابط داخلية / Internal links */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-emerald-900 mb-4">
              {isAr ? "استكشف أدوات حصاد الأخرى" : "Explore Other Hasad Tools"}
            </h2>
            <div className="flex flex-wrap gap-3">
              {[
                {
                  href: "/features/interactive-video",
                  label: isAr ? "الفيديو التعليمي التفاعلي" : "Interactive Educational Video",
                },
                {
                  href: "/features/smart-whiteboard",
                  label: isAr ? "السبورة الذكية" : "Smart Whiteboard",
                },
                {
                  href: "/features/worksheet-ai",
                  label: isAr ? "مولّد أوراق العمل" : "Worksheet Generator",
                },
                {
                  href: "/features/lesson-plan-ai",
                  label: isAr ? "مولّد خطة الدرس" : "Lesson Plan Generator",
                },
                {
                  href: "/features/wameeth",
                  label: isAr ? "وميض — مسابقات مباشرة" : "Wameeth — Live Quizzes",
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
              {isAr ? "أنشئ عرضك الأول الآن" : "Create Your First Presentation Now"}
            </h2>
            <p className="text-emerald-100 mb-6 max-w-xl mx-auto leading-relaxed">
              {isAr
                ? "اكتب عنوان الدرس واجعل الذكاء الاصطناعي يبني لك العرض — مجاناً تماماً."
                : "Type your lesson title and let the AI build the presentation for you — completely free."}
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
